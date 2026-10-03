import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CraftingPage } from "@/pages/Crafting";
import { clampQty, gradeColor, shoppingText } from "./useCrafting";

describe("crafting helpers", () => {
  it("clamps quantities", () => {
    expect(clampQty(-3)).toBe(0);
    expect(clampQty(2.9)).toBe(2);
    expect(clampQty(5000)).toBe(999);
    expect(clampQty(NaN)).toBe(0);
  });
  it("uses DESIGN.md rarity colours", () => {
    expect(gradeColor("Unique")).toBe("#f0922f");
    expect(gradeColor(null)).toBe("#9aa3b8");
  });
  it("formats the checklist as text", () => {
    expect(shoppingText([{ item: "Odyle", qty: 4, source: null }, { item: "Stone", qty: 2, source: "Shop" }], new Set(["Odyle"]))).toBe(
      "[x] 4 x Odyle\n[ ] 2 x Stone (Shop)",
    );
  });
});

describe("CraftingPage (mock engine)", () => {
  beforeEach(() => localStorage.clear());
  it("adds a recipe, shows the aggregated list and remembers ticks", async () => {
    render(
      <MemoryRouter>
        <CraftingPage />
      </MemoryRouter>,
    );
    const more = (await screen.findAllByRole("button", { name: /^More /i }, { timeout: 4000 }))[0];
    fireEvent.click(more);
    const boxes = await screen.findAllByRole("checkbox", {}, { timeout: 4000 });
    fireEvent.click(boxes[0]);
    const saved = JSON.parse(localStorage.getItem("aion2c.crafting.v1:sorcerer")!);
    expect(saved.checked).toHaveLength(1);
    expect(Object.values(saved.qty)).toEqual([1]);
    expect(screen.getByText(/1 of 1 gathered|1\/\d+ gathered/)).toBeInTheDocument();
  });
});
