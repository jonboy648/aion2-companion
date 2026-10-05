import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

describe("Leveling loop metadata", () => {
  const macro = { name: "Leveling loop", hotkey: "F11", entries: [{ index: 1, key_label: "1", delay_ms: 10 }] };
  const plan: KeybindPlan = {
    ...(keybindsFx.plan as unknown as KeybindPlan),
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
});
