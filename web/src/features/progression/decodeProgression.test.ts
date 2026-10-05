import { describe, expect, it } from "vitest";
import packed from "./data.json";
import { decodeProgression } from "./decodeProgression";

describe("compact progression decoder", () => {
  it("expands level totals, all acquisition gates, automatic tiers and exact board currencies", () => {
    const data = decodeProgression(packed);
    expect(data.schema).toBe(1);
    expect(data.levels.at(-1)).toEqual({ level: 45, skill: 203, stigma: 29, stigmaSlots: 4, daevanion: 136 });
    expect(data.classes.sorcerer.boardCurrencies.azphel).toBe("battle");
    const stigma = data.classes.sorcerer.skills["cold-storm"];
    expect(stigma.autoLearn).toBe(false);
    expect(stigma.ranks[0]).toEqual({ rank: 1, characterLevel: 22, skillCost: 0, stigmaCost: 1,
      requires: [], ascensionGrade: 3, requiresStigmaUnlock: true });
    expect(stigma.specialtyAutoSlots?.map((slot) => slot.rank)).toEqual([5, 10, 15, 20]);
    expect(data.classes.sorcerer.skills.hellfire.ranks).toHaveLength(10);
  });

  it("does not mutate the compact input or alias pooled acquisition rows", () => {
    const snapshot = structuredClone(packed);
    const data = decodeProgression(packed);
    data.classes.sorcerer.skills["cold-storm"].ranks[0].requires.push({ skill: "hellfire", rank: 1 });
    expect(data.classes.sorcerer.skills["arctic-armor"].ranks[0].requires).toEqual([]);
    expect(packed).toEqual(snapshot);
  });

  it("rejects unknown currencies and missing currency mappings", () => {
    const bad = structuredClone(packed) as unknown as Record<string, unknown>;
    const classes = bad.classes as Record<string, { boardCurrencies: Record<string, unknown> }>;
    classes.sorcerer.boardCurrencies.azphel = "future-currency";
    expect(() => decodeProgression(bad)).toThrow(/Unknown board currency/);
    delete (classes.sorcerer as Partial<typeof classes.sorcerer>).boardCurrencies;
    expect(() => decodeProgression(bad)).toThrow(/Invalid progression object/);
  });

  it("rejects malformed schemas, profile references and unknown acquisition gates", () => {
    expect(() => decodeProgression({ ...packed, schema: 99 })).toThrow(/schema/);
    const badReference = structuredClone(packed);
    badReference.classes.sorcerer.skills.hellfire[2] = 999999;
    expect(() => decodeProgression(badReference)).toThrow(/profile reference/);
    const badGate = structuredClone(packed) as unknown as { rankProfiles: unknown[][] };
    badGate.rankProfiles[0][0] = [1, 1, 0, 0, { unknownGate: true }];
    expect(() => decodeProgression(badGate)).toThrow(/Unknown acquisition gate/);
  });
});
