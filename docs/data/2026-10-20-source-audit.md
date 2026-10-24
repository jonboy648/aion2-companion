# Issue 27: Source-To-Browser Audit

Implemented on `codex/character-workflow-prototype`, starting from `98dcacf`. This is an audit and cache-correctness change, not a game-number update, layout change, new extraction or deployment.

## Evidence Boundaries

The shipped derived data identifies an export dated 2026-10-04. Its original client patch remains **unknown**. The Steam manifest observed on 2026-10-19 identifies installed build 25926599; this does not identify the older export. Likewise, the third-party extractor's stated build 25800038 and its mapping filename do not establish the provenance of our shipped numbers.

The machine-readable [source baseline](source-baseline.json) records these distinctions, representative stable IDs, units, joins and expected values. It contains only reviewed derived facts, not raw tables, account data, credentials or captures. The current baseline is Global; Korea/Taiwan rules remain separately unverified. It is a versioned review record, not an automatically refreshed statement of current game truth.

Related research:

- [Original source baseline](../../research/game_data_audit_baseline_2026-10-19.md)
- [Installed Questlog acquisition](../../research/questlog_installed_rea_2026-10-19.md)
- [Questlog builder findings](../../research/questlog_0_1_36_builder_findings.md)
- [Client decoder review](../../research/aion2_client_decoding_review_2026-10-19.md)

Questlog can contribute captured state and observed combat results. Its calculator and the public decoder do not prove server-side damage rules or macro scheduling. No Questlog private files or new game extraction are used by this audit.

## Reproduce

From `web/`:

```powershell
npm run engine
npm run audit:data
npx vitest run src/engine/engine.test.ts src/features/timers/source-baseline.test.ts
```

From `app/`:

```powershell
python -B -m aion2c.data.audit
python -B -m pytest tests/test_data_audit.py tests/test_engine_qt_free.py tests/test_progression.py -q
python -B -m aion2c.data.client_export --check
```

The audit is read-only and needs no private export, game process, network, database or credentials. It prints JSON with pass/fail, warnings, source declarations and artifact SHA-256/size records; failed checks exit nonzero. The Pages workflow runs it after rebuilding the engine and runs the regression tests before deployment. The schedule witness is checked by Vitest, not by interpreting TypeScript inside the Python command.

## What Is Checked

| Boundary | Check | Does Not Establish |
| --- | --- | --- |
| Committed sources -> browser JSON | All class/icon payloads and inventories, shared item payload, manifest class/version inventory; derived source labels must match the recorded export | Original client patch or accuracy of all formulas |
| Sources -> browser ZIP | Explicit module/data allowlist, exact source/member bytes, archive hash | Atomic network delivery across an in-progress deployment |
| Input contents -> result cache | `engine_version` now hashes class contents as well as bundled code, shared tables and items; existing browser cache uses this identity | Game build identity; `data_version` is still a historical label |
| Skill witness | Quick Slice ID 13010000, ratio 70 percentage points, rank-two flat damage 89; Noble Armor 120-second cooldown | Every rank, every tooltip or in-game hit outcome |
| Item witness | Item 110540006, flat attack 103-114, exact +5 enchant contribution 11 | Complete item-DB behavior or prices |
| Progression witness | Global level 22 cumulative totals; all frontend acquisition mappings match complete Python rank sequences | Earned rewards, wallet balance or Korea caps |
| Board witness | Sorcerer Nezekan start/node identity, 1.5% unit, Flame Arrow skill ID 15210000, Azphel Battle Crystal currency | All board graphs, refundable costs or optimal paths |
| Schedule witness | Global Invasion groups -> hourly :30 rule, UTC, epoch-millisecond output | Event duration, in-game verification or KR/TW parity |
| Derived-input privacy | Known derived inputs and public icon maps reject raw table fields recursively, including small payloads; per-file byte limits are enforced | A blanket guarantee about every arbitrary untracked file in a checkout |

The earlier progression note incorrectly called skill 15010000 Flame Arrow. It is Flame Scattershot; the note and test names are corrected. Flame Arrow is 15210000, with different rank gates. No underlying acquisition rows changed.

## TDD Record

Failing tests were observed before their fixes for:

1. Skill-number changes without a date-label bump leaving `engine_version` unchanged.
2. The missing audit/report interface and missing representative witness checks.
3. A small raw export not being identified as a privacy violation.
4. A derived table exceeding its permitted size without a size-limit failure.
5. The browser archive lacking a hash/size entry in the evidence report.
6. Public icon JSON bypassing the raw-export guard.
7. A different export source label being reported as the recorded baseline.
8. A missing item-to-enchant-group link escaping the representative witness.
9. A packed Quick Use patch declaration disagreeing with the unknown export provenance.

Additional mutation coverage checks changed ratio units, deleted board joins, duplicate item IDs, stale manifest fingerprints, stale browser class/item payloads and changed archive data. Inputs are scratch copies; tests do not modify committed data or read private exports.

The first complete Python run found three historical research notes containing literal private-export locations. Those references were replaced with `AION2_EXPORT_DIR` or a private mapping filename; no technical findings were removed, and the privacy guard was not weakened.

## Verified Results

- Final complete Python rerun: 1,037 passed, 8 skipped, 1 expected failure, 1 non-strict unexpected pass; exit 0 (850.76 seconds). No failing tests remain in that run.
- Focused Python run after review fixes: 56 passed, 1 skipped.
- `npx tsc -b`: passed. The production build also runs the strict TypeScript build.
- `npx vitest run --maxWorkers=2`: 81 files / 752 tests passed. The initial default-concurrency run had four existing UI loading/time-limit failures; all four files passed with two workers, followed by the complete two-worker pass. No assertions or timeouts were relaxed.
- `npm run build`: passed; 9,318 files prerendered. Existing large-chunk and ineffective-dynamic-import warnings remain outside this slice.
- Data audit after the production build: 8 classes, 43 SHA-256/size records, 5 representative witnesses, zero errors; export patch null, engine fingerprint `3d70ec920bab`.
- SHA-256 comparison of `web/public/engine` against `web/dist/engine`: all 19 production files identical.
- `python -B -m aion2c.data.client_export --check`: 248 matched skills, 11 declared unmatched, zero mismatches. This checks available derived damage entries, not missing ranks or the complete combat model.
- Independent Standards review: no findings. Independent Spec review: three findings reproduced and fixed with regression tests, then no remaining findings on re-review.

No push, deployment, new game-data extraction or visual change was performed. Optional scratch/log files remain untracked and are excluded from the commit; a cleanup attempt on the test scratch directory was blocked by the execution policy and was not retried through another mechanism.

## Remaining Work

The original export patch is explicitly unknown, satisfying this slice's evidence requirement without inventing a version. Fresh source regeneration still requires a verified current extraction and compatibility review. Downstream import fidelity (#28), complete legal-build/currency behavior (#29/#30), combat calibration (#33) and the other system audits remain separate work. The selected character-workspace prototype is not promoted by this change. Push and deployment still require Jon's review.
