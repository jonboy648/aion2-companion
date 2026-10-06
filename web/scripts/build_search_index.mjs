// Build step (before `vite build`): writes public/search-index.json for the Ctrl+K palette from data already in the repo
// (src/seo/routes.json, public/engine/*, public/items/*). Compact column format; src/features/search/index.ts expands it. Run: node scripts/build_search_index.mjs
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

/** Pure build: returns the index object. itemRoute = App.tsx already routes /items/:id (another branch adds it). */
export function buildIndex(rootDir = root) {
  const seo = readJson(join(rootDir, "src/seo/routes.json"));
  const classList = readJson(join(rootDir, "src/fixtures/list_classes.json"));
  const engine = join(rootDir, "public/engine");
  const app = readFileSync(join(rootDir, "src/App.tsx"), "utf8");
  const itemRoute = /path="items\/:/.test(app);

  // Pages: [label, path, description]
  const pages = seo.routes.filter((r) => !r.path.startsWith("/codex/")).map((r) => [r.h1, r.path, r.description]);
  for (const [label, path, d] of [
    ["Board", "/board", "Characters others looked up"],
    ["Maps", "/maps", "Interactive map"],
    ["Timers", "/timers", "Boss and event timers"],
  ]) {
    if (!pages.some((p) => p[1] === path)) pages.push([label, path, d]);
  }

  const classes = []; // [key, name, role]
  const skills = []; // [name, classKey, skillKey, kind, iconName]
  const daevanion = []; // [name, classKey, board, "b" board | "n" node]
  for (const c of classList) {
    classes.push([c.key, c.name, c.role]);
    const file = join(engine, "classes", `${c.key}.json`);
    if (!existsSync(file)) continue;
    const gd = readJson(file);
    const iconFile = join(engine, "icons", `${c.key}.json`);
    const icons = existsSync(iconFile) ? readJson(iconFile) : {};
    for (const s of Object.values(gd.skills)) skills.push([s.name, c.key, s.key, s.kind, icons[s.key] ?? ""]);
    const seen = new Set();
    for (const b of Object.values(gd.daevanion ?? {})) {
      daevanion.push([b.name, c.key, b.name, "b"]);
      for (const n of Object.values(b.nodes ?? {})) {
        if (seen.has(n.name)) continue;
        seen.add(n.name);
        daevanion.push([n.name, c.key, b.name, "n"]);
      }
    }
  }

  // Items: [name, id, slot, grade, iconName]
  const itemsFile = join(engine, "items.json");
  let items = existsSync(itemsFile)
    ? readJson(itemsFile).items.map((i) => [i.name, i.id, i.slot ?? "", i.grade ?? "", i.icon ?? ""])
    : [];
  const itemDb = join(rootDir, "public/items");
  const itemIndex = join(itemDb, "index.json");
  if (existsSync(itemIndex)) {
    const byId = new Map();
    for (const group of readJson(itemIndex).groups) {
      for (const cat of group.cats) {
        for (const i of readJson(join(itemDb, "cat", `${cat.key}.json`)).items) {
          byId.set(i.id, [i.n, i.id, cat.key, i.g ?? "", i.i ?? ""]);
        }
      }
    }
    items = [...byId.values()];
  }

  return { v: 1, itemRoute, pages, classes, skills, daevanion, items };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = join(root, "public/search-index.json");
  const idx = buildIndex();
  writeFileSync(out, JSON.stringify(idx));
  const kb = (statSync(out).size / 1024).toFixed(1);
  console.log(
    `search-index.json: ${kb} KB (${idx.pages.length} pages, ${idx.classes.length} classes, ${idx.skills.length} skills, ${idx.daevanion.length} daevanion, ${idx.items.length} items, itemRoute=${idx.itemRoute})`,
  );
}
