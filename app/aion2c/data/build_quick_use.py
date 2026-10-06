"""Derive Quick Use identities and class context facts; never copy raw tables."""
import argparse
import json
from pathlib import Path


def derive(root: Path) -> dict:
    def table(name):
        return json.loads((root / f"{name}.json").read_text(encoding="utf-8"))["Properties"]["Data"]

    labels = {"LeftMouseButton": "Left mouse", "RightMouseButton": "Right mouse",
              "One": "1", "Two": "2", "Three": "3", "Four": "4",
              "Five": "5", "Six": "6", "Seven": "7", "Eight": "8"}
    mappings = {r["Name"]: r for r in table("InputKeyMapping")}
    actions = []
    for r in table("QuickSlotData"):
        name = r["InputAction"].split("::")[-1]
        if not name.startswith(("QuickSlot_Skill_", "QuickSlot_Stigma_")):
            continue
        index = int(name.rsplit("_", 1)[1])
        keys = [key["MainKey"]["KeyName"] for key in mappings[name]["Keys"]]
        actions.append({"id": index + (8 if "Stigma" in name else 0), "slot_id": r["SlotId"]["Value"],
                        "bindings": [labels.get(key, key.upper() if len(key) == 1 and key.isalpha() else key) for key in keys],
                        "slot_editable": r["bEditable"]})
    classes = {}
    for r in table("PCContextSkillSlot"):
        name = r["Class"].split("::")[-1].lower()
        name = {"elementalist": "spiritmaster"}.get(name, name)
        if name not in {"gladiator", "templar", "assassin", "ranger", "sorcerer", "spiritmaster", "cleric", "chanter"}:
            continue
        classes.setdefault(name, {})[str(r["QuickSlotId"])] = {
            "default_skill_id": r["DefaultSkillId"]["Value"],
            "context_skill_ids": [skill["Value"] for skill in r["ContextChangeSkillList"]],
            "context_editable": r["bEditable"],
        }
    return {"schema": 1, "client_version": None,
            "sources": ["InputKeyMapping", "QuickSlotData", "PCContextSkillSlot"],
            "actions": sorted(actions, key=lambda action: action["id"]), "classes": classes}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("table_root", type=Path)
    args = parser.parse_args()
    Path(__file__).with_name("client_quick_use.json").write_text(
        json.dumps(derive(args.table_root), indent=2) + "\n", encoding="utf-8")
