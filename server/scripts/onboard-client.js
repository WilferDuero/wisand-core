#!/usr/bin/env node
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});

const DEFAULT_API_BASE = `http://localhost:${process.env.PORT || 3001}`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || "");
    if (!token.startsWith("--")) continue;

    const [rawKey, inlineValue] = token.slice(2).split("=");
    const key = String(rawKey || "").trim();
    if (!key) continue;

    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }

    const next = argv[i + 1];
    if (next && !String(next).startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

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

function isHexColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || "").trim());
}

function toJsonText(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function printUsage() {
  console.log(`Uso rapido:\n  npm --prefix server run onboard:client -- --name "Negocio" --code "negocio" --owner-user "owner1" --owner-pass "ClaveSegura123" --staff-user "staff1" --staff-pass "ClaveSegura123"\n\nOpciones branding (opcionales):\n  --display-name "Nombre Visible"\n  --logo-url "https://.../logo.png"\n  --primary-color "#0B63D0" --secondary-color "#0F172A" --accent-color "#FF7A18"\n\nOpciones extra:\n  --api "https://tu-api.com"\n  --master-key "tu_master_key"\n  --skip-branding`);
}

async function requestJson(apiBase, endpoint, { method = "GET", token = "", headers = {}, body } = {}) {
  const nextHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    nextHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBase}${endpoint}`, {
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true") {
    printUsage();
    process.exit(0);
  }

  const apiBase = normalizeBaseUrl(args.api || process.env.API_BASE || process.env.TEST_API_BASE || DEFAULT_API_BASE);
  const masterKey = String(args["master-key"] || args.masterKey || process.env.MASTER_KEY || "").trim();

  const tenantName = String(args.name || "").trim();
  const tenantCodeInput = String(args.code || "").trim();
  const tenantCode = normalizeCode(tenantCodeInput || tenantName);

  const ownerUsername = String(args["owner-user"] || args.ownerUser || args.owner || "").trim();
  const ownerPassword = String(args["owner-pass"] || args.ownerPass || args.password || "").trim();

  const staffUsername = String(args["staff-user"] || args.staffUser || "").trim();
  const staffPassword = String(args["staff-pass"] || args.staffPass || "").trim();

  const displayName = String(args["display-name"] || args.displayName || "").trim();
  const logoUrl = String(args["logo-url"] || args.logoUrl || "").trim();
  const primaryColor = String(args["primary-color"] || args.primaryColor || "").trim();
  const secondaryColor = String(args["secondary-color"] || args.secondaryColor || "").trim();
  const accentColor = String(args["accent-color"] || args.accentColor || "").trim();

  const skipBranding = String(args["skip-branding"] || args.skipBranding || "").trim() === "true";

  if (!tenantName || !tenantCode || !ownerUsername || !ownerPassword) {
    printUsage();
    throw new Error("Faltan datos requeridos: name, code, owner-user, owner-pass.");
  }

  if (ownerPassword.length < 6) {
    throw new Error("owner-pass debe tener minimo 6 caracteres.");
  }

  if ((staffUsername && !staffPassword) || (!staffUsername && staffPassword)) {
    throw new Error("Si envias staff-user, tambien debes enviar staff-pass (y viceversa).");
  }

  if (staffPassword && staffPassword.length < 6) {
    throw new Error("staff-pass debe tener minimo 6 caracteres.");
  }

  if (!masterKey) {
    throw new Error("MASTER_KEY no configurada. Define server/.env o usa --master-key.");
  }

  const colorFields = [
    ["primary-color", primaryColor],
    ["secondary-color", secondaryColor],
    ["accent-color", accentColor],
  ];
  for (const [label, value] of colorFields) {
    if (value && !isHexColor(value)) {
      throw new Error(`${label} invalido. Usa formato #RRGGBB.`);
    }
  }

  console.log(`[INFO] API base: ${apiBase}`);
  const health = await requestJson(apiBase, "/health", { method: "GET" });
  if (!health.ok) {
    throw new Error(`API no responde en /health. status=${health.status}`);
  }
  console.log("[PASS] API /health OK.");

  const createTenant = await requestJson(apiBase, "/internal/tenants", {
    method: "POST",
    headers: {
      "X-Master-Key": masterKey,
    },
    body: {
      name: tenantName,
      code: tenantCode,
      ownerUsername,
      ownerPassword,
      ownerRole: "owner",
    },
  });

  let tenantCreated = false;
  let tenantId = 0;
  let resolvedTenantCode = tenantCode;

  if (createTenant.status === 201) {
    tenantCreated = true;
    tenantId = Number(createTenant.json?.tenant?.id || 0);
    resolvedTenantCode = normalizeCode(createTenant.json?.tenant?.code || tenantCode);
    console.log(`[PASS] Tenant creado: ${resolvedTenantCode} (id=${tenantId || "?"}).`);
  } else if (createTenant.status === 409) {
    console.log(`[PASS] Tenant ya existia: ${resolvedTenantCode}.`);
  } else {
    throw new Error(
      `No se pudo crear tenant. status=${createTenant.status} body=${toJsonText(createTenant.json || createTenant.raw)}`
    );
  }

  const ownerLogin = await requestJson(apiBase, "/auth/login", {
    method: "POST",
    body: {
      tenant_code: resolvedTenantCode,
      username: ownerUsername,
      password: ownerPassword,
    },
  });

  if (!ownerLogin.ok || !ownerLogin.json?.token) {
    throw new Error(
      `Login owner fallo. Verifica code/user/pass. status=${ownerLogin.status} body=${toJsonText(ownerLogin.json || ownerLogin.raw)}`
    );
  }
  const ownerToken = String(ownerLogin.json.token);
  const ownerId = Number(ownerLogin.json?.user?.id || 0);
  const ownerRole = String(ownerLogin.json?.user?.role || "");
  console.log(`[PASS] Login owner OK (id=${ownerId || "?"}, role=${ownerRole || "?"}).`);

  let staffStatus = "omitted";
  if (staffUsername) {
    const createStaff = await requestJson(apiBase, "/users", {
      method: "POST",
      token: ownerToken,
      body: {
        username: staffUsername,
        password: staffPassword,
        role: "staff",
      },
    });

    if (createStaff.ok) {
      staffStatus = "created";
      console.log(`[PASS] Staff creado: ${staffUsername}.`);
    } else if (createStaff.status === 409) {
      staffStatus = "existing";
      console.log(`[PASS] Staff ya existia: ${staffUsername}.`);
    } else {
      throw new Error(
        `No se pudo crear staff. status=${createStaff.status} body=${toJsonText(createStaff.json || createStaff.raw)}`
      );
    }
  }

  const brandingPayload = {};
  if (displayName) brandingPayload.display_name = displayName;
  if (logoUrl) brandingPayload.logo_url = logoUrl;
  if (primaryColor) brandingPayload.primary_color = primaryColor;
  if (secondaryColor) brandingPayload.secondary_color = secondaryColor;
  if (accentColor) brandingPayload.accent_color = accentColor;

  let brandingStatus = "skipped";
  if (!skipBranding && Object.keys(brandingPayload).length > 0) {
    const updateBranding = await requestJson(apiBase, "/branding", {
      method: "PUT",
      token: ownerToken,
      body: brandingPayload,
    });

    if (!updateBranding.ok) {
      throw new Error(
        `No se pudo actualizar branding. status=${updateBranding.status} body=${toJsonText(
          updateBranding.json || updateBranding.raw
        )}`
      );
    }
    brandingStatus = "updated";
    console.log("[PASS] Branding actualizado.");
  }

  console.log("\n[OK] Onboarding finalizado");
  console.log(
    JSON.stringify(
      {
        api_base: apiBase,
        tenant: {
          id: tenantId || null,
          name: tenantName,
          code: resolvedTenantCode,
          status: tenantCreated ? "created" : "existing",
        },
        owner: {
          username: ownerUsername,
          role: ownerRole || "owner",
        },
        staff: staffUsername
          ? {
              username: staffUsername,
              status: staffStatus,
            }
          : null,
        branding: {
          status: brandingStatus,
        },
      },
      null,
      2
    )
  );

  console.log("\nChecklist operativo inmediato:");
  console.log(`1) Login owner en app/POS con codigo '${resolvedTenantCode}'.`);
  if (staffUsername) {
    console.log(`2) Login staff (${staffUsername}) para validar permisos.`);
  } else {
    console.log("2) (Opcional) Crear staff si el cliente lo necesita.");
  }
  console.log("3) Cargar catalogo inicial y registrar primera venta de prueba.");
  console.log("4) Ejecutar backup: npm --prefix server run backup:db");
}

main().catch((error) => {
  console.error(`[FAIL] ${error?.message || String(error)}`);
  process.exit(1);
});
