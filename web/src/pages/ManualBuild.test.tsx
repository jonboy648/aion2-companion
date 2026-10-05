import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import gdFx from "@/fixtures/gamedata_sorcerer.json";
import compareFx from "@/fixtures/compare.json";
import { POINTS_DEBOUNCE_MS } from "@/features/build/unspentPoints";
import { levelBudget, validateLevelPlan } from "@/features/progression/progression";
import type { ClassData } from "@/features/build/useClassData";
import type { CharacterBuild, CompareResult, FullBuild, GameData, PlaystyleKey } from "@/lib/types";
import { ManualBuild } from "./ManualBuild";
import { CodexPage } from "./Codex";

const mocks = vi.hoisted(() => ({ compare: vi.fn(), listClasses: vi.fn(), storePlannedBuild: vi.fn() }));
vi.mock("@/engine/api", () => ({ compare: mocks.compare, listClasses: mocks.listClasses }));
vi.mock("@/features/keybinds/activeBuild", () => ({ storePlannedBuild: mocks.storePlannedBuild }));
vi.mock("@/features/codex/CodexView", () => ({ CodexView: () => <p>Skill encyclopedia content</p> }));
const dataByClass: Record<string, ClassData> = Object.fromEntries(["sorcerer", "gladiator"].map((key) => [key, {
  gd: { ...gdFx, class_key: key } as unknown as GameData, icons: {},
}]));
vi.mock("@/features/build/useClassData", () => ({ useClassData: (key: string) => dataByClass[key] }));
vi.mock("@/features/build/BuildResults", () => ({
  ProgressPanel: ({ message }: { message: string }) => <div role="status">{message}</div>,
  BuildResults: ({ cmp, selected = "boss", onSelect, onUsePlan }: {
    cmp: CompareResult; selected?: PlaystyleKey; onSelect?: (key: PlaystyleKey) => void; onUsePlan?: (fb: FullBuild) => void;
  }) => <div data-testid="results">
    <span>{selected} DPS {cmp[selected].result.dps}</span>
    <button onClick={() => onSelect?.("aoe")}>Select AoE</button>
    <button onClick={() => onUsePlan?.(cmp[selected])}>Use plan</button>
  </div>,
}));

// The API mock respects the submitted progression inputs; validation itself is never mocked.
function resultFor(build: CharacterBuild): CompareResult {
  const result = structuredClone(compareFx) as unknown as CompareResult;
  for (const fb of Object.values(result)) {
    fb.build = structuredClone(build);
    fb.priority = {
      label: "Available core skills",
      entries: ["firestorm", "flame-arrow"].filter((key) => (build.skill_ranks[key] ?? 0) >= 1)
        .map((skill_key) => ({ skill_key, charge_level: 0, require_status: null })),
    };
    fb.result.dps = 100 + build.level;
    fb.daevanion_path = [];
    fb.variants = [{ key: "safe", label: "Safe", gives: "", build: structuredClone(build),
      stigma_picks: [], dps: fb.result.dps, dps_delta_pct: 0 }];
  }
  return result;
}

async function at(guideClass?: string) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<MemoryRouter initialEntries={["/build?class=sorcerer"]}>
      <Routes>
        <Route path="/build" element={<ManualBuild guideClass={guideClass} />} />
        <Route path="/keybinds" element={<p>Keybind destination</p>} />
      </Routes>
    </MemoryRouter>);
  });
  return view;
}
async function submit() {
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Find (my best|class) build/ })); });
}
async function debounce() {
  await act(async () => { await vi.advanceTimersByTimeAsync(POINTS_DEBOUNCE_MS); });
}

async function atCodex() {
  await act(async () => {
    render(<MemoryRouter initialEntries={["/codex/sorcerer"]}>
      <Routes><Route path="/codex/:classKey" element={<CodexPage />} /></Routes>
    </MemoryRouter>);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  dataByClass.sorcerer = { gd: { ...gdFx, class_key: "sorcerer" } as unknown as GameData, icons: {}, error: null };
  mocks.compare.mockReset().mockImplementation(async (build: CharacterBuild) => resultFor(build));
  mocks.listClasses.mockReset().mockResolvedValue([
    { key: "sorcerer", name: "Sorcerer", role: "ranged_dps" },
    { key: "gladiator", name: "Gladiator", role: "melee_dps" },
  ]);
  mocks.storePlannedBuild.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("level-aware manual and class planner", () => {
  it("starts at Global 45 with cumulative totals, zero extras and both quests unchecked", async () => {
    await at();
    expect(screen.getByRole("slider")).toHaveAttribute("min", "1");
    expect(screen.getByRole("slider")).toHaveAttribute("max", "45");
    expect(screen.getByLabelText("Level (1 to 45)")).toHaveValue("45");
    expect(screen.getByText("203")).toBeInTheDocument();
    expect(screen.getByText("136")).toBeInTheDocument();
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).not.toBeChecked();
    for (const key of ["skill", "stigma", "daevanion"]) expect(screen.getByLabelText(`Extra ${key} points`)).toHaveValue(0);
    await debounce();
    expect(mocks.compare).not.toHaveBeenCalled();
    await submit();
    expect(mocks.compare.mock.calls[0][0]).toMatchObject({ level: 45, skill_points: 203, stigma_points: 0 });
    expect(mocks.compare.mock.calls[0][1]).toBe(0);
    expect(screen.getByTestId("results")).toHaveTextContent("boss DPS 145");
    expect(mocks.storePlannedBuild).not.toHaveBeenCalled();
  });

  it("adds earned rewards to exact level totals and passes an explicit zero until Daevanion is unlocked", async () => {
    await at();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    for (const [key, value] of [["skill", 7], ["stigma", 3], ["daevanion", 5]]) {
      fireEvent.change(screen.getByLabelText(`Extra ${key} points`), { target: { value } });
    }
    fireEvent.click(screen.getByRole("checkbox", { name: /Stigma unlock/ }));
    await submit();
    expect(mocks.compare.mock.calls[0][0]).toMatchObject({ level: 30, skill_points: 118, stigma_points: 11 });
    expect(mocks.compare.mock.calls[0][1]).toBe(0);
    fireEvent.click(screen.getByRole("checkbox", { name: /Daevanion unlock/ }));
    expect(screen.queryByTestId("results")).toBeNull();
    await debounce();
    expect(mocks.compare.mock.calls[1][1]).toBe(81);
  });

  it.each(["level", "stat", "earned", "stigma", "daevanion", "race"])("immediately clears results on %s changes and debounces a new solve", async (input) => {
    await at();
    await submit();
    if (input === "level") fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    if (input === "stat") fireEvent.change(screen.getByLabelText("Attack"), { target: { value: "1234" } });
    if (input === "earned") fireEvent.change(screen.getByLabelText("Extra skill points"), { target: { value: "7" } });
    if (input === "stigma") fireEvent.click(screen.getByRole("checkbox", { name: /Stigma unlock/ }));
    if (input === "daevanion") fireEvent.click(screen.getByRole("checkbox", { name: /Daevanion unlock/ }));
    if (input === "race") fireEvent.click(screen.getByRole("button", { name: "elyos" }));
    expect(screen.queryByTestId("results")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(POINTS_DEBOUNCE_MS - 1); });
    expect(mocks.compare).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.compare).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("results")).toBeInTheDocument();
  });

  it("rejects invalid levels and earned rewards without calling the engine", async () => {
    await at();
    fireEvent.change(screen.getByLabelText("Level (1 to 45)"), { target: { value: "0" } });
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("Level must be a whole number from 1 to 45");
    expect(screen.queryByText(/Validation details/)).toBeNull();
    expect(mocks.compare).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Level (1 to 45)"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Extra skill points"), { target: { value: "0.5" } });
    await debounce();
    expect(screen.getByRole("alert")).toHaveTextContent(/Earned points must be whole/);
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it("drops older responses and progress after a newer input run finishes", async () => {
    let resolveOld!: (result: CompareResult) => void;
    const pending = new Promise<CompareResult>((resolve) => { resolveOld = resolve; });
    mocks.compare.mockImplementationOnce(() => pending);
    await at();
    await submit();
    const oldInput = mocks.compare.mock.calls[0][0] as CharacterBuild;
    fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    await debounce();
    expect(screen.getByTestId("results")).toHaveTextContent("DPS 130");
    await act(async () => {
      mocks.compare.mock.calls[0][2]?.("Old progress");
      resolveOld(resultFor(oldInput));
    });
    expect(screen.getByTestId("results")).toHaveTextContent("DPS 130");
    expect(screen.queryByText("Old progress")).toBeNull();
  });

  it("invalidates class changes and submits the new class instead of the initial form class", async () => {
    await at();
    await submit();
    fireEvent.click(screen.getByRole("button", { name: "Gladiator" }));
    expect(screen.queryByTestId("results")).toBeNull();
    await debounce();
    expect(mocks.compare.mock.calls[1][0].class_key).toBe("gladiator");
    expect(screen.getByTestId("results")).toBeInTheDocument();
  });

  it.each(["base", "variant", "specialty", "stigma", "daevanion", "bonus", "fixed45"])("fails closed for an illegal %s engine result", async (fault) => {
    mocks.compare.mockImplementation(async (input: CharacterBuild) => {
      const result = resultFor(input);
      if (fault === "base") result.boss.build.skill_ranks["flame-arrow"] = 10;
      if (fault === "variant") result.aoe.variants[0].build.skill_ranks["flame-arrow"] = 10;
      if (fault === "specialty") result.leveling.variants[0].build.specs["flame-arrow"] = [0];
      if (fault === "stigma") result.burst.build.stigmas = ["steel-barrier"];
      if (fault === "daevanion") result.boss.daevanion_path = [6101];
      if (fault === "bonus") result.leveling.variants[0].build.bonus_ranks["flame-arrow"] = 1;
      if (fault === "fixed45") result.boss.build.level = 45;
      return result;
    });
    await at();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("The returned plan is not valid");
    expect(screen.queryByTestId("results")).toBeNull();
    expect(screen.queryByRole("button", { name: "Use plan" })).toBeNull();
    expect(mocks.storePlannedBuild).not.toHaveBeenCalled();
  });

  it("validates Daevanion spending against zero while the quest is unchecked", async () => {
    const gd = dataByClass.sorcerer.gd!;
    const board = Object.values(gd.daevanion).find((entry) => entry.unlock_level === 12)!;
    const paidNode = board.nodes[String(board.start_id)].adjacent.find((id) => board.nodes[String(id)]?.cost > 0)!;
    mocks.compare.mockImplementation(async (input: CharacterBuild) => {
      const result = resultFor(input);
      result.boss.build.daevanion_nodes = [board.start_id, paidNode];
      return result;
    });
    await at();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent(/Daevanion plan costs .*; 0 available/);
    expect(screen.queryByTestId("results")).toBeNull();
  });

  it.each(["boss", "aoe", "leveling", "burst"] as const)("blocks locked Hellfire in the %s priority even when every rank build is valid", async (playstyle) => {
    mocks.compare.mockImplementation(async (input: CharacterBuild) => {
      const result = resultFor(input);
      const budget = { ...levelBudget(input.level)!, stigma: 0, daevanion: 0 };
      for (const fb of Object.values(result)) {
        expect(validateLevelPlan(fb.build, budget, false, dataByClass.sorcerer.gd!)).toEqual([]);
      }
      result[playstyle].priority.entries.push({ skill_key: "hellfire", charge_level: 0, require_status: null });
      return result;
    });
    await at();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent(`${playstyle}: hellfire: rotation skill unavailable`);
    expect(screen.queryByTestId("results")).toBeNull();
    expect(screen.queryByRole("button", { name: "Use plan" })).toBeNull();
    expect(mocks.storePlannedBuild).not.toHaveBeenCalled();
  });

  it("accepts a level-12 plan whose priority contains only acquired Firestorm and Flame Arrow", async () => {
    await at();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
    await submit();
    expect(screen.getByTestId("results")).toHaveTextContent("boss DPS 112");
    fireEvent.click(screen.getByRole("button", { name: "Use plan" }));
    expect(mocks.storePlannedBuild.mock.calls[0][0].priority.entries.map((entry: { skill_key: string }) => entry.skill_key))
      .toEqual(["firestorm", "flame-arrow"]);
  });

  it("collapses long validation breakdowns while retaining every issue under the alert headline", async () => {
    mocks.compare.mockImplementation(async (input: CharacterBuild) => {
      const result = resultFor(input);
      for (const fb of Object.values(result)) {
        fb.priority.entries.push({ skill_key: "hellfire", charge_level: 0, require_status: null });
      }
      return result;
    });
    await at();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
    await submit();
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("The returned plan is not valid for these progression inputs.")).toBeVisible();
    const summary = within(alert).getByText("Validation details (4)");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(within(alert).getByRole("list")).not.toBeVisible();
    for (const playstyle of ["boss", "aoe", "leveling", "burst"]) {
      expect(alert).toHaveTextContent(`${playstyle}: hellfire: rotation skill unavailable`);
    }
    fireEvent.click(summary);
    expect(within(alert).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.queryByTestId("results")).toBeNull();
  });

  it("validates stigma spending against zero while the quest is unchecked", async () => {
    mocks.compare.mockImplementation(async (input: CharacterBuild) => {
      const result = resultFor(input);
      result.boss.build.stigmas = ["steel-barrier"];
      return result;
    });
    await at();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent(/Stigma plan costs .*; 0 available/);
    expect(screen.queryByTestId("results")).toBeNull();
  });

  it("renders class-data errors explicitly and prevents a solve", async () => {
    dataByClass.sorcerer = { gd: null, icons: {}, error: "Engine data failed" };
    await at();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load class data: Engine data failed");
    expect(screen.queryByText("Loading class data...")).toBeNull();
    expect(screen.getByRole("button", { name: /Find my best build/ })).toBeDisabled();
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it("invalidates stale results if a reused planner receives a new guideClass", async () => {
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<MemoryRouter><ManualBuild guideClass="sorcerer" /></MemoryRouter>);
    });
    await submit();
    view.rerender(<MemoryRouter><ManualBuild guideClass="gladiator" /></MemoryRouter>);
    expect(screen.queryByTestId("results")).toBeNull();
    await debounce();
    expect(mocks.compare).toHaveBeenCalledTimes(2);
    expect(mocks.compare.mock.calls[1][0].class_key).toBe("gladiator");
    expect(screen.getByTestId("results")).toHaveTextContent("leveling DPS");
  });

  it.each(["tab", "core link"])("preserves guide inputs and results when returning from the encyclopedia via %s", async (navigation) => {
    await atCodex();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
    fireEvent.click(screen.getByText("Combat stats"));
    fireEvent.change(screen.getByLabelText("Attack"), { target: { value: "1234" } });
    fireEvent.click(screen.getByText("Earned rewards"));
    for (const [key, value] of [["skill", 3], ["stigma", 2], ["daevanion", 5]]) {
      fireEvent.change(screen.getByLabelText(`Extra ${key} points`), { target: { value } });
    }
    await submit();
    expect(screen.getByTestId("results")).toHaveTextContent("leveling DPS 112");
    if (navigation === "core link") {
      fireEvent.click(screen.getByText(/^Core skills \(/));
      await act(async () => { fireEvent.click(screen.getByRole("link", { name: /Flame Arrow/ })); });
    } else {
      fireEvent.mouseDown(screen.getByRole("tab", { name: "Skill encyclopedia" }), { button: 0, ctrlKey: false });
    }
    expect(screen.getByText("Skill encyclopedia content")).toBeVisible();
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.queryByRole("button", { name: "Use plan" })).toBeNull();
    expect(screen.getByTestId("results")).not.toBeVisible();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Class guide" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("slider")).toHaveValue("12");
    expect(screen.getByLabelText("Attack")).toHaveValue(1234);
    for (const [key, value] of [["skill", 3], ["stigma", 2], ["daevanion", 5]]) {
      expect(screen.getByLabelText(`Extra ${key} points`)).toHaveValue(value);
    }
    expect(screen.getByTestId("results")).toBeVisible();
    expect(screen.getByTestId("results")).toHaveTextContent("leveling DPS 112");
    await debounce();
    expect(mocks.compare).toHaveBeenCalledTimes(1);
  });

  it("remounts the Codex guide for a different class without retaining the previous character's inputs or result", async () => {
    await atCodex();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Extra skill points"), { target: { value: "3" } });
    await submit();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Gladiator" })); });
    expect(screen.getByRole("slider")).toHaveValue("45");
    expect(screen.getByLabelText("Extra skill points")).toHaveValue(0);
    expect(screen.queryByTestId("results")).toBeNull();
    await debounce();
    expect(mocks.compare).toHaveBeenCalledTimes(1);
  });

  it("previews exact core unlocks and the next level without calling compare", async () => {
    await at();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "2" } });
    fireEvent.click(screen.getByText(/^Core skills \(/));
    const current = screen.getByRole("list", { name: "Core skills at level 2" });
    expect(within(current).getByRole("link", { name: /Flame Arrow/ })).toHaveAttribute("href", "/codex/sorcerer?skill=flame-arrow");
    expect(within(current).queryByRole("link", { name: /Bittercold Wind/ })).toBeNull();
    expect(within(screen.getByRole("list", { name: "Core skills unlocking at level 3" })).getByRole("link", { name: /Bittercold Wind/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "3" } });
    expect(within(screen.getByRole("list", { name: "Core skills at level 3" })).getByRole("link", { name: /Bittercold Wind/ })).toBeInTheDocument();
    await debounce();
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it("reuses the planner for a guide, selects Leveling, collapses stats, and hands the selected plan to Keybinds", async () => {
    await at("sorcerer");
    expect(screen.queryByRole("heading", { name: "Manual build" })).toBeNull();
    expect(screen.getByText("Combat stats").closest("details")).not.toHaveAttribute("open");
    await submit();
    expect(screen.getByTestId("results")).toHaveTextContent("leveling DPS");
    fireEvent.click(screen.getByRole("button", { name: "Select AoE" }));
    expect(screen.getByTestId("results")).toHaveTextContent("aoe DPS");
    fireEvent.click(screen.getByRole("button", { name: "Use plan" }));
    expect(mocks.storePlannedBuild).toHaveBeenCalledTimes(1);
    expect(mocks.storePlannedBuild.mock.calls[0][0].playstyle.key).toBe("aoe");
    expect(screen.getByText("Keybind destination")).toBeInTheDocument();
  });
});
