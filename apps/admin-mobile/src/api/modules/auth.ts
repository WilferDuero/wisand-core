import { request } from "../client";
import { ENV } from "../../config/env";
import { AuthUser } from "../../types/domain";

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const loginAdmin = (username: string, password: string, tenantCode?: string) => {
  const normalizedTenantCode = String(tenantCode || "")
    .trim()
    .toLowerCase();
  const payload = normalizedTenantCode
    ? { username, password, tenant_code: normalizedTenantCode }
    : { username, password, tenant_id: ENV.tenantId };

  return request<LoginResponse>({
    url: "/auth/login",
    method: "POST",
    data: payload,
  });
};

export const fetchAuthMe = () =>
  request<AuthUser>({
    url: "/auth/me",
    method: "GET",
  });
