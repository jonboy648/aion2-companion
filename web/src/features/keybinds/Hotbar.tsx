import { Fragment, useMemo, useState } from "react";
import { ImageOff, Pin, PinOff, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GameData, IconUrls, Region, SlotStack } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SkillIcon } from "./SkillIcon";
import "./compact-hotbar.css";

export const KEY_ROWS: string[][] = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

const nameOf = (gd: GameData | null, key: string) => gd?.skills[key]?.name ?? key;

function KeyCap({
  label,
  stack,
  pinned,
  selected,
  icons,
  gd,
  onClick,
}: {
  label: string;
  stack: string[];
  pinned: boolean;
  selected: boolean;
  icons: IconUrls;
  gd: GameData | null;
  onClick: () => void;
}) {
  const filled = stack.length > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Key ${label}: ${filled ? stack.map((s) => nameOf(gd, s)).join(", then ") : "empty"}`}
      className={cn(
        "flex shrink-0 flex-col items-center text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan",
        "h-[164px] w-[46px] gap-1 rounded-md border p-1",
        selected ? "border-gold bg-surface3 shadow-[0_0_0_1px_var(--gold)]" : "border-border bg-surface2 hover:border-gold-lo hover:bg-surface3",
        !filled && !selected && "border-dashed bg-surface/60",
      )}
    >
      <span className="flex h-4 w-full items-center justify-between text-[11px] font-semibold text-gold">
        {label}
        {pinned && <Pin aria-hidden className="size-3 text-cyan" />}
      </span>
      <span className="grid w-full gap-0.5" style={{ gridTemplateRows: "repeat(4, 32px)" }}>
        {[3, 2, 1, 0].map((priority) => {
          const skill = stack[priority];
          return (
            <span
              key={priority}
              data-priority={priority}
              data-skill={skill ?? ""}
              title={`Priority ${priority}: ${skill ? nameOf(gd, skill) : "empty"}`}
              className={cn(
                "relative grid place-items-center border",
                "h-8 w-full rounded-sm",
                skill ? "border-border-soft bg-surface" : "border-dashed border-border-soft/60 bg-surface/40",
                priority === 0 && skill && "border-gold-lo",
              )}
            >
              {skill && <SkillIcon url={icons[skill]} name={nameOf(gd, skill)} size={28} rarity="common" />}
              <span aria-hidden className={cn("absolute bottom-0 right-0 bg-surface/90 px-0.5 text-[8px] leading-tight", priority === 0 ? "text-gold" : "text-faint")}>
                {priority}
              </span>
            </span>
          );
        })}
      </span>
    </button>
  );
}

function CompactQuickslot({
  skill,
  name,
  url,
  rank,
  label,
  row,
  selected,
  onClick,
}: {
  skill: string;
  name: string;
  url: string | null | undefined;
  rank: number | undefined;
  label: string;
  row: number;
  selected: boolean;
  onClick: () => void;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const description = `${name}, rank ${rank ?? "unknown"}, key ${label}, row ${row}`;
  return (
    <button
      type="button"
      aria-label={description}
      aria-pressed={selected}
      title={description}
      data-key={label}
      data-row={row}
      data-skill={skill}
      onClick={onClick}
      className="compact-hotbar-cell"
    >
      {url && failedUrl !== url ? (
        <img src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
      ) : (
        <ImageOff aria-hidden className="compact-hotbar-icon-fallback" />
      )}
      {rank !== undefined && <span aria-hidden className="compact-hotbar-rank">{rank}</span>}
    </button>
  );
}

export function Hotbar({
  gd,
  icons,
  stacks,
  pins,
  selected,
  onSelect,
  compact = false,
  manualSkills = [],
  macroKeys = [],
  ranks = {},
}: {
  gd: GameData | null;
  icons: IconUrls;
  stacks: SlotStack[];
  pins: Record<string, string>;
  selected: string;
  onSelect: (label: string) => void;
  compact?: boolean;
  manualSkills?: string[];
  macroKeys?: string[];
  /** Effective skill ranks (paid plus bonus), used only by the compact grid. */
  ranks?: Record<string, number>;
}) {
  const byLabel = useMemo(() => Object.fromEntries(stacks.map((s) => [s.key_label, s.stack])), [stacks]);
  const letterUsed = [...stacks.map((s) => s.key_label), ...Object.keys(pins)].some((l) => /^[A-Z]$/.test(l));
  const [showLetters, setShowLetters] = useState(false);
  const rows = showLetters || letterUsed ? KEY_ROWS : KEY_ROWS.slice(0, 1);
  if (compact) {
    const groups = [KEY_ROWS[0].slice(0, 4), KEY_ROWS[0].slice(4, 8), KEY_ROWS[0].slice(8, 12)];
    const stackFor = (label: string) => byLabel[label] ?? (pins[label] ? [pins[label]] : []);
    const keyName = (label: string) => `Key ${label}: ${stackFor(label).map((skill) => nameOf(gd, skill)).join(", then ") || "empty"}`;
    const modeFor = (label: string) => {
      const stack = stackFor(label);
      return stack.some((skill) => manualSkills.includes(skill)) ? "manual" : stack.length > 0 && macroKeys.includes(label) ? "macro" : "unused";
    };
    const extraLabels = [...new Set([...stacks.map((s) => s.key_label), ...Object.keys(pins)])]
      .filter((label) => !KEY_ROWS[0].includes(label));
    return (
      <div className="compact-hotbar">
        <div role="region" aria-label="Quickslot keys" className="compact-hotbar-grid">
          {groups.map((labels, group) => (
            <Fragment key={group}>
              <div role="group" aria-label={`Quickslot group ${group + 1}`} className="compact-hotbar-group">
                {[3, 2, 1, 0].flatMap((row) => labels.map((label) => {
                  const skill = stackFor(label)[row];
                  return skill ? (
                    <CompactQuickslot
                      key={`${label}-${row}`}
                      skill={skill}
                      name={nameOf(gd, skill)}
                      url={icons[skill]}
                      rank={ranks[skill]}
                      label={label}
                      row={row}
                      selected={selected === label}
                      onClick={() => onSelect(label)}
                    />
                  ) : (
                    <div key={`${label}-${row}`} aria-hidden data-key={label} data-row={row} data-skill="" className="compact-hotbar-cell compact-hotbar-cell-empty" />
                  );
                }))}
                {labels.map((label) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={selected === label}
                    aria-label={keyName(label)}
                    title={`${keyName(label)}${label in pins ? " (pinned)" : ""}`}
                    data-mode={modeFor(label)}
                    onClick={() => onSelect(label)}
                    className="compact-hotbar-key-label"
                  >
                    {label}
                  </button>
                ))}
              </div>
              {group < groups.length - 1 && <div aria-hidden className="compact-hotbar-spacer" />}
            </Fragment>
          ))}
          <div role="group" aria-label="Quickslot rows" className="compact-hotbar-row-labels">
            {[3, 2, 1, 0].map((row) => <span key={row}>{row}</span>)}
          </div>
        </div>
        {extraLabels.length > 0 && (
          <div className="compact-hotbar-extra" role="group" aria-label="Other assigned keys">
            {extraLabels.map((label) => {
              const stack = byLabel[label] ?? (pins[label] ? [pins[label]] : []);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={selected === label}
                  aria-label={keyName(label)}
                  title={keyName(label)}
                  onClick={() => onSelect(label)}
                >
                  <kbd className="compact-hotbar-key-label" data-mode={modeFor(label)}>{label}</kbd>
                  <span>{stack.map((skill) => nameOf(gd, skill)).join(", then ") || "No skills assigned"}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="min-w-0 max-w-full">
      <div role="region" aria-label="Quickslot keys" tabIndex={0} className="max-w-full overflow-x-auto overscroll-x-contain pb-2 focus-visible:outline-2 focus-visible:outline-cyan">
        <div className="flex w-max gap-3 p-1">
          {rows.map((row, r) => (
            <div key={r} className="flex shrink-0 gap-1.5">
              {row.map((label) => (
                <KeyCap
                  key={label}
                  label={label}
                  stack={byLabel[label] ?? (pins[label] ? [pins[label]] : [])}
                  pinned={label in pins}
                  selected={selected === label}
                  icons={icons}
                  gd={gd}
                  onClick={() => onSelect(label)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {!letterUsed && (
        <button
          type="button"
          onClick={() => setShowLetters((v) => !v)}
          className="mt-2 text-xs text-cyan underline-offset-2 hover:underline"
        >
          {showLetters ? "Hide letter keys" : "Show letter keys (Q-P, A-L, Z-M)"}
        </button>
      )}
    </div>
  );
}

/** Detail + pin editor for the selected key. */
export function SlotEditor({
  gd,
  icons,
  label,
  stack,
  pinnedSkill,
  pins,
  level,
  region = "global",
  stigmas,
  onPin,
  onUnpin,
  note,
}: {
  gd: GameData | null;
  icons: IconUrls;
  label: string;
  stack: string[];
  pinnedSkill: string | undefined;
  pins: Record<string, string>;
  level: number;
  region?: Region;
  /** Equipped stigmas, when the caller has the active build available. */
  stigmas?: readonly string[];
  onPin: (skillKey: string) => void;
  onUnpin: () => void;
  /** engine slot_notes entry: why this stack is ordered this way */
  note?: string;
}) {
  const [q, setQ] = useState("");
  const pickable = useMemo(() => {
    if (!gd) return [];
    const needle = q.trim().toLowerCase();
    return Object.values(gd.skills)
      .filter((s) => (s.kind === "active" || s.kind === "stigma" || s.kind === "dodge") && (s.unlock_level ?? 0) <= level)
      .filter((s) => s.regions.includes(region))
      .filter((s) => s.kind !== "stigma" || stigmas === undefined || stigmas.includes(s.key))
      .filter((s) => !needle || s.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [gd, q, level, region, stigmas]);
  const pinnedElsewhere = (key: string) => Object.entries(pins).find(([l, s]) => s === key && l !== label)?.[0];

  return (
    <div className="ornate p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-8 place-items-center rounded-md border border-gold-lo bg-gold/10 text-sm font-semibold text-gold">{label}</span>
        <h3 className="text-[15px] font-semibold">Key {label}</h3>
        {pinnedSkill ? <Badge tone="info">pinned: {nameOf(gd, pinnedSkill)}</Badge> : <Badge>planner's choice</Badge>}
        {pinnedSkill && (
          <Button variant="ghost" size="sm" onClick={onUnpin} className="ml-auto">
            <PinOff /> Unpin
          </Button>
        )}
      </div>

      {/* Drawn like the in-game column: the BOTTOM cell is priority 0 and fires first. */}
      <ol className="mt-3 flex flex-col-reverse gap-1.5">
        {stack.length === 0 && <li className="text-sm text-faint">Nothing planned here. Pin a skill below to keep it on this key.</li>}
        {stack.map((s, i) => (
          <li key={s} className="flex items-center gap-2.5 text-sm">
            <span className="w-4 text-right text-xs text-faint">{i}</span>
            <SkillIcon url={icons[s]} name={nameOf(gd, s)} size={32} />
            <span className="font-medium">{nameOf(gd, s)}</span>
            <span className="text-xs text-faint">
              {i === 0 ? "bottom cell: fires first when usable" : i === stack.length - 1 && stack.length > 1 ? "top cell: last resort" : ""}
            </span>
          </li>
        ))}
      </ol>

      {note && (
        <p className="mt-3 text-xs text-dim" data-testid="slot-note">
          {note}
        </p>
      )}

      <div className="mt-4 border-t border-border-soft pt-3">
        <label className="flex items-center gap-2 game-input px-2.5 text-sm focus-within:border-gold">
          <Search aria-hidden className="size-4 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Pin a skill to key ${label}`}
            aria-label={`Search skills to pin to key ${label}`}
            className="h-9 min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-faint"
          />
        </label>
        <div className="mt-2 grid max-h-52 grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {pickable.map((s) => {
            const other = pinnedElsewhere(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onPin(s.key)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-surface3 focus-visible:outline-2 focus-visible:outline-cyan",
                  pinnedSkill === s.key ? "border-gold bg-surface3" : "border-border-soft bg-surface2",
                )}
              >
                <SkillIcon url={icons[s.key]} name={s.name} size={24} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                {other && <span className="text-[11px] text-faint">on {other}</span>}
              </button>
            );
          })}
          {pickable.length === 0 && <p className="col-span-full py-2 text-sm text-faint">No unlocked skill matches "{q}".</p>}
        </div>
      </div>
    </div>
  );
}
