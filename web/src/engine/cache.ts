/** localStorage cache for the slow engine calls (compare / optimize), keyed by a stable hash of the inputs. */

/** JSON.stringify with object keys sorted, so equal builds hash equal regardless of key order. */
export function stableStringify(v: unknown): string {
  if (v === undefined) return "null";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

/** cyrb53: fast 53-bit string hash (not cryptographic; this is a cache key). */
export function hash53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** What a cached result depends on: the class data AND the engine code (manifest `engine_version`, a content hash of
 *  the bundled python). Manifests from before engine_version existed key on data_version alone. */
export function cacheVersion(m: { data_version: string; engine_version?: string }): string {
  return m.engine_version ? `${m.data_version}+${m.engine_version}` : m.data_version;
}

export const CACHE_PREFIX = "aion2c:r1:";
const MAX_ENTRIES = 24;

export function cacheKey(dataVersion: string, method: string, args: unknown[]): string {
  const a = [...args];
  while (a.length && (a[a.length - 1] ?? null) === null) a.pop(); // f(x), f(x, undefined), f(x, null) are the same call
  return `${CACHE_PREFIX}${method}:${hash53(stableStringify([dataVersion, method, a]))}`;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export function defaultStore(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function cacheGet<T>(store: Store | null, key: string): T | null {
  try {
    const s = store?.getItem(key);
    if (!s) return null;
    return (JSON.parse(s) as { at: number; v: T }).v;
  } catch {
    return null;
  }
}

function entries(store: Store): { key: string; at: number }[] {
  const out: { key: string; at: number }[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (!k?.startsWith(CACHE_PREFIX)) continue;
    let at = 0;
    try {
      at = (JSON.parse(store.getItem(k) ?? "{}") as { at?: number }).at ?? 0;
    } catch {
      /* corrupt entry sorts oldest and is evicted first */
    }
    out.push({ key: k, at });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Store, evicting the oldest entries past MAX_ENTRIES or on quota errors. Never throws. */
export function cacheSet(store: Store | null, key: string, value: unknown): void {
  if (!store) return;
  const payload = JSON.stringify({ at: Date.now(), v: value });
  try {
    const old = entries(store);
    for (const e of old.slice(0, Math.max(0, old.length - MAX_ENTRIES + 1))) store.removeItem(e.key);
    store.setItem(key, payload);
  } catch {
    try {
      for (const e of entries(store).slice(0, 8)) store.removeItem(e.key);
      store.setItem(key, payload);
    } catch {
      /* quota or blocked storage: caching is best-effort */
    }
  }
}
