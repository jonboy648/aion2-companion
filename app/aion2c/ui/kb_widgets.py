"""Keybinds visuals: a keyboard of key tiles with skill icons, and macro step cards.

Private to keybinds_view (kept in its own file to stay small). Presentation only: the app never sends
input to the game; tiles just record which skill the player has on which in-game key.
"""
from PySide6.QtCore import QPointF, QRectF, QSize, Qt, Signal
from PySide6.QtGui import QColor, QFont, QFontMetrics, QIcon, QPainter, QPen, QPixmap
from PySide6.QtWidgets import QGridLayout, QHBoxLayout, QLabel, QMenu, QSizePolicy, QVBoxLayout, QWidget

from aion2c.ui.theme import PALETTE
from aion2c.ui.widgets import Card, Chip, IconTile, line_icon

TILE_W, TILE_H = 76, 86
NUMBER_ROW = "1234567890-="
LETTER_ROWS = ("QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM")
_STAGGER = (0.0, 0.5, 1.0)  # indent of each letter row, in tiles


def _font(px: int, bold: bool = False) -> QFont:
    f = QFont()
    f.setPixelSize(px)
    f.setBold(bold)
    return f


class KeyTile(QWidget):
    """One key cap: label top-left, skill icon in the middle, elided skill name below."""

    pick = Signal(str)   # key label: open the skill menu
    clear = Signal(str)  # key label: right click or Delete

    def __init__(self, label: str, parent: QWidget | None = None):
        super().__init__(parent)
        self.label = label
        self.skill_key: str | None = None
        self.skill_name = ""
        self._pm: QPixmap | None = None
        self._hover = False
        self.setFixedSize(TILE_W, TILE_H)
        self.setCursor(Qt.PointingHandCursor)
        self.setFocusPolicy(Qt.StrongFocus)
        self.setMouseTracking(True)
        self._tip()

    def set_skill(self, key: str | None, name: str = "", pm: QPixmap | None = None) -> None:
        self.skill_key, self.skill_name, self._pm = key, name, pm
        self._tip()
        self.update()

    def _tip(self) -> None:
        self.setToolTip(f"Key {self.label}: {self.skill_name}\nClick to change, right-click to clear"
                        if self.skill_key else f"Key {self.label}: empty\nClick to assign a skill")

    def sizeHint(self) -> QSize:  # noqa: N802
        return QSize(TILE_W, TILE_H)

    def enterEvent(self, e) -> None:  # noqa: N802
        self._hover = True
        self.update()

    def leaveEvent(self, e) -> None:  # noqa: N802
        self._hover = False
        self.update()

    def mousePressEvent(self, e) -> None:  # noqa: N802
        if e.button() == Qt.RightButton:
            self.clear.emit(self.label)
        elif e.button() == Qt.LeftButton:
            self.setFocus()
            self.pick.emit(self.label)

    def keyPressEvent(self, e) -> None:  # noqa: N802
        if e.key() in (Qt.Key_Return, Qt.Key_Enter, Qt.Key_Space):
            self.pick.emit(self.label)
        elif e.key() in (Qt.Key_Delete, Qt.Key_Backspace):
            self.clear.emit(self.label)
        else:
            super().keyPressEvent(e)

    def paintEvent(self, _e) -> None:  # noqa: N802
        p = QPainter(self)
        p.setRenderHints(QPainter.Antialiasing | QPainter.TextAntialiasing)
        r = QRectF(1, 1, self.width() - 2, self.height() - 2)
        bound = self.skill_key is not None
        edge = QColor(PALETTE["gold"] if bound else PALETTE["border"])
        if self.hasFocus():
            edge = QColor(PALETTE["cyan"])
        elif self._hover:
            edge = QColor(PALETTE["gold_hi"] if bound else PALETTE["text_faint"])
        p.setPen(QPen(edge, 1.6 if bound or self._hover or self.hasFocus() else 1))
        p.setBrush(QColor(PALETTE["surface3" if self._hover else "surface2"]))
        p.drawRoundedRect(r, 9, 9)
        p.setFont(_font(10, True))
        p.setPen(QColor(PALETTE["gold_hi"] if bound else PALETTE["text_dim"]))
        p.drawText(QRectF(7, 4, 24, 14), Qt.AlignLeft | Qt.AlignVCenter, self.label)
        box = QRectF((self.width() - 42) / 2, 20, 42, 42)
        if bound and self._pm is not None and not self._pm.isNull():
            p.setPen(QPen(QColor(PALETTE["border"]), 1))
            p.setBrush(QColor(PALETTE["bg"]))
            p.drawRoundedRect(box.adjusted(-1, -1, 1, 1), 6, 6)
            sz = int(box.width())
            pm = self._pm.scaled(sz, sz, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            p.drawPixmap(QPointF(box.x() + (sz - pm.width() / pm.devicePixelRatio()) / 2,
                                 box.y() + (sz - pm.height() / pm.devicePixelRatio()) / 2), pm)
        else:
            pen = QPen(QColor(PALETTE["border"]), 1.2, Qt.DashLine)
            p.setPen(pen)
            p.setBrush(Qt.NoBrush)
            p.drawRoundedRect(box, 8, 8)
            plus = line_icon("plus", 14, PALETTE["text_faint"])
            p.drawPixmap(QPointF(box.center().x() - 7, box.center().y() - 7), plus)
        if bound:
            f = _font(10)
            p.setFont(f)
            p.setPen(QColor(PALETTE["text_dim"]))
            txt = QFontMetrics(f).elidedText(self.skill_name, Qt.ElideRight, self.width() - 8)
            p.drawText(QRectF(4, 66, self.width() - 8, 15), Qt.AlignCenter, txt)


class KeyboardWidget(QWidget):
    """Number row always; QWERTY letter rows on demand. Emits slotChosen(label, skill_key or None)."""

    slotChosen = Signal(str, object)

    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self.tiles: dict[str, KeyTile] = {}
        self._skills: list[tuple[str, str, QPixmap]] = []  # key, name, pixmap
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(6)
        self._letter_rows: list[QWidget] = []
        for i, row in enumerate((NUMBER_ROW,) + LETTER_ROWS):
            w = QWidget()
            h = QHBoxLayout(w)
            h.setContentsMargins(0, 0, 0, 0)
            h.setSpacing(6)
            if i:
                h.addSpacing(int(_STAGGER[i - 1] * (TILE_W + 6)))
            for ch in row:
                t = KeyTile(ch)
                t.pick.connect(self._open_menu)
                t.clear.connect(lambda lb: self.slotChosen.emit(lb, None))
                self.tiles[ch] = t
                h.addWidget(t)
            h.addStretch(1)
            lay.addWidget(w)
            if i:
                w.setVisible(False)
                self._letter_rows.append(w)

    def set_letters_visible(self, on: bool) -> None:
        for w in self._letter_rows:
            w.setVisible(on)

    def letters_visible(self) -> bool:
        return bool(self._letter_rows) and not self._letter_rows[0].isHidden()

    def is_tile_visible(self, label: str) -> bool:
        t = self.tiles.get(label)
        return t is not None and not t.isHidden() and (label in NUMBER_ROW or self.letters_visible())

    def set_skills(self, skills: list[tuple[str, str, QPixmap]]) -> None:
        self._skills = skills

    def set_bar(self, bar: dict[str, str | None]) -> None:
        names = {k: (n, pm) for k, n, pm in self._skills}
        for label, t in self.tiles.items():
            key = bar.get(label)
            if key:
                name, pm = names.get(key, (key, None))
                t.set_skill(key, name, pm)
            else:
                t.set_skill(None)

    def _open_menu(self, label: str) -> None:
        tile = self.tiles[label]
        menu = QMenu(self)
        none = menu.addAction("(empty)")
        none.setData(None)
        menu.addSeparator()
        for key, name, pm in self._skills:
            act = menu.addAction(QIcon(pm), name)
            act.setData(key)
            act.setCheckable(True)
            act.setChecked(key == tile.skill_key)
        chosen = menu.exec(tile.mapToGlobal(tile.rect().bottomLeft()))
        if chosen is not None:
            self.slotChosen.emit(label, chosen.data())


class MacroCard(Card):
    """A macro as a card: hotkey chip, step count and the ordered key presses as numbered icon tiles."""

    PER_ROW = 8

    def __init__(self, name: str, hotkey: str, steps: list[tuple[str, QPixmap | None, str]], delay_ms: int | None,
                 parent: QWidget | None = None):
        super().__init__(name, None, parent=parent)
        row = QHBoxLayout()
        row.setSpacing(6)
        row.addWidget(Chip(f"Hotkey {hotkey}", "gold"))
        row.addWidget(Chip(f"{len(steps)} key" + ("" if len(steps) == 1 else "s"), "neutral"))
        if delay_ms is not None:
            row.addWidget(Chip(f"{delay_ms} ms between keys", "info"))
        row.addStretch(1)
        self.body.addLayout(row)
        if not steps:
            cap = QLabel("No keys in this macro yet: put the skills on your hotbar above, then generate again.")
            cap.setProperty("role", "caption")
            cap.setWordWrap(True)
            self.body.addWidget(cap)
        grid = QGridLayout()
        grid.setHorizontalSpacing(8)
        grid.setVerticalSpacing(8)
        for i, (key_label, pm, skill) in enumerate(steps):
            cell = QVBoxLayout()
            cell.setSpacing(2)
            tile = IconTile(pm, 36, None, str(i + 1))
            tile.setToolTip(f"Step {i + 1}: press {key_label}" + (f" ({skill})" if skill else ""))
            cell.addWidget(tile, 0, Qt.AlignHCenter)
            lab = QLabel(key_label)
            lab.setAlignment(Qt.AlignHCenter)
            lab.setProperty("role", "caption")
            cell.addWidget(lab)
            grid.addLayout(cell, i // self.PER_ROW, i % self.PER_ROW)
        grid.setColumnStretch(self.PER_ROW, 1)
        self.body.addLayout(grid)


class CardList(QWidget):
    """Vertical stack of cards with count()/clear()."""

    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self._lay = QVBoxLayout(self)
        self._lay.setContentsMargins(0, 0, 0, 0)
        self._lay.setSpacing(12)
        self._lay.addStretch(1)
        self._items: list[QWidget] = []
        self.setSizePolicy(QSizePolicy.Preferred, QSizePolicy.Minimum)

    def add(self, w: QWidget) -> None:
        self._lay.insertWidget(len(self._items), w)
        self._items.append(w)

    def count(self) -> int:
        return len(self._items)

    def clear(self) -> None:
        for w in self._items:
            w.setParent(None)
            w.deleteLater()
        self._items = []
