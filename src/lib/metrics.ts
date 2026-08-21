import { parseLog, type LogRecord } from "../data/logs";

const DAY = 86_400_000;

export interface DailyPoint {
  t: number; // 日付（00:00）
  close: number; // その日最後のスナップショット
  pl: number; // 前日比 $
  pct: number; // 前日比 %
}

export interface MonthRow {
  key: string; // "2025-04"
  label: string; // "2025/04"
  close: number;
  prevClose: number;
  pl: number;
  pct: number; // 前月末比 %
  cumPct: number; // 開始比 %
  partial?: boolean;
}

export interface Milestone {
  target: number;
  label: string;
  t: number | null; // 達成時刻（未達成は null）
  days: number | null; // 開始からの日数
  projected: "linear" | "cagr" | null; // 未達成時の推定方式
}

export interface Metrics {
  records: LogRecord[];
  totalRows: number;
  naRows: number;
  daily: DailyPoint[];
  start: LogRecord;
  latest: LogRecord;
  startValue: number;
  latestValue: number;
  gain: number;
  totalReturn: number; // %
  days: number;
  years: number;
  cagr: number; // %
  avgDaily: number; // $/日
  avgMonthly: number; // $/月
  volAnnual: number; // %
  downsideVolAnnual: number; // %
  sharpe: number;
  sortino: number;
  calmar: number;
  winRate: number; // %（前日比プラスの日）
  profitFactor: number;
  bestDay: DailyPoint;
  worstDay: DailyPoint;
  upDays: number;
  downDays: number;
  flatDays: number;
  currentStreak: number; // 直近の連続プラス日数（マイナスなら連続マイナス）
  mdd: number; // %（負値）
  mddPeak: LogRecord;
  mddTrough: LogRecord;
  mddRecovery: LogRecord | null;
  drawdown: { t: number; dd: number }[]; // 全レコードの水中曲線（%≤0）
  months: MonthRow[];
  bestMonth: MonthRow;
  worstMonth: MonthRow;
  positiveMonths: number;
  negativeMonths: number;
  milestones: Milestone[];
  isAllTimeHigh: boolean;
  newHighCount: number;
  projected1y: number; // 1年後推計（CAGR 一定）
  projectDouble: { t: number; method: string };
  project100k: { t: number; method: string };
  project70k: { t: number; method: string };
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1));
}

export function computeMetrics(parsed: ParsedLog = parseLog()): Metrics {
  const { records, totalRows, naRows } = parsed;
  const start = records[0];
  const latest = records[records.length - 1];
  const startValue = start.v;
  const latestValue = latest.v;
  const gain = latestValue - startValue;
  const totalReturn = (gain / startValue) * 100;

  const days = Math.max(1, Math.round((latest.t - start.t) / DAY));
  const years = days / 365.25;
  const cagr = (Math.pow(latestValue / startValue, 1 / years) - 1) * 100;
  const avgDaily = gain / days;
  const avgMonthly = gain / (days / 30.437);

  // ---- 日次系列（各暦日の最終スナップショット）----
  const byDay = new Map<string, LogRecord>();
  for (const r of records) {
    const d = new Date(r.t);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const prev = byDay.get(key);
    if (!prev || r.t >= prev.t) byDay.set(key, r);
  }
  const dayEnds = [...byDay.values()].sort((a, b) => a.t - b.t);
  const daily: DailyPoint[] = [];
  for (let i = 0; i < dayEnds.length; i++) {
    const r = dayEnds[i];
    const prev = i === 0 ? null : dayEnds[i - 1];
    const pl = prev ? r.v - prev.v : 0;
    const pct = prev ? ((r.v - prev.v) / prev.v) * 100 : 0;
    const d0 = new Date(r.t);
    daily.push({ t: new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime(), close: r.v, pl, pct });
  }

  // 欠測日は線形補間して日次リターンを正規化（ボラティリティ計算用）
  const normalizedReturns: number[] = [];
  for (let i = 1; i < daily.length; i++) {
    const gapDays = Math.max(1, Math.round((daily[i].t - daily[i - 1].t) / DAY));
    const total = daily[i].close / daily[i - 1].close - 1;
    const per = Math.pow(1 + total, 1 / gapDays) - 1;
    for (let k = 0; k < gapDays; k++) normalizedReturns.push(per);
  }
  const volDaily = stdev(normalizedReturns);
  const volAnnual = volDaily * Math.sqrt(365) * 100;
  const negatives = normalizedReturns.filter((r) => r < 0);
  const downsideDaily = stdev(negatives.length ? negatives : [0]);
  const downsideVolAnnual = downsideDaily * Math.sqrt(365) * 100;

  const RF = 4.0; // 無リスク金利想定 %
  const sharpe = volAnnual > 0 ? (cagr - RF) / volAnnual : 0;
  const sortino = downsideVolAnnual > 0 ? (cagr - RF) / downsideVolAnnual : 0;

  // ---- ドローダウン（全レコード）----
  const drawdown: { t: number; dd: number }[] = [];
  let peak = -Infinity;
  let peakRec = records[0];
  let mdd = 0;
  let mddPeak = records[0];
  let mddTrough = records[0];
  for (const r of records) {
    if (r.v > peak) {
      peak = r.v;
      peakRec = r;
    }
    const dd = ((r.v - peak) / peak) * 100;
    drawdown.push({ t: r.t, dd });
    if (dd < mdd) {
      mdd = dd;
      mddPeak = peakRec;
      mddTrough = r;
    }
  }
  let mddRecovery: LogRecord | null = null;
  for (const r of records) {
    if (r.t > mddTrough.t && r.v >= mddPeak.v) {
      mddRecovery = r;
      break;
    }
  }
  const calmar = mdd !== 0 ? cagr / Math.abs(mdd) : 0;

  // ---- 日次勝率・プロフィットファクター ----
  const changes = daily.slice(1);
  const upDays = changes.filter((d) => d.pl > 0).length;
  const downDays = changes.filter((d) => d.pl < 0).length;
  const flatDays = changes.filter((d) => d.pl === 0).length;
  const winRate = (upDays / Math.max(1, changes.length)) * 100;
  const grossWin = changes.filter((d) => d.pl > 0).reduce((a, b) => a + b.pl, 0);
  const grossLoss = Math.abs(changes.filter((d) => d.pl < 0).reduce((a, b) => a + b.pl, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : Infinity;

  let bestDay = daily[1];
  let worstDay = daily[1];
  for (const d of daily.slice(1)) {
    if (d.pct > bestDay.pct) bestDay = d;
    if (d.pct < worstDay.pct) worstDay = d;
  }

  // 直近連続
  let currentStreak = 0;
  for (let i = daily.length - 1; i >= 1; i--) {
    const s = Math.sign(daily[i].pl);
    if (s === 0) continue;
    if (currentStreak === 0) currentStreak = s;
    else if (Math.sign(currentStreak) !== s) break;
    else currentStreak += s;
  }

  // ---- 月次集計 ----
  const monthMap = new Map<string, LogRecord>();
  for (const r of records) {
    const d = new Date(r.t);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const prev = monthMap.get(key);
    if (!prev || r.t >= prev.t) monthMap.set(key, r);
  }
  const lastMonthKey = [...monthMap.keys()].sort().pop()!;
  const months: MonthRow[] = [];
  let prevClose = startValue;
  for (const key of [...monthMap.keys()].sort()) {
    const close = monthMap.get(key)!.v;
    const [y, m] = key.split("-");
    months.push({
      key,
      label: `${y}/${m}`,
      close,
      prevClose,
      pl: close - prevClose,
      pct: ((close - prevClose) / prevClose) * 100,
      cumPct: ((close - startValue) / startValue) * 100,
      partial: key === lastMonthKey,
    });
    prevClose = close;
  }
  const completed = months.filter((m) => !m.partial);
  const pool = completed.length ? completed : months;
  const bestMonth = pool.reduce((a, b) => (b.pct > a.pct ? b : a));
  const worstMonth = pool.reduce((a, b) => (b.pct < a.pct ? b : a));
  const positiveMonths = months.filter((m) => m.pl > 0).length;
  const negativeMonths = months.filter((m) => m.pl < 0).length;

  // ---- マイルストーン ----
  const achieved = new Map<number, LogRecord>();
  const targets = [40000, 45000, 50000, 55000, 60000, 65000, 70000];
  for (const r of records) {
    for (const tg of targets) {
      if (!achieved.has(tg) && r.v >= tg) achieved.set(tg, r);
    }
  }
  const linearDate = (target: number) => latest.t + Math.ceil((target - latestValue) / avgDaily) * DAY;
  const cagrDate = (target: number) =>
    latest.t + (Math.log(target / latestValue) / Math.log(1 + cagr / 100)) * 365.25 * DAY;

  const milestones: Milestone[] = targets.map((tg) => {
    const hit = achieved.get(tg);
    return {
      target: tg,
      label: `$${(tg / 1000).toFixed(0)}k`,
      t: hit ? hit.t : null,
      days: hit ? Math.round((hit.t - start.t) / DAY) : null,
      projected: hit ? null : "linear",
    };
  });

  const isAllTimeHigh = latestValue >= Math.max(...records.map((r) => r.v));
  let newHighCount = 0;
  let runMax = -Infinity;
  for (const r of records) {
    if (r.v > runMax) {
      runMax = r.v;
      newHighCount++;
    }
  }

  const projected1y = latestValue * Math.pow(1 + cagr / 100, 1);
  const projectDouble = { t: cagrDate(startValue * 2), method: "CAGR 一定換算" };
  const project100k = { t: cagrDate(100000), method: "CAGR 一定換算" };
  const project70k = {
    t: achieved.get(70000) ? achieved.get(70000)!.t : linearDate(70000),
    method: achieved.get(70000) ? "達成済み" : "平均日次ペース",
  };

  return {
    records,
    totalRows,
    naRows,
    daily,
    start,
    latest,
    startValue,
    latestValue,
    gain,
    totalReturn,
    days,
    years,
    cagr,
    avgDaily,
    avgMonthly,
    volAnnual,
    downsideVolAnnual,
    sharpe,
    sortino,
    calmar,
    winRate,
    profitFactor,
    bestDay,
    worstDay,
    upDays,
    downDays,
    flatDays,
    currentStreak,
    mdd,
    mddPeak,
    mddTrough,
    mddRecovery,
    drawdown,
    months,
    bestMonth,
    worstMonth,
    positiveMonths,
    negativeMonths,
    milestones,
    isAllTimeHigh,
    newHighCount,
    projected1y,
    projectDouble,
    project100k,
    project70k,
  };
}

// ---------- format helpers ----------
export const fmtUsd = (v: number, digits = 2) =>
  "$" + v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtUsdCompact = (v: number) =>
  v >= 1000 ? "$" + (v / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "k" : fmtUsd(v, 0);

export const fmtSignedUsd = (v: number, digits = 2) =>
  (v >= 0 ? "+$" : "-$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtPct = (v: number, digits = 2, signed = true) =>
  (signed && v > 0 ? "+" : "") + v.toFixed(digits) + "%";

export const fmtDate = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
};

export const fmtDateTime = (t: number) => {
  const d = new Date(t);
  return `${fmtDate(t)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
