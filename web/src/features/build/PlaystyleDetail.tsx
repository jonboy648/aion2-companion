import { RotationPlan } from "./RotationPlan";
import { SectionTitle } from "@/components/game/SectionTitle";
import { useState } from "react";
import AdvancedStats from "@/components/ui/advanced-stats";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BuildDamage } from "./BuildDamage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <section className={className}>
      <h3 className="mb-2 text-base font-semibold">{title}</h3>
      {hint && <p className="mb-3 text-xs text-dim">{hint}</p>}
      {children}
    </section>
  );
}

function StigmaList({ picks, data, aggregateOnly = false }: { picks: [string, number][]; data: ClassData; aggregateOnly?: boolean }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {picks.map(([key, gain]) => (
        <li key={key} className="flex items-center gap-3 frame p-2.5">
          <SkillIcon name={skillName(data.gd?.skills, key)} url={data.icons[key]} size={44} ring="var(--gold-lo)" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{skillName(data.gd?.skills, key)}</span>
            {!aggregateOnly && <span className={gain > 0 ? "text-xs text-ok" : "text-xs text-faint"}>{gain > 0 ? `${fmtPct(gain)} DPS` : "No DPS (utility slot)"}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function VariantCard({ v, applied, data, onUse }: { v: BuildVariant; applied: boolean; data: ClassData; onUse: () => void }) {
  return (
    <li className="flex flex-col gap-2 frame p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{v.label}</span>
        <Badge tone={v.dps_delta_pct < -0.05 ? "warn" : "ok"}>{Math.abs(v.dps_delta_pct) < 0.05 ? "No DPS cost" : `${fmtPct(v.dps_delta_pct)} DPS`}</Badge>
      </div>
      <p className="text-xs text-dim">{v.gives}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap gap-1.5">
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

export interface RankBuy {
  key: string;
  from: number;
  to: number;
  gain: number;
  /** points spent on this skill (engine cost tables: SKILL_POINT_COST / STIGMA_POINT_COST) */
  cost: number;
  stigma: boolean;
}

const SKILL_COST = [0, 1, 1, 1, 2, 2, 2, 4, 4, 4]; // index = rank - 1
const STIGMA_COST = [...Array(5).fill(1), ...Array(5).fill(2), ...Array(5).fill(4), ...Array(5).fill(8)];

/** rank_log (purchase order, one row per rank) grouped by skill: ranks bought, summed DPS gain %, points spent. */
export function groupRankLog(log: [string, number, number][], isStigma: (key: string) => boolean = () => false): RankBuy[] {
  const out = new Map<string, RankBuy>();
  for (const [key, rank, gain] of log) {
    const stigma = isStigma(key);
    const cost = (stigma ? STIGMA_COST : SKILL_COST)[rank - 1] ?? 0;
    const cur = out.get(key);
    if (cur) {
      cur.from = Math.min(cur.from, rank - 1);
      cur.to = Math.max(cur.to, rank);
      cur.gain += gain;
      cur.cost += cost;
    } else out.set(key, { key, from: rank - 1, to: rank, gain, cost, stigma });
  }
  return [...out.values()].sort((a, b) => b.gain - a.gain);
}

function SkillPoints({ fb, data, rankedSkills }: { fb: FullBuild; data: ClassData; rankedSkills: number }) {
  const entered = fb.build.skill_points ?? 0;
  const stigEntered = fb.build.stigma_points ?? 0;
  if (fb.rank_log.length === 0) {
    return (
      <p className="text-sm text-dim">
        {entered > 0 || stigEntered > 0
          ? "Nothing is worth buying with your points: every skill is already at its best rank for this playstyle."
          : `Enter your unspent skill points above to see where to spend them. Until then your ${rankedSkills} ranked skills are used as imported.`}
      </p>
    );
  }
  const buys = groupRankLog(fb.rank_log, (k) => data.gd?.skills[k]?.kind === "stigma");
  const sum = (stigma: boolean) => buys.filter((b) => b.stigma === stigma).reduce((n, b) => n + b.cost, 0);
  return (
    <div className="space-y-2" data-testid="rank-log">
      <p className="text-sm font-medium">Spend your {entered || stigEntered} points:</p>
      <ul className="space-y-1.5 text-sm">
        {buys.map((b) => (
          <li key={b.key} className="flex flex-wrap items-center gap-2">
            <SkillIcon name={skillName(data.gd?.skills, b.key)} url={data.icons[b.key]} size={26} />
            <span className="min-w-0 flex-1">{skillName(data.gd?.skills, b.key)}</span>
            <span className="tabular-nums text-dim">
              rank {b.from} → {b.to}
            </span>
            <span className="w-24 text-right tabular-nums text-ok">{fmtPct(b.gain)} DPS</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-dim">
        {sum(false) > 0 && `Uses ${sum(false)} of ${entered} skill points.`}
        {sum(false) > 0 && sum(true) > 0 && " "}
        {sum(true) > 0 && `Uses ${sum(true)} of ${stigEntered} stigma points.`}
      </p>
    </div>
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle className="mb-0 min-w-0 flex-1 basis-64" caption={fb.playstyle.description}>
          {fb.playstyle.name} plan
        </SectionTitle>
        <div className="flex items-end gap-5 text-right">
          {fb.current_dps != null && (
            <div data-testid="current-dps">
              <div className="font-display text-2xl font-bold tabular-nums">~{fmtDps(fb.current_dps)}</div>
              <div className="text-xs text-dim">Current build<br />as imported</div>
            </div>
          )}
          <div data-testid="plan-dps">
            <div className="font-display text-3xl font-bold tabular-nums text-gold">~{fmtDps(dps)}</div>
            <div className="flex items-center justify-end gap-2 text-xs text-dim">
              {fb.current_dps != null ? "Best build with your gear" : "estimated DPS"}
              <Badge tone={CONF_TONE[fb.result.confidence]}>{fb.result.confidence}</Badge>
            </div>
          </div>
        </div>
      </div>

      <AdvancedStats metrics={[
        { key: "dps", label: "Estimated DPS", value: fmtDps(dps), hint: applied?.label ?? "Best build with your gear" },
        ...(fb.current_dps != null ? [{ key: "current", label: "Current build DPS", value: fmtDps(fb.current_dps), hint: "As imported, no changes" }] : []),
        { key: "duration", label: "Duration", value: `${fb.playstyle.scenario.duration_s} s` },
        { key: "targets", label: "Targets", value: String(fb.playstyle.scenario.n_targets), hint: fb.playstyle.scenario.boss ? "Boss target" : "Non-boss targets" },
        { key: "confidence", label: "Model confidence", value: fb.result.confidence },
      ]} supporting={<div className="space-y-5">
        <Section title={applied ? "Selected variant" : "Top stigma changes"} hint={applied ? `Variant applied: ${applied.label}` : "Individual stigma experiments; gains are not additive."}>
          {applied ? <p className="text-sm text-dim">{applied.gives}</p> : <StigmaList picks={[...picks].filter(([, gain]) => gain > 0).sort((a, b) => b[1] - a[1]).slice(0, 3)} data={data} />}
        </Section>
        {applied && <p className="text-xs text-dim">Detailed simulation is unavailable for this variant. Rotation, skill points, Daevanion and stat gains below describe the unchanged max-DPS build.</p>}
        <Section title="Skill points">
          <SkillPoints fb={fb} data={data} rankedSkills={rankedSkills} />
        </Section>
        <Section title="Daevanion">
          <p className="text-sm text-dim">Max-DPS path: {fb.daevanion_path.length} nodes, {fmtPct(fb.daevanion_gain_pct)} estimated DPS gain.</p>
        </Section>
      </div>} main={<Tabs defaultValue="overview">
      <TabsList aria-label="Build details">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="rotation">Rotation</TabsTrigger>
        <TabsTrigger value="tradeoffs">Trade-offs</TabsTrigger>
        <TabsTrigger value="stats">Stat gains</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
      {!applied && <BuildDamage fb={fb} data={data} />}
      <div className="mt-5">
        <Section title="Stigmas" hint={applied ? `Variant applied: ${applied.label}` : "Best set for this playstyle, with each pick's DPS gain."}>
          <StigmaList picks={picks} data={data} aggregateOnly={!!applied} />
        </Section>
      </div>
      </TabsContent>
      <TabsContent value="rotation">
      {applied && <p className="mb-3 text-xs text-dim">Max-DPS build rotation</p>}
      <p className="mb-3 text-xs text-dim">Opening sequence and cast-start priorities; not a complete damage timeline.</p>
      <Section title="Rotation" hint={fb.rotation_explained?.core ? `How to play it: ${fb.rotation_explained.scenario_name.toLowerCase()}, ${Math.round(fb.rotation_explained.duration_s)} s simulated. Charged skills show the level to hold.` : "Cast order the simulator found best. Charged skills show the level to hold."}>
        {fb.rotation_explained?.core ? (
          <RotationPlan rot={fb.rotation_explained} icons={data.icons} />
        ) : (
          <ol className="grid gap-2 lg:grid-cols-2">
          {rows.map((r, i) => {
            const name = skillName(data.gd?.skills, r.skillKey);
            const skill = data.gd?.skills[r.skillKey];
            return (
              <li key={`${r.skillKey}-${i}`} className="flex items-center gap-3 frame p-2.5">
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
        )}
      </Section>
      </TabsContent>
      <TabsContent value="tradeoffs">
      {variants.length > 0 && (
        <Section title="Trade-offs" hint="Swap a stigma for utility and see what it costs.">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {variants.map((v) => (
              <VariantCard key={v.key} v={v} data={data} applied={v.key === variantKey} onUse={() => onVariant(v.key)} />
            ))}
          </ul>
        </Section>
      )}
      </TabsContent>
      <TabsContent value="stats">
      {applied && <p className="mb-3 text-xs text-dim">Max-DPS build stat experiments</p>}
      {fb.stat_gains.length > 0 && (
        <Section title="Next stat upgrades" hint="DPS gained per small step, best first.">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {fb.stat_gains.map((g) => (
              <li key={g.stat} className="flex items-center justify-between gap-2 frame px-3 py-2 text-sm">
                <span>
                  {statLabel(g.stat)} <span className="text-dim">{statDelta(g.stat, g.delta)}</span>
                </span>
                <span className="font-semibold text-ok">{fmtPct(g.dps_gain_pct, 2)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {fb.stat_gains.length === 0 && <p className="text-sm text-dim">Stat gains unavailable.</p>}
      </TabsContent>
      </Tabs>} />
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
