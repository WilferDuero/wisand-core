(function () {
  const TENANT_CODE_KEY = "wisand_tenant_code_v1";
  const BRANDING_CACHE_KEY = "wisand_branding_cache_v1";
  const DEFAULT_API_BASE =
    !location.hostname || location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://localhost:3001"
      : "https://wisand.onrender.com";
  const DEFAULT_BRANDING = {
    tenant_code: "default",
    display_name: "WISAND",
    logo_url: "",
    primary_color: "#0b63d0",
    secondary_color: "#0f172a",
    accent_color: "#ff7a18",
    updated_at: null,
  };
  const DEFAULT_LOGO = "assets/brand/wisand-logo.svg";
  const HEX_COLOR_RE = /^#([0-9a-f]{6})$/i;
  const initialDocumentTitle = document.title || "WISAND";

  const normalizeTenantCode = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const normalizeColor = (value, fallback) => {
    const raw = String(value || "").trim();
    if (!raw || !HEX_COLOR_RE.test(raw)) return String(fallback || "").toLowerCase();
    return raw.toLowerCase();
  };

  const normalizeDisplayName = (value) => {
    const raw = String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80);
    return raw || DEFAULT_BRANDING.display_name;
  };

  const normalizeLogoUrl = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
      return parsed.toString();
    } catch {
      return "";
    }
  };

  const normalizeBranding = (value, tenantCode) => ({
    tenant_code: normalizeTenantCode(value?.tenant_code || tenantCode || DEFAULT_BRANDING.tenant_code),
    display_name: normalizeDisplayName(value?.display_name),
    logo_url: normalizeLogoUrl(value?.logo_url),
    primary_color: normalizeColor(value?.primary_color, DEFAULT_BRANDING.primary_color),
    secondary_color: normalizeColor(value?.secondary_color, DEFAULT_BRANDING.secondary_color),
    accent_color: normalizeColor(value?.accent_color, DEFAULT_BRANDING.accent_color),
    updated_at: value?.updated_at || null,
  });

  const getApiBase = () => {
    const stored = String(localStorage.getItem("API_BASE") || "").trim();
    if (stored) {
      return stored.replace(/\/+$/, "");
    }
    return DEFAULT_API_BASE;
  };

  const getQueryTenantCode = () => {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return normalizeTenantCode(
        params.get("tenant") || params.get("tenant_code") || params.get("tenantCode") || ""
      );
    } catch {
      return "";
    }
  };

  const getStoredTenantCode = () => normalizeTenantCode(localStorage.getItem(TENANT_CODE_KEY) || "");

  const setStoredTenantCode = (value) => {
    const normalized = normalizeTenantCode(value);
    if (!normalized) {
      localStorage.removeItem(TENANT_CODE_KEY);
      return "";
    }
    localStorage.setItem(TENANT_CODE_KEY, normalized);
    return normalized;
  };

  const applyCssVariables = (branding) => {
    const root = document.documentElement;
    root.style.setProperty("--brand-primary", branding.primary_color);
    root.style.setProperty("--brand-secondary", branding.secondary_color);
    root.style.setProperty("--brand-accent", branding.accent_color);
    root.style.setProperty("--color-primary", branding.primary_color);
    root.style.setProperty("--color-primary-hover", branding.primary_color);
    root.style.setProperty("--color-primary-active", branding.primary_color);
    root.style.setProperty("--color-focus-ring", "rgba(11,99,208,0.35)");
  };

  const applyBrandingToDom = (branding) => {
    const displayName = branding.display_name || DEFAULT_BRANDING.display_name;
    document.querySelectorAll("[data-brand-name]").forEach((node) => {
      node.textContent = displayName;
    });

    const logoUrl = branding.logo_url || DEFAULT_LOGO;
    document.querySelectorAll("img[data-brand-logo]").forEach((img) => {
      img.src = logoUrl;
      const currentAlt = String(img.getAttribute("alt") || "").trim();
      img.alt = currentAlt || displayName;
    });

    document.title = initialDocumentTitle.includes("WISAND")
      ? initialDocumentTitle.replace(/WISAND/g, displayName)
      : `${displayName} · ${initialDocumentTitle}`;
  };

  const setBrandingState = (branding, tenantCode) => {
    const normalizedTenantCode = setStoredTenantCode(tenantCode || branding.tenant_code || "");
    const nextBranding = normalizeBranding(branding, normalizedTenantCode);

    window.WISAND_ACTIVE_TENANT_CODE = normalizedTenantCode || nextBranding.tenant_code || "";
    window.WISAND_BRANDING = nextBranding;

    applyCssVariables(nextBranding);
    applyBrandingToDom(nextBranding);

    try {
      localStorage.setItem(
        BRANDING_CACHE_KEY,
        JSON.stringify({
          tenant_code: window.WISAND_ACTIVE_TENANT_CODE || "",
          branding: nextBranding,
          saved_at: new Date().toISOString(),
        })
      );
    } catch {}

    return nextBranding;
  };

  const getCachedBranding = (tenantCode) => {
    try {
      const raw = localStorage.getItem(BRANDING_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.branding) return null;
      if (tenantCode && normalizeTenantCode(parsed.tenant_code) !== normalizeTenantCode(tenantCode)) {
        return null;
      }
      return normalizeBranding(parsed.branding, parsed.tenant_code);
    } catch {
      return null;
    }
  };

  const fetchTenantBranding = async (tenantCode) => {
    const normalizedCode = normalizeTenantCode(tenantCode);
    if (!normalizedCode) return normalizeBranding(DEFAULT_BRANDING);

    const apiBase = getApiBase();
    const url = `${apiBase.replace(/\/+$/, "")}/tenants/${encodeURIComponent(normalizedCode)}/branding`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`branding_http_${response.status}`);
    }
    const payload = await response.json();
    return normalizeBranding(payload, normalizedCode);
  };

  const loadTenantBrandingByCode = async (tenantCode, options = {}) => {
    const normalizedCode = normalizeTenantCode(tenantCode);
    if (!normalizedCode) {
      return setBrandingState(DEFAULT_BRANDING, "");
    }
    try {
      const branding = await fetchTenantBranding(normalizedCode);
      return setBrandingState(branding, normalizedCode);
    } catch (error) {
      const cached = getCachedBranding(normalizedCode);
      if (cached) {
        return setBrandingState(cached, normalizedCode);
      }
      if (options?.silent) {
        return setBrandingState(DEFAULT_BRANDING, normalizedCode);
      }
      throw error;
    }
  };

  window.getActiveTenantCode = () => window.WISAND_ACTIVE_TENANT_CODE || "";
  window.setActiveTenantCode = (tenantCode) => setStoredTenantCode(tenantCode);
  window.loadTenantBrandingByCode = loadTenantBrandingByCode;

  const init = () => {
    const fromQuery = getQueryTenantCode();
    const fromStorage = getStoredTenantCode();
    const initialCode = fromQuery || fromStorage || "";

    if (!initialCode) {
      setBrandingState(DEFAULT_BRANDING, "");
      return;
    }

    void loadTenantBrandingByCode(initialCode, { silent: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
