import aion2c.crafting as crafting


def _m(lst):
    return {m.item: m.qty for m in lst}


def test_shopping_merge(mini_gd):
    got = _m(crafting.shopping_list(mini_gd, {1: 1, 2: 2}, expand=True))
    assert got == {"Ore": 7 + 2, "Dust": 4 + 2}
    names = [m.item for m in crafting.shopping_list(mini_gd, {1: 1, 2: 2})]
    assert names == sorted(names)


def test_expand_flag(mini_gd):
    assert _m(crafting.shopping_list(mini_gd, {1: 1}, expand=False)) == {"Intermediate Dust": 2, "Ore": 3}
    assert _m(crafting.shopping_list(mini_gd, {1: 2}, expand=True)) == {"Ore": 14, "Dust": 8}
    assert crafting.shopping_list(mini_gd, {999: 1, 1: 0}) == []


def test_search_case_insensitive(mini_gd):
    assert [r.id for r in crafting.search(mini_gd, "MINI orb")] == [1]
    assert {r.id for r in crafting.search(mini_gd, "mini")} == {1, 2}
    assert len(crafting.search(mini_gd, "")) == len(mini_gd.recipes)
    assert crafting.search(mini_gd, "zzz") == []


def test_sorc_filter(mini_gd):
    ids = {r.id for r in crafting.sorc_recipes(mini_gd)}
    assert ids == {1, 2}  # True and None kept
    r2 = next(r for r in mini_gd.recipes if r.id == 2)
    assert crafting.is_unverified(r2)
    assert not crafting.is_unverified(next(r for r in mini_gd.recipes if r.id == 1))


def test_sorc_filter_drops_false(mini_gd):
    from dataclasses import replace
    gd = replace(mini_gd, recipes=tuple(replace(r, sorc_relevant=False) if r.id == 2 else r for r in mini_gd.recipes))
    assert {r.id for r in crafting.sorc_recipes(gd)} == {1}
