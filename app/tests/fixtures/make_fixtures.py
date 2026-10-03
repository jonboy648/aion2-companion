"""Regenerates mini_gamedata.json, sorc_gamedata_small.json and aion2c/data/fallback_gamedata.json.

Run from D:\\Aion2\\app:  python tests/fixtures/make_fixtures.py
Reads D:\\Aion2\\research (sorcerer_skills.json, daevanion_sorcerer.json, crafting.json).
"""
import json
import re
import sys
from dataclasses import replace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
RESEARCH = Path(r"D:\Aion2\research")
ICONS = Path(r"D:\Aion2\assets\icons\sorcerer")

from aion2c.models import *  # noqa: E402,F403
from aion2c.serde import to_dict  # noqa: E402

BOTH = frozenset({"global", "korea"})
C = lambda v, src="fixture": Num(float(v), "confirmed", src)  # noqa: E731
E_ = lambda v, src="fixture": Num(float(v), "estimated", src)  # noqa: E731
CAPS = dict(
    level_caps={"global": 45, "korea": 50},
    rank_caps={"global": {"core": 20, "stigma": 20}, "korea": {"core": 40, "stigma": 25}},
    stigma_slots={"global": 4, "korea": 6},
)


def mini_skill(key, ratio, cd, mp, anim, aoe=1, kind=SkillKind.ACTIVE, unlock=1):
    rank = RankData(1, C(0), C(0), C(cd), C(mp))
    return Skill(
        key=key, skill_id=None, name=key.replace("_", " ").title(), name_kr=None, kind=kind,
        element="fire", unlock_level=unlock, max_rank=1, regions=BOTH, atk_ratio_pct=C(ratio),
        ranks=(rank,), range_m=20.0, aoe_targets=aoe, hits=1, anim_lock_s=C(anim),
    )


def tiny_board():
    def node(i, name, rarity, cost, typ, effects, skill_key, adj, x, y):
        return DaevanionNode(i, name, rarity, cost, typ, effects, skill_key, adj, x, y)

    nodes = {
        1: node(1, "Start", "Common", 0, "start", (), None, (2, 4), 0, 0),
        2: node(2, "Attack", "Common", 1, "stat", (DaevanionEffect("Attack Bonus", 10, "flat"),), None, (1, 3), 1, 0),
        3: node(3, "Skill Level Up - Strike", "Rare", 2, "skill", (DaevanionEffect("strike", 1, "flat"),), "strike", (2,), 2, 0),
        4: node(4, "Critical Hit", "Common", 1, "stat", (DaevanionEffect("Critical Hit", 50, "flat"),), None, (1,), 0, 1),
    }
    return {"tiny": DaevanionBoard("tiny", "Tiny", 1, nodes, 1)}


def mini_recipes():
    m = RecipeMaterial
    return (
        Recipe(1, "Mini Orb", "Alchemy", None, "Mini Orb", 1, None, "Unique",
               (m("Intermediate Dust", 2), m("Ore", 3)), (m("Ore", 7), m("Dust", 4)), True, "fixture"),
        Recipe(2, "Mini Potion", "Alchemy", None, "Mini Potion", 1, None, "Common",
               (m("Ore", 1), m("Dust", 1)), (m("Ore", 1), m("Dust", 1)), None, "fixture"),
    )


def build_mini():
    sk = [
        mini_skill("strike", 100, 0, 0, 1.0),
        mini_skill("nuke", 300, 4, 0, 1.0, aoe=4),
        mini_skill("amp", 0, 10, 0, 1.0),
        mini_skill("mark_hit", 50, 0, 0, 1.0),
        mini_skill("blaze", 200, 5, 0, 1.0),
        mini_skill("chain1", 100, 0, 0, 1.0),
        mini_skill("chain2", 150, 0, 0, 1.0, kind=SkillKind.CHAIN, unlock=None),
        mini_skill("chain3", 200, 0, 0, 1.0, kind=SkillKind.CHAIN, unlock=None),
        mini_skill("charge", 100, 20, 100, 0.5),
    ]
    statuses = {
        "amp_buff": Status("amp_buff", "Amp Buff", "self", C(5), C(1.5), frozenset()),
        "mark": Status("mark", "Mark", "target", C(10), C(1.0), frozenset()),
    }
    rules = {r.skill_key: r for r in (
        SkillRule("amp", applies=("amp_buff",), confidence="confirmed"),
        SkillRule("mark_hit", applies=("mark",), apply_chance=0.5, confidence="confirmed"),
        SkillRule("blaze", requires=("mark",), consumes=("mark",), confidence="confirmed"),
        SkillRule("chain1", chain_next="chain2", chain_window_s=3.0, confidence="confirmed"),
        SkillRule("chain2", chain_next="chain3", chain_window_s=3.0, confidence="confirmed"),
        SkillRule("chain3", confidence="confirmed"),
        SkillRule("charge", charge_levels=(
            ChargeLevel(1, C(0), C(1)), ChargeLevel(2, C(1), C(2)), ChargeLevel(3, C(2), C(3))),
            confidence="confirmed"),
    )}
    links = (Link("chain1", "chain2", "chain", "confirmed"), Link("chain2", "chain3", "chain", "confirmed"))
    return GameData(
        schema_version=1, data_version="mini-fixture", built_at="2026-10-03T00:00:00Z", **CAPS,
        skills={s.key: s for s in sk}, statuses=statuses, rules=rules, triggers=(), links=links,
        community=(), roadmap=(), daevanion=tiny_board(), recipes=mini_recipes(),
    )
