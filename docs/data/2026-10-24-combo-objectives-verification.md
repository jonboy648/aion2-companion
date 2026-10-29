# Damage/Stagger implementation: local review

Oct 24, 2026 (America/Chicago). Branch `codex/combo-objectives`, based on the live
audit release `30d126b` plus local source-research notes. **Not pushed or deployed.**

Preview: http://localhost:4173/c/nae/2103/DarthThot . Use `localhost`, the existing
allowed preview origin; `127.0.0.1` was rejected by the public proxy's CORS policy.
No Worker configuration or origin restriction was changed for this preview.

## What this increment does

- Select Damage or Stagger on the current Character page, then Calculate. Initial
  lookup retains the existing automatic Damage calculation. Later edits keep the
  old result visibly out of date; late replies cannot replace the requested goal.
- Carry the goal through rotation, stigma, rank, specialty and Daevanion choices
  with the existing gear/rank/spare-resource contract and separate currencies.
  This does not implement paid-rank/node refunds or the separate workspace layout.
- Keep HP damage/DPS separate from gauge. Stagger uses gauge/s and a per-skill
  gauge contribution chart, not predicted breaks. Unknown candidate/chain amounts
  stay disclosed even when the winning rotation avoids those skills.
- Preserve Hellfire's source release gauges20/25/30/35 and exact speed-option
  thresholds .21/.35/.7/1.05 seconds. The unlocked option selects the source
  thresholds once; its cast-speed effect does not shorten them a second time.
  Charges landing at/after the modeled end grant no HP, gauge, status or proc.
- Hand the selected plan to the existing native editor. Preview suggests acquired
  root-skill placements and membership, keeps charges manual, and lists unplaced
  skills. Apply retains old recipes/bindings/delays and a complete Revert backup.
  It does not import the player's hotbar or simulate native macro DPS/timing.

## Evidence

- Source integration:92tests passed after regeneration. Final focused Python
  run:67passed, covering objective/chain coverage, simulator, drift and browser
  archive imports. Two raw-export/privacy guards passed separately.
- Broad engine/optimizer/API run:205passed,2skipped in235.07s, followed by the
  last chain-warning fix and its final focused regression run above. This is not
  a claim that the entire Python suite is green; existing Chanter issue43 remains.
- Full web run:87files/793tests passed in93.78s during diagnosis. Final clean
  rerun after removing temporary diagnostics also passed87files/793tests in91.52s
  (`npx vitest run --maxWorkers=2`, exit0).
- Final strict production build passed:9,318prerendered files. MainJS800.87kB
  (gzip245.64), CSS142.26kB (gzip26.36). Against the audit release's recorded
  JS788.71/CSS142.23, about+12.16kB/+0.03kB uncompressed. No dependencies added.
- Enginezip137KiB/38allowlistedmodules. Source audit:8classes,43artifacts,
  6reviewed witnesses,zeroerrors; local engine fingerprint `f455ef237c8a`.
  The historical export's original patch remains unknown, not a new client patch.
- Fresh-context review found the double-speed application and incomplete coverage
  warnings, then a reachable-chain edge. All were reproduced RED and fixed GREEN;
  final bounded review was clean. No reviewer changed product files.

## Real browser workflows

- Public proxy plus real Pyodide on the local production preview loaded DarthThot,
  Global/NA East Triniel2103,level45, matching211/211openednodes. One plan rendered.
- Both goals calculated with their own current baseline and units. On the final
  Stagger view, about5current/8planned gauge/s was displayed, with an unknown
  model-confidence label. These are modeled contributions, not measured combat.
- The final gauge chart included Hellfire420, Blaze252, DivineBurst200,
  Firestorm165, BittercoldWind130, ColdStorm80 and Other262 gauge over180seconds.
  HP DPS remained separately labeled as damage of that Stagger plan.
- Goal edits showed stale results until Calculate; cached repeat requests returned
  the matching goal. Full desktop1440x1000 and mobile390x844 had no document overflow.
- Stagger plan -> Keybinds retained source/playstyle/goal. Preview left all48cells
  unchanged. Apply created `Suggested boss stagger`; Revert restored all48cells.
  The390px native dialog was352px wide. Reload-safe backup behavior also has tests;
  this browser run did not claim to operate the game or certify macro execution.
- Final browser console reported zero errors. Five offscreen official icons were
  still deferred by native lazy loading in the mobile viewport, not failed requests.
- Screenshots are local artifacts under `D:/Aion2/.playwright-mcp/`:
  `combo-stagger-mobile-final.png`, `combo-stagger-desktop-final.png`.

## Boundaries and observed test instability

FrostBurst's immunity-trigger route remains unmodeled; Firestorm cooldown reduction
uses a five-fireball aggregate. Three other authored charge ladders have fewer
tiers than the source releases, so timing is deliberately not guessed onto them.
No boss threshold/recovery, complete PvP model, optimal delay or native scheduler
is claimed. Acquisitions absent from the selected build are excluded/listed by the
native suggestion, rather than silently granting them. Full redistribution and
the selected workspace prototype remain separate unfinished work.

After fixture refresh, a UI test assumed the optimizer always left an AoE skill
unused. Its collapsed-unused-section assertions were preserved with an explicit
synthetic unused-skill input. A ManualBuild mock rejection test also hit the existing
5second whole-test limit in combined runs while its isolated15-test file passed.
Non-throwing polling now avoids repeated DOM error formatting; no timeout or
assertion was weakened. A full diagnostic run passed793; the last quiet rerun is
also green as recorded above. This does not establish the cause of every timing
fluctuation. Temporary instrumentation was removed before that last run.
