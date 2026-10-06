import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { IconFrame, rarityOf } from "@/components/game/IconFrame";
import { OrnateCard } from "@/components/game/OrnateCard";
import { cn } from "@/lib/utils";
import { FilterBar } from "./FilterBar";
import { ItemTable } from "./ItemTable";
import {
  COLUMN,
  DEFAULT_COLUMNS,
  GEAR_KEYS,
  INDEX,
  MAX_PINS,
  NO_FILTERS,
  STAT_COLUMNS,
  compare,
  filterRows,
  iconUrl,
  parsePins,
  sortRows,
  togglePin,
  type Filters,
  type ItemRow,
  type Sort,
} from "./logic";
import { useRows } from "./useRows";
import "./items.css";

const COMPARE_COLUMNS = ["grade", "cat", "class", ...STAT_COLUMNS.map((c) => c.key)].map((k) => COLUMN[k]);

export function ComparePanel({ rows, onUnpin }: { rows: ItemRow[]; onUnpin: (id: number) => void }) {
  const lines = compare(rows, COMPARE_COLUMNS);
  return (
    <OrnateCard className="p-3">
      <h2 className="font-display text-lg font-semibold">Compare ({rows.length} of {MAX_PINS})</h2>
      <div className="mt-2 overflow-x-auto rounded-md border border-border-soft">
        <table className="item-table w-full text-left text-sm">
          <thead>
            <tr>
              <th scope="col" className="px-2 py-1.5 text-xs uppercase tracking-wider text-faint">Stat</th>
              {rows.map((r) => (
                <th key={r.id} scope="col" className="min-w-[9rem] px-2 py-1.5 align-top">
                  <div className="flex items-start gap-2">
                    <IconFrame url={iconUrl(r.i)} fallbackUrl={iconUrl(r.i2)} name={r.n} size={32} rarity={rarityOf(r.g)} alt="" />
                    <Link to={`/items/${r.id}`} className="grade-text whitespace-normal text-sm font-medium" data-rarity={rarityOf(r.g)}>
                      {r.n}
                    </Link>
                    <button type="button" aria-label={`Unpin ${r.n}`} onClick={() => onUnpin(r.id)} className="ml-auto text-faint hover:text-gold">
                      <X size={14} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.col.key} className="border-t border-border-soft">
                <th scope="row" className="px-2 py-1 text-left text-sm font-normal text-dim" title={l.col.title}>{l.col.label}</th>
                {rows.map((r, i) => (
                  <td key={r.id} className={cn("px-2 py-1 tabular-nums", l.best.includes(i) && "is-best")} data-best={l.best.includes(i) || undefined}>
                    {l.col.fmt?.(r) || <span className="text-faint">-</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-dim">Green marks the highest value in a row. Damage boost, crit damage, speed and hit rate columns are the best a random line can roll, not a guaranteed stat.</p>
    </OrnateCard>
  );
}

/** /gear-viewer: every piece of equipment in one table, with chosen stat columns, and up to four pinned items side by side. */
export function GearViewer() {
  const [params, setParams] = useSearchParams();
  const pins = parsePins(params.get("pin"));
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<Sort>({ key: "il", dir: "desc" });
  const [cols, setCols] = useState<string[]>(DEFAULT_COLUMNS);
  const [type, setType] = useState("");
  const { rows, error } = useRows(GEAR_KEYS);

  const setPins = (next: number[]) => setParams(next.length ? { pin: next.join(",") } : {}, { replace: true });
  const cats = type.startsWith("g:") ? INDEX.groups.find((g) => g.key === type.slice(2))?.cats.map((c) => c.key) : type ? [type] : undefined;
  const shown = useMemo(() => (rows ? sortRows(filterRows(rows, { ...filters, cats }), sort) : []), [rows, filters, cats?.join(","), sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const pinned = useMemo(() => (rows ? pins.flatMap((id) => rows.find((r) => r.id === id) ?? []) : []), [rows, pins.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const columns = ["grade", "cat", "class", ...STAT_COLUMNS.map((c) => c.key).filter((k) => cols.includes(k))];

  return (
    <>
      <PageHeader title="Gear viewer" caption="Every piece of equipment in one table. Pick the stat columns, filter, sort, and pin up to four items to compare them side by side.">
        <Link to="/items" className="game-tab px-3 py-1.5 text-sm no-underline">
          Item database
        </Link>
      </PageHeader>
      {error ? (
        <p role="alert" className="text-sm text-warn">Could not load items: {error}</p>
      ) : (
        <div className="space-y-4">
          {pinned.length > 0 && <ComparePanel rows={pinned} onUnpin={(id) => setPins(togglePin(pins, id))} />}
          <OrnateCard className="space-y-3 p-3">
            <FilterBar value={filters} onChange={setFilters} />
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              <label className="text-xs text-faint">
                Type
                <select value={type} onChange={(e) => setType(e.target.value)} className="game-input mt-1 block h-9 px-2 text-sm text-foreground">
                  <option value="">All equipment</option>
                  {INDEX.groups.filter((g) => g.kind === "gear").map((g) => (
                    <optgroup key={g.key} label={g.label}>
                      <option value={`g:${g.key}`}>All {g.label.toLowerCase()}</option>
                      {g.cats.map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <div role="group" aria-label="Stat columns" className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-faint">Columns</span>
                {STAT_COLUMNS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={cols.includes(c.key)}
                    title={c.title}
                    className="game-tab px-2.5 py-1 text-xs"
                    onClick={() => setCols(cols.includes(c.key) ? cols.filter((k) => k !== c.key) : [...cols, c.key])}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            {!rows ? (
              <p className="text-sm text-dim">Loading equipment...</p>
            ) : (
              <ItemTable key={JSON.stringify([filters, type])} rows={shown} columns={columns} sort={sort} onSort={setSort} pins={pins} onPin={(id) => setPins(togglePin(pins, id))} caption="All equipment" />
            )}
          </OrnateCard>
        </div>
      )}
    </>
  );
}
