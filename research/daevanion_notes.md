# Daevanion - Sorcerer (research notes, 2026-10-03)

Output: `daevanion_sorcerer.json`.

## Coverage
- 5 boards, 537 nodes in total (89 + 89 + 89 + 117 + 153, each including 1 free Start node), 802 points in total. Costs per board are 134 / 134 / 134 / 168 / 232.
- Per node: id, name, rarity, cost, effects (value + unit), skill (key, name, id), orthogonal adjacency, grid x/y, and the game's internal code.
- Unlock levels: Nezekan 12, Zikel 20, Vaizel 30, Triniel 40, Azphel 45.
- Grids: 11x11, 11x11, 11x11, 13x13, 15x15. The Start node is at the centre.

## How the data was obtained
- Primary source: aion2t.com/daevanion?job=7. The server-rendered page embeds the full board JSON (node ids, pos_x/pos_y, grade, effects, skill ids). The site says its data comes from the official NCSOFT API.
- Independent cross-check: metaroad.gg. Its server-rendered grid is titles only, with no ids or edges. For all 537 nodes, position, rarity, cost and empty cells match aion2t exactly.
- Per-board stat totals shown by metaroad (e.g. Nezekan Defense 300, Crit 50, Attack 30; Zikel 330/50/33; Triniel 420/75/42) equal the sums of the node effects I extracted.
- Pages were fetched once each, with 3 s or longer between requests, and no private endpoints were used.

## Adjacency rule (planner-critical)
- It is taken from the aion2t planner JS logic. A node is selectable if any of its 4 orthogonal neighbours is the Start node or an already-selected node. Deselecting a node is blocked if it would disconnect other selected nodes.
- Corroboration: on every board all non-empty cells are reachable from Start via orthogonal steps. Metaroad has no edges. A search summary of thegameswiki says only "progress through adjacent nodes".
- Confidence: medium-high. This is inferred from a third-party planner, not verified in-game. Diagonals are not adjacent.

## Values and units
- Percent effects are stored by the source as hundredths: raw 150 means 1.5%. The JSON gives `value` as 1.5 with unit "%", and keeps `raw_value`.
- Flat effects have unit "flat".
- Hybrid PvP nodes carry 2 effects.
- Skill nodes use effect name = skill name, value +1.
- Names differ between sites (metaroad "Earth Robe" vs aion2t "Robe of Earth"). I used aion2t names and added skill_key slugs. Match to `sorcerer_skills.json` by skill_id or name.
- Azphel has no skill nodes (PvP and status stats only). Nezekan, Zikel, Vaizel and Triniel each have 22 skill nodes.

## Confidence
- Node layout, costs, effects and unlock levels: high (two sources agree).
- Adjacency: medium-high (see above).
- Reset cost: low. 500 Kinah per node comes from a one-line KR launch patch note (aion2hub, 2025-11-19). Global is unverified.
- Point sources: low-medium. Sealed Dungeons give 2 crystals per clear, with 61 per faction map = 122 points. This is secondhand from the earlier notes. The 802 total equals the board costs (verified).

## Gaps
- Completion buff ("Daevanion X Effects") numeric values: only the names were captured. Metaroad shows the names, and a hover or detail view was not found. `effects` is null.
- Per-board skill-level grants are an upper bound if every skill node is taken. 802 points cannot buy all of them, so the planner needs to optimise.
- Whether the +4 skill-level cap comes from Daevanion alone is unverified. The data shows at most +2 per board for any skill in Nezekan and Zikel, and +1 in Vaizel and Triniel, so the maximum from all boards for a single skill is about 4-6 depending on the skill. Check this against the cap rules.
- Extra boards: aion2t's footer claims 8 boards per class (adds Ariel, Azphel, Marchutan, Yustiel at level 45), and a search summary lists Ariel at 45. Its own Sorcerer API returns only 5 (display_order 5 missing, board id 47 absent). Unresolved whether more boards exist, are KR-only, or are not yet released.
- Korea vs Global differences are unknown. The data is likely the KR API, and the Global launch is 2026-10-05.
- Not reached: aion2.app (a landing page that links to aion2t), aion2db.gg (Vercel bot checkpoint), thegameswiki (HTTP 429), aion2hub /daevanion (404), Inven and Namu (no Daevanion-specific page found by search; the Inven page returned was about Stigma).
- Point sources from leveling and regional content are unquantified. Crystal-to-point conversion is not independently verified. Metaroad's "Currency: GoldCombined" field is unexplained.
- aion2t translations or locale pages (ko etc.) were not fetched. Korean node names are not captured.
