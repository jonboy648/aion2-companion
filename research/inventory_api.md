# Does any public official endpoint expose inventory / warehouse / materials / currency? (2026-10-03)

## Verdict
No. The official web armory exposes only what the public character sheet shows: profile, stats, titles, Daevanion board list, equipped gear (with skins), equipped skills, pet and wing. There is no inventory, warehouse (account/legion), materials, currency (Kinah, Abyss points, etc.), crafting-mastery, or unequipped-item endpoint, and nothing in the official JS references one. Shugo.gg loads the same endpoints and nothing more. I did not try any authenticated or guessed-private paths (not allowed); every path I probed returned the public SPA redirect (HTTP 302) rather than data.

## What I checked
1. Official front-end bundle: `https://assets.playnccdn.com/static-aion2/characters/js/index.js` (838 KB, loaded by `https://aion2.plaync.com/en-us/characters/index`). All `/api/` strings in it:
   - `/api/character/info`
   - `/api/character/equipment` and `/api/character/equipment/item`
   - `/api/character/daevanion/detail`
   - `/api/gameinfo/classes`, `/api/gameinfo/servers`, `/api/gameinfo/pcdata`
   - `/api/gameconst/item`
   - plus the search host `api-search.plaync.com/aion2global/search/v2/character` (also a `search/v...` string)
   Grep for inventory, warehouse, storage, wallet, kinah, material: only unrelated hits (localStorage, Intl currency formatting).
2. Playwright capture of the official characters page: only the three `gameinfo/*` calls on load (servers, classes, pcdata). Character data loads after a search.
3. Playwright capture of `https://shugo.gg/character/global/nae-triniel/DarthThot` (redirects to `/character?id=...&server=2103&region=GLOBAL`). Requests that matter:
   - `GET shugo.gg/api/proxy?url=<official>/api/character/info?lang=en-US&characterId=..&serverId=2103&region=nae`
   - `.../api/character/equipment?...`
   - `.../api/character/daevanion/detail?...&boardId=61,62,63,64,66` (only boards with open nodes)
   - `POST shugo.gg/api/items/batch-details` body `{itemIds:[...]}` (shugo's own item definitions)
   - `POST shugo.gg/api/items/batch-equipment` body `{items:[{itemId,enchantLevel,slotPos}],characterId,serverId,region}` (per-instance data: wraps the official `equipment/item` call)
   - `GET shugo.gg/api/leaderboard/combat-power`, `/api/items/status`, `/api/user/me` (its own services)
   - `GET aion2.plaync.com/en-us/api/gameinfo/classes|servers`, search host for name search.
   Nothing about inventory. Shugo's character tabs are Equipment, Skills, Daevanion, Stats, Ranks, Cosmetics.
4. Existing samples in D:\Aion2\research\armory_samples\ (info.json, equipment.json) and `armory.py` (it uses info, equipment, daevanion/detail only; it does not call `equipment/item` yet).

## Exactly what IS available per character
Base: `https://aion2.plaync.com/api/character/<x>?lang=en-US&characterId=<url-encoded id>&serverId=<n>&region=<nae|naw|eu|la|as>`. No Origin/Referer, browser-like User-Agent (per gear_import.md); I did not need cookies. Search: `api-search.plaync.com/aion2global/search/v2/character?keyword=&page=1&size=100&localeInfo=en-US&region=&serverId=`.

| Endpoint | Fields |
|---|---|
| `info` | `profile` (characterId, level, name, class, CP, race, gender, serverId/Name, titleId/Name/Grade, profileImage); `stat.statList[17]` = STR, DEX, INT, CON, AGI, WIS, ten deity stats (Justice, Freedom, Illusion, Life, Time, Destruction, Death, Wisdom, Destiny, Space) and `ItemLevel` (707 for DarthThot), each with `statSecondList` (the converted effect text, e.g. "Attack increase +1.4%"); `title` (ownedCount 30 of totalCount 297, `titleList[]` with equipCategory, equipStatList, ownedCount/ownedPercent); `ranking.rankingList` (null: ranking API is down); `daevanion.boardList[]` (id 61-66, name, open, openNodeCount, openPercent, totalNodeCount) |
| `equipment` | `equipment.equipmentList[]` (id, name, grade, enchantLevel, exceedLevel, icon, slotPos, slotPosName), `equipment.skinList`, `petwing` (pet id/level/name, wing id/enchant/grade, wingSkin), `skill.skillList` (equipped/known skills) |
| `equipment/item` (+ `id`, `enchantLevel`, `slotPos`) | Per-instance item detail. For the user's own gear the official JS also renders `magicStoneStat[]` (name, value, grade, icon), `godStoneStat[]` (name, grade, desc), `subStats`, `subSkills`, `exceedLevel`. The three stone/skills arrays are confirmed from the bundle source, but DarthThot has no socketed stones or rolled items so I could not see live values. |
| `daevanion/detail` + `boardId` | `nodeList`, `openSkillEffectList`, `openStatEffectList` |
| `gameinfo/classes|servers|pcdata` | static class, server, race-gender id lists |
| `gameconst/item?id=&enchantLevel=` | static item definition, no character needed (see gear_data.md) |

Slot ids seen: 1 MainHand, 2 SubHand, 3 Helmet, 4 Shoulder, 5 Torso, 6 Pants, 7 Gloves, 8 Boots, 10 Necklace, 11/12 Earring1/2, 13/14 Ring1/2, 15 Bracelet1 (bracelet2 presumably 16), 17 Belt, 19 Cape, 22 Amulet; Arcana and Rune slots appear in other characters (per gear_import.md; not in DarthThot).

## What is NOT available
- Inventory bag contents, warehouse (character, account, legion), unequipped or spare gear, enchant stones and other materials, currencies (Kinah, Abyss Points, etc.), crafting mastery levels, quest/dungeon progress, daily/weekly state, auction listings, friends/legion roster. None appear in any official endpoint or the official JS.
- Rolled random stats on equipped items: expected via `equipment/item?characterId=` (that is why shugo's batch-equipment returns `subStats`), but not yet verified on a live rolled item.
- Skill specialization points ("specialty skills" are shown as equipped/acquired lists only; shugo FAQ says the same).
- Rankings (`ranking.rankingList` null; shugo says NCSoft's ranking API has been down since Sept 2026).

## Options if we want inventory-like data (no auth bypass, no client contact)
1. User-entered: a small "what I own" form (materials, a few key items) saved locally. Cheapest and honest; feeds the shopping list and the upgrade advisor.
2. Screenshot OCR of the in-game inventory the user opens themselves (gear_import.md option 4; mss + Windows OCR). Passive screen capture only, no hooks. Medium effort, medium reliability.
3. Nothing from packets or memory (NCGuard, ToS): rejected, as in prior notes.

## Notes and risks
- The armory API is undocumented. Shugo robots.txt disallows `/api/`; do not call shugo's API, call the official one directly (our current approach). Keep the 0.4 s delay.
- Name search is regional (5 regions); `characterId` is URL-safe-base64 with `=` that must be re-encoded in URLs.
