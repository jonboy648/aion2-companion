import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import rawFx from "@/fixtures/armory_raw.json";
import importFx from "@/fixtures/import_character.json";
import compareFx from "@/fixtures/compare.json";
import { readImportedCharacterContext, storeImportedCharacterContext } from "@/features/keybinds/activeBuild";
import { useCharacter } from "./useCharacter";

const io = vi.hoisted(() => ({ search: vi.fn(), fetchCharacter: vi.fn(), importCharacter: vi.fn(), compare: vi.fn(), warmEngine: vi.fn() }));
vi.mock("@/lib/armory", async (original) => ({
  ...await original<typeof import("@/lib/armory")>(),
  search: io.search,
  fetchCharacter: io.fetchCharacter,
}));
vi.mock("@/engine/api", async (original) => ({
  ...await original<typeof import("@/engine/api")>(),
  importCharacter: io.importCharacter, compare: io.compare, warmEngine: io.warmEngine,
}));

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  io.search.mockRejectedValue(new Error("Armory unavailable"));
  io.importCharacter.mockResolvedValue(importFx);
  io.compare.mockResolvedValue(compareFx);
});
afterEach(cleanup);

it("does not retain another character's planner context after a failed new lookup", async () => {
  localStorage.clear();
  storeImportedCharacterContext({ region: "nae", serverId: "2103", name: "DarthThot" });
  const { result } = renderHook(() => useCharacter("nae", "1101", "Luna"));
  await waitFor(() => expect(result.current.phase).toBe("error"));
  expect(result.current.error).toBe("Armory unavailable");
  expect(result.current.imp).toBeNull();
  expect(readImportedCharacterContext()).toBeNull();
});

it("does not import a late response after the user has switched to a failing lookup", async () => {
  let finish!: (value: typeof rawFx) => void;
  io.search.mockImplementation(async (name: string) => {
    if (name === "Luna") throw new Error("Luna unavailable");
    return [{ name: "DarthThot", serverId: 2103, region: "nae", characterId: "first-character" }];
  });
  io.fetchCharacter.mockImplementation(() => new Promise<typeof rawFx>((resolve) => { finish = resolve; }));
  const { result, rerender } = renderHook(({ name }) => useCharacter("nae", "2103", name), { initialProps: { name: "DarthThot" } });
  await waitFor(() => expect(io.fetchCharacter).toHaveBeenCalledOnce());
  rerender({ name: "Luna" });
  await waitFor(() => expect(result.current.error).toBe("Luna unavailable"));
  await act(async () => finish(rawFx));
  expect(io.importCharacter).not.toHaveBeenCalled();
  expect(result.current.raw).toBeNull();
  expect(result.current.imp).toBeNull();
  expect(readImportedCharacterContext()).toBeNull();
});

it("rejects a mismatched armory profile before running calculations", async () => {
  io.search.mockResolvedValue([{ name: "Luna", serverId: 1101, region: "nae", characterId: "luna-character" }]);
  io.fetchCharacter.mockResolvedValue(rawFx);
  const { result } = renderHook(() => useCharacter("nae", "1101", "Luna"));
  await waitFor(() => expect(result.current.phase).toBe("error"));
  expect(result.current.error).toMatch(/profile.*match/i);
  expect(io.importCharacter).not.toHaveBeenCalled();
  expect(readImportedCharacterContext()).toBeNull();
});

it("refreshes with a cache bypass and clears board context if the refresh fails", async () => {
  io.search.mockResolvedValue([{ name: "DarthThot", serverId: 2103, region: "nae", characterId: "first-character" }]);
  io.fetchCharacter.mockResolvedValueOnce(rawFx).mockRejectedValueOnce(new Error("Refresh unavailable"));
  const { result } = renderHook(() => useCharacter("nae", "2103", "DarthThot"));
  await waitFor(() => expect(result.current.phase).toBe("done"));
  expect(readImportedCharacterContext()?.name).toBe("DarthThot");
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.error).toBe("Refresh unavailable"));
  expect(io.fetchCharacter).toHaveBeenLastCalledWith("first-character", 2103, "nae", true);
  expect(result.current.imp).toBeNull();
  expect(result.current.cmp).toBeNull();
  expect(result.current.raw).toBeNull();
  expect(readImportedCharacterContext()).toBeNull();
});

it("discards an old optimization after a new lookup has failed", async () => {
  io.search.mockResolvedValueOnce([{ name: "DarthThot", serverId: 2103, region: "nae", characterId: "first-character" }])
    .mockRejectedValueOnce(new Error("New lookup failed"));
  io.fetchCharacter.mockResolvedValue(rawFx);
  let finish!: (value: typeof compareFx) => void;
  io.compare.mockImplementation(() => new Promise<typeof compareFx>((resolve) => { finish = resolve; }));
  const { result, rerender } = renderHook(({ name }) => useCharacter("nae", "2103", name), { initialProps: { name: "DarthThot" } });
  await waitFor(() => expect(result.current.phase).toBe("optimize"));
  rerender({ name: "NotThere" });
  await waitFor(() => expect(result.current.error).toBe("New lookup failed"));
  await act(async () => finish(compareFx));
  expect(result.current.phase).toBe("error");
  expect(result.current.cmp).toBeNull();
  expect(readImportedCharacterContext()).toBeNull();
});
