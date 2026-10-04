import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import cmpFx from "@/fixtures/compare.json";
import rawFx from "@/fixtures/armory_raw.json";
import { armoryExtras } from "@/lib/armory";
import type { ArmoryRaw, CompareResult, IconUrls } from "@/lib/types";
import { RotationPlan } from "./RotationPlan";

const rot = (cmpFx as unknown as CompareResult).boss.rotation_explained;
const icons: IconUrls = { "element-enhancement": "https://assets.playnccdn.com/static-aion2-gamedata/resources/x.png" };

describe("RotationPlan", () => {
  it("renders opener with timestamps, core instructions, filler and a collapsed not-used list", () => {
    render(<RotationPlan rot={rot} icons={icons} />);
    const opener = screen.getByRole("list", { name: "Opener order" });
    expect(within(opener).getAllByRole("listitem")).toHaveLength(rot.opener.length);
    expect(within(opener).getByText("0.0 s")).toBeInTheDocument();
    const core = screen.getByRole("region", { name: "Core priorities" });
    expect(within(core).getByText(rot.core[0].text)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Filler" })).toHaveTextContent(rot.filler.text);
    const notUsed = screen.getByText(/Not used \(/);
    expect(notUsed.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText(rot.skip[0].reason)).toBeInTheDocument();
  });

  it("never lists a never-cast skill in the core section", () => {
    render(<RotationPlan rot={rot} icons={icons} />);
    const core = screen.getByRole("region", { name: "Core priorities" });
    for (const s of rot.skip.filter((x) => x.casts === 0)) expect(within(core).queryByText(s.name)).toBeNull();
  });

  it("omits empty sections", () => {
    render(<RotationPlan rot={{ ...rot, chains: [], skip: [], opener: [] }} icons={icons} />);
    expect(screen.queryByRole("region", { name: "Chains" })).toBeNull();
    expect(screen.queryByText(/Not used/)).toBeNull();
    expect(screen.queryByRole("region", { name: "Opener" })).toBeNull();
  });
});

describe("armoryExtras", () => {
  it("maps slot names to official icon URLs and reads pet and wings", () => {
    const x = armoryExtras(rawFx as unknown as ArmoryRaw);
    expect(x.gearIcons.MainHand).toMatch(/^https:\/\/assets\.playnccdn\.com\/static-aion2-gamedata\/resources\/.+\.png$/);
    expect(x.wing?.name).toBeTruthy();
    expect(x.pet?.icon).toMatch(/playnccdn/);
  });
  it("tolerates a payload without equipment", () => {
    const x = armoryExtras({ info: {}, equipment: {}, daevanion: {} });
    expect(x).toEqual({ gearIcons: {}, pet: null, wing: null, wingSkin: null });
  });
});
