"""Legal progression facts from the Global client export (data/client_progression.json, derived by
data/client_export.py; see docs/adr/0004 and research/progression_connections_2026-10-05.md).

Level budgets are CUMULATIVE totals of one Exp row (never sum rows) and are a leveling baseline, not the wallet of an
imported character. Rank gates are the character level SkillAcquireData needs to buy each rank. Skills with no
acquisition row (procs, charge children) have no gate here: callers get None, never a guessed level. Qt-free.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from aion2c.models import CharacterBuild, GameData, Skill

DATA_PATH = Path(__file__).parent / "data" / "client_progression.json"


@lru_cache(maxsize=1)
def _data() -> dict:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


@dataclass(frozen=True)
class LevelBudget:
    skill: int
    stigma: int
    stigma_slots: int
    daevanion: int


def level_budget(level: int) -> LevelBudget:
    """Cumulative skill / stigma points, stigma slots and Daevanion crystals a character of `level` has earned from
    levelling alone (quest and dungeon rewards come on top and are not included)."""
    rows = _data()["levels"]
    return LevelBudget(*rows[max(1, min(level, len(rows))) - 1])


def stigma_unlock_level() -> int:
    return _data()["stigma_unlock"]["level"]


def mastery_slot_levels() -> tuple[int, ...]:
    return tuple(_data()["mastery_slot_levels"])


def rank_levels(skill: "Skill") -> tuple[int, ...] | None:
    """Character level needed to buy rank 1, 2, ... of `skill` (None when the client has no acquisition rows for it)."""
    got = _data()["ranks"].get(str(skill.skill_id)) if skill.skill_id is not None else None
    return tuple(got) if got else None


def rank_gate(skill: "Skill", rank: int) -> int | None:
    """Character level at which `rank` of `skill` can be bought; None = no paid acquisition row for that rank."""
    lv = rank_levels(skill)
    return lv[rank - 1] if lv and 1 <= rank <= len(lv) else None


def max_rank_at_level(skill: "Skill", level: int, cap: int) -> int:
    """Highest paid rank (<= cap) whose gate is met at `level`. Ranks are bought in order, so a failed gate stops
    the count. A skill without acquisition rows is limited by `cap` alone."""
    lv = rank_levels(skill)
    if lv is None:
        return cap
    n = 0
    for g in lv[:cap]:
        if g > level:
            break
        n += 1
    return n


@dataclass(frozen=True)
class StigmaUnlock:
    unlocked: bool
    basis: str  # "explicit" (build.stigma_unlocked), "ranks" (a stigma rank is held), "level" (inferred from level only)

    @property
    def inferred(self) -> bool:
        return self.basis != "explicit"


def stigma_unlock(gd: "GameData", build: "CharacterBuild") -> StigmaUnlock:
    """Whether stigmas can be bought. The real gate is Ascension grade 3 plus the faction quest, which a level alone
    does not prove: `build.stigma_unlocked` is the user's word, otherwise a held stigma rank proves it and the level
    gate (22) is the weak fallback (basis "level")."""
    from aion2c.models import SkillKind
    if build.stigma_unlocked is not None:
        return StigmaUnlock(build.stigma_unlocked, "explicit")
    if any(r > 0 and (s := gd.skills.get(k)) is not None and s.kind == SkillKind.STIGMA
           for k, r in build.skill_ranks.items()):
        return StigmaUnlock(True, "ranks")
    return StigmaUnlock(build.level >= stigma_unlock_level(), "level")


def legality_issues(gd: "GameData", build: "CharacterBuild") -> list[str]:
    """Plain-English list of what in `build` the game would not allow. Nothing is capped or removed: manual and
    imported builds are reported as they are."""
    from aion2c.models import SkillKind
    out: list[str] = []
    unlock = stigma_unlock(gd, build)
    for k, r in sorted(build.skill_ranks.items()):
        s = gd.skills.get(k)
        if s is None or r <= 0:
            continue
        if s.kind == SkillKind.STIGMA and not unlock.unlocked:
            out.append(f"{s.name}: stigma rank {r} but stigmas are not unlocked.")
        gate = rank_gate(s, r)
        if gate is not None and gate > build.level:
            out.append(f"{s.name}: rank {r} needs character level {gate} (level {build.level}).")
    slots = level_budget(build.level).stigma_slots
    if len(build.stigmas) > slots:
        out.append(f"{len(build.stigmas)} stigmas equipped but level {build.level} has {slots} slot(s).")
    for k in build.stigmas:
        s = gd.skills.get(k)
        if s is not None and s.kind != SkillKind.STIGMA:
            out.append(f"{s.name}: a core skill cannot be equipped as a stigma.")
    if build.stigmas and not unlock.unlocked:
        out.append("Stigmas are equipped but not unlocked.")
    return out
