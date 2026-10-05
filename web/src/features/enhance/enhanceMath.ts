/**
 * Expected cost of upgrading gear from level `from` to level `to`, as an absorbing Markov chain.
 *
 * One step i -> i+1 has success chance p, a pity bonus fc added to p for every CONSECUTIVE failure so far (capped at a
 * 100% total, the only cap the client tables carry), and on failure either nothing happens (drop 0) or the item loses
 * `drop` levels (the Clash Rune loses one). The pity counter restarts whenever the level changes.
 *
 * State = (level, consecutive failures). Everything is exact except `costPercentiles` on a chain with drops, which is
 * simulated (labelled in its result): the cost of a path depends on which levels it visited, so there is no closed form
 * for its spread. With no drops each level is independent and the spread is an exact convolution.
 * Pure functions, no DOM, no data loading.
 */

export interface Step {
  /** base success chance, 0..1 */
  p: number;
  /** chance added per consecutive failure, 0..1 */
  fc: number;
  /** levels lost on a failure (0 = stays) */
  drop: number;
  /** kinah per attempt */
  kinah: number;
  /** material name -> count per attempt */
  mats: Record<string, number>;
}

export interface Opts {
  /** apply the pity bonus (false = what the odds would be without it) */
  pity?: boolean;
}

export const successAt = (s: Step, fails: number, pity = true): number => Math.min(1, s.p + (pity ? fails * s.fc : 0));

/** Highest failure count that still matters: the chance is 1 from here on (0 when there is no pity). */
function kMax(s: Step, pity: boolean): number {
  if (!pity || s.fc <= 0 || s.p >= 1) return 0;
  return Math.ceil((1 - s.p) / s.fc - 1e-12);
}

interface State {
  level: number;
  k: number;
  p: number;
  /** next state on success, -1 = finished */
  win: number;
  /** next state on failure */
  lose: number;
}

interface Chain {
  states: State[];
  start: number;
  /** levels of states, for aggregation */
  lo: number;
  impossible: boolean;
}

function buildChain(steps: readonly Step[], from: number, to: number, pity: boolean): Chain {
  const anyDrop = steps.slice(from, to).some((s) => s.drop > 0);
  const lo = anyDrop ? 0 : from;
  const offset: number[] = [];
  const kmax: number[] = [];
  let n = 0;
  for (let l = lo; l < to; l++) {
    offset[l] = n;
    kmax[l] = kMax(steps[l], pity);
    n += kmax[l] + 1;
  }
  const states: State[] = [];
  let impossible = false;
  for (let l = lo; l < to; l++) {
    const s = steps[l];
    for (let k = 0; k <= kmax[l]; k++) {
      const p = successAt(s, k, pity);
      if (p <= 0 && kmax[l] === 0) impossible = true;
      const win = l + 1 >= to ? -1 : offset[l + 1];
      const nl = Math.max(lo, l - s.drop);
      const lose = s.drop > 0 && nl !== l ? offset[nl] : offset[l] + Math.min(k + 1, kmax[l]);
      states.push({ level: l, k, p, win, lose });
    }
  }
  return { states, start: offset[from], lo, impossible };
}

export interface LevelRow {
  level: number;
  /** chance of the first attempt */
  p0: number;
  /** expected attempts spent standing on this level (drops included) */
  attempts: number;
  kinah: number;
  mats: Record<string, number>;
}

export interface Plan {
  /** false when a step in range can never succeed */
  feasible: boolean;
  attempts: number;
  kinah: number;
  mats: Record<string, number>;
  perLevel: LevelRow[];
}

/** Solve A x = b in place (dense, partial pivoting). */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
    [a[c], a[piv]] = [a[piv], a[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    const d = a[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = a[r][c] / d;
      if (f === 0) continue;
      for (let j = c; j < n; j++) a[r][j] -= f * a[c][j];
      b[r] -= f * b[c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = b[r];
    for (let j = r + 1; j < n; j++) sum -= a[r][j] * x[j];
    x[r] = sum / a[r][r];
  }
  return x;
}

const addMats = (into: Record<string, number>, m: Record<string, number>, times: number) => {
  for (const [k, v] of Object.entries(m)) into[k] = (into[k] ?? 0) + v * times;
};

/** Exact expectations (attempts, kinah, materials, per level) of going from `from` to `to`. */
export function plan(steps: readonly Step[], from: number, to: number, opts: Opts = {}): Plan {
  const pity = opts.pity ?? true;
  const empty: Plan = { feasible: true, attempts: 0, kinah: 0, mats: {}, perLevel: [] };
  if (to <= from) return empty;
  if (to > steps.length || from < 0) throw new RangeError(`levels ${from}..${to} outside 0..${steps.length}`);
  const ch = buildChain(steps, from, to, pity);
  if (ch.impossible) return { ...empty, feasible: false };
  const n = ch.states.length;
  // expected visits v solve (I - Q^T) v = e_start
  const a = Array.from({ length: n }, (_, i) => {
    const row = new Array<number>(n).fill(0);
    row[i] = 1;
    return row;
  });
  ch.states.forEach((s, i) => {
    if (s.win >= 0) a[s.win][i] -= s.p;
    a[s.lose][i] -= 1 - s.p;
  });
  const b = new Array<number>(n).fill(0);
  b[ch.start] = 1;
  const v = solve(a, b);
  const rows = new Map<number, LevelRow>();
  const out: Plan = { feasible: true, attempts: 0, kinah: 0, mats: {}, perLevel: [] };
  ch.states.forEach((s, i) => {
    const st = steps[s.level];
    let r = rows.get(s.level);
    if (!r) rows.set(s.level, (r = { level: s.level, p0: successAt(st, 0, pity), attempts: 0, kinah: 0, mats: {} }));
    r.attempts += v[i];
    r.kinah += v[i] * st.kinah;
    addMats(r.mats, st.mats, v[i]);
  });
  out.perLevel = [...rows.values()].sort((x, y) => x.level - y.level);
  for (const r of out.perLevel) {
    out.attempts += r.attempts;
    out.kinah += r.kinah;
    addMats(out.mats, r.mats, 1);
  }
  return out;
}

// ---- distribution of the number of attempts --------------------------------------------------------------------

export interface Cdf {
  /** cdf[n] = chance of being finished within n attempts (cdf[0] = 0) */
  cdf: Float64Array;
  /** true when the iteration cap stopped it before the remaining chance fell below `tail` */
  truncated: boolean;
}

const TAIL = 1e-9;
const MAX_ATTEMPTS = 2_000_000;
const WORK_CAP = 6e7;

/** Exact distribution of the total number of attempts, by stepping the chain until (almost) everything is absorbed. */
export function attemptsCdf(steps: readonly Step[], from: number, to: number, opts: Opts = {}): Cdf {
  const pity = opts.pity ?? true;
  if (to <= from) return { cdf: Float64Array.of(1), truncated: false };
  const ch = buildChain(steps, from, to, pity);
  if (ch.impossible) return { cdf: Float64Array.of(0), truncated: true };
  const n = ch.states.length;
  const cap = Math.min(MAX_ATTEMPTS, Math.floor(WORK_CAP / n));
  let cur = new Float64Array(n);
  let nxt = new Float64Array(n);
  cur[ch.start] = 1;
  const cdf: number[] = [0];
  let done = 0;
  while (1 - done > TAIL && cdf.length <= cap) {
    nxt.fill(0);
    let fin = 0;
    for (let i = 0; i < n; i++) {
      const m = cur[i];
      if (m === 0) continue;
      const s = ch.states[i];
      if (s.win < 0) fin += m * s.p;
      else nxt[s.win] += m * s.p;
      nxt[s.lose] += m * (1 - s.p);
    }
    done += fin;
    cdf.push(Math.min(1, done));
    [cur, nxt] = [nxt, cur];
  }
  return { cdf: Float64Array.from(cdf), truncated: 1 - done > TAIL };
}

/** Smallest number of attempts that finishes with chance >= q, or null if the cap was hit first. */
export function attemptsPercentile(c: Cdf, q: number): number | null {
  const i = c.cdf.findIndex((x) => x >= q - 1e-12);
  return i < 0 ? null : i;
}

/** Chance of finishing within `n` tries. */
export const chanceWithin = (c: Cdf, n: number): number => (n <= 0 ? 0 : c.cdf[Math.min(Math.floor(n), c.cdf.length - 1)]);

// ---- distribution of a cost (kinah or one material) -------------------------------------------------------------

export interface CostSpread {
  median: number | null;
  p90: number | null;
  /** exact convolution, or a seeded simulation when failures drop levels */
  method: "exact" | "simulated";
  /** number of simulated runs (0 when exact) */
  runs: number;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIM_RUNS = 20000;
const SIM_MIN_RUNS = 400;
const SIM_WORK = 2e7; // attempts simulated in total, so a 70,000-attempt rune still answers in about a second
const BINS = 4000;

/** Median and 90th percentile of the total of `weight(step)` x attempts, from `from` to `to`. */
export function costPercentiles(
  steps: readonly Step[],
  from: number,
  to: number,
  weight: (s: Step) => number,
  opts: Opts = {},
): CostSpread {
  const pity = opts.pity ?? true;
  if (to <= from) return { median: 0, p90: 0, method: "exact", runs: 0 };
  const mean = plan(steps, from, to, opts);
  const drops = steps.slice(from, to).some((s) => s.drop > 0);
  if (!mean.feasible) return { median: null, p90: null, method: "exact", runs: 0 };
  const wMean = mean.perLevel.reduce((t, r) => t + r.attempts * weight(steps[r.level]), 0);
  if (wMean <= 0) return { median: 0, p90: 0, method: drops ? "simulated" : "exact", runs: 0 };

  if (drops) {
    const rnd = mulberry32(20261005);
    const totals: number[] = [];
    const runs = Math.max(SIM_MIN_RUNS, Math.min(SIM_RUNS, Math.floor(SIM_WORK / Math.max(1, mean.attempts))));
    for (let run = 0; run < runs; run++) {
      let lvl = from;
      let k = 0;
      let w = 0;
      for (let guard = 0; lvl < to && guard < 5_000_000; guard++) {
        const s = steps[lvl];
        w += weight(s);
        if (rnd() < successAt(s, k, pity)) {
          lvl++;
          k = 0;
        } else if (s.drop > 0 && lvl > 0) {
          lvl = Math.max(0, lvl - s.drop);
          k = 0;
        } else k++;
      }
      totals.push(w);
    }
    totals.sort((x, y) => x - y);
    return { median: totals[Math.ceil(0.5 * runs) - 1], p90: totals[Math.ceil(0.9 * runs) - 1], method: "simulated", runs };
  }

  // exact: levels are independent, so the total is a convolution of per-level (attempts x weight) distributions,
  // kept on a grid of wMean / BINS (rounding error well under 1% of the spread)
  const bin = wMean / BINS;
  let dist = new Map<number, number>([[0, 1]]);
  for (let l = from; l < to; l++) {
    const s = steps[l];
    const w = weight(s);
    const level = new Map<number, number>();
    let alive = 1;
    for (let r = 1; alive > 1e-12 && r < 1e6; r++) {
      const pr = successAt(s, r - 1, pity);
      const key = Math.round((r * w) / bin);
      level.set(key, (level.get(key) ?? 0) + alive * pr);
      alive *= 1 - pr;
      if (pr >= 1) break;
    }
    const next = new Map<number, number>();
    for (const [ka, pa] of dist)
      for (const [kb, pb] of level) {
        const m = pa * pb;
        if (m < 1e-14) continue;
        next.set(ka + kb, (next.get(ka + kb) ?? 0) + m);
      }
    dist = next;
  }
  const keys = [...dist.keys()].sort((x, y) => x - y);
  const at = (q: number) => {
    let acc = 0;
    for (const k of keys) {
      acc += dist.get(k)!;
      if (acc >= q - 1e-9) return k * bin;
    }
    return keys.length ? keys[keys.length - 1] * bin : null;
  };
  return { median: at(0.5), p90: at(0.9), method: "exact", runs: 0 };
}
