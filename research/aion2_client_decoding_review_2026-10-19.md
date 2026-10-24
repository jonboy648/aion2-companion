# Aion2_Client_Decoding: relevance to Become Cube

Read-only source review on 2026-10-19 of the repository supplied by Jon: [SemaAlter/Aion2_Client_Decoding](https://github.com/SemaAlter/Aion2_Client_Decoding). Inspected commit **46fb22f36b8556c61f9a8c60ecef688222009552**. Source checkout is outside the site repository at `D:/Aion2-tools/Aion2_Client_Decoding-review-20261019`.

No upstream setup, extractor, decoder, database importer or build was executed. No dependencies were installed, no game files were decrypted, and no database/credentials/key file was opened. This is ordinary source analysis, not REA binary evidence. The installed Questlog investigation is recorded separately in [questlog_installed_rea_2026-10-19.md](questlog_installed_rea_2026-10-19.md).

## What It Is

An offline pipeline from an owned client installation to decoded tables/maps and optional MySQL/MariaDB catalogs. It is not an official developer API, a saved character import or a proven implementation of the running game's combat/macro scheduler. The inspected entrypoints handle extraction and database construction, not live combat observation.

Primary entrypoints:

- [Extract-GameData.ps1](https://github.com/SemaAlter/Aion2_Client_Decoding/blob/46fb22f36b8556c61f9a8c60ecef688222009552/Extract-GameData.ps1) orchestrates CUE4Parse extraction, decryption and JSON decoding. `-DataOnly` restricts extraction to data/startup/localization paths and `.dat` files.
- [aion2dat.py](https://github.com/SemaAlter/Aion2_Client_Decoding/blob/46fb22f36b8556c61f9a8c60ecef688222009552/tools/client-data/october/aion2dat.py) reads schema-shaped values and checks exact payload consumption plus flattened column count against the header.
- [export.py](https://github.com/SemaAlter/Aion2_Client_Decoding/blob/46fb22f36b8556c61f9a8c60ecef688222009552/tools/client-data/october/export.py) handles tables, startup tables, maps/world maps and map-event JSON; it writes per-file status to `audit.csv` and returns failure when a job reports a schema error.
- [catalogs.py](https://github.com/SemaAlter/Aion2_Client_Decoding/blob/46fb22f36b8556c61f9a8c60ecef688222009552/tools/client-data/october/catalogs.py) derives smaller relational catalogs. `Import-GameDataToDatabase.ps1` additionally imports structured records and one `ct_*` table per client table.

## Version Mismatch: Verify Before Trusting Outputs

The upstream [README](https://github.com/SemaAlter/Aion2_Client_Decoding/blob/46fb22f36b8556c61f9a8c60ecef688222009552/README.md#client-version) identifies Steam build **25800038**, updated 2026-10-09, and October layouts with the `AION2-5.3.2.0.usmap` mapping.

Jon's local `D:/SteamLibrary/steamapps/appmanifest_3393110.acf:13` reports installed Steam build **25926599**, checked during this investigation. This does not retroactively identify the patch used for our older derived data. The existing [source baseline](game_data_audit_baseline_2026-10-19.md) has null client-version fields in several artifacts.

Compatibility with the installed build is **untested**, not proven broken or supported. Structural success also cannot prove that same-width columns retain their old semantics. A fresh version-stamped output directory and per-required-table acceptance checks are necessary before feeding outputs into the site.

## Relevant Schema Coverage

The inspected [October schema](https://github.com/SemaAlter/Aion2_Client_Decoding/blob/46fb22f36b8556c61f9a8c60ecef688222009552/tools/client-data/october/october-2026-schema.json) has 152 replacement/extension structs and metadata entries for 362 tables. These are source-file counts, not a new extraction run. Metadata includes layouts marked as inferred or hand-authored; `Unknown*` fields explicitly lack confirmed meaning.

The author's metadata reports successful decoding for `SkillAcquireData`, `Exp`, `SpecializedSkillSlot`, `PcStatSecond`, `DaevanionBoard/Node/MaxCapacity`, `QuickSlotData`, `PCLevelQuickSlot`, `SkillControlSetting` and crafting tables. Their reported row counts apply to the author's referenced extraction, not Jon's current client or our shipped data.

Examples of useful connections to audit:

- `SkillAcquireTableItem`: required character level/ascension, prior skills, skill/stigma costs and auto-learn. Some fields remain unknown. Compare these against our legal-rank acquisition and cost tables.
- `ExpTableItem`: level rewards include skill points and separate Daevanion/conquest/battle crystal fields, plus an unknown map field. Do not equate its layout with our older slot/budget interpretation without new rows and semantic checks.
- `DaevanionBoardTableItem`: board level and point currency; `DaevanionMaxCapacityTableItem` still has unknown column names. Verify currency separation and capacity rather than silently guessing.
- `GlobalSettingTableItem`: `skill_macro_timer`, `max_skill_macro_set`, `max_skill_macro_row`, `max_skill_macro_Icon`, and `quickslot_hold_start_time` are named and typed in the schema. **No field values or runtime scheduling behavior were established by reading these names.** They can direct the next client-data check but cannot prove retry order, stack traversal, condition handling or delay units.
- Crafting and map data are relevant to our existing recipe/marker systems, but decoding a table does not prove that our derived dataset contains every row or relationship.

## Restrictions And Failure Modes

1. **Placeholder monster stats:** `catalogs.py:43` explicitly manufactures HP/attack/defense from level/rank; its caller at line 93 writes those into `monsters.csv`. Never use these as target-defense evidence or DPS calibration. This does not prove that no other possible source could reveal NPC stats.
2. **Lossy catalogs:** item categorization is simplified, and the spawn builder notes that NPC candidate lists collapse to their first entry. For rich site mechanics/maps, prefer validated decoded records to these server-oriented summaries.
3. **Old-output risk, static inference:** `export.py` writes JSON only on success and does not remove a previous JSON on schema failure; `catalogs.py` directly opens table JSON and `client_tables.py:135` globs JSON without consulting the audit. Thus reusing an output folder can expose old records to those consumers after a failed refresh. The structured-record importer separately checks manifest status. This risk was identified from control flow, not reproduced by running the tools.
4. **Raw-cache identity:** `Aion2Extractor/Program.cs:70` skips an existing raw file when its size matches; that is not a content-hash comparison. The `.dat` decryption pass separately reads provider files. Do not confuse raw-cache parity with fresh decoded-data parity.
5. **Setup side effects:** `Setup-Dependencies.ps1` fetches/builds CUE4Parse, updates submodules and applies patches; it can reset tracked files in its dependency checkout. Extraction can download native decompression helpers. Full extraction is documented as large. None was run for this review; do not aim it at our current tooling checkout casually.
6. **Reuse terms unresolved:** GitHub's repository metadata returned `license: null`; the complete tree at this commit contains no license file. Do not copy/adapt its code into Become Cube until a reuse grant is established. The CUE4Parse dependency's terms are a separate question. Public visibility and an educational disclaimer do not establish the site's intended reuse permissions.

## Recommendation

Use this as a **candidate second extraction/audit path**, not a website replacement or an automatic truth source. First resolve reuse terms; then, if authorized, test a minimal data-only run in a separate version-stamped directory against installed build 25926599. Require successful audits for every table our calculators consume, reject missing/ambiguous inputs and retain source/build/schema hashes. Compare skill costs/ranks, point currencies, stat conversions, recipes and graph relationships against our current derived artifacts before regenerating anything shipped.

Keep the three roles distinct: client extraction supplies configured tables, Questlog supplies captured character/combat state, and Become Cube searches/calculates recommendations. Combining those with explicit provenance can improve validation; none alone proves every server-side rule. No site changes, data regeneration, runtime tests, commit, push or deployment were made in this investigation.
