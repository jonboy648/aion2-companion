import type { CompareResult, PlaystyleKey } from "@/lib/types";
import type { ClassData } from "./useClassData";
import { SkillIcon } from "./SkillIcon";
import { PLAYSTYLE_ORDER, fmtDps, skillName } from "./helpers";

interface Props {
  cmp: CompareResult;
  data: ClassData;
  selected: PlaystyleKey;
  onSelect: (k: PlaystyleKey) => void;
  /** stigma keys per playstyle after a trade-off variant is applied */
  overrides?: Partial<Record<PlaystyleKey, string[]>>;
  dpsOverrides?: Partial<Record<PlaystyleKey, number>>;
  panelId: string;
}

/** Four columns: playstyle, estimated DPS bar, stigma icons, View. */
export function PlaystyleStrip({ cmp, data, selected, onSelect, overrides, dpsOverrides, panelId }: Props) {
  const id = panelId;
  const keys = PLAYSTYLE_ORDER.filter(k => cmp[k]);
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
            id={`${id}-${k}`}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onKeyDown={(event) => {
              const index = keys.indexOf(k);
              const next = event.key === "Home" ? 0 : event.key === "End" ? keys.length - 1 : event.key === "ArrowRight" ? (index + 1) % keys.length : event.key === "ArrowLeft" ? (index + keys.length - 1) % keys.length : -1;
              if (next < 0) return;
              event.preventDefault();
              onSelect(keys[next]);
              document.getElementById(`${id}-${keys[next]}`)?.focus();
            }}
            onClick={() => onSelect(k)}
            className="game-tab flex min-w-0 flex-col gap-2 !rounded-lg p-3 text-left text-foreground sm:p-4"
          >
            <span className="font-display text-[15px] font-bold">{fb.playstyle.name}</span>
            <span>
              <span className="text-2xl font-semibold tabular-nums text-gold">~{fmtDps(dpsOverrides?.[k] ?? fb.result.dps)}</span>
              <span className="ml-1 text-xs text-dim">DPS</span>
            </span>
            <span className="text-xs text-dim">{fb.playstyle.scenario.duration_s} s · {fb.playstyle.scenario.n_targets} targets · {fb.playstyle.scenario.boss ? "Boss" : "Non-boss"}</span>
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
