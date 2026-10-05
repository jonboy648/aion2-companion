import { Input } from "@/components/ui/input";
import { GRADES, type Filters } from "./logic";

const CLASSES = ["Gladiator", "Templar", "Assassin", "Ranger", "Sorcerer", "Spiritmaster", "Cleric", "Chanter", "Fighter"];

const toNum = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? undefined : Number(s));

interface Props {
  value: Filters;
  onChange: (f: Filters) => void;
  /** show the class select (only useful when the list can include class-locked weapons) */
  classFilter?: boolean;
}

/** Search box, grade chips, level ranges and a class select. */
export function FilterBar({ value, onChange, classFilter = true }: Props) {
  const set = (p: Partial<Filters>) => onChange({ ...value, ...p });
  const num = "w-16";
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <label className="min-w-[10rem] flex-1 text-xs text-faint">
        Search
        <Input type="search" value={value.q} placeholder="Name or id" onChange={(e) => set({ q: e.target.value })} className="mt-1" />
      </label>
      <div role="group" aria-label="Grade" className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-faint">Grade</span>
        {[...GRADES].reverse().map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={value.grades.includes(g)}
            className="game-tab px-2.5 py-1 text-xs"
            onClick={() => set({ grades: value.grades.includes(g) ? value.grades.filter((x) => x !== g) : [...value.grades, g] })}
          >
            {g}
          </button>
        ))}
      </div>
      <fieldset className="flex items-center gap-1.5 text-xs text-faint">
        <legend className="sr-only">Required level</legend>
        Level
        <Input aria-label="Minimum level" inputMode="numeric" placeholder="min" value={value.elMin ?? ""} onChange={(e) => set({ elMin: toNum(e.target.value) })} className={num} />
        to
        <Input aria-label="Maximum level" inputMode="numeric" placeholder="max" value={value.elMax ?? ""} onChange={(e) => set({ elMax: toNum(e.target.value) })} className={num} />
      </fieldset>
      <fieldset className="flex items-center gap-1.5 text-xs text-faint">
        <legend className="sr-only">Item level</legend>
        Item level
        <Input aria-label="Minimum item level" inputMode="numeric" placeholder="min" value={value.ilMin ?? ""} onChange={(e) => set({ ilMin: toNum(e.target.value) })} className={num} />
        to
        <Input aria-label="Maximum item level" inputMode="numeric" placeholder="max" value={value.ilMax ?? ""} onChange={(e) => set({ ilMax: toNum(e.target.value) })} className={num} />
      </fieldset>
      {classFilter && (
        <label className="text-xs text-faint">
          Class
          <select value={value.cls} onChange={(e) => set({ cls: e.target.value })} className="game-input mt-1 block h-9 px-2 text-sm text-foreground">
            <option value="">Any</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
