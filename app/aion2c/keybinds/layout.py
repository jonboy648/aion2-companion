"""Hotbar stacks. P5 owns this file.

A hotbar slot holds up to 4 skills; one press fires the highest-priority usable one (index 0 first).
Rules (PLAN 3 P5 + section 5):
- labels come only from `models.KEY_LABELS`; the user's existing bar label is kept where possible;
- a 0-cooldown skill is only ever the LAST row of a stack (it is always usable, so anything below starves);
- MANUAL skills (data tag "manual": charge skills, CC breaks, defensives, plus dodge) get single-skill slots and never enter a macro;
- with auto_chain False the chain children go into the parent's stack, children first, root last.
"""
from __future__ import annotations

from aion2c.data.loader import allowed_skills
from aion2c.models import (
    KEY_LABELS,
    CharacterBuild,
    GameData,
    Priority,
    SkillBar,
    SkillKind,
    SlotStack,
    effective_rank,
)

MAX_STACK = 4

_STACKABLE = (SkillKind.ACTIVE, SkillKind.STIGMA)


def is_manual(gd: GameData, key: str) -> bool:
    """Pressed by hand: dodges, and any skill whose data carries the `manual` tag."""
    sk = gd.skills.get(key)
    return sk is not None and (sk.kind == SkillKind.DODGE or "manual" in sk.tags)


def manual_keys(gd: GameData) -> frozenset[str]:
    """Every manual skill key of the class (build_macros has no GameData, so callers pass this in)."""
    return frozenset(k for k in gd.skills if is_manual(gd, k))


def _cooldown_s(gd: GameData, build: CharacterBuild, key: str) -> float:
    sk = gd.skills[key]
    if not sk.ranks:
        return 0.0
    rank = max(1, min(effective_rank(gd, build, sk), len(sk.ranks)))
    v = sk.ranks[rank - 1].cooldown_s.value
    return float(v) if v is not None else 0.0  # unknown treated as 0: keeps it last, never starves others


def _chain_children(gd: GameData, key: str) -> list[str]:
    out: list[str] = []
    seen = {key}
    rule = gd.rules.get(key)
    nxt = rule.chain_next if rule else None
    while nxt and nxt not in seen and nxt in gd.skills:
        out.append(nxt)
        seen.add(nxt)
        rule = gd.rules.get(nxt)
        nxt = rule.chain_next if rule else None
    return out


def _castable(gd: GameData, build: CharacterBuild, key: str) -> bool:
    sk = gd.skills.get(key)
    if sk is None or sk.kind not in _STACKABLE + (SkillKind.DODGE,):
        return False
    if sk.unlock_level is not None and sk.unlock_level > build.level:
        return False
    return key in {s.key for s in allowed_skills(gd, build.region, build.show_kr)}


def layout(
    gd: GameData,
    build: CharacterBuild,
    priority: Priority,
    bar: SkillBar,
    auto_chain: bool = True,
) -> tuple[tuple[SlotStack, ...], list[str]]:
    """Return (stacks, warnings). `recommend_stacks` is the contract wrapper."""
    warnings: list[str] = []

    # skill -> user's label (first label in KEY_LABELS order wins when a skill sits on two keys)
    bar_label: dict[str, str] = {}
    for lab in KEY_LABELS:
        sk = bar.slots.get(lab)
        if sk and sk not in bar_label:
            bar_label[sk] = lab
    for lab in bar.slots:
        if lab not in KEY_LABELS:
            warnings.append(f"bar label {lab!r} is not a valid key label and was ignored")
    bar_labels_used = {lab for lab in KEY_LABELS if bar.slots.get(lab)}

    # priority order, deduped, castable only; chain children are reached through their root
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
            warnings.append(f"{k}: locked or not available in {build.region}, skipped")
            continue
        if k in child_keys:
            continue  # chain child: reached through its root (or placed in the root's stack)
        order.append(k)

    manual = [k for k in order if is_manual(gd, k)]
    macro_skills = [k for k in order if not is_manual(gd, k)]
    cd_units: list[list[str]] = []
    filler_units: list[list[str]] = []
    for k in macro_skills:
        if _cooldown_s(gd, build, k) > 0:
            cd_units.append([k])
        else:
            unit = [k]
            if not auto_chain:
                unit = list(reversed(_chain_children(gd, k))) + [k]
            filler_units.append(unit[-MAX_STACK:])

    groups: list[list[str]] = []
    has_filler: list[bool] = []
    for unit in cd_units:
        if groups and not has_filler[-1] and len(groups[-1]) + len(unit) <= MAX_STACK:
            groups[-1].extend(unit)
        else:
            groups.append(list(unit))
            has_filler.append(False)
    for unit in filler_units:
        if groups and not has_filler[-1] and len(groups[-1]) + len(unit) <= MAX_STACK:
            groups[-1].extend(unit)
            has_filler[-1] = True
        else:
            groups.append(list(unit))
            has_filler.append(True)

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
            warnings.append(f"slot {lab}: not on your bar, assign {', '.join(members)} there")

    for g in groups:
        add(g)
    for k in manual:
        add([k])
    placed = {m for s in stacks for m in s.stack}
    for lab in KEY_LABELS:  # keep the rest of the user's bar intact as single slots
        sk = bar.slots.get(lab)
        if sk and sk in gd.skills and sk not in placed and lab not in taken:
            if gd.skills[sk].kind in _STACKABLE + (SkillKind.DODGE,):
                taken.add(lab)
                placed.add(sk)
                stacks.append(SlotStack(lab, (sk,)))
    return tuple(stacks), warnings


def recommend_stacks(
    gd: GameData, build: CharacterBuild, priority: Priority, bar: SkillBar, auto_chain: bool = True
) -> tuple[SlotStack, ...]:
    # `auto_chain` is an optional keyword added by P5 (default keeps the frozen 4-argument call working).
    return layout(gd, build, priority, bar, auto_chain)[0]
