"""Drift guard: the built gamedata of every class carries exactly the client numbers in client_skill_numbers.json.

A game patch (re-extract the numbers), a hand edit of a flat/ratio/hits value, or a stale gamedata.json fails here.
Needs no export (the derived numbers file and the shipped gamedata.json are both in the repo).
Rebuild when it fails:  python -m aion2c.data.build_gamedata --all
"""
import dataclasses
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from aion2c.classes import CLASSES
from aion2c.data import build_gamedata as bg
from aion2c.data import client_export as ce
from aion2c.data import loader

NUMBERS = json.loads((bg.SRC_DIR / bg.CLIENT_NUMBERS_FILE).read_text(encoding="utf-8"))
CLASS_KEYS = [c.key for c in CLASSES]


def _gd(ck):
    if not loader.default_path(ck).is_file():
        pytest.skip(f"{ck} gamedata not built")
    return loader.load_gamedata(class_key=ck)


def test_numbers_cover_every_class():
    assert set(NUMBERS["classes"]) == set(CLASS_KEYS)


@pytest.mark.parametrize("ck", CLASS_KEYS)
def test_gamedata_matches_client_numbers(ck):
    c = NUMBERS["classes"][ck]
    res = ce.check_class(_gd(ck), c["skills"], c["unmatched"])
    assert res["matched"] == sum("ratio_pct" in e for e in c["skills"].values()) > 0
    assert not res["mismatched"], "\n".join(res["mismatched"][:20])


@pytest.mark.parametrize("ck", CLASS_KEYS)
def test_only_declared_skills_stay_unmatched(ck):
    """A skill we could not tie to the client is listed (with a reason) in client_export.UNRESOLVED, nothing else."""
    declared = {k for (c, k) in ce.UNRESOLVED if c == ck}
    unmatched = set(NUMBERS["classes"][ck]["unmatched"])
    assert unmatched <= declared, f"{ck}: new unmatched skills {sorted(unmatched - declared)}"


def test_every_explicit_mapping_produced_numbers():
    for table in (ce.GROUP_OVERRIDES, ce.SHORT_GROUP_OVERRIDES, ce.EFFECT_ROW_OVERRIDES, ce.DOT_GROUP_SKILLS, ce.DOT_ROW_SKILLS):
        for (ck, key) in table:
            e = NUMBERS["classes"][ck]["skills"].get(key)
            assert e is not None and "ratio_pct" in e, (ck, key)
            assert key not in NUMBERS["classes"][ck]["unmatched"]


@pytest.mark.parametrize("ck,key,field,value", [
    ("assassin", "apply-poison-13730000", "ratio_pct", 138.0),   # Poison tick 138% ATK + flat
    ("assassin", "apply-poison", "ratio_pct", 138.0),
    ("assassin", "breaking-slice", "hits", 3),
    ("templar", "punishment", "ratio_pct", 430.5),
    ("spiritmaster", "continuous-impact", "hits", 4),
    ("chanter", "bursting-blow", "hits", 2),                     # base SkillEffect row wins over the level group's 1
])
def test_spot_values(ck, key, field, value):
    assert NUMBERS["classes"][ck]["skills"][key][field] == value
    sk = _gd(ck).skills[key]
    assert (sk.atk_ratio_pct.value if field == "ratio_pct" else sk.hits) == value


def test_check_fails_on_a_tampered_value():
    gd = _gd("assassin")
    c = NUMBERS["classes"]["assassin"]
    sk = gd.skills["quick-slice"]
    r = sk.ranks[5]
    bad = dataclasses.replace(r, flat_min=dataclasses.replace(r.flat_min, value=r.flat_min.value + 1))
    ranks = tuple(bad if x is r else x for x in sk.ranks)
    gd.skills["quick-slice"] = dataclasses.replace(sk, ranks=ranks, hits=sk.hits + 1)
    res = ce.check_class(gd, c["skills"], c["unmatched"])
    assert any("quick-slice rank 6: flat_min" in p for p in res["mismatched"])
    assert any("quick-slice: hits" in p for p in res["mismatched"])


def test_check_mode_runs_without_the_export():
    r = subprocess.run([sys.executable, "-m", "aion2c.data.client_export", "--check"], capture_output=True, text=True,
                       env={k: v for k, v in os.environ.items() if k != ce.ENV_VAR},
                       cwd=str(Path(ce.__file__).resolve().parents[2]))
    assert r.returncode == 0, r.stdout + r.stderr
    assert "[assassin] matched" in r.stdout and "mismatched 0" in r.stdout
