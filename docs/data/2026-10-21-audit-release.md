# Audit-only release preflight

Date: 2026-10-21. Jon approved the reviewed #27/#28 changes. Release branch:
`codex/source-import-audits`, based on freshly fetched `origin/main` `faf15ce`.
The unfinished character workspace remains on `codex/character-workflow-prototype`
at `da5bb15`; none of its React components, preview routing or draft calculations
are in this release. The held server-status PR 18 is also excluded.

## Scope and separation

- `eea8f92`: source/data/cache audit #27, transferred from `7db47a2`, with the
  supporting historical research notes needed by its evidence links.
- `33f3f48`: character import/stat-sheet audit #28, transferred from `da5bb15`.
- Engine modules, class data and game-number inputs are identical to those
  reviewed for #28. Existing Home, navigation, map and proxy code are unchanged.
- Rebuilding the engine produced fingerprint `0a9482e9c2c6`. The only byte
  difference from the reviewed ZIP is `webapi.py` line endings; all 40 members
  have identical content after CRLF/LF normalization. The fingerprint identifies
  actual input bytes, not a game patch. All 19 public/dist engine files match.

## Fresh checks on the isolated release

- `npx vitest run --maxWorkers=2`: 82 files / 767 tests passed, 114.12 seconds,
  when run without the Python workload alongside it. The initial overlapping
  run failed two UI timing waits; both files passed separately before this full
  rerun. No assertions, timeouts or production code were changed for the rerun.
- `npm run build`, configured with the public armory proxy and real Pyodide:
  strict TypeScript, Vite and 9,318 prerender files passed. CSS 142.23 kB,
  main JS 788.71 kB. Existing chunk/dynamic-import warnings remain.
- `npm run engine` and `npm run audit:data`: passed; 43 artifacts, 8 classes,
  5 witnesses, zero audit errors. Original export patch still unknown.
- `node --test scripts/map-package.check.mjs`: 7 passed. No map code changed.
- Expanded Pages Python command: 115 passed / 1 skipped in 215.49 seconds,
  exit 0. This is the exact six-file Python command in the Pages workflow,
  not a substitute claim that the complete Python suite passed.

## Deployment hold

The fresh complete Python run is **not green**. Its serial rerun stopped after
110 passed / 1 skipped at
`tests/test_class_chanter.py::test_optimize_full_build_per_playstyle[boss]`:
39.79 seconds against the existing 30-second assertion. Running that case alone
also failed at 38.01 seconds. The earlier overlapping full run was interrupted;
it is not a completed full-suite result.

The optimizer, Chanter data and failing test are unchanged from `origin/main`.
This establishes that these audit commits do not modify them; it does not prove
the reason for the timing failure. No assertion was relaxed, search budget
reduced, game formula changed, or unrelated process stopped to obtain a pass.
The Oct 20 complete run of 1,060 passing tests remains dated historical evidence,
not a fresh passing result for this preflight.

Keep this release out of main until the performance failure is investigated and
the full release checks pass. A pushed branch/draft PR is not a deployment.
The character-workspace implementation and macro runtime validation remain
separate unfinished work.
