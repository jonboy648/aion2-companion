# Same-gear resource preflight

Implementation prerequisite for Jon's two chosen starting points in
`2026-10-19-character-plan-decisions.md`. This does not promote the workspace
prototype or enable a full reset using inferred resources.

## Contract

Add `allocation_resources` to the existing `webapi.level_progression(build)`
response. Keep every existing field and the input unchanged. The approved test
seam is the existing public web API, not internal helper calls.

- `rank_cost`: modeled investment in explicit, legal base-rank entries, with
  separate skill/stigma pools. Core rank 1 is free; stigma rank 1 costs a point.
  Bonus ranks, chain follow-ups and simulator rank defaults are not purchases.
  Unknown acquisition rows, unsupported costs, regional evidence or illegal
  holdings make the affected pool unknown, never clamped into a fabricated sum.
  Noninteger rank payloads fail with a clear API ValueError before existing
  progression calculations; numeric illegal holdings remain explained as unknown.
- `node_cost`: separate Daevanion/Battle cost of distinct known opened nodes.
  Free starts cost zero. Unknown nodes, locked boards or disconnected selections
  make the affected pool unknown. Never merge currencies into one wallet.
- `unspent`: the supplied skill/stigma values, retaining `None` as unknown.
  No maximum-level budget is substituted for the character's wallet.
- `refunds`: status `unverified`, all four point-credit values `None`.
  A modeled purchase cost does not prove actual paid-base provenance or a refund.
- `reset_cost`: unknown amount, not zero. No unverified Korean 500-Kinah fee.
- `issues`: explain uncertainty without silently changing the character.

Implementation calls: a small pure allocation module owns this bookkeeping;
the existing API exposes it and the browser allowlist includes it. No new
dependencies, new UI, cache layer or settings changes.

## Evidence boundary

Armory ranks subtract matched Daevanion bonuses but do not establish every
Arcana/Soul Binding bonus. Imported stats also retain some unmapped Daevanion
contributions. A full redistribution needs these provenance gaps resolved;
clearing current nodes and ranks is not sufficient. Further source inspection
continues independently of this preflight. Native macro scheduling remains
unverified and is unrelated to resource accounting. Snapshot reset wording and
the ResetGold field are recorded separately in
`../../../research/2026-10-29-redistribution-source-connections.md`; they do not
establish current server behavior or purchased-rank provenance.

Stop condition for this prerequisite: public-API regressions pass, relevant
existing tests and Qt-free browser-bundle checks pass, and an independent review
has no unresolved correctness findings. No push or deployment is authorized.
