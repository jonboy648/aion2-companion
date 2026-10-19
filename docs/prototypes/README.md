# Native macro preview

Throwaway configuration prototype on `codex/native-macro-rules`. Open
`native-macro.html` directly; there is no server, installation, game input,
localStorage write, or production integration.

Question: does the four-row placement grid, separate Quick Use bar, and linked
macro-entry editor reproduce the relationship shown in Jon's screenshots?
Selecting a column adds one entry, not one entry for each skill in its stack.
Changing preview availability changes the displayed hotbar skill while leaving
the configured macro target linked to the column.

The three/four-entry examples use the supplied macro names, ranks and delays.
Other grid cells are an illustrative screenshot-based fixture, not a verified
legal placement recommendation or an imported current hotbar. The per-column
target is the model under review, not proof of the game's persisted schema.
No runtime queue, retry scheduling, macro timing or DPS is simulated.

```powershell
node --test docs/prototypes/native-macro.preview.test.cjs
```

2026-10-12: 12 checks pass, after observed red failures. Browser clicks checked
adding a multi-skill column, linked availability changes, and both presets.
At 390 px: no page overflow or clipped inspected labels; the picker stays in
the viewport, Escape closes it and returns focus, and the grid scrolls with
arrow keys. All image assets loaded on desktop. Initial screenshot capture
failed while the browser window was minimized; restoring the authorized
preview window resolved it. Desktop and full-page 390 px screenshots were
then inspected for readable controls and overlapping content. The preview
is left open at desktop size for Jon's review.

Decision pending that review. Production plan/release approval is separate.
