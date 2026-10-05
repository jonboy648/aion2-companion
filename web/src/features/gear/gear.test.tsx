import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import gearFx from "@/fixtures/gear_upgrades.json";
import importFx from "@/fixtures/import_character.json";
import maxFx from "@/fixtures/max_potential.json";
import rawFx from "@/fixtures/armory_raw.json";
import type { ArmoryRaw, GearUpgradesResult, ImportResult, MaxPotentialResult } from "@/lib/types";
import { GEAR_METHODS, PY_NAME, classKeyFor } from "@/engine/protocol";
import { GearSection } from "./GearSection";
import { MaxPotentialPanel } from "./MaxPotentialPanel";
import { fmtGain, moveText, sources } from "./logic";

const imp = importFx as unknown as ImportResult;
const raw = rawFx as unknown as ArmoryRaw;

/** Same key set (recursively, first array element) as the type-annotated sample: guards types.ts vs the CPython fixtures. */
function keys(x: unknown): unknown {
  if (Array.isArray(x)) return x.length ? [keys(x[0])] : [];
  if (x && typeof x === "object") return Object.fromEntries(Object.keys(x).sort().map((k) => [k, k === "from" || k === "icon" ? typeof (x as Record<string, unknown>)[k] === "object" ? "obj" : "str" : keys((x as Record<string, unknown>)[k])]));
  return typeof x;
}

describe("gear fixtures (real webapi output)", () => {
  it("gear_upgrades shape", () => {
    const r = gearFx as unknown as GearUpgradesResult;
    expect(Object.keys(r).sort()).toEqual(["assumptions", "equipped", "notes", "upgrades"]);
    expect(r.upgrades.length).toBeGreaterThan(0);
    expect(Object.keys(r.upgrades[0]).sort()).toEqual(["dps_after", "dps_gain_pct", "from", "icon", "kind", "reachable", "slot", "source", "to"]);
    expect(Object.keys(r.equipped[0]).sort()).toEqual(["enchant", "enchant_odds", "exceed", "exceed_odds", "grade", "icon", "id", "il", "max_enchant", "max_exceed", "name", "reachable", "slot", "source"]);
    expect(r.upgrades.map((u) => u.kind).every((k) => k === "item" || k === "enchant" || k === "exceed")).toBe(true);
    expect(keys(r.upgrades[0].to)).toEqual(keys(r.equipped[0]));
  });
  it("max_potential shape", () => {
    const r = maxFx as unknown as MaxPotentialResult;
    expect(Object.keys(r).sort()).toEqual(["assumptions", "build", "class_key", "current_dps", "dps", "dps_without_gear", "gain_vs_current_pct", "gear", "gear_gain_pct", "notes", "playstyle", "with_current_gear"]);
    expect(Object.keys(r.with_current_gear!).sort()).toEqual(["daevanion_nodes", "dps", "stigmas"]);
    expect(Object.keys(r.build).sort()).toEqual(["daevanion_nodes", "ranks", "specialties", "stigmas"]);
    expect(r.gear.every((g) => typeof g.gain_pct === "number" && g.enchant === g.max_enchant)).toBe(true);
    expect(r.assumptions.length).toBeGreaterThan(3);
  });
});

describe("worker protocol", () => {
  it("maps gear methods, loads the class they need and flags them for the lazy items.json fetch", () => {
    expect(PY_NAME.gearUpgrades).toBe("gear_upgrades");
    expect(PY_NAME.maxPotential).toBe("max_potential");
    expect(classKeyFor("gearUpgrades", [raw, { class_key: "assassin" }, "boss"])).toBe("assassin");
    expect(classKeyFor("maxPotential", ["sorcerer", "boss"])).toBe("sorcerer");
    expect([...GEAR_METHODS].sort()).toEqual(["gearUpgrades", "maxPotential", "statSheet"]);
    expect(GEAR_METHODS.has("compare")).toBe(false);
  });
});

describe("gear helpers", () => {
  it("formats gains", () => {
    expect(fmtGain(3.89)).toBe("+3.9%");
    expect(fmtGain(0.04)).toBe("+0.04%");
    expect(fmtGain(0)).toBe("0.0%");
  });
  it("splits sources and describes moves", () => {
    expect(sources("Quest, Crafting")).toEqual(["Quest", "Crafting"]);
    expect(sources(null)).toEqual([]);
    const to = { name: "B", enchant: 10 };
    expect(moveText({ kind: "enchant", from: { name: "B", enchant: 0 }, to })).toBe("B +0 -> +10");
    expect(moveText({ kind: "item", from: { name: "A", enchant: 3 }, to })).toBe("A +3 -> B +10");
    expect(moveText({ kind: "item", from: null, to })).toBe("Empty -> B +10");
    expect(moveText({ kind: "exceed", from: { name: "B", enchant: 15, exceed: 0 }, to: { name: "B", enchant: 15, exceed: 5 } })).toBe("B Exceed 0 -> 5");
    // same name, different version: show what changes
    expect(
      moveText({ kind: "item", from: { name: "Revelation Amulet", enchant: 10, grade: "Rare", il: 13 }, to: { name: "Revelation Amulet", enchant: 10, grade: "Unique", il: 65 } }),
    ).toBe("Revelation Amulet (Rare, IL 13) +10 -> Revelation Amulet (Unique, IL 65) +10");
  });
});

describe("GearSection (mock engine)", () => {
  it("lists ranked upgrades with badges, switches playstyle, and computes max potential on request", async () => {
    let picked = "";
    render(<GearSection imp={imp} raw={raw} playstyle="boss" onPlaystyle={(k) => (picked = k)} />);
    const rows = await screen.findAllByTestId("gear-upgrade", {}, { timeout: 4000 });
    expect(rows.length).toBe((gearFx as unknown as GearUpgradesResult).upgrades.length);
    expect(within(rows[0]).getByText(/^\+\d/)).toBeInTheDocument();
    expect(within(rows[0]).getByText("Reachable")).toBeInTheDocument();
    expect(screen.queryByTestId("bis-row")).toBeNull(); // heavy panel waits for the button
    fireEvent.click(screen.getByRole("tab", { name: "AoE" }));
    expect(picked).toBe("aoe");
    fireEvent.click(screen.getByRole("button", { name: /calculate max potential/i }));
    expect((await screen.findAllByTestId("bis-row", {}, { timeout: 4000 })).length).toBe((maxFx as unknown as MaxPotentialResult).gear.length);
    expect(screen.getByTestId("gap").textContent).toMatch(/^\+/);
    expect(screen.getByText(/Assumptions \(/)).toBeInTheDocument();
  });

  it("renders nothing without the armory payload", () => {
    const { container } = render(<GearSection imp={imp} raw={null} playstyle="boss" onPlaystyle={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("max potential tiers", () => {
    const result = maxFx as unknown as MaxPotentialResult;
    const panel = (r: MaxPotentialResult) => render(<MaxPotentialPanel result={r} busy={false} error={null} onRun={() => {}} classLabel="Sorcerer" />);

    it("shows what the current gear and opened Daevanion allow, next to the ceiling, with a like-for-like gap", () => {
      const now = result.with_current_gear!;
      expect(now.daevanion_nodes).toBe(84);
      panel(result);
      expect(screen.getByTestId("with-current").textContent).toMatch(/DPS$/);
      const gap = (result.dps / now.dps - 1) * 100;
      expect(screen.getByTestId("gap").textContent).toBe(fmtGain(gap));
      expect(screen.getByText("Ceiling vs best now")).toBeInTheDocument();
      const note = screen.getByTestId("with-current-note").textContent!;
      expect(note).toContain("84 Daevanion nodes you have opened");
      expect(note).toContain("playstyle cards above use the same assumption");
      expect(now.dps).toBeLessThan(result.dps);
    });

    it("falls back to the engine's own gap when there is no character", () => {
      panel({ ...result, with_current_gear: null });
      expect(screen.queryByTestId("with-current")).toBeNull();
      expect(screen.queryByTestId("with-current-note")).toBeNull();
      expect(screen.getByText("Gap vs you")).toBeInTheDocument();
      expect(screen.getByTestId("gap").textContent).toBe(fmtGain(result.gain_vs_current_pct!));
    });
  });
});

