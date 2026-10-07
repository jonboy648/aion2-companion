import { renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { readImportedCharacterContext, storeImportedCharacterContext } from "@/features/keybinds/activeBuild";
import { useCharacter } from "./useCharacter";

vi.mock("@/lib/armory", async (original) => ({
  ...await original<typeof import("@/lib/armory")>(),
  search: vi.fn().mockRejectedValue(new Error("Armory unavailable")),
}));

it("does not retain another character's planner context after a failed new lookup", async () => {
  localStorage.clear();
  storeImportedCharacterContext({ region: "nae", serverId: "2103", name: "DarthThot" });
  const { result } = renderHook(() => useCharacter("nae", "1101", "Luna"));
  await waitFor(() => expect(result.current.phase).toBe("error"));
  expect(result.current.error).toBe("Armory unavailable");
  expect(result.current.imp).toBeNull();
  expect(readImportedCharacterContext()).toBeNull();
});
