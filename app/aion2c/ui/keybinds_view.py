"""Keybinds screen (P7): skill bar, macro keys/delay, generated plan, copy/save instructions.

The app only computes and displays; the player types the result into the game by hand.
"""
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QAbstractItemView,
    QApplication,
    QFileDialog,
    QFormLayout,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QPlainTextEdit,
    QScrollArea,
    QSizePolicy,
    QSpinBox,
    QStackedWidget,
    QTableWidget,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

import aion2c.keybinds.export as kb_export
from aion2c.data.loader import allowed_skills
from aion2c.interfaces import EngineFacade
from aion2c.keybinds.layout import is_manual
from aion2c.models import KEY_LABELS, SCENARIOS, GameData, SkillBar, SkillKind
from aion2c.settings import load_user, save_user
from aion2c.state import AppState
from aion2c.ui import icons
from aion2c.ui.build_planner import cfg_from_settings
from aion2c.ui.kb_widgets import CardList, KeyboardWidget, MacroCard
from aion2c.ui.live import LiveBound
from aion2c.ui.widgets import Banner, Card, Chip, EmptyState, GhostButton, PrimaryButton, class_emblem, icon, text_label

_CASTABLE = (SkillKind.ACTIVE, SkillKind.STIGMA, SkillKind.PASSIVE)
STEPS = ("Match the hotbar to your game", "Generate the plan", "Follow the instruction sheet")


def _item(text: str, tip: str = ""):
    from PySide6.QtWidgets import QTableWidgetItem

    it = QTableWidgetItem(text)
    if tip:
        it.setToolTip(tip)
    it.setFlags(it.flags() & ~Qt.ItemFlag.ItemIsEditable)
    return it


def _table(headers: list[str], widths: tuple[int, ...]) -> QTableWidget:
    t = QTableWidget(0, len(headers))
    t.setHorizontalHeaderLabels(headers)
    t.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
    t.setAlternatingRowColors(True)
    t.verticalHeader().setVisible(False)
    t.setSelectionBehavior(QAbstractItemView.SelectRows)
    for i, px in enumerate(widths):
        t.setColumnWidth(i, px)
    t.horizontalHeader().setStretchLastSection(True)
    return t


def _scroll(w: QWidget) -> QScrollArea:
    sc = QScrollArea()
    sc.setWidgetResizable(True)
    sc.setFrameShape(QFrame.NoFrame)
    sc.setWidget(w)
    sc.setStyleSheet("QScrollArea,QScrollArea>QWidget>QWidget{background:transparent;}")
    return sc


DEFAULT_ROWS = 12


class KeybindsScreen(LiveBound, QWidget):
    def __init__(self, state: AppState, gd: GameData, engine: EngineFacade, parent=None):
        super().__init__(parent)
        self.state, self.gd, self.engine = state, gd, engine
        self._building = False
        self._plan = None
        self._markdown = ""
        self._bar_sig: tuple | None = None
        self._build_ui()
        self._bar_class = gd.class_key  # whose hotbar user.json["skill_bar"] currently holds
        state.buildChanged.connect(self.refresh_bar)
        state.dataChanged.connect(self._on_data)
        state.resultsReady.connect(self.refresh_bar)
        self.refresh_bar()

    def _gd(self) -> GameData:
        return self.state.gamedata()

    def _on_data(self, *_a) -> None:
        """Class switch: park the old class's hotbar in user.json["skill_bars"], load the new one's, drop the plan."""
        cls = self._gd().class_key
        if cls != self._bar_class:
            u = load_user()
            bars = u.setdefault("skill_bars", {})
            bars[self._bar_class] = u.get("skill_bar") or {}
            u["skill_bar"] = bars.get(cls) or {}
            save_user(u)
            self._bar_class, self._bar_sig, self._plan, self._markdown = cls, None, None, ""
            self.macro_cards.clear()
            for t in (self.stacks, self.gkeys, self.dps):
                t.setRowCount(0)
            for w in (self.manual, self.warnings, self.preview):
                w.clear()
            self.status.setText("Press Generate to build the plan from the optimizer priorities.")
            self.prefill_hint.setVisible(False)
            self.plan_stack.setCurrentIndex(0)
            self._style_class()
        self.refresh_bar()

    def _build_ui(self) -> None:
        u = load_user()
        self._show_all_keys = False
        # header: class emblem, title, class chip, the three steps
        self.emblem = QLabel()
        self.class_chip = Chip("", "gold")
        head = QHBoxLayout()
        head.setSpacing(12)
        head.addWidget(self.emblem)
        head.addWidget(text_label("Keybinds", "display"))
        head.addWidget(self.class_chip, 0, Qt.AlignVCenter)
        head.addStretch(1)
        for i, txt in enumerate(STEPS, 1):
            head.addWidget(Chip(f"{i}  {txt}", "gold" if i == 1 else "neutral"), 0, Qt.AlignVCenter)
        self.steps = head
        notice = Banner("warn", "This app never sends input to the game. It builds a plan and an instruction sheet; "
                                "you type the keys into the game and your keyboard software by hand.")

        # hotbar: the keyboard
        self.keyboard = KeyboardWidget()
        self.keyboard.slotChosen.connect(self.set_slot)
        self.prefill_hint = Chip("", "info")
        self.prefill_hint.setVisible(False)
        self.more_btn = GhostButton("Show more keys")
        self.more_btn.setCheckable(True)
        self.more_btn.toggled.connect(self._toggle_keys)
        bar_row = QHBoxLayout()
        bar_row.addWidget(self.prefill_hint)
        bar_row.addStretch(1)
        bar_row.addWidget(self.more_btn)
        self.hotbar_card = Card("Hotbar", "Click a key to pick the skill you have on it in the game; right-click clears it.")
        self.hotbar_card.body.addLayout(bar_row)
        self.hotbar_card.add(self.keyboard)

        # macro setup
        self.boss_key = QLineEdit(str(u["macro_keys"].get("boss", "F9")))
        self.aoe_key = QLineEdit(str(u["macro_keys"].get("aoe", "F10")))
        self.delay = QSpinBox()
        self.delay.setRange(0, 500)
        self.delay.setSuffix(" ms")
        self.delay.setValue(int(u.get("macro_delay_ms", 10)))
        form = QFormLayout()
        form.setHorizontalSpacing(12)
        form.setVerticalSpacing(10)
        form.addRow("Boss macro key", self.boss_key)
        form.addRow("AoE macro key", self.aoe_key)
        form.addRow("Macro delay", self.delay)
        self.generate_btn = PrimaryButton("Generate plan")
        self.generate_btn.setMinimumHeight(40)
        self.copy_btn = GhostButton("Copy instructions")
        self.save_btn = GhostButton("Save .md")
        btns = QHBoxLayout()
        btns.addWidget(self.copy_btn)
        btns.addWidget(self.save_btn)
        self.status = text_label("Press Generate to build the plan from the optimizer priorities.", "caption", wrap=True)
        setup = Card("Macro setup", "Keys your keyboard software will send")
        setup.body.addLayout(form)
        setup.add(self.generate_btn)
        setup.body.addLayout(btns)
        setup.add(self.status)
        setup.body.addStretch(1)
        setup.setFixedWidth(360)

        # generated plan
        self.macro_cards = CardList()
        self.stacks = _table(["Slot", "Stack: bottom cell (fires first) → top cell"], (70,))
        self.gkeys = _table(["G-key", "Mode", "Sends", "Purpose", "Risk"], (70, 70, 80, 220))
        self.dps = _table(["Plan", "Macro DPS", "Ideal DPS"], (180, 110))
        self.manual = QListWidget()
        self.warnings = QListWidget()
        self.preview = QPlainTextEdit()
        self.preview.setReadOnly(True)
        notes = QWidget()
        nl = QVBoxLayout(notes)
        nl.setContentsMargins(0, 8, 0, 0)
        for title, w in (("Manual skills", self.manual), ("Warnings", self.warnings)):
            nl.addWidget(text_label(title, "title"))
            nl.addWidget(w, 1)
        self.plan_tabs = QTabWidget()
        self.plan_tabs.setDocumentMode(True)
        for name, ic, w in (("Macros", "bolt", _scroll(self.macro_cards)), ("Stacks", "list", self.stacks),
                            ("G-keys", "keybinds", self.gkeys), ("DPS", "sword", self.dps),
                            ("Notes", "info", notes), ("Sheet", "copy", self.preview)):
            self.plan_tabs.addTab(w, icon(ic, 18), name)
        self.empty = EmptyState("keybinds", "No plan yet. Match your hotbar above, then press Generate plan.")
        self.plan_stack = QStackedWidget()
        self.plan_stack.addWidget(self.empty)
        self.plan_stack.addWidget(self.plan_tabs)
        self.plan_stack.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Ignored)  # tabs scroll inside, never grow the page
        plan_card = Card("Plan")
        plan_card.add(self.plan_stack, 1)

        plan_card.setMinimumHeight(320)
        low = QHBoxLayout()
        low.setSpacing(16)
        low.addWidget(setup)
        low.addWidget(plan_card, 1)
        page = QWidget()
        lay = QVBoxLayout(page)
        lay.setContentsMargins(20, 16, 20, 16)
        lay.setSpacing(12)
        lay.addLayout(head)
        lay.addWidget(notice)
        lay.addWidget(self.hotbar_card)
        lay.addLayout(low, 1)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(_scroll(page))
        self._style_class()

        self.boss_key.editingFinished.connect(self._save_macro_settings)
        self.aoe_key.editingFinished.connect(self._save_macro_settings)
        self.delay.valueChanged.connect(self._save_macro_settings)
        self.generate_btn.clicked.connect(self.generate)
        self.copy_btn.clicked.connect(self.copy_instructions)
        self.save_btn.clicked.connect(self.save_markdown_dialog)

    def _style_class(self) -> None:
        from aion2c.classes import class_name

        key = self._gd().class_key
        self.emblem.setPixmap(class_emblem(key, 44))
        try:
            self.class_chip.setText(class_name(key))
        except Exception:
            self.class_chip.setText(key.title())

    # ---- skill bar ----
    def _skills(self, gd: GameData):
        b = self.state.build()
        return [s for s in allowed_skills(gd, b.region, b.show_kr) if s.kind in _CASTABLE]

    def refresh_bar(self, *_a) -> None:
        gd = self._gd()
        skills = self._skills(gd)
        sig = tuple(s.key for s in skills) + (gd.class_key,)
        self._prefill_if_empty(gd, skills)
        if sig != self._bar_sig:
            self._bar_sig = sig
            self.keyboard.set_skills([(s.key, s.name, icons.pixmap(gd, s.key, 36)) for s in skills])
        self.keyboard.set_bar(load_user().get("skill_bar") or {})
        self._apply_row_visibility()

    def _prefill_if_empty(self, gd: GameData, skills) -> None:
        """Empty saved bar + a best priority -> fill keys 1,2,3.. with the rotation, then manual skills."""
        u = load_user()
        if u.get("skill_bar"):
            return
        pr = self.state.best_priority()
        if pr is None:
            return
        castable = {s.key for s in skills}
        order = [e.skill_key for e in pr.entries if e.skill_key in castable]
        order += [s.key for s in skills if is_manual(gd, s.key)]
        order = list(dict.fromkeys(order))[: len(KEY_LABELS)]
        if not order:
            return
        u["skill_bar"] = dict(zip(KEY_LABELS, order))
        save_user(u)
        self.prefill_hint.setText("Pre-filled from your best rotation - change keys to match your in-game bar")
        self.prefill_hint.setVisible(True)

    def _toggle_keys(self, on: bool) -> None:
        self._show_all_keys = on
        self.more_btn.setText("Show fewer keys" if on else "Show more keys")
        self._apply_row_visibility()

    def _apply_row_visibility(self) -> None:
        saved = load_user().get("skill_bar") or {}
        letters = any(saved.get(lb) for lb in KEY_LABELS[DEFAULT_ROWS:])
        self.keyboard.set_letters_visible(self._show_all_keys or letters)

    def slot_skill(self, label: str) -> str | None:
        return (load_user().get("skill_bar") or {}).get(label)

    def set_slot(self, label: str, key: str | None) -> None:
        """Put skill `key` (or nothing) on in-game key `label` and persist it."""
        if label not in KEY_LABELS:
            return
        u = load_user()
        bar = dict(u.get("skill_bar") or {})
        if key is None:
            bar.pop(label, None)
        else:
            bar[label] = key
        u["skill_bar"] = bar
        save_user(u)
        self.keyboard.set_bar(bar)
        self._apply_row_visibility()

    def current_bar(self) -> SkillBar:
        return SkillBar(slots={k: v for k, v in (load_user().get("skill_bar") or {}).items() if k in KEY_LABELS and v})

    def _save_macro_settings(self, *_a) -> None:
        if self._building:
            return
        u = load_user()
        u["macro_keys"] = {"boss": self.boss_key.text().strip() or "F9", "aoe": self.aoe_key.text().strip() or "F10"}
        u["macro_delay_ms"] = int(self.delay.value())
        save_user(u)

    # ---- generate ----
    def _priorities(self) -> dict:
        """best_priority() for the current scenario, engine.optimize for the other; both if neither matches."""
        b, cur = self.state.build(), self.state.scenario()
        out = {}
        for s in (x for x in SCENARIOS if x.key in ("boss_180", "aoe_pack")):
            pr = self.state.best_priority() if s.key == cur.key else None
            if pr is None:
                r = self.engine.optimize(b, s)
                pr = r.options[0].priority if r.options else None
            if pr is not None:
                out[s.key] = pr
        return out

    def generate(self) -> None:
        self._save_macro_settings()
        gd, b = self._gd(), self.state.build()
        QApplication.setOverrideCursor(Qt.CursorShape.WaitCursor)
        try:
            prios = self._priorities()
            hotkeys = {"boss": self.boss_key.text().strip() or "F9", "aoe": self.aoe_key.text().strip() or "F10"}
            plan = kb_export.plan(gd, b, prios, self.current_bar(), hotkeys, int(self.delay.value()), cfg_from_settings())
            md = kb_export.instructions_markdown(plan, gd)
        except Exception as e:  # stub or bad data: tell the user, keep the window alive
            self.status.setText(f"Generate failed: {e}")
            return
        finally:
            QApplication.restoreOverrideCursor()
        self._plan, self._markdown = plan, md
        self.show_plan(plan, md)

    def show_plan(self, plan, md: str) -> None:
        gd = self._gd()
        sname = lambda k: (gd.skills[k].name if k in gd.skills else k)  # noqa: E731
        names = lambda keys: " > ".join(sname(k) for k in keys)  # noqa: E731
        bar = self.current_bar().slots
        self.status.setText(f"Plan ready: {len(plan.stacks)} stacked slots, {len(plan.macros)} macros, "
                            f"{len(plan.gkeys)} G-key assignments.")
        self.stacks.setRowCount(len(plan.stacks))
        for r, s in enumerate(plan.stacks):
            self.stacks.setItem(r, 0, _item(s.key_label))
            self.stacks.setItem(r, 1, _item(names(s.stack)))
        self.macro_cards.clear()
        for m in plan.macros:
            steps = []
            for e in m.entries:
                sk = bar.get(e.key_label)
                steps.append((e.key_label, icons.pixmap(gd, sk, 36) if sk else None, sname(sk) if sk else ""))
            delay = m.entries[0].delay_ms if m.entries else None
            self.macro_cards.add(MacroCard(m.name, m.hotkey, steps, delay))
        self.gkeys.setRowCount(len(plan.gkeys))
        for r, g in enumerate(plan.gkeys):
            for c, v in enumerate((g.gkey, g.mstate, g.sends, g.purpose, g.risk)):
                self.gkeys.setItem(r, c, _item(v, v if c == 3 else ""))
        names_dps = list(dict.fromkeys(list(plan.macro_dps) + list(plan.ideal_dps)))
        self.dps.setRowCount(len(names_dps))
        for r, n in enumerate(names_dps):
            m, i = plan.macro_dps.get(n), plan.ideal_dps.get(n)
            self.dps.setItem(r, 0, _item(n))
            self.dps.setItem(r, 1, _item("-" if m is None else f"{m:,.0f}"))
            self.dps.setItem(r, 2, _item("-" if i is None else f"{i:,.0f}"))
        self.manual.clear()
        for k, secs in plan.manual_every_s.items():
            self.manual.addItem(f"Press {sname(k)} about every {secs:.0f} s")
        self.warnings.clear()
        for w in plan.warnings:
            self.warnings.addItem(w)
        self.preview.setPlainText(md)
        self.plan_stack.setCurrentIndex(1)

    # ---- export ----
    def copy_instructions(self) -> None:
        if self._markdown:
            QApplication.clipboard().setText(self._markdown)

    def save_markdown(self, path) -> None:
        Path(path).write_text(self._markdown, encoding="utf-8")

    def save_markdown_dialog(self) -> None:
        if not self._markdown:
            return
        path, _ = QFileDialog.getSaveFileName(self, "Save instructions", "aion2c_keybinds.md", "Markdown (*.md)")
        if path:
            self.save_markdown(path)
