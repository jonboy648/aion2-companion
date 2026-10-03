# Aion 2 Chanter - research notes (2026-10-03)

Files here use the Sorcerer schemas (data_contract.md). Verified: `aion2c.data.build_gamedata.assemble(..., class_key="chanter")` builds these files in memory with no errors (48 skills, 26 statuses, 42 rules, 17 links, 5 boards / 537 nodes). The app's pytest suite was NOT re-run.

## Coverage
| Item | Count | Notes |
|---|---|---|
| skills.json | 48 entries | 45 with client ids + 3 Metaroad-only Rushing Smash charge rows (Level 1 / Level 2 / Max, id null). 12 active, 13 stigma, 10 passive, 8 chain children, Dodge, Wave Blow hidden variant (18080037). |
| per-rank data | 45 skills | 40 ranks (core), 25 (stigma), 1 (Dodge, hidden Wave Blow). Extra vs Sorcerer: `heal_min/heal_max` per rank (heal skills) and `cost_hp/cost_dp`. |
| Icons | 45 PNG, 256x256 RGBA | `assets/icons/chanter/<slug>.png` + `index.json`. Slug rule as Sorcerer (apostrophes deleted; `marchutans-wrath`, `earths-promise`, `winds-promise`). Wave Blow hidden variant = `wave-blow-18080037`. The 3 charge rows use `rushing-smash.png` (`mechanics.icon_prefix_aliases`). |
| Daevanion | 5 boards, 537 nodes, 802 points | Nezekan 12 (89 nodes, 134 pts), Zikel 20 (89, 134), Vaizel 30 (89, 134), Triniel 40 (117, 168), Azphel 45 (153, 232). Same sizes, costs, unlock levels and rules as Sorcerer, but different node layouts: boards are NOT shared. 88 skill nodes (22 skills) on boards 1-4, none on Azphel. Every non-start node reachable from Start. |
| mechanics.json | 26 statuses, 42 rules, 2 triggers | `skill_tags` (manual, defense, cc, mobility, sustain, heal, ...) for all 48 skills; also stored per skill as `tags`. |
| chains.json | 17 links | 11 confirmed from client text (Chain panel, specs, Dark Crush windows), 6 inferred. |
| community_rotations.json | 5 | all opinion posts, dated. |
| roadmap.json | 39 rows | shared progression copied from Sorcerer + 19 Chanter unlock rows (levels 1-25). |

## Skill ids vs official data
All 45 ids come from aion2.app (client dump 2026-09-18). The 22 skills on Daevanion boards also carry the same ids in aion2t's board JSON (which says it uses the official NCSOFT API): 22 of 22 match. The other 23 ids are NOT cross-checked against the official armory (the class endpoint returned only class ids, Chanter = 9; no skill endpoint found).

## Main mechanics modelled
- MP economy: Onslaught/Resonance Crush/Bolt Crush restore 100/100/120 MP, Storm Chain 180, Rushing Smash 100. Incandescent/Bursting Blow cost 120.
- Chains (client-confirmed): Onslaught > Resonance Crush > Bolt Crush; Incandescent Blow > Bursting Blow. Spec-added chains: Storm Chain, Piercing Strike, Crushing Strike, Surging Strike.
- Dark Crush windows: 2 s after Impactful Crush / Spinning Strike, 3 s after Ensnaring Mark / Marchutan's Wrath (client text). Two statuses; the rule has no `requires` because the schema is AND-only (engine must OR them).
- CC gates: Stun (3 s) gates Wave Blow; Staggered gates Gust Rampage and Raging Spell; Impact-type status (+20% on Fracturing Blow).
- Spinning Strike: +15% Crit Damage Boost, 30 s, 2 stacks. Undefeated Mantra +10.5% PvE damage (party). Attack Preparation +5.5%. Earth's Promise debuff. Power of the Storm +20% speed / -20% cooldown.
- Defensive layer tagged, not rotated: Protection Circle (10 stacks -> Divine Barrier), Noble Protective Shield, Tenacity, Barrier Spell, Impeding Authority, Guardian Blessing, Recuperation HoT.

## Confidence
- High: names, ids, unlock levels, max ranks, cooldowns, MP, per-rank flat damage and heal numbers, spec text (client dump; the page shows resolved numbers). Crushing Blow's unlock level is inherited (3) by the builder.
- Medium: ATK ratio / flat / hits (Metaroad, rank 1 only; the app assumes the ratio at all ranks as for Sorcerer). Hit count text appended to descriptions as "(N hits)" so the builder can parse it.
- Low/estimated: chain windows (3.0 s placeholder), animation lock, charge tiers, Impact-type membership, all non-text links.
- null + unknown: stamina and MP pool sizes, stagger gauge size/break window, Rushing Smash charge times and tier multipliers, Focused Defense duration, crit-damage-to-damage conversion, DoT ticks (the class has no DoT in the client text).

## Gaps and conflicts
1. **KR vs Global**: the Aug 26 KR patch (aion2hub) changed Spinning Strike (cd 30 -> 15 s, MP 250 -> 100, +30% speed), Impactful Crush (cd 15 -> 10 s, +30% PvE), Dark Crush usable "when using a ranged skill", Marchutan's Dark Crush window 7 -> 3 s, shields and Earth's Promise values (15/20/25% -> 9/13/17%). The client dump here still shows 30 s / 250 MP / 15 s, but its Dark Crush text already matches the 2 s/3 s windows. Which skills are KR/TW only is unknown (aion2hub says 26 active + 10 passive global, +8 KR/TW only; Sorcerer's `KR_ONLY_IDS` in build_gamedata.py has no Chanter entries, so all Chanter skills get regions global+korea).
2. **Icon disagreement**: aion2.app page icons differ from aion2t Daevanion `skill_icon` for 7 skills (Recuperation, Blessing of Life, Protection Circle, Attack Preparation, Impact Hit, Earth's Promise, Wind's Promise); two page icons (013, Passive_012) do not exist as files. Daevanion icons were used (they follow the passive numbering order). Medium confidence for those 7; see `raw/icon_overrides.json`.
3. Crushing Blow has no parent in the global client; link to Impactful Crush is inferred from the KR patch note. Wave Blow 18080037 ratio is assumed equal to Wave Blow.
4. Schema gaps: no OR in `requires` (Dark Crush windows, Raging Spell stagger/impact), no toggle/stack/internal-cooldown fields, triggers only match by element (used `none`).
5. Heal and shield values are flat per rank (client) or % Max HP; there is no ATK ratio for heals (Blessing of Life scales Heal Boost with Attack; KR note says 18/21/24% of Attack).
6. Boss CC immunity (Wave Blow text mentions "Incapacitated Immunity") is not modelled; Stun gating on bosses is unverified.
7. Daevanion completion buffs: names only (same gap as Sorcerer). Stigma point costs: 1 per stigma (client "Stigma points 1"), upgrade costs unknown.
8. Community guides are 2026-09/10 opinion pieces with partly summarized text (small-model summaries): treat rotations as priors.

## Sources (fetched 2026-10-03)
- aion2.app/db/skills/<id> (EN and /ko), 45 pages, "Game client 18.09.2026", 0.45 s spacing. List: aion2.app/db/skills?class=Chanter
- https://metaroad.gg/aion2/database/skills/chanter (49 article rows; ATK ratio, flat, hits, specs, tags)
- https://aion2t.com/daevanion?job=9 (board JSON, 537 nodes)
- https://aion2.plaync.com/en-us/api/gameinfo/classes?lang=en-US&region=eu (Chanter class id 9)
- https://aion2hub.com/classes/chanter (role, qualitative) and https://aion2hub.com/updates/aion-2-update-2026-08-26 (KR patch notes)
- https://pixelnitro.com/?p=20617 (2026-09-27), https://www.aoeah.com/news/4806--best-aion-2-chanter-builds-skills--macro-setup-2026-pvp--pve (2026-09-10), https://couga54.github.io/aion2-guides/en/chanter/ (2026-10-03), https://gegebase.com/games/aion2/chanter_pve_guide (undated)
- Not reached: Inven, Reddit, aion2db.gg (not queried), official armory skill endpoint (none found).

Regeneration scripts in this folder: fetch.py, build_skills.py (+ tags.json), build_daev.py, build_mech.py, build_misc.py; raw pages in raw/.
