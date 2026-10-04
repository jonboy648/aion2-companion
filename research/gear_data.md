# Gear data for "most powerful overall" (2026-10-03)

## Verdict
Good news: a free, unauthenticated, official source for the whole Global item dictionary exists, and it returns base stats, enchant scaling, slot counts, class restriction, acquisition source and arcana set bonuses as JSON. Gaps: success rates and material costs of enchanting, Exceed (breakthrough) scaling, manastone/theostone option pools and odds, rolled random stats of a specific instance (needs a real character with such an item), and drop tables. Also a caveat: the Global dictionary contains items up to item level 102 that may not be obtainable at the Oct 5 launch.

## Data sources
| Source | Use | Notes |
|---|---|---|
| **Official `GET https://aion2.plaync.com/en-us/api/gameconst/item?id=<id>&enchantLevel=<n>&lang=en-US&region=nae`** | Item definition at an enchant level. No characterId, no cookie, plain browser User-Agent; HTTP 200. Found in the official characters JS (`/api/gameconst/item?id=${e}` with `enchantLevel`). Without the `/en-us` path it 302s. | Unknown ids return `{"favorite":false}`. `enchantLevel` above max is clamped. 4 parallel workers at 0.15 s spacing ran 5,272 ids without a single error. |
| Official `GET https://aion2.plaync.com/api/character/equipment/item?id=&enchantLevel=&characterId=&serverId=2103&slotPos=&lang=en-US&region=nae` | Same JSON per equipped instance; requires characterId (400 otherwise). Returns identical data to gameconst for DarthThot's items (Liberator set, verified by diffing field sets). For rolled/socketed instances it should add `magicStoneStat`, `godStoneStat` and the rolled `subStats` (official JS renders them; not verified live). | Use it only for the user's own gear. |
| Item id list | `https://shugo.gg/sitemap-items.xml` (robots allows it): 10,984 ids (KR/TW superset). Saved in D:\Aion2\.firecrawl\sm_items.xml | Id scheme below, so ids can also be enumerated by prefix. |
| shugo.gg `/items/<id>` HTML pages | Server-rendered: stats, random-stat pool, "where to get" with monster/dungeon/quest links (drop tables). | Shows KR/TW values (see discrepancy). Crawlable per robots (only `/api/` disallowed); be gentle. |
| aion2.app/db/items (9,450), metaroad.gg/aion2/database/items (3,555 equippable, 29 slots, manastone odds, skill coefficients), aion2hub database (Global/KR toggle) | Cross-checks and the missing manastone/Monolith/Pantheon data | Not scraped in depth; copying wholesale is a ToS risk. |

## Saved samples and full scan (D:\Aion2\research\gear_samples\)
- `item_weapon_e0/e10/e15.json`, `item_torso_e0/e5.json`, `item_neck_e0.json`, `item_belt_e2.json`: character-endpoint samples for DarthThot's ids at different enchant levels.
- `enchant_scaling.json`: per-level `extra` for 4 items, +0 to +15.
- `sample_top_gear.json`: 9 top-tier items (Ludra's Grimoire, crafted Dragon Lord pieces, Abyssal Bracelet, belt, amulet).
- `sample_arcana.json`: all 30 arcana items with the `set` block.
- `pcdata.json`: gameinfo/pcdata (class and race-gender ids).
- `_scan_equip.json` (8.7 MB): `{id: item json}` for all 5,272 equippable ids in prefixes 110, 115, 210, 215, 250, 310, 311; 3,478 exist in Global. `_scan_misc.json`: same for arcana, manastone/theostone scrolls, potions, materials (641 exist of 846).
Re-run: `D:\Aion2\.firecrawl\scan.py <out.json> <comma prefixes>` (uses the gameconst URL).

## Item id scheme (from the scan)
`AABBCCDDD`-style, first four digits = family:
- 1101 Greatsword (Gladiator), 1102 Longsword (Templar), 1103 Dagger (Assassin), 1104 Bow (Ranger), 1105 Spellbook (Sorcerer), 1106 Orb (Spiritmaster), 1107 Mace (Cleric), 1108 Staff (Chanter); each has `classNames` set. 1150 Guard (off-hand, no class restriction; the sample Sorcerer wears a Guard). Prefix 150 holds level-1 starter weapons.
- 2101 Top, 2102 Legs, 2103 Helm, 2104 Pauldrons, 2105 Gloves, 2106 Shoes, 2107 Cloak; no class or armor-type restriction (`raceName All`, no `classNames`): any class wears any armor. 2152 Belt, 2501-2507 Elyos/Asmodian starter pieces.
- 3101 Necklace, 3102 Earrings, 3103 Ring, 3104 Bracelet, 3110 Amulet.
- 810xxxxxx Arcana (digit 4 = type: 1 Chalice, 2 Parchment, 3 Compass, 4 Bell, 5 Mirror; digit 5 = grade 3 Unique, 4 Epic, 5 Rare, 6 Common; so 5 types x 4 grades x 2 sets... 30 items as scanned), 561/563 manastone and theostone items, 565 Arcana training, 566/631 Amplify stones.
- Within a family the middle digit pair encodes grade tier and the last digits are variants (e.g. 110540035 Liberator = Epic quest set, 110520003 Ludra's Grimoire = Unique).
Grades (JSON `grade`/`gradeName`): Common, Rare, `Legend` shown as "Epic", Unique (highest present). Heroic exists on KR/TW only.

## Field schema (item JSON)
Core: `id, name, grade, gradeName, icon, level` (item level), `levelValue` (= current enchant), `enchantLevel, maxEnchantLevel` (5 Common, 10 Rare/belt/amulet, 15 Epic/Unique; arcana 5), `maxExceedEnchantLevel` (1, 3 or 5 on 678 items), `equipLevel` (character level needed, up to 45), `categoryName, type, raceName, classNames[]`, `magicStoneSlotCount` (manastone sockets, 0-4), `godStoneSlotCount` (theostone socket, 1 on weapons/guards), `subStatCount` (number of random lines rolled), `subStatRandom` (bool), `subSkillCountMax` (Daevanion-style sub-skill slots, 0-5), `sources[]` (Quest, Looted from monsters, Crafting, Reward Chest, Expedition, Sanctuary, Shugo Festival, Substance Morph, Ascension), `tradable, storable, decomposable, soulBindRate, costumes[]`, optional `set{id,name,items[],bonuses[{degree,descriptions[]}]}`, `desc`, `coolTime/duration*`.
- `mainStats[]`: `{id, name, value, minValue?, extra, exceed}`. `value` is the +0 base (weapons also carry `minValue`, a damage range min; the displayed attack range is min to value). `extra` is the bonus added by the current enchant level. `exceed` marks a stat that Exceed raises.
- `subStats[]`: for fixed items the actual extra lines (e.g. Liberator Spellbook: Might 14, MP 49, Block 20). For `subStatRandom: true` items it is the POOL of possible lines with `minValue` to `value` (max) ranges; the item rolls `subStatCount` of them.
- Stat ids seen: WeaponFixingDamage (Attack), WeaponAccuracy, Critical, STR/DEX/INT/CON/AGI/WIS, HPMax, MPMax, ArmorDefense, ArmorEvasion, CriticalResist, Block, CombatSpeed, AdditionalHitRate, AbnormalAccuracy/AbnormalResistance, CriticalAddDamage, BackAttackDamage, FrontAttackDamage, AmplifyAllDamage, AmplifyWeaponDamage, Perfect, DecreaseWeaponDamage, HardHit/HardHitResist, IronWall, DefensePierce, SealStoneAddDamage, PvPAmplifyDamage, deity stats (Justice, Freedom, Illusion, Life, Time, Destruction, Death, Wisdom, Destiny, Space).

## How to compute stats from gear + enchant
Per equipped slot: total(stat) = `mainStats[stat].value + mainStats[stat].extra` (query at the item's real enchantLevel) + sum of its rolled sub lines (+ stone lines). Findings:
1. Only the "primary" main stat scales with enchant: weapon/jewelry Attack (`WeaponFixingDamage`), armor/jewelry Defense and HP. Accuracy and Critical on weapons do not change with enchant (checked 0 to 15).
2. Scaling is linear with small steps. Ludra's Grimoire (Attack 525): extra = 11, 22, 33, 44, 55, 66 then +12 per level from +7: +10 = 114, +15 = 174 (about 33% of base). Breastplate (Defense 756, HP 408): Defense +29 per level to +5, +30 afterwards (+15 = 445); HP +24 per level (+15 = 360). Necklace Attack 158: +5/+6 per level to +86 at +15. Liberator Spellbook (Epic, +10 cap): +44 on 198 at +10. Belt/amulet cap at +10 and stop growing past it (the gameconst call clamps).
3. Not derivable from the endpoint: Exceed/breakthrough tiers (items carry `maxExceedEnchantLevel`, `exceed:true` flags; try `exceedLevel` param on a real exceed item before relying on it), Surpass, Soul Add, Succession; enchant success odds; material/Kinah cost.
4. Character-level totals also need: base class stats by level, Daevanion nodes, titles (`info.title`), arcana (deity stats + set), wings, manastones/theostones, buffs. The official `info.stat.statList` returns the game-computed totals for STR..Space and ItemLevel, which is the ground truth to validate any gear-sum we compute (diff our sum against it on DarthThot).
5. Attack range: displayed weapon attack range is `minValue` to `value` (+ enchant extra applied to both ends is unverified; the sample shows extra 44 at +10 on 178-198).
6. The "ItemLevel" gear score in `info` (707) is a separate number from item `level` (39 on DarthThot's weapon). Do not mix them.

## Data discrepancy to remember (Global vs KR/TW)
Shugo's page for 110540035 Liberator Spellbook shows item level 48, attack 221-245, +15 cap, random Might 27. The official Global endpoint returns level 39, attack 178-198, +10 cap, Might 14. Shugo's DB is the KR/TW dictionary until Global data is published, so for Global use only the official `/en-us/api/gameconst` endpoint (it served `region=nae`). Our own scan returned 3,478 of 5,272 KR ids, i.e. Global has about two thirds.

## What exists in the Global dictionary (scan result)
- Grades: Epic 1,329, Unique 1,139, Rare 614, Common 396 items. Max enchant 15 on 1,136 items (all Unique and Epic gear), 10 on 1,335, 5 on 1,007.
- Equip level: 900 items at 45, 520 at 37, then 35, 30 etc. Item levels run up to 102 (Unique).
- Per slot (Spellbook family 1105): 145 items; armor slots 256 each; accessories 103-107 each; bracelets only 14; amulet 6; belts 3.
- Sets: only the two Arcana sets exist in Global (Primal Vigor: 2pc +60 PvE Attack at HP >= 70%, 4pc +150; Magic Armor: 2pc restore 1,500 MP at MP <= 20% (30 s CD), 4pc +1,000 PvE Defense at MP >= 50%). No armor/weapon set bonuses (Liberator and others are not sets). Arcana: 5 types (Chalice, Parchment, Compass, Bell, Mirror) x Rare/Epic/Unique x 2 sets (30 items scanned; Common variants exist per set data), enchant cap 5, main stat is one deity stat (Chalice of Vigor: Time 20).

## Best-in-slot candidates for a DPS caster (Sorcerer; same logic for other classes)
Ranking basis: item level and grade first, then main attack plus the presence of attack/crit/combat-speed/Smite-type lines in the sub-stat pool, then slot counts. No simulator was run; this is a candidate shortlist, not a proven order. Stat priorities for Sorcerer come from research\sorcerer_builds_and_dps.md (Smite, Attack increase, crit damage, then crit chance; flat Attack falls in value with gear).

Caster-relevant lines in the random pool (weapon/guard): Attack (WeaponFixingDamage 38-51), Critical (59-75), Accuracy (79-98), Combat Speed (11.2-13%), Crit Damage (CriticalAddDamage 83-102), Back/Front Attack Damage, AmplifyAllDamage (6.3-7.3%), AmplifyWeaponDamage (8.3-9.6%), Additional Hit Rate, Might/AGI, MP. Armor pools carry Attack (23-33), Critical, Accuracy, Perfect (5-5.8%), AmplifyAllDamage (5.7-6.6%), DamageRatio. Jewelry pools carry Attack 19-38, Critical, Accuracy, INT, CombatSpeed (necklace 3.7-4.4%), MoveSpeed (earrings).

| Slot | Attainable now (Epic, equip lvl 45, +15) | Endgame candidate (Unique, in dictionary; availability at launch unverified) |
|---|---|---|
| Main hand (Spellbook, 1105) | Lunatic / Black Claw / Corrupted Judicator Spellbook: Attack 229, Acc 100, Crit 100, 3 sub lines, 3 mana sockets, 1 theostone; sources Reward Chest, Expedition, Sanctuary (ids 110540053, 110540048, 110540044) | Splendent Wise/Ebony Dragon Lord Spellbook (Crafting, 110530045/46): Attack 525, 5 sub lines, 4 sockets, 5 sub-skill slots. Ludra's Grimoire (110520003, Reward Chest/Sanctuary): same 525 base, 3 lines. Wise Dragon Lord (lvl 94) and Splendent White (lvl 86) below. |
| Off hand (Guard, 1150) | Epic Guards (same family); Liberator Guard is the quest one | Splendent Wise/Ebony Dragon Lord Guard (115030045/46): Attack 210, 5 lines; Ludra's Heart (115020003) |
| Top / Legs / Helm / Shoulder / Gloves / Boots / Cape | Lunatic, Corrupted Judicator, Black Claw sets (lvl 45, 3 lines, 3 sockets); Unyielding, Divine Canyon (lvl 42) | Splendent Wise/Ebony Dragon Lord pieces (Crafting; e.g. Breastplate 210130040 Defense 756 HP 408, 5 lines). These are the real power jump because the 5-line random pool includes Attack, Crit, Accuracy, Perfect, AmplifyAllDamage |
| Necklace | Black Claw / Unyielding Necklace (Epic) | Splendent Dragon Lord Necklace 310130040: Attack 158, Def 378, 5 lines (INT up to 24, CombatSpeed 3.7-4.4%) |
| Earrings x2, Rings x2 | Murute Earrings (Expedition), Black Claw set (lvl 45) | Splendent Dragon Lord Earrings 310230040 (Attack 131), Rings 310330040 (Attack 105) |
| Bracelet | Ascension Bracelet (Unique, lvl 51, no random lines) | Abyssal Bracelet 310430041/63 (lvl 86; pool is the 10 deity stats 9-17 each, 4 lines): this is how you build the deity stats |
| Belt | Noble Belt Epic (Substance Morph upgrade at +10) | Noble Belt Unique (215230001: Defense 500, HP 1100, Restoration 5%) |
| Amulet | Revelation Amulet Epic 311040001 (Defense Pierce 400, Seal Stone damage 10, Weapon Damage +7.5%) | Revelation Amulet Unique 311030001 (Pierce 700, Seal Stone 40, Weapon Damage +10%, Perfect 5%); for PvP, "Fierce Battle Amulet" (PvP damage +20%) |
| Arcana (5 slots) | Primal Vigor set pieces (+60/+150 PvE Attack) vs Magic Armor (MP sustain) | Unique grade of the same two sets; Primal Vigor for damage |

Per archetype: armor and jewelry ids are shared by all classes (no armor type or class lock), so the optimizer difference per class is (a) weapon family (see id scheme), (b) stat weights: DPS casters/archers favor Attack, Critical/crit damage, Accuracy, Combat Speed, Smite-type; melee DPS add back-attack damage; tanks favor Defense/HP/Block/Perfect Resist; healers favor Restoration/INT/MP lines (the pool of a Cleric/Chanter item is the same, so weighting alone decides). The weapon `classNames` list is the only hard restriction.

## Implementation plan for the optimizer
1. Ship a trimmed table built from `_scan_equip.json` (id, slot family, grade, level, equipLevel, maxEnchant, mainStats base, enchant slope, subStat pool, subStatCount, sockets, sources, classNames). About 3.5k rows, a few MB; refresh by re-running scan.py after patches. Check redistribution risk first: this is NCSoft game data (the app already fetches live, so prefer fetching on demand with a local cache instead of bundling).
2. For slots that roll random lines, score with the expected value of the pool under the class weights (choose the best `subStatCount` lines for an upper bound, mean for a realistic case) and label it as such.
3. Validate: sum DarthThot's real gear (+ stone lines) and compare with `info.stat.statList` and `ItemLevel` 707.
4. Fill gaps before promising DPS numbers: Exceed scaling, manastone/theostone option pools (metaroad lists them), enchant costs (for "worth it" marginal-cost advice), and whether level-86+ Unique items exist at Global launch.
