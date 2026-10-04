# Client numbers applied (2026-10-04)

Derived numbers only. Source is the private client table export (path comes from env `AION2_EXPORT_DIR`, never stored in the repo). Regenerate with `python -m aion2c.data.client_export` (from `app/`), then `python -m aion2c.data.build_gamedata --all`, then `python web/scripts/bundle_engine.py` and `python web/scripts/make_fixtures.py`.

## What changed
- `app/aion2c/data/client_export.py` writes `app/aion2c/data/src/client_skill_numbers.json` (113 KiB: per skill key, flat min/max per rank, ATK ratio, hits, charge timing/tiers, DoT tick data).
- `build_gamedata.py` merges them: `atk_ratio_pct`, `hits` and ranks 2..N flat damage come from the client where a skill matched; rank 1, cooldown, MP and unmatched skills keep their old values.
- Hellfire is 4 charge tiers: ratios 339.25 / 474.95 / 678.5 / 1017.75 %, flat at 0 / 20 / 50 / 100 % of the rank's flat range (1460 / 2044 / 2920 / 4381 at rank 2), hits 1/1/1/2, charge 0.3 / 0.5 / 1.0 / 1.5 s (SkillCharge min 300 ms, tiers 500/1000/1500 ms). New optional `ChargeLevel.hits` and `.flat_frac` fields.
- Fire Wall Embers: 110% ATK + flat per 1 s tick, flat 738 (rank 2) to 2059 (rank 25), rank 1 = 650 from the old dump. Cold Storm Frostbite: 80% ATK + flat 537 to 1497, rank 1 = 472 from the old dump. New `Status.tick_flat_ranks`, applied by the simulator per tick. The old "rank 40" mislabel is gone (these are 25-rank stigmas). "Until Jon's tooltip" wording removed from mechanics.json (no user-facing copy had it).
- Zero or wrong ratios fixed: Magic Backflow 108, Fire Spirit Rage Burst 95, Water Spirit Ice Chain 114, Wind Spirit Gale 85.5 (all variants), Explosive Arrow (14360000) 253, Dark Crush 219.73, Rushing Smash 189.0.
- Web: `types.ts` gained `tick_flat_ranks`, `hits`, `flat_frac`; engine bundle and fixtures regenerated; two fixture-dependent vitest assertions updated (Hellfire top tier is now level 4; the rotation-plan test uses the AoE fixture because Boss no longer has unused skills).

## Match gate (flat damage equal to the client on every shared rank)
Sorcerer 26/26, Gladiator 33/33, Cleric 17/17, Chanter 25/25, Ranger 30/30 skills with rank data (31 entries incl. Explosive Arrow 14360000 ratio-only). All pass.

Skills NOT matched (current values kept):
- Assassin (9): quick-slice, breaking-slice, swift-slice, insignia-explosion, shadow-fall-13220037, heart-gore-13350007 (same ratio as the client name-rule group but our flats differ), apply-poison, apply-poison-13730000 (no client group), illusive-clone (no flat data). Task said 5; the 5 flat-mismatch ones plus these.
- Templar (5): punishment, shield-smite, annihilate, warding-strike (same ratio, flats differ), blade-storm (no group).
- Spiritmaster (4): continuous-impact, extract-vitality, soul-decimation, elemental-fusion-16300001.
- Chanter wave-blow-18080037 (rank 1 only, flat differs), Ranger drill-dart-14050007, dust-arrow, explosive-arrow (14230000), impact-kick (single rank, nothing to match), Gladiator lunge-stance (ratio only).
- For the "same ratio, different flat" group the client flats are about 1.3-1.5x ours at rank 2: our dump may be an older build. Not changed.

## Skills changed by more than 5% (ratio, hits or flat)
Ratio 0 -> client: Magic Backflow 108; Fire Spirit Rage Burst x3 95; Water Spirit Ice Chain x3 114; Wind Spirit Gale x3 85.5; Explosive Arrow 14360000 253.
Hits: Assassin Savage Back Kick 1->2, Aerial Bind 1->3, Aerial Slaughter 1->4, Savage Fang 1->3, Infiltrate 1->2, Dark Strike 1->2; Cleric Lightning Strike Scattershot 1->4; Chanter Bursting Blow 2->1; Spiritmaster Jointstrike Curse 5->1, Jointstrike Corrode 2->1.
Flat damage: no skill moved by more than 5% (the old data already matched). Chanter Dark Crush ratio 210.18 -> 219.73 is +4.5% (below the threshold, applied anyway). Hellfire per-tier ratio/hits and the two DoT statuses are new behaviour, not a change of an existing number.
Caution: the hits changes come from the client's base effect group. Jointstrike Curse/Corrode 5 and 2 came from the description of one elemental variant; the base group says 1. Worth a look in game.

## DPS before -> after (4 playstyles, default optimizer, same reference stats)
Reference: DarthThot armory fixture stats and gear for every class (Sorcerer uses its real Daevanion nodes; other classes get the same stats with no Daevanion nodes, so only the relative change matters).

| class | boss | aoe | leveling | burst |
|---|---|---|---|---|
| sorcerer | 14,882 -> 17,452 (+17.3%) | 53,188 -> 62,821 (+18.1%) | 67,395 -> 80,501 (+19.4%) | 26,597 -> 30,246 (+13.7%) |
| gladiator | unchanged | unchanged | unchanged | unchanged |
| templar | unchanged | unchanged | unchanged | unchanged |
| assassin | 2,769 -> 3,049 (+10.1%) | 10,826 -> 13,163 (+21.6%) | 9,260 -> 11,451 (+23.7%) | 3,549 -> 4,658 (+31.3%) |
| ranger | 4,015 -> 4,190 (+4.4%) | 16,033 -> 15,716 (-2.0%) | 14,802 -> 14,979 (+1.2%) | 5,879 -> 6,068 (+3.2%) |
| spiritmaster | 4,031 -> 3,479 (-13.7%) | 16,866 -> 13,497 (-20.0%) | 18,267 -> 14,716 (-19.4%) | 7,342 -> 6,577 (-10.4%) |
| cleric | unchanged | unchanged | unchanged | unchanged |
| chanter | 8,849 -> 8,528 (-3.6%) | 42,341 -> 37,636 (-11.1%) | 37,344 -> 31,378 (-16.0%) | 12,302 -> 10,350 (-15.9%) |

Sorcerer gain is mainly the Fire Wall and Cold Storm ticks plus the Hellfire tiers. Spiritmaster and Chanter drops come from the hit-count corrections above (Jointstrike, Bursting Blow).

## Observations from the newly decoded Skill table (not applied)
Skill.json now exists. For the 228 matched skills with rank data, rank-1 cooldown equals the client's `NeedCoolTime` and MP equals `NeedCostMp`, with no exceptions except 7 skills where ours says cooldown 1.0 s and the client says 0 (Ranger concentrated-fire, hunters-soul, melee-fire, rooting-eye; Cleric empyrean-lords-grace; Chanter raging-spell, winds-promise; all passives or buffs, so no DPS effect). Range matches (NeedSkillUseRange/100) wherever we have one. Client `CastingTime` is 0 for every matched skill, which agrees with the "no cast bar" assumption. Charge skills carry a `ChargeId`. Nothing in the engine was changed for these.

## Guards
`app/tests/test_client_numbers.py`: no file in the repo contains the raw export path, no decoded-table dump exists in the repo, the derived file is under 1.5 MB and holds only our skill keys and numbers, and the script refuses to run without `AION2_EXPORT_DIR`. The raw path was also scrubbed from two older research notes.
