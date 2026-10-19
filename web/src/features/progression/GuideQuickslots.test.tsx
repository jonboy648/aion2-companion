import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import cmpFx from "@/fixtures/compare.json";
import gdFx from "@/fixtures/gamedata_sorcerer.json";
import kbFx from "@/fixtures/keybinds.json";
import type { ClassData } from "@/features/build/useClassData";
import { hashBuild } from "@/features/keybinds/activeBuild";
import { useKeybindPlan } from "@/features/keybinds/useKeybindPlan";
import type { CompareResult, GameData, KeybindsResult } from "@/lib/types";
import { GuideQuickslots } from "./GuideQuickslots";

vi.mock("@/features/keybinds/useKeybindPlan", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/keybinds/useKeybindPlan")>(),
  useKeybindPlan: vi.fn(),
}));
const mockPlan = vi.mocked(useKeybindPlan);
const builds = cmpFx as unknown as CompareResult;
const data: ClassData = { gd: gdFx as unknown as GameData, icons: {} };
const result = kbFx as unknown as KeybindsResult;
let kb: ReturnType<typeof useKeybindPlan>;
beforeEach(() => {
  localStorage.clear();
  mockPlan.mockReset();
  kb = {
    gd: data.gd, icons: {}, phase: { status: "ready" }, result, bindings: {},
    updating: false, migrationNotice: null, planError: null, pins: {},
    pin: vi.fn(), unpin: vi.fn(), clearPins: vi.fn(), setBinding: vi.fn(),
    delayMs: 10, setDelayMs: vi.fn(), hotkeys: { boss: "F9", aoe: "F10", leveling: "F11" },
    setHotkey: vi.fn(), rerun: vi.fn(),
  };
  mockPlan.mockImplementation(() => kb);
});

describe("GuideQuickslots", () => {
  it("uses the chosen build and shows the shared native editor, not simulator macro prescriptions", () => {
    const fb = { ...builds.leveling, build: { ...builds.leveling.build, level: 45, skill_points: 123, stigma_points: 45 } };
    const original = structuredClone(fb.build);
    render(<GuideQuickslots fb={fb} data={data} />);
    const build = { ...fb.build, skill_points: 0, stigma_points: 0 };
    expect(mockPlan).toHaveBeenCalledWith(build, { buildHash: hashBuild(build), playstyle: "leveling", scenario: "level_pull", priority: fb.priority }, true);
    expect(fb.build).toEqual(original);
    expect(screen.getByRole("group", { name: "Four-row skill placement" }).querySelectorAll("[data-row]")).toHaveLength(48);
    expect(screen.getByRole("textbox", { name: "Macro activation binding" })).toHaveValue("");
    expect(within(screen.getByRole("list", { name: "Macro entries" })).queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText("Damage estimate")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Hotkey" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Macro" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Add Quick Use 8:/ }));
    expect(screen.getByRole("spinbutton", { name: "Entry 1 delay milliseconds" })).toHaveValue(10);
  });

  it("keeps mapping inputs stable while the same build becomes stale", () => {
    const { rerender } = render(<GuideQuickslots fb={builds.leveling} data={data} />);
    const [build, planned] = mockPlan.mock.calls[0];
    rerender(<GuideQuickslots fb={builds.leveling} data={{ ...data }} disabled />);
    expect(mockPlan.mock.calls.at(-1)?.[0]).toBe(build);
    expect(mockPlan.mock.calls.at(-1)?.[1]).toBe(planned);
    expect(screen.getByRole("region", { name: "Quickslots and macro" })).toHaveAttribute("inert");
    expect(screen.getByRole("textbox", { name: "Macro activation binding" })).toBeDisabled();
    for (const button of within(screen.getByRole("region", { name: "Quickslots and macro" })).getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("keeps native configurations available for a playstyle without a simulation scenario", () => {
    const { rerender } = render(<GuideQuickslots fb={builds.burst} data={data} />);
    expect(mockPlan.mock.calls.at(-1)?.[1]).toBeNull();
    expect(screen.getByRole("button", { name: "Add Macro" })).toBeInTheDocument();
    rerender(<GuideQuickslots fb={builds.leveling} data={data} />);
    expect(mockPlan.mock.calls.at(-1)?.[1]?.scenario).toBe("level_pull");
  });

  it("uses fallback class data and icons", () => {
    kb.gd = null;
    const { container } = render(<GuideQuickslots fb={builds.leveling} data={{ ...data, icons: { "ice-chain": "https://example.com/skill.png" } }} />);
    expect(screen.getByRole("button", { name: "Quick Use 2, row 0: Ice Chain" })).toBeInTheDocument();
    expect(container.querySelector('img[src="https://example.com/skill.png"]')).toBeInTheDocument();
  });

  it.each(["ready", "loading"] as const)("shows progress without fake slots when phase is %s", status => {
    kb.result = null;
    kb.phase = status === "loading" ? { status, message: "Loading class data" } : { status };
    render(<GuideQuickslots fb={builds.boss} data={data} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading quickslots");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("group", { name: "Four-row skill placement" })).not.toBeInTheDocument();
  });

  it.each(["phase", "plan"] as const)("shows %s errors and retries", source => {
    kb.result = null;
    if (source === "phase") kb.phase = { status: "error", message: "Class data unavailable" };
    else kb.planError = "Quickslot planning failed";
    render(<GuideQuickslots fb={builds.boss} data={data} />);
    expect(screen.getByRole("alert")).toHaveTextContent(source === "phase" ? "Class data unavailable" : "Quickslot planning failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(kb.rerun).toHaveBeenCalledOnce();
  });

  it("blocks retry for a stale failed plan", () => {
    kb.result = null; kb.planError = "Quickslot planning failed";
    render(<GuideQuickslots fb={builds.boss} data={data} disabled />);
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(kb.rerun).not.toHaveBeenCalled();
  });
});
