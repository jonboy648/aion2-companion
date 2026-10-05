import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, Download, ExternalLink, Plus, Trash2, Upload, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { RegionTabs } from "@/features/timers/RegionTabs";
import { formatCountdown } from "@/features/timers/schedule";
import { formatLocal, useNow, useRegion } from "@/features/timers/useTimers";
import {
  GROUPS, addCharacter, addTask, applyTemplate, countOf, deleteCharacter, exportJson, groupNextReset, groupProgress, importJson, linkArmory,
  moveTask, parseArmory, removeTask, renameCharacter, reorder, setCount, shareUrl, toggle, updateTask, whatResetsNext, type Group,
} from "@/features/checklist/model";
import { PACKS, addPack } from "@/features/checklist/presets";
import { TaskRow } from "@/features/checklist/TaskRow";
import { useChecklist } from "@/features/checklist/useChecklist";
import { cn } from "@/lib/utils";

const GROUP_LABEL: Record<Group, string> = { daily: "Daily", weekly: "Weekly", custom: "Custom interval" };
const btn = "game-tab inline-flex items-center gap-1.5 px-3 py-2 text-xs";

function Bar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full bg-[var(--gold)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Daily, weekly and custom-interval tracker. Everything lives in this browser; the site cannot read the game. */
export function ChecklistPage() {
  const now = useNow();
  const [region] = useRegion();
  const { state, update, replace, saved, shared, dismissShared } = useChecklist();
  const [drag, setDrag] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [newChar, setNewChar] = useState("");
  const [armoryText, setArmoryText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const t = now ?? 0;
  const char = state.characters.find((c) => c.id === state.activeId) ?? state.characters[0];
  const next = now === null ? null : whatResetsNext(state, region, t);

  const submitTask = (group: Group) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    update((s) => addTask(s, { group, title: String(f.get("title") ?? ""), target: Number(f.get("target")) || 1, everyDays: Number(f.get("every")) || 2 }, region, Date.now()));
    e.currentTarget.reset();
  };

  const share = async () => {
    const url = shareUrl(window.location.origin, state.tasks);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Template link copied. It holds your task list only, no ticks or characters.");
    } catch {
      window.prompt("Copy this template link", url);
    }
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportJson(state)], { type: "application/json" }));
    a.download = "aion2-checklist.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const s = importJson(await file.text());
    if (!s) return setMessage("That file is not valid JSON.");
    replace(s);
    setMessage(`Imported ${s.tasks.length} tasks and ${s.characters.length} characters.`);
  };

  return (
    <>
      <PageHeader title="Checklist" caption="Daily, weekly and custom tasks that clear themselves when the game resets." />

      <p className="mb-4 rounded-md border border-gold/30 bg-gold/5 p-3 text-xs text-dim">
        <strong className="text-gold">You tick these yourself.</strong> This site cannot read the game, so nothing here knows what you actually did. Ticks stay in this browser (no account) and clear on the reset times from the{" "}
        <Link to="/timers">timers page</Link>, which are community-sourced and not verified in game.
        {!saved && <span className="ml-1 text-red-300">Your browser is blocking storage, so changes will be lost when you close this tab.</span>}
      </p>

      {shared && (
        <div role="status" className="mb-4 rounded-md border border-[var(--border-soft)] p-3 text-sm">
          <p>A shared template with {shared.length} tasks is in this link.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => { update((s) => applyTemplate(s, shared, "add")); dismissShared(); }}>Add to my list</button>
            <button type="button" className={btn} onClick={() => { update((s) => applyTemplate(s, shared, "replace")); dismissShared(); }}>Replace my list</button>
            <button type="button" className={btn} onClick={dismissShared}>Ignore</button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <RegionTabs />
        {next && now !== null && (
          <p className="text-sm" aria-live="off">
            <span className="text-dim">Resets next: </span>
            <strong className="text-gold">{GROUP_LABEL[next.group]}</strong> in <span className="font-semibold tabular-nums">{formatCountdown(next.at - t)}</span>
            <span className="text-xs text-dim"> ({formatLocal(next.at)})</span>
          </p>
        )}
      </div>

      <section aria-label="Characters" className="ornate mb-5 p-3">
        <div role="group" aria-label="Character" className="flex flex-wrap items-center gap-1.5">
          {state.characters.map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === char.id} className="game-tab px-3 py-2 text-xs" onClick={() => update((s) => ({ ...s, activeId: c.id }))}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); update((s) => addCharacter(s, newChar)); setNewChar(""); }}>
            <Input aria-label="New character name" value={newChar} maxLength={40} placeholder="New character name" onChange={(e) => setNewChar(e.target.value)} />
            <button type="submit" aria-label="Add character" className={btn}><UserPlus aria-hidden className="size-3.5" />Add</button>
          </form>
          <label className="flex items-center gap-2 text-xs text-dim">
            <span className="shrink-0">Rename</span>
            <Input key={char.id} aria-label="Rename character" defaultValue={char.name} maxLength={40} onChange={(e) => update((s) => renameCharacter(s, char.id, e.target.value))} />
          </label>
          <form
            className="flex gap-2 sm:col-span-2"
            onSubmit={(e) => {
              e.preventDefault();
              const a = parseArmory(armoryText);
              if (!a) return setMessage("Use an armory link like /c/nae/1101/Name.");
              update((s) => linkArmory(s, char.id, a));
              setArmoryText("");
            }}
          >
            <Input aria-label="Armory link" value={armoryText} placeholder="Armory page, e.g. /c/nae/1101/Name (optional)" onChange={(e) => setArmoryText(e.target.value)} />
            <button type="submit" className={btn}>Link</button>
          </form>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {char.armory && (
            <>
              <Link to={`/c/${char.armory.region}/${char.armory.serverId}/${encodeURIComponent(char.armory.name)}`} className="inline-flex items-center gap-1">
                <ExternalLink aria-hidden className="size-3" />Armory page for {char.armory.name}
              </Link>
              <button type="button" className="text-dim underline" onClick={() => update((s) => linkArmory(s, char.id, null))}>Unlink</button>
            </>
          )}
          {state.characters.length > 1 && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-red-300"
              onClick={() => window.confirm(`Delete ${char.name} and its ticks?`) && update((s) => deleteCharacter(s, char.id))}
            >
              <Trash2 aria-hidden className="size-3" />Delete {char.name}
            </button>
          )}
        </div>
      </section>

      {state.tasks.length === 0 && (
        <section className="ornate mb-5 p-4">
          <h2 className="font-display text-lg font-semibold">Start with a pack</h2>
          <p className="mt-1 text-sm text-dim">Packs are editable starting points. The names come from the game files, but counts and reset groups have not been checked in game.</p>
        </section>
      )}
      <section aria-label="Starter packs" className="mb-5 flex flex-wrap gap-2">
        {PACKS.map((p) => (
          <button key={p.id} type="button" className={btn} title={p.blurb} onClick={() => update((s) => addPack(s, p, region, Date.now()))}>
            <Plus aria-hidden className="size-3.5" />{p.name}
          </button>
        ))}
      </section>

      <div className="space-y-5">
        {GROUPS.map((g) => {
          const tasks = state.tasks.filter((x) => x.group === g);
          const prog = groupProgress(state, char.id, g, region, t);
          const at = now === null ? null : groupNextReset(state, g, region, t);
          return (
            <section key={g} aria-labelledby={`grp-${g}`} className="ornate p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id={`grp-${g}`} className="font-display text-lg font-semibold">{GROUP_LABEL[g]}</h2>
                <span className="text-sm tabular-nums text-dim">
                  {prog.done}/{prog.total} done
                  {at !== null && (
                    <>
                      {" "}
                      <span className="text-gold">resets in {formatCountdown(at - t)}</span>
                    </>
                  )}
                </span>
              </div>
              <div className="mt-2"><Bar done={prog.done} total={prog.total} label={`${GROUP_LABEL[g]} progress`} /></div>
              {g === "custom" && <p className="mt-1.5 text-xs text-dim">Each task has its own interval in days, counted from when you add it, at the daily reset time.</p>}
              <ul className="mt-3 space-y-2">
                {tasks.length === 0 && <li className="text-sm text-dim">No {GROUP_LABEL[g].toLowerCase()} tasks yet.</li>}
                {tasks.map((task, i) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    count={countOf(state, char.id, task, region, t)}
                    now={t}
                    region={region}
                    first={i === 0}
                    last={i === tasks.length - 1}
                    dragging={drag === task.id}
                    onCount={(n) => update((s) => setCount(s, char.id, task, n, Date.now()))}
                    onToggle={() => update((s) => toggle(s, char.id, task, region, Date.now()))}
                    onMove={(d) => update((s) => moveTask(s, task.id, d))}
                    onEdit={(patch) => update((s) => updateTask(s, task.id, patch))}
                    onRemove={() => update((s) => removeTask(s, task.id))}
                    onDragStart={() => setDrag(task.id)}
                    onDragOver={() => drag && drag !== task.id && update((s) => reorder(s, drag, task.id))}
                    onDragEnd={() => setDrag(null)}
                  />
                ))}
              </ul>
              <form onSubmit={submitTask(g)} className="mt-3 flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1 basis-40 text-xs text-dim">
                  New {GROUP_LABEL[g].toLowerCase()} task
                  <Input name="title" required maxLength={120} placeholder="Task name" />
                </label>
                <label className="w-20 text-xs text-dim">
                  Times
                  <Input name="target" type="number" min={1} max={999} defaultValue={1} />
                </label>
                {g === "custom" && (
                  <label className="w-20 text-xs text-dim">
                    Every (d)
                    <Input name="every" type="number" min={1} max={365} defaultValue={2} />
                  </label>
                )}
                <button type="submit" className={btn}><Plus aria-hidden className="size-3.5" />Add</button>
              </form>
            </section>
          );
        })}
      </div>

      <section aria-label="Backup and sharing" className="mt-6 flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={share} disabled={state.tasks.length === 0}><Copy aria-hidden className="size-3.5" />Copy template link</button>
        <button type="button" className={btn} onClick={download}><Download aria-hidden className="size-3.5" />Export JSON</button>
        <button type="button" className={btn} onClick={() => fileRef.current?.click()}><Upload aria-hidden className="size-3.5" />Import JSON</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Import checklist JSON file" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
        {message && <span role="status" className={cn("flex items-center gap-1 text-xs text-dim")}><Check aria-hidden className="size-3" />{message}</span>}
      </section>
      <p className="mt-4 text-xs text-dim">
        Saved in this browser only. A template link shares your task list, never your ticks. Clearing site data erases the checklist, so export a backup if you care about it. Not affiliated with NCSOFT.
      </p>
    </>
  );
}
