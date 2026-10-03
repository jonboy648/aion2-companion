from aion2c.engine.next_skills import next_skills
from aion2c.models import LiveState, Priority, PriorityEntry


def P(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


def test_next_skills_static(mini_gd, default_build, scen10):
    assert next_skills(mini_gd, default_build, P("amp", "nuke", "strike"), scen10, None, 3) == [
        "amp", "nuke", "strike"]


def test_next_skills_live_state(mini_gd, default_build, scen10):
    live = LiveState(0.0, {"amp": 10.0}, {}, None, None, "estimated")
    out = next_skills(mini_gd, default_build, P("amp", "nuke", "strike"), scen10, live, 3)
    assert out == ["nuke", "strike", "strike"]


def test_next_skills_short_sequence(mini_gd, default_build, scen):
    assert len(next_skills(mini_gd, default_build, P("strike"), scen(2), None, 5)) == 2
