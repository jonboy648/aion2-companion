import re

from aion2c.keybinds.gkeys import gkey_plan
from aion2c.keybinds.layout import manual_keys, recommend_stacks
from aion2c.keybinds.macro import build_macros
from aion2c.models import Priority, PriorityEntry


def pr(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


BOSS = pr("element-enhancement", "hellfire", "blaze", "firestorm", "frost-burst", "winters-shackles", "flame-arrow")
AOE = pr("firestorm", "frost-burst", "element-enhancement", "flame-arrow")


def setup(gd, build, bar, **kw):
    stacks = recommend_stacks(gd, build, BOSS, bar)
    prios = {"boss_180": BOSS, "aoe_pack": AOE}
    return stacks, prios, build_macros({"boss_180": stacks, "aoe_pack": stacks}, prios, manual=manual_keys(gd), **kw)


def test_macro_limits(sorc_gd, default_build, sorc_bar):
    _, _, macros = setup(sorc_gd, default_build, sorc_bar)
    for m in macros:
        assert len(m.entries) <= 20
        assert all(e.delay_ms == 10 for e in m.entries)
    _, _, custom = setup(sorc_gd, default_build, sorc_bar, delay_ms=45)
    assert all(e.delay_ms == 45 for m in custom for e in m.entries)
    assert any(m.entries for m in custom)


def test_macro_cap_20():
    from aion2c.models import SlotStack

    labels = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    stacks = tuple(SlotStack(l, (f"s{i}",)) for i, l in enumerate(labels))
    p = pr(*[f"s{i}" for i in range(26)])
    m = build_macros({"boss_180": stacks}, {"boss_180": p})[0]
    assert len(m.entries) == 20
    assert [e.index for e in m.entries] == list(range(1, 21))


def test_macro_top_slot_repeats():
    from aion2c.models import SlotStack

    stacks = tuple(SlotStack(l, (f"s{i}",)) for i, l in enumerate("ABCD"))
    p = pr("s0", "s1", "s2", "s3")
    m = build_macros({"boss_180": stacks}, {"boss_180": p})[0]
    assert [e.key_label for e in m.entries] == list("ABACAD")
    for e in m.entries:
        if e.index % 2 == 1:
            assert e.key_label == "A"


def test_macro_excludes_manual(sorc_gd, default_build, sorc_bar):
    stacks, _, macros = setup(sorc_gd, default_build, sorc_bar)
    hf = next(s.key_label for s in stacks if "hellfire" in s.stack)
    for m in macros:
        assert hf not in {e.key_label for e in m.entries}


def test_build_macros_both(sorc_gd, default_build, sorc_bar):
    _, _, macros = setup(sorc_gd, default_build, sorc_bar)
    assert [m.name for m in macros] == ["Boss loop", "AoE loop"]
    assert [m.hotkey for m in macros] == ["F9", "F10"]
    _, _, c = setup(sorc_gd, default_build, sorc_bar, hotkeys={"boss": "F6", "aoe": "F7"})
    assert [m.hotkey for m in c] == ["F6", "F7"]


def test_build_macros_missing_scenario():
    macros = build_macros({}, {})
    assert len(macros) == 2 and all(m.entries == () for m in macros)


def test_gkeys_single_key(sorc_gd, default_build, sorc_bar):
    stacks, _, macros = setup(sorc_gd, default_build, sorc_bar)
    g = gkey_plan(sorc_bar, stacks, macros, sorc_gd)
    rx = re.compile(r"^(F([1-9]|1[0-2])|[0-9A-Z]|[-=])$")
    for a in g:
        assert rx.match(a.sends), a
        assert a.risk in ("lowest_known", "caution")
        assert "+" not in a.sends and "," not in a.sends and " " not in a.sends


def test_gkey_count(sorc_gd, default_build, sorc_bar):
    stacks, _, macros = setup(sorc_gd, default_build, sorc_bar, hotkeys={"boss": "F6", "aoe": "F7"})
    g = gkey_plan(sorc_bar, stacks, macros, sorc_gd)
    # fire-wall / cold-storm (G4 M2) are not in the 13-skill fixture; the shipped data has all 10 rows
    assert len(g) == 9
    assert {(a.gkey, a.mstate) for a in g} == {(f"G{i}", m) for i in range(1, 6) for m in ("M1", "M2")} - {("G4", "M2")}
    assert [a.sends for a in g if a.gkey == "G1"] == ["F6", "F7"]
    hf = next(a for a in g if a.gkey == "G2" and a.mstate == "M1")
    assert hf.sends == "4" and hf.risk == "lowest_known"


def test_gkey_bad_hotkey_and_missing_skills(sorc_gd, default_build):
    from aion2c.models import SkillBar

    macros = build_macros({}, {}, hotkeys={"boss": "Ctrl+F9"})
    g = gkey_plan(SkillBar(), (), macros, sorc_gd)
    assert len(g) == 9
    assert [a.sends for a in g if a.gkey == "G1"] == ["F9", "F10"]
    assert all(a.risk == "caution" for a in g if a.gkey != "G1")



def test_gkey_plan_comes_from_data_tags():
    from aion2c.data.loader import load_gamedata
    from aion2c.models import SkillBar

    shipped = load_gamedata()
    g = gkey_plan(SkillBar(), (), build_macros({}, {}), shipped)
    assert len(g) == 10
    assert any(a.purpose.startswith("Fire Wall > Cold Storm") for a in g if (a.gkey, a.mstate) == ("G4", "M2"))
    assert len(gkey_plan(SkillBar(), (), build_macros({}, {}))) == 2  # no class data: only the G1 macro rows
