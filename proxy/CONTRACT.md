# Armory proxy contract (Cloudflare Worker `aion2-armory-proxy`)

The browser cannot call NCSoft's armory directly (`aion2.plaync.com/api/character/*` sends no CORS header,
`api-search.plaync.com` answers 403 to a foreign Origin). The Worker forwards exactly four whitelisted GET routes,
adds CORS for our origins, caches, and rate-limits. It is NOT a general proxy. It also hosts owner analytics (see
"Owner analytics" below); that is the only reason it holds secrets (`ADMIN_TOKEN`, `ADMIN_SALT`).

Site side: `web/src/lib/armory.ts` reads `VITE_ARMORY_PROXY_URL` (build-time, public; CI fills it from repo variable
`ARMORY_PROXY_URL`). Infra side: see `DEPLOY_HANDOFF.md`.

## Common behavior

| Topic | Rule |
|---|---|
| Methods | `GET` and `OPTIONS` for the armory routes (anything else: `405`). `POST` only on `/hit` and `/picked`. |
| Unknown path | `404` `{"error":"not_found"}`. No other upstream host or path is ever contacted. |
| Upstream request | Sent with a desktop-browser `User-Agent` (see `armory.py` USER_AGENT) and `Accept: application/json`. No cookies, no `Origin`/`Referer` forwarded. |
| Param validation | Each param is checked against the pattern below; a bad or missing required param is `400` `{"error":"bad_request","param":"<name>"}`. Unknown params are dropped, never forwarded. |
| Response body | Upstream JSON passed through byte-for-byte (no reshaping: `aion2c.armory` parses it in the browser). Upstream non-2xx status is passed through with body `{"error":"upstream","status":<n>}`. Upstream timeout (10 s): `504` `{"error":"upstream_timeout"}`. |
| CORS | Env `ALLOWED_ORIGINS` (comma list): `https://becomecube.com,https://www.becomecube.com,http://localhost:5173,http://localhost:4173`. If request `Origin` is in the list: `Access-Control-Allow-Origin: <that origin>`, `Vary: Origin`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`, `Access-Control-Allow-Headers: Content-Type, Authorization`, `Access-Control-Max-Age: 86400`. Otherwise no ACAO header (browser blocks it); a request with no Origin (curl) is served without ACAO. `OPTIONS` preflight: `204` with the same headers. |
| Cache | Successful (2xx) responses cached 10 min at the edge (Cache API, key = path + canonical sorted query) and sent with `Cache-Control: public, max-age=600`. Errors are never cached. Header `X-Cache: HIT|MISS`. |
| Rate limit | Per client IP (`CF-Connecting-IP`): 60 requests per rolling minute across all routes (cache hits count). Over limit: `429` `{"error":"rate_limited"}` with `Retry-After: <seconds>`. Best-effort (per-isolate / Cache-API counter); the Cloudflare free plan (100k requests/day) is the hard ceiling. |
| Secrets | Only for analytics: `ADMIN_TOKEN`, `ADMIN_SALT` (Worker secrets, never in git). The four armory routes need none. |

Character fetch costs 2 + (boards with open nodes, up to 6) calls (`info`, `equipment`, `daevanion` per board),
so one import is about 5 requests: the browser spaces them (about 0.4 s) like `armory.py` does.

## Routes

Param patterns: `region` = `nae|naw|eu|la|as`; `characterId` = URL-safe base64 characterId as the armory returns it,
`^[A-Za-z0-9_\-=%]{8,128}$` (the browser sends it percent-encoded, as `armory.py` does); `serverId` = `^\d{1,6}$`;
`boardId` = `^\d{1,4}$`; `keyword` = 1-32 chars, no control chars.

### GET /search

| Query | Required | Notes |
|---|---|---|
| `keyword` | yes | character name |
| `region` | yes | one region per call; the site loops regions for "all regions" |
| `page` | no, default 1 | 1-10 |
| `size` | no, default 100 | 1-100 |

Upstream: `https://api-search.plaync.com/aion2global/search/v2/character?keyword={keyword}&page={page}&size={size}&localeInfo=en-US&region={region}&serverId=`

Response: upstream JSON, `{"list":[{"characterId","name":"<strong>..</strong>","race","pcId","level","serverId","serverName","region"}],"pagination":{...}}`.
The browser strips tags and URL-decodes `characterId` (`ArmorySearchHit` in `web/src/lib/types.ts`).

### GET /info

Query: `characterId`, `serverId`, `region` (all required).
Upstream: `https://aion2.plaync.com/api/character/info?lang=en-US&characterId={characterId}&serverId={serverId}&region={region}`
Response: upstream JSON (`profile`, `stat`, `daevanion.boardList`, ...).

### GET /equipment

Query: `characterId`, `serverId`, `region` (all required).
Upstream: `https://aion2.plaync.com/api/character/equipment?lang=en-US&characterId={characterId}&serverId={serverId}&region={region}`
Response: upstream JSON (`equipment.equipmentList`, `skill.skillList`, ...).

### GET /daevanion

Query: `characterId`, `serverId`, `region`, `boardId` (all required). Maps to the armory's `daevanion/detail`.
Upstream: `https://aion2.plaync.com/api/character/daevanion/detail?lang=en-US&characterId={characterId}&serverId={serverId}&region={region}&boardId={boardId}`
Response: upstream JSON (`nodeList` with `open`, `col`, `row`, `name`).

## Browser-side assembly (web/src/lib/armory.ts, Wave 1)

`fetchCharacter(characterId, serverId, region)`: `/info`, then `/equipment`, then `/daevanion` for each board in
`info.daevanion.boardList` with `openNodeCount > 0`; returns `{info, equipment, daevanion: {boardId: detail}}`
= `ArmoryRaw`, handed untouched to `webapi.import_character`.

## Verification (after deploy)

`curl "<worker>/search?keyword=Darththot&region=nae" -H "Origin: https://becomecube.com"` returns JSON listing
DarthThot (Triniel, serverId 2103) with `Access-Control-Allow-Origin: https://becomecube.com`.
A request with `Origin: https://evil.example` returns no ACAO header. `/anything-else` returns 404.

## Owner analytics

Storage: Cloudflare D1 binding `STATS` (database `aion2-stats`), schema in `schema.sql` (`visits`, `searches`).
**If the binding is absent (local dev, tests) every logger is a silent no-op and nothing else changes.** All logging runs
inside `ctx.waitUntil`, after the response is built, and swallows its own errors, so it can never slow or break a response.

Privacy: raw IPs and user agents are never stored. `visits.visitor` = first 16 hex chars of
`SHA-256(ip | UTC day | ADMIN_SALT)`. The id changes daily (cannot follow a person across days) and the secret salt stops
brute-forcing the IP space from a table dump. Unique visitors per day are countable; multi-day "unique visitors" are the
sum of daily uniques. Search keywords are public game data (character names).

### POST /hit
Body (JSON, sent as `text/plain` to avoid a preflight): `{"path":"/c/nae/2103/Name"}`. Called once per page view.
`path` is checked against the site's route patterns (`/`, `/guide`, `/build`, `/daevanion`, `/codex`, `/codex/:classKey`,
`/keybinds`, `/crafting`, `/roadmap`, `/compare`, `/c/:region/:serverId/:name`), max 200 chars, no query/fragment; it is
stored normalized (e.g. `/c/:region/:serverId/:name`). `/admin` is not countable. Requires an allowed `Origin` (`403`
otherwise). Own rate-limit bucket (60/min per IP, separate from armory traffic). Success: `204`. Bad body or path: `400`.
New site routes must be added to `PATH_PATTERNS` in `stats.js`, or their hits are rejected with 400.

### POST /picked
Body: `{"name":"DarthThot","server":"Triniel"}` (name 1-32 chars, server up to 32; server is the display name). Sent when
a user opens a character. Attached to the newest search row of the last hour with no pick yet, results > 0, and a keyword
that the name starts with (best effort: there is no visitor link, by design). No match: nothing is written. Same origin
rule, rate limit and responses as `/hit`.

### GET /search logging
Existing route. On every successful `page=1` search (cache hit or miss) one row is logged: keyword (trimmed, max 32),
region, result count (`list.length`). The site searches all five regions for "Auto", so one user search is up to five rows
(one per region lookup); the dashboard labels the counts "Lookups". Upstream errors and invalid requests are not logged.

### GET /admin/stats
Header `Authorization: Bearer <ADMIN_TOKEN>`; constant-time compare (both sides SHA-256'd, then XOR-compared). Missing,
malformed or wrong token, or `ADMIN_TOKEN` unset/empty: `401 {"error":"unauthorized"}`. Valid token but no D1 binding:
`503 {"error":"stats_unavailable"}`. Own rate-limit bucket (60/min per IP). CORS as above. `Cache-Control: no-store`.

```json
{
  "generated_at": 1760000000000,
  "totals": { "today": {"page_views":0,"unique_visitors":0}, "last_7_days": {}, "last_30_days": {}, "all_time": {} },
  "visits_per_day": [ {"day":"2026-10-03","page_views":0,"unique_visitors":0} ],
  "top_paths": [ {"path":"/","page_views":0} ],
  "top_searches": [ {"keyword":"DarthThot","count":7,"last_ts":1760000000000} ],
  "recent_searches": [ {"ts":1760000000000,"keyword":"Darth","region":"nae","results":3,"picked":{"name":"DarthThot","server":"Triniel"}} ]
}
```
`visits_per_day`: exactly 30 UTC days, oldest first, zero-filled. `top_paths`: top 20, last 30 days. `top_searches`: top 50,
all time, grouped case-insensitively. `recent_searches`: newest 100, `picked` is `null` until a character is opened.

## Public board (D1 table `board`, same STATS binding)
Public data only. The Worker records a character itself from the armory's own `/info` response (cache hit or miss):
`profile.characterName`, `className`, `serverId`, `serverName`, `characterLevel`, `combatPower`, plus the region from the
request. Nothing about the visitor is stored. Repeat lookups update the row and bump `lookups`. No D1 binding: nothing is
recorded and `GET /board` answers `503 {"error":"board_unavailable"}`.

### GET /board
Query: `sort` = `recent` (default, newest lookups) | `power` (Combat Power) | `gear` (item level, the "gear score") | `dps` (max-potential estimate, only rows
that have one); optional `class` (name, case-insensitive, `[A-Za-z' -]{1,24}`); `limit` 1-50 (default 25). Public,
read-only, own rate-limit bucket, `Cache-Control: public, max-age=30`. Bad param: `400 {"error":"bad_request","param"}`.
```json
{ "sort": "power", "generated_at": 1760000000000,
  "rows": [ {"name":"DarthThot","class_name":"Sorcerer","server_name":"Triniel","region":"nae","server_id":2103,
             "level":45,"combat_power":38507,"item_level":738,"max_dps":15000,"last_seen":1760000000000} ] }
```
The internal `character_id` is never returned.

### POST /board/dps
Body `{"region","serverId":int,"characterId","dps":number}` (text/plain JSON, like `/hit`). The one browser-supplied
number: the site's max-potential DPS estimate for the boss playstyle with obtainable gear. Only the site's own origin;
own rate limit. Updates a row the Worker already created (`404 {"error":"unknown_character"}` otherwise); `dps` must be
1..1,000,000 (rounded), so a forged or out-of-range value changes nothing. The board labels it an unverified estimate.
`204` on success.

`item_level` is the armory's own `ItemLevel` stat from `/info`, recorded by the Worker like Combat Power (null for characters
recorded before it existed, until they are looked up again). Existing databases need `proxy/migrations/2026-10-04-board-item-level.sql`
once; until then the Worker keeps working and `sort=gear` returns an empty list.

## Live server status (D1 tables `server_status`, `server_status_history`, `region_history`, `server_roster`, `status_meta`)
Not an armory route: it reads two public sources, never the visitor. Needs the STATS D1 binding plus
`migrations/2026-10-05-server-status.sql` (idempotent); without them the cron does nothing and `GET /status` answers
`503 {"error":"status_unavailable"}`.

### Cron (`scheduled`, `crons = ["*/5 * * * *"]` in wrangler.toml)
- Fetches `https://dbaion2.ru/api/servers` (`{updated, servers:[{id, region, race, name, tags, cap, players, at, stale}]}`)
  with `User-Agent: becomecube.com server-status (...)`. Every row is validated: id must be a Global id (Elyos `1RNN`, Asmodian
  `2RNN`, R = 1 nae, 2 naw, 3 eu, 4 la, 5 as) and agree with the row's `region` and `race`; name `[letters digits space ' - .]{1,24}`;
  `cap` 1..100000; `players` 0..100000; `tags & 7` (1 New, 2 Recommended, 4 Character creation blocked). Bad rows are dropped,
  duplicates ignored. No usable row, a non-2xx, a timeout or bad JSON = upstream failure.
- Success: upserts `server_status` (latest per `server_id`; servers no longer in the feed are deleted), appends
  `server_status_history (server_id, ts, players)` and `region_history (region, ts, players)` for non-`stale` rows only
  (a repeated stale count would draw a flat line that never happened), prunes history older than 30 days, sets
  `status_meta.last_ok_at` / `feed_updated`.
- Failure: all stored data is kept; only `status_meta.last_error_at` is set.
- Roster: `GET aion2.plaync.com/en-us/api/gameinfo/servers?lang=en-US&region=<r>` for the five regions, at most once per 24 h
  (`status_meta.roster_at`), validated the same way into `server_roster`. Used only for servers the feed does not list.

### GET /status
Optional `server=<4-digit id>` (any id of the pair) and `range=24h|7d|30d` (default `24h`, only with `server`). Public, own
rate-limit bucket (60/min/IP), CORS as above, `Cache-Control: public, max-age=60` and the same 60 s Cache API entry
(`X-Cache: HIT` on a cached answer). History slices are cached separately (24h 5 min, 7d/30d 1 h) so D1 reads stay far below
the free tier. Bad `server`/`range`: `400 {"error":"bad_request","param"}`. No D1: `503`.
```json
{ "generated_at": 1760000000000, "last_ok_at": 1760000000000, "last_error_at": null, "feed_updated": 1760000000000,
  "regions": [ {"region":"eu","servers":36,"reporting":36,"players":210000,"capacity":258000,"stale":false,"source_at":1760000000000} ],
  "servers": [ {"id":1301,"region":"eu","race":1,"name":"Siel","tags":0,"capacity":7500,"players":6621,
                "source_at":1760000000000,"stale":false,"fetched_at":1760000000000,"listed":true} ],
  "history": { "24h": {"step_ms":300000,"ts":[0],"regions":{"nae":[null],"naw":[null],"eu":[6621],"la":[null],"as":[null]}},
               "7d":  {"step_ms":3600000,"ts":[],"regions":{}}, "30d": {"step_ms":10800000,"ts":[],"regions":{}} } }
```
- `regions` always has all five codes in order. `players`/`capacity` sum only servers that report; `reporting` counts them;
  `stale` is true when every reporting server of the region is stale; `source_at` is the newest upstream report time.
- `servers`: one row per half (Elyos 1RNN / Asmodian 2RNN, pair = `id % 100` within a region). `listed:false` rows come from
  the official roster: `players`, `capacity`, `source_at`, `fetched_at` are `null` (the site shows maintenance/offline).
  `stale:true` means the upstream says the count is old (`source_at` tells how old); the numbers are still returned.
- `history` is columnar: `ts[i]` (bucket start, unix ms) lines up with `regions.<code>[i]` (average players, `null` = no fresh
  data). 24h = raw 5-minute points, 7d = hourly averages, 30d = 3-hourly averages.
- `?server=<id>` returns `{generated_at, pair:[elyosId, asmodianId], range, step_ms, ts, elyos, asmodian}` instead.
- Population is the upstream's own number (contributed by game clients) and is not verified by us.

Deploy (Worker owner): `cd proxy && npx wrangler d1 execute aion2-stats --remote --file=migrations/2026-10-05-server-status.sql`,
then `npx wrangler deploy` (publishes the cron trigger too). No new secrets.
