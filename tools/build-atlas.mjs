// Builds one small picture sheet ("atlas") holding a tiny version of every sticker, so a card that has to show
// hundreds of birds can draw them from one 5 MB file instead of hundreds of 60 KB originals that would each
// have to be decoded at full size (about 4 MB of memory apiece).
//
//   npm i --no-save sharp                       (the only dependency, not saved in the repo)
//   node tools/build-atlas.mjs                  (writes site/data/atlas.webp and site/data/atlas.json)
//   node tools/build-atlas.mjs --tile 40 --quality 70 --every 40 --out /tmp/test   (quick experiment)
//
// Species number i (the row in site/data/birds.json) sits at column i % cols, row floor(i / cols).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, dflt) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : dflt; };
const tile = +arg("tile", 40), cols = +arg("cols", 100), quality = +arg("quality", 72), every = +arg("every", 1);
const outDir = path.resolve(arg("out", path.join(root, "site", "data")));
const conc = +arg("concurrency", 24);

const birds = JSON.parse(fs.readFileSync(path.join(root, "site", "data", "birds.json"), "utf8"));
const sc = birds.cols.indexOf("sticker");
const N = birds.rows.length, rowsN = Math.ceil(N / cols);
const RAW = "https://raw.githubusercontent.com/alchaincyf/huashu-bird-sticker/main/stickers/";
const todo = birds.rows.map((r, i) => [i, r[sc]]).filter(([i, p]) => p && i % every === 0);
console.log(`${todo.length} stickers, tile ${tile}px, sheet ${cols * tile} x ${rowsN * tile}px, webp quality ${quality}`);

const tiles = [];
let done = 0, failed = 0, next = 0;
async function one([i, p]) {
  const url = RAW + p.split("/").map(encodeURIComponent).join("/");
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const buf = Buffer.from(await res.arrayBuffer());
      const t = await sharp(buf)
        .resize(tile, tile, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" })
        .ensureAlpha().raw().toBuffer();
      tiles.push({ i, pixels: t });
      return;
    } catch (e) { await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); }
  }
  failed++; console.log("failed:", p);
}
async function worker() {
  while (next < todo.length) {
    const job = todo[next++];
    await one(job);
    if (++done % 500 === 0) console.log(`  ${done} / ${todo.length}`);
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: conc }, worker));
console.log(`downloaded and shrunk in ${Math.round((Date.now() - t0) / 1000)}s, ${failed} failed`);

fs.mkdirSync(outDir, { recursive: true });
const W = cols * tile, H = rowsN * tile;
const out = Buffer.alloc(W * H * 4); // transparent black
for (const { i, pixels } of tiles) {
  const left = (i % cols) * tile, top = Math.floor(i / cols) * tile;
  for (let y = 0; y < tile; y++) pixels.copy(out, ((top + y) * W + left) * 4, y * tile * 4, (y + 1) * tile * 4);
}
const sheet = sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .webp({ quality, alphaQuality: 85, effort: 5, smartSubsample: true });
const file = path.join(outDir, "atlas.webp");
await sheet.toFile(file);
const bytes = fs.statSync(file).size;
fs.writeFileSync(path.join(outDir, "atlas.json"), JSON.stringify({ tile, cols, rows: rowsN, count: N, taxonomy: birds.taxonomy }));
console.log(`atlas.webp ${(bytes / 1048576).toFixed(2)} MB (${Math.round(bytes / Math.max(1, tiles.length))} bytes per sticker)`);
