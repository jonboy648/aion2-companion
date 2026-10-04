import { fireEvent, render } from "@testing-library/react";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { DaevanionBoard } from "@/lib/types";
import { ART, frameGrade, nodeFrame, startIcon } from "./art";
import { BoardSvg } from "./BoardSvg";

const pub = (u: string) => resolve(__dirname, "../../../public", u.replace(/^\//, ""));

describe("daevanion art mapping", () => {
  it("maps our rarities to the client's frame grades (our Epic = client Legend)", () => {
    expect(frameGrade("Common")).toBe("common");
    expect(frameGrade("Rare")).toBe("rare");
    expect(frameGrade("Epic")).toBe("legend");
    expect(frameGrade("Unique")).toBe("unique");
    expect(frameGrade("")).toBe("common");
  });

  it("uses the open frame only for selected nodes", () => {
    expect(nodeFrame("Epic", "selected")).toMatch(/node-legend-open\.webp$/);
    expect(nodeFrame("Epic", "available")).toMatch(/node-legend\.webp$/);
    expect(nodeFrame("Rare", "locked")).toMatch(/node-rare\.webp$/);
    expect(nodeFrame("Common", "start")).toMatch(/node-start\.webp$/);
    expect(startIcon("sorcerer")).toMatch(/start-sorcerer\.webp$/);
    expect(startIcon("unknown")).toBeNull();
  });

  it("every referenced asset ships in public/daevanion", () => {
    const urls = [...Object.values(ART), startIcon("cleric")!, startIcon("spiritmaster")!];
    for (const g of ["common", "rare", "legend", "unique"]) urls.push(`/daevanion/node-${g}.webp`, `/daevanion/node-${g}-open.webp`);
    for (const u of urls) expect(existsSync(pub(u)), u).toBe(true);
  });
});

const node = (id: number, x: number, y: number, adjacent: number[], extra: object = {}) => ({
  id, x, y, adjacent, name: `N${id}`, rarity: "Rare", cost: 2, node_type: "stat", skill_key: null, ...extra,
});

const board = {
  key: "nezekan",
  name: "Nezekan",
  start_id: 1,
  unlock_level: 1,
  nodes: {
    "1": node(1, 8, 8, [2]),
    "2": node(2, 9, 8, [1, 3], { rarity: "Epic" }),
    "3": node(3, 10, 8, [2]),
  },
} as unknown as DaevanionBoard;

function draw(selected: number[], available: number[], extra: object = {}) {
  return render(
    <BoardSvg
      board={board}
      selected={new Set(selected)}
      available={new Set(available)}
      locked={false}
      icons={{}}
      focusId={null}
      onToggle={() => {}}
      onFocus={() => {}}
      classKey="sorcerer"
      {...extra}
    />,
  );
}

describe("BoardSvg game art", () => {
  it("draws game frames per state, class icon on start, and lit bridges", () => {
    const { container } = draw([2], [3], { suggested: new Set([3]) });
    const svg = container.querySelector('[data-testid="daevanion-board"]')!;
    expect(svg.getAttribute("data-art")).toBe("game");
    const frame = (id: number) => svg.querySelector(`[data-node-id="${id}"] [data-art-role="frame"]`)!.getAttribute("href");
    expect(frame(2)).toMatch(/node-legend-open/);
    expect(frame(3)).toMatch(/node-rare\.webp/);
    expect(frame(1)).toMatch(/node-start/);
    expect(svg.querySelector('[data-node-id="1"] [data-art-role="class-icon"]')!.getAttribute("href")).toMatch(/start-sorcerer/);
    expect(svg.querySelector('[data-node-id="2"] [data-art-role="selected-glow"]')).toBeTruthy();
    expect(svg.querySelector('[data-node-id="3"] [data-art-role="available"]')).toBeTruthy();
    expect(svg.querySelector('[data-node-id="3"] [data-art-role="suggested"]')).toBeTruthy();
    expect(svg.querySelectorAll('[data-edge="lit"]').length).toBe(1);
    expect(svg.querySelectorAll('[data-edge="dim"]').length).toBe(1);
  });

  it("shows a focus ring on the focused node", () => {
    const { container } = draw([], [2], { focusId: 2 });
    expect(container.querySelector('[data-node-id="2"] [data-art-role="focus"]')).toBeTruthy();
  });

  it("falls back to the drawn shapes when an image fails to load", () => {
    const { container } = draw([], [2]);
    const svg = container.querySelector('[data-testid="daevanion-board"]')!;
    fireEvent.error(svg.querySelector('[data-art-role="frame"]')!);
    expect(svg.getAttribute("data-art")).toBe("fallback");
    expect(svg.querySelector('[data-art-role="frame"]')).toBeNull();
    expect(svg.querySelector('[data-node-id="2"]')!.getAttribute("data-state")).toBe("available");
  });
});
