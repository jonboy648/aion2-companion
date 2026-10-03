import { cn } from "@/lib/utils";
import type { CompareResult, PlaystyleKey } from "@/lib/types";
import type { ClassData } from "./useClassData";
import { SkillIcon } from "./SkillIcon";
import { PLAYSTYLE_ORDER, fmtDps, maxDps, skillName } from "./helpers";

interface Props {
  cmp: CompareResult;
  data: ClassData;
  selected: PlaystyleKey;
  onSelect: (k: PlaystyleKey) => void;
  /** stigma keys per playstyle after a trade-off variant is applied */
  overrides?: Partial<Record<PlaystyleKey, string[]>>;
}

/** Four columns: playstyle, estimated DPS bar, stigma icons, View. */
export function PlaystyleStrip({ cmp, data, selected, onSelect, overrides }: Props) {
  const top = maxDps(cmp);
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" role="tablist" aria-label="Playstyles">
      {PLAYSTYLE_ORDER.filter((k) => cmp[k]).map((k) => {
        const fb = cmp[k];
        const active = k === selected;
        const stigmas = overrides?.[k] ?? fb.stigma_picks.map(([key]) => key);
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(k)}
            className={cn(
              "flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors sm:p-4",
              active ? "border-gold bg-surface2 shadow-[0_0_0_1px_var(--gold),0_0_28px_rgba(224,180,88,0.12)]" : "border-border-soft hover:border-border hover:bg-surface2",
            )}
          >
            <span className="text-[15px] font-semibold">{fb.playstyle.name}</span>
            <span>
              <span className="text-2xl font-semibold tabular-nums text-gold">~{fmtDps(fb.result.dps)}</span>
              <span className="ml-1 text-xs text-dim">DPS</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-surface3" aria-hidden>
              <span className="block h-full rounded-full bg-gradient-to-r from-gold-lo to-gold-hi" style={{ width: `${(fb.result.dps / top) * 100}%` }} />
            </span>
            <span className="flex flex-wrap gap-1.5" aria-label="Stigmas">
              {stigmas.map((key) => (
                <SkillIcon key={key} name={skillName(data.gd?.skills, key)} url={data.icons[key]} size={30} />
              ))}
            </span>
            <span className={cn("mt-auto text-xs font-medium", active ? "text-gold" : "text-cyan")}>{active ? "Viewing" : "View"}</span>
          </button>
        );
      })}
    </div>
  );
}
