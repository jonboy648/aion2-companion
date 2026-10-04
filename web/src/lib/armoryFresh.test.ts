import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** fetchCharacter reads the proxy URL and engine mode at import time, so load it fresh with the real (non-mock) path. */
async function load() {
  vi.resetModules();
  vi.stubEnv("VITE_ARMORY_PROXY_URL", "https://p.example");
  vi.doMock("@/engine/api", () => ({ isMockEngine: false }));
  return import("./armory");
}

let calls: string[];
beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      const path = new URL(url).pathname;
      const body = path === "/info" ? { profile: { characterName: "X" }, daevanion: { boardList: [{ id: 61, openNodeCount: 3 }] } } : {};
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.doUnmock("@/engine/api");
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("fetchCharacter fresh option", () => {
  it("does not ask the proxy to skip its cache by default", async () => {
    const { fetchCharacter } = await load();
    await fetchCharacter("abcdefgh1234", 2103, "nae");
    expect(calls.length).toBe(3); // info, equipment, one daevanion board
    for (const u of calls) expect(new URL(u).searchParams.has("fresh")).toBe(false);
  });

  it("asks for fresh data on every armory request when refreshing", async () => {
    const { fetchCharacter } = await load();
    await fetchCharacter("abcdefgh1234", 2103, "nae", true);
    expect(calls.length).toBe(3);
    for (const u of calls) expect(new URL(u).searchParams.get("fresh")).toBe("1");
  });
}, 20_000);
