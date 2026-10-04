import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

/** The inline script in index.html that turns old /#/x links into /x. Run it as the browser would. */
const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../index.html"), "utf8");
const script = /<script>\s*([\s\S]*?Old shared links[\s\S]*?)<\/script>/.exec(html)[1];

afterEach(() => window.history.replaceState(null, "", "/"));

describe("old hash links", () => {
  it("are rewritten to the real path before the app starts", () => {
    window.history.replaceState(null, "", "/#/c/nae/1101/Luna");
    new Function(script)();
    expect(window.location.pathname + window.location.hash).toBe("/c/nae/1101/Luna");
  });

  it("keep their query string, and normal addresses are left alone", () => {
    window.history.replaceState(null, "", "/#/daevanion?c=nae%2F2103%2FDarthThot");
    new Function(script)();
    expect(window.location.pathname + window.location.search).toBe("/daevanion?c=nae%2F2103%2FDarthThot");
    window.history.replaceState(null, "", "/guide/");
    new Function(script)();
    expect(window.location.pathname).toBe("/guide/");
  });

  it("are also rewritten when pasted into a tab that is already open, and the router is told", async () => {
    window.history.replaceState(null, "", "/board");
    new Function(script)();
    let popped = 0;
    window.addEventListener("popstate", () => popped++);
    window.location.hash = "#/guide";
    await new Promise((r) => setTimeout(r, 50));
    expect(window.location.pathname).toBe("/guide");
    expect(popped).toBeGreaterThan(0);
  });
});
