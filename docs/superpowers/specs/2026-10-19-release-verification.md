# Native macro and navigation release verification

Jon authorized publication, PR 20 merge, the controlled macro check and both
future character-planning modes on 2026-10-19.

## Fresh checks

- `npx vitest run --maxWorkers=1`: 80 files, 750 tests passed (383.26 s).
- `python -m pytest tests/test_webapi.py -q`: 12 passed (181.07 s).
- `npm run build`: passed; 9,318 prerendered files.
- `node --test scripts/map-package.check.mjs`: 7 passed.
- `node scripts/build-map.mjs`: passed; combined artifact 483.1 MB, including
  attribution and corresponding map source.
- Compatibility-focused tests: 87 passed. The legacy saved-character test was
  observed failing with the exact production-preview error before the fix.
- Both independent Standards and Spec compatibility reviews found no blocking
  issue. Populated bonus-map preservation is guaranteed by nullish fallback;
  the new test specifically covers missing-map compatibility and saved bytes.

The first concurrent full run passed 748/749 and timed out waiting for the
second character import in CharacterPage's remount test. The unchanged four-test
suite passed alone, then the full single-worker run passed. No timeout or
production Character behavior was changed to suppress the failure.

## Browser evidence

Production-style preview: http://localhost:4173/ and /keybinds. Both were opened
for Jon in Edge. Port 5173 belonged to a different application and was left
untouched. This session started the localhost:4173 preview as PID 108136.

An older saved DarthThot character initially caused guideRanks to read a
missing bonus_ranks map and blank the editor. After read-boundary normalization
and rebuilding, the same saved character opened with 48 placement cells,
12 hotbar columns, skill icons and native configuration controls. No saved
record was overwritten to make this work.

Desktop rendered without document overflow. At 390 x 844, document width was
380 px and the 728 px placement grid remained within its own 348 px scroll
region. Opening compact navigation focused Plan; Escape closed it and returned
focus to the toggle. The viewport override was reset after verification.

## Boundaries

Home art, engine source/bundle, fixtures, worker/cache implementation and
Character calculations are unchanged from origin/main. Existing large-chunk
and ineffective-dynamic-import build warnings remain. No claim of a fresh
complete console-history audit or in-game macro scheduler validation is made.

The two same-gear planning modes are scope decisions, not implemented engine
behavior. Questlog findings are in research/questlog_data_acquisition_2026-10-19.md.
Server-status PR 18 remains draft and excluded. PR 20 was merged separately as
f1b4006; this branch integrates that docs-only main update.
