import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Lock, Sparkles, Star } from "lucide-react";
import { OrnateCard } from "@/components/game/OrnateCard";
import { PageHeader } from "@/components/PageHeader";
import {
  LOAD_LABEL, LOAD_THRESHOLDS, STATUS_REGIONS, TAG_CREATION_BLOCKED, TAG_NEW, TAG_RECOMMENDED, ageText, chartRows, fetchStatus, loadLevel, pairServers, peak, summarize,
  type HistoryRange, type LoadLevel, type ServerPair, type StatusRegion, type StatusResponse, type StatusServer,
} from "@/lib/serverStatus";
import { cn } from "@/lib/utils";

const RegionChart = lazy(() => import("@/features/serverStatus/RegionChart"));

const REFRESH_MS = 60_000;
const ELYOS_COLOR = "#6fc3ff";
const ASMODIAN_COLOR = "#b583f0";
const LEVEL_CLASS: Record<LoadLevel, string> = { good: "text-ok", busy: "text-warn", full: "text-error", offline: "text-dim" };
const n = (v: number) => v.toLocaleString("en-US");

class ChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p className="text-xs text-dim">The chart could not load. The numbers above are unaffected.</p> : this.props.children;
  }
}

function Tags({ tags }: { tags: number }) {
  const items = [
    { bit: TAG_NEW, label: "New server", Icon: Sparkles, cls: "text-cyan" },
    { bit: TAG_RECOMMENDED, label: "Recommended", Icon: Star, cls: "text-gold" },
    { bit: TAG_CREATION_BLOCKED, label: "Character creation locked", Icon: Lock, cls: "text-error" },
  ].filter((i) => (tags & i.bit) !== 0);
  return (
    <>
      {items.map(({ label, Icon, cls }) => (
        <span key={label} title={label} role="img" aria-label={label} className={cn("inline-flex", cls)}>
          <Icon size={14} aria-hidden="true" />
        </span>
      ))}
    </>
  );
}

function Half({ s, side }: { s: StatusServer | null; side: "elyos" | "asmodian" }) {
  if (!s) return <span className="text-dim">-</span>;
  const level = loadLevel(s.players, s.capacity);
  return (
    <div className={cn("flex flex-col gap-0.5", side === "asmodian" && "items-end text-right")}>
      <span className={cn("flex items-center gap-1.5 font-medium", side === "asmodian" && "flex-row-reverse")}>
        <span style={{ color: side === "elyos" ? ELYOS_COLOR : ASMODIAN_COLOR }}>{s.name}</span>
        <Tags tags={s.tags} />
      </span>
      <span className={cn("text-xs font-semibold", LEVEL_CLASS[level])}>{LOAD_LABEL[level]}</span>
      {s.players !== null && <span className="text-xs tabular-nums text-dim">{n(s.players)} players</span>}
    </div>
  );
}

function SplitBar({ pair }: { pair: ServerPair }) {
  const e = pair.elyos?.players ?? null;
  const a = pair.asmodian?.players ?? null;
  const total = (e ?? 0) + (a ?? 0);
  if (e === null || a === null || total <= 0) return <div className="h-2 rounded-full bg-surface3" aria-hidden="true" />;
  const ep = Math.round((e / total) * 100);
  return (
    <div title={`Elyos ${ep}% / Asmodian ${100 - ep}%`} className="flex h-2 overflow-hidden rounded-full bg-surface3" role="img" aria-label={`Elyos ${ep} percent, Asmodian ${100 - ep} percent`}>
      <div style={{ width: `${ep}%`, background: ELYOS_COLOR }} />
      <div style={{ width: `${100 - ep}%`, background: ASMODIAN_COLOR }} />
    </div>
  );
}

function RegionTable({ code, label, pairs, total }: { code: StatusRegion; label: string; pairs: ServerPair[]; total: StatusResponse["regions"][number] | undefined }) {
  const stale = total?.stale ?? false;
  return (
    <OrnateCard className="mb-4 p-4" data-testid={`region-${code}`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-lg font-semibold">{label}</h2>
        <span className="text-sm text-dim">
          <span className="font-semibold tabular-nums text-gold">{n(total?.players ?? 0)}</span> players
        </span>
      </div>
      {stale && (
        <p role="note" className="mb-3 rounded border border-warn/50 bg-surface2 px-3 py-1.5 text-xs text-warn">
          Data may be out of date{total?.source_at ? ` (last report ${ageText(Date.now() - total.source_at)})` : ""}. Nobody has reported this region recently.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="text-xs text-dim">
              <th scope="col" className="py-1 pr-3 text-left font-normal">Elyos</th>
              <th scope="col" className="w-32 py-1 text-center font-normal">Split</th>
              <th scope="col" className="py-1 pl-3 text-right font-normal">Asmodian</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => (
              <tr key={p.slot} className="border-t border-border/60 align-middle">
                <td className="py-2 pr-3"><Half s={p.elyos} side="elyos" /></td>
                <td className="px-1"><SplitBar pair={p} /></td>
                <td className="py-2 pl-3"><Half s={p.asmodian} side="asmodian" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OrnateCard>
  );
}

function Stat({ title, value, sub, children }: { title: string; value: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <OrnateCard className="min-w-0 p-4" size="sm">
      <h2 className="text-xs uppercase tracking-wide text-dim">{title}</h2>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-dim">{sub}</p>}
      {children}
    </OrnateCard>
  );
}

export function StatusView({ data, now }: { data: StatusResponse; now: number | null }) {
  const [range, setRange] = useState<HistoryRange>("24h");
  const [tab, setTab] = useState<StatusRegion | "all">("all");
  const sum = useMemo(() => summarize(data.servers), [data.servers]);
  const pairs = useMemo(() => pairServers(data.servers), [data.servers]);
  const peak24 = useMemo(() => peak(data.history["24h"]), [data.history]);
  const rows = useMemo(() => chartRows(data.history[range]), [data.history, range]);
  const hasHistory = rows.some((r) => STATUS_REGIONS.some((g) => typeof r[g.code] === "number"));
  const shownRegions = STATUS_REGIONS.filter((r) => tab === "all" || tab === r.code);
  const count = (code: StatusRegion) => data.servers.filter((s) => s.region === code).length;
  const balance = sum.elyosPct === null || sum.asmodianPct === null ? null : { e: Math.round(sum.elyosPct), a: 100 - Math.round(sum.elyosPct) };
  const updated = data.last_ok_at ?? data.generated_at;
  const failing = data.last_error_at !== null && data.last_error_at > (data.last_ok_at ?? 0);

  return (
    <>
      <p className="mb-4 -mt-3 text-xs text-dim" aria-live="off">
        Updated {now === null ? "--" : ageText(now - updated)}
        {failing && <span className="text-warn"> · the data source is not responding, showing the last good data</span>}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat title="Players Online" value={n(sum.players)} sub={peak24 === null ? "24h peak: no data yet" : `24h peak ${n(peak24)}`} />
        <Stat title="Faction Balance" value={balance ? `${balance.e}% / ${balance.a}%` : "--"} sub="Elyos / Asmodian">
          <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface3" role="img" aria-label={balance ? `Elyos ${balance.e} percent, Asmodian ${balance.a} percent` : "No faction data"}>
            {balance && (
              <>
                <div style={{ width: `${balance.e}%`, background: ELYOS_COLOR }} />
                <div style={{ width: `${balance.a}%`, background: ASMODIAN_COLOR }} />
              </>
            )}
          </div>
        </Stat>
        <Stat title="Servers Online" value={`${sum.serversOnline} / ${sum.serversTotal}`} sub={`${sum.fullServers} full server${sum.fullServers === 1 ? "" : "s"}`} />
        <Stat title="Creation Locked" value={`${sum.creationLocked} of ${sum.serversTotal}`} sub="servers closed to new characters" />
      </div>
      {sum.staleRegions.length > 0 && (
        <p role="note" className="mb-4 text-xs text-warn">
          Counts for {sum.staleRegions.map((c) => STATUS_REGIONS.find((r) => r.code === c)!.label).join(", ")} may be out of date and are included in the totals.
        </p>
      )}

      <OrnateCard className="mb-4 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Players by Region</h2>
          <div role="group" aria-label="Chart range" className="flex gap-1">
            {(["24h", "7d", "30d"] as const).map((r) => (
              <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)} className="game-tab px-2.5 py-1 text-xs">
                {r}
              </button>
            ))}
          </div>
        </div>
        {hasHistory ? (
          <>
            <ChartBoundary>
              <Suspense fallback={<p className="text-xs text-dim">Loading chart...</p>}>
                <RegionChart rows={rows} range={range} />
              </Suspense>
            </ChartBoundary>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dim" aria-label="Chart legend">
              {STATUS_REGIONS.map((r) => (
                <li key={r.code}>{r.label}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-dim">No history for this range yet. The chart fills in as the site collects counts every 5 minutes.</p>
        )}
      </OrnateCard>

      <div role="group" aria-label="Region" className="mb-4 flex flex-wrap items-center gap-1.5">
        <button type="button" aria-pressed={tab === "all"} onClick={() => setTab("all")} className="game-tab px-2.5 py-1 text-xs">
          All ({data.servers.length})
        </button>
        {STATUS_REGIONS.map((r) => (
          <button key={r.code} type="button" aria-pressed={tab === r.code} onClick={() => setTab(r.code)} className="game-tab px-2.5 py-1 text-xs">
            {r.label} ({count(r.code)})
          </button>
        ))}
      </div>

      {shownRegions.map((r) => (
        <RegionTable key={r.code} code={r.code} label={r.label} pairs={pairs.filter((p) => p.region === r.code)} total={data.regions.find((t) => t.region === r.code)} />
      ))}

      <p className="mt-6 text-xs text-dim">
        Load is our own estimate from players / capacity: Good below {Math.round(LOAD_THRESHOLDS.busy * 100)}%, Busy {Math.round(LOAD_THRESHOLDS.busy * 100)}-{Math.round(LOAD_THRESHOLDS.full * 100)}%, Full {Math.round(LOAD_THRESHOLDS.full * 100)}% and up. NCSOFT publishes no queue or population numbers, so counts come from a community tracker and can lag. Not affiliated with NCSOFT.
      </p>
    </>
  );
}

/** Live population, faction balance and load for every Aion 2 Global server. Refreshes itself every minute. */
export function ServerStatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    const load = () =>
      fetchStatus(ctl.signal).then(
        (d) => {
          setData(d);
          setError(null);
        },
        (e) => {
          if (!ctl.signal.aborted) setError(e instanceof Error ? e.message : String(e));
        },
      );
    load();
    const poll = setInterval(load, REFRESH_MS);
    return () => {
      ctl.abort();
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <PageHeader title="Aion 2 Server Status" caption="Population data via dbaion2.ru; server names from NCSOFT." />
      {data === null ? (
        error ? (
          <p role="alert" className="text-sm text-dim">{error}</p>
        ) : (
          <p className="text-sm text-dim">Loading server status...</p>
        )
      ) : data.servers.length === 0 ? (
        <p className="text-sm text-dim">No server data yet. Counts appear once the tracker has reported; check back in a few minutes.</p>
      ) : (
        <>
          {error && <p role="alert" className="mb-3 text-xs text-warn">{error} Showing the last data received.</p>}
          <StatusView data={data} now={now} />
        </>
      )}
    </>
  );
}
