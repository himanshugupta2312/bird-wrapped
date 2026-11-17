// Builds data/birds.json (compact index) from huashu-bird-sticker data/species.json
// usage: node tools/build-data.mjs <path-to-species.json>
import fs from "node:fs";

const src = process.argv[2];
if (!src) { console.error("usage: node tools/build-data.mjs <species.json>"); process.exit(1); }
const j = JSON.parse(fs.readFileSync(src, "utf8"));

const cols = ["sci", "en", "order", "family", "familyEn", "sticker", "massG", "habitat", "migration", "iucn"];
const rows = j.species.map((s) => [
  s.scientificName,
  s.names?.en || "",
  s.taxonomy?.order || "",
  s.taxonomy?.family || "",
  s.taxonomy?.familyEnglish || "",
  (s.sticker?.file || "").replace(/^stickers\//, ""),
  s.traits?.massG != null ? Math.round(s.traits.massG * 10) / 10 : null,
  s.traits?.habitat || "",
  s.traits?.migration || "",
  s.conservation?.iucn || "",
]);

fs.writeFileSync(new URL("../site/data/birds.json", import.meta.url), JSON.stringify({ taxonomy: j.taxonomy, cols, rows }));
console.log("wrote", rows.length, "species");
