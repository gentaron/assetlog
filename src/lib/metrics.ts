import { parseLog, type LogRecord, type ParsedLog } from "../data/logs";

export interface DailyPoint {
  t: number;
  close: number;
  pl: number; // 前日比 $
  pct: number; // 前日比 %
}

export interface MonthRow {
  key: string;
  label: string;
  close: number;
  prevClose: number;
  pl: number;
  pct: number;
  cumPct: number;
}

export interface Milestone {
  level: number;
  t: number | null;
  days: number | null;
  projected: string | null;
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
  totalReturn: number;
  days: number;
  years: number;
  cagr: number;
  avgDaily: number;
  avgMonthly: number;
  volAnnual: number;
  downsideVolAnnual: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  winRate: number;
  profitFactor: number;
  bestDay: DailyPoint;
  worstDay: DailyPoint;
  upDays: number;
  downDays: number;
  flatDays: number;
  currentStreak: number;
  mdd: number;
  mddPeak: LogRecord;
  mddTrough: LogRecord;
  mddRecovery: LogRecord | null;
  drawdown: { t: number; dd: number }[];
  months: MonthRow[];
  bestMonth: MonthRow;
  worstMonth: MonthRow;
  positiveMonths: number;
  negativeMonths: number;
  milestones: Milestone[];
  isAllTimeHigh: boolean;
  newHighCount: number;
  projected1y: number;
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
  // 空系列が渡されても絶対にクラッシュさせない（埋め込み → 再パース → 合成フォールバック）
  let src = parsed;
  if (!src.records.length) src = parseLog();
  if (!src.records.length) {
    const now = Date.now();
    src = { records: [{ t: now - 86400000, v: 1 }, { t: now, v: 1 }], totalRows: 2, naRows: 0 };
  }
  const { records, totalRows, naRows } = src;
  const start = records[0];
  const latest = records[records.length - 1];
  const startValue = start.v;
  const latestValue = latest.v;
  const gain = latestValue - startValue;
  const totalReturn = (gain / startValue) * 100;

  const DAY = 86400000;
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
  const dayKeys = [...byDay.keys()].sort();
  const daily: DailyPoint[] = dayKeys.map((k) => {
    const r = byDay.get(k)!;
    return { t: r.t, close: r.v, pl: 0, pct: 0 };
  });
  for (let i = 1; i < daily.length; i++) {
    daily[i].pl = daily[i].close - daily[i - 1].close;
    daily[i].pct = (daily[i].pl / daily[i - 1].close) * 100;
  }

  const changes = daily.slice(1);
  const volDaily = stdev(changes.map((d) => d.pct / 100));
  const volAnnual = volDaily * Math.sqrt(365) * 100;
  const downside = changes.filter((d) => d.pct < 0).map((d) => d.pct / 100);
  const downsideVolAnnual = stdev(downside) * Math.sqrt(365) * 100;
  const dailyMean = changes.length ? changes.reduce((a, d) => a + d.pct, 0) / changes.length : 0;
  const sharpe = volAnnual > 0 ? ((dailyMean * 365) / volAnnual) : 0;
  const sortino = downsideVolAnnual > 0 ? ((dailyMean * 365) / downsideVolAnnual) : 0;

  // ---- ドローダウン（全レコード）----
  let runMax = -Infinity;
  let mdd = 0;
  let mddPeak = start;
  let mddTrough = start;
  let curPeak = start;
  const drawdown: { t: number; dd: number }[] = [];
  for (const r of records) {
    if (r.v > runMax) {
      runMax = r.v;
      curPeak = r;
    }
    const dd = ((r.v - runMax) / runMax) * 100;
    drawdown.push({ t: r.t, dd });
    if (dd < mdd) {
      mdd = dd;
      mddPeak = curPeak;
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
  const calmar = mdd < 0 ? cagr / Math.abs(mdd) : 0;

  // ---- 勝率・PF・連勝 ----
  const ups = changes.filter((d) => d.pl > 0);
  const downs = changes.filter((d) => d.pl < 0);
  const flats = changes.filter((d) => d.pl === 0);
  const winRate = changes.length ? (ups.length / changes.length) * 100 : 0;
  const grossWin = ups.reduce((a, d) => a + d.pl, 0);
  const grossLoss = Math.abs(downs.reduce((a, d) => a + d.pl, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
  let currentStreak = 0;
  for (let i = changes.length - 1; i >= 0; i--) {
    const s = changes[i].pl > 0 ? 1 : changes[i].pl < 0 ? -1 : 0;
    if (s === 0) break;
    if (currentStreak === 0) currentStreak = s;
    else if (Math.sign(currentStreak) === s) currentStreak += s;
    else break;
  }
  const bestDay = changes.reduce((a, b) => (b.pl > a.pl ? b : a), changes[0] ?? daily[0]);
  const worstDay = changes.reduce((a, b) => (b.pl < a.pl ? b : a), changes[0] ?? daily[0]);

  // ---- 月次 ----
  const byMonth = new Map<string, LogRecord>();
  for (const r of records) {
    const d = new Date(r.t);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const prev = byMonth.get(key);
    if (!prev || r.t >= prev.t) byMonth.set(key, r);
  }
  const monthKeys = [...byMonth.keys()].sort();
  const months: MonthRow[] = monthKeys.map((k, i) => {
    const close = byMonth.get(k)!.v;
    const prevClose = i === 0 ? startValue : byMonth.get(monthKeys[i - 1])!.v;
    const pl = close - prevClose;
    return {
      key: k,
      label: k.replace("-", "/"),
      close,
      prevClose,
      pl,
      pct: (pl / prevClose) * 100,
      cumPct: ((close - startValue) / startValue) * 100,
    };
  });
  const bestMonth = months.reduce((a, b) => (b.pct > a.pct ? b : a), months[0]);
  const worstMonth = months.reduce((a, b) => (b.pct < a.pct ? b : a), months[0]);
  const positiveMonths = months.filter((m) => m.pl > 0).length;
  const negativeMonths = months.filter((m) => m.pl < 0).length;

  // ---- マイルストーン ----
  const mkMilestone = (level: number): Milestone => {
    const hit = records.find((r) => r.v >= level);
    if (hit) return { level, t: hit.t, days: Math.round((hit.t - start.t) / DAY), projected: null };
    // 未到達 → 直近 90 日の日次平均増分から線形予測
    const recent = daily.slice(-90);
    const perDay =
      recent.length > 1 ? (recent[recent.length - 1].close - recent[0].close) / Math.max(1, recent.length - 1) : avgDaily;
    const need = level - latestValue;
    const t = perDay > 0 ? latest.t + (need / perDay) * DAY : latest.t + 365 * DAY;
    return { level, t: null, days: null, projected: "linear" };
  };
  const milestones: Milestone[] = [];
  for (let lv = 40000; lv <= 65000; lv += 5000) milestones.push(mkMilestone(lv));
  const project70k = mkMilestone(70000);
  const projectDouble = mkMilestone(startValue * 2);
  const project100k = mkMilestone(100000);
  const projected1y = latestValue * Math.pow(1 + cagr / 100, 1);

  const isAllTimeHigh = latestValue >= Math.max(...records.map((r) => r.v));
  let newHighCount = 0;
  let runMax2 = -Infinity;
  for (const r of records) {
    if (r.v > runMax2) {
      runMax2 = r.v;
      newHighCount++;
    }
  }

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
    upDays: ups.length,
    downDays: downs.length,
    flatDays: flats.length,
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
    projectDouble: { t: projectDouble.t ?? latest.t + 365 * DAY, method: projectDouble.projected ?? "actual" },
    project100k: { t: project100k.t ?? latest.t + 365 * DAY, method: project100k.projected ?? "actual" },
    project70k: { t: project70k.t ?? latest.t + 365 * DAY, method: project70k.projected ?? "actual" },
  };
}

/* ---------- 表示ヘルパ ---------- */
export function fmtUsd(v: number, digits = 2): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function fmtDate(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}
export function fmtDateTime(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${fmtDate(t)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
