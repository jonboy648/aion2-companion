# Armory proxy contract (Cloudflare Worker `aion2-armory-proxy`)

The browser cannot call NCSoft's armory directly (`aion2.plaync.com/api/character/*` sends no CORS header,
`api-search.plaync.com` answers 403 to a foreign Origin). The Worker forwards exactly four whitelisted GET routes,
adds CORS for our origins, caches, and rate-limits. It holds no secrets and is NOT a general proxy.

Site side: `web/src/lib/armory.ts` reads `VITE_ARMORY_PROXY_URL` (build-time, public; CI fills it from repo variable
`ARMORY_PROXY_URL`). Infra side: see `DEPLOY_HANDOFF.md`.

## Common behavior

| Topic | Rule |
|---|---|
| Methods | `GET` and `OPTIONS` only. Anything else: `405`. |
| Unknown path | `404` `{"error":"not_found"}`. No other upstream host or path is ever contacted. |
| Upstream request | Sent with a desktop-browser `User-Agent` (see `armory.py` USER_AGENT) and `Accept: application/json`. No cookies, no `Origin`/`Referer` forwarded. |
| Param validation | Each param is checked against the pattern below; a bad or missing required param is `400` `{"error":"bad_request","param":"<name>"}`. Unknown params are dropped, never forwarded. |
| Response body | Upstream JSON passed through byte-for-byte (no reshaping: `aion2c.armory` parses it in the browser). Upstream non-2xx status is passed through with body `{"error":"upstream","status":<n>}`. Upstream timeout (10 s): `504` `{"error":"upstream_timeout"}`. |
| CORS | Env `ALLOWED_ORIGINS` (comma list): `https://becomecube.com,https://www.becomecube.com,http://localhost:5173,http://localhost:4173`. If request `Origin` is in the list: `Access-Control-Allow-Origin: <that origin>`, `Vary: Origin`, `Access-Control-Allow-Methods: GET, OPTIONS`, `Access-Control-Allow-Headers: Content-Type`, `Access-Control-Max-Age: 86400`. Otherwise no ACAO header (browser blocks it); a request with no Origin (curl) is served without ACAO. `OPTIONS` preflight: `204` with the same headers. |
| Cache | Successful (2xx) responses cached 10 min at the edge (Cache API, key = path + canonical sorted query) and sent with `Cache-Control: public, max-age=600`. Errors are never cached. Header `X-Cache: HIT|MISS`. |
| Rate limit | Per client IP (`CF-Connecting-IP`): 60 requests per rolling minute across all routes (cache hits count). Over limit: `429` `{"error":"rate_limited"}` with `Retry-After: <seconds>`. Best-effort (per-isolate / Cache-API counter); the Cloudflare free plan (100k requests/day) is the hard ceiling. |
| Secrets | None. No env var other than `ALLOWED_ORIGINS`. |

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
