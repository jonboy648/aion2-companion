"""My Build tab: playstyle cards, optimize worker, result cards, apply."""
import sys
import types
from dataclasses import replace
from types import SimpleNamespace

import pytest
from PySide6.QtWidgets import QLabel

from aion2c.models import Priority, PriorityEntry, StatGain
from aion2c.state import AppState
from aion2c.testing import fakes
from aion2c.ui.home_view import HomeView, role_text


@pytest.fixture
def bo_mod(monkeypatch):
    """The engine module may not exist yet: install a stand-in module if needed, then patch."""
    try:
        import aion2c.engine.build_optimizer as mod
    except ImportError:
        mod = types.ModuleType("aion2c.engine.build_optimizer")
        monkeypatch.setitem(sys.modules, "aion2c.engine.build_optimizer", mod)
    return mod


def make_full(gd, build, key="boss"):
    keys = ("element-enhancement", "hellfire", "blaze", "firestorm", "flame-arrow")
    return SimpleNamespace(
        playstyle=key,
        build=replace(build, level=40, skill_points=30),
        stigma_picks=(("element-enhancement", 4.2), ("steel-barrier", 1.1)),
        rank_log=(("hellfire", 8, 2.1),),
        daevanion_path=(2, 3, 4),
        daevanion_gain_pct=3.5,
        priority=Priority(tuple(PriorityEntry(k) for k in keys)),
        result=fakes.fake_sim_result(1800.0),
        stat_gains=(StatGain("crit_dmg_pct", 1.0, 0.8, "estimated"),),
        warnings=("w1",),
        variants=(
            SimpleNamespace(key="max", label="Max power", gives="Top damage.", build=replace(build, level=40),
                            stigma_picks=(("element-enhancement", 4.2),), dps=1800.0, dps_delta_pct=0.0),
            SimpleNamespace(key="safe", label="Safer", gives="Survive more.", build=replace(build, level=41),
                            stigma_picks=(("steel-barrier", 1.0),), dps=1700.0, dps_delta_pct=-2.4),
        ),
    )


@pytest.fixture
def view(qapp, fake_engine, sorc_gd, default_build, bo_mod, monkeypatch):
    calls = []

    def fake_cmp(gd, build, daevanion_points=None, cfg=None, progress=None):
        calls.append((build, daevanion_points))
        if progress:
            progress("step 1")
        return {k: make_full(gd, build, k) for k in ("boss", "aoe", "leveling", "burst")}

    monkeypatch.setattr(bo_mod, "compare_playstyles", fake_cmp, raising=False)
    st = AppState(fake_engine, sorc_gd, default_build)
    v = HomeView(st, sorc_gd, fake_engine)
    v.calls = calls
    return st, v


def run(qapp, v):
    v.optimize()
    v.wait()
    qapp.processEvents()


def test_pre_optimize_state(view):
    _, v = view
    assert not v.rows and v.go_btn.isEnabled() and not v.pvp_btn.isEnabled()
    assert "boss" in v.style_btns and v.style_btns["boss"].isChecked()


def test_playstyle_cards_set_selection(view):
    _, v = view
    k = next(k for k in v.style_btns if k != "boss")
    v.style_btns[k].click()
    assert v.selected == k and v.style_btns[k].isChecked() and not v.style_btns["boss"].isChecked()


def test_optimize_passes_choices_and_renders(qapp, view):
    st, v = view
    k = next(k for k in v.style_btns if k != "boss")
    v.style_btns[k].click()
    v.level.setValue(40)
    v.skill_points.setValue(30)
    v.dae_points.setValue(12)
    run(qapp, v)
    b, dae = v.calls[0]
    assert v.selected == k and v.full.playstyle == k and b.level == 40 and b.skill_points == 30 and b.stigma_points is None and dae == 12
    assert v.go_btn.isEnabled()
    names = [w.text() for w in v.findChildren(QLabel, "stigma_name")]
    assert names == [v.gd.skills["element-enhancement"].name, v.gd.skills["steel-barrier"].name]
    assert len(v.rows) == 5
    assert v.rows[0].findChild(QLabel, "skill_name").text() == v.gd.skills["element-enhancement"].name
    texts = " ".join(w.text() for w in v.findChildren(QLabel))
    assert "1,800 DPS" in texts and "(estimated)" in texts and "rank 8" in texts and "3 nodes" in texts
    assert "Crit damage" in texts


def test_comparison_columns_and_variant_apply(qapp, view, monkeypatch):
    st, v = view
    run(qapp, v)
    assert set(v.col_btns) == {"boss", "aoe", "leveling", "burst"}
    v.col_btns["aoe"].click()
    assert v.full.playstyle == "aoe"
    assert [w.text() for w in v.findChildren(QLabel, "variant_delta")] == ["best DPS", "-2.4% DPS"]
    v.variant_btns[1].click()
    got = []
    monkeypatch.setattr(st, "set_build", got.append)
    v.apply_btn.click()
    assert got == [v.full.variants[1].build]


def test_apply_calls_set_build(qapp, view, monkeypatch):
    st, v = view
    run(qapp, v)
    got = []
    monkeypatch.setattr(st, "set_build", got.append)
    v.apply_btn.click()
    assert got == [v.full.build]


def test_error_reenables_button(qapp, view, bo_mod, monkeypatch):
    _, v = view

    def boom(*a, **k):
        raise ValueError("nope")

    monkeypatch.setattr(bo_mod, "compare_playstyles", boom, raising=False)
    run(qapp, v)
    assert v.go_btn.isEnabled() and "nope" in v.status.text()


def test_tab_label_is_my_build(qapp, fake_engine, sorc_gd, default_build):
    from aion2c.ui.main_window import MainWindow

    st = AppState(fake_engine, sorc_gd, default_build)
    w = MainWindow(st, sorc_gd, fake_engine)
    assert w.tabs.tabText(0) == "My Build"
    v = w.tabs.widget(0)
    v.full = make_full(sorc_gd, default_build)
    v._render(v.full)
    v.show_board_btn.click()
    assert w.tabs.tabText(w.tabs.currentIndex()) == "Daevanion"


def test_role_text_nonempty(sorc_gd, sorc_priority):
    for e in sorc_priority.entries:
        assert role_text(sorc_gd, e)
