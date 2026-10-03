# Aion 2 in-game macros, chains, automation, NCSoft policy (researched 2026-10-03)

Legend: [V] = stated by 2+ sources or primary-ish; [S] = single source; [U] = unverified / conflicting. Most English guides are TW-client based (Taiwan live since ~Sep 2026); Global early access 2026-09-30, full launch 2026-10-05.

## 1. Built-in macro editor: YES [V]
- Open Skill window (K) -> "Macro" tab/button top right. Key binding is separate: Settings > Key Settings > General > Gameplay > Macro, unassigned by default. (allthings.how, updated 2026-10-03: https://allthings.how/aion-2-how-to-use-macros-and-pick-the-right-delay/ ; gamerstogether 2026-09-08 TW testing: https://gamerstogether.cz/en/aion-2-macros/ ; ours: game_ui_and_progression.md)
- Press-and-HOLD the macro key; it loops, skipping anything on cooldown / no mana / unmet precondition and moving to the next usable entry [V].
- Macro editor holds numbered entries, each with its own delay field in ms; up to 20 entries per macro [V: allthings.how, search snippet of game8/u4n]. Hotbar: 3 presets [S, allthings.how 2026-09-28].
- Delay: 10 ms is the recommended minimum/standard; recent patch lowered the default from 50 ms to 10 ms [S allthings.how]. gamerstogether says delay is unrelated to ping; a Sorcerer guide (vortexgaming/sportskeeda echoes, see sorcerer_builds_and_dps.md) says 40-50 ms at 80-100+ ping [conflict, U].
- No conditionals/if-then. Only implicit "skip if unusable" [V]. Typed syntax "/Skill Name /Delay 1.5" appears in one search snippet (game8 page, fetch returned empty) [U, likely wrong or older; other sources say click/drag UI].

## 2. Slot/line stacking (the actual power) [V]
- Macro entries reference a hotbar SLOT (line), not a single skill. Each hotbar slot can stack up to 4 skills ("4-row stack", row 0 fires first); pressing it uses the highest-priority available skill in the stack. Priority 0 = representative skill. Source: Inven guide 2026-05-28 https://www.inven.co.kr/board/aion2/6444/1899 ; skycoach 2026-10-02 https://skycoach.gg/blog/aion-2/articles/macros-guide ; mein-mmo 2026-09-30 https://mein-mmo.de/en/aion-2-macro-this-trick-instantly-increases-your-damage-while-you-only-hold-down-2-keys,1590032/ ; repo https://github.com/265ada/aion2-macros (format `[["A","B","C",null]]`, late/full/early sets per class).
- So one key press (held) can fire many skills: 4 skills per slot x up to 20 macro entries; or macro of Q>W>E>R slots loops QWERQWER (Korean search summary, dcinside/inven).
- Trap (mein-mmo): do not put a skill with no cooldown in a lower row, it will always win and starve rows above. Order by priority, put filler/basic last.
- Hold LMB (basic attack) + macro key together: macro priorities run and basic attacks get woven between (mein-mmo) [S]. Basic attack cancels animations; a black silhouette shows a successful cancel (skycoach) [S].
- Key-setting caveat (KR, search summary of Inven/dc posts): turn OFF "quickslot long-press input" and "aim target hold" in Settings > Combat for the hold-macro to behave [S, unverified exact option names].
- Recommended exclusions: mobility, defensives, big bursts (Hellfire full charge) stay manual (skycoach, ours).

## 3. Built-in chain / follow-up skills [V concept, U per-skill wiring]
- Chain skill = follow-up that appears briefly after a base skill; trigger in time (gamerstogether, thegameswiki "Combat and Skill Chains" https://thegameswiki.com/aion-2/wiki/combat-and-skill-chains, fetch 429 so only snippet).
- Sorcerer (ours, sorcerer_skills_notes.md): Flame Arrow -> Burst -> Pyroclasm (client chain 1/3,2/3,3/3, verified); Ice Chain -> Cold Wave, Winter's Shackles -> Winter's Illusion, Lumiel's Space -> The Depths, Curse: Tree -> Curse: Old Tree are inferred [U]. Chain skills have no unlock level in DB.
- KR community: basic cycle Frost Arrow, Frost Arrow, Burst ("normal attack x2 then burst"); Flame Explosion guaranteed every 3 basics (old, may predate reworks).
- Unverified: whether a held macro key auto-picks the chain follow-up (it should only if the follow-up replaces the base skill's icon in the same slot; not confirmed). TEST IN GAME.

## 4. Queueing / animation cancel
- Animation cancel via basic attack is a core mechanic [V]; macros "cancel animation and chain" (gamerstogether combat page https://gamerstogether.cz/en/aion-2-combat-system/) [S].
- KR patch (2026-01-27, Inven news) added an "attack cancel" convenience feature https://www.inven.co.kr/webzine/news/?news=313182 [V date, details unverified].
- No true input buffer/queue documented; the macro loop with 10 ms delay is the de facto queue [U].

## 5. Auto-target / auto-combat
- No auto-battle; combat is manual (gamerstogether). "Auto Target Upon Skill Use" setting exists, useful for farming [S]. Action+tab-target hybrid. (Korean search found nothing contradicting.)

## 6. NCSoft stance (KR; Global official statement NOT found)
- In-game macro = legal feature [V English guides]. Hardware/software macros violate EULA [V].
- KR 2025-12-01 live stream: mouse macros = workshop (bot) activity, possible permanent ban; holding a button down is allowed, repeated clicking is not (vgamelifev summary https://vgamelifev.com/%EC%95%84%EC%9D%B4%EC%98%A82-%EB%A7%A4%ED%81%AC%EB%A1%9C-%EB%A7%88%EC%9A%B0%EC%8A%A4-%EB%B9%84%EC%9D%B8%EA%B0%80-%ED%94%84%EB%A1%9C%EA%B7%B8%EB%9E%A8-%EC%A0%9C%EC%9E%AC-%EC%A0%95%EC%B1%85/) [S, secondary].
- 2025-12-09 notice: client detects/blocks Logitech G HUB, Razer Synapse, Corsair iCUE running (login blocked) https://bbs.ruliweb.com/pc/board/300007/read/2338393 ; reversed within ~3 h on 2025-12-10, "temporarily suspended", to be reinforced (https://www.ilovepcbang.com/news/articleView.html?idxno=123601) [V]. Later English claims that the client again kicks players running G HUB, "7-10k accounts/hour" (aion2.online dev-stream recap https://aion2.online/news/aion-2-dev-stream-recap-ncsoft-escalates-war-on-macros-reshapes-economy-and-updates-class-balance/) [S, unverified, date unclear].
- Penalties reported: from Dec 3 hardware-macro accounts get 30-day suspension + full gain confiscation (same recap) vs permanent ban claims elsewhere [CONFLICT, U]. Waves: 11 waves/8,000+ accounts by 2025-12-02 (vgamelifev); 18 waves/~58,000 (aion2.online) [S each].
- 2026-01-27: VPN blocks, hardware bans, report system, gather level 45 https://www.inven.co.kr/webzine/news/?news=313182 ; criminal complaints vs 7 users (kukinews https://www.kukinews.com/article/view/kuk202601280165).
- 2026-02-23 playforum: Logitech-based sanctions spreading, NC calls macros "obstruction of business" https://www.playforum.net/news/articleView.html?idxno=633908.

## 7. Korea vs Global
- Global S1: 4 stigma slots, stigma cap lv20; KR/TW: 6 stigma slots, lv25 (repo README; gamerstogether). ~12 Sorcerer skills only verified on KR/TW may be absent at Global launch (ours).
- Macro editor same on TW; Global-specific macro rules/policy not found [U]. Assume KR rules apply.

## 8. Implications for G915 G1-G5 (our inference, not sourced)
- G-keys with onboard memory/G HUB macros that send repeated or multi-key sequences = the risky "hardware macro". Safest: bind G1-G5 as plain single key remaps (e.g. to hotbar keys or to the in-game Macro key) in onboard mode with no G HUB running; one G key = hold-to-run in-game macro. Plain remap sends one keypress per press, no automation. G HUB process may be detected/blocked (see section 6), so use onboard memory and close G HUB.
- Best design: put all repeat logic inside the in-game macro (legal), tool only helps build stacks.

## Unverified / open
- Exact max macros count, whether delay has 1 ms granularity below 10, chain auto-follow in held macro, Global official policy, real penalty tier, game8 syntax snippet.
