import { useEffect, useState } from "react";
import { listClasses } from "@/engine/api";
import type { CharacterBuild, ClassInfo } from "@/lib/types";
import { loadJson, saveJson, useActiveBuild } from "./activeBuild";

const KEY = "aion2c.tools.class.v1";

/** Class shown on the Crafting and Road Map pages: the active character's class unless the visitor picks another. */
export function useToolsClass(): {
  classKey: string | null;
  setClassKey: (k: string) => void;
  classes: ClassInfo[];
  build: CharacterBuild | null;
  /** true while the class list or the active build is still loading */
  loading: boolean;
  error: string | null;
} {
  const active = useActiveBuild();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [picked, setPicked] = useState<string | null>(() => loadJson<string | null>(KEY, null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    listClasses().then(
      (c) => {
        if (!live) return;
        setClasses(c);
        setLoading(false);
      },
      (e: unknown) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const valid = (k: string | null) => (k && classes.some((c) => c.key === k) ? k : null);
  const classKey = valid(picked) ?? valid(active.build?.class_key ?? null) ?? classes[0]?.key ?? null;
  return {
    classKey,
    setClassKey: (k) => {
      setPicked(k);
      saveJson(KEY, k);
    },
    classes,
    build: active.build,
    loading: loading || active.loading,
    error,
  };
}
