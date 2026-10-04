# Deploy handoff: becomecube.com (Cloudflare Worker + GitHub Pages + GoDaddy DNS)

For the agent doing infrastructure. Jon has approved this deployment. **Start only when Jon says the build is done.** Until then, `web/` and `proxy/` may not exist yet or may still be changing.

## What you're deploying
| Piece | Where | Host |
|---|---|---|
| Static site (React, Vite build output) | repo `jonboy648/aion2-companion`, folder `web/` | GitHub Pages (free) |
| Armory proxy (Cloudflare Worker) | same repo, folder `proxy/` (`worker.js` + `wrangler.toml`, Worker name `aion2-armory-proxy`) | Cloudflare Workers (free plan) |
| Domain | `becomecube.com` (apex) + `www` | DNS at GoDaddy. Jon OK'd **replacing anything currently on the domain** |

The proxy only forwards 4 whitelisted NCSoft armory endpoints (search, info, equipment, daevanion detail). It adds CORS for the site's origins, caches for 10 minutes, and rate-limits per IP. The armory routes need no secrets; owner analytics (step 1b) uses two Worker secrets and a D1 database.

## Contract between the pieces (the build team implements this)
- Worker env var `ALLOWED_ORIGINS` = `https://becomecube.com,https://www.becomecube.com,http://localhost:5173,http://localhost:4173`
- The site reads the proxy URL at build time from `VITE_ARMORY_PROXY_URL`. The GitHub Actions workflow `.github/workflows/pages.yml` fills it from the **repository variable** `ARMORY_PROXY_URL` (a variable, not a secret: it's a public URL).
- `web/public/CNAME` contains `becomecube.com`.

## Steps
### 1. Cloudflare Worker
1. Jon creates a free Cloudflare account (no domain transfer needed) and an API token from the **"Edit Cloudflare Workers"** template. Never paste the token into chat or commit it. Use it only via the `CLOUDFLARE_API_TOKEN` environment variable (or `npx wrangler login` in a browser instead).
2. Do the owner-analytics setup (section 1b below) first, then run `cd proxy && npx wrangler deploy`. (`wrangler.toml` ships a placeholder `database_id`; deploy fails until step 1b.2 replaces it.) Note the URL, e.g. `https://aion2-armory-proxy.<account>.workers.dev`.
3. Check it: `curl "<worker-url>/search?keyword=Darththot&region=nae" -H "Origin: https://becomecube.com"` should return JSON listing **DarthThot, Triniel (serverId 2103)**, with an `Access-Control-Allow-Origin: https://becomecube.com` header.
4. Optional later: add a custom route such as `api.becomecube.com`. Skip it for launch; the workers.dev URL is fine.

### 1b. Owner analytics (D1 + admin dashboard)
Jon wants visit counts and the list of searched character names. The Worker logs them to a free Cloudflare D1 database;
the site has a hidden dashboard at `#/admin`. No IPs or user agents are stored (visitor = truncated `SHA-256(ip + day + ADMIN_SALT)`).
1. Create the database: `cd proxy && npx wrangler d1 create aion2-stats`. It prints a `database_id`.
2. Paste that id into `proxy/wrangler.toml` under `[[d1_databases]]` (replace `REPLACE_WITH_DATABASE_ID_FROM_wrangler_d1_create`). The id is not a secret; committing it is fine.
3. Create the tables: `npx wrangler d1 execute aion2-stats --remote --file=schema.sql` (idempotent). **Re-run this and `npx wrangler deploy` whenever `schema.sql` or the Worker changes (the public Board needs the `board` table and the new `/board` routes, and must be deployed before or together with the site build).**
4. Set the two secrets (interactive prompts; never put them on a command line, in chat, or in git):
   - `npx wrangler secret put ADMIN_TOKEN` : the dashboard password. **Jon picks it and keeps it** (ask him for it, or let him type it at the prompt himself). Use 20+ random characters.
   - `npx wrangler secret put ADMIN_SALT` : any long random string; nobody needs to remember it.
5. Deploy (or redeploy): `npx wrangler deploy`. The site build needs no new variable (it reuses `ARMORY_PROXY_URL`).
6. Verify:
   - `curl -i <worker-url>/admin/stats` returns **401** (`{"error":"unauthorized"}`).
   - `curl -i <worker-url>/admin/stats -H "Authorization: Bearer <ADMIN_TOKEN>"` returns **200** JSON with `totals`, `visits_per_day` (30 entries), `top_searches`, `recent_searches`. A 503 `stats_unavailable` means the D1 binding is missing or the id is wrong.
   - Load `https://becomecube.com`, search a name, open a character, then re-run the authorized curl: `totals.all_time.page_views` is above 0 and the search appears in `recent_searches`. (A browser with Do Not Track on is deliberately not counted.)
7. Tell Jon how to open it: go to **`https://becomecube.com/#/admin`** (not linked anywhere on the site), paste the ADMIN_TOKEN, click Open dashboard. The token stays in that browser tab's session storage only; closing the tab forgets it. "Forget token" clears it immediately.
8. Don't: commit the token or salt, add a link to `/admin` in the nav, or log IPs or user agents anywhere. D1's free tier (5 GB, 100k writes/day) is far above what the site generates.

### 2. GitHub Pages
1. Repo **Settings → Secrets and variables → Actions → Variables**: add `ARMORY_PROXY_URL` = the Worker URL from step 1.2.
2. **Settings → Pages**: Source = **GitHub Actions**.
3. Start a fresh run: **Run workflow** on `main` (`gh workflow run pages --ref main`) or **Re-run all jobs**. Not "Re-run failed jobs": that re-ships the old artifact, built before `ARMORY_PROXY_URL` existed. Check the workflow is green and the deploy job shows a `page_url`. **`https://jonboy648.github.io/aion2-companion/` renders blank; that is expected** (the site is built for the domain root, base `/`). Do not change Vite's `base`: it would break becomecube.com. Verify at becomecube.com after step 4 and DNS, or locally with `vite preview`.
4. **Settings → Pages → Custom domain** = `becomecube.com`, then save (GitHub ignores `web/public/CNAME` for Actions deploys, so this step is what sets the domain). Turn on **Enforce HTTPS** once the certificate is issued (can take up to an hour after DNS resolves).
5. Verify the domain for Pages (github.com/settings/pages, then the TXT record it gives you at GoDaddy). This prevents a domain takeover if Pages is ever unpublished while DNS still points at GitHub.

### 3. GoDaddy DNS for becomecube.com
1. GoDaddy → My Products → becomecube.com → **DNS**. First remove anything that would conflict:
   - existing **A** records on `@`
   - **Domain Forwarding**
   - **parked page**
   - a connected GoDaddy **Website Builder / Websites + Marketing** site (disconnect it)
   - any **CNAME** on `www`

   Keep MX/TXT email records if Jon uses email on this domain (ask him).
2. Add these records:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | @ | 185.199.108.153 | 1 hour |
| A | @ | 185.199.109.153 | 1 hour |
| A | @ | 185.199.110.153 | 1 hour |
| A | @ | 185.199.111.153 | 1 hour |
| AAAA (optional) | @ | `2606:50c0:8000::153` | 1 hour |
| AAAA (optional) | @ | `2606:50c0:8001::153` | 1 hour |
| AAAA (optional) | @ | `2606:50c0:8002::153` | 1 hour |
| AAAA (optional) | @ | `2606:50c0:8003::153` | 1 hour |
| CNAME | www | jonboy648.github.io | 1 hour |

3. Check: `nslookup becomecube.com` returns the four 185.199.x.153 addresses, and `nslookup www.becomecube.com` resolves via `jonboy648.github.io`. GitHub's Pages settings shows "DNS check successful".

## Final verification (report results to Jon)
- [ ] `https://becomecube.com` loads the site over HTTPS. `https://www.becomecube.com` redirects to it.
- [ ] Search "Darththot", region NA East: the character imports (level, stigmas, Daevanion nodes shown).
- [ ] Skill icons load (they come from `assets.playnccdn.com`, NCSoft's CDN; nothing is hosted by us).
- [ ] Browser devtools shows no CORS errors calling the Worker.
- [ ] Worker requests are visible in the Cloudflare dashboard, well under the free 100k/day.
- [ ] `/admin/stats` is 401 without the token and JSON with it; `https://becomecube.com/#/admin` opens the dashboard with the token (step 1b).

## Don'ts
- Don't commit the Cloudflare token, `.env` files, or anything under `assets/` (NCSoft art; `.gitignore` already excludes it).
- Don't enable a GoDaddy proxy or forwarding on top of the A records.
- Don't change the Worker's endpoint whitelist to a general open proxy.
- Don't commit `ADMIN_TOKEN` or `ADMIN_SALT`.
