import json

from PySide6.QtCore import QEventLoop, QTimer

import aion2c.settings as settings
from aion2c.models import CharacterBuild, SimConfig, Stats
from aion2c.state import AppState, config_from_settings


def spin(ms):
    loop = QEventLoop()
    QTimer.singleShot(ms, loop.quit)
    loop.exec()


def wait_for(cond, timeout_ms=2000):
    waited = 0
    while not cond() and waited < timeout_ms:
        spin(20)
        waited += 20
    return cond()


def mk(fake_engine, sorc_gd, user_path):
    build = CharacterBuild("T", "global", 45, stats=Stats())
    return AppState(fake_engine, sorc_gd, build)


def test_state_emits_results(qapp, fake_engine, sorc_gd, user_path):
    st = mk(fake_engine, sorc_gd, user_path)
    got = []
    st.resultsReady.connect(got.append)
    st.schedule_refresh()
    assert wait_for(lambda: got)
    assert got[0].scenario.key == "boss_180"
    assert st.current_result() is got[0]
    assert st.best_priority() == got[0].options[0].priority
    st.shutdown()


def test_state_debounce(qapp, fake_engine, sorc_gd, user_path):
    st = mk(fake_engine, sorc_gd, user_path)
    got = []
    st.resultsReady.connect(got.append)
    for lvl in (10, 20, 30):
        st.set_build(CharacterBuild("T", "global", lvl, stats=Stats()))
    assert wait_for(lambda: got)
    spin(400)
    assert fake_engine.calls.count("optimize") == 1
    assert len(got) == 1
    st.shutdown()


def test_state_scenario_drops_stale_result(qapp, fake_engine, sorc_gd, user_path):
    st = mk(fake_engine, sorc_gd, user_path)
    st.set_scenario("aoe_pack")
    assert st.current_result() is None
    got = []
    st.resultsReady.connect(got.append)
    assert wait_for(lambda: got)
    assert st.scenario().key == "aoe_pack"
    st.shutdown()


def test_state_show_kr(qapp, fake_engine, sorc_gd, user_path):
    st = mk(fake_engine, sorc_gd, user_path)
    seen = []
    st.buildChanged.connect(lambda: seen.append(1))
    st.set_show_kr(True)
    assert st.show_kr() is True and st.build().show_kr and seen
    st.shutdown()


def test_state_set_config(qapp, fake_engine, sorc_gd, user_path):
    st = mk(fake_engine, sorc_gd, user_path)
    u = settings.load_user()
    u["anim_overrides"] = {"flame-arrow": 1.5}
    u["auto_chain"] = False
    user_path.write_text(json.dumps(u), encoding="utf-8")
    st.dataChanged.emit()
    assert "set_config" in fake_engine.calls
    assert fake_engine.cfg.anim_overrides == {"flame-arrow": 1.5}
    assert fake_engine.cfg.auto_chain is False
    st.shutdown()


def test_set_gamedata_emits_and_configures(qapp, fake_engine, sorc_gd, user_path):
    st = mk(fake_engine, sorc_gd, user_path)
    hits = []
    st.dataChanged.connect(lambda: hits.append(1))
    st.set_gamedata(sorc_gd)
    assert hits and "set_config" in fake_engine.calls
    st.shutdown()


def test_config_from_settings_tolerates_junk():
    cfg = config_from_settings({"anim_overrides": {"a": "x", "b": 2}, "auto_chain": True})
    assert cfg == SimConfig(anim_overrides={"b": 2.0})


def test_settings_self_save_ignored(qapp, fake_engine, sorc_gd, user_path):
    st = mk(fake_engine, sorc_gd, user_path)
    hits = []
    st.dataChanged.connect(lambda: hits.append(1))
    u = settings.load_user()
    u["roadmap_checks"] = ["a"]
    settings.save_user(u)
    spin(400)
    u["roadmap_checks"] = ["a", "b"]
    settings.save_user(u)
    spin(400)
    assert hits == []
    assert "set_config" not in fake_engine.calls
    st.shutdown()


def test_external_user_edit_emits(qapp, fake_engine, sorc_gd, user_path):
    settings.save_user(settings.load_user())
    st = mk(fake_engine, sorc_gd, user_path)
    hits = []
    st.dataChanged.connect(lambda: hits.append(1))
    user_path.write_text(json.dumps({"anim_overrides": {"x": 2.0}}), encoding="utf-8")
    assert wait_for(lambda: hits, 3000)
    assert fake_engine.cfg.anim_overrides == {"x": 2.0}
    st.shutdown()
