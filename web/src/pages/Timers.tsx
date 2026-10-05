import { PageHeader } from "@/components/PageHeader";
import { EVENTS, EVENT_ORDER, REGIONS, type EventId } from "@/features/timers/data";
import { RegionTabs } from "@/features/timers/RegionTabs";
import { currentOccurrence, describeRule, formatCountdown, nextOccurrences, riftEntryOpen } from "@/features/timers/schedule";
import { formatLocal, formatRegionClock, useNow, useRegion, viewerZone } from "@/features/timers/useTimers";
import { cn } from "@/lib/utils";

function EventCard({ id, now }: { id: EventId; now: number | null }) {
  const [region] = useRegion();
  const ev = EVENTS[id];
  const info = REGIONS[region];
  const upcoming = now === null ? [] : nextOccurrences(id, region, now, 5);
  const running = now === null ? null : currentOccurrence(id, region, now);
  const portal = id === "rift" && now !== null && riftEntryOpen(region, now);
  const next = upcoming.find((o) => now !== null && o.start > now);

  let status = "--";
  if (now !== null) {
    if (portal) status = `Portal closes in ${formatCountdown(running!.entryEnd! - now)}`;
    else if (running) status = `Ends in ${formatCountdown(running.end - now)}`;
    else if (next) status = `In ${formatCountdown(next.start - now)}`;
  }

  return (
    <li className="ornate p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-lg font-semibold">{ev.name}</h2>
        <span className={cn("text-sm font-semibold tabular-nums", running ? "text-ok" : "text-gold")}>{status}</span>
      </div>
      <p className="mt-1 text-sm">{ev.description}</p>
      <p className="mt-1 text-xs text-dim">
        {describeRule(id, region)} ({info.tz} clock)
      </p>
      <ul className="mt-3 space-y-1 text-sm">
        {now === null ? (
          <li className="text-dim">Loading times...</li>
        ) : (
          upcoming.map((o) => (
            <li key={o.start} className="flex flex-wrap justify-between gap-x-3">
              <span className="tabular-nums">{formatLocal(o.start)}</span>
              <span className="text-xs text-dim tabular-nums">
                {formatRegionClock(o.start, info.tz)} {region === "global" ? "UTC" : info.label}
                {o.start <= now && o.end > now ? " (running)" : ""}
              </span>
            </li>
          ))
        )}
      </ul>
    </li>
  );
}

/** Full event schedule for the chosen region, with times in the viewer's own time zone. */
export function TimersPage() {
  const now = useNow();
  return (
    <>
      <PageHeader title="Timers" caption="Live countdowns for Aion 2 events, shown in your local time." />
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <RegionTabs />
        <span className="text-xs text-dim">Your time zone: {now === null ? "--" : viewerZone()}</span>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {EVENT_ORDER.map((id) => (
          <EventCard key={id} id={id} now={now} />
        ))}
      </ul>
      <p className="mt-6 text-xs text-dim">
        These schedules come from the community and have not been verified in game, so a time may be off. KR and TW share one schedule on their own clocks. Not affiliated with NCSOFT.
      </p>
    </>
  );
}
