/** Item database loading: one small JSON file per category (rows) and per category (detail), cached for the session. */
import { CATS, catOfId, type EnchantTables, type ItemDetail, type ItemRow } from "./logic";

const base = () => import.meta.env.BASE_URL ?? "/";
const cache = new Map<string, Promise<unknown>>();

/** fetch + parse once; a failure is not cached so the next visit retries. */
function load<T>(path: string, fetcher: typeof fetch = fetch): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetcher(`${base()}items/${path}`).then((r) => {
      if (!r.ok) throw new Error(`items/${path}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

export function clearItemCache() {
  cache.clear();
}

/** Slim rows of one category, each tagged with its category key. */
export async function loadCategory(key: string): Promise<ItemRow[]> {
  const d = await load<{ cat: string; items: Omit<ItemRow, "cat">[] }>(`cat/${key}.json`);
  return d.items.map((r) => ({ ...r, cat: d.cat }));
}

/** Rows of several categories (all of them by default), in category order. */
export async function loadCategories(keys: string[] = CATS.map((c) => c.key)): Promise<ItemRow[]> {
  return (await Promise.all(keys.map(loadCategory))).flat();
}

export interface ItemPage {
  item: ItemDetail;
  cat: string;
  enchant: EnchantTables;
}

/** Full detail of one item, or null when we have no such id. */
export async function loadItem(id: number): Promise<ItemPage | null> {
  const cat = catOfId(id);
  if (!cat) return null;
  const d = await load<{ items: Record<string, ItemDetail>; enchant: EnchantTables }>(`detail/${cat}.json`);
  const item = d.items[String(id)];
  return item ? { item, cat, enchant: d.enchant } : null;
}
