import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChecklistPage } from "./ChecklistPage";

const t = (iso: string) => Date.parse(iso);

function page() {
  return render(
    <MemoryRouter>
      <ChecklistPage />
    </MemoryRouter>,
  );
}

describe("ChecklistPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ now: t("2026-10-05T15:59:00Z"), toFake: ["Date", "setInterval", "clearInterval"] });
  });
  afterEach(() => vi.useRealTimers());

  it("says tracking is manual and shows the next reset", () => {
    page();
    expect(screen.getByText(/You tick these yourself/)).toBeInTheDocument();
    expect(screen.getByText(/cannot read the game/)).toBeInTheDocument();
  });

  it("adds a pack, ticks a task with a real checkbox, and clears it when the reset passes", () => {
    page();
    fireEvent.click(screen.getByRole("button", { name: /Daily essentials/ }));
    const box = screen.getByRole("checkbox", { name: "Daily quests" });
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(screen.getByText(/1\/4 done/)).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(61_000)); // 16:00:01 UTC, the daily reset has passed
    expect(screen.getByRole("checkbox", { name: "Daily quests" })).not.toBeChecked();
  });

  it("keeps ticks across a reload and clears them if the reset passed while the tab was closed", () => {
    const first = page();
    fireEvent.click(screen.getByRole("button", { name: /Daily essentials/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Daily quests" }));
    first.unmount();
    page();
    expect(screen.getByRole("checkbox", { name: "Daily quests" })).toBeChecked();
    cleanup();
    vi.setSystemTime(t("2026-10-06T10:00:00Z")); // next day, nobody had the page open
    page();
    expect(screen.getByRole("checkbox", { name: "Daily quests" })).not.toBeChecked();
  });

  it("counts runs with plus and minus", () => {
    page();
    fireEvent.click(screen.getByRole("button", { name: /Daily essentials/ }));
    fireEvent.click(screen.getByRole("button", { name: "One more for Abyss supply requests" }));
    expect(screen.getByText("1/3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "One fewer for Abyss supply requests" }));
    expect(screen.getByText("0/3")).toBeInTheDocument();
  });

  it("keeps separate ticks per character", () => {
    page();
    fireEvent.click(screen.getByRole("button", { name: /Daily essentials/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Daily quests" }));
    fireEvent.change(screen.getByLabelText("New character name"), { target: { value: "Alt" } });
    fireEvent.click(screen.getByRole("button", { name: "Add character" }));
    expect(screen.getByRole("button", { name: "Alt" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "Daily quests" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Main" }));
    expect(screen.getByRole("checkbox", { name: "Daily quests" })).toBeChecked();
  });
});
