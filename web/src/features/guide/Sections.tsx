import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { GEAR_TIERS, SOURCES, SYSTEMS, WEEKLY } from "./basics";
import { FactItem } from "./ChapterCard";

export function Systems() {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {SYSTEMS.map((s) => (
        <li key={s.id} id={`system-${s.id}`} className="scroll-mt-36 sm:scroll-mt-24 ornate p-4">
          <h3 className="text-base font-semibold text-gold">{s.title}</h3>
          <p className="mt-1 text-sm">{s.what}</p>
          <p className="mt-2 rounded-md border border-gold-lo/40 bg-gold/5 px-2.5 py-1.5 text-sm">
            <strong className="font-semibold text-gold">Why it matters: </strong>
            <span className="text-dim">{s.why}</span>
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {s.facts.map((f) => (
              <FactItem key={f.text} f={f} />
            ))}
          </ul>
          {s.table && (
            <table className="mt-3 w-full max-w-sm text-left text-xs">
              <caption className="sr-only">{s.title} cost table</caption>
              <thead>
                <tr className="border-b border-border text-faint">
                  {s.table.head.map((h) => (
                    <th key={h} scope="col" className="py-1 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.table.rows.map((r) => (
                  <tr key={r[0]} className="border-b border-border-soft">
                    {r.map((c, i) => (
                      <td key={i} className="py-1 pr-3 tabular-nums text-dim">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {s.tool && (
            <Link to={s.tool.to} className="mt-3 inline-flex items-center gap-1 text-sm text-cyan">
              {s.tool.label} <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function EndgameOverview() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="ornate p-4">
        <h3 className="mb-2 text-base font-semibold text-gold">Weekly content</h3>
        <ul className="space-y-1.5 text-sm">
          {WEEKLY.map((w) => (
            <li key={w.what} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-gold-lo" />
              <span>
                <strong className="font-medium">{w.what}:</strong> <span className="text-dim">{w.how}</span>
                {w.check && <span className="ml-1.5 rounded-full border border-warn/40 bg-warn/10 px-1.5 py-px text-[10px] text-warn" title={w.check}>unconfirmed</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="ornate p-4">
        <h3 className="mb-2 text-base font-semibold text-gold">Gear tiers (item level per piece)</h3>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Gear progression by tier</caption>
          <thead>
            <tr className="border-b border-border text-xs text-faint">
              <th scope="col" className="py-1 pr-2 font-medium">Tier</th>
              <th scope="col" className="py-1 pr-2 font-medium">Item level</th>
              <th scope="col" className="py-1 font-medium">Where</th>
            </tr>
          </thead>
          <tbody>
            {GEAR_TIERS.map((g) => (
              <tr key={g.tier} className="border-b border-border-soft align-top">
                <th scope="row" className="py-1 pr-2 text-left font-medium">{g.tier}</th>
                <td className="py-1 pr-2 tabular-nums text-gold">{g.il}</td>
                <td className="py-1 text-xs text-dim">{g.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-gold-lo/60 bg-gold/5 p-4 lg:col-span-2">
        <h3 className="text-base font-semibold text-gold">What does "max power" mean?</h3>
        <p className="mt-1 text-sm text-dim">
          It is not one number. It is your damage (or healing and protection) after you pick the right stats, skill ranks, stigmas, Daevanion nodes and gear for your role. Item level only opens doors; your class's key stats decide how much damage you actually do.
        </p>
        <p className="mt-2 text-sm text-dim">
          This site imports your character from the official armory, compares boss, area, leveling and burst playstyles, and lists the next upgrade with the biggest gain.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/" className="inline-flex h-9 items-center rounded-md bg-gold px-3.5 text-sm font-semibold text-gold-ink no-underline hover:bg-gold-hi">
            Import my character
          </Link>
          <Link to="/build" className="inline-flex h-9 items-center rounded-md border border-border bg-surface2 px-3.5 text-sm text-gold no-underline hover:border-gold">
            Build one by hand
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Sources() {
  return (
    <section aria-labelledby="sources-h" className="ornate p-4 text-sm">
      <h2 id="sources-h" className="text-base font-semibold">
        Sources and what is unconfirmed
      </h2>
      <p className="mt-1 text-xs text-dim">
        Everything here comes from third-party guides and datamines collected on 2026-10-03, before global launch on 2026-10-05 (client 2.0.3.0). None of it is verified in game. Items marked unconfirmed conflict across sources or rest on one source. Official NCSOFT guide pages were unreachable.
      </p>
      <ul className="mt-2 space-y-1 text-xs">
        {SOURCES.map((s) => (
          <li key={s.label} className="text-dim">
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer" className="text-cyan">
                {s.label}
              </a>
            ) : (
              s.label
            )}
            : {s.note}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-faint">
        Not confirmed: Abyss and Arena level gates on global, exact weekly reset hour, Arcana and Soul Binding roll ranges, whether a held macro auto-picks chain follow-ups, and the skill rank ceiling above 10.
      </p>
    </section>
  );
}
