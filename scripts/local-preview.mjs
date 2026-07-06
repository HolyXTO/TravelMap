import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, normalize, resolve } from "node:path";

const root = resolve("dist");
const rootWithSep = root.endsWith("\\") || root.endsWith("/") ? root : `${root}\\`;
const port = Number(process.env.PORT || 4174);
const base = "/TravelMap/";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".geojson": "application/geo+json; charset=utf-8",
};

function contentType(file) {
  const dot = file.lastIndexOf(".");
  return dot >= 0 ? types[file.slice(dot).toLowerCase()] || "application/octet-stream" : "application/octet-stream";
}

function safeFilePath(urlPath) {
  if (urlPath === "/") return join(root, "index.html");
  const decoded = decodeURIComponent(urlPath);
  const withoutBase = decoded.startsWith(base) ? decoded.slice(base.length) : decoded.replace(/^\/+/, "");
  const candidate = normalize(join(root, withoutBase || "index.html"));
  if (candidate !== root && !candidate.startsWith(rootWithSep)) return null;
  return candidate;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  let file = safeFilePath(url.pathname);
  if (!file) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = join(root, "index.html");
  }
  res.writeHead(200, {
    "Content-Type": contentType(file),
    "Cache-Control": "no-store",
  });
  createReadStream(file).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`TravelMap preview: http://127.0.0.1:${port}${base}`);
});
