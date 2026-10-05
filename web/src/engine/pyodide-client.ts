/**
 * Main-thread client for the Pyodide worker. Implements the same EngineApi shape as api.ts' mock
 * (declared structurally here so api.ts can import this file without a cycle).
 */
import { cacheGet, cacheKey, cacheSet, cacheVersion, defaultStore } from "./cache";
import { PROGRESS_METHODS } from "./protocol";
import type { FromWorker, InitConfig, Method, ToWorker } from "./protocol";
import type {
  ArmoryRaw, CharacterBuild, ClassInfo, CompareResult, DaevanionSuggestion, FullBuild, GameData, IconUrls,
  GearUpgradesResult, ImportResult, KeybindsResult, MaxPotentialResult, PlaystyleKey, Priority, ProgressFn, RecipeMaterial, Region, RoadmapItem, StatSheet,
  SkillBar, StatGain,
} from "@/lib/types";

/** Pinned Pyodide (Python 3.14.2). Bumping it is a deliberate change: re-measure compare() timing. */
export const PYODIDE_VERSION = "314.0.7";
export const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export interface WorkerLike {
  postMessage(m: ToWorker): void;
  addEventListener(type: "message", fn: (e: MessageEvent<FromWorker>) => void): void;
  addEventListener(type: "error", fn: (e: Event) => void): void;
  terminate(): void;
}

export interface ClientOptions {
  workerFactory?: () => WorkerLike;
  /**
   * Engine workers to use for compare(): each playstyle is an independent search, so with N > 1 they run side by side
   * (results are identical, only faster). Default: auto from the device when the real Worker is used, else 1.
   */
  parallelism?: number;
  /** null disables caching. Default: localStorage when usable. */
  store?: Parameters<typeof cacheGet>[0];
  base?: string;
  dataVersion?: () => Promise<string>;
}

interface Pending {
  resolve(json: string): void;
  reject(e: Error): void;
  onProgress?: ProgressFn;
}

const CACHED: ReadonlySet<Method> = new Set<Method>(["compare", "optimize"]);

/** Same keys and order as the engine's playstyles (webapi.compare returns one FullBuild per key). */
const PLAYSTYLES: PlaystyleKey[] = ["boss", "aoe", "leveling", "burst"];
const MAX_WORKERS = PLAYSTYLES.length;

/** Each extra worker is a whole Python runtime (about 150-250 MB), so only use several on capable desktops. */
export function autoParallelism(): number {
  if (typeof navigator === "undefined") return 1;
  const cores = navigator.hardwareConcurrency ?? 1;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory; // GB, Chromium only; unknown = assume enough
  if (cores < 4 || (mem !== undefined && mem < 4)) return 1;
  return Math.min(MAX_WORKERS, cores - 1);
}

/** Drop trailing undefined args: JSON would turn them into null, which webapi params do not all accept. */
function trim(args: unknown[]): unknown[] {
  const a = [...args];
  while (a.length && a[a.length - 1] === undefined) a.pop();
  return a;
}

export function createPyodideClient(opts: ClientOptions = {}) {
  const base = opts.base ?? import.meta.env.BASE_URL ?? "/";
  const config: InitConfig = { base, pyodideUrl: PYODIDE_URL };
  const store = opts.store === undefined ? defaultStore() : opts.store;
  const pending = new Map<number, Pending>();
  const workers: WorkerLike[] = [];
  const poolSize = Math.max(1, Math.min(MAX_WORKERS, opts.parallelism ?? (opts.workerFactory ? 1 : autoParallelism())));
  let nextId = 1;
  let versionP: Promise<string> | null = null;

  const dataVersion = () =>
    (versionP ??= (opts.dataVersion ?? (() =>
      fetch(`${base}engine/manifest.json`).then((r) => r.json() as Promise<{ data_version: string; engine_version?: string }>).then(cacheVersion)))()
      .catch((e) => {
        versionP = null;
        throw e;
      }));

  function failAll(e: Error) {
    for (const p of pending.values()) p.reject(e);
    pending.clear();
    for (const w of workers) w.terminate();
    workers.length = 0; // next call spawns fresh workers (and re-boots Pyodide)
  }

  /** Worker `i` of the pool, created on first use (worker 0 serves everything except the parallel compare). */
  function getWorker(i = 0): WorkerLike {
    if (workers[i]) return workers[i];
    const w =
      opts.workerFactory?.() ??
      (new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike);
    w.addEventListener("message", (e) => {
      const m = e.data;
      const p = pending.get(m.id);
      if (!p) return;
      if (m.type === "progress") return p.onProgress?.(m.message);
      pending.delete(m.id);
      if (m.type === "result") p.resolve(m.json);
      else p.reject(new Error(m.message));
    });
    w.addEventListener("error", () => failAll(new Error("The calculation engine crashed. Try again.")));
    workers[i] = w;
    return w;
  }

  function send(method: Method, args: unknown[], onProgress?: ProgressFn, workerIndex = 0): Promise<string> {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, onProgress });
      try {
        getWorker(workerIndex).postMessage({ id, method, args: trim(args), config });
      } catch (e) {
        pending.delete(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  async function call<T>(method: Method, args: unknown[], onProgress?: ProgressFn): Promise<T> {
    if (method === "compare" && poolSize > 1) return compareParallel(args, onProgress) as Promise<T>;
    let key: string | null = null;
    if (CACHED.has(method) && store) {
      try {
        key = cacheKey(await dataVersion(), method, trim(args));
        const hit = cacheGet<T>(store, key);
        if (hit !== null) {
          onProgress?.("Loaded saved result");
          return hit;
        }
      } catch {
        key = null; // manifest unreachable: skip the cache, the engine call will surface the real error
      }
    }
    const out = JSON.parse(await send(method, args, PROGRESS_METHODS.has(method) ? onProgress : undefined)) as T;
    if (key) cacheSet(store, key, out);
    return out;
  }

  /** compare() as one optimize() per playstyle across the pool; same cache entry and same result as the serial call. */
  async function compareParallel(args: unknown[], onProgress?: ProgressFn): Promise<CompareResult> {
    const [build, points] = args as [CharacterBuild, number | null | undefined];
    let key: string | null = null;
    if (store) {
      try {
        key = cacheKey(await dataVersion(), "compare", trim(args));
        const hit = cacheGet<CompareResult>(store, key);
        if (hit !== null) {
          onProgress?.("Loaded saved result");
          return hit;
        }
      } catch {
        key = null;
      }
    }
    const parts = await Promise.all(
      PLAYSTYLES.map((k, i) => send("optimize", [build, k, points], onProgress, i % poolSize).then((j) => [k, JSON.parse(j) as FullBuild] as const)),
    );
    const out = Object.fromEntries(parts) as unknown as CompareResult;
    if (key) cacheSet(store, key, out);
    return out;
  }

  let warmed = false;
  /**
   * Boot every worker the next compare will use (Pyodide download and start, about 6 MB) without waiting for a real call.
   * The first search otherwise boots the engine only after the armory data has arrived, so the waits add up.
   */
  function warm(): void {
    if (warmed) return;
    warmed = true;
    for (let i = 0; i < poolSize; i++) {
      send("listClasses", [], undefined, i).catch(() => {
        warmed = false; // a failed boot (offline) can be tried again on the next real call or warm()
      });
    }
  }

  return {
    warm,
    listClasses: () => call<ClassInfo[]>("listClasses", []),
    gamedata: (classKey: string) => call<GameData>("gamedata", [classKey]),
    importCharacter: (raw: ArmoryRaw, baseBuild?: CharacterBuild | null) =>
      call<ImportResult>("importCharacter", [raw, baseBuild]),
    compare: (build: CharacterBuild, daevanionPoints?: number | null, onProgress?: ProgressFn) =>
      call<CompareResult>("compare", [build, daevanionPoints], onProgress),
    optimize: (build: CharacterBuild, playstyleKey: PlaystyleKey, daevanionPoints?: number | null, onProgress?: ProgressFn) =>
      call<FullBuild>("optimize", [build, playstyleKey, daevanionPoints], onProgress),
    marginal: (build: CharacterBuild, priority: Priority, scenarioKey: string) =>
      call<StatGain[]>("marginal", [build, priority, scenarioKey]),
    keybinds: (
      build: CharacterBuild,
      priorities: Record<string, Priority>,
      bar: SkillBar | Record<string, string | null>,
      hotkeys?: Record<string, string> | null,
      delayMs?: number,
    ) => call<KeybindsResult>("keybinds", [build, priorities, bar, hotkeys, delayMs]),
    daevanionSuggest: (build: CharacterBuild, points?: number | null) =>
      call<DaevanionSuggestion>("daevanionSuggest", [build, points]),
    shopping: (classKey: string, recipeQty: Record<string, number>, expand?: boolean) =>
      call<RecipeMaterial[]>("shopping", [classKey, recipeQty, expand]),
    roadmap: (classKey: string, region: Region, build?: CharacterBuild | null) =>
      call<RoadmapItem[]>("roadmap", [classKey, region, build]),
    iconUrls: (classKey: string) => call<IconUrls>("iconUrls", [classKey]),
    gearUpgrades: (rawArmory: ArmoryRaw, build: CharacterBuild, playstyle: PlaystyleKey, steps?: number, reachableOnly?: boolean) =>
      call<GearUpgradesResult>("gearUpgrades", [rawArmory, build, playstyle, steps, reachableOnly]),
    maxPotential: (classKey: string, playstyle: PlaystyleKey, reachableOnly?: boolean, build?: CharacterBuild | null, rawArmory?: ArmoryRaw | null) =>
      call<MaxPotentialResult>("maxPotential", [classKey, playstyle, reachableOnly, build, rawArmory]),
    statSheet: (rawArmory: ArmoryRaw, calibrate?: boolean) => call<StatSheet>("statSheet", [rawArmory, calibrate]),
    /** Test/debug hook. */
    dispose: () => failAll(new Error("Engine disposed")),
  };
}

export type PyodideClient = ReturnType<typeof createPyodideClient>;
