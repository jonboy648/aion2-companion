import dataclasses

import pytest

import aion2c.daevanion as dv
from aion2c.models import (
    CharacterBuild,
    DaevanionBoard,
    DaevanionNode,
    Priority,
    PriorityEntry,
    Stats,
)
from aion2c.testing.fakes import fake_sim_result


@pytest.fixture
def tiny(mini_gd):
    return mini_gd.daevanion["tiny"]


@pytest.fixture
def strike_pri():
    return Priority((PriorityEntry("strike"),))


def test_selectable_start(tiny):
    assert dv.selectable(tiny, frozenset()) == {2, 4}


def test_invalid_island(tiny):
    assert dv.valid(tiny, frozenset({3})) is False
    assert dv.valid(tiny, frozenset({2, 3})) is True
    assert dv.valid(tiny, frozenset()) is True


def test_points(mini_gd):
    assert dv.points_spent(mini_gd, frozenset({2, 3})) == 3


def test_apply_stats(mini_gd, default_build):
    b = dataclasses.replace(default_build, daevanion_nodes=frozenset({2, 4}))
    assert dv.apply_stats(mini_gd, b).attack == default_build.stats.attack + 10  # crit node adds nothing
    assert dv.apply_stats(mini_gd, default_build) is default_build.stats


def test_suggest_prefers_attack(mini_gd, default_build, strike_pri, scen10, fake_sim):
    fake_sim("aion2c.daevanion.simulate")
    path, gain = dv.suggest_path(mini_gd, default_build, strike_pri, scen10, 3)
    assert path[0] == 2
    assert gain > 0
    assert 4 not in path  # unknown-mapped rating is never simulated


def test_suggest_respects_budget_and_pvp(mini_gd, default_build, strike_pri, scen10, fake_sim):
    fake_sim("aion2c.daevanion.simulate")
    path, _ = dv.suggest_path(mini_gd, default_build, strike_pri, scen10, 0)
    assert path == []


def _skill_chain_gd(mini_gd, n_nodes=6):
    nodes = {1: DaevanionNode(1, "Start", "", 0, "start", (), None, (2,), 0, 0)}
    for i in range(2, 2 + n_nodes):
        adj = (i - 1,) + ((i + 1,) if i < 1 + n_nodes else ())
        nodes[i] = DaevanionNode(i, "Skill Up", "Rare", 1, "skill", (), "strike", adj, i, 0)
    board = DaevanionBoard("chain", "Chain", 1, nodes, 1)
    return dataclasses.replace(mini_gd, daevanion={"chain": board})


def test_skill_cap4(mini_gd, default_build, strike_pri, scen10, monkeypatch):
    gd = _skill_chain_gd(mini_gd)

    def sim(gd_, build, *a, **k):  # DPS grows with each skill node on the build
        return fake_sim_result(dps=1000.0 + 100 * len(build.daevanion_nodes))

    monkeypatch.setattr("aion2c.daevanion.simulate", sim)
    path, _ = dv.suggest_path(gd, default_build, strike_pri, scen10, 100)
    assert len(path) == 4
    assert dv.skill_bonus(gd, frozenset(range(2, 8))) == {"strike": 4}


def test_bridge_through_zero_gain_node(mini_gd, default_build, strike_pri, scen10, fake_sim):
    # start -> HP node (no gain) -> Attack node: greedy alone would stall at the HP node
    n = {
        1: DaevanionNode(1, "Start", "", 0, "start", (), None, (2,), 0, 0),
        2: DaevanionNode(2, "HP", "Common", 1, "stat", (dataclasses.replace(
            mini_gd.daevanion["tiny"].nodes[2].effects[0], stat="HP"),), None, (1, 3), 1, 0),
        3: mini_gd.daevanion["tiny"].nodes[2].__class__(
            3, "Atk", "Common", 1, "stat", mini_gd.daevanion["tiny"].nodes[2].effects, None, (2,), 2, 0),
    }
    gd = dataclasses.replace(mini_gd, daevanion={"b": DaevanionBoard("b", "B", 1, n, 1)})
    fake_sim("aion2c.daevanion.simulate")
    path, gain = dv.suggest_path(gd, default_build, strike_pri, scen10, 5)
    assert path == [2, 3] and gain > 0


def test_level_gate(mini_gd, default_build, strike_pri, scen10, fake_sim):
    fake_sim("aion2c.daevanion.simulate")
    gd = dataclasses.replace(mini_gd, daevanion={"tiny": dataclasses.replace(mini_gd.daevanion["tiny"], unlock_level=50)})
    assert dv.suggest_path(gd, default_build, strike_pri, scen10, 5)[0] == []


def test_real_board_reachable(sorc_gd):
    board = sorc_gd.daevanion["nezekan"]
    assert len(board.nodes) == 89
    seen, todo = {board.start_id}, [board.start_id]
    while todo:
        for a in board.nodes[todo.pop()].adjacent:
            if a in board.nodes and a not in seen:
                seen.add(a)
                todo.append(a)
    assert seen == set(board.nodes)
    # every node is selectable one at a time along some order from the start
    assert dv.valid(board, frozenset(board.nodes) - {board.start_id})
