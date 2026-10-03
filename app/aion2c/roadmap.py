"""Road map: gd.roadmap plus auto items from skill unlock levels. P4 owns this file."""
from aion2c.models import CharacterBuild, GameData, Region, RoadmapItem, SkillKind

# Skills reached only through chains, procs or charge tiers are not "unlocked" on their own.
_NOT_UNLOCKABLE = (SkillKind.CHAIN, SkillKind.PROC, SkillKind.CHARGE_TIER, SkillKind.SYSTEM, SkillKind.DODGE)


def roadmap(gd: GameData, region: Region, build: CharacterBuild | None = None) -> list[RoadmapItem]:
    """Items for `region` up to its level cap, sorted by level (stable within a level).

    With `build.show_kr`, Korea-only skill unlocks are added on global too (cap still applies).
    """
    cap = gd.level_caps[region]
    show_kr = bool(build and build.show_kr)
    items = [i for i in gd.roadmap if region in i.regions and i.level <= cap]
    listed = {(i.level, i.text.lower()) for i in items if i.kind == "skill"}
    for sk in gd.skills.values():
        lvl = sk.unlock_level
        if lvl is None or sk.kind in _NOT_UNLOCKABLE or lvl > cap:
            continue
        if region not in sk.regions and not (show_kr and sk.regions):
            continue
        text = f"Unlock {sk.name}"
        if (lvl, text.lower()) in listed or any(
            i.level == lvl and i.kind == "skill" and sk.name.lower() in i.text.lower() for i in items
        ):
            continue
        items.append(RoadmapItem(lvl, "skill", text, sk.regions))
    items.sort(key=lambda i: i.level)
    return items
