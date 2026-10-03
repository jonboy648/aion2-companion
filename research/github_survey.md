# Aion 2 GitHub / community survey (2026-10-03)

Method: GitHub MCP repo/code search plus api.github.com metadata via WebFetch. Nothing cloned or installed.
"Last push" is GitHub `pushed_at` where checked; "(upd)" means only `updated_at` was seen (can be later than the last commit, so treat as an upper bound).
Sorcerer = KR "마도성" (Magic Sorcerer) in repos that use Korean class names. "Sorc?" = whether the repo covers Sorcerer.
Not verified: repo contents beyond the file listings I fetched. License column is the GitHub-detected license only.

## Ranked by usefulness to us

| # | Repo | Stars | Last push | License | Lang | Provides | Sorc? | Verdict |
|---|------|-------|-----------|---------|------|----------|-------|---------|
| 1 | https://github.com/phuongtruong97/aion2skill (site: aiontoskill.vercel.app) | 0 | 2026-09-29 | none | JS | Raw datamined tables dated `data/2026_09_30/`: Skill.json (98 MB), SkillEffect, SkillEffectLv, SkillAbnormalEffect(+Lv), SkillEffectFilter, SkillLv, text.xlsx; skill icons `icon_so_skill_001-020` and passive 001-013 (Sorcerer) | Yes (active + passive icons, skill tables) | Borrow data (largest, freshest skill source). No license = all rights reserved; datamined from client = NCSoft IP. Use privately, do not redistribute. Re-extract ourselves if we ship. |
| 2 | https://github.com/ZDYoung0519/NOIA2 | 53 | 2026-10-01 | GPL-3.0 | TS (Tauri v2) | DPS meter (TW+KR), scorer, ranks, class stats. Ships `public/aion2/skill/` (1000+ icons), `public/aion2/class/sorcerer.*`, `abnormal_ids_full.json`, `mobs.json`, `npc_data.json`, `npc_names.json`, and `docs/AION2_PACKET_PROTOCOL_ANALYSIS.zh-CN.md` (opcodes 0438 direct dmg, 0538 DoT, skill-id normalization raw - raw%10000) | Yes (icons, class art, skill ids) | Borrow data + reference (protocol doc and abnormal/buff id map are the best public write-up). GPL-3.0: do not copy code into non-GPL project; data files' provenance is the game. |
| 3 | https://github.com/TK-open-public/Aion2-Dps-Meter | 71 | 2026-07-04 | MIT | TS + Kotlin | Most-starred meter. Kotlin `SkillRepository`, `JobClass`, `MobIdRepository`, `MobHpRepository`, `Buff`; libpcap capture (`PcapCapturer.kt`, `StreamProcessor.kt`); Korean class icons incl. 마도성 | Yes (class enum, skill repo) | Reference + borrow (MIT is the only permissive meter; can reuse parsing logic with attribution). Stale since July, so check opcodes against current client. |
| 4 | https://github.com/Egor-Slutskiy/aion2-skill-calculator | 0 | 2026-09-27 (upd) | none | JS | `data/config.js` (29 KB) skill/class definitions; 23 Sorcerer skill webp icons (Flame Arrow, Firestorm, Hellfire, Frost Burst, Ice Chain, Robe of Flame/Cold/Earth...) with English names | Yes, Sorcerer-specific | Borrow data (English skill names + curated list, small and easy to audit). Reference for planner UI. No license. |
| 5 | https://github.com/Othmane-ElAlami/Daeva | 1 | 2026-09-24 | 0BSD | JS (Next.js, Cloudflare) | Meta/build analyzer fed by scraped leaderboard providers (official + Shugo), scraper + API routes | Indirect (leaderboard builds) | Use as dependency / fork candidate: permissive license, only repo with a scraper pipeline for real build data. Check scraping of official leaderboard against site ToS. |
| 6 | https://github.com/taengu/A2Tools-DPS-Meter | 28 | 2026-10-02 | GPL-3.0 | Rust | Region-agnostic packet-based meter, fight analysis, very active | Class-agnostic | Reference only (GPL; good for how opcodes shift between regions). |
| 7 | https://github.com/cloris-chan/Aion2Flow | 18 | 2026-09-23 | GPL-3.0 | C# | Real-time combat analysis | Class-agnostic | Reference only. |
| 8 | https://github.com/Kuroukihime/AIon2-Dps-Meter ("RATmeter") | 13 | 2026-10-01 | GPL-3.0 | C# | Network-based meter for global servers | Class-agnostic | Reference only. |
| 9 | https://github.com/p62003/aletheia_AION2_DPS_Meter | 34 | 2026-07-30 | NOASSERTION (custom) | n/a | Party tracking, "Skill MAP" timeline, battle reports; states non-invasive packet sniffing, no memory reads | Class-agnostic | Reference only (custom license; idea source for per-skill timeline, which is the rotation-analysis view we want). |
| 10 | https://github.com/Iota-Nine/Aion2-Eclipse | 1 | 2026-10-02 | NOASSERTION | n/a | Meter + rift timer + "builds" tab, overlay, in-app updates | Unknown | Reference only (features list for what players expect; closed/odd license). |
| 11 | https://github.com/PFG199/Aion2Kina (site AION2 KINA) | 7 | 2026-07-24 | none | n/a | Item DB, 894 crafting recipes, class planning pages, calculators; EN/TW/KO | Class guides only | Reference only (item/recipe data useful, but no license and mostly web content). |
| 12 | https://github.com/Grachy/aion2-craft | 1 | 2026-05-02 | none | HTML | Crafting calc, topics list "skills-builder" | Unknown | Avoid / low value. |
| 13 | https://github.com/ProjackL2/aion2_dps_meter | 21 | 2026-01-12 | none | Python | OCR (screen capture) DPS meter | Class-agnostic | Reference only. Only screen-capture approach found; safest ToS profile but stale and unlicensed. |
| 14 | https://github.com/hnomkeng/AION2_AutoSim | 15 | 2025-12-01 | none | n/a (no description) | Name suggests rotation/damage simulator; I did not inspect contents | Unknown | Check by hand before dismissing; only candidate for a damage calculator/sim. Stale. |
| 15 | https://github.com/karim-mo/aion2-abysslogs-dps-meter | 4 | 2026-09-25 | none | n/a | Meter + log parser, uploads to abysslogs.com leaderboards | Class-agnostic | Reference only (uploads data to third party). |
| 16 | https://github.com/aion2-interactive-map/aion2-interactive-map | 18 | 2026-07-06 | NOASSERTION | TS | Interactive world map | n/a | Not relevant. |

Also seen, not relevant or avoid: `Aion2-MSQ-Overlay`, `aion2-map-overlay` (quest/map OCR overlays), `Aion2-Steam-CN` (client patcher), `aion2-patch-bot` / `aion2_discord` / `waffle_meter_bot` (Discord bots, 0-1 stars, no Sorcerer data), `Aion2-DailiesTracker`, `aion2-tracker`.

## Legal / ToS flags

Category by capture method:

- Screen-capture / OCR, no process contact: ProjackL2/aion2_dps_meter, MSQ overlay. Lowest risk.
- Passive packet sniffing via npcap/libpcap (reads network interface only): TK-open-public, NOIA2, A2Tools, Aion2Flow, RATmeter, aletheia, AionFlex/AION2 Hub meter. Does not touch the client process or memory, but still reads game traffic; NCSoft's EULA/ToS on third-party programs is the open question and I did not find an NCSoft statement tolerating or banning it. AION2 Hub itself only says "follow the game's terms of service". Treat as medium risk, not zero.
- Invasive, avoid entirely: `KnotCaliph87/aion2-daev-companion` ("43-module cheat/trainer"), `liu5806506/aion2-templar-helper` (input automation / animation-cancel macro), `DistributorString/Aion2NewHelper` (speed hack/teleport, reads as malware bait), `AION2-AO/AION2`, `ImKK666/AION2-SDK`, `skurabladex-cloud/aion2`, `sheepGu/aion2` (auto-trade). These imply memory reading/injection/automation: ban risk and malware risk. Do not run or fetch.
- Datamined client data (phuongtruong97, NOIA2 json, probably others): copyrighted NCSoft game data. Fine for private analysis; redistribution in a public project is a copyright/ToS exposure. Extracting game files from our own install is the same exposure but at least first-party sourced.
- GPL-3.0 repos (NOIA2, A2Tools, Aion2Flow, RATmeter): copying code makes our project GPL. Data/ideas only.
- Community DB sites: AION2 Hub (https://aion2hub.com) has item/set/achievement DB and a build planner but no public API or export found; AionFlex (https://aionflex.gg) is meter + leaderboards, no API, no skill DB. Scraping either probably breaches their ToS (not read). Questlog and Maxroll: my fetch returned nothing usable (empty page / 404), so I cannot say whether they have Aion 2 sections. Unverified, no API known.

## Gaps (nothing public found)

No public damage-formula or skill-coefficient calculator with a license, no rotation helper for Sorcerer, no Discord bot with game data, no icon-only repo beyond the two above. A real Sorcerer rotation/damage model has to be ours, built on the datamined skill tables plus meter logs.

## Recommendation (5 lines)

1. Take skill/effect numbers from the datamined `Skill*.json` set (phuongtruong97, dated 2026-09-30) for private use; re-extract from our own client before shipping anything public.
2. Use NOIA2's `abnormal_ids_full.json`, skill icons and protocol doc as the id-to-name map; do not copy its GPL code.
3. For combat logs, reuse TK-open-public's MIT Kotlin parser logic (or screen-capture OCR if we want zero network contact); check opcodes against the current client first.
4. Fork or study Daeva (0BSD) only if we want leaderboard-driven meta builds; otherwise build our planner from scratch on item 1's data.
5. Never run any "helper/hack/SDK" repo, and read NCSoft's ToS on third-party tools before any packet-based meter touches our own account.
