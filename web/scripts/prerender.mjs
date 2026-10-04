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
  const links = allRoutes.filter((r) => !r.path.startsWith("/codex/")).map((r) => `<li><a href="${r.path}">${esc(r.h1)}</a></li>`).join("");
  const text = `<main><h1>${esc(route.h1)}</h1><p>${esc(route.intro)}</p><nav aria-label="Pages"><ul>${links}</ul></nav></main>`;
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
  // Any other URL (a character, an old bookmark) is answered by GitHub Pages with 404.html, which just boots the app.
  const generic = { path: "/", title: `Aion 2 character build | ${seo.site.name}`, h1: seo.site.name, description: seo.routes[0].description, intro: seo.routes[0].intro };
  write("404.html", renderPage(template, generic, seo.site, seo.routes, { noindex: true }));
  write("sitemap.xml", sitemap(seo.site, seo.routes, day));
  const robotsPath = join(distDir, "robots.txt");
  write("robots.txt", robotsWithSitemap(existsSync(robotsPath) ? readFileSync(robotsPath, "utf8") : "User-agent: *\nAllow: /\n", seo.site));
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dist = resolve(process.argv[2] ?? join(here, "../dist"));
  const files = prerender(dist);
  console.log(`prerendered ${files.length} files into ${dist}`);
}
