"""Legal progression: level budgets, rank gates, stigma unlock (docs/adr/0003)."""
import json
from dataclasses import replace
from pathlib import Path

import pytest

from aion2c import progression as pg
from aion2c.data.loader import load_gamedata
from aion2c.engine.budget import allocate_points
from aion2c.models import STIGMA_POINT_COST, CharacterBuild, Priority, PriorityEntry, SkillKind
from aion2c.serde import from_dict, to_dict
from aion2c.specs import available_options, slot_room


@pytest.fixture(scope="module")
def gd():
    return load_gamedata(class_key="sorcerer")


def test_level_budget_rows_are_cumulative_not_summed():
    # progression_connections_2026-10-05.md level table: one Exp row each
    assert pg.level_budget(1) == pg.LevelBudget(0, 0, 0, 0)
    assert pg.level_budget(8) == pg.LevelBudget(10, 0, 0, 0)
    assert pg.level_budget(22) == pg.LevelBudget(71, 0, 1, 44)
    assert pg.level_budget(23).stigma == 1 and pg.level_budget(40).stigma == 19
    assert pg.level_budget(45) == pg.LevelBudget(203, 29, 4, 136)
    assert pg.level_budget(0) == pg.level_budget(1) and pg.level_budget(999) == pg.level_budget(50)


def test_unlock_constants():
    assert pg.stigma_unlock_level() == 22
    assert pg.mastery_slot_levels() == (8, 12, 20)
    assert pg._data()["stigma_unlock"]["quests"] == ["AQ1602010", "AQ2602010"]


def test_flame_arrow_rank_gates(gd):
    fa = gd.skills["flame-scattershot"]
    assert pg.rank_gate(fa, 8) == 23 and pg.rank_gate(fa, 10) == 29
    assert pg.rank_gate(fa, 11) is None  # paid acquisition stops at 10
    assert [pg.max_rank_at_level(fa, lv, 10) for lv in (4, 5, 22, 23, 28, 29)] == [0, 2, 7, 8, 9, 10]  # the note's "Flame Arrow 15010000"


def test_no_rows_means_no_gate(gd):
    sk = replace(gd.skills["flame-scattershot"], skill_id=1)
    assert pg.rank_levels(sk) is None and pg.max_rank_at_level(sk, 1, 10) == 10


def test_stigma_acquisition_shape(gd):
    """Every Global stigma row: 20 ranks, all gated at level 22 (rank 1 additionally needs ascension grade 3)."""
    sts = [s for s in gd.skills.values() if s.kind == SkillKind.STIGMA and pg.rank_levels(s)]
    assert len(sts) >= 8
    assert all(pg.rank_levels(s) == (22,) * 20 for s in sts)


def test_codex_dataset_agrees():
    """Cross-check against the level planner's independently derived dataset when it is on this machine."""
    p = Path(r"D:\Aion2-level-planner\web\src\features\progression\data.json")
    if not p.is_file():
        pytest.skip("level planner dataset not present")
    cx = json.loads(p.read_text(encoding="utf-8"))
    # packed format: levels rows [level, skill, stigma, stigmaSlots, daevanion]; a skill is
    # [unlockLevel, autoLearn, profileIndex, ...] and rankProfiles[i] rows are [rank, characterLevel, skillCost, stigmaCost, ...]
    for lvl, sk, st, slots, dae in cx["levels"]:
        assert pg.level_budget(lvl) == pg.LevelBudget(sk, st, slots, dae)
    checked = 0
    for ck, c in cx["classes"].items():
        g = load_gamedata(class_key=ck)
        for key, ent in c["skills"].items():
            ours = pg.rank_levels(g.skills[key]) if key in g.skills else None
            if ours is None:
                continue
            theirs = tuple(r[1] for r in cx["rankProfiles"][ent[2]])
            assert ours[:len(theirs)] == theirs[:len(ours)], (ck, key)
            checked += 1
    assert checked > 200


def test_stigma_unlock_inference(gd):
    glacial = "glacial-smite"
    assert not pg.stigma_unlock(gd, CharacterBuild("t", "global", 21, class_key="sorcerer")).unlocked
    u = pg.stigma_unlock(gd, CharacterBuild("t", "global", 30, class_key="sorcerer"))
    assert u.unlocked and u.basis == "level" and u.inferred
    u = pg.stigma_unlock(gd, CharacterBuild("t", "global", 10, skill_ranks={glacial: 3}))
    assert u.unlocked and u.basis == "ranks"
    u = pg.stigma_unlock(gd, CharacterBuild("t", "global", 45, skill_ranks={glacial: 3}, stigma_unlocked=False))
    assert not u.unlocked and u.basis == "explicit" and not u.inferred


def test_serde_stigma_unlocked():
    b = CharacterBuild("x", "global", 45, stigma_unlocked=True)
    d = to_dict(b)
    assert d["stigma_unlocked"] is True and from_dict(CharacterBuild, d) == b
    d.pop("stigma_unlocked")
    assert from_dict(CharacterBuild, d).stigma_unlocked is None
    assert to_dict(CharacterBuild("x", "global", 45))["stigma_unlocked"] is None


def test_legality_flags_not_caps(gd):
    b = CharacterBuild("t", "global", 22, skill_ranks={"flame-scattershot": 10, "glacial-smite": 2}, class_key="sorcerer",
                       stigmas=("glacial-smite", "soul-freeze"), stigma_unlocked=False)
    issues = pg.legality_issues(gd, b)
    assert any("Flame Scattershot" in i and "rank 10 needs character level 29" in i for i in issues)
    assert any("not unlocked" in i for i in issues)
    assert any("2 stigmas equipped but level 22 has 1" in i for i in issues)
    assert b.skill_ranks["flame-scattershot"] == 10  # untouched
    ok = CharacterBuild("t", "global", 45, skill_ranks={"flame-scattershot": 10}, class_key="sorcerer")
    assert pg.legality_issues(gd, ok) == []


def _prio(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


def test_allocator_respects_level_gate(gd):
    from aion2c.models import SCENARIOS
    sc = SCENARIOS[0]
    fa = gd.skills["flame-arrow"]  # gates (1, 1, 4, 7, 10, 13, 16, 19, 22, 25)
    b = CharacterBuild("t", "global", 21, skill_points=500, class_key="sorcerer")
    ranks, _ = allocate_points(gd, b, _prio("flame-arrow"), sc)
    assert ranks["flame-arrow"] == pg.max_rank_at_level(fa, 21, 10) == 8
    ranks, _ = allocate_points(gd, replace(b, level=45), _prio("flame-arrow"), sc)
    assert ranks["flame-arrow"] == 10
    # held rank above the gate: flagged, not capped, and nothing more is bought on it
    held = replace(b, skill_ranks={"flame-arrow": 9})
    assert allocate_points(gd, held, _prio("flame-arrow"), sc)[0]["flame-arrow"] == 9
    assert any("rank 9 needs character level 22" in i for i in pg.legality_issues(gd, held))


def test_stigma_rank_one_is_paid_and_gated(gd):
    from aion2c.models import SCENARIOS
    sc = SCENARIOS[0]
    prio = _prio("glacial-smite")
    b = CharacterBuild("t", "global", 45, stigmas=("glacial-smite",), stigma_points=1, class_key="sorcerer")
    ranks, _ = allocate_points(gd, b, prio, sc)
    assert ranks == {"glacial-smite": 1}  # the one point buys rank 1 and nothing else
    ranks, _ = allocate_points(gd, replace(b, stigma_points=1 + sum(STIGMA_POINT_COST[1:3])), prio, sc)
    assert ranks["glacial-smite"] <= 3
    ranks, _ = allocate_points(gd, replace(b, stigma_unlocked=False, stigma_points=50), prio, sc)
    assert ranks == {}
    ranks, _ = allocate_points(gd, replace(b, level=21, stigma_points=50), prio, sc)
    assert ranks == {}


def test_stigma_tiers_are_automatic(gd):
    s = gd.skills["glacial-smite"]
    assert [sp.rank_required for sp in s.specializations] == [5, 10, 15, 20]
    assert [slot_room(gd, s, r) for r in (4, 5, 10, 15, 20)] == [0, 1, 2, 3, 4]
    assert available_options(gd, s, 20) == [0, 1, 2, 3]
    mastery = gd.skills["flame-scattershot"]
    assert [slot_room(gd, mastery, r) for r in (8, 12, 20)] == [1, 2, 3]  # selectable slots 8/12/20


def test_optimizer_no_stigma_before_unlock(gd):
    from aion2c.engine import build_optimizer as bo
    from aion2c.engine.search import SearchBudget
    b = CharacterBuild("t", "global", 30, class_key="sorcerer", stigma_unlocked=False)
    fb = bo.optimize_full_build(gd, b, "boss", budget=SearchBudget(max_candidates=20))
    assert fb.build.stigmas == ()
    b = CharacterBuild("t", "global", 30, class_key="sorcerer")
    fb = bo.optimize_full_build(gd, b, "boss", budget=SearchBudget(max_candidates=20))
    assert any("inferred from level" in w for w in fb.warnings)


def test_derived_file_matches_export_when_available():
    """Guard: data/client_progression.json is exactly what client_export derives from the private export."""
    import os
    from aion2c.data import client_export as ce
    d = os.environ.get(ce.ENV_VAR)
    if not d or not (Path(d) / "Exp.json").is_file():
        pytest.skip("no client export on this machine")
    assert ce.build_progression(Path(d)) == json.loads(ce.PROGRESSION_PATH.read_text(encoding="utf-8"))


def test_derived_file_shape():
    d = pg._data()
    assert d["client_version"] is None  # never claimed: the export's version is unverified
    assert len(d["levels"]) == 50 and all(len(r) == 4 for r in d["levels"])
    assert all(g >= 1 for lv in d["ranks"].values() for g in lv)


def test_webapi_level_progression():
    from aion2c import webapi
    b = to_dict(CharacterBuild("t", "global", 30, skill_ranks={"flame-arrow": 10}, class_key="sorcerer"))
    r = webapi.level_progression(b)
    assert r["budget"] == {"skill": 111, "stigma": 8, "stigma_slots": 2, "daevanion": 76}
    assert r["stigma_unlocked"] and r["stigma_unlock_basis"] == "level" and r["stigma_unlock_inferred"]
    assert r["issues"] == []
    bad = webapi.level_progression({**b, "level": 20})
    assert any("rank 10 needs character level 25" in i for i in bad["issues"])


# ---- Daevanion currencies (Azphel = BattleCrystal) --------------------------------------------------------------

def test_board_currency_matches_client_for_every_class():
    from aion2c.classes import CLASSES
    derived = pg._data()["board_currency"]
    for c in CLASSES:
        g = load_gamedata(class_key=c.key)
        got = {str(b.unlock_level): b.currency for b in g.daevanion.values()}
        assert got == derived[c.key], c.key
        assert [b.key for b in g.daevanion.values() if b.currency == "battle"] == ["azphel"], c.key


def _first_nodes(gd):
    from aion2c.daevanion import selectable
    return {k: min(selectable(b, frozenset())) for k, b in gd.daevanion.items()}


def test_take_path_pays_each_currency_separately(gd):
    from aion2c.daevanion import take_path
    first = _first_nodes(gd)
    path = [first["nezekan"], first["azphel"]]
    cost = {n.id: n.cost for b in gd.daevanion.values() for n in b.nodes.values()}
    assert take_path(gd, path, None) == ([first["nezekan"]], cost[first["nezekan"]], 0)  # no battle budget: no Azphel
    assert take_path(gd, path, 0, 99)[0] == [first["azphel"]]  # crystals never pay for Azphel, battle never for Nezekan
    t, s, bs = take_path(gd, path, 99, 99)
    assert t == path and bs == cost[first["azphel"]]
    assert take_path(gd, path, 99, 0)[0] == [first["nezekan"]]


def test_suggest_path_never_spends_crystals_on_azphel(gd):
    from aion2c.daevanion import suggest_path
    from aion2c.models import SCENARIOS
    b = CharacterBuild("t", "global", 45, class_key="sorcerer", skill_ranks={"flame-arrow": 10})
    prio = _prio("flame-arrow")
    azphel = set(gd.daevanion["azphel"].nodes)
    path, _ = suggest_path(gd, b, prio, SCENARIOS[0], 12)
    assert path and not azphel & set(path)
    path, _ = suggest_path(gd, b, prio, SCENARIOS[0], 0, battle_points=12)
    assert set(path) <= azphel  # (Azphel is nearly all PvP stats, so the DPS-greedy path may legitimately be empty)
    cost = {n.id: n.cost for n in gd.daevanion["azphel"].nodes.values()}
    assert sum(cost[i] for i in path) <= 12


def test_plan_and_optimizer_keep_existing_azphel_nodes(gd):
    from aion2c.engine import build_optimizer as bo
    from aion2c.engine.search import SearchBudget
    mine = _first_nodes(gd)["azphel"]
    b = CharacterBuild("t", "global", 45, class_key="sorcerer", daevanion_nodes=frozenset({mine}))
    fb = bo.optimize_full_build(gd, b, "boss", 30, budget=SearchBudget(max_candidates=20))
    azphel = set(gd.daevanion["azphel"].nodes)
    assert fb.build.daevanion_nodes & azphel == {mine}  # kept, nothing added without a battle budget
    assert any("Azphel board (BattleCrystal) not planned" in w for w in fb.warnings)
    fb2 = bo.optimize_full_build(gd, b, "boss", 0, budget=SearchBudget(max_candidates=20), battle_points=20)
    assert mine in fb2.build.daevanion_nodes and len(fb2.build.daevanion_nodes & azphel) > 1
    assert not any("Azphel board" in w for w in fb2.warnings)


# ---- automatic stigma tiers in the output -----------------------------------------------------------------------

def test_auto_tiers_listed_in_full_at_every_rank(gd):
    from aion2c.engine.build_optimizer import with_auto_tiers
    for rank, want in ((4, ()), (5, (0,)), (10, (0, 1)), (15, (0, 1, 2)), (20, (0, 1, 2, 3))):
        b = CharacterBuild("t", "global", 45, class_key="sorcerer", skill_ranks={"cold-storm": rank},
                           stigmas=("cold-storm",))
        assert with_auto_tiers(gd, b).specs.get("cold-storm", ()) == want
    # a build that named other tiers, or tiers of an unequipped stigma: replaced / dropped
    b = CharacterBuild("t", "global", 45, class_key="sorcerer", skill_ranks={"cold-storm": 10}, stigmas=("cold-storm",),
                       specs={"cold-storm": (1,), "soul-freeze": (0,), "flame-arrow": (0,)})
    assert with_auto_tiers(gd, b).specs == {"cold-storm": (0, 1), "flame-arrow": (0,)}


def test_simulator_applies_every_earned_tier_without_specs(gd):
    from aion2c.specs import active_options
    s = gd.skills["cold-storm"]
    b = CharacterBuild("t", "global", 45, class_key="sorcerer", specs={"cold-storm": (3,)})
    assert active_options(gd, b, s, 10) == ((0, 1), [])
    assert active_options(gd, replace(b, specs={}), s, 20) == ((0, 1, 2, 3), [])


def test_optimizer_output_has_all_tiers_and_only_real_stigmas(gd):
    from aion2c.engine import build_optimizer as bo
    from aion2c.engine.search import SearchBudget
    from aion2c.models import total_rank
    b = CharacterBuild("t", "global", 45, class_key="sorcerer", stigma_points=40, skill_points=0)
    assert not b.specs  # no existing specialties
    fb = bo.optimize_full_build(gd, b, "boss", 0, budget=SearchBudget(max_candidates=20))
    builds = [fb.build] + [v.build for v in fb.variants]
    assert fb.build.stigmas
    for x in builds:
        for k in x.stigmas:
            sk = gd.skills[k]
            assert sk.kind == SkillKind.STIGMA, f"{k} is not a stigma"
            tiers = tuple(available_options(gd, sk, total_rank(gd, x, sk)))
            assert x.specs.get(k, ()) == tiers  # every tier earned at this rank, none missing, none extra
            assert all(i < len(sk.specializations) and sk.specializations[i].rank_required for i in tiers)  # joins resolve
        assert set(x.specs) <= set(x.stigmas) | {k for k, s in gd.skills.items() if s.kind != SkillKind.STIGMA}
    wrong = replace(fb.build, stigmas=("flame-arrow",))
    assert any("core skill cannot be equipped as a stigma" in i for i in pg.legality_issues(gd, wrong))
