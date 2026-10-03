/**
 * Main-thread client for the Pyodide worker. Implements the same EngineApi shape as api.ts' mock
 * (declared structurally here so api.ts can import this file without a cycle).
 */
import { cacheGet, cacheKey, cacheSet, defaultStore } from "./cache";
import { PROGRESS_METHODS } from "./protocol";
import type { FromWorker, InitConfig, Method, ToWorker } from "./protocol";
import type {
  ArmoryRaw, CharacterBuild, ClassInfo, CompareResult, DaevanionSuggestion, FullBuild, GameData, IconUrls,
  ImportResult, KeybindsResult, PlaystyleKey, Priority, ProgressFn, RecipeMaterial, Region, RoadmapItem,
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
  let worker: WorkerLike | null = null;
  let nextId = 1;
  let versionP: Promise<string> | null = null;

  const dataVersion = () =>
    (versionP ??= (opts.dataVersion ?? (() =>
      fetch(`${base}engine/manifest.json`).then((r) => r.json() as Promise<{ data_version: string }>).then((m) => m.data_version)))()
      .catch((e) => {
        versionP = null;
        throw e;
      }));

  function failAll(e: Error) {
    for (const p of pending.values()) p.reject(e);
    pending.clear();
    worker?.terminate();
    worker = null; // next call spawns a fresh worker (and re-boots Pyodide)
  }

  function getWorker(): WorkerLike {
    if (worker) return worker;
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
    worker = w;
    return w;
  }

  function send(method: Method, args: unknown[], onProgress?: ProgressFn): Promise<string> {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, onProgress });
      try {
        getWorker().postMessage({ id, method, args: trim(args), config });
      } catch (e) {
        pending.delete(id);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  async function call<T>(method: Method, args: unknown[], onProgress?: ProgressFn): Promise<T> {
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

  return {
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
    /** Test/debug hook. */
    dispose: () => failAll(new Error("Engine disposed")),
  };
}

export type PyodideClient = ReturnType<typeof createPyodideClient>;
