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

## Initial deployment hold (Oct 21)

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

The initial decision was to keep this release out of main until the performance
failure was investigated and the release checks passed. A pushed branch/draft PR
was not a deployment.
The character-workspace implementation and macro runtime validation remain
separate unfinished work.

## Release decision (Oct 24)

An untouched snapshot of `origin/main` `faf15ce` subsequently reproduced the same
Chanter boss test failure: 49.85 seconds against the existing 30-second limit.
This establishes that the timing failure also exists before these audit changes;
it does not establish its underlying performance cause or make that test green.

On Oct 24 Jon explicitly chose to deploy the approved audit-only fixes while
tracking the existing Chanter slowdown separately. This is an accepted release
exception for that known performance assertion, not an assertion that the full
Python suite passes. No threshold, search budget, game formula, or test assertion
is relaxed. The web CI command uses the same two-worker scheduling as local
verification; it still runs the complete web suite.

Release checks are rerun before merging; GitHub Pages must pass its expanded
Python, data audit, web, map and production-build gates. Publication is confirmed
only by a successful Pages deployment and live checks, not by merging alone.
See [PR 42](https://github.com/jonboy648/aion2-companion/pull/42) for the actual
merge/deployment state. The unfinished layout and proposed Damage/Stagger combo
objectives remain outside this release.

## Oct 24 pre-merge checks

- Expanded Pages Python command: 115 passed / 1 skipped, 110.46 seconds.
- Complete web suite with two workers: 82 files / 767 tests passed,
  79.37 seconds. The first run hit the character-switching wait limit;
  polling now uses `queryAllByText(...).toHaveLength(1)` instead of repeatedly
  formatting the large DOM through a throwing `getAllByText` query. The exact
  one-result check, five-second wait, identity assertions and duplicate-key guard
  remain. No production component or timeout changed for this correction.
- Production build with the real engine/public proxy: strict TypeScript, Vite
  and 9,318 prerender files passed; CSS 142.23 kB, main JS 788.71 kB. Existing
  large-chunk/dynamic-import warnings remain.
- Source audit: 8 classes, 43 artifacts, 5 witnesses, zero errors. Map packaging
  regression checks: 7 passed.
- Full map TypeScript/build/package step passed; the combined site artifact is
  483.1 MB, including the map's corresponding source, below the 900 MB safety cap.
- The expected Linux engine fingerprint from the committed Git blobs is
  `2f572d03c879`; Windows working-copy line endings yield `0a9482e9c2c6`.
  These are byte-content cache identities, not different game patches.
- The accepted existing Chanter speed issue is tracked independently as
  [issue 43](https://github.com/jonboy648/aion2-companion/issues/43).
