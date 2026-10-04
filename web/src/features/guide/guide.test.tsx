import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import importFx from "@/fixtures/import_character.json";
import { ACTIVE_BUILD_KEY } from "@/features/keybinds/activeBuild";
import { GuidePage } from "@/pages/Guide";
import type { CharacterBuild } from "@/lib/types";
import { classSkills } from "./ChapterCard";
import { CHAPTERS, chapterForLevel } from "./chapters";
import { nextMilestones, nextSteps, skillPointCost } from "./personal";

const fixtureBuild = importFx.build as unknown as CharacterBuild;

function renderGuide(path = "/guide") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GuidePage />
    </MemoryRouter>,
  );
}

beforeEach(() => localStorage.clear());

describe("guide logic", () => {
  it("maps levels to chapters", () => {
    expect(chapterForLevel(1).id).toBe("lv-1-10");
    expect(chapterForLevel(10).id).toBe("lv-10-20");
    expect(chapterForLevel(44).id).toBe("lv-40-45");
    expect(chapterForLevel(45).id).toBe("endgame");
    expect(CHAPTERS.map((c) => c.lo)).toEqual([1, 10, 20, 30, 40, 45]);
  });
  it("skill point cost matches the 21-point total to rank 10", () => {
    expect(skillPointCost(4)).toBe(3);
    expect(skillPointCost(8)).toBe(13);
    expect(skillPointCost(10)).toBe(21);
  });
  it("lists the next unlocks above your level", () => {
    expect(nextMilestones(44).map((m) => m.level)).toEqual([45]);
    expect(nextMilestones(21)[0].level).toBe(22);
  });
  it("builds three steps, with the stigma slot countdown and Daevanion board progress", () => {
    const steps = nextSteps({ ...fixtureBuild, level: 30, skill_points: 3 }, [{ key: "zikel", name: "Zikel", unlockLevel: 20, open: true, used: 0, total: 88 }]);
    expect(steps).toHaveLength(3);
    expect(steps[0].title).toBe("Spend your 3 unspent skill points");
    expect(steps[1].title).toBe("Your next stigma slot opens at level 32");
    expect(steps[2].title).toBe("Daevanion: Zikel board 0/88 open");
  });
});

describe("class skills in a band", () => {
  it("parses road map text, keeping colons inside skill names", () => {
    const mk = (level: number, text: string) => ({ level, kind: "skill" as const, text, regions: ["global" as const] });
    const out = classSkills([mk(22, "Unlock Curse: Tree"), mk(21, "Sorcerer skill unlock: Grace of Enhancement"), mk(1, "Sorcerer skill unlock: A, B")], CHAPTERS[2]);
    expect(out.map((s) => s.name)).toEqual(["Curse: Tree", "Grace of Enhancement"]);
  });
});

describe("GuidePage", () => {
  it("renders the journey: first hour, chapters, systems, endgame and sources", async () => {
    renderGuide();
    expect(screen.getByRole("heading", { level: 1, name: "New player guide" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Your first hour" })).toBeInTheDocument();
    for (const c of CHAPTERS) expect(screen.getByRole("heading", { level: 3, name: new RegExp(c.title.slice(0, 12)) })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Systems explained/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Endgame overview/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Sources and what is unconfirmed/ })).toBeInTheDocument();
    expect(screen.getAllByText(/Why it matters/).length).toBe(7);
    // 8 class cards, one per launch class
    const first = screen.getByRole("heading", { level: 2, name: "Your first hour" }).closest("section")!;
    expect(within(first).getAllByRole("button", { name: /(Gladiator|Templar|Assassin|Ranger|Sorcerer|Spiritmaster|Cleric|Chanter)/ })).toHaveLength(8);
  });

  it("chapters collapse and expand", async () => {
    renderGuide();
    const btn = screen.getByRole("button", { name: /Levels 20-30: stigmas/ });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Level 22: stigma skills/)).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText(/Level 22: stigma skills/)).not.toBeInTheDocument();
  });

  it("opens the chapter named in the link", async () => {
    renderGuide("/guide?chapter=lv-30-40");
    expect(screen.getByRole("button", { name: /Levels 30-40/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("is personal when a character is stored: you are here, next unlocks, three steps", async () => {
    localStorage.setItem(ACTIVE_BUILD_KEY, JSON.stringify({ ...fixtureBuild, level: 44 }));
    renderGuide();
    expect(await screen.findByRole("heading", { level: 2, name: /You are here: level 44/ })).toBeInTheDocument();
    expect(screen.getByText(/Daevanion board 5: Azphel/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Levels 40-45/ })).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText(/Daevanion: .* board \d+\/\d+ open/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText("Your 3 next steps")).toBeInTheDocument();
    expect(screen.getByText(/All 4 stigma slots are full/)).toBeInTheDocument();
  });
});

describe("navigation", () => {
  it("has a Start here link in the main nav and a guide route", () => {
    render(
      <MemoryRouter initialEntries={["/guide"]}>
        <App />
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Start here" })).toHaveAttribute("href", "/guide");
    expect(screen.getByRole("heading", { level: 1, name: "New player guide" })).toBeInTheDocument();
  });
  it("home hero offers the guide to new players", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /New to Aion 2\? Start here/ })).toHaveAttribute("href", "/guide");
  });
});
