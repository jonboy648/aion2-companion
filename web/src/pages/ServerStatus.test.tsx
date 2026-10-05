import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOAD_THRESHOLDS, chartRows, fetchStatus, loadLevel, pairServers, peak, summarize,
  type StatusRegion, type StatusResponse, type StatusServer,
} from "@/lib/serverStatus";
import { ServerStatusPage, StatusView } from "./ServerStatus";

const NOW = 1_800_000_000_000;
const REGION_DIGIT: Record<string, number> = { nae: 1, naw: 2, eu: 3, la: 4, as: 5 };
const srv = (id: number, o: Partial<StatusServer> = {}): StatusServer => {
  const region = (Object.keys(REGION_DIGIT) as StatusRegion[]).find((r) => REGION_DIGIT[r] === Math.floor(id / 100) % 10)!;
  return { id, region, race: Math.floor(id / 1000) as 1 | 2, name: `Srv${id}`, tags: 0, capacity: 7000, players: 3500, source_at: NOW, stale: false, fetched_at: NOW, listed: true, ...o };
};
const SERVERS: StatusServer[] = [
  srv(1301, { name: "Siel", players: 6700 }), // 95.7% full
  srv(2301, { name: "Israphel", players: 2000, tags: 2 }),
  srv(1302, { name: "Nezekan", players: 5000, tags: 1 }), // 71% busy
  srv(2302, { name: "Zikel", players: 1000, tags: 4 }),
  srv(1101, { name: "SielNAE", players: 4000, stale: true }),
  srv(2101, { name: "IsraNAE", players: 3000, stale: true }),
  srv(1102, { name: "NezNAE", players: null, capacity: null, source_at: null, fetched_at: null, listed: false }), // roster only
];
const regionsOf = (servers: StatusServer[]) =>
  (["nae", "naw", "eu", "la", "as"] as const).map((region) => {
    const rows = servers.filter((s) => s.region === region);
    const live = rows.filter((s) => s.players !== null);
    return { region, servers: rows.length, reporting: live.length, players: live.reduce((a, s) => a + (s.players ?? 0), 0), capacity: 0, stale: live.length > 0 && live.every((s) => s.stale), source_at: NOW };
  });
const history = (): StatusResponse["history"] => ({
  "24h": { step_ms: 300000, ts: [NOW - 600000, NOW - 300000, NOW], regions: { nae: [null, null, null], eu: [8000, 9000, 8700], naw: [null, null, null], la: [null, null, null], as: [null, null, null] } },
  "7d": { step_ms: 3600000, ts: [], regions: {} },
  "30d": { step_ms: 10800000, ts: [], regions: {} },
});
const RESP: StatusResponse = { generated_at: NOW, last_ok_at: NOW - 30_000, last_error_at: null, feed_updated: NOW, regions: regionsOf(SERVERS), servers: SERVERS, history: history() };

describe("load labels", () => {
  it("uses the documented thresholds: Good below 70%, Busy 70-95%, Full from 95%", () => {
    expect(LOAD_THRESHOLDS).toEqual({ busy: 0.7, full: 0.95 });
    expect(loadLevel(6999 * 0.7 - 1, 6999)).toBe("good");
    expect(loadLevel(700, 1000)).toBe("busy");
    expect(loadLevel(949, 1000)).toBe("busy");
    expect(loadLevel(950, 1000)).toBe("full");
    expect(loadLevel(1000, 1000)).toBe("full");
    expect(loadLevel(0, 1000)).toBe("good");
  });
  it("is offline without a count or capacity", () => {
    expect(loadLevel(null, null)).toBe("offline");
    expect(loadLevel(10, null)).toBe("offline");
    expect(loadLevel(10, 0)).toBe("offline");
  });
});

describe("pairing, totals, balance, stale", () => {
  it("pairs Elyos 1RNN with Asmodian 2RNN by serverId % 100 inside a region, even with one half missing", () => {
    const pairs = pairServers([...SERVERS].reverse().concat(srv(1303, { name: "OnlyElyos" })));
    expect(pairs.map((p) => `${p.region}:${p.slot}`)).toEqual(["nae:1", "nae:2", "eu:1", "eu:2", "eu:3"]);
    const p = pairs.find((x) => x.region === "eu" && x.slot === 1)!;
    expect([p.elyos?.id, p.asmodian?.id]).toEqual([1301, 2301]);
    const lone = pairs.find((x) => x.slot === 3)!;
    expect([lone.elyos?.id, lone.asmodian]).toEqual([1303, null]);
    // same slot in two regions never merges
    expect(pairs.filter((x) => x.slot === 1)).toHaveLength(2);
  });

  it("sums only servers that report and splits factions", () => {
    const s = summarize(SERVERS);
    expect(s.players).toBe(6700 + 2000 + 5000 + 1000 + 4000 + 3000);
    expect(s.elyosPlayers).toBe(6700 + 5000 + 4000);
    expect(s.asmodianPlayers).toBe(2000 + 1000 + 3000);
    expect(Math.round(s.elyosPct!)).toBe(Math.round((15700 / 21700) * 100));
    expect(s.elyosPct! + s.asmodianPct!).toBeCloseTo(100);
    expect(s.serversTotal).toBe(7);
    expect(s.serversOnline).toBe(6);
    expect(s.fullServers).toBe(1);
    expect(s.creationLocked).toBe(1);
  });

  it("has no balance when nobody is counted", () => {
    const s = summarize([srv(1301, { players: null }), srv(2301, { players: 0 })]);
    expect([s.elyosPct, s.asmodianPct, s.players]).toEqual([null, null, 0]);
  });

  it("flags a region as stale only when every reporting server is stale", () => {
    expect(summarize(SERVERS).staleRegions).toEqual(["nae"]);
    expect(summarize([srv(1101, { stale: true }), srv(2101)]).staleRegions).toEqual([]);
  });

  it("reads the 24h peak and chart rows from columnar history", () => {
    expect(peak(history()["24h"])).toBe(9000);
    expect(peak(undefined)).toBeNull();
    expect(peak({ step_ms: 1, ts: [1], regions: { eu: [null] } })).toBeNull();
    expect(chartRows(history()["24h"])[1]).toEqual({ ts: NOW - 300000, nae: null, naw: null, eu: 9000, la: null, as: null });
  });
});

describe("StatusView", () => {
  it("shows the summary cards, region tables, tags and load labels", () => {
    render(<StatusView data={RESP} now={NOW} />);
    expect(screen.getByText("Updated 30s ago")).toBeInTheDocument();
    const card = (title: string) => screen.getByRole("heading", { name: title }).parentElement!;
    expect(within(card("Players Online")).getByText("21,700")).toBeInTheDocument();
    expect(within(card("Players Online")).getByText("24h peak 9,000")).toBeInTheDocument();
    expect(within(card("Faction Balance")).getByText("72% / 28%")).toBeInTheDocument();
    expect(within(card("Servers Online")).getByText("6 / 7")).toBeInTheDocument();
    expect(within(card("Servers Online")).getByText("1 full server")).toBeInTheDocument();
    expect(within(card("Creation Locked")).getByText("1 of 7")).toBeInTheDocument();

    const eu = within(screen.getByTestId("region-eu"));
    expect(eu.getByText("Siel")).toBeInTheDocument();
    expect(eu.getByText("Israphel")).toBeInTheDocument();
    expect(eu.getByText("Full")).toBeInTheDocument();
    expect(eu.getByText("Busy")).toBeInTheDocument();
    expect(eu.getAllByText("Good").length).toBe(2);
    expect(eu.getByLabelText("Recommended")).toBeInTheDocument();
    expect(eu.getByLabelText("New server")).toBeInTheDocument();
    expect(eu.getByLabelText("Character creation locked")).toBeInTheDocument();
    expect(eu.getByText("14,700")).toBeInTheDocument(); // header total: 6700+2000+5000+1000
    expect(eu.queryByRole("note")).toBeNull();
  });

  it("notes stale regions and marks unreported servers as maintenance / offline", () => {
    render(<StatusView data={RESP} now={NOW} />);
    const nae = within(screen.getByTestId("region-nae"));
    expect(nae.getByRole("note")).toHaveTextContent(/data may be out of date/i);
    expect(nae.getByText("NezNAE")).toBeInTheDocument();
    expect(nae.getByText("Maintenance / offline")).toBeInTheDocument();
    expect(screen.getAllByRole("note")[0]).toHaveTextContent(/NA East may be out of date/);
  });

  it("filters by region with counts in the tabs", () => {
    render(<StatusView data={RESP} now={NOW} />);
    expect(screen.getByRole("button", { name: "All (7)" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Europe (4)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "South America (0)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Europe (4)" }));
    expect(screen.getByTestId("region-eu")).toBeInTheDocument();
    expect(screen.queryByTestId("region-nae")).toBeNull();
  });

  it("toggles the chart range and says so when a range has no history", async () => {
    render(<StatusView data={RESP} now={NOW} />);
    expect(screen.getByRole("button", { name: "24h" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("img", { name: "Players by region, last 24h" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    expect(screen.getByRole("button", { name: "7d" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/No history for this range yet/)).toBeInTheDocument();
  });

  it("shows a data-source warning when the last cron run failed", () => {
    render(<StatusView data={{ ...RESP, last_error_at: NOW }} now={NOW} />);
    expect(screen.getByText(/data source is not responding/)).toBeInTheDocument();
  });
});

describe("ServerStatusPage", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_ARMORY_PROXY_URL", "https://proxy.test");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("prerenders a placeholder with the credit and no clock-dependent text", () => {
    const html = renderToString(<ServerStatusPage />);
    expect(html).toContain("Aion 2 Server Status");
    expect(html).toContain("Population data via dbaion2.ru; server names from NCSOFT");
    expect(html).toContain("Loading server status");
    expect(html).not.toMatch(/ago|Updated/);
  });

  it("loads, renders, and refetches every 60 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(RESP), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ServerStatusPage />);
    expect(screen.getByText("Loading server status...")).toBeInTheDocument();
    expect(await screen.findByText("21,700")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://proxy.test/status");
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("shows an error, then keeps the last data when a refresh fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 503 })));
    render(<ServerStatusPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/not available right now/);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(RESP), { status: 200 })));
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(await screen.findByText("21,700")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(/Showing the last data received/);
    expect(screen.getByText("21,700")).toBeInTheDocument();
  });

  it("shows the empty state when no servers are known yet", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ...RESP, servers: [], regions: [] }), { status: 200 })));
    render(<ServerStatusPage />);
    expect(await screen.findByText(/No server data yet/)).toBeInTheDocument();
  });

  it("explains itself when the proxy is not configured, and rejects malformed bodies", async () => {
    vi.stubEnv("VITE_ARMORY_PROXY_URL", "");
    await expect(fetchStatus()).rejects.toThrow(/not available in this build/);
    vi.stubEnv("VITE_ARMORY_PROXY_URL", "https://proxy.test");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ nope: 1 }), { status: 200 })));
    await expect(fetchStatus()).rejects.toThrow(/unexpected/);
  });
});
