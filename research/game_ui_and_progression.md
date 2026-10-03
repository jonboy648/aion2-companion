# Aion 2 - UI, Controls, Progression (research notes)

Compiled 2026-10-03. Method: WebSearch/WebFetch of third-party guide sites only. Official NCSOFT pages (aion2.plaync.com guide) returned 404; Namu wiki, Inven, exitlag, topgamecarry, Fextralife blocked or unusable (403) or not reached. **Every figure is secondhand; none verified in-game.** Items tagged [UNCERTAIN] conflict across sources or have a single weak source.

## 0. Version context (critical)

- Two live variants with different caps:
  - **Global client**: Founder's early access 2026-09-30, global launch 2026-10-05, client v2.0.3.0, **level cap 45** at launch. Source: metabot.gg beginners guide (page date 2026-10-01).
  - **Korean service**: cap raised 45 -> 50 on 2026-07-01 ("Chapter 1": new class Brawler, regions Eltnen/Morheim, Pendant slot, item level scale into the thousands). Source: aion2hub July 1 notes. Taiwan reported as same as KR.
- Items below tagged GLOBAL or KR. Do not mix them in app logic.
- Conflict: a search summary mentioned stigma quests at 45/50/52/55 and a PC Gamer "Aion 2.0 levels 51-55" guide. The PC Gamer pages are about Aion Classic 2.0 (different game), and 52/55 for Aion 2 is unconfirmed. [UNCERTAIN] Treat Aion 2 KR cap as 50 (as of 2026-08-19 patch notes, "no level cap increase").
- Older guide (oslink, 2025-12-05, KR launch era) says cap 45, but its class list is garbled/unreliable. Ignore its class names.

## 1. Controls, HUD, menus (PC)

### 1.1 Default keybindings (global client)
Sources: https://allthings.how/aion-2-keybindings-how-to-change-and-customize-your-controls/ (updated 2026-09-26); https://couga54.github.io/aion2-guides/en/settings/ (checked 2026-10-03); https://space4games.com/en/games-en/aion-2-best-settings-guide/ (2026-09-28).

Key Settings (Settings cog > Key Settings) has 4 tabs: **General, Menu, Quickslot, Marker**.

| Tab | Action | Default |
|---|---|---|
| General | Move | W A S D or arrow keys |
| General | Sprint / dodge | Shift |
| General | Auto-move forward | Num (as written; likely Num Lock) [UNCERTAIN] |
| General | Jump / glide / Defiance | Space |
| General | Start/stop flight | V |
| General | Fly up / down | Ctrl+W / Ctrl+S (allthings.how) vs Ctrl+R / Ctrl+F (couga54) [CONFLICT] |
| General | Mount / dismount | C |
| General | Interact | F |
| General | Power Shard on/off | R |
| General | Auto-use potions | X |
| General | Change target | Tab |
| General | Switch control mode | "/" (couga54, allthings.how search snippet) vs "-" (space4games) [CONFLICT] |
| General | Macro | unassigned (Settings > Key Settings > General > Gameplay) |
| General | Combat analysis | Ctrl+X (single source) |
| Menu | Cancel/close | Esc |
| Menu | Display cursor | Alt (hold, in AION 2 mode) |
| Menu | Hide UI | F12 |
| Menu | Map | M |
| Menu | Cube (inventory) | I |
| Menu | Stat info (character) | P |
| Menu | Skills | K |
| Menu | Journal (quests) | J |
| Menu | Legion (guild) | L |
| Menu | Closet, Pet, Wings, Enhancement, Crafting, Expedition windows | bindable; default keys not listed in sources |
| Menu | Settings | "O" per one search summary, unconfirmed [UNCERTAIN] |
| Quickslot | Skill slots 1-12 | number keys (customizable) |
| Quickslot | Consumable quick-use 1-8 | F1-F8 |
| Quickslot | Unique transformation skills 1/2 | Ctrl+1 / Ctrl+2 |
| Marker | Markers 1-9, 0 | N1-N9, N0 (keypad) |
| Marker | Clear all / select marker target | Ctrl+` / Ctrl+middle-mouse |

Control modes: **AION 2 mode** (default; crosshair/dot at screen center, camera follows mouse, hold Alt for cursor) and **AION 1 / classic mode** (free cursor, camera turns while right mouse held). Reticle height default 120 px (space4games). Auto-potion threshold default 70% HP.

### 1.2 Skill window and hotbar
- Skills window (K) tabs: **Active, Passive, Mastery, Stigma, Macro** (allthings.how search summary). Place a skill by clicking it, then clicking a quickslot.
- Hotbar supports up to **3 skill presets**; macro chains up to 20 skills; suggested macro delay 10 ms (low ping) to ~50 ms (allthings.how hotbar guide, 2026-09-28).
- Exact on-screen position of the hotbar not documented in any source found. [GAP]

### 1.3 HUD and Edit HUD
Source: https://allthings.how/aion-2-how-to-edit-your-ui-and-customize-the-hud/ (2026-09-27); space4games (2026-09-28).
- Open: Esc (main menu) > **Edit HUD** (next to Settings cog) > drag, Save.
- Movable elements: party frames, action hotbars, HP/resource bars, minimap, chat, target frame, boss timers/boss bar, skill cast bar, cooldown indicators, quest tracker/list, debuffs, Abyss timers.
- Global options: Outer Margin (None/Narrow/Wide); Grid Preview (Dense/Wide); Snap ON/OFF; **UI Proportion** (Smaller/Small/Medium/Large/Larger); Chat Font Size (Normal/Medium/Extra Large). space4games lists UI Scale default = Medium.
- Presets: allthings.how says 4 (Preset 1-4); space4games and another summary say 6. [CONFLICT] Both support export/import as code or file.
- Display: borderless window available, ultrawide tested at 3440x1440, DLSS/FSR + resolution scale present. No default resolution value published. [GAP]
- **Default screen positions of HUD elements: not found in any source.** Overlay/screenshot reader must calibrate from real screenshots. Because layouts are fully user-movable (and UI Proportion rescales everything), fixed pixel regions are unsafe; template-match or have the user define regions.

## 2. Progression, level 1 to cap

### 2.1 Factions and classes (GLOBAL)
- Elyos (start Poeta) and Asmodian (start Ishalgen). 8 launch classes, both factions: Gladiator, Templar, Assassin, Ranger, Sorcerer, Spiritmaster, Cleric, Chanter. (metabot, 2026-10-01)
- KR adds Brawler (Gauntlet) on 2026-07-01 (aion2hub).
- No class-change/awakening system documented; class is chosen at creation (aionhub-adjacent summary: "NCSOFT has not announced a class-change method for global"). [UNCERTAIN] "Daeva ascension" (wings) is the story awakening: **Elyos level 5, Asmodian level 6** (metabot, gamerstogether). aion2hub says level 10 for Daeva: [CONFLICT, prefer 5/6].

### 2.2 Level bands and zones (GLOBAL, metabot leveling guide 2026-10-01)
| Level | Elyos | Asmodian |
|---|---|---|
| 1-9 | Poeta | Ishalgen |
| 10-45 | Verteron | Altgard |
- Elyos story markers: "Dawn Legion" (10), "Kaisinel's Seal" (21), "Fire Temple" (37), "Where the Drana Flows" (40), "Diverging Paths" (45). Asmodian: "Finding Nemon" (10), "Imminent Threat" (20), "Land of Rifts" (29), "The High Priest Awakens" (44).
- Episode quests give ~97% (Elyos) / 99% (Asmodian) of EXP needed for 45; total 754.8M EXP.
- KR 45-50: Eltnen (Elyos), Morheim (Asmodian), Chapter 1/2; entry needs hero quests plus level/item-level/Combat Power gates.

### 2.3 Unlock milestones (GLOBAL, metabot 2026-10-01; client 2.0.3.0)
| Level | Unlock |
|---|---|
| 5 / 6 | Wings, Daeva ascension (Elyos / Asmodian) |
| 10 | Crafting specialties; Sealed Dungeon tier 1 |
| 12 | Daevanion board 1 (Nezekan) |
| 20 | Daevanion board 2 (Zikel); Krao Cave Exploration (IL 200) |
| 22 | Stigma skills (13 per class) + Stigma slot 1 |
| 27 / 32 / 37 | Stigma slots 2 / 3 / 4 |
| 28 | Urugugu Canyon Exploration (IL 300) |
| 30 | Daevanion board 3 (Vaizel); Daily Dungeon "Daeva Bio-Research Base" (14/week) |
| 35 | Fire Temple Exploration (IL 500) |
| 40 | Daevanion board 4 (Triniel) |
| 45 | Daevanion board 5 (Azphel); story end; all Conquest modes; Draupnir etc. |
- Sealed Dungeons: 161 total (61 per faction map), solo, no entry counter, tiers at levels 10/15/20/25/30/35/40/45. Clear reward: 2 Daevanion Crystals, 2 Wisdom Stones, title, mats, 15,000 Kinah.
- Daevanion: 5 boards, 802 points to complete; node cost Common 1/Rare 2/Epic 3/Unique 4; clearing all 61 Sealed Dungeons once = 122 points.
- Skill system (skycoach 2026-09-29): skill level cap 20; skill points cap normal skills at 10; Daevanion adds up to +4 (to 14); Arcana/Soul Binding push to 16-20. Active skill specialty unlocks at skill level 8 (first 3 + slot 1), 12 (4th + slot 2), 16 (5th), 20 (3rd slot). Skill points from main quests and Sealed Dungeons.
- Stigma: 13 per class; upgraded with Stigma Shards (Abyss/Shugo Festa/Nightmare shops), cap 20 global. KR after 2026-07-01: cap 25, Advanced Stigma Shard each level from 45, free reset, and "Advanced Stigma" slots via quests at 45/50(/52/55 [UNCERTAIN]).
- Earlier sources disagree on stigma unlock (35; "~35", metabot 22). Prefer metabot (newest, global client) but unverified in-game. [UNCERTAIN]

### 2.4 Dungeon/PvP content unlock (GLOBAL, metabot dungeon guide 2026-10-01)
~219 instances. Types: Sealed (161 solo), Daily (3), Expedition (11; Exploration + Conquest modes), Transcendence (5), Sanctuary Raids (3, 10 players, 4 attempts/week), Ascension Trial (6 solo, 3/week), Subjugation (4 players, 3 tickets/week), Growth (2), Nightmare (26 bosses, 2/day).

Expedition list (Exploration unlock / Conquest unlock, IL = item level):
| Dungeon | Exploration | Conquest |
|---|---|---|
| Krao Cave | Lv 20, IL 200 | Lv 45, IL 700 |
| Urugugu Canyon | Lv 28, IL 300 | Lv 45, IL 1,400 |
| Fire Temple | Lv 35, IL 500 | Lv 45, IL 2,100 |
| Draupnir | Lv 45, IL 700 | same |
| Vakron Sky Island | IL 1,400 | same |
| Ferocious Horn Den | IL 2,100 | same |
| Dying Dramata's Nest / Cradle of Nihility | IL 2,800 (Hard 3,000) | same |
| Hall of Illusion / Azure Breath Island | IL 3,000 (Hard 3,500) | same |
| Citadel of the Fallen Daeva | IL 3,800 (Hard 4,500) | same |
PvP: Abyss (Reshanta zones, 7 h/layer/week), Battleground, Arena (KR 2026-07: Co-op Arena 5v5, Battleground 10v10, stats equalized). Level gates for Abyss/PvP in global not confirmed. [GAP] Note item level scale differs between sources (gear "IL 54-102" vs dungeon "IL 700-4800"); the small numbers are per-piece item levels, the large are total/character item level. Do not conflate.

### 2.5 Gear by stage (GLOBAL, metabot gear progression 2026-10-01)
| Stage | Level | Per-piece IL | Source |
|---|---|---|---|
| Starter | 1-20 | 1-20 | Common/Rare quest drops |
| Early | 20-30 | 23-28 | Epic field gear |
| Mid | 30-40 | 36-46 | First Unique (IL 36, Lv 30), named elites |
| Cap | 45 | 54-102 | Expedition Conquest 54 (Krao Cave/Draupnir) -> 70 (Urugugu/Vakron) -> 86 (Fire Temple/Horn Den) -> 102 (Ludra raid); crafted Dragon Lord sets IL 62-102 |
Grades in global: Common, Rare, Epic, Unique (top at launch); Heroic exists in KR (Unique +15 -> breakthrough; Heroic +20). Pendant slot (KR only, Chapter 1).

### 2.6 Currencies and resources
Kinah (enhance, soul binding, morph), Enhance Stones, Abyss Points (duty missions 1,000, duty commands 1,000-2,000, sealed dungeon 1,000/clear; Potential = 400,000 AP + 10 Potential Stones), Soul Codex (soul binding), Odyle Energy (dungeon entry; KR notes call it "Ether Energy"; +15/3h, cap 560, 840 membership; Conquest cube 40, Exploration 20-30), Daevanion Crystals/Points, Stigma Shards, Gear Change Vouchers, Amplify Stones, Draconic Essence (KR). Cash/premium currency "Eternium" from an older guide only. [UNCERTAIN]

## 3. Endgame

### 3.1 Enhancement and gear systems
Sources: metabot enhancement guide (2026-10-01); aion2guide.org (2026-09-30, KR/TW reference, global unconfirmed).
- Enhancement caps: Common +5, Rare +5, Epic +10, Unique +15 (safe to +10). Unique +10 to +15 rates 65/50/35/25/20% with +5% pity per fail; no permanent break except the Clash Rune item. Cost example (IL 102 Unique): +0 to +10 ~920K Kinah + 36,680 stones; +0 to +15 avg ~15.0M Kinah + ~190,700 stones.
- Amplified enhancement on +15 Unique: 66/50/33/25/20%, up to +5; at max amp weapon +150 Attack, +5% attack (single-source, topgamecarry/other) [UNCERTAIN].
- Potential (breakthrough in some sources): 100% success, 10 Potential Stones + 400,000 AP, up to +2.0% PvP stats.
- Breakthrough/Substance Morph: Revelation Amulet and Noble Belt only (Rare -> Epic -> Unique, re-enhance +0 to +10 each). Other sources describe breakthrough at +15/+20 for Unique/Heroic (KR). [CONFLICT, scope unclear]
- Manastones: 4 slots Unique, 3 Epic. Theostones: weapon-only, 1 slot. Soul Binding: Unique only; 3-5 random stats; untradeable; costs Soul Codex 10-102 per step.
- Nine layers per aion2guide.org: enhancement, breakthrough, extraction, potential, Manastones, Theostones, soul binding, synchronization, transfer. Transfer carries enhancement and soul binding, not Potential/stones. Extraction refunds only Enhance Stones. [KR/TW reference]
- "Transcend" in the brief = Transcendence dungeons (Arcana source), not an item-enhancement step. "Soul" = Soul Binding.

### 3.2 Arcana and Transcendence
Transcendence dungeons: Deus Research Base, Shattered Arkanis (+3 more, KR adds Abyssal Horn Den). Stage 1 at 1,600 total IL, stage 4 at 2,500; 24 Arcana cards per difficulty. Arcana slots: chalice/scroll/compass (active skill levels), bell/mirror (passive); KR adds Key, Hourglass (live), Dice, Lantern. Matching pair set effects.

### 3.3 Stats and caps (GLOBAL, sportskeeda/vortexgaming summaries; not fetched directly) [UNCERTAIN]
Crit rate cap 50%; evasion cap 50% (about 500 above enemy accuracy); block cap 80%; accuracy linear (10 pp per 100). KR "Combat Power" is a separate score; PvE-new-surface cap items (Combat Power <= 400K) in KR.

### 3.4 Weekly/daily content (GLOBAL)
Sources: metabot weekly-reset and endgame pages (2026-10-01); game8 timers.
- Weekly reset: Wednesday (hour is server-dependent per metabot; game8 states 4 PM server time; [CONFLICT, unverified]). Daily 4 PM server time per game8.
- Weekly: Exploration 7 per dungeon; Conquest 7 per dungeon; Transcendence final-boss cap 28; Conquest final-boss 35; shared "Remaining Unobtained Cube Count" 10 per server; Sanctuary raids 4 attempts each (final-boss kills: Ludra 1; Chalice of Muspel and Corroded Decontamination Facility 2); Ascension Trial 3; Subjugation 3; Abyss 7 h/layer.
- Daily recharge: Conquest +2/day (bank 14), Transcendence +2/day (bank 4), Nightmare +2/day (bank 14). Timed: Conquest reward +1/8h (max 21); Transcendence +1/12h (max 14); Odyle +15/3h.
- Raids: Ludra opens ~IL 2,800 (couga54). KR season-2 sources (low reliability forum reposts) mention Sanctuary raid and Grail of Muspel; ignore for global.

## 4. Source list (date, region)
| URL | Date | Scope |
|---|---|---|
| https://metabot.gg/en/aion-2/guides/beginners-guide | 2026-10-01, v2.0.3.0 | Global |
| https://metabot.gg/en/aion-2/guides/leveling-guide | 2026-10-01 | Global |
| https://metabot.gg/en/aion-2/guides/dungeon-guide | 2026-10-01 | Global |
| https://metabot.gg/en/aion-2/guides/gear-progression-guide | 2026-10-01 | Global |
| https://metabot.gg/en/aion-2/guides/gear-enhancement-guide | 2026-10-01 | Global |
| https://metabot.gg/en/aion-2/guides/endgame-guide | 2026-10-01 | Global |
| https://metabot.gg/en/aion-2/weekly-reset | 2026-10 | Global |
| https://aion2hub.com/updates/aion-2-update-2026-07-01 | 2026-07-01 | KR |
| https://aion2hub.com/updates/aion-2-update-2026-08-19 | 2026-08-19 | KR |
| https://aion2hub.com/leveling | undated | KR/TW era (cap 50) |
| https://allthings.how/aion-2-keybindings-how-to-change-and-customize-your-controls/ | 2026-09-26 | Global |
| https://allthings.how/aion-2-how-to-edit-your-ui-and-customize-the-hud/ | 2026-09-27 | Global |
| https://allthings.how/?p=227536 | 2026-09-28 | Global |
| https://couga54.github.io/aion2-guides/en/settings/ , /progression/ | 2026-10-03 | Global |
| https://space4games.com/en/games-en/aion-2-best-settings-guide/ | 2026-09-28 | Global |
| https://skycoach.gg/blog/aion-2/articles/skill-progression-guide | 2026-09-29 | Global/KR mix |
| https://aion2guide.org/systems/aion-2-gear-progression-guide/ | 2026-09-30 | KR/TW ref |
| https://www.oslink.io/kr/blog/guide/aion-2-beginner-guide.html | 2025-12-05 | KR launch; unreliable |
| https://www.oslink.io/kr/blog/guide/aion2-level-45-gear-upgrade-guide.html | 2026-01-08 | KR |
| https://game8.co/games/Aion-2/archives/628475 | undated | search summary only |
| https://www.sportskeeda.com/mmo/all-stats-sub-stats-aion-2-mean | undated | search summary only |
| https://www.mmoexp.com/News/aion-2-global-the-ultimate-beginner-s-guide-to-ui-and-core-features.html | undated | no layout detail |

## 5. Gaps
- Default HUD element screen positions and default resolution/UI scale pixel values.
- Official NCSOFT/Plaync documentation (404) and Korean wikis (Namu, Inven pages 403) not read.
- Level gates for Abyss PvP, Arena, auction house in global.
- Class awakening/change definitively; stigma unlock level conflict.
- Fly up/down and control-mode-switch key conflicts; HUD preset count (4 vs 6).
- All values need in-game verification after the 2026-10-05 global launch.
