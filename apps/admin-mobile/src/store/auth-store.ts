import { create } from "zustand";
import { fetchAuthMe, loginAdmin } from "../api/modules/auth";
import { unregisterPushDevice } from "../api/modules/notifications";
import { AuthUser } from "../types/domain";
import { getActivePushToken, setActivePushToken } from "../lib/push-session";
import { tokenStorage } from "../lib/token-storage";
import { apiBaseStorage } from "../lib/api-base-storage";
import { setApiBaseUrl, setAuthTokenResolver, setUnauthorizedHandler } from "../api/client";
import { useBrandingStore } from "./branding-store";

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  token: string | null;
  authNotice: string | null;
  isBootstrapping: boolean;
  isLoginPending: boolean;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string, tenantCode?: string) => Promise<void>;
  logout: (options?: { skipPushUnregister?: boolean; notice?: string | null }) => Promise<void>;
  consumeAuthNotice: () => void;
}

const normalizeTenantCode = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const syncBrandingWithTenant = async (tenantCode: string | null | undefined) => {
  const normalizedCode = normalizeTenantCode(tenantCode);
  if (!normalizedCode) {
    await useBrandingStore.getState().resetBranding();
    return;
  }
  try {
    await useBrandingStore.getState().loadBrandingByCode(normalizedCode);
  } catch {
    await useBrandingStore.getState().resetBranding();
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "checking",
  user: null,
  token: null,
  authNotice: null,
  isBootstrapping: false,
  isLoginPending: false,

  bootstrap: async () => {
    if (get().isBootstrapping) {
      return;
    }
    set({ isBootstrapping: true, status: "checking" });

    try {
      const storedApiBase = await apiBaseStorage.get();
      if (storedApiBase) {
        setApiBaseUrl(storedApiBase);
      }

      const token = await tokenStorage.get();
      if (!token) {
        setActivePushToken(null);
        await useBrandingStore.getState().resetBranding();
        set({ status: "unauthenticated", user: null, token: null, authNotice: null });
        return;
      }

      set({ token });
      const user = await fetchAuthMe();
      await syncBrandingWithTenant(user?.tenant_code);
      set({ status: "authenticated", user, token, authNotice: null });
    } catch {
      setActivePushToken(null);
      await tokenStorage.clear();
      await useBrandingStore.getState().resetBranding();
      set({ status: "unauthenticated", user: null, token: null });
    } finally {
      set({ isBootstrapping: false });
    }
  },

  login: async (username: string, password: string, tenantCode?: string) => {
    set({ isLoginPending: true });
    try {
      const result = await loginAdmin(username, password, tenantCode);
      await tokenStorage.set(result.token);
      await syncBrandingWithTenant(result.user?.tenant_code || tenantCode);
      set({
        status: "authenticated",
        token: result.token,
        user: result.user,
        authNotice: null,
      });
    } finally {
      set({ isLoginPending: false });
    }
  },

  logout: async (options) => {
    const skipPushUnregister = !!options?.skipPushUnregister;
    const notice = options?.notice;
    const activePushToken = getActivePushToken();
    if (!skipPushUnregister && activePushToken) {
      try {
        await unregisterPushDevice(activePushToken);
      } catch {
      }
    }
    if (activePushToken) {
      setActivePushToken(null);
    }
    await tokenStorage.clear();
    await useBrandingStore.getState().resetBranding();
    set({
      status: "unauthenticated",
      token: null,
      user: null,
      isLoginPending: false,
      authNotice: notice === undefined ? get().authNotice : notice,
    });
  },

  consumeAuthNotice: () => {
    if (get().authNotice) {
      set({ authNotice: null });
    }
  },
}));

setAuthTokenResolver(() => useAuthStore.getState().token);
setUnauthorizedHandler(() => {
  const state = useAuthStore.getState();
  if (state.status === "authenticated") {
    void state.logout({
      skipPushUnregister: true,
      notice: "Tu sesion expiro. Vuelve a iniciar sesion.",
    });
  }
});

