"""Fakes for Wave 1 tests. W0 owns this file."""
from aion2c.models import (
    SCENARIOS,
    CastEvent,
    CharacterBuild,
    GameData,
    LiveState,
    OptimizeResult,
    Priority,
    PriorityEntry,
    RankedOption,
    Scenario,
    SimConfig,
    SimResult,
    SkillKind,
    SkillTally,
    StatGain,
)

_UNCASTABLE = (SkillKind.CHAIN, SkillKind.PROC, SkillKind.CHARGE_TIER, SkillKind.PASSIVE)


def fake_sim_result(dps: float = 1800.0) -> SimResult:
    duration = 10.0
    total = dps * duration
    return SimResult(
        total_damage=total,
        dps=dps,
        duration_s=duration,
        casts=(CastEvent(0.0, "flame-arrow", 0, total, 2000.0, ()),),
        per_skill={"flame-arrow": SkillTally(1, total)},
        status_uptime={},
        warnings=("fake result",),
        confidence="estimated",
    )


def fake_simulate(
    gd: GameData,
    build: CharacterBuild,
    priority: Priority,
    scenario: Scenario,
    cfg: SimConfig = SimConfig(),
    initial: LiveState | None = None,
) -> SimResult:
    """Minimal real sim: first off-cooldown entry wins, rank 1, mult 1, no statuses/MP/chains.

    Deterministic and linear in attack. Lock = anim_lock_s / (1 + combat_speed_pct/100).
    """
    st = build.stats
    base = st.attack * (1 + st.attack_increase_pct / 100) * (1 + st.weapon_dmg_pct / 100)
    boost = 1 + (st.dmg_boost_pct + st.pve_dmg_pct + (st.boss_dmg_pct if scenario.boss else 0)) / 100
    ready: dict[str, int] = {}
    t = 0
    dur = round(scenario.duration_s * 1000)
    casts: list[CastEvent] = []
    tally: dict[str, list[float]] = {}
    total = 0.0
    while t < dur:
        fired = False
        for e in priority.entries:
            sk = gd.skills.get(e.skill_key)
            if sk is None or sk.kind in _UNCASTABLE:
                continue
            if sk.unlock_level is not None and sk.unlock_level > build.level:
                continue
            if t < ready.get(sk.key, 0):
                continue
            r = sk.ranks[0] if sk.ranks else None
            flat = 0.0
            if r is not None and r.flat_min.value is not None and r.flat_max.value is not None:
                flat = (r.flat_min.value + r.flat_max.value) / 2
            ratio = sk.atk_ratio_pct.value or 0.0
            dmg = max(0.0, base * ratio / 100 + flat) * boost * min(scenario.n_targets, sk.aoe_targets)
            lock_s = cfg.anim_overrides.get(sk.key, sk.anim_lock_s.value or 1.0)
            lock = round(lock_s / (1 + st.combat_speed_pct / 100) * 1000)
            cd = r.cooldown_s.value if r is not None and r.cooldown_s.value else 0.0
            ready[sk.key] = t + round(cd * 1000)
            casts.append(CastEvent(t / 1000, sk.key, 0, dmg, st.max_mp, ()))
            tally.setdefault(sk.key, [0, 0.0])
            tally[sk.key][0] += 1
            tally[sk.key][1] += dmg
            total += dmg
            t += max(1, lock)
            fired = True
            break
        if not fired:
            t += cfg.tick_ms
    return SimResult(
        total_damage=total,
        dps=total / scenario.duration_s,
        duration_s=scenario.duration_s,
        casts=tuple(casts),
        per_skill={k: SkillTally(int(v[0]), v[1]) for k, v in tally.items()},
        status_uptime={},
        warnings=(),
        confidence="estimated",
    )


def fake_simulate_macro(gd, build, plan, macro_name, scenario, cfg: SimConfig = SimConfig(), hand=()) -> SimResult:
    return fake_sim_result(dps=1500)


class FakeEngine:
    """Records every call name in `calls`. Structurally satisfies EngineFacade."""

    def __init__(self) -> None:
        self.calls: list[str] = []
        self.cfg: SimConfig | None = None

    def optimize(self, build: CharacterBuild, scenario: Scenario) -> OptimizeResult:
        self.calls.append("optimize")
        keys = [
            ("element-enhancement", "hellfire", "blaze", "firestorm", "flame-arrow"),
            ("hellfire", "element-enhancement", "blaze", "flame-arrow"),
            ("blaze", "firestorm", "flame-arrow"),
        ]
        opts = tuple(
            RankedOption(
                rank=i + 1,
                priority=Priority(tuple(PriorityEntry(k) for k in ks), label=f"fake {i + 1}"),
                result=fake_sim_result(dps),
                explanation=f"fake option {i + 1}",
            )
            for i, (ks, dps) in enumerate(zip(keys, (1800.0, 1600.0, 1500.0)))
        )
        return OptimizeResult(scenario=scenario, options=opts, disagreements=())

    def simulate(self, build: CharacterBuild, priority: Priority, scenario: Scenario) -> SimResult:
        self.calls.append("simulate")
        return fake_sim_result()

    def marginal(self, build: CharacterBuild, priority: Priority, scenario: Scenario) -> list[StatGain]:
        self.calls.append("marginal")
        return [
            StatGain("smite_pct", 1.0, 0.9, "estimated"),
            StatGain("crit_dmg_pct", 1.0, 0.6, "estimated"),
            StatGain("attack", 10.0, 0.3, "estimated"),
        ]

    def next_skills(self, build, priority, scenario, live, n: int = 5) -> list[str]:
        self.calls.append("next_skills")
        return ["flame-arrow", "burst", "pyroclasm", "firestorm", "hellfire"][:n]

    def set_config(self, cfg: SimConfig) -> None:
        self.calls.append("set_config")
        self.cfg = cfg


class NullStateSource:
    def snapshot(self) -> LiveState | None:
        return None
