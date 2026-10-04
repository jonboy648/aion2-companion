"""Helpers shared by _build_specs.py and _build_specs_fx.py."""
DUMP = "aion2.app client dump 2026-09-18"


def num(v, conf, src):
    return {"value": v, "confidence": conf, "source": src}


def tok(token, rank20, scale=""):
    return f"{DUMP} datamine token {token} (rank 20 = {rank20}{'; ' + scale if scale else ''})"


def eff(kind, value=None, conf="estimated", src="", **kw):
    d = {"kind": kind, **kw}
    d["value"] = None if value is None else num(value, conf, src)
    return d
