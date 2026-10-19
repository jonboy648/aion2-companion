import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "@/App";
import { Maps, MAP_SITES } from "./Maps";

describe("Maps page", () => {
  it("links out to each community map safely, in a new tab", () => {
    render(<MemoryRouter><Maps /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Map resources" })).toBeInTheDocument();
    for (const s of MAP_SITES) {
      const a = screen.getByRole("link", { name: new RegExp(s.name) });
      expect(a.getAttribute("href")).toBe(s.url);
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
    }
    expect(screen.getByRole("link", { name: /Open interactive map/ })).toHaveAttribute("href", "/map/");
  });

  it("links to the same real map from the menu and footer and retains the resource directory", () => {
    render(
      <MemoryRouter initialEntries={["/maps"]}>
        <App />
      </MemoryRouter>,
    );
    const navigation = within(screen.getByRole("navigation", { name: "Main" }));
    fireEvent.click(navigation.getByRole("button", { name: "World" }));
    expect(navigation.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map/");
    const footer = within(screen.getByRole("navigation", { name: "Footer community" }));
    expect(footer.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map/");
    expect(footer.getByRole("link", { name: "Map resources and legacy pins" })).toHaveAttribute("href", "/maps");
  });
});
