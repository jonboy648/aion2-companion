import os
import subprocess
import sys
from pathlib import Path

from PySide6.QtCore import QEventLoop, Qt, QTimer

from aion2c.models import CharacterBuild, Stats
from aion2c.state import AppState
from aion2c.testing.fakes import NullStateSource
from aion2c.ui import icons
from aion2c.ui.panel import Panel

APP_ROOT = Path(__file__).resolve().parent.parent


def spin(ms):
    loop = QEventLoop()
    QTimer.singleShot(ms, loop.quit)
    loop.exec()


def make(fake_engine, sorc_gd):
    st = AppState(fake_engine, sorc_gd, CharacterBuild("T", "global", 45, stats=Stats()))
    return st, Panel(st, sorc_gd, fake_engine, NullStateSource())


def test_panel_flags(qapp, fake_engine, sorc_gd, user_path):
    st, p = make(fake_engine, sorc_gd)
    f = p.windowFlags()
    assert f & Qt.WindowType.WindowStaysOnTopHint
    assert f & Qt.WindowType.FramelessWindowHint
    assert p.testAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
    assert abs(p.windowOpacity() - 0.85) < 0.01
    assert not (f & Qt.WindowType.WindowTransparentForInput)
    p.set_click_through(True)
    assert p.windowFlags() & Qt.WindowType.WindowTransparentForInput
    assert p.windowFlags() & Qt.WindowType.WindowStaysOnTopHint
    st.shutdown()


def test_panel_shows_icons(qapp, fake_engine, sorc_gd, user_path):
    st, p = make(fake_engine, sorc_gd)
    st.refresh()  # synchronous: emits resultsReady
    assert p.slot_keys() == ["flame-arrow", "burst", "pyroclasm", "firestorm", "hellfire"]
    assert len(p.slots) == 5
    for lab in p.slots:
        assert lab.pixmap() is not None and not lab.pixmap().isNull()
    st.shutdown()


def test_panel_updates_from_threaded_run(qapp, fake_engine, sorc_gd, user_path):
    st, p = make(fake_engine, sorc_gd)
    st.schedule_refresh()
    for _ in range(100):
        spin(20)
        if p.slot_keys():
            break
    assert p.slot_keys()[0] == "flame-arrow"
    assert "next_skills" in fake_engine.calls
    st.shutdown()


def test_icons_never_none(qapp, sorc_gd):
    icons.clear_cache()
    pm = icons.pixmap(sorc_gd, "no-such-skill", 24)
    assert not pm.isNull() and pm.width() == 24
    assert not icons.pixmap(sorc_gd, "flame-arrow", 32).isNull()
    assert icons.pixmap(sorc_gd, "flame-arrow", 32) is icons.pixmap(sorc_gd, "flame-arrow", 32)


def test_smoke_cli(tmp_path):
    env = {**os.environ, "QT_QPA_PLATFORM": "offscreen", "AION2C_USER_PATH": str(tmp_path / "user.json")}
    shots = tmp_path / "shots"
    r = subprocess.run(
        [sys.executable, "-m", "aion2c", "--smoke", "--shot", str(shots)],
        cwd=APP_ROOT, env=env, capture_output=True, text=True, timeout=120,
    )
    assert r.returncode == 0, r.stderr
    assert (shots / "window.png").stat().st_size > 1000
    assert (shots / "panel.png").stat().st_size > 200
