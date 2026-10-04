"""Build tests/fixtures/items_small.json: a handful of real items cut out of app/aion2c/data/items.json, with only the
enchant/odds/Exceed tables they reference. Re-run after regenerating items.json:  python tests/fixtures/make_items_small.py
(from app/)."""
import json
from pathlib import Path

ITEMS = Path(__file__).parents[2] / "aion2c" / "data" / "items.json"

IDS = [
    110520003,  # Ludra's Grimoire (Sorcerer, Unique IL 102?)
    110540035,  # Liberator Spellbook (DarthThot's)
    110540053,  # Lunatic Spellbook (Epic, reachable)
    110530045,  # Splendent Wise Dragon Lord Spellbook
    110120003,  # Ludra's Blade (Gladiator-locked)
    115040035,  # Liberator Guard
    210140035,  # Liberator Breastplate
    210130040,  # Splendent Dragon Lord Breastplate
    215250001,  # Noble Belt (Epic)
    215230001,  # Noble Belt (Unique)
    310140024,  # Silent Necklace
    310130040,  # Splendent Dragon Lord Necklace
    311050001,  # Revelation Amulet
    310460006,  # Old Mercenary Commander Bracelet
    310130023,  # Wise Dragon Lord Necklace (Unique IL 94, Exceed up to +5)
]

if __name__ == "__main__":
    doc = json.loads(ITEMS.read_text(encoding="utf8"))
    by_id = {it["id"]: it for it in doc["items"]}
    items = [by_id[i] for i in IDS]
    out = {"schema": doc["schema"], "items": items}
    for table, key in (("enchant_series", "enchant_group"), ("enchant_odds", "odds_group"), ("exceed", "exceed_group")):
        out[table] = {g: doc[table][g] for g in sorted({it[key] for it in items if key in it})}
    dest = Path(__file__).with_name("items_small.json")
    dest.write_text(json.dumps(out, indent=1), encoding="utf8")
    for it in items:
        print(it["id"], it["name"], it["slot"], it["grade"], it["il"], it["max_enchant"], it.get("max_exceed", 0))
