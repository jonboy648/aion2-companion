# Installed Questlog 0.1.36: acquisition findings

Static investigation on 2026-10-19, following the supplied Start Menu shortcut. This supplements, rather than replaces, the older 0.1.35 investigation in [questlog_data_acquisition_2026-10-19.md](questlog_data_acquisition_2026-10-19.md). Renderer findings are in [questlog_0_1_36_builder_findings.md](questlog_0_1_36_builder_findings.md).

## Result

The installed app has a much richer character snapshot than a DPS summary: gear, Daevanion nodes, observed stats, skills/specialties and collections. It also records encounter results. These are useful candidate inputs for completing an armory import and independently checking our calculations, subject to freshness, identity and interpretation checks. They do not supply the game's original source code, proven macro scheduling, or a demonstrated spare-point budget.

No Questlog/game launch, process attachment, packet capture, private recording/settings/snapshot read, credential access, backend request, dependency installation, NAS write or site change was performed. A separate public GitHub source review is recorded in [aion2_client_decoding_review_2026-10-19.md](aion2_client_decoding_review_2026-10-19.md).

## Artifact Identity

- Shortcut: `C:/Users/jonca/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Questlog.lnk`, resolved read-only through Windows Script Host.
- Executable: `C:/Program Files/Questlog/Questlog.exe`; file product version `0.1.36.0`.
- Package: `C:/Program Files/Questlog/resources/app.asar`, 1,585,905 bytes; SHA-256 `789f2676531f565ea639533c2717915260b4da0ecba39c7c75054f55de1904dc`.
- Package metadata: `@questlog/desktop-app`, version `0.1.36`, entry `.output/electron/main.cjs`.
- Worker: `.output/electron/workers/aion-2/combat.cjs`, 685,991 bytes; SHA-256 `b2b215dd280b8f7f25e5af7fa520fe07988df92708fc287299d427378aebc6b3`.
- Main: `.output/electron/main.cjs`; SHA-256 `26052737565d8b9d2d7676dc531e70c7086b28fefa6c64b7d7a0084f0a57a1af`.
- Preload: `.output/electron/preload.cjs`; SHA-256 `2b758ad0220ce366ef00bef2fd235b6a020cc5c2ba85fa22825400654a5c890c`.

## Evidence And Boundaries

REA parent `ev_bd482291675f95e3b29a8565f8cea33215ce2333e444c092261b7620497c4cd1` analyzed package metadata and the main/preload/combat modules. It read 1,545,254 source bytes, parsed three JavaScript files without parse failures and left five inventoried files unselected. Application/semantic coverage is partial; configured semantic limits were reached. The graph is not proof of all application behavior.

Useful retained projections:

- Package version: `ev_9e5223ded4dcfac340d2c949a798e5b2f0f04204bad93f0d19d7a5ba35476d35`.
- Worker identity: `ev_e3b3de5b8594915212a5b9fab4372db1f215833fd188b3804f29591d042dcc94`.
- Worker facts: `ev_0691f5a16b69962c844c9ea70bba695b95cd107cfe25dc74384dcfd5637d11c7`.
- Preload references: `ev_27d27e8a141de78d6b838cd0b86c44791732fc081c76662ea2d6e05d5cba553a`.
- A string-seeded `skill-loadout` trace returned no graph match: `ev_a2ee2e6454e10c376ca8568e5b5d290ca60a48f60ae37777a5921da36dc83c4b`. Direct source inspection confirms the literal. The failed trace is a graph limitation, not feature absence.

Supplemental source reads used an independent in-memory ASAR member reader, without executing or extracting application modules into the project. Its worker digest matches REA. Locations below are zero-based UTF-8 byte offsets **within the original worker member**, not the ASAR; that member begins at ASAR byte 863,317. They anchor findings without reproducing proprietary source.

Main-session portable evidence: `D:/Aion2-tools/questlog-0.1.36-rea-20261019.json`, 23,456,939 bytes / 11 records, outside the Git repository. The sidecar's renderer evidence is separately identified in its report; its records are not part of this main-session export. No native target was opened; no native session was closed.

## Observed Data Flow

1. **Acquisition:** worker byte 482907 references `wpcap.dll`; 484228 binds `pcap_next_ex`; 485642 reads captured frames and timestamps. This establishes a packaged network-decoder path, not observation of live capture on this computer.
2. **Normalized character events:** byte 496457 defines learned/equipped skills with levels and specializations; 495284 defines board/node IDs; 495227 defines full/partial numeric stat updates; 494897 carries gear fields including enchant and `surpass`. Nearby schemas include pets, titles/owned titles, skins, monoliths, pantheon, wings/equipped wing and genus effects. Schema presence does not guarantee every field is available in a particular capture.
3. **Assembly:** around bytes 510901-512589 the aggregator builds one character view. Full stat updates replace the map; partial updates merge only for self. Equipped skill levels override learned levels. Chain children inherit their parent's level/specialties. These displayed levels must not be automatically treated as purchased ranks.
4. **Snapshot:** byte 512391 emits identity/name/race/update time together with gear, Daevanion, pets, titles, owned titles, skins, monoliths, pantheon, wings, genus, skills and numeric stats.
5. **Persistence:** byte 671249 uses `characters.json`, keyed by server/name. Incoming defined fields merge into the previous record; an incoming empty array does not clear an existing nonempty array. The save also stamps `savedAt`. Consequently, a recent save can contain older fields; per-field freshness is not established.
6. **Internal subscriptions:** bytes 682148-682362 expose current/saved character streams through the desktop combat channel. These private IPC operations are not a documented website API and were not called.

The renderer sidecar independently found a built-in **signed-in website export**, not a local JSON-file export: it sends a converted snapshot to `characterBuilder.importFromGame`, then opens the resulting character builder. The integrator independently rechecked all six renderer hashes and the export/payload source ranges. That conversion drops or transforms some information, including omission of the snapshot stat vector. Importing that recalculation and comparing it with ours would not be independent validation of observed stats.

## Combat And Budgets

- At worker byte 540876, a player's scope summary divides damage by the selected duration seconds. Encounter/dummy saving occurs around 580550-581691; as-played skill information is assembled near 545873. This can support measured-versus-predicted comparisons only when actor, encounter scope, duration, skill IDs/ranks, gear, buffs and target conditions match.
- The normalized schema includes `capture-gap` near byte 494538. A missing interval must not be interpreted as a cooldown or scheduler delay.
- Decoder structures near byte 600377 contain `skillPoints` / `bonusSkillPoints` entries with point type and count. Their meaning and path into persisted snapshots were not established. They do **not** yet prove available unspent skill/stigma budgets.
- Currency state near byte 512830 contains item/count pairs. A crystal-balance adapter would need separately verified item mapping and freshness; currency balances are not interchangeable with skill-point budgets.
- A bounded case-insensitive literal search of the complete selected worker found no `macro`, `quickslot`, `clientVersion`, `gameVersion`, `buildVersion` or `protocolVersion`. This does not rule out differently named or external behavior. No inspected record establishes input origin, quickslot row, macro configuration or macro arbitration.

## Recommended Use In Become Cube

1. **Keep three evidence sources separate:** patched client tables describe configured data; a user-selected character snapshot describes captured state; a matched combat record describes an outcome. Neither a third-party calculator nor a table decoder alone proves server-side combat behavior.
2. **Start with offline adapters, not another meter:** support an explicitly selected, sanitized snapshot/recording subset. Do not require a driver, unsupported desktop IPC, Questlog credentials or automatic upload of raw captures. The installed UI's export is backend-only, so a local-file import would be our own feature, not an existing Questlog button.
3. **Preserve provenance:** retain original IDs, source/version, timestamps and missing-state markers. Do not overwrite a newer armory field with a preserved old snapshot field. Raw observed stats and reconstructed source contributions should remain distinct.
4. **Validate high-value gaps:** reconcile gear/soul stats, collections, wings, titles, pets and Daevanion skill bonuses against our existing stat sheet. Separate paid rank, bonus rank and inherited chain rank before optimizing a legal redistribution.
5. **Cross-check combat last:** compare per-skill hit counts, crit shares, buffs and timing before reporting a whole-build DPS match. Keep unknown target modifiers and capture gaps visible. Do not advertise simulation-optimal macros without independent game evidence.

## Question Ledger

| Question | Status | Basis / Remaining Work |
| --- | --- | --- |
| Which installed artifact? | Answered | Shortcut, package metadata and source digests |
| Can it capture richer character state? | Answered statically | Event schemas, assembly, persistence and export path; no user's current snapshot inspected |
| Can it help calibrate combat results? | Partial | Scope/DPS and save code found; matched recordings not evaluated |
| Does it establish full current stat aggregation? | Unresolved | Renderer uses backend data; sidecar did not recover a complete current aggregation function |
| Does it establish spare earned-point budgets? | Unresolved | Low-level decoder fields found, no verified saved-state semantics |
| Does it prove game macro scheduling? | Unresolved | No input-origin/scheduler evidence in inspected surfaces |
| Was any site behavior changed or deployed? | No | Research only; no application tests claimed |
