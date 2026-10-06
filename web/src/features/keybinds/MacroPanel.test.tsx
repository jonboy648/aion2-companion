import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import gamedataFx from "@/fixtures/gamedata_sorcerer.json";
import keybindsFx from "@/fixtures/keybinds.json";
import type { GameData, KeybindPlan } from "@/lib/types";
import { MacroPanel } from "./MacroPanel";

afterEach(cleanup);

const gd = gamedataFx as unknown as GameData;
const plan: KeybindPlan = {
  ...(keybindsFx.plan as unknown as KeybindPlan),
  macros: [{
    name: "Leveling loop",
    hotkey: "F11",
    entries: [
      { index: 3, key_label: "2", delay_ms: 10 },
      { index: 8, key_label: "1", delay_ms: 25 },
      { index: 9, key_label: "2", delay_ms: 10 },
      { index: 13, key_label: "Q", delay_ms: 500 },
    ],
  }],
  stacks: [
    { key_label: "2", stack: ["flame-arrow", "hellfire", "element-enhancement"] },
    { key_label: "1", stack: ["flame-arrow"] },
  ],
  macro_dps: { "Leveling loop": 1000 },
  ideal_dps: { level_pull: 2000 },
  hybrid_dps: { "Leveling loop": 1500 },
  manual_every_s: { "steel-barrier": 47 },
  macro_advice: { "Leveling loop": "Hold the macro and press the charge skill by hand." },
};

const props = () => ({
  plan,
  gd,
  icons: { "flame-arrow": "/flame-arrow.png" },
  onHotkey: vi.fn(),
  delayMs: 10,
  onDelay: vi.fn(),
});

describe("compact MacroPanel", () => {
  it("keeps every actual press, engine index, key mapping, delay and fallback in order", () => {
    render(<MacroPanel {...props()} compact showManual={false} />);
    const macro = screen.getByRole("region", { name: "Leveling loop" });
    const entries = within(macro).getByRole("list", { name: "Leveling loop entries" });
    const rows = within(entries).getAllByRole("listitem");
    const primary = gd.skills["flame-arrow"].name;
    const fallbacks = [gd.skills.hellfire.name, gd.skills["element-enhancement"].name];

    expect(rows).toHaveLength(plan.macros[0].entries.length);
    expect(rows.map((row) => row.getAttribute("value"))).toEqual(["3", "8", "9", "13"]);
    expect(rows.map((row) => row.querySelector(".compact-macro-step-key")?.textContent)).toEqual(["Key 2", "Key 1", "Key 2", "Key Q"]);
    expect(rows.map((row) => row.querySelector(".compact-macro-step-delay")?.textContent)).toEqual(["Delay 10ms", "Delay 25ms", "Delay 10ms", "Delay 500ms"]);
    for (const position of [0, 2]) {
      expect(within(rows[position]).getByText(primary).tagName).toBe("STRONG");
      expect(within(rows[position]).getByText(`Then ${fallbacks.join(", then ")}`)).toBeInTheDocument();
      expect(rows[position]).toHaveAccessibleName(`Step ${plan.macros[0].entries[position].index}: press key 2 (${primary}, then ${fallbacks.join(", then ")}), delay 10 ms`);
      expect(rows[position].querySelector(".icon-frame")).toHaveStyle({ width: "36px", height: "36px" });
      expect(rows[position].querySelector("img")).toHaveAttribute("src", "/flame-arrow.png");
    }
    expect(within(rows[1]).queryByText(/^Then /)).not.toBeInTheDocument();
    expect(rows[3]).toHaveAccessibleName("Step 13: press key Q, delay 500 ms");
    expect(screen.queryByRole("region", { name: "Press by hand" })).not.toBeInTheDocument();
  });

  it("uses raw skill keys while game data is unavailable without losing stack order", () => {
    render(<MacroPanel {...props()} gd={null} compact showManual={false} />);
    const entries = screen.getByRole("list", { name: "Leveling loop entries" });
    const row = within(entries).getAllByRole("listitem")[0];
    expect(within(row).getByText("flame-arrow")).toBeInTheDocument();
    expect(within(row).getByText("Then hellfire, then element-enhancement")).toBeInTheDocument();
    expect(row).toHaveAccessibleName("Step 3: press key 2 (flame-arrow, then hellfire, then element-enhancement), delay 10 ms");
  });

  it.each([
    ["Boss loop", "boss", "F9"],
    ["AoE loop", "aoe", "F10"],
    ["Leveling loop", "leveling", "F11"],
  ] as const)("keeps %s settings after the recipe and preserves control callbacks", (name, which, hotkey) => {
    const panelProps = props();
    const macroPlan = { ...plan, macros: [{ ...plan.macros[0], name, hotkey }] };
    render(<MacroPanel {...panelProps} plan={macroPlan} compact showManual={false} />);
    const entries = screen.getByRole("list", { name: `${name} entries` });
    const summary = screen.getByText("Macro settings");
    const settings = summary.closest("details")!;
    expect(settings).not.toHaveAttribute("open");
    expect(entries.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(settings).getByLabelText("Delay between presses (ms)")).not.toBeVisible();
    fireEvent.click(summary);
    expect(settings).toHaveAttribute("open");
    const delay = within(settings).getByRole("spinbutton", { name: "Delay between presses (ms)" });
    expect(delay).toHaveAttribute("min", "0");
    expect(delay).toHaveAttribute("max", "500");
    expect(delay).toHaveAttribute("step", "5");
    expect(delay).toHaveValue(10);
    fireEvent.change(delay, { target: { value: "25" } });
    fireEvent.blur(delay);
    const selector = within(settings).getByRole("combobox", { name: "Hotkey" });
    expect(selector).toHaveValue(hotkey);
    fireEvent.change(selector, { target: { value: "F12" } });
    expect(panelProps.onDelay).toHaveBeenCalledExactlyOnceWith(25);
    expect(panelProps.onHotkey).toHaveBeenCalledExactlyOnceWith(which, "F12");
    fireEvent.click(summary);
    expect(settings).not.toHaveAttribute("open");
    expect(entries).toBeVisible();
  });

  it("preserves a custom hotkey choice and the badge for an unknown macro", () => {
    const { rerender } = render(<MacroPanel {...props()} plan={{ ...plan, macros: [{ ...plan.macros[0], hotkey: "Mouse4" }] }} compact showManual={false} />);
    fireEvent.click(screen.getByText("Macro settings"));
    expect(screen.getByRole("combobox", { name: "Hotkey" })).toHaveValue("Mouse4");
    expect(screen.getByRole("option", { name: "Mouse4" })).toBeInTheDocument();
    rerender(<MacroPanel {...props()} plan={{ ...plan, macros: [{ name: "Custom loop", hotkey: "Mouse4", entries: [] }] }} compact showManual={false} />);
    fireEvent.click(screen.getByText("Macro settings"));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Mouse4")).toBeVisible();
    expect(screen.getByText("No entries: nothing in this rotation can run from a macro.")).toBeVisible();
  });

  it("collapses damage estimates while retaining full DPS, hybrid efficiency and advice", () => {
    render(<MacroPanel {...props()} compact showManual={false} />);
    const summary = screen.getByText("Damage estimate");
    const estimates = summary.closest("details")!;
    expect(estimates).not.toHaveAttribute("open");
    expect(within(estimates).getByText("~1,000")).not.toBeVisible();
    expect(within(estimates).getByTestId("macro-advice")).not.toBeVisible();
    fireEvent.click(summary);
    expect(estimates).toHaveAttribute("open");
    expect(within(estimates).getByText("~1,000")).toBeVisible();
    expect(within(estimates).getByText("~2,000")).toBeVisible();
    expect(within(estimates).getByText("~50% of ideal")).toBeVisible();
    expect(within(estimates).getByRole("img", { name: "Macro reaches about 50 percent of ideal damage" })).toBeVisible();
    expect(within(estimates).getByTestId("hybrid-line")).toHaveTextContent("With hand presses: ~1,500 DPS, about 75% of ideal.");
    expect(within(estimates).getByTestId("macro-advice")).toHaveTextContent(plan.macro_advice["Leveling loop"]);
    fireEvent.click(summary);
    expect(within(estimates).getByTestId("hybrid-line")).not.toBeVisible();
    expect(screen.getByRole("list", { name: "Leveling loop entries" })).toBeVisible();
  });

  it("retains the unavailable-estimate message behind the same disclosure", () => {
    render(<MacroPanel {...props()} plan={{ ...plan, macro_dps: {}, ideal_dps: {}, hybrid_dps: {} }} compact showManual={false} />);
    expect(screen.getByText("No DPS estimate for this macro.")).not.toBeVisible();
    fireEvent.click(screen.getByText("Damage estimate"));
    expect(screen.getByText("No DPS estimate for this macro.")).toBeVisible();
    expect(screen.getByTestId("macro-advice")).toBeVisible();
  });

  it("uses readable four-column rows while inheriting the parent panel surface and header", () => {
    const { container } = render(<MacroPanel {...props()} compact showManual={false} />);
    const stylesheet = document.createElement("style");
    stylesheet.textContent = readFileSync("src/features/keybinds/compact-macro.css", "utf8");
    document.head.append(stylesheet);
    try {
      const row = screen.getByRole("list", { name: "Leveling loop entries" }).firstElementChild!;
      expect(getComputedStyle(row).gridTemplateColumns).toBe("16px 36px minmax(0, 1fr) 68px");
      expect(getComputedStyle(row).minHeight).toBe("64px");
      expect(getComputedStyle(row.querySelector("strong")!).fontWeight).toBe("700");
      expect(getComputedStyle(row.querySelector("strong")!).overflowWrap).toBe("anywhere");
      for (const selector of [".compact-macro-step-key", ".compact-macro-step-fallbacks", ".compact-macro-step-delay"]) {
        expect(getComputedStyle(row.querySelector(selector)!).fontSize).toBe("14px");
      }
      expect(getComputedStyle(row.querySelector(".compact-macro-step-delay")!).textAlign).toBe("right");
      expect(getComputedStyle(container.firstElementChild!).backgroundColor).toBe("rgba(0, 0, 0, 0)");
      expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    } finally {
      stylesheet.remove();
    }
  });
});

describe("default MacroPanel", () => {
  it("keeps controls, full estimates and hand presses visible by default", () => {
    const panelProps = props();
    const { rerender, asFragment } = render(<MacroPanel {...panelProps} />);
    const defaultView = asFragment();
    expect(screen.getByRole("region", { name: "Leveling loop" })).toHaveClass("frame", "p-3.5");
    expect(screen.getByRole("heading", { name: "Leveling loop" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Delay between presses (ms)" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Hotkey" })).toBeVisible();
    expect(screen.getByText("~50% of ideal")).toBeVisible();
    expect(screen.getByTestId("hybrid-line")).toHaveTextContent("With the hand presses below:");
    expect(screen.getByTestId("macro-advice")).toBeVisible();
    expect(screen.getByRole("region", { name: "Press by hand" })).toBeVisible();
    expect(screen.queryByText("Macro settings")).not.toBeInTheDocument();
    expect(screen.queryByText("Damage estimate")).not.toBeInTheDocument();
    rerender(<MacroPanel {...panelProps} compact={false} showManual />);
    expect(asFragment()).toEqual(defaultView);
    rerender(<MacroPanel {...panelProps} showManual={false} />);
    expect(screen.queryByRole("region", { name: "Press by hand" })).not.toBeInTheDocument();
  });

  it("defaults showManual to true in compact mode as well", () => {
    render(<MacroPanel {...props()} compact />);
    expect(screen.getByRole("region", { name: "Press by hand" })).toBeVisible();
  });
});
