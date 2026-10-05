# Become Cube web (becomecube.com)

Vite 8 + React 19 + TypeScript + **Tailwind v4** (`@tailwindcss/vite`, tokens in `src/index.css` `@theme`, no tailwind.config) +
shadcn/ui-style components in `src/components/ui/` (`components.json` is set up for the shadcn CLI: `npx shadcn@latest add <name>`).
HashRouter (GitHub Pages friendly), base `/`, `public/CNAME` = `becomecube.com`. Dark theme from `../DESIGN.md`.

## Commands
- `npm run dev` / `npm run build` / `npm test` (vitest)
- `python scripts/build_icon_map.py` regenerates `app/aion2c/data/classes/<key>/icon_names.json` (names only) from `research/`
- `python scripts/bundle_engine.py` writes `public/engine/` (aion2c.zip, classes/, icons/, manifest.json)
- `python scripts/make_fixtures.py` regenerates `src/fixtures/*.json` from real webapi output (then `npm test` checks `src/lib/types.ts`)

## Layout
- `src/engine/api.ts` typed async API (real Pyodide client by default; fixtures when `VITE_ENGINE=mock`)
- `src/lib/armory.ts` proxy client (`../proxy/CONTRACT.md`), `src/lib/types.ts` wire types
- `src/pages/*` one file per route; routes in `src/App.tsx`
- Skill and item icons are hotlinked from `assets.playnccdn.com`; the Daevanion board art in `public/daevanion/` is hosted.
