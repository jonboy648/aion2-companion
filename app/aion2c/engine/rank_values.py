"""Rank-aware buff values.

The shipped class data values every buff status at ONE anchor rank (its notes say "rank 20 used", "rank 16 used as the
typical rank", "rank 10 used"), so a rank-1 Light of Protection carried the rank-16 +18% and the point allocator saw
nothing to gain from ranking it up. A status that carries `rank_scales` (class data, `mechanics.json`) is re-valued
by `rank_valued(gd, build)` at the rank the build really holds in the skill that applies it (`total_rank`: skill
points + Daevanion + bonus ranks, region capped).

The curves are the client tokens quoted in each status's own data note (duration 10 s at rank 1, 14.5 at 10, 17.5 at 16,
20 at 20, 22.5 at 25; PvE Damage Boost 10.5 / 15 / 18 / 20 / 22.5 at the same ranks; a few passives have their own two to
four anchors). Between anchors the value is interpolated linearly, outside them clamped. A `RankScale.at_rank` is the rank
the data's own single value is stated at, so the curve must return that value there (`tests/test_optimizer_community.py`
checks every row against the shipped data).
"""
from dataclasses import replace

from aion2c.models import CharacterBuild, GameData, Num, total_rank


def interp(anchors: tuple, rank: float) -> float:
    """Piecewise-linear value at `rank`, clamped to the first and last anchor."""
    if rank <= anchors[0][0]:
        return anchors[0][1]
    for (r0, v0), (r1, v1) in zip(anchors, anchors[1:]):
        if rank <= r1:
            return v0 + (v1 - v0) * (rank - r0) / (r1 - r0)
    return anchors[-1][1]


def _tag(n: Num, text: str) -> Num:
    return Num(n.value, n.confidence, f"{n.source} | {text}")


_CACHE: dict[tuple, tuple] = {}  # (id(gd), source ranks) -> (gd, re-valued gd); gd kept alive so ids stay unique
_SCALED: dict[int, tuple] = {}  # id(gd) -> (gd, [(status key, RankScale)...]); empty for data without rank scales


def _scaled(gd: GameData) -> list:
    hit = _SCALED.get(id(gd))
    if hit is None or hit[0] is not gd:
        hit = (gd, [(k, rs) for k, st in gd.statuses.items() for rs in st.rank_scales if rs.skill in gd.skills])
        if len(_SCALED) > 64:
            _SCALED.clear()
        _SCALED[id(gd)] = hit
    return hit[1]


def rank_valued(gd: GameData, build: CharacterBuild) -> GameData:
    """`gd` with every status that has `rank_scales` valued at the build's own rank of its source skill."""
    scaled = _scaled(gd)
    if not scaled:
        return gd
    ranks = {rs.skill: total_rank(gd, build, gd.skills[rs.skill]) for _k, rs in scaled}
    ck = (id(gd), tuple(sorted(ranks.items())))
    hit = _CACHE.get(ck)
    if hit is not None and hit[0] is gd:
        return hit[1]
    sts = dict(gd.statuses)
    for key, rs in scaled:
        st = sts[key]
        r = ranks[rs.skill]
        v = round(interp(rs.anchors, r), 4)
        note = f"rank-aware: rank {r} of {rs.skill}"
        if rs.target == "duration":
            if st.duration_s.value:  # 0 = permanent aura: nothing to scale
                sts[key] = replace(st, duration_s=_tag(replace(st.duration_s, value=v), note))
        else:
            mods = tuple(replace(m, value=_tag(replace(m.value, value=v), note)) if m.stat == rs.target else m
                         for m in st.stat_mods)
            sts[key] = replace(st, stat_mods=mods)
    out = replace(gd, statuses=sts)
    if len(_CACHE) > 256:
        _CACHE.clear()
    _CACHE[ck] = (gd, out)
    return out
