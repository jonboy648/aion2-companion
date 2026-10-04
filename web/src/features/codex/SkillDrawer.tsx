import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GameData, Skill } from "@/lib/types";
import { KIND_LABEL, skillLinks } from "./logic";
import { ConfidenceBadge, ElementDot, NumCell, SkillIcon } from "./parts";

interface Props {
  skill: Skill;
  gd: GameData;
  icons: Record<string, string | null>;
  onClose: () => void;
  onSelect: (key: string) => void;
}

/** Slide-in detail drawer: stats, per-rank table, chain, charge levels, specializations. */
export function SkillDrawer({ skill, gd, icons, onClose, onSelect }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const rule = gd.rules[skill.key];
  const { parents, children } = skillLinks(gd, skill.key);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const nameOf = (k: string) => gd.skills[k]?.name ?? k;
  const linkBtn = (k: string) =>
    gd.skills[k] ? (
      <button key={k} className="text-cyan underline-offset-2 hover:underline" onClick={() => onSelect(k)}>
        {nameOf(k)}
      </button>
    ) : (
      <span key={k}>{k}</span>
    );

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${skill.name} details`}
        className="absolute inset-y-0 right-0 flex w-full max-w-[480px] flex-col border-l border-border bg-surface shadow-2xl"
      >
        <header className="flex items-start gap-3 border-b border-border-soft p-4">
          <SkillIcon url={icons[skill.key]} name={skill.name} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight">{skill.name}</h2>
            {skill.name_kr && <p className="text-xs text-faint">{skill.name_kr}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone="gold">{KIND_LABEL[skill.kind]}</Badge>
              <ElementDot element={skill.element} />
              {skill.unlock_level != null && <Badge>Lv {skill.unlock_level}</Badge>}
              {!skill.regions.includes("global") && <Badge tone="warn">KR only</Badge>}
            </div>
          </div>
          <Button ref={closeRef} variant="ghost" size="icon" onClick={onClose} aria-label="Close details">
            <X />
          </Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
          {skill.description && <p className="leading-relaxed text-dim">{skill.description}</p>}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <Stat label="Max rank" value={String(skill.max_rank)} />
            <Stat label="Range" value={skill.range_m ? `${skill.range_m} m` : "-"} />
            <Stat label="Targets" value={String(skill.aoe_targets)} />
            <Stat label="Hits" value={String(skill.hits)} />
            <Stat label="Attack ratio" value={<NumCell n={skill.atk_ratio_pct} unit="%" />} />
            <Stat label="Animation lock" value={<NumCell n={skill.anim_lock_s} unit="s" />} />
          </dl>

          {skill.ranks.length > 0 && (
            <section aria-label="Rank table">
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">Ranks</h3>
              <div className="overflow-x-auto rounded-md border border-border-soft">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface2 text-faint">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Rank</th>
                      <th className="px-2 py-1.5 font-medium">Damage</th>
                      <th className="px-2 py-1.5 font-medium">Cooldown</th>
                      <th className="px-2 py-1.5 font-medium">MP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skill.ranks.map((r) => (
                      <tr key={r.rank} className="border-t border-border-soft odd:bg-bg/30">
                        <td className="px-2 py-1.5 tabular-nums">{r.rank}</td>
                        <td className="px-2 py-1.5">
                          {r.flat_min.value == null && r.flat_max.value == null ? (
                            <NumCell n={r.flat_min} />
                          ) : (
                            <>
                              <NumCell n={r.flat_min} digits={0} /> - <NumCell n={r.flat_max} digits={0} />
                            </>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <NumCell n={r.cooldown_s} unit="s" />
                        </td>
                        <td className="px-2 py-1.5">
                          <NumCell n={r.mp_cost} digits={0} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
                <ConfidenceBadge confidence="confirmed" /> client data
                <ConfidenceBadge confidence="estimated" /> best guess
                <ConfidenceBadge confidence="unknown" /> not known
              </p>
            </section>
          )}

          {(parents.length > 0 || children.length > 0 || rule?.chain_next) && (
            <section aria-label="Chains and links">
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">Chains</h3>
              <ul className="space-y-1">
                {parents.map((l) => (
                  <li key={`p-${l.parent_key}-${l.kind}`} className="flex flex-wrap items-center gap-1.5">
                    <span className="text-dim">After</span> {linkBtn(l.parent_key)} <Badge>{l.kind}</Badge>
                    <ConfidenceBadge confidence={l.confidence} />
                  </li>
                ))}
                {children.map((l) => (
                  <li key={`c-${l.child_key}-${l.kind}`} className="flex flex-wrap items-center gap-1.5">
                    <span className="text-dim">Leads to</span> {linkBtn(l.child_key)} <Badge>{l.kind}</Badge>
                    <ConfidenceBadge confidence={l.confidence} />
                  </li>
                ))}
              </ul>
              {rule && rule.chain_next && <p className="mt-1 text-xs text-dim">Chain window {rule.chain_window_s} s.</p>}
            </section>
          )}

          {rule && (rule.applies.length > 0 || rule.requires.length > 0 || rule.consumes.length > 0 || rule.mp_restore > 0 || rule.note) && (
            <section aria-label="Effects">
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">Effects</h3>
              <ul className="space-y-1 text-dim">
                {rule.applies.length > 0 && <li>Applies: {rule.applies.map((k) => gd.statuses[k]?.name ?? k).join(", ")}</li>}
                {rule.requires.length > 0 && <li>Requires: {rule.requires.map((k) => gd.statuses[k]?.name ?? k).join(", ")}</li>}
                {rule.consumes.length > 0 && <li>Consumes: {rule.consumes.map((k) => gd.statuses[k]?.name ?? k).join(", ")}</li>}
                {rule.mp_restore > 0 && <li>Restores {rule.mp_restore} MP</li>}
                {rule.note && <li className="text-xs text-faint">{rule.note}</li>}
              </ul>
              <div className="mt-1">
                <ConfidenceBadge confidence={rule.confidence} />
              </div>
            </section>
          )}

          {rule && rule.charge_levels.length > 0 && (
            <section aria-label="Charge levels">
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">Charge levels</h3>
              <ul className="space-y-0.5">
                {rule.charge_levels.map((c) => (
                  <li key={c.level} className="flex justify-between gap-3">
                    <span className="text-dim">Level {c.level}</span>
                    <span>
                      <NumCell n={c.charge_s} unit="s" /> charge, <NumCell n={c.dmg_mult} unit="x" digits={2} /> damage
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {skill.specializations.length > 0 && (
            <section aria-label="Specializations">
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-faint">Specializations</h3>
              <ul className="space-y-1.5">
                {skill.specializations.map((s, i) => (
                  <li key={i} className="frame px-2.5 py-1.5">
                    {s.rank_required != null && <Badge tone="info" className="mr-2">Rank {s.rank_required}</Badge>}
                    <span className="text-dim">{s.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {skill.tags.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border-soft/60 pb-1">
      <dt className="text-dim">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
