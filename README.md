# Birding Wrapped

Turn your eBird list into your year in birds, as story cards you can post on Instagram. Free, no sign up, and everything runs in the browser, so your file is never uploaded.

**Live:** [himanshugupta.art/wrapped](https://www.himanshugupta.art/wrapped)

## What it does

- **A one page summary first.** New species, life list, countries, where the new birds came from, top family, rarest find, best month and a strip of birds. It is the card most people will share, with an optional name on it.
- **The story after it.** Species seen, time in the field, new species, signature bird, favourite family, size range, threatened species, monthly rhythm and a birding personality.
- **Swipe or tap through the cards.** Drag to slide, tap the left third to go back and the rest to go forward, or use the arrow keys.
- **Tap a bird** for a small bubble with its name, where and when you first saw it, whether it was a lifer, its IUCN status, weight, habitat and migration. Only the bird itself is tappable, not its empty box.
- **Share or download** from a glass dialog where you choose which cards (the one you are on is ticked, with Select all). Several cards download as one ZIP. Sharing straight to Instagram needs a phone browser with file sharing and HTTPS.
- **Exports are 1080x1920 PNGs**, laid out inside Instagram's Story safe zones, with the birds drawn at their true proportions.
- **Every number is explained.** A note under the cards lists what was left out and why, what was counted without a picture, and what has no known date.

## Inputs

| Input | What you get |
|---|---|
| eBird **life list** CSV (My eBird, Life List, Download) | New species per year, countries, places, families |
| eBird **MyEBirdData.csv** (all observations) | The above plus species seen, checklists, hours, signature bird, usual start time |
| Any CSV with a species column and a date column | Treated like a life list |
| A pasted list of bird names (optional dates) | Treated like a life list; birds with no date count in the current year |

## How the numbers are counted

The totals are meant to match eBird's own.

- **Countable.** Rows eBird marks as not countable (escaped or exotic birds, slashes, "sp." entries, hybrids) are left out.
- **Species the sticker set lacks.** eBird (Clements) and the sticker data (AviList) don't always split species the same way. A real species eBird counts but the set has no sticker for is still counted in every total, just without a picture, and is listed in the note under the cards.
- **Unknown dates.** eBird writes 1 Jan 1900 when it doesn't know a date. Those species count in the life list total but get their own **Unknown date** entry in the year list instead of a fake year.
- **New species** means first appearing in your file, so a partial export overstates it.

## Run it on its own

Needs Node 18 or newer. There is nothing to install.

```
node tools/serve.mjs          # then open http://127.0.0.1:5173/wrapped/
```

On Windows you can double click `start.bat` instead. The page must be served over http: opening `site/index.html` straight from disk won't work, because it loads its data and files from absolute `/wrapped/...` paths.

Handy URL switches while developing:

| Switch | Effect |
|---|---|
| `?demo=1` | Opens a generated demo year |
| `?demo=1&slide=3` | Jumps to a card |
| `?name=Asha` | Fills in the name on the summary card |
| `?csv=<url>&year=2025` | Loads a CSV from a URL (it must allow CORS) |

### Check that a deployment works on its own

```
node tools/check.mjs http://127.0.0.1:5173            # local
node tools/check.mjs https://bird-wrapped.vercel.app  # standalone deployment
node tools/check.mjs https://www.himanshugupta.art    # inside the portfolio site
```

It checks that `/wrapped` and `/wrapped/` both load, that every file the page asks for exists, that the bird index is complete, that **no link depends on another site** (so the page works with nothing else around it), that the outside libraries and the sticker CDN answer (with CORS, which the PNG export needs), and that the sticker credit is on the page. It exits with code 1 if anything fails.

## Deploy on its own (Vercel)

1. Import the repo as a Vercel project. Framework: Other. Leave the build command empty and set the output directory to `site` (`vercel.json` already says both).
2. `vercel.json` rewrites `/wrapped` and `/wrapped/...` to the app, so the same files work at the root address and under `/wrapped/`.
3. Run `node tools/check.mjs https://<your-project>.vercel.app` and open the page once with `?demo=1`.

## Show it inside another site

The app lives at `/wrapped/` on purpose, so another Vercel site can proxy it. On himanshugupta.art, the portfolio's `vercel.json` has:

```json
"redirects": [
  { "source": "/wrapped/", "destination": "/wrapped", "permanent": false }
],
"rewrites": [
  { "source": "/wrapped", "destination": "https://bird-wrapped.vercel.app/wrapped" },
  { "source": "/wrapped/:path*", "destination": "https://bird-wrapped.vercel.app/wrapped/:path*" }
]
```

The header links point at full `https://www.himanshugupta.art/...` addresses, so they work both inside that site and on the standalone deployment.

## Data

`site/data/birds.json` is a compact index (about 2 MB) built from the `data/species.json` file in [huashu-bird-sticker](https://github.com/alchaincyf/huashu-bird-sticker):

```
node tools/build-data.mjs path/to/species.json
```

That file is too large for the jsDelivr CDN, so download it from `raw.githubusercontent.com`. The stickers themselves are not stored here: the page loads them from jsDelivr and falls back to GitHub raw if a file is refused.

## The thumbnail sheet

Cards that must show every new bird (a big year can be hundreds, or more than a thousand) draw tiny pictures from one sheet, `site/data/atlas.webp`, instead of loading hundreds of full size stickers, which would each need about 4 MB of memory. Up to about 40 birds the real stickers are used. To rebuild the sheet (about 2 minutes, downloads every sticker):

```
npm i --no-save sharp
node tools/build-atlas.mjs
```

## Layout

```
site/            what gets deployed: index.html, app.js, style.css, favicon.svg, data/birds.json, data/atlas.webp
tools/
  serve.mjs      local server for the standalone app
  preview.mjs    local server that mounts the app inside a copy of the portfolio site
  check.mjs      smoke test for any deployment
  build-data.mjs builds the bird index
  build-atlas.mjs builds the thumbnail sheet (needs sharp)
vercel.json      serves the app at /wrapped/ (and at the root)
start.bat        Windows shortcut for serve.mjs
NOTICE.md        attribution and licences
LICENSE          MIT, for the code
```

## Privacy

The CSV is read in the browser tab and never sent anywhere. The page has no cookies, accounts or analytics. The only network requests are for the page itself, fonts (Google Fonts), two code libraries (html2canvas and JSZip from cdnjs) and the sticker images (jsDelivr), so those providers can see an IP address and which files were requested.

## Attribution and licences

The code is MIT (see `LICENSE`). The artwork and data are third party material and need credit wherever the app is used:

- Bird stickers: [huashu-bird-sticker](https://github.com/alchaincyf/huashu-bird-sticker) by alchaincyf (CC BY 4.0), AI generated
- Taxonomy and IUCN categories: AviList v2026 (CC BY 4.0), via BirdLife International
- Body mass: AVONET (CC BY 4.0)
- English names: IOC World Bird List (CC BY 3.0)

Full details are in `NOTICE.md`. This is an independent project and is not affiliated with eBird or the Cornell Lab of Ornithology.

## Known limits

- The stickers are AI generated and can contain errors.
- A species eBird counts but the sticker set lacks appears without a picture.
- PNG export uses html2canvas from cdnjs, so it needs a connection.
- Sharing straight to Instagram's Story editor needs HTTPS and a phone browser that supports file sharing. It has been tested with scripted input, not on a range of real phones.
- There are no automated tests in the repo yet. `tools/check.mjs` covers deployment, and the interactions were checked by driving a real browser.
