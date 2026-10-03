"""Polished Codex / Crafting / Road Map screens: every class, filters, chain jumps, timeline clicks."""
import json

import pytest
from PySide6.QtCore import QPoint, Qt
from PySide6.QtTest import QTest

import aion2c.roadmap as roadmap_mod
from aion2c.classes import class_name
from aion2c.data.loader import allowed_skills, available_classes, load_gamedata
from aion2c.models import CharacterBuild, Stats
from aion2c.state import AppState
from aion2c.testing.fakes import FakeEngine
from aion2c.ui.codex import CodexScreen
from aion2c.ui.crafting_view import CraftingView
from aion2c.ui.roadmap_view import R_BAND, RoadmapScreen, item_id, skill_keys_in


@pytest.fixture
def st(qapp, user_path):
    gd = load_gamedata(class_key="sorcerer")
    state = AppState(FakeEngine(), gd, CharacterBuild("Test", "global", 25, stats=Stats(crit_chance_pct=0)))
    yield state
    state.shutdown()


def test_codex_every_class(st):
    scr = CodexScreen(st, st.gamedata(), st.engine())
    for ck in available_classes():
        st.set_class(ck)
        gd = st.gamedata()
        pool = allowed_skills(gd, "global", False)
        assert scr.list.count() == len(pool), ck
        assert class_name(ck) in scr.title.text()
        # kind chips partition the class: All == Active + Passive + Stigma + Other
        total = sum(scr._bucket(s) == k for k in ("active", "passive", "stigma", "other") for s in pool)
        assert total == len(pool)
        scr.filter_btns["active"].click()
        kinds = {gd.skills[scr.list.item(i).data(Qt.ItemDataRole.UserRole)].kind.value for i in range(scr.list.count())}
        assert kinds == {"active"}
        assert scr.ranks.rowCount() >= 1  # detail of the selected active skill is filled
        scr.filter_btns["all"].click()
        assert scr.list.count() == len(pool)


def test_codex_search_empty_state_and_chain_jump(st):
    scr = CodexScreen(st, st.gamedata(), st.engine())
    scr.search.setText("zzzz-no-such-skill")
    assert scr.list.count() == 0 and scr.stack.currentWidget() is scr.empty
    assert scr.d_empty.isHidden() is False  # detail panel shows its own hint, never stale data
    scr.empty.action.click()
    assert scr.list.count() > 0 and scr.stack.currentWidget() is scr.list
    scr.filter_btns["passive"].click()
    scr.select_key("flame-arrow")  # a hidden skill clears the filters, then gets selected
    assert scr.current_key() == "flame-arrow"
    leads = [scr.d_links.itemAt(i).widget().text() for i in range(scr.d_links.count())]
    assert any("Burst" in t for t in leads)


def test_codex_grid_list_toggle_keeps_items(st):
    scr = CodexScreen(st, st.gamedata(), st.engine())
    n = scr.list.count()
    scr.view_list.setChecked(True)
    assert scr.list.count() == n and scr.list.viewMode() == scr.list.ViewMode.ListMode
    scr.view_grid.setChecked(True)
    assert scr.list.count() == n and scr.list.viewMode() == scr.list.ViewMode.IconMode


def test_crafting_every_class(st):
    v = CraftingView(st, st.gamedata(), st.engine())
    for ck in available_classes():
        st.set_class(ck)
        gd = st.gamedata()
        if ck == "sorcerer":
            assert v.filter_box.isHidden() is False
        else:
            assert v.filter_box.isHidden() and not v.filter_box.isChecked()
            assert v.recipe_list.count() == len(gd.recipes)
        assert v.recipe_list.currentRow() == 0
        assert v.d_name.text() == v._shown[0].name
    prof = v.prof_box.itemData(1)
    v.prof_box.setCurrentIndex(1)
    assert v.recipe_list.count() and all(r.profession.startswith(prof) for r in v._shown)


def test_crafting_progress_follows_checks(st):
    v = CraftingView(st, st.gamedata(), st.engine())
    assert v.shop_stack.currentWidget() is v.shop_empty and not v.copy_btn.isEnabled()
    v.add_btn.click()
    assert v.shop_stack.currentWidget() is v.shop and v.copy_btn.isEnabled()
    n = v.shop.count()
    assert v.progress.maximum() == n and v.progress.value() == 0
    v.shop.item(0).setCheckState(Qt.CheckState.Checked)
    assert v.progress.value() == 1 and v.progress_label.text() == f"1 of {n} gathered"
    assert v.shop.item(0).font().strikeOut()


def test_roadmap_every_class_and_icons(st):
    scr = RoadmapScreen(st, st.gamedata(), st.engine())
    for ck in available_classes():
        st.set_class(ck)
        gd = st.gamedata()
        items = roadmap_mod.roadmap(gd, "global", st.build())
        leaves = sum(scr.tree.topLevelItem(i).childCount() for i in range(scr.tree.topLevelItemCount()))
        assert leaves == len(items) > 0, ck
        # the band holding the character's level (25 -> levels 21-30) is the open one
        tops = [scr.tree.topLevelItem(i) for i in range(scr.tree.topLevelItemCount())]
        here = [tp for tp in tops if tp.data(0, R_BAND)["current"]]
        assert len(here) == 1 and here[0].isExpanded() and here[0].data(0, R_BAND)["lo"] == 21, ck
    gd = load_gamedata(class_key="sorcerer")
    assert skill_keys_in(gd, "Unlock Curse: Tree") == [next(k for k, s in gd.skills.items() if s.name == "Curse: Tree")]
    many = skill_keys_in(gd, "Sorcerer skill unlock: Flame Arrow, Firestorm, Ice Chain, Fire Mark")
    assert len(many) >= 3 and "flame-arrow" in many


def test_roadmap_click_toggles_check(st, user_path):
    scr = RoadmapScreen(st, st.gamedata(), st.engine())
    scr.resize(1100, 700)
    scr.show()
    top = next(scr.tree.topLevelItem(i) for i in range(scr.tree.topLevelItemCount())
               if scr.tree.topLevelItem(i).isExpanded())
    leaf = top.child(0)
    rect = scr.tree.visualItemRect(leaf)
    QTest.mouseClick(scr.tree.viewport(), Qt.MouseButton.LeftButton, pos=QPoint(rect.x() + 80, rect.center().y()))
    assert leaf.checkState(0) == Qt.CheckState.Checked
    saved = json.loads(user_path.read_text())["roadmap_checks"]
    assert len(saved) == 1 and saved[0] == leaf.data(0, Qt.ItemDataRole.UserRole)
    assert scr.pill_done._v.text().startswith("1 /")
    items = roadmap_mod.roadmap(st.gamedata(), "global", st.build())
    assert saved[0] in {item_id(i) for i in items}
    QTest.mouseClick(scr.tree.viewport(), Qt.MouseButton.LeftButton, pos=QPoint(rect.x() + 80, rect.center().y()))
    assert leaf.checkState(0) == Qt.CheckState.Unchecked
    # clicking a band header folds it
    hrect = scr.tree.visualItemRect(top)
    QTest.mouseClick(scr.tree.viewport(), Qt.MouseButton.LeftButton, pos=QPoint(hrect.x() + 200, hrect.center().y()))
    assert not top.isExpanded()
