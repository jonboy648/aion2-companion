# Role builds for Templar, Cleric, Chanter, Spiritmaster (research, 2026-10-04)

Question: what do players optimize these four classes for, which community "role builds" exist that we could show, and what would a role score need from our engine and data?

Context: Global launches 2026-10-05 (Advanced Access since 09-30). Every Global source below is pre-launch opinion built on KR/TW play and the Launch Scale Test client. KR sources are 11 months into the game and are the only ones with endgame experience, but KR has different caps (see 2.2).

Confidence tags: [H] read in the original text or in our own data, [M] one source or a fetch summary, [L] inference or unverified.

## 0. Method and trust

- Local, read-only: `app/aion2c/data/classes/{templar,cleric,chanter,spiritmaster}/gamedata.json`, `engine/build_optimizer.py`, `models.py`, `damage.py`, `simulator.py` (header and status handling), `daevanion.py`, `classes.py`, `keybinds/layout.py`, `research/community_vs_engine_2026-10-03.md`, `research/community_builds/*.md`, `research/classes/*/NOTES.md` and `skills.json`, `.firecrawl/` scrapes from 2026-10-03 (questlog class pages, shugo tier list, aion2hub builds).
- One experiment, no files modified: `optimize_full_build(boss, level 45, BASELINE_L45_STATS)` per class on the working tree (it has an uncommitted `search.py` edit), run from the scratchpad with bytecode writing off. Results in each class section. Numbers moved since the 10-03 note (Spiritmaster 4249 now 3747), consistent with today's data rebuild; I did not investigate why.
- Web: English and Korean pages read with WebFetch and, for Inven and Arca, raw HTML with curl so I could read the Korean myself. WebFetch summaries come from a small model and mistranslated KR slang several times (2.4). Skill names in every KR claim below were cross-checked against `name_kr` in our data. Claims whose raw Korean I did not read are marked "(summary)".
- Trap found: Korean class-name searches return 2010-2011 articles about the original Aion (GameMeca gid 232978, 233001, 233050: "Templar and Spiritmaster left out of parties", "Fortune's Mantra", "Templar unemployment"). They describe level 54 stigmas and Padmarashka Temple, not Aion 2. Excluded.
- Not reachable or not read: Reddit (our search tool refuses the domain, so no thread was read), Namu Wiki (Cloudflare 403), questlog.gg terms page (client-rendered, empty to our fetcher), shugo.gg terms (body not returned), Arca terms (not located), DCinside terms (not found), YouTube transcripts (titles and URLs only).
- DCinside: its robots.txt lists ClaudeBot, anthropic-ai, Claude-Web and GPTBot as `Disallow: /`. I read exactly one DC post (via the fetch tool, before I had checked robots) and stopped. Treat DC as link-only and do not fetch it from agents.

## 1. Bottom line

1. In Aion 2 PvE the "role" is mostly two things: scheduling party-wide survival cooldowns, and still winning the damage race. Players do not optimize these four classes for raw healing or raw mitigation numbers. KR Templar threads optimize clear time (Nightmare speed runs, "peak DPS" macros) with a Block floor; the KR Cleric optimization guide of 09-24 is almost entirely damage; Chanter is a buffer whose party value is disputed; Spiritmaster is a solo summoner with no party kit. [H for the KR posts quoted below, M for the overall reading]
2. English guides split. Tank-first: gegebase, expcarry, aion2hub template (Block, Damage Tolerance, HP, Accuracy, Enmity). Damage-lean tank: couga54 (SolAshur, trueeevil; "Templar's survivability is already enough") and the KR posts. Healer: couga54 says "a healer that has to deal damage", gegebase says a near-zero-DPS Cleric with perfect uptime beats a +10% DPS Cleric whose tank dies, and the KR Sanctuary guide is a cooldown schedule. The tool lists agree; the emphasis does not.
3. Spiritmaster is not a support. couga54, gegebase and our client data agree it has no ally-facing buff, heal or CC (every buff is caster plus own spirit). shugo's tier blurb "party buffs" and our `classes.py` label `support` are wrong. Questlog says NCSOFT designed it for solo play. `CONTEXT.md` lists Spiritmaster among the role-build classes; its role build should simply be its DPS build, with no support framing.
4. What we can show: our own derived summary plus a link and credit per source. Only aion2sm.com (Spiritmaster) gives explicit reuse permission (credit "ereskus" and link, no whole-guide copy). Inven posts are author-owned with no public licence (Inven terms Art. 15). couga54 has no licence file. Details in 2.3.
5. The engine today is a single-actor damage race. It does count the self-benefit of support stigmas (it picks Undefeated Mantra and Power of the Storm for Chanter, and exactly couga54's four stigmas for Cleric), but healing, shields, Damage Tolerance, Block, Enmity and HP are all `no_dps` text, and there is no ally or party scope at all.
6. Top gaps for a real role model, in order: (a) `Stats` has no HP, Defense, Block, Damage Tolerance, Endurance, Heal Boost, Enmity; (b) no party scope or reference ally; (c) heal and shield numbers exist only in `research/classes/*/skills.json` and description strings, the app `gamedata.json` has them as 0; (d) the client has no NPC stats, so no boss damage intake; (e) Block, Accuracy, Evasion rating curves are not in the client; (f) cross-class DPS is not calibrated (engine Chanter 9.9k vs Cleric 4.1k, while couga54 says Chanter and Cleric are the two lowest damage dealers), which poisons any "own DPS vs party uplift" comparison.
7. Cheapest first step that needs no new data: a "party survival toolkit" card (which defense, heal, party-buff and cleanse skills are equipped, with cooldown and duration from our data) plus hand `role:` tags for Cleric and Chanter (they have none). Second step: party buff value = status uptime from the existing simulator times the DPS gain of a reference ally with the buff's stat mods applied.

## 2. Cross-class findings

### 2.1 What players optimize for

| Class | KR (Inven, Jul-Oct 2026) | Global guides (Oct 2026) | Disagreement |
|---|---|---|---|
| Templar | Clear time and peak DPS with a Block floor. Natural-block targets from one author: Expedition 2,400-2,500, Transcendence 3,100 (Inven 23115). Nightmare 30-40 s clears open with banner, Taunt, charged Punishment (Inven 27235, summary). Threads question the tank identity and say Gladiator is the real main tank in Nightmare Ateron (26129, 24561). | couga54 (SolAshur): damage-lean group tank, ELP, Banner, Doom Shield, Taunt. gegebase and expcarry: tank-first, Block, Damage Tolerance, HP, Accuracy, Enmity. shugo: "the tank every group wants; damage is modest". | Emphasis only. Same tools. |
| Cleric | Damage between heals (09-24 guide: Condemnation, Bolt, Divine Aura to 20, Earth's Retribution macro). Raids: cooldown timing of Salvation, Yustiel's Power, Light of Protection, Benevolence, Radiant Recovery, Absolution (Inven 28996). Many threads complain healers are expected to DPS (26810 by title, 26813 summary). | couga54: "a healer that has to deal damage". gegebase: pure healer or support-DPS, priority "prevent damage, maintain HP, cleanse, buff, DPS in safe windows". | couga54 vs gegebase on how much DPS. |
| Chanter | Melee damage in the Dark Crush window plus mantra uptime; KR 6-slot fixed set Undefeated, Sprint, Storm, Marchutan, Guardian Blessing (Inven 20297, summary; I read 수축 as Guardian Blessing [L]). Players say the class is redundant with Cleric and parties run without it (23224, summary). | couga54: Undefeated Mantra 20 first, Power of the Storm, Marchutan's Wrath 1, Focused Defense 5. gegebase: "support first, healer second, melee DPS third". shugo: B tier, "groups on Global take one at most". | Whether the party buff earns a slot. |
| Spiritmaster | Four-spirit damage rotation, spirit order Water, Earth, Fire, Ancient Spirit timing (Inven 10286, summary). | couga54 and gegebase: pure damage dealer, no party support. couga54 stresses the snapshot rule (a spirit copies your stats and buffs at the moment it is summoned). | Wind Spirit: couga54 skips it, KR says four spirits beat three (summary). shugo "party buffs" is wrong. |

### 2.2 KR vs Global differences that break copy-paste

- Caps [H, our data]: KR level 50, stigma rank cap 25, 6 stigma slots, a ninth class (Brawler, 권성). Global level 45, stigma cap 20, 4 slots, no Brawler. KR Sanctuary advice such as "Salvation 25, Yustiel 25, Light of Protection 25" cannot be copied; recompute at 20 with 4 slots.
- Patch volatility [M, gegebase and aion2hub patch notes]: KR 08-12 healing rewrite (heal range 25 m to 40 m, most heals 20% to 50% weaker, base heal amplification removed, the Attack-scaled amplification raised to 26/30/34% on the Cleric's Healing Enhancement and added at 18/21/24% on the Chanter; Abyss and Arena heal-received debuff 30% to 20%). KR 08-26 Templar overhaul, then 09-02 and 09-04 tuning (Vicious Strike +30% then +20% PvE, Judgment +15%, Punishment +20% then -10%, Pummel -10%, Executor cooldown 10 s to 20 s, Warding Strike cooldown 25 s to 30 s). Prayer of Amplification cooldown 90 s to 60 s on 09-04. Any guide older than 09-16 is stale. expcarry says the same.
- Fury: our client-derived text says Fury gives PvE Damage Boost to the party on Block. A KR thread of 08-29 says the Templar's party synergy was taken away (24561, summary). Verify against the Global client before we show "party Fury".
- Non-stacking: Cleric Light of Protection and Chanter Undefeated Mantra do not stack; only the higher skill level applies and Undefeated Mantra wins ties [H, both skill texts]. In a party with both classes one slot is wasted, so the Cleric swaps Light of Protection for Absolution (Inven 28996, couga54).

### 2.3 Source list with reuse terms

Verdicts: ALLOWED = explicit permission with conditions; LINK = link and credit only, paraphrase facts, no copying of text or screenshots; ASK = LINK, and ask the author before showing anything verbatim; SKIP = do not ingest.

| Source | What it is | Terms found | Verdict |
|---|---|---|---|
| aion2sm.com (Evripides, "ereskus") | Spiritmaster guide | Site says "You're welcome to build on this one", wants credit to ereskus with a link to aion2sm.com, "don't copy the whole guide or rehost it", "don't sell it or pass it off as yours" [M, fetch summary] | ALLOWED with credit and link, no wholesale copy |
| couga54.github.io/aion2-guides (GitHub Couga54/aion2-guides) | Static guide site, all classes, EN/RU/UK | Repo has no licence (API `license: null`). Site: "Unofficial fan site ... AION 2 and its skill icons are (c) NCSOFT". README: data via questlog.gg, builds "come from creators' guides" listed on each page. Source creators (SolAshur, trueeevil, Kaeria, notXeon, WallyJTV, Arthars, Evripides, DankRNG, aLuckyRO, Grobs) own their guides | ASK (we already cite its rotation orders as `community` entries with link) |
| gegebase.com | Wiki-style class guides with patch history | "Reference data for AION 2 compiled for GEGEBASE. Game assets and names belong to their respective publishers." No author, no licence. robots allows pages, disallows /api/ | LINK |
| inven.co.kr board 6438/6451/6452/6454 | KR class boards (6438 Templar, 6452 Cleric, 6451 Chanter, 6454 Spiritmaster, 6444 tips) | Terms 2024-03-11: Art. 15(1) post copyright belongs to the author; Art. 15(2-3) Inven may reuse and sublicense within its own scope; Art. 10(2) members may not copy, distribute or commercially use copyrighted content without consent. Footer "Copyright (c) Inven. All rights reserved." robots.txt does not disallow /board/aion2/. Most guides are screenshots | ASK (author credit with link; no screenshots) |
| arca.live/b/aion2 | KR channel | Terms not located. robots allows /b/. Operated by umanle S.R.L. | LINK |
| gall.dcinside.com (aion2 minor gallery) | KR gallery | Terms not found. robots disallows ClaudeBot, anthropic-ai, Claude-Web, GPTBot | LINK only, never fetch from agents |
| questlog.gg | DB and user build planner (usage % are from user-submitted builds) | "questlog.gg is not affiliated with Aion 2 (NCSOFT)". Terms page not readable by our fetcher. Builds show the author name | LINK (cite usage % with date and link; do not mirror builds) |
| aion2hub.com | DB, planner, patch notes | "(c) 2026 AION2 Hub, an unofficial fan-made companion." No data licence. robots disallows /api/. Role templates are by "Ironskin", labelled "orientative test build" | LINK (templates are not community consensus) |
| shugo.gg | Armory, tier list | "(c) 2026 Shugo.GG. All rights reserved." Terms page exists, body not retrieved. robots disallows /api/ | LINK |
| expcarry.com, u4n.com (and forum.la-boite-a-pain.com mirror), pixelnitro.com, mmoexp.com, noping.com, oslink.io | Currency and boosting sellers' SEO guides | "(c) 2026" notices. Skill names often do not match the client (U4N: Iron Wall Defense, Shield of Nezacan, Healing Wind, Holy Breath, Immortal Curtain; PixelNitro: Chalice of Vigor). expcarry's Templar page is the best of them and matches client names | SKIP for data; expcarry LINK at most |
| reddit.com | Threads | Not reachable here; terms not checked | LINK |
| namu.wiki | KR wiki | Cloudflare 403, Aion 2 pages not read. Licence is CC BY-NC-SA 2.0 KR to my recollection, NOT verified this session | LINK until verified |
| YouTube creators | Video guides | Platform terms only | LINK or official embed, no transcript copying |

Suggested display policy: each role preset shows our derived list (skill names and ranks are game facts), a one-line "who recommends it" with the author's name, date and a link, and no copied prose. For anything beyond that, message the author (Inven note, Discord) and ask.

### 2.4 KR slang to our data (verified against `name_kr`)

Templar: 맹격 Vicious Strike, 연난 Pummel, 심판 Judgment, 징벌 Punishment, 주징 Empyrean Lord's Punishment (stigma), 도발 Taunt, 보방 Shield of Protection, 파방 Doom Shield, 고갑 Noble Armor, 이갑 Second Skin, 전보 Comrade in Arms, 깃발 Battlefield Banner, 나포 Grapple, 포획 Poach, 방강 Shield Smite, 방돌 Shield Rush, 비호 Warding Strike, 섬멸 Annihilate, 격앙 Fury, 모욕 Insulting Roar, 충적 Impact Hit, 철벽 Ironclad Defense (and the Endurance stat), 막기 Block, 민첩 Dexterity (scales Block %), 이해도 the "understanding" pet-stat track.
Cleric: 치빛 Healing Light, 쾌광 Radiant Recovery, 재생의 빛 Light of Regeneration, 생권 Benevolence, 유스 Yustiel's Power, 보빛 Light of Protection, 구원 Salvation (the "무적" in raid chat), 면죄 Absolution, 단죄 Condemnation, 벽력 Bolt, 벼락난사 Lightning Strike Scattershot, 신성한 기운 Divine Aura (but 고결한 기운 is the stigma Noble Aura), 대지의 징벌 Earth Punishment, 증폭의 기도 Prayer of Amplification, 심판의 번개 Judgment Thunder, 대지의 응보 Earth's Retribution.
Chanter: 암격쇄 Dark Crush, 격파쇄 Onslaught, 회전격 Spinning Strike, 백열격 Incandescent Blow, 타격쇄 Impactful Crush, 쾌주 Recuperation, 불패 Undefeated Mantra, 질주 Sprint Mantra, 질풍 / 풍 Power of the Storm, 말쿠 Marchutan's Wrath, 수축 Guardian Blessing.
Stats: 무피증 weapon damage boost, 피증 damage boost, 치피증 crit damage boost (my reading), 전피증 front-attack damage boost (my reading), 강타 Smite/Double chance, 공증 attack increase, 피내 Damage Tolerance, 정신력 the MP pool, 전속 combat speed.
Known WebFetch errors to ignore: "Dark Shock", "Crushing Blow", "Wind Authority", "Quick Recovery", "Radiant Blessing" and "Incoming Heal Increase (전피증)" in the Inven summaries are mistranslations.

## 3. Templar (tank)

### 3.1 Role in practice

- Global guides (questlog, couga54, shugo, expcarry): main tank for dungeons and raids. Keep the boss turned away from the party, gather adds with Poach and Grapple, hold threat with Taunt and Insulting Roar, block big hits so Fury covers the party, time Second Skin, Shield of Protection and Nezekan's Shield for heavy hits. Punishment's Executor buff and Battlefield Banner keep personal damage from collapsing. shugo tier list 2026-09-29: PvE A, "the tank every group wants; damage is modest but the slot is always open". [M]
- KR players argue about whether the class has a tank identity. 08-29 "Is the Templar designed as a tank?": the party synergy Fury was the only thing it brought and it was removed (Inven 24561, summary). 09-11: a Gladiator and a Templar both clear Nightmare Ateron in 34 s and the poster says Gladiator should now be recognised as the top tank (26129, summary). Nightmare dungeons are timed clears, so the Templar there is banner plus Taunt plus charged Punishment (27235, summary). [M]
- KR tank min-maxing is about Block and effective HP, not about threat. Inven 16260 (EHP and damage reduction formula), 27401 (Block efficiency table), 27173 (everyone says Block 2,700, mine is 2,290 with Dexterity on every armor piece and the Space bracelet). [H]
- Tank kit from our client-derived data [H, description values, rank not stated]: Shield of Protection guarantees Block and adds +100% Block damage reduction for a short window and restores 110 MP once on Block; passive Warding Shield +200 Block, heals on Block, 3 s cooldown; Fury gives PvE Damage Boost to caster and party on Block for 20 s; Insulting Roar +100% Enmity Boost and Attack on Front Attack; Taunt 155% ATK, Shrink 15 s (-200 Accuracy, -10% Attack), Taunt status only on players; Warding Strike heal plus +20% Damage Tolerance 10 s (spec rank 16: +10% to party); Nezekan's Shield party shield of 41% Max HP at rank 1, 50% at 10, 60% at 20, 65% at 25, for 3 s, 60 s cooldown; Comrade in Arms +20% Tolerance and 50% redirect of party damage for 6 s, 120 s cooldown; Second Skin +30% Tolerance 10 s, 90 s; Armor of Balance +50% impact-type resist; Noble Armor +5.4% Max HP and a 5.4% heal; Guarding Seal shield 21% Max HP below 50% HP, 60 s; Banner Attack proportional to Defense, 10 s, 90 s.

### 3.2 Role builds we could show

Stigma frequency across the six written Templar guides I read (couga54, gegebase, expcarry, Arca, DC, Inven Nightmare): Taunt in all six; Doom Shield and Shield of Protection in five; Empyrean Lord's Punishment (ELP) in four or five (gegebase's "Punishment" in its stigma list is ambiguous); Battlefield Banner in four; Second Skin in three; Nezekan's Shield, Comrade in Arms, Noble Armor as swaps. Questlog usage (live page as rendered by the search engine on 10-04; population not stated, the Cleric and Chanter pages list 237 and 234 user-submitted builds): Doom Shield 62%, Banner 56%, Noble Armor 48%, Shield of Protection 46%, Taunt 46%, ELP 40%, Executing Blade 23%, Nezekan's Shield 20%; actives Punishment 92%, Warding Strike 91%, Poach 91%, Shield Smite 89%, Judgment 88%.

- T1 Group tank, tank-first. gegebase (https://gegebase.com/games/aion2/templar_pve_guide), expcarry Build 1 (https://expcarry.com/aion-2-templar-guide), aion2hub template "Templar PvE Tank" (https://aion2hub.com/builds). Stigmas: Taunt and Shield of Protection first, then Second Skin, Doom Shield, ELP; Nezekan's Shield situational (60% Max HP shield at rank 20, matches our data). Specs: Judgment, Vicious Strike, Punishment 3+4+5, Shield Smite 2+4. Stats: Block, Damage Resistance, Damage Tolerance, Max HP, Enmity; magic stones Block, HP, Resistance, Accuracy, Attack. Rotation: Taunt, Punishment, Vicious Strike chain, Judgment, Shield Smite, Pummel. Named mistakes: late Taunt, stacking all cooldowns, MP starvation. [M]
- T2 Group tank, damage-lean (Global meta). couga54 (https://couga54.github.io/aion2-guides/en/templar/, from SolAshur 09-27/29 and trueeevil 10-02). Stigmas ELP 15, Banner 15, Doom Shield 15, Taunt 5; swap Nezekan's Shield or Comrade in Arms for survivability; solo swaps Taunt for Nezekan's Shield; PvX adds Executing Blade. Ranks: Judgment, Punishment, Pummel 20; Annihilate 16 to 20; Shield Smite 16. Passives Fury, Punishing Benediction, Insulting Roar, Ironclad Defense. Stats: "Block + Evasion + Dexterity" early, "Block + Endurance + Ironclad Defense" late; Arcana "damage set effects over survivability". Hotbar: Judgment line on a side button, Pummel line on RMB, charged Punishment, Banner, ELP, Taunt by hand. [M]
- T3 KR PvE setup (Inven 23115, 08-21, https://www.inven.co.kr/board/aion2/6438/23115, raw text [H]). Specs by option number: Vicious Strike 3,4,5; Pummel 2,3,4; Poach 1,3; Judgment 3,4,5; Warding Strike 2,5 (1,5 optional); Shield Rush 2,4; Punishment 2,3,5. Passives Fury, then Insulting Roar, then Impact Hit. Armor tuning lines carry Attack Increase, Smite, Fury, Insulting Roar, Impact Hit (or Dexterity or Block); targets Smite 75-80 and front-attack damage boost 40 or more. Arcana four Guardian plus four Punishment pieces. Hand-cast: Taunt, Punishment, Noble Armor, Warding Strike (for boss mechanics, when hurting, or when Judgment is empty); Shield of Protection every 20 s or on boss CC mechanics; Poach and Shield Rush when engaging.
- T4 Natural-block tank (KR). Inven 16260, 27401, 27173 [H]. Block targets from one author: 2,400-2,500 Expedition, 3,100 Transcendence. Dexterity beats flat Block on armor tuning once pure Block is near 2,000. Formulas in 3.3.
- T5 KR Nightmare speed clear (Inven 27235, summary). Banner, ELP, Taunt, Doom Shield, plus Shield of Protection or Second Skin; pre-cast the banner 8-10 s before the pull; save Taunt, Banner, Punishment for the red-pattern phase. [M]
- T6 Early KR S1 guide with S2 notes (Arca, https://arca.live/b/aion2/159822449, Jan 2026, raw text [H], stale for numbers). PvE stigma trio ELP 10, Taunt 5 to 20, Shield of Protection 5 to 15, plus one free slot. Actives: Vicious Strike and Judgment 16-20 first, then Pummel 16-20 and Warding Strike 16, Flash Rampage 16. Passives: Fury first, then Enhance Health, Ironclad Defense, Impact Hit. Says Templar "is not a dealer position".
- T7 PvP / Abyss party protector. couga54 PvP: Executing Blade 10, ELP 15, Doom Shield 15, Nezekan's Shield 15 (alts Second Skin, Comrade in Arms, Assault Fury). expcarry Build 5: Nezekan's Shield, Comrade in Arms, Grapple, Armor of Balance or Second Skin. KR PvP tuning (23115): Defense, Status resist, Ironclad, Survival Will lines. [M]
- T8 aion2hub seeded templates "Templar PvE Tank" and "Templar PvP Tank" by user Ironskin, labelled "orientative test build": Defense, HP, Block; Justice, Life, Space Pantheon. Useful only as a stat-priority template, not as community consensus. [H that they exist, L as advice]
- Videos: tank guide https://www.youtube.com/watch?v=efdy2Ecnr6M (Fire Temple tank), SolAshur META build https://www.youtube.com/watch?v=ayyzLdGOaNc, https://www.youtube.com/watch?v=f3gxUdec82U (Latest Templar PVE Build for Global). Titles only, not watched.

### 3.3 Stats the role values

- Block: rating and Block % (Dexterity scales Block %). Shield of Protection forces a Block; Fury triggers on Block. Inven 27401: with pure Block 2,000 and a Block bonus of +50% (total 3,000), 30 Dexterity gives 3,060 vs 3,045 for 30 flat Block, and Dexterity wins once pure Block passes about 2,000. One search summary gives a recommended Block of 2,100 (source unverified). [H for 27401]
- Damage Tolerance and effective HP (Inven 16260 [H]): EHP = HP / (1 - damage reduction); Damage Tolerance equals damage reduction; capped at 80%; it is offset by the enemy's damage amplification; Ironclad (Endurance) 1% = 0.5% damage reduction; Regeneration 1% = 0.2%; the Block reduction curve is "not yet measured". A Daevanion +100 HP is worth about +200-250 effective HP because gear multipliers apply. Endurance halves a hit (client text, couga54: at 100% Endurance a hit deals 50% less).
- Max HP: Daevanion flat HP nodes (100 per node in our data), Enhance Health passive (+7.5% Max HP), Noble Armor (+5.4%).
- Accuracy: DC and Arca guides say the tank needs it or the boss's front defense eats damage and threat falls behind rear DPS (summary). gegebase keeps Accuracy in the tank list.
- Enmity: Insulting Roar +100% Enmity Boost, Taunt flat Enmity, Vicious Strike, Pummel and Judgment add Enmity (questlog). Flat Enmity values are "-" in our data.
- CDR and Combat Speed: more Judgment procs; Vicious Strike spec 4 cuts Warding Strike cooldown and Pummel spec 4 cuts Punishment cooldown (gegebase "interconnected CDR loops").
- KR damage-lean stats: Smite 75-80, front-attack damage boost 40+, weapon damage boost, Combat Speed (23115 also mentions a Judgment speed cap of 116.7%, meaning unclear [L]).

### 3.4 Daevanion paths

- Our board data [H]: per node Attack +3, Defense +30, HP +100, MP +50, Critical Hit +5, Critical Hit Resist +5; orange (Unique) nodes Combat Speed 1.5%, Cooldown Reduction 1.5% (Nezekan), Damage Tolerance 1.5% and Damage Boost 1.5% (Zikel), Critical Damage Boost and Tolerance (Vaizel), Multi-hit (Triniel), PvP stats (Azphel); skill nodes +1 rank each, 22 per board on the first four boards, no Block or Enmity node exists.
- couga54 (damage-lean): blue nodes Judgment, Punishment, Pummel, then Shield Smite and Annihilate, then orange Combat Speed and CDR (Nezekan), Damage Boost and Damage Tolerance (Zikel); skip MP nodes (take Attack), Flash Rampage, Warding Shield and Guardian Shield nodes; Azphel is PvP only.
- gegebase (tank-first): defensive skill levels, Block, HP, Damage Resistance and Tolerance, Enmity, Accuracy, Attack. Its Block and Enmity steps cannot be Daevanion stats, so treat that paragraph as unreliable. [M]
- Inven Roah 22546 (08-10, summary of a node-optimizer post): per board take Additional Attack, then Critical Hit, then Additional Defense, then HP, then Critical Resist; the PvE-only alt takes the first four fully and then MP; the green Survival Will node is valued for CC resilience; claims about +3,000 combat power versus hand-picking. [M]

### 3.5 Specialties people pick (names from our data)

- Vicious Strike: +50% Multi-Hit, -2 s Warding Strike cooldown on hit, Threatening Blow chain. Pummel: Punishing Strike absorbs 3% HP, -1 s Punishment cooldown on Punishing Strike, one extra Punishing Strike (rank 16). Judgment: extra damage on hit, Critical Hit on hit, remove cooldown (rank 16). Punishment: damage over time, +30% Skill Speed, ignore Block and Evasion with a guaranteed crit (rank 16); couga54 says never take the mobile or HP-absorb picks. Shield Smite: 50% chance to trigger Debilitating Smash, -2 s cooldown, or remove MP cost and restore 200 MP. Warding Strike: +100 Block during Warding, -5 s cooldown, party +10% Damage Tolerance (rank 16).
- Stigma specs: Doom Shield 5 resets Annihilate, 10 gives +200 Block for 5 s, 15 resets on a kill. ELP 15 gives +10% PvE Damage Boost for 10 s. Banner 15 adds +20% Attack proportional to Defense, 20 gives -30 s cooldown. Taunt 5 adds 10% Damage Tolerance reduction to Shrink, 15 gives -5 s cooldown. Nezekan's Shield 15 gives +20% PvE Damage Tolerance during the shield, 20 restores 20% Max HP when the shield is removed. Comrade in Arms 20 restores 50% Max HP at the end. Second Skin 20 adds +20% Damage Tolerance.

### 3.6 What our engine does today (Templar)

Run 2026-10-04, boss 180 s, level 45, baseline stats: DPS 6,729. Stigmas picked: ELP (+3.8%), Doom Shield (0.0%), Executing Blade (+1.2%), Taunt (+0.9%). Banner, Shield of Protection, Second Skin, Nezekan's Shield and Comrade in Arms are never chosen because nothing they do is a DPS effect. The 10-03 note shows 3 of 4 overlap with couga54's set and a tie in model DPS (6,656 vs 6,652).
- Trade-off variants: only "Sustain (Noble Armor), costs 0.3% DPS". The "Survivable" variant never appears because `_variants` skips a tag when any chosen stigma already carries it, and Doom Shield carries `role:defense` even though its defense is a 5% Max HP shield.
- `fury_buff` is a permanent +15% damage boost (uptime 1.00) with no Block model, so the engine gives the Templar a party-facing buff at 100% uptime for free. `battlefield_banner` has no stat mod, so "Attack proportional to Defense" is worth 0 (there is no Defense in `Stats`).
- Role tags in the class data: `role:defense` 17, `role:cc` 11, `role:burst` 5, `role:mobility` 4, `role:support` 3, `role:heal` 2, `role:sustain` 2, `role:aggro` 1. They feed only the variants and keybind layout (defense and cc skills are placed on manual keys), never a score.

### 3.7 What a Templar role score could be

Report three numbers, never one (see section 9 for the shared design).
- Survival: EHP multiplier = 1 / ((1 - DT) x (1 - 0.5 x Endurance) x (1 - block share)), time-averaged over the simulated cooldown windows (Warding 10 s of 30 s, Second Skin 10 s of 90 s, Nezekan's 3 s of 60 s, Noble Armor and Guarding Seal as listed). The windows and uptimes already come from the simulator; the magnitudes need a new `dt_pct` stat mod.
- Fury and Block service: P(block in a 20 s window) from Block rating and Block %, then Fury uptime for the party; today Fury is assumed 100%.
- Threat: sum of casts x (damage x (1 + Enmity Boost) + flat Enmity) against a reference DPS ally; needs flat Enmity values.
- Party service: Nezekan's shield (41% of Max HP at rank 1, 60% at rank 20, per party member per 60 s), Comrade in Arms redirect, Warding spec +10% party tolerance, Banner for self.
- Own DPS from the engine, because KR players tune for it.

### 3.8 Gaps (Templar)

`Stats` has no HP, Defense, Block, Damage Tolerance, Endurance, Enmity. No Block % formula (client has no rating curves; community measures Dexterity and Block by hand). No flat Enmity values. Descriptions give shield and tolerance numbers as text at an unstated rank. No boss damage intake, so EHP cannot be turned into survival time. Fury's party scope is unconfirmed for Global.

## 4. Cleric (healer)

### 4.1 Role in practice

- Global: couga54 says "a healer that has to deal damage: rewards depend on your contribution" and to top people up after hits and put everything else into damage. gegebase says "prevent damage, maintain party HP, cleanse dangerous effects, buff the group, DPS during safe windows", offers a pure-healer and a support-DPS build, and says a Cleric with +10% personal DPS who lets the tank die contributes less than a near-zero-DPS Cleric with perfect uptime. Questlog: every dungeon or raid group wants a Cleric, keep the tank alive with Healing Light, top up with Radiant Recovery, save Absolution and Yustiel's Power for heavy phases. shugo: A tier, "main healer, essential for hard content; low personal damage". [M]
- KR 09-24 optimization guide (Inven 29213, raw text [H]; the post plugs a paid Discord consulting service, and the Templar board has threads about a "consulting incident", 27369 and 27405, relation not checked): taking damage stats costs a Cleric nothing in care ability, and stacking HP or heal stats does not raise care ability either, so build for damage. Heal skills are kept on separate keys: Healing Light for one or two people, Radiant Recovery when most of the party is in danger. Combat speed cap for Cleric is 94.4 while other classes pass 121.6 (the author asks players to file a complaint). A Chanter's Power of the Storm is a net loss for the Cleric (cap not pierced, faster Chain of Torment and Earth Punishment refreshes cost damage through animation), and another Cleric's higher-level Chain of Torment overwrites yours.
- KR raid reality (Inven 28996, raw [H], Sanctuary of Lament, 09-14): healing is a cooldown choreography. Without a Chanter the author runs Salvation 25, Yustiel's Power 25, Light of Protection 25. Before the "sprinkler" pattern: party 1 gets Benevolence and Yustiel's Power (with the Templar's Nezekan's Shield at the same time); party 2 gets Benevolence, Salvation, Yustiel's Power. When a line-AoE hits the tank, Salvation just before the cast ends. Hiding behind a pillar: Radiant Recovery with 0.2 s of cast left so it does not stagger. At the 50% pattern, Yustiel's Power plus Benevolence before the first Zikel zone to stop a one-shot. In the wave phase stay within 40 m of the tank and cycle Benevolence and Radiant Recovery, then Yustiel's Power and Salvation after the move. [H] The Sanctuary raid is 10 players (client data, `research/playstyles_gamedata_2026-10-04.md`) and the guide schedules healing per party ("1파티", "2파티"), so each party presumably has its own Cleric [L].
- KR complaints (Inven 26810 by title only, 26813 and 29198 summaries): healers are expected to DPS, Sanctuary 4 is called "hell" for healers. 28859 (raw [H]): a melee DPS who never blocked or dodged and died, a party where the Cleric ran Radiant Recovery, Absolution, Benevolence and three cleanses and was still blamed, and "when the meter shows a Cleric with high damage, people say healers do not heal".

### 4.2 Role builds we could show

Questlog usage (our 10-03 scrape of the live page; user builds, population not stated; average stigma level 10-15): Light of Protection 36%, Earth Punishment 27%, Prayer of Amplification 23%, Noble Aura 23%, Absolution 17%, Summon Resurrection 17%, Benevolence 15%, Yustiel's Power 13%, Voice of Doom 10%, Salvation 8%.

- C1 Damage-dealing healer (Global meta). couga54 (https://couga54.github.io/aion2-guides/en/cleric/; Kaeria TW video 09-28, aLuckyRO, trueeevil). Stigmas Earth Punishment 15 to 20 (Condemnation always crits, so it has no cooldown), Light of Protection 20, Prayer of Amplification 10+, Noble Aura 10+; swaps Absolution, Benevolence, Summon Resurrection, Yustiel's Power (Sanctuary), Voice of Doom. Ranks: Condemnation, Divine Aura, Bolt 16 to 20; Judgment Thunder, Lightning Strike Scattershot, Healing Light, Radiant Recovery 16; Earth's Retribution 12 to 16. Passives: Empyrean Lord's Grace (top), Earth's Grace, Healing Enhancement, Radiant Benediction. Hand-cast: Healing Light, Radiant Recovery, fully charged Bolt, Prayer of Amplification. Our engine's boss stigma set equals this exactly (4/4). [M]
- C2 Pure healer or support-DPS. gegebase (https://gegebase.com/games/aion2/cleric_pve_guide). S tier: Light of Regeneration, Healing Light, Radiant Recovery, Absolution, Benevolence; A+: Light of Protection, Debilitating Mark, Bolt; critical support: Prayer of Amplification and Salvation. Stats: pure healer Attack and healing scaling, HP, defensive stats, cooldown efficiency, crit; support-DPS Attack, crit, crit damage, PvE damage amp, Accuracy, HP. Rotation: Light of Regeneration, Healing Light, Radiant Recovery, Absolution or Benevolence as needed; burst window Debilitating Mark, Prayer of Amplification, Bolt, Divine Aura. [M]
- C3 Sanctuary cooldown healer (KR). Inven 28996 (https://www.inven.co.kr/board/aion2/6452/28996). Needs KR caps (rank 25); at Global caps (rank 20, 4 slots) the same three tools take 3 of 4 slots, leaving one for Benevolence, Absolution or a damage stigma. With a Chanter in the party swap Light of Protection for Absolution (28859, couga54). [H]
- C4 KR damage-optimized Cleric (09-24, https://www.inven.co.kr/board/aion2/6452/29213, raw [H]). One skill-macro line: Earth Punishment, Divine Aura, Condemnation, Chain of Torment; Debilitating Mark is not essential ("defense shred is meaningless"; use it when the party is hurting); Bolt by hand; Lightning Strike Scattershot on Stagger for the cancel trick; Judgment Thunder only for the Corridor and adds. Rank 20: Condemnation, Earth's Retribution, Bolt, Divine Aura; Healing Light and Radiant Recovery 16 is enough, 20 also removes two debuffs. Passive Earth's Grace over Empyrean Lord's Grace. Recast target 32.6%. Bracelets Justice and Space instead of Freedom and Death. Pantheon Illusion 51, Wisdom 101.
- C5 KR healer guide (Inven 657, 2026-01-28, https://www.inven.co.kr/board/aion2/6452/657, raw [H], pre-08-12 numbers). Mastery order after cap: Judgment Thunder 16, Radiant Recovery 16, Healing Light 16, Light of Regeneration 16, Radiant Recovery 20, Condemnation 20, Light of Regeneration 20, Healing Light 20. Stigma order: Absolution 5 (until Radiant Recovery 20), Light of Protection 10, Summon Resurrection 1, Salvation 1, Prayer of Amplification 5, then Light of Protection 15, Prayer 10, Earth Punishment 5, Earth Punishment 20, Prayer 15, Salvation 15. PvP: Absolution 20, Yustiel's Power 20, Salvation. Arcana: Vitality Chalice (Siel), Vitality Parchment (Yustiel), Magical Compass (Triniel), Magical Bell (Zikel), Vitality Mirror (Kaisinel); Radiant Recovery as a fixed line on the Chalice.
- C6 PvP battle healer. couga54 does not cover Cleric PvP; Inven 657 and the aion2hub template "Cleric PvP Battle Healer" (Healing, HP, damage defense, cleanse and protection stigmas, Life, Wisdom, Justice Pantheon). [L]
- C7 aion2hub seeded template "Cleric PvE Healer" (user Ironskin, "orientative test build"): Healing, MP and Willpower focus, HoTs, Life, Wisdom, Illusion Pantheon. Template only. [L]
- Videos (titles only): https://www.youtube.com/watch?v=hEft_jbIG_I (balance healing and damage, macro setup), https://www.youtube.com/watch?v=VTD6cbqJj1U (healing, builds and endgame), https://www.youtube.com/watch?v=A3pZDSt4ceU (latest Cleric PvE build for Global).

### 4.3 Stats the role values

- Attack is the healing stat since the KR 08-12 patch: the base heal amplification was removed and the Attack-scaled amplification was raised to 26/30/34% on Healing Enhancement (Cleric) and added at 18/21/24% on the Chanter's Blessing of Life (aion2hub patch notes, gegebase). So damage stats and heal power are one investment. gegebase's pure-healer list starts with "Attack Power / Healing scaling". The older KR guide (Jan, HP first) predates this. [M]
- Combat Speed: class-specific cap 94.4% (29213) versus 121.6% for others; our `class_caps` extension is ignored by the loader, so the engine over-credits Combat Speed for a Cleric. [H for the quote, M for the number]
- Cooldown: about 32.6% recast reduction is the stated sweet spot for the DoT lines (more costs damage through animation); Salvation's cooldown drops with rank (150 s at rank 1 to 112 s at rank 20 in our data); CDR cap 60% (client UI text). [H raw]
- Crit and crit damage (Earth's Grace, Empyrean Lord's Grace; couga54: "a Cleric is always short on crit"), Accuracy, Damage Boost, Weapon Damage Boost, Smite. Skip status resist, evasion, defense lines (couga54). [M]
- HP and Defense: the old KR guide ranks HP, Defense, Crit Resist above Attack because it believes Earth's Grace keeps the party attack buff only while the Cleric stays at 75% HP or more; Primal Vigor 2/4-piece gives +60/+150 PvE Attack at 70% HP or more. Our client text for Earth's Grace says only Critical Damage Boost +10.5% and Accuracy +100 for the caster, so the 75% claim is unverified. [L]
- MP: solved by skills, not stats. Earth's Retribution restores 110 MP per hit, Condemnation spec +100 MP, Blessing of Regeneration restores 40% MP (cooldown 120 s at rank 1, 72 s at rank 25), Healing Light costs 50 MP, the Mana arcana 2-set restores 1,500 MP at 20% or less, Wisdom cuts MP cost. U4N and aion2hub talk about "MP recovery" as a stat; no KR or couga54 guide does. [M]
- Heal numbers by rank (research/classes/cleric/skills.json from the aion2.app client dump 2026-09-18, pre-Heal-Boost [H]): Healing Light 192-211 (rank 1), 1020-1122 (rank 20), cooldown 6 s, 50 MP. Radiant Recovery 379-417, 2012-2213, 12 s. Light of Regeneration 616-739 and 4315-5178 per 2 s tick for 30 s on a 30 s cooldown (always on). Absolution 1602-1762, 3464-3810, 90 s. Benevolence 90-100 and 482-530 per 2 s for 20 s, 90 s. Blessing of Regeneration 893-982 and 2261-2487 self heal. Back-of-envelope at rank 20 per target: about 2.4k HP/s from the HoT alone plus about 180 from Radiant Recovery and 180 from Healing Light, against a roughly 20k Max HP example from Inven 16260, which suggests throughput is not the constraint and spike timing and range are (consistent with the KR threads). [L, unverified without boss damage]

### 4.4 Daevanion paths

- couga54: orange Cooldown and Combat Speed first, then Attack and Critical, then blue skill nodes (Condemnation, Divine Aura, Bolt), defensive orange, passives last; Crit Damage Tolerance and Multi-hit Resist are useless in PvE; route about 229 points; Azphel PvP only. [M]
- Inven 657: blue skill nodes first, leftover to green passive nodes, orange main-stat nodes as the route target. Inven 27247 (Roah, summary): the same optimizer output as the Templar post (Additional Attack, Critical, Additional Defense, HP, Critical Resist, MP) and "all four boards apply to all classes". gegebase pure healer: Attack and healing scaling, HP, defensive, cooldown, crit. [M]

### 4.5 Specialties people pick (names from our data)

- Healing Light: +2 consecutive uses, +20% heal under 50% HP, 50% chance to remove 1 debuff, +2% HP restored (rank 12), -2 s cooldown (rank 16). Radiant Recovery: remove up to 2 debuffs, +20% Skill Speed, -3 s cooldown, +10% Incoming Heal for 10 s (rank 12), +5% HP restored (rank 16). Light of Regeneration: +5% Defense, +5% Incoming Heal, +20% heal under 50% HP, +5% Move Speed, and at rank 16 +5% PvE Damage Tolerance while healing. Condemnation: +100 MP on hit, up to +12% on fewer targets, reset cooldown on crit (rank 12), Multi-Hit (rank 16). Bolt: +30% Skill Speed, up to +20% on fewer targets, crit on hit (rank 16). Judgment Thunder: extra Divine Punishment (rank 16). Earth's Retribution: -7 s Bolt cooldown on Discharge (rank 12), ignore Block (rank 16). Lightning Strike Scattershot: -1 s all cooldowns on hit (rank 16).
- Stigma specs: Earth Punishment 5 forces a Condemnation crit, 10 gives +10% Double Chance to caster and +5% to the party through Earth's Blessing, 15 gives +10% Attack and Defense to caster and +5% to the party, 20 adds 10 s duration. Light of Protection 5/10/15/20: +10% Incoming Heal, +100 Accuracy, +10% Max HP, +10% Perfect Chance. Yustiel's Power 5/10/15/20: 10% Max HP shield, +100 Block and Evasion, +20% Status resist, +10% PvE Damage Tolerance. Prayer of Amplification: +20% PvE Damage Boost, x1.5 Empyrean Lord's Grace, x1.5 Earth's Grace, +15% Attack at 20. Salvation: +100% Incoming Heal, 20% Max HP at the end, base effect to the lowest-HP member (15), triggers on impact-type status (20). Absolution: -30 s cooldown, remove all debuffs, +5% heal, 1.5% HP every 2 s for 10 s. Benevolence: +10 s, stamina, +2% HP per 5 s, cleanse per 5 s.

### 4.6 What our engine does today (Cleric)

Run 2026-10-04: DPS 4,148. Stigmas Noble Aura (+28.6%), Light of Protection (+18.0%), Prayer of Amplification (+4.4%), Earth Punishment (+3.9%), the same four as couga54. Rotation: Prayer of Amplification, Noble Aura, Debilitating Mark, Bolt, Earth Punishment, Chain of Torment, Condemnation, Earth's Retribution. Engine DoT ticks are unknown for Chain of Torment, Earth Punishment and Debilitating Mark (warnings), so those deal 0 in the sim.
- Light of Protection is a permanent +18% self Damage Boost (rank-16 value), the party half of the buff is not counted, and the warning "equipped but never cast" is just the toggle model.
- `earths_blessing` exists as a status with no stat mods, so Earth Punishment's party Attack, Defense and Double Chance share is worth 0.
- Heals, shields, Salvation, Yustiel's Power, Absolution, Benevolence, Summon Resurrection are never candidates because they have no DPS effect.
- Trade-off variants show "Crowd control (Assault Mark) costs 0.7%" and "Sustain (Voice of Doom) costs no DPS". Voice of Doom is a DoT that cuts the enemy's Incoming Heal; it is tagged sustain only because the keyword fallback matched the word "heal". The Cleric has no hand `role:` tags (its tags are plain `defense` 10, `heal` 9, `sustain` 7, `party-buff` 3, `cleanse` 3, `cc` 2, `resurrect` 1), so `utility_tags` falls back to `_derive_tags`.
- No Light of Protection versus Undefeated Mantra rule, no 94.4% Combat Speed cap, `max_mp` 2000 and `mp_regen_per_s` 20 are placeholders.

### 4.7 What a Cleric role score could be

- Own DPS (exists) and Earth's Blessing and Light of Protection party uplift (needs party scope).
- Healing: per-target sustained HPS = sum of (average heal per rank x casts per second under cooldown, MP and Combat Speed limits) x (1 + heal amplification), with heal amplification = base + k x Attack, k from the 08-12 notes (formula unverified). Burst: heals available inside a 3 s window. Both use the per-rank heal table above.
- Survival tools: Light of Protection (PvE Damage Boost and Tolerance 10.5% at rank 1, +0.5% per rank, 20% at rank 20, a toggle), Yustiel's Power (+20% PvE tolerance, lasting 10 s at rank 1 and 20 s at rank 20, every 60 s, +10% more at the rank-20 spec), Salvation (3 s immunity, 150 to 112 s), Absolution, Benevolence, Summon Resurrection; coverage = fraction of a reference boss timeline covered by at least one party-wide mitigation; this part needs only cooldown, duration and a mechanic interval.
- Composition rule: with a Chanter present, Light of Protection is worth 0 unless it is the higher rank.

### 4.8 Gaps (Cleric)

Heal and shield numbers are absent from the app `gamedata.json` (flat_min and flat_max are 0, "no damage component"); Heal Boost formula unknown; Earth's Blessing base values unknown; class Combat Speed cap not modelled; no party scope; no non-stacking and overwrite rules; no boss damage intake; MP economy is placeholder; the description of Light of Protection contains leaked HTML.

## 5. Chanter (support)

### 5.1 Role in practice

- Global: couga54 calls it "melee support, buffer" and Undefeated Mantra "the reason a party takes a Chanter". gegebase: "support first, healer second, melee DPS third". Questlog: support comes from mantras and shields rather than large heals; heals cannot replace a Cleric in hard content; some buffs do not stack with Cleric buffs. shugo: B tier, "buffs and off-heals are useful, but groups on Global take one at most". Our 10-03 note records couga54 saying that at equal gear Chanter and Cleric are the two lowest damage dealers. [M]
- KR 09-17 optimization guide (Inven 22932, raw [H]): the author says Chanters are nerfed every patch and that, as a dealer, he appreciates Chanter utility in Sanctuary patterns. Practical advice: one skill-macro line, Dark Crush line ordered Dark Crush, Spinning Strike, Impactful Crush, Incandescent Blow; stack Guardian Blessing on top of Power of the Storm in one slot (frees room for Undefeated and Sprint as separate buttons); Marchutan's Wrath is no longer essential (Dark Crush uptime and DPS drop slightly, the slot can hold a Sanctuary utility stigma or Fracturing Blow); mouse-button one-key macro; the Chanter is "healing, damaging and watching patterns at once".
- KR sentiment (Inven 23224, 09-30, summary): the Chanter has no identity, the Cleric has nearly the same buffs, parties run without a Chanter, tooltips promise attack speed that players say they do not feel. 20297 (08-01, summary): players split KR 6-slot sets into a "care" set and a "sub-dealer" set and ask for better damage options among the secondary stigmas (Obliterate, Fracturing Blow). [M]
- Questlog usage (10-03 scrape): Undefeated Mantra 77%, Sprint Mantra 70%, Power of the Storm 55%, Marchutan's Wrath 54%, Guardian Blessing 20%, Focused Defense 18%, Healing Touch 12%, Fracturing Blow 11%, Impeding Authority 10%, Barrier Spell 9%, Ensnaring Mark 8%, Obliterate 5%.

### 5.2 Role builds we could show

- H1 Buffer (Global meta). couga54 (https://couga54.github.io/aion2-guides/en/chanter/; Arthars Gaming, notXeon, WallyJTV, TitanTheF). Stigmas: Undefeated Mantra 20 first (toggle, never in a macro), Power of the Storm 5 to 20, Marchutan's Wrath 1 (opens Dark Crush for 3 s), Focused Defense 5; alternates Sprint Mantra 10, Healing Touch when sole healer, Obliterate for stagger checks, Impeding Authority. Ranks: Dark Crush 16 to 20 (cooldown removed at 16, guaranteed crit at 20), Onslaught 16 to 20, Spinning Strike 16 to 20, Incandescent Blow 16, Recuperation 12 ("12 is enough"). Passives: Attack Preparation, Inspiring Spell, Wind's Promise, Impact Hit, Protection Circle ("best defensive passive"). Stats: Accuracy early, crit, crit damage, attack; manastones Attack, Crit, Accuracy. [M]
- H2 Support first. gegebase (https://gegebase.com/games/aion2/chanter_pve_guide). S tier: Undefeated Mantra, Spinning Strike, Dark Crush, Recuperation and Healing Touch (cut 20-50% on 08-12), Barrier Spell. Hybrid stat order: Attack, PvE damage, Crit, Crit damage, Accuracy, HP. Named mistakes: neglecting mantras, trying to out-heal the Cleric, ignoring Dark Crush procs, overhealing after the nerf. Decide with the Cleric who provides the amp before the pull. [M]
- H3 KR 09-17 optimization (Inven 22932): see 5.1; ranks Dark Crush 20, Onslaught 20, Spinning Strike and Recuperation near-mandatory; passives Wind's Promise, Impact Hit, Attack Preparation, Inspiring Spell if room; manastones Weapon Damage Boost; bracelets Justice and Space; Pantheon Illusion 51, Wisdom 101; understanding track for Smite. [H]
- H4 KR 6-slot sets: care set versus sub-dealer set (Inven 20297, summary [L]); KR 08-28 skill layout post (Inven 21630, summary): a "peak" setup with no Spinning Strike macro and by-hand Marchutan's Wrath and Ensnaring Mark, and a "practical" setup with a macro and Block instead of Ensnaring Mark; Spinning Strike specs 1, 3, 5; Dark Crush, Onslaught, Spinning Strike, Recuperation 20; full 21% damage resilience and 13,000+ Attack quoted. [L]
- H5 aion2hub seeded templates "Chanter PvE Support DPS" (party buffs and mantras, Attack and Critical Hit, Destruction, Life, Death Pantheon) and "Chanter PvP Bruiser". Templates only. [L]
- Videos (titles only): https://www.youtube.com/watch?v=K9aDbrjhwDA (build after the Dark Crush rework), https://www.youtube.com/watch?v=zxq03c3NhEw (Global skill guide), https://www.youtube.com/watch?v=EsxGbxt0k-4 (latest PvE build for Global).

### 5.3 Stats the role values

- Buff uptime and slots matter more than any stat: toggles stay on, Power of the Storm is the one timed buff (120 s cooldown, -30 s at stigma rank 5; caster +20% Combat Speed and -20% cooldowns for 10 s, party +20% and -10%; at rank 20 +20% caster Attack and +10% party Attack). Undefeated Mantra: PvE Damage Boost and Damage Tolerance 10.5% at rank 1, +0.5% per rank, so 20% at rank 20 and 22.5% at rank 25 (research/classes/chanter/skills.json tokens; the Cleric's Light of Protection follows the same ladder), then +100 Critical Hit (5), +100 Accuracy (10), +5% Critical Damage (15), +5% Double Chance (20), all for the party. Power of the Storm lasts 10 s at rank 1, 12 s at rank 5 and 20 s at rank 20 (cooldown 120 s, 90 s with the rank-5 spec). Earth's Promise: -5.4% target PvE Damage Tolerance per hit, no effect together with the Cleric's Chain of Torment. [H, our data]
- Own-damage stats: Accuracy (couga54: short early, you hit from behind otherwise), Critical Hit (Wind's Promise procs on crits), crit damage, Attack, PvE damage amp; CDR and Combat Speed (Power of the Storm, Spinning Strike and Onslaught cooldown links). KR players put Smite on understanding slots and damage amp on manastones.
- Healing and shield numbers: Blessing of Life adds heal amplification at 18/21/24% of Attack after 08-12; Recuperation 183-201 (rank 1) to 1228-1351 (rank 20), 15 s; Healing Touch 927-1020 to 1978-2176, 30 s; Sprint Mantra heal proc 127-140 to 271-298 on a 1 s internal cooldown; Impeding Authority party shield 16% Max HP for 20 s on 90 s; Barrier Spell keeps party HP above 10% for 3 s on 132 s ("cannot block certain powerful attacks"); Protection Circle gives a 3.1% Max HP Divine Barrier to the party after 10 stacks. [H, research skills.json and descriptions]
- Class Combat Speed cap: one KR post says a 122.6 cap that used to be pierced is now useless (22932). [L]

### 5.4 Daevanion paths

couga54: blue nodes Dark Crush, Onslaught, Spinning Strike, Incandescent Blow first, then Impactful Crush, Wave Blow, Defiance; Nezekan orange Combat Speed and CDR, Zikel Damage Boost and Tolerance, Vaizel Critical Damage; route about 279 points PvE. gegebase: no Daevanion list. [M]

### 5.5 Specialties people pick (names from our data)

Dark Crush: Critical Hit on hit, Piercing Strike chain (12), remove cooldown (16). Spinning Strike: -5 s cooldown, +10% Heal Boost up to 20%, ignore Block and land as a crit (16). Onslaught: +50% Multi-Hit, -1 s Spinning Strike cooldown on hit (12), Storm Chain (16). Incandescent Blow: Multi-Hit while ignoring Block (16). Impactful Crush: AoE, +30% Skill Speed (12). Recuperation: +1 consecutive use and HoT stacks twice, remove 2 debuffs, +4 s duration, +5% heal (12), -3 s cooldown (16). Power of the Storm: -30 s cooldown (5), +200 Accuracy (10), +200 Critical Hit (15), +20% caster and +10% party Attack (20). Impeding Authority 5/10/15/20: +15% Defense, +10% Incoming Heal, +10% PvE Tolerance, restore 7% Max HP when the shield ends. Barrier Spell: heal 10% at natural expiry, +10% Tolerance for 10 s, +10% HP floor, +1 s.

### 5.6 What our engine does today (Chanter)

Run 2026-10-04: DPS 9,909. Stigmas Undefeated Mantra (+15.5%), Power of the Storm (+4.0%), Obliterate (+1.3%), Fracturing Blow (+0.2%, never cast). Status uptimes: Undefeated 0.99, Power of the Storm 0.19, Earth's Promise debuff 0.53. The 10-03 note records 2 of 4 overlap with the community set (Undefeated, Power of the Storm shared; Marchutan's Wrath and Focused Defense not chosen) and model DPS 9,965 vs 9,759.
- Undefeated Mantra is counted as +18% damage to the Chanter only; Power of the Storm as the caster half only. The party halves and the extra party effects (crit, accuracy, crit damage, Double Chance) are not valued, so the engine picks the community's two core stigmas for a self-only reason.
- Variants: "Crowd control (Ensnaring Mark)" and "Sustain (Focused Defense)", both "costs no DPS". The Chanter has no hand `role:` tags either (plain `sustain` 10, `defense` 10, `party` 10, `cc` 10, `heal` 4, `cleanse` 3, `shield` 2).
- Engine DPS ranks Chanter (9.9k) above Templar (6.7k), Cleric (4.1k) and Spiritmaster (3.7k) and above Gladiator, Assassin and Ranger on the 10-03 table, which contradicts the community rankings I read (shugo B tier, couga54). Cross-class DPS is not calibrated (the 10-03 note says absolute DPS needs in-game calibration).

### 5.7 What a Chanter role score could be

- Party uplift = sum over allies a of weight_a x (DPS_a with the buff's stat mods applied / DPS_a - 1) x uptime, where uptime comes from `SimResult.status_uptime` (already computed) and the reference allies are the other classes' optimizer outputs at baseline. Stat mods that map today: damage boost, attack %, combat speed, cooldown, crit damage. Not mapped: crit rating and accuracy rating (no rating curves), Double Chance (maps to `smite_pct`, which is mapped), target tolerance reduction (Earth's Promise, Chain of Torment; the engine has target `dmg_mult` but only for the caster's own damage).
- Support throughput: Recuperation and Healing Touch HPS (Attack-scaled), shield coverage (Impeding Authority 16% x party Max HP per 90 s, Barrier Spell, Protection Circle).
- Composition rules: Light of Protection overlap, Earth's Promise versus Chain of Torment overlap, and the negative case where Power of the Storm hurts a Cleric.
- Own DPS from the engine, after calibration.

### 5.8 Gaps (Chanter)

No `party` scope on `Status`; no reference allies; rating-to-percent for crit and accuracy missing; Marchutan's Wrath window and Dark Crush uptime are modelled but the party value of Marchutan's replacement stigmas is not; buff interactions are rules in text only; heal and shield numbers not in app data; cross-class DPS uncalibrated.

## 6. Spiritmaster (summoner, not a support)

### 6.1 Role in practice

- No ally-facing kit. couga54 states it outright ("no dedicated party support or buffing role", self-buffs only, no ally heals, shields or CC); gegebase: a summoner damage class, not support, with no explicit buffs or CC for party members (summary); our data agrees (Spirit's Benediction, Kaisinel's Power, Command: Proxy, Flame Blessing all buff caster and own spirit). Questlog: NCSOFT presented it as the solo-play class; the Earth Spirit holds attention and can taunt players, the Wind Spirit heals the owner, Spirit Revitalization heals the spirit. shugo's "pet damage plus party buffs" is the outlier. [H for our data, M for the rest]
- In Global the class is called Elementalist in the client and armory API (our `classes.py` already aliases it); couga54 and questlog use "Elementalist", gegebase "Spiritmaster".
- KR (Inven 10286, raw [H], 09-16): four-spirit rotation beats three spirits under identical gear and doping (the author reports 7.53M in a dummy test); spirit order Water, Earth, Fire so skills are not eaten and the Fire Spirit stays out longest; summon the Ancient Spirit around Earth Tremor stack 4-5 once Element Unification is full; fully charge Destructive Attack 3-4 s after the summon; Elemental Fusion on its own mashed key and the spirit slots in the skill macro; best distance about 3 m; mix ranged and melee spirits in the order; passives Spirit Strike, Element Unification, Mental Focus as high as possible. couga54 says skip the Wind Spirit (three spirits already reach Fusion); the two camps disagree.

### 6.2 Builds we could show

- S1 PvE damage. couga54 (https://couga54.github.io/aion2-guides/en/elementalist/; Evripides, DankRNG, aLuckyRO, Grobs). Stigmas Ancient Spirit, Spirit's Benediction, Flame Blessing, Jointstrike: Corrode, all 20. Ranks Elemental Fusion, Combustion, Fire Spirit 20; Cold Shock, Water Spirit, Jointstrike: Curse, Dimensional Control 16. Passives Mental Focus, Spirit Strike, Element Unification, Spirit Revitalization. Goals Double Chance 25%, CDR 20%, Accuracy 1,500. Snapshot rule: summon only with buffs up. [M]
- S2 gegebase (https://gegebase.com/games/aion2/spiritmaster_pve_guide): S tier Command: Proxy, Spirit's Benediction, Corrode; A tier Flame Blessing, Cursed Cloud; stats Damage Amp, Crit damage, Weapon damage; Daevanion skill nodes (Combustion, Elemental Fusion, Spirit Strike), Attack, CDR, Crit. It differs from couga54 on Command: Proxy. [M]
- S3 KR four-spirit (Inven 10286): as above. A KR search summary says the fixed four are Flame Blessing, Ancient Spirit, Spirit's Benediction, Corrode and that Destructive Attack can lower DPS [L, search summary].
- S4 PvP survival and control: couga54: Ancient Spirit, Spirit's Benediction, Command: Proxy, Seize Magic; passives Spirit Protection, Revitalization Contract; Accuracy 2,000+, Status resist 100%+, Regeneration about 40%.
- Written guide with explicit reuse terms: https://aion2sm.com/ (Evripides, "ereskus"). Videos: https://www.youtube.com/watch?v=KlmstIyukX8 (How to MASTER the SPIRITS), https://www.youtube.com/watch?v=v9MYphrcvic (latest PvE build for Global). Questlog lists 0 Elementalist builds. aion2hub's PvE template is by a user and says "made by Claude Opus 4.6", ignore.

### 6.3 Stats and Daevanion

Damage Amp, crit damage, weapon damage, Double Chance 25%, CDR 20%, Accuracy 1,500, Combat Speed 65% or more for the weave; spirits take 20% stat specs and copy your stats at summon. Daevanion blue nodes Elemental Fusion, Combustion, Fire Spirit, Cold Shock, Water Spirit, then green Mental Focus and Spirit Strike (couga54, 237 points). Cold Shock stacks give +2% Attack per hit up to 5 and losing them costs 10% Attack for you and every spirit.

### 6.4 What our engine does today (Spiritmaster)

Run 2026-10-04: DPS 3,747 (4,249 on 10-03). Stigmas Jointstrike: Destructive Attack (+9.8%), Siphon (+2.6%), Ancient Spirit (+4.4%), Spirit's Benediction (+8.1%); 2 of 4 overlap with the community set, missing Flame Blessing and Corrode, whose DoT and extra-hit values are partly unknown (Curse tick warning). No trade-off variants are offered because the chosen four already carry every utility tag. Hand role tags in the class data: `role:cc` 29, `role:mobility` 21, `role:defense` 11, `role:sustain` 10, `role:heal` 7, `role:burst` 7, `role:summon` 6, `role:dot` 5, `role:debuff` 5, `role:buff` 5 (counts include proc and dismiss rows). `classes.py` labels the class `support`, which the UI shows as a role chip and uses to pick wording (`ROLE_TAGLINE`, `ROLE_ROTATION`, `ROLE_STYLE_TEXT` in `ui/home_view.py`: "Support. This planner tunes your damage skills between buffs and utility", "Keep your buffs and utility up first"); the evidence above says it should be a damage class (suggest `ranged_dps`, or a new `summoner` label).

### 6.5 Role score and gaps

Role score is just own DPS plus an optional solo-sustain line (Wind Spirit 134-147 to 1115-1227 per cast on 15 s, Spirit Communion 10% chance 182-200 to 740-814, Revitalization Contract 35% Max HP heal). Gaps: DoT ticks (Curse, Corrode) unknown ratios; the snapshot rule and spirit stat inheritance are not verified in the sim; Wind Spirit and the four-spirit question need a damage-dummy test.

## 7. Presets we could ship (with credit lines)

Vocabulary: `CONTEXT.md` defines a Role build (the build a tank, healer or support class plays, shown first for those classes with the DPS build second) and a Class guide (general advice on Codex and Guide pages), and says to avoid the phrase "community build". The presets below are Class guide content that seeds a Role build.

Shape: extend `research/community_builds/consensus.json` (today keyed by playstyle boss/aoe/leveling/pvp, DPS builds only) with a `role_presets` list. Each preset is our own structured data: stigma keys and target ranks (clamped to Global caps 20 and 4 slots), skill ranks, specialty option indices, stat priority list, Daevanion priority list, a `credit` string with author, date and link, and a `status` (verdict from 2.3). Skill names and ranks are game facts; do not copy prose or screenshots.

| Preset key | Class | Based on | Verdict | Engine can score today |
|---|---|---|---|---|
| templar-tank-defensive | Templar | gegebase, expcarry Build 1 | LINK | DPS only |
| templar-tank-damage | Templar | couga54 (SolAshur, trueeevil) | ASK | DPS only |
| templar-natural-block-kr | Templar | Inven 23115, 16260, 27401 | ASK | no (needs Block) |
| templar-abyss-protector | Templar | couga54 PvP, expcarry Build 5 | ASK | no |
| cleric-damage-healer | Cleric | couga54, Inven 29213 | ASK | yes (equals engine pick) |
| cleric-sanctuary-healer | Cleric | Inven 28996 (author 구름은랑) | ASK | no (cooldown coverage only) |
| cleric-pure-healer | Cleric | gegebase | LINK | no |
| chanter-buffer | Chanter | couga54 (notXeon, WallyJTV) | ASK | self half only |
| chanter-support-first | Chanter | gegebase | LINK | self half only |
| spiritmaster-pve-damage | Spiritmaster | couga54, aion2sm.com | ALLOWED (credit "ereskus" and link) | yes |
| spiritmaster-pvp | Spiritmaster | couga54 | ASK | no |

Each card should also print one honest line from the engine, for example "Our model values this build by its damage only; healing, shields and party buffs are not counted yet".

## 8. Engine audit (shared by all four classes)

What exists:
- A single-actor fight simulator (`engine/simulator.py`): self and target statuses, cooldowns, MP, animation locks, DoTs, triggers. Output `SimResult` has DPS, per-skill tally and `status_uptime` (fraction of time each status was up), which is exactly the input a buff-uptime valuation needs.
- Stat mods from statuses are limited to six offensive fields (`models.STATUS_STAT_FIELDS`: combat speed, CDR, crit chance, crit damage, attack %, damage boost). Buff magnitudes and durations are single numbers per status (Prayer of Amplification 17.5 s, Undefeated Mantra 18%, Light of Protection 18%), not per rank, while the client ladders are per rank (Undefeated 10.5% to 22.5%, Prayer 10 s to 22.5 s, Power of the Storm 10 s to 22.5 s, Nezekan's shield 41% to 65%). Only DoT flat ticks are per rank (`tick_flat_ranks`).
- Specialty text parsing (`specparse.py`): any text matching Tolerance, Heal, HP, Shield, Block, Absorb, Regen, Enmity, Defense, Resist, Accuracy and similar becomes `no_dps` and is inert (`_NO_DPS`, line 228). That is every defensive and healing specialty above.
- `Stats` has attack, attack %, weapon %, damage boost, PvE %, boss %, crit, crit damage, Smite, combat speed, CDR, max MP, MP regen, target defense, penetration. No HP, Defense, Block, Evasion, Accuracy, Damage Tolerance, Endurance, Heal Boost, Incoming Heal, Enmity. `max_mp` 2000 and `mp_regen_per_s` 20 are placeholders (client has no base MP).
- Daevanion: `STAT_MAP` maps HP, MP, Critical Hit and Multi-hit to "unknown"; Defense Bonus, Critical Hit Resist, Damage Tolerance and the PvP stats are not in the map at all; `_relevant()` drops any node with no skill and no mapped stat, so the planner gives HP, Defense and tolerance nodes zero value and takes them only as connectors on the way to valued nodes (on the Templar path the first 25% of points still contain 44 def/HP/MP nodes, as connectors).
- Optimizer objective is DPS only (`_best_stigma_dps`, `plan_daevanion`, `marginal_stats`). `_variants` is the only utility feature: it swaps one stigma per tag (defense, cc, mobility, sustain) and reports the DPS cost, but skips a tag when any chosen stigma already carries it, and its tags come from hand `role:` tags (Templar, Spiritmaster only) or a keyword scan of the description (Cleric, Chanter, and any skill without a `role:` tag).
- `classes.py` role labels: Templar `tank`, Cleric `healer`, Chanter `support`, Spiritmaster `support`; exposed by `webapi.list_classes()`. The UI uses it only for wording: a role chip (`ui/main_window.py`), `ROLE_TAGLINE`, `ROLE_ROTATION` and `ROLE_STYLE_TEXT` in `ui/home_view.py`, and a banner `NOT_DPS_NOTE` ("Heals, shields and buffs are not modeled. The numbers here measure your damage output only"). So the app is already honest that tank, healer and support results are damage-only; what is missing is the model behind it.
- Client facts we already hold [H, research/stats_gear_extract_2026-10-04.md]: `PcStatLevel` base stats are identical for all classes (level 45: HP 4,702, Defense 450, Attack Bonus 61); Endurance "reduces damage by half"; Evasion cap 30%, crit cap 50%, CDR cap 60% (UI text). Not in the client: Block, Accuracy, Evasion rating curves, NPC stats (boss HP, Defense, Damage Tolerance are server side; `research/playstyles_gamedata_2026-10-04.md` confirms `NpcData` has no HP and adds that named bosses enrage at 300 s, 480-600 s in raids, with a 5 s stagger window), Enmity values. Party sizes from the same note: Expedition 1-5, Transcendence 5, Subjugation 5, Sanctuary raid 10.
- Calibration status: cross-class DPS is not trustworthy (see 5.6).

## 9. Role score design (shared)

Show three things, never a single number, and mark each "model" or "measured":
1. Contribution: own simulated DPS (exists). couga54 and the KR threads say a Cleric's reward and standing follow its damage, and KR Templar threads tune for it.
2. Party uplift: sum over reference allies of weight x (ally DPS with the buff / ally DPS - 1) x uptime. Inputs: status uptime from the sim, a per-status party magnitude, a list of reference allies (the other classes' optimizer output at baseline, 5-player party default (Expedition, Transcendence and Subjugation are 5 players; the Sanctuary raid is 10, two parties of 5), weights per slot). Covers Undefeated Mantra, Light of Protection, Power of the Storm (party half), Earth's Blessing share, Earth's Promise, Chain of Torment, Fracturing Blow, Fury, Warding Strike's party tolerance.
3. Survival: tank = effective HP multiplier averaged over simulated mitigation windows and Block share; healer = per-target HPS and burst plus party-wide mitigation coverage; chanter = shield and HoT coverage. All relative to a reference intake profile whose defaults are flagged uncalibrated.

Plus a cheap coverage panel that needs no model: which party-wide tools are equipped (immunity, shield, damage tolerance, cleanse, resurrection), each with rank, cooldown, duration and duration/cooldown, and warnings for non-stacking pairs (Light of Protection with Undefeated Mantra) and for tools that cannot reach a Global 4-slot build.

Formulas to start from (all marked estimated until tested):
- Tank EHP multiplier = 1 / ((1 - DT) x (1 - 0.5 x Endurance) x (1 - P(block) x blockDR)), DT capped at 80% (Inven 16260), averaged over cooldown windows from the sim. Fury uptime = 1 - exp(-block rate x 20 s).
- Threat per second = sum of casts x (damage x (1 + Enmity Boost) + flat Enmity), against a reference DPS ally.
- Healer sustained HPS per target = sum over heals of average heal(rank) x (1 + amplification) / max(cooldown, cast cadence), amplification = base + k x Attack with k from the 08-12 notes (26/30/34%), MP-limited using Earth's Retribution and Condemnation restores.
- Party uplift for a damage-boost buff of b percent on an ally whose existing boost bucket is B percent: b / (100 + B), because `damage.py` computes `boost = 1 + bucket / 100` with `dmg_boost_pct`, `pve_dmg_pct` and `boss_dmg_pct` added into one bucket.

Calibration rule: do not compare Contribution with Party uplift across classes until cross-class DPS passes a dummy-test check.

## 10. Phased plan

P0, no new data, hours to days:
1. Relabel Spiritmaster in `classes.py` (damage class, not `support`).
2. Add hand tags to Cleric and Chanter gamedata (`role:heal`, `role:defense`, `role:party-buff`, `role:cleanse`, `role:shield`, `role:resurrect`) and fix the keyword fallback (the word "Incoming Heal" in a debuff should not mean sustain: Voice of Doom).
3. Make `_variants` offer the best stigma per tag even when a chosen stigma carries it, or ignore a tag that only a trivial effect carries (Doom Shield for defense).
4. Ship the coverage panel (section 9) and the role presets (section 7) with credits.
P1, data work (medium):
5. Carry per-rank heal, shield (% Max HP) and tolerance ladders from `research/classes/*/skills.json` into `gamedata.json` with confidence tags; give support `Status` magnitudes and durations a per-rank ladder.
6. Add `Stats` fields for HP, Defense, Damage Tolerance, Endurance, Block, Heal Boost with base values from `PcStatLevel`; map the Daevanion HP, Defense Bonus, Critical Hit Resist and Damage Tolerance nodes; make `_relevant` objective-aware.
7. Add `Status.scope` (self, party) with a party magnitude, and `SimConfig.party`; compute party uplift in `build_optimizer` and show it next to DPS.
P2:
8. Role objectives (weights over contribution, uplift, survival) for the stigma chooser and Daevanion planner; composition rules (Light of Protection versus Undefeated Mantra by rank, Chain of Torment versus Earth's Promise, Power of the Storm hurting a capped Cleric); per-class Combat Speed caps (Cleric 94.4).
P3, needs in-game tests or logs:
9. Block percent curve, heal formula (k), shield absorb, Fury uptime, Enmity, boss damage intake; Fury party scope on Global; Earth's Grace 75% HP claim; Wind Spirit and four-spirit question.

## 11. Cheap in-game tests that unlock the P3 items

(We keep the no-automation line: manual play, read numbers off the screen.)
1. Heal formula: cast Healing Light on yourself at known HP with three Attack values (swap weapon or earrings), record the number; fit the heal against rank table plus k x Attack. Repeat Radiant Recovery to check the 08-12 amplification.
2. Block curve: stand in front of one mob with a known hit and count Block procs over 100 hits at three Dexterity and Block settings, with and without Shield of Protection (guaranteed Block); record damage on Block versus a normal hit.
3. Shield absorb: read the absorbed amount of Nezekan's Shield, Impeding Authority and Yustiel's Power against Max HP at known ranks (validates the % Max HP ladders).
4. Fury: log Block frequency and Fury icon uptime during a dungeon boss (also settles whether the Global Fury is party-wide).
5. Boss intake: write down damage taken per second and per spike for one boss across three runs with a known tank setup (gives a reference intake profile).
6. Dummy DPS for the Spiritmaster Wind Spirit question and the Cleric 94.4 Combat Speed cap.

## 12. Open items and risks

- Everything Global is pre-launch. Re-read couga54, gegebase and questlog 48 hours after launch; builds will move quickly.
- The KR healing rewrite means pre-08-12 heal and HP-priority advice is stale. The Jan 28 Cleric guide still has the best skill and Arcana detail, so use it for names, not numbers.
- Source disagreements I could not settle: Fury party scope; Earth's Grace and the 75% HP rule; Wind Spirit; Command: Proxy as an S-tier Spiritmaster stigma (gegebase) versus a PvP pick (couga54); whether Chanter's party buff is worth a slot (couga54 and Inven say yes for dungeons, KR threads say no).
- Eight Inven posts I relied on (22546, 20297, 21630, 23224, 24561, 26129, 27235, 29198) came through WebFetch summaries only, and 26810 is a title only; re-read them raw before quoting. I opened 28734 and 27370 but did not use them because the summaries were unreliable on KR stat slang.
- Local data nits found: Light of Protection and one Spiritmaster description contain leaked HTML; `statuses.fury_buff`, `power_of_the_storm`, `undefeated_mantra` are rank-fixed.

## Appendix A. Engine runs, 2026-10-04 (boss 180 s, level 45, BASELINE_L45_STATS, working tree)

| Class | DPS | Stigmas (gain %) | Variants offered | 10-03 DPS |
|---|---|---|---|---|
| Templar | 6,729 | ELP 3.8, Doom Shield 0.0, Executing Blade 1.2, Taunt 0.9 | Sustain (Noble Armor) -0.3% | 6,656 |
| Cleric | 4,148 | Noble Aura 28.6, Light of Protection 18.0, Prayer of Amplification 4.4, Earth Punishment 3.9 | CC (Assault Mark) -0.7%, Sustain (Voice of Doom) 0 | 4,148 |
| Chanter | 9,909 | Undefeated 15.5, Power of the Storm 4.0, Obliterate 1.3, Fracturing Blow 0.2 | CC (Ensnaring Mark) 0, Sustain (Focused Defense) 0 | 9,965 |
| Spiritmaster | 3,747 | Destructive Attack 9.8, Siphon 2.6, Ancient Spirit 4.4, Spirit's Benediction 8.1 | none | 4,249 |

Script: `scratchpad/run_roles.py` (not in the repo): loads `data/classes/<class>/gamedata.json`, calls `build_optimizer.optimize_full_build`. Warnings seen on every class: "Utility value (defense, crowd control) is not simulated; variants only show the DPS cost", "PvP is not modeled", "assumes all Daevanion points".

## Appendix B. Heal and ladder numbers from the client dump (research/classes/*/skills.json, 2026-09-18, before any Heal Boost)

| Skill | Rank 1 | Rank 16 | Rank 20 | Rank 25 | Cooldown |
|---|---|---|---|---|---|
| Healing Light (Cleric) | 192-211 | 837-921 | 1020-1122 | 1179-1297 | 6 s, 50 MP |
| Radiant Recovery | 379-417 | 1669-1836 | 2012-2213 | 2325-2558 | 12 s |
| Light of Regeneration (per 2 s tick, 30 s) | 616-739 | 3541-4249 | 4315-5178 | 5000-6000 | 30 s |
| Absolution | 1602-1762 | 3072-3379 | 3464-3810 | 3967-4364 | 90 s |
| Benevolence (per 2 s tick, 20 s) | 90-100 | 390-429 | 482-530 | 595-715 | 90 s |
| Recuperation (Chanter) | 183-201 | 1008-1109 | 1228-1351 | 1423-1565 | 15 s |
| Healing Touch (Chanter) | 927-1020 | 1752-1927 | 1978-2176 | 2265-2492 | 30 s |
| Wind Spirit heal (owner) | 134-147 | 978-1076 | 1115-1227 | 1288-1417 | 15 s |

Party buff ladders: Light of Protection and Undefeated Mantra PvE Damage Boost and Tolerance 10.5% (rank 1), 15% (10), 18% (16), 20% (20), 22.5% (25). Prayer of Amplification +20% Attack, 10 s (rank 1), 14.5 s (10), 20 s (20), 22.5 s (25), 60 s cooldown. Yustiel's Power +20% PvE Tolerance, 10 s (1), 20 s (20), 22.5 s (25), 60 s. Power of the Storm 10 s (1), 12 s (5), 20 s (20), 22.5 s (25), 120 s. Nezekan's Shield 41% (1), 50% (10), 60% (20), 65% (25) of Max HP for 3 s, 60 s. Salvation cooldown 150 s (1), 112 s (20), 102 s (25).

## Appendix C. Everything I opened

English: https://couga54.github.io/aion2-guides/en/{templar,cleric,chanter,elementalist}/ ; https://github.com/Couga54/aion2-guides (README, API license field) ; https://gegebase.com/games/aion2/{templar_pve_guide,cleric_pve_guide,chanter_pve_guide,spiritmaster_pve_guide} ; https://expcarry.com/aion-2-templar-guide ; https://aion2sm.com/ ; https://aion2hub.com/{builds,classes/cleric,updates/aion-2-update-2026-08-12} ; https://questlog.gg/aion-2/en/classes/{templar,cleric,chanter,elementalist} (10-03 cached scrapes plus one search rendering) ; https://shugo.gg/tierlist (10-03 cache) ; https://pixelnitro.com/?p=20616 ; https://www.u4n.com/news/aion-2-healer-guide-best-healer-build.html ; https://forum.la-boite-a-pain.com/viewtopic.php?p=390993 (U4N mirror) ; https://www.playnews.gg/en/news/aion-2-the-august-12-korean-patch-rewrites-healing-40-meter-range-but-20-to-50-less-power (search snippet only, 403) ; https://noping.com/blog/the-best-aion-2-builds (403).
Korean, Inven (raw text unless noted): 6438/23115, 6438/16260, 6438/27401, 6438/27173, 6438/27370 (summary), 6438/22546 (summary), 6438/24561 (summary), 6438/26129 (summary), 6438/27235 (summary), 6438/21467 (summary, empty post), board index 6438?my=chu ; 6452/657, 6452/28996, 6452/28859, 6452/29213, 6452/27247 (summary), 6452/28734 (summary), 6452/26813 (summary), 6452/29198 (summary) ; 6451/22932, 6451/21630 (summary), 6451/23224 (summary), 6451/20297 (summary) ; 6454/10286, 6454/8088 (empty post, summary). Inven terms https://www.inven.co.kr/doc/service_240311.php (summary). Arca https://arca.live/b/aion2/159822449 (raw). DCinside https://gall.dcinside.com/mgallery/board/view/?id=aion2&no=2648507 (one read, summary).
YouTube titles only: efdy2Ecnr6M, ayyzLdGOaNc, f3gxUdec82U, hEft_jbIG_I, VTD6cbqJj1U, A3pZDSt4ceU, K9aDbrjhwDA, zxq03c3NhEw, EsxGbxt0k-4, KlmstIyukX8, v9MYphrcvic (all https://www.youtube.com/watch?v=...).
Excluded as Aion 1: https://www.gamemeca.com/view.php?gid=232978, 233001, 233050.
