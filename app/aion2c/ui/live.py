"""`gd` and `engine` attributes that follow AppState.

AppState.set_class swaps the GameData and the engine; a screen that cached them in __init__ would keep
using the old class. Mix `LiveBound` into a screen that does `self.state, self.gd, self.engine = ...`:
reads return what the state holds NOW, except that a value passed in is kept for as long as the state's
own value is unchanged (tests construct screens with a gd/engine that differ from the state's).
"""
_NONE = object()


class _Live:
    def __init__(self, method: str):
        self._method = method

    def _current(self, state):
        fn = getattr(state, self._method, None)  # test stubs may not implement every getter
        return fn() if fn is not None else _NONE

    def __set_name__(self, owner, name: str) -> None:
        self._slot = f"_live_{name}"

    def __get__(self, obj, owner=None):
        if obj is None:
            return self
        cur = self._current(obj.state)
        given = obj.__dict__.get(self._slot)
        if given is not None and given[1] is cur:
            return given[0]
        return cur

    def __set__(self, obj, value) -> None:
        obj.__dict__[self._slot] = (value, self._current(obj.state))


class LiveBound:
    gd = _Live("gamedata")
    engine = _Live("engine")
