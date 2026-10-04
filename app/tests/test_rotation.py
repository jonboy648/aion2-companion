"""explain_rotation: plain-English structure derived from the simulated cast log."""
import json

import pytest

from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.engine.rotation import explain_rotation
from aion2c.engine.simulator import simulate
from aion2c.models import SCENARIOS, CharacterBuild, Priority, PriorityEntry, Scenario, SimResult, Stats


def pr(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


@pytest.fixture
def mini(mini_gd):
    build = CharacterBuild("T", "global", 45, stats=Stats(crit_chance_pct=0))
    sc = Scenario("t", "Test fight", 60, 1, True)
    p = pr("amp", "charge", "blaze", "nuke", "mark_hit", "chain1", "strike")
    res = simulate(mini_gd, build, p, sc)
    return mini_gd, build, sc, p, res


def test_structure_and_json_safe(mini):
    gd, build, sc, p, res = mini
    ex = explain_rotation(gd, build, p, res, sc)
    assert set(ex) >= {"opener", "core", "chains", "filler", "skip", "priority"}
    json.dumps(ex)


def test_opener_is_exact_first_casts_until_every_cooldown_used(mini):
    gd, build, sc, p, res = mini
    ex = explain_rotation(gd, build, p, res, sc)
    seen = [o["skill_key"] for o in ex["opener"]]
    assert seen == [c.skill_key for c in res.casts[: len(seen)]]
    assert [o["t_s"] for o in ex["opener"]] == [round(c.t_s, 1) for c in res.casts[: len(seen)]]
    cooldown_skills = {c["skill_key"] for c in ex["core"]}
    assert cooldown_skills <= set(seen)  # every cooldown skill appears in the opener
    assert next(o for o in ex["opener"] if o["skill_key"] == "charge")["charge_level"] == 3
    assert ex["opener"][0]["icon_key"] == "amp"


def test_core_rules_and_shares(mini):
    gd, build, sc, p, res = mini
    core = {c["skill_key"]: c for c in explain_rotation(gd, build, p, res, sc)["core"]}
    assert core["amp"]["rule"] == "on_cooldown" and core["amp"]["cooldown_s"] == 10 and "keep" in core["amp"]["text"]
    assert core["blaze"]["rule"] == "when_status" and core["blaze"]["status"] == "mark"
    assert "when Mark is up" in core["blaze"]["text"]
    assert core["charge"]["rule"] == "hold_for_buff" and core["charge"]["status"] == "amp_buff"
    assert "Hold for Amp Buff" in core["charge"]["text"]
    assert core["nuke"]["rule"] == "on_cooldown"
    total = sum(c["damage_share_pct"] for c in core.values())
    assert 0 < total <= 100.5
    assert [c["skill_key"] for c in explain_rotation(gd, build, p, res, sc)["core"]] == ["amp", "charge", "blaze", "nuke"]


def test_filler_and_skip_and_priority_drop_never_cast(mini):
    gd, build, sc, p, res = mini
    ex = explain_rotation(gd, build, p, res, sc)
    assert ex["filler"]["skills"][0]["skill_key"] == "mark_hit"
    skipped = {s["skill_key"]: s for s in ex["skip"]}
    assert set(skipped) == {"chain1", "strike"}
    assert "Mark Hit" in skipped["strike"]["reason"] and skipped["strike"]["casts"] == 0
    shown = [e["skill_key"] for e in ex["priority"]]
    assert "strike" not in shown and "chain1" not in shown
    assert shown == [k for k in (e.skill_key for e in p.entries) if k in res.per_skill]


def test_chain_listed_when_cast(mini_gd):
    build = CharacterBuild("T", "global", 45, stats=Stats(crit_chance_pct=0))
    sc = Scenario("t", "t", 30, 1, True)
    p = pr("chain1", "strike")
    res = simulate(mini_gd, build, p, sc)
    ex = explain_rotation(mini_gd, build, p, res, sc)
    assert ex["chains"], "chain1 -> chain2 -> chain3 should be reported"
    ch = ex["chains"][0]
    assert ch["skills"][0] == "chain1" and len(ch["skills"]) >= 2
    assert "keep pressing" in ch["text"] and "→" in ch["text"]


def test_empty_and_fake_results_do_not_crash(mini):
    gd, build, sc, p, _ = mini
    from aion2c.testing.fakes import fake_sim_result

    for res in (fake_sim_result(), SimResult(0.0, 0.0, 10.0, (), {}, {}, (), "estimated")):
        ex = explain_rotation(gd, build, p, res, sc)
        assert isinstance(ex["opener"], list) and isinstance(ex["skip"], list)


@pytest.mark.parametrize("class_key", ["sorcerer", "templar"])
def test_real_data_smoke(class_key):
    gd = loader.load_gamedata(class_key=class_key)
    build = CharacterBuild("Real", "global", 45, stats=Stats(), class_key=class_key,
                           stigmas=tuple(k for k, s in gd.skills.items() if s.kind.value == "stigma")[:4])
    sc = SCENARIOS[0]
    p = bo._heuristic_priority(gd, build, sc, bo.SearchBudget(max_candidates=100))
    res = simulate(gd, build, p, sc)
    ex = explain_rotation(gd, build, p, res, sc)
    json.dumps(ex)
    assert ex["opener"] and ex["core"]
    assert all(c["cooldown_s"] > 0 and c["text"] for c in ex["core"])
    cast = {k for k, v in res.per_skill.items() if v.casts}
    assert {e["skill_key"] for e in ex["priority"]} <= cast
    assert {s["skill_key"] for s in ex["skip"] if s["casts"] == 0}.isdisjoint(cast)
    assert abs(sum(e["damage_share_pct"] for e in ex["priority"]) - 100) < 5
    assert all(len(ch["skills"]) >= 2 for ch in ex["chains"])
