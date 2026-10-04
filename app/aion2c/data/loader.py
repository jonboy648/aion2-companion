"""Gamedata loading. Per-class files live in aion2c/data/classes/<key>/gamedata.json."""
import json
from pathlib import Path

from aion2c.models import GameData, Region, Skill
from aion2c.serde import from_dict
from aion2c.specparse import finalize_gamedata

CLASSES_DIR = Path(__file__).with_name("classes")


def class_dir(class_key: str = "sorcerer") -> Path:
    return CLASSES_DIR / class_key


def default_path(class_key: str = "sorcerer") -> Path:
    return class_dir(class_key) / "gamedata.json"


def available_classes() -> list[str]:
    """Class keys whose gamedata.json exists, in `aion2c.classes.CLASSES` order."""
    from aion2c.classes import CLASSES

    return [c.key for c in CLASSES if default_path(c.key).is_file()]


def load_gamedata(path: Path | None = None, class_key: str = "sorcerer") -> GameData:
    """Load `path`, or the shipped file for `class_key`. A file without its own class_key gets `class_key`."""
    p = Path(path) if path is not None else default_path(class_key)
    with open(p, encoding="utf-8") as f:
        d = json.load(f)
    d.setdefault("class_key", class_key)
    # files built before specialties were structured get their effects parsed here (no-op when specs_parsed)
    return finalize_gamedata(from_dict(GameData, d))


def allowed_skills(gd: GameData, region: Region, show_kr: bool) -> list[Skill]:
    """Skills whose `regions` contain `region`, or any region when `show_kr`."""
    return [s for s in gd.skills.values() if show_kr or region in s.regions]
