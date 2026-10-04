import type { ClassInfo } from "@/lib/types";

export function ClassSelect({ classes, value, onChange }: { classes: ClassInfo[]; value: string | null; onChange: (k: string) => void }) {
  if (classes.length === 0) return null;
  return (
    <label className="flex items-center gap-2 text-xs text-dim">
      Class
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 game-input px-2.5 text-sm text-foreground "
      >
        {classes.map((c) => (
          <option key={c.key} value={c.key}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
