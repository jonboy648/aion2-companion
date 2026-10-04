# Multi-hit rule: per hit or per cast? (2026-10-03)

## Verdict
Both the flat (SkillUI{Min,Max}Dmgsum token) and the ATK ratio are PER HIT. A cast deals `hits x (ATK*ratio + flat)`.
Confidence: ~85% (strong text evidence from the client-derived Metaroad dump; NO in-game dummy test found).

## Evidence
1. Metaroad (client-text mirror, https://metaroad.gg/aion2/database/skills/<class>) words EVERY multi-hit skill as
   "X% ATK + Y per hit (N hits) damage". Y equals the Dmgsum token exactly (Pummel 93, Rending Blow 70, Rage Burst 1327 ...).
   The ratio sits in the same "per hit" clause, so it is per hit too.
2. aion2.app/db/skills/<id> shows only the stripped number ("Deals 93-93 damage") with no ATK part, no hit count, no
   "per hit" wording. Its number is the Dmgsum token = the per-hit number. So the page cannot contradict the rule; it just
   omits the information (one WebFetch summary even said "per hit" for Storm Rampage 107, which is the page's own inference).
3. Our local `description` for Assassin / Chanter / Cleric skills was taken from the aion2.app wording (no "per hit"),
   so `per_hit_multiplier` (damage.py, keyed on the text "per hit") returns 1 for them although Metaroad says per hit.
4. Community dummy numbers: Firecrawl (4 searches, 4 credits at most) and fetches found nothing comparing a multi-hit
   tooltip to observed total damage. Inven 909 and MMO Herald do not address it; Reddit blocked for WebFetch. The
   community "Multi-Hit" STAT is a different mechanic (extra hits on proc) and is not evidence either way.

## Per-skill table (rank 1; "page" = aion2.app per-hit number, "MR text" = Metaroad)
| class | skill_id | skill | hits | Dmgsum r1 | aion2.app page | MR description | engine today | verdict |
|---|---|---|---|---|---|---|---|---|
| Templar | 12040000 | Pummel | 3 | 93 | "93-93" | 119.5% ATK + 93 per hit (3 hits) | x3 | per hit, OK |
| Gladiator | 11010000 | Rending Blow | 2 | 70 | n/a (same token) | 74.25% ATK + 70 per hit (2 hits) | x2 | per hit, OK |
| Gladiator | 11170000 | Overhead Slam | 2 | 174 | n/a | 163.6% ATK + 174 per hit (2 hits) | x2 | per hit, OK |
| Gladiator | 11290000 | Mocking Blade | 3 | 207 | "207-207" | 194.4% ATK + 207 per hit (3 hits) | x3 | per hit, OK |
| Gladiator | 11390000 | Rage Burst | 5 | 1327 | "1327-1327" | 218% ATK + 1327 per hit (5 hits) | x5 | per hit, OK |
| Ranger | 14030000 | Rapid Fire | 3 | 50 | "50-50" | 44.95% ATK + 50 per hit (3 hits) | x3 | per hit, OK |
| Assassin | 13010000 | Quick Slice | 2 | 58 | "58-58 (2 hits)" | 70% ATK + 61 per hit (2 hits) | x1 | per hit, UNDERCOUNTED |
| Assassin | 13340000 | Storm Rampage | 4 | 107 | "107-107" | 82.5% ATK + 107 per hit (4 hits) | x1 | per hit, UNDERCOUNTED |
| Assassin | 13270000 | Savage Fang | 3 | 1074 | "1074-1074" | 200% ATK + 1074 per hit (3 hits) | x1 | per hit, UNDERCOUNTED |
| Assassin | 13230000 | Aerial Bind | 3 | 837 | "837-837" | 156% ATK + 837 per hit (3 hits) | x1 | per hit, UNDERCOUNTED |
| Assassin | 13240000 | Aerial Slaughter | 4 | 1256 | "1256-1256" | 234% ATK + 1256 per hit (4 hits) | x1 | per hit, UNDERCOUNTED |
| Assassin | 13030000/13040000/13110000/13360000/13380000 | Breaking Slice, Swift Slice, Savage Back Kick, Infiltrate, Dark Strike | 3/4/2/2/2 | 62/69/73/239/311 | same-number pages | "... per hit (N hits)" | x1 | per hit, UNDERCOUNTED |
| Chanter | 18020000 | Resonance Crush | 5 | 83 | "83-83" | 98.18% ATK + 83 per hit (5 hits) | x1 | per hit, UNDERCOUNTED |
| Chanter | 18010000 | Onslaught | 2 | 74 | "74-74" | 84.21% ATK + 74 per hit (2 hits) | x1 | per hit, UNDERCOUNTED |
| Chanter | 18300000 | Gust Rampage | 4 | 120 | "120-120" | 82.5% ATK + 120 per hit (4 hits) | x1 | per hit, UNDERCOUNTED |
| Chanter | 18040000/18050000/18080000/18080037/18220000 | Incandescent, Bursting, Wave Blow x2, Obliterate | 2/2/2/2/3 | 160/175/538/538/1078 | same-number pages | not individually fetched (Metaroad pattern identical for all fetched Chanter skills) | x1 | per hit (inferred), UNDERCOUNTED |
| Cleric | 17370000 | Lightning Strike Scattershot | 4 | 147 | "147-147" | 113% ATK + 147 per hit (4 hits) | x1 | per hit, UNDERCOUNTED |

## Exceptions / caveats
- Spiritmaster Jointstrike: Curse (16140000, hits 5) and Corrode (16150000, hits 2): our text is "75% ATK + 74 damage" with
  NO "per hit"; their `hits` count is probably the whole combined animation, not repeats of the 74. Not verified on
  Metaroad. Keep them x1 (a blanket `hits>1` rule would wrongly x5 / x2 them).
- Quick Slice / Swift Slice: Metaroad flat 61 / 73 vs Dmgsum 58 / 69 in our per_level L1. The page numbers differ from the
  Metaroad rank-1 flat by ~5%; unexplained (patch drift or Metaroad shows a different level). Per-hit conclusion unaffected.
- `hits` for Assassin/Chanter comes from Metaroad "(N hits)"; assumed correct.
- DoT ticks (SkillUIDotMax*) are never multiplied.
- Validation gap: no in-game or dummy figure confirms it. A single dummy cast of Pummel (expect ~3 x (1.195*ATK + 93))
  vs the sum of its 3 hit numbers would settle it.

## Required change (D:\Aion2\app\aion2c\engine\damage.py, per_hit_multiplier)
Current: `return skill.hits if skill.hits > 1 and "per hit" in skill.description.lower() else 1`
Needed: also multiply when the text has no ATK part at all (the stripped Assassin/Chanter/Cleric wording), still skipping the
Jointstrike-style "N% ATK + M damage" texts:
```python
d = skill.description.lower()
return skill.hits if skill.hits > 1 and ("per hit" in d or "atk" not in d) else 1
```
Better root fix: set "per hit" in the class data descriptions (or store a `per_hit` flag) from Metaroad, then drop the text sniffing.
Update tests that pin Quick Slice unchanged (build_validation_v3.md says Quick Slice x1).
