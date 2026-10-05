"""In-game macro builder. P5 owns this file.

The in-game macro walks its entries IN ORDER from a wrapping pointer and skips anything unusable,
so it is not a priority list: priority lives inside the slot stacks (layout.py). `build_macros`
returns a plain seed (every slot once, best slot first); `search_entries` then improves a sequence
by deterministic hill-climbing on a caller-supplied score (the macro simulator's DPS).
Manual skills never enter a macro.
"""
from __future__ import annotations

import random
from collections.abc import Callable, Sequence

from aion2c.models import MacroEntry, MacroPlan, Priority, SlotStack

MAX_ENTRIES = 20

# (macro name, scenario key, hotkeys key, default hotkey)
MACRO_DEFINITIONS = (
    ("Boss loop", "boss_180", "boss", "F9"),
    ("AoE loop", "aoe_pack", "aoe", "F10"),
    ("Leveling loop", "level_pull", "leveling", "F11"),
)


def macro_definitions(scenarios: Sequence[str]) -> tuple[tuple[str, str, str, str], ...]:
    """Emit only supplied scenarios; keep the legacy empty-plan placeholders."""
    if not scenarios:
        return MACRO_DEFINITIONS[:2]
    return tuple(definition for definition in MACRO_DEFINITIONS if definition[1] in scenarios)


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


def seed_sequences(slots: list[str], filler: str | None = None) -> list[list[str]]:
    """Starting points for the search. First = every slot once, in priority order.
    Others: the filler slot repeated between the rest, and the top slot repeated between the rest."""
    if len(slots) <= 1:
        return [list(slots)]
    once = list(slots)[:MAX_ENTRIES]
    fill = filler if filler in slots else slots[-1]
    rest = [s for s in slots if s != fill]
    inter = [x for s in rest for x in (s, fill)][:MAX_ENTRIES]
    top = [x for s in slots[1:] for x in (slots[0], s)][:MAX_ENTRIES]
    out: list[list[str]] = []
    for s in (once, inter, top):
        if s not in out:
            out.append(s)
    return out


def _mutate(rng: random.Random, seq: list[str], slots: Sequence[str]) -> list[str]:
    s = list(seq)
    for _ in range(rng.choice((1, 1, 1, 2))):
        ops = ["replace", "swap", "move"]
        if len(s) < MAX_ENTRIES:
            ops += ["insert", "insert", "dup"]
        if len(s) > 1:
            ops += ["delete"]
        op = rng.choice(ops)
        if op == "insert":
            s.insert(rng.randrange(len(s) + 1), rng.choice(slots))
        elif op == "dup":
            i = rng.randrange(len(s))
            s.insert(rng.randrange(len(s) + 1), s[i])
        elif op == "delete":
            del s[rng.randrange(len(s))]
        elif op == "replace":
            s[rng.randrange(len(s))] = rng.choice(slots)
        elif op == "swap" and len(s) > 1:
            i, j = rng.sample(range(len(s)), 2)
            s[i], s[j] = s[j], s[i]
        elif op == "move" and len(s) > 1:
            x = s.pop(rng.randrange(len(s)))
            s.insert(rng.randrange(len(s) + 1), x)
    return s[:MAX_ENTRIES]


def search_entries(
    slots: Sequence[str],
    score: Callable[[tuple[str, ...]], float],
    seeds: Sequence[Sequence[str]],
    budget: int = 150,
    seed: int = 0,
) -> tuple[list[str], float, int]:
    """Hill-climb entry sequences (<= 20 slot labels). Returns (best, best score, simulations used).
    Deterministic for a given `seed`; ties prefer the shorter macro."""
    if not slots:
        return [], 0.0, 0
    allowed = set(slots)
    seeds = [[lab for lab in seq if lab in allowed][:MAX_ENTRIES] for seq in seeds]
    seeds = [seq for seq in seeds if seq] or [[slots[0]]]
    if budget <= 0:
        return list(seeds[0]), 0.0, 0
    rng = random.Random(seed)
    cache: dict[tuple[str, ...], float] = {}

    def ev(seq: Sequence[str]) -> float:
        k = tuple(seq)
        if k not in cache:
            cache[k] = score(k)
        return cache[k]

    best = list(seeds[0]) if seeds else [slots[0]]
    best_s = ev(best)
    for sd in seeds[1:]:
        if len(cache) >= budget:
            break
        s = ev(sd)
        if s > best_s + 1e-9:
            best, best_s = list(sd), s
    tries = 0
    while len(cache) < budget and tries < budget * 6:
        tries += 1
        cand = _mutate(rng, best, slots)
        if not cand or tuple(cand) in cache:
            continue
        s = ev(cand)
        if s > best_s + 1e-9 or (abs(s - best_s) <= 1e-9 and len(cand) < len(best)):
            best, best_s = cand, s
    return best, best_s, len(cache)


def _entries(seq: Sequence[str], delay_ms: int) -> tuple[MacroEntry, ...]:
    return tuple(MacroEntry(i, lab, delay_ms) for i, lab in enumerate(seq[:MAX_ENTRIES], start=1))


def build_macros(
    stacks_by_scenario: dict[str, tuple[SlotStack, ...]],
    priorities: dict[str, Priority],
    hotkeys: dict[str, str] | None = None,
    delay_ms: int = 10,
    manual: frozenset[str] = frozenset(),
    sequences: dict[str, Sequence[str]] | None = None,
) -> tuple[MacroPlan, ...]:
    """Seed macros (every slot once, best first). `sequences` = {scenario key: slot labels} replaces
    a macro's entries with a searched sequence."""
    hotkeys = hotkeys or {}
    sequences = sequences or {}
    plans: list[MacroPlan] = []
    supplied = list(priorities or stacks_by_scenario or sequences)
    for name, scen_key, hk_key, default in macro_definitions(supplied):
        slots = macro_slots(stacks_by_scenario.get(scen_key, ()), priorities.get(scen_key), manual)
        if scen_key in sequences:
            seq = [lab for lab in sequences[scen_key] if lab in slots]
        else:
            seq = seed_sequences(slots)[0]
        plans.append(MacroPlan(name, hotkeys.get(hk_key) or default, _entries(seq, delay_ms)))
    return tuple(plans)
