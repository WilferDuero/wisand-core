const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
  override: true,
});

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const https = require("https");
const crypto = require("crypto");
const {
  dbPromise,
  DEFAULT_TENANT_ID,
  DEFAULT_BRANDING,
  normalizeTenantCode,
} = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change";
const TOKEN_TTL = process.env.JWT_TTL || "8h";
const PUSH_LOW_STOCK_THRESHOLD = Math.max(
  1,
  Number.parseInt(process.env.PUSH_LOW_STOCK_THRESHOLD || "3", 10) || 3
);
const PUSH_NOTIFY_ROLES = (() => {
  const allowed = new Set(["owner", "staff"]);
  const configured = String(process.env.PUSH_NOTIFY_ROLES || "owner")
    .split(",")
    .map((v) => String(v || "").trim().toLowerCase())
    .filter((v) => allowed.has(v));
  return configured.length ? configured : ["owner"];
})();

const DEFAULT_CORS_ORIGINS = [
  "https://wisand.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3030",
  "http://127.0.0.1:3030",
  "null",
];

const configuredOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

const allowedOrigins = new Set(
  (configuredOrigins.length ? configuredOrigins : DEFAULT_CORS_ORIGINS).map((o) =>
    String(o).toLowerCase()
  )
);

const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (allowedOrigins.has(String(origin).toLowerCase())) return callback(null, true);
  return callback(null, false);
};

if (process.env.NODE_ENV === "production" && JWT_SECRET === "dev-secret-change") {
  console.error("JWT_SECRET no configurado. Configuralo en variables de entorno.");
  process.exit(1);
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.use(
  cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Tenant-Id",
      "X-Tenant-Code",
      "X-Master-Key",
    ],
    optionsSuccessStatus: 204,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(async (req, _res, next) => {
  const requestedCode = pickTenantCode(req);
  if (!requestedCode) {
    return next();
  }
  try {
    const db = await dbPromise;
    const tenant = await db.get("SELECT id FROM tenants WHERE code = ?", [requestedCode]);
    if (tenant?.id) {
      req.resolvedTenantId = toTenantId(tenant.id, 0);
    }
  } catch (error) {
    console.warn("[tenant] resolve code failed", error?.message || error);
  }
  return next();
});

const toNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const formatMoneyCop = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(toNumber(value, 0));

const toInt = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

const toBoolInt = (v) =>
  v === true || v === "true" || v === 1 || v === "1" ? 1 : 0;

const safeJson = (val, fallback = []) => {
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val || "[]");
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};


const CLOSURE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CLOSURE_TIME_RE = /^\d{2}:\d{2}$/;
const CLOSURE_METHOD_KEYS = ["efectivo", "transferencia", "tarjeta", "mixto", "otros"];

const normalizeClosureDateKey = (value) => {
  const raw = String(value || "").trim();
  return CLOSURE_DATE_RE.test(raw) ? raw : "";
};

const normalizeClosureTime = (value, fallback = "00:00") => {
  const raw = String(value || "").trim();
  if (!CLOSURE_TIME_RE.test(raw)) return fallback;
  const [hour, minute] = raw.split(":").map((part) => Number(part));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const normalizeClosureNotes = (value) => String(value || "").trim().slice(0, 400);

const normalizeClosureMethods = (value) => {
  const raw = typeof value === "object" && value ? value : {};
  const normalized = {};
  for (const key of CLOSURE_METHOD_KEYS) {
    normalized[key] = Math.max(0, toNumber(raw[key], 0));
  }
  return normalized;
};

const parseClosureMethods = (value) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return normalizeClosureMethods(value);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return normalizeClosureMethods(parsed);
    } catch {
      return normalizeClosureMethods({});
    }
  }
  return normalizeClosureMethods({});
};

const mapCashClosureRow = (row) => {
  if (!row) return null;
  const methods = parseClosureMethods(pick(row, "methods_json", "methodsJson"));
  return {
    id: toInt(row.id, 0),
    tenant_id: toTenantId(pick(row, "tenant_id", "tenantId"), DEFAULT_TENANT_ID),
    date_key: normalizeClosureDateKey(pick(row, "date_key", "dateKey")),
    start_time: normalizeClosureTime(pick(row, "start_time", "startTime"), "00:00"),
    end_time: normalizeClosureTime(pick(row, "end_time", "endTime"), "23:59"),
    opening_cash: Math.max(0, toNumber(pick(row, "opening_cash", "openingCash"), 0)),
    counted_cash: Math.max(0, toNumber(pick(row, "counted_cash", "countedCash"), 0)),
    expected_cash: Math.max(0, toNumber(pick(row, "expected_cash", "expectedCash"), 0)),
    cash_diff: toNumber(pick(row, "cash_diff", "cashDiff"), 0),
    total_sales: Math.max(0, toNumber(pick(row, "total_sales", "totalSales"), 0)),
    sales_count: Math.max(0, toInt(pick(row, "sales_count", "salesCount"), 0)),
    items_count: Math.max(0, toInt(pick(row, "items_count", "itemsCount"), 0)),
    methods,
    notes: normalizeClosureNotes(pick(row, "notes")),
    created_by_user_id: toInt(pick(row, "created_by_user_id", "createdByUserId"), 0),
    created_by_username: String(
      pick(row, "created_by_username", "createdByUsername") || ""
    ).trim(),
    created_at: pick(row, "created_at", "createdAt") || null,
  };
};

const toTenantId = (value, fallback = 0) => {
  const n = toInt(value, fallback);
  return n > 0 ? n : fallback;
};

const pickTenantId = (req) => {
  const resolvedTenant = toTenantId(req.resolvedTenantId, 0);
  const headerTenant = toTenantId(req.headers?.["x-tenant-id"], 0);
  const queryTenant = toTenantId(
    pick(req.query, "tenant_id", "tenantId", "tenant"),
    0
  );
  const bodyTenant = toTenantId(
    pick(req.body, "tenant_id", "tenantId", "tenant"),
    0
  );
  return resolvedTenant || headerTenant || queryTenant || bodyTenant || DEFAULT_TENANT_ID;
};

const pickRawTenantCode = (req) => {
  const headerCode = String(req.headers?.["x-tenant-code"] || "").trim();
  const queryCode = String(
    pick(req.query, "tenant_code", "tenantCode", "companyCode", "businessCode") || ""
  ).trim();
  const bodyCode = String(
    pick(req.body, "tenant_code", "tenantCode", "code", "companyCode", "businessCode") || ""
  ).trim();
  return headerCode || queryCode || bodyCode || "";
};

const pickTenantCode = (req) => normalizeTenantCode(pickRawTenantCode(req));

async function resolveLoginTenant(db, req) {
  const rawCode = pickRawTenantCode(req);
  const requestedCode = pickTenantCode(req);
  if (rawCode && !requestedCode) {
    return {
      tenantId: 0,
      tenantCode: "",
    };
  }
  if (requestedCode) {
    const tenantByCode = await db.get("SELECT id, code FROM tenants WHERE code = ?", [
      requestedCode,
    ]);
    if (!tenantByCode?.id) {
      return {
        tenantId: 0,
        tenantCode: requestedCode,
      };
    }
    return {
      tenantId: toTenantId(tenantByCode.id, 0),
      tenantCode: normalizeTenantCode(tenantByCode.code) || requestedCode,
    };
  }

  const tenantId = pickTenantId(req);
  const tenantById = await db.get("SELECT id, code FROM tenants WHERE id = ?", [tenantId]);
  return {
    tenantId,
    tenantCode: normalizeTenantCode(tenantById?.code) || "",
  };
}

async function nextTenantCode(db, seed) {
  const baseCode = normalizeTenantCode(seed) || "tenant";
  let candidate = baseCode;
  let suffix = 2;
  while (true) {
    const existing = await db.get("SELECT id FROM tenants WHERE code = ?", [candidate]);
    if (!existing?.id) return candidate;
    candidate = `${baseCode}-${suffix}`;
    suffix += 1;
  }
}

const getRequestTenantId = (req) => {
  const userTenant = toTenantId(pick(req.user, "tenant_id", "tenantId"), 0);
  if (userTenant > 0) return userTenant;
  return pickTenantId(req);
};

const pick = (obj, ...keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
};

const BRAND_HEX_COLOR_RE = /^#([0-9a-f]{6})$/i;
const BRAND_DISPLAY_NAME_MAX = 80;
const BRAND_LOGO_URL_MAX = 512;

const normalizeBrandingDisplayName = (value, fallback = DEFAULT_BRANDING.display_name) => {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, BRAND_DISPLAY_NAME_MAX);
  if (normalized) return normalized;
  const safeFallback = String(fallback || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, BRAND_DISPLAY_NAME_MAX);
  return safeFallback || DEFAULT_BRANDING.display_name;
};

const normalizeBrandingColor = (value, fallback) => {
  const raw = String(value || "").trim();
  if (!raw) return String(fallback || "").toLowerCase();
  if (!BRAND_HEX_COLOR_RE.test(raw)) return null;
  return raw.toLowerCase();
};

const normalizeBrandingLogoUrl = (value, options = {}) => {
  const allowEmpty = options.allowEmpty !== false;
  const fallback = options.fallback ?? DEFAULT_BRANDING.logo_url;
  const raw = String(value ?? "").trim();
  if (!raw) {
    return allowEmpty ? "" : String(fallback || "");
  }
  if (raw.length > BRAND_LOGO_URL_MAX) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const buildDefaultBranding = (tenantCode = "", tenantName = "") => ({
  tenant_code: normalizeTenantCode(tenantCode) || "default",
  display_name: normalizeBrandingDisplayName("", DEFAULT_BRANDING.display_name),
  logo_url: DEFAULT_BRANDING.logo_url,
  primary_color: DEFAULT_BRANDING.primary_color,
  secondary_color: DEFAULT_BRANDING.secondary_color,
  accent_color: DEFAULT_BRANDING.accent_color,
  updated_at: null,
});

const mapBrandingRow = (row, tenantCode = "", tenantName = "") => {
  const fallback = buildDefaultBranding(tenantCode, tenantName);
  return {
    tenant_code: fallback.tenant_code,
    display_name: normalizeBrandingDisplayName(
      pick(row, "display_name", "displayName"),
      fallback.display_name
    ),
    logo_url:
      normalizeBrandingLogoUrl(pick(row, "logo_url", "logoUrl"), {
        allowEmpty: true,
        fallback: fallback.logo_url,
      }) ?? fallback.logo_url,
    primary_color:
      normalizeBrandingColor(pick(row, "primary_color", "primaryColor"), fallback.primary_color) ||
      fallback.primary_color,
    secondary_color:
      normalizeBrandingColor(
        pick(row, "secondary_color", "secondaryColor"),
        fallback.secondary_color
      ) || fallback.secondary_color,
    accent_color:
      normalizeBrandingColor(pick(row, "accent_color", "accentColor"), fallback.accent_color) ||
      fallback.accent_color,
    updated_at: pick(row, "updated_at", "updatedAt") || fallback.updated_at,
  };
};

function normalizeProductRow(r) {
  const externalId = pick(r, "externalId", "externalid");
  return {
    id: externalId || r.id,
    externalId: externalId || null,
    nombre: pick(r, "nombre") || "",
    descripcion: pick(r, "descripcion") || "",
    categoria: pick(r, "categoria") || "",
    disponibilidad: pick(r, "disponibilidad") || "Disponible",
    imagen: pick(r, "imagen") || "",
    precioCaja: toNumber(pick(r, "precioCaja", "preciocaja")),
    precioSobre: toNumber(pick(r, "precioSobre", "preciosobre")),
    precioUnidad: toNumber(pick(r, "precioUnidad", "preciounidad")),
    sobresXCaja: toInt(pick(r, "sobresXCaja", "sobresxcaja")),
    unidadesXSobre: toInt(pick(r, "unidadesXSobre", "unidadesxsobre")),
    stockCajas: toInt(pick(r, "stockCajas", "stockcajas")),
    ofertaActiva: !!pick(r, "ofertaActiva", "ofertaactiva"),
    ofertaTexto: pick(r, "ofertaTexto", "ofertatexto") || "",
    ofertaPrecioCaja: toNumber(pick(r, "ofertaPrecioCaja", "ofertapreciocaja")),
    ofertaPrecioSobre: toNumber(pick(r, "ofertaPrecioSobre", "ofertapreciosobre")),
    createdAt: pick(r, "createdAt", "createdat"),
    updatedAt: pick(r, "updatedAt", "updatedat"),
  };
}

const signToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      tenant_id: toTenantId(pick(user, "tenant_id", "tenantId"), DEFAULT_TENANT_ID),
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: TOKEN_TTL,
    }
  );

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map();

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "unknown";
}

function isLoginBlocked(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  const age = Date.now() - entry.firstAt;
  if (age > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) {
    loginAttempts.set(ip, { count: 1, firstAt: Date.now() });
    return;
  }
  const age = Date.now() - entry.firstAt;
  if (age > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
  loginAttempts.set(ip, entry);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function authRequired(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const pushTag =
    req.path === "/notifications/register"
      ? "push-register"
      : req.path === "/notifications/unregister"
      ? "push-unregister"
      : null;
  if (!token) {
    if (pushTag) {
      console.warn(`[${pushTag}] unauthorized reason=missing-bearer`);
    }
    return res.status(401).json({ error: "No autorizado" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) || {};
    req.user = {
      id: toInt(decoded.id, 0),
      tenant_id: toTenantId(decoded.tenant_id ?? decoded.tenantId, DEFAULT_TENANT_ID),
      role: String(decoded.role || "staff"),
      username: String(decoded.username || ""),
    };
    if (!req.user.id || !req.user.tenant_id) {
      return res.status(401).json({ error: "Token invalido" });
    }
    return next();
  } catch (e) {
    if (pushTag) {
      console.warn(`[${pushTag}] unauthorized reason=invalid-jwt`);
    }
    return res.status(401).json({ error: "Token invalido" });
  }
}

function authOptional(req, _res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) || {};
    req.user = {
      id: toInt(decoded.id, 0),
      tenant_id: toTenantId(decoded.tenant_id ?? decoded.tenantId, DEFAULT_TENANT_ID),
      role: String(decoded.role || "staff"),
      username: String(decoded.username || ""),
    };
  } catch (_e) {}
  return next();
}

function ownerOnly(req, res, next) {
  if (!req.user || req.user.role !== "owner") {
    return res.status(403).json({ error: "No autorizado" });
  }
  return next();
}

const timingSafeEqual = (left, right) => {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

function masterKeyRequired(req, res, next) {
  const configuredMasterKey = String(process.env.MASTER_KEY || "").trim();
  if (!configuredMasterKey) {
    return res.status(500).json({ error: "MASTER_KEY no configurada en el servidor" });
  }

  const headerMasterKey = String(req.get("x-master-key") || "").trim();
  const authorizationHeader = String(
    req.get("authorization") || req.headers.authorization || ""
  ).trim();
  const bearerMasterKey = /^Bearer\s+/i.test(authorizationHeader)
    ? authorizationHeader.replace(/^Bearer\s+/i, "").trim()
    : "";

  const provided = headerMasterKey || bearerMasterKey;
  if (!provided || !timingSafeEqual(provided, configuredMasterKey)) {
    return res.status(401).json({ error: "No autorizado" });
  }
  return next();
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_REQUEST_TIMEOUT_MS = 15000;

const isExpoPushToken = (token) =>
  /^ExponentPushToken\[[^\]]+\]$/.test(token) || /^ExpoPushToken\[[^\]]+\]$/.test(token);

const maskPushToken = (token) => {
  const value = String(token || "").trim();
  if (!value) return "";
  if (value.length <= 24) return value;
  return `${value.slice(0, 18)}...${value.slice(-6)}`;
};

const chunkArray = (items, chunkSize) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const runNonBlocking = (label, taskFn) => {
  Promise.resolve()
    .then(taskFn)
    .catch((error) => {
      console.error(`[push:${label}]`, error?.message || error);
    });
};

const sanitizePushRoleList = (roles) => {
  const safeRoles = Array.isArray(roles) ? roles : PUSH_NOTIFY_ROLES;
  return safeRoles
    .map((role) => String(role || "").trim().toLowerCase())
    .filter((role) => role === "owner" || role === "staff");
};

async function listPushTokensByRoles(db, roles, tenantId) {
  const roleList = sanitizePushRoleList(roles);
  if (!roleList.length) return [];
  const placeholders = roleList.map(() => "?").join(",");
  const params = [tenantId, ...roleList];
  const rows = await db.all(
    `SELECT token, platform FROM push_tokens WHERE tenant_id = ? AND active = 1 AND role IN (${placeholders})`,
    params
  );
  return rows
    .map((row) => ({
      token: String(row?.token || "").trim(),
      platform: String(row?.platform || "").trim().toLowerCase(),
    }))
    .filter((entry) => entry.token.length > 0);
}

async function disablePushTokens(db, tokens, tenantId) {
  if (!tokens.length) return;
  const placeholders = tokens.map(() => "?").join(",");
  const params = [tenantId, ...tokens];
  await db.run(
    `UPDATE push_tokens SET active = 0, updatedAt = CURRENT_TIMESTAMP WHERE tenant_id = ? AND token IN (${placeholders})`,
    params
  );
}

function postJsonWithHttps(url, jsonBody) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(jsonBody),
        },
      },
      (response) => {
        let raw = "";
        response.on("data", (chunk) => {
          raw += String(chunk);
        });
        response.on("end", () => {
          let payload = null;
          try {
            payload = raw ? JSON.parse(raw) : null;
          } catch {
            payload = null;
          }
          resolve({
            ok: Number(response.statusCode) >= 200 && Number(response.statusCode) < 300,
            status: Number(response.statusCode) || 500,
            payload,
          });
        });
      }
    );

    request.setTimeout(EXPO_PUSH_REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error("Timeout enviando push a Expo"));
    });
    request.on("error", reject);
    request.write(jsonBody);
    request.end();
  });
}

async function sendExpoPushChunk(chunk) {
  const body = JSON.stringify(chunk);
  let payload = null;
  let status = 0;
  let ok = false;

  if (typeof fetch === "function") {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body,
    });
    payload = await response.json().catch(() => null);
    status = Number(response.status) || 500;
    ok = !!response.ok;
  } else {
    const fallbackResponse = await postJsonWithHttps(EXPO_PUSH_URL, body);
    payload = fallbackResponse.payload;
    status = fallbackResponse.status;
    ok = fallbackResponse.ok;
  }

  if (!ok) {
    throw new Error(
      payload?.errors?.[0]?.message || payload?.error || `Error enviando push. HTTP ${status}`
    );
  }

  return Array.isArray(payload?.data) ? payload.data : [];
}

async function sendPushToRoles({ tenantId, roles, title, body, data = {} }) {
  const db = await dbPromise;
  const safeTenantId = toTenantId(tenantId, DEFAULT_TENANT_ID);
  const pushDevices = await listPushTokensByRoles(db, roles, safeTenantId);
  if (!pushDevices.length) {
    console.log(
      `[push] tenant=${safeTenantId} roles=${sanitizePushRoleList(roles).join(",")} targets=0 sent=0 inactive=0 reason=no-active-tokens`
    );
    return { sent: 0, inactive: 0 };
  }

  const validPushDevices = pushDevices.filter((entry) => isExpoPushToken(entry.token));
  if (!validPushDevices.length) {
    console.warn("[push] no hay tokens Expo validos activos para envio.");
    console.log(
      `[push] tenant=${safeTenantId} roles=${sanitizePushRoleList(roles).join(",")} targets=0 sent=0 inactive=0 reason=no-valid-expo-tokens`
    );
    return { sent: 0, inactive: 0 };
  }

  const uniqueDevices = [];
  const seenTokens = new Set();
  for (const entry of validPushDevices) {
    if (seenTokens.has(entry.token)) continue;
    seenTokens.add(entry.token);
    uniqueDevices.push(entry);
  }

  const messages = uniqueDevices.map((entry) => ({
    to: entry.token,
    // Android requiere canal para mostrar notificaciones de forma consistente.
    channelId: entry.platform === "android" ? "default" : undefined,
    sound: "default",
    priority: "high",
    title: String(title || "").slice(0, 120),
    body: String(body || "").slice(0, 400),
    data,
  }));

  let sent = 0;
  const staleTokens = [];
  const chunks = chunkArray(messages, 100);
  for (const chunk of chunks) {
    const tickets = await sendExpoPushChunk(chunk);
    sent += chunk.length;
    tickets.forEach((ticket, index) => {
      const isDeviceNotRegistered =
        ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered";
      if (isDeviceNotRegistered) {
        staleTokens.push(chunk[index]?.to);
      }
      if (ticket?.status === "error" && !isDeviceNotRegistered) {
        console.warn(
          `[push] ticket error: ${ticket?.details?.error || "unknown"} - ${
            ticket?.message || "sin mensaje"
          }`
        );
      }
    });
  }

  const uniqueStale = [...new Set(staleTokens.filter(Boolean))];
  if (uniqueStale.length) {
    await disablePushTokens(db, uniqueStale, safeTenantId);
  }
  console.log(
    `[push] tenant=${safeTenantId} roles=${sanitizePushRoleList(roles).join(",")} targets=${uniqueDevices.length} sent=${sent} inactive=${uniqueStale.length}`
  );
  return { sent, inactive: uniqueStale.length };
}

const isLowStock = (stock) => {
  const normalized = toInt(stock, 0);
  return normalized >= 0 && normalized <= PUSH_LOW_STOCK_THRESHOLD;
};

const crossedIntoLowStock = (beforeStock, afterStock) =>
  !isLowStock(beforeStock) && isLowStock(afterStock);

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.type("text").send("API WISAND OK");
});

/* ============================
   Auth
============================ */
app.post("/auth/login", async (req, res) => {
  const ip = getClientIp(req);
  if (isLoginBlocked(ip)) {
    return res.status(429).json({ error: "Demasiados intentos. Intenta mas tarde." });
  }

  const { username = "", password = "" } = req.body || {};
  const u = String(username || "").trim();
  const p = String(password || "").trim();
  if (!u || !p) {
    recordLoginFailure(ip);
    return res.status(400).json({ error: "Usuario y contrasena requeridos" });
  }

  const db = await dbPromise;
  const tenantLogin = await resolveLoginTenant(db, req);
  const tenantId = toTenantId(tenantLogin.tenantId, 0);
  if (!tenantId) {
    recordLoginFailure(ip);
    return res.status(401).json({ error: "Credenciales invalidas" });
  }
  const user = await db.get("SELECT * FROM users WHERE username = ? AND tenant_id = ?", [
    u,
    tenantId,
  ]);
  if (!user) {
    recordLoginFailure(ip);
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  const hash = user.passwordHash || user.passwordhash || "";
  const ok = await bcrypt.compare(p, hash);
  if (!ok) {
    recordLoginFailure(ip);
    return res.status(401).json({ error: "Credenciales invalidas" });
  }

  clearLoginAttempts(ip);
  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      tenant_id: toTenantId(pick(user, "tenant_id", "tenantId"), tenantId),
      tenant_code: tenantLogin.tenantCode || null,
      username: user.username,
      role: user.role,
    },
  });
});

app.get("/auth/me", authRequired, async (req, res) => {
  const db = await dbPromise;
  const user = await db.get(
    `
    SELECT
      u.id,
      u.tenant_id,
      t.code AS tenant_code,
      u.username,
      u.role
    FROM users u
    LEFT JOIN tenants t ON t.id = u.tenant_id
    WHERE u.id = ? AND u.tenant_id = ?
  `,
    [req.user.id, req.user.tenant_id]
  );
  if (!user) return res.status(401).json({ error: "Usuario invalido" });
  res.json({
    id: user.id,
    tenant_id: toTenantId(pick(user, "tenant_id", "tenantId"), req.user.tenant_id),
    tenant_code: normalizeTenantCode(pick(user, "tenant_code", "tenantCode")) || null,
    username: user.username,
    role: user.role,
  });
});

app.get("/tenants/:code/branding", async (req, res) => {
  const requestedCode = normalizeTenantCode(req.params?.code || "");
  if (!requestedCode) {
    return res.json(buildDefaultBranding());
  }

  const db = await dbPromise;
  const tenant = await db.get("SELECT id, code, name FROM tenants WHERE code = ?", [requestedCode]);
  if (!tenant?.id) {
    return res.json(buildDefaultBranding(requestedCode));
  }

  const brandingRow = await db.get(
    `
    SELECT tenant_id, display_name, logo_url, primary_color, secondary_color, accent_color, updated_at
    FROM tenant_branding
    WHERE tenant_id = ?
  `,
    [tenant.id]
  );

  return res.json(mapBrandingRow(brandingRow, tenant.code || requestedCode, tenant.name || ""));
});

app.put("/branding", authRequired, ownerOnly, async (req, res) => {
  const body = req.body || {};
  const hasDisplayName =
    Object.prototype.hasOwnProperty.call(body, "display_name") ||
    Object.prototype.hasOwnProperty.call(body, "displayName") ||
    Object.prototype.hasOwnProperty.call(body, "name");
  const hasLogoUrl =
    Object.prototype.hasOwnProperty.call(body, "logo_url") ||
    Object.prototype.hasOwnProperty.call(body, "logoUrl");
  const hasPrimary =
    Object.prototype.hasOwnProperty.call(body, "primary_color") ||
    Object.prototype.hasOwnProperty.call(body, "primaryColor");
  const hasSecondary =
    Object.prototype.hasOwnProperty.call(body, "secondary_color") ||
    Object.prototype.hasOwnProperty.call(body, "secondaryColor");
  const hasAccent =
    Object.prototype.hasOwnProperty.call(body, "accent_color") ||
    Object.prototype.hasOwnProperty.call(body, "accentColor");

  if (!hasDisplayName && !hasLogoUrl && !hasPrimary && !hasSecondary && !hasAccent) {
    return res.status(400).json({ error: "No hay campos de branding para actualizar" });
  }

  const db = await dbPromise;
  const tenant = await db.get("SELECT id, code, name FROM tenants WHERE id = ?", [req.user.tenant_id]);
  if (!tenant?.id) {
    return res.status(404).json({ error: "Tenant no encontrado" });
  }

  const existingRow = await db.get(
    `
    SELECT tenant_id, display_name, logo_url, primary_color, secondary_color, accent_color, updated_at
    FROM tenant_branding
    WHERE tenant_id = ?
  `,
    [tenant.id]
  );

  const current = mapBrandingRow(existingRow, tenant.code || "", tenant.name || "");

  const nextDisplayName = hasDisplayName
    ? normalizeBrandingDisplayName(
        pick(body, "display_name", "displayName", "name"),
        tenant.name || current.display_name
      )
    : current.display_name;

  const nextLogoUrl = hasLogoUrl
    ? normalizeBrandingLogoUrl(pick(body, "logo_url", "logoUrl"), {
        allowEmpty: true,
        fallback: current.logo_url,
      })
    : current.logo_url;
  if (nextLogoUrl === null) {
    return res.status(400).json({ error: "logo_url invalido" });
  }

  const nextPrimary = hasPrimary
    ? normalizeBrandingColor(pick(body, "primary_color", "primaryColor"), current.primary_color)
    : current.primary_color;
  if (nextPrimary === null) {
    return res.status(400).json({ error: "primary_color invalido. Usa formato #RRGGBB" });
  }

  const nextSecondary = hasSecondary
    ? normalizeBrandingColor(
        pick(body, "secondary_color", "secondaryColor"),
        current.secondary_color
      )
    : current.secondary_color;
  if (nextSecondary === null) {
    return res.status(400).json({ error: "secondary_color invalido. Usa formato #RRGGBB" });
  }

  const nextAccent = hasAccent
    ? normalizeBrandingColor(pick(body, "accent_color", "accentColor"), current.accent_color)
    : current.accent_color;
  if (nextAccent === null) {
    return res.status(400).json({ error: "accent_color invalido. Usa formato #RRGGBB" });
  }

  if (existingRow?.tenant_id) {
    await db.run(
      `
      UPDATE tenant_branding
      SET display_name = ?, logo_url = ?, primary_color = ?, secondary_color = ?, accent_color = ?, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ?
    `,
      [nextDisplayName, nextLogoUrl, nextPrimary, nextSecondary, nextAccent, tenant.id]
    );
  } else {
    await db.run(
      `
      INSERT INTO tenant_branding (
        tenant_id, display_name, logo_url, primary_color, secondary_color, accent_color, updated_at
      )
      VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
    `,
      [tenant.id, nextDisplayName, nextLogoUrl, nextPrimary, nextSecondary, nextAccent]
    );
  }

  const updatedRow = await db.get(
    `
    SELECT tenant_id, display_name, logo_url, primary_color, secondary_color, accent_color, updated_at
    FROM tenant_branding
    WHERE tenant_id = ?
  `,
    [tenant.id]
  );

  return res.json(mapBrandingRow(updatedRow, tenant.code || "", tenant.name || ""));
});

app.post("/internal/tenants", masterKeyRequired, async (req, res) => {
  const tenantName = String(pick(req.body, "name", "tenantName") || "").trim();
  const tenantCodeRaw = String(
    pick(req.body, "code", "tenantCode", "tenant_code", "businessCode", "companyCode") || ""
  ).trim();
  const tenantCodeInput = normalizeTenantCode(tenantCodeRaw);
  const ownerUsername = String(pick(req.body, "ownerUsername", "username") || "").trim();
  const ownerPassword = String(pick(req.body, "ownerPassword", "password") || "").trim();
  const ownerRole = String(pick(req.body, "ownerRole", "role") || "owner")
    .trim()
    .toLowerCase();

  if (!tenantName) return res.status(400).json({ error: "name es requerido" });
  if (tenantCodeRaw && !tenantCodeInput) {
    return res.status(400).json({ error: "code es invalido" });
  }
  if (!ownerUsername || !ownerPassword) {
    return res.status(400).json({ error: "ownerUsername y ownerPassword son requeridos" });
  }
  if (ownerRole !== "owner") {
    return res.status(400).json({ error: "ownerRole debe ser 'owner'" });
  }

  const db = await dbPromise;
  const existingTenant = await db.get("SELECT id FROM tenants WHERE name = ?", [tenantName]);
  if (existingTenant?.id) {
    return res.status(409).json({ error: "El tenant ya existe" });
  }

  if (tenantCodeInput) {
    const existingCode = await db.get("SELECT id FROM tenants WHERE code = ?", [tenantCodeInput]);
    if (existingCode?.id) {
      return res.status(409).json({ error: "El codigo de tenant ya existe" });
    }
  }

  const tenantCode = tenantCodeInput || (await nextTenantCode(db, tenantName));
  let tenantInsert = null;
  try {
    tenantInsert = await db.run("INSERT INTO tenants (name, code) VALUES (?,?)", [
      tenantName,
      tenantCode,
    ]);
  } catch (error) {
    if (/unique/i.test(String(error?.message || ""))) {
      return res.status(409).json({ error: "El codigo de tenant ya existe" });
    }
    throw error;
  }
  const tenantId = toInt(tenantInsert?.lastID, 0);
  if (!tenantId) {
    return res.status(500).json({ error: "No se pudo crear el tenant" });
  }

  try {
    const hash = await bcrypt.hash(ownerPassword, 10);
    const ownerInsert = await db.run(
      "INSERT INTO users (tenant_id, username, passwordHash, role) VALUES (?,?,?,?)",
      [tenantId, ownerUsername, hash, ownerRole]
    );
    await db.run(
      `
      INSERT INTO tenant_branding (
        tenant_id, display_name, logo_url, primary_color, secondary_color, accent_color, updated_at
      )
      VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
    `,
      [
        tenantId,
        normalizeBrandingDisplayName(tenantName, tenantName),
        DEFAULT_BRANDING.logo_url,
        DEFAULT_BRANDING.primary_color,
        DEFAULT_BRANDING.secondary_color,
        DEFAULT_BRANDING.accent_color,
      ]
    );
    return res.status(201).json({
      tenant: {
        id: tenantId,
        name: tenantName,
        code: tenantCode,
      },
      owner: {
        id: ownerInsert.lastID,
        tenant_id: tenantId,
        username: ownerUsername,
        role: ownerRole,
      },
      branding: mapBrandingRow(
        {
          display_name: tenantName,
          logo_url: DEFAULT_BRANDING.logo_url,
          primary_color: DEFAULT_BRANDING.primary_color,
          secondary_color: DEFAULT_BRANDING.secondary_color,
          accent_color: DEFAULT_BRANDING.accent_color,
          updated_at: new Date().toISOString(),
        },
        tenantCode,
        tenantName
      ),
    });
  } catch (error) {
    await db.run("DELETE FROM users WHERE tenant_id = ?", [tenantId]);
    await db.run("DELETE FROM tenant_branding WHERE tenant_id = ?", [tenantId]);
    await db.run("DELETE FROM tenants WHERE id = ?", [tenantId]);
    if (/unique/i.test(String(error?.message || ""))) {
      return res.status(409).json({ error: "ownerUsername ya existe" });
    }
    throw error;
  }
});

/* ============================
   Notificaciones push
============================ */
app.post("/notifications/register", authRequired, async (req, res) => {
  const token = String(req.body?.token || "").trim();
  const platform = String(req.body?.platform || "").trim().toLowerCase();
  const deviceId = String(req.body?.deviceId || "").trim();
  const tenantId = req.user.tenant_id;
  if (!isExpoPushToken(token)) {
    console.warn(
      `[push-register] rejected user=${req.user?.id || "?"} role=${req.user?.role || "?"} platform=${platform || "-"} token=${maskPushToken(
        token
      )}`
    );
    return res.status(400).json({ error: "Token push invalido" });
  }

  const db = await dbPromise;
  const persistExistingToken = async (existingRow) => {
    const previousTenantId = toTenantId(existingRow?.tenant_id, 0);
    await db.run(
      `
      UPDATE push_tokens
      SET tenant_id = ?, userId = ?, role = ?, platform = ?, deviceId = ?, active = 1, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [tenantId, req.user.id, req.user.role, platform || null, deviceId || null, existingRow.id]
    );
    const moved = previousTenantId > 0 && previousTenantId !== tenantId;
    console.log(
      `[push-register] ok user=${req.user.id} role=${req.user.role} platform=${platform || "-"} updated=true moved=${moved} token=${maskPushToken(
        token
      )}`
    );
    return res.json({ ok: true, updated: true, moved });
  };

  const existingByToken = await db.get("SELECT id, tenant_id FROM push_tokens WHERE token = ?", [
    token,
  ]);
  if (existingByToken?.id) {
    return persistExistingToken(existingByToken);
  }

  try {
    await db.run(
      `
      INSERT INTO push_tokens (tenant_id, userId, role, platform, deviceId, token, active, updatedAt)
      VALUES (?,?,?,?,?,?,1,CURRENT_TIMESTAMP)
      `,
      [tenantId, req.user.id, req.user.role, platform || null, deviceId || null, token]
    );
  } catch (error) {
    if (/unique/i.test(String(error?.message || ""))) {
      const conflicted = await db.get("SELECT id, tenant_id FROM push_tokens WHERE token = ?", [
        token,
      ]);
      if (conflicted?.id) {
        return persistExistingToken(conflicted);
      }
    }
    throw error;
  }

  console.log(
    `[push-register] ok user=${req.user.id} role=${req.user.role} platform=${platform || "-"} updated=false token=${maskPushToken(
      token
    )}`
  );
  return res.json({ ok: true });
});

app.post("/notifications/unregister", authRequired, async (req, res) => {
  const token = String(req.body?.token || "").trim();
  if (!token) {
    return res.status(400).json({ error: "Token push requerido" });
  }

  const db = await dbPromise;
  await db.run(
    `
    UPDATE push_tokens
    SET active = 0, updatedAt = CURRENT_TIMESTAMP
    WHERE token = ? AND userId = ? AND tenant_id = ?
    `,
    [token, req.user.id, req.user.tenant_id]
  );
  console.log(
    `[push-unregister] ok user=${req.user.id} role=${req.user.role} token=${maskPushToken(token)}`
  );
  return res.json({ ok: true });
});

/* ============================
   Usuarios (owner)
============================ */
app.get("/users", authRequired, ownerOnly, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const db = await dbPromise;
  const rows = await db.all(
    "SELECT id, tenant_id, username, role, createdAt FROM users WHERE tenant_id = ? ORDER BY id ASC",
    [tenantId]
  );
  res.json(rows);
});

app.post("/users", authRequired, ownerOnly, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { username = "", password = "", role = "staff" } = req.body || {};
  const u = String(username || "").trim();
  const p = String(password || "").trim();
  const r = String(role || "staff").trim();
  if (!u || !p) return res.status(400).json({ error: "Usuario y contrasena requeridos" });
  if (!["owner", "staff"].includes(r)) return res.status(400).json({ error: "Rol invalido" });

  const db = await dbPromise;
  const exists = await db.get("SELECT id FROM users WHERE username = ? AND tenant_id = ?", [
    u,
    tenantId,
  ]);
  if (exists) return res.status(409).json({ error: "Usuario ya existe" });

  const hash = await bcrypt.hash(p, 10);
  let result;
  try {
    result = await db.run("INSERT INTO users (tenant_id, username, passwordHash, role) VALUES (?,?,?,?)", [
      tenantId,
      u,
      hash,
      r,
    ]);
  } catch (error) {
    if (/unique/i.test(String(error?.message || ""))) {
      return res.status(409).json({ error: "Usuario ya existe" });
    }
    throw error;
  }

  res.json({ id: result.lastID, tenant_id: tenantId, username: u, role: r });
});

app.put("/users/:id", authRequired, ownerOnly, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ error: "ID invalido" });

  const { password, role, username } = req.body || {};
  const db = await dbPromise;
  const targetUser = await db.get("SELECT id, role FROM users WHERE id = ? AND tenant_id = ?", [
    id,
    tenantId,
  ]);
  if (!targetUser) return res.status(404).json({ error: "Usuario no encontrado" });
  const nextRoleRaw = role ? String(role).trim().toLowerCase() : "";
  if (nextRoleRaw && !["owner", "staff"].includes(nextRoleRaw)) {
    return res.status(400).json({ error: "Rol invalido" });
  }
  const currentRole = String(targetUser.role || "").trim().toLowerCase();
  if (nextRoleRaw === "staff" && currentRole === "owner") {
    const ownersRow = await db.get(
      "SELECT COUNT(*) as c FROM users WHERE role = 'owner' AND tenant_id = ?",
      [tenantId]
    );
    const ownerCount = Number(ownersRow?.c ?? ownersRow?.count ?? 0);
    if (ownerCount <= 1) {
      return res.status(409).json({ error: "No se puede cambiar el ultimo owner a staff." });
    }
  }

  if (username && String(username).trim()) {
    const u = String(username).trim();
    const exists = await db.get(
      "SELECT id FROM users WHERE username = ? AND id <> ? AND tenant_id = ?",
      [u, id, tenantId]
    );
    if (exists) return res.status(409).json({ error: "Usuario ya existe" });
    try {
      await db.run("UPDATE users SET username = ? WHERE id = ? AND tenant_id = ?", [
        u,
        id,
        tenantId,
      ]);
    } catch (error) {
      if (/unique/i.test(String(error?.message || ""))) {
        return res.status(409).json({ error: "Usuario ya existe" });
      }
      throw error;
    }
  }

  if (password && String(password).trim()) {
    const hash = await bcrypt.hash(String(password).trim(), 10);
    await db.run("UPDATE users SET passwordHash = ? WHERE id = ? AND tenant_id = ?", [
      hash,
      id,
      tenantId,
    ]);
  }

  if (nextRoleRaw) {
    await db.run("UPDATE users SET role = ? WHERE id = ? AND tenant_id = ?", [
      nextRoleRaw,
      id,
      tenantId,
    ]);
  }

  res.json({ ok: true });
});

/* ============================
   Productos
============================ */
app.get("/products", authOptional, async (req, res) => {
  const tenantId = getRequestTenantId(req);
  const page = Math.max(1, toInt(req.query?.page, 1));
  const requestedLimit = toInt(req.query?.limit, 24);
  const limit = Math.min(100, Math.max(1, requestedLimit));
  const offset = (page - 1) * limit;

  const db = await dbPromise;
  const totalRow = await db.get("SELECT COUNT(*) as c FROM products WHERE tenant_id = ?", [tenantId]);
  const total = Number(totalRow?.c ?? totalRow?.count ?? 0);
  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
  const rows = await db.all(
    "SELECT * FROM products WHERE tenant_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
    [tenantId, limit, offset]
  );

  res.json({
    items: rows.map(normalizeProductRow),
    page,
    limit,
    total,
    totalPages,
  });
});

app.post("/products", authRequired, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const p = req.body || {};
  if (!p.nombre) return res.status(400).json({ error: "Nombre requerido" });
  const externalId = p.externalId || p.id || null;

  const db = await dbPromise;
  if (externalId) {
    const existing = await db.get(
      "SELECT id, nombre, stockCajas FROM products WHERE externalId = ? AND tenant_id = ?",
      [externalId, tenantId]
    );
    if (existing && existing.id) {
      const previousStock = toInt(existing.stockCajas, Number.MAX_SAFE_INTEGER);
      const nextStock = toInt(p.stockCajas, 0);
      await db.run(
        `
        UPDATE products SET
          nombre = ?, descripcion = ?, categoria = ?, disponibilidad = ?, imagen = ?,
          precioCaja = ?, precioSobre = ?, precioUnidad = ?, sobresXCaja = ?, unidadesXSobre = ?, stockCajas = ?,
          ofertaActiva = ?, ofertaTexto = ?, ofertaPrecioCaja = ?, ofertaPrecioSobre = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE externalId = ? AND tenant_id = ?
        `,
        [
          p.nombre || "",
          p.descripcion || "",
          p.categoria || "",
          p.disponibilidad || "Disponible",
          p.imagen || "",
          toNumber(p.precioCaja),
          toNumber(p.precioSobre),
          toNumber(p.precioUnidad),
          toInt(p.sobresXCaja),
          toInt(p.unidadesXSobre),
          toInt(p.stockCajas),
          toBoolInt(p.ofertaActiva),
          p.ofertaTexto || "",
          toNumber(p.ofertaPrecioCaja),
          toNumber(p.ofertaPrecioSobre),
          externalId,
          tenantId,
        ]
      );
      if (crossedIntoLowStock(previousStock, nextStock)) {
        runNonBlocking("stock-low-external-upsert", async () => {
          await sendPushToRoles({
            tenantId,
            roles: PUSH_NOTIFY_ROLES,
            title: "Alerta de stock bajo",
            body: `${p.nombre || existing.nombre || "Producto"} quedo en ${nextStock} cajas.`,
            data: {
              type: "stock_low",
              externalId,
              productName: p.nombre || existing.nombre || "",
              stockCajas: nextStock,
              threshold: PUSH_LOW_STOCK_THRESHOLD,
            },
          });
        });
      }
      return res.json({ id: existing.id, updated: true });
    }
  }
  const initialStock = toInt(p.stockCajas, 0);
  const result = await db.run(
    `
    INSERT INTO products
    (tenant_id, externalId, nombre, descripcion, categoria, disponibilidad, imagen,
     precioCaja, precioSobre, precioUnidad, sobresXCaja, unidadesXSobre, stockCajas,
     ofertaActiva, ofertaTexto, ofertaPrecioCaja, ofertaPrecioSobre, updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, CURRENT_TIMESTAMP)
    `,
    [
      tenantId,
      externalId,
      p.nombre,
      p.descripcion || "",
      p.categoria || "",
      p.disponibilidad || "Disponible",
      p.imagen || "",
      toNumber(p.precioCaja),
      toNumber(p.precioSobre),
      toNumber(p.precioUnidad),
      toInt(p.sobresXCaja),
      toInt(p.unidadesXSobre),
      toInt(p.stockCajas),
      toBoolInt(p.ofertaActiva),
      p.ofertaTexto || "",
      toNumber(p.ofertaPrecioCaja),
      toNumber(p.ofertaPrecioSobre),
    ]
  );

  if (isLowStock(initialStock)) {
    runNonBlocking("stock-low-create", async () => {
      await sendPushToRoles({
        tenantId,
        roles: PUSH_NOTIFY_ROLES,
        title: "Alerta de stock bajo",
        body: `${p.nombre || "Producto"} quedo en ${initialStock} cajas.`,
        data: {
          type: "stock_low",
          productId: result.lastID,
          externalId,
          productName: p.nombre || "",
          stockCajas: initialStock,
          threshold: PUSH_LOW_STOCK_THRESHOLD,
        },
      });
    });
  }

  res.json({ id: result.lastID });
});

app.put("/products/:id", authRequired, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ error: "ID invalido" });

  const p = req.body || {};
  const db = await dbPromise;
  const existing = await db.get(
    "SELECT id, nombre, stockCajas, externalId FROM products WHERE id = ? AND tenant_id = ?",
    [id, tenantId]
  );
  if (!existing?.id) return res.status(404).json({ error: "Producto no encontrado" });
  const previousStock = toInt(existing?.stockCajas, Number.MAX_SAFE_INTEGER);
  const nextStock = toInt(p.stockCajas, 0);

  await db.run(
    `
    UPDATE products SET
      nombre = ?, descripcion = ?, categoria = ?, disponibilidad = ?, imagen = ?,
      precioCaja = ?, precioSobre = ?, precioUnidad = ?, sobresXCaja = ?, unidadesXSobre = ?, stockCajas = ?,
      ofertaActiva = ?, ofertaTexto = ?, ofertaPrecioCaja = ?, ofertaPrecioSobre = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
    `,
    [
      p.nombre || "",
      p.descripcion || "",
      p.categoria || "",
      p.disponibilidad || "Disponible",
      p.imagen || "",
      toNumber(p.precioCaja),
      toNumber(p.precioSobre),
      toNumber(p.precioUnidad),
      toInt(p.sobresXCaja),
      toInt(p.unidadesXSobre),
      toInt(p.stockCajas),
      toBoolInt(p.ofertaActiva),
      p.ofertaTexto || "",
      toNumber(p.ofertaPrecioCaja),
      toNumber(p.ofertaPrecioSobre),
      id,
      tenantId,
    ]
  );

  if (existing?.id && crossedIntoLowStock(previousStock, nextStock)) {
    runNonBlocking("stock-low-id-update", async () => {
      await sendPushToRoles({
        tenantId,
        roles: PUSH_NOTIFY_ROLES,
        title: "Alerta de stock bajo",
        body: `${p.nombre || existing.nombre || "Producto"} quedo en ${nextStock} cajas.`,
        data: {
          type: "stock_low",
          productId: id,
          externalId: existing.externalId || null,
          productName: p.nombre || existing.nombre || "",
          stockCajas: nextStock,
          threshold: PUSH_LOW_STOCK_THRESHOLD,
        },
      });
    });
  }

  res.json({ ok: true });
});

app.put("/products/external/:externalId", authRequired, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const externalId = String(req.params.externalId || "").trim();
  if (!externalId) return res.status(400).json({ error: "externalId invalido" });

  const p = req.body || {};
  const db = await dbPromise;

  await db.run(
    `
    UPDATE products SET
      nombre = ?, descripcion = ?, categoria = ?, disponibilidad = ?, imagen = ?,
      precioCaja = ?, precioSobre = ?, precioUnidad = ?, sobresXCaja = ?, unidadesXSobre = ?, stockCajas = ?,
      ofertaActiva = ?, ofertaTexto = ?, ofertaPrecioCaja = ?, ofertaPrecioSobre = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE externalId = ? AND tenant_id = ?
    `,
    [
      p.nombre || "",
      p.descripcion || "",
      p.categoria || "",
      p.disponibilidad || "Disponible",
      p.imagen || "",
      toNumber(p.precioCaja),
      toNumber(p.precioSobre),
      toNumber(p.precioUnidad),
      toInt(p.sobresXCaja),
      toInt(p.unidadesXSobre),
      toInt(p.stockCajas),
      toBoolInt(p.ofertaActiva),
      p.ofertaTexto || "",
      toNumber(p.ofertaPrecioCaja),
      toNumber(p.ofertaPrecioSobre),
      externalId,
      tenantId,
    ]
  );

  const nextStock = toInt(p.stockCajas, 0);
  if (isLowStock(nextStock)) {
    runNonBlocking("stock-low-external-update", async () => {
      await sendPushToRoles({
        tenantId,
        roles: PUSH_NOTIFY_ROLES,
        title: "Alerta de stock bajo",
        body: `${p.nombre || "Producto"} quedo en ${nextStock} cajas.`,
        data: {
          type: "stock_low",
          externalId,
          productName: p.nombre || "",
          stockCajas: nextStock,
          threshold: PUSH_LOW_STOCK_THRESHOLD,
        },
      });
    });
  }

  res.json({ ok: true });
});

app.delete("/products/:id", authRequired, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ error: "ID invalido" });

  const db = await dbPromise;
  await db.run("DELETE FROM products WHERE id = ? AND tenant_id = ?", [id, tenantId]);
  res.json({ ok: true });
});

app.delete("/products/external/:externalId", authRequired, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const externalId = String(req.params.externalId || "").trim();
  if (!externalId) return res.status(400).json({ error: "externalId invalido" });

  const db = await dbPromise;
  await db.run("DELETE FROM products WHERE externalId = ? AND tenant_id = ?", [
    externalId,
    tenantId,
  ]);
  res.json({ ok: true });
});

/* ============================
   Pedidos
============================ */
app.get("/orders", authRequired, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const db = await dbPromise;
  const status = req.query.estado;
  const rows = status
    ? await db.all("SELECT * FROM orders WHERE tenant_id = ? AND estado = ? ORDER BY id DESC", [
        tenantId,
        status,
      ])
    : await db.all("SELECT * FROM orders WHERE tenant_id = ? ORDER BY id DESC", [tenantId]);
  res.json(
    rows.map((r) => ({
      ...r,
      items: safeJson(r.items, []),
    }))
  );
});

app.post("/orders", authOptional, async (req, res) => {
  const tenantId = getRequestTenantId(req);
  const o = req.body || {};
  const items = Array.isArray(o.items) ? o.items : [];
  const total = toNumber(o.total);
  const externalId = o.externalId || o.id || null;
  const status = String(o.estado || "pendiente").toLowerCase();

  const db = await dbPromise;
  if (externalId) {
    const existing = await db.get(
      "SELECT id FROM orders WHERE externalId = ? AND tenant_id = ?",
      [externalId, tenantId]
    );
    if (existing && existing.id) {
      return res.json({ id: existing.id, ok: true, existing: true });
    }
  }
  const result = await db.run(
    `
    INSERT INTO orders
    (tenant_id, externalId, clienteNombre, clienteTelefono, clienteDireccion, items, total, estado)
    VALUES (?,?,?,?,?,?,?,?)
    `,
    [
      tenantId,
      externalId,
      o.clienteNombre || "",
      o.clienteTelefono || "",
      o.clienteDireccion || "",
      JSON.stringify(items),
      total,
      status,
    ]
  );
  console.log(
    `[orders] created id=${result.lastID} externalId=${externalId || "-"} estado=${status} total=${toNumber(total, 0)}`
  );

  if (status === "pendiente") {
    runNonBlocking("order-created", async () => {
      const orderRef = externalId || `#${result.lastID}`;
      const customer = String(o.clienteNombre || "").trim() || "Cliente";
      await sendPushToRoles({
        tenantId,
        roles: PUSH_NOTIFY_ROLES,
        title: "Nuevo pedido pendiente",
        body: `${customer} envio ${orderRef} por ${formatMoneyCop(total)}.`,
        data: {
          type: "new_order",
          orderId: result.lastID,
          externalId,
          customerName: customer,
          total,
          estado: status,
        },
      });
    });
  }

  res.json({ id: result.lastID });
});

app.put("/orders/:id/status", authRequired, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const id = toInt(req.params.id, 0);
  if (!id) return res.status(400).json({ error: "ID invalido" });

  const estado = (req.body?.estado || "").toLowerCase();
  if (!estado) return res.status(400).json({ error: "Estado requerido" });

  const db = await dbPromise;
  const targetOrder = await db.get("SELECT id FROM orders WHERE id = ? AND tenant_id = ?", [id, tenantId]);
  if (!targetOrder?.id) return res.status(404).json({ error: "Pedido no encontrado" });

  await db.run("UPDATE orders SET estado = ? WHERE id = ? AND tenant_id = ?", [estado, id, tenantId]);

  if (CLOSED_ORDER_STATES.has(estado)) {
    await ensureSaleForClosedOrder(db, tenantId, id, req.user);
  }

  res.json({ ok: true });
});

app.put("/orders/external/:externalId/status", authRequired, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const externalId = String(req.params.externalId || "").trim();
  if (!externalId) return res.status(400).json({ error: "externalId invalido" });

  const estado = (req.body?.estado || "").toLowerCase();
  if (!estado) return res.status(400).json({ error: "Estado requerido" });

  const db = await dbPromise;
  const targetOrder = await db.get("SELECT id FROM orders WHERE externalId = ? AND tenant_id = ?", [
    externalId,
    tenantId,
  ]);
  if (!targetOrder?.id) return res.status(404).json({ error: "Pedido no encontrado" });

  await db.run("UPDATE orders SET estado = ? WHERE id = ? AND tenant_id = ?", [
    estado,
    targetOrder.id,
    tenantId,
  ]);

  if (CLOSED_ORDER_STATES.has(estado)) {
    await ensureSaleForClosedOrder(db, tenantId, targetOrder.id, req.user);
  }

  res.json({ ok: true });
});

app.delete("/orders", authRequired, ownerOnly, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const db = await dbPromise;
  await db.run("DELETE FROM orders WHERE tenant_id = ?", [tenantId]);
  res.json({ ok: true });
});

async function resolveOrderIdForSale(db, tenantId, rawOrderId, refId) {
  let orderId = toInt(rawOrderId, 0);
  if (!orderId && refId) {
    const normalizedRef = String(refId || "").trim();
    const parsedRefAsId = toInt(normalizedRef, 0);
    if (parsedRefAsId > 0) {
      orderId = parsedRefAsId;
    } else if (normalizedRef) {
      const orderByExternal = await db.get(
        "SELECT id FROM orders WHERE externalId = ? AND tenant_id = ?",
        [normalizedRef, tenantId]
      );
      orderId = toInt(orderByExternal?.id, 0);
    }
  }
  if (!orderId) return null;
  const order = await db.get("SELECT id FROM orders WHERE id = ? AND tenant_id = ?", [
    orderId,
    tenantId,
  ]);
  return order?.id ? toInt(order.id, 0) : null;
}

const CLOSED_ORDER_STATES = new Set(["aceptado", "cerrado", "completado", "finalizado", "closed"]);

async function ensureSaleForClosedOrder(db, tenantId, orderId, actor) {
  const safeOrderId = toInt(orderId, 0);
  if (!safeOrderId) return { created: false, existing: false, reason: "invalid-order-id" };

  const order = await db.get(
    `
    SELECT id, tenant_id, externalId, clienteNombre, clienteTelefono, total, items, estado
    FROM orders
    WHERE id = ? AND tenant_id = ?
    `,
    [safeOrderId, tenantId]
  );
  if (!order?.id) return { created: false, existing: false, reason: "order-not-found" };

  const orderStatus = String(order.estado || "").trim().toLowerCase();
  if (!CLOSED_ORDER_STATES.has(orderStatus)) {
    return { created: false, existing: false, reason: "order-not-closed" };
  }

  const existingByOrder = await db.get("SELECT id FROM sales WHERE tenant_id = ? AND order_id = ?", [
    tenantId,
    safeOrderId,
  ]);
  if (existingByOrder?.id) {
    return { created: false, existing: true, id: existingByOrder.id };
  }

  const items = safeJson(order.items, []);
  const salePayload = [
    tenantId,
    safeOrderId,
    pick(order, "externalId", "externalid") || `order:${safeOrderId}`,
    toInt(actor?.id, 0),
    String(actor?.username || ""),
    String(order.clienteNombre || ""),
    String(order.clienteTelefono || ""),
    toNumber(order.total),
    JSON.stringify(items),
    "",
    new Date().toISOString(),
  ];

  try {
    const saleInsert = await db.run(
      `
      INSERT INTO sales
      (tenant_id, order_id, refId, userId, userName, clienteNombre, clienteTelefono, total, items, metodoPago, fechaISO)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `,
      salePayload
    );
    return { created: true, existing: false, id: saleInsert?.lastID };
  } catch (error) {
    if (/unique/i.test(String(error?.message || ""))) {
      const existingOnConflict = await db.get(
        "SELECT id FROM sales WHERE tenant_id = ? AND order_id = ?",
        [tenantId, safeOrderId]
      );
      if (existingOnConflict?.id) {
        return { created: false, existing: true, id: existingOnConflict.id };
      }
    }
    throw error;
  }
}

/* ============================
   Ventas
============================ */
app.get("/sales", authRequired, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const db = await dbPromise;
  const isOwner = req.user?.role === "owner";
  const rows = isOwner
    ? await db.all("SELECT * FROM sales WHERE tenant_id = ? ORDER BY id DESC", [tenantId])
    : await db.all("SELECT * FROM sales WHERE tenant_id = ? AND userId = ? ORDER BY id DESC", [
        tenantId,
        req.user.id,
      ]);

  res.json(
    rows.map((r) => ({
      ...r,
      items: safeJson(r.items, []),
    }))
  );
});

app.post("/sales", authRequired, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const s = req.body || {};
  const items = Array.isArray(s.items) ? s.items : [];
  const total = toNumber(s.total);
  const refId = s.refId || null;

  const db = await dbPromise;
  const requestedOrderId = toInt(pick(s, "orderId", "order_id"), 0);
  const orderId = await resolveOrderIdForSale(db, tenantId, requestedOrderId, refId);
  if (requestedOrderId > 0 && !orderId) {
    return res.status(400).json({ error: "orderId no pertenece al tenant actual" });
  }
  if (orderId) {
    const existingByOrder = await db.get(
      "SELECT id FROM sales WHERE tenant_id = ? AND order_id = ?",
      [tenantId, orderId]
    );
    if (existingByOrder?.id) {
      return res.json({ id: existingByOrder.id, ok: true, existing: true });
    }
  }
  if (refId) {
    const existing = await db.get(
      "SELECT id FROM sales WHERE tenant_id = ? AND refId = ? AND userId = ?",
      [tenantId, refId, req.user.id]
    );
    if (existing && existing.id) {
      return res.json({ id: existing.id, ok: true, existing: true });
    }
  }

  const result = await db.run(
    `
    INSERT INTO sales
    (tenant_id, order_id, refId, userId, userName, clienteNombre, clienteTelefono, total, items, metodoPago, fechaISO)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `,
    [
      tenantId,
      orderId,
      refId,
      req.user.id,
      req.user.username || "",
      s.clienteNombre || "",
      s.clienteTelefono || "",
      total,
      JSON.stringify(items),
      s.metodoPago || "",
      s.fechaISO || new Date().toISOString(),
    ]
  );

  res.json({ id: result.lastID });
});

app.delete("/sales", authRequired, ownerOnly, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const db = await dbPromise;
  await db.run("DELETE FROM sales WHERE tenant_id = ?", [tenantId]);
  res.json({ ok: true });
});

/* ============================
   Cierres de caja
============================ */
app.get("/closures", authRequired, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const dateKey = normalizeClosureDateKey(pick(req.query, "date", "date_key", "dateKey"));
  const requestedLimit = toInt(pick(req.query, "limit"), 20);
  const limit = Math.min(100, Math.max(1, requestedLimit));

  const db = await dbPromise;
  const rows = dateKey
    ? await db.all(
        `
        SELECT * FROM cash_closures
        WHERE tenant_id = ? AND date_key = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
        `,
        [tenantId, dateKey, limit]
      )
    : await db.all(
        `
        SELECT * FROM cash_closures
        WHERE tenant_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
        `,
        [tenantId, limit]
      );

  return res.json(rows.map((row) => mapCashClosureRow(row)));
});

app.post("/closures", authRequired, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const body = req.body || {};

  const dateKey = normalizeClosureDateKey(pick(body, "date_key", "dateKey", "date"));
  if (!dateKey) {
    return res.status(400).json({ error: "date_key invalido (usa YYYY-MM-DD)" });
  }

  const startTime = normalizeClosureTime(pick(body, "start_time", "startTime", "from"), "00:00");
  const endTime = normalizeClosureTime(pick(body, "end_time", "endTime", "to"), "23:59");
  const openingCash = Math.max(0, toNumber(pick(body, "opening_cash", "openingCash"), 0));
  const countedCash = Math.max(0, toNumber(pick(body, "counted_cash", "countedCash"), 0));
  const methods = normalizeClosureMethods(pick(body, "methods", "methods_json", "methodsJson"));
  const expectedCash = openingCash + methods.efectivo;
  const cashDiff = countedCash - expectedCash;
  const totalSales = Math.max(0, toNumber(pick(body, "total_sales", "totalSales"), 0));
  const salesCount = Math.max(0, toInt(pick(body, "sales_count", "salesCount"), 0));
  const itemsCount = Math.max(0, toInt(pick(body, "items_count", "itemsCount"), 0));
  const notes = normalizeClosureNotes(pick(body, "notes", "note", "nota"));

  const db = await dbPromise;
  const result = await db.run(
    `
    INSERT INTO cash_closures (
      tenant_id,
      date_key,
      start_time,
      end_time,
      opening_cash,
      counted_cash,
      expected_cash,
      cash_diff,
      total_sales,
      sales_count,
      items_count,
      methods_json,
      notes,
      created_by_user_id,
      created_by_username,
      created_at
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    `,
    [
      tenantId,
      dateKey,
      startTime,
      endTime,
      openingCash,
      countedCash,
      expectedCash,
      cashDiff,
      totalSales,
      salesCount,
      itemsCount,
      JSON.stringify(methods),
      notes,
      req.user.id,
      String(req.user.username || "").trim(),
    ]
  );

  const insertedId = toInt(result?.lastID, 0);
  const inserted = insertedId
    ? await db.get("SELECT * FROM cash_closures WHERE id = ? AND tenant_id = ?", [
        insertedId,
        tenantId,
      ])
    : null;

  return res.status(201).json(
    mapCashClosureRow(
      inserted || {
        id: insertedId,
        tenant_id: tenantId,
        date_key: dateKey,
        start_time: startTime,
        end_time: endTime,
        opening_cash: openingCash,
        counted_cash: countedCash,
        expected_cash: expectedCash,
        cash_diff: cashDiff,
        total_sales: totalSales,
        sales_count: salesCount,
        items_count: itemsCount,
        methods_json: JSON.stringify(methods),
        notes,
        created_by_user_id: req.user.id,
        created_by_username: String(req.user.username || "").trim(),
        created_at: new Date().toISOString(),
      }
    )
  );
});
/* ============================
   Resenas
============================ */
app.get("/reviews", authOptional, async (req, res) => {
  const tenantId = getRequestTenantId(req);
  const db = await dbPromise;
  const rows = await db.all("SELECT * FROM reviews WHERE tenant_id = ? ORDER BY id DESC", [
    tenantId,
  ]);
  res.json(rows);
});

app.post("/reviews", authOptional, async (req, res) => {
  const tenantId = getRequestTenantId(req);
  const r = req.body || {};
  const db = await dbPromise;
  const result = await db.run(
    `
    INSERT INTO reviews (tenant_id, nombre, telefono, rating, texto, verificada)
    VALUES (?,?,?,?,?,?)
    `,
    [
      tenantId,
      r.nombre || "",
      r.telefono || "",
      toInt(r.rating),
      r.texto || "",
      toBoolInt(r.verificada),
    ]
  );

  res.json({ id: result.lastID });
});

app.delete("/reviews", authRequired, ownerOnly, async (req, res) => {
  const tenantId = req.user.tenant_id;
  const db = await dbPromise;
  await db.run("DELETE FROM reviews WHERE tenant_id = ?", [tenantId]);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API lista en http://localhost:${PORT}`);
});

