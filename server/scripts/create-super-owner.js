#!/usr/bin/env node
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});

const bcrypt = require("bcryptjs");
const { dbPromise, normalizeTenantCode } = require("../db");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;

    const [rawKey, inlineValue] = token.slice(2).split("=");
    const key = String(rawKey || "").trim();
    if (!key) continue;

    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

function printUsage() {
  console.log(
    "Uso:\n  npm --prefix server run owner:create -- --username \"tu_usuario\" --password \"TuClaveSegura\" [--name \"WISAND Owner\"] [--code \"wisand\"]"
  );
}

function toInt(value, fallback = 0) {
  const n = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

async function resolveTenant(db, tenantName, tenantCode) {
  const existing = await db.get("SELECT id, name, code FROM tenants WHERE code = ?", [tenantCode]);
  if (existing?.id) {
    return {
      tenantId: toInt(existing.id, 0),
      created: false,
      name: String(existing.name || tenantName),
      code: normalizeTenantCode(existing.code) || tenantCode,
    };
  }

  await db.run("INSERT INTO tenants (name, code) VALUES (?, ?)", [tenantName, tenantCode]);
  const createdTenant = await db.get("SELECT id, name, code FROM tenants WHERE code = ?", [tenantCode]);
  if (!createdTenant?.id) {
    throw new Error("No se pudo crear el tenant interno WISAND.");
  }

  return {
    tenantId: toInt(createdTenant.id, 0),
    created: true,
    name: String(createdTenant.name || tenantName),
    code: normalizeTenantCode(createdTenant.code) || tenantCode,
  };
}

async function upsertOwnerUser(db, tenantId, username, password, role) {
  const existing = await db.get("SELECT id, tenant_id, username, role FROM users WHERE username = ?", [
    username,
  ]);

  const passwordHash = await bcrypt.hash(password, 10);

  if (existing?.id) {
    const existingTenantId = toInt(existing.tenant_id, 0);
    if (existingTenantId !== tenantId) {
      throw new Error(
        `El username '${username}' ya existe en otro tenant (tenant_id=${existingTenantId}). Usa otro username.`
      );
    }

    await db.run("UPDATE users SET passwordHash = ?, role = ? WHERE id = ? AND tenant_id = ?", [
      passwordHash,
      role,
      existing.id,
      tenantId,
    ]);

    return {
      mode: "updated",
      userId: toInt(existing.id, 0),
      username: String(existing.username || username),
      role,
    };
  }

  await db.run("INSERT INTO users (tenant_id, username, passwordHash, role) VALUES (?,?,?,?)", [
    tenantId,
    username,
    passwordHash,
    role,
  ]);

  const created = await db.get("SELECT id, username, role FROM users WHERE tenant_id = ? AND username = ?", [
    tenantId,
    username,
  ]);

  if (!created?.id) {
    throw new Error("No se pudo crear el usuario owner interno.");
  }

  return {
    mode: "created",
    userId: toInt(created.id, 0),
    username: String(created.username || username),
    role: String(created.role || role),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true") {
    printUsage();
    process.exit(0);
  }

  const tenantName = String(args.name || process.env.WISAND_OWNER_TENANT_NAME || "WISAND Owner").trim();
  const tenantCode = normalizeTenantCode(
    String(args.code || process.env.WISAND_OWNER_TENANT_CODE || "wisand").trim()
  );
  const username = String(args.username || args.owner || process.env.WISAND_OWNER_USER || "wisand_owner")
    .trim();
  const password = String(args.password || process.env.WISAND_OWNER_PASS || "").trim();
  const role = "owner";

  if (!tenantName || !tenantCode || !username || !password) {
    printUsage();
    throw new Error("Faltan datos requeridos: username y password (name/code opcionales).");
  }

  if (password.length < 6) {
    throw new Error("La contrasena debe tener minimo 6 caracteres.");
  }

  const db = await dbPromise;
  const tenant = await resolveTenant(db, tenantName, tenantCode);
  const owner = await upsertOwnerUser(db, tenant.tenantId, username, password, role);

  console.log("Acceso owner WISAND listo:");
  console.log(
    JSON.stringify(
      {
        tenant: {
          id: tenant.tenantId,
          name: tenant.name,
          code: tenant.code,
          mode: tenant.created ? "created" : "existing",
        },
        owner,
        login: {
          tenant_code: tenant.code,
          username: owner.username,
        },
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`[FAIL] ${error?.message || String(error)}`);
  process.exit(1);
});
