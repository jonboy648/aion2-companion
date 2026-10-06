"""Gear data + "max potential / upgrade path" engine. Qt-free.

Items come from data/items.json (build_items.py). Gear is turned into a Stats delta, and every
ranking is a real engine simulation (module-level `simulate` / `optimize_full_build`, patchable).

Assumptions (flagged in notes, not hidden):
  * the rating -> % conversion CRIT_RATING_PER_PCT is a guess; the endpoint gives raw ratings.
  * Critical Attack (CriticalAddDamage) is a FLAT stat in the client (StatCorrectionNumber DivideNumber 0, shown
    without %), not percent crit damage, so it is not converted into crit_dmg_pct. Its exact use in the damage
    formula is server-side; the kit total is about 20-100 against hits of thousands, so it is left out of the DPS
    model (it shows up under "not modelled"). The percent crit stat is AmplifyCriticalDamage.
  * random sub-stat lines are not in the armory, so a real item is scored at the pool's expected value: each pool line
    is drawn with the client's RandomWeight, `sub_count` lines without replacement (reading the weights as draw
    probabilities is an interpretation, the client only stores them; without weights the pool is averaged uniformly).
  * enchant adds the client's own per-level stat series (data/items.json `enchant_series`), not a linear fit; Exceed
    adds the stat set of its level (a level replaces the one before it) and is part of every ranking and upgrade path.
    Enchant and Exceed success odds are exposed as data (`enchant_odds`, `exceed_odds`), not yet priced into a move.
  * build.stats is taken to INCLUDE the currently equipped gear (relative upgrades), see `base_stats`.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field, fields, replace
from functools import lru_cache
from pathlib import Path

from aion2c.classes import class_name
from aion2c.engine.build_optimizer import PLAYSTYLES, _heuristic_priority, optimize_full_build
from aion2c.engine.simulator import simulate
from aion2c.models import CharacterBuild, GameData, SearchBudget, SimConfig, Stats

ITEMS_PATH = Path(__file__).parent / "data" / "items.json"
REACHABLE_IL = 85  # IL 86-102 Uniques may not be obtainable at launch
CRIT_RATING_PER_PCT = 100.0
DEITY_PCT_PER_POINT = 0.1  # armory: Death 28 -> Critical Hit +2.8%, Time 38 -> Combat Speed +3.8%, ...
PREFILTER_K = 6  # candidates per slot that get a real simulation

# slot instances; items carry the family ("earring"), instances add the index
SLOTS = ("weapon", "offhand", "helmet", "shoulder", "torso", "legs", "gloves", "boots", "cape", "belt",
         "necklace", "earring1", "earring2", "ring1", "ring2", "bracelet1", "bracelet2", "amulet")
# official armory slotPos -> slot instance (bracelet2=16 is a guess; arcana slots are not mapped)
ARMORY_SLOTPOS = {1: "weapon", 2: "offhand", 3: "helmet", 4: "shoulder", 5: "torso", 6: "legs", 7: "gloves",
                  8: "boots", 10: "necklace", 11: "earring1", 12: "earring2", 13: "ring1", 14: "ring2",
                  15: "bracelet1", 16: "bracelet2", 17: "belt", 19: "cape", 22: "amulet"}

# item stat id -> (Stats field, multiplier per raw unit)
_FLAT = {
    "WeaponFixingDamage": ("attack", 1.0),
    "Critical": ("crit_chance_pct", 1 / CRIT_RATING_PER_PCT),
    "AmplifyCriticalDamage": ("crit_dmg_pct", 1.0),  # percent stat (D1): "Critical Damage Boost", base crit is +50%
    "HardHit": ("smite_pct", 1.0),  # "Double Chance", a percent stat
    "CombatSpeed": ("combat_speed_pct", 1.0),
    "AmplifyAllDamage": ("dmg_boost_pct", 1.0),
    "AmplifyWeaponDamage": ("weapon_dmg_pct", 1.0),
    "STR": ("attack_increase_pct", DEITY_PCT_PER_POINT),  # Might 14 -> Attack increase +1.4%
    "Death": ("crit_chance_pct", DEITY_PCT_PER_POINT),
    "AGI": ("crit_chance_pct", DEITY_PCT_PER_POINT),  # Precision: Accuracy + Critical Hit increase, 0.1% per point
    "Wisdom": ("smite_pct", DEITY_PCT_PER_POINT),  # Wisdom [Lumiel]: MP Cost -0.1% and Double Chance +0.1% per point
    "Time": ("combat_speed_pct", DEITY_PCT_PER_POINT),
    "Destruction": ("attack_increase_pct", DEITY_PCT_PER_POINT),
    "Illusion": ("cdr_pct", DEITY_PCT_PER_POINT),
}
_NOT_DPS = {"ArmorDefense", "HPMax", "MPMax"}  # real stats, just not a DPS input
_NOT_DPS |= {"DecreaseDamage", "MaxHPRatio", "DefenseRatio"}  # defensive lines that Exceed adds to armor
_STAT_FIELDS = tuple(f.name for f in fields(Stats))


def zero_stats() -> Stats:
    return Stats(**{n: 0.0 for n in _STAT_FIELDS})


def add_stats(base: Stats, delta: Stats, sign: float = 1.0) -> Stats:
    return Stats(**{n: getattr(base, n) + sign * getattr(delta, n) for n in _STAT_FIELDS})


# ---- items -------------------------------------------------------------------------------------------------

def attach_tables(raw: dict) -> dict[int, dict]:
    """Parsed items.json -> {id: item}. The shared top-level tables are linked into each item that names a group
    (references, not copies): `enchant_series`, `enchant_odds`, `exceed_levels`, `exceed_odds`."""
    series, odds, exceed = raw.get("enchant_series") or {}, raw.get("enchant_odds") or {}, raw.get("exceed") or {}
    out: dict[int, dict] = {}
    for it in raw["items"]:
        if it.get("enchant_group") in series:
            it["enchant_series"] = series[it["enchant_group"]]
        if it.get("odds_group") in odds:
            it["enchant_odds"] = odds[it["odds_group"]]
        if it.get("exceed_group") in exceed:
            it["exceed_levels"] = exceed[it["exceed_group"]]["levels"]
            it["exceed_odds"] = exceed[it["exceed_group"]]["odds"]
        out[int(it["id"])] = it
    return out


@lru_cache(maxsize=4)
def _load(path: str) -> dict[int, dict]:
    return attach_tables(json.loads(Path(path).read_text(encoding="utf8")))


def load_items(path: Path | str | None = None) -> dict[int, dict]:
    return _load(str(path or ITEMS_PATH))


def reachable(item: dict, max_il: int = REACHABLE_IL) -> bool:
    return item["il"] <= max_il


def slot_family(slot: str) -> str:
    return slot.rstrip("12")


def fits_class(item: dict, class_key: str) -> bool:
    lock = item.get("class_lock") or []
    return not lock or class_name(class_key) in lock


def _mid(st: dict) -> float:
    return (st["min"] + st["v"]) / 2 if "min" in st else st["v"]  # attack/pool ranges -> midpoint


@lru_cache(maxsize=1024)
def _inclusion(weights: tuple[float, ...], n: int) -> tuple[float, ...]:
    """P(line i is among the first `n` picks) when lines are drawn one at a time, without replacement, each with
    probability proportional to its weight. Exact: equal weights are interchangeable, so the draw is a walk over the
    count taken from each weight class (a few classes, at most 5 picks)."""
    classes = sorted({w for w in weights if w > 0})
    size = [sum(1 for w in weights if w == c) for c in classes]
    dist = {(0,) * len(classes): 1.0}
    for _ in range(min(n, sum(size))):
        nxt: dict[tuple[int, ...], float] = {}
        for state, p in dist.items():
            rest = sum((size[j] - state[j]) * classes[j] for j in range(len(classes)))
            for j, c in enumerate(classes):
                if state[j] < size[j]:
                    st2 = state[:j] + (state[j] + 1,) + state[j + 1:]
                    nxt[st2] = nxt.get(st2, 0.0) + p * (size[j] - state[j]) * c / rest
        dist = nxt
    per = {c: sum(p * st[j] for st, p in dist.items()) / size[j] for j, c in enumerate(classes)}
    return tuple(per.get(w, 0.0) for w in weights)


def pool_inclusion(subs: list[dict], n: int) -> list[float]:
    """Expected number of times each pool line shows up on an item with `n` random lines (0..1 each).
    Uses the client draw weights (`w`); a pool without weights is averaged uniformly (n / lines)."""
    ws = tuple(float(s.get("w") or 0.0) for s in subs)
    if not any(ws):
        return [n / len(subs)] * len(subs)
    return list(_inclusion(ws, n))


def enchant_bonus(item: dict, enchant: int) -> dict[str, float]:
    """Stat added by enchanting to `enchant` (clamped): the client's per-level series, else the old linear slope."""
    e = max(0, min(enchant, item["max_enchant"]))
    if e == 0:
        return {}
    series = item.get("enchant_series")
    if series:
        return {sid: v[min(e, len(v)) - 1] for sid, v in series.items()}
    return {st["id"]: st["slope"] * e for st in item["main"] if st.get("slope")}


def exceed_lines(item: dict, level: int) -> dict[str, float]:
    """Stats of Exceed `level` (clamped to the item's max). Each level's set replaces the one before it."""
    levels = item.get("exceed_levels") or ()
    n = max(0, min(level, len(levels)))
    return dict(levels[n - 1]) if n else {}


def enchant_odds(item: dict) -> list[float]:
    """Success % of each enchant step (+0->+1, +1->+2, ...); empty when the item cannot be enchanted."""
    return list(item.get("enchant_odds") or [])


def exceed_odds(item: dict) -> list[float]:
    """Success % of each Exceed step; empty when the item has no Exceed."""
    return list(item.get("exceed_odds") or [])


def item_lines(item: dict, enchant: int, rolls: str = "expected", weights: dict | None = None,
               exceed: int = 0) -> dict[str, float]:
    """Raw stat totals {stat_id: value} for one item at `enchant` and Exceed `exceed`.
    rolls: 'expected' (each pool line x its weighted draw probability), 'best' (top `sub_count` lines by `weights`,
    max values), 'none'."""
    out: dict[str, float] = {}
    for st in item["main"]:
        out[st["id"]] = out.get(st["id"], 0.0) + _mid(st)
    for sid, v in (*enchant_bonus(item, enchant).items(), *exceed_lines(item, exceed).items()):
        out[sid] = out.get(sid, 0.0) + v
    subs = item["subs"]
    if not item["sub_random"]:
        for s in subs:
            out[s["id"]] = out.get(s["id"], 0.0) + s["v"]
    elif rolls != "none" and subs and item["sub_count"]:
        n = item["sub_count"]
        if rolls == "best" and weights:
            for s in sorted(subs, key=lambda s: -weights.get(s["id"], 0.0) * s["v"])[:n]:
                out[s["id"]] = out.get(s["id"], 0.0) + s["v"]
        else:
            for s, p in zip(subs, pool_inclusion(subs, n)):
                out[s["id"]] = out.get(s["id"], 0.0) + p * _mid(s)
    return out


def item_parts(item: dict, enchant: int, exceed: int = 0) -> dict[str, dict[str, float]]:
    """The same totals as `item_lines(..., rolls="expected")` split by origin: `main`, `enchant`, `exceed`, `fixed`
    (sub lines the item always has) and `rolled` (random sub lines at their expected value; the armory does not
    publish the real rolls). A weapon's main attack stays a range here (`WeaponFixingDamage` = max,
    `WeaponMinDamage` = min) because the stat sheet shows Max and Min Attack."""
    main: dict[str, float] = {}
    for st in item["main"]:
        if st["id"] == "WeaponFixingDamage" and "min" in st:
            main["WeaponDamage"], main["WeaponMinDamage"] = st["v"], st["min"]
        else:
            main[st["id"]] = main.get(st["id"], 0.0) + st["v"]
    ranged = "WeaponDamage" in main
    ench = enchant_bonus(item, enchant)
    exc = exceed_lines(item, exceed)
    out = {"main": main, "enchant": {}, "exceed": {}, "fixed": {}, "rolled": {}}
    for part, lines in (("enchant", ench), ("exceed", exc)):
        for sid, v in lines.items():
            if ranged and sid == "WeaponFixingDamage":  # the weapon's own enchant raises both ends of the range
                out[part]["WeaponDamage"] = out[part]["WeaponMinDamage"] = v
            else:
                out[part][sid] = out[part].get(sid, 0.0) + v
    if not item["sub_random"]:
        for s in item["subs"]:
            out["fixed"][s["id"]] = out["fixed"].get(s["id"], 0.0) + s["v"]
    elif item["subs"] and item["sub_count"]:
        for s, p in zip(item["subs"], pool_inclusion(item["subs"], item["sub_count"])):
            out["rolled"][s["id"]] = out["rolled"].get(s["id"], 0.0) + p * _mid(s)
    return out


def lines_to_delta(lines: dict[str, float]) -> tuple[Stats, dict[str, float]]:
    d = {n: 0.0 for n in _STAT_FIELDS}
    ignored: dict[str, float] = {}
    for sid, v in lines.items():
        m = _FLAT.get(sid)
        if m:
            d[m[0]] += v * m[1]
        elif sid not in _NOT_DPS:
            ignored[sid] = ignored.get(sid, 0.0) + v
    return Stats(**d), ignored


def item_delta(item: dict, enchant: int, rolls: str = "expected", weights: dict | None = None,
               exceed: int = 0) -> Stats:
    return lines_to_delta(item_lines(item, enchant, rolls, weights, exceed))[0]


def normalize_equipped(equipped: list[dict], items: dict[int, dict]) -> list[dict]:
    """[{id, enchant, exceed?, slot?}] -> [{id, enchant, exceed, slot, item}]; slot defaults to the item family (+index for pairs).
    Ids missing from the item table are dropped."""
    used: dict[str, int] = {}
    out = []
    for e in equipped:
        it = items.get(int(e["id"]))
        if it is None:
            continue
        slot = e.get("slot")
        if not slot:
            fam = it["slot"]
            if fam in ("earring", "ring", "bracelet"):
                used[fam] = used.get(fam, 0) + 1
                slot = f"{fam}{used[fam]}"
            else:
                slot = fam
        out.append({"id": it["id"], "enchant": int(e.get("enchant") or 0), "exceed": int(e.get("exceed") or 0),
                    "slot": slot, "item": it})
    return out


def stats_from_gear(equipped: list[dict], items: dict[int, dict] | None = None,
                    rolls: str = "expected") -> tuple[Stats, list[str]]:
    """Stats DELTA (zero base) + notes for [{id, enchant, exceed?}] gear."""
    items = items if items is not None else load_items()
    eq = normalize_equipped(equipped, items)
    notes: list[str] = []
    missing = [int(e["id"]) for e in equipped if int(e["id"]) not in items]
    if missing:
        notes.append(f"{len(missing)} item(s) not in the item table, ignored: {missing}")
    total: dict[str, float] = {}
    for e in eq:
        for k, v in item_lines(e["item"], e["enchant"], rolls, None, e["exceed"]).items():
            total[k] = total.get(k, 0.0) + v
    delta, ignored = lines_to_delta(total)
    if any(e["item"]["sub_random"] for e in eq):
        notes.append("random sub-stat lines are not public: scored at the pool's expected value "
                     "(client draw weights, read as draw probabilities)")
    notes.append(f"rating conversions are assumed: {CRIT_RATING_PER_PCT:g} crit rating = 1%")
    if ignored:
        notes.append("not modelled: " + ", ".join(f"{k} {v:g}" for k, v in sorted(ignored.items())))
    return delta, notes


def base_stats(build: CharacterBuild, equipped: list[dict] | None, items: dict[int, dict]) -> Stats:
    """build.stats minus the currently equipped gear (the 'naked' base)."""
    if not equipped:
        return build.stats
    return add_stats(build.stats, stats_from_gear(equipped, items)[0], -1.0)


# ---- scoring -----------------------------------------------------------------------------------------------

def _style(playstyle: str):
    st = next((p for p in PLAYSTYLES if p.key == playstyle), None)
    if st is None:
        raise KeyError(f"unknown playstyle: {playstyle}")
    return st


def default_build(class_key: str, level: int = 45) -> CharacterBuild:
    return CharacterBuild("Max potential", "global", level, class_key=class_key)


class _Scorer:
    """Cached DPS of a build with given Stats under one fixed priority + scenario."""

    def __init__(self, gd, build, playstyle, priority=None, cfg=SimConfig()):
        self.gd, self.cfg, self.build = gd, cfg, build
        self.sc = _style(playstyle).scenario
        self.priority = priority or _heuristic_priority(gd, build, self.sc, SearchBudget())
        self._cache: dict[Stats, float] = {}

    def dps(self, stats: Stats) -> float:
        if stats not in self._cache:
            b = replace(self.build, stats=stats)
            self._cache[stats] = simulate(self.gd, b, self.priority, self.sc, self.cfg).dps
        return self._cache[stats]

    def field_weights(self, stats: Stats) -> dict[str, float]:
        """d(DPS)/DPS per unit of each Stats field, from a +eps probe."""
        d0 = self.dps(stats) or 1e-9
        out = {}
        for n in _STAT_FIELDS:
            eps = max(1.0, stats.attack * 0.02) if n == "attack" else 1.0
            out[n] = (self.dps(replace(stats, **{n: getattr(stats, n) + eps})) / d0 - 1) / eps
        return out


def _item_weights(fw: dict[str, float]) -> dict[str, float]:
    """field weights -> weight per raw item stat id (used to pick the 'best' random lines)."""
    return {sid: fw.get(f, 0.0) * mult for sid, (f, mult) in _FLAT.items()}


def _score(delta: Stats, fw: dict[str, float]) -> float:
    return sum(getattr(delta, n) * fw.get(n, 0.0) for n in _STAT_FIELDS)


def candidates(items: dict[int, dict], slot: str, class_key: str, level: int | None = None,
               reachable_only: bool = True) -> list[dict]:
    fam = slot_family(slot)
    return [
        it for it in items.values()
        if it["slot"] == fam and fits_class(it, class_key)
        and (not reachable_only or reachable(it))
        and (level is None or it["equip_level"] <= level)
    ]


@dataclass(frozen=True)
class RankedItem:
    item: dict
    enchant: int
    dps: float
    gain_pct: float  # vs this slot empty, other slots at their picks
    reachable: bool
    exceed: int = 0  # Exceed level the ranking assumed (the item's max)


def max_exceed(item: dict) -> int:
    return int(item.get("max_exceed") or 0)


def bis(gd: GameData, class_key: str, playstyle: str, build: CharacterBuild | None = None,
        equipped: list[dict] | None = None, reachable_only: bool = True, items: dict[int, dict] | None = None,
        rolls: str = "best", top: int = 3, passes: int = 2, priority=None, cfg=SimConfig()
        ) -> dict[str, list[RankedItem]]:
    """Per slot instance: best items ranked by simulated DPS, other slots held at their current best.
    Items at max enchant and max Exceed. rolls='best' is an upper bound (top lines of each random pool)."""
    items = items if items is not None else load_items()
    build = replace(build or default_build(class_key), class_key=class_key)
    base = base_stats(build, equipped, items)
    sc = _Scorer(gd, build, playstyle, priority, cfg)
    fw = sc.field_weights(base)
    w = _item_weights(fw)
    pool: dict[str, list[tuple[dict, Stats]]] = {}
    for s in SLOTS:
        scored = [(it, item_delta(it, it["max_enchant"], rolls, w, max_exceed(it)))
                  for it in candidates(items, s, class_key, build.level, reachable_only)]
        scored.sort(key=lambda p: -_score(p[1], fw))
        pool[s] = scored[:PREFILTER_K]
    pick = {s: (pool[s][0][1] if pool[s] else None) for s in SLOTS}

    def rest_of(skip: str) -> Stats:
        st = base
        for s, d in pick.items():
            if d is not None and s != skip:
                st = add_stats(st, d)
        return st

    ranked: dict[str, list[RankedItem]] = {}
    for _ in range(max(1, passes)):
        for s in SLOTS:
            if not pool[s]:
                continue
            rest = rest_of(s)
            d_rest = sc.dps(rest) or 1e-9
            res = sorted(((sc.dps(add_stats(rest, d)), it, d) for it, d in pool[s]), key=lambda r: -r[0])
            pick[s] = res[0][2]
            ranked[s] = [RankedItem(it, it["max_enchant"], dps, (dps / d_rest - 1) * 100, reachable(it), max_exceed(it))
                         for dps, it, _d in res[:top]]
    return ranked


# ---- upgrade path ------------------------------------------------------------------------------------------

def _source(item: dict) -> str:
    return ", ".join(item.get("sources") or []) or "unknown"


def upgrade_path(gd: GameData, build: CharacterBuild, equipped: list[dict], playstyle: str,
                 budget_steps: int = 10, reachable_only: bool = True, items: dict[int, dict] | None = None,
                 priority=None, cfg=SimConfig()) -> list[dict]:
    """Greedy ordered upgrades; each step is the single best move by simulated DPS gain, then re-evaluated.
      * enchant: current item -> its max enchant (one step per slot)
      * exceed: current item -> its max Exceed level (stats of each level replace the last, so one step to the top)
      * swap: a better item (taken at the old item's enchant, capped at the new item's max, at Exceed 0)
    Entries: {slot, from, to, kind, dps_gain_pct, dps_after, source, reachable}; from/to carry {id, name, enchant, exceed}.
    build.stats must already include the equipped gear (moves are applied as new - old)."""
    items = items if items is not None else load_items()
    sc = _Scorer(gd, build, playstyle, priority, cfg)
    state = {e["slot"]: {"item": e["item"], "enchant": e["enchant"], "exceed": e["exceed"]}
             for e in normalize_equipped(equipped, items)}
    stats = build.stats
    fw = sc.field_weights(stats)
    short = {
        s: sorted(candidates(items, s, build.class_key, build.level, reachable_only),
                  key=lambda it: -_score(item_delta(it, it["max_enchant"], exceed=max_exceed(it)), fw))[:PREFILTER_K]
        for s in SLOTS
    }
    path: list[dict] = []
    cur = sc.dps(stats) or 1e-9
    for _ in range(budget_steps):
        best = None
        for s in SLOTS:
            old = state.get(s)
            old_d = item_delta(old["item"], old["enchant"], exceed=old["exceed"]) if old else zero_stats()
            moves = []
            if old and old["enchant"] < old["item"]["max_enchant"]:
                mx = old["item"]["max_enchant"]
                moves.append(("enchant", old["item"], mx, old["exceed"],
                              item_delta(old["item"], mx, exceed=old["exceed"])))
            if old and old["exceed"] < max_exceed(old["item"]):
                mxe = max_exceed(old["item"])
                moves.append(("exceed", old["item"], old["enchant"], mxe,
                              item_delta(old["item"], old["enchant"], exceed=mxe)))
            for it in short[s]:
                if old and it["id"] == old["item"]["id"]:
                    continue
                e = min(old["enchant"] if old else 0, it["max_enchant"])
                moves.append(("swap", it, e, 0, item_delta(it, e)))
            for kind, it, e, x, d in moves:
                st2 = add_stats(add_stats(stats, old_d, -1.0), d)
                dps2 = sc.dps(st2)
                if dps2 > cur * (1 + 1e-9) and (best is None or dps2 > best[0]):
                    best = (dps2, s, kind, it, e, x, st2, old)
        if best is None:
            break
        dps2, s, kind, it, e, x, st2, old = best
        path.append({
            "slot": s,
            "from": {"id": old["item"]["id"], "name": old["item"]["name"], "enchant": old["enchant"],
                     "exceed": old["exceed"]} if old else None,
            "to": {"id": it["id"], "name": it["name"], "enchant": e, "exceed": x},
            "kind": kind,
            "dps_gain_pct": (dps2 / cur - 1) * 100,
            "dps_after": dps2,
            "source": {"enchant": "Enchanting", "exceed": "Exceed"}.get(kind) or _source(it),
            "reachable": reachable(it),
        })
        state[s] = {"item": it, "enchant": e, "exceed": x}
        stats, cur = st2, dps2
    return path


# ---- max potential -----------------------------------------------------------------------------------------

@dataclass(frozen=True)
class MaxPotential:
    playstyle: str
    gear: dict[str, RankedItem]  # BIS per slot at target (max) enchant and max Exceed
    gear_stats: Stats  # delta of that gear (upper-bound rolls)
    build: CharacterBuild  # build with gear stats applied
    full: object  # build_optimizer.FullBuild (Daevanion, ranks, stigmas, specialties)
    dps_without_gear: float
    dps_with_gear: float
    notes: tuple[str, ...] = field(default_factory=tuple)
    # build_optimizer.FullBuild for the CURRENT gear and the Daevanion nodes already opened (None when no build was given)
    current_full: object | None = None


def max_potential(gd: GameData, class_key: str, playstyle: str, build: CharacterBuild | None = None,
                  equipped: list[dict] | None = None, reachable_only: bool = True,
                  items: dict[int, dict] | None = None, cfg=SimConfig(),
                  budget: SearchBudget = SearchBudget(max_candidates=200), progress=None,
                  battle_points: int | None = None) -> MaxPotential:
    """BIS gear at max enchant and max Exceed + the engine's full build (every Daevanion point, max ranks, best stigmas/specs).
    With a `build` it also returns `current_full`: the best that character's CURRENT gear and already-opened Daevanion
    nodes allow (daevanion_points=0: nothing new is opened; stigmas, ranks and specialties are still optimised)."""
    items = items if items is not None else load_items()
    given = build is not None
    build = replace(build or default_build(class_key), class_key=class_key)
    top = bis(gd, class_key, playstyle, build, equipped, reachable_only, items, cfg=cfg, top=1)
    gear = {s: r[0] for s, r in top.items() if r}
    base = base_stats(build, equipped, items)
    sc = _Scorer(gd, build, playstyle, None, cfg)
    w = _item_weights(sc.field_weights(base))
    delta = zero_stats()
    for r in gear.values():
        delta = add_stats(delta, item_delta(r.item, r.enchant, "best", w, r.exceed))
    geared = replace(build, stats=add_stats(base, delta))
    full = optimize_full_build(gd, geared, playstyle, None, cfg, budget, progress, battle_points)
    current_full = optimize_full_build(gd, build, playstyle, 0, cfg, budget, progress) if given else None
    notes = ["upper bound: best sub-stat lines on every item, all at max enchant and max Exceed "
             "(success odds are in the item data, not priced in; costs not modelled)",
             f"gear limited to item level <= {REACHABLE_IL}" if reachable_only else "includes unreleased item levels",
             f"rating conversions assumed: {CRIT_RATING_PER_PCT:g} crit rating = 1%"]
    return MaxPotential(playstyle, gear, delta, geared, full, sc.dps(base), sc.dps(geared.stats), tuple(notes), current_full)


# ---- armory ------------------------------------------------------------------------------------------------

def equipped_from_armory(raw: dict) -> list[dict]:
    """armory fetch() result, or its equipment block -> [{id, enchant, exceed, slot, name}]."""
    eq = raw.get("equipment", raw)
    eq = eq.get("equipment", eq)
    out = []
    for x in eq.get("equipmentList") or []:
        out.append({"id": x["id"], "enchant": x.get("enchantLevel", 0), "exceed": x.get("exceedLevel", 0),
                    "slot": ARMORY_SLOTPOS.get(x.get("slotPos")), "name": x.get("name")})
    return out


def resolution(equipped: list[dict], items: dict[int, dict] | None = None) -> tuple[int, int]:
    """(resolved, total) equipped ids found in the item table."""
    items = items if items is not None else load_items()
    return sum(1 for e in equipped if int(e["id"]) in items), len(equipped)
