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
            className="game-tab flex min-w-0 flex-col gap-2 !rounded-lg p-3 text-left text-foreground sm:p-4"
          >
            <span className="font-display text-[15px] font-bold tracking-wide">{fb.playstyle.name}</span>
            <span>
              <span className="text-2xl font-semibold tabular-nums text-gold">~{fmtDps(fb.result.dps)}</span>
              <span className="ml-1 text-xs text-dim">DPS</span>
            </span>
            <span className="xp-bar xp-bar-sm" aria-hidden>
              <span className="xp-fill" style={{ width: `${(fb.result.dps / top) * 100}%` }} />
            </span>
            <span className="flex flex-wrap gap-1.5" aria-label="Stigmas">
              {stigmas.map((key) => (
                <SkillIcon key={key} name={skillName(data.gd?.skills, key)} url={data.icons[key]} size={30} />
              ))}
            </span>
            <span className={active ? "mt-auto text-xs font-semibold text-gold" : "mt-auto text-xs font-medium text-cyan"}>{active ? "Viewing" : "View"}</span>
          </button>
        );
      })}
    </div>
  );
}
