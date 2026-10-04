import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import compareFx from "@/fixtures/compare.json";
import type { CompareResult } from "@/lib/types";
import { BuildResults } from "./BuildResults";

vi.mock("@/components/ui/advanced-stats-utils/charts", () => {
  throw new Error("Chart chunk failed to load");
});

it("retains real damage values and scenario controls after a rejected lazy chunk", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(<BuildResults cmp={compareFx as unknown as CompareResult} data={{ gd: null, icons: {} }} />);
    expect(await screen.findByText(/Chart unavailable/)).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Damage values" })).getAllByRole("listitem").length).toBeGreaterThan(0);
    expect(within(screen.getByRole("tablist", { name: "Playstyles" })).getAllByRole("tab")).toHaveLength(4);
  } finally { error.mockRestore(); }
});
