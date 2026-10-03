"""Upgrade screen (P7): stats form -> engine.marginal, shown as one horizontal bar per stat (DPS gain %).

Left: your stats (grouped form). Right: ranked bars, longest = best next upgrade, each with the delta it
assumes, the DPS gain and a confidence chip. The bars are plain widgets built from `engine.marginal` rows.
"""
from dataclasses import replace

from PySide6.QtCore import QRectF, QSize, Qt
from PySide6.QtGui import QColor, QLinearGradient, QPainter
from PySide6.QtWidgets import (
    QFrame,
    QHBoxLayout,
    QScrollArea,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)

from aion2c.interfaces import EngineFacade
from aion2c.models import GameData, Priority
from aion2c.state import AppState
from aion2c.ui.build_planner import StatsForm, _clear, stat_label
from aion2c.ui.live import LiveBound
from aion2c.ui.theme import PALETTE
from aion2c.ui.widgets import Banner, Card, Chip, EmptyState, GhostButton, StatPill, icon, text_label

BAR_H = 12
LABEL_W = 170
GAIN_W = 74


def _tone(conf: str) -> str:
    return conf if conf in ("confirmed", "estimated", "unknown") else "neutral"


class GainBar(QWidget):
    """Rounded track with a gold fill of `fraction` (0..1) of its width."""

    def __init__(self, fraction: float, best: bool = False, parent=None):
        super().__init__(parent)
        self.fraction = max(0.0, min(1.0, fraction))
        self.best = best
        self.setFixedHeight(BAR_H)
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)

    def sizeHint(self) -> QSize:
        return QSize(160, BAR_H)

    def paintEvent(self, _e) -> None:
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        r = QRectF(self.rect())
        p.setPen(Qt.NoPen)
        p.setBrush(QColor(PALETTE["surface3"]))
        p.drawRoundedRect(r, BAR_H / 2, BAR_H / 2)
        if self.fraction <= 0:
            return
        w = max(BAR_H, r.width() * self.fraction)  # keep a visible pill for tiny gains
        fill = QRectF(r.x(), r.y(), w, r.height())
        g = QLinearGradient(fill.topLeft(), fill.topRight())
        if self.best:
            g.setColorAt(0, QColor(PALETTE["gold_lo"]))
            g.setColorAt(1, QColor(PALETTE["gold_hi"]))
        else:
            g.setColorAt(0, QColor(PALETTE["border"]))
            g.setColorAt(1, QColor(PALETTE["cyan"]).darker(115))
        p.setBrush(g)
        p.drawRoundedRect(fill, BAR_H / 2, BAR_H / 2)


class GainRow(QFrame):
    """rank | stat name + delta | bar | gain % | confidence."""

    def __init__(self, rank: int, g, best_gain: float, parent=None):
        super().__init__(parent)
        self.stat = g.stat
        self.gain = g.dps_gain_pct
        self.setObjectName("gain")
        self.setAttribute(Qt.WA_StyledBackground, True)
        best = rank == 1
        self.setStyleSheet(
            f"QFrame#gain{{background:{'#18203f' if best else PALETTE['surface']};"
            f"border:1px solid {PALETTE['gold_lo'] if best else PALETTE['border_soft']};border-radius:12px;}}")
        lay = QHBoxLayout(self)
        lay.setContentsMargins(14, 10, 14, 10)
        lay.setSpacing(14)
        num = text_label(str(rank), "")
        num.setFixedWidth(22)
        num.setAlignment(Qt.AlignCenter)
        num.setStyleSheet(
            f"color:{PALETTE['gold_hi'] if best else PALETTE['text_faint']};font-weight:700;font-size:15px;background:transparent;")
        lay.addWidget(num)
        names = QVBoxLayout()
        names.setSpacing(0)
        nm = text_label(stat_label(g.stat), "")
        nm.setStyleSheet("font-weight:600;background:transparent;")
        names.addWidget(nm)
        names.addWidget(text_label(f"per +{g.delta:g}", "caption"))
        names_w = QWidget()
        names_w.setFixedWidth(LABEL_W)
        names_w.setLayout(names)
        lay.addWidget(names_w)
        lay.addWidget(GainBar(g.dps_gain_pct / best_gain if best_gain > 0 else 0.0, best), 1)
        val = text_label(f"{g.dps_gain_pct:+.2f}%", "")
        val.setFixedWidth(GAIN_W)
        val.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        val_col = PALETTE["error"] if g.dps_gain_pct < 0 else PALETTE["gold_hi"] if best else PALETTE["text"]
        val.setStyleSheet(f"font-weight:700;font-size:15px;background:transparent;color:{val_col};")
        val.setToolTip("Negative: one more point of this stat lowers DPS (for example it slows a cast)."
                       if g.dps_gain_pct < 0 else "")
        lay.addWidget(val)
        chip = Chip(g.confidence.capitalize(), _tone(g.confidence))
        chip.setToolTip("Formula is a community fit" if g.confidence != "confirmed" else "Confirmed")
        chip.setFixedWidth(84)
        chip.setAlignment(Qt.AlignCenter)
        lay.addWidget(chip)


class UpgradeScreen(LiveBound, QWidget):
    def __init__(self, state: AppState, gd: GameData, engine: EngineFacade, parent=None):
        super().__init__(parent)
        self.state, self.gd, self.engine = state, gd, engine
        self._priority: Priority | None = None
        self._building = False
        self.rows: list[GainRow] = []
        self.form = StatsForm()
        self.status = text_label("Waiting for optimizer results.", "dim", wrap=True)
        self.recompute = GhostButton("Recompute")
        self.recompute.setIcon(icon("refresh", 16))
        self.pill_best = StatPill("Best next upgrade", "-", "gold")
        self.pill_scn = StatPill("Scenario", "-", "info")
        self.banner = Banner("error", "")
        self.banner.setVisible(False)
        self.bars = QVBoxLayout()
        self.bars.setSpacing(8)

        head = QHBoxLayout()
        head.setSpacing(10)
        titles = QVBoxLayout()
        titles.setSpacing(2)
        titles.addWidget(text_label("Upgrade advisor", "display"))
        titles.addWidget(text_label(
            "Marginal DPS per extra point of each stat, using your current best rotation.", "dim", wrap=True))
        head.addLayout(titles, 1)
        head.addWidget(self.pill_scn, 0, Qt.AlignTop)
        head.addWidget(self.pill_best, 0, Qt.AlignTop)

        stats_card = Card("Your stats", "Edit a number and the ranking updates.")
        stats_card.add(self.form)
        stats_col = QVBoxLayout()
        stats_col.addWidget(stats_card)
        stats_col.addStretch(1)

        rank_card = Card("Where the next point goes", "Longest bar = biggest DPS gain per extra point.")
        top = QHBoxLayout()
        top.addWidget(self.status, 1)
        top.addWidget(self.recompute)
        rank_card.body.addLayout(top)
        rank_card.body.addLayout(self.bars)
        right = QVBoxLayout()
        right.addWidget(rank_card)
        right.addStretch(1)

        cols = QHBoxLayout()
        cols.setSpacing(20)
        cols.addLayout(stats_col, 4)
        cols.addLayout(right, 6)
        page = QWidget()
        page.setObjectName("Root")
        pl = QVBoxLayout(page)
        pl.setContentsMargins(24, 20, 24, 24)
        pl.setSpacing(14)
        pl.addLayout(head)
        pl.addWidget(self.banner)
        pl.addLayout(cols, 1)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setWidget(page)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(scroll)

        self.form.statsEdited.connect(self._on_stats)
        self.recompute.clicked.connect(self.refresh)
        state.buildChanged.connect(self._sync_form)
        state.resultsReady.connect(self._on_results)
        self._gd_shown = gd
        state.dataChanged.connect(self._on_data)
        self._sync_form()
        self._priority = state.best_priority()
        self.refresh()

    def _sync_form(self, *_a) -> None:
        self._building = True
        self.form.set_stats(self.state.build().stats)
        self._building = False

    def _on_stats(self, stats) -> None:
        if not self._building:
            self.state.set_build(replace(self.state.build(), stats=stats))

    def _on_data(self) -> None:
        """Class switch: the cached priority names the old class's skills."""
        gd = self.state.gamedata()
        if gd is not self._gd_shown:
            self._gd_shown, self._priority = gd, None
            self.refresh()

    def _on_results(self, result) -> None:
        self._priority = result.options[0].priority if result.options else None
        self.refresh()

    def _show_rows(self, gains) -> None:
        _clear(self.bars)
        self.rows = []
        if not gains:
            self.bars.addWidget(EmptyState("bolt", "No stat gains to rank yet. Enter your stats and wait for the optimizer."))
            return
        best = max((g.dps_gain_pct for g in gains), default=0.0)
        for i, g in enumerate(gains, 1):
            row = GainRow(i, g, best)
            self.bars.addWidget(row)
            self.rows.append(row)

    def refresh(self, *_a) -> None:
        scn = self.state.scenario().name
        self.pill_scn.set_value(scn)
        pr = self._priority or self.state.best_priority()
        self.banner.setVisible(False)
        if pr is None:
            self._show_rows([])
            self.pill_best.set_value("-")
            self.status.setText("Waiting for optimizer results.")
            return
        try:
            gains = self.engine.marginal(self.state.build(), pr, self.state.scenario())
        except Exception as e:  # keep the window alive if the engine is mid-build
            self._show_rows([])
            self.pill_best.set_value("-")
            self.status.setText("")
            self.banner.set_kind("error")
            self.banner.set_text(f"Marginal analysis failed: {e}. Press Recompute once the data has finished loading.")
            self.banner.setVisible(True)
            return
        self._show_rows(gains)
        self.pill_best.set_value(stat_label(gains[0].stat) if gains else "-")
        self.status.setText(f"{len(gains)} stats ranked for {scn}.")
