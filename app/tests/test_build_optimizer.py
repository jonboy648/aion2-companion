"""build_optimizer: slots, stigma gating regression, greedy picks, full-build integration."""
import time
from dataclasses import replace

import pytest

from aion2c.data.loader import load_gamedata
from aion2c.engine import build_optimizer as bo
from aion2c.engine.search import candidate_skills
from aion2c.engine.simulator import simulate
from aion2c.models import CharacterBuild, Priority, PriorityEntry, SkillKind

STIGMA_KEY = "element-enhancement"


def test_stigma_slots_at(sorc_gd):
    gd = sorc_gd
    assert bo.stigma_slots_at(gd, "global", 21) == 0
    assert bo.stigma_slots_at(gd, "global", 22) == 1
    assert bo.stigma_slots_at(gd, "global", 37) == 4
    assert bo.stigma_slots_at(replace(gd, stigma_slots={"global": 2, "korea": 6}), "global", 60) == 2
    assert bo.stigma_slots_at(replace(gd, roadmap=()), "global", 32) == 3  # fallback table


def test_playstyle_keys():
    assert [p.key for p in bo.PLAYSTYLES] == ["boss", "aoe", "leveling", "burst"]
    burst = bo.PLAYSTYLES[3].scenario
    assert (burst.duration_s, burst.n_targets, burst.boss) == (15, 1, True)


def test_empty_stigmas_not_candidates_or_cast(sorc_gd):
    stig = {s.key for s in sorc_gd.skills.values() if s.kind == SkillKind.STIGMA}
    assert STIGMA_KEY in stig
    b = CharacterBuild("t", "global", 45)
    assert not stig & {e.skill_key for e in candidate_skills(sorc_gd, b)}
    sc = bo.PLAYSTYLES[0].scenario
    res = simulate(sorc_gd, b, Priority((PriorityEntry(STIGMA_KEY), PriorityEntry("flame-arrow"))), sc)
    assert STIGMA_KEY not in {c.skill_key for c in res.casts}
    slotted = replace(b, stigmas=(STIGMA_KEY,))
    res = simulate(sorc_gd, slotted, Priority((PriorityEntry(STIGMA_KEY), PriorityEntry("flame-arrow"))), sc)
    assert STIGMA_KEY in {c.skill_key for c in res.casts}


def test_greedy_picks_helpful_stigma(sorc_gd):
    fb = bo.optimize_full_build(sorc_gd, CharacterBuild("t", "global", 45), "boss")
    assert fb.stigma_picks and fb.stigma_picks[0][0] == STIGMA_KEY and fb.stigma_picks[0][1] > 0
    assert set(fb.build.stigmas) == {k for k, _ in fb.stigma_picks}


def test_daevanion_defaults_to_full_path(sorc_gd):
    b = CharacterBuild("t", "global", 45)
    fb = bo.optimize_full_build(sorc_gd, b, "leveling")
    assert fb.build.daevanion_nodes == frozenset(fb.daevanion_path)
    assert any("assumes all Daevanion points" in w for w in fb.warnings)
    assert any("PvP" in w for w in fb.warnings)
    assert any("not simulated" in w for w in fb.warnings)


def test_daevanion_int_selects_prefix(sorc_gd):
    fb = bo.optimize_full_build(sorc_gd, CharacterBuild("t", "global", 45), "boss", 6)
    nodes = {n.id: n.cost for br in sorc_gd.daevanion.values() for n in br.nodes.values()}
    sel = [n for n in fb.daevanion_path if n in fb.build.daevanion_nodes]
    assert sel == list(fb.daevanion_path[: len(sel)])
    assert 0 < sum(nodes[n] for n in sel) <= 6 and len(fb.daevanion_path) > len(sel)
    assert not any("assumes all" in w for w in fb.warnings)


def test_utility_tags():
    gd = load_gamedata()
    assert "defense" in bo.utility_tags(gd, "steel-barrier") and "cc" in bo.utility_tags(gd, "winters-shackles")
    assert bo.utility_tags(gd, "element-enhancement") == ("burst",)  # hand role tag from the class data
    assert bo.utility_tags(gd, "nonexistent") == ()


def test_variants_real_data_and_compare():
    gd = load_gamedata()
    t = time.perf_counter()
    res = bo.compare_playstyles(gd, CharacterBuild("t", "global", 45))
    assert time.perf_counter() - t < 90
    assert set(res) == {"boss", "aoe", "leveling", "burst"}
    for fb in res.values():
        assert fb.variants[0].key == "max" and fb.variants[0].dps_delta_pct == 0
        assert len(fb.variants) > 1
        for v in fb.variants[1:]:
            assert v.dps_delta_pct <= 0 and v.label and v.gives and v.build.stigmas != fb.build.stigmas


def test_real_data_daevanion_path_valid():
    from aion2c.daevanion import valid

    gd = load_gamedata()
    t = time.perf_counter()
    fb = bo.optimize_full_build(gd, CharacterBuild("t", "global", 45), "boss")
    assert time.perf_counter() - t < 30
    assert len(fb.daevanion_path) == len(set(fb.daevanion_path)) > 100
    sel = fb.build.daevanion_nodes
    for br in gd.daevanion.values():
        assert valid(br, frozenset(n for n in sel if n in br.nodes))


def test_unknown_playstyle(sorc_gd):
    with pytest.raises(KeyError):
        bo.optimize_full_build(sorc_gd, CharacterBuild("t", "global", 45), "nope")


@pytest.mark.parametrize("style", [p.key for p in bo.PLAYSTYLES])
def test_real_data_full_build(style):
    gd = load_gamedata()
    t = time.perf_counter()
    fb = bo.optimize_full_build(gd, CharacterBuild("t", "global", 45), style)
    assert time.perf_counter() - t < 30
    assert len(fb.build.stigmas) == 4 == len(set(fb.build.stigmas))
    assert fb.result.dps > 0 and fb.stat_gains
    castable = {e.skill_key for e in candidate_skills(gd, fb.build)}
    assert fb.priority.entries and {e.skill_key for e in fb.priority.entries} <= castable
    assert all(gd.skills[c.skill_key].kind != SkillKind.STIGMA or c.skill_key in fb.build.stigmas
               for c in fb.result.casts)
