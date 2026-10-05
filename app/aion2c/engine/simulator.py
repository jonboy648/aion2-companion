"""Fight simulator (PLAN section 3 P2 + 3b engine rule). P2 owns the body.

CIRCULAR IMPORT RULE: aion2c.daevanion imports `simulate` from here and this module needs
`apply_stats` from there. Keep the `apply_stats` import at the BOTTOM of this file (after
`simulate`/`simulate_macro` are defined) and keep daevanion's `simulate` import at the bottom of
daevanion.py (after `apply_stats` is defined). Tests patch `aion2c.engine.simulator.apply_stats`.

Mechanics added on top of PLAN section 3 (see tests/test_mechanics_core.py):
  specialties  CharacterBuild.specs -> SpecEffect (cooldown, speed, damage, hits, statuses, resets ...)
  crit procs   StatusTrigger event "crit": expected-value accumulator over hits x effective crit chance;
               proc_skill fires for free (own cooldown), reset_skill resets a cooldown, status opens a window
  stat mods    Status.stat_mods change the LIVE stats (combat speed, CDR, crit, attack, damage boost)
  auras        duration 0 = permanent: active from the first cast (passive skills: always), never re-cast
  stagger      tag stagger_only / hp_dmg_coeff scale HP damage; tag needs_stagger gates on a "staggered" status
  stigma gate  a skill sharing a name with a stigma needs that stigma (hidden duplicates, e.g. Ranger)
"""
from dataclasses import replace

from aion2c.data.loader import allowed_skills
from aion2c.engine.damage import crit_chance_frac, hit_damage_ex, hp_damage_coeff
from aion2c.models import (
    CastEvent,
    CharacterBuild,
    GameData,
    KeybindPlan,
    LiveState,
    Num,
    Priority,
    RankData,
    Scenario,
    SimConfig,
    SimResult,
    SkillKind,
    SkillTally,
    cooldown_scale,
    total_rank,
)
from aion2c.specs import active_options

_NEVER = (SkillKind.CHAIN, SkillKind.PROC, SkillKind.CHARGE_TIER, SkillKind.PASSIVE)
_CHILD_KINDS = (SkillKind.CHAIN, SkillKind.PROC)
_CONF = {"unknown": 0, "estimated": 1, "confirmed": 2}
_CONF_NAMES = ("unknown", "estimated", "confirmed")
_EPS = 1e-9
_FOREVER = 1 << 60
DEFAULT_STATUS_DURATION_S = 15.0  # estimated fallback when a status duration is unknown
_ALWAYS_ON_KINDS = (SkillKind.PASSIVE, SkillKind.SYSTEM)
_NO_EFFECT_KINDS = ("mobile", "ignore_block", "no_dps")


def stigma_gates(gd: GameData) -> dict[str, str]:
    """skill key -> stigma key it needs equipped. A stigma needs itself. A non-stigma skill sharing a stigma's
    name is the hidden pre-redesign duplicate (Ranger explosive-arrow 14230000 next to stigma
    explosive-arrow-14360000): it is gated on "" - nothing equips that, so it is never castable."""
    by_name = {s.name: k for k, s in gd.skills.items() if s.kind == SkillKind.STIGMA}
    return {k: (k if s.kind == SkillKind.STIGMA else "") for k, s in gd.skills.items()
            if s.kind == SkillKind.STIGMA or s.name in by_name}


def window_castable(gd: GameData, key: str) -> bool:
    """A PROC skill the player can cast while its trigger window is open: its rule `requires` a status that a
    StatusTrigger with window_s > 0 opens (event crit / cast / status)."""
    rule = gd.rules.get(key)
    if rule is None or not rule.requires:
        return False
    wins = {t.status_key for t in gd.triggers if t.window_s > 0 and t.status_key}
    return any(r in wins for r in rule.requires)


def stigma_gate(gd: GameData, key: str) -> str | None:
    return stigma_gates(gd).get(key)


class _Spec:
    """Specialty numbers for one skill, aggregated over every chosen option (own and other skills')."""

    __slots__ = ("cd_add", "cd_mult", "speed", "anim_add", "dmg", "extra_hits", "mp_mult", "remove_cd", "aoe_add",
                 "charge_mult", "force_crit", "crit_add", "dur_add", "charges")

    def __init__(self):
        self.cd_add, self.cd_mult, self.speed, self.anim_add = 0.0, 1.0, 0.0, 0.0
        self.dmg: list = []  # (multiplier, cond, requires_status)
        self.extra_hits, self.mp_mult, self.aoe_add, self.charge_mult = 0.0, 1.0, 0, 1.0
        self.remove_cd: list = []  # requires_status per removes_cooldown effect
        self.force_crit, self.crit_add, self.dur_add, self.charges = False, 0.0, 0.0, 0


class _Info:
    """Per-skill values read once per run (rank, cooldown, cost, lock, requires)."""

    __slots__ = ("skill", "rule", "rank", "cd_s", "cost", "anim_s", "requires", "has_dmg", "levels", "spec", "coeff")


class _Sim:
    def __init__(self, gd, build, scenario, cfg, initial):
        gd = rank_valued(gd, build)  # buff durations/magnitudes at the build's own skill ranks
        self.gd, self.build, self.sc, self.cfg = gd, build, scenario, cfg
        self.stats = apply_stats(gd, build)
        self.D = round(scenario.duration_s * 1000)
        self._unl: dict[str, bool] = {}
        self._ranks: dict[str, int] = {}
        self.allowed = {s.key for s in allowed_skills(gd, build.region, build.show_kr)}
        self.warn: dict[str, None] = {}
        self.min_conf = 2
        self.infos: dict[str, _Info] = {}
        self.ready: dict[str, int] = {}
        self.exp: dict[str, int] = {}  # timed status key -> expiry ms (_FOREVER for permanent auras)
        self.covered: dict[str, float] = {}  # status key -> active ms inside [0, D)
        self.acc: dict[tuple, float] = {}
        self.chain: tuple | None = None  # (owner, tip_key, window_end_ms)
        self.dots: dict[str, list] = {}  # status key -> [skill_key, next_tick_ms, tick_ms, ratio, targets, flat]
        self.casts: list[CastEvent] = []
        self.tally: dict[str, list] = {}
        self.total = 0.0
        self.rank_gt1 = False
        self.passives = [(k, s) for k, s in gd.statuses.items() if s.mp_min_pct is not None]
        self.modded = [(k, s) for k, s in gd.statuses.items() if s.stat_mods]
        self.permanent = {k for k, s in gd.statuses.items() if s.mp_min_pct is None and self._is_permanent(s)}
        self.gate = stigma_gates(gd)
        self._mp_gated = tuple(k for k, _ in self.passives)
        self._modded_d = dict(self.modded)
        self._modded_always = tuple(k for k in self._modded_d if k in self._mp_gated)
        self._status_order = {k: i for i, k in enumerate(gd.statuses)}
        self._live_cache: dict[tuple, object] = {}
        self._depth = 0
        self.stagger_tag = "needs_stagger"
        self.triggers_by_event = {
            ev: [(i, tr) for i, tr in enumerate(gd.triggers) if tr.event == ev] for ev in ("cast", "crit", "status")
        }
        self.agg: dict[str, _Spec] = {}
        self.spec_on: set[tuple[str, int]] = set()  # (owner, option) pairs that are chosen and unlocked
        self.cast_fx: dict[str, list] = {}  # firing skill key -> [(owner, SpecEffect)] for trigger "cast"
        self.crit_fx: list = []  # (owner, SpecEffect) for trigger "crit"
        self._build_specs()
        self.mp = self.stats.max_mp * (cfg.start_mp_pct / 100)
        self.mp_t = 0
        self.always_on = {
            k for k in self.permanent
            if (s := gd.statuses[k]).source_skill in gd.skills
            and gd.skills[s.source_skill].kind in _ALWAYS_ON_KINDS and self._unlocked(s.source_skill)
        }
        self._modded_always += tuple(k for k in self._modded_d if k in self.always_on)
        if initial is not None:
            for k, v in initial.cooldowns_s.items():
                self.ready[k] = round(v * 1000)
            for k, v in initial.statuses.items():
                if k in gd.statuses and v > 0:
                    self.exp[k] = round(v * 1000)
                    self._cover(k, 0, self.exp[k])
            if initial.mp is not None:
                self.mp = min(self.stats.max_mp, initial.mp)

    @staticmethod
    def _is_permanent(st) -> bool:
        return st.permanent or (st.duration_s.value is not None and st.duration_s.value == 0.0)

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

    def _unlocked(self, key: str) -> bool:
        hit = self._unl.get(key)
        if hit is None:
            hit = self._unl[key] = self._unlocked_calc(key)
        return hit and self._spec_gate_ok(key)

    def _spec_gate_ok(self, key: str) -> bool:
        """A skill granted by a specialty (SkillRule.requires_spec) exists only while that option is on."""
        rule = self.gd.rules.get(key)
        return rule is None or rule.requires_spec is None or tuple(rule.requires_spec) in self.spec_on

    def _unlocked_calc(self, key: str) -> bool:
        sk = self.gd.skills.get(key)
        if sk is None or key not in self.allowed:
            return False
        if sk.unlock_level is not None and sk.unlock_level > self.build.level:
            return False
        g = self.gate.get(key)
        return g is None or g in self.build.stigmas

    def _rank(self, key: str) -> int:
        r = self._ranks.get(key)
        if r is None:
            r = self._ranks[key] = total_rank(self.gd, self.build, self.gd.skills[key])
        return r

    # ---- specialties -------------------------------------------------------------------------
    def _build_specs(self) -> None:
        """Aggregate every chosen, available specialty option into per-skill numbers."""
        gd = self.gd
        for owner, _chosen in self.build.specs.items():
            sk = gd.skills.get(owner)
            if sk is None or not self._unlocked(owner):
                continue
            opts, why = active_options(gd, self.build, sk, self._rank(owner))
            for w in why:
                self.warn[w] = None
            for i in opts:
                self.spec_on.add((owner, i))
                sp = sk.specializations[i]
                for e in sp.effects:
                    self._add_effect(owner, i, sp.text, e)
                if not sp.effects:
                    self.warn[f"specialty not parsed: {sk.name} option {i + 1} ({sp.text})"] = None

    def _spec(self, key: str) -> _Spec:
        return self.agg.setdefault(key, _Spec())

    def _add_effect(self, owner: str, i: int, text: str, e) -> None:
        name = self.gd.skills[owner].name
        k = e.kind
        if k in _NO_EFFECT_KINDS:
            return
        if k == "unknown" or (e.value.value is None and k not in ("adds_status", "reset_skill", "removes_cooldown", "force_crit")):
            self.warn[f"specialty not modelled: {name} option {i + 1} ({text})"] = None
            self._conf("unknown")
            return
        if e.cond == "unmodeled":
            self.warn[f"specialty condition not modelled: {name} option {i + 1} ({text})"] = None
            return
        self._conf(e.value.confidence)
        if e.trigger == "kill":
            return
        v = e.value.value
        if k in ("cdr_all_s", "cdr_skill_s", "reset_skill", "resource_restore", "adds_status"):
            if e.trigger == "crit":
                self.crit_fx.append((owner, i, e))
            else:
                self.cast_fx.setdefault(e.on_skill or owner, []).append((owner, i, e))
            return
        target = e.skill_key or owner
        a = self._spec(target)
        if k == "cooldown_add_s":
            a.cd_add += v
        elif k == "cooldown_mult":
            a.cd_mult *= v
        elif k == "cast_speed_pct":
            a.speed += v
        elif k == "anim_add_s":
            a.anim_add += v
        elif k == "dmg_mult":
            a.dmg.append((v, e.cond, e.requires_status))
        elif k == "extra_hits":
            a.extra_hits += v
        elif k == "mp_cost_mult":
            a.mp_mult *= v
        elif k == "removes_cooldown":
            a.remove_cd.append(e.requires_status)
        elif k == "aoe_targets_add":
            a.aoe_add += int(v)
        elif k == "charge":
            a.charge_mult *= v
        elif k == "force_crit":
            a.force_crit = True
        elif k == "crit_chance_add":
            a.crit_add += v
        elif k == "duration_add_s":
            a.dur_add += v
        elif k == "charges":
            a.charges += int(v)

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
        if key in self.always_on:
            return True
        return t < self.exp.get(key, 0)

    def _active_key(self, key: str, t: float) -> bool:
        st = self.gd.statuses.get(key)
        return st is not None and self._active(key, st, t)

    def _mult(self, t: float, element: str) -> tuple[float, tuple[str, ...]]:
        m, act = 1.0, []
        sts = self.gd.statuses
        # only MP-gated passives, always-on auras and statuses with a live expiry can be active: skip the rest
        cand = {k for k, v in self.exp.items() if v > t and k in sts}
        cand.update(self._mp_gated)
        cand.update(self.always_on)
        for key in sorted(cand, key=self._status_order.__getitem__):
            st = sts[key]
            if self._active(key, st, t):
                act.append(key)
                if not st.elements or element in st.elements:
                    m *= self.rd(st.dmg_mult, f"{key} damage multiplier", 1.0)
        return m, tuple(act)

    def _stats_at(self, t: float):
        """build stats plus the stat mods of every status active at t (combat speed, CDR, crit, attack ...)."""
        if not self.modded:
            return self.stats
        exp, md = self.exp, self._modded_d
        cand = {k for k, v in exp.items() if v > t and k in md}
        cand.update(self._modded_always)
        act = tuple(k for k in sorted(cand, key=self._status_order.__getitem__) if self._active(k, md[k], t))
        if not act:
            return self.stats
        hit = self._live_cache.get(act)
        if hit is None:
            add: dict[str, float] = {}
            for k in act:
                for m in self.gd.statuses[k].stat_mods:
                    add[m.stat] = add.get(m.stat, 0.0) + self.rd(m.value, f"{k} {m.stat}", 0.0)
            hit = replace(self.stats, **{f: getattr(self.stats, f) + v for f, v in add.items()})
            self._live_cache[act] = hit
        return hit

    def _req_ok(self, req: str | None, owner: str, t: float) -> bool:
        if req is None:
            return True
        if req == "@own":
            rule = self.gd.rules.get(owner)
            return bool(rule) and any(self._active_key(a, t) for a in rule.applies)
        return self._active_key(req, t)

    def _apply(self, key: str, ta: int, src: str, dur_s: float | None = None) -> None:
        st = self.gd.statuses.get(key)
        if st is None:
            self.warn[f"unknown status referenced: {key}"] = None
            return
        old = self.exp.get(key, 0)
        if key in self.permanent and dur_s is None:
            if old >= _FOREVER:
                return  # an aura that is already up
            new = _FOREVER
        else:
            dur = dur_s if dur_s is not None else self.rd(st.duration_s, f"{key} duration", DEFAULT_STATUS_DURATION_S)
            dur += self.agg[src].dur_add if src in self.agg else 0.0
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
            flat = 0.0
            if st.tick_flat_ranks:
                tf = st.tick_flat_ranks[max(1, min(self._info(src).rank, len(st.tick_flat_ranks))) - 1]
                flat = self.rd(tf, f"{key} tick flat damage", 0.0)
            self.dots[key] = [src, ta + tick, tick, ratio, min(self.sc.n_targets, sk.aoe_targets), flat]
        for idx, tr in self.triggers_by_event["status"]:
            if tr.on_status == key and self._unlocked(tr.source_skill) and self._depth < 3 and self._trigger_ok(tr, ta):
                self._conf(tr.confidence)
                if self._chance(("trigger", idx), tr.chance):
                    self._fire_trigger(tr, ta, src)

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
        i.rank = self._rank(key)
        sp = self.agg.get(key)
        i.spec = sp
        rd = sk.ranks[min(i.rank, len(sk.ranks)) - 1] if sk.ranks else None
        i.cd_s = self.rd(rd.cooldown_s, f"{key} cooldown", 0.0) if rd else 0.0
        i.cost = self.rd(rd.mp_cost, f"{key} mp cost", 0.0) if rd else 0.0
        i.anim_s = self.cfg.anim_overrides.get(key)
        if i.anim_s is None:
            i.anim_s = self.rd(sk.anim_lock_s, f"{key} animation lock", 1.0)
        if sp is not None:
            i.cd_s = max(0.0, (i.cd_s + sp.cd_add) * sp.cd_mult)
            i.cost *= sp.mp_mult
            i.anim_s = max(0.05, i.anim_s + sp.anim_add)
        i.requires = i.rule.requires if i.rule else ()
        i.levels = i.rule.charge_levels if i.rule else ()
        i.coeff = hp_damage_coeff(sk)
        # A skill with no damage component at all (ratio 0/None and no flat) is a pure buff: its
        # damage Nums are not "read", so they do not drag confidence down. Stagger-only skills deal no HP
        # damage either.
        flats = [n.value for n in (rd.flat_min, rd.flat_max)] if rd else []
        i.has_dmg = (bool(sk.atk_ratio_pct.value) or any(flats)) and i.coeff > 0
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
        if t < self.ready.get(key, 0):
            return None  # cheapest rejection first; every early exit below is also None
        if not self._unlocked(key):
            return None
        sk = self.gd.skills[key]
        rule = self.gd.rules.get(key)
        # a PROC skill with a trigger window (rule.requires) is castable while that window is open
        window = sk.kind == SkillKind.PROC and window_castable(self.gd, key)
        if sk.kind in _NEVER and not tip and not window:
            if self.cfg.auto_chain or not (open_ and ch[1] == key and sk.kind in _CHILD_KINDS):
                return None
        if self.stagger_tag in sk.tags and not self._active_key("staggered", t):
            return None  # usable only on a Staggered target; no stagger window is modelled
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
        if (not inf.has_dmg and rule is not None and rule.applies and not rule.mp_restore and not rule.chain_next
                and all(a in self.permanent and t < self.exp.get(a, 0) for a in rule.applies)):
            return None  # an aura/toggle that is already on is not re-cast
        return key

    def _tick_until(self, upto: int) -> None:
        for key, d in list(self.dots.items()):
            end = min(self.exp.get(key, 0), self.D)
            sk = self.gd.skills[d[0]]
            while d[1] < end and d[1] <= upto:
                m, _ = self._mult(d[1], sk.element)
                tick_sk = replace(sk, atk_ratio_pct=Num(d[3]), ranks=(), hits=1)
                if d[5]:  # flat part of the tick, one fixed number whatever the rank
                    tick_sk = replace(tick_sk, ranks=(RankData(1, Num(d[5]), Num(d[5]), Num(0.0), Num(0.0)),))
                dmg, w = hit_damage_ex(tick_sk, 1, self._stats_at(d[1]), m, self.sc.boss)
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

    # ---- damage, triggers, specialty effects -------------------------------------------------
    def _spec_mult(self, sk, sp, key: str, ta: int, n_hit: int) -> float:
        m = 1.0 + sp.extra_hits / max(1, sk.hits)
        aoe = sk.aoe_targets + sp.aoe_add
        for v, cond, req in sp.dmg:
            if not self._req_ok(req, key, ta):
                continue
            f = 1.0
            if cond == "more_targets":
                f = (n_hit - 1) / (aoe - 1) if aoe > 1 else 0.0
            elif cond == "less_targets":
                f = (aoe - n_hit) / (aoe - 1) if aoe > 1 else 1.0
            m *= 1 + (v - 1) * f
        return m

    def _dmg(self, key: str, inf: _Info, ta: int, cl, n_levels: int) -> tuple[float, tuple[str, ...]]:
        """Damage of one cast (all targets) landing at ta, plus the statuses active then."""
        sk, sp = inf.skill, inf.spec
        st = self._stats_at(ta)
        if sp is not None and sp.crit_add:
            st = replace(st, crit_chance_pct=st.crit_chance_pct + sp.crit_add)
        mult, act = self._mult(ta, sk.element)
        dmg = 0.0
        if inf.has_dmg:
            dmg, warns = hit_damage_ex(sk, inf.rank, st, mult, self.sc.boss, cl, n_levels,
                                       bool(sp and sp.force_crit))
            n_hit = min(self.sc.n_targets, sk.aoe_targets + (sp.aoe_add if sp else 0))
            dmg *= n_hit * inf.coeff
            if sp is not None:
                dmg *= self._spec_mult(sk, sp, key, ta, n_hit)
            for w in warns:
                self.warn[w] = None
        return dmg, act

    def _run_effect(self, owner: str, i: int, e, ta: int) -> None:
        v = e.value.value
        k = e.kind
        if k == "adds_status":
            if self._chance(("specfx", owner, i, e.status_key), e.chance):
                self._apply(e.status_key, ta, owner)
            return
        if e.requires_status is not None and not self._req_ok(e.requires_status, owner, ta):
            return
        if not self._chance(("specfx", owner, i, k, e.skill_key), e.chance):
            return
        if k == "cdr_all_s":
            ms = round(v * 1000)
            for kk, r in self.ready.items():
                if r > ta:
                    self.ready[kk] = max(ta, r - ms)
        elif k == "cdr_skill_s":
            r = self.ready.get(e.skill_key, 0)
            if r > ta:
                self.ready[e.skill_key] = max(ta, r - round(v * 1000))
        elif k == "reset_skill":
            self.ready[e.skill_key] = 0
        elif k == "resource_restore":
            rule = self.gd.rules.get(owner)
            amt = (rule.mp_restore if rule else 0.0) * v / 100 if e.cond == "pct" else v
            self.mp = min(self.stats.max_mp, self.mp + amt)

    def _trigger_ok(self, tr, ta: int) -> bool:
        """A trigger with `requires_status` (target debuff or self buff) only fires while that status is up."""
        return tr.requires_status is None or self._active_key(tr.requires_status, ta)

    def _fire_trigger(self, tr, ta: int, src: str) -> None:
        """A StatusTrigger fired: open its status window, reset a cooldown, fire its proc skill."""
        self._depth += 1
        try:
            if tr.status_key:
                self._apply(tr.status_key, ta, src, tr.window_s if tr.window_s > 0 else None)
            if tr.reset_skill:
                self.ready[tr.reset_skill] = 0
            if tr.proc_skill:
                self._fire_proc(tr.proc_skill, ta)
        finally:
            self._depth -= 1

    def _fire_proc(self, key: str, ta: int) -> None:
        """A PROC skill fires on its own (no lock, no MP cost): damage + MP restore, own cooldown applies."""
        if key not in self.gd.skills or not self._unlocked(key) or ta < self.ready.get(key, 0):
            return
        inf = self._info(key)
        st = self._stats_at(ta)
        self.ready[key] = ta + round(inf.cd_s * cooldown_scale(st.cdr_pct) * 1000)
        dmg, _act = self._dmg(key, inf, ta, None, 1)
        tl = self.tally.setdefault(key, [0, 0.0])
        tl[0] += 1
        tl[1] += dmg
        self.total += dmg
        if inf.rule is not None and inf.rule.mp_restore:
            self.mp = min(self.stats.max_mp, self.mp + inf.rule.mp_restore)
            self._conf(inf.rule.confidence)
        # a proc owner's own specialties still run: on-hit effects (adds_status, cdr, resets) and per-crit effects
        # (e.g. Heart Gore "resets its cooldown on landing a Critical Hit"); a proc cannot re-trigger itself.
        for o, i, e in self.cast_fx.get(key, ()):
            if self._unlocked(o):
                self._run_effect(o, i, e, ta)
        self._crit_events(key, inf, ta)

    def _crit_events(self, key: str, inf: _Info, ta: int) -> None:
        """Expected crit events of one cast (hits x effective crit chance) drive crit triggers/specialties."""
        if not (self.triggers_by_event["crit"] or self.crit_fx):
            return
        is_proc = inf.skill.kind == SkillKind.PROC  # a proc skill's own hits never feed crit TRIGGERS (no loops)
        sk, sp = inf.skill, inf.spec
        st = self._stats_at(ta)
        if sp is not None and sp.crit_add:
            st = replace(st, crit_chance_pct=st.crit_chance_pct + sp.crit_add)
        ev = (max(1, sk.hits) + (sp.extra_hits if sp else 0.0)) * crit_chance_frac(st, bool(sp and sp.force_crit))
        if ev <= 0:
            return
        for idx, tr in (() if is_proc else self.triggers_by_event["crit"]):
            if (tr.on_skills and key not in tr.on_skills) or (tr.on_element != "none" and tr.on_element != sk.element):
                continue
            if not self._unlocked(tr.source_skill) or not self._trigger_ok(tr, ta):
                continue
            self._conf(tr.confidence)
            a = self.acc.get(("crit", idx), 0.0) + ev * tr.chance
            while a >= 1 - _EPS:
                a -= 1
                self._fire_trigger(tr, ta, key)
            self.acc[("crit", idx)] = a
        for owner, i, e in self.crit_fx:
            if owner != key:
                continue
            a = self.acc.get(("critfx", owner, i, e.kind), 0.0) + ev * e.chance
            while a >= 1 - _EPS:
                a -= 1
                self._run_effect(owner, i, replace(e, chance=1.0), ta)
            self.acc[("critfx", owner, i, e.kind)] = a

    def _cast(self, t: int, key: str, owner, level_req: int, delay_ms: int) -> int:
        """Cast `key` starting at t. Returns the time of the next decision."""
        gd = self.gd
        sk = gd.skills[key]
        inf = self._info(key)
        rule, sp = inf.rule, inf.spec
        self._sync_mp(t)
        self.mp -= inf.cost
        if rule is not None and rule.mp_restore:
            self.mp = min(self.stats.max_mp, self.mp + rule.mp_restore)
        if inf.rank > 1:
            self.rank_gt1 = True

        lvl, cl, charge_s = 0, None, 0.0
        if inf.levels:
            n = len(inf.levels)
            lvl = min(max(level_req if level_req > 0 else n, 1), n)
            cl = next((c for c in inf.levels if c.level == lvl), inf.levels[lvl - 1])
            charge_s = self.rd(cl.charge_s, f"{key} charge time L{lvl}", 0.0)
            self.rd(cl.dmg_mult, f"{key} charge multiplier L{lvl}", 1.0)
            if sp is not None:
                charge_s *= sp.charge_mult

        st0 = self._stats_at(t)
        speed = 1 + (sp.speed / 100 if sp is not None else 0.0)
        lock_ms = max(1, round((inf.anim_s / (1 + st0.combat_speed_pct / 100) + charge_s) / speed * 1000))
        cd_s = inf.cd_s
        if sp is not None and any(self._req_ok(r, key, t) for r in sp.remove_cd):
            cd_s = 0.0
        if sp is not None and sp.charges:
            used = self.acc.get(("uses", key), 0.0) + 1
            if used <= sp.charges:
                cd_s, self.acc[("uses", key)] = 0.0, used
            else:
                self.acc[("uses", key)] = 0.0
        self.ready[key] = t + round(cd_s * cooldown_scale(st0.cdr_pct) * 1000)
        ta = t + round(charge_s / speed * 1000)

        self._tick_until(ta)
        dmg, act = self._dmg(key, inf, ta, cl, len(inf.levels) or 1)
        self.casts.append(CastEvent(t / 1000, key, lvl, dmg, self.mp, act))
        tl = self.tally.setdefault(key, [0, 0.0])
        tl[0] += 1
        tl[1] += dmg
        self.total += dmg

        if rule is not None:
            for s in rule.applies:
                if self._chance((key, s), rule.apply_chance):
                    self._apply(s, ta, key)
        for idx, tr in self.triggers_by_event["cast"]:
            hit = key in tr.on_skills if tr.on_skills else tr.on_element == sk.element
            if hit and self._unlocked(tr.source_skill) and self._trigger_ok(tr, ta):
                self._conf(tr.confidence)
                if self._chance(("trigger", idx), tr.chance):
                    self._fire_trigger(tr, ta, key)
        for o, i, e in self.cast_fx.get(key, ()):
            if self._unlocked(o):
                self._run_effect(o, i, e, ta)
        self._crit_events(key, inf, ta)
        if rule is not None:
            for s in rule.consumes:
                self._consume(s, ta)
            # a follow-up the player cannot cast (Korea-only, locked) is not a chain: do not block the root on it
            if rule.chain_next and self._unlocked(rule.chain_next):
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

    def run_macro(self, macro, stacks: dict, hand: tuple[str, ...] = ()) -> None:
        t, tick, ptr, n = 0, max(1, self.cfg.tick_ms), 0, len(macro.entries)
        while t < self.D:
            if self.chain is not None and t >= self.chain[2]:
                self.chain = None
            # skills pressed by hand (manual list): the player taps each the moment it is ready
            hk = next((k for k in hand if self._resolve(t, k, k, None) is not None), None)
            if hk is not None:
                t = self._cast(t, hk, hk, 0, 0)
                continue
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
        for k in self.always_on:  # passive auras: up for the whole fight, no cast needed
            self.covered[k] = float(self.D)
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
    hand: tuple[str, ...] = (),
) -> SimResult:
    """In-game macro: entries run IN ORDER from a wrapping pointer; a slot fires its first usable skill.
    `hand` = skill keys the player presses by hand on top of the held macro (hybrid setup)."""
    macro = next((m for m in plan.macros if m.name == macro_name), None)
    if macro is None:
        raise ValueError(f"no macro named {macro_name!r} in plan")
    sim = _Sim(gd, build, scenario, cfg, None)
    sim.run_macro(macro, {s.key_label: s.stack for s in plan.stacks}, tuple(hand))
    return sim.finish()


from aion2c.engine.rank_values import rank_valued  # noqa: E402
from aion2c.daevanion import apply_stats  # noqa: E402,F401  (bottom on purpose, see docstring)
