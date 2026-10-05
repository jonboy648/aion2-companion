import { describe, expect, it } from "vitest";
import { normalize, rank, score } from "./matcher";

describe("matcher", () => {
  it("normalizes case, apostrophes and punctuation", () => {
    expect(normalize("Ludra's  Blade-of Extinction")).toBe("ludras blade of extinction");
  });

  it("ranks exact > prefix > word prefix > substring > fuzzy", () => {
    const labels = ["Flame Arrow", "Arrow", "Arrowhead Strike", "Sparrow Call", "Fire Raw Wound"];
    const order = rank("arrow", labels, (l) => [l], 10);
    expect(order.slice(0, 4)).toEqual(["Arrow", "Arrowhead Strike", "Flame Arrow", "Sparrow Call"]);
    expect(score("arrow", "Arrow")).toBeGreaterThan(score("arrow", "Arrowhead Strike"));
    expect(score("arrow", "Arrowhead Strike")).toBeGreaterThan(score("arrow", "Flame Arrow"));
    expect(score("arrow", "Flame Arrow")).toBeGreaterThan(score("arrow", "Sparrow Call"));
  });

  it("matches subsequences of 3+ letters but not 2-letter non-matches", () => {
    expect(score("farw", "Flame Arrow")).toBeGreaterThan(0);
    expect(score("fa", "Flame Arrow")).toBe(0);
    expect(score("zq", "Flame Arrow")).toBe(0);
    expect(score("xyz", "Flame Arrow")).toBe(0);
  });

  it("requires every token to match, label or extra text", () => {
    expect(score("fire sorcerer", "Firebomb", "Sorcerer")).toBeGreaterThan(0);
    expect(score("fire cleric", "Firebomb", "Sorcerer")).toBe(0);
  });

  it("prefers the shorter label on equal match and breaks ties by input order", () => {
    expect(score("blade", "Blade")).toBeGreaterThan(score("blade", "Blade of Extinction"));
    expect(rank("x", ["Xa", "Xb"], (l) => [l])).toEqual(["Xa", "Xb"]);
  });

  it("returns nothing for an empty query", () => {
    expect(rank("  ", ["a"], (l) => [l])).toEqual([]);
  });
});
