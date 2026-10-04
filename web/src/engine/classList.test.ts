import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("./pyodide-client");
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("class list", () => {
  it("is served without booting the engine (no ~6 MB Python download just to list eight names)", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_ENGINE", "real");
    const touched: string[] = [];
    const fake = new Proxy({} as Record<string, unknown>, {
      get: (_t, name: string) => (name === "warm" ? () => {} : (...a: unknown[]) => (touched.push(`${name}${a.length}`), Promise.resolve([]))),
    });
    vi.doMock("./pyodide-client", () => ({ createPyodideClient: () => fake }));
    const api = await import("./api");
    expect(api.isMockEngine).toBe(false);
    const classes = await api.listClasses();
    expect(classes.map((c) => c.key).sort()).toEqual(["assassin", "chanter", "cleric", "gladiator", "ranger", "sorcerer", "spiritmaster", "templar"]);
    expect(classes[0]).toHaveProperty("name");
    expect(classes[0]).toHaveProperty("role");
    expect(touched).toEqual([]); // the engine client was never asked
  });
});
