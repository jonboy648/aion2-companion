# Allocation preflight verification

Local branch codex/same-gear-redistribution, based on c62d41d. Not pushed/deployed.

The existing webapi.level_progression response now includes modeled rank/node
costs, explicit spare skill/stigma points and uncertainty issues. Refund credit
and reset costs stay unknown. Bonus/default/chain ranks are not purchases;
acquisition and level evidence, separate currencies, adjacency, board unlocks and
regional limits are enforced. Malformed rank types produce a clear API error;
invalid spare values are reported unknown. This is not a full respec optimizer.

Evidence on Oct 29:

- Baseline tests/test_webapi.py: 19 passed in 78.40s.
- 28 new public-API cases, written in RED/GREEN slices (including parameter cases).
- Final affected suite: 117 passed, 1 skipped in 178.83s: allocation_resources,
  progression, budget, bonus_ranks, engine_qt_free, webapi and real_stats. This is
  not a full Python suite claim; existing Chanter performance issue #43 remains separate.
- Reviewer found Dodge rank 10 incorrectly receiving a 21-point cost despite only
  rank 1 acquisition evidence. Reproduced RED, fixed GREEN; bounded recheck clean.
- Source audit: 8 classes, 43 artifacts, 6 witnesses, zero errors. Historical export patch
  and Korea validation remain unverified.
- Browser engine: 39 allowlisted modules, 138 KiB ZIP; fingerprint a2be77d8d9f0.
  Source/ZIP imports, parity and fingerprint tests passed.
- Production-equivalent pipeline passed: search-index generation, tsc -b, Vite and
  9,318-page prerender. Output under
  `.superpowers/sdd/2026-10-29-same-gear-redistribution/dist` preserves the reviewed
  web/dist preview, whose fingerprint remains f455ef237c8a at c62d41d.
- Main JS 800.87 kB (gzip 245.64), CSS 142.26 kB (gzip 26.36): unchanged from c62d41d.
  Existing large-chunk/dynamic-import warnings remain. No dependencies installed.
- No frontend UI behavior changed; no new browser interaction claim made.

Direct refund wording and exported ResetGold facts are in
`../../research/2026-10-29-redistribution-source-connections.md`. They do not remove
the paid-rank and retained-stat provenance gaps. No security fix, hook activation,
permission change, credential move, push or deployment occurred in this work.
