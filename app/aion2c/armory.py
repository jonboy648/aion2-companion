"""Official-armory character importer.

Reads NCSoft's PUBLIC web armory (api-search.plaync.com / aion2.plaync.com), only when the user clicks Import.
It never touches the game client. HTTP is urllib only; every call goes through `_get_json` (tests patch it).
"""
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import replace

from aion2c.classes import key_from_armory
from aion2c.models import CharacterBuild, GameData, SkillKind, Stats

REGIONS = ("nae", "naw", "eu", "la", "as")
REGION_NAMES = {"nae": "NA East", "naw": "NA West", "eu": "EU", "la": "South America", "as": "Asia"}
SEARCH_URL = "https://api-search.plaync.com/aion2global/search/v2/character"
API = "https://aion2.plaync.com/api/character"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
DELAY_S = 0.4
TIMEOUT_S = 20
SKILL_BONUS_CAP = 4  # same cap the engine applies to Daevanion skill nodes

_last_request = [0.0]


class ArmoryError(Exception):
    """Plain-English failure (network, bad response, character not found)."""


def _get_json(url: str):
    """GET + parse JSON, 0.4 s apart, 20 s timeout. Raises ArmoryError with a readable message."""
    wait = DELAY_S - (time.monotonic() - _last_request[0])
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
            body = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        raise ArmoryError(f"The armory answered HTTP {e.code} ({e.reason}). Try again in a minute.") from e
    except urllib.error.URLError as e:
        raise ArmoryError(f"Could not reach the armory ({e.reason}). Check your internet connection.") from e
    except TimeoutError as e:
        raise ArmoryError("The armory did not answer within 20 seconds. Try again later.") from e
    finally:
        _last_request[0] = time.monotonic()
    try:
        return json.loads(body)
    except ValueError as e:
        raise ArmoryError("The armory sent something that is not JSON (it may be down or changed).") from e


def _strip_tags(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "")


def _qs(**kw) -> str:
    return urllib.parse.urlencode(kw, quote_via=urllib.parse.quote)


def search(name: str, region: str | None = None) -> list[dict]:
    """Find characters by name. region None = try all 5 regions. Names lose their <strong> tags and
    characterId is URL-decoded (re-encoded when used in a URL)."""
    name = (name or "").strip()
    if not name:
        raise ArmoryError("Type a character name first.")
    regions = [region] if region else list(REGIONS)
    out: list[dict] = []
    errors: list[str] = []
    for r in regions:
        url = f"{SEARCH_URL}?" + _qs(keyword=name, page=1, size=100, localeInfo="en-US", region=r, serverId="")
        try:
            data = _get_json(url)
        except ArmoryError as e:
            errors.append(str(e))
            continue
        rows = data.get("list") if isinstance(data, dict) else data
        for row in rows or []:
            out.append({
                "characterId": urllib.parse.unquote(row.get("characterId", "")),
                "name": _strip_tags(row.get("name", "")),
                "level": row.get("level"),
                "serverId": row.get("serverId"),
                "serverName": row.get("serverName", ""),
                "pcId": row.get("pcId"),
                "race": row.get("race"),
                "region": row.get("region") or r,
            })
    if not out and errors and len(errors) == len(regions):
        raise ArmoryError(errors[0])
    return out


def fetch(character_id: str, server_id, region: str) -> dict:
    """info + equipment + the Daevanion boards that have open nodes. Returns {"info", "equipment", "daevanion": {board_id: detail}}."""
    common = dict(lang="en-US", characterId=character_id, serverId=server_id, region=region)
    info = _get_json(f"{API}/info?" + _qs(**common))
    if not isinstance(info, dict) or not info.get("profile"):
        raise ArmoryError("The armory has no profile for that character (wrong region or server?).")
    equipment = _get_json(f"{API}/equipment?" + _qs(**common))
    boards: dict[int, dict] = {}
    for b in (info.get("daevanion") or {}).get("boardList") or []:
        if not b.get("openNodeCount"):
            continue  # nothing opened on that board: skip the request
        boards[b["id"]] = _get_json(f"{API}/daevanion/detail?" + _qs(**common, boardId=b["id"]))
    return {"info": info, "equipment": equipment or {}, "daevanion": boards}


# ---- mapping ---------------------------------------------------------------------------------------------

_PCT = re.compile(r"^\s*(.*?)\s*([+-]?\d+(?:\.\d+)?)\s*%\s*$")
# armory secondary-stat label (lowercase) -> (Stats field, sign)
_STAT_LABELS = {
    "attack increase": ("attack_increase_pct", 1.0),
    "critical hit increase": ("crit_chance_pct", 1.0),
    "combat speed": ("combat_speed_pct", 1.0),
    "cooldown": ("cdr_pct", -1.0),  # "Cooldown -0.1%" is a 0.1% reduction
}


def _map_stats(info: dict, base: Stats) -> tuple[Stats, list[str]]:
    sums: dict[str, float] = {}
    unmapped: list[str] = []
    for s in (info.get("stat") or {}).get("statList") or []:
        for text in s.get("statSecondList") or []:
            m = _PCT.match(text)
            hit = _STAT_LABELS.get(m.group(1).lower()) if m else None
            if hit:
                sums[hit[0]] = sums.get(hit[0], 0.0) + hit[1] * float(m.group(2))
            else:
                unmapped.append(text)
    vals = {k: round(v, 4) for k, v in sums.items()}
    return replace(base, **vals), unmapped


def _map_daevanion(gd: GameData, raw: dict) -> dict:
    """Official open nodes -> our node ids. Official (col,row) == our (x,y) on the board with the same name."""
    by_name = {b.name.lower(): b for b in gd.daevanion.values()}
    boards = {b["id"]: b for b in ((raw.get("info") or {}).get("daevanion") or {}).get("boardList") or []}
    ids: list[int] = []
    per_board: list[dict] = []
    unmatched: list[str] = []
    verified = 0
    for bid, detail in sorted((raw.get("daevanion") or {}).items(), key=lambda kv: int(kv[0])):
        meta = boards.get(int(bid), {})
        bname = meta.get("name", str(bid))
        ours = by_name.get(bname.lower())
        grid = {(n.x, n.y): n for n in ours.nodes.values()} if ours else {}
        opened = [n for n in (detail or {}).get("nodeList") or [] if n.get("open") == 1]
        matched = 0
        for n in opened:
            node = grid.get((n["col"], n["row"]))
            if node is None:
                unmatched.append(f"{bname} r{n['row']}c{n['col']} {n.get('name', '')}".strip())
                continue
            ids.append(node.id)
            matched += 1
            verified += node.name == n.get("name")
        per_board.append({"board": bname, "open": len(opened), "matched": matched})
    return {"ids": ids, "boards": per_board, "unmatched": unmatched, "verified": verified}


def _skill_lookup(gd: GameData) -> dict[int, str]:
    return {s.skill_id: k for k, s in gd.skills.items() if s.skill_id is not None}


def class_key(raw: dict) -> str | None:
    """Class key of an armory download (profile.className, then profile.pcId), None if unrecognised."""
    prof = (raw.get("info") or {}).get("profile") or {}
    return key_from_armory(prof.get("className"), prof.get("pcId"))


def to_build(gd: GameData, raw: dict, base: CharacterBuild) -> tuple[CharacterBuild, list[str]]:
    """Apply an armory import to `base`. Returns the new build and plain-English notes.
    `gd` must be the imported class's data (the UI switches class first); the build's class_key
    comes from the profile."""
    info, eq = raw.get("info") or {}, raw.get("equipment") or {}
    prof = info.get("profile") or {}
    notes: list[str] = []
    ckey = class_key(raw)
    if ckey is None:
        ckey = base.class_key
        notes.append(f"Class {prof.get('className')!r} not recognised; keeping {ckey.title()}.")
    elif ckey != gd.class_key:
        notes.append(f"This character is a {ckey.title()} but the loaded data is for {gd.class_key.title()}; "
                     "skills will not match until that class is selected.")

    level = int(prof.get("characterLevel") or base.level)
    cap = gd.level_caps.get("global", level)
    if level > cap:
        notes.append(f"Level {level} is above the global cap {cap}; using {cap}.")
        level = cap

    dae = _map_daevanion(gd, raw)
    nodes = frozenset(dae["ids"])
    n_open = sum(b["open"] for b in dae["boards"])
    if dae["unmatched"]:
        notes.append(f"{len(dae['unmatched'])} of {n_open} open Daevanion nodes could not be matched: "
                     + ", ".join(dae["unmatched"][:5]) + (" ..." if len(dae["unmatched"]) > 5 else ""))
    # the armory's skill level already includes Daevanion +N; the engine adds node bonuses itself
    bonus: dict[str, int] = {}
    node_by_id = {n.id: n for b in gd.daevanion.values() for n in b.nodes.values()}
    for i in nodes:
        sk = node_by_id[i].skill_key
        if sk:
            bonus[sk] = min(SKILL_BONUS_CAP, bonus.get(sk, 0) + 1)

    by_id = _skill_lookup(gd)
    ranks: dict[str, int] = {}
    stigmas: list[str] = []
    missing: list[str] = []
    for s in (eq.get("skill") or {}).get("skillList") or []:
        if not s.get("acquired") or not s.get("skillLevel"):
            continue
        key = by_id.get(s.get("id"))
        if key is None:
            missing.append(s.get("name", str(s.get("id"))))
            continue
        ranks[key] = max(1, int(s["skillLevel"]) - bonus.get(key, 0))
        if s.get("equip") == 1 and (s.get("category") == "Dp" or gd.skills[key].kind == SkillKind.STIGMA):
            stigmas.append(key)
    if missing:
        notes.append("Skills not in our data (ignored): " + ", ".join(missing))
    slots = gd.stigma_slots.get("global", len(stigmas))
    if len(stigmas) > slots:
        notes.append(f"{len(stigmas)} stigmas equipped but only {slots} slots are modeled; kept the first {slots}.")
        stigmas = stigmas[:slots]

    stats, unmapped = _map_stats(info, base.stats)
    if unmapped:
        notes.append("Stats not used by the simulator: " + "; ".join(dict.fromkeys(unmapped)) + ".")
    notes.append("Attack, crit damage and other gear stats are not in the public armory; they keep your entered values.")

    notes.append(
        f"Imported level {level}, {len(ranks)} skill ranks, {len(stigmas)} stigmas, "
        f"{len(nodes)}/{n_open} Daevanion nodes."
    )
    new = replace(
        base, name=prof.get("characterName") or base.name, region="global", level=level,
        skill_ranks=ranks, stigmas=tuple(stigmas), stats=stats, daevanion_nodes=nodes, class_key=ckey,
    )
    return new, notes


def summary(gd: GameData, raw: dict) -> dict:
    """Display data for the "Your character" card."""
    prof = (raw.get("info") or {}).get("profile") or {}
    gear = [
        {"slot": e.get("slotPosName", ""), "name": e.get("name", ""),
         "enchant": e.get("enchantLevel", 0), "exceed": e.get("exceedLevel", 0), "grade": e.get("grade", "")}
        for e in ((raw.get("equipment") or {}).get("equipment") or {}).get("equipmentList") or []
    ]
    by_id = _skill_lookup(gd)
    stig = []
    for s in ((raw.get("equipment") or {}).get("skill") or {}).get("skillList") or []:
        if s.get("category") == "Dp" and s.get("equip") == 1:
            k = by_id.get(s.get("id"))
            stig.append({"key": k, "name": s.get("name", ""), "rank": s.get("skillLevel", 0)})
    dae = _map_daevanion(gd, raw)
    return {
        "name": prof.get("characterName", ""), "server": prof.get("serverName", ""),
        "level": prof.get("characterLevel"), "combat_power": prof.get("combatPower"),
        "class": prof.get("className", ""), "item_level": next(
            (s.get("value") for s in ((raw.get("info") or {}).get("stat") or {}).get("statList") or []
             if s.get("type") == "ItemLevel"), None),
        "gear": gear, "stigmas": stig, "daevanion": dae["boards"],
    }
