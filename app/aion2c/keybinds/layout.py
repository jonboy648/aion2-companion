"""Hotbar stacks. P5 owns this file.

A hotbar slot holds up to 4 skills; one press fires the highest-priority usable one (index 0 first),
so the stack order is the only real priority layer (the in-game macro just walks slots in order).
Rules (PLAN 3 P5 + section 5):
- labels come only from `models.KEY_LABELS`; the user's existing bar label is kept where possible;
- stacks are priority groups: burst cooldowns first, then conditional spenders (need a status),
  then rotational damage, and the zero-cooldown filler LAST (it is always usable, so anything
  below it would starve);
- an always-ready 0-cooldown skill is only ever the LAST row of a stack (chain-window children are conditional);
- MANUAL skills (data tag "manual": charge skills, CC breaks, defensives, plus dodge) get dedicated slots and never enter a macro;
- with auto_chain False the chain children go into the parent's stack, children first, root last.
`design_groups` takes a `style` so the macro search can try several partitions of the same skills.
"""
from __future__ import annotations

from aion2c.engine.rotation import cooldown_of
from aion2c.models import (
    KEY_LABELS,
    CharacterBuild,
    GameData,
    Priority,
    SkillBar,
    SkillKind,
    SlotStack,
    total_rank,
)

MAX_STACK = 4
BURST_CD_S = 30.0  # a damage skill with at least this cooldown counts as a burst cooldown
STYLES = ("roles", "merged", "priority", "single", "long_first")

_STACKABLE = (SkillKind.ACTIVE, SkillKind.STIGMA)

ROLE_NOTES = {
    "cooldown": "Burst and buff cooldowns, most valuable first.",
    "conditional": "Spenders that only work while a status is up (for example Fire Mark). Skipped when it is not.",
    "rotational": "Short-cooldown rotational damage, best first.",
    "mixed": "Cooldown skills in rotation-priority order.",
    "filler": "Filler. It has no cooldown, so it is always ready and must be the bottom row.",
    "manual": "Pressed by hand, so it is never in a macro.",
}


def slot_why(gd: GameData, build: CharacterBuild, stack: tuple[str, ...], gated: frozenset[str] = frozenset()) -> str:
    """One sentence on why this stack is ordered the way it is, from the skills actually in it."""
    role = stack_role(gd, build, stack, gated)
    if role == "manual":
        sk = next(gd.skills[key] for key in stack if is_manual(gd, key))
        why = ("a charge skill: you hold the key to charge it" if "charge skill" in sk.tags
               else "a defensive or crowd control skill: use it when the fight needs it" if any(
                   t in sk.tags for t in ("role:defense", "role:cc")) else "tagged manual in the game data")
        return f"{ROLE_NOTES['manual']} It is {why}."
    parts = []
    for k in stack:
        name = gd.skills[k].name if k in gd.skills else k
        rule = gd.rules.get(k)
        cd = _cooldown_s(gd, build, k)
        need = [gd.statuses[r].name if r in gd.statuses else r for r in (rule.requires if rule else ())]
        if gd.skills[k].kind in (SkillKind.CHAIN, SkillKind.PROC):
            parts.append(f"{name} (only while its chain window is open)")
        elif cd <= 0:
            parts.append(f"{name} (no cooldown, always ready, so last)")
        elif need or k in gated:
            parts.append(f"{name} (only while {' and '.join(need) or 'its status'} is up, {cd:.0f} s)")
        else:
            parts.append(f"{name} ({cd:.0f} s)")
    head = ROLE_NOTES.get(role, "")
    if len(stack) == 1:
        return head
    return f"{head} A press fires the first one ready: " + ", then ".join(parts) + "."


def is_manual(gd: GameData, key: str) -> bool:
    """Pressed by hand: dodges, and any skill whose data carries the `manual` tag."""
    sk = gd.skills.get(key)
    return sk is not None and (sk.kind == SkillKind.DODGE or "manual" in sk.tags)


def manual_keys(gd: GameData) -> frozenset[str]:
    """Every manual skill key of the class (build_macros has no GameData, so callers pass this in)."""
    return frozenset(k for k in gd.skills if is_manual(gd, k))


def _cooldown_s(gd: GameData, build: CharacterBuild, key: str) -> float:
    return cooldown_of(gd, build, key)  # unknown treated as 0: keeps it last, never starves others


def _chain_children(gd: GameData, key: str, build: CharacterBuild | None = None) -> list[str]:
    out: list[str] = []
    seen = {key}
    rule = gd.rules.get(key)
    nxt = rule.chain_next if rule else None
    while nxt and nxt not in seen and nxt in gd.skills:
        if build is not None and not _castable(gd, build, nxt, chain_child=True):
            break  # Later descendants cannot be reached through an unavailable step.
        out.append(nxt)
        seen.add(nxt)
        rule = gd.rules.get(nxt)
        nxt = rule.chain_next if rule else None
    return out


def _castable(gd: GameData, build: CharacterBuild, key: str, chain_child: bool = False) -> bool:
    sk = gd.skills.get(key)
    kinds = _STACKABLE + (SkillKind.DODGE,) + ((SkillKind.CHAIN, SkillKind.PROC) if chain_child else ())
    if sk is None or sk.kind not in kinds:
        return False
    if sk.kind == SkillKind.STIGMA and key not in build.stigmas:
        return False
    if sk.unlock_level is not None and sk.unlock_level > build.level:
        return False
    rule = gd.rules.get(key)
    if rule is not None and rule.requires_spec:
        owner, option = rule.requires_spec
        owner_skill = gd.skills.get(owner)
        if owner_skill is None or option not in build.specs.get(owner, ()) or not 0 <= option < len(owner_skill.specializations):
            return False
        required = owner_skill.specializations[option].rank_required
        if required is None or total_rank(gd, build, owner_skill) < required:
            return False
    return build.region in sk.regions


def _stack_unit(gd: GameData, build: CharacterBuild, key: str, auto_chain: bool) -> list[str]:
    children = [] if auto_chain else _chain_children(gd, key, build)
    return (list(reversed(children)) + [key])[-MAX_STACK:]


def skill_role(gd: GameData, build: CharacterBuild, key: str, gated: frozenset[str] = frozenset()) -> str:
    """cooldown | conditional | rotational | filler (a manual skill is `manual`)."""
    if is_manual(gd, key):
        return "manual"
    cd = _cooldown_s(gd, build, key)
    if cd <= 0:
        return "filler"
    rule = gd.rules.get(key)
    if key in gated or (rule is not None and rule.requires):
        return "conditional"
    sk = gd.skills[key]
    r = sk.ranks[0] if sk.ranks else None
    dmg = bool(sk.atk_ratio_pct.value) or (r is not None and any(n.value for n in (r.flat_min, r.flat_max)))
    if not dmg or "role:burst" in sk.tags or cd >= BURST_CD_S:
        return "cooldown"
    return "rotational"


def _chunks(keys: list[str], units: dict[str, list[str]]) -> list[list[str]]:
    groups: list[list[str]] = []
    for key in keys:
        unit = units[key]
        if groups and len(groups[-1]) + len(unit) <= MAX_STACK:
            groups[-1].extend(unit)
        else:
            groups.append(list(unit))
    return groups


def stack_role(gd: GameData, build: CharacterBuild, stack: tuple[str, ...], gated: frozenset[str] = frozenset()) -> str:
    if any(is_manual(gd, key) for key in stack):
        return "manual"
    roles = [skill_role(gd, build, k, gated) for k in stack]
    if len(stack) == 1 and roles[0] == "filler":
        return "filler"
    body = [r for r in roles if r != "filler"] or roles
    return body[0] if len(set(body)) == 1 else "mixed"


def design_groups(
    gd: GameData,
    build: CharacterBuild,
    priority: Priority,
    auto_chain: bool = True,
    style: str = "roles",
) -> tuple[list[list[str]], list[str], list[str]]:
    """(stack groups in slot order, manual skills in priority order, warnings). No labels yet."""
    warnings: list[str] = []
    order: list[str] = []
    child_keys = {c for k in gd.rules for c in _chain_children(gd, k)}
    for e in priority.entries:
        k = e.skill_key
        if k in order:
            continue
        if k not in gd.skills:
            warnings.append(f"{k}: not in game data, skipped")
            continue
        if not _castable(gd, build, k):
            if gd.skills[k].kind not in _STACKABLE + (SkillKind.DODGE,):
                continue  # chain child / passive: not castable from its own slot
            reason = "not an equipped stigma" if gd.skills[k].kind == SkillKind.STIGMA and k not in build.stigmas else f"locked or not available in {build.region}"
            warnings.append(f"{k}: {reason}, skipped")
            continue
        if k in child_keys:
            continue  # chain child: reached through its root (or placed in the root's stack)
        order.append(k)

    gated = frozenset(e.skill_key for e in priority.entries if e.require_status)
    manual = [k for k in order if is_manual(gd, k)]
    body = [k for k in order if not is_manual(gd, k)]
    units = {key: _stack_unit(gd, build, key, auto_chain) for key in body}
    cds = [k for k in body if _cooldown_s(gd, build, k) > 0]
    role = {k: skill_role(gd, build, k, gated) for k in cds}
    by_role = {r: [k for k in cds if role[k] == r] for r in ("cooldown", "conditional", "rotational")}

    if style == "priority":
        groups = _chunks(cds, units)
    elif style == "single":
        groups = [list(units[k]) for k in cds]
    elif style == "merged":
        groups = _chunks(by_role["cooldown"], units) + _chunks(by_role["conditional"] + by_role["rotational"], units)
    else:
        cool = by_role["cooldown"]
        if style == "long_first":
            cool = sorted(cool, key=lambda k: -_cooldown_s(gd, build, k))
        groups = _chunks(cool, units) + _chunks(by_role["conditional"], units) + _chunks(by_role["rotational"], units)

    # filler last: the first zero-cooldown skill rides the final stack, any others get their own slot
    fillers = []
    for k in body:
        if _cooldown_s(gd, build, k) <= 0:
            fillers.append(units[k])
    for i, unit in enumerate(fillers):
        if i == 0 and groups and len(groups[-1]) + len(unit) <= MAX_STACK:
            groups[-1].extend(unit)
        else:
            groups.append(list(unit))
    return groups, manual, warnings


def assign_labels(
    gd: GameData, groups: list[list[str]], manual: list[str], bar: SkillBar,
    dedicated_groups: dict[str, list[str]] | None = None,
) -> tuple[tuple[SlotStack, ...], list[str]]:
    """Give every group a key label: the user's own bar label when one of its skills sits there."""
    warnings: list[str] = []
    bar_label: dict[str, str] = {}  # first label in KEY_LABELS order wins when a skill sits on two keys
    for lab in KEY_LABELS:
        sk = bar.slots.get(lab)
        if sk and sk not in bar_label:
            bar_label[sk] = lab
    for lab in bar.slots:
        if lab not in KEY_LABELS:
            warnings.append(f"bar label {lab!r} is not a valid key label and was ignored")
    bar_labels_used = {lab for lab in KEY_LABELS if bar.slots.get(lab)}

    taken: set[str] = set()
    free_pool = [lab for lab in KEY_LABELS if lab not in bar_labels_used]

    def pick_label(members: list[str]) -> str | None:
        for m in members:
            lab = bar_label.get(m)
            if lab and lab not in taken:
                return lab
        while free_pool:
            lab = free_pool.pop(0)
            if lab not in taken:
                return lab
        return None

    stacks: list[SlotStack] = []

    def add(members: list[str]) -> None:
        lab = pick_label(members)
        if lab is None:
            warnings.append(f"no free key label left for {', '.join(members)}")
            return
        taken.add(lab)
        stacks.append(SlotStack(lab, tuple(members)))
        if not any(bar_label.get(m) == lab for m in members):
            # one line per slot: the web UI folds "slot X: not on your bar" lines into a single hint
            warnings.append(f"slot {lab}: not on your bar, assign {', '.join(members)} there")

    for g in groups:
        add(g)
    for k in manual:
        add((dedicated_groups or {}).get(k, [k]))
    placed = {m for s in stacks for m in s.stack}
    for lab in KEY_LABELS:  # Keep unused pins on dedicated keys, including their explicit chains.
        sk = bar.slots.get(lab)
        if sk and sk in gd.skills and sk not in placed and lab not in taken:
            if gd.skills[sk].kind in _STACKABLE + (SkillKind.DODGE,):
                members = (dedicated_groups or {}).get(sk, [sk])
                taken.add(lab)
                placed.update(members)
                stacks.append(SlotStack(lab, tuple(members)))
    return tuple(stacks), warnings


def castable_bar(gd: GameData, build: CharacterBuild, bar: SkillBar) -> tuple[SkillBar, list[str]]:
    """Ignore stale pins without changing the saved bar."""
    valid_pins = {}
    warnings = []
    for label, key in bar.slots.items():
        skill = gd.skills.get(key)
        if skill is not None and skill.kind == SkillKind.STIGMA and key not in build.stigmas:
            warnings.append(f"pin {label}: {key} is not an equipped stigma, ignored")
        elif not _castable(gd, build, key):
            warnings.append(f"pin {label}: {key} is locked or unavailable, ignored")
        else:
            valid_pins[label] = key
    return SkillBar(slots=valid_pins), warnings


def layout(
    gd: GameData,
    build: CharacterBuild,
    priority: Priority,
    bar: SkillBar,
    auto_chain: bool = True,
    style: str = "roles",
) -> tuple[tuple[SlotStack, ...], list[str]]:
    """Return (stacks, warnings). `recommend_stacks` is the contract wrapper."""
    groups, manual, w1 = design_groups(gd, build, priority, auto_chain, style)
    bar, pin_warnings = castable_bar(gd, build, bar)
    dedicated_groups = {key: _stack_unit(gd, build, key, auto_chain) for key in (*manual, *bar.slots.values())}
    stacks, w2 = assign_labels(gd, groups, manual, bar, dedicated_groups)
    return stacks, w1 + pin_warnings + w2


def recommend_stacks(
    gd: GameData, build: CharacterBuild, priority: Priority, bar: SkillBar, auto_chain: bool = True
) -> tuple[SlotStack, ...]:
    # `auto_chain` is an optional keyword added by P5 (default keeps the frozen 4-argument call working).
    return layout(gd, build, priority, bar, auto_chain)[0]
