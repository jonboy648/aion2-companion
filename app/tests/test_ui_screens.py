"""P7 window-mode screens. Uses a local stub AppState so P6's real state can evolve independently."""
import json
from dataclasses import replace

import pytest
from PySide6.QtCore import QObject, Qt, Signal
from PySide6.QtWidgets import QApplication

from aion2c.models import (
    SCENARIOS,
    CharacterBuild,
    GKeyAssignment,
    KeybindPlan,
    MacroEntry,
    MacroPlan,
    RoadmapItem,
    SlotStack,
    Stats,
)
from aion2c.testing.fakes import FakeEngine
from aion2c.ui.build_planner import BuildScreen
from aion2c.ui.codex import CodexScreen
from aion2c.ui.keybinds_view import KeybindsScreen
from aion2c.ui.main_window import MainWindow
from aion2c.ui.roadmap_view import RoadmapScreen, item_id
from aion2c.ui.upgrade import UpgradeScreen


class StubState(QObject):
    buildChanged = Signal()
    resultsReady = Signal(object)
    dataChanged = Signal()

    def __init__(self, gd, build, engine, scenario_key="boss_180"):
        super().__init__()
        self._gd, self._build, self._engine = gd, build, engine
        self._scenario = next(s for s in SCENARIOS if s.key == scenario_key)
        self._result = None

    def build(self):
        return self._build

    def scenario(self):
        return self._scenario

    def gamedata(self):
        return self._gd

    def class_key(self):
        return self._gd.class_key

    def best_priority(self):
        return self._result.options[0].priority if self._result and self._result.options else None

    def show_kr(self):
        return self._build.show_kr

    def current_result(self):
        return self._result

    def set_build(self, b):
        self._build = b
        self.buildChanged.emit()

    def set_scenario(self, key):
        self._scenario = next(s for s in SCENARIOS if s.key == key)
        self._result = None
        self.buildChanged.emit()

    def set_show_kr(self, v):
        self.set_build(replace(self._build, show_kr=bool(v)))

    def set_gamedata(self, gd):
        self._gd = gd
        self.dataChanged.emit()

    def deliver_results(self):
        self._result = self._engine.optimize(self._build, self._scenario)
        self.resultsReady.emit(self._result)


@pytest.fixture
def env(qapp, sorc_gd, user_path):
    eng = FakeEngine()
    st = StubState(sorc_gd, CharacterBuild("Test", "global", 45, stats=Stats(crit_chance_pct=0)), eng)
    return st, sorc_gd, eng


def fake_plan() -> KeybindPlan:
    return KeybindPlan(
        stacks=(SlotStack("1", ("flame-arrow", "burst")),),
        macros=(MacroPlan("Boss loop", "F9", (MacroEntry(1, "1"), MacroEntry(2, "2"))),),
        gkeys=(GKeyAssignment("G1", "M1", "F9", "Boss loop", "lowest_known"),),
        macro_dps={"Boss loop": 1500.0},
        ideal_dps={"boss_180": 1800.0},
        manual_every_s={"hellfire": 12.0},
        warnings=("macro DPS below 95% of ideal",),
    )


def test_main_window_tabs(env):
    st, gd, eng = env
    w = MainWindow(st, gd, eng)
    assert w.tabs.count() == 8
    assert [w.tabs.tabText(i) for i in range(8)] == [
        "My Build", "Codex", "Build", "Upgrade", "Daevanion", "Crafting", "Road Map", "Keybinds",
    ]


def test_toolbar_drives_state_and_panel_signal(env):
    st, gd, eng = env
    w = MainWindow(st, gd, eng)
    got = []
    w.panelRequested.connect(lambda: got.append(1))
    w.panel_btn.click()
    assert got == [1]
    w.region.setCurrentIndex(w.region.findData("korea"))
    assert st.build().region == "korea"
    w.show_kr.setChecked(True)
    assert st.show_kr() is True
    w.scenario.setCurrentIndex(w.scenario.findData("aoe_pack"))
    assert st.scenario().key == "aoe_pack"
    # state -> toolbar sync without feedback loop
    st.set_scenario("level_pull")
    assert w.scenario.currentData() == "level_pull"


def test_codex_lists_skills(env):
    st, gd, eng = env
    c = CodexScreen(st, gd, eng)
    assert c.list.count() == 13
    c.search.setText("flame")
    assert c.list.count() >= 1
    assert all("flame" in c.list.item(i).text().lower() or "flame" in c.list.item(i).data(Qt.ItemDataRole.UserRole)
               for i in range(c.list.count()))


def test_codex_rank_cap(env):
    st, gd, eng = env
    c = CodexScreen(st, gd, eng)
    assert len(gd.skills["flame-arrow"].ranks) == 40
    c._show("flame-arrow")
    assert c.ranks.rowCount() == 20
    st.set_build(replace(st.build(), region="korea"))
    c._show("flame-arrow")
    assert c.ranks.rowCount() == 40


def test_codex_confidence_rendering(env):
    st, gd, eng = env
    c = CodexScreen(st, gd, eng)
    c._show("flame-arrow")
    assert c.ranks.item(0, 3).text()  # cooldown cell rendered
    # an estimated Num is amber-coloured with a tooltip naming the confidence
    from aion2c.models import Num
    from aion2c.ui.codex import num_item
    it = num_item(Num(1.5, "estimated", "src"))
    assert it.text() == "~1.5" and "src" in it.toolTip()
    assert num_item(Num(None, "unknown")).text().startswith("?")
    assert num_item(Num(2.0, "confirmed")).text() == "2"


def test_calibrate_saves(env, monkeypatch):
    st, gd, eng = env
    b = BuildScreen(st, gd, eng)
    calls = []
    monkeypatch.setattr(st, "set_gamedata", lambda g: calls.append(g))
    row = next(r for r in range(b.calib.rowCount()) if b.calib.item(r, 0).data(Qt.ItemDataRole.UserRole) == "hellfire")
    b.calib.item(row, 2).setText("2.5")
    saved = json.loads(open(st_user_path()).read())
    assert saved["anim_overrides"] == {"hellfire": 2.5}
    assert calls == [gd]
    b.calib.item(row, 2).setText("")  # clearing removes the override
    assert json.loads(open(st_user_path()).read())["anim_overrides"] == {}
    b.calib.item(row, 2).setText("abc")  # invalid input is rejected, nothing saved
    assert json.loads(open(st_user_path()).read())["anim_overrides"] == {}
    assert b.calib.item(row, 2).text() == ""


def st_user_path():
    from aion2c.settings import user_path

    return user_path()


def test_build_results_table(env):
    st, gd, eng = env
    b = BuildScreen(st, gd, eng)
    st.deliver_results()
    assert len(b.option_cards) == 3
    assert b.option_cards[0].dps_label.text() == "1,800"
    assert b.explanation.text() == "fake option 1"
    b.option_cards[2].clicked.emit(2)
    assert b.explanation.text() == "fake option 3"
    assert b.option_cards[2].property("selected") is True and b.option_cards[0].property("selected") is False
    assert len(b.rotation_names) == 3 and "Blaze" in b.rotation_names[0]
    assert b.stats_form.advanced.isChecked() is False


def test_build_hides_near_duplicate_options(env):
    from aion2c.testing.fakes import fake_sim_result

    st, gd, eng = env
    b = BuildScreen(st, gd, eng)
    res = eng.optimize(st.build(), st.scenario())
    o = res.options
    opts = (o[0], replace(o[1], result=fake_sim_result(1795.0)), replace(o[2], result=fake_sim_result(1500.0)), o[1])
    b.show_results(replace(res, options=opts))
    assert len(b.option_cards) == 3  # 1795 is within 0.5% of 1800 and is skipped; max 3 shown
    assert [c.dps_label.text() for c in b.option_cards] == ["1,800", "1,500", "1,600"]


def test_build_edits_go_through_set_build(env):
    st, gd, eng = env
    b = BuildScreen(st, gd, eng)
    b.level.setValue(30)
    assert st.build().level == 30
    sp = b._rank_spins["flame-arrow"]
    assert sp.maximum() == 20  # global cap
    sp.setValue(7)
    assert st.build().skill_ranks["flame-arrow"] == 7
    b.stats_form.spins["attack"].setValue(1234)
    assert st.build().stats.attack == 1234
    b.skill_points.setValue(15)
    assert st.build().skill_points == 15
    b.skill_points.setValue(-1)
    assert st.build().skill_points is None


def test_build_stigma_limit(env):
    st, gd, eng = env
    st.set_gamedata(replace(gd, stigma_slots={"global": 1, "korea": 6}))  # fixture has only 2 stigmas
    b = BuildScreen(st, st.gamedata(), eng)
    assert b.stigmas.count() == 2
    b.stigmas.item(0).setCheckState(Qt.CheckState.Checked)
    assert len(st.build().stigmas) == 1
    b.stigmas.item(1).setCheckState(Qt.CheckState.Checked)  # over the 1-slot limit: reverted
    assert len(st.build().stigmas) == 1
    assert b.stigmas.item(1).checkState() == Qt.CheckState.Unchecked


def test_auto_spend_uses_budget_module(env, monkeypatch):
    st, gd, eng = env
    b = BuildScreen(st, gd, eng)
    st.deliver_results()
    seen = {}

    def fake_alloc(gd_, build, prio, scen, cfg=None):
        seen["prio"] = prio
        return {"flame-arrow": 5}, [("flame-arrow", 5, 3.2)]

    monkeypatch.setattr("aion2c.engine.budget.allocate_points", fake_alloc)
    b.run_auto_spend()
    assert seen["prio"] == st.best_priority()
    assert st.build().skill_ranks == {"flame-arrow": 5}
    assert "3.2%" in b.points_label.text()


def test_compare_pins_then_compares(env):
    st, gd, eng = env
    b = BuildScreen(st, gd, eng)
    b.compare()
    assert eng.calls.count("optimize") == 3 and b.compare_table.rowCount() == 0
    st.set_build(replace(st.build(), name="B"))
    b.compare()
    assert eng.calls.count("optimize") == 6
    assert b.compare_table.rowCount() == 3 and b.compare_table.item(0, 3).text() == "+0.0%"
    b.clear_pin()
    assert b.compare_table.rowCount() == 0


def test_upgrade_table(env):
    st, gd, eng = env
    u = UpgradeScreen(st, gd, eng)
    assert len(u.rows) == 0  # no priority yet
    st.deliver_results()
    assert len(u.rows) == 3
    assert u.rows[0].stat == "smite_pct"
    assert "marginal" in eng.calls
    u.form.spins["smite_pct"].setValue(9)
    assert st.build().stats.smite_pct == 9


def test_roadmap_checks_persist(env, monkeypatch):
    st, gd, eng = env
    items = [
        RoadmapItem(5, "skill", "Learn X", frozenset({"global"})),
        RoadmapItem(22, "stigma", "Stigma slot", frozenset({"global"})),
    ]
    monkeypatch.setattr("aion2c.roadmap.roadmap", lambda gd_, region, build=None: items)
    r = RoadmapScreen(st, gd, eng)
    assert r.tree.topLevelItemCount() == 2  # bands 1-10 and 21-30
    leaf = r.tree.topLevelItem(1).child(0)
    leaf.setCheckState(0, Qt.CheckState.Checked)
    assert json.loads(open(st_user_path()).read())["roadmap_checks"] == [item_id(items[1])]
    r2 = RoadmapScreen(st, gd, eng)
    assert r2.tree.topLevelItem(1).child(0).checkState(0) == Qt.CheckState.Checked
    assert r2.tree.topLevelItem(0).child(0).checkState(0) == Qt.CheckState.Unchecked
    leaf2 = r2.tree.topLevelItem(1).child(0)
    leaf2.setCheckState(0, Qt.CheckState.Unchecked)
    assert json.loads(open(st_user_path()).read())["roadmap_checks"] == []


def test_roadmap_stub_error_does_not_crash(env):
    st, gd, eng = env  # real roadmap may still be a NotImplementedError stub or work: either way no crash
    RoadmapScreen(st, gd, eng)


def test_keybinds_generate_and_copy(env, monkeypatch, sorc_bar):
    st, gd, eng = env
    got = {}

    def fake_plan_fn(gd_, build, priorities, bar, hotkeys=None, delay_ms=10, cfg=None):
        got.update(priorities=priorities, bar=bar, hotkeys=hotkeys, delay=delay_ms)
        return fake_plan()

    monkeypatch.setattr("aion2c.keybinds.export.plan", fake_plan_fn)
    monkeypatch.setattr("aion2c.keybinds.export.instructions_markdown", lambda p, g: "# Setup\nG1 sends F9\n")
    from aion2c.settings import load_user, save_user

    u = load_user()
    u["skill_bar"] = dict(sorc_bar.slots)
    save_user(u)
    st.deliver_results()  # current scenario boss_180: best_priority used, aoe via engine.optimize
    eng.calls.clear()
    k = KeybindsScreen(st, gd, eng)
    k.aoe_key.setText("F11")
    k.aoe_key.editingFinished.emit()
    k.delay.setValue(40)
    k.generate()
    assert eng.calls.count("optimize") == 1  # only the other scenario
    assert set(got["priorities"]) == {"boss_180", "aoe_pack"}
    assert got["priorities"]["boss_180"] == st.best_priority()
    assert got["hotkeys"] == {"boss": "F9", "aoe": "F11"} and got["delay"] == 40
    assert got["bar"].slots["1"] == "flame-arrow"
    assert k.stacks.rowCount() == 1 and k.macro_cards.count() == 1 and k.gkeys.rowCount() == 1
    assert "hellfire" not in k.manual.item(0).text() and "Hellfire" in k.manual.item(0).text()
    assert k.dps.rowCount() == 2
    assert k.warnings.count() == 1
    k.copy_instructions()
    assert "G1" in QApplication.clipboard().text()
    assert k._markdown.startswith("# Setup")
    saved = json.loads(open(st_user_path()).read())
    assert saved["macro_keys"] == {"boss": "F9", "aoe": "F11"} and saved["macro_delay_ms"] == 40


def test_keybinds_bar_edit_persists(env):
    st, gd, eng = env
    k = KeybindsScreen(st, gd, eng)
    k.set_slot("3", "hellfire")
    assert json.loads(open(st_user_path()).read())["skill_bar"] == {"3": "hellfire"}
    assert KeybindsScreen(st, gd, eng).slot_skill("3") == "hellfire"
    assert k.current_bar().slots == {"3": "hellfire"}


def test_keybinds_prefills_empty_bar_from_best_priority(env):
    st, gd, eng = env
    st.deliver_results()
    k = KeybindsScreen(st, gd, eng)
    bar = k.current_bar().slots
    assert bar["1"] == "element-enhancement" and bar["2"] == "hellfire" and len(bar) >= 5
    assert not k.prefill_hint.isHidden() and "Pre-filled" in k.prefill_hint.text()
    assert not k.keyboard.is_tile_visible("A") and k.keyboard.is_tile_visible("=")
    k.more_btn.setChecked(True)
    assert k.keyboard.is_tile_visible("A")


def test_keybinds_generate_failure_is_reported(env, monkeypatch):
    st, gd, eng = env

    def boom(*a, **kw):
        raise NotImplementedError("P5")

    monkeypatch.setattr("aion2c.keybinds.export.plan", boom)
    k = KeybindsScreen(st, gd, eng)
    k.generate()
    assert "failed" in k.status.text()


def test_main_window_with_real_appstate(qapp, sorc_gd, user_path):
    from aion2c.state import AppState

    eng = FakeEngine()
    st = AppState(eng, sorc_gd, CharacterBuild("Test", "global", 45))
    w = MainWindow(st, sorc_gd, eng)
    w.resize(1400, 900)
    assert w.tabs.count() == 8
    for i in range(8):
        w.tabs.setCurrentIndex(i)
        assert not w.grab().isNull()
