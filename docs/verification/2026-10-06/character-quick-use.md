# Character and Quick Use verification

Branch: codex/level-planner-acceptance. Preview: http://127.0.0.1:5198/keybinds

- Final web suite: 716 tests, 76 files, all pass.
- Full Python suite: 1016 passed, 8 skipped, 1 xfailed, 1 xpassed. Following the derived Spiritmaster alias correction, affected Quick Use/archive suite: 30 passed.
- Final npm run build: TypeScript, Vite and 9318 prerendered files pass. Existing large-chunk warning remains. Main JS 787.79 kB (gzip 240.61), CSS 135.65 kB (gzip 25.02).
- Browser uses real Pyodide worker and local official-armory proxy, not fixture mode. DarthThot imports 108/108 nodes; Luna imports 9/9 with no previous-character profile retained. Ordinary Daevanion navigation resumes the current import; explicit blank planner opens 0/88.
- Rebinding persists across reload. Duplicate primary bindings show an alert and are excluded from macros. Delay controls clamp to 10..9900. Copy setup sheet preserves actual action identities.
- Desktop 1440 and mobile 390 CSS-pixel widths checked: no page-wide overflow. Intentional hotbar scrolling works with keyboard focus and ArrowRight. Screenshots: quick-use-desktop.jpg and quick-use-mobile.jpg.
- Derived client action data has schema, size and raw-field guards; changing its contents changes the engine fingerprint. Client version remains unverified, not invented.

## Remaining In-Game Boundary

The website does not claim sequential runtime order or macro DPS. Mouse bindings and mode-specific alternate bindings require an in-game control-mode check. Follow research/quick-use-ingame-validation-2026-10-06.md before claiming runtime macro validation. No push or deployment performed.
