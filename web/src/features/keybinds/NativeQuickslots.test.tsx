import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import gdFixture from "@/fixtures/gamedata_sorcerer.json";
import compareFixture from "@/fixtures/compare.json";
import keybindFixture from "@/fixtures/keybinds.json";
import type { CharacterBuild, GameData, KeybindPlan } from "@/lib/types";
import { NativeQuickslots } from "./NativeQuickslots";

const gd = gdFixture as unknown as GameData;
const build = { ...compareFixture.leveling.build, level: 45 } as unknown as CharacterBuild;
const plan = keybindFixture.plan as unknown as KeybindPlan;
const props = { build, gd, plan, icons: {} };

beforeEach(() => localStorage.clear());

it("renders four editable placement rows above a separate twelve-column hotbar", () => {
  render(<NativeQuickslots {...props} />);
  const placement = screen.getByRole("group", { name: "Four-row skill placement" });
  expect(placement.querySelectorAll("[data-row]")).toHaveLength(48);
  expect([...placement.querySelectorAll("[data-row-label]")].map(n => n.textContent)).toEqual(["3", "2", "1", "0"]);
  const bar = screen.getByRole("group", { name: "Quick Use hotbar preview" });
  expect(within(bar).getAllByRole("button")).toHaveLength(12);
  expect(within(bar).getByRole("button", { name: /Quick Use 8.*Flame Scattershot/ })).toBeInTheDocument();
});

it("shows a truthful unavailable state when the engine has no client action mappings", () => {
  render(<NativeQuickslots {...props} plan={{ ...plan, actions: undefined }} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Client Quick Use mappings are unavailable for this class.");
  expect(screen.queryByRole("button", { name: "Add Macro" })).not.toBeInTheDocument();
});

it("adds one linked macro entry when the chosen column contains four skills", () => {
  render(<NativeQuickslots {...props} />);
  for (const [row, skill] of [[1, "Blaze"], [2, "Frost"], [3, "Wish of Concentration"]] as const) {
    fireEvent.click(screen.getByRole("button", { name: `Quick Use 8, row ${row}: Empty` }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: `Assign ${skill}` }));
  }
  fireEvent.click(screen.getByRole("button", { name: "Add Macro" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add Quick Use 8: Flame Scattershot" }));
  const entries = screen.getByRole("list", { name: "Macro entries" });
  expect(within(entries).getAllByRole("listitem")).toHaveLength(1);
  expect(within(entries).getByText("Flame Scattershot")).toBeInTheDocument();
  expect(within(entries).getByRole("spinbutton", { name: "Entry 1 delay milliseconds" })).toHaveValue(10);
  expect(entries.querySelector("[data-quick-use]")).toHaveAttribute("data-quick-use", "8");
});

it("keeps an incomplete delay draft focused and changes only the edited entry on blur", () => {
  render(<NativeQuickslots {...props} />);
  for (const id of [1, 8]) {
    fireEvent.click(screen.getByRole("button", { name: "Add Macro" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: new RegExp(`^Add Quick Use ${id}:`) }));
  }
  const delay = screen.getByRole("spinbutton", { name: "Entry 1 delay milliseconds" });
  delay.focus();
  fireEvent.change(delay, { target: { value: "2" } });
  expect(delay).toHaveValue(2);
  fireEvent.change(delay, { target: { value: "25" } });
  expect(delay).toHaveFocus();
  fireEvent.blur(delay);
  expect(delay).toHaveValue(25);
  expect(screen.getByRole("spinbutton", { name: "Entry 2 delay milliseconds" })).toHaveValue(10);
});

it("changes the hotbar's eligible skill without changing the macro's selected column", () => {
  render(<NativeQuickslots {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Quick Use 8, row 1: Empty" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Assign Blaze" }));
  fireEvent.click(screen.getByRole("button", { name: "Add Macro" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add Quick Use 8: Flame Scattershot" }));
  const checkbox = screen.getByRole("checkbox", { name: "Flame Scattershot ready in row 0" });
  checkbox.focus();
  fireEvent.click(checkbox);
  expect(checkbox).toHaveFocus();
  const bar = screen.getByRole("group", { name: "Quick Use hotbar preview" });
  expect(within(bar).getByRole("button", { name: "Quick Use 8: Blaze" })).toBeInTheDocument();
  const entries = screen.getByRole("list", { name: "Macro entries" });
  expect(within(entries).getByText("Flame Scattershot")).toBeInTheDocument();
  expect(entries.querySelector("[data-quick-use]")).toHaveAttribute("data-quick-use", "8");
});

it("restores a character's configuration without giving it to another character", () => {
  const first = render(<NativeQuickslots {...props} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Macro activation binding" }), { target: { value: "F8" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Macro" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Add Quick Use 8:/ }));
  first.rerender(<NativeQuickslots {...props} build={{ ...build, name: "Another character" }} />);
  expect(screen.getByRole("textbox", { name: "Macro activation binding" })).toHaveValue("");
  expect(within(screen.getByRole("list", { name: "Macro entries" })).queryAllByRole("listitem")).toHaveLength(0);
  first.unmount();
  render(<NativeQuickslots {...props} />);
  expect(screen.getByRole("textbox", { name: "Macro activation binding" })).toHaveValue("F8");
  expect(within(screen.getByRole("list", { name: "Macro entries" })).getAllByRole("listitem")).toHaveLength(1);
});

it("reports binding conflicts with alternate keys and lets the user remove the conflict", () => {
  render(<NativeQuickslots {...props} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Macro activation binding" }), { target: { value: " q " } });
  expect(screen.getByRole("alert")).toHaveTextContent(/Q.*Macro activation.*Quick Use 2/i);
  const alternate = screen.getByRole("textbox", { name: "Alternate bindings for Quick Use 2" });
  fireEvent.change(alternate, { target: { value: "" } });
  fireEvent.blur(alternate);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("recognizes mouse aliases as the same physical binding when checking conflicts", () => {
  render(<NativeQuickslots {...props} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Macro activation binding" }), { target: { value: "M1" } });
  expect(screen.getByRole("alert")).toHaveTextContent("LEFT MOUSE is assigned to Macro activation and Quick Use 1.");
});

it("preserves saved rows but flags an unacquired skill after the build changes", () => {
  const view = render(<NativeQuickslots {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Quick Use 8, row 1: Empty" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Assign Blaze" }));
  view.rerender(<NativeQuickslots {...props} build={{ ...build, skill_ranks: { ...build.skill_ranks, blaze: 0 } }} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Blaze in Quick Use 8 / row 1 is unavailable for this build.");
  expect(screen.getByRole("button", { name: "Quick Use 8, row 1: Blaze" })).toBeInTheDocument();
});

it("stores separate named configurations that share one Macro activation binding", () => {
  const view = render(<NativeQuickslots {...props} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Macro activation binding" }), { target: { value: "F8" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Macro" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Add Quick Use 8:/ }));
  fireEvent.click(screen.getByRole("button", { name: "New configuration" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Configuration name" }), { target: { value: "Boss" } });
  fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
  expect(within(screen.getByRole("list", { name: "Macro entries" })).queryAllByRole("listitem")).toHaveLength(0);
  expect(screen.getByRole("textbox", { name: "Macro activation binding" })).toHaveValue("F8");
  fireEvent.change(screen.getByRole("combobox", { name: "Saved configuration" }), { target: { value: "macro-1" } });
  expect(within(screen.getByRole("list", { name: "Macro entries" })).getAllByRole("listitem")).toHaveLength(1);
  view.unmount();
  render(<NativeQuickslots {...props} />);
  expect(screen.getByRole("combobox", { name: "Saved configuration" })).toHaveValue("macro-1");
  expect(screen.getByRole("option", { name: "Boss" })).toBeInTheDocument();
});

it("renames a saved configuration and asks before deleting it", () => {
  render(<NativeQuickslots {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Rename configuration" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Configuration name" }), { target: { value: "Leveling" } });
  fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
  expect(screen.getByRole("option", { name: "Leveling" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete configuration" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "New configuration" }));
  fireEvent.click(screen.getByRole("button", { name: "Save configuration" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete configuration" }));
  expect(screen.getByRole("option", { name: "Macro 2" })).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm delete" }));
  expect(screen.queryByRole("option", { name: "Macro 2" })).not.toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Saved configuration" })).toHaveValue("macro-1");
});

it("copies the edited column-linked setup with individual delays, not the worker's rotation instructions", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<NativeQuickslots {...props} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Macro activation binding" }), { target: { value: "F8" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Macro" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Add Quick Use 8:/ }));
  const delay = screen.getByRole("spinbutton", { name: "Entry 1 delay milliseconds" });
  fireEvent.change(delay, { target: { value: "25" } }); fireEvent.blur(delay);
  fireEvent.click(screen.getByText("Setup sheet"));
  fireEvent.click(screen.getByRole("button", { name: "Copy sheet" }));
  expect(writeText).toHaveBeenCalledOnce();
  const text = writeText.mock.calls[0][0] as string;
  expect(text).toContain("Macro activation: F8");
  expect(text).toContain("| 1 | Quick Use 8 | ` | Flame Scattershot | 25 |");
  expect(text).toContain("Entry numbering is not runtime execution order.");
  expect(text).not.toMatch(/F9|F10|F11|macro DPS|20 entries|~every/i);
});

it("warns about mouse activation in AION 1 mode without banning mouse-bound columns as entries", () => {
  render(<NativeQuickslots {...props} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Control mode" }), { target: { value: "aion1" } });
  fireEvent.click(screen.getByRole("button", { name: "Add Macro" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Add Quick Use 1:/ }));
  expect(within(screen.getByRole("list", { name: "Macro entries" })).getAllByRole("listitem")).toHaveLength(1);
  expect(screen.queryByText(/Mouse-related Macro activation bindings/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Macro activation binding" }), { target: { value: "M3" } });
  expect(screen.getByRole("status")).toHaveTextContent("Mouse-related Macro activation bindings do not function in AION 1 Control Mode.");
  fireEvent.change(screen.getByRole("combobox", { name: "Control mode" }), { target: { value: "aion2" } });
  expect(screen.queryByText(/Mouse-related Macro activation bindings/)).not.toBeInTheDocument();
});

it("keeps an alternate-binding draft editable until blur", () => {
  render(<NativeQuickslots {...props} />);
  const alternate = screen.getByRole("textbox", { name: "Alternate bindings for Quick Use 2" });
  alternate.focus();
  fireEvent.change(alternate, { target: { value: "F7, " } });
  expect(alternate).toHaveValue("F7, ");
  fireEvent.change(alternate, { target: { value: "F7, F6" } });
  fireEvent.blur(alternate);
  expect(alternate).toHaveValue("F7, F6");
});

it("offers scroll controls and keyboard access to the full grid", () => {
  render(<NativeQuickslots {...props} />);
  const region = screen.getByRole("region", { name: "Skill placement and separate hotbar" });
  const scrollBy = vi.fn();
  Object.defineProperty(region, "scrollBy", { configurable: true, value: scrollBy });
  fireEvent.click(screen.getByRole("button", { name: "Scroll skill columns right" }));
  expect(scrollBy).toHaveBeenLastCalledWith({ left: 280, behavior: "auto" });
  fireEvent.keyDown(region, { key: "ArrowLeft" });
  expect(scrollBy).toHaveBeenLastCalledWith({ left: -280, behavior: "auto" });
});

it("closes an open picker when the build goes stale and does not reopen it later", () => {
  const view = render(<NativeQuickslots {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Add Macro" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  view.rerender(<NativeQuickslots {...props} disabled />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  view.rerender(<NativeQuickslots {...props} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("returns keyboard focus to the opener when a picker is cancelled", async () => {
  render(<NativeQuickslots {...props} />);
  const opener = screen.getByRole("button", { name: "Add Macro" });
  opener.focus(); fireEvent.click(opener);
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  await waitFor(() => expect(opener).toHaveFocus());
});

it("keeps later Korea stigma columns locked using the existing regional roadmap", () => {
  render(<NativeQuickslots {...props} build={{ ...build, region: "korea", level: 22, stigma_unlocked: true }} />);
  expect(screen.getByRole("button", { name: /^Quick Use 9, row 0:/ })).not.toBeDisabled();
  expect(screen.getByRole("button", { name: "Quick Use 10, row 0: Empty" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Quick Use 12, row 0: Empty" })).toBeDisabled();
});

it("flags charge handling as unverified rather than promising a native macro prescription", () => {
  render(<NativeQuickslots {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Add Macro" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add Quick Use 6: Hellfire" }));
  expect(within(screen.getByRole("list", { name: "Macro entries" })).getByText("Hellfire: native macro charge handling is unverified.")).toBeInTheDocument();
});

it("also flags Chanter's charge-tagged Rushing Smash in the editor and copied setup", () => {
  const chanterGd: GameData = { ...gd, class_key: "chanter", skills: { "rushing-smash": {
    ...gd.skills.hellfire, key: "rushing-smash", name: "Rushing Smash", unlock_level: 1,
    tags: ["active", "charge", "manual"],
  } } };
  const chanterBuild: CharacterBuild = { ...build, name: "Chanter test", class_key: "chanter", skill_ranks: { "rushing-smash": 8 }, stigmas: [], specs: { "rushing-smash": [1] } };
  const chanterPlan: KeybindPlan = { ...plan, actions: plan.actions!.map(action => ({ ...action, default_skill: action.id === 2 ? "rushing-smash" : null })) };
  render(<NativeQuickslots build={chanterBuild} gd={chanterGd} plan={chanterPlan} icons={{}} />);
  fireEvent.click(screen.getByRole("button", { name: "Add Macro" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add Quick Use 2: Rushing Smash" }));
  expect(within(screen.getByRole("list", { name: "Macro entries" })).getByText("Rushing Smash: native macro charge handling is unverified.")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Setup sheet"));
  expect(screen.getAllByText("Rushing Smash: native macro charge handling is unverified.")).toHaveLength(2);
});
