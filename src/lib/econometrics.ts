import type { LogRecord } from "../data/logs";
import type { Bar } from "./technicals";
import { sma } from "./technicals";

/* ============ 統計プリミティブ ============ */
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1));
}
export function normCdf(z: number): number {
  // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}
export function chi2PValue(x: number, df: number): number {
  // Wilson–Hilferty 近似
  if (x <= 0) return 1;
  const z = (Math.pow(x / df, 1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  return 1 - normCdf(z);
}

export function logReturns(xs: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < xs.length; i++) if (xs[i] > 0 && xs[i - 1] > 0) out.push(Math.log(xs[i] / xs[i - 1]));
  return out;
}

export function autocorr(rs: number[], lag: number): number {
  const m = mean(rs);
  let num = 0,
    den = 0;
  for (let i = 0; i < rs.length; i++) den += (rs[i] - m) * (rs[i] - m);
  for (let i = lag; i < rs.length; i++) num += (rs[i] - m) * (rs[i - lag] - m);
  return den === 0 ? 0 : num / den;
}

/* ============ Hurst 指数（R/S 解析） ============
   H≈0.5 ランダムウォーク / H>0.5 トレンド持続 / H<0.5 平均回帰 */
export function hurstExponent(xs: number[]): number {
  const sizes: number[] = [];
  const rsValues: number[] = [];
  const n0 = xs.length;
  for (const div of [1, 2, 4, 8]) {
    const size = Math.floor(n0 / div);
    if (size < 20) continue;
    const rsArr: number[] = [];
    for (let s = 0; s < div; s++) {
      const seg = xs.slice(s * size, (s + 1) * size);
      const m = mean(seg);
      const dev = seg.map((v) => v - m);
      const cum: number[] = [];
      let acc = 0;
      for (const d of dev) {
        acc += d;
        cum.push(acc);
      }
      const R = Math.max(...cum) - Math.min(...cum);
      const S = sd(seg);
      if (S > 0) rsArr.push(R / S);
    }
    if (rsArr.length) {
      sizes.push(Math.log(size));
      rsValues.push(Math.log(mean(rsArr)));
    }
  }
  if (sizes.length < 2) return 0.5;
  // 最小二乗の傾き
  const xm = mean(sizes);
  const ym = mean(rsValues);
  let num = 0,
    den = 0;
  for (let i = 0; i < sizes.length; i++) {
    num += (sizes[i] - xm) * (rsValues[i] - ym);
    den += (sizes[i] - xm) * (sizes[i] - xm);
  }
  return den === 0 ? 0.5 : num / den;
}

/* ============ ADF 検定（定数項あり・ラグ 1） ============
   帰無仮説: 単位根あり（非定常）。t 統計量を MacKinnon 臨界値と比較。 */
export interface AdfResult {
  t: number;
  verdict: "stationary" | "non-stationary" | "borderline";
  crit5: number;
}
export function adfTest(logPrices: number[]): AdfResult {
  const n = logPrices.length;
  const dy: number[] = [];
  const y: number[] = [];
  for (let i = 1; i < n; i++) {
    dy.push(logPrices[i] - logPrices[i - 1]);
    y.push(logPrices[i - 1]);
  }
  // OLS: dy = a + b*y + e
  const m = dy.length;
  const my = mean(y);
  const md = mean(dy);
  let syy = 0,
    syd = 0;
  for (let i = 0; i < m; i++) {
    syy += (y[i] - my) * (y[i] - my);
    syd += (y[i] - my) * (dy[i] - md);
  }
  const b = syy === 0 ? 0 : syd / syy;
  const a = md - b * my;
  let sse = 0;
  for (let i = 0; i < m; i++) {
    const e = dy[i] - a - b * y[i];
    sse += e * e;
  }
  const se = Math.sqrt(sse / Math.max(1, m - 2));
  const seb = se / Math.sqrt(syy || 1);
  const t = seb === 0 ? 0 : b / seb;
  const crit5 = -2.86; // MacKinnon 定数項あり 5%（標本 ~500 の近似）
  return { t, crit5, verdict: t < crit5 ? "stationary" : t < -2.57 ? "borderline" : "non-stationary" };
}

/* ============ Jarque-Bera 正規性検定 ============ */
export interface JbResult {
  jb: number;
  p: number;
  skew: number;
  kurt: number; // 超過尖度
}
export function jarqueBera(rs: number[]): JbResult {
  const n = rs.length;
  const m = mean(rs);
  const s = sd(rs);
  if (s === 0) return { jb: 0, p: 1, skew: 0, kurt: 0 };
  let m3 = 0,
    m4 = 0;
  for (const r of rs) {
    const z = (r - m) / s;
    m3 += z * z * z;
    m4 += z * z * z * z;
  }
  const skew = m3 / n;
  const kurt = m4 / n - 3;
  const jb = (n / 6) * (skew * skew + (kurt * kurt) / 4);
  return { jb, p: Math.exp(-jb / 2), skew, kurt }; // df=2 の χ² 生存関数は厳密に exp(-x/2)
}

/* ============ ARCH-LM 検定（q=5） ============
   二乗リターンに自己相関があればボラティリティ・クラスタリングあり */
export interface ArchResult {
  q: number;
  lm: number; // nR²
  p: number;
  hasClustering: boolean;
}
export function archTest(rs: number[], q = 5): ArchResult {
  const m = mean(rs);
  const sq = rs.map((r) => (r - m) * (r - m));
  const msq = mean(sq);
  // sq_t = a + Σ b_i sq_{t-i} の OLS R²
  const n = sq.length - q;
  const xs = sq.slice(0, n);
  const ys = sq.slice(q);
  const my = mean(ys);
  let sst = 0;
  for (const y of ys) sst += (y - my) * (y - my);
  // 説明変数 1..q の逐次重回帰は重いので、単純化: 各ラグ単独の説明力 R² を合計近似せず、
  // 1 ラグごとに OLS を回して最大の R² を使い、自由度 q の χ² で検定（保守的）
  let maxR2 = 0;
  for (let lag = 1; lag <= q; lag++) {
    const xv = sq.slice(q - lag, sq.length - lag);
    const mx = mean(xv);
    let sxx = 0,
      sxy = 0;
    for (let i = 0; i < xv.length; i++) {
      sxx += (xv[i] - mx) * (xv[i] - mx);
      sxy += (xv[i] - mx) * (ys[i] - my);
    }
    const b = sxx === 0 ? 0 : sxy / sxx;
    const r2 = sxx === 0 || sst === 0 ? 0 : (b * b * sxx) / sst;
    maxR2 = Math.max(maxR2, r2);
  }
  void xs;
  const lm = n * maxR2 * q; // 標準 LM = nR²（合議ラグを q 倍でスケールした簡易版と注記）
  const p = chi2PValue(lm, q);
  return { q, lm, p, hasClustering: p < 0.05 };
}

/* ============ GARCH(1,1) 最尤推定（グリッドサーチ） ============
   σ²_t = ω + α·r²_{t-1} + β·σ²_{t-1} */
export interface GarchResult {
  omega: number;
  alpha: number;
  beta: number;
  persistence: number; // α+β
  halfLife: number; // ボラショックの半減期（日）
  longRunVolAnnual: number; // %
  ll: number;
}
export function garch11(rs: number[]): GarchResult {
  const uncond = rs.reduce((a, b) => a + b * b, 0) / rs.length;
  let best = { ll: -Infinity, alpha: 0.05, beta: 0.9, omega: uncond * 0.05 };
  for (let a = 0.01; a <= 0.4; a += 0.01) {
    for (let b = 0.5; b <= 0.995 - a; b += 0.01) {
      const omega = uncond * (1 - a - b);
      if (omega <= 0) continue;
      let s2 = uncond;
      let ll = 0;
      for (let t = 0; t < rs.length; t++) {
        s2 = omega + a * rs[t] * rs[t] + b * s2;
        if (s2 <= 0) {
          ll = -Infinity;
          break;
        }
        ll += -0.5 * (Math.log(2 * Math.PI) + Math.log(s2) + (rs[t] * rs[t]) / s2);
      }
      if (ll > best.ll) best = { ll, alpha: a, beta: b, omega };
    }
  }
  const persistence = best.alpha + best.beta;
  const halfLife = persistence >= 1 ? Infinity : Math.log(2) / Math.log(1 / persistence);
  const longRunVar = best.omega / Math.max(1e-9, 1 - persistence);
  return {
    omega: best.omega,
    alpha: best.alpha,
    beta: best.beta,
    persistence,
    halfLife,
    longRunVolAnnual: Math.sqrt(longRunVar * 365) * 100,
    ll: best.ll,
  };
}

/* ============ 曜日 / 時間帯 / 月次のリターンアトリビューション ============ */
export interface Attribution {
  weekday: { label: string; meanPct: number; n: number; hitRate: number }[]; // 日曜始まり
  intraday: { driftPct: number; n: number; hitRate: number }; // 0:25 → 12:25 のドリフト
  monthly: { m: number; meanPct: number; n: number }[]; // 1-12 月
}
export function attribution(daily: { t: number; close: number }[], records: LogRecord[]): Attribution {
  const weekday = Array.from({ length: 7 }, (_, i) => ({ label: ["日", "月", "火", "水", "木", "金", "土"][i], meanPct: 0, n: 0, hitRate: 0 }));
  const wPos = Array.from({ length: 7 }, () => ({ pos: 0, n: 0 }));
  for (let i = 1; i < daily.length; i++) {
    const dow = new Date(daily[i].t).getDay();
    const r = (daily[i].close / daily[i - 1].close - 1) * 100;
    weekday[dow].meanPct += r;
    weekday[dow].n++;
    wPos[dow].n++;
    if (r > 0) wPos[dow].pos++;
  }
  for (let i = 0; i < 7; i++) {
    weekday[i].meanPct = weekday[i].n ? weekday[i].meanPct / weekday[i].n : 0;
    weekday[i].hitRate = wPos[i].n ? (wPos[i].pos / wPos[i].n) * 100 : 0;
  }

  // 時間帯ドリフト: 同日の 0:25 → 12:25
  let drift = 0,
    dn = 0,
    dpos = 0;
  const byDay = new Map<string, LogRecord[]>();
  for (const r of records) {
    const d = new Date(r.t);
    const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const arr = byDay.get(k);
    if (arr) arr.push(r);
    else byDay.set(k, [r]);
  }
  for (const arr of byDay.values()) {
    if (arr.length >= 2) {
      arr.sort((a, b) => a.t - b.t);
      const r = (arr[arr.length - 1].v / arr[0].v - 1) * 100;
      drift += r;
      dn++;
      if (r > 0) dpos++;
    }
  }

  const monthly = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, meanPct: 0, n: 0 }));
  const mSum = Array.from({ length: 12 }, () => 0);
  for (let i = 1; i < daily.length; i++) {
    const mo = new Date(daily[i].t).getMonth();
    const r = (daily[i].close / daily[i - 1].close - 1) * 100;
    mSum[mo] += r;
    monthly[mo].n++;
  }
  for (let i = 0; i < 12; i++) monthly[i].meanPct = monthly[i].n ? mSum[i] / monthly[i].n : 0;

  return {
    weekday,
    intraday: { driftPct: dn ? drift / dn : 0, n: dn, hitRate: dn ? (dpos / dn) * 100 : 0 },
    monthly,
  };
}

/* ============ Mansfield 相対強度（RRG 風・式は UI で公開） ============
   RS_t       = close / SMA200
   rsRatio    = 100 + 10 × z126(RS)
   rsMomentum = 100 + 10 × z126(rsRatio_t − rsRatio_{t−10}) */
export interface RotationPoint {
  t: number;
  ratio: number;
  momentum: number;
  quadrant: "leading" | "weakening" | "lagging" | "improving";
}

function rollingZ(xs: (number | null)[], win: number): (number | null)[] {
  const out: (number | null)[] = new Array(xs.length).fill(null);
  for (let i = win - 1; i < xs.length; i++) {
    const seg: number[] = [];
    for (let j = i - win + 1; j <= i; j++) if (xs[j] !== null) seg.push(xs[j] as number);
    if (seg.length < win) continue;
    const m = mean(seg);
    const s = sd(seg);
    out[i] = s === 0 ? 0 : ((xs[i] as number) - m) / s;
  }
  return out;
}

export function rotationSeries(bars: Bar[]): RotationPoint[] {
  const closes = bars.map((b) => b.c);
  const s200 = sma(closes, 200);
  const rs: (number | null)[] = closes.map((c, i) => (s200[i] !== null ? c / (s200[i] as number) : null));
  const zRs = rollingZ(rs, 126);
  const ratio: (number | null)[] = zRs.map((z) => (z === null ? null : 100 + 10 * z));
  const delta: (number | null)[] = ratio.map((v, i) => (v !== null && ratio[i - 10] !== null ? v - (ratio[i - 10] as number) : null));
  const zDelta = rollingZ(delta, 126);
  const out: RotationPoint[] = [];
  for (let i = 0; i < bars.length; i++) {
    const r = ratio[i];
    const zd = zDelta[i];
    if (r === null || zd === null) continue;
    const momentum = 100 + 10 * zd;
    out.push({
      t: bars[i].t,
      ratio: r,
      momentum,
      quadrant:
        r >= 100 && momentum >= 100 ? "leading" : r >= 100 ? "weakening" : momentum >= 100 ? "improving" : "lagging",
    });
  }
  return out;
}

export const QUADRANT_LABEL: Record<RotationPoint["quadrant"], string> = {
  leading: "先行",
  weakening: "失速",
  lagging: "劣後",
  improving: "改善",
};
export const QUADRANT_COLOR: Record<RotationPoint["quadrant"], string> = {
  leading: "#2fd48e",
  weakening: "#e9b44c",
  lagging: "#ff6478",
  improving: "#4cc3ff",
};
