import { useState } from "react";
import { ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import { OrnateCard, SectionTitle } from "@/components/game";
import { Badge } from "@/components/ui/badge";
import type { ArmoryRaw, StatCategory, StatRow, StatSheet } from "@/lib/types";
import { armoryNote, filterCategories, fmtSigned, fmtStat, flagCount, groupSources, isFlagged, useStatSheet } from "./logic";

const OPEN_BY_DEFAULT = new Set(["attributes", "attack", "boost", "hits"]);

/** The per-source breakdown shown under a row: one block per origin with its subtotal, then the lines. */
export function SourcePanel({ row, groups }: { row: StatRow; groups: StatSheet["groups"] }) {
  const blocks = groupSources(row, groups);
  const note = armoryNote(row);
  return (
    <div role="region" aria-label={`Sources of ${row.name}`} data-testid={`stat-sources-${row.key}`} className="frame mb-1 mt-1 space-y-2 p-2.5 text-xs">
      {blocks.length === 0 && <p className="text-dim">No source adds to this stat.</p>}
      {blocks.map((b) => (
        <div key={b.group}>
          <p className="flex justify-between gap-3 font-semibold text-gold">
            <span>{b.name}</span>
            <span className="tabular-nums">{fmtSigned(b.total, row.unit)}</span>
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {b.lines.map((s, i) => (
              <li key={`${s.label}-${i}`} className="flex justify-between gap-3 text-dim">
                <span className="min-w-0 truncate" title={s.label}>
                  {s.label}
                </span>
                <span className="shrink-0 tabular-nums">
                  {s.est && <span className="mr-1 text-warn" title="Expected value or gap-fill, not read from the armory">est.</span>}
                  {fmtSigned(s.value, row.unit)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {row.applies_to && row.applies_to.length > 0 && (
        <div className="border-t border-border pt-1.5 text-dim">
          <p className="font-semibold text-cyan">Scales (once, on the all-source total)</p>
          <ul>
            {row.applies_to.map((t) => (
              <li key={t.key} className="flex justify-between gap-3">
                <span>
                  {t.name} {fmtStat(t.base, "")}
                </span>
                <span className="tabular-nums">{fmtSigned(t.add, "")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {row.capped && <p className="text-warn">Held at the game's limit for this stat.</p>}
      {note && <p className={row.armory?.ok ? "text-ok" : "text-warn"}>{note}</p>}
    </div>
  );
}

function Row({ row, groups, shown, onPin, onHover }: { row: StatRow; groups: StatSheet["groups"]; shown: boolean; onPin: () => void; onHover: (on: boolean) => void }) {
  const flagged = isFlagged(row);
  const est = row.sources.length > 0 && row.sources.some((s) => s.est);
  return (
    <li data-testid={`stat-row-${row.key}`} data-flagged={flagged ? "true" : undefined}>
      <button
        type="button"
        aria-expanded={shown}
        onClick={onPin}
        onPointerEnter={(e) => e.pointerType === "mouse" && onHover(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && onHover(false)}
        className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-[13px] hover:bg-surface2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{row.name}</span>
          {flagged && (
            <Badge tone="warn" title={armoryNote(row) ?? ""}>
              <TriangleAlert className="mr-1 size-3" aria-hidden />
              differs from armory
            </Badge>
          )}
          {row.armory?.ok && (
            <Badge tone="ok" title={armoryNote(row) ?? ""}>
              matches armory
            </Badge>
          )}
        </span>
        <span className="shrink-0 tabular-nums">
          {est && <span className="mr-1 text-[11px] text-warn" aria-label="includes estimated sources">~</span>}
          <span className={row.value === 0 ? "text-faint" : "text-text"}>{fmtStat(row.value, row.unit)}</span>
        </span>
      </button>
      {shown && <SourcePanel row={row} groups={groups} />}
    </li>
  );
}

function Category({ cat, groups, open, onToggle, pinned, hover, setPinned, setHover }: {
  cat: StatCategory;
  groups: StatSheet["groups"];
  open: boolean;
  onToggle: () => void;
  pinned: string | null;
  hover: string | null;
  setPinned: (k: string | null) => void;
  setHover: (k: string | null) => void;
}) {
  const flags = flagCount(cat);
  return (
    <section data-testid={`stat-cat-${cat.key}`} className="frame">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center justify-between gap-2 p-2.5 text-left">
        <span className="flex items-center gap-2 font-display text-[15px]">
          {open ? <ChevronDown className="size-4 text-faint" aria-hidden /> : <ChevronRight className="size-4 text-faint" aria-hidden />}
          {cat.name}
        </span>
        <span className="flex items-center gap-1.5">
          {flags > 0 && <Badge tone="warn">{flags} differ</Badge>}
          <Badge>{cat.stats.length}</Badge>
        </span>
      </button>
      {open && (
        <ul className="px-1.5 pb-2">
          {cat.stats.map((r) => (
            <Row
              key={r.key}
              row={r}
              groups={groups}
              shown={pinned === r.key || hover === r.key}
              onPin={() => setPinned(pinned === r.key ? null : r.key)}
              onHover={(on) => setHover(on ? r.key : null)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Headline of the armory comparison: what we can and cannot reproduce. */
export function ArmoryCheck({ sheet }: { sheet: StatSheet }) {
  const s = sheet.armory_check.summary;
  return (
    <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-dim" data-testid="stat-armory-check">
      <Badge tone={s.derived === s.derived_ok ? "ok" : "warn"}>
        Armory lines reproduced: {s.derived_ok}/{s.derived}
      </Badge>
      <Badge tone={s.attributes_nonzero_ok === s.attributes_nonzero ? "ok" : "warn"}>
        Attribute totals matched from public sources: {s.attributes_nonzero_ok}/{s.attributes_nonzero}
      </Badge>
      <span>The armory only prints attributes and deity points; every other value is built from gear, Daevanion, wings and titles.</span>
    </p>
  );
}

interface Props {
  raw: ArmoryRaw | null;
  /** hold the (serial) engine until the page's other work has finished */
  ready?: boolean;
}

/** "Stat sheet" on the Character page: collapsible categories, per-source breakdown on hover or tap, armory mismatches flagged. */
export function StatSheetSection({ raw, ready = true }: Props) {
  const [calibrate, setCalibrate] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pinned, setPinned] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const { data, error, busy } = useStatSheet(raw, calibrate, ready);
  if (!raw) return null;
  const cats = data ? filterCategories(data.categories, query) : [];
  const isOpen = (k: string) => (query.trim() ? true : (open[k] ?? OPEN_BY_DEFAULT.has(k)));
  return (
    <OrnateCard className="mb-6 p-4 sm:p-5" data-testid="stat-sheet">
      <SectionTitle as="h2" caption="Rebuilt from gear, Daevanion, wings and titles, then the game's own attribute and Amp Ratio passes. Hover or tap a stat to see where it comes from.">
        Stat sheet
      </SectionTitle>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a stat..."
          aria-label="Find a stat"
          className="w-full max-w-xs rounded border border-border bg-surface2 px-2.5 py-1.5 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-dim" title="The armory prints the true total of each attribute and deity stat. Off: use only the sources we can read.">
          <input type="checkbox" checked={calibrate} onChange={(e) => setCalibrate(e.target.checked)} />
          Fill hidden sources from the armory totals
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-error">
          Could not build the stat sheet: {error}
        </p>
      )}
      {busy && !data && (
        <p className="text-sm text-dim" role="status">
          Loading the item database and adding up the sources...
        </p>
      )}
      {data && (
        <div className={busy ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={busy}>
          <ArmoryCheck sheet={data} />
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-2 md:grid-cols-[repeat(2,minmax(0,1fr))]">
            {cats.map((c) => (
              <Category
                key={c.key}
                cat={c}
                groups={data.groups}
                open={isOpen(c.key)}
                onToggle={() => setOpen((o) => ({ ...o, [c.key]: !isOpen(c.key) }))}
                pinned={pinned}
                hover={hover}
                setPinned={setPinned}
                setHover={setHover}
              />
            ))}
            {cats.length === 0 && <p className="text-sm text-dim">No stat matches "{query}".</p>}
          </div>
          <details className="mt-4 text-xs text-dim">
            <summary className="cursor-pointer text-cyan">What the armory does not tell us ({data.not_included.length})</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {data.not_included.map((n) => (
                <li key={n}>{n}</li>
              ))}
              {data.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </OrnateCard>
  );
}
