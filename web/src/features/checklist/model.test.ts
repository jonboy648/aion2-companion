import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY, addCharacter, addTask, countOf, deleteCharacter, emptyState, exportJson, groupProgress, importJson, isDone, linkArmory,
  loadState, migrate, moveTask, parseArmory, pruneStale, removeTask, renameCharacter, reorder, saveState, setCount, shareUrl, tasksFromToken,
  templateToken, toggle, whatResetsNext, applyTemplate, type ChecklistState,
} from "./model";
import { PACKS, addPack } from "./presets";
import { lastReset, nextReset } from "./reset";

const t = (iso: string) => Date.parse(iso);
// 2026-10-05 is a Monday. Global resets 16:00 UTC; KR resets 05:00 KST (20:00 UTC the day before). Weekly is Wednesday.
const MON = "2026-10-05T12:00:00Z";

function withTask(group: "daily" | "weekly" | "custom", opts: { target?: number; everyDays?: number } = {}, region: "global" | "kr" | "tw" = "global", at = MON) {
  const s = addTask(emptyState(), { group, title: "Thing", ...opts }, region, t(at));
  return { s, task: s.tasks[0], char: s.activeId };
}

describe("reset boundaries", () => {
  it("daily global: 16:00 UTC, exact on the boundary", () => {
    expect(lastReset("daily", "global", t("2026-10-05T12:00:00Z"))).toBe(t("2026-10-04T16:00:00Z"));
    expect(lastReset("daily", "global", t("2026-10-05T15:59:59Z"))).toBe(t("2026-10-04T16:00:00Z"));
    expect(lastReset("daily", "global", t("2026-10-05T16:00:00Z"))).toBe(t("2026-10-05T16:00:00Z"));
    expect(nextReset("daily", "global", t("2026-10-05T16:00:00Z"))).toBe(t("2026-10-06T16:00:00Z"));
  });

  it("weekly global: Wednesday 16:00 UTC", () => {
    expect(lastReset("weekly", "global", t(MON))).toBe(t("2026-09-30T16:00:00Z"));
    expect(lastReset("weekly", "global", t("2026-10-07T15:59:59Z"))).toBe(t("2026-09-30T16:00:00Z"));
    expect(lastReset("weekly", "global", t("2026-10-07T16:00:00Z"))).toBe(t("2026-10-07T16:00:00Z"));
    expect(lastReset("weekly", "global", t("2026-10-09T03:00:00Z"))).toBe(t("2026-10-07T16:00:00Z"));
    expect(nextReset("weekly", "global", t("2026-10-07T16:00:00Z"))).toBe(t("2026-10-14T16:00:00Z"));
  });

  it("KR and TW: 05:00 local, so the global date has not changed yet when it fires", () => {
    expect(lastReset("daily", "kr", t("2026-10-05T19:59:59Z"))).toBe(t("2026-10-04T20:00:00Z"));
    expect(lastReset("daily", "kr", t("2026-10-05T20:00:00Z"))).toBe(t("2026-10-05T20:00:00Z"));
    expect(lastReset("weekly", "kr", t("2026-10-06T19:59:59Z"))).toBe(t("2026-09-29T20:00:00Z"));
    expect(lastReset("weekly", "kr", t("2026-10-06T20:00:00Z"))).toBe(t("2026-10-06T20:00:00Z"));
    // Taipei is UTC+8, so 05:00 there is 21:00 UTC the day before
    expect(lastReset("daily", "tw", t("2026-10-05T20:59:59Z"))).toBe(t("2026-10-04T21:00:00Z"));
    expect(lastReset("daily", "tw", t("2026-10-05T21:00:00Z"))).toBe(t("2026-10-05T21:00:00Z"));
  });

  it("lastReset and nextReset bracket now across a month and year boundary", () => {
    for (const iso of ["2026-12-31T23:59:59Z", "2027-01-01T00:00:00Z", "2026-03-01T04:00:00Z"]) {
      for (const r of ["global", "kr", "tw"] as const) {
        for (const k of ["daily", "weekly"] as const) {
          const now = t(iso);
          expect(lastReset(k, r, now)).toBeLessThanOrEqual(now);
          expect(nextReset(k, r, now)).toBeGreaterThan(now);
        }
      }
    }
  });
});

describe("ticks clear on reset, even if the tab was closed", () => {
  it("daily tick lives until 16:00 UTC", () => {
    const { s, task, char } = withTask("daily");
    const done = toggle(s, char, task, "global", t(MON));
    expect(isDone(done, char, task, "global", t("2026-10-05T15:59:59Z"))).toBe(true);
    expect(isDone(done, char, task, "global", t("2026-10-05T16:00:00Z"))).toBe(false);
    expect(isDone(done, char, task, "global", t("2026-10-06T15:00:00Z"))).toBe(false);
  });

  it("a tick made just after a reset survives to the next one", () => {
    const { s, task, char } = withTask("daily");
    const done = toggle(s, char, task, "global", t("2026-10-05T16:00:01Z"));
    expect(isDone(done, char, task, "global", t("2026-10-06T15:59:59Z"))).toBe(true);
    expect(isDone(done, char, task, "global", t("2026-10-06T16:00:00Z"))).toBe(false);
  });

  it("weekly tick lives until Wednesday 16:00 UTC and is gone after weeks away", () => {
    const { s, task, char } = withTask("weekly");
    const done = toggle(s, char, task, "global", t("2026-10-06T09:00:00Z")); // Tuesday
    expect(isDone(done, char, task, "global", t("2026-10-07T15:59:59Z"))).toBe(true);
    expect(isDone(done, char, task, "global", t("2026-10-07T16:00:00Z"))).toBe(false);
    expect(isDone(done, char, task, "global", t("2026-10-28T10:00:00Z"))).toBe(false);
  });

  it("a daily reset does not clear a weekly tick", () => {
    const { s, task, char } = withTask("weekly");
    const done = toggle(s, char, task, "global", t("2026-10-05T17:00:00Z"));
    expect(isDone(done, char, task, "global", t("2026-10-06T17:00:00Z"))).toBe(true);
  });

  it("KR region resets at 05:00 KST", () => {
    const { s, task, char } = withTask("daily", {}, "kr");
    const done = toggle(s, char, task, "kr", t("2026-10-05T10:00:00Z"));
    expect(isDone(done, char, task, "kr", t("2026-10-05T19:59:59Z"))).toBe(true);
    expect(isDone(done, char, task, "kr", t("2026-10-05T20:00:00Z"))).toBe(false);
    // the same tick under the global clock is still inside the 16:00 UTC cycle
    expect(isDone(done, char, task, "global", t("2026-10-05T15:59:59Z"))).toBe(true);
  });

  it("counts: 2 of 3 runs, capped, cleared by the reset", () => {
    const { s, task, char } = withTask("daily", { target: 3 });
    let x = setCount(s, char, task, 2, t(MON));
    expect(countOf(x, char, task, "global", t(MON))).toBe(2);
    expect(isDone(x, char, task, "global", t(MON))).toBe(false);
    x = setCount(x, char, task, 9, t(MON));
    expect(countOf(x, char, task, "global", t(MON))).toBe(3);
    expect(isDone(x, char, task, "global", t(MON))).toBe(true);
    expect(countOf(x, char, task, "global", t("2026-10-05T16:00:00Z"))).toBe(0);
    expect(setCount(x, char, task, 0, t(MON)).progress[char][task.id]).toBeUndefined();
  });

  it("custom every-3-days task resets on its own cycle", () => {
    const { s, task, char } = withTask("custom", { everyDays: 3 }); // made Mon 12:00 UTC, cycle began Sun 16:00 UTC
    const done = toggle(s, char, task, "global", t("2026-10-06T10:00:00Z"));
    expect(isDone(done, char, task, "global", t("2026-10-07T15:59:59Z"))).toBe(true);
    expect(isDone(done, char, task, "global", t("2026-10-07T16:00:00Z"))).toBe(false);
    const again = toggle(done, char, task, "global", t("2026-10-07T17:00:00Z"));
    expect(isDone(again, char, task, "global", t("2026-10-10T15:59:59Z"))).toBe(true);
    expect(isDone(again, char, task, "global", t("2026-10-10T16:00:00Z"))).toBe(false);
  });

  it("pruneStale drops old ticks and keeps current ones", () => {
    const { s, task, char } = withTask("daily");
    const done = toggle(s, char, task, "global", t(MON));
    expect(pruneStale(done, "global", t("2026-10-05T15:00:00Z")).progress[char][task.id]).toBeDefined();
    expect(pruneStale(done, "global", t("2026-10-05T17:00:00Z")).progress[char][task.id]).toBeUndefined();
  });

  it("what resets next picks the soonest group that has tasks", () => {
    let s = emptyState();
    expect(whatResetsNext(s, "global", t(MON))).toBeNull();
    s = addTask(s, { group: "weekly", title: "W" }, "global", t(MON));
    expect(whatResetsNext(s, "global", t(MON))).toEqual({ group: "weekly", at: t("2026-10-07T16:00:00Z") });
    s = addTask(s, { group: "daily", title: "D" }, "global", t(MON));
    expect(whatResetsNext(s, "global", t(MON))).toEqual({ group: "daily", at: t("2026-10-05T16:00:00Z") });
    expect(groupProgress(s, s.activeId, "daily", "global", t(MON))).toEqual({ done: 0, total: 1 });
  });
});

describe("multiple characters", () => {
  it("each character has its own ticks, and deleting one removes only its progress", () => {
    const { s, task, char } = withTask("daily");
    let x = addCharacter(s, "Alt");
    const alt = x.activeId;
    expect(alt).not.toBe(char);
    x = toggle(x, alt, task, "global", t(MON));
    expect(isDone(x, alt, task, "global", t(MON))).toBe(true);
    expect(isDone(x, char, task, "global", t(MON))).toBe(false);
    x = renameCharacter(x, alt, "  Healer ");
    expect(x.characters.find((c) => c.id === alt)?.name).toBe("Healer");
    x = deleteCharacter(x, alt);
    expect(x.characters.map((c) => c.id)).toEqual([char]);
    expect(x.progress[alt]).toBeUndefined();
    expect(x.activeId).toBe(char);
    expect(deleteCharacter(x, char)).toBe(x); // the last one stays
  });

  it("links and unlinks an armory page", () => {
    const { s, char } = withTask("daily");
    const linked = linkArmory(s, char, { region: "nae", serverId: "1101", name: "Luna" });
    expect(linked.characters[0].armory).toEqual({ region: "nae", serverId: "1101", name: "Luna" });
    expect(linkArmory(linked, char, null).characters[0].armory).toBeUndefined();
  });

  it("removing a task removes its ticks for every character", () => {
    const { s, task, char } = withTask("daily");
    const x = removeTask(toggle(s, char, task, "global", t(MON)), task.id);
    expect(x.tasks).toHaveLength(0);
    expect(x.progress[char][task.id]).toBeUndefined();
  });
});

describe("ordering", () => {
  it("moves within a group only and drag-reorders", () => {
    let s = emptyState();
    for (const [g, title] of [["daily", "A"], ["weekly", "W"], ["daily", "B"], ["daily", "C"]] as const) s = addTask(s, { group: g, title }, "global", t(MON));
    const id = (title: string) => s.tasks.find((x) => x.title === title)!.id;
    const order = (x: ChecklistState) => x.tasks.map((y) => y.title).join("");
    s = moveTask(s, id("B"), -1);
    expect(order(s)).toBe("BAWC"); // B takes A's place; the weekly task is untouched
    expect(s.tasks.filter((x) => x.group === "daily").map((x) => x.title)).toEqual(["B", "A", "C"]);
    expect(moveTask(s, id("B"), -1)).toBe(s); // already first
    s = reorder(s, id("C"), id("B"));
    expect(s.tasks.filter((x) => x.group === "daily").map((x) => x.title)).toEqual(["C", "B", "A"]);
    expect(reorder(s, id("W"), id("A"))).toBe(s); // different groups: ignored
  });
});

describe("storage and migration", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("round-trips through localStorage", () => {
    const { s, task, char } = withTask("daily", { target: 2 });
    const x = setCount(s, char, task, 1, t(MON));
    expect(saveState(x)).toBe(true);
    expect(loadState()).toEqual(x);
  });

  it("survives corrupt, blocked and missing storage", () => {
    expect(loadState().tasks).toEqual([]);
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadState().characters).toHaveLength(1);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(saveState(emptyState())).toBe(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadState().characters).toHaveLength(1);
  });

  it("migrates v0 (bare template, no version) to v1 with a default character", () => {
    const m = migrate({ tasks: [{ group: "daily", title: "Quests" }, { group: "weekly", title: "Raid", target: 3, note: "n" }, { group: "bogus", title: "x" }, { title: "no group" }] });
    expect(m.v).toBe(1);
    expect(m.characters).toHaveLength(1);
    expect(m.activeId).toBe(m.characters[0].id);
    expect(m.tasks.map((x) => [x.group, x.title, x.target])).toEqual([["daily", "Quests", 1], ["weekly", "Raid", 3]]);
    expect(m.tasks[0].id).toBeTruthy();
  });

  it("v1 sanitizing: bad characters, orphan ticks, unknown active id, duplicate ids", () => {
    const m = migrate({
      v: 1,
      characters: [{ id: "a", name: "One" }, { id: "a", name: "Dup" }, { id: "b", name: "" }, { id: "c", name: "Two", armory: { region: "nae", serverId: "1", name: "X" } }, "junk"],
      activeId: "gone",
      tasks: [{ id: "t1", group: "daily", title: "A", target: 0 }, { id: "t1", group: "daily", title: "B", target: 2.7 }],
      progress: { a: { t1: { n: 1, at: 5 }, ghost: { n: 1, at: 5 }, bad: { n: "x" } }, nobody: { t1: { n: 1, at: 5 } } },
    });
    expect(m.characters.map((c) => c.name)).toEqual(["One", "Two"]);
    expect(m.characters[1].armory?.name).toBe("X");
    expect(m.activeId).toBe("a");
    expect(m.tasks.map((x) => x.target)).toEqual([1, 2]);
    expect(new Set(m.tasks.map((x) => x.id)).size).toBe(2);
    expect(Object.keys(m.progress)).toEqual(["a"]);
    expect(m.progress.a).toEqual({ t1: { n: 1, at: 5 } });
  });

  it("garbage in gives a fresh state", () => {
    for (const bad of [null, 5, "x", [], undefined]) expect(migrate(bad).tasks).toEqual([]);
    expect(importJson("nope")).toBeNull();
  });

  it("export then import keeps everything", () => {
    const { s, task, char } = withTask("custom", { everyDays: 4 });
    const x = toggle(addCharacter(s, "Alt"), char, task, "global", t(MON));
    expect(importJson(exportJson(x))).toEqual(x);
  });
});

describe("share link", () => {
  it("carries tasks only, with unicode intact, and loads with fresh ids", () => {
    let { s } = withTask("daily", { target: 3 });
    s = addTask(s, { group: "weekly", title: "Raid ★ 英雄", note: "bring pots" }, "global", t(MON));
    s = addTask(s, { group: "custom", title: "Market", everyDays: 5 }, "global", t(MON));
    s = toggle(s, s.activeId, s.tasks[0], "global", t(MON));
    const token = templateToken(s.tasks);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    const url = shareUrl("https://becomecube.com", s.tasks);
    expect(url.startsWith("https://becomecube.com/checklist/#t=")).toBe(true);
    const back = tasksFromToken(token, "global", t("2026-10-20T12:00:00Z"))!;
    expect(back.map((x) => [x.group, x.title, x.target, x.note, x.everyDays])).toEqual([
      ["daily", "Thing", 3, "", undefined],
      ["weekly", "Raid ★ 英雄", 1, "bring pots", undefined],
      ["custom", "Market", 1, "", 5],
    ]);
    expect(back[0].id).not.toBe(s.tasks[0].id);
    expect(back[2].anchorDay).toBeGreaterThan(s.tasks[2].anchorDay!); // custom cycles start from when it was imported
    expect(tasksFromToken("%%%", "global", t(MON))).toBeNull();
  });

  it("applyTemplate replaces (and clears ticks) or appends", () => {
    const { s, task, char } = withTask("daily");
    const ticked = toggle(s, char, task, "global", t(MON));
    const incoming = tasksFromToken(templateToken([{ ...task, title: "Other" }]), "global", t(MON))!;
    const replaced = applyTemplate(ticked, incoming, "replace");
    expect(replaced.tasks.map((x) => x.title)).toEqual(["Other"]);
    expect(replaced.progress).toEqual({});
    expect(applyTemplate(ticked, incoming, "add").tasks.map((x) => x.title)).toEqual(["Thing", "Other"]);
  });
});

describe("armory link parsing", () => {
  it("accepts a path, a full URL or region/server/name", () => {
    const want = { region: "nae", serverId: "1101", name: "Luna" };
    expect(parseArmory("/c/nae/1101/Luna")).toEqual(want);
    expect(parseArmory("https://becomecube.com/c/nae/1101/Luna/")).toEqual(want);
    expect(parseArmory("nae/1101/Luna")).toEqual(want);
    expect(parseArmory("/c/nae/1101/Lu%20na")?.name).toBe("Lu na");
    expect(parseArmory("hello")).toBeNull();
  });
});

describe("presets", () => {
  it("every pack is small, valid and editable after adding", () => {
    for (const p of PACKS) {
      expect(p.tasks.length).toBeGreaterThan(0);
      expect(p.tasks.length).toBeLessThan(15);
      for (const task of p.tasks) {
        expect(task.title.length).toBeGreaterThan(2);
        expect(["daily", "weekly", "custom"]).toContain(task.group);
        if (task.group === "custom") expect(task.everyDays).toBeGreaterThan(0);
      }
    }
    expect(new Set(PACKS.map((p) => p.id)).size).toBe(PACKS.length);
  });

  it("adding a pack twice does not duplicate, and custom tasks get an anchor", () => {
    const pack = PACKS.find((p) => p.tasks.some((x) => x.group === "custom"))!;
    const once = addPack(emptyState(), pack, "global", t(MON));
    const twice = addPack(once, pack, "global", t(MON));
    expect(twice.tasks).toHaveLength(pack.tasks.length);
    expect(once.tasks.find((x) => x.group === "custom")?.anchorDay).toBeTypeOf("number");
  });
});
