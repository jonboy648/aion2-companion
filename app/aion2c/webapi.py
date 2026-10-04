"""Qt-free glue: the ONLY Python surface the browser (Pyodide) calls.

Every function takes and returns JSON-serializable data (dicts / lists / str / numbers / None),
using aion2c.serde for the dataclass <-> dict round trip. Nothing here touches the network or Qt:
the browser fetches the armory JSON (through the proxy) and hands it in.

Game data: on a desktop/CPython run it is loaded from aion2c/data/classes/<key>/gamedata.json.
In the browser the JS side fetches engine/classes/<key>.json and calls `register_gamedata`
(and `register_icons` for engine/icons/<key>.json) before the first call.
"""
from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path
from typing import Any

from aion2c import armory, crafting, daevanion as dae, serde
from aion2c import roadmap as roadmap_mod
from aion2c.classes import CLASSES, DEFAULT_CLASS, class_info
from aion2c.data.loader import CLASSES_DIR, default_path, load_gamedata
from aion2c.engine import build_optimizer as bo
from aion2c.engine.advisor import marginal_stats
from aion2c.engine.rotation import explain_rotation
from aion2c.engine.simulator import simulate
from aion2c.keybinds import export as kb_export
from aion2c.models import (
    SCENARIOS,
    CharacterBuild,
    GameData,
    Priority,
    SimConfig,
    SkillBar,
    Stats,
)

ICON_CDN = "https://assets.playnccdn.com/static-aion2-gamedata/resources/{name}.png"

_GD: dict[str, GameData] = {}
_ICONS: dict[str, dict[str, str]] = {}


# ---- data registration / cache -------------------------------------------------------------------------

def register_gamedata(class_key: str, data: dict) -> None:
    """Browser entry: install a class's gamedata (the parsed engine/classes/<key>.json)."""
    d = dict(data)
    d.setdefault("class_key", class_key)
    _GD[class_key] = serde.from_dict(GameData, d)


def register_icons(class_key: str, names: dict[str, str]) -> None:
    """Browser entry: install {skill_key: ICON_NAME} (engine/icons/<key>.json)."""
    _ICONS[class_key] = dict(names)


def _gd(class_key: str) -> GameData:
    gd = _GD.get(class_key)
    if gd is None:
        if class_info(class_key) is None:
            raise KeyError(f"unknown class: {class_key}")
        gd = _GD[class_key] = load_gamedata(default_path(class_key), class_key)
    return gd


def _icon_names(class_key: str) -> dict[str, str]:
    if class_key not in _ICONS:
        p = CLASSES_DIR / class_key / "icon_names.json"
        _ICONS[class_key] = json.loads(p.read_text(encoding="utf-8")) if p.is_file() else {}
    return _ICONS[class_key]


def _build(d: dict) -> CharacterBuild:
    return serde.from_dict(CharacterBuild, d)


def _priority(d: dict) -> Priority:
    return serde.from_dict(Priority, d)


def _scenario(key: str):
    for s in SCENARIOS:
        if s.key == key:
            return s
    for p in bo.PLAYSTYLES:
        if p.scenario.key == key:
            return p.scenario
    raise KeyError(f"unknown scenario: {key}")


# ---- public API ----------------------------------------------------------------------------------------

def list_classes() -> list[dict]:
    """[{key, name, role}] for classes that ship game data."""
    out = []
    for c in CLASSES:
        if c.key in _GD or default_path(c.key).is_file():
            out.append({"key": c.key, "name": c.name, "role": c.role})
    return out


def gamedata(class_key: str) -> dict:
    return serde.to_dict(_gd(class_key))


def import_character(raw: dict, base_build: dict | None = None) -> dict:
    """raw = {"info", "equipment", "daevanion": {boardId: detail}} as fetched by the browser.
    The class comes from the armory profile (falls back to base_build's, then Sorcerer)."""
    base = _build(base_build) if base_build else CharacterBuild("Me", "global", 10, stats=Stats())
    ckey = armory.class_key(raw) or base.class_key or DEFAULT_CLASS
    gd = _gd(ckey)
    base = replace(base, class_key=ckey)
    build, notes = armory.to_build(gd, raw, base)
    summ = armory.summary(gd, raw)
    prof = (raw.get("info") or {}).get("profile") or {}
    profile = {
        "name": summ["name"], "server": summ["server"], "level": summ["level"],
        "combat_power": summ["combat_power"], "class_name": summ["class"], "class_key": ckey,
        "item_level": summ["item_level"], "profile_image": prof.get("profileImage"),
        "race": prof.get("raceName"),
    }
    boards = summ["daevanion"]
    return {
        "build": serde.to_dict(build),
        "notes": notes,
        "profile": profile,
        "gear": summ["gear"],
        "stigmas": summ["stigmas"],
        "daevanion_summary": {
            "boards": boards,
            "open": sum(b["open"] for b in boards),
            "matched": sum(b["matched"] for b in boards),
        },
    }


def _full_dict(gd: GameData, fb) -> dict:
    """FullBuild dict plus `rotation_explained` (engine.rotation.explain_rotation of its own sim)."""
    d = serde.to_dict(fb)
    d["rotation_explained"] = explain_rotation(gd, fb.build, fb.priority, fb.result, fb.playstyle.scenario)
    return d


def compare(build: dict, daevanion_points: int | None = None, progress=None) -> dict:
    """All four playstyles -> {playstyle_key: FullBuild dict (incl. variants, rotation_explained)}."""
    b = _build(build)
    gd = _gd(b.class_key)
    out = bo.compare_playstyles(gd, b, daevanion_points, SimConfig(), progress)
    return {k: _full_dict(gd, fb) for k, fb in out.items()}


def optimize(build: dict, playstyle_key: str, daevanion_points: int | None = None, progress=None) -> dict:
    b = _build(build)
    gd = _gd(b.class_key)
    fb = bo.optimize_full_build(gd, b, playstyle_key, daevanion_points, progress=progress)
    return _full_dict(gd, fb)


def marginal(build: dict, priority: dict, scenario_key: str) -> list[dict]:
    b = _build(build)
    gains = marginal_stats(_gd(b.class_key), b, _priority(priority), _scenario(scenario_key))
    return serde.to_dict(gains)


def keybinds(build: dict, priorities: dict, bar: dict | None = None, hotkeys: dict | None = None,
             delay_ms: int = 10) -> dict:
    """priorities = {scenario_key: Priority dict}; bar = SkillBar dict ({"slots": {...}}) or a bare
    {label: skill_key} map. Returns {plan: KeybindPlan dict, instructions_markdown}.
    The plan carries the macro-redesign fields too (hybrid_dps, slot_notes, macro_advice, rotation, thumbs)."""
    b = _build(build)
    gd = _gd(b.class_key)
    bar = bar or {}
    slots = bar.get("slots", bar) if isinstance(bar.get("slots", {}), dict) else bar
    pr = {k: _priority(v) for k, v in priorities.items()}
    plan = kb_export.plan(gd, b, pr, SkillBar(slots=dict(slots)), hotkeys, int(delay_ms))
    return {"plan": serde.to_dict(plan), "instructions_markdown": kb_export.instructions_markdown(plan, gd)}


def daevanion_suggest(build: dict, points: int | None = None) -> dict:
    """Best-first Daevanion node order for the build, cut at `points` (None = every point)."""
    b = _build(build)
    gd = _gd(b.class_key)
    cfg = SimConfig()
    sc = _scenario("boss_180")
    heur = bo._heuristic_priority(gd, b, sc, bo.SearchBudget(max_candidates=200))
    path = bo.plan_daevanion(gd, b, heur, sc, cfg)
    info = {n.id: (br.name, n) for br in gd.daevanion.values() for n in br.nodes.values()}
    take: list[int] = []
    spent = 0
    for nid in path:
        c = info[nid][1].cost
        if points is not None and spent + c > points:
            break
        take.append(nid)
        spent += c
    gain = 0.0
    if take:
        d0 = simulate(gd, b, heur, sc, cfg).dps
        d1 = simulate(gd, replace(b, daevanion_nodes=frozenset(b.daevanion_nodes) | frozenset(take)), heur, sc, cfg).dps
        gain = (d1 / d0 - 1) * 100 if d0 > 0 else 0.0
    return {
        "path": take,
        "spent": spent,
        "gain_pct": gain,
        "nodes": [{"id": i, "board": info[i][0], "name": info[i][1].name, "cost": info[i][1].cost} for i in take],
    }


def shopping(class_key: str, recipe_qty: dict, expand: bool = True) -> list[dict]:
    """recipe_qty keys may be str (JSON) or int. -> [{item, qty, source}]."""
    q = {int(k): int(v) for k, v in recipe_qty.items()}
    return serde.to_dict(crafting.shopping_list(_gd(class_key), q, expand))


def roadmap(class_key: str, region: str = "global", build: dict | None = None) -> list[dict]:
    b = _build(build) if build else None
    return serde.to_dict(roadmap_mod.roadmap(_gd(class_key), region, b))  # type: ignore[arg-type]


def icon_urls(class_key: str) -> dict:
    """{skill_key: official CDN url | None} for every skill in the class's game data."""
    names = _icon_names(class_key)
    return {k: (ICON_CDN.format(name=names[k]) if k in names else None) for k in _gd(class_key).skills}


# ---- gear (items.json is registered lazily in the browser: register_items) -------------------------------------
from aion2c import gear as gear_mod  # noqa: E402  (appended section; the gear engine is imported only here)

GEAR_ASSUMPTIONS = [
    "Rating conversions are guesses: 100 crit rating = 1% crit chance and 100 crit damage = 1% (the armory only gives raw ratings).",
    "Random sub-stat lines are not public, so an item you own is scored at the expected value of its pool.",
    "Only Attack, Defense and HP scale with enchant (a linear fit); Exceed is not modelled.",
    "Your imported stats are assumed to already include the equipped gear, so upgrades are relative to what you wear now.",
    "Max potential is an upper bound: best sub-stat lines on every item, max enchant everywhere, every Daevanion point spent. "
    "Success odds and material costs are not included.",
]

_ITEMS: dict[int, dict] | None = None


def register_items(data: dict) -> None:
    """Browser entry: install the parsed engine/items.json ({"schema", "items": [...]})."""
    global _ITEMS
    _ITEMS = {int(it["id"]): it for it in data["items"]}


def _items() -> dict[int, dict]:
    return _ITEMS if _ITEMS is not None else gear_mod.load_items()


def _item_icon(item: dict, armory_icon: str | None = None) -> str | None:
    if armory_icon:
        return armory_icon
    return ICON_CDN.format(name=item["icon"]) if item.get("icon") else None


def _item_view(item: dict, enchant: int, slot: str | None = None, icon: str | None = None) -> dict:
    return {
        "slot": slot or item["slot"], "id": item["id"], "name": item["name"], "grade": item["grade"],
        "il": item["il"], "enchant": int(enchant), "max_enchant": item["max_enchant"],
        "icon": _item_icon(item, icon), "source": ", ".join(item.get("sources") or []) or None,
        "reachable": gear_mod.reachable(item),
    }


def _armory_icons(raw: dict) -> dict[int, str]:
    eq = raw.get("equipment", raw)
    eq = eq.get("equipment", eq)
    return {int(x["id"]): x["icon"] for x in eq.get("equipmentList") or [] if x.get("icon")}


def gear_upgrades(raw_armory: dict, build: dict, playstyle: str, steps: int = 10,
                  reachable_only: bool = True) -> dict:
    """Ordered gear upgrades for an imported character.
    -> {equipped: [item views], upgrades: [{slot, from, to, kind: item|enchant, dps_gain_pct, dps_after, source,
        reachable, icon}], notes, assumptions}. build.stats must be the import's (it includes the worn gear)."""
    b = _build(build)
    gd = _gd(b.class_key)
    items = _items()
    eq = gear_mod.equipped_from_armory(raw_armory)
    icons = _armory_icons(raw_armory)
    norm = gear_mod.normalize_equipped(eq, items)
    notes: list[str] = []
    ok, tot = gear_mod.resolution(eq, items)
    if ok < tot:
        notes.append(f"{tot - ok} of {tot} equipped items are not in the item table and were left out")
    if not norm:
        return {"equipped": [], "upgrades": [], "notes": notes + ["no equipped items could be resolved"],
                "assumptions": list(GEAR_ASSUMPTIONS)}
    path = gear_mod.upgrade_path(gd, b, [{"id": e["id"], "enchant": e["enchant"], "slot": e["slot"]} for e in norm],
                                 playstyle, steps, reachable_only, items)
    equipped = [_item_view(e["item"], e["enchant"], e["slot"], icons.get(e["id"])) for e in norm]
    upgrades = []
    for p in path:
        to = items[p["to"]["id"]]
        frm = p["from"]
        frm_item = items[frm["id"]] if frm else None
        upgrades.append({
            "slot": p["slot"],
            "from": _item_view(frm_item, frm["enchant"], p["slot"], icons.get(frm["id"])) if frm_item else None,
            "to": _item_view(to, p["to"]["enchant"], p["slot"], icons.get(to["id"]) if frm and to["id"] == frm["id"] else None),
            "kind": "enchant" if p["kind"] == "enchant" else "item",
            "dps_gain_pct": p["dps_gain_pct"], "dps_after": p["dps_after"],
            "source": p["source"], "reachable": p["reachable"],
            "icon": _item_icon(to, icons.get(to["id"]) if frm and to["id"] == frm["id"] else None),
        })
    if not upgrades:
        notes.append("no upgrade improves simulated DPS with the items in the table")
    return {"equipped": equipped, "upgrades": upgrades, "notes": notes, "assumptions": list(GEAR_ASSUMPTIONS)}


def max_potential(class_key: str, playstyle: str, reachable_only: bool = True, build: dict | None = None,
                  raw_armory: dict | None = None) -> dict:
    """Best-in-slot gear (target enchant) + the engine's full build for the class, and the gap to `build` if given.
    -> {class_key, playstyle, gear: [per-slot BIS], build: {stigmas, specialties, daevanion_nodes, ranks},
        dps, dps_without_gear, gear_gain_pct, gain_vs_current_pct|None, current_dps|None,
        with_current_gear|None {dps, stigmas, daevanion_nodes} (current gear + the Daevanion nodes already opened), notes, assumptions}"""
    gd = _gd(class_key)
    items = _items()
    b = _build(build) if build else None
    eq = None
    if raw_armory:
        eq = [{"id": e["id"], "enchant": e["enchant"], "slot": e["slot"]}
              for e in gear_mod.normalize_equipped(gear_mod.equipped_from_armory(raw_armory), items)]
    mp = gear_mod.max_potential(gd, class_key, playstyle, b, eq or None, reachable_only, items)
    slots = {s: i for i, s in enumerate(gear_mod.SLOTS)}
    gear = []
    for s in sorted(mp.gear, key=slots.get):
        r = mp.gear[s]
        v = _item_view(r.item, r.enchant, s)
        v["gain_pct"] = r.gain_pct
        gear.append(v)
    fb = mp.full
    name = lambda k: gd.skills[k].name if k in gd.skills else k  # noqa: E731
    ranks = sorted(((k, n) for k, n in fb.build.skill_ranks.items() if n > 0), key=lambda kn: -kn[1])[:12]
    summary = {
        "stigmas": [{"key": k, "name": name(k)} for k in fb.build.stigmas],
        "specialties": [{"skill": name(p.skill_key), "text": p.text, "dps_gain_pct": p.dps_gain_pct}
                        for p in fb.spec_picks],
        "daevanion_nodes": len(fb.build.daevanion_nodes),
        "ranks": [{"key": k, "name": name(k), "rank": n} for k, n in ranks],
    }
    current = gain = None
    with_current = None
    if b is not None:
        # same heuristic priority on both sides, so the gap is not an artefact of two different rotation searches
        current = gear_mod._Scorer(gd, b, playstyle).dps(b.stats)
        top = gear_mod._Scorer(gd, fb.build, playstyle).dps(fb.build.stats)
        gain = (top / current - 1) * 100 if current > 0 else None
        cf = mp.current_full
        if cf is not None:
            # same kind of number as `dps` (a full rotation search), so the two can be compared directly
            with_current = {
                "dps": cf.result.dps,
                "stigmas": [{"key": k, "name": name(k)} for k in cf.build.stigmas],
                "daevanion_nodes": len(cf.build.daevanion_nodes),
            }
    return {
        "class_key": class_key, "playstyle": playstyle, "gear": gear, "build": summary,
        "dps": fb.result.dps, "dps_without_gear": mp.dps_without_gear,
        "gear_gain_pct": (mp.dps_with_gear / mp.dps_without_gear - 1) * 100 if mp.dps_without_gear > 0 else 0.0,
        "current_dps": current, "gain_vs_current_pct": gain, "with_current_gear": with_current,
        "notes": list(mp.notes), "assumptions": list(GEAR_ASSUMPTIONS),
    }
