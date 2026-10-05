import { useEffect, useState, useSyncExternalStore } from "react";
import { REGION_KEYS, type RegionKey } from "./data";

const KEY = "aion2.timers.region";

let current: RegionKey | null = null;
const listeners = new Set<() => void>();

function load(): RegionKey {
  try {
    const v = localStorage.getItem(KEY);
    if (v && (REGION_KEYS as string[]).includes(v)) return v as RegionKey;
  } catch {
    /* storage blocked: fall back to the default */
  }
  return "global";
}

function getSnapshot(): RegionKey {
  return (current ??= load());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function setRegion(r: RegionKey) {
  current = r;
  try {
    localStorage.setItem(KEY, r);
  } catch {
    /* storage blocked: the choice lasts for this page view only */
  }
  listeners.forEach((fn) => fn());
}

/** The viewer's region. Server and prerender snapshot is always "global", so no mismatch is possible. */
export function useRegion(): [RegionKey, (r: RegionKey) => void] {
  const region = useSyncExternalStore(subscribe, getSnapshot, () => "global" as const);
  return [region, setRegion];
}

/** Epoch ms, ticking every second. null until mounted so the build and the first client render match. */
export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Viewer-local time such as "Mon 9:00 PM". */
export function formatLocal(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(ms));
}

/** Time of day in the region's own clock, e.g. "21:30". */
export function formatRegionClock(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
}

export function viewerZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "local time";
  }
}
