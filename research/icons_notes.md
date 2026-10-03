# Aion 2 icons - research notes (2026-10-03)

## Local state
D:\Aion2 was empty at start (no client install, no pak files).

## Sources found
| Source | What | Verdict |
|---|---|---|
| https://aion2.app/db/skills/<id> (page title "Aion2t.com") | Community DB built from the game-client DB; skill/stigma/item/pet/wing/title pages each carry a 256x256 WebP icon | USED. robots.txt allows /db (disallows /api, /admin) |
| https://aion2.app/db-item-icons/<ICON_NAME>.webp | Predictable icon path. Skill icons: ICON_SO_SKILL_nnn / ICON_SO_SKILL_Passive_nnn (SO = Sorcerer; other classes GL, TE, AS, RA, EL, CL, CH). Stigma items: Icon_Item_Usable_Stigma_SO_A_c_nnn. Common skills: ICON_CO_SKILL_nnn | USED |
| https://aion2.app/sitemap-db.xml | Lists /db/skills, items, pets, wings, titles ids (Sorcerer skill ids = 15xxxxxx) | USED for the id list (51 ids) |
| github.com/265ada/aion2-macros | icons/ICON_*_SKILL_nnn.webp (253 files, all 8 classes) plus data/skills.json, stigma_db.json, iconmap.json (name -> icon id). No license | Good cross-check/mirror, not downloaded |
| github.com/Egor-Slutskiy/aion2-skill-calculator | assets/skills/<class>/<slug>.webp (21 sorcerer) plus arcana art. No license | Alternative, partial |
| aion2hub.com, guildorder.com, aion2.wiki, aion2.plaync.com | Guides/patch notes; no usable icon URL pattern found | Not used |

## URL patterns
- Skill page: https://aion2.app/db/skills/<8-digit id>
- Icon: https://aion2.app/db-item-icons/<ICON_NAME>.webp (256x256 RGBA)
- Items/pets/wings/titles: /db/items|pets|wings|titles/<id>, same icon path (not crawled).

## Coverage
- Sorcerer skills (active, passive, stigma, common, weapon-equip): 51 of 51 ids the site lists = 100% of what the DB exposes. Saved as PNG in assets/icons/sorcerer/<slug>.png; index in assets/icons/index.json (slug -> name, source_url, size, plus skill_id and icon).
- The index includes shared entries (Dodge, Equip Sorcerer Weapon) that the DB files under Sorcerer.
- Generic UI icons (stat glyphs, item categories, currency, inventory chrome): 0%, deliberately not crawled. Items/pets/wings/titles share the same icon path and can be fetched on demand. HUD/stat glyphs are likely NOT in the DB.
- Unverified: how fast the DB tracks live-client patches.

## Recommended path to full coverage
1. Short term: extend the downloader to /db/items (stigma items, gear), pets, wings, titles at <=1 request per 0.5-1 s, pulling only what the app displays.
2. Complete route (UI chrome, stat icons, anything not in the DB): local extraction from the installed client. Aion 2 is Unreal Engine 5: content ships as .pak plus IoStore .utoc/.ucas containers, normally encrypted with an AES key; icons are Texture2D .uasset/.uexp (BC/DXT, named ICON_*). Typical tools: FModel or CUE4Parse to browse and export textures as PNG; UAssetGUI for asset metadata. Only on your own installed files, offline, for personal use. Do not read process memory, inject, or bypass the anti-cheat/launcher protection; if the AES key is not obtainable by legitimate means, stay with route 1. DB icon names (ICON_SO_SKILL_nnn) match client asset names, so extracted textures map 1:1.

## License / IP
All art is (c) NCSOFT. Fetched for personal, non-commercial companion-app use. Do not redistribute or ship in a public release; keep assets/ out of public repos. aion2.app and the GitHub repos state no license for the images. Local copies avoid hot-linking their server.
