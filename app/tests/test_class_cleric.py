"""Cleric integration: the built gamedata loads, matches the research pack, and the optimizer works on it."""
import json
import time
from pathlib import Path

import pytest

from aion2c.classes import CLASSES, key_from_armory
from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.models import CharacterBuild, Stats

KEY = "cleric"
RESEARCH = Path(r"D:\Aion2\research\classes\cleric\skills.json")


@pytest.fixture(scope="module")
def gd():
    if not loader.default_path(KEY).is_file():
        pytest.skip("cleric gamedata not built")
    return loader.load_gamedata(class_key=KEY)


def test_loads_as_cleric(gd):
    assert gd.class_key == KEY
    assert KEY in loader.available_classes()
    assert len(gd.skills) > 0 and gd.daevanion


def test_skill_count_matches_research(gd):
    if not RESEARCH.is_file():
        pytest.skip("research pack not present")
    assert len(gd.skills) == len(json.loads(RESEARCH.read_text(encoding="utf-8")))


def test_every_icon_exists(gd):
    icons = loader.default_path(KEY).parent / "icons"
    with_icon = [s for s in gd.skills.values() if s.icon]
    assert with_icon
    missing = [s.icon for s in with_icon if not (icons / s.icon).is_file()]
    assert not missing


@pytest.mark.parametrize("style", [p.key for p in bo.PLAYSTYLES])
def test_optimize_full_build_per_playstyle(gd, style):
    build = CharacterBuild("t", "global", 45, stats=Stats(), class_key=KEY)
    t0 = time.perf_counter()
    fb = bo.optimize_full_build(gd, build, style)
    assert time.perf_counter() - t0 < 30
    assert fb.result.dps > 0
    stig = {k for k, _ in fb.stigma_picks}
    assert stig and all(k in gd.skills and gd.skills[k].kind == "stigma" for k in stig)
    assert fb.priority.entries
    assert all(e.skill_key in gd.skills for e in fb.priority.entries)


def test_armory_maps_to_cleric():
    info = next(c for c in CLASSES if c.key == KEY)
    assert info.armory_pc_ids
    assert key_from_armory(None, info.armory_pc_ids[0]) == KEY
    assert key_from_armory("Cleric", None) == KEY
