import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Layout } from "./Layout";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function at(path = "/") {
  return render(
    <MemoryRouter initialEntries={["/checklist", path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="*" element={<PageContent />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function PageContent() {
  const navigate = useNavigate();
  return <><h1>Page content</h1><button onClick={() => navigate(-1)}>Back</button></>;
}

describe("site navigation", () => {
  it("keeps Home and Start here visible and groups the other workflows", () => {
    at();
    const navigation = within(screen.getByRole("navigation", { name: "Main" }));
    expect(navigation.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(navigation.getByRole("link", { name: "Start here" })).toHaveAttribute("href", "/guide");
    expect(navigation.getByRole("button", { name: "Search the site" })).toBeInTheDocument();
    for (const name of ["Plan", "Database", "World"]) {
      expect(navigation.getByRole("button", { name })).toHaveAttribute("aria-expanded", "false");
    }
    expect(navigation.queryByRole("link", { name: "Build planner" })).toBeNull();
    fireEvent.click(navigation.getByRole("button", { name: "Plan" }));
    expect(navigation.getByRole("link", { name: "Build planner" })).toHaveAttribute("href", "/build");
  });

  it("opens tools from the keyboard and returns focus on Escape", () => {
    at();
    const navigation = within(screen.getByRole("navigation", { name: "Main" }));
    const trigger = navigation.getByRole("button", { name: "Plan" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const first = navigation.getByRole("link", { name: "Class guides" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(navigation.getByRole("link", { name: "Build planner" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(navigation.getByRole("link", { name: "Enhancement calculator" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    expect(navigation.queryByRole("link", { name: "Class guides" })).toBeNull();
  });

  it("dismisses tools when clicking outside or tabbing to a primary link", () => {
    at();
    const navigation = within(screen.getByRole("navigation", { name: "Main" }));
    const trigger = navigation.getByRole("button", { name: "Plan" });
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole("heading", { name: "Page content" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    fireEvent.blur(navigation.getByRole("link", { name: "Class guides" }), {
      relatedTarget: navigation.getByRole("link", { name: "Home" }),
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the compact navigation and closes it with Escape", () => {
    at();
    const navigation = within(screen.getByRole("navigation", { name: "Main" }));
    const toggle = navigation.getByRole("button", { name: "Open navigation" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(navigation.getByRole("button", { name: "Close navigation" })).toHaveAttribute("aria-expanded", "true");
    expect(navigation.getByRole("button", { name: "Plan" })).toHaveFocus();
    fireEvent.click(navigation.getByRole("button", { name: "World" }));
    expect(navigation.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map/");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(navigation.getByRole("button", { name: "World" })).toHaveAttribute("aria-expanded", "false");
  });

  it("uses the same destinations in menus and the footer, retaining legacy resources", () => {
    at();
    const navigation = within(screen.getByRole("navigation", { name: "Main" }));
    const footer = within(screen.getByRole("contentinfo"));
    for (const [group, labels] of [
      ["Plan", ["Class guides", "Build planner", "Daevanion", "Compare characters", "Quickslots and macros", "Enhancement calculator"]],
      ["Database", ["Skill encyclopedia", "Items", "Compare equipment", "Crafting", "Progression road map"]],
      ["World", ["Map", "Timers", "Daily and weekly checklist"]],
    ] as const) {
      fireEvent.click(navigation.getByRole("button", { name: group }));
      for (const label of labels) {
        expect(footer.getByRole("link", { name: label })).toHaveAttribute(
          "href", navigation.getByRole("link", { name: label }).getAttribute("href"),
        );
      }
    }
    expect(footer.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map/");
    expect(footer.getByRole("link", { name: "Map resources and legacy pins" })).toHaveAttribute("href", "/maps");
    expect(footer.getByRole("link", { name: "Board" })).toHaveAttribute("href", "/board");
    expect(navigation.queryByRole("link", { name: "Board" })).toBeNull();
  });

  it.each([
    ["/codex/ranger", "Class guides", "Skill encyclopedia"],
    ["/codex/ranger?view=skills", "Skill encyclopedia", "Class guides"],
    ["/codex/ranger?skill=arrow", "Skill encyclopedia", "Class guides"],
  ])("marks only the current Codex workflow at %s", (path, current, other) => {
    at(path);
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByRole("link", { name: current })).toHaveAttribute("aria-current", "page");
    expect(footer.getByRole("link", { name: other })).not.toHaveAttribute("aria-current");
  });

  it("dismisses open navigation when browser history changes the page", () => {
    at("/build");
    const navigation = within(screen.getByRole("navigation", { name: "Main" }));
    fireEvent.click(navigation.getByRole("button", { name: "Open navigation" }));
    fireEvent.click(navigation.getByRole("button", { name: "Plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(navigation.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
    expect(navigation.getByRole("button", { name: "Plan" })).toHaveAttribute("aria-expanded", "false");
  });

  it("starts a newly selected page at the top without overriding Back scroll restoration", () => {
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    at("/roadmap");
    expect(scroll).not.toHaveBeenCalled();
    const navigation = within(screen.getByRole("navigation", { name: "Main" }));
    fireEvent.click(navigation.getByRole("button", { name: "Plan" }));
    fireEvent.click(navigation.getByRole("link", { name: "Build planner" }));
    expect(scroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
    scroll.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(scroll).not.toHaveBeenCalled();
  });

  it("dismisses compact navigation when keyboard focus leaves the header", () => {
    at();
    const navigation = within(screen.getByRole("navigation", { name: "Main" }));
    fireEvent.click(navigation.getByRole("button", { name: "Open navigation" }));
    fireEvent.blur(navigation.getByRole("button", { name: "Plan" }), {
      relatedTarget: screen.getByRole("button", { name: "Back" }),
    });
    expect(navigation.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  });
});
