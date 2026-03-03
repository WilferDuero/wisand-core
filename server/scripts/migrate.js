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
  DEFAULT_BRANDING,
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
  await db.get(
    "SELECT tenant_id, display_name, logo_url, primary_color, secondary_color, accent_color, updated_at FROM tenant_branding LIMIT 1"
  );

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
  const brandingRow = await db.get(
    "SELECT tenant_id, display_name, logo_url, primary_color, secondary_color, accent_color, updated_at FROM tenant_branding WHERE tenant_id = ?",
    [DEFAULT_TENANT_ID]
  );
  const totalBranding = asCount(await db.get("SELECT COUNT(*) as c FROM tenant_branding"));

  console.log(
    `[migrate] default_tenant_id=${tenant?.id || DEFAULT_TENANT_ID} default_tenant_name=${
      tenant?.name || DEFAULT_TENANT_NAME
    } default_tenant_code=${tenant?.code || DEFAULT_TENANT_CODE}`
  );
  for (const [tableName, count] of Object.entries(tableCounts)) {
    console.log(`[migrate] ${tableName}.tenant_${DEFAULT_TENANT_ID}=${count}`);
  }
  console.log(`[migrate] tenant_branding.total=${totalBranding}`);
  console.log(
    `[migrate] tenant_branding.default_tenant=${
      brandingRow ? "yes" : "no"
    } display_name=${brandingRow?.display_name || DEFAULT_BRANDING.display_name} primary=${
      brandingRow?.primary_color || DEFAULT_BRANDING.primary_color
    } secondary=${brandingRow?.secondary_color || DEFAULT_BRANDING.secondary_color} accent=${
      brandingRow?.accent_color || DEFAULT_BRANDING.accent_color
    }`
  );
  console.log("[migrate] OK");
}

main().catch((error) => {
  console.error("[migrate] FAILED", error?.message || error);
  process.exit(1);
});
