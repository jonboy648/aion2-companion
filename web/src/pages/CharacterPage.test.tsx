import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CharacterPage } from "./CharacterPage";

let go: (to: string) => void = () => {};
function Nav() {
  go = useNavigate();
  return null;
}

/** Opening another character in the same tab must not leave the previous character's results on the page. */
describe("CharacterPage", () => {
  it("shows one set of playstyle results after switching characters", { timeout: 20000 }, async () => {
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
