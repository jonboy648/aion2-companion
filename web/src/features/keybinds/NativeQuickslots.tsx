import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CharacterBuild, GameData, IconUrls, KeybindPlan } from "@/lib/types";
import { guideRanks } from "@/features/progression/guideRanks";
import { acquiredSkill, actionLocked, initialNativeConfig, nativeActivationWarning, nativeBindingIssues, nativeColumnNotes, nativePlacementIssues, normalizeNativeConfig, resolveNativeColumn, selectedRecipe, type NativeConfig, type NativeEntry } from "./nativeConfig";
import { SkillIcon } from "./SkillIcon";
import { NativeDialog } from "./NativeDialog";
import { NativeDelay } from "./NativeDelay";
import { NativeAlternates } from "./NativeAlternates";
import { nativeOwnerKey, nativeStorageKey, readNativeConfig, writeNativeConfig } from "./nativeStorage";
import type { PlannedBuild } from "./activeBuild";
import { suggestNativeSetup } from "./nativeSuggestion";
import { nativeSetup } from "./nativeSetup";
import { SetupSheet } from "./SetupSheet";
import "./native-quickslots.css";

export interface NativeQuickslotsProps {
  build: CharacterBuild;
  gd: GameData;
  icons: IconUrls;
  plan: KeybindPlan;
  planned?: PlannedBuild | null;
  disabled?: boolean;
}

export function NativeQuickslots(props: NativeQuickslotsProps) {
  const owner = nativeOwnerKey(props.build);
  const ids = props.plan.actions?.map(action => action.id) ?? [];
  if (ids.length !== 12 || new Set(ids).size !== 12 || ids.some(id => !Number.isInteger(id) || id < 1 || id > 12)) {
    return <p role="alert" className="text-sm text-error">Client Quick Use mappings are unavailable for this class.</p>;
  }
  return <NativeEditor key={owner} {...props} owner={owner} />;
}

function readSuggestionBackup(owner: string): NativeConfig | null {
  try {
    const raw = localStorage.getItem(`${nativeStorageKey(owner)}:before-suggestion`);
    if (!raw || raw.length > 70000) return null;
    const backup = JSON.parse(raw);
    return backup.owner === owner ? normalizeNativeConfig(backup.config).config : null;
  } catch { return null; }
}

function NativeEditor({ build, gd, icons, plan, planned, disabled = false, owner }: NativeQuickslotsProps & { owner: string }) {
  const actions = plan.actions ?? [];
  const [loaded] = useState(() => readNativeConfig(owner, initialNativeConfig(actions, gd, build)));
  const [config, setConfig] = useState(loaded.config);
  const [storageNotice, setStorageNotice] = useState(loaded.notice);
  const [selected, setSelected] = useState(actions[1]?.id ?? actions[0]?.id ?? 1);
  const [picker, setPicker] = useState<{ kind: "skill"; id: number; row: number } | { kind: "macro" } | { kind: "configuration"; rename?: boolean } | { kind: "delete" } | null>(null);
  useEffect(() => { if (disabled) setPicker(null); }, [disabled]);
  const [recipeName, setRecipeName] = useState("");
  const [issue, setIssue] = useState<string | null>(null);
  const [previewSuggestion, setPreviewSuggestion] = useState(false);
  const [previousSetup, setPreviousSetup] = useState(() => readSuggestionBackup(owner));
  const suggestion = useMemo(() => planned ? suggestNativeSetup(config, actions, gd, build, planned) : null,
    [config, actions, gd, build, planned]);
  useEffect(() => { setPreviewSuggestion(false); }, [disabled, build, planned, plan]);
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: number) => { if (!disabled) scrollRef.current?.scrollBy({ left: direction * 280, behavior: "auto" }); };
  const ranks = guideRanks(gd, build);
  const validationIssues = [...nativeBindingIssues(config), ...nativePlacementIssues(config, actions, gd, build)];
  const name = (key: string | null) => key ? gd.skills[key]?.name ?? "Unavailable skill" : "Empty";
  const winner = (id: number) => {
    const action = actions.find(action => action.id === id);
    return action && !actionLocked(action, build, gd) ? resolveNativeColumn(config, id,
      (key, row) => acquiredSkill(key, gd, build) && availability[`${id}:${row}`] !== false) : null;
  };
  const face = (key: string | null, binding?: string) => <>
    {key && <SkillIcon key={key} url={icons[key]} name={name(key)} size={56} rarity="common" />}
    {key && <span className="nq-rank" aria-hidden>Lv. {ranks[key] ?? "?"}</span>}
    {binding && <span className="nq-key" aria-hidden>{({ "left mouse": "LMB", "right mouse": "RMB", "middle mouse": "MMB" } as Record<string, string>)[binding.trim().toLowerCase()] ?? binding}</span>}
  </>;
  const edit = (fn: (previous: NativeConfig) => NativeConfig) => {
    if (disabled) return;
    const next = fn(config);
    setConfig(next);
    setStorageNotice(writeNativeConfig(owner, next));
  };
  const applySuggestion = () => {
    if (disabled || !previewSuggestion || !suggestion?.config) return;
    // Retain a complete, reload-safe copy before replacing shared columns.
    try {
      const backup = JSON.stringify({ owner, config });
      if (backup.length > 70000) throw new Error("Backup too large");
      localStorage.setItem(`${nativeStorageKey(owner)}:before-suggestion`, backup);
    } catch {
      setIssue("Could not retain the previous setup; suggestion was not applied.");
      return;
    }
    setPreviousSetup(structuredClone(config));
    edit(() => suggestion.config!);
    setAvailability({});
    setPreviewSuggestion(false);
    setIssue(null);
  };
  const revertSuggestion = () => {
    if (disabled || !previousSetup) return;
    const notice = writeNativeConfig(owner, previousSetup);
    setConfig(previousSetup);
    setStorageNotice(notice);
    setAvailability({});
    if (!notice) {
      setPreviousSetup(null);
      try { localStorage.removeItem(`${nativeStorageKey(owner)}:before-suggestion`); } catch { /* The retained copy remains safe. */ }
    }
  };
  const entries = selectedRecipe(config).entries;
  const saveRecipe = () => {
    if (disabled || picker?.kind !== "configuration" || (!picker.rename && config.recipes.length >= 20)) return;
    const name = recipeName.trim();
    if (!name) { setIssue("Enter a configuration name."); return; }
    if (picker.rename) edit(previous => ({ ...previous, recipes: previous.recipes.map(recipe => recipe.id === previous.selectedRecipe ? { ...recipe, name } : recipe) }));
    else {
      const id = crypto.randomUUID();
      edit(previous => ({ ...previous, recipes: [...previous.recipes, { id, name, entries: [] }], selectedRecipe: id }));
    }
    setPicker(null); setIssue(null);
  };
  const editEntries = (fn: (previous: NativeEntry[]) => NativeEntry[]) => edit(previous => ({ ...previous,
    recipes: previous.recipes.map(recipe => recipe.id === previous.selectedRecipe ? { ...recipe, entries: fn(recipe.entries) } : recipe),
  }));
  const addEntry = (id: number) => {
    const action = actions.find(action => action.id === id);
    const key = config.columns[String(id)]?.[0];
    if (!action || actionLocked(action, build, gd) || !key || !acquiredSkill(key, gd, build) || disabled || entries.length >= 100) return;
    editEntries(previous => [...previous, { id: crypto.randomUUID(), quickUseId: id, delayMs: 10 }]);
    setSelected(id); setPicker(null);
  };
  const assign = (key: string | null) => {
    if (picker?.kind !== "skill" || disabled) return;
    const action = actions.find(action => action.id === picker.id);
    const rows = config.columns[String(picker.id)];
    if (!action?.context_editable || actionLocked(action, build, gd) || !rows) return;
    if (key && !acquiredSkill(key, gd, build)) { setIssue("This skill is unavailable for this build."); return; }
    if (picker.row > 0 && key && !rows[0]) { setIssue("Assign row 0 before an upper row."); return; }
    if (picker.row === 0 && !key && rows.slice(1).some(Boolean)) { setIssue("Clear the upper rows before clearing row 0."); return; }
    edit(previous => ({ ...previous, columns: { ...previous.columns,
      [String(picker.id)]: rows.map((value, row) => row === picker.row ? key : value) as typeof rows } }));
    setPicker(null); setIssue(null);
  };
  return <section aria-label="Native Quick Use configuration" className="native-quickslots" aria-disabled={disabled} inert={disabled}>
    <fieldset disabled={disabled} className="nq-fieldset">
      {storageNotice && <p className="nq-notice" role="status">{storageNotice}</p>}
      {validationIssues.length > 0 && <ul className="nq-notice" role="alert">{validationIssues.map(message => <li key={message}>{message}</li>)}</ul>}
      <p className="nq-source">Client defaults + local edits</p>
      {planned && <section aria-label="Chosen Character plan" className="mb-5 space-y-3 rounded border border-border p-4 text-sm">
        <p><strong>Source: chosen Character plan</strong> · {planned.playstyle} · Goal: {planned.objective === "stagger" ? "Stagger (modeled gauge contribution)" : "Damage"}</p>
        <p>Suggests placements and macro membership from your selected priority. Preview the changes before applying.</p>
        <Button variant="secondary" onClick={() => { if (!disabled) { setIssue(null); setPreviewSuggestion(true); } }}>Preview suggested setup</Button>
      </section>}
      {previousSetup && <div className="mb-5 space-y-2 text-sm">
        <p>A copy of the setup before the last suggestion is retained. Revert restores that complete setup, including columns, recipes and bindings, replacing edits made since applying.</p>
        <Button variant="secondary" onClick={revertSuggestion}>Revert suggested setup</Button>
      </div>}
      {previewSuggestion && suggestion && !disabled && <NativeDialog title="Suggested native setup" onClose={() => setPreviewSuggestion(false)}>
        <div className="space-y-4 p-5 text-sm">
          <p>Source: chosen Character plan · {planned?.playstyle} · Goal: {suggestion.objective === "stagger" ? "Stagger (modeled gauge contribution)" : "Damage"}.</p>
          <p>One relevant root skill per column avoids an always-eligible filler hiding conditional or cooldown skills. Priority chooses placements and membership; entry numbering is not runtime execution order.</p>
          <p>Columns are shared by all saved configurations. Applying changes their linked skills; all existing recipe names, entries, authored delays and bindings are retained. A complete previous setup is saved for Revert.</p>
          {suggestion.errors.length > 0 && <ul role="alert" className="nq-notice">{suggestion.errors.map(error => <li key={error}>{error}</li>)}</ul>}
          {suggestion.config && <>
            <h3 className="font-semibold">Column changes</h3>
            {suggestion.changedColumns.length ? <ul className="space-y-2">{suggestion.changedColumns.map(id => <li key={id}>
              Quick Use {id}: {config.columns[String(id)].map(name).join(" / ")} → {suggestion.config!.columns[String(id)].map(name).join(" / ")}
            </li>)}</ul> : <p>No column changes; a new recipe will be added.</p>}
            <h3 className="font-semibold">Suggested membership</h3>
            <ul className="space-y-2">{suggestion.placements.map(placement => <li key={placement.id}>
              Quick Use {placement.id}: {name(placement.key)} · {selectedRecipe(suggestion.config!).entries.find(entry => entry.quickUseId === placement.id)?.delayMs} ms. {placement.reason}
            </li>)}</ul>
          </>}
          {suggestion.manual.length > 0 && <div><h3 className="font-semibold">Manual charge skills</h3><ul>{suggestion.manual.map(item => <li key={item.key}>{name(item.key)}: {item.reason}</li>)}</ul></div>}
          {suggestion.unplaced.length > 0 && <div><h3 className="font-semibold">Unplaced skills</h3><ul>{suggestion.unplaced.map(item => <li key={item.key}>{gd.skills[item.key]?.name ?? item.key}: {item.reason}</li>)}</ul></div>}
          <p>Existing authored delays are reused by column. New entries use 10 ms only as a starter, user-editable setting, never an optimized delay.</p>
          <p>This is a modeled configuration suggestion. Native eligibility, charge handling, retries, queue timing and set/entry capacity remain unverified. It does not predict native DPS or certify a scheduler. Frost immunity/proc routes and per-projectile Firestorm timing remain model limits; stagger contribution does not predict breaks.</p>
          {issue && <p role="alert" className="nq-notice">{issue}</p>}
          <div className="flex flex-wrap gap-3"><Button disabled={!suggestion.config} onClick={applySuggestion}>Apply suggested setup</Button>
            <Button variant="secondary" onClick={() => setPreviewSuggestion(false)}>Cancel</Button></div>
        </div>
      </NativeDialog>}
      <div className="nq-section-heading"><h2 className="nq-section-title">Skill placement</h2><div className="nq-scroll-controls">
        <button type="button" aria-label="Scroll skill columns left" title="Scroll left" onClick={() => scroll(-1)}><ArrowLeft size={17} /></button>
        <button type="button" aria-label="Scroll skill columns right" title="Scroll right" onClick={() => scroll(1)}><ArrowRight size={17} /></button>
      </div></div>
      <div ref={scrollRef} className="nq-scroll" role="region" aria-label="Skill placement and separate hotbar" tabIndex={0}
        onKeyDown={event => { if (event.target === event.currentTarget && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); scroll(event.key === "ArrowRight" ? 1 : -1); } }}>
        <div className="nq-grid" role="group" aria-label="Four-row skill placement">
          {[3, 2, 1, 0].map(row => <Fragment key={row}>
            {actions.map((action, index) => <Fragment key={action.id}>
              {index === 8 && <span className="nq-gap" aria-hidden />}
              <button type="button" data-row={row} data-action={action.id} data-skill={config.columns[String(action.id)]?.[row] ?? ""}
                className={`nq-cell ${selected === action.id ? "nq-selected" : ""} ${config.columns[String(action.id)]?.[row] && !acquiredSkill(config.columns[String(action.id)][row]!, gd, build) ? "nq-unavailable" : ""}`}
                aria-label={`Quick Use ${action.id}, row ${row}: ${name(config.columns[String(action.id)]?.[row] ?? null)}`}
                disabled={actionLocked(action, build, gd) || !action.context_editable}
                onClick={() => { if (!disabled) { setSelected(action.id); setIssue(null); setPicker({ kind: "skill", id: action.id, row }); } }}>{face(config.columns[String(action.id)]?.[row] ?? null)}</button>
            </Fragment>)}
            <span className="nq-row-label" data-row-label={row}>{row}</span>
          </Fragment>)}
        </div>
        <div className="nq-grid nq-hotbar" role="group" aria-label="Quick Use hotbar preview">
          {actions.map((action, index) => <Fragment key={action.id}>
            {index === 8 && <span className="nq-gap" aria-hidden />}
            <button type="button" className={`nq-cell ${selected === action.id ? "nq-selected" : ""}`}
              title={`Quick Use ${action.id}: ${config.bindings[String(action.id)] || "Unassigned"}`}
              aria-label={`Quick Use ${action.id}: ${name(winner(action.id)?.key ?? null)}`}
              onClick={() => setSelected(action.id)}>{face(winner(action.id)?.key ?? null, config.bindings[String(action.id)])}</button>
          </Fragment>)}
        </div>
      </div>
      <div className="nq-grid-footer"><span>Highest priority: <b>row 0</b></span><span>Selected column: {config.bindings[String(selected)] || "Unassigned"}</span></div>
      <div className="nq-recipe-bar"><label>Saved configuration<select aria-label="Saved configuration" value={config.selectedRecipe}
        onChange={event => edit(previous => ({ ...previous, selectedRecipe: event.target.value }))}>{config.recipes.map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select></label>
        <Button variant="ghost" size="icon" aria-label="New configuration" title="New configuration" disabled={config.recipes.length >= 20}
          onClick={() => { if (!disabled) { setRecipeName(`Macro ${config.recipes.length + 1}`); setIssue(null); setPicker({ kind: "configuration" }); } }}><Plus /></Button>
        <Button variant="ghost" size="icon" aria-label="Rename configuration" title="Rename configuration"
          onClick={() => { if (!disabled) { setRecipeName(selectedRecipe(config).name); setIssue(null); setPicker({ kind: "configuration", rename: true }); } }}><Pencil /></Button>
        <Button variant="ghost" size="icon" aria-label="Delete configuration" title="Delete configuration" disabled={config.recipes.length === 1}
          onClick={() => { if (!disabled) setPicker({ kind: "delete" }); }}><Trash2 /></Button>
      </div>
      <div className="nq-work-area">
      <section className="nq-macro" aria-label="Macro configuration"><header className="nq-native-title"><h2>Macro</h2></header>
        {entries.length === 0 && <p className="nq-empty">No macro entries</p>}
        <ol className="nq-entries" aria-label="Macro entries">
          {entries.map((entry, index) => {
            const key = config.columns[String(entry.quickUseId)]?.[0] ?? null;
            return <li key={entry.id} data-quick-use={entry.quickUseId} className="nq-entry">
              <span className="nq-entry-number" aria-hidden>{index + 1}</span>
              <div className="nq-entry-content"><button type="button" className="nq-cell nq-macro-skill" title={`Linked to Quick Use ${entry.quickUseId}`}
                aria-label={`Select column for entry ${index + 1}: ${name(key)}`} onClick={() => { if (!disabled) setSelected(entry.quickUseId); }}>{face(key, config.bindings[String(entry.quickUseId)])}</button>
                <strong className="nq-entry-name">{name(key)}</strong>{nativeColumnNotes(config, entry.quickUseId, gd).map(note => <p className="nq-charge-note" key={note}>{note}</p>)}</div>
              <div className="nq-entry-tools"><button type="button" aria-label={`Remove entry ${index + 1}`} title="Remove entry" onClick={() => editEntries(previous => previous.filter(item => item.id !== entry.id))}><Trash2 size={17} /></button>
                <button type="button" aria-label={`Move entry ${index + 1} up`} title="Move up" disabled={index === 0} onClick={() => editEntries(previous => { const next = [...previous]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}><ArrowUp size={16} /></button>
                <button type="button" aria-label={`Move entry ${index + 1} down`} title="Move down" disabled={index === entries.length - 1} onClick={() => editEntries(previous => { const next = [...previous]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })}><ArrowDown size={16} /></button></div>
              <div className="nq-delay"><label>Delay<NativeDelay label={`Entry ${index + 1} delay milliseconds`} value={entry.delayMs}
                onCommit={delayMs => editEntries(previous => previous.map(item => item.id === entry.id ? { ...item, delayMs } : item))} />ms</label></div>
            </li>;
          })}
        </ol>
        <footer className="nq-macro-footer"><Button className="nq-add" disabled={entries.length >= 100} onClick={() => { if (!disabled) setPicker({ kind: "macro" }); }}><Plus />Add Macro</Button></footer>
      </section>
      <aside className="nq-settings">
        <h2>Macro activation</h2>
        <label>Binding<input aria-label="Macro activation binding" value={config.activationBinding}
          onChange={event => edit(previous => ({ ...previous, activationBinding: event.target.value }))} maxLength={24} placeholder="Unassigned" /></label>
        <label>Control mode<select aria-label="Control mode" value={config.controlMode} onChange={event => edit(previous => ({ ...previous, controlMode: event.target.value as NativeConfig["controlMode"] }))}><option value="unknown">Not specified</option><option value="aion2">AION 2</option><option value="aion1">AION 1</option></select></label>
        {nativeActivationWarning(config) && <p className="nq-notice" role="status">{nativeActivationWarning(config)}</p>}
        <div className="nq-column-settings"><h3>Selected column</h3><label>Binding<input aria-label={`Binding for Quick Use ${selected}`} maxLength={24} value={config.bindings[String(selected)] ?? ""}
          onChange={event => edit(previous => ({ ...previous, bindings: { ...previous.bindings, [String(selected)]: event.target.value } }))} /></label>
          <label>Alternate bindings<NativeAlternates key={selected} label={`Alternate bindings for Quick Use ${selected}`} value={config.alternateBindings[String(selected)] ?? []}
            onCommit={bindings => edit(previous => ({ ...previous, alternateBindings: { ...previous.alternateBindings, [String(selected)]: bindings } }))} /></label>
          <ol className="nq-stack" aria-label={`Quick Use ${selected} skills`}>{[3, 2, 1, 0].map(row => { const key = config.columns[String(selected)]?.[row] ?? null; return <li key={row}><span>{row}</span>{key ? <SkillIcon key={key} url={icons[key]} name={name(key)} size={36} rarity="common" /> : <span />}<span>{name(key)}</span>{key && <input type="checkbox" aria-label={`${name(key)} ready in row ${row}`} checked={availability[`${selected}:${row}`] !== false}
            onChange={event => { if (!disabled) setAvailability(previous => ({ ...previous, [`${selected}:${row}`]: event.target.checked })); }} />}</li>; })}</ol>
          <p className="nq-current-skill" aria-live="polite">{winner(selected) ? name(winner(selected)!.key) : "No eligible skill"}</p>
        </div>
        <details className="nq-boundary"><summary>Availability preview</summary><p>Readiness is set locally, not read from the game. Entry numbering is not runtime execution order. This preview does not simulate retries, queue timing or macro DPS.</p></details>
      </aside></div>
      {picker && !disabled && <NativeDialog title={picker.kind === "macro" ? "Add Macro" : picker.kind === "delete" ? "Delete configuration" : picker.kind === "configuration" ? picker.rename ? "Rename configuration" : "New configuration" : `Quick Use ${picker.id} / row ${picker.row}`} onClose={() => setPicker(null)}>
        {picker.kind === "configuration" ? <form className="nq-name-form" onSubmit={event => { event.preventDefault(); saveRecipe(); }}>
          <label>Configuration name<input aria-label="Configuration name" autoFocus maxLength={60} value={recipeName} onChange={event => setRecipeName(event.target.value)} /></label>
          <Button type="submit">Save configuration</Button>
        </form> : picker.kind === "delete" ? <div className="nq-name-form"><p>Delete {selectedRecipe(config).name} and its entries? Skill placement and bindings will be kept.</p>
          <Button variant="destructive" onClick={() => { if (!disabled && config.recipes.length > 1) {
            edit(previous => { const recipes = previous.recipes.filter(recipe => recipe.id !== previous.selectedRecipe); return { ...previous, recipes, selectedRecipe: recipes[0].id }; });
            setPicker(null);
          } }}>Confirm delete</Button></div> :
        <div className={`nq-picker ${picker.kind === "skill" ? "nq-skill-picker" : ""}`}>
          {picker.kind === "macro" ? actions.map(action => { const key = config.columns[String(action.id)]?.[0] ?? null; return <button type="button" key={action.id}
            className="nq-picker-option" disabled={!key || !acquiredSkill(key, gd, build) || actionLocked(action, build, gd)} aria-label={`Add Quick Use ${action.id}: ${name(key)}`} onClick={() => addEntry(action.id)}>
            <span className="nq-cell">{face(key, config.bindings[String(action.id)])}</span><span>{name(key)}</span></button>; })
            : Object.values(gd.skills).filter(skill => acquiredSkill(skill.key, gd, build)).sort((a, b) => a.name.localeCompare(b.name)).map(skill => <button type="button" key={skill.key} className="nq-picker-option" aria-label={`Assign ${skill.name}`} onClick={() => assign(skill.key)}><span className="nq-cell">{face(skill.key)}</span><span>{skill.name}</span></button>)}
        </div>}
        {issue && <p className="nq-dialog-issue" role="alert">{issue}</p>}
        {picker.kind === "skill" && <footer className="nq-dialog-footer"><Button variant="ghost" size="sm" onClick={() => assign(null)}><Trash2 />Clear cell</Button></footer>}
      </NativeDialog>}
      <details className="nq-export"><summary>Setup sheet</summary><div><SetupSheet markdown={nativeSetup(config, actions, gd, build)} filename="native-macro-setup.md" /></div></details>
    </fieldset>
  </section>;
}
