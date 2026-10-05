import { useEffect, useRef } from "react";
import type { createLivingGorge } from "./living-gorge-scene";

export function LivingGorge({ active }: { active: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<Awaited<ReturnType<typeof createLivingGorge>> | null>(null);
  const running = useRef(active);
  const inView = useRef(true);
  running.current = active;
  useEffect(() => {
    let cancelled = false;
    const el = host.current;
    if (!el) return;
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      inView.current = entry.isIntersecting;
      scene.current?.setActive(running.current && inView.current);
    });
    observer?.observe(el);
    void import("./living-gorge-scene").then(module => cancelled ? null : module.createLivingGorge(el)).then(value => {
      if (!value) return;
      if (cancelled) { value.dispose(); return; }
      scene.current = value;
      value.setActive(running.current && inView.current);
    }).catch(() => { /* The original image remains visible if WebGL is unavailable. */ });
    return () => { cancelled = true; observer?.disconnect(); scene.current?.dispose(); scene.current = null; };
  }, []);
  useEffect(() => { scene.current?.setActive(active && inView.current); }, [active]);
  return <div ref={host} className="living-gorge" aria-hidden="true" />;
}
