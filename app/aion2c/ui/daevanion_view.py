"""Daevanion screen (P8), styled after the in-game window.

Dark board, shield-shaped metal-bezel nodes: grey = 1pt stat, green = 2pt, blue = 3pt, orange = 4pt
(by rarity Common/Rare/Epic/Unique). Skill nodes show the skill icon. Tabs across the top, one per
board. A side panel shows the hovered node and the running total of every selected node.
"""
import dataclasses

from PySide6.QtCore import QPointF, QRectF, QSize, Qt
from PySide6.QtGui import QBrush, QColor, QFont, QLinearGradient, QPainter, QPainterPath, QPen, QRadialGradient
from PySide6.QtWidgets import (
    QFrame,
    QGraphicsItem,
    QGraphicsScene,
    QGraphicsView,
    QHBoxLayout,
    QLabel,
    QProgressBar,
    QScrollArea,
    QSpinBox,
    QTabBar,
    QVBoxLayout,
    QWidget,
)

import aion2c.daevanion as dv
from aion2c.interfaces import EngineFacade
from aion2c.models import STAT_MAP, DaevanionBoard, DaevanionNode, GameData
from aion2c.state import AppState
from aion2c.ui import icons
from aion2c.ui.live import LiveBound
from aion2c.ui.theme import PALETTE, RARITY, class_color
from aion2c.ui.widgets import Card, Chip, GhostButton, PrimaryButton, class_emblem, icon, set_role, text_label

CELL = 56
NODE = 46
BG = QColor(PALETTE["bg"])
GOLD = QColor(PALETTE["gold"])
GOLD_HI = QColor(PALETTE["gold_hi"])
INK = QColor("#070b16")


def _rar(rarity: str | None) -> QColor:
    return QColor(RARITY.get(rarity or "Common", RARITY["Common"]))


# rarity -> chip tone for the detail card
_TONE = {"Common": "neutral", "Rare": "ok", "Epic": "info", "Unique": "warn"}
_NAMES = {"Common": "Stat (1 pt)", "Rare": "Passive (2 pt)", "Epic": "Skill / major (3 pt)", "Unique": "Unique (4 pt)"}
_OFFENSE = {"Attack Bonus", "Critical Hit", "Critical Damage Boost", "Damage Boost", "Multi-hit Chance",
            "Combat Speed", "Cooldown Reduction", "Penetration", "Status Effect Chance"}
_ABBR = {
    "Attack Bonus": "ATK", "Critical Hit": "Crit", "Critical Damage Boost": "CDmg", "Damage Boost": "Dmg",
    "Multi-hit Chance": "Multi", "Combat Speed": "Spd", "Cooldown Reduction": "CDR", "Penetration": "Pen",
    "Status Effect Chance": "Status", "HP": "HP", "MP": "MP", "Defense Bonus": "DEF",
    "Critical Hit Resist": "CRes", "Critical Damage Tolerance": "CTol", "Damage Tolerance": "Tol",
    "Multi-hit Resist": "MRes", "Status Effect Resist": "SRes",
}
HINT = "Click a glowing node next to your path to take it; click a picked end node to give the point back."


def node_category(node: DaevanionNode) -> str:
    if node.node_type == "start":
        return "start"
    if node.skill_key or node.node_type == "skill":
        return "skill"
    if dv.is_pvp_only(node):
        return "pvp"
    stats = {e.stat for e in node.effects}
    if stats & _OFFENSE:
        return "offense"
    return "defense"


def _abbr(stat: str) -> str:
    if stat.startswith("PvP "):
        return "PvP " + _ABBR.get(stat[4:], stat[4:])
    return _ABBR.get(stat, stat[:5])


def _fmt(value: float, unit: str) -> str:
    return f"{value:+g}" + ("" if unit in ("flat", "") else unit)


def node_label(node: DaevanionNode) -> str:
    """Short text for a stat node, e.g. 'ATK+3'. Empty for skill/start nodes."""
    if not node.effects or node.skill_key:
        return ""
    e = node.effects[0]
    return f"{_abbr(e.stat)}{_fmt(e.value, e.unit)}"


def node_tooltip(node: DaevanionNode) -> str:
    lines = [node.name, f"Rarity: {node.rarity or 'n/a'}   Cost: {node.cost} pt"]
    for e in node.effects:
        if node.skill_key:
            lines.append(f"{e.stat}: skill level +{e.value:g} (simulated)")
            continue
        field, _m, conf = STAT_MAP.get(e.stat, ("", 0.0, "unknown"))
        if field:
            lines.append(f"{e.stat} {_fmt(e.value, e.unit)}   [{conf}, simulated as {field}]")
        else:
            lines.append(f"{e.stat} {_fmt(e.value, e.unit)}   [{conf}, not simulated yet]")
    return "\n".join(lines)


def stat_totals(gd: GameData, selected: frozenset[int]) -> list[str]:
    """Human lines for everything the selected nodes grant, e.g. 'Attack Bonus +45', 'Hellfire +1 lv'."""
    idx = dv._node_index(gd)
    sums: dict[tuple[str, str], float] = {}
    for nid in selected:
        node = idx.get(nid)
        if node is None or node.skill_key:
            continue
        for e in node.effects:
            k = (e.stat, "" if e.unit in ("flat", "") else e.unit)
            sums[k] = sums.get(k, 0.0) + e.value
    lines = [f"{s} {_fmt(v, u)}" for (s, u), v in sorted(sums.items())]
    for key, n in sorted(dv.skill_bonus(gd, selected).items()):
        sk = gd.skills.get(key)
        lines.append(f"{sk.name if sk else key} +{n} lv")
    return lines


def _font(px: int, bold: bool = True) -> QFont:
    f = QFont()
    f.setPixelSize(px)
    f.setBold(bold)
    return f


def _shield(r: QRectF) -> QPainterPath:
    p = QPainterPath()
    c = r.width() * 0.22
    p.moveTo(r.left() + c, r.top())
    p.lineTo(r.right() - c, r.top())
    p.quadTo(r.right(), r.top(), r.right(), r.top() + c)
    p.lineTo(r.right(), r.bottom() - c * 0.9)
    p.lineTo(r.center().x(), r.bottom())
    p.lineTo(r.left(), r.bottom() - c * 0.9)
    p.lineTo(r.left(), r.top() + c)
    p.quadTo(r.left(), r.top(), r.left() + c, r.top())
    return p


def _rune(p: QPainter, rarity: str, r: QRectF, color: QColor) -> None:
    """Rune glyph per tier, drawn with lines (no font dependency)."""
    p.setPen(QPen(color, 2.0, Qt.SolidLine, Qt.RoundCap, Qt.RoundJoin))
    p.setBrush(Qt.NoBrush)
    cx, cy, h = r.center().x(), r.top() + r.height() * 0.36, r.height() * 0.17
    if rarity == "Rare":  # U with a stem
        path = QPainterPath(QPointF(cx - h * .6, cy - h))
        path.lineTo(cx - h * .6, cy + h * .3)
        path.quadTo(cx, cy + h * 1.1, cx + h * .6, cy + h * .3)
        path.lineTo(cx + h * .6, cy - h)
        p.drawPath(path)
        p.drawLine(QPointF(cx, cy - h * 1.2), QPointF(cx, cy + h * .6))
    elif rarity == "Epic":  # sigma
        path = QPainterPath(QPointF(cx + h * .7, cy - h))
        path.lineTo(cx - h * .7, cy - h)
        path.lineTo(cx, cy)
        path.lineTo(cx - h * .7, cy + h)
        path.lineTo(cx + h * .7, cy + h)
        p.drawPath(path)
    elif rarity == "Unique":  # rune with triangle
        p.drawLine(QPointF(cx - h * .5, cy - h), QPointF(cx - h * .5, cy + h))
        p.drawPolyline([QPointF(cx - h * .5, cy - h * .6), QPointF(cx + h * .7, cy - h * .1),
                        QPointF(cx - h * .5, cy + h * .4)])
    else:  # grey: two strokes with a zig-zag
        p.drawLine(QPointF(cx - h * .7, cy - h), QPointF(cx - h * .3, cy + h))
        p.drawLine(QPointF(cx + h * .3, cy - h), QPointF(cx + h * .7, cy + h))
        p.drawPolyline([QPointF(cx - h * .7, cy - h * .2), QPointF(cx, cy + h * .4), QPointF(cx + h * .7, cy - h * .2)])


def _pill(p: QPainter, rect: QRectF, text: str, fg: QColor, px: int = 9, bg: QColor | None = None) -> None:
    p.setPen(Qt.NoPen)
    p.setBrush(bg or QColor(7, 11, 22, 215))
    p.drawRoundedRect(rect, rect.height() / 2, rect.height() / 2)
    p.setFont(_font(px))
    p.setPen(fg)
    p.drawText(rect, Qt.AlignCenter, text)


class NodeItem(QGraphicsItem):
    def __init__(self, view: "DaevanionView", node: DaevanionNode, kind: str, order: int = 0):
        super().__init__()
        self.view, self.node, self.kind, self.order = view, node, kind, order
        self.cat = node_category(node)
        self.text = node_label(node)
        self.setPos(node.x * CELL, node.y * CELL)
        self.setToolTip(node_tooltip(node))
        self.setAcceptHoverEvents(True)
        self.setCursor(Qt.PointingHandCursor if kind in ("selectable", "selected") else Qt.ArrowCursor)
        self.setZValue(1)
        if kind == "locked":
            self.setOpacity(0.5)

    def boundingRect(self):  # noqa: N802
        return QRectF(-10, -10, NODE + 20, NODE + 20)

    def paint(self, p: QPainter, _opt, _w=None):  # noqa: N802
        p.setRenderHint(QPainter.Antialiasing)
        r = QRectF(0, 0, NODE, NODE)
        if self.cat == "start":
            self._paint_start(p, r)
            return
        rarity = self.node.rarity or "Common"
        base = _rar(rarity)
        lit = self.kind == "selected"
        live = lit or self.kind == "selectable"
        if live:  # soft halo
            halo = QRadialGradient(r.center(), NODE * 0.85)
            hc = QColor(GOLD_HI if lit else GOLD)
            hc.setAlpha(120 if lit else 70)
            halo.setColorAt(0.55, hc)
            hc.setAlpha(0)
            halo.setColorAt(1.0, hc)
            p.setPen(Qt.NoPen)
            p.setBrush(halo)
            p.drawEllipse(r.center(), NODE * 0.85, NODE * 0.85)
        # metal bezel in the rarity colour
        bez = QLinearGradient(r.topLeft(), r.bottomLeft())
        bez.setColorAt(0, base.lighter(125) if live else base.darker(130))
        bez.setColorAt(1, base.darker(190) if live else base.darker(260))
        p.setPen(QPen(INK, 1))
        p.setBrush(bez)
        p.drawPath(_shield(r))
        # inner face
        face = QLinearGradient(r.topLeft(), r.bottomLeft())
        top = base.darker(300 if not lit else 190)
        face.setColorAt(0, top.lighter(120))
        face.setColorAt(1, top.darker(160))
        p.setPen(Qt.NoPen)
        p.setBrush(face)
        p.drawPath(_shield(r.adjusted(3.5, 3.5, -3.5, -3.5)))
        if self.cat == "skill":
            pm = icons.pixmap(self.view.gd, self.node.skill_key or "", NODE - 20)
            p.drawPixmap(int((NODE - pm.width()) / 2), 5, pm)
            _pill(p, QRectF(7, NODE - 18, NODE - 14, 12), "+1 lv", GOLD_HI)
        else:
            _rune(p, rarity, r, GOLD_HI if lit else (GOLD if live else base.lighter(150)))
            if self.text:
                _pill(p, QRectF(4, NODE - 18, NODE - 8, 12), self.text,
                      QColor(PALETTE["text"]) if live else QColor(PALETTE["text_dim"]), 7)
        p.setBrush(Qt.NoBrush)
        if self.kind == "selectable":
            p.setPen(QPen(GOLD, 1.6, Qt.DashLine))
            p.drawPath(_shield(r.adjusted(-3, -3, 3, 3)))
        elif lit:
            p.setPen(QPen(GOLD_HI, 2))
            p.drawPath(_shield(r.adjusted(-1, -1, 1, 1)))
        if self.order:
            badge = QRectF(NODE - 12, -8, 20, 20)
            p.setBrush(GOLD)
            p.setPen(QPen(INK, 1.2))
            p.drawEllipse(badge)
            p.setFont(_font(10 if self.order < 100 else 8))
            p.setPen(QColor(PALETTE["gold_ink"]))
            p.drawText(badge, Qt.AlignCenter, str(self.order))

    def _paint_start(self, p: QPainter, r: QRectF) -> None:
        cc = class_color(self.view.gd.class_key)
        glow = QRadialGradient(r.center(), NODE * 0.9)
        gc = QColor(cc)
        gc.setAlpha(110)
        glow.setColorAt(0.5, gc)
        gc.setAlpha(0)
        glow.setColorAt(1, gc)
        p.setPen(Qt.NoPen)
        p.setBrush(glow)
        p.drawEllipse(r.center(), NODE * 0.9, NODE * 0.9)
        g = QLinearGradient(r.topLeft(), r.bottomLeft())
        g.setColorAt(0, cc.lighter(130))
        g.setColorAt(1, cc.darker(240))
        p.setPen(QPen(GOLD_HI, 1.8))
        p.setBrush(g)
        p.drawPath(_shield(r.adjusted(-3, -3, 3, 3)))
        p.setPen(Qt.NoPen)
        p.setBrush(QColor(7, 11, 22, 200))
        p.drawPath(_shield(r.adjusted(5, 5, -5, -5)))
        p.setFont(_font(9))
        p.setPen(GOLD_HI)
        p.drawText(r.adjusted(0, -2, 0, -2), Qt.AlignCenter, "START")

    def hoverEnterEvent(self, ev):  # noqa: N802
        self.view.show_node(self.node)

    def mousePressEvent(self, ev):  # noqa: N802
        if ev.button() == Qt.LeftButton:
            self.view.toggle(self.node.id)
            self.view.show_node(self.node)


class DaevanionView(LiveBound, QWidget):
    def __init__(self, state: AppState, gd: GameData, engine: EngineFacade, parent=None):
        super().__init__(parent)
        self.state, self.gd, self.engine = state, gd, engine
        self._gd_shown = gd
        self._keys = list(gd.daevanion)
        self._order: list[int] = []  # pick order (clicks and Max power path)
        self._shown: DaevanionNode | None = None
        self._items: dict[int, NodeItem] = {}

        self.tabs = QTabBar()
        self.tabs.setExpanding(False)
        self.tabs.setDrawBase(False)
        self.tabs.setIconSize(QSize(18, 18))
        for k in self._keys:
            self.tabs.addTab(k)
        self.points_label = QLabel()
        set_role(self.points_label, "title")
        self.points_bar = QProgressBar()
        self.points_bar.setTextVisible(False)
        self.points_bar.setFixedHeight(8)
        self.budget = QSpinBox()
        self.budget.setRange(0, 5000)
        # Real pool per level isn't published; default to every point on every board (the max-power
        # assumption My Build uses) so an applied build never shows as over budget.
        self.budget.setValue(self._full_pool(gd))
        self.budget.setToolTip("Daevanion points you have to spend. Default = all boards complete; "
                               "set your real number to see a limited path.")
        self.suggest_btn = PrimaryButton("Max power path")
        self.clear_btn = GhostButton("Clear board")
        self.result_label = text_label("", "", wrap=True)
        self.result_label.setStyleSheet(f"color:{PALETTE['warn']};")
        self.detail = QLabel()
        self.detail.setWordWrap(True)
        self.detail.setTextFormat(Qt.RichText)
        self.detail.setAlignment(Qt.AlignTop | Qt.AlignLeft)
        self.detail.setMinimumHeight(92)
        self.node_chips = QHBoxLayout()
        self.node_chips.setSpacing(6)
        self.totals = QLabel()
        self.totals.setWordWrap(True)
        self.totals.setTextFormat(Qt.RichText)
        self.totals.setAlignment(Qt.AlignTop | Qt.AlignLeft)
        self.hint = text_label(HINT, "caption", wrap=True)

        self.scene = QGraphicsScene(self)
        self.scene.setBackgroundBrush(QBrush(BG))
        self.gview = QGraphicsView(self.scene)
        self.gview.setRenderHint(QPainter.Antialiasing)
        self.gview.setFrameShape(QFrame.NoFrame)
        self.board_card = Card()
        self.board_card.body.setContentsMargins(0, 0, 0, 0)
        self.board_card.layout().setContentsMargins(2, 2, 2, 2)
        self.board_card.add(self.gview, 1)

        # header: class emblem, title, legend
        self.emblem = QLabel()
        self.class_chip = Chip("", "gold")
        head = QHBoxLayout()
        head.setSpacing(12)
        head.addWidget(self.emblem)
        head.addWidget(text_label("Daevanion", "display"))
        head.addWidget(self.class_chip, 0, Qt.AlignVCenter)
        head.addStretch(1)
        self.legend = QLabel()
        self.legend.setTextFormat(Qt.RichText)
        head.addWidget(self.legend)

        pts = Card("Points")
        row = QHBoxLayout()
        row.addWidget(self.points_label, 1)
        row.addWidget(text_label("Pool", "dim"))
        row.addWidget(self.budget)
        pts.body.addLayout(row)
        pts.add(self.points_bar)
        node = Card("Node")
        node.body.addLayout(self.node_chips)
        node.add(self.detail)
        tot = Card("Total gained", "All boards")
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setWidget(self.totals)
        scroll.setStyleSheet("QScrollArea,QScrollArea>QWidget>QWidget{background:transparent;}")
        tot.add(scroll, 1)
        acts = QVBoxLayout()
        acts.setSpacing(8)
        acts.addWidget(self.suggest_btn)
        acts.addWidget(self.clear_btn)
        side = QVBoxLayout()
        side.setSpacing(12)
        side.setContentsMargins(0, 0, 0, 0)
        side.addWidget(pts)
        side.addWidget(node)
        side.addWidget(tot, 1)
        side.addWidget(self.result_label)
        side.addLayout(acts)
        side.addWidget(self.hint)
        panel = QWidget()
        panel.setLayout(side)
        panel.setFixedWidth(330)

        body = QHBoxLayout()
        body.setSpacing(16)
        body.addWidget(self.board_card, 1)
        body.addWidget(panel)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(20, 16, 20, 16)
        lay.setSpacing(10)
        lay.addLayout(head)
        lay.addWidget(self.tabs)
        lay.addLayout(body, 1)
        self._style_class()

        self.tabs.currentChanged.connect(self._on_tab)
        self.budget.valueChanged.connect(lambda _v: self._refresh())
        self.suggest_btn.clicked.connect(self.suggest)
        self.clear_btn.clicked.connect(self.clear_board)
        state.buildChanged.connect(self._refresh)
        state.dataChanged.connect(self._on_data)
        self._refresh()

    @staticmethod
    def _full_pool(gd: GameData) -> int:
        return sum(n.cost for br in gd.daevanion.values() for n in br.nodes.values())

    def _on_data(self) -> None:
        """New GameData (class switch or reload): rebuild the board tabs and the pool; same object = no-op."""
        gd = self.state.gamedata()
        if gd is self._gd_shown:
            return
        self._gd_shown = gd
        self._keys = list(gd.daevanion)
        self._order, self._shown = [], None
        self.tabs.blockSignals(True)
        while self.tabs.count():
            self.tabs.removeTab(0)
        for k in self._keys:
            self.tabs.addTab(k)
        self.tabs.blockSignals(False)
        self.budget.blockSignals(True)
        self.budget.setValue(self._full_pool(gd))
        self.budget.blockSignals(False)
        self._style_class()
        self._refresh()

    def _style_class(self) -> None:
        """Class-aware header: emblem, class chip and rarity legend follow the current GameData."""
        from aion2c.classes import class_name

        key = self.state.gamedata().class_key
        self.emblem.setPixmap(class_emblem(key, 44))
        try:
            name = class_name(key)
        except Exception:
            name = key.title()
        self.class_chip.setText(name)
        self.legend.setText("&nbsp;&nbsp;&nbsp;".join(
            f'<span style="color:{RARITY[r]}">&#9670;</span> <span style="color:{PALETTE["text_dim"]}">{lbl}</span>'
            for r, lbl in _NAMES.items()))

    # -- helpers --
    def board(self) -> DaevanionBoard | None:
        i = self.tabs.currentIndex()
        return self.gd.daevanion.get(self._keys[i]) if 0 <= i < len(self._keys) else None

    def _selected(self) -> frozenset[int]:
        return self.state.build().daevanion_nodes

    def _unlocked(self, board: DaevanionBoard) -> bool:
        return self.state.build().level >= board.unlock_level

    def _on_tab(self, _i: int) -> None:
        self._shown = None
        self._refresh()

    def _set_nodes(self, nodes: frozenset[int]) -> None:
        self.state.set_build(dataclasses.replace(self.state.build(), daevanion_nodes=nodes))

    def _fit(self) -> None:
        if not self.scene.sceneRect().isEmpty():
            self.gview.fitInView(self.scene.sceneRect(), Qt.KeepAspectRatio)

    def resizeEvent(self, ev):  # noqa: N802
        super().resizeEvent(ev)
        self._fit()

    def showEvent(self, ev):  # noqa: N802
        super().showEvent(ev)
        self._fit()

    # -- actions --
    def toggle(self, node_id: int) -> bool:
        """Select a selectable node or deselect one that keeps the rest valid. True if changed."""
        board = self.board()
        sel = self._selected()
        if board is None or node_id not in board.nodes or node_id == board.start_id:
            return False
        if node_id in sel:
            new = sel - {node_id}
            if not dv.valid(board, new & set(board.nodes)):
                return False
        else:
            if not self._unlocked(board) or node_id not in dv.selectable(board, sel):
                return False
            new = sel | {node_id}
            self._order.append(node_id)
        self._set_nodes(new)
        return True

    def clear_board(self) -> None:
        board = self.board()
        if board:
            self._set_nodes(self._selected() - set(board.nodes))

    def suggest(self) -> None:
        """Select the full max-power path over every unlocked board, within the point pool."""
        pri = self.state.best_priority()
        if pri is None:
            self.result_label.setText("No priority yet: wait for results, then try again.")
            return
        keys = [k for k, b in self.gd.daevanion.items() if self._unlocked(b)]
        spent = dv.points_spent(self.gd, self._selected())
        path, gain = dv.suggest_path(
            self.gd, self.state.build(), pri, self.state.scenario(),
            max(0, self.budget.value() - spent), keys,
        )
        self._order.extend(path)
        self._set_nodes(self._selected() | frozenset(path))
        self.result_label.setText(f"Max power path: +{len(path)} nodes, +{gain:.2f}% DPS")

    # -- side panel --
    def show_node(self, node: DaevanionNode | None) -> None:
        self._shown = node
        self._update_detail()

    def _update_detail(self) -> None:
        n = self._shown
        while self.node_chips.count():
            it = self.node_chips.takeAt(0)
            if it.widget():
                it.widget().deleteLater()
        if n is None:
            self.detail.setText(f'<span style="color:{PALETTE["text_faint"]}">Hover a node to see its details.</span>')
            return
        sel = self._selected()
        board = self.board()
        if board and n.id == board.start_id:
            state, tone = "Start", "gold"
        elif n.id in sel:
            state, tone = "Selected", "gold"
        elif board and self._unlocked(board) and n.id in dv.selectable(board, sel):
            state, tone = "Available", "info"
        else:
            state, tone = "Locked", "unknown"
        if n.cost:
            self.node_chips.addWidget(Chip(_NAMES.get(n.rarity or "", n.rarity or ""), _TONE.get(n.rarity or "", "neutral")))
        self.node_chips.addWidget(Chip(state, tone))
        self.node_chips.addStretch(1)
        col = _rar(n.rarity).lighter(125).name()
        parts = [f'<b style="color:{col};font-size:15px">{n.name}</b>']
        for e in n.effects:
            if n.skill_key:
                parts.append(f"{e.stat}: skill level {e.value:+g}")
            else:
                parts.append(f'{e.stat} <b style="color:{PALETTE["gold_hi"]}">{_fmt(e.value, e.unit)}</b>')
        self.detail.setText("<br>".join(parts))

    # -- drawing --
    def _refresh(self) -> None:
        board = self.board()
        sel = self._selected()
        self._order = [n for n in self._order if n in sel]
        order = {n: i for i, n in enumerate(self._order, 1)}
        self.scene.clear()
        self._items = {}
        spent = dv.points_spent(self.gd, sel)
        for i, k in enumerate(self._keys):
            b = self.gd.daevanion[k]
            used = sum(n.cost for nid, n in b.nodes.items() if nid in sel)
            total = sum(n.cost for n in b.nodes.values())
            locked = not self._unlocked(b)
            self.tabs.setTabText(i, f"{b.name}\n" + (f"Lv {b.unlock_level}" if locked else f"{used}/{total}"))
            self.tabs.setTabIcon(i, icon("lock" if locked else "daevanion", 18))
            self.tabs.setTabTextColor(i, QColor(PALETTE["text_faint"]) if locked else QColor())
        pool = self.budget.value()
        over = pool and spent > pool
        self.points_label.setText(f"Used {spent} / {pool}")
        self.points_label.setStyleSheet(f"color:{PALETTE['warn' if over else 'gold']};")
        self.points_bar.setRange(0, max(1, pool))
        self.points_bar.setValue(min(spent, max(1, pool)))
        self.totals.setText(
            "<br>".join(stat_totals(self.gd, sel))
            or f'<span style="color:{PALETTE["text_faint"]}">Nothing selected yet.</span>')
        if board is None:
            return
        can = dv.selectable(board, sel) if self._unlocked(board) else set()
        self._add_edges(board, sel)
        for nid, node in board.nodes.items():
            if nid == board.start_id:
                kind = "start"
            elif nid in sel:
                kind = "selected"
            elif nid in can:
                kind = "selectable"
            else:
                kind = "locked"
            item = NodeItem(self, node, kind, order.get(nid, 0) if kind == "selected" else 0)
            self.scene.addItem(item)
            self._items[nid] = item
        self.scene.setSceneRect(self.scene.itemsBoundingRect().adjusted(-14, -14, 14, 14))
        if self._shown and self._shown.id not in board.nodes:
            self._shown = None
        self._update_detail()
        self._fit()

    def _add_edges(self, board: DaevanionBoard, sel: frozenset[int]) -> None:
        """Faint links between adjacent nodes; gold where both ends are taken (start counts as taken)."""
        idle, lit = QPainterPath(), QPainterPath()
        half = NODE / 2
        for nid, node in board.nodes.items():
            for other in node.adjacent:
                o = board.nodes.get(other)
                if o is None or other < nid:
                    continue
                path = lit if all(x in sel or x == board.start_id for x in (nid, other)) else idle
                path.moveTo(node.x * CELL + half, node.y * CELL + half)
                path.lineTo(o.x * CELL + half, o.y * CELL + half)
        for path, col, w in ((idle, QColor(PALETTE["border"]), 2.0), (lit, GOLD, 3.0)):
            it = self.scene.addPath(path, QPen(col, w, Qt.SolidLine, Qt.RoundCap))
            it.setZValue(0)
