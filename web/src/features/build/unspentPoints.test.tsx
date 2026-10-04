import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import points36 from "@/fixtures/compare_points36.json";
import importFx from "@/fixtures/import_character.json";
import type { CharacterBuild, CompareResult } from "@/lib/types";
import { Character } from "@/pages/Character";
import { PlaystyleDetail, groupRankLog } from "./PlaystyleDetail";
import { applyPoints, loadPoints, parsePoints, pointsKey, savePoints } from "./unspentPoints";

const compareSpy = vi.hoisted(() => vi.fn());
vi.mock("@/engine/api", async (orig) => {
  const m = await orig<typeof import("@/engine/api")>();
  return {
    ...m,
    compare: (...a: Parameters<typeof m.compare>) => {
      compareSpy(...a);
      return m.compare(...a);
    },
  };
});

const cmp36 = points36 as unknown as CompareResult;
const KEY = pointsKey("nae", "2103", "DarthThot");

describe("unspent points helpers", () => {
  beforeEach(() => localStorage.clear());

  it("parses blank/junk as none and applies to the build", () => {
    expect(parsePoints("")).toBeNull();
    expect(parsePoints("abc")).toBeNull();
    expect(parsePoints("0")).toBeNull();
    expect(parsePoints("36")).toBe(36);
    const b = (importFx as unknown as { build: CharacterBuild }).build;
    expect(applyPoints(b, { skill: "36", stigma: "" })).toMatchObject({ skill_points: 36, stigma_points: null });
  });

  it("persists per character and clears when emptied", () => {
    savePoints(KEY, { skill: "36", stigma: "5" });
    expect(loadPoints(KEY)).toEqual({ skill: "36", stigma: "5" });
    expect(loadPoints(pointsKey("nae", "2103", "Other"))).toEqual({ skill: "", stigma: "" });
    expect(KEY).toBe(pointsKey("nae", "2103", "darththot")); // name is case-insensitive
    savePoints(KEY, { skill: "", stigma: "" });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("groups the real rank_log by skill", () => {
    const g = Object.fromEntries(groupRankLog(cmp36.boss.rank_log).map((b) => [b.key, b]));
    expect([g.hellfire.from, g.hellfire.to]).toEqual([5, 10]);
    expect([g["frost-burst"].from, g["frost-burst"].to]).toEqual([2, 8]);
    expect(g.blaze.to).toBe(10);
    expect(g["bittercold-wind"].to).toBe(8);
    expect(Object.values(g).reduce((n, b) => n + b.cost, 0)).toBe(36);
  });
});

describe("PlaystyleDetail skill points section", () => {
  const data = { gd: null, icons: {} };
  const show = (fb: CompareResult["boss"]) => render(<PlaystyleDetail fb={fb} data={data} variantKey="max" onVariant={() => {}} />);

  it("lists purchases grouped by skill with the total", () => {
    show(cmp36.boss);
    const box = screen.getByTestId("rank-log");
    expect(box).toHaveTextContent("Spend your 36 points:");
    expect(box).toHaveTextContent(/Hellfire\s*rank 5 → 10/);
    expect(box).toHaveTextContent(/Frost burst\s*rank 2 → 8/);
    expect(box).toHaveTextContent("Uses 36 of 36 skill points.");
    expect(box).toHaveTextContent(/\+\d+\.\d% DPS/);
  });

  it("says so when points are entered but nothing is worth buying", () => {
    const fb = { ...cmp36.boss, rank_log: [] };
    show(fb);
    expect(screen.getByText(/Nothing is worth buying/)).toBeInTheDocument();
  });

  it("points at the input when no points are entered", () => {
    const fb = { ...cmp36.boss, rank_log: [], build: { ...cmp36.boss.build, skill_points: null } };
    show(fb);
    expect(screen.getByText(/Enter your unspent skill points above/)).toBeInTheDocument();
  });
});

describe("Character page unspent points", () => {
  beforeEach(() => {
    localStorage.clear();
    compareSpy.mockClear();
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/c/nae/2103/DarthThot"]}>
        <Routes>
          <Route path="/c/:region/:serverId/:name" element={<Character />} />
        </Routes>
      </MemoryRouter>,
    );

  it("re-runs compare with the typed points (debounced) and persists them", async () => {
    renderPage();
    const input = await screen.findByLabelText("Skill points", undefined, { timeout: 5000 });
    await waitFor(() => expect(compareSpy).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(compareSpy.mock.calls[0][0].skill_points).toBeNull();
    await screen.findByTestId("playstyle-detail", undefined, { timeout: 5000 });

    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.change(input, { target: { value: "36" } });
    expect(compareSpy).toHaveBeenCalledTimes(1); // debounced
    await waitFor(() => expect(compareSpy).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(compareSpy.mock.calls[1][0]).toMatchObject({ skill_points: 36, stigma_points: null });
    expect(loadPoints(KEY).skill).toBe("36");
  });

  it("restores saved points on load and sends them with the first compare", async () => {
    savePoints(KEY, { skill: "12", stigma: "4" });
    renderPage();
    expect(await screen.findByLabelText("Skill points", undefined, { timeout: 5000 })).toHaveValue(12);
    await waitFor(() => expect(compareSpy).toHaveBeenCalled(), { timeout: 5000 });
    expect(compareSpy.mock.calls[0][0]).toMatchObject({ skill_points: 12, stigma_points: 4 });
  });
});
