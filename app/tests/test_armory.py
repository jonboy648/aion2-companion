"""Armory importer: offline. HTTP is patched at aion2c.armory._get_json; samples are Jon's real character."""
import json
import urllib.parse
from dataclasses import replace
from pathlib import Path

import pytest
from PySide6.QtWidgets import QLabel

import aion2c.armory as armory
import aion2c.settings as settings
from aion2c.data.loader import load_gamedata
from aion2c.models import CharacterBuild, Stats
from aion2c.state import AppState
from aion2c.ui.home_view import HomeView

FX = Path(__file__).parent / "fixtures" / "armory"
ENC_ID = "SQlrdtb1Tw1yEhS_c-OisaL9MCPPr9kxYIr6S7hx8JM%3D"
ID = urllib.parse.unquote(ENC_ID)


def load(name):
    return json.loads((FX / name).read_text(encoding="utf-8"))


SEARCH_NAE = {
    "list": [{"characterId": ENC_ID, "name": "<strong>DarthThot</strong>", "race": 2, "pcId": 28, "level": 44,
              "serverId": 2103, "serverName": "Triniel", "region": "nae"}],
    "pagination": {"page": 1, "size": 100, "total": 1, "endPage": 1},
}


@pytest.fixture(scope="module")
def gd():
    return load_gamedata()


@pytest.fixture
def base():
    return CharacterBuild("Me", "global", 10, stats=Stats())


@pytest.fixture
def raw():
    return {"info": load("info.json"), "equipment": load("equipment.json"),
            "daevanion": {b: load(f"daevanion_{b}.json") for b in (61, 63, 64)}}


@pytest.fixture
def http(monkeypatch):
    """Fake armory server keyed on URL; records every URL requested."""
    urls = []

    def get(url):
        urls.append(url)
        if "api-search" in url:
            return SEARCH_NAE if "region=nae" in url else {"list": [], "pagination": {}}
        if "/info?" in url:
            return load("info.json")
        if "/equipment?" in url:
            return load("equipment.json")
        if "/daevanion/detail?" in url:
            return load(f"daevanion_{url.rsplit('boardId=', 1)[1]}.json")
        raise AssertionError(url)

    monkeypatch.setattr(armory, "_get_json", get)
    return urls


def test_search_strips_tags_decodes_id_and_tries_all_regions(http):
    res = armory.search("Darththot")
    assert len(http) == 5 and all("keyword=Darththot" in u for u in http)
    assert res == [{"characterId": ID, "name": "DarthThot", "level": 44, "serverId": 2103,
                    "serverName": "Triniel", "pcId": 28, "race": 2, "region": "nae"}]
    http.clear()
    armory.search("Darththot", "nae")
    assert len(http) == 1 and "region=nae" in http[0]


def test_search_errors_are_plain(monkeypatch):
    def boom(url):
        raise armory.ArmoryError("down")

    monkeypatch.setattr(armory, "_get_json", boom)
    with pytest.raises(armory.ArmoryError, match="down"):
        armory.search("x")
    with pytest.raises(armory.ArmoryError, match="name"):
        armory.search("  ")


def test_fetch_encodes_id_and_skips_empty_boards(http):
    raw = armory.fetch(ID, 2103, "nae")
    assert set(raw["daevanion"]) == {61, 63, 64}  # 62 and 66 have 0 open nodes, 65 is not listed
    assert all(ENC_ID in u for u in http if "/api/character/" in u)
    assert len(http) == 2 + 3


def test_to_build_level_ranks_stigmas(gd, raw, base):
    b, notes = armory.to_build(gd, raw, base)
    assert b.name == "DarthThot" and b.level == 44 and b.region == "global"
    # official level includes Daevanion +N (Flame Arrow 12, two open skill nodes) -> base rank 10
    assert b.skill_ranks["flame-arrow"] == 10 and b.skill_ranks["hellfire"] == 5
    assert b.skill_ranks["cold-snap-15730000"] == 2 and b.skill_ranks["revitalization-contract"] == 1
    assert "curse-tree" not in b.skill_ranks  # not acquired
    assert b.stigmas == ("element-enhancement", "cold-storm", "fire-wall", "delayed-explosion")
    assert any("Imported level 44" in n for n in notes)


def test_to_build_daevanion_match_rate(gd, raw, base):
    b, notes = armory.to_build(gd, raw, base)
    opened = sum(1 for d in raw["daevanion"].values() for n in d["nodeList"] if n["open"] == 1)
    assert opened == 84
    assert len(b.daevanion_nodes) / opened >= 0.9
    assert armory._map_daevanion(gd, raw)["verified"] == opened  # names agree, not just positions
    # every mapped node sits on the right board and is a real gd node
    ids = {n.id for br in gd.daevanion.values() for n in br.nodes.values()}
    assert b.daevanion_nodes <= ids


def test_to_build_stats_mapping(gd, raw, base):
    b, notes = armory.to_build(gd, raw, replace(base, stats=Stats(attack=1234, crit_dmg_pct=77)))
    assert b.stats.attack_increase_pct == pytest.approx(1.6)  # Might 1.4 + Destruction 0.2
    assert b.stats.crit_chance_pct == pytest.approx(2.8)
    assert b.stats.combat_speed_pct == pytest.approx(3.8)
    assert b.stats.cdr_pct == pytest.approx(0.1)
    assert b.stats.attack == 1234 and b.stats.crit_dmg_pct == 77  # not in the armory: kept
    assert any("Evasion" in n and "not used" in n for n in notes)
    b2, _ = armory.to_build(gd, raw, b)
    assert b2.stats == b.stats  # re-import does not accumulate


def test_to_build_maps_agi_crit_and_wisdom_double(gd, raw, base):
    # Precision (AGI) shows the same "Critical Hit increase" line as Death, Wisdom [Lumiel] shows "Double Chance":
    # both must land in the engine (crit chance and smite) and add up with the other sources
    info = raw["info"]
    by_name = {s["name"].split(" [")[0]: s for s in info["stat"]["statList"]}
    by_name["Precision"]["statSecondList"] = ["Accuracy increase +1.5%", "Critical Hit increase +1.5%"]
    by_name["Wisdom"]["statSecondList"] = ["MP Cost -2.1%", "Double Chance +2.1%"]
    b, notes = armory.to_build(gd, raw, base)
    assert b.stats.crit_chance_pct == pytest.approx(2.8 + 1.5)
    assert b.stats.smite_pct == pytest.approx(2.1)
    assert not any("Double Chance" in n for n in notes)


def test_gear_wisdom_and_armory_double_chance_are_the_same_unit(gd, raw, base):
    """The armory prints the stat already converted ("Wisdom 1" -> "Double Chance +0.1%", Might 14 -> +1.4%): a
    percent. Gear carries the raw stat points and gear.py converts them at the client's 0.1% per point, so a Wisdom
    point on gear and the armory's own Double Chance line land on the same smite_pct (a gear HardHit line is a percent
    too, item values 0.58-2.2)."""
    from aion2c import gear
    by_name = {s["name"].split(" [")[0]: s for s in raw["info"]["stat"]["statList"]}
    for deity, label, field in (("Wisdom", "Double Chance", "smite_pct"), ("Death", "Critical Hit increase", "crit_chance_pct")):
        pts = by_name[deity]["value"]
        line = next(t for t in by_name[deity]["statSecondList"] if t.startswith(label))
        assert float(line.split("+")[1].rstrip("%")) == pytest.approx(pts * gear.DEITY_PCT_PER_POINT)  # the armory converts at 0.1
        assert getattr(gear.lines_to_delta({deity: float(pts)})[0], field) == pytest.approx(pts * gear.DEITY_PCT_PER_POINT)
    armory_total, _ = armory.to_build(gd, raw, base)
    assert armory_total.stats.smite_pct == pytest.approx(gear.lines_to_delta({"Wisdom": 1.0})[0].smite_pct)  # 1 point = 0.1
    assert gear.lines_to_delta({"HardHit": 1.0})[0].smite_pct == pytest.approx(1.0)  # a percent line stays 1:1


def test_summary(gd, raw):
    sm = armory.summary(gd, raw)
    assert sm["combat_power"] == 33721 and sm["server"] == "Triniel" and sm["item_level"] == 707
    assert len(sm["gear"]) == 17 and sm["gear"][0]["enchant"] == 10
    assert [s["key"] for s in sm["stigmas"]][0] == "element-enhancement" and len(sm["stigmas"]) == 4
    assert {b["board"]: b["open"] for b in sm["daevanion"]} == {"Nezekan": 68, "Vaizel": 15, "Triniel": 1}


def test_default_user_has_armory():
    assert settings.DEFAULT_USER["armory"] == {"name": "", "region": "", "character_id": "", "server_id": ""}


# ---- UI ------------------------------------------------------------------------------------------------

@pytest.fixture
def view(qapp, fake_engine, gd, base, user_path, http):
    st = AppState(fake_engine, gd, base)
    return st, HomeView(st, gd, fake_engine)


def settle(qapp, v):
    for _ in range(20):  # search -> (pick) -> fetch: each hop needs the pool then the event loop
        v._pool.waitForDone(5000)
        qapp.processEvents()


def test_import_flow(qapp, view, http):
    st, v = view
    assert not v.refresh_btn.isEnabled()
    assert [v.arm_region.itemText(i) for i in range(v.arm_region.count())] == [
        "Auto", "NA East", "NA West", "EU", "South America", "Asia"]
    v.arm_name.setText("Darththot")
    v.import_btn.click()
    settle(qapp, v)
    b = st.build()
    assert b.name == "DarthThot" and b.level == 44 and v.level.value() == 44
    assert len(b.stigmas) == 4 and len(b.daevanion_nodes) == 84 and b.skill_ranks["flame-arrow"] == 10
    texts = " ".join(w.text() for w in v.findChildren(QLabel))
    assert "33,721" in texts and "Liberator Spellbook +10" in texts and "Cold Storm" in texts
    assert "Nezekan: 68 of 68" in texts and v.findChild(QLabel, "import_notes") is not None
    a = settings.load_user()["armory"]
    assert a == {"name": "DarthThot", "region": "nae", "character_id": ID, "server_id": "2103"}
    assert v.refresh_btn.isEnabled() and v.import_btn.isEnabled()


def test_refresh_reimports_with_saved_identity(qapp, view, http):
    st, v = view
    u = settings.load_user()
    u["armory"] = {"name": "DarthThot", "region": "nae", "character_id": ID, "server_id": "2103"}
    settings.save_user(u)
    v2 = HomeView(st, v.gd, v.engine)
    assert v2.arm_name.text() == "DarthThot" and v2.arm_region.currentData() == "nae" and v2.refresh_btn.isEnabled()
    http.clear()
    v2.refresh_btn.click()
    settle(qapp, v2)
    assert not any("api-search" in u for u in http)  # no search on refresh
    assert st.build().level == 44


def test_multiple_matches_use_picker(qapp, view, monkeypatch):
    st, v = view
    second = dict(SEARCH_NAE["list"][0], name="<strong>DarthThot2</strong>", level=12, serverId=2001)
    monkeypatch.setattr(armory, "search", lambda n, r=None: [
        {"characterId": ID, "name": "DarthThot", "level": 44, "serverId": 2103, "serverName": "Triniel",
         "pcId": 28, "race": 2, "region": "nae"},
        {"characterId": "zzz", "name": "DarthThot2", "level": 12, "serverId": 2001, "serverName": "Other",
         "pcId": 1, "race": 1, "region": "naw"}])
    seen = []
    fetched = []
    monkeypatch.setattr(v, "_pick_match", lambda m: seen.append(m) or m[0])
    monkeypatch.setattr(armory, "fetch", lambda c, s, r: fetched.append((c, s, r)) or {
        "info": load("info.json"), "equipment": load("equipment.json"), "daevanion": {}})
    v.arm_name.setText("Darththot")
    v.import_btn.click()
    settle(qapp, v)
    assert len(seen[0]) == 2 and fetched == [(ID, 2103, "nae")]
    assert st.build().level == 44 and second  # imported the picked one


def test_errors_show_message_and_unlock(qapp, view, monkeypatch):
    st, v = view

    def boom(n, r=None):
        raise armory.ArmoryError("Could not reach the armory (offline).")

    monkeypatch.setattr(armory, "search", boom)
    v.arm_name.setText("x")
    v.import_btn.click()
    settle(qapp, v)
    assert "Could not reach the armory" in v.import_status.text() and v.import_btn.isEnabled()
    assert st.build().level == 10
    monkeypatch.setattr(armory, "search", lambda n, r=None: [])
    v.import_btn.click()
    settle(qapp, v)
    assert "No character found" in v.import_status.text()


def test_optimize_starts_from_imported_build(qapp, view, monkeypatch):
    """skill_points left blank -> None -> optimizer keeps imported ranks and Daevanion nodes."""
    import aion2c.engine.build_optimizer as bo

    st, v = view
    v.arm_name.setText("Darththot")
    v.import_btn.click()
    settle(qapp, v)
    seen = []

    def cmp(gd, build, daevanion_points=None, cfg=None, progress=None):
        seen.append(build)
        raise RuntimeError("stop")

    monkeypatch.setattr(bo, "compare_playstyles", cmp)
    v.optimize()
    v.wait()
    qapp.processEvents()
    b = seen[0]
    assert b.skill_points is None and b.skill_ranks["flame-arrow"] == 10 and len(b.daevanion_nodes) == 84
