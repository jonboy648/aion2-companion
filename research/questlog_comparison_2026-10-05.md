# questlog.gg vs becomecube.com: feature-gap report (2026-10-05)

Sources: Firecrawl scrapes of ~35 questlog pages (raw in `.firecrawl/questlog-*.md`, gitignored), the menu tree and nine pages read in Jon's browser (`.firecrawl/questlog-nav.md`, `questlog-pages.md`), and our repo. Scraping stopped on the coordinator's order after a Cloudflare block; nothing was done to get around it. Credits used: about 33 (balance 657 of 1,000 after the run; the "~690 before" figure was approximate).

**Not seen (menu only):** Gear Viewer detail, Dressing Room, Leaderboards, News, Patch Notes, Server Resets, Boss Schedule content, Abyss Supply Requests, Daeva Passes, Skins, Titles, Achievements, Status Effects, Regions, Ranking Tiers / Legion Levels / Pet Collection tables, Brawler class page, a full character-builder build page (only the library index and Jon's browser notes), and the interactive builder controls. Individual db detail pages (item, item-set, skill, npc, quest, recipe, daevanion-node) came back as site chrome with no usable body in markdown, so item stats shown there are unknown to me. Anything about those is inferred from the menu.

## 1. Their site map

Base `https://questlog.gg/aion-2/en`. 9 languages plus separate KR/TW editions (`en-nc`, `ko-nc`, `zh-nc`). Header shows live countdowns (Shugo Festival, Spacetime Rift, next field boss, daily reset), a Twitch drops-streamer strip, ads with a paid "Remove Ads", sign-in.

| Area | URL | What it is |
|---|---|---|
| Home | `/` | Hub with timers, featured builds, news |
| Character Builds (HOT) | `/character-builder?class=` | Community library, 1,000+ builds (567 Gladiator, 435 Sorcerer). Filters: region (Global, KR&TW), 9 classes (incl. Brawler), tags (PvE, PvP, Arena, Dungeon, Siege, Large-Scale, Beginner, Budget, Endgame, Tank/DPS/Healer/Support). Sort by likes, clone, comments |
| Build page | `/character-builder/<slug>?build-id=` | A "build" is a set of up to 9 sub-builds by gear-score bracket (Leveling 0-1200, Early 1200-1800, Mid 1800-2600, Late 2600-3400, End 3400+, PvE and PvP tracks). Tabs Builder / Description / Compare Builds / Settings / Share; sub-tabs Equipment / Skills / Daevanion / Description / Comments. Shows enchant per slot (+10 x16, +3 x2), a full computed stat sheet, account-wide collections (skins, pets, wings, monolith, titles, pantheon, arcana) |
| Skill Builds | `/skill-builder?class=`, `/skill-builder/<id>` | 823 Sorcerer skill builds. Per build: skill ranks, stigmas, a skill priority list, key macros with millisecond delays, written description, tags, "Detailed Skill Planner" |
| Daevanion Planner | `/daevanion-planner/<id>?build-id=` | Saved boards per user with a points total, per-board totals (Nezekan, Zikel, Vaizel, Triniel, Azphel) and summed stats (see section 3) |
| Class guides | `/classes`, `/classes/<class>` | Per class: top builds, most-used gear by slot with usage %, an "how it plays" prose, strengths/weaknesses, highest-geared characters |
| Armory (HOT) | `/armory`, `/armory/<region>/<id>` | Character search (Global, Taiwan, Korea), leaderboards (Abyss, Nightmare, Transcendence, Solo/Team Arena, Subjugation, Awakening), trending. Profile: equipment with enchants, "Copy to Builder", combat logs from their desktop app, titles, skills, arcana, Daevanion board points, full stat sheet |
| Leaderboards / Tier List / Meta | `/armory/leaderboard`, `/armory/tier-list`, `/armory/meta` | Tier list from leaderboard scores (Assassin 79, Gladiator 64, Chanter 62, Sorcerer 59, Templar 59, Cleric 55, Elementalist 43, Ranger 41, Brawler 35; TW data). Meta: faction split, class share, Solo/Team Arena win rate per class, Abyss K/D/A per class, ranked players per server |
| Gear Viewer | `/gear-viewer` | Sortable table of 759 equipment pieces, pin and compare |
| Dressing Room (NEW) | `/dressing-room` | Cosmetic preview (menu only) |
| Map (HOT) | `/map` | Interactive world map, 19,990 markers on Verteron alone: services, NPCs, 13,299 monsters, 2,733 gatherables, Empyrean Traces and hidden cube spots, strongholds, kibelisks, sealed dungeons, rifts, portals. Filters, Routes, Progress tracking |
| Checklist | `/checklist` | Daily/weekly tracker with presets and next-reset (sign-in) |
| Crafting Calculator | `/crafting`, `/crafting/<id>` | 1,098 recipes by profession (Tailoring 326, Jewelcrafting 256, Blacksmithing 234, Alchemy 194, Cooking 88); per recipe: ingredients, owned, unit price, fee, total and per-item cost |
| Tables | `/table/unlock-requirements`, `/table/mastery-levels/{crafting,gathering}` (+ Character Levels, Ranking Tiers, Legion Levels, Pet Collection Rewards) | Reference tables, e.g. feature unlock levels and item-level gates; mastery XP per level and skill points |
| Server Status (NEW) | `/server-status` | Live population per server/region (128k online, 38 servers, faction balance, queues, 24h/7d/30d history) |
| Timers | `/server-resets`, `/boss-schedule`, `/spacetime-rift`, `/shugo-festival`, `/release-countdown` | Rift every 3h (portal open 10 min of a 1h window); Shugo minigames hourly, 10 min, with the 11-game pool (corrected in section 6: code lists 11, the client EventSchedule has 11 per faction); countdown with FAQ |
| Desktop app | `/app` | Free Windows DPS meter (network only, no memory access): party DPS, boss HP/stagger/time-to-kill, cooldown tracker overlays, saved fight history, PvP, training mode |
| Database | `/db/...` | Items (weapons 9 types, armor 7, accessories 6, equipment, arcana 10, currency, misc, pantheon, ~35 usable types), skills per class, status effects, item sets, recipes, Daevanion boards and nodes, regions, quests (7 kinds), achievements (7 kinds), dungeons, abyss supply requests, NPCs, gatherables, titles, Daeva passes, wings, skins, pets. Detail pages per id |
| Content | `/news`, `/patch-notes` | Articles and weekly patch notes |

## 2. Side by side

Ours: routes `/`, `/c/:region/:serverId/:name`, `/board`, `/maps`, `/compare/:a?/:b?`, `/guide`, `/build`, `/daevanion`, `/codex/:classKey?`, `/keybinds`, `/crafting`, `/roadmap`, `/admin`. Features: playstyle cards, gear upgrades, max potential, compare, board, daevanion planner with game art, codex, guide, crafting, keybinds, roadmap, maps (party pins; full interactive map on `codex/approved-map`).

| Feature | questlog | becomecube |
|---|---|---|
| Character lookup by name (armory profile) | have, with leaderboards | have (`/c/...`) |
| Leaderboards, tier list, meta analysis | have, from official ranking | missing (we have `/board`, scope unconfirmed here) |
| Character/gear builder with computed stat sheet | have (full sheet, GS brackets) | partial (`/build` manual build, `/c` build card; our Stats model is 15 fields) |
| Community build library (likes, clone, tags) | have (1,000+) | missing |
| Gear-score bracket progression builds | have | missing (our roadmap/guide is the closest) |
| Gear upgrade suggestions, max potential | none seen | have (differentiator) |
| Playstyle cards, DPS/rotation breakdown | none seen (their DPS comes from the desktop meter) | have (differentiator) |
| Build compare | have (tab inside build) | have (`/compare`) |
| Skill builder with stigmas | have (library) | partial (codex + build page) |
| Key macros / skill priority | have (text and ms delays) | have (`/keybinds`, hotbar, macros) |
| Daevanion planner | have (saved, stat totals) | have (with game art) |
| Class guides with gear-usage stats | have | partial (codex per class, guide) |
| Item database (all types) | have, huge | missing (data exists in export) |
| Skill, NPC, quest, recipe, set, node db pages | have | partial (codex skills only) |
| Interactive world map | have (20k markers, progress, routes) | partial (party pins; full map on branch) |
| Crafting calculator | have (prices, fee, per-item cost) | have (`/crafting` browser + shopping list), prices unknown |
| Gear Viewer table | have | missing |
| Dressing Room, skins, wings, pets, titles db | have | missing |
| Checklist (dailies/weeklies) | have (needs sign-in) | missing |
| Server status, resets, boss/rift/Shugo timers | have | missing |
| Reference tables (unlock levels, mastery XP) | have | missing (roadmap has level data) |
| Desktop DPS meter and overlays | have | missing (out of scope, see no-automation line) |
| News / patch notes | have | missing |
| Multi-language | 9 + KR/TW editions | English only |
| Beginner guide / journey | none seen | have (`/guide`, `/roadmap`) differentiator |
| Accounts, saved builds | have | none seen |

## 3. Formulas and numbers

questlog does not publish a damage formula. No page states a crit cap, defense curve, or DPS model in text. What it shows is the stat sheet its builder computes (from Jon's browser notes) and armory profiles of real characters. Numbers below are as displayed.

**Stat sheet categories (build page):** Main, Attributes (Might, Dexterity, Intelligence, Constitution, Precision, Willpower), Attack, Defense, Accuracy, Critical, Resistance, Conqueror (10 deity stats), Status Effects, PvP, PvE, Movement, Recovery, Resource, Cooldown, Cost, Shard, Gear (per-slot Attack/Defense increase %), Amp Ratio.

**Sample sorcerer sheet (build page, Gear Score 2312):** Attack 1,138; Attack Bonus 966; Max/Min Attack 454/406; Penetration 5,110; Critical Hit 2,245; Critical Attack 25 (flat); Damage Boost 20%; Critical Damage Boost 14.1%; Weapon Damage Boost 13.9%; Boss Attack 770; Boss Defense 6,600; Boss Damage Boost 0.5%; PvE Attack 482; PvE Damage Boost 22%; Multi-hit 20.1%; Perfect 12.5%; Double 14.8%; Combat Speed 45.1%; Cooldown Reduction 6.5% and Cooldown -7.9% (two separate stats); Defense 8,136; Defense Bonus 6,300; Damage Tolerance 26.4%; Critical Damage Tolerance 14.1%; Status Effect Chance 73.1%; weapon-type Attack increase 33% each; Amp Ratio Attack +14.3%, Critical Hit +20.4%, Accuracy +16.1%.

**Sample cleric armory (`/armory/as/...`, Lv45 iLv 2155; NOTE: these stats are not game-reported. The code shows questlog reconstructs the armory sheet itself from equipment, Daevanion, wings, equipped titles and arcana, see section 6.3 F2):** Max/Min Attack 262/215; Accuracy 282; Critical Hit 435; HP 14,127; Defense 7,128; Attack 867; Attack Bonus 206; Penetration 2,010; Damage Boost 3%; Critical Damage Boost 3%; Weapon Damage Boost 10%; Damage Tolerance 6%; Multi-hit 6.5%; Perfect 5%; Double 1.6%; Regeneration 5.8%; Parry/Shield Block reduction rate 27%/40%; Back Defense 545, Front Defense 232. Skill ranks on the profile reach 15-18 on actives and stigmas 10.

**Daevanion planner (Templar sample, 356 points):** board totals Nezekan 87/134, Zikel 85/134, Vaizel 78/134, Triniel 106/168, Azphel 0/232. Nezekan at 87 points sums to Critical Hit 130, HP 2400, MP 800, Crit Resist 95, Combat Speed 300, Attack Bonus 81, Damage Boost 300, Crit Damage Boost 300, Damage Tolerance 300, Crit Damage Tolerance 300, Multi-hit 450, Defense Bonus 750, Cooldown Reduction 300 (raw units, presumably 300 = 3%). The cleric armory shows 89/89/89/117/153 instead of 134/134/134/168/232. RESOLVED by the front-end code (section 6): the armory counts selected NODES out of all nodes (89 incl. the free start node), the planner counts POINTS out of the summed node costs (134). Our `research/daevanion_notes.md` has exactly 89/89/89/117/153 nodes and 134/134/134/168/232 points, so the two pages agree with our data.

**Skill level cap:** their skill planner text says max rank 20 = 10 from points + 4 Daevanion + 4 per arcana line + 1 equipment line; specialization slots at ranks 8, 12, 20. Global S1 stigma cap 4 (their text). Check against our `total_rank` clamp and Global cap.

**Other values:** Blade Toss "cuts target Defense by 30% and Incoming Heal by 50% for ten seconds" (Gladiator guide, skill text, so it comes from game data). Unlock table: Conquest tiers need item level 700 / 1400 / 2100 / 2800 / 3000 (all at level 45). Rift: every 3 h, event 1 h, portal open 10 min. Global level cap 45 (countdown FAQ confirms global launch 2026-10-05 13:00 UTC).

**Contradictions with our engine:** none found against the stated values in the pages read for sections 1-5. The front-end code (section 6) adds one: our Korea core-skill rank cap of 40 against their 20 (`build_gamedata.py` `rank_caps`). questlog does not state a crit cap or cooldown cap anywhere I could read, so they neither confirm nor contradict 50% / 60%. Their sheet matches our model on: Critical Attack flat (shown as 25, not a percent), Multi-hit/Perfect/Double as separate chance stats, Combat Speed and Cooldown reduction as separate stats. Their sheet disagrees with our model in structure, not value:

**Stats we do not model (candidate sources of the ~3x overstatement; this is a hypothesis, not a measurement):**
1. Boss Defense 6,600 against our `target_defense` 0. With Penetration 5,110 the net is 1,490 defense. Our DEFENSE_FACTOR 0.1 would remove only about 149 flat per hit, which is small, so if real defense is a ratio curve (defense/(defense+K)) the loss is much larger than we model. The curve is unknown and the client holds none (see `stats_gear_extract_2026-10-04.md`).
2. Damage Tolerance 26.4% and Critical Damage Tolerance 14.1% on the target side. Our sims apply neither. Even assuming a boss has only a fraction of that, a 15-25% cut compounds with the item above.
3. Perfect chance (12.5%) and Multi-hit (20.1%): modelled only partly (smite = Double); Perfect and Multi-hit are not in `Stats`.
4. Amp Ratio multipliers (+14.3% attack, +20.4% crit, +16.1% accuracy) as a separate layer; Attack Bonus 966 vs Attack 1,138 suggests Attack Bonus is a large additive piece. Check whether our `attack` is the sum or only part.
5. Accuracy vs evasion (miss chance) and Status Effect Chance: not modelled; accuracy is rated 282-ish on an endgame cleric.
6. Boss Attack and PvE Attack (770, 482) as flat additions, not percent; our `boss_dmg_pct` and `pve_dmg_pct` are percent only.
7. Uptime: a damage meter reads damage over a fight, with movement, deaths, and cast cancels; our sim presumably runs a perfect rotation. This is likely a large share of 3x and independent of the stats above.

To calibrate, Jon's ~7k in game against our ~20k is a factor of 2.9. Stacking item 2 (0.75) and a realistic uptime (0.7-0.8) and a real defense reduction (0.6-0.8) lands around 0.3-0.45, which brackets 1/3. That arithmetic is illustrative only. The decisive test is the questlog desktop meter or a combat log of a known build compared with our sim of the same stats.

## 4. Look and UX notes

- Layout: dense, database-style. Persistent mega-menu with ~150 database entries, `Ctrl K` search, filter chips (region, class, tags) above card lists, tabbed detail pages, per-id URLs for everything. Ads and a Twitch drops strip crowd the top of every page.
- Better than ours: breadth and linkability (every item, skill, NPC has a URL and a search hit), the global search, "Copy to Builder" from an armory profile, build sets by gear bracket, live timers in the header, usage-% gear tables on class pages, multi-language.
- Worse than ours: ad clutter, build detail is tab-heavy, class pages read as templated prose, the builder shows numbers but no explained DPS, rotation, or "what should I upgrade next". The guide, roadmap, gear upgrades, max potential, and playstyle cards have no equivalent on their side. Our Daevanion board art and the game-art look are stronger than their text-and-number planner.
- Their weakness: every build is a human opinion with likes; there is no engine behind the numbers. That is the lane where becomecube can lead.

## 5. Ranked additions

Data availability: "export" = private client export at `D:\Aion2-tools\export-test\out` (items 9,245, skills, NPCs 13,493, quests, recipes, maps).

| # | Feature | Player value | Effort | Data |
|---|---|---|---|---|
| 1 | Calibrate absolute DPS: add Boss/target defense, Damage Tolerance, Perfect/Multi-hit, Amp Ratio and an uptime factor to the engine; validate against a combat log or the questlog meter | High (trust in every DPS number we show) | M-L | Partial: client has caps and stat meanings, no curves; need a measured fight |
| 2 | Global search (`Ctrl K`) over skills, items, NPCs, quests | High, unlocks everything below | M | export |
| 3 | Item database: browse by slot, item detail, item sets, linked from gear and compare | High (most-visited type of fan-site page) | M-L | export (items, sets) |
| 4 | Timers page and header strip: Rift (3 h), Shugo (hourly), daily/weekly reset, field boss | High, cheap, daily return visits | S | Public schedule; resets in `GlobalSetting`? unconfirmed |
| 5 | Interactive map (merge `codex/approved-map`) with resource, boss, dungeon, trace markers and progress tick-off | High | M (already built on a branch) | export (maps, NPCs) |
| 6 | Checklist (dailies/weeklies, presets, next reset), local storage, no accounts | Medium-High | S | Tasks hand-authored; reset times |
| 7 | Armory-to-builder "copy" plus saved/shared builds by link (no accounts needed, URL state) | Medium-High | M | Our own |
| 8 | Class page gear-usage stats and "top characters" from our own character crawl | Medium | M | Need character sample; we have `/board` |
| 9 | Crafting calculator prices and per-item cost (owned, unit price, fee) | Medium | S-M | export (recipes); prices user-entered |
| 10 | Tables: unlock requirements, mastery XP, item-level gates (Conquest tiers 700/1400/2100/2800/3000) | Medium, cheap SEO | S | export (Exp, mastery) |
| 11 | Skill and Daevanion node pages, status effects (buff/debuff), with deep links from codex | Medium | M | export |
| 12 | Meta/tier view from the official rankings (class share, arena win rate) | Medium (they have it; ours would need a ranking source) | M | External ranking API; verify terms |
| 13 | Server status page | Medium, but needs a live source | M | None (live poll, no-automation line applies) |
| 14 | Gear Viewer table (sort, pin, compare items) | Medium | S after #3 | export |
| 15 | GS-bracket build sets and community library | Medium, needs users and moderation | L | None |
| 16 | Dressing room, skins, wings, pets, titles | Low-Medium | L | export (partial) |
| 17 | News, patch notes, languages | Low for now | M-L | None |

Not recommended: a desktop DPS meter (conflicts with our no-automation line, and they already ship one).

**Suggested order:** 4 and 6 (small, daily-return), 1 in parallel (it protects our credibility), then 2 plus 3 (database spine), then 5 (already built), then 9 and 10.

## 6. Full feature inventory from their front-end code (2026-10-05)

Source: the 334 Nuxt/Vite chunks (5.4 MB) already downloaded to `.firecrawl/ql-js/` (entry `IQJ3RDA4.js`). Read offline only, by grep and small scripts; no request was made to questlog.gg or cdn.questlog.gg. Nothing is copied: this section describes behaviour in our own words and quotes only short identifiers. Limits of this method: the code holds the client side only. Item/skill/node/stat data, display names (i18n), gear score, combat power, tier inputs and all database content are served by their API, so numbers that live there (stat curves, caps, enhancement odds) are not in the JS. Where our private client export (`D:\Aion2-tools\export-test\out\AION2\Content\Data\Table`) has the same table, I checked it by table name or by reading a row (marked "export").

### 6.0 Corrections to sections 1-5 (what the code contradicts or settles)

| Where | Earlier text | What the code shows |
|---|---|---|
| Section 1, Timers | Shugo "10-game pool" | The Shugo page lists 11 minigames (Jump Jump, Wraith Evasion, Mysterious Track, Hidden Lugi, Odyle Flight Frenzy, Goldrin's Treasure, Defend Shugo Merchants, Up! Up! Up!, Not This Tile?, Nyerk Shooter, Shugo's Dilemma). Our export `EventSchedule` also has 11 per faction. |
| Section 3, Daevanion | maxima 134/134/134/168/232 vs 89/89/89/117/153 "unresolved" | Both are right and mean different things. Planner: points = sum of node costs, start node excluded. Armory: selected nodes out of all nodes including the start node. Matches `research/daevanion_notes.md` (537 nodes, 802 points). |
| Section 3, sample cleric armory | "real characters" | The armory stat sheet is computed in the browser (`calculateArmoryStats`): base level stats + equipment + Daevanion + wings + equipped titles + arcana, then the same second-stat and ratio passes as the builder. It leaves out pets, genus insight, skin collections, monolith, pantheon and title collections because the official profile does not expose them. Treat those sheets as a reconstruction (their own tooltip says "calculated from gear"), not as game-reported numbers. |
| Section 3, contradictions | "none found" | One: our `rank_caps` has Korea core 40; their cap is 20 for every region (stigma 25 on Korea/Taiwan, 20 Global). See 6.3 F4. |
| Section 3, hypothesis item 6 | Boss Attack / PvE Attack are flat | Confirmed by stat keys: `bossnpcadddamage`, `bossnpcdefense` are flat attack/defense lines, `bossnpcamplifydamage`/`bossnpcdecreasedamage` are the percent pair. |
| Section 2 | "Gear score brackets" | Gear score and combat power are never computed in the front end. The builder sends `gearScore: 0` on save and the server fills it in; only the per-item version (6.3 F8) is visible. |

### 6.1 Routes and pages (112 English routes; every one is also served under the other locale prefixes: de, es, fr, ja, ko, pt, ru, plus the NC editions en-nc, ko-nc, zh-nc; 11 route sets in all, so 8 global languages, not the 9 in section 1)

**Hub and content (12)**
- `/` home: hero, launch countdown, class build cards, meta preview, content sections.
- `/news`, `/news/:slug`, `/guides`, `/guides/:slug`, `/patch-notes`, `/patch-notes/:slug`: articles written in their own CMS (rich-text with tables, FAQ, chapter and image blocks, related-link blocks). The guide route is new to us (earlier report had only news and patch notes).
- `/release-countdown`: global launch countdown plus FAQ (launch 2026-10-05 13:00 UTC, early access from 2026-09-30 13:30 UTC, maintenance 05:00-13:00 UTC on launch day).
- `/premium`: subscription page (see 6.2 Premium). `/sign-in`, `/privacy-policy`, `/terms-of-service`.

**Builders and planners (23)**
- `/character-builder`: community library (index). Sub-routes `liked` (builds I liked), `personal` (my characters), `new` (create), `:slug` (character page), `:slug/compare-builds`, `:slug/description`, `:slug/settings`. `guest` slug works without an account.
- `/skill-builder`, `/skill-builder/new`, `/skill-builder/:slug`: skill/stigma builds with hotbar, priority list, macros.
- `/daevanion-planner`, `/daevanion-planner/new`, `/daevanion-planner/:slug`: saved board builds per user.
- `/classes`, `/classes/:slug`: class overview and per-class guide (top builds, gear consensus, skill picks, top-geared characters).
- `/gear-viewer`: sortable table of all equipment with computed maxed-out stats.
- `/dressing-room`, `/dressing-room/create`, `/mine`, `/:slug`, `/:slug/edit`: 3D outfit gallery and editor.
- `/profile/:slug?`: public user profile (characters, builds, outfits, combat logs, Twitch live embed).

**Armory (5)**
- `/armory` landing (search, favorites, trending, leaderboard preview); `/armory/leaderboard`; `/armory/tier-list`; `/armory/meta`; `/armory/:region/:characterId` character profile.

**Combat logs (9)** (fed by their desktop app, a "logs site" in the Warcraft Logs mould)
- `/combat-logs` landing; `/combat-logs/reports/:id`, `/reports/:id/:fight` (single report and single fight); `/combat-logs/runs/:id` (dungeon run); `/combat-logs/rankings`; `/combat-logs/meta` (class meta from logs).
- `/logs` landing (all-stars per role, dungeon tops); `/logs/dungeons/:id` (per-dungeon rankings, clear times, party compositions); `/logs/all-stars` (top 100 per role).

**Economy (5)**
- `/auction-house` (server picker, item search, lowest price, 14-day trend); `/auction-house/item/:item_id` (listings, price history, 7-day median, 30-day range, faction filter); `/auction-house/exchange` (kinah per Quna rate by server). New to us: the earlier report did not see an auction/market area.
- `/crafting`, `/crafting/:id`: recipe browser and per-recipe calculator.

**Live and timers (6)**
- `/server-status`, `/server-resets`, `/boss-schedule`, `/spacetime-rift`, `/shugo-festival`, `/checklist`.

**Map (1)**: `/map`.

**Reference tables (6)**: `/table/unlock-requirements`, `/table/character-levels`, `/table/legion-levels`, `/table/pet-collection-rewards`, `/table/ranking-tiers`, `/table/mastery-levels/:slug` (crafting, gathering).

**Database (40)**
- `/db` hub and `/db/search` (global entity search, also the Ctrl K box).
- 19 list routes `/db/{achievements, daeva-passes, daevanion-boards, daevanion-nodes, dungeons, gatherables, item-sets, items, npcs, pets, quests, recipes, regions, skills, skins, status-effects, supply-requests, titles, wings}/:mainCategory?/:subCategory?`, each with grid and table view, sort and facets.
- 19 matching detail routes `/db/{achievement, daeva-pass, daevanion-board, daevanion-node, dungeon, gatherable, item-set, item, npc, pet, quest, recipe, region, skill, skin, status-effect, supply-request, title, wing}/:id`.

**App, embed and staff (5)**: `/app` (desktop app landing and download), `/desktop/sign-in` (loopback sign-in handoff for the app), `/embed/db/tooltip` (embeddable item/skill tooltip for other sites), `/cms/overview` and `/cms/editor` (staff publishing tools; user levels admin, moderator, developer, content_creator, contributor, basic, guest, and paid tier_1 to tier_3).

Region switch (stored locally as `a2-schedule-region`) covers Global, Korea and Taiwan on all timer pages; ranking views add tw, ko, naw, nae, eu, la, as.

### 6.2 Features and controls, per tool

**Character builder** (chunks `DmeWREFS`, `jVJ8G5GG`, `DDJqEoWA`, `DGThp2Kf`, `BLyWtvNB`, `CTWUXsIT`, `Bmw8u_D6`)
- Library: filter by publisher (Global or NC), class grid, tag chips, search (minimum length), tabs All / Liked / Personal; cards show gear score and likes; clone.
- A "character" holds many builds (the limit is a feature flag, 100 with premium), plus folders (name, colour, note) and per-build name, note, tags and privacy (public, private, hidden). Tags: pve, pvp, arena, dungeon, siege, large-scale, beginner-friendly, budget-build, endgame-build, tank, dps, healer, support.
- Equipment, 25 slots: Weapon and Guard; helm, pauldrons, top, belt, legs, gloves, cloak, shoes; necklace, amulet, left/right earring, ring, bracelet, brooch, seal, rune, plus a pendant. Per slot: item picker (filtered by slot, race, class weapon), enhancement level, "surpass" (potential) level, main stats, sub-stats (chosen stat plus a min/max slider), sub-skill picks (stat lines that add skill levels, limited by item group and class), soulbind random or fixed lines, a Philosopher's Stone line, magic stones (slot count per item; accessories take soulstones), god stones.
- Account-wide collections: arcana (10 types, card level and sub-skills), pantheon, titles (attack / defense / utility slots plus a collection total), wings, pets and "genus insight" slots, skin collections (tiered), monolith levels per race and for Reshanta. Copy a build to another character.
- Stat sheet: 26 categories and about 600 stat keys, a tooltip per stat listing every source with its value, search, favourites (kept in local storage), collapsible categories, a Compare tab (two builds, or one against another character pasted by URL; only differing stats are shown, grouped by category, sources on hover).
- Other: rich-text description with database mentions, Ctrl+S save, unsaved-change guard, share link (guest builds are temporary, sign-in to keep them), JSON export/import, comments and likes, a settings tab (name, privacy).

**Skill builder** (`DdOVHc8H`, `BDf__IKA`)
- 12 hotbar slots with 4 sub-slots each (slot 11 holds only the basic skill); drag-and-drop or double-click to equip; per-skill rank slider; specialty (specialization) picks that open at ranks 8, 12 and 20; stigma slot limit (4 Global, 6 NC) with a guard message; a skill-priority list in three lines (active, stigma, passive) built from skill chains; up to 10 macros, each an ordered list of skills with a per-step delay in ms (0 to 10,000); tags, description, preview mode, JSON import/export.

**Daevanion planner** (`BXUsZL71`, `DDJqEoWA`, `BffpvY25`)
- Board grid sized from the node coordinates (15x15 fallback), five boards in their samples, click to toggle nodes; a node can only be switched on next to an active node, start nodes are always on, nodes cut off from every start are marked orphaned; board tabs with "points / max"; stats panel (summed stats grouped like the builder, plus +skill-level lines split into active and other skills); several saved builds per user (limit flag), reorder, clone, JSON import/export, guest mode kept in the browser, copy from an armory profile.

**Gear viewer** (`DWEne77Y`)
- Tabs (all, weapons, armors, accessories) and a slot filter, multi-select grade, min/max item level, search by item or stat name (150 ms debounce), sort by any column, dynamic stat columns with a column picker, pin items, select several to compare side by side. The stats shown are the fully maxed values: main stats plus the top enchant line plus the top exceed line. Extra columns: item level, a per-item "gear score" and max enhancement level.

**Dressing room** (`C5vOP6kP`, `BAC-01vj`)
- Three.js scene of an Elyos or Asmodian character, male or female, with character-creator tabs (face, eyes with sclera and vein options, hair and colours, body sliders and presets) mirroring the in-game customizer; wardrobe by slot (weapon, wing, armour); set browser; dye panel (official colours or a custom colour, copy a dye to all slots, reset); poses (auto, idle, wing idle, lobby per weapon); scene settings and framing bar; undo/redo (Ctrl+Z / Ctrl+Y); randomize; undress; screenshot; save an outfit with a thumbnail upload (public or private); gallery with new/popular sort, race and gender filters and search; clone-and-edit; share link.

**Armory** (`BdVlUZ_I`, `DI1mdNza`, `kI2wxcHV`, `CZ8bINzk`, `D-OyQxNW`)
- Search by character name with server and class filters, favorites, trending, a leaderboard per ranking content (class and server filters, podium cards).
- Profile: level, item level (colour banded at 1000 / 1500 / 2000 / 2500 / 3000), race, server, wing, 25-slot equipment grid, stats (reconstructed; five groups main, attack, defense, critical, PvP, first three shown), arcana (10 slots), titles, skills, Daevanion boards (nodes selected / total), rankings per content, combat-log section (best, median, clears, recent fights, kills), refresh button with a server-enforced cooldown (auto-refresh when the stored snapshot is older than 24 h), "copy to builder", "copy to planner" (sign-in, build limit applies).
- Tier list: views overall / PvP / PvE / by content / by class, region switch. Meta: faction balance bar (Elyos favoured, balanced, Asmodian favoured), class distribution, class-by-content win-rate matrix, solo and team arena stats, Abyss average KDA, server activity.

**Map** (`BuhNTSe3`, `BifQXKZv`)
- Worlds: field maps Verteron, Eltnen (Elyos), Ishalgen, Altgard, Morheim (Asmodian); Reshanta (lower, middle, upper, Abyss) and special areas (Odyle Shard Cradle, Stormslumber Snowfield, Sandstorm Temple); 6 neutral, 13 Elyos and 13 Asmodian dungeon maps; PvP arenas (Fire Temple Arena, Impetusium Arena). WebGPU renderer, game-art tiles of 1024 px, or one image for the starter zones.
- Marker types in display order: service, npc, monster, gatherable, collectable, location. Only monolith markers are on by default. Filter panel: show/hide all, icon size, contrast and shadow (global or per category), search, pinned markers, region overlay toggles (areas, borders, places).
- Progress: mark discovered or undiscovered per marker (collectables, services, strongholds and sealed dungeons are discoverable; hidden cubes are not), hide-discovered toggle, per-world bar, reset; saved server-side; signed-out viewers get an upsell.
- Routes: waypoint chains, freehand lines and text labels, undo/redo (50 steps), a note per waypoint, private or public, upvotes, public route browser (most upvoted or recently updated), share link. Route count, features per route and points per route are premium-gated flags.

**Checklist** (`CeUHmE9c`)
- Tasks with title, description, priority, daily / weekly / monthly / every-N-days recurrence, a progress target (multi-step tasks), reset day and time, archive, sort and filter, completion rate. 20 built-in presets (list in 6.3 F11). Needs sign-in; stored server-side.

**Crafting** (`XgyNkjSa`, `BtNuA0U5`)
- List by profession and category with mastery requirement and yield. Per recipe: desired output quantity (quick buttons 1, 10, 50, 100, 500), ingredient table (required, owned, unit price, cost), total, per-item cost, crafts needed, reset buttons, copyable link. Owned counts and prices stay in the browser (local storage), no account.

**Timers** (`0UAC9wTv`, `CQCCZyzj`, `CwZjvj9k`)
- Header strip with live countdowns and a dropdown of the next occurrences (Shugo, Rift, daily and weekly reset, next boss) in local time; region switch. Pages: Rift (next 8 portals), Shugo (next 10, minigame pool), resets (daily and weekly), boss schedule (Watcher Kaira, Artifact Siege, Siege Bosses, Guardian Lord Nahma, with boss ids linked to the NPC database). Exact schedules in 6.3 F10.

**Server status** (`GxaFqrR8`, `C2Ap_K78`)
- Per server: online players, capacity, queue, new / recommended / creation-blocked tags, faction split bar, 24 h / 7 d / 30 d population history, region filter, search, sort by population or name. Load label: full at 90% of capacity, busy at 70%, else good; maintenance and offline states.

**Auction house** (`hmWZKY7A`, `nPlZ7q3S`, `DB9dFRci`, `YemNWr2a`)
- Server picker and faction filter, item search, "listed only" toggle, lowest price and 14-day trend per item; item page with listing table, price-history chart (24h / 7d / 30d / 90d / all), 7-day median, 30-day range, all-servers mode; exchange page with kinah per Quna for each server (best rate, median rate, 30-day trend), derived from two chest prices.

**Database** (`C-UgPmTq` family, `8NsZI9rA`, `tGcqDRYQ`, `DnajxoU8`, `BKsBVzER`)
- Grid or table view, facet filters (grade, created date, per-type fields), sort, search; detail pages with cross-reference tables (41 relation types: dropped by, drops, sold by, used in recipes, part of item sets, target of quests, found in regions, rewards of dungeons, achievements, supply requests, daeva passes and more); item cards (main stats, sub-stat pools, set effects, soulbind and potential data, magic stone slots, Elyos and Asmodian versions); item upgrade tables (enhance, amplified enhance, potential, soul binding, each with an expected-cost calculator, plus decompose results); quest flow chart; skill learning table; Daeva Pass stages (free vs premium track); embedded map snippet per entity.

**Combat logs and desktop app** (`CWnFqo47`, `DNAsdW2P`, `cWauvq9j`)
- The app (Windows; their page says packet capture through Npcap, no memory reading) uploads fights. A report shows a timeline (casts, deaths, dispels, phases, telegraphs, aggro pulls), per-player damage with a skill table and rotation icons, DPS and rDPS, crit, hard hit (double) and perfect rates, uptime and buff uptime, healing and absorbs, damage taken and mitigation (blocked, parried, evaded, immune, perfect blocks, iron wall, restorations), stagger, accuracy, hits per minute, party contribution, and each player's gear and combat power. Rankings: per-dungeon clears and kills, fastest clears, class spread, scatter plots, compositions, all-stars per role (dps, support, tank, healer), percentile colouring (99+, 95+, 75+, 50+, 25+). App screens: alerts, assist, boss, fight, meter, pvp, training, logs.

**Accounts and social** (`B1TH_brY`, `H-Jykvx7`, `BhlZuUld`, `DxXjMXET`)
- Discord sign-in, profile with about-me, Twitch live embed and partner videos, comments with a rich editor and votes, likes on builds, notifications, user settings (Twitch handle), premium subscription through Tebex (monthly and yearly tiers), ad slots with a paid removal pill. Premium gives: no ads, up to 100 builds per character, a rank flair on profile and public lists, a Discord role, and higher map-route limits. Global search is a Ctrl K box over the database.

### 6.3 Formulas, numbers and rules found in the code

Convention: **[agree]**, **[differs]** or **[check]** is the comparison with our engine (`app/aion2c/engine/damage.py`, `app/aion2c/models.py`, `app/aion2c/engine/budget.py`). The code contains no damage formula, no crit cap and no cooldown cap. Those live in the stat data they fetch (the `limit*` stat family, see F6), so section 3's "neither confirms nor contradicts 50% crit / 60% CDR" still stands.

**F1. Stat aggregation order** (`DY6U1SZS.js`, `calculateFinalStats`)
1. Sum every source into one table of `{statId: total, sources[]}`: base level stats (row by class and character level, our `PcStatLevel`), equipment, Daevanion nodes, wings, pets, genus insight, skin collections, titles, arcana, pantheon, monolith.
2. Equipment per item: main stats, plus the enchant row for the item's chosen level (falls back to the top row), plus chosen sub-stats, plus the amplified (exceed) row for `level - topEnchantLevel`, plus the surpass row, plus the soul-add line, plus the magic-stone sub-stats, then set bonuses by number of set pieces worn.
3. Wings: the equipped wing's main stats, plus the sum of every enchant row up to its level, for every wing owned. Pets: main stats plus the enchant row at the pet level, summed over owned pets. Skins: for each collection, every tier from 1 to the owned tier. Monolith: every level up to the owned level, per race (light, dark) and for Reshanta. Titles: collection stats of owned titles plus stats of the equipped attack, defense and utility titles. Arcana: main stats plus every enchant row up to its level (the armory path uses only equipped cards).
4. Second-stat pass: for each stat total, floor it, clamp to the largest level in the `playerStatSeconds` table, and add the derived stats listed for that row (this is how Might, Dexterity, the 12 deity stats and so on turn into attack, crit and the like). **[agree]** with our `PcStatSecond` (1000 rows, raw 10 per point = 0.1%).
5. Ratio pass (`applyStatMappings`), run once, not iterated: `extra = baseStatTotal * (ratioTotal / 100) * 0.01`, so a ratio total of 1,430 is +14.3%. Mapping: `damageratio` to `weapondamage` and `weaponmindamage`; `defenseratio` to `armordefense`; `maxhpratio` to `hpmax`; `maxmpratio` to `mpmax`; `accuracyratio` to `weaponaccuracy` and `accuracy`; `evasionratio` to `armorevasion` and `evasion`; `criticalratio` to `critical`; `criticalresistratio` to `criticalresist`; `blockratio` to `block`. The ratio multiplies the final base sum (all sources), not each source. This is the "Amp Ratio" block on their sheet. **[check]** our `base = attack * (1 + attack_increase_pct) * (1 + weapon_dmg_pct)` multiplies one `attack` number; theirs scales only the Weapon Max/Min Attack lines, while Attack Bonus (`fixingdamage`) is a separate flat line. Confirm which of the two our `attack` input stands for.
6. Display: a stat whose indicator says "percent" is shown as value / 100 with a % sign; `fpmax` and `spmax` are scaled by 0.01; other stats are raw numbers.

**F2. Armory stats are reconstructed** (`DI1mdNza.js`, `Kt`/`calculateArmoryStats`): base + equipment (id, level, sub-stats, magic stones) + Daevanion + wings + equipped titles + arcana, then the F1 steps 4 and 5. No pets, genus insight, skin, monolith or pantheon, and no soul-add or surpass line. So an armory sheet is a lower bound of the builder number and not the game's own sheet. Also: refresh is allowed only when the server says so; the page auto-refreshes a snapshot older than 24 h (`864e5` ms).

**F3. Daevanion rules** (`BXUsZL71.js`, `DDJqEoWA.js`, `DI1mdNza.js`): grid cells are `row-col`; start nodes are always active and cost nothing; a node can be activated only if one of its four orthogonal neighbours is active; a node is "orphaned" when no path of active nodes reaches a start node (breadth-first walk from the starts); planner total per board is the sum of `costDaevanionPoint` over active non-start nodes; the board "max" is the sum over all non-start nodes; the armory instead counts nodes (type not null, start included). Node effects are of two kinds: `stat` (name, value) and `skill_level` (skill id, +levels, default 1; grade 4 means an active skill). No point cap is enforced in the page, the cap is only data. **[agree]** with `research/daevanion_notes.md` (537 nodes, 802 points); note our export `DaevanionMaxCapacity` lists DaevanionCrystal max 840, a different thing from the board totals.

**F4. Skill, stigma and level caps** (`BDf__IKA.js`)

| Value | Global | NC (Korea/Taiwan) | Ours (`build_gamedata.py`) | Verdict |
|---|---|---|---|---|
| Character level cap | 45 | 50 | 45 / 50 | agree |
| Skill (mastery) max rank | 20 | 20 | 20 / **40** | **differs on Korea** (`mastery_stigma.md` gives Global 20 and Korea stigma 25 only; nothing there supports 40) |
| Stigma max rank | 20 | 25 | 20 / 25 | agree |
| Stigma slots | 4 | 6 | 4 / 6 | agree |
| Specialty slot ranks | 8, 12, 20 | same | `spec_slot_ranks` from client | agree in form (slot count = thresholds reached) |
| Hotbar | 12 slots, 4 sub-slots (slot 11 has 1) | same | not modelled | n/a |

Per their skill-planner text (section 3) the mastery ceiling of 20 includes bonus ranks (Daevanion, arcana, equipment); our `BASE_RANK_CAP = 10` for bought ranks plus `MAX_DAEVANION_RANK_BONUS = 4` is a different split of the same ceiling, so only the Korea 40 looks wrong.

**F5. Arcana card unlocks** (`IQJ3RDA4.js`): number of sub-skills a card shows by card level: Common L0-L2 = 1, 2, 3; Rare = 2, 3, 4; Legend L0-L3 = 3, 4, 4, 4; Unique L0-L4 = 4 each. Ten arcana types: grail, parchment, compass, bell, libra, mirror, key, hourglass, dice, lantern. Five of them (libra, key, hourglass, dice, lantern) are listed again as a separate group in the code; its purpose was not determined. **[check]** our arcana handling against this table; export has `ArcanaEnchant*` and `ItemEquipSubstatSkill` (2,574 rows with class, base level, enchant step and max level 4).

**F6. Stat dictionary** (`DkhIkrTt.js`): 26 categories, 617 key slots. Notable keys for our model: separate physical and magical variants of nearly every attack and defense line; `fixingdamage` (Attack Bonus) apart from `weapondamage`/`weaponmindamage`; `criticaladddamage` (flat) vs `amplifycriticaldamage` (percent boost); `defensepierce` (Penetration); `bossnpcadddamage`, `bossnpcdefense`, `bossnpcamplifydamage`, `bossnpcdecreasedamage`; `additionalhitrate` (Multi-hit), `perfect`, `hardhit` (Double), `restoration`, `ironwall` and their `*resist`/`ignore*` partners; back/front-attack damage and defense; weapon-type damage ratios (sword, greatsword, dagger, bow, magicbook, mace, staff, orb, guarder, gauntlet); race damage lines (intellect, feral, nature, trans) and elemental lines (water, fire, wind, earth); 12 Conqueror deity stats (justice, freedom, illusion, life, time, light, destruction, death, wisdom, destiny, space, dark); PvP and PvE blocks (`pvpadddamage`, `abyssamplifydamage`, `abysspointbonus`); cooldown block with `castingtime`, `chargespeed`, `cooltimedecrease`, `cooltimeincrease`, `cooltimedecreaseratio`, `castingspeed`; and a **16-key `limit*` family** (`limitaccuracy`, `limitcritical`, `limitcriticalresist`, `limitevasion`, `limitweaponblock`, `limitshieldblock` and their physical/magic variants). The `limit*` keys are how the caps travel as data: our crit 50% and CDR 60% caps are not in the JS, they would be those stats. **[check]** three cooldown stats exist (their sheet showed "Cooldown Reduction 6.5%" and "Cooldown -7.9%" separately); confirm which one our single `cdr_pct` and the 60% cap map to. **[differs, known]** our `Stats` has 15 fields against about 600 keys; the missing lines that matter most for the 3x gap in section 3 remain boss/target defense, Damage Tolerance (`decreasedamage`), Multi-hit, Perfect, Amp ratios and the race and weapon-type lines.

**F7. Enhancement expected cost** (`BKsBVzER.js`, functions `se`/`ce`/`Z`/`Q`): each step has `successProb` (in 1/10,000), `failCorrectionProb` (probability added per consecutive failure), `failPenalty` (loses a level on failure), a gold cost and an item cost list. Expected attempts of one step with no penalty: `sum over r >= 0 of the product for k < r of (1 - min(1, (p + k*fc)/10000))`, summed until the term is below 1e-9 (cap 10,000 terms). A step with a penalty: `cost(L) = base/t + cost(L-1) * (1-t)/t` with `t = p/10000`, i.e. the standard drop-one-level recurrence. Range cost = sum of step costs over the chosen from/to levels; attempts, gold and each material are tracked separately. Four tracks per item: enhance, amplified enhance (exceed), potential (surpass), soul binding. Success colour: green at 6,000 or more, amber at 2,500 or more, red below. **Export has every input**: `Enchant` (23,181 rows, `SuccessProb`, `FailCorrectionProb`, `FailPenalty`, `CostGold`, `CostItems`), `ExceedEnchant` (13,920 rows; the first group reads 66 / 50 / 33 / 25 / 20% with +5 / +4 / +3 / +2 / +1% per failure), `ItemSurpass`, `ItemSoulAdd` (its first row is a `test_` group: 66% at 10,000,000 gold, so treat as unverified), `SoulBindCost`.

**F8. Per-item gear score** (`DWEne77Y.js`): `itemLevel + (item level bonus of the top enchant row) + 5 * (top exceed level)`. Max enhancement level = top enchant level + top exceed level. The account-level gear score and combat power are server values.

**F9. Class tier score** (`BY8Sv78V.js`, `CZ8bINzk.js`, `BR6Yv1S-.js`)
- Ranking contents and weights (metric, weight): Abyss (PvP, KDA, 1.2), Solo Arena (PvP, win rate, 1.0), Team Arena (PvP, win rate, 0.9), Nightmare (PvE, average score, 0.9), Transcendence (PvE, average score, 0.8), Subjugation (PvE, average score, 0.7), Awakening (PvE, average score, 0.7). Content type ids 1, 3, 4, 5, 6, 20, 21.
- The server returns, per content and class, a `relativeScore` (presumably 0-100, since the final score is clamped to that range) and a `playerCount`, plus a `consistencyModifier` per class. The browser computes: `score(class) = sum(relativeScore * weight) / sum(weight)` over contents where that class has players, times the consistency modifier for the Overall view only, clamped to 0-100. PvP view uses Abyss + both arenas, PvE view uses the four PvE contents, "by content" shows one content's relative score.
- Tier cut-offs: S at 80 or more, A at 60, B at 40, C at 20, otherwise D. This is how the Assassin 79, Gladiator 64 ... scores in section 1 were produced; the relative-score step (how a class's average KDA or win rate becomes 0-100) and the consistency modifier are server-side and not visible. Regions: tw, ko (NC) and naw, nae, eu, la, as (Global).
- Arena/Abyss rank icons come from NC's own CDN (Abyss soldier / officer / general / chief commander grades; Arena bronze to grandmaster plus three challenger grades), so the rank ladders come from the official ranking feed.

**F10. Timer schedules** (`0UAC9wTv.js`, `CQCCZyzj.js`; times are in the region's server zone: Global = UTC, Korea = Asia/Seoul, Taiwan = Asia/Taipei, Korea and Taiwan share one table)

| Event | Global (UTC) | NC (KST / CST) |
|---|---|---|
| Spacetime Rift | every 3 h from 00:00; event 60 min; portal open the first 10 min | every 3 h from 02:00, same lengths |
| Shugo Festival | hourly at :00, 10 min | same |
| Daily reset | 16:00 | 05:00 |
| Weekly reset | Wednesday 16:00 | Wednesday 05:00 |
| Watcher Kaira (Lower Reshanta, random spot) | every 3 h from 02:00 | every 4 h from 01:00 |
| Artifact Siege | Mon, Thu, Sat 21:00, 30 min | Wed, Sat 21:20, 30 min |
| Siege Bosses (Executors, Executioners) | same days 21:30, 30 min | same days 21:45, 30 min |
| Guardian Lord Nahma | Sun, Fri 19:00, 30 min | Sun, Fri 22:00, 30 min |

Boss ids they link: Watcher Kaira 2600089; Executor Tamasa 2600096, Argo 2600097, Kaira 2600098; Executioner Dramos 2600520; Turncoat Ducal 2600521; Ravager Marakha 2600522; Guardian Lord Nahma 2600084 and Enraged 2600479. Cross-check with our export (`EventSchedule`, 25 rows): the 22 Shugo-type field events run hourly at :00 every day, 11 per faction (JumpJump, SpecterEvasion, Racing, Masquerade, OdBubble, TreasureHunter, Defence, HighHigh, TrapBoard, Pang, Dilemma), which matches their Shugo hours and 11-game pool; the Artifact War row (`abyss_ar1_artifactwar`) is Mon, Thu, Sat 21:00, which matches their Global siege days and time. Two things the export shows and their timers page does not: a per-faction hourly **Invasion** field event at :30 every day (`Group_Light_Invasion`, `Group_Dark_Invasion`; what it is in play terms is not confirmed). Rift, Kaira and Nahma timing are not in `EventSchedule`; `RiftData` (16 rows) has map ids and level ranges only, so those three would still be copied from the public schedule. One internal conflict on their side: the checklist presets use a Tuesday 21:00 default reset and their Shugo preset says "every 15 minutes", while the timers say Wednesday 16:00 UTC and hourly; the preset text looks stale.

**F11. Checklist presets** (`CeUHmE9c.js`, default reset Tuesday 21:00; title, repeats, priority)
- Daily: Duty Missions x5 (high); Nightmare Boss x2 (high); Expedition: Conquest x3 (high); Transcendence x2 (high); Spacetime Rifts x6 (medium); Shugo Festival x2 (medium); Daily Dungeon Run x1 (high).
- Weekly: Command Missions x12 (high); Raid x3 (high); Daily Dungeons (Weekly) x7 (high; up to 10K Enhance Stones per entry); Ascension Trial x3 (high); Expedition: Exploration x7 (medium; 16:00 Vakron Sky Island, 22:00 Ferocious Horn Den); Abyss x7 (medium, 7 hours of PvP zone time); Sanctuary x1 (medium); Odyle Energy Morph x7 (medium); Craft Odyle Energy x7 (medium; costs Odyle 25, Fine Odyle 5, Pure Odyle 1, Kina 50,000); Command Duty Merchant x12 (medium); Wind Breeze purchases: Odyle Energy x7, Bio-Research Base Challenge Ticket x7, Resurrection Spiritstone x7 (low; 100,000 Kina each).
- These are community-written rows, not game data; our export has the real counters (`ContentsTicket`, `ContentsSweepTicket`, `DungeonPoint`) to check them against.

**F12. Crafting calculator** (`BtNuA0U5.js`): `crafts = ceil(wanted / outputPerCraft)`; `made = outputPerCraft * crafts`; `need(i) = max(qty(i) * crafts - owned(i), 0)`; `cost = sum(need(i) * unitPrice(i)) + goldCostPerCraft * crafts`; `costPerItem = cost / made`. Prices default to 0 until the user types them. Export has `CraftRecipe`, `CraftRecipeRate`, `CraftMastery` (100 levels with exp and bonus skill points), `GatherMastery`.

**F13. Other thresholds and limits worth knowing**
- Item level colour bands on profiles: 1000, 1500, 2000, 2500, 3000 (`VSrvGic6.js`).
- Percentile bands for logs: 99, 95, 75, 50, 25, 0 (`CRq_unAc.js`).
- Server load: full at players/capacity of 0.9 or more, busy at 0.7 or more (`C2Ap_K78.js`).
- Macros: 10 per skill build, step delay 0-10,000 ms integer (`DdOVHc8H.js`). Map route editor history: 50 steps (`BuhNTSe3.js`).
- Auction exchange constants: two chest items, ids 516140001 (2,000,000 kinah) and 516150001 (400,000 kinah), used with the per-server chest prices to derive kinah per Quna; ranges 24h, 7d, 30d, 90d, all (`Cud15gQF.js`).
- Account limits are feature flags from the server: `max-builds`, `max-character-builds`, `max-map-routes`, `max-map-route-features`, `max-description-character-limit`; the premium page names 100 builds per character.
- Class roles and weapons (`DXuJyqd1.js`): Gladiator melee greatsword; Templar tank sword; Assassin melee dagger; Ranger ranged bow; Sorcerer magic magicbook; Elementalist summoner orb; Cleric healer mace; Chanter support staff; Fighter melee gauntlet. Weapon slot types: sword, dagger, mace, greatsword, staff, bow, magicbook, orb, guarder (the off-hand), plus the gauntlet for Fighter.

### 6.4 API surface (names only, no keys or tokens; nothing was called)

Transport: tRPC over `/api/trpc` (core), `/api/core/trpc`, `/api/checklist/trpc`, `/api/map/trpc`; plain endpoints `/api/user-image` (image upload for outfits and builds), `/api/content-thumbnail`, `/api/crash-handler`, `/api/desktop-auth/code` (the loopback code exchange for the desktop app: the app opens the site with a `challenge` and `state`, the site returns a `code` to 127.0.0.1). Third parties: Tebex headless storefront for premium (`headless.tebex.io`, `pay.tebex.io`), NitroPay ads, Twitch and YouTube embeds, NC's CDN `assets.playnccdn.com/static-aion2-gamedata/resources/` (rank icons) and `profileimg.plaync.com` (character portraits). Game art, map tiles and the dressing-room models are on their own CDN.

Procedures found (188), grouped by router, which tells us what data they hold:
- `armory`: getCharacter, getLeaderboard, getLeaderboardSummary, getServers, getTrendingProfiles, refreshCharacter, search. (They query NC's official profile and ranking data, snapshot it, and serve it.)
- `armoryMeta`: getAbyssStats, getArenaStats, getClassDistribution, getClassPerformanceMatrix, getRaceDistribution, getServerDistribution, getTierList.
- `characterBuilder` (20): get/save/create/delete/copy character and builds, search, liked, plus data feeds getEquipmentItems, getEquipmentItemSets, getItemSubStatSkills, getTitles, getCharacterLevels, getMonolithLevels, getWings, getPets, getGenusInsightSlots, getSkinCollections, getPlayerStatSeconds. These eleven feeds are exactly the tables the stat engine needs.
- `statFormat.getStatFormat` (stat names, descriptions, "percent" indicators, per language), `dataTable` (getCharacterLevels, getLegionLevels, getMasteryLevels, getPetCollectionRewards, getRankingTiers, getUnlockRequirements).
- `database` (41): get/list for achievements, daeva passes, daevanion boards and nodes, dungeons, gatherables, items, item sets, NPCs, pets, quests, recipes, regions, skills, skins, status effects, supply requests, titles, wings; getClassSkills, getPopularItems, searchEntities.
- `skillBuilder` (8), `daevanionPlanner` (7), `classes` (getOverview, getShowcase, getSkillPicks, getTopGeared), `crafting.getRecipeData`.
- `dressingRoom` (11): catalog, look catalog, preview, resources, outfits CRUD, per-user and popular lists.
- `auctionHouse` (6): getServers, getItems, getItemMarket, getItemHistory, getListings, getExchangeRates. (A market feed exists; its source is not visible in the front end.)
- `combatLog` (25): catalog.dungeons; entities buffs/names/skills; rankings allStars/clears/compositions/dungeon/dungeonTops/kills/recentRuns; reports fight/latest/mine/profile/report/run; statistics boss/bossTimes/character/meta/overview; reprocess, deleteLog, updateVisibility.
- `map` (getMarkers, getRegions), `progress` (get/setProgress), `routes` (create/update/delete, my and public lists, upvote), `serverStatus.getServerStatus`, `checklist` (own router, procedures not enumerated), `comments` (create/update/delete/vote), `like` (set, getLikedTargets), `notifications`, `userSettings`, `profiles`, `partners` (addVideo, deleteVideo, getLivestreamStatus), `billing` (fillBasket, getMySubscriptions, cancelMySubscription), `content` (CMS: drafts, publish, lists), `app` (info, open), `shared` (state, set).

What this says about their data: item, skill, NPC, quest, recipe, node, title, wing, pet and skin databases (the same tables our export holds), a polled copy of the official character and ranking feeds, a server-status poll, an auction listings feed, and user-generated builds, routes, outfits, comments and logs. The only parts our export cannot supply are the official-feed parts (characters, rankings, server status, auction) and anything user-generated.

### 6.5 Updated ranked "features to add" (merges the section 5 list with what the code added)

"Export" = private client export `D:\Aion2-tools\export-test\out` (checked by table name, a few by row). "New" marks items the code revealed that section 5 did not have.

| # | Feature | Player value | Effort | Data already in export? |
|---|---|---|---|---|
| 1 | **Stat-sheet aggregator with per-source breakdown, then DPS calibration** (old #1). Build the F1 pipeline: base level stats, gear incl. enhance/amplify/potential rows, set bonuses, Daevanion, wings, titles, arcana, deity points, then the ratio pass. Use it as the engine's `Stats` source and show "where each number comes from" like their tooltip. Calibrate against a measured fight. | High: trust in every DPS number, and it fixes the structure gap in section 3 | L | Mostly. Yes: `PcStatLevel`, `PcStatSecond`, `Item`, `Enchant`, `ExceedEnchant`, `ItemSurpass`, `ItemSet`/`ItemSetEffect`, `Wing`/`WingEnchant`, `Title`, `Monolith`/`MonolithLevel`, `SkinCollection`, `ArcanaEnchant*`, `DaevanionNode`. Not found by name: pantheon, pets, genus insight. Not in client at all: defense curve, Damage Tolerance, boss stats. |
| 2 | **Enhancement / amplify / potential / soul-bind cost calculator** (New). Expected attempts, gold and materials between two levels, using the F7 recurrence; later feed it into "gear upgrades" so we can say cost per +1% DPS, which nobody else can. | High, and it plays to our engine | S-M | Yes: `Enchant`, `ExceedEnchant`, `ItemSurpass`, `ItemSoulAdd`, `SoulBindCost` (success, pity, penalty, gold, items per level). Quick check first: the `ItemSoulAdd` first row is a test group. |
| 3 | **Timers page and header strip** (old #4, now with exact schedules from F10). Add Invasion (:30 hourly) which their page misses. | High, cheap, daily return | S | Partly: `EventSchedule` gives Shugo (hourly, 11 games per faction), Invasion, Artifact War. Rift, Kaira, Nahma and the resets come from the public schedule (F10). Times are server time; Global is UTC. |
| 4 | **Global search (Ctrl K)** over skills, items, NPCs, quests, nodes (old #2) | High, unlocks 5 and 13 | M | Yes (items 9,245, skills, NPCs 13,493, quests) |
| 5 | **Item database plus gear viewer** (old #3 and #14): browse by slot, maxed-stat columns, pin and compare, item-set bonuses, per-item gear score (F8), upgrade tables from #2 on the item page | High | M-L | Yes: `Item`, `ItemSet`, `ItemSetEffect`, `ItemEquipSubstatSkill`, `Enchant*` |
| 6 | **Interactive map** (old #5, merge `codex/approved-map`), then progress tick-off, then shareable routes (their route editor is premium-gated and heavy; start with progress only) | High | M (branch exists) | Yes: `Map`, `WorldMapMapList`, `WorldMapUIRegion`, `NpcData`, `GatherSource` (spawn positions not checked) |
| 7 | **Checklist with presets and reset countdown, local storage, no account** (old #6; use the F11 list as a starting point, verify counts against the tickets tables) | Medium-High | S | Counters: `ContentsTicket`, `ContentsSweepTicket`, `DungeonPoint`; reset times from F10 |
| 8 | **Share-by-URL builds and armory "copy to builder"** (old #7). Their model: builds are plain JSON, a guest can keep one in the browser, sign-in is only for persistence; copy the idea, not the account system | Medium-High | M | Our own data |
| 9 | **Reference tables**: character levels (exp, skill, stigma and Daevanion points per level), unlock requirements, mastery levels, ranking tiers (old #10) | Medium, cheap SEO | S | `Exp`, `ContentsUnlock`, `CraftMastery`, `GatherMastery`, `SeasonRankingGrade` (442 rows). Legion levels and pet-collection rewards: no matching table found by name |
| 10 | **Crafting calculator with owned, price and per-item cost** (old #9; formula in F12, prices typed by the user, stored locally) | Medium | S | Yes: `CraftRecipe`, `CraftRecipeRate`, `CraftMastery` |
| 11 | Class page gear-usage shares and skill picks (old #8). Their shares come from all saved builds, ours would need our own crawl | Medium | M | Needs a character sample (we have `/board`) |
| 12 | Tier list and meta from official rankings (old #12). F9 shows the exact method: weighted content scores, cut-offs 80 / 60 / 40 / 20. Source is NC's ranking feed; check its terms first | Medium | M | No (external feed) |
| 13 | Skill, Daevanion-node and status-effect pages with cross-links (old #11); the 41 relation tables on their db pages are a good checklist of which links matter | Medium | M | Yes |
| 14 | Embeddable item/skill tooltips (`/embed/db/tooltip`) for guides and Discord posts (New) | Low-Medium | S-M after #5 | Yes |
| 15 | Server status (old #13) | Medium | M | No: live poll, needs a source, no-automation line applies |
| 16 | GS-bracket build library and community features (old #15); the code shows the cost: accounts, privacy flags, folders, tags, comments, likes, moderation | Medium | L | No |
| 17 | Dressing room and cosmetics (old #16); needs a three.js model pipeline | Low-Medium | L | Partial: `Skin*`, `CustomizingPreview*` tables; meshes are in the client but not decoded |
| 18 | Auction house price tracker (New) | Medium for traders | L | No: the data is a live market feed; their source is not visible |
| 19 | News, patch notes, guides, languages (old #17) | Low for now | M-L | No |
| - | Combat-log site and desktop DPS meter (New detail: theirs is packet capture through Npcap, uploads fights, ranks by percentile) | High value for them | XL | Not recommended: conflicts with our no-automation line, and they already own that lane |

**Suggested order after the code review:** 2 first (small, uses data we already hold, unique with our advisor), 3 and 7 together (the same schedule data), 1 in parallel because it protects credibility, then 4 plus 5 (database spine), then 6, 9, 10. Quick fixes found on the way: set the Korea core rank cap to 20 in `build_gamedata.py` (F4, unless an in-game source for 40 turns up); decide whether our `attack` input means weapon attack or weapon attack plus Attack Bonus (F1 step 5); check our arcana card sub-skill unlock table against F5.

**What changed in the ranking versus section 5:** the enhancement calculator is new at #2 because the code shows the exact method and the export holds every input; the stat aggregator moved up to #1 because it is the missing piece behind the 3x gap and their pipeline is now fully known; timers got more precise but stay cheap; the map and database moved down only because #1-#3 are smaller or more valuable per hour, not because they matter less.
