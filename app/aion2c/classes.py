"""The eight playable classes. `armory_pc_ids` are ids seen in the public armory: the class-list ids
(research/armory_samples/classes.json) plus pcIds seen in profiles (Sorcerer: 28, info.json).
Unknown ids are left empty, never guessed. Armory import matches on the class NAME first."""
from dataclasses import dataclass
from typing import Literal

Role = Literal["melee_dps", "ranged_dps", "tank", "healer", "support"]
DEFAULT_CLASS = "sorcerer"


@dataclass(frozen=True)
class ClassInfo:
    key: str
    name: str
    role: Role
    armory_pc_ids: tuple[int, ...] = ()
    icon: str | None = None


CLASSES: tuple[ClassInfo, ...] = (
    ClassInfo("gladiator", "Gladiator", "melee_dps", (2,)),
    ClassInfo("templar", "Templar", "tank", (3,)),
    ClassInfo("assassin", "Assassin", "melee_dps", (5,)),
    ClassInfo("ranger", "Ranger", "ranged_dps", (4,)),
    ClassInfo("sorcerer", "Sorcerer", "ranged_dps", (28, 7)),
    ClassInfo("spiritmaster", "Spiritmaster", "support", (6,)),  # the API calls it "Elementalist"
    ClassInfo("cleric", "Cleric", "healer", (8,)),
    ClassInfo("chanter", "Chanter", "support", (9,)),
)
_BY_KEY = {c.key: c for c in CLASSES}
_ALIASES = {"elementalist": "spiritmaster"}


def class_info(key: str) -> ClassInfo | None:
    return _BY_KEY.get(key)


def class_name(key: str) -> str:
    c = _BY_KEY.get(key)
    return c.name if c else key.title()


def key_from_armory(class_name: str | None = None, pc_id: int | None = None) -> str | None:
    """Class key for an armory profile (`className` first, then `pcId`), or None if unrecognised."""
    n = (class_name or "").strip().lower().replace(" ", "")
    n = _ALIASES.get(n, n)
    if n in _BY_KEY:
        return n
    if pc_id is not None:
        for c in CLASSES:
            if pc_id in c.armory_pc_ids:
                return c.key
    return None
