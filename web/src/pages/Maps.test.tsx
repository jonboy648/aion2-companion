import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "@/App";
import { Maps, MAP_SITES } from "./Maps";

describe("Maps page", () => {
  it("links out to each community map safely, in a new tab", () => {
    render(<MemoryRouter><Maps /></MemoryRouter>);
    for (const s of MAP_SITES) {
      const a = screen.getByRole("link", { name: new RegExp(s.name) });
      expect(a.getAttribute("href")).toBe(s.url);
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
    }
    expect(screen.getByRole("link", { name: /Open interactive map/ })).toHaveAttribute("href", "/map/");
  });

  it("links directly to the interactive map from the top nav and keeps the footer directory", () => {
    render(
      <MemoryRouter initialEntries={["/maps"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Maps" })).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Maps" })).toHaveAttribute("href", "/map/");
    const footerLink = within(screen.getByRole("navigation", { name: "Footer community" })).getByRole("link", { name: "Maps" });
    expect(footerLink).toBeTruthy();
    expect(footerLink!.closest('nav[aria-label="Main"]')).toBeNull(); // not in the main nav
  });
});
