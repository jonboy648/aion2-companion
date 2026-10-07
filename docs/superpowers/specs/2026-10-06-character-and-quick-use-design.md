# Character and Quick Use Correction

## Intent and Scope

Make imported character ownership complete and readable, and make Quick Use and
macro instructions correspond to real game actions. Keep existing routes, Home
art, faction themes and borders. Reuse the armory importer, stat sheet, item
grouping, effective ranks and engine cache fingerprint; do not rebuild them.
No deployment until the combined preview is reviewed.

## Character Presentation

Show identity and grouped equipment without nested disclosures hiding the entire
profile. Keep recommendations separate from imported ownership. Show acquired
active/passive skills and equipped stigmas using imported effective skillLevel;
never add Daevanion bonuses to those ranks again. Preserve unknown skill IDs as
display facts without making them executable engine skills.

Show attributes with their reported effects, equipped titles with their equipped
effects separate from collection effects, pet level, wings and wing skin. Reuse
the stat sheet for derived totals and source attribution rather than adding a
second calculation. Missing data is unavailable, not an invented zero.

Group weapons, armor and accessories using existing slot semantics, retaining
unknown slots in an Other group. Preserve enchant/Exceed and official icons.
Changing characters replaces every profile section together. Keep CharacterPage
remount and the duplicate-key regression intact.

## Daevanion Context

Keep an imported character's boards and nodes when entering the planner from its
workflow, including ordinary navigation. Explicit class-only planning remains
possible and must not inherit an unrelated character. Distinguish matched/open
import coverage from owned/available board completion. Handle failed imports
visibly; never silently replace a failed character load with a blank planner.

## Quick Use Contract

Separate twelve Quick Use action identities from configurable key bindings and
physical slot IDs. Skill actions 1-8 correspond to skill slots 1-8; stigma actions
9-12 correspond to slots 21-24, not item slots 11-18. Display mouse bindings and
allow user bindings rather than assuming the reference's Q/E are client defaults.

Derive class defaults/context changes from client tables. Preserve conflicting
editability facts until a test in game resolves their relationship; do not claim
that one flag alone defines placement restrictions. No unacquired skills,
unequipped stigmas or chain follow-ups sold as independent assignable skills.
Legacy saved generic-key plans must not be silently remapped into wrong actions.
Webapi changes are additive; regenerate the bundle and cache fingerprint.

## Macro Evidence

Enforce client-supported 20-entry maximum and 10-9900 ms delay bounds, including
persisted inputs. Setup instructions name Quick Use actions, bindings, delay,
held execution, manual precedence, Skill Queue and control-mode caveats.
Do not promise execution order. Withhold trustworthy macro DPS/efficiency and
simulation-optimized prescriptions until queue/retry rules are validated in game.
Preserve experimental engine behavior only with explicit unverified provenance;
do not use it as proof of a reliable macro recommendation.

The controlled protocol is in the Quick Use in-game validation research note.
Exact queue capacity, overwrite, retry timing and chain handling require captured
observations. Client tests cannot substitute for that evidence. Unresolved
runtime behavior remains clearly marked unverified.

## TDD Boundaries and Acceptance

Test one behavior at a time through these public boundaries:

1. armoryExtras/import results: literal fixture ranks, title effects, pet level,
   malformed/missing payloads and no double-counting of imported bonuses.
2. Rendered Character workflow: visible grouped ownership, unknown-slot retention,
   character switching and no stale profile sections or duplicate keys.
3. Rendered planner navigation: imported boards persist, explicit class planning
   stays separate, and failed loads are visible.
4. Keybind/macro API and rendered controls: stable action identity under rebinding,
   all-class defaults, valid acquired skills, supported delay/entry bounds,
   persistence migration, setup export and no validated-performance claims.
5. Simulator runtime rules: only rules discriminated by independent in-game
   evidence, compared with a separate held-out trace.

Watch each new regression fail for the intended reason before production edits.
Run focused tests and type checks during development, then full Python/web suites,
bundle/fixture regeneration and production build. Review the diff for correctness
and scope, then commit on the current branch. Verify real browser workflows at
desktop and 390 px, including keyboard operation, character change, contextual
boards, bindings, delay controls, exports and console errors. Present the combined
preview; list any outstanding in-game evidence without declaring the full goal
complete.
