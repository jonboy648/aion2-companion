# Aion 2 community playstyles: what players actually build for (2026-10-04)

Question: which playstyles / content types do Aion 2 players build and optimize for, per class, and which are worth offering on a build-recommendation site? This note is about what the community does and says. What exists in the client is in `playstyles_gamedata_2026-10-04.md` (companion; its counts are reused, not repeated). Older context: `sorcerer_builds_and_dps.md`.

Dates: today is 2026-10-04. KR/TW live since 2025-11-19 (KR level cap 50 since 2026-07-01). Global Early Access since 2026-09-30, free launch 2026-10-05 13:00 UTC, cap 45, 8 classes (no Brawler).

## 0. Method, evidence tags, limits

Method: WebSearch and WebFetch, plus plain HTTP reads of public pages with a script (Inven, DC Inside, Bahamut, an Arca mirror of a patch note, YouTube result pages, public JSON of Atool and AionFlex, Reddit RSS). No logins, no circumvention. Not read: questlog.gg (Cloudflare block page), namu.wiki (403), 17173 (unreachable), Reddit beyond RSS (blocked; RSS also rate-limits).

Tags used below (everything untagged is either a quote from the cited page or a count I made from it, with the method in section 9):
- [METER] uploads from third-party DPS meters (small, biased sample: only people who run a meter).
- [SNIPPET] I saw only a search snippet or a model summary; treat as unverified.

Limits that change how to read the numbers:
- Board post numbers include deleted posts. YouTube sums are the top 12 relevance results of one query, dominated by 1-3 videos and by video age (many are launch-era). Neither is a census.
- Searches mix in Aion 1. Example: a Gamemeca article on mage stigmas and "fortress battles" returned for Aion 2 queries is dated 2010. Not used.
- SEO and gold-seller pages (noping, exitlag, u4n, mmoexp, aoeah, expcarry, vortexgaming) were not used as evidence.
- Inven's "NC AI tips board" posts that start "gameinfo from NCER" carry NC's own disclaimer that they are AI-generated and may differ from the game. I use them only for schedules and entry rules and flag them.

## 1. One-screen answer

Ranked list of playstyles worth offering (detail and evidence in section 7):

| Rank | Playstyle | Community evidence | At Global launch |
|---|---|---|---|
| 1 | Boss DPS in party PvE (dungeon bosses, raid bosses) | Very high. 79% of Global early-access meter uploads are "Normal" tier runs (Expedition Normal plus sealed dungeons), 89% of KR/TW uploads are Normal/Hard/Transcendence, 87% of Inven's party-finding titles recruit for Sanctuary raids, and sanctuary guide videos were the highest-viewed of the content queries I ran | Yes (6 Expeditions, 2 Transcendence, Ludra raid) |
| 2 | Solo timed boss (Nightmare, Ascension Trial) | High. Builds are named by clear time ("37 s build", "34 s guide", "29 s build"); about a third of Global early-access meter users already ran Nightmare | Yes |
| 3 | Leveling 1 to 45 | Highest short-term demand (everyone starts here on day one), almost no long-term demand | Yes |
| 4 | PvP preset (Abyss and open world, group fights) | Medium. PvE guide videos out-view PvP ones 1.5x to 6x per class (Spiritmaster excluded: one PvP-titled video), only about 5% of Inven simulator builds are PvP, but PvP builds differ most from PvE builds (accuracy, evasion, status resist, PvP stat lines) | Yes, optional (PvP flag off outside the Abyss) |
| 5 | Horde / AoE clear (Ascension Trial hordes, sealed dungeons, invasions, trash) | Low to medium. Appears as a "second preset" on English sites; Korean guides barely discuss it | Yes |
| 6 | 1v1 arena duel | Low to medium. Own evasion-heavy builds exist; Arena 5v5 is nearly dead in ranking data | Yes |
| skip / defer | Battleground (stats are equalised), Subjugation, Trials/Ordeal, Rift Domination (all absent at Global launch), world-boss builds (people want timers, not builds), fortress sieges (do not exist) | see sections 3.6 to 3.10 | mostly no |

Numbers worth remembering:
- Build sites split PvE vs PvP and almost nothing finer. Inven's Devanion simulator filters only by class and PvE/PvP; 570 of 591 Devanion posts and 390 of 419 skill-simulator posts are PvE (about 95%).
- The two real content-specific builds in the wild are the Nightmare speed build and the "trash preset"; both are one-off swaps on top of a PvE default, not full builds.
- Content-specific stat cutoffs (accuracy, crit, combat power) are what recruiters and guides use to gate content, more than skill choices (my reading of party-finding titles and guides).
- Players keep presets and swap per content (PvE/PvP, boss/trash, pet "understanding" preset 1/2, separate Arcana sets).
- Global early-access class mix of meter users: Ranger 19.5%, Assassin 14.1%, Gladiator 13.3%, Sorcerer 13.2%, Chanter 11.9%, Cleric 10.6%, Spiritmaster 9.4%, Templar 8.0% (skewed to DPS classes).

## 2. What exists: KR/TW versus Global launch (as NC and the community describe it)

Cross-check against the companion note's client data: no contradictions except the two flagged conflicts below, but the companion does not speak to every row (for example, which raids are live at launch comes from aion2maps and NC coverage).

| Content | KR/TW | Global launch (2026-10-05) |
|---|---|---|
| Expedition (원정) | 5 players since 2026-07-01 (was 4); Exploration (softened practice) and Conquest, Normal and Hard | 5 players; 6 Expeditions (Krao Cave, Urugugu Canyon, Fire Temple, Draupnir, Vakron Sky Island, Ferocious Horn Den); Exploration and Conquest Normal; no Hard, no Ordeal |
| Transcendence (초월) | 5 players; many families (Mirror of Scarlet Desire, Submerged Life Temple, Abyssal Horn Den, Noiran's Hidden Legacy and more) | Deus Research Base and Shattered Arkanis |
| Sanctuary raid (성역) | 10 players since 2026-07-01 (was 8); Corroded Decontamination Facility, Chalice of Muspel, Snowfield of Sorrow (Sanctuary 4, September 2026), Ludra | Ludra (Abyssal Forge: Ludra), run with 10 |
| Nightmare (악몽) | solo, 10 stages per boss, many bosses | solo, Season-1 bosses (Zikel's Apparition is the final) |
| Ascension Trial (각성전) | solo weekly time trial | yes, 4 difficulties (item level 1,000 / 1,500 / 2,000 / 2,500) |
| Trial (시련) / Ordeal | Vakron Sky Island (2026-07-15), Fire Temple (2026-09-23); 4 traits, steps 4 to 16 | not at launch |
| Subjugation (토벌) | yes | not at launch (ranking starts in season 2) |
| Sealed dungeons, strongholds, daily dungeon, invasions, Shugo Festa | yes | yes |
| Abyss | several layers; Artifact War; Abyss Corridor; Abyss Rift Zone (400 vs 400, 300 per side since 2026-07-15) | Lower Reshanta only; 7 h per week; PvP flag toggles everywhere except the Abyss |
| Spacetime Rift portals (every 3 h) | yes | yes |
| Rift Domination / Contest (쟁탈전, 25 to 500 per side) | yes (level 50, item level 4,500, combat power 500k) | not at launch (needs level 50, cap is 45) |
| Arena of Solitude 1v1, Arena of Cooperation | yes | yes (client says 5v5; a mein-mmo article and a search snippet say 4v4: conflict, client wins) |
| Battleground 10v10, stats equalised | yes ("equal conditions"; KR fixes Mastery 20 and Stigma 25) | yes (one snippet says 8v8: conflict, NC's stream and the client say 10v10) |
| Battle royale (100 players) | not found live | "coming later" (one article) |
| Abyss and field bosses | yes, scheduled | yes (5 Reshanta bosses) |
| Fortress siege (Aion 1 style) | no; closest is Artifact War (only an Abyss-point bonus) and KR-only Rift Domination | no |
| Classes | 9 (Brawler/권성 added 2026-07-01) | 8 |

URLs: https://www.inven.co.kr/board/aion2/6493/192 (NC 2026-06-30 preview: 5-player Expedition/Transcendence, 10-player Sanctuary, Brawler, equalised 점령전); https://aion2maps.com/guides/dungeons-and-raids/ and https://aion2maps.com/guides/pvp/ and https://aion2maps.com/guides/abyss/ and https://aion2maps.com/guides/arenas-and-battlegrounds/ (Global scope; Hard/Ordeal/Subjugation/Rift Domination absent); https://www.playnews.gg/en/news/aion-2-5-player-dungeons-10-player-raids-and-five-server-regions-what-the-global-livestream-announced and https://massivelyop.com/2026/08/08/aion-2-details-changes-for-party-sizes-activities-and-founders-pack-benefits-for-its-global-release/ (NC Aug 7 stream: 5 and 10 players, 10v10 equalised, PvP toggle); https://arca.live/b/aion2/176898369 (KR 2026-07-15 note: Trial steps 4 to 16, Abyss rift zone 300 per side); https://www.inven.co.kr/board/aion2/6493/248 (NC 2026-09-22 preview: Fire Temple Trial, 16 steps); https://www.inven.co.kr/board/aion2/6493/238 and https://www.inven.co.kr/board/aion2/6493/186 (Rift contest and Abyss Rift Zone rules; NC AI-generated disclaimer); https://aion2hub.com/tools/event-timer and https://aion2hub.com/tools/world-bosses (rift timing, Abyss bosses); https://mein-mmo.de/en/aion-2-endgame-what-can-pve-and-pvp-fans-expect-at-level-45,1583622/ (4-player coop arena claim, battle royale); https://aion2hub.com/builds (Brawler is KR/TW only); https://aion2t.com/guides and https://aionflex.gg/meta/patches (KR/TW transcendence families).

## 3. Content type by content type

Each block: exists, how players describe the optimal build, whether sites publish a separate build, and the discussion signal.

### 3.1 Solo leveling (1 to 45 on Global, 1 to 50 on KR/TW)

- Exists: yes. A 155k-view KR guide is titled "easy level 45 in 7 to 10 hours".
- Build as players describe it: not a gear build, a skill-point order per level. aion2maps gives a level-by-level plan per class (Sorcerer: Flame Arrow, Ice Chain, Firestorm first; Hellfire arrives at level 14; specialties at skill level 8; Stigma slots at levels 22, 27, 32, 37). "Skill and Stigma resets are free, so nothing is permanent." The DC Inside KR guide index lists a "level 1 to 50 leveling guide" in its common section.
- Separate build on sites: yes, as a tab or page. aion2maps has a Levelling tab per class; aion2hub has 10 leveling pages by faction and level band. Inven's simulators and the KR stat sites have none.
- Signal: YouTube leveling query 463k views across the top 12 (top: 155k, ten months old); English leveling query 307k. At Global early access, about 79% of meter uploads are Normal-tier runs (Expedition Normal plus sealed dungeons), i.e. new-45 activity.
- URLs: https://aion2maps.com/guides/sorcerer/ ; https://aion2hub.com/leveling ; https://gall.dcinside.com/mgallery/board/view/?id=aion2&no=2658391 ; https://youtu.be/6KYyd0IlGpY ; https://youtu.be/V1RSpwNnk2Q (Sorcerer leveling skill tree, 37k).

### 3.2 Field farming, AoE and solo mini-instances

- Exists: open-world hunting, sealed dungeons, strongholds, the Abyss Corridor (a 2-minute solo instance used for fast Abyss points), invasion events, daily dungeon waves.
- How players describe it: the KR newbie index treats the Abyss as optional and recommends only the corridor for quick Abyss points. KR field-farming interest is about income: "best hunting grounds TOP 7, 2M kina per day plus pet collection" (70k views, ten months old). English sites are the ones that build for it: games.gg has an "AoE farming build" (swap Delayed Explosion for Steel Barrier, Ice Chain as the pack skill, keep Flame Arrow's MP-recovery specialty) and aion2maps tells Sorcerers to "make a second skill preset for packs, with Ice Chain in the macro".
- Separate build on sites: only those two (games.gg Build selector; aion2maps trash preset). aion2hub, Inven simulators, Atool, cielui, NotMeter: no.
- Signal: low in KR (about 2% of 605 Sorcerer board titles are leveling/hunting; no pinned farming guide on any class board). YouTube field/AoE query 195k. Companion note: ordinary pulls are 1.4 to 1.9 mobs inside an AoE, so the "AoE build" is mostly a hotbar swap, not a stat build.
- URLs: https://games.gg/aion-2/guides/aion-2-sorcerer-guide/ ; https://aion2maps.com/guides/sorcerer/ ; https://youtu.be/X2D8lSvAv5w ; https://gall.dcinside.com/mgallery/board/view/?id=aion2&no=2666273 ; https://www.inven.co.kr/board/aion2/6453 (Sorcerer board).

### 3.3 Dungeons by party size (Expedition 5, Transcendence 5, daily dungeon)

- Exists: yes; Global launches with the 5-player version. KR/TW moved from 4 to 5 on 2026-07-01 per NC's own 2026-06-30 preview, although outlets reported NC's 2026-08-07 Global stream as a Global-versus-Korea difference.
- How players describe the optimal build: PvE DPS tuned to a cutoff. A KR guide says to find "the cutoff the season's content needs" for crit and accuracy and to check Atool for what your class does; NotMeter has a "boss resistance stats" page; aion2maps has a crit and accuracy planner; the earlier note lists Ludra about 1,500 accuracy / 1,600 crit, Corroded about 2,350 / 2,500, Muspel Hard about 2,800 / 3,150. Skill specialties are chosen per encounter type inside one build (Chanter guide: AoE specialty for trash, movement specialty for boss; games.gg: switch Hellfire and Bittercold Wind to mobile casting on mobile bosses).
- Role matters more than build in 5-player content: aion2hub labels builds by role (Templar PvE Tank, Cleric PvE Healer, Chanter PvE Support DPS, Sorcerer PvE Magic DPS). Party rules from aion2maps: take Templar or Gladiator, not both (their party buffs do not stack); Chanter plus Cleric is the ideal support pair; Chanter cannot be the healer in hard content (one source).
- Separate build on sites: all of them publish "PvE" as the default. Atool and cielui add per-dungeon tier lists.
- Signal [METER]: AionFlex KR/TW (2026-07-13 to 2026-09-28, 75,894 uploads): Normal 34,092, Hard 17,331, Transcendence 15,930, Sanctuary 3,049, Ascension Trial 1,794, Exploration 1,634, Nightmare 1,246, other 572, Ordeal 235. AionFlex Global early access (2026-09-30 to 10-04, about 157k uploads, 3,300 uploaders): Normal 124,385 (3,109 uploaders), Exploration 18,866 (2,008), Transcendence 5,760 (628), Nightmare 5,380 (1,207), Ascension Trial 2,488 (695), Sanctuary and Hard 0 (not yet reachable). YouTube: Transcendence query 779k, Expedition query 499k. Inven dungeon-guide category has about 189 posts (top: 52k views for a "Transcendence 1 to 10 summary").
- URLs: https://aionflex.gg/meta/patches?content=normal (and ?content=hard, grade, sanctuary, challenge, trial, exploration; add region=Global) ; https://aion2maps.com/guides/classes/ ; https://aion2hub.com/builds ; https://notmeter.com/ ; https://www.inven.co.kr/board/aion2/6444?category=%EB%8D%98%EC%A0%84 ; https://www.inven.co.kr/board/aion2/6451/116 (Chanter guide) ; https://gall.dcinside.com/mgallery/board/view/?id=aion2&no=2666273 .

### 3.4 Raids (Sanctuary, 10 players)

- Exists: yes. Global launch raid is Ludra; KR/TW also has Corroded Decontamination Facility, Chalice of Muspel and the Snowfield of Sorrow.
- How players describe it: composition and cutoffs, not skill trees. Party-finding titles state class and combat power ("Snowfield Hard, Templar 965, Cleric 970, looking for a fixed group"); an AI-generated summary of NC's 2026-08-07 stream says a 10-player raid with too many damage dealers fails the mechanics and that Clerics carry the second group; aion2maps says Abyss groups "demanded all four buffing classes". Sorcerer-specific: a Sorcerer-view Snowfield 4 video on "order timing" (title only; my reading: when to spend cooldowns on the raid leader's call).
- Separate build on sites: AionFlex has Boss Rankings for "Sanctuaries 10-man" and a Party Comps page by instance; NotMeter has boss charts; aion2maps has role-by-role walk-throughs (Ludra). No site publishes a "raid build" distinct from the PvE build except for stat targets.
- Signal: Inven party-finding board (300 titles, 2026-09-13 to 10-03) is 87% Sanctuary recruiting: 39% "fixed group", 9% "trial/progression", 7% "bus (carry)". Class words in those titles: Chanter 59, Cleric 56, ranged/magic DPS 50, Templar 28, Gladiator 14, Ranger 11, Assassin 9, Spiritmaster 5, Brawler 2 (keyword counts). YouTube Sanctuary query: 1,185,792 views across the top 12, the largest of any content type I queried (top: 272k, three weeks old). Inven Sanctuary-guide category: about 111 posts (top: 72k views, Chalice of Muspel).
- URLs: https://www.inven.co.kr/board/aion2/6467 ; https://www.inven.co.kr/board/aion2/6444?category=%EC%84%B1%EC%97%AD ; https://aionflex.gg/meta/comps ; https://aion2maps.com/guides/ludra/ ; https://youtu.be/iuVFyHR8r78 ; https://youtu.be/xgb1Iyk9KQc (Sorcerer order timing) ; https://youtu.be/bT0shr2kILY (Cleric care) ; https://videohighlight.com/v/K7V1lM3tvco (AI summary of NC's Aug 7 stream, [SNIPPET]) .

### 3.5 Solo timed bosses (Nightmare, Ascension Trial, Trial, Subjugation)

- Exists: Nightmare and Ascension Trial at Global launch; Trial/Ordeal and Subjugation only on KR/TW.
- How players describe the optimal build: Nightmare builds are named by their target clear time, which is the clearest "content-specific build" in the data: "Sorcerer PvE latest guide, Nightmare 37 s build included" (chapter "Nightmare 30s-range build", 60k views), pinned Gladiator thread "Nightmare 34 s guide - 2" (tagged for "내절캔" users, a cancel technique), pinned Spiritmaster thread "Nightmare Ateron 29 s build", and a Taiwanese Sorcerer guide: "new Nightmare L1 about 20 to 25 s". aion2maps adds a Global counterpoint for the Season-1 final (Zikel's Apparition): lifesteal and sustain matter more than burst, and stagger it with your big skills. Ascension Trial (+30% Damage Boost "Wrath", death limits 5/3/2/2) is discussed as hordes plus boss; Trial 16 steps shows up as clear videos and mechanics walkthroughs ("Fire Temple Trial 16 steps, Sorcerer view", 63k; "Trial complete walkthrough", 90k).
- Separate build on sites: Atool publishes tier lists for Nightmare, Transcendence, Awakening (각성전) and Subjugation; AionFlex has "Nightmare solo" and "Ascension Trial solo" boss rankings; nobody publishes a standalone "Nightmare build" page, it lives in creator videos and pinned class-board posts.
- Signal [METER]: Global early access, Nightmare is only 3.4% of uploads but has 1,207 uploaders (third after Normal and Exploration) because tickets are limited (2 per day, 14 stored). YouTube: Nightmare 400k and Ascension 321k (same top video, 101k, two months old), Trial 276k (top 90k, eight days old), Subjugation 261k (top 78k, ten months old).
- URLs: https://youtu.be/UI3kVaxno6E ; https://www.inven.co.kr/board/aion2/6448 (Gladiator board, pinned 34 s guide) ; https://www.inven.co.kr/board/aion2/6454 (Spiritmaster board, pinned 29 s build) ; https://forum.gamer.com.tw/C.php?bsn=82913&snA=3831 ; https://aion2maps.com/guides/nightmare/ ; https://aion2tool.com/tier ; https://aionflex.gg/ ; https://youtu.be/Ymjc6U7e1gA ; https://youtu.be/q2BT2tVsZDA ; https://youtu.be/lOw1ZCxSd-4 .

### 3.6 World and field bosses

- Exists: scheduled Abyss bosses (Global list: Watcher Kaira every 3 h from 01:00 server time; Executors Argo, Kaira, Tamasa on Mon, Thu, Sat 21:30; Abyss Siege Boss on Fri and Sun 21:00) plus unscheduled named zone bosses. The companion note finds no enrage and no stagger on them.
- How players treat it: as a timing problem, not a build problem. Three tools exist for timers (aion2hub, NotMeter field-boss tracker, interactivemap.app). Contribution rewards are ranked within your own class, which is why groups want all four buffing classes (aion2maps). No separate build found.
- Separate build on sites: none.
- Signal: low for builds, high for timers.
- URLs: https://aion2hub.com/tools/world-bosses ; https://notmeter.com/ ; https://aion2maps.com/guides/abyss/ ; https://www.reddit.com/r/Aion2/comments/1wh1y5x/aion_2_interactive_map_database_full_rundown/ .

### 3.7 Abyss PvP and PvPvE

- Exists: yes. Global opens Lower Reshanta only, gated at item level 1,000, with a 7-hour weekly time ticket (a Twitch creator's summary says 14 hours: probably with membership or items, unverified). PvP is optional elsewhere (flag toggle), forced only in the Abyss. NC reportedly says the assumption that KR players prefer PvP no longer holds (the trend is reversing) and PvP stays optional in the global design (WccfTech interview, as relayed by MassivelyOP and MMOHuts).
- How players describe the optimal build, Sorcerer example (KR, certified pinned thread, updated 2026-09-22): choose the PvP direction first (Abyss and Rift, arenas, solo, party); two schools, "attack/accuracy/crit plus skills" versus "accuracy plus evasion" (the post says NC announced an evasion-set nerf around February 2026, so it advises accuracy plus crit-resist and status resist instead of new evasion sets); tier-1 Stigmas Element Enhancement, Frost Armor (level 20 is "the bread and butter"), Assault Bombardment, Steel Barrier; accuracy at least about 2,500 including PvP lines; status resist 120 to 130 or more; separate Arcana sets for PvE and PvP. Global English equivalent (aion2maps PvP preset): Stigmas Element Enhancement, Steel Barrier, Arctic Armor, Hibernation; raise Revitalization Contract, Grace of Resistance and Absorb Essence; Fierce Battle Amulet; Status Effect Resist on every armor piece. A Taiwanese Sorcerer: "no time to loop a rotation in PvP, I run level-20 Flame Arrow, Flame Spear, Concentration for one burst" and "unless you out-gear them you cannot win". A TW player on Reddit: "PvE stacks attack, PvP gear is all defense stacking".
- Separate build on sites: yes, as a binary. aion2hub (8 PvP template builds), aion2maps (PvP preset tab per class), cielui (PVE/PVP toggle), Atool (PvP setting tab since 2026-06-21, engraving usage by slot among top PvP rankers), Inven Devanion simulator (PvE/PvP filter). Nobody splits Abyss from open world from arena.
- Signal: Inven PVP board 15,612 posts, about 59 per day over 30 days; Abyss words in 11% of 520 recent titles, class-balance talk 7%, gear and stats 5%, server matching 5%. Sorcerer words appear in 37 of 520 titles, the most of any class (keyword count). YouTube Abyss PvP query 572k (top 78k, nine months old); Sorcerer PvP-titled videos total 63k versus 384k PvE-titled. Attitude is mixed: a thread titled "no real reason to do Abyss PvP" in DC's streamer-fan gallery, a KR Templar on Reddit "much more into PvP than PvE", another KR/TW player "heavily PvE-focused with very shallow PvP". The DC newbie guide calls the Abyss "content you do not strictly have to do" except the corridor for quick points.
- URLs: https://www.inven.co.kr/board/aion2/6453/2763 ; https://www.inven.co.kr/board/aion2/6492 ; https://aion2maps.com/guides/sorcerer/ ; https://aion2maps.com/guides/pvp/ ; https://forum.gamer.com.tw/C.php?bsn=82913&snA=2871 ; https://www.reddit.com/r/Aion2/comments/1swrv18/advice_to_global_server_players_aion_2_pvp_is/ ; https://www.reddit.com/r/Aion2/comments/1sx2cky/a_real_take_from_a_kr_player_6_months_of_aion_2/ ; https://www.reddit.com/r/Aion2/comments/1suaqqb/aion_2_honest_experience_kr_tw_and_for_euna/ ; https://mmohuts.com/news/aion-2-global-launch-will-keep-korean-qol-changes-but-wont-include-a-year-of-later-content ; https://massivelyop.com/2026/09/08/aion-2-confirms-time-delayed-content-from-the-korean-launch-and-a-lack-of-crossplay/ ; https://gall.dcinside.com/mgallery/board/view/?id=aion2bj&no=91309 ; https://youtu.be/X7lzbgZpk28 ; https://youtu.be/C3cA6CxESNc .

### 3.8 Rifts (three different things share the word)

- Spacetime Rift portals: open every 3 hours; they let a faction cross into the other faction's continent. Clearing the other side's sealed dungeons pays enhance stones, Abyss points and kina (aion2maps). Exists on Global.
- Spacetime Rift Domination / Contest (쟁탈전): KR/TW RvR, Mon/Thu/Sat 20:00 and 23:00, 25 to 500 players per side, level 50. Players fight "solo" (솔쟁) or "party" (팟쟁) skirmishes inside it; rewards rank by class contribution; a standardised PvP mode applies. Not on Global at launch.
- Abyss Rift Zone: KR/TW server-versus-server field-boss contest, Tue/Thu 22:00, 300 per side since 2026-07-15.
- Builds: no separate rift build; the PvP preset is used. Players ask for more of it ("make Rift PvP always on").
- Signal: Rift words are 2% of recent Inven PVP titles; YouTube rift-contest query 101k total (median 6.7k).
- URLs: https://aion2hub.com/tools/event-timer ; https://www.inven.co.kr/board/aion2/6493/238 (AI-generated disclaimer) ; https://www.inven.co.kr/board/aion2/6493/186 (same) ; https://www.inven.co.kr/board/aion2/6492 ; https://aion2maps.com/guides/what-to-do-at-45/ .

### 3.9 Arenas and battlegrounds

- Exists: Arena of Solitude 1v1, Arena of Cooperation (5v5 per client, 4v4 per one article), Battleground 10v10 with equalised gear and skills (KR fixes Mastery 20 and Stigma 25).
- How players describe it: 1v1 has its own builds ("extreme evasion set for Solitude" in the Sorcerer PvP thread; arena gear is not equalised, per aion2maps). The battleground is described as a skill contest where gear does not matter, so there is nothing to build except a hotbar.
- Separate build on sites: Atool tiers Solitude and Cooperation arena separately (the Solitude rating scale sits near 1,500; the Cooperation sample is nearly empty, 1 to 14 characters per class); AionFlex has a PvP leaderboard (beta). No site publishes a duel build or a battleground build.
- Signal: Inven PVP titles: arenas 1%, battleground 1%. YouTube: 1v1 arena query 249k (mixed with non-arena videos), Cooperation 92k, battleground 121k.
- URLs: https://aion2tool.com/tier ; https://aion2maps.com/guides/arenas-and-battlegrounds/ ; https://www.inven.co.kr/board/aion2/6453/2763 ; https://www.inven.co.kr/board/aion2/6493/192 ; https://youtu.be/fu6IP3SDEAs ; https://youtu.be/2aw8mrx5cbM .

### 3.10 Fortress sieges

- Do not exist in Aion 2 the way they did in Aion 1. The in-game "Stronghold" is PvE garrisons; the faction-versus-faction occupation content is the Artifact War, which only adds an Abyss-point bonus (companion note). KR-only Rift Domination is the stronghold-style PvP.
- Community interest is at server level, not build level: Atool tracks artifact occupation by server matching; YouTube artifact-war query totals 28.5k views across the top 12.
- Warning: searches for Aion 2 "fortress battle" surface Aion 1 articles from 2010.
- URLs: https://aion2tool.com/ ; https://aion2maps.com/guides/abyss/ ; https://www.gamemeca.com/view.php?gid=232988 (an example of the Aion 1 contamination, dated 2010-11-08).

### 3.11 Cross-cutting playstyles that are not a content type

- Spec-up and gear progression is where the biggest guide audiences are. Inven spec-up category (about 200 posts) top views: pet soul sources 624k, soul-engraving priority by slot 229k and 228k, "combat power to 1,600" 133k. YouTube spec-up query 758k, alt/jump-character query 368k. Atool added a "spec-up order" tab (2026-06-25) that ranks upgrades by score gain; aion2maps has a progression ladder keyed to item level. Reddit's top posts of the last month are cosmetics, cash-shop disputes and "roadmap at 45" checklists rather than class builds.
- Presets: players keep at least two. In-game skill presets keep their own skill and Stigma levels (aion2maps); KR players keep separate PvE and PvP Arcana sets and two pet "understanding" presets (one rough, one max-roll) and swap them per content (a creator chapter literally titled "preset switching tips").
- In-game macro and cycle optimisation is a large side topic (pinned "macro setup" and "cycle" threads on most KR class boards, "one-key Sorcerer guide"). Outside the project's no-automation line unless limited to the in-game macro the game provides.
- DPS verification: KR players benchmark on the training dummy ("40 hours on the dummy" in the Sorcerer DPS thread) and on a 1-minute class DPS test (NotMeter, cited on Reddit). Third-party meters exist (AionFlex, NotMeter, cielui, Abyss Logs); a Taiwanese author says he uses one "with the resolve to get locked" and does not recommend it, and a Reddit poster counts 130+ ban waves in each of KR and TW (unverified). Not a recommendation, just why numbers on sites are meter-sourced.
- Combat power (the in-game number) is used as a gate in recruiting and in some content entry rules (the Rift contest needs 500k). The earlier note says it is a ranking number, not DPS.
- URLs: https://www.inven.co.kr/board/aion2/6444?category=%EC%8A%A4%ED%8E%99%EC%97%85 ; https://aion2tool.com/ (spec-up order tab) ; https://aion2maps.com/guides/what-to-do-at-45/ ; https://youtu.be/LgGFh024BFY ; https://youtu.be/t7mYv9bFN5E ; https://youtu.be/TEttCMYHPhQ ; https://www.inven.co.kr/board/aion2/6453/16644 ; https://www.reddit.com/r/Aion2/comments/1wlvweo/clearing_some_class_balance_misconceptions/ ; https://www.reddit.com/r/Aion2/comments/1wwh5a3/i_want_to_address_the_past_present_and_future/ ; https://forum.gamer.com.tw/C.php?bsn=82913&snA=3831 .

## 4. How build sites present recommendations

| Site (region) | Unit of recommendation | PvE/PvP split | Finer split | Role split | Notes |
|---|---|---|---|---|---|
| Inven skill + Devanion simulators (KR, user-posted) | user posts with class, PvE/PvP tag, free text | yes, filter | none | none | 611 Devanion posts (570 PvE / 21 PvP of 591 read) and 419 skill-sim posts (390 / 29), many titled "personal save"; character import; Devanion sim shows a translucent suggested route |
| Inven class boards (KR) | pinned "certified" guides per class | by thread | content words in titles (Nightmare 29/34 s, Snowfield) | none | mostly PvE DPS, macros, cycles; a pinned PvP guide was seen only on the Sorcerer board |
| Atool (KR/TW/Global) | rank-1-to-100 usage statistics per class; tier lists | yes: skills default to "PvE setting" (characters wearing a PvP title are excluded), PvP-setting tab for engravings | tier lists for 7 contents (Abyss, Solitude, Cooperation; Nightmare, Transcendence, Awakening, Subjugation) and by combat-power bracket; spec-up order | none | data-driven; contents ranking frozen because NC stopped publishing rankings |
| cielui / AION2CAL (KR) | auto-generated class guides from top-ranker usage | yes: PVE and PVP tabs, wings PVE/PVP, item DB PvE/PvP filter | per-dungeon tier lists (10 tiers) | none | own DPS meter |
| NotMeter (KR/TW/Global) | top-20 ranker loadout per class, refreshed every 6 hours | PvE only (loadouts) | boss charts, boss resistance stats, 1-minute class DPS test | none | stat-efficiency calculator |
| AionFlex (EN/KR/TW) | meter leaderboards, class meta by combat-power band, party comps | PvP leaderboard in beta | content filters: Normal, Hard, Transcendence, Sanctuary, Nightmare, Ascension Trial, Ordeal, Exploration | party comps by instance | uploads are meter users only |
| aion2hub (EN) | community builds and 16 template builds | yes: every class has "PvE ..." and "PvP ..." | no | yes: names carry the role (Tank, Healer, Support DPS, Bruiser, Kite, Control, Burst) | labelled Global versus KR/TW data; build planner with gear, Arcana, pets, skills, stats |
| aion2maps (EN, Global) | per-class page: Overview, Build, Macro, Stats and gear, PvP, Levelling | yes: PvP preset tab | trash preset (mentioned), levelling plan | role in class table | every claim tagged Datamine / Asian release / Creator advice / Conflicting |
| games.gg (EN, Global) | per-class guide with a "build selector: which setup fits your content" | yes | PvE boss DPS, AoE farming, arena, Abyss group PvP | none | macro templates per content |
| aion2t.com / aion2.app (EN) | Skills Builder with hotbar and macros, Daevanion optimiser | no tags | none | none | import from leaderboard characters; guides are dungeon walkthroughs |
| questlog.gg (EN) | Character Builder (user builds), Daevanion and skill planners | not verified (page blocked) | not verified | not verified | class popularity from builder entries was posted on Reddit |
| Creators (YouTube) | one video per class and mode | separate PvE and PvP videos | chapters: gear tuning, Arcana, skills/Stigma, macro, pet understanding, "Nightmare build", "Snowfield live" | per class | PvE videos dominate views |

Patterns:
- The only axis every site shares is PvE versus PvP. Everything finer is rare and mostly lives in creator videos or one-off swaps.
- The role axis exists only where one site names it (aion2hub) or where the class is one role anyway.
- KR sites generate "recommended" settings from what top players actually wear (Atool, cielui, NotMeter); EN sites hand-write a default and one or two swaps. A recommendation site that offers PvE, PvP, and a small number of content swaps matches both.
- Sites label which client the numbers come from (Global versus Asian release); that label is a trust feature worth copying.
- URLs: https://aion2.inven.co.kr/db/daevanion/ ; https://aion2.inven.co.kr/db/skillsimulator/ ; https://www.inven.co.kr/board/aion2/6388/20676 ; https://aion2tool.com/tier ; https://aion2tool.com/statistics/jobstats ; https://cielui.com/ ; https://notmeter.com/ ; https://aionflex.gg/ ; https://aion2hub.com/builds ; https://aion2maps.com/guides/sorcerer/ ; https://games.gg/aion-2/guides/aion-2-sorcerer-guide/ ; https://aion2t.com/simulator ; https://aion2.app/ ; https://www.reddit.com/r/Aion2/comments/1w1cebg/class_builder_sites_reveal_popularity_of_each/ ; https://aion2maps.com/guides/useful-sites/ (lists questlog, aion2.dev, cielui, NotMeter, AionFlex and creators).

## 5. Per class

Role labels follow NC and aion2maps (Gladiator and Templar tanks, Assassin, Ranger, Spiritmaster, Sorcerer damage, Cleric healer, Chanter support). All numbers are rough signals, see section 0.

| Class (KR) | What players build it for | Inven board posts total / per day (30 d) | YouTube PvE-titled vs PvP-titled views (ratio) | Atool content-score rank of 8 (Abyss, 1v1, Nightmare, Transc., Ascension, Subj.) | Global early-access meter-user share |
|---|---|---|---|---|---|
| Gladiator (검성) | tank and party buffer, PvE DPS "uppercut 100 hits" high-score builds, Nightmare 34 s with the cancel technique, 1v1 and PvP bruiser | 32,556 / 35 | 101k vs 47k (2.2x) | 3, 1, 1, 2, 1, 1 | 13.3% |
| Templar (수호성) | main tank (effective-HP and block-efficiency threads), a pinned "highest DPS cycle" thread; Sorcerers say avoid it in the Abyss | 27,417 / 53 | 110k vs 75k (1.5x) | 5, 2, 5, 5, 4, 6 | 8.0% |
| Assassin (살성) | crit and back-attack PvE DPS, stealth burst PvP and 1v1, attack-speed-cap experiments | 24,375 / 84 | 323k vs 146k (2.2x) | 1, 3, 7, 4, 3, 7 | 14.1% |
| Ranger (궁성) | sustained ranged PvE DPS (pinned threads on macros, hit counts, an Arcana setup titled "집눈+결의 total 70"); most entries on questlog's builder | 20,169 / 25 | 451k vs 172k (2.6x) | 2, 5, 3, 1, 2, 4 | 19.5% |
| Sorcerer (마도성) | burst and AoE ranged DPS: Nightmare speed builds, dummy-tested "DPS high score", cooldown ("Illusion") builds; PvP is a thin but real sub-community | 17,612 / 22 | 384k vs 63k (6.1x) | 7, 4, 6, 6, 6, 5 | 13.2% |
| Spiritmaster (정령성) | summon DPS; "strongest solo class" and "D tier" both claimed by different creators; pinned Nightmare 29 s build | 10,443 / 12 | 101k vs 8k (one PvP-titled video, ratio meaningless) | 8, 8, 8, 8, 8, 8 | 9.4% |
| Cleric (치유성) | the raid healer; "care versus damage" threads, Sanctuary care walkthroughs; the most PvP-balanced class on YouTube, tied with Templar | 29,361 / 23 | 129k vs 87k (1.5x) | 4, 7, 2, 3, 7, 3 | 10.6% |
| Chanter (호법성) | support-hybrid: buffs plus damage; the single most-viewed pinned class thread (PvE guide, 329k views, 186 comments); debate "care Stigma tree versus sub-dealer Stigma tree" | 23,294 / 28 | 207k vs 37k (5.6x) | 6, 6, 4, 7, 5, 2 | 11.9% |
| Brawler (권성), KR/TW only | new 2026-07-01; macro-heavy PvE all-in-one guides ("ascension hit 20", dash separation) | 3,774 (since July) / 22 | 118k vs 20k (5.9x) | not in Atool's tier list | n/a on Global |

Notes: the Atool ranks are medians of content score (not adjusted for combat power) for the top 100 players per content on the top 8 servers, snapshot 2026-07-21 (Subjugation 2026-04-07); Cooperation arena is omitted because it has 1 to 14 characters per class. Meter-user share is skewed to damage classes (AionFlex says so); on KR/TW all-time it is Cleric 24.1% and Spiritmaster 24.1%, a reminder that meter samples are not populations.

URLs: https://www.inven.co.kr/board/aion2/6448 (Gladiator), /6438 (Templar), /6449 (Assassin), /6450 (Ranger), /6453 (Sorcerer), /6454 (Spiritmaster), /6452 (Cleric), /6451 (Chanter), /6544 (Brawler), all under https://www.inven.co.kr/board/aion2/ ; https://www.inven.co.kr/board/aion2/6451/116 (Chanter guide) ; https://www.inven.co.kr/board/aion2/6451/20266 (care versus sub-dealer Stigma tree) ; https://aion2tool.com/api/tier/stats?content_type=abyss (also solo_arena, nightmare, transcendence, awakening, subjugation, coop_arena) ; https://aionflex.gg/meta/patches?region=Global ; https://aion2maps.com/guides/classes/ ; https://www.reddit.com/r/Aion2/comments/1wi2z6i/spiritmaster_is_s_tier_strongest_solo_class_and_d/ ; https://www.reddit.com/r/Aion2/comments/1w1cebg/class_builder_sites_reveal_popularity_of_each/ ; YouTube examples: https://youtu.be/nrCsW9hOWJA (Gladiator), https://youtu.be/bKxpSEcxiA8 (Assassin), https://youtu.be/ouYm4pZ-8d0 (Ranger), https://youtu.be/2cseIM0NUjY (Spiritmaster), https://youtu.be/Np863ukmgus (Cleric), https://youtu.be/PMQNCkPQaio (Chanter), https://youtu.be/BJcscAr3S0E (Brawler).

### 5.1 Sorcerer in more detail (the app's main class)

- Board: 17,612 posts total, about 22 per day lately. Keyword shares of 605 titles (2026-09-02 to 10-03): DPS, cycle, high score, hit count 10%; Arcana, Stigma, Devanion, "understanding" 8%; PvP 7%; Sanctuary 6%; macros 5%; gear and setup 5%; leveling and newbie 2%; Abyss, rift, arena about 1%; Nightmare 0.5%. Pinned: the PvP thread (32.7k views, updated 2026-09-22), "DPS high-score Arcana and macro" (26.4k views, 92 comments), a mobile 1,000-hit macro thread.
- Builds that have names: a cooldown-driven "Illusion" build whose value comes from extra hits of summon-type damage (Fire Wall, Bittercold Wind, Hellfire's fire zone) at cooldown breakpoints (Taiwanese advanced guide: target line attack 6,000, accuracy 1,200, crit 1,500, cooldown reduction 28.8%, damage amplification 75%, combat speed 60%, Smite 30%); "level-20 skill count 4 to 6 plus Robe of Flame 35 or 36" Arcana tuning (KR); damage ranking Fire Wall, Flame Explosion, Bittercold Wind, Flame Arrow (Taiwan); PvP accuracy-plus-crit versus evasion; the Nightmare 30 s build.
- Presets players swap: "Smite understanding", "전피증 understanding" (my reading: all-damage amplification) and a PvP "extreme accuracy" understanding preset (creator chapter list), separate PvE and PvP Arcana.
- Global English guides center on one boss rotation (Element Enhancement and Delayed Explosion before a full-charge Hellfire; Fire Wall and Cold Storm under a stationary boss; three held keys) plus a trash preset and a PvP preset.
- Where the Sorcerer sits: mid to low on Atool in every content (6 of 8 in Nightmare, Transcendence and Ascension; 7 of 8 in the Abyss; 4 of 8 in 1v1 rating), the PvE-to-PvP view ratio is the highest of the classic classes (6.1x), and on Global early access it is the fourth most common meter-user class (13.2%).
- URLs: https://www.inven.co.kr/board/aion2/6453 ; https://www.inven.co.kr/board/aion2/6453/2763 ; https://www.inven.co.kr/board/aion2/6453/16644 ; https://forum.gamer.com.tw/C.php?bsn=82913&snA=3831 ; https://youtu.be/opJgI1X7EnM ; https://youtu.be/UI3kVaxno6E ; https://youtu.be/TEttCMYHPhQ ; https://youtu.be/X7lzbgZpk28 ; https://aion2maps.com/guides/sorcerer/ ; https://games.gg/aion-2/guides/aion-2-sorcerer-guide/ .

## 6. Discussion volume at a glance

KR (Inven board totals, all since launch unless noted): class boards 189,001 posts combined; PVP board 15,612 (59 per day lately); party finding 11,984 (27 per day); balance debate 9,782 (36 per day, since late June); tips and know-how 2,332 with guide categories of about 189 dungeon, 111 Sanctuary, 200 spec-up posts; free board 278,765. DC Inside's Aion 2 gallery issued about 3,830 post numbers per day between 2026-07-05 and 10-05 (about 3.0M numbers in total, deleted posts included); its curated newbie index lists only PvE class guides. Bahamut's AION2 board has about 6,250 threads. Against the average since launch (319 days; boards may have opened a little earlier), class boards now run at about 25% to 60% (Gladiator 35 per day versus about 102; Sorcerer 22 versus 55; Cleric 23 versus 92), Assassin is the exception at about 110% (84 versus 76), and the PVP board runs above its average (59 versus about 49). Rates are estimated from page order and dates, so treat them as rough.

YouTube (sum of views over the top 12 results of one query, thousands; Korean unless marked EN):

| Content or topic | Views (k) | Note |
|---|---|---|
| Sanctuary (Snowfield of Sorrow) | 1,186 | top video 272k, three weeks old |
| Transcendence | 779 | top 129k |
| Spec-up and gear progression | 758 | top 176k, ten months old |
| Abyss PvP guide | 572 | top 78k, nine months old |
| Expedition (Conquest) | 499 | top 152k |
| Leveling 1 to 50 | 463 | top 155k, ten months old |
| Nightmare | 400 | top 101k |
| Alt / jump character | 368 | top 55k |
| Ascension Trial | 321 | same top video as Nightmare |
| Trial (Fire Temple, 16 steps) | 276 | top 90k, eight days old |
| Subjugation | 261 | top 78k, ten months old |
| 1v1 arena | 249 | mixed with non-arena videos |
| Field and AoE farming | 195 | top 70k, ten months old |
| Battleground | 121 | |
| Rift contest | 101 | median 6.7k |
| Cooperation arena | 92 | |
| Artifact war | 29 | |
| EN: class tier lists | 872 | one 346k video |
| EN: Sorcerer build | 594 | same 346k video |
| EN: leveling | 307 | |
| EN: PvP | 254 | |
| EN: Ludra raid | 73 | old videos |
| EN: expedition dungeon | 47 | |

Caution: one Korean creator tops six of these queries with encounter-mechanics videos, so these sums measure interest in a content type, not interest in optimizing builds for it. Build interest shows up better in the per-class PvE-versus-PvP ratio (section 5) and in pinned threads.

English-language Reddit (r/Aion2, top posts of the last month): customization, cosmetics and founder's-pack disputes, "roadmap at 45" checklists, tools; class-balance and tier-list threads appear but are rare, and none of the top posts is a content-specific build.

URLs: https://www.inven.co.kr/board/aion2/6492 ; https://www.inven.co.kr/board/aion2/6467 ; https://www.inven.co.kr/board/aion2/6545 ; https://www.inven.co.kr/board/aion2/6444 ; https://www.inven.co.kr/board/aion2/6388 ; https://gall.dcinside.com/mgallery/board/lists/?id=aion2 ; https://gall.dcinside.com/mgallery/board/view/?id=aion2&no=2658391 ; https://forum.gamer.com.tw/B.php?bsn=82913 ; https://www.reddit.com/r/AION2/top/?t=month (read through the .rss form) ; YouTube result pages for the queries "아이온2 성역 공략 비탄의 설원", "아이온2 초월 던전 공략", "아이온2 어비스 PVP 가이드", "아이온2 악몽 던전 공략 시간 단축", "Aion 2 class tier list" and the others named above.

## 7. Ranked playstyles worth offering

Ranking criteria, in order: (1) exists at Global launch, (2) community builds and optimizes for it (not just plays it), (3) the right build differs from the default PvE build, (4) cost to offer. Scenario keys in brackets are the companion note's proposed names.

### Rank 1. Boss DPS in party PvE (dungeon bosses and raid bosses) [boss, with stagger as a modifier]

- Evidence: Global early access uploads: Normal tier 79%, Exploration 12%, Transcendence 3.7% (https://aionflex.gg/meta/patches?region=Global). KR/TW uploads: Normal 45%, Hard 23%, Transcendence 21%, Sanctuary 4% (https://aionflex.gg/meta/patches). Party-finding titles: 87% Sanctuary recruiting (https://www.inven.co.kr/board/aion2/6467). Sanctuary query 1.19M YouTube views, Transcendence 779k, Expedition 499k (https://youtu.be/iuVFyHR8r78, https://youtu.be/M71j4LQ_KsA, https://youtu.be/_G7ppwL1_R4). Most class boards' pinned threads are PvE DPS, macro, cycle or stat-priority posts (examples: https://www.inven.co.kr/board/aion2/6450, /6451, /6454). All build sites default to PvE.
- What the build should vary: stat targets per content tier (accuracy and crit cutoffs; Ludra about 1,500 / 1,600, Corroded about 2,350 / 2,500, Muspel Hard about 2,800 / 3,150 from the earlier note), skill-level and specialty targets (level 16 and 20 picks, boss-versus-mobile specialty), the number of level-20 skills the Arcana can afford (KR: 4 to 6), cooldown breakpoints for cooldown-driven classes, and the role variant. Roles that need their own variant: Templar (tank), Gladiator (tank-buffer), Cleric (healer: care versus damage), Chanter (support: care Stigma tree versus sub-dealer tree).
- Duration evidence for the engine: median party boss kills on Global early access (AionFlex Boss Index; entry combat power mostly 56K to 76K, lower on Exploration): Expedition Normal mid bosses 1:23 to 2:01, Expedition Normal final bosses 3:12 to 3:41, Exploration bosses 0:31 to 1:39 (Draupnir's final 2:23), Transcendence stage 1 bosses 2:00 to 4:13; client raid final-boss enrage 480 to 600 s (companion). Medians will shorten as gear improves. See section 8.
- Verdict: offer first, per class, with role variants for the non-damage classes. https://aionflex.gg/meta/bosses

### Rank 2. Solo timed boss: Nightmare and Ascension Trial bosses [boss_60]

- Evidence: builds are named by target clear time: 37 s (Sorcerer, https://youtu.be/UI3kVaxno6E), 34 s (Gladiator pinned thread, https://www.inven.co.kr/board/aion2/6448), 29 s (Spiritmaster pinned thread, https://www.inven.co.kr/board/aion2/6454), 20 to 25 s for level 1 (Taiwan, https://forum.gamer.com.tw/C.php?bsn=82913&snA=3831). 1,207 Global early-access meter users (about a third) already ran Nightmare, more than ran Transcendence (628) (https://aionflex.gg/meta/patches?region=Global&content=challenge and &content=grade). Atool publishes tier lists for Nightmare and Awakening (https://aion2tool.com/tier). Tickets are scarce (2 per day, 14 stored), so each run is optimized. Rewards matter beyond DPS (Pantheon statues and the colossus slot, Stigma shards, Daevanion crystals).
- What the build should vary: single-target burst on a 60 to 120 s window with no party buffs; the Season-1 final boss reverses this (lifesteal and sustain over burst, stagger it with your big skills, per aion2maps https://aion2maps.com/guides/nightmare/); Ascension Trial adds a fixed +30% Damage Boost and hordes (companion).
- Duration evidence: Global early-access medians Nightmare levels 1 to 4 about 1:30 to 2:02, Ascension Trial Easy/Normal bosses 0:44 to 0:49, sealed-dungeon bosses 0:14 to 0:45.
- Verdict: offer as a second preset on top of the PvE build; it is the clearest content-specific build the community already names.

### Rank 3. Leveling 1 to 45 [leveling]

- Evidence: every new Global character starts here; leveling videos 463k views (https://youtu.be/6KYyd0IlGpY, 155k) and 307k in English; level-by-level plans on aion2maps (https://aion2maps.com/guides/sorcerer/) and 10 faction pages on aion2hub (https://aion2hub.com/leveling). Zero gear dependence.
- What the build should vary: skill-point order per level, specialty unlock levels (8, 12, 16, 20), Stigma slot unlock levels (22, 27, 32, 37 on the Sorcerer plan), and a pack skill for questing (Ice Chain). Resets are free, so the plan can be generated per character rather than debated.
- Verdict: offer for the launch window and keep it a simple per-level table; low long-term value, highest day-one demand.

### Rank 4. PvP preset: Abyss and open-world group fights [pvp_group, with pvp_duel as a variant]

- Evidence: Inven PVP board 15,612 posts and rising (59 per day versus a 49 per day average) (https://www.inven.co.kr/board/aion2/6492); the Sorcerer PvP guide is the most-viewed pinned Sorcerer thread (32.7k views, ahead of the DPS high-score thread at 26.4k) (https://www.inven.co.kr/board/aion2/6453/2763); Abyss PvP videos 572k; English tier lists lead with "PvP, PvE, F2P and ZvZ" segments (https://youtu.be/YlYUst_BJD8). Against that: PvE videos out-view PvP ones 1.5x to 6x per class and only about 5% of Inven simulator builds are PvP (https://aion2.inven.co.kr/db/daevanion/), and NC itself describes PvP as optional.
- What the build should vary: accuracy, crit-resist and status-resist targets (KR: accuracy about 2,500 including PvP lines, status resist 120 to 130 or more); defensive Stigmas (Hibernation, Steel Barrier, Arctic Armor for the Sorcerer); PvP lines on gear (PvP Accuracy, PvP Damage Boost; the client has 40 PvP stats and 27% PvP-only Daevanion nodes per the companion); the passive set (Revitalization Contract, Grace of Resistance, Absorb Essence at 10 instead of 1); a separate Arcana set.
- Verdict: offer as a clearly separate toggle, one preset per class. The shortage of PvP builds on every site (5% of simulator posts) is the opening; the small audience is the cost.

### Rank 5. Horde and AoE clear, plus trash [aoe renamed horde, trash]

- Evidence: only two sites build for it, as a second preset (games.gg "AoE farming build" and aion2maps "second skill preset for packs"); Korean boards barely discuss it (about 2% of Sorcerer titles); field-farming videos 195k. The content exists (Ascension Trial hordes, advanced sealed dungeons, invasions, daily-dungeon waves; AoE cap 4 per the companion).
- What the build should vary: one Stigma swap (Steel Barrier for Delayed Explosion), the pack skill in the macro, mana-sustain specialties, AoE versus mobile specialty picks.
- Verdict: offer as a swap on top of the PvE build, not as a full build page.

### Rank 6. 1v1 arena duel [pvp_duel]

- Evidence: Atool tracks the Solitude rating for 300 to 800 characters per class (https://aion2tool.com/tier); the Sorcerer thread mentions an extreme-evasion set made for it; duel videos are small (Sorcerer 1v1 videos about 0.6k to 1.9k views each). Cooperation arena (5v5) is almost empty in ranking data and in discussion.
- Verdict: fold into the PvP preset as a variant (target count 1, opener-heavy); no separate page.

### Skip or defer

| Item | Reason |
|---|---|
| Battleground 10v10 | gear and skill levels are equalised; only a hotbar matters (https://www.inven.co.kr/board/aion2/6493/192) |
| Arena 5v5 | near-empty in ranking data and discussion (https://aion2tool.com/api/tier/stats?content_type=coop_arena) |
| Subjugation | not at Global launch; fixed debuffs (companion); community interest modest |
| Trial / Ordeal | not at Global launch (https://aion2maps.com/guides/dungeons-and-raids/) |
| Rift Domination, Abyss Rift Zone | not at Global launch (level 50, KR/TW only) |
| World and field boss builds | people want timers, not builds (https://aion2hub.com/tools/world-bosses) |
| Fortress siege | does not exist as in Aion 1; Artifact War only gives an Abyss-point bonus |
| Standalone stagger or burst-opener playstyles | the community treats stagger as a mechanic inside boss fights; "burst" only appears inside PvP |

Cross-cutting features the community values more than any single playstyle: content-tier stat cutoffs, preset-swap guidance (PvE/PvP, boss/trash), a spec-up order, and role variants for the four non-damage classes.

## 8. How the community picture lines up with the game-data note

| Companion proposal | Community support | Adjustment suggested by the community data |
|---|---|---|
| `boss` 1 target 180 s boss | strong | keep; real final bosses on Global early access run 3:12 to 4:13 at entry gear, mid bosses 1:23 to 2:01 |
| `boss_60` time attack | strong | promote to the same priority as `boss`: Nightmare builds are named by 29 to 37 s clears, NotMeter's class benchmark is a 1-minute dummy test, mid-boss medians sit near 60 to 120 s |
| `aoe` / horde 4 targets 60 s | weak to medium | keep as a swap; only English sites build for it |
| `trash` 3 targets 20 s | weak | matches the "trash preset" idea; low priority |
| `leveling` 2 targets 15 s | strong but short-lived | matches the level-by-level skill-point plans sites publish |
| `stagger` 5 s | mechanic, not a playstyle | the Transcendence final Atiel has a stagger check that wipes the party if missed, and Ludra has a 10 s stagger burst window (aion2maps https://aion2maps.com/guides/transcendence/ and /guides/ludra/); model it as a modifier of `boss`, not a menu entry |
| `pvp_duel`, `pvp_group` | medium | one PvP preset with a duel variant; stat-line and resist handling matters more than target count |
| `burst` 15 s | no community content type | internal PvP opener only |
| `subjugation` | absent at Global launch | defer until season 2 |

Community-derived constants that the client does not contain: typical party boss kill times (AionFlex Boss Index), content stat cutoffs (earlier note and https://notmeter.com/ "boss resistance stats"), and the practice of two presets per character.

## 9. Open questions and weak spots

- There is no Global community yet. The evidence is 10 months of KR/TW, four days of Global early-access meter data, and English guides written on the Launch Scale Test client; Global also lacks Hard, Ordeal, Subjugation and Rift Domination, so KR/TW Hard-tier chatter does not transfer.
- Meter data covers only people who run a third-party meter (about 3,300 uploaders on Global, about 330 on KR/TW). AionFlex's own boilerplate still says Global has no data while its Global filter shows data.
- Atool's tier snapshot is dated 2026-07-21 (Subjugation 2026-04-07), before the 2026-09-16 balance patch, and uses content scores that are not adjusted for combat power.
- Conflicts left open: Arena of Cooperation 5v5 (client) versus 4v4 (an article), Abyss weekly time 7 h (client, article) versus 14 h (a creator), Battleground 10v10 versus a stray 8v8 snippet.
- Unverified claims I saw and did not use: a Reddit post says Global removed PvP gear; "Aug 26 patch only had PvE balance changes" (Reddit) suggests separate PvE and PvP balance; a 2026-02 earnings summary on Reddit describes a "dual-track PvE and PvP" plan (https://www.reddit.com/r/Aion2/comments/1r2sw69/aion2_global_launch_in_septoct_2026/).
- Not readable: questlog.gg (Cloudflare block), namu.wiki (403), 17173 (unreachable). The Chinese mainland version is not live.
- Korean macro slang (마매, 스매) is read from titles, not from a glossary.
- Counting method notes: Inven post numbers include deleted posts; per-day rates come from page order and dates; party-board and PVP-board shares come from keyword matches on 300 and 520 titles; the Sorcerer board shares from 605 titles; simulator counts from the JSON embedded in the simulator pages (`?page=N`, 20 per page; 591 of 611 Devanion posts were readable); Atool numbers from its public tier API; AionFlex numbers from its public pages; YouTube sums from the first result page of each query, parsed by script.

## 10. Source map (the per-section URL lines above are the claim-level sources)

- Inven: class boards https://www.inven.co.kr/board/aion2/6448 (Gladiator), /6438, /6449, /6450, /6451, /6452, /6453, /6454, /6544; PVP /6492; party /6467; balance /6545; tips /6444; free /6388; NC posts /6493/192, /6493/238, /6493/186, /6493/248, /6493/243; simulators https://aion2.inven.co.kr/db/daevanion/ and /db/skillsimulator/.
- Other KR/TW: https://arca.live/b/aion2/176898369 ; https://gall.dcinside.com/mgallery/board/lists/?id=aion2 ; https://forum.gamer.com.tw/B.php?bsn=82913 ; https://aion2tool.com/ ; https://cielui.com/ ; https://notmeter.com/ ; https://aionflex.gg/ .
- English: https://aion2hub.com/ ; https://aion2maps.com/guides/useful-sites/ ; https://games.gg/aion-2/guides/aion-2-sorcerer-guide/ ; https://aion2t.com/ ; https://aion2.app/ ; https://www.reddit.com/r/Aion2/ (RSS) ; https://massivelyop.com/2026/09/08/aion-2-confirms-time-delayed-content-from-the-korean-launch-and-a-lack-of-crossplay/ ; https://massivelyop.com/2026/08/08/aion-2-details-changes-for-party-sizes-activities-and-founders-pack-benefits-for-its-global-release/ ; https://mein-mmo.de/en/aion-2-endgame-what-can-pve-and-pvp-fans-expect-at-level-45,1583622/ ; https://mein-mmo.de/aion-2-chef-interview/ .
- Repo notes: D:/Aion2/research/playstyles_gamedata_2026-10-04.md and D:/Aion2/research/sorcerer_builds_and_dps.md.

