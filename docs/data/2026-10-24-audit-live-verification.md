# Audit release: live verification

Verified Oct 24, 2026. [PR 42](https://github.com/jonboy648/aion2-companion/pull/42)
merged as `30d126b6d6351a965229b5a1e6e5c143069bc441`.
[Pages run 40109544544](https://github.com/jonboy648/aion2-companion/actions/runs/40109544544)
completed successfully: build 4m14s, deployment 21s.

## Release identity and gates

- Public `/engine/manifest.json` reports `2f572d03c879`, matching the fingerprint
  independently calculated from the committed Git/Linux input bytes, with all
  eight classes. Windows working-copy fingerprint remains `0a9482e9c2c6` because
  line endings are part of the byte hash; this is not a different game patch.
- Local pre-merge checks: 115 Pages Python tests passed / 1 skipped, 767 web
  tests passed, 7 map guards and 2 privacy guards passed, source audit had zero
  errors across 43 artifacts. All 19 public/dist engine files matched.
- Strict TypeScript/site build prerendered 9,318 files. Full map packaging passed:
  local combined artifact 483.1 MB; CI artifact 484.1 MB, including corresponding
  map source. Existing chunk-size warnings remain.
- CI passed its expanded Python, source audit, complete web, map packaging,
  production site and map-build gates. No Worker deployment was needed.
- The existing-main Chanter timing failure remains open in
  [issue 43](https://github.com/jonboy648/aion2-companion/issues/43), under Jon's
  explicit accepted release exception. This report does not claim a green full
  Python suite or changed game numbers.

## Public browser workflows

- Home rendered scenery, crest and class art. The refreshed ordinary Home URL
  served `/assets/index-BwtSgBqO.js`; client navigation to DarthThot loaded the
  current chart chunks with HTTP 200 and rendered the chart SVG, with no console
  errors. Desktop 1440x1000 and mobile 390x844 had no document overflow.
- DarthThot, NA East / Global Triniel 2103, level 45: imported **211/211** opened
  nodes. One character card, one selected plan and one stat sheet rendered.
  All 75 character-page images loaded. The sheet reproduced **26/26** reported
  effect lines; **0/16** attribute totals matched from known public sources before
  estimated hidden-source filling. This remains an explicit uncertainty.
- The page returned modeled Current/Best DPS, not measured combat results.
  The new Damage/Stagger objectives and full redistribution workflow are not
  implemented by this release.
- A real lookup for server 9999 rejected the wrong-server identity instead of
  substituting Triniel; zero old cards/sheets/plans remained and stored imported
  character context was null.
- The real map rendered its zone controls and four loaded tiles at the inspected
  viewport. A local QA pin was created and saved. Intentionally denying clipboard
  writes exposed the share-link input; its decoded payload held the zone, one
  pin, coordinates and label. Opening that link showed the same zone and label.
  Native OS clipboard access and an empty-profile import were not established by
  that browser check; automated party-codec tests also passed.

## Residual observations and next work

- A Home document cached before deployment referenced old lazy chart hashes and
  produced 404s. Refreshing to the current document resolved them. Track graceful
  stale-chunk handling under release audit #40; do not describe old open tabs as
  automatically upgraded.
- Initial map translation requests for `markers/undefined.yaml` and
  `regions/undefined.yaml` produced non-fatal 404s before map selection settled.
  The map code is unchanged by this release; retain the finding for map audit #36.
- Direct character URLs use GitHub Pages' custom 404 SPA shell and can therefore
  carry HTTP 404 while the client renders successfully. Character pages remain
  noindex; the tested Home-to-character client route avoids that document error.
- Source provenance is still a historical Global export with unknown original
  patch. No Korea/Taiwan or live combat accuracy is established here.
- The separate [combo source audit](../../research/2026-10-24-sorcerer-combo-objectives.md)
  verifies useful skill connections and identifies missing conditional, charge
  timing, horizon and stagger modeling. It is research, not shipped mechanics.
