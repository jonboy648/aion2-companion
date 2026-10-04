"""Sorcerer proc/buff casts: Wish of Concentration and the Flame Arrow > Burst > Pyroclasm chain.
Findings (see report): Sorcerer has no Flame Blessing (it is a Spiritmaster stigma). Wish is cast whenever it
sits ahead of the always-ready fillers (Flame Arrow has no cooldown). An earlier boss run left it behind Flame
Arrow (search-path dependent, +1.2% DPS when first); the current real-data boss run casts it."""
from collections import Counter
from dataclasses import replace

import pytest

from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.engine import search
from aion2c.engine.simulator import simulate
from aion2c.models import SCENARIOS, CharacterBuild, Priority, PriorityEntry, SimConfig, Stats

BOSS = SCENARIOS[0]
WISH = "wish-of-concentration"


@pytest.fixture(scope="module")
def gd():
    return loader.load_gamedata(class_key="sorcerer")


def P(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


def build(**kw):
    return CharacterBuild("t", "global", 45, stats=Stats(), class_key="sorcerer", **kw)


def casts(r):
    return Counter(c.skill_key for c in r.casts)


def test_sorcerer_has_no_flame_blessing(gd):
    assert not [k for k in gd.skills if "blessing" in k]


def test_wish_casts_and_adds_dps_when_ahead_of_fillers(gd):
    rest = ("hellfire", "blaze", "firestorm", "flame-arrow")
    with_wish = simulate(gd, build(), P(WISH, *rest), BOSS)
    without = simulate(gd, build(), P(*rest), BOSS)
    assert casts(with_wish)[WISH] > 0
    assert "wish_of_concentration" in with_wish.status_uptime and with_wish.status_uptime["wish_of_concentration"] > 0.2
    assert with_wish.dps > without.dps


def test_wish_behind_always_ready_filler_never_fires(gd):
    """Root cause of the 0-cast report: Flame Arrow has no cooldown, so anything after it is unreachable."""
    r = simulate(gd, build(), P("flame-arrow", WISH), BOSS)
    assert casts(r)[WISH] == 0


def test_search_includes_wish_on_boss(gd):
    opt = search.optimize(gd, build(), BOSS, budget=search.SearchBudget(max_candidates=400))
    best = opt.options[0]
    assert WISH in [e.skill_key for e in best.priority.entries]
    assert casts(best.result)[WISH] > 0


def test_full_build_boss_casts_wish(gd):
    fb = bo.optimize_full_build(gd, build(), "boss")
    assert casts(fb.result)[WISH] > 0


def test_chain_fires_on_global_and_adds_dps(gd):
    # Burst/Pyroclasm exist on Global (research/open_questions.md), so the chain runs without show_kr.
    g = simulate(gd, build(), P("flame-arrow"), BOSS)
    assert casts(g)["burst"] > 0 and casts(g)["pyroclasm"] > 0
    lone = simulate(gd, build(), P("flame-arrow"), BOSS, replace(SimConfig(), auto_chain=False))
    assert g.dps > lone.dps
