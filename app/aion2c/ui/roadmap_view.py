"""Road Map screen (P7): timeline of milestones by level band; checks persist in settings `roadmap_checks`.

Presentation: a QTreeWidget (one top-level item per 10-level band, one checkable leaf per unlock) painted by
`TimelineDelegate` as a vertical rail with node dots, level pills, skill icon tiles and kind chips.
"""
import weakref

from PySide6.QtCore import QEvent, QPointF, QRect, QRectF, QSize, Qt
from PySide6.QtGui import QColor, QFont, QFontMetrics, QPainter, QPen
from PySide6.QtWidgets import (
    QAbstractItemView,
    QFrame,
    QHBoxLayout,
    QStyle,
    QStyledItemDelegate,
    QTreeWidget,
    QTreeWidgetItem,
    QVBoxLayout,
    QWidget,
)

import aion2c.roadmap as roadmap_mod
from aion2c.interfaces import EngineFacade
from aion2c.models import GameData, RoadmapItem
from aion2c.settings import load_user, save_user
from aion2c.state import AppState
from aion2c.ui import widgets as W
from aion2c.ui.codex import tile_pixmap
from aion2c.ui.live import LiveBound
from aion2c.ui.theme import PALETTE, TONES

BAND = 10
KIND_TONE = {"skill": "gold", "stigma": "ok", "zone": "info", "system": "neutral", "gear": "warn",
             "daevanion": "estimated"}
KIND_ICON = {"skill": "bolt", "stigma": "star", "zone": "roadmap", "system": "settings", "gear": "shield",
             "daevanion": "daevanion"}
R_ID, R_LEVEL, R_KIND, R_SKILLS, R_BAND = (Qt.ItemDataRole.UserRole + i for i in (0, 1, 2, 3, 4))
HEAD_H, ROW_H, RAIL_X, TILE = 64, 56, 34, 36


def item_id(it: RoadmapItem) -> str:
    return f"{it.level}|{it.kind}|{it.text}"


def skill_keys_in(gd: GameData, text: str) -> list[str]:
    """Skill keys named in a roadmap line: 'Unlock X', or 'Class skill unlock: A, B (passive), C'."""
    low = text.lower()
    body = text[low.index("unlock:") + 7:] if "unlock:" in low else text  # skill names may hold a colon
    if body.lstrip().lower().startswith("unlock "):
        body = body.lstrip()[7:]
    index = {s.name.lower(): k for k, s in gd.skills.items()}
    keys: list[str] = []
    for part in body.split(","):
        name = part.split("(")[0].strip().lower()
        if name in index and index[name] not in keys:
            keys.append(index[name])
    return keys[:4]


def _c(token: str, alpha: int | None = None) -> QColor:
    col = QColor(PALETTE.get(token, token))
    if alpha is not None:
        col.setAlpha(alpha)
    return col


class TimelineDelegate(QStyledItemDelegate):
    """Paints band headers (cards on the rail) and unlock rows (rail, checkbox, level pill, icons, kind chip)."""

    def __init__(self, view: "RoadmapScreen"):
        super().__init__(view.tree)
        self._view = weakref.ref(view)  # no strong cycle: the tree owns this delegate

    @property
    def view(self) -> "RoadmapScreen":
        return self._view()

    def _box(self, rect: QRect) -> QRect:
        return QRect(rect.x() + 70, rect.center().y() - 10, 20, 20)

    def sizeHint(self, option, index) -> QSize:
        return QSize(0, ROW_H if index.parent().isValid() else HEAD_H)

    def editorEvent(self, event, model, option, index) -> bool:
        if not index.parent().isValid():
            return False
        et = event.type()
        hit = False
        if et == QEvent.Type.MouseButtonRelease and event.button() == Qt.MouseButton.LeftButton:
            hit = option.rect.adjusted(60, 0, 0, 0).contains(event.position().toPoint())
        elif et == QEvent.Type.KeyPress and event.key() == Qt.Key.Key_Space:
            hit = True
        elif et == QEvent.Type.MouseButtonDblClick:
            return True  # swallow: a double click must not toggle twice
        if not hit:
            return False
        cur = Qt.CheckState(index.data(Qt.ItemDataRole.CheckStateRole))
        new = Qt.CheckState.Unchecked if cur == Qt.CheckState.Checked else Qt.CheckState.Checked
        return model.setData(index, new, Qt.ItemDataRole.CheckStateRole)

    # ---- painting ----
    def paint(self, p: QPainter, option, index) -> None:
        p.save()
        p.setRenderHints(QPainter.RenderHint.Antialiasing | QPainter.RenderHint.TextAntialiasing)
        if index.parent().isValid():
            self._paint_row(p, option, index)
        else:
            self._paint_head(p, option, index)
        p.restore()

    def _rail(self, p: QPainter, rect: QRect, reached: bool, first: bool) -> None:
        p.setPen(QPen(_c("gold_lo") if reached else _c("border"), 2))
        top = rect.center().y() if first else rect.top()
        p.drawLine(rect.x() + RAIL_X, top, rect.x() + RAIL_X, rect.bottom() + 1)

    def _node(self, p: QPainter, cx: float, cy: float, r: float, state: str) -> None:
        """state: done (green), here (gold, glowing), reached (gold ring), future (dim ring)."""
        if state == "here":
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(_c("gold", 60))
            p.drawEllipse(QPointF(cx, cy), r + 5, r + 5)
        fill = {"done": _c("ok"), "here": _c("gold_hi"), "reached": _c("bg"), "future": _c("bg")}[state]
        ring = {"done": _c("ok"), "here": _c("gold"), "reached": _c("gold"), "future": _c("border")}[state]
        p.setBrush(fill)
        p.setPen(QPen(ring, 2))
        p.drawEllipse(QPointF(cx, cy), r, r)
        if state == "done":
            p.drawPixmap(int(cx - r * 0.6), int(cy - r * 0.6), int(r * 1.2), int(r * 1.2),
                         W.line_icon("check", int(r * 1.2), _c("bg")))

    def _paint_head(self, p: QPainter, option, index) -> None:
        info = index.data(R_BAND) or {}
        r: QRect = option.rect
        cur, done, total = info.get("current"), info.get("done", 0), max(1, info.get("total", 1))
        complete = info.get("done", 0) == info.get("total", 0) and info.get("total", 0) > 0
        reached = info.get("reached", False)
        self._rail(p, r, reached, first=bool(info.get("first")))
        state = "here" if cur else "done" if complete else "reached" if reached else "future"
        self._node(p, r.x() + RAIL_X, r.center().y(), 9, state)
        card = QRectF(r.x() + 60, r.y() + 6, r.width() - 72, r.height() - 12)
        hover = bool(option.state & QStyle.StateFlag.State_MouseOver)
        fg, bg, bd = TONES["gold"] if cur else TONES["ok"] if complete else TONES["neutral"]
        p.setPen(QPen(_c(bd) if (cur or complete) else _c("gold_lo" if hover else "border_soft"), 1.2))
        p.setBrush(_c(bg) if (cur or complete) else _c("surface2" if hover else "surface"))
        p.drawRoundedRect(card, 12, 12)
        f = QFont(option.font)
        f.setPixelSize(16)
        f.setWeight(QFont.Weight.DemiBold)
        p.setFont(f)
        p.setPen(_c("gold_hi") if cur else _c("text"))
        title = index.data(Qt.ItemDataRole.DisplayRole)
        tx = int(card.x()) + 18
        p.drawText(QRect(tx, int(card.y()), 190, int(card.height())), Qt.AlignmentFlag.AlignVCenter, title)
        tw = QFontMetrics(f).horizontalAdvance(title)
        x = tx + tw + 14
        if cur:
            f2 = QFont(option.font)
            f2.setPixelSize(11)
            f2.setBold(True)
            p.setFont(f2)
            label = f"YOU ARE HERE  -  Lv {info.get('level', '?')}"
            w = QFontMetrics(f2).horizontalAdvance(label) + 22
            pill = QRectF(x, card.center().y() - 11, w, 22)
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(_c("gold"))
            p.drawRoundedRect(pill, 11, 11)
            p.setPen(_c("gold_ink"))
            p.drawText(pill, Qt.AlignmentFlag.AlignCenter, label)
        f3 = QFont(option.font)
        f3.setPixelSize(12)
        p.setFont(f3)
        right = int(card.right()) - 18
        chev = "▾" if option.state & QStyle.StateFlag.State_Open else "▸"
        p.setPen(_c("gold_hi") if cur else _c("text_dim"))
        cf = QFont(f3)
        cf.setPixelSize(16)
        p.setFont(cf)
        p.drawText(QRect(right - 16, int(card.y()), 20, int(card.height())), Qt.AlignmentFlag.AlignCenter, chev)
        p.setFont(f3)
        count = f"{done} of {info.get('total', 0)} done"
        cw = QFontMetrics(f3).horizontalAdvance(count)
        p.setPen(_c("ok") if complete else _c("text_dim"))
        p.drawText(QRect(right - 34 - cw, int(card.y()), cw + 2, int(card.height())),
                   Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignRight, count)
        bar = QRectF(right - 34 - cw - 18 - 120, card.center().y() - 3, 120, 6)
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(_c("surface3"))
        p.drawRoundedRect(bar, 3, 3)
        if done:
            p.setBrush(_c("ok") if complete else _c("gold"))
            p.drawRoundedRect(QRectF(bar.x(), bar.y(), bar.width() * done / total, 6), 3, 3)

    def _paint_row(self, p: QPainter, option, index) -> None:
        r: QRect = option.rect
        lvl = int(index.data(R_LEVEL) or 0)
        kind = str(index.data(R_KIND) or "system")
        keys = index.data(R_SKILLS) or ()
        done = Qt.CheckState(index.data(Qt.ItemDataRole.CheckStateRole)) == Qt.CheckState.Checked
        reached = lvl <= self.view.level()
        self._rail(p, r, reached, first=False)
        self._node(p, r.x() + RAIL_X, r.center().y(), 5, "done" if done else "reached" if reached else "future")
        if option.state & QStyle.StateFlag.State_MouseOver:
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(_c("surface2"))
            p.drawRoundedRect(QRectF(r.x() + 58, r.y() + 2, r.width() - 70, r.height() - 4), 10, 10)
        p.setPen(QPen(_c("border_soft"), 1))
        p.drawLine(r.x() + 70, r.bottom(), r.right() - 14, r.bottom())
        box = self._box(r)
        p.setPen(QPen(_c("gold_lo") if done else _c("border"), 1.2))
        p.setBrush(_c("gold") if done else _c("surface"))
        p.drawRoundedRect(QRectF(box), 5, 5)
        if done:
            p.drawPixmap(box.adjusted(3, 3, -3, -3), W.line_icon("check", 14, _c("gold_ink")))
        dim = done or not reached
        f = QFont(option.font)
        f.setPixelSize(11)
        f.setBold(True)
        p.setFont(f)
        lv = f"Lv {lvl}"
        pill = QRectF(r.x() + 102, r.center().y() - 12, 52, 24)
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(_c("surface3") if reached else _c("surface2"))
        p.drawRoundedRect(pill, 12, 12)
        p.setPen(_c("text_dim") if dim else _c("gold_hi"))
        p.drawText(pill, Qt.AlignmentFlag.AlignCenter, lv)
        gd = self.view.gd
        x = r.x() + 168
        ty = r.center().y() - TILE // 2
        tiles = [gd.skills[k] for k in keys if k in gd.skills]
        if tiles:
            for sk in tiles:
                p.setOpacity(0.45 if done else 1.0)
                p.drawPixmap(x, ty, TILE, TILE, tile_pixmap(gd, sk, TILE))
                x += TILE + 6
        else:
            tone = TONES[KIND_TONE.get(kind, "neutral")]
            tile = QRectF(x, ty, TILE, TILE)
            p.setPen(QPen(_c(tone[2]), 1.2))
            p.setBrush(_c(tone[1]))
            p.setOpacity(0.5 if done else 1.0)
            p.drawRoundedRect(tile, 9, 9)
            p.drawPixmap(int(x + 8), ty + 8, 20, 20, W.line_icon(KIND_ICON.get(kind, "info"), 20, _c(tone[0])))
            x += TILE + 6
        p.setOpacity(1.0)
        chip_f = QFont(option.font)
        chip_f.setPixelSize(10)
        chip_f.setBold(True)
        label = kind.upper()
        cw = QFontMetrics(chip_f).horizontalAdvance(label) + 20
        tone = TONES[KIND_TONE.get(kind, "neutral")]
        chip = QRectF(r.right() - 20 - cw, r.center().y() - 10, cw, 20)
        p.setFont(chip_f)
        p.setPen(QPen(_c(tone[2]), 1))
        p.setBrush(_c(tone[1]))
        p.drawRoundedRect(chip, 10, 10)
        p.setPen(_c(tone[0]))
        p.drawText(chip, Qt.AlignmentFlag.AlignCenter, label)
        tf = QFont(option.font)
        tf.setPixelSize(14)
        tf.setStrikeOut(done)
        p.setFont(tf)
        p.setPen(_c("text_faint") if done else _c("text_dim") if not reached else _c("text"))
        text = QFontMetrics(tf).elidedText(index.data(Qt.ItemDataRole.DisplayRole), Qt.TextElideMode.ElideRight,
                                           int(chip.left()) - x - 16)
        p.drawText(QRect(x + 4, r.y(), int(chip.left()) - x - 16, r.height()), Qt.AlignmentFlag.AlignVCenter, text)


class RoadmapScreen(LiveBound, QWidget):
    def __init__(self, state: AppState, gd: GameData, engine: EngineFacade, parent=None):
        super().__init__(parent)
        self.state, self.gd, self.engine = state, gd, engine
        self._building = False
        self._open: dict[int, bool] = {}  # band -> expanded, remembers what the user toggled
        self.tree = QTreeWidget()
        self.tree.setHeaderHidden(True)
        self.tree.setRootIsDecorated(False)
        self.tree.setIndentation(0)
        self.tree.setExpandsOnDoubleClick(False)
        self.tree.setAnimated(False)
        self.tree.setMouseTracking(True)
        self.tree.setSelectionMode(QAbstractItemView.SelectionMode.NoSelection)
        self.tree.setVerticalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        self.tree.setFrameShape(QFrame.Shape.NoFrame)
        self.tree.setStyleSheet("QTreeWidget{background:transparent;border:none;outline:0;}")
        self.tree.setItemDelegate(TimelineDelegate(self))
        self.tree.itemClicked.connect(self._on_click)

        self.hint = W.text_label("Your level band is open. Tick unlocks off as you finish them.", "dim")
        self.pill_level = W.StatPill("Level", "-", "gold")
        self.pill_done = W.StatPill("Done", "0 / 0", "neutral")
        self.pill_next = W.StatPill("Next", "-", "info")
        self.banner = W.Banner("error", "")
        self.banner.setVisible(False)
        self.empty = W.EmptyState("roadmap", "No road map data for this class and region yet.")
        self.empty.setVisible(False)

        lay = QVBoxLayout(self)
        lay.setContentsMargins(20, 14, 20, 16)
        lay.setSpacing(10)
        head = QHBoxLayout()
        head.setSpacing(12)
        head.addWidget(W.text_label("Road Map", "title"))
        head.addWidget(self.hint, 1)
        for pill in (self.pill_level, self.pill_next, self.pill_done):
            head.addWidget(pill)
        lay.addLayout(head)
        lay.addWidget(self.banner)
        panel = QFrame()
        panel.setProperty("card", True)
        panel.setAttribute(Qt.WidgetAttribute.WA_StyledBackground, True)
        pl = QVBoxLayout(panel)
        pl.setContentsMargins(8, 8, 8, 8)
        pl.addWidget(self.tree, 1)
        pl.addWidget(self.empty)
        lay.addWidget(panel, 1)
        self.tree.itemChanged.connect(self._on_changed)
        state.buildChanged.connect(self.refresh)
        state.dataChanged.connect(self.refresh)
        self.refresh()

    def level(self) -> int:
        return max(1, self.state.build().level)

    def _on_click(self, item: QTreeWidgetItem, _col: int) -> None:
        if item.parent() is None:
            item.setExpanded(not item.isExpanded())
            info = item.data(0, R_BAND) or {}
            self._open[info.get("band", -1)] = item.isExpanded()

    def refresh(self, *_a) -> None:
        b = self.state.build()
        try:
            items = list(roadmap_mod.roadmap(self.state.gamedata(), b.region, b))
        except Exception as e:  # roadmap module still a stub or broken data
            self.tree.clear()
            self.banner.set_text(f"Road map unavailable: {e}. Check the game data file and reload.")
            self.banner.setVisible(True)
            return
        self.banner.setVisible(False)
        gd = self.state.gamedata()
        lvl = self.level()
        cur_band = (lvl - 1) // BAND
        checked = set(load_user().get("roadmap_checks") or [])
        self._building = True
        try:
            self.tree.clear()
            bands: dict[int, QTreeWidgetItem] = {}
            for it in sorted(items, key=lambda i: i.level):
                band = (max(1, it.level) - 1) // BAND
                top = bands.get(band)
                if top is None:
                    top = QTreeWidgetItem(self.tree, [f"Levels {band * BAND + 1} - {band * BAND + BAND}"])
                    top.setFlags(Qt.ItemFlag.ItemIsEnabled)
                    top.setData(0, R_BAND, {"band": band, "lo": band * BAND + 1, "current": band == cur_band,
                                            "level": lvl, "reached": band * BAND + 1 <= lvl, "first": not bands})
                    top.setExpanded(self._open.get(band, band == cur_band))
                    bands[band] = top
                row = QTreeWidgetItem(top, [it.text])
                row.setFlags(Qt.ItemFlag.ItemIsEnabled | Qt.ItemFlag.ItemIsUserCheckable)
                iid = item_id(it)
                row.setData(0, R_ID, iid)
                row.setData(0, R_LEVEL, it.level)
                row.setData(0, R_KIND, it.kind)
                row.setData(0, R_SKILLS, tuple(skill_keys_in(gd, it.text)) if it.kind == "skill" else ())
                row.setToolTip(0, f"Level {it.level} - {it.kind}: {it.text}")
                row.setCheckState(0, Qt.CheckState.Checked if iid in checked else Qt.CheckState.Unchecked)
        finally:
            self._building = False
        self._update_counts(items, lvl)
        self.empty.setVisible(not items)
        self.tree.setVisible(bool(items))
        if cur_band in bands:
            self.tree.scrollToItem(bands[cur_band], QAbstractItemView.ScrollHint.PositionAtTop)

    def _update_counts(self, items=None, lvl: int | None = None) -> None:
        """Band headers, pills and the next-unlock hint follow the checks."""
        lvl = lvl or self.level()
        done_all = total_all = 0
        for i in range(self.tree.topLevelItemCount()):
            top = self.tree.topLevelItem(i)
            n = top.childCount()
            d = sum(1 for j in range(n) if top.child(j).checkState(0) == Qt.CheckState.Checked)
            info = dict(top.data(0, R_BAND) or {})
            info.update(done=d, total=n)
            top.setData(0, R_BAND, info)
            done_all += d
            total_all += n
        self.pill_level.set_value(str(lvl))
        self.pill_done.set_value(f"{done_all} / {total_all}", "ok" if total_all and done_all == total_all else "neutral")
        nxt = None
        for i in range(self.tree.topLevelItemCount()):
            top = self.tree.topLevelItem(i)
            for j in range(top.childCount()):
                leaf = top.child(j)
                if int(leaf.data(0, R_LEVEL)) > lvl:
                    nxt = nxt or leaf
        if nxt is not None:
            text = nxt.text(0)
            self.pill_next.set_value(f"Lv {nxt.data(0, R_LEVEL)}  {text[:34]}{'...' if len(text) > 34 else ''}")
        else:
            self.pill_next.set_value("nothing further")
        self.tree.viewport().update()

    def _on_changed(self, row: QTreeWidgetItem, _col: int) -> None:
        iid = row.data(0, R_ID)
        if self._building or not iid:
            return
        u = load_user()
        checks = [c for c in (u.get("roadmap_checks") or []) if c != iid]
        if row.checkState(0) == Qt.CheckState.Checked:
            checks.append(iid)
        u["roadmap_checks"] = checks
        save_user(u)
        self._update_counts()
