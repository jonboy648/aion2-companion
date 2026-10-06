import { readFileSync } from "node:fs";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import keybindsFx from "@/fixtures/keybinds.json";
import gamedataFx from "@/fixtures/gamedata_sorcerer.json";
import type { GameData, KeybindPlan } from "@/lib/types";
import { Hotbar, KEY_ROWS, SlotEditor } from "./Hotbar";
import { MacroPanel, macroEfficiency } from "./MacroPanel";

describe("vertical quickslots", () => {
  it("renders four stable cells top-to-bottom with priority zero at the bottom", () => {
    const onSelect = vi.fn();
    render(<Hotbar gd={null} icons={{ first: "/first.png" }} stacks={[{ key_label: "1", stack: ["first", "second", "third", "fourth"] }]} pins={{ "1": "first" }} selected="1" onSelect={onSelect} />);
    const key = screen.getByRole("button", { name: "Key 1: first, then second, then third, then fourth" });
    const cells = [...key.querySelectorAll<HTMLElement>("[data-priority]")];
    expect(cells.map((cell) => cell.dataset.priority)).toEqual(["3", "2", "1", "0"]);
    expect(cells.map((cell) => cell.dataset.skill)).toEqual(["fourth", "third", "second", "first"]);
    expect(cells[0].parentElement).toHaveStyle({ gridTemplateRows: "repeat(4, 32px)" });
    expect(key).toHaveClass("h-[164px]", "w-[46px]");
    expect(key).toHaveAttribute("aria-pressed", "true");
    expect(key.querySelector("img")).toHaveAttribute("src", "/first.png");
    fireEvent.click(key);
    expect(onSelect).toHaveBeenCalledWith("1");
  });

  it("bottom-aligns partial stacks and preserves four empty cells on unused keys", () => {
    render(<Hotbar gd={null} icons={{}} stacks={[{ key_label: "1", stack: ["first", "second"] }]} pins={{ "2": "pinned" }} selected="2" onSelect={vi.fn()} />);
    const skills = (label: string) => [...screen.getByRole("button", { name: new RegExp(`^Key ${label}:`) }).querySelectorAll<HTMLElement>("[data-priority]")].map((cell) => cell.dataset.skill);
    expect(skills("1")).toEqual(["", "", "second", "first"]);
    expect(skills("2")).toEqual(["", "", "", "pinned"]);
    expect(skills("3")).toEqual(["", "", "", ""]);
  });

  it("preserves the default Keybinds hotbar when compact is omitted or false", () => {
    const props = { gd: null, icons: {}, stacks: [{ key_label: "1", stack: ["first"] }], pins: {}, selected: "1", onSelect: vi.fn() };
    const { rerender, asFragment } = render(<Hotbar {...props} />);
    const defaultView = asFragment();
    expect(screen.getByRole("button", { name: "Key 1: first" })).toHaveClass("h-[164px]", "w-[46px]");
    expect(screen.getByRole("button", { name: /Show letter keys/ })).toBeInTheDocument();
    rerender(<Hotbar {...props} compact={false} />);
    expect(asFragment()).toEqual(defaultView);
    rerender(<Hotbar {...props} manualSkills={["first"]} macroKeys={["1"]} />);
    expect(asFragment()).toEqual(defaultView);
    rerender(<Hotbar {...props} ranks={{ first: 12 }} />);
    expect(asFragment()).toEqual(defaultView);
  });

  it("keeps the keyboard in its own horizontal scroll surface and reveals selectable letter keys", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<Hotbar gd={null} icons={{}} stacks={[]} pins={{}} selected="1" onSelect={onSelect} />);
    const region = screen.getByRole("region", { name: "Quickslot keys" });
    expect(region).toHaveClass("max-w-full", "overflow-x-auto", "overscroll-x-contain");
    expect(region.firstElementChild).toHaveClass("flex", "w-max");
    expect(within(region).getAllByRole("button")).toHaveLength(KEY_ROWS[0].length);
    fireEvent.click(screen.getByRole("button", { name: /Show letter keys/ }));
    expect(within(region).getAllByRole("button")).toHaveLength(KEY_ROWS.flat().length);
    fireEvent.click(screen.getByRole("button", { name: "Key Q: empty" }));
    expect(onSelect).toHaveBeenCalledWith("Q");
    fireEvent.click(screen.getByRole("button", { name: "Hide letter keys" }));
    expect(screen.queryByRole("button", { name: /^Key Q:/ })).not.toBeInTheDocument();
    rerender(<Hotbar gd={null} icons={{}} stacks={[]} pins={{ Q: "pinned" }} selected="Q" onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: "Key Q: pinned" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Hide letter keys" })).not.toBeInTheDocument();
  });

  it("limits pin choices to unlocked skills and the supplied equipped stigmas", () => {
    const fixture = gamedataFx as unknown as GameData;
    const gd: GameData = { ...fixture, skills: {
      ...fixture.skills,
      "flame-arrow": { ...fixture.skills["flame-arrow"], unlock_level: 1 },
      hellfire: { ...fixture.skills.hellfire, unlock_level: 45 },
      "element-enhancement": { ...fixture.skills["element-enhancement"], unlock_level: 1 },
      "steel-barrier": { ...fixture.skills["steel-barrier"], unlock_level: 1 },
    } };
    const onPin = vi.fn();
    render(<SlotEditor gd={gd} icons={{}} label="1" stack={[]} pinnedSkill={undefined} pins={{}} level={10} stigmas={["element-enhancement"]} onPin={onPin} onUnpin={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Hellfire$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Steel Barrier$/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Element Enhancement$/ }));
    expect(onPin).toHaveBeenCalledWith("element-enhancement");
  });

  it("defaults pin choices to Global and updates them when the region changes", () => {
    const fixture = gamedataFx as unknown as GameData;
    const gd: GameData = { ...fixture, skills: {
      "flame-arrow": { ...fixture.skills["flame-arrow"], regions: ["global"], unlock_level: 1 },
      hellfire: { ...fixture.skills.hellfire, regions: ["korea"], unlock_level: 1 },
    } };
    const props = { gd, icons: {}, label: "1", stack: [], pinnedSkill: undefined, pins: {}, level: 45, onPin: vi.fn(), onUnpin: vi.fn() };
    const { rerender } = render(<SlotEditor {...props} />);
    expect(screen.getByRole("button", { name: /Flame Arrow$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hellfire$/ })).not.toBeInTheDocument();
    rerender(<SlotEditor {...props} region="korea" />);
    expect(screen.queryByRole("button", { name: /Flame Arrow$/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Hellfire$/ }));
    expect(props.onPin).toHaveBeenCalledWith("hellfire");
  });
});

describe("compact gaming.tools quickslots", () => {
  let stylesheet: HTMLStyleElement;
  beforeAll(() => {
    stylesheet = document.createElement("style");
    stylesheet.textContent = readFileSync("src/features/keybinds/compact-hotbar.css", "utf8");
    document.head.append(stylesheet);
  });
  afterAll(() => stylesheet.remove());

  it("groups four columns three times with two 8px spacers, bottom key labels and one right row-label column", () => {
    render(<Hotbar compact gd={null} icons={{}} stacks={[]} pins={{}} selected="1" onSelect={vi.fn()} />);
    const grid = screen.getByRole("region", { name: "Quickslot keys" });
    const groups = within(grid).getAllByRole("group", { name: /^Quickslot group/ });
    expect(groups).toHaveLength(3);
    for (const [index, group] of groups.entries()) {
      const labels = KEY_ROWS[0].slice(index * 4, index * 4 + 4);
      const cells = [...group.querySelectorAll<HTMLElement>(".compact-hotbar-cell")];
      const keys = within(group).getAllByRole("button");
      expect(cells).toHaveLength(16);
      expect(cells.map((cell) => cell.dataset.row)).toEqual([3, 2, 1, 0].flatMap((row) => labels.map(() => String(row))));
      expect(cells.map((cell) => cell.dataset.key)).toEqual([3, 2, 1, 0].flatMap(() => labels));
      expect(keys.map((key) => key.textContent)).toEqual(labels);
      expect([...group.children].slice(-4)).toEqual(keys);
      expect(getComputedStyle(group).gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
      expect(getComputedStyle(group).gap).toBe("4px");
    }
    const spacers = [...grid.querySelectorAll<HTMLElement>(".compact-hotbar-spacer")];
    expect(spacers).toHaveLength(2);
    for (const spacer of spacers) {
      expect(spacer).toHaveAttribute("aria-hidden", "true");
      expect(getComputedStyle(spacer).width).toBe("8px");
    }
    const rowLabels = within(grid).getByRole("group", { name: "Quickslot rows" });
    expect([...rowLabels.children].map((row) => row.textContent)).toEqual(["3", "2", "1", "0"]);
    expect([...grid.children]).toEqual([groups[0], spacers[0], groups[1], spacers[1], groups[2], rowLabels]);
    expect(screen.queryByRole("button", { name: /Show letter keys/ })).not.toBeInTheDocument();
    expect(grid.querySelector(".icon-frame")).not.toBeInTheDocument();
  });

  it("fits responsive square cells while capping the desktop grid at twelve 41px cells", () => {
    render(<Hotbar compact gd={null} icons={{}} stacks={[]} pins={{}} selected="1" onSelect={vi.fn()} />);
    const grid = screen.getByRole("region", { name: "Quickslot keys" });
    const style = getComputedStyle(grid);
    expect(style.width).toBe("100%");
    expect(style.minWidth).toBe("0px");
    expect(style.maxWidth).toBe("560px");
    expect(style.gridTemplateColumns).toBe("minmax(0, 1fr) 8px minmax(0, 1fr) 8px minmax(0, 1fr) 16px");
    // Remove the two spacers, row labels and three groups' internal column gaps.
    expect((parseInt(style.maxWidth) - 2 * 8 - 16 - 3 * 3 * 4) / 12).toBe(41);
    const cell = grid.querySelector<HTMLElement>(".compact-hotbar-cell")!;
    expect(getComputedStyle(cell).width).toBe("100%");
    expect(getComputedStyle(cell).minWidth).toBe("0px");
    expect(getComputedStyle(cell).aspectRatio).toBe("1 / 1");
    expect(grid).not.toHaveClass("overflow-x-auto", "w-max");
  });

  it("puts effective skill ranks at the bottom right and selects filled cells by their real key", () => {
    const gd = gamedataFx as unknown as GameData;
    const skills = ["flame-arrow", "hellfire", "steel-barrier", "element-enhancement"];
    const ranks = { "flame-arrow": 11, hellfire: 14, "steel-barrier": 9, "element-enhancement": 6 };
    const onSelect = vi.fn();
    render(<Hotbar compact gd={gd} icons={{ "flame-arrow": "/flame-arrow.png" }} stacks={[{ key_label: "=", stack: skills }]} pins={{}} ranks={ranks} selected="=" onSelect={onSelect} />);
    const cells = [...screen.getByRole("region", { name: "Quickslot keys" }).querySelectorAll<HTMLElement>('button.compact-hotbar-cell[data-key="="]')];
    expect(cells.map((cell) => cell.dataset.row)).toEqual(["3", "2", "1", "0"]);
    expect(cells.map((cell) => cell.dataset.skill)).toEqual([...skills].reverse());
    expect(cells.map((cell) => cell.querySelector(".compact-hotbar-rank")?.textContent)).toEqual(["6", "9", "14", "11"]);
    expect(cells[0].querySelector("[data-priority]")).not.toBeInTheDocument();
    for (const [row, skill] of skills.entries()) {
      const description = `${gd.skills[skill].name}, rank ${ranks[skill as keyof typeof ranks]}, key =, row ${row}`;
      const cell = screen.getByRole("button", { name: description });
      expect(cell).toHaveAttribute("title", description);
      expect(cell).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(cell);
    }
    expect(onSelect.mock.calls).toEqual([["="], ["="], ["="], ["="]]);
    const bottom = screen.getByRole("button", { name: `${gd.skills[skills[0]].name}, rank 11, key =, row 0` });
    expect(bottom.querySelector("img")?.parentElement).toBe(bottom);
    expect(bottom.querySelector("img")).toHaveAttribute("src", "/flame-arrow.png");
    expect(getComputedStyle(bottom.querySelector("img")!).width).toBe("100%");
    expect(getComputedStyle(bottom.querySelector("img")!).height).toBe("100%");
    const rankStyle = getComputedStyle(bottom.querySelector(".compact-hotbar-rank")!);
    expect(rankStyle.position).toBe("absolute");
    expect(rankStyle.right).toBe("1px");
    expect(rankStyle.bottom).toBe("0px");
    expect(rankStyle.fontSize).toBe("14px");
    expect(rankStyle.fontWeight).toBe("700");
    expect(rankStyle.color).toBe("rgb(255, 255, 255)");
    expect(getComputedStyle(bottom).containerType).toBe("inline-size");
    expect(getComputedStyle(bottom).containerName).toBe("compact-quickslot");
  });

  it("bottom-aligns partial and pinned stacks and renders empty cells as noninteractive divs", () => {
    const onSelect = vi.fn();
    render(<Hotbar compact gd={null} icons={{}} stacks={[{ key_label: "1", stack: ["first", "second"] }]} pins={{ "2": "pinned" }} ranks={{ first: 7, second: 8, pinned: 12 }} selected="3" onSelect={onSelect} />);
    const grid = screen.getByRole("region", { name: "Quickslot keys" });
    const skills = (key: string) => [...grid.querySelectorAll<HTMLElement>(`.compact-hotbar-cell[data-key="${key}"]`)].map((cell) => cell.dataset.skill);
    expect(skills("1")).toEqual(["", "", "second", "first"]);
    expect(skills("2")).toEqual(["", "", "", "pinned"]);
    expect(skills("3")).toEqual(["", "", "", ""]);
    const empty = [...grid.querySelectorAll(".compact-hotbar-cell-empty")];
    expect(empty).toHaveLength(45);
    for (const cell of empty) {
      expect(cell.tagName).toBe("DIV");
      expect(cell).toHaveAttribute("aria-hidden", "true");
      expect(cell).not.toHaveAttribute("tabindex");
      expect(cell).toBeEmptyDOMElement();
    }
    expect(within(grid).getAllByRole("button")).toHaveLength(15);
    const unusedKey = within(grid).getByRole("button", { name: "Key 3: empty" });
    expect(unusedKey).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(unusedKey);
    expect(onSelect).toHaveBeenCalledWith("3");
    expect(within(grid).getByRole("button", { name: "Key 2: pinned" })).toHaveAttribute("title", "Key 2: pinned (pinned)");
  });

  it("colors bottom labels solid amber for manual and cyan for macro with manual taking precedence", () => {
    const onSelect = vi.fn();
    const props = {
      compact: true, gd: null, icons: {},
      stacks: [{ key_label: "1", stack: ["manual"] }, { key_label: "2", stack: ["macro"] }, { key_label: "3", stack: ["macro", "manual"] }, { key_label: "5", stack: ["other"] }],
      pins: {}, selected: "2", onSelect, manualSkills: ["manual"], macroKeys: ["1", "2", "3", "4"],
    };
    const { rerender } = render(<Hotbar {...props} />);
    // jsdom cannot resolve inherited custom properties, so check the parsed color declarations.
    const labelBackground = (mode: string) => {
      const rule = [...stylesheet.sheet!.cssRules].find((rule) => rule instanceof CSSStyleRule && rule.selectorText === `.compact-hotbar-key-label[data-mode="${mode}"]`) as CSSStyleRule | undefined;
      return rule?.style.getPropertyValue("background");
    };
    expect(labelBackground("manual")).toBe("var(--gold, #fbbf24)");
    expect(labelBackground("macro")).toBe("var(--cyan, #38bdf8)");
    for (const label of ["1", "3"]) {
      const button = screen.getByRole("button", { name: new RegExp(`^Key ${label}:`) });
      expect(button).toHaveAttribute("data-mode", "manual");
    }
    const macro = screen.getByRole("button", { name: "Key 2: macro" });
    expect(macro).toHaveAttribute("data-mode", "macro");
    expect(macro).toHaveAttribute("aria-pressed", "true");
    for (const label of ["4", "5", "6"]) {
      const button = screen.getByRole("button", { name: new RegExp(`^Key ${label}:`) });
      expect(button).toHaveAttribute("data-mode", "unused");
      expect(getComputedStyle(button).backgroundColor).toBe("rgb(48, 54, 61)");
    }
    fireEvent.click(screen.getByRole("button", { name: "Key 3: macro, then manual" }));
    expect(onSelect).toHaveBeenCalledWith("3");
    rerender(<Hotbar {...props} selected="3" />);
    expect(screen.getByRole("button", { name: "Key 3: macro, then manual" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Key 2: macro" })).toHaveAttribute("aria-pressed", "false");
  });

  it("uses an unframed fallback for missing or failed icons without inventing a rank", () => {
    const props = { compact: true, gd: null, stacks: [{ key_label: "1", stack: ["first", "second"] }], pins: {}, selected: "1", onSelect: vi.fn() };
    const { rerender } = render(<Hotbar {...props} icons={{ first: "/failed.png", second: null }} />);
    const first = screen.getByRole("button", { name: "first, rank unknown, key 1, row 0" });
    const second = screen.getByRole("button", { name: "second, rank unknown, key 1, row 1" });
    expect(second.querySelector("svg.compact-hotbar-icon-fallback")).toBeInTheDocument();
    expect(first.querySelector(".compact-hotbar-rank")).not.toBeInTheDocument();
    expect(second.querySelector(".compact-hotbar-rank")).not.toBeInTheDocument();
    fireEvent.error(first.querySelector("img")!);
    expect(first.querySelector("img")).not.toBeInTheDocument();
    expect(first.querySelector("svg.compact-hotbar-icon-fallback")).toBeInTheDocument();
    rerender(<Hotbar {...props} icons={{ first: "/recovered.png" }} ranks={{ first: 0 }} />);
    const recovered = screen.getByRole("button", { name: "first, rank 0, key 1, row 0" });
    expect(recovered.querySelector("img")).toHaveAttribute("src", "/recovered.png");
    expect(recovered.querySelector(".compact-hotbar-rank")).toHaveTextContent("0");
    expect(recovered.querySelector(".icon-frame")).not.toBeInTheDocument();
  });

  it("keeps arbitrary engine key labels accurate and additional keys separately selectable", () => {
    const onSelect = vi.fn();
    render(<Hotbar compact gd={null} icons={{}} stacks={[{ key_label: "=", stack: ["last"] }, { key_label: "A", stack: ["letter"] }]} pins={{ Q: "pinned" }} selected="A" onSelect={onSelect} />);
    const grid = screen.getByRole("region", { name: "Quickslot keys" });
    expect([...grid.querySelectorAll(".compact-hotbar-key-label")].map((label) => label.textContent)).toEqual(KEY_ROWS[0]);
    fireEvent.click(within(grid).getByRole("button", { name: "Key =: last" }));
    expect(onSelect).toHaveBeenLastCalledWith("=");
    const extra = screen.getByRole("group", { name: "Other assigned keys" });
    expect(within(extra).getByRole("button", { name: "Key A: letter" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(extra).getByRole("button", { name: "Key Q: pinned" }));
    expect(onSelect).toHaveBeenLastCalledWith("Q");
    expect(screen.queryByText(/QuickUse/)).not.toBeInTheDocument();
  });
});

describe("Leveling loop metadata", () => {
  const macro = { name: "Leveling loop", hotkey: "F11", entries: [{ index: 1, key_label: "1", delay_ms: 10 }] };
  const plan: KeybindPlan = {
    ...(keybindsFx.plan as unknown as KeybindPlan),
    queue_status: undefined,
    macros: [macro], stacks: [{ key_label: "1", stack: ["first"] }],
    macro_dps: { "Leveling loop": 1000 }, ideal_dps: { level_pull: 2000, boss_180: 10000 },
    hybrid_dps: { "Leveling loop": 1500 }, manual_every_s: {}, macro_advice: {},
  };

  it("matches the leveling ideal and sends the leveling hotkey callback", () => {
    expect(macroEfficiency(plan, macro)).toEqual({ macro: 1000, ideal: 2000, pct: 50 });
    const onHotkey = vi.fn();
    render(<MacroPanel plan={plan} gd={null} icons={{}} onHotkey={onHotkey} delayMs={10} onDelay={vi.fn()} />);
    const region = screen.getByRole("region", { name: "Leveling loop" });
    expect(within(region).getByText("Leveling pull")).toBeInTheDocument();
    expect(within(region).getByText("~2,000")).toBeInTheDocument();
    expect(within(region).getByText("~50% of ideal")).toBeInTheDocument();
    expect(within(region).getByText("75%")).toBeInTheDocument();
    expect(screen.queryByText(/Boss/)).not.toBeInTheDocument();
    fireEvent.change(within(region).getByRole("combobox"), { target: { value: "F12" } });
    expect(onHotkey).toHaveBeenCalledWith("leveling", "F12");
  });

  it("preserves the default Keybinds macro layout when compact is omitted or false", () => {
    const props = { plan, gd: null, icons: {}, onHotkey: vi.fn(), delayMs: 10, onDelay: vi.fn() };
    const { rerender, asFragment } = render(<MacroPanel {...props} />);
    const defaultView = asFragment();
    const region = screen.getByRole("region", { name: "Leveling loop" });
    expect(region).toHaveClass("frame", "p-3.5");
    expect(within(region).getByRole("list", { name: "Leveling loop entries" })).toHaveClass("flex", "flex-wrap");
    expect(within(region).getByRole("listitem")).toHaveAttribute("title", "1. press slot 1 (first), delay 10 ms");
    rerender(<MacroPanel {...props} compact={false} />);
    expect(asFragment()).toEqual(defaultView);
  });
});
