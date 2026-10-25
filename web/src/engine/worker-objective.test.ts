// @vitest-environment node
import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";
import workerSource from "./worker.ts?raw";

it("calls Python with goal and battle budget after progress without binding progress twice", () => {
  const bootstrap = workerSource.match(/const BOOTSTRAP = `([\s\S]*?)`;/)![1];
  const script = `
import json, sys, types
package = types.ModuleType("aion2c")
webapi = types.ModuleType("aion2c.webapi")
classes = types.ModuleType("aion2c.classes")
classes.CLASSES, classes.DEFAULT_CLASS = [], "sorcerer"
package.webapi, package.armory = webapi, types.ModuleType("aion2c.armory")
sys.modules.update({"aion2c": package, "aion2c.classes": classes})
def compare(build, daevanion_points=None, progress=None, battle_points=None, objective="damage"):
    progress("working")
    return [daevanion_points, battle_points, objective]
def optimize(build, playstyle_key, daevanion_points=None, progress=None, battle_points=None, objective="damage"):
    return compare(build, daevanion_points, progress, battle_points, objective)
webapi.compare, webapi.optimize = compare, optimize
exec(${JSON.stringify(bootstrap)})
messages = []
results = [json.loads(_call(name, json.dumps(args), True, messages.append)) for name, args in [
    ("compare", [{}, 7, None, "stagger"]),
    ("optimize", [{}, "boss", None, 4, "stagger"]),
    ("compare", [{}]),
]]
print(json.dumps([results, messages]))
`;
  expect(JSON.parse(execFileSync("python", ["-c", script], { encoding: "utf8" })))
    .toEqual([[[7, null, "stagger"], [null, 4, "stagger"], [null, null, "damage"]], ["working", "working", "working"]]);
});
