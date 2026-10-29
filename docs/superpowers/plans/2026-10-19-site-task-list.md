# Become Cube task list

Updated: 2026-10-24. Verified live audit release: `30d126b` (PR 42).
Prototype branch: `codex/character-workflow-prototype`; not a production release.
Approved audits #27/#28 are isolated on `codex/source-import-audits`. Jon approved
deployment on Oct 24 with the reproduced existing-main Chanter timing issue
tracked separately. See `../../data/2026-10-21-audit-release.md` and
https://github.com/jonboy648/aion2-companion/pull/42 for actual deployment status;
approval or merging alone is not proof of a live release.
Pages run 40109544544 and public checks confirmed deployment; see
`../../data/2026-10-24-audit-live-verification.md`. Existing Chanter performance
remains tracked in issue #43 rather than silently marked fixed.

## Weekly checkpoint: Oct 17-24

Task tracking uses this Markdown checklist; no session plan/todo tool is exposed.

Completed this week:

- [x] Ship native Quick Use columns/macros, navigation #26 and legacy saved-character
  compatibility in PR 41 (`faf15ce`, Oct 19). Runtime scheduler certification is
  separate from the shipped editor.
- [x] Merge research notes in PR 20 and inspect Questlog's installed artifacts;
  distinguish observed combat measurement from calculated build recommendations.
- [x] Ship #27/#28 source, cache and character-import audit fixes in PR 42
  (`30d126b`, Oct 24); verify Pages success and the public character/map workflows.
  Latest DarthThot check matched 211/211 opened nodes and 26/26 reported effect
  lines. Hidden attribute sources remain estimates.
- [x] Build and review the local A / Build workspace prototype with both planning
  modes. This is a prototype, not the production character page.
- [x] Trace Sorcerer charge, stagger and conditional cooldown connections from
  existing game files; commit the source findings and release verification locally.

At now / next / left:

- [ ] Next: regression-test and correct charge timing, post-window damage and
  conditional reset modeling using the source findings. No code jobs are running
  at this checkpoint; investigation is complete, implementation is pending.
- [ ] Then: add Damage/Stagger objectives throughout rotation and full build
  selection, and connect both same-gear planning modes to real engine output.
- [ ] Then: reuse the native editor for reasoned Quick Use configurations, show
  Jon the verified desktop/mobile workflow, and release after review.
- [ ] Left: #29-#40 system audits and existing Chanter speed issue #43; server
  status remains source-blocked, shared-code access and backlog #1-#11 remain held.

Jon-only evidence (does not block source-based implementation):

- [ ] **DO:** provide a short native macro trial with stacked columns, an
  unavailable entry, delays and press/hold behavior. Needed to certify runtime
  retry/timing behavior, which the configuration tables do not establish.
- [ ] **TELL:** identify one comparable existing Sorcerer fight, including target,
  duration, measured DPS, build and buffs. Needed for combat calibration; visible
  gauge behavior is also needed to validate actual break time.

No new credentials, release approval or design choice is needed to begin the next
source-based corrections. The Oct 24 audit release approval has been fulfilled.

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
- [x] Trace Sorcerer damage, charge/stagger and conditional cooldown connections
  from the existing game files; record what the simulator actually implements:
  `../../../research/2026-10-24-sorcerer-combo-objectives.md`.
- [x] Implement source-verified charge timing/horizon, per-release gauge and
  Damage/Stagger objectives across rotation and complete build selection locally.
  Reuse the current page and reversible native suggestion/editor handoff. Review
  evidence: `../../data/2026-10-24-combo-objectives-verification.md`.
- [ ] Show Jon the local goal/native-setup review before pushing this increment.
- [ ] Model the missing immunity-trigger route and per-projectile timing after
  its exact event contract is established; keep present limitations visible.
  Do not claim optimal native queue behavior from configuration data.

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
