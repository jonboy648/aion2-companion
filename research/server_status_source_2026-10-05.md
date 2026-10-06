# Aion 2 live server status: source research (2026-10-05)

## Bottom line

**No official public endpoint for live server status (players, queue, load) was found.** NCSOFT publishes only static server names. Everything else (population, queue, load, "new / recommended / creation blocked" tags) lives in the game client's login/server-select protocol. Community sites that show it (questlog.gg, aion2.gaming.tools) are not reading a public web API we can find; the most plausible collection methods are a client/packet-sniffing agent (questlog ships a desktop app that needs Npcap) or a logged-in launcher/client session. Web search results from third-party guides also say NC runs no public status dashboard or API ("no checked public server-status API, live population, or queue").

Confidence: high that the official web has no such endpoint (checked homepage, character site bundle, GitHub client libs); medium-low on launcher/PURPLE internals (not inspected: needs authenticated session or traffic capture, out of scope for plain curl).

## What exists officially (names only)

### 1. `GET https://aion2.plaync.com/en-us/api/gameinfo/servers?lang=en-US&region={nae|naw|eu|la|as}`
- Auth: none. Verified 200 JSON. (Without the `/en-us` locale prefix it 404s; the site bundle builds the prefix from the page locale.)
- Response: `{"serverList":[{"raceId":1,"serverId":1101,"serverName":"Siel","serverShortName":"SIE"}, ...]}`
- Static roster only. No population, queue, load, tags.
- Also embedded in every aion2.plaync.com page as `var _serverNameMap = [...]` (adds `region`), plus `_regionNameMap` = `{nae:"North America - East", naw:"North America - West", eu:"Europe", la:"South America", as:"Asia"}`.
- Used by the open-source Go client https://github.com/nuriland/aion2-api (`/api/gameinfo/servers`, "gameDataHost"). Its license was not checked; we only need the endpoint, which we already hit the same way as /api/character.
- KR site answers 404 from outside Korea (per nuriland README), so KR/TW would need a different path or are out of scope.

### Global server roster (from the homepage map, serverId = 1000*race + 100*regionDigit + n)
Region digit: nae=1, naw=2, eu=3, la=4, as=5. Elyos ids 1RNN, Asmodian 2RNN, same NN = same server pair (questlog pairs with `serverId % 100`, matches).
| Region | Elyos ids | Asmodian ids | Pairs |
|---|---|---|---|
| NAE | 1101-1108 | 2101-2108 | 8 |
| NAW | 1201-1205 | 2201-2205 | 5 |
| EU | 1301-1318 | 2301-2318 | 18 |
| LA (South America) | 1401-1406 | 2401-2406 | 6 |
| AS | 1501-1508 | 2501-2508 | 8 |
Names per pair (Elyos / Asmodian), same in every region for slots 1-8: Siel/Israphel, Nezekan/Zikel, Vaizel/Triniel, Kaisinel/Lumiel, Yustiel/Marchutan, Ariel/Azphel, Fregion/Ereshkigal, Meslamtaeda/Beritra. EU-only slots 9-18: Hithanya/Nemon, Nania/Hadala, Tahavatha/Ludra, Luteros/Ulgorn, Phernos/Munin, Daminu/Odar, Kasaka/Zemurru, Bakarma/Kromede, Tsenka/Quai, Kochi/Baba. NAW has slots 1-5, LA slots 1-6. Elyos and Asmodian halves have different names, so a "server" for status purposes = serverId % 100 within a region (questlog's grouping). Pull the live list from the endpoint, not hardcoded.

### 2. Character search `https://api-search.plaync.com/aion2global/search/v2/character` (already proxied)
- `pagination.total` is capped at 10000 (verified: broad keyword `a`, serverId 2103 returned `total:10000`). Not usable as a population count. A narrow keyword gives a real count but is not a population measure. Only a coarse activity proxy at best (see fallbacks).

## Not found
- No `status`, `congestion`, `population`, `worldStatus` strings or endpoints in `aion2.plaync.com` homepage, `characters/index` HTML, or its 838 KB `characters/js/index.js` bundle (hosts referenced: api-community, api-goats, api-search, gameconst/gameinfo APIs only).
- No official status page. NC posts maintenance as notices (`https://aion2.plaync.com/en-us/board/notice/list`), Steam news (AppID 3393110), Discord.
- GitHub: no open-source tool reading server population. Search hits are DPS meters (packet sniffing with Npcap: TK-open-public/Aion2-Dps-Meter, taengu/A2Tools-DPS-Meter, Kuroukihime/AIon2-Dps-Meter, p62003/aletheia_AION2_DPS_Meter), the nuriland API client (names only), and an empty-looking spam repo "aion2-server-status". None query population.
- Community aggregators: questlog.gg (not contacted), aion2.gaming.tools (returned 403 to curl/WebFetch; not pushed). Neither documents a source.

## Private client export (D:\Aion2-tools\export-test\out\AION2\Content\Data\Table, read only, nothing copied)
- `ServerName.json`: `Properties.Data[]` with `ID.Value`, `Name.Key` (`ServerName_<id>_desc`), `ShortName.Key` (`ServerName_<id>_short_desc`). 649 rows; ids include 1-5, 11, 12, ..., 1001-... (KR/TW-style 1xxx and Global 11xx-25xx). Resolve names via `L10N/<locale>/L10NString.json` (en-US has `ServerName_1507_desc = Fregion`, `ServerName_1202_desc = Nezekan`). Read the file as UTF-8.
- `GlobalRegion.json`: `CountryCode` -> `RegionValues[]` (US -> NAW,NAE; JP -> AS; DE -> EU; KR -> NAW,NAE,AS).
- `ServerMatchColor.json`: `ID.Value` -> `MatchColor{R,G,B,A}` (UI color per server).
- No table for load/queue/population/tags (those are runtime server data). The L10N strings contain no server-congestion labels beyond generic ones.
- Use: naming only; the live `/api/gameinfo/servers` already returns English names, so the export is not needed.

## Proxy analysis (proxy/worker.js, CONTRACT.md, schema.sql, wrangler.toml)
- Worker `aion2-armory-proxy`: four whitelisted GET routes, 10 min Cache API, 60 req/min/IP, CORS for becomecube.com, D1 binding `STATS` (db `aion2-stats`) with `visits`, `searches`, `board`. `export default { fetch }` only: **no `scheduled` handler and no `[triggers]` cron in wrangler.toml yet.**
- A cached `/status` endpoint is easy; the hard part is the upstream, which does not exist publicly.

## Fallbacks (ranked)
1. **Static roster + maintenance banner (do now, official, zero risk).** `/servers` route on the Worker proxying `.../en-us/api/gameinfo/servers?region=X` (5 calls, cache 24 h) so the UI lists every real server pair by region. Add a manual `status.json` flag (maintenance on/off, message) edited by hand from NC notices.
2. **Self-collected activity proxy via lookups (weak, say so in UI).** Every `/info` the Worker sees already writes `board` (region, server_id, last_seen). Lookups per server per hour is a measure of OUR users, not the server's population. Label it "Becomecube lookups", never "players".
3. **Search-API probing** (no). `total` caps at 10000 and polling 53 server pairs x 2 races every few minutes is exactly the load that got us rate-blocked elsewhere. Do not build on it.
4. **Opt-in contributed data (best real source if we want true numbers).** Questlog evidently reads network traffic with a desktop agent. We could not verify the protocol. An analogous path: a PySide6/Npcap sniffer in our own companion app that sees the server-select packet and POSTs `{region, serverId, players?, queue?, load?, tags}` to a Worker endpoint. This needs packet reverse engineering (the Jon-owned domain), a client opcode for the server list, and a trust/anti-spoof design (require N independent reports within a window, median). Note the "no-automation line" in the project memory: passive packet reading may collide with it; Jon must decide.
5. **Scrape a community aggregator** (questlog/gaming.tools): explicitly off the table (rate-blocked/403, ToS, fragility).

## Recommended design

### Worker (if/when a real upstream or contributed feed exists)
- `GET /servers`: static roster from `/api/gameinfo/servers` x5 regions, edge cache 24 h, same CORS/rate-limit machinery, reshape to `{region, serverId, pair: serverId%100, race, name, short}`.
- `GET /status?window=168`: reads D1, returns latest snapshot per `(region, server_id)` and optional history. `Cache-Control: public, max-age=30`.
- Ingest (only when a feed exists): either `scheduled()` with `[triggers] crons = ["*/5 * * * *"]` polling the upstream (one fetch per region, sequential, with a User-Agent and a circuit breaker that stops after 3 failures and serves last snapshot with `stale:true`), or `POST /report` from the contributor agent (origin-less, HMAC-signed, per-install token, clamped values, median across reporters).
- Free-tier budget: cron every 5 min = 288 invocations/day, D1 writes = 53 pairs x 2 x 288 = about 30k rows/day: use snapshot-on-change plus hourly rollup, prune raw > 14 days.

### D1 schema (additive, idempotent, same style as schema.sql)
```sql
CREATE TABLE IF NOT EXISTS server_status (       -- latest snapshot
  region TEXT NOT NULL, server_id INTEGER NOT NULL,
  players INTEGER, queue INTEGER,
  load TEXT,        -- normal|busy|full|maintenance|offline|unknown
  tags INTEGER NOT NULL DEFAULT 0,   -- bit1 New, bit2 Recommended, bit4 CharCreateBlocked
  source TEXT NOT NULL,              -- 'official'|'contrib'|'manual'
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (region, server_id));
CREATE TABLE IF NOT EXISTS server_status_history (
  ts INTEGER NOT NULL, region TEXT NOT NULL, server_id INTEGER NOT NULL,
  players INTEGER, queue INTEGER, load TEXT, tags INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_ssh_key_ts ON server_status_history (region, server_id, ts);
```

### UI (becomecube.com)
- Group by region tabs (NAE, NAW, EU, South America, Asia), one row per server pair (Elyos | Asmodian halves), columns: name, load pill, players, queue, tags, 7-day sparkline.
- Ship phase 1 with names + a manual maintenance banner and "live population not available from the official source" text. Every number carries a source label and age ("updated 3 min ago"); unknown shows a dash, never a made-up value.
- Do not claim parity with questlog until a real feed exists.

## Open questions for Jon
1. Is passive packet sniffing (Npcap) acceptable under the project's no-automation line? It is the only route to true population/queue data that is visible so far.
2. Should phase 1 (roster + manual maintenance flag) ship now?

## Upstream population API search (round 2)

Date: 2026-10-05. questlog.gg was not contacted. One request at a time, no auth.

### Answer: NOT FOUND (no official upstream API). Strongest lead is a downstream-confirmed client-side source.

### Endpoints tried
| URL | Result | Fields |
|---|---|---|
| `https://aion2.plaync.com/en-us/api/gameinfo/serverStatus`, `/server-status`, `/worlds`, `/status`, `/serverinfo` (`?lang=en-US&region=nae`) | 302 (redirect; same as any unknown path, the known `/servers` returns 200 JSON) | none |
| `https://aion2.plaync.com/en-us/api/server/status?region=nae` | 302 | none |
| `https://aion2.plaync.com/en-us/api/gameinfo/servers?lang=en-US&region=nae` | 200 JSON (re-verified) | names only (raceId, serverId, serverName, serverShortName) |
| `https://aion2.plaync.com/en-us` (-> `/en-us/index`) | 200; page scripts are only shared NC CDN bundles (ncui.js, nc-home.js, cnb.js, ui.dark-mode.js on assets.playnccdn.com); no `/api/` paths in HTML | none |
| Launch notices "Launch Server List", "New Server and Matchmaking Information" (aion2.plaync.com board/notice) | 200 | text only, no status URL |
| aion2meta.wiki/server-status, expcarry.com/aion-2-server-status | 200 | "official-notice tracker", no API, no population |
| aion2guide.org population guide, timesaver.gg, exitlag | search snippets | all say NC publishes no population/status API; only SteamDB concurrents (Steam only) |
| aion2.gaming.tools/server-status | 403 to WebFetch (not pushed; has live data per search snippet, source undocumented) | n/a |
| `https://dbaion2.ru/en/servers/` (third-party tracker, HTML) | 200 | inline JS calls `fetch('/api/servers')` |
| `https://dbaion2.ru/api/servers` | 200 JSON (one request) | `{updated, servers:[{id, region, race, name, tags, cap, players, at, stale}]}` ; same ids, same tags bitmask (1 New, 2 Recommended, 4 creation locked), cap 7000/7500; no queue field; per-region `at` timestamps, some regions `stale:true` (NAE last report hours old while EU fresh) |
| `https://dbaion2.ru/api/live` | 200 JSON | `{updated, streams:[]}` (Twitch streams, unrelated) |

NCSOFT launcher (PURPLE / NC launcher): no public documentation or open-source client found for a server list/congestion API. Not inspected locally (would need traffic capture; out of scope).
GitHub/forums: web searches for "gameinfo/servers", inMaintenance, Discord population bots returned no repo or bot citing an endpoint. Only DPS meters (Npcap) and the nuriland names client, as in round 1.

### What the evidence says about the real source
- dbaion2.ru runs its own "Farm tracker and DPS meter" desktop client (/en/tracker/). Its servers page says "No data yet - it will appear once players log in", and per-region `at` timestamps go stale when no reporter is online. That is the signature of client-contributed data read from the game's login/server-select traffic, not a polled web API.
- All aggregators (questlog, gaming.tools, dbaion2) share the same shape (players, cap, tags bitmask incl. creation-lock bit). The tags and capacity are therefore fields in the game's own server-list message; no web equivalent exists at plaync.com.
- Third-party sources state "NC publishes no population, no status page, no API".

### Strongest remaining leads
1. Client packet capture of the server-select list on login (Npcap, the same method the DPS meters use). Needs Jon's decision on the no-automation line and opcode reverse engineering.
2. `https://dbaion2.ru/api/servers`: public, unauthenticated JSON, same schema as questlog minus queue. It is a downstream aggregator, no ToS/terms checked, freshness depends on their contributors (stale flag present), no rate-limit info. Usable only with explicit permission from its operator; not recommended as a production dependency. Poll no faster than 5 min if ever used.
3. aion2.gaming.tools (403 to bots): likely same contributor model; ask operator.
4. Contact aggregators (dbaion2 t.me/dbaion2) for a data-sharing arrangement.

## Round 3: game client / launcher server list

Date: 2026-10-05. Read-only. No tokens copied. questlog.gg and gaming.tools not contacted.

### Answer: no HTTP endpoint found locally. The client's server list is not fetched from a discoverable URL, and the in-game UI itself only shows coarse load.

### What I checked
- Install: Steam build at `D:\SteamLibrary\steamapps\common\AION2` (from profiles.json paksDir). There is NO separate NC launcher / PURPLE install: `%LOCALAPPDATA%\NCSOFT` holds only `NccrData\com.ncsoft.aion2global` (crash-report breadcrumb/execution JSON, no URLs), `%APPDATA%` has nothing NC, `C:\ProgramData` nothing NC.
- `%LOCALAPPDATA%\AION2\Saved_Steam`: Config\Windows\*.ini (Engine, Game, GamePlatform, RuntimeOptions, InstallBundle...) contain no server/gateway/lobby URLs. Only hint: `GamePlatform.ini` AppsFlyerLastErrorLog = `...serverselect` (a screen name). `Logs\cef3*.log` (embedded Chromium) is only GPU errors. `webcache_4430` (embedded browser cache) only references `id.plaync.com` (signup/agree/Steam account link), `assets.playnccdn.com` bundles, `irum.plaync.com/collect` (analytics), Google tag manager. No game-API calls.
- `AION2.exe` (156 MB, NCGuard protected): no plaintext or UTF-16 `plaync` / `ncsoft` / `https://` strings other than Microsoft cert URLs. Endpoints are obfuscated or fetched at runtime. `Binaries\Win64\logs` only has a voice-chat SDK log.
- Private export (`D:\Aion2-tools\export-test\out`): no *.ini/*.cfg in the export; only `Content/Data`. L10N strings have no server-list URLs (only plaync.com policy links). Table files: ServerName, GlobalRegion, ServerMatchColor, ServerMessage, ServerErrorMessage: no gateway/host data.
- Strings found: `String_UI_SERVER_STATE_CONGESTION_FULL/BUSY/FREE` = Full / Busy / Normal, `..._SERVER_DELAY_TIME_NOTIE` ("Network status is shown based on login location"), `MSG_TELEPORTWORLD_FAIL_SERVER_IS_FULL`. So the in-game server select shows a 3-state load plus ping, NOT player counts.
- Web/GitHub search ("aion2 server list API", "serverlist", "ServerStatus", "congestion plaync", PURPLE launcher API): nothing citing an endpoint. Only the same trackers and guides as round 2 (questlog, gaming.tools, dbaion2, aion2index.com/servers, aion2meta.wiki, expcarry). Guides again say NC publishes no population.
- No candidate URL, so no curl calls were made this round.

### Interpretation
- The login/server-select data is delivered over the game's own authenticated session after NC/Steam login (id.plaync.com), most likely the proprietary TCP protocol (same family the DPS meters sniff with Npcap). It is not in any config, log, cache or string we can read.
- Exact player counts, capacity (7000/6000/4000/3000), queue length and the creation-lock flag are richer than the 3-state UI label, so the aggregators are reading raw server-list messages (likely client-contributed via a tracker app, matching dbaion2's "appears once players log in" and per-region stale timestamps), or have a privileged feed. gaming.tools "first seen 6 hours ago" fits discovery from contributed reports, not a polled public list.

### Strongest leads (unchanged, now with local evidence)
1. Passive capture of the server-select packet (Npcap) while logged in. Only verified-possible route to the raw data; needs Jon's call on the no-automation line.
2. If we want to confirm an HTTPS fallback exists, one concrete non-evasive step: with Jon's OK, run Windows Resource Monitor / `netstat -b` or Wireshark SNI-only capture (hostnames, not payloads) during launch to a server-select screen, to see which NC hostnames are contacted. Not done here (needs the game running and is a capture).
3. Ask the aggregator operators (dbaion2 t.me/dbaion2) about a data-sharing arrangement; dbaion2 `/api/servers` remains the only public JSON.
