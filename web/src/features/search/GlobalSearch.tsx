import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Clock, Search, UserRound, X } from "lucide-react";
import { search as armorySearch } from "@/lib/armory";
import { characterPath, hitToRecent, saveRecent } from "@/features/build/helpers";
import { cn } from "@/lib/utils";
import { GROUP_ORDER, clearRecentQueries, loadIndex, loadRecentQueries, saveRecentQuery, searchEntries, type Entry, type Group } from "./index";

type Row = Entry & { id: string; action?: "characters" | "recent" };

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function RowIcon({ row }: { row: Row }) {
  const [failed, setFailed] = useState(false);
  const Fallback = row.group === "Characters" ? UserRound : row.action === "recent" ? Clock : Search;
  if (row.icon && !failed) {
    return <img src={row.icon} alt="" width={28} height={28} loading="lazy" className="h-7 w-7 shrink-0 rounded object-contain" onError={() => setFailed(true)} />;
  }
  return <Fallback aria-hidden className="h-5 w-5 shrink-0 text-faint" />;
}

/** Header search button plus the Ctrl+K / Cmd+K command palette (client-only: the dialog mounts only after opening). */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const { key: locationKey } = useLocation();

  const show = useCallback(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
    opener.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (!o) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          return !o;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // navigating anywhere (links, back button) closes the palette
  useEffect(() => setOpen(false), [locationKey]);

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label="Search the site"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="game-tab ml-auto flex items-center gap-2 px-3 py-1.5 text-sm font-medium"
      >
        <Search aria-hidden className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-border-soft px-1.5 text-[11px] text-faint md:inline">Ctrl K</kbd>
      </button>
      {open && <Palette onClose={hide} />}
    </>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [recents, setRecents] = useState<string[]>(() => loadRecentQueries());
  const [chars, setChars] = useState<Entry[] | null>(null);
  const [charBusy, setCharBusy] = useState(false);
  const [charMsg, setCharMsg] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const uid = useId();
  const listId = `${uid}-list`;

  useEffect(() => {
    let live = true;
    loadIndex().then(
      (e) => live && setEntries(e),
      () => live && setLoadError(true),
    );
    inputRef.current?.focus();
    return () => {
      live = false;
    };
  }, []);

  const q = query.trim();
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    if (!q) {
      recents.forEach((r, i) => out.push({ id: `${uid}-r${i}`, group: "Pages", label: r, sub: "Recent search", to: "", action: "recent" }));
      return out;
    }
    const found = entries ? searchEntries(entries, q) : [];
    const list: Entry[] = [...found];
    list.push({ group: "Characters", label: `Search characters named "${q}"`, sub: "Look up in the official armory", to: "" });
    if (chars) list.push(...chars);
    const byGroup = GROUP_ORDER.flatMap((g) => list.filter((e) => e.group === g));
    byGroup.forEach((e, i) => out.push({ ...e, id: `${uid}-o${i}`, action: e.group === "Characters" && !e.to ? "characters" : undefined }));
    return out;
  }, [q, entries, chars, recents, uid]);

  useEffect(() => setActive(0), [q, chars]);
  useEffect(() => {
    document.getElementById(rows[active]?.id ?? "")?.scrollIntoView?.({ block: "nearest" });
  }, [active, rows]);

  async function lookupCharacters() {
    if (charBusy || !q) return;
    setCharBusy(true);
    setCharMsg(null);
    try {
      const hits = await armorySearch(q);
      if (hits.length === 1) {
        saveRecent(hitToRecent(hits[0]));
        saveRecentQuery(q);
        nav(characterPath({ region: hits[0].region, serverId: hits[0].serverId ?? 0, name: hits[0].name }));
        return;
      }
      setChars(hits.slice(0, 8).map((h) => ({ group: "Characters" as Group, label: h.name, sub: `${h.serverName ?? ""} · Lv ${h.level ?? "?"}`, to: characterPath({ region: h.region, serverId: h.serverId ?? 0, name: h.name }) })));
      if (hits.length === 0) setCharMsg(`No characters named "${q}" found.`);
    } catch (e) {
      setCharMsg(e instanceof Error ? e.message : "Character lookup failed.");
    } finally {
      setCharBusy(false);
    }
  }

  function choose(row: Row | undefined) {
    if (!row) return;
    if (row.action === "recent") {
      setQuery(row.label);
      inputRef.current?.focus();
      return;
    }
    if (row.action === "characters") {
      void lookupCharacters();
      return;
    }
    saveRecentQuery(q);
    nav(row.to);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rows.length) setActive((a) => (a + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rows.length) setActive((a) => (a - 1 + rows.length) % rows.length);
    } else if (e.key === "Home" && rows.length && !query) {
      setActive(0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(rows[active]);
    }
  }

  // Escape closes; Tab is trapped inside the dialog
  function onDialogKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "Tab") {
      const f = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!dialogRef.current?.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  const groups: { name: string; rows: Row[] }[] = [];
  for (const r of rows) {
    const name = r.action === "recent" ? "Recent searches" : r.group;
    const g = groups.find((x) => x.name === name);
    if (g) g.rows.push(r);
    else groups.push({ name, rows: [r] });
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-3 pt-[10vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search Become Cube"
        onKeyDown={onDialogKey}
        className="flex max-h-[75vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-[var(--metal)] bg-bg shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border-soft px-3">
          <Search aria-hidden className="h-4 w-4 shrink-0 text-faint" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={rows[active]?.id}
            aria-label="Search pages, classes, skills, items, Daevanion and characters"
            placeholder="Search skills, items, classes, characters..."
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setChars(null);
              setCharMsg(null);
            }}
            onKeyDown={onInputKey}
            className="h-12 min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-faint"
          />
          <button type="button" onClick={onClose} aria-label="Close search" className="rounded p-1.5 text-dim hover:text-text">
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
        <ul ref={listRef} id={listId} role="listbox" aria-label="Search results" className="min-h-0 flex-1 overflow-y-auto py-1">
          {groups.map((g) => (
            <li key={g.name} role="presentation">
              <ul role="group" aria-labelledby={`${uid}-g-${g.name}`}>
                <li role="presentation" id={`${uid}-g-${g.name}`} className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
                  {g.name}
                </li>
                {g.rows.map((r) => (
                  <li
                    key={r.id}
                    id={r.id}
                    role="option"
                    aria-selected={rows[active]?.id === r.id}
                    onMouseMove={() => setActive(rows.indexOf(r))}
                    onClick={() => choose(r)}
                    className={cn("flex cursor-pointer items-center gap-3 px-3 py-1.5", rows[active]?.id === r.id && "bg-[color-mix(in_srgb,var(--metal)_25%,transparent)]")}
                  >
                    <RowIcon row={r} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text">{r.label}</span>
                      {r.sub && <span className="block truncate text-xs text-dim">{r.sub}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <div role="status" aria-live="polite" className="border-t border-border-soft px-3 py-2 text-xs text-dim">
          {loadError
            ? "Search index failed to load. Reload the page to retry."
            : charBusy
              ? "Searching the armory..."
              : charMsg
                ? charMsg
                : !q
                  ? recents.length
                    ? <>Type to search. <button type="button" className="underline" onClick={() => { clearRecentQueries(); setRecents([]); }}>Clear recent</button></>
                    : "Type to search skills, items, classes, Daevanion and characters."
                  : !entries
                    ? "Loading index..."
                    : `${rows.length} result${rows.length === 1 ? "" : "s"}. Up/Down to move, Enter to open, Esc to close.`}
        </div>
      </div>
    </div>,
    document.body,
  );
}
