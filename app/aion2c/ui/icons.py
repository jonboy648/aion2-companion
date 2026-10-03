"""Icon cache. P6 owns it. `pixmap` never returns None: missing or unreadable icons get a
grey placeholder carrying the skill's first letter."""
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QFont, QLinearGradient, QPainter, QPen, QPixmap

from aion2c.models import GameData

CLASSES_DIR = Path(__file__).resolve().parent.parent / "data" / "classes"
_cache: dict[tuple[str, int], QPixmap] = {}


def icon_dir(class_key: str) -> Path:
    return CLASSES_DIR / class_key / "icons"


def _placeholder(letter: str, size: int) -> QPixmap:
    """Themed tile (navy gradient, gold letter) for skills without an icon file."""
    from aion2c.ui.theme import PALETTE

    pm = QPixmap(size, size)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    g = QLinearGradient(0, 0, 0, size)
    g.setColorAt(0, QColor(PALETTE["surface3"]))
    g.setColorAt(1, QColor(PALETTE["surface"]))
    rad = max(4, size // 7)
    p.setPen(QPen(QColor(PALETTE["border"]), 1))
    p.setBrush(g)
    p.drawRoundedRect(0.5, 0.5, size - 1, size - 1, rad, rad)
    p.setPen(QColor(PALETTE["gold_hi"]))
    f = QFont()
    f.setPixelSize(max(8, size // 2))
    f.setBold(True)
    p.setFont(f)
    p.drawText(pm.rect(), Qt.AlignmentFlag.AlignCenter, letter)
    p.end()
    return pm


def pixmap(gd: GameData, skill_key: str, size: int = 32) -> QPixmap:
    skill = gd.skills.get(skill_key) if gd is not None else None
    icon = skill.icon if skill else None
    cls = gd.class_key if gd is not None else "sorcerer"
    ck = (f"{cls}/{icon}" if icon else f"?{skill_key}", size)
    hit = _cache.get(ck)
    if hit is not None:
        return hit
    pm = None
    if icon:
        src = QPixmap(str(icon_dir(cls) / icon))
        if not src.isNull():
            pm = src.scaled(size, size, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)
    if pm is None:
        pm = _placeholder((skill.name[:1] if skill and skill.name else "?").upper(), size)
    _cache[ck] = pm
    return pm


def clear_cache() -> None:
    _cache.clear()
