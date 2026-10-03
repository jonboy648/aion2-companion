"""Panel feed. P2 owns the body."""
from aion2c.engine.simulator import simulate
from aion2c.models import CharacterBuild, GameData, LiveState, Priority, Scenario


def next_skills(
    gd: GameData,
    build: CharacterBuild,
    priority: Priority,
    scenario: Scenario,
    live: LiveState | None,
    n: int = 5,
) -> list[str]:
    """First n skill keys of the simulated cast sequence (from `live` state when given)."""
    res = simulate(gd, build, priority, scenario, initial=live)
    return [c.skill_key for c in res.casts[:n]]
