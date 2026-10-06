import { useEffect, useState } from "react";
import { loadCategories } from "./data";
import type { ItemRow } from "./logic";

/** Rows of the given categories (all when `keys` is undefined; null `keys` = load nothing yet). rows is null while loading. */
export function useRows(keys: string[] | undefined | null) {
  const [state, setState] = useState<{ rows: ItemRow[] | null; error: string | null }>({ rows: null, error: null });
  const dep = keys === null ? null : (keys ?? ["*"]).join(",");
  useEffect(() => {
    if (dep === null) return;
    let live = true;
    setState({ rows: null, error: null });
    loadCategories(keys ?? undefined).then(
      (rows) => live && setState({ rows, error: null }),
      (e: unknown) => live && setState({ rows: null, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
  return state;
}
