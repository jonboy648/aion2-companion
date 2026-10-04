"""Specialty text -> structured SpecEffect (generic parser) plus the load/build-time `finalize_gamedata`.

Source priority for every value: datamine text first (this parser reads the research `specializations[].text`),
class overrides second (research/classes/<key>/mechanics.json "specialization_effects", and for the Sorcerer
aion2c/data/src/mechanics.json). Text the parser cannot turn into numbers becomes kind "unknown": the simulator
warns when such a specialty is chosen, so nothing is silently dropped.
"""
import re
from dataclasses import replace

from aion2c.models import (
    STATUS_STAT_FIELDS, GameData, Num, SkillKind, SpecEffect, StatMod, Status,
)

TEXT_SRC = "specialty text from the client dump (research skills specializations[])"
OVERRIDE_SRC = "mechanics.json specialization_effects override"
_N = r"(\d+(?:\.\d+)?)"
_REF = r"\[([^\]]+)\]"
STAGGER_RE = re.compile(r"afflicted with Stagger|Stagger(?:ed)? target", re.I)
_ELEMENT_RE = re.compile(r"\b(Fire|Water|Earth)\b")
# stat phrase (as written after "+N%") -> Stats field, for timed self buffs
_STAT_WORDS = (
    (r"Critical Damage Boost", "crit_dmg_pct"),
    (r"Attack", "attack_increase_pct"),
    (r"PvE Damage Boost", "dmg_boost_pct"),
    (r"Combat Speed", "combat_speed_pct"),
)
# categories with no damage-race effect against a training dummy (CC, healing, defence, mobility ...)
_NO_DPS = re.compile(
    r"Stun|Root|Slow|Knock|Seal|Frost|Freeze|Airborne|Blind|Fear|Pull|Taunt|Shield|Heal|HP|Absorb|Tolerance|"
    r"Resist|Defense|Evasion|Block|Parry|Accuracy|Stamina|Move Speed|Immun|Remove|Cleans|Polymorph|Shrink|Stealth|"
    r"Tenacity|Invincible|Regen|Debilitate|Chain Skill|Stagger Gauge|MP damage|Enmity|rotate|Corrode|Curse|Bleed|"
    r"Restore|Revive|Reflect|Mark|Debuff|buff|PvP|Elemental Resist|Natural|Max MP|Rotates|Predation|Proxy|Aura|"
    r"^\+\d+(?:\.\d+)?m|wall width|range",
    re.I,
)


def _n(v: float, conf: str, note: str = "") -> Num:
    return Num(float(v), conf, f"{TEXT_SRC}{'; ' + note if note else ''}")


def _norm_name(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


class _Ctx:
    """What a text needs from its skill: own key, own name, name -> key table, own buff duration."""

    def __init__(self, key: str, name: str, idx: int, names: dict[str, str], own_dur: Num | None):
        self.key, self.name, self.idx, self.names, self.own_dur = key, name, idx, names, own_dur
        self.statuses: dict[str, Status] = {}

    def skill(self, ref: str) -> str | None:
        return self.names.get(_norm_name(ref))

    def is_self(self, ref: str) -> bool:
        return _norm_name(ref) == _norm_name(self.name) or self.skill(ref) == self.key

    def new_status(self, tag: str, dur: Num, mods: tuple[StatMod, ...] = (), on: str = "self",
                   tick: bool = False, elements=frozenset()) -> str:
        key = f"spec_{self.key}_{self.idx}_{tag}"
        self.statuses[key] = Status(
            key=key, name=f"{self.name} specialty {self.idx + 1}", on=on, duration_s=dur,
            dmg_mult=Num(1.0, "confirmed", "specialty status: damage effect carried by stat_mods/ticks"),
            elements=elements, source_skill=self.key, stat_mods=mods,
            tick_ratio_pct=Num(None, "unknown", "DoT tick damage is not in the specialty text") if tick
            else Num(0.0, "confirmed", "no damage tick"),
            tick_s=Num(1.0, "estimated", "assumed 1 s tick (not in the text)") if tick else Num(1.0, "unknown", ""))
        return key


def _timed_buff(body: str, dur_s: str | None, ctx: _Ctx, text: str) -> list[SpecEffect] | None:
    """'+N% <stat> for Ns on hit' / 'for the duration' -> a self status carrying stat mods."""
    mods = []
    for part in re.split(r"\s+and\s+|,\s*", body):
        pm = re.match(rf"\+?{_N}%\s*(?:caster\s+)?(.+)$", part.strip(), re.I)
        if not pm:
            continue
        field = next((f for w, f in _STAT_WORDS if re.fullmatch(w, pm.group(2).strip(), re.I)), None)
        if field is None:
            continue  # e.g. the PvP half of "PvE Damage Boost and PvP Damage Boost": not simulated
        mods.append(StatMod(field, _n(float(pm.group(1)), "estimated",
                                      f"'{pm.group(2).strip()}' read as the {field} bucket")))
    if not mods:
        return None
    if dur_s is not None:
        dur = _n(float(dur_s), "confirmed")
    elif ctx.own_dur is not None and ctx.own_dur.value:
        dur = Num(ctx.own_dur.value, "estimated",
                  f"'for the duration' = this skill's own buff duration ({ctx.own_dur.source})")
    else:
        return None
    key = ctx.new_status("buff", dur, tuple(mods))
    return [SpecEffect("adds_status", dur, status_key=key, note=text)]


def _parse(text: str, ctx: _Ctx) -> list[SpecEffect]:
    t = text.strip().rstrip(".")
    E = SpecEffect

    if m := re.fullmatch(rf"-{_N}s cooldown", t, re.I):
        return [E("cooldown_add_s", _n(-float(m[1]), "confirmed"))]
    if m := re.fullmatch(rf"-{_N}% cooldown", t, re.I):
        return [E("cooldown_mult", _n(1 - float(m[1]) / 100, "confirmed", f"-{m[1]}% cooldown"))]
    if m := re.fullmatch(rf"Remove[s]? cooldown|Removes {_REF} cooldown", t, re.I):
        if m[1] and not ctx.is_self(m[1]):
            return [E("unknown", note=f"removes another skill's cooldown ({m[1]})")]
        return [E("removes_cooldown", _n(1, "estimated", "text says the cooldown is removed; community says it may be window-gated"))]
    if m := re.fullmatch(rf"-{_N}s {_REF} cooldown", t, re.I):
        k = ctx.skill(m[2])
        if k is None:
            return [E("unknown", note=f"skill {m[2]} not found")]
        return [E("cooldown_add_s", _n(-float(m[1]), "confirmed"), skill_key=None if k == ctx.key else k)]
    if m := re.fullmatch(rf"-{_N}% {_REF} cooldown", t, re.I):
        k = ctx.skill(m[2])
        if k is None:
            return [E("unknown", note=f"skill {m[2]} not found")]
        return [E("cooldown_mult", _n(1 - float(m[1]) / 100, "confirmed"), skill_key=None if k == ctx.key else k)]
    if m := re.fullmatch(rf"-{_N}s all (?:skill )?cooldowns on hit", t, re.I):
        return [E("cdr_all_s", _n(float(m[1]), "estimated", "applied once per cast (per-hit scaling unknown)"))]
    if m := re.fullmatch(rf"{_N}% chance to reduce all skill cooldowns by {_N}s on Critical Hit for the duration", t, re.I):
        return [E("cdr_all_s", _n(float(m[2]), "estimated", "per crit event while the skill's own buff is up"),
                  chance=float(m[1]) / 100, trigger="crit", requires_status="@own")]
    if m := re.fullmatch(rf"-{_N}s {_REF} cooldown (?:on hit|per fireball|on landing (?:{_REF}|.+))", t, re.I):
        k = ctx.skill(m[2])
        if k is None:
            return [E("unknown", note=f"skill {m[2]} not found")]
        on = ctx.skill(m[3]) if m[3] else None
        return [E("cdr_skill_s", _n(float(m[1]), "estimated", "applied once per cast"), skill_key=k, on_skill=on)]
    if m := re.fullmatch(rf"Resets? {_REF} cooldown on landing a Critical Hit", t, re.I) or \
            re.fullmatch(rf"Resets? (?:cooldown) on landing a Critical Hit(?: with {_REF})?", t, re.I):
        k = ctx.skill(m[1]) if m.group(1) else ctx.key
        if k is None:
            return [E("unknown", note=f"skill {m[1]} not found")]
        return [E("reset_skill", _n(1, "confirmed"), skill_key=k, trigger="crit")]
    if m := re.fullmatch(rf"Resets? {_REF} cooldown on landing (?:{_REF}|.+)", t, re.I):
        k = ctx.skill(m[1])
        if k is None:
            return [E("unknown", note="reset target not found")]
        return [E("reset_skill", _n(1, "estimated", "reset once per cast of the landed skill"), skill_key=k,
                  on_skill=ctx.skill(m[2]) if m[2] else None)]
    if m := re.fullmatch(rf"-{_N}s all (?:skill )?cooldowns", t, re.I):
        return [E("cdr_all_s", _n(float(m[1]), "estimated", "taken off every other skill once per cast of this skill"))]
    if m := re.fullmatch(rf"{_N}% chance to reset (?:{_REF} )?cooldown(?: on hit)?", t, re.I):
        k = ctx.skill(m[2]) if m[2] else ctx.key
        if k is None:
            return [E("unknown", note=f"skill {m[2]} not found")]
        return [E("reset_skill", _n(1, "confirmed"), chance=float(m[1]) / 100, skill_key=k)]
    if (m := re.fullmatch(rf"\+{_N}s (?:{_REF} )?(?:(summon(?:ing)?|effect|Damage over Time|\w+) )?duration", t, re.I))             and not _NO_DPS.search(m[3] or ""):
        return [E("duration_add_s", _n(float(m[1]), "estimated", "added to every status this skill applies"))]
    if m := re.fullmatch(rf"\+{_N}% (Fire|Water|Earth) Damage Boost for {_N}s on activating {_REF}", t, re.I):
        k = ctx.skill(m[4])
        if k is None:
            return [E("unknown", note=f"skill {m[4]} not found")]
        dur = _n(float(m[3]), "confirmed")
        key = ctx.new_status("elem", dur, elements=frozenset({m[2].lower()}))
        ctx.statuses[key] = replace(ctx.statuses[key], dmg_mult=Num(1 + float(m[1]) / 100, "estimated",
                                    "additive Damage Boost bucket approximated as a multiplier"))
        return [E("adds_status", dur, status_key=key, on_skill=k, note=t)]
    if (m := re.fullmatch(rf"\+{_N}% (?:additional )?(Combat Speed|Attack)", t, re.I)) and ctx.own_dur is not None:
        return _timed_buff(f"+{m[1]}% {m[2]}", None, ctx, t) or [E("unknown", note="no own buff duration")]
    if m := re.fullmatch(rf"\+{_N}% Skill Speed", t, re.I):
        return [E("cast_speed_pct", _n(float(m[1]), "estimated", "Skill Speed read as animation + charge speed of this skill"))]
    if m := re.fullmatch(rf"-{_N}s casting time", t, re.I):
        return [E("anim_add_s", _n(-float(m[1]), "estimated", "casting time read as part of the animation lock"))]
    if m := re.fullmatch(rf"Restores {_N} MP(?: on hit)?", t, re.I):
        return [E("resource_restore", _n(float(m[1]), "confirmed"))]
    if m := re.fullmatch(rf"Restores {_N} MP on landing a Critical Hit", t, re.I):
        return [E("resource_restore", _n(float(m[1]), "confirmed"), trigger="crit")]
    if m := re.fullmatch(rf"\+{_N}% MP restored", t, re.I):
        return [E("resource_restore", _n(float(m[1]), "confirmed"), cond="pct", note="% of the skill's own MP restore")]
    if m := re.fullmatch(rf"(?:-{_N}% MP (?:consumed|Cost)|Reduces MP Cost by {_N}%)", t, re.I):
        return [E("mp_cost_mult", _n(1 - float(m[1] or m[2]) / 100, "confirmed"))]
    if m := re.fullmatch(rf"Removes MP (?:Cost|consumed)(?: and restores {_N} MP(?: on hit)?)?", t, re.I):
        out = [E("mp_cost_mult", _n(0.0, "confirmed"))]
        if m[1]:
            out.append(E("resource_restore", _n(float(m[1]), "confirmed")))
        return out
    if m := re.fullmatch(rf"(?:Up to )?\+{_N}% (?:max )?damage when (more|less) targets (?:are )?hit|"
                         rf"Deals up to {_N}% more damage when (more|less) targets are hit", t, re.I):
        pct, which = (m[1], m[2]) if m[1] else (m[3], m[4])
        return [E("dmg_mult", _n(1 + float(pct) / 100, "estimated", "'up to': scaled linearly with the targets hit"),
                  cond=f"{which.lower()}_targets")]
    if m := re.fullmatch(rf"Up to \+{_N}% damage when less targets hit", t, re.I):
        return [E("dmg_mult", _n(1 + float(m[1]) / 100, "estimated", "'up to': scaled linearly"), cond="less_targets")]
    if m := re.fullmatch(rf"\+{_N}% (?:additional )?damage (?:to|on attacking) .+|\+{_N} damage to targets afflicted with .+", t, re.I):
        v = m[1] or m[2]
        return [E("dmg_mult", _n(1 + float(v) / 100 if m[1] else 1.0, "estimated"), cond="unmodeled",
                  note="needs a target state the simulator does not track")]
    if m := re.fullmatch(rf"\+{_N} max targets hit", t, re.I):
        return [E("aoe_targets_add", _n(float(m[1]), "confirmed"))]
    if m := re.fullmatch(rf"(?:Adds {_N} additional strikes|Deals damage {_N} additional time|Activates {_REF} {_N} extra times?)", t, re.I):
        v = m[1] or m[2] or m[4]
        return [E("extra_hits", _n(float(v), "estimated", "each extra strike = one more full hit"))]
    if m := re.fullmatch(rf"\+{_N} consecutive uses?", t, re.I):
        return [E("charges", _n(float(m[1]), "confirmed"))]
    if m := re.fullmatch(r"Ignores Block and Evasion and lands as (?:a )?Critical Hit", t, re.I):
        return [E("ignore_block", _n(0, "estimated", "Block/Evasion do not matter against a PvE dummy"),
                  note="PvE: no effect"), E("force_crit", _n(1, "confirmed"))]
    if re.fullmatch(r"Ignores Block and Evasion and lands as Multi-Hit", t, re.I):
        return [E("ignore_block", _n(0, "estimated", "Block/Evasion do not matter against a PvE dummy"), note="PvE: no effect"),
                E("extra_hits", Num(None, "unknown", "Multi-Hit damage is not in any source"), note="lands as Multi-Hit")]
    if re.fullmatch(r"Ignores Block and Evasion", t, re.I):
        return [E("ignore_block", _n(0, "estimated", "Block/Evasion do not matter against a PvE dummy"), note="PvE: no effect")]
    if re.fullmatch(r"Changes to mobile skill|Available in combat", t, re.I):
        return [E("mobile", _n(0, "confirmed"), note="no DPS effect")]
    if re.search(r"\bMulti-Hit\b", t, re.I) and not re.search(r"Resist", t, re.I):
        return [E("extra_hits", Num(None, "unknown", "Multi-Hit damage is not in any source"), note=t)]
    if m := re.fullmatch(rf"\+{_N}% Skill Critical Hit", t, re.I):
        return [E("crit_chance_add", _n(float(m[1]), "estimated", "read as +% crit chance on this skill's hits"))]
    # timed self buffs: "+30% Attack for 10s on hit", "+20% Critical Damage Boost for the duration"
    if m := re.fullmatch(r"(?P<body>.+?) for (?:(?P<dur>\d+(?:\.\d+)?)s|the duration)(?: on (?:hit|use))?", t, re.I):
        out = _timed_buff(m["body"], m["dur"], ctx, t)
        if out:
            return out
    # Damage over Time on hit -> a DoT status whose tick the text does not give
    if m := re.fullmatch(rf"(?:(Fire|Water|Earth) )?Damage over Time for {_N}s on hit", t, re.I):
        el = frozenset({m[1].lower()}) if m[1] else frozenset()
        dur = _n(float(m[2]), "confirmed")
        key = ctx.new_status("dot", dur, on="target", tick=True, elements=el)
        return [E("adds_status", dur, status_key=key, note="tick damage not in the text")]
    if re.fullmatch(r"Inflicts Damage over Time to target on hit", t, re.I) and ctx.own_dur is not None:
        key = ctx.new_status("dot", ctx.own_dur, on="target", tick=True)
        return [E("adds_status", ctx.own_dur, status_key=key, note="tick damage not in the text")]
    if m := re.search(r"Critical Hit on hit|Extra damage on hit|Extra damage|Delayed Damage|extra damage|Changes to (?:AoE|Charge)|x\d", t):
        return [E("unknown", note="no value in the text")]
    if _NO_DPS.search(t):
        return [E("no_dps", _n(0, "estimated", "crowd control / defence / healing / mobility: no damage-race effect"),
                  note=t)]
    return [E("unknown", note="unrecognised text")]


def parse_spec_text(text: str, skill_key: str, skill_name: str, idx: int, names: dict[str, str],
                    own_dur: Num | None = None) -> tuple[tuple[SpecEffect, ...], dict[str, Status]]:
    """Effects (+ synthetic statuses they reference) for one specialty text."""
    ctx = _Ctx(skill_key, skill_name, idx, names, own_dur)
    effs = _parse(text, ctx)
    return tuple(effs), ctx.statuses


# ---- per-class overrides --------------------------------------------------------------------------


def _eff_from_dict(d: dict) -> SpecEffect:
    v = d.get("value")
    if isinstance(v, dict):
        num = Num(v.get("value"), v.get("confidence", "estimated"), v.get("source", OVERRIDE_SRC))
    elif v is None:
        num = Num(None, "unknown", OVERRIDE_SRC)
    else:
        num = Num(float(v), d.get("confidence", "estimated"), d.get("source", OVERRIDE_SRC))
    return SpecEffect(
        kind=d["kind"], value=num, chance=float(d.get("chance", 1.0)), trigger=d.get("trigger", "cast"),
        cond=d.get("cond", ""), skill_key=d.get("skill_key"), status_key=d.get("status_key"),
        requires_status=d.get("requires_status"), note=d.get("note", ""))


def finalize_gamedata(gd: GameData, overrides: dict | None = None,
                      slot_ranks: list | None = None) -> GameData:
    """Fill Specialization.effects (parser, then `overrides[skill_key][str(option)]` = list of effect dicts),
    synthesize the statuses specialties reference, tag stagger-gated skills. Idempotent."""
    if gd.specs_parsed and not overrides:
        return gd
    names = {}
    for k, s in gd.skills.items():
        names.setdefault(_norm_name(s.name), k)
    # a stigma wins a name clash with its hidden duplicate (see gate_stigma)
    for k, s in gd.skills.items():
        if s.kind == SkillKind.STIGMA:
            names[_norm_name(s.name)] = k
    overrides = overrides or {}
    new_statuses: dict[str, Status] = {}
    skills = {}
    for k, s in gd.skills.items():
        specs = []
        rule = gd.rules.get(k)
        own = next((gd.statuses[a].duration_s for a in (rule.applies if rule else ()) if a in gd.statuses), None)
        for i, sp in enumerate(s.specializations):
            ov = (overrides.get(k) or {}).get(str(i))
            if ov is not None:
                effs = tuple(_eff_from_dict(e) for e in ov) or (
                    SpecEffect("no_dps", Num(0.0, "estimated", OVERRIDE_SRC), note="override: no effect"),)
            elif sp.effects and gd.specs_parsed:
                effs = sp.effects
            else:
                effs, st = parse_spec_text(sp.text, k, s.name, i, names, own)
                new_statuses.update(st)
            specs.append(replace(sp, effects=effs))
        tags = s.tags
        if STAGGER_RE.search(s.description) and "needs_stagger" not in tags:
            tags = tags + ("needs_stagger",)
        skills[k] = replace(s, specializations=tuple(specs), tags=tags)
    statuses = {**new_statuses, **gd.statuses}
    slots = tuple(Num(float(r["value"] if isinstance(r, dict) else r),
                      r.get("confidence", "estimated") if isinstance(r, dict) else "estimated",
                      r.get("source", "mechanics.json spec_slot_ranks") if isinstance(r, dict) else "mechanics.json spec_slot_ranks")
                  for r in slot_ranks) if slot_ranks else gd.spec_slot_ranks
    return replace(gd, skills=skills, statuses=statuses, spec_slot_ranks=slots, specs_parsed=True)


def spec_coverage(gd: GameData) -> dict[str, int]:
    """How many specialty options parsed to each effect kind (diagnostics, tests)."""
    out: dict[str, int] = {}
    for s in gd.skills.values():
        for sp in s.specializations:
            for e in sp.effects or (SpecEffect("unparsed"),):
                out[e.kind] = out.get(e.kind, 0) + 1
    return out


__all__ = ["parse_spec_text", "finalize_gamedata", "spec_coverage", "STATUS_STAT_FIELDS"]
