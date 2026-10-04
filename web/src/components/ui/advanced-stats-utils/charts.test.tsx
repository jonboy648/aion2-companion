import { cleanup, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import DamageBreakdownChart from "./charts";

// Deterministic dimensions exercise the actual Recharts SVG in jsdom.
vi.mock("recharts", async importOriginal => {
  const actual = await importOriginal<typeof import("recharts")>();
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
    <div data-testid="responsive-container">{children && <actual.ResponsiveContainer width={640} height={320}>{children}</actual.ResponsiveContainer>}</div> };
});
afterEach(cleanup);
const rows = [{ key: "fire", label: "Fire bolt", damage: 60, share: 0.6 }, { key: "ice", label: "Ice bolt", damage: 40, share: 0.4 }];

describe("DamageBreakdownChart", () => {
  it("renders a named horizontal chart with real labels, token bars and no animation", () => {
    const { container } = render(<DamageBreakdownChart rows={rows} />);
    expect(screen.getByRole("img", { name: "Estimated damage by skill" })).toBeInTheDocument();
    expect(within(screen.getByRole("img")).getByText("Fire bolt")).toBeInTheDocument();
    expect(within(screen.getByRole("img")).getByText("Ice bolt")).toBeInTheDocument();
    expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(2);
    expect(container.querySelector('[fill="var(--gold)"]')).not.toBeNull();
    expect(container.querySelector("animate")).toBeNull();
    expect(screen.getByRole("img")).toHaveStyle({ height: "320px", minWidth: "0" });
  });
  it("shows an honest empty state and server-renders without browser APIs", () => {
    render(<DamageBreakdownChart rows={[]} />);
    expect(screen.getByText("No damage recorded")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(renderToString(<DamageBreakdownChart rows={rows} />)).toContain("Estimated damage by skill");
  });
});
