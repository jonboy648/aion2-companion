"""Confidence rendering shared by the panel and window screens. W0 owns this file."""
from PySide6.QtGui import QColor

from aion2c.models import Confidence, Num

_COLORS = {
    "confirmed": "#2e7d32",  # green (callers may skip coloring confirmed values: it renders plain)
    "estimated": "#e69500",  # amber
    "unknown": "#808080",  # grey
}


def confidence_color(c: Confidence) -> QColor:
    return QColor(_COLORS.get(c, _COLORS["unknown"]))


def fmt_num(n: Num) -> tuple[str, str]:
    """(text, tooltip). confirmed plain, estimated `~` prefix, unknown `?` (value kept if present)."""
    v = "" if n.value is None else f"{n.value:g}"
    if n.confidence == "confirmed" and v:
        text = v
    elif n.confidence == "estimated" and v:
        text = "~" + v
    else:
        text = "?" + v
    tip = f"{n.confidence}" + (f": {n.source}" if n.source else "")
    return text, tip
