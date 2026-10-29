import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import gdFixture from "@/fixtures/gamedata_sorcerer.json";
import compareFixture from "@/fixtures/compare.json";
import keybindFixture from "@/fixtures/keybinds.json";
import type { CompareResult, GameData, KeybindPlan } from "@/lib/types";
import { KeybindsPage } from "@/pages/Keybinds";
import { readActiveBuild, readPlannedBuild, storePlannedBuild } from "./activeBuild";
import { initialNativeConfig } from "./nativeConfig";
import { nativeOwnerKey, nativeStorageKey, readNativeConfig, writeNativeConfig } from "./nativeStorage";
import { NativeQuickslots } from "./NativeQuickslots";

const gd = gdFixture as unknown as GameData;
const plan = keybindFixture.plan as unknown as KeybindPlan;
const chosen = { ...(compareFixture as unknown as CompareResult).leveling!, objective: "stagger" as const,
  priority: { label: "Selected gauge priority", entries: ["frost", "frost-burst", "flame-arrow", "hellfire", "burst", "frost"].map(skill_key => ({
    skill_key, charge_level: skill_key === "hellfire" ? 4 : 0, require_status: null,
  })) },
};
function prepare() {
  storePlannedBuild(chosen);
  const build = readActiveBuild()!;
  const owner = nativeOwnerKey(build);
  const saved = initialNativeConfig(plan.actions!, gd, build);
  saved.activationBinding = "F8";
  saved.bindings["7"] = "M4";
  saved.alternateBindings["7"] = ["F6"];
  saved.columns["7"][1] = "blaze";
  saved.recipes = [{ id: "raid", name: "My Raid", entries: [{ id: "a", quickUseId: 7, delayMs: 777 }] },
    { id: "spare", name: "Spare", entries: [{ id: "b", quickUseId: 1, delayMs: 25 }] }];
  saved.selectedRecipe = "raid";
  writeNativeConfig(owner, saved);
  return { build, owner, saved, key: nativeStorageKey(owner), planned: readPlannedBuild(build)! };
}
beforeEach(() => localStorage.clear());

it("previews the chosen Character goal, applies only on request, and reverts the complete saved setup after reload", async () => {
  const { owner, saved, key } = prepare();
  const original = localStorage.getItem(key);
  let view = render(<MemoryRouter><KeybindsPage /></MemoryRouter>);
  const preview = await screen.findByRole("button", { name: "Preview suggested setup" });
  expect(screen.getByRole("region", { name: "Chosen Character plan" })).toHaveTextContent(/leveling.*stagger/i);
  expect(localStorage.getItem(key)).toBe(original);
  fireEvent.click(preview);
  let dialog = screen.getByRole("dialog", { name: "Suggested native setup" });
  expect(dialog).toHaveTextContent("Hellfire");
  expect(dialog).toHaveTextContent(/charge hold\/release.*unverified/i);
  expect(dialog).toHaveTextContent(/10 ms.*starter.*editable/i);
  expect(dialog).toHaveTextContent(/shared.*saved configurations/i);
  expect(dialog).toHaveTextContent(/runtime execution order/i);
  expect(localStorage.getItem(key)).toBe(original);
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(localStorage.getItem(key)).toBe(original);
  fireEvent.click(preview);
  dialog = screen.getByRole("dialog", { name: "Suggested native setup" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Apply suggested setup" }));
  const applied = readNativeConfig(owner, saved).config;
  expect(applied.recipes.slice(0, 2)).toEqual(saved.recipes);
  expect(applied.recipes.at(-1)!.entries.map(entry => [entry.quickUseId, entry.delayMs])).toEqual([[2, 10], [7, 777], [1, 25]]);
  expect(applied.columns["1"]).toEqual(saved.columns["1"]);
  expect(applied.columns["7"]).toEqual(["frost-burst", null, null, null]);
  expect(applied.bindings).toEqual(saved.bindings);
  expect(applied.alternateBindings).toEqual(saved.alternateBindings);
  expect(screen.getByRole("textbox", { name: "Macro activation binding" })).toHaveValue("F8");
  expect(screen.getByRole("spinbutton", { name: "Entry 2 delay milliseconds" })).toHaveValue(777);
  view.unmount();
  view = render(<MemoryRouter><KeybindsPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: "Revert suggested setup" }));
  expect(readNativeConfig(owner, saved).config).toEqual(saved);
  expect(screen.getByRole("combobox", { name: "Saved configuration" })).toHaveValue("raid");
  expect(screen.getByRole("spinbutton", { name: "Entry 1 delay milliseconds" })).toHaveValue(777);
  view.unmount();
});

it("disables a stale chosen plan without changing existing saved columns", () => {
  const { build, planned, key } = prepare();
  const original = localStorage.getItem(key);
  render(<NativeQuickslots build={{ ...build, level: build.level - 1 }} gd={gd} plan={plan} icons={{}} planned={planned} />);
  fireEvent.click(screen.getByRole("button", { name: "Preview suggested setup" }));
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent(/does not match/i);
  expect(within(dialog).getByRole("button", { name: "Apply suggested setup" })).toBeDisabled();
  expect(localStorage.getItem(key)).toBe(original);
});

it("closes a suggestion preview when disabled and requires a fresh preview afterwards", () => {
  const { build, planned } = prepare();
  const props = { build, gd, plan, icons: {}, planned };
  const view = render(<NativeQuickslots {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Preview suggested setup" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  view.rerender(<NativeQuickslots {...props} disabled />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.rerender(<NativeQuickslots {...props} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("leaves the saved setup untouched if the pre-apply copy cannot be retained", () => {
  const { build, planned, key } = prepare();
  const original = localStorage.getItem(key);
  render(<NativeQuickslots build={build} gd={gd} plan={plan} icons={{}} planned={planned} />);
  fireEvent.click(screen.getByRole("button", { name: "Preview suggested setup" }));
  const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage full"); });
  try {
    fireEvent.click(screen.getByRole("button", { name: "Apply suggested setup" }));
    expect(localStorage.getItem(key)).toBe(original);
    expect(screen.getByRole("dialog")).toHaveTextContent(/could not retain.*not applied/i);
  } finally { setItem.mockRestore(); }
});
