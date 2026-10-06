import { classEmblemUrl } from "@/components/game/ClassEmblem";
import { rank } from "./matcher";

export type Group = "Pages" | "Classes" | "Skills" | "Items" | "Daevanion" | "Characters";
export const GROUP_ORDER: Group[] = ["Pages", "Classes", "Skills", "Items", "Daevanion", "Characters"];

export interface Entry {
  group: Group;
  label: string;
  sub: string;
  to: string;
  icon?: string;
  /** extra searchable text (class name, kind...) */
  extra?: string;
}

/** Compact JSON written by scripts/build_search_index.mjs. */
export interface RawIndex {
  v: number;
  itemRoute: boolean;
  pages: [string, string, string][];
  classes: [string, string, string][];
  skills: [string, string, string, string, string][];
  daevanion: [string, string, string, string][];
  items: [string, number, string, string, string][];
}

const CDN = "https://assets.playnccdn.com/static-aion2-gamedata/resources/";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ROLE: Record<string, string> = { melee_dps: "Melee DPS", ranged_dps: "Ranged DPS", tank: "Tank", healer: "Healer", support: "Support" };

/** Expand the compact index into flat entries. Items are dropped while the site has no /items/:id route. */
export function expandIndex(raw: RawIndex): Entry[] {
  const cls = new Map(raw.classes.map((c) => [c[0], c[1]]));
  const out: Entry[] = [];
  for (const [label, to, sub] of raw.pages) out.push({ group: "Pages", label, sub, to });
  for (const [key, name, role] of raw.classes) {
    out.push({ group: "Classes", label: name, sub: `${ROLE[role] ?? cap(role)} · Codex`, to: `/codex/${key}`, icon: classEmblemUrl(key) });
  }
  for (const [name, ck, sk, kind, icon] of raw.skills) {
    const cn = cls.get(ck) ?? cap(ck);
    out.push({ group: "Skills", label: name, sub: `${cn} · ${cap(kind)}`, to: `/codex/${ck}?skill=${encodeURIComponent(sk)}`, icon: icon ? `${CDN}${icon}.png` : undefined, extra: cn });
  }
  for (const [name, ck, board, kind] of raw.daevanion) {
    const cn = cls.get(ck) ?? cap(ck);
    out.push({ group: "Daevanion", label: name, sub: kind === "b" ? `${cn} · Daevanion board` : `${cn} · ${board}`, to: `/daevanion?class=${ck}`, extra: cn });
  }
  if (raw.itemRoute) {
    for (const [name, id, slot, grade, icon] of raw.items) {
      out.push({ group: "Items", label: name, sub: [grade, cap(slot)].filter(Boolean).join(" · "), to: `/items/${id}`, icon: icon ? `${CDN}${icon}.png` : undefined, extra: slot });
    }
  }
  return out;
}

let pending: Promise<Entry[]> | null = null;

/** Fetch the index once, on first palette open. A failed load is retried on the next open. */
export function loadIndex(): Promise<Entry[]> {
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}search-index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`search index ${r.status}`);
        return r.json() as Promise<RawIndex>;
      })
      .then(expandIndex)
      .catch((e) => {
        pending = null;
        throw e;
      });
  }
  return pending;
}

/** Test hook: forget the cached index. */
export function resetIndexCache() {
  pending = null;
}

/** Grouped results, each group capped. Groups keep GROUP_ORDER; empty groups are omitted. */
export function searchEntries(entries: readonly Entry[], query: string, perGroup = 5): Entry[] {
  const out: Entry[] = [];
  for (const g of GROUP_ORDER) {
    const inGroup = entries.filter((e) => e.group === g);
    if (inGroup.length) out.push(...rank(query, inGroup, (e) => [e.label, e.extra], perGroup));
  }
  return out;
}

// ---- recent searches (per-viewer convenience; storage can be blocked, so every call is guarded) ----
const RECENT_KEY = "becomecube.palette.recent.v1";
const RECENT_MAX = 6;

export function loadRecentQueries(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function saveRecentQuery(q: string) {
  const t = q.trim();
  if (!t) return;
  try {
    const next = [t, ...loadRecentQueries().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: recents just don't persist */
  }
}

export function clearRecentQueries() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}
