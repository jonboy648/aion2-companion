import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BuildVariant, Confidence, FullBuild } from "@/lib/types";
import type { ClassData } from "./useClassData";
import { SkillIcon } from "./SkillIcon";
import { fmtDps, fmtPct, rotationRows, roleNote, skillName, statDelta, statLabel } from "./helpers";

const CONF_TONE: Record<Confidence, "ok" | "warn" | "neutral"> = { confirmed: "ok", estimated: "warn", unknown: "neutral" };

interface Props {
  fb: FullBuild;
  data: ClassData;
  /** variant key currently applied ("max" = none) */
  variantKey: string;
  onVariant: (key: string) => void;
}

function Section({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {hint && <CardDescription>{hint}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function StigmaList({ picks, data }: { picks: [string, number][]; data: ClassData }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {picks.map(([key, gain]) => (
        <li key={key} className="flex items-center gap-3 rounded-md border border-border-soft bg-surface2 p-2.5">
          <SkillIcon name={skillName(data.gd?.skills, key)} url={data.icons[key]} size={44} ring="var(--gold-lo)" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{skillName(data.gd?.skills, key)}</span>
            <span className={gain > 0 ? "text-xs text-ok" : "text-xs text-faint"}>{gain > 0 ? `${fmtPct(gain)} DPS` : "No DPS (utility slot)"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function VariantCard({ v, applied, data, onUse }: { v: BuildVariant; applied: boolean; data: ClassData; onUse: () => void }) {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border-soft bg-surface2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{v.label}</span>
        <Badge tone={v.dps_delta_pct < -0.05 ? "warn" : "ok"}>{Math.abs(v.dps_delta_pct) < 0.05 ? "No DPS cost" : `${fmtPct(v.dps_delta_pct)} DPS`}</Badge>
      </div>
      <p className="text-xs text-dim">{v.gives}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="flex gap-1.5">
          {v.stigma_picks.map(([k]) => (
            <SkillIcon key={k} name={skillName(data.gd?.skills, k)} url={data.icons[k]} size={28} />
          ))}
        </span>
        <span className="text-xs tabular-nums text-dim">~{fmtDps(v.dps)} DPS</span>
      </div>
      <Button size="sm" variant={applied ? "default" : "secondary"} onClick={onUse} aria-pressed={applied}>
        {applied ? "Using this variant" : "Use this variant"}
      </Button>
    </li>
  );
}

/** One playstyle's full recommendation: stigmas, skill points, Daevanion, rotation, trade-offs, stat upgrades. */
export function PlaystyleDetail({ fb, data, variantKey, onVariant }: Props) {
  const [showWarnings, setShowWarnings] = useState(false);
  const variants = fb.variants ?? [];
  const applied = variants.find((v) => v.key === variantKey && v.key !== "max");
  const picks = applied ? applied.stigma_picks : fb.stigma_picks;
  const dps = applied ? applied.dps : fb.result.dps;
  const rows = rotationRows(fb);
  const rankedSkills = Object.keys(fb.build.skill_ranks ?? {}).length;

  return (
    <div className="space-y-4" data-testid="playstyle-detail">
      <div className="flex flex-wrap items-end justify-between gap-3 border-l-4 border-gold pl-3">
        <div>
          <h2 className="text-xl font-semibold">{fb.playstyle.name} plan</h2>
          <p className="text-sm text-dim">{fb.playstyle.description}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums text-gold">~{fmtDps(dps)}</div>
          <div className="flex items-center justify-end gap-2 text-xs text-dim">
            estimated DPS
            <Badge tone={CONF_TONE[fb.result.confidence]}>{fb.result.confidence}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Stigmas" hint={applied ? `Variant applied: ${applied.label}` : "Best set for this playstyle, with each pick's DPS gain."}>
          <StigmaList picks={picks} data={data} />
        </Section>
        <div className="grid gap-4">
          <Section title="Skill points">
            {fb.rank_log.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {fb.rank_log.map(([key, rank, gain]) => (
                  <li key={`${key}-${rank}`} className="flex items-center gap-2">
                    <SkillIcon name={skillName(data.gd?.skills, key)} url={data.icons[key]} size={26} />
                    <span className="flex-1">
                      {skillName(data.gd?.skills, key)} to rank <strong>{rank}</strong>
                    </span>
                    <span className="text-ok">+{fmtDps(gain)} DPS</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-dim">
                {fb.build.skill_points == null
                  ? `No spare skill points to place: your ${rankedSkills} ranked skills are used as imported.`
                  : "No better skill rank found with your points."}
              </p>
            )}
          </Section>
          <Section title="Daevanion">
            <p className="text-sm text-dim">
              Best path opens <strong className="text-foreground">{fb.daevanion_path.length}</strong> nodes for about{" "}
              <strong className="text-ok">{fmtPct(fb.daevanion_gain_pct)}</strong> DPS.
            </p>
          </Section>
        </div>
      </div>

      <Section title="Rotation" hint="Cast order the simulator found best. Charged skills show the level to hold.">
        <ol className="grid gap-2 lg:grid-cols-2">
          {rows.map((r, i) => {
            const name = skillName(data.gd?.skills, r.skillKey);
            const skill = data.gd?.skills[r.skillKey];
            return (
              <li key={`${r.skillKey}-${i}`} className="flex items-center gap-3 rounded-md border border-border-soft bg-surface2 p-2.5">
                <span className="w-5 shrink-0 text-center text-sm font-semibold text-faint">{i + 1}</span>
                <SkillIcon name={name} url={data.icons[r.skillKey]} size={52} ring="var(--gold-lo)" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{name}</span>
                    {r.chargeLevel > 0 && <Badge tone="info">Charge {r.chargeLevel}</Badge>}
                    {r.requireStatus && <Badge tone="neutral">needs {r.requireStatus.replace(/_/g, " ")}</Badge>}
                  </span>
                  <span className="block text-xs text-dim">{roleNote(r, data.gd?.rules[r.skillKey]?.note, skill?.tags)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </Section>

      {variants.length > 0 && (
        <Section title="Trade-offs" hint="Swap a stigma for utility and see what it costs.">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {variants.map((v) => (
              <VariantCard key={v.key} v={v} data={data} applied={v.key === variantKey} onUse={() => onVariant(v.key)} />
            ))}
          </ul>
        </Section>
      )}

      {fb.stat_gains.length > 0 && (
        <Section title="Next stat upgrades" hint="DPS gained per small step, best first.">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {fb.stat_gains.map((g) => (
              <li key={g.stat} className="flex items-center justify-between gap-2 rounded-md border border-border-soft bg-surface2 px-3 py-2 text-sm">
                <span>
                  {statLabel(g.stat)} <span className="text-dim">{statDelta(g.stat, g.delta)}</span>
                </span>
                <span className="font-semibold text-ok">{fmtPct(g.dps_gain_pct, 2)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {fb.warnings.length > 0 && (
        <div className="text-xs text-dim">
          <button type="button" className="text-cyan underline-offset-2 hover:underline" onClick={() => setShowWarnings((s) => !s)} aria-expanded={showWarnings}>
            {showWarnings ? "Hide" : "Show"} {fb.warnings.length} model notes
          </button>
          {showWarnings && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {fb.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
