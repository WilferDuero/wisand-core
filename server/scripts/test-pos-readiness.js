#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});

const DEFAULT_BASE_URL = `http://localhost:${process.env.PORT || 3001}`;
const API_BASE_URL = String(process.env.TEST_API_BASE || process.env.API_BASE || DEFAULT_BASE_URL)
  .trim()
  .replace(/\/+$/, "");

const MASTER_KEY = String(process.env.MASTER_KEY || "").trim();

const TENANT_NAME = String(process.env.READINESS_TENANT_NAME || "Readiness Demo").trim();
const TENANT_CODE = String(process.env.READINESS_TENANT_CODE || "ready-demo")
  .trim()
  .toLowerCase();
const OWNER_USERNAME = String(process.env.READINESS_OWNER_USERNAME || "owner_ready").trim();
const OWNER_PASSWORD = String(process.env.READINESS_OWNER_PASSWORD || "123456").trim();

const STAFF_PASSWORD = String(process.env.READINESS_STAFF_PASSWORD || "123456").trim();

const PASS = "[PASS]";
const FAIL = "[FAIL]";
const INFO = "[INFO]";
const WARN = "[WARN]";

const results = {
  pass: 0,
  fail: 0,
  warn: 0,
};

function log(prefix, message) {
  console.log(`${prefix} ${message}`);
}

function pass(message) {
  results.pass += 1;
  log(PASS, message);
}

function fail(message) {
  results.fail += 1;
  log(FAIL, message);
}

function warn(message) {
  results.warn += 1;
  log(WARN, message);
}

function info(message) {
  log(INFO, message);
}

function toJsonText(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function requestJson(endpoint, { method = "GET", token = "", headers = {}, body } = {}) {
  const nextHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    nextHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: nextHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    json,
    raw: text,
  };
}

function assertCondition(condition, okMessage, failMessage) {
  if (condition) {
    pass(okMessage);
    return;
  }
  throw new Error(failMessage);
}

async function login(tenantCode, username, password) {
  return requestJson("/auth/login", {
    method: "POST",
    body: {
      tenant_code: tenantCode,
      username,
      password,
    },
  });
}

function extractProducts(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function ensureGoLiveCheck() {
  const goLiveScript = path.join(__dirname, "go-live-check.js");
  const run = spawnSync(process.execPath, [goLiveScript], {
    cwd: path.join(__dirname, ".."),
    env: process.env,
    encoding: "utf8",
  });

  if (run.status === 0) {
    pass("go-live-check OK.");
    return;
  }

  const stdout = String(run.stdout || "").trim();
  const stderr = String(run.stderr || "").trim();
  const details = [stdout, stderr].filter(Boolean).join(" | ");
  throw new Error(`go-live-check fallo. ${details}`);
}

async function main() {
  info(`API base: ${API_BASE_URL}`);

  if (!MASTER_KEY) {
    throw new Error("MASTER_KEY no configurada en server/.env");
  }

  const apiHealth = await requestJson("/health", { method: "GET", headers: { "Content-Type": "application/json" } });
  assertCondition(apiHealth.ok, "API /health responde correctamente.", "API no responde en /health.");

  const createTenant = await requestJson("/internal/tenants", {
    method: "POST",
    headers: {
      "X-Master-Key": MASTER_KEY,
    },
    body: {
      name: TENANT_NAME,
      code: TENANT_CODE,
      ownerUsername: OWNER_USERNAME,
      ownerPassword: OWNER_PASSWORD,
      ownerRole: "owner",
    },
  });

  if (createTenant.status === 201) {
    pass(`Tenant readiness creado (${TENANT_CODE}).`);
  } else if (createTenant.status === 409) {
    pass(`Tenant readiness ya existia (${TENANT_CODE}).`);
  } else {
    throw new Error(
      `No se pudo crear/validar tenant readiness. status=${createTenant.status} body=${toJsonText(
        createTenant.json || createTenant.raw
      )}`
    );
  }

  const ownerLogin = await login(TENANT_CODE, OWNER_USERNAME, OWNER_PASSWORD);
  if (!ownerLogin.ok || !ownerLogin.json?.token) {
    throw new Error(
      `Login owner readiness fallo. status=${ownerLogin.status} body=${toJsonText(ownerLogin.json || ownerLogin.raw)}`
    );
  }

  const ownerToken = String(ownerLogin.json.token);
  pass("Login owner readiness OK.");

  const staffUsername = `staff_ready_${Date.now()}`;
  const createStaff = await requestJson("/users", {
    method: "POST",
    token: ownerToken,
    body: {
      username: staffUsername,
      password: STAFF_PASSWORD,
      role: "staff",
    },
  });
  if (!createStaff.ok) {
    throw new Error(
      `No se pudo crear usuario staff de prueba. status=${createStaff.status} body=${toJsonText(
        createStaff.json || createStaff.raw
      )}`
    );
  }
  pass(`Staff de prueba creado (${staffUsername}).`);

  const externalId = `ready-product-${Date.now()}`;
  const productPayload = {
    externalId,
    nombre: "Producto Readiness",
    descripcion: "Prueba automatizada 4-en-1",
    categoria: "Test",
    disponibilidad: "Disponible",
    imagen: "",
    precioCaja: 20000,
    precioSobre: 2000,
    precioUnidad: 200,
    sobresXCaja: 10,
    unidadesXSobre: 10,
    stockCajas: 5,
    ofertaActiva: false,
    ofertaTexto: "",
    ofertaPrecioCaja: 0,
    ofertaPrecioSobre: 0,
  };

  const createProduct = await requestJson("/products", {
    method: "POST",
    token: ownerToken,
    body: productPayload,
  });
  if (!createProduct.ok) {
    throw new Error(
      `Owner no pudo crear producto. status=${createProduct.status} body=${toJsonText(createProduct.json || createProduct.raw)}`
    );
  }
  pass(`Owner creo producto (${externalId}).`);

  const reasonAdjust = `ajuste_rapido_readiness_${Date.now()}`;
  const adjustPayload = {
    ...productPayload,
    stockCajas: 9,
    stockMovementType: "entrada",
    stockReason: reasonAdjust,
  };

  const adjustStock = await requestJson(`/products/external/${encodeURIComponent(externalId)}`, {
    method: "PUT",
    token: ownerToken,
    body: adjustPayload,
  });
  if (!adjustStock.ok) {
    throw new Error(
      `Owner no pudo ajustar stock. status=${adjustStock.status} body=${toJsonText(adjustStock.json || adjustStock.raw)}`
    );
  }
  pass("Ajuste rapido de stock (owner) OK.");

  const movements = await requestJson(
    `/inventory/movements?externalId=${encodeURIComponent(externalId)}&limit=50`,
    {
      method: "GET",
      token: ownerToken,
    }
  );
  if (!movements.ok) {
    throw new Error(
      `No se pudo consultar movimientos. status=${movements.status} body=${toJsonText(movements.json || movements.raw)}`
    );
  }
  const movementRows = Array.isArray(movements.json?.items) ? movements.json.items : [];
  const foundAdjust = movementRows.some(
    (row) => String(row?.reason || "") === reasonAdjust && String(row?.movement_type || "") === "entrada"
  );
  assertCondition(foundAdjust, "Movimiento de ajuste registrado correctamente.", "No se encontro movimiento del ajuste rapido.");

  const staffLogin = await login(TENANT_CODE, staffUsername, STAFF_PASSWORD);
  if (!staffLogin.ok || !staffLogin.json?.token) {
    throw new Error(
      `Login staff fallo. status=${staffLogin.status} body=${toJsonText(staffLogin.json || staffLogin.raw)}`
    );
  }
  const staffToken = String(staffLogin.json.token);
  pass("Login staff OK.");

  const staffProducts = await requestJson("/products?page=1&limit=100", {
    method: "GET",
    token: staffToken,
  });
  if (!staffProducts.ok) {
    throw new Error(`Staff no pudo listar productos. status=${staffProducts.status}`);
  }
  const productRows = extractProducts(staffProducts.json);
  const readyProduct = productRows.find(
    (row) => String(row?.externalId || row?.externalid || "") === externalId
  );
  assertCondition(!!readyProduct, "Staff ve catalogo del tenant.", "Staff no ve producto esperado en catalogo.");

  const salePrice = Math.max(1, Number(readyProduct?.precioUnidad) || 0);
  const salePayload = {
    refId: `ready-sale-${Date.now()}`,
    clienteNombre: "Cliente Prueba",
    clienteTelefono: "3000000000",
    metodoPago: "efectivo",
    total: salePrice,
    items: [
      {
        id: String(readyProduct?.externalId || readyProduct?.id || externalId),
        code: String(readyProduct?.externalId || externalId),
        nombre: String(readyProduct?.nombre || "Producto"),
        presentacion: "unidad",
        cantidad: 1,
        precio: salePrice,
        subtotal: salePrice,
        unidadesEquivalentes: 1,
      },
    ],
  };

  const staffSale = await requestJson("/sales", {
    method: "POST",
    token: staffToken,
    body: salePayload,
  });
  if (!staffSale.ok) {
    throw new Error(
      `Staff no pudo registrar venta. status=${staffSale.status} body=${toJsonText(staffSale.json || staffSale.raw)}`
    );
  }
  pass("Staff puede registrar venta (flujo caja). ");

  const unauthorizedCreate = await requestJson("/products", {
    method: "POST",
    token: staffToken,
    body: {
      ...productPayload,
      externalId: `staff-block-create-${Date.now()}`,
      nombre: "No debe crear",
    },
  });
  assertCondition(
    unauthorizedCreate.status === 403,
    "Staff bloqueado en crear productos (403).",
    `Staff pudo crear producto inesperadamente. status=${unauthorizedCreate.status}`
  );

  const unauthorizedUpdate = await requestJson(`/products/external/${encodeURIComponent(externalId)}`, {
    method: "PUT",
    token: staffToken,
    body: {
      ...adjustPayload,
      stockCajas: 11,
      stockReason: `staff_update_block_${Date.now()}`,
      stockMovementType: "entrada",
    },
  });
  assertCondition(
    unauthorizedUpdate.status === 403,
    "Staff bloqueado en editar productos (403).",
    `Staff pudo editar producto inesperadamente. status=${unauthorizedUpdate.status}`
  );

  const unauthorizedDelete = await requestJson(`/products/external/${encodeURIComponent(externalId)}`, {
    method: "DELETE",
    token: staffToken,
  });
  assertCondition(
    unauthorizedDelete.status === 403,
    "Staff bloqueado en eliminar productos (403).",
    `Staff pudo eliminar producto inesperadamente. status=${unauthorizedDelete.status}`
  );

  const csvTemplate = path.join(__dirname, "..", "..", "apps", "pos-web", "examples", "catalogo_template.csv");
  if (fs.existsSync(csvTemplate)) {
    pass("Plantilla CSV operativa encontrada (apps/pos-web/examples/catalogo_template.csv).");
  } else {
    warn("No se encontro plantilla CSV operativa en apps/pos-web/examples/catalogo_template.csv.");
  }

  ensureGoLiveCheck();

  info(`Resumen => PASS:${results.pass} WARN:${results.warn} FAIL:${results.fail}`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    fail(error?.message || String(error));
    info(`Resumen => PASS:${results.pass} WARN:${results.warn} FAIL:${results.fail}`);
    process.exit(1);
  });
