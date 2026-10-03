# Deploy handoff: becomecube.com (Cloudflare Worker + GitHub Pages + GoDaddy DNS)

For the agent doing infrastructure. Jon has approved this deployment. **Start only when Jon says the build is done.** Until then, `web/` and `proxy/` may not exist yet or may still be changing.

## What you're deploying
| Piece | Where | Host |
|---|---|---|
| Static site (React, Vite build output) | repo `jonboy648/aion2-companion`, folder `web/` | GitHub Pages (free) |
| Armory proxy (Cloudflare Worker) | same repo, folder `proxy/` (`worker.js` + `wrangler.toml`, Worker name `aion2-armory-proxy`) | Cloudflare Workers (free plan) |
| Domain | `becomecube.com` (apex) + `www` | DNS at GoDaddy. Jon OK'd **replacing anything currently on the domain** |

The proxy only forwards 4 whitelisted NCSoft armory endpoints (search, info, equipment, daevanion detail). It adds CORS for the site's origins, caches for 10 minutes, and rate-limits per IP. It holds no secrets.

## Contract between the pieces (the build team implements this)
- Worker env var `ALLOWED_ORIGINS` = `https://becomecube.com,https://www.becomecube.com,http://localhost:5173,http://localhost:4173`
- The site reads the proxy URL at build time from `VITE_ARMORY_PROXY_URL`. The GitHub Actions workflow `.github/workflows/pages.yml` fills it from the **repository variable** `ARMORY_PROXY_URL` (a variable, not a secret: it's a public URL).
- `web/public/CNAME` contains `becomecube.com`.

## Steps
### 1. Cloudflare Worker
1. Jon creates a free Cloudflare account (no domain transfer needed) and an API token from the **"Edit Cloudflare Workers"** template. Never paste the token into chat or commit it. Use it only via the `CLOUDFLARE_API_TOKEN` environment variable (or `npx wrangler login` in a browser instead).
2. Run `cd proxy && npx wrangler deploy`. Note the URL, e.g. `https://aion2-armory-proxy.<account>.workers.dev`.
3. Check it: `curl "<worker-url>/search?keyword=Darththot&region=nae" -H "Origin: https://becomecube.com"` should return JSON listing **DarthThot, Triniel (serverId 2103)**, with an `Access-Control-Allow-Origin: https://becomecube.com` header.
4. Optional later: add a custom route such as `api.becomecube.com`. Skip it for launch; the workers.dev URL is fine.

### 2. GitHub Pages
1. Repo **Settings → Secrets and variables → Actions → Variables**: add `ARMORY_PROXY_URL` = the Worker URL from step 1.2.
2. **Settings → Pages**: Source = **GitHub Actions**.
3. Re-run the `pages` workflow (Actions tab), or push to `main`. Confirm the site loads at `https://jonboy648.github.io/aion2-companion/` before touching DNS.
4. **Settings → Pages → Custom domain** = `becomecube.com`, then save. Turn on **Enforce HTTPS** once the certificate is issued (can take up to an hour after DNS resolves).

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
| AAAA (optional) | @ | 2606:50c0:8000::153 / 8001::153 / 8002::153 / 8003::153 (one record each) | 1 hour |
| CNAME | www | jonboy648.github.io | 1 hour |

3. Check: `nslookup becomecube.com` returns the four 185.199.x.153 addresses, and `nslookup www.becomecube.com` resolves via `jonboy648.github.io`. GitHub's Pages settings shows "DNS check successful".

## Final verification (report results to Jon)
- [ ] `https://becomecube.com` loads the site over HTTPS. `https://www.becomecube.com` redirects to it.
- [ ] Search "Darththot", region NA East: the character imports (level, stigmas, Daevanion nodes shown).
- [ ] Skill icons load (they come from `assets.playnccdn.com`, NCSoft's CDN; nothing is hosted by us).
- [ ] Browser devtools shows no CORS errors calling the Worker.
- [ ] Worker requests are visible in the Cloudflare dashboard, well under the free 100k/day.

## Don'ts
- Don't commit the Cloudflare token, `.env` files, or anything under `assets/` (NCSoft art; `.gitignore` already excludes it).
- Don't enable a GoDaddy proxy or forwarding on top of the A records.
- Don't change the Worker's endpoint whitelist to a general open proxy.
