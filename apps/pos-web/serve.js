const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3030);
const ROOT = __dirname;
const POS_API_BASE_URL = String(process.env.POS_API_BASE_URL || "http://localhost:3001")
  .trim()
  .replace(/\/+$/, "");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function safePath(urlPath) {
  const raw = decodeURIComponent(String(urlPath || "/").split("?")[0]);
  const relative = raw === "/" ? "index.html" : raw.replace(/^[/\\]+/, "");
  const resolved = path.resolve(ROOT, relative);
  if (!resolved.startsWith(ROOT)) {
    return null;
  }
  return resolved;
}

const server = http.createServer((req, res) => {
  const routePath = String(req.url || "").split("?")[0] || "/";
  if (routePath === "/config.js") {
    const payload = `window.__WISAND_POS_CONFIG = ${JSON.stringify({
      apiBase: POS_API_BASE_URL,
    })};`;
    res.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(payload);
    return;
  }

  const filePath = safePath(req.url);
  if (!filePath) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad Request");
    return;
  }

  fs.stat(filePath, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Internal Server Error");
        return;
      }

      res.writeHead(200, {
        "Content-Type": type,
        "Cache-Control": "no-store",
      });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`[pos-web] http://localhost:${PORT}`);
  console.log(`[pos-web] API base por defecto: ${POS_API_BASE_URL}`);
});
