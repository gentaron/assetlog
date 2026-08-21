import type { DailyPoint } from "./metrics";

export type DepositTiming = "start" | "mid" | "end";

export interface PureConfig {
  monthlyMYR: number; // 毎月の積立額 (MYR)
  usdRate: number; // MYR per 1 USD
  timing: DepositTiming;
}

export interface PurePoint {
  t: number;
  actual: number; // 実測資産
  pure: number; // 積立分を差し引いた純投資 NAV（初期元本のみを複利）
  base: number; // 貯金のみベースライン（元本 + 積立累計、運用リターン 0）
  deposit: number; // その日に計上された積立 (USD)
}

export interface YearRow {
  year: number;
  depositsUSD: number;
  nDeposits: number;
  startVal: number;
  endVal: number;
  actualGain: number;
  actualGainPct: number;
  twr: number; // その年内の純投資リターン
  partial: boolean;
}

export interface PureResult {
  cfg: PureConfig;
  monthlyUSD: number;
  points: PurePoint[];
  rets: number[]; // 積立調整済みの日次リターン
  nDeposits: number;
  totalDeposits: number; // USD
  totalDepositsMYR: number;
  startValue: number;
  finalActual: number;
  finalPure: number;
  finalBase: number;
  twrTotal: number; // 純投資 総リターン（小数）
  twrAnnual: number; // 年率
  irr: number; // マネーウェイト（IRR、年率・小数）
  premium: number; // 実測 - 貯金のみベースライン（投資が付加した額）
  premiumPct: number;
  depositShare: number; // 名目増加分に占める積立の割合
  years: number;
  volAnnual: number; // 純投資日次リターンの年率ボラ
  sharpePure: number;
  maxDDPure: number; // 負の小数
  bestDay: number;
  worstDay: number;
  upDays: number;
  downDays: number;
  yearly: YearRow[];
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1));
}

const YEAR_MS = 365.25 * 86400000;

function computeIRR(cfs: { t: number; v: number }[]): number {
  const f = (r: number) => cfs.reduce((s, c) => s + c.v / Math.pow(1 + r, c.t), 0);
  let lo = -0.9;
  let hi = 5;
  if (!isFinite(f(lo)) || !isFinite(f(hi)) || f(lo) * f(hi) > 0) return NaN;
  for (let k = 0; k < 90; k++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/**
 * 給与積立を外部キャッシュフローとして扱い、修正ディーツ法（ウェイト 0.5）で
 * 日次リターンから積立効果を除去。純投資 NAV（TWR）を再構築する。
 */
export function computePure(daily: DailyPoint[], startValue: number, cfg: PureConfig): PureResult {
  const monthlyUSD = cfg.monthlyMYR / cfg.usdRate;

  // 月ごとの日次インデックスを収集（daily は時系列順）
  const months = new Map<string, number[]>();
  daily.forEach((d, i) => {
    const dt = new Date(d.t);
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(i);
  });
  const monthKeys = [...months.keys()];
  // ログは 4 月中旬開始のため、積立は翌月から計上（保守的な仮定）
  const depMonths = monthKeys.slice(1);

  const depositAt = new Map<number, number>();
  for (const key of depMonths) {
    const idxs = months.get(key)!;
    let di: number;
    if (cfg.timing === "start") di = idxs[0];
    else if (cfg.timing === "end") di = idxs[idxs.length - 1];
    else
      di = idxs.reduce((a, b) =>
        Math.abs(new Date(daily[b].t).getDate() - 15) < Math.abs(new Date(daily[a].t).getDate() - 15) ? b : a
      );
    depositAt.set(di, monthlyUSD);
  }

  const points: PurePoint[] = [
    { t: daily[0].t, actual: daily[0].close, pure: startValue, base: startValue, deposit: 0 },
  ];
  const rets: number[] = [];
  let pure = startValue;
  let base = startValue;
  for (let i = 1; i < daily.length; i++) {
    const cf = depositAt.get(i) ?? 0;
    const prev = daily[i - 1].close;
    const cur = daily[i].close;
    const denom = prev + 0.5 * cf;
    const r = denom > 0 ? (cur - prev - cf) / denom : 0;
    rets.push(r);
    pure *= 1 + r;
    base += cf;
    points.push({ t: daily[i].t, actual: cur, pure, base, deposit: cf });
  }

  const finalActual = daily[daily.length - 1].close;
  const finalPure = pure;
  const finalBase = base;
  const totalDeposits = depMonths.length * monthlyUSD;
  const years = (daily[daily.length - 1].t - daily[0].t) / YEAR_MS;

  const twrTotal = finalPure / startValue - 1;
  const twrAnnual = Math.pow(1 + twrTotal, 1 / Math.max(years, 0.01)) - 1;

  // IRR（マネーウェイト）: 元本・積立は支出、最終評価額は収入
  const cfs: { t: number; v: number }[] = [{ t: 0, v: -startValue }];
  for (const [di, amt] of depositAt) cfs.push({ t: (daily[di].t - daily[0].t) / YEAR_MS, v: -amt });
  cfs.push({ t: years, v: finalActual });
  const irr = computeIRR(cfs);

  const premium = finalActual - finalBase;
  const premiumPct = premium / finalBase;
  const totalGain = finalActual - startValue;
  const depositShare = totalGain > 0 ? totalDeposits / totalGain : 0;

  const vol = stdev(rets) * Math.sqrt(252);
  const mean = rets.reduce((a, b) => a + b, 0) / Math.max(rets.length, 1);
  const sharpePure = vol > 0 ? (mean * 252) / vol : 0;

  let peak = points[0].pure;
  let maxDDPure = 0;
  for (const p of points) {
    if (p.pure > peak) peak = p.pure;
    const dd = p.pure / peak - 1;
    if (dd < maxDDPure) maxDDPure = dd;
  }

  const bestDay = Math.max(...rets);
  const worstDay = Math.min(...rets);
  const upDays = rets.filter((r) => r > 0).length;
  const downDays = rets.filter((r) => r < 0).length;

  // 年次集計
  const byYear = new Map<number, number[]>();
  daily.forEach((d, i) => {
    const y = new Date(d.t).getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(i);
  });
  const yearKeys = [...byYear.keys()].sort((a, b) => a - b);
  const yearly: YearRow[] = yearKeys.map((y, yi) => {
    const idxs = byYear.get(y)!;
    const first = idxs[0];
    const last = idxs[idxs.length - 1];
    const prevIdxs = yi === 0 ? null : byYear.get(yearKeys[yi - 1])!;
    const startVal =
      yi === 0 || !prevIdxs ? startValue : daily[prevIdxs[prevIdxs.length - 1]].close;
    const endVal = daily[last].close;
    let prod = 1;
    let depUSD = 0;
    let nDep = 0;
    for (const i of idxs) {
      if (i >= 1) prod *= 1 + rets[i - 1];
      const cf = depositAt.get(i) ?? 0;
      if (cf > 0) {
        depUSD += cf;
        nDep++;
      }
    }
    return {
      year: y,
      depositsUSD: depUSD,
      nDeposits: nDep,
      startVal,
      endVal,
      actualGain: endVal - startVal,
      actualGainPct: startVal > 0 ? (endVal - startVal) / startVal : 0,
      twr: prod - 1,
      partial: yi === 0 || yi === yearKeys.length - 1,
    };
  });

  return {
    cfg,
    monthlyUSD,
    points,
    rets,
    nDeposits: depMonths.length,
    totalDeposits,
    totalDepositsMYR: depMonths.length * cfg.monthlyMYR,
    startValue,
    finalActual,
    finalPure,
    finalBase,
    twrTotal,
    twrAnnual,
    irr,
    premium,
    premiumPct,
    depositShare,
    years,
    volAnnual: vol,
    sharpePure,
    maxDDPure,
    bestDay,
    worstDay,
    upDays,
    downDays,
    yearly,
  };
}
