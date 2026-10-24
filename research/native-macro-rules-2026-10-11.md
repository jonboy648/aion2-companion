# AION 2 native macro rules and site audit

> Archived evidence and design snapshot from 2026-10-11. Statements about the
> website and implementation approval describe that date, not current main.
> The native setup editor subsequently shipped in PR 41; scheduler/retry and
> optimal macro timing remain unverified. See the Oct 12 native verification,
> Oct 19 release verification and `questlog_data_acquisition_2026-10-19.md` for
> later work. This report contains derived observations, never raw recordings.

Date: 2026-10-11. Research only; no implementation or deployment authorized after Jon selected report first. Earlier experimental edits were removed. Export patch version is unverified, so these are facts from the available Global client export, not a claim that every regional/current client matches.

## Primary evidence

Read-only client Table root: configured privately by `AION2_EXPORT_DIR`.
No raw rows, personal settings, credentials, or exported source files are copied into this report.

| Evidence | Derived fact |
| --- | --- |
| `InputKeyMapping.json`, Macro mapping | One Macro input action exists; its default Keys array is empty. F9/F10/F11 are our suggestions, not game defaults. |
| `InputEvent.json`, Macro event | The built-in Macro event uses that Macro mapping. |
| `L10N/en-US/L10NString.json`, `String_UI_SKILL_SETTING_MACRO_DESC_body` | The native editor adds steps with Add Macro and gives each step a delay. PC activation is configured under Settings > Key Settings > General > Macro and runs while held. Manual input takes precedence. The game warns that progression through steps does not guarantee execution order. |
| Same help key | Mouse-operation-related activation hotkeys do not function in AION 1 Control Mode. This is a restriction on the activation hotkey, not a general ban on mouse-bound columns appearing as steps. |
| `String_UI_SKILL_CONTEXT_INFO_GUIDE_body` | A column selects a learned, off-cooldown skill whose conditions are satisfied. Priority increases from row 3 toward row 0; row 0 is highest. This is eligibility/priority selection, not a guaranteed cast-every-row sequence. |
| `Message_MSG_CANNOT_EMPTY_DEFAULT_CONTEXT_SLOT_body` | Row 0 must be populated before skills can be placed in rows 1-3. |
| `Message_MSG_CANNOT_CHANGE_CONTEXT_SLOT_BY_OTHER_FIX_SLOT_body` | Basic Attack's slot cannot be moved. |
| `Message_MSG_CANNOT_CHANGE_CONTEXT_SLOT_BY_ONLY_CONTEXT_body`, `...ONLY_DEFAULT_body`, and corresponding OTHER messages | Some skills are restricted to rows 1-3; others to row 0. Generic drag/drop of every skill into every cell would be incorrect. |
| `Message_MSG_SKILL_SETTING_MACRO_DELAYLIMIT_body` | Per-step delay accepts 10 through 9900 milliseconds. |
| `GlobalSetting.json`, `skill_macro_list_max` | Configured list-limit value is 20. Its application to steps versus saved configurations is not established by this table alone; see the limit audit below. |
| `Message_MSG_SKILLMACRO_CANCEL_BY_PRESETSWAP_body` | Changing a skill preset stops the running macro. |
| EMPTY, EMPTY_SKILL, CANNOT_USE_SKILL, UNUSABLE macro messages | Distinguish no configured macro, no registered skills, no currently usable skill, and a character state that blocks activation. Exact blocked states are not enumerated by these messages. |

## Client table follow-up: restrictions and limits

### Direct game widget and reflection-mapping inspection

Read the installed game's pak inventory using the existing uex tool, then parsed the private `AION2-current.usmap` mapping with the existing CUE4Parse mappings parser. No game process was attached, modified or executed; no pak source files were copied into the repository. The mapping filename does not establish a patch version.

- `AION2/Content/UI/Widget/Popup/Popup_Skill_MacroSetting_Quickslot.uasset` contains 12 `Slot_SkillMacro` widget instances. Its generated class inherits native `/Script/Aion2` class `AionDialogWidget_SkillMacroQuickSlotTooltip` and declares native tick. This is the actual game's macro picker asset, not our website model.
- In `AION2-current.usmap`, `AionWidget_SkillMacroQuickSlot` has `SlotId_Set`, `SkillBasicInfoUpdater`, `P_SkillIcon`, `P_Txt_SkillLv`, `P_HotKey` and selection controls. This directly establishes a slot-ID property on the game's macro picker alongside skill/rank/key presentation. It supports slot-linked selection but does not expose the persisted macro-entry implementation or scheduler.
- `AionWidget_QuickSlotListContextSkill` has `SlotId` and separate `P_Flow_ContextSkill_0` through `_3` members: context rows belong to a slot.
- `DevPacketData_Common_QuickSlotInfo` has `_slot_id`, `_skill_id`, `_context_skill_ids` and `_skill_macro_no`, among other fields. These are reflected schema fields, not captured packets or proof of runtime transition order.
- `Popup_Skill_MacroSetting.uasset` inherits native class `AionWidget_SkillMacroSetting`; the mappings describe a list view and Add Macro controls. `AionWidget_SkillMacroSettingItem` includes entry number, skill presentation, count/delay-related control and delete control. These corroborate the supplied screenshots' linked slot/skill UI.
- The reflection enum `EContextSkillSlotRegisterType` includes `All`, `OnlyDefault`, `OnlyContext`, `AllUnable`, `FixSlot`, `Max`. Thus the row-specific restriction types do exist in game metadata, even though the inspected `Skill.json` rows only use `All` and `FixSlot`. Their availability in an enum alone does not classify particular skills.
- The inspected assets reference native classes; their serialized exports and reflection mappings are not C++ function bodies. The installed client has `AION2.exe`; the debug manifest mentions a Shipping PDB, but that PDB is not present at its listed location. No runtime macro scheduler body was recovered in this inspection. Therefore one-skill-per-visit versus exhausting a context column remains unresolved; do not turn widget names into an execution guarantee.

All paths in this section are relative to the private client root above. Evidence locators use `Properties.Data` and the named record identifiers/fields, not repository copies of exported rows. Findings describe this export only. JSON `Version: 13` in the slot tables is not a verified game patch identifier.

### Slot identity and editability

- `PCContextSkillSlot.json`, `Properties.Data`, fields `Class`, `QuickSlotId`, `DefaultSkillId`, `ContextChangeSkillList`, `bEditable`: nine non-tutorial class groups each have 12 records, targeting QuickSlotIds 1-8 and 21-24. Each has `bEditable=false` only for QuickSlotId 1; the other 11 are true. Tutorial has two records, both false. These are class/slot defaults, not the player's saved placement.
- `QuickSlotData.json`, records identified by `SlotId.Value`: IDs 1-8 map to `EAionInputAction::QuickSlot_Skill_1` through `_8`; IDs 21-24 map to `QuickSlot_Stigma_1` through `_4`. All twelve have `bEditable=false`. Item IDs 11-18 map to `QuickSlot_Item_1` through `_8` and have `bEditable=true`. Thus this table's flag cannot be substituted for the class context editor flag: doing so would incorrectly make every skill column uneditable. Exact consumer semantics remain unverified without client code or observed UI.
- `QuickSlotData.json`, `AvailableType`: skill/stigma slots enable positions 0 and 4 of the five-element boolean array; item slots enable position 1. No enum-index definition was established here. These positions must not be interpreted as context priority row numbers.
- `PCContextSkillSlot.json`, `ContextChangeSkillList`: nonempty lists occur on slot 8 for every non-tutorial class and slot 7 for every such class except Elementalist. Their presence does not prove an exhaustive allowed-skill list, authored row placement, or a prohibition on changing empty-list slots. In particular, empty-list slots can have `bEditable=true`.
- `Skill.json`, `Properties.Data`, `ID.Value` and `ContextSkillSlotRegisterType`: a complete grouping of 16,279 records finds 16,217 `EContextSkillSlotRegisterType::All` and 62 `EContextSkillSlotRegisterType::FixSlot`; no other registration-type value occurs. Every class's slot-1 `DefaultSkillId` joins to `FixSlot` (including Tutorial). For an exact reproducible example, Gladiator `PCContextSkillSlot` ID 3 targets QuickSlotId 1 and default skill 11020000, whose `Skill` registration type is `FixSlot`. This corroborates fixed defaults, but does not identify a fixed destination for all 62 skills or enumerate all player-acquirable skills.
- `L10N/en-US/L10NString.json`, `Message_MSG_CANNOT_DELETE_SKILL_BY_SKILL_IN_CONTEXT_SLOT_body`: clearing the underlying slot requires its context slots to be empty. Together with `Message_MSG_CANNOT_EMPTY_DEFAULT_CONTEXT_SLOT_body`, this supports dependency validation on clearing row 0 as well as adding rows 1-3.
- The four exact message keys `Message_MSG_CANNOT_CHANGE_CONTEXT_SLOT_BY_ONLY_CONTEXT_body`, `Message_MSG_CANNOT_CHANGE_CONTEXT_SLOT_BY_OTHER_ONLY_CONTEXT_body`, `Message_MSG_CANNOT_CHANGE_CONTEXT_SLOT_BY_ONLY_DEFAULT_body`, and `Message_MSG_CANNOT_CHANGE_CONTEXT_SLOT_BY_OTHER_ONLY_DEFAULT_body` prove selected/incoming-skill restrictions exist. They do not supply skill IDs. The observed `All`/`FixSlot` distribution does not resolve those row-specific classifications; do not invent `OnlyContext`/`OnlyDefault` values in this export or derive them from `ContextChangeSkillList`.

### Macro set, row, list and icon values

`GlobalSetting.json`, `Properties.Data`, record `Name=GlobalSetting` has the following distinct settings:

| Exact key | Derived configured value | Evidence boundary |
| --- | --- | --- |
| `max_skill_macro_set` | 10 | Set-named limit; saved-set interpretation is a naming inference, not verified runtime behavior. |
| `max_skill_macro_row` | 10 | Row-named limit; relation to steps is not proved. Do not equate it with the four-row context grid described in L10N. |
| `max_skill_macro_Icon` | 20 | Icon-named limit; not evidence of 20 steps or sets. |
| `skill_macro_list_max` | 20 | List-named limit; no identified consumer establishes which list is counted. |
| `skill_macro_delay_min`, `skill_macro_delay_max` | 10, 9900 | Independently corroborated as milliseconds by the delay-limit message. |
| `skill_macro_timer` | 5000 | Units and purpose unresolved; do not label this a step delay, queue window, or hold timeout. |
| `skill_macro_open` | Enabled | Configuration flag, not proof of availability in every current regional client. |

Source-owned evidence distinguishes the concepts lexically: the table has separate set and row keys, while `L10N/en-US/L10NString.json` and `L10N/ko-KR/L10NString.json`, `String_UI_SKILL_SETTING_MACRO_DESC_body`, explicitly describe adding steps and assigning delay per step. Neither language's `Message_MSG_SKILL_SETTING_MACRO_FULL_body` names a numeric limit or distinguishes saved sets from steps. `String_UI_SKILL_QUICKSLOT_MACRO_POPUP_TITLE_body` concerns icon settings and does not resolve capacity. Consequently **10 saved sets, 10 steps, and 20 steps are all unverified UI/runtime claims**. The earlier recommendation of a verified 20-step cap is withdrawn. Preserve the separate constants as evidence until their consumers or first-party UI are verified.

### Foundational L10N verification

Re-read `String_UI_SKILL_SETTING_MACRO_DESC_body` and `String_UI_SKILL_CONTEXT_INFO_GUIDE_body` in both `L10N/en-US/L10NString.json` and `L10N/ko-KR/L10NString.json`. Both describe hold-to-run PC activation, per-step delay, manual-input precedence, the AION 1-mode mouse-related activation limitation, and non-guaranteed step order. The Korean priority guide explicitly describes the highest-priority eligible skill and increasing priority from 3 toward 0, confirming the English interpretation. These are documented rules, not an observation of scheduler internals.

`InputEvent.json`, record `Name=Macro`, additionally records `InputEvent=EAionInputEvent::Macro`, `TriggerType=EAionInputTriggerType::PressRelease`, and `KeyMapping=Macro`. This corroborates the input lifecycle without proving queue timing. The dependency, fixed-slot, row-restriction, delay, preset-stop, empty/unusable messages cited above were rechecked in English; they retain the stated meanings.

## How the native system fits together

1. The player arranges the skill grid: four priority rows within each Quick Use column.
2. A Quick Use input addresses a column. Its binding is not the column's identity; rebinding does not create a different slot.
3. The column resolves to the highest-priority eligible skill. A ready filler in row 0 can prevent higher-numbered rows from being chosen; this follows the selection rule rather than a round-robin model.
4. The player creates macro entries with an individual delay for each step. Jon's screenshots render those entries as named skills with icons, ranks and binding badges. The exact persisted target and behavior after a column changes are not established by the help text; do not claim a dynamic column-only reference without verifying it.
5. A single configured Macro activation input runs the built-in system while held. Manual input wins. A preset change stops it.
6. Configured entry numbering must not be advertised as a deterministic spell rotation. Delay is not evidence of completed casting or an optimal DPS setting.

The site should help reproduce this configuration in the game, not generate an external mouse/keyboard automation script.

## Supplied screenshots and exact Questlog build comparison

On 2026-10-11, inspected the rendered [Questlog build supplied by Jon](https://questlog.gg/aion-2/en/skill-builder/ETAwyX1VQmEy?build-id=8398), not merely its text-fetch shell. These are observations of the site's presentation, not primary proof of game scheduling.

- The selected Leveling (0-1200 GS) build separates learned skills/ranks, a four-row placement grid, a Skill Priority section, a Macros section and manual-use guidance. Those are distinct layers, not one interchangeable rotation list.
- Its Leveling macro presents Element Enhancement, Winter's Shackles and Blaze, as icons with skill names and ranks; the displayed delay links are 10 ms. Its grid and macro records are visibly connected by skill identity. Its numeric column labels are not proof of Jon's own bindings.
- Jon's third game screenshot presents the same three named skills, each with its own 10 ms delay, icon, rank and binding badge: Element Enhancement (2), Winter's Shackles (Q), Blaze (3). The observed game ranks differ from the Questlog build, so copying website ranks would not reproduce his character.
- His second game screenshot presents Ice Chain, Blaze, Winter's Shackles, Element Enhancement, with separate 11/11/11/10 ms fields. These are two configurations, not proof that the website's order is an observed runtime casting sequence.
- His hotbar screenshot shows the four priority rows above a separate live quickslot strip carrying bindings. The Q-associated column contains multiple context skills. A static setup grid and the live quickslot strip must not be collapsed into one grid with generic action labels.
- The existing `docs/prototypes/native-macro.html` is an inadequate initial mockup: unrelated sample assignments, no live quickslot strip, generic action selectors instead of skill-rich macro entries, and no actual ranks or binding badges on macro entries. Its eligibility logic demonstration does not establish that its macro-target model matches the game.

Corrected presentation direction: show the authored four-row placement grid and distinct live quickslot strip, then named macro entries with linked skill icon/rank/binding metadata and per-entry delay. Preserve internal action identity where supported, but do not expose an action-ID-centric UI in place of the player's actual skills. Underlying saved target and response to hotbar changes still require verification before implementing runtime claims.

## Observed gameplay: Questlog recordings on 2026-10-11

Read the existing local recordings under `C:/Users/jonca/AppData/Roaming/Questlog/aion-2/`, without changing capture settings, attaching to the game, uploading logs, or copying raw recordings into the repository. The recording index identifies the relevant session; encounter summaries identify the self participant. Event analysis filters by that participant's entity, not just class-shaped skill IDs.

File metadata initially reported an old size and write time for the open recording. Direct reads found more than 107 MB and self events through 16:16:34 America/Chicago. Thus the earlier inference that recording was stale was incorrect. These are snapshot observations, not a claim that every moment of gameplay is captured.

### Recent saved encounters

Source: local `encounters/<id>.json`, `summary.participants` self record, `summary.durationSeconds`, `summary.targets`, and `summary.captureGaps`.

| Encounter start, America/Chicago | Duration | Self damage | Recorded self DPS | Targets in summary |
| --- | ---: | ---: | ---: | ---: |
| 15:54:06 | 156.915 s | 1,200,000 | 7,647.5 | 1 |
| 15:59:31 | 187.776 s | 1,560,058 | 8,308.1 | 1 |
| 16:11:41 | 24.133 s | 258,840 | 10,725.6 | 2 |

All three summaries report zero capture gaps. They are different encounters, not controlled tests of the same target or macro. In particular, the short two-target encounter must not be used as a single-target DPS calibration result.

### Separating skill activity from input steps

- For runtime skill identity, join each event's exact skill ID to the private `Skill.json` record by `ID.Value`, then use `DamageAnalyzerSkillIdOverride.Value` to locate the corresponding named derived skill. This is a table-backed join, not an assumption that trimming ID digits recovers its base skill or rank.
- In the 24.133-second encounter window, the self participant has 152 raw `cast` events: 34 join to `ESkillType::Active`, 117 to `ESkillType::System`, and one to `ESkillType::Item`. These counts describe event classifications; they are not 152 button presses or proof that each Active event is an independent player input.
- Firestorm has four Active cast events and twenty System cast events in that window. Passive/system effects such as Absorb Essence, Grace of Enhancement and Cold Snap also emit cast events. Treating every raw cast as a configured macro step would therefore invent a large number of inputs.
- An Ice Chain Active event at encounter offset 1,456 ms is followed by 2,304 damage on the same actor/action at 2,138 ms and a cancellation at 2,218 ms. Winter's Shackles, Firestorm and other casts likewise sometimes deal damage before cancellation. A cancellation flag alone does not establish a failed or zero-damage skill; this observation does not identify why it was cancelled.
- The latest recorded skill loadout is timestamped 15:40:21. It includes Ice Chain rank 8, Blaze rank 14, Element Enhancement rank 13 and Winter's Shackles rank 13. These are that loadout snapshot's ranks, not a reconstruction from runtime variant-ID suffixes, and not a guarantee of the current hotbar layout.

### What the recording cannot establish

The inspected recording has skill loadouts, cast/begin/end events, damage, cooldown fields on some casts, and other combat/state events. Its event types and top-level fields do not expose macro configuration, hotbar placement, pressed keys, context-row selection or an input-origin flag. The inspected `skill-loadout` events contain learned/equipped skill information, not the four-row authored quickslot grid.

Consequently these observations can validate realized skill activity and damage, but cannot assign a cast to a particular macro column or distinguish manual input from macro activation. They do not settle whether the scheduler exhausts a column before moving on or revisits it later. A matched recording of the in-game grid, macro configuration and a known macro-only interval is still required to test those competing runtime models. Do not replace that missing evidence with our simulator's behavior.

## Additional community source: Kanon's Aion 2 Bible

Read the supplied [Kanon's Aion 2 Bible](https://docs.google.com/document/d/11u4wLCG1WfL-xSka2Aze0rI9vYRa7mq3N3Gp1bt0AWY/edit) on 2026-10-11 through the connected Drive reader. Verified metadata identifies a native Google Doc, last modified 2026-10-06. Readable content covers twelve chapters; embedded screenshots/graphs were not visually inspected. This is author-provided community research, not publisher documentation or recovered game implementation.

Useful claims to cross-check:

- Chapter 4 distinguishes purchased ranks from gear, Arcana and Daevanion bonuses, and specialty option/slot thresholds. This supports making the sources of effective ranks visible, rather than treating every rank as purchased.
- Chapters 8-9 distinguish pet progression and wing ownership effects from equipped effects. Several recommendations differ explicitly between Global and Asia.
- Chapter 11 separates attack categories and damage buckets, and flags multi-hit placement as unresolved. Its target modifiers and timing claims require controlled combat validation.
- Regional caution: Chapter 3 discusses Global's 50% crit cap; Chapter 11 also contains 80% crit language. Six-stigma and level-50 advice must not be generalized to Global level-45 builds.
- No macro, Quick Use, queue or delay explanation was found in the retrieved text. Chapter 12 links to community loadouts; this document does not resolve the scheduler question.

### Comparison with our checked-out code, not a live-site audit

- `app/aion2c/models.py`, `total_rank`, already combines purchased ranks, Daevanion bonuses and `bonus_ranks`, including chain ownership. Reuse that contract; do not reimplement effective rank in a guide-only UI.
- `app/aion2c/engine/damage.py`, `hit_damage_ex`, uses one attack input with attack/weapon percentage multipliers and fixed estimated boss factors. It does not separately model every attack bucket described by the guide.
- `app/aion2c/statsheet.py`, `engine_stats`, explicitly documents omitted or uncertain inputs: Attack Bonus treatment, PvE/Boss flat attack, target-side stats, Perfect and Multi-hit. These are concrete audit targets, not newly verified formulas.
- Preserve the client-evidenced Global crit cap and region-specific progression rules. Do not overwrite them with a mixed-region community formula or tune constants to one uncontrolled two-target encounter.

Follow-up order: map stat identities to client tables; audit ownership/equip contributions; compare effective ranks against the recorded loadout; then test candidate damage terms against matched single-target recordings with known buffs and target conditions. Keep source confidence and region attached to each claim. No production changes are authorized by this source review.

## Website mismatches at main 446d599

### Confirmed defects

- `useKeybindPlan.ts` defaults to separate Boss/AoE/Leveling F9/F10/F11 bindings; `quick_use.py` emits those as separate native macro hotkeys. They should be saved configuration choices using the game's one Macro activation binding, initially unassigned unless the user supplies it.
- `MacroPanel.tsx` warns when a macro entry uses a mouse-bound column. The client warning is about mouse-related activation hotkeys. We need to evaluate the chosen activation binding and control mode separately from step targets.
- `quick_use.py` assigns only one skill to each column. The native grid has four priority rows. Class context alternatives are metadata and do not establish the player's authored placement, but that is not a reason to omit a real, rule-aware column editor.
- The native setup offers a shared delay rather than an editable delay for each configured step. It lacks a proper Add Macro / choose-column / remove-step / repeat-column configuration flow.
- `macro.py` states ordered wrapping execution as a game rule. That is an experimental legacy model, not the client's documented contract. The public native path already withholds macro DPS, but wording and any remaining consumers must be audited before reuse.

### Already correct, preserve

- Quick Use identity remains independent of a rebound key.
- Acquired skills, equipped stigmas, unlock gates and class data are checked.
- Delay limits, manual-input precedence and non-guaranteed macro order are reflected in native instructions.
- Current native results do not advertise simulated macro DPS as verified game behavior.

## Recommended implementation, not yet approved

Keep the existing page and visual theme. Replace its native configuration controls with:

- One editable Macro activation binding; choose control mode and show the activation warning in the correct place. Legacy per-scenario bindings should be preserved with a migration notice, not silently guessed into one binding.
- An actual four-row-per-column skill grid, visually row 3 at top through row 0 at bottom. Validate acquired skills, fixed Basic Attack, row-0 dependency, and verified row-specific restrictions. Do not infer an imported hotbar from armory skill ranks.
- Saved configurations attached to the selected build/playstyle and game preset, without claiming that each playstyle has a distinct activation key.
- A native step editor: Add Macro, select Quick Use column, individual delay, remove/reorder configured entries. Repeated-column acceptance and numeric step capacity require first-party verification; the list-limit constant alone does not prove either. Numbering describes configuration only, not observed runtime order.
- A setup sheet describing the in-game editor and controls. No external scripts, unattended toggle, or invented simulator-optimized timing.

## Still requires evidence

Additional file check: `SkillControlSetting.json`, `Properties.Data`, has ten records with fields `ID`, `CharacterClass`, and `ControlSettingSkillId`. It identifies class-associated control-setting skills; it does not enumerate macro scheduling or queue capacity. A targeted case-insensitive search for macro/queue in exported setting, input and quickslot JSON files found the already cited Macro input records and GlobalSetting constants, not an additional queue execution contract. This is a scoped negative finding, not proof no other client resource contains relevant behavior.

- Exact queue capacity, retry scheduling, overwrite rules, and interaction between Skill Queue and manual inputs.
- Exact timing of delays relative to casts, cancellation and animation recovery.
- Current regional patch/version confirmation.
- Mapping every row-specific restriction to a particular skill; error messages prove the restrictions exist, but do not by themselves classify every skill.
- Runtime meanings and consumers of `max_skill_macro_set`, `max_skill_macro_row`, `max_skill_macro_Icon`, `skill_macro_list_max`, and `skill_macro_timer`; saved-set and step capacities remain unresolved.
- Whether repeating the same column is accepted, and whether the native editor supports reordering entries.
- Recommended class-specific column placement and charge/animation-cancel advice. These are build recommendations requiring class evidence, not universal macro rules.

## Online research boundary

Third-party guides were used to discover publisher links and screenshots, not as independent proof of engine timing. Publisher pages below were located, but the text browser returned only a dynamic shell; their article contents were not verified:

- https://aion2.plaync.com/ko-kr/board/update/view?articleId=69791238ba0dc1026f956b24
- https://aion2.plaync.com/ko-kr/board/update/view?articleId=6a15f4b88cd2017bc6f020f5
- https://aion2.plaync.com/ko-kr/board/update/view?articleId=6a568e38e2307f62bca6bcf4

The substantive confirmed rules above come from the game's own available English client strings and tables. Do not apply AION 1 slash-command macros or third-party peripheral software behavior to this system.
