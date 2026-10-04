# Aion 2 Gladiator (KR: 검성) - research notes

Collected 2026-10-03 (Global launch 2026-10-05, global cap 45, KR cap 50). Same schemas as the Sorcerer pipeline; builds through
`aion2c.data.build_gamedata.assemble(..., class_key="gladiator")`. Checked in memory (nothing written to the app): 62 skills, 13 statuses, 26 rules,
1 trigger, 18 links, 4 community rotations, 41 roadmap items, 5 Daevanion boards / 537 nodes all load and validate, every icon file exists, and the
optimizer plus simulator run on it (4 playstyles and the 4 community rotations). That is a smoke check, not a pytest run; no pytest was executed.

## Files
| File | Content |
|---|---|
| `skills.json` | 62 entries: 58 with a client skill_id (58 rank tables, 1651 rank rows) + 4 id-less Metaroad system rows (Wave Attack, Predation, Destruction, Rush Strike - Max) |
| `mechanics.json` | 13 statuses, 26 rules, 1 trigger, `skill_tags` for 33 skills (`manual`, `role:defense/cc/mobility/sustain/heal/burst`, `dot`), anim lock |
| `chains.json` | 18 links (6 client-confirmed: 5 chains + 1 condition, 12 estimated) + unlinked / stagger / knockdown lists |
| `community_rotations.json` | 4 sourced rotations (2 boss, 1 AoE variant, 1 leveling pull) |
| `roadmap.json` | shared progression copied from the Sorcerer roadmap + 21 Gladiator items (skill unlock levels, stigmas) |
| `daevanion.json` | 5 boards, 537 nodes (88 skill nodes), 802 points; same schema as `daevanion_sorcerer.json` |
| `D:\Aion2\assets\icons\gladiator\` | 58 PNG (256x256 RGBA) + `index.json` (same structure as the Sorcerer index) |
| `ids.txt` | the 59 ids found in the aion2.app sitemap (11xxxxxx) |

## Coverage
- Skills by category: 12 active, 10 passive, 13 stigma, 12 chain_or_hidden_active, 7 chain_or_hidden, 4 chain_or_system, 2 passive_proc, 1 system_passive (Equip Gladiator Weapon), 1 basic_dodge.
- Every id'd skill has the full client rank table (core 40 ranks, stigma and chain stigma children 25, single rank 1): damage, cooldown, MP cost, raw tokens. The 4 id-less rows have none.
- Metaroad ATK ratio + flat exist for 34 skills (hits/stagger/range for most of them). Metaroad rank-1 flat equals the client rank-1 damage for every matched skill (checked by script) except Lunge Stance, see gaps.
- Slugs follow `data_contract.md` (apostrophes deleted, collisions get `-<skill_id>` in id order): `forced-fall` is the passive stub 11300037 and the real active is `forced-fall-11370000`;
  `blood-absorption` / `survival-stance` are the actives, the passives are `-11730000` / `-11710000`; `wrathful-strike` is 11040000, `wrathful-strike-11350000` is a different single-rank skill.
- Specs: client rank, text resolved at rank 1 (unlike Sorcerer, values Metaroad hides as a dash are filled from client tokens, e.g. Keen Strike "Absorbs 1% HP").
- Extra keys vs the Sorcerer schema (additive, builder ignores them): `damage_type`, `weapon`, `description_client_rank1`, `kr_tw_only_per_aion2hub`, `stigma_points`, `icon_note`.
  `coefficients.hits` IS filled here (Sorcerer left it null) because Metaroad gives it; the builder reads hits from the description text anyway.
- Ratio/flat meaning: Metaroad text says "74.25% ATK + 70 per hit (2 hits)", so ratio and flat are per hit for multi-hit skills. Rank-1 ratio only; per-rank flat is in `per_level`.

## Mechanics modelled (all with confidence + source in the file)
- Chains (client-confirmed): Rending Blow > Smashing Blow; Keen Strike > Rupture Strike > Wrathful Strike (restore 100/100/120 MP); Crushing Wave > Frenzied Wave; Blade Toss > Blade Dance.
  Spec-gated (estimated): Overhead Slam > Upward Strike (the community core), Aerial Snare > Forced Fall, Defiance > Wrath Burst, Ankle Slice > Ankle Smash, Fracturing > Destructive > Unsheathing Rush, Wrathful > Reckless Strike (restores 150 MP).
  Only Overhead Slam > Upward Strike is wired as `chain_next` among the spec-gated ones.
- Timed buffs: Prepare for Battle (Ruinous Blow, 20 s, PvE Damage Boost +20% / PvP +10% / Crit Hit +100 / Status Chance +15%, confirmed by client tokens and by couga54), Rage Burst buff (10 s, +10% PvE),
  Wounded, Knockdown (3 s), Lunge Stance, Zikel's Blessing (+20% Attack), Experienced Counterstrike block buff (20 s), Armor of Balance, Tenaciousness, Defiance Tenacity.
- Debuffs: Blade Toss (-30% Defense, -50% incoming heal, 10 s), Wounded (enemy Attack -10%).
- DoT: Wave Armor (34% ATK + 207, 10 s at rank 1). Tick interval is null/unknown.
- Proc: Murderous Burst (Menace stack per landed attack, 5 stacks = AoE hit + crit damage window) approximated as a 20% per-cast trigger; the burst damage itself is not modelled.
- Resource: MP (restores on Keen/Rupture/Wrathful/Reckless Strike, costs on Rending 120, Ruinous 250, Crushing 250, Mocking 200, ...). Stamina exists in the client but no cost field is exposed.
- Tags: `manual` for the by-hand set from the couga54 guide (Focused Block, Mocking Blade, Leaping Slam, Crushing Wave, Dodge, Defiance, Rush Strike, Aerial Snare, ...) and `role:` tags for the
  defensive, CC, mobility, sustain and heal skills (Gladiator is a Tank/DPS hybrid; the damage rotation is modelled in full).
- Always-on passives (Attack Preparation, Identify Weakness, Impact Hit, Survival Stance, Blood Absorption, Protection Armor...) are deliberately NOT statuses: imported gear stats already include them.
  Rank-dependent status values use rank 10 (estimated); the per-rank values are in `skills.json` tokens.

## Confidence
| Field | Confidence |
|---|---|
| names, KR names, unlock levels, max ranks, cooldowns, MP costs, per-rank damage/heal, tokens | high (aion2.app client dump, Metaroad agrees on every matched rank-1 flat, cooldown and MP) |
| ATK ratio, hits, stagger, range | medium-high (Metaroad, rank 1) |
| chain rows from the client Chain table | high; spec-gated chains and id-prefix procs: medium-low |
| status durations from tokens | high; rank used for scaling ones: estimated |
| damage multipliers of buffs (PvE Damage Boost, Attack) | estimated (bucket treated as a final multiplier, overstates) |
| Murderous Burst trigger chance, Experienced Counterstrike uptime, anim lock | estimated / low |
| Daevanion layout, costs, rarities, unlock levels | high (aion2t + Metaroad agree, see crosscheck in the file) |
| Daevanion adjacency | medium-high (rule copied from the Sorcerer file: orthogonal, start-node connected) |

## Gaps (not invented; null / unknown in the data)
- **Upward Strike icon**: the client icon ICON_TE_SKILL_016 is not served by aion2.app (it returns an HTML page) nor present in the 265ada/aion2-macros mirror. `upward-strike.png` is a copy of Overhead Slam's icon
  and `index.json` marks it `placeholder: true`. Everything else (57 icons) is real art. Shared client icons (by design, same as Sorcerer): ICON_GL_SKILL_017 (Overhead Slam + its passive stub), 019 (Leaping Slam + the 2nd Wrathful Strike), 015 (Aerial Snare + Madness Blow), 016 (both Forced Fall entries).
- 11380007 (Passive, level 22, no name, no icon, no data) is excluded. Metaroad's "Basic Attack" row (1 variant, no data) is excluded. Metaroad's "Wave Attack" System row has no data (kept as id-less, kind system).
- Hidden values (dash or `?` in every source): Intimidating Roar (Damage Boost reduction, duration, Enmity), Rush (Combat Speed %, duration), active Survival Stance HP, Doom Advent damage, Madness Blow damage,
  the second Wrathful Strike (11350000) damage, active Blood Absorption HP regen, Predation effect, Lunge Stance and Wave Armor tick values.
- Lunge Stance: Metaroad lists ratio 40.8% + flat 248, but the text is a pure buff and the client has no damage token. Kept in `coefficients` with a note, unconfirmed.
- Not modelled by the engine, so not in the data as behaviour: Stamina costs/restores; Block/Parry events (Focused Block, Experienced Counterstrike are approximated by a rule); Knockdown gating of
  Overhead Slam / Aerial Snare (needs an OR of "Knockdown or Rage Burst window", `requires` is AND; bosses are exempt per guides, the client text says 7% chance vs Incapacitated Immunity: unresolved conflict);
  Overhead Slam cancel. (Status 2026-10-03, tests/test_proc_gladiator.py: Menace stacking = hits/5 per cast, Rending Blow 50 MP on crit, Lunge Stance spec 20 cooldown cut and the Rage Burst gate on Overhead Slam ARE modelled and tested; only the 7% base chance vs immune bosses is not.)
- ENGINE GAP (not editable here): `damage.hit_damage_ex` counts one hit per cast, but client text is per hit (Rending Blow 2, Overhead Slam 2, Mocking Blade 3, Rage Burst 5 hits). These skills are undercounted by their hit count; fix = multiply raw by max(1, skill.hits).
- Region split: aion2hub lists 17 skills as KR/TW-only (not verified on Global): Rupture Strike, Wrathful Strike, Frenzied Wave, Blade Dance, Intimidating Roar, Reckless Strike, Ankle Smash, Rush, Doom Advent,
  Wrath Burst, Madness Blow, Forced Fall, Smashing Blow, Upward Strike, Destructive Rush, Unsheathing Rush, Equip Gladiator Weapon (19 entries carry `kr_tw_only_per_aion2hub: true` because of the duplicate names).
  `build_gamedata.KR_ONLY_IDS` is the Sorcerer id set, so the builder currently tags every Gladiator skill global+korea; it needs the Gladiator ids added (app change, not done here).
- Global Season 1 per couga54: 4 stigma slots (levels 22/27/32/37), stigma rank cap 20 (no rank-25 tier), core rank cap 20, no Ariel board. The client data keeps 40/25 ranks.
- skill_id vs the official armory: ids come from aion2.app, which says its data is the official NCSOFT API; the official `classes` endpoint only returns class ids (Gladiator = 2). No Gladiator armory sample
  exists locally, so the match to armory `skillList.skillId` is unverified (the Sorcerer ids of the same scheme did match).
- Daevanion: 3 nodes named "Max MP" carry the effect "Penetration +10" in the aion2t payload (Zikel 12,11 / Vaizel 8,11 / Triniel 5,3); Metaroad board totals count them as MP +50, so the file uses MP +50
  and records the override (`node_effect_overrides`). Azphel PvP Defense / Evasion / Crit Resist node sums (720 / 72 / 120) disagree with Metaroad totals (480 / 48 / 80); unresolved, PvP-only. Completion buff
  numbers are not captured (names only). The extra boards claimed by aion2t's footer are not present for the Gladiator either.
- Boards are not shared outright: layout, costs, unlock levels and stat nodes are the same shape as the Sorcerer boards; node ids and the 22 skill nodes per board (first four boards) differ.

## Sources (all fetched 2026-10-03, requests spaced >= 0.4 s, robots.txt allows /db)
| Source | Used for |
|---|---|
| https://aion2.app/db/skills/<id> and /ko/db/skills/<id>, 59 ids from sitemap-db.xml, footer "Game client 18.09.2026" | ids, names (EN/KR), ranks, tokens, specs, chain table, icons |
| https://metaroad.gg/aion2/database/skills/gladiator ("58 skills across 707 variants") | ATK ratio, hits, stagger, range, tags, resolved descriptions |
| https://aion2t.com/daevanion?job=2 and https://metaroad.gg/aion2/database/daevanion/gladiator | Daevanion boards, nodes, cross-check totals |
| https://aion2hub.com/classes/gladiator (Global Launch Scale Test client 2026-09-19; KR/TW client v110 2026-09-09) | core vs KR/TW-only skill split, role |
| https://couga54.github.io/aion2-guides/en/gladiator/ (updated 2026-10-03, Global Season 1; creators Arthars Gaming, Grobs, aLuckyRO, Sen) | macro/rotation, stigma and skill priorities, manual skills, Global rules |
| Inven Gladiator guide https://www.inven.co.kr/board/aion2/6448/31551 (2026-09-05) via the hand-edited `D:\Aion2\research\tmp\classes.json` summary | opener, Overhead Slam > Rending Blow cancel, damage split (the page itself was downloaded but only the summary was used) |
| https://aion2.plaync.com/en-us/api/gameinfo/classes?lang=en-US&region=eu | class id check only |
| https://gegebase.com/games/aion2/gladiator_pve_guide | read, NOT used: names a stigma "Assault Stance" that does not exist in the client list, generic text |

Icon art is (c) NCSOFT; personal companion-app use only, keep `assets/` out of public repos (same as the Sorcerer icons).
