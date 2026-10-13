import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "./App";
import { DISCLAIMER } from "./components/Layout";

function at(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("app shell", () => {
  it("keeps site search in the main navigation flow", () => {
    at("/checklist");
    const navigation = screen.getByRole("navigation", { name: "Main" });
    expect(within(navigation).getByRole("button", { name: "Search the site" })).toBeInTheDocument();
  });

  it("renders nav and the fan-project footer on every page", async () => {
    at("/");
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByText("Fan project, not affiliated with NCSOFT. Game data and icons © NCSOFT.")).toBeInTheDocument();
    expect(DISCLAIMER).toContain("not affiliated with NCSOFT");
    expect(await screen.findByRole("link", { name: /Sorcerer/ })).toBeInTheDocument(); // mock list_classes
  });

  it.each([
    ["/build", "Build planner"],
    ["/daevanion", "Daevanion"],
    ["/codex", /sorcerer class guide/i],
    ["/codex/assassin", /assassin class guide/i],
    ["/keybinds", "Quickslots and macros"],
    ["/crafting", "Crafting"],
    ["/enhance", "Enhancement calculator"],
    ["/roadmap", "Progression road map"],
    ["/timers", "Timers"],
    ["/checklist", "Checklist"],
    ["/items", "Items"],
    ["/items/weapons", "Weapons"],
    ["/items/sword", "Sword"],
    ["/items/nope", "Page not found"],
    ["/gear-viewer", "Compare equipment"],
    ["/nope", "Page not found"],
  ])("route %s", (path, heading) => {
    at(path);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
  });

  it("character route loads the mock import and shows playstyle DPS", async () => {
    at("/c/nae/2103/DarthThot");
    expect(await screen.findByRole("heading", { level: 1, name: "DarthThot" }, { timeout: 5000 })).toBeInTheDocument();
    expect(await screen.findByText("Boss DPS", {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it("keeps the encyclopedia open when choosing another class", async () => {
    at("/codex/sorcerer?view=skills");
    const classes = within(await screen.findByRole("navigation", { name: "Classes" }));
    const assassin = await classes.findByRole("link", { name: "Assassin" });
    fireEvent.click(assassin);
    expect(screen.getByRole("heading", { name: "Skill encyclopedia" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Skill encyclopedia" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the encyclopedia open after closing details from a legacy skill link", async () => {
    at("/codex/sorcerer?skill=flame-arrow");
    fireEvent.click(await screen.findByRole("button", { name: "Close details" }));
    expect(screen.getByRole("heading", { name: "Skill encyclopedia" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Skill encyclopedia" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("dialog", { name: /details/ })).toBeNull();
  });

  it("sends the Start here map shortcut to the real map", () => {
    at("/guide");
    expect(screen.getByRole("link", { name: "Explore maps" })).toHaveAttribute("href", "/map/");
  });
});
