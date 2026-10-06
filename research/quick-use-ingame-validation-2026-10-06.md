# Quick Use and Macro In-Game Validation

Status: test protocol, not evidence that the behavior has passed.
Client export patch version remains unverified. No personal settings or raw export
files belong in the repository.

## Capture First

Record the game version, class, character level, control mode, Skill Queue setting,
Quick Use action-to-key bindings, all four rows of the tested stacks, and macro
entries/delays. Show the settings in the recording; do not infer them from keys.
Hide private chat and account information.

Use a training target and two acquired skills with visibly different effects.
Keep gear, target, skill ranks and settings constant between comparisons. Record
the action bar and combat log together if possible. A damage total alone cannot
prove input order or queue behavior.

## Controlled Checks

1. Press each of the twelve Quick Use actions separately. Record which physical
   slot responds, including mouse actions and the four stigma actions. Change one
   binding and repeat: slot/action identity must remain unchanged.
2. For one editable stack, record its four rows. Test with the bottom skill ready,
   then on cooldown, then unavailable due to its condition. Record the actual
   chosen skill for each attempt. Repeat after changing a row.
3. Attempt to edit the basic-attack slot and one contextual slot. Record allowed
   moves and rejected moves. QuickSlotData marks skill slots noneditable while
   PCContextSkillSlot marks most class slots editable; neither flag alone proves
   the user-facing editing contract.
4. Hold a two-entry macro, then release it. Record start, repeated attempts, and
   any action that completes after release. Repeat at 10 ms and a visibly slower
   delay such as 1000 ms. Do not assume delay is measured after a completed cast.
5. While holding that macro, manually press a third action once. Record whether
   it interrupts, queues, replaces another pending action, or runs afterward.
6. Repeat the same sequence with Skill Queue off and on. During a long cast,
   manually enter A then B once each; observe whether both survive, only one
   survives, or neither does. Repeat with their order reversed.
7. Test a chain-head skill with its follow-up available. Record whether the same
   Quick Use action invokes the contextual follow-up and what happens when its
   condition expires. Do not equate a chain skill ID with an independently
   assignable action.
8. Compare mouse-action macro entries in the two control modes using the same
   settings. The exported tooltip warns that mouse-related hotkeys do not work
   in AION 1 mode; record this separately from keyboard entries.

Repeat timing-sensitive cases at least three times. A recording without visible
settings or a repeatable input sequence is inconclusive, not a passing test.

## Evidence and Acceptance

For each case record: settings, input sequence, observed action order, timestamps
or frame numbers, repetitions, and any inconsistent outcome. Keep the outcome
empty until observed. Client-confirmed held execution, manual precedence and
non-guaranteed order are constraints, not a deterministic queue model.

Only add a simulator rule when observations discriminate it from alternatives.
Cover that rule with a failing behavioral test before changing the simulator,
then compare its trace with a separate captured case. If queue capacity, retry
timing or overwrite behavior remains inconclusive, keep macro DPS/efficiency
unvalidated rather than presenting a fitted number as verified game behavior.

## Confirmed Profile Fixture Connections

The shipped armory fixture has 12 Active, 10 Passive and 13 Dp skill rows. Seven
Dp rows are unacquired with rank zero and equip zero. They must not be rendered
as equipped stigmas or assigned as executable skills. Display imported effective
skillLevel values without adding Daevanion bonuses a second time.

Equipment includes MainHand/SubHand, armor and accessories. Unknown future slots
must remain visible instead of being dropped by grouping. Titles expose separate
equipped effects and collection effects; these must not be combined or counted
twice. Pet level and wing enchant data are already present in the raw response.

## Existing Test Coverage Audit

- `web/src/features/build/rotationPlan.test.tsx` checks icons and presence of pet
  and wings only. It does not assert pet level, titles, attributes, imported
  effective ranks, grouping or missing-data behavior beyond an empty response.
- `web/src/features/keybinds/MacroPanel.test.tsx` explicitly expects generic
  `Key 1` labels, 0-500 ms delay bounds, ordered fallback wording and efficiency
  percentages. These are existing assumptions, not evidence of game behavior.
  A green run of that suite cannot validate the requested correction.
- New acceptance must assert stable Quick Use identities independently of
  changing bindings; literal client-supported 10-9900 ms bounds; at most 20
  macro entries; held execution and manual precedence; and no assertion of
  guaranteed execution order or validated DPS without captured evidence.
- Imported effective-rank tests must use literal known raw ranks and verify
  that adding known Daevanion nodes does not increase those displayed ranks
  again. Separate generated-build tests should exercise engine total_rank and
  chain rank_owner behavior rather than reusing imported raw values.
- Character-change tests must ensure that titles, pet, wings, attributes,
  skills and owned board context change together and never retain the previous
  character's state. Keep the existing remount and duplicate-key regression
  checks alongside these new behaviors.

This is a coverage audit and proposed acceptance, not a claim that new tests or
production corrections have been implemented or run.
