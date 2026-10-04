import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "@/App";
import { Maps, MAP_SITES } from "./Maps";

describe("Maps page", () => {
  it("links out to each community map safely, in a new tab", () => {
    render(<Maps />);
    for (const s of MAP_SITES) {
      const a = screen.getByRole("link", { name: new RegExp(s.name) });
      expect(a.getAttribute("href")).toBe(s.url);
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
    }
    expect(screen.getByText(/do not host or copy any map art/)).toBeTruthy();
  });

  it("is reachable at /maps and from the footer, not the top nav", () => {
    render(
      <MemoryRouter initialEntries={["/maps"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Maps" })).toBeTruthy();
    const footerLink = screen.getAllByRole("link", { name: "Maps" }).find((a) => a.getAttribute("href") === "/maps");
    expect(footerLink).toBeTruthy();
    expect(footerLink!.closest("nav")).toBeNull(); // not in the main nav
  });
});
