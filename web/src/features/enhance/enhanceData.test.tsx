import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EnhancePage } from "@/pages/Enhance";
import { costLink } from "@/features/gear/GearUpgradesCard";
import type { GearUpgrade } from "@/lib/types";
import { fmt, searchItems, stepsFor, toItem, firstRiskyLevel, type EnhanceDoc } from "./enhanceData";
import { attemptsCdf, chanceWithin, costPercentiles, plan } from "./enhanceMath";

const RAW = readFileSync(join(__dirname, "../../../public/data/enhance.json"), "utf8");
const doc = JSON.parse(RAW) as EnhanceDoc;
const LUDRA = "Enchant_Unique_102";

describe("enhance.json with the calculator", () => {
  it("Ludra's Blade +10 to +15 matches the independent figures in research/stats_gear_extract (12.2 tries, 14.1M kinah)", () => {
    const steps = stepsFor(doc, "enchant", LUDRA)!;
    expect(steps).toHaveLength(15);
    expect(firstRiskyLevel(steps)).toBe(10);
    const r = plan(steps, 10, 15);
    expect(r.attempts).toBeCloseTo(12.2, 1);
    expect(r.kinah / 1e6).toBeCloseTo(14.1, 1);
    expect(r.mats["Enhance Stone"] / 1e3).toBeCloseTo(154, 0);
    expect(plan(steps, 10, 15, { pity: false }).attempts).toBeCloseTo(15.4, 1); // "no pity" figure from the same note
  });
  it("amplify 0 to 5 on a Unique IL102 weapon: 13.8 tries with pity, 15.5 without (same note)", () => {
    const steps = stepsFor(doc, "exceed", "Weapon_Unique_102")!;
    expect(plan(steps, 0, 5).attempts).toBeCloseTo(13.8, 1);
    expect(plan(steps, 0, 5, { pity: false }).attempts).toBeCloseTo(1 / 0.66 + 2 + 1 / 0.33 + 4 + 5, 8); // sum of 1/p = 15.545 (the note rounds to 15.6)
  });
  it("+0 to +10 on that item never fails, so it is exactly one try per level", () => {
    const steps = stepsFor(doc, "enchant", LUDRA)!;
    const r = plan(steps, 0, 10);
    expect(r.attempts).toBeCloseTo(10, 10);
    expect(chanceWithin(attemptsCdf(steps, 0, 10), 10)).toBe(1);
  });
  it("the Clash Rune loses a level on failure and costs more than its plain odds suggest", () => {
    const rune = doc.items.map(toItem).find((i) => i.slot === "rune" && i.groups.enchant)!;
    const steps = stepsFor(doc, "enchant", rune.groups.enchant)!;
    expect(steps[1].drop).toBe(1);
    const r = plan(steps, 0, steps.length);
    expect(r.attempts).toBeGreaterThan(steps.reduce((t, s) => t + 1 / s.p, 0)); // 69,000 tries against 28 without the drop
    const spread = costPercentiles(steps, 0, steps.length, (s) => s.kinah);
    expect(spread.method).toBe("simulated");
    expect(spread.p90!).toBeGreaterThan(spread.median!);
  });
  it("every item's groups resolve to steps, and every step has odds in (0, 1]", () => {
    for (const row of doc.items) {
      const it = toItem(row);
      for (const [track, g] of Object.entries(it.groups)) {
        if (!g) continue;
        const steps = stepsFor(doc, track as "enchant", g);
        expect(steps, `${it.id} ${track} ${g}`).not.toBeNull();
        for (const s of steps!) expect(s.p > 0 || s.fc > 0).toBe(true);
      }
    }
  });
  it("searches by words and grade, highest level first", () => {
    const hits = searchItems(doc.items.map(toItem), "ludra unique");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => /ludra/i.test(h.name) && h.grade === "Unique")).toBe(true);
    expect(searchItems(doc.items.map(toItem), "   ")).toEqual([]);
  });
  it("formats big numbers", () => {
    expect([fmt(2), fmt(12.34), fmt(1234), fmt(45678), fmt(14_100_000), fmt(Infinity)]).toEqual(["2.00", "12.3", "1,234", "45.7K", "14.10M", "never"]);
  });
});

describe("deep link from gear upgrades", () => {
  const piece = (enchant: number, exceed = 0) => ({ id: 5, enchant, exceed }) as GearUpgrade["to"];
  it("links enhance and amplify moves, not new items", () => {
    const base = { slot: "weapon", dps_gain_pct: 1, dps_after: 1, source: "", reachable: true, icon: null };
    expect(costLink({ ...base, kind: "enchant", from: piece(10), to: piece(12) })).toBe("/enhance?item=5&track=enchant&from=10&to=12");
    expect(costLink({ ...base, kind: "exceed", from: piece(15, 1), to: piece(15, 2) })).toBe("/enhance?item=5&track=exceed&from=1&to=2");
    expect(costLink({ ...base, kind: "item", from: null, to: piece(0) })).toBeNull();
  });
});

describe("EnhancePage", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", async () => new Response(RAW, { status: 200 }));
  });
  afterEach(() => vi.clearAllMocks());

  const at = (url: string) => render(<MemoryRouter initialEntries={[url]}><EnhancePage /></MemoryRouter>);

  it("prices the +10 to +15 default range and the within-N-tries answer follows the input", async () => {
    at(`/enhance?item=110120003`);
    expect(await screen.findByText("Expected attempts")).toBeInTheDocument();
    expect(screen.getAllByText("12.2").length).toBeGreaterThan(0);
    expect(screen.getByTestId("steps").querySelectorAll("tbody tr")).toHaveLength(5);
    fireEvent.change(screen.getByLabelText("Number of tries"), { target: { value: "5" } });
    // five levels in five tries means every step wins first time: .65 * .5 * .35 * .25 * .2 = 0.56875%
    expect(screen.getByTestId("within").textContent).toBe("0.57%");
  });
  it("turning pity off raises the expected attempts", async () => {
    at(`/enhance?item=110120003&pity=0`);
    expect(await screen.findByText("Expected attempts")).toBeInTheDocument();
    expect(screen.getAllByText("15.4").length).toBeGreaterThan(0);
    expect((screen.getByLabelText(/Count the pity bonus/) as HTMLInputElement).checked).toBe(false);
  });
  it("opens on the linked track and range, and says so when the target is not above the start", async () => {
    at(`/enhance?item=110120003&track=exceed&from=0&to=5`);
    expect(await screen.findByText("Expected attempts")).toBeInTheDocument();
    expect(screen.getAllByText("13.8").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Current level"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Target level"), { target: { value: "2" } });
    await waitFor(() => expect(screen.getByText(/Pick a target level above/)).toBeInTheDocument());
  });
  it("finds an item by name and switches to it", async () => {
    at("/enhance");
    await screen.findByText("Expected attempts");
    fireEvent.change(screen.getByLabelText("Search items"), { target: { value: "ludra" } });
    const list = await screen.findByRole("list", { name: "Matching items" });
    fireEvent.click(list.querySelector("button")!);
    expect(screen.queryByRole("list", { name: "Matching items" })).toBeNull();
  });
});
