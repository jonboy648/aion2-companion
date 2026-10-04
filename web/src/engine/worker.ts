/**
 * Module Web Worker: boots Pyodide, unpacks /engine/aion2c.zip, and serves aion2c.webapi calls.
 * Calls are strictly serial (Python is single-threaded); the main thread matches replies by request id.
 * Wire format: args in as structured clone, result out as a JSON string (webapi already returns JSON-safe data).
 */
import { GEAR_METHODS, PROGRESS_METHODS, PY_NAME, classKeyFor } from "./protocol";
import type { FromWorker, InitConfig, ToWorker } from "./protocol";

interface PyProxy {
  (...a: unknown[]): unknown;
  destroy?(): void;
}
interface PyodideLike {
  runPython(code: string): unknown;
  globals: { get(name: string): PyProxy };
  unpackArchive(buf: ArrayBuffer, fmt: string, opts?: { extractDir?: string }): void;
}

const ctx = self as unknown as {
  postMessage(m: FromWorker): void;
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
};

const BOOTSTRAP = `
import json, sys
sys.path.insert(0, "/home/pyodide/aion2c_src")
from aion2c import webapi as _w, armory as _armory
from aion2c.classes import CLASSES as _CLASSES, DEFAULT_CLASS as _DEFAULT

def _list_classes(keys_json):
    keys = set(json.loads(keys_json))
    return json.dumps([{"key": c.key, "name": c.name, "role": c.role} for c in _CLASSES if c.key in keys])

def _register(key, gd_text, icons_text):
    _w.register_gamedata(key, json.loads(gd_text))
    if icons_text:
        _w.register_icons(key, json.loads(icons_text))

def _register_items(text):
    _w.register_items(json.loads(text))

def _class_of(raw_json, base_json):
    raw = json.loads(raw_json)
    base = json.loads(base_json) if base_json else None
    return _armory.class_key(raw) or (base or {}).get("class_key") or _DEFAULT

def _call(name, args_json, has_progress, progress):
    args = json.loads(args_json)
    kw = {}
    if has_progress:
        kw["progress"] = progress
    return json.dumps(getattr(_w, name)(*args, **kw))
`;

let booted: Promise<PyodideLike> | null = null;
let manifestClasses: string[] = [];
const loaded = new Set<string>();
let itemsLoaded: Promise<void> | null = null;
let say: (m: string) => void = () => {};

async function fetchOk(url: string): Promise<Response> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${url} (HTTP ${r.status})`);
  return r;
}

function boot(cfg: InitConfig): Promise<PyodideLike> {
  booted ??= (async () => {
    say("Loading Python runtime...");
    const mod = (await import(/* @vite-ignore */ `${cfg.pyodideUrl}pyodide.mjs`)) as {
      loadPyodide(o: { indexURL: string }): Promise<PyodideLike>;
    };
    const py = await mod.loadPyodide({ indexURL: cfg.pyodideUrl });
    say("Loading the optimizer...");
    const [zip, manifest] = await Promise.all([
      fetchOk(`${cfg.base}engine/aion2c.zip`).then((r) => r.arrayBuffer()),
      fetchOk(`${cfg.base}engine/manifest.json`).then((r) => r.json() as Promise<{ classes: string[] }>),
    ]);
    manifestClasses = manifest.classes;
    py.unpackArchive(zip, "zip", { extractDir: "/home/pyodide/aion2c_src" });
    py.runPython(BOOTSTRAP);
    return py;
  })();
  // a failed boot (offline, CDN blip) must be retryable on the next call
  booted.catch(() => {
    booted = null;
  });
  return booted;
}

async function ensureClass(py: PyodideLike, cfg: InitConfig, key: string | null): Promise<void> {
  if (!key || loaded.has(key)) return;
  if (!manifestClasses.includes(key)) throw new Error(`Unknown class: ${key}`);
  say(`Loading ${key} data...`);
  const [gd, icons] = await Promise.all([
    fetchOk(`${cfg.base}engine/classes/${key}.json`).then((r) => r.text()),
    fetch(`${cfg.base}engine/icons/${key}.json`).then((r) => (r.ok ? r.text() : "")).catch(() => ""),
  ]);
  py.globals.get("_register")(key, gd, icons);
  loaded.add(key);
}

/** items.json is only fetched when a gear function is first called; a failed fetch is retried next call. */
function ensureItems(py: PyodideLike, cfg: InitConfig): Promise<void> {
  itemsLoaded ??= (async () => {
    say("Loading the item database...");
    const text = await fetchOk(`${cfg.base}engine/items.json`).then((r) => r.text());
    py.globals.get("_register_items")(text);
  })();
  itemsLoaded.catch(() => {
    itemsLoaded = null;
  });
  return itemsLoaded;
}

async function handle(msg: ToWorker): Promise<string> {
  const { id, method, args, config } = msg;
  say = (m) => ctx.postMessage({ id, type: "progress", message: m });
  const py = await boot(config);
  if (method === "listClasses") {
    return py.globals.get("_list_classes")(JSON.stringify(manifestClasses)) as string;
  }
  let key = classKeyFor(method, args);
  if (method === "importCharacter") {
    key = py.globals.get("_class_of")(JSON.stringify(args[0]), JSON.stringify(args[1] ?? null)) as string;
  }
  await ensureClass(py, config, key);
  if (GEAR_METHODS.has(method)) await ensureItems(py, config);
  // roadmap(classKey, region, build?) and friends all take plain JSON args
  const hasProgress = PROGRESS_METHODS.has(method);
  const progress = (m: string) => ctx.postMessage({ id, type: "progress", message: String(m) });
  say = () => {};
  const out = py.globals.get("_call")(PY_NAME[method], JSON.stringify(args), hasProgress, progress) as string;
  return out;
}

let chain: Promise<void> = Promise.resolve();
ctx.onmessage = (e) => {
  const msg = e.data;
  chain = chain.then(async () => {
    try {
      ctx.postMessage({ id: msg.id, type: "result", json: await handle(msg) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Python exceptions arrive as PythonError whose message is the whole traceback; keep the last line for the UI
      const last = message.trim().split("\n").filter(Boolean).pop() ?? message;
      ctx.postMessage({ id: msg.id, type: "error", message: last, pyType: (err as { type?: string })?.type });
    }
  });
};
