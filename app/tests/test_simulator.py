import time
from dataclasses import replace

import pytest

from aion2c.engine.simulator import simulate, simulate_macro
from aion2c.models import (
    SCENARIOS, CharacterBuild, DaevanionBoard, DaevanionNode, KeybindPlan, LiveState, MacroEntry,
    MacroPlan, Num, Priority, PriorityEntry, SimConfig, SlotStack, Stats, Status, StatusTrigger,
)

RANK_WARN = "ranking assumed, unverified at rank > 1"


def P(*items):
    return Priority(tuple(it if isinstance(it, PriorityEntry) else PriorityEntry(it) for it in items))


def B(**stats):
    return CharacterBuild("T", "global", 45, stats=Stats(**stats))


def keys(res):
    return [c.skill_key for c in res.casts]


def run(gd, prio, scenario, build=None, cfg=SimConfig(), initial=None):
    return simulate(gd, build or B(), prio, scenario, cfg, initial)


def test_amp_window(mini_gd, scen10):
    r = run(mini_gd, P("amp", "nuke", "strike"), scen10)
    assert r.total_damage == 18000 and r.dps == 1800.0
    assert keys(r) == ["amp", "nuke", "strike", "strike", "strike", "nuke", "strike", "strike", "strike", "nuke"]


def test_no_amp(mini_gd, scen10):
    assert run(mini_gd, P("nuke", "strike"), scen10).total_damage == 16000


def test_requires_and_proc(mini_gd, scen):
    r = run(mini_gd, P("blaze", "mark_hit"), scen(6))
    assert r.total_damage == 4500
    assert [c.t_s for c in r.casts if c.skill_key == "blaze"] == [2.0]


def test_chain(mini_gd, scen):
    r = run(mini_gd, P("chain1"), scen(4))
    assert keys(r) == ["chain1", "chain2", "chain3", "chain1"] and r.total_damage == 5500


def test_charge(mini_gd, scen):
    r = run(mini_gd, P(PriorityEntry("charge", 3), "strike"), scen(5))
    assert [c.t_s for c in r.casts] == [0.0, 2.5, 3.5, 4.5]
    assert r.total_damage == 6000
    assert r.casts[0].charge_level == 3


def test_charge_zero_means_highest(mini_gd, scen):
    r = run(mini_gd, P("charge"), scen(5))
    assert r.casts[0].charge_level == 3 and r.total_damage == 3000


def test_mp_gate(mini_gd, scen10):
    r = run(mini_gd, P(PriorityEntry("charge", 1), "strike"), scen10, B(max_mp=50, mp_regen_per_s=0))
    assert "charge" not in keys(r) and r.total_damage == 10000


def test_aoe(mini_gd, scen):
    assert run(mini_gd, P("nuke", "strike"), scen(10, 4)).total_damage == 43000


def test_combat_speed(mini_gd, scen10):
    r = run(mini_gd, P("strike"), scen10, B(combat_speed_pct=100))
    assert len(r.casts) == 20 and r.total_damage == 20000


def test_chain_child_not_standalone(mini_gd, scen10):
    assert run(mini_gd, P("chain3"), scen10).total_damage == 0


def test_auto_chain_false(mini_gd, scen):
    r = run(mini_gd, P("chain1"), scen(4), cfg=SimConfig(auto_chain=False))
    assert keys(r) == ["chain1"] * 4 and r.total_damage == 4000


def test_auto_chain_false_child_entries(mini_gd, scen):
    r = run(mini_gd, P("chain3", "chain2", "chain1"), scen(4), cfg=SimConfig(auto_chain=False))
    assert keys(r) == ["chain1", "chain2", "chain3", "chain1"]


def test_charge_window_expiry(mini_gd, scen10):
    r = run(mini_gd, P("amp", "charge"), scen10, cfg=SimConfig(anim_overrides={"amp": 4.0}))
    assert r.total_damage == 3000


def test_trigger_accumulator(mini_gd, scen):
    gd = replace(mini_gd, triggers=(StatusTrigger("mark", "fire", 0.25, "strike"),))
    r = run(gd, P("blaze", "nuke", "strike"), scen(6))
    assert keys(r) == ["nuke", "strike", "strike", "strike", "blaze", "nuke"]
    assert r.total_damage == 11000


def _focus_gd(mini_gd):
    st = Status("focus", "Focus", "self", Num(1.0, "confirmed"), Num(2.0, "confirmed"),
                mp_min_pct=50.0, source_skill="strike")
    return replace(mini_gd, statuses={**mini_gd.statuses, "focus": st})


def test_passive_mp_threshold(mini_gd, scen10):
    gd = _focus_gd(mini_gd)
    hi = run(gd, P("strike"), scen10, B(mp_regen_per_s=0), cfg=SimConfig(start_mp_pct=60))
    lo = run(gd, P("strike"), scen10, B(mp_regen_per_s=0), cfg=SimConfig(start_mp_pct=40))
    assert hi.total_damage == 20000 and lo.total_damage == 10000
    assert hi.status_uptime["focus"] == 1.0 and "focus" not in lo.status_uptime


def test_passive_uptime_with_regen(mini_gd, scen10):
    # start 0 MP, 200/s regen, max 2000: crosses 50% (1000) at 5 s -> active for the second half
    r = run(_focus_gd(mini_gd), P("strike"), scen10, B(mp_regen_per_s=200), cfg=SimConfig(start_mp_pct=0))
    assert abs(r.status_uptime["focus"] - 0.5) < 1e-6


def test_passive_gated_by_source_unlock(mini_gd, scen10):
    r = simulate(_focus_gd(mini_gd), CharacterBuild("T", "global", 0, stats=Stats()), P("strike"), scen10)
    assert r.total_damage == 0 and "focus" not in r.status_uptime


def test_require_status(mini_gd, scen10):
    r = run(mini_gd, P(PriorityEntry("nuke", 0, "amp_buff"), "amp", "strike"), scen10)
    assert r.total_damage == 14000


def test_initial_state(mini_gd, scen10):
    live = LiveState(0.0, {"nuke": 3.0}, {}, None, None, "estimated")
    assert run(mini_gd, P("nuke", "strike"), scen10, initial=live).total_damage == 14000


def test_initial_status_and_mp(mini_gd, scen10):
    live = LiveState(0.0, {"amp": 100.0}, {"amp_buff": 2.0}, 500.0, None, "estimated")
    r = run(mini_gd, P("strike"), scen10, initial=live)
    assert r.total_damage == 2 * 1500 + 8 * 1000 and r.status_uptime["amp_buff"] == 0.2


def test_status_uptime(mini_gd, scen10):
    r = run(mini_gd, P("amp", "nuke", "strike"), scen10)
    assert r.status_uptime["amp_buff"] == 0.5
    nuke1 = [c for c in r.casts if c.skill_key == "nuke"][0]
    assert nuke1.t_s == 1.0 and "amp_buff" in nuke1.active_statuses
    assert "amp_buff" not in r.casts[0].active_statuses  # a buff never boosts its own cast


def test_consume_removes_uptime(mini_gd, scen):
    r = run(mini_gd, P("blaze", "mark_hit"), scen(6))
    # mark applied at 1.0, consumed at 2.0, applied again at 4.0 (clipped to 6.0): 1 + 2 s of 6
    assert abs(r.status_uptime["mark"] - 3.0 / 6.0) < 1e-9


def _plan(stacks, entries, delay=0):
    st = tuple(SlotStack(k, tuple(v)) for k, v in stacks.items())
    es = tuple(MacroEntry(i, k, delay) for i, k in enumerate(entries))
    return KeybindPlan(stacks=st, macros=(MacroPlan("M", "F9", es),))


def test_macro_order(mini_gd, scen10):
    plan = _plan({"1": ["amp"], "2": ["strike"], "3": ["nuke"]}, ["1", "2", "3"])
    r = simulate_macro(mini_gd, B(), plan, "M", scen10)
    assert r.total_damage == 16000 < run(mini_gd, P("amp", "nuke", "strike"), scen10).total_damage


def test_macro_stack(mini_gd, scen10):
    plan = _plan({"1": ["nuke", "strike"]}, ["1"])
    r = simulate_macro(mini_gd, B(), plan, "M", scen10)
    assert r.total_damage == 16000 == run(mini_gd, P("nuke", "strike"), scen10).total_damage


def test_macro_delay_added(mini_gd, scen10):
    plan = _plan({"1": ["strike"]}, ["1"], delay=1000)
    assert simulate_macro(mini_gd, B(), plan, "M", scen10).total_damage == 5000


def test_macro_unknown_name(mini_gd, scen10):
    with pytest.raises(ValueError):
        simulate_macro(mini_gd, B(), _plan({"1": ["strike"]}, ["1"]), "nope", scen10)


def test_deterministic(mini_gd, scen10):
    p = P("amp", "mark_hit", "blaze", "nuke", "strike")
    assert run(mini_gd, p, scen10) == run(mini_gd, p, scen10)


def test_confidence_and_unknown_warning(mini_gd, scen10):
    assert run(mini_gd, P("strike"), scen10).confidence == "confirmed"
    sk2 = replace(mini_gd.skills["strike"], anim_lock_s=Num(1.0, "unknown"))
    gd = replace(mini_gd, skills={**mini_gd.skills, "strike": sk2})
    r = run(gd, P("strike"), scen10)
    assert r.confidence == "unknown" and any("strike" in w and "animation" in w for w in r.warnings)
    assert r.total_damage == 10000


def test_rank_warning(sorc_gd, scen10):
    b = CharacterBuild("T", "global", 45, skill_ranks={"flame-arrow": 5})
    assert RANK_WARN in simulate(sorc_gd, b, P("flame-arrow"), scen10).warnings
    r1 = simulate(sorc_gd, CharacterBuild("T", "global", 45), P("flame-arrow"), scen10)
    assert RANK_WARN not in r1.warnings


def _burn_gd(mini_gd, tick):
    st = Status("burn", "Burn", "target", Num(3.0, "confirmed"), Num(1.0, "confirmed"),
                tick_ratio_pct=tick, tick_s=Num(1.0, "confirmed"))
    rule = replace(mini_gd.rules["amp"], applies=("burn",))
    return replace(mini_gd, statuses={**mini_gd.statuses, "burn": st}, rules={**mini_gd.rules, "amp": rule})


def test_dot_ticks(mini_gd, scen10):
    r = run(_burn_gd(mini_gd, Num(50.0, "confirmed")), P("amp"), scen10)
    # applied at 0: ticks at 1 s and 2 s (3 s is not < expiry); each 500, credited to amp
    assert r.total_damage == 1000 and r.per_skill["amp"].damage == 1000


def test_unknown_tick_warns_by_skill(mini_gd, scen10):
    r = run(_burn_gd(mini_gd, Num(None, "unknown")), P("amp"), scen10)
    assert r.total_damage == 0 and any("amp" in w and "tick" in w for w in r.warnings)


def test_daevanion_rank_bonus_clamped(sorc_gd, scen10):
    nodes = {i: DaevanionNode(i, "n", "c", 1, "skill", (), "flame-arrow", (), 0, 0) for i in range(1, 7)}
    gd = replace(sorc_gd, daevanion={"b": DaevanionBoard("b", "B", 1, nodes, 1)})
    b = CharacterBuild("T", "global", 45, daevanion_nodes=frozenset(range(1, 7)))
    assert RANK_WARN in simulate(gd, b, P("flame-arrow"), scen10).warnings  # rank 1 + 4, not +6
    capped = replace(gd, rank_caps={"global": {"core": 3, "stigma": 3}, "korea": {"core": 40, "stigma": 25}})
    assert RANK_WARN in simulate(capped, b, P("flame-arrow"), scen10).warnings  # clamped to 3, still > 1
    one = replace(gd, rank_caps={"global": {"core": 1, "stigma": 1}, "korea": {"core": 40, "stigma": 25}})
    assert RANK_WARN not in simulate(one, b, P("flame-arrow"), scen10).warnings


def test_apply_stats_patched(mini_gd, scen10, monkeypatch):
    monkeypatch.setattr("aion2c.engine.simulator.apply_stats", lambda gd, b: Stats(attack=2000))
    assert run(mini_gd, P("strike"), scen10).total_damage == 20000


def test_region_gate(sorc_gd, scen10):
    # hellfire unlocks at 14: a level 10 build never casts it
    r = simulate(sorc_gd, CharacterBuild("T", "global", 10), P("hellfire", "flame-arrow"), scen10)
    assert "hellfire" not in keys(r) and "flame-arrow" in keys(r)


@pytest.mark.parametrize("scn", ["boss_180", "aoe_pack", "level_pull"])
def test_real_smoke(sorc_gd, sorc_priority, scn):
    sc = next(s for s in SCENARIOS if s.key == scn)
    t0 = time.perf_counter()
    r = simulate(sorc_gd, CharacterBuild("T", "global", 45), sorc_priority, sc)
    assert time.perf_counter() - t0 < 1.0 and r.dps > 0
