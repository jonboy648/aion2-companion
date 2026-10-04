import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AdvancedStats from "./advanced-stats";

describe("dashboard layout", () => {
  it("keeps the workspace and supporting actions separate without invented metrics", () => {
    render(<AdvancedStats main={<button>Inspect build</button>} supporting={<button>Refresh</button>} />);
    expect(within(screen.getByRole("region", { name: "Main workspace" })).getByRole("button", { name: "Inspect build" })).toBeInTheDocument();
    expect(within(screen.getByRole("complementary", { name: "Supporting controls" })).getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.queryByText(/Revenue|Subscription|Churn/)).toBeNull();
    expect(screen.queryByRole("list", { name: "Summary metrics" })).toBeNull();
  });

  it("shows supplied unavailable values instead of inventing a zero", () => {
    render(<AdvancedStats main="Build" metrics={[{ key: "dps", label: "Estimated DPS", value: "Unavailable", hint: "Not calculated" }]} />);
    const metrics = screen.getByRole("list", { name: "Summary metrics" });
    expect(within(metrics).getByText("Unavailable")).toBeInTheDocument();
    expect(within(metrics).getByText("Not calculated")).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("renders essential content at prerender time", () => {
    const html = renderToString(<AdvancedStats main="Rotation" supporting="Points" />);
    expect(html).toContain("Rotation");
    expect(html).toContain("Points");
    expect(html).not.toContain("opacity:0");
  });
});
