"use client";

import { Box } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { PrismFluxScene } from "./prism-flux-scene";

export interface PrismFluxLoaderProps {
  size?: number;
  speed?: number;
  textSize?: number;
  label?: string | null;
  className?: string;
}

function bound(value: number, fallback: number, minimum: number, maximum: number) {
  return Number.isFinite(value) && value > 0 ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
    && rect.top < window.innerHeight && rect.left < window.innerWidth
    && style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse";
}

export function PrismFluxLoader({ size = 30, speed = 5, textSize = 14, label = "Loading...", className }: PrismFluxLoaderProps) {
  const decorative = label === null;
  const cubeSize = bound(size, 30, 16, 96);
  const fontSize = bound(textSize, 14, 12, 24);
  const side = Math.ceil(cubeSize * 1.8);
  const spinSpeed = Number.isFinite(speed) && speed >= 0 ? Math.min(10, speed) : 5;
  const iconRef = useRef<HTMLSpanElement>(null);
  const sceneRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const icon = iconRef.current;
    const host = sceneRef.current;
    // Check the browser capability before importing Three or touching a canvas.
    if (!icon || !host || typeof window === "undefined" || typeof document === "undefined"
      || typeof window.WebGL2RenderingContext !== "function"
      || typeof window.requestAnimationFrame !== "function" || typeof window.cancelAnimationFrame !== "function") return;

    let cancelled = false;
    let failed = false;
    let pending = false;
    let scene: PrismFluxScene | undefined;
    let inView = isVisible(icon);
    let motion: MediaQueryList | undefined;
    const unsubscribers: Array<() => void> = [];
    try {
      motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    } catch { /* Missing media support uses a static cube. */ }

    const unsubscribe = () => {
      for (const remove of unsubscribers.splice(0)) remove();
    };
    const fail = () => {
      failed = true;
      delete icon.dataset.sceneReady;
      scene?.dispose();
      scene = undefined;
      unsubscribe();
    };
    const visible = () => inView && document.visibilityState !== "hidden" && isVisible(icon);
    const animate = () => visible() && !!motion && !motion.matches && spinSpeed > 0;
    const update = () => {
      if (cancelled || failed) return;
      if (scene) {
        scene.setActive(animate());
        return;
      }
      if (pending || !visible()) return;
      pending = true;
      void import("./prism-flux-scene").then(({ createPrismFluxScene }) => {
        pending = false;
        if (cancelled || failed || !visible()) return;
        const style = window.getComputedStyle(icon);
        const created = createPrismFluxScene(host, {
          size: cubeSize,
          side,
          speed: spinSpeed,
          color: style.color || "#e0b458",
          faceColor: style.getPropertyValue("--bg").trim() || "#0a1224",
          onFailure: fail,
        });
        if (cancelled || failed) {
          created.dispose();
          return;
        }
        scene = created;
        icon.dataset.sceneReady = "true";
        scene.setActive(animate());
      }).catch(() => { if (!cancelled) fail(); });
    };
    if (typeof motion?.addEventListener === "function" && typeof motion.removeEventListener === "function") {
      motion.addEventListener("change", update);
      unsubscribers.push(() => motion!.removeEventListener("change", update));
    } else if (typeof motion?.addListener === "function" && typeof motion.removeListener === "function") {
      motion.addListener(update);
      unsubscribers.push(() => motion!.removeListener(update));
    }
    document.addEventListener("visibilitychange", update);
    unsubscribers.push(() => document.removeEventListener("visibilitychange", update));
    const refreshVisibility = () => { inView = isVisible(icon); update(); };
    window.addEventListener("resize", refreshVisibility);
    window.addEventListener("scroll", refreshVisibility, { capture: true, passive: true });
    unsubscribers.push(() => {
      window.removeEventListener("resize", refreshVisibility);
      window.removeEventListener("scroll", refreshVisibility, true);
    });
    if (typeof IntersectionObserver === "function") {
      const observer = new IntersectionObserver(entries => {
        inView = entries.some(entry => entry.isIntersecting);
        update();
      });
      observer.observe(icon);
      unsubscribers.push(() => observer.disconnect());
    }
    update();
    return () => {
      cancelled = true;
      unsubscribe();
      scene?.dispose();
      delete icon.dataset.sceneReady;
    };
  }, [cubeSize, side, spinSpeed]);
  return (
    <div
      className={cn("prism-flux-loader", className)}
      role={decorative ? undefined : "status"}
      aria-live={decorative ? undefined : "polite"}
      aria-hidden={decorative ? true : undefined}
      data-decorative={decorative}
      style={{ fontSize }}
    >
      <span ref={iconRef} className="prism-flux-icon" aria-hidden="true" style={{ width: side, height: side }}>
        <Box className="prism-flux-fallback" size={cubeSize} aria-hidden="true" />
        <span ref={sceneRef} className="prism-flux-scene" />
      </span>
      {!decorative && <span className="prism-flux-label">{label}</span>}
    </div>
  );
}
