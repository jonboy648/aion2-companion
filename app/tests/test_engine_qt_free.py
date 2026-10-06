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


def test_browser_archive_contains_quick_use_code_and_client_contract(tmp_path):
    import zipfile
    bundle = _bundle()
    archive = tmp_path / "engine.zip"
    bundle.build_zip(archive)
    with zipfile.ZipFile(archive) as packed:
        assert "aion2c/keybinds/quick_use.py" in packed.namelist()
        assert "aion2c/data/client_quick_use.json" in packed.namelist()
    assert bundle.missing_imports() == []


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


def test_engine_fingerprint_follows_engine_code(tmp_path, monkeypatch):
    """manifest engine_version (the browser result-cache key) must change when a bundled engine module changes."""
    import shutil

    spec = importlib.util.spec_from_file_location("bundle_engine_fp", BUNDLE_SCRIPT)
    be = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(be)
    assert be.fingerprint([("a.py", b"x = 1")]) != be.fingerprint([("a.py", b"x = 2")])
    assert be.fingerprint([("a.py", b"x"), ("b.py", b"y")]) == be.fingerprint([("b.py", b"y"), ("a.py", b"x")])
    # a scratch copy of the bundled sources, so the real tree is never touched
    app, pkg = tmp_path / "app", tmp_path / "app" / "aion2c"
    for m in be.MODULES:
        src = be.module_file(m)
        dst = app / src.relative_to(be.APP)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, dst)
    (pkg / "data").mkdir(exist_ok=True)
    for d in be.PY_DATA:
        shutil.copy(be.PKG / "data" / d, pkg / "data" / d)
    monkeypatch.setattr(be, "APP", app)
    monkeypatch.setattr(be, "PKG", pkg)
    before = be.engine_fingerprint()
    assert before == be.engine_fingerprint()
    damage = pkg / "engine" / "damage.py"
    damage.write_text(damage.read_text(encoding="utf-8") + "\n# changed\n", encoding="utf-8")
    assert be.engine_fingerprint() != before
    code_changed = be.engine_fingerprint()
    contract = pkg / "data" / "client_quick_use.json"
    contract.write_text(contract.read_text(encoding="utf-8") + "\n", encoding="utf-8")
    assert be.engine_fingerprint() != code_changed
