# Same-gear redistribution: source connections and remaining gaps

Read-only source inspection on Oct 29, 2026. Derived facts and references only;
no raw exports, protected configuration, keys or private gameplay captures added.

## Paid ranks

The public armory fixture skill rows contain acquired, category, equip, icon, id,
name, needLevel and skillLevel. They have no distinct paid-base-rank field or complete
bonus breakdown. The importer subtracts matched Daevanion bonuses, while the
model adds current node bonuses and user-entered Arcana/Soul Binding bonuses
separately. These are useful simulation inputs, not proof of refundable purchases.

Questlog research identifies skillSlot.lvl/snapshot.level, equipped-level overrides,
Arcana subSkills[].lvl, equipment skill substats and Daevanion level increases.
The complete combination and purchased-versus-bonus separation remain unproven.
See questlog_0_1_36_builder_findings.md and questlog_installed_rea_2026-10-19.md.

Independent cost witnesses in the Global model:

- Core ranks 8 + 5 cost 13 + 5 = 18; rank 1 is free, rank 10 costs 21.
- Stigma ranks 3 + 6 cost 3 + 7 = 10; rank 1 costs 1, rank 20 costs 75.
- Assassin Quick Slice rank 7 costs 9; Breaking/Swift Slice add no purchase.
- Acquisition evidence must exist for the requested rank: Dodge has only rank 1,
  so a reported Dodge rank 10 is unknown, not a 21-point investment.

## Daevanion and imported stats

Mapped node effects are added by daevanion.apply_stats, so clearing nodes removes
those effects without another subtraction. Rank bonuses likewise follow selected
nodes automatically. However, statsheet.engine_stats retains some unmapped node
contributions, including MP and critical rating where present. Bare CharacterBuild
does not retain a complete source book. Recomputing against unchanged armory totals
can also reintroduce removed contributions through calibration. Full reassignment
must resolve that provenance rather than simply clear the nodes and retain stats.

Point cost is distinct by board currency. Free start nodes cost 0. The preflight
checks current node connectivity, board unlocks and known IDs; it never turns a
sum across both currencies into one wallet. Global evidence does not certify
Korean costs.

## Reset evidence: snapshot, not current tariff

English client UI text at
`D:/Aion2-tools/export-test/out/AION2/Content/Data/Table/L10N/en-US/L10NString.json:123961`
says board reset consumes a supplied Kina amount and refunds used crystals. The
German translation explicitly refers to all used crystals. This supports intended
refund behavior in this export, not verified live server amounts.

`DaevanionNode.ResetGold` has 500-value positive-cost witnesses (one independently
checked at DaevanionNode.json:1075); the source investigation also found 0 on free
rows and GoldCombined as the board reset currency. This does not establish the
current Global tariff, how a board-total fee is calculated, or the original export's
live patch. The prior Korean-launch 500-per-node claim remains unverified for live
Global. Keep these source facts separate from any confirmed resource credit.

## Next contract work

Preserve the imported baseline and current gear. Retain unknown spare points as
unknown. Establish paid-rank/bonus provenance and node-dependent stat rebasing, then
add a complete redistribution plan with explicit reset assumptions/costs. The new
allocation_resources API is an acquisition-cost inventory only; it intentionally
does not expose a refundable wallet or enable a reset.
