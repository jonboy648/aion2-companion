"""Specialty slots and option gating (data-driven; see models.SPEC_SLOT_RANKS).

A skill has up to 5 specialty options (`Skill.specializations`, 0-based index = option). Option i can be picked
once skill rank >= `rank_required`; the number of options equipped at once is the number of slots open at that
rank (`GameData.spec_slot_ranks`). `CharacterBuild.specs[skill_key]` holds the chosen 0-based option indices.
"""
from aion2c.models import CharacterBuild, GameData, Skill, SkillKind


def slots_at(gd: GameData, rank: int) -> int:
    """Specialty slots open at skill `rank`."""
    return sum(1 for n in gd.spec_slot_ranks if n.value is not None and n.value <= rank)


def available_options(gd: GameData, skill: Skill, rank: int) -> list[int]:
    """Option indices whose rank requirement is met at `rank` (no slot limit applied)."""
    return [i for i, sp in enumerate(skill.specializations) if sp.rank_required is None or sp.rank_required <= rank]


def slot_room(gd: GameData, skill: Skill, rank: int) -> int:
    """How many options of `skill` apply at once at `rank`. Mastery: the open selectable slots (8/12/20), and an option
    the data lets you pick implies at least one. Stigma: its Parts tiers (options at 5/10/15/20) activate automatically
    (SpecializedSkillParts InitEquipSlotType, slots bUserEditSlot=false), so every available option applies."""
    avail = len(available_options(gd, skill, rank))
    if skill.kind == SkillKind.STIGMA:
        return avail
    return max(slots_at(gd, rank), 1 if avail else 0)


def active_options(gd: GameData, build: CharacterBuild, skill: Skill, rank: int) -> tuple[tuple[int, ...], list[str]]:
    """(options that actually apply, reasons the rest were ignored). Order = the build's order; extra picks
    beyond the open slots, unavailable ranks, bad indices and duplicates are dropped, never silently: the
    second element names each one."""
    chosen = build.specs.get(skill.key, ())
    ok: list[int] = []
    why: list[str] = []
    avail = set(available_options(gd, skill, rank))
    if skill.kind == SkillKind.STIGMA:
        # Parts tiers activate on their own at ranks 5/10/15/20 whatever the build lists (docs/adr/0003)
        return tuple(sorted(avail)), []
    room = slot_room(gd, skill, rank)
    for i in chosen:
        if i in ok:
            continue
        if not 0 <= i < len(skill.specializations):
            why.append(f"{skill.name}: specialty option {i + 1} does not exist")
        elif i not in avail:
            need = skill.specializations[i].rank_required
            why.append(f"{skill.name}: specialty option {i + 1} needs rank {need} (rank {rank})")
        elif len(ok) >= room:
            why.append(f"{skill.name}: specialty option {i + 1} ignored, only {room} slot(s) open at rank {rank}")
        else:
            ok.append(i)
    return tuple(ok), why
