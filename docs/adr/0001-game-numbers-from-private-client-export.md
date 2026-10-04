# Game numbers come from a private client export; only derived numbers are committed

Skill damage, cooldowns, ranges, hit counts and item stats are taken from a private, decoded export of the game client, because the community-scraped data we started from was an older build and disagreed with the client on ratios, hit counts and flat damage. The export is NCSOFT's data, so it never enters the repo: `app/aion2c/data/client_export.py` reads it only from the `AION2_EXPORT_DIR` environment variable and writes small files of our own derived numbers (`client_skill_numbers.json`, `client_skill_details.json`, and the derived `items.json`), and `app/tests/test_client_numbers.py` fails if the export's location or a raw dump shows up in the repo.

## Consequences

- Regenerating the derived files needs a machine with the export; everyone else builds from the committed derived files, and `python -m aion2c.data.client_export --check` plus `app/tests/test_client_drift.py` catch drift without the export.
- A game patch means re-exporting and regenerating, then reviewing the drift report before shipping.
- Skills the client tables cannot match keep their previous (community-sourced) values and are listed as unmatched in the derived file.
- Server-side values (the final damage formula, rating conversions, boss stats, respawn timers) are not in the client, so they stay estimates until checked in game.
