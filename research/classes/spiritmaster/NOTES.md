# Aion 2 Spiritmaster (official class name "Elementalist", id 6; KR 정령성) - research notes

Collected 2026-10-03 (global launch 2026-10-05). Skill data is the "Game client 18.09.2026" dump served by aion2.app, the same KR/TW-era client data as the Sorcerer file. Nothing here is verified in-game.

## Files
| File | Content |
|---|---|
| `skills.json` | 110 entries: 74 with client skill_id (16xxxxxx, same id space the armory skillList uses), 36 id-less Metaroad rows |
| `mechanics.json` | statuses (15), rules (46), triggers, joint_attacks, resource_systems, rank_scaling (40 skills), skill_tags (97) |
| `chains.json` | 38 links, unlinked list, stagger-condition list |
| `community_rotations.json` | 3 sourced rotations (2 boss, 1 AoE) |
| `roadmap.json` | shared progression copied from Sorcerer + 19 Spiritmaster unlock rows |
| `daevanion.json` | 5 boards, 537 nodes (532 selectable), 802 points |
| `D:\Aion2\assets\icons\spiritmaster\` | 71 PNG (256x256 RGBA) + `index.json` (same structure as the Sorcerer index) |
| `raw/` | fetched pages, parsers, build scripts (rerun order: `build_final_skills.py`, `build_mech2.py`, `build_misc.py`, `build_daev.py`) |

## Schema differences from the Sorcerer file (additive only)
- Extra skill fields: `key` (app slug = icon index key), `kind` (app SkillKind), `element`, `tags`, `icon`, `icon_slug`. `tags` follow app mechanics.json grammar: `manual`, `role:defense|cc|mobility|sustain|heal|burst|buff|debuff|dot|summon`, plus `spirit`, `pvp`.
- Extra rank fields: `heal_min`, `heal_max` (Spiritmaster has real heals).
- New `category` value `spirit_skill` (skills cast by a summoned Spirit, 40 entries). All Sorcerer values still used.
- `damage_type_or_weapon` is filled ("Magic / Orb"), it was a dead field for Sorcerer.
- `element` uses `wind` and `ancient` too. The app's `Element` literal only allows fire/water/earth/none, so a Spiritmaster build needs that enum widened (or wind/ancient mapped to none).
- `hits` in coefficients is filled from "(N hits)" text; stagger_gauge_damage from "N Stagger Gauge Damage".
- Key rule: index slug, name slug with apostrophes deleted, later duplicates get `-<skill_id>` (Spirit Protection active = `spirit-protection`, passive = `spirit-protection-16720000`; Elemental Fusion follow-up = `elemental-fusion-16300001`; Rage Burst etc. have four ids each).

## Coverage
- Active/passive/stigma: 18 active, 10 passive, 13 stigma, all with 20-40 rank tables (cooldown, MP, flat dmg/heal, tokens). Ranks: core 40, stigma 25, hidden 20 (KR cap; global cap 20/20 per PLAN).
- ATK ratio (rank 1) and flat come from Metaroad; per-rank flats from aion2.app. Ratio is not per rank (same limitation as Sorcerer).
- Real mechanics modelled: Four Elements counter (4 Spirit skill activations, consumed by Elemental Fusion, blocks further stacks), Spirit uptime and per-attack skill chance (15/15/10/10%, 3 s spirit skill cd, Ancient Spirit 30 s / skill after 7 attacks), Jointstrike joint hits per Spirit, Curse / Corrode / Cursed Cloud / Magic Backflow DoTs with flat per-tick values at rank 1 and max, Corrode +10% damage taken from Spirit, Flame Blessing proc, Spirit Strike (PvE damage boost 6% rank 1 to 45% rank 40), stagger-gated skills, charge skills (Destructive Attack, Fusion), MP engine (Cold Shock chain 100/100/150, Dimensional Control, Water Spirit).
- Tanks/healers rule: Spiritmaster is a DPS class; defensive and heal skills are tagged (Defiance, Spirit Protection, Command: Proxy, Benediction, Siphon, Revitalization Contract, Elemental Replenishment, ...).
- 7 skills (Magic Backflow, Spirit Protection active, Spirit Momentum, Elemental Replenishment, Extract Vitality, Continuous Impact, Soul Decimation) have no unlock level: hidden or granted. Grant source not found.

## Confidence
- confirmed: ids, names (EN/KR), unlock levels, rank tables, cooldowns, MP, description numbers, spec texts (aion2.app dump + Metaroad agree where both exist), Daevanion nodes (aion2t + Metaroad skill grants match on all 4 skill boards).
- estimated: tag assignment, `manual` choice, link table except Cold Shock chain, joint-hit inference, Spirit Benediction x1.2 multiplier, anim lock default, rotation lists.
- unknown (null): tick ATK ratios (only flat tick values exist), charge times and Lv.1/Lv.2 tier multipliers, Stagger window, Mental-type Chance meaning, Spirit Momentum/Elemental Immunity percentages ("—" in sources), long-animation skill list, Ancient Spirit uptime rule, DoT/CD effects of Corrode spec on Spirits.
- Token legend: `se_dmg:<id>:SkillUIMaxDmgsum` = hit damage; `se_abe_dmg:..:SkillUIDotMaxDmg:tick` = DoT per tick; `..SkillUIHotMax:tick` = heal per tick; `:time` = seconds; `:divide100` = percent (already divided); `abs` = absolute. Meaning of unlabelled ids was inferred from the matching description line.

## Gaps and conflicts
1. No animation/cast time data (client cast_time 0 everywhere, same as Sorcerer). Guides say Spirit summons became instant in Sep 2026.
2. The 12 extra Rage Burst / Ice Chain / Taunt / Gale variants (x200-x400) are not linked to a parent; they share the Corrode joint-hit rank tables.
3. Whether Jointstrike joint hits count toward Four Elements is not documented (Sep patch note: "spirit joint attacks fire immediately").
4. Spiritmaster Weapon Equip has no downloadable icon (client icon `ICON_TE_TEMP_020_Effect_001` 404s); 2 "Use Spirit Summon Skill" rows have no icon at all. Id-less rows borrow a parent icon via `icon_slug`, basic attacks and PvP/immunity rows have none.
5. Daevanion: stat nodes are identical to Sorcerer on every board; only skill nodes differ. Azphel Metaroad totals (PvP Defense 480, Crit Resist 80, Evasion 48) differ from node sums (720/120/72), unresolved. Metaroad mentions a Legend rarity and two currencies (DaevanionCrystal 570/840 for boards 1-4, BattleCrystal 232 for Azphel); no node uses Legend. aion2t footer claims 8 boards per class, API returns 5 (display_order 5 missing).
6. Region: some rows may be KR-only at global launch (hidden skills, rank >20). hub page lists 25 active + 10 passive core skills on the Global Launch Scale Test client, close to the 18+13 / 10 here.
7. Community guides disagree on names (Flame Incineration = Combustion, Frost Shock = Cold Shock, Spatial Domination = Dimensional Control, Fixed Spirit = Command: Proxy, Spirit's Grace = Benediction, Concentration = Mental Focus, Corrosion = Corrode). The expcarry site sells boosting services: treat as opinion.
8. Guide note: spirits may coexist (expcarry); other guides claim a "Three Spirit Warala" setup. Unverified in-game.

## Sources (all fetched 2026-10-03, rate limited >= 0.4 s, robots checked: aion2.app, aion2t.com, metaroad.gg allow these paths)
- https://aion2.app/db/skills/<id> and /ko/db/skills/<id> for 74 ids from https://aion2.app/sitemap-db.xml (ids 16000000-16800000). Game client 18.09.2026.
- https://metaroad.gg/aion2/database/skills/spiritmaster (125 rows / 768 variants, rank-1 ATK ratio, flat, range, cd, MP, spec text) and /daevanion/spiritmaster.
- https://aion2t.com/daevanion?job=6 (embedded board JSON, node ids, positions, skill ids).
- https://aion2.plaync.com/en-us/api/gameinfo/classes?lang=en-US&region=eu (class id 6 = Elementalist / "Spiritmaster"; no skills endpoint found).
- https://aion2hub.com/classes/spiritmaster (class overview, 25 active + 10 passive on Launch Scale Test client 2026-09-19).
- https://gegebase.com/games/aion2/spiritmaster_pve_guide (rotation, passive/stigma priority, Jul-Sep 2026 balance notes).
- https://expcarry.com/aion-2-spiritmaster-guide (Four Elements counter, spirit roles, stigma presets, manual vs macro).
- Searched but not used as data: vortexgaming.io, u4n.com, mmoexp.com guides, aion2.app has no per-class tag filter.
- Not consulted: Inven, Reddit, aion2db.gg (no extra values expected beyond the client dump).


## 2026-10-03 engine-core pass (patch_mech3.py)
`raw/patch_mech3.py` (+ `patch_mech3_a.py` statuses/rules/triggers, `patch_mech3_b.py` specialty table) rewrites parts of `mechanics.json`; rerun it after `build_mech2.py`, then `python -m aion2c.data.build_gamedata --class spiritmaster`.
- Specialties: 112 options on 25 skills (12 core x 5, 13 stigma x 4). The generic parser decodes most; `specialization_effects` overrides 40 options. Final: 28 simulated, 55 inert (CC, defence, heal, mobility), 20 decoded-but-unmodeled (Spirit auto-attack stats, charge time, stacks), 9 unknown (Multi-Hit damage, "extra damage after 3s", "+10 Element Boost" unit, Fusion AoE target count).
- Fixed: Four Elements trigger (fired on every skill with element "none": 93 Fusion casts per 180 s) -> 0.25 accumulator per summon cast; Dimensional Control -> proc per summon cast (no longer spam); base charge tiers of Elemental Fusion / Destructive Attack removed (x3.0 only exists with the "Changes to Charge Skill" specialty); Spirit-cast skills (40) and the 4 hidden no-grant actives are not rotation candidates; Benediction +20% is an additive damage-boost stat mod; Spirit Strike aura (+15% at rank 10) added; Flame Blessing is a 50% x 41% ATK per-second tick, not a x1.0 multiplier.
- Not modelled (engine limits): Spirit auto-attacks and joint hits (a PROC fires without checking `requires`, so Jointstrike joint hits cannot be gated on a summoned Spirit), Spirit's Descent / Consecutive Countercurrent / Element Unification procs (need per-attack events), Cold Shock stack buff (duration unknown), Ashy Call and Curse of Despair chains are available without the specialty that adds them (chain tips cannot be requires-gated without blocking the root skill), DoT tick damage (client gives flat per-tick values only; ticks carry a ratio).
