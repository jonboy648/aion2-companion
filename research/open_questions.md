# Aion 2 open mechanics questions (researched 2026-10-03)

Scraped text treated as data. Raw files in D:\Aion2\.firecrawl\oq\. Firecrawl credits: about 39 (6 searches x2 = 12, 27 scrapes x1; 3 scrapes failed and may not have been charged).

## Q1. Slot stack order: top or bottom fires first?

**Answer: BOTTOM of the stack in the UI is highest priority and fires first (when ready); skills above fill the gaps. Priority 0 = the bottom slot = the "representative" skill whose name the macro window shows. Confidence: HIGH (5 independent sources, KR + Global, plus an indirect KR confirmation).**

Quotes:
- [Global, 2026-10-02] Sportskeeda https://www.sportskeeda.com/mmo/aion-2-skill-macro-how-setup-guide : "the Skills will cycle through whatever is in the column **from bottom to top**." / "**Skills at the bottom will always be given priority while pressing the button.**"
- [Global, ~2026-09-30] mein-mmo (EN edition) https://mein-mmo.de/en/aion-2-macro-this-trick-instantly-increases-your-damage-while-you-only-hold-down-2-keys,1590032/ : "You stack these like a tower ... The ability at the bottom has the highest priority, followed by the skill above it, and so on." / "The skill with the highest priority goes at the very bottom."
- [Global, undated] Game8 https://game8.co/games/Aion-2/archives/627937 : "Align the skills vertically on your skill menu. The lowest skills take priority."
- [Global, updated 2026-09-28] aion2maps https://aion2maps.com/guides/auto-attack-cancel-and-macros/ : "Which skill on a hotkey fires: The bottom one, whenever it's ready; the ones above fill the gaps (Asian release)"; "main skill at the bottom"; macro step "shows the bottom one's name."
- [Global, 2026-10-03] couga54 guides (Gladiator/Sorcerer) https://couga54.github.io/aion2-guides/en/gladiator/ : "in AION 2 the **bottom slot has the highest priority**." Cards are listed "In-game order, top to bottom. 1 = highest priority - the bottom slot." Gladiator main line top-to-bottom is Rending Blow (3), Overhead Slam (2), Rage Burst (1, bottom).
- [KR, 2026-05-28] Inven https://www.inven.co.kr/board/aion2/6444/1899 : the macro window lists the line's skill that has "우선 순위가 0으로 설정 해놨기 때문에 해당 슬롯 라인의 대표 스킬 격으로 표기" and the macro uses "슬롯의 라인에 있는 모든 스킬을 우선 순위대로 사용". So priority 0 is the representative; aion2maps says the representative shown is the bottom skill.
- [KR, 2025-11-22] Gamechosun https://www.gamechosun.co.kr/webzine/article/view.php?no=218453 : "스킬창을 살펴보면 숫자 0부터 3까지가 표시돼 있는데, 숫자가 낮을수록 우선순위가 높아 퀵슬롯에 표시된다." (the skill window shows numbers 0 to 3; lower number = higher priority and is the one shown on the quickslot.)
- [KR, 2026-05-26] NC board https://aion2.plaync.com/ko-kr/board/free/view?articleId=6a15d68fe728c75cb9d69df4 (indirect): "4번 파열,올가미 속사순으로 (속사가 제일 맨위)" - listed in priority order, last-listed (lowest priority) sits at the very top. Consistent with bottom = highest. (Its "1->2->3->4" is the stigma slot columns in the macro, not the stack.)

Reorder / labels:
- Reorder: not by drag. Sportskeeda (Global, 2026-10-02): "You _cannot_ drag-and-drop it"; to add, click the skill in the right panel then click the grid cell; "click on any other spot on the column to make the two Skills swap places (which, again, means switching the priority order)." A skill can only sit in one cell.
- Numbers: KR Gamechosun (Nov 2025) says the UI shows 0-3 per skill; Inven 1899 refers to "priority set to 0". No Global source found that confirms the number labels still show. couga's 1-4 numbering is the guide's own rendering. UNVERIFIED for the current Global UI.

Conflicts / hazards:
- No source says top = highest. No real conflict on direction.
- **Notation hazard in OUR files** (community_builds/*.md): Gladiator writes lines in priority order, highest first ("[Rage Burst > Overhead Slam > Rending Blow]", = bottom to top). Sorcerer/Assassin/Templar/Ranger lines are written in on-screen top-to-bottom order with "(top)" tagging the LAST item (e.g. "[Frost Burst > Delayed Explosion > Bittercold Wind > Element Enhancement(top)]"). In couga, Element Enhancement is priority 1 = the BOTTOM slot, so "(top)" there means "top priority", not top of screen. Same file set, two orders. Pick one convention before the companion renders these (recommend: store as a list index 0 = bottom = priority 0, and render the UI top-to-bottom reversed).
- Trap (mein-mmo, Sportskeeda): a no-cooldown skill at the bottom blocks everything above it.

## Q2. Animation cancel / weaving

**Answer: A basic attack (LMB) has a pre-delay then a ~250-300 ms recovery (post-delay); any skill input during the recovery cancels it (the "afterimage/shadow" = success). Inputs during the pre-delay window are dropped. Best method is hold LMB + hold macro key, so the skill queue always outranks the basic attack and the basic attack fills the gap. Confidence: MEDIUM-HIGH on mechanism (one detailed experimental KR post, corroborated by many), LOW on per-skill numbers (nobody found per-skill windows).**

Quotes:
- [KR, 2026-04-13] Inven 평캔 post (cleric board) https://www.inven.co.kr/board/aion2/6452/16388 : "평타는 '후딜레이' 중 스킬 입력이 들어오면 후딜레이를 무시하고 스킬을 사용합니다"; healer basic attack "선딜레이 30~70ms(서버 핑, 프레임 경계, 연계기 종류에 따라 다릅니다)+후딜레이 약 250~300ms"; "선딜레이 구간에 들어가는 스킬 입력은 무시됩니다 ('평캔을 너무 빨리 하면 씹힘')"; "정확한 타이밍에 스킬을 한번 입력해서 평캔을 실행하겠다는 방식은 사실상 불가능합니다"; "평타를 먼저 눌러야 한다 ... 평타 먼저 누르고 스킬을 누른다 -> 스킬이 우선으로 사용됨. 스킬이 쿨이면 평타가 나감"; "평타는 평타를 캔슬할 수 없다". Author flags it as guesswork ("모든 내용은 제 추측").
- [Global, updated 2026-09-28] aion2maps (see Q1 URL): "hold left click and the macro key together. Basic attacks weave between your skills, and each successful cancel shows as a black silhouette"; "As a macro step [basic attack] fires only once per cycle; held, it cancels after every skill"; "Your own presses always take priority over the macro."
- [Global] mein-mmo: you "can actually use both your basic attack and your macro simultaneously by simply holding both keys down."
- [KR, 2026-01-28] novahistory blog (Ranger, patch day) https://blog.naver.com/novahistory/224162936327 : at 74.6% combat speed a 55 ms macro delay between Rapid Shot and Snipe let Snipe chain into Gale Arrow; "내부매크로 지연시간은 50ms미만으로는 설정이 안됩니다" (at that time; later 10 ms minimum).
- Per-skill windows: none found measured. Only data points: healer basic-attack 30-70 ms pre / 250-300 ms recovery (above). KR patch 2026-09-16 (aion2hub, Korean Service) https://aion2hub.com/updates/aion-2-update-2026-09-16 : "Skill cancel delay increased" for Templar Pummel / Punishing Strike / Judgment and Assassin Savage Roar / Savage Smash / Heart Gore, explicitly "to discourage the use of mouse macros for the Pummel - Judgment cancel" (paid back with +10-20% PvE damage). So cancel timings are patch-tuned per skill and KR already changed them; Global status of this change NOT verified. ezg.com notes the same for Assassin ("current version has adjusted Skill Cancel Timing").
- Combat speed / ping rule: only one source. couga Elementalist/Spiritmaster guide https://couga54.github.io/aion2-guides/en/elementalist/ (Sep-Oct 2026, Global): "The weave depends on ping: the author wants 65% Combat Speed or more and under ~60 ms ping." Single guide, class-specific (Spiritmaster), unmeasured claim.
- Delay vs ping: [Global, Sep-Oct 2026] couga Sorcerer https://couga54.github.io/aion2-guides/en/sorcerer/ : "Delay: 10 ms with a ping under 50; 40-50 ms with a ping of 80-100 and more." Check: "Afterimages ("shadows") behind it mean animations are being cancelled and the delay is fine." aion2maps: delay 10 ms minimum, 9,900 max; "some players do best at 15-20"; "Some players on slower PCs do better with a little more." KR Inven 16388: the macro is just a tap-input variant, and the pre-delay jitter (30-70 ms, frame/ping dependent) means a fixed delay lands in or out of the pre-delay window randomly; holding LMB plus spamming the skill sidesteps that.
- Skill queue ("스킬예약"): aion2maps (datamine): leave on (default); Inven 13754 [KR 2026-05-27]: "스킬예약은 전 직업 모두 키는게 좋더라구용 ... 표본이 부족"; Inven 16388 says on/off both allow cancelling the basic-attack recovery, differing in what happens to skills swallowed during another skill's recovery.

Conflicts:
- Delay guidance: 10 ms (aion2maps, Inven) vs 40-55 ms (couga at high ping, novahistory's older 55 ms for Ranger at 74.6% speed). Not a real conflict if ping/class explains it, but no one measured the interaction.
- Arca comment: "좌꾹에 우클 타이밍 < 이거 공속올라가면 안됨 궁성만그런가?" (hand timing breaks as combat speed rises; macro avoids this). Anecdotal.

Needs in-game check: effective macro delay vs ping on your own rig (dummy test, watch shadows); whether the 65% / 60 ms rule holds for your class.

## Q3a. Does a held in-game macro auto-fire chain follow-ups?

**Answer: NOT confirmed by any source. Best inference: chain follow-ups ride the base skill's own press (Flame Arrow's 3-hit chain is "the third consecutive attack of Flame Arrow"), so pressing/holding the base skill's slot likely advances the chain, but no source states it for Burst/Pyroclasm or Upward Strike. Confidence: LOW.**

Evidence:
- [Global, 2026-10-02] Sportskeeda Sorcerer https://www.sportskeeda.com/mmo/aion-2-sorcerer-build-macro-rotation-guide-skill-chains-stats : "Resets Blaze cooldown on landing Pyroclasm (third consecutive attack of Flame Arrow)."
- [Global, 2026-09-28] aion2maps Sorcerer https://aion2maps.com/guides/sorcerer/ : "on activating [Pyroclasm], a follow-up in Flame Arrow's chain (Datamine)".
- [Global, 2026-10-03] couga Sorcerer macro: steps "Flame Arrow (R)" appear twice, Pyroclasm/Burst are NOT separate macro steps, and the stated reason is MP refill ("they refill mana between the expensive skills"). Consistent with, but does not prove, chain auto-advance. couga Gladiator lists "Adds [Upward Strike] Chain Skill" as a spec on Overhead Slam (lv 8) and the Gladiator damage parse counts "Overhead Slam (incl. Upward Strike)".
- KR Gladiator macros (Inven 6448/18725, 2026-05-27) put 내려찍기 in a bundled slot (T) and the in-game macro runs only "검난 -> 절맹"; no statement about chains.
- KR Sorcerer (Inven 6453/66, 2025-11-22) treats the Flame Arrow chain as ordinary button presses, "좌클릭&우클릭 평캔".
- One web summary claimed "macros don't automatically trigger chain follow-ups"; the cited pages do not say that. Discarded as unsupported.
- mein-mmo, Sportskeeda, aion2maps all say the macro "keeps trying each hotkey on its list", and a held single key re-fires when ready, which is the mechanism by which a chain would advance if the follow-up occupies the same slot.

Needs in-game check (player): put only Flame Arrow's slot (and separately Overhead Slam's slot) in a macro, hold it, and watch whether Burst/Pyroclasm and Upward Strike fire; also whether the follow-up replaces the base icon in the same slot or needs its own cell. This is the one thing the companion should not assert.

## Q3b. Do Burst and Pyroclasm exist on Global?

**Answer: YES. Pyroclasm is named and described in Global-dated English sources (Sept-Oct 2026). "Burst" exists as a Sorcerer chain skill in the Global armory data (shugo.gg lists both, no unlock level, i.e. chain skills). Confidence: HIGH for Pyroclasm, MEDIUM-HIGH for the middle skill being called plain "Burst".**

Quotes:
- [Global, 2026-10-02] shugo.gg https://shugo.gg/skills/sorcerer ("Data as of 2026-10-02", NC CDN icons): rows "Burst - Active - max Lv 40 - Instant - 20m" (id 15030000) and "Pyroclasm - Active - max Lv 40 - Instant - 20m" (id 15250000), both with "-" for unlock level, listed beside other chain skills Cold Wave and Winter's Illusion.
- [Global, 2026-10-02] Sportskeeda (URL above): "Flame Arrow (level 16): +20% MP restored. Resets Blaze cooldown on landing Pyroclasm (third consecutive attack of Flame Arrow)." Same wording in couga ("Reset [Blaze] cooldown on landing [Pyroclasm]", "Inflicts Fire Mark for 5s on landing [Pyroclasm]") and aion2maps.
- Sportskeeda also says Sorcerers "can cancel the animations of some skills, such as Frost and Burst".
Conflicts: none. Note KR names differ (불꽃폭발 is a separate stigma-like skill in KR guides, "Flame Explosion"), so do not map KR 불꽃폭발 to Global "Burst". The mid-chain skill's exact tooltip text ("Burst" damage, 2/3) was not read on a Global page; the "Flame Arrow -> Burst -> Pyroclasm" order comes from our own client-chain notes.

## Summary table

| Q | Answer | Confidence |
|---|---|---|
| 1 | Bottom fires first (priority 0 = bottom = representative); reorder by click-swap, not drag; number labels 0-3 seen in KR, unverified in Global | High (direction), Low (labels) |
| 2 | Hold LMB + macro key; skill input in basic-attack recovery cancels it, pre-delay (30-70 ms) inputs dropped; no per-skill windows published; 65% CS / <60 ms ping is one guide's claim; KR 9/16 patch lengthened some cancel delays | Medium-High mechanism, Low numbers |
| 3a | Unconfirmed that macro auto-fires chain follow-ups | Low |
| 3b | Burst and Pyroclasm both exist on Global | High / Med-High |
