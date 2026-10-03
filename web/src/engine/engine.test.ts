import { describe, expect, it } from "vitest";
import { cacheGet, cacheKey, cacheSet, hash53, stableStringify, CACHE_PREFIX } from "./cache";
import { classKeyFor } from "./protocol";
import type { FromWorker, ToWorker } from "./protocol";
import { createPyodideClient } from "./pyodide-client";
import type { WorkerLike } from "./pyodide-client";

class MemStore {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe("cache", () => {
  it("stableStringify ignores key order", () => {
    expect(stableStringify({ a: 1, b: { d: [1, 2], c: null } })).toBe(stableStringify({ b: { c: null, d: [1, 2] }, a: 1 }));
    expect(hash53("x")).not.toBe(hash53("y"));
  });
  it("trailing null/undefined args do not change the key; data_version and args do", () => {
    const b = { name: "x" };
    expect(cacheKey("v1", "compare", [b, null])).toBe(cacheKey("v1", "compare", [b]));
    expect(cacheKey("v1", "compare", [b, undefined])).toBe(cacheKey("v1", "compare", [b]));
    expect(cacheKey("v2", "compare", [b])).not.toBe(cacheKey("v1", "compare", [b]));
    expect(cacheKey("v1", "compare", [b, 5])).not.toBe(cacheKey("v1", "compare", [b]));
  });
  it("round-trips, evicts oldest, and never throws", () => {
    const s = new MemStore();
    for (let i = 0; i < 40; i++) cacheSet(s, `${CACHE_PREFIX}k${i}`, { i });
    expect(s.length).toBeLessThanOrEqual(24);
    expect(cacheGet<{ i: number }>(s, `${CACHE_PREFIX}k39`)).toEqual({ i: 39 });
    expect(cacheGet(null, "x")).toBeNull();
    cacheSet(null, "x", 1);
    const bad = { ...s, length: 0, setItem() { throw new Error("quota"); }, key: () => null, getItem: () => null, removeItem() {} };
    expect(() => cacheSet(bad, "k", 1)).not.toThrow();
  });
});

describe("classKeyFor", () => {
  it("finds the class a call needs", () => {
    expect(classKeyFor("gamedata", ["templar"])).toBe("templar");
    expect(classKeyFor("compare", [{ class_key: "ranger" }])).toBe("ranger");
    expect(classKeyFor("listClasses", [])).toBeNull();
  });
});

function fakeWorker(reply: (m: ToWorker, send: (f: FromWorker) => void) => void) {
  const sent: ToWorker[] = [];
  let onMsg: (e: MessageEvent<FromWorker>) => void = () => {};
  const w: WorkerLike = {
    postMessage(m) {
      sent.push(m);
      queueMicrotask(() => reply(m, (data) => onMsg({ data } as MessageEvent<FromWorker>)));
    },
    addEventListener(type: string, fn: never) {
      if (type === "message") onMsg = fn;
    },
    terminate() {},
  };
  return { w, sent };
}

describe("pyodide client", () => {
  const mk = (reply: Parameters<typeof fakeWorker>[0], store: MemStore | null = new MemStore()) => {
    const { w, sent } = fakeWorker(reply);
    const client = createPyodideClient({ workerFactory: () => w, store, base: "/", dataVersion: async () => "dv1" });
    return { client, sent, store };
  };
  const build = { class_key: "sorcerer", name: "t" } as never;

  it("matches replies by id, forwards progress, trims trailing undefined, caches compare", async () => {
    const { client, sent } = mk((m, send) => {
      send({ id: m.id, type: "progress", message: "Boss DPS..." });
      send({ id: m.id, type: "result", json: JSON.stringify({ boss: { n: m.id } }) });
    });
    const msgs: string[] = [];
    const r1 = await client.compare(build, undefined, (m) => msgs.push(m));
    expect(msgs).toEqual(["Boss DPS..."]);
    expect(sent[0].args).toEqual([build]);
    const r2 = await client.compare(build, null);
    expect(r2).toEqual(r1);
    expect(sent.length).toBe(1); // second call served from cache
  });

  it("does not cache non-slow calls and propagates errors", async () => {
    const { client, sent } = mk((m, send) => send({ id: m.id, type: "error", message: "KeyError: 'nope'" }));
    await expect(client.gamedata("nope")).rejects.toThrow("KeyError");
    await expect(client.gamedata("nope")).rejects.toThrow("KeyError");
    expect(sent.length).toBe(2);
  });

  it("works without storage", async () => {
    const { client, sent } = mk((m, send) => send({ id: m.id, type: "result", json: "[]" }), null);
    await client.optimize(build, "boss");
    await client.optimize(build, "boss");
    expect(sent.length).toBe(2);
  });
});
