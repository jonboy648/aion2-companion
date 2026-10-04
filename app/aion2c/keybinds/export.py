"""Keybind plan + instruction sheet. P5 owns this file.

plan() pipeline: ideal rotation sims -> never-cast skills dropped -> several stack partitions tried
(layout.STYLES) -> best one kept -> macro entry sequences hill-climbed on simulate_macro -> hybrid
(macro + hand-pressed manual skills) measured -> G-keys derived from the final slots.
"""
from __future__ import annotations

import statistics

from aion2c.engine.rotation import cooldown_of, explain_rotation
from aion2c.engine.simulator import simulate, simulate_macro  # noqa: F401  (patch targets)
from aion2c.keybinds.gkeys import gkey_layout
from aion2c.keybinds.layout import STYLES, is_manual, layout, manual_keys, slot_why
from aion2c.keybinds.macro import build_macros, macro_slots, search_entries, seed_sequences
from aion2c.models import (
    SCENARIOS,
    CharacterBuild,
    GameData,
    KeybindPlan,
    MacroEntry,
    MacroPlan,
    Priority,
    PriorityEntry,
    SimConfig,
    SkillBar,
    SlotStack,
)

_MACRO_SCENARIO = {"Boss loop": "boss_180", "AoE loop": "aoe_pack"}
_DPS_FLOOR = 0.95
HYBRID_BELOW = 0.85  # best macro under this share of ideal: recommend macro + hand presses
SEARCH_BUDGET = 300  # simulations spent on stack partitions + entry sequences, per plan


def _merged_priority(priorities: dict[str, Priority]) -> Priority:
    """One hotbar serves both macros: boss order first, then skills only the other scenarios use."""
    keys = [k for k in ("boss_180", "aoe_pack") if k in priorities] + [k for k in priorities if k not in ("boss_180", "aoe_pack")]
    seen: set[str] = set()
    entries: list[PriorityEntry] = []
    for k in keys:
        for e in priorities[k].entries:
            if e.skill_key not in seen:
                seen.add(e.skill_key)
                entries.append(PriorityEntry(e.skill_key))
    return Priority(tuple(entries), label="merged")


def _trim(pr: Priority, res) -> Priority:
    """Drop entries the ideal run never casts (they only clutter the hotbar)."""
    cast = {k for k, v in res.per_skill.items() if v.casts > 0}
    if not cast:
        return pr
    return Priority(tuple(e for e in pr.entries if e.skill_key in cast), pr.label)


def _name(gd: GameData, key: str) -> str:
    sk = gd.skills.get(key)
    return sk.name if sk is not None else key


def _macro_dps(gd, build, stacks, name, hotkey, seq, delay_ms, scen, cfg, hand=()) -> float:
    macro = MacroPlan(name, hotkey, tuple(MacroEntry(i, lab, delay_ms) for i, lab in enumerate(seq, start=1)))
    p = KeybindPlan(stacks=stacks, macros=(macro,))
    if hand:
        return simulate_macro(gd, build, p, name, scen, cfg, hand=tuple(hand)).dps
    return simulate_macro(gd, build, p, name, scen, cfg).dps


def _design(gd, build, priorities, bar, hotkeys, delay_ms, cfg, ideal, by_key, budget):
    """Pick the best stack partition, then hill-climb each macro's entries. -> (stacks, {scenario: [labels]})."""
    manual = manual_keys(gd)
    merged = _merged_priority(priorities)
    targets = [(n, k) for n, k in _MACRO_SCENARIO.items() if k in priorities and k in by_key]
    hk = {"Boss loop": (hotkeys or {}).get("boss") or "F9", "AoE loop": (hotkeys or {}).get("aoe") or "F10"}

    def filler_of(stacks):
        for st in stacks:
            last = st.stack[-1] if st.stack else None
            if last in gd.skills and not is_manual(gd, last) and cooldown_of(gd, build, last) <= 0:
                return st.key_label
        return None

    best = None
    sims = 0
    seen: list[tuple[SlotStack, ...]] = []
    for style in STYLES:
        stacks, _ = layout(gd, build, merged, bar, cfg.auto_chain, style)
        if stacks in seen:
            continue
        seen.append(stacks)
        score, seqs = 0.0, {}
        for name, scen in targets:
            slots = macro_slots(stacks, priorities[scen], manual)
            seq = seed_sequences(slots, filler_of(stacks))[0]
            seqs[scen] = seq
            dps = _macro_dps(gd, build, stacks, name, hk[name], seq, delay_ms, by_key[scen], cfg)
            sims += 1
            score += dps / ideal[scen] if ideal.get(scen) else dps
        if best is None or score > best[0] + 1e-9:
            best = (score, stacks, seqs)
    if best is None:
        stacks, _ = layout(gd, build, merged, bar, cfg.auto_chain)
        return stacks, {}
    _, stacks, seqs = best
    per = max(0, (budget - sims) // max(1, len(targets)))
    for name, scen in targets:
        slots = macro_slots(stacks, priorities[scen], manual)
        seeds = seed_sequences(slots, filler_of(stacks))

        def score(seq, name=name, scen=scen):
            return _macro_dps(gd, build, stacks, name, hk[name], seq, delay_ms, by_key[scen], cfg)

        found, _, _ = search_entries(slots, score, seeds, per, seed=0)
        if found:
            seqs[scen] = found
    return stacks, seqs


def plan(
    gd: GameData,
    build: CharacterBuild,
    priorities: dict[str, Priority],
    bar: SkillBar,
    hotkeys: dict[str, str] | None = None,
    delay_ms: int = 10,
    cfg: SimConfig = SimConfig(),
    budget: int = SEARCH_BUDGET,
) -> KeybindPlan:
    warnings: list[str] = []
    for scen_key, pr in priorities.items():
        for e in pr.entries:
            if e.require_status:
                warnings.append(
                    f"{scen_key}: '{e.skill_key}' requires status '{e.require_status}', which a macro cannot express; dropped"
                )
    by_key = {s.key: s for s in SCENARIOS}
    ideal: dict[str, float] = {}
    results = {}
    trimmed: dict[str, Priority] = {}
    rotation: dict[str, dict] = {}
    for key, pr in priorities.items():
        scen = by_key.get(key)
        if scen is None:
            trimmed[key] = pr
            continue
        res = simulate(gd, build, pr, scen, cfg)
        results[key] = res
        ideal[key] = res.dps
        trimmed[key] = _trim(pr, res)
        rotation[key] = explain_rotation(gd, build, pr, res, scen)

    stacks, seqs = _design(gd, build, trimmed, bar, hotkeys, delay_ms, cfg, ideal, by_key, budget)
    _, lay_warn = layout(gd, build, _merged_priority(trimmed), bar, cfg.auto_chain)
    warnings.extend(lay_warn)
    macros = build_macros({k: stacks for k in priorities}, trimmed, hotkeys, delay_ms, manual_keys(gd), seqs)

    # hand-pressed manual skills, best first per scenario (damage in the ideal run)
    def hand_for(scen_key: str) -> list[str]:
        res = results.get(scen_key)
        if res is None:
            return []
        man = [k for k, v in res.per_skill.items() if v.casts > 0 and is_manual(gd, k) and v.damage > 0]
        return sorted(man, key=lambda k: -res.per_skill[k].damage)

    hand = {"M1": hand_for("boss_180") or hand_for("aoe_pack"), "M2": hand_for("aoe_pack") or hand_for("boss_180")}
    gkeys, extras, thumbs = gkey_layout(bar, stacks, macros, gd, hand)
    stacks = tuple(stacks) + tuple(extras)

    manual_every: dict[str, float] = {}
    ref_key = "boss_180" if "boss_180" in results else next(iter(results), None)
    if ref_key is not None:
        res = results[ref_key]
        times: dict[str, list[float]] = {}
        for c in res.casts:
            if is_manual(gd, c.skill_key):
                times.setdefault(c.skill_key, []).append(c.t_s)
        for sk, ts in times.items():
            if len(ts) >= 2:
                manual_every[sk] = float(statistics.median(b - a for a, b in zip(ts, ts[1:])))
            elif len(ts) == 1 and res.duration_s > 0:
                manual_every[sk] = float(res.duration_s)

    base = KeybindPlan(stacks=stacks, macros=macros)
    macro_dps: dict[str, float] = {}
    hybrid: dict[str, float] = {}
    advice: dict[str, str] = {}
    for m in macros:
        key = _MACRO_SCENARIO.get(m.name)
        scen = by_key.get(key) if key else None
        if scen is None or key not in priorities:
            continue
        mres = simulate_macro(gd, build, base, m.name, scen, cfg)
        macro_dps[m.name] = mres.dps
        hands = hand_for(key)
        hybrid[m.name] = simulate_macro(gd, build, base, m.name, scen, cfg, hand=tuple(hands)).dps if hands else mres.dps
        ideal_dps = ideal.get(key, 0.0)
        if ideal_dps > 0:
            frac = mres.dps / ideal_dps
            if frac < _DPS_FLOOR:
                warnings.append(
                    f"{m.name}: macro DPS {mres.dps:.0f} is below 95% of ideal {ideal_dps:.0f} "
                    f"({frac * 100:.0f}%); some presses stay manual"
                )
            advice[m.name] = _advice(gd, m.name, mres.dps, hybrid[m.name], ideal_dps, hands, manual_every)

    slot_notes = _slot_notes(gd, build, stacks, _merged_priority(trimmed), priorities, extras)
    if cfg.auto_chain:
        warnings.append("assumes a held macro presses chain follow-up skills; unverified, test in game")
    return KeybindPlan(
        stacks=stacks,
        macros=macros,
        gkeys=gkeys,
        macro_dps=macro_dps,
        ideal_dps=ideal,
        manual_every_s=manual_every,
        warnings=tuple(warnings),
        hybrid_dps=hybrid,
        slot_notes=slot_notes,
        macro_advice=advice,
        rotation=rotation,
        thumbs=thumbs,
    )


def _advice(gd, name, macro, hybrid, ideal, hands, every) -> str:
    pct, hpct = macro / ideal * 100, hybrid / ideal * 100
    if pct >= HYBRID_BELOW * 100:
        return f"The macro alone reaches {pct:.0f}% of ideal: hold it and play. Estimates only."
    presses = ", ".join(
        f"{_name(gd, k)} about every {every[k]:.0f} s" if k in every else _name(gd, k) for k in hands
    )
    beat = (ideal / macro - 1) * 100 if macro > 0 else 0.0
    out = f"The macro alone reaches only {pct:.0f}% of ideal ({macro:.0f} of {ideal:.0f} DPS). "
    if hands:
        out += (f"Use a hybrid: hold the macro for the rotation and press {presses} by hand, "
                f"which reaches about {hpct:.0f}% of ideal. ")
    else:
        out += "Nothing in this build is tagged manual, so no hand presses can close the gap. "
    out += f"Pressing the whole rotation by hand beats the macro by {beat:.0f}%."
    return out


def _slot_notes(gd, build, stacks, merged: Priority, priorities, extras) -> dict[str, str]:
    in_rot = {e.skill_key for e in merged.entries}
    gated = frozenset(e.skill_key for p in priorities.values() for e in p.entries if e.require_status)
    extra_labels = {s.key_label for s in extras}
    notes = {}
    for st in stacks:
        if st.key_label in extra_labels:
            notes[st.key_label] = "Not part of the rotation: kept on a free key for a G-key."
        elif any(is_manual(gd, k) for k in st.stack):
            notes[st.key_label] = slot_why(gd, build, st.stack[:1], gated)
        elif not any(k in in_rot for k in st.stack):
            notes[st.key_label] = "Already on your bar; not part of the rotation, left as it was."
        else:
            notes[st.key_label] = slot_why(gd, build, st.stack, gated)
    return notes


def _slot_of(plan: KeybindPlan, *skills: str) -> str | None:
    for sk in skills:
        for st in plan.stacks:
            if sk in st.stack:
                return st.key_label
    return None


def _stack_text(plan: KeybindPlan, gd: GameData, label: str) -> str:
    for st in plan.stacks:
        if st.key_label == label:
            return " > ".join(_name(gd, k) for k in st.stack)
    return "?"


def _rotation_md(gd: GameData, ex: dict) -> list[str]:
    L = [f"### {ex.get('scenario_name', ex.get('scenario', ''))}", ""]
    if ex.get("opener"):
        L.append("**Opener** (in this order): " + " > ".join(
            f"{o['name']}" + (f" ({o['t_s']:.0f} s)" if o["t_s"] >= 1 else "") for o in ex["opener"]
        ))
        L.append("")
    if ex.get("core"):
        L.append("**Core cooldowns** (priority order):")
        L.append("")
        for c in ex["core"]:
            pct = f" ({c['damage_share_pct']:.0f}% of damage)" if c.get("damage_share_pct") else ""
            L.append(f"- {c['name']}{pct}: {c['text']}")
        L.append("")
    if ex.get("chains"):
        for ch in ex["chains"]:
            L.append(f"**Chain**: {ch['text']}")
        L.append("")
    if ex.get("filler") and ex["filler"].get("skills"):
        L.append(f"**Filler**: {ex['filler']['text']}")
        L.append("")
    if ex.get("skip"):
        L.append("**Left out**: " + "; ".join(f"{s['name']} ({s['reason']})" for s in ex["skip"]))
        L.append("")
    return L


def instructions_markdown(plan: KeybindPlan, gd: GameData) -> str:
    L: list[str] = ["# Aion 2 keybind setup sheet", ""]
    L += [
        "The app never sends input to the game. You type this in once. "
        "Every number below is a model estimate, not a measurement.",
        "",
        "## 1. Your rotation in plain words",
        "",
    ]
    if plan.rotation:
        for key in ("boss_180", "aoe_pack"):
            if key in plan.rotation:
                L += _rotation_md(gd, plan.rotation[key])
        for key, ex in plan.rotation.items():
            if key not in ("boss_180", "aoe_pack"):
                L += _rotation_md(gd, ex)
    else:
        L += ["No rotation was computed for this plan.", ""]

    L += [
        "## 2. Hotbar slots (stacked skills)",
        "",
        "A slot holds up to 4 skills. One press fires the usable skill **lowest in the stack**: the BOTTOM cell is "
        "priority 0 and fires first (confirmed by Global and Korean guides, 2026-10). To reorder in game, click a "
        "skill, then click another cell in that column to swap them. Each stack below is listed from the bottom "
        "cell up; a skill with no cooldown always goes in the TOP cell so it never blocks the others.",
        "",
        "| Slot key | Bottom cell (fires first) → top cell | Why |",
        "|---|---|---|",
    ]
    for st in plan.stacks:
        L.append(f"| {st.key_label} | " + " → ".join(_name(gd, k) for k in st.stack) + f" | {plan.slot_notes.get(st.key_label, '')} |")

    L += ["", "## 3. In-game macros", ""]
    L += [
        "Skill window (K) > Macro: create each macro below, one numbered entry per line, with the delay shown. "
        "Then Settings > Key Settings > General > Gameplay > Macro: bind Macro 1 and Macro 2 to the hotkeys. "
        "A macro runs only while its key is held down and walks its entries in order, skipping unusable ones.",
        "",
    ]
    for m in plan.macros:
        L.append(f"### {m.name} (hotkey {m.hotkey})")
        L.append("")
        if not m.entries:
            L.append("No entries (no priority was given for this scenario).")
        for e in m.entries:
            L.append(f"{e.index}. press slot {e.key_label} ({_stack_text(plan, gd, e.key_label)}), delay {e.delay_ms} ms")
        dps = plan.macro_dps.get(m.name)
        ideal = plan.ideal_dps.get(_MACRO_SCENARIO.get(m.name, ""))
        if dps is not None and ideal:
            L.append("")
            L.append(f"Estimated macro DPS {dps:.0f} vs ideal {ideal:.0f} ({dps / ideal * 100:.0f}%).")
            hyb = plan.hybrid_dps.get(m.name)
            if hyb and abs(hyb - dps) > 0.5:
                L.append(f"Macro plus your hand presses (section 4): {hyb:.0f} DPS ({hyb / ideal * 100:.0f}%).")
            if plan.macro_advice.get(m.name):
                L.append("")
                L.append(plan.macro_advice[m.name])
        L.append("")

    L += ["## 4. Manual presses", ""]
    if plan.manual_every_s:
        L.append("Press these by hand while the macro key is held (the macro never contains them):")
        L.append("")
        for sk, s in plan.manual_every_s.items():
            slot = _slot_of(plan, sk)
            L.append(f"- {_name(gd, sk)} (slot {slot or '?'}): about every {s:.0f} s")
    else:
        L.append("Nothing in this rotation needs a hand press.")
    L.append("")

    L += ["## 5. Logitech G915 G-keys and G900 (onboard memory)", ""]
    L += ["| G-key | Mode | Sends | Skills on that key | Risk |", "|---|---|---|---|---|"]
    for g in plan.gkeys:
        L.append(f"| {g.gkey} | {g.mstate} | {g.sends} | {g.purpose} | {g.risk} |")
    L += [
        "",
        "M1 is the boss layout, M2 is AoE and leveling, M3 stays free. Each G-key sends one plain key. "
        "Every row names the skills stacked on the key it sends; a skill that was not on your bar is put on a free key and says so.",
        "",
        "### G HUB steps",
        "",
        "1. Open G HUB, select the keyboard, switch to Onboard Memory Mode.",
        "2. Assignments > open the **Keys** tab (single keystroke), not Macro. Never use MR on-the-fly recording: it records a timed macro.",
        "3. Assign each G-key above in M1 and M2. G1 must send its key as a held key (down on press, up on release), "
        "or the in-game macro runs once instead of looping.",
        "4. Save to the keyboard. Close G HUB completely, including the tray icon.",
        "5. Open Task Manager and confirm no `lghub` processes remain (`lghub_agent`, `lghub_updater`). End them if present.",
        "6. In game, optionally turn off quickslot long-press input and aim target hold (unverified tip).",
        "7. Launch the game. Test once: hold G1 and watch whether the macro keeps looping; if not, press the hotkey directly.",
        "",
        "### G900 (optional)",
        "",
        "Same rules: onboard memory, each button sends ONE plain key, no macros. "
        "Spare buttons: 4 side buttons (2 per side), 2 DPI buttons if you give up DPI switching, wheel tilt left and right.",
        "",
    ]
    thumbs = plan.thumbs or (("Side button 1", "dodge key", "Dodge: the dodge key from Key Settings"),)
    for btn, sends, text in thumbs:
        L.append(f"- {btn}: sends {sends} ({text})")
    L += [
        "",
        "A 1:1 remap is not a macro, but no source confirms that distinction. Risk label: lowest_known.",
        "",
        "### Risk and open questions",
        "",
        "- No official statement exists for key remapping on onboard memory. The risk is lowest known, not zero, and unverified.",
        "- Hardware or software macros (G HUB macros, scripting, AHK) are against the rules; this plan uses none.",
        "- Overlay and screen readers are not covered by any source found: unverified.",
        "- Whether a held macro triggers chain follow-ups, and the real entry limit per macro, are unverified: test in game.",
    ]
    if plan.warnings:
        L += ["", "## Warnings", ""] + [f"- {w}" for w in plan.warnings]
    return "\n".join(L) + "\n"
