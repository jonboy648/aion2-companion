"""Every path uses the Exp-derived stigma slot count; chain follow-ups are never separate purchases (docs/adr/0004)."""
from dataclasses import replace

import pytest

from aion2c import progression as pg
from aion2c import webapi
from aion2c.data.loader import available_classes, load_gamedata
from aion2c.engine import build_optimizer as bo
from aion2c.models import CharacterBuild, SkillKind, effective_rank, rank_owner, total_rank

EXP_SLOTS = {1: 0, 21: 0, 22: 1, 26: 1, 27: 2, 30: 2, 31: 2, 32: 3, 36: 3, 37: 4, 45: 4}
CHAIN_CHILDREN = {"assassin": ("swift-slice", "breaking-slice"), "chanter": ("bursting-blow",),
                  "cleric": ("divine-punishment",), "gladiator": ("frenzied-wave", "smashing-blow"),
                  "ranger": ("guerilla-strike",), "templar": ("punishing-strike",)}


@pytest.fixture(scope="module")
def gds():
    return {ck: load_gamedata(class_key=ck) for ck in available_classes()}


def test_slots_are_exp_derived_for_every_class_and_level(gds):
    # class roadmaps carry extra stigma-kind lines (stigma list, region note): they must not count as slots
    for ck, gd in gds.items():
        for lv, n in EXP_SLOTS.items():
            assert pg.stigma_slots_at(gd, "global", lv) == n, (ck, lv)
            assert bo.stigma_slots_at(gd, "global", lv) == n, (ck, lv)


def test_slots_korea_counts_slot_lines_only(gds):
    gd = gds["gladiator"]
    assert pg.stigma_slots_at(gd, "korea", 30) == 2
    assert pg.stigma_slots_at(gd, "korea", 21) == 0


def test_legality_uses_same_slot_count(gds):
    gd = gds["ranger"]
    stig = [k for k, s in gd.skills.items() if s.kind == SkillKind.STIGMA][:3]
    b = CharacterBuild("t", "global", 30, stigmas=tuple(stig), stigma_unlocked=True)
    assert any("level 30 has 2 slot" in m for m in pg.legality_issues(gd, b))


@pytest.mark.parametrize("ck", ["gladiator", "ranger"])
def test_optimizer_equips_at_most_slot_count_at_30(ck):
    r = webapi.optimize(_fresh(ck, 30), "leveling", 0, battle_points=0)
    assert len(r["build"]["stigmas"]) <= 2


def _fresh(ck, level):
    b = CharacterBuild("t", "global", level, stigma_unlocked=True, skill_points=pg.level_budget(level).skill,
                       stigma_points=pg.level_budget(level).stigma)
    from aion2c.serde import to_dict
    d = to_dict(b)
    d["class_key"] = ck
    return d


def test_chain_followups_have_an_owner_with_acquisition_rows(gds):
    for ck, keys in CHAIN_CHILDREN.items():
        gd = gds[ck]
        for k in keys:
            own = rank_owner(gd, gd.skills[k])
            assert own is not None, (ck, k)
            assert pg.rank_levels(own) is not None and own.kind != SkillKind.CHAIN, (ck, k, own.key)
    # Breaking Slice -> Swift Slice both follow Quick Slice
    gd = gds["assassin"]
    assert rank_owner(gd, gd.skills["swift-slice"]).key == "quick-slice"
    # cancel follow-ups (own acquisition rows) and ordinary purchased skills have no owner
    assert rank_owner(gds["sorcerer"], gds["sorcerer"].skills["remove-hibernation"]) is None
    assert rank_owner(gd, gd.skills["quick-slice"]) is None


def test_chain_followup_plays_at_owner_rank(gds):
    gd = gds["assassin"]
    b = CharacterBuild("t", "global", 30, skill_ranks={"quick-slice": 7})
    assert effective_rank(gd, b, gd.skills["swift-slice"]) == 7
    assert total_rank(gd, b, gd.skills["breaking-slice"]) == 7
    # an explicit rank in the build still wins
    b2 = replace(b, skill_ranks={"quick-slice": 7, "swift-slice": 3})
    assert effective_rank(gd, b2, gd.skills["swift-slice"]) == 3


@pytest.mark.parametrize("ck,level", [("assassin", 30), ("chanter", 45), ("cleric", 30), ("gladiator", 22),
                                      ("ranger", 45), ("templar", 30)])
def test_optimizer_buys_no_chain_followup_ranks(ck, level, gds):
    r = webapi.optimize(_fresh(ck, level), "leveling", 0, battle_points=0)
    gd = gds[ck]
    for build in [r["build"]] + [v["build"] for v in r.get("variants", []) if isinstance(v, dict) and "build" in v]:
        owned = {k for k in build["skill_ranks"] if rank_owner(gd, gd.skills[k]) is not None}
        assert not owned, (ck, level, owned)
    assert not any(rank_owner(gd, gd.skills[e[0]]) is not None for e in r["rank_log"])
