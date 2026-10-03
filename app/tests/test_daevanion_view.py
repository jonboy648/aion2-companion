import dataclasses

import pytest

from aion2c.models import Priority, PriorityEntry
from aion2c.state import AppState
from aion2c.ui.daevanion_view import DaevanionView, stat_totals


def _make(gd, build, engine):
    return DaevanionView(AppState(engine, gd, build), gd, engine)


@pytest.fixture
def view(qapp, mini_gd, default_build, fake_engine, user_path):
    return _make(mini_gd, default_build, fake_engine)


def test_tab_per_board(qapp, mini_gd, sorc_gd, default_build, fake_engine, user_path):
    for gd in (mini_gd, sorc_gd):
        v = _make(gd, default_build, fake_engine)
        assert v.tabs.count() == len(gd.daevanion)
    assert "Lv" not in v.tabs.tabText(0)  # level 45 build: nezekan unlocked shows used/total
    assert "/" in v.tabs.tabText(0)


def test_locked_board_tab_and_click(view):
    view.state.set_build(dataclasses.replace(view.state.build(), level=0))
    assert "Lv 1" in view.tabs.tabText(0)
    assert view.toggle(2) is False  # board locked at this level


def test_click_selects_available_and_calls_set_build(view, monkeypatch):
    calls = []
    orig = view.state.set_build
    monkeypatch.setattr(view.state, "set_build", lambda b: (calls.append(b), orig(b)))
    assert view._items[2].kind == "selectable"
    view._items[2].mousePressEvent(type("E", (), {"button": lambda s: __import__("PySide6.QtCore").QtCore.Qt.LeftButton})())
    assert calls and calls[-1].daevanion_nodes == frozenset({2})
    assert view._items[2].kind == "selected" and view._items[2].order == 1


def test_non_adjacent_click_does_nothing(view):
    assert view.toggle(3) is False
    assert view.state.build().daevanion_nodes == frozenset()


def test_deselect_leaf_only(view):
    assert view.toggle(2) and view.toggle(3)
    assert view.toggle(2) is False  # would orphan 3
    assert view.toggle(3) is True
    assert view.toggle(2) is True  # now a leaf: deselect
    assert view.state.build().daevanion_nodes == frozenset()


def test_preselected_from_build(qapp, mini_gd, default_build, fake_engine, user_path):
    b = dataclasses.replace(default_build, daevanion_nodes=frozenset({2, 3}))
    v = _make(mini_gd, b, fake_engine)
    assert v._items[2].kind == v._items[3].kind == "selected"
    assert v._items[2].order == 0  # order unknown
    v.state.set_build(dataclasses.replace(b, daevanion_nodes=frozenset({2})))  # buildChanged refresh
    assert v._items[3].kind != "selected"


def test_stat_total_panel_sums_effects(qapp, sorc_gd, default_build, fake_engine, user_path):
    from aion2c import daevanion as dv

    board = sorc_gd.daevanion["nezekan"]
    sel = frozenset(dv.selectable(board, frozenset()))
    stat_ids = [n for n in sel if not board.nodes[n].skill_key][:2]
    assert stat_ids
    lines = stat_totals(sorc_gd, frozenset(stat_ids))
    expect = {}
    for n in stat_ids:
        for e in board.nodes[n].effects:
            expect[e.stat] = expect.get(e.stat, 0) + e.value
    for stat, val in expect.items():
        assert any(l.startswith(stat) and f"{val:+g}" in l for l in lines), (stat, val, lines)
    v = _make(sorc_gd, dataclasses.replace(default_build, daevanion_nodes=frozenset(stat_ids)), fake_engine)
    assert next(iter(expect)) in v.totals.text()


def test_clear_board(view):
    view.toggle(2)
    view.clear_board()
    assert view.state.build().daevanion_nodes == frozenset()
    assert "Used 0" in view.points_label.text()


def test_max_power_path_selects_ordered(view, monkeypatch):
    from aion2c.testing.fakes import fake_simulate

    monkeypatch.setattr("aion2c.daevanion.simulate", fake_simulate)
    monkeypatch.setattr(view.state, "best_priority", lambda: Priority((PriorityEntry("strike"),)))
    view.budget.setValue(3)
    view.suggest()
    sel = view.state.build().daevanion_nodes
    assert 2 in sel and view._items[2].order == 1


def test_header_follows_class(qapp, sorc_gd, default_build, fake_engine, user_path):
    st = AppState(fake_engine, sorc_gd, default_build)
    v = DaevanionView(st, sorc_gd, fake_engine)
    assert v.class_chip.text() == "Sorcerer"
    st.set_class("templar")
    assert v.class_chip.text() == "Templar"
    assert v.tabs.count() == len(st.gamedata().daevanion)
    assert v._items and all(i.node in st.gamedata().daevanion[v._keys[0]].nodes.values() for i in v._items.values())


def test_points_bar_and_over_budget(view):
    view.toggle(2)
    assert view.points_bar.maximum() == view.budget.value() and view.points_bar.value() == 1
    view.budget.setValue(0)
    view.state.set_build(dataclasses.replace(view.state.build(), daevanion_nodes=frozenset({2})))
    assert "Used 1 / 0" in view.points_label.text()


def test_edges_drawn_between_adjacent_nodes(view):
    from PySide6.QtWidgets import QGraphicsPathItem

    paths = [i for i in view.scene.items() if isinstance(i, QGraphicsPathItem)]
    assert paths and any(not p.path().isEmpty() for p in paths)
