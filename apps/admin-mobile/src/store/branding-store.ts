import { create } from "zustand";
import { fetchTenantBranding } from "../api/modules/branding";
import {
  AppTheme,
  buildThemeFromBranding,
  DEFAULT_TENANT_BRANDING,
  normalizeTenantBranding,
} from "../constants/theme";
import { brandingStorage } from "../lib/branding-storage";
import { TenantBranding } from "../types/branding";

const normalizeTenantCode = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

interface BrandingState {
  tenantCode: string;
  branding: TenantBranding;
  theme: AppTheme;
  isLoading: boolean;
  hydrateFromCache: () => Promise<void>;
  loadBrandingByCode: (tenantCode: string) => Promise<TenantBranding>;
  resetBranding: () => Promise<void>;
}

const defaultBranding = normalizeTenantBranding(DEFAULT_TENANT_BRANDING);
const defaultTheme = buildThemeFromBranding(defaultBranding);

const nextTheme = (branding: TenantBranding) => buildThemeFromBranding(branding);

export const useBrandingStore = create<BrandingState>((set, get) => ({
  tenantCode: defaultBranding.tenant_code,
  branding: defaultBranding,
  theme: defaultTheme,
  isLoading: false,

  hydrateFromCache: async () => {
    const cached = await brandingStorage.get();
    if (!cached?.branding) {
      return;
    }
    const branding = normalizeTenantBranding({
      ...cached.branding,
      tenant_code: cached.tenant_code || cached.branding.tenant_code,
    });
    set({
      tenantCode: branding.tenant_code,
      branding,
      theme: nextTheme(branding),
    });
  },

  loadBrandingByCode: async (tenantCode: string) => {
    const normalizedCode = normalizeTenantCode(tenantCode);
    if (!normalizedCode) {
      const fallback = normalizeTenantBranding(DEFAULT_TENANT_BRANDING);
      set({
        tenantCode: fallback.tenant_code,
        branding: fallback,
        theme: nextTheme(fallback),
      });
      await brandingStorage.clear();
      return fallback;
    }

    const current = get();
    if (
      current.tenantCode === normalizedCode &&
      current.branding?.tenant_code === normalizedCode &&
      current.branding.display_name
    ) {
      return current.branding;
    }

    set({ isLoading: true });
    try {
      const branding = await fetchTenantBranding(normalizedCode);
      set({
        tenantCode: normalizedCode,
        branding,
        theme: nextTheme(branding),
      });
      await brandingStorage.set({
        tenant_code: normalizedCode,
        branding,
        saved_at: new Date().toISOString(),
      });
      return branding;
    } catch (error) {
      const cached = await brandingStorage.get();
      if (cached?.tenant_code === normalizedCode && cached.branding) {
        const branding = normalizeTenantBranding(cached.branding);
        set({
          tenantCode: normalizedCode,
          branding,
          theme: nextTheme(branding),
        });
        return branding;
      }
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  resetBranding: async () => {
    const fallback = normalizeTenantBranding(DEFAULT_TENANT_BRANDING);
    set({
      tenantCode: fallback.tenant_code,
      branding: fallback,
      theme: nextTheme(fallback),
      isLoading: false,
    });
    await brandingStorage.clear();
  },
}));
