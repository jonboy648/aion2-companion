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
    # No stigmas are equipped; AoE does not inherit the boss-only Hellfire hand press.
    assert len(p.gkeys) == 7 and len(p.macros) == 2 and p.stacks
    assert not any("Steel Barrier" in row.purpose for row in p.gkeys)
    assert not any("Hellfire" in row.purpose and "press by hand" in row.purpose for row in p.gkeys if row.mstate == "M2")


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


def test_hybrid_advice_when_macro_is_slow(sorc_gd, default_build, sorc_bar, fake_sim, monkeypatch):
    from aion2c.testing.fakes import fake_sim_result

    fake_sim("aion2c.keybinds.export.simulate", "aion2c.keybinds.export.simulate_macro")
    monkeypatch.setattr(kb, "simulate_macro", lambda *a, **k: fake_sim_result(dps=1.0))
    p = kb.plan(sorc_gd, default_build, {"boss_180": BOSS, "aoe_pack": AOE}, sorc_bar)
    adv = p.macro_advice["Boss loop"]
    assert "hybrid" in adv and "Hellfire" in adv and "beats the macro by" in adv
    monkeypatch.setattr(kb, "simulate_macro", lambda *a, **k: fake_sim_result(dps=1e9))
    p = kb.plan(sorc_gd, default_build, {"boss_180": BOSS, "aoe_pack": AOE}, sorc_bar)
    assert "hold it and play" in p.macro_advice["Boss loop"]


def test_instructions_sections_in_order(sorc_gd, default_build, sorc_bar, fake_sim):
    p = make(sorc_gd, default_build, sorc_bar, fake_sim)
    md = kb.instructions_markdown(p, sorc_gd)
    heads = [ln for ln in md.splitlines() if ln.startswith("## ")]
    assert heads[:5] == [
        "## 1. Your rotation in plain words", "## 2. Hotbar slots (stacked skills)", "## 3. In-game macros",
        "## 4. Manual presses", "## 5. Logitech G915 G-keys and G900 (onboard memory)",
    ]
    assert "**Opener**" in md and "**Core cooldowns**" in md


def test_plan_gkeys_always_bound(sorc_gd, default_build, sorc_bar, fake_sim):
    p = make(sorc_gd, default_build, sorc_bar, fake_sim)
    bound = {s.key_label: s for s in p.stacks}
    for g in p.gkeys:
        if g.gkey != "G1":
            assert g.sends in bound, g  # unbound skills were put on a free key and added to the hotbar
            assert all(sorc_gd.skills[k].name in g.purpose for k in bound[g.sends].stack[:1])
    assert set(p.slot_notes) == set(bound)


def test_real_sorcerer_plan_search_is_honest():
    from aion2c.data.loader import load_gamedata
    from aion2c.engine import build_optimizer as bo
    from aion2c.engine.simulator import simulate
    from aion2c.models import SCENARIOS, CharacterBuild, SkillBar, Stats

    gd = load_gamedata(class_key="sorcerer")
    build = CharacterBuild("R", "global", 45, stats=Stats(), class_key="sorcerer",
                           stigmas=("element-enhancement", "delayed-explosion", "glacial-smite", "fire-wall"))
    pri = {s.key: bo._heuristic_priority(gd, build, s, bo.SearchBudget(max_candidates=100)) for s in SCENARIOS[:2]}
    p = kb.plan(gd, build, pri, SkillBar())
    for name, scen in (("Boss loop", "boss_180"), ("AoE loop", "aoe_pack")):
        ideal = simulate(gd, build, pri[scen], next(s for s in SCENARIOS if s.key == scen)).dps
        assert abs(p.ideal_dps[scen] - ideal) < 1e-6
        assert p.macro_dps[name] > 0  # may beat a heuristic (non-optimized) priority
        assert p.hybrid_dps[name] >= p.macro_dps[name] - 1e-6
        assert p.rotation[scen]["opener"]
        assert len(next(m for m in p.macros if m.name == name).entries) <= 20
    again = kb.plan(gd, build, pri, SkillBar())
    assert [m.entries for m in again.macros] == [m.entries for m in p.macros]  # deterministic search
    assert all(len(s.stack) <= 4 for s in p.stacks)
