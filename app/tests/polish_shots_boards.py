r"""Real-render screenshots of Daevanion + Keybinds for several classes -> %TEMP%\aion2c_polish\boards\.
Run (no offscreen): set PYTHONPATH=D:\Aion2\app; set AION2C_USER_PATH=<tmp>; python tests\polish_shots_boards.py [class ...]"""
import os
import sys
import tempfile
from pathlib import Path

os.environ.setdefault("AION2C_USER_PATH", str(Path(tempfile.gettempdir()) / "aion2c_polish_user.json"))
from PySide6.QtWidgets import QApplication

from aion2c.data.loader import default_path, load_gamedata
from aion2c.models import CharacterBuild, Stats
from aion2c.state import AppState
from aion2c.testing.fakes import FakeEngine
from aion2c.ui.theme import PALETTE, apply_theme

OUT = Path(tempfile.gettempdir()) / "aion2c_polish" / "boards"
OUT.mkdir(parents=True, exist_ok=True)


def main(classes):
    app = QApplication.instance() or QApplication(["x"])
    apply_theme(app)
    from aion2c.ui.daevanion_view import DaevanionView
    from aion2c.ui.keybinds_view import KeybindsScreen

    gd = load_gamedata(default_path("sorcerer"))
    st = AppState(FakeEngine(), gd, CharacterBuild("Test", "global", 45, class_key="sorcerer", stats=Stats()))
    dv = DaevanionView(st, gd, st.engine())
    kb = KeybindsScreen(st, gd, st.engine())
    for w in (dv, kb):
        w.setObjectName("Root")
        w.setStyleSheet(f"#Root{{background:{PALETTE['bg']};}}")
        w.resize(1280, 860)
        w.show()
    for c in classes:
        st.set_class(c)
        app.processEvents()
        if dv.tabs.count() > 1:
            dv.tabs.setCurrentIndex(0)
        # take a few nodes on the first board so the 'selected' look is visible
        b = dv.board()
        if b:
            from aion2c import daevanion as D
            sel = set()
            for _ in range(7):
                nxt = sorted(D.selectable(b, frozenset(sel)))
                if not nxt:
                    break
                sel.add(nxt[0])
            dv.state.set_build(__import__("dataclasses").replace(dv.state.build(), daevanion_nodes=frozenset(sel)))
        kb.set_slot("1", None)
        for i, sk in enumerate([x for x in kb._skills(st.gamedata())][:9]):
            kb.set_slot("1234567890-="[i], sk.key)
        if "--letters" in sys.argv:
            kb.more_btn.setChecked(True)
        kb.generate_btn.click()
        app.processEvents()
        dv.grab().save(str(OUT / f"daevanion_{c}.png"))
        kb.grab().save(str(OUT / f"keybinds_{c}.png"))
        print("saved", c)


if __name__ == "__main__":
    main([a for a in sys.argv[1:] if not a.startswith("--")] or ["sorcerer", "templar", "ranger"])
