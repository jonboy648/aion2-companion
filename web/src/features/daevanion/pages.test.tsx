import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CodexPage } from "@/pages/Codex";
import { DaevanionPage } from "@/pages/Daevanion";
import { Route, Routes } from "react-router-dom";

function at(path: string, el: React.ReactNode, route: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={el} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Daevanion page", () => {
  it("shows god tabs with used/total, selects an available node and drops it again", async () => {
    at("/daevanion", <DaevanionPage />, "/daevanion");
    const tabs = await screen.findAllByRole("tab");
    expect(tabs.length).toBeGreaterThan(1);
    expect(tabs[0]).toHaveTextContent(/0\/88/);
    const board = screen.getByTestId("daevanion-board");
    const avail = board.querySelector('[data-state="available"]') as SVGElement;
    expect(avail).toBeTruthy();
    fireEvent.click(avail);
    await waitFor(() => expect(tabs[0]).toHaveTextContent(/1\/88/));
    expect(screen.getByRole("list", { name: "Stat totals" })).toBeInTheDocument();
    const picked = board.querySelector(`[data-node-id="${avail.getAttribute("data-node-id")}"]`) as SVGElement;
    expect(picked.getAttribute("data-state")).toBe("selected");
    fireEvent.click(picked);
    await waitFor(() => expect(tabs[0]).toHaveTextContent(/0\/88/));
  });

  it("does not select a node that is not reachable", async () => {
    at("/daevanion", <DaevanionPage />, "/daevanion");
    const board = (await screen.findByTestId("daevanion-board")) as unknown as SVGElement;
    const locked = board.querySelector('[data-state="locked"]') as SVGElement;
    fireEvent.click(locked);
    expect(board.querySelector(`[data-node-id="${locked.getAttribute("data-node-id")}"]`)!.getAttribute("data-state")).toBe("locked");
    expect(await screen.findByText(/Not reachable yet/)).toBeInTheDocument();
  });

  it("loads an imported character's nodes and runs Max power path", async () => {
    at("/daevanion?c=nae%2F2103%2FDarthThot", <DaevanionPage />, "/daevanion");
    expect(await screen.findByText("DarthThot", {}, { timeout: 5000 })).toBeInTheDocument();
    const tabs = await screen.findAllByRole("tab");
    expect(tabs[0]).toHaveTextContent(/68\/88/);
    fireEvent.click(screen.getByRole("button", { name: "Suggest" }));
    const sug = await screen.findByTestId("suggestion");
    expect(within(sug).getByText(/DPS/)).toBeInTheDocument();
  });
});

describe("Codex page", () => {
  it("lists skills, filters, searches and opens the detail drawer", async () => {
    at("/codex/sorcerer", <CodexPage />, "/codex/:classKey");
    const list = await screen.findByRole("list", { name: "Skills" });
    const all = within(list).getAllByRole("listitem").length;
    expect(all).toBeGreaterThan(10);
    fireEvent.click(screen.getByRole("button", { name: /^Stigma/ }));
    expect(within(screen.getByRole("list", { name: "Skills" })).getAllByRole("listitem").length).toBeLessThan(all);
    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    fireEvent.change(screen.getByLabelText("Search skills"), { target: { value: "flame arrow" } });
    const card = await screen.findByRole("button", { name: /Flame Arrow/ });
    fireEvent.click(card);
    const dlg = await screen.findByRole("dialog", { name: /Flame Arrow details/ });
    expect(within(dlg).getByRole("table")).toBeInTheDocument();
    expect(within(dlg).getByText("Burst")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows an empty state when nothing matches", async () => {
    at("/codex/sorcerer", <CodexPage />, "/codex/:classKey");
    await screen.findByRole("list", { name: "Skills" });
    fireEvent.change(screen.getByLabelText("Search skills"), { target: { value: "qqqqqq" } });
    expect(await screen.findByText(/No skills match/)).toBeInTheDocument();
  });
});
