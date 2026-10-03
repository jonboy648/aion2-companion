# Assassin data pack (2026-10-03)

Files here: `skills.json`, `mechanics.json`, `chains.json`, `community_rotations.json`, `roadmap.json`, `daevanion.json`. Icons: `D:\Aion2\assets\icons\assassin\` (50 PNG 256x256 RGBA + `index.json`, 46 unique art, shared art copied per slug). Build scripts (`_fetch.py`, `_parse.py`, `_metaroad.py`, `_build_*.py`, `_icons.py`) and raw pages (`_raw/`) are kept so everything re-runs.

## Coverage
- skills.json: 52 entries = 50 with skill_id (13xxxxxx) + 2 id-less Metaroad system entries (Clone Attack, Poison). Categories: 12 active, 10 passive, 13 stigma, 9 chain_or_hidden_active, 3 chain_or_hidden, 2 passive_proc, 1 basic_dodge, 2 chain_or_system. Same field set as the Sorcerer file plus `slug`, `tags`, `icon`, per-rank `heal_min/heal_max`; `damage_type_or_weapon` is filled (it is dead in the Sorcerer file).
- Per-rank data: 40 ranks per skill from the client (dmg, cd, mp, tokens). Ratio/flat/hits from Metaroad for 33 skills; null elsewhere.
- Icons: 50 (every skill with an icon id). The 2 id-less entries have none.
- Daevanion: 5 boards, 537 nodes (532 selectable), 802 points; identical structure to Sorcerer (11/11/11/13/15 grids) but own layouts and Assassin skill nodes (22 per board on Nezekan-Triniel, none on Azphel). Adjacency computed with the Sorcerer rule (orthogonal neighbours); every board is fully reachable from Start.
- mechanics.json: 18 statuses, 38 skill rules, 3 triggers, plus an `assassin_extensions` block (non-schema: tags, Insignia table, Heart Gore, back-attack bonuses, DoT ticks, passive rank1-vs-rank40 values).
- chains.json: 16 links. roadmap.json: 39 entries (shared progression copied, Assassin unlocks lv 1-25). community_rotations.json: 3 sourced entries.

## Modelled mechanics
Insignia stacks (max 5, 10 s; Savage Fang 5, Roar chain 1 each, Ambush 2 and Shadow Fall 3 via specs); Insignia Explosion scaling by stack (rank 1 dmg 604 to 967, Stun 0 to 50%); Heart Gore as on-crit proc (cd 5 s, +100 MP, cd removed by Illusive Clone for 10 s, spec 16 resets on crit); builder chains with MP restore (100/105/120); Illusive Clone and Swift Contract windows; Stun-then-Shadow Fall and Blind/Stun CC chains; Back attack bonuses; Poison and Exploit Weakness procs; defense, heal, stealth skills tagged. Tags: `manual` (not in the one-key macro) plus damage/cc/mobility/sustain/defense/heal/stealth/buff etc. in `tags` and `assassin_extensions.skill_tags`.

## Confidence
- High: client numbers (per-rank damage, cd, MP, durations, spec text, ids, KR names), Daevanion node layout/costs/effects (aion2t embeds the NCSOFT API JSON).
- Medium: chain links named in spec text (Throw Shadowblade, Defiance, Infiltrate, Ambush, Savage Smash) = confirmed; Quick/Breaking/Swift and Aerial Bind/Slaughter are inferred from names and text.
- Low: manual vs macro split (Inven guides and one guide site disagree on Insignia Explosion), rotation priority order after the opener, the ezg.com macro (search snippet only).

## Conflicts found
- Insignia Explosion: Metaroad 220% ATK + 663 flat vs aion2.app rank-1 604 (stack table uses aion2.app).
- Smoke Bomb cooldown: aion2.app 30 s vs Metaroad 60 s (file keeps 30).
- Stigma rank cap: aion2.app lists 40 ranks for stigmas (Sorcerer file stored 25); the app must still cap stigma at 20 Global / 25 KR and core skills at 20 Global.
- Quick Slice flat: Metaroad "61 per hit (2 hits)", dump 58; multi-hit skills are not flagged as conflicts.

## Gaps
- skill_id not cross-checked against an Assassin armory character (no sample in armory_samples); ids come from aion2.app (same source as Sorcerer, which matched).
- No ATK ratio for 19 skills (passives, buffs, hidden skills). DoT/clone ATK ratios unknown; flat ticks known (Poison 233 rank 1, 2885 rank 40).
- Cast/animation times unknown (client cast_time 0). Stagger duration, Seal/Root values, "Impact-type" definition unknown.
- Hidden skills Frenzied Accord, Surging Bloodlust, Prepare to Assassinate, hidden Apply Poison have no parent and unknown Global availability. No "Equip Assassin Weapon" entry exists (13000000 returns an empty page).
- Element enum has no "physical"; all Assassin skills use "none".
- Inven pages (24247, 23617, 10014) were not fetched directly; their content comes from `research/tmp/classes.json` (hand-edited Sep 30 summary). Armory board ids and completion-buff values not captured.
- Global vs KR: data is the 2026-09-18 client dump (KR/TW era); Global launch 2026-10-05, cap 45 (skills at lv 45 shown; lv 45+ none needed).

## Sources (retrieved 2026-10-03)
aion2.app/db/skills/13xxxxxx (en and /ko; robots allow /db; 0.45 s spacing), metaroad.gg/aion2/database/skills/assassin, aion2t.com/daevanion?job=5, aion2.plaync.com gameinfo/classes (class id 5), aion2-assassin-guide.onrender.com, ezg.com Assassin macro post (snippet), Inven 6449/24247 and /23617 (via classes.json), aion2hub.com update 2025-11-19 (reset cost, copied from Sorcerer file).
