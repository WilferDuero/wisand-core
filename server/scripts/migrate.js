#!/usr/bin/env node
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});

const {
  dbPromise,
  usePostgres,
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_NAME,
  DEFAULT_TENANT_CODE,
} = require("../db");

const asCount = (row) => Number(row?.c ?? row?.count ?? 0);

async function main() {
  const engine = usePostgres ? "postgres" : "sqlite";
  console.log("[migrate] start");
  console.log(`[migrate] engine=${engine}`);
  if (engine === "postgres") {
    console.log("[migrate] using DATABASE_URL (postgres)");
  } else {
    console.log("[migrate] using SQLite local file");
  }
  const db = await dbPromise;

  for (const tableName of ["users", "products", "orders", "reviews", "sales", "push_tokens"]) {
    await db.get(`SELECT tenant_id FROM ${tableName} LIMIT 1`);
  }
  await db.get("SELECT order_id FROM sales LIMIT 1");
  await db.get("SELECT code FROM tenants LIMIT 1");

  const tenant = await db.get("SELECT id, name, code, created_at FROM tenants WHERE id = ?", [
    DEFAULT_TENANT_ID,
  ]);

  const tableCounts = {};
  for (const tableName of ["users", "products", "orders", "reviews", "sales", "push_tokens"]) {
    const row = await db.get(`SELECT COUNT(*) as c FROM ${tableName} WHERE tenant_id = ?`, [
      DEFAULT_TENANT_ID,
    ]);
    tableCounts[tableName] = asCount(row);
  }

  console.log(
    `[migrate] default_tenant_id=${tenant?.id || DEFAULT_TENANT_ID} default_tenant_name=${
      tenant?.name || DEFAULT_TENANT_NAME
    } default_tenant_code=${tenant?.code || DEFAULT_TENANT_CODE}`
  );
  for (const [tableName, count] of Object.entries(tableCounts)) {
    console.log(`[migrate] ${tableName}.tenant_${DEFAULT_TENANT_ID}=${count}`);
  }
  console.log("[migrate] OK");
}

main().catch((error) => {
  console.error("[migrate] FAILED", error?.message || error);
  process.exit(1);
});
