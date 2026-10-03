"""Protocols shared across packages. Wave 0 owns this file."""
from typing import Protocol, runtime_checkable

from aion2c.models import (
    CharacterBuild,
    LiveState,
    OptimizeResult,
    Priority,
    Scenario,
    SimConfig,
    SimResult,
    StatGain,
)


@runtime_checkable
class LiveStateSource(Protocol):
    def snapshot(self) -> LiveState | None: ...


@runtime_checkable
class EngineFacade(Protocol):
    def optimize(self, build: CharacterBuild, scenario: Scenario) -> OptimizeResult: ...

    def simulate(self, build: CharacterBuild, priority: Priority, scenario: Scenario) -> SimResult: ...

    def marginal(self, build: CharacterBuild, priority: Priority, scenario: Scenario) -> list[StatGain]: ...

    def next_skills(
        self,
        build: CharacterBuild,
        priority: Priority,
        scenario: Scenario,
        live: LiveState | None,
        n: int = 5,
    ) -> list[str]: ...

    def set_config(self, cfg: SimConfig) -> None: ...
