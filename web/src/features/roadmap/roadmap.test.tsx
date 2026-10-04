import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import roadmapFx from "@/fixtures/roadmap.json";
import { RoadmapPage } from "@/pages/Roadmap";
import { groupByLevel, groupStates, progress } from "./levels";
import type { RoadmapItem } from "@/lib/types";

const items = roadmapFx as unknown as RoadmapItem[];

describe("road map levels", () => {
  const groups = groupByLevel(items);
  it("groups by level ascending", () => {
    const lv = groups.map((g) => g.level);
    expect(lv).toEqual([...lv].sort((a, b) => a - b));
    expect(new Set(lv).size).toBe(lv.length);
  });
  it("marks the last unlocked level as current and the next one as next", () => {
    const st = groupStates(groups, 44);
    expect(st.filter((s) => s === "current")).toHaveLength(1);
    expect(groups[st.indexOf("current")].level).toBe(40);
    expect(groups[st.indexOf("next")].level).toBe(45);
    expect(groupStates(groups, 0).includes("current")).toBe(false);
  });
  it("counts progress", () => {
    const p = progress(items, 44);
    expect(p.nextLevel).toBe(45);
    expect(p.unlocked + items.filter((i) => i.level > 44).length).toBe(items.length);
    expect(progress(items, 99).nextLevel).toBeNull();
  });
});

describe("RoadmapPage (mock engine)", () => {
  it("highlights the character's band", async () => {
    localStorage.clear();
    render(
      <MemoryRouter>
        <RoadmapPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Your current band/i, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/Next unlock/i)).toBeInTheDocument();
    // same journey as the guide: chapter headings link into it
    expect(screen.getAllByRole("link", { name: "Open guide chapter" })[0]).toHaveAttribute("href", expect.stringContaining("/guide?chapter="));
    expect(screen.getByRole("navigation", { name: "Your journey" })).toBeInTheDocument();
  });
});
