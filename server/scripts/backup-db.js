#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});

const serverRoot = path.join(__dirname, "..");
const usePostgres = !!String(process.env.DATABASE_URL || "").trim();

function pad(value) {
  return String(value).padStart(2, "0");
}

function stamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mi = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function resolveBackupRoot() {
  const configured = String(process.env.BACKUP_DIR || "").trim();
  if (!configured) return path.join(serverRoot, "backups");
  return path.isAbsolute(configured) ? configured : path.join(serverRoot, configured);
}

function resolveSqliteDbFile() {
  const configuredDir = String(process.env.SQLITE_DIR || "").trim();
  const sqliteDir = configuredDir
    ? path.isAbsolute(configuredDir)
      ? configuredDir
      : path.join(serverRoot, configuredDir)
    : path.join(serverRoot, "data");
  return path.join(sqliteDir, "app.db");
}

function writeMeta(metaPath, payload) {
  fs.writeFileSync(metaPath, JSON.stringify(payload, null, 2));
}

function fileSizeSafe(filePath) {
  try {
    const st = fs.statSync(filePath);
    return Number(st.size) || 0;
  } catch {
    return 0;
  }
}

function maskDatabaseUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.password) url.password = "***";
    if (url.username) url.username = "***";
    return url.toString();
  } catch {
    return "***";
  }
}

function backupSqlite(backupRoot, runStamp) {
  const dbFile = resolveSqliteDbFile();
  if (!fs.existsSync(dbFile)) {
    throw new Error(`No existe archivo SQLite: ${dbFile}`);
  }

  fs.mkdirSync(backupRoot, { recursive: true });
  const folder = path.join(backupRoot, `sqlite-${runStamp}`);
  fs.mkdirSync(folder, { recursive: true });

  const copied = [];
  const files = [dbFile, `${dbFile}-wal`, `${dbFile}-shm`];

  for (const source of files) {
    if (!fs.existsSync(source)) continue;
    const target = path.join(folder, path.basename(source));
    fs.copyFileSync(source, target);
    copied.push({ file: path.basename(source), size: fileSizeSafe(target) });
  }

  const metaPath = path.join(folder, "backup-meta.json");
  writeMeta(metaPath, {
    engine: "sqlite",
    created_at: new Date().toISOString(),
    source_db: dbFile,
    folder,
    files: copied,
  });

  console.log(`[PASS] Backup sqlite creado en: ${folder}`);
  for (const item of copied) {
    console.log(`  - ${item.file} (${item.size} bytes)`);
  }
}

function backupPostgres(backupRoot, runStamp) {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL vacia para backup postgres.");
  }

  fs.mkdirSync(backupRoot, { recursive: true });
  const dumpFile = path.join(backupRoot, `postgres-${runStamp}.dump`);
  const pgDumpBin = String(process.env.PG_DUMP_BIN || "pg_dump").trim() || "pg_dump";

  const run = spawnSync(pgDumpBin, ["--format=custom", "--file", dumpFile, databaseUrl], {
    cwd: serverRoot,
    env: process.env,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (run.error) {
    if (run.error.code === "ENOENT") {
      throw new Error(
        `No se encontro '${pgDumpBin}'. Instala PostgreSQL client o define PG_DUMP_BIN con ruta completa.`
      );
    }
    throw run.error;
  }

  if (run.status !== 0) {
    const stderr = String(run.stderr || "").trim();
    throw new Error(`pg_dump fallo (code=${run.status}). ${stderr}`);
  }

  const metaPath = `${dumpFile}.json`;
  writeMeta(metaPath, {
    engine: "postgres",
    created_at: new Date().toISOString(),
    dump_file: dumpFile,
    size: fileSizeSafe(dumpFile),
    database_url: maskDatabaseUrl(databaseUrl),
  });

  console.log(`[PASS] Backup postgres creado en: ${dumpFile}`);
  console.log(`  - size: ${fileSizeSafe(dumpFile)} bytes`);
  console.log(`  - meta: ${metaPath}`);
}

function main() {
  const runStamp = stamp();
  const backupRoot = resolveBackupRoot();

  console.log(`[INFO] Engine: ${usePostgres ? "postgres" : "sqlite"}`);
  console.log(`[INFO] Backup dir: ${backupRoot}`);

  if (usePostgres) {
    backupPostgres(backupRoot, runStamp);
  } else {
    backupSqlite(backupRoot, runStamp);
  }
}

try {
  main();
  process.exit(0);
} catch (error) {
  console.error(`[FAIL] ${error?.message || String(error)}`);
  process.exit(1);
}
