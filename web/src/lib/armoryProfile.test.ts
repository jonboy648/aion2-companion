import { describe, expect, it } from "vitest";
import rawFx from "@/fixtures/armory_raw.json";
import type { ArmoryRaw } from "./types";
import { armoryExtras } from "./armory";

describe("imported character presentation", () => {
  it("preserves the pet's imported level", () => {
    expect(armoryExtras(rawFx as unknown as ArmoryRaw).pet).toMatchObject({
      name: "Starturtle",
      level: 3,
    });
  });
  it("preserves wing enhancement even when zero", () => {
    expect(armoryExtras(rawFx as unknown as ArmoryRaw).wing).toMatchObject({
      name: "Superior Daeva Wings",
      enchantLevel: 0,
    });
  });
  it("preserves imported effective ranks and acquisition state", () => {
    const profile = armoryExtras(rawFx as unknown as ArmoryRaw);
    expect(profile.skills?.find((skill) => skill.id === 15210000)).toMatchObject({
      name: "Flame Arrow", category: "Active", rank: 12, acquired: true, equipped: true,
    });
    expect(profile.skills?.find((skill) => skill.name === "Curse: Tree")).toMatchObject({
      category: "Dp", rank: 0, acquired: false, equipped: false,
    });
  });
  it("keeps equipped title effects separate from collection effects", () => {
    expect(armoryExtras(rawFx as unknown as ArmoryRaw).titles?.find((title) => title.category === "Attack"))
      .toMatchObject({ name: "Celebrity", equippedEffects: ["Critical Attack +30", "Block Penetration +40"], collectionEffects: ["Penetration +20"] });
  });
  it("pairs reported attributes with their effects without recalculation", () => {
    expect(armoryExtras(rawFx as unknown as ArmoryRaw).attributes?.find((attribute) => attribute.key === "STR"))
      .toEqual({ key: "STR", name: "Might", value: 14, effects: ["Attack increase +1.4%"] });
  });
  it("ignores malformed collections and missing metadata rather than inventing ownership", () => {
    expect(armoryExtras({ info: { stat: { statList: 3 }, title: { titleList: "bad" } },
      equipment: { equipment: { equipmentList: {} }, petwing: { pet: { name: "Pet", level: -1 } }, skill: { skillList: null } }, daevanion: {} }))
      .toEqual({ gearIcons: {}, pet: { name: "Pet", icon: null, grade: "Epic" }, wing: null, wingSkin: null });
  });
});
