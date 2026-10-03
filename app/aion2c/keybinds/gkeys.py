"""G915 G-key plan. P5 owns this file.

Onboard memory, every G-key sends exactly ONE plain key (no modifiers, no sequences, no repeat).
G1 must be set to send its key as a HELD key; the in-game macro only loops while the key is down.
Risk is never "safe": no official statement exists for 1:1 remaps.
"""
from __future__ import annotations

import re

from aion2c.models import KEY_LABELS, GameData, GKeyAssignment, MacroPlan, SkillBar, SlotStack

SINGLE_KEY = re.compile(r"^(F([1-9]|1[0-2])|[0-9A-Z]|[-=])$")

def _plan(gd: GameData | None) -> list[tuple[str, str, tuple[str, ...], str]]:
    """(gkey, mstate, candidate skill keys, purpose) from the class data: a skill tagged
    `gkey:G2:M1:0` is candidate 0 for G2 in M1 (lower number is preferred)."""
    rows: dict[tuple[str, str], list[tuple[int, str]]] = {}
    for key, sk in (gd.skills.items() if gd else ()):
        for tag in sk.tags:
            if tag.startswith("gkey:"):
                _, g, m, pri = tag.split(":")
                rows.setdefault((g, m), []).append((int(pri), key))
    out = []
    for (g, m), cands in sorted(rows.items()):
        keys = tuple(k for _, k in sorted(cands))
        out.append((g, m, keys, " > ".join(gd.skills[k].name for k in keys)))
    return out


def _slot_for(skills: tuple[str, ...], bar: SkillBar, stacks: tuple[SlotStack, ...]) -> str | None:
    for sk in skills:
        for st in stacks:
            if sk in st.stack and SINGLE_KEY.match(st.key_label):
                return st.key_label
        for lab in KEY_LABELS:
            if bar.slots.get(lab) == sk:
                return lab
    return None


def gkey_plan(
    bar: SkillBar, stacks: tuple[SlotStack, ...], macros: tuple[MacroPlan, ...], gd: GameData | None = None
) -> tuple[GKeyAssignment, ...]:
    """G1 always carries the two macro hotkeys; G2-G5 come from the class data's `gkey:` tags (none without `gd`)."""
    hotkeys = []
    for i, default in enumerate(("F9", "F10")):
        hk = macros[i].hotkey if i < len(macros) else default
        hotkeys.append(hk if SINGLE_KEY.match(hk) else default)
    names = [macros[i].name if i < len(macros) else n for i, n in enumerate(("Boss loop", "AoE loop"))]

    used = {st.key_label for st in stacks} | {lab for lab in KEY_LABELS if bar.slots.get(lab)} | set(hotkeys)
    spare = [lab for lab in KEY_LABELS if lab not in used]
    spare.sort(key=lambda s: (not s.isdigit() and s not in "-=", s))  # digits and -,= first, then letters

    out: list[GKeyAssignment] = []
    for m, (hk, nm) in enumerate(zip(hotkeys, names)):
        out.append(GKeyAssignment(
            "G1", "M1" if m == 0 else "M2", hk,
            f"Hold = in-game macro '{nm}' (Key Settings > Macro {m + 1} = {hk}); send as a held key",
            "lowest_known",
        ))
    for gkey, mstate, cands, purpose in _plan(gd):
        lab = _slot_for(cands, bar, stacks)
        if lab is not None:
            out.append(GKeyAssignment(gkey, mstate, lab, purpose, "lowest_known"))
        else:
            lab = spare.pop(0) if spare else "="
            out.append(GKeyAssignment(
                gkey, mstate, lab, f"{purpose}: skill not on your bar, put it on key {lab} and bind it", "caution"
            ))
    order = {g: i for i, g in enumerate(("G1", "G2", "G3", "G4", "G5"))}
    out.sort(key=lambda a: (order[a.gkey], a.mstate))
    return tuple(out)
