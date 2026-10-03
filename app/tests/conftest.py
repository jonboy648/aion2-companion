"""Shared fixtures. QT_QPA_PLATFORM is set before any Qt import."""
import os

os.environ["QT_QPA_PLATFORM"] = "offscreen"

from pathlib import Path  # noqa: E402

import pytest  # noqa: E402

from aion2c.data.loader import load_gamedata  # noqa: E402
from aion2c.models import (  # noqa: E402
    CharacterBuild,
    Priority,
    PriorityEntry,
    Scenario,
    SkillBar,
    Stats,
)
from aion2c.testing import fakes  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def mini_gd():
    return load_gamedata(FIXTURES / "mini_gamedata.json")


@pytest.fixture(scope="session")
def sorc_gd():
    return load_gamedata(FIXTURES / "sorc_gamedata_small.json")


@pytest.fixture
def default_build():
    return CharacterBuild("Test", "global", 45, stats=Stats(crit_chance_pct=0))


@pytest.fixture
def boss_scenario():
    return Scenario("boss_180", "Single-target boss", 180, 1, True)


@pytest.fixture
def scen10():
    return Scenario("t10", "t", 10, 1, False)


@pytest.fixture
def scen():
    def make(duration_s: float, n_targets: int = 1) -> Scenario:
        return Scenario("t", "t", duration_s, n_targets, False)

    return make


@pytest.fixture
def sorc_bar():
    keys = {
        "1": "flame-arrow", "2": "firestorm", "3": "blaze", "4": "hellfire", "5": "element-enhancement",
        "6": "defiance", "7": "steel-barrier", "8": "bittercold-wind", "9": "frost-burst",
        "0": "winters-shackles",
    }
    return SkillBar(slots=keys)


@pytest.fixture
def sorc_priority():
    keys = ("element-enhancement", "hellfire", "blaze", "firestorm", "flame-arrow")
    return Priority(tuple(PriorityEntry(k) for k in keys), label="sorc")


@pytest.fixture
def fake_engine():
    return fakes.FakeEngine()


@pytest.fixture
def fake_sim(monkeypatch):
    """Call `fake_sim("aion2c.engine.search.simulate", ...)` to patch each dotted target."""

    def install(*targets: str):
        for t in targets:
            fn = fakes.fake_simulate_macro if t.endswith("simulate_macro") else fakes.fake_simulate
            monkeypatch.setattr(t, fn)
        return fakes.fake_simulate

    return install


@pytest.fixture
def user_path(tmp_path, monkeypatch):
    p = tmp_path / "user.json"
    monkeypatch.setenv("AION2C_USER_PATH", str(p))
    return p


@pytest.fixture(scope="session")
def qapp():
    from PySide6.QtWidgets import QApplication

    app = QApplication.instance() or QApplication(["aion2c-tests"])
    yield app
