import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { PartyMap } from "./PartyMap";
import { decodeMarkers, encodeMarkers, sanitize, MAX_MARKERS } from "./partyMarkers";

const at = (url = "/maps/") => render(<MemoryRouter initialEntries={[url]}><PartyMap /></MemoryRouter>);

describe("party marker data", () => {
  it("round-trips through a share link", () => {
    const m = [{ id: "a", kind: "question" as const, x: 0.25, y: 0.5, label: "Cube? ünï" }];
    expect(decodeMarkers(encodeMarkers(m))).toMatchObject([{ kind: "question", x: 0.25, y: 0.5, label: "Cube? ünï" }]);
  });
  it("drops junk from a pasted link and never throws", () => {
    expect(decodeMarkers("not base64 !!")).toEqual([]);
    expect(sanitize([{ kind: "evil", x: 0, y: 0 }, { kind: "boss", x: NaN, y: 0 }, "x", null])).toEqual([]);
    const [p] = sanitize([{ kind: "boss", x: 9, y: -3, label: "x".repeat(500) }]);
    expect([p.x, p.y, p.label.length]).toEqual([1, 0, 40]);
    expect(sanitize(Array.from({ length: 999 }, () => ({ kind: "boss", x: 0.5, y: 0.5 }))).length).toBe(MAX_MARKERS);
  });
});

describe("PartyMap", () => {
  beforeEach(() => localStorage.clear());

  it("drops a pin where you click, lists it, and removes it", () => {
    at();
    const svg = screen.getByRole("img", { name: /0 pins/ });
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 650, right: 1000, bottom: 650, x: 0, y: 0, toJSON() {} });
    fireEvent.click(screen.getByRole("button", { name: /Boss/ }));
    fireEvent.change(screen.getByLabelText(/Label for the next pin/), { target: { value: "Frost king" } });
    fireEvent.pointerDown(svg, { clientX: 500, clientY: 325 });
    fireEvent.pointerUp(svg, { clientX: 500, clientY: 325 });
    expect(screen.getAllByTestId("pin")).toHaveLength(1);
    expect(screen.getByRole("img", { name: /1 pins/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove Frost king" }));
    expect(screen.queryAllByTestId("pin")).toHaveLength(0);
  });

  it("does not drop a pin when the pointer was dragged", () => {
    at();
    const svg = screen.getByRole("img");
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 650, right: 1000, bottom: 650, x: 0, y: 0, toJSON() {} });
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(svg, { clientX: 160, clientY: 140 });
    fireEvent.pointerUp(svg, { clientX: 160, clientY: 140 });
    expect(screen.queryAllByTestId("pin")).toHaveLength(0);
  });

  it("opens the pins from a share link", () => {
    const m = encodeMarkers([{ id: "a", kind: "rally", x: 0.1, y: 0.2, label: "Here" }]);
    at(`/maps/?m=${m}`);
    expect(screen.getAllByTestId("pin")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Remove Here" })).toBeTruthy();
  });
});
