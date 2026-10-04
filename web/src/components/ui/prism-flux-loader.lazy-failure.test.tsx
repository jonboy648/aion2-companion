import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PrismFluxLoader } from "./prism-flux-loader";

const sceneLoad = vi.hoisted(() => vi.fn());
vi.mock("./prism-flux-scene", () => {
  sceneLoad();
  throw new Error("Failed to fetch dynamically imported PrismFlux module");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("retains the visible Box and real label after a lazy chunk failure", async () => {
  vi.stubGlobal("WebGL2RenderingContext", function WebGL2RenderingContext() {});
  vi.stubGlobal("matchMedia", undefined);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, width: 54, height: 54, top: 0, right: 54, bottom: 54, left: 0, toJSON() {},
  });
  const gpu = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
  const { container, rerender } = render(<PrismFluxLoader label="Importing..." />);
  await waitFor(() => expect(sceneLoad).toHaveBeenCalledOnce());
  expect(container.querySelector("svg.lucide-box")).toBeVisible();
  expect(container.querySelector("canvas")).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Importing...");
  rerender(<PrismFluxLoader label="Computing..." />);
  expect(screen.getByRole("status")).toHaveTextContent("Computing...");
  expect(container.querySelector("svg.lucide-box")).toBeVisible();
  expect(gpu).not.toHaveBeenCalled();
});
