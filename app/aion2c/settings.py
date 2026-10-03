"""User settings. W0 wrote DEFAULT_USER and user_path; P6 owns the rest."""
import copy
import hashlib
import json
import os
from pathlib import Path

DEFAULT_USER: dict = {
    "builds": {},
    "active_build": None,
    "skill_bar": {},
    "macro_keys": {"boss": "F9", "aoe": "F10"},
    "macro_delay_ms": 10,
    "auto_chain": True,
    "anim_overrides": {},
    "roadmap_checks": [],
    "panel": {"opacity": 0.85, "click_through": False, "x": None, "y": None},
    "hotkey": "Ctrl+Shift+F12",
    "show_kr": False,
    "craft_list": {},
    "craft_checks": [],
    "armory": {"name": "", "region": "", "character_id": "", "server_id": ""},
}


def user_path() -> Path:
    env = os.environ.get("AION2C_USER_PATH")
    if env:
        return Path(env)
    appdata = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
    return Path(appdata) / "aion2c" / "user.json"


# content hash of the last file this process wrote, per resolved path (self-save detection)
_own_hash: dict[str, str] = {}


def content_hash(p: Path) -> str | None:
    """Hash of a file's bytes, None when it is missing or unreadable."""
    try:
        return hashlib.sha1(Path(p).read_bytes()).hexdigest()
    except OSError:
        return None


def last_saved_hash(path: Path | None = None) -> str | None:
    """Hash recorded by `save_user` for this path (None if this process never saved it)."""
    p = Path(path) if path is not None else user_path()
    return _own_hash.get(str(p.resolve()))


def _fill(out: dict, data: dict) -> dict:
    """Overlay `data` on defaults; nested dict defaults (panel, macro_keys) merge key by key."""
    for k, v in data.items():
        if isinstance(out.get(k), dict) and isinstance(v, dict) and k in DEFAULT_USER and DEFAULT_USER[k]:
            out[k] = {**out[k], **v}
        else:
            out[k] = v
    return out


def load_user(path: Path | None = None) -> dict:
    """Missing/corrupt file or missing keys are filled from DEFAULT_USER."""
    p = Path(path) if path is not None else user_path()
    out = copy.deepcopy(DEFAULT_USER)
    try:
        with open(p, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return out
    if isinstance(data, dict):
        _fill(out, data)
    return out


def save_user(d: dict, path: Path | None = None) -> None:
    """Write user.json and remember its hash so AppState can ignore the resulting change event."""
    p = Path(path) if path is not None else user_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    blob = json.dumps(d, indent=2).encode("utf-8")
    with open(p, "wb") as f:
        f.write(blob)
    _own_hash[str(p.resolve())] = hashlib.sha1(blob).hexdigest()
