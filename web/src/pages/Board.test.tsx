import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ago, fetchBoard, submitMaxDps, type BoardRow } from "@/lib/board";
import { Board } from "./Board";

const row = (o: Partial<BoardRow> = {}): BoardRow => ({
  name: "DarthThot", class_name: "Sorcerer", server_name: "Triniel", region: "nae", server_id: 2103,
  level: 45, combat_power: 38507, item_level: 738, max_dps: 15000, last_seen: Date.now() - 5 * 60_000, ...o,
});

const ROWS = [
  row({ name: "Bravo", class_name: "Templar", level: 45, combat_power: 71000, item_level: 1600, max_dps: null }),
  row({ name: "Alpha", class_name: "Cleric", level: 44, combat_power: 65000, item_level: null, max_dps: 9000 }),
  row({ name: "Charlie", class_name: "Assassin", level: 45, combat_power: 40000, item_level: 764, max_dps: 12000 }),
];

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("VITE_ARMORY_PROXY_URL", "https://proxy.test");
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ rows: ROWS }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("board client", () => {
  it("asks the proxy for the sort, class and limit", async () => {
    await fetchBoard("power", "Cleric", 10);
    const u = new URL(fetchMock.mock.calls[0][0]);
    expect(u.origin + u.pathname).toBe("https://proxy.test/board");
    expect(Object.fromEntries(u.searchParams)).toEqual({ sort: "power", limit: "10", class: "Cleric" });
  });

  it("explains itself when the proxy is not configured", async () => {
    vi.stubEnv("VITE_ARMORY_PROXY_URL", "");
    await expect(fetchBoard("recent")).rejects.toThrow(/not available/);
  });

  it("submits a rounded max DPS once and never throws", () => {
    submitMaxDps({ region: "nae", serverId: 2103, characterId: "abcdefgh1234", dps: 12345.6 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://proxy.test/board/dps");
    expect(JSON.parse(init.body)).toEqual({ region: "nae", serverId: 2103, characterId: "abcdefgh1234", dps: 12346 });
    submitMaxDps({ region: "nae", serverId: 1, characterId: "abcdefgh1234", dps: NaN });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("labels times", () => {
    const now = 10_000_000;
    expect([ago(now - 5_000, now), ago(now - 5 * 60_000, now), ago(now - 3 * 3_600_000, now), ago(now - 72 * 3_600_000, now)]).toEqual(["just now", "5 min ago", "3 h ago", "3 d ago"]);
  });
});

describe("Board page (sortable table)", () => {
  const at = () => render(<MemoryRouter><Board /></MemoryRouter>);
  const names = () => within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row").map((r) => within(r).getAllByRole("cell")[1].textContent);
  const sortParams = () => fetchMock.mock.calls.map((c) => new URL(c[0]).searchParams.get("sort"));
  const header = (name: string) => screen.getByRole("columnheader", { name: new RegExp(name) });

  it("shows one table with a column per stat, ranked by Combat Power to start", async () => {
    at();
    expect(await screen.findByRole("table")).toBeTruthy();
    for (const c of ["Character", "Class", "Lv", "Server", "Combat Power", "Gear Score", "Max DPS \\(est\\.\\)", "Last seen"]) expect(header(c)).toBeTruthy();
    expect(header("Combat Power").getAttribute("aria-sort")).toBe("descending");
    expect(names()).toEqual(["Bravo", "Alpha", "Charlie"]);
    expect(screen.getByRole("link", { name: "Bravo" }).getAttribute("href")).toBe("/c/nae/2103/Bravo");
    expect(sortParams()).toEqual(["power"]);
  });

  it("asks the proxy to rank the whole board when a ranked column is clicked, and flips on a second click", async () => {
    at();
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: /Gear Score/ }));
    await waitFor(() => expect(sortParams()).toContain("gear"));
    await waitFor(() => expect(header("Gear Score").getAttribute("aria-sort")).toBe("descending"));
    expect(names()).toEqual(["Bravo", "Charlie", "Alpha"]); // empty gear score always last
    fireEvent.click(screen.getByRole("button", { name: /Gear Score/ }));
    expect(header("Gear Score").getAttribute("aria-sort")).toBe("ascending");
    expect(names()).toEqual(["Charlie", "Bravo", "Alpha"]); // still last
  });

  it("sorts by name, class or level on the rows shown, without asking the proxy again", async () => {
    at();
    await screen.findByRole("table");
    const calls = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Character" }));
    expect(names()).toEqual(["Alpha", "Bravo", "Charlie"]);
    fireEvent.click(screen.getByRole("button", { name: /^Class/ }));
    expect(names()).toEqual(["Charlie", "Alpha", "Bravo"]); // Assassin, Cleric, Templar
    fireEvent.click(screen.getByRole("button", { name: /^Lv/ }));
    expect(names().slice(0, 2).sort()).toEqual(["Bravo", "Charlie"]); // the two level 45s first, descending
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("filters by class through the proxy and shows the unverified-DPS note", async () => {
    at();
    await screen.findByRole("table");
    fireEvent.change(screen.getByLabelText("Class"), { target: { value: "Cleric" } });
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => new URL(c[0]).searchParams.get("class") === "Cleric")).toBe(true));
    expect(screen.getByText(/not verified/)).toBeTruthy();
  });

  it("says so when the board is empty or cannot load", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ rows: [] }), { status: 200 }));
    const { unmount } = at();
    expect(await screen.findByText(/Nothing here yet/)).toBeTruthy();
    unmount();
    fetchMock.mockImplementation(async () => new Response("{}", { status: 503 }));
    at();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/not available/));
  });
});
