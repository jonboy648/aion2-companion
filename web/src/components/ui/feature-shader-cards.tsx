"use client";

import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const Warp = lazy(() => import("./paper-warp"));

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  href: string;
}

const palettes = [
  ["#6b251e", "#cd743f", "#862c40", "#eab15f"],
  ["#24372e", "#ac904e", "#516863", "#dcc48b"],
  ["#321f40", "#8c6e9e", "#493258", "#d49bab"],
  ["#203f29", "#7dad69", "#345c42", "#bfcc8c"],
  ["#1a3b51", "#5d9fca", "#356e94", "#9dbacf"],
  ["#164846", "#4cb9a6", "#3b668e", "#a0cbb6"],
  ["#483927", "#ccb773", "#80704e", "#ece1b6"],
  ["#593624", "#c69059", "#416e66", "#daaf7b"],
];

function supportsWebGL() {
  if (typeof WebGL2RenderingContext === "undefined") return false;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

class ShaderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

interface CardProps {
  children: ReactNode;
  index?: number;
  enabled?: boolean;
  animated?: boolean;
  compact?: boolean;
  className?: string;
}

export function FeatureShaderCard({ children, index = 0, enabled = false, animated = false, compact = false, className }: CardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pixelLimit, setPixelLimit] = useState(32_000);
  const colors = palettes[Math.abs(Math.trunc(index)) % palettes.length];
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const resize = () => {
      const area = el.clientWidth * el.clientHeight;
      if (area > 0) setPixelLimit(Math.min(50_000, Math.ceil(area * (compact ? 1 : 2.25))));
    };
    resize();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [compact]);
  return (
    <div ref={ref} className={cn("feature-shader-card group ornate ornate-hover ornate-sm relative isolate h-full overflow-hidden", className)}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0" style={{ background: `linear-gradient(125deg, ${colors.join(", ")})` }}>
        {enabled && (
          <ShaderBoundary>
            <Suspense fallback={null}>
              <Warp
                style={{ height: "100%", width: "100%" }}
                colors={colors}
                proportion={0.3 + (index % 4) * 0.04}
                softness={0.9}
                distortion={0.15 + (index % 3) * 0.02}
                swirl={0.6 + (index % 3) * 0.1}
                swirlIterations={8}
                shape={index % 2 === 0 ? "checks" : "stripes"}
                shapeScale={0.1}
                scale={1}
                rotation={0}
                speed={animated ? 0.8 : 0}
                frame={10_000 + index * 3_000}
                minPixelRatio={1}
                maxPixelCount={pixelLimit}
              />
            </Suspense>
          </ShaderBoundary>
        )}
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 bg-black/70" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default function FeaturesCards({ features, loading = false, className }: { features: readonly Feature[]; loading?: boolean; className?: string }) {
  const [graphics, setGraphics] = useState({ available: false, reduced: true, compact: true, visible: false });
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 639px)");
    const available = supportsWebGL();
    const update = () => setGraphics({ available, reduced: reduced.matches, compact: compact.matches, visible: !document.hidden });
    update();
    reduced.addEventListener("change", update);
    compact.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      reduced.removeEventListener("change", update);
      compact.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const canvasLimit = graphics.compact ? 2 : 8;
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {loading && Array.from({ length: 8 }, (_, i) => <li key={i} className="ornate h-24 animate-pulse motion-reduce:animate-none" />)}
      {features.map((feature, index) => (
        <li key={feature.id}>
          <Link to={feature.href} aria-label={feature.title} className="block no-underline">
            <FeatureShaderCard index={index} enabled={graphics.available && index < canvasLimit} animated={!graphics.reduced && graphics.visible} compact={graphics.compact}>
              <div className="feature-shader-card-content flex items-center gap-3 p-4">
                {feature.icon}
                <span className="min-w-0">
                  <span className="feature-shader-card-title block truncate font-display font-bold text-foreground">{feature.title}</span>
                  <span className="text-xs text-dim">{feature.description}</span>
                </span>
              </div>
            </FeatureShaderCard>
          </Link>
        </li>
      ))}
    </ul>
  );
}
