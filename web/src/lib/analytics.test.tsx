import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { AdminAuthError, ADMIN_TOKEN_KEY, _resetTrackingForTests, fetchAdminStats, trackHit, trackPicked, type AdminStats } from "@/lib/analytics";

const STATS: AdminStats = {
  generated_at: Date.UTC(2026, 9, 3, 12, 0),
  totals: {
    today: { page_views: 12, unique_visitors: 5 },
    last_7_days: { page_views: 80, unique_visitors: 31 },
    last_30_days: { page_views: 300, unique_visitors: 120 },
    all_time: { page_views: 900, unique_visitors: 410 },
  },
  visits_per_day: Array.from({ length: 30 }, (_, i) => ({ day: `2026-09-${String(i + 4).padStart(2, "0")}`, page_views: i, unique_visitors: Math.floor(i / 2) })),
  top_paths: [{ path: "/", page_views: 100 }],
  top_searches: [{ keyword: "DarthThot", count: 7, last_ts: Date.UTC(2026, 9, 3, 11, 0) }],
  recent_searches: [{ ts: Date.UTC(2026, 9, 3, 11, 0), keyword: "Darth", region: "nae", results: 3, picked: { name: "DarthThot", server: "Triniel" } }],
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  _resetTrackingForTests();
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true });
});

describe("tracking beacons", () => {
  it("send nothing when the proxy url is unset", () => {
    vi.stubEnv("VITE_ARMORY_PROXY_URL", "");
    trackHit("/guide");
    trackPicked("A", "B");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST /hit once per route change, cookieless, skipping duplicates and /admin", () => {
    vi.stubEnv("VITE_ARMORY_PROXY_URL", "https://p.example/");
    trackHit("/guide");
    trackHit("/guide");
    trackHit("/admin");
    trackHit("/build");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://p.example/hit");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(JSON.parse(init.body)).toEqual({ path: "/guide" });
  });

  it("respects Do Not Track", () => {
    vi.stubEnv("VITE_ARMORY_PROXY_URL", "https://p.example");
    Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true });
    trackHit("/guide");
    trackPicked("A", "B");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST /picked carries name and server", () => {
    vi.stubEnv("VITE_ARMORY_PROXY_URL", "https://p.example");
    trackPicked("DarthThot", "Triniel");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://p.example/picked");
    expect(JSON.parse(init.body)).toEqual({ name: "DarthThot", server: "Triniel" });
  });

  it("the app shell sends a hit for the current route and shows the privacy note", async () => {
    vi.stubEnv("VITE_ARMORY_PROXY_URL", "https://p.example");
    render(
      <MemoryRouter initialEntries={["/roadmap"]}>
        <App />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("https://p.example/hit", expect.objectContaining({ method: "POST" })));
    expect(screen.getByText(/no cookies, no IP stored/)).toBeInTheDocument();
  });
});

describe("admin", () => {
  it("fetchAdminStats sends the bearer token and maps 401 to AdminAuthError", async () => {
    vi.stubEnv("VITE_ARMORY_PROXY_URL", "https://p.example");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(STATS), { status: 200 }));
    expect(await fetchAdminStats("tok")).toEqual(STATS);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    await expect(fetchAdminStats("bad")).rejects.toBeInstanceOf(AdminAuthError);
  });

  it("#/admin asks for a token, stores it in sessionStorage only, and renders the dashboard", async () => {
    vi.stubEnv("VITE_ARMORY_PROXY_URL", "https://p.example");
    fetchMock.mockImplementation(async (url: string) =>
      String(url).endsWith("/admin/stats") ? new Response(JSON.stringify(STATS), { status: 200 }) : new Response(null, { status: 204 }),
    );
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Admin token"), { target: { value: "tok" } });
    fireEvent.click(screen.getByRole("button", { name: "Open dashboard" }));
    expect(await screen.findByText("Visitors today")).toBeInTheDocument();
    expect(screen.getAllByText("DarthThot").length).toBeGreaterThan(0);
    expect(window.sessionStorage.getItem(ADMIN_TOKEN_KEY)).toBe("tok");
    expect(window.localStorage.getItem(ADMIN_TOKEN_KEY)).toBeNull();
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/hit"))).toBe(false); // /admin is never tracked
  });

  it("a wrong token clears storage and shows the form again", async () => {
    vi.stubEnv("VITE_ARMORY_PROXY_URL", "https://p.example");
    window.sessionStorage.setItem(ADMIN_TOKEN_KEY, "old");
    fetchMock.mockImplementation(async () => new Response("{}", { status: 401 }));
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong token");
    expect(window.sessionStorage.getItem(ADMIN_TOKEN_KEY)).toBeNull();
    expect(screen.getByLabelText("Admin token")).toBeInTheDocument();
  });
});
