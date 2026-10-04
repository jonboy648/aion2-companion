# Aion 2 Cleric - research notes (2026-10-03)

Same schemas as the Sorcerer pipeline. `python validate.py` (offline) checks the files; the app builder was also run in memory (`aion2c.data.build_gamedata.assemble(..., class_key="cleric")`) and a simulation ran on every community rotation. Nothing was written into the app.

## Files
| File | Content |
|---|---|
| `skills.json` | 44 entries: 12 active, 10 passive, 13 stigma, 1 dodge, 4 chain/hidden actives (Thunder and Lightning, Discharge, Divine Punishment, Blessing of Regeneration), 4 id-less (Bolt Level 1/2/Max, Earth's Blessing). 40 have a skill_id. Extra field `tags` (manual and utility tags). Per-rank rows also carry `heal_min`/`heal_max` where the client has them (heal skills). |
| `mechanics.json` | 10 statuses, 17 rules, 36 tagged skills, plus extension blocks (see below) |
| `chains.json`, `community_rotations.json` (4), `roadmap.json` (43) | as in the Sorcerer set |
| `daevanion.json` | 5 boards, 537 nodes, 802 points, 88 skill nodes (22 on each of the first four boards), Azphel has none |
| `../../../assets/icons/cleric/` | 40 PNG (256x256 RGBA) + `index.json` (same structure, `skill_id` as string) |

## Verification against the official armory (high confidence on ids)
A public level-45 Global (EU) Cleric profile was read through the armory endpoint the app uses (`aion2.plaync.com/api/character/equipment`, character name not stored). Its `skillList` has 35 skills. All 35 ids, names, `needLevel` values and icon names equal this skills.json. The armory does not list the 5 chain/hidden entries (Dodge, Thunder and Lightning, Discharge, Divine Punishment, Blessing of Regeneration), the same as the Sorcerer. Class id 8 = Cleric (`/api/gameinfo/classes`).

## Confidence
- High: ids, names (EN, KR), unlock levels, max ranks, cooldowns, MP costs, per-rank flat damage/heal (all from the aion2.app client dump, cross-checked: every Metaroad MP and cooldown matched, no mismatch printed).
- Medium: ATK ratio (Metaroad rank-1 only, applied at all ranks, same assumption as the Sorcerer set), specialization texts (identical on aion2.app and Metaroad).
- Estimated: buff multipliers (Prayer of Amplification x1.2, Light of Protection x1.18 at rank 16, Chain of Torment x1.05), Bolt level-2 multiplier (2.0, midpoint), chain window 3 s (schema default), Noble Aura ratio 88% per aura hit.
- Unknown (null or 0 with confidence "unknown"): DoT tick ATK ratios (Metaroad shows a dash), Divine Aura tick interval, Bolt charge times for levels 2 and 3, Discharge trigger chance, Earth's Blessing base effect, Healing Enhancement's real scaling (the dump token reads "22400% of Attack", unit unclear), animation lengths (client cast time is 0 everywhere).

## What is modeled
- Resource: MP. Basic chain Earth's Retribution (110 MP) > Thunder and Lightning (110) > Discharge (150) restores MP; Judgment Thunder / Divine Punishment cost 120, no cooldown.
- Chain of Torment (10 s, DoT, -5% PvE damage tolerance) gates Condemnation (rule `requires`). Earth Punishment (10 s DoT, flat 1186 per second at rank 1) forces Condemnation to crit at spec rank 5, and Condemnation resets its cooldown on crit at spec 12, so it becomes cooldown-free. The engine has no forced-crit flag, so this lives in the status `note` and in `spec_mechanics`.
- DoTs with real tick values: Chain of Torment 173 to 3819 per tick (rank 1 to 40), Debilitating Mark 74 to 2801, Earth Punishment 1186 to 3759, Voice of Doom 2862 to 9066, all 1 s tick, stored as `tick_flat_by_rank`. The Status schema only holds an ATK ratio per tick, which is unknown, so `tick_ratio_pct` stays 0/unknown and the engine warns, exactly as for the Sorcerer DoTs.
- Buff windows: Prayer of Amplification (+20% Attack, 10 s at rank 1 up to 22.5 s, 60 s cooldown, duration per rank stored), Light of Protection (toggle, always-on passive via `mp_min_pct` 0 and `source_skill`, does not stack with the Chanter mantra), Noble Aura (300 s summon, aura hit every 2 s), Divine Aura (5 s ground summon).
- Bolt: 3 charge levels, max charge = exactly 3x level 1 on both ratio and flat (Metaroad 327.6-982.8% and 987-2963).
- Tags: `manual` (Bolt, heals, defensives, party buffs, Noble Aura, Dodge), utility tags `defense cc mobility sustain heal` plus `cleanse resurrect party-buff stagger summon proc basic resource charge`; `dot`/`ground` make the engine warn on unknown tick values. Healing and defensive skills carry tags only; the damage rotation is modeled.

## Gaps and things the app side must decide
1. `models.Element` has no `wind`. Wind skills (Thunder and Lightning, Discharge, Judgment Thunder, Divine Punishment, Bolt, Debilitating Mark) load as `none`; true elements are in `mechanics.skill_elements`. Thunder and Lightning and Discharge are overridden to `none` so they do not inherit Earth.
2. Extension blocks ignored by the loader: `spec_mechanics` (cooldown cuts, forced crit), `damage_procs` (Empyrean Lord's Grace: 42% ATK + flat on every hit, 1 s ICD, community calls it the key passive; the engine cannot model per-hit procs), `class_caps` (Combat Speed cap 94.4% from one Korean guide, unverified), `resource`.
3. Earth's Blessing has no icon (id-less system buff, `icon=None`, like the Sorcerer's Depths).
4. Heal values are modeled as data only (`heal_min/max`); Healing Enhancement and heal scaling are not simulated.
5. The 4 chain/hidden skills are labeled KR/TW-only by aion2hub (client v110) but the Kaeria guide says active skills are identical on global, and the armory simply does not list chain children. Kept visible; `regions` is decided by the builder (`KR_ONLY_IDS` has no Cleric ids).
6. Sources disagree on Debilitating Mark use (Kaeria macro vs Inven "only when the party is hurting") and on Prayer of Amplification's cooldown history (KR 90 s until 2026-09-04, now 60 s). Dump value 60 s used.
7. Daevanion completion buffs ("Daevanion X Effects") have names only, as for the Sorcerer. aion2t claims 8 boards per class; the Cleric API returns 5 (display_order 1-4 and 6), same as the Sorcerer.
8. Skill id 17000100 Dodge and all KR-era numbers (ranks 21-40, stigma 21-25) exist only in the KR/TW dump; Global caps are 20/20.

## Sources (all fetched 2026-10-03, requests spaced 0.4 s or more, robots allow /db)
- aion2.app skill pages `https://aion2.app/db/skills/<id>` EN and `/ko/` (Game client 18.09.2026, dump date 2026-09-18, "data via the official NCSOFT Aion 2 API"): per-rank data, specs, chains, icons.
- Metaroad `https://metaroad.gg/aion2/database/skills/cleric`: ATK ratios, flat, hits, stagger, tags, descriptions, 4 id-less rows.
- aion2t.com `https://aion2t.com/daevanion?job=8` (one fetch, board JSON embedded): boards, nodes, adjacency by the Sorcerer transform (the same transform reproduces `daevanion_sorcerer.json` with 0 differences).
- Official NCSoft armory API (`aion2.plaync.com/api/gameinfo/classes`, `/api/character/equipment`, search via `api-search.plaync.com`) and `assets.playnccdn.com/static-aion2-gamedata/resources/<ICON>.png` (official icon CDN used for Salvation, Prayer of Amplification, Healing Enhancement, Immortal Veil, which the DB sites do not serve).
- aion2hub `https://aion2hub.com/classes/cleric` (core 36 = 26 active + 10 passive, global Launch Scale Test 2026-09-19; 4 KR/TW-only actives, client v110 2026-09-09).
- Rotations and macro lines: couga54 Cleric guide `https://couga54.github.io/aion2-guides/en/cleric/` (2026-10-03, Kaeria TW video 2026-09-28), gegebase `https://gegebase.com/games/aion2/cleric_pve_guide` (KR/TW patch history), Inven Cleric guide 2026-09-24 `https://www.inven.co.kr/board/aion2/6452/29213` (via `research/tmp/classes.json`, not re-fetched).
- Not used: aion2db.gg (zh-TW names, no extra data), Reddit and namu.wiki (not needed, not fetched).
- Icon art is NCSOFT property: personal use, keep `assets/` out of public repos.

## Structured mechanics pass (2026-10-03, engine core spec)
- `mechanics.json` `specialization_effects`: overrides for 30 options; all other options use the generic text parser. 112 distinct options (chain children excluded): 103 decoded, 9 unknown and listed in `tests/test_mech_cleric.py` (3 Multi-Hit with no value in any source, 4 DoT-interval/x2-DoT options and 2 Divine Aura options that need the tick ATK ratio / attack interval, which no source publishes; only flat ticks exist).
- Chain children (Thunder and Lightning, Discharge, Divine Punishment) carry empty options: the client shows the parent's options on every chain skill, the parent's carry the effects (Judgment Thunder reaches Divine Punishment through `skill_key`).
- Empyrean Lord's Grace is now a PROC skill (`kind_overrides`) fired by a cast trigger over every damaging skill, throttled by a 1 s cooldown. The cooldown was written into its `skills.json` rows (`cooldown_s` 1, all 40 `per_level` rows) from the description "Cooldown: 1s" / token abe:1773000011 value03:time = 1.
- Prayer of Amplification (+20% Attack -> `attack_increase_pct`) and Light of Protection (PvE Damage Boost 18% -> `dmg_boost_pct`, rank 16) moved from multipliers to `stat_mods`. New statuses: chain_of_torment_amp, ep_forced_crit, ep_double_chance, ep_attack_def, prayer_pve_boost, prayer_earths_grace, vod_crit_resist, noble_aura_fast.
- Known engine limits (not data): DoT/aura ticks use only the ATK ratio (flat ticks 173..9066 are stored in `tick_flat_by_rank` but unused, ratio unknown, so Chain of Torment, Earth Punishment, Voice of Doom, Debilitating Mark and Divine Aura deal 0 and warn); `force_crit` cannot be gated on a status (Earth Punishment's forced Condemnation crit is a gated `dmg_mult` 1.24, estimated); `_eff_from_dict` ignores `on_skill`, so Earth's Retribution "+20% MP restored" only reaches Earth's Retribution, not Thunder and Lightning / Discharge; the priority is chosen before specialties, so a cooldown-free Condemnation can starve lower entries.
