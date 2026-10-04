// @vitest-environment node
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PrismFluxLoader } from "./prism-flux-loader";

const sceneLoad = vi.hoisted(() => vi.fn());
vi.mock("./prism-flux-scene", () => {
  sceneLoad();
  throw new Error("SSR must not import the GPU adapter");
});

it("renders the labelled fallback without browser globals or loading Three", () => {
  expect(typeof window).toBe("undefined");
  const html = renderToString(<PrismFluxLoader label="Importing character..." />);
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain("Importing character...");
  expect(html).toContain("lucide-box");
  expect(html).not.toContain("<canvas");
  expect(html).not.toContain("aria-busy");
  expect(sceneLoad).not.toHaveBeenCalled();
});

it("renders a decorative fallback without a nested status", () => {
  const html = renderToString(<PrismFluxLoader label={null} size={Number.NaN} />);
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('width="30"');
  expect(html).toContain("width:54px;height:54px");
  expect(html).not.toContain('role="status"');
  expect(html).not.toContain("aria-live");
  expect(html).not.toContain("Loading...");
  expect(sceneLoad).not.toHaveBeenCalled();
});
