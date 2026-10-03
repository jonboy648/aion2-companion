import dataclasses

from aion2c.engine.community import compare
from aion2c.models import CommunityRotation, Priority, PriorityEntry, RankedOption, Scenario, SimConfig
from aion2c.testing.fakes import fake_simulate

SC = Scenario("boss_180", "b", 10, 1, True)


def _option(mini_gd, build, keys):
    prio = Priority(tuple(PriorityEntry(k) for k in keys))
    return RankedOption(1, prio, fake_simulate(mini_gd, build, prio, SC), "")


def _with(mini_gd, *rots):
    return dataclasses.replace(mini_gd, community=tuple(rots))


def test_community_flags_reorder(monkeypatch, mini_gd, default_build):
    monkeypatch.setattr("aion2c.engine.community.simulate", fake_simulate)
    gd = _with(mini_gd, CommunityRotation("rot", "test", "boss_180", ("strike", "amp", "nuke")))
    best = _option(gd, default_build, ["nuke", "amp", "strike"])
    out = compare(gd, default_build, SC, best, SimConfig())
    nuke = [d for d in out if d.skill_key == "nuke"]
    assert len(nuke) == 1
    assert (nuke[0].community_pos, nuke[0].ours_pos) == (3, 1)
    assert nuke[0].community_key == "rot"
    assert {d.skill_key for d in out} == {"nuke", "strike"}  # amp is at 2 in both
    com_dps = fake_simulate(
        gd, default_build, Priority(tuple(PriorityEntry(k) for k in ("strike", "amp", "nuke"))), SC
    ).dps
    assert abs(nuke[0].dps_delta_pct - (best.result.dps / com_dps - 1) * 100) < 1e-9


def test_community_missing_skill_share(monkeypatch, mini_gd, default_build):
    monkeypatch.setattr("aion2c.engine.community.simulate", fake_simulate)
    gd = _with(mini_gd, CommunityRotation("rot", "test", "boss_180", ("strike", "ghost-skill")))
    best = _option(gd, default_build, ["nuke", "strike"])
    out = compare(gd, default_build, SC, best, SimConfig())
    miss = [d for d in out if d.skill_key == "nuke"]
    assert len(miss) == 1 and miss[0].community_pos == -1 and miss[0].ours_pos == 1
    assert "ghost-skill" in miss[0].text  # unavailable skill is noted, not an error
    assert not any(d.skill_key == "ghost-skill" for d in out)


def test_community_other_scenario_ignored(monkeypatch, mini_gd, default_build):
    monkeypatch.setattr("aion2c.engine.community.simulate", fake_simulate)
    gd = _with(mini_gd, CommunityRotation("rot", "test", "aoe_pack", ("strike", "amp", "nuke")))
    best = _option(gd, default_build, ["nuke", "amp", "strike"])
    assert compare(gd, default_build, SC, best, SimConfig()) == ()
