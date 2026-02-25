#!/usr/bin/env node
const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});

const DEFAULT_BASE_URL = `http://localhost:${process.env.PORT || 3001}`;
const API_BASE_URL = String(process.env.TEST_API_BASE || process.env.API_BASE || DEFAULT_BASE_URL)
  .trim()
  .replace(/\/+$/, "");
const MASTER_KEY = String(process.env.MASTER_KEY || "").trim();

const TENANT2_NAME = String(process.env.TEST_TENANT2_NAME || "Negocio Dos").trim();
const TENANT2_CODE = String(process.env.TEST_TENANT2_CODE || "negocio-dos").trim().toLowerCase();
const TENANT2_OWNER = String(process.env.TEST_TENANT2_OWNER || "owner2").trim();
const TENANT2_PASSWORD = String(process.env.TEST_TENANT2_PASSWORD || "123456").trim();
const TENANT2_ID_ENV = Number.parseInt(String(process.env.TEST_TENANT2_ID || "2"), 10);
const TENANT2_ID_FALLBACK = Number.isFinite(TENANT2_ID_ENV) && TENANT2_ID_ENV > 0 ? TENANT2_ID_ENV : 2;

const TENANT1_USERNAME = String(process.env.TEST_TENANT1_USERNAME || "").trim();
const TENANT1_PASSWORD = String(process.env.TEST_TENANT1_PASSWORD || "").trim();
const TENANT1_ID_ENV = Number.parseInt(String(process.env.TEST_TENANT1_ID || "1"), 10);
const TENANT1_ID = Number.isFinite(TENANT1_ID_ENV) && TENANT1_ID_ENV > 0 ? TENANT1_ID_ENV : 1;
const TENANT1_CODE = String(process.env.TEST_TENANT1_CODE || "").trim().toLowerCase();

const PASS_PREFIX = "[PASS]";
const FAIL_PREFIX = "[FAIL]";
const INFO_PREFIX = "[INFO]";

const fail = (message) => {
  console.error(`${FAIL_PREFIX} ${message}`);
};

const pass = (message) => {
  console.log(`${PASS_PREFIX} ${message}`);
};

const info = (message) => {
  console.log(`${INFO_PREFIX} ${message}`);
};

async function requestJson(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json, raw: text };
}

async function login({ username, password, tenantId, tenantCode }) {
  const payload = {
    username,
    password,
  };
  if (tenantCode) {
    payload.tenant_code = tenantCode;
  } else {
    payload.tenant_id = tenantId;
  }
  return requestJson("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function extractProducts(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function main() {
  info(`API base: ${API_BASE_URL}`);

  if (!MASTER_KEY) {
    fail("MASTER_KEY no esta configurada. Define MASTER_KEY en server/.env.");
    process.exit(1);
  }

  let tenant2Id = TENANT2_ID_FALLBACK;

  info(`Creando tenant "${TENANT2_NAME}" (si no existe)...`);
  const createTenantRes = await requestJson("/internal/tenants", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": MASTER_KEY,
    },
    body: JSON.stringify({
      name: TENANT2_NAME,
      code: TENANT2_CODE,
      ownerUsername: TENANT2_OWNER,
      ownerPassword: TENANT2_PASSWORD,
      ownerRole: "owner",
    }),
  });

  if (createTenantRes.status === 201) {
    const createdTenantId = Number(createTenantRes.json?.tenant?.id) || tenant2Id;
    tenant2Id = createdTenantId;
    pass(
      `Tenant creado id=${tenant2Id} code=${createTenantRes.json?.tenant?.code || TENANT2_CODE} owner=${TENANT2_OWNER}`
    );
  } else if (createTenantRes.status === 409) {
    pass(`Tenant ya existia: ${TENANT2_NAME}`);
  } else {
    fail(
      `No se pudo crear/validar tenant. status=${createTenantRes.status} body=${JSON.stringify(
        createTenantRes.json || createTenantRes.raw
      )}`
    );
    process.exit(1);
  }

  info(`Login tenant2 username=${TENANT2_OWNER} tenant_code=${TENANT2_CODE}...`);
  const loginTenant2Res = await login({
    username: TENANT2_OWNER,
    password: TENANT2_PASSWORD,
    tenantId: tenant2Id,
    tenantCode: TENANT2_CODE,
  });

  if (!loginTenant2Res.ok || !loginTenant2Res.json?.token) {
    fail(
      `Login tenant2 fallo con tenant_code=${TENANT2_CODE}. status=${loginTenant2Res.status}`
    );
    process.exit(1);
  }

  const tenant2Token = String(loginTenant2Res.json.token);
  const tenant2User = loginTenant2Res.json.user || {};
  pass(
    `Login tenant2 OK user=${tenant2User.username || TENANT2_OWNER} tenant_id=${
      tenant2User.tenant_id || tenant2Id
    } tenant_code=${tenant2User.tenant_code || TENANT2_CODE}`
  );

  const externalId = `mt-test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const productPayload = {
    externalId,
    nombre: "Producto MT Test",
    descripcion: "Validacion automatica multi-tenant",
    categoria: "Test",
    disponibilidad: "Disponible",
    imagen: "",
    precioCaja: 10000,
    precioSobre: 1000,
    precioUnidad: 100,
    sobresXCaja: 10,
    unidadesXSobre: 10,
    stockCajas: 7,
    ofertaActiva: false,
    ofertaTexto: "",
    ofertaPrecioCaja: 0,
    ofertaPrecioSobre: 0,
  };

  info(`Creando producto tenant2 externalId=${externalId}...`);
  const createProductRes = await requestJson("/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tenant2Token}`,
    },
    body: JSON.stringify(productPayload),
  });

  if (!createProductRes.ok) {
    fail(
      `No se pudo crear producto en tenant2. status=${createProductRes.status} body=${JSON.stringify(
        createProductRes.json || createProductRes.raw
      )}`
    );
    process.exit(1);
  }
  pass(`Producto creado en tenant2 id=${createProductRes.json?.id || "n/a"}`);

  info("Verificando visibilidad en tenant2...");
  const tenant2ProductsRes = await requestJson("/products?page=1&limit=200", {
    method: "GET",
    headers: { Authorization: `Bearer ${tenant2Token}` },
  });
  if (!tenant2ProductsRes.ok) {
    fail(`No se pudo listar productos tenant2. status=${tenant2ProductsRes.status}`);
    process.exit(1);
  }
  const tenant2Products = extractProducts(tenant2ProductsRes.json);
  const tenant2CanSee = tenant2Products.some(
    (product) => String(product?.externalId || product?.externalid || "") === externalId
  );
  if (!tenant2CanSee) {
    fail("Tenant2 no ve el producto recien creado.");
    process.exit(1);
  }
  pass("Tenant2 SI ve su producto.");

  if (TENANT1_USERNAME && TENANT1_PASSWORD) {
    info(
      TENANT1_CODE
        ? `Login tenant1 username=${TENANT1_USERNAME} tenant_code=${TENANT1_CODE}...`
        : `Login tenant1 username=${TENANT1_USERNAME} tenant_id=${TENANT1_ID}...`
    );
    const loginTenant1Res = await login({
      username: TENANT1_USERNAME,
      password: TENANT1_PASSWORD,
      tenantId: TENANT1_ID,
      tenantCode: TENANT1_CODE || undefined,
    });
    if (!loginTenant1Res.ok || !loginTenant1Res.json?.token) {
      fail(
        `No se pudo login tenant1 para validar aislamiento. status=${loginTenant1Res.status} body=${JSON.stringify(
          loginTenant1Res.json || loginTenant1Res.raw
        )}`
      );
      process.exit(1);
    }
    const tenant1Token = String(loginTenant1Res.json.token);
    const tenant1ProductsRes = await requestJson("/products?page=1&limit=200", {
      method: "GET",
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    if (!tenant1ProductsRes.ok) {
      fail(`No se pudo listar productos tenant1. status=${tenant1ProductsRes.status}`);
      process.exit(1);
    }
    const tenant1Products = extractProducts(tenant1ProductsRes.json);
    const tenant1CanSee = tenant1Products.some(
      (product) => String(product?.externalId || product?.externalid || "") === externalId
    );
    if (tenant1CanSee) {
      fail("Tenant1 SI ve producto de tenant2 (aislamiento roto).");
      process.exit(1);
    }
    pass("Tenant1 NO ve producto de tenant2.");
  } else {
    info(
      "Validacion tenant1 omitida. Define TEST_TENANT1_USERNAME y TEST_TENANT1_PASSWORD para verificar aislamiento cruzado."
    );
  }

  pass("test-multitenant finalizo correctamente.");
}

main().catch((error) => {
  fail(error?.message || String(error));
  process.exit(1);
});
