import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { search } from "@/lib/armory";
import type { ArmorySearchHit } from "@/lib/types";
import { CharacterPage } from "@/pages/CharacterPage";
import { clearRecent, loadRecent } from "./helpers";
import { SearchBox } from "./SearchBox";

vi.mock(import("@/lib/armory"), async (importOriginal) => ({
  ...(await importOriginal()),
  search: vi.fn<typeof search>(),
}));

const searchMock = vi.mocked(search);
const hit: ArmorySearchHit = {
  characterId: "character-nae-2103",
  name: "Darth Thot",
  level: 44,
  serverId: 2103,
  serverName: "Triniel",
  pcId: 28,
  race: 2,
  region: "nae",
};
const hits: ArmorySearchHit[] = [
  hit,
  { ...hit, characterId: "character-eu-1101", region: "eu", serverId: 1101, serverName: "Lumiel" },
  { ...hit, characterId: "character-eu-2103", region: "eu" },
];

function renderSearch() {
  const router = createMemoryRouter([
    { path: "/", element: <SearchBox /> },
    { path: "/c/:region/:serverId/:name", element: <CharacterPage /> },
  ], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
  return router;
}

function submitName(name = "Darth Thot") {
  fireEvent.change(screen.getByLabelText("Character name"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
}

describe("SearchBox", () => {
  beforeEach(() => {
    clearRecent();
    searchMock.mockReset().mockResolvedValue([]);
  });

  it("Escape clears the character name without submitting", () => {
    renderSearch();
    const input = screen.getByLabelText("Character name");
    fireEvent.change(input, { target: { value: "DarthThot" } });
    act(() => input.focus());

    fireEvent.keyDown(input, { key: "Escape", code: "Escape" });

    expect(searchMock).not.toHaveBeenCalled();
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("Clear search clears the name and returns focus without submitting", () => {
    renderSearch();
    const input = screen.getByLabelText("Character name");
    fireEvent.change(input, { target: { value: "DarthThot" } });
    const clear = screen.getByRole("button", { name: "Clear search" });
    act(() => clear.focus());

    fireEvent.click(clear);

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(searchMock).not.toHaveBeenCalled();
  });

  it.each([
    { label: "blank", value: "" },
    { label: "whitespace-only", value: "   " },
  ])("requires a name for $label input without searching the armory", async ({ value }) => {
    renderSearch();

    submitName(value);

    expect(await screen.findByRole("alert")).toHaveTextContent(/Type a character name first/i);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("trims the name and searches the selected region", async () => {
    renderSearch();
    fireEvent.change(screen.getByRole("combobox", { name: "Region" }), { target: { value: "eu" } });

    submitName("  Darth Thot  ");

    await screen.findByText(/No characters found/i);
    expect(searchMock).toHaveBeenCalledExactlyOnceWith("Darth Thot", "eu");
  });

  it("defaults to Auto and searches without restricting the region", async () => {
    renderSearch();
    expect(screen.getByRole("combobox", { name: "Region" })).toHaveDisplayValue("Auto (all regions)");

    submitName();

    await screen.findByText(/No characters found/i);
    expect(searchMock).toHaveBeenCalledExactlyOnceWith("Darth Thot", undefined);
  });

  it("opens the real character route for one hit and remembers it", async () => {
    searchMock.mockResolvedValue([hit]);
    const router = renderSearch();

    submitName();

    expect(await screen.findByRole("heading", { level: 1, name: "Darth Thot" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/c/nae/2103/Darth%20Thot");
    expect(loadRecent()).toEqual([
      { name: "Darth Thot", region: "nae", serverId: 2103, serverName: "Triniel", level: 44 },
    ]);
  });

  it("opens the chosen region and server when several characters share a name", async () => {
    searchMock.mockResolvedValue(hits);
    const router = renderSearch();

    submitName();

    const results = await screen.findByRole("list", { name: "Search results" });
    expect(within(results).getAllByRole("button")).toHaveLength(3);
    expect(router.state.location.pathname).toBe("/");
    expect(loadRecent()).toEqual([]);

    fireEvent.click(within(results).getByRole("button", { name: /Triniel \(EU\)/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "Darth Thot" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/c/eu/2103/Darth%20Thot");
    expect(loadRecent()).toEqual([
      { name: "Darth Thot", region: "eu", serverId: 2103, serverName: "Triniel", level: 44 },
    ]);
  });

  it("announces the number of matches before the player picks a character", async () => {
    searchMock.mockResolvedValue(hits);
    renderSearch();

    submitName();

    await screen.findByRole("list", { name: "Search results" });
    expect(screen.getByRole("status")).toHaveTextContent(/3/);
    expect(screen.getByRole("status")).toHaveTextContent(/characters|matches|results/i);
  });

  it("blocks duplicate searches while pending and enables searching again afterward", async () => {
    let resolveSearch!: (value: ArmorySearchHit[]) => void;
    searchMock.mockReturnValueOnce(new Promise<ArmorySearchHit[]>((resolve) => { resolveSearch = resolve; }));
    renderSearch();

    submitName();

    const submit = screen.getByRole("button", { name: "Search" });
    expect(screen.getByLabelText("Character name")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Region" })).toBeDisabled();
    expect(submit).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Searching the armory...");
    fireEvent.click(submit);
    fireEvent.submit(screen.getByRole("search", { name: "Character search" }));
    const pendingCalls = searchMock.mock.calls.length;

    await act(async () => resolveSearch([]));

    expect(pendingCalls).toBe(1);
    expect(screen.getByRole("status")).not.toHaveTextContent("Searching the armory...");
    expect(screen.getByRole("button", { name: "Search" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2));
  });

  it("announces a readable search error and lets the player retry", async () => {
    searchMock.mockRejectedValueOnce(new Error("The armory is unavailable. Try again later."));
    renderSearch();

    submitName();

    const error = await screen.findByRole("alert");
    expect(error).toBeVisible();
    expect(error).toHaveTextContent("The armory is unavailable. Try again later.");
    expect(screen.getByRole("button", { name: "Search" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText(/No characters found/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces an empty result with readable guidance", async () => {
    renderSearch();

    submitName();

    await screen.findByText(/No characters found/i);
    const empty = screen.getByRole("status");
    expect(empty).toBeVisible();
    expect(empty).toHaveTextContent(/No characters found/i);
    expect(empty).toHaveTextContent(/spelling|region/i);
  });

  it.each(["name", "region"] as const)("clears stale matches when the %s changes", async (field) => {
    searchMock.mockResolvedValue(hits);
    renderSearch();
    submitName();
    expect(await screen.findByRole("list", { name: "Search results" })).toBeVisible();

    fireEvent.change(screen.getByLabelText(field === "name" ? "Character name" : "Region"), {
      target: { value: field === "name" ? "Luna" : "eu" },
    });

    expect(screen.queryByRole("list", { name: "Search results" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["name", "region"] as const)("clears a stale error when the %s changes", async (field) => {
    searchMock.mockRejectedValueOnce(new Error("The armory is unavailable."));
    renderSearch();
    submitName();
    expect(await screen.findByRole("alert")).toHaveTextContent("The armory is unavailable.");

    fireEvent.change(screen.getByLabelText(field === "name" ? "Character name" : "Region"), {
      target: { value: field === "name" ? "Luna" : "eu" },
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(searchMock).toHaveBeenCalledTimes(1);
  });
});
