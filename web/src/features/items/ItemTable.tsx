import { useState } from "react";
import { Link } from "react-router-dom";
import { Pin } from "lucide-react";
import { IconFrame, rarityOf } from "@/components/game/IconFrame";
import { cn } from "@/lib/utils";
import { COLUMN, MAX_PINS, iconUrl, nextSort, type ItemRow, type Sort } from "./logic";
import "./items.css";

export function GradeText({ grade, className }: { grade: string; className?: string }) {
  return (
    <span className={cn("grade-text", className)} data-rarity={rarityOf(grade)}>
      {grade}
    </span>
  );
}

const PAGE = 100;

interface Props {
  rows: ItemRow[];
  /** column keys after the item name, in order */
  columns: string[];
  sort: Sort;
  onSort: (s: Sort) => void;
  /** pinning is offered when onPin is given */
  pins?: number[];
  onPin?: (id: number) => void;
  caption: string;
}

/** Sortable item table. It scrolls sideways inside its own card (phones); rows are shown 100 at a time. */
export function ItemTable({ rows, columns, sort, onSort, pins = [], onPin, caption }: Props) {
  const [shown, setShown] = useState(PAGE);
  const cols = columns.map((k) => COLUMN[k]).filter(Boolean);
  const full = pins.length >= MAX_PINS;
  return (
    <div>
      <div className="max-h-[70vh] overflow-auto rounded-md border border-border-soft">
        <table className="item-table w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="text-xs uppercase tracking-wider text-faint">
            <tr>
              {onPin && <th scope="col" className="w-8 px-2 py-1.5"><span className="sr-only">Pin</span></th>}
              {[COLUMN.name, ...cols].map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  title={c.title}
                  aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn("px-2 py-1.5", !c.text && "text-right")}
                >
                  <button type="button" onClick={() => onSort(nextSort(sort, c.key))} className="uppercase tracking-wider hover:text-gold">
                    {c.label}
                    {sort.key === c.key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((r) => {
              const pinned = pins.includes(r.id);
              return (
                <tr key={r.id} className="border-t border-border-soft">
                  {onPin && (
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        aria-pressed={pinned}
                        aria-label={`${pinned ? "Unpin" : "Pin"} ${r.n}`}
                        disabled={!pinned && full}
                        title={!pinned && full ? `Unpin one first (max ${MAX_PINS})` : pinned ? "Unpin" : "Pin to compare"}
                        onClick={() => onPin(r.id)}
                        className={cn("rounded p-1 hover:text-gold disabled:opacity-30", pinned ? "text-gold" : "text-faint")}
                      >
                        <Pin size={14} className={pinned ? "fill-current" : ""} />
                      </button>
                    </td>
                  )}
                  <td className="px-2 py-1">
                    <Link to={`/items/${r.id}`} className="flex items-center gap-2 no-underline hover:underline">
                      <IconFrame url={iconUrl(r.i)} fallbackUrl={iconUrl(r.i2)} name={r.n} size={28} rarity={rarityOf(r.g)} alt="" />
                      <span className="grade-text font-medium" data-rarity={rarityOf(r.g)}>{r.n}</span>
                    </Link>
                  </td>
                  {cols.map((c) => (
                    <td key={c.key} className={cn("px-2 py-1", c.text ? "text-dim" : "text-right tabular-nums")}>
                      {c.key === "grade" ? (
                        <GradeText grade={r.g} />
                      ) : c.key === "desc" ? (
                        <span className="block max-w-[26rem] truncate" title={r.d}>{r.d}</span>
                      ) : (
                        (c.fmt?.(r) ?? "") || <span className="text-faint">-</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length + 2} className="px-2 py-4 text-dim">No items match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-dim">
        <span>
          Showing {Math.min(shown, rows.length).toLocaleString("en-US")} of {rows.length.toLocaleString("en-US")}
        </span>
        {shown < rows.length && (
          <button type="button" className="game-tab px-2.5 py-1 text-xs" onClick={() => setShown(shown + PAGE)}>
            Show {Math.min(PAGE, rows.length - shown)} more
          </button>
        )}
      </p>
    </div>
  );
}
