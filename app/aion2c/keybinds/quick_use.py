"""Quick Use identities from the exported InputKeyMapping and QuickSlotData.

Bindings are client defaults, not the player's settings. Export patch version
has not been verified; physical action identity is independent of its binding.
"""
from dataclasses import dataclass
import json
from pathlib import Path

from aion2c.models import CharacterBuild, GameData, KeybindPlan, MacroEntry, MacroPlan, Priority, SkillBar, SlotStack
from aion2c.keybinds.layout import castable_bar, is_manual
from aion2c.keybinds.macro import macro_definitions
from aion2c.progression import stigma_slots_at, stigma_unlock


@dataclass(frozen=True)
class QuickUseAction:
    id: int
    slot_id: int
    binding: str
    alternate_bindings: tuple[str, ...]
    default_skill: str | None
    context_skills: tuple[str, ...]
    slot_editable: bool
    context_editable: bool


def quick_use_actions(gd: GameData, bindings: dict | None = None) -> tuple[QuickUseAction, ...]:
    data = json.loads(Path(__file__).parents[1].joinpath("data/client_quick_use.json").read_text(encoding="utf-8"))
    skills = {skill.skill_id: skill.key for skill in gd.skills.values()}
    contexts = data["classes"].get(gd.class_key, {})
    out = []
    for action in data["actions"]:
        context = contexts.get(str(action["slot_id"]), {})
        custom = (bindings or {}).get(str(action["id"]))
        binding = custom.strip() if isinstance(custom, str) and custom.strip() and len(custom) <= 24 else action["bindings"][0]
        out.append(QuickUseAction(action["id"], action["slot_id"], binding, tuple(action["bindings"][1:]),
            skills.get(context.get("default_skill_id")),
            tuple(skills[id] for id in context.get("context_skill_ids", []) if id in skills),
            action["slot_editable"], context.get("context_editable", False)))
    return tuple(out)


def native_plan(gd: GameData, build: CharacterBuild, bindings: dict | None = None, pins: dict | None = None,
                priorities: dict[str, Priority] | None = None, hotkeys: dict | None = None, delay_ms: int = 10) -> KeybindPlan:
    actions = quick_use_actions(gd, bindings)
    defaults = {str(action.id): action.default_skill for action in actions if action.default_skill}
    count = stigma_slots_at(gd, build.region, build.level) if stigma_unlock(gd, build).unlocked else 0
    stigmas = sorted(key for key in build.stigmas if build.skill_ranks.get(key, 0) > 0)[:count]
    defaults.update({str(i): key for i, key in zip(range(9, 13), stigmas)})
    available, warnings = castable_bar(gd, build, SkillBar(defaults))
    binding_groups = {}
    for action in actions:
        binding_groups.setdefault(action.binding.casefold(), []).append(action.id)
    conflicts = {id for ids in binding_groups.values() if len(ids) > 1 for id in ids}
    for binding, ids in binding_groups.items():
        if len(ids) > 1:
            warnings.append(f"Binding conflict: {binding} is assigned to Quick Use {', '.join(map(str, ids))}; excluded from macros")
    available = SkillBar({label: key for label, key in available.slots.items() if build.skill_ranks.get(key, 0) > 0
                         and gd.skills[key].kind not in ("chain", "proc")})
    proposed, pin_warnings = castable_bar(gd, build, SkillBar(dict(pins or {})))
    warnings.extend(pin_warnings)
    slots = dict(available.slots)
    for label, key in proposed.slots.items():
        action = next((a for a in actions if str(a.id) == label), None)
        if action is None:
            warnings.append(f"Unknown Quick Use action {label}; pin ignored")
        elif not action.context_editable:
            warnings.append(f"Quick Use {label} is fixed in the class context table; pin ignored")
        elif action.id >= 9 and action.id - 8 > count:
            warnings.append(f"Quick Use {label} is locked; pin ignored")
        elif build.skill_ranks.get(key, 0) <= 0 or gd.skills[key].kind in ("chain", "proc"):
            warnings.append(f"Quick Use {label}: {key} is not acquired; pin ignored")
        else:
            slots = {l: skill for l, skill in slots.items() if skill != key}
            slots[label] = key
            warnings.append(f"Quick Use {label}: custom placement needs confirmation in game; table editability flags differ")
    stacks = tuple(SlotStack(action.binding, (slots[str(action.id)],)
                            if str(action.id) in slots else (), action.id) for action in actions)
    try:
        delay = max(10, min(9900, int(delay_ms)))
    except (TypeError, ValueError, OverflowError):
        delay = 10
    macros = []
    for name, scenario, hotkey, fallback in macro_definitions(tuple(priorities or {})):
        priority = (priorities or {}).get(scenario)
        entries = []
        eligible = {entry.skill_key for entry in priority.entries if not entry.require_status} if priority else None
        for stack in stacks:
            if stack.quick_use_id in conflicts:
                continue
            if not stack.stack or (eligible is not None and not any(key in eligible for key in stack.stack)):
                continue
            if any(is_manual(gd, key) for key in stack.stack):
                continue
            entries.append(MacroEntry(len(entries) + 1, stack.key_label, delay, stack.quick_use_id))
            if len(entries) == 20:
                break
        key = (hotkeys or {}).get(hotkey, fallback)
        macros.append(MacroPlan(name, key if isinstance(key, str) and 0 < len(key) <= 24 else fallback, tuple(entries)))
    return KeybindPlan(stacks=stacks, macros=tuple(macros), warnings=tuple(warnings))


def instructions_markdown(plan: KeybindPlan, gd: GameData, bindings: dict | None = None) -> str:
    lines = ["# Aion 2 Quick Use setup", "",
        "Client-table setup; queue runtime behavior is unverified. This site does not send input to the game.", "",
        "## Bindings", "", "| Action | Physical slot | Binding | Assigned skill |", "| --- | --- | --- | --- |"]
    def cell(value):
        return str(value).replace("|", "\\|").replace("\n", " ").replace("\r", " ")
    for action, stack in zip(quick_use_actions(gd, bindings), plan.stacks):
        skill = ", ".join(gd.skills[k].name for k in stack.stack)
        lines.append(f"| Quick Use {action.id} | {action.slot_id} | {cell(action.binding)} | {cell(skill) or 'Unassigned'} |")
    lines += ["", "## Macro limits", "", "- Maximum 20 entries; delay 10-9900 ms.",
        "- Hold the macro key to attempt its entries; order is not guaranteed.",
        "- Your manual inputs take priority over macro attempts.",
        "- Check Skill Queue in the game's control settings. Queue capacity, retries and replacement behavior remain unverified.",
        "- Mouse bindings cannot be used in macros in AION 1 control mode; confirm your control mode in game.",
        "- Entries below are setup candidates, not a verified rotation or DPS prediction.",
        "- Numbering records configured entries, not runtime execution order; entries are listed by Quick Use identity."]
    for macro in plan.macros:
        lines += ["", f"## {macro.name}", "", f"Hold key: {cell(macro.hotkey)}", ""]
        for entry in macro.entries:
            lines.append(f"{entry.index}. Quick Use {entry.quick_use_id} ({cell(entry.key_label)}), delay {entry.delay_ms} ms")
    lines += ["", "## Placement", "", "Class context skills are alternatives, not confirmed four-row stack assignments.",
        "Custom moves need an in-game check where the client tables' editability flags differ."]
    return "\n".join(lines) + "\n"
