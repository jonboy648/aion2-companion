# Aion 2 Sorcerer: Builds and DPS Research

Compiled 2026-10-03 (Global launch is reported as Oct 5, 2026 per couga54 guide). Method: WebSearch + WebFetch page summaries only.
No in-game testing, no raw logs. Fetched pages were summarized by a small model, so exact figures should be re-checked against the page before a calculator hard-codes them.

## Evidence tags

- [DATA] = a source states it was measured/tested (named testers, or numbers read from game text/wiki tables).
- [FIT] = community-fitted model; source itself says NC has not published the formula.
- [OPINION] = guide author preference, no measurement shown.
- [UNVERIFIED-DATE] = I could not confirm the date or patch.
- Patch tags: KR/TW = Korea/Taiwan client (Global may differ). S1 = Season 1 / Lava Heart armor era. "Aug-26" = 2026-08-26 balance patch.

## Source index

| ID | URL | Date (as shown) | Patch/server | Trust |
|----|-----|-----------------|--------------|-------|
| S1 | https://www.mmoherald.com/aion-2/guides/damage-calculation | 2026-09-13 | KR/TW endgame | Best: names testers (kanonxo, Aion Research Lab), labels itself a working model |
| S2 | https://www.mmoherald.com/aion-2/guides/stat-weights | 2026-09-16 | KR/TW | Best: per-class weights, Sorcerer column |
| S3 | https://gameplay.tips/guides/aion-2-how-stats-work-damage-formula-guide.html | 2026-10-02 | KR endgame, S1 start, Lv50 | Good: fuller formula; appears to derive from same community model as S1 |
| S4 | https://aion2.wiki.fextralife.com/Sorcerer | 2026-10-03 | not stated | Skill numbers (wiki table); build text weaker |
| S5 | https://gegebase.com/games/aion2/sorcerer_pve_guide | not shown (cites Aug-26 patch) | post Aug-26 | Opinion + patch cites |
| S6 | https://couga54.github.io/aion2-guides/en/sorcerer/ | 2026-10-03 | Global S1 | Opinion; has stigma level/effect numbers |
| S7 | https://www.mmoherald.com/aion-2/guides/sorcerer | 2026-09-20 | Taiwan client, early game only | Opinion + some mechanics |
| S8 | https://www.inven.co.kr/board/aion2/6453/66 | "1/15 modified" (fetch summary printed 2025, which predates the Nov 2025 KR launch: treat year as UNVERIFIED-DATE, likely 2026) | KR, old | Korean community PvE guide, 309 comments; old |
| S9 | https://gall.dcinside.com/mgallery/board/view/?id=aion2&no=1715644 | 2026-02-28 | KR, old | Only source with cooldown-reduction breakpoint numbers |
| S10 | https://www.inven.co.kr/board/aion2/6453/3222 | 2026-02-03 | KR | Only PvP-specific Sorcerer source found |
| S11 | https://vgamelifev.com/ (Korean mage skill-tree article, URL-encoded slug) | 2025-11-20 | KR launch week | Old, pre-rebalance |
| S12 | https://www.sportskeeda.com/mmo/aion-2-sorcerer-build-macro-rotation-guide-skill-chains-stats | 2026-09-21 | not stated | 403 on fetch; content only from search snippet and from mmo-codex/aoeah-style echoes |
| S13 | https://mmo-codex.com/articles/aion-2-sorcerer-guide/ | date not shown | not stated | Fetched summary matched the Sportskeeda snippet content closely (likely same lineage) |
| S14 | https://www.mmoexp.com/News/aion-2-sorcerer-guide-skills-gear-stats-and-endgame-progression.html | date not shown | not stated | Gear/Daevanion order; opinion |
| S15 | https://aionbuilds.com/en/classes/sorcerer | not shown | not stated | LOW: skill names (Inferno, Boon of Insight, Meteor Strike, Bakarma) do not match any other source. Do not use |
| S16 | https://aion2hub.com/builds/sorcerer | client v110 dated 2026-09-09 | KR/TW | Two builds exist (PvE, PvP), only the summary focus line was readable; no numbers |
| S17 | https://vortexgaming.io/en/postdetail/717212 | none | none | Combat Power (CP) system only; penetration CP bug |

Sources I could not read: questlog.gg Sorcerer page and Jan-14 patch notes (empty fetch), aion2maps (403), Sportskeeda (403), Maxroll (no Aion 2 Sorcerer page surfaced in search), YouTube (not reached). Reddit and namu.wiki were not surfaced by search; gap.

## Skill name mapping (KR to EN, because sources disagree)

Same skills appear under several English names. Used here: Flame Arrow = Flame Spear/Harpoon family in some Korean translations (S11 and S10 list "Flame Spear" separately from "Flame Arrow", S4 has only Flame Arrow), Hellfire = 지옥의 화염 (Hell's Flame), Bittercold Wind = 혹한의 바람 (Harsh/Frigid/Chilling Wind), Delayed Explosion = 지연 폭발 (Ground Explosion in S9 machine translation), Element Enhancement = 원소강화 (Elemental Reinforcement), Wish of Concentration = 집중의 기원 (Concentrated Origin), Winter's Shackles = 겨울의 속박 (Winter Binding), Fire Wall = 불의 장벽, Cold Storm = 혹한의 폭풍 (also "Cold Explosion" in S9 translation: uncertain).

## 1. Damage formula and stat scaling

### Formula [FIT], S1 (2026-09-13) and S3 (2026-10-02), KR/TW

S1 itself states: "NC hasn't published Aion 2's damage formula. This is the community's working model." S3 is more detailed and likely the same lineage.

```
attack = ((pure_attack * weapon_damage_boost * multi_hit * power_shard) + attack_bonus)
         * attack_increase
         + PvE_attack + boss_attack + species_attack (+ front/back attack, per S3)

damage = (attack * skill_coefficient [+ skill_additional_damage, per S3]
          - (defense - penetration) * 0.1)
         * (damage_boost + PvE_boost + boss_boost + species_boost)      # additive bucket
         * critical_damage * smite * perfect * front_back_boost          # separate multiplicative buckets
         * skill_specialty_enhancement (S3 only)
```

- PvP: the 0.1 defense factor becomes 0.01 (S1, S3).
- S3 names Smite "Double" (Double Chance). Treat Smite = Double as the same stat (name varies by translation): UNVERIFIED but values match S1 exactly (0.60-0.65 per 1%).
- Caps/constants (S1, S3): crit chance max 80%, reached at a 1,200-point gap of Critical Hit minus target Critical Resist; parry cap 80% at a 1,200 accuracy gap; ~6-7% per 100 accuracy gap; boss Smite resistance -30%; boss crit damage resistance -25%; Endurance = chance to take 50% damage; crit damage base 150% plus crit damage boost minus crit damage tolerance (from a search-result snippet of the MMO Herald damage page, not confirmed in the fetched text; S13 says "minimum 2x", conflict, see section 8).
- Penetration only reduces the 0.1x defense term, so it is a weak stat in PvE [FIT]. In PvP the 0.01 factor makes it weaker still by the same logic (inference, not stated by a source). S16 nonetheless lists Penetration in its PvP burst build focus (opinion).

### Marginal values per stat (S1, "measured on Korean endgame builds with support buffs", tested by kanonxo and Aion Research Lab) [DATA, class-agnostic, KR endgame]

| Stat | Damage gained |
|------|---------------|
| +1% Smite | 0.60-0.65% |
| +1% Front/back boost | 0.57-0.65% (zero for Sorcerer, see below) |
| +1% Weapon damage boost | 0.50-0.55% |
| +1% Crit damage boost | 0.40-0.60% |
| +1% Damage boost | 0.30-0.35% (S3 says 0.35%) |
| +1% Perfect | ~0.10% |
| +10 Attack | ~0.17% |
| +10 Max Attack | ~0.13% (S3: 0.1325%) |
| +10 Attack bonus | ~0.10% |
| Multi-hit | ~0.33% per 1% at 36-40% (S3) |

### Sorcerer-specific weights (S2, 2026-09-16, KR/TW) [DATA/FIT; example line 1,800 attack, 70% crit, 25% Smite]

| Stat | Sorcerer/Spiritmaster gain |
|------|----------------------------|
| +1% Smite | +0.80% |
| +1% Attack increase | +0.76% |
| +1% Combat speed | +0.74% |
| +1% Damage boost | +0.62% |
| +1% Weapon damage | +0.62% |
| +1% Crit damage | +0.51% |
| +1% Crit chance | +0.40% |
| +10 Attack | +0.43% |
| +10 Attack bonus | +0.34% |
| Front/back | not applicable ("Zero damage" on Sorcerer) |

- Break-evens (S2): Crit Damage beats Crit Chance above 56% crit for Sorcerer; 1% Damage boost = 15 Attack; 1% Smite = 1.28x a 1% Damage boost; 1% combat speed = 1.19x a 1% damage boost.
- Value of flat Attack falls with gear: +10 attack = +0.93% fresh Lv45, +0.43% geared, +0.24% Korean endgame (S2). Comparing with S1's 0.17% per 10: the two pages use different baselines (S1: Korean endgame builds with buffs; S2: example 1,800 attack line). The numbers are not directly comparable, which explains the Smite 0.60-0.65 vs 0.80 gap.
- Diminishing returns: S1 gives the Smite example, "once you already Smite half the time, 100 hits deal 150 and the next point adds 0.67%". Percent stats with a 0 base (Smite, front/back) are worth most early; crit damage starts at a 50% base so it is worth less per point (S3).
- Combat speed: S3 calls it "S-tier"; S1 and S3 claim 150-200 ms of ping difference costs a large share of damage (S3: "50-70% damage loss"). Treat the S3 range as an unverified claim (opinion about macro timing, not measured data shown).

### Accuracy and crit targets by raid (S1, KR) [DATA-ish]

| Raid | Accuracy | Critical Hit |
|------|----------|--------------|
| Ludra | ~1,500 | ~1,600 |
| Corroded | ~2,350 | ~2,500 |
| Muspel (Hard) | ~2,800 | ~3,150 |

PvP (S10, Feb 2026, KR, opinion): about 2,500 accuracy excluding weapon/belt; dodge builds reach 2,800+.

### Combat Power (CP) [DATA, S17, undated]
Per point: Attack 1.25, Defense 1.0, Main stat 1.25, Crit 0.25, Accuracy 0.25, Sub stat 0.25, HP/MP 0.05, Penetration 10 (labeled a known bug, expected to drop to 1-1.25), percent stats 100 CP per 1%. CP is a ranking number, not DPS; do not optimize against it.

## 2. Skills: numbers (S4 Fextralife, 2026-10-03, patch not stated) [DATA, wiki table]

| Skill | Effect | CD | Cost |
|-------|--------|----|------|
| Flame Arrow | 62 + 63% Attack, Fire | none | none (restores mana per guides) |
| Ice Chain | 79 + 92.5% Attack, Water, 4 targets | none | 120 MP |
| Firestorm | 114 + 192.5% Attack | 5s | 250 MP |
| Bittercold Wind | 238 + 232.25% Attack, Root 60% | 15s | 150 MP |
| Blaze | 198 + 193.2% Attack, marked targets only | 5s | not listed |
| Frost | 178 + 94% Attack, Frost 50% | 30s | 100 MP |
| Frost Burst | 395 + 155% Attack, 4 targets | 10s | not listed |
| Hellfire | 1,137-3,412 + 339-1,017% Attack by charge level | 45s | 200 MP |
| Defiance | CC break + 5s immunity | 60s | none |

Passives (S4): Fire Mark (fire attacks mark; 20% chance for 32 + 55% extra), Cold Snap (50% chance 43 + 23% extra vs slowed), Grace of Enhancement ("20% PvE Damage Boost and 10% PvP Damage Boost while MP is 25% or more").

Per-skill damage/second is computable from this table for the listed skills. Cast times, animation lengths, the Delayed Explosion and Divine Burst numbers, Fire Wall and Cold Storm tick values, and Robe of Flame numbers are missing from every source I read.

## 3. Rotations and priorities

### Single target / boss (PvE, endgame)
- S5 (post Aug-26) [OPINION]: opener Element Enhancement, Delayed Explosion, Hellfire, Fire Wall, Cold Storm, then the macro. Sustained priority: keep Element Enhancement up, keep Delayed Explosion up, Fire Wall, Cold Storm, Blaze when Fire Mark is ready, Firestorm, Hellfire, basic attack cycle. "Don't spam Blaze blindly, build Fire Mark first."
- S6 (2026-10-03, Global S1) [OPINION]: Element Enhancement, Delayed Explosion, Bittercold Wind, Wish of Concentration, Firestorm then Blaze, Winter's Shackles, Flame Arrow for mana. One macro, Hellfire cast by hand at full charge.
- Macro (search snippet of S12 and S4 echoes, 2026-09-21) [OPINION]: Firestorm, Delayed Explosion, Bittercold Wind, Flame Arrow with 10 ms step delay; 40-50 ms at ping 80-100+, 10 ms below 50 ping.
- Delayed Explosion before Hellfire, so Hellfire lands inside its 4s damage-amplification window (search snippet, exitlag-type guide; not independently confirmed).
- KR community (S8 Inven, "1/15" revision, old): opening Element Enhancement, Bittercold Wind, Delayed Explosion, Hellfire, Wish of Concentration plus left-click plus one-button macro; repeat Bittercold Wind, Delayed Explosion, filler; never full-charge Hellfire; take back position so back-attack crits land. "Normal-attack cancel" is the base mechanic and Flame Explosion is guaranteed every 3 basic attacks (old build; may predate reworks).
- KR (S9, 2026-02-28) [OPINION with a numeric claim]: basic cycle Frost Arrow, Frost Arrow, Burst; opener Barrier, Reinforcement, Ground Explosion, Frigid Wind, Winter Binding, Origin, Winter Binding, Ground Explosion, Frigid Wind, Burst. At 30% cooldown reduction Reinforcement/Barrier share 42s cycles and Frigid Wind/Ground Explosion 14s cycles.
- Mana rule (S7, Taiwan client): "Keep your mana above 50%"; rotation's job is to hold mana above 50%; pause macros if mana dips. See conflict list for the threshold.

### AoE (S5) [OPINION]
Element Enhancement, Fire Wall, Bittercold Wind, Cold Storm, Firestorm, Blaze, basics; Hellfire only if single-target value justifies it. Rotation in S6 for groups: swap Steel Barrier for Delayed Explosion.

### Leveling vs endgame
- Leveling (S8): before Lv16, left/right click basics with Flame/Ice Explosion, use Bittercold Wind and Winter's Shackles in melee range. S4/S12 echo: Flame Arrow (mana), Ice Chain, Firestorm and Blaze, Hellfire from Lv14. S6: skills at 8-10, "+20% MP restored" picks, Skill Speed, Steel Barrier. S7: combat speed over flat damage early because cooldown reduction is near zero.
- Endgame (S6): Hellfire, Firestorm, Bittercold Wind, Blaze, Wish of Concentration to 16+ (20 per S5 and S12 echoes). Combat speed priority "inverts at endgame when cooldown reduction items like Talisra Wings become available" (S7).

### PvP (separate; thin evidence)
- S10 (2026-02-03, KR) [OPINION]: crit-damage build most common, ~2,500 accuracy; Flame Arrow, Frost Chain 16+, Flame Spear, Chilling Wind at 20; Frost Armor 20 critical; Element Reinforcement for damage + accuracy; normal-attack lifesteal for survival. Entry gear: White 5 + Crimson/Ten 5+ + Celestial/Heaven 2.
- S4 build text (Fextralife): PvP leans on Frost control, Hellfire pressure, Arctic Armor, Hibernation stigmas.
- S15's PvP rotation uses skill names found nowhere else: ignored.
- Front/back and penetration math for PvP rests only on the 0.01 defense constant; no PvP-specific stat weights found.

## 4. Skill points, tree, stigmas

| Topic | Claim | Source/date | Tag |
|-------|-------|-------------|-----|
| Hellfire CDR | Flame Spear (or Firestorm, naming differs) Lv12 specialization shortens Hellfire cooldown, "game changer" | S11 (2025-11-20) says Flame Spear Lv12, -1s per hit, 5s total; S4/S12 echo says Firestorm Lv12 | OPINION, naming conflict, patch-old |
| Lv20 skills | Hellfire, Blaze, Firestorm, Bittercold Wind, Wish of Concentration to 20; Flame Arrow, Flame Scattershot, Winter's Shackles to 16 | S5 | OPINION |
| Passive | Robe of Flame "most important passive in current endgame build" (~Lv36 as written) | S5 | OPINION |
| Stigma core | Element Enhancement + Fire Wall at Lv25, third slot Delayed Explosion 20-25 or a survival stigma | S5 | OPINION |
| Stigma Global S1 | Element Enhancement 20, Cold Storm 10, Fire Wall 10, Delayed Explosion 10; Element Enhancement stated as "+20% Fire and Water Attack", Delayed Explosion "+15% damage from you" | S6 | OPINION/likely from game text; unverified |
| KR order | Element Enhancement 20, Delayed Explosion 10, Fire Wall 20, Delayed Explosion 20 | S9 | OPINION |
| Old stigma set | Delayed Explosion 5, Holy Explosion 5, Steel Barrier 5, Frost Storm 5 | S11, S8 | OPINION, old |
| Daevanion boards | Nestaken (combat speed), Gikkel (damage boost), Bai Jie (crit damage), Ariel (PvE boss damage) | S12/S13 echo | OPINION |
| Daevanion order | Yellow (basic stats) first, then blue active skills (Flame Arrow, Blaze, Wish, Firestorm), crit, then green passives | S14 | OPINION |
| God stats | Wisdom > Time > Destruction/Death | S14 | OPINION |
| Arcana/wrist | Prioritize Death and Fantasy, Fantasy especially | S9 | OPINION |

The Aug-26 patch changed Element Enhancement Spec 2 from a Robe of Earth interaction to 1.5x Robe of Flame effect (S5 and search results citing aion2hub.com/updates/aion-2-update-2026-08-26 and aion2t.com/news/40; I did not open the patch pages). Every guide older than Aug 26 (S8, S9, S10, S11) predates this and its Element Enhancement advice may be outdated.

## 5. Stat priorities by source

| Source | Priority | Tag |
|--------|----------|-----|
| S2 (data weights) | Smite > Attack increase > Combat speed > Damage boost = Weapon damage > Crit damage > Crit chance (until 56%+ then crit damage ahead); front/back dead | DATA/FIT |
| S5 | S: Damage Amplification, Crit Damage, Weapon Damage; A: Attack Power, Perfect, Crit Hit; conditional: Accuracy (only if missing), Skill Speed | OPINION; matches S1/S2 broadly except Smite and combat speed are not mentioned |
| S7 | Combat speed, damage bonus, crit damage; multi-hit and front/back dead | OPINION (early) |
| S9 | Mana stone: Crit before Additional Hit; CDR minimum 28.8% (wings, Fantasy items, titles, monolith, Devanion); at 18% vs 28.8% Frigid Wind damage "doubles precisely"; if attack cap not reached, Concentrated Origin beats all skills | OPINION with specific claim; needs verification |
| S6 | Manastones: Attack, Crit, Accuracy | OPINION |
| S14 | Weapon (tome): Damage Increase, Crit, Attack, Combat Speed; accessories: Attack, Damage Increase, Crit, Combat Speed; shoes with Move Speed | OPINION |
| S13 | Wisdom (crit chance; crit damage min 2x) | OPINION; Wisdom as crit-chance stat not confirmed elsewhere |

Reading across: only Smite (Double), attack increase, combat speed, damage boost, weapon damage boost, crit damage are backed by numbers. Penetration is consistently called weak in PvE. Accuracy and crit have hard targets only per raid (section 1).

## 6. Gear, set, accessory, enhancement by stage

Thin. No source gave a verified item-by-item Sorcerer progression.
- Leveling/early: combat speed over flat damage (S7). Cloth gear. Daevanion book costs ~2-3M (PvE) and ~40M (PvP) kina at launch (S7, Taiwan).
- Mid (post Lv45): Krao Cave gold-tier drops then roll attributes (S14); Wings unlock first, enhance gradually; Pets with Attack/Damage/Crit traits; Arcana from Transcendence dungeons (S14).
- Endgame: Season 1 Korean setting is Lv50, "Lava Heart armor era" (S3). CDR items such as Talisra Wings become important (S7). S9: wrist accessories Death/Fantasy.
- PvP gear: White 5, Crimson/Ten 5+, Celestial/Heaven 2 sets (S10).
- S15's "Bakarma Cloth Robe +15" and "Abyss T4": not corroborated; ignored.
- S16 (aion2hub) lists two KR/TW Sorcerer builds (PvE magic DPS and PvP burst) at Lv45, gear score 4,788, client v110 dated 2026-09-09, but the item details were not extracted.

## 7. Buffs and consumables
No Sorcerer-specific consumable data found in any source. Known buff-related items:
- Self: Element Enhancement (S6: +20% Fire/Water attack; S5: 1.5x Robe of Flame effect via Spec 2), Wish of Concentration (second buff, CD tool), Grace of Enhancement (+20% PvE damage boost with MP above threshold), Delayed Explosion (debuff on target, S6: +15% damage from you; S11: boss damage resistance reduction).
- S1's per-stat numbers were measured "with support buffs", so party buffs matter; the Aug-26 patch carried a "party synergy nerf" (title of the aion2hub patch page), details not read.

## 8. Conflicts between sources

1. MP threshold for Grace of Enhancement and related passives: 25% (S4, wiki table) vs 50% (S6, S7) vs "MP full" (S11, launch week). Likely patch drift; S4 is the only one citing game text, S7 the only Taiwan client. Unresolved.
2. Hellfire CDR specialization on Flame Spear Lv12 (S11) vs Firestorm Lv12 (S4/S12 echo). Possibly a translation or rework difference.
3. Smite value: 0.60-0.65% per 1% (S1) vs 0.80% (S2). Different baseline builds, not necessarily a contradiction.
4. Front/back: S1/S3 list it as a top stat; S2 and S7 say 0 for Sorcerer; S5 warns not to copy it. Class-specific, so S2/S5/S7 win for Sorcerer.
5. Crit chance vs crit damage: S5 puts crit damage S-tier and crit hit A-tier (agrees with S2 above 56% crit); S13 says Wisdom/crit chance first.
6. Stigma levels: Delayed Explosion 5 (S11) vs 10 (S6) vs 20-25 (S5, S9). Level caps clearly changed over time.
7. Skill names: Fextralife/S15 names diverge; S15 appears unreliable.
8. Rotation: S5 opens with Element Enhancement, Delayed Explosion, Hellfire; S8/S9 put Bittercold Wind before Delayed Explosion. Patch-dependent (Aug 12: overlapping delayed damage now stacks rather than refreshes, per S5).
9. Crit damage floor: 150% base (formula pages) vs "minimum 2x" (S13).

## 9. Known interactions and bugs
- 2026-08-12: overlapping Delayed Explosion damage stacks instead of refreshing (S5).
- 2026-08-26: fixed Delayed Explosion damage increase not applying to Bittercold Wind, Fire Wall, Cold Storm; fixed Power Shard interaction bugs with the same skills; Element Enhancement Spec 2 changed to 1.5x Robe of Flame (S5 and search results; patch pages not opened).
- Penetration CP bug (S17).
- Fire Mark must exist for Blaze to be usable (S4: marked only). Bossy movement during Hellfire charge cuts DPS (S12 echo).
- Ping/macro delay matters (S1, S3, S12 echo).

## 10. Damage calculator: proposed structure

Inputs
- Character: pure attack (weapon + guard + accessories + lines + stones), attack bonus, attack increase %, weapon damage boost %, multi-hit %, power shard, max attack/weapon range, crit chance and target crit resist, crit damage boost and target tolerance, damage boost + PvE/boss/species %, Smite %, Perfect %, front/back % (0 for Sorcerer), penetration, accuracy and target block/parry, combat speed %, cooldown reduction %, MP pool/regen and Flame Arrow restore.
- Target: defense, crit resist, boss resistances (Smite -30%, crit dmg -25%), PvE vs PvP flag (0.1 vs 0.01).
- Rotation: ordered list with cast time, cooldown, charge level for Hellfire, Fire Mark state, Delayed Explosion window uptime (4s amp), Element Enhancement uptime, MP threshold state.

Formula: use section 1 as written; per skill hit use coefficient and flat from the skill table, multiply by expected crit factor (1 + p_crit*(crit_mult-1)) with p_crit = f(crit - resist) capped 80% and expected Smite factor likewise.

Outputs: per-skill damage and per-cast expectation, DPS over a simulated rotation (single target, 4-target AoE, boss with Smite/crit resist), marginal gain table per stat (compare to S1/S2 as a validation target), break-even points (e.g. crit damage vs crit chance at 56%), and CDR breakpoints.

Validation targets available now: S1 per-stat marginals (0.17% per 10 attack, 0.30-0.35% per 1% damage boost etc.) and S2 Sorcerer weights. If the model reproduces these on the S2 example line (1,800 attack, 70% crit, 25% Smite), the structure is right.

## 11. Missing data needed
1. Cast times and animation/cancel timings per skill, Hellfire charge-level timing and damage per level.
2. Delayed Explosion, Divine Burst, Fire Wall, Cold Storm, Robe of Flame, Element Enhancement actual numbers by level, and the "skill specialty enhancement" bucket values for Sorcerer.
3. Crit chance curve formula (S1 calls it a community fit) and accuracy-to-parry curve beyond cap points.
4. Skill-level scaling tables (coefficients at Lv16/20) and Global-launch values (all data is KR/TW).
5. Pure attack and gear lines for real Lv50 Sorcerer sets, stone/engraving options, wings, Daevanion nodes numbers.
6. Mana economy (Flame Arrow restore, skill costs, regen) and the exact MP threshold.
7. Consumables and party buffs.
8. PvP stat weights and the PvP damage formula checks.
9. Sources I could not read: Questlog, Aion2maps, Sportskeeda, Maxroll, YouTube, Reddit, namu.wiki, Inven PvP/PvE full text beyond summaries.
