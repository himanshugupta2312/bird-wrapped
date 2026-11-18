// Dev server for the standalone app: node tools/serve.mjs [port]
// Serves site/ at /wrapped/, the same path it has on himanshugupta.art.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "site");
const port = +process.argv[2] || 5173;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp" };

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  let url = decodeURIComponent(u.pathname);
  if (url === "/") { res.writeHead(302, { location: "/wrapped/" + u.search }); return res.end(); }
  if (url === "/wrapped") { res.writeHead(302, { location: "/wrapped/" + u.search }); return res.end(); }
  url = url.replace(/^\/wrapped\//, "/");
  const file = path.join(root, url === "/" ? "index.html" : url);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}/wrapped/`));
