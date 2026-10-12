import { beforeEach, expect, it } from "vitest";
import gdFixture from "@/fixtures/gamedata_sorcerer.json";
import compareFixture from "@/fixtures/compare.json";
import keybindFixture from "@/fixtures/keybinds.json";
import type { CharacterBuild, GameData, KeybindPlan } from "@/lib/types";
import { initialNativeConfig } from "./nativeConfig";
import { nativeOwnerKey, nativeStorageKey, readNativeConfig, writeNativeConfig } from "./nativeStorage";

const gd = gdFixture as unknown as GameData;
const build = compareFixture.leveling.build as unknown as CharacterBuild;
const defaults = initialNativeConfig((keybindFixture.plan as unknown as KeybindPlan).actions!, gd, build);

beforeEach(() => localStorage.clear());

it("rejects a malformed versioned setup without replacing its original record", () => {
  const owner = nativeOwnerKey(build);
  const key = nativeStorageKey(owner);
  const raw = JSON.stringify({ owner, config: { ...defaults, recipes: null } });
  localStorage.setItem(key, raw);
  const loaded = readNativeConfig(owner, defaults);
  expect(loaded.config).toEqual(defaults);
  expect(loaded.notice).toMatch(/could not be read/i);
  expect(localStorage.getItem(key)).toBe(raw);
});

it("backs up a malformed record before an explicit edit replaces it", () => {
  const owner = nativeOwnerKey(build);
  const key = nativeStorageKey(owner);
  const raw = JSON.stringify({ owner, config: { schema: 1, recipes: null } });
  localStorage.setItem(key, raw);
  expect(writeNativeConfig(owner, defaults)).toBeNull();
  expect(localStorage.getItem(`${key}:invalid-backup`)).toBe(raw);
  expect(readNativeConfig(owner, defaults).config).toEqual(defaults);
});

it("announces legacy records without choosing one of their scenario activation keys", () => {
  const raw = JSON.stringify({ delay: 11, hotkeys: { boss: "F9", aoe: "F10", leveling: "F11" } });
  localStorage.setItem("aion2c.kb.prefs.v1", raw);
  localStorage.setItem("aion2c.kb.pins.v2:sorcerer", JSON.stringify({ "8": "blaze" }));
  const loaded = readNativeConfig(nativeOwnerKey(build), defaults);
  expect(loaded.config.activationBinding).toBe("");
  expect(loaded.config.columns["8"][0]).toBe("flame-scattershot");
  expect(loaded.notice).toEqual(expect.stringMatching(/legacy.*preserved/i));
  expect(localStorage.getItem("aion2c.kb.prefs.v1")).toBe(raw);
});

it("rejects incomplete column records while retaining the original and returning usable defaults", () => {
  const owner = nativeOwnerKey(build);
  const key = nativeStorageKey(owner);
  const config = structuredClone(defaults);
  delete config.columns["2"]; delete config.bindings["2"]; delete config.alternateBindings["2"];
  const raw = JSON.stringify({ owner, config });
  localStorage.setItem(key, raw);
  const loaded = readNativeConfig(owner, defaults);
  expect(loaded.notice).toMatch(/could not be read/i);
  expect(loaded.config.columns["2"][0]).toBe("ice-chain");
  expect(localStorage.getItem(key)).toBe(raw);
});
