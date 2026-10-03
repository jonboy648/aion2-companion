# Aion 2 Sorcerer - Data Contract for App Builders

Audited 2026-10-03 directly from: `research/sorcerer_skills.json` (56 entries, 579 KB), `sorcerer_skills_notes.md`, `sorcerer_builds_and_dps.md`, `game_ui_and_progression.md`, `github_survey.md`, `icons_notes.md`, `assets/icons/index.json` (51 keys), `assets/icons/sorcerer/*.png` (51 files, all 256x256 RGBA). Field types below were computed by script over all 56 entries, not copied from the notes.

Region caveat: skill data is a KR/TW-era client datamine (aion2.app "Game client 18.09.2026" + Metaroad). Global launch is 2026-10-05, global cap 45, KR cap 50. Nothing here is verified in-game.

---

## 1. `sorcerer_skills.json` schema

Top level: a JSON **array** of 56 skill objects (no wrapper object, no version field). Order is roughly by skill_id, then the 5 id-less Metaroad entries last.

### 1.1 Field table (n = entries where key is present; "null" = count of null/empty)

| Field | Type | Present | Null/empty | Notes |
|---|---|---|---|---|
| `name` | string | 56 | 0 | English. **Not unique**: "Frost Burst" x2 (15220000, 15220037), "Cold Snap" x2 (15080000, 15730000). |
| `name_kr` | string or null | 56 | 5 | null only for the 5 id-less entries. |
| `skill_id` | int or null | 56 | 5 | 8 digits, `15xxxxxx`. **Use as the primary key.** null for The Depths, Flame Zone, Hellfire - Level 1/2/Max. |
| `category` | string | 56 | 0 | Enum, see 1.3. Partly the researcher's own label, not a client value. |
| `client_type` | string or null | 56 | 9 | Client header: `Active`, `Passive`, or (for id-less entries) a Metaroad tag string like `Active · Magic · Fire · Attack ·`. Inconsistent semantics, do not switch on it. |
| `unlock_level` | int or null | 56 | 17 | Character level. null for all chain/hidden skills (except Remove Hibernation = 22, inherited). |
| `max_skill_level` | int or null | 56 | 5 | Values seen: 40 (core active/passive), 25 (stigma), 1 (single-rank). |
| `cooldown_s` | number or null | 56 | 2 | Rank-1 value. 0 = no cooldown. |
| `cooldown_s_at_max_level` | int or null | 51 | 47 | Only 4 skills set (Defiance 21, Curse: Old Tree 42, Hibernation 132, Curse: Tree 66). For everything else read `per_level[-1].cooldown_s`. Key missing on the 5 id-less entries. |
| `cast_time_s` | int or null | 56 | 5 | **Always 0 where present. Unreliable** (see risks). |
| `cost` | object | 56 | 0 | `{mp: number\|null, hp: number\|null, dp: number\|null}`. hp/dp always 0 (or null on id-less). MP does not vary by rank in any skill. |
| `range_m` | number or null | 56 | 23 | null = self/buff. |
| `description` | string or null | 56 | 5 | Metaroad/aion2.app text, rank-1 numbers. Some contain `?` or the em dash placeholder where values are hidden (e.g. "Deals ?-? Water damage", "for —"). |
| `coefficients` | object or null | 56 | 29 | See 1.4. |
| `effects` | array of string | 56 | 7 empty | **Free text, not structured.** E.g. `"Metaroad variants (ranks): 27"`, `"Stagger gauge damage: 2"`, `"Cooldown falls from 120s (rank 1) to 42s (rank 40) per client"`. Do not parse for logic. |
| `specializations` | array of `{unlock_level:int\|null, text:string}` | 56 | 25 empty | See 1.5. |
| `properties` | string or null | 51 | 31 | Key absent on the 5 id-less entries. Values like `Mobile`, `Charge Skill`, or raw template strings (`Fire Damage@{se_dmg:6020011:SkillUIMinDmgSum}-{...}`, unresolved). |
| `damage_type_or_weapon` | null | 51 | 51 | **Dead field, always null.** Ignore. |
| `per_level` | array of rank objects | 51 | 0 (but `[]`/absent on 5 id-less) | See 1.2. |
| `icon_url` | string or null | 56 | 5 | Remote URL `https://aion2.app/db-item-icons/ICON_xx_SKILL_nnn.webp`. Use local PNGs instead (section 3). |
| `source_url` | string | 56 | 0 | aion2.app page, or Metaroad URL for id-less entries. |
| `source_url_secondary` | string or null | 51 | 2 | Metaroad page. |
| `source_date` | string | 56 | 0 | Provenance string. |
| `metaroad_tag` | string | 49 | 0 | Absent on 7 entries. Dot-separated tags (`Active · Magic · Water · Attack · Debuff ·`). Useful for element/type filtering but trailing separator needs trimming. |

There is **no `parent`, `chain`, `children`, `element`, `role`, or `stagger` field.** See section 2.

### 1.2 Per-rank arrays (`per_level`)

- Encoding: array of objects, **one per rank, 1-indexed via the `level` field** (array index = level - 1). Length equals `max_skill_level` (40 / 25 / 1). Verified 1416 rank objects, all with identical keys.
- Rank object: `{level:int, dmg_min:number|null, dmg_max:number|null, cooldown_s:number, cost_mp:number, cast_time_s:number, tokens:{string:string}}`.
- `dmg_min`/`dmg_max` are the **resolved flat damage at that rank** from the client ("SkillUIMinDmgsum" / "MaxDmgsum"). For every skill except Hellfire min == max. For Hellfire they are the **charge range**: rank 1 = 1137 to 3412 (charge level 1 to max), rank 40 = 8121 to 24364.
- **The ATK ratio is NOT per rank.** Only `coefficients.atk_ratio_pct_rank1` exists (rank 1). Do not multiply `dmg_*` by the ratio as a rank-N coefficient: notes say dmg_min/max is "flat component only is plausible, not confirmed". Flat scales steeply with rank (Fire Mark proc 32 at rank 1, 489 at 14, 850 at 27, 1161 at 40; Winter's Shackles 275 at rank 1, 369 at rank 2).
- `tokens` = raw client template variables, **string-valued**, keyed like `se_dmg:1511000011:SkillUIMaxDmgsum`, `se:1511000013:effect_value02:time`, `abe:1511003011:value02:divide100`. Unlabelled; meaning must be guessed (`:time` = seconds, `:divide100` = percent). Use only for display/debug.
- 25 of 51 skills have null `dmg_min`/`dmg_max` on every rank (buffs, CC, DoT-only, passives like Robe/Grace, Steel Barrier, Element Enhancement, Wish of Concentration, Firebomb, Cold Snap (active), Magic Energy Blast, etc.). Their numbers exist only in `tokens`/description, or not at all.

### 1.3 `category` enum (56 entries)

| Value | n | Meaning |
|---|---|---|
| `active` | 12 | Level-gated core actives. |
| `passive` | 10 | Core passives (incl. Cold Snap 15730000, Fire Mark). |
| `stigma` | 13 | Stigma skills, unlock 22, max rank 25. |
| `chain_or_hidden_active` | 6 | Damage skills with no unlock level (Firebomb, Burst, Cold Wave, Pyroclasm, Winter's Illusion, Curse: Old Tree). Chain follow-ups. |
| `chain_or_hidden` | 7 | Single-rank utility/proc skills with no unlock level (Cold Snap active, Vaizel's Wisdom, Summon Flame, Illusion, Magic Energy Blast, Lumiel's Authority, Remove Hibernation). |
| `chain_or_system` | 5 | The 5 Metaroad-only, id-less entries. |
| `system_passive` | 1 | Equip Sorcerer Weapon. |
| `basic_dodge` | 1 | Dodge (shared class-common skill). |
| `passive_proc` | 1 | Frost Burst 15220037 (empty description, proc child of Frost Burst). |

"chain_or_*" labels are the researcher's, not the client's.

### 1.4 `coefficients`

`{atk_ratio_pct_rank1:number, flat_rank1:number, hits:null, stagger_gauge_damage:string|null, note:string}`. Non-null on 27 skills. `hits` is **always null** (do not rely on it; Hellfire's "2 hits" is only in `description`). `stagger_gauge_damage` is a string and can be a range (`"20-35"`, `"2"`, `"7"`). Ratio is percent (63.0 = 63% ATK). Values are rank 1 (verified: Flame Arrow 63% + 62 flat). null for DoTs, buffs, passives whose values were hidden ("—") in Metaroad.

### 1.5 `specializations`

Array of `{unlock_level, text}`; `unlock_level` here means **skill rank**, not character level. Seen: 5/10/15/20 (stigma slots), 8/12/16 (core), and `null` on 30 entries. Text is free-form English with rank-1 numbers. Core skills have ~5 slots, stigmas 4. No structured effect data.

### 1.6 Example object (Winter's Shackles, rank arrays trimmed to 2 of 40; `specializations` trimmed)

```json
{
  "name": "Winter's Shackles",
  "name_kr": "겨울의 속박",
  "skill_id": 15110000,
  "category": "active",
  "client_type": "Active",
  "unlock_level": 8,
  "max_skill_level": 40,
  "cooldown_s": 45.0,
  "cooldown_s_at_max_level": null,
  "cast_time_s": 0,
  "cost": { "mp": 200.0, "hp": 0, "dp": 0 },
  "range_m": 20.0,
  "description": "Selects a target within 20m and deals 145% ATK + 275 Water damage to up to 4 enemies within 4m. Inflicts Slow for 3s.",
  "coefficients": {
    "atk_ratio_pct_rank1": 145.0, "flat_rank1": 275.0,
    "hits": null, "stagger_gauge_damage": null,
    "note": "Metaroad shows rank-1 ratio/flat; per-rank resolved damage in per_level"
  },
  "effects": ["Metaroad variants (ranks): 27"],
  "specializations": [
    { "unlock_level": 8, "text": "Changes to mobile skill" },
    { "unlock_level": 8, "text": "30% chance to inflict Frost for 3s on landing [Winter's Shackles]" }
  ],
  "properties": null,
  "damage_type_or_weapon": null,
  "per_level": [
    { "level": 1, "dmg_min": 275.0, "dmg_max": 275.0, "cooldown_s": 45, "cost_mp": 200, "cast_time_s": 0,
      "tokens": { "abe:1511003011:value02:divide100": "20", "abe:1511003012:value02:divide100": "10",
                  "se:1511000013:effect_value02:time": "3", "se:1511003711:effect_value02:time": "5",
                  "se_dmg:1511000011:SkillUIMaxDmgsum": "275", "se_dmg:1511000011:SkillUIMinDmgsum": "275" } },
    { "level": 2, "dmg_min": 369.0, "dmg_max": 369.0, "cooldown_s": 45, "cost_mp": 200, "cast_time_s": 0,
      "tokens": { "se_dmg:1511000011:SkillUIMaxDmgsum": "369", "se_dmg:1511000011:SkillUIMinDmgsum": "369" } }
  ],
  "icon_url": "https://aion2.app/db-item-icons/ICON_SO_SKILL_011.webp",
  "source_url": "https://aion2.app/db/skills/15110000",
  "source_url_secondary": "https://metaroad.gg/aion2/database/skills/sorcerer",
  "source_date": "aion2.app game client dump 2026-09-18; Metaroad datamine page retrieved 2026-10-03 (...)",
  "metaroad_tag": "Active · Magic · Water · Attack · Debuff ·"
}
```

(In the real file the per-rank `tokens` of rank 2 repeat all six keys; trimmed here.)

### 1.7 Fields to treat as null/unreliable

- `cast_time_s`: client value is 0 for all 51 skills; community says Firestorm/Fire Wall/Cold Storm have long animations. Treat 0 as "no cast bar", never as "instant". A rotation sim needs its own animation-time table (not in any file; research gap #1 in builds doc).
- `hits`, `damage_type_or_weapon`: always null.
- `effects`: prose strings only.
- `unlock_level`: null for 17; chain skills must inherit from parent (section 2).
- `max_skill_level`: **40 for core, 25 for stigma** here, but progression doc says global skill-level cap 20 (10 from points + 4 Daevanion + Arcana to 16-20) and global stigma cap 20 (KR 25). Do not let the app allow rank 21-40 on global without a toggle.
- DoT values, shields, Wish of Concentration %, Vaizel's Wisdom %, Illusion duration: hidden, null or unlabelled tokens.
- Cooldowns: 4 skills fall with rank; others constant. Inven (KR live) disagrees with the dump (Delayed Explosion 20s/+25% vs 30s/+15%).
- 12 skills verified only on KR/TW client, may not exist at global launch: Firebomb, Burst, Cold Wave, Vaizel's Wisdom, Pyroclasm, Summon Flame, Illusion, Winter's Illusion, Curse: Old Tree, Magic Energy Blast, Lumiel's Authority, Equip Sorcerer Weapon.

---

## 2. Chain / hidden skill linking

**There is no parent field.** The JSON cannot express a chain. A builder must hard-code the table below (source: `sorcerer_skills_notes.md` "Chains" plus description text; only the first row is client-confirmed "1/3, 2/3, 3/3").

| Parent (id) | Child (id) | Semantics | Confidence |
|---|---|---|---|
| Flame Arrow 15210000 | Burst 15030000 -> Pyroclasm 15250000 | Press same slot 3x: sequential basic attack chain, 0 CD, each restores MP (100/100/120) | client-confirmed |
| Ice Chain 15090000 | Cold Wave 15100000 | Follow-up, near-identical text | inferred |
| Winter's Shackles 15110000 | Winter's Illusion 15330000 | Follow-up; spec unlock at rank 12 | inferred |
| Lumiel's Space 15300000 | The Depths (no id) | Airborne target -> Knockdown 2s | inferred |
| Curse: Tree 15140000 | Curse: Old Tree 15340000 | Upgraded form; CD 120 -> 42 over ranks | inferred |
| Hibernation 15410000 | Remove Hibernation 15410057 | Cancel; inherits unlock 22 | inferred (id prefix 1541) |
| Frost Burst 15220000 | Frost Burst 15220037 | Proc child, same name, same icon | inferred (id prefix 1522) |
| Hellfire 15060000 | Hellfire - Level 1 / Level 2 / Max (no id) | Charge tiers of one skill, not separate skills. Metaroad rows carry only cd 45, MP 200, range 20 | inferred |
| Flame Scattershot 15010000, Cold Snap 15080000, Magic Energy Blast 15350000 | (trigger condition) | Usable on **Staggered** targets; a condition, not a parent | text-based |
| Firestorm / Fire Mark | Blaze 15050000 | Blaze requires a Fire Mark target; condition, not parent | text-based |
| Unknown | Firebomb 15020000, Summon Flame 15270000, Illusion 15290000, Vaizel's Wisdom 15180000, Lumiel's Authority 15380000, Flame Zone | No parent found in any file | unlinked |

Id heuristic: `skill_id // 10000` groups a base skill with its sub-skills (1541xxxx, 1522xxxx). It does not link Burst (1503) to Flame Arrow (1521), so it is only a partial rule.

Unlock inheritance: a child with `unlock_level: null` should take the parent's level (Burst/Pyroclasm = 1, Cold Wave = 1, Winter's Illusion = 8 or its 12-rank spec, Curse: Old Tree = 22, Remove Hibernation = 22).

Suggested app-side fix: ship a small `chains.json` ({child_id_or_name: parent_id, kind: "chain"|"proc"|"charge"|"condition"}) rather than parsing the skills file.

---

## 3. Skill to icon mapping

Facts verified by script:

- `index.json`: object keyed by **slug**; each value `{name, source_url, size:"256x256", skill_id:string, icon:string}`. Note `skill_id` is a **string** here and an **int** in the skills JSON.
- Icon files: `assets/icons/sorcerer/<slug>.png`, key == filename stem, 51 keys == 51 files. PNG (converted from webp), 256x256 RGBA.
- Slug rule that works for all 51: lowercase, **delete apostrophes first**, then replace runs of non-alphanumerics with `-`, trim `-`. (`Winter's Shackles` -> `winters-shackles`.)

Why a naive slug fails (naive = replace every non-alnum with `-`, so apostrophe becomes `-`):

**Group A, apostrophe (5 skills):** naive `winter-s-shackles`, `vaizel-s-wisdom`, `lumiel-s-space`, `winter-s-illusion`, `lumiel-s-authority`. Real files: `winters-shackles`, `vaizels-wisdom`, `lumiels-space`, `winters-illusion`, `lumiels-authority`. Fixed by deleting apostrophes (also strip typographic `’`).

**Group B, no id and no icon (5 entries):**
- `Hellfire - Level 1`, `Hellfire - Level 2`, `Hellfire - Max`: no file of their own. Use **`hellfire.png`** (ICON_SO_SKILL_006) for all three; they are charge levels of one skill.
- `The Depths`, `Flame Zone`: no icon exists in the DB (skill_id null, icon_url null). Use a placeholder, or borrow `lumiels-space.png` for The Depths (its parent).

**Name collisions needing the id (2 skills, not among the 10 but a trap):** index keys are `cold-snap` = **15080000** (the chain/hidden active) and `cold-snap-15730000` = the passive; `frost-burst` = 15220000 and `frost-burst-15220037` = proc. A name lookup gives the wrong file half the time.

**Recommended lookup (most reliable):** build `{int(v.skill_id): slug}` from `index.json`; for a skill use `by_id[skill.skill_id]`, and only fall back to slug-from-name when `skill_id` is null. With `skill_id` null: Hellfire L1/L2/Max -> `hellfire`; The Depths, Flame Zone -> placeholder.

**Shared icons (by design in the client, not bugs):** one `icon` id used by two entries:
- ICON_SO_SKILL_012: Equip Sorcerer Weapon and Glacial Smite
- ICON_SO_SKILL_014: Curse: Tree and Curse: Old Tree
- ICON_SO_SKILL_022: Frost Burst and Frost Burst proc
- ICON_SO_SKILL_024: Summon Flame and Magic Energy Blast
- ICON_SO_SKILL_038: Lumiel's Authority and Grace of Resistance

Other notes: Remove Hibernation uses `ICON_SO_SKILL_041_A`; Defiance, Assault Bombardment use `ICON_CO_SKILL_*` (common), Revitalization Contract uses `ICON_AS_SKILL_Passive_009` (an Assassin-prefixed icon on a Sorcerer skill, as shipped). Icon art is NCSOFT property: personal use, keep `assets/` out of public repos (`icons_notes.md`).

---

## 4. Damage formula and stat weights (from `sorcerer_builds_and_dps.md`)

Status: **community fit, not published by NCSOFT.** Sources S1 (mmoherald damage-calculation, 2026-09-13) and S3 (gameplay.tips, 2026-10-02), KR/TW endgame. The doc warns pages were summarized by a small model, so re-check figures before hard-coding.

### 4.1 Formula, exact text

```
attack = ((pure_attack * weapon_damage_boost * multi_hit * power_shard) + attack_bonus)
         * attack_increase
         + PvE_attack + boss_attack + species_attack (+ front/back attack, per S3)

damage = (attack * skill_coefficient [+ skill_additional_damage, per S3]
          - (defense - penetration) * 0.1)
         * (damage_boost + PvE_boost + boss_boost + species_boost)      # additive bucket
         * critical_damage * smite * perfect * front_back_boost          # separate multiplicative buckets
         * skill_specialty_enhancement (S3 only)
```

Mapping to the skills JSON: `skill_coefficient` = `atk_ratio_pct_rank1 / 100` (rank 1 only); `skill_additional_damage` is the flat part, probably `per_level[rank-1].dmg_min` (unconfirmed which of ratio/flat the flat figure belongs with).

### 4.2 Constants (S1, S3)

| Constant | Value | Note |
|---|---|---|
| Defense factor, PvE | 0.1 | |
| Defense factor, PvP | 0.01 | |
| Crit chance cap | 80% at 1,200-point gap (Critical Hit minus target Critical Resist) | progression doc section 3.3 (a secondhand summary) says crit cap 50%: conflict |
| Parry cap | 80% at 1,200 accuracy gap; ~6-7% per 100 accuracy gap | |
| Boss Smite resistance | -30% | |
| Boss crit damage resistance | -25% | |
| Crit damage base | 150% + crit damage boost - tolerance | from a search snippet; S13 says "minimum 2x": conflict (builds doc 8.9) |
| Endurance | chance to take 50% damage | |
| Smite = "Double" (Double Chance) | same stat, name varies by translation | unverified |

### 4.3 Stat list (variables the calculator needs)

pure attack, weapon damage boost, multi-hit, power shard, attack bonus, attack increase, PvE attack, boss attack, species attack, front/back attack, skill coefficient, skill additional damage, defense, penetration, damage boost (+PvE/boss/species), critical damage, crit chance, crit resist, smite, perfect, front/back boost, skill specialty enhancement, accuracy, combat speed, cooldown reduction, MP pool/regen.

### 4.4 Marginal values

**S1 class-agnostic (KR endgame builds with support buffs, testers kanonxo and Aion Research Lab):**

| Stat | Damage gained |
|---|---|
| +1% Smite | 0.60-0.65% |
| +1% Front/back boost | 0.57-0.65% (zero for Sorcerer) |
| +1% Weapon damage boost | 0.50-0.55% |
| +1% Crit damage boost | 0.40-0.60% |
| +1% Damage boost | 0.30-0.35% |
| +1% Perfect | ~0.10% |
| +10 Attack | ~0.17% |
| +10 Max Attack | ~0.13% (S3: 0.1325%) |
| +10 Attack bonus | ~0.10% |
| Multi-hit | ~0.33% per 1% at 36-40% (S3) |

**S2 Sorcerer-specific (mmoherald stat-weights, 2026-09-16, KR/TW; example line 1,800 attack, 70% crit, 25% Smite):**

| Stat | Gain |
|---|---|
| +1% Smite | +0.80% |
| +1% Attack increase | +0.76% |
| +1% Combat speed | +0.74% |
| +1% Damage boost | +0.62% |
| +1% Weapon damage | +0.62% |
| +1% Crit damage | +0.51% |
| +1% Crit chance | +0.40% |
| +10 Attack | +0.43% |
| +10 Attack bonus | +0.34% |
| Front/back | not applicable (zero for Sorcerer) |

Break-evens (S2): Crit Damage beats Crit Chance above 56% crit; 1% Damage boost = 15 Attack; 1% Smite = 1.28x a 1% Damage boost; 1% combat speed = 1.19x a 1% damage boost. Flat attack value decays with gear: +10 attack = +0.93% (fresh Lv45), +0.43% (geared), +0.24% (KR endgame).

**Do not mix S1 and S2 columns** (different baselines). Use S2 for Sorcerer defaults; use them as validation targets, not inputs.

Other numbers: raid targets (Accuracy/Crit) Ludra ~1,500/~1,600, Corroded ~2,350/~2,500, Muspel Hard ~2,800/~3,150; PvP ~2,500 accuracy. Combat Power per point: Attack 1.25, Defense 1.0, Main stat 1.25, Crit 0.25, Accuracy 0.25, Sub stat 0.25, HP/MP 0.05, Penetration 10 (labeled a bug), percent stats 100 per 1%. CP is a ranking number, not DPS.

Sorcerer-relevant passive thresholds: Grace of Enhancement damage boost needs MP >= 25% (JSON/Fextralife; guides say 50%, conflict); Robe of Earth +105 Crit Hit needs MP >= 50%.

### 4.5 Calculator gaps (from the doc, section 11)

No cast/animation times, no Hellfire per-charge timing, no numbers for Delayed Explosion / Divine Burst / Fire Wall / Cold Storm / Robe of Flame / Element Enhancement by level, no skill-specialty bucket values, no crit-curve formula, all KR/TW values.

---

## 5. Progression level bands (`game_ui_and_progression.md`, GLOBAL unless noted)

Global cap **45** (client 2.0.3.0, launch 2026-10-05); KR/TW cap **50** since 2026-07-01. Keep the two as separate configs.

| Level | Event |
|---|---|
| 1-9 | Starting zone (Poeta Elyos / Ishalgen Asmodian) |
| 5 (Elyos) / 6 (Asmodian) | Wings, Daeva ascension (aion2hub says 10: conflict, prefer 5/6) |
| 10-45 | Verteron (Elyos) / Altgard (Asmodian); Lv10 Crafting + Sealed Dungeon tier 1 |
| 12 | Daevanion board 1 (Nezekan) |
| 20 | Daevanion board 2 (Zikel); Krao Cave Exploration (IL 200) |
| 22 | **Stigma skills (13/class) + Stigma slot 1** (earlier sources said 35; metabot newest) |
| 27 / 32 / 37 | Stigma slots 2 / 3 / 4 |
| 28 | Urugugu Canyon Exploration (IL 300) |
| 30 | Daevanion board 3 (Vaizel); Daily Dungeon |
| 35 | Fire Temple Exploration (IL 500) |
| 40 | Daevanion board 4 (Triniel) |
| 45 | Daevanion board 5 (Azphel); story end; Conquest modes; Draupnir |
| 45-50 | KR only: Eltnen/Morheim, Chapter 1/2 |

Sorcerer core unlocks (JSON `unlock_level`): 1 Flame Arrow, Firestorm, Ice Chain, Fire Mark, Equip Weapon, Dodge; 3 Bittercold Wind; 4 Blaze; 5 Flame Scattershot; 6 Robe of Earth; 7 Frost; 8 Winter's Shackles; 9 Cold Snap (passive); 10 Frost Burst; 11 Robe of Flame; 12 Wish of Concentration; 13 Absorb Essence; 14 Hellfire; 15 Grace of Resistance; 16 Defiance; 17 Robe of Cold; 21 Grace of Enhancement; 22 all stigmas; 23 Revitalization Contract; 25 Vitality Evaporation. (Levels 23 and 25 are within global cap 45.)

Skill-rank system: specialty slots unlock at skill rank 8/12/16/20 (matches JSON); global rank cap 20 (10 base + 4 Daevanion + Arcana to 16-20); stigma cap 20 global, 25 KR; stigma upgrades via Stigma Shards. Daevanion: 5 boards, 802 points total; node cost Common 1/Rare 2/Epic 3/Unique 4.

Gear bands (per-piece IL): 1-20 Starter, 20-30 -> 23-28, 30-40 -> 36-46, 45 -> 54-102. Do not confuse per-piece IL with the character IL gates (200-4,800).

Controls (for the macro/hotbar side): skill slots 1-12 number keys, consumables F1-F8, 3 skill presets, macros up to 20 skills, suggested macro delay 10 ms (low ping) to ~50 ms; Macro and Skill Window tabs (Active/Passive/Mastery/Stigma/Macro) per allthings.how. HUD default positions are unknown; use calibration, not fixed pixels.

---

## 6. Top data risks (ranked)

1. **No parent field.** Chains, Hellfire tiers and procs must be hand-linked (section 2); ~6 hidden skills have no known parent at all.
2. **Rank scaling is half-known.** Only rank-1 ATK ratio exists; per-rank `dmg_*` are resolved flats whose relation to the ratio is unconfirmed. Ranks 21-40 likely do not exist on global (cap 20).
3. **`cast_time_s` is 0 everywhere**, so any DPS/rotation timing computed from it will be wrong.
4. **Icon lookup traps:** apostrophe slugs (5), id-less Hellfire tiers/The Depths/Flame Zone (5), duplicate names Cold Snap/Frost Burst (2), `skill_id` is string in index but int in skills JSON.
5. **Region/version drift:** KR/TW datamine vs Global launch; 12 skills KR-only; MP thresholds (25/50%), crit cap (50/80%), crit base (150/200%), stigma level (22 vs 35) conflict across sources; the damage formula is a community fit.
