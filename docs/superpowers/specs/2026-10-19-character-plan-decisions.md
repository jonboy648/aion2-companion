# Same-gear character planning: decisions

Status: scope decisions from Jon on 2026-10-19, not an implemented optimizer
contract or an approved complete redesign spec.

## Two supported starting points

Jon chose both versions of the same-gear recommendation:

- Preserve allocations: keep imported skill ranks and opened Daevanion nodes;
  plan legal changes using only confirmed spare resources.
- Redistribute allocations: keep equipped gear, but allow refunding and
  reallocating existing skill, stigma and Daevanion resources. Show reset costs
  separately from point budgets and additional purchases.

The UI must identify the selected version. Compare each plan with the same
imported baseline and playstyle, never with a best-in-slot ceiling. Retain the
complete target plan and ordered, playable next steps. Independent experimental
gains are not additive.

Refundable and available resources must be derived from the character and
confirmed earned/spare points, not silently replaced by the maximum level
budget. Keep Daevanion and Battle Crystal currencies distinct. Unverified refund
rules or costs must be labeled unknown, not zero.

The current character flow calls compare with zero additional Daevanion points
and only adds entered spare skill/stigma points. It does not yet implement the
redistribution version. A visual preview and explicit engine contract still
precede implementation of the redesigned character workflow.

## Release and validation decisions

- Jon approved publishing the existing native macro editor/navigation branch,
  subject to fresh checks. This does not assert that both new planning versions
  are already implemented.
- Jon approved the controlled in-game macro check. Approval is not test evidence;
  no scheduler, retry or macro-DPS claims may be added without observations.
- Investigate the downloaded Questlog app and its data acquisition against
  primary sources; distinguish observed combat from theoretical DPS.
- Jon approved merging docs-only PR 20. It was merged as f1b4006 on 2026-10-19.
- Keep draft server-status PR 18 on hold: no approved full data source exists.
  Do not substitute a partial source or deploy new Worker routes.

## Release compatibility finding

The production-style preview reproduced a blank native editor for an older
saved character lacking bonus_ranks. A page-level regression reproduced the
same guideRanks exception before the fix. readActiveBuild now defaults that
absent optional map to the engine's empty-map default without overwriting the
stored JSON. The regression also asserts preservation of the original record.
