import { describe, expect, it } from "vitest";
import gamedataFx from "@/fixtures/gamedata_sorcerer.json";
import type { GameData } from "@/lib/types";
import { cardLine, filterSkills, fmtNum, kindCounts, matchesKind, skillLinks } from "./logic";

const gd = gamedataFx as unknown as GameData;

describe("codex filters", () => {
  it("counts add up and 'other' collects the non-main kinds", () => {
    const c = kindCounts(gd);
    expect(c.all).toBe(Object.keys(gd.skills).length);
    expect(c.active + c.passive + c.stigma + c.chain + c.other).toBe(c.all);
    expect(filterSkills(gd, "other", "").every((s) => matchesKind(s, "other"))).toBe(true);
  });

  it("filters by kind and searches name, korean name and description", () => {
    expect(filterSkills(gd, "stigma", "").every((s) => s.kind === "stigma")).toBe(true);
    const hit = filterSkills(gd, "all", "flame arrow");
    expect(hit.map((s) => s.key)).toContain("flame-arrow");
    expect(filterSkills(gd, "all", "화염탄").map((s) => s.key)).toContain("firebomb");
    expect(filterSkills(gd, "all", "zzzz-no-such-skill")).toHaveLength(0);
  });

  it("finds chain links and formats confidence marks", () => {
    const { children } = skillLinks(gd, "flame-arrow");
    expect(children.map((l) => l.child_key)).toContain("burst");
    expect(fmtNum({ value: 12, confidence: "confirmed", source: "" }, "s")).toBe("12 s");
    expect(fmtNum({ value: 1, confidence: "estimated", source: "" }, "s")).toBe("~1 s");
    expect(fmtNum({ value: null, confidence: "unknown", source: "" })).toBe("?");
    expect(cardLine(gd.skills.firebomb)).toContain("CD 12 s");
  });
});
