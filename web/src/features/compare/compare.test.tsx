import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import importFx from "@/fixtures/import_character.json";
import compareFx from "@/fixtures/compare.json";
import type { CompareResult, ImportResult } from "@/lib/types";
import { Compare } from "@/pages/Compare";
import { readActiveBuild } from "@/features/keybinds/activeBuild";
import { CompareView, type SideData } from "./CompareView";
import { TARGET_PLAN_KEY, boardRows, buildCopyPlan, comparePath, gearRows, parseTriplet, pctDiff, rankRows, tripletParam } from "./logic";

const base = importFx as unknown as ImportResult;
const cmp = compareFx as unknown as CompareResult;

/** DarthThot twice: B is a stronger copy (better weapon, higher ranks, one stigma swapped, fewer Daevanion nodes). */
function modified(): ImportResult {
  const b = structuredClone(base);
  b.profile.name = "RivalMage";
  b.profile.combat_power = 40000;
  b.profile.item_level = 720;
  b.gear[0] = { ...b.gear[0], enchant: 12 };
  b.gear[1] = { ...b.gear[1], grade: "Epic" };
  b.build.skill_ranks["hellfire"] = 8; // was 5
  b.build.skill_ranks["flame-arrow"] = 8; // was 10
  b.build.stigmas = ["element-enhancement", "cold-storm", "fire-wall", "frost"];
  b.stigmas[3] = { key: "frost", name: "Frost", rank: 3 };
  b.daevanion_summary.boards[0].matched = 50;
  b.build.daevanion_nodes = b.build.daevanion_nodes.slice(0, 10);
  return b;
}

const side = (imp: ImportResult, boss = 1000): SideData => {
  const c = structuredClone(cmp);
  c.boss.result.dps = boss;
  return { imp, extras: null, cmp: c, data: { gd: null, icons: {} } };
};

describe("compare logic", () => {
  it("round-trips triplets through a path segment, names with spaces and unicode included", () => {
    const t = { region: "nae" as const, serverId: "2103", name: "Dárth Thot" };
    expect(parseTriplet(tripletParam(t))).toEqual(t);
    expect(parseTriplet("-")).toBeNull();
    expect(parseTriplet(undefined)).toBeNull();
    expect(parseTriplet("nae~2103")).toBeNull();
    expect(comparePath(t, null)).toBe(`/compare/${tripletParam(t)}/-`);
  });

  it("picks the better gear per slot", () => {
    const rows = gearRows(base.gear, modified().gear);
    expect(rows[0].winner).toBe("b"); // +12 vs +10
    expect(rows[1].winner).toBe("a"); // Legend vs Epic
    expect(rows.slice(2).every((r) => r.winner === "tie")).toBe(true);
  });

  it("diffs skill ranks with the biggest gaps first and signs b minus a", () => {
    const rows = rankRows(base.build.skill_ranks, modified().build.skill_ranks);
    expect(rows[0]).toMatchObject({ key: "hellfire", a: 5, b: 8, diff: 3 });
    expect(rows[1]).toMatchObject({ key: "flame-arrow", a: 10, b: 8, diff: -2 });
    expect(rows[2].diff).toBe(0);
    expect(rankRows({ x: 1 }, {})[0]).toMatchObject({ a: 1, b: 0, diff: -1 });
  });

  it("joins Daevanion boards and computes percent gaps", () => {
    const r = boardRows(base.daevanion_summary.boards, modified().daevanion_summary.boards);
    expect(r[0].a?.matched).toBe(68);
    expect(r[0].b?.matched).toBe(50);
    expect(pctDiff(1000, 1100)).toBe("+10.0%");
    expect(pctDiff(0, 5)).toBeNull();
  });

  it("copies stigmas, ranks and Daevanion nodes over my build but keeps my level and stats", () => {
    const mine = base;
    const theirs = modified();
    theirs.build.level = 50;
    const res = buildCopyPlan(mine, theirs, new Date("2026-01-01T00:00:00Z"));
    if (!res.ok) throw new Error(res.reason);
    expect(res.plan.build.skill_ranks.hellfire).toBe(8);
    expect(res.plan.build.stigmas).toContain("frost");
    expect(res.plan.build.daevanion_nodes).toHaveLength(10);
    expect(res.plan.build.level).toBe(mine.build.level);
    expect(res.plan.build.stats).toEqual(mine.build.stats);
    expect(res.plan.build.name).toBe("Target: RivalMage");
    expect(res.warnings[0]).toMatch(/level/i);
    // the copy is independent of the source
    res.plan.build.skill_ranks.hellfire = 1;
    expect(theirs.build.skill_ranks.hellfire).toBe(8);
  });

  it("refuses to copy across classes", () => {
    const other = modified();
    other.build.class_key = "assassin";
    other.profile.class_name = "Assassin";
    const res = buildCopyPlan(base, other);
    expect(res.ok).toBe(false);
  });
});

describe("CompareView", () => {
  it("shows both sides, marks winners and the estimated DPS", () => {
    const onCopy = vi.fn();
    render(<CompareView a={side(base, 1000)} b={side(modified(), 1200)} onCopy={onCopy} />);
    const view = screen.getByTestId("compare-view");
    expect(within(view).getAllByText("DarthThot").length).toBeGreaterThan(0);
    expect(within(view).getByText("RivalMage")).toBeInTheDocument();
    expect(within(view).getByText("estimated")).toBeInTheDocument();
    expect(within(view).getByText("(+20.0% for the right side)")).toBeInTheDocument();
    expect(view.querySelectorAll('[data-better="true"]').length).toBeGreaterThan(5);
    const table = within(view).getByRole("table", { name: "Skill rank differences" });
    expect(within(table).getAllByRole("row")[1]).toHaveAttribute("data-diff", "3");
    fireEvent.click(within(view).getByRole("button", { name: "Copy RivalMage's build" }));
    expect(onCopy).toHaveBeenCalledWith("b");
  });

  it("explains instead of diffing skills across classes", () => {
    const other = modified();
    other.build.class_key = "assassin";
    other.profile.class_name = "Assassin";
    render(<CompareView a={side(base)} b={side(other)} onCopy={() => {}} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(/ranks are not comparable/)).toBeInTheDocument();
  });
});

describe("Compare page (mock engine)", () => {
  beforeEach(() => localStorage.clear());

  it("loads both slots from the URL, estimates DPS and copies a build into the active-build store", async () => {
    const a = tripletParam({ region: "nae", serverId: "2103", name: "DarthThot" });
    const b = tripletParam({ region: "eu", serverId: "1001", name: "DarthThot" });
    render(
      <MemoryRouter initialEntries={[`/compare/${a}/${b}`]}>
        <Routes>
          <Route path="/compare/:a?/:b?" element={<Compare />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("compare-view", {}, { timeout: 4000 })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Copy DarthThot's build/ })[1]);
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(readActiveBuild()?.name).toBe("Target: DarthThot");
    expect(JSON.parse(localStorage.getItem(TARGET_PLAN_KEY) ?? "{}").from).toBe("DarthThot");
    expect(screen.getByRole("link", { name: "Open Keybinds" })).toHaveAttribute("href", "/keybinds");
  });

  it("asks for two characters when the URL has none", () => {
    render(
      <MemoryRouter initialEntries={["/compare"]}>
        <Compare />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Pick two characters/)).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Character A search" })).toBeInTheDocument();
    expect(screen.queryByTestId("compare-view")).toBeNull();
  });
});
