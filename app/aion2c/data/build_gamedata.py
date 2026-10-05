"""Build gamedata.json from research files. P1 owns the body.

Inputs: research/sorcerer_skills.json (+ daevanion/crafting JSON), assets/icons/index.json and the
hand-authored files in aion2c/data/src (mechanics, chains, community rotations, roadmap).
`assemble()` is shared with update.py, which feeds it freshly parsed skill pages.
"""
import argparse
import json
import re
import shutil
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

from aion2c.models import (
    CommunityRotation, DaevanionBoard, DaevanionEffect, DaevanionNode, GameData, Link, Num,
    RankData, RankScale, Recipe, RecipeMaterial, RoadmapItem, Skill, SkillKind, SkillRule, Specialization,
    StatMod, Status, StatusTrigger,
)
from aion2c.serde import from_dict, to_dict
from aion2c.specparse import finalize_gamedata

from aion2c.data.loader import class_dir

PKG_DATA = Path(__file__).resolve().parent
SRC_DIR = PKG_DATA / "src"
REPO = Path(__file__).resolve().parents[3]  # D:\Aion2
DUMP_DATE = "2026-09-18"
DUMP_SRC = f"aion2.app client dump {DUMP_DATE}"
# data_contract 1.7: verified only on the KR/TW client, may not exist at global launch
# Burst (15030000) and Pyroclasm (15250000) were removed 2026-10-03: Global sources (sportskeeda,
# shugo.gg, 2026-10-02) confirm the Flame Arrow > Burst > Pyroclasm chain on Global. The armory skill
# list never shows chain children, so it can't confirm or refute the rest of this list.
# Cold Wave (15100000), Winter's Illusion (15330000) and Curse: Old Tree (15340000) removed 2026-10-03: same wrong
# source as Burst/Pyroclasm (open_questions Q3b: shugo.gg lists them on Global; Curse: Old Tree is the weakest evidence).
KR_ONLY_IDS = frozenset({15000000, 15020000, 15180000, 15270000,
                         15290000, 15350000, 15380000})
CATEGORY_KIND = {"active": SkillKind.ACTIVE, "passive": SkillKind.PASSIVE, "stigma": SkillKind.STIGMA,
                 "system_passive": SkillKind.SYSTEM, "basic_dodge": SkillKind.DODGE,
                 "passive_proc": SkillKind.PROC}
LINK_CHILD_KIND = {"chain": SkillKind.CHAIN, "upgrade": SkillKind.CHAIN, "cancel": SkillKind.CHAIN,
                   "proc": SkillKind.PROC, "charge": SkillKind.CHARGE_TIER}


def slugify(name: str) -> str:
    """Delete apostrophes first, then non-alphanumerics -> '-' (matches assets/icons/index.json)."""
    s = name.lower().replace("'", "").replace("\u2019", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def _src(name: str, src_dir: Path = SRC_DIR):
    return json.loads((Path(src_dir) / name).read_text(encoding="utf-8"))


_SRC_FILES = ("mechanics", "chains", "community_rotations", "roadmap")


class ClassSources:
    """Where one class's inputs live. Sorcerer keeps its historical locations; every other class
    reads research/classes/<key>/ with the same schemas."""

    def __init__(self, research_dir: Path, icons_dir: Path | None, class_key: str = "sorcerer"):
        self.key = class_key
        research_dir = Path(research_dir)
        if class_key == "sorcerer":
            self.skills = research_dir / "sorcerer_skills.json"
            self.src = SRC_DIR
            self.daevanion = research_dir / "daevanion_sorcerer.json"
        else:
            cdir = research_dir / "classes" / class_key
            self.skills, self.src, self.daevanion = cdir / "skills.json", cdir, cdir / "daevanion.json"
        self.crafting = research_dir / "crafting.json"
        self.icons = Path(icons_dir) / class_key if icons_dir is not None else None
        self.index = self.icons / "index.json" if self.icons is not None else None
        if class_key == "sorcerer" and icons_dir is not None:  # historical: index.json sits in assets/icons
            self.index = Path(icons_dir) / "index.json"

    def missing(self) -> list[str]:
        """Input files this class still lacks (empty = buildable)."""
        need = [self.skills, self.daevanion, self.crafting] + [self.src / f"{n}.json" for n in _SRC_FILES]
        return [str(p) for p in need if not p.is_file()]

    def available(self) -> bool:
        return not self.missing()


def assign_keys(raw_skills: list[dict], index: dict, lenient: bool = False) -> list[str]:
    """Key per raw entry: index.json slug via skill_id, slug from name when the id is null."""
    by_id = {int(v["skill_id"]): slug for slug, v in index.items()}
    keys: list[str] = []
    for raw in raw_skills:
        sid = raw.get("skill_id")
        if sid is not None:
            if sid not in by_id and lenient:  # non-sorcerer class: icon-less official skill -> name slug
                slug = slugify(raw["name"])
                keys.append(f"{slug}-{sid}" if slug in keys else slug)
                continue
            if sid not in by_id:
                raise ValueError(f"skill id {sid} ({raw['name']}) missing from icons index")
            keys.append(by_id[sid])
        else:
            keys.append(slugify(raw["name"]))
    if len(set(keys)) != len(keys):
        raise ValueError("duplicate skill keys")
    return keys


def _tag(raw: dict) -> str:
    return raw.get("metaroad_tag") or raw.get("client_type") or ""


def _ref(ref, id_key: dict, name_key: dict) -> str:
    table = id_key if isinstance(ref, int) else name_key
    if ref not in table:
        raise ValueError(f"chains.json references unknown skill {ref!r}")
    return table[ref]


def build_links(chains: dict, raw_skills: list[dict], keys: list[str]) -> tuple[Link, ...]:
    id_key = {r["skill_id"]: k for r, k in zip(raw_skills, keys) if r.get("skill_id") is not None}
    name_key = {r["name"]: k for r, k in zip(raw_skills, keys) if r.get("skill_id") is None}
    return tuple(Link(_ref(e["parent"], id_key, name_key), _ref(e["child"], id_key, name_key),
                      e["kind"], e["confidence"]) for e in chains["links"])


def _num_ratio(raw: dict, has_attack: bool) -> Num:
    ratio = (raw.get("coefficients") or {}).get("atk_ratio_pct_rank1")
    if ratio is not None:
        return Num(float(ratio), "estimated", "rank-1 ratio from dump/Metaroad, applied at all ranks (assumption)")
    if has_attack:
        return Num(0.0, "unknown", "ratio hidden in every source")
    return Num(0.0, "confirmed", "no damage component (tag has no Attack)")


def _ranks(raw: dict, has_attack: bool) -> tuple[RankData, ...]:
    out = []
    for pl in raw.get("per_level") or []:
        lo, hi = pl.get("dmg_min"), pl.get("dmg_max")
        if lo is None or hi is None:
            flat = (Num(None, "unknown", "no flat damage in client dump") if has_attack
                    else Num(0.0, "confirmed", "no damage component (tag has no Attack)"))
            fmin = fmax = flat
        else:
            fmin, fmax = Num(float(lo), "confirmed", DUMP_SRC), Num(float(hi), "confirmed", DUMP_SRC)
        out.append(RankData(pl["level"], fmin, fmax,
                            Num(float(pl["cooldown_s"]), "confirmed", DUMP_SRC),
                            Num(float(pl["cost_mp"]), "confirmed", DUMP_SRC)))
    if not out and raw.get("cooldown_s") is not None and (raw.get("cost") or {}).get("mp") is not None:
        unk = Num(None, "unknown", "Metaroad row carries no damage")
        out.append(RankData(1, unk, unk, Num(float(raw["cooldown_s"]), "estimated", "Metaroad row"),
                            Num(float(raw["cost"]["mp"]), "estimated", "Metaroad row")))
    return tuple(out)


def _tags(raw: dict) -> tuple[str, ...]:
    parts = [t.strip().lower() for t in _tag(raw).split("\u00b7") if t.strip()]
    props = raw.get("properties") or ""
    if props and "{" not in props and "@" not in props:
        parts += [p.strip().lower() for p in props.split("|") if p.strip()]
    return tuple(dict.fromkeys(parts))


def _stagger_gauge(raw: dict) -> float | None:
    """Datamine `coefficients.stagger_gauge_damage` ("2", "20-35") as a number (range -> upper bound)."""
    v = (raw.get("coefficients") or {}).get("stagger_gauge_damage")
    nums = re.findall(r"\d+(?:\.\d+)?", str(v)) if v is not None else []
    return float(nums[-1]) if nums else None


def _stagger_only(raw: dict, desc: str) -> bool:
    """Damage is stagger gauge only: the text names no damage besides 'Stagger Gauge Damage' and no ratio/flat."""
    if (raw.get("coefficients") or {}).get("atk_ratio_pct_rank1"):
        return False
    if any(pl.get("dmg_min") or pl.get("dmg_max") for pl in raw.get("per_level") or []):
        return False
    return not re.search(r"damage", re.sub(r"Stagger Gauge Damage", "", desc, flags=re.I), re.I)


def stat_effects_to_mods(mech: dict) -> tuple[dict[str, list[StatMod]], list[str]]:
    """mechanics.json `stat_effects` (status, stat, value, unit, applies_to) -> StatMods per status key.
    Only applies_to == "all" entries whose stat is a live Stats field are converted; the rest are returned as
    skipped notes (never dropped silently)."""
    named = {"Combat Speed": "combat_speed_pct", "Cooldown Reduction": "cdr_pct", "Critical Damage Boost": "crit_dmg_pct",
             "PvE Damage Boost": "dmg_boost_pct", "Damage Boost": "dmg_boost_pct", "Attack": "attack_increase_pct"}
    out: dict[str, list[StatMod]] = {}
    skipped: list[str] = []
    for e in mech.get("stat_effects", []):
        what = f"{e.get('status')}: {e.get('stat')} {e.get('value')}{e.get('unit', '')}"
        if e.get("applies_to") != "all":
            skipped.append(f"{what} (applies_to {e.get('applies_to')}: skill-specific, not modelled)")
            continue
        conf, src = e.get("confidence", "estimated"), e.get("source", "mechanics.json stat_effects")
        stat, val = e.get("stat"), e.get("value")
        if stat in named and e.get("unit") == "%":
            out.setdefault(e["status"], []).append(StatMod(named[stat], Num(float(val), conf, src)))
        elif stat == "Critical Hit" and e.get("unit") == "flat":
            # rating -> % : crit chance caps at 80% at a 1,200 gap (sorcerer_builds_and_dps.md S1/S3), read linear
            out.setdefault(e["status"], []).append(StatMod("crit_chance_pct", Num(
                float(val) * 80.0 / 1200.0, "estimated", f"{src}; rating converted at 80%/1200 points (estimated)")))
        else:
            skipped.append(f"{what} (no live-stat conversion)")
    return out, skipped


def build_skills(raw_skills: list[dict], keys: list[str], links: tuple[Link, ...], mech: dict,
                 icon_files: dict[str, str]) -> dict[str, Skill]:
    child_kind: dict[str, str] = {}
    parent_of: dict[str, str] = {}
    for ln in links:
        if ln.kind != "condition":
            child_kind[ln.child_key] = ln.kind
            parent_of[ln.child_key] = ln.parent_key
    long_skills = set(mech["anim_lock"]["long_skills"])
    anim_default = from_dict(Num, mech["anim_lock"]["default"])
    anim_long = from_dict(Num, mech["anim_lock"]["long"])
    unlock = {k: r.get("unlock_level") for r, k in zip(raw_skills, keys)}
    for _ in range(4):  # children inherit the parent's level (burst -> pyroclasm needs 2 passes)
        for child, parent in parent_of.items():
            if unlock[child] is None and unlock.get(parent) is not None:
                unlock[child] = unlock[parent]
    elem_of: dict[str, str] = {}
    for r, k in zip(raw_skills, keys):
        m = (re.search(r"\b(Fire|Water|Earth)\b", _tag(r))
             or re.search(r"\b(Fire|Water|Earth) damage", r.get("description") or ""))
        elem_of[k] = m.group(1).lower() if m else mech["element_overrides"].get(k, "none")
    for _ in range(4):
        for child, parent in parent_of.items():
            if elem_of[child] == "none" and child not in mech["element_overrides"]:
                elem_of[child] = elem_of.get(parent, "none")
    skills: dict[str, Skill] = {}
    for raw, key in zip(raw_skills, keys):
        kind = SkillKind(mech["kind_overrides"][key]) if key in mech["kind_overrides"] else (
            LINK_CHILD_KIND[child_kind[key]] if key in child_kind
            else CATEGORY_KIND.get(raw["category"], SkillKind.ACTIVE))
        tag = _tag(raw)
        has_attack = "Attack" in tag
        ranks = _ranks(raw, has_attack)
        desc = raw.get("description") or ""
        hits = re.search(r"\((\d+) hits?\)", desc)
        aoe = re.search(r"up to (\d+) enemies", desc)
        sid = raw.get("skill_id")
        stagger = _stagger_gauge(raw)
        tags_extra = ("stagger_only",) if stagger is not None and _stagger_only(raw, desc) else ()
        if sid is not None:
            icon = icon_files.get(key)
        else:  # id-less children share a parent's icon, e.g. charge tiers (mechanics.icon_prefix_aliases)
            icon = next((fn for pre, fn in mech.get("icon_prefix_aliases", {}).items() if key.startswith(pre)), None)
        skills[key] = Skill(
            key=key, skill_id=sid, name=raw["name"], name_kr=raw.get("name_kr"), kind=kind,
            element=elem_of[key], unlock_level=unlock[key],
            max_rank=len(ranks) if ranks else (raw.get("max_skill_level") or 1),
            regions=frozenset({"korea"} if sid in KR_ONLY_IDS or sid in mech.get("korea_only_ids", ()) else {"global", "korea"}),
            atk_ratio_pct=_num_ratio(raw, has_attack), ranks=ranks, range_m=raw.get("range_m"),
            aoe_targets=int(aoe.group(1)) if aoe else 1, hits=int(hits.group(1)) if hits else 1,
            anim_lock_s=anim_long if key in long_skills else anim_default, icon=icon,
            description=desc,
            tags=tuple(dict.fromkeys(_tags(raw) + tuple(mech.get("skill_tags", {}).get(key, ())) + tags_extra)),
            specializations=tuple(Specialization(s.get("unlock_level"), s["text"])
                                  for s in raw.get("specializations") or []),
            hp_dmg_coeff=0.0 if tags_extra else 1.0, stagger_gauge=stagger)
    return skills


CLIENT_NUMBERS_FILE = "client_skill_numbers.json"
CLIENT_DETAILS_FILE = "client_skill_details.json"


def load_client_numbers(src_dir: Path = SRC_DIR) -> dict | None:
    """Derived per-skill numbers from the private client export (client_export.py); None when absent."""
    p = Path(src_dir) / CLIENT_NUMBERS_FILE
    return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else None


def apply_client_numbers(skills: dict[str, Skill], numbers: dict | None, class_key: str) -> dict[str, Skill]:
    """Overwrite atk_ratio_pct, hits and per-rank flat damage with the client's numbers where a skill was matched;
    everything else (unmatched skills, rank 1, cooldown, MP, ranks the client table lacks) keeps its current value."""
    if not numbers:
        return skills
    src = numbers["source"]
    entries = numbers["classes"].get(class_key, {}).get("skills", {})
    out = dict(skills)
    for key, e in entries.items():
        sk = out.get(key)
        if sk is None or "ratio_pct" not in e:
            continue
        table = {"dot": "SkillAbnormalEffect", "effect-row": "SkillEffect"}.get(e.get("how"), "SkillEffectLv")
        conf = lambda v: Num(float(v), "confirmed", f"{src} ({table})")  # noqa: E731
        tiers, lo_rank = (e.get("charge") or {}).get("tiers"), e["from_rank"]
        ranks = []
        if not sk.ranks and lo_rank == 1:  # a placeholder with no table of its own (a Spirit's assault): the client rows are all of it
            free = lambda why: Num(0.0, "confirmed", why)  # noqa: E731
            ranks = [RankData(i + 1, conf(e["flat_min"][i]), conf(e["flat_max"][i]),
                              free("fires with its Jointstrike cast; no cooldown row"), free("a Spirit skill costs no MP"))
                     for i in range(len(e["flat_min"]))]
        for r in sk.ranks:
            i = r.rank - lo_rank
            if 0 <= i < len(e["flat_min"]):
                fmax = e["flat_max"][i]
                if tiers:  # the table's base group is the lowest charge tier; our flat_max is the top tier
                    fmax = tiers[-1]["flat_min"][i]
                elif (r.flat_min.value is not None and r.flat_max.value is not None
                      and r.flat_max.value > r.flat_min.value):
                    fmax = r.flat_max.value  # a charge range we have no tier groups for: keep our top end
                r = replace(r, flat_min=conf(e["flat_min"][i]), flat_max=conf(fmax))
            ranks.append(r)
        out[key] = replace(sk, atk_ratio_pct=conf(e["ratio_pct"]), hits=e["hits"], ranks=tuple(ranks))
    return out


# ---- client skill details step: cooldown, range, skill type, hit count (client_skill_details.json) ----------------------
# Separate from client_skill_numbers.json above: its own file, loader and apply step (see client_export.py).
def load_client_details(src_dir: Path = SRC_DIR) -> dict | None:
    """Derived cooldown/range/kind/hits corrections from the private client export; None when the file is absent."""
    p = Path(src_dir) / CLIENT_DETAILS_FILE
    return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else None


def apply_client_details(skills: dict[str, Skill], details: dict | None, class_key: str,
                         numbers: dict | None = None) -> dict[str, Skill]:
    """Apply the client's cooldown (every rank), range, skill kind and hit count to the skills listed for this class.
    Kind only turns a plain `active` skill into the client's `stigma`/`system` (chain/proc/charge children and kind
    overrides keep theirs); a client range of 0 means no targeted range (None); a hit count that
    client_skill_numbers.json already sets for the skill is left to that step."""
    if not details:
        return skills
    src = details["source"]
    covered = {k for k, e in ((numbers or {}).get("classes", {}).get(class_key, {}).get("skills", {})).items() if "hits" in e}
    out = dict(skills)
    for key, e in details["classes"].get(class_key, {}).items():
        sk = out.get(key)
        if sk is None:
            continue
        changes: dict = {}
        if "cooldown_s" in e:
            cds = e["cooldown_s"]
            ranks = tuple(replace(r, cooldown_s=Num(float(cds[min(i, len(cds) - 1)] if isinstance(cds, list) else cds),
                                                    "confirmed", f"{src} (Skill NeedCoolTime)"))
                          for i, r in enumerate(sk.ranks))
            changes["ranks"] = ranks
        if "range_m" in e:
            changes["range_m"] = float(e["range_m"]) or None
        if "kind" in e and sk.kind == SkillKind.ACTIVE:
            changes["kind"] = SkillKind(e["kind"])
        if "hits" in e and key not in covered:
            changes["hits"] = int(e["hits"])
        if changes:
            out[key] = replace(sk, **changes)
    return out


def apply_client_dots(statuses: dict[str, Status], mech: dict, numbers: dict | None, class_key: str) -> dict[str, Status]:
    """mechanics.json `client_dots` {status: {skill, group, rank1_flat}} -> tick ratio, interval and per-rank flat."""
    if not numbers:
        return statuses
    src = numbers["source"]
    out = dict(statuses)
    for skey, spec in (mech.get("client_dots") or {}).items():
        d = numbers["classes"].get(class_key, {}).get("skills", {}).get(spec["skill"], {}).get("dots", {}).get(spec["group"])
        if d is None or skey not in out:  # numbers file lacks it (or a reduced test tree): keep the status as authored
            continue
        assert d["from_rank"] == 2, "client DoT tables start at level 2"
        flat = (Num(float(spec["rank1_flat"]), "estimated", spec["rank1_source"]),) + tuple(
            Num(float(f), "confirmed", f"{src} (SkillAbnormalEffectLv)") for f in d["flat"])
        out[skey] = replace(
            out[skey], tick_flat_ranks=flat,
            tick_ratio_pct=Num(d["ratio_pct"], "confirmed", f"{src} (SkillAbnormalEffectLv)"),
            tick_s=Num(d["interval_ms"] / 1000, "confirmed", f"{src} (SkillAbnormalEffectLv)"))
    return out


def build_daevanion(path: Path, skills: dict[str, Skill]) -> dict[str, DaevanionBoard]:
    id_key = {s.skill_id: k for k, s in skills.items() if s.skill_id is not None}
    boards: dict[str, DaevanionBoard] = {}
    for b in json.loads(path.read_text(encoding="utf-8"))["boards"]:
        nodes: dict[int, DaevanionNode] = {}
        for n in b["nodes"]:
            sk = None
            if n.get("skill_id") is not None:
                sk = id_key.get(int(n["skill_id"]))
                if sk is None:
                    raise ValueError(f"daevanion node {n['id']} names unknown skill id {n['skill_id']}")
            nodes[n["id"]] = DaevanionNode(
                id=n["id"], name=n["name"], rarity=n.get("rarity") or "", cost=n["cost"],
                node_type=n["node_type"],
                effects=tuple(DaevanionEffect(e["stat"], float(e["value"]), e["unit"]) for e in n["effects"]),
                skill_key=sk, adjacent=tuple(n["adjacent"]), x=n["x"], y=n["y"])
        boards[b["key"]] = DaevanionBoard(b["key"], b["name"], b["unlock_level"], nodes, b["start_node_id"])
    return boards


def build_recipes(path: Path) -> tuple[Recipe, ...]:
    out = []
    for r in json.loads(path.read_text(encoding="utf-8"))["recipes"]:
        o = r["output"]
        out.append(Recipe(
            # research notes like "Armorsmithing (aion2hub label: Tailoring)" stay out of what users see
            id=r["id"], name=r["name"], profession=r["profession"].split(" (aion2hub label")[0], level=r.get("level"),
            output_item=o["item"], output_qty=o["qty"], item_level=o.get("item_level"), grade=o.get("grade"),
            materials=tuple(RecipeMaterial(m["item"], m["qty"], m.get("source")) for m in r["materials"]),
            base_materials=tuple(RecipeMaterial(m["item"], m["qty"]) for m in r.get("base_materials_expanded") or []),
            sorc_relevant=r.get("sorc_relevant"), source_url=r["source_url"]))
    return tuple(out)


def _validate(gd: GameData) -> None:
    sk, st = gd.skills, gd.statuses
    for key, r in gd.rules.items():
        bad = ([k for k in (key, r.chain_next) if k is not None and k not in sk]
               + [s for s in (*r.applies, *r.requires, *r.consumes) if s not in st])
        if bad:
            raise ValueError(f"rule {key} references unknown keys {bad}")
    for t in gd.triggers:
        refs = [k for k in (t.proc_skill, t.reset_skill, *t.on_skills) if k]
        if ((t.status_key or not (t.proc_skill or t.reset_skill)) and t.status_key not in st) or t.source_skill not in sk                 or any(k not in sk for k in refs) or (t.on_status and t.on_status not in st):
            raise ValueError(f"trigger {t} references unknown keys")
    for s_ in sk.values():
        for sp in s_.specializations:
            for e in sp.effects:
                bad = [k for k in (e.skill_key, e.on_skill) if k and k not in sk]
                bad += [k for k in (e.status_key,) if k and k not in st]
                bad += [k for k in (e.requires_status,) if k and k != "@own" and k not in st]
                if bad:
                    raise ValueError(f"specialty effect of {s_.key} references unknown keys {bad}")
    for s in st.values():
        if s.source_skill is not None and s.source_skill not in sk:
            raise ValueError(f"status {s.key} source_skill {s.source_skill} unknown")
    for c in gd.community:
        missing = [k for k in c.priority if k not in sk]
        if missing:
            raise ValueError(f"community rotation {c.key} names unknown skills {missing}")


def apply_rank_scales(gd: GameData, mech: dict) -> GameData:
    """mechanics.json `rank_scales` {status key: [{skill, target, anchors, at_rank}]} -> Status.rank_scales.
    Applied after finalize_gamedata because some of the statuses (spec_*_buff) are only created there."""
    table = mech.get("rank_scales") or {}
    statuses = dict(gd.statuses)
    for key, rows in table.items():
        if key not in statuses:
            raise ValueError(f"rank_scales names unknown status {key}")
        bad = [r["skill"] for r in rows if r["skill"] not in gd.skills]
        if bad:
            raise ValueError(f"rank_scales of {key} name unknown skills {bad}")
        statuses[key] = replace(statuses[key], rank_scales=tuple(from_dict(RankScale, r) for r in rows))
    return replace(gd, statuses=statuses)


def assemble(raw_skills: list[dict], research_dir: Path, index: dict, built_at: str,
             dump_date: str = DUMP_DATE, class_key: str = "sorcerer") -> GameData:
    """Pure in-memory build (no file writes). update.py passes freshly parsed skills here."""
    srcs = ClassSources(research_dir, None, class_key)
    keys = assign_keys(raw_skills, index, lenient=class_key != "sorcerer")
    mech, chains = _src("mechanics.json", srcs.src), _src("chains.json", srcs.src)
    links = build_links(chains, raw_skills, keys)
    indexed = {int(v["skill_id"]) for v in index.values()}
    icon_files = {k: f"{k}.png" for r, k in zip(raw_skills, keys)
                  if r.get("skill_id") is not None and (class_key == "sorcerer" or r["skill_id"] in indexed)}
    skills = build_skills(raw_skills, keys, links, mech, icon_files)
    client = load_client_numbers()
    skills = apply_client_numbers(skills, client, class_key)
    skills = apply_client_details(skills, load_client_details(), class_key, client)
    gd = GameData(
        schema_version=1, data_version=f"{built_at[:10]}+aion2app-{dump_date}", built_at=built_at,
        level_caps={"global": 45, "korea": 50},
        rank_caps={"global": {"core": 20, "stigma": 20}, "korea": {"core": 40, "stigma": 25}},
        stigma_slots={"global": 4, "korea": 6},
        skills=skills,
        statuses=apply_client_dots({k: from_dict(Status, v) for k, v in mech["statuses"].items()}, mech, client, class_key),
        rules={k: from_dict(SkillRule, v) for k, v in mech["rules"].items()},
        triggers=tuple(from_dict(StatusTrigger, t) for t in mech["triggers"]),
        links=links,
        community=tuple(from_dict(CommunityRotation, c) for c in _src("community_rotations.json", srcs.src)),
        roadmap=tuple(from_dict(RoadmapItem, r) for r in _src("roadmap.json", srcs.src)),
        daevanion=build_daevanion(srcs.daevanion, skills),
        recipes=build_recipes(srcs.crafting),
        class_key=class_key)
    mods, _skipped = stat_effects_to_mods(mech)
    for sk_key, ms in mods.items():
        if sk_key in gd.statuses:
            st = gd.statuses[sk_key]
            gd.statuses[sk_key] = replace(st, stat_mods=st.stat_mods + tuple(ms))
    gd = finalize_gamedata(gd, mech.get("specialization_effects") or {}, mech.get("spec_slot_ranks"))
    gd = apply_rank_scales(gd, mech)
    _validate(gd)
    return gd


def copy_icons(icons_dir: Path, gd: GameData, dest: Path | None = None) -> None:
    """Copy the class's icons (assets/icons/<class>/) into aion2c/data/classes/<class>/icons."""
    dest = Path(dest) if dest is not None else class_dir(gd.class_key) / "icons"
    dest.mkdir(parents=True, exist_ok=True)
    for name in sorted({s.icon for s in gd.skills.values() if s.icon}):
        src = Path(icons_dir) / gd.class_key / name
        if not src.is_file():
            raise FileNotFoundError(f"icon {src} missing")
        out = dest / name
        if not out.is_file() or out.stat().st_size != src.stat().st_size:
            shutil.copyfile(src, out)


def write_gamedata(gd: GameData, out_path: Path) -> None:
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(to_dict(gd), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def build(research_dir: Path, icons_dir: Path, out_path: Path, built_at: str | None = None,
          class_key: str = "sorcerer", icons_dest: Path | None = None) -> GameData:
    research_dir, icons_dir = Path(research_dir), Path(icons_dir)
    srcs = ClassSources(research_dir, icons_dir, class_key)
    raw = json.loads(srcs.skills.read_text(encoding="utf-8"))
    index = json.loads(srcs.index.read_text(encoding="utf-8"))
    built_at = built_at or datetime.now(timezone.utc).isoformat(timespec="seconds")
    gd = assemble(raw, research_dir, index, built_at, class_key=class_key)
    copy_icons(icons_dir, gd, icons_dest)  # default aion2c/data/classes/<class>/icons
    write_gamedata(gd, out_path)
    return gd


def main() -> None:
    from aion2c.classes import CLASSES
    from aion2c.data.loader import default_path
    ap = argparse.ArgumentParser(description="Build aion2c/data/classes/<class>/gamedata.json from research files")
    ap.add_argument("--research", type=Path, default=REPO / "research")
    ap.add_argument("--icons", type=Path, default=REPO / "assets" / "icons")
    ap.add_argument("--class", dest="class_key", default="sorcerer", choices=[c.key for c in CLASSES])
    ap.add_argument("--all", action="store_true", help="build every class whose research files exist")
    ap.add_argument("--out", type=Path, default=None, help="output file (single class only)")
    ap.add_argument("--built-at", default=None)
    a = ap.parse_args()
    if a.all:
        todo = []
        for c in CLASSES:
            miss = ClassSources(a.research, a.icons, c.key).missing()
            if miss:
                print(f"[{c.key}] skipped, missing: " + ", ".join(Path(m).name for m in miss))
            else:
                todo.append(c.key)
    else:
        todo = [a.class_key]
    for key in todo:
        out = a.out if (a.out and not a.all) else default_path(key)
        gd = build(a.research, a.icons, out, a.built_at, key)
        n_icon = sum(1 for s in gd.skills.values() if s.icon)
        print(f"[{key}] wrote {out}: {len(gd.skills)} skills ({n_icon} with icons), {len(gd.statuses)} statuses, "
              f"{len(gd.rules)} rules, {len(gd.links)} links, {len(gd.daevanion)} daevanion boards, "
              f"{len(gd.recipes)} recipes, data_version {gd.data_version}")


if __name__ == "__main__":
    main()
