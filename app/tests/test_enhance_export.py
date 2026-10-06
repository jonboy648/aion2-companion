"""enhance_export: client tables -> web/public/data/enhance.json, on a tiny synthetic export (the real one is private),
plus the drift guard between the committed enhance.json and items.json."""
import json
import os
from pathlib import Path

import pytest

from aion2c.data import build_items as bi
from aion2c.data import enhance_export as ee

KINAH = ee.KINAH


def write(d: Path, name: str, rows: list[dict]) -> None:
    (d / f"{name}.json").write_text(json.dumps({"Properties": {"Data": rows}}), encoding="utf-8")


def step(group, lv, prob, fc, gold, items, pen=0):
    return {"Group": group, "CurrentLevel": lv, "SuccessProb": prob, "FailCorrectionProb": fc, "FailPenalty": pen,
            "CostGold": gold, "CostCurrencyType": KINAH,
            "CostItems": [{"Item": n, "Count": c, "EnchantedLevel": 0} for n, c in items]}


def item(iid, key, cat, grade, il, og="None", xg="None", sg="None", sb="None", sa="None", typ="Equip", name=None):
    return {"ID": {"Value": iid}, "Name": name or f"n{iid}", "Desc": {"Key": key}, "ItemType": f"EItemType::{typ}",
            "ItemLevel": il, "ItemGrade": f"EItemGrade::{grade}", "EquipCategory": f"EEquipCategory::{cat}",
            "EnchantGroup": og, "ExceedEnchantGroup": xg, "SurpassGroup": sg, "SoulbindCostName": sb, "SoulAddGroup": sa}


@pytest.fixture
def export(tmp_path):
    d = tmp_path / "Table"
    (d / "L10N" / "en-US").mkdir(parents=True)
    (d / "L10N" / "en-US" / "L10NString.json").write_text(json.dumps({"Entries": {
        "String_K1_body": "Test Blade", "String_K2_body": "Test Rune", "String_K3_body": "Test Scrap",
        "String_KCOIN_body": "Test Stone", "String_KAMP_body": "Test Amp", "String_KSCROLL_body": "Test Scroll",
        "String_KSB_body": "Test Codex", "String_KSA_body": "Test Soul Add"}}), encoding="utf-8")
    write(d, "Item", [
        item(1, "K1", "Greatsword", "Unique", 102, og="E_U", xg="X_U", sg="S_U", sb="Unique_Cost", sa="SA_U"),
        item(2, "K2", "Rune", "Unique", 40, og="R_U"),
        item(3, "K3", "Ring", "Legend", 30),  # nothing to upgrade: not listed
        item(4, "K3", "Ring", "Rare", 30, og="E_END"),  # only a terminal row: nothing to upgrade, not listed
        item(9, "KCOIN", "Ring", "Rare", 1, typ="Etc", name="CoinEnchant"),
        item(10, "KAMP", "Ring", "Rare", 1, typ="Etc", name="Amp"),
        item(11, "KSCROLL", "Ring", "Rare", 1, typ="Etc", name="Scroll"),
        item(12, "KSB", "Ring", "Rare", 1, typ="Etc", name="Codex"),
        item(13, "KSA", "Ring", "Rare", 1, typ="Etc", name="SoulAdd"),
    ])
    write(d, "Enchant", [
        step("E_U", 0, 10000, 0, 100, [("CoinEnchant", 5)]),
        step("E_U", 1, 6500, 500, 200, [("CoinEnchant", 10)]),
        step("E_U", 2, 0, 0, 0, []),
        step("R_U", 0, 8000, 0, 50, [("CoinEnchant", 2), ("Scroll", 1)], pen=-1),
        step("R_U", 1, 0, 0, 0, []),
        step("E_END", 0, 0, 0, 0, []),
        step("UNUSED", 0, 5000, 0, 1, []), step("UNUSED", 1, 0, 0, 0, []),
    ])
    write(d, "ExceedEnchant", [step("X_U", 0, 6600, 500, 600000, [("Amp", 6)]), step("X_U", 1, 5000, 400, 900000, [("Amp", 9)]),
                               step("X_U", 2, 0, 0, 0, [])])
    write(d, "ItemSurpass", [step("S_U", 0, 10000, 0, 0, [("CoinEnchant", 1)]), step("S_U", 1, 0, 0, 0, [])])
    write(d, "SoulBindCost", [{"Name": "Unique_Cost", "RerollCostCount": 300000, "RerollCostItem": "Codex",
                               "RerollCostItemCount": 3,
                               "CostDatas": [{"CostA_Id": "GoldCombined", "CostA_Amount": 30000, "CostB_Id": "Codex", "CostB_Amount": 10},
                                             {"CostA_Id": "GoldCombined", "CostA_Amount": 42000, "CostB_Id": "Codex", "CostB_Amount": 12}]}])
    write(d, "ItemSoulAdd", [{"Group": "SA_U", "SuccessProb": 10000, "CostGold": 1000000, "CostCurrencyType": KINAH,
                              "CostItem": "SoulAdd", "CostItemCount": 2}])
    return d


def test_export_dir_fails_clearly_when_unset(monkeypatch):
    monkeypatch.delenv(ee.ENV_VAR, raising=False)
    with pytest.raises(SystemExit, match="AION2_EXPORT_DIR"):
        ee.export_dir()


def test_export_dir_checks_the_tables(monkeypatch, tmp_path):
    monkeypatch.setenv(ee.ENV_VAR, str(tmp_path))
    with pytest.raises(SystemExit, match="ItemSurpass.json"):
        ee.export_dir()


def test_steps_pity_penalty_and_costs(export):
    doc = ee.build(export)
    mats = doc["materials"]
    coin, scroll = mats.index("Test Stone"), mats.index("Test Scroll")
    assert doc["enchant"]["E_U"] == [[10000, 0, 0, 100, [[coin, 5]]], [6500, 500, 0, 200, [[coin, 10]]]]  # terminal row dropped
    assert doc["enchant"]["R_U"] == [[8000, 0, 1, 50, [[coin, 2], [scroll, 1]]]]  # client -1 -> drop one level
    assert doc["exceed"]["X_U"][1][:4] == [5000, 400, 0, 900000]
    assert doc["surpass"]["S_U"] == [[10000, 0, 0, 0, [[coin, 1]]]]
    assert doc["soulbind"]["Unique_Cost"]["steps"][1] == [42000, [[mats.index("Test Codex"), 12]]]
    assert doc["soulbind"]["Unique_Cost"]["reroll"][0] == 300000
    assert doc["souladd"]["SA_U"][:2] == [10000, 1000000]


def test_only_upgradeable_items_and_used_groups_are_kept(export):
    doc = ee.build(export)
    assert [dict(zip(ee.ITEM_FIELDS, r)) for r in doc["items"]][0] == {
        "id": 1, "name": "Test Blade", "il": 102, "grade": "Unique", "slot": "weapon", "enchant": "E_U",
        "exceed": "X_U", "surpass": "S_U", "soulbind": "Unique_Cost", "souladd": "SA_U"}
    assert [r[0] for r in doc["items"]] == [1, 2]  # 3 has nothing, 4 only a terminal row, 9.. are not equipment
    assert set(doc["enchant"]) == {"E_U", "R_U"}  # UNUSED and E_END are not carried
    assert doc["items"][1][3] == "Unique" and doc["items"][1][4] == "rune"
    assert "Properties" not in ee.dump(doc) and "CostItems" not in ee.dump(doc)


def test_client_grade_legend_is_our_epic(export):
    rows = json.loads((export / "Item.json").read_text())["Properties"]["Data"]
    rows[0]["ItemGrade"] = "EItemGrade::Legend"
    write(export, "Item", rows)
    assert ee.build(export)["items"][0][3] == "Epic"


def test_unknown_currency_and_positive_penalty_are_rejected(export):
    rows = json.loads((export / "Enchant.json").read_text())["Properties"]["Data"]
    rows[1]["CostCurrencyType"] = "ECurrencyCategory::Other"
    write(export, "Enchant", rows)
    with pytest.raises(ValueError, match="currency"):
        ee.build(export)
    rows[1]["CostCurrencyType"] = KINAH
    rows[1]["FailPenalty"] = 2
    write(export, "Enchant", rows)
    with pytest.raises(ValueError, match="FailPenalty"):
        ee.build(export)


def test_material_without_an_english_name_is_rejected(export):
    rows = json.loads((export / "Enchant.json").read_text())["Properties"]["Data"]
    rows[0]["CostItems"][0]["Item"] = "NoSuchItem"
    write(export, "Enchant", rows)
    with pytest.raises(ValueError, match="NoSuchItem"):
        ee.build(export)


# ---- committed files ----------------------------------------------------------------------------------------------

COMMITTED = json.loads(ee.OUT.read_text(encoding="utf-8")) if ee.OUT.is_file() else None
needs_file = pytest.mark.skipif(COMMITTED is None, reason="enhance.json not built")


@needs_file
def test_committed_file_is_small_and_has_only_our_keys():
    assert ee.OUT.stat().st_size < 1_000_000
    assert set(COMMITTED) == {"schema", "source", "fields", "materials", "items", "enchant", "exceed", "surpass",
                              "soulbind", "souladd"}
    text = ee.OUT.read_text(encoding="utf-8")
    assert "Properties" not in text and "CostItems" not in text and "FailCorrectionProb" not in text
    for track in ("enchant", "exceed", "surpass"):
        for g, steps in COMMITTED[track].items():
            for s in steps:
                assert len(s) == len(ee.STEP_FIELDS) and 0 <= s[0] <= 10000 and s[2] in (0, 1), (g, s)


@needs_file
def test_committed_file_agrees_with_items_json():
    """Drift guard, no export needed: names, levels, groups and success odds equal what items.json carries."""
    assert ee.check(COMMITTED, json.loads(bi.OUT.read_text(encoding="utf-8"))) == []


@needs_file
def test_check_fails_on_a_tampered_value():
    items_doc = json.loads(bi.OUT.read_text(encoding="utf-8"))
    bad = json.loads(json.dumps(COMMITTED))
    g = next(iter(bad["enchant"]))
    bad["enchant"][g][0][0] += 1
    assert any("odds" in p for p in ee.check(bad, items_doc))


@needs_file
def test_known_game_values():
    """Unique IL102 (Ludra's Blade): +10..+14 at 65/50/35/25/20% with 5% pity, 14,820 stones at +14; exceed 66..20%."""
    e = COMMITTED["enchant"]["Enchant_Unique_102"]
    assert [s[0] for s in e[10:]] == [6500, 5000, 3500, 2500, 2000] and {s[1] for s in e[10:]} == {500}
    assert e[14][3] == 1860000 and e[14][4][0][1] == 14820 and COMMITTED["materials"][e[14][4][0][0]] == "Enhance Stone"
    assert [s[:3] for s in COMMITTED["exceed"]["Weapon_Unique_102"]] == [
        [6600, 500, 0], [5000, 400, 0], [3300, 300, 0], [2500, 200, 0], [2000, 100, 0]]
    rune = COMMITTED["enchant"]["Rune_PvE_Unique"]
    assert rune[1][:3] == [8000, 0, 1] and len(rune) == 10  # the only group that loses a level on failure


@pytest.mark.skipif(not os.environ.get(ee.ENV_VAR), reason="needs AION2_EXPORT_DIR")
@needs_file
def test_committed_file_is_what_the_export_builds():
    assert ee.build(ee.export_dir()) == COMMITTED
