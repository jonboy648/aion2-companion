import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gamedata, iconUrls, keybinds, optimize } from "@/engine/api";
import type { CharacterBuild, GameData, IconUrls, KeybindsResult, Priority } from "@/lib/types";
import { hashBuild, loadJson, saveJson } from "./activeBuild";

export type Priorities = { boss_180: Priority; aoe_pack: Priority };
export type Hotkeys = { boss: string; aoe: string };

export const DEFAULT_HOTKEYS: Hotkeys = { boss: "F9", aoe: "F10" };
export const HOTKEY_CHOICES = ["F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"];
export const DELAY_MIN = 0;
export const DELAY_MAX = 500;

/** Slot warnings the layout emits for every unpinned slot; shown as one hint instead of a wall of amber. */
export const isSlotHint = (w: string) => /^slot \S+: not on your bar/.test(w);

type Pins = Record<string, string>;
type Phase = { status: "loading"; message: string } | { status: "ready" } | { status: "error"; message: string };

const prioKey = (hash: string) => `aion2c.kb.prio.v1:${hash}`;
const pinKey = (classKey: string) => `aion2c.kb.pins.v1:${classKey}`;
const prefsKey = "aion2c.kb.prefs.v1";

export function useKeybindPlan(build: CharacterBuild | null) {
  const classKey = build?.class_key ?? null;
  const buildHash = useMemo(() => (build ? hashBuild(build) : ""), [build]);

  const [gd, setGd] = useState<GameData | null>(null);
  const [icons, setIcons] = useState<IconUrls>({});
  const [prios, setPrios] = useState<Priorities | null>(null);
  const [phase, setPhase] = useState<Phase>({ status: "loading", message: "Loading class data" });
  const [result, setResult] = useState<KeybindsResult | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [pins, setPins] = useState<Pins>({});
  const [delayMs, setDelayMs] = useState<number>(() => loadJson(prefsKey, { delay: 10, hotkeys: DEFAULT_HOTKEYS }).delay);
  const [hotkeys, setHotkeys] = useState<Hotkeys>(() => ({ ...DEFAULT_HOTKEYS, ...loadJson(prefsKey, { hotkeys: DEFAULT_HOTKEYS }).hotkeys }));
  const [runNonce, setRunNonce] = useState(0);
  const forceRef = useRef(false);

  useEffect(() => saveJson(prefsKey, { delay: delayMs, hotkeys }), [delayMs, hotkeys]);

  // class data + icon URLs
  useEffect(() => {
    if (!classKey) return;
    let live = true;
    setGd(null);
    Promise.all([gamedata(classKey), iconUrls(classKey)]).then(
      ([g, i]) => {
        if (live) {
          setGd(g);
          setIcons(i);
        }
      },
      (e: unknown) => live && setPhase({ status: "error", message: errMsg(e) }),
    );
    setPins(loadJson<Pins>(pinKey(classKey), {}));
    return () => {
      live = false;
    };
  }, [classKey]);

  // best rotations (boss + AoE), cached by build hash
  useEffect(() => {
    if (!build) return;
    let live = true;
    const cached = forceRef.current ? null : loadJson<Priorities | null>(prioKey(buildHash), null);
    forceRef.current = false;
    if (cached) {
      setPrios(cached);
      setPhase({ status: "ready" });
      return;
    }
    setPrios(null);
    setPhase({ status: "loading", message: "Searching the best boss rotation" });
    (async () => {
      const boss = await optimize(build, "boss", null, (m) => live && setPhase({ status: "loading", message: `Boss rotation: ${m}` }));
      if (!live) return;
      setPhase({ status: "loading", message: "Searching the best AoE rotation" });
      const aoe = await optimize(build, "aoe", null, (m) => live && setPhase({ status: "loading", message: `AoE rotation: ${m}` }));
      if (!live) return;
      const p: Priorities = { boss_180: boss.priority, aoe_pack: aoe.priority };
      saveJson(prioKey(buildHash), p);
      setPrios(p);
      setPhase({ status: "ready" });
    })().catch((e: unknown) => live && setPhase({ status: "error", message: errMsg(e) }));
    return () => {
      live = false;
    };
  }, [build, buildHash, runNonce]);

  // plan (stacks, macros, G-keys, DPS) whenever an input changes; debounced so typing a delay stays smooth
  useEffect(() => {
    if (!build || !prios) return;
    let live = true;
    setPlanError(null);
    const t = setTimeout(() => {
      keybinds(build, prios, pins, { boss: hotkeys.boss, aoe: hotkeys.aoe }, delayMs).then(
        (r) => live && setResult(r),
        (e: unknown) => live && setPlanError(errMsg(e)),
      );
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [build, prios, pins, hotkeys, delayMs]);

  const updatePins = useCallback(
    (fn: (p: Pins) => Pins) => {
      setPins((prev) => {
        const next = fn(prev);
        if (classKey) saveJson(pinKey(classKey), next);
        return next;
      });
    },
    [classKey],
  );
  const pin = useCallback(
    (label: string, skillKey: string) =>
      updatePins((p) => {
        const next = Object.fromEntries(Object.entries(p).filter(([l, s]) => l !== label && s !== skillKey));
        next[label] = skillKey;
        return next;
      }),
    [updatePins],
  );
  const unpin = useCallback(
    (label: string) => updatePins((p) => Object.fromEntries(Object.entries(p).filter(([l]) => l !== label))),
    [updatePins],
  );
  const clearPins = useCallback(() => updatePins(() => ({})), [updatePins]);
  const rerun = useCallback(() => {
    forceRef.current = true;
    setRunNonce((n) => n + 1);
  }, []);

  return {
    gd,
    icons,
    phase,
    result,
    planError,
    pins,
    pin,
    unpin,
    clearPins,
    delayMs,
    setDelayMs: (n: number) => setDelayMs(Math.max(DELAY_MIN, Math.min(DELAY_MAX, Math.round(Number.isFinite(n) ? n : 10)))),
    hotkeys,
    setHotkey: (which: keyof Hotkeys, key: string) => setHotkeys((h) => ({ ...h, [which]: key })),
    rerun,
  };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
