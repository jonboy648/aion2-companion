# Damage/Stagger release verification

Jon approved the reviewed increment and the three prepared security changes on
Oct 29, 2026. Release branch: `codex/combo-release-20261029`, containing reviewed
`c62d41d` plus credential filename exclusions at `9af97b2`. The separate allocation
preflight `56c10c0`, actual redistribution optimizer and workspace prototype are
not included. No product code changed during this release pass.

## Fresh checks on Oct 29

- Full web suite: 87 files / 793 tests passed in 184.15s, using the CI command
  `npx --no-install vitest run --maxWorkers=2`.
- Focused Python release suite: 290 passed, 1 skipped in 199.51s. It includes all
  six CI Python files plus combo data/objectives/simulation, simulator, budget,
  specialties and bonus-rank tests.
- Source audit: 8 classes, 43 artifacts, 6 witnesses, zero errors.
- Engine regenerated and archive contents compared with the reviewed archive:
  identical contents; only ZIP timestamps/build timestamp changed. Tracked
  generated files were restored after that verification.
- `npm run build`: TypeScript, Vite and 9,318-file prerender passed.
- Map packaging checks: 7 passed. Map build passed; complete site artifact
  483.1 MB, including corresponding map source and existing credits/license.
- No dependency installation, Worker/configuration deployment or schema migration
  was required. Existing bundle-size/dynamic-import warnings remain.

Browser checks used one headless Microsoft Edge instance at a time, closed in
`finally`; user browser sessions were not closed or restarted. Real public armory
and Pyodide, not fixture responses, loaded DarthThot with 211/211 Daevanion nodes.
Damage and Stagger calculated; goal edits marked results out of date until Calculate;
Stagger used gauge units and cleared the stale marker. Desktop 1440x1000 and the
settled 390x844 layout passed. The chosen Stagger plan reached the native editor:
Preview left all 48 cells unchanged, Apply worked and Revert restored all 48.
The browser reported zero console/page errors.

The browser harness initially counted unrelated stat-sheet tabpanels and checked
the responsive chart before ResizeObserver settled; those checks were scoped and
condition-based before the final successful run. No UI assertions were removed.
Local screenshots/logs remain under `.superpowers/release-2026-10-29/`.

## Timing boundary

The first concurrent web run had three timeout failures; the two affected files
passed unchanged in isolation (23 tests), then the complete unchanged suite passed
as above. No timeout or assertion was weakened.

A full Python attempt was interrupted after timing failures. Isolated recheck of
the two affected Sorcerer cases passed; the Chanter boss case took 30.28 seconds
against its existing 30-second assertion. That is the previously accepted issue
#43, independently reproduced against earlier untouched main. The entire Python
suite is not claimed green. Old pytest cleanup warnings for a locked temporary
directory were not addressed with filesystem deletion.

## Identity and security

Windows source-byte engine fingerprint: `f455ef237c8a`. Expected Linux/Git-byte
fingerprint: `c69c35ee3aa8`, independently calculated from the 50 committed bundle
inputs. The Linux value is the expected Pages manifest identity after deployment.

The approved seven credential filename patterns are versioned in `.gitignore`
and also applied to the shared local repository exclusions for old worktrees.
The exporter profile's broad local Allow rules were removed; operator access and
other specific rules were retained and verified without reading its contents.
Trusted Git Guard r12 is installed for this repository; `hooks_verified` and
`kit_verified` are true and the accepted package identity matches. Its pre-commit
and commit-message hooks passed. No secret values were copied into the repository.

Native scheduling, optimal macro delays, Frost Burst immunity routing and exact
per-projectile Firestorm timing remain unverified/model limits. Stagger is modeled
gauge contribution, not a prediction of actual boss breaks. These limits remain
visible in the released interface.
