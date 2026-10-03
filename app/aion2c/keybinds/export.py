"""Keybind plan + instruction sheet. P5 owns this file."""
from __future__ import annotations

import statistics

from aion2c.engine.simulator import simulate, simulate_macro  # noqa: F401  (patch targets)
from aion2c.keybinds.gkeys import gkey_plan
from aion2c.keybinds.layout import is_manual, layout, manual_keys
from aion2c.keybinds.macro import build_macros
from aion2c.models import (
    SCENARIOS,
    CharacterBuild,
    GameData,
    KeybindPlan,
    Priority,
    PriorityEntry,
    SimConfig,
    SkillBar,
)

_MACRO_SCENARIO = {"Boss loop": "boss_180", "AoE loop": "aoe_pack"}
_DPS_FLOOR = 0.95


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


def plan(
    gd: GameData,
    build: CharacterBuild,
    priorities: dict[str, Priority],
    bar: SkillBar,
    hotkeys: dict[str, str] | None = None,
    delay_ms: int = 10,
    cfg: SimConfig = SimConfig(),
) -> KeybindPlan:
    warnings: list[str] = []
    for scen_key, pr in priorities.items():
        for e in pr.entries:
            if e.require_status:
                warnings.append(
                    f"{scen_key}: '{e.skill_key}' requires status '{e.require_status}', which a macro cannot express; dropped"
                )
    stacks, lay_warn = layout(gd, build, _merged_priority(priorities), bar, cfg.auto_chain)
    warnings.extend(lay_warn)
    macros = build_macros({k: stacks for k in priorities}, priorities, hotkeys, delay_ms, manual_keys(gd))
    gkeys = gkey_plan(bar, stacks, macros, gd)
    base = KeybindPlan(stacks=stacks, macros=macros, gkeys=gkeys)

    by_key = {s.key: s for s in SCENARIOS}
    ideal: dict[str, float] = {}
    macro_dps: dict[str, float] = {}
    results = {}
    for key, pr in priorities.items():
        scen = by_key.get(key)
        if scen is None:
            continue
        res = simulate(gd, build, pr, scen, cfg)
        results[key] = res
        ideal[key] = res.dps
    for m in macros:
        key = _MACRO_SCENARIO.get(m.name)
        scen = by_key.get(key) if key else None
        if scen is None or key not in priorities:
            continue
        mres = simulate_macro(gd, build, base, m.name, scen, cfg)
        macro_dps[m.name] = mres.dps
        if key in ideal and ideal[key] > 0 and mres.dps < _DPS_FLOOR * ideal[key]:
            warnings.append(
                f"{m.name}: macro DPS {mres.dps:.0f} is below 95% of ideal {ideal[key]:.0f} "
                f"({mres.dps / ideal[key] * 100:.0f}%); some presses stay manual"
            )

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
    )


def _name(gd: GameData, key: str) -> str:
    sk = gd.skills.get(key)
    return sk.name if sk is not None else key


def _slot_of(plan: KeybindPlan, *skills: str) -> str | None:
    for sk in skills:
        for st in plan.stacks:
            if sk in st.stack:
                return st.key_label
    return None


def instructions_markdown(plan: KeybindPlan, gd: GameData) -> str:
    L: list[str] = ["# Aion 2 keybind setup sheet", ""]
    L += [
        "The app never sends input to the game. You type this in once. "
        "Every number below is a model estimate, not a measurement.",
        "",
        "## 1. Hotbar slots (stacked skills)",
        "",
        "A slot holds up to 4 skills; one press fires the first usable one, top row first.",
        "",
        "| Slot key | Skills (top row first) |",
        "|---|---|",
    ]
    for st in plan.stacks:
        L.append(f"| {st.key_label} | " + " > ".join(_name(gd, k) for k in st.stack) + " |")

    L += ["", "## 2. In-game macros", ""]
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
            L.append(f"{e.index}. press slot {e.key_label}, delay {e.delay_ms} ms")
        dps = plan.macro_dps.get(m.name)
        ideal = plan.ideal_dps.get(_MACRO_SCENARIO.get(m.name, ""))
        if dps is not None and ideal:
            L.append("")
            L.append(f"Estimated macro DPS {dps:.0f} vs ideal {ideal:.0f} ({dps / ideal * 100:.0f}%).")
        L.append("")
    if plan.manual_every_s:
        L.append("Press by hand (not in any macro):")
        L.append("")
        for sk, s in plan.manual_every_s.items():
            slot = _slot_of(plan, sk)
            L.append(f"- {_name(gd, sk)} (slot {slot or '?'}): about every {s:.0f} s")
        L.append("")

    L += ["## 3. Logitech G915 G-keys (onboard memory)", ""]
    L += ["| G-key | Mode | Sends | Purpose | Risk |", "|---|---|---|---|---|"]
    for g in plan.gkeys:
        L.append(f"| {g.gkey} | {g.mstate} | {g.sends} | {g.purpose} | {g.risk} |")
    L += [
        "",
        "M1 is the boss layout, M2 is AoE and leveling, M3 stays free. Each G-key sends one plain key.",
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
        "## 4. G900 (optional)",
        "",
        "Same rules: onboard memory, each button sends ONE plain key, no macros. "
        "Spare buttons: 4 side buttons (2 per side), 2 DPI buttons if you give up DPI switching, wheel tilt left and right.",
        "",
    ]
    thumbs = []  # skills tagged `thumb:N` in the class data go on side button N
    for n in (1, 2):
        keys = [k for k, s in gd.skills.items() if f"thumb:{n}" in s.tags]
        if keys:
            thumbs.append((f"Side button {n}", " / ".join(_name(gd, k) for k in keys), _slot_of(plan, *keys)))
    thumbs.append((f"Side button {len(thumbs) + 1}", "Dodge", None))
    for btn, label, slot in thumbs:
        L.append(f"- {btn}: {label} -> " + (f"key {slot}" if slot else "your dodge key from Key Settings"))
    L += [
        "",
        "A 1:1 remap is not a macro, but no source confirms that distinction. Risk label: lowest_known.",
        "",
        "## 5. Risk and open questions",
        "",
        "- No official statement exists for key remapping on onboard memory. The risk is lowest known, not zero, and unverified.",
        "- Hardware or software macros (G HUB macros, scripting, AHK) are against the rules; this plan uses none.",
        "- Overlay and screen readers are not covered by any source found: unverified.",
        "- Whether a held macro triggers chain follow-ups, and the real entry limit per macro, are unverified: test in game.",
    ]
    if plan.warnings:
        L += ["", "## Warnings", ""] + [f"- {w}" for w in plan.warnings]
    return "\n".join(L) + "\n"
