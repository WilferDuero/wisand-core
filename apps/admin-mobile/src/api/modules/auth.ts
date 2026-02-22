import { request } from "../client";
import { AuthUser } from "../../types/domain";
import { ENV } from "../../config/env";

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const loginAdmin = (username: string, password: string) =>
  request<LoginResponse>({
    url: "/auth/login",
    method: "POST",
    data: { username, password, tenant_id: ENV.tenantId },
  });

export const fetchAuthMe = () =>
  request<AuthUser>({
    url: "/auth/me",
    method: "GET",
  });

