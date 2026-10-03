# G915 G-keys, G HUB, and Aion 2 anti-macro risk

Researched 2026-10-03. Tags: [V] verified from a fetched page, [S] from a search-result summary only, [U] unverified.

## 1. G915 hardware
- 5 G-keys (G1-G5), 3 M-keys (M1-M3), MR. Up to 15 functions per game (5 x 3 M-states). [V-ish, Logitech QSG via search snippet] https://www.logitech.com/assets/65840/2/g915-lightspeed-wireless-rgb-mechanical-gaming-keyboard-qsg.pdf (fetched 2026-10-03; snippet only, PDF not opened)
- On-the-fly recording: MR, then G-key, type keys, MR again. Switch M1/M2/M3 and repeat for more. [S, same QSG]
- Onboard mode: 3 profiles stored on the keyboard, selected with M1/M2/M3. Active when set in G HUB, or when G HUB is off or not installed. [S, same QSG]
- Software mode: G HUB drives bindings, per-app profiles apply, and G HUB must be running. [S] (standard behaviour; no page fetched stating it explicitly)

## 2. What a G-key can be bound to in G HUB
Official Logitech support page lists Assignments categories: Commands, Keys, Actions, Macros, System, audio. https://support.logi.com/hc/en-us/articles/4412850686231 (fetched 2026-10-03). [V]
That page does NOT detail macro types. Per general G HUB knowledge, the macro editor offers: no repeat, repeat while held, toggle, sequence; with recorded keystrokes, delays, and typed text. [U for this session, no fetched source. Check in the G HUB UI.]

## 3. Lua scripting
- Logitech's G-series Lua API: OnEvent(event, arg, family), with G_PRESSED/G_RELEASED (arg 1-18 = G-key number), M_PRESSED/M_RELEASED, MOUSE_BUTTON_*. Functions: PressKey, ReleaseKey, PressAndReleaseKey, Sleep(ms), IsModifierPressed, GetMKeyState([family]), OutputLogMessage, MoveMouse*, PlayMacro etc. [S] Only seen via Scribd copies of the old LGS API PDF, e.g. https://www.scribd.com/document/230786227/G-SeriesLuaAPI (2026-10-03). I could not open an official Logitech API doc.
- Does G HUB Lua support G915 G_PRESSED? [U]. A search summary claimed yes, but no page I fetched mentions the G915. The PeluxGit script says "works across mouse and keyboard G-keys" without naming models: https://github.com/PeluxGit/Logitech-GHub-Macro-Controller-Script (fetched 2026-10-03). The GHub-ShiftKey-Extra repo is G600-only. TEST ON THE REAL KEYBOARD: in G HUB, assign a G-key to a Lua script that calls OutputLogMessage(event..arg), and read the G HUB script console.
- G HUB Lua only runs when G HUB is in software mode and a script is assigned to the profile. It does nothing in onboard mode. [U, inferred]

## 4. Per-game profile switching
- G HUB profiles link to an application exe, and auto-switch when that exe is focused or running. [S, general G HUB behaviour; the Logitech page fetched does not cover it]
- Game exe for linking: `AION2.exe`, 156 MB, at `D:\SteamLibrary\steamapps\common\AION2\Aion2\Binaries\Win64\AION2.exe`. (The full path is the one Windows shows; the game root has no exe.) Listed only, not run.
- Other files in that folder: NCGuard folder, libpwagent.dll, game_presence dll, NCTinyUpdater.dll. Plugins folder contains NCGuardSDK, NcGPA, PurpleOverlaySdk. These show an NCGuard anti-cheat is installed. [V, directory listing]

## 5. Profile storage and programmatic generation
- Path: `%APPDATA%\LGHUB\settings.db`, a SQLite file that holds the config. Backing it up means copying it. [S] https://blog.usro.net/2025/06/logitech-g-hub-how-to-delete-profiles/ (search snippet, 2026-10-03)
- gabfv/logitech-g-hub-settings-extractor (MIT, Python 3.9+): extracts the JSON blob stored in settings.db, lets you edit it, and writes it back. G HUB must be closed. Table and column names are not documented on its README. https://github.com/gabfv/logitech-g-hub-settings-extractor [V]
- Other tools (search results only, not opened): markni/ghub-settings-editor, A-Bomb/ghubMacroEditor, CorbinRandall/ghub-presets-ownership-toolkit-g502 (export/import .lghub-preset.json, G502 only). homelab-00/Logitech_G_HUB_Profile_Editor returned 404 on fetch.
- Verdict: generating or injecting profiles is feasible but unofficial. Schema is undocumented and could change between G HUB versions. Back up settings.db first. Recommended: build the profile by hand in the G HUB UI, then diff settings.db to learn the schema, if generation is wanted. [U]

## 6. Aion 2 / NCSoft stance (the important part)
- Official in-game macro system exists: max 20 repeats, 2 skills per macro, only runs while the key is held/pressed. [S] aion2maps.com guide (403 on fetch) and https://www.nongkhaempolice.com/forum/topic/75177 (redirect loop). These are low-quality aggregator sources. Verify in-game.
- Dev stream recap: "Starting from December 3, all accounts detected using hardware mouse macros are being added to a separate list for final verification and punishment." Penalty: 30-day suspension plus deletion of gains. Client monitors running processes for macro software and force-disconnects; "7-10 thousand accounts every hour". https://aion2.online/news/aion-2-dev-stream-recap-ncsoft-escalates-war-on-macros-reshapes-economy-and-updates-class-balance/ (fetched 2026-10-03; fan site, not NCSoft). [V as quoted, source reliability medium]
- A search summary (boosting-ground.com, 403 on fetch, so not verified) claims the client scans for Logitech G Hub and similar software and can disconnect the player. Treat as [U] but credible given the aion2.online recap. Implication: merely having G HUB running while Aion 2 is open may risk disconnect. TEST/VERIFY before relying on any G HUB software-mode binding.
- Legal: NC filed complaints against 5 users (2025-12-12) and 7 users (2026-01-20); 727,748 accounts sanctioned over 65 rounds. Articles do not say whether the macros were software or hardware, and focus on RMT/account sales. https://sports.khan.co.kr/en/article/202512121818147 and https://www.invenglobal.com/articles/20119/ncsoft-moves-forward-with-second-round-of-legal-action-against-aion-2-illegal-program-users [V]
- Jan 2026: gathering macro crackdown, gathering min level raised to 45. https://www.invenglobal.com/business_industry/articles/20148/... [V]
- I found NO official NCSoft ToS text or statement specifically about 1:1 key remaps or G-key hardware. [U]

## 7. Risk ranking (my assessment, not a sourced fact)
1. Safest: onboard-mode G-key sending a single plain keystroke (1:1 remap). G HUB not running, so no process to detect, and the game sees ordinary keys. Residual risk: unknown, no official statement.
2. Medium: onboard-stored multi-key macro. The keyboard emits several keys per press, which is similar to the official macro's own purpose, but timing is machine-perfect and one press yields many inputs. Not confirmed as allowed. Note: onboard memory on G915 may store only simple keystrokes/combos, not delays. [U]
3. High risk: G HUB software-mode macros or Lua, especially looping/toggle or repeat-while-held rotations. This is the botting pattern NCSoft targets, plus G HUB process detection.
4. Avoid: any unattended loop, toggle-autofire, or timing-randomised script.
- Safest design for the team: G1-G5 as onboard 1:1 remaps (e.g. to F-keys/modifier combos the game already accepts), plus use Aion 2's own in-game macro for sequencing. Confirm the game accepts the bound keys in its keybind UI.

## 8. Open items
- Does onboard mode support G1-G5 (and delays) on this G915 unit? Test in G HUB.
- Does Aion 2 kick or flag when G HUB is merely running? Ask the community/NC support before running it with the game.
- Get the official Logitech Lua API doc for the G915 family name ("kb").
