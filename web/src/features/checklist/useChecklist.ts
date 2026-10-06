import { useCallback, useEffect, useRef, useState } from "react";
import { useRegion } from "../timers/useTimers";
import { STORAGE_KEY, loadState, pruneStale, saveState, tasksFromToken, type ChecklistState, type Task } from "./model";

/** A template waiting in the page address (#t=...), shown as a banner until the viewer accepts or dismisses it. */
function readSharedTemplate(region: Parameters<typeof tasksFromToken>[1]): Task[] | null {
  const m = typeof window === "undefined" ? null : window.location.hash.match(/^#t=([A-Za-z0-9_-]+)$/);
  return m ? tasksFromToken(m[1], region, Date.now()) : null;
}

/**
 * The checklist state, saved to localStorage on every change and re-read when another tab changes it.
 * `update` takes a pure edit from model.ts. `saved` turns false if the browser refuses to store.
 */
export function useChecklist() {
  const [region] = useRegion();
  const [state, setState] = useState<ChecklistState>(() => pruneStale(loadState(), region, Date.now()));
  const [saved, setSaved] = useState(true);
  const [shared, setShared] = useState<Task[] | null>(() => readSharedTemplate(region));
  const skip = useRef(true);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    setSaved(saveState(state));
  }, [state]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        skip.current = true; // do not write back what another tab just wrote
        setState(loadState());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((fn: (s: ChecklistState) => ChecklistState) => setState(fn), []);
  const replace = useCallback((s: ChecklistState) => setState(s), []);
  const dismissShared = useCallback(() => {
    setShared(null);
    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {
      /* ignore */
    }
  }, []);

  return { state, update, replace, saved, shared, dismissShared };
}
