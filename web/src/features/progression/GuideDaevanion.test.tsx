import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import gdFixture from "@/fixtures/gamedata_sorcerer.json";
import type { CharacterBuild, DaevanionBoard, GameData } from "@/lib/types";
import { GuideDaevanion } from "./GuideDaevanion";

const fixture = gdFixture as unknown as GameData;
const nezekan = fixture.daevanion.nezekan;
const stat = nezekan.nodes["4831"];
const skill = nezekan.nodes["4834"];

function copyBoard(key: string, name: string, unlock_level: number, currency: DaevanionBoard["currency"], offset: number): DaevanionBoard {
  return { ...nezekan, key, name, unlock_level, currency, start_id: nezekan.start_id + offset,
    nodes: Object.fromEntries(Object.values(nezekan.nodes).map((node) => [node.id + offset,
      { ...node, id: node.id + offset, adjacent: node.adjacent.map((id) => id + offset) }])) };
}

const vaizel = copyBoard("vaizel", "Vaizel", 30, "daevanion", 100000);
const battle = copyBoard("azphel", "Azphel", 45, "battle", 200000);
const gd: GameData = { ...fixture, daevanion: {
  zikel: fixture.daevanion.zikel, azphel: battle, vaizel, nezekan,
} };

function build(nodes: number[] = []): CharacterBuild {
  return { name: "Guide", class_key: gd.class_key, level: 45, region: "global", daevanion_nodes: nodes,
    skill_ranks: {}, specs: {}, stigmas: [], bonus_ranks: {}, show_kr: false, skill_points: null,
    stigma_points: null, stats: { attack: 550, attack_increase_pct: 0, weapon_dmg_pct: 0, dmg_boost_pct: 0,
      pve_dmg_pct: 0, boss_dmg_pct: 0, crit_chance_pct: 0, crit_dmg_pct: 50, smite_pct: 0,
      combat_speed_pct: 0, cdr_pct: 0, max_mp: 1000, mp_regen_per_s: 20, target_defense: 0, penetration: 0 } };
}

type ViewProps = Partial<Parameters<typeof GuideDaevanion>[0]>;
const view = (props: ViewProps = {}) => (
  <MemoryRouter><GuideDaevanion gd={gd} icons={{}} level={45} unlocked {...props} /></MemoryRouter>
);
const boardAt = (name: string) => screen.getByRole("region", { name: `${name} board (read only)` });
const nodeAt = (id: number) => {
  const button = document.querySelector<HTMLButtonElement>(`button[data-node-id="${id}"]`);
  if (!button) throw new Error(`Missing node ${id}`);
  return button;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GuideDaevanion", () => {
  it("shows no boards at level one and the real first unlock at level twelve", () => {
    const { rerender } = render(view({ level: 1 }));
    expect(screen.getByText("Daevanion unlocks at level 12.")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    rerender(view({ level: 11 }));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(view({ level: 12 }));
    expect(boardAt("Nezekan")).toBeVisible();
    expect(within(boardAt("Nezekan")).getAllByRole("button")).toHaveLength(Object.keys(nezekan.nodes).length);
    expect(screen.queryByRole("region", { name: /Zikel board/ })).not.toBeInTheDocument();
  });

  it("stacks every eligible currency board in unlock order and updates in both directions", () => {
    const { rerender } = render(view());
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent))
      .toEqual(["Nezekan", "Zikel", "Vaizel"]);
    rerender(view({ level: 20 }));
    expect(boardAt("Zikel")).toBeVisible();
    expect(screen.queryByRole("region", { name: /Vaizel board/ })).not.toBeInTheDocument();
    rerender(view({ level: 12 }));
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
  });

  it("excludes Battle Crystal boards and their selected or planned nodes", () => {
    render(view({ build: build([stat.id + 200000]), path: [skill.id + 200000] }));
    expect(screen.queryByRole("region", { name: /Azphel board/ })).not.toBeInTheDocument();
    expect(document.querySelector(`[data-node-id="${stat.id + 200000}"]`)).toBeNull();
    expect(document.querySelectorAll('[data-state="selected"], [data-state="suggested"]')).toHaveLength(0);
  });

  it("distinguishes actual selected nodes from unselected, known suggested nodes", () => {
    const actual = build([stat.id]);
    const path = [stat.id, skill.id, skill.id, nezekan.start_id, 999999];
    const snapshot = structuredClone(actual);
    render(view({ build: actual, path }));
    const legend = screen.getByRole("group", { name: "Daevanion legend" });
    expect(within(legend).getByText("Selected")).toBeVisible();
    expect(within(legend).getByText("Suggested")).toBeVisible();
    expect(nodeAt(stat.id)).toHaveAttribute("data-state", "selected");
    expect(nodeAt(stat.id)).toHaveAccessibleName(/selected$/);
    expect(nodeAt(skill.id)).toHaveAttribute("data-state", "suggested");
    expect(nodeAt(skill.id)).toHaveAccessibleName(/suggested, not selected$/);
    expect(nodeAt(nezekan.start_id)).toHaveAttribute("data-state", "start");
    expect(document.querySelectorAll('[data-state="selected"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-state="suggested"]')).toHaveLength(1);
    expect(document.querySelector('[data-node-id="999999"]')).toBeNull();
    fireEvent.click(nodeAt(skill.id));
    fireEvent.click(nodeAt(stat.id));
    expect(actual).toEqual(snapshot);
    expect(path).toEqual([stat.id, skill.id, skill.id, nezekan.start_id, 999999]);
    expect(nodeAt(stat.id)).toHaveAttribute("data-state", "selected");
    expect(nodeAt(skill.id)).toHaveAttribute("data-state", "suggested");
  });

  it("never treats a path as a purchased build and withdraws highlights with the supplied props", () => {
    const { rerender } = render(view({ path: [skill.id] }));
    expect(document.querySelectorAll('[data-state="selected"]')).toHaveLength(0);
    expect(nodeAt(skill.id)).toHaveAttribute("data-state", "suggested");
    rerender(view({ build: build([skill.id]), path: [skill.id] }));
    expect(nodeAt(skill.id)).toHaveAttribute("data-state", "selected");
    expect(document.querySelectorAll('[data-state="suggested"]')).toHaveLength(0);
    rerender(view());
    expect(nodeAt(skill.id)).toHaveAttribute("data-state", "unselected");
  });

  it("announces the read-only board without toggle or checkbox semantics", () => {
    render(view({ build: build([stat.id]) }));
    expect(screen.getByText("Read only")).toBeVisible();
    expect(screen.getByRole("region", { name: "Daevanion" })).toHaveAccessibleDescription(/Read-only Daevanion boards/);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("type", "button");
      expect(button).not.toHaveAttribute("aria-pressed");
      expect(button).not.toHaveAttribute("aria-checked");
      expect(button).not.toBeDisabled();
    }
  });

  it("shows actual node cost and effects on focus, without buying the node", () => {
    render(view());
    const button = nodeAt(stat.id);
    expect(button).toHaveAttribute("title", `${stat.name}\nCost: ${stat.cost} Daevanion Crystals`);
    fireEvent.focus(button);
    const info = screen.getByRole("tooltip");
    expect(within(info).getByText(stat.name, { selector: "strong" })).toBeVisible();
    expect(within(info).getByText("Cost: 4 Daevanion Crystals")).toBeVisible();
    expect(within(info).getByText("+1.5%")).toBeVisible();
    expect(within(info).getByText("Not selected")).toBeVisible();
    expect(button).toHaveAttribute("aria-describedby", info.id);
    expect(button).toHaveAttribute("data-state", "unselected");
    fireEvent.blur(button);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the actual skill bonus on focus and dismisses details with Escape", () => {
    render(view({ path: [skill.id] }));
    fireEvent.focus(nodeAt(skill.id));
    const info = screen.getByRole("tooltip");
    expect(within(info).getByText(skill.name, { selector: "strong" })).toBeVisible();
    expect(info).toHaveTextContent("Robe of Earth: +1 skill rank (max +4 per skill).");
    expect(info).toHaveTextContent("Suggested / Not selected");
    expect(info).toHaveTextContent("Cost: 2 Daevanion Crystals");
    fireEvent.keyDown(nodeAt(skill.id), { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(nodeAt(skill.id)).not.toHaveAttribute("aria-describedby");
  });

  it("opens details on click or hover and keeps keyboard details when the pointer leaves", () => {
    render(view());
    const button = nodeAt(skill.id);
    fireEvent.mouseEnter(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent(skill.name);
    fireEvent.mouseLeave(button, { relatedTarget: screen.getByRole("tooltip") });
    expect(screen.getByRole("tooltip")).toHaveTextContent(skill.name);
    fireEvent.mouseLeave(button.closest(".guide-daevanion-board-surface")!);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent(skill.name);
    fireEvent.mouseLeave(button);
    expect(screen.getByRole("tooltip")).toHaveTextContent(skill.name);
  });

  it("keeps hover details readable and dismisses them with Escape outside the node", () => {
    render(view());
    fireEvent.mouseEnter(nodeAt(skill.id));
    const tooltip = screen.getByRole("tooltip");
    fireEvent.mouseLeave(nodeAt(skill.id), { relatedTarget: tooltip });
    fireEvent.mouseEnter(tooltip);
    expect(tooltip).toHaveTextContent(skill.name);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("uses the game rarity frames, closed suggested texture, class art and supplied skill icon", () => {
    render(view({ build: build([stat.id]), path: [skill.id], icons: { "robe-of-earth": "/earth.webp" } }));
    expect(nodeAt(stat.id).querySelector(".guide-daevanion-frame"))
      .toHaveAttribute("src", "/daevanion/node-unique-open.webp");
    expect(nodeAt(skill.id).querySelector(".guide-daevanion-frame"))
      .toHaveAttribute("src", "/daevanion/node-rare.webp");
    expect(nodeAt(skill.id).querySelector(".guide-daevanion-node-icon")).toHaveAttribute("src", "/earth.webp");
    expect(nodeAt(nezekan.start_id).querySelector(".guide-daevanion-frame"))
      .toHaveAttribute("src", "/daevanion/node-start.webp");
    expect(nodeAt(nezekan.start_id).querySelector(".guide-daevanion-node-icon"))
      .toHaveAttribute("src", "/daevanion/start-sorcerer.webp");
  });

  it("positions sparse nodes by their real coordinates with shrinkable grid tracks", () => {
    render(view({ level: 12 }));
    const grid = screen.getByRole("group", { name: "Nezekan node details" });
    expect(grid).toHaveStyle({ gridTemplateColumns: "repeat(11, minmax(0, 1fr))",
      gridTemplateRows: "repeat(11, minmax(0, 1fr))", aspectRatio: "11 / 11" });
    expect(grid.children).toHaveLength(Object.keys(nezekan.nodes).length);
    expect(nodeAt(stat.id)).toHaveStyle({ gridColumn: "1", gridRow: "1" });
    expect(nodeAt(nezekan.start_id)).toHaveStyle({ gridColumn: "6", gridRow: "6" });
  });

  it("links every board title to the full planner for the current class", () => {
    render(view());
    for (const name of ["Nezekan", "Zikel", "Vaizel"]) {
      expect(within(boardAt(name)).getByRole("link", { name: `${name}: open full Daevanion planner` }))
        .toHaveAttribute("href", "/daevanion?class=sorcerer");
    }
  });

  it("keeps eligible boards inspectable while the quest is incomplete and suppresses suggestions", () => {
    render(view({ level: 12, unlocked: false, build: build([stat.id]), path: [skill.id] }));
    expect(screen.getByText("Daevanion quest incomplete")).toBeVisible();
    expect(boardAt("Nezekan")).toBeVisible();
    expect(nodeAt(stat.id)).toHaveAttribute("data-state", "selected");
    expect(nodeAt(skill.id)).toHaveAttribute("data-state", "unselected");
    fireEvent.focus(nodeAt(skill.id));
    expect(screen.getByRole("tooltip")).toHaveTextContent(skill.name);
  });

  it("does not call the engine or fetch during local updates and inspection", () => {
    const fetch = vi.fn(() => { throw new Error("Unexpected API request"); });
    vi.stubGlobal("fetch", fetch);
    const { rerender } = render(view({ level: 1 }));
    rerender(view({ level: 45, path: [skill.id] }));
    fireEvent.focus(nodeAt(skill.id));
    fireEvent.click(nodeAt(stat.id));
    rerender(view({ level: 12 }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("handles missing currency boards and an eligible board without node data", () => {
    const { rerender } = render(view({ gd: { ...gd, daevanion: { azphel: battle } } }));
    expect(screen.getByText("No Daevanion Crystal boards available.")).toBeVisible();
    rerender(view({ gd: { ...gd, daevanion: { nezekan: { ...nezekan, nodes: {} } } } }));
    expect(boardAt("Nezekan")).toBeVisible();
    expect(screen.getByText("No node data available.")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
