import type { RegionKey } from "../timers/data";
import { anchorDayFor, customWindow, lastReset, nextReset } from "./reset";

export type Group = "daily" | "weekly" | "custom";
export const GROUPS: Group[] = ["daily", "weekly", "custom"];

export interface Task {
  id: string;
  group: Group;
  title: string;
  /** how many times to do it before it counts as done (1 = a plain checkbox) */
  target: number;
  note: string;
  /** custom group only */
  everyDays?: number;
  /** custom group only: calendar day (days since 1970) the cycle count starts from */
  anchorDay?: number;
}

export interface Character {
  id: string;
  name: string;
  /** optional link to the armory page: /c/:region/:serverId/:name */
  armory?: { region: string; serverId: string; name: string };
}

/** Progress is stamped with the time it was set; it only counts while that is after the group's last reset. */
export interface Tick {
  n: number;
  at: number;
}

export interface ChecklistState {
  v: 1;
  characters: Character[];
  activeId: string;
  tasks: Task[];
  progress: Record<string, Record<string, Tick>>;
}

export const VERSION = 1;
export const STORAGE_KEY = "aion2.checklist";

let seq = 0;
export const newId = (): string => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function emptyState(): ChecklistState {
  const id = newId();
  return { v: 1, characters: [{ id, name: "Main" }], activeId: id, tasks: [], progress: {} };
}

// ---- reset logic ---------------------------------------------------------------------------

/** When the task's current cycle began. Ticks stamped earlier than this are stale. */
export function cycleStart(task: Task, region: RegionKey, now: number): number {
  if (task.group === "custom") return customWindow(task.everyDays ?? 1, task.anchorDay ?? 0, region, now).start;
  return lastReset(task.group, region, now);
}

/** When the task's current cycle ends (its next reset). */
export function cycleEnd(task: Task, region: RegionKey, now: number): number {
  if (task.group === "custom") return customWindow(task.everyDays ?? 1, task.anchorDay ?? 0, region, now).end;
  return nextReset(task.group, region, now);
}

/** Current count for a character, 0 if the last tick belongs to an earlier cycle (a reset passed, even with the tab closed). */
export function countOf(s: ChecklistState, charId: string, task: Task, region: RegionKey, now: number): number {
  const t = s.progress[charId]?.[task.id];
  return t && t.at >= cycleStart(task, region, now) ? Math.min(t.n, task.target) : 0;
}

export const isDone = (s: ChecklistState, charId: string, task: Task, region: RegionKey, now: number) =>
  countOf(s, charId, task, region, now) >= task.target;

export function groupProgress(s: ChecklistState, charId: string, group: Group, region: RegionKey, now: number) {
  const tasks = s.tasks.filter((t) => t.group === group);
  return { done: tasks.filter((t) => isDone(s, charId, t, region, now)).length, total: tasks.length };
}

/** The group's next reset, or null when it has no tasks (custom: the soonest of its tasks). */
export function groupNextReset(s: ChecklistState, group: Group, region: RegionKey, now: number): number | null {
  const tasks = s.tasks.filter((t) => t.group === group);
  if (group !== "custom") return nextReset(group, region, now);
  return tasks.length ? Math.min(...tasks.map((t) => cycleEnd(t, region, now))) : null;
}

/** Which reset comes first across all groups that have tasks. */
export function whatResetsNext(s: ChecklistState, region: RegionKey, now: number): { group: Group; at: number } | null {
  let best: { group: Group; at: number } | null = null;
  for (const g of GROUPS) {
    if (!s.tasks.some((t) => t.group === g)) continue;
    const at = groupNextReset(s, g, region, now);
    if (at !== null && (!best || at < best.at)) best = { group: g, at };
  }
  return best;
}

/** Drop ticks from finished cycles so storage stays small. Counts are unaffected (they are computed against the clock). */
export function pruneStale(s: ChecklistState, region: RegionKey, now: number): ChecklistState {
  const byId = new Map(s.tasks.map((t) => [t.id, t]));
  const progress: ChecklistState["progress"] = {};
  for (const [cid, row] of Object.entries(s.progress)) {
    if (!s.characters.some((c) => c.id === cid)) continue;
    const kept: Record<string, Tick> = {};
    for (const [tid, tick] of Object.entries(row)) {
      const task = byId.get(tid);
      if (task && tick.at >= cycleStart(task, region, now)) kept[tid] = tick;
    }
    progress[cid] = kept;
  }
  return { ...s, progress };
}

// ---- edits (pure; each returns a new state) -------------------------------------------------

export function setCount(s: ChecklistState, charId: string, task: Task, n: number, now: number): ChecklistState {
  const clamped = Math.max(0, Math.min(task.target, Math.floor(n)));
  const row = { ...(s.progress[charId] ?? {}) };
  if (clamped === 0) delete row[task.id];
  else row[task.id] = { n: clamped, at: now };
  return { ...s, progress: { ...s.progress, [charId]: row } };
}

export function toggle(s: ChecklistState, charId: string, task: Task, region: RegionKey, now: number): ChecklistState {
  return setCount(s, charId, task, isDone(s, charId, task, region, now) ? 0 : task.target, now);
}

export function addTask(s: ChecklistState, input: { group: Group; title: string; target?: number; note?: string; everyDays?: number }, region: RegionKey, now: number): ChecklistState {
  const title = input.title.trim();
  if (!title) return s;
  const task: Task = { id: newId(), group: input.group, title, target: Math.max(1, Math.floor(input.target ?? 1)), note: input.note ?? "" };
  if (input.group === "custom") {
    task.everyDays = Math.max(1, Math.floor(input.everyDays ?? 2));
    task.anchorDay = anchorDayFor(region, now);
  }
  return { ...s, tasks: [...s.tasks, task] };
}

export function updateTask(s: ChecklistState, id: string, patch: Partial<Pick<Task, "title" | "target" | "note" | "everyDays">>): ChecklistState {
  return {
    ...s,
    tasks: s.tasks.map((t) => {
      if (t.id !== id) return t;
      const next = { ...t, ...patch };
      next.title = next.title.trim() || t.title;
      next.target = Math.max(1, Math.floor(next.target));
      if (t.group === "custom") next.everyDays = Math.max(1, Math.floor(next.everyDays ?? 1));
      return next;
    }),
  };
}

export function removeTask(s: ChecklistState, id: string): ChecklistState {
  const progress: ChecklistState["progress"] = {};
  for (const [cid, row] of Object.entries(s.progress)) {
    const { [id]: _gone, ...rest } = row;
    void _gone;
    progress[cid] = rest;
  }
  return { ...s, tasks: s.tasks.filter((t) => t.id !== id), progress };
}

/** Move a task one place up or down among the tasks of its own group. */
export function moveTask(s: ChecklistState, id: string, dir: -1 | 1): ChecklistState {
  const task = s.tasks.find((t) => t.id === id);
  if (!task) return s;
  const peers = s.tasks.filter((t) => t.group === task.group);
  const i = peers.findIndex((t) => t.id === id);
  const j = i + dir;
  if (j < 0 || j >= peers.length) return s;
  return reorder(s, id, peers[j].id);
}

/** Put task `id` where task `overId` is (drag and drop). Both must be in the same group. */
export function reorder(s: ChecklistState, id: string, overId: string): ChecklistState {
  const a = s.tasks.findIndex((t) => t.id === id);
  const b = s.tasks.findIndex((t) => t.id === overId);
  if (a < 0 || b < 0 || a === b || s.tasks[a].group !== s.tasks[b].group) return s;
  const tasks = [...s.tasks];
  const [moved] = tasks.splice(a, 1);
  tasks.splice(b, 0, moved);
  return { ...s, tasks };
}

export function addCharacter(s: ChecklistState, name: string): ChecklistState {
  const n = name.trim();
  if (!n) return s;
  const c: Character = { id: newId(), name: n };
  return { ...s, characters: [...s.characters, c], activeId: c.id };
}

export function renameCharacter(s: ChecklistState, id: string, name: string): ChecklistState {
  const n = name.trim();
  return n ? { ...s, characters: s.characters.map((c) => (c.id === id ? { ...c, name: n } : c)) } : s;
}

/** Link (or unlink, with null) a character to its armory page. */
export function linkArmory(s: ChecklistState, id: string, armory: Character["armory"] | null): ChecklistState {
  return {
    ...s,
    characters: s.characters.map((c) => {
      if (c.id !== id) return c;
      const { armory: _old, ...rest } = c;
      void _old;
      return armory ? { ...rest, armory } : rest;
    }),
  };
}

/** Delete a character and its ticks. The last character cannot be deleted. */
export function deleteCharacter(s: ChecklistState, id: string): ChecklistState {
  if (s.characters.length <= 1 || !s.characters.some((c) => c.id === id)) return s;
  const characters = s.characters.filter((c) => c.id !== id);
  const { [id]: _gone, ...progress } = s.progress;
  void _gone;
  return { ...s, characters, progress, activeId: s.activeId === id ? characters[0].id : s.activeId };
}

// ---- storage, versioning --------------------------------------------------------------------

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const str = (x: unknown, max = 200) => (typeof x === "string" ? x.slice(0, max) : "");
const posInt = (x: unknown, fallback: number) => (typeof x === "number" && Number.isFinite(x) && x >= 1 ? Math.floor(x) : fallback);

function cleanTask(x: unknown): Task | null {
  if (!isObj(x)) return null;
  const group = x.group;
  const title = str(x.title, 120).trim();
  if (!title || (group !== "daily" && group !== "weekly" && group !== "custom")) return null;
  const t: Task = { id: str(x.id, 40) || newId(), group, title, target: Math.min(posInt(x.target, 1), 999), note: str(x.note, 500) };
  if (group === "custom") {
    t.everyDays = Math.min(posInt(x.everyDays, 2), 365);
    t.anchorDay = typeof x.anchorDay === "number" && Number.isFinite(x.anchorDay) ? Math.floor(x.anchorDay) : 0;
  }
  return t;
}

/**
 * Turn whatever was stored (or imported) into the current shape. Never throws.
 * v0 is the bare template format used by share links and early exports: `{ tasks: [...] }` with no version.
 * v1 is the full state. Anything unreadable becomes a fresh empty state.
 */
export function migrate(raw: unknown): ChecklistState {
  if (!isObj(raw)) return emptyState();
  const tasks: Task[] = [];
  const seen = new Set<string>();
  for (const t of Array.isArray(raw.tasks) ? raw.tasks : []) {
    const c = cleanTask(t);
    if (!c) continue;
    if (seen.has(c.id)) c.id = newId();
    seen.add(c.id);
    tasks.push(c);
  }
  const base = emptyState();
  if (raw.v !== 1) return { ...base, tasks }; // v0 / unversioned: tasks only
  const characters: Character[] = [];
  for (const c of Array.isArray(raw.characters) ? raw.characters : []) {
    if (!isObj(c) || characters.some((x) => x.id === c.id)) continue;
    const name = str(c.name, 40).trim();
    if (!name) continue;
    const ch: Character = { id: str(c.id, 40) || newId(), name };
    if (isObj(c.armory) && str(c.armory.region) && str(c.armory.serverId) && str(c.armory.name)) {
      ch.armory = { region: str(c.armory.region), serverId: str(c.armory.serverId), name: str(c.armory.name) };
    }
    characters.push(ch);
  }
  if (!characters.length) return { ...base, tasks };
  const progress: ChecklistState["progress"] = {};
  if (isObj(raw.progress)) {
    for (const ch of characters) {
      const row = raw.progress[ch.id];
      if (!isObj(row)) continue;
      progress[ch.id] = {};
      for (const [tid, tick] of Object.entries(row)) {
        if (seen.has(tid) && isObj(tick) && typeof tick.n === "number" && typeof tick.at === "number" && tick.n > 0) {
          progress[ch.id][tid] = { n: Math.floor(tick.n), at: tick.at };
        }
      }
    }
  }
  const activeId = characters.some((c) => c.id === raw.activeId) ? (raw.activeId as string) : characters[0].id;
  return { v: 1, characters, activeId, tasks, progress };
}

export function loadState(): ChecklistState {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text) return migrate(JSON.parse(text));
  } catch {
    /* blocked or corrupt: start fresh */
  }
  return emptyState();
}

/** false when the browser refused (private mode, quota). */
export function saveState(s: ChecklistState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export const exportJson = (s: ChecklistState): string => JSON.stringify(s, null, 2);

/** Import a file's text. Returns null if it is not JSON. */
export function importJson(text: string): ChecklistState | null {
  try {
    return migrate(JSON.parse(text));
  } catch {
    return null;
  }
}

// ---- share link: tasks only, never progress or characters -----------------------------------

const toB64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64 = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function templateToken(tasks: Task[]): string {
  const slim = tasks.map(({ group, title, target, note, everyDays }) => ({ group, title, target, note, ...(everyDays ? { everyDays } : {}) }));
  return toB64(JSON.stringify({ tasks: slim }));
}

/** Tasks from a share token, with fresh ids; null if the token is damaged. Custom tasks start counting from `now`. */
export function tasksFromToken(token: string, region: RegionKey, now: number): Task[] | null {
  try {
    const m = migrate(JSON.parse(fromB64(token)));
    const anchorDay = anchorDayFor(region, now);
    return m.tasks.map((t) => ({ ...t, id: newId(), ...(t.group === "custom" ? { anchorDay } : {}) }));
  } catch {
    return null;
  }
}

export function shareUrl(origin: string, tasks: Task[]): string {
  return `${origin}/checklist/#t=${templateToken(tasks)}`;
}

/** Read "/c/nae/1101/Luna", a full armory URL, or "nae/1101/Luna" into an armory link; null if it does not fit. */
export function parseArmory(text: string): NonNullable<Character["armory"]> | null {
  const m = text.trim().match(/(?:\/c\/)?([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/([^/?#\s]+)\/?(?:[?#].*)?$/);
  if (!m) return null;
  try {
    return { region: m[1], serverId: m[2], name: decodeURIComponent(m[3]) };
  } catch {
    return null;
  }
}

/** Replace all tasks, or add the new ones after the existing ones. */
export function applyTemplate(s: ChecklistState, tasks: Task[], mode: "replace" | "add"): ChecklistState {
  if (mode === "add") return { ...s, tasks: [...s.tasks, ...tasks] };
  return { ...s, tasks, progress: {} };
}
