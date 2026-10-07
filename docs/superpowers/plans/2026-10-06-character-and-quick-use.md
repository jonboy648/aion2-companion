# Character and Quick Use Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution or superpowers:subagent-driven-development for delegated execution. Steps use checkbox syntax for tracking.

**Goal:** Complete imported ownership and correct Quick Use/macro setup with evidence-based behavior and TDD.

**Architecture:** Extend the existing armory presentation adapter, not the damage importer. Carry imported context separately from selected recommendations. Add stable Quick Use identities to the existing keybind API and consume them in the current tools; do not manufacture a deterministic queue model.

**Tech Stack:** React, TypeScript, Tailwind, Vitest/Testing Library, Python/pytest, Pyodide.

**Spec:** `docs/superpowers/specs/2026-10-06-character-and-quick-use-design.md`

## Global Constraints

- Keep existing routes, Home art, faction themes and borders.
- Reuse the armory importer, stat sheet, item grouping, effective ranks and engine cache fingerprint.
- Webapi changes are additive; regenerate the bundle and cache fingerprint.
- Enforce client-supported 20-entry maximum and 10-9900 ms delay bounds.
- No deployment until the combined preview is reviewed.
- Do not promise execution order or present unverified macro DPS as reliable.
- One failing behavior, observed RED, minimal GREEN, then the next behavior.

## Review Focus

1. Partial/malformed armory payloads must not crash or invent zero-valued ownership.
2. Unknown slots/skill IDs remain visible without becoming executable game skills.
3. Character switching must not retain titles, boards, ranks or pet from a previous import.
4. Legacy saved generic keys must not silently become incorrect Quick Use actions.
5. Storage failures and stale asynchronous results must leave the current UI usable.

## Task 1: Complete the Armory Presentation Adapter

**Files:** `web/src/lib/armory.ts`; new `web/src/lib/armoryProfile.test.ts`; existing `web/src/features/build/rotationPlan.test.tsx`.

**Interfaces:** Extend ArmoryIcon with optional level/enchantLevel. Extend ArmoryExtras with optional skills, titles and attributes so existing callers remain compatible. Skill presentation rows carry id/name/icon/category/rank/acquired/equipped; titles retain category and separate equipped/collection effect descriptions; attributes retain reported value and effects. Consume ArmoryRaw; do not recalculate DPS.

- [ ] Add one fixture-backed failing test for pet level first:

```ts
it("preserves imported pet level", () => {
  expect(armoryExtras(rawFx as unknown as ArmoryRaw).pet?.level).toBe(3);
});
```

- [ ] Run `npx vitest run src/lib/armoryProfile.test.ts` from web; require failure because level is dropped.
- [ ] Preserve finite nonnegative level in asIcon, rerun to GREEN.
- [ ] Repeat one RED/GREEN cycle each for wing enchant, raw effective rank 12 on Flame Arrow, Active/Passive/Dp classification, equipped titles, separate collection effects, and attributes/effects. Reject invalid rows without throwing; test null sections and unknown IDs with literal expectations.
- [ ] Run both adapter test files and `npx tsc -b --pretty false`.
- [ ] Commit only adapter and its tests.

## Task 2: Visible Complete Character Ownership

**Files:** `web/src/features/build/CharacterCard.tsx`; new `web/src/features/build/CharacterProfile.test.tsx`; `web/src/pages/Character.tsx`; existing `web/src/pages/CharacterPage.test.tsx`; `web/src/features/build/build.test.tsx`.

**Interfaces:** CharacterCard consumes the additive ArmoryExtras and existing ImportResult/ClassData. Existing StatSheetSection remains the derived-total authority. Imported skills display raw effective ranks, not paid ranks plus bonuses.

- [ ] Render CharacterCard with shipped import/raw fixtures and assert the pet level is visible without opening disclosures. Observe RED, then expose the pet/wings section with level/enchant information.
- [ ] Add the next RED test requiring visible weapon/armor/accessory headings and literal known items beneath them; implement grouping with an Other fallback and test an unknown slot separately.
- [ ] Add RED tests for acquired active/passive/equipped stigma sections, literal raw ranks, title category/effects, and attribute/effect pairing; implement each independently using adapter output.
- [ ] Add a rendered Character workflow test requiring profile ownership visible initially; remove the outer all-profile disclosure only after RED. Keep compact section tabs for long skill/title collections, not nested cards.
- [ ] Add a rerender/switch test with two distinct characters and no stale pet/title/rank. Keep existing remount and duplicate-key tests.
- [ ] Run `npx vitest run src/features/build/CharacterProfile.test.tsx src/features/build/build.test.tsx src/pages/CharacterPage.test.tsx`, then `npx tsc -b --pretty false`.
- [ ] Commit the profile slice.

## Task 3: Imported Daevanion Context

**Files:** `web/src/features/keybinds/activeBuild.ts`; `web/src/features/build/useCharacter.ts`; `web/src/features/daevanion/DaevanionView.tsx`; `web/src/components/Layout.tsx`; new `web/src/features/daevanion/characterContext.test.tsx`.

**Interfaces:** Add ImportedCharacterContext {region: ArmoryRegion; serverId: string; name: string}. Add read/storeImportedCharacterContext helpers using existing safe storage helpers. Store only after a successful import. Explicit ?c overrides stored context; explicit ?class creates class-only planning. Bare planner navigation can use the latest imported context, never a selected recommendation as owned nodes.

- [ ] Write a workflow test importing a character, following ordinary planner navigation and observing its owned board nodes; require RED before implementing stored-context resolution.
- [ ] Add separate RED/GREEN tests for explicit class-only planning, explicit character override, storage unavailable, and character replacement.
- [ ] Require failed imports to show an alert rather than blank fallback; cover late results after navigation using deferred boundary responses.
- [ ] Display board completion using available board nodes and import coverage as a separate label; test zero owned nodes and a partially matched board independently.
- [ ] Run the new workflow tests, existing Daevanion tests and CharacterPage tests; typecheck and commit.

## Task 4: Stable Quick Use Actions

**Files:** new `app/aion2c/keybinds/quick_use.py`; `app/aion2c/models.py`; `app/aion2c/keybinds/layout.py`; `app/aion2c/keybinds/export.py`; `app/aion2c/webapi.py`; new `app/tests/test_quick_use.py`; `web/src/lib/types.ts`; `web/src/features/keybinds/Hotbar.tsx` (Hotbar and SlotEditor); `web/src/features/keybinds/useKeybindPlan.ts`; affected guide quickslot tests.

**Interfaces:** Add QuickUseAction {id: int, slot_id: int, binding: str, default_skill: str | None, context_skills: tuple[str, ...], slot_editable: bool, context_editable: bool}. Add quick_use_actions(gd: GameData) -> tuple[QuickUseAction, ...]. Add optional quick_use_id to SlotStack/MacroEntry and additive actions/provenance in KeybindPlan. Derive committed facts from InputKeyMapping/QuickSlotData/PCContextSkillSlot; retain source/version uncertainty and both editability flags. Extend keybinds with optional bindings keyed by stable action ID; existing arguments remain supported.

- [ ] Test literal skill and stigma identities first:

```py
def test_stigma_action_is_not_an_item_slot(sorcerer_gd):
    actions = quick_use_actions(sorcerer_gd)
    assert actions[8].id == 9
    assert actions[8].slot_id == 21
    assert actions[8].binding == "5"
```

- [ ] Observe RED, implement only the corresponding identity mapping, then extend with separate all-class/default/context tests. Confirm skill ID joins and chain-owner distinctions rather than copying authored Templar stacks to every class.
- [ ] Add API-level RED/GREEN cases for binding changes retaining action identity, mouse actions, acquired skills, equipped stigmas, fixed basic attack and contradictory editability metadata without an invented restriction.
- [ ] Add rendered tests expecting Quick Use 1 / left mouse and Quick Use 9 / slot 21; update Hotbar/editor to use stable IDs and keep key binding separately editable.
- [ ] Version saved plans; test a legacy generic-key record produces a clear reset/import notice rather than silent remapping. Test malformed bindings/storage failure.
- [ ] Run focused pytest and web hotbar/guide tests, typecheck, then commit.

## Task 5: Honest Macro Setup and Bounds

**Files:** `app/aion2c/keybinds/macro.py`; `export.py`; `web/src/features/keybinds/useKeybindPlan.ts`; `MacroPanel.tsx`; `SetupSheet.tsx`; Python macro/export tests; web MacroPanel/useKeybindPlan/guide tests.

**Interfaces:** Macro entries refer to Quick Use identity plus binding. Add evidence status distinguishing client-confirmed setup from unverified queue simulation. API numeric legacy fields may remain for compatibility, but UI/export cannot present them as validated efficiency or use them to prescribe a reliable held sequence.

- [ ] Add one RED control test expecting minimum 10 and maximum 9900; implement those bounds, then test persisted 0, negative, nonfinite and 10000 inputs through the hook/API separately.

```ts
expect(screen.getByRole("spinbutton", { name: "Delay between presses (ms)" }))
  .toHaveAttribute("min", "10");
```

- [ ] Add RED tests for at most 20 entries and setup exports naming actual Quick Use actions, bindings and delays; implement each.
- [ ] Add a rendered test forbidding reliable macro-efficiency advice while queue status is unverified. Remove trusted DPS/efficiency prescriptions and replace ordered-execution wording with held attempts/manual priority/non-guaranteed order.
- [ ] Test mouse/control-mode caveat and queue setting in the exported setup sheet. Do not automate external hardware sequences.
- [ ] Label any retained simulator output experimental. Use straightforward client-supported setup rather than hill-climbing an unvalidated queue model into recommendations.
- [ ] Run focused Python keybind and web macro/guide tests, typecheck, commit.

## Task 6: Integration, Review and Preview

**Files:** generated `web/public/engine/*` and `web/src/fixtures/*`; research evidence notes; no raw export files.

- [ ] Run `npm run engine` and `npm run fixtures` from web; inspect generated changes and engine_version fingerprint.
- [ ] Run `python -m pytest` from app, `npx vitest run` from web, then `npm run build`. Poll existing handles to completion; do not restart a suite merely for a timeout.
- [ ] Read code-review skill and review both standards and approved-spec coverage against base 77ba734. Fix findings with regression tests; rerun affected suites and build.
- [ ] Start one isolated preview on a verified free port, with the public proxy configured and no secrets printed. Check real imported character and second-character switch, grouped ownership, ranks/titles/attributes, all boards, explicit class planner, Quick Use rebinding, macro bounds and copy/export.
- [ ] Verify desktop and 390 px via browser, screenshots, keyboard controls, no overlapping/clipped content and console errors. Report exact preview URL and evidence.
- [ ] Commit implementation and evidence on the current branch; do not push/deploy without preview approval.
- [ ] Apply the in-game checklist when Jon provides observations. Add a failing simulator test only for discriminated runtime rules, compare with a held-out trace and keep unresolved behavior unverified. The goal remains incomplete if required runtime validation is still missing.

## Execution Choice

Recommended: native execution in this session, followed by independent whole-branch review. Tasks share profile/context and action-identity contracts, so serial red/green cycles avoid integration churn. Delegate read-only review or independent evidence checks only to exact verified agent targets; never broadcast.
