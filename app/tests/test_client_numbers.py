"""Guards for the private client-export pipeline (app/aion2c/data/client_export.py).

The raw export is private: nothing from it may live in the repo except our own small derived numbers file.
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest

from aion2c.data import build_gamedata as bg
from aion2c.data import client_export as ce

REPO = bg.REPO
NUMBERS = bg.SRC_DIR / "client_skill_numbers.json"
SKIP_DIRS = {".git", "node_modules", "dist", "dist_compare", "dist_guide", "dist_verify", "__pycache__", ".pytest_cache",
             "shots", ".shots-ui-tools"}
TEXT_SUFFIX = {".py", ".md", ".json", ".ts", ".tsx", ".js", ".mjs", ".cmd", ".txt", ".html", ".css", ".toml", ".yml", ".yaml"}
# the export lives in a private tools folder; the pattern is assembled so this file does not match itself
RAW_PATH = re.compile("aion2-" + "tools[\\\\/]+export-" + "test", re.I)


def _repo_files():
    for root, dirs, files in os.walk(REPO):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            p = Path(root) / f
            if p.suffix.lower() in TEXT_SUFFIX and p.stat().st_size < 30_000_000:
                yield p


def test_no_file_contains_the_raw_export_path():
    hits = [str(p.relative_to(REPO)) for p in _repo_files()
            if RAW_PATH.search(p.read_text(encoding="utf-8", errors="ignore"))]
    assert not hits, f"raw export path found in: {hits}"


def test_no_raw_table_dump_in_repo():
    """No file in the repo is a decoded client table ({"Version", "Ids", "Properties": {"Data": [...]}})."""
    bad = []
    for p in _repo_files():
        if p.suffix.lower() != ".json" or p.stat().st_size < 200_000:
            continue
        head = p.read_text(encoding="utf-8", errors="ignore")[:2000]
        if '"Properties"' in head and '"Data"' in head:
            bad.append(str(p.relative_to(REPO)))
    assert not bad, bad


def test_derived_file_is_small_and_has_only_our_keys():
    assert NUMBERS.is_file(), "run python -m aion2c.data.client_export with AION2_EXPORT_DIR set"
    assert NUMBERS.stat().st_size < 1_500_000
    d = json.loads(NUMBERS.read_text(encoding="utf-8"))
    assert set(d) == {"schema", "source", "note", "classes"}
    allowed_entry = {"ratio_pct", "ratio_constant", "hits", "from_rank", "flat_min", "flat_max", "how", "charge", "dots"}
    text = NUMBERS.read_text(encoding="utf-8")
    assert "SkillEffectLv" not in text and "EffectValueList" not in text and "Properties" not in text
    for ck, c in d["classes"].items():
        assert set(c) == {"skills", "unmatched", "ratio_varies", "name_differs"}
        gd_keys = set(json.loads((bg.PKG_DATA / "classes" / ck / "gamedata.json").read_text(encoding="utf-8"))["skills"])
        assert set(c["skills"]) <= gd_keys, f"{ck}: keys that are not ours: {set(c['skills']) - gd_keys}"
        for k, e in c["skills"].items():
            assert set(e) <= allowed_entry, (ck, k, set(e) - allowed_entry)
            assert all(isinstance(x, (int, float)) for x in e.get("flat_min", []) + e.get("flat_max", []))


def test_script_refuses_to_run_without_the_env_var(monkeypatch):
    monkeypatch.delenv(ce.ENV_VAR, raising=False)
    with pytest.raises(SystemExit) as ei:
        ce.export_dir()
    assert ce.ENV_VAR in str(ei.value)


def test_script_reads_no_path_argument():
    """The export directory comes only from the environment (no --export/--table CLI option)."""
    src = Path(ce.__file__).read_text(encoding="utf-8")
    assert "add_argument(\"--export" not in src and "add_argument(\"--table" not in src
    r = subprocess.run([sys.executable, "-m", "aion2c.data.client_export"], capture_output=True, text=True,
                       env={k: v for k, v in os.environ.items() if k != ce.ENV_VAR},
                       cwd=str(Path(ce.__file__).resolve().parents[2]))
    assert r.returncode != 0 and ce.ENV_VAR in (r.stderr + r.stdout)


# ---- client_skill_details.json: cooldown / range / kind / hits (separate file, separate step) ---------------------------
DETAILS = bg.SRC_DIR / bg.CLIENT_DETAILS_FILE
DETAIL_FIELDS = {"cooldown_s", "range_m", "kind", "hits"}


def _details():
    return json.loads(DETAILS.read_text(encoding="utf-8"))


def test_details_file_is_small_and_has_only_our_keys():
    assert DETAILS.is_file(), "run python -m aion2c.data.client_export with AION2_EXPORT_DIR set"
    assert DETAILS.stat().st_size < 20_000  # corrections only, not a dump
    d = _details()
    assert set(d) == {"schema", "source", "note", "classes"}
    text = DETAILS.read_text(encoding="utf-8")
    for raw in ("SkillEffectLv", "EffectValueList", "Properties", "NeedCoolTime", "SkillLvGroupId", "client_id"):
        assert raw not in text
    from aion2c.models import SkillKind
    kinds = {k.value for k in SkillKind}
    for ck, skills in d["classes"].items():
        gd_keys = set(json.loads((bg.PKG_DATA / "classes" / ck / "gamedata.json").read_text(encoding="utf-8"))["skills"])
        assert set(skills) <= gd_keys, f"{ck}: keys that are not ours: {set(skills) - gd_keys}"
        for k, e in skills.items():
            assert e and set(e) <= DETAIL_FIELDS, (ck, k, set(e) - DETAIL_FIELDS)
            cd = e.get("cooldown_s", 0.0)
            assert all(isinstance(x, (int, float)) and x >= 0 for x in (cd if isinstance(cd, list) else [cd]))
            assert isinstance(e.get("range_m", 0.0), (int, float)) and isinstance(e.get("hits", 1), int)
            assert e.get("kind", "stigma") in kinds


def test_details_script_is_a_separate_step():
    """client_export writes the details file through its own function, to its own path."""
    assert ce.DETAILS_OUT_PATH == DETAILS and ce.DETAILS_OUT_PATH != ce.OUT_PATH
    assert callable(ce.build_skill_details) and callable(ce.write_skill_details)
    assert callable(bg.apply_client_details) and callable(bg.load_client_details)


def test_details_fix_the_known_client_discrepancies():
    """Applied on top of whatever gamedata.json is committed (the step is idempotent)."""
    from aion2c.data.loader import load_gamedata
    from aion2c.models import SkillKind
    details, numbers = bg.load_client_details(), bg.load_client_numbers()
    sk = {ck: bg.apply_client_details(load_gamedata(class_key=ck).skills, details, ck, numbers)
          for ck in ("templar", "chanter", "ranger", "cleric", "gladiator", "sorcerer", "assassin", "spiritmaster")}
    cd = lambda ck, k: {r.cooldown_s.value for r in sk[ck][k].ranks}  # noqa: E731
    assert cd("templar", "noble-armor") == {120.0} and cd("chanter", "guardian-blessing") == {120.0}
    for ck, k in (("ranger", "concentrated-fire"), ("ranger", "rooting-eye"), ("ranger", "melee-fire"), ("ranger", "hunters-soul"),
                  ("cleric", "empyrean-lords-grace"), ("chanter", "raging-spell"), ("chanter", "winds-promise")):
        # client NeedCoolTime is 0 but the tooltip states "Cooldown: 1s": that is the proc's internal cooldown, kept
        assert cd(ck, k) == {1.0} and "cooldown_s" not in details["classes"][ck].get(k, {}), (ck, k)
    assert sk["gladiator"]["predation"].range_m == 40.0 and sk["gladiator"]["wrathful-strike-11350000"].range_m == 4.0
    assert sk["sorcerer"]["cold-snap"].range_m == 20.0 and sk["sorcerer"]["cold-snap-15730000"].range_m is None
    for ck, k in (("gladiator", "doom-advent"), ("templar", "blade-storm"), ("assassin", "frenzied-accord"),
                  ("assassin", "prepare-to-assassinate"), ("sorcerer", "lumiels-authority")):
        assert sk[ck][k].kind == SkillKind.STIGMA, (ck, k)
    for k in ("use-spirit-summon-skill", "use-spirit-summon-skill-16257000"):
        assert sk["spiritmaster"][k].kind == SkillKind.SYSTEM
    assert sk["assassin"]["breaking-slice"].hits == 3 and sk["assassin"]["swift-slice"].hits == 4


def test_apply_client_details_rules():
    from dataclasses import replace
    from aion2c.data.loader import load_gamedata
    from aion2c.models import SkillKind
    gd = load_gamedata(class_key="assassin")
    ch = next(k for k, s in gd.skills.items() if s.kind == SkillKind.CHAIN and k != "breaking-slice")
    skills = {**gd.skills, "breaking-slice": replace(gd.skills["breaking-slice"], hits=1)}
    det = {"source": "t", "classes": {"assassin": {
        "breaking-slice": {"hits": 3, "cooldown_s": [1.0, 2.0], "range_m": 0.0},
        ch: {"kind": "stigma"}, "no-such-skill": {"hits": 9}}}}
    out = bg.apply_client_details(skills, det, "assassin")
    bs = out["breaking-slice"]
    assert bs.hits == 3 and bs.range_m is None  # a client range of 0 means no targeted range
    assert [r.cooldown_s.value for r in bs.ranks[:3]] == [1.0, 2.0, 2.0] and bs.ranks[0].cooldown_s.confidence == "confirmed"
    assert out[ch].kind == SkillKind.CHAIN  # a chain child is never retyped
    assert bg.apply_client_details(skills, None, "assassin") is skills
    # a hit count the numbers file already sets wins over this step
    nums = {"classes": {"assassin": {"skills": {"breaking-slice": {"hits": 2}}}}}
    assert bg.apply_client_details(skills, det, "assassin", nums)["breaking-slice"].hits == 1


def test_detail_tables_read_cooldown_range_type_hits_and_names(tmp_path):
    """DetailTables on a tiny synthetic export (our own invented rows, not client data)."""
    def skill(sid, typ="ESkillType::Active", stigma=False, cd=0.0, rng=400.0, lv="None", groups=()):
        return {"ID": {"Value": sid}, "SkillType": typ, "bIsStigmaSkill": stigma, "NeedCoolTime": cd,
                "NeedSkillUseRange": rng, "SkillLvGroupId": lv, "SkillString_Key": f"STR_SKILL_PC_ASSASSIN_{sid}",
                "SkillEffectTimeDataList": [{"SkillEffectGroupId": {"Value": g}} for g in groups]}

    def table(name, rows):
        (tmp_path / f"{name}.json").write_text(json.dumps({"Properties": {"Data": rows}}), encoding="utf-8")

    table("Skill", [skill(13030000, cd=0.0, groups=(5, 6)), skill(13230000, stigma=True, cd=30000.0, rng=2000.0, lv="g1"),
                    skill(13990001, typ="ESkillType::System"), skill(13990002, typ="ESkillType::System")])
    table("SkillLv", [{"SkillLvGroupId": "g1", "SkillLv": 2, "NeedCoolTime": 28000.0}])
    vals = ["1", "1", "100", "100", "3"] + ["0"] * 23
    table("SkillEffect", [{"EffectType": "ESkillEffectType::Stun", "SkillEffectGroupId": {"Value": 5}, "EffectValueList": vals},
                          {"EffectType": "ESkillEffectType::Damage", "SkillEffectGroupId": {"Value": 6}, "EffectValueList": vals}])
    (tmp_path / "L10N" / "en-US").mkdir(parents=True)
    names = {f"SkillString_STR_SKILL_PC_ASSASSIN_{i}_skill_name": n for i, n in
             ((13030000, "Breaking Slice"), (13230000, "Aerial Bind"), (13990001, "Twin"), (13990002, "Twin"))}
    (tmp_path / "L10N" / "en-US" / "L10NString.json").write_text(json.dumps({"Entries": names}), encoding="utf-8")
    t = ce.DetailTables(tmp_path)
    assert t.skill[13230000]["type"] == "stigma" and t.skill[13030000]["type"] == "active" and t.skill[13990001]["type"] == "system"
    assert (t.cooldown(13230000, 1), t.cooldown(13230000, 2), t.cooldown(13230000, 9)) == (30.0, 28.0, 30.0)
    assert t.skill[13230000]["range_m"] == 20.0
    assert t.hit_count(13030000) == 3 and t.hit_count(13230000) is None  # the first Damage row, not the Stun row
    assert sorted(t.by_name["ASSASSIN"]["twin"]) == [13990001, 13990002]
    assert ce._differs(1.0, 0.0) and ce._differs(300.0, 120.0) and not ce._differs(20.0, 20.5)
