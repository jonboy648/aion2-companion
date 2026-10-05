import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { ClassEmblem } from "@/components/game/ClassEmblem";
import { IconFrame, rarityOf } from "@/components/game/IconFrame";
import { XpBar } from "@/components/game/XpBar";
import { SkillIcon } from "@/features/build/SkillIcon";
import type { ClassData } from "@/features/build/useClassData";
import { fmtDps, skillName, slotLabel } from "@/features/build/helpers";
import type { ArmoryExtras } from "@/lib/armory";
import type { CompareResult, GearItem, ImportResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { better, boardRows, fmtDiff, gearRows, pctDiff, rankRows, stigmaRows, type Side, type Winner } from "./logic";

export interface SideData {
  imp: ImportResult;
  extras: ArmoryExtras | null;
  cmp: CompareResult | null;
  data: ClassData;
}

/** Cell wrapper: the winning side gets a green edge, a marker and screen-reader text. */
function Cell({ win, children, className }: { win?: boolean; children: ReactNode; className?: string }) {
  return (
    <div data-better={win ? "true" : undefined} className={cn("frame relative min-w-0 px-2 py-1.5", win && "border-ok/70 bg-ok/10 shadow-[inset_3px_0_0_rgb(var(--ok,80_200_140)/0.9)]", className)}>
      {win && <span className="sr-only">Better. </span>}
      {children}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6" aria-label={title}>
      <h2 className="mb-2 flex flex-wrap items-baseline gap-x-3 text-sm font-semibold uppercase tracking-wide text-faint">
        {title}
        {note && <span className="text-[11px] font-normal normal-case tracking-normal">{note}</span>}
      </h2>
      {children}
    </section>
  );
}

const Pair = ({ label, children }: { label?: ReactNode; children: ReactNode }) => (
  <div className="mb-1.5">
    {label && <div className="mb-0.5 text-center text-[11px] text-faint">{label}</div>}
    <div className="grid grid-cols-2 gap-1.5 sm:gap-3">{children}</div>
  </div>
);

function Headline({ label, a, b, fmt, estimated }: { label: string; a: number | null; b: number | null; fmt: (n: number) => string; estimated?: boolean }) {
  const w = better(a, b);
  const d = pctDiff(a, b);
  return (
    <Pair
      label={
        <>
          {label}
          {estimated && <Badge tone="warn" className="ml-2 align-middle">estimated</Badge>}
          {d && w !== "tie" && <span className="ml-2 text-dim">({d} for the right side)</span>}
        </>
      }
    >
      {[a, b].map((v, i) => (
        <Cell key={i} win={w === (i === 0 ? "a" : "b")}>
          <span className="font-display text-xl font-bold text-gold">{v != null ? fmt(v) : "n/a"}</span>
        </Cell>
      ))}
    </Pair>
  );
}

function GearCell({ g, url, win }: { g?: GearItem; url?: string; win: boolean }) {
  if (!g) {
    return (
      <Cell className="flex items-center text-sm text-faint">
        <span>Empty</span>
      </Cell>
    );
  }
  return (
    <Cell win={win}>
      <div className="flex min-w-0 items-center gap-2">
        <IconFrame url={url} name={slotLabel(g.slot)} size={36} rarity={rarityOf(g.grade)} alt="" title={`${g.grade} ${g.name}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] sm:text-[13px]" title={`${g.name} (${g.grade})`}>
            {g.name}
          </div>
          <div className="flex flex-wrap gap-1">
            {g.enchant > 0 && <Badge tone="gold" className="px-1 py-0 text-[10px]">+{g.enchant}</Badge>}
            {g.exceed > 0 && <Badge tone="info" className="px-1 py-0 text-[10px]">E{g.exceed}</Badge>}
            <span className="text-[10px] text-faint">{g.grade}</span>
          </div>
        </div>
      </div>
    </Cell>
  );
}

const winnerOf = (w: Winner, s: Side) => w === s;

/** Side-by-side comparison of two imported characters. Left = A, right = B. */
export function CompareView({ a, b, onCopy }: { a: SideData; b: SideData; onCopy: (from: Side) => void }) {
  const A = a.imp;
  const B = b.imp;
  const sameClass = A.build.class_key === B.build.class_key;
  const gear = gearRows(A.gear, B.gear);
  const stigmas = stigmaRows(A.stigmas, B.stigmas);
  const ranks = rankRows(A.build.skill_ranks, B.build.skill_ranks);
  const boards = boardRows(A.daevanion_summary.boards, B.daevanion_summary.boards);
  const dpsA = a.cmp ? (a.cmp.boss.current_dps ?? a.cmp.boss.result.dps) : null;
  const dpsB = b.cmp ? (b.cmp.boss.current_dps ?? b.cmp.boss.result.dps) : null;
  const gearWins = (s: Side) => gear.filter((r) => r.winner === s).length;

  const head = (s: Side, d: SideData) => (
    <div className="min-w-0 px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <ClassEmblem classKey={d.imp.profile.class_key} size={22} />
        <strong className="truncate text-gold">{d.imp.profile.name}</strong>
      </div>
      <div className="truncate text-[11px] text-dim">
        {d.imp.profile.class_name} - Lv {d.imp.profile.level ?? "?"} - {d.imp.profile.server}
      </div>
      <button type="button" onClick={() => onCopy(s)} className="game-tab mt-1 px-2 py-0.5 text-[11px]" aria-label={`Copy ${d.imp.profile.name}'s build`}>
        Copy their build
      </button>
    </div>
  );

  return (
    <div data-testid="compare-view">
      <div data-compare-bar className="sticky z-10 -mx-4 border-b border-border-soft bg-bg/95 px-4 backdrop-blur" style={{ top: "var(--nav-h, 0px)" }}>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
          {head("a", a)}
          {head("b", b)}
        </div>
      </div>

      <Section title="Overview">
        <Headline label="Level" a={A.profile.level} b={B.profile.level} fmt={String} />
        <Headline label="Combat power" a={A.profile.combat_power} b={B.profile.combat_power} fmt={fmtDps} />
        <Headline label="Item level" a={A.profile.item_level} b={B.profile.item_level} fmt={String} />
        <Headline label="Boss DPS (current build)" a={dpsA} b={dpsB} fmt={fmtDps} estimated />
        {(dpsA == null || dpsB == null) && <p className="text-center text-xs text-dim">Estimating boss DPS with the engine...</p>}
      </Section>

      <Section title="Gear" note={`Per slot: grade, then enchant, then exceed. Left wins ${gearWins("a")}, right wins ${gearWins("b")}.`}>
        {gear.map((r) => (
          <Pair key={r.slot} label={slotLabel(r.slot)}>
            <GearCell g={r.a} url={a.extras?.gearIcons[r.slot]} win={winnerOf(r.winner, "a")} />
            <GearCell g={r.b} url={b.extras?.gearIcons[r.slot]} win={winnerOf(r.winner, "b")} />
          </Pair>
        ))}
      </Section>

      <Section title="Stigmas">
        {stigmas.length === 0 && <p className="text-sm text-dim">Neither character has stigmas equipped.</p>}
        {stigmas.map((r) => {
          const w = r.a && r.b ? better(r.a.rank, r.b.rank) : "tie";
          const cell = (s: Side, d: SideData) => {
            const st = s === "a" ? r.a : r.b;
            return st ? (
              <Cell win={w === s}>
                <div className="flex min-w-0 items-center gap-2">
                  <SkillIcon name={st.name} url={st.key ? d.data.icons[st.key] : null} size={32} rarity="rare" />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] sm:text-[13px]">{st.name}</span>
                    <span className="text-[11px] text-dim">Rank {st.rank}</span>
                  </span>
                </div>
              </Cell>
            ) : (
              <Cell className="text-sm text-faint">Not equipped</Cell>
            );
          };
          return (
            <Pair key={r.name}>
              {cell("a", a)}
              {cell("b", b)}
            </Pair>
          );
        })}
      </Section>

      <Section title="Skill ranks" note={sameClass ? "Difference is right minus left." : undefined}>
        {!sameClass ? (
          <p className="text-sm text-dim">
            {A.profile.class_name} and {B.profile.class_name} have different skills, so ranks are not comparable.
          </p>
        ) : (
          <div className="frame overflow-hidden">
            <table className="w-full text-sm" aria-label="Skill rank differences">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-2 py-1.5 font-medium">Skill</th>
                  <th className="w-12 px-1 py-1.5 text-right font-medium">{A.profile.name.slice(0, 6)}</th>
                  <th className="w-12 px-1 py-1.5 text-right font-medium">{B.profile.name.slice(0, 6)}</th>
                  <th className="w-14 px-2 py-1.5 text-right font-medium">Diff</th>
                </tr>
              </thead>
              <tbody>
                {ranks.map((r) => (
                  <tr key={r.key} data-diff={r.diff} className={cn("border-t border-border-soft", r.diff === 0 && "text-dim")}>
                    <td className="px-2 py-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <SkillIcon name={skillName(a.data.gd?.skills, r.key)} url={a.data.icons[r.key]} size={24} rarity="common" />
                        <span className="truncate">{skillName(a.data.gd?.skills, r.key)}</span>
                      </span>
                    </td>
                    <td className={cn("px-1 py-1 text-right tabular-nums", r.diff < 0 && "font-semibold text-ok")}>{r.a}</td>
                    <td className={cn("px-1 py-1 text-right tabular-nums", r.diff > 0 && "font-semibold text-ok")}>{r.b}</td>
                    <td className={cn("px-2 py-1 text-right tabular-nums", r.diff > 0 ? "text-info" : r.diff < 0 ? "text-warn" : "")}>{fmtDiff(r.diff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Daevanion">
        {boards.map((r) => {
          const w = r.a && r.b ? better(r.a.matched, r.b.matched) : "tie";
          const cell = (s: Side) => {
            const x = s === "a" ? r.a : r.b;
            return x ? (
              <Cell win={w === s}>
                <XpBar small value={x.matched} max={x.open} label={`${r.board} nodes`} />
                <div className="mt-1 text-[11px] tabular-nums text-dim">
                  {x.matched}/{x.open} nodes
                </div>
              </Cell>
            ) : (
              <Cell className="text-sm text-faint">No open nodes</Cell>
            );
          };
          return (
            <Pair key={r.board} label={r.board}>
              {cell("a")}
              {cell("b")}
            </Pair>
          );
        })}
      </Section>
    </div>
  );
}
