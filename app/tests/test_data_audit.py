"""Exercise the source-to-browser audit through its report and command-line interface."""
import importlib.util
import json
import shutil
from pathlib import Path

import pytest

from aion2c.data.audit import audit, main

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def audited_repo(tmp_path):
    root = tmp_path / "repo"
    script = root / "web/scripts/bundle_engine.py"
    script.parent.mkdir(parents=True)
    shutil.copy(ROOT / "web/scripts/bundle_engine.py", script)
    spec = importlib.util.spec_from_file_location("audit_fixture_bundle", ROOT / "web/scripts/bundle_engine.py")
    bundle = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bundle)
    for module in bundle.MODULES:
        relative = bundle.module_file(module).relative_to(ROOT)
        destination = root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(ROOT / relative, destination)
    for name in bundle.PY_DATA:
        relative = Path("app/aion2c/data") / name
        shutil.copy(ROOT / relative, root / relative)
    for relative in ("docs/data/source-baseline.json", "app/aion2c/data/src/client_skill_numbers.json",
                     "app/aion2c/data/src/client_skill_details.json", "web/src/features/progression/data.json"):
        destination = root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(ROOT / relative, destination)
    for relative in ("app/aion2c/data/classes",):
        shutil.copytree(ROOT / relative, root / relative, ignore=shutil.ignore_patterns("*.png", "__pycache__"))
    items = root / "app/aion2c/data/items.json"
    shutil.copy(ROOT / items.relative_to(root), items)
    bundle.APP = root / "app"
    bundle.PKG = root / "app/aion2c"
    out = root / "web/public/engine"
    (out / "classes").mkdir(parents=True)
    (out / "icons").mkdir()
    bundle.build_zip(out / "aion2c.zip")
    versions = {}
    for source in sorted((root / "app/aion2c/data/classes").glob("*/gamedata.json")):
        doc = json.loads(source.read_bytes())
        versions[source.parent.name] = doc["data_version"]
        (out / "classes" / f"{source.parent.name}.json").write_text(json.dumps(doc), encoding="utf-8")
        shutil.copy(source.parent / "icon_names.json", out / "icons" / f"{source.parent.name}.json")
    shutil.copy(items, out / "items.json")
    manifest = {"classes": sorted(versions), "data_versions": versions,
                "data_version": max(versions.values()), "engine_version": bundle.engine_fingerprint(),
                "modules": len(bundle.MODULES), "items": True}
    (out / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    return root


def test_audit_reports_source_and_browser_parity_without_claiming_a_client_patch(audited_repo):
    report = audit(audited_repo)
    assert report["ok"], report["errors"]
    assert report["source"]["export_client_build"] is None
    assert report["source"]["region"] == "global"
    assert len(report["classes"]) == 8
    assert any("unknown" in warning for warning in report["warnings"])


def test_audit_checks_reviewed_identity_unit_and_currency_witnesses(audited_repo):
    report = audit(audited_repo)
    assert report["ok"], report["errors"]
    assert set(report["witnesses"]) == {"skill.quick-slice", "skill.noble-armor-cooldown", "skill.hellfire-charge",
        "item.relic-collector-spellbook", "progression.global-level-22", "board.sorcerer-nezekan"}


def test_changed_ratio_units_fail_the_reviewed_witness(audited_repo):
    path = audited_repo / "app/aion2c/data/src/client_skill_numbers.json"
    data = json.loads(path.read_bytes())
    data["classes"]["assassin"]["skills"]["quick-slice"]["ratio_pct"] = 0.7
    path.write_text(json.dumps(data), encoding="utf-8")
    report = audit(audited_repo)
    assert not report["ok"]
    assert "Witness value/unit differs: skill.quick-slice" in report["errors"]


def test_changed_charge_time_units_fail_the_reviewed_witness(audited_repo):
    path = audited_repo / "app/aion2c/data/src/client_skill_numbers.json"
    data = json.loads(path.read_bytes())
    data["classes"]["sorcerer"]["skills"]["hellfire"]["charge"]["fast"]["min_ms"] = 2100
    path.write_text(json.dumps(data), encoding="utf-8")
    report = audit(audited_repo)

    assert "Witness value/unit differs: skill.hellfire-charge" in report["errors"]


def test_missing_board_skill_join_is_not_silently_skipped(audited_repo):
    path = audited_repo / "app/aion2c/data/classes/sorcerer/gamedata.json"
    data = json.loads(path.read_bytes())
    del data["daevanion"]["nezekan"]["nodes"]["4886"]
    path.write_text(json.dumps(data), encoding="utf-8")
    report = audit(audited_repo)
    assert not report["ok"]
    assert "Missing source join: board.sorcerer-nezekan" in report["errors"]


def test_ambiguous_item_join_fails(audited_repo):
    path = audited_repo / "app/aion2c/data/items.json"
    data = json.loads(path.read_bytes())
    data["items"].append(next(item for item in data["items"] if item["id"] == 110540006))
    path.write_text(json.dumps(data), encoding="utf-8")
    report = audit(audited_repo)
    assert not report["ok"]
    assert "Missing or ambiguous source join: item.relic-collector-spellbook" in report["errors"]


def test_even_a_small_raw_export_in_a_derived_table_is_rejected(audited_repo):
    path = audited_repo / "app/aion2c/data/client_quick_use.json"
    path.write_text('{"Version":1,"Ids":[],"Properties":{"Data":[{"private":"do not print"}]}}', encoding="utf-8")
    report = audit(audited_repo)
    assert not report["ok"]
    assert any("raw export" in error.lower() for error in report["errors"])
    assert "do not print" not in json.dumps(report)


def test_derived_table_size_limit_is_enforced_before_packing(audited_repo):
    path = audited_repo / "app/aion2c/data/client_quick_use.json"
    path.write_bytes(path.read_bytes() + b" " * 50_000)
    report = audit(audited_repo)
    assert not report["ok"]
    assert any("size limit" in error.lower() for error in report["errors"])


def test_cli_exits_nonzero_for_a_stale_fingerprint_and_outputs_a_readable_report(audited_repo, capsys):
    assert main(["--root", str(audited_repo)]) == 0
    assert json.loads(capsys.readouterr().out)["ok"]
    path = audited_repo / "web/public/engine/manifest.json"
    manifest = json.loads(path.read_bytes())
    manifest["engine_version"] = "old-engine"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    assert main(["--root", str(audited_repo)]) == 1
    report = json.loads(capsys.readouterr().out)
    assert "Engine fingerprint differs from source inputs" in report["errors"]


@pytest.mark.parametrize("relative", ["web/public/engine/classes/cleric.json", "web/public/engine/items.json"])
def test_changed_browser_payload_fails_even_when_manifest_is_untouched(audited_repo, relative):
    path = audited_repo / relative
    data = json.loads(path.read_bytes())
    data["unexpected_stale_payload"] = True
    path.write_text(json.dumps(data), encoding="utf-8")
    report = audit(audited_repo)
    assert not report["ok"]
    assert any("Browser" in error and "payload differs" in error for error in report["errors"])


def test_changed_archive_data_fails_even_when_sources_and_manifest_match(audited_repo):
    import zipfile

    archive = audited_repo / "web/public/engine/aion2c.zip"
    with zipfile.ZipFile(archive) as packed:
        entries = {name: packed.read(name) for name in packed.namelist()}
    entries["aion2c/data/client_progression.json"] += b"\n"
    with zipfile.ZipFile(archive, "w") as packed:
        for name, data in entries.items():
            packed.writestr(name, data)
    report = audit(audited_repo)
    assert not report["ok"]
    assert "Archive payload differs: aion2c/data/client_progression.json" in report["errors"]


def test_report_identifies_the_actual_browser_archive(audited_repo):
    report = audit(audited_repo)
    archive = next(item for item in report["artifacts"] if item["path"] == "web/public/engine/aion2c.zip")
    assert len(archive["sha256"]) == 64
    assert archive["bytes"] > 0


@pytest.mark.parametrize("relative", ["web/public/engine/icons/sorcerer.json",
                                     "app/aion2c/data/classes/sorcerer/icon_names.json"])
def test_raw_export_cannot_hide_in_public_icon_names(audited_repo, relative):
    path = audited_repo / relative
    path.write_text('{"Properties":{"Data":[]}}', encoding="utf-8")
    report = audit(audited_repo)
    assert not report["ok"]
    assert any("raw export" in error.lower() for error in report["errors"])


def test_another_export_is_not_reported_as_the_recorded_source(audited_repo):
    path = audited_repo / "app/aion2c/data/src/client_skill_numbers.json"
    data = json.loads(path.read_bytes())
    data["source"] = "Korea export from another patch"
    path.write_text(json.dumps(data), encoding="utf-8")
    report = audit(audited_repo)
    assert not report["ok"]
    assert any("Source provenance differs" in error for error in report["errors"])


def test_item_must_link_to_its_exact_enchant_series(audited_repo):
    path = audited_repo / "app/aion2c/data/items.json"
    data = json.loads(path.read_bytes())
    item = next(item for item in data["items"] if item["id"] == 110540006)
    del item["enchant_group"]
    path.write_text(json.dumps(data), encoding="utf-8")
    report = audit(audited_repo)
    assert not report["ok"]
    assert "Missing source join: item.relic-collector-spellbook" in report["errors"]


def test_packed_quick_use_patch_cannot_disagree_with_unknown_export_provenance(audited_repo):
    path = audited_repo / "app/aion2c/data/client_quick_use.json"
    data = json.loads(path.read_bytes())
    data["client_version"] = "another-client-version"
    path.write_text(json.dumps(data), encoding="utf-8")
    report = audit(audited_repo)
    assert not report["ok"]
    assert "Source patch declaration requires review: client_quick_use.json" in report["errors"]


def test_icon_name_size_limit_covers_the_published_payload(audited_repo):
    path = audited_repo / "web/public/engine/icons/sorcerer.json"
    path.write_bytes(path.read_bytes() + b" " * 40_000)
    report = audit(audited_repo)
    assert not report["ok"]
    assert any("size limit" in error.lower() for error in report["errors"])
