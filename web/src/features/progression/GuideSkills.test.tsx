import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import gdFixture from "@/fixtures/gamedata_sorcerer.json";
import type { CharacterBuild, GameData } from "@/lib/types";
import { buildFromForm, initialForm } from "@/features/build/manualBuild";
import { GuideSkills } from "./GuideSkills";
import { prepareLevelBuild, progression, validateLevelPlan, type AcquisitionRank } from "./progression";

const gd = gdFixture as unknown as GameData;
const originalAcquisitions = progression.classes.sorcerer.skills;
const levelOneKeys = ["firestorm", "flame-arrow", "ice-chain"];
const levelTwentyTwoKeys = [...levelOneKeys, "bittercold-wind", "blaze", "flame-scattershot", "robe-of-earth",
  "frost", "winters-shackles", "cold-snap-15730000", "frost-burst", "robe-of-flame",
  "wish-of-concentration", "absorb-essence", "hellfire", "grace-of-resistance", "defiance", "robe-of-cold",
  "grace-of-enhancement"];
const view = (level: number, data = gd, plannedBuild?: CharacterBuild) => (
  <MemoryRouter><GuideSkills gd={data} icons={{}} level={level} plannedBuild={plannedBuild} /></MemoryRouter>
);
const planAt = (level: number) => {
  const result = buildFromForm({ ...initialForm("sorcerer"), level: String(level) }, gd.level_caps.global);
  if ("errors" in result) throw new Error(result.errors.join(", "));
  return prepareLevelBuild(result.build, gd, { skill: 0, stigma: 0, daevanion: 0 }, false);
};
const linksAt = (level: number) => within(screen.getByRole("list", { name: `Core skills at level ${level}` })).getAllByRole("link");
const skillRow = (name: string) => {
  const row = screen.getByRole("link", { name: new RegExp(name) }).closest("li");
  if (!row) throw new Error(`Missing row for ${name}`);
  return within(row);
};
const expectSkillsAt = (level: number, keys: string[]) => {
  expect(linksAt(level).map((link) => link.getAttribute("href")).sort())
    .toEqual(keys.map((key) => `/codex/sorcerer?skill=${encodeURIComponent(key)}`).sort());
  for (const key of keys) expect(within(screen.getByRole("list", { name: `Core skills at level ${level}` })).getByText(gd.skills[key].name)).toBeVisible();
};

afterEach(() => {
  progression.classes.sorcerer.skills = originalAcquisitions;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GuideSkills", () => {
  it("shows every level-one core skill and separates the next unlock", () => {
    const { container } = render(view(1));
    expectSkillsAt(1, levelOneKeys);
    expect(screen.getByText("Available at level 1 (3)")).toBeVisible();
    const upcoming = screen.getByRole("list", { name: "Core skills unlocking at level 3" });
    expect(within(upcoming).getByText("Bittercold Wind")).toBeVisible();
    expect(within(upcoming).getByText("Active / Unlocks at level 3")).toBeVisible();
    expect(within(screen.getByRole("list", { name: "Core skills at level 1" })).queryByText("Bittercold Wind")).not.toBeInTheDocument();
    expect(screen.queryByText("Blaze")).not.toBeInTheDocument();
    expect(container.querySelector("details")).toBeNull();
    const panel = screen.getByRole("region", { name: "Core skills" });
    expect(panel).toHaveClass("reference-panel");
    expect(within(panel).getByRole("heading", { name: "Skills", level: 2 })).toHaveClass("reference-panel-heading");
    expect(panel.querySelector(".reference-panel-body")).not.toBeNull();
  });

  it("shows all available active and passive skills at level 22, with real codex links", () => {
    render(view(22));
    expectSkillsAt(22, levelTwentyTwoKeys);
    expect(screen.getByText("Passive / Unlocked at level 21")).toBeVisible();
    const available = screen.getByRole("list", { name: "Core skills at level 22" });
    expect(within(available).queryByText("Revitalization Contract")).not.toBeInTheDocument();
    const upcoming = screen.getByRole("list", { name: "Core skills unlocking at level 23" });
    expect(within(upcoming).getByRole("link")).toHaveAttribute("href", "/codex/sorcerer?skill=revitalization-contract");
    for (const name of ["Cold Storm", "Dodge", "Fire Mark", "Remove Hibernation", "Vitality Evaporation"]) {
      expect(screen.queryByText(name)).not.toBeInTheDocument();
    }
  });

  it("updates locally in both directions without API requests", () => {
    const fetch = vi.fn(() => { throw new Error("Unexpected API request"); });
    vi.stubGlobal("fetch", fetch);
    const { rerender } = render(view(1));
    rerender(view(22));
    expectSkillsAt(22, levelTwentyTwoKeys);
    rerender(view(23));
    expectSkillsAt(23, [...levelTwentyTwoKeys, "revitalization-contract"]);
    expect(screen.getByRole("list", { name: "Core skills unlocking at level 25" })).toBeVisible();
    rerender(view(1));
    expectSkillsAt(1, levelOneKeys);
    expect(screen.queryByText("Hellfire")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each<[string, Partial<AcquisitionRank>]>([
    ["unresolved acquisition", { unresolved: true }],
    ["prerequisite rank", { requires: [{ skill: "ice-chain", rank: 1 }] }],
    ["ascension gate", { ascensionGrade: 1 }],
    ["stigma unlock gate", { requiresStigmaUnlock: true }],
    ["skill point cost", { skillCost: 1 }],
    ["stigma point cost", { stigmaCost: 1 }],
  ])("excludes a %s from both groups", (_, gates) => {
    const acquisitions = progression.classes.sorcerer.skills;
    const blocked = Object.fromEntries(["flame-arrow", "bittercold-wind"].map((key) => [key, {
      ...acquisitions[key], ranks: acquisitions[key].ranks.map((rank) => rank.rank === 1 ? { ...rank, ...gates } : rank),
    }]));
    progression.classes.sorcerer.skills = { ...acquisitions, ...blocked };
    render(view(1));
    expectSkillsAt(1, ["firestorm", "ice-chain"]);
    expect(screen.queryByText("Flame Arrow")).not.toBeInTheDocument();
    expect(screen.queryByText("Bittercold Wind")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Core skills unlocking at level 4" })).toBeVisible();
  });

  it("requires automatic learning and a rank-one acquisition", () => {
    const acquisitions = progression.classes.sorcerer.skills;
    progression.classes.sorcerer.skills = {
      ...acquisitions,
      "flame-arrow": { ...acquisitions["flame-arrow"], autoLearn: false },
      firestorm: { ...acquisitions.firestorm, ranks: acquisitions.firestorm.ranks.filter((rank) => rank.rank !== 1) },
    };
    render(view(1));
    expectSkillsAt(1, ["ice-chain"]);
    expect(screen.queryByText("Flame Arrow")).not.toBeInTheDocument();
    expect(screen.queryByText("Firestorm")).not.toBeInTheDocument();
  });

  it("requires Global class data and an exact acquisition mapping", () => {
    const data: GameData = { ...gd, skills: {
      ...gd.skills,
      "flame-arrow": { ...gd.skills["flame-arrow"], regions: ["korea"] },
      firestorm: { ...gd.skills.firestorm, kind: "proc" },
      "unjoined-skill": { ...gd.skills["ice-chain"], key: "unjoined-skill", name: "Unjoined Skill" },
    } };
    render(view(1, data));
    expectSkillsAt(1, ["ice-chain"]);
    expect(screen.queryByText("Flame Arrow")).not.toBeInTheDocument();
    expect(screen.queryByText("Firestorm")).not.toBeInTheDocument();
    expect(screen.queryByText("Unjoined Skill")).not.toBeInTheDocument();
  });

  it("respects the first acquisition level and includes every skill in the next unlock group", () => {
    const acquisitions = progression.classes.sorcerer.skills;
    progression.classes.sorcerer.skills = {
      ...acquisitions,
      "flame-arrow": { ...acquisitions["flame-arrow"], ranks: acquisitions["flame-arrow"].ranks.map((rank) => rank.rank === 1 ? { ...rank, characterLevel: 3 } : rank) },
    };
    const { rerender } = render(view(1));
    expectSkillsAt(1, ["firestorm", "ice-chain"]);
    const upcoming = screen.getByRole("list", { name: "Core skills unlocking at level 3" });
    expect(within(upcoming).getAllByRole("link")).toHaveLength(2);
    expect(within(upcoming).getByText("Flame Arrow")).toBeVisible();
    rerender(view(3));
    expectSkillsAt(3, [...levelOneKeys, "bittercold-wind"]);
  });

  it("uses a plain supplied icon at 36px and removes the upcoming group once exhausted", () => {
    render(<MemoryRouter><GuideSkills gd={gd} icons={{ "flame-arrow": "/flame-arrow.png" }} level={45} /></MemoryRouter>);
    const image = screen.getByRole("img", { name: "Flame Arrow" });
    expect(image).toHaveAttribute("src", "/flame-arrow.png");
    expect(image.parentElement).toHaveStyle({ width: "36px", height: "36px" });
    expect(image.parentElement).toHaveClass("guide-skills-icon");
    expect(image.parentElement).toHaveAttribute("data-rarity", "common");
    expectSkillsAt(45, [...levelTwentyTwoKeys, "revitalization-contract", "vitality-evaporation"]);
    expect(screen.queryByRole("list", { name: /unlocking/ })).not.toBeInTheDocument();
  });

  it("also respects a stricter modeled unlock level", () => {
    const data: GameData = { ...gd, skills: { ...gd.skills,
      "flame-arrow": { ...gd.skills["flame-arrow"], unlock_level: 3 },
    } };
    render(view(1, data));
    expectSkillsAt(1, ["firestorm", "ice-chain"]);
    expect(within(screen.getByRole("list", { name: "Core skills unlocking at level 3" })).getByText("Flame Arrow")).toBeVisible();
  });

  it("does not infer skills for a class without progression records", () => {
    render(view(22, { ...gd, class_key: "unmapped-class" }));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("No core skills available at this level.")).toBeVisible();
  });

  it("uses one flat skill list for each group with the dedicated row styles", () => {
    render(view(22));
    const lists = screen.getAllByRole("list");
    expect(lists).toHaveLength(2);
    for (const list of lists) {
      expect(list).toHaveClass("guide-skills-list");
      expect(list.className).not.toMatch(/grid-cols|@min-/);
      expect(within(list).queryByRole("list")).not.toBeInTheDocument();
      const rows = within(list).getAllByRole("listitem");
      expect(list.children).toHaveLength(rows.length);
      for (const row of rows) {
        expect(row).toHaveClass("guide-skills-row");
        expect(within(row).getByRole("link")).toHaveClass("guide-skills-head");
      }
    }
  });

  it("does not infer ranks or specialties from the unlocked list", () => {
    render(view(22));
    expectSkillsAt(22, levelTwentyTwoKeys);
    expect(screen.queryByText(/^Lv /)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /^Selected specialties/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Equipped stigmas" })).not.toBeInTheDocument();
  });

  it("shows effective levels, actual bonus ranks and full selected specialty text without changing available skills", () => {
    const prepared = planAt(30);
    const arrowData = gd.skills["flame-arrow"];
    const fullData = { ...gd, skills: { ...gd.skills, "flame-arrow": { ...arrowData,
      ranks: Array.from({ length: 10 }, (_, i) => ({ ...arrowData.ranks[0], rank: i + 1 })) } } };
    const paidBuild = { ...prepared.build, skill_ranks: { ...prepared.build.skill_ranks, "flame-arrow": 8 }, specs: { "flame-arrow": [2] } };
    expect(validateLevelPlan(paidBuild, prepared.budget, false, fullData)).toEqual([]);
    const build = { ...paidBuild, bonus_ranks: { "flame-arrow": 2 }, daevanion_nodes: [4886, 4936] };
    const snapshot = structuredClone(build);
    render(view(30, fullData, build));
    expectSkillsAt(30, [...levelTwentyTwoKeys, "revitalization-contract", "vitality-evaporation"]);
    const arrow = screen.getByRole("link", { name: /Flame Arrow/ });
    expect(within(arrow).getByText("Lv 12")).toBeVisible();
    expect(skillRow("Flame Arrow").getByText("Paid 8 + Bonus 4")).toBeVisible();
    const specialties = skillRow("Flame Arrow").getByRole("list", { name: "Selected specialties for Flame Arrow" });
    expect(within(specialties).getByText(arrowData.specializations[2].text)).toBeVisible();
    expect(within(specialties).getAllByRole("listitem")).toHaveLength(1);
    expect(within(arrow).queryByText(arrowData.specializations[2].text)).not.toBeInTheDocument();
    expect(within(specialties).queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Specs /)).not.toBeInTheDocument();
    expect(build).toEqual(snapshot);
  });

  it("removes ranks, specialties and stigmas when the parent withdraws the calculated build", () => {
    const build = { ...planAt(22).build, stigmas: ["steel-barrier"], skill_ranks: {
      ...planAt(22).build.skill_ranks, "steel-barrier": 5,
    }, specs: { "steel-barrier": [0] } };
    const { rerender } = render(view(22, gd, build));
    expect(screen.getAllByText("Lv 1")).toHaveLength(levelTwentyTwoKeys.length);
    expect(screen.getByText(gd.skills["steel-barrier"].specializations[0].text)).toBeVisible();
    rerender(view(22));
    expect(screen.queryByText(/^Lv /)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /^Selected specialties/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Equipped stigmas" })).not.toBeInTheDocument();
    expectSkillsAt(22, levelTwentyTwoKeys);
  });

  it.each<Partial<CharacterBuild>>([
    { class_key: "templar" },
    { level: 30 },
    { region: "korea" },
  ])("ignores a calculated build from different display inputs: %j", (mismatch) => {
    render(view(22, gd, { ...planAt(22).build, bonus_ranks: { "flame-arrow": 7 },
      daevanion_nodes: [4886, 4936], specs: { "flame-arrow": [0] }, stigmas: ["steel-barrier"], ...mismatch }));
    expectSkillsAt(22, levelTwentyTwoKeys);
    expect(screen.queryByText(/^Lv /)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Paid /)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /^Selected specialties/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Equipped stigmas" })).not.toBeInTheDocument();
  });

  it("does not add paid, unresolved or upcoming rows from a supplied build", () => {
    const build = { ...planAt(1).build, skill_ranks: {
      "flame-arrow": 1, "cold-storm": 1, "fire-mark": 1, "bittercold-wind": 1,
    } };
    render(view(1, gd, build));
    expectSkillsAt(1, levelOneKeys);
    const available = screen.getByRole("list", { name: "Core skills at level 1" });
    expect(within(available).getAllByText("Lv 1")).toHaveLength(1);
    expect(screen.queryByText("Cold Storm")).not.toBeInTheDocument();
    expect(screen.queryByText("Fire Mark")).not.toBeInTheDocument();
    const upcoming = screen.getByRole("list", { name: "Core skills unlocking at level 3" });
    expect(within(upcoming).getByText("Bittercold Wind")).toBeVisible();
    expect(within(upcoming).queryByText(/^Lv /)).not.toBeInTheDocument();
  });

  it.each([0, -1, 1.5, 21, Number.NaN, Number.POSITIVE_INFINITY])("omits an invalid supplied rank %s", (rank) => {
    const build = { ...planAt(22).build, skill_ranks: { "flame-arrow": rank },
      bonus_ranks: { "flame-arrow": 8 }, specs: { "flame-arrow": [0] } };
    render(view(22, gd, build));
    expectSkillsAt(22, levelTwentyTwoKeys);
    expect(screen.queryByText(/^Lv /)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Paid /)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /^Selected specialties/ })).not.toBeInTheDocument();
  });

  it("omits invalid specialty references and shows each selected option once", () => {
    const build = { ...planAt(22).build, skill_ranks: { "flame-arrow": 8 }, specs: { "flame-arrow": [0, -1, 999, 0.5, 0] } };
    render(view(22, gd, build));
    const specialties = screen.getByRole("list", { name: "Selected specialties for Flame Arrow" });
    expect(within(specialties).getAllByRole("listitem")).toHaveLength(1);
    expect(within(specialties).getByText(gd.skills["flame-arrow"].specializations[0].text)).toBeVisible();
    expect(screen.queryByText(/^Paid /)).not.toBeInTheDocument();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("ignores a nonpositive or invalid input bonus %s", (bonus) => {
    const build = { ...planAt(22).build, skill_ranks: { "flame-arrow": 8 }, bonus_ranks: { "flame-arrow": bonus } };
    render(view(22, gd, build));
    expect(skillRow("Flame Arrow").getByText("Lv 8")).toBeVisible();
    expect(screen.queryByText(/^Paid /)).not.toBeInTheDocument();
  });

  it.each([[20, 20], [12, 12]])("caps the displayed total at the regional and skill limit (skill max %s)", (maxRank, expected) => {
    const data: GameData = { ...gd, skills: { ...gd.skills,
      "flame-arrow": { ...gd.skills["flame-arrow"], max_rank: maxRank },
    } };
    const build = { ...planAt(22).build, skill_ranks: { "flame-arrow": 8 }, bonus_ranks: { "flame-arrow": 50 } };
    render(view(22, data, build));
    expect(skillRow("Flame Arrow").getByText(`Lv ${expected}`)).toBeVisible();
    expect(skillRow("Flame Arrow").getByText(`Paid 8 + Bonus ${expected - 8}`)).toBeVisible();
  });

  it("counts selected skill nodes once, caps them at four and ignores locked boards", () => {
    const board = gd.daevanion.nezekan;
    const extraNodes = Array.from({ length: 5 }, (_, i) => ({ ...board.nodes["4886"], id: 70000 + i }));
    const data: GameData = { ...gd, daevanion: { ...gd.daevanion,
      nezekan: { ...board, nodes: { ...board.nodes, ...Object.fromEntries(extraNodes.map((node) => [String(node.id), node])) } },
    } };
    const build = { ...planAt(12).build, skill_ranks: { "flame-arrow": 8 },
      daevanion_nodes: [4886, 4886, 4936, ...extraNodes.map((node) => node.id)], bonus_ranks: { "flame-arrow": 2 } };
    const snapshot = structuredClone(build);
    const { rerender } = render(view(12, data, build));
    expect(skillRow("Flame Arrow").getByText("Lv 14")).toBeVisible();
    expect(skillRow("Flame Arrow").getByText("Paid 8 + Bonus 6")).toBeVisible();
    rerender(view(12, data, { ...build, daevanion_nodes: [4886, 4886, 4936] }));
    expect(skillRow("Flame Arrow").getByText("Lv 11")).toBeVisible();
    expect(build).toEqual(snapshot);
  });

  it("shows only equipped, unlocked Global stigmas with effective levels and full selected effects", () => {
    const data: GameData = { ...gd, skills: { ...gd.skills,
      "soul-freeze": { ...gd.skills["soul-freeze"], regions: ["korea"] },
      "glacial-smite": { ...gd.skills["glacial-smite"], unlock_level: 40 },
    } };
    const build = { ...planAt(30).build, stigmas: ["cold-storm", "cold-storm", "steel-barrier", "soul-freeze", "glacial-smite", "flame-arrow", "unknown"],
      skill_ranks: { "cold-storm": 8, "steel-barrier": 5, "divine-burst": 5 },
      bonus_ranks: { "cold-storm": 2 }, specs: { "cold-storm": [0, 1], "steel-barrier": [0] } };
    render(view(30, data, build));
    const stigmas = screen.getByRole("region", { name: "Equipped stigmas" });
    expect(within(stigmas).getAllByRole("link")).toHaveLength(2);
    expect(within(stigmas).getByRole("link", { name: /Cold Storm/ })).toHaveAttribute("href", "/codex/sorcerer?skill=cold-storm");
    expect(skillRow("Cold Storm").getByText("Lv 10")).toBeVisible();
    expect(skillRow("Cold Storm").getByText("Paid 8 + Bonus 2")).toBeVisible();
    for (const option of [0, 1]) expect(skillRow("Cold Storm").getByText(gd.skills["cold-storm"].specializations[option].text)).toBeVisible();
    expect(skillRow("Steel Barrier").getByText("Lv 5")).toBeVisible();
    expect(skillRow("Steel Barrier").getByText(gd.skills["steel-barrier"].specializations[0].text)).toBeVisible();
    for (const name of ["Soul Freeze", "Glacial Smite", "Divine Burst", "Flame Arrow", "unknown"]) {
      expect(within(stigmas).queryByText(name)).not.toBeInTheDocument();
    }
    expect(stigmas.querySelector("a a, a ul")).toBeNull();
  });
});
