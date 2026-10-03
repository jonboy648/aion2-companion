# Aion 2 Templar (KR: 수호성) - research notes

Collected 2026-10-03, two days before the Global launch (2026-10-05). Skill data is the aion2.app "Game client 18.09.2026" dump plus Metaroad's Templar page; nothing here was verified in game.

Output files (same schemas the Sorcerer pipeline uses; `aion2c.data.build_gamedata.assemble(..., class_key="templar")` builds from them without error, checked 2026-10-03):

| File | Content |
|---|---|
| `skills.json` | 46 entries: 42 with skill_id (13 stigma, 12 active, 10 passive, 6 chain_or_hidden_active, 1 basic_dodge) + 4 id-less Metaroad rows (Punishment - Level 1 / Level 2 / Max, Shield Rush - Max). 1431 per-rank rows. |
| `D:\Aion2\assets\icons\templar\*.png` + `index.json` | 42 icons, all 256x256 RGBA, slug rule from data_contract.md. |
| `mechanics.json` | 23 statuses, 27 rules, 2 triggers, tags on 33 skills (`manual`, `role:*`, `trigger:*`). |
| `chains.json` | 15 links (3 client-confirmed chains), 1 unlinked skill, 1 stagger-only skill. |
| `community_rotations.json` | 5 sourced priority lists (boss_180, aoe_pack, level_pull). |
| `roadmap.json` | 39 items: Templar skill unlocks + shared progression copied from the Sorcerer roadmap. |
| `daevanion.json` | 5 boards, 537 nodes (88+88+88+116+152 selectable + 5 free starts), 802 points. Boards are NOT shared with Sorcerer: same unlock levels and cost scheme, different node layout, stats and skill nodes. |
| `tools/` | Re-runnable pipeline (parse_sources, build_skills, fetch_icons, build_mechanics*, build_misc, build_daevanion). `raw/` holds the saved pages. |

## Sources (all fetched 2026-10-03, requests >= 0.4 s apart, robots allows /db)
| Source | Used for | Notes |
|---|---|---|
| aion2.app/db/skills/12xxxxxx (+ /ko/ for Korean names) | ids, unlock level, max rank, per-rank damage/cooldown/MP/heal/tokens, specs with levels and numbers, Chain panel, icons | "Game client 18.09.2026". Primary. Probed ids 12000000 to 12990000 in steps of 10000 plus 12000100 (43 pages exist) and cross-checked against the /db?class=Templar listing (42 ids). |
| metaroad.gg/aion2/database/skills/templar | ATK ratio %, rank-1 flat, hits, stagger gauge, descriptions, tags, id-less charge rows | Shows rank 1 only ("498 variants"). 47 articles. |
| aion2t.com/daevanion?job=3 | all Daevanion nodes (id, x/y, grade, effects, skill ids) | Site says data comes from the official NCSOFT API. |
| metaroad.gg/aion2/database/daevanion/templar | cross-check of board totals, crystal pools | |
| couga54.github.io/aion2-guides/en/templar/ (Oct 3 2026, Global S1, SolAshur / trueeevil builds) | macro lines, rotation, stigma picks, Fury/Judgment behaviour | opinion |
| gegebase.com/games/aion2/templar_pve_guide (Sep 2026) | patch history (Aug 26, Sep 2, Sep 4), beginner/advanced rotation, tank priorities | opinion, KR-derived |
| aion2hub.com/classes/templar (data "Launch Scale Test client 2026-09-19" + KR/TW v110 2026-09-09) | 35 core skills (25 active, 10 passive) + 7 KR/TW-only skills = 42, matches our 42 ids exactly | |
| aion2codex.wiki/classes/templar (verified 2026-09-28) | role only: main tank, sword and shield, fewer high-damage skills | no numbers |
| aion2.plaync.com/en-us/api/gameinfo/classes | class list only (Templar = id 3). Guessed per-class skill endpoints returned nothing. | |

## Confidence
- **High**: names, ids, unlock levels, ranks, cooldowns, MP costs, per-rank flat damage and heal (client dump); chain order Vicious Strike > Decisive Strike > Desperate Strike and Pummel > Punishing Strike (client Chain panel); Daevanion node layout, costs and effects (aion2t, board totals match Metaroad except where noted below).
- **skill_id vs official armory ids**: the only armory sample on disk is a Sorcerer, whose ids equal aion2.app ids (Flame Arrow 15210000). No Templar armory sample exists, so equality for 12xxxxxx is by analogy, not directly verified. Re-check on the first Templar import.
- **Medium**: ATK ratios (rank 1 only; ranks 2-40 unknown, the app applies the rank-1 ratio everywhere, as for Sorcerer); status durations (read from tokens/descriptions); chain wiring beyond the three confirmed chains.
- **Low / estimated**: every `dmg_mult` of a status (damage bucket is a community fit, same caveat as Sorcerer), charge-level middle step, chain window (3 s assumed), the proc model for Punishing Benediction, `manual` and `role:*` tags (my classification of reactive or situational skills, not a client value).
- Rank-scaled buffs (Insulting Roar, Fury, Battlefield Banner, Second Skin, Armor of Balance) use RANK 20 (Global cap); rank 1 and rank 40 values are in each source string.

## Source conflicts found
- **Flat damage differs between aion2.app and Metaroad for 4 skills** (rest are identical): Punishment 1268-3805 vs 1394-4184, Shield Smite 145 vs 173, Annihilate 719 vs 791, Warding Strike 353 vs 388 (about +10%, Shield Smite +19%). `per_level` keeps the dump; `coefficients.flat_rank1` keeps Metaroad; both are written in `coefficients.note`. Which source is newer is not known.
- **Noble Armor**: dump cooldown 300 s and duration 300 s at every rank, Metaroad and its description say 120 s. Dump used; conflict stored in `effects`.
- **Spec text** differs in places (dump shows numbers such as "Absorbs 10% HP", Metaroad hides them as an em dash; Pummel rank 16: dump "Activates [Punishing Strike] 1 extra time", Metaroad "grants extra damage on hit"). skills.json uses the dump text and levels.
- **Region**: aion2hub lists Decisive Strike, Desperate Strike, Punishing Strike, Capture, Executing Blade, Blade Storm, Threatening Blow as KR/TW-only, but the Global S1 guide (couga54, Oct 3) builds around Executing Blade, Punishing Strike and Threatening Blow. Treat all 42 as probably present at Global; the app's `KR_ONLY_IDS` (hard-coded in build_gamedata.py, not touched here) has no Templar entries.
- **Daevanion totals**: Metaroad's Zikel "MP 550" vs aion2t's node data giving MP 500 plus one node whose name is "Max MP" but whose text reads "Penetration +10" (the identical quirk exists in the Sorcerer file); Metaroad's Azphel PvP Defense 480 / Crit Resist 80 / Evasion 48 vs 720 / 120 / 72 from node data (Metaroad leaves out the second effect of the 8 hybrid nodes). Node data kept as is.
- **Board count**: 5 boards (display order 1,2,3,4,6; no order 5), same as Sorcerer; the Global guide also says "no Ariel board on global". Azphel uses a separate BattleCrystal pool (aion2t board_type 3).

## Modelled mechanics (mechanics.json)
- **MP loop**: Vicious Strike chain restores 100/100/120 MP (Threatening Blow 150), Pummel and Punishing Strike spend 120 each, so the chains alternate.
- **Chains**: Vicious > Decisive > Desperate (confirmed), Pummel > Punishing Strike (confirmed), Threatening Blow (Vicious Strike spec rank 16) and Capture (Defiance spec rank 8) as spec-added chain skills (estimated).
- **Judgment window**: Doom Shield (3 s), Shield Smite, Shield Rush, Warding Strike (2 s) open Judgment; modelled as status `judgment_ready` 2 s, Judgment requires it.
- **CC gate**: Stun/Knockdown skills apply `incapacitated` (3 s); Annihilate requires it. Description says 100% on NPC targets; bosses may be immune (Annihilate text: 5% trigger on Incapacitated-Immune targets, spec rank 8 gives +100% damage to them). apply_chance is 1.0 and the immunity is not modelled.
- **Charge**: Punishment, 3 levels, damage x1.0 / 2.0 / 3.0 (endpoints confirmed by ratio and flat; middle estimated), charge times unknown. Executor (+20% PvE Damage Boost, 20 s) applied on cast.
- **Procs / passives**: Punishing Benediction (50% for 38% ATK + flat, 1 s ICD) as a one-tick proc status via trigger on every cast (ICD and flat part not modelled); Insulting Roar +Attack% for 5 s (trigger on every cast); Fury party PvE Damage Boost 20 s, applied by Shield of Protection on the assumption that the tank is being hit.
- **Defence / heal / CC**: windows for Warding, Second Skin, Armor of Balance, Noble Armor, Comrade in Arms, Nezekan's Shield, Shield of Protection, Tenacity, Shrink, Guarding Seal, Block Pain; Warding Strike and Warding Shield carry client heal values (`tokens["client:heal_min/max"]`, effects text). Tags: `role:defense|cc|mobility|sustain|heal|support|aggro|burst`.
- **Not modelled on purpose**: Block events, Enmity, the stagger gauge (Flash Rampage requires an unapplied `staggered` status so the sim never spams it; it has 0 cooldown and 0 MP in the client), skill specializations and cooldown-reduction links (Vicious Strike spec reduces Warding Strike, Pummel chain reduces Punishment).

## Gaps
1. **Multi-hit skills** (Pummel 3, Flash Rampage 4, Empyrean Lord's 3, Threatening Blow 2): Metaroad says the flat is "per hit", but the app engine multiplies only by targets, so these are undercounted. `coefficients.hits` is filled here (null for Sorcerer).
2. **Unknown values** (null, confidence unknown): charge time per level, Dodge window for Shield Rush, Shield of Protection duration, Staggered duration and gauge size, Battlefield Banner Defense-to-Attack ratio, Executing Blade and Debilitate effect on damage, DoT tick values for Punishment's spec rank 8 and Warding Strike's heal-over-time spec (no numbers anywhere).
3. **Hidden sub-ids**: only multiples of 10000 plus 12000100 were probed. The Sorcerer set has sub-ids such as 15220037 and 15410057; none of that shape was found for Templar, but 12xx00yy ids were not scanned exhaustively.
4. **12000000** (page title "null", Bare Hands passive, level 1, max 1, no icon on aion2.app or the official CDN) is excluded: the app's key assignment needs an icon per id. It models nothing.
5. **ATK ratio per rank** is unknown (only rank 1); Metaroad lists 26 variants for most skills but exposes one.
6. **Reset cost and point sources** for Daevanion are copied from the Sorcerer file (Korea patch note, secondhand). Crystal pools (570 of 840 Daevanion, 232 of 232 Battle) come from Metaroad only.
7. The Global patch state is moving (gegebase lists changes on Aug 26, Sep 2 and Sep 4; Executor went 10 s to 20 s, Warding Strike cooldown 25 s to 30 s). The dump may predate some of them.
