# Playstyles vs. real game content (client tables, 2026-10-04)

Source: private export at `<private export root>\out\AION2\Content\Data\Table\`, the per-map `...\Data\Map\**\MapData.json` spawn lists, and `<private export root>\spawn-research\boss-schedules.json` (read-only, stays outside this repo). This note holds only derived counts and small samples; nothing was copied in bulk. Every number was computed by script over the decoded JSON.

Goal: ground the choice of playstyles (the target count and duration behind each scenario) in content that actually exists. Vocabulary follows `CONTEXT.md`: a playstyle is what the user picks, a scenario is the engine fight model behind it.

Housekeeping: `decode-audit.json` now shows 2,390 files decoded and 0 failures. The "not decoded" list in `client_tables_recon_2026-10-04.md` (`NpcData`, `Skill`, `StatCorrectionNumber`, `GlobalSetting`, ...) is stale; all of them read fine. `Skill` even carries `NeedCoolTime` and `NeedCostMp` (Winter's Shackles: 45 s, 200 MP, range 2000 uu = our 20 m).

## 0. Findings in one screen

1. **No NPC HP or defense exists in the client.** `NpcData` (13,493 rows, 80 fields) has level, sub-type, grade, enrage timer and stagger window, but no HP. Boss HP cannot be grounded from this export; durations must come from enrage timers, run limits and the achievement time brackets below.
2. **Boss fights have a hard shape:** 384 named (Hero) NPCs carry an enrage timer, 377 of them at 300 s. The enrage buff ("Frenzy", `GlobalSetting.boss_berserk_buff_id`) gives +200% Damage Boost and +100% move/cast/combat speed. 1,020 of 1,356 Hero NPCs also have a 5 s stagger window (a few 8 s, 10 s). Our `boss_180` fits under the 5 min cap; the stagger window is not modelled (`simulator.py` line 460: `needs_stagger` skills are never cast, 1-4 per class, 4 for the Sorcerer).
3. **The AoE target cap really is 4.** 98% of the 2,464 multi-target player skill variants cap at 4 targets (36 variants cap at 5, 17 at 6, 1 at 12); median AoE radius 4 m, 75th percentile 5.9 m, max 12 m. So `n_targets = 4` saturates every AoE; more targets add nothing.
4. **Real pulls are smaller than our scenarios assume.** Static spawn geometry puts 1.4-1.9 mobs inside a 4-6 m AoE in the open world and in Expedition elite trash, and 2.2-3.7 only in horde content (Ascension Trial, advanced Sealed Dungeons, event waves). Details in section 4.
5. **The game splits damage stats by target type** (540 stats: 12 `PvE*`, 4 `BossNpc*`, 2 `Abyss*` for NPCs in the Abyss, 40 `PvP*`), and gear Surpass explicitly gives dungeon gear PvE bonuses and Abyss gear PvP bonuses. 27% of Daevanion stat nodes (1,152 of 4,224) are PvP-only. The engine says "PvP is not modeled", so none of that is valued.
6. **Some content applies fixed modifiers to the player.** Subjugation: -20% Damage Boost, +25% cooldown time, -30% max HP/MP, -30% move speed, +20% heal reduction. Ascension Trial: +30% Damage Boost ("Wrath"). These change the DPS optimum and are not in any scenario.
7. **Season 1 (live) is a ranked-content season:** 2026-09-30 to 2026-12-16 ships Nightmare (7 bosses), Transcendence (Deus Research Base, Shattered Arkanis), Ascension Trial (weekly alternation of two trials), Abyss, Arena 1v1 and 5v5, plus Battlefield 10v10. Subjugation arrives in Live season 2.
8. **Most content opens at level 45** (Abyss, Arena, Nightmare, Ascension Trial, Sanctuary raids, Transcendence, Expedition tiers 1-5, Rift PvP, world level scale). Mob level is not capped by the player cap: Season-1 endgame mobs are level 45-85.

## 1. Data primitives the scenarios can lean on

| Primitive | Where | What it says |
|---|---|---|
| Monster classes | `NpcData` | 8,277 monsters: Normal 5,499, Elite 1,421, Hero 1,356 (all `bNamed`), Legend 1. Level mode is 45 (1,155 monsters); levels run 1-100. |
| Enrage | `NpcData.bUseBossBerserk`, `BossBerserkInvokeTime` | 384 Hero NPCs: 300 s (377), 480 s (4), 600 s (2), 210 s (1). Checked per map: Expedition Normal/Hard and Transcendence maps each have exactly one enraging boss (the final one); Exploration (Easy) maps none; each Raid map one (480-600 s). Ascension Trial, Subjugation, Seal, field events and world/field bosses have none (they use run limits instead). |
| Stagger | `NpcData.NpcGroggyType`, `GroggyTime` | 1,020 of 1,356 Hero NPCs, plus 19 Elites. Window 5 s (1,017 NPCs), 8 s (1, Ultimate Berk Lv 70), 10 s (2, both Eternal Ludra). World/field bosses have none. |
| AoE cap and radius | `Skill` -> `SkillEffectFilter` | `TargetCountMax` 4 for 98% of multi-target player skill variants; radius median 400 uu (4 m). The tooltip text "up to N enemies" used by `build_gamedata.py` agrees. |
| Stat buckets | `StatCorrectionNumber` | `PvEAmplifyDamage`, `BossNpcAmplifyDamage`, `AbyssAmplifyDamage` (Abyss PvE), `PvPAmplifyDamage` and the matching Attack/Defense/Accuracy/Tolerance stats. Engine `pve_dmg_pct` and `boss_dmg_pct` map onto the first two. Percent stats are stored x100 (verified: Wrath 3000 renders as +30%). |
| Level gates | `ContentsUnlock`, `ContentsNavigatorLevel` | 45 for most endgame modes; Daily Dungeon 30; Expedition ladder Krao Cave 22, Urugugu 30, Fire Temple 37, Draupnir 45; tier 6 and onboarding at 50; Growth Dungeon 99. |
| Level scaling | `NpcData.LevelScaleType` | Fixed levels in Expedition, Raid, Ascension Trial, Subjugation, Abyss. Scaled to the player in open world, Seal, Quest, Growth, Daily, field events. |
| Season windows | `SeasonSchedule`, `SeasonContents` | `Season_Main_Live` S1 2026-09-30 to 2026-12-16, S2 to 2027-03-10, S3 to 2027-06-02, S4 to 2027-08-25. |
| Ticket cadence | `ContentsTicket` | Daily recharge 16:00, weekly recharge Wednesday 16:00 (timezone unverified). |
| Dungeon limits | `Dungeon.ProcessStateHoldingTime`, `DeathLimit` | Table in section 2. |
| Spawn lists | `MapData.SpawnInfoList` | 78,344 spawner records in 774 maps. Mostly one NPC and one position per spawner, so a spawner is one mob. Static points only: no respawn timers, no live alive-count. |

## 2. PvE content that exists (counts and fight shape)

`Dungeon` has 733 rows: InstanceLayer 220 (world-event layers: strongholds, event variants, quest layers), Seal 162, Quest 103, FieldEvent 84, Party 55, Awaken 38, Matching 23 (18 Subjugation + 5 arena), Ascension 14 (quest-line dreams), AbyssArtifact 12, Growth 6, Guild 4, Raid 4, Abyss 3, Daily 3, PersonalAgit 1, BossChallenge 1. The table below keeps only what matters for a fight model.

| Content (in-game name) | Maps / rows | Players | Limits | Targets in a run | Enrage / stagger | Level |
|---|---|---|---|---|---|---|
| Nightmare (Boss Challenge) | 26 bosses x 10 levels = 260 stages, one shared map | solo (UI string) | none besides enrage; clear time is ranked per class | 1 Hero boss per stage (14 Common, 8 Rare, 4 Legend) | 300 s / 5 s stagger on all 26 | boss Lv 45 (x4), 55, 57, 63, 65, 70, 77, 85; recommended battle power 1,000 (Tier 1 Lv 1) to 4,950 (Legend Tier 4 Lv 10) |
| Expedition (Party Dungeon) | 55 maps in 16 families (35 Exploration/Conquest maps, 20 Transcendence) | 1-5 (some 2-5, Easy of Deus/Arkanis 2-4) | 3,600 s | 3-5 named bosses; trash spawns per map: median 119 (Easy), 180 (Normal), 182 (Hard); elites dominate from Normal up | final boss 300 s (Normal/Hard); Easy none; 5 s stagger | boss Lv per ladder: Krao 22/45/70, Urugugu 30/54/72, Fire Temple 37/63/74, Draupnir 45/45/70, Bakron 54/54/72, Horn Den 63/63/74, Dramata 65/65/74, Cradle 70/70/76, Hall of Illusion 74/74/80, Azure Breath 78/78/82, Citadel 82/82/86 |
| Transcendence (Party Challenge) | 20 maps = 5 families x 4 levels | 5-player (UI); table 1-5 or 2-5 | 1,800 s; progress is scored by killing trash (10-40 points per kill, no boss points) | 3-5 bosses, median 88 trash spawns | final boss 300 s; NPC affixes stack by level (none at Lv 1, three at Lv 4); no PC-side affix | Deus/Arkanis boss Lv 56/60/64/68 (item level gate 1,600/1,900/2,200/2,500), Sunken Temple 68-80 (2,400-3,500), Mirror of Scarlet Desire 78-85 (3,200-4,000), Abyssal Horn Den 80-90 (3,800-4,800) |
| Sanctuary (Raid) | 4 maps, 3 families (Abyssal Forge: Ludra, Corroded Decontamination Facility, Chalice of Muspel x2) | 10 | 7,200 s | 4-5 named bosses plus adds, about 80-410 trash spawns; Ludra has 18 add-wave groups | final boss 480 s (Facility, Muspel) or 600 s (Ludra); stagger 5 s, Ludra 10 s | Lv 75, 80, 85 |
| Ascension Trial (Awaken) | 38 maps = 6 trials x 6-7 levels | solo (UI: weekly solo time trial, rank by repeated play) | 1,080 s at level 1 down to 420 s at level 7; deaths 5 -> 2 | about 85-235 trash positions (up to 126 of them elite) and 1-2 bosses | none | mobs Lv 45 at level 1, +5 per level; player buff "Wrath" +30% Damage Boost |
| Subjugation (Suppression) | 18 maps = 4 families x 3-6 difficulties (Easy to Hell) | table 1-4, UI "5-player party" | 600 s (Easy), 840, 1,020, up to 1,620 s (Hell); deaths 9 -> 4, run fails when exhausted | about 130-230 normal mobs plus 4 named commanders | none | Lv 45 (Easy) to 76 (Hell); fixed debuff pack on every player (section 6) |
| Daily Dungeon | 3 maps | no party size | tickets: 14/week, or 7 stored +1/day | Daeva Bio-Research Base: 10 waves x 20 mobs (Lv 30, scaled); the other two are objective-based (1 elite or 5 normals) | none | unlock Lv 30, sweepable |
| Dimensional Invasion | 3 events x 2 factions (6 base maps, 24 event variants with instance layers) | open world | 600 s, 7 tickets/week | 160-312 normal + 7-36 elite + 1 boss; mobs come in wave steps of about 10-40 | none | Lv 14-20, scaled to the player; one invasion every hour at :30 per faction (`EventSchedule`, 24 slots/day) |
| Defend Shugo Merchants | 6 maps | open world | 300 s | about 290 normal + 7-25 elite, 15 wave steps | none | Lv 20, scaled |
| Sealed Dungeon | 160 plain + 2 advanced | solo | advanced only: 900 s | plain median 16 mobs (10th to 90th percentile 6-40, max 94); advanced 94 mobs + 3 bosses | none | plain Lv 10-45, scaled; advanced Lv 45 |
| Stronghold (Garrison) | 26 maps (20 territories, 6 camps) | any | none | territory about 70 normal + 1 hero; camp about 118 normal + 1.7 elite + 1 hero | none | scaled |
| Cluster of Growth | 6 maps | any | 7 h/week time ticket per map | 480 normal mobs per map | none | Lv 45 scaled; unlock level 99, so not relevant at cap 45 |
| Quest instances | 103 maps | solo | none | mean 9 normal + 0.5 boss | none | scaled |
| Shugo Festival mini-games | 18 festival entries (jump, racing, masquerade, ...) | any | 150-300 s | not DPS content | none | none |

Designed clear times (achievement thresholds, parsed from the English strings, so they are what the designers expect good players to hit):

| Content | Brackets |
|---|---|
| Nightmare | "Defeat Nightmare Boss within 1 / 2 / 3 minutes"; all 26 bosses also have "Level 10 within 1 minute" |
| Expedition Conquest Normal and Hard | whole-dungeon clears within 5 / 7 / 10 / 15 / 20 minutes; "defeat all monsters" within 10 minutes |
| Transcendence | 7 / 10 / 15 minutes (limit 30) |
| Sanctuary raids | 20 / 30 / 40 minutes (limit 120) |

What this means for fight modelling:

- **Boss:** a solo Nightmare kill is designed for 60-180 s and must finish before 300 s. An Expedition or Transcendence run is 5-20 minutes of mostly trash with 3-5 bosses, so a single boss is about 1-2 minutes. Raids are 20-40 minutes with a 480-600 s final boss. Stagger is a 5 s window on 75% of named bosses. World and field bosses are the exception: no enrage, no stagger.
- **Horde:** the timed solo modes are hordes plus a boss. Ascension Trial is about 85-235 mobs and a boss in 7-18 minutes, Subjugation about 130-230 mobs in 10-27 minutes, Invasion 160-312 mobs in 10 minutes. That is roughly 2-4 s of budget per mob, so individual packs die in 5-15 s and the rotation is judged over many consecutive packs rather than one long fight.
- **Trash and leveling:** the open world and Expedition elite trash are small pulls (section 4), killed in a few seconds each.
- **Weekly and daily caps:** Nightmare 14 tickets (+2/day), Invasion 7 (+1/day), Expedition Conquest 14 (+2/day) and Exploration 7/week, Transcendence 4 (+2/day), Subjugation 3/week, Ascension Trial 3/week, Raid 4/week, Daily Dungeon 14/week, Abyss 25,200 s (7 h) per week, Growth 7 h/week per map, Rift 3,600 s. Duty Quests are 44 zone groups of simple daily quests (no fight model of their own).

### 2.1 World bosses and field bosses

`PeriodSpawn` has 22 rules: 12 field-boss rules (all in the Abyss maps Lower and Middle Reshanta) and 10 rift-portal object rules. From `boss-schedules.json` joined to `NpcData`:

| Boss (map) | Rule | Level, grade | Enrage / stagger |
|---|---|---|---|
| Watcher Kaira (Lower Reshanta) | cycle rule, anchor 01:00, raw Cycle=180 (unit unverified) | Lv 65 Hero, grade 2 | none |
| Guardian Lord Nahma (Lower; 3 spawners) | Friday and Sunday 21:00 | Lv 65 Hero, grade 6 | none |
| Executor Tamasa / Argo / Kaira (Lower) | Monday, Thursday, Saturday 21:30 | Lv 65 Hero, grade 2 | none |
| Enraged Guardian Lord Nahma (Middle; 2 spawners) | Friday and Sunday 21:00 | Lv 80 Hero, grade 6 | none |
| Executioner Dramos / Turncoat Ducal / Ravager Marakha (Middle) | Monday, Thursday, Saturday 21:30 | Lv 80 Hero, grade 2 | none |

That is 10 distinct bosses in 2 maps. They are open-field, contested, and shared with enemy-faction players, so they behave like very long single-target fights with no enrage. Unscheduled named field bosses are few: Verteron and Altgard have 24 distinct named bosses each (20 at Lv 45), Eltnen and Morheim 12 each (all Lv 80); none have an enrage or stagger. Artifact cores in the Abyss ("Dimensional Core", Lv 65/80, grade 5) are siege targets, not DPS checks.

## 3. Abyss and PvP content

### 3.1 Formats

| Mode | Source | Size | Length | Lives / respawn | Notes |
|---|---|---|---|---|---|
| Arena 1v1 (Arena of Solitude) | `Matching` 1, `MatchingContents` 11, 22 | 1v1 | 600 s | 3 lives, 5 s | two duel maps (Fire Temple Arena, Impetusium Arena), 50/50; seasonal ranking per class |
| Arena 5v5 (Arena of Cooperation) | `Matching` 2, contents 33, 44 | 5v5 | 600 s | 1 life, 5 s | same two maps |
| Battlefield | `Matching` 3 and 4, contents 55, 66, 77 | 10v10, party of 1 or 5 | 600 s | no life limit (Life 0), 10 s respawn | three maps: payload ("Car"), capture the flag, domination; open daily 11:00-14:00 and 19:00-21:00 (server time, tz unverified); UI: "equal conditions" |
| Abyss (Reshanta Lower/B/Middle/Upper) | `Dungeon` type Abyss, 4 maps | open PvPvE | 25,200 s (7 h) of time ticket per week | n/a | UI: "you can attack players of the opposing faction" |
| Artifact War | `AbyssArtifact` 6 artifacts, `AbyssArtifactEvent` 2 | faction vs faction | schedule Mon/Thu/Sat 21:00 (Lower) | n/a | occupying 1/2/3 artifacts gives +2.5/5/7.5% Abyss point gain only, no damage change; 12 "Abyss Corridor" artifact dungeons of 33 normal mobs each |
| Abyss Rift Zone | `AbyssRiftPhase` 8 phases, in map 80 | two camps, entry waits for members | phase timers 5 s and 60 s | n/a | kill 12, 4, 6, 10, 8 invader Heroes (all Lv 65), 60 s hold, then four named Lv 65 commanders; camp points scoreboard |
| Spacetime Rift | `RiftData` 16 portals (12 usable at Lv 45+), 10 portal-spawn rules in `PeriodSpawn` (raw Cycle=180, unit unverified) | open world in the enemy continent | portal life 600 s; stay limited by a 3,600 s time ticket (default; recharge items add 10 or 30 min) | n/a | Verteron to Altgard and Eltnen to Morheim; combat (PvP) mode switch cooldown 4,200 s, level-gap protection 5, PvP activation Lv 45 (`GlobalSetting`); guards of enemy towns also attack |
| Airspace battle | `Airspace` 5 subzones, `AirspaceBattle` 1 | Light faction | 600 s ready + 600 s battle, Wednesdays | n/a | applies a marker abnormal to participants; no damage modifier found |
| Abyss field bosses | section 2.1 | contested | no enrage | n/a | Lv 65 and Lv 80, shared with the other faction |

Abyss zone populations (spawn points, Normal / Elite / Hero): Lower Reshanta 1,579 / 132 / 16 (Lv 45-65), Middle 2,330 / 271 / 8 (Lv 46-80), Upper 1,104 / 212 / 0 (Lv 40-70), B 964 / 48 / 5 (Lv 46-80). The arena and battlefield maps contain almost no mobs (2-6 objective NPCs); flight is blocked inside the arena. In every format the opponent is a player, so the engine needs a PvP stat bucket and a PvP target, not just a different target count.

### 3.2 Strongholds and occupation

"Stronghold" in the in-game navigator is PvE: 26 `Garrison` maps (20 territories of about 70 normal mobs and one hero, 6 camps of about 118 normal mobs). The faction-versus-faction "occupation" content is the Artifact War above, which grants only an Abyss point bonus. Neither adds a damage modifier.

### 3.3 PvP damage modifiers that exist

| Source | What it does |
|---|---|
| Stat buckets | 40 `PvP*` stats: PvP Attack, Defense, Accuracy, Critical, Critical Resist, Evasion, Block, Block Penetration, Penetration, Damage Boost, Damage Tolerance, plus per-weapon PvP Damage Boost. Mirrored by 12 `PvE*` and 4 `BossNpc*` stats. |
| Season tier rewards | Abnormals 20100 (Abyss Tier), 20101 (Arena of Solitude grade), 20102 (Arena of Cooperation grade), granted through `SeasonRankingReward`. Each gives PvP Damage Boost, PvP Damage Tolerance and Abyss PvE Damage Boost, equal in size, +1% at the lowest grade to +5% at the highest (20 steps: 1.0, 1.2, 1.5, 1.8, 2.0, then +0.2 per step). Not a zone buff. |
| Gear Surpass | `ItemSurpass`, 53 groups, 4 guaranteed steps for real gear. Tier (dungeon) gear: weapon +0.6/1.2/1.8/2.4% PvE Damage Boost, accessory +0.3% to +1.2%, armor +0.3% to +1.2% PvE Damage Tolerance. Abyss gear: weapon +2.5/5.0/7.5/10% PvP Damage Boost, accessory +0.5% to +2%, armor +0.5% to +2% PvP Damage Tolerance. So Surpass is a PvE-versus-PvP gear choice, not a content mode. |
| Daevanion | 1,152 of 4,224 stat nodes (27%) across the 45 boards are PvP stats (PvP Attack, Critical, Accuracy 216 each; Defense, Evasion, Critical Resist 144 each; Damage Boost and Tolerance 36 each). No PvE-named nodes. The engine already tags these with `is_pvp_only`. |
| Class passives | 26 skill-level groups across all classes carry PvP Damage Boost or Tolerance; for example a Sorcerer passive (Passive006) gives +1% to +20% PvP Damage Boost across ranks 2-40, or +1.5% to +30% in its alternate variant. Our engine drops these. |
| Other | Arena wings carry PvP Damage Tolerance (Warrior Wings: +1% owned effect). Power Shards (`SealStone`, 6 tiers, consumed by skill use) add +5/10/15% Damage Boost plus flat damage; the Abyssal shard adds +10% PvP Penetration Rate. |

## 4. How big are the pulls? (spawn geometry)

Method: for every monster spawn point (first NPC of each spawner, Normal and Elite), count other points within R of it. An AoE centred on a random mob hits `min(1 + neighbours, 4)` targets; the 4-6 m columns use the measured AoE radius (median 4 m, 75th percentile 5.9 m). The 10 m and 15 m columns approximate the group that converges once a pull starts (aggro spread). Static points only: no respawn timing, and wave content reuses positions.

| Content | Mobs sampled | Targets per AoE, R = 4 m | R = 6 m | P(3+ in a 6 m AoE) | Pull group at 10 m / 15 m (cap 4) |
|---|---|---|---|---|---|
| Open world Lv 10-45 (Verteron + Altgard) | 17,400 | 1.4 | 1.6 | 0.11 | 2.0 / 2.7 |
| Open world Lv 46-50 (Eltnen + Morheim) | 7,500 | 1.6 | 1.85 | 0.23 | 2.2 / 2.7 |
| Abyss Lower Reshanta Lv 45-50 | 1,700 | 1.4 | 1.8 | 0.18 | n/a |
| Expedition Easy (Exploration) | 1,600 | 1.45 | 1.7 | 0.15 | n/a |
| Expedition Normal/Hard (elite trash) | 2,100 | 1.6 | 1.9 | 0.25 | 2.5 / 3.2 |
| Transcendence | 2,200 | 1.5 | 1.7 | 0.16 | 2.5 / 3.4 |
| Subjugation Easy | 650 | 1.6 | 2.0 | 0.32 | 2.75 / 3.1 |
| Ascension Trial level 1 | 740 | 2.2 | 3.25 | 0.77 | n/a (dense hordes) |
| Raid | 1,070 | 2.7 | 3.2 | 0.79 | n/a (33% of points coincide) |
| Sealed Dungeon (plain) | 2,800 | 1.4 | 1.7 | 0.18 | n/a |
| Sealed Dungeon (advanced) | 180 | 3.2 | 3.7 | 0.93 | n/a |
| Cluster of Growth | 2,900 | 1.3 | 1.5 | 0.04 | 2.3 / 3.8 |
| Dimensional Invasion, Defend Shugo Merchants | n/a | positions reused by waves (57-67% coincide), so geometry overstates | | | wave steps of 10-40 mobs reach the player together, so treat as 4+ |

Field totals (spawn points, Normal / Elite / Hero): Verteron 9,234 / 80 / 24 (mobs Lv 1-51, 99% of them Lv 10-50), Altgard 11,612 / 67 / 24 (90% Lv 10-50), Eltnen 4,590 / 0 / 12 (Lv 46-50 mobs, Lv 80 named), Morheim 2,964 / 0 / 12, starter zones Poeta 221 and Ishalgen 243 (all Lv 1-9). Elites are under 1% of open-world mobs; they live in dungeons (Expedition Normal has a median of 87 elite spawners per map, range 42-193) and in the Abyss. Named (Hero) field bosses number 72 across the four main maps.

Reading: ordinary pulls are 1.4-1.9 mobs inside an AoE and about 2-3 mobs once the group converges. Packs of 4 are the norm only in the timed horde modes (Ascension Trial, Seal advanced, event waves). Share of open-world mobs that stand alone within 8 m: 39-52% (Lv 10-45); pairs 30-41%; triples 8-21%; four or more 2-13% (single-link clusters at 8 m, per level band and map).

## 5. What our four playstyles stand for today

Engine facts (read only): `PLAYSTYLES` is `app/aion2c/engine/build_optimizer.py` lines 45-53; the scenario table is `app/aion2c/models.py` lines 384-388 (`Scenario(key, name, duration_s, n_targets, boss)`); `burst_15` is defined inline in `PLAYSTYLES`. The simulator reads only `duration_s`, `n_targets` (capped by each skill's `aoe_targets`, which comes from the tooltip "up to N enemies") and `boss` (selects the boss damage and crit factors). It starts with everything ready at t = 0 and has no enrage, no stagger window, no PvP and no target HP.

| Playstyle (scenario) | Parameters | Real content it matches | Fit | Missing |
|---|---|---|---|---|
| Boss DPS (`boss_180`) | 1 target, 180 s, boss | Nightmare (solo, designed clear 60-180 s, enrage 300 s); final boss of Expedition and Transcendence (enrage 300 s); Raid final boss (480-600 s, 10 players) | Good. 180 s sits between the 1-3 min achievement brackets and the 300 s hard cap. | Stagger windows (5 s; `needs_stagger` skills are never cast, 4 for the Sorcerer); enrage as a cap; a 60 s time-attack variant; adds; party and raid buffs. World bosses differ (no enrage, no stagger). |
| AoE farming (`aoe_pack`) | 4 targets, 30 s, non-boss | Timed hordes only: Ascension Trial, advanced Sealed Dungeons, Invasion and Defence waves, the 10 x 20 Daily Dungeon waves | The target count equals the game's AoE cap, so it is the saturated best case, not what ordinary farming looks like (1.4-1.9 per AoE). The 30 s is a guess; hordes keep arriving for 300-600 s. | Content modifiers (Subjugation debuffs, Wrath); `AbyssAmplifyDamage` for Abyss mob farming. |
| Leveling (`level_pull`) | 3 targets, 15 s, non-boss | Open-world questing, Sealed Dungeons, quest instances; also the nearest match for Expedition elite trash | 3 is the top of the observed range: 1.4-1.9 targets per AoE and 2.0-2.7 per converged pull in the open world; elite trash 1.6-1.9 and 2.5-3.2. | Mob HP is unknown, so 15 s cannot be checked; level-scaled mobs. |
| Burst opener (`burst_15`) | 1 target, 15 s, boss, all cooldowns ready | No PvE content. Closest: the 5 s stagger window, and the first seconds of a PvP duel (Arena 1v1 has 3 lives, Arena 5v5 one life). | Weak as labelled: `boss=True` applies PvE boss bonuses, which is wrong for the PvP use where burst actually decides fights. | PvP (stat bucket and target); the stagger window. |

Gaps that matter more than any single number:

1. **PvP does not exist in the engine** while 40 stats, 27% of Daevanion stat nodes, all Abyss-tier gear Surpass, season tier rewards and 26 class skill groups are PvP-only. Of the season-ranked modes, Abyss, Arena 1v1 and Arena 5v5 are PvP (Battlefield runs its own season track); Nightmare, Transcendence, Ascension Trial and Subjugation are PvE.
2. **Stagger** is part of 75% of boss fights and gates 1-4 skills per class, yet no scenario turns it on.
3. **Environment modifiers** (Subjugation, Ascension Trial, enrage) are fixed numbers in the data and change which skills win (a +25% cooldown time debuff favours sustained filler over cooldown burst).
4. **Run shape:** timed solo modes mix a horde and a boss in one run; the engine scores one or the other.
5. **Target side:** NPC HP and defense are not in the client, so no scenario can use a kill-time model; durations come from enrage timers, run limits and clear-time brackets.

## 6. Recommended scenario definitions

Priority 1 are the changes the data clearly supports; priority 2 are cheap additions; priority 3 are optional.

| Playstyle (proposed key) | Targets | Duration | Boss flag | Mode | Real content | Grounding | Priority |
|---|---|---|---|---|---|---|---|
| Boss DPS (`boss`, keep) | 1 | 180 s | yes | PvE | Nightmare, final bosses of Expedition, Transcendence, Raid | enrage 300 s, brackets 1-3 min (Nightmare) | keep |
| Boss time attack (`boss_60`) | 1 | 60 s | yes | PvE | Nightmare level 10 "within 1 minute" (26 of 26 bosses) | designed target, not an assumption | 2 |
| Horde (`aoe`, keep key, rename to Horde clear) | 4 | 60 s (30 s is acceptable) | no | PvE | Ascension Trial, advanced Sealed Dungeons, Invasion, Defence, Daily Dungeon waves | AoE cap 4 (98% of multi-target skills); wave steps of 10-40 mobs; 20 per Daily wave | 1 |
| Dungeon trash (`trash`) | 3 | 20 s | no | PvE | Expedition Normal/Hard and Transcendence trash, Strongholds | 1.6-1.9 per AoE, 2.5-3.4 per converged pull (section 4) | 2 |
| Leveling (`leveling`, change 3 to 2) | 2 | 15 s | no | PvE | open world Lv 10-50, Sealed Dungeons, quest instances | 1.4-1.9 per AoE, 2.0-2.7 per pull; 39-52% of mobs stand alone | 2 |
| Stagger window (`stagger`, replaces PvE use of burst) | 1 | 5 s, `staggered` on | yes | PvE | the 5 s guard-break window on 1,020 named bosses | `NpcData.GroggyTime`; cadence unknown | 2 |
| PvP duel (`pvp_duel`) | 1 | 30-60 s (needs calibration) | no | PvP | Arena 1v1 (600 s match, 3 lives), Rift and Abyss duels | match rules are in the data; engagement length is not | 1 |
| PvP group (`pvp_group`) | 4 (5v5 has 5 enemies, 10v10 has 10; the cap is 4) | 30 s (needs calibration) | no | PvP | Arena 5v5 (one life), Battlefield 10v10, Abyss and Rift fights | AoE cap 4; match rules | 1 |
| Burst opener (`burst`, keep as PvP opener) | 1 | 15 s | no | PvP | first 15 s of a duel or skirmish | none beyond the rules above | 3 |
| Subjugation variant (`subjugation`) | 3 | 60 s | no | PvE | Subjugation (from Live season 2) | 2.0-3.1 per pull; modifiers below | 3 |

Modifiers the data says to apply per content (percent stats are stored x100):

| Content | Modifier | Source |
|---|---|---|
| Subjugation (all 18 maps) | Damage Boost -20%, Damage Tolerance -20%, cooldown time +25%, max HP and MP -30%, move speed -30%, healing received -20% (`HpHealGetReduce` +20%), plus a poison DoT on max HP | `DungeonAbnormalGroup` Dracoinc_* sets |
| Ascension Trial (all levels) | +30% Damage Boost ("Wrath", abnormal 19005202) | `AbnormalGroup_Awaken_*` |
| Boss enrage | +200% Damage Boost, +100% move, cast and combat speed, accuracy +9,999, at 300 s (or 480/600 s) | `boss_berserk_buff_id` 10000008 |
| Transcendence levels 2-4 | NPC affixes stack by level (Arkanis: Poison Blood, Elevation, Tolerance; Deus: Balance, Wrath, Judgment); nothing on the player side | `SeasonPickupAffixList` |
| Season tier rewards | +1% to +5% PvP Damage Boost, PvP Damage Tolerance and Abyss PvE Damage Boost per grade | abnormals 20100-20102 |
| Daily Dungeon waves | wave buff and debuff picks (12 `DungeonBuff` rows: attack up/down, defense up/down, speed, crit up, steal life or mana) | `DungeonBuff` |

Target-type stat bucket per scenario: PvE scenarios use `PvEAmplifyDamage` (plus `BossNpcAmplifyDamage` when the boss flag is set, plus `AbyssAmplifyDamage` for NPCs in the Abyss); PvP scenarios use `PvP*` stats and a target with PvP Tolerance and Defense (default: mirror the user's own tier until measured).

## 7. Open questions and how to close them

- **Boss HP and defense:** absent from the client. The in-game Combat Analysis tool (`DamageAnalyzer`, unlocked at level 0) auto-records on 538 named bosses, so Jon reading Nightmare Tier 1 clear times and damage totals from that window could back-solve HP without any automation.
- **Stagger cadence:** the guard gauge size is server-side; measure the time between stagger windows on one Nightmare boss.
- **What counts as "boss" for `BossNpc*` stats:** not in the tables (a `TriggerSkillCheck_BossMonster` marker abnormal gates 470 skill effects); Hero sub-type is the likely match but unverified.
- **Season 1 contents are inferred** from `SeasonContents` rows tagged `Season_Main_Live`; the shipped global list could differ.
- **Server timezone** for the 16:00 reset, the 21:00/21:30 boss slots and the Battlefield windows is unverified; the Cycle=180 unit in `PeriodSpawn` is unverified.
- **Pull sizes** use static spawn points; aggro and leash radius are not in the tables, hence the 10 m and 15 m bounds.
- **PvP engagement length** and how a player's tier-reward grade is assigned are not in the data.
- **Level gap:** Season-1 endgame mobs are Lv 45-85 against a level-45 character; the damage formula's level-difference term is not known, and Rift PvP has a level-gap protection of 5.

