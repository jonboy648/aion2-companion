"""Reusable themed components for aion2c screens. See D:\\Aion2\\DESIGN.md for usage rules.

Everything here is presentation only. Colours come from aion2c.ui.theme (PALETTE / TONES).
"""
from __future__ import annotations

from PySide6.QtCore import QEasingCurve, QPropertyAnimation, QSize, Qt, Signal
from PySide6.QtGui import QColor, QFont, QPainter, QPen, QPixmap
from PySide6.QtWidgets import (
    QFrame,
    QGraphicsDropShadowEffect,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QSizePolicy,
    QToolButton,
    QVBoxLayout,
    QWidget,
)

from aion2c.ui.theme import PALETTE, TONES, rarity_color


def set_role(label: QLabel, role: str) -> QLabel:
    """Typography role: display | title | caption | dim | gold (see theme QSS)."""
    label.setProperty("role", role)
    label.style().unpolish(label)
    label.style().polish(label)
    return label


def text_label(text: str, role: str = "", wrap: bool = False) -> QLabel:
    lb = QLabel(text)
    lb.setWordWrap(wrap)
    if role:
        set_role(lb, role)
    return lb


def _shadow(parent: QWidget, blur: float = 24, dy: float = 6, alpha: int = 110) -> QGraphicsDropShadowEffect:
    fx = QGraphicsDropShadowEffect(parent)
    fx.setBlurRadius(blur)
    fx.setOffset(0, dy)
    fx.setColor(QColor(0, 0, 0, alpha))
    return fx


class Card(QFrame):
    """Rounded surface with title row, optional subtitle and a content layout.

    hoverable: border warms to gold and the shadow lifts (animated). collapsible: header toggles the body.
    Add content with ``card.body`` (a QVBoxLayout) or ``card.add(widget)``.
    """

    toggled = Signal(bool)

    def __init__(self, title: str = "", subtitle: str | None = None, *, hoverable: bool = False,
                 collapsible: bool = False, parent: QWidget | None = None):
        super().__init__(parent)
        self.setProperty("card", True)
        self.setAttribute(Qt.WA_StyledBackground, True)
        self._fx = _shadow(self)
        self.setGraphicsEffect(self._fx)
        self._hoverable = hoverable
        self._collapsible = collapsible
        self._anim = QPropertyAnimation(self._fx, b"blurRadius", self)
        self._anim.setDuration(160)
        self._anim.setEasingCurve(QEasingCurve.OutCubic)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(16, 14, 16, 16)
        outer.setSpacing(8)
        self.header = QWidget(self)
        hl = QVBoxLayout(self.header)
        hl.setContentsMargins(0, 0, 0, 0)
        hl.setSpacing(2)
        top = QHBoxLayout()
        top.setContentsMargins(0, 0, 0, 0)
        self.title_label = text_label(title, "title")
        top.addWidget(self.title_label, 1)
        self._chev = QToolButton(self.header)
        self._chev.setText("\u25BE")
        self._chev.setCursor(Qt.PointingHandCursor)
        self._chev.setVisible(collapsible)
        self._chev.clicked.connect(lambda: self.set_expanded(not self._expanded))
        top.addWidget(self._chev)
        hl.addLayout(top)
        self.subtitle_label = text_label(subtitle or "", "caption", wrap=True)
        self.subtitle_label.setVisible(bool(subtitle))
        hl.addWidget(self.subtitle_label)
        self.header.setVisible(bool(title or subtitle))
        outer.addWidget(self.header)
        self._body_w = QWidget(self)
        self.body = QVBoxLayout(self._body_w)
        self.body.setContentsMargins(0, 4, 0, 0)
        self.body.setSpacing(8)
        outer.addWidget(self._body_w)
        self._expanded = True
        if hoverable:
            self.setMouseTracking(True)

    def add(self, widget: QWidget, stretch: int = 0) -> QWidget:
        self.body.addWidget(widget, stretch)
        return widget

    def set_expanded(self, on: bool) -> None:
        self._expanded = on
        self._body_w.setVisible(on)
        self._chev.setText("\u25BE" if on else "\u25B8")
        self.toggled.emit(on)

    def is_expanded(self) -> bool:
        return self._expanded

    def _lift(self, on: bool) -> None:
        self.setProperty("hover", on)
        self.style().unpolish(self)
        self.style().polish(self)
        self._anim.stop()
        self._anim.setEndValue(34 if on else 24)
        self._anim.start()

    def enterEvent(self, e) -> None:
        if self._hoverable:
            self._lift(True)
        super().enterEvent(e)

    def leaveEvent(self, e) -> None:
        if self._hoverable:
            self._lift(False)
        super().leaveEvent(e)


class SectionHeader(QWidget):
    """Gold-ruled heading for a block of a screen: title on the left, optional caption + actions on the right."""

    def __init__(self, title: str, caption: str | None = None, parent: QWidget | None = None):
        super().__init__(parent)
        lay = QHBoxLayout(self)
        lay.setContentsMargins(0, 8, 0, 4)
        lay.setSpacing(10)
        bar = QFrame(self)
        bar.setFixedSize(3, 18)
        bar.setStyleSheet(f"background:{PALETTE['gold']};border-radius:1px;")
        lay.addWidget(bar)
        self.title_label = text_label(title, "title")
        lay.addWidget(self.title_label)
        self.caption_label = text_label(caption or "", "caption")
        self.caption_label.setVisible(bool(caption))
        lay.addWidget(self.caption_label)
        lay.addStretch(1)
        self.actions = QHBoxLayout()
        self.actions.setSpacing(6)
        lay.addLayout(self.actions)


class IconTile(QWidget):
    """Square icon with rarity-coloured bezel and an optional corner badge (rank, count)."""

    def __init__(self, pixmap: QPixmap | None = None, size: int = 48, rarity: str | None = None,
                 badge: str | None = None, parent: QWidget | None = None):
        super().__init__(parent)
        self._pm, self._size, self._rarity, self._badge = pixmap, size, rarity, badge
        self.setFixedSize(size + 4, size + 4)

    def set_pixmap(self, pm: QPixmap | None) -> None:
        self._pm = pm
        self.update()

    def set_badge(self, text: str | None) -> None:
        self._badge = text
        self.update()

    def set_rarity(self, rarity: str | None) -> None:
        self._rarity = rarity
        self.update()

    def sizeHint(self) -> QSize:
        return QSize(self._size + 4, self._size + 4)

    def paintEvent(self, _e) -> None:
        p = QPainter(self)
        p.setRenderHints(QPainter.Antialiasing | QPainter.SmoothPixmapTransform)
        r = self.rect().adjusted(2, 2, -2, -2)
        col = rarity_color(self._rarity)
        rad = max(6, self._size // 6)
        p.setPen(Qt.NoPen)
        p.setBrush(QColor(PALETTE["surface2"]))
        p.drawRoundedRect(r, rad, rad)
        if self._pm is not None and not self._pm.isNull():
            inner = r.adjusted(3, 3, -3, -3)
            pm = self._pm.scaled(inner.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation)
            p.drawPixmap(inner.x() + (inner.width() - pm.width()) // 2,
                         inner.y() + (inner.height() - pm.height()) // 2, pm)
        if self._rarity:
            glow = QColor(col)
            glow.setAlpha(60)
            p.setPen(QPen(glow, 3))
            p.setBrush(Qt.NoBrush)
            p.drawRoundedRect(r, rad, rad)
        p.setPen(QPen(col if self._rarity else QColor(PALETTE["border"]), 1.5))
        p.setBrush(Qt.NoBrush)
        p.drawRoundedRect(r.adjusted(1, 1, -1, -1), rad, rad)
        if self._badge:
            f = QFont(self.font())
            f.setPixelSize(max(9, self._size // 4))
            f.setBold(True)
            p.setFont(f)
            fm = p.fontMetrics()
            w, h = fm.horizontalAdvance(self._badge) + 8, fm.height() + 2
            br = self.rect().adjusted(self.width() - w - 1, self.height() - h - 1, -1, -1)
            p.setPen(Qt.NoPen)
            p.setBrush(QColor(PALETTE["bg"]))
            p.drawRoundedRect(br, h // 2, h // 2)
            p.setPen(QColor(PALETTE["gold_hi"]))
            p.drawText(br, Qt.AlignCenter, self._badge)


class StatPill(QFrame):
    """Compact 'label  value' capsule. tone: neutral|gold|info|ok|warn|error|confirmed|estimated|unknown."""

    def __init__(self, label: str, value: str, tone: str = "neutral", parent: QWidget | None = None):
        super().__init__(parent)
        self.setAttribute(Qt.WA_StyledBackground, True)
        lay = QHBoxLayout(self)
        lay.setContentsMargins(10, 3, 10, 3)
        lay.setSpacing(7)
        self._l = QLabel(label)
        self._v = QLabel(value)
        lay.addWidget(self._l)
        lay.addWidget(self._v)
        self.set_tone(tone)

    def set_value(self, value: str, tone: str | None = None) -> None:
        self._v.setText(value)
        if tone:
            self.set_tone(tone)

    def set_tone(self, tone: str) -> None:
        fg, bg, bd = TONES.get(tone, TONES["neutral"])
        self.setStyleSheet(f"StatPill{{background:{bg};border:1px solid {bd};border-radius:12px;}}")
        self._l.setStyleSheet(f"color:{PALETTE['text_dim']};font-size:11px;background:transparent;")
        self._v.setStyleSheet(f"color:{fg};font-weight:600;font-size:13px;background:transparent;")


class Chip(QLabel):
    """Small tag (class, slot, source). tone as StatPill."""

    def __init__(self, text: str, tone: str = "neutral", parent: QWidget | None = None):
        super().__init__(text, parent)
        fg, bg, bd = TONES.get(tone, TONES["neutral"])
        self.setStyleSheet(f"background:{bg};color:{fg};border:1px solid {bd};border-radius:9px;"
                           "padding:1px 9px;font-size:11px;font-weight:600;")
        self.setSizePolicy(QSizePolicy.Maximum, QSizePolicy.Fixed)


class PrimaryButton(QPushButton):
    """Gold call-to-action. One per view region."""

    def __init__(self, text: str = "", parent: QWidget | None = None):
        super().__init__(text, parent)
        self.setProperty("variant", "primary")
        self.setCursor(Qt.PointingHandCursor)
        self.setMinimumHeight(34)


class GhostButton(QPushButton):
    """Quiet secondary action: no fill until hovered."""

    def __init__(self, text: str = "", parent: QWidget | None = None):
        super().__init__(text, parent)
        self.setProperty("variant", "ghost")
        self.setCursor(Qt.PointingHandCursor)
        self.setMinimumHeight(34)


_BANNER_GLYPH = {"info": "info", "warn": "warn", "error": "error"}


class Banner(QFrame):
    """Inline message strip. kind: info | warn | error. Set text with set_text(); optional action button."""

    def __init__(self, kind: str = "info", text: str = "", parent: QWidget | None = None):
        super().__init__(parent)
        self.setAttribute(Qt.WA_StyledBackground, True)
        self._icon = QLabel()
        self._icon.setFixedSize(22, 22)
        self._text = QLabel(text)
        self._text.setWordWrap(True)
        self._text.setTextInteractionFlags(Qt.TextBrowserInteraction)
        self._text.setOpenExternalLinks(True)
        self.action = GhostButton("")
        self.action.setVisible(False)
        lay = QHBoxLayout(self)
        lay.setContentsMargins(12, 9, 12, 9)
        lay.setSpacing(10)
        lay.addWidget(self._icon, 0, Qt.AlignTop)
        lay.addWidget(self._text, 1)
        lay.addWidget(self.action)
        self.set_kind(kind)

    def set_text(self, text: str) -> None:
        self._text.setText(text)

    def set_kind(self, kind: str) -> None:
        self.kind = kind if kind in _BANNER_GLYPH else "info"
        tone = {"info": "info", "warn": "warn", "error": "error"}[self.kind]
        fg, bg, bd = TONES[tone]
        self.setStyleSheet(f"Banner{{background:{bg};border:1px solid {bd};border-radius:10px;}}")
        self._text.setStyleSheet(f"color:{PALETTE['text']};background:transparent;")
        self._icon.setPixmap(line_icon(_BANNER_GLYPH[self.kind], 20, fg))


class EmptyState(QWidget):
    """Centered icon + one plain sentence + optional action. Tell the user what to do next."""

    def __init__(self, icon: QPixmap | str | None, text: str, action_text: str | None = None,
                 parent: QWidget | None = None):
        super().__init__(parent)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(24, 32, 24, 32)
        lay.setSpacing(12)
        lay.addStretch(1)
        self.icon_label = QLabel()
        self.icon_label.setAlignment(Qt.AlignCenter)
        if isinstance(icon, QPixmap):
            self.icon_label.setPixmap(icon)
        elif isinstance(icon, str) and icon:
            self.icon_label.setPixmap(line_icon(icon, 44, PALETTE["text_faint"]))
        lay.addWidget(self.icon_label)
        self.text_label = text_label(text, "dim", wrap=True)
        self.text_label.setAlignment(Qt.AlignCenter)
        self.text_label.setSizePolicy(QSizePolicy.Ignored, QSizePolicy.Preferred)
        lay.addWidget(self.text_label)
        self.action = GhostButton(action_text or "")
        self.action.setVisible(bool(action_text))
        lay.addWidget(self.action, 0, Qt.AlignHCenter)
        lay.addStretch(1)


# ---------------------------------------------------------------- vector icon set
# 24x24 grid, 1.8 round stroke, tinted at draw time. line_icon(name, size, color) -> QPixmap.
from PySide6.QtCore import QPointF, QRectF  # noqa: E402
from PySide6.QtGui import QIcon, QPainterPath  # noqa: E402


def _poly(pts, close=False) -> QPainterPath:
    p = QPainterPath(QPointF(*pts[0]))
    for x, y in pts[1:]:
        p.lineTo(x, y)
    if close:
        p.closeSubpath()
    return p


def _rr(x, y, w, h, r=2.0) -> QPainterPath:
    p = QPainterPath()
    p.addRoundedRect(QRectF(x, y, w, h), r, r)
    return p


def _ell(cx, cy, rx, ry=None) -> QPainterPath:
    p = QPainterPath()
    p.addEllipse(QPointF(cx, cy), rx, ry or rx)
    return p


def _star(cx, cy, ro, ri, n=5) -> QPainterPath:
    import math

    pts = []
    for i in range(n * 2):
        r = ro if i % 2 == 0 else ri
        a = -math.pi / 2 + i * math.pi / n
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return _poly(pts, True)


def _gear() -> list[QPainterPath]:
    import math

    pts = []
    for i in range(16):
        r = 9.5 if (i // 2) % 2 == 0 else 7.5
        a = i * math.pi / 8
        pts.append((12 + r * math.cos(a), 12 + r * math.sin(a)))
    return [_poly(pts, True), _ell(12, 12, 3)]


_ICONS: dict[str, list[QPainterPath]] = {
    "home": [_poly([(3.5, 11), (12, 3.5), (20.5, 11)]), _poly([(5.5, 9.5), (5.5, 20.5), (18.5, 20.5), (18.5, 9.5)]), _poly([(10, 20.5), (10, 14.5), (14, 14.5), (14, 20.5)])],
    "codex": [_poly([(12, 6), (12, 20)]), _poly([(12, 6), (7, 4.5), (3.5, 5.5), (3.5, 18.5), (7, 17.5), (12, 19.5)]), _poly([(12, 6), (17, 4.5), (20.5, 5.5), (20.5, 18.5), (17, 17.5), (12, 19.5)])],
    "build": [_poly([(4, 7), (20, 7)]), _poly([(4, 12), (20, 12)]), _poly([(4, 17), (20, 17)]), _ell(9, 7, 2.2), _ell(15, 12, 2.2), _ell(8, 17, 2.2)],
    "upgrade": [_poly([(12, 20), (12, 5)]), _poly([(6, 11), (12, 5), (18, 11)]), _poly([(7, 20), (17, 20)])],
    "daevanion": [_poly([(12, 2.5), (20, 12), (12, 21.5), (4, 12)], True), _poly([(12, 7.5), (16, 12), (12, 16.5), (8, 12)], True)],
    "crafting": [_poly([(14, 4), (20, 10), (17, 13), (11, 7)], True), _poly([(13.5, 10), (5, 18.5)]), _poly([(3.5, 17), (7, 20.5)])],
    "roadmap": [_ell(6, 18, 2.2), _ell(18, 6, 2.2), _poly([(8.2, 18), (13, 18), (13, 12), (11, 12)]), _poly([(11, 12), (17, 12), (17, 8.4)])],
    "keybinds": [_rr(2.5, 6.5, 19, 11, 2.5), _poly([(6, 10), (7, 10)]), _poly([(10, 10), (11, 10)]), _poly([(14, 10), (15, 10)]), _poly([(18, 10), (18.5, 10)]), _poly([(7, 14), (17, 14)])],
    "panel": [_rr(3.5, 4.5, 17, 15, 2.5), _poly([(3.5, 9.5), (20.5, 9.5)]), _poly([(9, 9.5), (9, 19.5)])],
    "info": [_ell(12, 12, 9), _poly([(12, 11), (12, 16.5)]), _poly([(12, 7.8), (12, 7.9)])],
    "warn": [_poly([(12, 3.5), (21.5, 20), (2.5, 20)], True), _poly([(12, 10), (12, 14.5)]), _poly([(12, 17.4), (12, 17.5)])],
    "error": [_ell(12, 12, 9), _poly([(8.5, 8.5), (15.5, 15.5)]), _poly([(15.5, 8.5), (8.5, 15.5)])],
    "check": [_ell(12, 12, 9), _poly([(7.8, 12.3), (10.7, 15.2), (16.3, 9)])],
    "search": [_ell(10.5, 10.5, 6.5), _poly([(15.5, 15.5), (20.5, 20.5)])],
    "settings": _gear(),
    "refresh": [_poly([(19, 8), (19, 4), (15, 4)]), _poly([(18.6, 8.2), (12, 4.5), (5, 8.5), (4.5, 15)]), _poly([(5, 16), (5, 20), (9, 20)]), _poly([(5.4, 15.8), (12, 19.5), (19, 15.5), (19.5, 9)])],
    "copy": [_rr(8.5, 8.5, 12, 12, 2.5), _poly([(15.5, 5.5), (15.5, 5), (6, 5), (4, 7), (4, 15.5), (8.5, 15.5)])],
    "plus": [_poly([(12, 5), (12, 19)]), _poly([(5, 12), (19, 12)])],
    "close": [_poly([(6, 6), (18, 18)]), _poly([(18, 6), (6, 18)])],
    "star": [_star(12, 12.5, 9, 4)],
    "shield": [_poly([(12, 3), (20, 6), (20, 12), (12, 21), (4, 12), (4, 6)], True)],
    "sword": [_poly([(5, 19), (19, 5), (19, 10)]), _poly([(19, 5), (14, 5)]), _poly([(7.5, 13.5), (10.5, 16.5)]), _poly([(4, 20), (6.5, 17.5)])],
    "list": [_poly([(8, 7), (20, 7)]), _poly([(8, 12), (20, 12)]), _poly([(8, 17), (20, 17)]), _poly([(4, 7), (4.1, 7)]), _poly([(4, 12), (4.1, 12)]), _poly([(4, 17), (4.1, 17)])],
    "bolt": [_poly([(13, 3), (5, 13.5), (11.5, 13.5), (10.5, 21), (19, 10), (12.5, 10)], True)],
    "lock": [_rr(5, 10.5, 14, 10, 2.5), _poly([(8, 10.5), (8, 7.5), (9.5, 4.8), (14.5, 4.8), (16, 7.5), (16, 10.5)])],
}
ICON_NAMES = tuple(_ICONS)


def line_icon(name: str, size: int = 20, color: str | QColor = "#a3adcc", dpr: float = 2.0) -> QPixmap:
    """Crisp tinted pixmap of a built-in icon (see ICON_NAMES). Unknown names render as a dot."""
    pm = QPixmap(int(size * dpr), int(size * dpr))
    pm.setDevicePixelRatio(dpr)
    pm.fill(Qt.transparent)
    p = QPainter(pm)
    p.setRenderHints(QPainter.Antialiasing)
    p.scale(size / 24.0, size / 24.0)
    pen = QPen(QColor(color), 1.8)
    pen.setCapStyle(Qt.RoundCap)
    pen.setJoinStyle(Qt.RoundJoin)
    p.setPen(pen)
    p.setBrush(Qt.NoBrush)
    for path in _ICONS.get(name, [_ell(12, 12, 1.5)]):
        p.drawPath(path)
    p.end()
    return pm


def icon(name: str, size: int = 20) -> QIcon:
    """QIcon with normal (dim), hover/active (gold) and disabled states, for toolbar buttons and tabs."""
    ic = QIcon()
    ic.addPixmap(line_icon(name, size, PALETTE["text_dim"]), QIcon.Normal, QIcon.Off)
    ic.addPixmap(line_icon(name, size, PALETTE["gold_hi"]), QIcon.Active, QIcon.Off)
    ic.addPixmap(line_icon(name, size, PALETTE["gold_hi"]), QIcon.Normal, QIcon.On)
    ic.addPixmap(line_icon(name, size, PALETTE["text_faint"]), QIcon.Disabled, QIcon.Off)
    return ic


# ---------------------------------------------------------------- class emblems
_CLASS_GLYPH = {  # class_key -> icon name used inside the emblem
    "gladiator": "sword", "templar": "shield", "assassin": "bolt", "ranger": "search",
    "sorcerer": "star", "elementalist": "daevanion", "cleric": "plus", "chanter": "list",
}


def class_emblem(class_key: str, size: int = 40, dpr: float = 2.0) -> QPixmap:
    """Round badge in the class colour with a class glyph. Placeholder art until real class icons exist."""
    from aion2c.ui.theme import class_color

    col = class_color(class_key)
    pm = QPixmap(int(size * dpr), int(size * dpr))
    pm.setDevicePixelRatio(dpr)
    pm.fill(Qt.transparent)
    p = QPainter(pm)
    p.setRenderHints(QPainter.Antialiasing)
    r = QRectF(1.5, 1.5, size - 3, size - 3)
    from PySide6.QtGui import QLinearGradient

    g = QLinearGradient(r.topLeft(), r.bottomRight())
    g.setColorAt(0, col.darker(260))
    g.setColorAt(1, QColor(PALETTE["surface"]))
    p.setBrush(g)
    p.setPen(QPen(col, 2))
    p.drawEllipse(r)
    glyph = line_icon(_CLASS_GLYPH.get(class_key.lower(), "star"), int(size * 0.5), col.lighter(130), dpr)
    off = (size - size * 0.5) / 2
    p.drawPixmap(QPointF(off, off), glyph)
    p.end()
    return pm


CLASS_KEYS = tuple(_CLASS_GLYPH)
