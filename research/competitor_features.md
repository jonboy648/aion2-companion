# Aion 2 competitor feature inventory (2026-10-03)

Method: Firecrawl scrapes (about 23 credits) of aion2hub, aion2t, aion2.app, aion2db, metaroad, aionflex, questlog; shugo.gg read via curl (its llms.txt, FAQ, tier list, database pages, sitemap) plus a Playwright network capture of a character page. Raw files are in D:\Aion2\.firecrawl\. Scraped text was treated as data only.
"Quality" is my judgement from the pages I could see; JS-only tools (planners) were not exercised interactively, so their internals are "not verified".

Our features for reference: armory import, all-class build optimizer (playstyles + trade-offs), Daevanion planner, codex, keybinds/in-game macro generator, crafting shopping list, road map.

## Per-site inventory

### shugo.gg (strongest all-rounder; ad-supported; robots Disallow /api/)
| Feature | What it does | Quality | We have it? |
|---|---|---|---|
| Armory / character page | Search by name across Global/KR/TW; tabs Equipment, Skills (specialty/DP skills), Daevanion, Stats, Ranks, Cosmetics; gear score (ItemLevel) + CP in header; stigmas, arcana, wings/pet; favorites (50, browser-local); Discord login links characters | Good, fast, uses official API through its own proxy | Partial (import yes, no public lookup page) |
| Leaderboard | Ranks by official Combat Power, built only from profiles that were opened on shugo; top 500 per region re-checked nightly; filters server/class/faction | OK but self-selected sample (official ranking API down since Sept 2026) | No |
| Tier list | Editorial PvE/PvP/solo, Global vs KR/TW, with cited YouTube/community sources (Global PvE 2026-09-30: S Sorcerer, Gladiator, Assassin; A Ranger, Spiritmaster, Templar, Cleric; B Chanter) | Opinion only, but sourced | No (we compute instead) |
| Item DB | 10,984 item pages (`/items/<id>`), grade, level, class, base stats, random-stat pool, enchant preview at every level (+15 Epic, +20 Heroic with 5 breakthrough tiers), where-to-get with monster/dungeon/quest links | Very good; NOTE shows KR/TW numbers (Liberator Spellbook attack 221-245, item lvl 48, +15 cap) while the Global API says 178-198 / lvl 39 / +10. Global toggle "stays disabled" until NCSoft publishes | Partial (codex) |
| Database | Skills per class with specialty planner (`/skills/<class>/planner`), dungeons, monsters (drops), quests (chains), titles, crafting (materials, mastery, success rates) | Broad | Partial |
| Map | Interactive world map per zone with marker layers (named monsters, hidden cubes, kibelisks, flight circles, resources, merchants, crafting stations) | Good | Road map only |
| Timers | Rift of Space-Time, Shugo Festival, Artifact Siege, siege bosses, Nahma, Kaira, daily/weekly resets per region; public `timers.json`; floating rift widget | Good, Global schedule is observed not official | No |
| News | English translations of every KR patch note, RSS | Good | No |
| Profile / streams | Twitch streams list, Discord login | Filler | No |

### aion2hub.com (tools-first; owns the AionFlex DPS meter link)
| Feature | What it does | Quality | We have it? |
|---|---|---|---|
| Gear Forge (enchant calculator) | Per-level enchant ladder with base chance + pity ramp (+5% per fail), expected materials, Kinah, attempts, 90th percentile; e.g. Ludra's Blade +0 to +15: 190,650 materials, 14.99M Kinah, 22 attempts avg. Covers 1 of 5 upgrade systems (Enchant, Exceed, Surpass, Soul Add, Succession) | Excellent, uses real game ladder | No |
| Stat Calculator | Attribute and deity-stat points to derived stats (0.1%/pt primaries, 0.2%/pt deity; Wisdom gives Smite and MP cost). Conversions only, datamined, flagged as maybe inaccurate | Good, small | No (we get statSecondList from the armory) |
| Build Planner (beta) | Equip real gear, summed stats, share by link; Global vs KR/TW toggle; 9 classes; "import from AionFlex" | Beta; sums stats, no optimizing | We are ahead (optimizer) |
| Community builds | Browse/share builds incl. gear, skills, Daevanion, Pantheon; mostly empty on Global (1 build) | Thin | No |
| Crafting calculator | Ingredient costs | Not opened | We have shopping list |
| Item DB + sets | Item DB with Global/KR toggle; Set bonuses (17 total, only 2 in Global: Arcana sets Primal Vigor and Magic Armor), Achievements, Nightmare, Awakening, Monoliths, Titles, Cosmetics, Drop rates | Good | Partial |
| Conversion | 221 exchange recipes with success/crit/fallback odds | Niche, useful | No |
| Timers | Rift timer, world bosses, season calendar | Fine | No |
| Abyss rankings, cash shop, maps (hidden cubes), leveling guides 1-50 per faction | Content | Fine | Road map only |

### aion2t.com / aion2.app (same operator; "qassser")
- Daevanion Simulator (`/daevanion?job=N`): per-class boards, click nodes, combined bonuses, share link, show skills. Quality good, comparable to ours (we also import real board state).
- Skills Builder (`/simulator`): mastery points, stigma shards, hotbar layout designer, import/share build. Hotbar planner is the closest thing to our keybinds feature but has no key export.
- Crafting calculator with live ingredient prices (premium upsell). DPS overlay (packet-based). Map, news, guides.
- aion2.app/db: client-extracted DB, 9,450 items, 483 skills, 7,545 monsters, 109 dungeons, 1,314 quests, 737 recipes, 90 wings, 208 pets, 734 titles, 646 achievements; "game client 18.09.2026".

### aionflex.gg (DPS meter + meta analytics; Global/KR/TW)
- Packet-based DPS meter (free + Pro EUR 4.49/month), 107k fights, 5k hunters. Hall of Champions, boss rankings per class, PvP leaderboard, character search.
- Meta pages: class balance at equal Combat Power (typical and top end), boss index (kill time + entry CP), party comps per instance, weekly digest, methodology page admitting limits. This is the only data-driven "who is strongest" source, but it needs uploaded fights.

### metaroad.gg/aion2 (new section, multi-game)
- Database read from client: 3,555 equippable items in 29 slots, classes with base stats by level, skills with attack coefficient, Daevanion boards, item sets, wings, titles, creatures, Pantheon (artworks/statues), Manastones (what each stone can engrave and how often), Monoliths (per-zone tracks), crafting, monsters, dungeons (weekly limits), quests, maps.
- Planner (class, faction, tags, save/share), build guides, community builds, event timer. Their database is the only one I saw exposing manastone odds and skill coefficients.

### questlog.gg/aion-2 (largest brand; ad-supported)
- Character Builder (hot; filters PvE/PvP/Arena/Dungeon/Siege/Budget/Endgame, tank/dps/healer), Skill Builder, Daevanion Planner, Gear Viewer, Dressing Room (cosmetics), Armory + Leaderboards + Tier List + Meta Analysis (TW region data: class K/D/A in Abyss), Map, Checklist (dailies/weeklies with presets, needs sign-in), Crafting Calculator, level/unlock/mastery/ranking tables, server status and resets, boss schedule, Spacetime Rift, Shugo Festival. Streamer drops sidebar.

### aion2db.gg, aion2planner.com, aion2.online
- aion2db.gg: pre-launch style DB (8,369 items, 272 skills, 4 dungeons), release/system-requirements content. Low value.
- aion2planner.com and aion2.online/build-planner: not opened (aion2planner.com scrape returned nothing readable). aion2.online advertises "gear, skills and stats calculator".
- Reddit thread (r/Aion2) mentions another companion with build planning and tier list; not investigated.

## Gap analysis (what players of a "be strongest" tool want)
Nobody ranks gear for the player. Planners sum stats (aion2hub) or just list items (everyone). Nobody combines: your real character + all items in the Global dictionary + enchant levels + objective (DPS proxy) = "what to equip / farm / craft next". That is our lane, and the data to do it is public and unauthenticated (see gear_data.md).

## Ranked features to add
Impact = effect on a player trying to be strongest. Effort S under 1 day, M 1-3 days, L a week+.

| # | Feature | Impact | Effort | Data source | Competitor reference |
|---|---|---|---|---|---|
| 1 | **Gear upgrade advisor / best-in-slot per slot** for the imported character: per slot show current item vs top candidates (item level, +main stat at chosen enchant, random-stat pool, slots) scored by our optimizer weights; show "where to get" | Very high | M | Official `/en-us/api/gameconst/item?id=&enchantLevel=` (no auth), ids enumerated from shugo `sitemap-items.xml`; already scanned 5,272 ids, 3,478 exist in Global (saved) | None do it |
| 2 | **Enchant cost + pity calculator** (Gear Forge equivalent) per slot: cost to go +N to +M, and marginal stat per material | High | M | Stat gain per level: official item endpoint. Success rates, pity, materials, Kinah: not in the endpoint; need datamined tables (aion2hub reads them from game data; metaroad/aion2.app expose some). Gap | aion2hub Gear Forge |
| 3 | **Stat calculator / derived-stat sheet**: show what Might/Wisdom/etc. points convert to, and Smite/MP-cost from Wisdom | Medium-high | S | Official `character/info` `statList[].statSecondList` gives the converted text per stat; per-point rates from aion2hub (0.1%/pt primary, 0.2%/pt deity) | aion2hub |
| 4 | **Arcana + Manastone/Theostone + Pantheon/Monolith planner** (the deity-stat ring and sockets that gear slots feed) | High | M-L | Arcana: 30 items + 2 sets via official endpoint (saved sample_arcana.json). Socketed stones on a real character: `equipment/item?characterId=` returns `magicStoneStat`/`godStoneStat` (seen in official JS; not yet verified live). Stone odds, Monolith, Pantheon: metaroad DB only | metaroad, aion2hub |
| 5 | **Compare with top players / copy a build**: import any character by name and diff vs mine (gear, enchants, Daevanion, stats) | High | S-M | Same official armory calls we already use (search + info + equipment + daevanion); we already import one character | aion2hub links to AionFlex search; shugo profile |
| 6 | **Dailies/weeklies checklist + reset and rift timers** | Medium (retention, not power) | S | shugo `timers.json` (public, but Global is "observed"), official patch notes | questlog Checklist, shugo Timers |
| 7 | **Shareable build links and a small community gallery** | Medium | S (links) / M (gallery needs backend) | Our own | questlog, aion2hub, metaroad, aion2t |
| 8 | **Acquisition planner**: from the item "sources" (Crafting, Reward Chest, Expedition, Sanctuary, Quest, Shugo Festival) build a farm/craft route, merge into the existing crafting shopping list | High | M | `sources` field in the item endpoint; recipes from our crafting.json; drop tables need shugo/aion2.app (ToS-gray) | shugo "where to get", aion2.app |
| 9 | Class balance / meta from real fights ("strongest class at your CP") | Medium | L | Needs uploaded fight logs (AionFlex owns this). Skip; link out | aionflex |
| 10 | Conversion/exchange recipes, titles collection tracker (info gives `ownedCount/totalCount`) | Low-medium | S | official info + aion2hub | aion2hub |

Not worth building now: interactive map (shugo/aion2hub/aion2t are good), DPS meter (packet capture, ToS and NCGuard risk), news translation, streams.
