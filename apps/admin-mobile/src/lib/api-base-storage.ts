import * as SecureStore from "expo-secure-store";

const API_BASE_KEY = "wisand_api_base_v1";
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "wisand-core-admin",
};

const normalizeApiBase = (value: string) => {
  const normalized = String(value || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) return "";
  return normalized;
};

export const apiBaseStorage = {
  async get() {
    try {
      const stored = await SecureStore.getItemAsync(API_BASE_KEY, OPTIONS);
      return stored ? normalizeApiBase(stored) : "";
    } catch {
      return "";
    }
  },
  async set(baseUrl: string) {
    const normalized = normalizeApiBase(baseUrl);
    if (!normalized) {
      await SecureStore.deleteItemAsync(API_BASE_KEY, OPTIONS);
      return;
    }
    await SecureStore.setItemAsync(API_BASE_KEY, normalized, OPTIONS);
  },
  async clear() {
    await SecureStore.deleteItemAsync(API_BASE_KEY, OPTIONS);
  },
};

