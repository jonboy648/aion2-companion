import type { CharacterBuild } from "@/lib/types";
import { readImportedCharacterContext } from "./activeBuild";
import { normalizeNativeConfig, type NativeConfig } from "./nativeConfig";

export function nativeOwnerKey(build: CharacterBuild): string {
  const context = readImportedCharacterContext();
  return JSON.stringify([build.region, build.class_key, build.name ?? "",
    context?.name === build.name ? [context.region, context.serverId] : null]);
}

export const nativeStorageKey = (owner: string) => `aion2c.kb.native.v1:${encodeURIComponent(owner)}`;

function legacyNotice(owner: string): string | null {
  const identity = JSON.parse(owner) as unknown;
  const classKey = Array.isArray(identity) && typeof identity[1] === "string" ? identity[1] : "";
  const keys = ["aion2c.kb.prefs.v1", "aion2c.kb.bindings.v1", `aion2c.kb.pins.v1:${classKey}`, `aion2c.kb.pins.v2:${classKey}`];
  return keys.some(key => localStorage.getItem(key))
    ? "Legacy keyboard and macro records are preserved, but were not automatically imported into this character's native setup."
    : null;
}

export function readNativeConfig(owner: string, defaults: NativeConfig): { config: NativeConfig; notice: string | null } {
  try {
    const raw = localStorage.getItem(nativeStorageKey(owner));
    if (!raw) return { config: defaults, notice: legacyNotice(owner) };
    if (raw.length > 70000) throw new Error("Oversized saved setup.");
    const value = JSON.parse(raw) as { owner?: unknown; config?: unknown };
    if (value?.owner !== owner) {
      return { config: defaults, notice: "Saved setup could not be read. The original record has been retained." };
    }
    const normalized = normalizeNativeConfig(value.config);
    return { config: normalized.config, notice: [...new Set(normalized.issues)].join(" ") || null };
  } catch {
    return { config: defaults, notice: "Saved setup could not be read. The original record has been retained; defaults are shown." };
  }
}

export function writeNativeConfig(owner: string, config: NativeConfig): string | null {
  try {
    const key = nativeStorageKey(owner);
    const normalized = normalizeNativeConfig(config).config;
    const next = JSON.stringify({ owner, config: normalized });
    if (next.length > 70000) throw new Error("Setup too large to save.");
    const previous = localStorage.getItem(key);
    if (previous) {
      let invalid = previous.length > 70000;
      try {
        const saved = JSON.parse(previous) as { owner?: unknown; config?: unknown };
        if (saved?.owner !== owner) invalid = true;
        normalizeNativeConfig(saved?.config);
      } catch { invalid = true; }
      if (invalid && !localStorage.getItem(`${key}:invalid-backup`)) localStorage.setItem(`${key}:invalid-backup`, previous);
    }
    localStorage.setItem(key, next);
    return null;
  } catch { return "Could not save this setup. Changes are kept for this visit only."; }
}
