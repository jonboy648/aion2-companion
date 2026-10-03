"""Multi-class contract: classes table, per-class loader, build serde, AppState.set_class, armory class,
screens following the class, and the no-Sorcerer-hardcoding guard for engine/ keybinds/ build_optimizer."""
import json
import re
from dataclasses import replace
from pathlib import Path

import pytest

import aion2c.armory as armory
from aion2c.classes import CLASSES, key_from_armory
from aion2c.data import loader
from aion2c.models import CharacterBuild, Stats
from aion2c.serde import from_dict, to_dict
from aion2c.state import AppState

PKG = Path(__file__).resolve().parent.parent / "aion2c"
ARMORY_FX = Path(__file__).parent / "fixtures" / "armory"


def _raw(class_name=None, pc_id=None):
    info = json.loads((ARMORY_FX / "info.json").read_text(encoding="utf-8"))
    eq = json.loads((ARMORY_FX / "equipment.json").read_text(encoding="utf-8"))
    if class_name is not None:
        info["profile"]["className"] = class_name
    if pc_id is not None:
        info["profile"]["pcId"] = pc_id
    return {"info": info, "equipment": eq, "daevanion": {}}


# ---- classes table ---------------------------------------------------------------------------
def test_classes_table():
    assert [c.key for c in CLASSES] == ["gladiator", "templar", "assassin", "ranger", "sorcerer",
                                        "spiritmaster", "cleric", "chanter"]
    assert {c.role for c in CLASSES} <= {"melee_dps", "ranged_dps", "tank", "healer", "support"}
    assert 28 in next(c for c in CLASSES if c.key == "sorcerer").armory_pc_ids


def test_key_from_armory():
    assert key_from_armory("Sorcerer", None) == "sorcerer"
    assert key_from_armory("Elementalist", None) == "spiritmaster"  # the class-list API's name for it
    assert key_from_armory(None, 28) == "sorcerer"
    assert key_from_armory("Nonsense", 99999) is None


# ---- loader per class ------------------------------------------------------------------------
def test_default_path_per_class():
    assert loader.default_path() == loader.default_path("sorcerer")
    assert loader.default_path("templar") == loader.CLASSES_DIR / "templar" / "gamedata.json"
    assert loader.default_path("sorcerer").is_file()


def test_available_classes_matches_files():
    avail = loader.available_classes()
    assert "sorcerer" in avail
    assert avail == [c.key for c in CLASSES if (loader.CLASSES_DIR / c.key / "gamedata.json").is_file()]


def test_load_gamedata_class_key(tmp_path, sorc_gd):
    assert loader.load_gamedata().class_key == "sorcerer"
    d = to_dict(sorc_gd)
    d.pop("class_key")  # an old file without the field takes the requested class
    p = tmp_path / "old.json"
    p.write_text(json.dumps(d), encoding="utf-8")
    assert loader.load_gamedata(p).class_key == "sorcerer"
    assert loader.load_gamedata(p, class_key="templar").class_key == "templar"
    d["class_key"] = "cleric"  # a file that names its class wins over the argument
    p.write_text(json.dumps(d), encoding="utf-8")
    assert loader.load_gamedata(p, class_key="templar").class_key == "cleric"


def test_load_gamedata_missing_class_raises():
    with pytest.raises(FileNotFoundError):
        loader.load_gamedata(class_key="no-such-class")


def test_build_other_class_from_research_tree(tmp_path):
    """build(class_key=...) reads research/classes/<key>/ + assets/icons/<key>/ with the Sorcerer schemas.
    The tree is faked by copying the Sorcerer inputs under another class name."""
    import shutil

    from aion2c.data import build_gamedata as bg

    if not (bg.REPO / "research" / "sorcerer_skills.json").is_file() or not (bg.REPO / "assets" / "icons").is_dir():
        pytest.skip("research/ or assets/icons not present")
    res, icons = tmp_path / "research", tmp_path / "icons"
    cdir = res / "classes" / "templar"
    cdir.mkdir(parents=True)
    shutil.copy(bg.REPO / "research" / "sorcerer_skills.json", cdir / "skills.json")
    shutil.copy(bg.REPO / "research" / "daevanion_sorcerer.json", cdir / "daevanion.json")
    shutil.copy(bg.REPO / "research" / "crafting.json", res / "crafting.json")
    for n in ("mechanics", "chains", "community_rotations", "roadmap"):
        shutil.copy(bg.SRC_DIR / f"{n}.json", cdir / f"{n}.json")
    shutil.copytree(bg.REPO / "assets" / "icons" / "sorcerer", icons / "templar")
    shutil.copy(bg.REPO / "assets" / "icons" / "index.json", icons / "templar" / "index.json")

    real = loader.default_path("templar")
    before = real.stat().st_mtime_ns if real.exists() else None
    out = tmp_path / "gd.json"
    gd = bg.build(res, icons, out, built_at="2026-10-03T00:00:00+00:00", class_key="templar",
                  icons_dest=tmp_path / "dest")
    assert gd.class_key == "templar" and len(gd.skills) == 56
    assert (tmp_path / "dest" / "flame-arrow.png").is_file()
    again = loader.load_gamedata(out)
    assert again.class_key == "templar" and again == gd
    assert (real.stat().st_mtime_ns if real.exists() else None) == before  # package data untouched
    assert bg.ClassSources(res, icons, "templar").available()
    assert not bg.ClassSources(res, icons, "ranger").available()


# ---- CharacterBuild serde --------------------------------------------------------------------
def test_build_serde_round_trip_with_class_key():
    b = CharacterBuild("B", "global", 30, class_key="templar", stats=Stats())
    d = to_dict(b)
    assert d["class_key"] == "templar"
    assert from_dict(CharacterBuild, d) == b


def test_old_saved_build_loads_as_sorcerer():
    d = to_dict(CharacterBuild("Old", "global", 30, stats=Stats()))
    d.pop("class_key")
    assert from_dict(CharacterBuild, d).class_key == "sorcerer"


# ---- AppState.set_class ----------------------------------------------------------------------
def _templar(sorc_gd):
    return replace(sorc_gd, class_key="templar")


def test_set_class_swaps_data_engine_and_build(qapp, sorc_gd, user_path):
    from aion2c.engine.facade import Engine

    tgd = _templar(sorc_gd)
    eng = Engine(sorc_gd)
    build = CharacterBuild("T", "korea", 40, skill_ranks={"blaze": 7}, stigmas=("blaze",),
                           specs={"blaze": (1,)}, daevanion_nodes=frozenset({1, 2}), skill_points=5,
                           stigma_points=3, show_kr=True, stats=Stats(attack=1234))
    st = AppState(eng, sorc_gd, build, gd_loader=lambda k: tgd)
    data, built = [], []
    st.dataChanged.connect(lambda: data.append(1))
    st.buildChanged.connect(lambda: built.append(1))
    st.set_class("templar")
    assert st.class_key() == "templar" and st.build().class_key == "templar"
    assert st.gamedata() is tgd
    assert st.engine() is not eng and st.engine().gd is tgd  # engine rebuilt for the new data
    assert data == [1] and built == [1]
    b = st.build()
    assert (b.name, b.region, b.level, b.show_kr, b.stats) == ("T", "korea", 40, True, Stats(attack=1234))
    assert b.skill_ranks == {} and b.stigmas == () and b.specs == {}
    assert b.daevanion_nodes == frozenset() and b.skill_points is None and b.stigma_points is None
    st.set_class("templar")  # same class again: no-op
    assert data == [1] and built == [1]
    st.shutdown()


def test_set_class_keeps_fake_engine_and_loads_shipped_data(qapp, fake_engine, sorc_gd, user_path):
    st = AppState(fake_engine, sorc_gd, CharacterBuild("T", "global", 45, stats=Stats()))
    st.set_class("sorcerer")  # already sorcerer: nothing to do
    assert st.gamedata() is sorc_gd
    tgd = _templar(sorc_gd)
    st2 = AppState(fake_engine, sorc_gd, CharacterBuild("T", "global", 45, stats=Stats()), gd_loader=lambda k: tgd)
    st2.set_class("templar")
    assert st2.engine() is fake_engine
    st.shutdown()
    st2.shutdown()


def test_set_class_drops_stale_results(qapp, fake_engine, sorc_gd, user_path):
    st = AppState(fake_engine, sorc_gd, CharacterBuild("T", "global", 45, stats=Stats()),
                  gd_loader=lambda k: _templar(sorc_gd))
    st.refresh()
    assert st.current_result() is not None
    st.set_class("templar")
    assert st.current_result() is None
    st.shutdown()


# ---- armory import sets the class ------------------------------------------------------------
def test_to_build_sets_class_from_profile(sorc_gd):
    base = CharacterBuild("Me", "global", 10, stats=Stats())
    new, notes = armory.to_build(sorc_gd, _raw(), base)
    assert new.class_key == "sorcerer" and not any("loaded data is for" in n for n in notes)
    assert armory.class_key(_raw("Templar")) == "templar"
    new, notes = armory.to_build(sorc_gd, _raw("Templar"), base)  # wrong data passed: class still follows the profile
    assert new.class_key == "templar" and any("Templar" in n for n in notes)
    assert armory.class_key(_raw("???", pc_id=28)) == "sorcerer"  # pcId fallback
    new, notes = armory.to_build(sorc_gd, _raw("???", pc_id=424242), replace(base, class_key="cleric"))
    assert new.class_key == "cleric" and any("not recognised" in n for n in notes)


def test_home_import_switches_class(qapp, fake_engine, sorc_gd, user_path, monkeypatch):
    from aion2c.ui import home_view
    from aion2c.ui.home_view import HomeView

    tgd = _templar(sorc_gd)
    st = AppState(fake_engine, sorc_gd, CharacterBuild("Me", "global", 10, stats=Stats()), gd_loader=lambda k: tgd)
    monkeypatch.setattr(home_view, "available_classes", lambda: ["sorcerer", "templar"])
    v = HomeView(st, sorc_gd, fake_engine)
    v._on_fetched(_raw("Templar"), {"name": "x", "region": "nae", "character_id": "c", "server_id": "1"}, "")
    assert st.class_key() == "templar" and st.gamedata() is tgd
    v._on_fetched(_raw("Cleric"), {"name": "x", "region": "nae", "character_id": "c", "server_id": "1"}, "")
    assert st.class_key() == "templar"  # no data for Cleric: stay on the loaded class
    st.shutdown()


# ---- screens follow the class ----------------------------------------------------------------
def test_main_window_class_picker(qapp, fake_engine, sorc_gd, user_path, monkeypatch):
    from aion2c.ui import main_window

    tgd = _templar(sorc_gd)
    monkeypatch.setattr(main_window, "available_classes", lambda: ["sorcerer", "templar"])
    st = AppState(fake_engine, sorc_gd, CharacterBuild("T", "global", 45, stats=Stats()), gd_loader=lambda k: tgd)
    w = main_window.MainWindow(st, sorc_gd, fake_engine)
    assert [w.class_box.itemData(i) for i in range(w.class_box.count())] == ["sorcerer", "templar"]
    assert w.class_box.currentData() == "sorcerer"
    w.class_box.setCurrentIndex(w.class_box.findData("templar"))
    assert st.class_key() == "templar" and w.gd is tgd and "Templar" in w.windowTitle()
    assert all(getattr(t, "gd", tgd) is tgd for t in (w.tabs.widget(i) for i in range(w.tabs.count())))
    st.shutdown()


def test_daevanion_tabs_follow_class(qapp, fake_engine, sorc_gd, user_path):
    from aion2c.ui.daevanion_view import DaevanionView

    board = next(iter(sorc_gd.daevanion.values()))
    tgd = replace(_templar(sorc_gd), daevanion={"alpha": replace(board, key="alpha", name="Alpha")})
    st = AppState(fake_engine, sorc_gd, CharacterBuild("T", "global", 45, stats=Stats()), gd_loader=lambda k: tgd)
    v = DaevanionView(st, sorc_gd, fake_engine)
    assert v.tabs.count() == len(sorc_gd.daevanion)
    st.set_class("templar")
    assert v.tabs.count() == 1 and v.board().key == "alpha"
    st.shutdown()


# ---- no Sorcerer hardcoding ------------------------------------------------------------------
SORCERER_KEYS = ("hellfire", "flame-arrow", "element-enhancement", "steel-barrier", "bittercold-wind",
                 "defiance", "wish-of-concentration", "delayed-explosion", "frost-burst", "winters-shackles",
                 "fire-wall", "cold-storm", "arctic-armor", "soul-freeze", "curse-tree", "lumiels-space",
                 "divine-burst", "hibernation")


def test_no_sorcerer_hardcoding_in_engine_and_keybinds():
    files = sorted((PKG / "engine").glob("*.py")) + sorted((PKG / "keybinds").glob("*.py"))
    assert any(f.name == "build_optimizer.py" for f in files)
    pat = re.compile("|".join(re.escape(k) for k in SORCERER_KEYS), re.IGNORECASE)
    hits = [f"{f.relative_to(PKG)}:{n}: {line.strip()}"
            for f in files for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1)
            if pat.search(line)]
    assert not hits, "Sorcerer skill keys belong in the class data (Skill.tags), not code:\n" + "\n".join(hits)


def test_manual_detection_is_data_driven(sorc_gd):
    from aion2c.keybinds.layout import is_manual, manual_keys

    assert is_manual(sorc_gd, "hellfire") and not is_manual(sorc_gd, "blaze")
    stripped = replace(sorc_gd, skills={k: replace(s, tags=tuple(t for t in s.tags if t != "manual"))
                                        for k, s in sorc_gd.skills.items()})
    assert not is_manual(stripped, "hellfire")  # no tag, no manual: nothing is guessed from the key name
    assert "hellfire" in manual_keys(sorc_gd)
