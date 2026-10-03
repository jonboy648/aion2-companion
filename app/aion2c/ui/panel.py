"""Overlay panel: always-on-top, frameless, translucent strip of the next 5 skills.
It only displays; it never sends anything to the game.

Look: dark glass strip with a class-coloured accent bar, a large "next" tile followed by smaller queue
tiles (rank badges), and the next skill's name at a glance. Painted by hand (no stylesheet colours, no
shadows, no animation) so it stays cheap on top of a running game."""
from PySide6.QtCore import QRectF, Qt
from PySide6.QtGui import QColor, QFont, QLinearGradient, QPainter, QPen
from PySide6.QtWidgets import QHBoxLayout, QLabel, QVBoxLayout, QWidget

import aion2c.settings as settings
from aion2c.classes import class_name
from aion2c.interfaces import EngineFacade, LiveStateSource
from aion2c.models import GameData
from aion2c.state import AppState
from aion2c.ui import icons
from aion2c.ui.live import LiveBound
from aion2c.ui.theme import PALETTE, class_color
from aion2c.ui.widgets import class_emblem

N_SLOTS = 5
ICON_PX = 48  # queue tiles
NEXT_PX = 60  # the first (next) tile is larger so it reads at a glance


class _Slot(QLabel):
    """Icon tile: bezel, pixmap, rank badge. `pixmap()` is the skill icon (tests read it)."""

    def __init__(self, rank: int, size: int, parent: QWidget | None = None):
        super().__init__(parent)
        self.rank, self.px = rank, size
        self.accent = QColor(PALETTE["border"])
        self.filled = False
        self.setFixedSize(size + 8, size + 8)
        self.setAlignment(Qt.AlignmentFlag.AlignCenter)

    def paintEvent(self, e) -> None:
        p = QPainter(self)
        p.setRenderHints(QPainter.RenderHint.Antialiasing)
        r = QRectF(self.rect()).adjusted(1.5, 1.5, -1.5, -1.5)
        rad = max(7, self.px // 6)
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(PALETTE["surface"]) if self.filled else QColor(255, 255, 255, 10))
        p.drawRoundedRect(r, rad, rad)
        if self.filled:
            p.end()
            super().paintEvent(e)  # draws the pixmap centred
            p = QPainter(self)
            p.setRenderHints(QPainter.RenderHint.Antialiasing)
        first = self.rank == 1
        if self.filled and first:
            glow = QColor(self.accent)
            glow.setAlpha(70)
            p.setPen(QPen(glow, 4))
            p.setBrush(Qt.BrushStyle.NoBrush)
            p.drawRoundedRect(r, rad, rad)
        edge = self.accent if (self.filled and first) else QColor(PALETTE["border"])
        p.setPen(QPen(edge, 1.5 if first else 1.0))
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.drawRoundedRect(r, rad, rad)
        if self.filled:
            f = QFont(self.font())
            f.setPixelSize(10)
            f.setBold(True)
            p.setFont(f)
            d = 16
            br = QRectF(self.width() - d - 1, self.height() - d - 1, d, d)
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor(PALETTE["gold"]) if first else QColor(PALETTE["bg"]))
            p.drawEllipse(br)
            p.setPen(QColor(PALETTE["gold_ink"]) if first else QColor(PALETTE["gold_hi"]))
            p.drawText(br, Qt.AlignmentFlag.AlignCenter, str(self.rank))
        p.end()


class Panel(LiveBound, QWidget):
    def __init__(
        self, state: AppState, gd: GameData, engine: EngineFacade, source: LiveStateSource, parent=None
    ):
        super().__init__(parent)
        self.state, self.gd, self.engine, self.source = state, gd, engine, source
        self._drag = None
        self._keys: list[str] = []
        self._accent = class_color(state.class_key()) if hasattr(state, "class_key") else QColor(PALETTE["gold"])
        cfg = settings.load_user().get("panel", {})
        self.setWindowFlags(
            Qt.WindowType.FramelessWindowHint | Qt.WindowType.WindowStaysOnTopHint | Qt.WindowType.Tool
        )
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setWindowOpacity(float(cfg.get("opacity") or 0.85))
        self.set_click_through(bool(cfg.get("click_through")))
        if cfg.get("x") is not None and cfg.get("y") is not None:
            self.move(int(cfg["x"]), int(cfg["y"]))

        col = QVBoxLayout(self)
        col.setContentsMargins(12, 12, 14, 10)
        col.setSpacing(6)
        head = QHBoxLayout()
        head.setSpacing(7)
        self.emblem = QLabel()
        self.emblem.setFixedSize(18, 18)
        self.emblem.setScaledContents(True)
        self.heading = QLabel("")
        self.heading.setStyleSheet(f"color:{PALETTE['text_faint']};font-size:10px;font-weight:600;"
                                   "letter-spacing:2px;background:transparent;")
        head.addWidget(self.emblem)
        head.addWidget(self.heading)
        head.addStretch(1)
        col.addLayout(head)

        row = QHBoxLayout()
        row.setSpacing(6)
        self.slots: list[QLabel] = []
        for i in range(N_SLOTS):
            lab = _Slot(i + 1, NEXT_PX if i == 0 else ICON_PX)
            row.addWidget(lab, 0, Qt.AlignmentFlag.AlignVCenter)
            self.slots.append(lab)
            if i == 0:
                row.addSpacing(6)
        col.addLayout(row)
        self.next_name = QLabel("")
        self.next_name.setStyleSheet(f"color:{PALETTE['text']};font-size:15px;font-weight:600;background:transparent;")
        col.addWidget(self.next_name)
        self.status = QLabel("")
        self.status.setStyleSheet(f"color:{PALETTE['warn']};font-size:10px;background:transparent;")
        col.addWidget(self.status)

        state.resultsReady.connect(self.refresh)
        state.dataChanged.connect(self.refresh)  # class switch clears the result; drop the old class's icons
        self.refresh()

    # painting
    def paintEvent(self, _e) -> None:
        p = QPainter(self)
        p.setRenderHints(QPainter.RenderHint.Antialiasing)
        r = QRectF(self.rect()).adjusted(0.5, 0.5, -0.5, -0.5)
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(11, 16, 32, 232))
        p.drawRoundedRect(r, 12, 12)
        g = QLinearGradient(r.left(), 0, r.right(), 0)  # class-coloured bar along the top edge
        g.setColorAt(0.0, self._accent)
        faded = QColor(self._accent)
        faded.setAlpha(0)
        g.setColorAt(1.0, faded)
        p.setBrush(g)
        p.drawRoundedRect(QRectF(r.left() + 10, r.top() + 1, r.width() - 20, 3), 1.5, 1.5)
        p.setPen(QPen(QColor(PALETTE["border"]), 1))
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.drawRoundedRect(r, 12, 12)
        p.end()

    # content
    def refresh(self, *_):
        """Re-read the next skills from the engine for the best priority of the current scenario."""
        pr = self.state.best_priority()
        keys: list[str] = []
        if pr is not None:
            try:
                keys = list(self.engine.next_skills(
                    self.state.build(), pr, self.state.scenario(), self.source.snapshot(), N_SLOTS))
            except Exception as e:
                self.status.setText(f"next_skills failed: {e}")
        gd = self.state.gamedata()
        ckey = gd.class_key if gd is not None else self.state.class_key()
        self._accent = class_color(ckey)
        self.emblem.setPixmap(class_emblem(ckey, 18))
        self.heading.setText(f"{class_name(ckey).upper()}  ·  NEXT")
        self._keys = keys[:N_SLOTS]
        for i, lab in enumerate(self.slots):
            lab.accent = self._accent
            lab.filled = i < len(self._keys)
            if lab.filled:
                k = self._keys[i]
                lab.setPixmap(icons.pixmap(gd, k, lab.px))
                s = gd.skills.get(k)
                lab.setToolTip(s.name if s else k)
            else:
                lab.clear()
                lab.setToolTip("")
            lab.update()
        first = gd.skills.get(self._keys[0]) if self._keys else None
        self.next_name.setText((first.name if first else self._keys[0]) if self._keys else "")
        if pr is None and not self.status.text():
            self.status.setText("calculating...")
        elif keys:
            self.status.setText("")
        self.status.setVisible(bool(self.status.text()))
        self.update()

    def slot_keys(self) -> list[str]:
        return list(self._keys)

    def set_status(self, text: str) -> None:
        self.status.setText(text)
        self.status.setVisible(bool(text))

    # window behaviour
    def set_click_through(self, on: bool) -> None:
        was = self.isVisible()
        self.setWindowFlag(Qt.WindowType.WindowTransparentForInput, bool(on))
        if was:
            self.show()  # changing flags hides the window

    def toggle(self) -> None:
        self.setVisible(not self.isVisible())

    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton:
            self._drag = e.globalPosition().toPoint() - self.frameGeometry().topLeft()

    def mouseMoveEvent(self, e):
        if self._drag is not None and e.buttons() & Qt.MouseButton.LeftButton:
            self.move(e.globalPosition().toPoint() - self._drag)

    def mouseReleaseEvent(self, e):
        if self._drag is not None:
            self._drag = None
            u = settings.load_user()
            u["panel"] = {**u["panel"], "x": self.x(), "y": self.y()}
            settings.save_user(u)
