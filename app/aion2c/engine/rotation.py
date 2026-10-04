"""Plain-English rotation: opener, core cooldowns, chains, filler, skipped skills.

Everything is derived from the simulated cast log plus the game-data rules, so the text can never
describe a skill the simulation does not actually press. Qt-free; JSON-safe output.
"""
from __future__ import annotations

from statistics import median

from aion2c.data.loader import allowed_skills
from aion2c.models import CharacterBuild, GameData, Priority, Scenario, SimResult, SkillKind, total_rank

BUFF_MIN_MULT = 1.0001  # a status counts as a damage buff above this multiplier
HOLD_CAST_SHARE = 0.8  # "hold for <buff>": this share of casts happen inside the buff window
HOLD_MAX_UPTIME = 0.6  # ...while the buff is up less than this share of the fight
OPENER_MAX = 14
RARE_FRACTION = 0.5  # cast under half as often as the cooldown allows = "rarely"


def cooldown_of(gd: GameData, build: CharacterBuild, key: str) -> float:
    """Data cooldown (seconds, before cooldown reduction) at the build's rank; unknown counts as 0."""
    sk = gd.skills.get(key)
    if sk is None or not sk.ranks:
        return 0.0
    rank = max(1, min(total_rank(gd, build, sk), len(sk.ranks)))
    v = sk.ranks[rank - 1].cooldown_s.value
    return float(v) if v is not None else 0.0


def _name(gd: GameData, key: str) -> str:
    sk = gd.skills.get(key)
    return sk.name if sk is not None else key


def _status_name(gd: GameData, key: str) -> str:
    st = gd.statuses.get(key)
    return st.name if st is not None else key.replace("_", " ").title()


def _secs(v: float) -> str:
    return f"{v:.0f}" if abs(v - round(v)) < 0.05 else f"{v:.1f}"


def _available(gd: GameData, build: CharacterBuild, key: str) -> tuple[bool, str]:
    sk = gd.skills.get(key)
    if sk is None:
        return False, "not in the game data"
    if key not in {s.key for s in allowed_skills(gd, build.region, build.show_kr)}:
        return False, f"not available in the {build.region} version"
    if sk.unlock_level is not None and sk.unlock_level > build.level:
        return False, f"unlocks at level {sk.unlock_level}"
    if sk.kind == SkillKind.STIGMA and key not in build.stigmas:
        return False, "not one of your equipped stigmas"
    return True, ""


def _is_buff(gd: GameData, key: str) -> bool:
    sk = gd.skills.get(key)
    if sk is None:
        return False
    r = sk.ranks[0] if sk.ranks else None
    flats = [n.value for n in (r.flat_min, r.flat_max)] if r else []
    return not (sk.atk_ratio_pct.value or any(flats))


def _buffs_of(gd: GameData, key: str) -> list[str]:
    """Damage-multiplier statuses this skill applies to the player or target."""
    rule = gd.rules.get(key)
    out = []
    for s in rule.applies if rule else ():
        st = gd.statuses.get(s)
        if st is not None and st.dmg_mult.value is not None and st.dmg_mult.value > BUFF_MIN_MULT:
            out.append(s)
    return out


def chain_of(gd: GameData, build: CharacterBuild, root: str) -> list[str]:
    """[root, follow-up, follow-up...] limited to follow-ups the player can actually cast."""
    out = [root]
    rule = gd.rules.get(root)
    while rule is not None and rule.chain_next and rule.chain_next not in out:
        if not _available(gd, build, rule.chain_next)[0]:
            break
        out.append(rule.chain_next)
        rule = gd.rules.get(rule.chain_next)
    return out


def explain_rotation(
    gd: GameData, build: CharacterBuild, priority: Priority, result: SimResult, scenario: Scenario
) -> dict:
    per = {k: v for k, v in result.per_skill.items() if v.casts > 0}
    casts = list(result.casts)
    total = result.total_damage or sum(v.damage for v in per.values()) or 0.0
    dur = result.duration_s or scenario.duration_s or 1.0
    entry = {}
    for e in priority.entries:
        entry.setdefault(e.skill_key, e)
    order = [e.skill_key for e in priority.entries if e.skill_key in entry]
    order = list(dict.fromkeys(order))
    cast_keys = [k for k in order if k in per]
    cd = {k: cooldown_of(gd, build, k) for k in set(order) | set(per)}

    def share(k: str) -> float:
        return round(per[k].damage / total * 100, 1) if k in per and total > 0 else 0.0

    def item(k: str) -> dict:
        e = entry.get(k)
        return {"skill_key": k, "name": _name(gd, k), "icon_key": k, "charge_level": e.charge_level if e else 0}

    # ---- displayed priority: never-cast entries dropped -----------------------------------------
    shown = []
    for k in cast_keys:
        e = entry[k]
        shown.append({**item(k), "require_status": e.require_status, "casts": per[k].casts, "damage_share_pct": share(k)})

    # ---- opener: first casts until every cooldown skill has been used once ------------------------
    cd_cast = {k for k in cast_keys if cd.get(k, 0) > 0}
    opener, seen = [], set()
    for c in casts:
        opener.append({**item(c.skill_key), "t_s": round(c.t_s, 1), "charge_level": c.charge_level})
        if c.skill_key in cd_cast:
            seen.add(c.skill_key)
        if seen >= cd_cast or len(opener) >= OPENER_MAX:
            break

    # ---- core: cooldown skills in priority order --------------------------------------------------
    uptime = result.status_uptime
    core = []
    for k in cast_keys:
        if cd.get(k, 0) <= 0:
            continue
        e = entry[k]
        rule = gd.rules.get(k)
        need = list(dict.fromkeys(list(rule.requires if rule else ()) + ([e.require_status] if e.require_status else [])))
        mine = [c for c in casts if c.skill_key == k]
        gaps = [b.t_s - a.t_s for a, b in zip(mine, mine[1:])]
        every = round(float(median(gaps)), 1) if gaps else None
        buffs = _buffs_of(gd, k)
        hold = None
        if not _is_buff(gd, k) and len(mine) >= 2 and not need:
            sk = gd.skills[k]
            for s, st in gd.statuses.items():
                if s in _buffs_of(gd, k) or st.mp_min_pct is not None:
                    continue
                if st.dmg_mult.value is None or st.dmg_mult.value <= BUFF_MIN_MULT:
                    continue
                if st.elements and sk.element not in st.elements:
                    continue
                inside = sum(1 for c in mine if s in c.active_statuses) / len(mine)
                if inside >= HOLD_CAST_SHARE and uptime.get(s, 0.0) <= HOLD_MAX_UPTIME:
                    hold = s
                    break
        c = _secs(cd[k])
        lvl = ""
        if rule is not None and rule.charge_levels and e.charge_level in (0, len(rule.charge_levels)):
            lvl = f", fully charged (level {len(rule.charge_levels)})"
        elif e.charge_level:
            lvl = f", charge level {e.charge_level}"
        if need:
            rule_kind = "when_status"
            names = " and ".join(_status_name(gd, s) for s in need)
            text = f"Use when {names} is up (cooldown {c} s{lvl})."
        elif hold:
            rule_kind = "hold_for_buff"
            text = f"Hold for {_status_name(gd, hold)}: press it while that buff is running (cooldown {c} s{lvl})."
        elif _is_buff(gd, k):
            rule_kind = "on_cooldown"
            what = f" to keep {' and '.join(_status_name(gd, s) for s in buffs)} up" if buffs else ""
            text = f"Use on cooldown{what} (every {c} s, no damage of its own)."
        else:
            rule_kind = "on_cooldown"
            text = f"Use on cooldown (every {c} s{lvl})."
        core.append({
            **item(k), "cooldown_s": cd[k], "casts": per[k].casts, "cast_every_s": every,
            "damage_share_pct": share(k), "rule": rule_kind, "status": (need[0] if need else hold),
            "text": text,
        })

    # ---- chains ------------------------------------------------------------------------------------
    chains = []
    child_keys = set()
    for k in order:
        ch = chain_of(gd, build, k)
        child_keys.update(ch[1:])
        if len(ch) < 2 or k not in per:
            continue
        done = per[ch[-1]].casts if ch[-1] in per else 0
        names = " → ".join(_name(gd, s) for s in ch)
        text = f"{names}: keep pressing"
        text += f" (followed through {done} times in this fight)." if done else " when the follow-up lights up."
        chains.append({"skills": ch, "names": [_name(gd, s) for s in ch], "icon_keys": ch, "completed": done, "text": text})

    # ---- filler: zero-cooldown skills that actually get cast ------------------------------------------
    fill_keys = [k for k in cast_keys if cd.get(k, 0) <= 0]
    filler: dict = {"skills": [], "text": "Nothing: every cast above is on cooldown-driven timing."}
    if fill_keys:
        main = fill_keys[0]
        rows = [{**item(main), "casts": per[main].casts, "damage_share_pct": share(main), "role": "main"}]
        for k in fill_keys[1:]:
            rule = gd.rules.get(k)
            restore = rule.mp_restore if rule else 0.0
            role = "mana" if restore > 0 else "backup"
            rows.append({**item(k), "casts": per[k].casts, "damage_share_pct": share(k), "role": role})
        text = f"When nothing else is ready, press {_name(gd, main)}."
        extra = []
        for r in rows[1:]:
            extra.append(
                f"{r['name']} when {_name(gd, main)} cannot be cast (usually low mana)"
                if r["role"] == "mana" else f"{r['name']} as a backup"
            )
        if extra:
            text += " Fall back to " + "; ".join(extra) + "."
        filler = {"skills": rows, "text": text}

    # ---- skipped: in the list but never (or rarely) cast ----------------------------------------------------
    skip = []
    zero_above: list[str] = []
    for k in order:
        n = per[k].casts if k in per else 0
        reason = None
        if n == 0:
            ok, why = _available(gd, build, k)
            rule = gd.rules.get(k)
            need = list(rule.requires) if rule else []
            e = entry[k]
            if e.require_status:
                need.append(e.require_status)
            if not ok:
                reason = f"never cast: {why}"
            elif need:
                s = need[0]
                reason = (f"never cast: needs {_status_name(gd, s)}, which was up "
                          f"{uptime.get(s, 0.0) * 100:.0f}% of the fight")
            elif cd.get(k, 0) <= 0 and zero_above:
                reason = f"never cast: {_name(gd, zero_above[0])} has no cooldown and always goes first"
            elif k in child_keys:
                reason = "never cast: it is a chain follow-up, it appears after its first skill instead"
            else:
                reason = "never cast: higher skills and animation time always took its turn"
        elif cd.get(k, 0) > 0:
            possible = dur / max(cd[k], 0.1)
            if possible >= 2 and n < RARE_FRACTION * possible:
                reason = f"rarely cast: {n} times where its cooldown would allow about {possible:.0f}"
        if reason:
            skip.append({**item(k), "casts": n, "reason": reason})
        if cd.get(k, 0) <= 0 and n > 0:
            zero_above.append(k)

    return {
        "scenario": scenario.key,
        "scenario_name": scenario.name,
        "duration_s": dur,
        "dps": result.dps,
        "priority": shown,
        "opener": opener,
        "core": core,
        "chains": chains,
        "filler": filler,
        "skip": skip,
    }
