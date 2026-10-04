# Aion 2 Ranger - research notes (2026-10-03)

Files in this folder follow the Sorcerer schemas (see `research/data_contract.md`). Icons: `assets/icons/ranger/`.
All files were run through the app's own `aion2c.data.build_gamedata.assemble(..., class_key="ranger")` (in memory, nothing written to the app): it builds 58 skills, 19 statuses, 33 rules, 21 links, 5 boards with no validation errors. A smoke `simulate()` of the 4 community rotations also ran (DPS numbers are meaningless until the unknowns below are filled; do not quote them).

## Coverage
| File | Content |
|---|---|
| `skills.json` | 58 entries: 51 with a client skill_id (12 active, 10 passive, 13 stigma, 10 chain/hidden damage, 3 chain/hidden utility, weapon equip, Dodge, Drill Dart proc 14050007) + 7 id-less Metaroad entries (Basic Attack, Deadshot Lv.1 / Lv.2 / Max, Crimson Flames, Explosion, Root). 1650 per-rank rows (41 skills x 40 ranks, 10 single-rank). Same fields as Sorcerer plus a new `tags` field. |
| icons | 51 PNG (256x256 RGBA, from aion2.app `/db-item-icons/`), `index.json` with 51 keys, same structure and slug rule as Sorcerer. Duplicate names get the id suffix (`drill-dart` = 14050000 / `drill-dart-14050007`, `explosive-arrow` = 14230000 / `explosive-arrow-14360000`). Shared client icons: Snipe = Equip Ranger Weapon (ICON_RA_SKILL_001), both Explosive Arrows (023), both Drill Darts (005). Id-less entries have no icon (Deadshot tiers -> deadshot, Crimson Flames -> griffon-arrow, Explosion -> explosion-trap via `icon_prefix_aliases`; Basic Attack and Root none). |
| `daevanion.json` | 5 boards, 537 nodes (5 start, 444 stat, 88 skill), 802 points. Nezekan 89 nodes / 134 pts (lvl 12), Zikel 89 / 134 (20), Vaizel 89 / 134 (30), Triniel 117 / 168 (40), Azphel 153 / 232 (45). Boards are NOT shared with the Sorcerer file: node ids and the 22 skill nodes per board differ (Azphel has none), but the grid layout, node types, rarities, costs and stat totals are identical, and adjacency order matches the Sorcerer file for every cell. |
| `mechanics.json` | 19 statuses, 33 rules, 3 charge tiers (Deadshot), 6 rules with a chain_next, resource model, 4 damage procs, 13 passive stat rows, 19 stat effects, skill tags, element overrides. |
| `chains.json` | 21 links (6 chain, 4 proc, 3 charge, 8 condition), 8 unlinked, Arrow Scattershot as stagger-only. |
| `community_rotations.json` | 4 rotations (3 boss, 1 AoE) from couga54 (2026-10-03), GEGEBASE (post Sep 4), Inven (Sep 6). |
| `roadmap.json` | 40 items: shared progression copied from the Sorcerer roadmap + 19 Ranger skill unlocks + one stigma entry. |

## Main mechanics modeled
- **Precision** (Marking Shot): 10 s, +300 Critical Hit, Deadshot +35% damage, Suppressing Arrow stun chance. The central buff window.
- **Deadshot** charge skill, 3 levels, Lv.1 = 1x, Max = 3x (ratio and flat both exactly 3.00x at rank 1 and rank 40). Lv.2 = 2x is an interpolation, charge times are unknown.
- **Snipe basic chain**: Snipe -> Rapid Fire -> Spiral Arrow (-> Tempest Arrow with Snipe spec 16), restoring 120 / 120 / 150 / 180 MP. MP is the resource; Drill Dart restores 100 MP on crit.
- **Slow / Root synergy**: Snare Shot Slow 5 s, Shackling Arrow Root 3 s (chain from Snare Shot spec 12). Burst Arrow requires Slow or Root, Explosive Arrow (stigma) +20%, Rooting Eye proc.
- **DoTs**: Bleed (Drill Dart, 6 s, 1 s ticks, flat tick 43 to 952) and Crimson Flames (Griffon Arrow, 10 s, 1 s ticks, flat tick 482 to 2056), both stored as flat ticks in the notes because the Status model only holds ATK-ratio ticks.
- **Buff cooldowns**: Vaizel's Authority (+20% Attack), Bow of Blessing (Crit +200, Accuracy +100), Supporting Fire orb (25% x 43.2% ATK per 0.5 s), Gale (+7% Combat Speed and PvE Damage Boost), durations per rank (10 s at rank 1, 20 s at rank 20, 30 s at rank 40 for Vaizel and Bow).
- **Procs** (passives): Concentrated Fire (needs a DoT target), Rooting Eye, Melee Fire, Hunter's Soul (on crit), 50/50/25/50% chance, 1 s ICD.
- **Defense / sustain / CC** modeled as statuses and tagged: Defiance (Tenacity), Mother Nature's Breath, Afterimage, Stealth, Vigilant Eye, Revitalization Contract; stun, airborne, blind, seal, root, slow.

## Tags (skills.json `tags`, mirrored in mechanics.json `skill_tags` as `manual` / `role:<x>`)
`manual` = pressed by hand outside the two macro hotbar lines (24 skills): Marking Shot, Deadshot, the three buff stigmas, all CC and defensive skills, KR/TW utilities. In the couga54/Whelps build the macro lines are Griffon Arrow > Snare Shot > Burst Arrow and Gale Arrow > Drill Dart > Tempest Shot, Snipe is held on LMB, so those are NOT tagged manual. Utility tags: `defense`, `cc`, `mobility`, `sustain`, `heal`. Tag choice is mine, based on those guides: low confidence for borderline skills.

## Confidence
- **High**: skill ids, names, unlock levels, per-rank damage/cooldown/cost (client dump, 2026-09-18; rank-1 flat equals Metaroad flat for every skill with both), durations and chances taken from tokens. Unlock levels also match aion2db.gg (zh-TW) for all 22 core skills.
- **Medium**: Daevanion adjacency (inferred rule), chain order for Rapid Fire / Spiral Arrow / Tempest Arrow, Slow/Root OR condition, tag assignment.
- **Low / unknown**: charge times, DoT ATK ratios, cast / animation times (client `casting_time` is 0 everywhere), HP-absorb values hidden as "—" on Metaroad, Attack-ratio per rank (only rank 1 exists), MP pool and regen.

## Gaps and risks
1. **Wind element**: most Ranger damage is Wind, but `Element` in `models.py` has no `wind` and `build_gamedata` only regexes Fire/Water/Earth. I set `element_overrides` to `"wind"` for 28 skills (Literal is not enforced at runtime, the build and sim accept it). Statuses with `elements: []` apply to all.
2. **Status model limits**: precision, bow, Vaizel and Hunter's Resolve effects are stat buffs (Crit +300, Attack +20%, Crit Damage +20%), not damage multipliers; the real numbers sit in `stat_effects` (extension key, loader ignores it). `dmg_mult` of 1.07 (Gale) and 1.2 (Vaizel) are estimated approximations.
3. **Burst Arrow `requires`** can name only `slow`; Root also qualifies (`requires_any` extension has the OR).
4. **Explosive Arrow has two ids**: stigma 14360000 (flat 1426 at rank 1) and hidden 14230000 (flat 116). Metaroad has one card (120% ATK + 116) that matches the hidden id, so the stigma's ATK ratio is null. The hidden one is probably a pre-redesign skill (patch May 20); left unlinked.
5. **Id-less links** (Explosion, Root, Crimson Flames parents) come from Metaroad list order and are `estimated`. Root's owner (Ensnaring Trap) is the weakest.
6. **KR/TW-only skills** (aion2hub, client v110 2026-09-09, 12 entries not in the global core list): Rapid Fire, Spiral Arrow, Tempest Arrow, Shackling Arrow, Guerilla Strike, Eye of Rapid Burst, Afterimage, Hunters Resolve_active, Arrow of Space-time, Dust Arrow, Impact Kick, Lightning Arrow. The app constant `KR_ONLY_IDS` in `build_gamedata.py` only lists Sorcerer ids, so these are NOT region-gated yet. Caveat: GEGEBASE and the Whelps guide use Rapid Fire / Spiral Arrow / Shackling Arrow on global-era content, so the "KR only" list is probably a bar-visibility artifact.
7. **Stigma max rank**: the dump says 40 for all 13 stigmas (Sorcerer notes said 25). Global cap is 20 (core and stigma), 4 slots (levels 22 / 27 / 32 / 37); the pipeline's `rank_caps` already handles that.
8. **Armory ids**: the official `/api/gameinfo/classes` returns Ranger as class id 4 and the Sorcerer armory sample proves armory skill ids equal aion2.app ids (15xxxxxx). I had no Ranger armory sample, so 14xxxxxx ids are not verified against a real Ranger character. aion2db.gg calls the class "Marksman" and claims that is NCSOFT's English name; the official endpoint says Ranger.
9. **Daevanion completion buffs**: names only, no values. Metaroad's board stat totals differ from mine for Zikel (MP 550 vs 500; one node is named "Max HP" but gives Penetration +10) and Azphel (PvP Defense 480 vs 720, Evasion 48 vs 72: Metaroad omits the hybrid nodes). The sums in `sum_of_stat_nodes` are the node effects as the aion2t data states them (identical to the Sorcerer file).
10. **Odd client values kept as is**: Stealth cooldown 120 s at rank 1 falling 3 s per rank to 3 s at rank 40 (63 s at 20); Eye of Rapid Burst "range reduced by 142100m" token is broken; Wind Vigor Max Stamina token 600 at rank 40 looks like a unit quirk.
11. `Equip Ranger Weapon` (14000000): the site shows a null English name; the name is ours, mirroring "Equip Sorcerer Weapon". No KR name, no description.
12. Community macro details (hit counts: Snipe 16-18, Deadshot 24-28, Tempest Shot 250+/min) are in `research/tmp/classes.json` and not modeled. Anim lock and charge timing need in-app calibration.
13. Scratch work: a stray working folder `D:\Aion2\research\tmp\rg\` was created before I moved to the scratchpad; the delete was blocked by permissions. It holds only fetched HTML and parse scripts and can be removed.

## Sources (all fetched 2026-10-03, requests spaced 0.45 s or more; robots allow /db)
| Source | Used for | Version / date |
|---|---|---|
| https://aion2.app/db/skills/<id> and /ko/db/skills/<id> (51 ids from sitemap-db.xml) | ids, names EN/KR, levels, per-rank tokens, specs, icons | "Game client 18.09.2026" |
| https://metaroad.gg/aion2/database/skills/ranger | ATK ratio, flat, hits, stagger, descriptions, tags, ranges, 7 id-less entries | "55 skills, 493 variants", read 2026-10-03 |
| https://aion2t.com/daevanion?job=4 | boards, nodes, adjacency source data | s2.0 data |
| https://metaroad.gg/aion2/database/daevanion/ranger | cross-check of board totals, skill grants | 2026-10-03 |
| https://couga54.github.io/aion2-guides/en/ranger/ | build, macro lines, stigma order, global rules (cap 20, 4 stigmas, no Ariel) | updated 2026-10-03, Season 1 |
| https://gegebase.com/games/aion2/ranger_pve_guide | rotation, chain names, 2026 patch history (Precision 10 s, Deadshot 35%) | post Sep 9 |
| https://aion2hub.com/classes/ranger | core list (36) vs KR/TW 12 | Global Launch Scale Test 2026-09-19, KR/TW v110 2026-09-09 |
| https://aion2db.gg/class/ranger/ | unlock-level cross-check (zh-TW names) | undated |
| https://aion2codex.wiki/classes/ranger | qualitative only | 2026-10-02 |
| https://www.inven.co.kr/board/aion2/6450/19498 (+ 13828 fetched, not used) | KR cancel / macro notes, opener | 2026-09-06 |
| https://aion2.plaync.com/en-us/api/gameinfo/classes?lang=en-US&region=eu | class id 4 = Ranger | live |
| research/tmp/classes.json, research/armory_samples | prior Inven summary, armory skill-id proof | project files |

## 2026-10-03 update (data fixes)
- Bleed and Crimson Flames tick ratio were null, so the sim dealt zero DoT damage. Now DERIVED estimates (45.0% and 85.5% ATK; client flat tick is a constant fraction of the hit flat at every rank). Low confidence, rank-independent. Boss DPS at default stats rose roughly 20% and Griffon Arrow became the top stigma pick.
- Still missing: Deadshot charge times, Bow of Blessing spec "Attack from Critical Hit", Explosive Arrow stigma ATK ratio, Concentrated Fire / Rooting Eye / Melee Fire not wired (engine cannot gate a proc on a target status).
