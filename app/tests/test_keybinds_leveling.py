from dataclasses import replace

import pytest

from aion2c.keybinds import export as kb
from aion2c.keybinds.layout import STYLES, castable_bar, layout, manual_keys, slot_why
from aion2c.keybinds.macro import MAX_ENTRIES, build_macros, search_entries
from aion2c.models import SCENARIOS, CastEvent, Priority, PriorityEntry, SkillBar, SkillKind, SkillTally, SlotStack
from aion2c.testing.fakes import fake_sim_result


def pr(*keys):
    return Priority(tuple(PriorityEntry(key) for key in keys))


@pytest.mark.parametrize("scenario_key,name,hotkey_key,default", [
    ("boss_180", "Boss loop", "boss", "F9"),
    ("aoe_pack", "AoE loop", "aoe", "F10"),
    ("level_pull", "Leveling loop", "leveling", "F11"),
])
def test_single_macro_default_custom_hotkey_and_manual_exclusion(scenario_key, name, hotkey_key, default):
    stacks = (SlotStack("1", ("filler",)), SlotStack("2", ("manual",)), SlotStack("3", ("damage", "manual")))
    priorities = {scenario_key: pr("manual", "damage", "filler")}
    for hotkeys, expected in ((None, default), ({hotkey_key: "F6"}, "F6")):
        macros = build_macros({key: stacks for key in ("boss_180", "aoe_pack", "level_pull")}, priorities, hotkeys, manual=frozenset({"manual"}))
        assert len(macros) == 1
        assert (macros[0].name, macros[0].hotkey) == (name, expected)
        assert [entry.key_label for entry in macros[0].entries] == ["1"]


def test_leveling_searched_entries_are_bounded_and_cannot_include_manual_or_unknown_slots():
    stacks = (SlotStack("1", ("filler",)), SlotStack("2", ("manual",)))
    macro = build_macros(
        {"level_pull": stacks}, {"level_pull": pr("filler", "manual")}, delay_ms=35,
        manual=frozenset({"manual"}), sequences={"level_pull": ["2", "unknown", "1"] * 30},
    )[0]
    assert len(macro.entries) == MAX_ENTRIES
    assert [entry.index for entry in macro.entries] == list(range(1, MAX_ENTRIES + 1))
    assert all(entry.key_label == "1" and entry.delay_ms == 35 for entry in macro.entries)


@pytest.mark.parametrize("budget", [0, 1, 2, 10])
def test_entry_search_respects_budget_and_entry_limit(budget):
    calls = []

    def score(seq):
        calls.append(seq)
        return float(len(seq))

    sequence, _, used = search_entries(["1", "2"], score, [["1"] * 30, ["2"], ["1", "2"]], budget)
    assert len(calls) == used <= budget
    assert 0 < len(sequence) <= MAX_ENTRIES
    assert set(sequence) <= {"1", "2"}


@pytest.mark.parametrize("scenarios", [[], ["boss_180", "aoe_pack"]])
def test_import_and_empty_requests_keep_both_macros(scenarios):
    macros = build_macros({}, {key: pr() for key in scenarios})
    assert [(macro.name, macro.hotkey) for macro in macros] == [("Boss loop", "F9"), ("AoE loop", "F10")]


def test_mixed_request_emits_only_supplied_scenarios():
    macros = build_macros({}, {"boss_180": pr(), "level_pull": pr()})
    assert [macro.name for macro in macros] == ["Boss loop", "Leveling loop"]


@pytest.mark.parametrize("scenario_key,name,hotkey", [
    ("boss_180", "Boss loop", "F9"), ("aoe_pack", "AoE loop", "F10"), ("level_pull", "Leveling loop", "F11"),
])
@pytest.mark.parametrize("budget", [0, 1, 12])
def test_single_scenario_plan_uses_its_scenario_for_estimates_rotation_and_hands(
    sorc_gd, default_build, monkeypatch, budget, scenario_key, name, hotkey,
):
    scenario = next(scenario for scenario in SCENARIOS if scenario.key == scenario_key)
    ideal = replace(
        fake_sim_result(2000), duration_s=scenario.duration_s,
        casts=(CastEvent(1, "hellfire", 0, 500, 2000, ()), CastEvent(8, "hellfire", 0, 500, 2000, ())),
        per_skill={"hellfire": SkillTally(2, 1000), "flame-arrow": SkillTally(4, 5000)},
    )
    macro_calls = []

    def simulate(gd, build, priority, scen, cfg):
        assert scen == scenario
        return ideal

    def simulate_macro(gd, build, plan, macro_name, scen, cfg, hand=()):
        assert scen == scenario and macro_name == name
        macro_calls.append(hand)
        assert hand in ((), ("hellfire",))
        return fake_sim_result(1500 if hand else 1000)

    monkeypatch.setattr(kb, "simulate", simulate)
    monkeypatch.setattr(kb, "simulate_macro", simulate_macro)
    result = kb.plan(sorc_gd, default_build, {scenario_key: pr("hellfire", "flame-arrow")}, SkillBar(), budget=budget)
    assert [macro.name for macro in result.macros] == [name]
    assert result.macros[0].hotkey == hotkey and 0 < len(result.macros[0].entries) <= MAX_ENTRIES
    assert result.ideal_dps == {scenario_key: 2000}
    assert result.macro_dps == {name: 1000}
    assert result.hybrid_dps == {name: 1500}
    assert set(result.rotation) == {scenario_key}
    assert result.rotation[scenario_key]["scenario"] == scenario_key
    assert result.manual_every_s == {"hellfire": 7}
    assert "Hellfire" in result.macro_advice[name]
    assert len(macro_calls) <= budget + 2  # Final macro/hybrid estimates are outside the search budget.
    by_label = {stack.key_label: stack.stack for stack in result.stacks}
    assert all("hellfire" not in by_label[entry.key_label] for entry in result.macros[0].entries)
    holds = [assignment for assignment in result.gkeys if assignment.gkey == "G1"]
    assert len(holds) == 2 and all(
        assignment.sends == hotkey and name in assignment.purpose and f"Macro 1 = {hotkey}" in assignment.purpose
        for assignment in holds
    )
    for mode in ("M1", "M2"):
        assert any("Hellfire" in assignment.purpose and "press by hand" in assignment.purpose
                   for assignment in result.gkeys if assignment.mstate == mode)
    sheet = kb.instructions_markdown(result, sorc_gd)
    assert f"### {name} (hotkey {hotkey})" in sheet
    assert f"M1 and M2 both hold the {name}" in sheet
    assert "Estimated macro DPS 1000 vs ideal 2000 (50%)." in sheet
    assert all(other not in sheet for other in ("Boss loop", "AoE loop", "Leveling loop") if other != name)


def test_real_leveling_plan_matches_simulator(sorc_gd, default_build):
    from aion2c.engine.simulator import simulate, simulate_macro

    scenario = next(scenario for scenario in SCENARIOS if scenario.key == "level_pull")
    priority = pr("hellfire", "firestorm", "flame-arrow")
    result = kb.plan(sorc_gd, default_build, {"level_pull": priority}, SkillBar(), budget=12)
    assert result.ideal_dps["level_pull"] == pytest.approx(simulate(sorc_gd, default_build, priority, scenario).dps)
    assert result.macro_dps["Leveling loop"] == pytest.approx(
        simulate_macro(sorc_gd, default_build, result, "Leveling loop", scenario).dps,
    )
    assert result.macro_dps["Leveling loop"] > 0


def test_layout_drops_locked_unknown_and_unequipped_stigma_pins(sorc_gd, default_build):
    locked = replace(sorc_gd.skills["hellfire"], unlock_level=45)
    gd = replace(sorc_gd, skills={**sorc_gd.skills, "hellfire": locked})
    build = replace(default_build, level=10, stigmas=())
    bar = SkillBar(slots={"Q": "hellfire", "W": "element-enhancement", "E": "missing", "1": "flame-arrow"})
    stacks, warnings = layout(gd, build, pr("flame-arrow"), bar)
    assert {key for stack in stacks for key in stack.stack} == {"flame-arrow"}
    assert any(stack.key_label == "1" for stack in stacks)
    assert all(any(f"pin {label}:" in warning for warning in warnings) for label in ("Q", "W", "E"))
    assert bar.slots["Q"] == "hellfire"  # Persisted user preferences remain intact.


def test_layout_keeps_equipped_stigma_pin(sorc_gd, default_build):
    build = replace(default_build, stigmas=("element-enhancement",))
    stacks, warnings = layout(sorc_gd, build, pr(), SkillBar(slots={"Q": "element-enhancement"}))
    assert stacks == (SlotStack("Q", ("element-enhancement",)),)
    assert not warnings


@pytest.mark.parametrize("scenarios", [("boss_180",), ("aoe_pack",), ("level_pull",), ("boss_180", "aoe_pack")])
@pytest.mark.parametrize("pinned", [False, True])
def test_all_plans_gkeys_do_not_resurrect_unavailable_utilities(sorc_gd, default_build, fake_sim, scenarios, pinned):
    fake_sim("aion2c.keybinds.export.simulate", "aion2c.keybinds.export.simulate_macro")
    locked = replace(sorc_gd.skills["hellfire"], unlock_level=45)
    gd = replace(sorc_gd, skills={**sorc_gd.skills, "hellfire": locked})
    result = kb.plan(
        gd, replace(default_build, level=10, stigmas=()), {scenario: pr("flame-arrow") for scenario in scenarios},
        SkillBar(slots={"Q": "hellfire", "W": "steel-barrier"} if pinned else {}), budget=0,
    )
    bound = {stack.key_label: stack.stack for stack in result.stacks}
    assert all(key not in {"hellfire", "steel-barrier"} for stack in bound.values() for key in stack)
    assert all(assignment.gkey == "G1" or assignment.sends in bound for assignment in result.gkeys)


@pytest.mark.parametrize("equipped", [False, True])
def test_legacy_bar_pins_follow_stigma_equipment_without_mutating_preferences(
    sorc_gd, default_build, sorc_bar, equipped,
):
    from aion2c.keybinds.gkeys import gkey_layout

    stigmas = ("element-enhancement", "steel-barrier")
    build = replace(default_build, stigmas=stigmas if equipped else ())
    saved_slots = dict(sorc_bar.slots)
    stacks, warnings = layout(sorc_gd, build, pr("hellfire", "flame-arrow"), sorc_bar)
    by_label = {stack.key_label: stack.stack for stack in stacks}
    filtered_bar, _ = castable_bar(sorc_gd, build, sorc_bar)
    if equipped:
        assert by_label["5"] == ("element-enhancement",)
        assert by_label["7"] == ("steel-barrier",)
        assert filtered_bar.slots == saved_slots
        assert not any("not an equipped stigma" in warning for warning in warnings)
    else:
        assert all(key not in stigmas for stack in stacks for key in stack.stack)
        assert all(key not in stigmas for key in filtered_bar.slots.values())
        assert sum("not an equipped stigma" in warning for warning in warnings) == 2
    macros = build_macros({"boss_180": stacks}, {"boss_180": pr("hellfire", "flame-arrow")})
    rows, extras, thumbs = gkey_layout(filtered_bar, stacks, macros, sorc_gd)
    bound = {stack.key_label for stack in (*stacks, *extras)}
    assert all(row.gkey == "G1" or row.sends in bound for row in rows)
    assert all(sends == "dodge key" or sends in bound for _, sends, _ in thumbs)
    assert sorc_bar.slots == saved_slots


def test_two_scenario_handoff_keeps_each_modes_own_manual_skills(sorc_gd, default_build, monkeypatch):
    firestorm = replace(sorc_gd.skills["firestorm"], tags=(*sorc_gd.skills["firestorm"].tags, "manual"))
    gd = replace(sorc_gd, skills={**sorc_gd.skills, "firestorm": firestorm})
    manual = {"boss_180": "hellfire", "aoe_pack": "firestorm"}
    names = {"Boss loop": "boss_180", "AoE loop": "aoe_pack"}

    def simulate(gd, build, priority, scenario, cfg):
        key = manual[scenario.key]
        return replace(
            fake_sim_result(2000), duration_s=scenario.duration_s,
            casts=(CastEvent(0, key, 0, 500, 2000, ()), CastEvent(5, key, 0, 500, 2000, ())),
            per_skill={key: SkillTally(2, 1000), "flame-arrow": SkillTally(4, 5000)},
        )

    def simulate_macro(gd, build, plan, name, scenario, cfg, hand=()):
        assert scenario.key == names[name]
        assert hand in ((), (manual[scenario.key],))
        return fake_sim_result(1500 if hand else 1000)

    monkeypatch.setattr(kb, "simulate", simulate)
    monkeypatch.setattr(kb, "simulate_macro", simulate_macro)
    result = kb.plan(gd, default_build, {key: pr(skill, "flame-arrow") for key, skill in manual.items()}, SkillBar(), budget=12)
    assert [macro.name for macro in result.macros] == ["Boss loop", "AoE loop"]
    assert {(row.mstate, row.sends) for row in result.gkeys if row.gkey == "G1"} == {("M1", "F9"), ("M2", "F10")}
    for mode, skill in (("M1", "hellfire"), ("M2", "firestorm")):
        presses = [row for row in result.gkeys if row.mstate == mode and "press by hand" in row.purpose]
        assert len(presses) == 1 and presses[0].purpose == f"{gd.skills[skill].name} (press by hand)"


@pytest.mark.parametrize("class_key,parent,child", [
    ("gladiator", "crushing-wave", "frenzied-wave"),
    ("ranger", "snare-shot", "shackling-arrow"),
])
@pytest.mark.parametrize("style", STYLES)
def test_real_cooldown_and_manual_chains_keep_children_before_parent(default_build, class_key, parent, child, style):
    from aion2c.data.loader import load_gamedata

    gd = load_gamedata(class_key=class_key)
    build = replace(default_build, class_key=class_key, skill_ranks={parent: 12}, specs={parent: (3,)} if class_key == "ranger" else {})
    priority = pr(parent)
    stacks, _ = layout(gd, build, priority, SkillBar(slots={"Q": parent}), auto_chain=False, style=style)
    stack = next(stack for stack in stacks if parent in stack.stack)
    assert stack.key_label == "Q" and stack.stack == (child, parent)
    assert all(len(stack.stack) <= 4 for stack in stacks)
    macros = build_macros({"level_pull": stacks}, {"level_pull": priority}, manual=manual_keys(gd))
    if class_key == "gladiator":
        assert macros[0].entries == ()
        assert "Pressed by hand" in slot_why(gd, build, stack.stack)
    else:
        assert [entry.key_label for entry in macros[0].entries] == ["Q"]
        assert "always ready" not in slot_why(gd, build, stack.stack)
    automatic, _ = layout(gd, build, priority, SkillBar(), auto_chain=True, style=style)
    assert all(child not in stack.stack for stack in automatic)


@pytest.mark.parametrize("gate", ["level", "region", "specialty", "rank", "stigma"])
def test_explicit_chain_children_obey_castability_gates(default_build, gate):
    from aion2c.data.loader import load_gamedata

    gd = load_gamedata(class_key="ranger")
    parent, child = "snare-shot", "shackling-arrow"
    build = replace(default_build, class_key="ranger", skill_ranks={parent: 12}, specs={parent: (3,)})
    if gate == "level":
        gd = replace(gd, skills={**gd.skills, child: replace(gd.skills[child], unlock_level=46)})
    elif gate == "region":
        gd = replace(gd, skills={**gd.skills, child: replace(gd.skills[child], regions=frozenset({"korea"}))})
    elif gate == "specialty":
        build = replace(build, specs={})
    elif gate == "rank":
        build = replace(build, skill_ranks={parent: 11})
    else:
        gd = replace(gd, skills={**gd.skills, child: replace(gd.skills[child], kind=SkillKind.STIGMA)})
    stacks, _ = layout(gd, build, pr(parent), SkillBar(), auto_chain=False)
    assert any(parent in stack.stack for stack in stacks)
    assert all(child not in stack.stack for stack in stacks)


def test_unavailable_chain_step_does_not_leave_unreachable_descendants(sorc_gd, default_build):
    gd = replace(sorc_gd, skills={**sorc_gd.skills, "burst": replace(sorc_gd.skills["burst"], unlock_level=46)})
    stacks, _ = layout(gd, default_build, pr("flame-arrow"), SkillBar(), auto_chain=False)
    assert stacks == (SlotStack("1", ("flame-arrow",)),)


@pytest.mark.parametrize("style", STYLES)
def test_chain_units_are_not_split_when_cooldown_groups_fill(default_build, style):
    from aion2c.data.loader import load_gamedata

    gd = load_gamedata(class_key="ranger")
    keys = ("marking-shot", "drill-dart", "snare-shot", "burst-arrow")
    gd = replace(gd, skills={**gd.skills, **{key: replace(gd.skills[key], tags=()) for key in keys}})
    build = replace(default_build, class_key="ranger", skill_ranks={"snare-shot": 12}, specs={"snare-shot": (3,)})
    stacks, _ = layout(gd, build, pr(*keys), SkillBar(), auto_chain=False, style=style)
    chain = next(stack.stack for stack in stacks if "snare-shot" in stack.stack)
    assert chain.index("shackling-arrow") + 1 == chain.index("snare-shot")
    placed = [key for stack in stacks for key in stack.stack]
    assert set(placed) >= set(keys) | {"shackling-arrow"}
    assert len(placed) == len(set(placed)) and all(len(stack.stack) <= 4 for stack in stacks)


@pytest.mark.parametrize("class_key,parent,child", [
    ("gladiator", "crushing-wave", "frenzied-wave"), ("ranger", "snare-shot", "shackling-arrow"),
])
def test_pinned_chain_without_a_priority_still_keeps_followups(default_build, class_key, parent, child):
    from aion2c.data.loader import load_gamedata

    gd = load_gamedata(class_key=class_key)
    build = replace(default_build, class_key=class_key, skill_ranks={parent: 12}, specs={parent: (3,)} if class_key == "ranger" else {})
    stacks, _ = layout(gd, build, pr(), SkillBar(slots={"Q": parent}), auto_chain=False)
    assert stacks == (SlotStack("Q", (child, parent)),)


def test_real_ranger_explicit_chain_macro_fires_followup(default_build):
    from aion2c.data.loader import load_gamedata
    from aion2c.engine.simulator import simulate_macro
    from aion2c.models import KeybindPlan, SimConfig

    gd = load_gamedata(class_key="ranger")
    build = replace(default_build, class_key="ranger", skill_ranks={"snare-shot": 12}, specs={"snare-shot": (3,)})
    priority = pr("snare-shot")
    stacks, _ = layout(gd, build, priority, SkillBar(), auto_chain=False)
    macros = build_macros({"level_pull": stacks}, {"level_pull": priority}, manual=manual_keys(gd))
    scenario = next(scenario for scenario in SCENARIOS if scenario.key == "level_pull")
    result = simulate_macro(gd, build, KeybindPlan(stacks=stacks, macros=macros), "Leveling loop", scenario, SimConfig(auto_chain=False))
    assert result.per_skill["snare-shot"].casts > 0
    assert result.per_skill["shackling-arrow"].casts > 0


@pytest.mark.parametrize("scenario", ["boss_180", "aoe_pack", "level_pull"])
def test_zero_cast_priority_cannot_reintroduce_unequipped_stigma(sorc_gd, default_build, monkeypatch, scenario):
    monkeypatch.setattr(kb, "simulate", lambda *args: replace(fake_sim_result(0), per_skill={"steel-barrier": SkillTally(0, 0)}))
    monkeypatch.setattr(kb, "simulate_macro", lambda *args, **kwargs: fake_sim_result(0))
    result = kb.plan(sorc_gd, default_build, {scenario: pr("steel-barrier")}, SkillBar(slots={"Q": "steel-barrier"}), budget=0)
    assert all("steel-barrier" not in stack.stack for stack in result.stacks)
    assert all("Steel Barrier" not in assignment.purpose for assignment in result.gkeys)
    assert any("not an equipped stigma" in warning for warning in result.warnings)


def test_zero_macro_dps_advice_reports_absolute_manual_damage(sorc_gd, default_build, monkeypatch):
    ideal = replace(fake_sim_result(8117), per_skill={"hellfire": SkillTally(1, 8117)},
                    casts=(CastEvent(0, "hellfire", 0, 0, 8117, ()),))
    monkeypatch.setattr(kb, "simulate", lambda *args: ideal)
    monkeypatch.setattr(kb, "simulate_macro", lambda *args, hand=(), **kwargs: fake_sim_result(8117 if hand else 0))
    result = kb.plan(sorc_gd, default_build, {"level_pull": pr("hellfire")}, SkillBar(), budget=0)
    advice = result.macro_advice["Leveling loop"]
    assert "No measurable macro DPS" in advice and "8117 DPS" in advice and "Hellfire" in advice
    assert "%" not in advice and "beats the macro by" not in advice
    assert advice in kb.instructions_markdown(result, sorc_gd)
