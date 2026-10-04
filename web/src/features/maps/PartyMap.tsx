import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MARKER_KINDS, MAX_LABEL, MAX_MARKERS, decodeMarkers, encodeMarkers, sanitize, type Marker, type MarkerKind } from "./partyMarkers";

const W = 1000;
const H = 650;
const STORE = "aion2.partyMap.v1";
const KINDS = Object.keys(MARKER_KINDS) as MarkerKind[];

function saved(): Marker[] {
  try {
    return sanitize(JSON.parse(localStorage.getItem(STORE) ?? "[]"));
  } catch {
    return [];
  }
}

/**
 * A pan/zoom board where a party drops pins ("?", boss, portal, rally...). It draws our own plain grid, never game art.
 * Pins live in the page and in a share link (?m=...), so friends opening the link see the same board.
 */
export function PartyMap() {
  const [params] = useSearchParams();
  const [markers, setMarkers] = useState<Marker[]>(() => {
    const shared = params.get("m");
    return shared ? decodeMarkers(shared) : saved();
  });
  const [kind, setKind] = useState<MarkerKind>("question");
  const [label, setLabel] = useState("");
  const [view, setView] = useState({ x: 0, y: 0, w: W, h: H });
  const [copied, setCopied] = useState(false);
  const drag = useRef<{ px: number; py: number; moved: boolean } | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(markers));
    } catch {
      /* private mode: the share link still works */
    }
  }, [markers]);

  function toBoard(clientX: number, clientY: number) {
    const r = svg.current!.getBoundingClientRect();
    return { x: view.x + ((clientX - r.left) / r.width) * view.w, y: view.y + ((clientY - r.top) / r.height) * view.h };
  }

  function zoom(factor: number, cx = view.x + view.w / 2, cy = view.y + view.h / 2) {
    setView((v) => {
      const w = Math.min(W, Math.max(W / 8, v.w * factor));
      const h = (w / W) * H;
      return { w, h, x: Math.min(W - w, Math.max(0, cx - ((cx - v.x) / v.w) * w)), y: Math.min(H - h, Math.max(0, cy - ((cy - v.y) / v.h) * h)) };
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { px: e.clientX, py: e.clientY, moved: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const r = svg.current!.getBoundingClientRect();
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    d.px = e.clientX;
    d.py = e.clientY;
    setView((v) => ({ ...v, x: Math.min(W - v.w, Math.max(0, v.x - (dx / r.width) * v.w)), y: Math.min(H - v.h, Math.max(0, v.y - (dy / r.height) * v.h)) }));
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved || markers.length >= MAX_MARKERS) return;
    const p = toBoard(e.clientX, e.clientY);
    setMarkers((m) => [...m, { id: `${Date.now().toString(36)}${m.length}`, kind, x: p.x / W, y: p.y / H, label: label.trim() }]);
  }

  async function copyLink() {
    const url = `${window.location.origin}/maps/?m=${encodeMarkers(markers)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  const grid: number[] = Array.from({ length: 9 }, (_, i) => i + 1);
  const scale = view.w / W;

  return (
    <section aria-label="Party map" className="mb-8">
      <h2 className="font-display text-lg font-semibold">Party map</h2>
      <p className="mb-3 text-sm text-dim">
        A plain board for your party: pick a pin, click the board to drop it, drag to pan, zoom with the buttons or wheel. Share the link and friends see your pins.
        It is our own grid, not the game's map, so mark spots from your own screen.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`rounded border px-2 py-1 ${kind === k ? "border-gold text-gold" : "border-border text-dim hover:text-foreground"}`}
          >
            <span aria-hidden className="mr-1 font-bold">{MARKER_KINDS[k].glyph}</span>
            {MARKER_KINDS[k].label}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2 text-dim">
          Label for the next pin
          <input
            value={label}
            maxLength={MAX_LABEL}
            onChange={(e) => setLabel(e.target.value)}
            className="rounded border border-border bg-surface px-2 py-1 text-foreground"
            placeholder="optional"
          />
        </label>
        <button type="button" onClick={() => zoom(0.7)} aria-label="Zoom in" className="rounded border border-border px-2 py-1">+</button>
        <button type="button" onClick={() => zoom(1 / 0.7)} aria-label="Zoom out" className="rounded border border-border px-2 py-1">-</button>
        <button type="button" onClick={() => setView({ x: 0, y: 0, w: W, h: H })} className="rounded border border-border px-2 py-1">Reset view</button>
        <button type="button" onClick={copyLink} className="rounded border border-gold px-2 py-1 text-gold">{copied ? "Link copied" : "Copy share link"}</button>
        <button type="button" onClick={() => setMarkers([])} disabled={!markers.length} className="rounded border border-border px-2 py-1 disabled:opacity-40">Clear all</button>
      </div>
      <svg
        ref={svg}
        role="img"
        aria-label={`Party board with ${markers.length} pins`}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="w-full cursor-crosshair touch-none select-none rounded border border-border bg-surface"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={(e) => {
          const p = toBoard(e.clientX, e.clientY);
          zoom(e.deltaY < 0 ? 0.85 : 1 / 0.85, p.x, p.y);
        }}
      >
        {grid.map((i) => (
          <g key={i} stroke="currentColor" className="text-border" strokeWidth={1 * scale} opacity={0.6}>
            <line x1={(W / 10) * i} y1={0} x2={(W / 10) * i} y2={H} />
            <line x1={0} y1={(H / 10) * i} x2={W} y2={(H / 10) * i} />
          </g>
        ))}
        {markers.map((m) => (
          <g key={m.id} transform={`translate(${m.x * W} ${m.y * H}) scale(${scale})`} data-testid="pin">
            <circle r={13} className="fill-surface stroke-gold" strokeWidth={2} />
            <text textAnchor="middle" dy="0.35em" fontSize={14} fontWeight={700} className="fill-gold">{MARKER_KINDS[m.kind].glyph}</text>
            {m.label && <text x={17} dy="0.35em" fontSize={13} className="fill-foreground">{m.label}</text>}
          </g>
        ))}
      </svg>
      {markers.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2" aria-label="Pins">
          {markers.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 border-t border-border/60 py-1">
              <span>
                <b className="mr-1 text-gold">{MARKER_KINDS[m.kind].glyph}</b>
                {m.label || MARKER_KINDS[m.kind].label}
              </span>
              <button type="button" onClick={() => setMarkers((all) => all.filter((x) => x.id !== m.id))} aria-label={`Remove ${m.label || MARKER_KINDS[m.kind].label}`} className="text-dim hover:text-foreground">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
