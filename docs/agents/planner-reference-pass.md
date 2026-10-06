# Planner Reference Pass

## Approved Scope

Latest direction supersedes the earlier approximate dashboard pass: match the
reference's actual guide view, including its neutral dark panel treatment.
Daevanion sits beside Skills, Quick Slots sits beside Macro, and How to Play
spans the row underneath. Reuse the existing manual builder and Codex routes. No Home,
imported Character, navigation or engine-rule redesign. Preview before push.

## Literal Reference Layout Checkpoint

- Replaced the skills/quickslots dashboard arrangement with the panel order
  above. Reference panel backgrounds are #0f172a, headers #020617, and borders
  #334155, with 6px corners and 12px column gaps.
- Quick Slots uses three four-key groups, four stacked skill rows, ranks on
  the icons, keys underneath, and row numbers only at the right edge. Actual
  manual and macro bindings determine the amber/cyan key colours.
- Macro shows the actual sequence, full skill names, stack fallbacks, keys and
  delays. Repeated engine entries are not silently combined. Delay edits commit
  on blur or Enter so multi-digit typing does not unmount the editor.
- Read-only Daevanion boards use our shipped game art and coordinate data,
  and distinguish purchased nodes from future guidance. Hover details remain
  readable and Escape dismisses them without requiring node focus.
- Effective ranks include paid ranks, Daevanion bonuses, provided bonus ranks
  and chain rank ownership. Skill rows show selected specialty descriptions.
- Main consumer defaults remain intact. Home, imported Character and shared
  navigation were not changed. Full build analysis remains below the guide.
- Intentional data differences: this is our optimizer's build, not the other
  site's authored preset. Physical in-game slot restrictions are not yet
  enforced by our keybind planner; the view labels its mapping as custom.

### Fresh Verification

- Engine correction 84a8aec merged locally at f11ad70; shared zip and manifest
  regenerated together. This supersedes the old 17/33 acceptance below.
- `node scripts/run_planner_acceptance.mjs --workers 3`: freshly rerun by the
  parent agent, 33/33 cases passed, 107 main/variant builds validated, exit 0.
- `npx vitest run --maxWorkers=2`: 64 files, 560 tests passed, exit 0.
- `npm run build`: strict TypeScript/build passed; 23 pages prerendered.
  Existing bundle-size and mixed-import warnings remain.
- Actual browser: Templar level 30, Leveling, both quest gates enabled, attack
  550 / MP 1000. Calculated ranks, macro, slot inspection and delay editing
  checked. All quickslot icons loaded; no captured console errors/warnings.
- Responsive check at 390px: document client and scroll width both 378px;
  panels 320.69px wide and stacked, with no global overflow workaround.
- Screenshot proof: `C:/Users/jonca/AppData/Local/Temp/aion2-exact-guide-slots.png`.
  Working preview: http://127.0.0.1:5197/codex/templar.
- Local checkpoint only. No push, PR publication, merge to main or deployment.

## Earlier Pass (Superseded)

### Task List And Ownership

1. Lead: ManualBuild.tsx, Codex.tsx, planner.css, ProgressionControls.tsx.
   Compact controls/settings, skills and quickslots side by side, full analysis
   below. Preserve explicit calculation, stale-result guards and existing routes.
2. Skills worker: GuideSkills.tsx and its focused tests/styles only. Reference
   50px rows, 8px spacing, single list per column; optional calculated rank view.
3. Quickslots worker: GuideQuickslots.tsx, guide-local styles, optional compact
   Hotbar/MacroPanel props and focused tests. Roughly 41px cells/4px gaps; do not
   invent physical slot mappings or change the Keybinds page defaults.
4. Contract worker: planner acceptance scripts/tests only. Separate planned path
   guidance from purchased nodes, preserve all other validation evidence.
5. Independent reviewer: read-only audit after integration, focused on input
   changes, conditional views, mobile containment and default consumer behavior.

Tasks 2-4 run concurrently with task 1. Task 5 follows integration. Lead performs
desktop/mobile browser checks and final full tests/build after all lane edits.
Subagents report only through local subagent messages: no Agent Bridge calls.

## Measurements

Reference: https://aion2.gaming.tools/builds/templar/leveling
Observed skill row: 50px height, 8px/12px padding, 6px radius, 8px list gap.
Observed quickslot cells: approximately 41px square, 4px gaps, 4px radius.
Observed section title: 16px/24px; page title: 30px/37.5px. These are layout
measurements, not permission to copy private code or assets from the reference.

## Acceptance

Existing tests and strict build, no page overflow at 390px, actual loaded icons,
real engine results at 22/30/45, one selected macro, no auto-search on edits.
Known engine child-rank/slot-limit mismatches remain tracked rather than hidden.
No push, PR publication, merge to main or deploy without Jon's preview approval.

## Integrated Verification

- Four local worker lanes completed: skill rows, compact quickslots/macros,
  cross-runtime contract checks, and independent review. No confirmed new
  integration findings remained after review; all workers were closed.
- `npx vitest run --maxWorkers=2`: 61 files, 513 tests passed.
- `npm run build`: strict TypeScript and production build passed; 23 pages
  prerendered. Existing large-chunk and mixed fixture-import warnings remain.
- Real-engine browser preview: Sorcerer level 30, Leveling, both quest gates
  enabled. Calculated ranks, key stacks, selected macro, and full analysis render.
  Desktop columns measure 544px each; key cells approximately 41px.
- At an effective 390px viewport: document width/scroll width both 378px,
  quickslot strip scrolls within its 347px container, macro rows do not overflow,
  and all visible planner images loaded. No global overflow-hiding workaround.
- `node scripts/run_planner_acceptance.mjs --check-only`: 17/33 recorded cases
  pass, 104 builds checked. This revalidates recorded CPython outputs; it does
  not rerun optimization. Remaining failures are 14 child-rank cases and two
  stigma-slot cases owned by Claude's legal-progression engine lane. All locked
  Sorcerer cases pass after separating future guidance from purchased nodes.
- This is a visual-review checkpoint, not release acceptance. Engine fixes and
  fresh all-class cross-runtime acceptance are required before deployment.
