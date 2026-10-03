"""Crafting screen (P9): recipe list, detail, add-to-list, aggregated shopping checklist.

Persistence goes straight to settings (`craft_list` {str(recipe_id): qty}, `craft_checks` [item names]).
Layout: recipes (search + filters) | recipe detail with material tables | shopping checklist with progress.
The recipe book is shared by all classes; only the Sorcerer-relevance filter is class-specific.
"""
from PySide6.QtCore import QSize, Qt
from PySide6.QtGui import QColor, QGuiApplication, QIcon, QPainter, QPen, QPixmap
from PySide6.QtWidgets import (
    QAbstractItemView,
    QCheckBox,
    QComboBox,
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QProgressBar,
    QScrollArea,
    QSpinBox,
    QStackedWidget,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

import aion2c.crafting as crafting
import aion2c.settings as settings
from aion2c.interfaces import EngineFacade
from aion2c.models import GameData
from aion2c.state import AppState
from aion2c.ui import widgets as W
from aion2c.ui.live import LiveBound
from aion2c.ui.theme import ASSETS, PALETTE, class_color, rarity_color

CHECK_QSS = (
    f"QListWidget::indicator{{width:18px;height:18px;border:1px solid {PALETTE['border']};border-radius:5px;"
    f"background:{PALETTE['surface']};}}"
    f"QListWidget::indicator:hover{{border-color:{PALETTE['gold']};}}"
    f"QListWidget::indicator:checked{{background:{PALETTE['gold']};border-color:{PALETTE['gold_lo']};"
    f"image:url({(ASSETS / 'check.svg').as_posix()});}}"
)
GRADE_TONE = {"Common": "neutral", "Rare": "ok", "Epic": "info", "Unique": "warn", "Heroic": "gold"}
_TILES: dict[tuple, QPixmap] = {}


def prof_name(profession: str) -> str:
    """'Armorsmithing (aion2hub label: Tailoring)' -> 'Armorsmithing'."""
    return profession.split(" (")[0].strip()


def grade_color(grade: str | None) -> QColor:
    if (grade or "").title() == "Heroic":  # above Unique; reuse the assassin violet token so it stands apart
        return class_color("assassin")
    return rarity_color(grade)


def recipe_tile(grade: str | None, size: int) -> QPixmap:
    """Rounded dark tile with a grade-coloured bezel and a crafting glyph (recipes have no item art yet)."""
    key = (grade, size)
    hit = _TILES.get(key)
    if hit is not None:
        return hit
    dpr = 2
    pm = QPixmap(size * dpr, size * dpr)
    pm.setDevicePixelRatio(dpr)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    p.setRenderHints(QPainter.RenderHint.Antialiasing)
    col = grade_color(grade)
    rad = max(7, size // 5)
    p.setPen(Qt.PenStyle.NoPen)
    p.setBrush(QColor(PALETTE["surface2"]))
    p.drawRoundedRect(1, 1, size - 2, size - 2, rad, rad)
    glyph = int(size * 0.52)
    p.drawPixmap((size - glyph) // 2, (size - glyph) // 2, glyph, glyph, W.line_icon("crafting", glyph, col, dpr=dpr))
    glow = QColor(col)
    glow.setAlpha(55)
    p.setPen(QPen(glow, 3))
    p.setBrush(Qt.BrushStyle.NoBrush)
    p.drawRoundedRect(2, 2, size - 4, size - 4, rad, rad)
    p.setPen(QPen(col, 1.5))
    p.drawRoundedRect(2, 2, size - 4, size - 4, rad, rad)
    p.end()
    _TILES[key] = pm
    return pm


def _panel() -> QFrame:
    """Card look without the drop shadow (these panels hold scrolling lists)."""
    f = QFrame()
    f.setProperty("card", True)
    f.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
    return f


def _clear(lay) -> None:
    while lay.count():
        it = lay.takeAt(0)
        w = it.widget()
        if w is not None:
            w.hide()
            w.setParent(None)
            w.deleteLater()
        elif it.layout() is not None:
            _clear(it.layout())


def _mat_table(rows: list[tuple[int, str]]) -> QTableWidget:
    """Static two-column material table (qty, item) sized to its rows so the detail pane scrolls instead."""
    t = QTableWidget(len(rows), 2)
    t.horizontalHeader().setVisible(False)
    t.verticalHeader().setVisible(False)
    t.verticalHeader().setDefaultSectionSize(32)
    t.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
    t.setSelectionMode(QAbstractItemView.SelectionMode.NoSelection)
    t.setFocusPolicy(Qt.FocusPolicy.NoFocus)
    t.setAlternatingRowColors(True)
    t.setShowGrid(False)
    t.setFrameShape(QFrame.Shape.NoFrame)
    t.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
    t.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
    t.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Fixed)
    t.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
    t.setColumnWidth(0, 72)
    for i, (qty, item) in enumerate(rows):
        q = QTableWidgetItem(f"{qty} x")
        q.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        q.setForeground(QColor(PALETTE["gold_hi"]))
        t.setItem(i, 0, q)
        t.setItem(i, 1, QTableWidgetItem(item))
    t.setFixedHeight(32 * max(1, len(rows)) + 4)
    return t


class CraftingView(LiveBound, QWidget):
    def __init__(self, state: AppState, gd: GameData, engine: EngineFacade, parent=None):
        super().__init__(parent)
        self.state, self.gd, self.engine = state, gd, engine
        user = settings.load_user()
        self._list: dict[int, int] = {int(k): int(v) for k, v in (user.get("craft_list") or {}).items()}
        self._checks: set[str] = set(user.get("craft_checks") or [])
        self._shown: list = []

        self.filter_box = QCheckBox("Sorcerer only")  # recipe relevance is only researched for the Sorcerer
        self.filter_box.setChecked(True)
        self.search_edit = QLineEdit()
        self.search_edit.setPlaceholderText("Search recipes")
        self.search_edit.setClearButtonEnabled(True)
        self.search_edit.setMinimumHeight(34)
        self.prof_box = QComboBox()
        self.prof_box.setMinimumHeight(34)
        self.recipe_list = QListWidget()
        self.qty = QSpinBox()
        self.qty.setRange(1, 9999)
        self.qty.setMinimumHeight(34)
        self.add_btn = W.PrimaryButton("Add to list")
        self.remove_btn = W.GhostButton("Remove from list")
        self.expand_box = QCheckBox("Expand to base materials")
        self.expand_box.setChecked(True)
        self.shop = QListWidget()
        self.copy_btn = W.GhostButton("Copy list")
        self.clear_btn = W.GhostButton("Clear list")
        self.progress = QProgressBar()
        self.progress.setTextVisible(True)

        outer = QVBoxLayout(self)
        outer.setContentsMargins(20, 14, 20, 16)
        outer.setSpacing(12)
        head = QHBoxLayout()
        head.setSpacing(12)
        head.addWidget(W.text_label("Crafting", "title"))
        self.hint = W.text_label("Pick a recipe, set the quantity, press Add. The shopping list totals raw materials.",
                                 "dim")
        head.addWidget(self.hint, 1)
        outer.addLayout(head)
        cols = QHBoxLayout()
        cols.setSpacing(16)
        cols.addWidget(self._recipes_panel(), 5)
        cols.addWidget(self._detail_panel(), 6)
        cols.addWidget(self._shop_panel(), 5)
        outer.addLayout(cols, 1)

        self.filter_box.toggled.connect(self.refresh_recipes)
        self.prof_box.currentIndexChanged.connect(self.refresh_recipes)
        self.search_edit.textChanged.connect(self.refresh_recipes)
        self.recipe_list.currentRowChanged.connect(self._show_detail)
        self.add_btn.clicked.connect(self.add_selected)
        self.remove_btn.clicked.connect(self.remove_selected)
        self.expand_box.toggled.connect(self.refresh_shopping)
        self.shop.itemChanged.connect(self._on_check)
        self.copy_btn.clicked.connect(self.copy_list)
        self.clear_btn.clicked.connect(self.clear_list)

        state.dataChanged.connect(self._on_data)
        self._on_data()
        self.refresh_shopping()

    # ---- construction ----
    def _recipes_panel(self) -> QWidget:
        p = _panel()
        v = QVBoxLayout(p)
        v.setContentsMargins(16, 14, 16, 12)
        v.setSpacing(10)
        top = QHBoxLayout()
        top.addWidget(W.text_label("Recipes", "title"))
        top.addStretch(1)
        self.count_label = W.text_label("", "caption")
        top.addWidget(self.count_label)
        v.addLayout(top)
        v.addWidget(self.search_edit)
        row = QHBoxLayout()
        row.setSpacing(10)
        row.addWidget(self.prof_box, 1)
        row.addWidget(self.filter_box)
        v.addLayout(row)
        self.recipe_list.setIconSize(QSize(40, 40))
        self.recipe_list.setVerticalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        self.recipe_list.setStyleSheet(
            "QListWidget{background:transparent;border:none;outline:0;}"
            "QListWidget::item{padding:6px 8px;margin:2px 0;border-radius:10px;border:1px solid transparent;}"
            f"QListWidget::item:hover{{background:{PALETTE['surface2']};}}"
            f"QListWidget::item:selected{{background:#2a2d44;color:{PALETTE['gold_hi']};"
            f"border:1px solid {PALETTE['gold']};}}")
        self.recipes_empty = W.EmptyState("search", "No recipes match. Clear the search or the filters.")
        self.recipe_stack = QStackedWidget()
        self.recipe_stack.addWidget(self.recipe_list)
        self.recipe_stack.addWidget(self.recipes_empty)
        v.addWidget(self.recipe_stack, 1)
        return p

    def _detail_panel(self) -> QWidget:
        p = _panel()
        v = QVBoxLayout(p)
        v.setContentsMargins(2, 2, 2, 14)
        v.setSpacing(8)
        sc = QScrollArea()
        sc.setWidgetResizable(True)
        sc.setFrameShape(QFrame.Shape.NoFrame)
        sc.setStyleSheet("QScrollArea{background:transparent;border:none;}"
                         "QScrollArea>QWidget>QWidget{background:transparent;}")
        body = QWidget()
        sc.setWidget(body)
        self.dv = QVBoxLayout(body)
        self.dv.setContentsMargins(16, 14, 16, 8)
        self.dv.setSpacing(10)
        v.addWidget(sc, 1)

        top = QHBoxLayout()
        top.setSpacing(14)
        self.big_tile = QLabel()
        self.big_tile.setFixedSize(68, 68)
        top.addWidget(self.big_tile, 0, Qt.AlignmentFlag.AlignTop)
        tv = QVBoxLayout()
        tv.setSpacing(5)
        self.d_name = W.text_label("", "title", wrap=True)
        self.d_makes = W.text_label("", "dim", wrap=True)
        self.d_chips = QHBoxLayout()
        self.d_chips.setSpacing(6)
        tv.addWidget(self.d_name)
        tv.addWidget(self.d_makes)
        tv.addLayout(self.d_chips)
        tv.addStretch(1)
        top.addLayout(tv, 1)
        self.dv.addLayout(top)
        self.d_sections = QVBoxLayout()
        self.d_sections.setSpacing(6)
        self.dv.addLayout(self.d_sections)
        self.dv.addStretch(1)
        self.detail_empty = W.EmptyState("crafting", "Pick a recipe on the left to see what it needs.")
        self.dv.addWidget(self.detail_empty)
        self.note = W.text_label("Item stats are not known yet for any recipe (not researched).", "caption", wrap=True)
        self.dv.addWidget(self.note)

        bar = QHBoxLayout()
        bar.setContentsMargins(16, 0, 16, 0)
        bar.setSpacing(8)
        bar.addWidget(W.text_label("Qty", "dim"))
        bar.addWidget(self.qty)
        bar.addWidget(self.add_btn, 1)
        bar.addWidget(self.remove_btn)
        v.addLayout(bar)
        return p

    def _shop_panel(self) -> QWidget:
        p = _panel()
        v = QVBoxLayout(p)
        v.setContentsMargins(16, 14, 16, 14)
        v.setSpacing(10)
        top = QHBoxLayout()
        top.addWidget(W.text_label("Shopping list", "title"))
        top.addStretch(1)
        self.shop_count = W.text_label("", "caption")
        top.addWidget(self.shop_count)
        v.addLayout(top)
        v.addWidget(self.expand_box)
        self.progress_label = W.text_label("", "caption")
        v.addWidget(self.progress_label)
        v.addWidget(self.progress)
        self.shop.setVerticalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        self.shop.setStyleSheet(
            "QListWidget{background:transparent;border:none;outline:0;}"
            "QListWidget::item{padding:7px 8px;margin:1px 0;border-radius:8px;}"
            f"QListWidget::item:hover{{background:{PALETTE['surface2']};}}"
            "QListWidget::item:selected{background:transparent;}" + CHECK_QSS)
        self.shop_empty = W.EmptyState("list", "Your list is empty. Pick a recipe and press Add to list.")
        self.shop_stack = QStackedWidget()
        self.shop_stack.addWidget(self.shop)
        self.shop_stack.addWidget(self.shop_empty)
        v.addWidget(self.shop_stack, 1)
        row = QHBoxLayout()
        row.setSpacing(8)
        row.addWidget(self.copy_btn)
        row.addWidget(self.clear_btn)
        row.addStretch(1)
        v.addLayout(row)
        return p

    def _on_data(self) -> None:
        """The recipe book is shared by all classes; only the Sorcerer-relevance filter is class-specific."""
        sorc = self.gd.class_key == "sorcerer"
        self.filter_box.setVisible(sorc)
        if not sorc:
            self.filter_box.setChecked(False)
        profs = sorted({prof_name(r.profession) for r in self.gd.recipes})
        keep = self.prof_box.currentData()
        self.prof_box.blockSignals(True)
        self.prof_box.clear()
        self.prof_box.addItem("All professions", None)
        for pn in profs:
            self.prof_box.addItem(pn, pn)
        self.prof_box.setCurrentIndex(max(0, self.prof_box.findData(keep)))
        self.prof_box.blockSignals(False)
        self.prof_box.setVisible(len(profs) > 1)
        self.refresh_recipes()
        self.refresh_shopping()

    # ---- recipes -------------------------------------------------------
    def _label(self, r) -> str:
        flag = " (unverified)" if crafting.is_unverified(r) else ""
        n = self._list.get(r.id, 0)
        tail = f"   -   in list x{n}" if n else ""
        return f"{r.name}\n{prof_name(r.profession)}  -  {r.grade or 'grade ?'}{flag}{tail}"

    def refresh_recipes(self, *_):
        pool = crafting.sorc_recipes(self.gd) if self.filter_box.isChecked() else list(self.gd.recipes)
        found = {r.id for r in crafting.search(self.gd, self.search_edit.text())}
        prof = self.prof_box.currentData()
        keep = self._current()
        self._shown = [r for r in pool if r.id in found and (not prof or prof_name(r.profession) == prof)]
        self.recipe_list.blockSignals(True)
        self.recipe_list.clear()
        for r in self._shown:
            it = QListWidgetItem(QIcon(recipe_tile(r.grade, 40)), self._label(r))
            it.setToolTip(f"{r.name} ({r.profession})")
            it.setSizeHint(QSize(100, 58))
            self.recipe_list.addItem(it)
        self.recipe_list.blockSignals(False)
        total = len(self.gd.recipes)
        self.count_label.setText(f"{len(self._shown)} of {total}")
        self.recipe_stack.setCurrentWidget(self.recipe_list if self._shown else self.recipes_empty)
        if self._shown:
            row = next((i for i, r in enumerate(self._shown) if keep is not None and r.id == keep.id), 0)
            self.recipe_list.setCurrentRow(row)
            self._show_detail()
        else:
            self._show_detail()

    def _current(self):
        i = self.recipe_list.currentRow()
        return self._shown[i] if 0 <= i < len(self._shown) else None

    def _section(self, title: str, caption: str, rows) -> None:
        self.d_sections.addWidget(W.SectionHeader(title, caption))
        self.d_sections.addWidget(_mat_table([(m.qty, m.item) for m in rows]))

    def _show_detail(self, *_):
        r = self._current()
        _clear(self.d_chips)
        _clear(self.d_sections)
        has = r is not None
        for w in (self.big_tile, self.d_name, self.d_makes):
            w.setVisible(has)
        self.detail_empty.setVisible(not has)
        self.add_btn.setEnabled(has)
        self.remove_btn.setEnabled(has and r.id in self._list)
        if not has:
            return
        self.big_tile.setPixmap(recipe_tile(r.grade, 68))
        self.d_name.setText(r.name)
        self.d_makes.setText(f"Makes {r.output_qty} x {r.output_item}")
        self.d_chips.addWidget(W.Chip(prof_name(r.profession), "info"))
        if r.grade:
            self.d_chips.addWidget(W.Chip(r.grade, GRADE_TONE.get(r.grade.title(), "neutral")))
        if r.item_level is not None:
            self.d_chips.addWidget(W.Chip(f"Item level {r.item_level}", "gold"))
        self.d_chips.addWidget(W.Chip("Stats unknown", "unknown"))
        if r.sorc_relevant is None:
            self.d_chips.addWidget(W.Chip("Sorcerer relevance unverified", "warn"))
        self.d_chips.addStretch(1)
        n = self._list.get(r.id, 0)
        if n:
            row = QHBoxLayout()
            row.addWidget(W.StatPill("In your list", f"x{n}", "ok"))
            row.addStretch(1)
            self.d_sections.addLayout(row)
        self._section("Materials", f"{len(r.materials)} items", r.materials)
        self._section("Base materials", "everything broken down to raw drops", r.base_materials)

    # ---- list ----------------------------------------------------------
    def add_selected(self):
        r = self._current()
        if r is None:
            return
        self._list[r.id] = self._list.get(r.id, 0) + self.qty.value()
        self._save()
        self.refresh_shopping()

    def remove_selected(self):
        r = self._current()
        if r is not None and self._list.pop(r.id, None) is not None:
            self._save()
            self.refresh_shopping()

    def clear_list(self):
        self._list.clear()
        self._checks.clear()
        self._save()
        self.refresh_shopping()

    def craft_list(self) -> dict[int, int]:
        return dict(self._list)

    def refresh_shopping(self, *_):
        mats = crafting.shopping_list(self.gd, self._list, self.expand_box.isChecked())
        self.shop.blockSignals(True)
        self.shop.clear()
        for m in mats:
            it = QListWidgetItem(f"{m.qty} x {m.item}")
            it.setData(Qt.ItemDataRole.UserRole, m.item)
            it.setFlags(it.flags() | Qt.ItemFlag.ItemIsUserCheckable)
            it.setCheckState(Qt.CheckState.Checked if m.item in self._checks else Qt.CheckState.Unchecked)
            self._style_check(it)
            self.shop.addItem(it)
        self.shop.blockSignals(False)
        for i, r in enumerate(self._shown):  # "in list xN" tags follow the list
            if i < self.recipe_list.count():
                self.recipe_list.item(i).setText(self._label(r))
        self.shop_stack.setCurrentWidget(self.shop if mats else self.shop_empty)
        self.copy_btn.setEnabled(bool(mats))
        self.clear_btn.setEnabled(bool(self._list))
        self.shop_count.setText(f"{len(self._list)} recipes, {len(mats)} materials" if mats else "")
        self._update_progress()
        cur = self._current()
        self.remove_btn.setEnabled(cur is not None and cur.id in self._list)

    @staticmethod
    def _style_check(it: QListWidgetItem) -> None:
        done = it.checkState() == Qt.CheckState.Checked
        f = it.font()
        f.setStrikeOut(done)
        it.setFont(f)
        it.setForeground(QColor(PALETTE["text_faint"] if done else PALETTE["text"]))

    def _update_progress(self) -> None:
        n = self.shop.count()
        done = sum(1 for i in range(n) if self.shop.item(i).checkState() == Qt.CheckState.Checked)
        self.progress.setVisible(n > 0)
        self.progress.setRange(0, max(1, n))
        self.progress.setValue(done)
        self.progress_label.setVisible(n > 0)
        self.progress_label.setText(f"{done} of {n} gathered")

    def _on_check(self, it: QListWidgetItem):
        name = it.data(Qt.ItemDataRole.UserRole)
        if it.checkState() == Qt.CheckState.Checked:
            self._checks.add(name)
        else:
            self._checks.discard(name)
        self._style_check(it)
        self._update_progress()
        self._save()

    def list_text(self) -> str:
        mats = crafting.shopping_list(self.gd, self._list, self.expand_box.isChecked())
        return "\n".join(f"{m.qty} x {m.item}" for m in mats)

    def copy_list(self):
        QGuiApplication.clipboard().setText(self.list_text())

    def _save(self):
        user = settings.load_user()
        user["craft_list"] = {str(k): v for k, v in self._list.items()}
        user["craft_checks"] = sorted(self._checks)
        settings.save_user(user)
