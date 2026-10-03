# aion2-armory-proxy

Cloudflare Worker that forwards four whitelisted NCSoft armory GET routes (`/search`, `/info`, `/equipment`,
`/daevanion`) with CORS for our origins, 10-minute edge caching and a per-IP rate limit. Spec: `CONTRACT.md`.
No secrets; the only config is the `ALLOWED_ORIGINS` var in `wrangler.toml`. It is not a general proxy: do not
widen the route or host whitelist.

## Files
- `worker.js`: the handler (`export default { fetch }`, plus `handle(request, env, ctx, deps)` for tests).
- `wrangler.toml`: Worker name `aion2-armory-proxy`, `ALLOWED_ORIGINS`.
- `dev-server.mjs`: same handler on `http://localhost:8787` via Node `http`, with an in-memory cache (real upstream).
- `test/worker.test.mjs`: `node:test` suite, upstream `fetch` and cache mocked (no network).

## Commands
```
npm test                 # node --test, no network
npm run dev              # http://localhost:8787 (PORT=... to change)
curl "http://localhost:8787/search?keyword=Darththot&region=nae" -H "Origin: http://localhost:5173"
npx wrangler deploy      # deploy: handled by the infra step, see ../DEPLOY_HANDOFF.md
```
Deploy auth: `CLOUDFLARE_API_TOKEN` env var or `npx wrangler login`. Never commit a token.

## Behavior notes
- `characterId` is validated as the decoded base64 form (or the armory's `%3D` form) and re-encoded upstream, so the
  site can send either `encodeURIComponent(decodedId)` or the id exactly as `/search` returned it.
- Rate limit is an in-memory token bucket per client IP (`CF-Connecting-IP`), 60 requests/minute. Workers run many
  isolates, so it is best-effort: it blunts a single abusive client but is not a global guarantee. The free plan's
  100k requests/day is the hard ceiling. Cache hits count against the limit.
- Cache: `caches.default`, key = path + sorted validated query, 2xx only. Cache hits skip the upstream call.
- The dev server's in-memory cache and the Worker's Cache API follow the same code path (`deps.cache`).
