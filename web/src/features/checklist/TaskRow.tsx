import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import type { RegionKey } from "../timers/data";
import { formatCountdown } from "../timers/schedule";
import { Input } from "@/components/ui/input";
import { cycleEnd, type Task } from "./model";
import { cn } from "@/lib/utils";

interface Props {
  task: Task;
  count: number;
  now: number;
  region: RegionKey;
  first: boolean;
  last: boolean;
  dragging: boolean;
  onCount: (n: number) => void;
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
  onEdit: (patch: Partial<Pick<Task, "title" | "target" | "note" | "everyDays">>) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
}

const iconBtn =
  "inline-flex size-9 items-center justify-center rounded border border-[var(--border-soft)] bg-transparent text-dim hover:bg-white/5 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent sm:size-8";

/** One task: accessible checkbox, optional run counter, note, reorder and edit controls. */
export function TaskRow({ task, count, now, region, first, last, dragging, onCount, onToggle, onMove, onEdit, onRemove, onDragStart, onDragOver, onDragEnd }: Props) {
  const [editing, setEditing] = useState(false);
  const done = count >= task.target;
  const counter = task.target > 1;
  const checkId = `task-${task.id}`;

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      className={cn("rounded-md border border-[var(--border-soft)] bg-white/[0.02] p-2.5", dragging && "opacity-50", done && "border-ok/40")}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <GripVertical aria-hidden className="hidden size-4 shrink-0 cursor-grab text-faint sm:block" />
        <input
          id={checkId}
          type="checkbox"
          checked={done}
          onChange={onToggle}
          className="size-5 shrink-0 cursor-pointer accent-[var(--gold)]"
        />
        <label htmlFor={checkId} className={cn("min-w-0 flex-1 cursor-pointer text-sm", done && "text-dim line-through")}>
          {task.title}
        </label>
        {counter && (
          <span className="flex items-center gap-1" role="group" aria-label={`${task.title} runs`}>
            <button type="button" className={iconBtn} aria-label={`One fewer for ${task.title}`} disabled={count <= 0} onClick={() => onCount(count - 1)}>
              <Minus aria-hidden className="size-3.5" />
            </button>
            <span className="min-w-[3.25rem] text-center text-sm font-semibold tabular-nums" aria-live="polite">
              {count}/{task.target}
            </span>
            <button type="button" className={iconBtn} aria-label={`One more for ${task.title}`} disabled={done} onClick={() => onCount(count + 1)}>
              <Plus aria-hidden className="size-3.5" />
            </button>
          </span>
        )}
        {task.group === "custom" && (
          <span className="text-xs text-dim tabular-nums">
            every {task.everyDays}d, resets in {formatCountdown(cycleEnd(task, region, now) - now)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <button type="button" className={iconBtn} aria-label={`Move ${task.title} up`} disabled={first} onClick={() => onMove(-1)}>
            <ArrowUp aria-hidden className="size-3.5" />
          </button>
          <button type="button" className={iconBtn} aria-label={`Move ${task.title} down`} disabled={last} onClick={() => onMove(1)}>
            <ArrowDown aria-hidden className="size-3.5" />
          </button>
          <button type="button" className={iconBtn} aria-label={`Edit ${task.title}`} aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
            <Pencil aria-hidden className="size-3.5" />
          </button>
        </span>
      </div>
      {task.note && !editing && <p className="mt-1.5 pl-1 text-xs text-dim sm:pl-7">{task.note}</p>}
      {editing && (
        <div className="mt-2.5 grid gap-2 border-t border-[var(--border-soft)] pt-2.5 sm:grid-cols-[1fr_auto_auto]">
          <label className="text-xs text-dim">
            Name
            <Input defaultValue={task.title} maxLength={120} onChange={(e) => onEdit({ title: e.target.value })} />
          </label>
          <label className="text-xs text-dim">
            Times to do
            <Input type="number" min={1} max={999} defaultValue={task.target} onChange={(e) => e.target.value && onEdit({ target: Number(e.target.value) })} className="sm:w-24" />
          </label>
          {task.group === "custom" && (
            <label className="text-xs text-dim">
              Every (days)
              <Input type="number" min={1} max={365} defaultValue={task.everyDays} onChange={(e) => e.target.value && onEdit({ everyDays: Number(e.target.value) })} className="sm:w-24" />
            </label>
          )}
          <label className="text-xs text-dim sm:col-span-3">
            Note
            <Input defaultValue={task.note} maxLength={500} placeholder="Optional" onChange={(e) => onEdit({ note: e.target.value })} />
          </label>
          <div className="sm:col-span-3">
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1.5 rounded border border-red-400/40 bg-transparent px-3 py-1.5 text-xs text-red-300 hover:bg-red-400/10"
            >
              <Trash2 aria-hidden className="size-3.5" />
              Delete task
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
