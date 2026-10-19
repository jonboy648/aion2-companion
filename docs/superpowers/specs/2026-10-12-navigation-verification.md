# Navigation issue 26: verification

Issue: https://github.com/jonboy648/aion2-companion/issues/26
Branch: codex/native-macro-rules.
Review baseline: be608fffa91600d995f146f102951af882ac976e.
Status: implemented locally and ready for user review; not pushed or deployed.

## Delivered

- Home and Start here remain immediately visible. Other companion tools are
  grouped under Plan, Database and World; site search stays inline in the main
  navigation flow using the existing command-palette button.
- The header and footer share labels and destination definitions. Class guides
  and Build planner, Skill encyclopedia, character comparison and equipment
  comparison, and progression versus onboarding have distinct identities.
- The real Map destination is /map/ in both menus and in Start here's shortcut.
  Board stays footer-only. /maps remains available as explicitly labeled map
  resources and legacy pins; existing routes and share payloads are unchanged.
- Codex tabs follow the URL. The explicit encyclopedia destination does not
  require a skill selection. Class switching and closing an old skill deep link
  stay in the encyclopedia; other query parameters are retained.
- Disclosures support arrow navigation, Home/End, Escape with focus return,
  outside pointer dismissal, keyboard focus exit, and route-history dismissal.
  Compact navigation focuses its first group when opened.
- Forward navigation to another page starts at the top. POP navigation is not
  forcibly scrolled, and changing query-only tabs does not reset page position.
- Page headings and route metadata distinguish Build planner, Class guides,
  Compare equipment, Progression road map and Map resources.

## Verification

Public boundaries used: rendered site navigation/footer, route transitions,
Codex tabs and skill drawer, and the browser's scroll interface. Tests were
written red before implementation for each changed behavior. Existing shared
page, character-remount, legacy map and SSR tests remain in the full suite.

- `npx vitest run --maxWorkers=2`: 80 files, 749 tests passed; 121.46 seconds.
- `npx tsc -b --pretty false`: passed during implementation and review.
- `npm run build`: passed, with 9,318 prerendered pages.
- Main JS: 786.47 kB, gzip 240.89 kB. CSS: 142.23 kB, gzip 26.36 kB.
  Compared with the recorded pre-ticket build: JS +3.30 kB / gzip +1.03 kB;
  CSS +2.75 kB / gzip +0.49 kB. No dependencies added.
- `node scripts/build-map.mjs`: passed using the unchanged map app; combined
  artifact 483.1 MB, including its required corresponding source and credits.
- Independent Standards review: no remaining findings after recheck.
- Independent Spec review: no remaining findings after recheck. Inline search
  means existing search placement in Main, not a new in-header search mode.

Review found and reproduced two regressions before commit: closing legacy skill
details left the encyclopedia, and a compact panel stayed open after keyboard
focus left navigation. Both now have public-boundary regression tests. The full
suite also caught a test-only window access in node/SSR setup; its viewport mock
is now guarded and the existing SSR tests pass.

## Browser checks

Host-managed browser with trusted CDP input, not a separately installed runtime:

- Desktop 1681px: one-row companion navigation, inline search placement,
  dropdown geometry, End/Escape behavior and returned trigger focus.
- Mobile 390 x 844: no page overflow, primary links and 44px search/menu targets,
  bounded disclosure panel, first-group focus, Enter activation and Escape.
- Menu selection opened the encyclopedia. Switching to Assassin retained the
  encyclopedia; forward page navigation reset scroll to zero.
- Production preview Start here -> real Map: /map/?map=World_L_A, Leaflet map
  present, four loaded tiles, zone controls and markers present, no overflow.
- HTTP checks of /map/, /map/about/ and /map/crafting/: 200 with the standalone
  map bundle, not the companion development shell.

Screenshots were visually inspected in the conversation. Console-history
capture was not performed; these results are not a claim of zero historical
console errors or a complete map/data audit.

## Preview and limits

Production-style review preview: http://localhost:5173/.
Vite preview PID 115472 was started by this session at 2026-10-12 19:44:52 local.
It serves the combined build and uses an already permitted armory-proxy origin.
The older development preview remains at localhost:4173. No other sessions'
servers were stopped or restarted.

Home art and layout, theme tokens, engine code/bundle, fixtures and map-app
source have no diff from the review baseline. No new game-data or scheduler
claims are made here. Calculation/source validation belongs to the subsequent
audit tickets, beginning with issue 27. No push, merge or deployment is included.
