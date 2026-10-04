import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

describe("dashboard detail tabs", () => {
  it("associates triggers and panels and keeps keyboard navigation working", async () => {
    render(<Tabs defaultValue="overview">
      <TabsList aria-label="Build details">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="rotation">Rotation</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Summary</TabsContent>
      <TabsContent value="rotation">Cast order</TabsContent>
    </Tabs>);
    const overview = screen.getByRole("tab", { name: "Overview" });
    const rotation = screen.getByRole("tab", { name: "Rotation" });
    expect(overview).toHaveAttribute("aria-selected", "true");
    expect(rotation).toHaveAttribute("tabindex", "-1");
    act(() => overview.focus());
    fireEvent.keyDown(overview, { key: "ArrowRight" });
    await waitFor(() => expect(rotation).toHaveFocus());
    expect(rotation).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Rotation" })).toHaveTextContent("Cast order");
    fireEvent.keyDown(rotation, { key: "Home" });
    await waitFor(() => expect(overview).toHaveFocus());
  });
});
