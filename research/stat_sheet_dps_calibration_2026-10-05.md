# Stat sheet vs the damage engine: what is ignored and how to calibrate (2026-10-05)

Scope: read-only comparison of the new stat sheet (`app/aion2c/statsheet.py`, `webapi.stat_sheet`) with what `engine/damage.py`, `models.Stats` and the character page actually feed the simulator. **No DPS math was changed.** Every DPS number below comes from running the existing engine with different `Stats` values in a scratch script (DarthThot, Sorcerer 44, boss playstyle); the scripts are not committed. The sheet itself is a reconstruction (random sub lines at expected value, no magic/god stones, no pantheon), so its inputs carry that error too; see section 5.

## 1. Where "20k on the site vs 7k in game" comes from

The 21,190 headline is **not** the engine's number for the character as played. It is the optimizer's *plan* (stigmas, ranks and Daevanion re-chosen) computed with a placeholder attack. Same engine, same character, step by step:

| Step | Boss DPS | What changed |
|---|---|---|
| Site headline (`compare`, "Boss DPS plan") | 21,190 | plan, `Stats.attack` = 1000 placeholder |
| Same stats, the build as imported (heuristic priority; this is `max_potential.current_dps`) | 8,769 | current skill ranks and stigmas instead of the plan |
| Plan with sheet inputs (attack 553, Amp Ratio, weapon boost, penetration) | 16,169 | `attack` from the sheet instead of 1000 |
| Imported build with sheet inputs | 8,103 (6,570 with the priority list frozen from the placeholder run) | priority search is sensitive, see 3.7 |
| Imported build, sheet inputs, + Attack Bonus 87 added to attack | 8,699 (7,050 frozen priority) | |
| Imported build, real MP pool 978 instead of 2000 (nothing else) | 7,562 | mana gating, see 3.5 |
| Imported build, MP 978 and regen 10/s instead of 20/s | 7,418 | regen units unknown |

Reading: roughly **2.4x of the gap is plan versus current build** (21.2k vs 8.8k, same inputs), not a formula error. The rest is input quality: the character page never sets `attack` (it keeps 1000 while the sheet says the weapon range midpoint is 553 before Amp Ratio), `max_mp` stays 2000 against a real 978, and no target-side stat exists. After those three the as-played number lands between 6.6k and 8.7k, which brackets the ~7k seen in game. That is a plausibility check, not a calibration: the priority list changes the answer by 1.5k, and boss defense, Damage Tolerance, accuracy and Perfect are still unmodelled (all of which lower the number).

Suggested UI consequence (cheap, no math): show "Current build as imported" next to the plan DPS on the character page, so the 2.4x is visible instead of read as an error.

## 2. What the sheet computes for DarthThot, and who consumes it

Sheet value (calibrated to the armory attribute totals) and what the engine does with that stat today.

| Sheet stat | Value | Engine today |
|---|---|---|
| Attack (flat Attack lines, accessories and sub lines) | 320.5 | `Stats.attack`: character page keeps the 1000 default (armory import: "Attack ... not in the public armory; keep your entered values"). Gear adds the weapon midpoint only inside `gear_upgrades` deltas, which assume `build.stats` already contains the gear |
| Max / Min Attack (range, before Amp Ratio) | 562.5 / 542.5 | single `attack`; no min/max roll. Midpoint is the natural input |
| Attack Bonus (`FixingDamage`) | 87 = level-44 base 60 + Daevanion 27 (wings add none here; other wings add 10) | only the Daevanion share is added to `attack` (STAT_MAP "Attack Bonus"); the level base and wing share are ignored; whether skill ratios multiply this stat is unknown |
| Amp Ratio "Attack increase" (`DamageRatio`) | 1.64% | `attack_increase_pct` is filled from the armory text (STR and Destruction only, 1.6). Item `DamageRatio` lines (678 items) are not mapped |
| Weapon Damage Boost | 5.0% | `weapon_dmg_pct`, but only via gear deltas; 0 on the page |
| Damage Boost | 0% (Cleric fixture 3.3%) | `dmg_boost_pct`: Daevanion and gear deltas; 0 on the page |
| Critical Damage Boost | 0% (Cleric 3.0%) | `crit_dmg_pct` (base 50 + lines) |
| Critical Hit rating / Critical Hit increase | 202.4 / 2.8% | rating conversion `CRIT_RATING_PER_PCT` 100 is a guess; the 2.8% **ratio** is added as 2.8 percentage points to `crit_chance_pct`. The client wording is that the ratio multiplies the rating, so the engine treats it differently from the game (see 3.2) |
| Critical Attack (flat) | 30 | ignored (gear.py note) |
| Penetration | 420 | `penetration`, subtracted from `target_defense`, which defaults to 0 so it does nothing |
| Penetration Rate (`IgnoreDefense`) | 0% | not modelled |
| Perfect Chance | 3.7% | ignored (extra damage scaling with Max Attack; multiplier unknown) |
| Multi-hit Chance | 0% (Cleric 5.5%) | ignored (`AdditionalHit` table found, reading unconfirmed) |
| Double Chance (smite) | 0.14% | `smite_pct` from the armory text (0.1) |
| Combat Speed | 6.95% | `combat_speed_pct` from the armory text: 3.8. Gear, wings and Daevanion add the rest only in the plan path |
| Cooldown Reduction / Cooldown | 3.0% / -0.1% (total 3.1%) | `cdr_pct` 0.1 from the text; Daevanion 3% is added in the plan path. Three cooldown stats exist, one engine field |
| Boss Attack, Boss Defense, PvE Attack, PvE Damage Boost, Boss Damage Boost | all 0 for DarthThot (Cleric: PvE Attack 4, PvE Damage Boost 3.5%) | `pve_dmg_pct` and `boss_dmg_pct` are user inputs only; `BossNpcAddDamage` and `PvEAddDamage` are **flat** in the client and have no engine slot; `BossNpcDefense` has no slot |
| Back Attack (flat) | 14 | ignored (zero for casters per data_contract) |
| Damage Tolerance, Weapon Damage Tolerance, Critical Damage Defense, Critical Damage Tolerance | 0 / 0.15% / 26 / 1.5% | these are the *defender's* stats; the engine has no target side beyond `target_defense` |
| Accuracy / Accuracy Bonus | 185 / 25 | ignored; a hit-chance cap against boss evasion is possible and unmeasured |
| HP / MP / MP regen | 7,316 / 978 / 80 | `max_mp` 2000 and `mp_regen_per_s` 20 are placeholders; MP gates casts in the simulator |
| Defense, Evasion, Block, Immunity | n/a | defensive; irrelevant to DPS |

Sheet stats the engine could consume but that no field exists for: Attack Bonus as its own term, Amp Ratio lines other than attack, flat PvE and Boss Attack, Perfect, Multi-hit, Critical Attack, boss and target defense, accuracy.

## 3. Calibration plan (ordered by expected effect and certainty)

Method rule: the damage formula and rating curves are server side (ADR 0001: only caps, base crit and stat semantics are in the client). Everything below that needs a curve must be fitted from in-game measurement, not from the export.

**3.1 Feed the sheet to the engine (certain, no new formula).** Add one adapter `sheet_to_stats(sheet) -> Stats` used by the character page and by `gear.base_stats`: `attack` = midpoint of pre-ratio Max/Min Attack, `attack_increase_pct` = Amp Ratio DamageRatio, `weapon_dmg_pct`, `dmg_boost_pct`, `crit_dmg_pct`, `penetration`, `combat_speed_pct` and `cdr_pct` (= sheet total, capped 60), `max_mp`. Effect on DarthThot: placeholder 1000 becomes 553, as-imported DPS 8.8k to about 6.6-8.1k. Removes the largest unforced error. Needs a decision on Attack Bonus first (3.3). Keep `Stats` defaults for unit tests.

**3.2 Critical Hit (largest unknown among real stats).** Two separate problems: (a) rating to chance curve (server side; engine guesses 100 rating = 1%, the sheet shows only 202 rating on this character so chance is small either way); (b) "Critical Hit increase" is an Amp Ratio that scales the **rating** (`criticalratio` to `critical`), not +N percentage points. Measure: record crit rate over 300+ hits on a dummy at three rating values (equip/unequip a crit accessory) to fit the curve, then replace `crit_chance_pct` with `curve(rating * (1 + ratio))`, capped 50%. Until measured, stop adding the ratio as points (it overstates by up to 2.8 points at low crit).

**3.3 Attack Bonus and the Attack input.** Test: one unbuffed basic attack on a training dummy, read the hit; swap a weapon with known range and note whether hits stay inside [Min, Max] and whether adding Attack Bonus (wings 10, Daevanion 16) shifts the average by that flat amount or by ratio times it. Decides whether `FixingDamage` is added to attack (+7% DPS in the probe, which also counts the 27 Daevanion points the engine already adds itself) or only scaled.

**3.4 Flat PvE and Boss Attack, Perfect, Multi-hit, Critical Attack.** All are small on this character (sums under 5% of a hit) except where gear carries them: Cleric 45 has PvE Attack 4 and PvE Damage Boost 3.5%, Multi-hit 5.5%. Add them as separate multiplier terms behind named constants; measure each by toggling one item. Do this after 3.1 to 3.3.

**3.5 MP pool and regen (cheap, measurable now).** MP 978 versus the 2000 placeholder moves the as-imported DPS 8,769 to 7,562, and halving regen (20 to 10 per second) costs a further 144 at the 978 pool (1,650 at the 2000 placeholder). Read the real regen by watching the MP bar out of combat and in combat for 30 s, then set the unit of `MPRegen` (sheet shows 80 "Natural MP Regen"; the interval is not in the client).

**3.6 Target side (boss defense, Damage Tolerance, level gap).** The only knob today is `target_defense`; with Penetration 420 the probe shows no effect until defense exceeds 420 (target_defense 1000 / 2000 / 4000 costs 2.5% / 6.9% / 15.6% in the probe). Measure the boss: same attack at two Penetration values (a title swap gives +210) and read the damage change; the ratio gives boss defense without needing the formula. Damage Tolerance: the defender's percent; fit `1 - tolerance` from a boss with known tolerance only if one exists; otherwise fold into one fitted `boss_mitigation` constant and say so.

**3.7 Fix a model artefact found on the way.** With the priority list frozen, DPS is **not monotonic in combat speed**: 8,722 / 8,769 / 8,123 / 8,250 / 8,085 / 9,451 at +0 / 3.8 / 8 / 13.8 / 23.8 / 40. More speed should never cost DPS. Likely the fixed priority interacts with cooldown timing and MP gating (a faster cast burns MP sooner). Re-run the priority search per Stats value in `_Scorer` (it currently freezes one) or report the number as a range. This also explains why the sheet-input runs above swing between 6.6k and 8.1k.

**3.8 Validate.** Pick three characters (DarthThot, Cleric, Chanter; fixtures in `app/tests/fixtures`) and record 3 in-game boss-dummy DPS numbers each with the same rotation; compare engine output after each step in 3.1 to 3.6. Accept a step only if the error to the measured number shrinks on all three. Today there is one data point (7k, DarthThot); do not fit constants to it alone.

## 4. Order of work

1. 3.1 adapter plus "current build" DPS next to the plan (no formula, removes ~2.4x of reading error).
2. 3.5 MP pool (measure regen), 3.7 priority per Stats.
3. 3.3, 3.2 measurements on a dummy, then constants.
4. 3.4 and 3.6 once measured.

## 5. Limits of this comparison

- The sheet is not game-reported. Attributes and deity points are the only values the armory prints; for DarthThot, Cleric 45 and Chanter 45 the known public sources reproduce 0 of 10 deity stats (all of that comes from pantheon, collections and similar) and 1, 0 and 3 of 6 attributes (random sub lines are expected values). With the armory totals used to fill the gap, the derived pass reproduces all 69 percent lines the armory prints (24, 22, 23).
- Max/Min Attack folding of flat Attack lines into both ends is an assumption (the client does not say), as is applying Amp Ratio "Attack increase" to Max/Min only (from the competitor's published client code, research/questlog_comparison_2026-10-05.md section 6.3 F1).
- DPS probes use `gear._Scorer` with a heuristic priority; the full optimizer was only run for the plan rows. One character, boss playstyle only.
