/* ==========================================================
  auth.js - Login Admin
========================================================== */

(function () {
  const TENANT_CODE_KEY = "wisand_tenant_code_v1";
  const userEl = document.getElementById("loginUser");
  const passEl = document.getElementById("loginPass");
  const tenantEl = document.getElementById("loginTenantCode");
  const btnEl = document.getElementById("loginBtn");
  const errEl = document.getElementById("loginError");
  const demoBox = document.getElementById("demoCredentials");
  const togglePass = document.getElementById("togglePass");
  const apiBtn = document.getElementById("apiConfigBtn");
  const apiSyncBtn = document.getElementById("apiSyncBtn");
  const apiStatus = document.getElementById("apiStatus");
  const DEMO_MODE = typeof window.DEMO_MODE === "boolean" ? window.DEMO_MODE : true;
  const SESSION_KEY = window.ADMIN_SESSION_TS_KEY || "admin_session_ts_v1";
  const SESSION_TTL = window.ADMIN_SESSION_TTL_MS || 8 * 60 * 60 * 1000;
  const TOKEN_KEY = window.ADMIN_TOKEN_KEY || "admin_token_v1";
  const USER_KEY = window.ADMIN_USER_KEY || "admin_user_v1";

  const normalizeTenantCode = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const isFile = window.location?.protocol === "file:";
  const isLocalHost =
    window.location?.hostname === "localhost" || window.location?.hostname === "127.0.0.1";
  const apiBase = localStorage.getItem("API_BASE") || "";
  const looksLocalApi = /localhost|127\.0\.0\.1/i.test(apiBase);
  const showDemo = DEMO_MODE && (isFile || isLocalHost || looksLocalApi);
  if (demoBox) demoBox.style.display = showDemo ? "block" : "none";
  const DEFAULT_API_BASE = "https://wisand.onrender.com";

  function getActiveTenantCode() {
    return normalizeTenantCode(
      tenantEl?.value ||
        window.getActiveTenantCode?.() ||
        window.WISAND_ACTIVE_TENANT_CODE ||
        localStorage.getItem(TENANT_CODE_KEY)
    );
  }

  function setActiveTenantCode(tenantCode) {
    const normalized = normalizeTenantCode(tenantCode);
    if (!normalized) {
      localStorage.removeItem(TENANT_CODE_KEY);
      return "";
    }
    localStorage.setItem(TENANT_CODE_KEY, normalized);
    if (typeof window.setActiveTenantCode === "function") {
      window.setActiveTenantCode(normalized);
    }
    return normalized;
  }

  function updateApiStatus() {
    if (!apiStatus) return;
    const base = localStorage.getItem("API_BASE") || "";
    const enabled = localStorage.getItem("API_ENABLED") !== "false" && !!base;
    const label = enabled ? "API activa" : "API desactivada";
    apiStatus.textContent = base ? `${label}: ${base}` : `${label}: sin URL`;
  }

  function configureApi() {
    const current = localStorage.getItem("API_BASE") || DEFAULT_API_BASE;
    const base = prompt("URL del backend (API_BASE):", current);
    if (base === null) return;
    const trimmed = String(base).trim();
    if (!trimmed) {
      localStorage.removeItem("API_BASE");
      localStorage.setItem("API_ENABLED", "false");
      updateApiStatus();
      showToast("API desactivada");
      return;
    }
    localStorage.setItem("API_BASE", trimmed);
    localStorage.setItem("API_ENABLED", "true");
    updateApiStatus();
    showToast("API configurada");
  }

  async function syncApi() {
    const base = (localStorage.getItem("API_BASE") || DEFAULT_API_BASE || "").trim();
    if (!base) {
      showToast("Configura la API primero");
      return;
    }
    const url = base.replace(/\/$/, "") + "/health";
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`API ${res.status}`);
      localStorage.setItem("API_BASE", base);
      localStorage.setItem("API_ENABLED", "true");
      updateApiStatus();
      showToast("API OK");
    } catch (_error) {
      localStorage.setItem("API_ENABLED", "false");
      updateApiStatus();
      showToast("API no disponible");
    }
  }

  async function preloadBranding(tenantCode) {
    if (!tenantCode || typeof window.loadTenantBrandingByCode !== "function") {
      return;
    }
    try {
      await window.loadTenantBrandingByCode(tenantCode, { silent: true });
    } catch {
      // no bloquea login si falla branding
    }
  }

  async function doLogin() {
    const tenantCode = getActiveTenantCode();
    const u = (userEl?.value || "").trim();
    const p = (passEl?.value || "").trim();

    if (!tenantCode || !u || !p) {
      setError(true);
      showToast("Ingresa codigo de negocio, usuario y contrasena");
      return;
    }

    try {
      setActiveTenantCode(tenantCode);
      await preloadBranding(tenantCode);
      localStorage.setItem("API_ENABLED", "true");
      const data = await apiLogin(u, p, tenantCode);
      if (!data?.token) throw new Error("Sin token");

      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user || {}));
      localStorage.setItem(ADMIN_FLAG, "true");
      localStorage.setItem(SESSION_KEY, String(Date.now()));
      showToast("Acceso concedido");
      window.location.href = "admin.html";
    } catch (_error) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(ADMIN_FLAG);
      localStorage.removeItem(SESSION_KEY);
      setError(true);
      showToast("Credenciales incorrectas, codigo invalido o API no disponible");
    }
  }

  function setError(show) {
    if (!errEl) return;
    errEl.style.display = show ? "block" : "none";
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void doLogin();
  });

  btnEl?.addEventListener("click", () => {
    void doLogin();
  });
  apiBtn?.addEventListener("click", configureApi);
  apiSyncBtn?.addEventListener("click", () => {
    void syncApi();
  });
  updateApiStatus();

  if (tenantEl) {
    const storedCode = getActiveTenantCode();
    if (storedCode) {
      tenantEl.value = storedCode;
    }
    tenantEl.addEventListener("blur", () => {
      const code = setActiveTenantCode(tenantEl.value);
      if (!code) return;
      void preloadBranding(code);
    });
  }

  if (togglePass && passEl) {
    togglePass.addEventListener("click", () => {
      const showing = passEl.type === "text";
      passEl.type = showing ? "password" : "text";
      togglePass.classList.toggle("is-open", !showing);
      togglePass.setAttribute("aria-pressed", String(!showing));
      togglePass.setAttribute(
        "aria-label",
        showing ? "Mostrar contrasena" : "Ocultar contrasena"
      );
    });
  }

  (function checkSession() {
    if (localStorage.getItem(ADMIN_FLAG) !== "true") return;
    const ts = Number(localStorage.getItem(SESSION_KEY) || 0);
    const token = localStorage.getItem(TOKEN_KEY);
    if (!ts || Date.now() - ts > SESSION_TTL || !token) {
      localStorage.removeItem(ADMIN_FLAG);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return;
    }
    window.location.href = "admin.html";
  })();
})();
