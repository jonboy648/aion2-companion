import { render, screen } from "@testing-library/react";
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
  it("renders nav and the fan-project footer on every page", async () => {
    at("/");
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByText("Fan project, not affiliated with NCSOFT. Game data and icons © NCSOFT.")).toBeInTheDocument();
    expect(DISCLAIMER).toContain("not affiliated with NCSOFT");
    expect(await screen.findByRole("link", { name: /Sorcerer/ })).toBeInTheDocument(); // mock list_classes
  });

  it.each([
    ["/build", "Manual build"],
    ["/daevanion", "Daevanion"],
    ["/codex", "Codex"],
    ["/codex/assassin", "Codex"],
    ["/keybinds", "Keybinds and macros"],
    ["/crafting", "Crafting"],
    ["/roadmap", "Road map"],
    ["/timers", "Timers"],
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
});
