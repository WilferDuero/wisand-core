#!/usr/bin/env node
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});

const sqlite3 = require("sqlite3");
const bcrypt = require("bcryptjs");
const { open } = require("sqlite");

const SOURCE_API_BASE = String(
  process.env.SOURCE_API_BASE || "https://drogueria-renacer.onrender.com"
)
  .trim()
  .replace(/\/+$/, "");
const SOURCE_USERNAME = String(process.env.SOURCE_USERNAME || "SandyMolina").trim();
const SOURCE_PASSWORD = String(process.env.SOURCE_PASSWORD || "Wisand2729").trim();
const TARGET_DB_FILE = String(
  process.env.TARGET_DB_FILE || path.join(__dirname, "..", "data", "app.db")
).trim();
const TENANT_CODE = String(process.env.TENANT_CODE || "drogueria-renacer")
  .trim()
  .toLowerCase();
const TENANT_NAME = String(process.env.TENANT_NAME || "Drogueria Renacer").trim();
const TEMP_PASSWORD = String(process.env.TEMP_PASSWORD || "Renacer#2026").trim();

const toInt = (value, fallback = 0) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const asIso = (value) => {
  const raw = String(value || "").trim();
  return raw || new Date().toISOString();
};

const safeString = (value) => String(value ?? "").trim();

const jsonText = (value, fallback = []) => {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return JSON.stringify(Array.isArray(parsed) ? parsed : fallback);
  } catch {
    return JSON.stringify(fallback);
  }
};

async function httpRequest(pathname, options = {}) {
  const response = await fetch(`${SOURCE_API_BASE}${pathname}`, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.error || payload?.message || `HTTP ${response.status}`;
    const error = new Error(`${pathname}: ${message}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function sourceLogin() {
  return httpRequest("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: SOURCE_USERNAME,
      password: SOURCE_PASSWORD,
    }),
  });
}

async function fetchAllProducts() {
  const first = await httpRequest("/products?page=1&limit=100", {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (Array.isArray(first)) return first;
  const items = Array.isArray(first?.items) ? first.items.slice() : [];
  const totalPages = Math.max(1, toInt(first?.totalPages, 1));
  for (let page = 2; page <= totalPages; page += 1) {
    const pagePayload = await httpRequest(`/products?page=${page}&limit=100`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const pageItems = Array.isArray(pagePayload?.items)
      ? pagePayload.items
      : Array.isArray(pagePayload)
      ? pagePayload
      : [];
    items.push(...pageItems);
  }
  return items;
}

async function fetchProtected(pathname, token) {
  return httpRequest(pathname, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

async function ensureTenant(db) {
  let tenant = await db.get("SELECT id, name, code FROM tenants WHERE code = ?", [TENANT_CODE]);
  if (tenant?.id) return tenant;
  const insert = await db.run("INSERT INTO tenants (name, code) VALUES (?,?)", [
    TENANT_NAME,
    TENANT_CODE,
  ]);
  const tenantId = toInt(insert?.lastID, 0);
  tenant = await db.get("SELECT id, name, code FROM tenants WHERE id = ?", [tenantId]);
  if (!tenant?.id) {
    throw new Error("No se pudo crear tenant destino");
  }
  return tenant;
}

async function upsertBranding(db, tenantId) {
  const payload = {
    display_name: TENANT_NAME,
    logo_url: "https://i.ibb.co/bRFJK7Hn/logo-drogueria.jpg",
    primary_color: "#21808d",
    secondary_color: "#0f172a",
    accent_color: "#ff7a18",
  };
  const existing = await db.get("SELECT tenant_id FROM tenant_branding WHERE tenant_id = ?", [tenantId]);
  if (existing?.tenant_id) {
    await db.run(
      `
      UPDATE tenant_branding
      SET display_name = ?, logo_url = ?, primary_color = ?, secondary_color = ?, accent_color = ?, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ?
    `,
      [
        payload.display_name,
        payload.logo_url,
        payload.primary_color,
        payload.secondary_color,
        payload.accent_color,
        tenantId,
      ]
    );
    return;
  }
  await db.run(
    `
    INSERT INTO tenant_branding (
      tenant_id, display_name, logo_url, primary_color, secondary_color, accent_color, updated_at
    )
    VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
  `,
    [
      tenantId,
      payload.display_name,
      payload.logo_url,
      payload.primary_color,
      payload.secondary_color,
      payload.accent_color,
    ]
  );
}

async function main() {
  console.log("[import-renacer] start");
  console.log(`[import-renacer] source_api=${SOURCE_API_BASE}`);
  console.log(`[import-renacer] target_db=${TARGET_DB_FILE}`);

  if (!SOURCE_USERNAME || !SOURCE_PASSWORD) {
    throw new Error("SOURCE_USERNAME/SOURCE_PASSWORD requeridos");
  }

  const login = await sourceLogin();
  const sourceToken = safeString(login?.token);
  if (!sourceToken) {
    throw new Error("No se obtuvo token del backend fuente");
  }
  console.log(`[import-renacer] source_owner=${login?.user?.username || SOURCE_USERNAME}`);

  const [sourceUsers, sourceProducts, sourceOrders, sourceSales, sourceReviews] = await Promise.all([
    fetchProtected("/users", sourceToken),
    fetchAllProducts(),
    fetchProtected("/orders", sourceToken),
    fetchProtected("/sales", sourceToken),
    fetchProtected("/reviews", sourceToken),
  ]);

  const users = Array.isArray(sourceUsers) ? sourceUsers : [];
  const products = Array.isArray(sourceProducts) ? sourceProducts : [];
  const orders = Array.isArray(sourceOrders) ? sourceOrders : [];
  const sales = Array.isArray(sourceSales) ? sourceSales : [];
  const reviews = Array.isArray(sourceReviews) ? sourceReviews : [];

  console.log(
    `[import-renacer] source_counts users=${users.length} products=${products.length} orders=${orders.length} sales=${sales.length} reviews=${reviews.length}`
  );

  const db = await open({ filename: TARGET_DB_FILE, driver: sqlite3.Database });
  await db.exec("BEGIN TRANSACTION");

  try {
    const tenant = await ensureTenant(db);
    const tenantId = toInt(tenant?.id, 0);
    if (!tenantId) throw new Error("tenant_id inválido");
    await upsertBranding(db, tenantId);

    const sourceUsersById = new Map();
    const targetUsersByUsername = new Map();
    const tempPasswordHash = await bcrypt.hash(TEMP_PASSWORD, 10);

    let usersCreated = 0;
    let usersUpdated = 0;
    let usersSkipped = 0;

    for (const src of users) {
      const sourceUserId = toInt(src?.id, 0);
      const username = safeString(src?.username);
      const role = safeString(src?.role || "staff").toLowerCase() === "owner" ? "owner" : "staff";
      if (!username) {
        usersSkipped += 1;
        continue;
      }

      sourceUsersById.set(sourceUserId, { username, role });

      const existing = await db.get(
        "SELECT id, tenant_id, username, role FROM users WHERE username = ?",
        [username]
      );
      if (existing?.id) {
        if (toInt(existing.tenant_id, 0) !== tenantId) {
          usersSkipped += 1;
          continue;
        }
        if (safeString(existing.role).toLowerCase() !== role) {
          await db.run("UPDATE users SET role = ? WHERE id = ? AND tenant_id = ?", [
            role,
            existing.id,
            tenantId,
          ]);
          usersUpdated += 1;
        }
        targetUsersByUsername.set(username, toInt(existing.id, 0));
        continue;
      }

      const insert = await db.run(
        "INSERT INTO users (tenant_id, username, passwordHash, role, createdAt) VALUES (?,?,?,?,?)",
        [tenantId, username, tempPasswordHash, role, asIso(src?.createdAt)]
      );
      const newId = toInt(insert?.lastID, 0);
      if (newId) {
        usersCreated += 1;
        targetUsersByUsername.set(username, newId);
      }
    }

    const orderTargetIdByExternal = new Map();
    const orderTargetIdBySourceId = new Map();

    let productsInserted = 0;
    let productsUpdated = 0;
    for (const src of products) {
      const externalId = safeString(src?.externalId || src?.id);
      if (!externalId) continue;
      const existing = await db.get(
        "SELECT id FROM products WHERE tenant_id = ? AND externalId = ?",
        [tenantId, externalId]
      );
      const params = [
        safeString(src?.nombre),
        safeString(src?.descripcion),
        safeString(src?.categoria),
        safeString(src?.disponibilidad || "Disponible"),
        safeString(src?.imagen),
        toNumber(src?.precioCaja),
        toNumber(src?.precioSobre),
        toNumber(src?.precioUnidad),
        toInt(src?.sobresXCaja),
        toInt(src?.unidadesXSobre),
        toInt(src?.stockCajas),
        src?.ofertaActiva ? 1 : 0,
        safeString(src?.ofertaTexto),
        toNumber(src?.ofertaPrecioCaja),
        toNumber(src?.ofertaPrecioSobre),
        asIso(src?.createdAt),
        asIso(src?.updatedAt),
      ];
      if (existing?.id) {
        await db.run(
          `
          UPDATE products
          SET nombre = ?, descripcion = ?, categoria = ?, disponibilidad = ?, imagen = ?,
              precioCaja = ?, precioSobre = ?, precioUnidad = ?, sobresXCaja = ?, unidadesXSobre = ?, stockCajas = ?,
              ofertaActiva = ?, ofertaTexto = ?, ofertaPrecioCaja = ?, ofertaPrecioSobre = ?, createdAt = ?, updatedAt = ?
          WHERE id = ? AND tenant_id = ?
        `,
          [...params, existing.id, tenantId]
        );
        productsUpdated += 1;
      } else {
        await db.run(
          `
          INSERT INTO products (
            tenant_id, externalId, nombre, descripcion, categoria, disponibilidad, imagen,
            precioCaja, precioSobre, precioUnidad, sobresXCaja, unidadesXSobre, stockCajas,
            ofertaActiva, ofertaTexto, ofertaPrecioCaja, ofertaPrecioSobre, createdAt, updatedAt
          )
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `,
          [tenantId, externalId, ...params]
        );
        productsInserted += 1;
      }
    }

    let ordersInserted = 0;
    let ordersUpdated = 0;
    for (const src of orders) {
      const sourceId = toInt(src?.id, 0);
      const externalId = safeString(src?.externalId || src?.id);
      if (!externalId) continue;
      const existing = await db.get(
        "SELECT id FROM orders WHERE tenant_id = ? AND externalId = ?",
        [tenantId, externalId]
      );
      const params = [
        safeString(src?.clienteNombre),
        safeString(src?.clienteTelefono),
        safeString(src?.clienteDireccion),
        jsonText(src?.items, []),
        toNumber(src?.total),
        safeString(src?.estado || "pendiente"),
        asIso(src?.createdAt),
      ];
      if (existing?.id) {
        await db.run(
          `
          UPDATE orders
          SET clienteNombre = ?, clienteTelefono = ?, clienteDireccion = ?, items = ?, total = ?, estado = ?, createdAt = ?
          WHERE id = ? AND tenant_id = ?
        `,
          [...params, existing.id, tenantId]
        );
        orderTargetIdByExternal.set(externalId, toInt(existing.id, 0));
        if (sourceId) orderTargetIdBySourceId.set(String(sourceId), toInt(existing.id, 0));
        ordersUpdated += 1;
      } else {
        const insert = await db.run(
          `
          INSERT INTO orders (
            tenant_id, externalId, clienteNombre, clienteTelefono, clienteDireccion, items, total, estado, createdAt
          )
          VALUES (?,?,?,?,?,?,?,?,?)
        `,
          [tenantId, externalId, ...params]
        );
        const newId = toInt(insert?.lastID, 0);
        if (newId) {
          orderTargetIdByExternal.set(externalId, newId);
          if (sourceId) orderTargetIdBySourceId.set(String(sourceId), newId);
        }
        ordersInserted += 1;
      }
    }

    let salesInserted = 0;
    let salesUpdated = 0;
    for (const src of sales) {
      const refId = safeString(src?.refId);
      const sourceUserById = sourceUsersById.get(toInt(src?.userId, 0));
      const username = safeString(src?.userName || sourceUserById?.username || SOURCE_USERNAME);
      const targetUserId = toInt(targetUsersByUsername.get(username), 0);
      const targetUserName = username || SOURCE_USERNAME;
      const orderId =
        toInt(orderTargetIdByExternal.get(refId), 0) ||
        toInt(orderTargetIdBySourceId.get(refId), 0) ||
        null;

      let existing = null;
      if (orderId) {
        existing = await db.get(
          "SELECT id FROM sales WHERE tenant_id = ? AND order_id = ?",
          [tenantId, orderId]
        );
      }
      if (!existing?.id && refId && targetUserId) {
        existing = await db.get(
          "SELECT id FROM sales WHERE tenant_id = ? AND refId = ? AND userId = ?",
          [tenantId, refId, targetUserId]
        );
      }

      const params = [
        orderId,
        refId || null,
        targetUserId || null,
        targetUserName,
        safeString(src?.clienteNombre),
        safeString(src?.clienteTelefono),
        toNumber(src?.total),
        jsonText(src?.items, []),
        safeString(src?.metodoPago),
        asIso(src?.fechaISO || src?.createdAt),
        asIso(src?.createdAt),
      ];

      if (existing?.id) {
        await db.run(
          `
          UPDATE sales
          SET order_id = ?, refId = ?, userId = ?, userName = ?, clienteNombre = ?, clienteTelefono = ?,
              total = ?, items = ?, metodoPago = ?, fechaISO = ?, createdAt = ?
          WHERE id = ? AND tenant_id = ?
        `,
          [...params, existing.id, tenantId]
        );
        salesUpdated += 1;
      } else {
        await db.run(
          `
          INSERT INTO sales (
            tenant_id, order_id, refId, userId, userName, clienteNombre, clienteTelefono, total, items, metodoPago, fechaISO, createdAt
          )
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        `,
          [tenantId, ...params]
        );
        salesInserted += 1;
      }
    }

    let reviewsInserted = 0;
    for (const src of reviews) {
      const createdAt = asIso(src?.createdAt);
      const existing = await db.get(
        `
        SELECT id FROM reviews
        WHERE tenant_id = ? AND nombre = ? AND telefono = ? AND rating = ? AND texto = ? AND createdAt = ?
      `,
        [
          tenantId,
          safeString(src?.nombre),
          safeString(src?.telefono),
          toInt(src?.rating),
          safeString(src?.texto),
          createdAt,
        ]
      );
      if (existing?.id) continue;
      await db.run(
        `
        INSERT INTO reviews (tenant_id, nombre, telefono, rating, texto, verificada, createdAt)
        VALUES (?,?,?,?,?,?,?)
      `,
        [
          tenantId,
          safeString(src?.nombre),
          safeString(src?.telefono),
          toInt(src?.rating),
          safeString(src?.texto),
          src?.verificada ? 1 : 0,
          createdAt,
        ]
      );
      reviewsInserted += 1;
    }

    await db.exec("COMMIT");

    const finalCounts = {};
    for (const tableName of ["users", "products", "orders", "sales", "reviews"]) {
      const row = await db.get(`SELECT COUNT(*) as c FROM ${tableName} WHERE tenant_id = ?`, [
        tenantId,
      ]);
      finalCounts[tableName] = toInt(row?.c ?? row?.count, 0);
    }

    console.log(
      `[import-renacer] users created=${usersCreated} updated=${usersUpdated} skipped=${usersSkipped}`
    );
    console.log(
      `[import-renacer] products inserted=${productsInserted} updated=${productsUpdated}`
    );
    console.log(`[import-renacer] orders inserted=${ordersInserted} updated=${ordersUpdated}`);
    console.log(`[import-renacer] sales inserted=${salesInserted} updated=${salesUpdated}`);
    console.log(`[import-renacer] reviews inserted=${reviewsInserted}`);
    console.log(
      `[import-renacer] final tenant=${TENANT_CODE} users=${finalCounts.users} products=${finalCounts.products} orders=${finalCounts.orders} sales=${finalCounts.sales} reviews=${finalCounts.reviews}`
    );
    console.log(
      `[import-renacer] done. Temp password usado para nuevos usuarios: "${TEMP_PASSWORD}"`
    );
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error("[import-renacer] FAILED", error?.message || error);
  process.exit(1);
});
