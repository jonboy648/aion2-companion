import dataclasses

from aion2c.keybinds import export as kb
from aion2c.models import Priority, PriorityEntry


def pr(*keys):
    return Priority(tuple(PriorityEntry(k) for k in keys))


BOSS = pr("element-enhancement", "hellfire", "blaze", "firestorm", "frost-burst", "winters-shackles", "flame-arrow")
AOE = pr("firestorm", "frost-burst", "element-enhancement", "flame-arrow")


def make(sorc_gd, default_build, sorc_bar, fake_sim, **kw):
    fake_sim("aion2c.keybinds.export.simulate", "aion2c.keybinds.export.simulate_macro")
    return kb.plan(sorc_gd, default_build, {"boss_180": BOSS, "aoe_pack": AOE}, sorc_bar, **kw)


def test_plan_fields(sorc_gd, default_build, sorc_bar, fake_sim):
    p = make(sorc_gd, default_build, sorc_bar, fake_sim)
    assert set(p.macro_dps) == {"Boss loop", "AoE loop"}
    assert all(v == 1500 for v in p.macro_dps.values())
    assert set(p.ideal_dps) == {"boss_180", "aoe_pack"}
    assert p.ideal_dps["boss_180"] > 0
    assert p.manual_every_s["hellfire"] == 45.0
    # G1 x2 + G2..G5 x M1/M2, minus (G4, M2): fire-wall / cold-storm are not in the 13-skill fixture
    assert len(p.gkeys) == 9 and len(p.macros) == 2 and p.stacks


def test_plan_warns_when_macro_slow(sorc_gd, default_build, sorc_bar, fake_sim, monkeypatch):
    from aion2c.testing.fakes import fake_sim_result

    fake_sim("aion2c.keybinds.export.simulate", "aion2c.keybinds.export.simulate_macro")
    monkeypatch.setattr(kb, "simulate_macro", lambda *a, **k: fake_sim_result(dps=1.0))
    p = kb.plan(sorc_gd, default_build, {"boss_180": BOSS, "aoe_pack": AOE}, sorc_bar)
    assert any("below 95%" in w for w in p.warnings)
    monkeypatch.setattr(kb, "simulate_macro", lambda *a, **k: fake_sim_result(dps=1e9))
    p = kb.plan(sorc_gd, default_build, {"boss_180": BOSS, "aoe_pack": AOE}, sorc_bar)
    assert not any("below 95%" in w for w in p.warnings)


def test_plan_drops_require_status(sorc_gd, default_build, sorc_bar, fake_sim):
    fake_sim("aion2c.keybinds.export.simulate", "aion2c.keybinds.export.simulate_macro")
    boss = Priority((PriorityEntry("blaze", 0, "fire_mark"), PriorityEntry("flame-arrow")))
    p = kb.plan(sorc_gd, default_build, {"boss_180": boss}, sorc_bar)
    assert any("fire_mark" in w and "dropped" in w for w in p.warnings)
    assert set(p.ideal_dps) == {"boss_180"}


def test_plan_custom_hotkeys_delay(sorc_gd, default_build, sorc_bar, fake_sim):
    p = make(sorc_gd, default_build, sorc_bar, fake_sim, hotkeys={"boss": "F5", "aoe": "F6"}, delay_ms=40)
    assert [m.hotkey for m in p.macros] == ["F5", "F6"]
    assert all(e.delay_ms == 40 for m in p.macros for e in m.entries)
    assert [a.sends for a in p.gkeys if a.gkey == "G1"] == ["F5", "F6"]


def test_plan_no_auto_chain_places_children(sorc_gd, default_build, sorc_bar, fake_sim):
    from aion2c.models import SimConfig

    fake_sim("aion2c.keybinds.export.simulate", "aion2c.keybinds.export.simulate_macro")
    p = kb.plan(sorc_gd, default_build, {"boss_180": BOSS}, sorc_bar, cfg=SimConfig(auto_chain=False))
    assert any("burst" in s.stack for s in p.stacks)
    assert not any("unverified, test in game" in w for w in p.warnings)


def test_instructions_text(sorc_gd, default_build, sorc_bar, fake_sim):
    p = make(sorc_gd, default_build, sorc_bar, fake_sim)
    md = kb.instructions_markdown(p, sorc_gd)
    for need in ("onboard", "Close G HUB", "Key Settings", "Keys", "not Macro", "Task Manager", "unverified", "G900 (optional)", "G1", "Hellfire"):
        assert need in md, need
    assert "Lua" not in md and "repeat while held" not in md
    assert "—" not in md


def test_instructions_empty_plan(sorc_gd):
    md = kb.instructions_markdown(dataclasses.replace(kb.KeybindPlan()), sorc_gd)
    assert "Task Manager" in md
