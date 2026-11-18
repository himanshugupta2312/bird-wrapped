// Writes the small made up eBird files that tests/run.mjs reads. The birds are real species (so they match the
// sticker data) but every date, place and count is invented. Run: node tests/make-fixtures.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const birds = JSON.parse(fs.readFileSync(path.join(here, "..", "site", "data", "birds.json"), "utf8"));
const col = (n) => birds.cols.indexOf(n);
// 60 well known species with stickers, chosen by position so the list is stable
const species = birds.rows.filter((r) => r[col("sticker")] && r[col("massG")] != null).filter((_, i) => i % 150 === 0).slice(0, 60)
  .map((r) => ({ sci: r[col("sci")], en: r[col("en")] }));

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ebirdDate = (y, m, d) => `${String(d).padStart(2, "0")} ${MON[m - 1]} ${y}`;
const isoDate = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/* ---------- 1. a life list (one row per species, first sighting only) ---------- */
const lifeHead = "Row #,Taxon Order,Category,Common Name,Scientific Name,Count,Location,S/P,Date,LocID,SubID,Exotic,Countable";
const life = [lifeHead];
let n = 0;
const lrow = (cat, en, sci, loc, sp, date, exotic, countable) => life.push([++n, 1000 + n, cat, en, sci, 1, loc, sp, date, "L" + n, "S" + n, exotic, countable].join(","));
species.slice(0, 20).forEach((b, i) => lrow("species", b.en, b.sci, "Willow Marsh", i % 4 === 0 ? "BR-SP" : "US-FL", ebirdDate(2025, 1 + (i % 12), 5 + i), "", "1")); // 20 new in 2025
species.slice(20, 28).forEach((b, i) => lrow("species", b.en, b.sci, "Ridge Trail", "US-FL", ebirdDate(2024, 1 + i, 9), "", "1"));              // 8 in 2024
species.slice(28, 30).forEach((b) => lrow("species", b.en, b.sci, "Old record", "US-FL", "01 Jan 1900", "", "1"));                              // 2 with no real date
lrow("species", "Malabar Starling", "Sturnia blythii", "Lakeside", "IN-KA", ebirdDate(2025, 6, 2), "", "1");                                   // eBird counts it, the sticker set has no picture
lrow("species", "Lilac-crowned Amazon", "Amazona finschi", "City park", "US-FL", ebirdDate(2025, 7, 3), "X", "0");                             // escaped bird, not countable
lrow("spuh", "gull sp.", "Larus sp.", "Harbor", "US-FL", ebirdDate(2025, 8, 4), "", "0");
lrow("slash", "Western/Eastern Meadowlark", "Sturnella neglecta/magna", "Prairie", "US-FL", ebirdDate(2025, 9, 5), "", "0");
fs.mkdirSync(path.join(here, "fixtures"), { recursive: true });
fs.writeFileSync(path.join(here, "fixtures", "life-list.csv"), life.join("\n") + "\n");

/* ---------- 2. "all my data": many checklists, repeat sightings, so "seen this year" is more than "new" ---------- */
const fullHead = "Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,State/Province,County,Location ID,Location,Latitude,Longitude,Date,Time,Protocol,Duration (Min),Distance Traveled (km),Area Covered (ha),All Obs Reported,Number of Observers,Breeding Code,Observation Details,Checklist Comments,ML Catalog Numbers";
const full = [fullHead];
const frow = (sid, b, sp, loc, date, time, dur) => full.push([sid, b.en, b.sci, 1, 2, sp, "County", "L" + sid, loc, 0, 0, date, time, "Traveling", dur, 1.5, "", 1, 1, "", "", "", ""].join(","));
// 2024: species 20..27 first seen (8 birds)
species.slice(20, 28).forEach((b, i) => frow("A" + i, b, "US-FL", "Ridge Trail", isoDate(2024, 1 + i, 9), "07:30 AM", 60));
// 2025: species 0..19 are new, and species 20..23 (already on the list) are seen again, so seen in 2025 = 24, new in 2025 = 20
species.slice(0, 20).forEach((b, i) => frow("B" + i, b, i % 4 === 0 ? "BR-SP" : "US-FL", "Willow Marsh", isoDate(2025, 1 + (i % 12), 5 + i), "06:45 AM", 90));
species.slice(20, 24).forEach((b, i) => frow("C" + i, b, "US-FL", "Ridge Trail", isoDate(2025, 3 + i, 12), "08:15 AM", 45));
// things that must not count as species
full.push(["D1", "gull sp.", "Larus sp.", 2, 3, "US-FL", "County", "LD1", "Harbor", 0, 0, "2025-08-04", "09:00 AM", "Traveling", 30, 1, "", 1, 1, "", "", "", ""].join(","));
full.push(["D2", "Western/Eastern Meadowlark", "Sturnella neglecta/magna", 3, 1, "US-FL", "County", "LD2", "Prairie", 0, 0, "2025-09-05", "09:00 AM", "Traveling", 30, 1, "", 1, 1, "", "", "", ""].join(","));
fs.writeFileSync(path.join(here, "fixtures", "all-data.csv"), full.join("\n") + "\n");
console.log("wrote tests/fixtures/life-list.csv (" + (life.length - 1) + " rows) and all-data.csv (" + (full.length - 1) + " rows)");
