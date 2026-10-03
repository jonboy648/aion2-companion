"""Theme and widget smoke tests (offscreen). Visuals are checked with tests/gallery_demo.py (real render)."""
from PySide6.QtGui import QColor, QPixmap

from aion2c.ui import theme, widgets as W

CLASSES = ("gladiator", "templar", "assassin", "ranger", "sorcerer", "elementalist", "cleric", "chanter")


def test_apply_theme(qapp):
    theme.apply_theme(qapp)
    assert qapp.styleSheet() and "@" not in qapp.styleSheet()
    assert qapp.palette().window().color().name() == theme.PALETTE["bg"]
    assert not theme.app_icon().isNull()


def test_assets_exist():
    for n in ("check", "chevron_down", "chevron_up", "branch_open", "branch_closed", "radio_dot", "app_icon"):
        assert (theme.ASSETS / (n + (".png" if n == "app_icon" else ".svg"))).exists()
    assert (theme.ASSETS / "app_icon.svg").exists()


def test_colors():
    for k in CLASSES:
        assert theme.class_color(k).isValid() and theme.class_color(k).name() == theme.CLASS_COLORS[k]
    assert theme.class_color("Spiritmaster") == theme.class_color("elementalist")
    assert theme.class_color("nope").name() == theme.PALETTE["text_dim"]
    assert len({theme.rarity_color(r).name() for r in ("Common", "Rare", "Epic", "Unique")}) == 4
    assert theme.rarity_color(None) == theme.rarity_color("Common")
    for c in ("confirmed", "estimated", "unknown"):
        assert c in theme.TONES and theme.confidence_tone_color(c).isValid()


def test_confidence_matches_module(qapp):
    from aion2c.ui.confidence import confidence_color

    assert theme.confidence_tone_color("estimated") == confidence_color("estimated")
    assert theme.confidence_tone_color("unknown").name() != "#000000"


def test_every_widget_constructs(qapp):
    theme.apply_theme(qapp)
    pm = QPixmap(32, 32)
    pm.fill(QColor("red"))
    card = W.Card("T", "sub", hoverable=True, collapsible=True)
    card.add(W.text_label("x", "dim"))
    card.set_expanded(False)
    assert not card.is_expanded()
    card.set_expanded(True)
    widgets = [
        card, W.Card(), W.SectionHeader("S", "c"), W.IconTile(pm, 48, "Epic", "3"), W.IconTile(None),
        W.StatPill("DPS", "1", "gold"), W.StatPill("x", "y", "bogus"), W.Chip("c", "info"),
        W.PrimaryButton("go"), W.GhostButton("no"), W.Banner("info", "i"), W.Banner("warn", "w"),
        W.Banner("error", "e"), W.Banner("nonsense", "x"), W.EmptyState("codex", "none", "act"),
        W.EmptyState(pm, "none"), W.EmptyState(None, "none"),
    ]
    for w in widgets:
        w.resize(300, 120)
        w.grab()  # paints (offscreen) without raising
    assert W.PrimaryButton("a").property("variant") == "primary"
    assert W.GhostButton("a").property("variant") == "ghost"


def test_icons(qapp):
    for n in W.ICON_NAMES:
        pm = W.line_icon(n, 24, "#fff")
        assert not pm.isNull()
        img = pm.toImage()
        assert any(img.pixelColor(x, y).alpha() for x in range(img.width()) for y in range(img.height())), n
        assert not W.icon(n).isNull()
    assert len(W.CLASS_KEYS) == 8 and set(W.CLASS_KEYS) == set(CLASSES)
    for k in W.CLASS_KEYS:
        assert not W.class_emblem(k, 40).isNull()

