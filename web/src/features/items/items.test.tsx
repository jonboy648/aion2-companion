import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ItemsPage } from "@/pages/Items";
import { clearItemCache, loadCategories, loadCategory, loadItem } from "./data";
import { GearViewer } from "./GearViewer";
import {
  CATS, COLUMN, INDEX, MAX_PINS, NO_FILTERS, TOTAL, atEnchant, catOfId, columnsFor, compare, filterRows, nextSort, parsePins, resolveKey, sortRows, statLabel, togglePin,
  type ItemRow,
} from "./logic";

const PUBLIC = join(import.meta.dirname, "../../../public/items");
const fileFetch = vi.fn(async (url: string) => {
  const rel = String(url).split("/items/")[1];
  try {
    return { ok: true, status: 200, json: async () => JSON.parse(readFileSync(join(PUBLIC, rel), "utf8")) };
  } catch {
    return { ok: false, status: 404, json: async () => ({}) };
  }
});

beforeEach(() => {
  clearItemCache();
  fileFetch.mockClear();
  vi.stubGlobal("fetch", fileFetch);
});
afterEach(() => vi.unstubAllGlobals());

const row = (id: number, n: string, o: Partial<ItemRow> = {}): ItemRow => ({ id, n, g: "Epic", il: 60, el: 45, m: {}, cat: "ring", ...o });

describe("filterRows", () => {
  const rows = [
    row(1, "Alpha Blade", { g: "Unique", il: 80, el: 45, c: "Templar", cat: "sword" }),
    row(2, "Beta Blade", { g: "Epic", il: 100, el: 50, c: "Gladiator", cat: "greatsword" }),
    row(3, "Gamma Ring", { g: "Rare", il: 20, el: 10 }),
  ];
  it("matches name (case-insensitive) or id prefix", () => {
    expect(filterRows(rows, { ...NO_FILTERS, q: "blade" }).map((r) => r.id)).toEqual([1, 2]);
    expect(filterRows(rows, { ...NO_FILTERS, q: "3" }).map((r) => r.id)).toEqual([3]);
  });
  it("combines grade, level ranges, class and category", () => {
    expect(filterRows(rows, { ...NO_FILTERS, grades: ["Unique", "Rare"] }).map((r) => r.id)).toEqual([1, 3]);
    expect(filterRows(rows, { ...NO_FILTERS, elMin: 20, elMax: 45 }).map((r) => r.id)).toEqual([1]);
    expect(filterRows(rows, { ...NO_FILTERS, ilMin: 90 }).map((r) => r.id)).toEqual([2]);
    expect(filterRows(rows, { ...NO_FILTERS, cls: "Gladiator" }).map((r) => r.id)).toEqual([2]);
    expect(filterRows(rows, { ...NO_FILTERS, cats: ["ring", "sword"] }).map((r) => r.id)).toEqual([1, 3]);
    expect(filterRows(rows, { ...NO_FILTERS, grades: ["Epic"], elMax: 10 })).toEqual([]);
  });
});

describe("sortRows", () => {
  const rows = [
    row(1, "B", { m: { ArmorDefense: 50 } }),
    row(2, "A", { m: {} }),
    row(3, "C", { m: { ArmorDefense: 90 } }),
    row(4, "D", { m: { ArmorDefense: 50 } }),
  ];
  it("sorts numbers both ways, puts missing values last either way, and breaks ties by name", () => {
    expect(sortRows(rows, { key: "def", dir: "desc" }).map((r) => r.id)).toEqual([3, 1, 4, 2]);
    expect(sortRows(rows, { key: "def", dir: "asc" }).map((r) => r.id)).toEqual([1, 4, 3, 2]);
  });
  it("sorts text and grade by rank, and does not mutate its input", () => {
    const copy = [...rows];
    expect(sortRows(rows, { key: "name", dir: "asc" }).map((r) => r.n)).toEqual(["A", "B", "C", "D"]);
    const g = [row(1, "x", { g: "Epic" }), row(2, "y", { g: "Common" }), row(3, "z", { g: "Unique" })];
    expect(sortRows(g, { key: "grade", dir: "desc" }).map((r) => r.g)).toEqual(["Epic", "Unique", "Common"]);
    expect(rows).toEqual(copy);
  });
  it("nextSort flips the same column and starts text ascending, numbers descending", () => {
    expect(nextSort({ key: "il", dir: "desc" }, "il")).toEqual({ key: "il", dir: "asc" });
    expect(nextSort({ key: "il", dir: "desc" }, "name")).toEqual({ key: "name", dir: "asc" });
    expect(nextSort({ key: "name", dir: "asc" }, "atk")).toEqual({ key: "atk", dir: "desc" });
  });
});

describe("pins and compare", () => {
  it("caps pins at four, toggles off, and parses a ?pin= list defensively", () => {
    let p: number[] = [];
    for (const id of [1, 2, 3, 4, 5]) p = togglePin(p, id);
    expect(p).toEqual([1, 2, 3, 4]);
    expect(MAX_PINS).toBe(4);
    expect(togglePin(p, 2)).toEqual([1, 3, 4]);
    expect(parsePins("5,x,5,-3,7.5,8,9,10,11")).toEqual([5, 8, 9, 10]);
    expect(parsePins(null)).toEqual([]);
  });
  it("lines up values, flags the best, drops rows nobody has, and flags nothing on a tie", () => {
    const a = row(1, "A", { m: { WeaponFixingDamage: 600, Critical: 100 }, il: 80 });
    const b = row(2, "B", { m: { WeaponFixingDamage: 700, Critical: 100 }, il: 80 });
    const lines = compare([a, b], [COLUMN.atk, COLUMN.crit, COLUMN.def, COLUMN.il]);
    expect(lines.map((l) => l.col.key)).toEqual(["atk", "crit", "il"]);
    expect(lines[0]).toMatchObject({ values: [600, 700], best: [1] });
    expect(lines[1].best).toEqual([]);
    expect(lines[2].best).toEqual([]);
  });
  it("handles an item missing a stat the other has", () => {
    const l = compare([row(1, "A", { m: { HPMax: 10 } }), row(2, "B")], [COLUMN.hp])[0];
    expect(l.values).toEqual([10, undefined]);
  });
});

describe("derived helpers", () => {
  it("atEnchant adds the cumulative series bonus", () => {
    expect(atEnchant(446, [10, 20, 30], 0)).toBe(446);
    expect(atEnchant(446, [10, 20, 30], 2)).toBe(466);
    expect(atEnchant(446, [10, 20, 30], 99)).toBe(476);
    expect(atEnchant(5, undefined, 3)).toBe(5);
  });
  it("statLabel uses the label table and splits unknown ids at capitals", () => {
    expect(statLabel("WeaponFixingDamage")).toBe("Attack");
    expect(statLabel("SomeNewStat")).toBe("Some New Stat");
  });
  it("columnsFor shows only stat columns some row has and adds Type / Class when they vary", () => {
    const cols = columnsFor([row(1, "A", { m: { ArmorDefense: 5 }, cat: "helmet" }), row(2, "B", { m: { HPMax: 5 }, cat: "boots" })]);
    expect(cols).toEqual(["grade", "cat", "el", "il", "def", "hp"]);
    expect(columnsFor([row(1, "A", { c: "Templar", mn: 1, m: { WeaponFixingDamage: 2 } })])).toEqual(["grade", "class", "el", "il", "atk", "atkmin"]);
  });
});

describe("the item index", () => {
  it("adds up, resolves keys and finds the category of every item id", () => {
    expect(TOTAL).toBe(3555);
    expect(CATS.length).toBe(25);
    expect(resolveKey(undefined).kind).toBe("root");
    expect(resolveKey("weapons").kind).toBe("group");
    expect(resolveKey("greatsword").kind).toBe("cat");
    expect(resolveKey("110120003")).toEqual({ kind: "item", id: 110120003 });
    expect(resolveKey("nonsense").kind).toBe("unknown");
    expect(catOfId(110120003)).toBe("greatsword");
    expect(catOfId(1)).toBeNull();
    expect(INDEX.runs.length).toBeGreaterThan(0);
  });
  it("every id in every category file resolves back to that category", async () => {
    const rows = await loadCategories();
    expect(rows.length).toBe(TOTAL);
    for (const r of rows) expect(catOfId(r.id), `${r.id} ${r.n}`).toBe(r.cat);
  });
});

describe("data loading", () => {
  it("fetches a category once, tags rows with it, and shares the request", async () => {
    const [a, b] = await Promise.all([loadCategory("belt"), loadCategory("belt")]);
    expect(a).toEqual(b);
    expect(a.length).toBe(CATS.find((c) => c.key === "belt")!.count);
    expect(a.every((r) => r.cat === "belt")).toBe(true);
    await loadCategory("belt");
    expect(fileFetch).toHaveBeenCalledTimes(1);
    expect(fileFetch.mock.calls[0][0]).toMatch(/items\/cat\/belt\.json$/);
  });
  it("loads an item's detail with the enchant tables its group uses, and null for an unknown id", async () => {
    const p = (await loadItem(110120003))!;
    expect(p.cat).toBe("greatsword");
    expect(p.item.name).toBe("Ludra's Blade of Extinction");
    expect(p.enchant.series[p.item.enchant_group!]).toBeTruthy();
    expect(await loadItem(123)).toBeNull();
    expect(await loadItem(110120004)).toBeNull(); // inside a category's id range but not an item
  });
  it("does not cache a failed request", async () => {
    fileFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    await expect(loadCategory("rune")).rejects.toThrow(/HTTP 500/);
    expect((await loadCategory("rune")).length).toBe(1);
  });
});

describe("pages", () => {
  const at = (path: string, element = <ItemsPage />, route = "items/:key?") =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
        </Routes>
      </MemoryRouter>,
    );

  it("lists a category, filters it and sorts by a clicked header", async () => {
    at("/items/belt");
    await screen.findAllByText("Noble Belt");
    expect(screen.getByRole("navigation", { name: "Item categories" })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Name or id"), { target: { value: "zzzz" } });
    expect(await screen.findByText("No items match these filters.")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Name or id"), { target: { value: "" } });
    await screen.findAllByText("Noble Belt");
    fireEvent.click(screen.getByRole("button", { name: /^Defense/ }));
    const th = screen.getByRole("columnheader", { name: /Defense/ });
    expect(th).toHaveAttribute("aria-sort", "descending");
  });

  it("shows an item's stats, enchant to max, random stat ranges and sources", async () => {
    at("/items/110120003");
    await screen.findByRole("heading", { name: "Ludra's Blade of Extinction" });
    expect(screen.getByText("446 - 604")).toBeInTheDocument();
    expect(screen.getByText(/Random stats/)).toBeInTheDocument();
    expect(screen.getByText("Enchant +1 to +15")).toBeInTheDocument();
    expect(screen.getByText("Where to get it")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Compare in the gear viewer" })).toHaveAttribute("href", "/gear-viewer?pin=110120003");
  });

  it("says so for an id we do not have", async () => {
    at("/items/123456789");
    expect(await screen.findByText(/No item 123456789 in our data/)).toBeInTheDocument();
  });

  it("gear viewer: pins up to four items, compares them side by side, and unpins", async () => {
    at("/gear-viewer?pin=", <GearViewer />, "gear-viewer");
    await screen.findByText("Showing 100 of 3,555");
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "belt" } });
    const pinButtons = () => screen.getAllByRole("button", { name: /^Pin / });
    expect(pinButtons().length).toBe(3);
    pinButtons().forEach((b) => fireEvent.click(b));
    const panel = (await screen.findByRole("heading", { name: /Compare \(3 of 4\)/ })).closest(".ornate") as HTMLElement;
    expect(within(panel).getAllByRole("columnheader").length).toBe(4); // stat label + 3 items
    expect(within(panel).getByText("Defense")).toBeInTheDocument();
    fireEvent.click(within(panel).getAllByRole("button", { name: /^Unpin / })[0]);
    await waitFor(() => expect(screen.getByRole("heading", { name: /Compare \(2 of 4\)/ })).toBeInTheDocument());
  });

  it("gear viewer: stat columns can be switched on and off", async () => {
    at("/gear-viewer", <GearViewer />, "gear-viewer");
    await screen.findByText("Showing 100 of 3,555");
    expect(screen.queryByRole("columnheader", { name: /Combat speed/ })).toBeNull();
    const picker = within(screen.getByRole("group", { name: "Stat columns" }));
    fireEvent.click(picker.getByRole("button", { name: "Combat speed" }));
    expect(screen.getByRole("columnheader", { name: /Combat speed/ })).toBeInTheDocument();
    fireEvent.click(picker.getByRole("button", { name: "Attack" }));
    expect(screen.queryByRole("columnheader", { name: /^Attack/ })).toBeNull();
  });
});
