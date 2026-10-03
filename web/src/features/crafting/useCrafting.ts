import { useCallback, useEffect, useMemo, useState } from "react";
import { gamedata, shopping } from "@/engine/api";
import type { Recipe, RecipeMaterial } from "@/lib/types";
import { loadJson, saveJson } from "@/features/keybinds/activeBuild";

export type QtyMap = Record<string, number>;
export interface CraftState {
  qty: QtyMap;
  /** shopping-list items already gathered, by item name */
  checked: string[];
  expand: boolean;
}

const stateKey = (classKey: string) => `aion2c.crafting.v1:${classKey}`;
export const EMPTY: CraftState = { qty: {}, checked: [], expand: true };
export const MAX_QTY = 999;

export const clampQty = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(MAX_QTY, Math.floor(n))) : 0);

export function loadState(classKey: string): CraftState {
  const s = loadJson<Partial<CraftState>>(stateKey(classKey), {});
  const qty: QtyMap = {};
  for (const [id, n] of Object.entries(s.qty ?? {})) if (clampQty(Number(n)) > 0) qty[id] = clampQty(Number(n));
  return { qty, checked: Array.isArray(s.checked) ? s.checked.filter((x) => typeof x === "string") : [], expand: s.expand !== false };
}

const GRADE_COLORS: Record<string, string> = {
  common: "#9aa3b8",
  rare: "#4cc38a",
  epic: "#4a9df0",
  unique: "#f0922f",
  legend: "#f0922f",
  legendary: "#f0922f",
};
/** DESIGN.md rarity colours; unknown grades stay neutral. */
export const gradeColor = (grade: string | null | undefined) => GRADE_COLORS[(grade ?? "").toLowerCase()] ?? "#9aa3b8";

/** Shopping list as plain text, one "qty x item" per line, for pasting into chat or notes. */
export function shoppingText(items: RecipeMaterial[], checked: ReadonlySet<string>): string {
  return items.map((m) => `${checked.has(m.item) ? "[x]" : "[ ]"} ${m.qty} x ${m.item}${m.source ? ` (${m.source})` : ""}`).join("\n");
}

export function useCrafting(classKey: string | null) {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<CraftState>(EMPTY);
  const [items, setItems] = useState<RecipeMaterial[]>([]);
  const [listBusy, setListBusy] = useState(false);

  useEffect(() => {
    if (!classKey) return;
    let live = true;
    setRecipes(null);
    setError(null);
    setState(loadState(classKey));
    gamedata(classKey).then(
      (g) => live && setRecipes(g.recipes),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, [classKey]);

  const update = useCallback(
    (fn: (s: CraftState) => CraftState) => {
      setState((prev) => {
        const next = fn(prev);
        if (classKey) saveJson(stateKey(classKey), next);
        return next;
      });
    },
    [classKey],
  );

  const setQty = useCallback(
    (id: number, n: number) =>
      update((s) => {
        const qty = { ...s.qty };
        const v = clampQty(n);
        if (v > 0) qty[String(id)] = v;
        else delete qty[String(id)];
        return { ...s, qty };
      }),
    [update],
  );
  const toggleChecked = useCallback(
    (item: string) => update((s) => ({ ...s, checked: s.checked.includes(item) ? s.checked.filter((x) => x !== item) : [...s.checked, item] })),
    [update],
  );
  const setExpand = useCallback((expand: boolean) => update((s) => ({ ...s, expand })), [update]);
  const clearChecked = useCallback(() => update((s) => ({ ...s, checked: [] })), [update]);
  const clearAll = useCallback(() => update((s) => ({ ...s, qty: {}, checked: [] })), [update]);

  // aggregated shopping list from the engine (crafting.shopping_list)
  const qtyKey = JSON.stringify(state.qty);
  useEffect(() => {
    if (!classKey) return;
    if (Object.keys(state.qty).length === 0) {
      setItems([]);
      return;
    }
    let live = true;
    setListBusy(true);
    shopping(classKey, state.qty, state.expand).then(
      (r) => {
        if (!live) return;
        setItems(r);
        setListBusy(false);
      },
      (e: unknown) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : String(e));
        setListBusy(false);
      },
    );
    return () => {
      live = false;
    };
    // state.qty is tracked through qtyKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classKey, qtyKey, state.expand]);

  const checked = useMemo(() => new Set(state.checked), [state.checked]);
  return { recipes, error, state, items, listBusy, checked, setQty, toggleChecked, setExpand, clearChecked, clearAll };
}
