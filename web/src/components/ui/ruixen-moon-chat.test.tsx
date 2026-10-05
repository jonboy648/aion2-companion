import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import RuixenMoonChat from "./ruixen-moon-chat";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function show(reduced = false) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  return render(<MemoryRouter><RuixenMoonChat title="Become Cube" description="Search" actions={[]}><input aria-label="Character name" /></RuixenMoonChat></MemoryRouter>);
}

describe("Home scenery", () => {
  it("switches scenes explicitly and pauses automatic rotation", () => {
    const { container } = show();
    fireEvent.load(container.querySelectorAll(".home-rotating-scene")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Celestial Cathedral" }));
    expect(screen.getByRole("button", { name: "Celestial Cathedral" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector('[data-active="true"]')).toHaveAttribute("src", "/brand/scenes/celestial-cathedral.png");
    expect(container.querySelector(".moon-home")).toHaveAttribute("data-motion", "paused");
  });
  it("rotates on its interval and clears timers on unmount", () => {
    vi.useFakeTimers();
    const { unmount } = show();
    fireEvent.click(screen.getByRole("button", { name: "Moonlit Sky City" }));
    fireEvent.click(screen.getByRole("button", { name: "Play background animation" }));
    act(() => vi.advanceTimersByTime(14000));
    expect(screen.getByRole("button", { name: "Celestial Cathedral" })).toHaveAttribute("aria-pressed", "true");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps reduced-motion scenery static with manual selection available", () => {
    vi.useFakeTimers();
    const { container } = show(true);
    act(() => vi.advanceTimersByTime(28000));
    expect(screen.getByRole("button", { name: "Emerald Gorge" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Play background animation" })).toBeDisabled();
    expect(container.querySelector(".moon-home")).toHaveAttribute("data-motion", "paused");
  });
});
