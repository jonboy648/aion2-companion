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
const skillKeys = Object.keys(data.gd!.skills).slice(0, 2);
const names = skillKeys.map((key) => data.gd!.skills[key].name);
const result: KeybindsResult = {
  ...kbFx as unknown as KeybindsResult,
  plan: {
    ...kbFx.plan as unknown as KeybindsResult["plan"],
    stacks: [{ key_label: "1", stack: [skillKeys[0]] }, { key_label: "2", stack: skillKeys }],
    macros: [
      { name: "Boss loop", hotkey: "F9", entries: [{ index: 1, key_label: "1", delay_ms: 10 }] },
      { name: "AoE loop", hotkey: "F10", entries: [{ index: 1, key_label: "1", delay_ms: 10 }] },
      { name: "Leveling loop", hotkey: "F11", entries: [{ index: 1, key_label: "1", delay_ms: 10 }] },
    ],
    slot_notes: { "2": "Follow the selected priority." },
    manual_every_s: {},
  },
};
let kb: ReturnType<typeof useKeybindPlan>;

beforeEach(() => {
  mockPlan.mockReset();
  kb = {
    gd: data.gd,
    icons: {},
    phase: { status: "ready" },
    result,
    planError: null,
    pins: {},
    pin: vi.fn(),
    unpin: vi.fn(),
    clearPins: vi.fn(),
    delayMs: 10,
    setDelayMs: vi.fn(),
    hotkeys: { boss: "F9", aoe: "F10", leveling: "F11" },
    setHotkey: vi.fn(),
    rerun: vi.fn(),
  };
  mockPlan.mockImplementation(() => kb);
});

describe("GuideQuickslots", () => {
  it.each([
    ["boss", "boss_180", "Boss loop"],
    ["aoe", "aoe_pack", "AoE loop"],
    ["leveling", "level_pull", "Leveling loop"],
  ] as const)("uses the exact %s build and displays only its macro", (playstyle, scenario, macro) => {
    const fb = { ...builds[playstyle], build: { ...builds[playstyle].build, skill_points: 123, stigma_points: 45 } };
    const original = structuredClone(fb.build);
    render(<GuideQuickslots fb={fb} data={data} />);
    const build = { ...fb.build, skill_points: 0, stigma_points: 0 };
    expect(mockPlan).toHaveBeenCalledWith(build, {
      buildHash: hashBuild(build), playstyle, scenario, priority: fb.priority,
    });
    expect(mockPlan.mock.calls[0][1]?.priority).toBe(fb.priority);
    expect(fb.build).toEqual(original);
    expect(screen.getByRole("heading", { name: "Quickslots" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Macro" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: macro })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /loop$/ })).toHaveLength(1);
    expect(screen.queryByText(/Setup sheet/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download/ })).not.toBeInTheDocument();
  });

  it("keeps hook inputs stable while the same plan becomes stale", () => {
    const fb = builds.leveling;
    const { rerender } = render(<GuideQuickslots fb={fb} data={data} />);
    const [build, planned] = mockPlan.mock.calls[0];
    rerender(<GuideQuickslots fb={fb} data={{ ...data }} disabled />);
    expect(mockPlan.mock.calls.at(-1)?.[0]).toBe(build);
    expect(mockPlan.mock.calls.at(-1)?.[1]).toBe(planned);
  });

  it("skips the hook for unsupported burst and switches safely to a supported plan", () => {
    const { rerender } = render(<GuideQuickslots fb={builds.burst} data={data} />);
    expect(mockPlan).not.toHaveBeenCalled();
    expect(screen.getByText("Macros are not modeled for this playstyle yet.")).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    rerender(<GuideQuickslots fb={builds.leveling} data={data} />);
    expect(mockPlan).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("region", { name: "Leveling loop" })).toBeInTheDocument();
    rerender(<GuideQuickslots fb={builds.burst} data={data} />);
    expect(mockPlan).toHaveBeenCalledTimes(1);
  });

  it("uses fallback class data and icons and lets selected keys show skill names", () => {
    kb.gd = null;
    const fallback = { ...data, icons: { [skillKeys[1]]: "https://example.com/skill.png" } };
    const { container } = render(<GuideQuickslots fb={builds.leveling} data={fallback} />);
    const region = screen.getByRole("region", { name: "Quickslot keys" });
    expect(region).toHaveClass("overflow-x-auto");
    fireEvent.click(within(region).getByRole("button", { name: `Key 2: ${names.join(", then ")}` }));
    const skills = screen.getByRole("list", { name: "Key 2 skills" });
    for (const name of names) expect(within(skills).getByText(name)).toBeInTheDocument();
    expect(screen.getByText("Follow the selected priority.")).toBeInTheDocument();
    expect(container.querySelector('img[src="https://example.com/skill.png"]')).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("retains hotkey and delay controls for the selected plan", () => {
    render(<GuideQuickslots fb={builds.leveling} data={data} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Delay between presses (ms)" }), { target: { value: "25" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Hotkey" }), { target: { value: "F12" } });
    expect(kb.setDelayMs).toHaveBeenCalledWith(25);
    expect(kb.setHotkey).toHaveBeenCalledWith("leveling", "F12");
  });

  it("makes every stale control inert and disabled and blocks preference callbacks", () => {
    render(<GuideQuickslots fb={builds.leveling} data={data} disabled />);
    const section = screen.getByRole("region", { name: "Quickslots and macro" });
    expect(section).toHaveAttribute("inert");
    expect(section).toHaveAttribute("aria-disabled", "true");
    const delay = screen.getByRole("spinbutton");
    const hotkey = screen.getByRole("combobox");
    expect(delay).toBeDisabled();
    expect(hotkey).toBeDisabled();
    for (const button of within(section).getAllByRole("button")) expect(button).toBeDisabled();
    fireEvent.change(delay, { target: { value: "25" } });
    fireEvent.change(hotkey, { target: { value: "F12" } });
    expect(kb.setDelayMs).not.toHaveBeenCalled();
    expect(kb.setHotkey).not.toHaveBeenCalled();
  });

  it.each(["ready", "loading"] as const)("shows real progress with no placeholder keys when phase is %s", (status) => {
    kb.result = null;
    kb.phase = status === "loading" ? { status, message: "Loading class data" } : { status };
    render(<GuideQuickslots fb={builds.boss} data={data} />);
    expect(screen.getByRole("status")).toHaveTextContent("Building quickslots");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    if (status === "loading") expect(screen.getByRole("status")).toHaveTextContent("Loading class data");
    expect(screen.queryByRole("button", { name: /^Key / })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it.each(["phase", "plan"] as const)("shows %s errors and retries through the hook", (source) => {
    kb.result = null;
    if (source === "phase") kb.phase = { status: "error", message: "Class data unavailable" };
    else kb.planError = "Quickslot planning failed";
    render(<GuideQuickslots fb={builds.boss} data={data} />);
    expect(screen.getByRole("alert")).toHaveTextContent(source === "phase" ? "Class data unavailable" : "Quickslot planning failed");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(kb.rerun).toHaveBeenCalledOnce();
  });

  it("disables retry for a stale failed plan", () => {
    kb.result = null;
    kb.planError = "Quickslot planning failed";
    render(<GuideQuickslots fb={builds.boss} data={data} disabled />);
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(kb.rerun).not.toHaveBeenCalled();
  });

  it("prepares new matching metadata when the selected plan changes", () => {
    const { rerender } = render(<GuideQuickslots fb={builds.boss} data={data} />);
    rerender(<GuideQuickslots fb={builds.aoe} data={data} />);
    const [build, planned] = mockPlan.mock.calls.at(-1)!;
    expect(planned?.playstyle).toBe("aoe");
    expect(planned?.scenario).toBe("aoe_pack");
    expect(planned?.priority).toBe(builds.aoe.priority);
    expect(planned?.buildHash).toBe(hashBuild(build));
  });
});
