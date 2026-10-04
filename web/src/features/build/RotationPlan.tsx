import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { IconUrls, RotationExplained, RotationSkill } from "@/lib/types";
import { SkillIcon } from "./SkillIcon";

function Heading({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2 mt-5 font-display text-sm font-bold tracking-wide text-gold first:mt-0">{children}</h4>;
}

const Charge = ({ s }: { s: RotationSkill }) => (s.charge_level > 0 ? <Badge tone="info">Charge {s.charge_level}</Badge> : null);

/**
 * The simulator's rotation as instructions: opener with timestamps, core priorities (plain "use on cooldown" /
 * "use when X is up" lines), chains, filler, and a collapsed list of skills that are not worth casting.
 */
export function RotationPlan({ rot, icons }: { rot: RotationExplained; icons: IconUrls }) {
  return (
    <div data-testid="rotation-plan">
      {rot.opener.length > 0 && (
        <section aria-label="Opener">
          <Heading>Opener</Heading>
          <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="Opener order">
            {rot.opener.map((s, i) => (
              <li key={`${s.skill_key}-${i}`} className="flex w-[68px] shrink-0 flex-col items-center gap-1 text-center">
                <SkillIcon name={s.name} url={icons[s.icon_key]} size={48} rarity="unique" />
                <span className="line-clamp-2 text-[11px] leading-tight text-foreground">{s.name}</span>
                {s.charge_level > 0 && <span className="text-[10px] text-cyan">Charge {s.charge_level}</span>}
                <span className="text-[11px] tabular-nums text-faint">{s.t_s.toFixed(1)} s</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {rot.core.length > 0 && (
        <section aria-label="Core priorities">
          <Heading>Core priorities</Heading>
          <ul className="grid gap-2 lg:grid-cols-2">
            {rot.core.map((c) => (
              <li key={c.skill_key} className="frame flex items-start gap-3 p-2.5">
                <SkillIcon name={c.name} url={icons[c.icon_key]} size={44} rarity="epic" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{c.name}</span>
                    <Charge s={c} />
                    {c.cooldown_s > 0 && <Badge tone="neutral">CD {Math.round(c.cooldown_s)} s</Badge>}
                  </span>
                  <span className="block text-xs text-dim">{c.text}</span>
                  {c.damage_share_pct >= 0.5 && <span className="text-[11px] text-faint">{c.damage_share_pct.toFixed(0)}% of damage</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rot.chains.length > 0 && (
        <section aria-label="Chains">
          <Heading>Chains</Heading>
          <ul className="space-y-2">
            {rot.chains.map((c, i) => (
              <li key={i} className="frame flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5">
                <span className="flex items-center gap-1.5">
                  {c.skills.map((k, j) => (
                    <span key={`${k}-${j}`} className="flex items-center gap-1.5">
                      {j > 0 && <ArrowRight aria-hidden className="size-3.5 text-faint" />}
                      <SkillIcon name={c.names[j] ?? k} url={icons[c.icon_keys[j] ?? k]} size={36} rarity="rare" />
                    </span>
                  ))}
                </span>
                <span className="min-w-0 flex-1 basis-48 text-xs text-dim">{c.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rot.filler.skills.length > 0 && (
        <section aria-label="Filler">
          <Heading>Filler</Heading>
          <div className="frame flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5">
            <span className="flex gap-1.5">
              {rot.filler.skills.map((s) => (
                <SkillIcon key={s.skill_key} name={s.name} url={icons[s.icon_key]} size={36} rarity="common" />
              ))}
            </span>
            <span className="min-w-0 flex-1 basis-48 text-xs text-dim">{rot.filler.text}</span>
          </div>
        </section>
      )}

      {rot.skip.length > 0 && (
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer text-cyan">Not used ({rot.skip.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {rot.skip.map((s) => (
              <li key={s.skill_key} className="flex items-center gap-2.5">
                <SkillIcon name={s.name} url={icons[s.icon_key]} size={28} rarity="common" />
                <span className="text-sm">{s.name}</span>
                <span className="text-xs text-faint">{s.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
