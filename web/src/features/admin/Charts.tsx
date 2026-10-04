import type { AdminStats } from "@/lib/analytics";

type Day = AdminStats["visits_per_day"][number];

/** 30 daily bars: faint = page views, gold = unique visitors (drawn in front). Plain SVG, no chart library. */
export function VisitsChart({ days }: { days: Day[] }) {
  const W = 720;
  const H = 220;
  const pad = { l: 34, r: 8, t: 10, b: 26 };
  const max = Math.max(1, ...days.map((d) => d.page_views));
  const top = Math.max(4, Math.ceil(max / 4) * 4); // multiple of 4 so the four grid steps are integers
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const step = iw / Math.max(1, days.length);
  const bw = step * 0.7;
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const labelAt = new Set([0, Math.floor((days.length - 1) / 2), days.length - 1]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Page views and unique visitors per day, last 30 days" className="h-auto w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border-soft)" strokeWidth={1} />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-faint)">
            {t}
          </text>
        </g>
      ))}
      {days.map((d, i) => {
        const x = pad.l + i * step + (step - bw) / 2;
        return (
          <g key={d.day}>
            <title>{`${d.day}: ${d.page_views} page views, ${d.unique_visitors} visitors`}</title>
            <rect x={x} y={y(d.page_views)} width={bw} height={Math.max(0, pad.t + ih - y(d.page_views))} fill="var(--cyan)" opacity={0.35} />
            <rect
              x={x + bw * 0.2}
              y={y(d.unique_visitors)}
              width={bw * 0.6}
              height={Math.max(0, pad.t + ih - y(d.unique_visitors))}
              fill="var(--gold)"
            />
            {labelAt.has(i) && (
              <text x={x + bw / 2} y={H - 8} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} fontSize={11} fill="var(--text-faint)">
                {d.day.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
