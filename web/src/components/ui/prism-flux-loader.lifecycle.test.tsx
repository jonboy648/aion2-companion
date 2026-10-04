import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PrismFluxLoader } from "./prism-flux-loader";

const adapter = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("./prism-flux-scene", () => ({ createPrismFluxScene: adapter.create }));

let reduced = false;
let mediaListeners: Set<() => void>;
let intersection: IntersectionObserverCallback;
let disconnect: ReturnType<typeof vi.fn>;
let setActive: ReturnType<typeof vi.fn>;
let dispose: ReturnType<typeof vi.fn>;

beforeEach(() => {
  reduced = false;
  mediaListeners = new Set();
  disconnect = vi.fn();
  setActive = vi.fn();
  dispose = vi.fn();
  adapter.create.mockReset();
  adapter.create.mockImplementation((host: HTMLElement) => {
    const canvas = document.createElement("canvas");
    host.append(canvas);
    dispose.mockImplementation(() => canvas.remove());
    return { setActive, dispose };
  });
  vi.stubGlobal("WebGL2RenderingContext", function WebGL2RenderingContext() {});
  vi.stubGlobal("matchMedia", () => ({
    get matches() { return reduced; },
    addEventListener: (_event: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => mediaListeners.delete(listener),
  }));
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { intersection = callback; }
    observe() {}
    disconnect = disconnect;
  });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, width: 54, height: 54, top: 0, right: 54, bottom: 54, left: 0, toJSON() {},
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function intersect(isIntersecting: boolean) {
  act(() => intersection([{ isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 } as IntersectionObserverEntry], {} as IntersectionObserver));
}

it("keeps the same scene across real progress updates and disposes it on unmount", async () => {
  const { container, rerender, unmount } = render(<PrismFluxLoader label="Importing..." />);
  await waitFor(() => expect(container.querySelector(".prism-flux-loader canvas")).not.toBeNull());
  const canvas = container.querySelector("canvas");
  expect(adapter.create).toHaveBeenCalledOnce();
  expect(adapter.create.mock.calls[0][1]).toMatchObject({ size: 30, side: 54, speed: 5 });
  rerender(<PrismFluxLoader label="Computing..." />);
  expect(screen.getByRole("status")).toHaveTextContent("Computing...");
  expect(container.querySelector("canvas")).toBe(canvas);
  expect(adapter.create).toHaveBeenCalledOnce();
  unmount();
  expect(dispose).toHaveBeenCalledOnce();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(mediaListeners.size).toBe(0);
});

it("pauses for reduced motion, hidden tabs and offscreen surfaces and resumes when visible", async () => {
  reduced = true;
  const visibility = vi.spyOn(document, "visibilityState", "get");
  render(<PrismFluxLoader />);
  await waitFor(() => expect(adapter.create).toHaveBeenCalledOnce());
  expect(setActive).toHaveBeenLastCalledWith(false);
  reduced = false;
  act(() => mediaListeners.forEach(listener => listener()));
  expect(setActive).toHaveBeenLastCalledWith(true);
  visibility.mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  expect(setActive).toHaveBeenLastCalledWith(false);
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  expect(setActive).toHaveBeenLastCalledWith(true);
  intersect(false);
  expect(setActive).toHaveBeenLastCalledWith(false);
  intersect(true);
  expect(setActive).toHaveBeenLastCalledWith(true);
});

it("does not construct a scene for a late import after unmount", async () => {
  const { unmount } = render(<PrismFluxLoader />);
  unmount();
  await act(async () => {});
  expect(adapter.create).not.toHaveBeenCalled();
  expect(mediaListeners.size).toBe(0);
  expect(disconnect).toHaveBeenCalledOnce();
});

it("defers a hidden mount until visible", async () => {
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const { container } = render(<PrismFluxLoader />);
  await act(async () => {});
  expect(adapter.create).not.toHaveBeenCalled();
  expect(container.querySelector("svg.lucide-box")).toBeVisible();
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  await waitFor(() => expect(adapter.create).toHaveBeenCalledOnce());
});

it("defers an offscreen mount and supports legacy motion subscriptions", async () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 9000, width: 54, height: 54, top: 9000, right: 54, bottom: 9054, left: 0, toJSON() {},
  });
  vi.stubGlobal("matchMedia", () => ({
    get matches() { return reduced; },
    addListener: (listener: () => void) => mediaListeners.add(listener),
    removeListener: (listener: () => void) => mediaListeners.delete(listener),
  }));
  const { unmount } = render(<PrismFluxLoader />);
  await act(async () => {});
  expect(adapter.create).not.toHaveBeenCalled();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, width: 54, height: 54, top: 0, right: 54, bottom: 54, left: 0, toJSON() {},
  });
  intersect(true);
  await waitFor(() => expect(adapter.create).toHaveBeenCalledOnce());
  expect(setActive).toHaveBeenLastCalledWith(true);
  reduced = true;
  act(() => mediaListeners.forEach(listener => listener()));
  expect(setActive).toHaveBeenLastCalledWith(false);
  unmount();
  expect(mediaListeners.size).toBe(0);
});

it("renders a static scene safely when matchMedia is missing", async () => {
  vi.stubGlobal("matchMedia", undefined);
  render(<PrismFluxLoader />);
  await waitFor(() => expect(adapter.create).toHaveBeenCalledOnce());
  expect(setActive).toHaveBeenLastCalledWith(false);
});

it.each([[0, 0], [-2, 5], [Number.NaN, 5], [Number.POSITIVE_INFINITY, 5], [20, 10]])(
  "sanitizes speed %s to %s", async (speed, expected) => {
    render(<PrismFluxLoader speed={speed} />);
    await waitFor(() => expect(adapter.create).toHaveBeenCalledOnce());
    expect(adapter.create.mock.calls[0][1].speed).toBe(expected);
    expect(setActive).toHaveBeenLastCalledWith(expected > 0);
  },
);

it("preserves the fallback after asynchronous initialization failure", async () => {
  adapter.create.mockImplementation(() => { throw new Error("GPU unavailable"); });
  const { container } = render(<PrismFluxLoader />);
  await waitFor(() => expect(adapter.create).toHaveBeenCalledOnce());
  expect(container.querySelector("svg.lucide-box")).toBeVisible();
  expect(container.querySelector(".prism-flux-icon")).not.toHaveAttribute("data-scene-ready", "true");
  expect(screen.getByRole("status")).toHaveTextContent("Loading...");
});

it("restores the fallback and cleans up when the adapter reports context loss", async () => {
  const { container } = render(<PrismFluxLoader />);
  await waitFor(() => expect(adapter.create).toHaveBeenCalledOnce());
  act(() => adapter.create.mock.calls[0][1].onFailure());
  expect(dispose).toHaveBeenCalledOnce();
  expect(container.querySelector("canvas")).toBeNull();
  expect(container.querySelector(".prism-flux-icon")).not.toHaveAttribute("data-scene-ready", "true");
  expect(container.querySelector("svg.lucide-box")).toBeVisible();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(mediaListeners.size).toBe(0);
});
