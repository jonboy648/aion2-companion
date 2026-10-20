"""Saved public armory evidence through the same import/stat-sheet API the browser uses."""
import pytest

from aion2c import serde, webapi
from aion2c.data.loader import load_gamedata
from aion2c.models import CharacterBuild, total_rank
from test_statsheet import CHARS


@pytest.mark.parametrize("character", list(CHARS))
def test_saved_character_gear_and_effective_ranks_reconcile(character):
    raw = CHARS[character]()
    result = webapi.import_character(raw)
    build = serde.from_dict(CharacterBuild, result["build"])
    gd = load_gamedata(class_key=build.class_key)
    by_id = {skill.skill_id: skill for skill in gd.skills.values()}
    for skill in raw["equipment"]["skill"]["skillList"]:
        if skill.get("acquired") and skill.get("skillLevel") and skill["id"] in by_id:
            assert total_rank(gd, build, by_id[skill["id"]]) == skill["skillLevel"], skill["name"]
    gear = raw["equipment"]["equipment"]["equipmentList"]
    assert len(result["gear"]) == len(gear)
    for source, shown in zip(gear, result["gear"]):
        assert (shown["slot"], shown["name"], shown["enchant"], shown["exceed"]) == (
            source["slotPosName"], source["name"], source["enchantLevel"], source["exceedLevel"],
        )
    # These are imported currency-independent ownership facts, not a claim that every board graph is audited.
    opened = sum(b["openNodeCount"] for b in raw["info"]["daevanion"]["boardList"])
    assert result["daevanion_summary"]["open"] == opened
    assert result["daevanion_summary"]["matched"] == opened


def test_title_effects_are_sourced_once_and_pet_identity_is_not_a_guessed_bonus():
    raw = CHARS["DarthThot"]()
    sheet = webapi.stat_sheet(raw)
    sources = [s for cat in sheet["categories"] for row in cat["stats"] for s in row["sources"]]
    # Public title evidence: Celebrity equipStatList and collection statList, distinct origins.
    title_crit = [s for s in sources if s["label"] == "Title (Attack): Celebrity" and s["value"] == 30]
    title_collection = [s for s in sources if s["label"] == "Title collection: Celebrity" and s["value"] == 20]
    assert len(title_crit) == len(title_collection) == 1
    assert not any("Starturtle" in s["label"] for s in sources)
    assert any("Pet" in line or "pet" in line for line in sheet["not_included"])
