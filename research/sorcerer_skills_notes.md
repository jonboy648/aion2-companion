# Aion 2 Sorcerer (KR: 마도성) - research notes

Collected 2026-10-03. Global launch is reported as 2026-10-05 (aion2codex). All skill data below is a client datamine of a pre-launch build, not live-server verified.

## Sources and versions
| Source | URL | Version/date | Used for |
|---|---|---|---|
| Aion2.app (Aion2t.com) DB | https://aion2.app/db/skills?class=Sorcerer (+ /db/skills/<id>, /ko/db/skills/<id>) | "Game client 18.09.2026" | Skill ids, KR names, unlock level, max rank, per-rank damage/cooldown/cost/cast, spec list, icons, raw tokens. Primary structured source. |
| Metaroad | https://metaroad.gg/aion2/database/skills/sorcerer | Retrieved 2026-10-03; "read from the Aion 2 client" | Attack ratio %, flat, hits, stagger gauge dmg, range, MP, human-readable descriptions, spec text. Values shown are RANK 1 (verified: Flame Arrow flat 62 = aion2.app level 1). |
| AION2 Hub | https://aion2hub.com/classes/sorcerer | Global data (Launch Scale Test client, 2026-09-19) + KR/TW client v110 2026-09-09 | Confirms 36 core skills (26 active, 10 passive) + 12 KR/TW-only; says CC kit and "instant-cast". |
| aion2db.gg | https://aion2db.gg/class/sorcerer/ | undated | Cross-check of unlock levels (names are zh-TW). |
| aion2codex | https://aion2codex.wiki/classes/sorcerer | updated 2026-10-02 | Qualitative only: MP is the constraint, charging trade-off, stationary playstyle. Says NCSOFT had not published Sorcerer skills. |
| Inven post | https://www.inven.co.kr/board/aion2/6453/15716 | undated, KR live build (older than client dump) | Community PvE critique; numbers DIFFER from client dump (Delayed Explosion 20s CD / +25% for 4s vs dump 30s / +15%). Not used for fields. |

Excluded: gamemeca 232988 and 232958 (dated 2010 - they are about Aion 1). Aion Fandom / Allakhazam results are Aion 1. questlog.gg is a JS SPA and returned no data to fetch/curl; namu.wiki returned 403. No Korean official-site data was reachable.

## Core mechanics (from skill text)
- Resource: MP. Many basic attacks restore MP (Flame Arrow +100, Burst +100, Pyroclasm +120, Blaze +100; Frost +200 via spec). Big skills cost 100-300 MP. Robe of Earth: +7% Max MP, +5 natural MP regen, +105 Crit Hit while MP >= 50%. Grace of Enhancement damage boost needs MP >= 25%.
- Stagger: skills deal "Stagger Gauge Damage" (2 to 50 per skill). Staggered targets enable Flame Scattershot, Cold Snap, Magic Energy Blast.
- Fire Mark (passive): inflicted for 5s on a Fire hit; 20% chance of extra damage (55% ATK + 32 at rank 1), 1s ICD. Blaze requires a Fire Mark target. A KR post says two Sorcerers overwrite each other's mark.
- Chains: Flame Arrow -> Burst -> Pyroclasm (client chain 1/3,2/3,3/3). Ice Chain -> Cold Wave (inferred from near-identical text), Winter's Shackles -> Winter's Illusion (spec unlock lvl 12), Lumiel's Space -> The Depths (airborne -> knockdown), Curse: Tree -> Curse: Old Tree. Chain wiring beyond Flame Arrow is inferred from spec text.
- Water = Slow/Frost/Root/Seal CC; Fire = DoT (Embers), Fire Mark synergy. Frost Burst needs a Frost target. Frost on NPC targets is 100% chance.
- Cooldown reduction hooks inside specs: Firestorm fireballs reduce Hellfire CD; Blaze hit reduces Wish of Concentration CD; Flame Scattershot spec -1s all CDs; Wish of Concentration spec -10s all CDs.
- Charge: Hellfire has 3 charge levels (339-1018% ATK, 20-35 stagger).
- Specializations: every skill has 3-5 spec slots unlocking at skill rank 8/12/16 (core) or 5/10/15/20 (stigma). No separate class talent tree was found in these sources.
- Stigma: 13 stigma skills, required level 22, each costs "stigma points" (amount not extracted). The Icy Armor / Glacial Strike stigma trees in a gamemeca article are Aion 1 content and were discarded.
- Daeva/ultimate/Daevanion: the Sorcerer has no separate ultimate in the client dump. aion2.app has a category filter "Dp" that returned stigma skills (all DP costs in the per-rank data are 0; meaning of "Dp" unconfirmed). Daevanion boards exist on metaroad (/aion2/database/daevanion/sorcerer) but were not captured.

## Field confidence
| Field | Confidence | Notes |
|---|---|---|
| name EN / KR | high | KR from aion2.app /ko pages. |
| unlock_level | high for 36 core skills; null for chain skills | Chain/hidden skills have no level in the DB. Remove Hibernation shows 22 (inherits parent). |
| category | medium | stigma/active/passive from client header; "chain_or_hidden*" is my label for skills the DB lists without a level. |
| cooldown_s | high | rank 1 value; some fall with rank (Defiance 60->21, Curse: Old Tree 120->42, Hibernation 180->132, Curse: Tree 90->66), see cooldown_s_at_max_level. Many 0 = no cooldown. |
| cast_time_s | LOW | Client `casting_time` is 0 for every skill. This matches NCSOFT "instant-cast" but community posts complain of long animations (Firestorm, Fire Wall, Cold Storm). Treat 0 as "no cast bar", not "no animation lock". |
| cost | high for MP; hp/dp always 0 | Stamina costs not found. |
| range_m | medium | null where DB shows none (self buffs). |
| coefficients | medium | rank-1 ratio and flat. Per-rank ratio is not exposed; per_level.dmg_min/max holds resolved client damage numbers (flat component only is plausible, not confirmed) so do not multiply them by the ratio. |
| effects / specializations | high | text from client. |
| icon_url | high for 51 skills | webp at https://aion2.app/db-item-icons/ICON_SO_SKILL_*.webp; null for 5 Metaroad-only entries. |

## Gaps
- Damage-over-time values (Firebomb, Embers, Frostbite), shield %, Wish of Concentration attack %, Vaizel's Wisdom % and Illusion duration are hidden ("—") in Metaroad and unresolved in aion2.app tokens; stored as null or as raw tokens in per_level.tokens.
- Per-rank effect values for passives are only available as unlabelled tokens (per_level.tokens).
- No stigma point cost, no skill-point costs, no Daevanion node data, no Korean live-server cooldown values (the Inven post disagrees with the dump, so the live KR build differs).
- 56 entries vs Metaroad's stated 55; one Metaroad variant (likely the Cold Snap active or Frost Burst proc) could not be matched and Aion2.app's Frost Burst (15220037) has no description.
- Rank-1 vs max-rank values for 'coefficients' are Metaroad's; the Global-vs-KR/TW difference (12 skills only verified on KR/TW: Firebomb, Burst, Cold Wave, Vaizel's Wisdom, Pyroclasm, Summon Flame, Illusion, Winter's Illusion, Curse: Old Tree, Magic Energy Blast, Lumiel's Authority, weapon equip) means these may not appear at global launch.
