// Build step (after `vite build`): writes one static HTML page per fixed route so search engines and link previews get a
// real <title>, description, canonical and text without running JavaScript, plus a 404.html that boots the app for
// character URLs (/c/region/server/name, not indexed), sitemap.xml and the robots.txt Sitemap line.
// The app replaces the static text as soon as it loads. Run: node scripts/prerender.mjs [distDir]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SEO = JSON.parse(readFileSync(join(here, "../src/seo/routes.json"), "utf8"));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Public URL of a route as GitHub Pages serves it: folder pages live at a trailing-slash URL. */
export const urlFor = (site, path) => `${site.url}${path === "/" ? "/" : `${path}/`}`;

/** Replace the first match of `re`. `to` is literal text (never expanded, so "$" in copy is safe) or a function of the match. */
function replaceOnce(html, re, to) {
  if (!re.test(html)) throw new Error(`index.html template is missing ${re}`);
  return html.replace(re, (m) => (typeof to === "function" ? to(m) : to));
}

/** The index.html template with this route's head tags and a plain-text fallback inside #root. */
export function renderPage(template, route, site, allRoutes, { noindex = false } = {}) {
  const url = urlFor(site, route.path);
  let h = template;
  h = replaceOnce(h, /<title>[^<]*<\/title>/, `<title>${esc(route.title)}</title>`);
  h = replaceOnce(h, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(route.description)}" />`);
  h = replaceOnce(h, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`);
  h = replaceOnce(h, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(route.title)}" />`);
  h = replaceOnce(h, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(route.description)}" />`);
  h = replaceOnce(h, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`);
  h = replaceOnce(h, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${esc(route.title)}" />`);
  h = replaceOnce(h, /<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${esc(route.description)}" />`);
  if (noindex) h = replaceOnce(h, /<meta name="viewport"[^>]*\/>/, (m) => `${m}\n    <meta name="robots" content="noindex" />`);
  const links = allRoutes.filter((r) => !r.path.startsWith("/codex/")).map((r) => `<li><a href="${r.path === "/" ? "/" : `${r.path}/`}">${esc(r.h1)}</a></li>`).join("");
  // item database pages carry their own text (`extra`, already escaped HTML) and skip the site nav to stay small
  const nav = route.extra === undefined ? `<nav aria-label="Pages"><ul>${links}</ul></nav>` : "";
  const text = `<main><h1>${esc(route.h1)}</h1><p>${esc(route.intro)}</p>${route.extra ?? ""}${nav}</main>`;
  h = replaceOnce(h, /<div id="root"><\/div>/, `<div id="root">${text}</div>`);
  return h;
}

export function sitemap(site, routes, day) {
  const urls = routes.map((r) => `  <url><loc>${urlFor(site, r.path)}</loc><lastmod>${day}</lastmod></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Add the Sitemap line to robots.txt once. */
export function robotsWithSitemap(robots, site) {
  const line = `Sitemap: ${site.url}/sitemap.xml`;
  return robots.includes(line) ? robots : `${robots.trimEnd()}\n${line}\n`;
}

const num = (n) => (Number.isInteger(n) ? n.toLocaleString("en-US") : String(Math.round(n * 100) / 100));
const rng = (lo, hi) => (lo !== undefined && lo !== hi ? `${num(lo)} - ${num(hi)}` : num(hi));
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/**
 * Item database pages for a built dist (public/items copied in by vite): five group pages, one page per category and one
 * per item, each with plain-text stats so search engines see them without running JavaScript. Empty when dist has no items/.
 */
export function itemRoutes(distDir, site = SEO.site) {
  const indexFile = join(distDir, "items/index.json");
  if (!existsSync(indexFile)) return [];
  const index = readJson(indexFile);
  const labels = readJson(join(here, "../src/features/items/statLabels.json"));
  const label = (id) => labels[id] ?? id.replace(/([a-z])([A-Z])/g, "$1 $2");
  const li = (href, text) => `<li><a href="${href}/">${esc(text)}</a></li>`;
  const routes = [];
  for (const g of index.groups) {
    if (g.kind === "sets") {
      const { sets } = readJson(join(distDir, "items/sets.json"));
      routes.push({
        path: `/items/${g.key}`,
        title: `Aion 2 item sets and set bonuses | ${site.name}`,
        h1: g.label,
        description: `Aion 2 item sets with their 2 and 4 piece bonuses and the items in each set: ${sets.map((s) => s.name).join(", ")}.`.slice(0, 160),
        intro: `${sets.length} Aion 2 item sets and what wearing 2 or 4 pieces gives you.`,
        extra: sets
          .map((s) => `<h2>${esc(s.name)}</h2><ul>${s.bonuses.map((b) => `<li>${b.pieces} pieces: ${esc(b.text)}</li>`).join("")}</ul><ul>${s.items.map((i) => li(`/items/${i.id}`, i.n)).join("")}</ul>`)
          .join("") + `<p><a href="/items/">All item categories</a></p>`,
      });
      continue;
    }
    const gear = g.kind === "gear";
    const total = g.cats.reduce((n, c) => n + c.count, 0);
    routes.push({
      path: `/items/${g.key}`,
      title: `Aion 2 ${g.label.toLowerCase()}: ${total} items | ${site.name}`,
      h1: g.label,
      description: `All ${total} Aion 2 ${g.label.toLowerCase()} by category (${g.cats.map((c) => c.label).join(", ")}) with grade${gear ? ", level and stats" : " and description"}.`.slice(0, 160),
      intro: `${total} Aion 2 items in ${g.label.toLowerCase()}.`,
      extra: `<ul>${g.cats.map((c) => li(`/items/${c.key}`, `${c.label} (${c.count})`)).join("")}</ul><p><a href="/items/">All item categories</a></p>`,
    });
    for (const c of g.cats) {
      // gear has a detail file; other items are rows of their category file, reshaped here to the same fields
      const list = gear
        ? Object.values(readJson(join(distDir, `items/detail/${c.key}.json`)).items)
        : readJson(join(distDir, `items/cat/${c.key}.json`)).items.map((r) => ({ id: r.id, name: r.n, grade: r.g, equip_level: r.el, desc: r.d ?? "", main: [], subs: [], sources: [], class_lock: [] }));
      routes.push({
        path: `/items/${c.key}`,
        title: `Aion 2 ${c.label} ${gear ? "items: stats and grades" : "list"} | ${site.name}`,
        h1: c.label,
        description: (gear
          ? `All ${c.count} Aion 2 ${c.label.toLowerCase()} items with grade, item level, required level and base stats. Open one for random stat ranges.`
          : `All ${c.count} Aion 2 ${c.label.toLowerCase()} with grade, required level and what each one does.`
        ).slice(0, 160),
        intro: `${c.count} ${c.label.toLowerCase()} in ${g.label.toLowerCase()}.`,
        extra: `<ul>${list.map((i) => li(`/items/${i.id}`, `${i.name} (${i.grade}${gear ? `, item level ${i.il}` : ""})`)).join("")}</ul><p><a href="/items/${g.key}/">${esc(g.label)}</a></p>`,
      });
      for (const i of list) {
        const main = i.main.map((s) => `${label(s.id)} ${rng(s.min, s.v)}`);
        const subs = i.subs.map((s) => `<li>${esc(label(s.id))}: ${rng(s.min, s.v)}</li>`).join("");
        const facts = gear
          ? `${i.grade} ${c.label.toLowerCase()}, item level ${i.il}, needs level ${i.equip_level}${i.class_lock.length ? `, ${i.class_lock.join(", ")} only` : ""}.`
          : `${i.grade} ${c.label.toLowerCase()}${i.equip_level > 1 ? `, needs level ${i.equip_level}` : ""}.`;
        routes.push({
          path: `/items/${i.id}`,
          title: `${i.name} (${i.grade} ${c.label}) | ${site.name}`,
          h1: i.name,
          description: `${i.name}: ${facts} ${gear ? main.join(", ") : i.desc}`.trim().slice(0, 160),
          intro: facts,
          extra:
            (gear ? `<h2>Stats</h2><ul>${i.main.map((s) => `<li>${esc(label(s.id))}: ${rng(s.min, s.v)}</li>`).join("")}</ul>` : "") +
            (!gear && i.desc ? `<h2>Description</h2><p>${esc(i.desc)}</p>` : "") +
            (i.max_enchant ? `<p>Max enchant +${i.max_enchant}.</p>` : "") +
            (subs ? `<h2>${i.sub_random ? "Random stats" : "Extra stats"}</h2><ul>${subs}</ul>` : "") +
            (i.sources.length ? `<h2>Where to get it</h2><p>${esc(i.sources.join(", "))}</p>` : "") +
            `<p><a href="/items/${c.key}/">${esc(c.label)}</a> - <a href="/items/">Items</a></p>`,
        });
      }
    }
  }
  return routes;
}

/** Write everything into distDir. Returns the files written (relative to distDir). */
export function prerender(distDir, { seo = SEO, day = new Date().toISOString().slice(0, 10) } = {}) {
  const template = readFileSync(join(distDir, "index.html"), "utf8");
  const written = [];
  const write = (rel, text) => {
    const file = join(distDir, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
    written.push(rel);
  };
  for (const route of seo.routes) {
    write(route.path === "/" ? "index.html" : `${route.path.slice(1)}/index.html`, renderPage(template, route, seo.site, seo.routes));
  }
  const items = itemRoutes(distDir, seo.site);
  for (const route of items) write(`${route.path.slice(1)}/index.html`, renderPage(template, route, seo.site, seo.routes));
  // Any other URL (a character, an old bookmark) is answered by GitHub Pages with 404.html, which just boots the app.
  const generic = { path: "/", title: `Aion 2 character build | ${seo.site.name}`, h1: seo.site.name, description: seo.routes[0].description, intro: seo.routes[0].intro };
  write("404.html", renderPage(template, generic, seo.site, seo.routes, { noindex: true }));
  write("sitemap.xml", sitemap(seo.site, [...seo.routes, ...items], day));
  const robotsPath = join(distDir, "robots.txt");
  write("robots.txt", robotsWithSitemap(existsSync(robotsPath) ? readFileSync(robotsPath, "utf8") : "User-agent: *\nAllow: /\n", seo.site));
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dist = resolve(process.argv[2] ?? join(here, "../dist"));
  const files = prerender(dist);
  console.log(`prerendered ${files.length} files into ${dist}`);
}
