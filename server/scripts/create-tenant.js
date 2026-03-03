#!/usr/bin/env node
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});

const defaultBaseUrl = `http://localhost:${process.env.PORT || 3001}`;

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

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
  console.log(`Uso:\n  npm --prefix server run tenant:create -- --name "Negocio" --code "negocio" --owner "owner1" --password "ClaveSegura" [--api "https://tu-api.com"]`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === "true") {
    printUsage();
    process.exit(0);
  }

  const name = String(args.name || "").trim();
  const requestedCode = normalizeCode(args.code || name);
  const ownerUsername = String(args.owner || args.ownerUsername || "").trim();
  const ownerPassword = String(args.password || args.ownerPassword || "").trim();
  const ownerRole = "owner";

  const apiBase = normalizeBaseUrl(args.api || process.env.API_BASE || process.env.TEST_API_BASE || defaultBaseUrl);
  const masterKey = String(process.env.MASTER_KEY || "").trim();

  if (!name || !ownerUsername || !ownerPassword) {
    printUsage();
    throw new Error("Faltan datos requeridos: name, owner y password.");
  }

  if (!requestedCode) {
    throw new Error("No se pudo generar/normalizar el code del tenant.");
  }

  if (ownerPassword.length < 6) {
    throw new Error("La contrasena del owner debe tener minimo 6 caracteres.");
  }

  if (!masterKey) {
    throw new Error("MASTER_KEY no configurada en server/.env.");
  }

  const response = await fetch(`${apiBase}/internal/tenants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": masterKey,
    },
    body: JSON.stringify({
      name,
      code: requestedCode,
      ownerUsername,
      ownerPassword,
      ownerRole,
    }),
  });

  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = { raw };
  }

  if (!response.ok) {
    const detail = JSON.stringify(payload || raw);
    throw new Error(`Fallo al crear tenant. status=${response.status} body=${detail}`);
  }

  console.log("Tenant creado/validado correctamente:");
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(`[FAIL] ${error?.message || String(error)}`);
  process.exit(1);
});