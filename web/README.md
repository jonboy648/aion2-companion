# Become Cube web (becomecube.com)

Vite 8 + React 19 + TypeScript + **Tailwind v4** (`@tailwindcss/vite`, tokens in `src/index.css` `@theme`, no tailwind.config) +
shadcn/ui-style components in `src/components/ui/` (`components.json` is set up for the shadcn CLI: `npx shadcn@latest add <name>`).
HashRouter (GitHub Pages friendly), base `/`, `public/CNAME` = `becomecube.com`. Dark theme from `../DESIGN.md`.

## Commands
- `npm run dev` / `npm run build` / `npm test` (vitest)
- `python scripts/build_icon_map.py` regenerates `app/aion2c/data/classes/<key>/icon_names.json` (names only) from `research/`
- `python scripts/bundle_engine.py` writes `public/engine/` (aion2c.zip, classes/, icons/, manifest.json)
- `npm run audit:data` checks source/browser parity, fingerprints and reviewed ID/unit witnesses; run after `npm run engine`. See `../docs/data/2026-10-20-source-audit.md` for evidence limits.
- `python scripts/make_fixtures.py` regenerates `src/fixtures/*.json` from real webapi output (then `npm test` checks `src/lib/types.ts`)

## Real character preview

Use the configured public armory Worker, not the NCSoft upstream or a Vite `/armory` route.
Set `VITE_ARMORY_PROXY_URL` in `web/.env.local` or the launching shell. This is a public
endpoint, not a token. Restart Vite after changing it; rebuild for `npm run preview`.
`VITE_ENGINE=mock` serves the saved DarthThot sample, not a current character lookup.

The Worker must allow the exact browser origin, including hostname and port. The
documented development origin is `http://localhost:4173`; `127.0.0.1` is a different
origin. Start with `npm run dev -- --host localhost --port 4173 --strictPort`, or use
another explicitly permitted origin. Do not broaden CORS to arbitrary origins.
An unreachable proxy can be a network or CORS failure; the browser cannot reliably
distinguish them. See `../proxy/CONTRACT.md` for endpoint and origin rules.

Character import audit and evidence limits: `../docs/data/2026-10-20-character-import-audit.md`.

## Layout
- `src/engine/api.ts` typed async API (real Pyodide client by default; fixtures when `VITE_ENGINE=mock`)
- `src/lib/armory.ts` proxy client (`../proxy/CONTRACT.md`), `src/lib/types.ts` wire types
- `src/pages/*` one file per route; routes in `src/App.tsx`
- Skill and item icons are hotlinked from `assets.playnccdn.com`; the Daevanion board art in `public/daevanion/` is hosted.
