"""Community rotation diff (PLAN P3)."""
from aion2c.engine.simulator import simulate  # noqa: F401  (patch target)
from aion2c.models import (
    CharacterBuild,
    Disagreement,
    GameData,
    Priority,
    PriorityEntry,
    RankedOption,
    Scenario,
    SimConfig,
)

SHARE_THRESHOLD = 0.05  # "community lacks a skill we cast for >= 5% of damage"
POS_THRESHOLD = 2


def _available(gd: GameData, build: CharacterBuild) -> dict[str, PriorityEntry]:
    # local import: search imports this module
    from aion2c.engine.search import candidate_skills

    best: dict[str, PriorityEntry] = {}
    for e in candidate_skills(gd, build):
        if e.skill_key not in best or e.charge_level > best[e.skill_key].charge_level:
            best[e.skill_key] = e
    return best


def compare(
    gd: GameData,
    build: CharacterBuild,
    scenario: Scenario,
    best: RankedOption,
    cfg: SimConfig,
) -> tuple[Disagreement, ...]:
    avail = _available(gd, build)
    ours = [e.skill_key for e in best.priority.entries]
    total = best.result.total_damage
    out: list[Disagreement] = []
    for cr in gd.community:
        if cr.scenario_key != scenario.key:
            continue
        entries, dropped, seen = [], [], set()
        for k in cr.priority:
            if k in avail and k not in seen:
                entries.append(avail[k])
                seen.add(k)
            elif k not in avail:
                dropped.append(k)
        if not entries:
            continue
        com = simulate(gd, build, Priority(tuple(entries), label=cr.key), scenario, cfg)
        delta = (best.result.dps / com.dps - 1) * 100 if com.dps > 0 else 0.0
        note = f" (not available to you: {', '.join(dropped)})" if dropped else ""
        for k in dict.fromkeys(ours + list(cr.priority)):
            if k in dropped:
                continue
            cpos = cr.priority.index(k) + 1 if k in cr.priority else -1
            opos = ours.index(k) + 1 if k in ours else -1
            name = gd.skills[k].name if k in gd.skills else k
            if cpos > 0 and opos > 0 and abs(cpos - opos) >= POS_THRESHOLD:
                why = f"{cr.key} casts {name} at #{cpos}, we cast it at #{opos}"
            elif cpos < 0 and opos > 0:
                t = best.result.per_skill.get(k)
                if not (t and total > 0 and t.damage / total >= SHARE_THRESHOLD):
                    continue
                why = f"{cr.key} never casts {name}, we cast it at #{opos} ({t.damage / total * 100:.0f}% of damage)"
            else:
                continue
            out.append(
                Disagreement(cr.key, k, cpos, opos, delta, f"{why}; our priority is {delta:+.1f}% DPS vs it{note}")
            )
    return tuple(out)
