# Damage and stagger objectives implementation plan

> **For agentic workers:** Use superpowers:executing-plans for the main simulator/integration lane; independent bounded data, optimizer and UI lanes may run in parallel. Steps use checkboxes for tracking.

**Goal:** Source-grounded Damage/Stagger recommendations with correct charge timing and clear goal-specific results.
**Architecture:** Additive scenario/result metadata carries the goal through existing planners and worker calls. Reuse existing pages and native setup editor.
**Tech Stack:** Python dataclasses/pytest, React/TypeScript/Vitest, current Pyodide worker; no new dependency.
**Spec:** `docs/superpowers/specs/2026-10-24-combo-objectives-design.md`.

## Global constraints

Fixed equipment and existing legal resource/currency boundaries; no implicit refund
budget. HP DPS stays HP DPS. Stagger is a gauge proxy, not predicted breaks. No
native scheduler/optimal-delay claim. Private export stays external. No push before
Jon sees verified results. Preserve Home, nav, map and prototype branch.

## Review focus

Unknown per-charge amounts must not fall back to a scalar upper bound. A specialty
must be both selected and unlocked to use alternate timing. A charged hit beyond
the horizon must not grant statuses/resets/procs. Stagger choices must reach every
nested selection and worker pool lane. Old results must not appear as newly
calculated results after a goal change; labels must use actual units.

### Task 1: Charge/gauge simulation and derived source shape

Files: `models.py`, `engine/simulator.py`, `data/client_export.py`,
`data/build_gamedata.py`, derived source/class data; public simulator/data tests.
Produces the additive Scenario/ChargeLevel/SkillRule/SimResult contracts in the spec.

- [x] Record baseline tests and write/run the horizon regression RED.
- [x] Implement minimal landing guard; verify GREEN.
- [x] Add per-release gauge and exact specialty timing with source witness tests,
  one red/green slice at a time; check unknown/locked/multihit cases.
- [x] Regenerate derived payloads deterministically and run drift/privacy guards.

### Task 2: Goal-aware full build and API

Files: new `engine/objectives.py`, `engine/search.py`, `engine/build_optimizer.py`,
`engine/budget.py`, `engine/specialties.py`, relevant node selection and `webapi.py`;
new public objective acceptance tests. Consumes Task1 additive results.

- [x] Prove different known Damage/Stagger winners RED; implement scorer/search GREEN.
- [x] Prove stigma/rank/specialty/node and legal-budget behavior through public
  optimizer APIs, then implement complete scorer propagation without global state.
- [x] Add objective metadata/current baseline at webapi; keep legacy damage units
  correct and cover default/invalid goals and input immutability.

### Task 3: Worker and existing page goal selection

Files: `web/src/lib/types.ts`, engine api/client tests, build UI/hook and tests,
`Character.tsx` only where needed. Consumes Task2 additive API fields.

- [x] Add RED serial/parallel objective forwarding and cache separation tests;
  implement compatible trailing parameters GREEN.
- [x] Add RED rendered goal/Calculate/current-unit/stale-result tests; reuse the
  current page, drop stale replies and retain editable native setup handoff.
- [x] Make Stagger panels use gauge units and avoid misleading DPS gain labels;
  verify keyboard and mobile layout.

### Task 4: Combined verification and review

- [x] Regenerate browser engine and required fixtures; run source/drift parity.
- [x] Run full web and relevant engine suites, strict production build and real
  browser workflow with both goals, desktop/390px and zero stale-result substitution.
- [x] Independently review the complete branch; fix reproduced important issues
  with red/green regressions. Record commands/results and remaining model caveats.
- [x] Show Jon the actual preview and results. Leave branch local pending push.
