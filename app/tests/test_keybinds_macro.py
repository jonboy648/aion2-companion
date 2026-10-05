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


def test_macro_seed_is_every_slot_once():
    from aion2c.models import SlotStack

    stacks = tuple(SlotStack(l, (f"s{i}",)) for i, l in enumerate("ABCD"))
    p = pr("s0", "s1", "s2", "s3")
    m = build_macros({"boss_180": stacks}, {"boss_180": p})[0]
    assert [e.key_label for e in m.entries] == list("ABCD")


def test_build_macros_uses_searched_sequence():
    from aion2c.models import SlotStack

    stacks = tuple(SlotStack(l, (f"s{i}",)) for i, l in enumerate("AB"))
    m = build_macros({"boss_180": stacks}, {"boss_180": pr("s0", "s1")}, sequences={"boss_180": list("ABAB")})[0]
    assert [e.key_label for e in m.entries] == list("ABAB") and [e.index for e in m.entries] == [1, 2, 3, 4]


def test_search_entries_deterministic_and_finds_better():
    from aion2c.keybinds.macro import MAX_ENTRIES, search_entries

    # score: reward alternating A/B, punish length: the optimum is a short A,B,A,B... sequence
    def score(seq):
        alt = sum(1 for x, y in zip(seq, seq[1:]) if x != y)
        return alt - 0.01 * len(seq)

    a = search_entries(["A", "B", "C"], score, [["A"]], budget=120, seed=3)
    b = search_entries(["A", "B", "C"], score, [["A"]], budget=120, seed=3)
    assert a == b
    seq, best, sims = a
    assert best > score(["A"]) and len(seq) <= MAX_ENTRIES and sims <= 120
    assert search_entries([], score, [], 10) == ([], 0.0, 0)


def test_search_beats_old_fixed_pattern_on_real_sim(sorc_gd, default_build, sorc_bar, scen):
    """The searched macro is never worse than the seed (every slot once) on the real macro simulator."""
    from aion2c.engine.simulator import simulate_macro
    from aion2c.keybinds.macro import search_entries, seed_sequences
    from aion2c.models import KeybindPlan, MacroEntry, MacroPlan

    stacks = recommend_stacks(sorc_gd, default_build, BOSS, sorc_bar)
    slots = [s.key_label for s in stacks if not any(k in manual_keys(sorc_gd) for k in s.stack)]
    sc = scen(60)

    def score(seq):
        m = MacroPlan("M", "F9", tuple(MacroEntry(i, l, 10) for i, l in enumerate(seq, 1)))
        return simulate_macro(sorc_gd, default_build, KeybindPlan(stacks=stacks, macros=(m,)), "M", sc).dps

    seeds = seed_sequences(slots)
    _, best, _ = search_entries(slots, score, seeds, budget=60)
    assert best >= score(seeds[0]) - 1e-9


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
    # rows are derived densely: G1 x2, then up to 4 rows per mode (the 13-skill fixture has only 3 M2 candidates)
    assert len(g) == 9
    assert {(a.gkey, a.mstate) for a in g} == {(f"G{i}", m) for i in range(1, 6) for m in ("M1", "M2")} - {("G5", "M2")}
    assert [a.sends for a in g if a.gkey == "G1"] == ["F6", "F7"]
    hf = next(a for a in g if a.gkey == "G2" and a.mstate == "M1")
    assert hf.sends == "4" and hf.risk == "lowest_known"


def test_gkeys_never_point_at_unbound_key_and_name_the_key_skills(sorc_gd, default_build, sorc_bar):
    from dataclasses import replace

    from aion2c.keybinds.gkeys import gkey_layout

    build = replace(default_build, stigmas=("element-enhancement", "steel-barrier"))
    stacks, _, macros = setup(sorc_gd, build, sorc_bar)
    rows, extras, thumbs = gkey_layout(sorc_bar, stacks, macros, sorc_gd, {"M1": ["hellfire", "steel-barrier"], "M2": []})
    bound = {s.key_label: s.stack for s in (*stacks, *extras)}
    for a in rows:
        if a.gkey == "G1":
            continue
        assert a.sends in bound, a  # every key is a real slot or a free key we added
        skills = bound[a.sends]
        names = [sorc_gd.skills[k].name for k in skills]
        if a.risk == "lowest_known":
            assert a.purpose.removesuffix(" (press by hand)") == " > ".join(names), a
        else:
            assert "free key" in a.purpose and a.sends in a.purpose
    for _btn, sends, text in thumbs:
        assert sends == "dodge key" or sends in bound


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
    rows = {(a.gkey, a.mstate): a for a in g}
    # nothing is bound: each row names its ONE skill and says to put it on the free key it sends
    for a in g:
        if a.gkey != "G1":
            assert a.risk == "caution" and f"free key {a.sends}" in a.purpose
    assert rows[("G4", "M2")].purpose.startswith("Fire Wall:")
    assert len({a.sends for a in g if a.gkey != "G1" and a.mstate == "M1"}) == 4  # one key per skill
    assert len(gkey_plan(SkillBar(), (), build_macros({}, {}))) == 2  # no class data: only the G1 macro rows
