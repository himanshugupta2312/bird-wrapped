# Attribution

Birding Wrapped uses third party data and artwork. Keep this notice, and the credits block in `site/index.html`, with any copy or deployment.

| What | Source | Licence |
|---|---|---|
| Bird sticker illustrations | [huashu-bird-sticker](https://github.com/alchaincyf/huashu-bird-sticker) by alchaincyf (Huashu). AI generated artwork. | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Taxonomy (orders, families, scientific names) and IUCN categories | AviList v2026, with IUCN categories from BirdLife International via AviList | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Body mass | AVONET | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| English bird names | IOC World Bird List 15.2, as packaged in huashu-bird-sticker | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |

## Changes made

- `site/data/birds.json` is a compact index built from huashu-bird-sticker's `data/species.json` (selected fields only: scientific name, English name, order, family, sticker path, mass, habitat, migration, IUCN category). Build it with `node tools/build-data.mjs`.
- `site/data/atlas.webp` is a scaled down copy of every sticker (40 pixel tiles on one sheet), built with `node tools/build-atlas.mjs`. It is used only where hundreds of birds have to be drawn at once, so the same credit and CC BY 4.0 licence apply to it.
- The full size stickers themselves are not copied into this repository. They load from the original repository through jsDelivr (falling back to raw.githubusercontent.com). On the story cards they are scaled, rotated and arranged, and nothing else is done to them.

## Not affiliated

This is an independent personal project. It is not affiliated with or endorsed by eBird, the Cornell Lab of Ornithology, iNaturalist, Instagram, or the authors of the datasets above. eBird is a service of the Cornell Lab of Ornithology.

## Privacy

A visitor's CSV is parsed in their browser and is never uploaded. The only network requests are for the page itself, fonts, the html2canvas library and the sticker image files.

## Code licence

The code in this repository (everything except the third party material above) is released under the MIT licence in `LICENSE`.
