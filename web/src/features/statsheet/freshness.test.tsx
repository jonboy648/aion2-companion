import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import rawFx from "@/fixtures/armory_raw.json";
import sheetFx from "@/fixtures/stat_sheet.json";
import type { ArmoryRaw, StatSheet } from "@/lib/types";
import { useStatSheet } from "./logic";
import { StatSheetSection } from "./StatSheetSection";

const io = vi.hoisted(() => ({ statSheet: vi.fn() }));
vi.mock("@/engine/api", () => ({ statSheet: io.statSheet }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("never exposes the previous character's sheet while the next character waits for the engine", async () => {
  const raw = rawFx as unknown as ArmoryRaw;
  const sheet = sheetFx as unknown as StatSheet;
  let finish!: (sheet: StatSheet) => void;
  io.statSheet.mockResolvedValueOnce(sheet).mockImplementationOnce(() => new Promise<StatSheet>((resolve) => { finish = resolve; }));
  const { result, rerender } = renderHook(({ raw, ready }) => useStatSheet(raw, true, ready), { initialProps: { raw, ready: true } });
  await waitFor(() => expect(result.current.data).toBe(sheet));
  rerender({ raw: structuredClone(raw), ready: false });
  expect(result.current.data).toBeNull();
  expect(result.current.busy).toBe(false);
  rerender({ raw: structuredClone(raw), ready: true });
  expect(result.current.data).toBeNull();
  await act(async () => finish({ ...sheet, class_name: "Cleric" }));
  expect(result.current.data?.class_name).toBe("Cleric");
});

it("shows unrecognized effects instead of silently omitting them from the sheet", async () => {
  io.statSheet.mockResolvedValue({ ...sheetFx, unparsed: ["Title (Attack): New effect +25"] });
  render(<StatSheetSection raw={rawFx as unknown as ArmoryRaw} />);
  expect(await screen.findByText(/1 armory effect could not be interpreted/)).toBeVisible();
  fireEvent.click(screen.getByText(/What the armory does not tell us/));
  expect(screen.getByText(/Not included: Title \(Attack\): New effect \+25/)).toBeVisible();
});

it("labels an omitted attribute unavailable rather than showing a zero total", async () => {
  io.statSheet.mockResolvedValue({ ...sheetFx, categories: [{ key: "attributes", name: "Attributes", stats: [
    { key: "STR", name: "Might", unit: "", value: 0, sources: [], armory_unavailable: true },
  ] }] });
  render(<StatSheetSection raw={rawFx as unknown as ArmoryRaw} />);
  const row = await screen.findByTestId("stat-row-STR");
  expect(within(row).getByText("Unavailable")).toBeVisible();
  expect(within(row).queryByText("0")).not.toBeInTheDocument();
});
