"""Public source pipeline witnesses; private exports are never needed by these tests.

Hellfire literals come from research/2026-10-24-sorcerer-combo-objectives.md.
The synthetic tables below are invented inputs testing joins, not copied client rows.
"""
import copy
import json
from dataclasses import replace

import pytest

from aion2c.data import build_gamedata as bg
from aion2c.data import client_export as ce
from aion2c.data.loader import load_gamedata


def _assemble():
    raw = json.loads((bg.REPO / "research/sorcerer_skills.json").read_text(encoding="utf-8"))
    index = {k: {"skill_id": s.skill_id} for k, s in load_gamedata().skills.items() if s.skill_id is not None}
    return bg.assemble(raw, bg.REPO / "research", index, "2026-10-24T00:00:00+00:00")


def test_assembled_hellfire_retains_release_gauge_and_exact_speed_thresholds():
    gd = _assemble()
    rule = gd.rules["hellfire"]
    assert [x.charge_s.value for x in rule.charge_levels] == [.3, .5, 1., 1.5]
    assert [x.stagger_gauge for x in rule.charge_levels] == [20., 25., 30., 35.]
    assert [x.fast_charge_s.value if x.fast_charge_s else None for x in rule.charge_levels] == [.21, .35, .7, 1.05]
    assert [x.hits for x in rule.charge_levels] == [1, 1, 1, 2]
    assert rule.fast_charge_spec == ("hellfire", 0)
    assert gd.skills["hellfire"].specializations[0].rank_required == 8
    for tier in rule.charge_levels:
        assert tier.charge_s.confidence == tier.fast_charge_s.confidence == "confirmed"
        assert ce.SOURCE in tier.charge_s.source and ce.SOURCE in tier.fast_charge_s.source


@pytest.fixture
def synthetic_export(tmp_path):
    """One skill with a speed specialty whose charge ID differs from its variant ID.

    An unrelated faster charge row and a mobile option must never win the join.
    """
    tables = tmp_path / "tables"
    tables.mkdir()
    research, icons = tmp_path / "research", tmp_path / "icons"
    research.mkdir()
    icons.mkdir()
    raw = [{"name": "Hellfire", "skill_id": 15060000,
            "coefficients": {"atk_ratio_pct_rank1": 100},
            "specializations": [{"unlock_level": 8, "text": "+30% Skill Speed"},
                                {"unlock_level": 8, "text": "Changes to mobile skill"}]}]
    (research / "sorcerer_skills.json").write_text(json.dumps(raw), encoding="utf-8")
    (icons / "index.json").write_text(json.dumps({"hellfire": {"skill_id": 15060000}}), encoding="utf-8")
    for ck in ce.CLIENT_CLASS:
        if ck == "sorcerer":
            continue
        (research / "classes" / ck).mkdir(parents=True)
        (research / "classes" / ck / "skills.json").write_text("[]", encoding="utf-8")
        (icons / ck).mkdir()
        (icons / ck / "index.json").write_text("{}", encoding="utf-8")

    def table(name, rows):
        (tables / f"{name}.json").write_text(json.dumps({"Properties": {"Data": rows}}), encoding="utf-8")

    def skill(sid, cid, group):
        return {"ID": {"Value": sid}, "ChargeId": {"Value": cid},
                "SkillEffectTimeDataList": [{"SkillEffectGroupId": {"Value": group}}]}

    table("Skill", [skill(15060000, 901, 41), skill(15060001, 0, 42),
                    skill(15060010, 902, 43), skill(15060011, 0, 44), skill(15060020, 903, 45)])
    table("SpecializedSkillParts", [{"ID": {"Value": sid}, "ParentSkillId": {"Value": 15060000},
                                      "ParentSkillLv": 8} for sid in (15060010, 15060020)])
    table("SkillCharge", [{"ID": {"Value": cid}, "ChargeMinTime": low,
                          "SkillChargeDataList": [{"ChargeTime": high, "ChargeSkillId": {"Value": release}}]}
                         for cid, low, high, release in ((901, 400, 900, 15060001), (902, 250, 600, 15060011),
                                                        (903, 100, 200, 15060011), (15060099, 1, 2, 15060011))])
    table("SkillEffectLv", [{"SkillEffectLvGroupId": group, "SkillEffectLv": 2,
                             "EffectValueList": ["1", "1", ratio, ratio, "1"] + ["0"] * 23}
                            for group, ratio in (("Sorcerer_Skill006_LvUp", "10000"),
                                                 ("Sorcerer_Skill006_LvUp_0", "20000"))])
    table("SkillEffect", [{"ID": {"Value": i}, "SkillEffectGroupId": {"Value": group},
                          "SkillEffectLvGroupId": "None", "EffectType": "ESkillEffectType::GroggyGuardDecreaseEnergy",
                          "EffectValueList": [value], "SkillEffectConditionList": []}
                         for i, group, value in ((1, 41, "11"), (2, 42, "17"))])
    for name in ("SkillAbnormalEffect", "SkillAbnormalEffectLv", "SkillList"):
        table(name, [])
    return tables, research, icons


def _extract(paths):
    return ce.build(*paths)["classes"]["sorcerer"]["skills"]["hellfire"].get("charge", {})


def test_export_joins_charge_and_speed_specialty_instead_of_number_prefix(synthetic_export):
    charge = _extract(synthetic_export)
    assert charge.get("min_ms") == 400
    assert charge.get("tier_ms") == [900]
    assert charge.get("stagger_gauge") == [11., 17.]
    assert charge.get("fast") == {"min_ms": 250, "tier_ms": [600], "option": 0, "unlock_rank": 8}


@pytest.mark.parametrize("mutation", ["wrong_parent", "wrong_unlock", "missing_variant", "missing_charge", "not_speed"])
def test_export_does_not_assign_unjoined_fast_variants(synthetic_export, mutation):
    tables, research, _ = synthetic_export
    if mutation == "not_speed":
        path = research / "sorcerer_skills.json"
        rows = json.loads(path.read_text(encoding="utf-8"))
        rows[0]["specializations"][0]["text"] = "Adds damage"
        path.write_text(json.dumps(rows), encoding="utf-8")
    else:
        name = "SpecializedSkillParts" if mutation in ("wrong_parent", "wrong_unlock") else "Skill"
        path = tables / f"{name}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        rows = data["Properties"]["Data"]
        if mutation == "wrong_parent":
            rows[0]["ParentSkillId"]["Value"] = 15050000
        elif mutation == "wrong_unlock":
            rows[0]["ParentSkillLv"] = 12
        elif mutation == "missing_variant":
            rows[:] = [r for r in rows if r["ID"]["Value"] != 15060010]
        else:
            rows[2]["ChargeId"]["Value"] = 0
        path.write_text(json.dumps(data), encoding="utf-8")
    assert "fast" not in _extract(synthetic_export)


def test_export_missing_or_conditional_gauge_stays_unknown(synthetic_export):
    tables, _, _ = synthetic_export
    path = tables / "SkillEffect.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["Properties"]["Data"] = [data["Properties"]["Data"][0]]
    data["Properties"]["Data"][0]["SkillEffectConditionList"] = [{"Probability": 5000}]
    path.write_text(json.dumps(data), encoding="utf-8")
    assert _extract(synthetic_export).get("stagger_gauge") == [None, None]


def test_missing_release_gauge_never_falls_back_to_scalar_or_certified_zero(monkeypatch):
    numbers = copy.deepcopy(bg.load_client_numbers())
    numbers["classes"]["sorcerer"]["skills"]["hellfire"]["charge"].pop("stagger_gauge", None)
    monkeypatch.setattr(bg, "load_client_numbers", lambda: numbers)
    assert [x.stagger_gauge for x in _assemble().rules["hellfire"].charge_levels] == [None] * 4


@pytest.mark.parametrize("mutation", ["gauge", "normal", "fast", "option", "missing_rule", "missing_levels"])
def test_drift_check_rejects_changed_release_metadata(mutation):
    gd = _assemble()
    rule = gd.rules["hellfire"]
    tiers = list(rule.charge_levels)
    if mutation == "missing_rule":
        del gd.rules["hellfire"]
    elif mutation == "missing_levels":
        rule = replace(rule, charge_levels=())
    elif mutation == "option":
        rule = replace(rule, fast_charge_spec=("hellfire", 2))
    else:
        tier = tiers[0]
        if mutation == "gauge":
            tier = replace(tier, stagger_gauge=999.)
        elif mutation == "normal":
            tier = replace(tier, charge_s=replace(tier.charge_s, value=9.))
        else:
            tier = replace(tier, fast_charge_s=None)
        tiers[0] = tier
        rule = replace(rule, charge_levels=tuple(tiers))
    if mutation != "missing_rule":
        gd.rules["hellfire"] = rule
    numbers = bg.load_client_numbers()["classes"]["sorcerer"]
    res = ce.check_class(gd, numbers["skills"], numbers["unmatched"])
    assert any("hellfire" in p and "charge" in p for p in res["mismatched"]), res


def test_charge_metadata_allowlist_and_historical_provenance():
    numbers = bg.load_client_numbers()
    assert numbers["source"] == "client export 2026-10-04"
    assert numbers.get("client_version") is None
    for cls in numbers["classes"].values():
        for entry in cls["skills"].values():
            if "charge" not in entry:
                continue
            charge = entry["charge"]
            assert set(charge) <= {"min_ms", "tier_ms", "alt_tier_ms", "tiers", "stagger_gauge", "fast"}
            if "fast" in charge:
                assert set(charge["fast"]) == {"min_ms", "tier_ms", "option", "unlock_rank"}
            assert not any(raw in json.dumps(charge) for raw in ("Properties", "ChargeId", "ChargeSkillId", "EffectValueList"))


@pytest.mark.parametrize("ck,key,option", [("cleric", "bolt", 2), ("ranger", "deadshot", 1),
                                          ("templar", "punishment", 2)])
def test_other_speed_specialties_keep_their_actual_owner_option_without_invented_gauge(ck, key, option):
    # Independently read specialty ordering in research/classes/<class>/skills.json;
    # charge rows alone cannot establish which option enables them.
    charge = bg.load_client_numbers()["classes"][ck]["skills"][key]["charge"]
    assert charge["fast"] == {"min_ms": 210, "tier_ms": [350, 700, 1050], "option": option, "unlock_rank": 8}
    assert "stagger_gauge" not in charge


@pytest.mark.parametrize("mutation", ["wrong_unlock", "out_of_range", "not_speed", "not_faster"])
def test_builder_refuses_invalid_exact_speed_metadata(monkeypatch, mutation):
    numbers = copy.deepcopy(bg.load_client_numbers())
    fast = numbers["classes"]["sorcerer"]["skills"]["hellfire"]["charge"]["fast"]
    if mutation == "wrong_unlock":
        fast["unlock_rank"] = 12
    elif mutation == "out_of_range":
        fast["option"] = 99
    elif mutation == "not_speed":
        fast["option"] = 2
    else:
        fast["min_ms"] = 300
        fast["tier_ms"] = [500, 1000, 1500]
    monkeypatch.setattr(bg, "load_client_numbers", lambda: numbers)
    rule = _assemble().rules["hellfire"]
    assert rule.fast_charge_spec is None
    assert [x.fast_charge_s for x in rule.charge_levels] == [None] * 4


def test_builder_does_not_guess_four_releases_onto_three_damage_tiers():
    from aion2c.models import ChargeLevel, Num, SkillRule
    gd = load_gamedata(class_key="ranger")
    gd.rules["deadshot"] = SkillRule("deadshot", charge_levels=tuple(
        ChargeLevel(i, Num(None, "unknown", "unmapped timing"), Num(float(i), "estimated", "authored damage"))
        for i in (1, 2, 3)))
    rule = bg.apply_client_charge_metadata(gd, bg.load_client_numbers()).rules["deadshot"]
    assert [x.charge_s.value for x in rule.charge_levels] == [None] * 3
    assert [x.stagger_gauge for x in rule.charge_levels] == [None] * 3
    assert rule.fast_charge_spec is None


def test_cli_refreshes_reviewed_charge_metadata_without_original_icon_files(tmp_path, monkeypatch):
    import sys
    from aion2c import serde

    gd = load_gamedata()
    path = tmp_path / "gamedata.json"
    path.write_text(json.dumps(serde.to_dict(gd)), encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["build_gamedata", "--charge-metadata-only", "--out", str(path),
                                    "--icons", str(tmp_path / "absent-icons")])
    bg.main()
    refreshed = load_gamedata(path)

    assert refreshed.rules["hellfire"].charge_levels[3].fast_charge_s.value == 1.05
    assert refreshed.rules["hellfire"].charge_levels[0].stagger_gauge == 20
    assert refreshed.data_version == gd.data_version
    assert refreshed.skills == gd.skills
    assert not (tmp_path / "absent-icons").exists()
