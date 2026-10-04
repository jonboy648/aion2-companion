import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { daevanionSuggest } from "@/engine/api";
import type { CharacterBuild, DaevanionNode, DaevanionSuggestion, GameData, IconUrls, ImportResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BoardSvg } from "./BoardSvg";
import { ART } from "./art";
import { NodeDetail, StatTotals } from "./Panels";
import { SuggestCard } from "./SuggestCard";
import {
  boardSelection,
  boardTotal,
  boardUnlocked,
  nodeIndex,
  nodeState,
  plannerBuild,
  pointsSpent,
  removable,
  selectable,
  skillBonuses,
  statTotals,
} from "./logic";

export interface PlannerProps {
  gd: GameData;
  icons: IconUrls;
  imp: ImportResult | null;
  classes: { key: string; name: string }[];
  hasCharacter: boolean;
  onClass: (key: string) => void;
}

const selectCls =
  "h-9 game-input px-3 text-sm text-foreground ";

export function Planner({ gd, icons, imp, classes, hasCharacter, onClass }: PlannerProps) {
  const boardKeys = useMemo(() => Object.keys(gd.daevanion), [gd]);
  const idx = useMemo(() => nodeIndex(gd), [gd]);
  const imported = useMemo(() => new Set((imp?.build.daevanion_nodes ?? []).filter((n) => idx.has(n))), [imp, idx]);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(imported));
  const [level, setLevel] = useState<number>(imp?.build.level ?? gd.level_caps.global ?? 55);
  const [active, setActive] = useState(boardKeys[0]);
  const [hover, setHover] = useState<DaevanionNode | null>(null);
  const [note, setNote] = useState("");
  const [budget, setBudget] = useState(12);
  const [running, setRunning] = useState(false);
  const [sugErr, setSugErr] = useState<string | null>(null);
  const [sug, setSug] = useState<DaevanionSuggestion | null>(null);

  const board = gd.daevanion[active];
  const locked = !boardUnlocked(board, level);
  const avail = useMemo(() => (locked ? new Set<number>() : selectable(board, selected)), [board, selected, locked]);
  const totals = useMemo(() => statTotals(gd, selected), [gd, selected]);
  const bonuses = useMemo(() => skillBonuses(gd, selected), [gd, selected]);
  const spent = useMemo(() => pointsSpent(gd, selected), [gd, selected]);
  const suggested = useMemo(() => new Set(sug?.path ?? []), [sug]);

  const toggle = useCallback(
    (n: DaevanionNode) => {
      if (n.id === board.start_id) return;
      if (locked) return setNote(`${board.name} unlocks at level ${board.unlock_level}.`);
      if (selected.has(n.id)) {
        if (!removable(board, selected, n.id)) return setNote("Drop the nodes beyond this one first, they connect through it.");
        const next = new Set(selected);
        next.delete(n.id);
        setSelected(next);
        setNote("");
      } else if (avail.has(n.id)) {
        setSelected(new Set(selected).add(n.id));
        setNote("");
      } else return setNote("Not reachable yet: pick a node next to your path or the start.");
      setSug(null);
    },
    [board, selected, avail, locked],
  );

  const build: CharacterBuild = useMemo(
    () => (imp ? { ...imp.build, level, daevanion_nodes: [...selected] } : plannerBuild(gd, level, selected)),
    [imp, gd, level, selected],
  );

  const runSuggest = async () => {
    setRunning(true);
    setSugErr(null);
    try {
      setSug(await daevanionSuggest(build, budget));
    } catch (e) {
      setSugErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const applyPath = () => {
    if (!sug) return;
    const next = new Set(selected);
    for (const id of sug.path) {
      const b = gd.daevanion[idx.get(id)?.board ?? ""];
      if (b && selectable(b, next).has(id)) next.add(id);
    }
    setSelected(next);
    setSug(null);
    setNote("");
  };

  const clearAll = () => {
    setSelected(new Set());
    setSug(null);
  };

  const hoverState = hover ? nodeState(board, selected, avail, hover.id) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-x-4 gap-y-2 pt-4">
            {imp ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone="gold">{imp.profile.name}</Badge>
                <span className="text-dim">
                  {imp.profile.class_name} - Lv {imp.build.level} - {imp.daevanion_summary.matched} imported nodes
                </span>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(imported))}>
                  Reset to imported
                </Button>
              </div>
            ) : (
              <label className="flex flex-col gap-1 text-xs text-dim">
                Class
                <select className={selectCls} value={gd.class_key} onChange={(e) => onClass(e.target.value)}>
                  {classes.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs text-dim">
              Level
              <input
                type="number"
                min={1}
                max={99}
                value={level}
                onChange={(e) => setLevel(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                className="h-9 w-20 game-input px-3 text-sm text-foreground "
              />
            </label>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <Badge tone="gold">{spent} pt spent</Badge>
              <Button size="sm" variant="secondary" onClick={clearAll} disabled={selected.size === 0}>
                Clear all
              </Button>
            </div>
          </CardContent>
        </Card>

        <img src={ART.titleDeco} alt="" aria-hidden className="mx-auto block h-5 w-auto max-w-full opacity-80" onError={(e) => (e.currentTarget.style.display = "none")} />
        <div role="tablist" aria-label="Gods" className="flex flex-wrap gap-1.5">
          {boardKeys.map((k) => {
            const b = gd.daevanion[k];
            const lockedTab = !boardUnlocked(b, level);
            return (
              <button
                key={k}
                role="tab"
                aria-selected={k === active}
                onClick={() => {
                  setActive(k);
                  setHover(null);
                  setNote("");
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                  k === active ? "border-gold bg-surface3 text-gold" : "border-border-soft bg-surface text-dim hover:bg-surface2 hover:text-foreground",
                )}
              >
                {lockedTab && <Lock className="size-3.5" aria-label="locked" />}
                <span>{b.name}</span>
                <span className="text-xs tabular-nums text-faint">
                  {boardSelection(b, selected).length}/{boardTotal(b)}
                </span>
              </button>
            );
          })}
        </div>

        <Card className="overflow-hidden">
          {locked && (
            <p className="border-b border-border-soft bg-warn/10 px-4 py-2 text-sm text-warn" role="status">
              {board.name} unlocks at level {board.unlock_level}. You are level {level}.
            </p>
          )}
          <p className="px-4 pt-2 text-xs text-dim sm:hidden">Swipe the board sideways to see all nodes.</p>
          <div className="overflow-x-auto p-2" tabIndex={0} aria-label="Daevanion board, scrollable">
            <BoardSvg
              board={board}
              selected={selected}
              available={avail}
              locked={locked}
              icons={icons}
              suggested={suggested}
              focusId={hover?.id ?? null}
              onToggle={toggle}
              onFocus={setHover}
              classKey={gd.class_key}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-soft px-4 py-2 text-xs text-dim">
            <Legend color="#9aa3b8" label="Common" />
            <Legend color="#4cc38a" label="Rare" />
            <Legend color="#4a9df0" label="Epic" />
            <Legend color="#f0922f" label="Unique" />
            <span className="text-faint">dashed ring = available, glow = learned</span>
            <span className="min-h-4 text-warn" role="status" aria-live="polite">
              {note}
            </span>
          </div>
        </Card>
        {hasCharacter && (
          <p className="text-xs text-faint">
            Showing {imp?.profile.name}'s nodes. <Link to="/daevanion">Open the blank planner</Link>
          </p>
        )}
      </div>

      <aside className="min-w-0 space-y-4">
        <Card>
          <CardContent className="pt-4">
            <NodeDetail node={hover} gd={gd} state={hoverState} />
          </CardContent>
        </Card>
        <SuggestCard
          points={budget}
          onPoints={setBudget}
          running={running}
          error={sugErr}
          suggestion={sug}
          onRun={runSuggest}
          onApply={applyPath}
          onClear={() => setSug(null)}
        />
        <StatTotals totals={totals} bonuses={bonuses} gd={gd} />
      </aside>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block size-2.5 rounded-sm" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}
