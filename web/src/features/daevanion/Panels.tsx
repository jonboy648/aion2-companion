import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DaevanionNode, GameData } from "@/lib/types";
import { formatEffect, rarityColor, SKILL_BONUS_CAP, type StatTotal } from "./logic";

export function NodeDetail({ node, gd, state }: { node: DaevanionNode | null; gd: GameData; state?: string }) {
  if (!node)
    return (
      <p className="text-sm text-faint">
        Hover or focus a node to see its effects. Click an available node to pick it, click a picked node at the edge of your path to
        drop it.
      </p>
    );
  const skill = node.skill_key ? gd.skills[node.skill_key] : null;
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-block size-3 rounded-sm" style={{ background: rarityColor(node.rarity) }} aria-hidden />
        <span className="font-medium">{node.name}</span>
        <Badge tone="neutral">{node.rarity}</Badge>
        <Badge tone="gold">{node.cost} pt</Badge>
        {state && <Badge tone={state === "selected" ? "ok" : state === "available" ? "info" : "neutral"}>{state}</Badge>}
      </div>
      {skill && <p className="text-xs text-dim">Raises {skill.name} by 1 rank (max +{SKILL_BONUS_CAP} per skill).</p>}
      <ul className="space-y-0.5 text-sm">
        {node.effects.map((e, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="text-dim">{e.stat}</span>
            <span className="text-gold">{formatEffect(e.value, e.unit)}</span>
          </li>
        ))}
        {node.effects.length === 0 && !skill && <li className="text-faint">No listed effects.</li>}
      </ul>
    </div>
  );
}

export function StatTotals({ totals, bonuses, gd }: { totals: StatTotal[]; bonuses: Record<string, number>; gd: GameData }) {
  const bonusRows = Object.entries(bonuses).sort((a, b) => b[1] - a[1]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Running totals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {totals.length === 0 && bonusRows.length === 0 && <p className="text-sm text-faint">Pick nodes to see what they add up to.</p>}
        {totals.length > 0 && (
          <ul className="max-h-64 space-y-0.5 overflow-y-auto pr-1 text-sm" aria-label="Stat totals">
            {totals.map((t) => (
              <li key={`${t.stat}|${t.unit}`} className="flex justify-between gap-3">
                <span className="text-dim">{t.stat}</span>
                <span className="tabular-nums text-gold">{formatEffect(t.value, t.unit)}</span>
              </li>
            ))}
          </ul>
        )}
        {bonusRows.length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">Skill ranks</h4>
            <ul className="space-y-0.5 text-sm" aria-label="Skill rank bonuses">
              {bonusRows.map(([k, v]) => (
                <li key={k} className="flex justify-between gap-3">
                  <span className="text-dim">{gd.skills[k]?.name ?? k}</span>
                  <span className="tabular-nums text-gold">+{v}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
