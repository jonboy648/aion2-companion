import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LogoCloud, type LogoCloudItem } from "./logo-cloud-2";

const item: LogoCloudItem = {
  id: "gladiator", title: "Gladiator", href: "/build?class=gladiator",
  logo: { src: "/brand/classes/gladiator-640.webp", alt: "", width: 640, height: 640 },
  fallback: <span>Class emblem fallback</span>,
};

describe("LogoCloud class art", () => {
  it("keeps the name outside the portrait crop so image framing cannot crop the label", () => {
    render(<MemoryRouter><LogoCloud items={[item]} /></MemoryRouter>);
    const link = screen.getByRole("link", { name: "Gladiator" });
    const media = link.querySelector(".logo-cloud-media");
    expect(media).toBeInTheDocument();
    expect(media?.querySelector("img")).toBeInTheDocument();
    expect(media).not.toHaveTextContent("Gladiator");
    expect(link).toHaveTextContent("Gladiator");
  });

  it("keeps the class link and readable label usable when an image fails", () => {
    render(<MemoryRouter><LogoCloud items={[item]} /></MemoryRouter>);
    expect(screen.queryByText("Class emblem fallback")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Gladiator" });
    fireEvent.error(link.querySelector("img")!);
    expect(screen.getByText("Class emblem fallback")).toBeVisible();
    expect(link).toHaveTextContent("Gladiator");
    expect(link).toHaveAttribute("href", "/build?class=gladiator");
    expect(link.querySelector("img")).not.toBeInTheDocument();
  });

  it("tries a new image source after a prior source fails", () => {
    const { rerender } = render(<MemoryRouter><LogoCloud items={[item]} /></MemoryRouter>);
    fireEvent.error(screen.getByRole("link", { name: "Gladiator" }).querySelector("img")!);
    rerender(<MemoryRouter><LogoCloud items={[{ ...item, logo: { ...item.logo, src: "/replacement.webp" } }]} /></MemoryRouter>);
    expect(screen.queryByText("Class emblem fallback")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gladiator" }).querySelector("img")).toHaveAttribute("src", "/replacement.webp");
  });

  it("reserves the class grid while loading without creating fake links", () => {
    render(<MemoryRouter><LogoCloud loading items={[]} aria-label="Classes" /></MemoryRouter>);
    const grid = screen.getByRole("list", { name: "Classes" });
    expect(grid).toHaveAttribute("aria-busy", "true");
    expect(grid.querySelectorAll(".logo-cloud-placeholder")).toHaveLength(8);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
