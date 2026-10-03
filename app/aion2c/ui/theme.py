"""Visual design system for aion2c: tokens, QPalette, global QSS. See D:\\Aion2\\DESIGN.md.

Usage: ``apply_theme(app)`` once after creating the QApplication. Screens read colours from PALETTE
and never hard-code hex values. Pure presentation; no game or network access.
"""
from __future__ import annotations

from pathlib import Path

from PySide6.QtGui import QColor, QFont, QIcon, QPalette
from PySide6.QtWidgets import QApplication

PALETTE: dict[str, str] = {
    # surfaces, darkest to lightest
    "bg": "#0b1020",
    "surface": "#111831",
    "surface2": "#172040",
    "surface3": "#1f2a52",
    "border": "#2a3563",
    "border_soft": "#1c2547",
    # text
    "text": "#e8ebf6",
    "text_dim": "#a3adcc",
    "text_faint": "#6b7699",
    # accents
    "gold": "#e0b458",
    "gold_hi": "#f2cf7e",
    "gold_lo": "#b98d35",
    "gold_ink": "#1a1405",
    "cyan": "#4cc3e8",
    "violet": "#7b6cf0",
    # status
    "ok": "#4cc38a",
    "warn": "#e8a33d",
    "error": "#ef5f6b",
    # confidence (matches ui/confidence.py semantics: confirmed green / estimated amber / unknown grey)
    "confirmed": "#4cc38a",
    "estimated": "#e69500",
    "unknown": "#808aa8",
}

RARITY: dict[str, str] = {
    "Common": "#9aa3b8",
    "Rare": "#4cc38a",
    "Epic": "#4a9df0",
    "Unique": "#f0922f",
    "Legend": "#f0922f",
}

CLASS_COLORS: dict[str, str] = {
    "gladiator": "#e0654f",
    "templar": "#5f9be8",
    "assassin": "#9b6bdc",
    "ranger": "#6cc46a",
    "sorcerer": "#f08a3c",
    "elementalist": "#35c6c0",
    "cleric": "#f0d98a",
    "chanter": "#e58bb8",
}
# the game's own names for the spirit class vary; accept aliases
_CLASS_ALIASES = {"spiritmaster": "elementalist", "spirit_master": "elementalist", "sorc": "sorcerer"}

ASSETS = Path(__file__).parent / "assets"
FONT_FAMILY = '"Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI", sans-serif'
FONT_DISPLAY = '"Segoe UI Variable Display", "Segoe UI Semibold", "Segoe UI", sans-serif'
SIZE = {"display": 26, "title": 17, "body": 13, "caption": 11}
SPACE = 8  # grid unit
RADIUS = {"sm": 6, "md": 10, "lg": 14}


def rarity_color(rarity: str | None) -> QColor:
    return QColor(RARITY.get((rarity or "Common").title(), RARITY["Common"]))


def class_color(class_key: str | None) -> QColor:
    k = (class_key or "").strip().lower().replace(" ", "")
    k = _CLASS_ALIASES.get(k, k)
    return QColor(CLASS_COLORS.get(k, PALETTE["text_dim"]))


def confidence_tone_color(confidence: str) -> QColor:
    return QColor(PALETTE.get(confidence, PALETTE["unknown"]))


TONES = {  # tone -> (fg, tinted-bg, border) used by StatPill / Chip / Banner
    "neutral": (PALETTE["text_dim"], "#1a2347", PALETTE["border"]),
    "gold": (PALETTE["gold_hi"], "#2a2412", "#6b5524"),
    "info": (PALETTE["cyan"], "#102a3a", "#235a74"),
    "ok": (PALETTE["ok"], "#0f2b24", "#25664c"),
    "warn": (PALETTE["warn"], "#2e2410", "#7a5a20"),
    "error": (PALETTE["error"], "#331820", "#7e2f3b"),
    "confirmed": (PALETTE["confirmed"], "#0f2b24", "#25664c"),
    "estimated": (PALETTE["estimated"], "#2e2410", "#7a5a20"),
    "unknown": (PALETTE["unknown"], "#1b2036", "#38405e"),
}


def app_icon() -> QIcon:
    return QIcon(str(ASSETS / "app_icon.png"))


def make_palette() -> QPalette:
    p = QPalette()
    c = lambda k: QColor(PALETTE[k])  # noqa: E731
    roles = {
        QPalette.Window: c("bg"), QPalette.WindowText: c("text"),
        QPalette.Base: c("surface"), QPalette.AlternateBase: c("surface2"),
        QPalette.Text: c("text"), QPalette.Button: c("surface2"), QPalette.ButtonText: c("text"),
        QPalette.ToolTipBase: c("surface3"), QPalette.ToolTipText: c("text"),
        QPalette.Highlight: c("gold"), QPalette.HighlightedText: c("gold_ink"),
        QPalette.PlaceholderText: c("text_faint"), QPalette.Link: c("cyan"),
        QPalette.BrightText: c("gold_hi"),
    }
    for role, col in roles.items():
        p.setColor(role, col)
    for role in (QPalette.WindowText, QPalette.Text, QPalette.ButtonText):
        p.setColor(QPalette.Disabled, role, c("text_faint"))
    return p


def apply_theme(app: QApplication) -> None:
    app.setStyle("Fusion")
    app.setPalette(make_palette())
    f = QFont("Segoe UI Variable Text")
    f.setStyleHint(QFont.SansSerif)
    f.setPixelSize(SIZE["body"])
    app.setFont(f)
    app.setStyleSheet(build_qss())
    app.setWindowIcon(app_icon())


def build_qss() -> str:
    P = PALETTE
    q = _QSS_BASE + _QSS_INPUTS + _QSS_VIEWS + _QSS_MISC
    for k, v in P.items():
        q = q.replace("@" + k + "@", v)
    return q.replace("@font@", FONT_FAMILY).replace("@assets@", ASSETS.as_posix())


_QSS_BASE = """
* { font-family: @font@; font-size: 13px; outline: 0; }
QWidget { color: @text@; }
QMainWindow, QDialog { background: @bg@; }
QWidget#Root, QStackedWidget { background: transparent; }
QLabel { background: transparent; }
QLabel[role="display"] { font-size: 26px; font-weight: 600; color: @text@; }
QLabel[role="title"] { font-size: 17px; font-weight: 600; }
QLabel[role="caption"] { font-size: 11px; color: @text_dim@; }
QLabel[role="dim"] { color: @text_dim@; }
QLabel[role="gold"] { color: @gold_hi@; font-weight: 600; }
QToolTip { background: @surface3@; color: @text@; border: 1px solid @gold_lo@; padding: 6px 8px; border-radius: 6px; }
QFrame[frameShape="4"], QFrame[frameShape="5"] { color: @border_soft@; background: @border_soft@; }
QGroupBox { background: @surface@; border: 1px solid @border_soft@; border-radius: 12px; margin-top: 18px; padding: 16px 12px 12px 12px; }
QGroupBox::title { subcontrol-origin: margin; subcontrol-position: top left; left: 14px; top: 2px; padding: 0 6px; color: @gold@; font-weight: 600; }
QSplitter::handle { background: @border_soft@; }
QSplitter::handle:horizontal { width: 3px; } QSplitter::handle:vertical { height: 3px; }
QSplitter::handle:hover { background: @gold_lo@; }

QPushButton { background: @surface2@; border: 1px solid @border@; border-radius: 8px; padding: 7px 16px; color: @text@; }
QPushButton:hover { background: @surface3@; border-color: #3d4b86; }
QPushButton:pressed { background: @surface@; }
QPushButton:focus { border: 1px solid @cyan@; }
QPushButton:disabled { color: @text_faint@; background: @surface@; border-color: @border_soft@; }
QPushButton:checked { background: #2a2412; border: 1px solid @gold@; color: @gold_hi@; }
QPushButton[variant="primary"] { background: qlineargradient(x1:0,y1:0,x2:0,y2:1,stop:0 @gold_hi@,stop:1 @gold_lo@); color: @gold_ink@; border: 1px solid @gold_lo@; font-weight: 600; }
QPushButton[variant="primary"]:hover { background: qlineargradient(x1:0,y1:0,x2:0,y2:1,stop:0 #ffe09a,stop:1 @gold@); }
QPushButton[variant="primary"]:pressed { background: @gold_lo@; }
QPushButton[variant="primary"]:disabled { background: @surface2@; color: @text_faint@; border-color: @border_soft@; }
QPushButton[variant="ghost"] { background: transparent; border: 1px solid transparent; color: @text_dim@; }
QPushButton[variant="ghost"]:hover { background: @surface2@; color: @text@; border-color: @border_soft@; }
QPushButton[variant="ghost"]:pressed { background: @surface@; }
QToolButton { background: transparent; border: 1px solid transparent; border-radius: 8px; padding: 5px 9px; color: @text_dim@; }
QToolButton:hover { background: @surface2@; color: @text@; }
QToolButton:checked, QToolButton:pressed { background: #2a2412; color: @gold_hi@; border-color: @gold_lo@; }
QToolBar { background: @surface@; border: none; border-bottom: 1px solid @border_soft@; spacing: 6px; padding: 6px 10px; }
QToolBar::separator { background: @border_soft@; width: 1px; margin: 4px 6px; }
QStatusBar { background: @surface@; color: @text_dim@; border-top: 1px solid @border_soft@; }
QMenuBar { background: @surface@; } QMenuBar::item:selected { background: @surface3@; }
QMenu { background: @surface2@; border: 1px solid @border@; border-radius: 8px; padding: 6px; }
QMenu::item { padding: 6px 22px; border-radius: 5px; } QMenu::item:selected { background: @surface3@; color: @gold_hi@; }
QMenu::separator { height: 1px; background: @border_soft@; margin: 5px 8px; }
"""

_QSS_INPUTS = """
QLineEdit, QTextEdit, QPlainTextEdit, QTextBrowser, QSpinBox, QDoubleSpinBox, QComboBox {
  background: @surface@; border: 1px solid @border@; border-radius: 8px; padding: 6px 10px;
  selection-background-color: @gold@; selection-color: @gold_ink@; }
QLineEdit:hover, QSpinBox:hover, QDoubleSpinBox:hover, QComboBox:hover { border-color: #3d4b86; }
QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QComboBox:focus { border: 1px solid @gold@; background: #0e1530; }
QLineEdit:disabled, QSpinBox:disabled, QDoubleSpinBox:disabled, QComboBox:disabled { color: @text_faint@; background: @bg@; border-color: @border_soft@; }
QTextBrowser { background: @surface@; border-color: @border_soft@; }
QSpinBox, QDoubleSpinBox { padding-right: 24px; }
QSpinBox::up-button, QDoubleSpinBox::up-button { subcontrol-origin: border; subcontrol-position: top right; width: 20px; border: none; border-top-right-radius: 7px; background: transparent; }
QSpinBox::down-button, QDoubleSpinBox::down-button { subcontrol-origin: border; subcontrol-position: bottom right; width: 20px; border: none; border-bottom-right-radius: 7px; background: transparent; }
QSpinBox::up-button:hover, QDoubleSpinBox::up-button:hover, QSpinBox::down-button:hover, QDoubleSpinBox::down-button:hover { background: @surface3@; }
QSpinBox::up-arrow, QDoubleSpinBox::up-arrow { image: url(@assets@/chevron_up.svg); width: 10px; height: 10px; }
QSpinBox::down-arrow, QDoubleSpinBox::down-arrow { image: url(@assets@/chevron_down.svg); width: 10px; height: 10px; }
QComboBox { padding-right: 28px; }
QComboBox::drop-down { subcontrol-origin: padding; subcontrol-position: center right; width: 26px; border: none; }
QComboBox::down-arrow { image: url(@assets@/chevron_down.svg); width: 11px; height: 11px; }
QComboBox QAbstractItemView { background: @surface2@; border: 1px solid @border@; border-radius: 8px; padding: 4px; outline: 0;
  selection-background-color: @surface3@; selection-color: @gold_hi@; }
QCheckBox, QRadioButton { spacing: 9px; background: transparent; padding: 2px 0; }
QCheckBox:disabled, QRadioButton:disabled { color: @text_faint@; }
QCheckBox::indicator { width: 18px; height: 18px; border: 1px solid @border@; border-radius: 5px; background: @surface@; }
QCheckBox::indicator:hover, QRadioButton::indicator:hover { border-color: @gold@; }
QCheckBox::indicator:checked { background: @gold@; border-color: @gold_lo@; image: url(@assets@/check.svg); }
QCheckBox::indicator:indeterminate { background: @surface3@; border-color: @gold@; }
QCheckBox::indicator:disabled { background: @bg@; border-color: @border_soft@; }
QRadioButton::indicator { width: 18px; height: 18px; border: 1px solid @border@; border-radius: 10px; background: @surface@; }
QRadioButton::indicator:checked { background: @gold@; border-color: @gold_lo@; image: url(@assets@/radio_dot.svg); }
QSlider::groove:horizontal { height: 4px; background: @surface3@; border-radius: 2px; }
QSlider::sub-page:horizontal { background: @gold@; border-radius: 2px; }
QSlider::handle:horizontal { background: @gold_hi@; width: 14px; height: 14px; margin: -6px 0; border-radius: 7px; }
QProgressBar { background: @surface2@; border: none; border-radius: 5px; min-height: 10px; max-height: 10px; text-align: center; color: transparent; }
QProgressBar::chunk { background: qlineargradient(x1:0,y1:0,x2:1,y2:0,stop:0 @gold_lo@,stop:1 @gold_hi@); border-radius: 6px; }
"""

_QSS_VIEWS = """
QTabWidget::pane { border: none; border-top: 1px solid @border_soft@; top: -1px; background: transparent; }
QTabBar { background: transparent; }
QTabBar::tab { background: transparent; color: @text_dim@; padding: 10px 18px; margin-right: 2px; border: none; border-bottom: 2px solid transparent; font-weight: 500; }
QTabBar::tab:hover { color: @text@; background: @surface@; border-top-left-radius: 8px; border-top-right-radius: 8px; }
QTabBar::tab:selected { color: @gold_hi@; border-bottom: 2px solid @gold@; font-weight: 600; }
QTabBar::tab:disabled { color: @text_faint@; }
QTabBar QToolButton { background: @surface2@; border: 1px solid @border_soft@; border-radius: 6px; }

QAbstractScrollArea { background: @surface@; border: 1px solid @border_soft@; border-radius: 10px; }
QScrollArea { background: transparent; border: none; }
QScrollArea > QWidget > QWidget { background: transparent; }
QGraphicsView { background: @surface@; border: 1px solid @border_soft@; border-radius: 10px; }
QScrollBar:vertical { background: transparent; width: 12px; margin: 2px; }
QScrollBar:horizontal { background: transparent; height: 12px; margin: 2px; }
QScrollBar::handle:vertical { background: @surface3@; border-radius: 4px; min-height: 36px; margin: 0 2px; }
QScrollBar::handle:horizontal { background: @surface3@; border-radius: 4px; min-width: 36px; margin: 2px 0; }
QScrollBar::handle:hover { background: @gold_lo@; }
QScrollBar::handle:pressed { background: @gold@; }
QScrollBar::add-line, QScrollBar::sub-line { width: 0; height: 0; background: none; border: none; }
QScrollBar::add-page, QScrollBar::sub-page { background: transparent; }

QListWidget, QListView, QTreeWidget, QTreeView, QTableWidget, QTableView { background: @surface@; alternate-background-color: #161f43;
  border: 1px solid @border_soft@; border-radius: 10px; outline: 0; gridline-color: transparent; selection-background-color: #2a2d44; selection-color: @gold_hi@; }
QListWidget::item, QListView::item { padding: 8px 10px; border-radius: 6px; margin: 1px 4px; }
QListWidget::item:hover, QListView::item:hover { background: @surface2@; }
QListWidget::item:selected, QListView::item:selected { background: #2a2d44; color: @gold_hi@; border-left: 3px solid @gold@; }
QTreeWidget::item, QTreeView::item { padding: 5px 6px; min-height: 26px; }
QTreeWidget::item:hover, QTreeView::item:hover { background: @surface2@; }
QTreeWidget::item:selected, QTreeView::item:selected { background: #2a2d44; color: @gold_hi@; }
QTreeView::branch:has-children:closed { image: url(@assets@/branch_closed.svg); }
QTreeView::branch:has-children:open { image: url(@assets@/branch_open.svg); }
QTableWidget::item, QTableView::item { padding: 6px 10px; border: none; min-height: 32px; }
QTableWidget::item:hover { background: @surface2@; }
QTableWidget::item:selected { background: #2a2d44; color: @gold_hi@; }
QHeaderView { background: transparent; }
QHeaderView::section { background: @surface2@; color: @text_dim@; padding: 9px 12px; border: none; border-bottom: 1px solid @border@; font-weight: 600; font-size: 12px; }
QHeaderView::section:hover { color: @gold_hi@; }
QTableCornerButton::section { background: @surface2@; border: none; }
"""

_QSS_MISC = """
QFrame[card="true"] { background: @surface@; border: 1px solid @border_soft@; border-radius: 14px; }
QFrame[card="true"][hover="true"] { border-color: @gold_lo@; background: #131b38; }
QDialogButtonBox QPushButton { min-width: 80px; }
QMessageBox { background: @surface@; }
"""
