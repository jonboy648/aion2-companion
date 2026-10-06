import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import gdFx from "@/fixtures/gamedata_sorcerer.json";
import compareFx from "@/fixtures/compare.json";
import { levelBudget, validateLevelPlan } from "@/features/progression/progression";
import type { ClassData } from "@/features/build/useClassData";
import type { CharacterBuild, CompareResult, FullBuild, GameData, PlaystyleKey } from "@/lib/types";
import { ManualBuild } from "./ManualBuild";
import { CodexPage } from "./Codex";

const mocks = vi.hoisted(() => ({ compare: vi.fn(), optimize: vi.fn(), listClasses: vi.fn(), storePlannedBuild: vi.fn(),
  resultProps: vi.fn(), quickslotProps: vi.fn() }));
vi.mock("@/engine/api", () => ({ compare: mocks.compare, optimize: mocks.optimize, listClasses: mocks.listClasses }));
vi.mock("@/features/keybinds/activeBuild", () => ({ storePlannedBuild: mocks.storePlannedBuild }));
vi.mock("@/features/codex/CodexView", () => ({ CodexView: () => <p>Skill encyclopedia content</p> }));
const dataByClass: Record<string, ClassData> = Object.fromEntries(["sorcerer", "gladiator"].map((key) => [key, {
  gd: { ...gdFx, class_key: key } as unknown as GameData, icons: {},
}]));
vi.mock("@/features/build/useClassData", () => ({ useClassData: (key: string) => dataByClass[key] }));
vi.mock("@/features/build/BuildResults", () => ({
  ProgressPanel: ({ message }: { message: string }) => <div role="status">{message}</div>,
  SingleBuildResults: (props: {
    fb: FullBuild; data: ClassData; onUsePlan: (fb: FullBuild) => void; onVariantChange?: (key: string) => void; disabled?: boolean;
  }) => {
    const [variant, setVariant] = useState("max");
    mocks.resultProps(props);
    return <div data-testid="results" aria-disabled={props.disabled}>
      <span>{props.fb.playstyle.key} DPS {props.fb.result.dps}</span>
      <button disabled={props.disabled || variant !== "max" || props.fb.playstyle.key === "burst"}
        onClick={() => props.onUsePlan(props.fb)}>Use plan</button>
      <button disabled={props.disabled} onClick={() => { setVariant("safe"); props.onVariantChange?.("safe"); }}>
        Select Safe arrangement
      </button>
      <button disabled={props.disabled} onClick={() => { setVariant("max"); props.onVariantChange?.("max"); }}>
        Select DPS arrangement
      </button>
    </div>;
  },
}));
vi.mock("@/features/progression/GuideQuickslots", () => ({
  GuideQuickslots: (props: { fb: FullBuild; data: ClassData; disabled?: boolean }) => {
    mocks.quickslotProps(props);
    return <div data-testid="quickslots" aria-disabled={props.disabled}>Quickslots for {props.fb.playstyle.key}</div>;
  },
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
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Calculate plan" })); });
}
async function idle() {
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
}

function plannerForm() {
  const button = screen.getByRole("button", { name: /Calculate plan|Calculating/ });
  return document.getElementById(button.getAttribute("form")!)!;
}

function selectPlaystyle(key: PlaystyleKey) {
  const labels = { boss: "Boss", aoe: "AoE", leveling: "Leveling", burst: "Burst" };
  fireEvent.click(within(screen.getByRole("group", { name: "Playstyle" })).getByRole("button", { name: labels[key] }));
}

async function atCodex(entry = "/codex/sorcerer") {
  await act(async () => {
    render(<MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/codex/:classKey" element={<CodexPage />} /></Routes>
    </MemoryRouter>);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  dataByClass.sorcerer = { gd: { ...gdFx, class_key: "sorcerer" } as unknown as GameData, icons: {}, error: null };
  mocks.compare.mockReset();
  mocks.optimize.mockReset().mockImplementation(async (build: CharacterBuild, key: PlaystyleKey) => resultFor(build)[key]);
  mocks.listClasses.mockReset().mockResolvedValue([
    { key: "sorcerer", name: "Sorcerer", role: "ranged_dps" },
    { key: "gladiator", name: "Gladiator", role: "melee_dps" },
  ]);
  mocks.storePlannedBuild.mockReset();
  mocks.resultProps.mockReset();
  mocks.quickslotProps.mockReset();
});
afterEach(() => { cleanup(); vi.useRealTimers(); expect(mocks.compare).not.toHaveBeenCalled(); });

describe("level-aware manual and class planner", () => {
  it.each(["boss", "aoe", "leveling", "burst"] as const)("calculates only the selected %s playstyle on submit", async (key) => {
    await at();
    expect(mocks.optimize).not.toHaveBeenCalled();
    selectPlaystyle(key);
    await idle();
    expect(mocks.optimize).not.toHaveBeenCalled();
    await submit();
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
    expect(mocks.optimize.mock.calls[0][1]).toBe(key);
    expect(mocks.compare).not.toHaveBeenCalled();
    expect(screen.getByTestId("results")).toHaveTextContent(`${key} DPS 145`);
  });

  it("does not queue a calculation when the level preview changes", async () => {
    await at();
    await submit();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    await idle();
    expect(mocks.compare.mock.calls.length + mocks.optimize.mock.calls.length).toBe(1);
  });
  it("keeps Daevanion beside skills and puts quickslots below with the complete analysis", async () => {
    await at("sorcerer");
    expect(screen.getByRole("region", { name: "Progression plan" })).toBeInTheDocument();
    expect(screen.getByText("No calculated plan")).toBeInTheDocument();
    await submit();
    const workspace = screen.getByRole("region", { name: "Progression plan" });
    expect(within(workspace).getByRole("region", { name: "Core skills" })).toBeInTheDocument();
    expect(within(workspace).queryByTestId("quickslots")).not.toBeInTheDocument();
    expect(screen.getByTestId("quickslots")).toBeInTheDocument();
    expect(within(workspace).queryByTestId("results")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Calculated build plan" })).getByTestId("results")).toBeInTheDocument();
  });

  it("accepts future Daevanion guidance when the locked build purchases no nodes", async () => {
    mocks.optimize.mockImplementation(async (input: CharacterBuild, key: PlaystyleKey) => {
      const result = resultFor(input)[key];
      result.daevanion_path = [6101];
      return result;
    });
    await at();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
    await submit();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("results")).toBeInTheDocument();
  });
  it("starts at Global 45 with cumulative totals, zero extras and both quests unchecked", async () => {
    await at();
    expect(screen.getByRole("slider")).toHaveAttribute("min", "1");
    expect(screen.getByRole("slider")).toHaveAttribute("max", "45");
    expect(screen.getByLabelText("Level (1 to 45)")).toHaveValue("45");
    expect(screen.getByText("203")).toBeInTheDocument();
    expect(screen.getByText("136")).toBeInTheDocument();
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).not.toBeChecked();
    for (const key of ["skill", "stigma", "daevanion"]) expect(screen.getByLabelText(`Extra ${key} points`)).toHaveValue(0);
    await idle();
    expect(mocks.optimize).not.toHaveBeenCalled();
    expect(mocks.quickslotProps).not.toHaveBeenCalled();
    await submit();
    expect(mocks.optimize.mock.calls[0][0]).toMatchObject({ level: 45, skill_points: 203, stigma_points: 0 });
    expect(mocks.optimize.mock.calls[0][2]).toBe(0);
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
    expect(mocks.optimize.mock.calls[0][0]).toMatchObject({ level: 30, skill_points: 118, stigma_points: 11 });
    expect(mocks.optimize.mock.calls[0][2]).toBe(0);
    fireEvent.click(screen.getByRole("checkbox", { name: /Daevanion unlock/ }));
    expect(screen.getByTestId("results")).toHaveTextContent("boss DPS 130");
    expect(screen.getByRole("button", { name: "Use plan" })).toBeDisabled();
    await idle();
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
    await submit();
    expect(mocks.optimize.mock.calls[1][2]).toBe(81);
    expect(screen.getByRole("button", { name: "Use plan" })).toBeEnabled();
  });

  it.each(["level", "stat", "earned", "stigma", "daevanion", "race"])("retains the previous plan disabled after %s changes until explicit recalculation", async (input) => {
    await at();
    await submit();
    const oldPlan = mocks.resultProps.mock.calls.at(-1)![0].fb;
    if (input === "level") fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    if (input === "stat") fireEvent.change(screen.getByLabelText("Attack"), { target: { value: "1234" } });
    if (input === "earned") fireEvent.change(screen.getByLabelText("Extra skill points"), { target: { value: "7" } });
    if (input === "stigma") fireEvent.click(screen.getByRole("checkbox", { name: /Stigma unlock/ }));
    if (input === "daevanion") fireEvent.click(screen.getByRole("checkbox", { name: /Daevanion unlock/ }));
    if (input === "race") fireEvent.click(screen.getByRole("button", { name: "elyos" }));
    expect(screen.getByTestId("results")).toHaveTextContent("boss DPS 145");
    expect(screen.getByText("Out of date")).toBeInTheDocument();
    expect(mocks.resultProps.mock.calls.at(-1)![0]).toMatchObject({ fb: oldPlan, disabled: true });
    expect(mocks.quickslotProps.mock.calls.at(-1)![0]).toMatchObject({ fb: oldPlan, disabled: true });
    expect(screen.getByRole("button", { name: "Use plan" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Use plan" }));
    act(() => { mocks.resultProps.mock.calls.at(-1)![0].onUsePlan(oldPlan); });
    expect(mocks.storePlannedBuild).not.toHaveBeenCalled();
    await idle();
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
    await submit();
    expect(mocks.optimize).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("results")).toHaveTextContent(input === "level" ? "boss DPS 130" : "boss DPS 145");
    expect(screen.queryByText("Out of date")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use plan" })).toBeEnabled();
    expect(screen.getByTestId("quickslots")).toHaveAttribute("aria-disabled", "false");
  });

  it("rejects invalid levels and earned rewards without calling the engine", async () => {
    await at();
    fireEvent.change(screen.getByLabelText("Level (1 to 45)"), { target: { value: "0" } });
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("Level must be a whole number from 1 to 45");
    expect(screen.queryByText(/Validation details/)).toBeNull();
    expect(mocks.optimize).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Level (1 to 45)"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Extra skill points"), { target: { value: "0.5" } });
    await idle();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent(/Earned points must be whole/);
    expect(mocks.optimize).not.toHaveBeenCalled();
  });

  it("keeps input validation visible when class data refreshes", async () => {
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<MemoryRouter><ManualBuild guideClass="sorcerer" /></MemoryRouter>);
    });
    fireEvent.change(screen.getByLabelText("Level (1 to 45)"), { target: { value: "0" } });
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("Level must be a whole number");
    dataByClass.sorcerer = { ...dataByClass.sorcerer, gd: structuredClone(dataByClass.sorcerer.gd) };
    view.rerender(<MemoryRouter><ManualBuild guideClass="sorcerer" /></MemoryRouter>);
    expect(screen.getByRole("alert")).toHaveTextContent("Level must be a whole number");
    expect(mocks.optimize).not.toHaveBeenCalled();
  });

  it("ignores a late result and progress after the level changes while pending, then re-enables Calculate", async () => {
    let resolveOld!: (result: FullBuild) => void;
    const pending = new Promise<FullBuild>((resolve) => { resolveOld = resolve; });
    mocks.optimize.mockImplementationOnce(() => pending);
    await at();
    await submit();
    const oldInput = mocks.optimize.mock.calls[0][0] as CharacterBuild;
    expect(screen.getByRole("button", { name: "Calculating..." })).toBeDisabled();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    await idle();
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Calculating..." })).toBeDisabled();
    await act(async () => {
      fireEvent.submit(plannerForm());
      fireEvent.submit(plannerForm());
    });
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
    await act(async () => {
      mocks.optimize.mock.calls[0][3]?.("Old progress");
      resolveOld(resultFor(oldInput).boss);
    });
    expect(screen.queryByTestId("results")).not.toBeInTheDocument();
    expect(mocks.quickslotProps).not.toHaveBeenCalled();
    expect(screen.queryByText("Old progress")).toBeNull();
    expect(screen.getByRole("button", { name: "Calculate plan" })).toBeEnabled();
    await idle();
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
    await submit();
    expect(mocks.optimize).toHaveBeenCalledTimes(2);
    expect(mocks.optimize.mock.calls[1][0].level).toBe(30);
    expect(screen.getByTestId("results")).toHaveTextContent("boss DPS 130");
  });

  it("does not enqueue repeated form submits while pending or invalidate the current response", async () => {
    let finish!: (result: FullBuild) => void;
    mocks.optimize.mockImplementationOnce(() => new Promise<FullBuild>((resolve) => { finish = resolve; }));
    await at();
    const form = plannerForm();
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Calculating..." })).toBeDisabled();
    await act(async () => { mocks.optimize.mock.calls[0][3]?.("Searching selected rotation"); });
    expect(screen.getByRole("status")).toHaveTextContent("Searching selected rotation");
    await act(async () => { fireEvent.submit(form); });
    const input = mocks.optimize.mock.calls[0][0] as CharacterBuild;
    const fb = resultFor(input).boss;
    await act(async () => { finish(fb); });
    expect(screen.getByTestId("results")).toHaveTextContent("boss DPS 145");
    expect(mocks.resultProps.mock.calls.at(-1)![0].fb).toBe(fb);
    expect(screen.getByRole("button", { name: "Use plan" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Calculate plan" })).toBeEnabled();
    await idle();
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
  });

  it("disables the retained result and handoff while an explicit recalculation is pending", async () => {
    await at();
    await submit();
    const oldPlan = mocks.resultProps.mock.calls.at(-1)![0].fb;
    let finish!: (result: FullBuild) => void;
    mocks.optimize.mockImplementationOnce(() => new Promise<FullBuild>((resolve) => { finish = resolve; }));
    await submit();
    expect(screen.getByTestId("results")).toHaveTextContent("boss DPS 145");
    expect(screen.getByRole("button", { name: "Use plan" })).toBeDisabled();
    expect(screen.getByTestId("quickslots")).toHaveAttribute("aria-disabled", "true");
    act(() => { mocks.resultProps.mock.calls.at(-1)![0].onUsePlan(oldPlan); });
    expect(mocks.storePlannedBuild).not.toHaveBeenCalled();
    const fb = resultFor(mocks.optimize.mock.calls[1][0]).boss;
    await act(async () => { finish(fb); });
    expect(screen.getByRole("button", { name: "Use plan" })).toBeEnabled();
    expect(mocks.resultProps.mock.calls.at(-1)![0].fb).toBe(fb);
  });

  it("keeps the selected playstyle's previous plan stale without computing until Calculate is clicked", async () => {
    await at();
    await submit();
    const oldPlan = mocks.resultProps.mock.calls.at(-1)![0].fb;
    selectPlaystyle("aoe");
    expect(screen.getByTestId("results")).toHaveTextContent("boss DPS 145");
    expect(screen.getByText("Out of date")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use plan" })).toBeDisabled();
    expect(mocks.quickslotProps.mock.calls.at(-1)![0]).toMatchObject({ fb: oldPlan, disabled: true });
    act(() => { mocks.resultProps.mock.calls.at(-1)![0].onUsePlan(oldPlan); });
    expect(mocks.storePlannedBuild).not.toHaveBeenCalled();
    await idle();
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
    await submit();
    expect(mocks.optimize).toHaveBeenCalledTimes(2);
    expect(mocks.optimize.mock.calls[1][1]).toBe("aoe");
    expect(screen.getByTestId("results")).toHaveTextContent("aoe DPS 145");
    expect(screen.getByRole("button", { name: "Use plan" })).toBeEnabled();
  });

  it("invalidates class changes and submits the new class instead of the initial form class", async () => {
    await at();
    await submit();
    fireEvent.click(screen.getByRole("button", { name: "Gladiator" }));
    expect(screen.queryByTestId("results")).toBeNull();
    expect(screen.queryByTestId("quickslots")).not.toBeInTheDocument();
    await idle();
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
    await submit();
    expect(mocks.optimize.mock.calls[1][0].class_key).toBe("gladiator");
    expect(screen.getByTestId("results")).toBeInTheDocument();
  });

  it("does not revive an old plan after switching classes and returning with refreshed game data", async () => {
    await at();
    await submit();
    const oldPlan = mocks.resultProps.mock.calls.at(-1)![0].fb;
    const originalData = dataByClass.sorcerer.gd;
    fireEvent.click(screen.getByRole("button", { name: "Gladiator" }));
    expect(screen.queryByTestId("results")).not.toBeInTheDocument();
    dataByClass.sorcerer = { ...dataByClass.sorcerer, gd: structuredClone(originalData) };
    fireEvent.click(screen.getByRole("button", { name: "Sorcerer" }));
    expect(dataByClass.sorcerer.gd).not.toBe(originalData);
    expect(screen.getByTestId("results")).toHaveTextContent("boss DPS 145");
    expect(screen.getByRole("button", { name: "Use plan" })).toBeDisabled();
    expect(screen.getByTestId("quickslots")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Out of date")).toBeInTheDocument();
    act(() => { mocks.resultProps.mock.calls.at(-1)![0].onUsePlan(oldPlan); });
    expect(mocks.storePlannedBuild).not.toHaveBeenCalled();
    await idle();
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
    await submit();
    expect(mocks.optimize).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Use plan" })).toBeEnabled();
    expect(screen.getByTestId("quickslots")).toHaveAttribute("aria-disabled", "false");
  });

  it("disables inline quickslots and handoff for a non-DPS arrangement until DPS is selected again", async () => {
    await at();
    await submit();
    const fb = mocks.resultProps.mock.calls.at(-1)![0].fb;
    fireEvent.click(screen.getByRole("button", { name: "Select Safe arrangement" }));
    expect(screen.getByRole("button", { name: "Use plan" })).toBeDisabled();
    expect(mocks.quickslotProps.mock.calls.at(-1)![0]).toMatchObject({ fb, disabled: true });
    fireEvent.click(screen.getByRole("button", { name: "Use plan" }));
    expect(mocks.storePlannedBuild).not.toHaveBeenCalled();
    await idle();
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Select DPS arrangement" }));
    expect(screen.getByRole("button", { name: "Use plan" })).toBeEnabled();
    expect(mocks.quickslotProps.mock.calls.at(-1)![0]).toMatchObject({ fb, disabled: false });
  });

  it("resets the previous arrangement when a plan for new progression inputs is calculated", async () => {
    await at();
    await submit();
    fireEvent.click(screen.getByRole("button", { name: "Select Safe arrangement" }));
    fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    expect(screen.getByRole("button", { name: "Use plan" })).toBeDisabled();
    expect(screen.getByTestId("quickslots")).toHaveAttribute("aria-disabled", "true");
    await submit();
    expect(screen.getByTestId("results")).toHaveTextContent("boss DPS 130");
    expect(screen.getByRole("button", { name: "Use plan" })).toBeEnabled();
    expect(screen.getByTestId("quickslots")).toHaveAttribute("aria-disabled", "false");
  });

  it("resets Safe to DPS and enables handoff and quickslots together after recalculating identical inputs", async () => {
    await at();
    await submit();
    const oldPlan = mocks.resultProps.mock.calls.at(-1)![0].fb;
    fireEvent.click(screen.getByRole("button", { name: "Select Safe arrangement" }));
    expect(screen.getByRole("button", { name: "Use plan" })).toBeDisabled();
    expect(screen.getByTestId("quickslots")).toHaveAttribute("aria-disabled", "true");
    await submit();
    expect(screen.queryByText("Out of date")).not.toBeInTheDocument();
    expect(mocks.optimize).toHaveBeenCalledTimes(2);
    expect(mocks.optimize.mock.calls[1][0]).toEqual(mocks.optimize.mock.calls[0][0]);
    expect(mocks.resultProps.mock.calls.at(-1)![0].fb).not.toBe(oldPlan);
    expect(screen.getByRole("button", { name: "Use plan" })).toBeEnabled();
    expect(screen.getByTestId("quickslots")).toHaveAttribute("aria-disabled", "false");
  });

  it.each(["base", "variant", "specialty", "stigma", "daevanion", "bonus", "fixed45"])("fails closed for an illegal %s engine result", async (fault) => {
    mocks.optimize.mockImplementation(async (input: CharacterBuild, key: PlaystyleKey) => {
      const result = resultFor(input)[key];
      if (fault === "base") result.build.skill_ranks["flame-arrow"] = 10;
      if (fault === "variant") result.variants[0].build.skill_ranks["flame-arrow"] = 10;
      if (fault === "specialty") result.variants[0].build.specs["flame-arrow"] = [0];
      if (fault === "stigma") result.build.stigmas = ["steel-barrier"];
      if (fault === "daevanion") result.build.daevanion_nodes = [6101];
      if (fault === "bonus") result.variants[0].build.bonus_ranks["flame-arrow"] = 1;
      if (fault === "fixed45") result.build.level = 45;
      return result;
    });
    await at();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("The returned plan is not valid");
    expect(screen.queryByTestId("results")).toBeNull();
    expect(screen.queryByRole("button", { name: "Use plan" })).toBeNull();
    expect(mocks.storePlannedBuild).not.toHaveBeenCalled();
    expect(mocks.quickslotProps).not.toHaveBeenCalled();
  });

  it("validates Daevanion spending against zero while the quest is unchecked", async () => {
    const gd = dataByClass.sorcerer.gd!;
    const board = Object.values(gd.daevanion).find((entry) => entry.unlock_level === 12)!;
    const paidNode = board.nodes[String(board.start_id)].adjacent.find((id) => board.nodes[String(id)]?.cost > 0)!;
    mocks.optimize.mockImplementation(async (input: CharacterBuild, key: PlaystyleKey) => {
      const result = resultFor(input)[key];
      result.build.daevanion_nodes = [board.start_id, paidNode];
      return result;
    });
    await at();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "30" } });
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent(/Daevanion plan costs .*; 0 available/);
    expect(screen.queryByTestId("results")).toBeNull();
  });

  it.each(["boss", "aoe", "leveling", "burst"] as const)("blocks locked Hellfire in the %s priority even when every rank build is valid", async (playstyle) => {
    mocks.optimize.mockImplementation(async (input: CharacterBuild, key: PlaystyleKey) => {
      const result = resultFor(input)[key];
      const budget = { ...levelBudget(input.level)!, stigma: 0, daevanion: 0 };
      expect(validateLevelPlan(result.build, budget, false, dataByClass.sorcerer.gd!)).toEqual([]);
      result.priority.entries.push({ skill_key: "hellfire", charge_level: 0, require_status: null });
      return result;
    });
    await at();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
    selectPlaystyle(playstyle);
    await submit();
    expect(mocks.optimize.mock.calls[0][1]).toBe(playstyle);
    expect(screen.getByRole("alert")).toHaveTextContent("hellfire: rotation skill unavailable");
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
    const unavailable = ["hellfire", "steel-barrier", "unresolved-chain-one", "unresolved-chain-two"];
    mocks.optimize.mockImplementation(async (input: CharacterBuild, key: PlaystyleKey) => {
      const result = resultFor(input)[key];
      result.priority.entries.push(...unavailable.map((skill_key) => ({ skill_key, charge_level: 0, require_status: null })));
      return result;
    });
    await at();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
    await submit();
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("The returned plan is not valid for these progression inputs.")).toBeVisible();
    const summary = within(alert).getByText("Validation details (4)");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(within(alert).getByRole("list", { hidden: true })).not.toBeVisible();
    for (const skill of unavailable) {
      expect(alert).toHaveTextContent(`${skill}: rotation skill unavailable`);
    }
    fireEvent.click(summary);
    expect(within(alert).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.queryByTestId("results")).toBeNull();
  });

  it("validates stigma spending against zero while the quest is unchecked", async () => {
    mocks.optimize.mockImplementation(async (input: CharacterBuild, key: PlaystyleKey) => {
      const result = resultFor(input)[key];
      result.build.stigmas = ["steel-barrier"];
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
    expect(screen.getByRole("button", { name: "Calculate plan" })).toBeDisabled();
    expect(mocks.optimize).not.toHaveBeenCalled();
    expect(mocks.quickslotProps).not.toHaveBeenCalled();
  });

  it("invalidates stale results if a reused planner receives a new guideClass", async () => {
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<MemoryRouter><ManualBuild guideClass="sorcerer" /></MemoryRouter>);
    });
    await submit();
    view.rerender(<MemoryRouter><ManualBuild guideClass="gladiator" /></MemoryRouter>);
    expect(screen.queryByTestId("results")).toBeNull();
    await idle();
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
    await submit();
    expect(mocks.optimize).toHaveBeenCalledTimes(2);
    expect(mocks.optimize.mock.calls[1][0].class_key).toBe("gladiator");
    expect(screen.getByTestId("results")).toHaveTextContent("leveling DPS");
  });

  it("does not compute on Codex mount, local level changes, or encyclopedia navigation", async () => {
    await atCodex();
    await idle();
    expect(mocks.optimize).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
    await idle();
    expect(mocks.optimize).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Skill encyclopedia" }), { button: 0, ctrlKey: false });
    expect(screen.getByText("Skill encyclopedia content")).toBeVisible();
    await idle();
    expect(mocks.optimize).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Class guide" }), { button: 0, ctrlKey: false });
    expect(screen.getByRole("slider")).toHaveValue("12");
    await idle();
    expect(mocks.optimize).not.toHaveBeenCalled();
    expect(mocks.quickslotProps).not.toHaveBeenCalled();
  });

  it("does not compute when Codex opens directly in the encyclopedia", async () => {
    await atCodex("/codex/sorcerer?skill=flame-arrow");
    expect(screen.getByText("Skill encyclopedia content")).toBeVisible();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    await idle();
    expect(mocks.optimize).not.toHaveBeenCalled();
    expect(mocks.quickslotProps).not.toHaveBeenCalled();
  });

  it.each(["tab", "core link"])("preserves guide inputs and results when returning from the encyclopedia via %s", async (navigation) => {
    await atCodex();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Attack"), { target: { value: "1234" } });
    fireEvent.click(screen.getByText("Earned rewards"));
    for (const [key, value] of [["skill", 3], ["stigma", 2], ["daevanion", 5]]) {
      fireEvent.change(screen.getByLabelText(`Extra ${key} points`), { target: { value } });
    }
    await submit();
    expect(screen.getByTestId("results")).toHaveTextContent("leveling DPS 112");
    if (navigation === "core link") {
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
    await idle();
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
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
    await idle();
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
  });

  it("previews exact core unlocks and the next level without computing a plan", async () => {
    await at();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "2" } });
    const current = screen.getByRole("list", { name: "Core skills at level 2" });
    expect(within(current).getByRole("link", { name: /Flame Arrow/ })).toHaveAttribute("href", "/codex/sorcerer?skill=flame-arrow");
    expect(within(current).queryByRole("link", { name: /Bittercold Wind/ })).toBeNull();
    expect(within(screen.getByRole("list", { name: "Core skills unlocking at level 3" })).getByRole("link", { name: /Bittercold Wind/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "3" } });
    expect(within(screen.getByRole("list", { name: "Core skills at level 3" })).getByRole("link", { name: /Bittercold Wind/ })).toBeInTheDocument();
    await idle();
    expect(mocks.optimize).not.toHaveBeenCalled();
    expect(mocks.quickslotProps).not.toHaveBeenCalled();
  });

  it("reuses the guide planner, defaults to Leveling, and hands the exact recalculated selection to Keybinds", async () => {
    await at("sorcerer");
    expect(screen.queryByRole("heading", { name: "Manual build" })).toBeNull();
    expect(screen.getByText("More combat stats").closest("details")).not.toHaveAttribute("open");
    expect(within(screen.getByRole("group", { name: "Playstyle" })).getByRole("button", { name: "Leveling" }))
      .toHaveAttribute("aria-pressed", "true");
    await submit();
    expect(screen.getByTestId("results")).toHaveTextContent("leveling DPS");
    selectPlaystyle("aoe");
    expect(screen.getByTestId("results")).toHaveTextContent("leveling DPS");
    expect(screen.getByRole("button", { name: "Use plan" })).toBeDisabled();
    await idle();
    expect(mocks.optimize).toHaveBeenCalledTimes(1);
    await submit();
    expect(screen.getByTestId("results")).toHaveTextContent("aoe DPS");
    const fb = await mocks.optimize.mock.results[1].value as FullBuild;
    expect(mocks.resultProps.mock.calls.at(-1)![0].fb).toBe(fb);
    expect(mocks.resultProps.mock.calls.at(-1)![0].data).toBe(dataByClass.sorcerer);
    expect(mocks.quickslotProps.mock.calls.at(-1)![0]).toMatchObject({ fb, data: dataByClass.sorcerer, disabled: false });
    fireEvent.click(screen.getByRole("button", { name: "Use plan" }));
    expect(mocks.storePlannedBuild).toHaveBeenCalledTimes(1);
    expect(mocks.storePlannedBuild).toHaveBeenCalledWith(fb);
    expect(mocks.storePlannedBuild.mock.calls[0][0]).toBe(fb);
    expect(mocks.storePlannedBuild.mock.calls[0][0].playstyle.key).toBe("aoe");
    expect(screen.getByText("Keybind destination")).toBeInTheDocument();
  });
});
