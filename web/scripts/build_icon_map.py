"""Build aion2c/data/classes/<key>/icon_names.json = {skill_key: ICON_NAME} from the research skills files.

research icon_url (https://aion2.app/db-item-icons/ICON_SO_SKILL_020.webp) -> ICON_SO_SKILL_020, mapped to the
gamedata skill key by skill_id. Names only: no art is read or copied. Run from anywhere: python build_icon_map.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP_CLASSES = ROOT / "app" / "aion2c" / "data" / "classes"
RESEARCH = ROOT / "research"
NAME = re.compile(r"/([A-Za-z0-9_]+)\.(?:webp|png)$")


def research_path(key: str) -> Path:
    return RESEARCH / "sorcerer_skills.json" if key == "sorcerer" else RESEARCH / "classes" / key / "skills.json"


def build(key: str) -> dict[str, str]:
    gd = json.loads((APP_CLASSES / key / "gamedata.json").read_text(encoding="utf-8"))
    by_id = {s["skill_id"]: k for k, s in gd["skills"].items() if s.get("skill_id") is not None}
    out: dict[str, str] = {}
    for s in json.loads(research_path(key).read_text(encoding="utf-8")):
        m = NAME.search(s.get("icon_url") or "")
        k = by_id.get(s.get("skill_id"))
        if m and k:
            out[k] = m.group(1)
    return dict(sorted(out.items()))


def main() -> int:
    for d in sorted(APP_CLASSES.iterdir()):
        if not (d / "gamedata.json").is_file():
            continue
        m = build(d.name)
        total = len(json.loads((d / "gamedata.json").read_text(encoding="utf-8"))["skills"])
        (d / "icon_names.json").write_text(json.dumps(m, indent=1) + "\n", encoding="utf-8")
        print(f"{d.name}: {len(m)}/{total} skills have an icon name")
    return 0


if __name__ == "__main__":
    sys.exit(main())
