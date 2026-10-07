import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CharacterPage } from "@/pages/CharacterPage";
import { DaevanionPage } from "@/pages/Daevanion";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function workflow(target = "/daevanion") {
  return render(<MemoryRouter initialEntries={["/c/nae/2103/DarthThot"]}>
    <Link to={target}>Planner navigation</Link>
    <Routes>
      <Route path="/c/:region/:serverId/:name" element={<CharacterPage />} />
      <Route path="/daevanion" element={<DaevanionPage />} />
    </Routes>
  </MemoryRouter>);
}

describe("imported Daevanion context", () => {
  it("opens a genuinely blank planner from an imported board", { timeout: 10000 }, async () => {
    workflow();
    await screen.findByTestId("character-card", {}, { timeout: 5000 });
    fireEvent.click(screen.getByRole("link", { name: "Planner navigation" }));
    await screen.findAllByRole("tab", {}, { timeout: 5000 });
    fireEvent.click(screen.getByRole("link", { name: "Open the blank planner" }));
    await waitFor(() => expect(screen.getAllByRole("tab")[0]).toHaveTextContent("0/88"), { timeout: 5000 });
    expect(screen.queryByText("DarthThot")).not.toBeInTheDocument();
  });
  it("keeps imported owned nodes through ordinary planner navigation", async () => {
    workflow();
    await screen.findByTestId("character-card", {}, { timeout: 5000 });
    fireEvent.click(screen.getByRole("link", { name: "Planner navigation" }));
    const tabs = await screen.findAllByRole("tab", {}, { timeout: 5000 });
    expect(tabs[0]).toHaveTextContent("68/88");
    expect(screen.getByText("DarthThot")).toBeVisible();
  });
  it("keeps explicit class-only planning separate from the imported character", async () => {
    workflow("/daevanion?class=sorcerer");
    await screen.findByTestId("character-card", {}, { timeout: 5000 });
    fireEvent.click(screen.getByRole("link", { name: "Planner navigation" }));
    const tabs = await screen.findAllByRole("tab", {}, { timeout: 5000 });
    expect(tabs[0]).toHaveTextContent("0/88");
    expect(screen.queryByText("DarthThot")).not.toBeInTheDocument();
  });
  it("shows invalid character context as an error rather than a blank planner", async () => {
    render(<MemoryRouter initialEntries={["/daevanion?c=invalid"]}><DaevanionPage /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid character context");
    expect(screen.queryByTestId("daevanion-board")).not.toBeInTheDocument();
  });
  it("does not substitute another character when the requested server and name are absent", async () => {
    render(<MemoryRouter initialEntries={["/daevanion?c=nae%2F9999%2FNotThere"]}><DaevanionPage /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByRole("alert") ?? screen.queryByTestId("daevanion-board")).not.toBeNull(), { timeout: 4000 });
    expect(screen.getByRole("alert")).toHaveTextContent("Character not found");
    expect(screen.queryByTestId("daevanion-board")).not.toBeInTheDocument();
  });
});
