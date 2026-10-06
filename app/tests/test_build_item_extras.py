"""build_item_extras: item sets and non-equipment items from the client tables (tiny synthetic export; the real one is private),
plus the ADR 0001 guards for the derived files."""
import json
import re
from pathlib import Path

import pytest

from aion2c.data import build_item_extras as x
from aion2c.data import build_itemdb as idb
from aion2c.data import build_items as b

DATA = Path(x.__file__).parent
FORBIDDEN_RAW_KEYS = ("Properties", "EnchantEffectGroup", "DecomposeResultItemGroup", "SoundMaterial", "DropMeshKey",
                      "CanLock", "ExchangeType", "SellPrice", "AutoUsingAbnormalGroupID", "UseEffectValues")


def write(d: Path, name: str, rows: list[dict]) -> None:
    (d / f"{name}.json").write_text(json.dumps({"Properties": {"Data": rows}}), encoding="utf-8")


def row(iid, typ, name, desc="None", cat_key=None, cat="None", grade="Common", icon="Icon_X", lvl=1, **kw):
    r = {"ID": {"Value": iid}, "Desc": {"Key": name}, "DescLong": {"Key": desc}, "ItemType": f"EItemType::{typ}",
         "ItemGrade": f"EItemGrade::{grade}", "IconRes": icon, "PermitLevelMin": lvl, "SetNames": [], "Name": f"n{iid}"}
    if cat_key:
        r[cat_key] = f"E::{cat}"
    r.update(kw)
    return r


@pytest.fixture
def export(tmp_path):
    d = tmp_path / "Table"
    (d / "L10N" / "en-US").mkdir(parents=True)
    (d / "L10N" / "en-US" / "L10NString.json").write_text(json.dumps({"Entries": {
        "String_POT_body": "Wind Serum", "String_POT_DESC_body": "Restores <desc_point>{se_dmg:1:Heal:none}</> Flight Power.\r\nQuick.",
        "String_WOOD_body": "Wood", "String_GOLD_body": "Kina", "String_HELM_body": "Helm", "String_HELM2_body": "Helm 2",
        "String_SETN_body": "Primal Vigor", "String_Tooltip_Grade_Common_body": "Common", "String_Tooltip_Grade_Legend_body": "Epic",
        "SkillAbnormalString_A2_name": "Primal Vigor [2 Set]", "SkillAbnormalString_A2_sum": "Increases PvE Attack by 60",
        "SkillAbnormalString_A4_name": "Primal Vigor [4 Set]", "SkillAbnormalString_A4_sum": "Increases PvE Attack by 150",
    }}), encoding="utf-8")
    write(d, "Item", [
        row(1, "Usable", "POT", "POT_DESC", "UsableCategory", "Potion", icon="Icon_Potion", lvl=10),
        row(2, "Misc", "WOOD", cat_key="MiscCategory", cat="CraftResource", grade="Legend", icon="None"),
        row(3, "Currency", "GOLD", cat_key="CurrencyCategory", cat="Gold"),
        row(4, "Equip", "HELM", SetNames=["S1"]),
        row(5, "Equip", "HELM2", SetNames=["S1"]),
    ])
    write(d, "ItemSet", [
        {"SetName": "S1", "SetNameDesc": {"Key": "SETN"}, "SetIconRes": "Set_Icon", "SetType": "EItemSetType::Arcana", "SetItems": ["n4"]},
        {"SetName": "S1", "SetNameDesc": {"Key": "SETN"}, "SetIconRes": "Set_Icon", "SetType": "EItemSetType::Arcana", "SetItems": ["n5"]},
    ])
    write(d, "ItemSetEffect", [
        {"SetName": "S1", "SetEquipCount": 4, "OptStats": [], "OptAbnormalId": {"Value": 12}},
        {"SetName": "S1", "SetEquipCount": 2, "OptStats": [], "OptAbnormalId": {"Value": 11}},
    ])
    write(d, "SkillAbnormalString", [
        {"Name": "SkillAbnormalString_11", "DescName": {"Key": "SkillAbnormalString_A2_name"}, "DescSummary": {"Key": "SkillAbnormalString_A2_sum"}},
        {"Name": "SkillAbnormalString_12", "DescName": {"Key": "SkillAbnormalString_A4_name"}, "DescSummary": {"Key": "SkillAbnormalString_A4_sum"}},
    ])
    return d


def test_clean_text_drops_tags_resolves_nothing_and_marks_placeholders():
    assert x.clean_text("Restores <desc_point>{se_dmg:1:Heal:none}</> HP.\r\n  Quick <Rare>now</>") == "Restores … HP.\nQuick now"
    assert x.clean_text("plain") == "plain"


def test_equip_icon_uses_the_cdn_naming():
    assert x.equip_icon("Icon_GM_0026_T03_Torso") == "Icon_Equip_AR_L_0026_T03_Torso"
    assert x.equip_icon("Icon_WP_GS_0108_T06") == "Icon_Equip_WP_L_GS_0108_T06"
    assert x.equip_icon("Icon_Arcana_Card_X") == "Icon_Arcana_Card_X" and x.equip_icon("None") is None


def test_other_items_keep_only_our_fields(export):
    doc = x.build_others(export)
    assert [r["id"] for r in doc["items"]] == [1, 2, 3]  # equipment is not here
    pot, wood, gold = doc["items"]
    assert pot == {"id": 1, "n": "Wind Serum", "g": "Common", "type": "Usable", "cat": "Potion", "lv": 10, "i": "Icon_Potion",
                   "d": "Restores … Flight Power.\nQuick."}
    assert wood["g"] == "Epic" and "i" not in wood and "d" not in wood  # the client's Legend shows as Epic; no icon, no text
    assert (gold["type"], gold["cat"]) == ("Currency", "Gold")


def test_sets_get_members_from_item_set_names_and_bonuses_from_the_client_text(export):
    l10n = x.l10n_entries(export)
    sets = x.build_sets(export, l10n, b._rows(export, "ItemSet"), {"S1": [5, 4]})
    assert list(sets) == ["S1"]  # two ItemSet rows (one per item family), one set
    s = sets["S1"]
    assert (s["name"], s["icon"], s["type"], s["items"]) == ("Primal Vigor", "Set_Icon", "Arcana", [4, 5])
    assert s["bonuses"] == [{"pieces": 2, "name": "Primal Vigor [2 Set]", "text": "Increases PvE Attack by 60"},
                            {"pieces": 4, "name": "Primal Vigor [4 Set]", "text": "Increases PvE Attack by 150"}]


# ---- itemdb: non-gear categories and sets -----------------------------------------------------------------------

def other(iid, typ, cat, **kw):
    return {"id": iid, "n": f"O{iid}", "g": "Common", "type": typ, "cat": cat, "lv": 1, **kw}


def gear(iid, slot="ring"):
    return {"id": iid, "name": f"G{iid}", "slot": slot, "grade": "Epic", "il": 60, "equip_level": 45, "class_lock": [],
            "max_enchant": 0, "main": [], "subs": [], "sources": [], "icon": "Ico"}


def test_other_items_are_grouped_and_get_no_detail_file():
    doc = {"source": "t", "items": [gear(10)], "enchant_series": {}, "enchant_odds": {}, "exceed": {}}
    oth = {"items": [other(20, "Usable", "Drink", d="Yum"), other(21, "Usable", "Brand New Category"), other(22, "Misc", "Elevate"),
                     other(23, "Currency", "Gold")]}
    files = idb.build(doc, oth)
    assert [r["id"] for r in files["cat/food.json"]["items"]] == [20] and files["cat/food.json"]["items"][0]["d"] == "Yum"
    assert [r["id"] for r in files["cat/usable-other.json"]["items"]] == [21]  # unknown categories fall to the type's catch-all
    assert [r["id"] for r in files["cat/conversion.json"]["items"]] == [22]
    assert [r["id"] for r in files["cat/currency.json"]["items"]] == [23]
    assert "detail/food.json" not in files
    assert files["index.json"]["runs"] == [[10, 10, "ring"], [20, 20, "food"], [21, 21, "usable-other"], [22, 22, "conversion"], [23, 23, "currency"]]
    assert [g["kind"] for g in files["index.json"]["groups"]][-2:] == ["misc", "misc"]


def test_an_id_cannot_be_both_gear_and_other():
    with pytest.raises(ValueError, match="both"):
        idb.build({"items": [gear(10)], "enchant_series": {}, "enchant_odds": {}, "exceed": {}}, {"items": [other(10, "Misc", "Misc")]})


def test_sets_file_lists_members_with_their_category():
    doc = {"items": [gear(10), gear(11)], "enchant_series": {}, "enchant_odds": {}, "exceed": {},
           "sets": {"S": {"name": "Set", "icon": "SI", "type": "Arcana", "items": [10, 11], "bonuses": [{"pieces": 2, "name": "n", "text": "t"}]}}}
    files = idb.build(doc)
    assert files["sets.json"]["sets"][0]["items"] == [{"id": 10, "n": "G10", "g": "Epic", "cat": "ring", "i": "Ico"},
                                                      {"id": 11, "n": "G11", "g": "Epic", "cat": "ring", "i": "Ico"}]
    assert files["index.json"]["groups"][-1] == {"key": "sets", "label": "Item sets", "kind": "sets", "cats": [], "count": 1}


# ---- ADR 0001 guards: only our derived fields, small files, nothing raw ---------------------------------------------

def test_real_derived_files_cover_every_non_gear_item_and_the_known_sets():
    oth = json.loads((DATA / "items_other.json").read_text(encoding="utf-8"))
    items = json.loads((DATA / "items.json").read_text(encoding="utf-8"))
    files = idb.build(items, oth)
    assert sum(len(v["items"]) for k, v in files.items() if k.startswith("cat/")) == len(items["items"]) + len(oth["items"])
    assert {i["type"] for i in oth["items"]} == {"Usable", "Misc", "Currency"}
    assert all(i["g"] in {"Common", "Rare", "Unique", "Epic", "Special", "Heroic"} for i in oth["items"])
    members = {i for s in items["sets"].values() for i in s["items"]}
    assert members == {i["id"] for i in items["items"] if i.get("set")}
    for s in items["sets"].values():
        assert s["bonuses"] and all(b["text"] for b in s["bonuses"])


def test_derived_files_are_small_and_hold_none_of_the_raw_tables():
    assert (DATA / "items_other.json").stat().st_size < 2_000_000
    assert (DATA / "items.json").stat().st_size < 6_000_000
    for name in ("items_other.json", "items.json"):
        text = (DATA / name).read_text(encoding="utf-8")
        for raw in FORBIDDEN_RAW_KEYS:
            assert raw not in text, f"{raw} (a raw client field) found in {name}"
        assert not re.search(r"[A-Za-z]:[\\/].*Aion2-tools", text)
    for k in json.loads((DATA / "items_other.json").read_text(encoding="utf-8"))["items"][:50]:
        assert set(k) <= {"id", "n", "g", "type", "cat", "lv", "i", "d"}


def test_extras_script_reads_no_path_argument_and_needs_the_env_var(monkeypatch):
    monkeypatch.delenv(b.ENV_VAR, raising=False)
    with pytest.raises(SystemExit, match="AION2_EXPORT_DIR is not set"):
        x.main()
    assert "argv" not in Path(x.__file__).read_text(encoding="utf-8")
