import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import classes from "@/fixtures/list_classes.json";
import { DocumentMeta, metaFor } from "./DocumentMeta";
import seo from "./routes.json";

const FIXED = ["/", "/guide", "/build", "/daevanion", "/compare", "/codex", "/keybinds", "/crafting", "/roadmap", "/board", "/maps", "/timers", "/server-status"];

describe("seo route table", () => {
  it("has a unique, well-formed entry for every fixed page and every class page", () => {
    const paths = seo.routes.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of [...FIXED, ...classes.map((c) => `/codex/${c.key}`)]) expect(paths).toContain(p);
    for (const r of seo.routes) {
      expect(r.title.length).toBeGreaterThan(10);
      expect(r.title.length).toBeLessThanOrEqual(62);
      expect(r.description.length).toBeGreaterThan(50);
      expect(r.description.length).toBeLessThanOrEqual(160);
      expect(r.h1 && r.intro).toBeTruthy();
    }
    expect(new Set(seo.routes.map((r) => r.title)).size).toBe(seo.routes.length); // every page has its own title
    expect(new Set(seo.routes.map((r) => r.description)).size).toBe(seo.routes.length);
  });

  it("indexes fixed pages and never indexes characters, compare links, the dashboard or unknown paths", () => {
    expect(metaFor("/guide").noindex).toBe(false);
    expect(metaFor("/guide/").title).toBe(metaFor("/guide").title); // trailing slash is the same page
    expect(metaFor("/codex/sorcerer").noindex).toBe(false);
    for (const p of ["/c/nae/1101/Luna", "/compare/nae~1~A/-", "/admin", "/nonsense"]) expect(metaFor(p).noindex, p).toBe(true);
    expect(metaFor("/compare/nae~1~A/-").canonicalPath).toBe("/compare");
  });
});

describe("DocumentMeta", () => {
  afterEach(() => {
    document.title = "";
    document.head.querySelectorAll('meta[name="robots"], link[rel="canonical"], meta[name="description"], meta[property^="og:"]').forEach((e) => e.remove());
  });
  const at = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <DocumentMeta />
      </MemoryRouter>,
    );
  const get = (sel: string, attr: string) => document.head.querySelector(sel)?.getAttribute(attr) ?? null;

  it("sets the title, description, canonical (trailing slash) and previews for a fixed page, without noindex", () => {
    at("/keybinds");
    const r = seo.routes.find((x) => x.path === "/keybinds")!;
    expect(document.title).toBe(r.title);
    expect(get('meta[name="description"]', "content")).toBe(r.description);
    expect(get('link[rel="canonical"]', "href")).toBe("https://becomecube.com/keybinds/");
    expect(get('meta[property="og:url"]', "content")).toBe("https://becomecube.com/keybinds/");
    expect(get('meta[property="og:title"]', "content")).toBe(r.title);
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it("marks a character page noindex and removes it again on an indexable page", () => {
    const { unmount } = at("/c/nae/1101/Luna");
    expect(get('meta[name="robots"]', "content")).toBe("noindex");
    expect(document.title).toContain("Aion 2 character build");
    unmount();
    at("/");
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    expect(get('link[rel="canonical"]', "href")).toBe("https://becomecube.com/");
  });
});
