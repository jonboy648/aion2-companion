import { cpSync, mkdirSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const app = join(root, "map-app");
const output = join(root, "web/dist/map");
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}
run(process.execPath, [join(app, "node_modules/typescript/bin/tsc"), "-b"], { cwd: app });
run(process.execPath, [join(app, "node_modules/vite/bin/vite.js"), "build"], {
  cwd: app,
  env: { ...process.env, VITE_PUBLIC_BASE: "/map/", VITE_DEFAULT_DATA_MODE: "static", VITE_API_BASE_URL: "", VITE_CDN_BASE_URL: "" },
});
mkdirSync(output, { recursive: true });
cpSync(join(app, "dist"), output, { recursive: true });
// Pages must serve the map shell, not the companion SPA, on direct nested visits.
for (const route of ["about", "crafting"]) {
  mkdirSync(join(output, route), { recursive: true });
  copyFileSync(join(output, "index.html"), join(output, route, "index.html"));
}
copyFileSync(join(app, "LICENSE"), join(output, "LICENSE"));
const sourceFiles = ["src", "public", "LICENSE", "README.md", "ADAPTATION.md", "PERMISSION_NOTE.md",
  "package.json", "package-lock.json", ".npmrc", "env.d.ts", "index.html", "postcss.config.js",
  "tailwind.config.ts", "tsconfig.app.json", "tsconfig.json", "tsconfig.node.json", "vite.config.ts"];
const tar = process.platform === "win32" ? join(process.env.SystemRoot || "C:/Windows", "System32/tar.exe") : "tar";
run(tar, ["-czf", join(output, "map-source.tar.gz"), ...sourceFiles], { cwd: app });
function bytes(path) {
  return readdirSync(path, { withFileTypes: true }).reduce((sum, entry) => {
    const child = join(path, entry.name);
    return sum + (entry.isDirectory() ? bytes(child) : statSync(child).size);
  }, 0);
}
const total = bytes(join(root, "web/dist"));
if (total > 900_000_000) throw new Error(`Site artifact exceeds our 900 MB safety budget: ${total}`);
console.log(`Map packaged at /map/; total site artifact ${(total / 1_000_000).toFixed(1)} MB, including corresponding source.`);
