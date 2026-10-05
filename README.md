# Aion 2 Companion (becomecube.com)

A free, fan-made web companion for **Aion 2**. Import your character by name, compare playstyles
(optimized stigma and skill-point builds), plan Daevanion boards, build keybinds and in-game macros,
and plan crafting and your road map. The optimizer is the Python `aion2c` engine running in your
browser (Pyodide); nothing is computed on a server.

Not affiliated with, endorsed by, or sponsored by NCSOFT. Aion is a trademark of NCSOFT. Skill and
item icons are loaded straight from NCSOFT's public CDN (`assets.playnccdn.com`) in your browser; the
Daevanion board art under `web/public/daevanion/` is game art hosted with the owner's stated permission. It never touches the game client and never sends input to the game.

## Privacy

- There are no accounts and no cookies. Your builds and settings stay in your browser (`localStorage`).
- A character lookup goes **through a small proxy** (a Cloudflare Worker, `proxy/`) to NCSOFT's public armory API.
  The proxy only forwards four whitelisted endpoints (search, info, equipment, Daevanion), caches results for
  10 minutes, and rate-limits per IP. What you type in the search box (character name, region) is therefore seen by
  the proxy and by NCSOFT's armory, as it would be on NCSOFT's own site. Cloudflare may log request metadata (such as
  IP address) per its standard Worker logging.
- **The site keeps a small database (Cloudflare D1) for the owner:** anonymous visit counts (no IP address or browser
  details are stored; a "visitor" is a hash that changes every day) and the character names that were searched
  (public game data). Characters you look up also appear on the public **Board** with their public armory info only:
  name, class, server, level and Combat Power. The "max-potential DPS" shown there is an unverified estimate sent by
  the visitor's browser. The two Worker secrets (`ADMIN_TOKEN`, `ADMIN_SALT`) exist only for the owner dashboard.
  The browser's Do Not Track setting turns the counting off. See `proxy/CONTRACT.md` for exactly what is stored.
- The calculation engine (Pyodide, about 6 MB) is downloaded from the jsDelivr CDN when an analysis starts, and skill
  and item icons are loaded from NCSOFT's CDN (`assets.playnccdn.com`).

## Layout

| Path | What |
|---|---|
| `web/` | Vite + React + TypeScript + Tailwind site (HashRouter, base `/`) |
| `app/aion2c/` | Python engine; the Qt-free modules are bundled for the browser by `web/scripts/bundle_engine.py` |
| `proxy/` | Cloudflare Worker `aion2-armory-proxy` (routes `/search /info /equipment /daevanion`) |
| `DESIGN.md` | Design tokens (dark navy + gold) |
| `DEPLOY_HANDOFF.md` | Infra contract: Worker, GitHub Pages, GoDaddy DNS |

## Local development

Requirements: Node 24 (npm 11), Python 3.12.

```powershell
# engine tests (Qt-free webapi)
cd app
python -m pip install pytest
python -m pytest tests/test_webapi.py -q

# bundle the engine for the browser, then run the site
cd ..\web
python scripts\bundle_engine.py
npm ci
npm run dev            # http://localhost:5173
npx vitest run         # web tests
npm run build          # type-check + production build into web/dist
```

Environment (build time, all public):

- `VITE_ARMORY_PROXY_URL` - Worker URL (empty = fixture data for local work).
- `VITE_ENGINE` - `mock` (fixtures, the dev default) or `real` (Pyodide engine). CI builds with `real`.

## Deploy

Pushing to `main` (or running the `pages` workflow by hand) runs `.github/workflows/pages.yml`: Python and
vitest tests, engine bundle, `npm run build`, then deploy `web/dist` to GitHub Pages.
One-time setup (repository variable `ARMORY_PROXY_URL`, Pages source = GitHub Actions, custom domain,
DNS) is in `DEPLOY_HANDOFF.md`.
