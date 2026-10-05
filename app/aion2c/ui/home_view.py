"""My Build: the first tab. Hero header (character card + armory import), playstyle cards, your numbers + Optimize,
then the result cards (comparison strip, stigmas, skill points, Daevanion, rotation, trade-offs, next upgrades)."""
import os
import urllib.request
from dataclasses import replace

from PySide6.QtCore import QObject, QRect, QRectF, QRunnable, QSize, Qt, QThreadPool, QTimer, Signal
from PySide6.QtGui import QColor, QPainter, QPainterPath, QPen, QPixmap
from PySide6.QtWidgets import (
    QComboBox,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QInputDialog,
    QLabel,
    QLineEdit,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QSpinBox,
    QVBoxLayout,
    QWidget,
)

import aion2c.armory as armory
import aion2c.settings as user_settings
import aion2c.statsheet as statsheet
from aion2c.classes import class_info, class_name
from aion2c.data.loader import available_classes
from aion2c.interfaces import EngineFacade
from aion2c.models import GameData, Priority, PriorityEntry
from aion2c.state import AppState
from aion2c.ui.icons import pixmap
from aion2c.ui.live import LiveBound
from aion2c.ui.theme import PALETTE, class_color
from aion2c.ui.widgets import (
    Banner,
    Card,
    Chip,
    GhostButton,
    IconTile,
    PrimaryButton,
    SectionHeader,
    StatPill,
    class_emblem,
    icon,
    line_icon,
    text_label,
)


def _status_name(gd: GameData, key: str) -> str:
    st = gd.statuses.get(key)
    return st.name if st else key.replace("_", " ").replace("-", " ").title()


def _skill_name(gd: GameData, key: str) -> str:
    sk = gd.skills.get(key)
    return sk.name if sk else key


def role_text(gd: GameData, entry: PriorityEntry) -> str:
    """One plain-English line for a priority entry, derived from SkillRule data."""
    rule = gd.rules.get(entry.skill_key)
    skill = gd.skills.get(entry.skill_key)
    if rule is None:
        return "filler - cast when nothing better is ready"
    bits: list[str] = []
    req = ([entry.require_status] if entry.require_status else []) + list(rule.requires)
    if req:
        bits.append("spender - needs " + " + ".join(_status_name(gd, r) for r in dict.fromkeys(req)))
    elif rule.applies:
        own = {rule.skill_key, _skill_name(gd, rule.skill_key)}
        gives = [_status_name(gd, a) for a in rule.applies if _status_name(gd, a) not in own]
        bits.append("buff - " + ("gives " + ", ".join(gives) + ", " if gives else "") + "cast when ready")
    elif rule.chain_next:
        bits.append("opener - leads into " + _skill_name(gd, rule.chain_next))
    else:
        bits.append("filler - cast when nothing better is ready")
    if rule.chain_next and not req and rule.applies:
        bits.append("then " + _skill_name(gd, rule.chain_next))
    if rule.charge_levels:
        n = len(rule.charge_levels)
        lvl = entry.charge_level or n
        bits.append("hold to full charge" if lvl >= n else f"charge to level {lvl}")
    if skill is not None and skill.aoe_targets > 1 and len(bits) == 1 and bits[0].startswith("filler"):
        bits[0] = "filler - hits several targets"
    return "; ".join(bits)


FALLBACK_PLAYSTYLES = (
    ("boss", "Boss fight", "Best damage on one big target."),
    ("aoe", "Packs (AoE)", "Best damage against groups of monsters."),
    ("leveling", "Leveling", "Fast, simple clears while you level."),
    ("burst", "Burst", "Biggest damage in a short window."),
)

STYLE_ICONS = {"boss": "sword", "aoe": "bolt", "leveling": "star", "burst": "bolt"}

STAT_NAMES = {
    "attack": "Attack", "attack_increase_pct": "Attack increase", "weapon_dmg_pct": "Weapon damage",
    "dmg_boost_pct": "Damage boost", "pve_dmg_pct": "PvE damage", "boss_dmg_pct": "Boss damage",
    "crit_chance_pct": "Crit chance", "crit_dmg_pct": "Crit damage", "smite_pct": "Smite",
    "combat_speed_pct": "Combat speed", "cdr_pct": "Cooldown reduction", "max_mp": "Max MP",
    "mp_regen_per_s": "MP regen",
}

# Role-aware wording. The engine only models damage, so healers, supports and tanks are told so plainly.
ROLE_TAGLINE = {
    "ranged_dps": "Ranged damage dealer. Keep your distance and keep the rotation rolling.",
    "melee_dps": "Melee damage dealer. Stay on target and keep your skills on cooldown.",
    "tank": "Tank. Hold the line; this planner tunes the damage you deal while you do.",
    "healer": "Healer. This planner tunes your damage skills between heals.",
    "support": "Support. This planner tunes your damage skills between buffs and utility.",
}
ROLE_LABEL = {"ranged_dps": "Ranged DPS", "melee_dps": "Melee DPS", "tank": "Tank", "healer": "Healer", "support": "Support"}
ROLE_ROTATION = {
    "ranged_dps": "Always cast the highest skill on this list that is ready. Keep moving between casts.",
    "melee_dps": "Always use the highest skill on this list that is ready. Stay in melee range and weave your dodges.",
    "tank": "Use the highest skill on this list that is ready whenever you are not needed for defence or taunts.",
    "healer": "Heals and cleanses come first. In the gaps, use the highest skill on this list that is ready.",
    "support": "Keep your buffs and utility up first. In the gaps, use the highest skill on this list that is ready.",
}
ROLE_STYLE_TEXT = {
    "ranged_dps": {"boss": "Sustained single-target damage from range.", "aoe": "Clear packs from a safe distance.",
                   "leveling": "Quick pulls and easy casts while you quest.", "burst": "Everything off cooldown in the first 15 s."},
    "melee_dps": {"boss": "Sustained single-target damage up close.", "aoe": "Cleave through packs of mobs.",
                  "leveling": "Fast, simple clears while you quest.", "burst": "Everything off cooldown in the first 15 s."},
    "tank": {"boss": "Damage you add while holding a boss.", "aoe": "Pull packs and burn them down.",
             "leveling": "Safe, steady pulls while you quest.", "burst": "Opening damage once you have aggro."},
    "healer": {"boss": "Damage between heals on a boss.", "aoe": "Damage against packs when the party is stable.",
               "leveling": "Solo-friendly clears while you quest.", "burst": "A short damage window when heals are not needed."},
    "support": {"boss": "Damage between buffs on a boss.", "aoe": "Damage against packs while buffs are up.",
                "leveling": "Solo-friendly clears while you quest.", "burst": "A short damage window with buffs rolling."},
}
NOT_DPS_NOTE = ("Heals, shields and buffs are not modeled. The numbers here measure your damage output only, "
                "which is what the rotation and upgrade picks are tuned for.")


def _optimizer():
    """Imported lazily so tests (and a half-finished engine) can patch or lack the module."""
    import aion2c.engine.build_optimizer as bo

    return bo


def _playstyles() -> list[tuple[str, str, str]]:
    try:
        ps = _optimizer().PLAYSTYLES
        items = ps.values() if hasattr(ps, "values") else ps
        return [(p.key, p.name, p.description) for p in items]
    except Exception:
        return list(FALLBACK_PLAYSTYLES)


def _role(class_key: str) -> str:
    ci = class_info(class_key)
    return ci.role if ci else "ranged_dps"


def _style_desc(class_key: str, key: str, default: str) -> str:
    return ROLE_STYLE_TEXT.get(_role(class_key), {}).get(key, default)


def _hex(token: str, alpha: int | None = None) -> str:
    c = QColor(PALETTE[token])
    if alpha is not None:
        c.setAlpha(alpha)
        return f"rgba({c.red()},{c.green()},{c.blue()},{alpha})"
    return c.name()


class _Relay(QObject):
    progress = Signal(str)
    done = Signal(object, str)  # FullBuild | None, error text


REGION_CHOICES = (("Auto", None), ("NA East", "nae"), ("NA West", "naw"), ("EU", "eu"),
                  ("South America", "la"), ("Asia", "as"))


class _ImportRelay(QObject):
    searched = Signal(object, str)  # list[dict] | None, error text
    fetched = Signal(object, dict, str)  # raw | None, identity, error text
    portrait = Signal(object, str)  # image bytes | None, url


class _Job(QRunnable):
    def __init__(self, fn):
        super().__init__()
        self.fn = fn

    def run(self) -> None:
        self.fn()


class _Worker(QRunnable):
    def __init__(self, relay: _Relay, fn, args: tuple, kwargs: dict):
        super().__init__()
        self.relay, self.fn, self.args, self.kwargs = relay, fn, args, kwargs

    def run(self) -> None:
        def prog(*a) -> None:
            self.relay.progress.emit(" ".join(str(x) for x in a))

        try:
            res, err = self.fn(*self.args, progress=prog, **self.kwargs), ""
        except Exception as e:
            res, err = None, f"{type(e).__name__}: {e}"
        self.relay.done.emit(res, err)


def _fetch_image(url: str) -> bytes | None:
    """The portrait from the public armory CDN. Never raises; None on any problem. Skipped under pytest (no network)."""
    if not url.startswith("https://") or os.environ.get("PYTEST_CURRENT_TEST"):
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": armory.USER_AGENT})
        with urllib.request.urlopen(req, timeout=8) as r:
            data = r.read(3_000_000)
        return data or None
    except Exception:
        return None


def _hint(text: str, role: str = "caption") -> QLabel:
    lb = text_label(text, role, wrap=True)
    return lb


def _tinted(widget: QWidget, token: str) -> QWidget:
    """Recolour a label's text with a palette token (private QSS; tokens only)."""
    widget.setStyleSheet(f"color:{PALETTE[token]};background:transparent;")
    return widget


class _Portrait(QWidget):
    """Round character portrait with a class-coloured ring. Falls back to the class emblem."""

    def __init__(self, size: int = 96, parent=None):
        super().__init__(parent)
        self._size = size
        self._pm: QPixmap | None = None
        self._emblem: QPixmap | None = None
        self._ring = QColor(PALETTE["gold"])
        self.setFixedSize(size, size)

    def set_class(self, class_key: str) -> None:
        self._ring = class_color(class_key)
        self._emblem = class_emblem(class_key, self._size - 16)
        self.update()

    def set_pixmap(self, pm: QPixmap | None) -> None:
        self._pm = pm
        self.update()

    def paintEvent(self, _e) -> None:
        p = QPainter(self)
        p.setRenderHints(QPainter.RenderHint.Antialiasing | QPainter.RenderHint.SmoothPixmapTransform)
        s = self._size
        inner = QRectF(5, 5, s - 10, s - 10)
        path = QPainterPath()
        path.addEllipse(inner)
        p.fillPath(path, QColor(PALETTE["surface2"]))
        src = self._pm if self._pm is not None and not self._pm.isNull() else self._emblem
        if src is not None and not src.isNull():
            p.save()
            p.setClipPath(path)
            if src is self._pm:
                side = min(src.width(), src.height())
                crop = QRect((src.width() - side) // 2, 0, side, side)  # portraits are head-first: keep the top
                p.drawPixmap(inner.toRect(), src, crop)
            else:
                dpr = src.devicePixelRatio() or 1.0
                w, h = src.width() / dpr, src.height() / dpr
                p.drawPixmap(int((s - w) / 2), int((s - h) / 2), src)
            p.restore()
        pen = QPen(self._ring, 3)
        p.setPen(pen)
        p.drawEllipse(inner)
        p.end()


class _ClassChip(QLabel):
    """Class-coloured capsule (Chip only offers the status tones)."""

    def __init__(self, text: str, class_key: str, parent=None):
        super().__init__(text, parent)
        c = class_color(class_key)
        self.setStyleSheet(
            f"color:{c.lighter(125).name()};background:rgba({c.red()},{c.green()},{c.blue()},45);"
            f"border:1px solid {c.name()};border-radius:11px;padding:2px 11px;font-weight:600;font-size:12px;")
        self.setSizePolicy(QSizePolicy.Policy.Maximum, QSizePolicy.Policy.Fixed)


class _PlaystyleCard(QPushButton):
    """Selectable playstyle card: icon, title, one-line description."""

    def __init__(self, name: str, desc: str, icon_name: str, enabled: bool = True, parent=None):
        super().__init__(parent)
        self.setMinimumHeight(88)
        self.setCursor(Qt.CursorShape.PointingHandCursor if enabled else Qt.CursorShape.ForbiddenCursor)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.setStyleSheet("_PlaystyleCard{text-align:left;padding:0;border-radius:12px;}")
        self._icon_name = icon_name
        lay = QHBoxLayout(self)
        lay.setContentsMargins(14, 10, 14, 10)
        lay.setSpacing(12)
        self.icon_lb = QLabel()
        self.icon_lb.setFixedSize(40, 40)
        self.icon_lb.setAlignment(Qt.AlignmentFlag.AlignCenter)
        col = QVBoxLayout()
        col.setSpacing(2)
        self.title_lb = QLabel(name)
        self.desc_lb = QLabel(desc)
        self.desc_lb.setWordWrap(True)
        for w in (self.icon_lb, self.title_lb, self.desc_lb):
            w.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents)
        col.addStretch(1)
        col.addWidget(self.title_lb)
        col.addWidget(self.desc_lb)
        col.addStretch(1)
        lay.addWidget(self.icon_lb)
        lay.addLayout(col, 1)
        self.setCheckable(enabled)
        self.setEnabled(enabled)
        self.toggled.connect(lambda _c: self._restyle())
        self._restyle()

    def set_texts(self, name: str, desc: str) -> None:
        self.title_lb.setText(name)
        self.desc_lb.setText(desc)

    def _restyle(self) -> None:
        on = self.isChecked()
        off = not self.isEnabled()
        tile_bg = _hex("gold", 40) if on else _hex("surface3")
        tint = "gold_hi" if on else ("text_faint" if off else "text_dim")
        self.icon_lb.setPixmap(line_icon(self._icon_name if not off else "lock", 22, PALETTE[tint]))
        self.icon_lb.setStyleSheet(f"background:{tile_bg};border-radius:10px;")
        title_c = PALETTE["gold_hi"] if on else (PALETTE["text_faint"] if off else PALETTE["text"])
        self.title_lb.setStyleSheet(f"color:{title_c};font-size:14px;font-weight:600;background:transparent;")
        self.desc_lb.setStyleSheet(f"color:{PALETTE['text_faint' if off else 'text_dim']};font-size:11px;background:transparent;")


def _drop_layout(lay) -> None:
    while lay.count():
        it = lay.takeAt(0)
        if it.widget():
            w = it.widget()
            w.setParent(None)
            w.deleteLater()
        elif it.layout():
            _drop_layout(it.layout())


def _divider() -> QFrame:
    f = QFrame()
    f.setFrameShape(QFrame.Shape.VLine)
    f.setFixedWidth(1)
    return f


def _field(label: str, widget: QWidget, hint: str) -> QWidget:
    w = QWidget()
    col = QVBoxLayout(w)
    col.setContentsMargins(0, 0, 0, 0)
    col.setSpacing(4)
    col.addWidget(text_label(label, "dim"))
    col.addWidget(widget)
    w.setToolTip(hint)
    widget.setToolTip(hint)
    return w


def icon_dark(name: str):
    """Icon tinted for a gold button (dark ink)."""
    from PySide6.QtGui import QIcon

    return QIcon(line_icon(name, 22, PALETTE["gold_ink"]))


class HomeView(LiveBound, QWidget):
    panelRequested = Signal()

    def __init__(self, state: AppState, gd: GameData, engine: EngineFacade, parent=None):
        super().__init__(parent)
        self.state, self.gd, self.engine = state, gd, engine
        self.rows: list[QWidget] = []
        self.full = None
        self.fulls: dict = {}
        self.chosen_build = None
        self._opt_gd = None
        self.col_btns: dict[str, QPushButton] = {}
        self.variant_btns: list[QPushButton] = []
        self.selected = "boss"
        self._pool = QThreadPool(self)
        self._pool.setMaxThreadCount(1)
        self._relay = _Relay(self)
        self._relay.progress.connect(self._on_progress)
        self._relay.done.connect(self._on_done)
        self._imp = _ImportRelay(self)
        self._imp.searched.connect(self._on_searched)
        self._imp.fetched.connect(self._on_fetched)
        self._imp.portrait.connect(self._on_portrait)
        self.raw = None
        self._sm: dict | None = None  # armory summary of the imported character, None before an import
        self._portrait_url = ""

        inner = QWidget()
        il = QVBoxLayout(inner)
        il.setContentsMargins(20, 16, 20, 20)
        il.setSpacing(14)

        il.addWidget(self._build_hero())
        il.addWidget(SectionHeader("Playstyle", "What are you optimizing for? You can compare all of them after you press Optimize."))
        self._build_style_row(il)
        il.addWidget(self._build_numbers_card())

        self.char_host = QWidget()
        self.char_lay = QVBoxLayout(self.char_host)
        self.char_lay.setContentsMargins(0, 0, 0, 0)
        il.addWidget(self.char_host)
        self.results_host = QWidget()
        self.strip_lay = QVBoxLayout(self.results_host)
        self.strip_lay.setContentsMargins(0, 0, 0, 0)
        self.strip_lay.setSpacing(10)
        il.addWidget(self.results_host)
        self.detail_host = QWidget()
        self.results_lay = QVBoxLayout(self.detail_host)
        self.results_lay.setContentsMargins(0, 0, 0, 0)
        self.results_lay.setSpacing(14)
        il.addWidget(self.detail_host)
        il.addStretch(1)

        self._sync_from_build()
        state.buildChanged.connect(self._sync_from_build)
        self._gd_shown = gd  # the GameData the rendered results belong to
        state.dataChanged.connect(self._on_data)
        self._refresh_hero()

        self.scroll = scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setWidget(inner)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.addWidget(scroll)

    # hero ---------------------------------------------------------------------------------------------
    def _build_hero(self) -> Card:
        self.hero = Card()
        self.hero.setObjectName("hero")
        row = QHBoxLayout()
        row.setSpacing(22)
        self.portrait = _Portrait(104)
        row.addWidget(self.portrait, 0, Qt.AlignmentFlag.AlignTop)
        col = QVBoxLayout()
        col.setSpacing(8)
        self.hero_name = text_label("My Build", "display")
        self.hero_name.setObjectName("hero_name")
        self.chips_lay = QHBoxLayout()
        self.chips_lay.setSpacing(8)
        self.pills_lay = QHBoxLayout()
        self.pills_lay.setSpacing(8)
        self.hero_tag = text_label("", "dim", wrap=True)
        col.addWidget(self.hero_name)
        col.addLayout(self.chips_lay)
        col.addLayout(self.pills_lay)
        col.addWidget(self.hero_tag)
        col.addStretch(1)
        row.addLayout(col, 3)
        row.addWidget(_divider())
        row.addLayout(self._build_import_block(), 2)
        self.hero.body.addLayout(row)
        return self.hero

    def _wash(self) -> None:
        c = class_color(self.state.class_key())
        self.hero.setStyleSheet(
            "QFrame#hero{background:qlineargradient(x1:0,y1:0,x2:1,y2:0,"
            f"stop:0 rgba({c.red()},{c.green()},{c.blue()},46),stop:0.55 {PALETTE['surface']},stop:1 {PALETTE['surface']});"
            f"border:1px solid {PALETTE['border']};border-radius:14px;}}")

    def _refresh_hero(self) -> None:
        key = self.state.class_key()
        sm = self._sm
        role = _role(key)
        self._wash()
        self.portrait.set_class(key)
        _drop_layout(self.chips_lay)
        _drop_layout(self.pills_lay)
        self.chips_lay.addWidget(_ClassChip(class_name(key), key))
        self.chips_lay.addWidget(Chip(ROLE_LABEL.get(role, role), "neutral"))
        if sm:
            self.hero_name.setText(sm["name"] or "My Build")
            if sm.get("server"):
                self.chips_lay.addWidget(Chip(sm["server"], "info"))
            self.pills_lay.addWidget(StatPill("Level", str(sm["level"] or self.state.build().level), "neutral"))
            self.pills_lay.addWidget(StatPill("Combat power", f"{int(sm['combat_power'] or 0):,}", "gold"))
            if sm.get("item_level"):
                self.pills_lay.addWidget(StatPill("Item level", str(sm["item_level"]), "info"))
        else:
            self.hero_name.setText("My Build")
            self.pills_lay.addWidget(StatPill("Level", str(self.state.build().level), "neutral"))
        self.chips_lay.addStretch(1)
        self.pills_lay.addStretch(1)
        self.hero_tag.setText(
            ROLE_TAGLINE.get(role, "") if sm else
            "Import your character from the armory for a personal build, or just set your numbers below.\n"
            + ROLE_TAGLINE.get(role, ""))
        for k, b in self.style_btns.items():
            b.set_texts(self._style_names.get(k, k.title()), _style_desc(key, k, self._style_descs.get(k, "")))

    def _on_portrait(self, data, url: str) -> None:
        if not data or url != self._portrait_url:
            return
        pm = QPixmap()
        if pm.loadFromData(data):
            self.portrait.set_pixmap(pm)

    # playstyles ---------------------------------------------------------------------------------------
    def _build_style_row(self, il: QVBoxLayout) -> None:
        cards = QHBoxLayout()
        cards.setSpacing(12)
        self.style_btns: dict[str, _PlaystyleCard] = {}
        self._style_names: dict[str, str] = {}
        self._style_descs: dict[str, str] = {}
        ck = self.state.class_key()
        for key, name, desc in _playstyles():
            self._style_names[key], self._style_descs[key] = name, desc
            b = _PlaystyleCard(name, _style_desc(ck, key, desc), STYLE_ICONS.get(key, "sword"))
            b.setAutoExclusive(True)
            b.clicked.connect(lambda _c=False, k=key: self._select(k))
            self.style_btns[key] = b
            cards.addWidget(b, 1)
        self.pvp_btn = _PlaystyleCard("PvP", "Not modeled yet.", "shield", enabled=False)
        cards.addWidget(self.pvp_btn, 1)
        il.addLayout(cards)
        if self.selected not in self.style_btns and self.style_btns:
            self.selected = next(iter(self.style_btns))
        self._select(self.selected)

    # numbers + optimize -------------------------------------------------------------------------------
    def _build_numbers_card(self) -> Card:
        card = Card()
        row = QHBoxLayout()
        row.setSpacing(16)
        self.level = QSpinBox()
        self.skill_points = QSpinBox()
        self.stigma_points = QSpinBox()
        self.dae_points = QSpinBox()
        fields = (
            ("Level", self.level, "Your character level.", False),
            ("Skill points", self.skill_points, "Optional. Blank = use your ranks as entered.", True),
            ("Stigma points", self.stigma_points, "Optional. Blank = keep your current stigmas.", True),
            ("Daevanion points", self.dae_points, "Optional. Blank = leave the board alone.", True),
        )
        for label, sp, hint, blank in fields:
            sp.setRange(1 if label == "Level" else 0, 99 if label == "Level" else 9999)
            sp.setMinimumHeight(38)
            sp.setMinimumWidth(110)
            if blank:
                sp.setSpecialValueText(" ")
            row.addWidget(_field(label, sp, hint), 0, Qt.AlignmentFlag.AlignVCenter)
        row.addStretch(1)
        side = QVBoxLayout()
        side.setSpacing(6)
        self.go_btn = PrimaryButton("Optimize my build")
        self.go_btn.setIcon(icon_dark("bolt"))
        self.go_btn.setIconSize(QSize(22, 22))
        self.go_btn.setMinimumHeight(54)
        self.go_btn.setMinimumWidth(250)
        self.go_btn.setStyleSheet("font-size:16px;")
        self.go_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.go_btn.clicked.connect(self.optimize)
        self.status = text_label("Pick a playstyle, then press Optimize. Nothing is calculated until you do.", "dim", wrap=True)
        self.status.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        self.status.setMaximumWidth(330)
        side.addWidget(self.go_btn)
        side.addWidget(self.status)
        row.addLayout(side)
        card.body.addLayout(row)
        card.body.addWidget(_hint(
            "Optimize starts from your imported ranks and Daevanion nodes. Leave the point boxes blank to keep them as entered."))
        return card

    def _set_status(self, text: str, kind: str = "") -> None:
        self.status.setText(text)
        self.status.setStyleSheet(f"color:{PALETTE[kind]};background:transparent;" if kind else "")

    def _on_data(self) -> None:
        """Class switch / reload: results, strip and the imported-character card belong to the old data."""
        gd = self.state.gamedata()
        if gd is self._gd_shown:
            return
        self._gd_shown = gd
        self.full, self.fulls, self.chosen_build = None, {}, None
        _drop_layout(self.strip_lay)
        _drop_layout(self.char_lay)
        self._clear()
        self.col_btns = {}
        self._sm, self._portrait_url = None, ""
        self.portrait.set_pixmap(None)
        self._refresh_hero()
        self._set_status("Class data changed. Pick a playstyle, then press Optimize.")

    # armory import ------------------------------------------------------------------------------------
    def _build_import_block(self) -> QVBoxLayout:
        saved = user_settings.load_user().get("armory", {})
        col = QVBoxLayout()
        col.setSpacing(8)
        col.addWidget(text_label("Import from armory", "title"))
        top = QHBoxLayout()
        top.setSpacing(8)
        self.arm_name = QLineEdit(saved.get("name", ""))
        self.arm_name.setPlaceholderText("Character name")
        self.arm_name.setMinimumHeight(38)
        self.arm_region = QComboBox()
        for label, code in REGION_CHOICES:
            self.arm_region.addItem(label, code)
        i = self.arm_region.findData(saved.get("region") or None)
        self.arm_region.setCurrentIndex(max(i, 0))
        self.arm_region.setMinimumHeight(38)
        top.addWidget(self.arm_name, 1)
        top.addWidget(self.arm_region)
        col.addLayout(top)
        btns = QHBoxLayout()
        btns.setSpacing(8)
        self.import_btn = QPushButton("Import")
        self.import_btn.setIcon(icon("search"))
        self.import_btn.setMinimumHeight(38)
        self.import_btn.clicked.connect(self.import_character)
        self.arm_name.returnPressed.connect(self.import_character)
        self.refresh_btn = GhostButton("Refresh")
        self.refresh_btn.setIcon(icon("refresh"))
        self.refresh_btn.setMinimumHeight(38)
        self.refresh_btn.setToolTip("Re-import the saved character with one click.")
        self.refresh_btn.setEnabled(bool(saved.get("character_id")))
        self.refresh_btn.clicked.connect(self.refresh_character)
        btns.addWidget(self.import_btn)
        btns.addWidget(self.refresh_btn)
        btns.addStretch(1)
        col.addLayout(btns)
        self.import_status = text_label("", "dim", wrap=True)
        col.addWidget(self.import_status)
        col.addWidget(_hint("Reads NCSoft's public web armory only when you click Import. It never touches the game."))
        col.addStretch(1)
        return col

    def _import_msg(self, text: str, error: bool = False) -> None:
        self.import_status.setText(text)
        self.import_status.setStyleSheet(f"color:{PALETTE['error']};background:transparent;" if error else "")

    def _lock_import(self, busy: bool) -> None:
        self.import_btn.setEnabled(not busy)
        has_saved = bool(user_settings.load_user().get("armory", {}).get("character_id"))
        self.refresh_btn.setEnabled(not busy and has_saved)

    def import_character(self) -> None:
        if not self.import_btn.isEnabled():
            return
        name = self.arm_name.text().strip()
        if not name:
            self._import_msg("Type your character name first.", True)
            return
        region = self.arm_region.currentData()
        self._lock_import(True)
        self._import_msg("Searching the armory...")
        relay = self._imp

        def job():
            try:
                relay.searched.emit(armory.search(name, region), "")
            except Exception as e:
                relay.searched.emit(None, str(e))

        self._pool.start(_Job(job))

    def refresh_character(self) -> None:
        a = user_settings.load_user().get("armory", {})
        if not a.get("character_id") or not self.refresh_btn.isEnabled():
            return
        self._start_fetch(a["character_id"], a["server_id"], a["region"], a.get("name", ""))

    def _pick_match(self, matches: list[dict]) -> dict | None:
        labels = [
            f"{m['name']} - level {m['level']} - {m['serverName']} ({armory.REGION_NAMES.get(m['region'], m['region'])})"
            for m in matches
        ]
        label, ok = QInputDialog.getItem(self, "Which character?", "Several characters match:", labels, 0, False)
        return matches[labels.index(label)] if ok else None

    def _on_searched(self, matches, err: str) -> None:
        if matches is None:
            self._lock_import(False)
            self._import_msg(f"Import failed: {err}", True)
            return
        if not matches:
            self._lock_import(False)
            self._import_msg("No character found with that name. Check the spelling and region.", True)
            return
        pick = matches[0] if len(matches) == 1 else self._pick_match(matches)
        if pick is None:
            self._lock_import(False)
            self._import_msg("Import cancelled.")
            return
        self._start_fetch(pick["characterId"], pick["serverId"], pick["region"], pick["name"])

    def _start_fetch(self, cid: str, sid, region: str, name: str) -> None:
        self._lock_import(True)
        self._import_msg("Downloading character data (a few seconds)...")
        ident = {"name": name, "region": region, "character_id": cid, "server_id": str(sid)}
        relay = self._imp

        def job():
            try:
                relay.fetched.emit(armory.fetch(cid, sid, region), ident, "")
            except Exception as e:
                relay.fetched.emit(None, ident, str(e))

        self._pool.start(_Job(job))

    def _on_fetched(self, raw, ident: dict, err: str) -> None:
        self._lock_import(False)
        if raw is None:
            self._import_msg(f"Import failed: {err}", True)
            return
        self.raw = raw
        notes0: list[str] = []
        key = armory.class_key(raw)
        if key and key != self.state.class_key():
            if key in available_classes():
                self.state.set_class(key)  # screens rebuild; the import below then maps onto the new class
            else:
                notes0.append(f"No game data for {key.title()} yet; staying on {self.state.class_key().title()}.")
        new, notes = armory.to_build(self.state.gamedata(), raw, self.state.build())
        new, notes = statsheet.apply_to_build(new, raw, notes)  # real attack / MP instead of the placeholders
        notes = notes0 + notes
        if new.class_key != self.state.gamedata().class_key:  # imported class has no data: keep build and data in step
            new = replace(new, class_key=self.state.gamedata().class_key)
        self.state.set_build(new)  # buildChanged also refills Level
        ident["name"] = new.name or ident["name"]
        u = user_settings.load_user()
        u["armory"] = ident
        user_settings.save_user(u)
        self.arm_name.setText(ident["name"])
        self.refresh_btn.setEnabled(True)
        self._import_msg("Imported. Press Optimize my build to improve from here.")
        self._render_character(armory.summary(self.gd, raw), notes)
        self._load_portrait(raw)

    def _load_portrait(self, raw: dict) -> None:
        url = str(((raw.get("info") or {}).get("profile") or {}).get("profileImage") or "")
        self._portrait_url = url
        self.portrait.set_pixmap(None)
        if not url:
            return
        relay = self._imp
        self._pool.start(_Job(lambda: relay.portrait.emit(_fetch_image(url), url)))

    def _render_character(self, sm: dict, notes: list[str]) -> None:
        _drop_layout(self.char_lay)
        self._sm = sm
        self._refresh_hero()
        card = Card("Imported details", "Gear, equipped stigmas and Daevanion read from the armory. Expand to see them.",
                    collapsible=True)
        card.setObjectName("char_card")
        cols = QHBoxLayout()
        cols.setSpacing(24)
        gear = QVBoxLayout()
        gear.setSpacing(4)
        gear.addWidget(text_label("Gear", "gold"))
        for g in sm["gear"]:
            ench = f" +{g['enchant']}" if g["enchant"] else ""
            ex = f" (exceed {g['exceed']})" if g["exceed"] else ""
            r = QHBoxLayout()
            slot = text_label(g["slot"], "caption")
            slot.setMinimumWidth(96)
            nm = QLabel(f"{g['name']}{ench}{ex}")
            nm.setStyleSheet(f"color:{self._grade_color(g['grade'])};background:transparent;")
            r.addWidget(slot)
            r.addWidget(nm, 1)
            gear.addLayout(r)
        gear.addStretch(1)
        side = QVBoxLayout()
        side.setSpacing(6)
        side.addWidget(text_label("Equipped stigmas", "gold"))
        for s in sm["stigmas"]:
            r = QHBoxLayout()
            r.setSpacing(10)
            tile = IconTile(pixmap(self.gd, s["key"], 36) if s["key"] else None, 36, None, str(s["rank"]))
            tile.setToolTip(f"{s['name']} rank {s['rank']}")
            r.addWidget(tile)
            r.addWidget(QLabel(f"{s['name']} (rank {s['rank']})"), 1)
            side.addLayout(r)
        side.addSpacing(6)
        side.addWidget(text_label("Daevanion nodes", "gold"))
        for b in sm["daevanion"]:
            side.addWidget(QLabel(f"{b['board']}: {b['matched']} of {b['open']} open nodes"))
        cols.addLayout(gear, 3)
        cols.addLayout(side, 2)
        card.body.addLayout(cols)
        n = text_label("\n".join("- " + t for t in notes), "dim", wrap=True)
        n.setObjectName("import_notes")
        n.setVisible(bool(notes))
        card.body.addWidget(n)
        card.set_expanded(False)
        self.char_lay.addWidget(card)

    @staticmethod
    def _grade_color(grade: str) -> str:
        from aion2c.ui.theme import rarity_color

        return rarity_color(grade).name()

    # building blocks ----------------------------------------------------------------------------------
    def _sync_from_build(self, *_a) -> None:
        b = self.state.build()
        cap = self.state.gamedata().level_caps.get(b.region, 45)
        self.level.setRange(1, cap)
        self.level.setValue(b.level)
        if hasattr(self, "_gd_shown"):
            self._refresh_hero()

    def _select(self, key: str) -> None:
        self.selected = key
        for k, b in self.style_btns.items():
            b.setChecked(k == key)

    def _tile(self, key: str, size: int = 44, badge: str | None = None) -> IconTile:
        t = IconTile(pixmap(self.gd, key, size), size, None, badge)
        t.setToolTip(_skill_name(self.gd, key))
        return t

    # running ------------------------------------------------------------------------------------------
    def optimize(self) -> None:
        if not self.go_btn.isEnabled():
            return
        try:
            bo = _optimizer()
        except Exception as e:
            self._set_status(f"The build optimizer is not available yet ({type(e).__name__}).", "error")
            return
        b = replace(
            self.state.build(),
            level=self.level.value(),
            skill_points=self.skill_points.value() or None,
            stigma_points=self.stigma_points.value() or None,
        )
        kwargs = {"daevanion_points": self.dae_points.value() or None}
        try:
            import aion2c.settings as settings
            from aion2c.state import config_from_settings

            kwargs["cfg"] = config_from_settings(settings.load_user())
        except Exception:
            pass
        self.go_btn.setEnabled(False)
        self._opt_gd = self.state.gamedata()
        self._set_status("Working...")
        self._pool.start(_Worker(self._relay, bo.compare_playstyles, (self.state.gamedata(), b), kwargs))

    def wait(self, ms: int = 30000) -> None:
        self._pool.waitForDone(ms)

    def _on_progress(self, text: str) -> None:
        self._set_status(text)

    def _on_done(self, fulls, err: str) -> None:
        self.go_btn.setEnabled(True)
        if self._opt_gd is not None and self._opt_gd is not self.state.gamedata():
            return  # computed for a class the user has since left
        if not fulls:
            self._set_status(f"Could not optimize: {err or 'no result'}", "error")
            return
        self.fulls = dict(fulls)
        self._set_status("Done. Compare the playstyles below, then press View on one.")
        self._render_strip()
        self._show(self.selected if self.selected in self.fulls else next(iter(self.fulls)))

    def _render_strip(self) -> None:
        _drop_layout(self.strip_lay)
        self.col_btns = {}
        names = {k: n for k, n, _d in _playstyles()}
        self.strip_lay.addWidget(SectionHeader("Compare playstyles", "Each playstyle is measured on its own scenario (boss, packs, pulls, opener), so compare the picks, not the raw numbers."))
        row = QHBoxLayout()
        row.setSpacing(12)
        for key, full in self.fulls.items():
            c = Card(names.get(key, key.title()), hoverable=True)
            c.setObjectName(f"col_{key}")
            dps = full.result.dps
            top = QHBoxLayout()
            d = text_label(f"~{dps:,.0f} DPS", "display")
            d.setStyleSheet("font-size:22px;")
            top.addWidget(d)
            top.addStretch(1)
            c.body.addLayout(top)
            c.body.addWidget(text_label(self._style_descs.get(key, ""), "caption", wrap=True))
            ics = QHBoxLayout()
            ics.setSpacing(6)
            for sk, _g in full.stigma_picks:
                ics.addWidget(self._tile(sk, 40))
            ics.addStretch(1)
            c.body.addLayout(ics)
            c.body.addStretch(1)
            b = QPushButton("View")
            b.setCheckable(True)
            b.setCursor(Qt.CursorShape.PointingHandCursor)
            b.clicked.connect(lambda _c=False, k=key: self._show(k))
            self.col_btns[key] = b
            c.body.addWidget(b)
            row.addWidget(c, 1)
        self.strip_lay.addLayout(row)

    def _show(self, key: str) -> None:
        self.selected = key
        for k, b in self.style_btns.items():
            b.setChecked(k == key)
        for k, b in self.col_btns.items():
            b.setChecked(k == key)
        self.full = self.fulls[key]
        self.chosen_build = self.full.build
        self._render(self.full)
        # The cards render below the fold; without this, View looked like it did nothing.
        # Deferred so the new cards are laid out before scrolling to them.
        QTimer.singleShot(0, lambda: self.scroll.verticalScrollBar().setValue(self.detail_host.y()))

    # results ------------------------------------------------------------------------------------------
    def _clear(self) -> None:
        self.rows = []
        _drop_layout(self.results_lay)

    def _render(self, full) -> None:
        self._clear()
        lay = self.results_lay
        res = full.result
        b = full.build
        role = _role(b.class_key or self.state.class_key())
        names = {k: n for k, n, _d in _playstyles()}
        pkey = getattr(full.playstyle, "key", full.playstyle)  # the engine hands back a Playstyle, fakes a key
        lay.addWidget(SectionHeader(f"Your build: {names.get(pkey, str(pkey).title())}"))
        lay.addWidget(self._hero_result(full, res, role))

        grid = QGridLayout()
        grid.setSpacing(14)
        for c in range(3):
            grid.setColumnStretch(c, 1)
        grid.addWidget(self._stigma_card(full, b), 0, 0)
        grid.addWidget(self._points_card(full), 0, 1)
        grid.addWidget(self._dae_card(full), 0, 2)
        lay.addLayout(grid)

        lay.addWidget(self._rotation_card(full, res, role))

        variants = tuple(getattr(full, "variants", ()) or ())
        self.variant_btns = []
        low = QHBoxLayout()
        low.setSpacing(14)
        if variants:
            low.addWidget(self._variants_card(variants), 3)
        low.addWidget(self._upgrades_card(full), 2)
        lay.addLayout(low)

        act = QHBoxLayout()
        self.apply_note = text_label("", "gold", wrap=True)
        act.addWidget(self.apply_note, 1)
        self.apply_btn = PrimaryButton("Apply this build")
        self.apply_btn.setMinimumHeight(46)
        self.apply_btn.setMinimumWidth(220)
        self.apply_btn.setIcon(icon_dark("check"))
        self.apply_btn.clicked.connect(self.apply)
        act.addWidget(self.apply_btn)
        lay.addLayout(act)

        if full.warnings:
            self.warn_btn = GhostButton(f"Warnings ({len(full.warnings)})")
            self.warn_btn.setCheckable(True)
            self.warn_btn.setIcon(icon("warn"))
            body = Banner("warn", "\n".join("- " + w for w in full.warnings))
            body.hide()
            self.warn_btn.toggled.connect(body.setVisible)
            wl = QHBoxLayout()
            wl.addWidget(self.warn_btn)
            wl.addStretch(1)
            lay.addLayout(wl)
            lay.addWidget(body)

    def _hero_result(self, full, res, role: str) -> Card:
        card = Card()
        row = QHBoxLayout()
        row.setSpacing(20)
        est = res.confidence != "confirmed"
        col = QVBoxLayout()
        col.setSpacing(2)
        dps = text_label(f"~{res.dps:,.0f} DPS" + (" (estimated)" if est else ""), "display")
        dps.setObjectName("dps")
        dps.setStyleSheet(f"font-size:34px;font-weight:700;color:{PALETTE['gold_hi' if not est else 'gold']};")
        col.addWidget(dps)
        col.addWidget(text_label("damage per second on your chosen playstyle" if role.endswith("dps")
                                 else "damage output on your chosen playstyle", "caption"))
        row.addLayout(col)
        row.addStretch(1)
        pills = QHBoxLayout()
        pills.setSpacing(8)
        mid = Qt.AlignmentFlag.AlignVCenter
        pills.addWidget(StatPill("Stigmas", str(len(full.stigma_picks)), "neutral"), 0, mid)
        pills.addWidget(StatPill("Daevanion", f"+{full.daevanion_gain_pct:.1f}%", "info"), 0, mid)
        pills.addWidget(StatPill("Confidence", "estimated" if est else "confirmed", "estimated" if est else "confirmed"), 0, mid)
        row.addLayout(pills)
        card.body.addLayout(row)
        if role not in ("ranged_dps", "melee_dps"):
            card.body.addWidget(Banner("info", NOT_DPS_NOTE))
        if est:
            card.body.addWidget(_hint("Numbers are estimated. Calibrate animation times in Build for confirmed values."))
        return card

    def _stigma_card(self, full, b) -> Card:
        gd = self.gd
        slots = gd.stigma_slots.get(b.region, 0)
        unlocked = sum(
            1 for r in gd.roadmap
            if r.kind == "stigma" and r.level <= b.level and b.region in r.regions and "slot" in r.text.lower()
        )
        c = Card("Stigmas", f"{min(unlocked, slots)} of {slots} slots unlocked at level {b.level}.")
        if not full.stigma_picks:
            c.add(text_label("No stigma changes suggested.", "dim", wrap=True))
        for key, gain in full.stigma_picks:
            row = QHBoxLayout()
            row.setSpacing(12)
            row.addWidget(self._tile(key, 48))
            nm = QLabel(_skill_name(gd, key))
            nm.setObjectName("stigma_name")
            nm.setStyleSheet("font-size:14px;font-weight:600;")
            row.addWidget(nm, 1)
            row.addWidget(Chip(f"+{gain:.1f}% DPS", "ok"))
            c.body.addLayout(row)
        c.body.addStretch(1)
        return c

    def _points_card(self, full) -> Card:
        c = Card("Skill points", "Where the next points do the most.")
        if not full.rank_log:
            c.add(text_label("Using your current ranks. Enter skill points above and press Optimize to see where they go.",
                             "dim", wrap=True))
        for key, rank, gain in full.rank_log[:6]:
            row = QHBoxLayout()
            row.setSpacing(10)
            row.addWidget(self._tile(key, 32))
            nm = QLabel(_skill_name(self.gd, key))
            nm.setStyleSheet("font-weight:600;")
            row.addWidget(nm, 1)
            row.addWidget(Chip(f"rank {rank}", "neutral"))
            row.addWidget(Chip(f"+{gain:.1f}%", "ok"))
            c.body.addLayout(row)
        c.body.addStretch(1)
        return c

    def _dae_card(self, full) -> Card:
        n = len(full.daevanion_path)
        c = Card("Daevanion", "Board nodes in the order to open them.")
        txt = (
            f"Max power: all {n} nodes, +{full.daevanion_gain_pct:.1f}% DPS. Order shown on the board."
            if n else "No Daevanion points to spend."
        )
        if n:
            pr = QHBoxLayout()
            pr.setSpacing(8)
            pr.addWidget(StatPill("Nodes", str(n), "info"))
            pr.addWidget(StatPill("Gain", f"+{full.daevanion_gain_pct:.1f}% DPS", "ok"))
            pr.addStretch(1)
            c.body.addLayout(pr)
        c.add(text_label(txt, "dim", wrap=True))
        c.body.addStretch(1)
        self.show_board_btn = QPushButton("Show on board")
        self.show_board_btn.setIcon(icon("daevanion"))
        self.show_board_btn.clicked.connect(self._show_board)
        c.add(self.show_board_btn)
        return c

    def _rotation_card(self, full, res, role: str) -> Card:
        c = Card("Rotation", ROLE_ROTATION.get(role, ROLE_ROTATION["ranged_dps"]))
        for i, e in enumerate(full.priority.entries, 1):
            self.rows.append(self._row(i, e))
            c.add(self.rows[-1])
        return c

    def _row(self, n: int, e: PriorityEntry) -> QWidget:
        w = QFrame()
        w.setObjectName("rot_row")
        tint = _hex("gold", 26) if n == 1 else (_hex("surface2") if n % 2 == 0 else "transparent")
        w.setStyleSheet(f"QFrame#rot_row{{background:{tint};border-radius:10px;}}")
        h = QHBoxLayout(w)
        h.setContentsMargins(10, 6, 12, 6)
        h.setSpacing(12)
        num = QLabel(str(n))
        num.setFixedSize(30, 30)
        num.setAlignment(Qt.AlignmentFlag.AlignCenter)
        num.setStyleSheet(
            f"background:{_hex('gold', 38)};color:{PALETTE['gold_hi']};border-radius:15px;font-weight:700;font-size:14px;")
        name = QLabel(_skill_name(self.gd, e.skill_key))
        name.setObjectName("skill_name")
        name.setStyleSheet("font-size:15px;font-weight:600;background:transparent;")
        role = text_label(role_text(self.gd, e), "caption")
        col = QVBoxLayout()
        col.setSpacing(0)
        col.addWidget(name)
        col.addWidget(role)
        h.addWidget(num)
        h.addWidget(self._tile(e.skill_key, 44))
        h.addLayout(col, 1)
        if n == 1:
            h.addWidget(Chip("first choice", "gold"))
        return w

    def _variants_card(self, variants) -> Card:
        c = Card("Trade-offs", "A slightly weaker build can be better if it gives you something extra.")
        for v in variants:
            c.body.addWidget(self._variant_row(v))
        return c

    def _variant_row(self, v) -> QWidget:
        w = QFrame()
        w.setObjectName("var_row")
        w.setStyleSheet(f"QFrame#var_row{{background:{_hex('surface2')};border-radius:10px;}}")
        row = QHBoxLayout(w)
        row.setContentsMargins(12, 8, 12, 8)
        row.setSpacing(12)
        col = QVBoxLayout()
        col.setSpacing(1)
        lb = QLabel(v.label)
        lb.setStyleSheet("font-size:14px;font-weight:600;background:transparent;")
        col.addWidget(lb)
        col.addWidget(text_label(v.gives, "caption", wrap=True))
        row.addLayout(col, 1)
        best = v.dps_delta_pct >= -1e-9
        d = QLabel("best DPS" if best else f"{v.dps_delta_pct:+.1f}% DPS")
        d.setObjectName("variant_delta")
        d.setStyleSheet(f"color:{PALETTE['ok' if best else 'warn']};font-weight:700;background:transparent;")
        row.addWidget(d)
        for sk, _g in v.stigma_picks:
            row.addWidget(self._tile(sk, 36))
        b = QPushButton("Use this variant")
        b.setCheckable(True)
        b.clicked.connect(lambda _c=False, vv=v, bb=b: self._use_variant(vv, bb))
        self.variant_btns.append(b)
        row.addWidget(b)
        return w

    def _use_variant(self, v, btn=None) -> None:
        self.chosen_build = v.build
        for b in self.variant_btns:
            b.setChecked(b is btn)
        if hasattr(self, "apply_note"):
            self.apply_note.setText(f"Selected: {v.label}. Press Apply to use it.")

    def _upgrades_card(self, full) -> Card:
        c = Card("Next upgrades", "The stats worth chasing next.")
        for g in full.stat_gains[:3]:
            name = STAT_NAMES.get(g.stat, g.stat.replace("_", " ").title())
            row = QHBoxLayout()
            row.setSpacing(10)
            lb = QLabel(f"{name} {g.delta:+g}")
            lb.setStyleSheet("font-weight:600;")
            row.addWidget(lb, 1)
            est = g.confidence != "confirmed"
            row.addWidget(Chip(("~" if est else "") + f"+{g.dps_gain_pct:.1f}% DPS", "estimated" if est else "ok"))
            c.body.addLayout(row)
        if not full.stat_gains:
            c.add(text_label("No upgrade data.", "dim"))
        c.body.addStretch(1)
        return c

    # actions ------------------------------------------------------------------------------------------
    def _show_board(self) -> None:
        tabs = getattr(self.window(), "tabs", None)
        if tabs is None:
            return
        for i in range(tabs.count()):
            if tabs.tabText(i) == "Daevanion":
                tabs.setCurrentIndex(i)
                return

    def apply(self) -> None:
        if self.full is None:
            return
        self.state.set_build(self.chosen_build or self.full.build)
        self.apply_note.setText("Applied. Build, Daevanion and Keybinds now use this build.")
        self._set_status("Applied.")


__all__ = ["HomeView", "role_text", "Priority"]
