# Build optimizer vs community builds, v2 (2026-10-03, after mechanics fixes)

Scope: same test as `build_validation.md`. `aion2c.engine.build_optimizer` on a level-45 Global `CharacterBuild` per class, default `Stats()` (Run A, `compare_playstyles` / boss playstyle), compared with `community_builds/consensus.json` (boss set). No app code was edited. Raw outputs: `D:\Aion2\.firecrawl\v2\engine_<class>.json` (compare_playstyles, all 4 playstyles) and `c_<class>.json` (Run A plus geared template with 200 skill / 100 stigma points, which is the only way specialties unlock).

Test suite: `python -m pytest -q` in `D:\Aion2\app`: **641 passed in 467.56s** (read from the summary line; the only noise is Windows pytest temp-dir cleanup warnings on a locked test directory, not failures). The class-data check reported `ranger: pass=false`, but the Ranger test files (`test_class_ranger.py`, `test_mech_ranger.py`) are inside that 641 and passed, so that flag does not reproduce in the full suite.

## How the scores were computed (reused from v1)
Score = 50% stigma overlap with the community 4-slot boss set + 35% rotation shape + 15% stat/Daevanion, each 0..1. I re-derived v1's numbers from its table (for example Cleric 4/4, 0.40, 0.30 gives 0.5 + 0.14 + 0.045 = 69), so the formula is the same.
- Stigma overlap is mechanical: engine boss picks (Run A) that are in the community set, over 4. Strict reading: alternates in the consensus ("alt", "PvX: Executing Blade") do not count.
- Rotation shape is a judgment, as in v1. Rule used now: fraction of the community's named boss-rotation skills that the engine casts at least once at a plausible rate, minus about 0.05 per distorted spammer (a skill cast far above its cooldown) or filler dominance.
- Stat/Daevanion is a judgment: top-3/top-5 `stat_gains` against the community stat order. I did not re-inspect the Daevanion planner path, so this term is stat ranking only.
- Only the stigma term is exactly comparable before to after. The v1 sub-scores for rotation and stats were judgment calls whose underlying cast tables were not saved in full (only the top 12), so treat the before/after delta on those two terms as plus or minus 5 points per class.

## Before / after (boss, Run A)
| Class | Stigma before | Stigma after | Rotation before to after | Stat before to after | Score before | Score after | Delta |
|---|---|---|---|---|---|---|---|
| Assassin | 1/4 | 3/4 (Illusive Clone, Savage Fang, Triniel's) | 0.40 to 0.60 | 0.30 to 0.85 | 31 | 71 | +40 |
| Spiritmaster | 1/4 | 3/4 (Ancient Spirit, Flame Blessing, Corrode) | 0.60 to 0.70 | 0.30 to 0.40 | 38 | 68 | +30 |
| Sorcerer | 3/4 | 2/4 (EE, Delayed Explosion) | 0.40 to 0.70 | 0.20 to 0.75 | 54 | 61 | +7 |
| Chanter | 2/4 | 2/4 (Marchutan's, Focused Defense) | 0.65 to 0.70 | 0.30 to 0.70 | 52 | 60 | +8 |
| Templar | 2/4 | 2/4 (Doom Shield, Taunt) | 0.70 to 0.65 | 0.30 to 0.70 | 54 | 58 | +4 |
| Cleric | 4/4 | 3/4 (no Prayer of Amplification) | 0.40 to 0.65 | 0.30 to 0.65 | 69 | 70 | +1 |
| Gladiator | 3/4 | 2/4 (Rage Burst, Focused Block) | 0.35 to 0.65 | 0.40 to 0.35 | 56 | 53 | -3 |
| Ranger | 1/4 | 0/4 | 0.45 to 0.70 | 0.50 to 0.55 | 36 | 33 | -3 |
| Mean | 1.9/4 | 2.1/4 | | | 48.8 | 59.3 | +10.5 |

Reading it: rotation shape improved in 7 of 8 classes because stagger-only spam is gone (Sword Aura Rampage, Flame Scattershot, Lightning Strike Scattershot, Explosive Arrow are no longer in any boss cast table) and Rending Blow, Tempest Shot, Dark Crush and Condemnation now appear. Stat ranking improved because the Smite constant now sits at 0.70 per point (community fit 0.60 to 0.80) and Attack/Smite/crit now lead. Stigma agreement is flat to slightly down overall; three classes lost a pick (see the root cause below), two gained two.

Other measured changes: boss DPS at identical default stats rose for every class (Spiritmaster 1,367 to 2,785, Sorcerer 3,021 to 3,859, Chanter 3,643 to 4,395, Cleric 4,053 to 4,303, Assassin 2,100 to 2,252, Templar 4,774 to 5,042, Ranger 2,730 to 2,783, Gladiator 2,877 to 2,872). Geared plus points (Run C) cross-class order is now Chanter 39.3k, Templar 30.8k, Sorcerer 27.2k, Cleric 24.2k, Ranger 18.2k, Assassin 16.8k, Gladiator 16.5k, Spiritmaster 16.2k; still not the community tier list (Sorcerer/Gladiator/Assassin S, Chanter B), because stats are class-agnostic and Chanter's party buff value is counted only for the caster. Do not trust cross-class DPS yet.

## Root cause behind most stigma disagreements (our data/engine wrong)
The stigma chooser (`build_optimizer._optimize_stigmas`) scores a candidate set with `_heuristic_priority`, whose seed puts buffs first only when `search._is_buff` sees a self status with `dmg_mult > 1.0`. Buffs that are now carried by `Status.stat_mods` (combat speed, cdr, crit, attack increase, damage boost) have `dmg_mult == 1.0`, so they are not recognised as buffs, land late in the priority list, never fire against always-ready fillers, and score exactly zero. Measured on boss, default stats (DPS with that one stigma equals the no-stigma baseline: 1568 Gladiator, 1727 Ranger, 1597 Spiritmaster, 3019 Chanter, 3225 Templar, 1368 Assassin):
- Zero gain under the chooser: Lunge Stance (+20% CS), Zikel's Blessing (+20% Attack), Focused Block, Vaizel's Authority (+20% Attack), Bow of Blessing (+crit), Enhance: Spirit's Benediction (+20% damage boost), Undefeated Mantra (+18% damage boost), Power of the Storm (+20% CS and CDR), Swift Contract (+20% CS), Battlefield Banner. Cleric's Light of Protection is the exception (it carries `mp_min_pct=0.0`).
- Proof the buff itself works: Chanter with Undefeated Mantra put first in the priority is 3,506 vs 3,019 (+16%). With every stat_mods or multiplier buff forced to the front, community 4-set vs the engine's 4-set (DPS): Chanter 3,596 vs 3,186 (community +13%), Cleric 2,779 vs 2,693 (+3%), Gladiator 1,906 vs 1,866 (+2%), Ranger 1,947 vs 1,944 (equal), Templar 3,422 vs 3,461 (-1%), Sorcerer 2,205 vs 2,231 (-1%), Assassin 1,519 vs 1,540 (-1%), Spiritmaster 1,809 vs 1,864 (-3%).
So once buffs are seen, engine and community sets are within about 3% for 7 of 8 classes; the picks that differ there are noise-level, and only Chanter is a real miss. Caveat: this is a heuristic-priority comparison at default stats and rank 1, not the full optimizer.

## Disagreements, classified
(a) our data/engine wrong or missing, (b) community opinion without data, (c) unclear. Evidence is from the v2 runs unless a file is named.

### Gladiator (53)
- Lunge Stance and Zikel's Blessing not picked (Zikel's was picked in v1): (a). Root cause above; with buffs seen the community set beats the engine's by +2%.
- Assault Strike and Blade Toss picked instead (flat nukes): (a), same cause.
- Overhead Slam 9 casts per 180 s: (a). Community says it is over half of Gladiator DPS; its spec 16 (no cooldown) is unreachable because skill-point ranks cap at 10 (`budget.BASE_RANK_CAP`) plus at most 4 from Daevanion. Run C's only spec is Rage Burst -15 s cooldown (+6.5%).
- Keen Strike 64 casts is a basic-attack filler with no community counterpart: (c).
- Agree now: Rending Blow 23 casts (v1: 0), Sword Aura Rampage spam gone, Ruinous Blow, Leaping Slam, Mocking Blade, Crushing Wave and Rage Burst all cast.

### Sorcerer (61)
- Fire Wall and Cold Storm dropped for Glacial Smite and Assault Bombardment: (a) partly. They show only +23 and +31 DPS solo; their community value (Cold Storm spec 5 and spec 10 root, Fire Wall zone) sits in specs that are locked at rank 1. Assault Bombardment is a generic nuke used by about 1% of community builds (questlog): (b)/(c).
- Wish of Concentration never cast: (a) not traced (it is a core combat-speed skill in couga and questlog 91%).
- Flame Arrow 54 casts agrees with the community macro (Flame Arrow x2 to keep MP above 50%). Frost Burst 6 casts (v1: 19) agrees with couga's 2026-10-03 drop: (c).
- Run C specs: Firestorm -50% MP cost (+20.3%) and -2 s Hellfire cooldown per fireball (+14.4%), plausible against the Hellfire-centred community rotation: (c).

### Templar (58)
- Empyrean Lord's Punishment (-175 solo) and Taunt (-138): (a)/(c). Stagger and aggro are not modelled; the spec +10% damage boost (status `empyrean_spec_boost`) is locked at rank 1.
- Battlefield Banner +0 DPS: (a). Status `banner_weapon_dmg` has dmg_mult 1.1 but still scores zero; the "Attack proportional to Defense" ratio is unpublished (v1 fix 12, still open).
- Executing Blade picked (community lists it only as the PvX alternative to Taunt): (c).
- Pummel (the core macro line, 29 casts in v1) is absent from the boss priority; Vicious/Decisive/Desperate Strike fill instead: (c), unexplained, needs a look.
- Judgment 25, Shield Smite 18, Debilitating Smash 18, Annihilate 9, Punishment 7, Doom Shield 7, Warding Strike 7 agree. Judgment spec 16 (no cooldown) is unreachable (rank cap); Run C picks Debilitating Smash "ignores Block and Evasion" (+8.4%).

### Assassin (71)
- Swift Contract not picked: (a), zero gain under the chooser (+20% CS is stat_mods). Savage Fang is only +6 DPS solo.
- Heart Gore 0 casts in every run: (a), cause not traced. Couga puts it at about 30% of Assassin damage.
- Storm Rampage and Savage Roar not cast: (c). Storm Rampage needs a stagger window, which is not modelled.
- Insignia Explosion 19 casts, Quick Slice weave 51, Ambush, Flash Slice, Swift Slice fillers agree. Run C spec "Insignia +50% multi-hit" (+7.8%) differs from the community's Quick Slice cutting Insignia by 1 s: (c).

### Ranger (33)
- No community stigma picked in Run A (Vaizel's Authority, Bow of Blessing, Griffon Arrow absent; Supporting Fire only in Run C): (a). Vaizel's and Bow of Blessing are the invisible stat_mods buffs; Griffon Arrow (+31 solo) loses to Ambush Kick, Ensnaring Trap and Arrow Storm, which the pick log values at +1.6 to +4.1.
- Tempest Shot 27 casts (v1: 0), Drill Dart 28, Marking Shot 18, Gale Arrow 10, Deadshot 9, Snipe 21: now agree with couga's core rotation. Free-spam Explosive Arrow is gone.
- Stat ranking is led by CDR at 1.55% per point (v1 top was damage boost 0.97): (a)/(c), suspicious outlier against the community order (accuracy, attack, crit); likely the non-monotonic cooldown behaviour from v1 fix 9.
- Run C spec "Marking Shot +1 consecutive use" (+4.9%) vs community Vaizel's spec 20 and Drill Dart no-cooldown: (a), those ranks are unreachable.

### Spiritmaster (68)
- Ancient Spirit, Flame Blessing and Corrode picked (3/4, was 1/4), a real gain. Spirit's Benediction missing: (a), +20% damage boost via stat_mods, zero under the chooser.
- Flame Blessing is equipped but is not in the priority and never cast: (a). Its status has dmg_mult 1.0 and only a +6.667 crit sub-status; the 50% per-attack proc (41% ATK + 234) is still not a multiplier.
- Snapshot rule (buffs before summon), Cold Shock stacks: (a), not modelled. Wind Spirit 12 casts is (c); the community skips it.

### Cleric (70)
- Prayer of Amplification replaced by Assault Mark: (a). Only the spec 3 buff (+15% Attack for 17.5 s) exists as a status and it is locked at rank 1; base value is near zero in the sim, though +80 DPS solo when forced first.
- Condemnation 38 casts, cooldown-bound in Run A, but Run C's top spec is "resets cooldown on a Critical Hit" (+24.5%), which is exactly the community mechanic (Earth Punishment spec 5 and Condemnation spec 12): agree where reachable.
- Divine Aura in the priority but 0 casts, Bolt only 5: (c). Community casts Bolt fully charged by hand; aura is parallel damage, not modelled.
- Lightning Strike Scattershot is correctly gated now (community uses it only in stagger).

### Chanter (60)
- Undefeated Mantra and Power of the Storm not picked: (a), the largest remaining mismatch (community set +13%). The zero-uptime bug is fixed (the status is permanent, +18% damage boost, +16% when forced first) but the chooser cannot see it.
- Sprint Mantra heads the engine priority and Healing Touch is picked: (a)/(c), fallout of every candidate scoring near zero.
- Dark Crush 13 casts (v1: 33): (c). Spec 16 (no cooldown) is unreachable; Run C picks "Adds Piercing Strike chain" (+8.5%).
- Marchutan's Wrath and Focused Defense agree.

## Specialties, community vs engine
Consensus.json has no specialty field; community specs come from the mechanics lines of `community_builds/*.md` and v1 fix 1. With Run A (no skill points) the engine equips none. With 200 skill points (Run C) it equips 1 or 2 per class, none of them at ranks 16 or 20. Match: Cleric Condemnation reset-on-crit only. Partial: Sorcerer Firestorm/Hellfire cooldown cut. Miss (community spec unreachable or not chosen): Gladiator Overhead Slam 16 and Lunge Stance 20, Templar Judgment 16, Chanter Dark Crush 16, Ranger Vaizel 20 and Drill Dart, Assassin Quick Slice and Heart Gore 16. Cause: `allocate_points` stops at rank 10, while the community plan puts 3 to 5 skills at 16 to 20.

## Top remaining fixes (ranked by agreement impact)
1. Make the stigma chooser and seed priority recognise stat_mods buffs (`search._is_buff` should count any self status with `stat_mods` or a permanent flag, not only `dmg_mult > 1.0`). Expected: Lunge Stance, Zikel's, Vaizel's, Bow of Blessing, Benediction, Undefeated Mantra, Power of the Storm, Swift Contract enter the picks; Chanter is the biggest mover. Evidence above.
2. Let skill points go past rank 10 for the few skills whose specialty needs rank 16 or 20 (cap is 20 Global), with the Daevanion +4 on top; then Overhead Slam, Judgment, Dark Crush, Vaizel's, Heart Gore specs become reachable. Biggest measured upside in v1 (+9 to +30%).
3. Trace why Heart Gore (crit proc), Wish of Concentration, Flame Blessing (equipped, never cast), Divine Aura and Templar's Pummel never fire or left the priority.
4. Battlefield Banner ratio, Prayer of Amplification base value and Spiritmaster Flame Blessing proc: missing values, not mechanics.
5. Ranger CDR 1.55% per point outlier and other non-monotonic marginals (v1 fix 9): add a monotonicity check or warning.
6. Cross-class DPS order (Chanter first, Gladiator and Assassin low) still contradicts the tier list: party-buff weighting and class-agnostic stats; do not publish cross-class numbers.
7. Stagger windows (Storm Rampage, Flash Rampage, Scattershots) and Daevanion planner (orange Combat Speed and CDR first) were not re-checked in v2 and remain as in v1.

## What stays good
Sorcerer EE, Delayed Explosion, Bittercold Wind, Winter's Shackles, Hellfire; Gladiator Rage Burst, Focused Block, Rending Blow; Templar Judgment/Shield Smite/Debilitating Smash/Annihilate/Punishment; Assassin Triniel's, Illusive Clone, Savage Fang, Insignia and Quick Slice; Ranger Tempest Shot, Marking Shot, Deadshot, Gale Arrow; Spiritmaster Ancient Spirit, Corrode; Cleric Light of Protection, Noble Aura, Earth Punishment; Chanter Marchutan's Wrath all match community consensus, and the Smite constant (0.70 per point) is now inside the community's 0.60 to 0.80 fit.
