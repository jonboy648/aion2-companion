import { useState } from "react";
import { Check, Copy, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/features/keybinds/SetupSheet";
import type { RecipeMaterial } from "@/lib/types";
import { cn } from "@/lib/utils";
import { shoppingText } from "./useCrafting";

export function ShoppingList({
  items,
  checked,
  busy,
  expand,
  recipeCount,
  onToggle,
  onExpand,
  onClearChecked,
  onClearAll,
}: {
  items: RecipeMaterial[];
  checked: ReadonlySet<string>;
  busy: boolean;
  expand: boolean;
  recipeCount: number;
  onToggle: (item: string) => void;
  onExpand: (v: boolean) => void;
  onClearChecked: () => void;
  onClearAll: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const done = items.filter((m) => checked.has(m.item)).length;
  const pct = items.length ? (done / items.length) * 100 : 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Material detail" className="inline-flex rounded-md border border-border p-0.5 text-xs">
          {[
            [true, "Raw materials"],
            [false, "Direct materials"],
          ].map(([v, label]) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={expand === v}
              onClick={() => onExpand(v as boolean)}
              className={cn("rounded px-2.5 py-1 transition-colors", expand === v ? "bg-surface3 text-gold" : "text-dim hover:text-foreground")}
            >
              {label as string}
            </button>
          ))}
        </div>
        {busy && <Loader2 aria-label="Updating" className="size-4 animate-spin text-cyan" />}
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium">Your list is empty.</p>
          <p className="mt-1 text-xs text-dim">Use + on a recipe to add it. Materials are added up here, and your ticks are saved in this browser.</p>
        </div>
      ) : (
        <>
          <div className="mt-3">
            <div className="flex items-baseline justify-between text-xs text-dim">
              <span>
                {recipeCount} recipe{recipeCount === 1 ? "" : "s"}, {items.length} materials
              </span>
              <span className="tabular-nums text-foreground">
                {done}/{items.length} gathered
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={items.length}
              aria-valuenow={done}
              aria-label="Materials gathered"
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface3"
            >
              <div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <ul className="mt-3 divide-y divide-border-soft rounded-lg border border-border-soft">
            {items.map((m) => {
              const on = checked.has(m.item);
              return (
                <li key={m.item}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface2/60">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => onToggle(m.item)}
                      className="size-4 shrink-0 accent-[var(--gold)]"
                    />
                    <span className={cn("min-w-0 flex-1 truncate", on && "text-faint line-through")}>{m.item}</span>
                    {m.source && <span className="hidden text-xs text-faint sm:inline">{m.source}</span>}
                    <span className={cn("tabular-nums font-semibold", on ? "text-faint" : "text-gold")}>{m.qty}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                setCopied(await copyText(shoppingText(items, checked)));
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy list"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClearChecked} disabled={done === 0}>
              Untick all
            </Button>
            <Button variant="ghost" size="sm" onClick={onClearAll} className="ml-auto text-error hover:text-error">
              <Trash2 /> Clear list
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
