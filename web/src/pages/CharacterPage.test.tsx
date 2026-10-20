import { act, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import rawFx from "@/fixtures/armory_raw.json";
import importFx from "@/fixtures/import_character.json";
import searchFx from "@/fixtures/armory_search.json";
import * as armory from "@/lib/armory";
import * as engine from "@/engine/api";
import type { ArmoryRaw, ArmorySearchHit, ImportResult } from "@/lib/types";
import { CharacterPage } from "./CharacterPage";

let go: (to: string) => void = () => {};
afterEach(() => vi.restoreAllMocks());
function Nav() {
  go = useNavigate();
  return null;
}

/** Opening another character in the same tab must not leave the previous character's results on the page. */
describe("CharacterPage", () => {
  it("shows one set of playstyle results after switching characters", { timeout: 20000 }, async () => {
    // The old test passed because a missing Luna lookup silently imported DarthThot.
    const hit = searchFx.list[0] as ArmorySearchHit;
    vi.spyOn(armory, "search").mockResolvedValue([hit, { ...hit, name: "Luna", serverId: 1101, characterId: "luna-character" }]);
    vi.spyOn(armory, "fetchCharacter").mockImplementation(async (id) => {
      const raw = structuredClone(rawFx) as unknown as ArmoryRaw;
      raw.info.profile = { ...rawFx.info.profile, ...(id === "luna-character" ? { characterName: "Luna", serverId: 1101 } : {}) };
      return raw;
    });
    vi.spyOn(engine, "importCharacter").mockImplementation(async (raw) => {
      const imp = structuredClone(importFx) as unknown as ImportResult;
      const name = (raw.info.profile as { characterName: string }).characterName;
      return { ...imp, profile: { ...imp.profile, name }, build: { ...imp.build, name } };
    });
    render(
      <MemoryRouter initialEntries={["/c/nae/2103/DarthThot"]}>
        <Nav />
        <Routes>
          <Route path="/c/:region/:serverId/:name" element={<CharacterPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText(/Boss DPS plan/).length).toBe(1), { timeout: 5000 });
    act(() => go("/c/nae/1101/Luna"));
    await waitFor(() => expect(screen.getAllByText(/Boss DPS plan/).length).toBe(1), { timeout: 5000 });
    expect(screen.getAllByText(/Boss DPS plan/).length).toBe(1);
    expect(screen.getByRole("heading", { level: 2, name: "Luna" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "DarthThot" })).not.toBeInTheDocument();
  });

  it("removes the previous results and sheet when the next lookup fails", async () => {
    render(<MemoryRouter initialEntries={["/c/nae/2103/DarthThot"]}>
      <Nav /><Routes><Route path="/c/:region/:serverId/:name" element={<CharacterPage />} /></Routes>
    </MemoryRouter>);
    await screen.findByTestId("stat-sheet", {}, { timeout: 5000 });
    act(() => go("/c/eu/9999/NotThere"));
    expect(await screen.findByRole("alert", {}, { timeout: 5000 })).toHaveTextContent(/No character.*NotThere/);
    expect(screen.queryByTestId("character-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stat-sheet")).not.toBeInTheDocument();
    expect(screen.queryByText(/Boss DPS plan/)).not.toBeInTheDocument();
  });

  it("never renders sibling elements with the same key (React then duplicates blocks and skips removals in production)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={["/c/nae/2103/DarthThot"]}>
        <Routes>
          <Route path="/c/:region/:serverId/:name" element={<CharacterPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText(/Boss DPS plan/).length).toBe(1), { timeout: 5000 });
    await waitFor(() => expect(screen.getByText(/Max potential/)).toBeTruthy());
    const dup = err.mock.calls.map((c) => String(c[0])).filter((m) => /same key|unique "key"/i.test(m));
    err.mockRestore();
    expect(dup).toEqual([]);
  });

  it("shows the Stat sheet with its categories once the character is loaded", async () => {
    render(
      <MemoryRouter initialEntries={["/c/nae/2103/DarthThot"]}>
        <Routes>
          <Route path="/c/:region/:serverId/:name" element={<CharacterPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const sheet = await screen.findByTestId("stat-sheet", {}, { timeout: 5000 });
    expect(within(sheet).getByRole("heading", { name: "Stat sheet" })).toBeTruthy();
    await within(sheet).findByTestId("stat-cat-attack", {}, { timeout: 5000 });
    expect(within(sheet).getByTestId("stat-cat-deity")).toBeTruthy();
  });

  it("has a Refresh button that is off while loading and reloads the character when pressed", async () => {
    render(
      <MemoryRouter initialEntries={["/c/nae/2103/DarthThot"]}>
        <Routes>
          <Route path="/c/:region/:serverId/:name" element={<CharacterPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const btn = screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true); // still loading
    await waitFor(() => expect(btn.disabled).toBe(false), { timeout: 5000 });
    act(() => btn.click());
    expect((screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement).disabled).toBe(true); // reloading
    await waitFor(() => expect(screen.getAllByText(/Boss DPS plan/).length).toBe(1), { timeout: 5000 });
    await waitFor(() => expect((screen.getByRole("button", { name: "Refresh" }) as HTMLButtonElement).disabled).toBe(false));
  });
});
