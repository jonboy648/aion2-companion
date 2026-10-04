import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import compareFx from "@/fixtures/compare.json";
import type { CompareResult } from "@/lib/types";
import { Character } from "@/pages/Character";
import { Home } from "@/pages/Home";
import { ManualBuild } from "@/pages/ManualBuild";
import { BuildResults } from "./BuildResults";
import { buildFromForm, initialForm } from "./manualBuild";
import { clearRecent, gradeColor, loadRecent, rotationRows, roleNote, saveRecent, slotLabel, statDelta } from "./helpers";
import { pickHit } from "./useCharacter";

const cmp = compareFx as unknown as CompareResult;

function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/build" element={<ManualBuild />} />
        <Route path="/c/:region/:serverId/:name" element={<Character />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("helpers", () => {
  it("labels slots and grades", () => {
    expect(slotLabel("MainHand")).toBe("Main hand");
    expect(slotLabel("Earring2")).toBe("Earring 2");
    expect(gradeColor("Legend")).toBe("#f0922f");
    expect(gradeColor("???")).toBe(gradeColor("Common"));
    expect(statDelta("crit_chance_pct", 1)).toBe("+1%");
    expect(statDelta("attack", 10)).toBe("+10");
  });

  it("joins rotation with the simulator tally", () => {
    const rows = rotationRows(cmp.boss);
    expect(rows.length).toBe(cmp.boss.priority.entries.length);
    const hell = rows.find((r) => r.skillKey === "hellfire")!;
    expect(hell.chargeLevel).toBe(4); // top of the 4 client charge tiers
    expect(hell.casts).toBeGreaterThan(0);  // exact count moves with every engine change; the join is what is tested
    expect(hell.damageShare).toBeGreaterThan(5);
    expect(roleNote({ ...hell, casts: 0 }, undefined, [])).toMatch(/Never cast/);
    expect(roleNote(hell, "Custom note", [])).toBe("Custom note");
    expect(roleNote(hell, "restores 100 MP (dump description)", [])).not.toMatch(/dump/);
    expect(roleNote(hell, "(unknown)", [])).not.toMatch(/unknown/);
  });

  it("recent searches round trip and dedupe", () => {
    clearRecent();
    saveRecent({ name: "A", region: "nae", serverId: 1, serverName: "S", level: 1 });
    saveRecent({ name: "B", region: "eu", serverId: 2, serverName: "T", level: 2 });
    saveRecent({ name: "A", region: "nae", serverId: 1, serverName: "S", level: 3 });
    const r = loadRecent();
    expect(r.map((x) => x.name)).toEqual(["A", "B"]);
    expect(r[0].level).toBe(3);
    clearRecent();
    expect(loadRecent()).toEqual([]);
  });

  it("picks the exact name on the requested server", () => {
    const mk = (name: string, serverId: number) => ({ characterId: name + serverId, name, level: 1, serverId, serverName: "x", pcId: 1, race: 1, region: "nae" });
    const hits = [mk("Bob", 1), mk("Bob", 2), mk("Bobby", 2)];
    expect(pickHit(hits, "bob", "2")?.characterId).toBe("Bob2");
    expect(pickHit([], "x", "1")).toBeNull();
  });

  it("validates the manual form", () => {
    const ok = buildFromForm(initialForm("sorcerer"), 65);
    expect("build" in ok && ok.build.class_key).toBe("sorcerer");
    const bad = initialForm("sorcerer");
    bad.level = "99";
    bad.stats.attack = "abc";
    const res = buildFromForm(bad, 65);
    expect("errors" in res && res.errors.length).toBe(2);
  });
});

describe("BuildResults", () => {
  it("switches playstyle and applies a trade-off variant", async () => {
    render(<BuildResults cmp={cmp} data={{ gd: null, icons: {} }} />);
    expect(screen.getByRole("tab", { name: /Boss DPS/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: /AoE/i }));
    expect(screen.getByRole("tab", { name: /AoE/i })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: /Boss DPS/ }));
    const buttons = screen.getAllByRole("button", { name: /Use this variant/ });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(screen.getByRole("button", { name: /Using this variant/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Variant applied/)).toBeInTheDocument();
  });
});

describe("pages (mock engine)", () => {
  beforeEach(() => clearRecent());

  it("home shows search, region select with Auto, and the class showcase", async () => {
    at("/");
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Region" })).toHaveDisplayValue(/Auto/);
    expect(await screen.findByRole("link", { name: "Sorcerer" })).toHaveAttribute("href", "/build?class=sorcerer");
  });

  it("home search opens the character and remembers it", async () => {
    at("/");
    fireEvent.change(screen.getByLabelText("Character name"), { target: { value: "DarthThot" } });
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "DarthThot" }, { timeout: 5000 })).toBeInTheDocument();
    await waitFor(() => expect(loadRecent().map((r) => r.name)).toContain("DarthThot"));
  });

  it("home search requires a name", async () => {
    at("/");
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/character name/i);
  });

  it("character page shows card, gear, strip and detail", async () => {
    at("/c/nae/2103/DarthThot");
    expect(screen.getByTestId("progress")).toBeInTheDocument();
    const card = await screen.findByTestId("character-card", undefined, { timeout: 5000 });
    expect(within(card).getByText("Combat power")).toBeInTheDocument();
    expect(within(card).getByText("Liberator Spellbook")).toBeInTheDocument();
    expect(within(card).getAllByText("+10")).toHaveLength(2); // weapon and amulet
    const tabs = await screen.findAllByRole("tab", undefined, { timeout: 5000 });
    expect(tabs).toHaveLength(4);
    expect(await screen.findByTestId("playstyle-detail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Share/ })).toBeInTheDocument();
    expect(screen.getByText("Next stat upgrades")).toBeInTheDocument();
  });

  it("manual build runs the engine and shows results", async () => {
    at("/build?class=sorcerer");
    expect(screen.getByRole("heading", { level: 1, name: "Manual build" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Find my best build/ }));
    expect(await screen.findByTestId("playstyle-detail", undefined, { timeout: 5000 })).toBeInTheDocument();
  });

  it("manual build rejects an invalid level", async () => {
    at("/build");
    fireEvent.change(screen.getByLabelText(/Level/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Find my best build/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Level must be/);
  });
});
