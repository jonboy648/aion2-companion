# Build optimizer vs community builds (2026-10-03)

Scope: `aion2c.engine.build_optimizer.compare_playstyles` on a level-45 Global `CharacterBuild` per class, compared with community setups in `research/community_builds/*.md` and `consensus.json`. No app code was edited. Scripts and raw outputs are in `D:\Aion2\.firecrawl\` (run_engine.py, run_geared.py, run_pts.py, ablate.py, spec_exp.py, engine_*.json, geared_*.json, pts_*.json, armory_*.json).

## Method and what the engine run actually tests
- Run A (the requested test): default `Stats()` (attack 1000, crit 0), no skill/stigma points, so every skill is rank 1. Output `engine_<class>.json` (4 playstyles).
- Run B: geared template (attack 1800, +20% attack/weapon/damage boost, 70% crit, +100 crit dmg, 25% smite, +20% combat speed, 10% CDR, 3000 MP). Output `geared_<class>.json`.
- Run C: Run B plus `skill_points=200, stigma_points=100`. Output `pts_<class>.json`.
- Ablations (hypothetical, in-memory data edits): remove stagger-only skills (`ablate.py`), set a key skill's cooldown to 0 to mimic specialization 16 (`spec_exp.py`).
- Community reference: couga54 guides (all 8 classes, 2026-09-30..10-03), questlog usage % (7 classes), aoeah, sportskeeda, shugo tier list, official-armory pulls of 10 top Global characters. Reddit is not scrapable with Firecrawl (unsupported site); shugo's leaderboard API answers Forbidden, so the official armory was used instead.
- Caveat on scores: the agreement score below is a heuristic (50% stigma overlap with the community 4-slot boss set, 35% rotation shape, 15% stat/Daevanion), not a statistic.

## Agreement scores (Run A, boss)
| Class | Stigma overlap | Rotation shape | Stat/Daevanion | Score | Verdict |
|---|---|---|---|---|---|
| Cleric | 4/4 (EP, LoP, PoA, Noble Aura) | 0.40 (LSS spam, Condemnation cd-bound) | 0.30 | 69 | stigma set right; rotation distorted |
| Gladiator | 3/4 (no Lunge Stance) | 0.35 (Sword Aura Rampage 72-105 casts, Rending Blow never) | 0.40 | 56 | Overhead Slam engine under-modelled |
| Sorcerer | 3/4 (Assault Bombardment/Glacial Smite for Cold Storm) | 0.40 | 0.20 | 54 | closest "real" model, still spec-blind |
| Templar | 2/4 (Shield of Protection, Assault Fury; geared run 3/4) | 0.70 | 0.30 | 54 | rotation shape close |
| Chanter | 2/4 (no Undefeated Mantra, no Power of the Storm) | 0.65 | 0.30 | 52 | support value + zero-uptime bug |
| Spiritmaster | 1/4 (boss; 2/4 in aoe/leveling) | 0.60 | 0.30 | 38 | Ancient Spirit chain not valued on boss |
| Ranger | 1/4 (only Vaizel's) | 0.45 | 0.50 | 36 | picks raw-damage stigmas, not buffs |
| Assassin | 1/4 (only Triniel's Dagger) | 0.40 | 0.30 | 31 | Heart Gore/Illusive Clone absent |

Cross-class sanity check (Run B boss DPS, same stats for all): Templar 24.2k, Chanter 18.5k, Cleric 15.9k, Sorcerer 14.2k, Ranger 13.5k, Gladiator 13.3k, Assassin 9.9k, Spiritmaster 7.4k. Community tier list (shugo 2026-09-29, MrRosaPony DPS logs of 50k characters cited): Sorcerer S, Gladiator S, Assassin S (highest single-target), Ranger/Spiritmaster/Templar/Cleric A, Chanter B ("lowest personal damage with Cleric", couga). The engine order is nearly inverted, so absolute cross-class DPS must not be trusted (stats are class-agnostic and support value is personal-only).

## Disagreements, classified
(a) our data/mechanic wrong or missing, (b) community opinion without data, (c) unclear.

### Sorcerer
- Cold Storm replaced by Assault Bombardment (Run A) or Glacial Smite (Run B): (a). Cold Storm's value sits in spec 5 "Enhanced Frostbite - extra damage when landing an attack" and spec 10 30% root, which the engine ignores; Assault Bombardment is a generic 120 s, 0 MP nuke that 1% of community builds use (questlog) and couga does not list. Glacial Smite as the farming swap does match couga ("swap for Cold Storm on short fights and farming") in aoe/leveling.
- Flame Scattershot 98-117 casts: (a). `flame-scattershot` is "damage to a target afflicted with Stagger" but has cd 0, mp 0 and no `requires`.
- Wish of Concentration never in the rotation: (a). It is a combat speed buff (couga core skill, questlog 91%); statuses cannot change combat speed.
- Frost Burst cast 18-19 times while couga changelog (2026-10-03, EUTOPIA global lvl-45) drops it: (c). Engine models +MP/damage; no measured data.
- Agree: Element Enhancement first (4 casts/180 s), Delayed Explosion second (+15% 4 s matches couga), Fire Wall, Hellfire charged (4-5 casts), Blaze gated on Fire Mark, Grace of Enhancement at 25% MP matches couga. Robe of Earth (crit above 50% MP) is not modelled.

### Gladiator
- Lunge Stance not picked: (a). +20% combat speed cannot come from a status, spec 20 (50% on crit: all cooldowns -1 s), spec 5 (+5% double chance) and x1.5 Identify Weakness at 15 are ignored (the data file says so). Community core (64% questlog, couga "first stigma to max").
- Overhead Slam only 33-37 casts (cd 5 s): (a). Spec 16 removes the cooldown and Rage Burst/Lunge Stance keep it up; couga/aoeah say it is over half of Gladiator DPS. Experiment: set cooldown 0 -> +30% DPS (11,771 -> 15,329), casts 33 -> 111, and the stigma set shifts to Focused Block/Rage Burst/Zikel's/Blade Toss.
- Sword Aura Rampage 72-105 casts and rank 10 + several Daevanion nodes: (a) same stagger bug. Ablation: DPS 13,294 -> 11,771 (-11.5%), Rending Blow (62) and Keen Strike (44) appear, Armor of Balance enters the stigma set.
- Rending Blow (couga #2 damage, MP engine, 92% usage) never cast in the boss rotation: consequence of the spam above.
- "unknown value: murderous_burst_crit damage multiplier": (a) value missing for Murderous Burst (every 5 hits AoE burst + crit damage; couga ranks it 5th in damage).
- Rage Burst bottom-slot rule and Rage Burst "enables Overhead Slam for 10 s" are in the data but only the buff multiplier is simulated: (c) engine priority is first-ready, not hotbar-line semantics.

### Templar
- Shield of Protection is the top stigma (+15% value, geared run): (a)/(c). Engine data applies Fury on guaranteed block ("assumes the boss hits the tank") and the stigma restores 110 MP; community never runs it (no questlog data, not in any SolAshur/trueeevil/sportskeeda list). Needs a switch for "boss hits the tank" and MP calibration.
- Battlefield Banner never valued: (c). Status multiplier is None ("Attack proportional to Defense", ratio unpublished). Community core (couga, sportskeeda).
- Empyrean Lord's Punishment valued -3.1 in Run B: (a) its value is stagger damage (50 stagger) and PvE Damage Boost at 15 (+10%), neither modelled.
- Rotation shape agrees (Judgment 20-24, Pummel 29-46, Shield Smite 15-20, Debilitating Smash 18-21, Annihilate, Punishment charged ~7). Judgment cd->0 (spec 16) experiment +9% DPS, casts 24 -> 68. Flash Rampage correctly never cast (requires staggered) although the community macro carries it for stagger windows: (b)/(c).

### Assassin
- Illusive Clone and Swift Contract not picked, Throw Shadowblade/Smoke Bomb/Shadowstep picked instead: (a). Illusive Clone's core effect is "removes Heart Gore cooldown" and Heart Gore is `kind=proc`; the engine never casts Heart Gore (0 casts in every run) although couga/Arthars put it at ~30% of damage (Insignia Explosion ~25%). Swift Contract is +20% combat speed (not a multiplier). Utility skills with flat damage and 0 MP win by default.
- Insignia Explosion 19-21 casts: (a) spec 8 keeps 2 stacks and Quick Slice spec cuts 1 s per hit; couga: press on every ready.
- Storm Rampage never cast: (b)/(c). Engine requires `stagger` (never applied); community uses it as the cooldown engine (-1 s all cooldowns per hit) during stagger windows.
- Quick Slice as the weave (41-63 casts) and Ambush as filler agree.

### Ranger
- Picks Ambush Kick/Ensnaring Trap/Illusory Arrow/Assault Smite, not Bow of Blessing/Supporting Fire/Griffon Arrow: (a). Bow of Blessing is +200 crit/+100 accuracy (specs: multi-hit, +20% crit damage, +7% double chance); the data keeps those in `stat_effects` (research/classes/ranger/mechanics.json, "loader ignores it"). Vaizel's Authority is chosen (agrees) but its spec 20 cooldown-cut-on-crit is ignored ("huge DPS jump" per couga).
- `explosive-arrow` (active, 0 cd, 0 mp, 120% ATK + 116) cast 83-145 times: (a). A free hidden skill that is castable without the Explosive Arrow stigma (the stigma is the separate `explosive-arrow-14360000`). Ablation with it and Arrow Scattershot removed: DPS 13,545 -> 12,071 (-11%), Snipe (43) and Rapid Fire (22) take over.
- Tempest Shot (couga "top damage contributor", 92% usage) never cast; Snipe basic attack absent until the ablation: (a) data/priority interaction (Tempest costs 120 MP, defaults to MP-starved).
- Marking Shot's Precision (+300 crit, +35% Deadshot damage) status multiplier 1.0: (a). Marking Shot cast 19-21 (agrees in frequency with refresh <3 s intent).
- Deadshot 10 casts/180 s, Gale Arrow 10: agree with a 20 s cooldown.

### Spiritmaster
- Boss stigmas Siphon/Destructive Attack/Assault Terror vs Ancient Spirit/Flame Blessing/Corrode: (a). Ancient Spirit is picked in aoe and leveling (agrees there) but on boss its value (Four Elements feed for Elemental Fusion) is not worth a slot in the engine. Flame Blessing is a 50% per-attack proc (41% ATK + 234) modelled as multiplier 1.0. The snapshot rule (spirit copies buffs at summon) and Cold Shock's +2% Attack x5 stacks (+10% for you and spirits) are not modelled.
- Combat speed gain -0.62% per +1% (Run B): (a)/(c) non-monotonic result, see fix 9.
- Summon: Wind Spirit cast 11-13 times: (c) community skips it (weakest); engine counts it toward Four Elements.

### Cleric
- Stigmas 4/4 on Run A. In Run B the spam pushes Power Burst into the set instead of Noble Aura; after removing the stagger-only skill the set becomes Noble Aura, Light of Protection, Prayer of Amplification, Earth Punishment (exactly the community set) and DPS rises 15,867 -> 17,216.
- Lightning Strike Scattershot 119-162 casts: (a) stagger-only, cd 0, no `requires`.
- Condemnation 30-37 casts: (a) Earth Punishment spec 5 forced crit + spec 12 reset on crit makes it effectively cooldown-free (couga/Kaeria). Cooldown->0 experiment: +22% DPS, casts 30 -> 117.
- Divine Aura never cast, Bolt only 5 casts: (c) community casts Bolt fully charged by hand; aura value is "deals damage in parallel" (not modelled as a tick).

### Chanter
- Undefeated Mantra (couga first stigma, questlog 77%) not picked: (a). In `simulate` it is cast every 5 s (36 casts) but produces no status uptime because the status has `duration_s=0.0` and no `mp_min_pct`; Cleric's Light of Protection works only because it carries `mp_min_pct=0.0`. Same bug silences chanter Attack Preparation (status mult 1.055, duration 0). Net effect: Mantra lowers DPS 2,239 -> 1,923 in an A/B.
- Power of the Storm not picked: (a). Data note says "feed Stats combat_speed_pct and cdr_pct instead of a multiplier" but statuses cannot.
- Dark Crush 33-36 casts: (a) spec 16 removes its cooldown (window 2 s after Spinning Strike/Impactful Crush, 3 s after Marchutan's Wrath). Cooldown->0 experiment +9%, casts 36 -> 163.
- Marchutan's Wrath, Focused Defense agree. Chanter DPS is overstated relative to tier lists: (c).

## Concrete fixes, ranked by DPS impact
1. Specializations are not simulated (`CharacterBuild.specs` is never read by the engine; spec text is stored as strings). Measured upper bounds when only the cooldown-removal spec is mimicked: Gladiator Overhead Slam +30%, Cleric Condemnation +22%, Ranger Drill Dart +18%, Chanter Dark Crush +9%, Templar Judgment +9%. Also needed: Lunge Stance and Vaizel's Authority spec 20 (50% on crit -> all cooldowns -1 s), Quick Slice -1 s Insignia Explosion, Storm/Gust/Flash/Arrow Rampage and Scattershots -1 s per hit during stagger, Rending Blow spec 16 +50 MP on crit, Overhead Slam specs 8/12/16, Annihilate +100% vs CC-immune, Cold Storm/Fire Wall spec 5. Source: couga54 guides, aoeah 2026-10-01. Without this, rank breakpoints 8/12/16/20 (the whole community levelling plan) carry no value, which is why `allocate_points` spreads rank 10 over ~12 skills (BASE_RANK_CAP=10) while the community concentrates 16-20 on 3-5 skills.
2. Crit-triggered procs (`kind=proc`) are never cast: Assassin Heart Gore (cd 5 s, fires on crit, ~30% of community Assassin damage; 0 casts in all runs), Gladiator Overhead Slam proc variant, Ranger Drill Dart proc `drill-dart-14050007`, Chanter Wind's Promise (50% on crit, 554 flat, 1 s cd), Raging Spell. Needs a crit-event trigger model (chance = crit_chance_pct).
3. Statuses cannot change stats. Needed for combat speed, cooldown reduction, crit, accuracy and Attack: Lunge Stance +20% CS, Swift Contract +20% CS, Power of the Storm +20% CS/-20% cooldowns (party +20%/-10%), Gale Arrow, Wish of Concentration, Precision +300 crit/+35% Deadshot damage, Bow of Blessing +200 crit, Hunter's Resolve +20% crit damage, Spinning Strike +15% crit damage per stack. A `stat_effects` extension already exists in research/classes/*/mechanics.json and is ignored by the loader. With community weights (+1% combat speed = 0.74% DPS, S2) a 20% speed buff is worth roughly +15% while up.
4. Permanent auras have zero uptime when `duration_s=0.0`: Chanter Undefeated Mantra (+10.5% PvE damage, 36 pointless re-casts), Chanter Attack Preparation (+5.5%..25%), probably other 0-duration passives/toggles (Gladiator/Chanter/Templar passives). Cleric Light of Protection works only through an `mp_min_pct=0.0` trick. Fix: treat `duration_s==0` + toggle/passive as always-on, or set the trick uniformly.
5. Stagger-only skills have no gate: `flame-scattershot` (Sorcerer), `sword-aura-rampage` (Gladiator), `lightning-strike-scattershot` (Cleric), `arrow-scattershot` and `dust-arrow` (Ranger) are cd 0 / mp 0 and spammed 98-162 times per boss fight, steer Daevanion and rank allocation to them, and displace real rotation skills. Assassin/Templar/Spiritmaster/Chanter equivalents are gated (`requires staggered`) and never cast. Ablations: Gladiator -11.5%, Ranger -11%, Sorcerer -3%, Cleric +8.5% (spam crowded out Condemnation/Judgment Thunder). Fix: one consistent rule, ideally a stagger-window scenario (2-3 windows per fight, stagger gauge damage is already in every skill description).
6. Free hidden Ranger skill `explosive-arrow` (active, 0 cd, 0 mp) is castable without owning the stigma (145 casts). Audit other zero-cost actives/chain children listed as castables (`basic-attack`, Decisive/Desperate Strike, Breaking/Swift Slice are fine as chain children; the Ranger one is not).
7. Party/support value is invisible. Chanter mantra, Templar Fury/Battlefield Banner, Cleric Light of Protection/Prayer of Amplification are community core but only the caster is counted, and Templar/Chanter/Cleric show the highest DPS in the cross-class check. Provide a "party multiplier" option or per-role weighting before comparing classes.
8. Stat-gain constants: `damage.SMITE_BONUS = 0.5` makes +1% Smite worth 0.32% (boss) but the community fits (S1/S2 in sorcerer_builds_and_dps.md) are 0.60-0.80%; Smite/Double is "chance to deal double damage", so the bonus should be 1.0 with the -30% boss resistance on top (that reproduces ~0.8% at 25% smite). Damage boost +1% reads 0.81% only because the template bucket is small (20%); community value 0.30-0.62% (KR endgame buckets are much larger), so stat ranking depends on a baseline the app does not state.
9. Non-monotonic marginals: +1% combat speed = -0.62% (Spiritmaster), +1% CDR = -0.33% (Sorcerer), -0.73% (Templar), -0.33% (Assassin), -0.82% (Chanter). Faster casting can reorder a first-ready priority list so that low-value skills preempt; community says CDR is a standout for Spiritmaster/Chanter (Game8) and combat speed is S-tier (S3). Needs a monotonic evaluation (re-optimise priority per delta) or a warning when a gain is negative.
10. MP model: defaults (max 2000-3000, regen 20-30/s) are guesses. They make MP-restoring picks dominant (Templar Shield of Protection +15%, Ranger Tempest Shot starved). Couga: Sorcerer ~3,000 MP at the start with no CDR, "Vicious Strike restores MP, Pummel spends it". Calibrate from the armory (it exposes no MP) or one in-game screenshot.
11. Daevanion planner: puts flat Attack/Defense/Max HP connector nodes first and skips orange Combat Speed/CDR (Nezekan), which every guide ranks first; blue-node targets follow the spam skills (Sword Aura Rampage, Flame Scattershot, Lightning Strike Scattershot) and skip Rending Blow, Wish of Concentration, Flame Arrow, Quick Slice/Heart Gore. Fixing 1, 3 and 5 should repair most of this.
12. Missing values: `murderous_burst_crit` damage multiplier (Gladiator), `focused_defense duration`, `fracturing_defense_down` multiplier, `rushing-smash charge time L3`, Battlefield Banner Defense-to-Attack ratio, Executing Blade needs a non-zero `target_defense` to matter (default 0).
13. Armory importer: `classes.py` `armory_pc_ids` mislabels classes (search results with pcId 5/6 returned Gladiators; Sorcerer appears as 28 and 7). `key_from_armory` tries `className` first, so low risk, but the pc_id fallback is unreliable.
14. Source conflict still open: Delayed Explosion +15%/4 s (couga, engine) vs +25% (Inven KR live). Element Enhancement duration 15 s unverified.

## Ideas the community uses that the engine cannot express
- Hotbar-line macros with "bottom slot = highest priority", held-key weaving of LMB basic attack plus macro, skill queue and animation cancel (Rage Burst must be bottom, otherwise it never fires).
- Burst windows aligned by hand (Assassin buffs on one button with 60 s/90 s cooldowns, Sorcerer Delayed Explosion before the pull, Chanter toggles), "wait or press" decisions.
- Positioning: back/front attack uptime (Assassin 60-80% real), boss orientation, Rear Smite, front damage for Gladiator.
- Stagger gauge as a resource (2-3 windows per fight) and stagger damage per skill; Staggered/Knockdown/Stun gates and Incapacitated-Immunity 7% rules on bosses.
- Block/parry/evade events (Fury, Experienced Counterstrike, Focused Block, Warding Shield), accuracy vs parry (parried hits lose over half, accuracy ~1,100-1,300 targets) and crit-resist gap (80% cap at a 1,200 gap).
- Spirit AI and the snapshot rule, Four Elements counter, Cold Shock stacks, Ancient Spirit grant every 5-7 basic attacks.
- Skill-level sources (Daevanion +4, rings +2, arcana up to +4, set bonuses), soulbind line allocation per slot, deity stats (Wisdom/Time/Death), pets (Genus Insight), wings, Pantheon, arcana sets (Primal Vigor +60/+150 PvE Attack at HP >= 70%).
- Party composition rules (mantra does not stack with Cleric Light of Protection, Wave Blow vs Debilitating Mark, group sizes 5/10), PvP and PvX gear/stigma swaps, season-specific caps.
- Ping and combat-speed thresholds (65% for Spiritmaster weave, 90% for Gladiator).

## Positive agreement worth keeping
Element Enhancement/Delayed Explosion/Fire Wall (Sorcerer), Rage Burst/Focused Block/Zikel's (Gladiator), Vaizel's Authority (Ranger), Cleric 4/4, Marchutan's Wrath/Focused Defense (Chanter), Triniel's Dagger (Assassin), Doom Shield/Taunt (Templar), Corrode (Spiritmaster, Run B) all match community consensus. AoE/leveling picks are noticeably closer to the community than boss picks (Glacial Smite for farming, Ancient Spirit + Seize Magic, Executing Blade for Templar solo). The engine's own data file documents most of the gaps above in `note`/`source` fields, which made classification quick.
