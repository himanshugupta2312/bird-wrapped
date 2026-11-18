// Smoke test for any deployment of Birding Wrapped.
//   node tools/check.mjs http://127.0.0.1:5173            (local: run node tools/serve.mjs first)
//   node tools/check.mjs https://bird-wrapped.vercel.app  (standalone deployment)
//   node tools/check.mjs https://www.himanshugupta.art    (inside the portfolio site)
// Exits with code 1 if anything fails, so it can also run in CI.

const base = (process.argv[2] || "http://127.0.0.1:5173").replace(/\/$/, "");
let failures = 0;
const ok = (pass, msg) => { console.log((pass ? "PASS  " : "FAIL  ") + msg); if (!pass) failures++; };
const get = (p, opts) => fetch(p.startsWith("http") ? p : base + p, { redirect: "follow", ...opts });

console.log("Checking " + base + "\n");

// 1. the page answers with and without the trailing slash
let html = "";
for (const p of ["/wrapped", "/wrapped/"]) {
  try {
    const r = await get(p);
    const type = r.headers.get("content-type") || "";
    ok(r.ok && type.includes("text/html"), p + " serves the page (" + r.status + ")");
    if (p === "/wrapped/") html = await r.text();
  } catch (e) { ok(false, p + " could not be fetched: " + e.message); }
}
if (!html) { console.log("\nNo page to inspect, stopping."); process.exit(1); }

// 2. every file the page asks for from this site loads
const own = [...new Set([...html.matchAll(/(?:src|href)="(\/wrapped\/[^"#]+)"/g)].map((m) => m[1]))];
for (const ref of own) {
  const r = await get(ref);
  ok(r.ok, ref + " loads (" + r.status + ")");
}

// 3. the bird index is present and complete
let birds = null;
try { birds = await (await get("/wrapped/data/birds.json")).json(); } catch { /* reported below */ }
ok(!!birds && Array.isArray(birds.rows) && birds.rows.length > 10000, "bird index has " + (birds && birds.rows ? birds.rows.length : 0) + " species");

// 4. standalone safety: no link may point at a path that only exists on another site
const internal = [...new Set([...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]))].filter((h) => !h.startsWith("/wrapped"));
ok(internal.length === 0, internal.length ? "links that only work on another site: " + internal.join(", ") : "no links depend on another site");

// 5. the outside things the page needs (libraries, fonts, sticker images with CORS for the PNG export)
const external = [...new Set([...html.matchAll(/(?:src|href)="(https:\/\/(?:cdnjs\.cloudflare\.com|fonts\.googleapis\.com)[^"]+)"/g)].map((m) => m[1]))];
for (const url of external) {
  try { const r = await get(url); ok(r.ok, url.slice(0, 70) + " loads (" + r.status + ")"); } catch (e) { ok(false, url.slice(0, 70) + " " + e.message); }
}
if (birds && birds.rows.length) {
  const col = birds.cols.indexOf("sticker");
  const sample = birds.rows.find((r) => r[col]);
  const url = "https://cdn.jsdelivr.net/gh/alchaincyf/huashu-bird-sticker@main/stickers/" + sample[col].split("/").map(encodeURIComponent).join("/");
  try {
    const r = await get(url, { headers: { origin: base } });
    ok(r.ok && !!r.headers.get("access-control-allow-origin"), "sticker CDN answers with CORS (needed for the PNG export)");
  } catch (e) { ok(false, "sticker CDN: " + e.message); }
}

// 6. the attribution the licence requires is on the page
ok(/huashu-bird-sticker/.test(html) && /CC BY 4\.0/.test(html), "sticker credit and licence are on the page");

console.log("\n" + (failures ? failures + " check(s) failed." : "All checks passed."));
process.exit(failures ? 1 : 0);
