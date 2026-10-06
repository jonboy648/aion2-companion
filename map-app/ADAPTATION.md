# Become Cube map distribution

This is the approved English/static copy of AION2 Interactive Map, originally by
Yihao Liu (tc-imba) and contributors. The upstream source is
https://github.com/aion2-interactive-map/aion2-interactive-map.

Original code remains GPL-3.0; retain LICENSE. Original marker data retains its
CC BY-NC 4.0 attribution. PERMISSION_NOTE.md records the owner's statement about
permission; it does not replace the original notices. Only derived game assets
and marker files are included, not the private client export or extraction keys.

Become Cube changes: English/static copy supplied by the project owner, additional
exported zones and markers, site header, /map/ deployment base, credits/source
download, and local build packaging. The map is a separate application; existing
party-share links continue to use the companion's /maps page.

Build from the repository root after `npm ci --prefix web` and
`npm ci --prefix map-app`:

    npm run build --prefix web
    node web/scripts/build-map.mjs

The second command adds the map to web/dist/map, including direct-entry HTML for
About and Crafting, LICENSE, and a corresponding-source archive. It does not
contact the original app's backend, analytics or CDN. Outside credit hyperlinks
remain ordinary user-initiated links.
