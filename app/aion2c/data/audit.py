"""Read-only audit of committed derived data and the browser engine payloads.

Run from app/: python -m aion2c.data.audit
This checks reproducibility, not the accuracy of unknown server-side mechanics.
"""
import argparse
import hashlib
import importlib.util
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SIZE_LIMITS = {"items.json": 6_000_000, "client_quick_use.json": 40_000, "client_progression.json": 50_000,
               "client_skill_numbers.json": 1_500_000, "client_skill_details.json": 20_000,
               "source-baseline.json": 32_000, "manifest.json": 16_000}


def _pointer(value, pointer):
    for part in pointer.removeprefix("/").split("/") if pointer else ():
        part = part.replace("~1", "/").replace("~0", "~")
        value = value[int(part)] if isinstance(value, list) else value[part]
    return value


def _contains_raw_export(value):
    if isinstance(value, dict):
        if {"Properties", "EffectValueList", "NeedCoolTime"} & value.keys():
            return True
        return any(_contains_raw_export(item) for item in value.values())
    if isinstance(value, list):
        return any(_contains_raw_export(item) for item in value)
    return False


def audit(root: Path = ROOT) -> dict:
    root = root.resolve()
    report = {"schema": 1, "ok": False, "source": {"region": "global", "export_client_build": None,
              "korea_validation": "not established by the Global export"}, "classes": [], "artifacts": [],
              "warnings": ["Export client patch is unknown; an installed client build does not identify this export."],
              "errors": [], "witnesses": []}
    errors = report["errors"]
    documents = {}

    def read(path):
        path = path.resolve()
        if not path.is_relative_to(root):
            raise ValueError("Audit paths must stay within the repository")
        if path in documents:
            return documents[path]
        limit = 40_000 if path.name == "icon_names.json" or path.parent.name == "icons" else SIZE_LIMITS.get(path.name, 2_000_000)
        if path.stat().st_size > limit:
            errors.append(f"Derived input exceeds size limit: {path.relative_to(root).as_posix()}")
            raise ValueError("Derived size limit")
        data = path.read_bytes()
        report["artifacts"].append({"path": path.relative_to(root).as_posix(), "bytes": len(data),
                                    "sha256": hashlib.sha256(data).hexdigest()})
        documents[path] = json.loads(data)
        if _contains_raw_export(documents[path]):
            errors.append(f"Raw export found in derived input: {path.relative_to(root).as_posix()}")
            raise ValueError("Raw export")
        return documents[path]

    def same(actual, expected, label):
        if actual != expected:
            errors.append(label)

    try:
        baseline = read(root / "docs/data/source-baseline.json")
        same(baseline["schema"], 1, "Unsupported source baseline schema")
        report["source"] = baseline["source"]
        same(baseline["source"]["region"], "global", "Baseline must distinguish Global from Korea")
        same(baseline["source"]["export_client_build"], None, "Export patch requires independent evidence before relabelling")
        for name in ("src/client_skill_numbers.json", "src/client_skill_details.json", "client_progression.json",
                     "items.json", "stat_sheet.json"):
            document = read(root / "app/aion2c/data" / name)
            label = baseline["source"]["export_label"] + (" (derived)" if name == "stat_sheet.json" else "")
            same(document.get("source"), label, f"Source provenance differs: {name}")
            same(document.get("client_version"), None, f"Source patch declaration requires review: {name}")
        for witness in baseline["witnesses"]:
            label = witness["id"]
            report["witnesses"].append(label)
            if not witness["unit"] or not witness["join"] or not witness["checks"]:
                errors.append(f"Witness lacks units, join or checks: {label}")
            for check in witness["checks"]:
                value = read(root / check["file"])
                if "collection" in check:
                    matches = [row for row in _pointer(value, check["collection"])
                               if row[check["key"]] == check["value"]]
                    if len(matches) != 1:
                        errors.append(f"Missing or ambiguous source join: {label}")
                        continue
                    value = matches[0]
                try:
                    same(_pointer(value, check["pointer"]), check["expected"], f"Witness value/unit differs: {label}")
                except (KeyError, IndexError, TypeError):
                    errors.append(f"Missing source join: {label}")
        if {name.split(".")[0] for name in report["witnesses"]} != {"skill", "item", "progression", "board"}:
            errors.append("Source witnesses must cover skill, item, progression and board data")
        script = root / "web/scripts/bundle_engine.py"
        spec = importlib.util.spec_from_file_location("audited_bundle", script)
        bundle = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(bundle)
        out = root / "web/public/engine"
        manifest = read(out / "manifest.json")
        classes = sorted((root / "app/aion2c/data/classes").glob("*/gamedata.json"))
        if not classes:
            errors.append("No class sources found")
        report["classes"] = [p.parent.name for p in classes]
        same(manifest["classes"], report["classes"], "Manifest class inventory differs from sources")
        same(sorted(p.stem for p in (out / "classes").glob("*.json")), report["classes"],
             "Browser class inventory differs from sources")
        same(sorted(p.stem for p in (out / "icons").glob("*.json")), report["classes"],
             "Browser icon inventory differs from sources")
        versions = {}
        for path in classes:
            source = read(path)
            versions[path.parent.name] = source["data_version"]
            same(read(out / "classes" / f"{path.parent.name}.json"), source,
                 f"Browser class payload differs: {path.parent.name}")
            icon_path = path.parent / "icon_names.json"
            icons = read(icon_path) if icon_path.is_file() else {}
            same(read(out / "icons" / f"{path.parent.name}.json"), icons,
                 f"Browser icon payload differs: {path.parent.name}")
            if not isinstance(icons, dict) or not all(isinstance(value, str) for value in icons.values()):
                errors.append(f"Icon input must contain resource names only: {path.parent.name}")
        same(manifest["data_versions"], versions, "Manifest class versions differ from sources")
        same(manifest["data_version"], max(versions.values(), default=""), "Manifest data version differs")
        if len(set(versions.values())) > 1:
            errors.append("Class data versions are mixed")
        same(manifest["engine_version"], bundle.engine_fingerprint(), "Engine fingerprint differs from source inputs")
        same(manifest["modules"], len(bundle.MODULES), "Manifest module count differs")
        same(manifest["items"], True, "Manifest must include the item payload")
        same(read(out / "items.json"), read(root / "app/aion2c/data/items.json"), "Browser item payload differs")
        archive = out / "aion2c.zip"
        raw = archive.read_bytes()
        report["artifacts"].append({"path": archive.relative_to(root).as_posix(), "bytes": len(raw),
                                    "sha256": hashlib.sha256(raw).hexdigest()})
        report["engine_version"] = manifest["engine_version"]
        with zipfile.ZipFile(archive) as packed:
            expected = {}
            for module in bundle.MODULES:
                path = bundle.module_file(module)
                expected[path.relative_to(bundle.APP).as_posix()] = path.read_bytes()
            for name in bundle.PY_DATA:
                path = root / "app/aion2c/data" / name
                document = read(path)
                same(document.get("client_version"), None, f"Source patch declaration requires review: {name}")
                expected[f"aion2c/data/{name}"] = path.read_bytes()
            same(sorted(packed.namelist()), sorted(expected), "Archive inventory differs from the bundle allowlist")
            for name, data in expected.items():
                same(packed.read(name), data, f"Archive payload differs: {name}")
    except (OSError, ValueError, KeyError, TypeError, zipfile.BadZipFile) as exc:
        errors.append(f"Audit input could not be read ({type(exc).__name__})")
    report["ok"] = not errors
    return report


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="Repository to audit (never a private export)")
    args = parser.parse_args(argv)
    report = audit(args.root)
    print(json.dumps(report, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
