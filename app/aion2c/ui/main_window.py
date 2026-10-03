"""Window-mode shell (P7): 8 tabs + toolbar (class, region, show KR data, scenario, Panel button).

Visual shell: brand block, class picker with class emblems, a class-coloured accent line under the
toolbar, icon tabs and a status bar. Behaviour (state wiring) is unchanged; widgets that tests and the
app drive (`tabs`, `class_box`, `region`, `show_kr`, `scenario`, `panel_btn`) keep their names.
"""
from dataclasses import replace

from PySide6.QtCore import QRectF, QSize, Qt, Signal
from PySide6.QtGui import QColor, QIcon, QLinearGradient, QPainter
from PySide6.QtWidgets import (
    QCheckBox, QComboBox, QHBoxLayout, QLabel, QMainWindow, QSizePolicy, QTabWidget, QToolBar, QVBoxLayout, QWidget,
)

from aion2c.classes import class_info, class_name
from aion2c.data.loader import available_classes
from aion2c.interfaces import EngineFacade
from aion2c.models import SCENARIOS, GameData
from aion2c.state import AppState
from aion2c.ui.build_planner import BuildScreen
from aion2c.ui.codex import CodexScreen
from aion2c.ui.crafting_view import CraftingView
from aion2c.ui.daevanion_view import DaevanionView
from aion2c.ui.home_view import HomeView
from aion2c.ui.keybinds_view import KeybindsScreen
from aion2c.ui.live import LiveBound
from aion2c.ui.roadmap_view import RoadmapScreen
from aion2c.ui.theme import PALETTE, app_icon, class_color
from aion2c.ui.upgrade import UpgradeScreen
from aion2c.ui.widgets import Chip, PrimaryButton, class_emblem, icon, line_icon, set_role

TABS = (
    ("My Build", HomeView),
    ("Codex", CodexScreen),
    ("Build", BuildScreen),
    ("Upgrade", UpgradeScreen),
    ("Daevanion", DaevanionView),
    ("Crafting", CraftingView),
    ("Road Map", RoadmapScreen),
    ("Keybinds", KeybindsScreen),
)
TAB_ICONS = {
    "My Build": "home", "Codex": "codex", "Build": "build", "Upgrade": "upgrade", "Daevanion": "daevanion",
    "Crafting": "crafting", "Road Map": "roadmap", "Keybinds": "keybinds",
}
ROLE_TEXT = {
    "melee_dps": "Melee DPS", "ranged_dps": "Ranged DPS", "tank": "Tank", "healer": "Healer", "support": "Support",
}
ROLE_TONE = {"melee_dps": "error", "ranged_dps": "warn", "tank": "info", "healer": "ok", "support": "gold"}


class _AccentLine(QWidget):
    """3px strip under the toolbar: class colour fading to the border colour."""

    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self.setFixedHeight(3)
        self._col = QColor(PALETTE["gold"])

    def set_color(self, c: QColor) -> None:
        self._col = QColor(c)
        self.update()

    def paintEvent(self, _e) -> None:
        p = QPainter(self)
        g = QLinearGradient(0, 0, self.width(), 0)
        g.setColorAt(0.0, self._col)
        mid = QColor(self._col)
        mid.setAlpha(120)
        g.setColorAt(0.45, mid)
        g.setColorAt(1.0, QColor(PALETTE["border_soft"]))
        p.fillRect(QRectF(self.rect()), g)


class _Brand(QWidget):
    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        lay = QHBoxLayout(self)
        lay.setContentsMargins(2, 0, 10, 0)
        lay.setSpacing(10)
        mark = QLabel()
        mark.setPixmap(app_icon().pixmap(QSize(30, 30)))
        mark.setFixedSize(30, 30)
        mark.setScaledContents(True)
        col = QVBoxLayout()
        col.setContentsMargins(0, 0, 0, 0)
        col.setSpacing(0)
        name = QLabel("AION 2")
        set_role(name, "title")
        name.setStyleSheet(f"color:{PALETTE['gold_hi']};font-weight:700;letter-spacing:2px;")
        sub = QLabel("COMPANION")
        set_role(sub, "caption")
        sub.setStyleSheet(f"color:{PALETTE['text_faint']};letter-spacing:3px;font-size:9px;")
        col.addWidget(name)
        col.addWidget(sub)
        lay.addWidget(mark)
        lay.addLayout(col)


def _field(caption: str, widget: QWidget) -> QWidget:
    """Small caption above a toolbar control."""
    box = QWidget()
    lay = QVBoxLayout(box)
    lay.setContentsMargins(0, 0, 0, 0)
    lay.setSpacing(2)
    cap = QLabel(caption.upper())
    set_role(cap, "caption")
    cap.setStyleSheet(f"color:{PALETTE['text_faint']};letter-spacing:1px;font-size:9px;font-weight:600;")
    lay.addWidget(cap)
    lay.addWidget(widget)
    return box


class MainWindow(LiveBound, QMainWindow):
    panelRequested = Signal()

    def __init__(self, state: AppState, gd: GameData, engine: EngineFacade, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Aion 2 Companion")
        self.setWindowIcon(app_icon())
        self.resize(1280, 860)
        self.state, self.gd, self.engine = state, gd, engine
        self._syncing = False
        self.tabs = QTabWidget()
        self.tabs.setDocumentMode(True)
        self.tabs.setIconSize(QSize(18, 18))
        self.tabs.tabBar().setExpanding(False)
        self.tabs.tabBar().setCursor(Qt.PointingHandCursor)
        for name, cls in TABS:
            w = cls(state, gd, engine)
            if cls is HomeView:
                w.panelRequested.connect(self.panelRequested.emit)
            self.tabs.addTab(w, icon(TAB_ICONS[name], 18), name)
        self.accent = _AccentLine()
        central = QWidget()
        cl = QVBoxLayout(central)
        cl.setContentsMargins(0, 0, 0, 0)
        cl.setSpacing(0)
        cl.addWidget(self.accent)
        cl.addWidget(self.tabs, 1)
        self.setCentralWidget(central)

        self.class_box = QComboBox()
        self.class_box.setIconSize(QSize(22, 22))
        self.class_box.setMinimumWidth(170)
        for key in available_classes():
            self.class_box.addItem(QIcon(class_emblem(key, 22)), class_name(key), key)
        self.region = QComboBox()
        self.region.addItem("Global", "global")
        self.region.addItem("Korea", "korea")
        self.show_kr = QCheckBox("Show KR data")
        self.scenario = QComboBox()
        self.scenario.setMinimumWidth(190)
        for s in SCENARIOS:
            self.scenario.addItem(s.name, s.key)
        self.role_chip = Chip("", "neutral")
        self.panel_btn = PrimaryButton("Panel")
        self.panel_btn.setIcon(QIcon(line_icon("panel", 18, PALETTE["gold_ink"])))
        self.panel_btn.setToolTip("Show the always-on-top skill panel (display only)")

        bar = QToolBar("Main")
        bar.setMovable(False)
        bar.setFloatable(False)
        bar.setIconSize(QSize(18, 18))
        bar.addWidget(_Brand())
        bar.addSeparator()
        bar.addWidget(_field("Class", self.class_box))
        bar.addWidget(self.role_chip)
        bar.addSeparator()
        bar.addWidget(_field("Region", self.region))
        bar.addWidget(_field("Scenario", self.scenario))
        kr_wrap = QWidget()
        kl = QVBoxLayout(kr_wrap)
        kl.setContentsMargins(6, 14, 0, 0)
        kl.addWidget(self.show_kr)
        bar.addWidget(kr_wrap)
        spacer = QWidget()
        spacer.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred)
        bar.addWidget(spacer)
        pb = QWidget()
        pl = QVBoxLayout(pb)
        pl.setContentsMargins(0, 14, 0, 0)
        pl.addWidget(self.panel_btn)
        bar.addWidget(pb)
        self.addToolBar(bar)

        sb = self.statusBar()
        sb.setSizeGripEnabled(False)
        self.status_class = QLabel()
        self.status_note = QLabel("Display only: this app never sends input to the game")
        set_role(self.status_note, "caption")
        self.status_class.setContentsMargins(0, 0, 10, 0)
        self.status_note.setContentsMargins(0, 0, 14, 0)
        sb.addPermanentWidget(self.status_class)
        sb.addPermanentWidget(self.status_note)

        self.class_box.currentIndexChanged.connect(self._on_class)
        self.region.currentIndexChanged.connect(self._on_region)
        self.show_kr.toggled.connect(self._on_show_kr)
        self.scenario.currentIndexChanged.connect(self._on_scenario)
        self.panel_btn.clicked.connect(self.panelRequested.emit)
        state.buildChanged.connect(self._sync)
        self._sync()

    def _sync(self, *_a) -> None:
        self._syncing = True
        try:
            b = self.state.build()
            self.class_box.setCurrentIndex(max(0, self.class_box.findData(b.class_key)))
            self.setWindowTitle(f"Aion 2 {class_name(b.class_key)} Companion")
            self.region.setCurrentIndex(max(0, self.region.findData(b.region)))
            self.show_kr.setChecked(self.state.show_kr())
            self.scenario.setCurrentIndex(max(0, self.scenario.findData(self.state.scenario().key)))
            self._style_class(b.class_key, b.level, b.region)
        finally:
            self._syncing = False

    def _style_class(self, key: str, level: int, region: str) -> None:
        col = class_color(key)
        self.accent.set_color(col)
        info = class_info(key)
        role = info.role if info else ""
        self.role_chip.setText(ROLE_TEXT.get(role, "Class"))
        tone = ROLE_TONE.get(role, "neutral")
        probe = Chip("", tone)  # reuse the Chip styling for the tone
        self.role_chip.setStyleSheet(probe.styleSheet())
        self.status_class.setText(
            f'<span style="color:{col.name()}">&#9679;</span> {class_name(key)} &middot; Lv {level} '
            f'&middot; {region.title()} ')

    def _on_class(self, _i: int) -> None:
        key = self.class_box.currentData()
        if not self._syncing and key and key != self.state.class_key():
            self.state.set_class(key)

    def _on_region(self, _i: int) -> None:
        if self._syncing:
            return
        b = self.state.build()
        region = self.region.currentData()
        if region != b.region:
            cap = self.state.gamedata().level_caps[region]
            self.state.set_build(replace(b, region=region, level=min(b.level, cap)))

    def _on_show_kr(self, on: bool) -> None:
        if not self._syncing:
            self.state.set_show_kr(on)

    def _on_scenario(self, _i: int) -> None:
        if not self._syncing:
            self.state.set_scenario(self.scenario.currentData())
