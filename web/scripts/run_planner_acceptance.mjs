import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { artifactDir, checkResponses, generateCases, loadHelpers, loadShippedData, writeArtifact } from "./planner_acceptance.mjs";

// From web: node scripts/run_planner_acceptance.mjs [--case sorcerer-22] [--workers 4] [--check-only]
const { values } = parseArgs({ options: {
  case: { type: "string" }, workers: { type: "string", default: "4" },
  python: { type: "string", default: "python" }, "check-only": { type: "boolean" },
} });
const workers = Number(values.workers);
if (!Number.isSafeInteger(workers) || workers < 1) throw new Error("--workers must be a positive integer");
const helpers = await loadHelpers();
const shipped = await loadShippedData();
let document;
if (values["check-only"]) document = JSON.parse(await readFile(join(artifactDir, "requests.json"), "utf8"));
else {
  let cases = generateCases(shipped.gdByClass, helpers);
  if (values.case) cases = cases.filter(request => request.id.includes(values.case));
  if (!cases.length) throw new Error("--case did not match an acceptance case");
  document = { schema: 1, engineVersion: shipped.manifest.engine_version, classDataDir: shipped.classDataDir, cases };
  const input = await writeArtifact("requests.json", document);
  console.log(`Running ${cases.length} exact TypeScript-generated requests through CPython (${workers} workers).`);
  const runner = fileURLToPath(new URL("./planner_acceptance.py", import.meta.url));
  await new Promise((resolve, reject) => {
    const child = spawn(values.python, ["-B", runner, input, join(artifactDir, "outputs.jsonl"), "--workers", String(workers)], {
      stdio: "inherit", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`CPython runner exited ${code}`)));
  });
}
const outputs = (await readFile(join(artifactDir, "outputs.jsonl"), "utf8")).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const report = checkResponses(document.cases, outputs, shipped.gdByClass, helpers);
report.engineVersion = document.engineVersion;
await writeArtifact("report.json", report);
for (const row of report.cases) {
  console.log(`${row.issues.length ? "FAIL" : "PASS"} ${row.id} (${row.plansChecked} builds)`);
  for (const issue of row.issues) console.error(`  ${issue}`);
}
for (const issue of report.issues) console.error(issue);
console.log(`${report.cases.filter(row => row.issues.length === 0).length}/${report.cases.length} cases passed; ${report.plansChecked} builds validated.`);
process.exitCode = report.passed ? 0 : 1;
