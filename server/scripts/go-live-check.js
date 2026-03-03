#!/usr/bin/env node
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});

const { dbPromise, usePostgres } = require("../db");

const FAIL = "[FAIL]";
const WARN = "[WARN]";
const PASS = "[PASS]";
const INFO = "[INFO]";

const failures = [];
const warnings = [];
const passes = [];

const toInt = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const hasMinLength = (value, min) => String(value || "").trim().length >= min;

const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const safePrint = (prefix, msg) => {
  console.log(`${prefix} ${msg}`);
};

async function tableExists(db, table) {
  if (usePostgres) {
    const row = await db.get(
      `
      SELECT 1 AS ok
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ?
      LIMIT 1
      `,
      [table]
    );
    return !!row?.ok;
  }

  const row = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [
    table,
  ]);
  return !!row?.name;
}

async function columnExists(db, table, column) {
  if (usePostgres) {
    const row = await db.get(
      `
      SELECT 1 AS ok
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
      LIMIT 1
      `,
      [table, column]
    );
    return !!row?.ok;
  }

  const rows = await db.all(`PRAGMA table_info(${table})`);
  return (rows || []).some((r) => String(r?.name || "") === column);
}

function registerResult(ok, okMsg, failMsg) {
  if (ok) {
    passes.push(okMsg);
  } else {
    failures.push(failMsg);
  }
}

function registerWarning(condition, warningMsg, passMsg) {
  if (condition) {
    warnings.push(warningMsg);
  } else {
    passes.push(passMsg);
  }
}

async function main() {
  safePrint(INFO, `Engine detectado: ${usePostgres ? "postgres" : "sqlite"}`);

  const jwtSecret = String(process.env.JWT_SECRET || "").trim();
  const masterKey = String(process.env.MASTER_KEY || "").trim();
  const nodeEnv = String(process.env.NODE_ENV || "").trim() || "development";
  const dbUrl = String(process.env.DATABASE_URL || "").trim();

  registerResult(!!jwtSecret, "JWT_SECRET configurado", "JWT_SECRET no esta configurado.");
  registerWarning(
    !!jwtSecret && jwtSecret.length < 32,
    "JWT_SECRET es corto (recomendado >= 32 caracteres).",
    "JWT_SECRET con longitud recomendada."
  );

  registerResult(!!masterKey, "MASTER_KEY configurada", "MASTER_KEY no esta configurada.");
  registerWarning(
    !!masterKey && masterKey.length < 24,
    "MASTER_KEY es corta (recomendado >= 24 caracteres).",
    "MASTER_KEY con longitud recomendada."
  );

  registerWarning(
    nodeEnv !== "production",
    `NODE_ENV=${nodeEnv}. Para go-live usa NODE_ENV=production.`,
    "NODE_ENV=production."
  );

  if (usePostgres) {
    registerResult(!!dbUrl, "DATABASE_URL configurada", "DATABASE_URL vacia para modo postgres.");
  } else {
    passes.push("Modo sqlite activo (DATABASE_URL no definida).");
  }

  const db = await dbPromise;

  const requiredTables = [
    "tenants",
    "tenant_branding",
    "users",
    "products",
    "orders",
    "reviews",
    "sales",
    "push_tokens",
  ];

  for (const table of requiredTables) {
    const ok = await tableExists(db, table);
    registerResult(ok, `Tabla '${table}' OK`, `Falta tabla requerida '${table}'.`);
  }

  const tenantScopedTables = ["users", "products", "orders", "reviews", "sales", "push_tokens"];
  for (const table of tenantScopedTables) {
    const ok = await columnExists(db, table, "tenant_id");
    registerResult(ok, `Columna ${table}.tenant_id OK`, `Falta columna ${table}.tenant_id.`);
  }

  const salesOrderId = await columnExists(db, "sales", "order_id");
  registerResult(salesOrderId, "Columna sales.order_id OK", "Falta columna sales.order_id.");

  const pushUserId = await columnExists(db, "push_tokens", "userId");
  registerWarning(
    !pushUserId,
    "push_tokens.userId no existe (recomendado para trazabilidad).",
    "Columna push_tokens.userId OK."
  );

  const defaultTenant = await db.get("SELECT id, name, code FROM tenants WHERE id = 1", []);
  registerResult(!!defaultTenant?.id, "Tenant default id=1 existe", "No existe tenant default id=1.");
  if (defaultTenant?.id) {
    const code = normalizeCode(defaultTenant.code);
    registerWarning(code !== "default", "Tenant default no tiene code='default'.", "Tenant default code=default.");
  }

  const duplicateSales = await db.get(
    `
    SELECT tenant_id, order_id, COUNT(*) AS c
    FROM sales
    WHERE order_id IS NOT NULL
    GROUP BY tenant_id, order_id
    HAVING COUNT(*) > 1
    LIMIT 1
    `,
    []
  );
  registerResult(
    !duplicateSales,
    "No hay ventas duplicadas por (tenant_id, order_id)",
    `Hay ventas duplicadas por (tenant_id, order_id): tenant_id=${duplicateSales?.tenant_id}, order_id=${duplicateSales?.order_id}.`
  );

  const tenantsCountRow = await db.get("SELECT COUNT(*) AS c FROM tenants", []);
  const tenantsCount = toInt(tenantsCountRow?.c, 0);
  if (tenantsCount > 0) {
    passes.push(`Tenants registrados: ${tenantsCount}.`);
  } else {
    failures.push("No hay tenants registrados.");
  }

  for (const msg of passes) safePrint(PASS, msg);
  for (const msg of warnings) safePrint(WARN, msg);
  for (const msg of failures) safePrint(FAIL, msg);

  safePrint(INFO, `Resumen -> PASS:${passes.length} WARN:${warnings.length} FAIL:${failures.length}`);

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  safePrint(FAIL, error?.message || String(error));
  process.exit(1);
});