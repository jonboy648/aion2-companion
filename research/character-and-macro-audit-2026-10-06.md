# Character and Macro Audit

Captured October 6, 2026. Research only; no corrective site changes in this pass.

## Sources and Method

- Public character: https://aionflex.gg/character?id=SQlrdtb1Tw1yEhS_c-OisaL9MCPPr9kxYIr6S7hx8JM%253D&server=2103&region=GLOBAL&name=DarthThot
- Public guide: https://aion2.gaming.tools/builds/templar/leveling
- Our live character: https://becomecube.com/c/nae/2103/DarthThot
- Our contextual planner: https://becomecube.com/daevanion?c=nae%2F2103%2FDarthThot
- Browser-read character sections and every board tab; guide tested at levels 1 and 30.
- Read-only primary client tables under the private export's Content/Data/Table.
  The client build/version of that export is still unverified. Its JSON Version
  field is a serialization/table version, not evidence of a game patch number.
- Generated browser evidence is in the local Temp folder, not committed source.
  No third-party implementation code or credentials were copied.

## Imported Daevanion: Confirmed Findings

Both sites show the same opened node counts for DarthThot:

| Board | Open | Available nodes | AionFlex displayed completion |
| --- | ---: | ---: | ---: |
| Nezekan | 68 | 88 | 77% |
| Zikel | 22 | 88 | 25% |
| Vaizel | 17 | 88 | 19% |
| Triniel | 1 | 116 | 1% |
| Azphel | 0 | 152 | 0% |

Our character import reports 108/108 matched nodes. Following its Open Daevanion
link renders those 108 selected nodes, including the board split above.

Confirmed context loss: shared navigation points to bare /daevanion. DaevanionView
only imports a character when the c query parameter is present; otherwise it
creates a blank class planner. The stored active build is not consumed there.
The Class Guide is also a fresh/manual build, not an imported-character guide.
This demonstrates a navigation/workflow gap, not a universal armory import failure.
Another character-specific failure remains unverified until reproduced.

## Useful AionFlex Presentation

- Character identity, faction/server, combat power and item-level summary first.
- Separate active, passive and stigma loadouts, with readable effective ranks.
- Equipment grouped into weapons, armor and accessories.
- Divine/core attribute values paired with their effects rather than names alone.
- Titles, pet and wings remain explicit parts of the character profile.
- An inline board explorer has board completion, opened nodes, stat bonuses and
  skill-rank bonuses together; switching boards does not discard the character.
- Recommendations and imported ownership should remain clearly separate in our UI.

The public page reports combat power 44,036 and item level 850. Those labels must
not be equated to modeled DPS or average gear item level without verifying units.
AionFlex displays Attack Bonus +3 on Azphel despite 0/152 opened nodes; do not
copy that into our owned-node totals without checking how start nodes are counted.

## Quick Use Mapping: Evidence, Not Cosmetic Labels

The reference's level-30 Templar display names these action/key pairs:

| Quick Use action | Displayed key |
| --- | --- |
| 1 | Left mouse |
| 2 | Right mouse |
| 3, 4, 5, 6 | 1, 2, 3, 4 |
| 7, 8 | Q, E |
| 9, 10, 11, 12 | 5, 6, 7, 8 |

The reference includes a bottom-first Judgment/Warding Strike/Flash Rampage/
Pummel stack for Quick Use 12 and basic attack under Quick Use 1. That is an
authored Templar setup, not evidence that every class should receive that stack.

Primary exported InputKeyMapping plus en-US L10N confirm action identities:
QuickSlot_Skill_1..8 are Quick Use 1..8; QuickSlot_Stigma_1..4 are Quick Use 9..12.
The exported mouse and number-key defaults agree for actions 1..6 and 9..12,
but exported actions 7/8 use t/backtick rather than the reference's Q/E. Treat
bindings as configurable and export-version dependent; never silently rename IDs.

QuickSlotData separates skill slot IDs 1..8, item IDs 11..18 and stigma IDs 21..24.
PCContextSkillSlot provides class/default/context skills and editable flags.
PCLevelQuickSlot in this export contains initial consumables only, not a skill
slot unlock schedule. SkillControlSetting lists a class control skill; its name
alone is not evidence of queue semantics. These tables need a complete derived
contract before using them to constrain the planner.

Our current plan stores generic labels 1..0,-,= and permits custom synthesized
stacks. UI similarity does not validate correspondence to physical game actions.

## Macro Semantics: Primary Client Evidence

Keyed strings from en-US/L10NString.json:

- String_UI_SKILL_SETTING_MACRO_DESC_body: macro hotkeys run while held; manual
  input has precedence; mouse-related hotkeys do not function in AION 1 mode;
  attempts continue to subsequent steps and step execution order is not guaranteed.
- String_UI_SETTING_TAB_BATTLE_SUBTAB_CONTROL_SKILL_RESERVATION_DESC_body:
  a skill input during another skill's execution can be queued.
- String_UI_SKILL_CONTEXT_INFO_GUIDE_body: acquired, ready, condition-satisfied
  skills are selected with increasing priority from row 3 toward row 0.
- DefaultSettings.SkillReservation is true in this export.
- GlobalSetting.skill_macro_list_max = 20; skill_macro_delay_min = 10;
  skill_macro_delay_max = 9900. Other macro settings coexist; field names alone
  do not establish timing behavior beyond these recorded values.

Our current run_macro model chooses a usable stack entry, advances its pointer,
and applies the entry delay to the completed cast. That is a simplified simulation,
not a validated reproduction of asynchronous input attempts and the skill queue.
The UI allows 0 ms and describes ordered execution more strongly than the client.
The exact retry timing, queue capacity/overwrite rules, chain handling, physical
editing restrictions and effective ping effects still require in-game validation.

## Corrective Work to Review Next

1. Preserve imported character context and show its owned board state directly.
2. Separate physical action/slot identity from a user's configurable key binding.
3. Derive fixed/contextual skill placement and editability from the actual tables;
   do not merely substitute Q/E labels into the generic existing planner.
4. Make the macro sheet name actual Quick Use actions, delay values, manual keys,
   queue prerequisites and control-mode constraints.
5. Correct supported delay bounds and qualify macro DPS until queue/retry behavior
   is modeled and compared with an in-game test. Keep estimates clearly labeled.
6. Preview the corrected character/guide workflow before a further deployment.
