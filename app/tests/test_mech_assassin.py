"""Assassin structured mechanics: specialties decoded, crit proc, stat-mod buffs, hand-computed simulations.

Source of the numbers: research/classes/assassin/skills.json datamine tokens (see _build_specs.py)."""
import time

import pytest

from aion2c.data import loader
from aion2c.engine import build_optimizer as bo
from aion2c.engine.simulator import simulate
from aion2c.models import CharacterBuild, Priority, PriorityEntry, Scenario, Stats

KEY = "assassin"
# Options whose value is in no source or needs a mechanic the engine lacks. A new entry here must be a conscious choice.
UNKNOWN = {
    ("throw-shadowblade", 3), ("ambush", 3), ("shadowstrike", 4), ("insignia-explosion", 2), ("whirlwind-slice", 1),
    ("aerial-bind", 2), ("smoke-bomb", 1), ("defiance", 0), ("triniels-dagger", 1), ("illusive-clone", 3),
    ("storm-rampage", 3), ("heart-gore", 3), ("swift-contract", 0),
}
_VALUELESS_OK = ("adds_status", "reset_skill", "removes_cooldown", "force_crit", "mobile", "ignore_block", "no_dps")


@pytest.fixture(scope="module")
def gd():
    if not loader.default_path(KEY).is_file():
        pytest.skip("assassin gamedata not built")
    return loader.load_gamedata(class_key=KEY)


def _run(gd, stigmas, entries, crit=80.0, secs=30.0, specs=None, ranks=None):
    b = CharacterBuild("t", "global", 45, stats=Stats(crit_chance_pct=crit), class_key=KEY,
                       stigmas=tuple(stigmas), specs=specs or {}, skill_ranks=ranks or {})
    return simulate(gd, b, Priority(tuple(PriorityEntry(e) for e in entries)), Scenario("x", "x", secs, 1, True))


def _unknown(sp):
    return any(e.kind == "unknown" or (e.value.value is None and e.kind not in _VALUELESS_OK) for e in sp.effects)


def test_every_option_decoded_unknowns_listed(gd):
    total, unknown = 0, set()
    for k, s in gd.skills.items():
        if s.kind in ("passive", "system", "proc", "chain", "dodge") and not s.specializations:
            continue
        for i, sp in enumerate(s.specializations):
            total += 1
            assert sp.effects, f"{k} option {i} has no effects"
            if _unknown(sp):
                unknown.add((k, i))
    assert total >= 100
    assert unknown == UNKNOWN
    assert len(unknown) / total < 0.15
    assert gd.specs_parsed


def test_every_active_has_five_options_with_unlock_ranks(gd):
    for k, s in gd.skills.items():
        if s.kind == "active" and s.specializations:
            assert len(s.specializations) == 5, k
            assert all(sp.rank_required in (8, 12, 16) for sp in s.specializations), k


def test_heart_gore_is_a_crit_proc_hand_count(gd):
    """Hand count: crit chance 80% (the cap) and Quick Slice's 2 hits give 1.6 crit events on the first cast, so Heart
    Gore fires at t=0; its 5 s cooldown then lets it fire at t=5,10,15,20,25 (every cast adds >= 0.8 events and casts
    are 1.0 s apart). 30 s -> 6 procs, every one a free proc (not a cast)."""
    r = _run(gd, [], ["quick-slice"])
    assert r.per_skill["heart-gore"].casts == 6
    assert "heart-gore" not in {c.skill_key for c in r.casts}
    # with no crit chance there is no proc at all
    assert "heart-gore" not in _run(gd, [], ["quick-slice"], crit=0.0).per_skill


def test_swift_contract_combat_speed_hand_count(gd):
    """Swift Contract: +20% Combat Speed for 20 s (token abe:1339000011 = 20, se:1339000011 time = 20 at rank 20).
    Cast at t=0 (1.0 s lock, 0 cd); afterwards each Quick Slice chain cast locks round(1000/1.2) = 833 ms, so casts are
    at 1000 + 833k ms while < 20000 ms: k = 0..22 -> 23 casts + the Swift Contract cast = 24. Without it: 20."""
    st = gd.statuses["swift_contract"]
    assert [(m.stat, m.value.value) for m in st.stat_mods] == [("combat_speed_pct", 20.0)]
    assert st.duration_s.value == 20.0
    r = _run(gd, ["swift-contract"], ["swift-contract", "quick-slice"], secs=20.0)
    assert len(r.casts) == 24
    assert r.status_uptime["swift_contract"] == pytest.approx(1.0)
    assert len(_run(gd, [], ["quick-slice"], secs=20.0).casts) == 20


def test_chain_specialties_are_datamine_ratios(gd):
    """Chain-skill specialties are worth child/parent damage; the atk ratio and the rank-1 flat agree exactly."""
    def mult(parent, option):
        return next(e.value.value for e in gd.skills[parent].specializations[option].effects if e.kind == "extra_hits")
    pairs = {("throw-shadowblade", 0): "shadowblade-pursuit", ("infiltrate", 3): "dark-strike",
             ("aerial-bind", 1): "aerial-slaughter"}
    for (parent, opt), child in pairs.items():
        p, c = gd.skills[parent], gd.skills[child]
        assert mult(parent, opt) == pytest.approx(c.atk_ratio_pct.value / p.atk_ratio_pct.value, abs=1e-3)
        assert mult(parent, opt) == pytest.approx(c.ranks[0].flat_min.value / p.ranks[0].flat_min.value, abs=0.01)
    assert mult("throw-shadowblade", 0) == pytest.approx(1.10, abs=1e-3)


def test_buff_windows_and_stat_mods(gd):
    s = gd.statuses
    assert s["illusive_clone"].duration_s.value == 20.0 and s["illusive_clone"].dmg_mult.value == 1.2
    ew = s["exploit_weakness_atk"]
    assert [(m.stat, m.value.value) for m in ew.stat_mods] == [("attack_increase_pct", 15.0)] and ew.dmg_mult.value == 1.0
    # specialty buffs derived from the same tokens
    assert s["illusive_ew_boost"].stat_mods[0].value.value == pytest.approx(0.5 * 15.0)
    assert s["swift_assault_stance"].stat_mods[0].value.value == pytest.approx(0.5 * 25.0)
    assert s["spec_illusive-clone_1_buff"].stat_mods[0].value.value == 20.0
    assert s["spec_illusive-clone_1_buff"].duration_s.value == 20.0
    # Surging Bloodlust boosts ONE skill: not a blanket multiplier any more
    assert s["surging_bloodlust"].dmg_mult.value is None
    # base skills no longer hand out Insignia without their specialty
    assert not gd.rules["ambush"].applies and not gd.rules["heart-gore"].applies


def test_quick_slice_cooldown_cut_moves_insignia_explosion(gd):
    """Quick Slice option 3 takes 2 s (2 hits x 1 s) off Insignia Explosion per cast: it is ready sooner."""
    rk = {"quick-slice": 12, "insignia-explosion": 12}
    kw = dict(secs=60.0, crit=0.0, ranks=rk)
    base = _run(gd, [], ["insignia-explosion", "quick-slice"], **kw)
    cut = _run(gd, [], ["insignia-explosion", "quick-slice"], specs={"quick-slice": (3,)}, **kw)
    ie = lambda r: r.per_skill["insignia-explosion"].casts  # noqa: E731
    assert ie(cut) > ie(base)
    # at rank 1 the option (needs rank 12) is ignored, with a warning
    low = _run(gd, [], ["insignia-explosion", "quick-slice"], specs={"quick-slice": (3,)}, secs=60.0, crit=0.0)
    assert any("needs rank" in w for w in low.warnings)


@pytest.mark.parametrize("style", ["boss", "aoe"])
def test_optimize_full_build_level45_picks_specialties(gd, style):
    b = CharacterBuild("t", "global", 45, stats=Stats(crit_chance_pct=40), class_key=KEY, skill_points=60, stigma_points=40)
    t0 = time.perf_counter()
    fb = bo.optimize_full_build(gd, b, style)
    assert time.perf_counter() - t0 < 60
    assert fb.result.dps > 0
    assert fb.build.specs and fb.spec_picks
    assert all(p.dps_gain_pct > 0 for p in fb.spec_picks)
    assert fb.result.per_skill["heart-gore"].casts > 0  # the crit proc contributes in every playstyle
