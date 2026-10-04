"use client";

// Ruixen Gradient Footer, supplied by Jon. Gradient inspired by Dia Browser.
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

type Stop = { offset: number; color: string };
const VBW = 1271;
const VBH = 599;
const RUIXEN_STOPS: Stop[] = [
  { offset: 0, color: "#340B05" },
  { offset: 0.1827, color: "#0358F7" },
  { offset: 0.2837, color: "#5092C7" },
  { offset: 0.4135, color: "#E1ECFE" },
  { offset: 0.5866, color: "#FFD400" },
  { offset: 0.6827, color: "#FA3D1D" },
  { offset: 0.8029, color: "#FD02F5" },
  { offset: 1, color: "#FFC0FD00" },
];

function bellHeights(n: number, peak: number, valley: number) {
  const mid = (n - 1) / 2;
  return Array.from({ length: n }, (_, i) => {
    const t = mid === 0 ? 0 : Math.abs(i - mid) / mid;
    return peak * VBH * (valley + (1 - valley) * (1 - Math.pow(t, 1.24)));
  });
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export interface RuixenGradientFooterProps {
  children?: ReactNode;
  gradientHeight?: string;
  minReveal?: number;
  bars?: number;
  blur?: number;
  peak?: number;
  valley?: number;
  stops?: Stop[];
  className?: string;
  style?: CSSProperties;
}

export function RuixenGradientFooter({ children, gradientHeight = "65vh", minReveal = 0.045, bars = 9, blur = 15, peak = 0.98, valley = 0.55, stops = RUIXEN_STOPS, className, style }: RuixenGradientFooterProps) {
  const uid = useId().replace(/:/g, "");
  const bandRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(minReveal);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const el = bandRef.current;
    if (!el) return;
    const doc = el.ownerDocument;
    const win = doc.defaultView ?? window;
    const media = win.matchMedia?.("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const measure = () => {
      frame = 0;
      const h = el.offsetHeight || 1;
      const left = doc.documentElement.scrollHeight - win.innerHeight - win.scrollY;
      setProgress(minReveal + (1 - minReveal) * clamp01((h - left) / h));
    };
    const schedule = () => { if (!frame) frame = win.requestAnimationFrame(measure); };
    const syncMotion = () => { setReduced(media?.matches ?? false); schedule(); };
    syncMotion();
    win.addEventListener("scroll", schedule, { passive: true });
    win.addEventListener("resize", schedule, { passive: true });
    media?.addEventListener("change", syncMotion);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    observer?.observe(doc.body);
    return () => {
      win.cancelAnimationFrame(frame);
      win.removeEventListener("scroll", schedule);
      win.removeEventListener("resize", schedule);
      media?.removeEventListener("change", syncMotion);
      observer?.disconnect();
    };
  }, [minReveal]);

  const colW = VBW / bars;
  return (
    <footer className={className} style={{ position: "relative", paddingBottom: gradientHeight, ...style }}>
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      <div ref={bandRef} className="ruixen-footer-glow" aria-hidden style={{
        position: reduced ? "absolute" : "fixed", left: 0, right: 0, bottom: 0,
        height: gradientHeight, pointerEvents: "none", zIndex: 0,
        transformOrigin: "bottom", transform: reduced ? undefined : `scaleY(${progress})`,
        willChange: reduced ? undefined : "transform",
      }}>
        <svg style={{ height: "100%", width: "100%", display: "block" }} viewBox={`0 0 ${VBW} ${VBH}`} preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={`grad-${uid}`} x1="0" y1="1" x2="0" y2="0">
              {stops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} />)}
            </linearGradient>
            <filter id={`blur-${uid}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={blur} /></filter>
          </defs>
          {bellHeights(bars, peak, valley).map((barH, i) => <g key={i} filter={`url(#blur-${uid})`}><rect x={i * colW} y={VBH - barH} width={colW * 1.23} height={barH} fill={`url(#grad-${uid})`} /></g>)}
        </svg>
      </div>
    </footer>
  );
}
