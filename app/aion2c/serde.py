"""Generic, type-hint driven serde for every model dataclass. Wave 0 owns this file."""
import dataclasses
import types
import typing
from enum import Enum
from typing import Any, Literal, Union, get_args, get_origin, get_type_hints

from aion2c import models


def to_dict(obj: Any) -> Any:
    """Dataclass -> JSON-safe structure (dict keys become str, sets/tuples become lists)."""
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return {f.name: to_dict(getattr(obj, f.name)) for f in dataclasses.fields(obj)}
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, dict):
        return {str(k): to_dict(v) for k, v in obj.items()}
    if isinstance(obj, (frozenset, set)):
        return sorted((to_dict(v) for v in obj), key=lambda x: (str(type(x)), x))
    if isinstance(obj, (tuple, list)):
        return [to_dict(v) for v in obj]
    return obj


_HINTS: dict[type, dict[str, Any]] = {}


def _hints(cls: type) -> dict[str, Any]:
    if cls not in _HINTS:
        _HINTS[cls] = get_type_hints(cls, vars(models))
    return _HINTS[cls]


def _dec(tp: Any, v: Any) -> Any:
    origin = get_origin(tp)
    if tp is Any or v is None:
        return v
    if origin in (Union, types.UnionType):
        args = [a for a in get_args(tp) if a is not type(None)]
        return _dec(args[0], v) if len(args) == 1 else v
    if origin is Literal:
        return v
    if origin is tuple:
        args = get_args(tp)
        if len(args) == 2 and args[1] is Ellipsis:
            return tuple(_dec(args[0], x) for x in v)
        return tuple(_dec(a, x) for a, x in zip(args, v))
    if origin in (frozenset, set):
        (a,) = get_args(tp)
        return frozenset(_dec(a, x) for x in v)
    if origin is list:
        (a,) = get_args(tp)
        return [_dec(a, x) for x in v]
    if origin is dict:
        kt, vt = get_args(tp)
        key = int if kt is int else (lambda k: k)
        return {key(k): _dec(vt, x) for k, x in v.items()}
    if isinstance(tp, type):
        if dataclasses.is_dataclass(tp):
            return from_dict(tp, v)
        if issubclass(tp, Enum):
            return tp(v)
        if tp is float and isinstance(v, int) and not isinstance(v, bool):
            return float(v)
    return v


def _norm_specs(v: Any) -> dict[str, tuple[int, ...]]:
    """CharacterBuild.specs is skill key -> tuple of chosen 0-based option indices. Older saves hold a bare
    int, a list, or junk: keep the ints, drop the rest (out-of-range options are ignored by the engine)."""
    out: dict[str, tuple[int, ...]] = {}
    if not isinstance(v, dict):
        return out
    for k, x in v.items():
        items = x if isinstance(x, (list, tuple)) else [x]
        ints = tuple(dict.fromkeys(int(i) for i in items if isinstance(i, (int, float)) and not isinstance(i, bool)))
        if ints:
            out[str(k)] = ints
    return out


def from_dict(cls: type, d: dict) -> Any:
    """Inverse of to_dict for dataclass `cls`. Missing keys fall back to field defaults."""
    hints = _hints(cls)
    kwargs = {}
    if cls is models.CharacterBuild and "specs" in d:
        d = {**d, "specs": _norm_specs(d["specs"])}
    for f in dataclasses.fields(cls):
        if f.name in d:
            kwargs[f.name] = _dec(hints[f.name], d[f.name])
    return cls(**kwargs)
