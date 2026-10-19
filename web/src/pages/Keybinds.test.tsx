import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import gd from "@/fixtures/gamedata_sorcerer.json";
import compare from "@/fixtures/compare.json";
import setup from "@/fixtures/keybinds.json";
import { ACTIVE_BUILD_KEY, readActiveBuild } from "@/features/keybinds/activeBuild";
import { KeybindsPage } from "./Keybinds";

const engine = vi.hoisted(() => ({ keybinds: vi.fn(), gamedata: vi.fn(), iconUrls: vi.fn() }));
vi.mock("@/engine/api", () => ({ ...engine, isMockEngine: false }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(ACTIVE_BUILD_KEY, JSON.stringify(compare.leveling.build));
  engine.gamedata.mockReset().mockResolvedValue(gd);
  engine.iconUrls.mockReset().mockResolvedValue({});
  engine.keybinds.mockReset().mockResolvedValue(setup);
});

it("opens an older saved character without explicit bonus ranks and preserves its stored record", async () => {
  const { bonus_ranks: _bonusRanks, ...legacy } = compare.leveling.build;
  const stored = JSON.stringify(legacy);
  localStorage.setItem(ACTIVE_BUILD_KEY, stored);
  render(<MemoryRouter><KeybindsPage /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Macro activation" })).toBeInTheDocument();
  expect(readActiveBuild()?.bonus_ranks).toEqual({});
  expect(localStorage.getItem(ACTIVE_BUILD_KEY)).toBe(stored);
});

it("starts with client bindings without migrating a former character's global overrides", async () => {
  localStorage.setItem("aion2c.kb.bindings.v1", JSON.stringify({ "2": "F7" }));
  engine.keybinds.mockImplementation((...args: unknown[]) => Promise.resolve({ ...setup, plan: { ...setup.plan,
    actions: setup.plan.actions.map(action => ({ ...action, binding: (args[5] as Record<string, string>)[String(action.id)] ?? action.binding })),
  } }));
  render(<MemoryRouter><KeybindsPage /></MemoryRouter>);
  expect(await screen.findByRole("textbox", { name: "Binding for Quick Use 2" })).toHaveValue("Right mouse");
  expect(localStorage.getItem("aion2c.kb.bindings.v1")).toBe('{"2":"F7"}');
  const count = engine.keybinds.mock.calls.length;
  fireEvent.change(screen.getByRole("textbox", { name: "Macro activation binding" }), { target: { value: "F8" } });
  expect(engine.keybinds).toHaveBeenCalledTimes(count);
});

it("provides one unassigned native Macro activation binding rather than scenario hotkeys", async () => {
  render(<MemoryRouter><KeybindsPage /></MemoryRouter>);
  await waitFor(() => expect(engine.keybinds).toHaveBeenCalled());
  await screen.findByRole("heading", { name: "Macro activation" });
  expect(screen.getByRole("textbox", { name: "Macro activation binding" })).toHaveValue("");
  expect(screen.queryByRole("combobox", { name: "Hotkey" })).not.toBeInTheDocument();
});
