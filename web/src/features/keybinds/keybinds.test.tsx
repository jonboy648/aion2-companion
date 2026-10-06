import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import keybindsFx from "@/fixtures/keybinds.json";
import { KeybindsPage } from "@/pages/Keybinds";
import { macroEfficiency } from "./MacroPanel";
import { parseMarkdown } from "./markdown";
import { isSlotHint } from "./useKeybindPlan";
import type { KeybindPlan } from "@/lib/types";

describe("setup sheet markdown", () => {
  const blocks = parseMarkdown(keybindsFx.instructions_markdown);
  it("parses the engine sheet into headings, tables and lists", () => {
    expect(blocks.filter((b) => b.type === "h" && b.level === 2).length).toBeGreaterThanOrEqual(5);
    const actions = blocks.find((b) => b.type === "table" && b.head[0] === "Action");
    expect(actions && actions.type === "table" && actions.rows.length).toBe(12);
    expect(blocks.some((b) => b.type === "ol")).toBe(true);
  });
});

describe("macro efficiency", () => {
  it("withholds macro efficiency until game runtime behavior is validated", () => {
    const plan = keybindsFx.plan as unknown as KeybindPlan;
    expect(macroEfficiency(plan, plan.macros[0])).toBeNull();
    expect(plan.macro_dps).toEqual({});
  });
  it("flags the per-slot layout hints", () => {
    expect(isSlotHint("slot 1: not on your bar, assign x there")).toBe(true);
    expect(isSlotHint("Boss loop: macro DPS 2443 is below 95%")).toBe(false);
  });
});

describe("KeybindsPage (mock engine)", () => {
  it("renders hotbar, macros and the sheet from the best rotation", async () => {
    localStorage.clear();
    render(
      <MemoryRouter>
        <KeybindsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Hotbar", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Boss loop" }, { timeout: 4000 })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Download \.md/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Quick Use 1:/ })).toBeInTheDocument();
    expect(screen.queryByTestId("macro-advice")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hybrid-line")).not.toBeInTheDocument();
  });
});
