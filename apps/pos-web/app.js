const STORAGE_KEY = "wisand.pos.session.v1";
const PREFS_PREFIX = "wisand.pos.prefs.";

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

const state = {
  apiBase: "http://localhost:3001",
  tenantCode: "",
  token: "",
  user: null,
  branding: { ...DEFAULT_BRANDING },
  prefs: { ...DEFAULT_PREFS },
  products: [],
  filteredProducts: [],
  cart: [],
  sales: [],
  lastTicket: null,
  closureSummary: null,
  closureHistory: [],
  quickCreateCode: "",
  quickModalMode: "create",
  quickEditProduct: null,
};

const el = {
  brandName: document.getElementById("brand-name"),
  brandSubtitle: document.getElementById("brand-subtitle"),
  brandLogo: document.getElementById("brand-logo"),
  brandMonogram: document.getElementById("brand-monogram"),
  sessionUser: document.getElementById("session-user"),
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
  refreshProductsBtn: document.getElementById("refresh-products-btn"),
  newProductBtn: document.getElementById("new-product-btn"),
  productsTableBody: document.getElementById("products-table-body"),

  cartItems: document.getElementById("cart-items"),
  cartCount: document.getElementById("cart-count"),
  cartTotal: document.getElementById("cart-total"),
  totalDisplay: document.getElementById("total-display"),
  enforceStock: document.getElementById("enforce-stock"),

  customerName: document.getElementById("customer-name"),
  customerPhone: document.getElementById("customer-phone"),
  paymentMethod: document.getElementById("payment-method"),

  clearCartBtn: document.getElementById("clear-cart-btn"),
  completeSaleBtn: document.getElementById("complete-sale-btn"),
  printA4Btn: document.getElementById("print-a4-btn"),
  printThermalBtn: document.getElementById("print-thermal-btn"),
  saleFeedback: document.getElementById("sale-feedback"),

  salesList: document.getElementById("sales-list"),
  refreshSalesBtn: document.getElementById("refresh-sales-btn"),
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
  if (normalized.includes("efect")) return "efectivo";
  if (normalized.includes("trans")) return "transferencia";
  if (normalized.includes("tarj") || normalized.includes("dat")) return "tarjeta";
  if (normalized.includes("mixt")) return "mixto";
  return "otros";
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
                  ? `<button class="btn ghost edit-product-btn" data-id="${Number(product.id) || ""}" data-code="${escapeHtml(code)}">Editar</button><button class="btn ghost danger remove-product-btn" data-id="${Number(product.id) || ""}" data-code="${escapeHtml(code)}">Eliminar</button>`
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
    methods[methodKey] += saleTotal;

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

  if (loggedIn && state.user) {
    el.sessionUser.textContent = `${state.user.username} - ${state.user.role} - ${state.tenantCode}`;
    focusScanInput();
  } else {
    el.sessionUser.textContent = "Sin sesion";
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

  const confirmed = window.confirm(`Vas a eliminar ${label}. Esta accion no se puede deshacer. �Continuar?`);
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
function normalizeScannedCode(rawValue) {
  return String(rawValue || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .replace(/\s+/g, "");
}

function isOwnerSession() {
  return String(state.user?.role || "").trim().toLowerCase() === "owner";
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
  focusScanInput();
}

async function loadSales() {
  const payload = await request("/sales");
  state.sales = Array.isArray(payload) ? payload : [];
  renderSales();
  renderClosure();
  renderClosureHistory();
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
    const response = await fetch(`${state.apiBase}/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (el.apiFeedback) {
      setFeedback(el.apiFeedback, "API conectada correctamente.", "success");
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
    await Promise.all([loadProducts(), loadSales(), loadClosureHistory()]);
    setLastTicket(null);
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
    const refId = `pos-${Date.now()}`;
    const payload = {
      refId,
      clienteNombre: String(el.customerName.value || "").trim(),
      clienteTelefono: String(el.customerPhone.value || "").trim(),
      metodoPago: String(el.paymentMethod.value || "efectivo"),
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
  state.products = [];
  state.filteredProducts = [];
  state.sales = [];
  state.cart = [];
  state.tenantCode = "";
  state.prefs = { ...DEFAULT_PREFS };
  state.closureSummary = null;
  state.closureHistory = [];
  state.quickCreateCode = "";
  if (el.quickCreateModal) {
    el.quickCreateModal.classList.add("hidden");
  }
  document.body.classList.remove("modal-open");
  clearSessionStorage();
  applyBranding(DEFAULT_BRANDING);
  applyTenantPrefsUi();
  setLastTicket(null);
  setAuthView(false);
  renderProducts();
  renderSales();
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

  try {
    await loadBrandingByCode(state.tenantCode);
    const me = await request("/auth/me");
    state.user = me || state.user;
    state.prefs = loadTenantPrefs(state.tenantCode);
    applyTenantPrefsUi();
    persistSession();
    setAuthView(true);
    await Promise.all([loadProducts(), loadSales(), loadClosureHistory()]);
    setLastTicket(null);
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

  el.refreshProductsBtn.addEventListener("click", async () => {
    try {
      await loadProducts();
      setFeedback(el.saleFeedback, "Catalogo actualizado.", "success");
    } catch (error) {
      setFeedback(el.saleFeedback, `No se pudo actualizar catalogo: ${error.message}`, "error");
    }
  });

  el.refreshSalesBtn.addEventListener("click", async () => {
    try {
      await loadSales();
      await loadClosureHistory();
      setFeedback(el.saleFeedback, "Historial actualizado.", "success");
    } catch (error) {
      setFeedback(el.saleFeedback, `No se pudo actualizar ventas: ${error.message}`, "error");
    }
  });

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
  if (el.closureDate && !el.closureDate.value) {
    el.closureDate.value = toDateInputValueLocal();
  }
  applyTenantPrefsUi();
  setLastTicket(null);
  bindEvents();
  renderProducts();
  renderCart();
  renderSales();
  renderClosure();
  renderClosureHistory();
  await restoreSession();
}

void init();

