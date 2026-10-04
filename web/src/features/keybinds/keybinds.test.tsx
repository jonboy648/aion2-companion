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
    const gkeys = blocks.find((b) => b.type === "table" && b.head[0] === "G-key");
    expect(gkeys && gkeys.type === "table" && gkeys.rows.length).toBe(keybindsFx.plan.gkeys.length);
    expect(blocks.some((b) => b.type === "ol")).toBe(true);
  });
});

describe("macro efficiency", () => {
  it("matches macro DPS to the ideal of its scenario", () => {
    const plan = keybindsFx.plan as unknown as KeybindPlan;
    const e = macroEfficiency(plan, plan.macros[0])!;
    const scen = plan.macros[0].name === "Boss loop" ? "boss_180" : "aoe_pack";
    expect(e.pct).toBeCloseTo((plan.macro_dps[plan.macros[0].name] / plan.ideal_dps[scen]) * 100, 1);
    expect(plan.hybrid_dps[plan.macros[0].name]).toBeGreaterThanOrEqual(plan.macro_dps[plan.macros[0].name]);
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
    expect(screen.getByRole("button", { name: /^Key 1:/ })).toBeInTheDocument();
    expect((await screen.findAllByTestId("macro-advice")).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("hybrid-line").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "Core priorities" })).toBeInTheDocument();
  });
});
