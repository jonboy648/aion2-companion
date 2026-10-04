"""Build tests/fixtures/items_small.json from real endpoint data (cache under research/items_cache)."""
import json
from pathlib import Path

from aion2c.data import build_items as b

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
]

if __name__ == "__main__":
    items = []
    for i in IDS:
        d0, _ = b.fetch_one(i, 0)
        mx = int(d0.get("maxEnchantLevel") or 0)
        dm, _ = b.fetch_one(i, mx) if mx else (None, False)
        it = b.compact(d0, dm)
        if it:
            it["slope_known"] = True
            items.append(it)
        else:
            print("missing", i)
    out = Path(__file__).with_name("items_small.json")
    out.write_text(json.dumps({"schema": 1, "items": items}, indent=1), encoding="utf8")
    for it in items:
        print(it["id"], it["name"], it["slot"], it["grade"], it["il"], it["max_enchant"], it["class_lock"],
              [(m["id"], m["v"], m.get("slope")) for m in it["main"][:2]], it["sub_random"], it["sub_count"])
