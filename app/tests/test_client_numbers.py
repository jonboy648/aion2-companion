"""Guards for the private client-export pipeline (app/aion2c/data/client_export.py).

The raw export is private: nothing from it may live in the repo except our own small derived numbers file.
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

from aion2c.data import build_gamedata as bg
from aion2c.data import client_export as ce

REPO = bg.REPO
NUMBERS = bg.SRC_DIR / "client_skill_numbers.json"
SKIP_DIRS = {".git", "node_modules", "dist", "dist_compare", "dist_guide", "dist_verify", "__pycache__", ".pytest_cache",
             "shots", ".shots-ui-tools"}
TEXT_SUFFIX = {".py", ".md", ".json", ".ts", ".tsx", ".js", ".mjs", ".cmd", ".txt", ".html", ".css", ".toml", ".yml", ".yaml"}
# the export lives in a private tools folder; the pattern is assembled so this file does not match itself
RAW_PATH = re.compile("aion2-" + "tools[\\\\/]+export-" + "test", re.I)


def _repo_files():
    for root, dirs, files in os.walk(REPO):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            p = Path(root) / f
            if p.suffix.lower() in TEXT_SUFFIX and p.stat().st_size < 30_000_000:
                yield p


def test_no_file_contains_the_raw_export_path():
    hits = [str(p.relative_to(REPO)) for p in _repo_files()
            if RAW_PATH.search(p.read_text(encoding="utf-8", errors="ignore"))]
    assert not hits, f"raw export path found in: {hits}"


def test_no_raw_table_dump_in_repo():
    """No file in the repo is a decoded client table ({"Version", "Ids", "Properties": {"Data": [...]}})."""
    bad = []
    for p in _repo_files():
        if p.suffix.lower() != ".json" or p.stat().st_size < 200_000:
            continue
        head = p.read_text(encoding="utf-8", errors="ignore")[:2000]
        if '"Properties"' in head and '"Data"' in head:
            bad.append(str(p.relative_to(REPO)))
    assert not bad, bad


def test_derived_file_is_small_and_has_only_our_keys():
    assert NUMBERS.is_file(), "run python -m aion2c.data.client_export with AION2_EXPORT_DIR set"
    assert NUMBERS.stat().st_size < 1_500_000
    d = json.loads(NUMBERS.read_text(encoding="utf-8"))
    assert set(d) == {"schema", "source", "note", "classes"}
    allowed_entry = {"ratio_pct", "ratio_constant", "hits", "from_rank", "flat_min", "flat_max", "how", "charge", "dots"}
    text = NUMBERS.read_text(encoding="utf-8")
    assert "SkillEffectLv" not in text and "EffectValueList" not in text and "Properties" not in text
    for ck, c in d["classes"].items():
        assert set(c) == {"skills", "unmatched", "ratio_varies", "name_differs"}
        gd_keys = set(json.loads((bg.PKG_DATA / "classes" / ck / "gamedata.json").read_text(encoding="utf-8"))["skills"])
        assert set(c["skills"]) <= gd_keys, f"{ck}: keys that are not ours: {set(c['skills']) - gd_keys}"
        for k, e in c["skills"].items():
            assert set(e) <= allowed_entry, (ck, k, set(e) - allowed_entry)
            assert all(isinstance(x, (int, float)) for x in e.get("flat_min", []) + e.get("flat_max", []))


def test_script_refuses_to_run_without_the_env_var(monkeypatch):
    monkeypatch.delenv(ce.ENV_VAR, raising=False)
    with pytest.raises(SystemExit) as ei:
        ce.export_dir()
    assert ce.ENV_VAR in str(ei.value)


def test_script_reads_no_path_argument():
    """The export directory comes only from the environment (no --export/--table CLI option)."""
    src = Path(ce.__file__).read_text(encoding="utf-8")
    assert "add_argument(\"--export" not in src and "add_argument(\"--table" not in src
    r = subprocess.run([sys.executable, "-m", "aion2c.data.client_export"], capture_output=True, text=True,
                       env={k: v for k, v in os.environ.items() if k != ce.ENV_VAR},
                       cwd=str(Path(ce.__file__).resolve().parents[2]))
    assert r.returncode != 0 and ce.ENV_VAR in (r.stderr + r.stdout)
