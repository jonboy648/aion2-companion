"""In-game macro builder. P5 owns this file.

The in-game macro walks its entries IN ORDER and skips anything unusable, so it is not a priority list.
To approximate priority the top slot is repeated between the others: 1,2,1,3,1,4 (entries are 1-based).
Manual skills never enter a macro.
"""
from __future__ import annotations

from aion2c.models import MacroEntry, MacroPlan, Priority, SlotStack

MAX_ENTRIES = 20

# (macro name, scenario key, hotkeys key, default hotkey)
_MACROS = (
    ("Boss loop", "boss_180", "boss", "F9"),
    ("AoE loop", "aoe_pack", "aoe", "F10"),
)


def macro_slots(
    stacks: tuple[SlotStack, ...], priority: Priority | None, manual: frozenset[str] = frozenset()
) -> list[str]:
    """Slot labels a macro may press, ordered by the priority position of the slot's best skill.
    Slots holding a `manual` skill (keybinds.layout.manual_keys) are skipped."""
    if priority is None:
        return []
    pos: dict[str, int] = {}
    for i, e in enumerate(priority.entries):
        pos.setdefault(e.skill_key, i)
    ranked: list[tuple[int, int, str]] = []
    for n, st in enumerate(stacks):
        if any(k in manual for k in st.stack):
            continue
        hits = [pos[k] for k in st.stack if k in pos]
        if hits:
            ranked.append((min(hits), n, st.key_label))
    ranked.sort()
    return [lab for _, _, lab in ranked]


def _sequence(slots: list[str]) -> list[str]:
    """Top slot at every odd (1-based) index: [s1, s2, s1, s3, ...], capped at 20 entries."""
    if len(slots) <= 1:
        return list(slots)
    seq: list[str] = []
    for other in slots[1:]:
        seq.extend((slots[0], other))
    return seq[:MAX_ENTRIES]


def build_macros(
    stacks_by_scenario: dict[str, tuple[SlotStack, ...]],
    priorities: dict[str, Priority],
    hotkeys: dict[str, str] | None = None,
    delay_ms: int = 10,
    manual: frozenset[str] = frozenset(),
) -> tuple[MacroPlan, ...]:
    hotkeys = hotkeys or {}
    plans: list[MacroPlan] = []
    for name, scen_key, hk_key, default in _MACROS:
        slots = macro_slots(stacks_by_scenario.get(scen_key, ()), priorities.get(scen_key), manual)
        entries = tuple(MacroEntry(i, lab, delay_ms) for i, lab in enumerate(_sequence(slots), start=1))
        plans.append(MacroPlan(name, hotkeys.get(hk_key) or default, entries))
    return tuple(plans)
