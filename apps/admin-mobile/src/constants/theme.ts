import { TenantBranding } from "../types/branding";

export interface AppTheme {
  colors: {
    background: string;
    surface: string;
    card: string;
    border: string;
    text: string;
    textMuted: string;
    primary: string;
    primaryStrong: string;
    danger: string;
    warning: string;
    success: string;
    gradientStart: string;
    gradientEnd: string;
    white: string;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
}

export const DEFAULT_TENANT_BRANDING: TenantBranding = {
  tenant_code: "default",
  display_name: "WISAND",
  logo_url: "",
  primary_color: "#0b63d0",
  secondary_color: "#0f172a",
  accent_color: "#ff7a18",
  updated_at: null,
};

const BASE_THEME: AppTheme = {
  colors: {
    background: "#fcfcf9",
    surface: "#fffdfd",
    card: "#ffffff",
    border: "rgba(94,82,64,0.2)",
    text: "#13343b",
    textMuted: "#626c71",
    primary: "#21808d",
    primaryStrong: "#1d7480",
    danger: "#ef4444",
    warning: "#f59e0b",
    success: "#10b981",
    gradientStart: "#0b63d0",
    gradientEnd: "#ff7a18",
    white: "#ffffff",
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
  },
};

const HEX_COLOR_RE = /^#([0-9a-f]{6})$/i;

const normalizeTenantCode = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeHexColor = (value: string | undefined, fallback: string) => {
  const raw = String(value || "").trim();
  if (!raw) return fallback.toLowerCase();
  if (!HEX_COLOR_RE.test(raw)) return fallback.toLowerCase();
  return raw.toLowerCase();
};

const hexToRgb = (hex: string) => {
  const normalized = normalizeHexColor(hex, "#000000").slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

const toRgba = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
};

const darkenHex = (hex: string, amount = 0.12) => {
  const { r, g, b } = hexToRgb(hex);
  const factor = Math.max(0, Math.min(1, 1 - amount));
  const nextR = Math.round(r * factor)
    .toString(16)
    .padStart(2, "0");
  const nextG = Math.round(g * factor)
    .toString(16)
    .padStart(2, "0");
  const nextB = Math.round(b * factor)
    .toString(16)
    .padStart(2, "0");
  return `#${nextR}${nextG}${nextB}`;
};

const normalizeDisplayName = (value: string | undefined) => {
  const raw = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return raw || DEFAULT_TENANT_BRANDING.display_name;
};

const normalizeLogoUrl = (value: string | undefined) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
};

export const normalizeTenantBranding = (
  input?: Partial<TenantBranding> | null
): TenantBranding => {
  return {
    tenant_code:
      normalizeTenantCode(String(input?.tenant_code || "")) || DEFAULT_TENANT_BRANDING.tenant_code,
    display_name: normalizeDisplayName(input?.display_name),
    logo_url: normalizeLogoUrl(input?.logo_url),
    primary_color: normalizeHexColor(input?.primary_color, DEFAULT_TENANT_BRANDING.primary_color),
    secondary_color: normalizeHexColor(
      input?.secondary_color,
      DEFAULT_TENANT_BRANDING.secondary_color
    ),
    accent_color: normalizeHexColor(input?.accent_color, DEFAULT_TENANT_BRANDING.accent_color),
    updated_at: input?.updated_at || null,
  };
};

export const buildThemeFromBranding = (input?: Partial<TenantBranding> | null): AppTheme => {
  const branding = normalizeTenantBranding(input);
  return {
    ...BASE_THEME,
    colors: {
      ...BASE_THEME.colors,
      text: branding.secondary_color,
      border: toRgba(branding.secondary_color, 0.2),
      primary: branding.primary_color,
      primaryStrong: darkenHex(branding.primary_color, 0.14),
      gradientStart: branding.primary_color,
      gradientEnd: branding.accent_color,
    },
  };
};

export const theme = BASE_THEME;
