r"""Render a gallery of every themed component to %TEMP%\aion2c_theme\gallery.png (REAL render: do not set
QT_QPA_PLATFORM=offscreen). Run: set PYTHONPATH=D:\Aion2\app; python tests\gallery_demo.py"""
import os
import sys
import tempfile
from pathlib import Path

from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (QApplication, QCheckBox, QComboBox, QDoubleSpinBox, QGridLayout, QHBoxLayout, QLabel,
                               QLineEdit, QListWidget, QProgressBar, QRadioButton, QSpinBox, QTableWidget,
                               QTableWidgetItem, QTabWidget, QTreeWidget, QTreeWidgetItem, QVBoxLayout, QWidget)

from aion2c.ui.theme import PALETTE, apply_theme
from aion2c.ui import widgets as W


def build() -> QWidget:
    root = QWidget()
    root.setObjectName("Root")
    root.setStyleSheet(f"#Root{{background:{PALETTE['bg']};}}")
    outer = QVBoxLayout(root)
    outer.setContentsMargins(24, 20, 24, 20)
    outer.setSpacing(14)
    outer.addWidget(W.text_label("Aion 2 Companion", "display"))
    outer.addWidget(W.text_label("Design system gallery: tokens, components, states", "dim"))
    tabs = QTabWidget()
    tabs.addTab(QWidget(), W.icon("home"), "My Build")
    tabs.addTab(QWidget(), W.icon("codex"), "Codex")
    tabs.addTab(QWidget(), W.icon("daevanion"), "Daevanion")
    tabs.addTab(QWidget(), W.icon("crafting"), "Crafting")
    tabs.addTab(QWidget(), W.icon("roadmap"), "Road Map")
    tabs.setFixedHeight(46)
    tabs.setCurrentIndex(2)
    outer.addWidget(tabs)

    cols = QGridLayout()
    cols.setSpacing(16)
    for i in range(3):
        cols.setColumnStretch(i, 1)
    outer.addLayout(cols)
    left, mid, right = QVBoxLayout(), QVBoxLayout(), QVBoxLayout()
    for i, c in enumerate((left, mid, right)):
        cols.addLayout(c, 0, i)
    for c in (left, mid, right):
        c.setSpacing(14)


    # --- buttons + pills
    c = W.Card("Actions and status", "Primary is gold, ghost is quiet, pills carry confidence")
    row = QHBoxLayout()
    row.addWidget(W.PrimaryButton("Optimize build"))
    row.addWidget(W.GhostButton("Reset"))
    b = W.GhostButton("Disabled"); b.setEnabled(False); row.addWidget(b)
    row.addStretch(1)
    c.body.addLayout(row)
    row = QHBoxLayout()
    for lab, val, tone in (("DPS", "48.2k", "gold"), ("Crit", "~31%", "estimated"), ("Haste", "212", "confirmed"), ("Pen", "?", "unknown")):
        row.addWidget(W.StatPill(lab, val, tone))
    row.addStretch(1)
    c.body.addLayout(row)
    row = QHBoxLayout()
    for t, tone in (("Sorcerer", "gold"), ("Global", "info"), ("Verified", "ok"), ("Stale", "warn"), ("Missing", "error"), ("Armory", "neutral")):
        row.addWidget(W.Chip(t, tone))
    row.addStretch(1)
    c.body.addLayout(row)
    c.body.addWidget(W.Banner("info", "Using the bundled data snapshot. Refresh to pull the latest armory stats."))
    c.body.addWidget(W.Banner("warn", "Two skills have estimated values. Results are approximate."))
    c.body.addWidget(W.Banner("error", "Could not reach the armory. Check your connection and try again."))
    left.addWidget(c)

    # --- inputs
    c = W.Card("Inputs", "Focus a field to see the gold ring")
    g = QGridLayout(); g.setHorizontalSpacing(12); g.setVerticalSpacing(10)
    g.addWidget(QLabel("Character"), 0, 0); le = QLineEdit("Sorcerer Jon"); g.addWidget(le, 0, 1)
    g.addWidget(QLabel("Level"), 1, 0); sp = QSpinBox(); sp.setRange(1, 55); sp.setValue(45); g.addWidget(sp, 1, 1)
    g.addWidget(QLabel("Crit %"), 2, 0); ds = QDoubleSpinBox(); ds.setValue(31.5); g.addWidget(ds, 2, 1)
    g.addWidget(QLabel("Server"), 3, 0); cb = QComboBox(); cb.addItems(["Global", "Korea"]); g.addWidget(cb, 3, 1)
    c.body.addLayout(g)
    c.body.addWidget(QCheckBox("Include estimated values"))
    ck = QCheckBox("Boss scenario"); ck.setChecked(True); c.body.addWidget(ck)
    c.body.addWidget(QRadioButton("Single target"))
    rb = QRadioButton("Area (10 targets)"); rb.setChecked(True); c.body.addWidget(rb)
    pb = QProgressBar(); pb.setValue(64); c.body.addWidget(pb)
    le.setFocus()
    mid.addWidget(c)

    # --- tiles and emblems
    c = W.Card("Rarity tiles and classes", "Bezel colour is the rarity")
    row = QHBoxLayout()
    from PySide6.QtGui import QPixmap
    for rar, badge in (("Common", None), ("Rare", "3"), ("Epic", "12"), ("Unique", "40")):
        pm = W.class_emblem("sorcerer", 44)
        row.addWidget(W.IconTile(pm, 48, rar, badge))
    row.addStretch(1)
    c.body.addLayout(row)
    row = QHBoxLayout()
    for k in W.CLASS_KEYS:
        lb = QLabel(); lb.setPixmap(W.class_emblem(k, 40)); row.addWidget(lb)
    row.addStretch(1)
    c.body.addLayout(row)
    names = W.ICON_NAMES
    for chunk in (names[:9], names[9:18], names[18:]):
        row = QHBoxLayout()
        for n in chunk:
            lb = QLabel(); lb.setPixmap(W.line_icon(n, 22, PALETTE["gold"] if n in ("star", "bolt") else PALETTE["text_dim"])); lb.setToolTip(n); row.addWidget(lb)
        row.addStretch(1)
        c.body.addLayout(row)
    right.addWidget(c)

    # --- table / tree / list
    c = W.Card("Tables and lists", "Zebra rows, comfortable height")
    t = QTableWidget(5, 3); t.setHorizontalHeaderLabels(["Skill", "Rank", "DPS share"])
    t.verticalHeader().setVisible(False); t.setAlternatingRowColors(True)
    t.horizontalHeader().setStretchLastSection(True); t.setEditTriggers(QTableWidget.NoEditTriggers)
    for i, (a, r, d) in enumerate((("Hellfire", "12", "24.1%"), ("Blaze", "10", "18.8%"), ("Firestorm", "9", "15.2%"), ("Flame Arrow", "40", "11.0%"), ("Burst", "6", "5.4%"))):
        for j, v in enumerate((a, r, d)):
            t.setItem(i, j, QTableWidgetItem(v))
    t.selectRow(1); t.setFixedHeight(220)
    c.body.addWidget(t)
    tr = QTreeWidget(); tr.setHeaderHidden(True); tr.setFixedHeight(120)
    p1 = QTreeWidgetItem(["Fire"]); p1.addChild(QTreeWidgetItem(["Hellfire"])); p1.addChild(QTreeWidgetItem(["Blaze"]))
    tr.addTopLevelItem(p1); tr.addTopLevelItem(QTreeWidgetItem(["Frost"])); p1.setExpanded(True)
    c.body.addWidget(tr)
    ls = QListWidget(); ls.addItems(["Flame Arrow", "Firestorm", "Hellfire", "Blaze", "Burst", "Pyroclasm"]); ls.setCurrentRow(2); ls.setFixedHeight(130)
    c.body.addWidget(ls)
    mid.addWidget(c)

    c = W.Card("Empty state")
    c.add(W.EmptyState("codex", "No rotations saved yet. Run the optimizer and save the best result to compare later.", "Open optimizer"))
    right.addWidget(c)
    sh = W.SectionHeader("Section header", "with caption")
    sh.actions.addWidget(W.GhostButton("Action"))
    left.addWidget(sh)
    ec = W.Card("Collapsible card (hover lifts)", "Click the chevron", hoverable=True, collapsible=True)
    ec.add(W.text_label("Body content lives here. Cards are the unit of grouping on every screen.", "dim", wrap=True))
    left.addWidget(ec)
    for c in (left, mid, right):
        c.addStretch(1)
    return root


def main() -> None:
    out = Path(tempfile.gettempdir()) / "aion2c_theme"
    out.mkdir(exist_ok=True)
    app = QApplication(sys.argv)
    apply_theme(app)
    w = build()
    w.resize(1320, 1020)
    w.show()

    def snap():
        w.grab().save(str(out / "gallery.png"))
        print("saved", out / "gallery.png")
        app.quit()

    QTimer.singleShot(900, snap)
    app.exec()


if __name__ == "__main__":
    main()
