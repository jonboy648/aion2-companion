# Hit-count check: Breaking Slice, Swift Slice, Jointstrike (2026-10-04)

Derived facts only; no raw client rows copied. Client = private export Table dir (build 5.3.2.0). `SE` = SkillEffect.json, `SEL` = SkillEffectLv.json.
WebSearch budget was exhausted (200/200), so web evidence is limited to two Metaroad WebFetch pages. No video, DPS-meter or Korean guide evidence was obtained.

## Field layout (SE / SEL `EffectValueList`, damage rows)
[0] flat min, [1] flat max, [2] ATK ratio min x100, [3] ratio max x100, **[4] hit count**. Same layout in SE (rank-1 row) and SEL (ranks 2+).

## Q1. Assassin

| skill | SE row | EffectValueList[0..4] (rank 1) | SEL group |
|---|---|---|---|
| Breaking Slice | 1303000011 | 65, 65, 7750, 7750, **3** | Assassin_Skill003_LvUp (flat 95 at lv2, 1554 at lv40; hits 3 every rank) |
| Swift Slice | 1304000011 | 73, 73, 9200, 9200, **4** | Assassin_Skill004_LvUp (flat 109 at lv2, 1841 at lv40; hits 4 every rank) |

Tooltip (L10NString `SkillString_STR_SKILL_PC_ASSASSIN_13030010_skill_desc_effect`, `..._13040010_...`): "Deals {se_dmg:1303000011:SkillUIMinDmgsum}-{...SkillUIMaxDmgsum} damage to up to 4 enemies within 4m and restores 126 MP". No "per hit" or hit-count wording in the client string.

Metaroad (https://metaroad.gg/aion2/database/skills/assassin, fetched today): "Breaking Slice: Deals 77.5% ATK + 65 per hit (3 hits) damage ... restores 105 MP." "Swift Slice: Deals 92% ATK + 73 per hit (4 hits) damage ... restores 120 MP." The 65 / 73 / 77.5% / 92% equal the SE row [0] and [2]/100 exactly.

### Verdict
- **Breaking Slice: 3 hits, listed flat (and ATK ratio) is PER HIT.** Cast = 3 x (77.5% ATK + flat).
- **Swift Slice: 4 hits, listed flat (and ratio) is PER HIT.** Cast = 4 x (92% ATK + flat).
- Confidence: **likely** (not confirmed).

### Evidence quality and caveats
- Hit count 3 / 4 is confirmed (EffectValueList[4], constant over all ranks).
- Per-hit vs total is NOT stated by the client. The tooltip token is "...Dmgsum" and the client string has no wording. Metaroad's "per hit (N hits)" is almost certainly generated from the same table by a rule (it appears only when [4] > 1; Jointstrike with [4]=1 gets plain "75% ATK + 74 damage"), so it is not independent proof. It does show the site author read [0] as per-hit.
- Supporting but indirect: client ETC skills (basic attacks, `SkillString_SkillString_ETC_4100/4130/4141/4330_skill_desc_effect`) use the non-sum token `SkillUIMinDmg` with literal text "Strikes twice/four times ... dealing X-Y damage per hit". So the engine's value that is stored per effect row is a per-hit amount for those; the "Dmgsum" variant is used by PC skills and, by naming, may sum several effect rows of one tooltip (e.g. `1314002021`) rather than multiply by hits. If Dmgsum were hits x flat, Metaroad's 65 (equal to row [0]) would not match the tooltip number; we cannot see the in-game number to settle this.
- The scale of the numbers is consistent with per-hit: Breaking Slice flat 65 vs single-hit Elementalist Jointstrike Curse flat 74 at the same rank-1 level, with 77.5% vs 75% ratio; a total-split reading would make Breaking Slice's per-hit damage (~22 flat) far below comparable 1-hit skills' ratio/flat.
- Still missing: one in-game dummy cast (expected 3 x (0.775 ATK + 65) for Breaking Slice) or a DPS-meter log with 3 hit lines.

## Q2. Spiritmaster Jointstrike

| skill | base SE row | EffectValueList[0..4] (rank 1) | SEL group |
|---|---|---|---|
| Jointstrike: Curse | 1614000011 (siblings 1614001011.. same values) | 74, 74, 7500, 7500, **1** | Elementalist_Skill014_LvUp (hits 1 at every rank) |
| Jointstrike: Corrode | 1615000011 | 429, 429, 7500, 7500, **1** | Elementalist_Skill015_LvUp (hits 1 at every rank) |

Tooltip `SkillString_STR_SKILL_PC_ELEMENTALIST_16140000_skill_desc_effect`: "Selects a target within 20m and deals {se_dmg:1614000011:SkillUIMinDmgsum}-{...Max} damage to up to 4 enemies within 4m of the target, and inflicts Curse ... The Spirit joins for a coordinated assault. Fire/Water/Earth/Wind/Ancient: {se_dmg:16001101xx...}". Corrode (`..._16150000_...`) is the same shape with se_dmg 1615000011 and spirit lines 16151x0011.

Where our 5 and 2 came from: the Spirit's own damage rows, not the base hit.
- Curse spirit effects (Elementalist_Skill014_LvUp_<Element>): Fire 1600110111 hits 1; **Water 1600110511 hits 5**; Earth 1600111311 hits 2; **Wind 1600110911 hits 5**; Ancient 1600111711 hits 1.
- Corrode spirit effects (Elementalist_Skill015_LvUp_<Element>): Fire/Water/Earth/Wind 1615x10011 hits 1; **Ancient 1615510011 hits 2**.
So "5" = Water or Wind spirit's follow-up on Curse, "2" = Ancient spirit's follow-up on Corrode. Which spirit joins depends on which spirit the player has summoned (tooltip lists all five).

### Verdict
- **Jointstrike: Curse: base hit 1 (listed 74 flat + 75% ATK is one hit).** The 5-hit number applies only to the Water or Wind spirit's separate assault damage (flat 119 / 29 per hit at that group's level, ratio 121% / 30%), not to the 74.
- **Jointstrike: Corrode: base hit 1 (429 flat + 75% ATK).** The 2-hit number applies only to the Ancient spirit's assault (925 flat, 161.5% ATK per hit, hits 2).
- Confidence: **confirmed** for the base effect (hit count field = 1 in SE and every SEL rank; Metaroad prints "75% ATK + 74 damage" and "75% ATK + 429 damage" with no hit count). The spirit-assault hits are confirmed from table fields; whether those hits are per-hit amounts has the same unknown as Q1 (likely per hit).
- Modelling note: the spirit's assault damage is a separate component on top of the 1 base hit (depends on active spirit). Our engine's 1 hit for the base is right; if the Spirit's hit is not modelled it is under-counted, and it should then be 5 x (spirit ratio + flat) for Water/Wind Curse, 2 x for Ancient Corrode.

## Sources
- Client: SkillEffect.json, SkillEffectLv.json, L10N/en-US/L10NString.json (Entries keys quoted above).
- https://metaroad.gg/aion2/database/skills/assassin
- https://metaroad.gg/aion2/database/skills/spiritmaster
- Repo context: research/multihit_rule.md, research/client_numbers_applied_2026-10-04.md, research/skill_details_extract_2026-10-04.md.
