// Local preview of how it looks on himanshugupta.art/wrapped.
// Serves the portfolio's site/ folder at / (with clean URLs) and this app at /wrapped/,
// which mimics the Vercel rewrite that will be used in production.
// usage: node tools/preview.mjs <path-to-portfolio-site-folder> [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "site");
const portfolio = path.resolve(process.argv[2] || "");
const port = +process.argv[3] || 8081;
if (!process.argv[2] || !fs.existsSync(portfolio)) { console.error("usage: node tools/preview.mjs <portfolio site folder> [port]"); process.exit(1); }
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".mp4": "video/mp4" };

const isFile = (f) => fs.existsSync(f) && fs.statSync(f).isFile();
function send(res, file) {
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

// keep in step with the redirects in the portfolio's vercel.json
const lookAlike = (p) => p !== "/wrapped" && (
  /^\/wrapped(?:%[0-9a-f]{2}|[^a-z0-9/%])*\/?$/i.test(p) ||   // any capitals, optional punctuation or slash: /Wrapped /WRAPPED. /wrapped, /wrapped/
  /^\/wrapped\/(?:%[0-9a-f]{2}|[^a-z0-9%])+$/i.test(p));     // /wrapped/. /wrapped//

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (lookAlike(u.pathname)) { res.writeHead(302, { location: "/wrapped" + u.search }); return res.end(); }
  const url = decodeURIComponent(u.pathname);
  if (url === "/wrapped" || url.startsWith("/wrapped/")) {
    const rel = url === "/wrapped" ? "index.html" : url.slice("/wrapped/".length) || "index.html";
    const f = path.join(app, rel);
    return f.startsWith(app) && isFile(f) ? send(res, f) : (res.writeHead(404), res.end("not found"));
  }
  const base = path.join(portfolio, url === "/" ? "index.html" : url);
  if (!base.startsWith(portfolio)) { res.writeHead(403); return res.end(); }
  for (const f of [base, base + ".html", path.join(base, "index.html")]) if (isFile(f)) return send(res, f); // cleanUrls
  const nf = path.join(portfolio, "404.html");
  res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
  res.end(isFile(nf) ? fs.readFileSync(nf) : "not found");
}).listen(port, "127.0.0.1", () => console.log(`Portfolio: http://127.0.0.1:${port}/   Wrapped: http://127.0.0.1:${port}/wrapped`));
