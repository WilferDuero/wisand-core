const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
  override: true,
});

const fs = require("fs");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcryptjs");
const { open } = require("sqlite");

const usePostgres = !!process.env.DATABASE_URL;
const DEFAULT_TENANT_ID = 1;
const DEFAULT_TENANT_NAME = "Default Tenant";
const DEFAULT_TENANT_CODE = "default";
const DEFAULT_BRANDING = Object.freeze({
  display_name: "WISAND",
  logo_url: "",
  primary_color: "#18b7e5",
  secondary_color: "#0f172a",
  accent_color: "#2f6df6",
});

function replacePlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function normalizeTenantCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildTenantCodeBase(row) {
  const id = Number(row?.id || 0);
  if (id === DEFAULT_TENANT_ID) return DEFAULT_TENANT_CODE;
  return (
    normalizeTenantCode(row?.code) ||
    normalizeTenantCode(row?.name) ||
    (id > 0 ? `tenant-${id}` : "tenant")
  );
}

function nextAvailableTenantCode(baseCode, usedCodes) {
  let candidate = normalizeTenantCode(baseCode) || "tenant";
  if (!usedCodes.has(candidate)) return candidate;
  let suffix = 2;
  while (usedCodes.has(`${candidate}-${suffix}`)) {
    suffix += 1;
  }
  return `${candidate}-${suffix}`;
}

async function ensureTenantCodes(db) {
  const rows = await db.all("SELECT id, name, code FROM tenants ORDER BY id ASC");
  const used = new Set();

  for (const row of rows || []) {
    const id = Number(row?.id || 0);
    const currentCode = normalizeTenantCode(row?.code);
    const preferredBase = buildTenantCodeBase(row);

    let nextCode = currentCode;
    if (
      !nextCode ||
      used.has(nextCode) ||
      (id === DEFAULT_TENANT_ID && nextCode !== DEFAULT_TENANT_CODE)
    ) {
      if (id === DEFAULT_TENANT_ID) {
        nextCode = DEFAULT_TENANT_CODE;
      } else {
        nextCode = nextAvailableTenantCode(preferredBase, used);
      }
    }

    if (used.has(nextCode)) {
      nextCode = nextAvailableTenantCode(preferredBase, used);
    }

    used.add(nextCode);
    if (String(row?.code || "") !== nextCode) {
      await db.run("UPDATE tenants SET code = ? WHERE id = ?", [nextCode, id]);
    }
  }
}

async function applySqliteMultiTenantMigration(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenant_branding (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT 'WISAND',
      logo_url TEXT,
      primary_color TEXT NOT NULL DEFAULT '#18b7e5',
      secondary_color TEXT NOT NULL DEFAULT '#0f172a',
      accent_color TEXT NOT NULL DEFAULT '#2f6df6',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const alterStatements = [
    "ALTER TABLE tenants ADD COLUMN code TEXT;",
    "ALTER TABLE tenant_branding ADD COLUMN display_name TEXT NOT NULL DEFAULT 'WISAND';",
    "ALTER TABLE tenant_branding ADD COLUMN logo_url TEXT;",
    "ALTER TABLE tenant_branding ADD COLUMN primary_color TEXT NOT NULL DEFAULT '#18b7e5';",
    "ALTER TABLE tenant_branding ADD COLUMN secondary_color TEXT NOT NULL DEFAULT '#0f172a';",
    "ALTER TABLE tenant_branding ADD COLUMN accent_color TEXT NOT NULL DEFAULT '#2f6df6';",
    "ALTER TABLE tenant_branding ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;",
    "ALTER TABLE products ADD COLUMN externalId TEXT;",
    "ALTER TABLE orders ADD COLUMN externalId TEXT;",
    "ALTER TABLE users ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;",
    "ALTER TABLE products ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;",
    "ALTER TABLE orders ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;",
    "ALTER TABLE reviews ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;",
    "ALTER TABLE sales ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;",
    "ALTER TABLE push_tokens ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT 1;",
    "ALTER TABLE sales ADD COLUMN order_id INTEGER;",
    "ALTER TABLE push_tokens ADD COLUMN userId INTEGER;",
  ];
  for (const stmt of alterStatements) {
    try {
      await db.exec(stmt);
    } catch (_e) {}
  }

  await db.run("INSERT OR IGNORE INTO tenants (id, name) VALUES (?,?)", [
    DEFAULT_TENANT_ID,
    DEFAULT_TENANT_NAME,
  ]);
  await db.run("UPDATE tenants SET name = ?, code = ? WHERE id = ?", [
    DEFAULT_TENANT_NAME,
    DEFAULT_TENANT_CODE,
    DEFAULT_TENANT_ID,
  ]);
  await db.exec(`
    INSERT INTO tenant_branding (
      tenant_id,
      display_name,
      logo_url,
      primary_color,
      secondary_color,
      accent_color,
      updated_at
    )
    SELECT
      t.id,
      COALESCE(NULLIF(TRIM(t.name), ''), '${DEFAULT_BRANDING.display_name}'),
      '${DEFAULT_BRANDING.logo_url}',
      '${DEFAULT_BRANDING.primary_color}',
      '${DEFAULT_BRANDING.secondary_color}',
      '${DEFAULT_BRANDING.accent_color}',
      CURRENT_TIMESTAMP
    FROM tenants t
    WHERE NOT EXISTS (
      SELECT 1 FROM tenant_branding b WHERE b.tenant_id = t.id
    );
  `);

  const backfillTenantStatements = [
    "UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0;",
    "UPDATE products SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0;",
    "UPDATE orders SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0;",
    "UPDATE reviews SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0;",
    "UPDATE sales SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0;",
    "UPDATE push_tokens SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0;",
  ];
  for (const stmt of backfillTenantStatements) {
    try {
      await db.exec(stmt);
    } catch (_e) {}
  }

  const indexStatements = [
    "DROP INDEX IF EXISTS idx_orders_externalId;",
    "DROP INDEX IF EXISTS idx_sales_ref_user;",
    "DROP INDEX IF EXISTS idx_push_tokens_role_active;",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_code ON tenants(code) WHERE code IS NOT NULL AND code <> '';",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_branding_tenant_id ON tenant_branding(tenant_id);",
    "CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);",
    "CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tenant_externalId ON orders(tenant_id, externalId) WHERE externalId IS NOT NULL;",
    "CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);",
    "CREATE INDEX IF NOT EXISTS idx_sales_tenant_userId ON sales(tenant_id, userId);",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_tenant_ref_user ON sales(tenant_id, refId, userId) WHERE refId IS NOT NULL;",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_tenant_order_id ON sales(tenant_id, order_id) WHERE order_id IS NOT NULL;",
    "CREATE INDEX IF NOT EXISTS idx_reviews_tenant_id ON reviews(tenant_id);",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);",
    "CREATE INDEX IF NOT EXISTS idx_push_tokens_tenant_role_active ON push_tokens(tenant_id, role, active);",
  ];
  for (const stmt of indexStatements) {
    try {
      await db.exec(stmt);
    } catch (_e) {}
  }
}

async function applyPostgresMultiTenantMigration(pool) {
  const statements = [
    `
    CREATE TABLE IF NOT EXISTS tenants (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS tenant_branding (
      id BIGSERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT 'WISAND',
      logo_url TEXT,
      primary_color TEXT NOT NULL DEFAULT '#18b7e5',
      secondary_color TEXT NOT NULL DEFAULT '#0f172a',
      accent_color TEXT NOT NULL DEFAULT '#2f6df6',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS code TEXT;",
    "ALTER TABLE tenant_branding ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT 'WISAND';",
    "ALTER TABLE tenant_branding ADD COLUMN IF NOT EXISTS logo_url TEXT;",
    "ALTER TABLE tenant_branding ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT '#18b7e5';",
    "ALTER TABLE tenant_branding ADD COLUMN IF NOT EXISTS secondary_color TEXT NOT NULL DEFAULT '#0f172a';",
    "ALTER TABLE tenant_branding ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT '#2f6df6';",
    "ALTER TABLE tenant_branding ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS externalId TEXT;",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS externalId TEXT;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id BIGINT;",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id BIGINT;",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id BIGINT;",
    "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS tenant_id BIGINT;",
    "ALTER TABLE sales ADD COLUMN IF NOT EXISTS tenant_id BIGINT;",
    "ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS tenant_id BIGINT;",
    "ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_id BIGINT;",
    "ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS userId BIGINT;",
    "INSERT INTO tenants (id, name, code) VALUES (1, 'Default Tenant', 'default') ON CONFLICT (id) DO NOTHING;",
    "UPDATE tenants SET name = 'Default Tenant', code = 'default' WHERE id = 1;",
    `
    INSERT INTO tenant_branding (
      tenant_id,
      display_name,
      logo_url,
      primary_color,
      secondary_color,
      accent_color,
      updated_at
    )
    SELECT
      t.id,
      COALESCE(NULLIF(BTRIM(t.name), ''), 'WISAND'),
      '',
      '#18b7e5',
      '#0f172a',
      '#2f6df6',
      CURRENT_TIMESTAMP
    FROM tenants t
    LEFT JOIN tenant_branding b ON b.tenant_id = t.id
    WHERE b.tenant_id IS NULL;
    `,
    "UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0;",
    "UPDATE products SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0;",
    "UPDATE orders SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0;",
    "UPDATE reviews SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0;",
    "UPDATE sales SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0;",
    "UPDATE push_tokens SET tenant_id = 1 WHERE tenant_id IS NULL OR tenant_id = 0;",
    "ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;",
    "ALTER TABLE products ALTER COLUMN tenant_id SET NOT NULL;",
    "ALTER TABLE orders ALTER COLUMN tenant_id SET NOT NULL;",
    "ALTER TABLE reviews ALTER COLUMN tenant_id SET NOT NULL;",
    "ALTER TABLE sales ALTER COLUMN tenant_id SET NOT NULL;",
    "ALTER TABLE push_tokens ALTER COLUMN tenant_id SET NOT NULL;",
    "ALTER TABLE users ALTER COLUMN tenant_id SET DEFAULT 1;",
    "ALTER TABLE products ALTER COLUMN tenant_id SET DEFAULT 1;",
    "ALTER TABLE orders ALTER COLUMN tenant_id SET DEFAULT 1;",
    "ALTER TABLE reviews ALTER COLUMN tenant_id SET DEFAULT 1;",
    "ALTER TABLE sales ALTER COLUMN tenant_id SET DEFAULT 1;",
    "ALTER TABLE push_tokens ALTER COLUMN tenant_id SET DEFAULT 1;",
    "DROP INDEX IF EXISTS idx_orders_externalId;",
    "DROP INDEX IF EXISTS idx_sales_ref_user;",
    "DROP INDEX IF EXISTS idx_push_tokens_role_active;",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_code ON tenants(code) WHERE code IS NOT NULL AND code <> '';",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_branding_tenant_id ON tenant_branding(tenant_id);",
    "CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);",
    "CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_tenant_externalId ON orders(tenant_id, externalId) WHERE externalId IS NOT NULL;",
    "CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);",
    "CREATE INDEX IF NOT EXISTS idx_sales_tenant_userId ON sales(tenant_id, userId);",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_tenant_ref_user ON sales(tenant_id, refId, userId) WHERE refId IS NOT NULL;",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_tenant_order_id ON sales(tenant_id, order_id) WHERE order_id IS NOT NULL;",
    "CREATE INDEX IF NOT EXISTS idx_reviews_tenant_id ON reviews(tenant_id);",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);",
    "CREATE INDEX IF NOT EXISTS idx_push_tokens_tenant_role_active ON push_tokens(tenant_id, role, active);",
    "SELECT setval(pg_get_serial_sequence('tenants', 'id'), GREATEST((SELECT MAX(id) FROM tenants), 1));",
  ];

  for (const stmt of statements) {
    await pool.query(stmt);
  }
}

async function ensureDefaultTenant(db, engine) {
  if (engine === "postgres") {
    await db.run(
      "INSERT INTO tenants (id, name, code) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING",
      [DEFAULT_TENANT_ID, DEFAULT_TENANT_NAME, DEFAULT_TENANT_CODE]
    );
    await db.run("UPDATE tenants SET name = ?, code = ? WHERE id = ?", [
      DEFAULT_TENANT_NAME,
      DEFAULT_TENANT_CODE,
      DEFAULT_TENANT_ID,
    ]);
    await db.get(
      "SELECT setval(pg_get_serial_sequence('tenants', 'id'), GREATEST((SELECT MAX(id) FROM tenants), 1))"
    );
    return DEFAULT_TENANT_ID;
  }

  await db.run("INSERT OR IGNORE INTO tenants (id, name, code) VALUES (?,?,?)", [
    DEFAULT_TENANT_ID,
    DEFAULT_TENANT_NAME,
    DEFAULT_TENANT_CODE,
  ]);
  await db.run("UPDATE tenants SET name = ?, code = ? WHERE id = ?", [
    DEFAULT_TENANT_NAME,
    DEFAULT_TENANT_CODE,
    DEFAULT_TENANT_ID,
  ]);
  return DEFAULT_TENANT_ID;
}

async function seedOwner(db, engine) {
  try {
    const tenantId = await ensureDefaultTenant(db, engine);
    await ensureTenantCodes(db);
    const row = await db.get("SELECT COUNT(*) as c FROM users WHERE tenant_id = ?", [tenantId]);
    const count = Number(row?.c ?? row?.count ?? 0);
    if (!count) {
      const username = process.env.ADMIN_USER || "admin";
      let password = String(process.env.ADMIN_PASS || "").trim();
      const role = process.env.ADMIN_ROLE || "owner";

      if (!password) {
        if (process.env.NODE_ENV === "production") {
          throw new Error(
            "ADMIN_PASS es obligatorio en production para crear el usuario owner inicial."
          );
        }
        password = "admin-local-change";
        console.warn(
          "ADMIN_PASS no definido. Se creo owner local con clave temporal 'admin-local-change'. Cambiala despues del primer login."
        );
      }

      const hash = await bcrypt.hash(password, 10);
      await db.run("INSERT INTO users (tenant_id, username, passwordHash, role) VALUES (?,?,?,?)", [
        tenantId,
        username,
        hash,
        role,
      ]);
    }
  } catch (e) {
    console.error("seedOwner error:", e?.message || e);
    throw e;
  }
}

async function initSqlite() {
  const dataDir = process.env.SQLITE_DIR || path.join(__dirname, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const dbFile = path.join(dataDir, "app.db");
  const db = await open({ filename: dbFile, driver: sqlite3.Database });
  await db.exec("PRAGMA journal_mode = WAL;");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tenant_branding (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT 'WISAND',
      logo_url TEXT,
      primary_color TEXT NOT NULL DEFAULT '#18b7e5',
      secondary_color TEXT NOT NULL DEFAULT '#0f172a',
      accent_color TEXT NOT NULL DEFAULT '#2f6df6',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      externalId TEXT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      categoria TEXT,
      disponibilidad TEXT,
      imagen TEXT,
      precioCaja REAL,
      precioSobre REAL,
      precioUnidad REAL,
      sobresXCaja INTEGER,
      unidadesXSobre INTEGER,
      stockCajas INTEGER,
      ofertaActiva INTEGER DEFAULT 0,
      ofertaTexto TEXT,
      ofertaPrecioCaja REAL,
      ofertaPrecioSobre REAL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      externalId TEXT,
      clienteNombre TEXT,
      clienteTelefono TEXT,
      clienteDireccion TEXT,
      items TEXT,
      total REAL,
      estado TEXT DEFAULT 'pendiente',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      nombre TEXT,
      telefono TEXT,
      rating INTEGER,
      texto TEXT,
      verificada INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      username TEXT UNIQUE,
      passwordHash TEXT,
      role TEXT DEFAULT 'staff',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      order_id INTEGER,
      refId TEXT,
      userId INTEGER,
      userName TEXT,
      clienteNombre TEXT,
      clienteTelefono TEXT,
      total REAL,
      items TEXT,
      metodoPago TEXT,
      fechaISO TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS push_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT 1,
      userId INTEGER,
      role TEXT DEFAULT 'owner',
      platform TEXT,
      deviceId TEXT,
      token TEXT UNIQUE,
      active INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await applySqliteMultiTenantMigration(db);
  await seedOwner(db, "sqlite");
  return db;
}

async function initPostgres() {
  const { Pool } = require("pg");
  const connectionString = process.env.DATABASE_URL;
  const needsSSL =
    /sslmode=require/i.test(connectionString || "") || process.env.PG_SSL === "true";
  const pool = new Pool({
    connectionString,
    ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
  });

  const statements = [
    `
    CREATE TABLE IF NOT EXISTS tenants (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS tenant_branding (
      id BIGSERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT 'WISAND',
      logo_url TEXT,
      primary_color TEXT NOT NULL DEFAULT '#18b7e5',
      secondary_color TEXT NOT NULL DEFAULT '#0f172a',
      accent_color TEXT NOT NULL DEFAULT '#2f6df6',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      externalId TEXT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      categoria TEXT,
      disponibilidad TEXT,
      imagen TEXT,
      precioCaja REAL,
      precioSobre REAL,
      precioUnidad REAL,
      sobresXCaja INTEGER,
      unidadesXSobre INTEGER,
      stockCajas INTEGER,
      ofertaActiva INTEGER DEFAULT 0,
      ofertaTexto TEXT,
      ofertaPrecioCaja REAL,
      ofertaPrecioSobre REAL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      externalId TEXT,
      clienteNombre TEXT,
      clienteTelefono TEXT,
      clienteDireccion TEXT,
      items TEXT,
      total REAL,
      estado TEXT DEFAULT 'pendiente',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      nombre TEXT,
      telefono TEXT,
      rating INTEGER,
      texto TEXT,
      verificada INTEGER DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      username TEXT UNIQUE,
      passwordHash TEXT,
      role TEXT DEFAULT 'staff',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      order_id BIGINT,
      refId TEXT,
      userId INTEGER,
      userName TEXT,
      clienteNombre TEXT,
      clienteTelefono TEXT,
      total REAL,
      items TEXT,
      metodoPago TEXT,
      fechaISO TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
    `
    CREATE TABLE IF NOT EXISTS push_tokens (
      id SERIAL PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      userId INTEGER,
      role TEXT DEFAULT 'owner',
      platform TEXT,
      deviceId TEXT,
      token TEXT UNIQUE,
      active INTEGER DEFAULT 1,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,
  ];

  for (const stmt of statements) {
    await pool.query(stmt);
  }
  await applyPostgresMultiTenantMigration(pool);

  const db = {
    async get(sql, params = []) {
      const text = replacePlaceholders(sql);
      const result = await pool.query(text, params);
      return result.rows[0];
    },
    async all(sql, params = []) {
      const text = replacePlaceholders(sql);
      const result = await pool.query(text, params);
      return result.rows;
    },
    async run(sql, params = []) {
      let text = replacePlaceholders(sql);
      const isInsert = /^\s*insert\s+/i.test(text);
      const hasReturning = /returning\s+/i.test(text);
      if (isInsert && !hasReturning) {
        text = `${text} RETURNING id`;
      }
      const result = await pool.query(text, params);
      return {
        lastID: result.rows?.[0]?.id,
        changes: result.rowCount,
      };
    },
  };

  await seedOwner(db, "postgres");
  return db;
}

const dbPromise = usePostgres ? initPostgres() : initSqlite();

module.exports = {
  dbPromise,
  usePostgres,
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_NAME,
  DEFAULT_TENANT_CODE,
  DEFAULT_BRANDING,
  normalizeTenantCode,
};
