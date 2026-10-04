"""Specialty chooser: which option(s) of each skill to equip for this build's ranks and playstyle.

Greedy by simulated DPS: skills are visited best-first, each fills its open slots one option at a time (every
step re-simulated with the options already equipped, so overlapping effects such as two cooldown cuts are not
double counted). Options that cannot change damage (mobility, crowd control, unknown text) are skipped.
`simulate` is imported at module level so tests can monkeypatch it here.
"""
from dataclasses import dataclass, replace

from aion2c.engine.simulator import simulate
from aion2c.models import CharacterBuild, GameData, Priority, Scenario, SimConfig, Skill, total_rank
from aion2c.specs import available_options, slots_at

_INERT = ("mobile", "ignore_block", "no_dps", "unknown")
MIN_GAIN = 1e-9  # relative DPS gain an option must beat to be worth a slot


@dataclass(frozen=True)
class SpecPick:
    skill_key: str
    option: int  # 0-based index into Skill.specializations
    text: str
    dps_gain_pct: float  # DPS lost if this one option is removed from the final build (leave-one-out)
    confidence: str  # weakest confidence of the option's effects ("unknown" = value not in any source)


def skill_rank(gd: GameData, build: CharacterBuild, key: str) -> int:
    """The rank the simulator uses for `key` (skill points + Daevanion nodes + bonus_ranks, region-capped)."""
    return total_rank(gd, build, gd.skills[key])


def _matters(sk: Skill, i: int) -> bool:
    effs = sk.specializations[i].effects
    return any(e.kind not in _INERT and e.cond != "unmodeled" and not (e.value.value is None and e.kind in
               ("dmg_mult", "extra_hits", "cdr_all_s", "cdr_skill_s", "resource_restore", "cooldown_add_s"))
               for e in effs)


def _conf(sk: Skill, i: int) -> str:
    cs = [e.value.confidence for e in sk.specializations[i].effects if e.kind not in _INERT] or ["unknown"]
    return min(cs, key=("unknown", "estimated", "confirmed").index)


def _castable_keys(gd: GameData, build: CharacterBuild, priority: Priority) -> list[str]:
    """Priority entries plus the chain children they reach, in priority order."""
    seen: list[str] = []
    for e in priority.entries:
        k: str | None = e.skill_key
        while k is not None and k not in seen and k in gd.skills:
            seen.append(k)
            rule = gd.rules.get(k)
            k = rule.chain_next if rule else None
    return seen


def choose_specs(gd: GameData, build: CharacterBuild, priority: Priority, scenario: Scenario,
                 cfg: SimConfig = SimConfig(), progress=None) -> dict[str, tuple[int, ...]]:
    """Best specialty options per skill (skill key -> 0-based option indices). Only options that raise DPS."""
    keys = []
    for k in _castable_keys(gd, build, priority):
        sk = gd.skills[k]
        r = skill_rank(gd, build, k)
        if slots_at(gd, r) or available_options(gd, sk, r):
            opts = [i for i in available_options(gd, sk, r) if _matters(sk, i)]
            if opts:
                keys.append((k, r, opts))
    specs: dict[str, tuple[int, ...]] = {}
    cur = simulate(gd, replace(build, specs={}), priority, scenario, cfg).dps
    if not keys or cur <= 0:
        return specs

    def dps(trial: dict[str, tuple[int, ...]]) -> float:
        return simulate(gd, replace(build, specs=trial), priority, scenario, cfg).dps

    # first pass: best single option per skill orders the skills
    first = {}
    for k, r, opts in keys:
        first[k] = max((dps({k: (i,)}) for i in opts), default=cur)
    for n, (k, r, opts) in enumerate(sorted(keys, key=lambda x: -first[x[0]])):
        if first[k] <= cur * (1 + MIN_GAIN):
            continue
        if progress:
            progress(f"Choosing specialties ({n + 1} of {len(keys)})")
        room = max(slots_at(gd, r), 1)
        chosen: tuple[int, ...] = ()
        for _ in range(room):
            best = None
            for i in opts:
                if i in chosen:
                    continue
                d = dps({**specs, k: chosen + (i,)})
                if d > cur * (1 + MIN_GAIN) and (best is None or d > best[0]):
                    best = (d, i)
            if best is None:
                break
            cur, chosen = best[0], chosen + (best[1],)
        if chosen:
            specs[k] = chosen
    return specs


def spec_picks(gd: GameData, build: CharacterBuild, priority: Priority, scenario: Scenario,
               cfg: SimConfig = SimConfig()) -> tuple[SpecPick, ...]:
    """The equipped options with the DPS each one adds (leave-one-out against the full equipped set)."""
    if not build.specs:
        return ()
    full = simulate(gd, build, priority, scenario, cfg).dps
    out = []
    for k, opts in build.specs.items():
        sk = gd.skills.get(k)
        if sk is None:
            continue
        for i in opts:
            rest = tuple(o for o in opts if o != i)
            trial = {**build.specs, k: rest} if rest else {kk: v for kk, v in build.specs.items() if kk != k}
            without = simulate(gd, replace(build, specs=trial), priority, scenario, cfg).dps
            gain = (full / without - 1) * 100 if without > 0 else 0.0
            out.append(SpecPick(k, i, sk.specializations[i].text if i < len(sk.specializations) else "", gain,
                                _conf(sk, i) if i < len(sk.specializations) else "unknown"))
    out.sort(key=lambda p: -p.dps_gain_pct)
    return tuple(out)
