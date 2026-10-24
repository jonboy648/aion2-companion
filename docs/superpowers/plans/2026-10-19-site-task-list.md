# Become Cube task list

Updated: 2026-10-24. Release preceding the audit changes: `faf15ce` (PR 41).
Prototype branch: `codex/character-workflow-prototype`; not a production release.
Approved audits #27/#28 are isolated on `codex/source-import-audits`. Jon approved
deployment on Oct 24 with the reproduced existing-main Chanter timing issue
tracked separately. See `../../data/2026-10-21-audit-release.md` and
https://github.com/jonboy648/aion2-companion/pull/42 for actual deployment status;
approval or merging alone is not proof of a live release.

## Now: make the character recommendation understandable

- [x] Record both starting points: preserve allocations, or redistribute with
  reset costs while keeping equipment fixed.
- [x] Inspect the current import/compare contract. Imported comparisons pass
  zero additional Daevanion points; redistribution is not implemented.
- [x] Build a local character-page prototype with three layout alternatives,
  both planning modes, the full target setup and ordered next steps.
- [x] Check the preview on desktop, 390px mobile and keyboard; open it for Jon.
  Desktop screenshot inspected; mobile DOM/control checks passed, but mobile
  screenshot capture timed out. See the prototype verification note.
- [x] Capture Jon's layout choice: A, Build workspace (2026-10-19). Keep the
  prototype out of main; production must use real engine output, not draft data.
- [ ] Define the engine contract for both plans before production code: confirmed
  spare resources, refundable paid ranks/nodes, currency separation, unknown
  costs, fixed gear, the same baseline/scenario and complete legal output.
- [ ] Implement the agreed workflow with test-first engine and frontend changes.
  Recalculate cumulative plan gains; never add independent experiments together.

Design decisions: `../specs/2026-10-19-character-plan-decisions.md`.
The local preview is illustrative; it must not manufacture calculated gains.

## Next: source and calculation audit

- [x] #27: Establish a traceable source baseline (implemented, reviewed and
  approved; release preflight recorded above): client build evidence,
  derived data versions/hashes, fallback mechanics and source-to-consumer paths.
  First pass recorded in `research/game_data_audit_baseline_2026-10-19.md`:
  8/8 class payloads and 3/3 packed data tables match; damage drift check has
  zero mismatches. Follow-up implementation and evidence boundaries:
  `../../data/2026-10-20-source-audit.md`. Installed build 25926599 was observed
  separately; the older export's original patch remains explicitly unknown.
  Cache identity now includes class contents, with source/browser/ZIP parity,
  ID/unit witnesses, regional caveats, and privacy/size regression gates.
- [x] #28: Verify armory import through grouped gear, effective ranks and the
  stat sheet, including missing-data and failed-import cases (implemented and
  verified and approved; release status recorded above). See
  `../../data/2026-10-20-character-import-audit.md`: 1,060 Python tests and 767
  web tests passed; build passed; real proxy/Pyodide desktop/mobile checks and
  exact 206/206 current-node coverage observed. Hidden sources remain estimates.
- [ ] #29: Verify legal level-aware plans across all eight classes and resource
  boundaries, including chain owners and earned-point overrides.
- [ ] #30: Verify Daevanion imported nodes, adjacency, effects, refundable costs
  and separate Daevanion/Battle Crystal budgets.
- [ ] #33: Calibrate Current/Best/Ceiling against comparable observed fights;
  do not represent engine output as measured combat.
- [ ] Define an offline Questlog saved-fight importer using versioned synthetic
  fixtures, anonymized aggregates and unknown-schema rejection. Do not build a
  new packet meter or import raw captures wholesale.

Questlog acquisition research is complete:
`../../../research/questlog_data_acquisition_2026-10-19.md`.

## Then: verify the existing tools end to end

- [ ] #31: Items and gear comparisons; #32: enhancement/Exceed probabilities,
  costs and unavailable-price behavior.
- [ ] #34: Crafting recipe coverage, recursive material expansion and shopping
  totals. Having a page does not establish complete recipe coverage.
- [ ] #35: Native Quick Use/macro configuration and actual runtime behavior.
  Editor/navigation are live; scheduler/retry and optimized macro DPS are not
  validated. Jon's controlled in-game recording is the remaining manual input.
- [ ] #36: Real map zones, marker layers and party-link round trips.
- [ ] #37: Timers/checklist reset boundaries and timezone labels.
- [ ] #38: Compare/Board estimates; #39: search ranking and destinations.
- [ ] #40: Combined release gate: full suites/build, desktop/mobile workflows,
  console/network checks, performance and deployment verification.

Issue links: https://github.com/jonboy648/aion2-companion/issues
Navigation issue #26 is complete and live, not an open task.

## Held / later

- [ ] Server status PR 18: reliable approved source required; do not deploy.
- [ ] Shared-code site access: decide and implement separately; not shipped.
- [ ] Backlog #1-11: timer alerts/custom schedule, OBS overlay, Discord alerts,
  item-level gates, drop finder, ranking, shops, monoliths, gathering,
  coupons/events and game INI guidance. Reuse suitable existing projects after
  checking their licenses and current-client compatibility.

## Execution boundaries

- Home, the live map, shared navigation and engine behavior stay unchanged by
  the visual prototype. Use existing components/assets; no new dependencies.
- Preview state is in memory. Do not overwrite visitors' saved characters or
  settings. Draft ranks are examples, not recommendations certified legal.
- Show Jon the preview before promoting the design. A previous release approval
  is not automatic approval to merge this new prototype.
- Continue independent work without waiting for the game recording; withhold
  only the claims that require that evidence.
