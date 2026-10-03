"""Re-pull aion2.app skill pages and diff. P1 owns the body. Never runs in tests.

CLI: python -m aion2c.data.update [--dry-run]
Fetches https://aion2.app/db/skills/{id} for every skill id at 0.5 s spacing, patches the per-rank
numbers into the research skills in memory, rebuilds, prints the diff against the shipped file and
(unless --dry-run) writes the new file with a bumped data_version. Any fetch failure leaves the
shipped file untouched.
"""
import argparse
import dataclasses
import html as html_lib
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from aion2c.models import GameData, Num

PAGE_URL = "https://aion2.app/db/skills/{id}"
HEADERS = {"User-Agent": "Mozilla/5.0 (personal-companion-app; low-rate)"}

_LEVEL_RE = re.compile(
    r'\{"level":(\d+),"cooldown":([\d.]+),"cost_mp":([\d.]+),"cost_hp":[\d.]+,"cost_dp":[\d.]+,'
    r'"casting_time":[\d.]+,"dmg_min":(null|"[\d.]+"),"dmg_max":(null|"[\d.]+")')


def _dmg(tok: str) -> float | None:
    return None if tok == "null" else float(tok.strip('"'))


def _seconds(text: str) -> float | None:
    m = re.match(r"\s*([\d.]+)\s*s", text or "")
    return float(m.group(1)) if m else None


def parse_skill_page(html: str) -> dict:
    """Skill page HTML -> {name, skill_id, icon, class, required_level, max_level, cooldown_s,
    range_m, description, date_modified, per_level:[{level, cooldown_s, cost_mp, dmg_min, dmg_max}]}.
    The page ships its data twice: JSON-LD in a plain script and Next.js flight data with escaped
    quotes; unescaping the quotes lets one set of regexes read both."""
    text = html.replace('\\"', '"')
    h1 = re.search(r"<h1[^>]*>([^<]+)", html)
    sid = re.search(r'rel="canonical" href="https://aion2\.app/db/skills/(\d+)"', text)
    icon = re.search(r'"image":"https://aion2\.app/db-item-icons/([A-Za-z0-9_]+)\.webp"', text)
    props = dict(re.findall(r'\{"@type":"PropertyValue","name":"([^"]+)","value":"([^"]*)"\}', text))
    desc = re.search(r'"@type":"Thing","name":"[^"]*","description":"((?:[^"\\]|\\.)*)"', text)
    levels: dict[int, dict] = {}
    for m in _LEVEL_RE.finditer(text):
        lvl = int(m.group(1))
        levels[lvl] = {"level": lvl, "cooldown_s": float(m.group(2)), "cost_mp": float(m.group(3)),
                       "dmg_min": _dmg(m.group(4)), "dmg_max": _dmg(m.group(5))}
    try:
        description = json.loads(f'"{desc.group(1)}"') if desc else ""
    except ValueError:
        description = desc.group(1) if desc else ""
    range_m = re.match(r"\s*([\d.]+)\s*m", props.get("Range", ""))
    cls = re.search(r'"additionalType":"([^"]+)"', text)
    date = re.search(r'"dateModified":"([\d-]+)"', text)
    return {
        "name": html_lib.unescape(h1.group(1)).strip() if h1 else None,
        "skill_id": int(sid.group(1)) if sid else None,
        "icon": icon.group(1) if icon else None,
        "class": cls.group(1) if cls else None,
        "required_level": int(props["Required level"]) if props.get("Required level", "").isdigit() else None,
        "max_level": int(props["Max"]) if props.get("Max", "").isdigit() else None,
        "cooldown_s": _seconds(props.get("Cooldown", "")),
        "range_m": float(range_m.group(1)) if range_m else None,
        "description": description,
        "date_modified": date.group(1) if date else None,
        "per_level": [levels[k] for k in sorted(levels)],
    }


_SKILL_FIELDS = ("name", "kind", "element", "unlock_level", "max_rank", "regions", "range_m",
                 "aoe_targets", "hits", "icon", "description")
_RANK_FIELDS = ("cooldown_s", "mp_cost", "flat_min", "flat_max")


def _nv(n: Num) -> tuple:
    return (n.value, n.confidence)


def _diff_dict(label: str, old: dict, new: dict, lines: list[str]) -> None:
    for k in sorted(old.keys() - new.keys()):
        lines.append(f"{label} {k!r}: removed")
    for k in sorted(new.keys() - old.keys()):
        lines.append(f"{label} {k!r}: added")
    for k in sorted(old.keys() & new.keys()):
        if old[k] != new[k]:
            lines.append(f"{label} {k!r}: changed")


def diff_gamedata(old: GameData, new: GameData) -> list[str]:
    """Human-readable change lines; one line per (skill, field) so a single edit is a single line."""
    lines: list[str] = []
    for k in sorted(old.skills.keys() - new.skills.keys()):
        lines.append(f"skill {k!r} ({old.skills[k].name}): removed")
    for k in sorted(new.skills.keys() - old.skills.keys()):
        lines.append(f"skill {k!r} ({new.skills[k].name}): added")
    for k in sorted(old.skills.keys() & new.skills.keys()):
        a, b = old.skills[k], new.skills[k]
        tag = f"skill {k!r} ({a.name})"
        for f in _SKILL_FIELDS:
            if getattr(a, f) != getattr(b, f):
                lines.append(f"{tag}: {f} {getattr(a, f)!r} -> {getattr(b, f)!r}")
        for f in ("atk_ratio_pct", "anim_lock_s"):
            if _nv(getattr(a, f)) != _nv(getattr(b, f)):
                lines.append(f"{tag}: {f} {_nv(getattr(a, f))} -> {_nv(getattr(b, f))}")
        if len(a.ranks) != len(b.ranks):
            lines.append(f"{tag}: rank count {len(a.ranks)} -> {len(b.ranks)}")
            continue
        for f in _RANK_FIELDS:
            ch = [(ra.rank, ra, rb) for ra, rb in zip(a.ranks, b.ranks)
                  if _nv(getattr(ra, f)) != _nv(getattr(rb, f))]
            if ch:
                r, ra, rb = ch[0]
                lines.append(f"{tag}: {f} changed at {len(ch)} rank(s), first rank {r}: "
                             f"{getattr(ra, f).value} -> {getattr(rb, f).value}")
    _diff_dict("status", old.statuses, new.statuses, lines)
    _diff_dict("rule", old.rules, new.rules, lines)
    _diff_dict("daevanion board", old.daevanion, new.daevanion, lines)
    for label, x, y in (("triggers", old.triggers, new.triggers), ("links", old.links, new.links),
                        ("community rotations", old.community, new.community),
                        ("roadmap", old.roadmap, new.roadmap), ("recipes", old.recipes, new.recipes)):
        if x != y:
            lines.append(f"{label}: changed ({len(x)} -> {len(y)} entries)")
    return lines


def _fetch(url: str) -> str:
    import urllib.request
    req = urllib.request.Request(url, headers=HEADERS)
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8")


def _patch(raw: dict, page: dict) -> None:
    """Overlay freshly parsed per-rank numbers onto a research skill entry."""
    fresh = {p["level"]: p for p in page["per_level"]}
    if not fresh or len(fresh) != len(raw.get("per_level") or []):
        return
    for pl in raw["per_level"]:
        p = fresh.get(pl["level"])
        if p:
            pl.update(dmg_min=p["dmg_min"], dmg_max=p["dmg_max"], cooldown_s=p["cooldown_s"], cost_mp=p["cost_mp"])
    raw["cooldown_s"] = raw["per_level"][0]["cooldown_s"]


def main() -> None:
    from aion2c.data.build_gamedata import REPO, assemble, write_gamedata
    from aion2c.data.loader import default_path, load_gamedata
    ap = argparse.ArgumentParser(description="Re-pull aion2.app skill pages and diff against gamedata.json")
    ap.add_argument("--dry-run", action="store_true", help="print the diff, write nothing")
    ap.add_argument("--research", type=Path, default=REPO / "research")
    ap.add_argument("--icons", type=Path, default=REPO / "assets" / "icons")
    ap.add_argument("--delay", type=float, default=0.5)
    a = ap.parse_args()
    raw_skills = json.loads((a.research / "sorcerer_skills.json").read_text(encoding="utf-8"))
    index = json.loads((a.icons / "index.json").read_text(encoding="utf-8"))
    old = load_gamedata()
    dates, failures = [], []
    for raw in raw_skills:
        if raw.get("skill_id") is None:
            continue
        try:
            page = parse_skill_page(_fetch(PAGE_URL.format(id=raw["skill_id"])))
        except Exception as e:  # network or markup problem: keep going, refuse to write below
            failures.append(f"{raw['name']} ({raw['skill_id']}): {e}")
            continue
        finally:
            time.sleep(a.delay)
        if page["name"] != raw["name"]:
            print(f"warning: page name {page['name']!r} != {raw['name']!r}", file=sys.stderr)
        _patch(raw, page)
        if page["date_modified"]:
            dates.append(page["date_modified"])
    for f in failures:
        print("FETCH FAILED:", f, file=sys.stderr)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    new = assemble(raw_skills, a.research, index, now, dump_date=max(dates) if dates else old.data_version.split("aion2app-")[-1])
    lines = diff_gamedata(old, new)
    print("\n".join(lines) if lines else "no changes")
    if a.dry_run or failures or not lines:
        print("dry run" if a.dry_run else "file left untouched" + (" (fetch failures)" if failures else ""))
        return
    if new.data_version == old.data_version:
        new = dataclasses.replace(new, data_version=old.data_version + ".1")
    write_gamedata(new, default_path())
    print(f"wrote {default_path()} data_version {new.data_version}")


if __name__ == "__main__":
    main()
