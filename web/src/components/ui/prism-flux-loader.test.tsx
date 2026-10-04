import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PrismFluxLoader } from "./prism-flux-loader";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps a real fallback and caller-owned status without GPU access or status timers", () => {
  const gpu = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
  const interval = vi.spyOn(window, "setInterval");
  const { container, rerender } = render(<PrismFluxLoader label="Importing character..." />);
  const status = screen.getByRole("status");
  expect(status).toHaveAttribute("aria-live", "polite");
  expect(status).toHaveTextContent("Importing character...");
  expect(container.querySelector("svg.lucide-box")).toBeVisible();
  expect(container.querySelector("canvas")).toBeNull();
  rerender(<PrismFluxLoader label="Computing build..." />);
  expect(screen.getByRole("status")).toBe(status);
  expect(status).toHaveTextContent("Computing build...");
  expect(status).not.toHaveTextContent(/Fetching|Fixing|Syncing/);
  expect(gpu).not.toHaveBeenCalled();
  expect(interval).not.toHaveBeenCalled();
});

it("defaults to a centered status and a stable rotation slot", () => {
  const { container } = render(<PrismFluxLoader className="import-pending" />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading...");
  expect(container.firstElementChild).toHaveClass("import-pending");
  expect(container.firstElementChild).toHaveStyle({ fontSize: "14px" });
  expect(container.querySelector(".prism-flux-icon")).toHaveStyle({ width: "54px", height: "54px" });
  expect(container.querySelector("svg")).toHaveAttribute("width", "30");
});

it.each([
  [Number.NaN, Number.POSITIVE_INFINITY, "30", "54px", "14px"],
  [-1, 0, "30", "54px", "14px"],
  [2, 2, "16", "29px", "12px"],
  [500, 500, "96", "173px", "24px"],
])("bounds size %s and textSize %s", (size, textSize, icon, side, fontSize) => {
  const { container } = render(<PrismFluxLoader size={size} textSize={textSize} />);
  expect(container.querySelector("svg")).toHaveAttribute("width", icon);
  expect(container.querySelector(".prism-flux-icon")).toHaveStyle({ width: side, height: side });
  expect(container.firstElementChild).toHaveStyle({ fontSize });
});

it("supports a decorative cube within an existing status without adding announcements", () => {
  const { container } = render(<div role="status">Import pending<PrismFluxLoader label={null} /></div>);
  expect(screen.getAllByRole("status")).toHaveLength(1);
  const loader = container.querySelector(".prism-flux-loader")!;
  expect(loader).toHaveAttribute("aria-hidden", "true");
  expect(loader).not.toHaveAttribute("aria-live");
  expect(loader).not.toHaveAttribute("role");
  expect(loader.querySelector(".prism-flux-label")).toBeNull();
  expect(loader.querySelector("svg.lucide-box")).toBeVisible();
});
