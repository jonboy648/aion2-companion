import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ago, fetchBoard, submitMaxDps, type BoardRow } from "@/lib/board";
import { Board } from "./Board";

const row = (o: Partial<BoardRow> = {}): BoardRow => ({
  name: "DarthThot", class_name: "Sorcerer", server_name: "Triniel", region: "nae", server_id: 2103,
  level: 45, combat_power: 38507, max_dps: 15000, last_seen: Date.now() - 5 * 60_000, ...o,
});

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("VITE_ARMORY_PROXY_URL", "https://proxy.test");
  fetchMock = vi.fn(async (url: string) => {
    const sort = new URL(url).searchParams.get("sort");
    return new Response(JSON.stringify({ rows: sort === "dps" ? [] : [row()] }), { status: 200 });
  });
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

describe("Board page", () => {
  const at = () => render(<MemoryRouter><Board /></MemoryRouter>);

  it("shows recent lookups with a link to each character", async () => {
    at();
    const link = await screen.findByRole("link", { name: "DarthThot" });
    expect(link.getAttribute("href")).toBe("/c/nae/2103/DarthThot");
    expect(screen.getByText(/Sorcerer · Lv 45 · Triniel · NA East/)).toBeTruthy();
    expect(screen.getByText("5 min ago")).toBeTruthy();
  });

  it("switches to the Combat Power and DPS lists, and warns the DPS list is an estimate", async () => {
    at();
    await screen.findByRole("link", { name: "DarthThot" });
    fireEvent.click(screen.getByRole("tab", { name: "Top Combat Power" }));
    expect(await screen.findByText("38,507")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Top max-potential DPS" }));
    expect(await screen.findByText(/Nobody has calculated/)).toBeTruthy();
    expect(screen.getByText(/not verified/)).toBeTruthy();
  });

  it("says so when the board cannot load", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 503 }));
    at();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/not available/));
  });
});
