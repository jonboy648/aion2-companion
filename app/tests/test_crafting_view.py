from PySide6.QtCore import QObject, Signal

import aion2c.settings as settings
from aion2c.testing.fakes import FakeEngine
from aion2c.ui.crafting_view import CraftingView


class _State(QObject):  # CraftingView only listens for dataChanged; avoids dependence on AppState internals
    dataChanged = Signal()


def _view(mini_gd):
    return CraftingView(_State(), mini_gd, FakeEngine())


def test_view_list_persists(qapp, mini_gd, user_path):
    v = _view(mini_gd)
    assert v.recipe_list.count() == 2
    v.recipe_list.setCurrentRow(0)
    v.qty.setValue(3)
    v.add_btn.click()
    v.add_btn.click()
    assert v.craft_list() == {1: 6}
    saved = settings.load_user()
    assert saved["craft_list"] == {"1": 6}
    # shopping list shows expanded Ore 7*6
    texts = [v.shop.item(i).text() for i in range(v.shop.count())]
    assert "42 x Ore" in texts
    # check an item, then a fresh view restores list and check
    from PySide6.QtCore import Qt
    v.shop.item(0).setCheckState(Qt.CheckState.Checked)
    checked = v.shop.item(0).data(Qt.ItemDataRole.UserRole)
    v2 = _view(mini_gd)
    assert v2.craft_list() == {1: 6}
    assert settings.load_user()["craft_checks"] == [checked]
    states = {v2.shop.item(i).data(Qt.ItemDataRole.UserRole): v2.shop.item(i).checkState() for i in range(v2.shop.count())}
    assert states[checked] == Qt.CheckState.Checked


def test_view_search_and_copy(qapp, mini_gd, user_path):
    from PySide6.QtGui import QGuiApplication
    v = _view(mini_gd)
    v.search_edit.setText("POTION")
    assert v.recipe_list.count() == 1
    v.add_btn.click()
    v.copy_btn.click()
    assert "1 x Ore" in QGuiApplication.clipboard().text()
    v.remove_btn.click()
    assert v.craft_list() == {}
