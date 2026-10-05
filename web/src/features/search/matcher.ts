/** Small hand-rolled fuzzy matcher for the Ctrl+K palette. Higher score = better; 0 = no match. */

export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9ㄱ-ㆎ가-힣]+/g, " ")
    .trim();

/** Score one already-normalized token against one already-normalized text. */
function scoreToken(tok: string, text: string): number {
  if (text === tok) return 100;
  if (text.startsWith(tok)) return 80;
  const words = text.split(" ");
  if (words.some((w) => w.startsWith(tok))) return 65;
  const at = text.indexOf(tok);
  if (at >= 0) return 45 - Math.min(at, 20) * 0.5;
  // subsequence fuzzy ("frarw" -> "flame arrow"): only for tokens of 3+ letters, rewards consecutive runs and word starts
  if (tok.length < 3) return 0;
  let ti = 0;
  let run = 0;
  let pts = 0;
  for (let i = 0; i < text.length && ti < tok.length; i++) {
    if (text[i] === tok[ti]) {
      run++;
      pts += 1 + run + (i === 0 || text[i - 1] === " " ? 2 : 0);
      ti++;
    } else run = 0;
  }
  if (ti < tok.length) return 0;
  return Math.max(1, Math.min(30, (pts / (tok.length * 4)) * 30));
}

/**
 * Score a query against a label (and optional extra searchable text, which counts for less).
 * Every query token must match somewhere; the score is the mean token score, with a small bonus for shorter labels.
 */
export function score(query: string, label: string, extra = ""): number {
  const q = normalize(query);
  if (!q) return 0;
  const l = normalize(label);
  const x = extra ? normalize(extra) : "";
  const toks = q.split(" ");
  let total = 0;
  for (const t of toks) {
    const a = scoreToken(t, l);
    const b = x ? scoreToken(t, x) * 0.5 : 0;
    const s = Math.max(a, b);
    if (s === 0) return 0;
    total += s;
  }
  const whole = toks.length > 1 && l.includes(q) ? 10 : 0;
  return total / toks.length + whole - Math.min(l.length, 60) * 0.05;
}

/** Top `limit` of `items` by score (stable on ties), dropping non-matches. */
export function rank<T>(query: string, items: readonly T[], text: (t: T) => [string, string?], limit = 8): T[] {
  const scored: { t: T; s: number; i: number }[] = [];
  items.forEach((t, i) => {
    const [label, extra] = text(t);
    const s = score(query, label, extra);
    if (s > 0) scored.push({ t, s, i });
  });
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  return scored.slice(0, limit).map((x) => x.t);
}
