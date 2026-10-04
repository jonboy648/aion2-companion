import { useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { CompareResult, PlaystyleKey } from "@/lib/types";
import type { ClassData } from "./useClassData";
import { PlaystyleStrip } from "./PlaystyleStrip";
import { PlaystyleDetail } from "./PlaystyleDetail";
import { PLAYSTYLE_ORDER } from "./helpers";

/** Spinner + the engine's latest progress line. */
export function ProgressPanel({ title, message, steps }: { title: string; message: string; steps?: string[] }) {
  return (
    <div role="status" aria-live="polite" className="ornate p-5" data-testid="progress">
      <div className="flex items-center gap-3">
        <LoaderCircle className="size-5 animate-spin text-gold motion-reduce:animate-none" />
        <div>
          <div className="font-display font-bold tracking-wide">{title}</div>
          <div className="text-sm text-dim">{message}</div>
        </div>
      </div>
      {steps && steps.length > 1 && (
        <ul className="mt-3 space-y-0.5 pl-8 text-xs text-faint">
          {steps.slice(-4, -1).map((s, i) => (
            <li key={`${s}-${i}`}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Playstyle comparison strip + the selected playstyle's detail cards, with per-playstyle trade-off variants. */
export function BuildResults({ cmp, data, selected: picked, onSelect }: { cmp: CompareResult; data: ClassData; selected?: PlaystyleKey; onSelect?: (k: PlaystyleKey) => void }) {
  const first = PLAYSTYLE_ORDER.find((k) => cmp[k]) ?? "boss";
  const [own, setOwn] = useState<PlaystyleKey>(first);
  const selected = picked ?? own; // controlled when the page shares the playstyle with the gear card
  const setSelected = (k: PlaystyleKey) => {
    setOwn(k);
    onSelect?.(k);
  };
  const [variants, setVariants] = useState<Partial<Record<PlaystyleKey, string>>>({});
  const fb = cmp[selected] ?? cmp[first];

  const overrides = useMemo(() => {
    const out: Partial<Record<PlaystyleKey, string[]>> = {};
    for (const k of PLAYSTYLE_ORDER) {
      const vk = variants[k];
      const v = vk ? cmp[k]?.variants.find((x) => x.key === vk) : undefined;
      if (v && v.key !== "max") out[k] = v.stigma_picks.map(([key]) => key);
    }
    return out;
  }, [variants, cmp]);

  if (!fb) return null;
  return (
    <>
      <PlaystyleStrip cmp={cmp} data={data} selected={fb.playstyle.key} onSelect={setSelected} overrides={overrides} />
      <PlaystyleDetail fb={fb} data={data} variantKey={variants[fb.playstyle.key] ?? "max"} onVariant={(key) => setVariants((s) => ({ ...s, [fb.playstyle.key]: key }))} />
    </>
  );
}
