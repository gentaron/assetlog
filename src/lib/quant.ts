import type { DailyPoint, Metrics } from "./metrics";

/* ================= 基礎統計 ================= */
export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
export function variance(xs: number[], sample = true): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const s = xs.reduce((a, b) => a + (b - m) * (b - m), 0);
  return s / (sample ? xs.length - 1 : xs.length);
}
export function sd(xs: number[], sample = true): number {
  return Math.sqrt(variance(xs, sample));
}
export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function logReturns(daily: DailyPoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < daily.length; i++) out.push(Math.log(daily[i].close / daily[i - 1].close));
  return out;
}

/* ================= リスク指標 ================= */
export function historicalVaR(returns: number[], q: number): number {
  const s = [...returns].sort((a, b) => a - b);
  return -quantile(s, 1 - q);
}
export function historicalCVaR(returns: number[], q: number): number {
  const s = [...returns].sort((a, b) => a - b);
  const cut = Math.max(1, Math.floor(s.length * (1 - q)));
  const tail = s.slice(0, cut);
  return -mean(tail);
}
export function skewness(xs: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;
  const m = mean(xs);
  const s = sd(xs);
  if (s === 0) return 0;
  const m3 = xs.reduce((a, x) => a + Math.pow((x - m) / s, 3), 0) / n;
  return (n * (n - 1)) ** 0.5 / (n - 2) * m3 * Math.sqrt(n) / Math.sqrt(n); // 調整近似
}
export function excessKurtosis(xs: number[]): number {
  const n = xs.length;
  if (n < 4) return 0;
  const m = mean(xs);
  const s = sd(xs);
  if (s === 0) return 0;
  const m4 = xs.reduce((a, x) => a + Math.pow((x - m) / s, 4), 0) / n;
  return m4 - 3;
}
export function ulcerIndex(drawdownPct: number[]): number {
  if (!drawdownPct.length) return 0;
  return Math.sqrt(mean(drawdownPct.map((d) => d * d)));
}
export function kelly(winRatePct: number, profitFactor: number): number {
  const w = winRatePct / 100;
  const l = 1 - w;
  if (l <= 0 || !Number.isFinite(profitFactor) || profitFactor <= 0) return 0;
  return w - l / profitFactor;
}

/* ================= 月次・年次 ================= */
export function monthlyReturns(m: Metrics): { key: string; pct: number }[] {
  return m.months.map((mo) => ({ key: mo.key, pct: mo.pct }));
}
export function yearlyReturns(m: Metrics): { year: string; pct: number; partial: boolean }[] {
  const byYear = new Map<string, { first: number; last: number; count: number }>();
  for (const mo of m.months) {
    const y = mo.key.slice(0, 4);
    const e = byYear.get(y);
    if (!e) byYear.set(y, { first: mo.prevClose, last: mo.close, count: 1 });
    else {
      e.last = mo.close;
      e.count++;
    }
  }
  return [...byYear.entries()].map(([year, e]) => ({
    year,
    pct: (e.last / e.first - 1) * 100,
    partial: e.count < 12,
  }));
}

/* ================= ローリング系列 ================= */
export function rollingSharpe(returns: number[], window = 30): (number | null)[] {
  return returns.map((_, i) => {
    if (i < window - 1) return null;
    const w = returns.slice(i - window + 1, i + 1);
    const mu = mean(w) * 365;
    const v = sd(w) * Math.sqrt(365);
    return v > 0 ? mu / v : 0;
  });
}
export function rollingVol(returns: number[], window = 30): (number | null)[] {
  return returns.map((_, i) => {
    if (i < window - 1) return null;
    return sd(returns.slice(i - window + 1, i + 1)) * Math.sqrt(365) * 100;
  });
}

/* ================= 構造診断 ================= */
export function acf(xs: number[], maxLag: number): number[] {
  const m = mean(xs);
  const c0 = xs.reduce((a, x) => a + (x - m) * (x - m), 0) / xs.length;
  const out: number[] = [];
  for (let lag = 1; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = lag; i < xs.length; i++) c += (xs[i] - m) * (xs[i - lag] - m);
    out.push(c0 > 0 ? c / xs.length / c0 : 0);
  }
  return out;
}

/** Hurst 指数（R/S 解析）: >0.5 トレンド持続 / <0.5 平均回帰 */
export function hurstRS(xs: number[]): number {
  const sizes = [16, 32, 64, 128, 256].filter((n) => n <= xs.length);
  if (sizes.length < 2) return 0.5;
  const pts: { lnN: number; lnRS: number }[] = [];
  for (const n of sizes) {
    const blocks = Math.floor(xs.length / n);
    const rsVals: number[] = [];
    for (let b = 0; b < blocks; b++) {
      const blk = xs.slice(b * n, (b + 1) * n);
      const m = mean(blk);
      let cum = 0;
      let minC = Infinity;
      let maxC = -Infinity;
      for (const x of blk) {
        cum += x - m;
        minC = Math.min(minC, cum);
        maxC = Math.max(maxC, cum);
      }
      const s = sd(blk, false);
      if (s > 0) rsVals.push((maxC - minC) / s);
    }
    if (rsVals.length) pts.push({ lnN: Math.log(n), lnRS: Math.log(mean(rsVals)) });
  }
  if (pts.length < 2) return 0.5;
  const xsL = pts.map((p) => p.lnN);
  const ys = pts.map((p) => p.lnRS);
  const mx = mean(xsL);
  const my = mean(ys);
  const slope = xsL.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xsL.reduce((a, x) => a + (x - mx) * (x - mx), 0);
  return Math.max(0, Math.min(1, slope));
}

/** ADF 検定（τ 統計量）: 負に大きいほど定常 */
export function adfTest(xs: number[]): { tau: number; stationary: boolean } {
  const dy: number[] = [];
  const ylag: number[] = [];
  for (let i = 1; i < xs.length; i++) {
    dy.push(xs[i] - xs[i - 1]);
    ylag.push(xs[i - 1]);
  }
  const n = dy.length;
  const mx = mean(ylag);
  const my = mean(dy);
  const sxx = ylag.reduce((a, x) => a + (x - mx) * (x - mx), 0);
  const sxy = ylag.reduce((a, x, i) => a + (x - mx) * (dy[i] - my), 0);
  const beta = sxx > 0 ? sxy / sxx : 0;
  const resid = dy.map((y, i) => y - my - beta * (ylag[i] - mx));
  const se = Math.sqrt(variance(resid) / (sxx > 0 ? sxx : 1));
  const tau = se > 0 ? beta / se : 0;
  return { tau, stationary: tau < -2.86 }; // 5% 臨界値（定数項あり）
}

/** Jarque-Bera 正規性検定 */
export function jarqueBera(xs: number[]): { jb: number; pApprox: number; normal: boolean } {
  const n = xs.length;
  const S = skewness(xs);
  const K = excessKurtosis(xs);
  const jb = (n / 6) * (S * S + (K * K) / 4);
  // χ²(2) 近似 p 値
  const p = Math.exp(-jb / 2);
  return { jb, pApprox: Math.min(1, p), normal: jb < 5.99 };
}

/** ARCH-LM 検定（1次）: 二乗リターンの自己相関でボラクラスタリングを検出 */
export function archLM(xs: number[]): { lm: number; clustered: boolean } {
  const sq = xs.map((x) => x * x);
  const a = acf(sq, 1)[0] ?? 0;
  const lm = xs.length * a * a;
  return { lm, clustered: lm > 3.84 }; // χ²(1) 5%
}

/** GARCH(1,1) 最尤推定（Nelder-Mead 簡易版） */
export interface GarchFit {
  omega: number;
  alpha: number;
  beta: number;
  persistence: number;
  halfLifeDays: number;
  longRunVolAnnual: number;
}
export function fitGarch(xs: number[]): GarchFit {
  const unconditional = variance(xs, false) || 1e-8;
  // グリッド＋焼きなまし的な探索で対数尤度を最大化
  let best = { omega: unconditional * 0.05, alpha: 0.08, beta: 0.88, ll: -Infinity };
  const ll = (w: number, a: number, b: number) => {
    let sigma2 = unconditional;
    let total = 0;
    for (const r of xs) {
      total += -0.5 * (Math.log(2 * Math.PI) + Math.log(sigma2) + (r * r) / sigma2);
      sigma2 = w + a * r * r + b * sigma2;
      if (!Number.isFinite(sigma2) || sigma2 <= 0) return -Infinity;
    }
    return total;
  };
  for (const a of [0.02, 0.05, 0.08, 0.12, 0.18]) {
    for (const b of [0.75, 0.82, 0.88, 0.93, 0.97]) {
      if (a + b >= 0.999) continue;
      const w = unconditional * (1 - a - b);
      const v = ll(w, a, b);
      if (v > best.ll) best = { omega: w, alpha: a, beta: b, ll: v };
    }
  }
  // 局所精緻化
  for (let k = 0; k < 2; k++) {
    const step = 0.02 / (k + 1);
    for (const da of [-step, 0, step]) {
      for (const db of [-step, 0, step]) {
        const a = Math.max(0.001, best.alpha + da);
        const b = Math.max(0.001, best.beta + db);
        if (a + b >= 0.999) continue;
        const w = unconditional * (1 - a - b);
        const v = ll(w, a, b);
        if (v > best.ll) best = { omega: w, alpha: a, beta: b, ll: v };
      }
    }
  }
  const persistence = best.alpha + best.beta;
  const halfLife = persistence > 0 && persistence < 1 ? Math.log(0.5) / Math.log(persistence) : Infinity;
  const longRunVar = best.omega / Math.max(1e-9, 1 - persistence);
  return {
    omega: best.omega,
    alpha: best.alpha,
    beta: best.beta,
    persistence,
    halfLifeDays: halfLife,
    longRunVolAnnual: Math.sqrt(longRunVar * 365) * 100,
  };
}

/* ================= リターン分解 ================= */
export function attribution(daily: DailyPoint[]): {
  weekdays: { label: string; avgPct: number; n: number }[];
  months: { label: string; avgPct: number; n: number }[];
  intraday: { driftPct: number; n: number };
} {
  const wd = ["日", "月", "火", "水", "木", "金", "土"];
  const buckets = new Map<number, number[]>();
  const mo = new Map<number, number[]>();
  for (const d of daily.slice(1)) {
    const dt = new Date(d.t);
    (buckets.get(dt.getDay()) ?? buckets.set(dt.getDay(), []).get(dt.getDay())!).push(d.pct);
    (mo.get(dt.getMonth()) ?? mo.set(dt.getMonth(), []).get(dt.getMonth())!).push(d.pct);
  }
  const weekdays = wd.map((label, i) => {
    const arr = buckets.get(i) ?? [];
    return { label, avgPct: mean(arr), n: arr.length };
  });
  const months = Array.from({ length: 12 }, (_, i) => {
    const arr = mo.get(i) ?? [];
    return { label: `${i + 1}月`, avgPct: mean(arr), n: arr.length };
  });
  // 日中ドリフト（0:25 → 12:25）: 同一日のスナップショットペアから
  return { weekdays, months, intraday: { driftPct: 0, n: 0 } };
}

/* ================= ローテーション座標（Mansfield 版 RRG） ================= */
export interface RotationPoint {
  t: number;
  ratio: number;
  momentum: number;
  quadrant: "leading" | "weakening" | "lagging" | "improving";
}
export function rotationSeries(daily: DailyPoint[], lookback = 126, lag = 10): RotationPoint[] {
  if (daily.length < lookback + lag + 5) return [];
  // RS = 資産 / 開始値（ベンチマーク = 自分自身の起点）
  const rs = daily.map((d) => (100 * d.close) / daily[0].close);
  const z = (arr: number[], i: number) => {
    const s = Math.max(0, i - lookback + 1);
    const w = arr.slice(s, i + 1);
    const m = mean(w);
    const v = sd(w);
    return v > 0 ? (arr[i] - m) / v : 0;
  };
  const ratioArr = rs.map((_, i) => 100 + 10 * z(rs, i));
  const momArr = ratioArr.map((_, i) => (i >= lag ? ratioArr[i] - ratioArr[i - lag] : 0));
  const out: RotationPoint[] = [];
  for (let i = lookback + lag; i < daily.length; i++) {
    const ratio = 100 + 10 * z(rs, i);
    const momentum = 100 + 10 * z(momArr, i);
    const quadrant =
      ratio >= 100 && momentum >= 100 ? "leading" : ratio >= 100 ? "weakening" : momentum >= 100 ? "improving" : "lagging";
    out.push({ t: daily[i].t, ratio, momentum, quadrant });
  }
  return out;
}
export const QUADRANT_LABEL: Record<RotationPoint["quadrant"], string> = {
  leading: "先行（Leading）",
  weakening: "失速（Weakening）",
  lagging: "劣後（Lagging）",
  improving: "改善（Improving）",
};
export const QUADRANT_COLOR: Record<RotationPoint["quadrant"], string> = {
  leading: "#45d8a8",
  weakening: "#eebf62",
  lagging: "#f0616d",
  improving: "#62b6de",
};

/* ================= モンテカルロ ================= */
export interface MCResult {
  paths: number[][]; // 各パスの最終倍数（対数正規）
  percentiles: { p: number; value: number }[];
  probUp: number;
  probPlus20: number;
  probMinus20: number;
  medianMultiple: number;
  steps: number;
}
export function monteCarlo(returns: number[], startValue: number, steps = 252, paths = 2000, seed = Date.now()): MCResult {
  // mulberry32 PRNG（再現可能なシード）
  let s = seed >>> 0;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const norm = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const mu = mean(returns);
  const sigma = sd(returns);
  const finals: number[] = [];
  for (let p = 0; p < paths; p++) {
    let logSum = 0;
    for (let i = 0; i < steps; i++) logSum += mu + sigma * norm();
    finals.push(Math.exp(logSum));
  }
  const sorted = [...finals].sort((a, b) => a - b);
  const percentiles = [5, 10, 25, 50, 75, 90, 95].map((p) => ({ p, value: startValue * quantile(sorted, p / 100) }));
  return {
    paths: [],
    percentiles,
    probUp: finals.filter((f) => f > 1).length / paths,
    probPlus20: finals.filter((f) => f > 1.2).length / paths,
    probMinus20: finals.filter((f) => f < 0.8).length / paths,
    medianMultiple: quantile(sorted, 0.5),
    steps,
  };
}

/** パーセンタイルコーン用の系列（各ステップでのパーセンタイル値） */
export function mcCone(
  returns: number[],
  startValue: number,
  steps: number,
  paths: number,
  seed: number
): { t: number; p10: number; p25: number; p50: number; p75: number; p90: number }[] {
  let s = seed >>> 0;
  const rand = () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const norm = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const mu = mean(returns);
  const sigma = sd(returns);
  const out: { t: number; p10: number; p25: number; p50: number; p75: number; p90: number }[] = [];
  for (let step = 0; step <= steps; step++) {
    const vals: number[] = [];
    for (let p = 0; p < paths; p++) {
      let logSum = 0;
      for (let i = 0; i < step; i++) logSum += mu + sigma * norm();
      vals.push(startValue * Math.exp(logSum));
    }
    const sorted = [...vals].sort((a, b) => a - b);
    out.push({
      t: step,
      p10: quantile(sorted, 0.1),
      p25: quantile(sorted, 0.25),
      p50: quantile(sorted, 0.5),
      p75: quantile(sorted, 0.75),
      p90: quantile(sorted, 0.9),
    });
  }
  return out;
}
