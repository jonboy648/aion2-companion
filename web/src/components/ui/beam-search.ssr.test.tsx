// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BeamSearch from "./beam-search";

const libraryLoad = vi.hoisted(() => vi.fn());
vi.mock("border-beam", () => {
  libraryLoad();
  throw new Error("Server rendering must not load the decorative beam");
});

describe("BeamSearch server rendering", () => {
  it.each(["auto", "dark", "light"] as const)("renders theme %s without browser globals or animations", theme => {
    const html = renderToString(<BeamSearch theme={theme} alwaysOn defaultValue="Ariel" aria-label="Name" />);
    expect(html).toContain('value="Ariel"');
    expect(html).toContain(`data-beam-theme="${theme === "auto" ? "dark" : theme}"`);
    expect(html).not.toContain("data-beam=");
    expect(html).not.toContain("@keyframes");
    expect(libraryLoad).not.toHaveBeenCalled();
  });
});
