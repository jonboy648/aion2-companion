"""G915 G-key plan. P5 owns this file.

Onboard memory, every G-key sends exactly ONE plain key (no modifiers, no sequences, no repeat).
G1 must be set to send its key as a HELD key; the in-game macro only loops while the key is down.
Risk is never "safe": no official statement exists for 1:1 remaps.

G2-G5 are derived from the computed slots: first the skills the player presses by hand (the manual
list, best first), then the class data's `gkey:` tags as preferences. A row always sends the key of a
real slot and its description names exactly the skills stacked on that key. A wanted skill with no
slot is put on a free bar key (returned as an extra single-skill stack) and the row says so.
"""
from __future__ import annotations

import re

from aion2c.models import KEY_LABELS, GameData, GKeyAssignment, MacroPlan, SkillBar, SlotStack

SINGLE_KEY = re.compile(r"^(F([1-9]|1[0-2])|[0-9A-Z]|[-=])$")
ROWS = ("G2", "G3", "G4", "G5")


def _tag_targets(gd: GameData | None) -> dict[str, list[tuple[str, ...]]]:
    """{mstate: [candidate skill keys, in the order of the data's G-key rows]} from `gkey:G2:M1:0` tags
    (a lower number is preferred). Only used to pick WHICH skills deserve a G-key."""
    rows: dict[tuple[str, str], list[tuple[int, str]]] = {}
    for key, sk in (gd.skills.items() if gd else ()):
        for tag in sk.tags:
            if tag.startswith("gkey:"):
                _, g, m, pri = tag.split(":")
                rows.setdefault((m, g), []).append((int(pri), key))
    out: dict[str, list[tuple[str, ...]]] = {}
    for (m, _g), cands in sorted(rows.items()):
        out.setdefault(m, []).append(tuple(k for _, k in sorted(cands)))
    return out


def _slot_for(skills: tuple[str, ...], bar: SkillBar, stacks: tuple[SlotStack, ...]) -> tuple[str, str] | None:
    """(key label, skill key) for the first skill that already sits on a usable key."""
    for sk in skills:
        for st in stacks:
            if sk in st.stack and SINGLE_KEY.match(st.key_label):
                return st.key_label, sk
        for lab in KEY_LABELS:
            if bar.slots.get(lab) == sk:
                return lab, sk
    return None


def describe_slot(gd: GameData | None, stacks: tuple[SlotStack, ...], label: str, fallback: str = "") -> str:
    """Names of exactly the skills stacked on `label`, in firing order (bottom cell first)."""
    for st in stacks:
        if st.key_label == label:
            return " > ".join((gd.skills[k].name if gd and k in gd.skills else k) for k in st.stack)
    return fallback


def _hotkeys(macros: tuple[MacroPlan, ...]) -> tuple[list[str], list[str]]:
    hotkeys = []
    for i, default in enumerate(("F9", "F10")):
        hk = macros[i].hotkey if i < len(macros) else default
        hotkeys.append(hk if SINGLE_KEY.match(hk) else default)
    names = [macros[i].name if i < len(macros) else n for i, n in enumerate(("Boss loop", "AoE loop"))]
    return hotkeys, names


def gkey_layout(
    bar: SkillBar,
    stacks: tuple[SlotStack, ...],
    macros: tuple[MacroPlan, ...],
    gd: GameData | None = None,
    hand: dict[str, list[str]] | None = None,
) -> tuple[tuple[GKeyAssignment, ...], tuple[SlotStack, ...], tuple[tuple[str, str, str], ...]]:
    """(G915 rows, extra single-skill stacks the plan must add, G900 thumb rows (button, sends, text)).

    `hand` = {"M1": [skill keys pressed by hand in the boss loop, best first], "M2": [...]}."""
    hotkeys, names = _hotkeys(macros)
    used = {st.key_label for st in stacks} | {lab for lab in KEY_LABELS if bar.slots.get(lab)} | set(hotkeys)
    spare = [lab for lab in KEY_LABELS if lab not in used]
    # KEY_LABELS order already puts 1-9, 0, -, = before the letters
    extras: list[SlotStack] = []

    def name(k: str) -> str:
        return gd.skills[k].name if gd and k in gd.skills else k

    def resolve(cands: tuple[str, ...]) -> tuple[str, str, bool]:
        """(label, description, placed_on_free_key). Extends `extras` when a skill had no key."""
        cur = tuple(stacks) + tuple(extras)
        got = _slot_for(cands, bar, cur)
        if got is not None:
            lab, sk = got
            if any(e.key_label == lab for e in extras):  # key we invented earlier: keep saying so
                return lab, f"{name(sk)}: not on your bar, put it on free key {lab} and bind it", True
            return lab, describe_slot(gd, cur, lab, name(sk)), False
        lab = spare.pop(0) if spare else "="
        extras.append(SlotStack(lab, (cands[0],)))
        return lab, f"{name(cands[0])}: not on your bar, put it on free key {lab} and bind it", True

    out: list[GKeyAssignment] = []
    for m, (hk, nm) in enumerate(zip(hotkeys, names)):
        out.append(GKeyAssignment(
            "G1", "M1" if m == 0 else "M2", hk,
            f"Hold = in-game macro '{nm}' (Key Settings > Macro {m + 1} = {hk}); send as a held key",
            "lowest_known",
        ))
    tags = _tag_targets(gd)
    for mstate in ("M1", "M2"):
        wanted = [(k,) for k in (hand or {}).get(mstate, [])] + tags.get(mstate, [])
        taken: set[str] = set()
        row = 0
        for cands in wanted:
            if row >= len(ROWS):
                break
            lab, text, placed = resolve(cands)
            if lab in taken:
                continue
            taken.add(lab)
            by_hand = cands[0] in (hand or {}).get(mstate, [])
            if by_hand and not placed:
                text += " (press by hand)"
            out.append(GKeyAssignment(ROWS[row], mstate, lab, text, "caution" if placed else "lowest_known"))
            row += 1

    thumbs: list[tuple[str, str, str]] = []
    for n in (1, 2):
        keys = tuple(k for k, s in (gd.skills.items() if gd else ()) if f"thumb:{n}" in s.tags)
        if keys:
            lab, text, _placed = resolve(keys)
            thumbs.append((f"Side button {n}", lab, text))
    thumbs.append((f"Side button {len(thumbs) + 1}", "dodge key", "Dodge: the dodge key from Key Settings"))

    order = {g: i for i, g in enumerate(("G1", "G2", "G3", "G4", "G5"))}
    out.sort(key=lambda a: (order[a.gkey], a.mstate))
    return tuple(out), tuple(extras), tuple(thumbs)


def gkey_plan(
    bar: SkillBar,
    stacks: tuple[SlotStack, ...],
    macros: tuple[MacroPlan, ...],
    gd: GameData | None = None,
    hand: dict[str, list[str]] | None = None,
) -> tuple[GKeyAssignment, ...]:
    """G1 always carries the two macro hotkeys; G2-G5 are derived from the slots (see module doc)."""
    return gkey_layout(bar, stacks, macros, gd, hand)[0]
