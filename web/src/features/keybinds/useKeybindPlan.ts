import { useCallback, useEffect, useMemo, useState } from "react";
import { gamedata, iconUrls, keybinds } from "@/engine/api";
import type { CharacterBuild, GameData, IconUrls, KeybindsResult, Priority } from "@/lib/types";
import { hashBuild, loadJson, saveJson, type MacroScenario, type PlannedBuild } from "./activeBuild";

export type Priorities = Partial<Record<MacroScenario, Priority>>;
export type Hotkeys = { boss: string; aoe: string; leveling: string };

export const DEFAULT_HOTKEYS: Hotkeys = { boss: "F9", aoe: "F10", leveling: "F11" };
export const HOTKEY_CHOICES = ["F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"];
export const DELAY_MIN = 10;
export const DELAY_MAX = 9900;

/** Slot warnings the layout emits for every unpinned slot; shown as one hint instead of a wall of amber. */
export const isSlotHint = (w: string) => /^slot \S+: not on your bar/.test(w);

type Pins = Record<string, string>;
type Phase = { status: "loading"; message: string } | { status: "ready" } | { status: "error"; message: string };

const pinKey = (classKey: string) => `aion2c.kb.pins.v2:${classKey}`;
const bindingsKey = "aion2c.kb.bindings.v1";
const prefsKey = "aion2c.kb.prefs.v1";
const normalizeDelay = (value: unknown) => Math.max(DELAY_MIN, Math.min(DELAY_MAX,
  Math.round(typeof value === "number" && Number.isFinite(value) ? value : 10)));
function savedBindings(): Record<string, string> {
  const value = loadJson<unknown>(bindingsKey, {});
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, binding]) => /^(?:[1-9]|1[0-2])$/.test(id)
    && typeof binding === "string" && binding.trim().length > 0 && binding.length <= 24)
    .map(([id, binding]) => [id, (binding as string).trim()]));
}
function savedPins(classKey: string): Pins {
  const value = loadJson<unknown>(pinKey(classKey), {});
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, skill]) => /^(?:[1-9]|1[0-2])$/.test(id)
    && typeof skill === "string" && skill.length > 0 && skill.length <= 100));
}

export function useKeybindPlan(build: CharacterBuild | null, planned: PlannedBuild | null = null) {
  const classKey = build?.class_key ?? null;
  const buildHash = useMemo(() => (build ? hashBuild(build) : ""), [build]);

  const [gd, setGd] = useState<GameData | null>(null);
  const [icons, setIcons] = useState<IconUrls>({});
  const [prios, setPrios] = useState<Priorities | null>(null);
  const [phase, setPhase] = useState<Phase>({ status: "loading", message: "Loading class data" });
  const [result, setResult] = useState<KeybindsResult | null>(null);
  const [updating, setUpdating] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [pins, setPins] = useState<Pins>({});
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);
  const [bindings, setBindings] = useState<Record<string, string>>(savedBindings);
  const availablePins = useMemo(() => Object.fromEntries(Object.entries(pins).filter(([, key]) => {
    const skill = gd?.skills[key];
    return build && gd?.class_key === build.class_key && skill && (skill.unlock_level ?? 0) <= build.level
      && skill.regions.includes(build.region)
      && (skill.kind !== "stigma" || build.stigmas.includes(key));
  })), [pins, gd, build]);
  const [delayMs, setDelayMs] = useState<number>(() => normalizeDelay(loadJson(prefsKey, { delay: 10, hotkeys: DEFAULT_HOTKEYS })?.delay));
  const [hotkeys, setHotkeys] = useState<Hotkeys>(() => ({ ...DEFAULT_HOTKEYS, ...loadJson(prefsKey, { hotkeys: DEFAULT_HOTKEYS })?.hotkeys }));
  const [runNonce, setRunNonce] = useState(0);

  useEffect(() => saveJson(prefsKey, { delay: delayMs, hotkeys }), [delayMs, hotkeys]);

  // class data + icon URLs
  useEffect(() => {
    if (!classKey) return;
    let live = true;
    setGd(null);
    setIcons({});
    Promise.allSettled([gamedata(classKey), iconUrls(classKey)]).then(([g, i]) => {
      if (!live) return;
      if (g.status === "rejected") setPhase({ status: "error", message: errMsg(g.reason) });
      else setGd(g.value);
      if (i.status === "fulfilled") setIcons(i.value);
    });
    setPins(savedPins(classKey));
    const legacy = loadJson<unknown>(`aion2c.kb.pins.v1:${classKey}`, null);
    setMigrationNotice(legacy && typeof legacy === "object" && Object.keys(legacy).length
      ? "Previous keyboard-based pins were not imported into Quick Use actions. Review and assign them again; the old record is preserved." : null);
    return () => {
      live = false;
    };
  }, [classKey, runNonce]);

  // Native setup does not depend on an expensive rotation search.
  useEffect(() => {
    setResult(null);
    setPlanError(null);
    if (!build) { setPrios(null); return; }
    if (planned && planned.buildHash === buildHash) {
      setPrios({ [planned.scenario]: planned.priority });
      setPhase({ status: "ready" });
      return;
    }
    setPrios({});
    setPhase({ status: "ready" });
  }, [build, buildHash, runNonce, planned]);

  // plan (stacks, macros, G-keys, DPS) whenever an input changes; debounced so typing a delay stays smooth
  useEffect(() => {
    if (!build || !prios || !gd || gd.class_key !== build.class_key) return;
    setUpdating(true);
    let live = true;
    setPlanError(null);
    const t = setTimeout(() => {
      keybinds(build, prios, availablePins, hotkeys, delayMs, bindings).then(
        (r) => { if (live) { setResult(r); setUpdating(false); } },
        (e: unknown) => { if (live) { setPlanError(errMsg(e)); setUpdating(false); } },
      );
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [build, prios, availablePins, hotkeys, delayMs, gd, bindings]);

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
    setRunNonce((n) => n + 1);
  }, []);

  return {
    gd,
    icons,
    phase,
    result,
    bindings,
    updating,
    migrationNotice,
    planError,
    pins: availablePins,
    pin,
    unpin,
    clearPins,
    setBinding: (id: number, value: string) => {
      if (!Number.isInteger(id) || id < 1 || id > 12) return;
      setBindings((previous) => {
        const next = { ...previous, [String(id)]: value.slice(0, 24) };
        saveJson(bindingsKey, Object.fromEntries(Object.entries(next).map(([key, binding]) => [key, binding.trim()])));
        return next;
      });
    },
    delayMs,
    setDelayMs: (n: number) => setDelayMs(normalizeDelay(n)),
    hotkeys,
    setHotkey: (which: keyof Hotkeys, key: string) => setHotkeys((h) => ({ ...h, [which]: key })),
    rerun,
  };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
