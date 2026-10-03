"""Explanations (PLAN P3). Built only from SimResult data; never re-simulates."""
from aion2c.models import GameData, SimResult


def _skill_name(gd: GameData, key: str) -> str:
    s = gd.skills.get(key)
    return s.name if s else key


def _status_name(gd: GameData, key: str) -> str:
    s = gd.statuses.get(key)
    return s.name if s else key


def explain_ranked(best: SimResult, other: SimResult, gd: GameData, label_best: str, label_other: str) -> str:
    """'<label_best> beats <label_other> by X.X%: <reasons>'."""
    if other.dps > 0:
        gap = (best.dps / other.dps - 1) * 100
        head = f"{label_best} beats {label_other} by {gap:.1f}%"
    else:
        head = f"{label_best} beats {label_other} (other deals no damage)"
    reasons: list[str] = []

    deltas = {}
    for k in set(best.per_skill) | set(other.per_skill):
        b = best.per_skill.get(k)
        o = other.per_skill.get(k)
        deltas[k] = (b.damage if b else 0.0) - (o.damage if o else 0.0)
    if deltas:
        top = max(sorted(deltas), key=lambda k: deltas[k])
        if deltas[top] > 0:
            bc = best.per_skill[top].casts if top in best.per_skill else 0
            oc = other.per_skill[top].casts if top in other.per_skill else 0
            name = _skill_name(gd, top)
            reasons.append(f"biggest gain is {name} (+{deltas[top]:.0f} damage, {bc}x vs {oc}x casts)")
            casts = [c for c in best.casts if c.skill_key == top]
            for st in sorted(best.status_uptime, key=lambda s: -best.status_uptime[s]):
                inside = sum(1 for c in casts if st in c.active_statuses)
                if casts and inside:
                    reasons.append(f"lands {inside}/{len(casts)} {name} inside {_status_name(gd, st)}")
                    break

    for st in sorted(set(best.status_uptime) | set(other.status_uptime)):
        b, o = best.status_uptime.get(st, 0.0), other.status_uptime.get(st, 0.0)
        if b - o >= 0.05:
            reasons.append(f"{_status_name(gd, st)} uptime {b * 100:.0f}% vs {o * 100:.0f}%")

    if not reasons:
        reasons.append("same skills, better ordering or timing")
    return f"{head}: " + "; ".join(reasons)


def explain(best: SimResult, other: SimResult, gd: GameData) -> str:
    return explain_ranked(best, other, gd, "Best", "the alternative")
