import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalSearch } from "./GlobalSearch";
import { expandIndex, loadIndex, loadRecentQueries, resetIndexCache, saveRecentQuery, searchEntries, type RawIndex } from "./index";
// @ts-expect-error plain .mjs build script, no types
import { buildIndex } from "../../../scripts/build_search_index.mjs";

const RAW: RawIndex = {
  v: 1,
  itemRoute: true,
  pages: [["Daevanion planner", "/daevanion", "Boards"], ["Class Codex", "/codex", "Skills"]],
  classes: [["sorcerer", "Sorcerer", "ranged_dps"], ["cleric", "Cleric", "healer"]],
  skills: [["Flame Arrow", "sorcerer", "flame-arrow", "active", "ICON_SO_SKILL_001"], ["Flame Strike", "cleric", "flame-strike", "active", ""]],
  daevanion: [["Nezekan", "sorcerer", "Nezekan", "b"]],
  items: [["Flame Greatsword", 42, "weapon", "Unique", "Icon_WP_GS_0001"]],
};

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}

function setup() {
  return render(
    <MemoryRouter initialEntries={["/start"]}>
      <GlobalSearch />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  resetIndexCache();
  localStorage.clear();
  fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => RAW }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("index", () => {
  it("expands the compact index and groups results in order", () => {
    const all = expandIndex(RAW);
    const res = searchEntries(all, "flame");
    expect(res.map((e) => e.group)).toEqual(["Skills", "Skills", "Items"]);
    expect(res[0].to).toBe("/codex/sorcerer?skill=flame-arrow");
    expect(res[2].to).toBe("/items/42");
    expect(searchEntries(all, "sorc")[0].group).toBe("Classes");
  });

  it("drops items while the site has no /items route", () => {
    expect(expandIndex({ ...RAW, itemRoute: false }).some((e) => e.group === "Items")).toBe(false);
  });

  it("loads once, lazily, and retries after a failure", async () => {
    expect(fetchMock).not.toHaveBeenCalled();
    await loadIndex();
    await loadIndex();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resetIndexCache();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    await expect(loadIndex()).rejects.toThrow();
    await expect(loadIndex()).resolves.toBeTruthy();
  });

  it("recent searches dedupe and survive blocked storage", () => {
    saveRecentQuery("flame");
    saveRecentQuery("Flame");
    saveRecentQuery("arrow");
    expect(loadRecentQueries()).toEqual(["arrow", "Flame"]);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadRecentQueries()).toEqual([]);
    expect(() => saveRecentQuery("x")).not.toThrow();
  });

  it("the build script indexes the real repo data", () => {
    const idx = buildIndex();
    expect(idx.classes.length).toBeGreaterThanOrEqual(8);
    expect(idx.skills.length).toBeGreaterThan(100);
    expect(idx.items.length).toBeGreaterThan(1000);
    expect(idx.pages.some((p: string[]) => p[1] === "/daevanion")).toBe(true);
  });
});

describe("GlobalSearch palette", () => {
  it("is closed until Ctrl+K, which opens it, loads the index and focuses the input; again closes", async () => {
    setup();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("combobox");
    expect(input).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens from the header button too", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Search the site" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("arrows move the active option, Enter navigates and records the query, Escape closes", async () => {
    setup();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "flame" } });
    const opts = await screen.findAllByRole("option");
    expect(opts[0]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", opts[0].id);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    const all = screen.getAllByRole("option");
    expect(all[all.length - 1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("where")).toHaveTextContent("/codex/sorcerer?skill=flame-arrow");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(loadRecentQueries()).toEqual(["flame"]);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const again = await screen.findByRole("combobox");
    fireEvent.keyDown(again, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("has combobox/listbox semantics and group headings", async () => {
    setup();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "flame" } });
    await screen.findAllByRole("option");
    const list = screen.getByRole("listbox");
    expect(input).toHaveAttribute("aria-controls", list.id);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getAllByRole("group")).toHaveLength(3);
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Items")).toBeInTheDocument();
  });

  it("offers a character lookup action and traps Tab inside the dialog", async () => {
    setup();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("combobox");
    fireEvent.change(input, { target: { value: "Zed" } });
    expect(await screen.findByText('Search characters named "Zed"')).toBeInTheDocument();
    const close = screen.getByRole("button", { name: "Close search" });
    close.focus();
    fireEvent.keyDown(close, { key: "Tab" });
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    expect(close).toHaveFocus();
  });

  it("shows recent searches when empty and fills the query on select", async () => {
    saveRecentQuery("arrow");
    setup();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const opt = await screen.findByRole("option", { name: /arrow/i });
    fireEvent.click(opt);
    expect(screen.getByRole("combobox")).toHaveValue("arrow");
  });
});
