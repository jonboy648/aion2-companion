from aion2c.engine.explain import explain
from aion2c.models import CastEvent, SimResult, SkillTally


def _res(dps, per_skill, uptime=None, casts=()):
    return SimResult(
        total_damage=dps * 10, dps=dps, duration_s=10.0, casts=tuple(casts),
        per_skill={k: SkillTally(*v) for k, v in per_skill.items()},
        status_uptime=uptime or {}, warnings=(), confidence="estimated",
    )


def test_explain_mentions_skill(mini_gd):
    best = _res(1060.0, {"nuke": (5, 6000.0), "strike": (4, 4000.0)})
    other = _res(1000.0, {"nuke": (2, 2400.0), "strike": (8, 7600.0)})
    text = explain(best, other, mini_gd)
    assert "Nuke" in text or "nuke" in text.lower()
    assert "6.0%" in text
    assert "5x vs 2x" in text


def test_explain_status_and_inside(mini_gd):
    casts = [CastEvent(float(i), "nuke", 0, 100.0, 0.0, ("amp_buff",) if i < 3 else ()) for i in range(4)]
    best = _res(1200.0, {"nuke": (4, 400.0)}, {"amp_buff": 0.8}, casts)
    other = _res(1000.0, {"nuke": (1, 100.0)}, {"amp_buff": 0.2})
    text = explain(best, other, mini_gd)
    assert "20.0%" in text
    assert "3/4" in text
    assert "uptime 80% vs 20%" in text


def test_explain_zero_other(mini_gd):
    best = _res(10.0, {"strike": (1, 100.0)})
    other = _res(0.0, {})
    assert "beats" in explain(best, other, mini_gd)
