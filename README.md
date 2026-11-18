# Birding Wrapped

Your eBird year as story cards: new species, countries, signature bird, favourite family, size range, threatened species, monthly rhythm, birding personality and a summary. Cards export as 1080x1920 PNGs, laid out inside Instagram safe zones. Share and Download open a glass dialog to pick which cards (the one you are on is ticked, with a Select all option); several cards download as one ZIP. Everything runs in the browser, so the CSV is never uploaded.

Live at [himanshugupta.art/wrapped](https://www.himanshugupta.art/wrapped), served from this repo's own Vercel project and proxied from the portfolio site.

## Inputs

- eBird **life list** CSV (one row per species): the cards show new species per year.
- eBird **MyEBirdData.csv** (all observations): adds hours in the field, checklists, most seen bird and usual start time.
- Any CSV with a species column and a date column.
- A pasted list of bird names, with optional dates.

Rows that can't be counted (slashes, genus only entries, hybrids, domestic forms, names missing from the sticker set) are listed under the cards with the reason.

## Run locally

```
node tools/serve.mjs                       # http://127.0.0.1:5173/wrapped/   (or double click start.bat)
node tools/preview.mjs <portfolio>/site    # http://127.0.0.1:8081/wrapped/   inside the portfolio site
```

Dev shortcuts: `?demo=1&slide=3` opens a generated demo year; `?csv=<url>&year=2025` loads a CSV from a URL.

## Layout

```
site/        what gets deployed (index.html, app.js, style.css, data/birds.json)
tools/       build-data.mjs (index builder), serve.mjs, preview.mjs
vercel.json  serves the app at /wrapped/ so it can be proxied from himanshugupta.art
NOTICE.md    attribution and licences (required)
```

## Publishing at himanshugupta.art/wrapped

Deploy this repo as its own Vercel project, then add this to the portfolio's `vercel.json` (replace the host with the project's address):

```json
"rewrites": [
  { "source": "/wrapped", "destination": "https://bird-wrapped.vercel.app/wrapped" },
  { "source": "/wrapped/:path*", "destination": "https://bird-wrapped.vercel.app/wrapped/:path*" }
]
```

All asset paths in the app are absolute (`/wrapped/...`), so it works both proxied and on its own Vercel address.

## Known limits

- "New species" means first appearing in your file, so a partial export overstates it.
- Totals follow eBird: rows eBird marks as not countable (escaped birds) are left out. eBird and AviList taxonomies differ in places, so a species eBird counts but the sticker set lacks (newer splits) is still counted, just without a picture.
- PNG export uses html2canvas from cdnjs, so it needs a connection.
- Sharing straight to Instagram needs HTTPS and a phone browser that supports file sharing.
