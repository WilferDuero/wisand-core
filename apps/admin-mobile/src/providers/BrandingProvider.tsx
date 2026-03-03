import { ReactNode, createContext, useContext, useMemo } from "react";
import { AppTheme } from "../constants/theme";
import { useBrandingStore } from "../store/branding-store";
import { TenantBranding } from "../types/branding";

interface BrandingContextValue {
  tenantCode: string;
  branding: TenantBranding;
  theme: AppTheme;
  isLoading: boolean;
  hydrateFromCache: () => Promise<void>;
  loadBrandingByCode: (tenantCode: string) => Promise<TenantBranding>;
  resetBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

interface BrandingProviderProps {
  children: ReactNode;
}

export const BrandingProvider = ({ children }: BrandingProviderProps) => {
  const tenantCode = useBrandingStore((state) => state.tenantCode);
  const branding = useBrandingStore((state) => state.branding);
  const theme = useBrandingStore((state) => state.theme);
  const isLoading = useBrandingStore((state) => state.isLoading);
  const hydrateFromCache = useBrandingStore((state) => state.hydrateFromCache);
  const loadBrandingByCode = useBrandingStore((state) => state.loadBrandingByCode);
  const resetBranding = useBrandingStore((state) => state.resetBranding);

  const value = useMemo<BrandingContextValue>(
    () => ({
      tenantCode,
      branding,
      theme,
      isLoading,
      hydrateFromCache,
      loadBrandingByCode,
      resetBranding,
    }),
    [
      tenantCode,
      branding,
      theme,
      isLoading,
      hydrateFromCache,
      loadBrandingByCode,
      resetBranding,
    ]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error("useBranding debe usarse dentro de BrandingProvider");
  }
  return context;
};

export const useBrandTheme = () => useBranding().theme;
