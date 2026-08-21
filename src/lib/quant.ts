import type { DailyPoint } from "./metrics";

const TRADING = 252;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const std = (xs: number[], m = mean(xs)) => Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
const last = <T,>(xs: T[]): T => xs[xs.length - 1];
const dRet = (d: DailyPoint) => d.pl / (d.close - d.pl);

function quantile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export interface QuantStats {
  totalReturn: number;
  cagr: number;
  annVol: number;
  downsideDev: number;
  maxDD: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  ulcer: number;
  recoveryFactor: number;
  kelly: number;
  skew: number;
  kurtosis: number;
  tailRatio: number;
  var95: number;
  cvar95: number;
  var99: number;
  cvar99: number;
  winRate: number;
  payoff: number;
  profitFactor: number;
  expectancy: number;
  avgWin: number;
  avgLoss: number;
  bestDay: number;
  worstDay: number;
  bestMonth: number;
  worstMonth: number;
  upMonthRate: number;
  avgMonthly: number;
  outlierWinDays: number;
  outlierLossDays: number;
  avgDaily: number;
}

export function computeQuant(daily: DailyPoint[], maxDDPct: number): QuantStats {
  const rets = daily.slice(1).map(dRet);
  const m = mean(rets);
  const s = std(rets, m);
  const annVol = s * Math.sqrt(TRADING);
  const neg = rets.filter((r) => r < 0);
  const pos = rets.filter((r) => r > 0);
  const downsideDev = Math.sqrt(neg.reduce((a, r) => a + r * r, 0) / rets.length) * Math.sqrt(TRADING);
  const sharpe = (m * TRADING) / annVol;
  const sortino = (m * TRADING) / downsideDev;
  const maxDD = Math.abs(maxDDPct) / 100;
  const calmar = (m * TRADING) / maxDD;
  const firstV = daily[0].close;
  const lastV = last(daily).close;
  const totalReturn = lastV / firstV - 1;
  const days = daily.length;
  const cagr = Math.pow(lastV / firstV, 365 / days) - 1;
  let peak = -Infinity;
  const dds: number[] = [];
  for (const d of daily) {
    peak = Math.max(peak, d.close);
    dds.push((d.close - peak) / peak);
  }
  const ulcer = Math.sqrt(mean(dds.map((x) => x * x))) * 100;
  const recoveryFactor = totalReturn / maxDD;
  const winRate = pos.length / rets.length;
  const avgWin = pos.length ? mean(pos) : 0;
  const avgLoss = neg.length ? Math.abs(mean(neg)) : 0;
  const payoff = avgLoss > 0 ? avgWin / avgLoss : Infinity;
  const kelly = isFinite(payoff) && payoff > 0 ? winRate - (1 - winRate) / payoff : 0;
  const sumWin = pos.reduce((a, b) => a + b, 0);
  const sumLoss = Math.abs(neg.reduce((a, b) => a + b, 0));
  const profitFactor = sumLoss > 0 ? sumWin / sumLoss : Infinity;
  const sorted = [...rets].sort((a, b) => a - b);
  const q05 = quantile(sorted, 0.05);
  const q95 = quantile(sorted, 0.95);
  const q01 = quantile(sorted, 0.01);
  const tail5 = sorted.filter((r) => r <= q05);
  const tail1 = sorted.filter((r) => r <= q01);
  const skew = rets.reduce((a, r) => a + ((r - m) / s) ** 3, 0) / rets.length;
  const kurtosis = rets.reduce((a, r) => a + ((r - m) / s) ** 4, 0) / rets.length - 3;
  const hi3 = m + 3 * s;
  const lo3 = m - 3 * s;
  const monthly = monthlyReturns(daily).map((mm) => mm.ret);
  const mpos = monthly.filter((r) => r > 0);
  return {
    totalReturn,
    cagr,
    annVol,
    downsideDev,
    maxDD,
    sharpe,
    sortino,
    calmar,
    ulcer,
    recoveryFactor,
    kelly,
    skew,
    kurtosis,
    tailRatio: Math.abs(q05) > 0 ? q95 / Math.abs(q05) : 0,
    var95: -q05,
    cvar95: tail5.length ? -mean(tail5) : -q05,
    var99: -q01,
    cvar99: tail1.length ? -mean(tail1) : -q01,
    winRate,
    payoff,
    profitFactor,
    expectancy: m,
    avgWin,
    avgLoss,
    bestDay: last(sorted),
    worstDay: sorted[0],
    bestMonth: monthly.length ? Math.max(...monthly) : 0,
    worstMonth: monthly.length ? Math.min(...monthly) : 0,
    upMonthRate: monthly.length ? mpos.length / monthly.length : 0,
    avgMonthly: monthly.length ? mean(monthly) : 0,
    outlierWinDays: rets.filter((r) => r > hi3).length,
    outlierLossDays: rets.filter((r) => r < lo3).length,
    avgDaily: m,
  };
}

export interface MonthCell {
  y: number;
  m: number; // 0-11
  ret: number;
  partial: boolean;
}

export function monthlyReturns(daily: DailyPoint[]): MonthCell[] {
  const byMonth = new Map<string, DailyPoint[]>();
  for (const d of daily) {
    const dt = new Date(d.t);
    const k = `${dt.getFullYear()}-${dt.getMonth()}`;
    const arr = byMonth.get(k);
    if (arr) arr.push(d);
    else byMonth.set(k, [d]);
  }
  const keys = [...byMonth.keys()];
  return keys.map((k, i) => {
    const arr = byMonth.get(k)!;
    const [y, m] = k.split("-").map(Number);
    const prevEnd = i > 0 ? last(byMonth.get(keys[i - 1])!).close : arr[0].close;
    return { y, m, ret: last(arr).close / prevEnd - 1, partial: i === keys.length - 1 };
  });
}

export function yearlyReturns(daily: DailyPoint[]): { y: number; ret: number; partial: boolean }[] {
  const byYear = new Map<number, DailyPoint[]>();
  for (const d of daily) {
    const y = new Date(d.t).getFullYear();
    const arr = byYear.get(y);
    if (arr) arr.push(d);
    else byYear.set(y, [d]);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  return years.map((y, i) => {
    const arr = byYear.get(y)!;
    const prevEnd = i > 0 ? last(byYear.get(years[i - 1])!).close : arr[0].close;
    return { y, ret: last(arr).close / prevEnd - 1, partial: y === years[years.length - 1] };
  });
}

export interface RollingPoint {
  t: number;
  sharpe: number | null;
  vol: number | null;
}

export function rollingMetrics(daily: DailyPoint[], win = 30): RollingPoint[] {
  const rets = daily.slice(1).map(dRet);
  const out: RollingPoint[] = [];
  for (let i = 0; i < rets.length; i++) {
    const t = daily[i + 1].t;
    if (i < win - 1) {
      out.push({ t, sharpe: null, vol: null });
      continue;
    }
    const w = rets.slice(i - win + 1, i + 1);
    const m = mean(w);
    const s = std(w, m);
    out.push({ t, sharpe: s > 0 ? (m / s) * Math.sqrt(TRADING) : 0, vol: s * Math.sqrt(TRADING) });
  }
  return out;
}

export interface Episode {
  peakDate: Date;
  troughDate: Date;
  recoveryDate: Date | null;
  depth: number; // negative decimal
  durationDays: number;
  recoveryDays: number | null;
}

export function drawdownEpisodes(daily: DailyPoint[], minDepthPct = 0.5): Episode[] {
  const eps: Episode[] = [];
  let peak = daily[0];
  let trough = daily[0];
  let inDD = false;
  const push = (rec: Date | null) => {
    const depth = (trough.close - peak.close) / peak.close;
    if (Math.abs(depth) * 100 >= minDepthPct)
      eps.push({
        peakDate: new Date(peak.t),
        troughDate: new Date(trough.t),
        recoveryDate: rec,
        depth,
        durationDays: Math.round((trough.t - peak.t) / 86400000),
        recoveryDays: rec ? Math.round((rec.getTime() - trough.t) / 86400000) : null,
      });
  };
  for (const d of daily) {
    if (d.close >= peak.close) {
      if (inDD) push(new Date(d.t));
      inDD = false;
      peak = d;
      trough = d;
    } else if (d.close < trough.close) {
      trough = d;
      inDD = true;
    }
  }
  if (inDD) push(null);
  return eps.sort((a, b) => a.depth - b.depth);
}

export function returnsHistogram(daily: DailyPoint[], bins = 42) {
  const rets = daily.slice(1).map(dRet);
  const min = Math.min(...rets);
  const max = Math.max(...rets);
  const w = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0) as number[];
  for (const r of rets) counts[Math.min(bins - 1, Math.floor((r - min) / w))]++;
  return { min, max, w, counts, mean: mean(rets), std: std(rets), n: rets.length };
}

export function normalPdf(x: number, m: number, s: number) {
  return Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
}

// ---------- Monte Carlo ----------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface McResult {
  labels: Date[];
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  base: number;
  medianFinal: number;
  meanFinal: number;
  p10Final: number;
  p90Final: number;
  probUp: number;
  probUp20: number;
  probDown20: number;
  paths: number;
}

export function monteCarlo(daily: DailyPoint[], steps = 252, paths = 2000, seed = 20260821): McResult {
  const logRets = daily.slice(1).map((d) => Math.log(d.close / (d.close - d.pl)));
  const mu = mean(logRets);
  const sigma = std(logRets, mu);
  const rnd = mulberry32(seed);
  let spare: number | null = null;
  const gauss = () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    do u = rnd();
    while (u <= 1e-12);
    const v = rnd();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };
  const base = last(daily).close;
  const vals = new Float64Array(paths).fill(base);
  const p10: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p90: number[] = [];
  const labels: Date[] = [];
  const lastT = last(daily).t;
  const calStep = (365 / 252) * 86400000;
  const tmp = new Float64Array(paths);
  for (let i = 1; i <= steps; i++) {
    for (let j = 0; j < paths; j++) vals[j] *= Math.exp(mu + sigma * gauss());
    tmp.set(vals);
    tmp.sort();
    p10.push(tmp[Math.floor(paths * 0.1)]);
    p25.push(tmp[Math.floor(paths * 0.25)]);
    p50.push(tmp[Math.floor(paths * 0.5)]);
    p75.push(tmp[Math.floor(paths * 0.75)]);
    p90.push(tmp[Math.floor(paths * 0.9)]);
    labels.push(new Date(lastT + calStep * i));
  }
  let up = 0;
  let up20 = 0;
  let down20 = 0;
  let sum = 0;
  for (let j = 0; j < paths; j++) {
    const v = vals[j];
    sum += v;
    if (v > base) up++;
    if (v > base * 1.2) up20++;
    if (v < base * 0.8) down20++;
  }
  const sortedFinal = Float64Array.from(vals).sort();
  return {
    labels,
    p10,
    p25,
    p50,
    p75,
    p90,
    base,
    medianFinal: sortedFinal[Math.floor(paths * 0.5)],
    meanFinal: sum / paths,
    p10Final: sortedFinal[Math.floor(paths * 0.1)],
    p90Final: sortedFinal[Math.floor(paths * 0.9)],
    probUp: up / paths,
    probUp20: up20 / paths,
    probDown20: down20 / paths,
    paths,
  };
}
