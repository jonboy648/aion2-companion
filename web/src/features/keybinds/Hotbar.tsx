import { useMemo, useState } from "react";
import { Pin, PinOff, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GameData, IconUrls, SlotStack } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SkillIcon } from "./SkillIcon";

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
        "relative flex min-h-[88px] flex-col items-center gap-1 rounded-lg border p-1.5 pt-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan",
        selected ? "border-gold bg-surface3 shadow-[0_0_0_1px_var(--gold)]" : "border-border bg-surface2 hover:border-gold-lo hover:bg-surface3",
        !filled && !selected && "border-dashed bg-surface/60",
      )}
    >
      <span className="absolute left-1.5 top-1 text-[11px] font-semibold tracking-wide text-gold">{label}</span>
      {pinned && <Pin aria-hidden className="absolute right-1.5 top-1 size-3 text-cyan" />}
      {filled ? (
        <span className="grid grid-cols-2 gap-0.5">
          {stack.slice(0, 4).map((s, i) => (
            <span key={s} className="relative" title={`${i + 1}. ${nameOf(gd, s)}`}>
              <SkillIcon url={icons[s]} name={nameOf(gd, s)} size={26} />
              <span className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full bg-bg/90 text-[9px] leading-none text-dim">
                {i + 1}
              </span>
            </span>
          ))}
        </span>
      ) : (
        <span className="mt-2 text-[11px] text-faint">empty</span>
      )}
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
}: {
  gd: GameData | null;
  icons: IconUrls;
  stacks: SlotStack[];
  pins: Record<string, string>;
  selected: string;
  onSelect: (label: string) => void;
}) {
  const byLabel = useMemo(() => Object.fromEntries(stacks.map((s) => [s.key_label, s.stack])), [stacks]);
  const letterUsed = [...stacks.map((s) => s.key_label), ...Object.keys(pins)].some((l) => /^[A-Z]$/.test(l));
  const [showLetters, setShowLetters] = useState(false);
  const rows = showLetters || letterUsed ? KEY_ROWS : KEY_ROWS.slice(0, 1);
  return (
    <div>
      <div className="space-y-2">
        {rows.map((row, r) => (
          <div
            key={r}
            style={{ "--n": row.length } as React.CSSProperties}
            className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]"
          >
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
  onPin,
  onUnpin,
}: {
  gd: GameData | null;
  icons: IconUrls;
  label: string;
  stack: string[];
  pinnedSkill: string | undefined;
  pins: Record<string, string>;
  level: number;
  onPin: (skillKey: string) => void;
  onUnpin: () => void;
}) {
  const [q, setQ] = useState("");
  const pickable = useMemo(() => {
    if (!gd) return [];
    const needle = q.trim().toLowerCase();
    return Object.values(gd.skills)
      .filter((s) => (s.kind === "active" || s.kind === "stigma" || s.kind === "dodge") && (s.unlock_level ?? 0) <= level)
      .filter((s) => !needle || s.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [gd, q, level]);
  const pinnedElsewhere = (key: string) => Object.entries(pins).find(([l, s]) => s === key && l !== label)?.[0];

  return (
    <div className="rounded-lg border border-border-soft bg-surface p-4">
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

      <ol className="mt-3 space-y-1.5">
        {stack.length === 0 && <li className="text-sm text-faint">Nothing planned here. Pin a skill below to keep it on this key.</li>}
        {stack.map((s, i) => (
          <li key={s} className="flex items-center gap-2.5 text-sm">
            <span className="w-4 text-right text-xs text-faint">{i + 1}</span>
            <SkillIcon url={icons[s]} name={nameOf(gd, s)} size={32} />
            <span className="font-medium">{nameOf(gd, s)}</span>
            <span className="text-xs text-faint">{i === 0 ? "fires first when usable" : i === stack.length - 1 && stack.length > 1 ? "fallback" : ""}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 border-t border-border-soft pt-3">
        <label className="flex items-center gap-2 rounded-md border border-border bg-bg px-2.5 text-sm focus-within:border-gold">
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
