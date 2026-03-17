const STORAGE_KEY = "wisand.pos.session.v1";
const PREFS_PREFIX = "wisand.pos.prefs.";
const TECH_MODE_TENANT = "wisand";
const TECH_MODE_USERNAME = "wisand2927";

const DEFAULT_BRANDING = {
  tenant_code: "",
  display_name: "WISAND",
  logo_url: "",
  primary_color: "#0b63d0",
  secondary_color: "#0ea5e9",
  accent_color: "#f59e0b",
};

const DEFAULT_PREFS = {
  denseMode: false,
  enforceStock: false,
  openingCash: 0,
  closureStart: "00:00",
  closureEnd: "23:59",
  countedCash: 0,
};

const SHIFT_RANGES = {
  morning: { start: "06:00", end: "13:59" },
  afternoon: { start: "14:00", end: "21:59" },
  night: { start: "22:00", end: "05:59" },
  all: { start: "00:00", end: "23:59" },
};

const DEFAULT_CATEGORY_SUGGESTIONS = [
  "General",
  "Medicamentos",
  "Vitaminas",
  "Suplementos",
  "Aseo",
  "Ferreteria",
  "Minimarket",
];
const PENDING_ORDERS_POLL_MS = 15000;

const normalizeBaseUrl = (value = "") => String(value || "").trim().replace(/\/+$/, "");
const POS_BOOTSTRAP_CONFIG =
  typeof window !== "undefined" && window.__WISAND_POS_CONFIG
    ? window.__WISAND_POS_CONFIG
    : {};
const POS_DEFAULT_API_BASE = normalizeBaseUrl(POS_BOOTSTRAP_CONFIG.apiBase || "http://localhost:3001");

const state = {
  apiBase: POS_DEFAULT_API_BASE,
  tenantCode: "",
  token: "",
  user: null,
  backendIdentity: null,
  branding: { ...DEFAULT_BRANDING },
  prefs: { ...DEFAULT_PREFS },
  products: [],
  filteredProducts: [],
  cart: [],
  sales: [],
  salesLoaded: false,
  lastTicket: null,
  closureSummary: null,
  closureHistory: [],
  inactiveSummary: null,
  topSummary: null,
  criticalSummary: null,
  inventoryMovements: [],
  inventoryMovementsLoaded: false,
  quickCreateCode: "",
  quickModalMode: "create",
  quickEditProduct: null,
  scanProbe: {
    active: false,
    timeoutId: null,
  },
  pendingOrders: {
    intervalId: null,
    knownIds: [],
    currentOrders: [],
    firstPollDone: false,
    silenceUntil: 0,
    permissionRequested: false,
  },
};

const el = {
  brandName: document.getElementById("brand-name"),
  brandSubtitle: document.getElementById("brand-subtitle"),
  brandLogo: document.getElementById("brand-logo"),
  brandMonogram: document.getElementById("brand-monogram"),
  sessionUser: document.getElementById("session-user"),
  backendInstance: document.getElementById("backend-instance"),
  logoutBtn: document.getElementById("logout-btn"),

  loginView: document.getElementById("login-view"),
  posView: document.getElementById("pos-view"),

  loginForm: document.getElementById("login-form"),
  apiBase: document.getElementById("api-base"),
  tenantCode: document.getElementById("tenant-code"),
  username: document.getElementById("username"),
  password: document.getElementById("password"),
  apiCheckBtn: document.getElementById("api-check-btn"),
  loginBtn: document.getElementById("login-btn"),
  apiFeedback: document.getElementById("api-feedback"),
  loginFeedback: document.getElementById("login-feedback"),

  quickCreateModal: document.getElementById("quick-create-modal"),
  quickTitle: document.getElementById("quick-create-title"),
  quickForm: document.getElementById("quick-form"),
  quickCode: document.getElementById("quick-code"),
  quickName: document.getElementById("quick-name"),
  quickPriceCaja: document.getElementById("quick-price-caja"),
  quickPriceSobre: document.getElementById("quick-price-sobre"),
  quickPriceUnidad: document.getElementById("quick-price-unidad"),
  quickSobresCaja: document.getElementById("quick-sobres-caja"),
  quickUnidadesSobre: document.getElementById("quick-unidades-sobre"),
  quickStockCajas: document.getElementById("quick-stock-cajas"),
  quickCategory: document.getElementById("quick-category"),
  quickCategoryOptions: document.getElementById("quick-category-options"),
  quickFeedback: document.getElementById("quick-feedback"),
  quickCancelBtn: document.getElementById("quick-cancel-btn"),
  quickCloseBtn: document.getElementById("quick-close-btn"),
  quickSaveBtn: document.getElementById("quick-save-btn"),

  denseModeBtn: document.getElementById("dense-mode-btn"),
  productsTableWrap: document.getElementById("products-table-wrap"),
  productSearch: document.getElementById("product-search"),
  scanInput: document.getElementById("scan-input"),
  scannerTestTools: document.getElementById("scanner-test-tools"),
  scanTestBtn: document.getElementById("scan-test-btn"),
  scanTestFeedback: document.getElementById("scan-test-feedback"),
  refreshProductsBtn: document.getElementById("refresh-products-btn"),
  newProductBtn: document.getElementById("new-product-btn"),
  importCsvBtn: document.getElementById("import-csv-btn"),
  importCsvInput: document.getElementById("import-csv-input"),
  productsTableBody: document.getElementById("products-table-body"),

  cartItems: document.getElementById("cart-items"),
  cartCount: document.getElementById("cart-count"),
  cartTotal: document.getElementById("cart-total"),
  totalDisplay: document.getElementById("total-display"),
  enforceStock: document.getElementById("enforce-stock"),

  customerName: document.getElementById("customer-name"),
  customerPhone: document.getElementById("customer-phone"),
  paymentMethod: document.getElementById("payment-method"),
  transferProviderWrap: document.getElementById("transfer-provider-wrap"),
  transferProvider: document.getElementById("transfer-provider"),
  mixCashWrap: document.getElementById("mix-cash-wrap"),
  mixCashAmount: document.getElementById("mix-cash-amount"),
  mixTransferWrap: document.getElementById("mix-transfer-wrap"),
  mixTransferAmount: document.getElementById("mix-transfer-amount"),
  mixedPaymentFeedback: document.getElementById("mixed-payment-feedback"),

  clearCartBtn: document.getElementById("clear-cart-btn"),
  completeSaleBtn: document.getElementById("complete-sale-btn"),
  printA4Btn: document.getElementById("print-a4-btn"),
  printThermalBtn: document.getElementById("print-thermal-btn"),
  saleFeedback: document.getElementById("sale-feedback"),

  salesList: document.getElementById("sales-list"),
  refreshSalesBtn: document.getElementById("refresh-sales-btn"),
  pendingOrdersBanner: document.getElementById("pending-orders-banner"),
  pendingOrdersCount: document.getElementById("pending-orders-count"),
  pendingOrdersMeta: document.getElementById("pending-orders-meta"),
  pendingOrdersRefreshBtn: document.getElementById("pending-orders-refresh-btn"),
  pendingOrdersSilenceBtn: document.getElementById("pending-orders-silence-btn"),
  inactivePanel: document.getElementById("inactive-panel"),
  inactiveDays: document.getElementById("inactive-days"),
  refreshInactiveBtn: document.getElementById("refresh-inactive-btn"),
  inactiveList: document.getElementById("inactive-list"),
  topProductsList: document.getElementById("top-products-list"),
  criticalStockThreshold: document.getElementById("critical-stock-threshold"),
  criticalStockList: document.getElementById("critical-stock-list"),
  inventoryMovementType: document.getElementById("inventory-movement-type"),
  inventoryMovementSearch: document.getElementById("inventory-movement-search"),
  refreshInventoryMovementsBtn: document.getElementById("refresh-inventory-movements-btn"),
  inventoryMovementsList: document.getElementById("inventory-movements-list"),
  closureDate: document.getElementById("closure-date"),
  closureTodayBtn: document.getElementById("closure-today-btn"),
  refreshClosureBtn: document.getElementById("refresh-closure-btn"),
  closureSummary: document.getElementById("closure-summary"),
  saveClosureBtn: document.getElementById("save-closure-btn"),
  printClosureBtn: document.getElementById("print-closure-btn"),
  openingCash: document.getElementById("opening-cash"),
  closureStart: document.getElementById("closure-start"),
  closureEnd: document.getElementById("closure-end"),
  countedCash: document.getElementById("counted-cash"),
  exportClosureCsvBtn: document.getElementById("export-closure-csv-btn"),
  closureHistory: document.getElementById("closure-history"),
  shiftMorningBtn: document.getElementById("shift-morning-btn"),
  shiftAfternoonBtn: document.getElementById("shift-afternoon-btn"),
  shiftNightBtn: document.getElementById("shift-night-btn"),
  shiftAllBtn: document.getElementById("shift-all-btn"),
};

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function backendHostLabel(base) {
  const raw = String(base || "").trim();
  if (!raw) return "--";
  try {
    const parsed = new URL(raw);
    return parsed.host || raw;
  } catch {
    return raw;
  }
}

function shortInstanceId(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.slice(0, 8);
}

function applyBackendIdentity(identity) {
  state.backendIdentity = identity || null;
  if (!el.backendInstance) return;

  const base = String(identity?.base || state.apiBase || "").trim();
  const host = backendHostLabel(base);
  const instance = shortInstanceId(identity?.instance_id);
  const engine = String(identity?.db_engine || "").trim();

  let label = `Backend: ${host}`;
  if (instance) label += ` | inst ${instance}`;
  if (engine) label += ` | ${engine}`;
  if (identity?.error) label += " | sin respuesta";

  el.backendInstance.textContent = label;
  el.backendInstance.title = base || label;
}

async function refreshBackendIdentity() {
  const base = String(state.apiBase || el.apiBase?.value || "").trim().replace(/\/$/, "");
  if (!base) {
    applyBackendIdentity(null);
    return null;
  }

  try {
    const response = await fetch(`${base}/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const identity = {
      base,
      instance_id: String(payload?.instance_id || ""),
      started_at: String(payload?.started_at || ""),
      pid: Number(payload?.pid || 0) || 0,
      db_engine: String(payload?.db_engine || ""),
    };
    applyBackendIdentity(identity);
    return payload;
  } catch {
    applyBackendIdentity({ base, error: true });
    return null;
  }
}

function prefsKey(code) {
  const normalized = normalizeCode(code);
  return `${PREFS_PREFIX}${normalized || "default"}`;
}

function loadTenantPrefs(code) {
  const raw = localStorage.getItem(prefsKey(code));
  if (!raw) return { ...DEFAULT_PREFS };
  const parsed = safeJson(raw);
  const merged = {
    ...DEFAULT_PREFS,
    ...(parsed || {}),
  };
  merged.openingCash = Math.max(0, Number(merged.openingCash) || 0);
  merged.countedCash = Math.max(0, Number(merged.countedCash) || 0);
  merged.closureStart = /^\d{2}:\d{2}$/.test(String(merged.closureStart || ""))
    ? String(merged.closureStart)
    : "00:00";
  merged.closureEnd = /^\d{2}:\d{2}$/.test(String(merged.closureEnd || ""))
    ? String(merged.closureEnd)
    : "23:59";
  return merged;
}

function saveTenantPrefs() {
  if (!state.tenantCode) return;
  localStorage.setItem(prefsKey(state.tenantCode), JSON.stringify(state.prefs));
}

function applyTenantPrefsUi() {
  const dense = !!state.prefs.denseMode;
  const enforce = !!state.prefs.enforceStock;

  el.productsTableWrap.classList.toggle("dense", dense);
  el.denseModeBtn.textContent = `Vista densa: ${dense ? "ON" : "OFF"}`;
  el.enforceStock.checked = enforce;

  if (el.openingCash) {
    el.openingCash.value = String(Math.max(0, Number(state.prefs.openingCash) || 0));
  }
  if (el.countedCash) {
    el.countedCash.value = String(Math.max(0, Number(state.prefs.countedCash) || 0));
  }
  if (el.closureStart) {
    el.closureStart.value = String(state.prefs.closureStart || "00:00");
  }
  if (el.closureEnd) {
    el.closureEnd.value = String(state.prefs.closureEnd || "23:59");
  }
  renderShiftPresetState();
}

function focusScanInput() {
  if (el.posView.classList.contains("hidden")) return;
  setTimeout(() => {
    el.scanInput.focus();
    el.scanInput.select();
  }, 0);
}

function money(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function fmtDate(iso) {
  if (!iso) return "--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("es-CO");
}
function toDateInputValueLocal(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function saleTimestamp(sale) {
  const raw = sale?.fechaISO || sale?.createdAt || "";
  if (!raw) return 0;
  const ts = Date.parse(String(raw));
  return Number.isFinite(ts) ? ts : 0;
}

function saleDateKey(sale) {
  const ts = saleTimestamp(sale);
  if (!ts) return "";
  return toDateInputValueLocal(new Date(ts));
}

function normalizePaymentMethod(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!normalized) return "otros";
  if (normalized.includes("mixt")) return "mixto";
  if (normalized.includes("trans")) return "transferencia";
  if (normalized.includes("efect")) return "efectivo";
  if (normalized.includes("tarj") || normalized.includes("dat")) return "tarjeta";
  return "otros";
}

function normalizeTransferProvider(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("davi")) return "daviplata";
  return "nequi";
}

function transferProviderLabel(value) {
  return normalizeTransferProvider(value) === "daviplata" ? "Daviplata" : "Nequi";
}

function toNonNegativeNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function parseAmountFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/\s+/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function parseMixedPaymentDetail(methodText, saleTotal = 0) {
  const text = String(methodText || "");
  const providerMatch = text.match(/(nequi|daviplata)/i);
  const provider = normalizeTransferProvider(providerMatch ? providerMatch[1] : "nequi");

  const cashMatch = text.match(/efectivo[^0-9]*([0-9.,]+)/i);
  const transferMatch = text.match(/transferencia[^0-9]*([0-9.,]+)/i);

  let cash = parseAmountFromText(cashMatch ? cashMatch[1] : "0");
  let transfer = parseAmountFromText(transferMatch ? transferMatch[1] : "0");
  const total = Math.max(0, Number(saleTotal) || 0);

  if (cash <= 0 && transfer > 0 && total > 0) {
    cash = Math.max(0, total - transfer);
  } else if (transfer <= 0 && cash > 0 && total > 0) {
    transfer = Math.max(0, total - cash);
  }

  if (total > 0) {
    const sum = cash + transfer;
    if (sum > total) {
      const ratio = total / sum;
      cash *= ratio;
      transfer *= ratio;
    }
  }

  return {
    efectivo: cash,
    transferencia: transfer,
    provider,
  };
}

function buildSalePaymentMethod(total = 0) {
  const method = String(el.paymentMethod?.value || "efectivo").trim().toLowerCase();
  const providerLabel = transferProviderLabel(el.transferProvider?.value);

  if (method === "transferencia") {
    return `Transferencia - ${providerLabel}`;
  }

  if (method === "mixto") {
    const cash = toNonNegativeNumber(el.mixCashAmount?.value);
    const transfer = toNonNegativeNumber(el.mixTransferAmount?.value);
    const safeCash = formatQty(cash, 2);
    const safeTransfer = formatQty(transfer, 2);
    return `Mixto - Efectivo ${safeCash} + Transferencia ${providerLabel} ${safeTransfer}`;
  }

  if (method === "tarjeta") return "tarjeta";
  if (method === "efectivo") return "efectivo";
  return method || "efectivo";
}

function syncTransferProviderUi() {
  const method = String(el.paymentMethod?.value || "").trim().toLowerCase();
  const showTransferProvider = method === "transferencia" || method === "mixto";
  const isMixed = method === "mixto";

  if (el.transferProviderWrap) {
    el.transferProviderWrap.classList.toggle("hidden", !showTransferProvider);
  }
  if (el.mixCashWrap) {
    el.mixCashWrap.classList.toggle("hidden", !isMixed);
  }
  if (el.mixTransferWrap) {
    el.mixTransferWrap.classList.toggle("hidden", !isMixed);
  }

  if (showTransferProvider && el.transferProvider) {
    el.transferProvider.value = normalizeTransferProvider(el.transferProvider.value);
  }

  if (!isMixed) {
    if (el.mixCashAmount) el.mixCashAmount.value = "0";
    if (el.mixTransferAmount) el.mixTransferAmount.value = "0";
  }

  syncMixedPaymentBreakdown();
}

function syncMixedPaymentBreakdown(source = "") {
  if (!el.paymentMethod || !el.mixedPaymentFeedback) return;

  const method = String(el.paymentMethod.value || "").trim().toLowerCase();
  const isMixed = method === "mixto";

  if (!isMixed) {
    setFeedback(el.mixedPaymentFeedback, "", "");
    el.mixedPaymentFeedback.classList.add("hidden");
    return;
  }

  const total = Math.max(0, Number(cartTotals().total) || 0);
  let cash = toNonNegativeNumber(el.mixCashAmount?.value);
  let transfer = toNonNegativeNumber(el.mixTransferAmount?.value);

  if (source === "cash") {
    if (cash > total) cash = total;
    transfer = Math.max(0, total - cash);
  } else if (source === "transfer") {
    if (transfer > total) transfer = total;
    cash = Math.max(0, total - transfer);
  }

  if (el.mixCashAmount) el.mixCashAmount.value = formatQty(cash, 2);
  if (el.mixTransferAmount) el.mixTransferAmount.value = formatQty(transfer, 2);

  const provider = transferProviderLabel(el.transferProvider?.value);
  const diff = total - (cash + transfer);

  let message =
    "Total " +
    money(total) +
    " | Efectivo " +
    money(cash) +
    " | Transferencia (" +
    provider +
    ") " +
    money(transfer) +
    ".";
  let tone = "";

  if (total <= 0) {
    message = "Agrega productos al carrito para calcular el pago mixto.";
  } else if (cash <= 0 || transfer <= 0) {
    tone = "error";
    message += " En mixto debes definir ambos montos (efectivo y transferencia).";
  } else if (Math.abs(diff) > 0.01) {
    tone = "error";
    message += " Diferencia pendiente: " + money(diff) + ".";
  } else {
    tone = "success";
    message += " Cuadre correcto.";
  }

  setFeedback(el.mixedPaymentFeedback, message, tone);
  el.mixedPaymentFeedback.classList.remove("hidden");
}

function parseTimeToMinutes(value, fallback) {
  const raw = String(value || "").trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) return fallback;
  const parts = raw.split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return hour * 60 + minute;
}

function minuteOfDayFromTimestamp(ts) {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

function isMinuteInRange(minuteOfDay, startMinute, endMinute) {
  if (startMinute <= endMinute) {
    return minuteOfDay >= startMinute && minuteOfDay <= endMinute;
  }
  return minuteOfDay >= startMinute || minuteOfDay <= endMinute;
}

function activeShiftPreset() {
  const start = String(state.prefs.closureStart || "00:00");
  const end = String(state.prefs.closureEnd || "23:59");

  if (start === SHIFT_RANGES.morning.start && end === SHIFT_RANGES.morning.end) return "morning";
  if (start === SHIFT_RANGES.afternoon.start && end === SHIFT_RANGES.afternoon.end) return "afternoon";
  if (start === SHIFT_RANGES.night.start && end === SHIFT_RANGES.night.end) return "night";
  if (start === SHIFT_RANGES.all.start && end === SHIFT_RANGES.all.end) return "all";
  return "";
}

function renderShiftPresetState() {
  const active = activeShiftPreset();
  const mapping = [
    ["morning", el.shiftMorningBtn],
    ["afternoon", el.shiftAfternoonBtn],
    ["night", el.shiftNightBtn],
    ["all", el.shiftAllBtn],
  ];

  mapping.forEach(([key, button]) => {
    if (!button) return;
    const isActive = active === key;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function applyShiftRange(start, end) {
  const startValue = /^\d{2}:\d{2}$/.test(String(start || "")) ? String(start) : "00:00";
  const endValue = /^\d{2}:\d{2}$/.test(String(end || "")) ? String(end) : "23:59";

  state.prefs.closureStart = startValue;
  state.prefs.closureEnd = endValue;

  if (el.closureStart) el.closureStart.value = startValue;
  if (el.closureEnd) el.closureEnd.value = endValue;

  saveTenantPrefs();
  renderShiftPresetState();
  renderClosure();
  renderClosureHistory();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function productCode(product) {
  return String(product.externalId || product.id || "").trim();
}

function toPositiveInt(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function formatQty(value, maxDecimals = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(maxDecimals).replace(/\.?0+$/, "");
}

function normalizePresentation(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (["caja", "box", "boxes"].includes(value)) return "caja";
  if (["sobre", "sobres", "pack"].includes(value)) return "sobre";
  return "unidad";
}

function presentationLabel(raw) {
  const p = normalizePresentation(raw);
  if (p === "caja") return "Caja";
  if (p === "sobre") return "Sobre";
  return "Unidad";
}

function productUnitsPerCaja(product) {
  const sobres = toPositiveInt(product?.sobresXCaja, 1);
  const unidades = toPositiveInt(product?.unidadesXSobre, 1);
  return sobres * unidades;
}

function productStock(product) {
  return Math.max(0, Number(product?.stockCajas) || 0);
}

function productStockUnits(product) {
  return productStock(product) * productUnitsPerCaja(product);
}

function presentationUnits(product, rawPresentation) {
  const presentation = normalizePresentation(rawPresentation);
  if (presentation === "caja") return productUnitsPerCaja(product);
  if (presentation === "sobre") return toPositiveInt(product?.unidadesXSobre, 1);
  return 1;
}

function presentationPrice(product, rawPresentation) {
  const presentation = normalizePresentation(rawPresentation);
  const ofertaActiva = Number(product?.ofertaActiva) === 1 || product?.ofertaActiva === true;

  if (presentation === "caja") {
    const ofertaCaja = Number(product?.ofertaPrecioCaja) || 0;
    const baseCaja = Number(product?.precioCaja) || 0;
    return ofertaActiva && ofertaCaja > 0 ? ofertaCaja : baseCaja;
  }

  if (presentation === "sobre") {
    const ofertaSobre = Number(product?.ofertaPrecioSobre) || 0;
    const baseSobre = Number(product?.precioSobre) || 0;
    return ofertaActiva && ofertaSobre > 0 ? ofertaSobre : baseSobre;
  }

  return Number(product?.precioUnidad) || 0;
}

function presentationOptions(product) {
  const all = ["unidad", "sobre", "caja"];
  const options = all
    .map((value) => {
      const price = presentationPrice(product, value);
      return {
        value,
        label: presentationLabel(value),
        price,
      };
    })
    .filter((item) => item.price > 0);

  if (options.length) return options;

  const fallback = Number(product?.precioUnidad) || Number(product?.precioSobre) || Number(product?.precioCaja) || 0;
  return fallback > 0 ? [{ value: "unidad", label: "Unidad", price: fallback }] : [];
}

function defaultPresentation(product) {
  const options = presentationOptions(product);
  if (!options.length) return "unidad";
  const preferred = ["unidad", "sobre", "caja"];
  for (const key of preferred) {
    if (options.some((item) => item.value === key)) return key;
  }
  return options[0].value;
}

function availableQtyForPresentation(product, rawPresentation) {
  const perItemUnits = presentationUnits(product, rawPresentation);
  if (perItemUnits <= 0) return 0;
  return Math.floor(productStockUnits(product) / perItemUnits);
}

function productPrice(product) {
  const presentation = defaultPresentation(product);
  return presentationPrice(product, presentation);
}

function stockToneClass(stock) {
  if (stock <= 0) return "stock-zero";
  if (stock <= 3) return "stock-low";
  return "stock-ok";
}

function setFeedback(node, message, tone = "") {
  node.textContent = message || "";
  node.classList.remove("error", "success");
  if (tone === "error" || tone === "success") {
    node.classList.add(tone);
  }
}

function setBusy(button, busy, busyLabel, idleLabel) {
  button.disabled = busy;
  button.textContent = busy ? busyLabel : idleLabel;
}

function pendingOrderId(order) {
  const id = Number(order?.id);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function normalizePendingOrders(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => pendingOrderId(row) > 0)
    .sort((a, b) => pendingOrderId(a) - pendingOrderId(b));
}

function pendingOrderRef(order) {
  const externalId = String(order?.externalId || "").trim();
  if (externalId) return externalId;
  const id = pendingOrderId(order);
  return id > 0 ? `#${id}` : "#-";
}

function pendingOrderCustomer(order) {
  const customer = String(order?.clienteNombre || "").trim();
  return customer || "Cliente";
}

function pendingOrderSummary(order) {
  const customer = pendingOrderCustomer(order);
  const ref = pendingOrderRef(order);
  const total = money(Number(order?.total) || 0);
  return `${customer} - ${ref} - ${total}`;
}

function updatePendingOrdersKnownIds(orders) {
  state.pendingOrders.knownIds = orders
    .map((order) => pendingOrderId(order))
    .filter((id) => id > 0);
  state.pendingOrders.currentOrders = Array.isArray(orders) ? [...orders] : [];
}

function detectNewPendingOrders(orders) {
  const known = new Set(state.pendingOrders.knownIds);
  return orders.filter((order) => {
    const id = pendingOrderId(order);
    return id > 0 && !known.has(id);
  });
}

function maybeRequestBrowserNotificationPermission() {
  if (!("Notification" in window)) return;
  if (state.pendingOrders.permissionRequested) return;
  if (Notification.permission !== "default") return;

  state.pendingOrders.permissionRequested = true;
  Notification.requestPermission().catch(() => {});
}

function showBrowserPendingOrderNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const notice = new Notification(title, {
      body,
      tag: `wisand-pending-${state.tenantCode || "tenant"}`,
      renotify: true,
    });
    setTimeout(() => {
      notice.close();
    }, 7000);
  } catch {
    // Ignorar si el navegador bloquea esta notificacion.
  }
}

function playPendingOrderTone() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const beeps = [880, 1046, 880];

    beeps.forEach((freq, idx) => {
      const startAt = ctx.currentTime + idx * 0.17;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.13);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startAt);
      osc.stop(startAt + 0.14);
    });

    setTimeout(() => {
      void ctx.close();
    }, 900);
  } catch {
    // Ignorar errores de audio (browser policy/permisos).
  }
}

function renderPendingOrdersNotice(orders = []) {
  if (!el.pendingOrdersBanner || !el.pendingOrdersCount || !el.pendingOrdersMeta) return;

  const loggedIn = !!state.token && !!state.user;
  if (!loggedIn) {
    el.pendingOrdersBanner.classList.add("hidden");
    return;
  }

  el.pendingOrdersBanner.classList.remove("hidden");

  const count = orders.length;
  const silencedMs = state.pendingOrders.silenceUntil - Date.now();
  const silenced = silencedMs > 0;

  if (count <= 0) {
    el.pendingOrdersBanner.classList.remove("has-pending", "attention");
    el.pendingOrdersCount.textContent = "Sin domicilios pendientes";
    el.pendingOrdersMeta.textContent = "No hay pedidos pendientes por confirmar.";

    if (el.pendingOrdersSilenceBtn) {
      el.pendingOrdersSilenceBtn.disabled = true;
      el.pendingOrdersSilenceBtn.textContent = "Silenciar 5m";
    }
    return;
  }

  const latest = orders[orders.length - 1];
  el.pendingOrdersBanner.classList.add("has-pending");
  el.pendingOrdersCount.textContent = `${count} domicilio${count === 1 ? "" : "s"} pendiente${count === 1 ? "" : "s"}`;
  el.pendingOrdersMeta.textContent = `Ultimo: ${pendingOrderSummary(latest)}.`;

  if (el.pendingOrdersSilenceBtn) {
    if (silenced) {
      const remaining = Math.max(1, Math.ceil(silencedMs / 60000));
      el.pendingOrdersSilenceBtn.disabled = true;
      el.pendingOrdersSilenceBtn.textContent = `Silenciado ${remaining}m`;
    } else {
      el.pendingOrdersSilenceBtn.disabled = false;
      el.pendingOrdersSilenceBtn.textContent = "Silenciar 5m";
    }
  }
}

function notifyNewPendingOrders(newOrders, allOrders) {
  if (!newOrders.length) return;

  const count = newOrders.length;
  const latest = newOrders[newOrders.length - 1];
  const title = count === 1 ? "Nuevo domicilio pendiente" : `${count} domicilios pendientes nuevos`;
  const body = pendingOrderSummary(latest);

  if (Date.now() >= state.pendingOrders.silenceUntil) {
    playPendingOrderTone();
    showBrowserPendingOrderNotification(title, body);
  }

  if (el.pendingOrdersBanner) {
    el.pendingOrdersBanner.classList.add("attention");
    setTimeout(() => {
      if (el.pendingOrdersBanner) {
        el.pendingOrdersBanner.classList.remove("attention");
      }
    }, 1200);
  }

  setFeedback(
    el.saleFeedback,
    `${title}. Pendientes totales: ${allOrders.length}. Revisa y gestiona el domicilio.`,
    "success"
  );
}

async function pollPendingOrders(options = {}) {
  if (!state.token || !state.user) return;

  const manual = !!options.manual;

  try {
    const payload = await request("/orders?estado=pendiente");
    const orders = normalizePendingOrders(payload);
    const newOrders = state.pendingOrders.firstPollDone ? detectNewPendingOrders(orders) : [];

    renderPendingOrdersNotice(orders);

    if (state.pendingOrders.firstPollDone) {
      notifyNewPendingOrders(newOrders, orders);
    }

    updatePendingOrdersKnownIds(orders);
    state.pendingOrders.firstPollDone = true;

    if (manual) {
      setFeedback(
        el.saleFeedback,
        orders.length
          ? `Pedidos pendientes actualizados: ${orders.length}.`
          : "No hay pedidos pendientes.",
        "success"
      );
    }
  } catch (error) {
    if (manual) {
      setFeedback(el.saleFeedback, `No se pudo actualizar pedidos pendientes: ${error.message}`, "error");
    }
  }
}

async function startPendingOrdersMonitor() {
  stopPendingOrdersMonitor();

  if (!state.token || !state.user) return;

  maybeRequestBrowserNotificationPermission();
  await pollPendingOrders({ manual: false });

  state.pendingOrders.intervalId = setInterval(() => {
    void pollPendingOrders({ manual: false });
  }, PENDING_ORDERS_POLL_MS);
}

function stopPendingOrdersMonitor() {
  if (state.pendingOrders.intervalId) {
    clearInterval(state.pendingOrders.intervalId);
    state.pendingOrders.intervalId = null;
  }

  state.pendingOrders.knownIds = [];
  state.pendingOrders.currentOrders = [];
  state.pendingOrders.firstPollDone = false;
  state.pendingOrders.silenceUntil = 0;
  state.pendingOrders.permissionRequested = false;

  if (el.pendingOrdersBanner) {
    el.pendingOrdersBanner.classList.remove("attention", "has-pending");
  }
  if (el.pendingOrdersSilenceBtn) {
    el.pendingOrdersSilenceBtn.disabled = true;
    el.pendingOrdersSilenceBtn.textContent = "Silenciar 5m";
  }
  renderPendingOrdersNotice([]);
}

function silencePendingOrders(minutes = 5) {
  if (!state.token || !state.user) return;

  const safeMinutes = Math.max(1, Math.floor(Number(minutes) || 5));
  state.pendingOrders.silenceUntil = Date.now() + safeMinutes * 60 * 1000;

  renderPendingOrdersNotice(state.pendingOrders.currentOrders);

  setFeedback(el.saleFeedback, `Alertas de domicilios silenciadas por ${safeMinutes} minutos.`, "");
}

function persistSession() {
  const payload = {
    apiBase: state.apiBase,
    tenantCode: state.tenantCode,
    token: state.token,
    user: state.user,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function clearSessionStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

function applyBranding(branding) {
  const next = {
    ...DEFAULT_BRANDING,
    ...(branding || {}),
  };
  state.branding = next;

  document.documentElement.style.setProperty("--primary", next.primary_color || DEFAULT_BRANDING.primary_color);
  document.documentElement.style.setProperty("--secondary", next.secondary_color || DEFAULT_BRANDING.secondary_color);
  document.documentElement.style.setProperty("--accent", next.accent_color || DEFAULT_BRANDING.accent_color);

  el.brandName.textContent = next.display_name || "WISAND";
  el.brandSubtitle.textContent = state.tenantCode ? `POS Web - ${state.tenantCode}` : "POS Web para PC";

  if (next.logo_url) {
    el.brandLogo.src = next.logo_url;
    el.brandLogo.classList.remove("hidden");
    el.brandMonogram.classList.add("hidden");
  } else {
    el.brandLogo.src = "";
    el.brandLogo.classList.add("hidden");
    el.brandMonogram.classList.remove("hidden");
    el.brandMonogram.textContent = (next.display_name || "W").slice(0, 1).toUpperCase();
  }
}

async function request(path, options = {}) {
  const method = options.method || "GET";
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  if (state.tenantCode) {
    headers["X-Tenant-Code"] = state.tenantCode;
  }

  let response;
  try {
    response = await fetch(`${state.apiBase}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error(`No se pudo conectar con API (${state.apiBase}). Verifica backend y /health.`);
  }

  const text = await response.text();
  const data = text ? safeJson(text) : null;

  if (!response.ok) {
    const message = data && data.error ? data.error : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data;
}

async function loadBrandingByCode(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) {
    applyBranding(DEFAULT_BRANDING);
    return;
  }

  try {
    const response = await fetch(`${state.apiBase}/tenants/${encodeURIComponent(code)}/branding`);
    const payload = response.ok ? await response.json() : null;
    applyBranding(payload || { ...DEFAULT_BRANDING, tenant_code: code });
  } catch {
    applyBranding({ ...DEFAULT_BRANDING, tenant_code: code });
  }
}

function findProductByCode(code) {
  const normalized = String(code || "").trim();
  if (!normalized) return null;
  return state.products.find((product) => productCode(product) === normalized) || null;
}

function cartTotals() {
  const count = state.cart.reduce((acc, item) => acc + item.qty, 0);
  const total = state.cart.reduce((acc, item) => acc + item.qty * item.price, 0);
  return { count, total };
}

function renderTotals() {
  const totals = cartTotals();
  el.cartCount.textContent = String(totals.count);
  el.cartTotal.textContent = money(totals.total);
  el.totalDisplay.textContent = money(totals.total);
  syncMixedPaymentBreakdown();
}

function renderProducts() {
  const rows = state.filteredProducts;
  if (!rows.length) {
    el.productsTableBody.innerHTML = `<tr><td colspan="6" class="muted">Sin productos para mostrar.</td></tr>`;
    return;
  }

  el.productsTableBody.innerHTML = rows
    .map((product) => {
      const code = productCode(product);
      const defaultPrice = productPrice(product);
      const stockBoxes = productStock(product);
      const stockUnits = productStockUnits(product);
      const stockClass = stockToneClass(stockBoxes);
      const options = presentationOptions(product);
      const hasPrice = options.length > 0;
      const blockedStock = state.prefs.enforceStock && stockUnits <= 0;
      const disabled = !hasPrice || blockedStock;

      const selectedPresentation = defaultPresentation(product);
      const optionsHtml = hasPrice
        ? options
            .map((item) => {
              const selected = item.value === selectedPresentation ? "selected" : "";
              return `<option value="${item.value}" ${selected}>${item.label} (${money(item.price)})</option>`;
            })
            .join("")
        : `<option value="unidad">Sin precio</option>`;

      const stockMeta = `${formatQty(stockBoxes)} cj / ${formatQty(stockUnits)} und`;
      const addLabel = !hasPrice ? "Sin precio" : blockedStock ? "Sin stock" : "Agregar";

      return `
        <tr>
          <td>${escapeHtml(code || "--")}</td>
          <td>${escapeHtml(product.nombre || "Producto")}</td>
          <td>${escapeHtml(product.categoria || "--")}</td>
          <td>${money(defaultPrice)}</td>
          <td>
            <span class="stock-pill ${stockClass}">${formatQty(stockBoxes)} cj</span>
            <span class="stock-meta">${stockMeta}</span>
          </td>
          <td>
            <div class="row-actions">
              <select class="presentation-select" data-code="${escapeHtml(code)}" ${hasPrice ? "" : "disabled"}>
                ${optionsHtml}
              </select>
              <button class="btn ghost add-product-btn" data-code="${escapeHtml(code)}" ${disabled ? "disabled" : ""}>
                ${addLabel}
              </button>
              ${
                isOwnerSession()
                  ? `<button class="btn ghost adjust-stock-btn" data-id="${Number(product.id) || ""}" data-code="${escapeHtml(code)}">Ajuste stock</button><button class="btn ghost edit-product-btn" data-id="${Number(product.id) || ""}" data-code="${escapeHtml(code)}">Editar</button><button class="btn ghost danger remove-product-btn" data-id="${Number(product.id) || ""}" data-code="${escapeHtml(code)}">Eliminar</button>`
                  : ""
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderCart() {
  if (!state.cart.length) {
    el.cartItems.innerHTML = `<p class="muted" style="padding:10px;">Escanea o agrega productos para iniciar la venta.</p>`;
    renderTotals();
    return;
  }

  el.cartItems.innerHTML = `
    <table class="cart-table">
      <thead>
        <tr>
          <th>Producto</th>
          <th>Cant</th>
          <th>Unit</th>
          <th>Subtotal</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${state.cart
          .map((item) => {
            const subtotal = item.qty * item.price;
            const product = findProductByCode(item.code);
            const presentation = normalizePresentation(item.presentation);
            const presentationText = presentationLabel(presentation);
            const stockHint = product
              ? ` - disp ${availableQtyForPresentation(product, presentation)} ${presentationText.toLowerCase()}(s)`
              : "";
            const cannotIncrease = product
              ? state.prefs.enforceStock &&
                !canIncreaseQty(product, presentation, item.qty + 1, item.key, { silent: true })
              : false;

            return `
              <tr>
                <td>
                  <strong>${escapeHtml(item.name)}</strong><br />
                  <span class="muted">${escapeHtml(item.code)} - ${escapeHtml(presentationText)}${state.prefs.enforceStock ? stockHint : ""}</span>
                </td>
                <td>
                  <div class="qty-row">
                    <button type="button" class="qty-btn" data-action="dec" data-key="${escapeHtml(item.key)}">-</button>
                    <strong>${item.qty}</strong>
                    <button type="button" class="qty-btn" data-action="inc" data-key="${escapeHtml(item.key)}" ${cannotIncrease ? "disabled" : ""}>+</button>
                  </div>
                </td>
                <td>${money(item.price)}</td>
                <td>${money(subtotal)}</td>
                <td>
                  <button type="button" class="btn ghost" data-action="remove" data-key="${escapeHtml(item.key)}">Quitar</button>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;

  renderTotals();
}

function renderSales() {
  if (!state.sales.length) {
    el.salesList.innerHTML = `<li><span class="muted">Sin ventas registradas.</span></li>`;
    return;
  }

  el.salesList.innerHTML = state.sales
    .slice(0, 12)
    .map((sale) => {
      const ref = sale.refId || `#${sale.id}`;
      return `
        <li>
          <span class="sales-ref">${escapeHtml(ref)}</span>
          <span>${money(sale.total)}</span>
          <span class="sales-meta">${fmtDate(sale.fechaISO || sale.createdAt)}</span>
        </li>
      `;
    })
    .join("");
}

function normalizeInactiveDays(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(365, Math.max(7, Math.floor(parsed)));
}

function canonicalProductRef(raw) {
  return String(raw || "").trim().toLowerCase();
}

function extractSaleItemRefs(item) {
  const refs = new Set();
  const code = canonicalProductRef(item?.code);
  const externalId = canonicalProductRef(item?.externalId);
  const id = canonicalProductRef(item?.id);
  if (code) refs.add(code);
  if (externalId) refs.add(externalId);
  if (id) refs.add(id);
  return Array.from(refs);
}

function extractProductRefs(product) {
  const refs = new Set();
  const code = canonicalProductRef(productCode(product));
  const externalId = canonicalProductRef(product?.externalId);
  const id = canonicalProductRef(product?.id);
  if (code) refs.add(code);
  if (externalId) refs.add(externalId);
  if (id) refs.add(id);
  return Array.from(refs);
}

function buildInactiveProductsSummary(rawDays = 30) {
  const days = normalizeInactiveDays(rawDays);
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const cutoff = now - days * dayMs;
  const lastSaleByRef = new Map();

  state.sales.forEach((sale) => {
    const ts = saleTimestamp(sale);
    if (!ts) return;

    const items = Array.isArray(sale?.items) ? sale.items : [];
    items.forEach((item) => {
      extractSaleItemRefs(item).forEach((ref) => {
        const previous = lastSaleByRef.get(ref) || 0;
        if (ts > previous) {
          lastSaleByRef.set(ref, ts);
        }
      });
    });
  });

  const rows = [];

  state.products.forEach((product) => {
    if (productStock(product) <= 0) return;

    const refs = extractProductRefs(product);
    let lastSoldAt = 0;

    refs.forEach((ref) => {
      const ts = lastSaleByRef.get(ref) || 0;
      if (ts > lastSoldAt) {
        lastSoldAt = ts;
      }
    });

    if (lastSoldAt >= cutoff) return;

    const idleDays = lastSoldAt ? Math.floor((now - lastSoldAt) / dayMs) : null;

    rows.push({
      product,
      lastSoldAt,
      idleDays,
    });
  });

  rows.sort((a, b) => {
    if (!a.lastSoldAt && b.lastSoldAt) return -1;
    if (a.lastSoldAt && !b.lastSoldAt) return 1;
    if (!a.lastSoldAt && !b.lastSoldAt) {
      return String(a.product?.nombre || "").localeCompare(String(b.product?.nombre || ""), "es");
    }
    return a.lastSoldAt - b.lastSoldAt;
  });

  return {
    days,
    total: rows.length,
    rows,
  };
}

function renderInactiveProducts() {
  if (!el.inactiveList || !el.inactiveDays) return;

  const days = normalizeInactiveDays(el.inactiveDays.value || 30);
  el.inactiveDays.value = String(days);

  if (!state.products.length) {
    el.inactiveList.innerHTML = `<li class="inactive-empty">Carga catalogo para calcular rotacion.</li>`;
    return;
  }

  if (!state.salesLoaded) {
    el.inactiveList.innerHTML = `<li class="inactive-empty">Cargando ventas para calcular rotacion...</li>`;
    return;
  }

  const summary = buildInactiveProductsSummary(days);
  state.inactiveSummary = summary;

  if (!summary.total) {
    el.inactiveList.innerHTML = `<li class="inactive-empty">No hay productos con mas de ${summary.days} dias sin venta (con stock mayor a 0).</li>`;
    return;
  }

  const limit = 15;
  const itemsHtml = summary.rows
    .slice(0, limit)
    .map((row) => {
      const product = row.product;
      const code = productCode(product);
      const stockBoxes = formatQty(productStock(product), 2);
      const idleLabel = row.lastSoldAt ? `${row.idleDays} dias sin venta` : "Nunca vendido";
      const lastSaleLabel = row.lastSoldAt ? `Ult venta: ${fmtDate(new Date(row.lastSoldAt).toISOString())}` : "Ult venta: --";

      return `
        <li class="inactive-item">
          <div class="inactive-main">
            <strong>${escapeHtml(product.nombre || "Producto")}</strong>
            <span class="sales-meta">${escapeHtml(code)} - Stock ${escapeHtml(stockBoxes)} caja(s)</span>
          </div>
          <div class="inactive-meta">
            <span class="inactive-pill">${escapeHtml(idleLabel)}</span>
            <span class="sales-meta">${escapeHtml(lastSaleLabel)}</span>
          </div>
        </li>
      `;
    })
    .join("");

  const moreHtml =
    summary.total > limit
      ? `<li class="inactive-more">Mostrando ${limit} de ${summary.total} productos.</li>`
      : "";

  el.inactiveList.innerHTML = `${itemsHtml}${moreHtml}`;
}

function normalizeCriticalStockThreshold(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return 2;
  return Math.min(9999, Math.max(0, Math.floor(parsed)));
}

function saleItemQty(item) {
  return Math.max(0, Number(item?.cantidad ?? item?.qty ?? item?.quantity ?? 0) || 0);
}

function saleItemSubtotal(item) {
  const subtotalRaw = Number(item?.subtotal ?? item?.subTotal ?? item?.total);
  if (Number.isFinite(subtotalRaw) && subtotalRaw > 0) {
    return subtotalRaw;
  }

  const qty = saleItemQty(item);
  const unit = Number(item?.precio ?? item?.price ?? item?.unitPrice ?? 0) || 0;
  return qty * unit;
}

function buildProductRefIndex() {
  const index = new Map();
  state.products.forEach((product) => {
    extractProductRefs(product).forEach((ref) => {
      if (!ref) return;
      if (!index.has(ref)) {
        index.set(ref, product);
      }
    });
  });
  return index;
}

function buildTopProductsSummary(rawDays = 30) {
  const days = normalizeInactiveDays(rawDays);
  const dayMs = 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - days * dayMs;
  const byKey = new Map();
  const productRefIndex = buildProductRefIndex();

  state.sales.forEach((sale) => {
    const ts = saleTimestamp(sale);
    if (!ts || ts < cutoff) return;

    const items = Array.isArray(sale?.items) ? sale.items : [];
    items.forEach((item) => {
      const qty = saleItemQty(item);
      if (qty <= 0) return;

      const refs = extractSaleItemRefs(item);
      const bestRef = refs.find((ref) => productRefIndex.has(ref)) || refs[0] || "";
      const product = bestRef ? productRefIndex.get(bestRef) || null : null;

      const fallbackName = String(item?.nombre || item?.name || "").trim();
      const key = bestRef || (fallbackName ? `name:${canonicalProductRef(fallbackName)}` : "");
      if (!key) return;

      const displayName = product?.nombre || fallbackName || "Producto";
      const displayCode = product ? productCode(product) : String(item?.code || item?.id || "").trim();
      const subtotal = saleItemSubtotal(item);

      const existing = byKey.get(key) || {
        key,
        ref: bestRef,
        name: displayName,
        code: displayCode,
        qty: 0,
        total: 0,
        sales: 0,
      };

      existing.qty += qty;
      existing.total += subtotal;
      existing.sales += 1;

      if (!existing.name && displayName) existing.name = displayName;
      if (!existing.code && displayCode) existing.code = displayCode;

      byKey.set(key, existing);
    });
  });

  const rows = Array.from(byKey.values()).sort((a, b) => {
    const qtyDiff = b.qty - a.qty;
    if (qtyDiff) return qtyDiff;

    const totalDiff = b.total - a.total;
    if (totalDiff) return totalDiff;

    return String(a.name || "").localeCompare(String(b.name || ""), "es");
  });

  return {
    days,
    total: rows.length,
    rows,
  };
}

function renderTopProducts() {
  if (!el.topProductsList || !el.inactiveDays) return;

  const days = normalizeInactiveDays(el.inactiveDays.value || 30);

  if (!state.salesLoaded) {
    el.topProductsList.innerHTML = `<li class="insight-empty">Cargando ventas para top vendidos...</li>`;
    return;
  }

  const summary = buildTopProductsSummary(days);
  state.topSummary = summary;

  if (!summary.total) {
    el.topProductsList.innerHTML = `<li class="insight-empty">Sin ventas en los ultimos ${summary.days} dias.</li>`;
    return;
  }

  const limit = 10;
  const itemsHtml = summary.rows
    .slice(0, limit)
    .map((row) => {
      return `
        <li class="insight-item">
          <div class="insight-row">
            <strong>${escapeHtml(row.name || "Producto")}</strong>
            <span class="insight-pill">${escapeHtml(formatQty(row.qty, 2))} und</span>
          </div>
          <div class="insight-row">
            <span class="sales-meta">${escapeHtml(row.code || "--")}</span>
            <span class="sales-meta">${money(row.total)}</span>
          </div>
        </li>
      `;
    })
    .join("");

  const moreHtml =
    summary.total > limit
      ? `<li class="insight-more">Mostrando ${limit} de ${summary.total} productos.</li>`
      : "";

  el.topProductsList.innerHTML = `${itemsHtml}${moreHtml}`;
}

function buildCriticalStockSummary(rawThreshold = 2) {
  const threshold = normalizeCriticalStockThreshold(rawThreshold);

  const rows = state.products
    .filter((product) => productStock(product) <= threshold)
    .sort((a, b) => {
      const stockDiff = productStock(a) - productStock(b);
      if (stockDiff !== 0) return stockDiff;
      return String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es");
    });

  return {
    threshold,
    total: rows.length,
    rows,
  };
}

function renderCriticalStock() {
  if (!el.criticalStockList || !el.criticalStockThreshold) return;

  if (!state.products.length) {
    el.criticalStockList.innerHTML = `<li class="insight-empty">Carga catalogo para evaluar stock critico.</li>`;
    return;
  }

  const threshold = normalizeCriticalStockThreshold(el.criticalStockThreshold.value);
  el.criticalStockThreshold.value = String(threshold);

  const summary = buildCriticalStockSummary(threshold);
  state.criticalSummary = summary;

  if (!summary.total) {
    el.criticalStockList.innerHTML = `<li class="insight-empty">Sin productos con stock <= ${summary.threshold} cajas.</li>`;
    return;
  }

  const limit = 15;
  const itemsHtml = summary.rows
    .slice(0, limit)
    .map((product) => {
      const code = productCode(product);
      const stockBoxes = formatQty(productStock(product), 2);
      const stockUnits = formatQty(productStockUnits(product), 2);

      return `
        <li class="insight-item">
          <div class="insight-row">
            <strong>${escapeHtml(product.nombre || "Producto")}</strong>
            <span class="insight-pill critical">${escapeHtml(stockBoxes)} caja(s)</span>
          </div>
          <div class="insight-row">
            <span class="sales-meta">${escapeHtml(code)}</span>
            <span class="sales-meta">${escapeHtml(stockUnits)} und aprox.</span>
          </div>
        </li>
      `;
    })
    .join("");

  const moreHtml =
    summary.total > limit
      ? `<li class="insight-more">Mostrando ${limit} de ${summary.total} productos.</li>`
      : "";

  el.criticalStockList.innerHTML = `${itemsHtml}${moreHtml}`;
}

function normalizeMovementTypeFilter(rawValue) {
  const value = String(rawValue || "")
    .trim()
    .toLowerCase();
  if (value === "entrada" || value === "salida" || value === "ajuste") return value;
  return "";
}

function movementTypeLabel(rawValue) {
  const value = normalizeMovementTypeFilter(rawValue);
  if (value === "entrada") return "Entrada";
  if (value === "salida") return "Salida";
  if (value === "ajuste") return "Ajuste";
  return "Movimiento";
}

function movementSearchText(row) {
  return [row?.product_nombre, row?.product_external_id, row?.ref_id, row?.reason, row?.user_name]
    .map((item) => String(item || "").toLowerCase())
    .join(" ");
}

function renderInventoryMovements() {
  if (!el.inventoryMovementsList || !el.inventoryMovementType || !el.inventoryMovementSearch) return;

  if (!isOwnerSession()) {
    el.inventoryMovementsList.innerHTML = `<li class="insight-empty">Disponible para owner.</li>`;
    return;
  }

  if (!state.inventoryMovementsLoaded) {
    el.inventoryMovementsList.innerHTML = `<li class="insight-empty">Cargando movimientos...</li>`;
    return;
  }

  const selectedType = normalizeMovementTypeFilter(el.inventoryMovementType.value);
  const search = String(el.inventoryMovementSearch.value || "").trim().toLowerCase();

  const rows = state.inventoryMovements.filter((row) => {
    const rowType = normalizeMovementTypeFilter(row?.movement_type) || "ajuste";
    if (selectedType && rowType !== selectedType) return false;
    if (search && !movementSearchText(row).includes(search)) return false;
    return true;
  });

  if (!rows.length) {
    let empty = "Sin movimientos registrados.";
    if (search) empty = "Sin resultados para ese filtro.";
    else if (selectedType) empty = `Sin movimientos de tipo ${movementTypeLabel(selectedType).toLowerCase()}.`;
    el.inventoryMovementsList.innerHTML = `<li class="insight-empty">${escapeHtml(empty)}</li>`;
    return;
  }

  const limit = 30;
  const itemsHtml = rows
    .slice(0, limit)
    .map((row) => {
      const type = normalizeMovementTypeFilter(row?.movement_type) || "ajuste";
      const deltaBoxes = Number(row?.delta_boxes) || 0;
      const deltaLabel = `${deltaBoxes > 0 ? "+" : ""}${formatQty(deltaBoxes, 4)} caja(s)`;
      const stockBefore = formatQty(Number(row?.stock_before) || 0, 4);
      const stockAfter = formatQty(Number(row?.stock_after) || 0, 4);
      const productName = String(row?.product_nombre || "Producto");
      const code = String(row?.product_external_id || "--");
      const reason = String(row?.reason || row?.ref_type || "sin detalle");
      const actor = String(row?.user_name || "sistema");
      const createdAt = fmtDate(row?.created_at);
      const refId = String(row?.ref_id || "");

      return `
        <li class="movement-item">
          <div class="movement-row">
            <strong>${escapeHtml(productName)}</strong>
            <span class="movement-pill ${type}">${escapeHtml(movementTypeLabel(type))}</span>
          </div>
          <div class="movement-row">
            <span class="movement-meta">${escapeHtml(code)} - ${escapeHtml(reason)}</span>
            <strong>${escapeHtml(deltaLabel)}</strong>
          </div>
          <div class="movement-row">
            <span class="movement-meta">${escapeHtml(stockBefore)} -> ${escapeHtml(stockAfter)} cajas</span>
            <span class="movement-meta">${escapeHtml(actor)}</span>
          </div>
          <div class="movement-row">
            <span class="movement-meta">${escapeHtml(createdAt)}</span>
            <span class="movement-meta">${escapeHtml(refId ? `Ref: ${refId}` : "")}</span>
          </div>
        </li>
      `;
    })
    .join("");

  const moreHtml =
    rows.length > limit
      ? `<li class="insight-more">Mostrando ${limit} de ${rows.length} movimientos.</li>`
      : "";

  el.inventoryMovementsList.innerHTML = `${itemsHtml}${moreHtml}`;
}

function renderOwnerInsights() {
  renderInactiveProducts();
  renderTopProducts();
  renderCriticalStock();
  renderInventoryMovements();
}

function buildClosureSummary(dateKey) {
  const selectedDate = String(dateKey || "").trim() || toDateInputValueLocal();
  const startTime = String(state.prefs.closureStart || "00:00");
  const endTime = String(state.prefs.closureEnd || "23:59");
  const startMinute = parseTimeToMinutes(startTime, 0);
  const endMinute = parseTimeToMinutes(endTime, 23 * 60 + 59);

  const filtered = state.sales.filter((sale) => {
    if (saleDateKey(sale) !== selectedDate) return false;
    const ts = saleTimestamp(sale);
    if (!ts) return false;
    const minute = minuteOfDayFromTimestamp(ts);
    return isMinuteInRange(minute, startMinute, endMinute);
  });

  const methods = {
    efectivo: 0,
    transferencia: 0,
    tarjeta: 0,
    mixto: 0,
    otros: 0,
  };

  const details = [];
  let total = 0;
  let itemsCount = 0;
  let firstTs = 0;
  let lastTs = 0;

  filtered.forEach((sale) => {
    const saleTotal = Number(sale?.total) || 0;
    total += saleTotal;

    const methodRaw = String(sale?.metodoPago || sale?.metodopago || "").trim();
    const methodKey = normalizePaymentMethod(methodRaw);

    if (methodKey === "mixto") {
      methods.mixto += saleTotal;
      const mixedDetail = parseMixedPaymentDetail(methodRaw, saleTotal);
      methods.efectivo += mixedDetail.efectivo;
      methods.transferencia += mixedDetail.transferencia;
    } else {
      methods[methodKey] += saleTotal;
    }

    const items = Array.isArray(sale?.items) ? sale.items : [];
    const saleItems = items.reduce((acc, item) => {
      const qty = Number(item?.cantidad ?? item?.qty ?? item?.quantity ?? 0) || 0;
      return acc + Math.max(0, qty);
    }, 0);
    itemsCount += saleItems;

    const ts = saleTimestamp(sale);
    if (ts > 0) {
      if (!firstTs || ts < firstTs) firstTs = ts;
      if (!lastTs || ts > lastTs) lastTs = ts;
    }

    details.push({
      ref: String(sale?.refId || `#${sale?.id || ""}`),
      fecha: ts ? new Date(ts).toISOString() : "",
      metodo: methodRaw || methodKey,
      cliente: String(sale?.clienteNombre || ""),
      telefono: String(sale?.clienteTelefono || ""),
      total: saleTotal,
      items: saleItems,
    });
  });

  const openingCash = Math.max(0, Number(state.prefs.openingCash) || 0);
  const countedCash = Math.max(0, Number(state.prefs.countedCash) || 0);
  const expectedCash = openingCash + methods.efectivo;
  const cashDiff = countedCash - expectedCash;

  return {
    dateKey: selectedDate,
    startTime,
    endTime,
    salesCount: filtered.length,
    itemsCount,
    total,
    methods,
    openingCash,
    countedCash,
    expectedCash,
    cashDiff,
    firstAt: firstTs ? new Date(firstTs).toISOString() : "",
    lastAt: lastTs ? new Date(lastTs).toISOString() : "",
    details,
  };
}

function renderClosure() {
  if (!el.closureDate || !el.closureSummary || !el.saveClosureBtn || !el.printClosureBtn || !el.exportClosureCsvBtn) return;

  if (!el.closureDate.value) {
    el.closureDate.value = toDateInputValueLocal();
  }

  const summary = buildClosureSummary(el.closureDate.value);
  state.closureSummary = summary;

  const diffTone = summary.cashDiff > 0 ? "good" : summary.cashDiff < 0 ? "bad" : "neutral";
  el.saveClosureBtn.disabled = false;
  const diffSign = summary.cashDiff > 0 ? "+" : "";

  if (!summary.salesCount) {
    el.closureSummary.innerHTML = `
      <div class="closure-row"><span class="closure-label">Rango</span><span class="closure-value">${summary.startTime} - ${summary.endTime}</span></div>
      <div class="closure-row"><span class="closure-label">Caja inicial</span><span class="closure-value">${money(summary.openingCash)}</span></div>
      <div class="closure-row"><span class="closure-label">Efectivo real contado</span><span class="closure-value">${money(summary.countedCash)}</span></div>
      <div class="closure-row"><span class="closure-label">Efectivo esperado</span><span class="closure-value">${money(summary.expectedCash)}</span></div>
      <div class="closure-row"><span class="closure-label">Diferencia arqueo</span><span class="closure-value ${diffTone}">${diffSign}${money(summary.cashDiff)}</span></div>
      <p class="muted" style="margin:6px 0 0;">Sin ventas para la fecha/rango seleccionados.</p>
    `;
    el.printClosureBtn.disabled = true;
    el.exportClosureCsvBtn.disabled = true;
    return;
  }

  el.printClosureBtn.disabled = false;
  el.exportClosureCsvBtn.disabled = false;
  el.closureSummary.innerHTML = `
    <div class="closure-row"><span class="closure-label">Rango</span><span class="closure-value">${summary.startTime} - ${summary.endTime}</span></div>
    <div class="closure-row"><span class="closure-label">Ventas</span><span class="closure-value">${summary.salesCount}</span></div>
    <div class="closure-row"><span class="closure-label">Items vendidos</span><span class="closure-value">${summary.itemsCount}</span></div>
    <div class="closure-row"><span class="closure-label">Total</span><span class="closure-value">${money(summary.total)}</span></div>
    <div class="closure-row"><span class="closure-label">Caja inicial</span><span class="closure-value">${money(summary.openingCash)}</span></div>
    <div class="closure-row"><span class="closure-label">Efectivo</span><span class="closure-value">${money(summary.methods.efectivo)}</span></div>
    <div class="closure-row"><span class="closure-label">Efectivo esperado</span><span class="closure-value">${money(summary.expectedCash)}</span></div>
    <div class="closure-row"><span class="closure-label">Efectivo real contado</span><span class="closure-value">${money(summary.countedCash)}</span></div>
    <div class="closure-row"><span class="closure-label">Diferencia arqueo</span><span class="closure-value ${diffTone}">${diffSign}${money(summary.cashDiff)}</span></div>
    <div class="closure-row"><span class="closure-label">Transferencia</span><span class="closure-value">${money(summary.methods.transferencia)}</span></div>
    <div class="closure-row"><span class="closure-label">Tarjeta</span><span class="closure-value">${money(summary.methods.tarjeta)}</span></div>
    <div class="closure-row"><span class="closure-label">Mixto</span><span class="closure-value">${money(summary.methods.mixto)}</span></div>
    <div class="closure-row"><span class="closure-label">Otros</span><span class="closure-value">${money(summary.methods.otros)}</span></div>
    <div class="closure-row"><span class="closure-label">Primera venta</span><span class="closure-value">${summary.firstAt ? fmtDate(summary.firstAt) : "--"}</span></div>
    <div class="closure-row"><span class="closure-label">Ultima venta</span><span class="closure-value">${summary.lastAt ? fmtDate(summary.lastAt) : "--"}</span></div>
  `;
}

function renderClosureHistory() {
  if (!el.closureHistory) return;

  if (!state.closureHistory.length) {
    el.closureHistory.innerHTML = `<p class="muted" style="margin:0;">Sin cierres guardados.</p>`;
    return;
  }

  el.closureHistory.innerHTML = state.closureHistory
    .slice(0, 8)
    .map((closure) => {
      const diff = Number(closure.cash_diff) || 0;
      const diffSign = diff > 0 ? "+" : "";
      return `
        <div class="closure-history-item">
          <div class="top">
            <span>${escapeHtml(closure.date_key || "--")} ${escapeHtml(closure.start_time || "00:00")}-${escapeHtml(closure.end_time || "23:59")}</span>
            <span>${money(closure.total_sales)}</span>
          </div>
          <div class="meta">Arqueo: ${diffSign}${money(diff)} | ${escapeHtml(closure.created_by_username || "-")}</div>
          <div class="meta">${closure.created_at ? escapeHtml(fmtDate(closure.created_at)) : ""}</div>
        </div>
      `;
    })
    .join("");
}

async function loadClosureHistory() {
  const payload = await request("/closures?limit=8");
  state.closureHistory = Array.isArray(payload) ? payload : [];
  renderClosureHistory();
}

async function saveClosure() {
  const summary = state.closureSummary;
  if (!summary || !el.saveClosureBtn) {
    setFeedback(el.saleFeedback, "No hay cierre para guardar.", "error");
    return;
  }

  setBusy(el.saveClosureBtn, true, "Guardando...", "Guardar cierre");

  try {
    await request("/closures", {
      method: "POST",
      body: {
        date_key: summary.dateKey,
        start_time: summary.startTime,
        end_time: summary.endTime,
        opening_cash: summary.openingCash,
        counted_cash: summary.countedCash,
        total_sales: summary.total,
        sales_count: summary.salesCount,
        items_count: summary.itemsCount,
        methods: summary.methods,
      },
    });

    await loadClosureHistory();
    setFeedback(el.saleFeedback, "Cierre guardado en historial.", "success");
  } catch (error) {
    setFeedback(el.saleFeedback, `No se pudo guardar cierre: ${error.message}`, "error");
  } finally {
    setBusy(el.saveClosureBtn, false, "Guardando...", "Guardar cierre");
  }
}

function toCsvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function exportClosureCsv() {
  const summary = state.closureSummary;
  if (!summary || !summary.salesCount) {
    setFeedback(el.saleFeedback, "No hay ventas para exportar en esa fecha.", "error");
    return;
  }

  const rows = [
    ["fecha_cierre", summary.dateKey],
    ["hora_desde", summary.startTime],
    ["hora_hasta", summary.endTime],
    ["tenant", state.tenantCode],
    ["usuario", state.user?.username || ""],
    ["ventas", summary.salesCount],
    ["items_vendidos", summary.itemsCount],
    ["total", summary.total],
    ["caja_inicial", summary.openingCash],
    ["efectivo", summary.methods.efectivo],
    ["efectivo_esperado", summary.expectedCash],
    ["efectivo_real", summary.countedCash],
    ["diferencia_arqueo", summary.cashDiff],
    ["transferencia", summary.methods.transferencia],
    ["tarjeta", summary.methods.tarjeta],
    ["mixto", summary.methods.mixto],
    ["otros", summary.methods.otros],
    [],
    ["ref", "fecha", "metodo", "cliente", "telefono", "items", "total"],
    ...summary.details.map((sale) => [
      sale.ref,
      sale.fecha ? fmtDate(sale.fecha) : "",
      sale.metodo,
      sale.cliente,
      sale.telefono,
      sale.items,
      sale.total,
    ]),
  ];

  const csv = rows.map((row) => row.map(toCsvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `cierre-${state.tenantCode || "tenant"}-${summary.dateKey}-${summary.startTime.replace(':', '')}-${summary.endTime.replace(':', '')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function closureReportHtml(summary) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Cierre ${escapeHtml(summary.dateKey)}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { margin: 0; font-family: Arial, sans-serif; color: #111; }
          .wrap { max-width: 740px; margin: 0 auto; }
          h2 { margin: 0 0 6px; }
          .meta { color: #555; font-size: 12px; margin: 2px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; font-size: 12px; }
          th { text-align: left; background: #f5f5f5; }
          td:last-child { text-align: right; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h2>${escapeHtml(state.branding.display_name || "WISAND")} - Cierre de caja</h2>
          <p class="meta">Fecha: ${escapeHtml(summary.dateKey)}</p>
          <p class="meta">Rango: ${escapeHtml(summary.startTime)} - ${escapeHtml(summary.endTime)}</p>
          <p class="meta">Usuario: ${escapeHtml(state.user?.username || "--")}</p>
          <table>
            <thead>
              <tr><th>Concepto</th><th>Valor</th></tr>
            </thead>
            <tbody>
              <tr><td>Ventas</td><td>${summary.salesCount}</td></tr>
              <tr><td>Items vendidos</td><td>${summary.itemsCount}</td></tr>
              <tr><td>Total</td><td>${money(summary.total)}</td></tr>
              <tr><td>Caja inicial</td><td>${money(summary.openingCash)}</td></tr>
              <tr><td>Efectivo</td><td>${money(summary.methods.efectivo)}</td></tr>
              <tr><td>Efectivo esperado</td><td>${money(summary.expectedCash)}</td></tr>
              <tr><td>Efectivo real contado</td><td>${money(summary.countedCash)}</td></tr>
              <tr><td>Diferencia arqueo</td><td>${money(summary.cashDiff)}</td></tr>
              <tr><td>Transferencia</td><td>${money(summary.methods.transferencia)}</td></tr>
              <tr><td>Tarjeta</td><td>${money(summary.methods.tarjeta)}</td></tr>
              <tr><td>Mixto</td><td>${money(summary.methods.mixto)}</td></tr>
              <tr><td>Otros</td><td>${money(summary.methods.otros)}</td></tr>
              <tr><td>Primera venta</td><td>${summary.firstAt ? fmtDate(summary.firstAt) : "--"}</td></tr>
              <tr><td>Ultima venta</td><td>${summary.lastAt ? fmtDate(summary.lastAt) : "--"}</td></tr>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;
}

function printClosureReport() {
  const summary = state.closureSummary;
  if (!summary || !summary.salesCount) {
    setFeedback(el.saleFeedback, "No hay ventas para imprimir cierre en esa fecha.", "error");
    return;
  }

  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) {
    setFeedback(el.saleFeedback, "El navegador bloqueo la ventana de impresion.", "error");
    return;
  }

  popup.document.open();
  popup.document.write(closureReportHtml(summary));
  popup.document.close();
  popup.focus();

  setTimeout(() => {
    popup.print();
  }, 250);
}

function setAuthView(loggedIn) {
  el.loginView.classList.toggle("hidden", loggedIn);
  el.posView.classList.toggle("hidden", !loggedIn);
  el.logoutBtn.classList.toggle("hidden", !loggedIn);
  if (el.newProductBtn) el.newProductBtn.classList.toggle("hidden", !loggedIn || !isOwnerSession());
  if (el.importCsvBtn) el.importCsvBtn.classList.toggle("hidden", !loggedIn || !isOwnerSession());
  if (el.inactivePanel) el.inactivePanel.classList.toggle("hidden", !loggedIn || !isOwnerSession());
  const technical = loggedIn && isTechnicalSession();
  if (el.backendInstance) el.backendInstance.classList.toggle("hidden", !technical);
  if (el.scannerTestTools) el.scannerTestTools.classList.toggle("hidden", !technical);
  if (!technical && el.scanTestFeedback) setFeedback(el.scanTestFeedback, "", "");
  if (!technical) {
    clearScanProbeTimeout();
    setScanProbeState(false);
  }

  if (loggedIn && state.user) {
    el.sessionUser.textContent = `${state.user.username} - ${state.user.role} - ${state.tenantCode}`;
    focusScanInput();
  } else {
    el.sessionUser.textContent = "Sin sesion";
    renderPendingOrdersNotice([]);
  }
}

function setLastTicket(ticket) {
  state.lastTicket = ticket;
  const has = !!ticket;
  el.printA4Btn.disabled = !has;
  el.printThermalBtn.disabled = !has;
}

function clearCart(message = "") {
  state.cart = [];
  renderCart();
  if (message) {
    setFeedback(el.saleFeedback, message, "");
  }
  focusScanInput();
}

function canIncreaseQty(product, rawPresentation, nextQty, itemKey = "", options = {}) {
  const silent = !!options?.silent;
  if (!state.prefs.enforceStock) return true;

  const code = productCode(product);
  if (!code) return true;

  const presentation = normalizePresentation(rawPresentation);
  const stockUnits = productStockUnits(product);
  const selectedUnitsPerItem = presentationUnits(product, presentation);

  let requestedUnits = 0;
  for (const item of state.cart) {
    if (item.code !== code) continue;
    const unitsPerItem = Math.max(
      1,
      Number(item.unitsPerItem) || presentationUnits(product, item.presentation)
    );
    const qty = itemKey && item.key === itemKey ? nextQty : item.qty;
    requestedUnits += Math.max(0, qty) * unitsPerItem;
  }

  if (!itemKey) {
    requestedUnits += Math.max(0, nextQty) * selectedUnitsPerItem;
  }

  if (requestedUnits > stockUnits + 1e-9) {
    if (!silent) {
      const maxQty = availableQtyForPresentation(product, presentation);
      const msg =
        "Stock insuficiente para " +
        (product.nombre || "producto") +
        " en " +
        presentationLabel(presentation).toLowerCase() +
        ". Max aprox: " +
        maxQty +
        ".";
      setFeedback(el.saleFeedback, msg, "error");
    }
    return false;
  }

  return true;
}

function addProductToCart(product, rawPresentation = "") {
  const code = productCode(product);
  if (!code) return;

  const presentation = normalizePresentation(rawPresentation || defaultPresentation(product));
  const unitsPerItem = presentationUnits(product, presentation);
  const price = presentationPrice(product, presentation);
  if (price <= 0) {
    const msg =
      "La presentacion " +
      presentationLabel(presentation).toLowerCase() +
      " no tiene precio configurado.";
    setFeedback(el.saleFeedback, msg, "error");
    return;
  }

  const key = code + "::" + presentation;
  const existing = state.cart.find((item) => item.key === key);
  const nextQty = existing ? existing.qty + 1 : 1;
  if (!canIncreaseQty(product, presentation, nextQty, existing ? existing.key : "")) {
    return;
  }

  if (existing) {
    existing.qty += 1;
    existing.price = price;
    existing.unitsPerItem = unitsPerItem;
    existing.name = String(product.nombre || "Producto");
  } else {
    state.cart.push({
      key,
      code,
      id: Number(product.id) || null,
      name: String(product.nombre || "Producto"),
      presentation,
      qty: 1,
      price,
      unitsPerItem,
    });
  }

  setFeedback(el.saleFeedback, "", "");
  renderCart();
  focusScanInput();
}

function parseSignedInteger(rawValue) {
  const cleaned = String(rawValue || "").trim();
  if (!cleaned || !/^[+-]?\d+$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function buildProductUpdatePayload(product, nextStockBoxes, movementType, reason) {
  return {
    nombre: String(product?.nombre || "").trim(),
    descripcion: String(product?.descripcion || ""),
    categoria: String(product?.categoria || "General"),
    disponibilidad: String(product?.disponibilidad || "Disponible"),
    imagen: String(product?.imagen || ""),
    precioCaja: Math.max(0, Number(product?.precioCaja) || 0),
    precioSobre: Math.max(0, Number(product?.precioSobre) || 0),
    precioUnidad: Math.max(0, Number(product?.precioUnidad) || 0),
    sobresXCaja: Math.max(1, Math.trunc(Number(product?.sobresXCaja) || 1)),
    unidadesXSobre: Math.max(1, Math.trunc(Number(product?.unidadesXSobre) || 1)),
    stockCajas: Math.max(0, Math.trunc(Number(nextStockBoxes) || 0)),
    ofertaActiva: !!product?.ofertaActiva,
    ofertaTexto: String(product?.ofertaTexto || ""),
    ofertaPrecioCaja: Math.max(0, Number(product?.ofertaPrecioCaja) || 0),
    ofertaPrecioSobre: Math.max(0, Number(product?.ofertaPrecioSobre) || 0),
    stockMovementType: movementType,
    stockReason: reason,
  };
}

async function quickAdjustProductStock(product, triggerButton = null) {
  if (!isOwnerSession()) {
    setFeedback(el.saleFeedback, "Solo owner puede ajustar stock.", "error");
    focusScanInput();
    return;
  }

  const name = String(product?.nombre || "Producto").trim() || "Producto";
  const code = normalizeScannedCode(productCode(product));
  const externalId = normalizeScannedCode(product?.externalId || "");
  const id = externalId ? 0 : Number(product?.id) || 0;
  const currentStock = Math.max(0, Math.trunc(Number(product?.stockCajas) || 0));

  const deltaInput = window.prompt(
    `Ajuste rapido de stock para ${name}${code ? ` (${code})` : ""}.\nIngresa cajas a sumar/restar (ej: 3 o -2).\nStock actual: ${currentStock}`,
    "0"
  );

  if (deltaInput === null) {
    setFeedback(el.saleFeedback, "Ajuste de stock cancelado.", "");
    focusScanInput();
    return;
  }

  const deltaBoxes = parseSignedInteger(deltaInput);
  if (deltaBoxes === null) {
    setFeedback(el.saleFeedback, "Ajuste invalido. Usa numero entero (ej: 2 o -1).", "error");
    focusScanInput();
    return;
  }

  if (deltaBoxes === 0) {
    setFeedback(el.saleFeedback, "No hubo cambios de stock.", "");
    focusScanInput();
    return;
  }

  const nextStock = Math.max(0, currentStock + deltaBoxes);
  const appliedDelta = nextStock - currentStock;
  if (appliedDelta === 0) {
    setFeedback(el.saleFeedback, "No hubo cambios de stock (ya estaba en cero).", "");
    focusScanInput();
    return;
  }

  const reasonInput = window.prompt("Motivo del ajuste (opcional)", "ajuste_rapido_pos");
  if (reasonInput === null) {
    setFeedback(el.saleFeedback, "Ajuste de stock cancelado.", "");
    focusScanInput();
    return;
  }

  const reason = String(reasonInput || "").trim() || "ajuste_rapido_pos";
  const movementType = appliedDelta > 0 ? "entrada" : "salida";

  if (triggerButton) {
    setBusy(triggerButton, true, "Ajustando...", "Ajuste stock");
  }

  try {
    const payload = buildProductUpdatePayload(product, nextStock, movementType, reason);

    if (externalId) {
      await request(`/products/external/${encodeURIComponent(externalId)}`, {
        method: "PUT",
        body: payload,
      });
    } else if (id > 0) {
      await request(`/products/${id}`, {
        method: "PUT",
        body: payload,
      });
    } else if (code) {
      await request(`/products/external/${encodeURIComponent(code)}`, {
        method: "PUT",
        body: payload,
      });
    } else {
      throw new Error("Producto sin identificador para ajuste.");
    }

    await loadProducts();
    await loadInventoryMovements();
    renderCart();

    const deltaLabel = `${appliedDelta > 0 ? "+" : ""}${appliedDelta}`;
    setFeedback(
      el.saleFeedback,
      `Stock actualizado para ${name}: ${currentStock} -> ${nextStock} cajas (${deltaLabel}).`,
      "success"
    );
  } catch (error) {
    setFeedback(el.saleFeedback, `No se pudo ajustar stock: ${error.message}`, "error");
  } finally {
    if (triggerButton) {
      setBusy(triggerButton, false, "Ajustando...", "Ajuste stock");
    }
    focusScanInput();
  }
}

async function deleteProductFromCatalog(product, triggerButton = null) {
  if (!isOwnerSession()) {
    setFeedback(el.saleFeedback, "Solo owner puede eliminar productos.", "error");
    focusScanInput();
    return;
  }

  const externalId = normalizeScannedCode(product?.externalId || "");
  const id = externalId ? 0 : Number(product?.id) || 0;
  const code = normalizeScannedCode(productCode(product));
  const name = String(product?.nombre || "Producto").trim() || "Producto";
  const label = code ? `${name} (${code})` : `${name} (id ${id})`;

  const confirmed = window.confirm(`Vas a eliminar ${label}. Esta accion no se puede deshacer. Continuar?`);
  if (!confirmed) {
    setFeedback(el.saleFeedback, "Eliminacion cancelada.", "");
    focusScanInput();
    return;
  }

  if (triggerButton) {
    setBusy(triggerButton, true, "Eliminando...", "Eliminar");
  }

  try {
    if (externalId) {
      await request(`/products/external/${encodeURIComponent(externalId)}`, { method: "DELETE" });
    } else if (id > 0) {
      await request(`/products/${id}`, { method: "DELETE" });
    } else if (code) {
      await request(`/products/external/${encodeURIComponent(code)}`, { method: "DELETE" });
    } else {
      throw new Error("Producto sin identificador.");
    }

    state.cart = state.cart.filter((item) => {
      const sameId = id > 0 && Number(item.id) === id;
      const sameCode = code && normalizeScannedCode(item.code).toLowerCase() === code.toLowerCase();
      return !(sameId || sameCode);
    });

    await loadProducts();
    await loadInventoryMovements();
    renderCart();
    setFeedback(el.saleFeedback, `Producto eliminado: ${name}.`, "success");
    focusScanInput();
  } catch (error) {
    setFeedback(el.saleFeedback, `No se pudo eliminar producto: ${error.message}`, "error");
  } finally {
    if (triggerButton) {
      setBusy(triggerButton, false, "Eliminando...", "Eliminar");
    }
  }
}

function updateCartItem(itemKey, action) {
  const idx = state.cart.findIndex((item) => item.key === itemKey);
  if (idx < 0) return;

  const item = state.cart[idx];
  const product = findProductByCode(item.code);

  if (action === "inc") {
    if (!product) {
      setFeedback(el.saleFeedback, "Producto no encontrado para validar stock.", "error");
      return;
    }
    if (!canIncreaseQty(product, item.presentation, item.qty + 1, item.key)) {
      return;
    }
    item.qty += 1;
  }

  if (action === "dec") {
    item.qty -= 1;
    if (item.qty <= 0) {
      state.cart.splice(idx, 1);
    }
  }

  if (action === "remove") {
    state.cart.splice(idx, 1);
  }

  renderCart();
  focusScanInput();
}

function filterProducts(rawQuery) {
  const q = String(rawQuery || "").trim().toLowerCase();
  if (!q) {
    state.filteredProducts = [...state.products];
    renderProducts();
    return;
  }

  state.filteredProducts = state.products.filter((product) => {
    const code = productCode(product).toLowerCase();
    const name = String(product.nombre || "").toLowerCase();
    const category = String(product.categoria || "").toLowerCase();
    return code.includes(q) || name.includes(q) || category.includes(q);
  });

  renderProducts();
}

function resolveProductByScan(value) {
  const code = normalizeScannedCode(value).toLowerCase();
  if (!code) return null;

  return (
    state.products.find((product) => normalizeScannedCode(productCode(product)).toLowerCase() === code) ||
    state.products.find((product) => String(product.id || "").toLowerCase() === code) ||
    null
  );
}

function parseNumberInput(rawValue) {
  const cleaned = String(rawValue || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  if (!cleaned) return Number.NaN;
  return Number(cleaned);
}

function normalizeImportHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function detectCsvDelimiter(line) {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;

  candidates.forEach((delimiter) => {
    const count = String(line || "").split(delimiter).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  });

  return best;
}

function parseCsvLine(line, delimiter) {
  const output = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      output.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  output.push(current.trim());
  return output;
}

const IMPORT_FIELD_ALIASES = new Map([
  ["codigo", "codigo"],
  ["code", "codigo"],
  ["externalid", "codigo"],
  ["id", "codigo"],
  ["codigobarras", "codigo"],
  ["barcode", "codigo"],
  ["nombre", "nombre"],
  ["producto", "nombre"],
  ["name", "nombre"],
  ["categoria", "categoria"],
  ["category", "categoria"],
  ["preciocaja", "precioCaja"],
  ["preciocajacop", "precioCaja"],
  ["pricebox", "precioCaja"],
  ["caja", "precioCaja"],
  ["preciosobre", "precioSobre"],
  ["preciosobrecop", "precioSobre"],
  ["pricesobre", "precioSobre"],
  ["sobre", "precioSobre"],
  ["preciounidad", "precioUnidad"],
  ["preciounidadcop", "precioUnidad"],
  ["priceunit", "precioUnidad"],
  ["unidad", "precioUnidad"],
  ["sobresxcaja", "sobresXCaja"],
  ["sobresporcaja", "sobresXCaja"],
  ["unidadesxsobre", "unidadesXSobre"],
  ["unidadesporsobre", "unidadesXSobre"],
  ["stockcajas", "stockCajas"],
  ["stock", "stockCajas"],
  ["stockinicial", "stockCajas"],
]);

function mapCsvHeaderRow(headerCells) {
  return headerCells.map((cell) => IMPORT_FIELD_ALIASES.get(normalizeImportHeader(cell)) || null);
}

function parseProductsCsv(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const lines = source
    .split(/\r?\n/)
    .map((line) => String(line || "").trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { rows: [], errors: ["CSV vacio o sin filas de datos."] };
  }

  const delimiter = detectCsvDelimiter(lines[0]);
  const headerCells = parseCsvLine(lines[0], delimiter);
  const mappedHeader = mapCsvHeaderRow(headerCells);

  if (!mappedHeader.includes("codigo") || !mappedHeader.includes("nombre")) {
    return {
      rows: [],
      errors: ["El CSV debe incluir encabezados de codigo y nombre."],
    };
  }

  const rows = [];
  const errors = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i], delimiter);
    const data = {};

    mappedHeader.forEach((field, idx) => {
      if (!field) return;
      const value = String(cells[idx] || "").trim();
      if (!value) return;
      if (!data[field]) data[field] = value;
    });

    const lineNo = i + 1;
    const code = normalizeScannedCode(data.codigo || "");
    const nombre = String(data.nombre || "").trim();

    if (!code || !nombre) {
      errors.push("Linea " + lineNo + ": codigo y nombre son requeridos.");
      continue;
    }

    const toRounded = (value, fallback = 0) => {
      const raw = String(value || "").trim();
      if (!raw) return fallback;
      const parsed = parseNumberInput(raw);
      if (!Number.isFinite(parsed)) return Number.NaN;
      return Math.max(0, Math.round(parsed));
    };

    const toIntWithMin = (value, fallback, minValue) => {
      const raw = String(value || "").trim();
      if (!raw) return fallback;
      const parsed = parseNumberInput(raw);
      if (!Number.isFinite(parsed)) return Number.NaN;
      return Math.max(minValue, Math.floor(parsed));
    };

    const precioCaja = toRounded(data.precioCaja, 0);
    const precioSobre = toRounded(data.precioSobre, 0);
    const precioUnidad = toRounded(data.precioUnidad, 0);
    const sobresXCaja = toIntWithMin(data.sobresXCaja, 1, 1);
    const unidadesXSobre = toIntWithMin(data.unidadesXSobre, 1, 1);
    const stockCajas = toIntWithMin(data.stockCajas, 0, 0);

    if (!Number.isFinite(precioCaja) || !Number.isFinite(precioSobre) || !Number.isFinite(precioUnidad)) {
      errors.push("Linea " + lineNo + ": precios invalidos.");
      continue;
    }

    if (precioCaja <= 0 && precioSobre <= 0 && precioUnidad <= 0) {
      errors.push("Linea " + lineNo + ": define al menos un precio mayor que 0.");
      continue;
    }

    if (!Number.isFinite(sobresXCaja) || !Number.isFinite(unidadesXSobre) || !Number.isFinite(stockCajas)) {
      errors.push("Linea " + lineNo + ": conversiones o stock invalidos.");
      continue;
    }

    rows.push({
      lineNo,
      payload: {
        externalId: code,
        nombre,
        categoria: String(data.categoria || "").trim() || "General",
        disponibilidad: "Disponible",
        precioCaja,
        precioSobre,
        precioUnidad,
        sobresXCaja,
        unidadesXSobre,
        stockCajas,
        descripcion: "",
        imagen: "",
        ofertaActiva: false,
        ofertaTexto: "",
        ofertaPrecioCaja: 0,
        ofertaPrecioSobre: 0,
      },
    });
  }

  return { rows, errors };
}

async function importProductsFromCsvText(csvText, sourceLabel = "archivo.csv") {
  if (!isOwnerSession()) {
    setFeedback(el.saleFeedback, "Solo owner puede importar productos.", "error");
    return;
  }

  const parsed = parseProductsCsv(csvText);
  if (!parsed.rows.length) {
    const msg = parsed.errors.length
      ? "No se pudo importar " + sourceLabel + ": " + parsed.errors.slice(0, 3).join(" | ")
      : "No se encontraron filas validas en " + sourceLabel + ".";
    setFeedback(el.saleFeedback, msg, "error");
    return;
  }

  if (el.importCsvBtn) {
    setBusy(el.importCsvBtn, true, "Importando...", "Importar CSV");
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  const runtimeErrors = [];

  try {
    for (const row of parsed.rows) {
      try {
        const response = await request("/products", {
          method: "POST",
          body: row.payload,
        });
        if (response && response.updated) updated += 1;
        else created += 1;
      } catch (error) {
        failed += 1;
        if (runtimeErrors.length < 10) {
          runtimeErrors.push("L" + row.lineNo + ": " + error.message);
        }
      }
    }

    await loadProducts();
    await loadInventoryMovements();

    const preErrors = parsed.errors.length;
    const totalFailed = failed + preErrors;
    let message = "Importacion " + sourceLabel + ": " + created + " creados, " + updated + " actualizados";
    if (totalFailed > 0) {
      const allErrors = parsed.errors.slice(0, 5).concat(runtimeErrors);
      message += ", " + totalFailed + " con error. " + allErrors.slice(0, 6).join(" | ");
      setFeedback(el.saleFeedback, message, "error");
    } else {
      setFeedback(el.saleFeedback, message + ".", "success");
    }
  } finally {
    if (el.importCsvBtn) {
      setBusy(el.importCsvBtn, false, "Importando...", "Importar CSV");
    }
    if (el.importCsvInput) {
      el.importCsvInput.value = "";
    }
    focusScanInput();
  }
}

function normalizeScannedCode(rawValue) {
  return String(rawValue || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .replace(/\s+/g, "");
}

function isOwnerSession() {
  return String(state.user?.role || "").trim().toLowerCase() === "owner";
}

function clearScanProbeTimeout() {
  if (state.scanProbe.timeoutId) {
    clearTimeout(state.scanProbe.timeoutId);
    state.scanProbe.timeoutId = null;
  }
}

function setScanProbeState(active) {
  state.scanProbe.active = !!active;
  if (el.scanTestBtn) {
    el.scanTestBtn.textContent = active ? "Esperando escaneo..." : "Probar escaner";
  }
}

function isTechnicalSession() {
  if (!isOwnerSession()) return false;
  const tenant = normalizeCode(state.tenantCode);
  const username = String(state.user?.username || "").trim().toLowerCase();
  return tenant === TECH_MODE_TENANT && username === TECH_MODE_USERNAME;
}

function startScanProbe() {
  if (!isTechnicalSession()) {
    setFeedback(el.saleFeedback, "Modo tecnico no disponible para esta sesion.", "error");
    return;
  }

  clearScanProbeTimeout();
  setScanProbeState(true);
  if (el.scanTestFeedback) {
    setFeedback(el.scanTestFeedback, "Escanea ahora: se espera BARCODE + ENTER.", "");
  }

  state.scanProbe.timeoutId = setTimeout(() => {
    setScanProbeState(false);
    if (el.scanTestFeedback) {
      setFeedback(el.scanTestFeedback, "No se detecto escaneo. Revisa Barcode to PC (BARCODE + ENTER).", "error");
    }
  }, 12000);

  focusScanInput();
}

function consumeScanProbe(scannedCode) {
  if (!state.scanProbe.active) return false;

  clearScanProbeTimeout();
  setScanProbeState(false);

  const code = normalizeScannedCode(scannedCode);
  if (el.scanTestFeedback) {
    if (code) {
      setFeedback(el.scanTestFeedback, "Escaner OK. Codigo recibido: " + code, "success");
    } else {
      setFeedback(el.scanTestFeedback, "Escaner detectado pero sin codigo valido.", "error");
    }
  }
  return true;
}

function renderQuickCategoryOptions() {
  if (!el.quickCategoryOptions) return;

  const seen = new Set();
  const options = [];

  const addOption = (value) => {
    const trimmed = String(value || "").trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) return;
    seen.add(key);
    options.push(trimmed);
  };

  DEFAULT_CATEGORY_SUGGESTIONS.forEach(addOption);
  state.products.forEach((product) => addOption(product?.categoria));

  el.quickCategoryOptions.innerHTML = options
    .slice(0, 60)
    .map((value) => `<option value="${escapeHtml(value)}"></option>`)
    .join("");
}

function setQuickModalUi(mode) {
  const normalizedMode = mode === "edit" ? "edit" : "create";
  state.quickModalMode = normalizedMode;

  if (el.quickTitle) {
    el.quickTitle.textContent = normalizedMode === "edit" ? "Editar producto" : "Crear producto rapido";
  }

  if (el.quickCode) {
    el.quickCode.readOnly = normalizedMode === "edit";
  }

  if (el.quickSaveBtn) {
    el.quickSaveBtn.textContent = normalizedMode === "edit" ? "Guardar cambios" : "Crear y agregar";
  }
}

function closeQuickCreateModal(restoreScan = true) {
  if (!el.quickCreateModal) return;
  el.quickCreateModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  if (el.quickFeedback) {
    setFeedback(el.quickFeedback, "", "");
  }

  setQuickModalUi("create");
  state.quickEditProduct = null;

  if (restoreScan && el.scanInput) {
    el.scanInput.value = state.quickCreateCode || "";
    el.scanInput.focus();
    el.scanInput.select();
  } else {
    focusScanInput();
  }

  state.quickCreateCode = "";
}

function openQuickCreateModal(rawCode = "") {
  if (!el.quickCreateModal) return;
  const scannedCode = normalizeScannedCode(rawCode);
  const code = scannedCode || `prd-${Date.now().toString(36)}`;

  setQuickModalUi("create");
  state.quickEditProduct = null;
  state.quickCreateCode = scannedCode;

  if (el.quickCode) {
    el.quickCode.value = code;
    el.quickCode.readOnly = false;
  }
  if (el.quickName) el.quickName.value = `Producto ${code}`;
  if (el.quickPriceCaja) el.quickPriceCaja.value = "0";
  if (el.quickPriceSobre) el.quickPriceSobre.value = "0";
  if (el.quickPriceUnidad) el.quickPriceUnidad.value = "1000";
  if (el.quickSobresCaja) el.quickSobresCaja.value = "1";
  if (el.quickUnidadesSobre) el.quickUnidadesSobre.value = "1";
  if (el.quickStockCajas) el.quickStockCajas.value = "0";
  if (el.quickCategory) el.quickCategory.value = "General";
  if (el.quickFeedback) setFeedback(el.quickFeedback, "", "");

  el.quickCreateModal.classList.remove("hidden");
  document.body.classList.add("modal-open");

  setTimeout(() => {
    if (el.quickName) {
      el.quickName.focus();
      el.quickName.select();
    }
  }, 0);
}

function openQuickEditModal(product) {
  if (!isOwnerSession()) {
    setFeedback(el.saleFeedback, "Solo owner puede editar productos.", "error");
    return;
  }

  if (!product || !el.quickCreateModal) {
    setFeedback(el.saleFeedback, "Producto no encontrado para editar.", "error");
    return;
  }

  setQuickModalUi("edit");
  state.quickEditProduct = {
    id: Number(product.id) || 0,
    externalId: normalizeScannedCode(product.externalId || ""),
    nombre: String(product.nombre || ""),
    descripcion: String(product.descripcion || ""),
    categoria: String(product.categoria || ""),
    disponibilidad: String(product.disponibilidad || "Disponible"),
    imagen: String(product.imagen || ""),
    precioCaja: Number(product.precioCaja) || 0,
    precioSobre: Number(product.precioSobre) || 0,
    precioUnidad: Number(product.precioUnidad) || 0,
    sobresXCaja: Number(product.sobresXCaja) || 1,
    unidadesXSobre: Number(product.unidadesXSobre) || 1,
    stockCajas: Number(product.stockCajas) || 0,
    ofertaActiva: !!product.ofertaActiva,
    ofertaTexto: String(product.ofertaTexto || ""),
    ofertaPrecioCaja: Number(product.ofertaPrecioCaja) || 0,
    ofertaPrecioSobre: Number(product.ofertaPrecioSobre) || 0,
  };

  const code = normalizeScannedCode(productCode(product));
  state.quickCreateCode = code;

  if (el.quickCode) el.quickCode.value = code;
  if (el.quickName) el.quickName.value = String(product.nombre || "Producto");
  if (el.quickPriceCaja) el.quickPriceCaja.value = String(Math.max(0, Number(product.precioCaja) || 0));
  if (el.quickPriceSobre) el.quickPriceSobre.value = String(Math.max(0, Number(product.precioSobre) || 0));
  if (el.quickPriceUnidad) el.quickPriceUnidad.value = String(Math.max(0, Number(product.precioUnidad) || 0));
  if (el.quickSobresCaja) el.quickSobresCaja.value = String(toPositiveInt(product.sobresXCaja, 1));
  if (el.quickUnidadesSobre) el.quickUnidadesSobre.value = String(toPositiveInt(product.unidadesXSobre, 1));
  if (el.quickStockCajas) el.quickStockCajas.value = String(Math.max(0, Math.floor(Number(product.stockCajas) || 0)));
  if (el.quickCategory) el.quickCategory.value = String(product.categoria || "General");
  if (el.quickFeedback) setFeedback(el.quickFeedback, "", "");

  el.quickCreateModal.classList.remove("hidden");
  document.body.classList.add("modal-open");

  setTimeout(() => {
    if (el.quickName) {
      el.quickName.focus();
      el.quickName.select();
    }
  }, 0);
}

async function quickCreateProductFromScan(rawCode) {
  const code = normalizeScannedCode(rawCode);
  if (!code) return;

  if (!isOwnerSession()) {
    setFeedback(el.saleFeedback, "Solo owner puede crear productos desde escaneo.", "error");
    el.scanInput.select();
    return;
  }

  setFeedback(el.saleFeedback, `Codigo ${code} no encontrado. Completa alta rapida.`, "");
  openQuickCreateModal(code);
}

async function submitQuickCreateProduct(event) {
  event.preventDefault();

  if (!isOwnerSession()) {
    if (el.quickFeedback) setFeedback(el.quickFeedback, "Solo owner puede gestionar productos.", "error");
    return;
  }

  const mode = state.quickModalMode === "edit" ? "edit" : "create";
  const code = normalizeScannedCode(el.quickCode?.value || state.quickCreateCode || "");
  const nombreFinal = String(el.quickName?.value || "").trim();

  const priceCajaParsed = parseNumberInput(el.quickPriceCaja?.value || "0");
  const priceSobreParsed = parseNumberInput(el.quickPriceSobre?.value || "0");
  const priceUnidadParsed = parseNumberInput(el.quickPriceUnidad?.value || "0");
  const precioCaja = Number.isFinite(priceCajaParsed) ? Math.max(0, Math.round(priceCajaParsed)) : Number.NaN;
  const precioSobre = Number.isFinite(priceSobreParsed) ? Math.max(0, Math.round(priceSobreParsed)) : Number.NaN;
  const precioUnidad = Number.isFinite(priceUnidadParsed)
    ? Math.max(0, Math.round(priceUnidadParsed))
    : Number.NaN;

  const sobresParsed = parseNumberInput(el.quickSobresCaja?.value || "1");
  const unidadesParsed = parseNumberInput(el.quickUnidadesSobre?.value || "1");
  const stockParsed = parseNumberInput(el.quickStockCajas?.value || "0");

  const sobresXCaja = Number.isFinite(sobresParsed) ? Math.max(1, Math.floor(sobresParsed)) : Number.NaN;
  const unidadesXSobre = Number.isFinite(unidadesParsed)
    ? Math.max(1, Math.floor(unidadesParsed))
    : Number.NaN;
  const stockCajas = Number.isFinite(stockParsed) ? Math.max(0, Math.floor(stockParsed)) : Number.NaN;

  const categoriaInput = String(el.quickCategory?.value || "").trim();
  const categoria = categoriaInput || "General";

  if (!code) {
    if (el.quickFeedback) setFeedback(el.quickFeedback, "Codigo invalido.", "error");
    return;
  }

  if (!nombreFinal) {
    if (el.quickFeedback) setFeedback(el.quickFeedback, "Nombre requerido.", "error");
    if (el.quickName) el.quickName.focus();
    return;
  }

  if (!Number.isFinite(precioCaja) || !Number.isFinite(precioSobre) || !Number.isFinite(precioUnidad)) {
    if (el.quickFeedback) setFeedback(el.quickFeedback, "Precios invalidos.", "error");
    return;
  }

  if (precioCaja <= 0 && precioSobre <= 0 && precioUnidad <= 0) {
    if (el.quickFeedback) {
      setFeedback(el.quickFeedback, "Configura al menos un precio mayor que 0 (caja/sobre/unidad).", "error");
    }
    if (el.quickPriceUnidad) el.quickPriceUnidad.focus();
    return;
  }

  if (!Number.isFinite(sobresXCaja) || sobresXCaja < 1) {
    if (el.quickFeedback) setFeedback(el.quickFeedback, "Sobres por caja invalido.", "error");
    if (el.quickSobresCaja) el.quickSobresCaja.focus();
    return;
  }

  if (!Number.isFinite(unidadesXSobre) || unidadesXSobre < 1) {
    if (el.quickFeedback) setFeedback(el.quickFeedback, "Unidades por sobre invalido.", "error");
    if (el.quickUnidadesSobre) el.quickUnidadesSobre.focus();
    return;
  }

  if (!Number.isFinite(stockCajas)) {
    if (el.quickFeedback) setFeedback(el.quickFeedback, "Stock cajas invalido.", "error");
    if (el.quickStockCajas) el.quickStockCajas.focus();
    return;
  }

  if (mode === "create" && resolveProductByScan(code)) {
    if (el.quickFeedback) setFeedback(el.quickFeedback, "Ese codigo ya existe en el catalogo.", "error");
    if (el.quickCode) el.quickCode.focus();
    return;
  }

  if (el.quickSaveBtn) {
    setBusy(
      el.quickSaveBtn,
      true,
      mode === "edit" ? "Guardando..." : "Creando...",
      mode === "edit" ? "Guardar cambios" : "Crear y agregar"
    );
  }

  try {
    if (mode === "create") {
      const payload = {
        externalId: code,
        nombre: nombreFinal,
        categoria,
        disponibilidad: "Disponible",
        precioCaja,
        precioSobre,
        precioUnidad,
        sobresXCaja,
        unidadesXSobre,
        stockCajas,
        descripcion: "",
        imagen: "",
        ofertaActiva: false,
        ofertaTexto: "",
        ofertaPrecioCaja: 0,
        ofertaPrecioSobre: 0,
      };

      const created = await request("/products", {
        method: "POST",
        body: payload,
      });

      await loadProducts();
      await loadInventoryMovements();

      const product = resolveProductByScan(code) || {
        id: Number(created?.id) || 0,
        externalId: code,
        nombre: nombreFinal,
        categoria,
        precioCaja,
        precioSobre,
        precioUnidad,
        sobresXCaja,
        unidadesXSobre,
        stockCajas,
      };

      addProductToCart(product, defaultPresentation(product));
      if (el.scanInput) el.scanInput.value = "";
      closeQuickCreateModal(false);
      setFeedback(el.saleFeedback, "Producto creado y agregado al carrito.", "success");
      focusScanInput();
      return;
    }

    const base = state.quickEditProduct || {};
    const externalId = normalizeScannedCode(base.externalId || "");
    const id = externalId ? 0 : Number(base.id) || 0;

    const payload = {
      nombre: nombreFinal,
      descripcion: String(base.descripcion || ""),
      categoria,
      disponibilidad: String(base.disponibilidad || "Disponible"),
      imagen: String(base.imagen || ""),
      precioCaja,
      precioSobre,
      precioUnidad,
      sobresXCaja,
      unidadesXSobre,
      stockCajas,
      ofertaActiva: !!base.ofertaActiva,
      ofertaTexto: String(base.ofertaTexto || ""),
      ofertaPrecioCaja: Number(base.ofertaPrecioCaja) || 0,
      ofertaPrecioSobre: Number(base.ofertaPrecioSobre) || 0,
    };

    if (externalId) {
      await request(`/products/external/${encodeURIComponent(externalId)}`, {
        method: "PUT",
        body: payload,
      });
    } else if (id > 0) {
      await request(`/products/${id}`, {
        method: "PUT",
        body: payload,
      });
    } else {
      throw new Error("Producto sin identificador para editar.");
    }

    const previewProduct = {
      ...base,
      ...payload,
      id: id || Number(base.id) || null,
      externalId: externalId || code,
    };

    state.cart = state.cart.map((item) => {
      const sameByCode = normalizeScannedCode(item.code).toLowerCase() === code.toLowerCase();
      const sameById = id > 0 && Number(item.id) === id;
      if (!sameByCode && !sameById) return item;

      const nextPrice = presentationPrice(previewProduct, item.presentation);
      return {
        ...item,
        name: nombreFinal,
        price: nextPrice > 0 ? nextPrice : item.price,
        unitsPerItem: presentationUnits(previewProduct, item.presentation),
      };
    });

    await loadProducts();
    await loadInventoryMovements();
    renderCart();
    closeQuickCreateModal(false);
    setFeedback(el.saleFeedback, "Producto actualizado.", "success");
    focusScanInput();
  } catch (error) {
    if (el.quickFeedback) {
      setFeedback(el.quickFeedback, `No se pudo guardar producto: ${error.message}`, "error");
    }
  } finally {
    if (el.quickSaveBtn) {
      setBusy(
        el.quickSaveBtn,
        false,
        mode === "edit" ? "Guardando..." : "Creando...",
        mode === "edit" ? "Guardar cambios" : "Crear y agregar"
      );
    }
  }
}

async function fetchAllProducts() {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  const all = [];

  while (page <= totalPages) {
    const payload = await request(`/products?page=${page}&limit=${pageSize}`);
    const items = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
    all.push(...items);

    if (Array.isArray(payload)) {
      totalPages = 1;
    } else {
      totalPages = Number(payload?.totalPages) > 0 ? Number(payload.totalPages) : 1;
    }

    page += 1;
  }

  return all;
}

async function loadProducts() {
  const rows = await fetchAllProducts();
  state.products = rows;
  renderQuickCategoryOptions();
  filterProducts(el.productSearch.value);
  renderOwnerInsights();
  focusScanInput();
}

async function loadSales() {
  const payload = await request("/sales");
  state.sales = Array.isArray(payload) ? payload : [];
  state.salesLoaded = true;
  renderSales();
  renderOwnerInsights();
  renderClosure();
  renderClosureHistory();
}

async function loadInventoryMovements() {
  if (!isOwnerSession()) {
    state.inventoryMovements = [];
    state.inventoryMovementsLoaded = true;
    renderInventoryMovements();
    return;
  }

  const selectedType = normalizeMovementTypeFilter(el.inventoryMovementType?.value);
  const params = new URLSearchParams();
  params.set("limit", "100");
  if (selectedType) params.set("type", selectedType);

  state.inventoryMovementsLoaded = false;
  renderInventoryMovements();

  const payload = await request(`/inventory/movements?${params.toString()}`);
  state.inventoryMovements = Array.isArray(payload?.items) ? payload.items : [];
  state.inventoryMovementsLoaded = true;
  renderInventoryMovements();
}

function applyLocalStockDeduction() {
  if (!state.prefs.enforceStock) return;

  for (const item of state.cart) {
    const product = findProductByCode(item.code);
    if (!product) continue;

    const unitsPerCaja = productUnitsPerCaja(product);
    const currentUnits = productStockUnits(product);
    const unitsPerItem = Math.max(1, Number(item.unitsPerItem) || presentationUnits(product, item.presentation));
    const nextUnits = Math.max(0, currentUnits - item.qty * unitsPerItem);
    const nextBoxes = nextUnits / unitsPerCaja;

    product.stockCajas = Number(nextBoxes.toFixed(4));
  }
}

function ticketHtml(mode) {
  if (!state.lastTicket) return "";
  const ticket = state.lastTicket;
  const rows = ticket.items
    .map((item) => {
      const presentation = item.presentacion ? ` (${presentationLabel(item.presentacion)})` : "";
      return `
        <tr>
          <td>${escapeHtml(item.nombre)}${escapeHtml(presentation)}</td>
          <td style="text-align:center;">${item.cantidad}</td>
          <td style="text-align:right;">${money(item.precio)}</td>
          <td style="text-align:right;">${money(item.subtotal)}</td>
        </tr>
      `;
    })
    .join("");

  const compact = mode === "thermal";
  const wrapperStyle = compact
    ? "max-width:280px;margin:0 auto;font-family:Arial, sans-serif;font-size:12px;color:#111;"
    : "max-width:740px;margin:0 auto;font-family:Arial, sans-serif;font-size:13px;color:#111;";

  const pageRule = compact
    ? "@page { size: 80mm auto; margin: 6mm; }"
    : "@page { size: A4; margin: 12mm; }";

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Ticket ${escapeHtml(ticket.ref)}</title>
        <style>
          ${pageRule}
          body { margin: 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #ddd; padding: 4px; }
          th { text-align: left; background: #f5f5f5; }
          .meta { color: #555; font-size: ${compact ? "11px" : "12px"}; }
          .total { font-size: ${compact ? "18px" : "24px"}; font-weight: 800; text-align: right; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div style="${wrapperStyle}">
          <h2 style="margin:0 0 4px;">${escapeHtml(ticket.tenantDisplay || "WISAND")}</h2>
          <p class="meta" style="margin:0 0 8px;">Ticket ${escapeHtml(ticket.ref)} - ${escapeHtml(fmtDate(ticket.dateISO))}</p>
          <p class="meta" style="margin:0 0 4px;">Usuario: ${escapeHtml(ticket.user || "--")}</p>
          <p class="meta" style="margin:0 0 4px;">Cliente: ${escapeHtml(ticket.customerName || "Consumidor final")}</p>
          <p class="meta" style="margin:0 0 10px;">Telefono: ${escapeHtml(ticket.customerPhone || "--")}</p>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Cant</th>
                <th>Unit</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <p class="meta" style="margin:8px 0 0;">Metodo de pago: ${escapeHtml(ticket.paymentMethod || "--")}</p>
          <div class="total">${money(ticket.total)}</div>
        </div>
      </body>
    </html>
  `;
}

function printTicket(mode) {
  if (!state.lastTicket) {
    setFeedback(el.saleFeedback, "No hay ticket reciente para imprimir.", "error");
    return;
  }

  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) {
    setFeedback(el.saleFeedback, "El navegador bloqueo la ventana de impresion.", "error");
    return;
  }

  popup.document.open();
  popup.document.write(ticketHtml(mode));
  popup.document.close();
  popup.focus();

  setTimeout(() => {
    popup.print();
  }, 250);
}

async function checkApiConnection() {
  state.apiBase = String(el.apiBase.value || "").trim().replace(/\/$/, "");
  if (!state.apiBase) {
    setFeedback(el.apiFeedback, "Define API Base URL.", "error");
    return;
  }

  if (el.apiFeedback) {
    setFeedback(el.apiFeedback, "Probando conexion...", "");
  }

  if (el.apiCheckBtn) {
    setBusy(el.apiCheckBtn, true, "Probando...", "Probar conexion");
  }

  try {
    const health = await refreshBackendIdentity();
    if (!health || health.ok !== true) {
      throw new Error("sin health");
    }

    const instance = shortInstanceId(health.instance_id);
    const suffix = instance ? ` (inst ${instance})` : "";
    if (el.apiFeedback) {
      setFeedback(el.apiFeedback, `API conectada correctamente${suffix}.`, "success");
    }
  } catch {
    if (el.apiFeedback) {
      setFeedback(el.apiFeedback, `No hay conexion con API (${state.apiBase}).`, "error");
    }
  } finally {
    if (el.apiCheckBtn) {
      setBusy(el.apiCheckBtn, false, "Probando...", "Probar conexion");
    }
  }
}

async function submitLogin(event) {
  event.preventDefault();
  setFeedback(el.loginFeedback, "", "");
  if (el.apiFeedback) setFeedback(el.apiFeedback, "", "");

  state.apiBase = String(el.apiBase.value || "").trim().replace(/\/$/, "");
  state.tenantCode = normalizeCode(el.tenantCode.value);
  const username = String(el.username.value || "").trim();
  const password = String(el.password.value || "").trim();

  if (!state.apiBase || !state.tenantCode || !username || !password) {
    setFeedback(el.loginFeedback, "Completa todos los campos.", "error");
    return;
  }

  setBusy(el.loginBtn, true, "Ingresando...", "Entrar");

  try {
    await refreshBackendIdentity();
    await loadBrandingByCode(state.tenantCode);

    const data = await request("/auth/login", {
      method: "POST",
      body: {
        username,
        password,
        tenant_code: state.tenantCode,
      },
    });

    state.token = String(data?.token || "");
    state.user = data?.user || null;

    if (!state.token || !state.user) {
      throw new Error("Respuesta de login incompleta.");
    }

    state.prefs = loadTenantPrefs(state.tenantCode);
    applyTenantPrefsUi();

    persistSession();
    setAuthView(true);
    await Promise.all([loadProducts(), loadSales(), loadClosureHistory(), loadInventoryMovements()]);
    setLastTicket(null);
    await startPendingOrdersMonitor();
    setFeedback(el.loginFeedback, "Sesion iniciada.", "success");
  } catch (error) {
    setFeedback(el.loginFeedback, `No se pudo iniciar sesion: ${error.message}`, "error");
  } finally {
    setBusy(el.loginBtn, false, "Ingresando...", "Entrar");
  }
}

function validateStockBeforeSale() {
  if (!state.prefs.enforceStock) return true;

  for (const item of state.cart) {
    const product = findProductByCode(item.code);
    if (!product) {
      setFeedback(el.saleFeedback, "No se pudo validar stock para un item del carrito.", "error");
      return false;
    }

    if (!canIncreaseQty(product, item.presentation, item.qty, item.key)) {
      return false;
    }
  }

  return true;
}

async function completeSale() {
  if (!state.cart.length) {
    setFeedback(el.saleFeedback, "Agrega productos antes de registrar venta.", "error");
    return;
  }

  if (!validateStockBeforeSale()) {
    return;
  }

  const total = state.cart.reduce((acc, item) => acc + item.qty * item.price, 0);
  if (total <= 0) {
    setFeedback(el.saleFeedback, "Total invalido.", "error");
    return;
  }

  setBusy(el.completeSaleBtn, true, "Guardando...", "Registrar venta");

  try {
    const paymentMethodSelected = String(el.paymentMethod?.value || "efectivo").trim().toLowerCase();
    if (paymentMethodSelected === "mixto") {
      syncMixedPaymentBreakdown();
      const cashAmount = toNonNegativeNumber(el.mixCashAmount?.value);
      const transferAmount = toNonNegativeNumber(el.mixTransferAmount?.value);

      if (cashAmount <= 0 || transferAmount <= 0) {
        setFeedback(
          el.saleFeedback,
          "En mixto debes indicar monto en efectivo y monto en transferencia.",
          "error"
        );
        return;
      }

      const mixedDiff = Math.abs(cashAmount + transferAmount - total);
      if (mixedDiff > 0.01) {
        setFeedback(
          el.saleFeedback,
          "En mixto la suma de efectivo + transferencia debe ser igual al total.",
          "error"
        );
        return;
      }
    }

    const refId = `pos-${Date.now()}`;
    const payload = {
      refId,
      clienteNombre: String(el.customerName.value || "").trim(),
      clienteTelefono: String(el.customerPhone.value || "").trim(),
      metodoPago: buildSalePaymentMethod(total),
      total,
      items: state.cart.map((item) => ({
        id: item.id || item.code,
        code: item.code,
        nombre: item.name,
        presentacion: normalizePresentation(item.presentation),
        cantidad: item.qty,
        precio: item.price,
        subtotal: item.qty * item.price,
        unidadesEquivalentes: item.qty * Math.max(1, Number(item.unitsPerItem) || 1),
      })),
    };

    const response = await request("/sales", {
      method: "POST",
      body: payload,
    });

    const saleId = Number(response?.id) || null;

    setLastTicket({
      id: saleId,
      ref: refId,
      tenantDisplay: state.branding.display_name || "WISAND",
      tenantCode: state.tenantCode,
      dateISO: new Date().toISOString(),
      user: state.user?.username || "",
      customerName: payload.clienteNombre,
      customerPhone: payload.clienteTelefono,
      paymentMethod: payload.metodoPago,
      total: payload.total,
      items: payload.items,
    });

    applyLocalStockDeduction();

    state.cart = [];
    renderCart();
    filterProducts(el.productSearch.value);
    await loadSales();
    await loadClosureHistory();
    await loadInventoryMovements();

    el.customerName.value = "";
    el.customerPhone.value = "";

    setFeedback(el.saleFeedback, "Venta registrada. Puedes imprimir ticket A4 o termica.", "success");
    focusScanInput();
  } catch (error) {
    setFeedback(el.saleFeedback, `No se pudo registrar la venta: ${error.message}`, "error");
  } finally {
    setBusy(el.completeSaleBtn, false, "Guardando...", "Registrar venta");
  }
}

function logout() {
  state.token = "";
  state.user = null;
  state.backendIdentity = null;
  state.products = [];
  state.filteredProducts = [];
  state.sales = [];
  state.salesLoaded = false;
  state.cart = [];
  state.tenantCode = "";
  state.prefs = { ...DEFAULT_PREFS };
  state.closureSummary = null;
  state.closureHistory = [];
  state.inactiveSummary = null;
  state.topSummary = null;
  state.criticalSummary = null;
  state.inventoryMovements = [];
  state.inventoryMovementsLoaded = false;
  state.quickCreateCode = "";
  clearScanProbeTimeout();
  setScanProbeState(false);
  stopPendingOrdersMonitor();
  if (el.quickCreateModal) {
    el.quickCreateModal.classList.add("hidden");
  }
  document.body.classList.remove("modal-open");
  clearSessionStorage();
  applyBranding(DEFAULT_BRANDING);
  if (el.apiBase) {
    el.apiBase.value = state.apiBase;
  }
  applyTenantPrefsUi();
  setLastTicket(null);
  setAuthView(false);
  renderProducts();
  renderSales();
  renderOwnerInsights();
  renderCart();
  if (el.closureDate) {
    el.closureDate.value = toDateInputValueLocal();
  }
  renderClosure();
  renderClosureHistory();
}

async function restoreSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  const session = safeJson(raw);
  if (!session?.token || !session?.apiBase || !session?.tenantCode) return;

  state.apiBase = String(session.apiBase).trim().replace(/\/$/, "");
  state.tenantCode = normalizeCode(session.tenantCode);
  state.token = String(session.token);
  state.user = session.user || null;

  el.apiBase.value = state.apiBase;
  el.tenantCode.value = state.tenantCode;
  await refreshBackendIdentity();

  try {
    await refreshBackendIdentity();
    await loadBrandingByCode(state.tenantCode);
    const me = await request("/auth/me");
    state.user = me || state.user;
    state.prefs = loadTenantPrefs(state.tenantCode);
    applyTenantPrefsUi();
    persistSession();
    setAuthView(true);
    await Promise.all([loadProducts(), loadSales(), loadClosureHistory(), loadInventoryMovements()]);
    setLastTicket(null);
    await startPendingOrdersMonitor();
  } catch {
    logout();
  }
}

function bindKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (el.posView.classList.contains("hidden")) return;

    if (event.key === "F2") {
      event.preventDefault();
      el.productSearch.focus();
      el.productSearch.select();
      return;
    }

    if (event.key === "F4") {
      event.preventDefault();
      void completeSale();
      return;
    }

    if (event.key === "F6") {
      event.preventDefault();
      if (!isOwnerSession()) {
        setFeedback(el.saleFeedback, "Solo owner puede crear productos.", "error");
        return;
      }
      openQuickCreateModal("");
      return;
    }

    if (event.key === "F8") {
      event.preventDefault();
      printClosureReport();
      return;
    }

    if (event.key === "F9") {
      event.preventDefault();
      exportClosureCsv();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (el.quickCreateModal && !el.quickCreateModal.classList.contains("hidden")) {
        closeQuickCreateModal(true);
        setFeedback(el.saleFeedback, "Alta rapida cancelada.", "");
        return;
      }
      clearCart("Carrito limpiado.");
    }
  });
}

function bindEvents() {
  el.loginForm.addEventListener("submit", submitLogin);

  if (el.apiCheckBtn) {
    el.apiCheckBtn.addEventListener("click", () => {
      void checkApiConnection();
    });
  }

  if (el.quickForm) {
    el.quickForm.addEventListener("submit", (event) => {
      void submitQuickCreateProduct(event);
    });
  }

  if (el.quickCode) {
    el.quickCode.addEventListener("input", () => {
      const normalized = normalizeScannedCode(el.quickCode.value);
      if (el.quickCode.value !== normalized) el.quickCode.value = normalized;
      state.quickCreateCode = normalized;
    });
  }

  if (el.newProductBtn) {
    el.newProductBtn.addEventListener("click", () => {
      if (!isOwnerSession()) {
        setFeedback(el.saleFeedback, "Solo owner puede crear productos.", "error");
        return;
      }
      openQuickCreateModal("");
    });
  }

  if (el.importCsvBtn) {
    el.importCsvBtn.addEventListener("click", () => {
      if (!isOwnerSession()) {
        setFeedback(el.saleFeedback, "Solo owner puede importar productos.", "error");
        return;
      }
      if (!el.importCsvInput) {
        setFeedback(el.saleFeedback, "No se encontro input de archivo CSV.", "error");
        return;
      }
      el.importCsvInput.value = "";
      el.importCsvInput.click();
    });
  }

  if (el.importCsvInput) {
    el.importCsvInput.addEventListener("change", async () => {
      const file = el.importCsvInput.files && el.importCsvInput.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        await importProductsFromCsvText(text, file.name || "archivo.csv");
      } catch (error) {
        setFeedback(el.saleFeedback, `No se pudo leer/importar CSV: ${error.message}`, "error");
      }
    });
  }

  if (el.quickCancelBtn) {
    el.quickCancelBtn.addEventListener("click", () => {
      closeQuickCreateModal(true);
      setFeedback(el.saleFeedback, "Alta rapida cancelada.", "");
    });
  }

  if (el.quickCloseBtn) {
    el.quickCloseBtn.addEventListener("click", () => {
      closeQuickCreateModal(true);
      setFeedback(el.saleFeedback, "Alta rapida cancelada.", "");
    });
  }

  if (el.quickCreateModal) {
    el.quickCreateModal.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.modalClose === "1") {
        closeQuickCreateModal(true);
        setFeedback(el.saleFeedback, "Alta rapida cancelada.", "");
      }
    });
  }
  el.tenantCode.addEventListener("change", async () => {
    state.apiBase = String(el.apiBase.value || "").trim().replace(/\/$/, "");
    const code = normalizeCode(el.tenantCode.value);
    if (!code) {
      applyBranding(DEFAULT_BRANDING);
      return;
    }
    try {
      await loadBrandingByCode(code);
    } catch {
      applyBranding(DEFAULT_BRANDING);
    }
  });

  el.productSearch.addEventListener("input", () => {
    filterProducts(el.productSearch.value);
  });

  el.scanInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();

    const scanned = normalizeScannedCode(el.scanInput.value);
    if (el.scanInput.value !== scanned) el.scanInput.value = scanned;
    if (!scanned) {
      focusScanInput();
      return;
    }

    if (consumeScanProbe(scanned)) {
      el.scanInput.value = "";
      focusScanInput();
      return;
    }

    const product = resolveProductByScan(scanned);
    if (!product) {
      void quickCreateProductFromScan(scanned);
      return;
    }

    addProductToCart(product);
    el.scanInput.value = "";
    focusScanInput();
  });

  el.productsTableBody.addEventListener("click", (event) => {
    const rawTarget = event.target;
    if (!(rawTarget instanceof Element)) return;
    const button = rawTarget.closest("button");
    if (!(button instanceof HTMLElement)) return;

    if (button.classList.contains("add-product-btn")) {
      const code = String(button.dataset.code || "");
      const product = findProductByCode(code);
      if (!product) return;

      let presentation = defaultPresentation(product);
      const row = button.closest("tr");
      if (row instanceof HTMLTableRowElement) {
        const select = row.querySelector(".presentation-select");
        if (select instanceof HTMLSelectElement) {
          presentation = normalizePresentation(select.value);
        }
      }

      addProductToCart(product, presentation);
      return;
    }

    if (button.classList.contains("adjust-stock-btn")) {
      const code = String(button.dataset.code || "");
      const id = Number(button.dataset.id || 0);
      const product =
        findProductByCode(code) || state.products.find((item) => Number(item.id) === id) || null;
      if (!product) {
        setFeedback(el.saleFeedback, "Producto no encontrado para ajustar stock.", "error");
        return;
      }
      void quickAdjustProductStock(product, button);
      return;
    }

    if (button.classList.contains("edit-product-btn")) {
      const code = String(button.dataset.code || "");
      const id = Number(button.dataset.id || 0);
      const product =
        findProductByCode(code) || state.products.find((item) => Number(item.id) === id) || null;
      if (!product) {
        setFeedback(el.saleFeedback, "Producto no encontrado para editar.", "error");
        return;
      }
      openQuickEditModal(product);
      return;
    }

    if (button.classList.contains("remove-product-btn")) {
      const code = String(button.dataset.code || "");
      const id = Number(button.dataset.id || 0);
      const product =
        findProductByCode(code) || state.products.find((item) => Number(item.id) === id) || null;
      if (!product) {
        setFeedback(el.saleFeedback, "Producto no encontrado para eliminar.", "error");
        return;
      }
      void deleteProductFromCatalog(product, button);
    }
  });

  el.cartItems.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = String(target.dataset.action || "");
    const key = String(target.dataset.key || "");
    if (!action || !key) return;
    updateCartItem(key, action);
  });

  if (el.scanTestBtn) {
    el.scanTestBtn.addEventListener("click", () => {
      startScanProbe();
    });
  }

  el.refreshProductsBtn.addEventListener("click", async () => {
    try {
      await loadProducts();
      await loadInventoryMovements();
      setFeedback(el.saleFeedback, "Catalogo actualizado.", "success");
    } catch (error) {
      setFeedback(el.saleFeedback, `No se pudo actualizar catalogo: ${error.message}`, "error");
    }
  });

  el.refreshSalesBtn.addEventListener("click", async () => {
    try {
      await loadSales();
      await loadClosureHistory();
      await loadInventoryMovements();
      await pollPendingOrders({ manual: false });
      setFeedback(el.saleFeedback, "Historial actualizado.", "success");
    } catch (error) {
      setFeedback(el.saleFeedback, `No se pudo actualizar ventas: ${error.message}`, "error");
    }
  });

  if (el.pendingOrdersRefreshBtn) {
    el.pendingOrdersRefreshBtn.addEventListener("click", () => {
      void pollPendingOrders({ manual: true });
    });
  }

  if (el.pendingOrdersSilenceBtn) {
    el.pendingOrdersSilenceBtn.addEventListener("click", () => {
      silencePendingOrders(5);
    });
  }

  if (el.inactiveDays) {
    el.inactiveDays.addEventListener("change", () => {
      el.inactiveDays.value = String(normalizeInactiveDays(el.inactiveDays.value));
      renderOwnerInsights();
    });
  }

  if (el.criticalStockThreshold) {
    el.criticalStockThreshold.addEventListener("change", () => {
      el.criticalStockThreshold.value = String(
        normalizeCriticalStockThreshold(el.criticalStockThreshold.value)
      );
      renderCriticalStock();
    });
  }

  if (el.inventoryMovementType) {
    el.inventoryMovementType.addEventListener("change", () => {
      void loadInventoryMovements();
    });
  }

  if (el.inventoryMovementSearch) {
    el.inventoryMovementSearch.addEventListener("input", () => {
      renderInventoryMovements();
    });
  }

  if (el.refreshInventoryMovementsBtn) {
    el.refreshInventoryMovementsBtn.addEventListener("click", async () => {
      if (!isOwnerSession()) {
        setFeedback(el.saleFeedback, "Solo owner puede ver movimientos de inventario.", "error");
        return;
      }

      try {
        await loadInventoryMovements();
        setFeedback(el.saleFeedback, "Movimientos de inventario actualizados.", "success");
      } catch (error) {
        setFeedback(el.saleFeedback, `No se pudo actualizar movimientos: ${error.message}`, "error");
      }
    });
  }

  if (el.refreshInactiveBtn) {
    el.refreshInactiveBtn.addEventListener("click", async () => {
      if (!isOwnerSession()) {
        setFeedback(el.saleFeedback, "Solo owner puede ver este reporte.", "error");
        return;
      }

      try {
        await Promise.all([loadProducts(), loadSales(), loadInventoryMovements()]);
        setFeedback(el.saleFeedback, "Indicadores actualizados.", "success");
      } catch (error) {
        setFeedback(el.saleFeedback, `No se pudo actualizar indicadores: ${error.message}`, "error");
      }
    });
  }

  el.closureDate.addEventListener("change", () => {
    renderClosure();
    renderClosureHistory();
  });

  el.closureTodayBtn.addEventListener("click", () => {
    el.closureDate.value = toDateInputValueLocal();
    renderClosure();
    renderClosureHistory();
  });

  el.openingCash.addEventListener("change", () => {
    const opening = Math.max(0, Number(el.openingCash.value) || 0);
    state.prefs.openingCash = opening;
    el.openingCash.value = String(opening);
    saveTenantPrefs();
    renderClosure();
    renderClosureHistory();
  });

  el.countedCash.addEventListener("change", () => {
    const counted = Math.max(0, Number(el.countedCash.value) || 0);
    state.prefs.countedCash = counted;
    el.countedCash.value = String(counted);
    saveTenantPrefs();
    renderClosure();
    renderClosureHistory();
  });

  el.closureStart.addEventListener("change", () => {
    const value = /^\d{2}:\d{2}$/.test(String(el.closureStart.value || ""))
      ? String(el.closureStart.value)
      : "00:00";
    state.prefs.closureStart = value;
    el.closureStart.value = value;
    saveTenantPrefs();
    renderShiftPresetState();
    renderClosure();
    renderClosureHistory();
  });

  el.closureEnd.addEventListener("change", () => {
    const value = /^\d{2}:\d{2}$/.test(String(el.closureEnd.value || ""))
      ? String(el.closureEnd.value)
      : "23:59";
    state.prefs.closureEnd = value;
    el.closureEnd.value = value;
    saveTenantPrefs();
    renderShiftPresetState();
    renderClosure();
    renderClosureHistory();
  });

  if (el.shiftMorningBtn) {
    el.shiftMorningBtn.addEventListener("click", () => {
      applyShiftRange(SHIFT_RANGES.morning.start, SHIFT_RANGES.morning.end);
    });
  }

  if (el.shiftAfternoonBtn) {
    el.shiftAfternoonBtn.addEventListener("click", () => {
      applyShiftRange(SHIFT_RANGES.afternoon.start, SHIFT_RANGES.afternoon.end);
    });
  }

  if (el.shiftNightBtn) {
    el.shiftNightBtn.addEventListener("click", () => {
      applyShiftRange(SHIFT_RANGES.night.start, SHIFT_RANGES.night.end);
    });
  }

  if (el.shiftAllBtn) {
    el.shiftAllBtn.addEventListener("click", () => {
      applyShiftRange(SHIFT_RANGES.all.start, SHIFT_RANGES.all.end);
    });
  }
  el.refreshClosureBtn.addEventListener("click", async () => {
    try {
      await loadSales();
      await loadClosureHistory();
      setFeedback(el.saleFeedback, "Cierre recalculado.", "success");
    } catch (error) {
      setFeedback(el.saleFeedback, `No se pudo recalcular cierre: ${error.message}`, "error");
    }
  });

  if (el.saveClosureBtn) {
    el.saveClosureBtn.addEventListener("click", () => {
      void saveClosure();
    });
  }
  el.printClosureBtn.addEventListener("click", () => {
    printClosureReport();
  });

  el.exportClosureCsvBtn.addEventListener("click", () => {
    exportClosureCsv();
  });

  if (el.paymentMethod) {
    el.paymentMethod.addEventListener("change", () => {
      syncTransferProviderUi();
    });
  }

  if (el.transferProvider) {
    el.transferProvider.addEventListener("change", () => {
      syncMixedPaymentBreakdown();
    });
  }

  if (el.mixCashAmount) {
    el.mixCashAmount.addEventListener("input", () => {
      syncMixedPaymentBreakdown("cash");
    });
  }

  if (el.mixTransferAmount) {
    el.mixTransferAmount.addEventListener("input", () => {
      syncMixedPaymentBreakdown("transfer");
    });
  }

  el.clearCartBtn.addEventListener("click", () => {
    clearCart("Carrito limpiado.");
  });

  el.completeSaleBtn.addEventListener("click", () => {
    void completeSale();
  });

  el.printA4Btn.addEventListener("click", () => {
    printTicket("a4");
  });

  el.printThermalBtn.addEventListener("click", () => {
    printTicket("thermal");
  });

  el.denseModeBtn.addEventListener("click", () => {
    state.prefs.denseMode = !state.prefs.denseMode;
    saveTenantPrefs();
    applyTenantPrefsUi();
  });

  el.enforceStock.addEventListener("change", () => {
    state.prefs.enforceStock = !!el.enforceStock.checked;
    saveTenantPrefs();
    renderProducts();
    renderCart();
    focusScanInput();
  });

  el.logoutBtn.addEventListener("click", logout);

  bindKeyboardShortcuts();
}

async function init() {
  applyBranding(DEFAULT_BRANDING);
  if (el.apiBase) {
    el.apiBase.value = state.apiBase;
  }
  await refreshBackendIdentity();
  if (el.closureDate && !el.closureDate.value) {
    el.closureDate.value = toDateInputValueLocal();
  }
  applyTenantPrefsUi();
  setLastTicket(null);
  bindEvents();
  syncTransferProviderUi();
  renderProducts();
  renderCart();
  renderSales();
  renderOwnerInsights();
  renderClosure();
  renderClosureHistory();
  await restoreSession();
}

void init();

