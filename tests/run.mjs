// Tests for the counting and the summary card. No browser needed: it loads site/app.js with stand in page objects.
//   node tests/run.mjs
// Fixtures are small made up eBird files in tests/fixtures (see make-fixtures.mjs). To check a real file the same way:
//   node tests/run.mjs --file path/to/export.csv      (prints what the summary card would show for every year)
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stub = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => "" : stub), apply: () => stub, set: () => true });
const ctx = {
  document: { getElementById: () => stub, addEventListener() {}, querySelectorAll: () => [] },
  window: { addEventListener() {}, matchMedia: () => ({ matches: false }) },
  navigator: {}, location: { search: "" }, URLSearchParams, Intl, console, File: class {}, setTimeout, setInterval, clearInterval, performance, requestAnimationFrame: () => 0,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "site", "app.js"), "utf8"), ctx);
const birds = JSON.parse(fs.readFileSync(path.join(root, "site", "data", "birds.json"), "utf8"));
ctx.__birds = birds;
vm.runInContext(`
BIRDS = __birds.rows.map((r) => Object.fromEntries(__birds.cols.map((c, i) => [c, r[i]])));
BIRDS.forEach((b, i) => { b.i = i; bySci.set(b.sci.toLowerCase(), b); const k = b.en.toLowerCase(); if (k && !byEn.has(k)) byEn.set(k, b); });
`, ctx);

// what the summary card shows for one year of one file: { headline, tiles: {label: value}, years }
function summaryFor(csvText, year) {
  ctx.__csv = csvText; ctx.__year = year || "";
  return vm.runInContext(`(() => {
    const rows = parseEbird(__csv);
    const years = listYears(rows);
    const y = __year || years[0].y;
    const s = analyze(rows, y);
    const d = summaryData(s);
    return { mode: rows.isLife ? "life list" : "all data", years: years.map((x) => x.y + ":" + x.n), year: y, headline: s.lifers.length, lifeTotal: s.lifeTotal, seen: s.nSpecies,
      tiles: Object.fromEntries(d.tiles.map(([v, l]) => [l, v])), noSticker: s.noSticker, skipped: s.skipped, undated: s.undated, countries: s.countries };
  })()`, ctx);
}
const demoSummary = () => vm.runInContext(`(() => {
  const rows = demoRows();
  const years = listYears(rows);
  const s = analyze(rows, years[0].y);
  const d = summaryData(s);
  return { year: years[0].y, headline: s.lifers.length, lifeTotal: s.lifeTotal, seen: s.nSpecies, tiles: Object.fromEntries(d.tiles.map(([v, l]) => [l, v])), wall: Math.round(s.lifers.length) };
})()`, ctx);

/* ---------- a real file given on the command line ---------- */
const fi = process.argv.indexOf("--file");
if (fi > 0) {
  const text = fs.readFileSync(process.argv[fi + 1], "utf8");
  const first = summaryFor(text);
  console.log(`${first.mode} file, years: ${first.years.join(", ")}\n`);
  for (const y of first.years.map((x) => x.split(":")[0])) {
    const r = summaryFor(text, y);
    console.log(`${y}: ${r.headline} new species | tiles ${JSON.stringify(r.tiles)}`);
  }
  process.exit(0);
}

/* ---------- the tests ---------- */
let failed = 0;
const ok = (cond, msg, detail) => { console.log((cond ? "PASS  " : "FAIL  ") + msg + (!cond && detail !== undefined ? "   got: " + JSON.stringify(detail) : "")); if (!cond) failed++; };
const life = fs.readFileSync(path.join(root, "tests", "fixtures", "life-list.csv"), "utf8");
const all = fs.readFileSync(path.join(root, "tests", "fixtures", "all-data.csv"), "utf8");

// A. a life list file
const L = summaryFor(life, "2025");
ok(L.mode === "life list", "a life list file is read as a life list", L.mode);
ok(L.headline === 21, "life list: 21 new species in 2025 (20 with stickers plus Malabar Starling, which has no sticker)", L.headline);
ok(L.lifeTotal === 31, "life list: total is 31 (escaped bird, gull sp. and slash entry are not counted; two undated birds are)", L.lifeTotal);
ok(JSON.stringify(Object.keys(L.tiles)) === JSON.stringify(["life list", "families", "countries", "new a month"]), "life list: summary tiles are life list, families, countries, new a month", Object.keys(L.tiles));
ok(!("seen in 2025" in L.tiles), "life list: there is NO 'seen in 2025' tile (a life list only has first sightings, so the number does not exist)");
ok(L.noSticker.length === 1 && L.noSticker[0] === "Malabar Starling", "life list: Malabar Starling is counted but flagged as having no sticker", L.noSticker);
ok(L.years.join(",") === "2025:21,2024:8,unknown:2", "life list: year list counts new species and puts 1 Jan 1900 under 'unknown'", L.years);
const U = summaryFor(life, "unknown");
ok(U.headline === 2 && U.undated === true, "life list: the Unknown date bucket holds the 2 undated birds", [U.headline, U.undated]);

// B. a file with all observations
const A = summaryFor(all, "2025");
ok(A.mode === "all data", "an all observations file is read as all data", A.mode);
ok(A.headline === 20, "all data: 20 new species in 2025", A.headline);
ok(A.seen === 24, "all data: 24 species seen in 2025 (20 new plus 4 older birds seen again)", A.seen);
ok(A.tiles["seen in 2025"] === "24", "all data: the summary HAS a 'seen in 2025' tile showing 24", A.tiles);
ok(A.tiles["life list"] === "28", "all data: life list is 28 (8 from 2024 + 20 from 2025)", A.tiles["life list"]);
ok(JSON.stringify(Object.keys(A.tiles)) === JSON.stringify(["life list", "seen in 2025", "families", "countries"]), "all data: tiles are life list, seen in 2025, families, countries", Object.keys(A.tiles));
ok(A.years.join(",") === "2025:20,2024:8", "all data: year list counts new species (not checklists)", A.years);
const A24 = summaryFor(all, "2024");
ok(A24.headline === 8 && A24.seen === 8, "all data: in 2024 new and seen are both 8", [A24.headline, A24.seen]);

// C. the built in demo is an all data file, so it shows 'seen this year'
const D = demoSummary();
ok("seen in " + D.year in D.tiles, "demo: the summary has a 'seen in " + D.year + "' tile", Object.keys(D.tiles));
ok(D.seen > D.headline, "demo: more species were seen than were new", [D.seen, D.headline]);
ok(D.lifeTotal > D.headline, "demo: life list is bigger than the new species count", [D.lifeTotal, D.headline]);

console.log("\n" + (failed ? failed + " test(s) failed." : "All tests passed."));
process.exit(failed ? 1 : 0);
