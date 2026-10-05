import { REGIONS, REGION_KEYS } from "./data";
import { useRegion } from "./useTimers";
import { cn } from "@/lib/utils";

/** Global / KR / TW switch, remembered across visits. */
export function RegionTabs({ className }: { className?: string }) {
  const [region, setRegion] = useRegion();
  return (
    <div role="group" aria-label="Game region" className={cn("flex items-center gap-1", className)}>
      {REGION_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={region === k}
          onClick={() => setRegion(k)}
          className="game-tab px-2.5 py-1 text-xs"
        >
          {REGIONS[k].label}
        </button>
      ))}
    </div>
  );
}
