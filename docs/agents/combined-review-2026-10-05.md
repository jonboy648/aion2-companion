# Combined Review Build

Branch: `codex/level-planner-acceptance`, worktree `D:\Aion2-level-planner`.
Preview: http://127.0.0.1:5197/codex/templar (real browser engine).
The original checkpoint was review-only. Jon subsequently approved deployment of the latest combined site with the approved map.

## Included

- Reference-layout manual builder and class guide: `a778723`.
- Stat sheet: `cb5fa54`; real stats: `7d0f5e8`; legal progression: `84a8aec`.
- Checklist: `30fa027`; global search: `e880b18`.
- Enhancement calculator: `2ded2ab`; item database and gear viewer: `015a5d6`.
- Union of all routes, navigation/footer links, SEO metadata and route tests.
- Regenerated engine item table, manifest and fixtures, not hand-merged outputs.
- Search indexes all 9,245 item IDs, including materials and consumables, once each.
- Search closes on query-only skill navigation as well as page navigation.
- Header search is a compact, labelled magnifier in the navigation flow, without a separate right-offset row; Home's character search is unchanged.
- Approved interactive map: `695142e`, with local tiles/markers, themed sidebar/header, party-share links, Maps in the main navigation, retained credits and corresponding source. Map crafting remains separate from companion crafting.

Server status remains excluded: its draft has no verified data source.
This integration does not replace Home or redo the approved guide layout.
No optimizer, model or webapi source changes relative to `84a8aec`.

## Verification

- Web: final `npx vitest run --maxWorkers=2`: 676 tests in 71 files passed.
- Production: `npm run build`: strict TypeScript, Vite and 9,318 prerendered files passed.
- Planner: 33 real CPython cases, 107 main/variant builds validated across eight classes at levels 22/30/45, including locked and earned-point cases.
- Fresh browser checks: checklist add/tick/reload persistence and test-task cleanup; enhancement target-level recalculation; material search to item detail; same-class skill search closes and opens its encyclopedia details; gear comparison pin.
- Mobile: guide, items, gear viewer, enhancement and checklist have matching document client/scroll widths (378 CSS px at the browser's 390 px mobile viewport); tables scroll within their containers. All six level-30 Templar quickslot icons loaded.
- Fresh real-browser Templar level-30 calculation completed; slot details open and close; no captured warning/error logs.
- Header follow-up: desktop search and links share the same centerline and all links fit one row; at 390 px the search target is 44 px with no document overflow. Clicking search, Ctrl+K, Escape and focus return passed in the browser, with no captured warnings/errors. The navigation-containment regression failed before the fix and passed afterward.
- Python full run: 982 passed, 10 failed, 8 skipped, 1 xfailed and 1 xpassed. Nine failures were missing local, git-ignored class icons or desktop theme assets; one was the repository guard rejecting a hardcoded private-export path in two planner files.
- Corrected local asset setup with junctions to existing `D:\Aion2` assets; removed the hardcoded export path in favor of required `AION2_EXPORT_DIR` configuration. No art or raw export was added to git, and the privacy guard was not weakened.
- Complete failed-case rerun: `python -m pytest -q --lf`: all 10 passed. Additional fresh checks: all 17 icon tests passed; all 16 client-number/privacy and desktop-theme tests passed. The entire Python suite was not rerun after these corrections.
- Progression-generator regression: the missing-configuration test failed before the fix; all 16 generator tests passed afterward and are included in the final web suite.

The first web run overlapped CPU-heavy acceptance work and timed out during a character switch; the unchanged character tests passed in isolation and the complete rerun passed. Keep character remount and duplicate-key guards intact.

## Build Size

Main JS: 777.24 kB (gzip 237.77); CSS: 135.65 kB (gzip 25.02).
Against the approved guide checkpoint: main JS +96.63 kB, CSS +5.03 kB.
The 880.3 KiB search index loads only when search opens. Enhancement chart chunks are lazy.
Existing large-chunk and mixed fixture import warnings remain.
Engine fingerprint: `8bc4b1c25c61`.

## Still Separate

- Header dropdown consolidation and item-table presentation from Claude's layout QA backlog are not included in this integration.
- Distinct item IDs can currently share indistinguishable names/visible stats; the table does not yet explain those variants.
- Desktop tables may require horizontal scrolling to see all selected columns.
- Custom quickslot layout is not yet validation of physical in-game slot restrictions; the guide labels this limitation.
- Draft server status and the docs-only research PR remain separate.

## Deployment Integration Checks

- Fresh combined web suite: 676 tests in 71 files passed.
- Fresh real-engine production build: strict TypeScript, Vite and 9,318 prerendered files passed. Main JS 777.52 kB (gzip 237.82); CSS 135.65 kB (gzip 25.02).
- Fresh engine API suite: 12 tests passed.
- Map packaging/party-share/attribution tests: all five passed.
- Map TypeScript and production build passed; complete site artifact 483.1 MB including corresponding map source, within the 900 MB project safety budget.
- Production browser preview loaded map tiles, marker layers and the themed header; a custom rally pin could be placed and saved, and the copy-party-link control reported success.
- Merge retained both Items and Maps, the inline search, and all existing companion routes. No engine source changes or proxy deployment are needed.
