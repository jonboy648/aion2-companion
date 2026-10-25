import { expect, it } from "vitest";
import { compare, optimize } from "./api";
import importFx from "@/fixtures/import_character.json";
import type { CharacterBuild } from "@/lib/types";

it("rejects unsupported mock Stagger requests instead of relabeling damage fixtures", async () => {
  const build = importFx.build as unknown as CharacterBuild;
  await expect(compare(build, 0, undefined, "stagger")).rejects.toThrow(/stagger.*fixture.*real engine/i);
  await expect(optimize(build, "boss", 0, undefined, "stagger")).rejects.toThrow(/stagger.*fixture.*real engine/i);
});
