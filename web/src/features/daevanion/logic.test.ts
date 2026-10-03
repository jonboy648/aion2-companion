import { describe, expect, it } from "vitest";
import gamedataFx from "@/fixtures/gamedata_sorcerer.json";
import type { DaevanionBoard, GameData } from "@/lib/types";
import { boardTotal, formatEffect, isValid, nodeState, pointsSpent, removable, selectable, skillBonuses, statTotals } from "./logic";

const gd = gamedataFx as unknown as GameData;
const board: DaevanionBoard = Object.values(gd.daevanion)[0];

describe("daevanion adjacency rule", () => {
  it("only neighbours of the start are selectable on an empty board", () => {
    const avail = selectable(board, new Set());
    expect(avail.size).toBeGreaterThan(0);
    for (const id of avail) expect(board.nodes[String(id)].adjacent).toContain(board.start_id);
    expect(avail.has(board.start_id)).toBe(false);
  });

  it("selecting a node opens its neighbours and keeps the selection valid", () => {
    const first = [...selectable(board, new Set())][0];
    const sel = new Set([first]);
    expect(isValid(board, sel)).toBe(true);
    const next = selectable(board, sel);
    expect(next.has(first)).toBe(false);
    const neighbour = board.nodes[String(first)].adjacent.find((a) => a !== board.start_id && board.nodes[String(a)]);
    if (neighbour !== undefined) expect(next.has(neighbour)).toBe(true);
  });

  it("a disconnected node is invalid, and a mid-path node cannot be removed", () => {
    const first = [...selectable(board, new Set())][0];
    const second = [...selectable(board, new Set([first]))][0];
    const sel = new Set([first, second]);
    expect(isValid(board, sel)).toBe(true);
    // the node that only connects through `first` is a leaf, `first` is a bridge unless second also touches the start
    expect(removable(board, sel, second)).toBe(true);
    const touchesStart = board.nodes[String(second)].adjacent.includes(board.start_id);
    expect(removable(board, sel, first)).toBe(touchesStart);
    // a far node with nothing selected next to it
    const far = Object.values(board.nodes).find((n) => !n.adjacent.includes(board.start_id) && n.id !== board.start_id)!;
    expect(isValid(board, new Set([far.id]))).toBe(false);
  });

  it("walking a full path from the start is valid, and states are reported", () => {
    const sel = new Set<number>();
    for (let i = 0; i < 15; i++) {
      const next = [...selectable(board, sel)][0];
      if (next === undefined) break;
      sel.add(next);
    }
    expect(isValid(board, sel)).toBe(true);
    const avail = selectable(board, sel);
    expect(nodeState(board, sel, avail, board.start_id)).toBe("start");
    expect(nodeState(board, sel, avail, [...sel][0])).toBe("selected");
    expect(nodeState(board, sel, avail, [...avail][0])).toBe("available");
  });
});

describe("daevanion totals", () => {
  it("sums effects, points and capped skill bonuses", () => {
    const nodes = Object.values(board.nodes).filter((n) => n.id !== board.start_id);
    const sel = new Set(nodes.map((n) => n.id));
    expect(boardTotal(board)).toBe(nodes.length);
    expect(pointsSpent(gd, sel)).toBe(nodes.reduce((a, n) => a + n.cost, 0));
    const totals = statTotals(gd, sel);
    const attack = totals.find((t) => t.stat === "Attack");
    const expected = nodes.flatMap((n) => n.effects).filter((e) => e.stat === "Attack").reduce((a, e) => a + e.value, 0);
    expect(attack?.value ?? 0).toBeCloseTo(expected);
    for (const v of Object.values(skillBonuses(gd, sel))) expect(v).toBeLessThanOrEqual(4);
  });

  it("formats effects", () => {
    expect(formatEffect(1.5, "%")).toBe("+1.5%");
    expect(formatEffect(50, "flat")).toBe("+50");
  });
});
