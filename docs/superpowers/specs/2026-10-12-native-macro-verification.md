# Native macro integration verification

Branch: `codex/native-macro-rules`. Review base: `18a3f19`.
Spec: `2026-10-12-native-macro-integration.md`; visual baseline is the approved
`docs/prototypes/native-macro.html`.

## Automated checks

- Test-first component, storage, hook and page slices observed failing before
  implementation: four placement rows/separate hotbar; one linked entry for a
  stacked column; independent delay drafts; local availability; character save
  isolation; malformed/incomplete storage; legacy binding preservation; named
  configurations; setup export; mouse activation aliases; Korea slot gates.
- `npx tsc -b --pretty false`: passed during implementation.
- Final `npx vitest run --maxWorkers=2`: 79 files, 733 tests passed, including
  the follow-up charge/alias/mapping regressions (89.74 seconds).
- Final affected suites, including the added Chanter charge regression and SEO:
  `npx vitest run src/features/keybinds src/features/progression/GuideQuickslots.test.tsx src/pages/Keybinds.test.tsx src/seo/seo.test.tsx --maxWorkers=2`:
  11 files, 96 tests passed.
- `npm run build`: passed; 9,318 prerendered files. Main JS 783.17 kB
  (gzip 239.86), CSS 139.48 kB (gzip 25.87). Existing chunk-size warning remains.
- Initial unrestricted-concurrency suite exposed one obsolete heading assertion
  (updated) and four timeout failures in unrelated Home/Character/Enhance flows.
  Reducing test workers produced the full passing run; no timeout increases or
  production changes were made to those pages.

## Browser checks

Host-managed browser; desktop 1681px and mobile 390x844, DPR 1. Screenshots were
captured and visually inspected in chat. No new browser runtime was installed.

- Demo preview: icons loaded; four authored rows sit above a separate hotbar;
  assigning an upper skill and adding its column created one linked entry.
- Mobile document width stayed 390px; grid scroll controls reached hidden columns.
  Add Macro was centered, fully within the viewport, with twelve icon/name choices.
- Native Escape closed the dialog and restored focus to Add Macro. Keyboard entry
  retained focus while typing 25ms, then blur saved delays `[25,10]` independently.
  Reload restored them.
- The older mock optimizer fixture does not fit fresh Guide progression inputs;
  it was rejected by the existing validators. No validator was weakened.
- Real-worker preview at `http://127.0.0.1:5218`: Global Sorcerer level 45,
  stigma/Daevanion quest flags enabled, Calculate plan completed with no displayed
  validation errors. The shared native editor loaded with twelve client actions.
- Added two entries in the real Class Guide, then used its existing Send DPS plan
  to Keybinds action. The standalone editor restored the same linked columns 8
  and 2 and their entries. Game icons rendered; the real preview also had no
  document overflow at 390px. The temporary mock server was stopped; the real
  preview remains at `http://127.0.0.1:5218/keybinds`.

## Independent Review

### Standards

Two storage/binding issues were independently reproduced and regression-fixed:
partial records are rejected non-destructively, and fresh native setups do not
inherit global legacy bindings/pins. Recheck found no residual Standards issues
within those fixes and no confirmed hard standards breaches.

### Spec

Reproduced and fixed legacy binding inheritance, incomplete records, non-Global
slot gating, and mouse activation aliases. Corrected an overbroad charge-ban
sentence: a legacy simulator policy is not a verified native game prohibition.
Charge roots remain placeable; user-authored macro entries and their export show
unverified handling. Added the follow-up Chanter `charge`-tag regression alongside
Sorcerer's `charge skill` tag. Recheck found no residual bounded Spec issues.

## Release Boundary

Frontend integration only. No engine math, worker bundle, Home, navigation, map,
Character or API contract changes. No new dependencies or private exports/logs.
Native execution order, retries and capacity remain unverified; no scheduler or
macro DPS claim is introduced. Preview and local commit only, not deployed.
