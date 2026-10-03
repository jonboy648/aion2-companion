# Aion 2 Sorcerer Companion (aion2c) - Build Plan

Date 2026-10-03. Target: Global launch 2026-10-05. Runtime: Python 3.12.10, PySide6 6.10.2 (both already installed), pytest.
Team: 1 lead + parallel Sonnet agents. Wave 0 (1 agent, fast) -> Wave 1 (9 agents in parallel: P1-P9) -> Wave 2 (1-2 agents).
SCOPE ADDITIONS (Daevanion, crafting, skill-point/stigma budgets) are in section 3b and OVERRIDE anything earlier that conflicts (e.g. tab count, CharacterBuild fields).

## 0. Hard rules (every package)

| Rule | Detail |
|---|---|
| No automation | The app NEVER sends keystrokes, mouse events or memory/packet reads to the game. No `SendInput`, `keybd_event`, `pyautogui`, `pynput` output, no Lua generation. Wave 2 greps for these. |
| No new deps | stdlib + PySide6 + pytest only. HTTP via `urllib.request`. JSON via `json`. Icons are already PNG. |
| Contracts frozen | Files marked W0 below are read-only in Wave 1. Need a change? Write an adapter inside your own files and list it under "Contract issues" in your final report. |
| Every number carries confidence | Use `Num(value, confidence, source)`; confidence is `"confirmed" | "estimated" | "unknown"`. Unknown values never crash: they fall back to defaults and add a warning string. |
| Region | `"global"` (level cap 45, core rank cap 20, stigma cap 20) vs `"korea"` (cap 50, core 40, stigma 25). KR-only skills are hidden on global unless the user toggles "show KR data". |
| Tests offline | No network in pytest. Qt tests use `QT_QPA_PLATFORM=offscreen`. |
| Icons | NCSOFT art: personal use, never commit `assets/` to a public repo. |

## 1. Repo layout and ownership

Root `D:\Aion2\app\`. Owner = the only package allowed to write the file (W0 creates stubs for every `.py` below with final signatures; the owner fills the bodies).

| Path | Owner | Purpose |
|---|---|---|
| `pyproject.toml`, `README.md` | W0 | package `aion2c`, entry `python -m aion2c`; `[tool.pytest.ini_options] pythonpath=["."], testpaths=["tests"], markers=["needs_sim: requires real simulator"]` |
| `aion2c/__init__.py`, `aion2c/{data,engine,keybinds,ui,testing}/__init__.py` | W0 | all package inits (empty); nobody else creates them |
| `aion2c/__main__.py` | W0 / P6 | `__main__` stub by W0, body by P6 |
| `aion2c/models.py` | W0 | all dataclasses (section 2) + `KEY_LABELS`, `effective_rank()` |
| `aion2c/serde.py` | W0 | `to_dict(obj)`, `from_dict(cls, d)` for every model, round-trip safe |
| `aion2c/interfaces.py` | W0 | Protocols (`@runtime_checkable`): `LiveStateSource`, `EngineFacade` |
| `aion2c/testing/fakes.py` | W0 | `FakeEngine`, `fake_sim_result()`, `fake_simulate()`, `fake_simulate_macro()`, `NullStateSource` |
| `aion2c/data/fallback_gamedata.json` | W0 | copy of `sorc_gamedata_small.json`, shipped inside the package for load-failure fallback |
| `aion2c/ui/confidence.py` | W0 | `fmt_num(n: Num) -> tuple[str, str]` (text, tooltip), `confidence_color(c: Confidence) -> QColor`; used by P6 and P7 |
| `tests/conftest.py`, `tests/fixtures/mini_gamedata.json`, `tests/fixtures/sorc_gamedata_small.json` | W0 | shared fixtures; conftest sets `os.environ["QT_QPA_PLATFORM"]="offscreen"` before any Qt import |
| `tests/test_contracts.py` | W0 | serde round-trip, fixture loads |
| `aion2c/data/build_gamedata.py`, `aion2c/data/update.py`, `aion2c/data/loader.py` | P1 | build, re-pull + diff, load (`allowed_skills` body is written by W0; P1 leaves it alone) |
| `aion2c/data/src/mechanics.json`, `aion2c/data/src/chains.json`, `aion2c/data/src/roadmap.json`, `aion2c/data/src/community_rotations.json` | P1 | hand-authored data |
| `aion2c/data/gamedata.json`, `aion2c/data/icons/*.png` | P1 (generated) | shipped data file + copied icons |
| `tests/test_data_*.py`, `tests/fixtures/aion2app_skill_page.html` | P1 | copy of `research/tmp/pg.html` |
| `aion2c/engine/damage.py`, `aion2c/engine/simulator.py`, `aion2c/engine/next_skills.py` | P2 | hit formula, fight sim, panel feed |
| `tests/test_damage.py`, `tests/test_simulator.py`, `tests/test_next_skills.py` | P2 | |
| `aion2c/engine/search.py`, `aion2c/engine/explain.py`, `aion2c/engine/community.py`, `aion2c/engine/facade.py` | P3 | optimizer, explanations, community diff, `Engine` class |
| `tests/test_search.py`, `tests/test_explain.py`, `tests/test_community.py` | P3 | |
| `aion2c/engine/advisor.py`, `aion2c/roadmap.py` | P4 | marginal DPS per stat, road map |
| `tests/test_advisor.py`, `tests/test_roadmap.py` | P4 | |
| `aion2c/keybinds/layout.py`, `aion2c/keybinds/gkeys.py`, `aion2c/keybinds/macro.py`, `aion2c/keybinds/export.py` | P5 | hotbar stacks, G1-G5, in-game macro, instruction sheet |
| `tests/test_keybinds_*.py` | P5 | |
| `aion2c/app.py`, `aion2c/state.py`, `aion2c/settings.py`, `aion2c/ui/panel.py`, `aion2c/ui/hotkey.py`, `aion2c/ui/icons.py` | P6 | QApplication, AppState + auto re-run, user settings, panel, global hotkey, icon cache |
| `tests/test_state.py`, `tests/test_panel.py`, `tests/test_settings.py` | P6 | |
| `aion2c/ui/main_window.py`, `aion2c/ui/codex.py`, `aion2c/ui/build_planner.py`, `aion2c/ui/upgrade.py`, `aion2c/ui/roadmap_view.py`, `aion2c/ui/keybinds_view.py` | P7 | window-mode screens |
| `tests/test_ui_screens.py` | P7 | |
| `tests/test_integration.py`, `tests/test_no_automation.py`, `scripts/smoke.ps1` | W2 | integration + verification |

User data (not in repo): `%APPDATA%\aion2c\user.json`, schema fixed by W0 as `settings.DEFAULT_USER` (section 2.2). Env var `AION2C_USER_PATH` overrides `user_path()` (tests use `monkeypatch.setenv`). Body of `settings.py` owned by P6.

## 2. Wave 0 - Contracts (one agent, target < 1 hour)

### 2.1 `aion2c/models.py` (exact names; all `@dataclass(frozen=True)` unless noted; tuples not lists)

Hashing: only `Num`, `PriorityEntry`, `Priority` (and other dict-free classes) are hashable. `GameData`, `CharacterBuild`, `SimConfig`, `SimResult`, `SkillBar`, `KeybindPlan`, `LiveState` hold dicts: never use them as `lru_cache` args or dict keys. Every dict/collection default uses `field(default_factory=...)`; the `= {}` shorthand below means that.

```python
Confidence = Literal["confirmed", "estimated", "unknown"]
Region = Literal["global", "korea"]
Element = Literal["fire", "water", "earth", "none"]

class SkillKind(str, Enum):
    ACTIVE="active"; PASSIVE="passive"; STIGMA="stigma"; CHAIN="chain"; PROC="proc"
    CHARGE_TIER="charge_tier"; SYSTEM="system"; DODGE="dodge"

@dataclass(frozen=True)
class Num:            value: float | None; confidence: Confidence = "unknown"; source: str = ""
class RankData:       rank: int; flat_min: Num; flat_max: Num; cooldown_s: Num; mp_cost: Num
class Specialization: rank_required: int | None; text: str
class Skill:
    key: str                    # unique slug: index.json key, e.g. "winters-shackles", "cold-snap-15730000", "hellfire-level-1"
    skill_id: int | None; name: str; name_kr: str | None; kind: SkillKind; element: Element
    unlock_level: int | None    # chain children inherit parent level; None (unlinked skills, fixture chain children) = castable if region-allowed
    max_rank: int; regions: frozenset[Region]
    atk_ratio_pct: Num          # rank-1 ratio, applied at all ranks (documented assumption); TOTAL per cast
    ranks: tuple[RankData, ...] # index = rank-1; flat_min/max are TOTAL per cast
    range_m: float | None; aoe_targets: int
    hits: int                   # DISPLAY ONLY; damage never multiplies by it. Fixtures use 1.
    anim_lock_s: Num            # default 1.0 "estimated"; user calibration overrides
    icon: str | None            # filename in aion2c/data/icons/, None -> placeholder
    description: str; tags: tuple[str, ...]; specializations: tuple[Specialization, ...]
class Status:                   # buff on self or debuff on target
    key: str; name: str; on: Literal["self", "target"]; duration_s: Num
    dmg_mult: Num               # multiplier while active, 1.0 = none
    elements: frozenset[Element]  # empty = all
    mp_min_pct: float | None = None   # set -> passive, active whenever MP% >= this (no cast needed); gated by owning skill's unlock
    source_skill: str | None = None   # skill whose unlock gates a passive/trigger status
    tick_ratio_pct: Num = Num(0.0, "unknown")  # DoT/ground: ATK ratio per tick while active on target (0 = none)
    tick_s: Num = Num(1.0, "unknown")
class StatusTrigger:            # passive proc: any cast of `on_element` may apply `status_key`
    status_key: str; on_element: Element; chance: float; source_skill: str; confidence: Confidence = "estimated"
class ChargeLevel:   level: int; charge_s: Num; dmg_mult: Num   # level starts at 1; dmg_mult scales the RATIO part only
class SkillRule:                # sim mechanics for one skill
    skill_key: str
    applies: tuple[str, ...] = ()        # status keys applied on cast
    apply_chance: float = 1.0            # deterministic accumulator, per (skill, status) (section 3, P2)
    requires: tuple[str, ...] = ()       # statuses that must be active to cast
    consumes: tuple[str, ...] = ()
    chain_next: str | None = None; chain_window_s: float = 3.0
    charge_levels: tuple[ChargeLevel, ...] = ()
    mp_restore: float = 0.0
    confidence: Confidence = "estimated"; note: str = ""
class Link:  parent_key: str; child_key: str; kind: Literal["chain","proc","charge","condition","upgrade","cancel"]; confidence: Confidence
class CommunityRotation: key: str; source: str; scenario_key: str; priority: tuple[str, ...]; note: str
class RoadmapItem: level: int; kind: Literal["skill","zone","system","stigma","gear","daevanion"]; text: str; regions: frozenset[Region]
class GameData:
    schema_version: int          # = 1
    data_version: str            # e.g. "2026-10-03+aion2app-2026-09-18"
    built_at: str
    level_caps: dict[Region, int]                  # {"global":45,"korea":50}
    rank_caps: dict[Region, dict[str, int]]        # {"global":{"core":20,"stigma":20},"korea":{"core":40,"stigma":25}}
    stigma_slots: dict[Region, int]                # {"global":4,"korea":6}
    skills: dict[str, Skill]; statuses: dict[str, Status]; rules: dict[str, SkillRule]
    triggers: tuple[StatusTrigger, ...]            # e.g. fire_mark on fire casts, chance 0.2
    links: tuple[Link, ...]; community: tuple[CommunityRotation, ...]; roadmap: tuple[RoadmapItem, ...]
class Stats:   # all percents as numbers (12.5 = 12.5%)
    attack: float = 1000; attack_increase_pct: float = 0; weapon_dmg_pct: float = 0; dmg_boost_pct: float = 0
    pve_dmg_pct: float = 0; boss_dmg_pct: float = 0; crit_chance_pct: float = 0; crit_dmg_pct: float = 50
    smite_pct: float = 0; combat_speed_pct: float = 0; cdr_pct: float = 0
    max_mp: float = 2000; mp_regen_per_s: float = 20; target_defense: float = 0; penetration: float = 0
class CharacterBuild:
    name: str; region: Region; level: int
    skill_ranks: dict[str, int]          # key -> rank; missing = rank 1 if unlocked
    stigmas: tuple[str, ...]             # max gd.stigma_slots[region]
    specs: dict[str, tuple[int, ...]]    # key -> chosen spec rank_required values
    stats: Stats
    show_kr: bool = False                # True -> KR-only skills become candidates on global too
class Scenario: key: str; name: str; duration_s: float; n_targets: int; boss: bool
SCENARIOS = (Scenario("boss_180","Single-target boss",180,1,True),
             Scenario("aoe_pack","AoE pack (4)",30,4,False),
             Scenario("level_pull","Leveling pull (3)",15,3,False))
class PriorityEntry: skill_key: str; charge_level: int = 0; require_status: str | None = None
    # charge_level 0 = "not a charge skill"; on a charge skill 0 resolves to the HIGHEST level.
    # require_status: extra `requires` for this entry only (lets search find "hold X for buff Y"). Macros cannot express it.
class Priority:      entries: tuple[PriorityEntry, ...]; label: str = ""
class SimConfig:     tick_ms: int = 100; anim_overrides: dict[str, float] = field(default_factory=dict)
                     start_mp_pct: float = 100.0; auto_chain: bool = True   # False: parent entry does NOT cast children; children need own entries
class CastEvent:     t_s: float; skill_key: str; charge_level: int   # resolved level (0 for non-charge)
                     damage: float; mp_after: float
                     active_statuses: tuple[str, ...]   # statuses active when damage lands, before `applies`
class SkillTally:    casts: int; damage: float
class SimResult:     total_damage: float; dps: float; duration_s: float; casts: tuple[CastEvent, ...]
                     per_skill: dict[str, SkillTally]; status_uptime: dict[str, float]   # fraction 0-1 of duration; only statuses with uptime > 0
                     warnings: tuple[str, ...]; confidence: Confidence
class SearchBudget:  max_candidates: int = 400; max_len: int = 10; seed: int = 0
class RankedOption:  rank: int; priority: Priority; result: SimResult; explanation: str
class Disagreement:  community_key: str; skill_key: str
                     community_pos: int; ours_pos: int   # 1-based; -1 = absent from that list
                     dps_delta_pct: float                # (ours_dps / community_dps - 1) * 100
                     text: str
class OptimizeResult: scenario: Scenario; options: tuple[RankedOption, ...]; disagreements: tuple[Disagreement, ...]
class StatGain:      stat: str   # exact Stats field name: "smite_pct", "crit_dmg_pct", ..., "attack"
                     delta: float; dps_gain_pct: float; confidence: Confidence
class LiveState:     t_s: float; cooldowns_s: dict[str, float]; statuses: dict[str, float]; mp: float | None; target_hp_pct: float | None; confidence: Confidence
KEY_LABELS = ("1","2","3","4","5","6","7","8","9","0","-","=") + tuple("ABCDEFGHIJKLMNOPQRSTUVWXYZ")  # the ONLY valid bar labels
class SkillBar:      slots: dict[str, str | None]   # key label (in KEY_LABELS) -> skill_key
class SlotStack:     key_label: str; stack: tuple[str, ...]  # <= 4, index 0 fires first
class MacroEntry:    index: int; key_label: str; delay_ms: int = 10
class MacroPlan:     name: str; hotkey: str; entries: tuple[MacroEntry, ...]  # <= 20; hotkey e.g. "F9"
class GKeyAssignment: gkey: Literal["G1","G2","G3","G4","G5"]; mstate: Literal["M1","M2","M3"]; sends: str; purpose: str
                     risk: Literal["lowest_known","caution"]   # no official statement exists; never "safe"
class KeybindPlan:   stacks: tuple[SlotStack, ...]; macros: tuple[MacroPlan, ...]; gkeys: tuple[GKeyAssignment, ...]
                     macro_dps: dict[str, float]      # macro name -> DPS from simulate_macro (MANUAL skills excluded)
                     ideal_dps: dict[str, float]      # scenario key -> DPS of the optimizer priority
                     manual_every_s: dict[str, float] # MANUAL skill -> "press about every N s" from the optimizer's cast times
                     warnings: tuple[str, ...]

def effective_rank(gd, build, skill) -> int:   # W0 writes the body; everyone uses it
    # clamp(build.skill_ranks.get(skill.key, 1), 1, min(len(skill.ranks), gd.rank_caps[build.region]["stigma" if skill.kind==SkillKind.STIGMA else "core"]))
```

### 2.2 Module signatures (stubs raise `NotImplementedError`; owners must not change them)

| Module | Signature |
|---|---|
| `data/loader.py` | `load_gamedata(path: Path \| None = None) -> GameData`; `default_path() -> Path`; `allowed_skills(gd, region, show_kr: bool) -> list[Skill]` (REAL body by W0: keep skills whose `regions` contain `region`, or any region when `show_kr`) |
| `data/build_gamedata.py` | `build(research_dir: Path, icons_dir: Path, out_path: Path, built_at: str \| None = None) -> GameData`; `icons_dir` = SOURCE `D:\Aion2\assets\icons` (has `index.json`); destination is always `aion2c/data/icons`; CLI `python -m aion2c.data.build_gamedata` |
| `data/update.py` | `parse_skill_page(html: str) -> dict`; `diff_gamedata(old: GameData, new: GameData) -> list[str]`; CLI `python -m aion2c.data.update [--dry-run]` |
| `engine/damage.py` | `hit_damage(skill: Skill, rank: int, stats: Stats, mult: float, boss: bool, charge: ChargeLevel \| None = None, n_levels: int = 1) -> float` |
| `engine/simulator.py` | `simulate(gd, build, priority, scenario, cfg=SimConfig(), initial: LiveState \| None = None) -> SimResult`; `simulate_macro(gd, build, plan: KeybindPlan, macro_name: str, scenario, cfg=SimConfig()) -> SimResult` |
| `engine/next_skills.py` | `next_skills(gd, build, priority, scenario, live: LiveState \| None, n: int = 5) -> list[str]` |
| `engine/search.py` | `candidate_skills(gd, build) -> list[PriorityEntry]`; `optimize(gd, build, scenario, cfg=SimConfig(), budget=SearchBudget(), top_k=5) -> OptimizeResult` |
| `engine/explain.py` | `explain(best: SimResult, other: SimResult, gd) -> str` |
| `engine/community.py` | `compare(gd, build, scenario, best: RankedOption, cfg) -> tuple[Disagreement, ...]` |
| `engine/facade.py` | `class Engine` (structurally satisfies `EngineFacade`), ctor `Engine(gd: GameData, cfg: SimConfig = SimConfig())`: `optimize(build: CharacterBuild, scenario: Scenario) -> OptimizeResult`; `simulate(build, priority: Priority, scenario: Scenario) -> SimResult`; `marginal(build, priority, scenario) -> list[StatGain]`; `next_skills(build, priority, scenario, live: LiveState \| None, n: int = 5) -> list[str]`; `set_config(cfg: SimConfig) -> None` |
| `engine/advisor.py` | `marginal_stats(gd, build, priority, scenario, cfg=SimConfig(), deltas: dict[str, float] \| None = None) -> list[StatGain]`; keys are exact `Stats` field names, default `{"smite_pct":1,"crit_dmg_pct":1,"crit_chance_pct":1,"dmg_boost_pct":1,"weapon_dmg_pct":1,"attack_increase_pct":1,"combat_speed_pct":1,"attack":10}`; sorted desc |
| `roadmap.py` | `roadmap(gd, region: Region, build: CharacterBuild \| None = None) -> list[RoadmapItem]` |
| `keybinds/layout.py` | `recommend_stacks(gd, build, priority, bar: SkillBar) -> tuple[SlotStack, ...]` |
| `keybinds/macro.py` | `build_macros(stacks_by_scenario: dict[str, tuple[SlotStack, ...]], priorities: dict[str, Priority], hotkeys: dict[str, str] \| None = None, delay_ms: int = 10) -> tuple[MacroPlan, ...]` returns BOTH "Boss loop" (from `boss_180`, hotkey `hotkeys["boss"]`, default F9) and "AoE loop" (from `aoe_pack`, default F10) |
| `keybinds/gkeys.py` | `gkey_plan(bar: SkillBar, stacks, macros) -> tuple[GKeyAssignment, ...]` (exactly 10: G1-G5 x M1, M2; G1 sends each macro's `hotkey`) |
| `keybinds/export.py` | `plan(gd, build, priorities: dict[str, Priority], bar, hotkeys: dict[str,str] \| None = None, delay_ms: int = 10, cfg=SimConfig()) -> KeybindPlan`; `instructions_markdown(plan: KeybindPlan, gd) -> str` |
| `interfaces.py` | `@runtime_checkable class LiveStateSource(Protocol): def snapshot(self) -> LiveState \| None`; `@runtime_checkable class EngineFacade(Protocol)` = the 5 `Engine` methods above |
| `state.py` | `class AppState(QObject)`, ctor `AppState(engine: EngineFacade, gd: GameData, build: CharacterBuild, scenario_key: str = "boss_180", parent=None)`. Signals `buildChanged`, `resultsReady(object)` (an `OptimizeResult` for the CURRENT scenario only), `dataChanged`. Getters `build() -> CharacterBuild`, `scenario() -> Scenario`, `gamedata() -> GameData`, `best_priority() -> Priority \| None`, `show_kr() -> bool` (= `build().show_kr`), `current_result() -> OptimizeResult \| None`. Setters `set_build(b)`, `set_scenario(key: str)`, `set_show_kr(bool)` (rebuilds build, emits `buildChanged`), `set_gamedata(gd)` (emits `dataChanged`). On `dataChanged` it rebuilds `SimConfig` from settings (`anim_overrides`, `auto_chain`) and calls `engine.set_config`. |
| `settings.py` | `DEFAULT_USER: dict` (W0, below); `load_user(path=None) -> dict` (missing keys filled from DEFAULT_USER); `save_user(d, path=None)`; `user_path() -> Path` (W0 body: `AION2C_USER_PATH` env var, else `%APPDATA%\aion2c\user.json`) |
| `ui/icons.py` | `pixmap(gd: GameData, skill_key: str, size: int = 32) -> QPixmap` (placeholder for missing icon, never None). Signature frozen; P6 owns body; W0 stub returns a grey placeholder. |
| `ui/panel.py` | `Panel(state: AppState, gd: GameData, engine: EngineFacade, source: LiveStateSource, parent=None)` |

`DEFAULT_USER` (exact keys; P6 and P7 use only these): `{"builds": {}, "active_build": None, "skill_bar": {}, "macro_keys": {"boss": "F9", "aoe": "F10"}, "macro_delay_ms": 10, "auto_chain": True, "anim_overrides": {}, "roadmap_checks": [], "panel": {"opacity": 0.85, "click_through": False, "x": None, "y": None}, "hotkey": "Ctrl+Alt+P", "show_kr": False}`.

Import style (monkeypatch targets depend on it; mandatory):
- Engine modules import functions at module level: `from aion2c.engine.simulator import simulate` (so tests patch `aion2c.engine.search.simulate`, `aion2c.engine.community.simulate`, `aion2c.engine.advisor.simulate`, `aion2c.keybinds.export.simulate`, `aion2c.keybinds.export.simulate_macro`).
- UI modules import modules and call through them: `import aion2c.roadmap as roadmap_mod`, `import aion2c.keybinds.export as kb_export` (tests patch `aion2c.roadmap.roadmap`, `aion2c.keybinds.export.plan`, `aion2c.keybinds.export.instructions_markdown`).

### 2.3 Fixtures (W0)

`tests/fixtures/mini_gamedata.json` (serde of a `GameData`), used by the hand-computed sim test. All skills: element "fire", rank 1 only (`max_rank` 1), `unlock_level` 1, regions {global, korea}, `hits` 1, `aoe_targets` 1 unless stated, `cooldown_s` and `anim_lock_s` confidence "confirmed", no triggers:

| key | kind | atk_ratio_pct | flat | cd_s | mp | anim_s | aoe | rule |
|---|---|---|---|---|---|---|---|---|
| `strike` | ACTIVE | 100 | 0 | 0 | 0 | 1.0 | 1 | - |
| `nuke` | ACTIVE | 300 | 0 | 4 | 0 | 1.0 | 4 | - |
| `amp` | ACTIVE | 0 | 0 | 10 | 0 | 1.0 | 1 | applies `amp_buff` (self, 5 s, dmg_mult 1.5, all elements) |
| `mark_hit` | ACTIVE | 50 | 0 | 0 | 0 | 1.0 | 1 | applies `mark` (target, 10 s, mult 1.0), apply_chance 0.5 |
| `blaze` | ACTIVE | 200 | 0 | 5 | 0 | 1.0 | 1 | requires `mark`, consumes `mark` |
| `chain1` / `chain2` / `chain3` | ACTIVE / CHAIN / CHAIN | 100 / 150 / 200 | 0 | 0 | 0 | 1.0 | 1 | chain1.chain_next=chain2, chain2.chain_next=chain3, window 3 s |
| `charge` | ACTIVE | 100 | 0 | 20 | 100 | 0.5 | 1 | charge_levels L1 (0 s, x1), L2 (1 s, x2), L3 (2 s, x3) |

Note: nuke aoe 4 does not affect single-target tests (n_targets 1).

`sorc_gamedata_small.json` (Flame Arrow keeps all 40 ranks so rank-cap tests work): 13 real Sorcerer skills hand-built from `research/sorcerer_skills.json`, keys exactly `flame-arrow`, `burst`, `pyroclasm`, `firestorm`, `blaze`, `fire-mark`, `hellfire`, `element-enhancement`, `defiance`, `steel-barrier`, `bittercold-wind`, `frost-burst`, `winters-shackles`; the `fire_mark` trigger, statuses `fire_mark`, `element_enhancement`, `grace_of_enhancement` (mp_min_pct 25, source_skill `element-enhancement`; stand-in), and the FULL roadmap tuple from data_contract section 5 (stigma at 22, slots at 27/32/37, KR items above 45). UI and keybind packages work against it before P1 lands.

`conftest.py` fixtures: `mini_gd`, `sorc_gd`, `default_build` (global, level 45, Stats() defaults, crit 0), `boss_scenario`, `scen10` (= `Scenario("t10","t",10,1,False)`), `scen` (factory `scen(duration_s, n_targets=1)`), `sorc_bar` (`SkillBar`: "1" flame-arrow, "2" firestorm, "3" blaze, "4" hellfire, "5" element-enhancement, "6" defiance, "7" steel-barrier, "8" bittercold-wind, "9" frost-burst, "0" winters-shackles), `sorc_priority` (`Priority` of element-enhancement, hellfire, blaze, firestorm, flame-arrow), `fake_engine`, `fake_sim` (installs `fake_simulate` via monkeypatch on the given targets), `user_path` (tmp `AION2C_USER_PATH`), `qapp` (session QApplication, offscreen).

`testing/fakes.py`:
- `fake_simulate(gd, build, priority, scenario, cfg=SimConfig(), initial=None) -> SimResult`: minimal real sim for Wave 1 tests: walk entries, first skill off cooldown wins, damage = `damage.hit_damage` formula inlined at rank 1 with mult 1, no statuses/MP/chains, cooldowns honored, lock = `anim_lock_s / (1 + combat_speed_pct/100)`, idle tick 100 ms. Deterministic, linear in attack (so P4's +1.0% tests hold).
- `fake_simulate_macro(gd, build, plan, macro_name, scenario, cfg=SimConfig()) -> SimResult` returns `fake_sim_result(dps=1500)`.
- `fake_sim_result(dps=1800.0)`.
- `FakeEngine`: `optimize` returns a fixed `OptimizeResult` (3 options, dps 1800/1600/1500, priorities using `sorc_gd` keys); `simulate` returns `fake_sim_result()`; `marginal` returns 3 `StatGain`s; `next_skills` returns `["flame-arrow","burst","pyroclasm","firestorm","hellfire"][:n]`; `set_config` stores the cfg. Every method appends its name to `FakeEngine.calls: list[str]`. `isinstance(FakeEngine(), EngineFacade)` is True.
- `NullStateSource.snapshot()` returns `None`.

UI stubs (`ui/*.py`, `app.py`, `state.py`) are minimal working widgets/QObjects with the final class names and constructor signatures (not `NotImplementedError`), so P6 and P7 can import each other from day one. Screen ctor: `Screen(state: AppState, gd: GameData, engine: EngineFacade, parent=None)`. `MainWindow(state, gd, engine)` has signal `panelRequested`. `app.main(argv)` accepts `--fake-engine` (also env `AION2C_FAKE_ENGINE=1`): uses `FakeEngine` + `aion2c/data/fallback_gamedata.json`; Wave 1 smoke uses it, W2a switches the smoke test to the real engine (flag stays as a debug aid).

W0 done when: `python -m pytest tests/test_contracts.py -q` passes (includes `test_fake_engine_is_facade`, `test_fake_simulate_linear`, `test_effective_rank_clamps`, `test_allowed_skills`), every stub imports, `python -c "import aion2c.models, aion2c.engine.simulator, aion2c.ui.panel, aion2c.ui.main_window"` works. Lead then launches Wave 1.

## 3. Wave 1 - parallel packages (7 agents, no talking)

Every package: reads `PLAN.md` + `models.py` + `interfaces.py` + its research inputs; tests against W0 fixtures (`mini_gd`, `sorc_gd`, `fake_engine`, `fake_sim`), never against another Wave 1 package's code. Any test whose code path reaches another package's stub must monkeypatch it (import style in 2.2). NEVER edit a file you do not own, even to fix a failure; report it instead.
Test runs in Wave 1 (7 agents share one tree): only your own files plus the shared guard, `python -m pytest -p no:cacheprovider tests/test_<yours>*.py tests/test_contracts.py -q`. The full suite runs only in Wave 2.
Done = those tests pass (xfail allowed only where this plan says so), final report lists: files written, test count passed, contract issues, open guesses.

### P1 - Data layer (size M, ~500 lines + JSON)

Goal: versioned `aion2c/data/gamedata.json` + icons from research, plus update/diff script.
Inputs: `D:\Aion2\research\sorcerer_skills.json`, `data_contract.md` (sections 1-3, 5), `sorcerer_builds_and_dps.md`, `game_ui_and_progression.md`, `assets/icons/index.json` + `sorcerer/*.png`, `research/tmp/pg.html` (copy to fixture), `research/tmp/dl.py` (existing scraper regexes).
Work:
- Keys: index.json slug via `by_id[skill_id]`; for id-less entries slug from name (delete apostrophes, non-alnum -> `-`). Hellfire L1/L2/Max become `ChargeLevel`s on `hellfire`'s `SkillRule`; the `hellfire-level-*` tiers ALSO stay in `gd.skills` as kind CHARGE_TIER with `icon="hellfire.png"` (Codex only; never castable). The Depths / Flame Zone: `icon=None`. `hits` copied from description where stated (display only).
- `stigma_slots = {"global":4,"korea":6}`.
- Element from `metaroad_tag` (Fire/Water/Earth). `regions`: the 12 KR-only skills in data_contract 1.7 -> `{"korea"}`, rest both.
- `chains.json` = data_contract section 2 table verbatim -> `Link`s; children inherit `unlock_level`.
- `mechanics.json` (hand-authored, every value with confidence): status `fire_mark` (target) + `StatusTrigger("fire_mark", "fire", 0.2, "fire-mark")` per S4, `estimated`; `element_enhancement` (self, +20% fire/water, duration `unknown` -> default 15 s); `delayed_explosion` (target, x1.15, 4 s, `estimated`, `source` must also name the conflicting value: Inven 20 s/+25% vs dump 30 s/+15%); `grace_of_enhancement` (self, +20% PvE, `mp_min_pct` 25, `source_skill` = its passive; `source` notes the 25% vs 50% conflict); DoT/ground statuses (Fire Wall, Cold Storm, Firestorm) with `tick_ratio_pct`/`tick_s` = `unknown` 0 until Jon's tooltips. Rules: Blaze requires `fire_mark`; Flame Arrow -> Burst -> Pyroclasm chain with `mp_restore` 100/100/120; Hellfire charge levels L1/L2/L3 `dmg_mult` 1/1.5/2 (`estimated`), charge_s 0/1.0/2.0 `estimated`; default `anim_lock_s` 1.0 `estimated` (Firestorm, Fire Wall, Cold Storm 1.5).
- `community_rotations.json`: S5 boss priority, S6 Global boss priority, AoE list (builds doc section 3), each with source URL.
- `roadmap.json`: data_contract section 5 table + core unlocks.
- Numbers: `ranks[i].flat_min/max` from `per_level`, `confirmed` when non-null (client dump), `unknown` when null; `atk_ratio_pct` `estimated` (rank-1 only).
- `update.py`: re-fetch `https://aion2.app/db/skills/{id}` for each id at 0.5 s spacing, `parse_skill_page` (regexes from dl.py + per-rank table), rebuild in memory, print `diff_gamedata` lines, write new file with bumped `data_version` only if not `--dry-run`. Never runs in tests.

Acceptance tests:
| Test | Assertion |
|---|---|
| `test_build_counts` | built gd has 54 icon-bearing skills (51 + 3 Hellfire tiers on `hellfire.png`); `len(gd.skills) == 56`; every non-None `icon` file exists in `aion2c/data/icons` |
| `test_slug_traps` | `gd.skills["winters-shackles"].skill_id == 15110000`; `"cold-snap-15730000"` kind PASSIVE; `"cold-snap"` id 15080000 |
| `test_hellfire_charges` | `gd.rules["hellfire"].charge_levels` has 3 levels (dmg_mult 1/1.5/2); `gd.skills["hellfire"].ranks[0]` flat_min 1137, flat_max 3412 |
| `test_chain_inherit` | `gd.skills["burst"].unlock_level == 1`; Link flame-arrow -> burst kind "chain" confidence "confirmed" |
| `test_region_tags` | `"firebomb"` regions == {"korea"}; `allowed_skills(gd,"global",False)` excludes it |
| `test_caps` | `gd.level_caps == {"global":45,"korea":50}` |
| `test_every_num_has_confidence` | walk all `Num` -> confidence in the 3 literals |
| `test_parse_skill_page` | fixture html -> dict with `name`, `skill_id`, icon id |
| `test_diff_detects_change` | change one cooldown -> diff list has one line naming the skill |
| `test_roundtrip_file` | `load_gamedata()` of shipped file == `build(..., built_at=<shipped built_at>)` output, serde-equal with `built_at` and `data_version` excluded |
| `test_grace_passive` | `gd.statuses["grace_of_enhancement"].mp_min_pct == 25`; `fire_mark` trigger present with chance 0.2 |

### P2 - Damage + simulator + macro simulator (size M-L, ~550 lines) - THE HEART, critical path

Goal: deterministic discrete-time fight simulator.
Damage (`damage.py`, constants module-level with confidence comments):
`base = attack*(1+attack_increase_pct/100)*(1+weapon_dmg_pct/100)`; `raw = base*ratio/100*cmult + flat`. Non-charge skill: flat = mean(flat_min, flat_max), cmult = 1. Charge skill at level L of n: flat = `flat_min + (flat_max - flat_min)*(L-1)/(n-1)`, cmult = that level's `dmg_mult` (ratio part only). Unknown flat -> 0 + warning; `hit = max(0, raw - max(0,target_defense-penetration)*0.1) * (1+(dmg_boost_pct+pve_dmg_pct+(boss_dmg_pct if boss else 0))/100) * crit_exp * smite_exp * mult`; `crit_exp = 1 + min(crit_chance_pct,80)/100 * crit_dmg_pct/100 * (0.75 if boss else 1)`; `smite_exp = 1 + smite_pct/100 * SMITE_BONUS(0.5) * (0.7 if boss else 1)`.
Sim semantics (exact; tests depend on them):
1. Time in integer ms. Decision at t: walk `priority.entries` in order; first castable wins. Castable = unlocked (`unlock_level` None or <= build.level) and region-allowed (`allowed_skills(gd, build.region, build.show_kr)`), ready (`t >= ready_at`), MP >= cost, all `requires` (+ the entry's `require_status`) active. Kinds CHAIN, PROC, CHARGE_TIER, PASSIVE are NEVER castable from their own entry (only via rule 4). If nothing castable, t += tick_ms (idle). Rank = `models.effective_rank(gd, build, skill)`.
2. Damage time: non-charge = cast start t; charge level = `t + charge_s` (statuses are checked at that moment, and a buff expiring mid-charge does not boost). Damage x product of `dmg_mult` of active statuses matching the skill element, including passive statuses with `mp_min_pct` (active iff unlocked via `source_skill` and current MP% >= it). A status is active iff `t < expiry`. Record `CastEvent.active_statuses` at the damage time. Then `applies` (a buff never boosts its own cast), then triggers (`gd.triggers` whose `on_element` == skill element and whose `source_skill` is unlocked), then `consumes`.
3. Lock = `anim_lock_s` (override from `cfg.anim_overrides`) / (1+combat_speed_pct/100) + `charge_s` of the chosen level; cooldown = rank cooldown * (1-cdr_pct/100). Both converted to ms ONCE at cast time with `round()`. Next decision at t + lock; `ready_at = t + cooldown`.
4. Chain (only when `cfg.auto_chain`): the window belongs to the ROOT priority entry. Casting a skill whose rule has `chain_next` sets that entry's tip = `chain_next` and window end = `t + lock + chain_window_s`. While open, that entry casts the current tip instead of the root; casting the tip moves the tip to its `chain_next` and resets the window end; a tip with no `chain_next` closes the window. Casting any other entry, or expiry, resets to root. If the tip is not usable (cooldown/MP), the entry is skipped. With `auto_chain=False`, children are castable from their own entries only while a window naming them is open.
5. Chance accumulators, one per (source, status) pair (source = skill key for `applies`, trigger for triggers): `acc += chance; if acc >= 1-1e-9: apply; acc -= 1` (0.5 applies on 2nd, 4th cast; a 0.25 trigger fires on the 4th fire cast in total, whichever skills cast).
6. MP: start `max_mp*start_mp_pct/100`, regen `mp_regen_per_s` continuously, capped; cost deducted at cast; `mp_restore` added after.
7. Targets: damage x `min(scenario.n_targets, skill.aoe_targets)`. DoT: a target status with `tick_ratio_pct > 0` deals `hit_damage`-formula ratio damage every `tick_s` while active (credited to the applying skill). Unknown tick values -> 0 and a warning naming the skill.
8. Casts starting at `t < duration` count; `dps = total/duration`. `confidence` = weakest confidence over every `Num` actually read during the run (ratios, flats, cooldowns, anim locks, status durations/mults, charge times) and every used `SkillRule.confidence`; every `unknown` read adds one warning naming it. If any skill rank > 1, add warning "ranking assumed, unverified at rank > 1". `status_uptime` = active time / duration per status.
9. `initial: LiveState`: start from its cooldowns (`ready_at = cooldowns_s*1000`), statuses (remaining seconds) and `mp` (if not None).
`simulate_macro`: models the in-game macro, which runs ENTRIES IN ORDER (macros_ingame.md section 1-2), not as a priority list. A pointer walks `plan.macros[name].entries`; from the pointer, the first entry whose slot has a usable skill fires (inside a slot, the first usable skill of its `SlotStack` fires); then the pointer moves to the entry after the one that fired (wrapping). If none usable, idle tick, pointer unchanged. `delay_ms` is added to the lock after each fired entry. MANUAL skills are never in stacks used by macros. All other rules as above.
`next_skills`: live None -> first n skill keys of the simulated cast sequence; live given -> `simulate(..., initial=live)` and take the first n.
Acceptance tests (fixture `mini_gd`, Stats() with crit 0, `scen10` unless stated; variants via `dataclasses.replace`). Hand-computed:
| Test | Priority | Expected |
|---|---|---|
| `test_hit_basic` | `hit_damage(strike,1,Stats(),1.0,False)` | 1000.0; with `dmg_boost_pct=10` -> 1100.0; `target_defense=500` -> 950.0 |
| `test_amp_window` | amp, nuke, strike | total 18000, dps 1800.0; cast keys `[amp,nuke,strike,strike,strike,nuke,strike,strike,strike,nuke]` |
| `test_no_amp` | nuke, strike | total 16000 |
| `test_requires_and_proc` | blaze, mark_hit; 6 s | total 4500; blaze casts at t=2.0 only |
| `test_chain` | chain1; 4 s | casts chain1, chain2, chain3, chain1; total 5500 |
| `test_charge` | charge L3, strike; 5 s | casts at 0.0, 2.5, 3.5, 4.5; total 6000 |
| `test_mp_gate` | charge L1, strike; `max_mp=50, mp_regen_per_s=0` | charge never cast; total 10000 |
| `test_aoe` | nuke (aoe 4), strike; `n_targets=4` | total 43000 |
| `test_combat_speed` | strike; combat_speed 100% | 20 casts, total 20000 |
| `test_chain_child_not_standalone` | chain3 | total 0 |
| `test_auto_chain_false` | chain1; 4 s; `auto_chain=False` | 4 casts of chain1, total 4000 |
| `test_charge_window_expiry` | amp, charge L3; `anim_overrides={"amp":4.0}` | charge lands at 6.0 after amp expired: total 3000 (4500 if checked at cast start) |
| `test_trigger_accumulator` | gd + `StatusTrigger("mark","fire",0.25,"strike")`; blaze, nuke, strike; 6 s | casts `[nuke,strike,strike,strike,blaze,nuke]`, total 11000 |
| `test_passive_mp_threshold` | gd + status `focus` (self, x2, `mp_min_pct` 50, source `strike`); strike; regen 0 | `start_mp_pct=60` -> 20000, `start_mp_pct=40` -> 10000; uptime["focus"] 1.0 vs absent |
| `test_require_status` | nuke(require amp_buff), amp, strike | total 14000 |
| `test_initial_state` | nuke, strike; `initial` cooldowns {nuke: 3.0} | total 14000 |
| `test_status_uptime` | amp, nuke, strike | `status_uptime["amp_buff"] == 0.5`; nuke's CastEvent at 1.0 has `amp_buff` in `active_statuses` |
| `test_macro_order` | `simulate_macro`; stacks "1"=[amp], "2"=[strike], "3"=[nuke]; entries 1,2,3, delay 0 | total 16000 (< 18000 priority) |
| `test_macro_stack` | `simulate_macro`; stack "1"=[nuke,strike]; entries [1], delay 0 | total 16000 (= priority nuke, strike) |
| `test_deterministic` | any | two runs equal |
| `test_next_skills_static` | amp, nuke, strike | `next_skills(...,None,3) == ["amp","nuke","strike"]` |
| `test_real_smoke` | `sorc_gd`, boss_180 | runs < 1 s, dps > 0 |

### P3 - Optimizer, explanations, community diff, facade (size M, ~350 lines)

Goal: ranked priority lists per scenario. Unit tests monkeypatch `aion2c.engine.search.simulate` and `aion2c.engine.community.simulate` with `testing.fakes.fake_simulate` (P2 is being built in parallel). `test_mini_optimum` and `test_finds_known_optimum` are marked `@pytest.mark.needs_sim` + `@pytest.mark.xfail(strict=False, reason="needs P2")`, run the real simulator; W2a removes the xfail.
Search: candidates = skills in `allowed_skills(gd, build.region, build.show_kr)`, unlocked at `build.level`, kind ACTIVE or STIGMA (never CHAIN/PROC/CHARGE_TIER/PASSIVE; chain children are reached via rule 4), that deal damage or apply something; Hellfire as one entry per charge level. Seeds (each its own restart, budget split evenly): greedy (damage per lock-second, buffs first), buffs-first-then-cooldown-desc, and each matching community rotation. Local search per seed: move/swap/insert/remove plus add/remove a `require_status` (only statuses some candidate applies), `random.Random(budget.seed)`; stop at `max_candidates` total simulations. Cache key = `priority.entries` only, scoped to one `optimize` call (never cache on gd/build/cfg: unhashable). Keep top_k distinct by result. Add a warning "N distinct priorities simulated" to the best result.
Explain: text like "Option 1 beats 2 by 6.2%: casts Element Enhancement 12x (uptime 80%) and lands 9/10 Hellfire inside Delayed Explosion". Use `per_skill` deltas, `SimResult.status_uptime` and `CastEvent.active_statuses` (no re-simulation).
Community: simulate each matching `CommunityRotation` (drop unavailable skills, note them); disagreement when position differs by >= 2 or community lacks a skill we cast >= 5% of damage. Positions 1-based, -1 = absent; `dps_delta_pct = (ours/community - 1)*100`.
Facade: `Engine.set_config(cfg)` replaces the stored cfg used by all later calls.
Acceptance: `test_candidates_level_gate` (level 1 build excludes skills unlocking later), `test_candidates_no_chain_children` (no CHAIN/PROC/CHARGE_TIER keys), `test_candidates_show_kr` (KR-only skill appears on global only with `show_kr=True`), `test_budget_respected` (spy counts sims <= 400), `test_deterministic_seed`, `test_top_k_distinct`, `test_mini_optimum` (needs_sim; best dps >= 1800, no chain children as entries, amp precedes nuke if both present), `test_finds_known_optimum` (needs_sim; brute-force every ordered subset of length <= 3 of mini candidates inside the test; best search dps >= brute-force best), `test_explain_mentions_skill` (fake results where nuke has the largest per_skill delta: text contains "Nuke" and the % gap to 1 decimal), `test_community_flags_reorder` (fake rotation [strike,nuke] vs best -> Disagreement for nuke with 1-based positions), `test_facade_methods` (`isinstance(Engine(mini_gd), EngineFacade)`, `set_config` takes effect).

### P4 - Upgrade advisor + road map (size S, ~200 lines)

`marginal_stats`: finite difference `(dps(stats+delta)/dps(stats)-1)*100` using `simulate` (module-level import); `StatGain.stat` = the exact `Stats` field name; confidence "estimated" (formula is a community fit). Road map: `gd.roadmap` items + auto items from `skill.unlock_level`, filtered by region and cap, sorted by level.
Tests monkeypatch `aion2c.engine.advisor.simulate` with `fake_simulate` (Wave 1); roadmap tests use `sorc_gd` (full roadmap tuple).
Acceptance (`mini_gd`, priority [strike], Stats attack 1000): `test_attack_10` -> +1.0% (tol 1e-6); `test_dmg_boost_1` -> +1.0%; `test_sorted_desc`; `test_combat_speed_positive`; `test_roadmap_global_cap` (max level 45, has level 22 stigma item, slots at 27/32/37); `test_roadmap_korea` (has items > 45); `test_roadmap_unlocks` (`sorc_gd` Hellfire at 14).

### P5 - Keybinds, in-game macros, G915 G-keys (size S-M, ~300 lines)

Design rules in section 5. `recommend_stacks`: keep the user's existing key label for each skill where possible (labels only from `models.KEY_LABELS`); stacks <= 4 in priority order; a 0-cooldown skill only in the last row; MANUAL set (Hellfire, Defiance, Dodge, defensives, mobility) gets single-skill slots and never enters a macro. With `auto_chain=False`, chain children are placed explicitly in the parent's stack. `require_status` cannot be expressed in a macro: drop it and add a warning.
`build_macros`: returns BOTH "Boss loop" (boss_180 priority, hotkey `hotkeys["boss"]`) and "AoE loop" (aoe_pack priority, hotkey `hotkeys["aoe"]`). Because the macro runs entries IN ORDER (not as a priority list), the layout repeats the top slot between others to approximate priority, e.g. `1,2,1,3,1,4` (pattern: top slot every other entry), <= 20 entries, `delay_ms` from the user setting (default 10; sources conflict 10 vs 40-50 ms at high ping).
`export.plan`: builds stacks + macros + G-keys, then fills `macro_dps` via `simulate_macro` and `ideal_dps` via `simulate` for each scenario, and `manual_every_s` (median gap between the optimizer's casts of each MANUAL skill). Adds a warning when macro DPS < 95% of ideal. Tests patch `aion2c.keybinds.export.simulate` / `simulate_macro` with the fakes.
Acceptance: `test_stack_max4`, `test_zero_cd_last`, `test_manual_not_in_macro` (hellfire), `test_macro_limits` (<=20, default delay 10, custom delay honored), `test_macro_top_slot_repeats` (top slot at every odd entry index), `test_build_macros_both` (2 plans, hotkeys F9/F10 by default, custom hotkeys honored), `test_gkeys_single_key` (every `sends` matches `^(F([1-9]|1[0-2])|[0-9A-Z]|[-=])$`, no `+`, `,`, spaces; every risk in {"lowest_known","caution"}; none "safe"), `test_gkey_count` (exactly 10: G1-G5 x M1, M2; G1 sends the macro hotkeys), `test_plan_fields` (macro_dps, ideal_dps, manual_every_s["hellfire"] filled with fakes), `test_instructions_text` (contains "onboard", "Close G HUB", "Key Settings", "Keys", "not Macro", "Task Manager", "unverified"; no "Lua", no "repeat while held").

### P6 - App shell, state, settings, panel, hotkey (size M, ~400 lines)

`app.py` `main(argv)`: load gamedata (on failure show error dialog + `aion2c/data/fallback_gamedata.json` with a red banner), build `Engine` (or `FakeEngine` with `--fake-engine` / `AION2C_FAKE_ENGINE=1`), `AppState`, `MainWindow`, `Panel`. `__main__`: `--smoke [--shot DIR]` = build all, process events ~500 ms, save window + panel PNGs, exit 0. `AppState`: API exactly as 2.2; debounced (250 ms) optimize in `QThreadPool` on build/scenario/data change; `QFileSystemWatcher` on gamedata.json and user.json emits `dataChanged` and re-runs, but IGNORES change events caused by the app's own `save_user` (compare file mtime/hash recorded at save), otherwise every save loops. Settings use only `DEFAULT_USER` keys. Panel: `FramelessWindowHint | WindowStaysOnTopHint | Tool`, `WA_TranslucentBackground`, opacity from settings (default 0.85), draggable, optional click-through (`WindowTransparentForInput`), 5 icon slots from `engine.next_skills(..., live=source.snapshot(), n=5)` with `NullStateSource` in v1, refresh on `resultsReady`. Hotkey: `RegisterHotKey` via ctypes + `QAbstractNativeEventFilter` (receive only), default `Ctrl+Alt+P`, fallback to in-app `QShortcut` with a status warning.
Acceptance: `test_parse_hotkey` ("Ctrl+Alt+P" -> (0x0002|0x0001, 0x50)), `test_settings_roundtrip` (tmp_path), `test_state_emits_results` (FakeEngine, wait <= 2 s for `resultsReady`), `test_state_debounce` (3 quick set_build -> `fake_engine.calls.count("optimize") == 1`), `test_state_set_config` (dataChanged with new `anim_overrides` in user.json -> `set_config` in calls), `test_settings_self_save_ignored` (save_user does not emit dataChanged), `test_panel_flags` (stay-on-top + frameless set), `test_panel_shows_icons` (after resultsReady the 5 slot keys == `["flame-arrow","burst","pyroclasm","firestorm","hellfire"]`, each slot pixmap non-null), `test_smoke_cli` (subprocess `python -m aion2c --smoke --fake-engine` exit 0 offscreen; W2a drops `--fake-engine`).

### P7 - Window-mode screens (size L, ~700 lines)

`MainWindow`: `QTabWidget` Codex | Build | Upgrade | Road Map | Keybinds; toolbar: region toggle, "show KR data" (`state.set_show_kr`), scenario combo, Panel button (`panelRequested`). Confidence rendering everywhere via W0 `ui/confidence.py` (`fmt_num`, `confidence_color`): confirmed plain, estimated `~` prefix + amber, unknown `?` grey + tooltip with `source`. Icons via `ui.icons.pixmap`. Read state via `AppState` getters only.
- Codex: search list with icons (`allowed_skills(gd, region, state.show_kr())`); detail: description, per-rank table clipped to region rank cap, cooldown/MP/range, chains (Links both ways), specializations.
- Build: level, rank spinners (cap by region), stigmas (<= `gd.stigma_slots[region]`), stats form, scenario, "auto-chain in macro" checkbox (`auto_chain` setting); ranked options table (rank, DPS, confidence, priority icons) + explanation + disagreements + warnings; "Compare" pins build A and shows A vs B DPS per scenario. Calibrate group: skill -> anim seconds table saved to `anim_overrides` (then `state.set_gamedata(state.gamedata())` to trigger `dataChanged` -> `set_config`). Edits call `state.set_build`.
- Upgrade: stats form -> `engine.marginal` table (stat, +delta, DPS %, confidence).
- Road Map: checklist by level band, checks saved to `roadmap_checks`.
- Keybinds: editable skill bar table (key label from `KEY_LABELS` -> skill), macro key fields (`macro_keys`, default F9/F10), macro delay (`macro_delay_ms`), generated stacks/macros/G-keys, macro DPS vs ideal DPS, "press Hellfire every N s", "Copy instructions", "Save .md". A "Generate" button gets the best priority for `boss_180` and `aoe_pack` (`state.best_priority()` for the current one, `engine.optimize(build, other)` for the other, wait cursor) and calls `kb_export.plan(gd, build, priorities, bar, hotkeys, delay_ms)`.
Tests use `fake_engine`, `sorc_gd`, `user_path` (env override), and monkeypatch `aion2c.roadmap.roadmap`, `aion2c.keybinds.export.plan` and `aion2c.keybinds.export.instructions_markdown` with fakes. Acceptance: `test_main_window_tabs` (5 tabs), `test_codex_lists_skills` (13 rows for sorc_gd), `test_calibrate_saves` (editing a row writes `anim_overrides` to user.json and calls `state.set_gamedata`, checked with a spy), `test_codex_rank_cap` (global -> 20 rows max), `test_build_results_table` (3 rows after fake resultsReady), `test_upgrade_table` (3 rows), `test_roadmap_checks_persist` (tmp settings), `test_keybinds_copy` (clipboard text contains "G1").

## 3b. Scope additions: Daevanion, crafting, skill points, stigma points

Research inputs: `research/daevanion_sorcerer.json` + `daevanion_notes.md` (5 boards, 537 nodes, 802 points, orthogonal-adjacency rule from aion2t planner code, medium-high confidence), `research/crafting.json` + `crafting_notes.md` (27 recipes, 18 `sorc_relevant`; item level/stats/sources null), `research/mastery_stigma.md` + `.json` ("Mastery" is only the Skills-window tab listing actives/passives: no extra system; skill-point costs to rank 10 = 1,1,1 (ranks 2-4), 2,2,2 (5-7), 4,4,4 (8-10) = 21/skill, `estimated`; Daevanion adds up to +4 ranks; stigma slots Global L22/27/32/37, stigma cost to rank 20 = 75 points in bands 1/2/4/8, `estimated`).

### W0 adds to `models.py` (exact names)
```python
class DaevanionEffect: stat: str; value: float; unit: str          # raw research names, e.g. "Attack Bonus", "Critical Hit", "Hellfire"
class DaevanionNode:   id: int; name: str; rarity: str; cost: int; node_type: str   # "start" | "stat" | "skill" | other raw
                       effects: tuple[DaevanionEffect, ...]; skill_key: str | None; adjacent: tuple[int, ...]; x: int; y: int
class DaevanionBoard:  key: str; name: str; unlock_level: int; nodes: dict[int, DaevanionNode]; start_id: int
class RecipeMaterial:  item: str; qty: int; source: str | None
class Recipe:          id: int; name: str; profession: str; level: int | None; output_item: str; output_qty: int
                       item_level: int | None; grade: str | None; materials: tuple[RecipeMaterial, ...]
                       base_materials: tuple[RecipeMaterial, ...]; sorc_relevant: bool | None; source_url: str
STAT_MAP: dict[str, tuple[str, float, Confidence]]   # W0 body: raw Daevanion stat -> (Stats field, multiplier, confidence)
    # {"Attack Bonus": ("attack", 1.0, "estimated")}; ratings with unknown %-conversion ("Critical Hit") map to ("", 0, "unknown"): counted, shown, NOT simulated (warning)
SKILL_POINT_COST = (0, 1, 1, 1, 2, 2, 2, 4, 4, 4)    # cost to reach rank i+1 from i; index 0 = rank 1 (free). `estimated`
STIGMA_POINT_COST = tuple([1]*5 + [2]*5 + [4]*5 + [8]*4)  # ranks 2..20, sum 75. `estimated`
```
`GameData` gains `daevanion: dict[str, DaevanionBoard] = {}` and `recipes: tuple[Recipe, ...] = ()`. `CharacterBuild` gains `daevanion_nodes: frozenset[int] = frozenset()`, `skill_points: int | None = None` (None = no budget check), `stigma_points: int | None = None`. Fixtures: `mini_gamedata.json` gets one tiny board `"tiny"` (start 1; nodes 2 "Attack Bonus +10" cost 1 adj [1,3], 3 skill node "+1 strike" cost 2 adj [2], 4 "Critical Hit +50" cost 1 adj [1]) and 2 recipes (one with nested base materials). `sorc_gamedata_small.json` gets the real `nezekan` board and 3 real recipes. W0 stubs `aion2c/daevanion.py`, `aion2c/crafting.py`, `aion2c/ui/daevanion_view.py`, `aion2c/ui/crafting_view.py` (working minimal widgets, `Screen` ctor).

### Ownership additions
| Path | Owner |
|---|---|
| `aion2c/data/build_gamedata.py` reads daevanion + crafting JSON into `GameData` | P1 (extra tests `test_daevanion_counts`: 5 boards, 537 nodes, costs sum 802; `test_recipes_loaded`: 27, 18 sorc_relevant) |
| `aion2c/daevanion.py`, `tests/test_daevanion.py` | P8 |
| `aion2c/ui/daevanion_view.py`, `tests/test_daevanion_view.py` | P8 |
| `aion2c/crafting.py`, `aion2c/ui/crafting_view.py`, `tests/test_crafting*.py` | P9 |
| `aion2c/engine/budget.py`, `tests/test_budget.py` | P4 (added) |

### Engine rule (P2 addition, small)
Effective rank = `effective_rank(...)` + number of selected Daevanion skill nodes for that skill (each +1, cap +4), still clamped to region rank cap. Daevanion stat nodes are applied to `Stats` BEFORE simulation via `daevanion.apply_stats(gd, build) -> Stats` (P8 owns the body; W0 stub returns `build.stats` unchanged; P2 calls it at sim start through a module-level import so tests can patch `aion2c.engine.simulator.apply_stats`). `effective_rank` signature unchanged; P2 adds the node bonus inside the simulator.

### P8 - Daevanion planner (size M, ~400 lines)
`daevanion.py`: `selectable(board, selected: frozenset[int]) -> set[int]` (orthogonal-adjacency rule: node selectable iff any `adjacent` id is `start_id` or selected); `valid(board, selected) -> bool`; `points_spent(gd, selected) -> int`; `apply_stats(gd, build) -> Stats` (via `STAT_MAP`; unknown-mapped stats add nothing); `suggest_path(gd, build, priority, scenario, points: int, board_keys: list[str] | None = None, cfg=SimConfig()) -> tuple[list[int], float]` = greedy: repeatedly add the selectable node (on boards unlocked at `build.level`) with best DPS gain per point (via module-level `simulate`), ties by lower id, skip PvP-only nodes; returns node ids in order + total DPS gain %. Respect `max 4` skill-level bonus per skill.
UI `DaevanionView`: board picker, grid drawn from x/y (QGraphicsScene), click to toggle (only `selectable` or deselect leaves), points used / available, "Suggest" (calls `suggest_path`, highlights path), per-node tooltip with effects + confidence; saves `build.daevanion_nodes` via `state.set_build`.
Acceptance (`mini_gd` tiny board, patch `aion2c.daevanion.simulate` with `fake_simulate`): `test_selectable_start` ({2,4}), `test_invalid_island` ({3} invalid), `test_points` ({2,3} -> 3), `test_apply_stats` (attack +10), `test_suggest_prefers_attack` (first pick 2), `test_skill_cap4`, `test_view_click_toggles` (offscreen), `test_real_board_reachable` (`sorc_gd` nezekan: BFS from start reaches all 89).

### P9 - Crafting (size S, ~250 lines)
`crafting.py`: `sorc_recipes(gd) -> list[Recipe]` (sorc_relevant True or None, flagged), `shopping_list(gd, recipe_ids_qty: dict[int,int], expand: bool = True) -> list[RecipeMaterial]` (sums `base_materials` when expand else `materials`, merged by item name, sorted by name), `search(gd, text) -> list[Recipe]`.
UI `CraftingView`: recipe list (filter Sorcerer / all, search), detail (materials + expanded tree, "item level/stats unknown" placeholder), add-to-list with quantity, aggregated shopping checklist saved in user settings key `craft_list` (W0 adds `"craft_list": {}` and `"craft_checks": []` to `DEFAULT_USER`), "Copy list".
Acceptance: `test_shopping_merge` (two recipes sharing a material sum qty), `test_expand_flag`, `test_search_case_insensitive`, `test_sorc_filter`, `test_view_list_persists`.

### P4 addition - skill/stigma point budget (`engine/budget.py`)
`allocate_points(gd, build, priority, scenario, cfg=SimConfig()) -> tuple[dict[str,int], list[tuple[str,int,float]]]`: greedy marginal allocation of `build.skill_points` across castable skills in `priority` (cost from `SKILL_POINT_COST`, base cap rank 10) and `build.stigma_points` across chosen stigmas (`STIGMA_POINT_COST`, region stigma cap); returns new `skill_ranks` + log of (skill, new rank, DPS gain %). Patch `aion2c.engine.budget.simulate` in tests. Acceptance: `test_budget_never_overspends`, `test_budget_cost_table` (rank 10 costs 21), `test_budget_prefers_damage` (mini_gd: strike-only priority puts points into strike).

### P7 changes
`MainWindow` tabs become 7: Codex | Build | Upgrade | Daevanion | Crafting | Road Map | Keybinds (Daevanion and Crafting tabs instantiate P8/P9 `Screen` classes; P7 does not edit their files). Build screen adds skill-point and stigma-point fields + "Auto-spend points" button (calls `aion2c.engine.budget.allocate_points`, module import style). `test_main_window_tabs` expects 7.

### v2 seam (defined now, NOT built)

`interfaces.LiveStateSource.snapshot() -> LiveState | None`. v1 wires `NullStateSource`. v2 adds `aion2c/vision/screen_reader.py` implementing it (screen capture of user-calibrated regions from their screenshots: skill-bar cooldown sweeps, buff icons, boss HP bar). The panel and `next_skills` already accept `LiveState`, so v2 touches no v1 file except one line in `app.py`. v2 stays behind an explicit opt-in setting because its ToS status is unverified (section 6).

## 4. Wave 2 - integration and verification

| Pkg | Agent | Work |
|---|---|---|
| W2a Integrate | 1 | Run P1 build; fix import/contract adapter mismatches listed in Wave 1 reports; write `tests/test_integration.py` and `tests/test_no_automation.py`; remove the `needs_sim` xfail markers; switch `test_smoke_cli` to the real engine (no `--fake-engine`); run everything below until green. |
| W2b Verify | 1 (after W2a, fresh eyes) | Re-run all commands independently; re-derive every P2 hand-computed total on paper and compare; open the smoke PNGs and confirm the window and panel actually render icons; grep for automation APIs; check every Wave 1 "done" claim against files. Reports pass counts and a list of anything faked or skipped. |

`tests/test_integration.py`: real `gamedata.json` loads; `Engine.optimize` on real data for each of the 3 scenarios (global, level 45, default Stats) finishes < 20 s with dps > 0 and >= 1 option; community comparison returns without error; `plan()` on real data with a defined integration `SkillBar` (same labels as `sorc_bar`) and the boss/aoe best priorities yields exactly 10 G-key assignments (5 per M1/M2), `macro_dps["Boss loop"] <= ideal_dps["boss_180"]`; `marginal()` returns >= 8 rows; changing `build.level` 45 -> 14 changes the best priority (Hellfire present at 14), and `grace_of_enhancement` is absent from the best result's `status_uptime` at 14 but present at 45.
`tests/test_no_automation.py`: scans `aion2c/**/*.py` and `scripts/*.ps1` source text (excluding the test itself); asserts the scanned file count is > 30 (no vacuous pass); fails on `SendInput`, `keybd_event`, `mouse_event`, `pyautogui`, `pynput`, `pydirectinput`, `import keyboard`, `import mouse`, `win32api`, `interception`, `ahk`, `autoit`, `ReadProcessMemory`, `WriteProcessMemory`, `OpenProcess`, `scapy`, `pydivert`, `PostMessage`, `SendMessage`. Matching is case-sensitive word-boundary regex. A self-test writes a temp file containing `SendInput` and asserts the scanner flags it.

Commands (PowerShell, from `D:\Aion2\app`):

```powershell
python -m aion2c.data.build_gamedata                      # writes aion2c/data/gamedata.json + icons
python -m pytest tests -q                                   # all unit + integration; report "N passed"
python -m pytest tests -q -m needs_sim                      # optimizer on real simulator
$env:QT_QPA_PLATFORM='offscreen'; python -m aion2c --smoke --shot "$env:TEMP\aion2c_smoke"; echo "exit=$LASTEXITCODE"
python -m aion2c.data.update --dry-run                      # manual only, hits aion2.app; prints diff
python -m aion2c                                            # real launch for Jon
```

Release gate: pytest summary shows 0 failed / 0 errors, smoke exit 0 with two non-blank PNGs, no-automation test passes, W2b report has no unresolved items.

## 5. Macros and G-keys: what the game allows, and the G915 design

What Aion 2 allows (research `macros_ingame.md`, `gkeys_ghub.md`; KR rules assumed for Global, no Global statement found):
| Feature | Status |
|---|---|
| In-game macro editor (Skill window K > Macro) | YES, legal. Up to 20 numbered entries (one low-quality source says "2 skills per macro"; unverified), each with a delay (10 ms recommended; one guide says 40-50 ms at 80-100+ ping, so delay is a user setting). Runs only while its key is HELD, loops through entries IN ORDER, skips anything unusable and moves to the next entry (Q>W>E>R loops QWERQWER). No conditionals. Bound in Settings > Key Settings > General > Gameplay > Macro (unbound by default). |
| Slot stacking | Each hotbar slot holds up to 4 skills; a press fires the highest-priority usable one. This is the only true priority layer. Macro entries point at slots and run in order, so a macro is NOT a priority list: the app approximates priority by repeating the top slot (`1,2,1,3,1,4`) and scores the actual macro with `simulate_macro`, showing macro DPS next to ideal DPS. Trap: a 0-cooldown skill above row 4 starves the rows below it. |
| Animation cancel | Basic attack cancels animations; holding LMB with the macro key weaves basic attacks in. Not modelled (section 6). |
| Chains | Flame Arrow > Burst > Pyroclasm confirmed; whether a held macro picks follow-ups is unverified (test in game). |
| Hardware/software macros (G HUB macros, Lua, Synapse, AHK) | Against ToS. KR waves of bans and 30-day suspensions; client has detected and blocked G HUB/Synapse/iCUE processes at least once (Dec 2025). |
| 1:1 key remap | No official statement. Lowest KNOWN risk, residual risk unverified; the app labels it `lowest_known`, never "safe". |
| Third-party overlay (our Panel) and v2 screen reader | Not covered by any source found; NCGuard is installed and NC prosecutes "illegal programs". Unverified (section 6). Overlay needs the game in borderless window mode to appear on top. |

The app's role: compute the priority list, turn it into slot stacks + in-game macro entries, and write a step-by-step sheet. The player types it into the game once. The app never sends input.

G915 design (onboard memory, G HUB closed before launching Aion 2, every G-key sends exactly ONE key, no repeat, no delays, no Lua):
| G-key | M1 Boss | M2 AoE / leveling | In-game binding |
|---|---|---|---|
| G1 | `F9` hold = macro "Boss loop" | `F10` hold = macro "AoE loop" | Key Settings > Macro 1 = F9, Macro 2 = F10 |
| G2 | Hellfire slot key (manual full charge) | Frost Burst / Winter's Shackles slot | skill bar key |
| G3 | Defiance (CC break) | Defiance | skill bar key |
| G4 | Buff stack slot: Element Enhancement > Wish of Concentration > Delayed Explosion | Fire Wall > Cold Storm stack | skill bar key (stacked slot) |
| G5 | Defensive (Steel Barrier) | Bittercold Wind (root/escape) | skill bar key |
G900 mouse (Jon also has one): same rules, onboard memory, each button sends ONE key. Spare buttons: 4 side (2 per side), 2 DPI (if Jon gives up DPI switching), wheel tilt L/R. Not part of the `GKeyAssignment` contract (G-keys are a minor feature; no contract change). `instructions_markdown` appends a short "G900 (optional)" section suggesting thumb buttons for the two highest-frequency MANUAL skills (Hellfire, Defiance) and the dodge, with the same `lowest_known` risk note. Note: the KR 30-day suspensions cited "hardware mouse macros"; a 1:1 remap is not a macro, but no source confirms that distinction.
M3 left free. If the game allows only one macro, G1-M2 falls back to the same F9 with the AoE stack swapped in via hotbar preset 2. If a macro holds only 2 entries, the fallback layout is `[top slot, filler slot]` with all other skills folded into those two 4-skill stacks. The exact keys follow the user's entered skill bar and `macro_keys`; P5 computes them. G1 must send the macro hotkey as a HELD key (key down on press, up on release); if it only taps, the in-game macro runs once.
Setup sheet steps (P5 `instructions_markdown`, wording required by tests): G HUB > keyboard > Onboard Memory Mode > Assignments > **Keys** tab (single keystroke), NOT the Macros tab > never use MR on-the-fly recording (it records a timed macro) > save to M1/M2 > quit G HUB (tray too) > open Task Manager and confirm no `lghub*` processes (`lghub_agent`, `lghub_updater`) remain > in game, optionally turn off "quickslot long-press input" and "aim target hold" (unverified tip) > launch game. The sheet states plainly that the remap risk is unverified (no official statement).
Programmatic G HUB profile import: NOT in v1 (undocumented `settings.db` schema, unofficial, and G HUB must not run beside the game anyway). The instruction sheet is the deliverable.

## 6. Known data gaps, what Jon provides after launch, graceful degradation

| Gap | Impact | Jon provides (after 2026-10-05) | Meanwhile |
|---|---|---|---|
| Animation lock per skill (client `cast_time_s` = 0 everywhere) | Sim timing, the biggest DPS error | Short screen recordings of each skill cast on a dummy (or stopwatch: 10 casts of one skill), entered in Build > Calibrate | 1.0 s default (1.5 s long casts), shown `~ estimated`; overrides saved in user.json, auto re-run |
| Rank scaling of ATK ratio (rank-1 only) | Absolute DPS AND ranking at ranks > 1 (flat grows with rank, ratio fixed, so rankings can flip) | Dummy damage numbers for 3-4 skills at 2 ranks + character Attack | Assume ratio constant, flat from per_level; "ranking assumed, unverified at rank > 1" warning on every result with a rank > 1 |
| Buff/debuff numbers (Element Enhancement duration, Delayed Explosion (sources conflict: 20 s/+25% vs 30 s/+15%), DoTs, Fire Wall/Cold Storm/Firestorm ticks, Wish of Concentration) | Buff placement in priority; DoT skills ranked too low | Tooltip screenshots of these skills | Values in mechanics.json flagged; `Status.tick_ratio_pct`/`tick_s` fields exist so Jon's numbers drop straight in; unknown DoTs count 0 damage + a warning naming the skill |
| Animation cancel via basic attack | Sim counts full lock every cast, error comparable to the anim-lock gap | Recording of a cancel rotation vs no cancel | Sim assumes no cancel, so DPS is a floor; measured effective locks can go in the Calibrate table |
| Overlay / screen reader ToS | Panel (v1) and v2 reader may be "third-party programs" | Nothing; Jon decides risk | Unverified; v2 opt-in only; panel requires borderless window mode |
| G915 onboard memory on this unit; held G-key = held key | G-key plan (G1 must hold F9) | One test: G1 -> F9 onboard, hold it in-game, does the macro keep looping? | Sheet says "verify"; fallback is pressing F9 directly |
| Hellfire charge timing | Charge-level choice | Recording of a full charge | 0/1/2 s estimate |
| Global vs KR skill set (12 KR-only skills) | Codex and candidates | Screenshot of in-game Skill window (Active/Stigma tabs) | Hidden on global by default, toggle to show |
| Fire Mark proc rate, crit cap/base, Smite, MP thresholds (25 vs 50%) | Small DPS shifts | Nothing required; optional character sheet screenshot | Community values, `estimated` |
| HUD positions (for v2) | v2 only | 3-5 full-resolution HUD screenshots in combat | v1 panel is static |
| Macro behavior on chains, max macro count, entries per macro (20 vs "2") | Keybind plan, DPS and MP (Flame Arrow chain is the main filler + MP restore) | One test: hold macro with Flame Arrow slot, does Burst fire? Count macro slots and max entries | `SimConfig.auto_chain` toggle (default True, Build screen checkbox); with False the plan places children explicitly; 2 macros and 20 entries assumed, 2-entry fallback layout noted |

Degradation rules: missing number -> default + `Num.confidence="unknown"` + warning in `SimResult.warnings`, never an exception; UI shows a yellow banner "N values estimated, M unknown - calibrate" linking to the affected skills; gamedata load failure falls back to the bundled fixture with a red banner; update script failure leaves the current file untouched.
