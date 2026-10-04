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
    expect(screen.queryByRole("heading", { name: /Systems explained/ })).not.toBeInTheDocument();
    const first = screen.getByRole("heading", { level: 2, name: "Your first hour" }).closest("section")!;
    expect(within(first).getAllByRole("button", { name: /(Gladiator|Templar|Assassin|Ranger|Sorcerer|Spiritmaster|Cleric|Chanter)/ })).toHaveLength(8);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Level journey" }), { button: 0, ctrlKey: false });
    await screen.findByRole("heading", { name: "The journey, level by level" });
    for (const c of CHAPTERS) expect(screen.getByRole("heading", { level: 3, name: new RegExp(c.title.slice(0, 12)) })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Game systems" }), { button: 0, ctrlKey: false });
    expect(await screen.findByRole("heading", { level: 2, name: /Systems explained/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Endgame overview/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Sources and what is unconfirmed/ })).toBeInTheDocument();
    expect(screen.getAllByText(/Why it matters/).length).toBe(7);
  });

  it("chapters collapse and expand", async () => {
    renderGuide();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Level journey" }), { button: 0, ctrlKey: false });
    await screen.findByRole("heading", { name: "The journey, level by level" });
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

  it("continues from the first hour into the level journey", async () => {
    renderGuide();
    fireEvent.click(screen.getByRole("button", { name: "Continue to the journey" }));
    expect(await screen.findByRole("heading", { name: "The journey, level by level" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your first hour" })).not.toBeInTheDocument();
  });

  it("restores the linked systems view without rendering the class picker", () => {
    renderGuide("/guide?view=systems");
    expect(screen.getByRole("tab", { name: "Game systems" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Systems explained simply" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "1. Pick a class" })).not.toBeInTheDocument();
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
    const hero = screen.getByRole("region", { name: "Character lookup" });
    expect(within(hero).getByRole("link", { name: "Start here" })).toHaveAttribute("href", "/guide");
  });
});
