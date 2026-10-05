"""Bundle the Qt-free aion2c engine for the browser (Pyodide).

Writes into web/public/engine/:
  aion2c.zip              Qt-free modules + webapi.py (python sources) and PY_DATA (data/stat_sheet.json)
  classes/<key>.json      app/aion2c/data/classes/<key>/gamedata.json
  icons/<key>.json        app/aion2c/data/classes/<key>/icon_names.json  ({skill_key: ICON_NAME}; names only)
  items.json              app/aion2c/data/items.json, minified; fetched lazily by the worker on the first gear call
  manifest.json           {classes, data_version, built_at, modules}
No images are copied (icons are hotlinked from NCSoft's CDN). Run: python web/scripts/bundle_engine.py
"""
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "app"
PKG = APP / "aion2c"
OUT = ROOT / "web" / "public" / "engine"

# Explicit allowlist: adding a module here is a decision (test_engine_qt_free.py checks each one imports without Qt).
MODULES = (
    "aion2c", "aion2c.models", "aion2c.serde", "aion2c.interfaces", "aion2c.classes", "aion2c.armory",
    "aion2c.daevanion", "aion2c.crafting", "aion2c.roadmap", "aion2c.gear", "aion2c.statsheet", "aion2c.webapi",
    "aion2c.data", "aion2c.data.loader",
    "aion2c.engine", "aion2c.engine.advisor", "aion2c.engine.budget", "aion2c.engine.build_optimizer",
    "aion2c.engine.community", "aion2c.engine.damage", "aion2c.engine.explain", "aion2c.engine.facade",
    "aion2c.engine.next_skills", "aion2c.engine.rotation", "aion2c.engine.search", "aion2c.engine.simulator",
    "aion2c.engine.specialties", "aion2c.engine.rank_values", "aion2c.specs", "aion2c.specparse",
    "aion2c.keybinds", "aion2c.keybinds.export", "aion2c.keybinds.gkeys", "aion2c.keybinds.layout",
    "aion2c.keybinds.macro",
)


PY_DATA = ("stat_sheet.json",)  # data files packed into aion2c.zip next to the modules


def bundled_modules() -> list[str]:
    return list(MODULES)


def module_file(mod: str) -> Path:
    base = APP.joinpath(*mod.split("."))
    f = base.with_suffix(".py")
    return f if f.is_file() else base / "__init__.py"


def missing_imports() -> list[str]:
    """aion2c modules imported by bundled modules but absent from MODULES (would fail in Pyodide)."""
    import ast

    missing = set()
    for m in MODULES:
        tree = ast.parse(module_file(m).read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [a.name for a in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
                # `from aion2c.x import y` may import submodule aion2c.x.y
                names = [node.module] + [f"{node.module}.{a.name}" for a in node.names]
            else:
                continue
            for n in names:
                if n.startswith("aion2c") and n not in MODULES:
                    f = APP.joinpath(*n.split("."))
                    if f.with_suffix(".py").is_file() or (f / "__init__.py").is_file():
                        missing.add(n)
    return sorted(missing)


def build_zip(dest: Path) -> int:
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
        for m in MODULES:
            f = module_file(m)
            z.write(f, f.relative_to(APP).as_posix())
        for d in PY_DATA:  # small derived tables the Python code reads with Path(__file__)
            z.write(PKG / "data" / d, f"aion2c/data/{d}")
    return dest.stat().st_size


def main() -> int:
    gap = missing_imports()
    if gap:
        # Shipping without these breaks the live site with ModuleNotFoundError; add them to MODULES.
        print("bundle_engine: modules imported but not bundled: " + ", ".join(gap), file=sys.stderr)
        return 1
    for sub in ("classes", "icons"):
        (OUT / sub).mkdir(parents=True, exist_ok=True)
    size = build_zip(OUT / "aion2c.zip")
    classes, versions = [], {}
    for d in sorted((PKG / "data" / "classes").iterdir()):
        gd = d / "gamedata.json"
        if not gd.is_file():
            continue
        data = json.loads(gd.read_text(encoding="utf-8"))
        (OUT / "classes" / f"{d.name}.json").write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
        ic = d / "icon_names.json"
        icons = json.loads(ic.read_text(encoding="utf-8")) if ic.is_file() else {}
        (OUT / "icons" / f"{d.name}.json").write_text(json.dumps(icons, separators=(",", ":")), encoding="utf-8")
        classes.append(d.name)
        versions[d.name] = data.get("data_version", "")
    items_src = PKG / "data" / "items.json"
    items_size = 0
    if items_src.is_file():
        items = json.loads(items_src.read_text(encoding="utf-8"))
        (OUT / "items.json").write_text(json.dumps(items, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
        items_size = (OUT / "items.json").stat().st_size
    manifest = {
        "classes": classes,
        "data_version": max(versions.values(), default=""),
        "data_versions": versions,
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "modules": len(MODULES),
        "items": bool(items_size),
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    print(f"aion2c.zip {size / 1024:.0f} KiB, {len(MODULES)} modules; items.json {items_size / 1024:.0f} KiB; classes: {', '.join(classes)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
