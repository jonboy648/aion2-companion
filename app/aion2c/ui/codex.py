"""Codex screen (P7) plus small widget helpers shared by the other window screens.

Polished layout: left a searchable, filterable skill grid (or list) with big icons, right a detail card
with stat pills, chain links, specializations and the rank table. Everything is class-aware: it reads
the GameData the AppState holds NOW (LiveBound), so switching class rebuilds the grid.
"""
from PySide6.QtCore import QSize, Qt
from PySide6.QtGui import QBrush, QColor, QIcon, QPainter, QPen, QPixmap
from PySide6.QtWidgets import (
    QAbstractItemView,
    QButtonGroup,
    QComboBox,
    QFrame,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QListView,
    QListWidget,
    QListWidgetItem,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QStackedWidget,
    QTableWidget,
    QTableWidgetItem,
    QVBoxLayout,
    QWidget,
)

import aion2c.ui.icons as icons_mod
from aion2c.classes import class_name
from aion2c.data.loader import allowed_skills
from aion2c.interfaces import EngineFacade
from aion2c.models import GameData, Num, Skill, SkillKind
from aion2c.state import AppState
from aion2c.ui import widgets as W
from aion2c.ui.confidence import confidence_color, fmt_num
from aion2c.ui.live import LiveBound
from aion2c.ui.theme import PALETTE, TONES


# ---- helpers shared by P7 screens ----
def make_item(text: str, tip: str = "", editable: bool = False) -> QTableWidgetItem:
    it = QTableWidgetItem(text)
    if tip:
        it.setToolTip(tip)
    if not editable:
        it.setFlags(it.flags() & ~Qt.ItemFlag.ItemIsEditable)
    return it


def num_item(n: Num) -> QTableWidgetItem:
    """Confidence rendering: confirmed plain, estimated `~` amber, unknown `?` grey + source tooltip."""
    text, tip = fmt_num(n)
    it = make_item(text, tip)
    if n.confidence != "confirmed":
        it.setForeground(QBrush(confidence_color(n.confidence)))
    return it


def conf_item(conf: str, tip: str = "") -> QTableWidgetItem:
    it = make_item(conf, tip or conf)
    if conf != "confirmed":
        it.setForeground(QBrush(confidence_color(conf)))  # type: ignore[arg-type]
    return it


def skill_name(gd: GameData, key: str) -> str:
    sk = gd.skills.get(key)
    return sk.name if sk else key


def skill_icon(gd: GameData, key: str, size: int = 24) -> QIcon:
    return QIcon(icons_mod.pixmap(gd, key, size))


def rank_cap(gd: GameData, region: str, skill: Skill) -> int:
    """Highest selectable rank for `skill` in `region` (data ranks clipped by the region cap)."""
    cap_key = "stigma" if skill.kind == SkillKind.STIGMA else "core"
    return max(1, min(len(skill.ranks) or 1, gd.rank_caps[region][cap_key]))  # type: ignore[index]


def count_confidence(skills) -> tuple[int, int]:
    """(estimated, unknown) over the headline numbers of `skills`: ratio, anim lock, rank-1 cd/mp."""
    est = unk = 0
    for sk in skills:
        nums = [sk.atk_ratio_pct, sk.anim_lock_s]
        if sk.ranks:
            nums += [sk.ranks[0].cooldown_s, sk.ranks[0].mp_cost]
        for n in nums:
            est += n.confidence == "estimated"
            unk += n.confidence == "unknown"
    return est, unk


def castable_skills(gd: GameData, region: str, show_kr: bool) -> list[Skill]:
    """Skills a user ranks or places on a bar: active, stigma, passive (no chain/proc/tiers)."""
    keep = (SkillKind.ACTIVE, SkillKind.STIGMA, SkillKind.PASSIVE)
    return [s for s in allowed_skills(gd, region, show_kr) if s.kind in keep]  # type: ignore[arg-type]


# ---- codex presentation ----
KIND_TONE = {"active": "gold", "passive": "info", "stigma": "ok"}
KIND_LABEL = {"active": "Active", "passive": "Passive", "stigma": "Stigma"}
FILTERS = (("all", "All"), ("active", "Active"), ("passive", "Passive"), ("stigma", "Stigma"), ("other", "Other"))
_TILE_CACHE: dict[tuple, QPixmap] = {}


def _kind_color(kind: SkillKind) -> str:
    return TONES[KIND_TONE.get(kind.value, "neutral")][0]


def tile_pixmap(gd: GameData, sk: Skill, size: int) -> QPixmap:
    """Skill icon on a rounded dark tile with a kind-coloured bezel (gold active, cyan passive, green stigma)."""
    key = (gd.class_key, sk.key, sk.icon, sk.kind.value, size)
    hit = _TILE_CACHE.get(key)
    if hit is not None:
        return hit
    dpr = 2
    pm = QPixmap(size * dpr, size * dpr)
    pm.setDevicePixelRatio(dpr)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    p.setRenderHints(QPainter.RenderHint.Antialiasing | QPainter.RenderHint.SmoothPixmapTransform)
    rad = max(7, size // 6)
    p.setPen(Qt.PenStyle.NoPen)
    p.setBrush(QColor(PALETTE["surface2"]))
    p.drawRoundedRect(1, 1, size - 2, size - 2, rad, rad)
    inner = max(8, size - 10)
    src = icons_mod.pixmap(gd, sk.key, inner * dpr)
    if not src.isNull():
        scaled = src.scaled(inner * dpr, inner * dpr, Qt.AspectRatioMode.KeepAspectRatio,
                            Qt.TransformationMode.SmoothTransformation)
        sw, sh = scaled.width() / dpr, scaled.height() / dpr
        p.drawPixmap(int((size - sw) / 2), int((size - sh) / 2), int(sw), int(sh), scaled)
    col = QColor(_kind_color(sk.kind))
    glow = QColor(col)
    glow.setAlpha(55)
    p.setPen(QPen(glow, 3))
    p.setBrush(Qt.BrushStyle.NoBrush)
    p.drawRoundedRect(2, 2, size - 4, size - 4, rad, rad)
    p.setPen(QPen(col, 1.5))
    p.drawRoundedRect(2, 2, size - 4, size - 4, rad, rad)
    p.end()
    _TILE_CACHE[key] = pm
    return pm


def _fnum(n: Num) -> tuple[str, str]:
    """(text, confidence tone) for a Num."""
    text, _tip = fmt_num(n)
    return text, n.confidence


def _panel() -> QFrame:
    """Card look without the drop shadow (these panels hold scrolling content)."""
    f = QFrame()
    f.setProperty("card", True)
    f.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
    return f


def _clear_layout(lay) -> None:
    while lay.count():
        it = lay.takeAt(0)
        if it.widget() is not None:
            w = it.widget()
            w.hide()
            w.setParent(None)
            w.deleteLater()
        elif it.layout() is not None:
            _clear_layout(it.layout())


GRID_ICON, GRID_CELL = 56, QSize(124, 134)
LIST_ICON = 36
LIST_QSS = (
    f"QListWidget{{background:transparent;border:none;outline:0;}}"
    f"QListWidget::item{{padding:4px;margin:2px;border-radius:10px;border:1px solid transparent;}}"
    f"QListWidget::item:hover{{background:{PALETTE['surface2']};}}"
    f"QListWidget::item:selected{{background:#2a2d44;color:{PALETTE['gold_hi']};"
    f"border:1px solid {PALETTE['gold']};}}"
)


class CodexScreen(LiveBound, QWidget):
    def __init__(self, state: AppState, gd: GameData, engine: EngineFacade, parent=None):
        super().__init__(parent)
        self.state, self.gd, self.engine = state, gd, engine
        self._kind = "all"
        self._class_key = None
        self._build_left()
        self._build_right()
        lay = QHBoxLayout(self)
        lay.setContentsMargins(20, 16, 20, 16)
        lay.setSpacing(16)
        lay.addWidget(self.left, 5)
        lay.addWidget(self.right, 4)
        self.search.textChanged.connect(self.refresh)
        self.element_box.currentIndexChanged.connect(self.refresh)
        self.filter_group.buttonClicked.connect(self._on_filter)
        self.view_grid.toggled.connect(self._apply_view)
        self.list.currentItemChanged.connect(
            lambda cur, _prev: self._show(cur.data(Qt.ItemDataRole.UserRole) if cur else None))
        self.empty.action.clicked.connect(self.clear_filters)
        state.buildChanged.connect(self.refresh)
        state.dataChanged.connect(self.refresh)
        self._apply_view()
        self.refresh()

    # ---- construction ----
    def _build_left(self) -> None:
        self.left = _panel()
        v = QVBoxLayout(self.left)
        v.setContentsMargins(16, 14, 16, 12)
        v.setSpacing(10)
        head = QHBoxLayout()
        head.setSpacing(12)
        self.emblem = QLabel()
        self.emblem.setFixedSize(44, 44)
        head.addWidget(self.emblem)
        names = QVBoxLayout()
        names.setSpacing(0)
        self.title = W.text_label("", "title")
        self.count = W.text_label("", "caption")
        names.addWidget(self.title)
        names.addWidget(self.count)
        head.addLayout(names, 1)
        self.view_grid = QPushButton("Grid")
        self.view_list = QPushButton("List")
        for b in (self.view_grid, self.view_list):
            b.setCheckable(True)
            b.setMinimumHeight(30)
            b.setCursor(Qt.CursorShape.PointingHandCursor)
        self.view_grid.setChecked(True)
        self.view_group = QButtonGroup(self)
        self.view_group.setExclusive(True)
        self.view_group.addButton(self.view_grid)
        self.view_group.addButton(self.view_list)
        head.addWidget(self.view_grid)
        head.addWidget(self.view_list)
        v.addLayout(head)

        row = QHBoxLayout()
        row.setSpacing(8)
        self.search = QLineEdit()
        self.search.setPlaceholderText("Search skills")
        self.search.setClearButtonEnabled(True)
        self.search.setMinimumHeight(34)
        self.element_box = QComboBox()
        self.element_box.setMinimumHeight(34)
        self.element_box.setMinimumWidth(130)
        row.addWidget(self.search, 1)
        row.addWidget(self.element_box)
        v.addLayout(row)

        chips = QHBoxLayout()
        chips.setSpacing(6)
        self.filter_group = QButtonGroup(self)
        self.filter_group.setExclusive(True)
        self.filter_btns: dict[str, QPushButton] = {}
        for key, label in FILTERS:
            b = QPushButton(label)
            b.setCheckable(True)
            b.setMinimumHeight(30)
            b.setCursor(Qt.CursorShape.PointingHandCursor)
            b.setProperty("filter_key", key)
            self.filter_group.addButton(b)
            self.filter_btns[key] = b
            chips.addWidget(b)
        self.filter_btns["all"].setChecked(True)
        chips.addStretch(1)
        v.addLayout(chips)

        self.list = QListWidget()
        self.list.setStyleSheet(LIST_QSS)
        self.list.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.list.setVerticalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        self.empty = W.EmptyState("search", "No skills match these filters. Clear them to see the whole class.",
                                  "Clear filters")
        self.stack = QStackedWidget()
        self.stack.addWidget(self.list)
        self.stack.addWidget(self.empty)
        v.addWidget(self.stack, 1)

    def _build_right(self) -> None:
        self.right = _panel()
        outer = QVBoxLayout(self.right)
        outer.setContentsMargins(2, 2, 2, 2)
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setFrameShape(QFrame.Shape.NoFrame)
        self.scroll.setStyleSheet("QScrollArea{background:transparent;border:none;}"
                                  "QScrollArea>QWidget>QWidget{background:transparent;}")
        outer.addWidget(self.scroll)
        body = QWidget()
        self.scroll.setWidget(body)
        self.dv = QVBoxLayout(body)
        self.dv.setContentsMargins(16, 14, 16, 14)
        self.dv.setSpacing(10)

        top = QHBoxLayout()
        top.setSpacing(14)
        self.big_icon = QLabel()
        self.big_icon.setFixedSize(76, 76)
        top.addWidget(self.big_icon, 0, Qt.AlignmentFlag.AlignTop)
        tv = QVBoxLayout()
        tv.setSpacing(4)
        self.d_name = W.text_label("", "title", wrap=True)
        self.d_name_kr = W.text_label("", "caption")
        self.d_chips = QHBoxLayout()
        self.d_chips.setSpacing(6)
        tv.addWidget(self.d_name)
        tv.addWidget(self.d_name_kr)
        tv.addLayout(self.d_chips)
        tv.addStretch(1)
        top.addLayout(tv, 1)
        self.dv.addLayout(top)

        self.d_pills = QWidget()
        self.d_pills_lay = _grid(self.d_pills)
        self.dv.addWidget(self.d_pills)
        self.d_desc = W.text_label("", "dim", wrap=True)
        self.d_desc.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Minimum)
        self.dv.addWidget(self.d_desc)

        self.d_links = QVBoxLayout()
        self.d_links.setSpacing(4)
        self.dv.addLayout(self.d_links)
        self.d_specs = QVBoxLayout()
        self.d_specs.setSpacing(4)
        self.dv.addLayout(self.d_specs)

        self.rank_head = W.SectionHeader("Ranks")
        self.dv.addWidget(self.rank_head)
        self.ranks = QTableWidget(0, 5)
        self.ranks.setHorizontalHeaderLabels(["Rank", "Flat min", "Flat max", "Cooldown s", "MP"])
        self.ranks.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.ranks.setAlternatingRowColors(True)
        self.ranks.verticalHeader().setVisible(False)
        self.ranks.verticalHeader().setDefaultSectionSize(34)
        self.ranks.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.ranks.setSelectionMode(QAbstractItemView.SelectionMode.NoSelection)
        self.ranks.setMinimumHeight(260)
        self.dv.addWidget(self.ranks, 1)
        self.d_empty = W.EmptyState("codex", "Pick a skill to see its numbers, chains and ranks.")
        self.dv.addWidget(self.d_empty)

    # ---- data ----
    def _gd(self) -> GameData:
        return self.state.gamedata()

    def _pool(self) -> list[Skill]:
        b = self.state.build()
        return allowed_skills(self._gd(), b.region, self.state.show_kr())

    @staticmethod
    def _bucket(sk: Skill) -> str:
        return sk.kind.value if sk.kind.value in KIND_TONE else "other"

    def _element(self) -> str | None:
        return self.element_box.currentData()

    def _match(self, sk: Skill, text: str, element: str | None) -> bool:
        if element and sk.element != element:
            return False
        return not text or text in sk.name.lower() or text in sk.key.lower() or text in (sk.name_kr or "")

    def visible_skills(self) -> list[Skill]:
        text = self.search.text().strip().lower()
        element = self._element()
        out = [s for s in self._pool() if self._match(s, text, element)]
        if self._kind != "all":
            out = [s for s in out if self._bucket(s) == self._kind]
        return out

    def clear_filters(self) -> None:
        self.search.blockSignals(True)
        self.search.clear()
        self.search.blockSignals(False)
        self.element_box.blockSignals(True)
        self.element_box.setCurrentIndex(0)
        self.element_box.blockSignals(False)
        self._kind = "all"
        self.filter_btns["all"].setChecked(True)
        self.refresh()

    def _on_filter(self, btn: QPushButton) -> None:
        self._kind = btn.property("filter_key")
        self.refresh()

    def _sync_class(self, gd: GameData, pool: list[Skill]) -> None:
        """Class switched: header, emblem, element filter and kind filter all follow the new class."""
        self._class_key = gd.class_key
        self.emblem.setPixmap(W.class_emblem(gd.class_key, 44))
        self.title.setText(f"{class_name(gd.class_key)} skills")
        self.element_box.blockSignals(True)
        self.element_box.clear()
        self.element_box.addItem("All elements", None)
        for el in sorted({s.element for s in pool}):
            self.element_box.addItem(str(el).replace("_", " ").title(), el)
        self.element_box.blockSignals(False)
        self._kind = "all"
        self.filter_btns["all"].setChecked(True)
        self.search.blockSignals(True)
        self.search.clear()
        self.search.blockSignals(False)

    def _apply_view(self, *_a) -> None:
        grid = self.view_grid.isChecked()
        lw = self.list
        if grid:
            lw.setViewMode(QListView.ViewMode.IconMode)
            lw.setIconSize(QSize(GRID_ICON, GRID_ICON))
            lw.setGridSize(GRID_CELL)
            lw.setSpacing(4)
            lw.setWrapping(True)
            lw.setWordWrap(True)
            lw.setFlow(QListView.Flow.LeftToRight)
            lw.setResizeMode(QListView.ResizeMode.Adjust)
            lw.setMovement(QListView.Movement.Static)
            lw.setTextElideMode(Qt.TextElideMode.ElideRight)
        else:
            lw.setViewMode(QListView.ViewMode.ListMode)
            lw.setIconSize(QSize(LIST_ICON, LIST_ICON))
            lw.setGridSize(QSize())
            lw.setSpacing(0)
            lw.setWrapping(False)
            lw.setWordWrap(False)
            lw.setFlow(QListView.Flow.TopToBottom)
            lw.setMovement(QListView.Movement.Static)
        if self._class_key is not None:
            self.refresh()

    def refresh(self, *_args) -> None:
        gd = self._gd()
        pool = self._pool()
        if gd.class_key != self._class_key:
            self._sync_class(gd, pool)
        keep = self.current_key()
        text = self.search.text().strip().lower()
        element = self._element()
        base = [s for s in pool if self._match(s, text, element)]
        counts = {k: 0 for k, _ in FILTERS}
        for s in base:
            counts[self._bucket(s)] += 1
        counts["all"] = len(base)
        in_class = {self._bucket(s) for s in pool}
        for key, label in FILTERS:
            b = self.filter_btns[key]
            b.setText(f"{label}  {counts[key]}")
            b.setVisible(key in ("all", *in_class))
            b.setEnabled(counts[key] > 0 or key == self._kind or key == "all")
        shown = self.visible_skills()
        self.count.setText(f"{len(shown)} of {len(pool)} skills shown")
        grid = self.view_grid.isChecked()
        size = GRID_ICON if grid else LIST_ICON
        self.list.blockSignals(True)
        self.list.clear()
        for sk in shown:
            label = sk.name
            if not grid:
                lvl = f"Lv {sk.unlock_level}" if sk.unlock_level is not None else "Lv ?"
                label = f"{sk.name}\n{KIND_LABEL.get(sk.kind.value, sk.kind.value.title())}  -  {lvl}"
            it = QListWidgetItem(QIcon(tile_pixmap(gd, sk, size)), label)
            it.setData(Qt.ItemDataRole.UserRole, sk.key)
            it.setToolTip(f"{sk.name}  ({sk.kind.value}, {sk.element})")
            if grid:  # explicit hint so the label may wrap to two lines inside the whole cell
                it.setSizeHint(QSize(GRID_CELL.width() - 6, GRID_CELL.height() - 6))
            self.list.addItem(it)
        self.list.blockSignals(False)
        self.stack.setCurrentWidget(self.list if shown else self.empty)
        first_active = next((i for i, s in enumerate(shown) if s.kind == SkillKind.ACTIVE), 0)
        row = next((i for i in range(self.list.count()) if self.list.item(i).data(Qt.ItemDataRole.UserRole) == keep),
                   first_active)
        if self.list.count():
            self.list.setCurrentRow(row)
            self._show(self.list.item(row).data(Qt.ItemDataRole.UserRole))
        else:
            self._show(None)

    def current_key(self) -> str | None:
        it = self.list.currentItem()
        return it.data(Qt.ItemDataRole.UserRole) if it else None

    def select_key(self, key: str) -> None:
        """Jump to a skill (chain link click); filters that would hide it are cleared first."""
        for attempt in range(2):
            for i in range(self.list.count()):
                if self.list.item(i).data(Qt.ItemDataRole.UserRole) == key:
                    self.list.setCurrentRow(i)
                    self.list.scrollToItem(self.list.item(i))
                    return
            if attempt == 0:
                self.clear_filters()

    # ---- detail panel ----
    def _detail_visible(self, on: bool) -> None:
        for w in (self.big_icon, self.d_name, self.d_name_kr, self.d_pills, self.d_desc, self.rank_head, self.ranks):
            w.setVisible(on)
        self.d_empty.setVisible(not on)
        if not on:
            _clear_layout(self.d_chips)
            _clear_layout(self.d_links)
            _clear_layout(self.d_specs)

    def _pill(self, i: int, label: str, value: str, tone: str) -> None:
        self.d_pills_lay.addWidget(W.StatPill(label, value, tone), i // 3, i % 3)

    def _link_block(self, title: str, entries: list[tuple[str, str, str]]) -> None:
        if not entries:
            return
        gd = self._gd()
        self.d_links.addWidget(W.text_label(title.upper(), "caption"))
        for key, kind, conf in entries:
            btn = QPushButton(f"{skill_name(gd, key)}    {kind} - {conf}")
            btn.setProperty("variant", "ghost")
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.setMinimumHeight(34)
            btn.setStyleSheet("text-align:left;padding-left:10px;")
            if key in gd.skills:
                btn.setIcon(skill_icon(gd, key, 22))
                btn.setIconSize(QSize(22, 22))
            btn.clicked.connect(lambda _c=False, k=key: self.select_key(k))
            self.d_links.addWidget(btn)

    def _show(self, key: str | None) -> None:
        gd = self._gd()
        sk = gd.skills.get(key) if key else None
        self.ranks.setRowCount(0)
        _clear_layout(self.d_pills_lay)
        if sk is None:
            self._detail_visible(False)
            return
        self._detail_visible(True)
        region = self.state.build().region
        self.big_icon.setPixmap(tile_pixmap(gd, sk, 76))
        self.d_name.setText(sk.name)
        self.d_name_kr.setText(sk.name_kr or "")
        self.d_name_kr.setVisible(bool(sk.name_kr))
        _clear_layout(self.d_chips)
        self.d_chips.addWidget(W.Chip(KIND_LABEL.get(sk.kind.value, sk.kind.value.title()),
                                      KIND_TONE.get(sk.kind.value, "neutral")))
        if str(sk.element).lower() not in ("none", ""):
            self.d_chips.addWidget(W.Chip(str(sk.element).replace("_", " ").title()))
        lvl = f"Unlock Lv {sk.unlock_level}" if sk.unlock_level is not None else "Unlock level ?"
        self.d_chips.addWidget(W.Chip(lvl, "gold" if sk.unlock_level is not None else "unknown"))
        if region not in sk.regions:
            self.d_chips.addWidget(W.Chip("KR only", "warn"))
        self.d_chips.addStretch(1)

        r1 = sk.ranks[0] if sk.ranks else None
        ratio, rt = _fnum(sk.atk_ratio_pct)
        cd, ct = _fnum(r1.cooldown_s) if r1 else ("?", "unknown")
        mp, mt = _fnum(r1.mp_cost) if r1 else ("?", "unknown")
        self._pill(0, "ATK ratio", f"{ratio}%", rt)
        self._pill(1, "Cooldown", f"{cd} s", ct)
        self._pill(2, "MP", mp, mt)
        self._pill(3, "Range", f"{sk.range_m:g} m" if sk.range_m is not None else "?",
                   "neutral" if sk.range_m is not None else "unknown")
        self._pill(4, "Targets", str(sk.aoe_targets), "neutral")
        self._pill(5, "Hits", str(sk.hits), "neutral")
        self.d_desc.setText(sk.description)
        self.d_desc.setVisible(bool(sk.description))

        _clear_layout(self.d_links)
        self._link_block("Comes from", [(l.parent_key, l.kind, l.confidence) for l in gd.links if l.child_key == sk.key])
        self._link_block("Leads to", [(l.child_key, l.kind, l.confidence) for l in gd.links if l.parent_key == sk.key])
        _clear_layout(self.d_specs)
        if sk.specializations:
            self.d_specs.addWidget(W.SectionHeader("Specializations"))
            for sp in sk.specializations:
                row = QHBoxLayout()
                row.setSpacing(10)
                rr = sp.rank_required
                row.addWidget(W.Chip(f"Rank {rr}" if rr is not None else "Rank ?", "gold" if rr is not None else "unknown"),
                              0, Qt.AlignmentFlag.AlignTop)
                lb = W.text_label(sp.text, "", wrap=True)
                lb.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Minimum)
                row.addWidget(lb, 1)
                self.d_specs.addLayout(row)

        cap = rank_cap(gd, region, sk)
        shown = sk.ranks[:cap]
        self.rank_head.title_label.setText("Ranks")
        self.rank_head.caption_label.setText(f"showing {len(shown)} of {len(sk.ranks)} (region rank cap {cap})")
        self.rank_head.caption_label.setVisible(True)
        self.ranks.setRowCount(len(shown))
        center = Qt.AlignmentFlag.AlignCenter
        for i, rd in enumerate(shown):
            self.ranks.setItem(i, 0, make_item(str(rd.rank)))
            for col, n in enumerate((rd.flat_min, rd.flat_max, rd.cooldown_s, rd.mp_cost), start=1):
                self.ranks.setItem(i, col, num_item(n))
            for col in range(5):
                self.ranks.item(i, col).setTextAlignment(center)
        self.ranks.setVisible(bool(shown))
        if not shown:
            self.rank_head.caption_label.setText("no rank data")


def _grid(parent: QWidget):
    from PySide6.QtWidgets import QGridLayout

    g = QGridLayout(parent)
    g.setContentsMargins(0, 0, 0, 0)
    g.setHorizontalSpacing(8)
    g.setVerticalSpacing(8)
    for c in range(3):
        g.setColumnStretch(c, 1)
    return g
