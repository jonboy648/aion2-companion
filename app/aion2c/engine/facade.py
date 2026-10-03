"""Engine facade. P3 owns the body; structurally satisfies interfaces.EngineFacade."""
from aion2c.engine.advisor import marginal_stats
from aion2c.engine.next_skills import next_skills
from aion2c.engine.search import optimize
from aion2c.engine.simulator import simulate
from aion2c.models import (
    CharacterBuild,
    GameData,
    LiveState,
    OptimizeResult,
    Priority,
    Scenario,
    SimConfig,
    SimResult,
    StatGain,
)


class Engine:
    def __init__(self, gd: GameData, cfg: SimConfig = SimConfig()):
        self.gd = gd
        self.cfg = cfg

    def optimize(self, build: CharacterBuild, scenario: Scenario) -> OptimizeResult:
        return optimize(self.gd, build, scenario, self.cfg)

    def simulate(self, build: CharacterBuild, priority: Priority, scenario: Scenario) -> SimResult:
        return simulate(self.gd, build, priority, scenario, self.cfg)

    def marginal(self, build: CharacterBuild, priority: Priority, scenario: Scenario) -> list[StatGain]:
        return marginal_stats(self.gd, build, priority, scenario, self.cfg)

    def next_skills(
        self,
        build: CharacterBuild,
        priority: Priority,
        scenario: Scenario,
        live: LiveState | None,
        n: int = 5,
    ) -> list[str]:
        return next_skills(self.gd, build, priority, scenario, live, n)

    def set_config(self, cfg: SimConfig) -> None:
        self.cfg = cfg
