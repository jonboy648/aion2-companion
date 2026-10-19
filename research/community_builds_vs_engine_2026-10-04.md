# Community builds vs engine recommendations, all 8 classes (2026-10-04)

Task: find the current top community builds for the eight Global classes and check whether the engine's own recommendation matches or beats them. Engine: `D:\Aion2\app` at `f47d00d` (phase 1 and 2 numbers, crit cap 50%, cooldown cap 60%, Exceed; `app/` is unchanged up to the current local main `c8ba670`). Nothing in the repo was edited or committed; this file is the only thing written there. Builds were collected 2026-10-03 and 2026-10-04 (couga54 as the primary source; questlog, expcarry, aoeah, gegebase and Inven as secondary ones; Templar, Cleric, Chanter and Spiritmaster taken from `research/role_builds_2026-10-04.md`); sources, dates and reuse terms are in section 9 and the builds themselves in appendix A.

## 1. Result

**Answer.** The engine does not match the community at HEAD. On boss content the published couga54 PvE build beats the engine's own recommendation in 8 of 8 classes, by +9% (Assassin) to +88% (Cleric) (model DPS, same point budget, same character; the delta is community / ours - 1, so positive means the community build is ahead). On AoE and farming the engine's own pick scores within 7% of the guide's stigma set at HEAD (the same set in Assassin, and equal in Templar because the one stigma that differs is worth about 0). Ten engine defects explain the boss gap (section 4). Three mechanical ones account for nearly all of it: specialties are equipped on one skill only, stigma points stop at rank 10 and are bought one rank at a time, and stigmas, ranks and specialties are scored against a greedy seed rotation instead of the searched one. With those patched in a scratch harness, ours is level with or ahead of the guide in 5 of 8 classes (Templar -7%, Gladiator -6%, Spiritmaster -5%, Assassin -4%, Sorcerer -2%) and the guide stays ahead in 3: Cleric +15%, Chanter +4%, Ranger +4%. What is left traces to how the model values ranks and buffs (the allocator values a rank by a single specialty option, and the game data values 31 buff statuses at one fixed rank) and, for the Cleric, to a pair of specialties the engine cannot find. Those are model questions, so the cases where ours is ahead are softer than they look: re-scoring the same builds with buff values at their own ranks puts the guide ahead by more than 2% in 4 classes (Cleric +24%, Chanter +9%, Ranger +6%, Sorcerer +3%), and an engine that plans under those values (patches F and G) is level or ahead in 6 of 8 and trails in 2 (Cleric +24%, Ranger +7%).

| Class | Boss: published build | Ours shipped (delta) | Ours +A+B+C (delta) | Ours +A+B+C+E (delta) | Rank-aware model: published / ours +F+G+E (delta) | AoE: guide set | Ours shipped (delta) | Ours +A+B+C (delta) |
|---|---|---|---|---|---|---|---|---|
| Gladiator | 9605 | 7335 (+31%) | 10287 (-7%) | 10257 (-6%) | 9698 / 9907 (-2%) | 27140 | 25876 (+5%) | 31376 (+2%) |
| Templar | 11505 | 9879 (+16%) | 12394 (-7%) | 12308 (-7%) | 11469 / 12308 (-7%) | 50643 | 50643 (+0%) | 59995 (-1%) |
| Assassin | 9110 | 8324 (+9%) | 9275 (-2%) | 9484 (-4%) | 9110 / 9275 (-2%) | 39046 | 39046 (+0%) | 48193 (+0%) |
| Ranger | 6620 | 4945 (+34%) | 6157 (+8%) | 6394 (+4%) | 6583 / 6153 (+7%) | 19225 | 20621 (-7%) | 25941 (-3%) |
| Sorcerer | 26837 | 17517 (+53%) | 24661 (+9%) | 27254 (-2%) | 26634 / 28645 (-7%) | 75908 | 78732 (-4%) | 129307 (+4%) |
| Spiritmaster | 5498 | 4421 (+24%) | 4990 (+10%) | 5817 (-5%) | 5615 / 5817 (-3%) | 18063 | 18339 (-2%) | 22739 (-1%) |
| Cleric | 9696 | 5164 (+88%) | 8392 (+16%) | 8448 (+15%) | 9750 / 7874 (+24%) | 22589 | 22731 (-1%) | 31710 (-3%) |
| Chanter | 20151 | 15869 (+27%) | 19581 (+3%) | 19393 (+4%) | 20238 / 20032 (+1%) | 70020 | 69474 (+1%) | 85194 (+0%) |

Columns: published = the couga54 PvE build as the engine's own cleanup leaves it (table 3.1); shipped = the engine at HEAD; +A+B+C and +A+B+C+E = our own plan with the diagnostic patches of section 2 (never shipped); rank-aware model = published build against ours planned with patches F and G, both scored with buff statuses at their own ranks (section 4.2). AoE = the first-listed couga54 AoE stigma set, ranks and specialties allocated by the engine on both sides.

**What to fix, in order of effect** (each reproduced in section 4):

1. `engine/specialties.py:80`: compare each skill's gain with the DPS the loop started from, not with the running DPS (patch A: +2% to +35% on our own build; the shipped engine equips specialties on one skill only).
2. `engine/budget.py:56` and `:84-118`: let stigma purchases reach the Global cap of 20 and span several ranks (patches B and C: up to +25% more; the shipped engine spends 14-56 of 82-296 stigma points).
3. `engine/build_optimizer.py:84-87`, `:122-135`, `:421-436`: plan stigmas, ranks and specialties against the searched rotation, not the seed (patch E: Spiritmaster boss +16.6%, Sorcerer boss +10.6%, Ranger boss +3.9%).
4. `engine/budget.py:65-82`: value a rank with all its open specialty slots, not the best single option (defect 7, patch F). With E it makes the engine take the guide's Undefeated Mantra 20 in the Chanter and closes that class from +5.0% to +1.1% (one pool); it moves the other classes by 0.0% to +2.2%.
5. Game data: value buff statuses at the build's own rank (defect 8). Re-scoring the same +A+B+C+E builds with them moves every affected class toward the guide: Cleric +14.0% to +24.3%, Chanter +3.7% to +8.7%, Sorcerer +0.2% to +2.7%, Ranger +4.2% to +5.7%, Spiritmaster -2.6% to -1.6%, Gladiator -5.8% to -5.1% (guide / ours - 1, shipped model to rank-aware).
6. `engine/specialties.py`: look at pairs of options (defect 10). Cleric: Earth Punishment tier 5 plus Condemnation's reset is worth +16.6% on our own build and the guide has it.
7. Smaller: `build_optimizer.py:126` (stigmas with no unlock level enter the pool), `budget.py:22` (PROC skills never get ranks), specialty effects the model cannot value (12-26 of the options each guide picks change DPS by 0.05% or less in the model).
8. Check the stigma tier rule in game (defect 9): the engine lets a rank-20 stigma use 3 of its 4 tiers; with the DarthThot stats only the Cleric (+19%) moves materially when it is changed (Sorcerer +1.4%, Gladiator +0.8%).

**Flagged cases** (section 5). All 8 published builds trip the community-ahead threshold (more than +2%) at HEAD. After patches A+B+C+E the published builds that still trip it are Cleric +15%, Chanter +4%, Ranger +4%. Across all builds and stigma sets, 19 rows trip it at the shipped level or after A+B+C and 10 rows trip the ours-ahead-by-more-than-10% check; every CHECK row is an alternative community set (seller sites, a scrape of the couga54 AoE notes, healer sets) that drops a stigma the guide's own build runs or is made of support stigmas the model prices at zero. Section 5 gives the reason per row.

**Not verified.** Nothing was run in game, and model DPS is not calibrated across classes. The two largest uncertainties are the model's own: defect 8 (buffs at one fixed rank) and defect 9 (stigma tiers limited by mastery slots, not checked in game). The PvP builds were collected and not simulated (the engine does not model PvP). Daevanion routes are compared qualitatively only.

## 2. What was compared and how (read this before the numbers)

**Engine.** `D:\Aion2\app` at `f47d00d`, the commit named for this task. Local main has since moved to `c8ba670` through commits that touch only `web/`, `docs/`, `research/` and `CONTEXT.md` (`git diff f47d00d c8ba670 -- app` is empty), and the working tree of `app/` differs from HEAD only in the line endings of `engine/search.py` (`git diff --ignore-space-at-eol` is empty). Nothing in the repo was edited: every patch below is a monkeypatch inside a scratch harness (`scratchpad/cb/`, not committed).

**Character.** DarthThot's armory fixture (`tests/fixtures/armory`) imported through `webapi.import_character`, moved to each class (`class_key`), level 45, skill ranks, stigmas, specialties and Daevanion nodes cleared (his Sorcerer-keyed ranks and 84 nodes would otherwise leak into the other seven classes; the Sorcerer on his real ranks and nodes is run separately in section 7). The stats are what the armory gives (attack +1.6%, crit 2.8%, smite 0.1%, combat speed 3.8%, cooldown 0.1%) on top of the `Stats()` defaults (attack 1000, crit damage +50%). That is a leveling character: crit is far below the endgame values the guides assume, so section 7 repeats the boss runs with a geared profile. Absolute DPS is a model number, comparable only inside one class.

**Scenarios.** `boss` = `boss_180` (180 s, one target) for PvE boss/dungeon builds, `aoe` = `aoe_pack` (30 s, 4 targets) for AoE/farming/solo builds. PvP is not modelled by the engine, so the PvP builds are listed in the appendix and not simulated.

**How a community build is forced.** `webapi`/`optimize_full_build` re-chooses stigmas and specialties itself, so they cannot be fixed through the public API. `CharacterBuild.stigmas` (keys), `skill_ranks` (base ranks; total = base + Daevanion nodes + `bonus_ranks`, capped at 20), `bonus_ranks` and `specs` (skill key -> 0-based option indices) are the fields; the harness replaces `build_optimizer._optimize_stigmas` and `choose_specs` for the forced runs and leaves the rest of the pipeline (points, rotation search, variants) untouched. Two kinds of community run:

- **published**: the couga54 PvE build with its stigma levels, final skill ranks and its recommended specialty picks (rank tiers matched to the client's option texts; three texts differ from the Global client and were matched by tier, listed in section 8). Slots the guide leaves open are filled greedily by the engine. Stigma tiers (5/10/15/20) are applied automatically as the guides describe, cut to the engine's slot rule in tier order (for the Cleric the engine chooses the tiers by DPS instead; see the note under table 3.1 and table 4.3).
- **stigma set only**: every other source gives only the four stigma names, so those sets are forced and the engine allocates ranks and specialties exactly as it does for its own pick.

**Equal resources.** A build the engine plans from scratch needs a point budget, and `compare(b, 0)` on the plain import has none (all ranks stay 1). Each class therefore gets what the published build spends: skill points = the cost of the base ranks (at most 10) of its named skills and their chain follow-ups, stigma points = the engine's price of its four levels (Gladiator 357/96, Templar 273/106, Assassin 294/156, Ranger 357/116, Sorcerer 252/116, Spiritmaster 273/296, Cleric 315/176, Chanter 273/82 skill/stigma points). Ranks above 10 (Daevanion, rings, arcana in the guide) cannot be bought, so both sides get the same `bonus_ranks`; PROC skills the allocator cannot rank (Assassin Heart Gore, Spiritmaster Dimensional Control) get the guide's rank on both sides.

**Rotation noise removed.** Each build is scored under the best rotation found by any run of its group: 21-66 candidate rotations per group (median 36; 3 seeds x each patch level x our build and each community set, plus the published build), each filtered to what the build can cast. Search luck in the rotation is therefore not part of any delta. The builds themselves still vary with the search seed: over 206 builds scored per seed, (max - min) / mean across the 3 seeds has a median of 0.5% and a 90th percentile of 4.5%, 37% of the builds are identical across seeds, and the worst case is 22% (Sorcerer AoE, a community-set build, where the specialty picks depend on the rotation found). Different tables come from different runs (table 3.1 from the chain run, 3.2 and 3.3 from the main run, E and D from their own runs), so the same "ours" build can differ by a percent or two between tables; every delta is computed inside one run.

**Fidelity.** The harness's "ours, as shipped" run equals the product path exactly (`webapi.optimize(build, "boss", 0)` on Ranger: 4945.318 DPS and the same stigmas, `plan_daevanion` is skipped only because 0 Daevanion points take no node).

**Patches (diagnostics, never shipped).** A = specialty chooser skip test fixed; B = stigma purchases may reach the Global cap 20; C = a purchase may span several ranks so a stigma tier (5/10/15/20) behind zero-gain ranks is reachable; D = stigma sets scored at the level the budget can afford instead of rank 1; E = stigmas, ranks and specialties planned a second time against the searched rotation instead of the greedy seed. Second round (section 4.2): F = the point allocator values a rank with every specialty slot it has open instead of the best single option; G = buff statuses are valued at the build's own ranks (a scratch table, `cbrankaware.py`) inside every `simulate` call the engine makes. Columns: **shipped** = no patch, **+A**, **+A+B+C**, **+A+B+C+E**; D, F and G are shown separately.


## 3. Results

Delta convention everywhere: **community DPS / our DPS - 1**, so a positive number means the community build is ahead. `GAP` marks more than +2% (the community build beats ours: likely engine gap), `CHECK` marks less than -10% (ours beats the community build by more than 10%: needs a sanity check). Columns: **shipped** is the engine at HEAD; **+A**, **+A+B+C**, **+A+B+C+E** add the diagnostic patches of section 2 on our side only.

### 3.1 Boss: the published couga54 PvE build against our recommendation

"As published" applies every pick the guide lists and nothing else. "After engine cleanup" is what the pipeline itself does to any build: it fills specialty slots the guide left open and drops picks that lower DPS (for example the Gladiator's Overhead Slam "Adds Upward Strike" and Focused Block "+1 consecutive use", which the engine measures at -9.5% and -0.8%). The deltas use the cleaned number, the conservative choice: a build the engine has already improved is harder for ours to match. All columns of this table come from one run (one rotation pool).

| Class | Community build (couga54 PvE) | As published (all picks) | Published, after engine cleanup | Ours shipped | Delta | Ours +A | Delta | Ours +A+B+C | Delta | Ours +A+B+C+E | Delta |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Gladiator | Lunge Stance 20, Focused Block 5, Rage Burst 5, Zikel's Blessing 10 | 8640 | 9605 | 7335 | +30.9% GAP | 9817 | -2.2% | 10287 | -6.6% | 10257 | -6.4% |
| Templar | Empyrean Lord's Punishment 15, Battlefield Banner 15, Doom Shield 15, Taunt 5 | 11164 | 11505 | 9879 | +16.5% GAP | 12352 | -6.9% | 12394 | -7.2% | 12308 | -6.5% |
| Assassin | Illusive Clone 20, Swift Contract 15, Savage Fang 15, Triniel's Dagger 10 | 8406 | 9110 | 8324 | +9.4% GAP | 8541 | +6.7% GAP | 9275 | -1.8% | 9484 | -3.9% |
| Ranger | Vaizel's Authority 20, Bow of Blessing 10, Supporting Fire 10, Griffon Arrow 10 | 6467 | 6620 | 4945 | +33.9% GAP | 6061 | +9.2% GAP | 6157 | +7.5% GAP | 6394 | +3.5% GAP |
| Sorcerer | Element Enhancement 20, Cold Storm 10, Fire Wall 10, Delayed Explosion 10 | 26837 | 26837 | 17517 | +53.2% GAP | 22566 | +18.9% GAP | 24661 | +8.8% GAP | 27254 | -1.5% |
| Spiritmaster | Summon: Ancient Spirit 20, Enhance: Spirit's Benediction 20, Flame Blessing 20, Jointstrike: Corrode 20 | 5498 | 5498 | 4421 | +24.3% GAP | 4745 | +15.9% GAP | 4990 | +10.2% GAP | 5817 | -5.5% |
| Cleric | Earth Punishment 20, Light of Protection 20, Prayer of Amplification 10, Noble Aura 10 | 8092 | 9696 | 5164 | +87.8% GAP | 6834 | +41.9% GAP | 8392 | +15.5% GAP | 8448 | +14.8% GAP |
| Chanter | Undefeated Mantra 20, Power of the Storm 5, Marchutan's Wrath 1, Focused Defense 5 | 20151 | 20151 | 15869 | +27.0% GAP | 18115 | +11.2% GAP | 19581 | +2.9% GAP | 19393 | +3.9% GAP |

Cleric note. The guide lists no stigma specializations because stigma tiers are automatic. The harness's default for every published build keeps the unlocked tiers in tier order up to the engine's slot rule, which for the Cleric dropped Earth Punishment's tier 5 ("[Condemnation] lands as a Critical Hit"), the tier the guide's Cleric build rests on ("Condemnation always crits, so it has no cooldown"). That made the published Cleric 19% too low (8167 against 9716 in one pool). The Cleric rows now use stigma tiers chosen by DPS under the same slot rule, the best the engine's own rule allows (its "as published" column keeps the tier-ordered list). The other seven classes keep the tier-ordered list because the choice moves them by 0.0% to +0.8% (table 4.3).

### 3.2 Boss: other stigma sets (ranks and specialties allocated by the engine, same budget)

| Class | Community stigma set (boss) | Sources | Comm DPS (ship) | Ours (ship) | Delta | Comm DPS (all fixes) | Ours (all fixes) | Delta |
|---|---|---|---|---|---|---|---|---|
| Gladiator | Lunge Stance, Focused Block, Rage Burst, Zikel's Blessing | couga, questlog | 7418 | 7335 | +1.1% | 10678 | 10352 | +3.1% GAP |
| Gladiator | Lunge Stance, Focused Block, Rage Burst, Lifestealing Blade | couga-scrape | 7427 | 7335 | +1.2% | 10355 | 10352 | +0.0% |
| Gladiator | Lunge Stance, Rage Burst, Zikel's Blessing, Wave Armor | expcarry | 7114 | 7335 | -3.0% | 10265 | 10352 | -0.8% |
| Templar | Empyrean Lord's Punishment, Battlefield Banner, Doom Shield, Taunt | couga, aoeah | 9879 | 9879 | +0.0% | 12655 | 12446 | +1.7% |
| Templar | Empyrean Lord's Punishment, Battlefield Banner, Doom Shield, Nezekan's Shield | couga-scrape | 9879 | 9879 | +0.0% | 12663 | 12446 | +1.7% |
| Templar | Empyrean Lord's Punishment, Executing Blade, Battlefield Banner, Doom Shield | couga-scrape | 9879 | 9879 | +0.0% | 12655 | 12446 | +1.7% |
| Templar | Doom Shield, Battlefield Banner, Noble Armor, Shield of Protection | questlog | 9879 | 9879 | +0.0% | 12446 | 12446 | +0.0% |
| Templar | Taunt, Shield of Protection, Second Skin, Doom Shield | expcarry, gegebase | 9879 | 9879 | +0.0% | 12437 | 12446 | -0.1% |
| Templar | Taunt, Doom Shield, Shield of Protection, Empyrean Lord's Punishment | role-file | 9879 | 9879 | +0.0% | 12667 | 12446 | +1.8% |
| Assassin | Illusive Clone, Swift Contract, Savage Fang, Triniel's Dagger | couga, expcarry, questlog, aoeah | 8265 | 8324 | -0.7% | 9341 | 9220 | +1.3% |
| Ranger | Vaizel's Authority, Bow of Blessing, Supporting Fire, Griffon Arrow | couga, questlog | 5073 | 4962 | +2.2% GAP | 6595 | 6157 | +7.1% GAP |
| Ranger | Vaizel's Authority, Bow of Blessing, Supporting Fire, Explosive Arrow | couga-scrape | 4935 | 4962 | -0.5% | 6341 | 6157 | +3.0% GAP |
| Ranger | Vaizel's Authority, Bow of Blessing, Griffon Arrow, Explosive Arrow | aoeah | 5166 | 4962 | +4.1% GAP | 6565 | 6157 | +6.6% GAP |
| Ranger | Bow of Blessing, Explosive Arrow, Griffon Arrow, Arrow Storm | expcarry | 5027 | 4962 | +1.3% | 6213 | 6157 | +0.9% |
| Sorcerer | Element Enhancement, Cold Storm, Fire Wall, Delayed Explosion | couga, questlog, expcarry | 18962 | 17598 | +7.7% GAP | 29071 | 24743 | +17.5% GAP |
| Sorcerer | Element Enhancement, Fire Wall, Cold Storm, Steel Barrier | aoeah | 18962 | 17598 | +7.7% GAP | 27888 | 24743 | +12.7% GAP |
| Spiritmaster | Summon: Ancient Spirit, Enhance: Spirit's Benediction, Flame Blessing, Jointstrike: Corrode | couga, expcarry, aoeah | 4490 | 4428 | +1.4% | 5145 | 4990 | +3.1% GAP |
| Spiritmaster | Enhance: Spirit's Benediction, Summon: Ancient Spirit, Jointstrike: Corrode, Jointstrike: Destructive Attack | questlog | 4618 | 4428 | +4.3% GAP | 5443 | 4990 | +9.1% GAP |
| Spiritmaster | Command: Proxy, Enhance: Spirit's Benediction, Jointstrike: Corrode, Flame Blessing | gegebase | 4065 | 4428 | -8.2% | 4710 | 4990 | -5.6% |
| Cleric | Earth Punishment, Light of Protection, Prayer of Amplification, Noble Aura | couga, questlog, aoeah | 5225 | 5225 | +0.0% | 8392 | 8392 | +0.0% |
| Cleric | Earth Punishment, Absolution, Prayer of Amplification, Noble Aura | couga-scrape | 4428 | 5225 | -15.3% CHECK | 7189 | 8392 | -14.3% CHECK |
| Cleric | Benevolence, Absolution, Summon Resurrection, Yustiel's Power | expcarry, gegebase | 3713 | 5225 | -28.9% CHECK | 5019 | 8392 | -40.2% CHECK |
| Cleric | Salvation, Yustiel's Power, Light of Protection, Benevolence | inven | 4381 | 5225 | -16.2% CHECK | 5922 | 8392 | -29.4% CHECK |
| Chanter | Undefeated Mantra, Power of the Storm, Marchutan's Wrath, Focused Defense | couga | 15858 | 15869 | -0.1% | 19534 | 19581 | -0.2% |
| Chanter | Undefeated Mantra, Power of the Storm, Marchutan's Wrath, Sprint Mantra | couga-scrape, questlog | 15858 | 15869 | -0.1% | 19529 | 19581 | -0.3% |
| Chanter | Undefeated Mantra, Power of the Storm, Marchutan's Wrath, Obliterate | expcarry | 15869 | 15869 | +0.0% | 19572 | 19581 | -0.0% |
| Chanter | Undefeated Mantra, Marchutan's Wrath, Ensnaring Mark, Obliterate | aoeah | 15405 | 15869 | -2.9% | 18920 | 19581 | -3.4% |
| Chanter | Undefeated Mantra, Healing Touch, Impeding Authority, Barrier Spell | expcarry, gegebase | 15343 | 15869 | -3.3% | 19382 | 19581 | -1.0% |

### 3.3 AoE / farming / solo: stigma sets (couga54 AoE notes, expcarry, aoeah)

| Class | Community stigma set (AoE) | Sources | Comm DPS (ship) | Ours (ship) | Delta | Comm DPS (all fixes) | Ours (all fixes) | Delta |
|---|---|---|---|---|---|---|---|---|
| Gladiator | Lunge Stance, Zikel's Blessing, Focused Block, Rage Burst | couga-scrape, aoeah | 27140 | 25876 | +4.9% GAP | 31879 | 31376 | +1.6% |
| Gladiator | Lunge Stance, Zikel's Blessing, Focused Block, Lifestealing Blade | couga-scrape | 25524 | 25876 | -1.4% | 29926 | 31376 | -4.6% |
| Gladiator | Lunge Stance, Lifestealing Blade, Wave Armor, Rage Burst | expcarry | 25055 | 25876 | -3.2% | 29011 | 31376 | -7.5% |
| Templar | Empyrean Lord's Punishment, Doom Shield, Executing Blade, Battlefield Banner | couga-scrape | 50643 | 50643 | +0.0% | 59206 | 59995 | -1.3% |
| Templar | Grapple, Assault Fury, Doom Shield, Shield of Protection | expcarry | 50643 | 50643 | +0.0% | 58212 | 59995 | -3.0% |
| Assassin | Savage Fang, Illusive Clone, Swift Contract, Throw Shadowblade | couga-scrape | 39046 | 39046 | +0.0% | 48193 | 48193 | +0.0% |
| Assassin | Illusive Clone, Savage Fang, Throw Shadowblade, Evasion Stance | expcarry | 35552 | 39046 | -8.9% | 41993 | 48193 | -12.9% CHECK |
| Assassin | Illusive Clone, Swift Contract, Throw Shadowblade, Triniel's Dagger | aoeah | 37973 | 39046 | -2.7% | 42751 | 48193 | -11.3% CHECK |
| Ranger | Arrow Storm, Vaizel's Authority, Explosive Arrow, Bow of Blessing | couga-scrape | 19225 | 20621 | -6.8% | 25289 | 25941 | -2.5% |
| Ranger | Arrow Storm, Vaizel's Authority, Griffon Arrow, Bow of Blessing | couga-scrape | 20361 | 20621 | -1.3% | 27516 | 25941 | +6.1% GAP |
| Ranger | Explosive Arrow, Griffon Arrow, Arrow Storm, Mother Nature's Breath | expcarry | 19238 | 20621 | -6.7% | 22675 | 25941 | -12.6% CHECK |
| Sorcerer | Element Enhancement, Fire Wall, Glacial Smite, Delayed Explosion | couga-scrape | 75908 | 78732 | -3.6% | 133927 | 129307 | +3.6% GAP |
| Sorcerer | Element Enhancement, Fire Wall, Glacial Smite, Cold Storm | couga-scrape | 76273 | 78732 | -3.1% | 129504 | 129307 | +0.2% |
| Sorcerer | Element Enhancement, Fire Wall, Cold Storm, Steel Barrier | expcarry, aoeah | 76273 | 78732 | -3.1% | 129504 | 129307 | +0.2% |
| Spiritmaster | Summon: Ancient Spirit, Enhance: Spirit's Benediction, Flame Blessing, Jointstrike: Corrode | couga-scrape | 18063 | 18339 | -1.5% | 22452 | 22739 | -1.3% |
| Spiritmaster | Summon: Ancient Spirit, Seize Magic, Flame Blessing, Jointstrike: Corrode | couga-scrape | 17096 | 18339 | -6.8% | 18467 | 22739 | -18.8% CHECK |
| Spiritmaster | Summon: Ancient Spirit, Enhance: Spirit's Benediction, Cursed Cloud, Jointstrike: Corrode | expcarry | 18063 | 18339 | -1.5% | 22229 | 22739 | -2.2% |
| Cleric | Earth Punishment, Light of Protection, Prayer of Amplification, Noble Aura | couga-scrape | 22589 | 22731 | -0.6% | 30833 | 31710 | -2.8% |
| Cleric | Earth Punishment, Noble Aura, Prayer of Amplification, Power Burst | expcarry | 19143 | 22731 | -15.8% CHECK | 26631 | 31710 | -16.0% CHECK |
| Cleric | Earth Punishment, Noble Aura, Light of Protection, Yustiel's Power | aoeah | 21611 | 22731 | -4.9% | 26279 | 31710 | -17.1% CHECK |
| Chanter | Undefeated Mantra, Power of the Storm, Marchutan's Wrath, Obliterate | couga-scrape | 70020 | 69474 | +0.8% | 85194 | 85194 | +0.0% |
| Chanter | Undefeated Mantra, Sprint Mantra, Marchutan's Wrath, Guardian Blessing | expcarry, aoeah | 63304 | 69474 | -8.9% | 72923 | 85194 | -14.4% CHECK |

### 3.4 Does the engine pick the guide's stigmas?

| Class | Playstyle | Guide stigmas | Ours shipped | overlap | Ours +A+B+C | overlap | Ours +A+B+C+E | overlap |
|---|---|---|---|---|---|---|---|---|
| Gladiator | boss | Lunge Stance, Focused Block, Rage Burst, Zikel's Blessing | Rage Burst, Forced Restraint, Focused Block, Lunge Stance | 3/4 | Rage Burst, Forced Restraint, Focused Block, Lunge Stance | 3/4 | Rage Burst, Blade Toss, Lunge Stance, Focused Block | 3/4 |
| Gladiator | AoE | Lunge Stance, Zikel's Blessing, Focused Block, Rage Burst | Rage Burst, Zikel's Blessing, Lunge Stance, Wave Armor | 3/4 | Rage Burst, Zikel's Blessing, Lunge Stance, Wave Armor | 3/4 | Rage Burst, Zikel's Blessing, Lunge Stance, Focused Block | 4/4 |
| Templar | boss | Empyrean Lord's Punishment, Battlefield Banner, Doom Shield, Taunt | Doom Shield, Shield of Protection, Second Skin, Armor of Balance | 1/4 | Doom Shield, Shield of Protection, Second Skin, Armor of Balance | 1/4 | Doom Shield, Empyrean Lord's Punishment, Shield of Protection, Taunt | 3/4 |
| Templar | AoE | Empyrean Lord's Punishment, Doom Shield, Executing Blade, Battlefield Banner | Empyrean Lord's Punishment, Executing Blade, Blade Storm, Doom Shield | 3/4 | Empyrean Lord's Punishment, Executing Blade, Blade Storm, Doom Shield | 3/4 | Empyrean Lord's Punishment, Doom Shield, Shield of Protection, Taunt | 2/4 |
| Assassin | boss | Illusive Clone, Swift Contract, Savage Fang, Triniel's Dagger | Swift Contract, Illusive Clone, Savage Fang, Aerial Bind | 3/4 | Swift Contract, Illusive Clone, Savage Fang, Aerial Bind | 3/4 | Swift Contract, Illusive Clone, Savage Fang, Aerial Bind | 3/4 |
| Assassin | AoE | Savage Fang, Illusive Clone, Swift Contract, Throw Shadowblade | Swift Contract, Illusive Clone, Savage Fang, Throw Shadowblade | 4/4 | Swift Contract, Illusive Clone, Savage Fang, Throw Shadowblade | 4/4 | Illusive Clone, Swift Contract, Savage Fang, Assault Ambush | 3/4 |
| Ranger | boss | Vaizel's Authority, Bow of Blessing, Supporting Fire, Griffon Arrow | Griffon Arrow, Bow of Blessing, Explosive Arrow, Ambush Kick | 2/4 | Griffon Arrow, Bow of Blessing, Explosive Arrow, Ambush Kick | 2/4 | Griffon Arrow, Vaizel's Authority, Bow of Blessing, Explosive Arrow | 3/4 |
| Ranger | AoE | Arrow Storm, Vaizel's Authority, Explosive Arrow, Bow of Blessing | Griffon Arrow, Vaizel's Authority, Explosive Arrow, Ensnaring Trap | 2/4 | Griffon Arrow, Vaizel's Authority, Explosive Arrow, Ensnaring Trap | 2/4 | Griffon Arrow, Vaizel's Authority, Explosive Arrow, Ensnaring Trap | 2/4 |
| Sorcerer | boss | Element Enhancement, Cold Storm, Fire Wall, Delayed Explosion | Assault Bombardment, Glacial Smite, Cold Storm, Fire Wall | 2/4 | Assault Bombardment, Glacial Smite, Cold Storm, Fire Wall | 2/4 | Fire Wall, Element Enhancement, Cold Storm, Soul Freeze | 3/4 |
| Sorcerer | AoE | Element Enhancement, Fire Wall, Glacial Smite, Delayed Explosion | Fire Wall, Element Enhancement, Cold Storm, Delayed Explosion | 3/4 | Fire Wall, Element Enhancement, Cold Storm, Delayed Explosion | 3/4 | Fire Wall, Element Enhancement, Cold Storm, Delayed Explosion | 3/4 |
| Spiritmaster | boss | Summon: Ancient Spirit, Enhance: Spirit's Benediction, Flame Blessing, Jointstrike: Corrode | Summon: Ancient Spirit, Jointstrike: Corrode, Magic Block, Jointstrike: Destructive Attack | 2/4 | Summon: Ancient Spirit, Jointstrike: Corrode, Magic Block, Jointstrike: Destructive Attack | 2/4 | Summon: Ancient Spirit, Enhance: Spirit's Benediction, Jointstrike: Destructive Attack, Jointstrike: Corrode | 3/4 |
| Spiritmaster | AoE | Summon: Ancient Spirit, Enhance: Spirit's Benediction, Flame Blessing, Jointstrike: Corrode | Summon: Ancient Spirit, Enhance: Spirit's Benediction, Jointstrike: Corrode, Seize Magic | 3/4 | Summon: Ancient Spirit, Enhance: Spirit's Benediction, Jointstrike: Corrode, Seize Magic | 3/4 | Summon: Ancient Spirit, Enhance: Spirit's Benediction, Jointstrike: Corrode, Assault Terror | 3/4 |
| Cleric | boss | Earth Punishment, Light of Protection, Prayer of Amplification, Noble Aura | Noble Aura, Light of Protection, Prayer of Amplification, Earth Punishment | 4/4 | Noble Aura, Light of Protection, Prayer of Amplification, Earth Punishment | 4/4 | Light of Protection, Noble Aura, Prayer of Amplification, Earth Punishment | 4/4 |
| Cleric | AoE | Earth Punishment, Light of Protection, Prayer of Amplification, Noble Aura | Light of Protection, Prayer of Amplification, Noble Aura, Assault Mark | 3/4 | Light of Protection, Prayer of Amplification, Noble Aura, Assault Mark | 3/4 | Light of Protection, Noble Aura, Prayer of Amplification, Assault Mark | 3/4 |
| Chanter | boss | Undefeated Mantra, Power of the Storm, Marchutan's Wrath, Focused Defense | Undefeated Mantra, Power of the Storm, Obliterate, Fracturing Blow | 2/4 | Undefeated Mantra, Power of the Storm, Obliterate, Fracturing Blow | 2/4 | Undefeated Mantra, Power of the Storm, Obliterate, Fracturing Blow | 2/4 |
| Chanter | AoE | Undefeated Mantra, Power of the Storm, Marchutan's Wrath, Obliterate | Undefeated Mantra, Power of the Storm, Obliterate, Fracturing Blow | 3/4 | Undefeated Mantra, Power of the Storm, Obliterate, Fracturing Blow | 3/4 | Undefeated Mantra, Power of the Storm, Fracturing Blow, Focused Defense | 2/4 |

Average overlap with the guide's four (of 4): boss 2.4 shipped, 2.4 after A+B+C, 3.0 after A+B+C+E (all four in 1 of 8, 1 of 8, 1 of 8 classes); AoE 3.0, 3.0, 2.8 (all four in 1 of 8, 1 of 8, 1 of 8 classes). Zero-gain filler stigmas fill the slots the engine finds nothing for, so a low overlap is not always a worse build.

### 3.5 The literal `webapi.compare(b, 0)` on the plain import

What the product itself returns for the plain DarthThot import moved to each class, with no points to spend (every rank stays 1, Daevanion 0), shipped engine, default search budget (`out/lit_*.json`). These DPS values are far below every other number in this report because no rank is bought; the stigmas are chosen at rank 1 against the seed rotation, which is the situation defects 3 and 8 describe.

| Class | Boss: engine stigmas (rank 1, no points) | DPS | Overlap with the guide's PvE four | AoE: engine stigmas | DPS | Overlap with the guide's AoE four |
|---|---|---|---|---|---|---|
| Gladiator | Rage Burst, Assault Strike, Lunge Stance, Zikel's Blessing | 3587 | 3/4 | Zikel's Blessing, Rage Burst, Lunge Stance, Wave Armor | 15185 | 3/4 |
| Templar | Empyrean Lord's Punishment, Doom Shield, Executing Blade, Taunt | 4834 | 3/4 | Doom Shield, Empyrean Lord's Punishment, Executing Blade, Blade Storm | 21193 | 3/4 |
| Assassin | Swift Contract, Illusive Clone, Savage Fang, Aerial Bind | 3821 | 3/4 | Swift Contract, Illusive Clone, Savage Fang, Throw Shadowblade | 17481 | 4/4 |
| Ranger | Griffon Arrow, Vaizel's Authority, Explosive Arrow, Ambush Kick | 3071 | 2/4 | Griffon Arrow, Vaizel's Authority, Explosive Arrow, Ensnaring Trap | 12282 | 2/4 |
| Sorcerer | Fire Wall, Cold Storm, Element Enhancement, Assault Bombardment | 8867 | 3/4 | Fire Wall, Element Enhancement, Cold Storm, Delayed Explosion | 35566 | 3/4 |
| Spiritmaster | Jointstrike: Destructive Attack, Siphon, Summon: Ancient Spirit, Enhance: Spirit's Benediction | 2555 | 2/4 | Summon: Ancient Spirit, Enhance: Spirit's Benediction, Jointstrike: Corrode, Assault Terror | 10414 | 3/4 |
| Cleric | Noble Aura, Light of Protection, Prayer of Amplification, Earth Punishment | 3070 | 4/4 | Light of Protection, Prayer of Amplification, Noble Aura, Assault Mark | 11051 | 3/4 |
| Chanter | Undefeated Mantra, Power of the Storm, Obliterate, Fracturing Blow | 6844 | 2/4 | Undefeated Mantra, Power of the Storm, Obliterate, Fracturing Blow | 33845 | 3/4 |


## 4. Why the shipped engine trails: ten defects, each reproduced

Defects 1 to 3 explain nearly all of the boss gap at HEAD and are mechanical (section 4.1); 4 to 6 are smaller. Defects 7 to 10 are what is left once those are patched: how ranks and tiers are valued and how specialties are chosen (section 4.2). Defects 8 and 9 are model questions (data and rule), not code bugs, and 9 is not verified in game. Patch letters are the diagnostics from section 2.

| # | Defect | Where | Evidence |
|---|---|---|---|
| 1 | Specialties are equipped on **one skill only** | `engine/specialties.py:80` | `choose_specs` visits skills best-first and skips a skill when `first[k] <= cur * (1 + MIN_GAIN)`. `first[k]` is the DPS with only that skill's best option, `cur` is the running DPS after the earlier skills got theirs, so every skill after the first fails the test. In every shipped output exactly one skill carries specialties; with the test fixed (A) the same builds carry 3-9 skills with specialties and with A+B+C 4-9. On the same build and rotation (16 class and playstyle builds) the shipped chooser equips specialties on 1 skill, the fixed one on 2-8, and the build gains +1% to +37% (median +12%) |
| 2 | Stigma purchases stop at rank 10 and never reach the high tiers | `engine/budget.py:56` (cap), `:84-118` (one rank at a time) | The cap is `min(BASE_RANK_CAP=10, ...)` for the stigma pool too (the docstring promises the region cap, 20, and the guides run their main stigma at 15-20); a tier that sits behind zero-gain ranks (Zikel's Blessing r10, Swift Contract r10, Element Enhancement r10, Corrode r5-20) is invisible to a one-rank-at-a-time greedy. The shipped engine spends 14-56 stigma points out of budgets of 82-296; with the stigma cap and the lookahead (B+C) it spends 70-100% of the budget |
| 3 | Stigmas, ranks and step-3b specialties are scored against the **greedy seed rotation**, the rotation search runs afterwards | `engine/build_optimizer.py:84-87`, `:122-135`, `:421-436` | Casts gated on a status (`require_status`) exist only in searched rotations. Spiritmaster: Corrode rank 1 to 20 changes DPS by 0.0% under the seed priority and by +9% under the searched one (`Combustion[corrode_debuff]`), so Corrode stays at rank 1 and the build trails; Gladiator AoE: Focused Block is worth +32% in the model but is not picked. Patch E (plan a second time against the searched rotation) recovers it, see the E column |
| 4 | The stigma pool contains stigmas that do not exist in Global | `engine/build_optimizer.py:126` (`unlock_level is None` passes) | One or two per class have no unlock level and no tiers (Templar Blade Storm, Gladiator Doom Advent, Assassin Frenzied Accord and Prepare to Assassinate, Sorcerer Lumiel's Authority); questlog and the guides list exactly 13 stigmas per class without them. The shipped Templar AoE pick contains Blade Storm at shipped, +A and +A+B+C (E drops it) |
| 5 | The point allocator skips PROC skills | `engine/budget.py:22` (`_SKIP`) | Assassin Heart Gore (the guide's #1 skill, kind PROC), Whirlwind Slice and Spiritmaster Dimensional Control can never receive recommended ranks (here both sides were given the guide's rank) |
| 6 | Many specialty effects the guides pick for damage are worth 0 to the engine | `specparse.py` (`unknown`), `engine/specialties.py:32` (`_matters`) | Multi-Hit (value unknown), "extra damage on hit", "Critical Hit on hit" on some skills, Perfect Chance, -10% cooldowns on hit (Triniel's Dagger), Enhanced Frostbite/Embers. Measured on the guide's own builds, 12 (Sorcerer) to 26 (Spiritmaster) of the options each guide picks change DPS by 0.05% or less in the model (many are mobility, defence or crowd-control picks); the chooser can neither pick nor price the damage ones among them |
| 7 | The allocator values a rank by its **best single specialty option** | `engine/budget.py:65-82` (`dps_at`; its docstring says so) | A rank that opens a second or third slot (slots open at 8, 12 and 20) is valued as if it still had one slot, so ranks whose payoff is the extra slots look worthless. Chanter Undefeated Mantra carries +100 Critical Hit (r5), +5% Critical Damage (r15) and +5% Double Chance (r20): in the guide's build, 20 against 5 is worth +5.8% to the build, the allocator stops at 5. Patch F (value a rank with all its open slots) tests this in section 4.2 |
| 8 | Buff statuses are valued at **one fixed rank**, whatever rank the build holds | game data, `statuses` in `aion2c/data/classes/*/gamedata.json` (built by `data/build_gamedata.py`) | The data values 31 statuses in 6 classes at one anchor rank (the data notes say "rank 20 used", "rank 16 used as the typical rank", "rank 10 used") whatever rank the build holds; 26 of them (buff durations and magnitudes with client anchor points) are re-valued in section 4.2. Light of Protection is +18% PvE Damage Boost at rank 1 (client: 10.5% at rank 1, 18% at 16, 20% at 20), Element Enhancement lasts 20 s at rank 1 (client: 10 s), Vaizel's Authority 20 s at rank 1, Prayer of Amplification 17.5 s at any rank, Undefeated Mantra +18% at any rank. The data notes say so ("rank 20 used", "rank 16 used as the typical rank"). Two consequences: the allocator sees no gain from ranking these stigmas up, and the chooser can take them at rank 1 and be credited with their top-rank effect (Cleric Light of Protection 1, Sorcerer Element Enhancement 1, Ranger Vaizel's Authority 1, Cleric Prayer of Amplification 1 all appear in the +E builds). Re-scoring the same builds with rank-aware values and patch G are in section 4.2 |
| 9 | Stigma specialty tiers are limited by the core-skill mastery slots (model rule, **not verified in game**) | `specs.py:active_options` (`room = max(slots_at(rank), 1)`) | A stigma has four tiers (options at rank 5, 10, 15, 20). The engine lets it use 1 of 1 at rank 5, 1 of 2 at 10, 2 of 3 at 15 and 3 of 4 at 20, because mastery slots open at 8, 12 and 20 for every skill. The repo's own client-table note (`research/client_tables_recon_2026-10-04.md:71`) lists five stigma slot rows unlocked at 0 next to the three mastery slots, and the guides treat tiers as automatic ("Earth Punishment 5 forces a Condemnation crit"). If every unlocked tier is active, the engine under-credits each stigma at rank 10 to 20 by a tier. Effect on the published builds: choosing the stigma tiers by DPS under the slot rule instead of by tier order moves the published build by Cleric +19.0%, Gladiator +0.8% (0.0% elsewhere); lifting the cap so every unlocked tier is active moves it by Cleric +23.7%, Sorcerer +1.4% (0.0% elsewhere), table 4.3 |
| 10 | Specialty options are chosen **one at a time**, so a pair that pays only together is never found | `engine/specialties.py` (`choose_specs`) | Cleric: Earth Punishment tier 5 ("[Condemnation] lands as a Critical Hit on targets afflicted with [Earth Punishment]") and Condemnation rank 12 ("Resets cooldown on landing a Critical Hit") are worth little alone at low crit and a lot together; the couga54 guide's own wording is "Condemnation always crits, so it has no cooldown". The guide's build has the pair, the engine's +A+B+C build does not, and adding the pair (one Earth Punishment tier swapped, the reset added) to the engine's own +A+B+C build gives +16.6% (8392 to 9785, one pool). With geared stats (crit 50%) each half has value alone and the engine finds the pair (section 7.1) |

Defect 1 in twenty lines (runs on the repo's own `tests/fixtures/mini_gamedata.json`; two skills, each with one option worth +50% damage; the fix keeps all 50 tests in `tests/test_specialties.py` green, they pass with and without it, so they do not cover it):

```python
g2 = with_spec(with_spec(gd, "strike", 1.5), "nuke", 1.5)   # one "+50% damage" option on each skill
chosen = choose_specs(g2, CharacterBuild("t", "global", 45), Priority((PriorityEntry("nuke"), PriorityEntry("strike"))), Scenario("t10", "t", 10, 1, False))
# chosen == {'nuke': (0,)}  DPS 2050;  equipping both gives DPS 2400 (+17%);  no specialty at all gives 1600
```

Fix for 1: compare `first[k]` with the DPS the whole loop started from (`cur0`), not with the running `cur`; the inner loop already demands a gain over the running DPS for each option. The scratch copy is `make_choose` in `scratchpad/cb/cblib.py`.

### 4.1 What patches A to E give the engine's own build

| Class | Playstyle | Stigma budget | Spent, shipped | Spent, +B+C | Skills with specialties, shipped | +A | +A+B+C |
|---|---|---|---|---|---|---|---|
| Gladiator | boss | 96 | 42 | 96 | 1 | 9 | 8 |
| Gladiator | AoE | 96 | 28 | 94 | 1 | 5 | 6 |
| Templar | boss | 106 | 14 | 74 | 1 | 5 | 5 |
| Templar | AoE | 106 | 28 | 100 | 1 | 4 | 6 |
| Assassin | boss | 156 | 42 | 156 | 1 | 5 | 7 |
| Assassin | AoE | 156 | 28 | 146 | 1 | 4 | 5 |
| Ranger | boss | 116 | 42 | 112 | 1 | 8 | 9 |
| Ranger | AoE | 116 | 42 | 116 | 1 | 6 | 7 |
| Sorcerer | boss | 116 | 56 | 114 | 1 | 7 | 9 |
| Sorcerer | AoE | 116 | 28 | 92 | 1 | 6 | 9 |
| Spiritmaster | boss | 296 | 42 | 222 | 1 | 6 | 8 |
| Spiritmaster | AoE | 296 | 28 | 222 | 1 | 3 | 4 |
| Cleric | boss | 176 | 28 | 152 | 1 | 8 | 9 |
| Cleric | AoE | 176 | 28 | 152 | 1 | 5 | 6 |
| Chanter | boss | 82 | 28 | 76 | 1 | 4 | 6 |
| Chanter | AoE | 82 | 14 | 72 | 1 | 4 | 6 |

How much each patch gives the engine's own build (model DPS; the first three columns come from one run, D and E from separate runs and are shown as their change inside that run):

| Class | Playstyle | Ours shipped | +A (specialty chooser) | +A+B+C (and stigma cap, tier lookahead) | E: plan again vs searched rotation | D: rank-aware stigma choice |
|---|---|---|---|---|---|---|
| Gladiator | boss | 7335 | 9879 (+35%) | 10352 (+41%) | 10265 (-0.4% vs +A+B+C) | 10678 (+3.6% vs +A+B+C) |
| Gladiator | AoE | 25876 | 28543 (+10%) | 31376 (+21%) | 32327 (+3.0% vs +A+B+C) | 31376 (+0.0% vs +A+B+C) |
| Templar | boss | 9879 | 12412 (+26%) | 12446 (+26%) | 12315 (-0.7% vs +A+B+C) | 12395 (+0.0% vs +A+B+C) |
| Templar | AoE | 50643 | 57525 (+14%) | 59995 (+18%) | 59503 (-0.8% vs +A+B+C) | 59968 (-0.0% vs +A+B+C) |
| Assassin | boss | 8324 | 8524 (+2%) | 9220 (+11%) | 9484 (+2.2% vs +A+B+C) | 9145 (+0.0% vs +A+B+C) |
| Assassin | AoE | 39046 | 41147 (+5%) | 48193 (+23%) | 48193 (+0.0% vs +A+B+C) | 48193 (+0.0% vs +A+B+C) |
| Ranger | boss | 4962 | 6061 (+22%) | 6157 (+24%) | 6398 (+3.9% vs +A+B+C) | 6448 (+4.7% vs +A+B+C) |
| Ranger | AoE | 20621 | 23673 (+15%) | 25941 (+26%) | 26326 (+1.5% vs +A+B+C) | 25941 (+0.0% vs +A+B+C) |
| Sorcerer | boss | 17598 | 22698 (+29%) | 24743 (+41%) | 27254 (+10.6% vs +A+B+C) | 27971 (+13.5% vs +A+B+C) |
| Sorcerer | AoE | 78732 | 103171 (+31%) | 129307 (+64%) | 129955 (+0.5% vs +A+B+C) | 127722 (-1.2% vs +A+B+C) |
| Spiritmaster | boss | 4428 | 4745 (+7%) | 4990 (+13%) | 5817 (+16.6% vs +A+B+C) | 5130 (+2.8% vs +A+B+C) |
| Spiritmaster | AoE | 18339 | 18740 (+2%) | 22739 (+24%) | 25446 (+11.9% vs +A+B+C) | 23609 (+3.8% vs +A+B+C) |
| Cleric | boss | 5225 | 6834 (+31%) | 8392 (+61%) | 8518 (+1.5% vs +A+B+C) | 8392 (+0.0% vs +A+B+C) |
| Cleric | AoE | 22731 | 27510 (+21%) | 31710 (+39%) | 31710 (+0.0% vs +A+B+C) | 31710 (+0.0% vs +A+B+C) |
| Chanter | boss | 15869 | 18115 (+14%) | 19581 (+23%) | 19393 (-1.0% vs +A+B+C) | 19581 (+0.0% vs +A+B+C) |
| Chanter | AoE | 69474 | 75096 (+8%) | 85194 (+23%) | 82394 (-3.3% vs +A+B+C) | 82409 (-3.3% vs +A+B+C) |

Reading it: Patch A alone moves our own build by +2% (Spiritmaster AoE) to +35% (Gladiator boss). B+C add +0% (Templar boss) to +25% (Sorcerer AoE) on top; all three together range from +11% (Assassin boss) to +64% (Sorcerer AoE). E (plan a second time against the searched rotation) helps where a stigma's value depends on a status only the searched rotation creates (Spiritmaster boss +16.6%, Spiritmaster AoE +11.9%, Sorcerer boss +10.6%, Ranger boss +3.9%, Gladiator AoE +3.0%, Assassin boss +2.2%, Cleric boss +1.5%, Ranger AoE +1.5%) and costs Chanter AoE -3.3% elsewhere; the other changes it makes are inside the search noise. D (score stigma sets at the level the budget can afford) helps Sorcerer boss +13.5%, Ranger boss +4.7%, Spiritmaster AoE +3.8%, Gladiator boss +3.6%, Spiritmaster boss +2.8% and costs Chanter AoE -3.3%, Sorcerer AoE -1.2%, so it is not a clean fix either.

The shipped engine is therefore behind mainly because it never gives most skills specialties and never spends most of the stigma budget, not because of its search. The next table isolates allocation from stigma choice: the guide's own four stigmas, with either the guide or the engine allocating the levels, ranks and specialties (same rotation pool, boss).

| Class | Guide's four stigmas (levels) | Guide's allocation | Engine allocates the same four, shipped | Engine, +A+B+C | Guide vs engine, shipped | Guide vs engine, +A+B+C |
|---|---|---|---|---|---|---|
| Gladiator | Lunge Stance 20, Focused Block 5, Rage Burst 5, Zikel's Blessing 10 | 9712 | 7418 | 10678 | +30.9% | -9.0% |
| Templar | Empyrean Lord's Punishment 15, Battlefield Banner 15, Doom Shield 15, Taunt 5 | 11505 | 9879 | 12655 | +16.5% | -9.1% |
| Assassin | Illusive Clone 20, Swift Contract 15, Savage Fang 15, Triniel's Dagger 10 | 9110 | 8265 | 9341 | +10.2% | -2.5% |
| Ranger | Vaizel's Authority 20, Bow of Blessing 10, Supporting Fire 10, Griffon Arrow 10 | 6620 | 5073 | 6595 | +30.5% | +0.4% |
| Sorcerer | Element Enhancement 20, Cold Storm 10, Fire Wall 10, Delayed Explosion 10 | 26901 | 18962 | 29071 | +41.9% | -7.5% |
| Spiritmaster | Summon: Ancient Spirit 20, Enhance: Spirit's Benediction 20, Flame Blessing 20, Jointstrike: Corrode 20 | 5498 | 4490 | 5145 | +22.4% | +6.9% |
| Cleric | Earth Punishment 20, Light of Protection 20, Prayer of Amplification 10, Noble Aura 10 | 9716 | 5225 | 8392 | +85.9% | +15.8% |
| Chanter | Undefeated Mantra 20, Power of the Storm 5, Marchutan's Wrath 1, Focused Defense 5 | 20188 | 15858 | 19534 | +27.3% | +3.3% |

With the guide's four stigmas handed to it, the patched engine beats the guide's own allocation in five classes (Gladiator, Templar, Sorcerer, Cleric, Assassin), ties in Ranger and trails in Spiritmaster and Chanter. That points at how ranks and specialties are valued rather than at the search (section 4.2).

### 4.2 What is left after A+B+C+E: defects 7 to 10

After A+B+C+E the published build still beats ours in Cleric (+14.8%), Chanter (+3.9%) and Ranger (+3.5%) (table 3.1). Three further checks: which stigma level carries the lead in Chanter and Ranger, whether the "ours ahead" cases survive rank-aware buff values, and what the engine does when it plans with all specialty slots (F) and rank-aware values (G). The Cleric's lead is the specialty pair of defect 10 and is read in section 6.

**Which stigma level carries the guide's lead.** The guide's build with one stigma level changed at a time (point budget ignored, stigma tiers re-derived), pool of four rotations; each number is the DPS change against the unmodified guide build, and only changes of 1% or more are listed:

- Chanter (published 20148, ours +A+B+C+E 19189, guide +5.0% in this pool): Undefeated Mantra at 1 (guide 20) -9.5%; Undefeated Mantra at 5 (guide 20) -5.8%; Undefeated Mantra at 10 (guide 20) -5.8%; Undefeated Mantra at 15 (guide 20) -4.8%; Power of the Storm at 15 (guide 5) +1.9%; Power of the Storm at 20 (guide 5) +4.2%.
- Ranger (published 6620, ours +A+B+C+E 6250, guide +5.9% in this pool): Vaizel's Authority at 1 (guide 20) -4.1%; Vaizel's Authority at 5 (guide 20) -4.1%; Bow of Blessing at 15 (guide 10) +1.3%; Bow of Blessing at 20 (guide 10) +3.2%; Supporting Fire at 20 (guide 10) +1.7%; Griffon Arrow at 1 (guide 10) -2.3%; Griffon Arrow at 5 (guide 10) -2.1%.

In both classes the lead sits on a stigma that the engine leaves at a low rank: Undefeated Mantra 20 (Chanter) and Vaizel's Authority 20 (Ranger). In the guide's Chanter build, Undefeated Mantra at 5 instead of 20 costs 5.8%, and 4.8 points of that come between rank 15 and rank 20, where the +5% Double Chance tier (rank 20 only) and the third specialty slot appear. The allocator values a rank by a single option (defect 7) and the data gives the buff +18% at every rank (defect 8), so it has little reason to buy those ranks; the F and G runs below test that.

**Rank-aware re-score (defect 8).** The same builds, published and ours, scored with the 26 re-valued statuses at the build's own ranks. Both sides are re-valued; only the rank-dependent statuses change. This is a re-score of the builds the rank-blind engine chose, so it overstates the loss a corrected engine would show (it would plan differently):

| Class | Re-valued source skills, rank in the guide's build / in ours (+A+B+C+E) | Published vs ours, +A+B+C, model / rank-aware | Published vs ours, +A+B+C+E, model / rank-aware |
|---|---|---|---|
| Gladiator | Lunge Stance 20 / 12, Zikel's Blessing 10 / - | -5.3% / -3.3% | -5.8% / -5.1% |
| Templar | Battlefield Banner 15 / - | -7.6% / -7.9% | -6.7% / -7.0% |
| Ranger | Bow of Blessing 10 / 20, Vaizel's Authority 20 / 1 | +9.3% / +9.2% | +4.2% / +5.7% |
| Sorcerer | Element Enhancement 20 / 1, Wish of Concentration 16 / 14 | +8.7% / +8.1% | +0.2% / +2.7% |
| Spiritmaster | Flame Blessing 20 / - | +10.2% / +11.3% | -2.6% / -1.6% |
| Cleric | Light of Protection 20 / 1, Prayer of Amplification 10 / 1 | +15.8% / +26.9% | +14.0% / +24.3% |
| Chanter | Power of the Storm 5 / 15, Undefeated Mantra 20 / 5 | +2.7% / +7.6% | +3.7% / +8.7% |

**Patches F and G on the engine's own plan (boss).** F values a rank with every specialty slot it has open; G makes every `simulate` call in the engine see the buff statuses at the build's own ranks, so the engine plans under the rank-aware model. The published build is scored under the model its row uses (shipped model for the first block, rank-aware for the second); all rows come from one pool per class, two seeds.

| Class | Published (shipped model) | Ours +A+B+C+E | Ours +F | Ours +F+E | Published (rank-aware model) | Ours +F+G | Ours +F+G+E |
|---|---|---|---|---|---|---|---|
| Gladiator | 9605 | 10205 (-5.9%) | 10284 (-6.6%) | 10427 (-7.9%) | 9698 | 9831 (-1.3%) | 9907 (-2.1%) |
| Templar | 11502 | 12308 (-6.5%) | 12308 (-6.5%) | 12308 (-6.5%) | 11469 | 12308 (-6.8%) | 12308 (-6.8%) |
| Assassin | 9110 | 9275 (-1.8%) | 9275 (-1.8%) | 9275 (-1.8%) | 9110 | 9275 (-1.8%) | 9275 (-1.8%) |
| Ranger | 6620 | 6250 (+5.9%) | 6227 (+6.3%) | 6304 (+5.0%) | 6583 | 6227 (+5.7%) | 6153 (+7.0%) |
| Sorcerer | 26837 | 26667 (+0.6%) | 24620 (+9.0%) | 27245 (-1.5%) | 26634 | 27535 (-3.3%) | 28645 (-7.0%) |
| Spiritmaster | 5498 | 5817 (-5.5%) | 4988 (+10.2%) | 5817 (-5.5%) | 5615 | 4988 (+12.6%) | 5817 (-3.5%) |
| Cleric | 9696 | 8448 (+14.8%) | 8469 (+14.5%) | 8469 (+14.5%) | 9750 | 7874 (+23.8%) | 7874 (+23.8%) |
| Chanter | 20148 | 19189 (+5.0%) | 19581 (+2.9%) | 19925 (+1.1%) | 20238 | 20042 (+1.0%) | 20032 (+1.0%) |

F alone (the Ours +F+E column against Ours +A+B+C+E) moves our own score by Chanter +3.8%, Gladiator +2.2%, Sorcerer +2.2%, Ranger +0.9% (under 0.5% elsewhere): small, but with E it is enough for the allocator to buy Undefeated Mantra 20 in the Chanter, which closes that class to +1.1%. G changes what the engine believes about the buffs it plans with, and it moves the guide-minus-ours delta in both directions: toward the guide in Cleric (+14.5% to +23.8%), Gladiator (-7.9% to -2.1%), Spiritmaster (-5.5% to -3.5%), toward ours in Sorcerer (-1.5% to -7.0%) (delta with F+E under the shipped model to delta with F+G+E under the rank-aware model). After F+G+E the guide is ahead by more than 2% in Cleric (+23.8%), Ranger (+7.0%); ours is ahead or level in Sorcerer (-7.0%), Templar (-6.8%), Spiritmaster (-3.5%), Gladiator (-2.1%), Assassin (-1.8%), Chanter (+1.0%). The G column is built from the client anchor points quoted in the data notes (my reading of those notes, not a client dump), and each delta is computed under the model its row names, so it says what the engine finds when its model values buffs by rank, not what the game does.

### 4.3 The stigma tier rule on the published builds (defect 9)

The guide's own build, scored three ways in one rotation pool (boss, DarthThot stats). A is the tier-ordered list the harness first used (every unlocked tier, damage-relevant first and high tier first, then cut to the engine's 1/1/2/3 tiers); B lets the engine choose the best tiers under the same slot rule; C lifts the slot rule for stigmas so every unlocked tier is active (core-skill picks and the engine's fill of open mastery slots are the same in all three):

| Class | A: stigma tiers in tier order, slot rule | B: best tiers by DPS under the slot rule | C: every unlocked tier active |
|---|---|---|---|
| Gladiator | 8640 | 8711 (+0.8%) | 8640 (+0.0%) |
| Templar | 11505 | 11505 (+0.0%) | 11505 (+0.0%) |
| Assassin | 9110 | 9110 (+0.0%) | 9110 (+0.0%) |
| Ranger | 6620 | 6620 (+0.0%) | 6620 (+0.0%) |
| Sorcerer | 26869 | 26869 (+0.0%) | 27252 (+1.4%) |
| Spiritmaster | 5498 | 5498 (+0.0%) | 5498 (+0.0%) |
| Cleric | 8167 | 9716 (+19.0%) | 10106 (+23.7%) |
| Chanter | 20188 | 20188 (+0.0%) | 20188 (+0.0%) |

Only the Cleric moves materially (the next largest changes are Sorcerer +1.4% with C and Gladiator +0.8% with B). Earth Punishment's tier 5, "[Condemnation] lands as a Critical Hit", is the tier the guide's build is built around ("Condemnation always crits, so it has no cooldown") and the tier-ordered cut dropped it. The Cleric's published numbers in this report therefore use B (the best the engine's own rule allows), which is conservative against the guide: with C the guide's build is another 4% higher.


## 5. Flagged cases

Threshold hits at the shipped level or after +A+B+C (each row shows all levels). The reason column is generated from the numbers; section 6 has the per-class reading.

### 5.1 Community build beats ours by more than 2% (likely engine gap)

| # | Class | Playstyle | Community build | Shipped | +A | +A+B+C | +A+B+C+E | Reason |
|---|---|---|---|---|---|---|---|---|
| 1 | Gladiator | boss | published couga54 PvE | +30.9% | -2.2% | -6.6% | -6.4% | patch A +34%, B+C +5%, E -0% on ours |
| 2 | Gladiator | boss | Lunge Stance, Focused Block, Rage Burst, Zikel's Blessing (couga, questlog) | +1.1% | +0.3% | +3.1% | +4.0% | community-only worth: Zikel's Blessing +4.0% (rank 10); ours-only at ~0%: Forced Restraint; ranks ours vs community: Focused Block 1 vs 5 |
| 3 | Gladiator | AoE | Lunge Stance, Zikel's Blessing, Focused Block, Rage Burst (couga-scrape, aoeah) | +4.9% | +1.7% | +1.6% | -0.0% | community-only worth: Focused Block +4.1% (rank 1); ours-only at ~0%: Wave Armor |
| 4 | Templar | boss | published couga54 PvE | +16.5% | -6.9% | -7.2% | -6.5% | patch A +25%, B+C +0%, E -1% on ours |
| 5 | Assassin | boss | published couga54 PvE | +9.4% | +6.7% | -1.8% | -3.9% | patch A +3%, B+C +9%, E +2% on ours |
| 6 | Ranger | boss | published couga54 PvE | +33.9% | +9.2% | +7.5% | +3.5% | patch A +23%, B+C +2%, E +4% on ours |
| 7 | Ranger | boss | Vaizel's Authority, Bow of Blessing, Supporting Fire, Griffon Arrow (couga, questlog) | +2.2% | +2.4% | +7.1% | +2.6% | community-only worth: Vaizel's Authority +7.3% (rank 10); ours-only worth: Explosive Arrow +2.7% (rank 15); community-only at ~0%: Supporting Fire; ours-only at ~0%: Ambush Kick; ranks ours vs community: Bow of Blessing 15 vs 20 |
| 8 | Ranger | boss | Vaizel's Authority, Bow of Blessing, Supporting Fire, Explosive Arrow (couga-scrape) | -0.5% | -1.5% | +3.0% | -2.0% | community-only worth: Vaizel's Authority +7.3% (rank 10), Supporting Fire +5.3% (rank 15); ours-only worth: Griffon Arrow +6.3% (rank 11); ours-only at ~0%: Ambush Kick |
| 9 | Ranger | boss | Vaizel's Authority, Bow of Blessing, Griffon Arrow, Explosive Arrow (aoeah) | +4.1% | +2.2% | +6.6% | +2.1% | community-only worth: Vaizel's Authority +6.7% (rank 10); ours-only at ~0%: Ambush Kick; ranks ours vs community: Griffon Arrow 11 vs 15 |
| 10 | Ranger | AoE | Arrow Storm, Vaizel's Authority, Griffon Arrow, Bow of Blessing (couga-scrape) | -1.3% | +3.1% | +6.1% | +4.3% | community-only worth: Arrow Storm +3.1% (rank 15), Bow of Blessing +11.6% (rank 15); ours-only worth: Explosive Arrow +4.2% (rank 15), Ensnaring Trap +3.5% (rank 15) |
| 11 | Sorcerer | boss | published couga54 PvE | +53.2% | +18.9% | +8.8% | -1.5% | patch A +29%, B+C +9%, E +11% on ours |
| 12 | Sorcerer | boss | Element Enhancement, Cold Storm, Fire Wall, Delayed Explosion (couga, questlog, expcarry) | +7.7% | +13.3% | +17.5% | +6.7% | community-only worth: Element Enhancement +9.6% (rank 10), Delayed Explosion +1.2% (rank 11); ours-only at ~0%: Assault Bombardment, Glacial Smite |
| 13 | Sorcerer | boss | Element Enhancement, Fire Wall, Cold Storm, Steel Barrier (aoeah) | +7.7% | +8.4% | +12.7% | +2.3% | community-only worth: Element Enhancement +13.5% (rank 10); community-only at ~0%: Steel Barrier; ours-only at ~0%: Assault Bombardment, Glacial Smite |
| 14 | Sorcerer | AoE | Element Enhancement, Fire Wall, Glacial Smite, Delayed Explosion (couga-scrape) | -3.6% | +1.9% | +3.6% | +3.1% | ours-only worth: Cold Storm +3.0% (rank 5); community-only at ~0%: Glacial Smite |
| 15 | Spiritmaster | boss | published couga54 PvE | +24.3% | +15.9% | +10.2% | -5.5% | patch A +7%, B+C +5%, E +17% on ours |
| 16 | Spiritmaster | boss | Summon: Ancient Spirit, Enhance: Spirit's Benediction, Flame Blessing, Jointstrike: Corrode (couga, expcarry, aoeah) | +1.4% | -0.4% | +3.1% | -11.6% | community-only worth: Enhance: Spirit's Benediction +9.3% (rank 10); ours-only worth: Jointstrike: Destructive Attack +7.0% (rank 20); community-only at ~0%: Flame Blessing; ours-only at ~0%: Magic Block |
| 17 | Spiritmaster | boss | Enhance: Spirit's Benediction, Summon: Ancient Spirit, Jointstrike: Corrode, Jointstrike: Destructive Attack (questlog) | +4.3% | +3.1% | +9.1% | -6.1% | community-only worth: Enhance: Spirit's Benediction +10.3% (rank 10); ours-only at ~0%: Magic Block |
| 18 | Cleric | boss | published couga54 PvE | +87.8% | +41.9% | +15.5% | +14.8% | patch A +32%, B+C +23%, E +1% on ours |
| 19 | Chanter | boss | published couga54 PvE | +27.0% | +11.2% | +2.9% | +3.9% | patch A +14%, B+C +8%, E -1% on ours |

Rows 1, 4, 5, 6, 11, 15, 18, 19 are the published builds, all of which trip at the shipped level; the other 11 rows are community stigma sets the engine allocates itself. After A+B+C+E 10 of the 19 rows still trip: the published Ranger, Cleric, Chanter and the sets Gladiator boss (row 2), Ranger boss (row 7), Ranger boss (row 9), Ranger AoE (row 10), Sorcerer boss (row 12), Sorcerer boss (row 13), Sorcerer AoE (row 14). For a set row the E column compares our E build with the set without E, so it overstates what is left; a set row that still trips says the engine's own stigma choice trails that forced set in the model, which is a stigma-choice gap, not an allocation gap (the same engine allocates both sides); defects 3, 7 and 8 are the candidate causes and were not separated per row.

### 5.2 Ours beats the community build by more than 10% (sanity check)

| # | Class | Playstyle | Community build | Shipped | +A | +A+B+C | +A+B+C+E | Reason |
|---|---|---|---|---|---|---|---|---|
| 1 | Assassin | AoE | Illusive Clone, Savage Fang, Throw Shadowblade, Evasion Stance (expcarry) | -8.9% | -9.2% | -12.9% | -12.9% | ours-only worth: Swift Contract +15.0% (rank 10); community-only at ~0%: Evasion Stance |
| 2 | Assassin | AoE | Illusive Clone, Swift Contract, Throw Shadowblade, Triniel's Dagger (aoeah) | -2.7% | -2.9% | -11.3% | -11.3% | ours-only worth: Savage Fang +12.7% (rank 20); community-only at ~0%: Triniel's Dagger |
| 3 | Ranger | AoE | Explosive Arrow, Griffon Arrow, Arrow Storm, Mother Nature's Breath (expcarry) | -6.7% | -3.6% | -12.6% | -13.9% | community-only worth: Arrow Storm +2.6% (rank 16); ours-only worth: Vaizel's Authority +14.4% (rank 10), Ensnaring Trap +3.5% (rank 15); community-only at ~0%: Mother Nature's Breath |
| 4 | Spiritmaster | AoE | Summon: Ancient Spirit, Seize Magic, Flame Blessing, Jointstrike: Corrode (couga-scrape) | -6.8% | -5.8% | -18.8% | -27.4% | community-only worth: Flame Blessing +2.6% (rank 20); ours-only worth: Enhance: Spirit's Benediction +26.4% (rank 20) |
| 5 | Cleric | boss | Earth Punishment, Absolution, Prayer of Amplification, Noble Aura (couga-scrape) | -15.3% | -15.3% | -14.3% | -15.6% | ours-only worth: Light of Protection +16.7% (rank 1); community-only at ~0%: Absolution |
| 6 | Cleric | boss | Benevolence, Absolution, Summon Resurrection, Yustiel's Power (expcarry, gegebase) | -28.9% | -26.6% | -40.2% | -41.1% | ours-only worth: Noble Aura +22.5% (rank 20), Light of Protection +16.7% (rank 1), Prayer of Amplification +11.8% (rank 5), Earth Punishment +11.9% (rank 20); community-only at ~0%: Benevolence, Absolution, Summon Resurrection, Yustiel's Power |
| 7 | Cleric | boss | Salvation, Yustiel's Power, Light of Protection, Benevolence (inven) | -16.2% | -13.3% | -29.4% | -30.5% | ours-only worth: Noble Aura +22.5% (rank 20), Prayer of Amplification +11.8% (rank 5), Earth Punishment +11.9% (rank 20); community-only at ~0%: Salvation, Yustiel's Power, Benevolence |
| 8 | Cleric | AoE | Earth Punishment, Noble Aura, Prayer of Amplification, Power Burst (expcarry) | -15.8% | -17.1% | -16.0% | -16.0% | ours-only worth: Light of Protection +15.8% (rank 1), Assault Mark +4.8% (rank 20); community-only at ~0%: Earth Punishment, Power Burst |
| 9 | Cleric | AoE | Earth Punishment, Noble Aura, Light of Protection, Yustiel's Power (aoeah) | -4.9% | -6.6% | -17.1% | -17.1% | ours-only worth: Prayer of Amplification +17.4% (rank 5), Assault Mark +4.8% (rank 20); community-only at ~0%: Earth Punishment, Yustiel's Power |
| 10 | Chanter | AoE | Undefeated Mantra, Sprint Mantra, Marchutan's Wrath, Guardian Blessing (expcarry, aoeah) | -8.9% | -7.3% | -14.4% | -11.5% | ours-only worth: Power of the Storm +17.6% (rank 15), Obliterate +3.6% (rank 15); community-only at ~0%: Sprint Mantra, Marchutan's Wrath, Guardian Blessing; ours-only at ~0%: Fracturing Blow |

Sanity check of the ten rows above (ours beats a community set by more than 10%). The pattern is the same in every row and is not a model error in the engine's favour except where noted:

- Rows 1 to 5 and 8 to 9: the community set omits a stigma that the guide's own PvE build runs and that the model prices consistently in both places: Swift Contract (+15.0% in ours, +15.5% in the guide's build), Savage Fang (+12.7% in ours and +15.1% in the other AoE set that has it; +3.9% in the guide's boss build), Vaizel's Authority (+14.4% in ours, +7.5% in the guide's build), Enhance: Spirit's Benediction (+26.4% in ours, +16.0% in the guide's build), Light of Protection (+16.7% in ours, +16.8% in the guide's build), Prayer of Amplification (+17.4% in ours). These sets come from seller sites (expcarry, aoeah) and from a scrape of the couga54 AoE notes, which is why they are used only as alternative stigma sets.
- Rows 6, 7 and 10: the community set is mostly healer or support stigmas (Benevolence, Absolution, Summon Resurrection, Yustiel's Power, Salvation, Sprint Mantra, Guardian Blessing) that the model prices at 0.0% because it has no healing, party or defence value. Ours beating them says only that the model cannot see what they are for.
- One caveat does inflate ours in the Cleric rows: the data credits Light of Protection and Prayer of Amplification at their rank-16 value at any rank (defect 8), and ours runs both at rank 1 to 5. Re-planning ours and each set at +A+B+C (2 seeds, one pool per class) and scoring both under the shipped model and under rank-aware buff values moves the community-minus-ours delta of the rows that touch classes with rank-dependent buffs as follows: Ranger AoE (Explosive Arrow, Griffon Arrow, Arrow Storm, Mother Nature's Breath) -12.6% to -11.1%; Spiritmaster AoE (Summon: Ancient Spirit, Seize Magic, Flame Blessing, Jointstrike: Corrode) -18.8% to -18.4%; Cleric boss (Earth Punishment, Absolution, Prayer of Amplification, Noble Aura) -14.3% to -9.1%; Cleric boss (Benevolence, Absolution, Summon Resurrection, Yustiel's Power) -40.8% to -34.3%; Cleric boss (Salvation, Yustiel's Power, Light of Protection, Benevolence) -30.1% to -27.4%; Cleric AoE (Earth Punishment, Noble Aura, Prayer of Amplification, Power Burst) -16.0% to -11.5%; Cleric AoE (Earth Punishment, Noble Aura, Light of Protection, Yustiel's Power) -17.1% to -15.0%; Chanter AoE (Undefeated Mantra, Sprint Mantra, Marchutan's Wrath, Guardian Blessing) -14.4% to -14.4%. 7 of those 8 rows are still beyond -10% after the re-valuation, so the CHECK flags stand except where a row drops inside the threshold.

## 6. Per class

Numbers are model DPS under the DarthThot profile; "worth" is the DPS the engine loses if that stigma is removed from its own final rotation (same rotation, so a stigma that gates a cast looks larger than its own effect).

### Gladiator

Boss, published couga54 PvE build:
- published (cleaned) 9605, as published with every pick applied 8640; ours shipped 7335, +A 9817, +A+B+C 10287, +A+B+C+E 10257 (table 3.1 numbers).
- the guide's stigmas and what the model says each is worth (leave-one-out, same rotation): Lunge Stance 20 (+11.9%), Focused Block 5 (+8.8%), Rage Burst 5 (+62.9%), Zikel's Blessing 10 (+10.0%).
- the same four stigmas with the engine allocating levels, ranks and specialties (main run, same rotation pool as the guide's build 9712): shipped 7418, +A+B+C 10678, i.e. the guide's own allocation is +30.9% / -9.0% against the engine's allocation of the same set (shipped / +A+B+C).
- guide picks the engine says lower DPS (dropped by its own cleanup): Overhead Slam: Adds [Upward Strike] Chain Skill (-9.5%); Focused Block: +1 consecutive use (-0.8%)
- published -> engine (shipped), stigmas / ranks / specialties: -16.2% / +0.0% / -8.8% (reverse order -15.2%, -1.2%, -8.8%).
- published -> engine (+A+B+C), stigmas / ranks / specialties: +2.6% / -1.0% / +5.5% (reverse order +5.7%, -1.0%, +2.3%).
- second round (section 4.2, one pool): published 9605 (shipped model) / 9698 (rank-aware model); ours +A+B+C+E 10205, +F 10284, +F+E 10427; under the rank-aware model ours +F+G 9831 (-1.3%) and +F+G+E 9907 (-2.1%); stigmas with F+G+E: Rage Burst 20, Focused Block 1, Blade Toss 1, Assault Strike 12.
- skill ranks the shipped engine buys differently by 3+ (ours vs guide): Crushing Wave 3 (guide 12), Defiance 7 (guide 16), Sword Aura Rampage 7 (guide 16), Aerial Snare 3 (guide 12)
- skill ranks the +A+B+C+E engine buys differently by 3+ (ours vs guide): Crushing Wave 3 (guide 12), Defiance 7 (guide 16), Sword Aura Rampage 7 (guide 16), Aerial Snare 3 (guide 12)
- specialties, guide vs engine (+A+B+C+E): Keen Strike: guide [+20% MP restored, -1s [Ruinous Blow] cooldown on hit] / engine [+20% MP restored]; Lunge Stance: guide [+5% Double Chance for the duration, x1.5 [Identify Weakness] effect for the duration] / engine [+5% Double Chance for the duration]; Mocking Blade: guide [none] / engine [Adds 2 additional strikes]; Rage Burst: guide [-15s [Rage Burst] cooldown] / engine [-15s [Rage Burst] cooldown, +10% PvE Damage Boost increase and +5% PvP Damage Boost increase]; Rending Blow: guide [Deals up to 12% more damage when less targets are hit, Restores 50 MP on landing a Critical Hit] / engine [-20% MP consumed, Deals up to 12% more damage when less targets are hit]; Ruinous Blow: guide [+30% Skill Critical Hit] / engine [+20% Skill Speed, +30% Skill Critical Hit]; Zikel's Blessing: guide [+10% PvE Damage Boost and +5% PvP Damage Boost] / engine [none]

Boss, stigma sets (ranks and specialties allocated by the engine):
- Lunge Stance, Focused Block, Rage Burst, Zikel's Blessing (couga, questlog): community vs ours, shipped / +A / +A+B+C = +1.1% / +0.3% / +3.1%. Why (+A+B+C): community-only worth: Zikel's Blessing +4.0% (rank 10); ours-only at ~0%: Forced Restraint; ranks ours vs community: Focused Block 1 vs 5.
- Lunge Stance, Focused Block, Rage Burst, Lifestealing Blade (couga-scrape): community vs ours, shipped / +A / +A+B+C = +1.2% / -0.6% / +0.0%. Why (+A+B+C): community-only at ~0%: Lifestealing Blade; ours-only at ~0%: Forced Restraint; ranks ours vs community: Lunge Stance 5 vs 11.
- Lunge Stance, Rage Burst, Zikel's Blessing, Wave Armor (expcarry): community vs ours, shipped / +A / +A+B+C = -3.0% / -4.6% / -0.8%. Why (+A+B+C): community-only worth: Zikel's Blessing +3.8% (rank 10); ours-only worth: Focused Block +6.5% (rank 1); community-only at ~0%: Wave Armor; ours-only at ~0%: Forced Restraint.

AoE / farming / solo, stigma sets:
- Lunge Stance, Zikel's Blessing, Focused Block, Rage Burst (couga-scrape, aoeah): community vs ours, shipped / +A / +A+B+C = +4.9% / +1.7% / +1.6%. Why (+A+B+C): community-only worth: Focused Block +4.1% (rank 1); ours-only at ~0%: Wave Armor.
- Lunge Stance, Zikel's Blessing, Focused Block, Lifestealing Blade (couga-scrape): community vs ours, shipped / +A / +A+B+C = -1.4% / -1.2% / -4.6%. Why (+A+B+C): community-only worth: Focused Block +3.4% (rank 1), Lifestealing Blade +3.0% (rank 20); ours-only worth: Rage Burst +46.5% (rank 20); ours-only at ~0%: Wave Armor.
- Lunge Stance, Lifestealing Blade, Wave Armor, Rage Burst (expcarry): community vs ours, shipped / +A / +A+B+C = -3.2% / -3.1% / -7.5%. Why (+A+B+C): ours-only worth: Zikel's Blessing +9.8% (rank 10); community-only at ~0%: Lifestealing Blade.

**Reading.** The shipped gap (+31%) is defects 1 and 2: patch A alone adds 34% to our own build and B+C another 5%, after which ours is 6-7% ahead of the guide. Handed the guide's four stigmas, the patched engine allocates them 9% better than the guide does (table 4.1), so nothing on the guide's side is left to explain except two picks the model dislikes: Overhead Slam's "Adds Upward Strike" chain costs 9.5% in the model and Focused Block's extra use 0.8%. Both stay in the guide's literal build (8640) and are dropped in the cleaned number used in table 3.1 (9605), which favours the guide. The one guide stigma the +A+B+C and +A+B+C+E engines do not take is Zikel's Blessing (community-only worth +4.0% at rank 10 in the boss set row, which keeps that set 3.1% ahead at +A+B+C; with patch F and E the engine takes it at rank 1). On AoE the guide's set is 4.9% ahead at HEAD because the shipped engine misses Focused Block (+4.1% at rank 1); E closes it (+0.2% in the 8-seed rerun).

### Templar

Boss, published couga54 PvE build:
- published (cleaned) 11505, as published with every pick applied 11164; ours shipped 9879, +A 12352, +A+B+C 12394, +A+B+C+E 12308 (table 3.1 numbers).
- the guide's stigmas and what the model says each is worth (leave-one-out, same rotation): Empyrean Lord's Punishment 15 (+3.1%), Battlefield Banner 15 (+1.7%), Doom Shield 15 (+1.5%), Taunt 5 (+0.0%).
- the same four stigmas with the engine allocating levels, ranks and specialties (main run, same rotation pool as the guide's build 11505): shipped 9879, +A+B+C 12655, i.e. the guide's own allocation is +16.5% / -9.1% against the engine's allocation of the same set (shipped / +A+B+C).
- published -> engine (shipped), stigmas / ranks / specialties: -3.6% / +0.0% / -10.9% (reverse order -2.3%, +0.0%, -12.1%).
- published -> engine (+A+B+C), stigmas / ranks / specialties: -3.3% / +0.0% / +11.4% (reverse order -0.3%, +0.0%, +8.1%).
- second round (section 4.2, one pool): published 11502 (shipped model) / 11469 (rank-aware model); ours +A+B+C+E 12308, +F 12308, +F+E 12308; under the rank-aware model ours +F+G 12308 (-6.8%) and +F+G+E 12308 (-6.8%); stigmas with F+G+E: Doom Shield 20, Empyrean Lord's Punishment 1, Shield of Protection 1, Taunt 1.
- skill ranks the shipped engine buys differently by 3+ (ours vs guide): Annihilate 7 (guide 16), Warding Strike 3 (guide 12), Flash Rampage 3 (guide 12), Shield Rush 3 (guide 12)
- skill ranks the +A+B+C+E engine buys differently by 3+ (ours vs guide): Annihilate 7 (guide 16), Warding Strike 3 (guide 12), Flash Rampage 3 (guide 12), Shield Rush 3 (guide 12)
- specialties, guide vs engine (+A+B+C+E): Battlefield Banner: guide [+10% Weapon Damage Boost for duration] / engine [none]; Empyrean Lord's Punishment: guide [Up to +20% damage when less targets hit, +10% PvE Damage Boost and +5% PvP Damage Boost for 10s on hit] / engine [none]; Pummel: guide [Deals up to 12% more damage when less targets are hit, Activates [Punishing Strike] 1 extra time] / engine [-20% MP consumed, Deals up to 12% more damage when less targets are hit, Activates [Punishing Strike] 1 extra time]; Shield Smite: guide [none] / engine [Removes MP Cost and restores 200 MP on hit]

Boss, stigma sets (ranks and specialties allocated by the engine):
- Empyrean Lord's Punishment, Battlefield Banner, Doom Shield, Taunt (couga, aoeah): community vs ours, shipped / +A / +A+B+C = +0.0% / +0.4% / +1.7%. Why (+A+B+C): community-only worth: Empyrean Lord's Punishment +2.3% (rank 15); community-only at ~0%: Battlefield Banner, Taunt; ours-only at ~0%: Shield of Protection, Second Skin, Armor of Balance; ranks ours vs community: Doom Shield 20 vs 15.
- Empyrean Lord's Punishment, Battlefield Banner, Doom Shield, Nezekan's Shield (couga-scrape): community vs ours, shipped / +A / +A+B+C = +0.0% / +0.2% / +1.7%. Why (+A+B+C): community-only worth: Empyrean Lord's Punishment +2.3% (rank 15); community-only at ~0%: Battlefield Banner, Nezekan's Shield; ours-only at ~0%: Shield of Protection, Second Skin, Armor of Balance.
- Empyrean Lord's Punishment, Executing Blade, Battlefield Banner, Doom Shield (couga-scrape): community vs ours, shipped / +A / +A+B+C = +0.0% / -0.3% / +1.7%. Why (+A+B+C): community-only worth: Empyrean Lord's Punishment +2.3% (rank 15); community-only at ~0%: Executing Blade, Battlefield Banner; ours-only at ~0%: Shield of Protection, Second Skin, Armor of Balance; ranks ours vs community: Doom Shield 20 vs 15.
- Doom Shield, Battlefield Banner, Noble Armor, Shield of Protection (questlog): community vs ours, shipped / +A / +A+B+C = +0.0% / +0.0% / +0.0%. Why (+A+B+C): community-only at ~0%: Battlefield Banner, Noble Armor; ours-only at ~0%: Second Skin, Armor of Balance.
- Taunt, Shield of Protection, Second Skin, Doom Shield (expcarry, gegebase): community vs ours, shipped / +A / +A+B+C = +0.0% / +0.0% / -0.1%. Why (+A+B+C): community-only at ~0%: Taunt; ours-only at ~0%: Armor of Balance.
- Taunt, Doom Shield, Shield of Protection, Empyrean Lord's Punishment (role-file): community vs ours, shipped / +A / +A+B+C = +0.0% / -0.2% / +1.8%. Why (+A+B+C): community-only worth: Empyrean Lord's Punishment +2.4% (rank 15); community-only at ~0%: Taunt; ours-only at ~0%: Second Skin, Armor of Balance; ranks ours vs community: Doom Shield 20 vs 15.

AoE / farming / solo, stigma sets:
- Empyrean Lord's Punishment, Doom Shield, Executing Blade, Battlefield Banner (couga-scrape): community vs ours, shipped / +A / +A+B+C = +0.0% / +0.0% / -1.3%. Why (+A+B+C): community-only at ~0%: Battlefield Banner; ours-only at ~0%: Blade Storm.
- Grapple, Assault Fury, Doom Shield, Shield of Protection (expcarry): community vs ours, shipped / +A / +A+B+C = +0.0% / +1.5% / -3.0%. Why (+A+B+C): ours-only worth: Empyrean Lord's Punishment +4.9% (rank 19); community-only at ~0%: Grapple, Assault Fury, Shield of Protection; ours-only at ~0%: Executing Blade, Blade Storm.

**Reading.** Shipped +16%, then 7% behind after A+B+C. The stigma step favours the guide (swapping the engine's stigmas, Doom Shield 20 plus three one-point stigmas, for the guide's four costs 3.9%) and the specialty step favours the engine (+11.3% when its picks replace the guide's): 17 of the guide's picked options change nothing in the model (mostly defence, range, crowd control and cooldowns on skills outside the rotation, but also "extra damage on hit", "damage over time on hit" and "Multi-Hit on hit", which are damage options the model cannot value), and the model gives the guide's four stigmas only +3.1%, +1.7%, +1.5% and 0.0%. Templar is the class where the model says least about the guide's build (an aggro and defence build), so "ours ahead by 7%" should not be read as the engine being better. At HEAD the engine's own AoE pick contains Blade Storm, which has no unlock level in the data (defect 4), at shipped, +A and +A+B+C; E drops it.

### Assassin

Boss, published couga54 PvE build:
- published (cleaned) 9110, as published with every pick applied 8406; ours shipped 8324, +A 8541, +A+B+C 9275, +A+B+C+E 9484 (table 3.1 numbers).
- the guide's stigmas and what the model says each is worth (leave-one-out, same rotation): Illusive Clone 20 (+7.0%), Swift Contract 15 (+15.5%), Savage Fang 15 (+3.9%), Triniel's Dagger 10 (+0.0%).
- the same four stigmas with the engine allocating levels, ranks and specialties (main run, same rotation pool as the guide's build 9110): shipped 8265, +A+B+C 9341, i.e. the guide's own allocation is +10.2% / -2.5% against the engine's allocation of the same set (shipped / +A+B+C).
- published -> engine (shipped), stigmas / ranks / specialties: -7.3% / +0.0% / -1.4% (reverse order -6.4%, +0.0%, -2.4%).
- published -> engine (+A+B+C), stigmas / ranks / specialties: +1.8% / +0.0% / +0.1% (reverse order +3.1%, +0.0%, -1.3%).
- second round (section 4.2, one pool): published 9110 (shipped model) / 9110 (rank-aware model); ours +A+B+C+E 9275, +F 9275, +F+E 9275; under the rank-aware model ours +F+G 9275 (-1.8%) and +F+G+E 9275 (-1.8%); stigmas with F+G+E: Swift Contract 10, Illusive Clone 15, Savage Fang 20, Aerial Bind 15.
- skill ranks the shipped engine buys differently by 3+ (ours vs guide): Ambush 7 (guide 16), Storm Rampage 7 (guide 16), Defiance 3 (guide 12), Savage Roar 3 (guide 12), Shadowstrike 3 (guide 12), Flash Slice 3 (guide 12)
- skill ranks the +A+B+C+E engine buys differently by 3+ (ours vs guide): Ambush 7 (guide 16), Storm Rampage 7 (guide 16), Defiance 3 (guide 12), Savage Roar 3 (guide 12), Shadowstrike 3 (guide 12), Flash Slice 3 (guide 12), Shadow Fall 3 (guide 12)
- specialties, guide vs engine (+A+B+C+E): Aerial Bind: guide [none] / engine [Adds [Aerial Slaughter] Chain Skill]; Infiltrate: guide [none] / engine [Adds [Dark Strike] Chain Skill]; Insignia Explosion: guide [+50% Multi-Hit on hit, -3s cooldown] / engine [+50% Multi-Hit on hit]; Quick Slice: guide [+50% Multi-Hit on hit, -1s [Insignia Explosion] cooldown on hit, Ignores Block and Evasion and lands as a Critical Hit] / engine [+50% Multi-Hit on hit, Ignores Block and Evasion and lands as a Critical Hit]; Swift Contract: guide [x1.5 [Rear Smite] effect for the duration, x1.5 [Assault Stance] effect for the duration] / engine [x1.5 [Rear Smite] effect for the duration, x1.5 [Assault Stance] effect for the duration, +10% additional Combat Speed]

Boss, stigma sets (ranks and specialties allocated by the engine):
- Illusive Clone, Swift Contract, Savage Fang, Triniel's Dagger (couga, expcarry, questlog, aoeah): community vs ours, shipped / +A / +A+B+C = -0.7% / +0.0% / +1.3%. Why (+A+B+C): ours-only worth: Aerial Bind +2.1% (rank 15); community-only at ~0%: Triniel's Dagger; ranks ours vs community: Swift Contract 10 vs 20, Savage Fang 20 vs 15.

AoE / farming / solo, stigma sets:
- Savage Fang, Illusive Clone, Swift Contract, Throw Shadowblade (couga-scrape): community vs ours, shipped / +A / +A+B+C = +0.0% / +0.0% / +0.0%. Why (+A+B+C): same four stigmas.
- Illusive Clone, Savage Fang, Throw Shadowblade, Evasion Stance (expcarry): community vs ours, shipped / +A / +A+B+C = -8.9% / -9.2% / -12.9%. Why (+A+B+C): ours-only worth: Swift Contract +15.0% (rank 10); community-only at ~0%: Evasion Stance.
- Illusive Clone, Swift Contract, Throw Shadowblade, Triniel's Dagger (aoeah): community vs ours, shipped / +A / +A+B+C = -2.7% / -2.9% / -11.3%. Why (+A+B+C): ours-only worth: Savage Fang +12.7% (rank 20); community-only at ~0%: Triniel's Dagger.

**Reading.** Shipped +9%, then level after the patches (-2% at +A+B+C, -4% with E). The guide's number one skill, Heart Gore, is a PROC skill the allocator cannot rank (defect 5), so both sides were given the guide's rank. Triniel's Dagger, the guide's fourth stigma, is worth 0.0% in the model (its "-10% cooldowns on hit" is not modelled) and the engine puts Aerial Bind there. Swift Contract is the stigma that matters most (+15.5% at rank 15 in the guide's build); the engine's own AoE stigma set is the guide's AoE set exactly (0.0% at every level). The two alternative AoE sets that drop Swift Contract or Savage Fang are the CHECK rows below.

### Ranger

Boss, published couga54 PvE build:
- published (cleaned) 6620, as published with every pick applied 6467; ours shipped 4945, +A 6061, +A+B+C 6157, +A+B+C+E 6394 (table 3.1 numbers).
- the guide's stigmas and what the model says each is worth (leave-one-out, same rotation): Vaizel's Authority 20 (+7.5%), Bow of Blessing 10 (+1.3%), Supporting Fire 10 (+0.0%), Griffon Arrow 10 (+6.9%).
- the same four stigmas with the engine allocating levels, ranks and specialties (main run, same rotation pool as the guide's build 6620): shipped 5073, +A+B+C 6595, i.e. the guide's own allocation is +30.5% / +0.4% against the engine's allocation of the same set (shipped / +A+B+C).
- guide picks the engine says lower DPS (dropped by its own cleanup): Snipe: Adds [Tempest Arrow] Chain Skill (-0.1%)
- published -> engine (shipped), stigmas / ranks / specialties: -8.7% / -5.5% / -13.3% (reverse order -5.8%, -4.1%, -17.3%).
- published -> engine (+A+B+C), stigmas / ranks / specialties: -6.0% / -5.0% / +4.1% (reverse order -2.6%, +0.0%, -4.5%).
- second round (section 4.2, one pool): published 6620 (shipped model) / 6583 (rank-aware model); ours +A+B+C+E 6250, +F 6227, +F+E 6304; under the rank-aware model ours +F+G 6227 (+5.7%) and +F+G+E 6153 (+7.0%); stigmas with F+G+E: Griffon Arrow 11, Explosive Arrow 20, Vaizel's Authority 1, Ambush Kick 12.
- skill ranks the shipped engine buys differently by 3+ (ours vs guide): Snare Shot 3 (guide 12), Burst Arrow 3 (guide 12), Defiance 3 (guide 12), Arrow Scattershot 3 (guide 12)
- skill ranks the +A+B+C+E engine buys differently by 3+ (ours vs guide): Snare Shot 3 (guide 12), Burst Arrow 3 (guide 12), Defiance 3 (guide 12), Arrow Scattershot 3 (guide 12)
- specialties, guide vs engine (+A+B+C+E): Bow of Blessing: guide [none] / engine [+20% Critical Damage Boost for the duration, +7% Double Chance for the duration]; Burst Arrow: guide [Up to +20% damage when less targets hit] / engine [none]; Deadshot: guide [+30% Skill Speed] / engine [Removes MP consumed, +30% Skill Speed]; Gale Arrow: guide [-10s cooldown] / engine [+5s duration, -10s cooldown]; Rapid Fire: guide [-1s [Deadshot] cooldown on hit] / engine [none]; Snare Shot: guide [+20% Skill Speed] / engine [none]; Snipe: guide [-1s [Deadshot] cooldown on hit, Adds [Tempest Arrow] Chain Skill] / engine [+20% MP restored, -1s [Deadshot] cooldown on hit]; Tempest Shot: guide [Deals up to 12% more damage when less targets are hit, +20% Skill Speed] / engine [+10% skill Critical Hit, Deals up to 12% more damage when less targets are hit] ...

Boss, stigma sets (ranks and specialties allocated by the engine):
- Vaizel's Authority, Bow of Blessing, Supporting Fire, Griffon Arrow (couga, questlog): community vs ours, shipped / +A / +A+B+C = +2.2% / +2.4% / +7.1%. Why (+A+B+C): community-only worth: Vaizel's Authority +7.3% (rank 10); ours-only worth: Explosive Arrow +2.7% (rank 15); community-only at ~0%: Supporting Fire; ours-only at ~0%: Ambush Kick; ranks ours vs community: Bow of Blessing 15 vs 20.
- Vaizel's Authority, Bow of Blessing, Supporting Fire, Explosive Arrow (couga-scrape): community vs ours, shipped / +A / +A+B+C = -0.5% / -1.5% / +3.0%. Why (+A+B+C): community-only worth: Vaizel's Authority +7.3% (rank 10), Supporting Fire +5.3% (rank 15); ours-only worth: Griffon Arrow +6.3% (rank 11); ours-only at ~0%: Ambush Kick.
- Vaizel's Authority, Bow of Blessing, Griffon Arrow, Explosive Arrow (aoeah): community vs ours, shipped / +A / +A+B+C = +4.1% / +2.2% / +6.6%. Why (+A+B+C): community-only worth: Vaizel's Authority +6.7% (rank 10); ours-only at ~0%: Ambush Kick; ranks ours vs community: Griffon Arrow 11 vs 15.
- Bow of Blessing, Explosive Arrow, Griffon Arrow, Arrow Storm (expcarry): community vs ours, shipped / +A / +A+B+C = +1.3% / -0.1% / +0.9%. Why (+A+B+C): community-only worth: Arrow Storm +1.5% (rank 11); ours-only at ~0%: Ambush Kick.

AoE / farming / solo, stigma sets:
- Arrow Storm, Vaizel's Authority, Explosive Arrow, Bow of Blessing (couga-scrape): community vs ours, shipped / +A / +A+B+C = -6.8% / -8.2% / -2.5%. Why (+A+B+C): community-only worth: Arrow Storm +1.4% (rank 15), Bow of Blessing +8.2% (rank 15); ours-only worth: Griffon Arrow +13.4% (rank 15), Ensnaring Trap +3.5% (rank 15).
- Arrow Storm, Vaizel's Authority, Griffon Arrow, Bow of Blessing (couga-scrape): community vs ours, shipped / +A / +A+B+C = -1.3% / +3.1% / +6.1%. Why (+A+B+C): community-only worth: Arrow Storm +3.1% (rank 15), Bow of Blessing +11.6% (rank 15); ours-only worth: Explosive Arrow +4.2% (rank 15), Ensnaring Trap +3.5% (rank 15).
- Explosive Arrow, Griffon Arrow, Arrow Storm, Mother Nature's Breath (expcarry): community vs ours, shipped / +A / +A+B+C = -6.7% / -3.6% / -12.6%. Why (+A+B+C): community-only worth: Arrow Storm +2.6% (rank 16); ours-only worth: Vaizel's Authority +14.4% (rank 10), Ensnaring Trap +3.5% (rank 15); community-only at ~0%: Mother Nature's Breath.

**Reading.** After A+B+C+E the guide still leads by 3.5%, and by 7% when the engine plans under rank-aware buff values (F+G+E: ours 6153 against 6583). With the guide's four stigmas handed to it the engine reaches the guide's DPS (+0.4%, table 4.1), so the allocator is fine and the stigma choice is the difference: Vaizel's Authority 20 is worth +7.5% in the guide's build and dropping it to rank 1 costs that build 4.1%, but the engine takes it at rank 1 at best (E) or not at all (+A+B+C): the data gives its buff the rank-20 duration at every rank (defect 8), so there is no reason to buy ranks. The attribution of the remaining 3.5% is order dependent (stigmas -1.5%, ranks -6.0%, specialties +4.3% one way; -4.0%, -0.2%, +0.8% the other): the order dependence suggests that the guide's Snare Shot, Burst Arrow and Arrow Scattershot at 12 against the engine's 3 matter through the specialty slots those ranks open rather than on their own (not isolated). At +A+B+C the guide leads in both stat profiles (+7.5% with the DarthThot stats, +6.5% geared).

### Sorcerer

Boss, published couga54 PvE build:
- published (cleaned) 26837, as published with every pick applied 26837; ours shipped 17517, +A 22566, +A+B+C 24661, +A+B+C+E 27254 (table 3.1 numbers).
- the guide's stigmas and what the model says each is worth (leave-one-out, same rotation): Element Enhancement 20 (+20.2%), Cold Storm 10 (+1.8%), Fire Wall 10 (+7.5%), Delayed Explosion 10 (+4.0%).
- the same four stigmas with the engine allocating levels, ranks and specialties (main run, same rotation pool as the guide's build 26901): shipped 18962, +A+B+C 29071, i.e. the guide's own allocation is +41.9% / -7.5% against the engine's allocation of the same set (shipped / +A+B+C).
- published -> engine (shipped), stigmas / ranks / specialties: -18.7% / -2.4% / -17.8% (reverse order -16.7%, -0.5%, -21.2%).
- published -> engine (+A+B+C), stigmas / ranks / specialties: -12.9% / -0.3% / +5.9% (reverse order -10.1%, -0.3%, +2.5%).
- second round (section 4.2, one pool): published 26837 (shipped model) / 26634 (rank-aware model); ours +A+B+C+E 26667, +F 24620, +F+E 27245; under the rank-aware model ours +F+G 27535 (-3.3%) and +F+G+E 28645 (-7.0%); stigmas with F+G+E: Fire Wall 20, Element Enhancement 1, Soul Freeze 1, Curse: Tree 1.
- skill ranks the shipped engine buys differently by 3+ (ours vs guide): Wish of Concentration 7 (guide 16), Flame Scattershot 3 (guide 12), Defiance 3 (guide 12)
- skill ranks the +A+B+C+E engine buys differently by 3+ (ours vs guide): Ice Chain 3 (guide 12), Flame Scattershot 3 (guide 12), Defiance 3 (guide 12)
- specialties, guide vs engine (+A+B+C+E): Blaze: guide [none] / engine [+50% MP restored, -3s [Wish of Concentration] cooldown on hit]; Cold Storm: guide [none] / engine [+10s Frostbite duration]; Delayed Explosion: guide [-10s [Delayed Explosion] cooldown] / engine [none]; Element Enhancement: guide [x1.5 [Robe of Flame] effect, x1.5 [Grace of Enhancement] effect, +10% additional Fire and Water Attack] / engine [none]; Fire Wall: guide [none] / engine [+2s [Fire Wall] summoning duration]; Firestorm: guide [-50% MP Cost, -2s [Hellfire] cooldown per fireball] / engine [+20% Skill Speed, +15% damage per fireball, up to +75%]; Flame Arrow: guide [+5% Fire Damage Boost for 10s on activating [Pyroclasm], Reset [Blaze] cooldown on landing [Pyroclasm]] / engine [+20% MP restored, +5% Fire Damage Boost for 10s on activating [Pyroclasm]]; Hellfire: guide [+30% Skill Speed] / engine [+30% Skill Speed, -15s cooldown] ...

Boss, stigma sets (ranks and specialties allocated by the engine):
- Element Enhancement, Cold Storm, Fire Wall, Delayed Explosion (couga, questlog, expcarry): community vs ours, shipped / +A / +A+B+C = +7.7% / +13.3% / +17.5%. Why (+A+B+C): community-only worth: Element Enhancement +9.6% (rank 10), Delayed Explosion +1.2% (rank 11); ours-only at ~0%: Assault Bombardment, Glacial Smite.
- Element Enhancement, Fire Wall, Cold Storm, Steel Barrier (aoeah): community vs ours, shipped / +A / +A+B+C = +7.7% / +8.4% / +12.7%. Why (+A+B+C): community-only worth: Element Enhancement +13.5% (rank 10); community-only at ~0%: Steel Barrier; ours-only at ~0%: Assault Bombardment, Glacial Smite.

AoE / farming / solo, stigma sets:
- Element Enhancement, Fire Wall, Glacial Smite, Delayed Explosion (couga-scrape): community vs ours, shipped / +A / +A+B+C = -3.6% / +1.9% / +3.6%. Why (+A+B+C): ours-only worth: Cold Storm +3.0% (rank 5); community-only at ~0%: Glacial Smite.
- Element Enhancement, Fire Wall, Glacial Smite, Cold Storm (couga-scrape): community vs ours, shipped / +A / +A+B+C = -3.1% / +0.6% / +0.2%. Why (+A+B+C): ours-only worth: Delayed Explosion +3.6% (rank 1); community-only at ~0%: Glacial Smite.
- Element Enhancement, Fire Wall, Cold Storm, Steel Barrier (expcarry, aoeah): community vs ours, shipped / +A / +A+B+C = -3.1% / +0.7% / +0.2%. Why (+A+B+C): ours-only worth: Delayed Explosion +3.6% (rank 1); community-only at ~0%: Steel Barrier.

**Reading.** The class where E matters most (+10.6% on our own build) and where the shipped engine is furthest behind after the Cleric (+53%). The shipped and +A+B+C engines never take Element Enhancement (+20.2% in the guide's build, rank 20) or Delayed Explosion, so the stigma step is -12.9% at +A+B+C and -6.8% after E. With E the engine takes Element Enhancement at rank 1 and the model credits it with its rank-20 duration (20 s, the client has 10 s at rank 1): re-scored with rank-aware values the E build goes from 0.2% to 2.7% behind the guide. When the engine plans under rank-aware values it still leaves Element Enhancement at 1 and finds another set (Fire Wall 20, Soul Freeze 1, Curse: Tree 1) that scores 7.5% above the guide's build under that model (28645 against 26634). That is a model-internal result and the largest departure from the guides' stigma sets, so it is the first one to check in game. The flagged Sorcerer AoE +3.6% (main run) was noise: with 8 seeds it is -0.7%. On his real character the gap to the guide is character investment, not engine quality (section 7.3).

### Spiritmaster (Elementalist in the client)

Boss, published couga54 PvE build:
- published (cleaned) 5498, as published with every pick applied 5498; ours shipped 4421, +A 4745, +A+B+C 4990, +A+B+C+E 5817 (table 3.1 numbers).
- the guide's stigmas and what the model says each is worth (leave-one-out, same rotation): Summon: Ancient Spirit 20 (+15.6%), Enhance: Spirit's Benediction 20 (+16.0%), Flame Blessing 20 (+3.7%), Jointstrike: Corrode 20 (+45.0%).
- the same four stigmas with the engine allocating levels, ranks and specialties (main run, same rotation pool as the guide's build 5498): shipped 4490, +A+B+C 5145, i.e. the guide's own allocation is +22.4% / +6.9% against the engine's allocation of the same set (shipped / +A+B+C).
- published -> engine (shipped), stigmas / ranks / specialties: -20.7% / +3.4% / -1.9% (reverse order -18.8%, +3.9%, -4.7%).
- published -> engine (+A+B+C), stigmas / ranks / specialties: -17.2% / +3.1% / +6.3% (reverse order -16.3%, +6.7%, +1.6%).
- second round (section 4.2, one pool): published 5498 (shipped model) / 5615 (rank-aware model); ours +A+B+C+E 5817, +F 4988, +F+E 5817; under the rank-aware model ours +F+G 4988 (+12.6%) and +F+G+E 5817 (-3.5%); stigmas with F+G+E: Summon: Ancient Spirit 20, Enhance: Spirit's Benediction 1, Jointstrike: Destructive Attack 20, Jointstrike: Corrode 20.
- skill ranks the shipped engine buys differently by 3+ (ours vs guide): Rapid Scattershot 7 (guide 16), Defiance 7 (guide 16)
- skill ranks the +A+B+C+E engine buys differently by 3+ (ours vs guide): Rapid Scattershot 7 (guide 16), Defiance 7 (guide 16)
- specialties, guide vs engine (+A+B+C+E): Combustion: guide [Deals up to 12% more damage when less targets are hit, +20% Skill Speed, Adds [Ashy Call] Chain Skill] / engine [-20% MP consumed, Deals up to 12% more damage when less targets are hit, +20% Skill Speed]; Enhance: Spirit's Benediction: guide [x1.5 [Spirit Strike] Damage Boost effect, +25% PvE Damage Boost and Damage Tolerance, +12.5% PvP Damage Boost and Damage Tolerance for caster and Spirit] / engine [none]; Flame Blessing: guide [+100 Critical Hit, +10% Critical Damage Boost] / engine [none]; Jointstrike: Curse: guide [none] / engine [[Jointstrike: Curse] ignores Block and Evasion and lands as a Critical Hit]; Jointstrike: Destructive Attack: guide [none] / engine [+30% Skill Speed, Critical Hit on hit, Reset [Jointstrike: Curse] and [Jointstrike: Corrode] cooldown on landing [Jointstrike: Destructive Attack] first hit]; Summon: Fire Spirit: guide [none] / engine [-50% MP Cost]; Summon: Water Spirit: guide [none] / engine [-50% MP Cost]; Summon: Wind Spirit: guide [none] / engine [-50% MP Cost]

Boss, stigma sets (ranks and specialties allocated by the engine):
- Summon: Ancient Spirit, Enhance: Spirit's Benediction, Flame Blessing, Jointstrike: Corrode (couga, expcarry, aoeah): community vs ours, shipped / +A / +A+B+C = +1.4% / -0.4% / +3.1%. Why (+A+B+C): community-only worth: Enhance: Spirit's Benediction +9.3% (rank 10); ours-only worth: Jointstrike: Destructive Attack +7.0% (rank 20); community-only at ~0%: Flame Blessing; ours-only at ~0%: Magic Block.
- Enhance: Spirit's Benediction, Summon: Ancient Spirit, Jointstrike: Corrode, Jointstrike: Destructive Attack (questlog): community vs ours, shipped / +A / +A+B+C = +4.3% / +3.1% / +9.1%. Why (+A+B+C): community-only worth: Enhance: Spirit's Benediction +10.3% (rank 10); ours-only at ~0%: Magic Block.
- Command: Proxy, Enhance: Spirit's Benediction, Jointstrike: Corrode, Flame Blessing (gegebase): community vs ours, shipped / +A / +A+B+C = -8.2% / -6.9% / -5.6%. Why (+A+B+C): community-only worth: Enhance: Spirit's Benediction +9.3% (rank 10), Flame Blessing +1.4% (rank 20); ours-only worth: Summon: Ancient Spirit +8.1% (rank 20), Jointstrike: Destructive Attack +7.0% (rank 20); community-only at ~0%: Command: Proxy; ours-only at ~0%: Magic Block.

AoE / farming / solo, stigma sets:
- Summon: Ancient Spirit, Enhance: Spirit's Benediction, Flame Blessing, Jointstrike: Corrode (couga-scrape): community vs ours, shipped / +A / +A+B+C = -1.5% / -0.5% / -1.3%. Why (+A+B+C): community-only worth: Flame Blessing +2.0% (rank 20); ours-only worth: Seize Magic +3.6% (rank 20).
- Summon: Ancient Spirit, Seize Magic, Flame Blessing, Jointstrike: Corrode (couga-scrape): community vs ours, shipped / +A / +A+B+C = -6.8% / -5.8% / -18.8%. Why (+A+B+C): community-only worth: Flame Blessing +2.6% (rank 20); ours-only worth: Enhance: Spirit's Benediction +26.4% (rank 20).
- Summon: Ancient Spirit, Enhance: Spirit's Benediction, Cursed Cloud, Jointstrike: Corrode (expcarry): community vs ours, shipped / +A / +A+B+C = -1.5% / -1.9% / -2.2%. Why (+A+B+C): community-only worth: Cursed Cloud +1.4% (rank 20); ours-only worth: Seize Magic +3.6% (rank 20).

**Reading.** The class where one patch does the rest: E moves ours from 10% behind to 5% ahead (+16.6% on our own build), because Jointstrike: Corrode's value is a status (corrode_debuff) that gates Combustion in the searched rotation and does not exist in the seed rotation the shipped engine plans against (Corrode rank 1 to 20 changes DPS by 0.0% under the seed and by +9% under the searched rotation, defect 3). The guide runs all four stigmas at 20 (296 points; Corrode +45.0%, Spirit's Benediction +16.0%, Ancient Spirit +15.6% in its build); the patched engine spends 222. With the guide's four stigmas handed to it the engine's allocation is still 6.9% behind the guide's (table 4.1); with E it ends 5% ahead with a different set (Ancient Spirit, Destructive Attack 20, Corrode 20, Benediction 1), and 3.5% ahead under rank-aware values. The data fixes Flame Blessing's duration at its rank-1 value (10 s) at every rank, which understates the guide's rank 20 (client: 20 s), so the model rates the guide's build too low in one place.

### Cleric

Boss, published couga54 PvE build:
- published (cleaned) 9696, as published with every pick applied 8092; ours shipped 5164, +A 6834, +A+B+C 8392, +A+B+C+E 8448 (table 3.1 numbers).
- the guide's stigmas and what the model says each is worth (leave-one-out, same rotation): Earth Punishment 20 (+27.1%), Light of Protection 20 (+16.8%), Prayer of Amplification 10 (+9.6%), Noble Aura 10 (+7.9%).
- the same four stigmas with the engine allocating levels, ranks and specialties (main run, same rotation pool as the guide's build 9716): shipped 5225, +A+B+C 8392, i.e. the guide's own allocation is +85.9% / +15.8% against the engine's allocation of the same set (shipped / +A+B+C).
- published -> engine (shipped), stigmas / ranks / specialties: -23.2% / -6.1% / -26.1% (reverse order -13.2%, -7.1%, -33.9%).
- published -> engine (+A+B+C), stigmas / ranks / specialties: -5.0% / -5.1% / -4.0% (reverse order +9.8%, +0.0%, -21.1%).
- second round (section 4.2, one pool): published 9696 (shipped model) / 9750 (rank-aware model); ours +A+B+C+E 8448, +F 8469, +F+E 8469; under the rank-aware model ours +F+G 7874 (+23.8%) and +F+G+E 7874 (+23.8%); stigmas with F+G+E: Noble Aura 20, Light of Protection 1, Earth Punishment 12, Prayer of Amplification 20.
- skill ranks the shipped engine buys differently by 3+ (ours vs guide): Divine Aura 11 (guide 20), Lightning Strike Scattershot 7 (guide 16), Healing Light 7 (guide 16), Radiant Recovery 7 (guide 16), Light of Regeneration 7 (guide 16), Defiance 3 (guide 12)
- skill ranks the +A+B+C+E engine buys differently by 3+ (ours vs guide): Divine Aura 11 (guide 20), Lightning Strike Scattershot 7 (guide 16), Healing Light 7 (guide 16), Radiant Recovery 7 (guide 16), Light of Regeneration 7 (guide 16), Defiance 3 (guide 12)
- specialties, guide vs engine (+A+B+C+E): Chain of Torment: guide [+3s Damage over Time, +10% PvE Damage Tolerance reduction and +5% PvP Damage Tolerance reduction] / engine [+10% PvE Damage Tolerance reduction and +5% PvP Damage Tolerance reduction]; Condemnation: guide [Up to +12% damage when less targets hit, Resets cooldown on landing a Critical Hit with [Condemnation]] / engine [Up to +12% damage when less targets hit]; Earth Punishment: guide [[Condemnation] lands as a Critical Hit on targets afflicted with [Earth Punishment], +10% Double Chance to caster and +5% to party members from [Earth's Blessing], +10s [Earth Punishment] and [Earth's Blessing] duration] / engine [+10% Double Chance to caster and +5% to party members from [Earth's Blessing], +10% Attack and Defense to caster and +5% to party members from [Earth's Blessing], +10s [Earth Punishment] and [Earth's Blessing] duration]; Noble Aura: guide [+200 Aura Critical Hit] / engine [+200 Aura Critical Hit, -1s Aura attack cooldown]; Prayer of Amplification: guide [+20% PvE Damage Boost and +10% PvP Damage Boost] / engine [none]

Boss, stigma sets (ranks and specialties allocated by the engine):
- Earth Punishment, Light of Protection, Prayer of Amplification, Noble Aura (couga, questlog, aoeah): community vs ours, shipped / +A / +A+B+C = +0.0% / +0.0% / +0.0%. Why (+A+B+C): same four stigmas.
- Earth Punishment, Absolution, Prayer of Amplification, Noble Aura (couga-scrape): community vs ours, shipped / +A / +A+B+C = -15.3% / -15.3% / -14.3%. Why (+A+B+C): ours-only worth: Light of Protection +16.7% (rank 1); community-only at ~0%: Absolution.
- Benevolence, Absolution, Summon Resurrection, Yustiel's Power (expcarry, gegebase): community vs ours, shipped / +A / +A+B+C = -28.9% / -26.6% / -40.2%. Why (+A+B+C): ours-only worth: Noble Aura +22.5% (rank 20), Light of Protection +16.7% (rank 1), Prayer of Amplification +11.8% (rank 5), Earth Punishment +11.9% (rank 20); community-only at ~0%: Benevolence, Absolution, Summon Resurrection, Yustiel's Power.
- Salvation, Yustiel's Power, Light of Protection, Benevolence (inven): community vs ours, shipped / +A / +A+B+C = -16.2% / -13.3% / -29.4%. Why (+A+B+C): ours-only worth: Noble Aura +22.5% (rank 20), Prayer of Amplification +11.8% (rank 5), Earth Punishment +11.9% (rank 20); community-only at ~0%: Salvation, Yustiel's Power, Benevolence.

AoE / farming / solo, stigma sets:
- Earth Punishment, Light of Protection, Prayer of Amplification, Noble Aura (couga-scrape): community vs ours, shipped / +A / +A+B+C = -0.6% / -2.2% / -2.8%. Why (+A+B+C): ours-only worth: Assault Mark +4.8% (rank 20); community-only at ~0%: Earth Punishment.
- Earth Punishment, Noble Aura, Prayer of Amplification, Power Burst (expcarry): community vs ours, shipped / +A / +A+B+C = -15.8% / -17.1% / -16.0%. Why (+A+B+C): ours-only worth: Light of Protection +15.8% (rank 1), Assault Mark +4.8% (rank 20); community-only at ~0%: Earth Punishment, Power Burst.
- Earth Punishment, Noble Aura, Light of Protection, Yustiel's Power (aoeah): community vs ours, shipped / +A / +A+B+C = -4.9% / -6.6% / -17.1%. Why (+A+B+C): ours-only worth: Prayer of Amplification +17.4% (rank 5), Assault Mark +4.8% (rank 20); community-only at ~0%: Earth Punishment, Yustiel's Power.

**Reading.** The guide's Cleric is the damage build in which Condemnation always crits and so has no cooldown: Earth Punishment's tier 5 forces the crit and Condemnation's rank-12 option resets its cooldown on a crit. The guide's build (9696) carries both; the engine never picks the pair (defect 10). At low crit each half is worth little alone, the engine's own +A+B+C build has neither, and adding the pair to it gives +16.6% (8392 to 9785, one pool). That is why the Cleric is the class where the guide stays ahead after every patch (+15.5% at +A+B+C, +14.8% with E) and by the widest margin once buff values are rank-aware (+23.8%): Light of Protection at rank 1 is credited +18% against 10.5% in the client and Prayer of Amplification 17.5 s against 10 s, and re-valuing only those statuses lowers our build by about 8%. The model prices the guide's stigmas and the engine's alike (Light of Protection, Earth Punishment, Noble Aura, Prayer of Amplification are in both). With geared stats (crit 50%) each half of the pair has value alone and the engine does find it (section 7.1). The healer sets in the CHECK table are worth zero to the model, which has no healing or party model.

### Chanter

Boss, published couga54 PvE build:
- published (cleaned) 20151, as published with every pick applied 20151; ours shipped 15869, +A 18115, +A+B+C 19581, +A+B+C+E 19393 (table 3.1 numbers).
- the guide's stigmas and what the model says each is worth (leave-one-out, same rotation): Undefeated Mantra 20 (+29.3%), Power of the Storm 5 (+3.8%), Marchutan's Wrath 1 (+0.0%), Focused Defense 5 (+0.0%).
- the same four stigmas with the engine allocating levels, ranks and specialties (main run, same rotation pool as the guide's build 20188): shipped 15858, +A+B+C 19534, i.e. the guide's own allocation is +27.3% / +3.3% against the engine's allocation of the same set (shipped / +A+B+C).
- published -> engine (shipped), stigmas / ranks / specialties: -9.8% / -1.9% / -11.1% (reverse order -10.1%, +0.0%, -12.5%).
- published -> engine (+A+B+C), stigmas / ranks / specialties: -3.8% / +0.0% / +1.0% (reverse order -1.7%, +0.0%, -1.1%).
- second round (section 4.2, one pool): published 20148 (shipped model) / 20238 (rank-aware model); ours +A+B+C+E 19189, +F 19581, +F+E 19925; under the rank-aware model ours +F+G 20042 (+1.0%) and +F+G+E 20032 (+1.0%); stigmas with F+G+E: Undefeated Mantra 20, Power of the Storm 3, Obliterate 1, Fracturing Blow 1.
- skill ranks the shipped engine buys differently by 3+ (ours vs guide): Dark Crush 11 (guide 20), Recuperation 3 (guide 12), Defiance 7 (guide 16), Impactful Crush 3 (guide 12), Wave Blow 3 (guide 12), Tremor Crush 3 (guide 12)
- skill ranks the +A+B+C+E engine buys differently by 3+ (ours vs guide): Dark Crush 11 (guide 20), Recuperation 3 (guide 12), Defiance 7 (guide 16), Impactful Crush 3 (guide 12), Wave Blow 3 (guide 12), Rushing Smash 3 (guide 12), Tremor Crush 3 (guide 12)
- specialties, guide vs engine (+A+B+C+E): Dark Crush: guide [Critical Hit on hit, Adds [Piercing Strike] Chain Skill, Removes [Dark Crush] cooldown] / engine [none]; Impactful Crush: guide [+30% Skill Speed] / engine [none]; Incandescent Blow: guide [Deals up to 12% more damage when less targets are hit] / engine [-20% MP consumed, Deals up to 12% more damage when less targets are hit]; Obliterate: guide [none] / engine [+20% Skill Speed, Critical Hit on hit]; Onslaught: guide [-1s [Spinning Strike] cooldown on hit, Adds [Storm Chain] Chain Skill] / engine [+20% MP restored, Adds [Storm Chain] Chain Skill]; Power of the Storm: guide [-30s cooldown] / engine [+200 Critical Hit]; Undefeated Mantra: guide [+100 Critical Hit, +5% Critical Damage Boost, +5% Double Chance] / engine [+100 Critical Hit]

Boss, stigma sets (ranks and specialties allocated by the engine):
- Undefeated Mantra, Power of the Storm, Marchutan's Wrath, Focused Defense (couga): community vs ours, shipped / +A / +A+B+C = -0.1% / +0.7% / -0.2%. Why (+A+B+C): community-only worth: Marchutan's Wrath +1.6% (rank 16); ours-only worth: Obliterate +2.1% (rank 15); community-only at ~0%: Focused Defense; ours-only at ~0%: Fracturing Blow.
- Undefeated Mantra, Power of the Storm, Marchutan's Wrath, Sprint Mantra (couga-scrape, questlog): community vs ours, shipped / +A / +A+B+C = -0.1% / +1.7% / -0.3%. Why (+A+B+C): community-only worth: Marchutan's Wrath +1.6% (rank 15); ours-only worth: Obliterate +2.1% (rank 15); community-only at ~0%: Sprint Mantra; ours-only at ~0%: Fracturing Blow.
- Undefeated Mantra, Power of the Storm, Marchutan's Wrath, Obliterate (expcarry): community vs ours, shipped / +A / +A+B+C = +0.0% / +2.0% / -0.0%. Why (+A+B+C): community-only at ~0%: Marchutan's Wrath; ours-only at ~0%: Fracturing Blow.
- Undefeated Mantra, Marchutan's Wrath, Ensnaring Mark, Obliterate (aoeah): community vs ours, shipped / +A / +A+B+C = -2.9% / -0.7% / -3.4%. Why (+A+B+C): ours-only worth: Power of the Storm +5.3% (rank 15); community-only at ~0%: Marchutan's Wrath, Ensnaring Mark; ours-only at ~0%: Fracturing Blow.
- Undefeated Mantra, Healing Touch, Impeding Authority, Barrier Spell (expcarry, gegebase): community vs ours, shipped / +A / +A+B+C = -3.3% / -3.4% / -1.0%. Why (+A+B+C): ours-only worth: Power of the Storm +5.3% (rank 15), Obliterate +2.1% (rank 15); community-only at ~0%: Healing Touch, Impeding Authority, Barrier Spell; ours-only at ~0%: Fracturing Blow; ranks ours vs community: Undefeated Mantra 5 vs 20.

AoE / farming / solo, stigma sets:
- Undefeated Mantra, Power of the Storm, Marchutan's Wrath, Obliterate (couga-scrape): community vs ours, shipped / +A / +A+B+C = +0.8% / +0.0% / +0.0%. Why (+A+B+C): community-only at ~0%: Marchutan's Wrath; ours-only at ~0%: Fracturing Blow.
- Undefeated Mantra, Sprint Mantra, Marchutan's Wrath, Guardian Blessing (expcarry, aoeah): community vs ours, shipped / +A / +A+B+C = -8.9% / -7.3% / -14.4%. Why (+A+B+C): ours-only worth: Power of the Storm +17.6% (rank 15), Obliterate +3.6% (rank 15); community-only at ~0%: Sprint Mantra, Marchutan's Wrath, Guardian Blessing; ours-only at ~0%: Fracturing Blow.

**Reading.** After the patches the guide leads by 3-4% (1% under rank-aware values once F and G are applied). The lead sits on one stigma level: Undefeated Mantra 20 (+29.3% in the guide's build). In the guide's build Undefeated Mantra at 5 instead of 20 costs 5.8%, nearly all of it from rank 15 to 20 (the +5% Double Chance tier and the third specialty slot); the allocator values a rank by one option (defect 7) and the data gives the buff +18% at every rank (defect 8), so it has no reason to buy ranks. With F and G (and E) the engine takes Undefeated Mantra at 20 and scores 20032 to 20042 against the guide's 20238 (-1.0%). The guide's other two stigmas (Marchutan's Wrath, Focused Defense) are worth 0.0% in the model, and the engine's Obliterate and Fracturing Blow replace them. The guide runs Dark Crush at 20 with its three options (crit on hit, a chain skill, no cooldown); the engine leaves it at 11 and never opens those slots, and I did not test why.


## 7. Robustness: geared profile, seed noise, Sorcerer on the real character

### 7.1 Geared stat profile (boss)

The DarthThot stats are a leveling character's (crit 2.8%), far from what the guides assume. The boss runs were repeated with a geared profile (attack +20%, weapon damage +20%, damage boost +20%, crit chance 50% (the cap), crit damage +100%, smite +25%, combat speed +20%, cooldown 10%, MP 3000 with 30/s regeneration; seeds 0 and 1, same point budgets, same published builds):

| Class | Published (geared) | Ours shipped | Delta | Ours +A | Delta | Ours +A+B+C | Delta | DarthThot-stats delta shipped / +A+B+C |
|---|---|---|---|---|---|---|---|---|
| Gladiator | 37956 | 31160 | +21.8% | 38715 | -2.0% | 41235 | -8.0% | +32.4% / -6.2% |
| Templar | 44005 | 39454 | +11.5% | 46801 | -6.0% | 47335 | -7.0% | +16.5% / -7.6% |
| Assassin | 37876 | 32007 | +18.3% | 33505 | +13.0% | 37201 | +1.8% | +9.4% / -1.2% |
| Ranger | 26784 | 20793 | +28.8% | 24213 | +10.6% | 25156 | +6.5% | +33.4% / +7.5% |
| Sorcerer | 97952 | 72081 | +35.9% | 90414 | +8.3% | 101155 | -3.2% | +52.9% / +8.7% |
| Spiritmaster | 21490 | 18153 | +18.4% | 19502 | +10.2% | 20636 | +4.1% | +24.2% / +10.2% |
| Cleric | 40374 | 21254 | +90.0% | 32972 | +22.4% | 43728 | -7.7% | +85.9% / +15.8% |
| Chanter | 78143 | 65194 | +19.9% | 71596 | +9.1% | 77252 | +1.2% | +27.2% / +3.1% |

At the shipped level the guide leads in 8 of 8 classes, from +11.5% (Templar) to +90.0% (Cleric). After A+B+C the deltas run from -8.0% (Gladiator) to +6.5% (Ranger); the guide still leads by more than 2% in Spiritmaster (+4.1%), Ranger (+6.5%); ours leads by more than 2% in Gladiator (-8.0%), Cleric (-7.7%), Templar (-7.0%), Sorcerer (-3.2%). The pattern of the DarthThot runs holds, with one exception explained below (the Cleric): the shipped engine is behind everywhere, the patched engine is within about 8% either way, and Ranger and Spiritmaster are the two classes where the guide stays ahead in both profiles.

The Cleric row needs the correction described under table 3.1. With the harness's default tier-ordered stigma list the published Cleric scored 33651 and was 23% below ours at +A+B+C, because that list drops Earth Punishment's tier 5. With the tiers chosen by DPS the guide's build carries the pair that the guide describes as "Condemnation always crits, so it has no cooldown": Earth Punishment's "[Condemnation] lands as a Critical Hit on targets afflicted with [Earth Punishment]" plus Condemnation's "Resets cooldown on landing a Critical Hit with [Condemnation]". Condemnation then resets itself: 125 casts in 180 s and 54% of the damage in the guide's build, and the engine's +A+B+C build has the same pair (125 casts, 50%) and is 7.7% ahead. At geared crit each half has value on its own and the engine finds the pair; with the DarthThot stats it does not (section 4, defect 10). I did not find an internal cooldown for the reset in the data, so how fast the loop runs in game is not established.

### 7.2 Noise check on the flagged AoE sets

The AoE sets that tripped the +2% threshold at +A+B+C in the main run, and the classes whose builds vary most with the seed, were re-run with 8 seeds and a 400-simulation search budget (`out/noise_*.json`). "With E" compares our E build against the community set without E, both from this run.

- Gladiator AoE, set Lunge Stance, Zikel's Blessing, Focused Block, Rage Burst: community vs ours at +A+B+C +3.1% (8 seeds, 400-sim budget; seeds spread 32363-32668 community, 30875-31679 ours); with E +0.2%.
- Gladiator AoE, set Lunge Stance, Zikel's Blessing, Focused Block, Lifestealing Blade: community vs ours at +A+B+C -5.4% (8 seeds, 400-sim budget; seeds spread 29621-29962 community, 30875-31679 ours); with E -8.1%.
- Gladiator AoE, set Lunge Stance, Lifestealing Blade, Wave Armor, Rage Burst: community vs ours at +A+B+C -7.1% (8 seeds, 400-sim budget; seeds spread 29208-29417 community, 30875-31679 ours); with E -9.8%.
- Ranger AoE, set Arrow Storm, Vaizel's Authority, Explosive Arrow, Bow of Blessing: community vs ours at +A+B+C -2.6% (8 seeds, 400-sim budget; seeds spread 24474-25646 community, 25276-26327 ours); with E -4.3%.
- Ranger AoE, set Arrow Storm, Vaizel's Authority, Griffon Arrow, Bow of Blessing: community vs ours at +A+B+C +4.6% (8 seeds, 400-sim budget; seeds spread 27314-27527 community, 25276-26327 ours); with E +2.7%.
- Ranger AoE, set Explosive Arrow, Griffon Arrow, Arrow Storm, Mother Nature's Breath: community vs ours at +A+B+C -12.3% (8 seeds, 400-sim budget; seeds spread 21846-23085 community, 25276-26327 ours); with E -13.9%.
- Sorcerer AoE, set Element Enhancement, Fire Wall, Glacial Smite, Delayed Explosion: community vs ours at +A+B+C -0.7% (8 seeds, 400-sim budget; seeds spread 118837-134529 community, 119533-135425 ours); with E -1.4%.
- Sorcerer AoE, set Element Enhancement, Fire Wall, Glacial Smite, Cold Storm: community vs ours at +A+B+C -3.1% (8 seeds, 400-sim budget; seeds spread 116479-131196 community, 119533-135425 ours); with E -3.9%.
- Sorcerer AoE, set Element Enhancement, Fire Wall, Cold Storm, Steel Barrier: community vs ours at +A+B+C -2.6% (8 seeds, 400-sim budget; seeds spread 115481-131901 community, 119533-135425 ours); with E -3.4%.

Sorcerer AoE's flagged +3.6% was noise (with 8 seeds the same set is -0.7%). Gladiator AoE's +3.1% survives and E closes it (+0.2%). Ranger AoE's +4.6% survives and E only halves it (+2.7%).

### 7.3 Sorcerer on his real character

The task named the DarthThot fixture, which is a Sorcerer. His real ranks, stigma levels and 84 Daevanion nodes were run once as they are (`cbsorc.py`), without clearing anything:

- Product path `webapi.compare(b, 0)` on his real character, boss: 14290 DPS (AoE 52719); its stigmas: Fire Wall, Element Enhancement, Glacial Smite, Cold Storm (his equipped set is Element Enhancement, Cold Storm, Fire Wall, Delayed Explosion).
- Boss, scored under the shared rotation pool: ours shipped 14549, ours +A 15803; the guide's stigma set at his real ranks 14549 shipped / 15953 +A (+0.0% / +1.0% vs ours); the guide's full build (its ranks, levels and specialties forced onto the real character) 28819 (+98% vs ours shipped).
- AoE: ours shipped 53208, +A 59792; guide set 53208 / 59792.

This measures how far his character is from the guide's build (ranks, stigma levels, specialties), not how good the engine is: the gap is +98% on the real character and the engine's own recommendation for his real ranks (Fire Wall, Element Enhancement, Glacial Smite, Cold Storm) is within 1% of the guide's stigma set at his ranks.

## 8. Daevanion

The guides give a priority list, not a node set, and the engine's planner is outside what the task compares, so this is a qualitative read, not a DPS test. The engine route is `daevanion_suggest` on the published build with its base ranks (at most 10) and a +6 ring/arcana bonus (the guide's decomposition: 10 from points, +4 Daevanion, +2 rings, +4 arcana), boss playstyle, no nodes opened beforehand. Many nodes in an early route are connectors (Max HP, Defense, MP) on the way to a valued node, so the stat counts are not recommendations.

| Class | Guide priority (couga54, 2026-10-03) | Engine route, first 65 points (skill nodes taken, orange nodes) | Modelled gain at 65 / 150 points |
|---|---|---|---|
| Gladiator | blue Overhead Slam, Rending Blow, Ruinous Blow; orange Combat Speed/CDR (Nezekan) then Damage Boost (Zikel); green Experienced Counterstrike, Attack Preparation, Murderous Burst; Azphel last (PvP only) | Blood Absorption x2, Overhead Slam x1, Ankle Slice x1, Aerial Snare x1; orange: Cooldown Reduction x2, Combat Speed x2 | 7.0% / 15.3% |
| Templar | blue Judgment, Punishment, Pummel, then Shield Smite, Annihilate; orange nodes; take Attack instead of MP nodes; skip Flash Rampage nodes | Pummel x3, Punishment x3, Insulting Roar x1, Punishing Benediction x1; orange: Cooldown Reduction x1, Damage Boost x1 | 9.1% / 22.7% |
| Assassin | blue Heart Gore, Insignia Explosion, Quick Slice, then Ambush, Storm Rampage; orange crit damage (Vaizel); green Exploit Weakness, Rear Smite, Assault Stance | Heart Gore x3, Quick Slice x2, Exploit Weakness x1, Ambush Stance x1, Revitalization Contract x1; orange: Combat Speed x2, Damage Boost x1 | 9.2% / 15.1% |
| Ranger | blue nodes that lift Deadshot, Snipe, Gale Arrow, Drill Dart, Burst Arrow to 12; orange Combat Speed, CDR; then Attack, Crit, Focused Eye, Hunter's Resolve; avoid MP+50 nodes | Tempest Shot x3, Marking Shot x2, Hunter's Soul x1, Drill Dart x1, Binding Eye x1, Revitalization Contract x1, Gale Arrow x1; orange: Damage Boost x1 | 6.4% / 13.6% |
| Sorcerer | orange Combat Speed + CDR first; then Attack/Damage Boost, Crit Damage; blue Blaze, Bittercold Wind, Ice Chain, Hellfire; green Robe of Earth; skip Multi-Hit | Bittercold Wind x3, Firestorm x2, Revitalization Contract x1, Grace of Enhancement x1, Hellfire x1, Winter's Shackles x1; orange: Damage Boost x2 | 7.8% / 13.7% |
| Spiritmaster | blue Elemental Fusion, Combustion, Summon: Fire Spirit, Cold Shock, Water Spirit; green Mental Focus, Spirit Strike; then offensive orange | Summon: Wind Spirit x4, Dimensional Control x2, Consecutive Countercurrent x1, Element Unification x1, Combustion x1, Corrode x1; orange: Damage Boost x1 | 6.8% / 10.2% |
| Cleric | orange Cooldown + Combat Speed first, then Attack and Critical, then blue Condemnation, Divine Aura, Bolt; defensive orange; passives last | Judgment Thunder x3, Bolt x3, Prayer of Concentration x1, Survival Willpower x1, Condemnation x1, Empyrean Lords' Grace x1; orange: Damage Boost x1 | 6.2% / 14.9% |
| Chanter | blue Dark Crush, Onslaught, Spinning Strike, Incandescent Blow; then orange | Spinning Strike x4, Incandescent Blow x3, Dark Crush x2, Raging Spell x1; orange: none | 10.8% / 24.3% |

What stands out, read from the table (I did not trace why the planner chooses what it chooses). The engine's first 65 points overlap the guide's blue-node priorities for Templar (Pummel, Punishment), Assassin (Heart Gore, Quick Slice) and Chanter (Spinning Strike, Incandescent Blow, Dark Crush: three of the guide's four), and only partly for Ranger (Gale Arrow), Sorcerer (Bittercold Wind, Hellfire) and Cleric (Bolt, Condemnation). It takes one Overhead Slam node for the Gladiator and none of the Rending Blow or Ruinous Blow nodes the guide lists first, and it takes Wind Spirit nodes first for the Spiritmaster where the guide wants Fire Spirit, Elemental Fusion and Combustion. On the orange nodes the guides want Combat Speed and Cooldown Reduction first (Gladiator, Ranger, Sorcerer, Cleric): the engine takes both for the Gladiator, one of them for Assassin (Combat Speed) and Templar (Cooldown Reduction), and neither for Ranger, Sorcerer and Cleric, which get Damage Boost instead.

## 9. Sources, reuse terms, PvP, what was rejected

Per-source reuse verdicts follow `research/role_builds_2026-10-04.md` section 2.3 (read 2026-10-04); this file copies no source prose, only names, levels and numbers (game facts) with a link, a date and the creator credits the sources name.

| Source | Used for | Date | Reuse terms |
|---|---|---|---|
| couga54 guide, https://couga54.github.io/aion2-guides/en/<class>/ | PvE builds (stigma levels, skill ranks, specialty picks), Daevanion priority, AoE/solo/PvX notes | page 'Updated: Oct 3, 2026, Patch Season 1'; fetched 2026-10-04 (AoE/alternate sets from the 2026-10-03 scrape in research/community_builds/consensus.json) | no licence file; the guide credits creators (Arthars Gaming, aLuckyRO, Sen, SolAshur, trueeevil, Kaeria, notXeon, WallyJTV, Evripides, DankRNG, EUTOPIA...) who own their guides: ASK before showing anything verbatim |
| questlog.gg class pages, https://questlog.gg/aion-2/en/classes/<class> | stigma usage % and average levels, active-skill average levels | read with a browser 2026-10-04 (live aggregate; page lists 138-439 skill builds per class) | LINK: cite the number with date and link, do not mirror builds |
| expcarry.com class guides, https://expcarry.com/aion-2-<class>-guide | stigma sets by content type (boss, AoE/solo, arena) | dateModified 2026-09-28 .. 2026-09-29 | seller SEO site: the role-builds note says SKIP for data except its Templar page (LINK at most); used here only for stigma names that match the client |
| aoeah.com news 4215, https://www.aoeah.com/news/4215--aion-2-global-best-builds--skills-for-each-class-solo-pvp--pve | stigma sets and some levels per class (PvE, solo, PvP) | published 2026-10-01 | seller SEO site, machine-translated names (mapped, see notes), not assessed in the role-builds note; names only |
| gegebase.com class guides, https://gegebase.com/games/aion2/<class>_pve_guide | Templar, Cleric, Chanter, Spiritmaster stigma priorities | undated; read through research/role_builds_2026-10-04.md on 2026-10-04 | LINK |
| Inven KR boards (Cleric Sanctuary guide 28996), https://www.inven.co.kr/board/aion2/6452/28996 | Cleric Sanctuary stigma trio | 2026-09-14 (read through the role-builds note) | author-owned, no public licence: ASK |

Checked and not used:

- aoeah.com news 4234: published 2025-12-02; its skill names (Rapid Shot, Deadly Focus...) are not in the game: rejected
- aion2hub.com/builds: 2026-10-04: one Global build (Cleric, GS 3,158) with no stigma/skill list; the KR/TW entries are gear planner templates
- aion2.app / aion2t.com/simulator, metaroad.gg planner: 2026-10-04: empty planner interfaces, no shared builds
- questlog.gg character builds: build pages render skills in a canvas the fetch cannot read; the most-liked builds are budget builds (GS 1,441 for the Gladiator 'Netero')
- Inven 6444/2002 (Gladiator stigma level-25 specialties, 2026-07-01): image-only post, KR level-25 meta: not usable
- Vortex Gaming translations of Inven posts (postdetail 728097, 977592, 688137): undated, machine-translated names, KR 6-slot meta: not used
- noping.com: HTTP 403

PvP builds were collected and not simulated (the engine states "PvP is not modeled"; 27% of Daevanion stat nodes and the PvP damage buckets have no value in it):

| Class | Source | Stigmas | Core skills | URL (page date) |
|---|---|---|---|---|
| Gladiator | couga54 PvP/Abyss | Lunge Stance 20, Armor of Balance 5, Tenaciousness 10, Blade Toss 5 | Overhead Slam 20; Mocking Blade, Defiance, Aerial Snare 16 | https://couga54.github.io/aion2-guides/en/gladiator/ (2026-10-03) |
| Gladiator | expcarry Arena | Blade Toss, Armor of Balance, Tenaciousness, Lunge Stance | - | https://expcarry.com/aion-2-gladiator-guide (2026-09-28) |
| Templar | couga54 PvP | Executing Blade 10, Empyrean Lord's Punishment 15, Doom Shield 15, Nezekan's Shield 15 | Judgment, Punishment, Pummel, Annihilate 20 | https://couga54.github.io/aion2-guides/en/templar/ (2026-10-03) |
| Templar | expcarry Arena | Doom Shield, Grapple, Armor of Balance, Second Skin | - | https://expcarry.com/aion-2-templar-guide (2026-09-28) |
| Assassin | expcarry Arena | Illusive Clone, Swift Contract, Smoke Bomb, Evasion Stance or Shadowstep | - | https://expcarry.com/aion-2-assassin-guide (2026-09-29) |
| Ranger | expcarry Arena | Bow of Blessing, Explosive Arrow, Arrow Storm, Mother Nature's Breath | - | https://expcarry.com/aion-2-ranger-guide (2026-09-29) |
| Sorcerer | expcarry Arena | Element Enhancement, Steel Barrier, Soul Freeze, Hibernation | - | https://expcarry.com/aion-2-sorcerer-guide (2026-09-29) |
| Spiritmaster | couga54 PvP | Summon: Ancient Spirit 20, Enhance: Spirit's Benediction 20, Command: Proxy 20, Seize Magic 20 | Defiance, Cold Shock, Elemental Fusion, Jointstrike: Curse, Combustion 20 | https://couga54.github.io/aion2-guides/en/elementalist/ (2026-10-03) |
| Spiritmaster | expcarry Arena | Cry of Terror, Seize Magic, Magic Block, Command: Proxy | - | https://expcarry.com/aion-2-spiritmaster-guide (2026-09-29) |
| Cleric | expcarry Arena | Salvation, Root, Absolution, Yustiel's Power | - | https://expcarry.com/aion-2-cleric-guide (2026-09-29) |
| Chanter | expcarry Arena | Focused Defense, Ensnaring Mark, Guardian Blessing, Assault Shock | - | https://expcarry.com/aion-2-chanter-guide (2026-09-29) |

Engine-side facts used above: `webapi.optimize(build, "boss", 0)` = `optimize_full_build` with `daevanion_points=0`; `CharacterBuild.skill_points`/`stigma_points` are unspent points added on top of the ranks as entered; `stigma_slots_at` gives 4 slots from level 37.

## 10. Reproduction, deviations from the task, caveats

**Deviations from the task as written.** (1) The task asked to compare with `webapi.compare(b, 0)`. On the plain import every rank is 1 and no points can be spent, so that number is not a build; each class instead gets the points the published build spends and the engine plans from there (section 2). The literal product path is reported for every class in section 3.5 and for the Sorcerer's real character in section 7.3. (2) Every score is pooled over the rotations of its group (section 2). (3) The "patched" columns come from monkeypatches in a scratch harness, never from the repo. (4) The Cleric's published build has its stigma tiers chosen by the engine's DPS under its own slot rule instead of by tier order (see the note under table 3.1); for the other seven classes the two ways differ by 0.0% to +0.8% (table 4.3).

**Reproduction.** Scratch harness (not in the repo): `C:\Users\jonca\AppData\Local\Temp\claude\D--Aion2\50f3641b-497a-41d6-831c-c03692d37ec3\scratchpad\cb\` - `cblib.py` (fixture import, plan resolution, patches A to G, pooled scoring), `cbdata*.py` (the community builds as transcribed), `cbrun.py` (one group per class and playstyle), `cbchain.py` (published to engine attribution), `cbfixfg.py` (patches F and G), `cbrankaware.py` (rank-aware re-score), `cbtiers.py` (stigma tier rule), `cbresid.py` (which stigma level carries the guide's lead), `cbcheck.py` (CHECK rows re-scored rank-aware), `cblit.py` (literal `compare(b, 0)`), `cbspec.py`, `cbfill.py`, `cbsorc.py`, `cbdae.py`; `cbfacts.py`, `cbreport_*.py`, `cbclass.py` and `cbassemble.py` build this file from `out/*.json`; results in `out/*.json`. The Cleric's chain, main, geared and F/G runs were redone with `CB_PUB_TIERS=engine` (old outputs in `out/old_tierordered/`). Run from `D:\Aion2\app` with `PYTHONDONTWRITEBYTECODE=1`.

**Caveats.**

- Model DPS is not calibrated and is comparable only within a class; the DarthThot stat profile is a leveling character (section 7 repeats the boss runs with a geared profile and the pattern holds, with the Cleric as the exception that needs a look).
- The model itself is the largest uncertainty: defect 8 (buff values at one fixed rank) and defect 9 (stigma tiers limited by mastery slots) are statements about the game data and rules that I checked against the data notes and the repo's own research files, not against the game. If defect 9 is real, every stigma at rank 10 to 20 is under-credited by a tier on both sides.
- The AoE scenario assumes 4 targets for 30 s, while spawn data says real packs are 1.4-1.9 mobs (`research/playstyles_gamedata_2026-10-04.md`); named bosses stagger for 5 s and the engine never casts stagger-only skills.
- Where a guide picks damage options the engine cannot value (12-26 picks per class change DPS by 0.05% or less, defect 6) the published build is under-credited; where the guide picks an option the model says lowers DPS (Gladiator Overhead Slam "Adds Upward Strike", -9.5%) the cleaned number drops it, which favours the guide.
- expcarry and aoeah are seller sites whose sets are used only as alternative stigma sets; questlog numbers are crowd averages (leveling builds included); leave-one-out stigma values are measured with the same rotation minus the stigma, so a stigma that gates a cast (Corrode, Focused Block) looks larger than its own effect.
- The first-listed couga54 sets for AoE/solo come from the 2026-10-03 scrape.
- Community stigma-set rows (tables 3.2 and 3.3) are scored at the shipped, +A and +A+B+C levels; the E, F and G patches exist only for our own plan, so a set row that is flagged at +A+B+C can be smaller after them (the +E column compares our E build with the set without E).
- Not checked: any of the 8 builds in game; the PvP builds in the engine; Daevanion routes as DPS; the Korean-only options (Global caps used throughout).

## Appendix A. Community builds as collected

### Gladiator

**couga54 PvE (boss / raid) build** - https://couga54.github.io/aion2-guides/en/gladiator/ - page says 'Updated: Oct 3, 2026, Patch Season 1', fetched 2026-10-04
- Stigmas: Lunge Stance 20, Focused Block 5, Rage Burst 5, Zikel's Blessing 10
- Skill ranks (final targets, bonus ranks from Daevanion, rings and arcana included): Overhead Slam 20, Rending Blow 20, Ruinous Blow 16, Leaping Slam 12, Rush Strike 12, Mocking Blade 12, Ankle Slice 12, Crushing Wave 12, Defiance 16, Sword Aura Rampage 16, Keen Strike 12, Aerial Snare 12
- Specialty picks (rank tier: option): Overhead Slam: 8 Adds [Upward Strike] Chain Skill, 16 Remove cooldown, 12 Critical Hit on hit; Rending Blow: 12 Deals up to 12% more damage when less targets are hit, 16 Restores 50 MP on landing a Critical Hit, 8 Changes to mobile skill; Ruinous Blow: 8 +30% Skill Critical Hit, 12 Extra damage on hit; Leaping Slam: 8 Prepare for Battle effect on the caster for 3s, 8 Resets cooldown on defeating an enemy; Rush Strike: 8 Restores 300 Stamina on hit, 8 +10m Range; Mocking Blade: 8 Absorbs 4% HP, absorbs 15% HP of target with Incapacitated Immunity, 8 Changes to AoE damage on down strike; Ankle Slice: 8 +16m [Ankle Slice] range, 12 Ignores Block and Evasion and lands as Multi-Hit; Crushing Wave: 8 Absorbs 2% HP, 12 Resets cooldown on landing a Critical Hit; Defiance: 16 +50% PvE Damage Tolerance and +25% PvP Damage Tolerance for Tenacity duration; Sword Aura Rampage: 8 Changes to mobile skill, 16 -1s all skill cooldowns on hit; Keen Strike: 8 +20% MP restored, 12 -1s [Ruinous Blow] cooldown on hit; Aerial Snare: 8 +100% damage to targets with Incapacitated Immunity, 12 Adds [Forced Fall] Chain Skill

| Stigma set (4 slots) | Content | Sources |
|---|---|---|
| Lunge Stance, Focused Block, Rage Burst, Zikel's Blessing | boss/dungeon | couga54 (page dated 2026-10-03), questlog usage (2026-10-04): questlog top-4 by usage: Rage Burst 68%, Zikel's 67%, Lunge Stance 65%, Focused Block 48% |
| Lunge Stance, Focused Block, Rage Burst, Lifestealing Blade | boss/dungeon | couga54 (2026-10-03 scrape): couga alternate: Lifestealing Blade 20 in place of Zikel's |
| Lunge Stance, Rage Burst, Zikel's Blessing, Wave Armor | boss/dungeon | expcarry (2026-09-28/29): expcarry Boss DPS |
| Lunge Stance, Zikel's Blessing, Focused Block, Rage Burst | AoE/farming/solo | couga54 (2026-10-03 scrape), aoeah (2026-10-01): couga AoE; aoeah solo (Lung Stance, Sigils Blessing, Focused Block, Rage Burst) |
| Lunge Stance, Zikel's Blessing, Focused Block, Lifestealing Blade | AoE/farming/solo | couga54 (2026-10-03 scrape): couga AoE alternative 4th: Lifestealing Blade |
| Lunge Stance, Lifestealing Blade, Wave Armor, Rage Burst | AoE/farming/solo | expcarry (2026-09-28/29): expcarry AoE/Solo |

questlog usage (https://questlog.gg/aion-2/en/classes/gladiator, read 2026-10-04, page lists 439 skill builds; average level in brackets): stigmas Rage Burst 68% (12), Zikel's Blessing 67% (13), Lunge Stance 65% (15), Focused Block 48% (10), Lifestealing Blade 27% (14), Wave Armor 17% (14), Blade Toss 7% (14), Tenaciousness 7% (16); actives Rending Blow 92% (15), Overhead Slam 92% (15), Ruinous Blow 91% (15), Leaping Slam 89% (13), Rush Strike 84% (13), Sword Aura Rampage 77% (13), Crushing Wave 68% (14), Mocking Blade 67% (13).

### Templar

**couga54 PvE (boss / raid) build** - https://couga54.github.io/aion2-guides/en/templar/ - page says 'Updated: Oct 3, 2026, Patch Season 1', fetched 2026-10-04
- Stigmas: Empyrean Lord's Punishment 15, Battlefield Banner 15, Doom Shield 15, Taunt 5
- Skill ranks (final targets, bonus ranks from Daevanion, rings and arcana included): Judgment 20, Punishment 20, Pummel 20, Annihilate 16, Shield Smite 16, Debilitating Smash 12, Warding Strike 12, Flash Rampage 12, Shield Rush 12, Vicious Strike 10
- Specialty picks (rank tier: option): Judgment: 8 Extra damage on hit, 12 Critical Hit on hit, 16 Remove cooldown; Punishment: 8 Inflicts Damage over Time to target on hit, 8 +30% Skill Speed, 16 Ignores Block and Evasion and lands as a Critical Hit; Pummel: 8 [Punishing Strike] absorbs 3% HP, 8 Deals up to 12% more damage when less targets are hit, 16 Activates [Punishing Strike] 1 extra time; Annihilate: 8 +100% damage to targets with Incapacitated Immunity, 12 -10s cooldown; Shield Smite: 8 50% chance to trigger [Debilitating Smash] on hit, 12 -2s cooldown; Debilitating Smash: 8 30% chance to inflict Stun for 3s, 12 Ignores Block and Evasion and lands as Multi-Hit; Warding Strike: 8 +100 Block during Warding, 12 Adds PvE Damage Tolerance and PvP Damage Tolerance increase effect when more targets hit to Warding; Flash Rampage: 12 Multi-Hit on hit; Shield Rush: 8 +10m Range, 12 -10s cooldown

| Stigma set (4 slots) | Content | Sources |
|---|---|---|
| Empyrean Lord's Punishment, Battlefield Banner, Doom Shield, Taunt | boss/dungeon | couga54 (page dated 2026-10-03): couga PvE (group) |
| Empyrean Lord's Punishment, Battlefield Banner, Doom Shield, Nezekan's Shield | boss/dungeon | couga54 (2026-10-03 scrape): couga solo: Nezekan's Shield instead of Taunt |
| Empyrean Lord's Punishment, Executing Blade, Battlefield Banner, Doom Shield | boss/dungeon | couga54 (2026-10-03 scrape): couga PvX preset |
| Doom Shield, Battlefield Banner, Noble Armor, Shield of Protection | boss/dungeon | questlog usage (2026-10-04): questlog top-4: Doom Shield 62%, Banner 57%, Noble Armor 48%, Shield of Protection 46% |
| Taunt, Doom Shield, Battlefield Banner, Empyrean Lord's Punishment | boss/dungeon | aoeah (2026-10-01): aoeah PvE/solo (Impairing Lord's Punishment = Empyrean Lord's Punishment) |
| Taunt, Shield of Protection, Second Skin, Doom Shield | boss/dungeon | expcarry (2026-09-28/29), gegebase (undated): expcarry Build 1 / gegebase tank-first (4th slot 'flexible protection': Doom Shield or Nezekan's Shield) |
| Taunt, Doom Shield, Shield of Protection, Empyrean Lord's Punishment | boss/dungeon | six-guide frequency count: the four most frequent stigmas across the six written Templar guides read in role_builds_2026-10-04.md section 3.2 (Taunt 6/6, Doom Shield 5/6, Shield of Protection 5/6, ELP 4-5/6) |
| Empyrean Lord's Punishment, Doom Shield, Executing Blade, Battlefield Banner | AoE/farming/solo | couga54 (2026-10-03 scrape): couga AoE / PvX |
| Grapple, Assault Fury, Doom Shield, Shield of Protection | AoE/farming/solo | expcarry (2026-09-28/29): expcarry AoE/Solo |

questlog usage (https://questlog.gg/aion-2/en/classes/templar, read 2026-10-04, page lists 310 skill builds; average level in brackets): stigmas Doom Shield 62% (11), Battlefield Banner 57% (14), Noble Armor 48% (14), Shield of Protection 46% (14), Taunt 45% (13), Empyrean Lord's Punishment 40% (13), Executing Blade 23% (13), Nezekan's Shield 20% (12); actives Punishment 91% (14), Warding Strike 91% (13), Poach 91% (12), Shield Smite 89% (13), Judgment 88% (14), Shield Rush 87% (13), Debilitating Smash 85% (12), Annihilate 85% (13).

### Assassin

**couga54 PvE (boss / raid) build** - https://couga54.github.io/aion2-guides/en/assassin/ - page says 'Updated: Oct 3, 2026, Patch Season 1', fetched 2026-10-04
- Stigmas: Illusive Clone 20, Swift Contract 15, Savage Fang 15, Triniel's Dagger 10
- Skill ranks (final targets, bonus ranks from Daevanion, rings and arcana included): Heart Gore 20, Insignia Explosion 20, Quick Slice 20, Ambush 16, Storm Rampage 16, Defiance 12, Savage Roar 12, Shadowstrike 12, Flash Slice 12, Infiltrate 12, Whirlwind Slice 12, Shadow Fall 12
- Specialty picks (rank tier: option): Heart Gore: 8 Absorbs 0.7% HP, 16 Resets [Heart Gore] cooldown on landing a Critical Hit; Insignia Explosion: 8 Keep 2 stacks of Insignias after [Insignia Explosion], 16 -3s cooldown; Quick Slice: 12 -1s [Insignia Explosion] cooldown on hit, 16 Ignores Block and Evasion and lands as a Critical Hit; Ambush: 8 Engraves 2 Insignias for 10s on landing as a Back attack, 16 +2 consecutive uses; Storm Rampage: 12 Multi-Hit on hit, 16 -1s all skill cooldowns on hit; Defiance: 8 Restores 20% HP on using [Defiance], 12 +2s Tenacity duration; Savage Roar: 8 +20% Skill Speed, 12 -1s [Shadowstrike] cooldown on hit; Shadowstrike: 8 +20% caster Critical Damage Boost for 5s on hit; Flash Slice: 8 +6m Range, 12 +1 consecutive use; Infiltrate: 8 Restores 300 Stamina on landing [Infiltrate], 8 +10m [Infiltrate] range; Whirlwind Slice: 8 +50% Multi-Hit on hit, 8 +16m range; Shadow Fall: 8 Absorbs 10% HP, 8 -5s cooldown

| Stigma set (4 slots) | Content | Sources |
|---|---|---|
| Illusive Clone, Swift Contract, Savage Fang, Triniel's Dagger | boss/dungeon | couga54 (page dated 2026-10-03), expcarry (2026-09-28/29), questlog usage (2026-10-04), aoeah (2026-10-01): same four everywhere (questlog: Illusive Clone 86%, Swift Contract 79%, Triniel's 71%, Savage Fang 62%) |
| Savage Fang, Illusive Clone, Swift Contract, Throw Shadowblade | AoE/farming/solo | couga54 (2026-10-03 scrape): couga AoE (Throw Shadowblade resets on kill) |
| Illusive Clone, Savage Fang, Throw Shadowblade, Evasion Stance | AoE/farming/solo | expcarry (2026-09-28/29): expcarry AoE/Solo ('one defensive option' read as Evasion Stance) |
| Illusive Clone, Swift Contract, Throw Shadowblade, Triniel's Dagger | AoE/farming/solo | aoeah (2026-10-01): aoeah solo |

questlog usage (https://questlog.gg/aion-2/en/classes/assassin, read 2026-10-04, page lists 232 skill builds; average level in brackets): stigmas Illusive Clone 86% (13), Swift Contract 79% (12), Triniel's Dagger 71% (10), Savage Fang 62% (13), Evasion Stance 29% (12), Smoke Bomb 13% (9), Shadow Walk 10% (17), Spiral Slice 9% (16); actives Insignia Explosion 96% (15), Heart Gore 95% (15), Shadowstrike 95% (12), Flash Slice 94% (12), Savage Roar 93% (14), Infiltrate 92% (12), Storm Rampage 83% (13), Ambush 67% (13).

### Ranger

**couga54 PvE (boss / raid) build** - https://couga54.github.io/aion2-guides/en/ranger/ - page says 'Updated: Oct 3, 2026, Patch Season 1', fetched 2026-10-04
- Stigmas: Vaizel's Authority 20, Bow of Blessing 10, Supporting Fire 10, Griffon Arrow 10
- Skill ranks (final targets, bonus ranks from Daevanion, rings and arcana included): Deadshot 20, Gale Arrow 20, Drill Dart 16, Snipe 16, Tempest Shot 16, Snare Shot 12, Marking Shot 12, Burst Arrow 12, Explosion Trap 12, Suppressing Arrow 12, Defiance 12, Arrow Scattershot 12
- Specialty picks (rank tier: option): Deadshot: 8 +30% Skill Speed, 8 Changes to mobile skill, 16 [Deadshot] grants extra damage on hit; Gale Arrow: 8 Changes to mobile skill, 12 Increases Combat Speed, PvE Damage Boost, and PvP Damage Boost when less targets hit, 16 -10s cooldown; Drill Dart: 8 +20% Skill Speed, 16 Activates [Drill Dart] 1 extra time; Snipe: 12 -1s [Deadshot] cooldown on hit, 16 Adds [Tempest Arrow] Chain Skill; Tempest Shot: 8 Deals up to 12% more damage when less targets are hit, 16 +20% Skill Speed; Snare Shot: 8 +20% Skill Speed, 8 Changes to mobile skill; Marking Shot: 8 +5% Perfect Chance for the duration, 8 +5s duration; Burst Arrow: 8 Changes to mobile skill, 12 Up to +20% damage when less targets are hit; Explosion Trap: 8 Pulls enemies on explosion, 8 Extra damage after 3s on hit; Suppressing Arrow: 8 +50% Multi-Hit on hit, 8 +20% Skill Speed; Defiance: 8 Restores 1000 Stamina on using [Defiance], 8 Restores 20% HP on using [Defiance]; Arrow Scattershot: 8 Changes to mobile skill, 12 Multi-Hit on hit

| Stigma set (4 slots) | Content | Sources |
|---|---|---|
| Vaizel's Authority, Bow of Blessing, Supporting Fire, Griffon Arrow | boss/dungeon | couga54 (page dated 2026-10-03), questlog usage (2026-10-04): questlog: Vaizel's 78%, Bow 76%, Supporting Fire 68%, Griffon 64% |
| Vaizel's Authority, Bow of Blessing, Supporting Fire, Explosive Arrow | boss/dungeon | couga54 (2026-10-03 scrape): couga alternate: Explosive Arrow instead of Griffon Arrow |
| Vaizel's Authority, Bow of Blessing, Griffon Arrow, Explosive Arrow | boss/dungeon | aoeah (2026-10-01): aoeah PvE |
| Bow of Blessing, Explosive Arrow, Griffon Arrow, Arrow Storm | boss/dungeon | expcarry (2026-09-28/29): expcarry Boss DPS (no Vaizel's Authority) |
| Arrow Storm, Vaizel's Authority, Explosive Arrow, Bow of Blessing | AoE/farming/solo | couga54 (2026-10-03 scrape): couga AoE (Explosive Arrow variant) |
| Arrow Storm, Vaizel's Authority, Griffon Arrow, Bow of Blessing | AoE/farming/solo | couga54 (2026-10-03 scrape): couga AoE (Griffon Arrow variant) |
| Explosive Arrow, Griffon Arrow, Arrow Storm, Mother Nature's Breath | AoE/farming/solo | expcarry (2026-09-28/29): expcarry AoE/Solo |

questlog usage (https://questlog.gg/aion-2/en/classes/ranger, read 2026-10-04, page lists 388 skill builds; average level in brackets): stigmas Vaizel's Authority 78% (16), Bow of Blessing 76% (16), Supporting Fire 68% (16), Griffon Arrow 64% (16), Explosive Arrow 34% (14), Mother Nature's Breath 24% (15), Arrow Storm 8% (12), Ambush Kick 5% (15); actives Drill Dart 92% (14), Marking Shot 92% (12), Gale Arrow 92% (14), Tempest Shot 91% (14), Snare Shot 89% (12), Burst Arrow 89% (13), Explosion Trap 83% (12), Deadshot 79% (15).

### Sorcerer

**couga54 PvE (boss / raid) build** - https://couga54.github.io/aion2-guides/en/sorcerer/ - page says 'Updated: Oct 3, 2026, Patch Season 1', fetched 2026-10-04
- Stigmas: Element Enhancement 20, Cold Storm 10, Fire Wall 10, Delayed Explosion 10
- Skill ranks (final targets, bonus ranks from Daevanion, rings and arcana included): Hellfire 16, Firestorm 16, Bittercold Wind 16, Blaze 16, Wish of Concentration 16, Winter's Shackles 16, Flame Arrow 16, Ice Chain 12, Flame Scattershot 12, Defiance 12
- Specialty picks (rank tier: option): Hellfire: 8 +30% Skill Speed, 8 Fire Damage over Time for 10s on hit; Firestorm: 8 -50% MP Cost, 12 -2s [Hellfire] cooldown per fireball; Bittercold Wind: 8 +1s [Bittercold Wind] summon duration, 12 Ignores Block and Evasion and lands as a Critical Hit; Blaze: 8 Delayed Damage after 3s, 12 Multi-Hit on hit; Wish of Concentration: 8 +10% additional Attack, 12 +10% Combat Speed; Winter's Shackles: 8 +20% PvE Damage Boost and +10% PvP Damage Boost for 5s on landing [Winter's Shackles], 16 -15s [Winter's Shackles] cooldown; Flame Arrow: 12 Inflicts Fire Mark for 5s on landing [Pyroclasm], 16 Reset [Blaze] cooldown on landing [Pyroclasm]; Ice Chain: 8 +20% Skill Speed, 12 -1s [Winter's Shackles] cooldown on hit; Flame Scattershot: 8 Changes to mobile skill, 12 Multi-Hit on hit; Defiance: 8 Restores 20% HP on using [Defiance], 12 +2s Tenacity duration

| Stigma set (4 slots) | Content | Sources |
|---|---|---|
| Element Enhancement, Cold Storm, Fire Wall, Delayed Explosion | boss/dungeon | couga54 (page dated 2026-10-03), questlog usage (2026-10-04), expcarry (2026-09-28/29): questlog: EE 78%, Delayed Explosion 69%, Fire Wall 55%, Cold Storm 42% |
| Element Enhancement, Fire Wall, Cold Storm, Steel Barrier | boss/dungeon | aoeah (2026-10-01): aoeah PvE (Steel Barrier = survival slot) |
| Element Enhancement, Fire Wall, Glacial Smite, Delayed Explosion | AoE/farming/solo | couga54 (2026-10-03 scrape): couga AoE: Glacial Smite replaces Cold Storm on short fights/farming |
| Element Enhancement, Fire Wall, Glacial Smite, Cold Storm | AoE/farming/solo | couga54 (2026-10-03 scrape): couga AoE alternative 4th slot: Cold Storm |
| Element Enhancement, Fire Wall, Cold Storm, Steel Barrier | AoE/farming/solo | expcarry (2026-09-28/29), aoeah (2026-10-01): expcarry AoE/Solo; aoeah solo |

questlog usage (https://questlog.gg/aion-2/en/classes/sorcerer, read 2026-10-04, page lists 218 skill builds; average level in brackets): stigmas Element Enhancement 78% (15), Delayed Explosion 69% (12), Fire Wall 55% (13), Cold Storm 42% (13), Steel Barrier 38% (11), Divine Burst 27% (8), Glacial Smite 14% (14), Hibernation 12% (15); actives Firestorm 92% (15), Hellfire 92% (15), Wish of Concentration 91% (15), Blaze 89% (15), Bittercold Wind 89% (15), Winter's Shackles 88% (14), Frost Burst 84% (13), Ice Chain 84% (11).

### Spiritmaster (Elementalist in the client)

**couga54 PvE (boss / raid) build** - https://couga54.github.io/aion2-guides/en/elementalist/ - page says 'Updated: Oct 3, 2026, Patch Season 1', fetched 2026-10-04
- Stigmas: Summon: Ancient Spirit 20, Enhance: Spirit's Benediction 20, Flame Blessing 20, Jointstrike: Corrode 20
- Skill ranks (final targets, bonus ranks from Daevanion, rings and arcana included): Elemental Fusion 20, Combustion 20, Summon: Fire Spirit 20, Cold Shock 16, Summon: Water Spirit 16, Jointstrike: Curse 16, Dimensional Control 16, Summon: Earth Spirit 16, Rapid Scattershot 16, Defiance 16
- Specialty picks (rank tier: option): Elemental Fusion: 8 Extra damage after 3s on hit, 8 +10 all Element Boost on hit, 16 25% chance to regain Four Elements; Combustion: 8 Deals up to 12% more damage when less targets are hit, 12 +20% Skill Speed, 16 Adds [Ashy Call] Chain Skill; Summon: Fire Spirit: 8 +20% Fire Spirit Critical Hit damage, 8 10% chance to activate skill when Fire Spirit lands attack, 16 +20% Fire Spirit Stats; Cold Shock: 8 +50% Multi-Hit on hit, 12 +2% Attack on landing [Earth Tremor] (Up to 5 stacks); Summon: Water Spirit: 8 +10% Water Spirit Attack, 16 +20% Water Spirit Stats; Jointstrike: Curse: 8 +2s Curse duration, 8 Changes to mobile skill; Dimensional Control: 8 Extra damage after 3s on hit, 8 +50% Multi-Hit chance on hit; Summon: Earth Spirit: 8 +20% PvE Damage Tolerance and +10 PvP Damage Tolerance to Earth Spirit, 8 10% chance to activate skill when Earth Spirit lands attack; Rapid Scattershot: 12 Multi-Hit on hit, 16 -1s all skill cooldowns on hit; Defiance: 8 Restores 20% HP on using [Defiance], 16 +50% PvE Damage Tolerance and +25% PvP Damage Tolerance for Tenacity duration

| Stigma set (4 slots) | Content | Sources |
|---|---|---|
| Summon: Ancient Spirit, Enhance: Spirit's Benediction, Flame Blessing, Jointstrike: Corrode | boss/dungeon | couga54 (page dated 2026-10-03), expcarry (2026-09-28/29), aoeah (2026-10-01): same four in the three guides |
| Enhance: Spirit's Benediction, Summon: Ancient Spirit, Jointstrike: Corrode, Jointstrike: Destructive Attack | boss/dungeon | questlog usage (2026-10-04): questlog top-4 by usage: Benediction 78%, Ancient Spirit 75%, Corrode 70%, then Flame Blessing 39% / Destructive Attack 37% (4th slot read as Destructive Attack, the engine's own pick) |
| Command: Proxy, Enhance: Spirit's Benediction, Jointstrike: Corrode, Flame Blessing | boss/dungeon | gegebase (undated): gegebase: S tier Command: Proxy, Spirit's Benediction, Corrode; A tier Flame Blessing / Cursed Cloud |
| Summon: Ancient Spirit, Enhance: Spirit's Benediction, Flame Blessing, Jointstrike: Corrode | AoE/farming/solo | couga54 (2026-10-03 scrape): couga AoE (Benediction variant) |
| Summon: Ancient Spirit, Seize Magic, Flame Blessing, Jointstrike: Corrode | AoE/farming/solo | couga54 (2026-10-03 scrape): couga AoE (Seize Magic variant) |
| Summon: Ancient Spirit, Enhance: Spirit's Benediction, Cursed Cloud, Jointstrike: Corrode | AoE/farming/solo | expcarry (2026-09-28/29): expcarry AoE/Solo (Corrode or Siphon last) |

questlog usage (https://questlog.gg/aion-2/en/classes/elementalist, read 2026-10-04, page lists 138 skill builds; average level in brackets): stigmas Enhance: Spirit's Benediction 78% (13), Summon: Ancient Spirit 75% (14), Jointstrike: Corrode 70% (13), Flame Blessing 39% (16), Jointstrike: Destructive Attack 37% (13), Siphon 22% (14), Command: Proxy 12% (15), Seize Magic 10% (15); actives Combustion 92% (15), Summon: Fire Spirit 91% (14), Jointstrike: Curse 91% (13), Dimensional Control 91% (13), Elemental Fusion 90% (15), Summon: Water Spirit 89% (12), Summon: Earth Spirit 89% (11), Rapid Scattershot 66% (11).

### Cleric

**couga54 PvE (boss / raid) build** - https://couga54.github.io/aion2-guides/en/cleric/ - page says 'Updated: Oct 3, 2026, Patch Season 1', fetched 2026-10-04
- Stigmas: Earth Punishment 20, Light of Protection 20, Prayer of Amplification 10, Noble Aura 10
- Skill ranks (final targets, bonus ranks from Daevanion, rings and arcana included): Condemnation 20, Divine Aura 20, Bolt 20, Judgment Thunder 16, Lightning Strike Scattershot 16, Healing Light 16, Radiant Recovery 16, Earth's Retribution 16, Debilitating Mark 12, Chain of Torment 14, Light of Regeneration 16, Defiance 12
- Specialty picks (rank tier: option): Condemnation: 8 Up to +12% damage when less targets hit, 12 Resets cooldown on landing a Critical Hit; Divine Aura: 12 +3s [Divine Aura] duration, 16 -10s cooldown; Bolt: 8 +30% Skill Speed, 12 Up to +20% damage when less targets hit, 16 Critical Hit on hit; Judgment Thunder: 8 Deals up to 12% more damage when less targets are hit, 16 Activates [Divine Punishment] 1 extra time; Lightning Strike Scattershot: 12 Multi-Hit on hit, 16 -1s all skill cooldowns on hit; Healing Light: 8 +2 consecutive uses, 12 +2% HP restored; Radiant Recovery: 16 +5% HP restored; Earth's Retribution: 8 +20% [Discharge] Chain Skill trigger chance, 12 -7s [Bolt] cooldown on landing [Discharge]; Debilitating Mark: 8 -15% target Defense for duration of Damage over Time, 12 +10% PvE Damage Boost reduction and +5% PvP Damage Boost reduction; Chain of Torment: 8 +3s Damage over Time, 12 +10% PvE Damage Tolerance reduction; Light of Regeneration: 8 +5% Defense while healing, 16 +5% PvE Damage Tolerance during healing; Defiance: 8 Restores 10% HP on using [Defiance], 12 +2s Tenacity duration

| Stigma set (4 slots) | Content | Sources |
|---|---|---|
| Earth Punishment, Light of Protection, Prayer of Amplification, Noble Aura | boss/dungeon | couga54 (page dated 2026-10-03), questlog usage (2026-10-04), aoeah (2026-10-01): questlog: Light of Protection 38%, Earth Punishment 29%, Prayer of Amplification 24%, Noble Aura 23% |
| Earth Punishment, Absolution, Prayer of Amplification, Noble Aura | boss/dungeon | couga54 (2026-10-03 scrape): couga: with a Chanter in the party Absolution replaces Light of Protection (the two buffs do not stack) |
| Benevolence, Absolution, Summon Resurrection, Yustiel's Power | boss/dungeon | expcarry (2026-09-28/29), gegebase (undated): ROLE build (healer): expcarry Boss Healer (4th slot 'Yustiel's Power, Light of Protection or an offensive option'); gegebase S-tier Absolution/Benevolence. Healing is not modelled |
| Salvation, Yustiel's Power, Light of Protection, Benevolence | boss/dungeon | Inven KR (Aug-Sep 2026): ROLE build (Sanctuary cooldown healer): Inven 28996 (KR, 2026-09-14) trimmed to Global's 4 slots by the role file; healing/shields are not modelled |
| Earth Punishment, Light of Protection, Prayer of Amplification, Noble Aura | AoE/farming/solo | couga54 (2026-10-03 scrape): couga AoE |
| Earth Punishment, Noble Aura, Prayer of Amplification, Power Burst | AoE/farming/solo | expcarry (2026-09-28/29): expcarry Solo/AoE farming |
| Earth Punishment, Noble Aura, Light of Protection, Yustiel's Power | AoE/farming/solo | aoeah (2026-10-01): aoeah solo (Ustil's Power = Yustiel's Power) |

questlog usage (https://questlog.gg/aion-2/en/classes/cleric, read 2026-10-04, page lists 358 skill builds; average level in brackets): stigmas Light of Protection 38% (13), Earth Punishment 29% (13), Prayer of Amplification 24% (13), Noble Aura 23% (14), Absolution 18% (13), Summon Resurrection 18% (12), Benevolence 16% (13), Yustiel's Power 14% (12); actives Judgment Thunder 93% (11), Light of Regeneration 92% (11), Chain of Torment 91% (11), Radiant Recovery 91% (11), Bolt 90% (11), Debilitating Mark 89% (11), Healing Light 89% (11), Divine Aura 88% (11).

### Chanter

**couga54 PvE (boss / raid) build** - https://couga54.github.io/aion2-guides/en/chanter/ - page says 'Updated: Oct 3, 2026, Patch Season 1', fetched 2026-10-04
- Stigmas: Undefeated Mantra 20, Power of the Storm 5, Marchutan's Wrath 1, Focused Defense 5
- Skill ranks (final targets, bonus ranks from Daevanion, rings and arcana included): Dark Crush 20, Onslaught 20, Spinning Strike 20, Incandescent Blow 16, Recuperation 12, Defiance 16, Impactful Crush 12, Wave Blow 12, Rushing Smash 12, Tremor Crush 12, Heat Wave Blow 12
- Specialty picks (rank tier: option): Dark Crush: 12 Adds [Piercing Strike] Chain Skill, 16 Removes [Dark Crush] cooldown, 8 Critical Hit on hit; Onslaught: 12 -1s [Spinning Strike] cooldown on hit, 16 Adds [Storm Chain] Chain Skill; Spinning Strike: 8 -5s cooldown, 8 Up to +20% damage when less targets hit, 16 Ignores Block and Evasion and lands as a Critical Hit; Incandescent Blow: 8 Deals up to 12% more damage when less targets are hit, 16 Ignores Block and Evasion and lands as Multi-Hit; Recuperation: 8 +1 consecutive use and Heal over Time can stack up to 2 times, 12 +5% HP restored; Defiance: 12 +2s Tenacity duration, 16 +50% PvE Damage Tolerance and +25% PvP Damage Tolerance for Tenacity duration; Impactful Crush: 8 Changes to mobile skill, 12 +30% Skill Speed; Wave Blow: 8 +6m Range, 12 -15% target's PvE Damage Boost and -7.5% PvP Damage Boost for 10s; Rushing Smash: 8 50% chance to trigger [Heat Wave Blow] on hit, 12 Resets cooldown on defeating an enemy; Tremor Crush: 8 Restores 300 Stamina on hit, 8 +10m [Tremor Crush] range; Heat Wave Blow: 8 Up to +20% damage when more targets hit, 12 Ignores Block and Evasion and lands as Multi-Hit

| Stigma set (4 slots) | Content | Sources |
|---|---|---|
| Undefeated Mantra, Power of the Storm, Marchutan's Wrath, Focused Defense | boss/dungeon | couga54 (page dated 2026-10-03): couga PvE |
| Undefeated Mantra, Power of the Storm, Marchutan's Wrath, Sprint Mantra | boss/dungeon | couga54 (2026-10-03 scrape), questlog usage (2026-10-04): couga alternate (Sprint Mantra for Focused Defense); questlog: UM 76%, Sprint 71%, PotS 54%, Marchutan's 53% |
| Undefeated Mantra, Power of the Storm, Marchutan's Wrath, Obliterate | boss/dungeon | expcarry (2026-09-28/29): expcarry Boss Support DPS |
| Undefeated Mantra, Marchutan's Wrath, Ensnaring Mark, Obliterate | boss/dungeon | aoeah (2026-10-01): aoeah PvE (Enshrouded Mark = Ensnaring Mark; Power of the Storm only 'at 15+ for endgame') |
| Undefeated Mantra, Healing Touch, Impeding Authority, Barrier Spell | boss/dungeon | expcarry (2026-09-28/29), gegebase (undated): ROLE build (defensive support): expcarry Defensive Support; gegebase support-first lists Undefeated Mantra, Healing Touch, Barrier Spell. Heals/shields are not modelled |
| Undefeated Mantra, Power of the Storm, Marchutan's Wrath, Obliterate | AoE/farming/solo | couga54 (2026-10-03 scrape): couga AoE |
| Undefeated Mantra, Sprint Mantra, Marchutan's Wrath, Guardian Blessing | AoE/farming/solo | expcarry (2026-09-28/29), aoeah (2026-10-01): expcarry AoE/Solo; aoeah solo (Spirit Mantra = Sprint Mantra) |

questlog usage (https://questlog.gg/aion-2/en/classes/chanter, read 2026-10-04, page lists 292 skill builds; average level in brackets): stigmas Undefeated Mantra 76% (16), Sprint Mantra 71% (14), Power of the Storm 54% (15), Marchutan's Wrath 53% (12), Guardian Blessing 20% (15), Focused Defense 19% (13), Healing Touch 12% (14), Fracturing Blow 10% (12); actives Dark Crush 91% (16), Incandescent Blow 89% (14), Rushing Smash 89% (14), Impactful Crush 88% (13), Recuperation 88% (15), Spinning Strike 88% (15), Tremor Crush 79% (13), Heat Wave Blow 78% (13).

