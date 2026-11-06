# Allocation resource preflight: GitHub sync

This draft publishes the completed resource-inventory increment from local
commit `56c10c0`. The original branch is preserved. The publication branch starts
at main `7ba6c2f`; no existing branch history was rewritten.

`webapi.level_progression` adds allocation purchase costs, explicit spare points,
currency separation and uncertainty issues. Refund credit and reset fees remain
unknown. Full redistribution and the character workspace are still unfinished.

Fresh checks on November 6:

- Affected Python suite: 117 passed, 1 skipped in 258.44 seconds. Scope:
  allocation_resources, progression, budget, bonus_ranks, engine_qt_free,
  webapi and real_stats. This was not a full Python suite.
- Web suite: 791 passed, 2 failed across 87 files. Both failures were in
  build.test.tsx: the lazy Home Sorcerer link and a manual-build timeout.
  The complete failing file passed all 15 tests when rerun alone. The full
  suite result remains mixed; this does not establish release readiness.
- TypeScript: `npm exec tsc -- -b` passed.
- Browser archive: all 42 entries match the corresponding app source bytes.
  The manifest fingerprint matches the source fingerprint: `420a68cdbca9`.
  Archive SHA-256:
  `e14415460288a42a1c5dc54b2cbd9cba8565a4c42f27f16577f0c4021d39ebd3`.
- The checked source tree and applied publication tree were identical:
  `61a823287842ef19085256edf87136c771938b12` before this note and the refreshed
  exact-byte archive declaration were added.

The archive contains only allowlisted Python modules and derived JSON contracts.
It contains no raw client export, exporter profile, credentials or executable
binary. The declared-fixture tool records its exact bytes for the content gate;
normal secret scanning and Git hooks remain enabled.

No production build or browser workflow was rerun during this sync. Merging
main triggers Pages deployment, so this PR stays draft pending release checks,
review and Jon's release approval. No deployment is authorized by this note.
