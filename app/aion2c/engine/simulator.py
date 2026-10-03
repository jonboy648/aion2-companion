"""Fight simulator (PLAN section 3 P2 + 3b engine rule). P2 owns the body.

CIRCULAR IMPORT RULE: aion2c.daevanion imports `simulate` from here and this module needs
`apply_stats` from there. Keep the `apply_stats` import at the BOTTOM of this file (after
`simulate`/`simulate_macro` are defined) and keep daevanion's `simulate` import at the bottom of
daevanion.py (after `apply_stats` is defined). Tests patch `aion2c.engine.simulator.apply_stats`.
"""
from dataclasses import replace

from aion2c.data.loader import allowed_skills
from aion2c.engine.damage import hit_damage_ex
from aion2c.models import (
    CastEvent,
    CharacterBuild,
    GameData,
    KeybindPlan,
    LiveState,
    Num,
    Priority,
    Scenario,
    SimConfig,
    SimResult,
    SkillKind,
    SkillTally,
    effective_rank,
)

_NEVER = (SkillKind.CHAIN, SkillKind.PROC, SkillKind.CHARGE_TIER, SkillKind.PASSIVE)
_CHILD_KINDS = (SkillKind.CHAIN, SkillKind.PROC)
_CONF = {"unknown": 0, "estimated": 1, "confirmed": 2}
_CONF_NAMES = ("unknown", "estimated", "confirmed")
_EPS = 1e-9
DEFAULT_STATUS_DURATION_S = 15.0  # estimated fallback when a status duration is unknown
MAX_DAEVANION_RANK_BONUS = 4  # PLAN 3b


class _Info:
    """Per-skill values read once per run (rank, cooldown, cost, lock, requires)."""

    __slots__ = ("skill", "rule", "rank", "cd_s", "cost", "anim_s", "requires", "has_dmg", "levels")


class _Sim:
    def __init__(self, gd, build, scenario, cfg, initial):
        self.gd, self.build, self.sc, self.cfg = gd, build, scenario, cfg
        self.stats = apply_stats(gd, build)
        self.D = round(scenario.duration_s * 1000)
        self.allowed = {s.key for s in allowed_skills(gd, build.region, build.show_kr)}
        self.warn: dict[str, None] = {}
        self.min_conf = 2
        self.infos: dict[str, _Info] = {}
        self.ready: dict[str, int] = {}
        self.exp: dict[str, int] = {}  # timed status key -> expiry ms
        self.covered: dict[str, float] = {}  # status key -> active ms inside [0, D)
        self.acc: dict[tuple, float] = {}
        self.chain: tuple | None = None  # (owner, tip_key, window_end_ms)
        self.dots: dict[str, list] = {}  # status key -> [skill_key, next_tick_ms, tick_ms, ratio, targets]
        self.casts: list[CastEvent] = []
        self.tally: dict[str, list] = {}
        self.total = 0.0
        self.rank_gt1 = False
        self.bonus = self._daevanion_bonus()
        self.passives = [(k, s) for k, s in gd.statuses.items() if s.mp_min_pct is not None]
        self.mp = self.stats.max_mp * (cfg.start_mp_pct / 100)
        self.mp_t = 0
        if initial is not None:
            for k, v in initial.cooldowns_s.items():
                self.ready[k] = round(v * 1000)
            for k, v in initial.statuses.items():
                if k in gd.statuses and v > 0:
                    self.exp[k] = round(v * 1000)
                    self._cover(k, 0, self.exp[k])
            if initial.mp is not None:
                self.mp = min(self.stats.max_mp, initial.mp)

    # ---- bookkeeping -------------------------------------------------------------------------
    def rd(self, num: Num, what: str, default: float) -> float:
        """Read a Num: track the weakest confidence, warn on unknown, fall back to default."""
        c = _CONF[num.confidence]
        if num.value is None:
            c = 0
        if c < self.min_conf:
            self.min_conf = c
        if c == 0:
            self.warn[f"unknown value: {what}"] = None
        return default if num.value is None else num.value

    def _conf(self, conf: str) -> None:
        self.min_conf = min(self.min_conf, _CONF[conf])

    def _cover(self, key: str, start: float, end: float) -> None:
        s, e = max(start, 0), min(end, self.D)
        if e > s:
            self.covered[key] = self.covered.get(key, 0.0) + (e - s)

    def _daevanion_bonus(self) -> dict[str, int]:
        out: dict[str, int] = {}
        if not self.build.daevanion_nodes:
            return out
        for board in self.gd.daevanion.values():
            if board.unlock_level > self.build.level:
                continue
            for nid in self.build.daevanion_nodes:
                node = board.nodes.get(nid)
                if node is not None and node.skill_key:
                    out[node.skill_key] = out.get(node.skill_key, 0) + 1
        return {k: min(v, MAX_DAEVANION_RANK_BONUS) for k, v in out.items()}

    def _unlocked(self, key: str) -> bool:
        sk = self.gd.skills.get(key)
        return (
            sk is not None
            and key in self.allowed
            and (sk.unlock_level is None or sk.unlock_level <= self.build.level)
            and (sk.kind != SkillKind.STIGMA or key in self.build.stigmas)
        )

    # ---- MP ----------------------------------------------------------------------------------
    def _mp_at(self, t: float) -> float:
        dt = max(0.0, t - self.mp_t)
        return min(self.stats.max_mp, self.mp + self.stats.mp_regen_per_s * dt / 1000)

    def _sync_mp(self, t: int) -> None:
        """Move the MP clock to t, integrating passive-status uptime over the elapsed span."""
        t0, end = self.mp_t, min(t, self.D)
        if end > t0 and self.passives:
            dt, m0, regen, mx = end - t0, self.mp, self.stats.mp_regen_per_s, self.stats.max_mp
            for key, st in self.passives:
                if st.source_skill is not None and not self._unlocked(st.source_skill):
                    continue
                thr = mx * st.mp_min_pct / 100 - _EPS
                if m0 >= thr:
                    above = dt
                elif regen <= 0 or thr > mx:
                    above = 0.0
                else:
                    above = max(0.0, dt - (thr - m0) / regen * 1000)
                if above > 0:
                    self.covered[key] = self.covered.get(key, 0.0) + above
        self.mp = self._mp_at(t)
        self.mp_t = t

    # ---- statuses ----------------------------------------------------------------------------
    def _active(self, key: str, st, t: float) -> bool:
        if st.mp_min_pct is not None:
            if st.source_skill is not None and not self._unlocked(st.source_skill):
                return False
            mx = self.stats.max_mp
            return mx > 0 and self._mp_at(t) / mx * 100 >= st.mp_min_pct - _EPS
        return t < self.exp.get(key, 0)

    def _active_key(self, key: str, t: float) -> bool:
        st = self.gd.statuses.get(key)
        return st is not None and self._active(key, st, t)

    def _mult(self, t: float, element: str) -> tuple[float, tuple[str, ...]]:
        m, act = 1.0, []
        for key, st in self.gd.statuses.items():
            if self._active(key, st, t):
                act.append(key)
                if not st.elements or element in st.elements:
                    m *= self.rd(st.dmg_mult, f"{key} damage multiplier", 1.0)
        return m, tuple(act)

    def _apply(self, key: str, ta: int, src: str) -> None:
        st = self.gd.statuses.get(key)
        if st is None:
            self.warn[f"unknown status referenced: {key}"] = None
            return
        dur = self.rd(st.duration_s, f"{key} duration", DEFAULT_STATUS_DURATION_S)
        old = self.exp.get(key, 0)
        new = max(old, ta + round(dur * 1000))
        self._cover(key, max(ta, old), new)
        self.exp[key] = new
        v = st.tick_ratio_pct.value
        sk = self.gd.skills[src]
        dotty = any(w in tg.lower() for tg in sk.tags for w in ("dot", "ground"))
        if v is None or (v == 0 and st.tick_ratio_pct.confidence == "unknown" and dotty):
            self.warn[f"unknown value: {src} tick damage ({key})"] = None
        elif v > 0:
            ratio = self.rd(st.tick_ratio_pct, f"{key} tick ratio", 0.0)
            tick = max(1, round(self.rd(st.tick_s, f"{key} tick interval", 1.0) * 1000))
            self.dots[key] = [src, ta + tick, tick, ratio, min(self.sc.n_targets, sk.aoe_targets)]

    def _consume(self, key: str, tc: int) -> None:
        e = self.exp.pop(key, None)
        self.dots.pop(key, None)
        if e is not None:
            lost = min(e, self.D) - max(tc, 0)
            if lost > 0:
                self.covered[key] = self.covered.get(key, 0.0) - lost

    # ---- skills ------------------------------------------------------------------------------
    def _info(self, key: str) -> _Info:
        i = self.infos.get(key)
        if i is not None:
            return i
        gd, sk = self.gd, self.gd.skills[key]
        i = _Info()
        i.skill, i.rule = sk, gd.rules.get(key)
        cap = min(len(sk.ranks), gd.rank_caps[self.build.region]["stigma" if sk.kind == SkillKind.STIGMA else "core"])
        i.rank = effective_rank(gd, self.build, sk)
        if cap >= 1 and self.bonus.get(key):
            i.rank = max(1, min(i.rank + self.bonus[key], cap))
        rd = sk.ranks[min(i.rank, len(sk.ranks)) - 1] if sk.ranks else None
        i.cd_s = self.rd(rd.cooldown_s, f"{key} cooldown", 0.0) if rd else 0.0
        i.cost = self.rd(rd.mp_cost, f"{key} mp cost", 0.0) if rd else 0.0
        i.anim_s = self.cfg.anim_overrides.get(key)
        if i.anim_s is None:
            i.anim_s = self.rd(sk.anim_lock_s, f"{key} animation lock", 1.0)
        i.requires = i.rule.requires if i.rule else ()
        i.levels = i.rule.charge_levels if i.rule else ()
        # A skill with no damage component at all (ratio 0/None and no flat) is a pure buff: its
        # damage Nums are not "read", so they do not drag confidence down.
        flats = [n.value for n in (rd.flat_min, rd.flat_max)] if rd else []
        i.has_dmg = bool(sk.atk_ratio_pct.value) or any(flats)
        if i.has_dmg:
            self.rd(sk.atk_ratio_pct, f"{key} atk ratio", 0.0)
            if rd is not None:
                self.rd(rd.flat_min, f"{key} flat damage min", 0.0)
                self.rd(rd.flat_max, f"{key} flat damage max", 0.0)
        if i.rule is not None:
            self._conf(i.rule.confidence)
        self.infos[key] = i
        return i

    def _resolve(self, t: int, owner, root: str, req: str | None) -> str | None:
        """Skill key this slot would cast at t (applying chain tip), or None if not castable."""
        ch = self.chain
        open_ = ch is not None and t < ch[2]
        key, tip = root, False
        if self.cfg.auto_chain and open_ and ch[0] == owner:
            key, tip = ch[1], True
        if not self._unlocked(key):
            return None
        sk = self.gd.skills[key]
        if sk.kind in _NEVER and not tip:
            if self.cfg.auto_chain or not (open_ and ch[1] == key and sk.kind in _CHILD_KINDS):
                return None
        if t < self.ready.get(key, 0):
            return None
        inf = self._info(key)
        if self._mp_at(t) < inf.cost - _EPS:
            return None
        for r in inf.requires:
            if not self._active_key(r, t):
                return None
        if req is not None and not self._active_key(req, t):
            return None
        return key

    def _tick_until(self, upto: int) -> None:
        for key, d in list(self.dots.items()):
            end = min(self.exp.get(key, 0), self.D)
            sk = self.gd.skills[d[0]]
            while d[1] < end and d[1] <= upto:
                m, _ = self._mult(d[1], sk.element)
                dmg, w = hit_damage_ex(
                    replace(sk, atk_ratio_pct=Num(d[3]), ranks=()), 1, self.stats, m, self.sc.boss
                )
                dmg *= d[4]
                self.total += dmg
                self.tally[d[0]][1] += dmg
                d[1] += d[2]

    def _chance(self, src, chance: float) -> bool:
        """Deterministic accumulator per (source, status) pair."""
        a = self.acc.get(src, 0.0) + chance
        hit = a >= 1 - _EPS
        self.acc[src] = a - 1 if hit else a
        return hit

    def _cast(self, t: int, key: str, owner, level_req: int, delay_ms: int) -> int:
        """Cast `key` starting at t. Returns the time of the next decision."""
        gd, st = self.gd, self.stats
        sk = gd.skills[key]
        inf = self._info(key)
        rule = inf.rule
        self._sync_mp(t)
        self.mp -= inf.cost
        if rule is not None and rule.mp_restore:
            self.mp = min(st.max_mp, self.mp + rule.mp_restore)
        if inf.rank > 1:
            self.rank_gt1 = True

        lvl, cl, charge_s = 0, None, 0.0
        if inf.levels:
            n = len(inf.levels)
            lvl = min(max(level_req if level_req > 0 else n, 1), n)
            cl = next((c for c in inf.levels if c.level == lvl), inf.levels[lvl - 1])
            charge_s = self.rd(cl.charge_s, f"{key} charge time L{lvl}", 0.0)
            self.rd(cl.dmg_mult, f"{key} charge multiplier L{lvl}", 1.0)

        lock_ms = max(1, round((inf.anim_s / (1 + st.combat_speed_pct / 100) + charge_s) * 1000))
        self.ready[key] = t + round(inf.cd_s * max(0.0, 1 - st.cdr_pct / 100) * 1000)
        ta = t + round(charge_s * 1000)

        self._tick_until(ta)
        mult, act = self._mult(ta, sk.element)
        dmg = 0.0
        if inf.has_dmg:
            dmg, warns = hit_damage_ex(sk, inf.rank, st, mult, self.sc.boss, cl, len(inf.levels) or 1)
            dmg *= min(self.sc.n_targets, sk.aoe_targets)
            for w in warns:
                self.warn[w] = None
        self.casts.append(CastEvent(t / 1000, key, lvl, dmg, self.mp, act))
        tl = self.tally.setdefault(key, [0, 0.0])
        tl[0] += 1
        tl[1] += dmg
        self.total += dmg

        if rule is not None:
            for s in rule.applies:
                if self._chance((key, s), rule.apply_chance):
                    self._apply(s, ta, key)
        for idx, tr in enumerate(gd.triggers):
            if tr.on_element == sk.element and self._unlocked(tr.source_skill):
                self._conf(tr.confidence)
                if self._chance(("trigger", idx), tr.chance):
                    self._apply(tr.status_key, ta, key)
        if rule is not None:
            for s in rule.consumes:
                self._consume(s, ta)
            if rule.chain_next:
                self.chain = (owner, rule.chain_next, t + lock_ms + round(rule.chain_window_s * 1000))
            else:
                self.chain = None
        else:
            self.chain = None
        return t + lock_ms + delay_ms

    # ---- drivers -----------------------------------------------------------------------------
    def run_priority(self, entries) -> None:
        t, tick = 0, max(1, self.cfg.tick_ms)
        while t < self.D:
            if self.chain is not None and t >= self.chain[2]:
                self.chain = None
            for i, e in enumerate(entries):
                key = self._resolve(t, i, e.skill_key, e.require_status)
                if key is not None:
                    t = self._cast(t, key, i, e.charge_level, 0)
                    break
            else:
                t += tick

    def run_macro(self, macro, stacks: dict) -> None:
        t, tick, ptr, n = 0, max(1, self.cfg.tick_ms), 0, len(macro.entries)
        while t < self.D:
            if self.chain is not None and t >= self.chain[2]:
                self.chain = None
            fired = None
            for j in range(n):
                idx = (ptr + j) % n
                entry = macro.entries[idx]
                stack = stacks.get(entry.key_label)
                for root in stack or ():
                    key = self._resolve(t, root, root, None)
                    if key is not None:
                        fired = (idx, key, root, entry)
                        break
                if fired:
                    break
            if fired is None:
                t += tick
                continue
            idx, key, root, entry = fired
            ptr = (idx + 1) % n
            t = self._cast(t, key, root, 0, entry.delay_ms)

    def finish(self) -> SimResult:
        self._sync_mp(self.D)
        self._tick_until(self.D)
        if self.rank_gt1:
            self.warn["ranking assumed, unverified at rank > 1"] = None
        dur = self.sc.duration_s
        uptime = {k: v / self.D for k, v in self.covered.items() if v > 0 and self.D > 0}
        return SimResult(
            total_damage=self.total,
            dps=self.total / dur if dur > 0 else 0.0,
            duration_s=dur,
            casts=tuple(self.casts),
            per_skill={k: SkillTally(v[0], v[1]) for k, v in self.tally.items()},
            status_uptime=uptime,
            warnings=tuple(self.warn),
            confidence=_CONF_NAMES[self.min_conf],
        )


def simulate(
    gd: GameData,
    build: CharacterBuild,
    priority: Priority,
    scenario: Scenario,
    cfg: SimConfig = SimConfig(),
    initial: LiveState | None = None,
) -> SimResult:
    sim = _Sim(gd, build, scenario, cfg, initial)
    sim.run_priority(priority.entries)
    return sim.finish()


def simulate_macro(
    gd: GameData,
    build: CharacterBuild,
    plan: KeybindPlan,
    macro_name: str,
    scenario: Scenario,
    cfg: SimConfig = SimConfig(),
) -> SimResult:
    """In-game macro: entries run IN ORDER from a wrapping pointer; a slot fires its first usable skill."""
    macro = next((m for m in plan.macros if m.name == macro_name), None)
    if macro is None:
        raise ValueError(f"no macro named {macro_name!r} in plan")
    sim = _Sim(gd, build, scenario, cfg, None)
    sim.run_macro(macro, {s.key_label: s.stack for s in plan.stacks})
    return sim.finish()


from aion2c.daevanion import apply_stats  # noqa: E402,F401  (bottom on purpose, see docstring)
