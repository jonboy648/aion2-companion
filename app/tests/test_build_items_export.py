"""build_items `export`: the client tables -> items.json, on a tiny synthetic export (the real one is private)."""
import json
import os
from pathlib import Path

import pytest

from aion2c.data import build_items as b


def write(d: Path, name: str, rows: list[dict]) -> None:
    (d / f"{name}.json").write_text(json.dumps({"Properties": {"Data": rows}}), encoding="utf-8")


def stat(name, unit=1, div=0, order=1):
    return {"Order": order, "StatName": f"EStat::{name}", "StatUnit": unit, "DivideNumber": div}


def item(iid, cat, grade, main, subs, random, count=0, og="None", eg="None", xg="None", il=60, lvl=45, typ="Equip"):
    return {"ID": {"Value": iid}, "Desc": {"Key": f"K{iid}"}, "ItemType": f"EItemType::{typ}", "ItemLevel": il,
            "ItemGrade": f"EItemGrade::{grade}", "PermitLevelMin": lvl, "EquipCategory": f"EEquipCategory::{cat}",
            "MainStats": [{"Key": f"EStat::{k}", "Value": v} for k, v in main],
            "SubStats": [{"Key": f"EStat::{k}", "Value": {"MinValue": lo, "MaxValue": hi, "RandomWeight": w, "ValueWeight": 1}}
                         for k, lo, hi, w in subs],
            "SoulbindRandomStat": random, "SoulbindRandomStatCount": count, "MagicStoneSlotCount": 4,
            "GodStoneSlotCount": 1, "EnchantGroup": og, "EnchantEffectGroup": eg, "ExceedEnchantGroup": xg}


@pytest.fixture
def export(tmp_path):
    d = tmp_path / "Table"
    (d / "L10N" / "en-US").mkdir(parents=True)
    (d / "L10N" / "en-US" / "L10NString.json").write_text(json.dumps({"Entries": {
        "String_K1_body": "Test Spellbook", "String_K2_body": "Test Helm", "String_K3_body": "Test Grail",
        "String_K4_body": "Test Dagger"}}), encoding="utf-8")
    write(d, "StatCorrectionNumber", [
        stat("WeaponMinDamage"), stat("WeaponDamage"), stat("WeaponFixingDamage"), stat("WeaponAccuracy"),
        stat("Critical"), stat("Block"), stat("DecreaseWeaponBlock", div=1), stat("MaxWeaponBlock"),
        stat("ArmorDefense"), stat("HPMax"), stat("STR"), stat("FPMax", unit=100),
        stat("AmplifyAllDamage", div=1), stat("Time"),
    ])
    write(d, "Item", [
        item(1, "Magicbook", "Legend", [("WeaponMinDamage", 100), ("WeaponDamage", 120), ("WeaponAccuracy", 50),
                                        ("Block", 0), ("DecreaseWeaponBlock", 3300), ("MaxWeaponBlock", 100000)],
             [("STR", 10, 20, 6000), ("AmplifyAllDamage", 425, 574, 2000), ("FPMax", 29400, 33800, 4000)],
             True, 2, og="E10", eg="W10", xg="X3"),
        item(2, "Helmet", "Unique", [("ArmorDefense", 200), ("HPMax", 80)], [("STR", 5, 5, 0)], False,
             og="E5", eg="H5"),
        item(3, "ArcanaGrail", "Common", [("Time", 7)], [], False, og="A", eg="A"),
        item(4, "Dagger", "Common", [("WeaponFixingDamage", 10)], [], False),
        item(5, "Material", "Common", [], [], False, typ="Material"),
    ])
    lv = lambda g, n, step: [{"Group": g, "Level": i, "StatList": step(i)} for i in range(1, n + 1)]  # noqa: E731
    write(d, "EnchantEffect",
          lv("W10", 4, lambda i: [{"StatType": "EStat::WeaponMinDamage", "StatValue": i * i},
                                  {"StatType": "EStat::WeaponDamage", "StatValue": i * i + 2}])
          + lv("H5", 2, lambda i: [{"StatType": "EStat::ArmorDefense", "StatValue": 10 * i},
                                   {"StatType": "EStat::HPMax", "StatValue": 7 * i}]))
    rows = lambda g, probs: [{"Group": g, "CurrentLevel": i, "SuccessProb": p} for i, p in enumerate(probs)]  # noqa: E731
    write(d, "Enchant", rows("E10", [10000, 10000, 6500, 5000, 0]) + rows("E5", [10000, 10000, 0]) + rows("A", []))
    write(d, "ExceedEnchant", [
        {"Group": "X3", "CurrentLevel": 0, "SuccessProb": 6600, "AdditionalStatName": "None"},
        {"Group": "X3", "CurrentLevel": 1, "SuccessProb": 5000, "AdditionalStatName": "X3_1"},
        {"Group": "X3", "CurrentLevel": 2, "SuccessProb": 0, "AdditionalStatName": "X3_2"},
    ])
    write(d, "AdditionalStat", [
        {"Name": "X3_1", "AdditionalStats": [{"Type": "EStat::WeaponFixingDamage", "Value": 14},
                                             {"Type": "EStat::AmplifyAllDamage", "Value": 100}]},
        {"Name": "X3_2", "AdditionalStats": [{"Type": "EStat::WeaponFixingDamage", "Value": 28},
                                             {"Type": "EStat::AmplifyAllDamage", "Value": 250}]},
    ])
    return d


def test_export_dir_fails_clearly_when_unset(monkeypatch):
    monkeypatch.delenv(b.ENV_VAR, raising=False)
    with pytest.raises(SystemExit, match="AION2_EXPORT_DIR is not set"):
        b.export_dir()


def test_export_dir_checks_the_tables(monkeypatch, tmp_path):
    monkeypatch.setenv(b.ENV_VAR, str(tmp_path))
    with pytest.raises(SystemExit, match=r"missing Item\.json"):
        b.export_dir()


def test_export_dir_accepts_a_complete_directory(monkeypatch, export):
    monkeypatch.setenv(b.ENV_VAR, str(export))
    assert b.export_dir() == export


def test_items_are_derived_in_our_schema(export):
    doc = b.build_from_export(export)
    items = {i["id"]: i for i in doc["items"]}
    assert set(items) == {1, 2, 3, 4}  # the Material row is not gear
    book = items[1]
    assert (book["name"], book["slot"], book["grade"], book["class_lock"]) == ("Test Spellbook", "weapon", "Epic", ["Sorcerer"])
    assert (book["il"], book["equip_level"], book["mana_slots"], book["god_slots"]) == (60, 45, 4, 1)
    assert (book["sub_random"], book["sub_count"], book["max_enchant"], book["max_exceed"]) == (True, 2, 4, 2)
    # Min/Max attack folds into one line; zero Block and the block caps are not main stats; accuracy keeps its value
    assert book["main"][0] == {"id": "WeaponFixingDamage", "v": 120, "min": 100, "slope": 4.25}
    assert [m["id"] for m in book["main"]] == ["WeaponFixingDamage", "WeaponAccuracy"]
    # percent stats are raw / 100 (5.74), FP-type raw / 100 (338), the rest raw; every line keeps its draw weight
    subs = {s["id"]: s for s in book["subs"]}
    assert subs["STR"] == {"id": "STR", "v": 20, "min": 10, "w": 6000}
    assert subs["AmplifyAllDamage"] == {"id": "AmplifyAllDamage", "v": 5.74, "min": 4.25, "w": 2000}
    assert subs["FPMax"]["v"] == 338 and subs["FPMax"]["min"] == 294
    assert items[2]["class_lock"] == [] and items[2]["subs"] == [{"id": "STR", "v": 5, "min": 5, "w": 0}]
    assert items[4]["main"] == [{"id": "WeaponFixingDamage", "v": 10}] and items[4]["class_lock"] == ["Assassin"]
    assert items[3]["slot"] == "arcana" and items[3]["max_enchant"] == 0 and "enchant_group" not in items[3]
    assert [i["id"] for i in doc["items"]] == [1, 2, 3, 4]


def test_enchant_series_odds_and_exceed_tables(export):
    doc = b.build_from_export(export)
    # per-level cumulative bonus; Min and Max attack fold into one WeaponFixingDamage series (their mean)
    assert doc["enchant_series"]["W10"] == {"WeaponFixingDamage": [2, 5, 10, 17]}
    assert doc["enchant_series"]["H5"] == {"ArmorDefense": [10, 20], "HPMax": [7, 14]}
    assert "A" not in doc["enchant_series"]  # an item with no effect rows has no series
    # success % of going +0->+1 ... +3->+4 (the last row is the cap, not a step)
    assert doc["enchant_odds"]["E10"] == [100, 100, 65, 50] and doc["enchant_odds"]["E5"] == [100, 100]
    assert doc["exceed"] == {"X3": {"odds": [66, 50], "levels": [
        {"WeaponFixingDamage": 14, "AmplifyAllDamage": 1}, {"WeaponFixingDamage": 28, "AmplifyAllDamage": 2.5}]}}
    book = next(i for i in doc["items"] if i["id"] == 1)
    assert (book["enchant_group"], book["odds_group"], book["exceed_group"]) == ("W10", "E10", "X3")


def test_icon_and_sources_are_carried_over_by_id(export):
    prev = {1: {"id": 1, "icon": "Icon_Old", "sources": ["Crafting"]}}
    items = {i["id"]: i for i in b.build_from_export(export, prev)["items"]}
    assert items[1]["icon"] == "Icon_Old" and items[1]["sources"] == ["Crafting"]
    assert "icon" not in items[2] and items[2]["sources"] == []  # not in the client tables, nothing to carry


def test_export_loads_into_the_gear_engine(export):
    from aion2c import gear
    items = gear.attach_tables(b.build_from_export(export))
    book = items[1]
    assert gear.enchant_bonus(book, 3) == {"WeaponFixingDamage": 10}
    assert gear.exceed_lines(book, 2) == {"WeaponFixingDamage": 28, "AmplifyAllDamage": 2.5}
    assert gear.enchant_odds(book) == [100, 100, 65, 50] and gear.exceed_odds(book) == [66, 50]


@pytest.mark.skipif(not os.environ.get(b.ENV_VAR) or not b.OUT.exists(), reason="needs AION2_EXPORT_DIR and items.json")
def test_committed_items_json_is_what_the_export_builds():
    prev = json.loads(b.OUT.read_text(encoding="utf8"))
    doc = b.build_from_export(b.export_dir(), {i["id"]: i for i in prev["items"]})
    assert doc == prev
