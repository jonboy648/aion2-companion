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
  it("uses the selected build's exact priority and one scenario without reoptimizing", async () => {
    const { result } = renderHook(() => useKeybindPlan(build, plan));
    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(calls.optimize).not.toHaveBeenCalled();
    expect(calls.keybinds).toHaveBeenCalledWith(build, { level_pull: fb.priority }, {}, { boss: "F9", aoe: "F10", leveling: "F11" }, 10);
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
