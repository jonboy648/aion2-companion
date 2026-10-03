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


def compare(build: dict, daevanion_points: int | None = None, progress=None) -> dict:
    """All four playstyles -> {playstyle_key: FullBuild dict (incl. variants)}."""
    b = _build(build)
    out = bo.compare_playstyles(_gd(b.class_key), b, daevanion_points, SimConfig(), progress)
    return serde.to_dict(out)


def optimize(build: dict, playstyle_key: str, daevanion_points: int | None = None, progress=None) -> dict:
    b = _build(build)
    fb = bo.optimize_full_build(_gd(b.class_key), b, playstyle_key, daevanion_points, progress=progress)
    return serde.to_dict(fb)


def marginal(build: dict, priority: dict, scenario_key: str) -> list[dict]:
    b = _build(build)
    gains = marginal_stats(_gd(b.class_key), b, _priority(priority), _scenario(scenario_key))
    return serde.to_dict(gains)


def keybinds(build: dict, priorities: dict, bar: dict | None = None, hotkeys: dict | None = None,
             delay_ms: int = 10) -> dict:
    """priorities = {scenario_key: Priority dict}; bar = SkillBar dict ({"slots": {...}}) or a bare
    {label: skill_key} map. Returns {plan: KeybindPlan dict, instructions_markdown}."""
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
