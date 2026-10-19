import { useEffect, useState } from "react";

export function NativeAlternates({ label, value, onCommit }: { label: string; value: string[]; onCommit: (value: string[]) => void }) {
  const saved = value.join(", ");
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  const commit = () => {
    const next = [...new Set(draft.split(",").map(binding => binding.trim()).filter(Boolean))];
    if (next.length > 4 || next.some(binding => binding.length > 24)) { setDraft(saved); return; }
    setDraft(next.join(", "));
    onCommit(next);
  };
  return <input aria-label={label} value={draft} maxLength={110} onChange={event => setDraft(event.target.value)}
    onBlur={commit} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} />;
}
