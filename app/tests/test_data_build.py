"""P1 acceptance tests: build_gamedata + shipped gamedata.json. Offline."""
import dataclasses
import json
import re

import pytest

from aion2c.data import build_gamedata as bg
from aion2c.data.loader import allowed_skills, class_dir, default_path, load_gamedata
from aion2c.models import Num, SkillKind
from aion2c.serde import to_dict

RESEARCH = bg.REPO / "research"
ICONS_SRC = bg.REPO / "assets" / "icons"
needs_research = pytest.mark.skipif(
    not (RESEARCH / "sorcerer_skills.json").is_file() or not (ICONS_SRC / "index.json").is_file(),
    reason="research/ or assets/icons not present")


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    out = tmp_path_factory.mktemp("gd") / "gamedata.json"
    return bg.build(RESEARCH, ICONS_SRC, out, built_at="2026-10-03T00:00:00+00:00")


@pytest.fixture(scope="module")
def shipped():
    return load_gamedata()


def _walk_nums(obj):
    if isinstance(obj, Num):
        yield obj
    elif dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        for f in dataclasses.fields(obj):
            yield from _walk_nums(getattr(obj, f.name))
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _walk_nums(v)
    elif isinstance(obj, (tuple, list, frozenset, set)):
        for v in obj:
            yield from _walk_nums(v)


@needs_research
def test_build_counts(built):
    icon_bearing = [s for s in built.skills.values() if s.icon]
    assert len(icon_bearing) == 54  # 51 + 3 Hellfire tiers on hellfire.png
    assert len(built.skills) == 56
    tiers = [s for s in built.skills.values() if s.kind == SkillKind.CHARGE_TIER]
    assert len(tiers) == 3 and all(s.icon == "hellfire.png" for s in tiers)
    assert built.skills["the-depths"].icon is None and built.skills["flame-zone"].icon is None
    for s in icon_bearing:
        assert (class_dir("sorcerer") / "icons" / s.icon).is_file(), s.icon


def test_slug_traps(shipped):
    sk = shipped.skills
    assert sk["winters-shackles"].skill_id == 15110000
    assert sk["cold-snap-15730000"].kind == SkillKind.PASSIVE
    assert sk["cold-snap"].skill_id == 15080000
    assert sk["frost-burst"].skill_id == 15220000 and sk["frost-burst-15220037"].skill_id == 15220037
    assert bg.slugify("Winter’s Shackles") == "winters-shackles"
    assert "hellfire-level-1" in sk and "hellfire-max" in sk


def test_hellfire_charges(shipped):
    lv = shipped.rules["hellfire"].charge_levels
    assert [c.dmg_mult.value for c in lv] == [1.0, 1.5, 2.0] and len(lv) == 3
    r1 = shipped.skills["hellfire"].ranks[0]
    assert (r1.flat_min.value, r1.flat_max.value) == (1137, 3412)
    assert shipped.skills["hellfire"].ranks[-1].flat_max.value == 24364


def test_chain_inherit(shipped):
    sk = shipped.skills
    assert sk["burst"].unlock_level == 1 and sk["pyroclasm"].unlock_level == 1
    assert sk["cold-wave"].unlock_level == 1 and sk["winters-illusion"].unlock_level == 8
    assert sk["the-depths"].unlock_level == 22 and sk["curse-old-tree"].unlock_level == 22
    link = next(l for l in shipped.links if (l.parent_key, l.child_key) == ("flame-arrow", "burst"))
    assert link.kind == "chain" and link.confidence == "confirmed"
    assert shipped.rules["flame-arrow"].chain_next == "burst"
    assert shipped.rules["burst"].chain_next == "pyroclasm"
    for k in ("burst", "pyroclasm", "cold-wave", "winters-illusion", "curse-old-tree", "the-depths"):
        assert sk[k].kind == SkillKind.CHAIN, k


def test_region_tags(shipped):
    assert shipped.skills["firebomb"].regions == frozenset({"korea"})
    assert "firebomb" not in {s.key for s in allowed_skills(shipped, "global", False)}
    assert "firebomb" in {s.key for s in allowed_skills(shipped, "global", True)}
    kr_only = [k for k, s in shipped.skills.items() if s.regions == frozenset({"korea"})]
    assert len(kr_only) == 7  # Burst, Pyroclasm, Cold Wave, Winter's Illusion, Curse: Old Tree are on Global (open_questions Q3b)
    assert {"burst", "pyroclasm"}.isdisjoint(kr_only)


def test_caps(shipped):
    assert shipped.level_caps == {"global": 45, "korea": 50}
    assert shipped.rank_caps == {"global": {"core": 20, "stigma": 20}, "korea": {"core": 40, "stigma": 25}}
    assert shipped.stigma_slots == {"global": 4, "korea": 6}
    assert shipped.schema_version == 1


def test_every_num_has_confidence(shipped):
    nums = list(_walk_nums(shipped))
    assert len(nums) > 5000
    assert all(n.confidence in ("confirmed", "estimated", "unknown") for n in nums)
    assert all(n.value is not None or n.confidence == "unknown" for n in nums)


@needs_research
def test_roundtrip_file(shipped, tmp_path):
    rebuilt = bg.build(RESEARCH, ICONS_SRC, tmp_path / "gd.json", built_at=shipped.built_at)
    a, b = to_dict(shipped), to_dict(rebuilt)
    for d in (a, b):
        d.pop("built_at")
        d.pop("data_version")
    assert a == b
    assert json.loads((tmp_path / "gd.json").read_text(encoding="utf-8")) == to_dict(rebuilt)


def test_grace_passive(shipped):
    g = shipped.statuses["grace_of_enhancement"]
    assert g.mp_min_pct == 25 and g.source_skill == "grace-of-enhancement"
    assert shipped.skills["grace-of-enhancement"].unlock_level == 21
    t = [t for t in shipped.triggers if t.status_key == "fire_mark"]
    assert len(t) == 1 and t[0].chance == 0.2 and t[0].on_element == "fire" and t[0].source_skill == "fire-mark"
    assert "25" in g.dmg_mult.source and "50" in g.dmg_mult.source


def test_mechanics_values(shipped):
    de = shipped.statuses["delayed_explosion"]
    assert de.dmg_mult.value == 1.15 and de.duration_s.value == 4.0 and de.dmg_mult.confidence == "estimated"
    assert "20" in de.dmg_mult.source and "25%" in de.dmg_mult.source and "30" in de.duration_s.source
    ee = shipped.statuses["element_enhancement"]
    assert ee.dmg_mult.value == 1.2 and ee.elements == frozenset({"fire", "water"})
    assert shipped.rules["blaze"].requires == ("fire_mark",)
    for k in ("firestorm", "fire-wall", "cold-storm"):
        assert shipped.skills[k].anim_lock_s.value == 1.5
    assert shipped.skills["flame-arrow"].anim_lock_s.value == 1.0
    for k in ("fire_wall_dot", "cold_storm_dot", "firestorm_dot"):
        assert shipped.statuses[k].tick_ratio_pct.confidence == "unknown"
        assert shipped.statuses[k].tick_ratio_pct.value == 0.0


def test_mp_restore_matches_description(shipped):
    for key, r in shipped.rules.items():
        if r.mp_restore:
            assert re.search(rf"restores {int(r.mp_restore)} MP", shipped.skills[key].description), key


def test_community_and_roadmap(shipped):
    assert {c.scenario_key for c in shipped.community} == {"boss_180", "aoe_pack"}
    assert all(c.source.startswith("https://") and c.priority for c in shipped.community)
    levels = [r.level for r in shipped.roadmap]
    assert levels == sorted(levels)
    assert any(r.level == 22 and r.kind == "stigma" for r in shipped.roadmap)
    assert {27, 32, 37} <= {r.level for r in shipped.roadmap if r.kind == "stigma"}
    assert all(r.regions == frozenset({"korea"}) for r in shipped.roadmap if r.level > 45)
    assert any(r.level == 14 and "Hellfire" in r.text for r in shipped.roadmap)


def test_daevanion_counts(shipped):
    assert len(shipped.daevanion) == 5
    nodes = [n for b in shipped.daevanion.values() for n in b.nodes.values()]
    assert len(nodes) == 537 and sum(n.cost for n in nodes) == 802
    for b in shipped.daevanion.values():
        assert b.start_id in b.nodes and b.nodes[b.start_id].node_type == "start"
        assert all(a in b.nodes for n in b.nodes.values() for a in n.adjacent)
    assert shipped.daevanion["nezekan"].unlock_level == 12 and len(shipped.daevanion["nezekan"].nodes) == 89
    skill_nodes = [n for n in nodes if n.node_type == "skill"]
    assert len(skill_nodes) == 88 and all(n.skill_key in shipped.skills for n in skill_nodes)
    ws = next(n for n in skill_nodes if "Winter" in n.name)
    assert shipped.skills[ws.skill_key].name == "Winter's Shackles"


def test_recipes_loaded(shipped):
    assert len(shipped.recipes) == 27
    assert sum(1 for r in shipped.recipes if r.sorc_relevant) == 18
    assert all(r.materials and r.source_url for r in shipped.recipes)
    assert any(r.base_materials for r in shipped.recipes)


def test_default_path_exists():
    assert default_path().is_file()
