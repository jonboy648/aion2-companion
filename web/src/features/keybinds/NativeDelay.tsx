import { useEffect, useState } from "react";
import { NATIVE_DELAY_MAX, NATIVE_DELAY_MIN, normalizeNativeDelay } from "./nativeConfig";

export function NativeDelay({ value, label, onCommit }: { value: number; label: string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (!draft.trim() || !Number.isFinite(n)) { setDraft(String(value)); return; }
    const normalized = normalizeNativeDelay(n);
    setDraft(String(normalized));
    onCommit(normalized);
  };
  return <input aria-label={label} type="number" inputMode="numeric" min={NATIVE_DELAY_MIN} max={NATIVE_DELAY_MAX} step={1}
    value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} />;
}
