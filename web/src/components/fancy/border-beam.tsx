import "./fancy.css";
import { cn } from "@/lib/utils";

/** A thin gold light that travels around the parent's border (21st.dev "border beam"). Parent must be `relative`. */
export function BorderBeam({ className, duration = 8 }: { className?: string; duration?: number }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 rounded-[inherit] border border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]", className)}
    >
      <div
        className="absolute aspect-square w-24 motion-safe:animate-[beam-travel_var(--beam-d)_linear_infinite] bg-gradient-to-l from-gold via-gold-hi to-transparent"
        style={{ offsetPath: "rect(0 auto auto 0 round 12px)", ["--beam-d" as string]: `${duration}s` }}
      />
    </div>
  );
}
