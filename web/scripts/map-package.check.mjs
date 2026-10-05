import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
test("map retains attribution and corresponding-source access", () => {
  const about = read("../../map-app/src/routes/about.tsx");
  assert.match(about, /Yihao Liu/);
  assert.match(about, /CC BY-NC 4.0/);
  assert.match(about, /map-source\.tar\.gz/);
  assert.match(read("../../map-app/LICENSE"), /GNU General Public License/i);
});
test("map uses local static data and base-relative routing", () => {
  assert.match(read("../../map-app/src/utils/dataMode.ts"), /BASE_URL/);
  assert.match(read("../../map-app/src/utils/dataMode.ts"), /DEFAULT_DATA_MODE: DataMode = "static"/);
  assert.match(read("../../map-app/src/main.tsx"), /basepath: import.meta.env.BASE_URL/);
  assert.match(read("build-map.mjs"), /VITE_PUBLIC_BASE: "\/map\/"/);
  assert.match(read("build-map.mjs"), /\["about", "crafting"\]/);
});
test("approved map zones and reproducible dependency lock exist", () => {
  for (const path of ["package-lock.json", "public/data/markers/World_L_B.yaml", "public/data/markers/World_D_B.yaml", "public/data/markers/Abyss_Reshanta_D.yaml"]) {
    assert.ok(existsSync(fileURLToPath(new URL(`../../map-app/${path}`, import.meta.url))), path);
  }
});
