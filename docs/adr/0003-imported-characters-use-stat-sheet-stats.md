# Imported characters use the stat sheet's stats, and the page shows the build as imported next to the plan

The site showed 21,190 boss DPS for a character who measures about 7,000 in game. Two causes (research/stat_sheet_dps_calibration_2026-10-05.md): the headline was the optimizer's plan, not the character as played, and the engine ran every import with the placeholder `attack` 1000 and `max_mp` 2000 (and the optimizer also subtracted the equipped gear from that placeholder, leaving a phantom 450 attack in every "best build").

- `statsheet.engine_stats` turns the rebuilt stat sheet into `Stats` fields and `statsheet.apply_to_build` applies them on import (web and desktop). Weapon attack, Amp Ratio attack, weapon damage boost, damage boost, crit damage, crit rating, double chance, combat speed, cooldown, penetration and MP now come from the sheet. MP regen, PvE and Boss damage and target defense have no sheet source and keep their incoming values.
- Daevanion is left out of the fields `STAT_MAP` already maps, because `daevanion.apply_stats` adds opened nodes itself. MP, crit rating, double chance, weapon damage and Amp Ratio have no node mapping, so their Daevanion share is kept.
- Attack Bonus is not added to `attack` until its use in the formula is measured on a dummy (note 3.3). Perfect, Multi-hit, flat PvE/Boss attack and boss defense get no new terms: the note gives no defensible formula.
- `compare` / `optimize` return `current_dps` beside `result.dps`; the page labels them "Current build" and "Best build with your gear".
- Manual builds default to attack 550 and MP 1000 (the low end of the three real sheets). `Stats()` keeps its 1000 / 2000 contract defaults.

## Consequences

- Old numbers are not comparable: DarthThot's boss plan drops from 21.2k to 15.9k with every Daevanion point (fixture) and from 15.1k to 10.9k with none (the live site), and the as-imported figure is 9.4k with a searched rotation. The browser result cache is keyed on the bundled engine's content hash (`manifest.engine_version`) so old results are never served.
- The sheet is a reconstruction (random sub-lines at expected value), so imported stats are estimates; the current-build figure still sits above the measured 7k because boss defense, tolerance, accuracy and Perfect are unmodelled.
