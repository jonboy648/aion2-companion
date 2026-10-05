import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimerStrip } from "./TimerStrip";
import { stripChips } from "./status";

const t = (iso: string) => Date.parse(iso);

describe("TimerStrip", () => {
  afterEach(() => vi.useRealTimers());

  it("prerenders placeholders only (no clock-dependent text)", () => {
    const html = renderToString(
      <MemoryRouter>
        <TimerStrip />
      </MemoryRouter>,
    );
    expect(html).toContain("--");
    expect(html).not.toMatch(/\d+[smhd]\b/);
  });

  it("fills in countdowns on the client", () => {
    vi.useFakeTimers({ now: t("2026-10-05T12:05:00Z"), toFake: ["Date", "setInterval", "clearInterval"] });
    render(
      <MemoryRouter>
        <TimerStrip />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("ends 5m 00s").length).toBeGreaterThan(0); // Shugo runs 12:00-12:10
  });
});

describe("stripChips", () => {
  it("shows Shugo ends, rift portal close, next boss and daily reset", () => {
    const c = stripChips("global", t("2026-10-05T03:04:00Z"));
    expect(c.find((x) => x.id === "shugo")).toMatchObject({ text: "ends 6m 00s", active: true }); // 03:00-03:10
    expect(c.find((x) => x.id === "rift")).toMatchObject({ text: "portal closes in 6m 00s", active: true });
    expect(c.find((x) => x.id === "boss")!.label).toBe("Kaira"); // 05:00
    expect(c.find((x) => x.id === "daily")!.text).toBe("12h 56m");
    for (const chip of c) expect(chip.upcoming.length).toBe(5);
  });

  it("marks an active boss event green with its end time", () => {
    const boss = stripChips("global", t("2026-10-05T21:40:00Z")).find((x) => x.id === "boss")!;
    expect(boss).toMatchObject({ label: "Siege bosses", text: "ends 20m 00s", active: true });
  });
});
