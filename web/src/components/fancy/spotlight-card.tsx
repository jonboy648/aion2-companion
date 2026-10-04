import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card with a gold spotlight that follows the pointer (21st.dev "spotlight card" pattern, adapted to the
 * navy/gold tokens). Purely decorative: the glow is a CSS radial gradient driven by two custom properties.
 */
export function SpotlightCard({ className, children, ...props }: React.ComponentProps<"div">) {
  const ref = React.useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--sx", `${e.clientX - r.left}px`);
    el.style.setProperty("--sy", `${e.clientY - r.top}px`);
  };
  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      className={cn("group ornate ornate-hover ornate-sm relative overflow-hidden", className)}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(240px circle at var(--sx, 50%) var(--sy, 50%), rgb(var(--ether) / 0.16), transparent 70%)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
