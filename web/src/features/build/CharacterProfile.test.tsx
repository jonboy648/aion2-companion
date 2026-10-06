import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import rawFx from "@/fixtures/armory_raw.json";
import importFx from "@/fixtures/import_character.json";
import gameFx from "@/fixtures/gamedata_sorcerer.json";
import { armoryExtras } from "@/lib/armory";
import type { ArmoryRaw, GameData, ImportResult } from "@/lib/types";
import { CharacterCard } from "./CharacterCard";

afterEach(cleanup);
const imp = importFx as unknown as ImportResult;
const extras = armoryExtras(rawFx as unknown as ArmoryRaw);
const data = { gd: null, icons: {}, error: null };

describe("character ownership", () => {
  it("labels missing ownership data unavailable rather than inventing empty ownership", () => {
    render(<CharacterCard imp={imp} data={data} />);
    expect(within(screen.getByRole("region", { name: "Equipped titles" })).getByText("Title data unavailable.")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Attributes" })).getByText("Attribute data unavailable.")).toBeVisible();
    expect(screen.getByText("Pet and wing data unavailable.")).toBeVisible();
    expect(screen.getByText("Acquired skill data unavailable.")).toBeVisible();
  });
  it("shows pet level and equipped wings without opening disclosures", () => {
    render(<CharacterCard imp={imp} data={data} extras={extras} />);
    expect(screen.getByText("Starturtle")).toBeVisible();
    expect(screen.getByText("Lv 3")).toBeVisible();
    expect(screen.getByText("Superior Daeva Wings")).toBeVisible();
  });
  it("groups equipment into weapons, armor and accessories without losing unknown slots", () => {
    render(<CharacterCard imp={{ ...imp, gear: [...imp.gear, { slot: "FutureSlot", name: "New Relic", grade: "Rare", enchant: 0, exceed: 0 }] }} data={data} extras={extras} />);
    expect(within(screen.getByRole("region", { name: "Weapons" })).getByText("Liberator Spellbook")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Armor" })).getByText("Liberator Breastplate")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Accessories" })).getByText("Silent Necklace")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Other equipment" })).getByText("New Relic")).toBeVisible();
  });
  it("shows acquired active and passive skills at imported effective rank", () => {
    render(<CharacterCard imp={imp} data={data} extras={extras} />);
    const active = screen.getByRole("region", { name: "Active skills" });
    const flame = within(active).getByText("Flame Arrow").closest("li")!;
    expect(within(flame).getByText("Rank 12")).toBeVisible();
    expect(screen.getByRole("region", { name: "Passive skills" })).toBeVisible();
    expect(screen.queryByText("Curse: Tree")).not.toBeInTheDocument();
  });
  it("shows title effects and attribute effects as distinct imported facts", () => {
    render(<CharacterCard imp={imp} data={data} extras={extras} />);
    const titles = screen.getByRole("region", { name: "Equipped titles" });
    expect(within(titles).getByText("Celebrity")).toBeVisible();
    expect(within(titles).getByText("Critical Attack +30")).toBeVisible();
    expect(within(titles).getByText("Collection: Penetration +20")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Attributes" })).getByText("Attack increase +1.4%")).toBeVisible();
  });
  it("keeps equipped stigmas visible at their imported effective ranks", () => {
    render(<CharacterCard imp={imp} data={data} extras={extras} />);
    const equipped = extras.skills!.find((skill) => skill.category === "Dp" && skill.equipped && skill.acquired)!;
    const stigma = screen.getByText(equipped.name).closest("li")!;
    expect(stigma).toBeVisible();
    expect(within(stigma).getByText(`Rank ${equipped.rank}`)).toBeVisible();
  });
  it("replaces all imported ownership when another character is shown", () => {
    const { rerender } = render(<CharacterCard imp={imp} data={data} extras={extras} />);
    rerender(<CharacterCard imp={{ ...imp, profile: { ...imp.profile, name: "Luna" }, gear: [], stigmas: [] }} data={data}
      extras={{ gearIcons: {}, pet: null, wing: null, wingSkin: null, skills: [], titles: [], attributes: [] }} />);
    expect(screen.getByRole("heading", { name: "Luna" })).toBeVisible();
    for (const oldFact of ["Starturtle", "Celebrity", "Flame Arrow", "Liberator Spellbook", "Attack increase +1.4%"]) {
      expect(screen.queryByText(oldFact)).not.toBeInTheDocument();
    }
  });
  it("distinguishes owned board completion from import matching coverage", () => {
    render(<CharacterCard imp={imp} data={{ ...data, gd: gameFx as unknown as GameData }} extras={extras} />);
    const boards = screen.getByRole("region", { name: "Stigmas and Daevanion" });
    expect(within(boards).getByText("68/88")).toBeVisible();
    expect(within(boards).getByText("0/152")).toBeVisible();
    expect(within(boards).getByText(/of .*open nodes matched/)).toBeVisible();
  });
});
