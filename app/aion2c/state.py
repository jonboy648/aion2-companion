"""Shared app state: build/scenario/data, debounced optimize on a worker thread, file watchers.

`refresh()` is the immediate synchronous run (kept for callers that want a result now);
`schedule_refresh()` is the debounced thread-pool path every setter uses.
"""
import sys
from collections.abc import Callable
from dataclasses import replace
from pathlib import Path

from PySide6.QtCore import QFileSystemWatcher, QObject, QRunnable, QThreadPool, QTimer, Signal

import aion2c.settings as settings
from aion2c.interfaces import EngineFacade
from aion2c.models import (
    SCENARIOS,
    CharacterBuild,
    GameData,
    OptimizeResult,
    Priority,
    Scenario,
    SimConfig,
)

DEBOUNCE_MS = 250


def config_from_settings(user: dict) -> SimConfig:
    """SimConfig from the user.json keys `anim_overrides` and `auto_chain`."""
    ov = {}
    for k, v in (user.get("anim_overrides") or {}).items():
        try:
            ov[str(k)] = float(v)
        except (TypeError, ValueError):
            continue
    return SimConfig(anim_overrides=ov, auto_chain=bool(user.get("auto_chain", True)))


def _load_class(key: str) -> GameData:
    from aion2c.data.loader import load_gamedata

    return load_gamedata(class_key=key)


class _Relay(QObject):
    done = Signal(int, object, str)  # generation, OptimizeResult | None, error text


class _Job(QRunnable):
    def __init__(self, relay: _Relay, gen: int, engine: EngineFacade, build: CharacterBuild, scenario: Scenario):
        super().__init__()
        self.relay, self.gen, self.engine, self.build, self.scenario = relay, gen, engine, build, scenario

    def run(self) -> None:
        try:
            res, err = self.engine.optimize(self.build, self.scenario), ""
        except Exception as e:  # never let a worker exception kill the app
            res, err = None, f"{type(e).__name__}: {e}"
        self.relay.done.emit(self.gen, res, err)


class AppState(QObject):
    buildChanged = Signal()
    resultsReady = Signal(object)  # OptimizeResult for the CURRENT scenario only
    dataChanged = Signal()

    def __init__(
        self,
        engine: EngineFacade,
        gd: GameData,
        build: CharacterBuild,
        scenario_key: str = "boss_180",
        parent=None,
        gd_loader: Callable[[str], GameData] | None = None,
    ):
        super().__init__(parent)
        self._engine, self._gd, self._build = engine, gd, build
        self._gd_loader = gd_loader  # class_key -> GameData; default is the shipped per-class file
        self._scenario = next(s for s in SCENARIOS if s.key == scenario_key)
        self._result: OptimizeResult | None = None
        self.last_error = ""
        self._gen = 0  # bumped on every scheduled run; stale worker results are dropped

        self._pool = QThreadPool(self)
        self._pool.setMaxThreadCount(1)
        self._relay = _Relay(self)
        self._relay.done.connect(self._on_done)
        self._timer = QTimer(self)
        self._timer.setSingleShot(True)
        self._timer.setInterval(DEBOUNCE_MS)
        self._timer.timeout.connect(self._start_job)

        self.dataChanged.connect(self._on_data_changed)
        self._watcher = QFileSystemWatcher(self)
        self._watcher.fileChanged.connect(self._on_file_changed)
        self._watcher.directoryChanged.connect(self._on_file_changed)
        self._user_file = settings.user_path()
        self._data_file = self._default_data_file(gd.class_key)
        self._seen: dict[str, str | None] = {}
        for f in (self._user_file, self._data_file):
            if f is not None:
                self._seen[str(f)] = settings.content_hash(f)
        self._rewatch()

    # getters
    def build(self) -> CharacterBuild:
        return self._build

    def scenario(self) -> Scenario:
        return self._scenario

    def gamedata(self) -> GameData:
        return self._gd

    def engine(self) -> EngineFacade:
        """The CURRENT engine; set_class replaces it, so screens must not cache it."""
        return self._engine

    def class_key(self) -> str:
        return self._build.class_key

    def best_priority(self) -> Priority | None:
        r = self._result
        return r.options[0].priority if r and r.options else None

    def show_kr(self) -> bool:
        return self._build.show_kr

    def current_result(self) -> OptimizeResult | None:
        return self._result

    # running the engine
    def apply_settings(self) -> SimConfig:
        """Push `anim_overrides` / `auto_chain` from user.json into the engine."""
        cfg = config_from_settings(settings.load_user(self._user_file))
        self._engine.set_config(cfg)
        return cfg

    def refresh(self) -> None:
        """Immediate synchronous optimize (no debounce, no thread)."""
        self._timer.stop()
        self._gen += 1
        self._result = self._engine.optimize(self._build, self._scenario)
        self.resultsReady.emit(self._result)

    def schedule_refresh(self) -> None:
        """Debounced optimize on the worker thread; repeated calls within 250 ms collapse to one."""
        self._timer.start()

    def _start_job(self) -> None:
        self._gen += 1
        self._pool.start(_Job(self._relay, self._gen, self._engine, self._build, self._scenario))

    def _on_done(self, gen: int, res, err: str) -> None:
        if gen != self._gen:
            return  # a newer run was requested meanwhile
        if res is None:
            self.last_error = err
            print(f"aion2c: optimize failed: {err}", file=sys.stderr)
            return
        self.last_error = ""
        self._result = res
        self.resultsReady.emit(res)

    def shutdown(self) -> None:
        """Stop timers and wait for the worker (call before the QApplication goes away)."""
        self._timer.stop()
        self._gen += 1
        self._pool.waitForDone(30000)

    # setters
    def set_build(self, b: CharacterBuild) -> None:
        self._build = b
        self.buildChanged.emit()
        self.schedule_refresh()

    def set_scenario(self, key: str) -> None:
        self._scenario = next(s for s in SCENARIOS if s.key == key)
        self._result = None  # results are for the CURRENT scenario only
        self._gen += 1
        self.buildChanged.emit()
        self.schedule_refresh()

    def set_show_kr(self, v: bool) -> None:
        self.set_build(replace(self._build, show_kr=bool(v)))

    def set_gamedata(self, gd: GameData) -> None:
        self._gd = gd
        self.dataChanged.emit()

    def set_class(self, key: str) -> None:
        """Switch class: load its GameData, rebuild the engine, keep name/region/level/stats/show_kr and
        clear everything class-specific (ranks, stigmas, specs, points, Daevanion). No-op if unchanged."""
        if key == self._build.class_key and key == self._gd.class_key:
            return
        gd = self._gd_loader(key) if self._gd_loader else _load_class(key)
        self._gd = gd
        self._engine = self._rebuild_engine(gd)
        self._data_file = self._default_data_file(key)
        self._seen[str(self._data_file)] = settings.content_hash(self._data_file) if self._data_file else None
        self._rewatch()
        self._build = replace(
            self._build, class_key=key, skill_ranks={}, stigmas=(), specs={}, daevanion_nodes=frozenset(),
            skill_points=None, stigma_points=None,
        )
        self._result = None
        self._gen += 1  # drop in-flight results computed for the old class
        self.dataChanged.emit()  # screens rebuild their skill widgets; also re-applies settings and re-runs
        self.buildChanged.emit()

    def _rebuild_engine(self, gd: GameData) -> EngineFacade:
        """A real Engine is rebuilt for the new data; any other engine (fake) is kept as is."""
        from aion2c.engine.facade import Engine

        if isinstance(self._engine, Engine):
            return Engine(gd, self._engine.cfg)
        return self._engine

    def _on_data_changed(self) -> None:
        self.apply_settings()
        self.schedule_refresh()

    # file watching
    @staticmethod
    def _default_data_file(class_key: str = "sorcerer") -> Path | None:
        try:
            from aion2c.data.loader import default_path

            p = Path(default_path(class_key))
            return p if p.exists() else None
        except Exception:
            return None

    def _rewatch(self) -> None:
        """(Re)add watched paths: files vanish from the watcher after replace-style writes."""
        have = set(self._watcher.files()) | set(self._watcher.directories())
        for f in (self._user_file, self._data_file):
            if f is None:
                continue
            for p in (f, f.parent):
                if p.exists() and str(p) not in have:
                    self._watcher.addPath(str(p))

    def _on_file_changed(self, _path: str) -> None:
        self._rewatch()
        for f in (self._user_file, self._data_file):
            if f is None:
                continue
            h = settings.content_hash(f)
            if h == self._seen.get(str(f)):
                continue
            self._seen[str(f)] = h
            if f == self._user_file and h is not None and h == settings.last_saved_hash(f):
                continue  # our own save_user: do not loop
            if f == self._data_file and h is not None:
                try:
                    from aion2c.data.loader import load_gamedata

                    self._gd = load_gamedata(f, self._gd.class_key)
                except Exception as e:
                    print(f"aion2c: gamedata reload failed: {e}", file=sys.stderr)
                    continue
            self.dataChanged.emit()
