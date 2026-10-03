"""Keybinds screen visuals: keyboard tiles follow the saved bar and the class, macro cards render the plan."""
import json

import pytest
from PySide6.QtCore import Qt
from PySide6.QtTest import QTest

from aion2c.models import CharacterBuild, KEY_LABELS, MacroEntry, MacroPlan, Stats
from aion2c.settings import load_user
from aion2c.state import AppState
from aion2c.ui.keybinds_view import KeybindsScreen


@pytest.fixture
def screen(qapp, sorc_gd, fake_engine, user_path):
    st = AppState(fake_engine, sorc_gd, CharacterBuild("Test", "global", 45, stats=Stats()))
    return KeybindsScreen(st, sorc_gd, fake_engine)


def test_every_label_has_one_tile(screen):
    assert set(screen.keyboard.tiles) == set(KEY_LABELS)


def test_set_slot_persists_and_shows_on_tile(screen):
    skill = screen._skills(screen.state.gamedata())[0]
    screen.set_slot("2", skill.key)
    assert load_user()["skill_bar"] == {"2": skill.key}
    tile = screen.keyboard.tiles["2"]
    assert tile.skill_key == skill.key and tile.skill_name == skill.name
    screen.set_slot("2", None)
    assert load_user()["skill_bar"] == {} and screen.keyboard.tiles["2"].skill_key is None


def test_tile_right_click_clears(screen):
    skill = screen._skills(screen.state.gamedata())[0]
    screen.set_slot("1", skill.key)
    tile = screen.keyboard.tiles["1"]
    tile.show()
    QTest.mouseClick(tile, Qt.RightButton)
    assert screen.slot_skill("1") is None


def test_letters_hidden_until_toggled_or_bound(screen):
    assert not screen.keyboard.is_tile_visible("Q")
    screen.more_btn.setChecked(True)
    assert screen.keyboard.is_tile_visible("Q")
    screen.more_btn.setChecked(False)
    skill = screen._skills(screen.state.gamedata())[0]
    screen.set_slot("Q", skill.key)  # a bound letter key must never be hidden
    assert screen.keyboard.is_tile_visible("Q")


def test_class_switch_swaps_bar_and_skills(screen, user_path):
    sorc_skill = screen._skills(screen.state.gamedata())[0]
    screen.set_slot("1", sorc_skill.key)
    screen.state.set_class("templar")
    assert screen.class_chip.text() == "Templar"
    assert screen.keyboard.tiles["1"].skill_key is None  # templar bar starts empty
    names = {k for k, _n, _pm in screen.keyboard._skills}
    assert sorc_skill.key not in names and names
    screen.state.set_class("sorcerer")
    assert screen.keyboard.tiles["1"].skill_key == sorc_skill.key
    saved = json.loads(open(user_path).read())
    assert "templar" in saved["skill_bars"]


def test_macro_cards_render_plan(screen):
    from aion2c.models import KeybindPlan

    sk = screen._skills(screen.state.gamedata())[0]
    screen.set_slot("1", sk.key)
    plan = KeybindPlan(stacks=(), macros=(MacroPlan("Boss loop", "F9", (MacroEntry(1, "1"), MacroEntry(2, "1"))),
                                          MacroPlan("Empty", "F10", ())),
                       gkeys=(), macro_dps={}, ideal_dps={}, manual_every_s={}, warnings=())
    screen.show_plan(plan, "# sheet")
    assert screen.macro_cards.count() == 2
    assert screen.plan_stack.currentIndex() == 1
    assert screen.preview.toPlainText() == "# sheet"
