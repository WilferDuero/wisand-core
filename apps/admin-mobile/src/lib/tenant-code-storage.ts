import * as SecureStore from "expo-secure-store";

const TENANT_CODE_KEY = "wisand_tenant_code_v1";
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "wisand-core-admin",
};

const normalizeTenantCode = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const tenantCodeStorage = {
  async get() {
    try {
      const stored = await SecureStore.getItemAsync(TENANT_CODE_KEY, OPTIONS);
      return stored ? normalizeTenantCode(stored) : "";
    } catch {
      return "";
    }
  },
  async set(code: string) {
    const normalized = normalizeTenantCode(code);
    if (!normalized) {
      await SecureStore.deleteItemAsync(TENANT_CODE_KEY, OPTIONS);
      return;
    }
    await SecureStore.setItemAsync(TENANT_CODE_KEY, normalized, OPTIONS);
  },
  async clear() {
    await SecureStore.deleteItemAsync(TENANT_CODE_KEY, OPTIONS);
  },
};
