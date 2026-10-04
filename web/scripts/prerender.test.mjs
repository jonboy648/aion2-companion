import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
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
