"""Chanter integration: shipped gamedata matches research, icons exist, the optimizer works on it."""
import json
import time
from pathlib import Path

import pytest

from aion2c.classes import key_from_armory
from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.models import CharacterBuild, Stats

RESEARCH = Path(__file__).resolve().parents[2] / "research" / "classes" / "chanter" / "skills.json"


@pytest.fixture(scope="module")
def gd():
    return loader.load_gamedata(class_key="chanter")


def test_loads_as_chanter(gd):
    assert gd.class_key == "chanter"
    assert "chanter" in loader.available_classes()


def test_skill_count_matches_research(gd):
    if not RESEARCH.is_file():
        pytest.skip("research/ not present")
    assert len(gd.skills) == len(json.loads(RESEARCH.read_text(encoding="utf-8")))


def test_icons_exist(gd):
    icons = loader.default_path("chanter").parent / "icons"
    missing = [k for k, s in gd.skills.items() if s.icon and not (icons / s.icon).is_file()]
    assert not missing, missing


def test_armory_pcid_maps_to_chanter():
    assert key_from_armory("Chanter", None) == "chanter"
    assert key_from_armory(None, 9) == "chanter"


@pytest.mark.parametrize("style", [p.key for p in bo.PLAYSTYLES])
def test_optimize_full_build_per_playstyle(gd, style):
    build = CharacterBuild("T", "global", 45, class_key="chanter", stats=Stats(crit_chance_pct=0))
    t0 = time.time()
    fb = bo.optimize_full_build(gd, build, style)
    assert time.time() - t0 < 30
    assert fb.result.dps > 0
    stigmas = {k for k, s in gd.skills.items() if s.kind == "stigma"}
    assert {k for k, _ in fb.stigma_picks} <= stigmas
    assert fb.priority.entries
    assert {e.skill_key for e in fb.priority.entries} <= set(gd.skills)
