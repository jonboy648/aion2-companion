# Aion 2 gear import: safe read-only options (researched 2026-10-03)

Constraint: never touch the game client (no memory reads, no packet sniffing, no input automation; NCGuard). All options below read data from outside the game process.

## Ranked options

### 1. Official NCSoft web API, via the character-lookup endpoints (RECOMMENDED primary)
- How it works: NCSoft runs a public web armory at `aion2.plaync.com` (KR/Global) and `tw.ncsoft.com/aion2` (TW). The front end loads JSON from `https://aion2.plaync.com/api/...` and `https://tw.ncsoft.com/aion2/api/...`. Daeva and Shugo.gg both call these directly (source: Daeva `src/lib/scraper-shared.js`, `app/api/scrape/route.js`).
- Endpoints seen in Daeva code (verified by reading code, not by a successful call from me):
  - `GET {api}/character/info?lang=en&characterId=<id>&serverId=<n>` returns `profile` (combatPower, factionName/raceName) and `stat.statList` / `statSecondList` (entries `{type, value}`, includes `ItemLevel`).
  - `GET {api}/character/equipment?lang=en&characterId=<id>&serverId=<n>` returns `equipment.equipmentList[]` (fields: `id` item id, `name`, `grade`, `enchantLevel`, `level`/`itemLevel`, `slotPos`, `slotPosName` e.g. MainHand, SubHand, Earring*, Ring*, Bracelet*, Rune*, Arcana*) and `skill.skillList[]` (`name`, `category` Active/Passive/Dp, `skillLevel`, `equip`). "Dp" is the stigma/specialty-skill category, so stigmas ARE exposed.
  - `leaderboard?contentType=..&rankingType=..&page=..&limit=100` (ranking; Shugo FAQ says NCSoft's ranking API has been DOWN since Sept 2026).
  - Character search by name exists (Shugo FAQ: "NCSOFT's search"), but the exact URL is not in Daeva (it takes characterId from leaderboard rows). Needs a browser DevTools capture of the official search page; not captured here.
- Detail not in character/equipment: manastones/theostones/sub-stats. Daeva gets those from Shugo's `POST /api/items/batch-equipment` (see option 2) and item definitions from `batch-details`.
- Daevanion: Daeva code has ZERO references to Daevanion. Shugo FAQ says the official API does not expose skill specializations. Daevanion boards likely are NOT in these endpoints (unverified; capture the official page's network tab while logged in to confirm).
- Reliability: Daeva's own design treats it as flaky (retry ladder, fallbacks, caches). Direct calls need NO Origin/Referer (else 403 "Invalid CORS request"), browser-like User-Agent. My unauthenticated curl of the `/api/leaderboard` and `/api/character/info` paths returned HTTP 302 to a Korean "page not found" HTML, so paths/params may differ on the live KR host, require a cookie/region, or the API is currently down. Treat as unconfirmed until captured from the live page.
- ToS/legal: `aion2.plaync.com/robots.txt` = `User-agent: *  Allow: /` (no restriction found). I did not locate NCSoft's ToS clause on automated access; the API is undocumented and unofficial. For a personal app polling your own character a few times a day risk is low (it is the same call your browser makes, nothing touches the client). Keep rate low, no bulk crawling.
- Global at launch: Shugo.gg says Global character search/profiles/Combat Power have been live since Advanced Access (2026-09-30; full launch 2026-10-05), so a Global armory API exists. The host/path for Global is not confirmed (Daeva only knows `aion2.plaync.com` and TW). Global item data "follows once NCSoft publishes it", so item names may be missing early.

### 2. Shugo.gg
- Site: character pages `https://shugo.gg/character/<global|kr|tw>/<server>/<name>` (Global servers use a sub-region slug, e.g. `eu-kaisinel`). Server-rendered summary (level, class, race, legion, gear score) plus equipment list with enchant levels, and ProfilePage JSON-LD (per `https://shugo.gg/llms.txt`). Client-rendered extras: stigmas, arcana. Covers Global, KR, TW.
- Internal APIs (used by Daeva): `https://shugo.gg/api/proxy?url=<official url>` (proxy of the official API), `POST https://shugo.gg/api/items/batch-equipment` body `{items:[{itemId, enchantLevel, slotPos}], characterId, serverId, region}` returning per-slot `subStats`, `subSkills`, `godStoneStat` (theostones), `magicStoneStat` (manastones), `categoryName`; `POST /api/items/batch-details`.
- ToS/legal: robots.txt `Disallow: /api/`. FAQ: "There is no public API ... Game data belongs to NCSOFT." Using `/api/*` violates their stated crawl rules and is not recommended. Reading the public HTML character page (allowed by robots.txt, JSON-LD included) is the acceptable route; ads-supported site, so be gentle and credit them.
- Reliability: good for Global today; HTML structure may change. Daevanion not listed in their feature text either.

### 3. Other sites (aion2hub, aionflex.gg)
- aion2hub.com: has a stat calculator and item/enchant tools; a search snippet states developers "don't yet have a reliable way to import character data automatically". Not a gear source. aionflex.gg: not investigated (no time/evidence); do not rely on it.
- Daeva (Othmane-ElAlami/Daeva, 0BSD, Next.js + Cloudflare D1): scraper is a reusable reference, not a data source. It is a leaderboard-based meta analyzer; it scrapes top-100 per class via leaderboard, then character/info + character/equipment + batch-equipment. Fields it extracts: gear slots, item id, name, grade, enchantLevel, itemLevel, ItemLevel/gearScore, combatPower, skills/stigmas (Dp), arcana + set bonuses, sub-stats, manastones, theostones. 0BSD means you may copy the parsing logic (slot-name mapping, skillList filtering) freely.

### 4. Screenshot OCR fallback (works for everything, incl. Daevanion; lowest fidelity)
- How: user presses the in-game hotkey themselves (character window; hover item tooltips), app captures the screen with `mss` (already installed) or Windows Graphics Capture of the window, OCRs regions. Screen capture of a window is not memory/packet/input access; still do not inject, hook, or send keys. Capturing is passive and what streaming software does. Residual risk: minimal; NCGuard targets hooks/injection, not capture, but capture via DXGI overlay hooks is a different thing and must be avoided (use desktop duplication/mss, not hooks).
- Tools present on this machine: `mss` 10.0.0, `pillow` 12.2.0, PySide6 6.10.2 (no OCR in Qt). Windows 11 built-in OCR (`Windows.Media.Ocr.OcrEngine`) is present with language en-US available (verified via PowerShell WinRT call); no install needed, but from Python it needs the `winrt-Windows.Media.Ocr` + `winrt-Windows.Graphics.Imaging` packages (only winrt-runtime/Foundation/Storage.Streams are installed now, so adding 2 small pip packages or shelling out to a PowerShell script is required). Korean/other languages need an OCR language capability (admin install; could not verify elevation-gated list).
- Readability: game fonts are clean at 1080p+ and numeric stats OCR well; item names with icons overlay, rarity-colored text on gradient backgrounds, and tooltip transparency lower accuracy. Mitigate with fixed-ROI crops, upscale 2x, and matching item names against the item database (fuzzy match) rather than free text.
- Fields: whatever the UI shows (stats, enchant +N, names, stigma names, Daevanion node levels from the board screen). Reliability medium, per-resolution/UI-scale calibration needed; hotkey and window layout not verified by me (see existing notes in D:\Aion2\research\daevanion_ui_ref.md and game_ui_and_progression.md).
- Works for Global at launch: yes, no dependency on any server.

## Recommendation
1. Build the importer as a pluggable provider: (a) official NCSoft armory JSON for the user's own character (character/info + character/equipment), configured by pasted characterId/serverId, with a polite 1 request per refresh, no Origin/Referer headers; (b) user-initiated manual refresh only.
2. First action: open the official Global armory page in your own browser, DevTools Network tab, search your own character, and record the exact search URL, Global host and whether Daevanion appears in the responses. That settles the main unknowns (the Global endpoint and Daevanion).
3. Daevanion (and anything the API omits): OCR of the Daevanion board screen with fixed ROIs, or manual entry UI pre-filled from OCR.
4. Do not use `shugo.gg/api/*` (robots disallow, "no public API"); the HTML profile page with JSON-LD is an acceptable low-volume fallback.

## Unverified / open items
- Exact official search endpoint and Global API host; whether Daevanion is in any official JSON.
- NCSoft ToS wording on automated access (not found).
- aionflex.gg not examined.
