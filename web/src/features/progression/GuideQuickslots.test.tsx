import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import cmpFx from "@/fixtures/compare.json";
import gdFx from "@/fixtures/gamedata_sorcerer.json";
import kbFx from "@/fixtures/keybinds.json";
import type { ClassData } from "@/features/build/useClassData";
import { hashBuild } from "@/features/keybinds/activeBuild";
import { KEY_ROWS } from "@/features/keybinds/Hotbar";
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
    expect(screen.getByRole("heading", { name: "Quick Slots" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Macro" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: macro })).toBeInTheDocument();
    expect(screen.getAllByRole("list", { name: /loop entries$/ })).toHaveLength(1);
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
    expect(region).toHaveClass("compact-hotbar-grid");
    fireEvent.click(within(region).getByRole("button", { name: `Key 2: ${names.join(", then ")}` }));
    const skills = screen.getByRole("list", { name: "Key 2 skills" });
    for (const name of names) expect(within(skills).getByText(name)).toBeInTheDocument();
    expect(screen.getByText("Follow the selected priority.")).toBeInTheDocument();
    expect(container.querySelector('img[src="https://example.com/skill.png"]')).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("retains hotkey and delay controls for the selected plan", () => {
    render(<GuideQuickslots fb={builds.leveling} data={data} />);
    fireEvent.click(screen.getByText("Macro settings"));
    const delay = screen.getByRole("spinbutton", { name: "Delay between presses (ms)" });
    fireEvent.change(delay, { target: { value: "25" } });
    fireEvent.blur(delay);
    fireEvent.change(screen.getByRole("combobox", { name: "Hotkey" }), { target: { value: "F12" } });
    expect(kb.setDelayMs).toHaveBeenCalledWith(25);
    expect(kb.setHotkey).toHaveBeenCalledWith("leveling", "F12");
  });

  it("keeps delay editing mounted until a complete value is committed", () => {
    render(<GuideQuickslots fb={builds.leveling} data={data} />);
    fireEvent.click(screen.getByText("Macro settings"));
    const delay = screen.getByRole("spinbutton", { name: "Delay between presses (ms)" });
    delay.focus();
    fireEvent.change(delay, { target: { value: "2" } });
    fireEvent.change(delay, { target: { value: "25" } });
    expect(delay).toHaveFocus();
    expect(delay).toHaveValue(25);
    expect(kb.setDelayMs).not.toHaveBeenCalled();
    fireEvent.blur(delay);
    expect(kb.setDelayMs).toHaveBeenCalledWith(25);
  });

  it("shows one twelve-key strip with four stack cells and keeps extra engine keys separate", () => {
    kb.result = { ...result, plan: { ...result.plan, stacks: [
      ...result.plan.stacks,
      { key_label: "A", stack: [skillKeys[1]] },
    ] } };
    render(<GuideQuickslots fb={builds.leveling} data={data} />);
    const strip = screen.getByRole("region", { name: "Quickslot keys" });
    const keys = within(strip).getAllByRole("button", { name: /^Key / });
    expect(keys.map((key) => key.textContent)).toEqual(KEY_ROWS[0]);
    expect(strip.querySelectorAll("[data-row]")).toHaveLength(48);
    expect(within(strip).getAllByRole("group", { name: /^Quickslot group/ })).toHaveLength(3);
    expect(within(strip).getByRole("group", { name: "Quickslot rows" })).toHaveTextContent("3210");
    const extra = screen.getByRole("group", { name: "Other assigned keys" });
    fireEvent.click(within(extra).getByRole("button", { name: `Key A: ${names[1]}` }));
    expect(within(screen.getByRole("list", { name: "Key A skills" })).getByText(names[1])).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show letter keys/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/QuickUse/)).not.toBeInTheDocument();
  });

  it("keeps macro entry order, real key mappings, efficiency and separate hand presses visible", () => {
    kb.result = { ...result, plan: {
      ...result.plan,
      stacks: [
        { key_label: "1", stack: [skillKeys[0]] },
        { key_label: "2", stack: [skillKeys[0]] },
        { key_label: "=", stack: [skillKeys[1]] },
      ],
      macros: [
        ...result.plan.macros.filter((macro) => macro.name !== "Leveling loop"),
        { name: "Leveling loop", hotkey: "F11", entries: [
          { index: 1, key_label: "2", delay_ms: 15 },
          { index: 2, key_label: "1", delay_ms: 25 },
        ] },
      ],
      macro_dps: { "Leveling loop": 1000 },
      ideal_dps: { level_pull: 2000 },
      hybrid_dps: { "Leveling loop": 1500 },
      manual_every_s: { [skillKeys[1]]: 47 },
      macro_advice: { "Leveling loop": "Use a hybrid: hold the macro and press the charge skill by hand." },
    } };
    render(<GuideQuickslots fb={builds.leveling} data={data} />);
    const macro = screen.getByRole("region", { name: "Leveling loop" });
    const entries = within(macro).getByRole("list", { name: "Leveling loop entries" });
    const rows = within(entries).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("title", `1. press key 2 (${names[0]}), delay 15 ms`);
    expect(rows[1]).toHaveAttribute("title", `2. press key 1 (${names[0]}), delay 25 ms`);
    for (const row of rows) expect(within(row).getByText(names[0])).toBeInTheDocument();
    fireEvent.click(screen.getByText("Damage estimate"));
    expect(within(macro).getByText("~50% of ideal")).toBeInTheDocument();
    expect(within(macro).getByTestId("hybrid-line")).toHaveTextContent("75% of ideal");
    expect(within(macro).getByTestId("macro-advice")).toHaveTextContent("press the charge skill by hand");
    fireEvent.click(screen.getByText("Macro settings"));
    expect(screen.getByText(/only while its key is held/)).toBeInTheDocument();
    const manual = screen.getByRole("region", { name: "How to play" });
    expect(within(manual).getByText(names[1])).toBeInTheDocument();
    expect(within(manual).getByText("key =")).toBeInTheDocument();
    expect(within(manual).getByText("~every 47 s")).toBeInTheDocument();
    expect(macro).not.toContainElement(manual);
    expect(macro).not.toHaveClass("frame");
    for (const row of within(manual).getAllByRole("listitem")) expect(row).not.toHaveClass("frame");
  });

  it("marks only real filled manual and selected-macro cells with manual taking precedence", () => {
    kb.result = { ...result, plan: {
      ...result.plan,
      stacks: [
        { key_label: "1", stack: [skillKeys[0], skillKeys[1]] },
        { key_label: "2", stack: [skillKeys[0]] },
        { key_label: "3", stack: [skillKeys[1]] },
      ],
      macros: [
        { name: "Leveling loop", hotkey: "F11", entries: [{ index: 1, key_label: "1", delay_ms: 10 }] },
        { name: "Boss loop", hotkey: "F9", entries: [{ index: 1, key_label: "2", delay_ms: 10 }] },
      ],
      manual_every_s: { [skillKeys[1]]: 47 },
    } };
    render(<GuideQuickslots fb={builds.leveling} data={data} />);
    const strip = screen.getByRole("region", { name: "Quickslot keys" });
    expect(within(strip).getByRole("button", { name: /^Key 1:/ })).toHaveAttribute("data-mode", "manual");
    expect(within(strip).getByRole("button", { name: /^Key 2:/ })).toHaveAttribute("data-mode", "unused");
    expect(within(strip).getByRole("button", { name: /^Key 3:/ })).toHaveAttribute("data-mode", "manual");
    expect(screen.getByText("By hand")).toHaveClass("text-gold");
    expect(screen.getByText("In macro")).toHaveClass("text-cyan");
  });

  it("makes every stale control inert and disabled and blocks preference callbacks", () => {
    render(<GuideQuickslots fb={builds.leveling} data={data} disabled />);
    const section = screen.getByRole("region", { name: "Quickslots and macro" });
    expect(section).toHaveAttribute("inert");
    expect(section).toHaveAttribute("aria-disabled", "true");
    const delay = screen.getByRole("spinbutton", { hidden: true });
    const hotkey = screen.getByRole("combobox", { hidden: true });
    expect(delay).toBeDisabled();
    expect(hotkey).toBeDisabled();
    for (const button of within(section).getAllByRole("button")) expect(button).toBeDisabled();
    fireEvent.change(delay, { target: { value: "25" } });
    fireEvent.change(hotkey, { target: { value: "F12" } });
    fireEvent.click(within(section).getByRole("button", { name: `Key 2: ${names.join(", then ")}` }));
    expect(screen.queryByRole("region", { name: "Key 2 details" })).not.toBeInTheDocument();
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
    expect(screen.getByRole("region", { name: "AoE loop" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Boss loop" })).not.toBeInTheDocument();
  });
});
