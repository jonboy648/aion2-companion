import { describe, expect, it } from "vitest";
import gdFx from "@/fixtures/gamedata_sorcerer.json";
import cmpFx from "@/fixtures/compare.json";
import type { CompareResult, GameData } from "@/lib/types";
import { guideRanks } from "./guideRanks";

const gd = gdFx as unknown as GameData;
const build = (cmpFx as unknown as CompareResult).leveling.build;

describe("guide rank display", () => {
  it("adds earned Daevanion skill bonuses and explicit bonuses to paid ranks", () => {
    const node = Object.values(gd.daevanion).flatMap((board) => Object.values(board.nodes)).find((node) => node.skill_key)!;
    const key = node.skill_key!;
    const ranks = guideRanks(gd, { ...build, skill_ranks: { [key]: 5 }, bonus_ranks: { [key]: 2 }, daevanion_nodes: [node.id] });
    expect(ranks[key]).toBe(8);
  });
  it("clamps the displayed rank to the actual regional and skill cap", () => {
    const key = "firestorm";
    expect(guideRanks(gd, { ...build, skill_ranks: { [key]: 100 }, bonus_ranks: { [key]: 100 } })[key])
      .toBe(Math.min(gd.skills[key].max_rank, gd.rank_caps[build.region].core));
  });
  it("uses a chain head's total rank rather than displaying rank one for follow-ups", () => {
    const withChain: GameData = { ...gd, skills: { ...gd.skills, "test-chain": { ...gd.skills.firestorm, key: "test-chain", kind: "chain" } },
      links: [...gd.links, { parent_key: "firestorm", child_key: "test-chain", kind: "chain", confidence: "confirmed" }] };
    const ranks = guideRanks(withChain, { ...build, skill_ranks: { firestorm: 7 }, bonus_ranks: { firestorm: 1 } });
    expect(ranks["test-chain"]).toBe(ranks.firestorm);
  });
});
