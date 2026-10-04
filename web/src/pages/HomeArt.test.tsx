import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Home } from "./Home";
import { BrandCrest } from "@/components/ui/brand-crest";

describe("original Home artwork preview", () => {
  it("keeps the original content and navigation in the Home visual preview", () => {
    const { container } = render(
      <MemoryRouter><Home /></MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Become Cube");
    expect(screen.getByRole("heading", { name: /No character\? Build one by hand/ })).toBeVisible();
    expect(screen.getByText(/Import a character from the official armory/)).toBeVisible();
    expect(within(screen.getByRole("navigation", { name: "Quick actions" })).getByRole("link", { name: "Start here" })).toHaveAttribute("href", "/guide");
    expect(screen.getByRole("search", { name: "Character search" })).toBeVisible();
    expect(screen.queryByText("Tools", { exact: true })).not.toBeInTheDocument();
    expect(container.querySelector(".original-home-scene img")).toHaveAttribute("src", "/brand/sky-citadel.png");
    expect(container.querySelector(".original-home-scene img")).toHaveAttribute("alt", "");
  });

  it("preserves the supplied transparent crest and its original image fallback", () => {
    const { container } = render(<BrandCrest />);
    const crest = container.querySelector("img")!;
    expect(crest).toHaveAttribute("src", "/brand/cube-crest-prismatic.png");
    expect(crest).toHaveAttribute("alt", "");
    expect(crest).toHaveAttribute("aria-hidden", "true");
    expect(crest).toHaveAttribute("width", "42");
    expect(crest).toHaveAttribute("height", "42");
    expect(crest).toHaveClass("brand-crest");
    fireEvent.error(crest);
    expect(crest).toHaveAttribute("src", "/brand/cube-crest.webp");
  });

  it("uses the eight supplied class portraits as real build links instead of shader buttons", async () => {
    const { container } = render(<MemoryRouter><Home /></MemoryRouter>);
    await screen.findByRole("link", { name: "Spiritmaster" });
    const grid = screen.getByRole("list", { name: "Classes" });
    expect(within(grid).getAllByRole("link")).toHaveLength(8);
    for (const [name, key] of [
      ["Gladiator", "gladiator"], ["Templar", "templar"], ["Assassin", "assassin"], ["Ranger", "ranger"],
      ["Sorcerer", "sorcerer"], ["Spiritmaster", "spiritmaster"], ["Cleric", "cleric"], ["Chanter", "chanter"],
    ]) {
      const link = within(grid).getByRole("link", { name });
      expect(link).toHaveAttribute("href", `/build?class=${key}`);
      expect(link.querySelector("img")).toHaveAttribute("src", `/brand/classes/${key}-640.webp`);
      expect(link.querySelector("img")).toHaveAttribute("alt", "");
      expect(link).toHaveTextContent(name);
    }
    expect(container.querySelector(".feature-shader-card, .logo-cloud-cell.ornate")).not.toBeInTheDocument();
    expect(grid.querySelectorAll(".logo-cloud-intersection").length).toBeGreaterThan(0);
    expect(screen.queryByText("Powerful Features")).not.toBeInTheDocument();
    expect(screen.queryByText("Learn more")).not.toBeInTheDocument();
  });

  it("makes character entry the first Home action before the secondary guide", () => {
    const { container } = render(<MemoryRouter><Home /></MemoryRouter>);
    const hero = container.querySelector('[aria-label="Character lookup"]')!;
    const firstAction = hero.querySelector('a, input, select, button');
    expect(firstAction).toHaveAttribute("aria-label", "Character name");
    expect(screen.getByRole("link", { name: "Start here" })).toHaveAttribute("href", "/guide");
  });

  it("uses real app destinations for every Home quick action", () => {
    render(<MemoryRouter><Home /></MemoryRouter>);
    const actions = within(screen.getByRole("navigation", { name: "Quick actions" }));
    expect(actions.getByRole("link", { name: "Build by hand" })).toHaveAttribute("href", "/build");
    expect(actions.getByRole("link", { name: "Compare" })).toHaveAttribute("href", "/compare");
    expect(actions.getByRole("link", { name: "Daevanion" })).toHaveAttribute("href", "/daevanion");
    expect(actions.getByRole("link", { name: "Start here" })).toHaveAttribute("href", "/guide");
    expect(actions.getAllByRole("link")).toHaveLength(4);
    expect(actions.getAllByRole("link")[0]).toHaveAccessibleName("Start here");
    expect(screen.queryByRole("button", { name: /Upload|Attach|Send/ })).not.toBeInTheDocument();
  });

  it("features only Start here with the gradient border without nesting a button in its link", () => {
    render(<MemoryRouter><Home /></MemoryRouter>);
    const nav = screen.getByRole("navigation", { name: "Quick actions" });
    const links = within(nav).getAllByRole("link");
    expect(links[0]).toHaveAccessibleName("Start here");
    expect(links[0]).toHaveClass("gradient-borders-button");
    expect(links[0]).toHaveAttribute("href", "/guide");
    expect(nav.querySelectorAll(".gradient-borders-button")).toHaveLength(1);
    expect(nav.querySelector("button")).not.toBeInTheDocument();
    for (const link of links.slice(1)) expect(link).toHaveClass("moon-quick-action");
  });
});
