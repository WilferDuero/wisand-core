import * as SecureStore from "expo-secure-store";

const LOGIN_HINTS_KEY = "wisand_login_hints_v1";
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "wisand-core-admin",
};

type LoginHintsPayload = {
  lastUsername?: string;
  byTenant?: Record<string, string>;
};

const normalizeTenantCode = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeUsername = (value: string) => String(value || "").trim();

const safeParse = (raw: string | null): LoginHintsPayload => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as LoginHintsPayload | null;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
};

const readHints = async (): Promise<LoginHintsPayload> => {
  try {
    const raw = await SecureStore.getItemAsync(LOGIN_HINTS_KEY, OPTIONS);
    return safeParse(raw);
  } catch {
    return {};
  }
};

const writeHints = async (payload: LoginHintsPayload) => {
  await SecureStore.setItemAsync(LOGIN_HINTS_KEY, JSON.stringify(payload), OPTIONS);
};

export const loginHintsStorage = {
  async getForTenant(tenantCode: string) {
    const tenant = normalizeTenantCode(tenantCode);
    if (!tenant) return "";

    const hints = await readHints();
    const username = hints.byTenant?.[tenant];
    return normalizeUsername(username || "");
  },

  async getLastUsername() {
    const hints = await readHints();
    return normalizeUsername(hints.lastUsername || "");
  },

  async setSuccessfulLogin(tenantCode: string, username: string) {
    const tenant = normalizeTenantCode(tenantCode);
    const normalizedUsername = normalizeUsername(username);
    if (!tenant || !normalizedUsername) return;

    const hints = await readHints();
    const byTenant = {
      ...(hints.byTenant || {}),
      [tenant]: normalizedUsername,
    };

    await writeHints({
      lastUsername: normalizedUsername,
      byTenant,
    });
  },

  async clear() {
    await SecureStore.deleteItemAsync(LOGIN_HINTS_KEY, OPTIONS);
  },
};
