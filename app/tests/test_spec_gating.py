"""A chain follow-up that a specialty 'Adds [X] Chain Skill' exists only while that option is chosen."""
from collections import Counter

import pytest

from aion2c.data import loader
from aion2c.engine.simulator import simulate
from aion2c.models import SCENARIOS, CharacterBuild, Priority, PriorityEntry, Stats

BOSS = next(s for s in SCENARIOS if s.key == "boss_180")


@pytest.fixture(scope="module")
def ranger():
    if not loader.default_path("ranger").is_file():
        pytest.skip("ranger gamedata not built")
    return loader.load_gamedata(class_key="ranger")


def _casts(gd, **kw):
    pri = Priority(tuple(PriorityEntry(k) for k in ("snipe", "tempest-arrow", "spiral-arrow", "rapid-fire")))
    b = CharacterBuild("t", "global", 45, stats=Stats(), class_key="ranger", **kw)
    return Counter(c.skill_key for c in simulate(gd, b, pri, BOSS).casts)


def test_tempest_arrow_is_gated_by_the_root_skills_option(ranger):
    # Rapid Fire and Spiral Arrow copy Snipe's option text; the owner is the root skill, Snipe
    assert ranger.rules["tempest-arrow"].requires_spec == ("snipe", 4)


def test_tempest_arrow_needs_the_specialty(ranger):
    assert _casts(ranger)["tempest-arrow"] == 0
    assert _casts(ranger, specs={"snipe": (4,)}, skill_ranks={"snipe": 16})["tempest-arrow"] > 0


@pytest.mark.parametrize("cls,child,owner", [("spiritmaster", "ashy-call", ("combustion", 4)),
                                             ("gladiator", "reckless-strike", ("keen-strike", 4))])
def test_other_classes_gate_their_spec_chains(cls, child, owner):
    gd = loader.load_gamedata(class_key=cls)
    assert gd.rules[child].requires_spec == owner


def test_global_gladiator_keeps_its_chain_steps():
    gd = loader.load_gamedata(class_key="gladiator")
    kr_only = {k for k, s in gd.skills.items() if s.regions == frozenset({"korea"})}
    assert len(kr_only) == 5
