from aion2c import webapi
import pytest


def test_macro_entries_use_action_identity_and_client_delay_limits():
    build = {"name": "Test", "region": "global", "level": 45, "class_key": "templar", "skill_ranks": {"pummel": 1}}
    priority = {"entries": [{"skill_key": "pummel"}] * 25, "label": "Test"}
    result = webapi.keybinds(build, {"boss_180": priority}, delay_ms=0, bindings={"2": "Q"})
    macro = result["plan"]["macros"][0]
    assert macro["name"] == "Boss loop"
    assert macro["hotkey"] == "F9"
    assert 0 < len(macro["entries"]) <= 20
    assert macro["entries"][0] == {"index": 1, "key_label": "Q", "delay_ms": 10, "quick_use_id": 2}
    assert result["plan"]["macro_dps"] == {}


def test_setup_sheet_states_client_limits_and_runtime_uncertainty():
    result = webapi.keybinds({"name": "Test", "region": "global", "level": 45, "class_key": "templar", "skill_ranks": {"pummel": 1}},
        {"boss_180": {"entries": [{"skill_key": "pummel"}], "label": "Test"}}, delay_ms=10000, bindings={"2": "Q"})
    sheet = result["instructions_markdown"]
    assert "Quick Use 2" in sheet and "9900" in sheet
    assert "order is not guaranteed" in sheet
    assert "manual inputs take priority" in sheet
    assert "Skill Queue" in sheet and "AION 1" in sheet
    assert "20 entries" in sheet and "10-9900 ms" in sheet
    assert "unverified" in sheet
    assert "fires first" not in sheet


def test_macro_setup_order_is_action_identity_not_optimized_priority_order():
    build = {"name": "Test", "region": "global", "level": 45, "class_key": "templar",
             "skill_ranks": {"vicious-strike": 1, "pummel": 1, "shield-smite": 1}}
    def setup(skills):
        return webapi.keybinds(build, {"boss_180": {"entries": [{"skill_key": k} for k in skills], "label": "Test"}})["plan"]["macros"][0]["entries"]
    forward = setup(["pummel", "shield-smite"])
    reverse = setup(["shield-smite", "pummel"])
    assert forward == reverse
    assert [entry["quick_use_id"] for entry in forward] == [2, 4]


def test_missing_imported_ranks_and_chain_followups_are_not_assignable():
    build = {"name": "Test", "region": "global", "level": 45, "class_key": "templar", "skill_ranks": {"pummel": 1, "punishing-strike": 1}}
    result = webapi.keybinds(build, {}, {"7": "punishing-strike"})["plan"]
    skills = [key for stack in result["stacks"] for key in stack["stack"]]
    assert "pummel" in skills
    assert "vicious-strike" not in skills
    assert "punishing-strike" not in skills


def test_stigma_actions_have_stable_physical_slot_identity():
    result = webapi.keybinds({"name": "Test", "region": "global", "level": 45, "class_key": "sorcerer"}, {})
    actions = result["plan"].get("actions", [])
    assert len(actions) == 12
    assert actions[0]["id"] == 1
    assert actions[0]["slot_id"] == 1
    assert actions[0]["binding"] == "Left mouse"
    assert actions[8]["id"] == 9
    assert actions[8]["slot_id"] == 21
    assert actions[8]["binding"] == "5"


def test_class_context_defaults_and_editability_are_preserved():
    result = webapi.keybinds({"name": "Test", "region": "global", "level": 45, "class_key": "templar"}, {})
    actions = result["plan"]["actions"]
    assert actions[0].get("default_skill") == "vicious-strike"
    assert actions[0].get("context_editable") is False
    assert actions[1].get("slot_editable") is False
    assert actions[1].get("context_editable") is True
    assert actions[7].get("default_skill") == "flash-rampage"
    assert actions[7].get("context_skills") == ["debilitating-smash", "judgment"]


def test_rebinding_does_not_change_action_or_physical_slot():
    result = webapi.keybinds({"name": "Test", "region": "global", "level": 45, "class_key": "templar"}, {}, bindings={"7": "Q", "8": "E"})
    action = result["plan"]["actions"][6]
    assert (action["id"], action["slot_id"], action["binding"], action["default_skill"]) == (7, 7, "Q", "shield-rush")


@pytest.mark.parametrize("class_key", ["gladiator", "templar", "assassin", "ranger", "sorcerer", "spiritmaster", "cleric", "chanter"])
def test_all_classes_expose_twelve_actions_with_a_real_basic_attack(class_key):
    result = webapi.keybinds({"name": "Test", "region": "global", "level": 45, "class_key": class_key}, {})
    actions = result["plan"]["actions"]
    assert [a["id"] for a in actions] == list(range(1, 13))
    assert actions[0]["default_skill"]
    assert actions[0]["context_editable"] is False


def test_setup_uses_class_action_slots_not_a_synthetic_keyboard_partition():
    result = webapi.keybinds({"name": "Test", "region": "global", "level": 45, "class_key": "templar", "skill_ranks": {"vicious-strike": 1, "flash-rampage": 1}}, {})
    stacks = result["plan"]["stacks"]
    assert len(stacks) == 12
    assert stacks[0].get("quick_use_id") == 1
    assert stacks[0]["key_label"] == "Left mouse"
    assert stacks[0]["stack"] == ["vicious-strike"]
    assert stacks[7]["stack"] == ["flash-rampage"]
    assert result["plan"].get("queue_status") == "unverified"
    assert result["plan"]["macro_dps"] == {}


def test_only_acquired_equipped_stigmas_are_assigned_and_basic_attack_is_fixed():
    build = {"name": "Test", "region": "global", "level": 45, "class_key": "sorcerer",
             "stigmas": ["element-enhancement", "curse-tree"], "skill_ranks": {"flame-arrow": 1, "element-enhancement": 5, "curse-tree": 0}}
    result = webapi.keybinds(build, {}, {"1": "hellfire", "10": "curse-tree"})
    stacks = result["plan"]["stacks"]
    assert stacks[0]["stack"] == ["flame-arrow"]
    assert stacks[8]["stack"] == ["element-enhancement"]
    assert not any("curse-tree" in stack["stack"] for stack in stacks)
    assert any("fixed" in warning for warning in result["plan"]["warnings"])


def test_level_and_unlock_gate_prevent_extra_stigma_slots():
    build = {"name": "Test", "region": "global", "level": 22, "class_key": "sorcerer", "stigma_unlocked": True,
             "stigmas": ["element-enhancement", "steel-barrier"], "skill_ranks": {"element-enhancement": 1, "steel-barrier": 1}}
    plan = webapi.keybinds(build, {}, {"10": "steel-barrier"})["plan"]
    assert len([s for s in plan["stacks"][8:] if s["stack"]]) == 1
    assert plan["stacks"][9]["stack"] == []
    locked = webapi.keybinds({**build, "stigma_unlocked": False}, {})["plan"]
    assert all(not s["stack"] for s in locked["stacks"][8:])
def test_duplicate_bindings_are_reported_and_withheld_from_macros():
    result = webapi.keybinds({"name": "Test", "region": "global", "level": 45,
        "class_key": "templar", "skill_ranks": {"pummel": 1}}, {}, bindings={"2": " 1 "})
    assert any("binding conflict" in warning.lower() for warning in result["plan"]["warnings"])
    assert all(entry["quick_use_id"] not in (2, 3)
        for macro in result["plan"]["macros"] for entry in macro["entries"])

@pytest.mark.parametrize("delay", [None, float("nan"), float("inf"), "not-a-delay"])
def test_malformed_api_delays_fall_back_to_client_minimum(delay):
    result = webapi.keybinds({"name": "Test", "region": "global", "level": 45,
        "class_key": "templar", "skill_ranks": {"pummel": 1}}, {}, delay_ms=delay)
    assert all(entry["delay_ms"] == 10
        for macro in result["plan"]["macros"] for entry in macro["entries"])

def test_quick_use_contract_is_small_derived_data_only():
    import json
    from pathlib import Path
    path = Path(__file__).parents[1] / "aion2c/data/client_quick_use.json"
    assert path.stat().st_size < 50000
    text = path.read_text(encoding="utf-8")
    data = json.loads(text)
    assert set(data) == {"schema", "client_version", "sources", "actions", "classes"}
    assert len(data["actions"]) == 12 and len(data["classes"]) == 8
    for action in data["actions"]:
        assert set(action) == {"id", "slot_id", "bindings", "slot_editable"}
    for contexts in data["classes"].values():
        for context in contexts.values():
            assert set(context) == {"default_skill_id", "context_skill_ids", "context_editable"}
    for raw in ("InputKeyMappingData", "ContextSkillID", "QuickSlotType", "Properties", "Rows", "Aion2-tools", "AES"):
        assert raw not in text

def test_native_setup_exports_numbering_caveat_and_clamps_high_delay():
    result = webapi.keybinds({"name": "Test", "region": "global", "level": 45,
        "class_key": "templar", "skill_ranks": {"pummel": 1}}, {}, delay_ms=10000)
    assert "Numbering records configured entries, not runtime execution order" in result["instructions_markdown"]
    entries = [entry for macro in result["plan"]["macros"] for entry in macro["entries"]]
    assert entries and all(entry["delay_ms"] == 9900 for entry in entries)
