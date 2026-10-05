import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import rawFx from "@/fixtures/armory_raw.json";
import sheetFx from "@/fixtures/stat_sheet.json";
import { GEAR_METHODS, PY_NAME } from "@/engine/protocol";
import type { ArmoryRaw, StatRow, StatSheet } from "@/lib/types";
import { StatSheetSection } from "./StatSheetSection";
import { armoryNote, filterCategories, flagCount, fmtSigned, fmtStat, groupSources, isFlagged } from "./logic";

const sheet = sheetFx as unknown as StatSheet;
const raw = rawFx as unknown as ArmoryRaw;
const rows = new Map<string, StatRow>(sheet.categories.flatMap((c) => c.stats).map((r) => [r.key, r]));

describe("stat sheet fixture (real webapi.stat_sheet output)", () => {
  it("has the shape types.ts promises", () => {
    expect(Object.keys(sheet).sort()).toEqual(["armory_check", "categories", "class_name", "groups", "level", "not_included", "notes", "points", "unparsed"]);
    const r = rows.get("WeaponDamage")!;
    expect(Object.keys(r).sort()).toEqual(["key", "name", "sources", "unit", "value"]);
    expect(Object.keys(r.sources[0]).sort()).toEqual(["group", "label", "value"]);
    expect(Object.keys(rows.get("STR")!.armory!).sort()).toEqual(["basis", "diff", "known", "ok", "value"]);
    expect(Object.keys(rows.get("DamageRatio")!.applies_to![0]).sort()).toEqual(["add", "base", "key", "name"]);
    expect(Object.keys(sheet.armory_check.summary).sort()).toEqual(["attributes", "attributes_nonzero", "attributes_nonzero_ok", "attributes_ok", "derived", "derived_ok"]);
  });
  it("covers the stats the site promises", () => {
    const names = [...rows.values()].map((r) => r.name);
    for (const n of ["Attack Bonus", "Max Attack", "Min Attack", "Penetration", "Critical Hit", "Critical Attack", "Damage Boost", "Critical Damage Boost", "Weapon Damage Boost", "Boss Attack", "Boss Defense", "PvE Attack", "PvE Damage Boost", "Multi-hit Chance", "Perfect Chance", "Double Chance", "Combat Speed", "Cooldown Reduction", "Damage Tolerance", "Attack increase", "HP", "MP"]) {
      expect(names).toContain(n);
    }
    expect(sheet.categories.find((c) => c.key === "deity")!.stats.length).toBeGreaterThanOrEqual(10);
  });
  it("every row adds up to its sources (the breakdown is the value)", () => {
    for (const r of rows.values()) {
      if (r.capped || r.key === "CooldownTotal") continue;
      expect(r.sources.reduce((a, s) => a + s.value, 0)).toBeCloseTo(r.value, 1);
    }
  });
});

describe("worker protocol", () => {
  it("maps statSheet and loads the item table lazily", () => {
    expect(PY_NAME.statSheet).toBe("stat_sheet");
    expect(GEAR_METHODS.has("statSheet")).toBe(true);
  });
});

describe("stat sheet helpers", () => {
  it("formats numbers", () => {
    expect(fmtStat(3.1527, "%")).toBe("3.15%");
    expect(fmtStat(1234.56, "")).toBe("1,235");
    expect(fmtStat(571.7635, "")).toBe("571.8");
    expect(fmtStat(0, "%")).toBe("0%");
    expect(fmtSigned(2, "")).toBe("+2");
    expect(fmtSigned(-0.1, "%")).toBe("-0.1%");
  });
  it("groups sources by origin in the engine's order with subtotals", () => {
    const g = groupSources(rows.get("WeaponDamage")!, sheet.groups);
    expect(g[0].group).toBe("base" === g[0].group ? "base" : "gear");
    const gear = g.find((x) => x.group === "gear")!;
    expect(gear.total).toBeCloseTo(gear.lines.reduce((a, s) => a + s.value, 0));
    expect(g.map((x) => x.group)).toEqual(sheet.groups.map((x) => x.key).filter((k) => g.some((x) => x.group === k)));
  });
  it("flags rows the armory disagrees with and says why", () => {
    expect(isFlagged(rows.get("Justice")!)).toBe(true);
    expect(armoryNote(rows.get("Justice")!)).toMatch(/Armory 37.*0/);
    expect(isFlagged(rows.get("Perfect")!)).toBe(false);
    expect(armoryNote(rows.get("Perfect")!)).toMatch(/matches/);
    expect(armoryNote(rows.get("FixingDamage")!)).toBeNull();
    expect(flagCount(sheet.categories.find((c) => c.key === "deity")!)).toBe(10);
  });
  it("filters by stat or category name", () => {
    const hit = filterCategories(sheet.categories, "boss a");
    expect(hit.flatMap((c) => c.stats.map((s) => s.name))).toEqual(["Boss Attack"]);
    expect(filterCategories(sheet.categories, "boss").flatMap((c) => c.stats).length).toBeGreaterThan(4); // the category name matches too
    expect(filterCategories(sheet.categories, "").length).toBe(sheet.categories.length);
    expect(filterCategories(sheet.categories, "zzzz")).toEqual([]);
    expect(filterCategories(sheet.categories, "deity").length).toBe(1);
  });
});

describe("StatSheetSection", () => {
  async function shown() {
    render(<StatSheetSection raw={raw} />);
    return screen.findByTestId("stat-cat-attack", {}, { timeout: 3000 });
  }

  it("renders nothing without an armory download", () => {
    const { container } = render(<StatSheetSection raw={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the armory check and opens the first categories", async () => {
    await shown();
    expect(screen.getByText(/Armory lines reproduced: 24\/24/)).toBeTruthy();
    expect(screen.getByTestId("stat-row-WeaponDamage")).toBeTruthy(); // Attack is open by default
    expect(screen.queryByTestId("stat-row-Justice")).toBeNull(); // Deity is collapsed
  });

  it("collapses and expands a category", async () => {
    await shown();
    const deity = screen.getByTestId("stat-cat-deity");
    const head = within(deity).getByRole("button", { name: /Deity/ });
    expect(head.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(head);
    expect(within(deity).getByTestId("stat-row-Justice")).toBeTruthy();
    expect(within(deity).getByText(/10 differ/)).toBeTruthy();
    fireEvent.click(head);
    expect(within(deity).queryByTestId("stat-row-Justice")).toBeNull();
  });

  it("shows a stat's sources on hover and keeps them on tap", async () => {
    await shown();
    const row = screen.getByTestId("stat-row-WeaponDamage");
    const btn = within(row).getByRole("button");
    expect(screen.queryByTestId("stat-sources-WeaponDamage")).toBeNull();
    fireEvent.pointerEnter(btn, { pointerType: "mouse" });
    const panel = screen.getByTestId("stat-sources-WeaponDamage");
    expect(within(panel).getByText(/MainHand: Liberator Spellbook/)).toBeTruthy();
    expect(within(panel).getAllByText(/^Gear$/).length).toBe(1);
    fireEvent.pointerLeave(btn, { pointerType: "mouse" });
    expect(screen.queryByTestId("stat-sources-WeaponDamage")).toBeNull();
    fireEvent.click(btn); // tap pins it
    fireEvent.pointerLeave(btn, { pointerType: "mouse" });
    expect(screen.getByTestId("stat-sources-WeaponDamage")).toBeTruthy();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(btn);
    expect(screen.queryByTestId("stat-sources-WeaponDamage")).toBeNull();
  });

  it("marks estimated sources and flags attributes that differ from the armory", async () => {
    await shown();
    const row = screen.getByTestId("stat-row-STR");
    expect(row.getAttribute("data-flagged")).toBe("true");
    expect(within(row).getByText(/differs from armory/)).toBeTruthy();
    fireEvent.click(within(row).getByRole("button"));
    const panel = screen.getByTestId("stat-sources-STR");
    expect(within(panel).getAllByText("est.").length).toBeGreaterThan(0);
    expect(within(panel).getByText(/our known sources give 15\.6/)).toBeTruthy();
  });

  it("explains what an Amp Ratio line scales", async () => {
    await shown();
    fireEvent.click(within(screen.getByTestId("stat-cat-amp")).getByRole("button", { name: /Amp Ratio/ }));
    fireEvent.click(within(screen.getByTestId("stat-row-DamageRatio")).getByRole("button"));
    const panel = screen.getByTestId("stat-sources-DamageRatio");
    expect(within(panel).getByText(/Scales \(once/)).toBeTruthy();
    expect(within(panel).getByText(/Max Attack/)).toBeTruthy();
  });

  it("searches across categories", async () => {
    await shown();
    fireEvent.change(screen.getByLabelText("Find a stat"), { target: { value: "cooldown" } });
    await waitFor(() => expect(screen.queryByTestId("stat-cat-attack")).toBeNull());
    expect(screen.getByTestId("stat-row-CoolTimeDecrease")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Find a stat"), { target: { value: "nothing like this" } });
    expect(screen.getByText(/No stat matches/)).toBeTruthy();
  });

  it("lists what the armory does not tell us", async () => {
    await shown();
    expect(screen.getByText(/What the armory does not tell us/)).toBeTruthy();
  });
});
