# Questlog data acquisition and validation options (2026-10-19)

**Finding:** Jon has the actual Questlog Desktop installed. Its combat meter measures decoded game traffic; its website builder calculates a proposed character's stats. Those are different evidence sources. Reusing the meter's saved results can validate our damage and rotation models, but cannot by itself prove the game's macro scheduler. [Questlog Desktop][Q1] [L1] [L2] [L3]

Evidence labels below distinguish **code**, **publisher documentation**, **prior observation**, **inference**, and **unknown**. Inspection was read-only except this report. No apps/binaries were launched, browser sessions controlled, endpoints probed, or private recordings/configs/credentials read. The previous research note and its references were checked; earlier personal combat figures are deliberately not reproduced.

## Product identity and provenance

| Product | Evidence and limits |
| --- | --- |
| Installed Questlog Desktop | **Code/metadata:** `C:/Program Files/Questlog/Questlog.exe` identifies Questlog, publisher `questlog.gg`, version **0.1.35**. Inside `resources/app.asar`, `package.json:2` names `@questlog/desktop-app`, line 3 supplies the version, and line 8 selects the Electron entry point. It packages an Aion 2 combat worker and Nuxt renderer. This is not an identification based on a folder name alone. [L1] |
| Questlog website/build calculators | Public `questlog.gg/aion-2` tools and downloaded frontend chunks. The old website code is a **2026-10-05 snapshot**, not today's backend; the installed renderer supplies a second, 0.1.35 snapshot. [L4] [L5] |
| Current download vs old installer | **Publisher documentation:** live app page retrieved on 2026-10-19 advertises **0.1.36**; search excerpts still mentioned 0.1.34. `C:/Users/jonca/Downloads/questlog-setup-0.1.17.exe` also exists, but is not the installed version. Neither installer was executed. [Questlog Desktop][Q1] |
| TK DPS meter | A separate Kotlin project, **AION2Meter4J**, at `TK-open-public/Aion2-Dps-Meter`. Its README says development ended June 19; inspected repository head `e72c6d5e0c9b647f5c1fcc0fca76fb22cd734d4e` is dated July 4, 2026. Its source license is MIT. No evidence establishes that Questlog uses TK code. [TK source][T1], [license][T2]. |
| Official NC armory | NC's character information room is a separate profile/search product. Its existence does not establish that it supplies live combat events, or prove Questlog's server-side upstream. [NC character room][N1] |

`D:/Aion2-tools` contains extraction tooling, derived-data and map projects. The inspected directory/filename inventory did **not** locate a Questlog or TK app/source tree there; the identifiable Questlog installation is under Program Files. This is not an exhaustive claim about every drive.

Installed ASAR SHA-256: `C3939BF475EFA97AD2F989804F7162F612ADB8CDC7287681096CE26290185BCF`. Its recorded last-write time is 2026-10-18 17:44:10 local. This pins the inspected artifact, not a reproducible public source commit. Archive entries were read as text without loading their modules or native libraries. [L1]

## Where the data comes from

### Static skills, items and calculated builds

**Code:** the installed renderer requests Questlog backend tables through `characterBuilder` queries, including character levels, titles, wings, pets and monolith levels; its store exposes items, item sets and `playerStatSeconds`. The older website entry uses the same query family and a tRPC transport. These are database/build inputs, not measured combat. [L4] [L5]

The 2026-10-05 `calculateFinalStats` implementation aggregates equipment and collection sources, applies secondary-stat conversions, then ratio mappings. Its armory counterpart reconstructs stats from a narrower snapshot: base stats, equipment, Daevanion, wing, equipped titles and arcana. **Verified for that snapshot:** the armory sheet is calculated; it is not independent evidence of the complete in-game stat sheet. Do not extrapolate its old omissions to every current version. [L5]

**Unknown:** Questlog's original table-acquisition pipeline, extraction software, patch verification and redistribution permissions. Game-shaped fields/assets support an inference of game-derived data, but do not prove how Questlog obtained it. No public damage formula or reusable official Questlog data API was established by the checked sources. An observable internal frontend query is not a supported integration contract.

### Armory/profile snapshots

**Code:** the archived website invokes Questlog's own `armory.search` / `armory.getServers` queries and renders stored `snapshot` equipment. **Publisher page:** today's armory presents regional gear, stats and combat-power searches/rankings. **Unknown:** the exact upstream, cache completeness and update guarantees of Questlog's backend; the frontend does not establish those server-side facts. [L5] [Questlog Armory][Q2]

Our existing `app/aion2c/armory.py:1` already implements the separate NC public-profile path, with source addresses at lines 19-20 and equipment/Daevanion acquisition at line 106. It need not be replaced by a dependency on Questlog's private backend. This inspection did not call either service's character endpoints. [L6]

### Observed combat and character state

**Code, installed 0.1.35:** the combat worker binds Npcap's `wpcap.dll` functions, filters TCP connections and passes inbound payloads through a packet decoder into normalized events. Decoder gaps become explicit capture-gap events. The Electron game definition names `Aion2.exe` and the combat worker. [L2] [L3]

The event schema includes damage/hit flags, actor/target/skill IDs, casts, healing and character state. Character events include equipment/stats, collections and learned/equipped skill loadouts with levels/specializations. These are potentially useful measurements beyond a public profile, but a schema does not guarantee a complete, contemporaneous snapshot in every recording. [L3]

**Publisher documentation** independently describes Npcap network capture, separate overlay windows and no game-memory/file modification. The inspected code demonstrates the network path; this is not an independent audit of every native dependency or a game-publisher endorsement. No OCR, game-generated combat-log ingestion or memory-based combat acquisition was demonstrated in this investigation. Reading Questlog's own saved files is downstream storage, not evidence that the game writes those logs. [Questlog Desktop][Q1] [L2] [L3]

### DPS computation, storage and upload

**Code:** the meter groups observed damage by owner and skill, with separate direct/over-time tallies. Summary/player/skill DPS divides captured damage by the selected fight-window seconds. Player and target scope, encounter boundaries, ownership and capture gaps therefore matter. The code distinguishes damage share from a possible boss-HP contribution basis. This is aggregation of realized damage, not a replay of the builder's theoretical damage formula. The support-adjusted/rDPS attribution formula was not audited. [L3]

There are distinct artifacts, all established from code rather than opening personal files:

- `aion-2/encounters/*.json` and `training/*.json`: versioned saved summaries; training indexes include duration, damage, DPS, target, name and notes. The record includes a format marker, but this is an internal format. [L3]
- `aion-2/combat-logs/*.ndjson`: normalized combat-event records, with an index and upload state. [L3]
- A separate optional `recordings/capture-*.ndjson` path: raw capture/replay records carrying connection data and base64 payloads. It must not be confused with normalized combat events or imported wholesale into our repo. [L3]

**Publisher documentation:** fights save locally; while signed in, cleared dungeon runs can upload automatically, with controls for disabling automatic upload or making uploads private. Offline validation need not use uploads. The worker fetches boss/dungeon/buff/stat catalogs from Questlog's backend to interpret events; the original acquisition of those catalogs is still unknown. [Questlog Desktop][Q1] [L3]

## What this can validate

Our `SimResult` DPS is modeled damage divided by a configured scenario duration (`engine/simulator.py:763`); the macro search explicitly scores a simulated sequence (`keybinds/macro.py:1`). A number labeled current-build DPS is therefore not a measurement just because the build came from an armory import (`webapi.py:139`). [L7]

Questlog can supply a separate observed comparison: per-skill damage and hit mix, actual skill activity, buff coverage, target scope, and casts/cooldowns where recorded. Compare an **as-played** build and identical time/target window before judging the optimizer's proposed build. Party buffs, target defense, pet attribution, missed events and differing start/stop rules can all explain a mismatch; one aggregate DPS result cannot identify the responsible formula.

**Macro limit:** the archived skill builder stores author-chosen ordered steps and delays; its delay editor is not runtime scheduler evidence. The inspected combat schema has no demonstrated macro-step, pressed-key, quickslot-row or input-origin field. [L5] [L3]

**Prior observation, not rerun:** `research/native-macro-rules-2026-10-11.md:117` documents exact skill-ID joins, system/passive casts and damage occurring before some cancellation events. Line 125 explains why those recordings cannot distinguish manual actions from macro activation or settle column visitation. Do not count every cast event as a button press, infer rank from an ID suffix, or equate cancellation with zero damage. [L8]

## Reuse Options

| Option | Recommendation and remaining work |
| --- | --- |
| Use Questlog training comparisons and saved fight summaries | **Start here.** Reuse its existing measurement/capture UI. Record an as-played baseline and a single-change trial. No new capture driver, overlay or game connection is needed in our project. [Questlog Desktop][Q1] [L3] |
| Add an offline Questlog importer | **Best engineering follow-up.** Read an explicitly selected saved summary or normalized event file locally; gate by app/format version and reject unknown schemas. Retain only needed anonymized aggregates. Match actor ownership, exact runtime skill identity, ranks, target and time window before comparing with `SimResult`; check gaps/decoder issues. A user-facing export contract was not established, so treat this as a versioned adapter with synthetic fixtures, not a stable Questlog API. [L3] [L7] [L8] |
| Reuse existing build inputs | Keep our NC armory importer and existing game-data pipeline. Use Questlog's computed stat sheet as a cross-check, with patch/region/collection differences recorded; it cannot independently validate the damage formula. [L5] [L6] |
| Borrow from TK instead of writing a meter | TK's public `PcapCapturer`, `StreamProcessor` and `DpsCalculator` demonstrate capture, event parsing, owner attribution and damage/time aggregation. MIT code is a concrete reuse candidate with its notices retained, but the project stopped months ago and its current-client compatibility is unknown. This is a reference/fallback, not evidence about Questlog internals or a reason to build another live meter. Embedded game assets need their own provenance assessment. [TK source][T1], [license][T2], [capture][T3], [parsing][T4], [DPS calculation][T5]. |

No Questlog source redistribution license, maintained SDK, supported live event subscription or public ingestion/export API was established. The packaged code was used to describe behavior, not copied into this project.

## Still Needs Jon's Observation

1. Record the client patch/region and Questlog version, exact in-game stats/gear, ranks, specialties, collections, buffs and target. Verify the meter is counting self and the intended target, with pet ownership handled correctly. Capture the authored quickslot grid and macro entries separately; an armory or skill-loadout snapshot cannot reconstruct that grid.
2. Run repeatable, equal-duration trials on the same dummy with the same starting resources, cooldowns and buffs: baseline first, then one changed build variable. Save local results and check capture gaps/decoder issues. Keep uncontrolled dungeon results separate from formula calibration.
3. For scheduler testing, record a known macro-only interval alongside the visible grid, per-step delays and macro activation interval. Compare predicted skill activity with observed active casts/damage, accounting for chain/system effects. Test competing column-visitation models under a deliberately visible cooldown conflict. Manual precedence requires a separately marked manual-input trial.
4. Treat event timestamps as observed combat timing, not proof of keyboard timing. A 10 ms configured delay alone establishes neither actual polling cadence nor cast completion. The outcome still needs a matched in-game recording before we label scheduler behavior verified. [L8]

## Sources and Reproduction

Local repository observations refer to `D:/Aion2-level-planner`, HEAD `8768b37b5bbde7cfc01806c4a53ee1de2fb38b50`, plus the existing untracked macro research note. Concurrent work may move HEAD. The prior comparison was read with `git show origin/research-notes-2026-10-05:research/questlog_comparison_2026-10-05.md`, especially sections 6.0, 6.2 and 6.3 F1/F2/F4. It informed leads; installed code and current primary pages supply fresh evidence where stated.

For ASAR references, line numbers are **original decoded bundle lines**, not pretty-printed source. Parenthesized offsets are zero-based UTF-16 character positions within the decoded entry, useful because minified lines are long. No archive files were extracted to disk.

- **L1:** [installed ASAR](<C:/Program Files/Questlog/resources/app.asar>), inner `package.json:2`; [executable metadata](<C:/Program Files/Questlog/Questlog.exe>), read without execution.
- **L2:** same ASAR, `.output/electron/main.cjs:136`, Npcap checks and Aion 2 game definition.
- **L3:** same ASAR, `.output/electron/workers/aion-2/combat.cjs`: line 66 Npcap bindings; line 67 TCP flow (490720), catalog requester (492784), skill-loadout schema (496457), damage schema nearby, skill aggregation (528814), scope/player DPS (540616), capture gaps (545378); line 71 summary storage (556725); line 72 normalized log storage (559042); line 73 decoder (669332), record indexes (672509) and catalog/loading/dispatch setup (after 674000). Raw-capture storage is line 67 (486046).
- **L4:** [installed builder store](<C:/Program Files/Questlog/resources/renderer/aion-2/_nuxt/BMwc3mzj.js:1>), `characterBuilder` queries and returned table stores.
- **L5:** archived website code: [entry/store/transport](D:/Aion2/.firecrawl/ql-js/IQJ3RDA4.js:4) (transport line 10), [stat aggregation](D:/Aion2/.firecrawl/ql-js/DY6U1SZS.js:1), [armory reconstruction](D:/Aion2/.firecrawl/ql-js/DI1mdNza.js:1), [armory search](D:/Aion2/.firecrawl/ql-js/BdVlUZ_I.js:1), [authored macro delays](D:/Aion2/.firecrawl/ql-js/DdOVHc8H.js:1). Snapshot provenance is the prior comparison's section 6; no backend source is included.
- **L6:** [our armory importer](D:/Aion2-level-planner/app/aion2c/armory.py:1).
- **L7:** [simulation result](D:/Aion2-level-planner/app/aion2c/engine/simulator.py:763), [macro scoring](D:/Aion2-level-planner/app/aion2c/keybinds/macro.py:1), [current-build DPS](D:/Aion2-level-planner/app/aion2c/webapi.py:139).
- **L8:** [prior recording/macro analysis](D:/Aion2-level-planner/research/native-macro-rules-2026-10-11.md:117), especially lines 117-127. Findings are historical observations, not reinspection of private logs today.

[Q1]: https://questlog.gg/aion-2/en/app
[Q2]: https://questlog.gg/aion-2/en/armory
[N1]: https://aion2.plaync.com/ko-kr/characters/index
[L1]: <C:/Program Files/Questlog/resources/app.asar>
[L2]: <C:/Program Files/Questlog/resources/app.asar>
[L3]: <C:/Program Files/Questlog/resources/app.asar>
[L4]: <C:/Program Files/Questlog/resources/renderer/aion-2/_nuxt/BMwc3mzj.js:1>
[L5]: D:/Aion2/.firecrawl/ql-js/DY6U1SZS.js:1
[L6]: D:/Aion2-level-planner/app/aion2c/armory.py:1
[L7]: D:/Aion2-level-planner/app/aion2c/engine/simulator.py:763
[L8]: D:/Aion2-level-planner/research/native-macro-rules-2026-10-11.md:117
[T1]: https://github.com/TK-open-public/Aion2-Dps-Meter/tree/e72c6d5e0c9b647f5c1fcc0fca76fb22cd734d4e
[T2]: https://github.com/TK-open-public/Aion2-Dps-Meter/blob/e72c6d5e0c9b647f5c1fcc0fca76fb22cd734d4e/LICENSE
[T3]: https://github.com/TK-open-public/Aion2-Dps-Meter/blob/e72c6d5e0c9b647f5c1fcc0fca76fb22cd734d4e/src/main/kotlin/packet/PcapCapturer.kt#L14
[T4]: https://github.com/TK-open-public/Aion2-Dps-Meter/blob/e72c6d5e0c9b647f5c1fcc0fca76fb22cd734d4e/src/main/kotlin/packet/StreamProcessor.kt#L48
[T5]: https://github.com/TK-open-public/Aion2-Dps-Meter/blob/e72c6d5e0c9b647f5c1fcc0fca76fb22cd734d4e/src/main/kotlin/DpsCalculator.kt#L130
