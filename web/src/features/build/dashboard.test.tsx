import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DamageChartBoundary } from "./BuildDamage";
import { ProgressPanel } from "./BuildResults";
import { renderToString } from "react-dom/server";
import compareFx from "@/fixtures/compare.json";
import type { CompareResult } from "@/lib/types";
import { BuildResults } from "./BuildResults";

it("keeps four scenarios and hides max-build damage for a utility variant", () => {
  render(<BuildResults cmp={compareFx as unknown as CompareResult} data={{ gd: null, icons: {} }} />);
  expect(within(screen.getByRole("tablist", { name: "Playstyles" })).getAllByRole("tab")).toHaveLength(4);
  expect(screen.getByRole("region", { name: "Main workspace" })).toBeInTheDocument();
  expect(screen.getByText("Estimated damage by skill")).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Trade-offs" }), { button: 0, ctrlKey: false });
  const variants = screen.getAllByRole("button", { name: "Use this variant" });
  fireEvent.click(variants[variants.length - 1]);
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Overview" }), { button: 0, ctrlKey: false });
  expect(screen.queryByText("Estimated damage by skill")).toBeNull();
  expect(screen.getByText(/Detailed simulation is unavailable/)).toBeInTheDocument();
});

it("supports keyboard selection within the playstyle tablist", () => {
  render(<BuildResults cmp={compareFx as unknown as CompareResult} data={{ gd: null, icons: {} }} />);
  const tabs = within(screen.getByRole("tablist", { name: "Playstyles" })).getAllByRole("tab");
  fireEvent.keyDown(tabs[0], { key: "End" });
  expect(tabs[3]).toHaveFocus();
  expect(tabs[3]).toHaveAttribute("aria-selected", "true");
  fireEvent.keyDown(tabs[3], { key: "Home" });
  expect(tabs[0]).toHaveFocus();
});

it("keeps readable values when the chart fails", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  function FailedChart(): never { throw new Error("chunk failed"); }
  try {
    render(<><DamageChartBoundary><FailedChart /></DamageChartBoundary><p>Verified damage values</p></>);
    expect(screen.getByText(/Chart unavailable/)).toBeInTheDocument();
    expect(screen.getByText("Verified damage values")).toBeInTheDocument();
  } finally { error.mockRestore(); }
});

it("displays actual engine progress with its activity loader", () => {
  render(<ProgressPanel title="Comparing playstyles" message="Solving boss" steps={["Import complete", "Solving boss"]} />);
  expect(screen.getByRole("status")).toHaveTextContent("Solving boss");
  expect(screen.getByText("Import complete")).toBeInTheDocument();
});

it("renders real summaries on the server without requiring the chart chunk", () => {
  const html = renderToString(<BuildResults cmp={compareFx as unknown as CompareResult} data={{ gd: null, icons: {} }} />);
  expect(html).toContain("Damage values");
  expect(html).toContain("Estimated DPS");
});

it("does not display an unreconciled damage chart", () => {
  const original = compareFx as unknown as CompareResult;
  const cmp = { ...original, boss: { ...original.boss, result: { ...original.boss.result, total_damage: original.boss.result.total_damage + 100 } } };
  render(<BuildResults cmp={cmp} data={{ gd: null, icons: {} }} />);
  expect(screen.getByText("Verified damage breakdown unavailable.")).toBeInTheDocument();
  expect(screen.queryByText("Estimated damage by skill")).toBeNull();
});
