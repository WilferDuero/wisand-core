import Constants from "expo-constants";
import { ENV } from "../config/env";
import { getApiBaseUrl } from "../api/client";

const DEFAULT_API_PORT = 3001;

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

const uniquePush = (bucket: string[], value: string) => {
  const normalized = normalizeBaseUrl(String(value || ""));
  if (!normalized) return;
  if (!bucket.includes(normalized)) {
    bucket.push(normalized);
  }
};

const parseHostFromAnyUri = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const clean = raw.replace(/^https?:\/\//i, "");
  const hostWithPort = clean.split("/")[0] || "";
  const host = hostWithPort.split(":")[0] || "";
  return host.trim();
};

const resolveExpoHostCandidates = () => {
  const hosts: string[] = [];

  const expoConfigHost = parseHostFromAnyUri(
    String((Constants.expoConfig as { hostUri?: string } | null)?.hostUri || "")
  );
  if (expoConfigHost) hosts.push(expoConfigHost);

  const debuggerHost = parseHostFromAnyUri(
    String(
      (
        Constants as {
          manifest?: { debuggerHost?: string };
          expoGoConfig?: { debuggerHost?: string };
        }
      ).manifest?.debuggerHost
        || (
          Constants as {
            manifest?: { debuggerHost?: string };
            expoGoConfig?: { debuggerHost?: string };
          }
        ).expoGoConfig?.debuggerHost
        || ""
    )
  );
  if (debuggerHost) hosts.push(debuggerHost);

  return Array.from(new Set(hosts));
};

export const buildApiBaseCandidates = () => {
  const candidates: string[] = [];

  uniquePush(candidates, getApiBaseUrl());
  uniquePush(candidates, ENV.apiBaseUrl);
  ENV.apiFallbackUrls.forEach((url) => uniquePush(candidates, url));

  if (__DEV__) {
    uniquePush(candidates, `http://localhost:${DEFAULT_API_PORT}`);
    uniquePush(candidates, `http://127.0.0.1:${DEFAULT_API_PORT}`);
    uniquePush(candidates, `http://10.0.2.2:${DEFAULT_API_PORT}`);

    resolveExpoHostCandidates().forEach((host) => {
      if (host && host !== "localhost" && host !== "127.0.0.1") {
        uniquePush(candidates, `http://${host}:${DEFAULT_API_PORT}`);
      }
    });
  }

  return candidates;
};

const fetchHealth = async (baseUrl: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

export const resolveReachableApiBase = async (
  candidates: string[],
  timeoutMs = 3500
): Promise<string | null> => {
  for (const base of candidates) {
    const ok = await fetchHealth(base, timeoutMs);
    if (ok) {
      return normalizeBaseUrl(base);
    }
  }
  return null;
};
