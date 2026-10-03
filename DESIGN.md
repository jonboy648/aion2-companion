# aion2c Design System

Premium dark-fantasy companion look: layered navy surfaces, warm gold for action and emphasis, cool cyan for information.
Code: `aion2c/ui/theme.py` (tokens, QPalette, global QSS), `aion2c/ui/widgets.py` (components, icons),
`aion2c/ui/assets/` (SVG/PNG). Gallery: `PYTHONPATH=D:\Aion2\app python tests\gallery_demo.py` writes
`%TEMP%\aion2c_theme\gallery.png` (real render; do not set QT_QPA_PLATFORM=offscreen, it draws text as boxes).

## Setup

```python
from aion2c.ui.theme import apply_theme
apply_theme(app)          # Fusion style + palette + global QSS + window icon. Call once.
```
Window roots should be plain widgets/QMainWindow (they get `bg`). Do not call `setStyleSheet` with colours on screens;
use tokens (below) or the QSS properties (`role`, `variant`).

## Tokens (`theme.PALETTE`)

| Token | Hex | Use |
|---|---|---|
| bg | #0b1020 | window background |
| surface / surface2 / surface3 | #111831 / #172040 / #1f2a52 | cards and inputs / buttons, headers / hover, tooltips |
| border / border_soft | #2a3563 / #1c2547 | control borders / card borders, dividers |
| text / text_dim / text_faint | #e8ebf6 / #a3adcc / #6b7699 | body / secondary / disabled |
| gold, gold_hi, gold_lo, gold_ink | #e0b458 #f2cf7e #b98d35 #1a1405 | primary action, selection, active tab, focus |
| cyan | #4cc3e8 | info, links, keyboard focus on buttons |
| ok / warn / error | #4cc38a / #e8a33d / #ef5f6b | status |
| confirmed / estimated / unknown | #4cc38a / #e69500 / #808aa8 | confidence (same meaning as `ui/confidence.py`) |

Rarity (`rarity_color(name)`): Common #9aa3b8 grey, Rare #4cc38a green, Epic #4a9df0 blue, Unique/Legend #f0922f orange.
Classes (`class_color(key)`): gladiator, templar, assassin, ranger, sorcerer, elementalist (alias spiritmaster), cleric, chanter.
`theme.TONES[tone] -> (fg, bg, border)` for tinted capsules: neutral gold info ok warn error confirmed estimated unknown.
`confidence_tone_color("estimated")` matches `confidence_color` in `ui/confidence.py`; for new UI prefer the tone names above.

Typography (Segoe UI Variable / Segoe UI, system fonts only): display 26 (`role="display"`), title 17 (`role="title"`),
body 13 (default), caption 11 (`role="caption"`). Extra roles: `dim` (secondary text), `gold` (emphasis).
Set with `widgets.set_role(label, "title")` or `widgets.text_label(text, role)`.
Spacing is an 8px grid (SPACE=8; card padding 16, gaps 8/12/16). Radii: sm 6, md 10, lg 14 (cards 14, controls 8-10).

## Components (`aion2c.ui.widgets`)

| Component | Use |
|---|---|
| `Card(title, subtitle=None, hoverable=False, collapsible=False)` | the unit of grouping. Add content via `card.add(w)` / `card.body` (QVBoxLayout). `hoverable` warms the border and lifts the shadow (animated); `collapsible` adds a chevron toggle |
| `SectionHeader(title, caption=None)` | gold-barred heading inside a page; `.actions` layout for right-side buttons |
| `IconTile(pixmap, size, rarity, badge)` | skill/item icon with rarity bezel and corner badge (rank, count) |
| `StatPill(label, value, tone)` | `DPS 48k`, confidence-coloured numbers (`tone="estimated"`), `set_value()` |
| `Chip(text, tone)` | tags: class, source, slot |
| `PrimaryButton` / `GhostButton` | gold CTA (one per region) / quiet secondary. Plain `QPushButton` is the neutral middle weight |
| `Banner(kind, text)` | inline message strip; `info`, `warn`, `error`; `.action` optional ghost button; `set_text`, `set_kind` |
| `EmptyState(icon, text, action_text)` | icon is an icon name, a QPixmap or None; text says what to do next |
| `line_icon(name, size, color)`, `icon(name)` | vector icon set (`ICON_NAMES`: home codex build upgrade daevanion crafting roadmap keybinds panel info warn error check search settings refresh copy plus close star shield sword list bolt lock). `icon()` returns a QIcon with dim / gold(hover, checked) / faint(disabled) states for tabs and toolbars |
| `class_emblem(class_key, size)` | round class-coloured badge with a glyph (`CLASS_KEYS`, the 8 classes). Placeholder art until real class icons exist |

Everything else (tabs, tables, trees, lists, spin boxes, combos, checkboxes, radios, sliders, progress, scroll bars, menus,
toolbars, tooltips, group boxes, splitters) is styled globally by `apply_theme`; use the stock Qt classes.

## Do / Don't

- Do put each logical group in a `Card`; keep one `PrimaryButton` per card or toolbar.
- Do use gold for "act or selected", cyan for "information", amber/grey for uncertainty. Estimated values always carry `~` and amber (see `fmt_num`).
- Do give empty lists an `EmptyState` with the next action, and errors a `Banner("error", ...)` that says what failed and how to fix it.
- Do use `alternatingRowColors(True)`, hidden vertical header, `Stretch` on the last column for tables.
- Do set icons via `widgets.icon(name)` (tabs/toolbars) so hover and checked states are gold automatically.
- Don't hard-code hex colours or font sizes in screens; read PALETTE or use `role`.
- Don't nest cards inside cards (use SectionHeader + spacing inside a card instead).
- Don't animate anything but card hover/expand. No looping or entrance animations.
- Don't use a `QGraphicsDropShadowEffect` on large or scrolling content (cards only; effects force offscreen painting).
- Don't rely on colour alone for confidence: the `~` and `?` prefixes carry meaning too.
- Never add input injection, memory or packet reading; the theme is presentation only.

## Per-screen guidance (for the restyle phase)

Shell: `QMainWindow` with a left-aligned tab bar (or QToolBar) using `icon(...)` per screen
(home=My Build, codex, build, upgrade, daevanion, crafting, roadmap, keybinds, panel), a content margin of 16-24px,
and a status bar for data snapshot version and armory state. Header strip: character name (title role), class `Chip`,
level `StatPill`, and a `Banner("warn")` when data is estimated or stale.

- **My Build**: top row of StatPills (DPS, crit, haste, key stats) with confidence tones; below, a two-column layout:
  left Card "Character" (class emblem, level, server, armory import as PrimaryButton), right Card "Skill bar" using
  IconTiles with rank badges in key order. Armory errors go in a Banner, not a dialog.
- **Codex**: left filter column (search line edit, kind chips, class filter) in a Card; right a responsive grid of hoverable
  Cards, each with IconTile, name, kind Chip and a one-line summary. Selecting expands detail in a right panel with
  rank table (zebra) and statuses. EmptyState when search matches nothing.
- **Build**: three Cards in a row: priority list (reorderable list), skill bar (IconTiles), scenario (combo/spin).
  PrimaryButton "Simulate" bottom right; result card with big DPS StatPill, per-skill share table, and confidence Banner.
- **Upgrade**: ranked table of next best upgrades (skill, cost, DPS gain, gain per point) with gold-selected row; a budget
  Card on the right (spin boxes, progress bar for points spent). PrimaryButton "Apply" and GhostButton "Reset".
- **Daevanion**: tabs across the top (one per board, gold underline); board graph fills the centre in a `QGraphicsView`
  (view styling is global); right-hand detail Card with node name, rarity Chip (rarity colours), cost and effects, and a
  points StatPill (spent / total, gold when over budget warn). Nodes keep the rarity bezel colours from `RARITY`.
- **Crafting**: left recipe list with search and class filter; centre detail Card (materials tree, "stats unknown" note as an
  `unknown` Chip); right shopping checklist Card (checkboxes, quantity spin boxes) with GhostButton "Copy list" and a
  progress bar of checked items.
- **Road Map**: vertical timeline of milestones by level; each milestone a Card with level StatPill, IconTiles for unlocks
  (stigma slots, skills) and a done/next/future tone (ok / gold / neutral). Current level marked with a gold bar.
- **Keybinds**: keyboard layout as a grid of key tiles (surface2, gold border when bound, IconTile inside); right Card with
  slot table, export options (checkboxes) and PrimaryButton "Export". Warn Banner that the app never sends input to the game.
- **Panel** (overlay): compact, always-on-top, `bg` background with a 1px `border` outline and 10px radius; priority list as
  rows of IconTile (32px) + name + StatPill cooldown; confidence shown only as `~` amber. No shadows, no animation; larger
  type (title role) for the next skill so it reads at a glance. Display only.

## Assets

`assets/app_icon.svg` and `app_icon.png` (256px, gold A-shaped sigil with a cyan gem on navy), used by `apply_theme` as the
window icon. `check`, `chevron_up/down`, `branch_open/closed`, `radio_dot` SVGs are referenced by the QSS (checkbox ticks,
combo and spin arrows, tree branches). Icons in `widgets.py` are drawn with QPainterPath, so they tint to any colour.
