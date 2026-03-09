#!/usr/bin/env node
const path = require("path");
const { spawn, spawnSync } = require("child_process");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});

const serverRoot = path.join(__dirname, "..");
const apiBase = String(process.env.TEST_API_BASE || process.env.API_BASE || `http://localhost:${process.env.PORT || 3001}`)
  .trim()
  .replace(/\/+$/, "");

const steps = [];

function log(prefix, message) {
  console.log(`${prefix} ${message}`);
}

function pass(step, detail = "") {
  steps.push({ step, ok: true, detail });
  log("[PASS]", `${step}${detail ? ` - ${detail}` : ""}`);
}

function fail(step, detail = "") {
  steps.push({ step, ok: false, detail });
  log("[FAIL]", `${step}${detail ? ` - ${detail}` : ""}`);
}

function runNodeScript(scriptName) {
  const fullPath = path.join(__dirname, scriptName);
  const run = spawnSync(process.execPath, [fullPath], {
    cwd: serverRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (run.status !== 0) {
    throw new Error(`${scriptName} fallo (status=${run.status ?? "n/a"}).`);
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopApiProcess(proc) {
  if (!proc) return;
  if (proc.exitCode !== null || proc.killed) return;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }

  proc.kill("SIGTERM");
  await sleep(400);
  if (proc.exitCode === null && !proc.killed) {
    proc.kill("SIGKILL");
  }
}

async function checkHealth() {
  try {
    const response = await fetch(`${apiBase}/health`);
    if (!response.ok) return { ok: false };
    const payload = await response.json().catch(() => null);
    return { ok: !!payload?.ok, payload };
  } catch {
    return { ok: false };
  }
}

async function waitForHealth(timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const health = await checkHealth();
    if (health.ok) return health.payload || null;
    await sleep(500);
  }
  return null;
}

async function runStep(stepName, fn) {
  try {
    await fn();
    pass(stepName);
    return true;
  } catch (error) {
    fail(stepName, error?.message || String(error));
    return false;
  }
}

async function main() {
  log("[INFO]", `API base: ${apiBase}`);

  const preHealth = await checkHealth();
  let startedLocalApi = false;
  let apiProcess = null;

  if (preHealth.ok) {
    pass("API disponible", "usando instancia existente");
  } else {
    log("[INFO]", "API no disponible. Iniciando server/index.js temporal...");
    apiProcess = spawn(process.execPath, ["index.js"], {
      cwd: serverRoot,
      stdio: "inherit",
      env: process.env,
    });
    startedLocalApi = true;

    const healthy = await waitForHealth(25000);
    if (!healthy?.ok) {
      throw new Error("No se pudo levantar API en /health dentro del timeout.");
    }
    pass("API disponible", "levantada por ops:first-client");
  }

  try {
    const okGoLive = await runStep("check:golive", async () => runNodeScript("go-live-check.js"));
    if (!okGoLive) throw new Error("Detenido: check:golive fallo.");

    const okMulti = await runStep("test:multitenant", async () => runNodeScript("test-multitenant.js"));
    if (!okMulti) throw new Error("Detenido: test:multitenant fallo.");

    const okReady = await runStep("test:readiness", async () => runNodeScript("test-pos-readiness.js"));
    if (!okReady) throw new Error("Detenido: test:readiness fallo.");

    const okBackup = await runStep("backup:db", async () => runNodeScript("backup-db.js"));
    if (!okBackup) throw new Error("Detenido: backup:db fallo.");
  } finally {
    if (startedLocalApi) {
      await stopApiProcess(apiProcess);
    }
  }

  const total = steps.length;
  const failed = steps.filter((s) => !s.ok).length;
  const passed = total - failed;

  log("[INFO]", `Resumen ops:first-client => PASS:${passed} FAIL:${failed}`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

main().catch((error) => {
  log("[FAIL]", error?.message || String(error));
  const total = steps.length;
  const failed = steps.filter((s) => !s.ok).length + 1;
  const passed = Math.max(0, total - (failed - 1));
  log("[INFO]", `Resumen ops:first-client => PASS:${passed} FAIL:${failed}`);
  process.exit(1);
});