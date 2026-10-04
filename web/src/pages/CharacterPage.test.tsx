import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CharacterPage } from "./CharacterPage";

let go: (to: string) => void = () => {};
function Nav() {
  go = useNavigate();
  return null;
}

/** Opening another character in the same tab must not leave the previous character's results on the page. */
describe("CharacterPage", () => {
  it("shows one set of playstyle results after switching characters", async () => {
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
});
