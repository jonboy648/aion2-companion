import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {stripTypeScriptTypes} from "node:module";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const compiled = stripTypeScriptTypes(read("../../map-app/src/utils/partyLink.ts"));
const {encodePartyLink, decodePartyLink} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const zone = {id: "test", name: "World_D_B", tileWidth: 1024, tileHeight: 1024, tilesCountX: 8, tilesCountY: 8};
test("party shares preserve zone, Unicode labels and marker kinds", () => {
  const encoded = encodePartyLink(zone, [{type: "local", localType: "favorite", x: 100.4, y: 320, name: "Rally \u2605"}]);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  const result = decodePartyLink(encoded, [zone]);
  assert.equal(result.zone, zone.name);
  assert.deepEqual(result.pins.map(p => [p.localType, p.x, p.y, p.name]), [["favorite", 100, 320, "Rally \u2605"]]);
});
test("party shares reject malformed data and clamp coordinates and limits", () => {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const value = {v: 1, zone: zone.name, pins: [["bad", 1, 2, ""], ["fox", "1", 2, ""], ...Array.from({length: 210}, () => ["location", -50, 99999, "x".repeat(80)])]};
  const result = decodePartyLink(encode(value), [zone]);
  assert.equal(result.pins.length, 200);
  assert.equal(result.pins[0].x, 0);
  assert.equal(result.pins[0].y, 8192);
  assert.equal(result.pins[0].name.length, 40);
  for (const bad of [null, "%bad", "a".repeat(100001), encode({...value, zone: "unknown"}), encode({v: 2})]) {
    assert.equal(decodePartyLink(bad, [zone]), null);
  }
});
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
