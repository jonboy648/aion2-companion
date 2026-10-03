from dataclasses import replace

from aion2c.models import CharacterBuild
from aion2c.roadmap import roadmap


def test_roadmap_global_cap(sorc_gd):
    items = roadmap(sorc_gd, "global")
    assert max(i.level for i in items) == 45
    assert any(i.level == 22 and i.kind == "stigma" for i in items)
    assert {27, 32, 37} <= {i.level for i in items if i.kind == "stigma"}
    assert all("global" in i.regions for i in items)
    assert [i.level for i in items] == sorted(i.level for i in items)


def test_roadmap_korea(sorc_gd):
    items = roadmap(sorc_gd, "korea")
    assert any(i.level > 45 for i in items)
    assert max(i.level for i in items) <= 50


def test_roadmap_unlocks(sorc_gd):
    items = roadmap(sorc_gd, "global")
    assert any(i.level == 14 and i.kind == "skill" and "Hellfire" in i.text for i in items)
    # chain children are not unlocks of their own
    assert not any(i.text in ("Unlock Burst", "Unlock Pyroclasm") for i in items)


def test_roadmap_no_duplicate_skill_items(sorc_gd):
    items = roadmap(sorc_gd, "global", CharacterBuild("t", "global", 45))
    texts = [i.text for i in items if i.kind == "skill"]
    assert len(texts) == len(set(texts))
