# Stats, formula constants, class base stats and gear: client extract (2026-10-04)

Read-only comparison of the private client export (`<private export root>\out\AION2\Content\Data\Table\`, never copied into this repo) against `app/aion2c/engine/damage.py`, `models.py`, `gear.py`, `data/items.json`, `data/build_items.py`. Only derived numbers and small samples are written here. Machine-readable results live outside the repo in `D:\Aion2-tools\derived\`: `formula_constants.json`, `class_base_stats.json`, `items_check.json`, `enchant_tables.json`.

## 0. Correction to the earlier recon

`research/client_tables_recon_2026-10-04.md` section 0 lists `Item`, `Enchant`, `ExceedEnchant`, `StatCorrectionNumber`, `GlobalSetting`, `PcData`, `Skill*` and `NpcData` as undecoded. The export was re-decoded afterwards (`decode-audit.json`: 2390 successes, 0 failures) and all of them load now: `Item` 9245 rows, `Enchant` 23181, `ExceedEnchant` 13920, `StatCorrectionNumber` 540, `GlobalSetting` 1 row with 1059 keys, `NpcData` 13493, `Exp` 100 (no longer garbage). This note uses the decoded tables.

## 1. Damage-formula constants (goal 1)

**Headline: the client holds no damage-formula curves.** No table maps rating to percent, defense to reduction, level difference to damage, or PvE/PvP to a base multiplier. What it does hold: stat meanings and hard caps in the English UI strings (`L10N\en-US`, keys `String_UI_desc_<Stat>_body`), per-stat clamps and a percent-or-flat flag in `StatCorrectionNumber` (`DivideNumber` 1 = percent stat shown as raw/100; `StatUnit` 100 for FP-type stats), and a few flags in `GlobalSetting`. Searched: `GlobalSetting`, `StatCorrectionNumber`, `ResourceStatCorrectionNumber`, `PcStatLevel`, `PcStatSecond`, `AdditionalHit`, `NpcData`, the weapon fields of `Item`, and every decoded table by key name (correct, formula, coef, gap, diff, rate, ratio, cap, limit, pierce, accuracy, evasion). Full list in `formula_constants.json`.

### Engine constant vs client

| Constant (where) | Engine | Client | Verdict | Evidence |
|---|---|---|---|---|
| Crit chance cap (`damage.py CRIT_CHANCE_CAP_PCT`) | 80% | 50% | **DISAGREE** | `UI_desc_Critical`, `PhysicCritical`, `MagicCritical`: "Max Critical Hit Rate is 50%, and this is reduced by target's Critical Hit Resist". Settles the 80% vs 50% conflict in `data_contract.md` 4.2 for this client (UI text, not a table value) |
| Cooldown reduction cap (`simulator.py`, none) | none | 60% | **DISAGREE** | `UI_desc_CoolTimeIncrease`: "Cooldown reduction is capped at 60%"; `StatCorrectionNumber.CoolTimeIncrease` min -6000 (-60%). Text and table agree |
| Base crit damage (`Stats.crit_dmg_pct` 50) | +50% | 150% multiplier | **AGREE** (inferred) | `Item.WeaponCriAddRate` = 15000 on every weapon of all 8 classes. The field name is an interpretation |
| Smite = "Double" | same stat | `HardHit` shown as "Double Chance" | **AGREE** (naming) | clears "unverified" in `data_contract.md`; Wisdom [Lumiel] points raise it |
| `SMITE_BONUS` 1.0 (x2) | +100% | "greatly increased Damage based on Final Damage" | not found | multiplier not in client |
| `BOSS_SMITE_FACTOR` 0.7, `BOSS_CRIT_FACTOR` 0.75 | community fits | boss Double Resist, Critical Damage Defense, Damage Tolerance | not found | boss stats are server-side (section 4) |
| `DEFENSE_FACTOR` 0.1 per defense point | community fit | none | not found | structure agrees: Penetration "Defense does not fall below 0" matches `max(0, defense - penetration)` |
| `CRIT_RATING_PER_PCT` 100 (`gear.py`) | 100 rating = 1% | none | not found | only the rating clamp [-5000, 20000] and the 50% cap. A full endgame kit is about 130 sub-line + 150 weapon rating, so /100 gives only 1.5-3% crit, which looks low |
| `CRIT_DMG_PER_PCT` 100 (CriticalAddDamage /100 = crit damage %) | percent | **flat** | **DISAGREE** (semantic) | `CriticalAddDamage` has DivideNumber 0 (percent stats have 1); armory fixture shows title "Critical Attack +30" with no %; text "Increases Damage when a Critical Hit occurs, affected by Critical Damage Defense". The percent crit stat is `AmplifyCriticalDamage` (D1) |
| Deity point value (`DEITY_PCT_PER_POINT` 0.1) | 0.1 | 0.1 | **AGREE** | `PcStatSecond`, all 1000 rows linear (section 2) |
| Combat speed | one stat for attack and spell speed | `CombatSpeed`: "Increases Attack Speed and Spell Action Speed" | **AGREE** | clamp -50%..+200%, no cap text |
| Cast time floor | none | `GlobalSetting.skill_casting_time_min` 500, `skill_cancel_time_min` 100 (ms) | found, unused | meaning assumed |
| Boss damage form (`boss_dmg_pct`) | percent | `BossNpcAddDamage` and `PvEAddDamage` are flat (D0); `PvEAmplifyDamage` is percent (D1) | partial | engine fills `boss_dmg_pct` only from user input, so no wrong mapping today; do not map BossNpcAddDamage onto it |
| Endurance (data_contract) | not modelled | "Reduces Damage by half" | AGREE | defensive |
| MP regen, MP cost, MPMax | placeholders (2000, 20) | no base value, no regen interval | not found | MP cost reduction cap 60% (`UI_desc_MPUseIncrease`) |
| Accuracy, evasion, block | not modelled | Evasion cap 30%, immunity cap 50%, Move Speed cap 150% (text) | n/a | accuracy "offset by target's Evasion and Block"; rating curves not in client |
| PvE/PvP multiplier, level-difference modifier | none | none | not found | only `rift_levelgap_protect` 5, `pc_world_level_scale_level` 45, `max_level` 45 (agrees with `level_caps.global`) |
| Multi-hit (`AdditionalHitRate`, up to 4 extra hits) | ignored | `AdditionalHit` table: `HitRateList` [2000, 5000, 5000, 5000], `DamageRateList` [1000 x4], identical for all weapons | found, unused | reading of the lists unconfirmed; kit total about 1.6% chance, low impact |

Other stat facts from the client text: Perfect = extra damage scaling with weapon Max Attack; `AmplifyAllDamage` and `AmplifyWeaponDamage` are reduced by the target's Damage Tolerance; Penetration exists as flat (`DefensePierce`) and rate (`IgnoreDefense`, 0-100%) with PvE/PvP variants; back/front attack angle 135 deg; `FixingDamage` is "Attack Bonus", the class base that `data_contract.md` 4.1 calls `attack_bonus`.

## 2. Class base stats and stat-point effects (goal 2)

`PcStatLevel` (900 rows, levels 1-100) has three stats and is **identical for all 9 classes** (Gladiator, Templar, Ranger, Assassin, Elementalist = Spiritmaster, Sorcerer, Cleric, Chanter, Fighter).

| Level | FixingDamage (Attack Bonus) | Defense | HPMax |
|---|---|---|---|
| 1 | 6 | 10 | 100 |
| 20 | 30 | 200 | 2040 |
| 30 | 42 | 300 | 3090 |
| 40 | 55 | 400 | 4160 |
| 45 (global cap) | 61 | 450 | 4702 |
| 50 (KR cap) | 67 | 500 | 5250 |

No class-specific base MP, MP regen, crit, accuracy or speed exists in the client. The engine uses no per-level base: `Stats()` defaults (attack 1000, max_mp 2000, mp_regen 20) are placeholders and `BASELINE_L45_STATS` carries percentages only. Class base attack is 61 at level 45, small next to gear (a Unique IL102 weapon is about 525 mid-roll).

`Exp` (now decodes): level 45 has BonusSkillPoint 203 and BonusStigmaPoint 29 (running totals, flat after 45), BonusStatPoint 0 at every level, StigmaSkillContextSlotMax 4.

`PcStatSecond` (1000 rows, points 1..1000) is exactly linear: raw 10 per point, shown as raw/100, so **1 point = 0.1%** (-0.1% for Cooldown and MP Cost). The armory fixture matches (Might 14 = +1.4%, Death 28 = +2.8%, Justice 37 = Perfect +3.7%, Time 38 = Combat Speed +3.8%).

| Source | Effect per point | Engine |
|---|---|---|
| STR (Might) | Attack increase | agree |
| Destruction | Attack increase, Perfect Resist | agree |
| Death | Critical Hit increase, Regeneration Penetration | agree as additive; the client calls it a multiplier on Critical Hit (unverified) |
| Time | Combat Speed, Double Resist | agree |
| Illusion | Cooldown -0.1%, Endurance Penetration | agree (60% cap missing) |
| AGI (Precision) | Accuracy increase and **Critical Hit increase** | **missing** (AGI ignored; 1507 item lines carry it) |
| Wisdom [Lumiel] | MP Cost -0.1%, **Double (smite) chance +0.1%** | **missing** |
| Justice | Defense, Perfect | missing (Perfect not modelled) |
| INT, DEX, CON, WIS, Freedom, Life, Destiny, Space | status chance and resist, evasion, block, HP, MP, move speed | not DPS |

INT gives only status-effect chance here (no spell damage); STR is the one Attack stat for every class.

## 3. Items (goal 3)

### 3.1 Item.json fields used

`ID.Value` (same id as ours), `Desc.Key` -> L10N `String_<key>_body` (name), `ItemType` (Equip 3555), `ItemGrade` (client **Legend = our Epic**; Unique, Rare, Common same), `ItemLevel` (our `il`), `PermitLevelMin` (our `equip_level`), `EquipCategory` (slot and, for weapons, class: Greatsword Gladiator, Sword Templar, Dagger Assassin, Bow Ranger, Magicbook Sorcerer, Orb Spiritmaster, Mace Cleric, Staff Chanter; Guarder, armor, jewelry are class-free in the client too), `MainStats[]` (`WeaponMinDamage`/`WeaponDamage` = our `min`/`v` of WeaponFixingDamage), `SubStats[]` (`MinValue`, `MaxValue`, `RandomWeight`, `ValueWeight`), `SoulbindRandomStat` + `SoulbindRandomStatCount` (our `sub_random` and `sub_count`; non-random items list their fixed lines in `SubStats` with weight 0 and min = max), `MagicStoneSlotCount`, `GodStoneSlotCount`, `SetNames`, `EnchantGroup` -> `Enchant`, `EnchantEffectGroup` -> `EnchantEffect`, `ExceedEnchantGroup` -> `ExceedEnchant` + `AdditionalStat`, `SurpassGroup` -> `ItemSurpass`, `WeaponCriAddRate`, `WeaponAccuracy` in main stats. Values are scaled with `StatCorrectionNumber` (percent stats raw/100, FPMax raw/100).

### 3.2 Whole-table comparison

All 3356 items in `items.json` joined to `Item.json` on id and compared on name, slot, grade, il, equip_level, class_lock, max_enchant (both the `Enchant` row count and the `EnchantEffect` max level), max_exceed, mana_slots, god_slots, sub_random, sub_count, set, every main stat value and min, every main stat enchant slope (= `EnchantEffect` value at max level / max level), and the sub-stat pool (stat ids, min, max).

**Result: 0 of 3356 items differ in any field.** Residual differences are only display rounding: percent lines are rounded to 0.1 by the endpoint (client gives hundredths, e.g. 4.25 vs ours 4.3), FPMax is an integer display (max diff 0.49), and a main stat `Block` of 0 on Bow, Magicbook and Orb is omitted by the endpoint. This confirms `items.json` is the client's data; the endpoint scrape could be replaced by the export.

Client has 199 more Equip items than ours (3555 vs 3356): 136 Common armor and jewelry, 18 Common weapons, 2 Unique Guarders, 2 Gauntlet (Fighter), 1 Rune (PvE Damage Boost main stats, +10 with 80%..10% odds), 40 Arcana pieces (main stat = one Daevanion point stat such as Time or Death).

### 3.3 Sample of 20 (field-by-field, stratified over weapons, offhand, armor, accessories, grades)

All 14 fields match for all 20; last column is the largest sub-pool difference (rounding only).

| id | name | category, grade | IL / equip lvl | max enchant / exceed | main stat ours vs client, slope ours vs client | random lines of pool | max pool diff |
|---|---|---|---|---|---|---|---|
| 110130015 | True Dragon Lord Greatsword | Greatsword Unique | 62 / 45 | +15 / 1 | WeaponFixingDamage 365/269 vs 365/269; slope 7 vs 7 | 5 of 16 | 0.04 |
| 110540006 | Relic Collector Spellbook | Magicbook Epic | 23 / 20 | +10 / 0 | WeaponFixingDamage 114/103 vs 114/103; slope 2.6 vs 2.6 | 3 of 16 | 0.05 |
| 110450055 | Chaos Bow | Bow Rare | 20 / 20 | +5 / 0 | WeaponFixingDamage 97/77 vs 97/77; slope 2.2 vs 2.2 | 2 of 16 | 0.05 |
| 110860021 | Shade Staff | Staff Common | 13 / 13 | +5 / 0 | WeaponFixingDamage 68/50 vs 68/50; slope 1.4 vs 1.4 | 1 of 16 | 0.04 |
| 110340039 | Discipline Dagger | Dagger Epic | 38 / 35 | +10 / 0 | WeaponFixingDamage 173/134 vs 173/134; slope 4.3 vs 4.3 | 3 of 16 | 0.04 |
| 110730021 | Splendent Star Dragon Lord Mace | Mace Unique | 70 / 45 | +15 / 1 | WeaponFixingDamage 323/251 vs 323/251; slope 7.933 vs 7.933 | 5 of 16 | 0.04 |
| 115040048 | Black Claw Guard | Guarder Epic | 45 / 45 | +10 / 0 | WeaponFixingDamage 92 vs 92; slope 5.1 vs 5.1 | 3 of 16 | 0.05 |
| 210140035 | Liberator Breastplate | Torso Epic | 38 / 1 | +10 / 0 | ArmorDefense 277 vs 277; slope 10.9 vs 10.9 | fixed 3 lines | 0.0 |
| 210330022 | Splendent Dark Dragon Lord Helm | Helmet Unique | 86 / 45 | +15 / 3 | ArmorDefense 477 vs 477; slope 25 vs 25 | 5 of 24 | 0.05 |
| 210650087 | Luminous Boots | Boots Rare | 25 / 25 | +5 / 0 | ArmorDefense 120 vs 120; slope 7.2 vs 7.2 | 2 of 24 | 0.05 |
| 210760023 | Orichalcum Cloak | Cape Common | 16 / 16 | +5 / 0 | ArmorDefense 75 vs 75; slope 4.4 vs 4.4 | 1 of 24 | 0.05 |
| 210540071 | Demiros Gloves | Gloves Epic | 40 / 37 | +10 / 0 | ArmorDefense 195 vs 195; slope 11.5 vs 11.5 | 3 of 24 | 0.04 |
| 210230091 | Abyssal Greaves | Pants Unique | 86 / 45 | +15 / 5 | ArmorDefense 531 vs 531; slope 25 vs 25 | 4 of 24 | 0.05 |
| 210450027 | Wind Breeze Pauldrons | Shoulder Rare | 26 / 1 | +5 / 0 | ArmorDefense 140 vs 140; slope 7.4 vs 7.4 | fixed 2 lines | 0.0 |
| 310130023 | Wise Dragon Lord Necklace | Necklace Unique | 94 / 45 | +15 / 5 | WeaponFixingDamage 145 vs 145; slope 5.267 vs 5.267 | 5 of 16 | 0.04 |
| 310240015 | Artisan's Diamond Earrings | Earring Epic | 39 / 36 | +10 / 0 | WeaponFixingDamage 50 vs 50; slope 2.2 vs 2.2 | 3 of 16 | 0.07 |
| 310350010 | Splendent Sapphire Ring | Ring Rare | 22 / 16 | +5 / 0 | WeaponFixingDamage 22 vs 22; slope 1.2 vs 1.2 | 2 of 15 | 0.09 |
| 310430047 | Ascension Bracelet | Bracelet Unique | 51 / 1 | +15 / 0 | WeaponFixingDamage 65 vs 65; slope 2.867 vs 2.867 | fixed 4 lines | 0.0 |
| 311040001 | Revelation Amulet | Amulet Epic | 36 / 1 | +10 / 0 | AmplifyWeaponDamage 7.5 vs 7.5; slope 0 vs 0 | none | 0 |
| 215240001 | Noble Belt | Belt Epic | 36 / 1 | +10 / 0 | ArmorDefense 200 vs 200; slope 30 vs 30 | none | 0 |

The check can fail: an earlier version of the comparison flagged the 450 weapons without Block and the fixed-line items, both of which were comparison bugs and are fixed; the final run exercises the same code path on all items.

### 3.4 What the client has that `items.json` drops

- **Sub-stat draw weights.** Every `SubStats` line has `RandomWeight` (2000-10000) and `ValueWeight`. `gear.py item_lines` expects `n * pool_mean / n_lines` (uniform). Rare lines are the good ones (Damage Boost 2000, Combat Speed 4000, STR 6000 vs Critical 7000, Critical Attack 8000, regen 10000). Reading RandomWeight as a draw weight without replacement (unconfirmed in game), the expected sub-line totals of a best-Unique Sorcerer kit (weapon, 7 armor, necklace, 2 earrings, 2 rings, 2 bracelets) are:

| Stat (sub lines only) | Weighted | Engine (uniform) |
|---|---|---|
| STR | 11.7 | 24.1 |
| AGI | 12.5 | 24.1 |
| Damage Boost % | 1.39 | 2.55 |
| Weapon Damage Boost % | 1.11 | 1.68 |
| Combat Speed % | 3.0 | 4.9 |
| Perfect % | 1.15 | 3.66 |
| Critical rating | 132.5 | 123.1 |
| Critical Attack (flat) | 21.9 | 17.3 |

  Net DPS effect is a few percent, but sub-stat advice is biased toward the rare lines.
- **Ignored stat lines** (counts are item lines in `items.json`): DamageRatio 678 (= Attack increase %, 1:1 with `attack_increase_pct`, kit total only about 0.4%), AGI 1507, AdditionalHitRate 1216, Perfect 906, HardHit (Double) 678, AmplifyCriticalDamage 226, BackAttackDamage 1222 (flat, zero for Sorcerer per data_contract), DefensePierce 6 (amulets), WeaponAccuracy 4485, SealStoneAddDamage 4. `_FLAT` in `gear.py` covers 11 ids.
- Block and Parry fields, Surpass and Exceed groups, enchant odds and costs (below).

### 3.5 Enchant, Exceed, Surpass (`enchant_tables.json`)

**Enchant success (`Enchant`, odds out of 10000, last row 0):**

| Grade profile (our grade) | Max | Success | Notes |
|---|---|---|---|
| Common, Rare | +5 | 100% every step | 27 groups, 1021 equip items |
| Legend (= Epic) | +10 | 100% every step | 25 groups, 1335 items |
| Unique | +15 | +0..+9 100%; +10 65%, +11 50%, +12 35%, +13 25%, +14 20% | FailCorrectionProb 5% each, FailPenalty 0 on every gear group |
| Rune (1 item) | +10 | 80, 66, 50, 33, 25, 20, 15, 12, 10% | FailPenalty -1 (only group with a penalty value) |

Cost per step is `CostGold` plus `CoinEnchant` (Unique IL102: +0 12,800 gold / 510 coin; +14 1.86M gold / 14,820 coin). Reading FailCorrectionProb as +5% per prior failure, cumulative (unconfirmed), the expected +10 to +15 on a Unique IL102 is about 12.2 attempts, 14.1M gold, 154k coin (15.4 attempts, 18.8M gold, 197k coin with no pity).

**EnchantEffect (stat per level)**: Unique IL102 weapon adds 11, 22, 33, 44, 55, 66, 78, 90, 102, 114, 126, 138, 150, 162, 174 to both Min and Max attack; torso 29..445 ArmorDefense and 24..360 HP; ring 5..86 attack. Engine uses slope = value(max)/max per level. The real series is slightly convex: mean deviation 2.4% of the max-level value, worst 17% on a +5 Common weapon (1.2 attack). The max-level value is exact, so this only matters for planning mid-level steps.

**Exceed (`ExceedEnchant` + `AdditionalStat`), not modelled by the engine.** `max_exceed` is 1, 3 or 5 (198, 220, 260 of our items, all matching the client). Per level the stat set replaces the previous one (it is not cumulative). Unique IL102 weapon: 14, 28, 43, 58, 73 attack and +1%..+5% Damage Boost; each necklace, earring, ring: 7..36 attack, 14..73 ArmorDefense and +0.5%..+2.5% Damage Boost; armor: ArmorDefense, HP, Damage Reduction, Max HP %. Success 66, 50, 33, 25, 20% with 5, 4, 3, 2, 1% fail correction, 6 to 20 `Enchant_Amplify_A_s_02a_f` and 0.6M to 3M gold per step (expected 0 to +5: 13.8-15.6 attempts, 26-30M gold, 196-223 amplify stones, with and without the assumed pity). **A fully exceeded IL102 weapon plus necklace, 2 earrings, 2 rings gives +253 attack and +17.5% Damage Boost**, which dwarfs the roughly 1.4% Damage Boost from random sub lines. `AmplifyAllDamage` maps 1:1 onto `Stats.dmg_boost_pct` and `WeaponFixingDamage` onto `attack`.

**Surpass (`ItemSurpass`)**: items reference only the four `G_Surpass_Unique_Abyss_*` groups, which add `PvPAmplifyDamage` (+0.5% per level, max +2%): no PvE DPS. `Surpass_Unique_Tier1_*` (PvE +0.6% per level) exists in the table but no item uses it.

## 4. Server-side only (goal 4)

Not in the client in any decoded table:
- Monster and boss HP, defense, evasion, Double Resist, Critical Resist, Damage Tolerance. `NpcData` holds Level, NpcType, NpcSubType, CreatureType (Intellect, Feral, ... for the race-attack stats) and flags only; no row in any table has monster stats.
- Rating-to-percent conversions (Critical, Accuracy, Evasion, Block, Perfect, Double). Critical max 50% and Evasion max 30% are UI text only.
- Multipliers of Double and Perfect, exact Multi-hit behaviour, level-difference modifier, PvE and PvP base multipliers, the order stats combine in.
- MP regen interval and base MP; HP and MP regen formulas.
- Roll distribution inside an item's [min, max] (only the range and weights are stored).
- Enchant `FailCorrectionProb` meaning and any hidden pity counter.

Because the formula curves are server-side, community fits in `damage.py` stay the only source for defense, boss factors and the rating conversions. Only caps, base crit and stat semantics can be settled from the client.

## 5. Prioritized engine changes

1. **Crit cap 50%, not 80%** (`damage.py CRIT_CHANCE_CAP_PCT`). One constant; changes every build above 50% crit. Make it a named constant with source "client UI text". The 1,200-point gap form from the community docs is not in the client, so keep the cap flat.
2. **Model Exceed.** Add per-level exceed stats to `items.json` (small table: group -> level -> attack, Damage Boost) and an `exceed` level per equipped item. Biggest gear lever missing: up to +253 attack and +17.5% Damage Boost on an IL102 kit. `gear.py` upgrade paths should offer exceed steps with the success rates and costs above.
3. **Cooldown reduction cap 60%** in `simulator.py` (`min(60, cdr_pct)`); also cap the Illusion/Daevanion/gear sum and surface the cap in the UI.
4. **Store `RandomWeight` per pool line and use weighted expectation** in `item_lines` (exact for up to 5 draws by enumeration, or by inclusion probability). Stops over-counting STR, Damage Boost, Combat Speed and Perfect by 1.6x to 3.3x. Note the unconfirmed draw reading.
5. **Retire the endpoint scrape as source of truth.** `items.json` already equals the client on all 3356 items and 14 fields; regenerate from the export (`client_export.py`) with `RandomWeight`, exceed stats and the 199 missing items (Rune, Arcana, Guarders), keeping provenance strings.
6. **Fix the Critical Attack semantic**: stop converting `CriticalAddDamage` to percent crit damage (`CRIT_DMG_PER_PCT`). Treat it as a flat add on crit hits (or drop it; kit total is about 22, negligible against hits of thousands) and map the percent stat `AmplifyCriticalDamage` to `crit_dmg_pct` 1:1 (226 lines, about 1.9% on a kit).
7. **Map the cheap missing stat ids**: `DamageRatio` -> `attack_increase_pct` 1:1; AGI -> crit at 0.1 per point; Wisdom -> `smite_pct` 0.1 per point; add `Double` (HardHit) lines from gear to `smite_pct`. Each is under 1% on a kit but the code is one line each in `_FLAT`.
8. **Verify the crit rating conversion in game.** `CRIT_RATING_PER_PCT` 100 gives 1.5-3% crit from a full kit, which does not look right against a 50% cap and a 20000 rating clamp; this is a server-side curve the client cannot answer. Also check whether Death/AGI "Critical Hit increase" is additive percentage points (engine) or a multiplier on the rating-derived chance (client wording).
9. **Replace the enchant linear fit with the per-level series** (15 numbers per group; deduplicated groups are few) if intermediate enchant levels matter to the planner; max level is already exact.
10. **Low value, defer**: Perfect and Multi-hit modelling (about 1-2% each on a kit, semantics unconfirmed), accuracy and evasion (no boss evasion in client), cast-time floor 500 ms, PvE/PvP `Surpass`, enchant success and cost planner (data is ready in `enchant_tables.json`).
11. **Do not change**: `DEITY_PCT_PER_POINT` 0.1, base crit damage 50, the combat speed handling, `max_enchant`, `max_exceed`, slots, class locks, equip levels, main stat values: all verified against the client.
