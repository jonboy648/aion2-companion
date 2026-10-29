import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import rawFx from "@/fixtures/armory_raw.json";
import importFx from "@/fixtures/import_character.json";
import compareFx from "@/fixtures/compare.json";
import { Character } from "@/pages/Character";
import type { CompareResult, FullBuild, Goal } from "@/lib/types";
import { readActiveBuild, readPlannedBuild } from "@/features/keybinds/activeBuild";
import { BuildResults } from "./BuildResults";

const io = vi.hoisted(() => ({ compare: vi.fn() }));
vi.mock("@/engine/api", async original => ({
  ...await original<typeof import("@/engine/api")>(),
  compare: io.compare,
  importCharacter: async () => importFx,
}));
vi.mock("@/lib/armory", async original => ({
  ...await original<typeof import("@/lib/armory")>(),
  search: async () => [{ name: "DarthThot", serverId: 2103, region: "nae", characterId: "first" }],
  fetchCharacter: async () => rawFx,
}));

const damage = compareFx as unknown as CompareResult;
function staggerResult(): CompareResult {
  return Object.fromEntries(Object.entries(damage).map(([key, fb]: [string, FullBuild]) => [key, {
    ...fb, objective: "stagger", objective_score: 12, objective_unit: "gauge/s", current_objective_score: 3,
    playstyle: { ...fb.playstyle, scenario: { ...fb.playstyle.scenario, objective: "stagger" } },
    result: { ...fb.result, total_stagger: 2160, stagger_per_s: 12 },
  }])) as unknown as CompareResult;
}
function deferred<T>() {
  let resolve!: (result: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function page() {
  render(<MemoryRouter initialEntries={["/c/nae/2103/DarthThot"]}><Routes>
    <Route path="/c/:region/:serverId/:name" element={<Character />} />
    <Route path="/keybinds" element={<p>Native setup editor</p>} />
  </Routes></MemoryRouter>);
}
beforeEach(() => {
  localStorage.clear();
  io.compare.mockReset().mockResolvedValue(damage);
});

it("loads Damage automatically, then waits for Calculate after goal and point edits", async () => {
  page();
  await screen.findByTestId("playstyle-detail");
  const goal = screen.getByRole("combobox", { name: "Goal" });
  expect(goal).toHaveValue("damage");
  expect(io.compare).toHaveBeenCalledTimes(1);
  fireEvent.change(goal, { target: { value: "stagger" } });
  fireEvent.change(screen.getByLabelText("Skill points"), { target: { value: "36" } });
  expect(screen.getByRole("status", { name: "Result status" })).toHaveTextContent(/out of date/i);
  expect(screen.getByTestId("playstyle-detail")).toBeInTheDocument();
  await new Promise(resolve => setTimeout(resolve, 650));
  expect(io.compare).toHaveBeenCalledTimes(1);
  io.compare.mockResolvedValue(staggerResult());
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  await waitFor(() => expect(io.compare).toHaveBeenCalledTimes(2));
  expect(io.compare.mock.calls[1][0]).toMatchObject({ skill_points: 36 });
  expect(io.compare.mock.calls[1][3]).toBe("stagger");
  await waitFor(() => expect(screen.queryByRole("status", { name: "Result status" })).toBeNull());
  expect(screen.getByTestId("plan-dps")).toHaveTextContent("12");
  expect(screen.getByTestId("plan-dps")).toHaveTextContent("gauge/s");
  expect(screen.getByTestId("current-dps")).toHaveTextContent("3");
  expect(screen.getByTestId("current-dps")).toHaveTextContent("gauge/s");
  expect(screen.queryByText(/Max potential/i)).toBeNull();
  expect(screen.getByText(/not.*break time/i)).toBeInTheDocument();
});

it("keeps the last result visibly stale during calculation and ignores late progress and replies after edits", async () => {
  page();
  await screen.findByTestId("playstyle-detail");
  const pending = deferred<CompareResult>();
  io.compare.mockReturnValueOnce(pending.promise);
  fireEvent.change(screen.getByLabelText("Goal"), { target: { value: "stagger" } });
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  await waitFor(() => expect(io.compare).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("status", { name: "Result status" })).toHaveTextContent(/out of date/i);
  expect(screen.getByTestId("playstyle-detail")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Send.*Keybinds/ })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Stigma points"), { target: { value: "4" } });
  await act(async () => {
    io.compare.mock.calls[1][2]("Late stagger progress");
    pending.resolve(staggerResult());
  });
  expect(screen.queryByText("Late stagger progress")).toBeNull();
  expect(screen.getByRole("status", { name: "Result status" })).toHaveTextContent(/out of date/i);
  expect(screen.getByTestId("plan-dps")).not.toHaveTextContent("gauge/s");
  io.compare.mockResolvedValue(staggerResult());
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  await waitFor(() => expect(screen.getByTestId("plan-dps")).toHaveTextContent("gauge/s"));
  fireEvent.click(screen.getByRole("button", { name: /Send.*Keybinds/ }));
  expect(await screen.findByText("Native setup editor")).toBeInTheDocument();
  expect(readPlannedBuild(readActiveBuild())?.priority).toEqual(staggerResult().boss.priority);
  expect(readActiveBuild()).toMatchObject({ ...staggerResult().boss.build, skill_points: 0, stigma_points: 0 });
});

it("retains the prior result and allows retry when a recalculation fails", async () => {
  page();
  await screen.findByTestId("playstyle-detail");
  io.compare.mockRejectedValueOnce(new Error("Goal calculation unavailable"));
  fireEvent.change(screen.getByLabelText("Goal"), { target: { value: "stagger" } });
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Goal calculation unavailable");
  expect(screen.getByTestId("playstyle-detail")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Calculate" })).toBeEnabled();
});

it("rejects a result from the wrong goal rather than publishing it as the requested calculation", async () => {
  page();
  await screen.findByTestId("playstyle-detail");
  fireEvent.change(screen.getByLabelText("Goal"), { target: { value: "stagger" } });
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/returned.*damage.*stagger/i);
  expect(screen.getByRole("status", { name: "Result status" })).toHaveTextContent(/out of date/i);
  expect(screen.getByTestId("plan-dps")).not.toHaveTextContent("gauge/s");
});

it("shows unknown gauge scores without falling back to HP DPS, even with only scenario goal metadata", () => {
  const cmp = staggerResult();
  const fb = cmp.boss;
  const unknown = { ...fb, objective: undefined, objective_score: undefined, current_objective_score: undefined,
    result: { ...fb.result, stagger_per_s: undefined, total_stagger: undefined },
  };
  render(<BuildResults cmp={{ ...cmp, boss: unknown }} data={{ gd: null, icons: {} }} />);
  expect(screen.getByTestId("plan-dps")).toHaveTextContent("Unavailable");
  expect(screen.getByTestId("plan-dps")).not.toHaveTextContent(String(fb.result.dps));
  expect(screen.getByTestId("current-dps")).toHaveTextContent("Unavailable");
  expect(screen.getByText("Estimated DPS")).toBeInTheDocument();
});

it("omits damage gain percentages for stagger purchases and keeps specific model caveats readable", () => {
  const cmp = staggerResult();
  cmp.boss = { ...cmp.boss, rank_log: [["hellfire", 6, 99]], daevanion_gain_pct: 88,
    stigma_picks: [["hellfire", 77]], warnings: ["FrostBurst immunity-trigger route is not modeled.", "Firestorm aggregate timing is not per-projectile timing."] };
  render(<BuildResults cmp={cmp} data={{ gd: null, icons: {} }} />);
  expect(screen.getByTestId("rank-log")).not.toHaveTextContent(/%|DPS/);
  expect(screen.queryByText(/77.*DPS|88.*DPS|99.*DPS/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show 2 model notes" }));
  expect(screen.getByText(/FrostBurst immunity-trigger/)).toBeInTheDocument();
  expect(screen.getByText(/Firestorm aggregate timing/)).toBeInTheDocument();
});

it.each(["Trade-offs", "Stat gains"])("returns to Overview when %s was open before switching to Stagger", tab => {
  const { rerender } = render(<BuildResults cmp={damage} data={{ gd: null, icons: {} }} />);
  fireEvent.mouseDown(screen.getByRole("tab", { name: tab }), { button: 0, ctrlKey: false });
  expect(screen.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
  rerender(<BuildResults cmp={staggerResult()} data={{ gd: null, icons: {} }} />);
  expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  expect(screen.queryByRole("button", { name: /Use this variant/ })).toBeNull();
  expect(screen.queryByText("Next stat upgrades")).toBeNull();
});

it("ignores a superseded reply even after a newer goal result has completed", async () => {
  page();
  await screen.findByTestId("playstyle-detail");
  const old = deferred<CompareResult>();
  io.compare.mockReturnValueOnce(old.promise);
  fireEvent.change(screen.getByLabelText("Goal"), { target: { value: "stagger" } });
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  await waitFor(() => expect(io.compare).toHaveBeenCalledTimes(2));
  fireEvent.change(screen.getByLabelText("Goal"), { target: { value: "damage" } });
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  await waitFor(() => expect(io.compare).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(screen.queryByRole("status", { name: "Result status" })).toBeNull());
  await act(async () => old.resolve(staggerResult()));
  expect(screen.getByTestId("plan-dps")).not.toHaveTextContent("gauge/s");
  expect(screen.queryByRole("alert")).toBeNull();
});

it.each<Goal>(["damage", "stagger"])("uses matching %s summary units without reinterpreting HP damage", goal => {
  const cmp = goal === "stagger" ? staggerResult() : damage;
  render(<BuildResults cmp={cmp} data={{ gd: null, icons: {} }} />);
  if (goal === "stagger") {
    expect(screen.queryByRole("tab", { name: "Trade-offs" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Stat gains" })).toBeNull();
    expect(screen.queryByText(/Max-DPS path/)).toBeNull();
    expect(screen.queryByText(/DPS best build/)).toBeNull();
    expect(within(screen.getByTestId("plan-dps")).getByText(/gauge\/s/)).toBeInTheDocument();
    expect(screen.getByText("Estimated DPS")).toBeInTheDocument(); // HP damage stays separately available
  } else {
    expect(screen.getByText("Estimated DPS")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Trade-offs" })).toBeInTheDocument();
  }
});

it("explains a Stagger plan with its gauge contributions rather than ranking its HP damage", () => {
  const cmp = staggerResult();
  cmp.boss = { ...cmp.boss, result: { ...cmp.boss.result, total_stagger: 100,
    per_skill: { blaze: { casts: 1, damage: 9000, stagger: 10 }, frost: { casts: 1, damage: 1000, stagger: 90 } },
  } };
  render(<BuildResults cmp={cmp} data={{ gd: null, icons: {} }} />);
  const rows = within(screen.getByRole("list", { name: "Stagger gauge values" })).getAllByRole("listitem");
  expect(rows[0]).toHaveTextContent("Frost");
  expect(rows[0]).toHaveTextContent("90 gauge");
  expect(rows[1]).toHaveTextContent("10 gauge");
  expect(screen.queryByText("Estimated damage by skill")).toBeNull();
  expect(screen.getByText("Damage of this Stagger plan")).toBeInTheDocument();
});
