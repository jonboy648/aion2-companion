# Client tables recon (2026-10-04)

Source: private export at `<private export root>\out\AION2\Content\Data\Table\` (read-only, stays outside this repo). This note holds only derived facts and small samples. Nothing here was copied from the export in bulk. All checks were done by script against `app/aion2c/data/classes/*/gamedata.json`.

## 0. The one thing to know first

The export is **partial**. `decode-audit.json` shows 241 Table `.dat` files decoded and **129 failed** (struct/usmap mismatch against `AION2-5.3.2.0.usmap`; regeneration of mappings also failed: "mounted 0 files ... check AES key and game version"). The failed set includes every table that holds the per-skill header and the item base data:

`Skill`, `SkillLv`, `SkillEffect`, `SkillAbnormal`, `SkillAbnormalEffect`, `SkillAcquireData`, `SkillLink`, `SkillTransform`, `SkillProjectile`, `SkillAutoUse`, `Item`, `Enchant`, `ExceedEnchant`, `ItemSurpass`, `ItemSuccession(+Prob)`, `NpcData`, `PcData`, `DaevanionBoard`, `DaevanionMaxCapacity`, `StatCorrectionNumber`, `GlobalSetting`, `SpecializedSkill`, `Act`, `ActInfo`, `CraftRecipe`.

Consequences: cooldown, cast time, MP cost, range, skill-to-effect links, enchant success rates, exceed tables, item base stats, boss/monster stats, and the damage/crit constants (`GlobalSetting`, `StatCorrectionNumber`) are **not found in decoded form**. Grep of every decoded JSON for cool/cast/mpcost/range-style keys returns nothing relevant. Also `Exp.json` decoded as garbage (Level always 1, absurd NeedExp), so do not trust it.

What IS decoded and useful is large: per-rank damage groups, DoT/buff value groups, stat tables, Daevanion, specializations, charge timing, enchant stat steps, English strings.

## 1. Which tables hold what

All decoded tables are `{"Version", "Ids", "Properties": {"Data": [rows]}}`. Row counts below are from the file.

### Skills and ranks
| Need | Table (rows) | Key fields | Status |
|---|---|---|---|
| Skill ids per class, category | `SkillList` (77) | `ClassType`, `SkillListCategory` (Active/Passive/Dp), `SkillIdList[]` | decoded. Sorcerer lists 35 ids (ours has 51: the extras are chain/hidden/system skills not in the HUD lists) |
| Skill names, descriptions | `SkillString` (9185) + `L10N\en-US\L10NString.json` (152629 keys) | `Name` = `STR_SKILL_PC_<CLASS>_<skillid>` | decoded |
| Skill header (cooldown, cast, MP, range, element, unlock) | `Skill.dat`, `SkillLv.dat` | n/a | **not decoded** |
| Per-rank damage | `SkillEffectLv` (78588) | `SkillEffectLvGroupId`, `SkillEffectLv` (2..40 or 2..25), `EffectValueList[]` strings | decoded. Level 1 row is absent (lives in `SkillEffect.dat`) |
| Specializations | `SpecializedSkillParts` (1028), `SpecializedSkillSlot` (8) | `ID`, `ParentSkillId`, `ParentSkillLv`, desc key | decoded |
| Charge timing | `SkillCharge` (211) | `ChargeMinTime`, `SkillChargeDataList[{ChargeTime, ChargeSkillId}]` | decoded |
| Skill conditions | `SkillCond` (110) | `CondType`, `CondAbnormalEffectType`, `CondSkillList` | decoded (only 2 cond types) |
| Arcana/gear skill-level boosts | `ItemEquipSubstatSkill` (2574) | `Group`, `Class`, `SkillId`, `SkillLevelBaseValue/MaxValue` | decoded |

`EffectValueList` layout for a damage group (verified on 26 Sorcerer groups, e.g. Winter's Shackles): `[0]` flat min, `[1]` flat max, `[2]` ATK ratio x100 (14500 = 145%), `[3]` ratio max, `[4]` hit count, `[5]` hit-type tags ("Normal, Critical"), `[6]` child skill/abnormal id, then padding, and `[21..24]` a second flat/ratio pair that is exactly 1.238x the first at the sampled rank (meaning not identified; possibly a PvP or alternate-target set. Unconfirmed).

Sample (Winter's Shackles, group `Sorcerer_Skill011_LvUp`, 39 rows):
| lv | [0] flat | [2] ratio x100 | [4] hits |
|---|---|---|---|
| 2 | 369 | 14500 | 1 |
| 3 | 486 | 14500 | 1 |
| 40 | 3345 | 14500 | 1 |

### Effects, buffs, debuffs, DoT ticks
| Table (rows) | Key fields | Notes |
|---|---|---|
| `SkillAbnormalEffectLv` (16751) | `AbnormalEffectLevelGroupId`, `AbnormalEffectLevel`, `Values[]` | Two row shapes. **Stat buff shape**: `Values[0]` = stat enum name, `[1]` = value (e.g. `Critical 110` at lv2 to `300` at lv40). **DoT shape**: `[0]` = interval ms (1000), `[3]/[4]` flat min/max, `[5]/[6]` ratio x100. **Proc shape**: `[0]` = proc abnormal id, `[1]` = probability x10000 |
| `SkillAbnormalEffectType` (61) | `AbnormalEffectType`, `CannotControlType[]` | CC type definitions (Aerial, Frozen, ...) |
| `SkillAbnormalString` (3327) | desc keys | English text with `{abe:ID:valueNN}` tokens |
| `SkillAbnormal.dat`, `SkillAbnormalEffect.dat`, `SkillEffect.dat` | n/a | **not decoded** (duration, stacking, the link from abnormal id to level group) |

### Stats and constants
| Need | Table (rows) | Fields | Status |
|---|---|---|---|
| Class base stats by level | `PcStatLevel` (900 = 9 classes x 100 levels) | `Class` (`ECharacterClass::Sorcerer`, `Elementalist` = Spiritmaster, `Fighter` = starter class), `Level`, `StatList[{Key,Value}]` | decoded. Only 3 stats per level: `FixingDamage`, `Defense`, `HPMax`. Sorcerer: lv1 6/10/100, lv45 61/450/4702, lv50 67/500/5250 |
| Main-stat point effects | `PcStatSecond` (1000) | `Stat` (points 1..1000), 15 lists (Str, Dex, Int, Con, Agi, Wis, Justice, Destruction, Freedom, Death, Illusion, Wisdom, Life, Destiny, Time, Space) each `[{StatType, StatValue}]` | decoded. e.g. at 45 points Str gives DamageRatio 450, Agi gives AccuracyRatio 450 and CriticalRatio 450 |
| Conversion curves, crit cap, defense factor, penetration | `StatCorrectionNumber.dat`, `GlobalSetting.dat` | n/a | **not decoded**. Damage-formula constants: not found |
| `EStat` names | seen as enum strings inside the tables above | e.g. `FixingDamage`, `WeaponFixingDamage`, `DamageRatio`, `Critical`, `CriticalResist`, `Perfect`, `HardHit`, `DefensePierce`, `AmplifyAllDamage`, `PvEAmplifyDamage`, `CombatSpeed`, `CoolTimeIncrease`, `MPUseIncrease` | |

### Items, enchant, exceed
| Need | Table (rows) | Notes |
|---|---|---|
| Item base stats, names | `Item.dat` | **not decoded** |
| Enchant stat per level | `EnchantEffect` (76786) | `Group` (6806 groups like `Weapon_Unique`, `Armor_Epic`), `Level` (1..20), `StatList`. Weapon_Unique lv1/2/15 = 10/20/225 on WeaponMinDamage and WeaponDamage. Which item uses which group: in undecoded `Item.dat` |
| Fixed item stat packs | `AdditionalStat` (11280 rows, 2807 groups x ~4-5) | `Name` like `Weapon_Abyss_Unique_3`, `AdditionalStats[{Type,Value}]` (WeaponFixingDamage 90, DamageRatio 300) |
| Random sub-stat pools | `ItemEquipSubstatSkill` (skill-level rolls only), `ImprintMagicStoneProb` (164, mana-stone stat odds by grade) | general random sub-stat pool: **not found** |
| Enchant success rates, exceed tables | `Enchant.dat`, `ExceedEnchant.dat` | **not decoded**. Related decoded: `SoulBindLevelGap` (6001, success rate vs item-level gap), `ArcanaEnchant` (95, exp/cost), `WingEnchantEffect` (298) |
| Set bonuses | `ItemSet` (10), `ItemSetEffect` (4) | |

### Stigma, Daevanion
| Need | Table | Notes |
|---|---|---|
| Daevanion nodes | `DaevanionNode` (10125 = 45 boards x 225 grid cells) | `Board`, `Row`, `Col`, `Grade`, `Type` (Stat 4224 / SkillLevel 792 / Start 45 / None), `NeedLevel`, `CostDaevanionPoint`, `Value01` (stat or skill id), `Value02` (value, x100 for percent stats) |
| Board ids | Sorcerer = boards 61, 62, 63, 64, 66 (NeedLevel 12/20/30/40/45) | other classes use the same pattern with the class digit |
| Stigma acquisition, stigma level, stigma slot unlock | `SkillAcquireData.dat`, `EquipSlotOpen.dat` | **not decoded**. `SpecializedSkillSlot` has 5 Stigma slot rows with unlock 0 and 3 Mastery slots at skill rank 8/12/20 |
| Stigma skill identity | Sorcerer `SkillList` `Dp` category holds 13 ids (5+5+3), which equals our 13 stigmas (inferred, not checked id by id); stigma skills have 25 levels (2..25) in `SkillEffectLv` | likely |

### Boss / monster
`NpcData.dat` not decoded. Decoded but no HP/defense/resists: `NpcAggroData` (56), `NpcBehaviorCase` (2519), `NpcLoot` (1476), `MonsterPartsData` (4), `ElementalSummon` (5). Boss stats: **not found**.

### How ids link
- Skill id `1CNNN0000`: `15` = class (Gladiator 11, Templar 12, Assassin 13, Ranger 14, Sorcerer 15, Spiritmaster/Elementalist 16, Cleric 17, Chanter 18, Fighter 19, common 10). Last digits encode specialization combination: `15110010..50` are specializations 1-5 of `15110000` (`SpecializedSkillParts.ParentSkillId`), `15061230` is a variant with specs 1+2+3.
- Skill to damage rows: **the real link is `Skill.dat` -> `SkillEffect.dat` (id like `1511000011`) -> `SkillEffectLvGroupId`, all undecoded.** The decoded groups are named by animation id: `Sorcerer_Skill011_LvUp`, specialization variants `..._A3_LvUp`, multi-part `..._LvUp_01..05`. For active skills the number is the middle of the skill id (15**110**000 = Skill011) and I matched 26 of 26 Sorcerer damage skills on it. For passives it is not arithmetic (Fire Mark 15710000 = `Passive002`, Cold Snap passive 15730000 = `Passive010`, Grace of Enhancement 15780000 = `Passive014`). Match by value sequence or wait for the decoded `SkillEffect`.
- Effect tokens in text: `{se_dmg:1511000011:SkillUIMinDmgsum}` = SkillEffect id 1511000011 (= skill id x100 + 11); `{se_abe_dmg:SEID:ABEID:SkillUIDotMinDmg:tick}`; `{abe:ID:value02:divide100}` = value index 02 of an abnormal, shown /100. These are what aion2.app resolved, so our `tokens` in the old research JSON came from the same tables.
- Names: L10N key `SkillString_STR_SKILL_PC_SORCERER_15110000_skill_name`, `..._skill_desc_effect`, `..._skill_spec_effect`, `..._specialized_skill_desc` (specializations: `SkillString_<SpecializedSkillPartsDesc>_specialized_skill_desc`). Other namespaces: `SkillAbnormalString_SkillAbnormalString_<id>_desc_effect`, `String_*`, `NpcTalk_*`, `QuestString_*`. Only `en-US` is in the export (no Korean names).

## 2. Our gamedata.json fields vs client tables

Sorcerer file fields (the 8 files share the schema). exact = verified by script or identical semantics; likely = right table, link or layout inferred; none = not in decoded set.

| gamedata field | Client source | Rating |
|---|---|---|
| `skills[].skill_id` | `SkillList.SkillIdList` (HUD skills only), `SkillString.Name` | exact for 35 of 51 Sorcerer ids; the 16 chain/hidden/system ids are only in undecoded tables |
| `name`, `description` | L10N `..._skill_name`, `..._skill_desc_effect` (tokens need resolving) | exact |
| `name_kr` | no ko-KR L10N in export | none |
| `kind` | `SkillList.SkillListCategory` | likely |
| `element` | text / undecoded `SkillEffect` | likely (description) |
| `unlock_level` | `SkillAcquireData.dat` | none |
| `max_rank` | span of `SkillEffectLv` levels + 1 (40 core, 25 stigma) | exact (KR-style caps; global 20 not found) |
| `atk_ratio_pct` | `EffectValueList[2]/100` | exact (26/26 Sorcerer damage skills; 135/135 Sorcerer groups have a rank-constant ratio, which confirms our "applies at all ranks" assumption) |
| `ranks[].flat_min/flat_max` | `EffectValueList[0]/[1]`, ranks 2..N | exact (26/26 skills, every rank). Rank 1: only `SkillEffect.dat` |
| `ranks[].cooldown_s`, `mp_cost` | `Skill.dat` / `SkillLv.dat` | none |
| `range_m`, `aoe_targets`, `anim_lock_s`, cast time | `Skill.dat`, `ActInfo.dat` | none (range and target counts exist as text in descriptions) |
| `hits` | `EffectValueList[4]` | exact where tested (Fire Wall 5, Firestorm 5), but see Hellfire in section 3 |
| `stagger_gauge` | description text ("20 Stagger Gauge Damage") | likely |
| `specializations[].rank_required`, `.text` | `SpecializedSkillParts.ParentSkillLv`, specialized_skill_desc | exact |
| `specializations[].effects` (structured) | variant groups `_A<n>_LvUp` (e.g. `_A3` = specialization 3) | likely |
| `spec_slot_ranks` | `SpecializedSkillSlot` Mastery slots 8/12/20 | exact (resolves 8/12/16 vs 8/12/20 in favor of 8/12/20; spec parts themselves exist at ranks 8/12/16 for mastery and 5/10/15/20 for stigma) |
| `statuses[].duration_s` | small `SkillEffectLv` groups / `SkillAbnormal.dat` | likely |
| `statuses[].tick_s`, `tick_ratio_pct`, flat tick | `SkillAbnormalEffectLv` DoT shape | exact for Fire Wall (see 3) |
| `statuses[].stat_mods` | `SkillAbnormalEffectLv` stat shape (`Critical`, `DamageRatio`, `PvEAmplifyDamage`, `MoveSpeed`...) | exact value, likely group link |
| `statuses[].mp_min_pct` | threshold text in client L10N; numeric field in undecoded `SkillAbnormal` | text exact |
| `rules[]` chains, mp_restore | text + `SkillLink.dat` (undecoded); `SkillCharge` for charge | likely |
| `rules[].charge_levels` | `SkillCharge` | exact (see 3) |
| `triggers[]` chance, proc | `SkillAbnormalEffectLv` proc shape (`[0]` proc id, `[1]` prob x10000) | likely |
| `links[]` | `SkillCond` (conditions), `SkillLink.dat` | partial |
| `daevanion.*.nodes` | `DaevanionNode` | exact (all 5 boards: node count, grid position and cost 89/89, 89/89, 89/89, 117/117, 153/153; stat values equal on every stat node of boards 61-63) |
| `level_caps`, `stigma_slots`, `rank_caps.global` | not decoded (`GlobalSetting`, `EquipSlotOpen`, `SkillAcquireData`) | none |
| `recipes[]` | `CraftRecipe.dat` | none |
| `community`, `roadmap`, `tags`, `hp_dmg_coeff` | our own / external | none |
| `items.json` `main/subs/max_enchant/slope` | `Item.dat` (undecoded), `EnchantEffect`, `AdditionalStat` | partial: enchant steps per grade group exist, item to group link does not |

## 3. Discrepancies and findings from Sorcerer spot-checks

Method: compared every Sorcerer skill with rank data in `gamedata.json` to `SkillEffectLv` groups by value sequence.

**Agreement (the good news).** 26 of 26 Sorcerer damage skills match the client on every rank's flat damage, and the ATK ratio equals `EffectValueList[2]/100`. Other classes with the same method (skills with flat data, all ranks match / ratio equal): Gladiator 33/33, Cleric 17/17, Chanter 25/25 (23), Ranger 30/30 (29), Assassin 26/31 (26), Templar 19/24 (19), Spiritmaster 45/50 (35). The unmatched skills are mostly the name-number rule failing (suffixed or renamed groups), not data errors. So the aion2.app-derived damage numbers are the client's numbers.

Five skills, ours vs client (flat at rank 2 and max rank, ratio):
| Skill | Ours rank 2 / max | Client lv2 / lv max | Ratio ours / client | Cooldown, MP, cast |
|---|---|---|---|---|
| Flame Arrow | 89 / 1396 (r40) | 89 / 1396 | 63 / 63 | cd 0, MP 0 in ours; client: not found |
| Winter's Shackles | 369 / 3345 (r40) | 369 / 3345 | 145 / 145 | cd 45, MP 200 in ours; not found. Spec rank 16 text: "-15s cooldown" |
| Firestorm | 197 / 4189 (r40) | 197 / 4189 | 192.5 / 192.5 | cd 5, MP 250 in ours; not found |
| Fire Wall | 1476 / 4118 (r25) | 1476 / 4118 | 220 / 220 | cd 60, MP 200 in ours; not found |
| Cold Storm | 1074 / 2995 (r25) | 1074 / 2995 | 160 / 160 | cd 60, MP 200 in ours; not found |

Cooldown, cast time, MP cost and range cannot be verified from the decoded set at all. Cast time stays "no cast bar"; animation times are in `ActInfo.dat` (undecoded).

**Fire Wall and Cold Storm DoT ticks are NOT unknown in the client.** `mechanics.json` says ratio unknown and only the flat is known.
- Fire Wall Embers: group `Sorcerer_Skill039_LvUp_AB01`, interval 1000 ms, **110% ATK + flat per tick**, flat 738 (lv2), 826 (lv3), 1019 (lv5), 2059 (lv25). That matches our flat of 2059 at the top rank. A second row `..._AB02` is 120% of AB01 (132%, flat 886 at lv2) and is likely the specialization variant (unconfirmed). Note `mechanics.json` labels the 2059 as "rank 40"; Fire Wall is a 25-rank stigma, so it is rank 25.
- Cold Storm Frostbite: our flat 472 at rank 1 and 1497 at the top matches group `Sorcerer_Skill012_LvUp_AB01` (flat 537 at lv2 to 1497 at lv25) with **80% ATK per tick**, 1000 ms interval. The group is named Skill012 (Glacial Smite's animation number), not Skill020, so the name-number rule fails here; the match rests on the identical 1497 end value. Confirm once `SkillEffect/SkillAbnormal` decode. The text also says damage "increases when targets move"; no multiplier for that was found in decoded tables.
- Rank-1 tick values are not in the table (level 1 missing); our dump's 650 and 472 stay the only source.

**Hellfire is modelled wrong or at least thinly.** We store one ratio (339.25) and a flat min/max range per rank, `hits = 2`. Client groups `Sorcerer_Skill006_LvUp`, `_0`, `_1`, `_2` are four charge tiers with ratios 339.25%, 474.95%, 678.5%, 1017.75%, flats at lv2 of 1460, 2044, 2920, 4381, and hit counts 1, 1, 1, 2 (only the top tier hits twice). Our flat min/max (1460 / 4381 at rank 2) are the first and last tier flats, so the bounds match; the engine should use per-tier ratio and hits. `SkillCharge` gives timing: min charge 300 ms, tiers at 500, 1000, 1500 ms (350/700/1050 ms with the fast-charge specialization). That fills the "no Hellfire per-charge timing" gap.

**MP thresholds (client text).** Robe of Earth: "Increases Critical Hit ... when MP is 50% or more". Grace of Enhancement: PvE and PvP Damage Boost "when the caster's MP is 25% or more". Both agree with our `mp_min_pct` (50 and 25). Both are English client strings, so this settles the doc conflict for this client build (global vs KR build of the client is not stated in the export).

**Ratio mismatches elsewhere (found while testing all classes).** Chanter Rushing Smash ours 189.75 vs client 189.0, Dark Crush 210.18 vs 219.73. Ranger Explosive Arrow ours 0 vs client 253. Spiritmaster ours 0 where the client has a ratio: Magic Backflow 108, Fire Spirit Rage Burst 95, Water Spirit Ice Chain 114, Wind Spirit Gale 85.5 (and variants). Zero ratios in our data mean the engine under-counts those skills.

**Other.** Our `max_rank` 40/25 equals the client's table length (no global cap 20 anywhere in decoded data). `PcStatLevel` shows Sorcerer base FixingDamage only 6..67 over levels 1..50, which says class base attack is small next to gear. The ATK-ratio reading of `[2]` plus our formula should be re-validated in game; the client tables give inputs, not the damage formula.

## 4. Recommended order of work

1. **Unblock decoding (biggest lever).** Regenerate a current usmap for the installed game build (the doctor run failed on AES key / version) and re-decode `Skill`, `SkillLv`, `SkillEffect`, `SkillAbnormal`, `SkillAcquireData`, `SkillLink`, `Item`, `Enchant`, `ExceedEnchant`, `StatCorrectionNumber`, `GlobalSetting`, `NpcData`, `PcData`, `ActInfo`. This single step gives cooldown, MP, cast, range, true skill-to-effect links, enchant and exceed odds, item base stats, boss stats, and the crit/defense constants. Re-run the decode audit and confirm the failure count drops.
2. **Write the regeneration script outside the repo's data**, e.g. `app/aion2c/data/tools/client_export_to_gamedata.py`, reading the export path from an env var `AION2_EXPORT_DIR` (default none; fail with a clear message) and writing only derived, schema-compliant JSON. Never copy raw tables in. Add the export path pattern to `.gitignore` as a guard, and add a test that fails if any file under the repo exceeds a size threshold with a `Properties.Data` key.
3. **Skill damage pass (works today, all 8 classes).** Build the skill-id to group map (name-number rule first, value-sequence match as a cross-check against the current files, `SkillEffect` once decoded). Regenerate `atk_ratio_pct`, `ranks[].flat_*`, `hits`, per-charge tiers, max rank from `SkillEffectLv`. Gate on the current file: Sorcerer 26/26, Gladiator 33/33, Cleric 17/17 must reproduce exactly; list the rest as unmapped, do not guess.
4. **Fix the known engine mismatches**: Hellfire per-tier ratio/hits and `SkillCharge` timing, the zero-ratio Spiritmaster, Ranger and Chanter skills, Fire Wall and Cold Storm DoT ticks (110% + flat 738..2059; 80% + flat 537..1497).
5. **Buff, passive and proc pass** from `SkillAbnormalEffectLv` (stat shape and proc shape), plus specializations from `SpecializedSkillParts` and `SpecializedSkillSlot` (8/12/20), plus `SkillCond` for requirements.
6. **Daevanion pass**: regenerate from `DaevanionNode` for all 8 classes (Sorcerer already matches exactly; this is a cheap regression test for the script).
7. **After step 1 only**: cooldown, MP, cast, range, unlock level, stigma level and slots, enchant success table, exceed, item base stats and `items.json` sourcing, boss stats, damage-formula constants (crit cap/base, defense factor, penetration). Replace the community-fit formula only if `StatCorrectionNumber` / `GlobalSetting` actually contain these.
8. Keep `confidence` and `source` strings per value (`client export <date>`), so provenance stays visible and the old "estimated" flags can be retired field by field.

## 5. Caveats

- Region and build of this export are not stated. Rank tables are 40/25 deep (KR-style); global rank cap 20 is not in decoded data.
- Group-to-skill matching by name number is a convention, not a stored link; the passive naming is not arithmetic.
- `[21..24]` in damage rows and the AB02 variant meanings are unidentified.
- Rank-1 values are missing from every decoded level table.
- `Exp.json` and any table not spot-checked may be misdecoded; check a known value before relying on a table.
