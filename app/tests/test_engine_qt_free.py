"""The browser bundle must never pull in Qt: import every bundled module with PySide6 blocked."""
import importlib.util
import subprocess
import sys
import textwrap
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
BUNDLE_SCRIPT = APP.parent / "web" / "scripts" / "bundle_engine.py"


def _bundle():
    spec = importlib.util.spec_from_file_location("bundle_engine", BUNDLE_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_bundle_lists_expected_modules():
    mods = set(_bundle().bundled_modules())
    for need in ("aion2c.models", "aion2c.serde", "aion2c.engine.build_optimizer", "aion2c.data.loader",
                 "aion2c.daevanion", "aion2c.crafting", "aion2c.roadmap", "aion2c.keybinds.export",
                 "aion2c.armory", "aion2c.classes", "aion2c.webapi"):
        assert need in mods, need
    assert not any(m.startswith("aion2c.ui") or m in ("aion2c.state", "aion2c.app") for m in mods)


def test_no_bundled_module_imports_pyside6():
    mods = _bundle().bundled_modules()
    code = textwrap.dedent(f"""
        import sys, importlib
        sys.modules['PySide6'] = None  # sentinel: any `import PySide6...` raises ImportError
        sys.modules['shiboken6'] = None
        for m in {mods!r}:
            importlib.import_module(m)
        leaked = [k for k in sys.modules if k.split('.')[0] in ('PySide6', 'shiboken6') and sys.modules[k] is not None]
        assert not leaked, leaked
        print('ok', len({mods!r}))
    """)
    r = subprocess.run([sys.executable, "-c", code], cwd=APP, capture_output=True, text=True)
    assert r.returncode == 0 and r.stdout.startswith("ok"), r.stderr


def test_bundled_sources_never_mention_pyside6():
    root = APP / "aion2c"
    for m in _bundle().bundled_modules():
        p = root.parent.joinpath(*m.split(".")).with_suffix(".py")
        if not p.is_file():
            p = p.with_suffix("") / "__init__.py"
        assert "PySide6" not in p.read_text(encoding="utf-8"), p
