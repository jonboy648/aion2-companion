import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** fetchCharacter reads the proxy URL and engine mode at import time, so load it fresh with the real (non-mock) path. */
async function load(proxy = "https://p.example") {
  vi.resetModules();
  vi.stubEnv("VITE_ARMORY_PROXY_URL", proxy);
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
      const body = path === "/info" ? { profile: { characterName: "X" }, daevanion: { boardList: [{ id: 61, openNodeCount: 3 }] } }
        : path === "/daevanion" ? { nodeList: [{ open: 1 }, { open: 1 }, { open: 1 }], openStatEffectList: [] } : { equipment: { equipmentList: [] }, skill: { skillList: [] } };
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
  it("explains a missing preview endpoint without making a same-origin request", async () => {
    const { fetchCharacter } = await load("");
    await expect(fetchCharacter("abcdefgh1234", 2103, "nae")).rejects.toThrow(/VITE_ARMORY_PROXY_URL.*restart/i);
    expect(calls).toEqual([]);
  });

  it("distinguishes an unreachable/CORS-blocked proxy from a missing character", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { search } = await load();
    await expect(search("DarthThot", "nae")).rejects.toThrow(/network.*CORS.*ALLOWED_ORIGINS/i);
  });

  it("rejects a truncated board response instead of importing zero opened nodes", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      const body = path === "/info" ? { profile: { characterName: "X" }, daevanion: { boardList: [{ id: 61, openNodeCount: 3 }] } }
        : path === "/daevanion" ? { nodeList: [{ open: 1 }] } : { equipment: { equipmentList: [] }, skill: { skillList: [] } };
      return new Response(JSON.stringify(body), { status: 200 });
    }));
    const { fetchCharacter } = await load();
    await expect(fetchCharacter("abcdefgh1234", 2103, "nae")).rejects.toThrow(/Daevanion.*incomplete.*refresh/i);
  });

  it.each(["equipment", "board summary"])("does not treat missing %s data as empty ownership", async (missing) => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      const body = path === "/info" ? { profile: { characterName: "X" }, ...(missing === "board summary" ? {} : { daevanion: { boardList: [] } }) }
        : {};
      return new Response(JSON.stringify(body), { status: 200 });
    }));
    const { fetchCharacter } = await load();
    await expect(fetchCharacter("abcdefgh1234", 2103, "nae")).rejects.toThrow(/unavailable|incomplete/i);
  });

  it("requires the opened-board effect summary, not only a matching node count", async () => {
    const request = fetch;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const body = await (await request(url)).json();
      delete body.openStatEffectList;
      return new Response(JSON.stringify(body), { status: 200 });
    }));
    const { fetchCharacter } = await load();
    await expect(fetchCharacter("abcdefgh1234", 2103, "nae")).rejects.toThrow(/Daevanion.*effects.*unavailable/i);
  });

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

  it("asks for equipment and every Daevanion board at once, without pauses", async () => {
    const started: string[] = [];
    const release: Array<() => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = new URL(url);
        started.push(u.pathname + (u.searchParams.get("boardId") ? `#${u.searchParams.get("boardId")}` : ""));
        if (u.pathname === "/info") {
          const board = (id: number) => ({ id, openNodeCount: 2 });
          return new Response(JSON.stringify({ profile: { characterName: "X" }, daevanion: { boardList: [board(61), board(63), { id: 64, openNodeCount: 0 }] } }), { status: 200 });
        }
        await new Promise<void>((r) => release.push(r)); // hold every other reply until the test lets go
        const body = u.pathname === "/daevanion" ? { nodeList: [{ open: 1 }, { open: 1 }], openStatEffectList: [] }
          : { equipment: { equipmentList: [] }, skill: { skillList: [] } };
        return new Response(JSON.stringify(body), { status: 200 });
      }),
    );
    const { fetchCharacter } = await load();
    const p = fetchCharacter("abcdefgh1234", 2103, "nae");
    await vi.waitFor(() => expect(started.length).toBe(4)); // info, then equipment and two boards (board 64 is closed: skipped)
    expect(started.slice(1).sort()).toEqual(["/daevanion#61", "/daevanion#63", "/equipment"]);
    expect(release.length).toBe(3); // all three are in flight together
    release.forEach((r) => r());
    const raw = await p;
    expect(Object.keys(raw.daevanion).sort()).toEqual(["61", "63"]);
  });
}, 20_000);
