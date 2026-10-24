# Character import through the stat sheet (#28)

Date: 2026-10-20. Base: local `7db47a2` (#27), not a deployment.
Scope: existing public character lookup, import API, character presentation and
stat sheet. No layout rebuild, game-number changes or new dependencies.

## Evidence boundaries

- Existing committed public armory samples: DarthThot (Sorcerer 44), anonymized
  Cleric 45 and Chanter 45 in `app/tests/fixtures/`. These are saved observations,
  not current character state. The Sorcerer sample has 17 gear pieces, 28 acquired
  mapped skill ranks and 84/84 open nodes matched. Do not conflate it with the
  earlier 155-node review observation in issue #28.
- Saved Cleric 45: 19 equipment pieces, 26 acquired mapped ranks, 187/187 nodes.
  Saved Chanter 45: 20 equipment pieces, 25 acquired mapped ranks, 132/132 nodes.
- Real local-browser lookup on Oct 20, through the configured public Worker:
  DarthThot, NA East / Global Triniel 2103, level 45, 206/206 nodes matched.
  All 26 reported attribute-effect lines reproduced. Known public sources matched
  0/16 attribute totals before calibration; hidden-source gap filling remains an
  estimate, explicitly visible, not a newly discovered source formula.
- Source numbers retain #27's provenance: Global private export label Oct 4;
  its original client patch is unknown. Installed Steam build observation
  25926599 does not establish the export's patch. No Korea/Taiwan validation.
- Public armory identities, gear, acquisition flags, ranks, title effects, pet
  levels, wings and opened nodes are observations. Stat-sheet random rolls and
  unidentified contributions remain estimates. Engine DPS is not measured combat.
- No new raw armory snapshots, private exports, game configuration, packet data
  or credentials are committed by this audit.

## Corrections and regression boundaries

1. A character URL must resolve its exact name/server, not another search
   suggestion. A returned profile must agree before it reaches calculation.
2. Late search/fetch results stop before enqueueing obsolete import work. Already
   running worker calculations are not killed; late results are discarded.
   Route remount and duplicate-key protections remain intact.
3. Required equipment, skills and board summaries must be present. Each declared
   open board must have matching detail counts and an explicit effect summary;
   a partial download is an error,
   not zero ownership. The Python import API enforces this too, and rejects an
   unsupported class instead of guessing Sorcerer or reusing a previous class.
4. Refresh bypasses the armory cache and clears prior imported board context on
   failure. Old character results and sheets are absent on a failed new lookup.
5. A sheet belongs to its exact raw download. Old sheets are not shown for the
   next character while the serial engine is busy or disabled.
6. Missing, invalid, negative or non-finite primary totals cannot calibrate away
   known gear contributions. Explicit zero remains a valid observed total.
7. Missing comparison evidence is labelled unavailable, not green `0/0` matches.
   Unrecognized effect text is exposed as excluded, not silently dropped.
   Omitted individual primary totals carry the additive `armory_unavailable`
   flag; unsupported zeroes display as Unavailable. Effects are reconciled even
   when their primary total is invalid; an unknown line remains in the reported
   denominator, never in the reproduced count. Unsupported wings are identified
   as excluded, not silently assigned zero contributions.
8. Preview errors explain the build-time public endpoint, restart/rebuild and
   exact-origin CORS requirements. No proxy deployment or CORS widening occurs.

Tests use the existing public boundaries agreed in #28: armory HTTP assembly,
`useCharacter`/routed CharacterPage, `webapi.import_character`/`stat_sheet`, and
the rendered stat-sheet sources. Network and worker responses are controlled only
for failure/race tests; saved-source reconciliation uses the actual Python API.

## Verification

Completed checks on the final source:

- `python -B -m pytest -q` (isolated temp directory): 1,060 passed, 8 skipped,
  1 xfailed and 1 non-strict xpassed, exit 0, 1,038.18 seconds. Earlier full runs
  were deliberately interrupted to finish review corrections; this run completed
  on the final source without further code edits.
- Exact expanded Pages Python gate: 115 passed, 1 skipped, exit 0.

- `npx vitest run --maxWorkers=2`: 82 files / 767 tests passed. The first suite
  exposed an old Compare test depending on wrong-server fallback. It now uses
  the known NA sample explicitly on both sides; the CharacterPage switching test
  supplies two genuine synthetic identities instead of silently importing the
  same character for a missing Luna. No assertions/timeouts were relaxed.
- `npm run build`: strict TypeScript, Vite and 9,318 prerendered files passed,
  with the configured public proxy and real engine. Existing large-chunk and
  ineffective dynamic-import warnings remain; no new dependencies were added.
- `npm run engine`: rebuilt ZIP and manifest after the final source edit.
  `npm run audit:data`: 43 artifacts, 8 classes, zero errors;
  engine fingerprint `7831c17256fc`. All 19 public/dist engine files are identical.
- `npm run fixtures`: regenerated from the real Python API, no fixture-content
  changes. Valid saved-character values have not changed.
- Pages' existing Qt-free Python test gate now includes the stat-sheet and
  saved-character import audit files, alongside its existing web API/data tests.
- Independent Standards review: no documented breaches or actionable smell
  findings. Spec review found missing board-effect summaries, omitted totals,
  hidden unknown attribute effects and unsupported wings. Each was reproduced
  red, fixed and rechecked, including invalid-total + unknown-effect interaction.
  No remaining source-level findings. The final bundle parity check resolved
  the reviewer's last packaging warning.

No push, merge or deployment. The branch and local production preview are retained
for Jon's review. Existing unrelated scratch files were not staged or removed.

Targeted red/green reproductions: wrong-server fallback; cancelled fetch starting
obsolete import; mismatched profile; truncated/missing board/equipment payload;
stale sheet; unavailable attribute treated as zero/crashing; unknown-class fallback;
green no-evidence badges; hidden unparsed effects.

Already observed: all three saved-character imports reconcile equipment
enchant/Exceed, effective ranks and board counts; title equip and collection effects
remain distinct and single-counted. Pet identity does not invent a pet stat bonus.
Existing no-double-count stat-sheet tests remain the arithmetic baseline.

Real-browser desktop (1440x1000) and mobile (390x844): character and sheet loaded,
50/50 character images loaded, source disclosure worked, filtering/keyboard focus
worked, no horizontal overflow. Screenshots are local test artifacts at
`D:/Aion2/audit28-desktop.png` and `D:/Aion2/audit28-mobile.png`, not shipped art.
The final production preview loaded the real proxy/Pyodide, the same 206-node
coverage and 26/26 effect lines, with zero console errors and no overflow.
An intentionally aborted refresh showed the network/CORS guidance, zero old
character cards/sheets and null stored board context. A real search for server
9999 rejected the wrong-server URL instead of substituting Triniel.

## Remaining work, not concealed by this slice

- #29: exhaustive all-class legal plans and resource boundaries.
- #30: full Daevanion graph/effect/currency/refund audit, beyond imported coverage.
- #33: game damage formula, rating conversions and matched fight calibration.
- #35: actual native macro scheduler/retry behavior needs controlled game evidence.
- Unexposed sources and random rolls are not made exact by matching armory totals.
- Final combined release/performance gate and publishing require Jon's review.
