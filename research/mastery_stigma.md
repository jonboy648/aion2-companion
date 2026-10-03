# Aion 2 Sorcerer - Mastery tab and Stigma research

Collected 2026-10-03 (Global launch 2026-10-05). Facts are from web pages summarized by a fetch model; page text was not read verbatim. V = verified by 2+ sources, S = single source, U = unverified/conflict.

## 1. Mastery tab (Skills window, K)

KEY FINDING: "Mastery" is NOT a separate bonus system. It is the name of the tab that lists the class's standard Active and Passive skills (the other tab is Stigma). "Mastery points" = the skill points spent there. There is no per-skill "mastery level" bonus table beyond skill level itself. (V: allthings.how, expcarry, aion2guide.org)

| Fact | Value | Conf | Source |
|---|---|---|---|
| Tab contents | Active (action bar) + Passive; detail pane shows level, damage range, cast time, cooldown, range, weapon condition | V | allthings.how/?p=215236 (2026-09-24) |
| Direct point cap | skill level 10 | V | allthings.how, aion2guide.org (2026-09-30) |
| Skill point cost 1->10 | levels 2-4: 1 each (3), 5-7: 2 each (6), 8-10: 4 each (12) = 21 total per skill | S (metabot via search snippet; consistent with expcarry) | https://metabot.gg/en/aion-2/guides/class-builds-guide ; https://aion2guide.org/systems/aion-2-skill-points-guide/ |
| Cumulative 1->8 | 13 points; 1->10 = 21 | V (expcarry "Global test data" 13/21 matches 3+6+4=13) | https://expcarry.com/aion-2-sorcerer-guide (Sept 2026, Scale Test 1.0.21.0) |
| Sorcerer first package | Flame Arrow, Hellfire, Firestorm, Blaze, Bittercold Wind, Wish of Concentration, Defiance each to base 8 = 91 points (7 x 13) | S | expcarry |
| Where points come from | level-ups; one source says Main Story Quests + Sealed Dungeons. NCSOFT has not published the global curve | U | aion2guide.org |
| Character-level gates per rank | exist ("Reach Character Lv. 12" style) - table not found | U | allthings.how |
| Beyond 10 | Daevanion board skill nodes up to +4 (blue glyph = active, green = passive); Arcana cards and gear Soul Bindings give "rolled" bonus levels (ranges not published) | V for sources, U for numbers | allthings.how/aion-2-how-to-level-up-skills-past-level-10/ (2026-09-24) |
| Ceiling above 10 | sources say 12, 16 or 20; no official number. Data contract uses 20 (10 + 4 + Arcana/Soul Binding) | U | aion2guide.org |
| Battlegrounds | Mastery skills forced to 20, stigma to 25 | S | https://aion2hub.com/updates/aion-2-update-2026-07-01 (KR) |

### Specialties (Active skills)
- Five selectable specialties per active; loadout equips max 3 at once (ggwtb search snippet, S).
- Slot/option breakpoints: first slot at skill level 8, second 12, third 16, "further slots" at 20 (allthings.how, V). skycoach.gg (via aion2guide.org, 2026-09-29, S/U): lvl 8 = first three specialties + first slot; 12 = fourth specialty + second slot; 16 = fifth specialty; 20 = third slot. The two readings differ on which level adds a specialty option vs a slot; treat as unresolved.
- expcarry advice: "At level 8, choose one useful option rather than copying the full three-option target." Tooltip-order notation e.g. 2/4/5.
- No numeric values per specialty level found beyond per-skill text already in sorcerer_skills.json.

### Sorcerer specialty targets (expcarry, S)
| Skill | Target lvl | Options (tooltip order #) | Purpose |
|---|---|---|---|
| Hellfire | 20 | #1, #4, #3 | speed; Multi-Hit; cast while moving |
| Firestorm | 20 | #2, #4 | speed; Hellfire cooldown reduction |
| Blaze | 20 | #3, #4, #5 | delayed damage, cooldown support |
| Wish of Concentration | 20 | #2, #4, #5 | Attack, cooldown reduction |

## 2. Stigma

| Fact | Value | Conf | Source |
|---|---|---|---|
| Stigma skills per class | 13 | V | allthings.how, metabot, aion2hub |
| Equip slots Global | 4 | V | allthings.how; metabot |
| Unlock | character level 22 + quests; slots at 22 / 27 / 32 / 37 (1/2/3/4) | V (metabot 2026-10-01, dbaion2.ru, aionbuilds, game8) | https://metabot.gg/en/aion-2/guides/stigma-guide ; https://dbaion2.ru/en/guides/stigmy/ |
| KR slots | up to 6; 6th slot at level 50. Patch 2026-03-25 raised 4 to 5. Unlock levels for KR slots 5 and 6 other than "6th at 50": not found | S/U | https://aion2hub.com/updates/aion-2-update-2026-03-25 ; search snippet for Inven article 23305 |
| A conflicting snippet "level 20: 2 slots, 30: 3, 40: 4, 50: 5" | looks like Aion 1 / stale; ignore | U | search result only |
| Currency | Stigma Shards (not skill points); Shards sold in Abyss Trade Shop for Abyss Points | S | allthings.how |
| Stigma points income | 1 at lvl 23, 8 at 30, 20 at 40, 30 at 45; metabot: 1/level for 23-39, 2/level for 40-45 | S x2, roughly consistent (1+... verify) | dbaion2.ru ; metabot |
| Cap Global | 20 (properties at +5/+10/+15/+20) | V | allthings.how, dbaion2.ru |
| Cap KR | 25 (5th trait). Above 20 needs Advanced/Superior Stigma Shards: 1 per level-up from char level 45/46, plus 1 to take a stigma to 20 (refunded on reset) | V for 25; shard wording differs (Advanced vs Superior, 45 vs 46) | https://aion2hub.com/updates/aion-2-update-2026-07-01 ; metabot |
| Reset | free (KR, 2026-07-01) | S | aion2hub |
| Stigma sets / link bonuses | none found in any source | negative result | metabot explicitly lists none |
| Skill-level cap vs data | sorcerer_skills.json says stigma max_skill_level 25 = KR value; Global cap 20 | | data_contract.md |

### Cost per level (points), levels 1-20
| Level range | Cost each | Range total | Cumulative |
|---|---|---|---|
| 1-5 | 1 | 5 | 5 |
| 6-10 | 2 | 10 | 15 |
| 11-15 | 4 | 20 | 35 |
| 16-20 | 8 | 40 | 75 |
Sources: metabot (2026-10-01) and dbaion2.ru agree on 75 total. Levels 21-25: cost is Advanced Stigma Shards, 1 per level-up as earned; per-level price not found (U).

### Recommended Sorcerer stigmas
| Skill | Reason | Source |
|---|---|---|
| Element Enhancement | Slot 1 primary buff; +20% Fire/Water Attack 10s; at lvl 10 amplifies Robe of Flame 1.5x; covers both kit halves | expcarry; mmo-codex; metabot |
| Fire Wall | DoT via Embers, stronger vs moving targets; good early and AoE | all three |
| Cold Storm | Frostbite scaling; at lvl 10 30% Root chance | mmo-codex |
| Delayed Explosion | Fire damage after 4s, target takes +15% damage meanwhile (dump) ; AoE at lvl 15; burst windows. (Inven KR says 20s CD/+25%: conflict) | expcarry; mmo-codex |
| Glacial Smite | 90s CD, 1,477 (+250% ATK) on up to 4 targets, largest single-hit coefficient (metabot only) | metabot |
| Divine Burst | Boss Stagger-gauge break | metabot |
| Steel Barrier / Arctic Armor | Survival: Steel Barrier 16-20% max HP shield +10% tolerance; Arctic Armor +20% PvE tolerance, damage split HP/MP | mmo-codex; expcarry |
| Soul Freeze, Hibernation | Arena/control | expcarry |

Loadouts (expcarry): Boss DPS = Element Enhancement, Delayed Explosion, Fire Wall, Cold Storm. AoE/solo = EE, Fire Wall, Cold Storm, Steel Barrier. Defensive PvE = EE, Delayed Explosion, Steel Barrier, Arctic Armor. Arena = EE, Steel Barrier, Soul Freeze, Hibernation. Abyss = EE, Fire Wall, Cold Storm, Steel Barrier. Early (lvl 22) per mmo-codex: spread shards over EE, Divine Burst, Fire Wall, Glacial Smite. Note mmo-codex stigma list does not match one result that said Hellfire/Firestorm/Blaze/Bittercold Wind are stigmas (they are core skills in our data; that snippet is U).

## Not reachable / gaps
- namu.wiki, Inven body, Reddit, skycoach, ggwtb (403), aion2.app/metaroad stigma pages: not fetched; aion2hub sorcerer page had no content.
- No per-level numeric table for mastery bonuses exists because mastery is not a bonus system; per-skill-rank numbers are in sorcerer_skills.json per_level.
- Arcana/Soul Binding roll ranges, KR slot levels for slots 5/6 (beyond 6th at 50), level 21-25 stigma costs: unknown.

## URLs (all retrieved 2026-10-03)
allthings.how/?p=215236 (page dated 2026-09-24); allthings.how/aion-2-how-to-level-up-skills-past-level-10/ (2026-09-24); aion2guide.org/systems/aion-2-skill-points-guide/ (2026-09-30); metabot.gg/en/aion-2/guides/stigma-guide (2026-10-01); metabot.gg/en/aion-2/guides/class-builds-guide; dbaion2.ru/en/guides/stigmy/; expcarry.com/aion-2-sorcerer-guide; mmo-codex.com/articles/aion-2-sorcerer-guide/; aion2hub.com/updates/aion-2-update-2026-07-01; aion2hub.com/updates/aion-2-update-2026-03-25.
