import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import gdFx from "@/fixtures/gamedata_sorcerer.json";
import iconNames from "../../../public/engine/icons/templar.json";
import { useClassData } from "./useClassData";

const engine = vi.hoisted(() => ({ gamedata: vi.fn(), iconUrls: vi.fn() }));
vi.mock("@/engine/api", () => engine);

const names = { blaze: "ICON_SO_SKILL_001" };
const icons = { blaze: "https://assets.playnccdn.com/static-aion2-gamedata/resources/ICON_SO_SKILL_001.png" };
const fetchMock = vi.fn<typeof fetch>();
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.stubEnv("VITE_ENGINE", "real");
  vi.stubEnv("BASE_URL", "/companion/");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async (url) =>
    response(String(url).includes("/classes/") ? gdFx : names));
  engine.gamedata.mockReset().mockResolvedValue(gdFx);
  engine.iconUrls.mockReset().mockResolvedValue(icons);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("useClassData", () => {
  it("loads static class data and icons under BASE_URL without engine calls in real mode", async () => {
    const { result } = renderHook(() => useClassData("sorcerer", { staticData: true }));
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/companion/engine/classes/sorcerer.json",
      "/companion/engine/icons/sorcerer.json",
    ]);
    await waitFor(() => expect(result.current.gd).toEqual(gdFx));
    expect(result.current.icons).toEqual(icons);
    expect(result.current.error).toBeNull();
    expect(engine.gamedata).not.toHaveBeenCalled();
    expect(engine.iconUrls).not.toHaveBeenCalled();
  });

  it("surfaces class HTTP errors even when the response body looks like class data", async () => {
    fetchMock.mockImplementation(async (url) =>
      response(String(url).includes("/classes/") ? gdFx : icons, String(url).includes("/classes/") ? 503 : 200));
    const { result } = renderHook(() => useClassData("sorcerer", { staticData: true }));
    await waitFor(() => expect(result.current.error).toMatch(/503/));
    expect(result.current.gd).toBeNull();
  });

  it("resolves shipped icon names without loading the Python API", async () => {
    fetchMock.mockImplementation(async (url) => response(String(url).includes("/classes/")
      ? { ...gdFx, class_key: "templar" } : iconNames));
    const { result } = renderHook(() => useClassData("templar", { staticData: true }));
    await waitFor(() => expect(result.current.gd?.class_key).toBe("templar"));
    expect(result.current.icons.pummel).toBe("https://assets.playnccdn.com/static-aion2-gamedata/resources/ICON_TE_SKILL_006.png");
    expect(engine.iconUrls).not.toHaveBeenCalled();
  });

  it("does not turn malformed asset names into image URLs", async () => {
    fetchMock.mockImplementation(async (url) => response(String(url).includes("/classes/") ? gdFx : {
      missing: null, path: "../image", url: "https://example.com/image.png", empty: "", good: "ICON_SO_SKILL_001",
    }));
    const { result } = renderHook(() => useClassData("sorcerer", { staticData: true }));
    await waitFor(() => expect(result.current.gd).toEqual(gdFx));
    expect(result.current.icons).toEqual({ missing: null, path: null, url: null, empty: null,
      good: icons.blaze });
  });

  it("rejects JSON belonging to a different class", async () => {
    fetchMock.mockImplementation(async (url) =>
      response(String(url).includes("/classes/") ? { ...gdFx, class_key: "ranger" } : icons));
    const { result } = renderHook(() => useClassData("sorcerer", { staticData: true }));
    await waitFor(() => expect(result.current.error).toMatch(/class.*sorcerer/i));
    expect(result.current.gd).toBeNull();
  });

  it.each(["../sorcerer", "sorcerer?other", "unknown", "Sorcerer", "toString"])(
    "rejects unknown or unsafe static class key %s before requesting a URL", async (classKey) => {
      const { result } = renderHook(() => useClassData(classKey, { staticData: true }));
      await waitFor(() => expect(result.current.error).toMatch(/unknown class/i));
      expect(result.current.gd).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(engine.gamedata).not.toHaveBeenCalled();
      expect(engine.iconUrls).not.toHaveBeenCalled();
    },
  );

  it("aborts both old fetches on class change and ignores their late responses", async () => {
    const oldData = deferred<Response>();
    const oldIcons = deferred<Response>();
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("classes/sorcerer.json")) return oldData.promise;
      if (String(url).endsWith("icons/sorcerer.json")) return oldIcons.promise;
      return response(String(url).includes("/classes/") ? { ...gdFx, class_key: "ranger" } : { ranger: "ICON_RA_SKILL_001" });
    });
    const { result, rerender } = renderHook(({ classKey }) => useClassData(classKey, { staticData: true }), {
      initialProps: { classKey: "sorcerer" },
    });
    const oldSignals = fetchMock.mock.calls.map(([, options]) => options?.signal);
    rerender({ classKey: "ranger" });
    expect(result.current.gd).toBeNull();
    await waitFor(() => expect(result.current.gd?.class_key).toBe("ranger"));
    await act(async () => {
      oldData.resolve(response(gdFx));
      oldIcons.resolve(response(icons));
    });
    expect(result.current.gd?.class_key).toBe("ranger");
    expect(result.current.icons).toEqual({ ranger: "https://assets.playnccdn.com/static-aion2-gamedata/resources/ICON_RA_SKILL_001.png" });
    expect(oldSignals).toHaveLength(2);
    oldSignals.forEach((signal) => expect(signal?.aborted).toBe(true));
  });

  it("clears a previous error when returning to a class while its new request is pending", async () => {
    fetchMock.mockImplementation(async (url) => response({}, String(url).includes("/classes/") ? 503 : 200));
    const { result, rerender } = renderHook(({ classKey }) => useClassData(classKey, { staticData: true }), {
      initialProps: { classKey: "sorcerer" },
    });
    await waitFor(() => expect(result.current.error).toMatch(/503/));
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    rerender({ classKey: "ranger" });
    expect(result.current.error).toBeFalsy();
    rerender({ classKey: "sorcerer" });
    expect(result.current.gd).toBeNull();
    expect(result.current.icons).toEqual({});
    expect(result.current.error).toBeFalsy();
  });

  it.each(["http", "network", "json"])("keeps class data usable after an optional icon %s failure", async (failure) => {
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes("/classes/")) return response(gdFx);
      if (failure === "network") throw new Error("Icons offline");
      if (failure === "json") return new Response("not JSON");
      return response(icons, 404);
    });
    const { result } = renderHook(() => useClassData("sorcerer", { staticData: true }));
    await waitFor(() => expect(result.current.gd).toEqual(gdFx));
    expect(result.current.icons).toEqual({});
    expect(result.current.error).toBeNull();
    expect(engine.gamedata).not.toHaveBeenCalled();
    expect(engine.iconUrls).not.toHaveBeenCalled();
  });

  it("aborts both pending fetches on unmount and ignores their late failures", async () => {
    const pendingData = deferred<Response>();
    const pendingIcons = deferred<Response>();
    fetchMock.mockReturnValueOnce(pendingData.promise).mockReturnValueOnce(pendingIcons.promise);
    const { result, unmount } = renderHook(() => useClassData("sorcerer", { staticData: true }));
    const pendingState = result.current;
    const signals = fetchMock.mock.calls.map(([, options]) => options?.signal);
    unmount();
    expect(signals).toHaveLength(2);
    signals.forEach((signal) => expect(signal?.aborted).toBe(true));
    await act(async () => {
      pendingData.reject(new Error("Late class failure"));
      pendingIcons.reject(new Error("Late icon failure"));
    });
    expect(result.current).toBe(pendingState);
  });

  it.each([undefined, false])("retains engine calls in real mode when staticData is %s", async (staticData) => {
    const { result } = renderHook(() => staticData === undefined
      ? useClassData("sorcerer")
      : useClassData("sorcerer", { staticData }));
    await waitFor(() => expect(result.current.gd).toEqual(gdFx));
    expect(result.current.icons).toEqual(icons);
    expect(engine.gamedata).toHaveBeenCalledWith("sorcerer");
    expect(engine.iconUrls).toHaveBeenCalledWith("sorcerer");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retains the fixture API path in mock mode even with staticData enabled", async () => {
    vi.stubEnv("VITE_ENGINE", "mock");
    engine.gamedata.mockResolvedValue({ ...gdFx, class_key: "templar" });
    const { result } = renderHook(() => useClassData("templar", { staticData: true }));
    await waitFor(() => expect(result.current.gd?.class_key).toBe("templar"));
    expect(result.current.icons).toEqual(icons);
    expect(engine.gamedata).toHaveBeenCalledWith("templar");
    expect(engine.iconUrls).toHaveBeenCalledWith("templar");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["gladiator", "templar", "assassin", "ranger", "sorcerer", "spiritmaster", "cleric", "chanter"])(
    "accepts known class %s for static loading", async (classKey) => {
      fetchMock.mockImplementation(async (url) =>
        response(String(url).includes("/classes/") ? { ...gdFx, class_key: classKey } : icons));
      const { result } = renderHook(() => useClassData(classKey, { staticData: true }));
      await waitFor(() => expect(result.current.gd?.class_key).toBe(classKey));
      expect(result.current.error).toBeNull();
    },
  );

  it.each([null, undefined, ""])("makes no requests without a selected class (%s)", (classKey) => {
    const { result } = renderHook(() => useClassData(classKey, { staticData: true }));
    expect(result.current.gd).toBeNull();
    expect(result.current.icons).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(engine.gamedata).not.toHaveBeenCalled();
    expect(engine.iconUrls).not.toHaveBeenCalled();
  });

  it("clears stale data on a source change for the same class and does not reload for a new options object", async () => {
    const { result, rerender } = renderHook(({ staticData }) => useClassData("sorcerer", { staticData }), {
      initialProps: { staticData: false },
    });
    await waitFor(() => expect(result.current.gd).toEqual(gdFx));
    fetchMock.mockImplementation(async (url) => response({}, String(url).includes("/classes/") ? 503 : 200));
    rerender({ staticData: true });
    expect(result.current.gd).toBeNull();
    expect(result.current.icons).toEqual({});
    await waitFor(() => expect(result.current.error).toMatch(/503/));
    engine.gamedata.mockImplementation(() => new Promise(() => {}));
    rerender({ staticData: false });
    expect(result.current.gd).toBeNull();
    expect(result.current.error).toBeFalsy();
    rerender({ staticData: false });
    expect(engine.gamedata).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores an old class failure after the newly selected class has loaded", async () => {
    const oldData = deferred<Response>();
    fetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("classes/sorcerer.json")) return oldData.promise;
      return response(String(url).includes("/classes/") ? { ...gdFx, class_key: "ranger" } : icons);
    });
    const { result, rerender } = renderHook(({ classKey }) => useClassData(classKey, { staticData: true }), {
      initialProps: { classKey: "sorcerer" },
    });
    rerender({ classKey: "ranger" });
    await waitFor(() => expect(result.current.gd?.class_key).toBe("ranger"));
    await act(async () => oldData.reject(new Error("Old request failed")));
    expect(result.current.gd?.class_key).toBe("ranger");
    expect(result.current.error).toBeNull();
  });
});
