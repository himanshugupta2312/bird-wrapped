// Dev server for the standalone app: node tools/serve.mjs [port]
// Serves site/ at /wrapped, the same path it has on himanshugupta.art, and sends look alike addresses
// (/wrapped/ /wrapped. /wrapped, /wrapped) /Wrapped ...) to /wrapped, like the Vercel rules in vercel.json do.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "site");
const port = +process.argv[2] || 5173;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp" };

// keep in step with the redirects in vercel.json
const lookAlike = (p) =>
  /^\/wrapped(?:%[0-9A-Fa-f]{2}|[^a-zA-Z0-9/%])+$/.test(p) ||   // /wrapped. /wrapped, /wrapped) /wrapped%20
  /^\/wrapped\/(?:%[0-9A-Fa-f]{2}|[^a-zA-Z0-9%])+$/.test(p) ||  // /wrapped/. /wrapped//
  p === "/wrapped/" || p === "/Wrapped" || p === "/WRAPPED";

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const p = u.pathname;
  const go = (to) => { res.writeHead(302, { location: to + u.search }); res.end(); };
  if (p === "/") return go("/wrapped");
  if (lookAlike(p)) return go("/wrapped");
  const url = p === "/wrapped" ? "/" : decodeURIComponent(p).replace(/^\/wrapped\//, "/");
  const file = path.join(root, url === "/" ? "index.html" : url);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}/wrapped`));
