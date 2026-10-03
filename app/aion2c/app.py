"""QApplication wiring: gamedata, engine, AppState, MainWindow, Panel, hotkey.

Flags: --fake-engine (or AION2C_FAKE_ENGINE=1), --smoke [--shot DIR].
"""
import os
import sys
from pathlib import Path

from aion2c.models import CharacterBuild, Stats

FALLBACK = Path(__file__).parent / "data" / "fallback_gamedata.json"


def _fake_engine(argv: list[str]) -> bool:
    return "--fake-engine" in argv or os.environ.get("AION2C_FAKE_ENGINE") == "1"


def _initial_build(user: dict) -> CharacterBuild:
    from dataclasses import replace

    from aion2c.serde import from_dict

    name = user.get("active_build")
    saved = (user.get("builds") or {}).get(name) if name else None
    build = None
    if saved:
        try:
            build = from_dict(CharacterBuild, saved)
        except Exception as e:
            print(f"aion2c: could not restore build {name!r}: {e}", file=sys.stderr)
    if build is None:
        build = CharacterBuild("Sorcerer", "global", 45, stats=Stats())
    return replace(build, show_kr=bool(user.get("show_kr", build.show_kr)))


def _save_build(build: CharacterBuild) -> None:
    import aion2c.settings as settings
    from aion2c.serde import to_dict

    u = settings.load_user()
    u["builds"][build.name] = to_dict(build)
    u["active_build"] = build.name
    u["show_kr"] = build.show_kr
    settings.save_user(u)


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    from PySide6.QtWidgets import QApplication, QMessageBox

    import aion2c.settings as settings
    from aion2c.data.loader import load_gamedata
    from aion2c.state import AppState
    from aion2c.testing.fakes import FakeEngine, NullStateSource
    from aion2c.ui.hotkey import install_hotkey
    from aion2c.ui.main_window import MainWindow
    from aion2c.ui.panel import Panel

    from dataclasses import replace

    from aion2c.data.loader import available_classes

    from aion2c.ui.theme import TONES, apply_theme

    app = QApplication.instance() or QApplication(["aion2c"])
    app.setApplicationName("aion2c")
    app.setApplicationDisplayName("Aion 2 Companion")
    app.setOrganizationName("aion2c")
    apply_theme(app)
    user = settings.load_user()
    build = _initial_build(user)
    ckey = build.class_key if build.class_key in available_classes() else "sorcerer"
    smoke = "--smoke" in argv
    interactive = not smoke and app.platformName() != "offscreen"
    fake = _fake_engine(argv)
    banner = ""
    if fake:
        gd = load_gamedata(FALLBACK)
        engine = FakeEngine()
    else:
        from aion2c.engine.facade import Engine

        try:
            gd = load_gamedata(class_key=ckey)
        except Exception as e:
            banner = f"Game data failed to load ({e}); using bundled fallback data."
            print(f"aion2c: {banner}", file=sys.stderr)
            if interactive:
                QMessageBox.critical(None, "aion2c", banner)
            gd = load_gamedata(FALLBACK)
        engine = Engine(gd)

    if build.class_key != gd.class_key:  # saved class has no data (or fallback in use): follow the loaded data
        build = replace(build, class_key=gd.class_key)
    state = AppState(engine, gd, build)
    state.apply_settings()
    window = MainWindow(state, gd, engine)
    panel = Panel(state, gd, engine, NullStateSource())
    window.panelRequested.connect(panel.show)
    if banner:
        sb = window.statusBar()
        fg, bg, bd = TONES["error"]
        sb.setStyleSheet(f"QStatusBar{{background:{bg};color:{fg};border-top:1px solid {bd};}}")
        sb.showMessage(banner)
    state.buildChanged.connect(lambda: _save_build(state.build()))

    f = app.font()
    if f.pointSizeF() < 10:
        f.setPointSize(10)
        app.setFont(f)

    native = app.platformName() == "windows"
    wanted = user.get("hotkey") or "Ctrl+Shift+F12"
    hk = None
    for cand in dict.fromkeys([wanted, "Ctrl+Shift+F12", "Ctrl+Alt+F12"]):
        hk = install_hotkey(cand, panel.toggle, shortcut_parent=window, allow_native=native)
        if hk.native or not native:
            break
        hk.close()
    if not hk.native:  # none worked globally: keep the in-app shortcut for the user's key
        hk = install_hotkey(wanted, panel.toggle, shortcut_parent=window, allow_native=False)
        hk.warning = f"No global hotkey could be registered; {wanted} works only inside this app."
    if not banner:
        if hk.native:
            note = "" if hk.text == wanted else f" ({wanted} was taken)"
            window.statusBar().showMessage(f"Global hotkey for the panel: {hk.text}{note}")
        elif hk.warning:
            window.statusBar().showMessage(hk.warning)

    window.show()
    state.schedule_refresh()

    if smoke:
        from PySide6.QtCore import QEventLoop, QTimer

        def wait(ms: int) -> None:
            loop = QEventLoop()
            QTimer.singleShot(ms, loop.quit)
            loop.exec()

        wait(500)
        waited = 0  # then give the first optimize up to 30 s so the screenshots show data
        while state.current_result() is None and waited < 30000:
            wait(100)
            waited += 100
        panel.show()
        wait(100)
        if "--shot" in argv:
            out = Path(argv[argv.index("--shot") + 1])
            out.mkdir(parents=True, exist_ok=True)
            window.grab().save(str(out / "window.png"))
            panel.grab().save(str(out / "panel.png"))
            for i in range(window.tabs.count()):  # one shot per tab, for UI review
                window.tabs.setCurrentIndex(i)
                wait(150)
                name = window.tabs.tabText(i).lower().replace(" ", "_")
                window.grab().save(str(out / f"tab{i}_{name}.png"))
            window.tabs.setCurrentIndex(0)
        hk.close()
        state.shutdown()
        return 0
    code = app.exec()
    hk.close()
    state.shutdown()
    return code
