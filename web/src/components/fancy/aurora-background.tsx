import "./fancy.css";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Slow drifting navy/gold/cyan aurora behind hero content (21st.dev "aurora background" pattern).
 * Respects prefers-reduced-motion via the motion-safe variant.
 */
export function AuroraBackground({ className, children, ...props }: React.ComponentProps<"section">) {
  return (
    <section className={cn("ornate ornate-lg relative isolate overflow-hidden", className)} {...props}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="aurora-blob motion-safe:animate-[aurora-drift_18s_ease-in-out_infinite]" style={{ left: "-10%", top: "-40%", background: "rgb(var(--ether-2) / 0.22)" }} />
        <div className="aurora-blob motion-safe:animate-[aurora-drift_24s_ease-in-out_infinite_reverse]" style={{ right: "-8%", top: "-20%", background: "rgb(var(--ether) / 0.22)" }} />
        <div className="aurora-blob motion-safe:animate-[aurora-drift_30s_ease-in-out_infinite]" style={{ left: "35%", bottom: "-60%", background: "rgb(var(--ether) / 0.16)" }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--surface)_95%)]" />
      </div>
      {children}
    </section>
  );
}
