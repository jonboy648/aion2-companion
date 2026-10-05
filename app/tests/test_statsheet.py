"""Stat sheet aggregator: per-source sums, the derived pass (primary stats -> secondary), the ratio pass (Amp Ratio),
armory calibration and the comparison against the armory's own stat list. Three real armory downloads are the fixtures
(DarthThot Sorcerer 44, an anonymized Cleric 45 and Chanter 45); small hand-built ones pin the arithmetic."""
import collections
import json
from pathlib import Path

import pytest

from aion2c import gear, statsheet, webapi

FX = Path(__file__).parent / "fixtures"
ITEMS = gear.load_items()


def _darth() -> dict:
    d = FX / "armory"
    load = lambda n: json.loads((d / n).read_text(encoding="utf-8"))  # noqa: E731
    return {"info": load("info.json"), "equipment": load("equipment.json"),
            "daevanion": {str(b): load(f"daevanion_{b}.json") for b in (61, 62, 63, 64, 65, 66)}}


def _char(name: str) -> dict:
    return json.loads((FX / "armory_chars" / f"{name}.json").read_text(encoding="utf-8"))


CHARS = {"DarthThot": _darth, "Cleric45": lambda: _char("cleric45"), "Chanter45": lambda: _char("chanter45")}


@pytest.fixture(scope="module", params=list(CHARS))
def sheet(request):
    return request.param, statsheet.compute(CHARS[request.param](), ITEMS)


def rows(sh: dict) -> dict[str, dict]:
    return {r["key"]: r for c in sh["categories"] for r in c["stats"]}


def raw_with(titles=(), stats=(), equipment=(), level=45, wing=None) -> dict:
    """A tiny hand-built armory download: `titles` are text lines the parser reads, `stats` the armory's own
    attribute list [(type, value)], `equipment` [{id, enchantLevel, exceedLevel, slotPosName}]."""
    return {
        "info": {"profile": {"characterLevel": level, "className": "Sorcerer"},
                 "stat": {"statList": [{"type": t, "value": v, "statSecondList": None} for t, v in stats]},
                 "title": {"titleList": [{"equipCategory": "Attack", "name": "T", "statList": [],
                                          "equipStatList": [{"desc": d} for d in titles]}]}},
        "equipment": {"equipment": {"equipmentList": list(equipment)}, "petwing": {"wing": wing or {}}},
        "daevanion": {},
    }


# ---- per-source sums ----------------------------------------------------------------------------------------

def test_every_value_is_the_sum_of_its_sources(sheet):
    name, sh = sheet
    n = 0
    for r in rows(sh).values():
        if r.get("capped") or r["key"] == "CooldownTotal":
            continue
        assert r["value"] == pytest.approx(sum(s["value"] for s in r["sources"]), abs=1e-3), (name, r["key"])
        n += 1
    assert n > 60


def test_sources_are_grouped_and_labelled(sheet):
    _, sh = sheet
    groups = {g["key"] for g in sh["groups"]}
    for r in rows(sh).values():
        for s in r["sources"]:
            assert s["group"] in groups and s["label"] and s["value"] != 0


def test_gear_sources_name_the_slot_and_estimates_are_flagged():
    sh = statsheet.compute(_darth(), ITEMS)
    atk = rows(sh)["WeaponDamage"]
    assert any(s["label"].startswith("MainHand: Liberator Spellbook") and s["value"] == 198 for s in atk["sources"])
    assert any("enchant +10" in s["label"] and s["value"] == pytest.approx(44) for s in atk["sources"])
    # fixed STR 14 on the Legend spellbook is exact, random lines elsewhere are estimates
    might = rows(sh)["STR"]
    assert any(not s.get("est") and s["value"] == 14 for s in might["sources"])
    assert any(s.get("est") and s["label"].endswith("random lines") for s in might["sources"])


def test_item_parts_add_up_to_item_lines():
    for iid in (110540035, 110120003, 310430041, 215250001, 311050001):
        it = ITEMS[iid]
        parts = gear.item_parts(it, it["max_enchant"], gear.max_exceed(it))
        merged: dict[str, float] = collections.defaultdict(float)
        for p in parts.values():
            for k, v in p.items():
                merged["WeaponFixingDamage" if k in ("WeaponDamage", "WeaponMinDamage") else k] += v
        lines = gear.item_lines(it, it["max_enchant"], exceed=gear.max_exceed(it))
        for k, v in lines.items():
            if k == "WeaponFixingDamage" and it["slot"] == "weapon":
                continue  # a weapon's range is (min+max)/2 in item_lines, kept as two ends here
            assert merged[k] == pytest.approx(v, rel=1e-9), (iid, k)


def test_daevanion_effect_text_matches_the_open_nodes(sheet):
    name, _ = sheet
    raw = CHARS[name]()
    for bid, d in raw["daevanion"].items():
        by_nodes = collections.defaultdict(float)
        for n in d["nodeList"]:
            if n["open"] == 1 and n["type"] == "Stat":
                for e in n["effectList"]:
                    k, v = statsheet.parse_line(e["desc"])
                    by_nodes[k] += v
        by_list = collections.defaultdict(float)
        for e in d["openStatEffectList"]:
            k, v = statsheet.parse_line(e["desc"])
            by_list[k] += v
        assert dict(by_nodes) == pytest.approx(dict(by_list)), (name, bid)


def test_every_armory_text_line_is_understood(sheet):
    name, sh = sheet
    assert sh["unparsed"] == [], name


def test_parse_line():
    p = statsheet.parse_line
    assert p("Attack Bonus +18") == ("FixingDamage", 18)
    assert p("Cooldown Reduction +3%") == ("CoolTimeDecrease", 3)
    assert p("Cooldown -0.1%") == ("CoolTimeIncrease", -0.1)  # the client stat is "Cooldown", a negative reduction
    assert p("HP +1,000") == ("HPMax", 1000)
    assert p("Critical Hit increase +2.8%") == ("CriticalRatio", 2.8)
    assert p("Totally Unknown Stat +5") is None and p("no number here") is None


# ---- derived pass -------------------------------------------------------------------------------------------

def test_derived_pass_turns_points_into_secondary_stats():
    sh = statsheet.compute(raw_with(titles=["Might +14", "Death +28", "Illusion +10"]), ITEMS)
    r = rows(sh)
    assert r["DamageRatio"]["value"] == pytest.approx(1.4)  # Might: 0.1% per point
    assert r["CriticalRatio"]["value"] == pytest.approx(2.8)
    assert r["CoolTimeIncrease"]["value"] == pytest.approx(-1.0)  # Illusion lowers the cooldown
    assert any(s["group"] == "derived" and s["label"] == "Might 14" for s in r["DamageRatio"]["sources"])
    assert sh["points"] == {"STR": 14, "Illusion": 10, "Death": 28}


def test_derived_pass_floors_and_clamps_the_point_count():
    r = rows(statsheet.compute(raw_with(titles=["Might +14.9"]), ITEMS))
    assert r["DamageRatio"]["value"] == pytest.approx(1.4)  # 14.9 points count as 14
    r = rows(statsheet.compute(raw_with(titles=["Might +5000"]), ITEMS))
    assert r["DamageRatio"]["value"] == pytest.approx(100.0)  # the table stops at 1000 points


def test_derived_pass_matches_the_armory_text_exactly(sheet):
    """Feed the armory's own points through our PcStatSecond table: every percent line it prints must come out equal."""
    name, sh = sheet
    d = sh["armory_check"]["derived"]
    assert len(d) >= 18 and all(x["ok"] for x in d), [x for x in d if not x["ok"]]
    assert sh["armory_check"]["summary"]["derived"] == sh["armory_check"]["summary"]["derived_ok"]


# ---- ratio pass ---------------------------------------------------------------------------------------------

def test_ratio_pass_scales_the_all_source_base_total_once():
    book = {"id": 110540035, "enchantLevel": 0, "exceedLevel": 0, "slotPosName": "MainHand"}
    boosted = rows(statsheet.compute(raw_with(titles=["Attack increase +10%"], equipment=[book]), ITEMS))
    pct = boosted["DamageRatio"]["value"]  # the 10% plus what the spellbook's fixed Might 14 derives (1.4%)
    assert pct == pytest.approx(11.4)
    for k in ("WeaponDamage", "WeaponMinDamage"):
        pre = sum(s["value"] for s in boosted[k]["sources"] if s["group"] != "ratio")
        assert pre > 150
        assert boosted[k]["value"] == pytest.approx(pre * (1 + pct / 100), abs=1e-3)  # once, not compounded
        assert [s["value"] for s in boosted[k]["sources"] if s["group"] == "ratio"] == [pytest.approx(pre * pct / 100)]
    t = {x["key"]: x for x in boosted["DamageRatio"]["applies_to"]}  # what the UI shows under the ratio line
    assert t["WeaponDamage"]["base"] == pytest.approx(boosted["WeaponDamage"]["sources"][0]["value"], abs=1e-3)
    assert "ratio" not in {s["group"] for s in boosted["Critical"]["sources"]}


def test_ratio_pass_runs_after_the_derived_pass():
    book = {"id": 110540035, "enchantLevel": 0, "exceedLevel": 0, "slotPosName": "MainHand"}
    r = rows(statsheet.compute(raw_with(titles=["Might +100"], equipment=[book]), ITEMS))
    assert r["STR"]["value"] == 114  # title 100 + the spellbook's fixed 14
    assert r["DamageRatio"]["value"] == pytest.approx(11.4)  # derived first ...
    pre = sum(s["value"] for s in r["WeaponDamage"]["sources"] if s["group"] != "ratio")
    assert r["WeaponDamage"]["value"] == pytest.approx(pre * 1.114, abs=1e-3)  # ... then the ratio pass uses it


def test_flat_attack_lines_fold_into_max_and_min_attack():
    r = rows(statsheet.compute(raw_with(equipment=[{"id": 110540035, "enchantLevel": 10, "exceedLevel": 0,
                                                     "slotPosName": "MainHand"},
                                                    {"id": 311050001, "enchantLevel": 0, "exceedLevel": 0,
                                                     "slotPosName": "Amulet"}]), ITEMS))
    pre = lambda k: sum(s["value"] for s in r[k]["sources"] if s["group"] != "ratio")  # noqa: E731
    assert pre("WeaponDamage") - pre("WeaponMinDamage") == pytest.approx(198 - 178)  # both ends get the same flat lines
    assert pre("WeaponDamage") >= 198 + 44 + r["WeaponFixingDamage"]["value"]  # range + enchant + flat Attack lines


# ---- base, wings, titles ------------------------------------------------------------------------------------

def test_base_stats_come_from_the_level_table():
    r = rows(statsheet.compute(raw_with(level=45), ITEMS))
    assert (r["FixingDamage"]["value"], r["Defense"]["value"], r["HPMax"]["value"]) == (61, 450, 4702)
    assert r["HPMax"]["sources"][0]["group"] == "base"


def test_wings_add_base_stats_and_the_enchant_row():
    r = rows(statsheet.compute(raw_with(wing={"id": 30200101, "name": "Ultimate Daeva Wings", "enchantLevel": 0}), ITEMS))
    assert r["Critical"]["value"] == 35 and r["FixingDamage"]["value"] == 61 + 10
    assert r["DefensePierce"]["value"] == 500 + 100
    assert all(s["group"] in ("base", "wings") for s in r["DefensePierce"]["sources"])
    hi = rows(statsheet.compute(raw_with(wing={"id": 30200101, "name": "W", "enchantLevel": 10}), ITEMS))
    assert hi["FPMax"]["value"] == 600  # the level-10 row replaces the level-0 row, it is not added to it


def test_titles_are_parsed_per_equipped_title():
    r = rows(statsheet.compute(raw_with(titles=["Critical Attack +30", "Penetration +20"]), ITEMS))
    assert r["CriticalAddDamage"]["sources"][0]["label"] == "Title (Attack): T"
    assert r["DefensePierce"]["value"] == 20


# ---- armory calibration and comparison ---------------------------------------------------------------------

def test_calibration_fills_the_gap_to_the_armory_total_as_an_estimated_source():
    kw = dict(titles=["Might +14"], stats=[("STR", 20)])
    cal = rows(statsheet.compute(raw_with(**kw), ITEMS))["STR"]
    assert cal["value"] == 20
    gap = [s for s in cal["sources"] if s["group"] == "armory"]
    assert len(gap) == 1 and gap[0]["value"] == 6 and gap[0]["est"]
    raw_only = statsheet.compute(raw_with(**kw), ITEMS, calibrate=False)
    r = rows(raw_only)
    assert r["STR"]["value"] == 14 and rows(raw_only)["DamageRatio"]["value"] == pytest.approx(1.4)
    assert rows(statsheet.compute(raw_with(**kw), ITEMS))["DamageRatio"]["value"] == pytest.approx(2.0)


def test_comparison_reports_known_sources_against_the_armory_per_attribute():
    sh = statsheet.compute(_darth(), ITEMS)
    r = rows(sh)
    assert r["STR"]["armory"]["value"] == 14 and 13 < r["STR"]["armory"]["known"] < 17
    assert r["Justice"]["armory"]["value"] == 37 and r["Justice"]["armory"]["known"] == 0  # no deity source in the API
    assert not r["Justice"]["armory"]["ok"]
    s = sh["armory_check"]["summary"]
    assert s["attributes"] == 16 and s["derived"] == s["derived_ok"] == 24


def test_calibrated_attribute_totals_equal_the_armory(sheet):
    name, sh = sheet
    for a in sh["armory_check"]["attributes"]:
        assert rows(sh)[a["key"]]["value"] == pytest.approx(a["armory"], abs=1e-3), (name, a["key"])


def test_cooldown_total_is_capped_at_sixty():
    r = rows(statsheet.compute(raw_with(titles=["Cooldown Reduction +70%", "Cooldown -5%"]), ITEMS))
    assert r["CooldownTotal"]["value"] == 60 and r["CooldownTotal"].get("capped")


# ---- the web entry point ------------------------------------------------------------------------------------

def test_webapi_stat_sheet_is_json_and_has_every_headline_stat():
    out = webapi.stat_sheet(_darth())
    json.dumps(out)
    names = {r["name"] for c in out["categories"] for r in c["stats"]}
    for want in ("Attack Bonus", "Max Attack", "Min Attack", "Penetration", "Critical Hit", "Critical Attack",
                 "Damage Boost", "Critical Damage Boost", "Weapon Damage Boost", "Boss Attack", "Boss Defense",
                 "PvE Attack", "PvE Damage Boost", "Multi-hit Chance", "Perfect Chance", "Double Chance",
                 "Combat Speed", "Cooldown Reduction", "Damage Tolerance", "HP", "MP", "Might", "Death [Triniel]",
                 "Attack increase", "Critical Hit increase"):
        assert want in names, want
    assert len([c for c in out["categories"] if c["key"] == "deity"][0]["stats"]) >= 10
    assert out["not_included"]


def test_derived_data_file_is_small_and_has_no_raw_rows():
    data = statsheet.load_data()
    assert data["level_base"]["45"] == [61, 450, 4702]
    assert data["second"]["STR"] == [["DamageRatio", 0.1]] and data["second_max"] == 1000
    assert DATA_SIZE < 120_000
    assert set(data) == {"schema", "source", "stats", "second", "second_max", "level_base", "wings", "wing_fx"}


DATA_SIZE = statsheet.DATA_PATH.stat().st_size
