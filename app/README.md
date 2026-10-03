# aion2c - Aion 2 Companion (all eight classes)

Read-only advisor: computes skill priorities, upgrade value, key layouts and macro sheets.
It NEVER sends keystrokes or mouse events to the game and never reads game memory or packets.

Run: `python -m aion2c` (add `--fake-engine` for the stub engine, `--smoke` for a headless render check).
Tests: `python -m pytest -q` (offscreen Qt, no network).

Per-class data lives in `aion2c/data/classes/<class>/` (`gamedata.json` + `icons/`); the toolbar class picker lists the
classes that have a `gamedata.json`. Build them with `python -m aion2c.data.build_gamedata --class <key>` or `--all`
(inputs: `research/classes/<key>/`, `assets/icons/<key>/`; Sorcerer keeps its original research files). Class-specific
behaviour (manual skills, G-key plan, utility roles) is data, as `skill_tags` in the class's `mechanics.json`:
`manual`, `role:<defense|cc|burst|mobility|sustain>`, `gkey:G2:M1:0` (G-key, mode, preference order), `thumb:1`.

Icons are NCSOFT art for personal use: do not commit `assets/` or `aion2c/data/classes/*/icons` to a public repo.
See `D:\Aion2\PLAN.md` for the build plan and ownership.
