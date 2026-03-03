import { request } from "../client";
import { normalizeTenantBranding } from "../../constants/theme";
import { TenantBranding } from "../../types/branding";

const normalizeTenantCode = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const fetchTenantBranding = async (tenantCode: string): Promise<TenantBranding> => {
  const normalizedCode = normalizeTenantCode(tenantCode);
  const payload = await request<Partial<TenantBranding>>({
    url: `/tenants/${encodeURIComponent(normalizedCode)}/branding`,
    method: "GET",
    skipUnauthorizedHandler: true,
  });

  return normalizeTenantBranding({
    ...payload,
    tenant_code: normalizedCode,
  });
};
