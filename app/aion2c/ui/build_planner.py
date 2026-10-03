"""Build screen (P7): level, ranks, stigmas, stats, optimizer results, compare, calibrate.

Layout (see D:\\Aion2\\DESIGN.md): two columns inside one scroll area. Left = what you enter (character, stats,
ranks, stigmas); right = what comes out (ranked option cards, cast order, differences, warnings, compare, calibrate).
"""
from dataclasses import fields, replace

from PySide6.QtCore import QSize, Qt, Signal
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QAbstractItemView,
    QApplication,
    QCheckBox,
    QComboBox,
    QDoubleSpinBox,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QSpinBox,
    QTableWidget,
    QToolButton,
    QVBoxLayout,
    QWidget,
)

import aion2c.engine.budget as budget_mod
from aion2c.interfaces import EngineFacade
from aion2c.models import (
    SCENARIOS,
    SKILL_POINT_COST,
    CharacterBuild,
    GameData,
    SimConfig,
    SkillKind,
    Stats,
)
from aion2c.settings import load_user, save_user
from aion2c.state import AppState
from aion2c.ui.codex import (
    castable_skills,
    count_confidence,
    make_item,
    num_item,
    rank_cap,
    skill_icon,
    skill_name,
)
from aion2c.ui.confidence import fmt_num
from aion2c.ui.live import LiveBound
from aion2c.ui.theme import PALETTE
from aion2c.ui.widgets import (
    Banner,
    Card,
    Chip,
    GhostButton,
    PrimaryButton,
    SectionHeader,
    StatPill,
    icon,
    line_icon,
    set_role,
    text_label,
)

NO_BUDGET = -1  # spinbox sentinel for "None"

STAT_LABELS = {
    "attack": ("Attack", "Your Attack value from the character sheet (C)."),
    "attack_increase_pct": ("Attack increase %", "Percent bonus to Attack."),
    "weapon_dmg_pct": ("Weapon damage %", "Percent bonus to weapon damage."),
    "dmg_boost_pct": ("Damage boost %", "General damage boost percent."),
    "pve_dmg_pct": ("PvE damage %", "Bonus damage against monsters."),
    "boss_dmg_pct": ("Boss damage %", "Bonus damage against bosses."),
    "crit_chance_pct": ("Crit chance %", "Chance for a hit to be a critical hit."),
    "crit_dmg_pct": ("Crit damage %", "Extra damage a critical hit deals."),
    "smite_pct": ("Smite %", "Smite stat percent from the character sheet."),
    "combat_speed_pct": ("Combat speed %", "Makes casts and animations faster."),
    "cdr_pct": ("Cooldown reduction %", "Shortens skill cooldowns."),
    "max_mp": ("Max MP", "Your maximum mana."),
    "mp_regen_per_s": ("MP regen / s", "Mana regained per second."),
    "target_defense": ("Target defense", "Defense of the enemy you fight. Leave at 0 if unsure."),
    "penetration": ("Penetration", "Ignores part of the enemy's defense."),
}
ADVANCED_STATS = ("max_mp", "mp_regen_per_s", "target_defense", "penetration")
# (group title, stat names) in display order; any Stats field not listed lands in "Other".
STAT_GROUPS = (
    ("Offense", ("attack", "attack_increase_pct", "weapon_dmg_pct", "dmg_boost_pct")),
    ("Against targets", ("pve_dmg_pct", "boss_dmg_pct")),
    ("Critical", ("crit_chance_pct", "crit_dmg_pct", "smite_pct")),
    ("Speed", ("combat_speed_pct", "cdr_pct")),
)
ICON_PX = 28
MIN_DPS_GAP_PCT = 0.5
MAX_SHOWN_OPTIONS = 3
MAX_CARD_ICONS = 11
MAX_TABLE_ROWS = 8


def stat_label(name: str) -> str:
    """Readable name of a Stats field (also used by the Upgrade screen)."""
    return STAT_LABELS.get(name, (name.replace("_", " ").capitalize(), ""))[0]


def fit_height(view, rows: int, row_h: int, max_rows: int = MAX_TABLE_ROWS, extra: int = 0) -> None:
    """Fix a table/list to `rows` (capped) so the page, not the widget, does the scrolling for short lists."""
    head = view.horizontalHeader().sizeHint().height() + 2 if isinstance(view, QTableWidget) else 0
    view.setFixedHeight(head + max(2, min(rows, max_rows)) * row_h + 4 + extra)


def divider() -> QFrame:
    line = QFrame()
    line.setFrameShape(QFrame.HLine)
    line.setFixedHeight(1)
    return line


def group_caption(text: str) -> QLabel:
    lb = text_label(text.upper(), "caption")
    lb.setStyleSheet(f"color:{PALETTE['gold_lo']};font-weight:700;letter-spacing:1px;padding-top:6px;")
    return lb


class StatsForm(QWidget):
    """One QDoubleSpinBox per `Stats` field, grouped. `statsEdited(Stats)` fires on user edits only."""

    statsEdited = Signal(object)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.spins: dict[str, QDoubleSpinBox] = {}
        names = [f.name for f in fields(Stats)]
        listed = {n for _t, ns in STAT_GROUPS for n in ns} | set(ADVANCED_STATS)
        groups = [(t, [n for n in ns if n in names]) for t, ns in STAT_GROUPS]
        groups.append(("Other", [n for n in names if n not in listed]))
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.setSpacing(2)
        for title, ns in groups:
            if ns:
                outer.addWidget(group_caption(title))
                outer.addLayout(self._grid(ns))
        self.advanced = QToolButton()
        self.advanced.setCheckable(True)
        self.advanced.setCursor(Qt.PointingHandCursor)
        self.advanced.setToolButtonStyle(Qt.ToolButtonTextBesideIcon)
        self.advanced.setStyleSheet(
            f"QToolButton{{color:{PALETTE['text_dim']};border:none;background:transparent;padding:8px 0 4px 0;"
            "font-weight:600;}"
            f"QToolButton:hover{{color:{PALETTE['gold_hi']};background:transparent;border:none;}}"
            f"QToolButton:checked{{color:{PALETTE['gold_hi']};background:transparent;border:none;}}"
        )
        self._adv_body = QWidget()
        adv_lay = QVBoxLayout(self._adv_body)
        adv_lay.setContentsMargins(0, 0, 0, 0)
        adv_lay.addLayout(self._grid([n for n in ADVANCED_STATS if n in names]))
        self._adv_body.setVisible(False)
        self.advanced.toggled.connect(self._on_adv)
        self._on_adv(False)
        outer.addWidget(divider())
        outer.addWidget(self.advanced, 0, Qt.AlignLeft)
        outer.addWidget(self._adv_body)

    def _grid(self, ns) -> QGridLayout:
        g = QGridLayout()
        g.setContentsMargins(0, 2, 0, 2)
        g.setHorizontalSpacing(12)
        g.setVerticalSpacing(6)
        g.setColumnStretch(0, 1)
        for r, n in enumerate(ns):
            sp = QDoubleSpinBox()
            sp.setRange(-1e9, 1e9)
            sp.setDecimals(2)
            sp.setFixedWidth(130)
            sp.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
            sp.valueChanged.connect(self._edited)
            self.spins[n] = sp
            label, tip = STAT_LABELS.get(n, (n, ""))
            if label.endswith(" %"):
                label = label[:-2]
                sp.setSuffix(" %")
            lb = QLabel(label)
            lb.setToolTip(tip)
            sp.setToolTip(tip)
            g.addWidget(lb, r, 0)
            g.addWidget(sp, r, 1)
        return g

    def _on_adv(self, on: bool) -> None:
        self.advanced.setText(("Hide" if on else "Show") + " advanced stats (rarely needed)")
        self.advanced.setIcon(icon("settings", 16))
        self._adv_body.setVisible(on)

    def set_stats(self, stats: Stats) -> None:
        for name, sp in self.spins.items():
            sp.blockSignals(True)
            sp.setValue(float(getattr(stats, name)))
            sp.blockSignals(False)

    def stats(self) -> Stats:
        return Stats(**{n: sp.value() for n, sp in self.spins.items()})

    def _edited(self, *_a) -> None:
        self.statsEdited.emit(self.stats())


def cfg_from_settings() -> SimConfig:
    u = load_user()
    return SimConfig(anim_overrides=dict(u.get("anim_overrides") or {}), auto_chain=bool(u.get("auto_chain", True)))


def _confidence_tone(conf: str) -> str:
    return conf if conf in ("confirmed", "estimated", "unknown") else "neutral"


def _clear(layout) -> None:
    while layout.count():
        it = layout.takeAt(0)
        w = it.widget()
        if w is not None:
            w.setParent(None)
            w.deleteLater()
        elif it.layout() is not None:
            _clear(it.layout())


class OptionCard(QFrame):
    """One ranked rotation option: rank medal, big DPS, skill icon strip, confidence. Click to select."""

    clicked = Signal(int)

    def __init__(self, row: int, dps: float, best_dps: float, confidence: str, icons, extra: int, parent=None):
        super().__init__(parent)
        self.row = row
        self.setObjectName("opt")
        self.setCursor(Qt.PointingHandCursor)
        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setProperty("selected", False)
        self.setStyleSheet(
            f"QFrame#opt{{background:{PALETTE['surface']};border:1px solid {PALETTE['border_soft']};border-radius:14px;}}"
            f"QFrame#opt:hover{{border-color:{PALETTE['gold_lo']};}}"
            f"QFrame#opt[selected=\"true\"]{{background:#18203f;border:1px solid {PALETTE['gold']};}}"
        )
        lay = QHBoxLayout(self)
        lay.setContentsMargins(14, 12, 16, 12)
        lay.setSpacing(14)
        medal = QLabel(str(row + 1))
        medal.setFixedSize(32, 32)
        medal.setAlignment(Qt.AlignCenter)
        if row == 0:
            medal.setStyleSheet(
                f"background:{PALETTE['gold']};color:{PALETTE['gold_ink']};border-radius:16px;font-weight:700;font-size:15px;")
        else:
            medal.setStyleSheet(
                f"background:{PALETTE['surface3']};color:{PALETTE['text_dim']};border-radius:16px;font-weight:700;font-size:15px;")
        lay.addWidget(medal, 0, Qt.AlignVCenter)
        num = QVBoxLayout()
        num.setSpacing(0)
        self.dps_label = text_label(f"{dps:,.0f}", "display")
        self.dps_label.setStyleSheet(f"font-size:24px;font-weight:600;color:{PALETTE['gold_hi'] if row == 0 else PALETTE['text']};")
        if row == 0:
            sub = "DPS  -  best option"
        elif best_dps > 0:
            sub = f"DPS  -  {(dps / best_dps - 1) * 100:+.1f}% vs #1"
        else:
            sub = "DPS"
        num.addWidget(self.dps_label)
        num.addWidget(text_label(sub, "caption"))
        lay.addLayout(num)
        strip = QHBoxLayout()
        strip.setSpacing(4)
        for pm, tip in icons:
            lb = QLabel()
            lb.setPixmap(pm)
            lb.setFixedSize(ICON_PX + 4, ICON_PX + 4)
            lb.setAlignment(Qt.AlignCenter)
            lb.setToolTip(tip)
            lb.setStyleSheet(f"background:{PALETTE['surface2']};border:1px solid {PALETTE['border_soft']};border-radius:7px;")
            strip.addWidget(lb)
        if extra > 0:
            strip.addWidget(Chip(f"+{extra}", "neutral"))
        strip.addStretch(1)
        lay.addLayout(strip, 1)
        chip = Chip(confidence.capitalize(), _confidence_tone(confidence))
        chip.setToolTip(f"Confidence of this DPS number: {confidence}")
        lay.addWidget(chip, 0, Qt.AlignVCenter)

    def set_selected(self, on: bool) -> None:
        self.setProperty("selected", bool(on))
        self.style().unpolish(self)
        self.style().polish(self)

    def mousePressEvent(self, e) -> None:
        if e.button() == Qt.LeftButton:
            self.clicked.emit(self.row)
        super().mousePressEvent(e)


class StepRow(QFrame):
    """One cast in the rotation: step number, skill icon, name, optional charge chip."""

    def __init__(self, n: int, pm, name: str, charge: int = 0, parent=None):
        super().__init__(parent)
        self.setObjectName("step")
        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setStyleSheet(
            f"QFrame#step{{background:{PALETTE['surface2']};border:1px solid {PALETTE['border_soft']};border-radius:10px;}}")
        lay = QHBoxLayout(self)
        lay.setContentsMargins(10, 6, 10, 6)
        lay.setSpacing(10)
        num = QLabel(str(n))
        num.setFixedWidth(20)
        num.setAlignment(Qt.AlignCenter)
        num.setStyleSheet(f"color:{PALETTE['gold']};font-weight:700;font-size:14px;background:transparent;")
        lay.addWidget(num)
        ic = QLabel()
        ic.setPixmap(pm)
        ic.setFixedSize(ICON_PX + 4, ICON_PX + 4)
        ic.setAlignment(Qt.AlignCenter)
        ic.setStyleSheet("background:transparent;")
        lay.addWidget(ic)
        nm = QLabel(name)
        nm.setStyleSheet("background:transparent;font-weight:500;")
        nm.setSizePolicy(QSizePolicy.Ignored, QSizePolicy.Preferred)
        nm.setMinimumWidth(40)
        lay.addWidget(nm, 1)
        if charge:
            lay.addWidget(Chip(f"charge L{charge}", "info"))


class BulletList(QWidget):
    """Wrapped one-line-per-item list with a small leading icon (differences, warnings)."""

    def __init__(self, icon_name: str, color: str, empty_text: str, parent=None):
        super().__init__(parent)
        self._icon, self._color, self._empty = icon_name, color, empty_text
        self._lay = QVBoxLayout(self)
        self._lay.setContentsMargins(0, 0, 0, 0)
        self._lay.setSpacing(8)
        self.items: list[str] = []
        self.set_items([])

    def set_items(self, items: list[str]) -> None:
        self.items = list(items)
        _clear(self._lay)
        if not items:
            self._lay.addWidget(text_label(self._empty, "dim", wrap=True))
            return
        for t in items:
            row = QHBoxLayout()
            row.setSpacing(10)
            ic = QLabel()
            ic.setPixmap(line_icon(self._icon, 16, self._color))
            ic.setFixedSize(18, 18)
            row.addWidget(ic, 0, Qt.AlignTop)
            lb = text_label(t, "", wrap=True)
            lb.setSizePolicy(QSizePolicy.Ignored, QSizePolicy.Preferred)
            row.addWidget(lb, 1)
            self._lay.addLayout(row)

    def count(self) -> int:
        return len(self.items)


class BuildScreen(LiveBound, QWidget):
    def __init__(self, state: AppState, gd: GameData, engine: EngineFacade, parent=None):
        super().__init__(parent)
        self.state, self.gd, self.engine = state, gd, engine
        self._pinned: tuple[CharacterBuild, dict[str, float]] | None = None
        self._result = None
        self._building = False
        self._shown: list = []
        self._sel = 0
        self.option_cards: list[OptionCard] = []
        self.rotation_names: list[str] = []
        self._build_ui()
        state.buildChanged.connect(self.refresh)
        self._gd_shown = gd
        state.dataChanged.connect(self._on_data)
        state.resultsReady.connect(self.show_results)
        self.refresh()
        cur = state.current_result()
        if cur is not None:
            self.show_results(cur)

    def _on_data(self, *_args) -> None:
        """New GameData object (class switch / reload): drop results and pins of the old data, rebuild the tables."""
        gd = self._gd()
        if gd is not self._gd_shown:
            self._gd_shown = gd
            self._result, self._pinned, self._shown = None, None, []
            self._show_empty_results()
            self.compare_table.setRowCount(0)
            self.compare_table.setVisible(False)
            self._rank_sig = self._stig_sig = self._calib_sig = None
        self.refresh()

    def _gd(self) -> GameData:
        return self.state.gamedata()

    # ---- layout ----
    def _build_ui(self) -> None:
        # header: title + hint on the left, live summary pills on the right
        head = QHBoxLayout()
        head.setSpacing(10)
        titles = QVBoxLayout()
        titles.setSpacing(2)
        titles.addWidget(text_label("Build planner", "display"))
        self.hint = text_label(
            "Enter the numbers from your in-game character sheet (C). Results update automatically.", "dim", wrap=True)
        titles.addWidget(self.hint)
        head.addLayout(titles, 1)
        self.pill_level = StatPill("Level", "-", "gold")
        self.pill_scenario = StatPill("Scenario", "-", "info")
        self.pill_dps = StatPill("Best DPS", "-", "neutral")
        for p in (self.pill_level, self.pill_scenario, self.pill_dps):
            head.addWidget(p, 0, Qt.AlignTop)
        self.banner = Banner("warn", "")
        self.banner.setVisible(False)

        # ---- left column: inputs ----
        self.level = QSpinBox()
        self.scenario = QComboBox()
        for s in SCENARIOS:
            self.scenario.addItem(s.name, s.key)
        self.auto_chain = QCheckBox("Auto-chain in macro")
        self.skill_points = QSpinBox()
        self.stigma_points = QSpinBox()
        for sp in (self.skill_points, self.stigma_points):
            sp.setRange(NO_BUDGET, 9999)
            sp.setSpecialValueText("no budget")
        self.points_label = text_label("", "dim", wrap=True)
        self.auto_spend = PrimaryButton("Auto-spend points")
        self.auto_spend.setToolTip("Spend your skill points where they add the most DPS (needs optimizer results).")
        char = Card("Character & budget", "Level, scenario and how many points you can spend.")
        grid = QGridLayout()
        grid.setHorizontalSpacing(12)
        grid.setVerticalSpacing(8)
        grid.setColumnStretch(1, 1)
        for r, (lab, w) in enumerate((("Level", self.level), ("Scenario", self.scenario),
                                      ("Skill points", self.skill_points), ("Stigma points", self.stigma_points))):
            grid.addWidget(QLabel(lab), r, 0)
            grid.addWidget(w, r, 1)
        char.body.addLayout(grid)
        char.add(self.auto_chain)
        char.add(divider())
        spend = QHBoxLayout()
        spend.setSpacing(12)
        spend.addWidget(self.points_label, 1)
        spend.addWidget(self.auto_spend, 0, Qt.AlignTop)
        char.body.addLayout(spend)

        self.stats_form = StatsForm()
        stats_card = Card("Stats", "From the character sheet. Percent fields are entered as plain numbers.")
        stats_card.add(self.stats_form)

        self.ranks = QTableWidget(0, 2)
        self.ranks.setHorizontalHeaderLabels(["Skill", "Rank"])
        self.ranks.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.ranks.setSelectionMode(QAbstractItemView.SelectionMode.NoSelection)
        self.ranks.setAlternatingRowColors(True)
        self.ranks.verticalHeader().setVisible(False)
        self.ranks.verticalHeader().setDefaultSectionSize(46)
        self.ranks.setIconSize(QSize(ICON_PX, ICON_PX))
        self.ranks.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self.ranks.horizontalHeader().setSectionResizeMode(1, QHeaderView.Fixed)
        self.ranks.setColumnWidth(1, 130)
        self.ranks.setVerticalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        ranks_card = Card("Skill ranks", "Rank of each skill you have learned.")
        ranks_card.add(self.ranks)

        self.stigmas = QListWidget()
        self.stigmas.setIconSize(QSize(ICON_PX, ICON_PX))
        self.stigmas.setAlternatingRowColors(True)
        self.stig_hint = text_label("", "caption", wrap=True)
        stig_card = Card("Stigmas", "Tick the stigmas you have equipped (limited by your slots).")
        stig_card.add(self.stigmas)
        stig_card.add(self.stig_hint)

        left = QVBoxLayout()
        left.setSpacing(16)
        for c in (char, stats_card, ranks_card, stig_card):
            left.addWidget(c)
        left.addStretch(1)

        # ---- right column: outputs ----
        self.options_box = QVBoxLayout()
        self.options_box.setSpacing(10)
        self.rot_card = Card("Cast order", "Top to bottom, then repeat. Select an option above to change it.")
        self.rot_grid = QGridLayout()
        self.rot_grid.setHorizontalSpacing(10)
        self.rot_grid.setVerticalSpacing(8)
        self.rot_grid.setColumnStretch(0, 1)
        self.rot_grid.setColumnStretch(1, 1)
        self.rot_card.body.addLayout(self.rot_grid)
        self.rot_card.add(divider())
        self.rot_card.add(group_caption("Why this order"))
        self.explanation = text_label("", "dim", wrap=True)
        self.explanation.setTextInteractionFlags(Qt.TextSelectableByMouse)
        self.rot_card.add(self.explanation)

        self.diff_card = Card("Where this differs from community rotations", collapsible=True)
        self.disagreements = BulletList("info", PALETTE["cyan"], "No differences from the community rotations we know of.")
        self.diff_card.add(self.disagreements)
        self.warn_card = Card("Warnings", collapsible=True)
        self.warnings = BulletList("warn", PALETTE["warn"], "No warnings for the selected option.")
        self.warn_card.add(self.warnings)
        self.warn_card.set_expanded(False)

        self.compare_btn = QPushButton("Compare")
        self.compare_btn.setIcon(icon("list", 16))
        self.clear_pin_btn = GhostButton("Clear pin")
        self.compare_label = text_label("Compare: press Compare to pin the current build as A.", "dim", wrap=True)
        self.compare_table = QTableWidget(0, 4)
        self.compare_table.setHorizontalHeaderLabels(["Scenario", "A DPS", "B DPS", "B vs A"])
        self.compare_table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.compare_table.setAlternatingRowColors(True)
        self.compare_table.verticalHeader().setVisible(False)
        self.compare_table.horizontalHeader().setStretchLastSection(True)
        self.compare_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self.compare_table.setVisible(False)
        cmp_card = Card("Compare two builds", "Pin the current build as A, change something, then compare as B.")
        cmp_row = QHBoxLayout()
        cmp_row.setSpacing(8)
        cmp_row.addWidget(self.compare_btn)
        cmp_row.addWidget(self.clear_pin_btn)
        cmp_row.addStretch(1)
        cmp_card.body.addLayout(cmp_row)
        cmp_card.add(self.compare_label)
        cmp_card.add(self.compare_table)

        self.calib = QTableWidget(0, 3)
        self.calib.setHorizontalHeaderLabels(["Skill", "Default s", "Measured s (edit)"])
        self.calib.setAlternatingRowColors(True)
        self.calib.verticalHeader().setVisible(False)
        self.calib.verticalHeader().setDefaultSectionSize(40)
        self.calib.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self.calib.horizontalHeader().setSectionResizeMode(1, QHeaderView.Fixed)
        self.calib.horizontalHeader().setSectionResizeMode(2, QHeaderView.Fixed)
        self.calib.setColumnWidth(1, 110)
        self.calib.setColumnWidth(2, 170)
        calib_card = Card("Calibrate animation lock", "After launch: time one cast of each skill and type the seconds "
                          "(per cast) in the last column. Clear a cell to go back to the default.")
        calib_card.add(self.calib)

        right = QVBoxLayout()
        right.setSpacing(16)
        right.addWidget(SectionHeader("Best rotations", "ranked by DPS, click one to see its cast order"))
        right.addLayout(self.options_box)
        for c in (self.rot_card, self.diff_card, self.warn_card, cmp_card, calib_card):
            right.addWidget(c)
        right.addStretch(1)

        page = QWidget()
        page.setObjectName("Root")
        cols = QHBoxLayout()
        cols.setSpacing(20)
        cols.addLayout(left, 1)
        cols.addLayout(right, 1)
        pl = QVBoxLayout(page)
        pl.setContentsMargins(24, 20, 24, 24)
        pl.setSpacing(14)
        pl.addLayout(head)
        pl.addWidget(self.banner)
        pl.addLayout(cols, 1)
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setFrameShape(QFrame.NoFrame)
        self.scroll.setWidget(page)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(self.scroll)
        self._show_empty_results()

        self.level.valueChanged.connect(self._on_level)
        self.scenario.currentIndexChanged.connect(self._on_scenario)
        self.auto_chain.toggled.connect(self._on_auto_chain)
        self.skill_points.valueChanged.connect(self._on_points)
        self.stigma_points.valueChanged.connect(self._on_points)
        self.stigmas.itemChanged.connect(self._on_stigma)
        self.stats_form.statsEdited.connect(self._on_stats)
        self.auto_spend.clicked.connect(self.run_auto_spend)
        self.compare_btn.clicked.connect(self.compare)
        self.clear_pin_btn.clicked.connect(self.clear_pin)
        self.calib.itemChanged.connect(self._on_calib_edit)

    def _show_empty_results(self) -> None:
        _clear(self.options_box)
        self.option_cards = []
        self.options_box.addWidget(self._empty_card())
        _clear(self.rot_grid)
        self.rotation_names = []
        self.explanation.setText("")
        self.disagreements.set_items([])
        self.diff_card.set_expanded(True)
        self.warnings.set_items([])
        self.warn_card.title_label.setText("Warnings")
        self.pill_dps.set_value("-", "neutral")

    @staticmethod
    def _empty_card() -> QWidget:
        from aion2c.ui.widgets import EmptyState

        c = Card()
        c.add(EmptyState("bolt", "No results yet. They appear here a moment after you enter your stats."))
        return c

    # ---- refresh from state ----
    def refresh(self, *_args) -> None:
        self._building = True
        try:
            gd, b = self._gd(), self.state.build()
            self.level.setRange(1, gd.level_caps[b.region])
            self.level.setValue(b.level)
            i = self.scenario.findData(self.state.scenario().key)
            if i >= 0:
                self.scenario.setCurrentIndex(i)
            self.auto_chain.setChecked(bool(load_user().get("auto_chain", True)))
            self.skill_points.setValue(NO_BUDGET if b.skill_points is None else b.skill_points)
            self.stigma_points.setValue(NO_BUDGET if b.stigma_points is None else b.stigma_points)
            self._fill_ranks(gd, b)
            self._fill_stigmas(gd, b)
            self.stats_form.set_stats(b.stats)
            self._fill_calibrate(gd, b)
            self._update_points_label(gd, b)
            est, unk = count_confidence(castable_skills(gd, b.region, b.show_kr))
            self.banner.setVisible(bool(est or unk))
            self.banner.set_text(
                f"{est} values estimated, {unk} unknown. Time your casts in the Calibrate section to firm them up.")
            self.pill_level.set_value(str(b.level))
            self.pill_scenario.set_value(self.state.scenario().name)
        finally:
            self._building = False

    def _fill_ranks(self, gd: GameData, b: CharacterBuild) -> None:
        skills = castable_skills(gd, b.region, b.show_kr)
        sig = tuple((s.key, rank_cap(gd, b.region, s)) for s in skills)
        if sig != getattr(self, "_rank_sig", None):
            self._rank_sig = sig
            self._rank_spins: dict[str, QSpinBox] = {}
            self.ranks.setRowCount(len(skills))
            for row, s in enumerate(skills):
                it = make_item(s.name)
                it.setIcon(skill_icon(gd, s.key))
                self.ranks.setItem(row, 0, it)
                sp = QSpinBox()
                sp.setRange(1, rank_cap(gd, b.region, s))
                sp.valueChanged.connect(lambda v, k=s.key: self._on_rank(k, v))
                holder = QWidget()
                hl = QHBoxLayout(holder)
                hl.setContentsMargins(8, 4, 8, 4)
                hl.addWidget(sp)
                self.ranks.setCellWidget(row, 1, holder)
                self._rank_spins[s.key] = sp
            fit_height(self.ranks, len(skills), 46)
        for k, sp in self._rank_spins.items():
            sp.setValue(max(sp.minimum(), min(sp.maximum(), b.skill_ranks.get(k, 1))))

    def _fill_stigmas(self, gd: GameData, b: CharacterBuild) -> None:
        stig = [s for s in castable_skills(gd, b.region, b.show_kr) if s.kind == SkillKind.STIGMA]
        keys = tuple(s.key for s in stig)
        if keys != getattr(self, "_stig_sig", None):
            self._stig_sig = keys
            self.stigmas.clear()
            self.stig_hint.setText("" if stig else "This class has no stigmas in the data yet.")
            for s in stig:
                it = QListWidgetItem(skill_icon(gd, s.key), s.name)
                it.setData(Qt.ItemDataRole.UserRole, s.key)
                it.setFlags(it.flags() | Qt.ItemFlag.ItemIsUserCheckable)
                self.stigmas.addItem(it)
            fit_height(self.stigmas, len(stig), 44, 6)
        for i in range(self.stigmas.count()):
            it = self.stigmas.item(i)
            on = it.data(Qt.ItemDataRole.UserRole) in b.stigmas
            it.setCheckState(Qt.CheckState.Checked if on else Qt.CheckState.Unchecked)

    def _fill_calibrate(self, gd: GameData, b: CharacterBuild) -> None:
        skills = [s for s in castable_skills(gd, b.region, b.show_kr) if s.kind != SkillKind.PASSIVE]
        keys = tuple(s.key for s in skills)
        over = load_user().get("anim_overrides") or {}
        if keys != getattr(self, "_calib_sig", None):
            self._calib_sig = keys
            self.calib.setRowCount(len(skills))
            for row, s in enumerate(skills):
                n0 = make_item(s.name)
                n0.setData(Qt.ItemDataRole.UserRole, s.key)
                self.calib.setItem(row, 0, n0)
                self.calib.setItem(row, 1, num_item(s.anim_lock_s))
                self.calib.setItem(row, 2, make_item("", editable=True))
            fit_height(self.calib, len(skills), 40)
        for row, k in enumerate(keys):
            self.calib.item(row, 2).setText("" if k not in over else f"{float(over[k]):g}")

    def _update_points_label(self, gd: GameData, b: CharacterBuild) -> None:
        spent = 0
        for s in castable_skills(gd, b.region, b.show_kr):
            if s.kind != SkillKind.STIGMA:
                spent += sum(SKILL_POINT_COST[1 : max(1, min(b.skill_ranks.get(s.key, 1), len(SKILL_POINT_COST)))])
        text = f"Core skill points spent (ranks 2-10, estimated): {spent}"
        if b.skill_points is not None and spent > b.skill_points:
            text += " - OVER BUDGET"
        self.points_label.setText(text + (("\n" + self._spend_log) if getattr(self, "_spend_log", "") else ""))

    # ---- edits (all go through state.set_build) ----
    def _edit(self, **changes) -> None:
        if not self._building:
            self.state.set_build(replace(self.state.build(), **changes))

    def _on_level(self, v: int) -> None:
        self._edit(level=int(v))

    def _on_scenario(self, _i: int) -> None:
        if not self._building:
            self.state.set_scenario(self.scenario.currentData())

    def _on_rank(self, key: str, v: int) -> None:
        if not self._building:
            ranks = dict(self.state.build().skill_ranks)
            ranks[key] = int(v)
            self._edit(skill_ranks=ranks)

    def _on_points(self, _v: int) -> None:
        sp, st = self.skill_points.value(), self.stigma_points.value()
        self._edit(skill_points=None if sp == NO_BUDGET else sp, stigma_points=None if st == NO_BUDGET else st)

    def _on_stigma(self, item: QListWidgetItem) -> None:
        if self._building:
            return
        b = self.state.build()
        slots = self._gd().stigma_slots[b.region]
        chosen = tuple(
            self.stigmas.item(i).data(Qt.ItemDataRole.UserRole)
            for i in range(self.stigmas.count())
            if self.stigmas.item(i).checkState() == Qt.CheckState.Checked
        )
        if len(chosen) > slots:
            self._building = True
            item.setCheckState(Qt.CheckState.Unchecked)
            self._building = False
            return
        self._edit(stigmas=chosen)

    def _on_stats(self, stats: Stats) -> None:
        self._edit(stats=stats)

    def _on_auto_chain(self, on: bool) -> None:
        if self._building:
            return
        u = load_user()
        u["auto_chain"] = bool(on)
        save_user(u)
        self.state.set_gamedata(self.state.gamedata())

    def run_auto_spend(self) -> None:
        pr = self.state.best_priority()
        b = self.state.build()
        if pr is None:
            self._spend_log = "Auto-spend needs optimizer results first."
            self._update_points_label(self._gd(), b)
            return
        QApplication.setOverrideCursor(Qt.CursorShape.WaitCursor)
        try:
            ranks, log = budget_mod.allocate_points(self._gd(), b, pr, self.state.scenario(), cfg_from_settings())
        except Exception as e:  # engine still being built or bad data: report, don't crash the UI
            self._spend_log = f"Auto-spend failed: {e}"
            self._update_points_label(self._gd(), b)
            return
        finally:
            QApplication.restoreOverrideCursor()
        self._spend_log = "; ".join(f"{skill_name(self._gd(), k)} -> {r} (+{g:.1f}%)" for k, r, g in log[:8])
        self.state.set_build(replace(b, skill_ranks=dict(ranks)))

    # ---- calibrate ----
    def _on_calib_edit(self, item) -> None:
        if self._building or item.column() != 2:
            return
        key = self.calib.item(item.row(), 0).data(Qt.ItemDataRole.UserRole)
        text = item.text().strip()
        if not text:
            self.set_anim_override(key, None)
            return
        try:
            secs = float(text)
            if not secs > 0:
                raise ValueError(text)
        except ValueError:
            self.refresh()  # revert the cell to the saved value
            return
        self.set_anim_override(key, secs)

    def set_anim_override(self, key: str, seconds: float | None) -> None:
        u = load_user()
        d = dict(u.get("anim_overrides") or {})
        if seconds is None:
            d.pop(key, None)
        else:
            d[key] = float(seconds)
        u["anim_overrides"] = d
        save_user(u)
        self.state.set_gamedata(self.state.gamedata())  # -> dataChanged -> engine.set_config + re-run

    # ---- results ----
    @staticmethod
    def _shown_options(opts) -> list:
        """#1 always, then only options whose DPS differs >= 0.5% from the previously shown one; max 3."""
        shown: list = []
        for o in opts:
            if not shown:
                shown.append(o)
            elif len(shown) < MAX_SHOWN_OPTIONS:
                prev = shown[-1].result.dps
                if prev <= 0 or abs(o.result.dps - prev) / prev * 100 >= MIN_DPS_GAP_PCT:
                    shown.append(o)
        return shown

    def show_results(self, result) -> None:
        self._result = result
        gd = self._gd()
        self._shown = self._shown_options(result.options)
        _clear(self.options_box)
        self.option_cards = []
        if not self._shown:
            self.options_box.addWidget(self._empty_card())
        best = self._shown[0].result.dps if self._shown else 0.0
        for row, o in enumerate(self._shown):
            entries = list(o.priority.entries)
            icons = [(skill_icon(gd, e.skill_key, ICON_PX).pixmap(ICON_PX, ICON_PX), self._entry_name(gd, e))
                     for e in entries[:MAX_CARD_ICONS]]
            card = OptionCard(row, o.result.dps, best, o.result.confidence, icons, max(0, len(entries) - MAX_CARD_ICONS))
            card.clicked.connect(self.select_option)
            self.options_box.addWidget(card)
            self.option_cards.append(card)
        if self._shown:
            top = self._shown[0].result
            self.pill_dps.set_value(f"{top.dps:,.0f}", _confidence_tone(top.confidence))
        else:
            self.pill_dps.set_value("-", "neutral")
        diffs = [d.text or f"{d.community_key}: {skill_name(gd, d.skill_key)}" for d in result.disagreements]
        self.disagreements.set_items(diffs)
        self.diff_card.title_label.setText(
            f"Where this differs from community rotations ({len(diffs)})" if diffs else "Where this differs from community rotations")
        self.diff_card.set_expanded(len(diffs) <= 3)  # long lists start collapsed; the title carries the count
        warns = list(dict.fromkeys(result.options[0].result.warnings)) if result.options else []
        self.warnings.set_items(warns)
        n = len(warns)
        self.warn_card.title_label.setText(f"Warnings ({n})" if n else "Warnings (none)")
        self.select_option(0)

    @staticmethod
    def _entry_name(gd, e) -> str:
        return skill_name(gd, e.skill_key) + (f" (charge L{e.charge_level})" if e.charge_level else "")

    def select_option(self, row: int) -> None:
        """Highlight option `row` and show its cast order and explanation."""
        self._sel = row
        for i, c in enumerate(self.option_cards):
            c.set_selected(i == row)
        self._on_result_row()

    def _on_result_row(self) -> None:
        _clear(self.rot_grid)
        self.rotation_names = []
        shown = self._shown if self._result else []
        if not shown or self._sel >= len(shown):
            self.explanation.setText("")
            return
        gd, o = self._gd(), shown[self._sel]
        entries = list(o.priority.entries)
        half = (len(entries) + 1) // 2  # two columns, read down the left then down the right
        for i, e in enumerate(entries):
            name = skill_name(gd, e.skill_key)
            self.rotation_names.append(f"{i + 1}. {self._entry_name(gd, e)}")
            pm = skill_icon(gd, e.skill_key, ICON_PX).pixmap(ICON_PX, ICON_PX)
            col, r = divmod(i, half) if len(entries) > 4 else (0, i)
            self.rot_grid.addWidget(StepRow(i + 1, pm, name, e.charge_level or 0), r, col)
        self.explanation.setText(o.explanation or "No explanation for this option.")

    # ---- compare ----
    def _dps_by_scenario(self, build: CharacterBuild) -> dict[str, float]:
        out: dict[str, float] = {}
        for s in SCENARIOS:
            r = self.engine.optimize(build, s)
            out[s.key] = r.options[0].result.dps if r.options else 0.0
        return out

    def compare(self) -> None:
        QApplication.setOverrideCursor(Qt.CursorShape.WaitCursor)
        try:
            cur = self.state.build()
            if self._pinned is None:
                self._pinned = (cur, self._dps_by_scenario(cur))
                self.compare_label.setText(f"Pinned A = {cur.name}. Change the build, then press Compare for B.")
                return
            a_build, a = self._pinned
            b = self._dps_by_scenario(cur)
        finally:
            QApplication.restoreOverrideCursor()
        self.compare_table.setRowCount(len(SCENARIOS))
        for row, s in enumerate(SCENARIOS):
            delta = (b[s.key] / a[s.key] - 1) * 100 if a[s.key] else 0.0
            for col, txt in enumerate((s.name, f"{a[s.key]:,.0f}", f"{b[s.key]:,.0f}", f"{delta:+.1f}%")):
                it = make_item(txt)
                if col == 3 and abs(delta) >= 0.05:
                    it.setForeground(QColor(PALETTE["ok"] if delta > 0 else PALETTE["error"]))
                if col:
                    it.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
                self.compare_table.setItem(row, col, it)
        fit_height(self.compare_table, len(SCENARIOS), 40, 8)
        self.compare_table.setVisible(True)
        self.compare_label.setText(f"A = {a_build.name} vs B = {cur.name}")

    def clear_pin(self) -> None:
        self._pinned = None
        self.compare_table.setRowCount(0)
        self.compare_table.setVisible(False)
        self.compare_label.setText("Compare: press Compare to pin the current build as A.")
