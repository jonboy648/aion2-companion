import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import gdFx from "@/fixtures/gamedata_sorcerer.json";
import cmpFx from "@/fixtures/compare.json";
import kbFx from "@/fixtures/keybinds.json";
import type { CompareResult, KeybindsResult } from "@/lib/types";
import { hashBuild, type PlannedBuild } from "./activeBuild";
import { useKeybindPlan } from "./useKeybindPlan";

const calls = vi.hoisted(() => ({ keybinds: vi.fn(), optimize: vi.fn(), gamedata: vi.fn(), iconUrls: vi.fn() }));
vi.mock("@/engine/api", () => ({
  gamedata: calls.gamedata,
  iconUrls: calls.iconUrls,
  keybinds: calls.keybinds,
  optimize: calls.optimize,
}));
const fb = (cmpFx as unknown as CompareResult).leveling!;
const build = { ...fb.build, skill_points: 0, stigma_points: 0 };
const plan: PlannedBuild = { buildHash: hashBuild(build), scenario: "level_pull", playstyle: "leveling", priority: fb.priority };

beforeEach(() => {
  localStorage.clear();
  calls.keybinds.mockReset().mockResolvedValue(kbFx);
  calls.optimize.mockReset();
  calls.gamedata.mockReset().mockResolvedValue(gdFx);
  calls.iconUrls.mockReset().mockResolvedValue({});
});

describe("planned quickslots", () => {
  it("trims persisted bindings without changing action identity", async () => {
    const { result } = renderHook(() => useKeybindPlan(build, plan));
    await waitFor(() => expect(result.current.result).not.toBeNull());
    act(() => result.current.setBinding(7, " Q "));
    expect(JSON.parse(localStorage.getItem("aion2c.kb.bindings.v1")!)).toEqual({ "7": "Q" });
  });
  it.each([null, ["hellfire"], { "13": "hellfire", "7": 42 }])("ignores malformed saved pins: %j", async (pins) => {
    localStorage.setItem("aion2c.kb.pins.v2:sorcerer", JSON.stringify(pins));
    const { result } = renderHook(() => useKeybindPlan(build, plan));
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(result.current.pins).toEqual({});
  });
  it("keeps setup mounted while a binding edit is recomputed", async () => {
    const { result } = renderHook(() => useKeybindPlan(build, plan));
    await waitFor(() => expect(result.current.result).not.toBeNull());
    act(() => result.current.setBinding(7, "Q"));
    expect(result.current.result).not.toBeNull();
    expect(result.current.bindings["7"]).toBe("Q");
    expect(result.current.updating).toBe(true);
    await waitFor(() => expect(result.current.updating).toBe(false));
  });
  it("loads native setup without running a rotation search when no plan was selected", async () => {
    const { result } = renderHook(() => useKeybindPlan(build));
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(calls.optimize).not.toHaveBeenCalled();
    expect(calls.keybinds.mock.calls.at(-1)?.[1]).toEqual({});
  });
  it.each([0, -5, 10000])("normalizes a persisted delay of %s to the client limits", async (delay) => {
    localStorage.setItem("aion2c.kb.prefs.v1", JSON.stringify({ delay }));
    const { result } = renderHook(() => useKeybindPlan(build, plan));
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(result.current.delayMs).toBe(delay > 9900 ? 9900 : 10);
  });
  it("ignores malformed saved bindings and missing preferences without crashing", async () => {
    localStorage.setItem("aion2c.kb.bindings.v1", JSON.stringify(["Q"]));
    localStorage.setItem("aion2c.kb.prefs.v1", "null");
    const { result } = renderHook(() => useKeybindPlan(build, plan));
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(calls.keybinds.mock.calls.at(-1)?.[5]).toEqual({});
    expect(result.current.delayMs).toBe(10);
  });
  it("persists bindings by action identity, without importing legacy keyboard pins", async () => {
    localStorage.setItem("aion2c.kb.pins.v1:sorcerer", JSON.stringify({ "1": "hellfire" }));
    const first = renderHook(() => useKeybindPlan(build, plan));
    await waitFor(() => expect(first.result.current.result).not.toBeNull());
    expect(first.result.current.pins).toEqual({});
    expect(first.result.current.migrationNotice).toMatch(/Previous keyboard-based pins/);
    act(() => first.result.current.setBinding(7, "Q"));
    await waitFor(() => expect(calls.keybinds.mock.calls.at(-1)?.[5]).toEqual({ "7": "Q" }));
    first.unmount();
    const second = renderHook(() => useKeybindPlan(build, plan));
    await waitFor(() => expect(second.result.current.result).not.toBeNull());
    expect(calls.keybinds.mock.calls.at(-1)?.[5]).toEqual({ "7": "Q" });
  });
  it("uses the selected build's exact priority and one scenario without reoptimizing", async () => {
    const { result } = renderHook(() => useKeybindPlan(build, plan));
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(calls.optimize).not.toHaveBeenCalled();
    expect(calls.keybinds).toHaveBeenCalledWith(build, { level_pull: fb.priority }, {}, { boss: "F9", aoe: "F10", leveling: "F11" }, 10, {});
  });

  it("clears the previous result when preferences change and ignores a superseded response", async () => {
    let finish: (value: KeybindsResult) => void = () => {};
    calls.keybinds.mockImplementationOnce(() => new Promise<KeybindsResult>((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useKeybindPlan(build, plan));
    await waitFor(() => expect(calls.keybinds).toHaveBeenCalledTimes(1));
    act(() => result.current.setHotkey("leveling", "F12"));
    expect(result.current.result).toBeNull();
    await act(async () => finish({ ...kbFx, instructions_markdown: "stale" } as unknown as KeybindsResult));
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(result.current.result?.instructions_markdown).not.toBe("stale");
    expect(calls.keybinds.mock.calls.at(-1)?.[3].leveling).toBe("F12");
  });

  it("does not discard usable class data when optional icons fail", async () => {
    calls.iconUrls.mockRejectedValue(new Error("Icon service unavailable"));
    const { result } = renderHook(() => useKeybindPlan(build, plan));
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(result.current.gd?.class_key).toBe("sorcerer");
    expect(result.current.icons).toEqual({});
    expect(result.current.phase.status).toBe("ready");
  });

  it("refetches failed class data when retrying", async () => {
    calls.gamedata.mockRejectedValueOnce(new Error("Offline"));
    const { result } = renderHook(() => useKeybindPlan(build, plan));
    await waitFor(() => expect(result.current.phase.status).toBe("error"));
    expect(calls.keybinds).not.toHaveBeenCalled();
    act(() => result.current.rerun());
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(calls.gamedata).toHaveBeenCalledTimes(2);
  });
});
