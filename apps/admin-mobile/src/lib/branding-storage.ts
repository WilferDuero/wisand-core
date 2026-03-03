import * as SecureStore from "expo-secure-store";
import { TenantBranding } from "../types/branding";

const BRANDING_KEY = "wisand_branding_cache_v1";
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "wisand-core-admin",
};

interface BrandingCachePayload {
  tenant_code: string;
  branding: TenantBranding;
  saved_at: string;
}

export const brandingStorage = {
  async get(): Promise<BrandingCachePayload | null> {
    try {
      const raw = await SecureStore.getItemAsync(BRANDING_KEY, OPTIONS);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as BrandingCachePayload;
      if (!parsed?.tenant_code || !parsed?.branding) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  },
  async set(payload: BrandingCachePayload) {
    await SecureStore.setItemAsync(BRANDING_KEY, JSON.stringify(payload), OPTIONS);
  },
  async clear() {
    await SecureStore.deleteItemAsync(BRANDING_KEY, OPTIONS);
  },
};
