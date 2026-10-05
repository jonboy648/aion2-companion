import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { prerender, renderPage, robotsWithSitemap, sitemap, urlFor } from "./prerender.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const seo = JSON.parse(readFileSync(join(here, "../src/seo/routes.json"), "utf8"));
const template = readFileSync(join(here, "../index.html"), "utf8");

function build() {
  const dist = mkdtempSync(join(tmpdir(), "prerender-"));
  writeFileSync(join(dist, "index.html"), template);
  writeFileSync(join(dist, "robots.txt"), "User-agent: *\nAllow: /\n");
  const files = prerender(dist, { day: "2026-10-04" });
  return { dist, files, read: (f) => readFileSync(join(dist, f), "utf8") };
}

describe("prerender", () => {
  it("writes a page per route with its own head tags and text, a noindex 404.html, a sitemap and robots", () => {
    const { dist, files, read } = build();
    expect(files.length).toBe(seo.routes.length + 3);
    for (const r of seo.routes) {
      const file = r.path === "/" ? "index.html" : `${r.path.slice(1)}/index.html`;
      const html = read(file);
      expect(html).toContain(`<title>${r.title}</title>`);
      expect(html).toContain(`content="${r.description}"`);
      expect(html).toContain(`<link rel="canonical" href="${urlFor(seo.site, r.path)}" />`);
      expect(html).toContain(`<h1>${r.h1}</h1>`);
      expect(html).toContain('<a href="/guide/">'); // crawlable links use the same trailing-slash URLs as the canonicals and sitemap
      expect(html).not.toMatch(/<a href="\/[a-z]+">/);
      expect(html).toContain('<script type="module"'); // the app still boots
      expect(html).not.toContain('name="robots"');
    }
    const nf = read("404.html");
    expect(nf).toContain('<meta name="robots" content="noindex" />');
    expect(nf).toMatch(/<meta name="viewport"[^>]*\/>\s*<meta name="robots"/);
    for (const f of files.filter((x) => x.endsWith(".html"))) expect(read(f), f).not.toMatch(/\$\d/); // no unexpanded placeholders
    expect(nf).toContain('<script type="module"');
    expect(existsSync(join(dist, "codex/sorcerer/index.html"))).toBe(true);
    const sm = read("sitemap.xml");
    expect(sm.match(/<loc>/g).length).toBe(seo.routes.length);
    expect(sm).toContain("<loc>https://becomecube.com/</loc>");
    expect(sm).toContain("<loc>https://becomecube.com/codex/sorcerer/</loc>");
    expect(sm).not.toContain("/c/"); // characters are never listed
    expect(read("robots.txt")).toBe("User-agent: *\nAllow: /\nSitemap: https://becomecube.com/sitemap.xml\n");
  });

  it("is safe to run twice, and escapes text in the head and body", () => {
    expect(robotsWithSitemap(robotsWithSitemap("User-agent: *\nAllow: /\n", seo.site), seo.site).match(/Sitemap:/g).length).toBe(1);
    const html = renderPage(template, { path: "/x", title: 'A "B" <c>', h1: "<h>", description: "d & e", intro: "<i>" }, seo.site, seo.routes);
    expect(html).toContain("<title>A &quot;B&quot; &lt;c&gt;</title>");
    expect(html).toContain("<h1>&lt;h&gt;</h1>");
    expect(sitemap(seo.site, [{ path: "/" }], "2026-10-04")).toContain("<lastmod>2026-10-04</lastmod>");
  });

  it("fails loudly if the template no longer has a tag it rewrites", () => {
    expect(() => renderPage("<html></html>", seo.routes[0], seo.site, seo.routes)).toThrow(/missing/);
  });
});

describe("prerender item database", () => {
  it("writes a page for every group, category and item with its own title and stats, and lists them in the sitemap", () => {
    const dist = mkdtempSync(join(tmpdir(), "prerender-items-"));
    writeFileSync(join(dist, "index.html"), template);
    cpSync(join(here, "../public/items"), join(dist, "items"), { recursive: true });
    const index = JSON.parse(readFileSync(join(dist, "items/index.json"), "utf8"));
    const cats = index.groups.flatMap((g) => g.cats);
    const total = cats.reduce((n, c) => n + c.count, 0);
    const t0 = Date.now();
    const files = prerender(dist, { day: "2026-10-05" });
    const ms = Date.now() - t0;
    expect(files.filter((f) => /^items\/[^/]+\/index\.html$/.test(f)).length).toBe(index.groups.length + cats.length + total);
    const html = readFileSync(join(dist, "items/110120003/index.html"), "utf8");
    expect(html).toContain("<title>Ludra's Blade of Extinction (Unique Greatsword) | Become Cube</title>");
    expect(html).toContain("<li>Attack: 446 - 604</li>");
    expect(html).toContain("<h2>Random stats</h2>");
    expect(html).toContain('<link rel="canonical" href="https://becomecube.com/items/110120003/" />');
    expect(html).not.toContain('aria-label="Pages"');
    expect(readFileSync(join(dist, "items/greatsword/index.html"), "utf8")).toContain('href="/items/110120003/"');
    expect(readFileSync(join(dist, "items/weapons/index.html"), "utf8")).toContain('href="/items/greatsword/"');
    const sm = readFileSync(join(dist, "sitemap.xml"), "utf8");
    expect(sm.match(/<loc>/g).length).toBe(seo.routes.length + index.groups.length + cats.length + total);
    expect(sm).toContain("<loc>https://becomecube.com/items/110120003/</loc>");
    expect(sm).toContain("<loc>https://becomecube.com/gear-viewer/</loc>");
    expect(ms).toBeLessThan(30000);
  }, 60000);
});
