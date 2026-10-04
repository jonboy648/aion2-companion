# Pre-push review (2026-10-03)

This list was built from verified review findings. Each one was re-checked against the code by a second pass, and severities are the verified ones, not the first guess. Items that are clearly half-finished edits in the in-progress files are left out: the simulator, search, build_optimizer, damage, models and specialties code, gear UI, and the gear parts of webapi, api, types and the worker. Known failing web tests (types.test.ts compare/gamedata, build.test.tsx tally) come from that work and are also left out.

Ground truth used: the bottom hotbar cell fires first (priority 0). Multi-hit damage is per hit. Burst and Pyroclasm exist on Global. Icons are hotlinked from assets.playnccdn.com. The app never sends input to the game.

Severity scale: **H** wrong numbers or a broken deploy for most users · **M** wrong advice or a broken flow for some users · **L** cosmetic, edge case, or owner-only.

---

## 1. Engine game data (wrong DPS for Global players)

### 1.1 [H] Gladiator KR-only list removes Global chain follow-ups, including the Keen Strike filler chain
- **Where:** `research/classes/gladiator/mechanics.json:2-22` (`korea_only_ids`), applied at `app/aion2c/data/build_gamedata.py:250`.
- **Problem:** The list was copied from aion2hub's "KR/TW-only" list, the same list that wrongly flagged Burst and Pyroclasm. It includes 13 chain or proc children whose parents exist on Global, plus the weapon-equip skill. With region=global, `loader.allowed_skills` drops them, and so do the simulator, budget, optimizer, search, rotation and layout. A Global Gladiator casts only Keen Strike step 1 (43% ATK) and never steps 2 and 3 (49% and 62%), Smashing Blow or Frenzied Wave. DPS and rank value come out too low. Ranger already keeps its chain children Global for exactly this reason.
- **Fix:** Remove 11000000, 11030000, 11040000, 11060000, 11090000, 11180000, 11210000, 11300037, 11320000, 11370000, 11420000, 11440000, 11460000 and 11470000 from `korea_only_ids`. Keep only 11140000, 11230000, 11310000, 11330000 and 11350000. Rebuild gamedata and the web engine JSON. Spec-granted children then need `requires_spec` (see 1.2).

### 1.2 [H] Spec-granted chain skills always fire because `requires_spec` is never filled in
- **Where:** `app/aion2c/data/build_gamedata.py` (finalize step). The field is `models.SkillRule.requires_spec` (models.py:210), and `simulator._spec_gate_ok` (simulator.py:180-183) enforces it. No class gamedata.json sets it.
- **Problem:** Ranger spiral-arrow->tempest-arrow (needs Snipe spec 16), snare-shot->shackling-arrow, ensnaring-trap->guerilla-strike, defiance->lightning-arrow. Spiritmaster combustion->ashy-call, defiance->curse-of-despair. All of these fire at rank 1 with no specialty chosen. Low-rank DPS is overstated, and the specialty chooser never sees any value in the "Adds [X] Chain Skill" option. Twelve more links in Assassin, Chanter, Cleric, Sorcerer and Templar would be ungated as soon as they get `chain_next`.
- **Fix:** In finalize, scan each specialization for `r"Adds \[(.+?)\] Chain Skill"`, resolve the name to a skill key, and set `rules[child].requires_spec = (owner_key, option_index)`. Check that serde and the loader round-trip the field. Add a test that tempest-arrow gets 0 casts at Snipe rank 1 with no spec, and some casts with `specs={'snipe': (4,)}`. *(Coordinate with the specialties agent: data only, no simulator edit.)*

### 1.3 [M] Sorcerer KR_ONLY_IDS still drops Cold Wave, Winter's Illusion and Curse: Old Tree
- **Where:** `app/aion2c/data/build_gamedata.py:34-35`.
- **Problem:** These come from the same wrong aion2hub list. open_questions Q3b quotes shugo.gg Global listing Cold Wave and Winter's Illusion next to Burst and Pyroclasm. On Global, Ice Chain loses its follow-up, and the Ice Chain and Winter's Shackles specs point at a skill that is filtered out.
- **Fix:** Remove 15100000, 15330000 and 15340000. Gate Winter's Illusion (Winter's Shackles spec 12) and Curse: Old Tree (Defiance spec 8) through 1.2. Mark Curse: Old Tree `estimated`, since its Global evidence is the weakest, and update open_questions.

### 1.4 [M] Ranger Rapid Fire and Spiral Arrow carry copies of Snipe's specialties, and the chooser can equip them for free
- **Where:** `app/aion2c/data/classes/ranger/gamedata.json` (rapid-fire 14030000, spiral-arrow 14040000), produced by `build_gamedata.py`.
- **Problem:** They have `rank_required=null`, so `specs.available_options` treats them as always available, and `_castable_keys` walks `chain_next` to reach them. The chooser can equip roughly -4 s of Deadshot cooldown per cycle plus a 20% MP restore with no Snipe slot open. The Sorcerer, Cleric and Templar copies were already turned into no_dps. Ranger's were not.
- **Fix:** In build_gamedata, drop the specializations on CHAIN/PROC children whose text duplicates the root's, the same way the other classes were handled. If the "applies per chain hit" reading is wanted, model it on Snipe's own option.

### 1.5 [M] Stigmas lose specialties they have unlocked because of the core-skill slot cap
- **Where:** `app/aion2c/specs.py:29` (`active_options`), and the same rule in `app/aion2c/engine/specialties.py:84`.
- **Problem:** aion2.app says "A stigma keeps every specialty it has unlocked" (unlocks at 5/10/15/20). The engine applies slot ranks 8/12/20, so a rank-10 stigma gets 1 of 2 options and a rank-20 stigma gets 3 of 4. Stigma damage and cooldowns come out too low, and users see "only N slot(s) open" warnings.
- **Fix:** For `SkillKind.STIGMA`, set `room = len(avail)` in `active_options` and skip the chooser search in `choose_specs`. Add a test with a rank-20 stigma and 4 options. *(specialties.py is in progress: hand this to that agent as a contract change.)*

### 1.6 [M] Bittercold Wind, the Sorcerer's top damage skill, is tagged `manual`, so no macro can press it
- **Where:** `app/aion2c/data/src/mechanics.json:26-29`.
- **Problem:** It deals about 36% of boss damage in a default sim. `manual` gives it its own slot, and `macro_slots()` skips that slot (macro.py:37). That forces every Sorcerer into the hybrid setup. The sheet's only explanation is "tagged manual in the game data". It contradicts layout.py's rule, which reserves manual for charge, CC-break, defensive and dodge skills, and it contradicts community macros that include it.
- **Fix:** Remove `manual` and keep `gkey:G5:M2:0`. Optional: in `export.plan`, warn when a manual-tagged skill deals more than about 20% of ideal damage.

### 1.7 [L] Curse: Old Tree is linked as an upgrade of the Curse: Tree stigma, but it is Defiance's chain
- **Where:** `app/aion2c/data/src/chains.json:39-45`.
- **Problem:** Wrong parent and wrong kind, and it inherits unlock level 22 when it should be 16.
- **Fix:** Use `{parent: 15240000, child: 15340000, kind: "chain", confidence: "confirmed", note: "Defiance spec 8 option 0"}` together with 1.2 gating.

### 1.8 [L] Korea road map has invented unlock levels and is missing KR stigma slots 5 and 6
- **Where:** `app/aion2c/data/src/roadmap.json:317-341`, copied into `research/classes/*/roadmap.json`. Also `web/src/features/guide/personal.ts:95-101`.
- **Problem:** "Eltnen / Morheim" at 46 and "Chapter 1/2" at 47 have no source. "Story end" at 45 is tagged for both regions. Slots 5 and 6 are missing, so `build_optimizer.stigma_slots_at` gives a KR level-50 character min(4, 6) = 4 slots, and personal.ts says "All 4 stigma slots are full".
- **Fix:** Move the KR rows to 45 with the text "gated by hero quests and item level". Make "Story end" global only. Add a KR "Stigma slot 6" row at 50 and a slot 5 row marked unconfirmed level. In personal.ts, take the slot count from `gd.stigma_slots[region]`.

### 1.9 [L] Dodge listed as a Templar and Cleric skill unlock
- **Where:** `research/classes/templar/roadmap.json:14`, `research/classes/cleric/roadmap.json:23`.
- **Problem:** These hand-written rows get around roadmap.py's `_NOT_UNLOCKABLE` filter. ChapterCard then shows Dodge as a class skill for those two classes only.
- **Fix:** Remove "Dodge" from both rows and delete the Cleric row, which is then empty. Rebuild.

### 1.10 [L] Spiritmaster weapon-equip icon returns 404
- **Where:** `app/aion2c/data/classes/spiritmaster/icon_names.json:58` (`ICON_TE_TEMP_020_Effect_001`).
- **Problem:** The real icon never shows. IconFrame falls back to the placeholder, so no image appears broken.
- **Fix:** Map it to a valid weapon-equip icon name, or remove the entry so the placeholder is used on purpose.

---

## 2. Keybinds / macro planner (wrong instructions on the sheet)

### 2.1 [H] Sheet warnings describe a different layout from the one shipped
- **Where:** `app/aion2c/keybinds/export.py:87-101` (`_design`) and `:154-155`.
- **Problem:** `_design` tries all 5 styles and keeps the best stacks, but throws that layout's warnings away. Line 154 then re-runs `layout()` with style "roles" and appends *those* warnings. When any other style wins, the "slot X: assign A, B" lines list different slots or a different stack order. Order is priority, so a user who follows the warnings builds stacks that don't match what was simulated.
- **Fix:** Keep `(score, stacks, seqs, warn)` in `best`, return `warn` from `_design`, and delete the extra `layout()` call. Add a test that every "slot X: ... assign A, B" warning matches `plan.stacks[X]` exactly, in order.

### 2.2 [H] Boss and AoE priorities are simulated on the user's original build, not the builds they were optimised for
- **Where:** `web/src/features/keybinds/useKeybindPlan.ts:76-98`, `app/aion2c/webapi.py:165-176` (`keybinds`), `app/aion2c/keybinds/export.py:142-150` (`plan`).
- **Problem:** `optimize_full_build` replaces the stigmas, but the hook keeps only `.priority` and sends the original build. Skills from unequipped stigmas get trimmed ("not one of your equipped stigmas"), so "ideal" comes out too low. The sheet can then claim the hybrid reaches more than 100% of ideal, and its "beats the macro by X%" figure is wrong.
- **Fix:** Pass each scenario's optimised build into `plan()` (`builds={scenario: build}`), or re-optimise each priority with stigmas locked to the build the user will equip. In `_advice`, use `max(ideal, hybrid, macro)` as the baseline and warn when ideal is not the maximum.

### 2.3 [M] Planner assigns skills to the game's default movement and menu keys
- **Where:** `app/aion2c/keybinds/layout.py:217-225` (`free_pool` / `pick_label`) and `app/aion2c/keybinds/gkeys.py:77-78` (`spare`). Label order comes from `models.KEY_LABELS` (models.py:476).
- **Problem:** After 1-0, - and =, labels go A, B, C, D... A user whose bar already fills the number keys gets "slot A: assign X". A and D are move, C mount, F interact, and I/J/K/L/M/P open menus.
- **Fix:** Put a `RESERVED_KEYS` set in layout.py: W A S D C F R X V M I P K J L O /. Leave models.py alone, since it is in progress. Exclude the set from `free_pool` and `spare` unless the user's own bar already uses the key. Pick safe letters first (Q E T G Z B N). Add a test that the plan never auto-assigns a reserved key.

### 2.4 [M] Hotbar key cap draws stacks top-left-first, the opposite of the bottom-fires-first rule
- **Where:** `web/src/features/keybinds/Hotbar.tsx:51-57` (KeyCap).
- **Problem:** KeyCap uses a `grid-cols-2` with stack[0] at the top left and numbers 1-4. SlotEditor in the same file uses `flex-col-reverse` with numbers from 0. A player copying the key cap puts the priority-0 skill in the top cell.
- **Fix:** Render KeyCap as a single `flex-col-reverse` column (index 0 at the bottom) with 0-based numbers or a "fires first" marker. Add a test that the last icon in DOM order is stack[0].

### 2.5 [M] Macro hotkeys: F5-F8 and F12 are game defaults, two macros can share a key, and G1 can send a different key from the sheet
- **Where:** `web/src/features/keybinds/useKeybindPlan.ts:10` (`HOTKEY_CHOICES`), `:150` (`setHotkey`), `MacroPanel.tsx:97-106`, `app/aion2c/keybinds/gkeys.py:57-63` (`_hotkeys`), `macro.py:151`, `export.py:75`.
- **Problem:** F1-F8 are potion slots and F12 is Hide UI. Picking F10 for both macros gives an impossible setup. On desktop the free-text hotkey is never checked: "Ctrl+1" makes G1 silently fall back to F9 while section 3 still prints "Ctrl+1", and "1" collides with slot 1.
- **Fix:** Web: limit choices to F9, F10 and F11, and swap the two keys when the user picks a clash. Engine: normalize and validate once in `export.plan` (uppercase, must match SINGLE_KEY, must not equal any stack key or the other macro's key), fall back to F9/F10 with a warning, and use that one value in both the MacroPlan and the G1 row.

### 2.6 [M] With auto_chain off, follow-ups of chain roots that have a cooldown are never placed
- **Where:** `app/aion2c/keybinds/layout.py:162, 186-192` (`design_groups`).
- **Problem:** Children are added back only for 0-cooldown roots. Gladiator overhead-slam->upward-strike and Ranger snare-shot->shackling-arrow get no slot, so they are never cast in the macro sim and have no key on the bar. This breaks the module docstring at line 12.
- **Fix:** When `not auto_chain`, expand each cooldown root to `reversed(_chain_children) + [root]` before chunking, and never split a unit across stacks. Add a test that covers a root with a cooldown.

### 2.7 [L] "Filler ... must be the bottom row" note contradicts the sheet's own top-cell rule
*(reported by 3 reviewers; merged here)*
- **Where:** `app/aion2c/keybinds/layout.py:40` (`ROLE_NOTES['filler']`), and in the fixture at `web/src/fixtures/keybinds.json:246`.
- **Problem:** The note only appears on a one-cell slot, so no generated layout is wrong. But the sheet says "BOTTOM cell fires first, a no-cooldown skill goes in the TOP cell" (export.py:325-328), and so does the guide (basics.ts:153). A player hand-editing a stack would starve every skill above the filler.
- **Fix:** Change the note to "Filler. It has no cooldown and is always ready, so it goes on its own key or in the TOP cell of a stack, where it never blocks a cooldown." Reword "LAST row" at line 10. Regenerate the fixture. Add a test that no slot note pairs "bottom" with filler or no cooldown.

### 2.8 [L] A skill shows in "Core cooldowns" and also under "Left out" / "Not used"
- **Where:** `app/aion2c/engine/rotation.py:245-248`.
- **Problem:** The rarely-cast branch measures casts against the raw cooldown. For status-gated skills like Frost Burst, the real limit is how long the required status is up.
- **Fix:** Skip skills already in `core`, or base `possible` on `uptime[need] * dur / cd`. Show rarely-cast skills as a "low use" suffix on their core row.

### 2.9 [L] Setup-sheet tables never wrap
- **Where:** `web/src/features/keybinds/markdown.tsx:124` (`w-full min-w-max`).
- **Problem:** Why cells run up to about 300 characters, so the table becomes thousands of pixels wide and the Slot column scrolls out of view.
- **Fix:** Drop `min-w-max` (or use `min-w-[560px]`). Give long text cells `whitespace-normal max-w-[28rem]` and keep the key and risk columns `whitespace-nowrap`.

---

## 3. Web platform, CI and deploy (must fix before push)

### 3.1 [H] Untracked engine modules and items.json: a partial commit breaks CI or quietly ships without gear
- **Where:** `web/scripts/bundle_engine.py:22-31` (MODULES), `:98-103` (`items_src.is_file()`).
- **Problem:** `aion2c/gear.py`, `specs.py`, `specparse.py`, `engine/rotation.py`, `engine/specialties.py`, `data/items.json`, `build_items.py`, `test_gear.py` and `test_webapi_gear.py` are all untracked (`??`). If only the tracked files are committed, the bundle step fails. If the modules are committed without items.json, manifest gets `items:false`, CI stays green, and every gear call returns 404 on the live site.
- **Fix:** When aion2c.gear is in MODULES and items.json is missing, `main()` must return non-zero. Commit the modules, items.json (or run build_items.py in CI) and their tests together.

### 3.2 [H/M] Cached compare and optimize results survive engine code changes
- **Where:** `web/src/engine/cache.ts:32-34`, `web/src/engine/pyodide-client.ts:57-59, 104-117`, `web/scripts/bundle_engine.py:105-112`.
- **Problem:** The key uses only `data_version`, which comes from the gamedata build date. HEAD and the working tree have the same data_version even though the engine changed. Returning visitors silently get the old numbers ("Loaded saved result"). That would include results from before the per-hit multi-hit fix.
- **Fix:** In bundle_engine.py, write `engine_hash` = sha256(aion2c.zip + class JSON + items.json) into manifest.json. `dataVersion()` returns `${data_version}|${engine_hash}`. Add a vitest check that a different hash gives a different key.

### 3.3 [M] CI runs one test file; the Qt-free and no-automation guards never run
- **Where:** `.github/workflows/pages.yml:39`.
- **Problem:** Only `tests/test_webapi.py` runs. Nothing in CI checks `test_engine_qt_free.py` (a direct PySide6 or third-party import would break Pyodide at boot), `test_no_automation.py` (the hard no-input-to-game rule), `test_webapi_gear.py` or the engine suites.
- **Fix:** Run `pytest tests/test_webapi.py tests/test_webapi_gear.py tests/test_engine_qt_free.py tests/test_no_automation.py` at minimum. Better: the full suite with the Qt view tests excluded (`--ignore` or a `-m 'not qt'` marker). Consider Python 3.14 to match Pyodide; the version difference was not verified.

### 3.4 [M] Deploy doc says to check github.io first, but that URL will show a blank page; and nothing is pushed
*(merged from 2 findings)*
- **Where:** `DEPLOY_HANDOFF.md:46` (step 2.3).
- **Problem:** `web/vite.config.ts:8` sets base "/", so on `jonboy648.github.io/aion2-companion/` every asset returns 404, and 404.html redirects to the github.io root. That origin is also not in ALLOWED_ORIGINS (`proxy/wrangler.toml:7`). The operator will think the deploy is broken, or "fix" base and break becomecube.com. Also, origin/main is still 26e9352, with all of this session's work uncommitted.
- **Fix:** Replace step 2.3 with: "workflow run green; artifact contains index.html and engine/manifest.json", or a local `npm run build && npx vite preview`. Say plainly that the github.io URL is expected to be blank. Add step 0: commit and push the finished work to main.

### 3.5 [L] Engine files are fetched at fixed URLs, so a new bundle can pair with a stale zip for about 10 minutes after a deploy
- **Where:** `web/src/engine/worker.ts:76-77, 96-97, 107`.
- **Problem:** Pages serves files with max-age=600, so a new protocol method can hit an old webapi and fail with an AttributeError.
- **Fix:** Fetch manifest.json with `cache:'no-store'` and add `?v=<engine_hash>` to the zip, classes, icons and items URLs (shares the hash from 3.2).

### 3.6 [L] A Pyodide CDN failure shows the raw browser error and has no timeout
- **Where:** `web/src/engine/worker.ts:67-89`.
- **Problem:** "Failed to fetch dynamically imported module..." with no hint. A stall blocks the serial queue indefinitely.
- **Fix:** Wrap the import and loadPyodide in try/catch with a friendly message (name cdn.jsdelivr.net and ad-blockers). Add a 60 s boot timeout with `Promise.race`.

### 3.7 [L] .gitignore misses web/dist_compare and web/dist_guide
- **Where:** `.gitignore:17, 24`.
- **Problem:** `git add -A` would stage 48 build files, including two CNAMEs and two engine zips.
- **Fix:** Replace the `web/dist_verify/` line with `web/dist*/`.

---

## 4. Character page, compare and manual build

### 4.1 [M] A compare (engine) failure replaces the page with the armory "check spelling" error and hides the controls that could fix it
- **Where:** `web/src/features/build/useCharacter.ts:61, 86-88`; `web/src/pages/Character.tsx:63-76`.
- **Problem:** Any compare or engine rejection sets `phase='error'`. Character.tsx then returns early with a spelling/region hint that is false, because the armory lookup worked. The card, gear and UnspentPoints input all disappear, and only "Back to search" is offered. If compare keeps failing for the saved points, which would be an engine bug, the user cannot clear the points because the input is gone.
- **Fix:** Add a separate `compareError` and keep imp, raw and cmp. Keep the card, gear and UnspentPoints visible, and render an inline alert with **Retry** and **Clear points** in place of BuildResults. Show the spelling hint only when `err instanceof ArmoryError`. Use engine wording for engine and Pyodide failures.

### 4.2 [M] Character lookup quietly shows a different character when the exact name and server aren't found (3 call sites)
*(merged: build page, compare slot, Daevanion)*
- **Where:** `web/src/features/build/useCharacter.ts:27-31` (`pickHit`: `exact ?? sameNameAnyServer ?? hits[0]`), used by `web/src/features/compare/useCompareSlot.ts:38`. Separate copy at `web/src/features/daevanion/DaevanionView.tsx:41-43` (`find(serverId) ?? hits[0]`, which never checks the name).
- **Problem:** search() is a keyword search with size 100. A shared link to a renamed or inactive "Bob" loads "Bobby" or another server's Bob with no warning. saveRecent stores the wrong character, and Compare's Copy can save that wrong build. In Daevanion, the characterId comes from hits[0] but the serverId comes from the link, which is a mismatched pair.
- **Fix:** Make `pickHit` strict: require an exact case-insensitive name. If the server differs, accept it only when there is exactly one exact-name hit, and return a notice ("Found on <server>, not the linked server"). Otherwise throw `ArmoryError("No character named X on that server")`. Drop the `hits[0]` fallback. DaevanionView should reuse `pickHit` (or put the characterId in the link).

### 4.3 [M] Compare "Copy" uses the other compared slot as "mine", not the user's own build, and refuses copies across classes
- **Where:** `web/src/pages/Compare.tsx:65-71`; `web/src/features/compare/logic.ts:140-157` (`buildCopyPlan`).
- **Problem:** Copying stranger A while stranger B is in the other slot saves B's level, stats and points as the user's active build, which Keybinds, Crafting and Road Map all read. A Gladiator compared from a Sorcerer account can never be copied.
- **Fix:** Pass `readActiveBuild()` (`features/keybinds/activeBuild.ts:13`) as `mine`. buildCopyPlan should take a `Build | null`. When there is no stored build or it is a different class, take theirs outright and add a warning.

### 4.4 [M] "Manual build" link after Copy opens a blank form, and Solve there overwrites the copied plan
- **Where:** `web/src/pages/Compare.tsx:113`; `web/src/pages/ManualBuild.tsx:34`; `web/src/features/build/manualBuild.ts:54` (`initialForm`).
- **Problem:** ManualBuild never reads the active build or the target plan. Clicking Solve on the default form calls `storeActiveBuild`, which replaces the plan that was just copied.
- **Fix:** Link to `/build?class=<key>&from=active`. In ManualBuild, when `from=active` and `readActiveBuild()?.class_key === classKey`, seed `initialForm(classKey, build)`. Until that is built, remove the link.

### 4.5 [M] Stale compares are never cancelled and pile up behind each other in the single worker
- **Where:** `web/src/features/build/useCharacter.ts:72-96`; `web/src/engine/worker.ts:137-149` (`chain = chain.then`).
- **Problem:** Each points edit made more than 600 ms after the previous one queues another full 4-playstyle compare. The result the user wants waits behind every abandoned one, and nothing times out.
- **Fix:** In the hook, allow at most one compare in flight and re-run once with the latest points when it settles. Optional: a supersedes key in the worker that skips stale queued compares, and a soft timeout that shows Retry (terminate and recreate the worker).

### 4.6 [L] Old results stay on screen without a stale marker while points recompute
- **Where:** `web/src/pages/Character.tsx:105-106`.
- **Fix:** Pass `busy={st.phase==='optimize'}` to BuildResults and wrap it in `opacity-60 aria-busy`, the same pattern GearUpgradesCard uses.

### 4.7 [L] Applied trade-off variant: the strip DPS, rotation and skill plan still describe the max-DPS stigma set
- **Where:** `web/src/features/build/PlaystyleStrip.tsx:23, 35, 39`; `BuildResults.tsx:43-51`; `PlaystyleDetail.tsx:147-183`.
- **Fix:** Carry the variant's dps in `overrides` (`{keys, dps}`) and use `overrides[k]?.dps ?? fb.result.dps` for the number and bar. While a variant is applied, label Rotation, Skill points and Stat gains "for the max-DPS stigma set".

### 4.8 [L] "Every skill is already at its best rank" is shown when the entered points can't afford the next rank
- **Where:** `web/src/features/build/PlaystyleDetail.tsx:106-110` (cause is in `app/aion2c/engine/budget.py:99`).
- **Fix:** Change it to "No upgrade your N points can afford adds DPS (higher ranks cost 2-4 skill / up to 8 stigma points)." Better: have the engine return the cheapest worthwhile upgrade it couldn't afford.

### 4.9 [L] "Spend your N points" shows only one pool when both are entered
- **Where:** `web/src/features/build/PlaystyleDetail.tsx:119`.
- **Fix:** "Spend your 10 skill points and 6 stigma points:", leaving out any pool that is zero. Add a test with both pools in unspentPoints.test.tsx.

### 4.10 [L] Compare marks a "Better" winner while the other side is still estimating, or after it fails
- **Where:** `web/src/features/compare/CompareView.tsx:51` (`better()` treats null as -Infinity, logic.ts:52-56).
- **Fix:** `w = a == null || b == null ? "tie" : better(a, b)`. When a slot's phase is "error" and cmp is null, show "estimate failed" in place of "Estimating...".

### 4.11 [L] Manual build allows levels 46-65 while game data is loading
- **Where:** `web/src/pages/ManualBuild.tsx:22` (`FALLBACK_LEVEL_CAP = 65`).
- **Fix:** Set it to 45, or disable Solve until `data.gd` has loaded.

---

## 5. Daevanion and Codex

### 5.1 [M] Daevanion "Suggest" always optimises for single-target boss
- **Where:** `app/aion2c/webapi.py:184` (`_scenario("boss_180")` hardcoded); `web/src/features/daevanion/SuggestCard.tsx:24, 52`; pass-through in `pyodide-client.ts:141`, `api.ts:62`, `Planner.tsx:89`.
- **Problem:** AoE and levelling players get a boss path labelled only "~+X% DPS", which disagrees with the per-playstyle path on the Character page. (The heuristic priority matches optimize_full_build, so that part is fine.)
- **Fix:** Add `playstyle_key='boss'` to `webapi.daevanion_suggest` and resolve it through `bo.PLAYSTYLES`. Pass it through the protocol, api and client, add a playstyle picker, and label the result "+X% boss DPS".

### 5.2 [L/M] Codex shows per-hit damage and ATK ratio as if they were per cast
- **Where:** `web/src/features/codex/SkillDrawer.tsx:73-74, 86, 96-101`.
- **Problem:** Rage Burst reads 1327 when the real figure is 5 x 1327. Assassin, Chanter and Cleric descriptions don't say "per hit" either.
- **Fix:** When the skill is per hit, label the columns "Damage per hit" and "Attack ratio per hit" and add "x N hits = min-max per cast". **Don't key this on `hits > 1`:** Spiritmaster Jointstrike (Curse 5 hits, Corrode 2) is excluded by multihit_rule.md. Use the engine's per-hit test, or export a `per_hit` flag in gamedata.

### 5.3 [L] Lowering the level keeps nodes on now-locked boards counted and sent to the engine
- **Where:** `web/src/features/daevanion/Planner.tsx:56-58, 81, 150`; `app/aion2c/daevanion.py:66-90, 123`.
- **Fix:** Derive an effective selection without nodes from boards where `!boardUnlocked(b, level)`, and use it for spent, totals, bonuses and the suggest build. Optional: apply the same filter in apply_stats and skill_bonus.

---

## 6. Proxy and analytics (owner-facing)

### 6.1 [L/M] Analytics writes can be spammed with a forged Origin and can exhaust the D1 write quota
- **Where:** `proxy/worker.js:117-140` (`handleBeacon`), `:204-208, 244-245` (searches logged on cache HITs too); `proxy/stats.js:66`; `proxy/schema.sql:4-12`.
- **Problem:** The only check is the Origin allow-list, plus 60/min per IP per isolate. Each visit insert also writes 3 index rows, so one IP can cause about 345k rows/day against a 100k/day free tier. When that runs out, logging fails silently for the day. Users are not affected.
- **Fix:** Add `UNIQUE(day, visitor, path)` on visits and use `INSERT OR IGNORE`. Log searches only on a cache MISS (or dedupe them). Lower the beacon budget to about 10/min. Consider the Workers `[[ratelimits]]` binding. Add a test that 1000 identical /hit calls produce one row.

### 6.2 [L] Searched-name analytics count each Auto lookup about 5x, mostly as 0-result rows
- **Where:** `proxy/worker.js:206-208, 244-245`; `web/src/lib/armory.ts:53-54` (fans out to 5 regions); `proxy/stats.js:116-120`.
- **Fix:** Add `WHERE results > 0` to top_searches. Have SearchBox/SlotPicker send a `log=1` flag on the first region request only, or log one beacon after the fan-out, and have the Worker log only flagged requests. This pairs with 6.1's MISS-only logging.

### 6.3 [L] Without ADMIN_SALT, visitor hashes can be reversed to IPs
*(merged from 2 findings)*
- **Where:** `proxy/stats.js:36` (`env?.ADMIN_SALT ?? ""`), `:62-67` (logVisit).
- **Problem:** SHA-256(ip|day|) over the 2^32 IPv4 space can be brute-forced. That breaks the "IP never stored" promise (Layout.tsx:53, CONTRACT.md:85).
- **Fix:** In logVisit, return early when ADMIN_SALT is missing or shorter than 16 characters. Add `salt_configured` to the adminStats output. Add a test that /hit with STATS and no salt inserts no row.

### 6.4 [L] /picked attaches the opened character to whoever searched most recently
- **Where:** `proxy/stats.js:82-97` (prefix match across all visitors and regions); `web/src/lib/analytics.ts:38`.
- **Fix:** Have the client send the exact keyword and region with /picked, and match on `lower(keyword)=` plus region. Or log picks as rows of their own.

### 6.5 [L] No `Vary: Origin` on responses that are publicly cacheable for 10 minutes
- **Where:** `proxy/worker.js:48-58` (corsHeaders returns `{}`), `:236`.
- **Fix:** Always send `Vary: Origin` (have corsHeaders return `{Vary:"Origin"}` instead of `{}`). Optionally use `private, max-age=600` for clients.

### 6.6 [L] Beacon reads the whole body before checking its size
- **Where:** `proxy/worker.js:107-116` (`readJsonBody`).
- **Fix:** Return 413 when Content-Length is over 1024. Otherwise read the stream with a running byte cap and cancel once it passes 1024.

### 6.7 [L] Dev server listens on all interfaces
- **Where:** `proxy/dev-server.mjs:43`.
- **Fix:** `server.listen(port, process.env.HOST ?? "127.0.0.1", ...)`.

---

## 7. Guide and road map content

### 7.1 [L] Specialty slot breakpoints stated as fact, though the research marks them unresolved
- **Where:** `web/src/features/guide/basics.ts:94` (also :91 "up to 3").
- **Fix:** Change to "First slot at rank 8, second at 12; the third opens at 16 or 20 (sources disagree)". Drop "more at 20" and add a `check`.

### 7.2 [L] Stigma pacing advice can't be followed at 20-30 and leaves out levelling income
- **Where:** `web/src/features/guide/chapters.ts:96, 104, 110, 156`; `basics.ts:47, 106`. *(The original finding cited chapters.ts:302/316, but the file has 208 lines.)*
- **Fix:** In the Stigmas card and the 20-30 chapter, say points come at about 1 per level from 23 (about 8 by 30) and about 2 per level from 40. Change the 20-30 "mistake" to "put your first ~8 points into one stigma". Keep "rank 10/20" as endgame wording only.

### 7.3 [L] The Sources disclaimer promises that single-source facts are marked, but several aren't
- **Where:** `web/src/features/guide/Sections.tsx:125` (the disclaimer; not :412); `basics.ts:154` (10 ms macro delay), `:129` (2 Daevanion Crystals), `:105` (stigma at 22, which is marked only in chapters.ts).
- **Fix:** Add `check` strings, for example "Some guides say 40-50 ms at 80+ ping" and "Crystal-to-point rate not verified", and use the same check in both places. Or soften the disclaimer.

### 7.4 [L] Skill window tab list contradicts the corroborated research
- **Where:** `web/src/features/guide/basics.ts:37` (and :149).
- **Fix:** "Skill window: Mastery tab (Active + Passive skills), Stigma tab, Macro button (top right)."

### 7.5 [L] Switching the road map region leaves the level above the new cap ("Level 50 of 45")
- **Where:** `web/src/pages/Roadmap.tsx:57, 83, 128, 145`.
- **Fix:** `const lvl = Math.min(level, cap)` and use `lvl` for the badge, input value, aria-valuenow, progress, Timeline and JourneyStrip. This keeps the user's 50 if they switch back to Korea.

---

## 8. Feature gap (not a defect, decide before launch)

### 8.1 [M] The community macros and movesets are shipped but never shown on the site
- **Where:** `web/public/engine/classes/*.json` (`community`, 3-5 per class) is read only by the type in `web/src/lib/types.ts:127, 203`. `app/aion2c/webapi.py` exposes nothing from `engine/community.compare`, which only the desktop `ui/build_planner.py` uses.
- **Fix:** Add `webapi.community(build, scenario_key)` that reuses `engine/community.compare` and returns each rotation's simulated DPS against the engine's best, plus the disagreements. Render a "What players run" card on Keybinds with source link and date. Adding a `lines` field, bottom-first, for the guides' real stack structure is a later step. It needs one consistent order convention first (open_questions Q1).

---

## Fix order

**Before pushing, at minimum:** 3.1, 3.2, 3.3, 3.4, 3.7 (Group A), 1.1 and 1.2 (Group B), and 2.1 and 2.2 (Group C). These ship wrong numbers or a broken deploy.

The groups below don't share files, so they can run in parallel. Each lists every file it touches.

**Group A: platform, CI, deploy** (3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7)
- `web/scripts/bundle_engine.py`, `.github/workflows/pages.yml`, `.gitignore`, `DEPLOY_HANDOFF.md`, `web/src/engine/cache.ts` (+ its test), `web/src/engine/pyodide-client.ts` (dataVersion only), `web/src/engine/worker.ts` (fetch URLs + boot only)
- Also commit the untracked modules, items.json and tests together, in coordination with the gear and engine agents.

**Group B: game data** (1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8 data part, 1.9, 1.10)
- `research/classes/gladiator/mechanics.json`, `app/aion2c/data/build_gamedata.py`, `app/aion2c/data/src/chains.json`, `app/aion2c/data/src/mechanics.json`, `app/aion2c/data/src/roadmap.json`, `research/classes/*/roadmap.json`, `research/classes/{templar,cleric}/roadmap.json`, `app/aion2c/data/classes/spiritmaster/icon_names.json`, `research/open_questions.md`, new tests in `app/tests/test_data_build.py`
- Last step: regenerate `app/aion2c/data/classes/*/gamedata.json` and `web/public/engine/classes/*.json`. Tell the engine agents first, because these outputs feed their tests.
- **B2 (owned by the in-progress specialties agent):** 1.5 in `app/aion2c/specs.py` and `app/aion2c/engine/specialties.py`.

**Group C: keybinds** (2.1-2.9)
- `app/aion2c/keybinds/layout.py`, `gkeys.py`, `export.py`, `macro.py`, `app/aion2c/engine/rotation.py`, `app/aion2c/webapi.py` (`keybinds()` only; the gear parts are in progress), `web/src/features/keybinds/useKeybindPlan.ts`, `MacroPanel.tsx`, `Hotbar.tsx`, `markdown.tsx`, `web/src/fixtures/keybinds.json`, `app/tests/test_keybinds_*.py`, `web/src/features/keybinds/*.test.tsx`

**Group D1: character page + lookup** (4.1, 4.2, 4.5 hook part, 4.6, 4.7, 4.8, 4.9)
- `web/src/features/build/useCharacter.ts`, `web/src/pages/Character.tsx`, `web/src/features/build/PlaystyleDetail.tsx`, `PlaystyleStrip.tsx`, `BuildResults.tsx`, `web/src/features/compare/useCompareSlot.ts`, `web/src/features/daevanion/DaevanionView.tsx`, related `*.test.tsx`

**Group D2: compare + manual build** (4.3, 4.4, 4.10, 4.11)
- `web/src/features/compare/logic.ts`, `web/src/pages/Compare.tsx`, `web/src/features/compare/CompareView.tsx`, `web/src/pages/ManualBuild.tsx`, `web/src/features/build/manualBuild.ts`, compare tests

**Group E: proxy + analytics** (6.1-6.7)
- `proxy/worker.js`, `proxy/stats.js`, `proxy/schema.sql`, `proxy/dev-server.mjs`, `proxy/test/*.test.mjs`, `proxy/CONTRACT.md`, `web/src/lib/analytics.ts`, `web/src/lib/armory.ts`, `web/src/features/build/SearchBox.tsx`, `web/src/features/compare/SlotPicker.tsx`

**Group F: guide + road map UI** (7.1-7.5, 1.8 personal.ts part)
- `web/src/features/guide/basics.ts`, `chapters.ts`, `Sections.tsx`, `personal.ts`, `web/src/pages/Roadmap.tsx`

**Group G: Daevanion planner + Codex** (5.2, 5.3)
- `web/src/features/daevanion/Planner.tsx`, `web/src/features/codex/SkillDrawer.tsx`, optionally `app/aion2c/daevanion.py`. If 5.2 needs a `per_hit` flag in gamedata, ask Group B to add it.

**Run after A and C finish** (they share webapi.py and pyodide-client.ts):
- **H:** 5.1 Daevanion playstyle. `app/aion2c/webapi.py` (`daevanion_suggest`), `web/src/engine/pyodide-client.ts`, `web/src/engine/api.ts`, `web/src/features/daevanion/SuggestCard.tsx`, `Planner.tsx` (after G).
- **I:** 8.1 community card. `app/aion2c/webapi.py`, the protocol and client, `web/src/pages/Keybinds.tsx`, a new `web/src/features/keybinds/CommunityCard.tsx`.
