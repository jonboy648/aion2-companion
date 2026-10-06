"""build_itemdb: items.json -> the per-category files the item database pages load."""
import json

import pytest

from aion2c.data import build_itemdb as b

ITEMS = json.loads((b.DATA / "items.json").read_text(encoding="utf-8"))


def it(iid, slot, cls=(), **kw):
    base = {"id": iid, "name": f"I{iid}", "slot": slot, "grade": "Epic", "il": 60, "equip_level": 45, "class_lock": list(cls),
            "max_enchant": 0, "main": [], "subs": [], "sources": []}
    base.update(kw)
    return base


def doc(*items):
    return {"source": "t", "items": list(items), "enchant_series": {"G": {"HPMax": [1, 2]}}, "enchant_odds": {"O": [50, 25]},
            "exceed": {"X": {"odds": [10], "levels": [{"HPMax": 5}]}}}


def test_every_real_item_has_a_category_and_lands_in_exactly_one_file():
    files = b.build(ITEMS)
    ids = [r["id"] for k, v in files.items() if k.startswith("cat/") for r in v["items"]]
    assert len(ids) == len(set(ids)) == len(ITEMS["items"])
    detail = {int(i) for k, v in files.items() if k.startswith("detail/") for i in v["items"]}
    assert detail == set(ids)
    assert sum(c["count"] for g in files["index.json"]["groups"] for c in g["cats"]) == len(ids)


def test_weapons_split_by_class_and_offhand_is_guard():
    assert b.category_of(it(1, "weapon", ["Gladiator"])) == "greatsword"
    assert b.category_of(it(2, "weapon", ["Sorcerer"])) == "spellbook"
    assert b.category_of(it(3, "offhand")) == "guard"
    assert b.category_of(it(4, "legs")) == "pants"
    assert b.category_of(it(5, "weapon", ["Nobody"])) is None
    with pytest.raises(ValueError):
        b.build(doc(it(5, "weapon", ["Nobody"])))


def test_slim_row_keeps_main_min_attack_and_the_best_roll_of_listed_stats():
    row = b.slim(it(7, "weapon", ["Templar"], icon="Ico", main=[{"id": "WeaponFixingDamage", "v": 600, "min": 446}, {"id": "Critical", "v": 150}],
                    subs=[{"id": "CombatSpeed", "v": 12, "min": 9}, {"id": "CombatSpeed", "v": 14, "min": 9}, {"id": "STR", "v": 30, "min": 20}]))
    assert row == {"id": 7, "n": "I7", "g": "Epic", "il": 60, "el": 45, "i": "Ico", "c": "Templar",
                   "m": {"WeaponFixingDamage": 600, "Critical": 150}, "mn": 446, "p": {"CombatSpeed": 14}}


def test_detail_carries_only_the_enchant_tables_its_items_use_and_runs_resolve_ids():
    d = doc(it(10, "ring", enchant_group="G", odds_group="O", exceed_group="X", slope_known=True), it(11, "ring"), it(12, "belt"))
    files = b.build(d)
    ring = files["detail/ring.json"]
    assert "slope_known" not in ring["items"]["10"]
    assert ring["enchant"] == {"series": d["enchant_series"], "odds": d["enchant_odds"], "exceed": d["exceed"]}
    assert files["detail/belt.json"]["enchant"] == {"series": {}, "odds": {}, "exceed": {}}
    assert files["index.json"]["runs"] == [[10, 11, "ring"], [12, 12, "belt"]]


def test_write_removes_stale_files(tmp_path):
    (tmp_path / "cat").mkdir()
    (tmp_path / "cat" / "old.json").write_text("{}")
    sizes = b.write(doc(it(10, "ring")), tmp_path)
    assert not (tmp_path / "cat" / "old.json").exists() and sizes["cat/ring.json"] > 0
