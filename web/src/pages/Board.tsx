import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { ago, fetchBoard, REGION_LABEL, type BoardRow, type BoardSort } from "@/lib/board";

const CLASSES = ["Gladiator", "Templar", "Assassin", "Ranger", "Sorcerer", "Spiritmaster", "Cleric", "Chanter"];
const LIMIT = 50;

type Key = "name" | "class" | "level" | "server" | "power" | "gear" | "dps" | "seen";

interface Col {
  key: Key;
  label: string;
  /** the proxy can order the whole board by this column (the others sort the rows shown) */
  server?: BoardSort;
  right?: boolean;
  value: (r: BoardRow) => string | number | null;
}

const COLS: Col[] = [
  { key: "name", label: "Character", value: (r) => r.name.toLowerCase() },
  { key: "class", label: "Class", value: (r) => r.class_name },
  { key: "level", label: "Lv", right: true, value: (r) => r.level },
  { key: "server", label: "Server", value: (r) => `${REGION_LABEL[r.region] ?? r.region} ${r.server_name}` },
  { key: "power", label: "Combat Power", server: "power", right: true, value: (r) => r.combat_power },
  { key: "gear", label: "Gear Score", server: "gear", right: true, value: (r) => r.item_level },
  { key: "dps", label: "Max DPS (est.)", server: "dps", right: true, value: (r) => r.max_dps },
  { key: "seen", label: "Last seen", server: "recent", right: true, value: (r) => r.last_seen },
];

const num = (n: number | null) => (n == null ? "-" : n.toLocaleString("en-US"));

/** Sort rows by a column; empty values always go last. */
export function sortRows(rows: BoardRow[], col: Col, dir: "asc" | "desc"): BoardRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = col.value(a);
    const y = col.value(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return x < y ? -sign : x > y ? sign : 0;
  });
}

/**
 * The public board as one sortable table. Clicking Combat Power, Gear Score, Max DPS or Last seen asks the proxy for that
 * ordering (so it ranks the whole board, up to 50 rows); Character, Class, Lv and Server sort the rows already shown.
 */
export function Board() {
  const [key, setKey] = useState<Key>("power");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [cls, setCls] = useState("");
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const col = COLS.find((c) => c.key === key)!;
  // columns the proxy cannot order show the top of the Combat Power board, sorted here
  const serverSort: BoardSort = col.server ?? "power";

  useEffect(() => {
    let live = true;
    setRows(null);
    setError(null);
    fetchBoard(serverSort, cls, LIMIT).then(
      (r) => live && setRows(r),
      (e) => live && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      live = false;
    };
  }, [serverSort, cls]);

  const shown = useMemo(() => (rows ? sortRows(rows, col, dir) : null), [rows, col, dir]);

  function clickHeader(c: Col) {
    if (c.key === key) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setKey(c.key);
      setDir(c.key === "name" || c.key === "class" || c.key === "server" ? "asc" : "desc");
    }
  }

  return (
    <>
      <PageHeader title="Board" caption={`Characters looked up on this site, top ${LIMIT}. Click a column to sort. Public armory info only.`} />
      <label className="mb-3 flex items-center gap-2 text-sm text-dim">
        Class
        <select value={cls} onChange={(e) => setCls(e.target.value)} className="rounded border border-border bg-surface px-2 py-1 text-foreground">
          <option value="">All</option>
          {CLASSES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-dim">{error}</p>
      ) : shown === null ? (
        <p className="text-sm text-dim">Loading...</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-dim">Nothing here yet. Characters appear as they are looked up.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-dim">
                <th scope="col" className="w-8 py-2 pr-2 text-right font-normal">#</th>
                {COLS.map((c) => (
                  <th key={c.key} scope="col" aria-sort={c.key === key ? (dir === "asc" ? "ascending" : "descending") : "none"} className={`py-2 pr-3 font-normal ${c.right ? "text-right" : ""}`}>
                    <button type="button" onClick={() => clickHeader(c)} className="hover:text-foreground">
                      {c.label}
                      {c.key === key ? (dir === "asc" ? " ▲" : " ▼") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={`${r.region}/${r.server_id}/${r.name}`} className="border-t border-border/60">
                  <td className="py-2 pr-2 text-right tabular-nums text-dim">{i + 1}</td>
                  <td className="py-2 pr-3">
                    <Link to={`/c/${r.region}/${r.server_id}/${encodeURIComponent(r.name)}`} className="font-medium">
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{r.class_name}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.level ?? "-"}</td>
                  <td className="py-2 pr-3 text-dim">
                    {r.server_name || `server ${r.server_id}`} · {REGION_LABEL[r.region] ?? r.region}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-gold">{num(r.combat_power)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{num(r.item_level)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{num(r.max_dps)}</td>
                  <td className="py-2 text-right tabular-nums text-dim">{ago(r.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-dim">
        Combat Power, Gear Score (item level), level and class come from the official armory. Max DPS is the site's estimate for the boss playstyle with
        obtainable gear, computed in each visitor's browser: it is not verified and is only comparable within a class.
      </p>
    </>
  );
}
