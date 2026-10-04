import { Input } from "@/components/ui/input";
import type { Points } from "./unspentPoints";

/** Compact "Unspent points" control: two optional whole-number inputs. */
export function UnspentPoints({ value, onChange }: { value: Points; onChange: (p: Points) => void }) {
  const field = (k: keyof Points, label: string) => (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-dim">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        placeholder="0"
        className="h-8 w-20"
        value={value[k]}
        onChange={(e) => onChange({ ...value, [k]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 frame px-4 py-3" data-testid="unspent-points">
      <span className="font-display text-sm font-bold tracking-wide text-gold">Unspent points</span>
      {field("skill", "Skill points")}
      {field("stigma", "Stigma points")}
      <span className="text-xs text-faint">The armory doesn't show unspent points; enter them from your Skill window (K).</span>
    </div>
  );
}
