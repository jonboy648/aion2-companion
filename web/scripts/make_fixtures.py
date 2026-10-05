"""Generate web/src/fixtures/*.json by running aion2c.webapi in CPython on the real DarthThot armory sample.
These are the mock-mode data AND the ground truth src/lib/types.ts is checked against (src/lib/types.test.ts).
Run: python web/scripts/make_fixtures.py   (from anywhere; ~15 s)
"""
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "app"))
from aion2c import webapi  # noqa: E402

FX_IN = ROOT / "app" / "tests" / "fixtures" / "armory"
OUT = ROOT / "web" / "src" / "fixtures"
MAX_CASTS = 24  # trimmed: a 180 s boss run has ~170 casts


def dump(name: str, obj) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{name}: {(OUT / name).stat().st_size / 1024:.0f} KiB")


def trim_full_build(fb: dict) -> dict:
    fb["result"]["casts"] = fb["result"]["casts"][:MAX_CASTS]
    return fb


def trim_gamedata(d: dict) -> dict:
    for s in d["skills"].values():
        s["ranks"] = s["ranks"][:3]
    d["daevanion"] = dict(list(d["daevanion"].items())[:2])
    d["recipes"] = d["recipes"][:6]
    return d


def main() -> None:
    load = lambda n: json.loads((FX_IN / n).read_text(encoding="utf-8"))
    raw = {"info": load("info.json"), "equipment": load("equipment.json"),
           "daevanion": {str(b): load(f"daevanion_{b}.json") for b in (61, 63, 64)}}
    imp = webapi.import_character(raw, None)
    build = imp["build"]
    dump("import_character.json", imp)
    dump("list_classes.json", webapi.list_classes())
    dump("gamedata_sorcerer.json", trim_gamedata(webapi.gamedata("sorcerer")))
    full = webapi.compare(build, None)
    pri = {"boss_180": full["boss"]["priority"], "aoe_pack": full["aoe"]["priority"]}
    kb = webapi.keybinds(build, pri, {}, None, 10)
    dump("compare.json", {k: trim_full_build(v) for k, v in full.items()})
    dump("keybinds.json", kb)
    dump("marginal.json", webapi.marginal(build, full["boss"]["priority"], "boss_180"))
    dump("daevanion_suggest.json", webapi.daevanion_suggest(build, 12))
    rid = webapi.gamedata("sorcerer")["recipes"][0]["id"]
    dump("shopping.json", webapi.shopping("sorcerer", {str(rid): 2}, True))
    dump("roadmap.json", webapi.roadmap("sorcerer", "global", build))
    dump("icon_urls_sorcerer.json", webapi.icon_urls("sorcerer"))
    dump("gear_upgrades.json", webapi.gear_upgrades(raw, build, "boss", 10, True))
    dump("max_potential.json", webapi.max_potential("sorcerer", "boss", True, build, raw))
    dump("stat_sheet.json", webapi.stat_sheet(raw))
    # armory mock inputs (public armory JSON, no art): what lib/armory.ts mock mode serves
    dump("armory_search.json", {"list": [{
        "characterId": raw["info"]["profile"]["characterId"], "name": "DarthThot", "race": 2, "pcId": 28,
        "level": 44, "serverId": 2103, "serverName": "Triniel", "region": "nae"}],
        "pagination": {"page": 1, "size": 100, "total": 1, "endPage": 1}})
    dump("armory_raw.json", raw)


if __name__ == "__main__":
    main()
