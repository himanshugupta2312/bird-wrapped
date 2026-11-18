"use strict";

const CDN = "https://cdn.jsdelivr.net/gh/alchaincyf/huashu-bird-sticker@main/stickers/";
const RAW = "https://raw.githubusercontent.com/alchaincyf/huashu-bird-sticker/main/stickers/";
const IUCN_RANK = { CR: 5, EN: 4, VU: 3, NT: 2, LC: 1 };
const IUCN_NAME = { CR: "Critically Endangered", EN: "Endangered", VU: "Vulnerable", NT: "Near Threatened" };
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Math.round(n).toLocaleString("en-US");

let BIRDS = null;            // [{sci,en,order,family,familyEn,sticker,massG,habitat,migration,iucn}]
let bySci = new Map();
let byEn = new Map();
let ROWS = [];               // parsed observations
let YEAR = null;
let slideEls = [];
let cur = 0;
let isDemo = false;

/* ------------------------------------------------------------------ data */

async function loadBirds() {
  if (BIRDS) return;
  const res = await fetch("/wrapped/data/birds.json");
  if (!res.ok) throw new Error("Could not load data/birds.json (" + res.status + ")");
  const j = await res.json();
  BIRDS = j.rows.map((r) => Object.fromEntries(j.cols.map((c, i) => [c, r[i]])));
  BIRDS.forEach((b, i) => {
    b.i = i;
    bySci.set(b.sci.toLowerCase(), b);
    const k = b.en.toLowerCase();
    if (k && !byEn.has(k)) byEn.set(k, b);
  });
}

const stickerUrl = (b) => (b && b.sticker ? CDN + b.sticker.split("/").map(encodeURIComponent).join("/") : "");
const img = (b, cls = "", extra = "") =>
  b && b.sticker ? `<img ${cls ? `class="${cls}"` : ""} ${extra} data-b="${b.i}" tabindex="0" role="button" crossorigin="anonymous" alt="${esc(b.en)}, show details" src="${stickerUrl(b)}">` : "";

/* ------------------------------------------------------------------- csv */

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", q = false;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const MON3 = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function parseDate(s) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/.exec(s); // "24 Oct 2026"
  const mi = m ? MON3.indexOf(m[2].toLowerCase()) : -1;
  return mi < 0 ? null : `${m[3]}-${String(mi + 1).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}`;
}

// Location names can be street addresses with coordinates. Never print those on a shareable card.
function cleanLoc(s) {
  if (!s) return "";
  const hadCoords = /\(-?\d+\.\d+,\s*-?\d+\.\d+\)/.test(s);
  let t = s.replace(/\s*\(-?\d+\.\d+,\s*-?\d+\.\d+\)/, "").trim();
  const parts = t.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3 && (hadCoords || /^\d/.test(parts[0]))) t = parts.slice(1).join(", ");
  return t;
}
const regionName = (() => {
  try { const dn = new Intl.DisplayNames(["en"], { type: "region" }); return (code) => { try { return dn.of(code) || code; } catch { return code; } }; }
  catch { return (code) => code; }
})();

function parseTime(t) {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(t || "");
  if (!m) return null;
  let h = +m[1];
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h + +m[2] / 60;
}

function parseEbird(text) {
  const t = parseCSV(text);
  if (t.length < 2) throw new Error("That file looks empty.");
  const head = t[0].map((h) => h.trim().toLowerCase());
  const col = (...names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const c = {
    sid: col("submission id"), en: col("common name", "common_name", "name", "species name"),
    sci: col("scientific name", "scientific_name", "latin name", "species"),
    count: col("count", "number", "quantity"), state: col("state/province", "s/p"),
    loc: col("location", "place", "place_guess"), date: col("date", "observed_on", "observation date", "date observed"),
    time: col("time", "time_observed_at"), dur: col("duration (min)"), dist: col("distance traveled (km)"), cat: col("category"),
  };
  // eBird's "life list" export: one row per species, SubID instead of Submission ID.
  // Any other CSV with a species column and a date column is treated the same way (first sightings).
  const isLife = c.sid < 0;
  if (isLife) c.sid = col("subid");
  if ((c.sci < 0 && c.en < 0) || c.date < 0) {
    throw new Error("I couldn't find a species column and a date column in that file. It needs something like Scientific Name (or Common Name) and Date.");
  }
  const get = (r, i) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const out = [];
  out.isLife = isLife;
  out.dropped = []; // rows removed before matching, with the reason
  const catReason = { slash: "slash", spuh: "spuh", hybrid: "hybrid", domestic: "domestic", form: "form" };
  for (let i = 1; i < t.length; i++) {
    const r = t[i];
    if (r.length < 3) continue;
    const date = parseDate(get(r, c.date));
    if (!date) { out.undated = (out.undated || 0) + 1; continue; }
    if (c.cat >= 0 && !/^(species|issf)$/i.test(get(r, c.cat))) {
      const cat = get(r, c.cat).toLowerCase();
      out.dropped.push({ date, name: get(r, c.en) || get(r, c.sci), reason: catReason[cat] || "form" });
      continue;
    }
    const n = parseInt(get(r, c.count), 10);
    out.push({
      sid: get(r, c.sid) || date + "|" + get(r, c.loc), en: get(r, c.en), sci: get(r, c.sci), count: Number.isFinite(n) ? n : 0,
      state: get(r, c.state), loc: get(r, c.loc), date, hour: parseTime(get(r, c.time)),
      dur: parseFloat(get(r, c.dur)) || 0, dist: parseFloat(get(r, c.dist)) || 0,
    });
  }
  return out;
}

/* ------------------------------------------------------------- matching */

// Why a row can't be matched to one species: "slash", "spuh", "hybrid", "domestic", or "nomatch" (name not in the sticker set)
function skipReason(sci, en) {
  const s = (sci || "").trim();
  if (/\bdomestic\b/i.test(en)) return "domestic";
  if (/\//.test(s) || /\//.test(en)) return "slash";
  if (/\bsp\.|\bsp$/i.test(s) || /\bsp\.$/i.test(en)) return "spuh";
  if (/\bx\b/i.test(s) || /\bx\b|\(hybrid\)/i.test(en)) return "hybrid";
  if (/\(.*\)/.test(s)) return "slash";
  return null;
}

const resolveCache = new Map();
function resolve(sci, en) {
  const key = sci + "|" + en;
  if (resolveCache.has(key)) return resolveCache.get(key);
  let hit = null;
  const s = sci.trim();
  // skip slashes (A/B), spuhs (Genus sp.), hybrids (A x B) and domestic forms
  if ((s || en) && !skipReason(sci, en)) {
    const lc = s.toLowerCase();
    hit = bySci.get(lc);
    if (!hit) {
      const two = lc.split(/\s+/).slice(0, 2).join(" ");
      hit = bySci.get(two);
    }
    if (!hit && en) {
      hit = byEn.get(en.toLowerCase()) || byEn.get(en.replace(/\s*\(.*?\)\s*/g, "").toLowerCase());
    }
  }
  resolveCache.set(key, hit || null);
  return hit || null;
}

/* ------------------------------------------------------------- analysis */

const dayNum = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;

function listYears(rows) {
  const m = new Map();
  rows.forEach((r) => { const y = r.date.slice(0, 4); m.set(y, (m.get(y) || new Set()).add(rows.isLife ? r.sci : r.sid)); });
  return [...m.entries()].map(([y, s]) => ({ y, n: s.size })).sort((a, b) => b.y - a.y);
}

function analyze(rows, year) {
  // match every row once
  let skipped = 0;
  const skipInfo = new Map(); // reason -> Map(name -> rows), for the selected year only
  const noteSkip = (r, reason, name) => {
    if (!r.date.startsWith(year)) return;
    skipped++;
    const m = skipInfo.get(reason) || new Map();
    m.set(name, (m.get(name) || 0) + 1);
    skipInfo.set(reason, m);
  };
  const obs = [];
  for (const r of rows) {
    const b = resolve(r.sci, r.en);
    if (!b) { noteSkip(r, skipReason(r.sci, r.en) || "nomatch", r.en || r.sci); continue; }
    obs.push({ ...r, b });
  }
  for (const d of rows.dropped || []) noteSkip(d, d.reason, d.name);

  const firstSeen = new Map(), firstRow = new Map();
  for (const o of obs) {
    const f = firstSeen.get(o.b.i);
    if (!f || o.date < f) { firstSeen.set(o.b.i, o.date); firstRow.set(o.b.i, o); }
  }

  const yr = obs.filter((o) => o.date.startsWith(year));
  const allYearRows = rows.filter((r) => r.date.startsWith(year));

  const lists = new Map(); // sid -> {date,hour,dur,dist,loc,state}
  for (const r of allYearRows) {
    if (!lists.has(r.sid)) lists.set(r.sid, { date: r.date, hour: r.hour, dur: r.dur, dist: r.dist, loc: r.loc, state: r.state });
  }

  const sp = new Map(); // idx -> {b, lists:Set, total}
  for (const o of yr) {
    let e = sp.get(o.b.i);
    if (!e) sp.set(o.b.i, (e = { b: o.b, lists: new Set(), total: 0 }));
    e.lists.add(o.sid);
    e.total += o.count;
  }
  const species = [...sp.values()];

  const lifers = species
    .filter((e) => (firstSeen.get(e.b.i) || "").startsWith(year))
    .map((e) => ({ b: e.b, date: firstSeen.get(e.b.i) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let hours = 0, km = 0, birds = 0;
  lists.forEach((l) => { hours += l.dur / 60; km += l.dist; });
  species.forEach((e) => { birds += e.total; });

  const locCount = new Map();
  lists.forEach((l) => { if (l.loc) locCount.set(l.loc, (locCount.get(l.loc) || 0) + 1); });
  const life = !!rows.isLife;
  // life lists: group by cleaned place, counting new species rather than checklists
  let topLoc;
  const countries = new Set();
  const countryCount = new Map(), placeCount = new Map();
  if (life) {
    for (const o of yr) {
      const cc = o.state ? o.state.split("-")[0] : "";
      if (cc) { countries.add(cc); countryCount.set(cc, (countryCount.get(cc) || 0) + 1); }
      const p = cleanLoc(o.loc);
      if (p) placeCount.set(p, (placeCount.get(p) || 0) + 1);
    }
    topLoc = [...placeCount.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  } else {
    topLoc = [...locCount.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    topLoc = topLoc && [cleanLoc(topLoc[0]), topLoc[1]];
    lists.forEach((l) => {
      if (l.state) { const cc = l.state.split("-")[0]; countries.add(cc); countryCount.set(cc, (countryCount.get(cc) || 0) + 1); }
      const p = cleanLoc(l.loc);
      if (p) placeCount.set(p, (placeCount.get(p) || 0) + 1);
    });
  }
  const topCountries = [...countryCount.entries()].sort((a, b) => b[1] - a[1]);
  const lifeBefore = [...firstSeen.values()].filter((d) => d < year + "-01-01").length;

  const byFreq = [...species].sort((a, b) => b.lists.size - a.lists.size || b.total - a.total);
  const byCount = [...species].sort((a, b) => b.total - a.total);

  const famMap = new Map();
  species.forEach((e) => {
    const k = e.b.familyEn || e.b.family;
    const f = famMap.get(k) || { name: k, n: 0, members: [] };
    f.n++; f.members.push(e); famMap.set(k, f);
  });
  const families = [...famMap.values()].sort((a, b) => b.n - a.n);

  const withMass = species.filter((e) => e.b.massG != null);
  const biggest = [...withMass].sort((a, b) => b.b.massG - a.b.massG)[0] || null;
  const smallest = [...withMass].sort((a, b) => a.b.massG - b.b.massG)[0] || null;

  const threatened = species
    .filter((e) => (IUCN_RANK[e.b.iucn] || 0) >= 3)
    .sort((a, b) => IUCN_RANK[b.b.iucn] - IUCN_RANK[a.b.iucn] || a.lists.size - b.lists.size);

  const months = new Array(12).fill(0);
  if (life) yr.forEach((o) => { months[+o.date.slice(5, 7) - 1]++; });
  else lists.forEach((l) => { months[+l.date.slice(5, 7) - 1]++; });
  const peakMonth = months.indexOf(Math.max(...months));

  const hoursArr = [...lists.values()].map((l) => l.hour).filter((h) => h != null).sort((a, b) => a - b);
  const medianHour = hoursArr.length ? hoursArr[Math.floor(hoursArr.length / 2)] : null;

  const days = [...new Set([...lists.values()].map((l) => l.date))].sort();
  let streak = 0, run = 0, prev = null, streakEnd = null;
  for (const d of days) {
    const n = dayNum(d);
    run = prev !== null && n - prev === 1 ? run + 1 : 1;
    if (run > streak) { streak = run; streakEnd = d; }
    prev = n;
  }

  // species count in the previous year, for a comparison
  const prevYear = String(+year - 1);
  const prevSp = new Set(obs.filter((o) => o.date.startsWith(prevYear)).map((o) => o.b.i));

  const topShare = topLoc ? topLoc[1] / Math.max(1, lists.size) : 0;
  let persona;
  if (life) {
    const peak = Math.max(...months);
    if (countries.size >= 3) persona = { name: "The Globetrotter", why: `New birds from ${countries.size} countries this year.` };
    else if (lists.size && peak / lists.size > 0.4) persona = { name: "The Migration Chaser", why: "Most of your new birds came in one burst. You know when the good stuff moves through." };
    else persona = { name: "The Steady Collector", why: "New birds all year round. The list just keeps growing." };
  } else if (countries.size >= 3) persona = { name: "The Globetrotter", why: `You birded in ${countries.size} countries this year.` };
  else if (topLoc && topShare > 0.5 && lists.size >= 15) persona = { name: "The Patch Devotee", why: `${Math.round(topShare * 100)}% of your checklists came from one place. You know every bush.` };
  else if (medianHour != null && (medianHour < 5 || medianHour >= 20)) persona = { name: "The Night Owl", why: "Your typical checklist starts in the dark. The owls know your name." };
  else if (medianHour != null && medianHour < 8.5) persona = { name: "The Dawn Chorus", why: "Half your checklists started before 8:30 am. You're out when the birds are loudest." };
  else if (medianHour != null && medianHour >= 16) persona = { name: "The Dusk Patroller", why: "You do your birding when the light goes golden." };
  else if (species.length >= 250) persona = { name: "The Species Hunter", why: "Hundreds of species in a year takes serious dedication." };
  else persona = { name: "The Steady Observer", why: "You show up, you look up, you write it down." };

  return {
    places: [...placeCount.entries()].sort((a, b) => b[1] - a[1]), firstRow, byIdx: new Map(species.map((e) => [e.b.i, e])), life, topCountries, lifeBefore, lifeTotal: lifeBefore + lifers.length,
    year, skipped, skipInfo, totalRows: allYearRows.length + (rows.dropped || []).filter((d) => d.date.startsWith(year)).length, nLists: lists.size, nSpecies: species.length, nBirds: birds,
    hours, km, nLocs: locCount.size, countries: countries.size, topLoc, species, byFreq, byCount, families,
    biggest, smallest, threatened, lifers, months, peakMonth, medianHour, streak, streakEnd, persona,
    prevCount: prevSp.size, firstDate: days[0], lastDate: days[days.length - 1],
  };
}

/* --------------------------------------------------------------- slides */

const hourLabel = (h) => {
  if (h == null) return "";
  const hh = Math.floor(h) % 24, ap = hh >= 12 ? "pm" : "am", h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12} ${ap}`;
};
const mosaic = (list, cols = 5, max = 20) =>
  `<div class="mosaic${cols === 4 ? " cols4" : cols === 3 ? " cols3" : ""}">${list.slice(0, max).map((b) => img(b)).join("")}</div>`;
const durBig = (h) => (h >= 48 ? `${(h / 24).toFixed(1)}<span class="unit"> days</span>` : `${fmt(h)}<span class="unit"> hours</span>`);

/* ------------------------------------------------------- summary card */

let summaryName = "";
const poss = (n) => (/s$/i.test(n) ? n + "\u2019" : n + "\u2019s");
const clip = (t, n) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "\u2026" : t);

function summaryData(s) {
  const life = s.life, y = s.year;
  const where = (s.topCountries.length >= 2 ? s.topCountries.slice(0, 3).map(([cc, n]) => [regionName(cc), n]) : s.places.slice(0, 3))
    .map(([n, c]) => [clip(n, 24), c]);
  // stickers: threatened birds first, then the ones that mattered most, so the strip is varied and relevant
  const pool = life ? s.lifers.map((l) => l.b) : s.byFreq.map((e) => e.b);
  const seen = new Set(), strip = [];
  const add = (b) => { if (b && b.sticker && !seen.has(b.i)) { seen.add(b.i); strip.push(b); } };
  s.threatened.slice(0, 2).forEach((e) => add(e.b));
  pool.forEach(add);
  const tiles = life
    ? [[fmt(s.lifeTotal), "life list"], [fmt(s.families.length), "families"], [fmt(s.countries), s.countries === 1 ? "country" : "countries"], [(s.lifers.length / 12).toFixed(1), "new a month"]]
    : [[fmt(s.lifeTotal), "life list"], [fmt(s.nSpecies), "seen in " + y], [fmt(s.nLists), "checklists"], s.hours >= 1 ? [fmt(s.hours), "hours out"] : [fmt(s.countries), s.countries === 1 ? "country" : "countries"]];
  const facts = [];
  if (s.families[0]) facts.push(["Top family", s.families[0].name]);
  if (s.threatened[0]) facts.push(["Rarest find", s.threatened[0].b.en + " (" + (IUCN_NAME[s.threatened[0].b.iucn] || s.threatened[0].b.iucn) + ")", s.threatened[0].b.en + " (" + s.threatened[0].b.iucn + ")"]);
  if (s.months[s.peakMonth]) facts.push(["Best month", MONTH_NAMES[s.peakMonth]]);
  return {
    y, life, where, strip, tiles, facts, persona: s.persona,
    newCount: s.lifers.length, lifeTotal: s.lifeTotal, seenCount: life ? null : s.nSpecies,
    nLists: s.nLists, hours: s.hours, countries: s.countries,
    title: summaryName ? esc(poss(summaryName)) + " " + esc(y) + " in birds" : "My " + esc(y) + " in birds",
  };
}

// a small footer note pinned to the bottom edge of the card
const SUM_FOOT = '<div class="sum-foot"><p>Made with Birding Wrapped. Follow the creator on Instagram <b>@himanshuguptapro</b></p>' +
  '<p>Stickers: huashu-bird-sticker (CC BY 4.0, AI-generated).</p></div>';

// A: dark card with a stat row, bars for where, a strip of stickers
function summaryA(d) {
  const max = Math.max(1, ...d.where.map((w) => w[1]));
  return `
    <section class="slide t-night sum sumA">
      <p class="k">Birding Wrapped</p>
      <p class="sum-title">${d.title}</p>
      <div class="a-hero"><b>${fmt(d.newCount)}</b><span>new species in ${esc(d.y)}</span></div>
      <div class="a-tiles">${d.tiles.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>
      ${d.where.length ? `<p class="sum-h">${d.life ? "Where the new birds came from" : "Where you birded (checklists)"}</p>${d.where.map(([n, c]) => `<div class="wr"><span class="wn">${esc(n)}</span><span class="bar"><i style="width:${Math.max(6, Math.round((c / max) * 100))}%"></i></span><span class="wc">${fmt(c)}</span></div>`).join("")}` : ""}
      <div class="a-strip">${d.strip.slice(0, 6).map((b) => img(b)).join("")}</div>
      <p class="a-facts">${d.facts.map(([k, v]) => "<b>" + esc(k) + ":</b> " + esc(v)).join("<br>")}</p>
      ${SUM_FOOT}
    </section>`;
}

function summarySlide(s) {
  return summaryA(summaryData(s));
}

function buildSlides(s) {
  const out = [];
  const y = s.year;
  const sp = (e) => e.b;
  const mark = `<div class="mark">Birding Wrapped · ${esc(y)}</div>`;
  const spBirds = s.byFreq.map(sp);

  if (s.life) return buildLifeSlides(s, mark, spBirds);

  out.push(summarySlide(s)); // the summary is the cover

  // 2. species
  const delta = s.prevCount ? s.nSpecies - s.prevCount : null;
  out.push(`
    <section class="slide t-sky">
      <p class="k">Species seen</p>
      <div class="big">${fmt(s.nSpecies)}</div>
      <p class="sub pop">different kinds of birds, from ${s.families.length} ${s.families.length === 1 ? "family" : "families"}.${delta != null && delta !== 0 ? ` That's ${fmt(Math.abs(delta))} ${delta > 0 ? "more" : "fewer"} than in ${+y - 1}.` : ""}</p>
      ${mosaic(spBirds.slice(0, 15), 5, 15)}
      ${mark}
    </section>`);

  // 3. time
  out.push(`
    <section class="slide t-moss">
      <p class="k">Time in the field</p>
      <div class="big md">${s.hours >= 1 ? durBig(s.hours) : fmt(s.nLists)}</div>
      <p class="sub pop">${s.hours >= 1 ? "spent birding" : "checklists submitted"} across ${fmt(s.nLists)} checklists.</p>
      <div class="chips">
        <div class="chip"><b>${fmt(s.nBirds)}</b>birds counted</div>
        ${s.km >= 1 ? `<div class="chip"><b>${fmt(s.km)} km</b>on foot or wheels</div>` : ""}
        <div class="chip"><b>${fmt(s.nLocs)}</b>${s.nLocs === 1 ? "place" : "places"}</div>
        ${s.countries > 1 ? `<div class="chip"><b>${s.countries}</b>countries</div>` : ""}
      </div>
      ${s.topLoc ? `<p class="sub pop" style="margin-top:20px;font-size:14px">Most visited: <b>${esc(s.topLoc[0])}</b> (${s.topLoc[1]} ${s.topLoc[1] === 1 ? "checklist" : "checklists"}).</p>` : ""}
      ${mark}
    </section>`);

  // 4. lifers
  if (s.lifers.length) {
    out.push(`
    <section class="slide t-dusk">
      <p class="k">New to your list</p>
      <div class="big md">${fmt(s.lifers.length)}</div>
      <p class="sub pop">${s.lifers.length === 1 ? "new species" : "new species"} you hadn't recorded before ${esc(y)}.</p>
      ${mosaic(s.lifers.slice(0, 8).map((l) => l.b), 4, 8)}
      <p class="sub pop" style="margin-top:8px;font-size:13px">First one: <b>${esc(s.lifers[0].b.en)}</b>, ${esc(dFull(s.lifers[0].date))}.</p>
      ${mark}
    </section>`);
  }

  // 5. signature bird
  if (s.byFreq.length) {
    const t = s.byFreq[0];
    out.push(`
    <section class="slide t-sun">
      <p class="k">Your signature bird</p>
      <h2>${esc(t.b.en)}</h2>
      ${img(t.b, "hero-st")}
      <p class="sub pop">On ${fmt(t.lists.size)} of your ${fmt(s.nLists)} checklists${t.total ? `, ${fmt(t.total)} individuals in all` : ""}.</p>
      ${mark}
    </section>`);
  }

  // 6. family
  if (s.families.length) {
    const f = s.families[0];
    out.push(`
    <section class="slide t-berry">
      <p class="k">Favourite family</p>
      <h2>${esc(f.name)}</h2>
      <p class="sub pop" style="margin-top:8px">${fmt(f.n)} ${f.n === 1 ? "species" : "species"} of them this year.</p>
      ${mosaic(f.members.sort((a, b) => b.lists.size - a.lists.size).map(sp), 4, 8)}
      ${s.families[1] ? `<p class="sub pop" style="margin-top:8px;font-size:13px">Runner-up: ${esc(s.families[1].name)} (${s.families[1].n}).</p>` : ""}
      ${mark}
    </section>`);
  }

  // 7. size range
  if (s.biggest && s.smallest && s.biggest.b.i !== s.smallest.b.i) {
    const scale = (g) => Math.round(70 + 110 * Math.sqrt(g / s.biggest.b.massG));
    const gram = (g) => (g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g.toFixed(g < 10 ? 1 : 0)} g`);
    out.push(`
    <section class="slide t-night">
      <p class="k">From tiny to titan</p>
      <h2>Your size range</h2>
      <div class="pair">
        <figure>${img(s.smallest.b, "", `width="${scale(s.smallest.b.massG)}" height="${scale(s.smallest.b.massG)}"`)}<b>${esc(s.smallest.b.en)}</b><br>${gram(s.smallest.b.massG)}</figure>
        <figure>${img(s.biggest.b, "", `width="${scale(s.biggest.b.massG)}" height="${scale(s.biggest.b.massG)}"`)}<b>${esc(s.biggest.b.en)}</b><br>${gram(s.biggest.b.massG)}</figure>
      </div>
      <p class="sub pop" style="margin-top:18px;font-size:14px">${s.biggest.b.massG >= s.smallest.b.massG * 2 ? `The biggest outweighed the smallest ${fmt(s.biggest.b.massG / s.smallest.b.massG)} to 1.` : ""} Sizes are exaggerated so the smallest stays visible.</p>
      ${mark}
    </section>`);
  }

  // 8. threatened
  if (s.threatened.length) {
    out.push(`
    <section class="slide t-forest">
      <p class="k">Birds that need us</p>
      <div class="big md">${fmt(s.threatened.length)}</div>
      <p class="sub pop">${s.threatened.length === 1 ? "species" : "species"} you saw ${s.threatened.length === 1 ? "is" : "are"} Vulnerable or worse on the IUCN Red List.</p>
      ${mosaic(s.threatened.slice(0, 4).map(sp), 4, 4)}
      <ul class="list">
        ${s.threatened.slice(0, 4).map((e) => `<li><span>${esc(e.b.en)}</span><span>${esc(IUCN_NAME[e.b.iucn] || e.b.iucn)}</span></li>`).join("")}
      </ul>
      ${mark}
    </section>`);
  }

  // 9. rhythm
  const max = Math.max(1, ...s.months);
  out.push(`
    <section class="slide t-sky">
      <p class="k">Your rhythm</p>
      <h2>${esc(MONTH_NAMES[s.peakMonth])} was your month.</h2>
      <p class="sub pop" style="margin-top:8px">${s.months[s.peakMonth]} ${s.months[s.peakMonth] === 1 ? "checklist" : "checklists"}, your busiest stretch.</p>
      <div class="bars">${s.months.map((n, i) => `<div class="${i === s.peakMonth ? "peak" : ""}"><span style="height:${Math.round((n / max) * 100)}%"></span>${MONTHS[i]}</div>`).join("")}</div>
      ${mark}
    </section>`);

  // 10. persona
  out.push(`
    <section class="slide t-dusk">
      <p class="k">Your birding personality</p>
      <div class="persona">${esc(s.persona.name)}</div>
      <p class="sub pop">${esc(s.persona.why)}</p>
      <div class="chips">
        ${s.medianHour != null ? `<div class="chip"><b>${hourLabel(s.medianHour)}</b>usual start time</div>` : ""}
        <div class="chip"><b>${s.streak} ${s.streak === 1 ? "day" : "days"}</b>longest streak${s.streak > 1 ? "" : ""}</div>
        <div class="chip"><b>${(s.nSpecies / Math.max(1, s.nLists)).toFixed(1)}</b>species per checklist</div>
      </div>
      ${mark}
    </section>`);


  return out;
}

// Slides for the eBird life-list export: one row per species, so the story is about new species
function buildLifeSlides(s, mark, spBirds) {
  const out = [], y = s.year;
  const lifers = s.lifers;
  const list = lifers.map((l) => l.b);
  const gram = (g) => (g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g.toFixed(g < 10 ? 1 : 0)} g`);
  const dFmt = (d) => `${+d.slice(8, 10)} ${MONTH_NAMES[+d.slice(5, 7) - 1].slice(0, 3)}`;

  out.push(summarySlide(s)); // the summary is the cover

  out.push(`
    <section class="slide t-sky">
      <p class="k">New species</p>
      <div class="big">${fmt(lifers.length)}</div>
      <p class="sub pop">lifers in ${esc(y)}. Your life list grew from ${fmt(s.lifeBefore)} to ${fmt(s.lifeTotal)}.</p>
      ${mosaic(list, 5, 15)}
      ${mark}
    </section>`);

  if (s.topCountries.length) {
    const rows = s.topCountries.slice(0, 5).map(([cc, n]) => `<li><span>${esc(regionName(cc))}</span><span>${fmt(n)} new</span></li>`).join("");
    out.push(`
    <section class="slide t-moss">
      <p class="k">Where they came from</p>
      <div class="big md">${s.countries}</div>
      <p class="sub pop">${s.countries === 1 ? "country" : "countries"} gave you new birds.</p>
      <ul class="list">${rows}</ul>
      ${s.topLoc ? `<p class="sub pop" style="margin-top:20px;font-size:14px">Best single place: <b>${esc(s.topLoc[0])}</b> with ${s.topLoc[1]} new ${s.topLoc[1] === 1 ? "species" : "species"}.</p>` : ""}
      ${mark}
    </section>`);
  }

  if (lifers.length > 1) {
    const a = lifers[0], z = lifers[lifers.length - 1];
    out.push(`
    <section class="slide t-dusk">
      <p class="k">Bookends</p>
      <h2>First and latest</h2>
      <div class="pair">
        <figure>${img(a.b, "", 'width="140" height="140"')}<b>${esc(a.b.en)}</b><br>${esc(dFmt(a.date))}<br><span style="opacity:.7">first of ${esc(y)}</span></figure>
        <figure>${img(z.b, "", 'width="140" height="140"')}<b>${esc(z.b.en)}</b><br>${esc(dFmt(z.date))}<br><span style="opacity:.7">latest</span></figure>
      </div>
      ${mark}
    </section>`);
  }

  if (s.families.length) {
    const f = s.families[0];
    out.push(`
    <section class="slide t-berry">
      <p class="k">Biggest family gain</p>
      <h2>${esc(f.name)}</h2>
      <p class="sub pop" style="margin-top:8px">${fmt(f.n)} new ${f.n === 1 ? "species" : "species"} from this family.</p>
      ${mosaic(f.members.map(sp0), 4, 8)}
      ${s.families[1] ? `<p class="sub pop" style="margin-top:8px;font-size:13px">Runner-up: ${esc(s.families[1].name)} (${s.families[1].n}).</p>` : ""}
      ${mark}
    </section>`);
  }

  if (s.biggest && s.smallest && s.biggest.b.i !== s.smallest.b.i) {
    const scale = (g) => Math.round(70 + 110 * Math.sqrt(g / s.biggest.b.massG));
    out.push(`
    <section class="slide t-night">
      <p class="k">From tiny to titan</p>
      <h2>Your new size range</h2>
      <div class="pair">
        <figure>${img(s.smallest.b, "", `width="${scale(s.smallest.b.massG)}" height="${scale(s.smallest.b.massG)}"`)}<b>${esc(s.smallest.b.en)}</b><br>${gram(s.smallest.b.massG)}</figure>
        <figure>${img(s.biggest.b, "", `width="${scale(s.biggest.b.massG)}" height="${scale(s.biggest.b.massG)}"`)}<b>${esc(s.biggest.b.en)}</b><br>${gram(s.biggest.b.massG)}</figure>
      </div>
      <p class="sub pop" style="margin-top:18px;font-size:14px">Sizes are exaggerated so the smallest stays visible.</p>
      ${mark}
    </section>`);
  }

  if (s.threatened.length) {
    out.push(`
    <section class="slide t-forest">
      <p class="k">Birds that need us</p>
      <div class="big md">${fmt(s.threatened.length)}</div>
      <p class="sub pop">of your new species ${s.threatened.length === 1 ? "is" : "are"} Vulnerable or worse on the IUCN Red List.</p>
      ${mosaic(s.threatened.slice(0, 4).map(sp0), 4, 4)}
      <ul class="list">
        ${s.threatened.slice(0, 4).map((e) => `<li><span>${esc(e.b.en)}</span><span>${esc(IUCN_NAME[e.b.iucn] || e.b.iucn)}</span></li>`).join("")}
      </ul>
      ${mark}
    </section>`);
  }

  const max = Math.max(1, ...s.months);
  out.push(`
    <section class="slide t-sky">
      <p class="k">Your rhythm</p>
      <h2>${esc(MONTH_NAMES[s.peakMonth])} was your lifer month.</h2>
      <p class="sub pop" style="margin-top:8px">${s.months[s.peakMonth]} new ${s.months[s.peakMonth] === 1 ? "species" : "species"} in one month.</p>
      <div class="bars">${s.months.map((n, i) => `<div class="${i === s.peakMonth ? "peak" : ""}"><span style="height:${Math.round((n / max) * 100)}%"></span>${MONTHS[i]}</div>`).join("")}</div>
      ${mark}
    </section>`);

  out.push(`
    <section class="slide t-dusk">
      <p class="k">Your birding personality</p>
      <div class="persona">${esc(s.persona.name)}</div>
      <p class="sub pop">${esc(s.persona.why)}</p>
      <div class="chips">
        <div class="chip"><b>${fmt(s.lifeTotal)}</b>on your life list</div>
        <div class="chip"><b>${(lifers.length / 12).toFixed(1)}</b>new species a month</div>
        ${s.countries ? `<div class="chip"><b>${s.countries}</b>${s.countries === 1 ? "country" : "countries"}</div>` : ""}
      </div>
      ${mark}
    </section>`);

  return out;
}
const sp0 = (e) => e.b;


/* ---------------------------------------------------------- bird bubble */

const IUCN_LABEL = { LC: "Least Concern", NT: "Near Threatened", VU: "Vulnerable", EN: "Endangered", CR: "Critically Endangered", EW: "Extinct in the Wild", EX: "Extinct", DD: "Data Deficient" };
const MIG_LABEL = { sedentary: "Resident", "partially migratory": "Partial migrant", migratory: "Migrant" };
const dFull = (d) => (+d.slice(8, 10)) + " " + MONTH_NAMES[+d.slice(5, 7) - 1].slice(0, 3) + " " + d.slice(0, 4);
let CURRENT = null;      // stats for the year on screen
let bubbleFor = null;    // the sticker the bubble points at

function hideBubble() {
  const b = $("bubble");
  if (b) b.hidden = true;
  if (bubbleFor) bubbleFor.classList.remove("picked");
  bubbleFor = null;
}

function bubbleHtml(bird) {
  const st = CURRENT;
  const first = st.firstRow.get(bird.i);
  const e = st.byIdx.get(bird.i);
  const lines = [];
  lines.push('<p class="bn">' + esc(bird.en) + "</p>");
  lines.push('<p class="bs">' + esc(bird.sci) + (bird.familyEn ? " · " + esc(bird.familyEn) : "") + "</p>");
  if (first) {
    const place = cleanLoc(first.loc);
    const cc = first.state ? regionName(first.state.split("-")[0]) : "";
    const where = [place, cc && !place.includes(cc) ? cc : ""].filter(Boolean).join(", ");
    lines.push('<p class="bl"><span>First seen</span><span class="v">' + esc(dFull(first.date)) + (where ? " · " + esc(where) : "") + "</span></p>");
    const lifer = first.date.startsWith(st.year);
    lines.push('<p class="bl"><span>Lifer</span><span class="v">' + (lifer ? '<b class="yes">Yes, new for you in ' + esc(st.year) + "</b>" : "No, first seen " + esc(first.date.slice(0, 4))) + "</span></p>");
  }
  if (e && !st.life) {
    lines.push('<p class="bl"><span>This year</span><span class="v">On ' + fmt(e.lists.size) + (e.lists.size === 1 ? " checklist" : " checklists") + (e.total ? ", " + fmt(e.total) + " counted" : "") + "</span></p>");
  }
  if (IUCN_LABEL[bird.iucn]) {
    lines.push('<p class="bl"><span>Status</span><span class="v st"><i class="dot iu-' + esc(bird.iucn) + '"></i>' + esc(IUCN_LABEL[bird.iucn]) + "</span></p>");
  }
  const facts = [];
  if (bird.massG != null) facts.push(bird.massG >= 1000 ? (bird.massG / 1000).toFixed(1) + " kg" : bird.massG.toFixed(bird.massG < 10 ? 1 : 0) + " g");
  if (bird.habitat) facts.push(bird.habitat);
  if (MIG_LABEL[bird.migration]) facts.push(MIG_LABEL[bird.migration]);
  if (facts.length) lines.push('<p class="bf">' + facts.map(esc).join(" · ") + "</p>");
  return lines.join("");
}

function showBubble(imgEl) {
  if (!CURRENT || !BIRDS) return;
  if (bubbleFor === imgEl) { hideBubble(); return; }
  const bird = BIRDS[+imgEl.dataset.b];
  if (!bird) return;
  hideBubble();
  const bub = $("bubble");
  bub.innerHTML = bubbleHtml(bird);
  bub.hidden = false;
  bub.classList.remove("below");
  const W = bub.offsetWidth, H = bub.offsetHeight;
  const sr = $("scaler").getBoundingClientRect(), ir = imgEl.getBoundingClientRect();
  const sc = sr.width / 360;
  const cx = (ir.left + ir.width / 2 - sr.left) / sc, top = (ir.top - sr.top) / sc, bottom = (ir.bottom - sr.top) / sc;
  const x = Math.max(10, Math.min(350 - W, cx - W / 2));
  const above = top - H - 14 >= 26;
  let y = above ? top - H - 12 : Math.min(bottom + 12, 640 - H - 10);
  y = Math.max(26, y);
  bub.classList.toggle("below", !above);
  bub.style.left = x + "px";
  bub.style.top = y + "px";
  bub.style.setProperty("--tx", Math.max(18, Math.min(W - 18, cx - x)) + "px");
  imgEl.classList.add("picked");
  bubbleFor = imgEl;
}

/* --------------------------------------------------------------- viewer */

function renderProgress() {
  $("progress").innerHTML = slideEls.map((_, i) => `<i class="${i <= cur ? "done" : ""}"></i>`).join("");
}
function show(i) {
  hideBubble();
  cur = Math.max(0, Math.min(slideEls.length - 1, i));
  slideEls.forEach((el, k) => el.classList.toggle("active", k === cur));
  renderProgress();
  $("prev").disabled = cur === 0;
  $("next").disabled = cur === slideEls.length - 1;
  $("tapPrev").classList.toggle("end", cur === 0);
  $("tapNext").classList.toggle("end", cur === slideEls.length - 1);
  if (cur !== 0) $("deck").classList.remove("nudge");
  updateCue();
}

// the button under the card: "See the details" on the summary, "Back to summary" on the last card
function updateCue() {
  const cue = $("cue");
  if (!cue) return;
  const n = slideEls.length, first = cur === 0, last = n > 1 && cur === n - 1;
  const right = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const left = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
  cue.classList.toggle("on", n > 1 && (first || last));
  cue.classList.toggle("first", n > 1 && first);
  cue.dataset.go = first ? "next" : "home";
  cue.innerHTML = first ? "See the details " + right : left + " Back to summary";
}
function mountSlides(html) {
  $("slides").innerHTML = html.join("");
  slideEls = [...$("slides").children];
  slidesVer++; rendered.clear();
  show(0);
}
function fit() {
  const s = Math.max(0.5, Math.min((window.innerWidth - 32) / 360, (window.innerHeight - 260) / 640, 1.6));
  $("scaler").style.transform = `scale(${s})`;
  $("deck").style.width = 360 * s + "px";
  $("deck").style.height = 640 * s + "px";
}

function renderYear(year) {
  YEAR = year;
  const stats = analyze(ROWS, year);
  if (!stats.nLists || !stats.nSpecies) {
    hideBubble();
    $("slides").innerHTML = ""; slideEls = []; CURRENT = null; show(0);
    renderSkips(stats);
    $("vstatus").textContent = "No birds that match the sticker set were found for " + year + ".";
    return;
  }
  $("vstatus").textContent = "";
  renderSkips(stats);
  CURRENT = stats;
  mountSlides(buildSlides(stats));
}

const SKIP_TEXT = {
  slash: "Slash entries: eBird couldn't tell which of two species it was (for example one gull or the other), so it can't count as one species.",
  spuh: "Genus-only entries (like \"gull sp.\"): not identified to a species.",
  hybrid: "Hybrids: no sticker exists for them.",
  domestic: "Domestic or feral forms: not wild species.",
  form: "Other non-species entries (forms and subspecies groups).",
  nomatch: "Names I couldn't match to the sticker set. eBird and the sticker set (AviList) sometimes name or split a bird differently, so a bird you saw may be missing here.",
};
function renderSkips(s) {
  const box = $("skipbox");
  if (!s.skipped) { box.hidden = true; box.innerHTML = ""; return; }
  const what = ROWS.isLife ? "entries" : "observations";
  const groups = [...s.skipInfo.entries()].map(([reason, m]) => {
    const names = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const shown = names.slice(0, 8).map(([n]) => esc(n)).join(", ");
    return `<li><b>${fmt(names.length)}</b> ${esc(SKIP_TEXT[reason])}<br><span class="names">${shown}${names.length > 8 ? ` and ${names.length - 8} more` : ""}</span></li>`;
  }).join("");
  box.hidden = false;
  box.innerHTML = `<details><summary>${fmt(s.skipped)} of ${fmt(s.totalRows)} ${what} in ${esc(s.year)} were left out. Why?</summary><ul>${groups}</ul>` +
    `<p>Left-out birds aren't counted in any card${ROWS.isLife ? ", and a bird missing from an earlier year can show up as new later" : ""}.</p></details>`;
}

function openViewer() {
  const years = listYears(ROWS);
  if (!years.length) throw new Error("No dated observations found in that file.");
  if (!ROWS.some((r) => resolve(r.sci, r.en))) throw new Error("None of the birds in that file matched the sticker set, so there is nothing to show. Check that the names are common or scientific bird names.");
  $("year").innerHTML = years.map((x) => `<option value="${x.y}">${x.y} (${fmt(x.n)} ${ROWS.isLife ? "new species" : "checklists"})</option>`).join("");
  $("landing").hidden = true;
  $("viewer").hidden = false;
  $("deck").classList.add("nudge"); // one gentle hint that the cards can be swiped through
  fit();
  renderYear(years[0].y);
}

/* ---------------------------------------------------------------- export */

async function waitImages(el) {
  const imgs = [...el.querySelectorAll("img")];
  await Promise.all(imgs.map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = r; }))));
}
// html2canvas ignores object-fit, so it stretches every sticker to fill its square box. Before it draws, give each
// sticker in the copy the exact size it has on screen (fitted inside its box, keeping its own proportions) and
// centre it with margins, so the layout stays the same and nothing is stretched.
function fitStickers(orig, copy) {
  const a = orig.querySelectorAll("img"), b = copy.querySelectorAll("img");
  a.forEach((im, k) => {
    const c = b[k];
    const bw = im.offsetWidth, bh = im.offsetHeight, nw = im.naturalWidth, nh = im.naturalHeight;
    if (!c || !bw || !bh || !nw || !nh) return;
    const f = Math.min(bw / nw, bh / nh);
    const w = nw * f, h = nh * f;
    c.style.setProperty("object-fit", "fill", "important");
    c.style.setProperty("aspect-ratio", "auto", "important");
    c.style.setProperty("width", w + "px", "important");
    c.style.setProperty("height", h + "px", "important");
    // keep the margins the layout already gives this image (some are "auto" and resolve to pixels) and add the leftover space
    const m = getComputedStyle(im), dx = (bw - w) / 2, dy = (bh - h) / 2;
    c.style.setProperty("margin", (parseFloat(m.marginTop) || 0) + dy + "px " + ((parseFloat(m.marginRight) || 0) + dx) + "px " + ((parseFloat(m.marginBottom) || 0) + dy) + "px " + ((parseFloat(m.marginLeft) || 0) + dx) + "px", "important");
  });
}
async function capture(el) {
  await document.fonts?.ready;
  await waitImages(el);
  const idx = slideEls.indexOf(el);
  return html2canvas(el, {
    scale: 3, useCORS: true, backgroundColor: null, logging: false,
    onclone: (doc) => {
      const sc = doc.getElementById("scaler");
      if (sc) sc.style.transform = "none";
      // the copy would replay the entry animations from their first frame, which exports faded or missing text
      const st = doc.createElement("style");
      st.textContent = "*, *::before, *::after { animation: none !important; transition: none !important; }";
      doc.head.appendChild(st);
      const slides = doc.getElementById("slides");
      if (slides && idx >= 0 && slides.children[idx]) fitStickers(el, slides.children[idx]);
    },
  });
}
const toBlob = (canvas) => new Promise((r) => canvas.toBlob(r, "image/png"));
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const cardName = (i) => `birding-wrapped-${YEAR}-${String(i + 1).padStart(2, "0")}.png`;

// ---- choosing which cards to share or download (glass dialog)
let selected = new Set();
let dlgMode = "share";
let busy = false;        // saving or sharing in progress
let preparing = false;   // background rendering in progress
let slidesVer = 0;       // bumps whenever the cards are rebuilt
const rendered = new Map(); // "ver:index" -> { name, blob }
const rkey = (i) => slidesVer + ":" + i;
const slideTitle = (el) => el.classList.contains("sum") ? "Summary" : ((el.querySelector(".k") || {}).textContent || "").trim() || "Card";
const msg = (t) => { $("dlgStatus").textContent = t; };

function openDialog(mode) {
  if (!slideEls.length) return;
  dlgMode = mode;
  selected = new Set([cur]); // the card you're looking at is ticked by default
  $("dlgTitle").textContent = mode === "share" ? "Share cards" : "Download cards";
  $("dlgSub").textContent = mode === "share" ? "Choose the cards you want to send." : "Choose the cards to save as images.";
  $("dlgHint").hidden = mode !== "share";
  msg("");
  $("pickList").innerHTML = slideEls.map((el, i) => {
    const clone = el.cloneNode(true);
    clone.classList.add("active");
    clone.querySelectorAll("img").forEach((im) => { im.removeAttribute("tabindex"); im.removeAttribute("role"); im.removeAttribute("data-b"); });
    return '<label class="pick" data-i="' + i + '"><input type="checkbox" data-i="' + i + '">' +
      '<span class="thumb"><span class="thumb-in">' + clone.outerHTML + '</span><span class="tick" aria-hidden="true"></span></span>' +
      '<span class="cap">' + (i + 1) + ". " + esc(slideTitle(el)) + "</span></label>";
  }).join("");
  syncPicker();
  hideBubble();
  $("dlg").showModal();
  prepare();
  const here = $("pickList").querySelector('[data-i="' + cur + '"]');
  if (here && here.scrollIntoView) here.scrollIntoView({ block: "nearest" });
}

function syncPicker() {
  const n = selected.size, all = n === slideEls.length;
  document.querySelectorAll("#pickList .pick").forEach((l) => {
    const on = selected.has(+l.dataset.i);
    l.classList.toggle("on", on);
    l.querySelector("input").checked = on;
  });
  $("pickAll").textContent = all ? "Clear all" : "Select all";
  $("pickAll").disabled = busy;
  $("pickCount").textContent = n + " of " + slideEls.length + " selected";
  const ready = [...selected].filter((i) => rendered.has(rkey(i))).length;
  const verb = dlgMode === "share" ? "Share" : "Download";
  let label = verb + " " + n + (n === 1 ? " card" : " cards");
  if (busy) label = "Working…";
  else if (n > 0 && ready < n) label = "Preparing " + (ready + 1 > n ? n : ready + 1) + " of " + n + "…";
  $("dlgGo").textContent = label;
  $("dlgGo").disabled = busy || n === 0 || ready < n;
  $("dlgCancel").disabled = busy;
  $("dlgClose").disabled = busy;
}

// Renders the ticked cards one by one into the cache while the dialog is open.
// Share has to be called straight after a tap (browsers drop the permission after a few seconds), so it can't wait for rendering.
async function prepare() {
  if (preparing) return;
  if (typeof html2canvas === "undefined") { msg("The image exporter didn't load. Check your connection."); return; }
  preparing = true; msg(""); syncPicker();
  const keep = cur;
  try {
    while ($("dlg").open) {
      const next = [...selected].sort((x, y) => x - y).find((i) => !rendered.has(rkey(i)));
      if (next === undefined) break;
      show(next);
      await new Promise((r) => setTimeout(r, 650)); // let entry animations finish
      rendered.set(rkey(next), { name: cardName(next), blob: await toBlob(await capture(slideEls[next])) });
      syncPicker();
    }
  } catch (e) {
    msg("Couldn't render the cards: " + e.message);
  } finally {
    show(keep); preparing = false; syncPicker();
  }
}

// one card downloads as a PNG, several as one ZIP (or one by one if the ZIP library didn't load)
async function saveFiles(list) {
  if (list.length === 1) { download(list[0].blob, list[0].name); return "Saved 1 card."; }
  if (typeof JSZip !== "undefined") {
    const zip = new JSZip();
    list.forEach((f) => zip.file(f.name, f.blob));
    download(await zip.generateAsync({ type: "blob" }), "birding-wrapped-" + YEAR + ".zip");
    return "Downloaded " + list.length + " cards as one ZIP file.";
  }
  for (const f of list) { download(f.blob, f.name); await new Promise((r) => setTimeout(r, 250)); }
  return "Downloaded " + list.length + " cards.";
}

async function runDialog() {
  const list = [...selected].sort((x, y) => x - y).map((i) => rendered.get(rkey(i))).filter(Boolean);
  if (!list.length || list.length !== selected.size) return;
  if (dlgMode === "share") {
    const files = list.map((f) => new File([f.blob], f.name, { type: "image/png" }));
    if (navigator.canShare && navigator.canShare({ files })) {
      try { await navigator.share({ files, title: "My " + YEAR + " in birds" }); $("dlg").close(); $("vstatus").textContent = ""; }
      catch (e) { if (e.name !== "AbortError") msg("Couldn't share: " + e.message); } // cancelling the share sheet keeps the dialog open
      return;
    }
  }
  busy = true; syncPicker();
  try {
    let note = await saveFiles(list);
    if (dlgMode === "share") note += " This browser can't share straight to Instagram, so I saved them instead. Open this page on your phone to share from there.";
    $("dlg").close();
    $("vstatus").textContent = note;
  } catch (e) {
    msg("Couldn't finish: " + e.message);
  } finally {
    busy = false; syncPicker();
  }
}

/* ---------------------------------------------------------- pasted list */

function parsePasted(text) {
  const year = new Date().getFullYear();
  const rows = [];
  rows.isLife = true;
  rows.dropped = [];
  let undated = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[,;]/).map((p) => p.trim());
    let name = parts[0], date = null;
    for (const p of parts.slice(1)) { date = parseDate(p); if (date) break; }
    if (!date) { date = year + "-01-01"; undated++; }
    const isSci = /^[A-Z][a-z]+ [a-z]+/.test(name);
    rows.push({ sid: "P" + rows.length, en: isSci ? "" : name, sci: isSci ? name : "", count: 1, state: "", loc: "", date, hour: null, dur: 0, dist: 0 });
  }
  rows.undatedPasted = undated;
  return rows;
}

/* ------------------------------------------------------------------ demo */

function demoRows() {
  let seed = 20260101;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const year = new Date().getFullYear() - 1;
  const common = BIRDS.filter((b) => b.sticker && b.massG != null && /Passeriformes|Anseriformes|Columbiformes|Piciformes|Charadriiformes|Strigiformes|Accipitriformes|Apodiformes/.test(b.order));
  const pick = [];
  const used = new Set();
  while (pick.length < 240) {
    const b = common[Math.floor(rnd() * common.length)];
    if (!used.has(b.i)) { used.add(b.i); pick.push(b); }
  }
  const places = [["Willow Creek Marsh", "US-CA"], ["Ridge Trail", "US-CA"], ["Harbor Point", "US-WA"], ["Backyard", "US-CA"]];
  const rows = [];
  const nLists = 70;
  for (let k = 0; k < nLists; k++) {
    const month = Math.min(11, Math.floor(Math.pow(rnd(), 0.8) * 12));
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 27)).padStart(2, "0")}`;
    const hour = rnd() < 0.7 ? 6 + rnd() * 2.5 : 8 + rnd() * 9;
    const p = places[rnd() < 0.5 ? 0 : Math.floor(rnd() * places.length)];
    const dur = 30 + Math.floor(rnd() * 150);
    const dist = Math.round(rnd() * 60) / 10;
    const n = 12 + Math.floor(rnd() * 30);
    const used2 = new Set();
    for (let j = 0; j < n; j++) {
      const b = pick[Math.floor(Math.pow(rnd(), 1.7) * pick.length)];
      if (used2.has(b.i)) continue;
      used2.add(b.i);
      rows.push({ sid: "S" + k, en: b.en, sci: b.sci, count: 1 + Math.floor(rnd() * 8), state: p[1], loc: p[0], date, hour, dur, dist });
    }
  }
  // some older history so only part of the list counts as new this year
  pick.slice(0, 90).forEach((b, i) => rows.push({ sid: "H" + i, en: b.en, sci: b.sci, count: 1, state: "US-CA", loc: "Old patch", date: `${year - 1}-0${1 + (i % 9)}-10`, hour: 8, dur: 60, dist: 1 }));
  return rows;
}

/* --------------------------------------------------------------- wiring */

function setStatus(msg, err = false) {
  const el = $("status");
  el.textContent = msg;
  el.classList.toggle("err", err);
}

async function handleFile(file) {
  if (!file) return;
  setStatus("Reading " + file.name + "…");
  try {
    await loadBirds();
    ROWS = parseEbird(await file.text());
    isDemo = false;
    openViewer();
  } catch (e) {
    setStatus(e.message, true);
  }
}

function init() {
  const drop = $("drop");
  $("file").addEventListener("change", (e) => handleFile(e.target.files[0]));
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("file").click(); } });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));

  $("demo").addEventListener("click", async () => {
    setStatus("Loading demo…");
    try {
      await loadBirds();
      ROWS = demoRows();
      isDemo = true;
      openViewer();
    } catch (e) {
      setStatus(location.protocol === "file:" ? "Open this page through a local web server (see README), not directly from disk." : e.message, true);
    }
  });

  $("year").addEventListener("change", (e) => renderYear(e.target.value));
  $("restart").addEventListener("click", () => { $("viewer").hidden = true; $("landing").hidden = false; setStatus(""); $("file").value = ""; });
  $("prev").addEventListener("click", () => show(cur - 1));
  $("next").addEventListener("click", () => show(cur + 1));
  // a tap on the card while a bubble is open only closes the bubble, it does not turn the page
  $("tapPrev").addEventListener("click", () => { if (bubbleFor) hideBubble(); else show(cur - 1); });
  $("tapNext").addEventListener("click", () => { if (bubbleFor) hideBubble(); else show(cur + 1); });
  document.addEventListener("click", (e) => { // a tap on empty page space closes it too
    if (bubbleFor && e.target.closest && !e.target.closest("#bubble, img[data-b], .tap, button, a, select, label, summary, textarea, input, dialog")) hideBubble();
  });
  $("slides").addEventListener("click", (e) => {
    const t = e.target.closest ? e.target.closest("img[data-b]") : null;
    if (t) { e.stopPropagation(); showBubble(t); }
  });
  $("slides").addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("img[data-b]")) { e.preventDefault(); showBubble(e.target); }
  });
  const refreshSummary = () => { if (!CURRENT) return; const keep = cur; mountSlides(buildSlides(CURRENT)); show(keep); };
  let nameTimer;
  $("nameIn").addEventListener("input", (e) => { summaryName = e.target.value.trim(); clearTimeout(nameTimer); nameTimer = setTimeout(refreshSummary, 250); });
  $("cue").addEventListener("click", () => show($("cue").dataset.go === "next" ? 1 : 0));
  $("share").addEventListener("click", () => openDialog("share"));
  $("download").addEventListener("click", () => openDialog("download"));
  $("dlgGo").addEventListener("click", runDialog);
  $("dlgCancel").addEventListener("click", () => $("dlg").close());
  $("dlgClose").addEventListener("click", () => $("dlg").close());
  $("pickAll").addEventListener("click", () => {
    selected = selected.size === slideEls.length ? new Set() : new Set(slideEls.map((_, i) => i));
    syncPicker(); prepare();
  });
  $("pickList").addEventListener("change", (e) => {
    const i = +e.target.dataset.i;
    if (e.target.checked) selected.add(i); else selected.delete(i);
    syncPicker(); prepare();
  });
  $("dlg").addEventListener("cancel", (e) => { if (busy) e.preventDefault(); }); // Esc while rendering
  $("dlg").addEventListener("click", (e) => { if (e.target === $("dlg") && !busy) $("dlg").close(); }); // click outside
  $("thisYear").textContent = new Date().getFullYear();
  $("pasteGo").addEventListener("click", async () => {
    const txt = $("pasteBox").value;
    if (!txt.trim()) { setStatus("Paste at least one bird name first.", true); return; }
    try { await loadBirds(); ROWS = parsePasted(txt); openViewer(); }
    catch (e) { setStatus(e.message, true); }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideBubble();
    if ($("viewer").hidden || e.target.tagName === "SELECT") return;
    if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); show(cur + 1); }
    if (e.key === "ArrowLeft") show(cur - 1);
  });
  window.addEventListener("resize", fit);

  // jsDelivr sometimes refuses a file; fall back to GitHub raw once
  document.addEventListener("error", (e) => {
    const el = e.target;
    if (el.tagName !== "IMG" || el.dataset.fallback || !el.src.startsWith(CDN)) return;
    el.dataset.fallback = "1";
    el.src = RAW + el.src.slice(CDN.length);
  }, true);

  // ?demo=1&slide=3 jumps straight into the demo (handy for screenshots)
  const q = new URLSearchParams(location.search);
  // dev/preview switch: ?name=Asha fills in the name up front
  if (q.has("name")) { summaryName = q.get("name").trim().slice(0, 24); $("nameIn").value = summaryName; }
  if (q.has("demo")) $("demo").click();
  if (q.has("csv")) { // dev: ?csv=http://127.0.0.1:5199/file.csv&year=2025
    fetch(q.get("csv")).then((r) => r.text()).then(async (txt) => {
      await loadBirds(); ROWS = parseEbird(txt); openViewer();
      if (q.has("year")) { $("year").value = q.get("year"); renderYear(q.get("year")); }
    }).catch((e) => setStatus(e.message, true));
  }
  if (q.has("slide")) {
    const t = setInterval(() => { if (slideEls.length) { clearInterval(t); show(+q.get("slide")); } }, 100);
    setTimeout(() => clearInterval(t), 8000);
  }
}

init();
