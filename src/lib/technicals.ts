import type { LogRecord } from "../data/logs";

/* ============================================================
   日足バーの再構築
   logs は 1 日 2 回 (0:25 / 12:25) のスナップショット。
   open = 前日終値, high = 当日スナップショット最大,
   low = 最小, close = 最終スナップショット。
   ※ 真の高安ではなく観測窓内の高安である旨は UI で開示する。
   ============================================================ */
export interface Bar {
  t: number; // その日の 00:00
  o: number;
  h: number;
  l: number;
  c: number;
  n: number; // その日の観測数
}

function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function buildBars(records: LogRecord[]): Bar[] {
  const map = new Map<string, { t: number; vals: number[] }>();
  for (const r of records) {
    const k = dayKey(r.t);
    const e = map.get(k);
    if (e) e.vals.push(r.v);
    else {
      const d = new Date(r.t);
      map.set(k, { t: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), vals: [r.v] });
    }
  }
  const days = Array.from(map.values()).sort((a, b) => a.t - b.t);
  const bars: Bar[] = [];
  for (let i = 0; i < days.length; i++) {
    const prev = i > 0 ? bars[i - 1].c : days[i].vals[0];
    bars.push({
      t: days[i].t,
      o: prev,
      h: Math.max(...days[i].vals, prev),
      l: Math.min(...days[i].vals, prev),
      c: days[i].vals[days[i].vals.length - 1],
      n: days[i].vals.length,
    });
  }
  return bars;
}

export function resample(bars: Bar[], mode: "D" | "W" | "M"): Bar[] {
  if (mode === "D") return bars;
  const key = (t: number) => {
    const d = new Date(t);
    if (mode === "M") return `${d.getFullYear()}-${d.getMonth()}`;
    const dow = (d.getDay() + 6) % 7; // 月曜始まり
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
    return `${mon.getFullYear()}-${mon.getMonth()}-${mon.getDate()}`;
  };
  const map = new Map<string, Bar[]>();
  for (const b of bars) {
    const k = key(b.t);
    const arr = map.get(k);
    if (arr) arr.push(b);
    else map.set(k, [b]);
  }
  const out: Bar[] = [];
  for (const arr of map.values()) {
    out.push({
      t: arr[0].t,
      o: arr[0].o,
      h: Math.max(...arr.map((x) => x.h)),
      l: Math.min(...arr.map((x) => x.l)),
      c: arr[arr.length - 1].c,
      n: arr.reduce((a, x) => a + x.n, 0),
    });
  }
  return out;
}

/* ================= 基本系列 ================= */
export function sma(xs: number[], n: number): (number | null)[] {
  const out: (number | null)[] = new Array(xs.length).fill(null);
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    s += xs[i];
    if (i >= n) s -= xs[i - n];
    if (i >= n - 1) out[i] = s / n;
  }
  return out;
}

export function ema(xs: number[], n: number): (number | null)[] {
  const out: (number | null)[] = new Array(xs.length).fill(null);
  const k = 2 / (n + 1);
  let prev: number | null = null;
  for (let i = 0; i < xs.length; i++) {
    if (i < n - 1) continue;
    if (prev === null) {
      let s = 0;
      for (let j = i - n + 1; j <= i; j++) s += xs[j];
      prev = s / n;
    } else prev = xs[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder RSI(14) */
export function rsiSeries(closes: number[], n = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= n) return out;
  let ag = 0,
    al = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) ag += d;
    else al -= d;
  }
  ag /= n;
  al /= n;
  out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (n - 1) + Math.max(d, 0)) / n;
    al = (al * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}

export interface MacdState {
  macd: number;
  signal: number;
  hist: number;
  prevHist: number;
  histSlope: number;
}

export function macdState(closes: number[]): MacdState {
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const line: (number | null)[] = closes.map((_, i) =>
    fast[i] !== null && slow[i] !== null ? (fast[i] as number) - (slow[i] as number) : null
  );
  const valid = line.filter((v): v is number => v !== null);
  const sig = ema(valid, 9);
  const hists: number[] = valid.map((v, i) => (sig[i] !== null ? v - (sig[i] as number) : NaN));
  const lastValid = hists.filter((v) => !Number.isNaN(v));
  const hist = lastValid[lastValid.length - 1] ?? 0;
  const prevHist = lastValid[lastValid.length - 2] ?? hist;
  return {
    macd: valid[valid.length - 1] ?? 0,
    signal: sig[sig.length - 1] ?? 0,
    hist,
    prevHist,
    histSlope: hist - prevHist,
  };
}

export interface BollingerState {
  mid: number;
  upper: number;
  lower: number;
  pctB: number;
  bandwidth: number; // %
  bwPercentile: number; // 0-100（全期間のバンド幅の中で何パーセンタイルか）
  squeeze: boolean; // バンド幅が下位 20%
}

export function bollingerState(closes: number[], n = 20, k = 2): BollingerState {
  if (closes.length < n) {
    const c = closes[closes.length - 1] ?? 0;
    return { mid: c, upper: c, lower: c, pctB: 0.5, bandwidth: 0, bwPercentile: 50, squeeze: false };
  }
  const mids = sma(closes, n);
  const bws: number[] = [];
  let pctB = 0.5,
    bw = 0,
    mid = 0,
    upper = 0,
    lower = 0;
  for (let i = n - 1; i < closes.length; i++) {
    const slice = closes.slice(i - n + 1, i + 1);
    const m = slice.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(slice.reduce((a, b) => a + (b - m) * (b - m), 0) / n);
    bws.push((2 * k * sd) / m);
    if (i === closes.length - 1) {
      mid = m;
      upper = m + k * sd;
      lower = m - k * sd;
      bw = (upper - lower) / m;
      pctB = upper === lower ? 0.5 : (closes[i] - lower) / (upper - lower);
    }
  }
  const sorted = [...bws].sort((a, b) => a - b);
  const rank = sorted.filter((x) => x <= bw).length;
  const bwPercentile = sorted.length ? (rank / sorted.length) * 100 : 50;
  return {
    mid,
    upper,
    lower,
    pctB,
    bandwidth: bw * 100,
    bwPercentile,
    squeeze: bwPercentile <= 20,
  };
}

/** Wilder ATR(14) */
export function atrState(bars: Bar[], n = 14): { atr: number; atrPct: number } {
  if (bars.length <= n) return { atr: 0, atrPct: 0 };
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    trs.push(Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i - 1].c), Math.abs(bars[i].l - bars[i - 1].c)));
  }
  let atr = trs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = n; i < trs.length; i++) atr = (atr * (n - 1) + trs[i]) / n;
  return { atr, atrPct: (atr / bars[bars.length - 1].c) * 100 };
}

export interface StochState {
  k: number;
  d: number;
}

export function stochState(bars: Bar[], n = 14): StochState {
  const ks: (number | null)[] = bars.map((_, i) => {
    if (i < n - 1) return null;
    let hh = -Infinity,
      ll = Infinity;
    for (let j = i - n + 1; j <= i; j++) {
      hh = Math.max(hh, bars[j].h);
      ll = Math.min(ll, bars[j].l);
    }
    return hh === ll ? 50 : ((bars[i].c - ll) / (hh - ll)) * 100;
  });
  const valid: number[] = [];
  for (const v of ks) if (v !== null) valid.push(v);
  const k3: (number | null)[] = valid.map((_, i) => (i < 2 ? null : (valid[i] + valid[i - 1] + valid[i - 2]) / 3));
  const dValid = k3.filter((v): v is number => v !== null);
  return {
    k: valid[valid.length - 1] ?? 50,
    d: dValid[dValid.length - 1] ?? 50,
  };
}

export interface AdxState {
  adx: number;
  plusDI: number;
  minusDI: number;
}

/** Wilder ADX(14) + ±DI */
export function adxState(bars: Bar[], n = 14): AdxState {
  if (bars.length < n * 2 + 2) return { adx: 0, plusDI: 0, minusDI: 0 };
  const tr: number[] = [],
    pdm: number[] = [],
    mdm: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    tr.push(Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i - 1].c), Math.abs(bars[i].l - bars[i - 1].c)));
    const up = bars[i].h - bars[i - 1].h;
    const dn = bars[i - 1].l - bars[i].l;
    pdm.push(up > dn && up > 0 ? up : 0);
    mdm.push(dn > up && dn > 0 ? dn : 0);
  }
  let sTr = tr.slice(0, n).reduce((a, b) => a + b, 0);
  let sP = pdm.slice(0, n).reduce((a, b) => a + b, 0);
  let sM = mdm.slice(0, n).reduce((a, b) => a + b, 0);
  const dxs: number[] = [];
  for (let i = n; i < tr.length; i++) {
    sTr = sTr - sTr / n + tr[i];
    sP = sP - sP / n + pdm[i];
    sM = sM - sM / n + mdm[i];
    const pdi = sTr ? (100 * sP) / sTr : 0;
    const mdi = sTr ? (100 * sM) / sTr : 0;
    dxs.push(pdi + mdi ? (100 * Math.abs(pdi - mdi)) / (pdi + mdi) : 0);
  }
  let adx = dxs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  for (let i = n; i < dxs.length; i++) adx = (adx * (n - 1) + dxs[i]) / n;
  const lastTr = sTr || 1;
  return { adx, plusDI: (100 * sP) / lastTr, minusDI: (100 * sM) / lastTr };
}

export function cciState(bars: Bar[], n = 20): number {
  const tps = bars.map((b) => (b.h + b.l + b.c) / 3);
  if (tps.length < n) return 0;
  const slice = tps.slice(-n);
  const m = slice.reduce((a, b) => a + b, 0) / n;
  const md = slice.reduce((a, b) => a + Math.abs(b - m), 0) / n;
  const tp = tps[tps.length - 1];
  return md === 0 ? 0 : (tp - m) / (0.015 * md);
}

export function williamsR(bars: Bar[], n = 14): number {
  if (bars.length < n) return -50;
  let hh = -Infinity,
    ll = Infinity;
  for (const b of bars.slice(-n)) {
    hh = Math.max(hh, b.h);
    ll = Math.min(ll, b.l);
  }
  return hh === ll ? -50 : ((hh - bars[bars.length - 1].c) / (hh - ll)) * -100;
}

export function roc(closes: number[], n = 20): number {
  if (closes.length <= n) return 0;
  return (closes[closes.length - 1] / closes[closes.length - 1 - n] - 1) * 100;
}

/** OBV の代理系列: 出来高がないため日次 P&L をフローとみなす（UI で開示） */
export function flowSeries(bars: Bar[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < bars.length; i++) out.push(out[i - 1] + (bars[i].c - bars[i - 1].c));
  return out;
}

export interface MaBundle {
  sma5: number;
  sma10: number;
  sma20: number;
  sma50: number;
  sma100: number;
  sma200: number;
  golden: boolean; // 直近 10 日以内に 50 日上抜け
  dead: boolean;
  perfectUp: boolean;
  perfectDown: boolean;
}

export function maBundle(closes: number[]): MaBundle {
  const get = (n: number) => {
    const s = sma(closes, n);
    return s[s.length - 1] ?? closes[closes.length - 1];
  };
  const s5 = get(5),
    s10 = get(10),
    s20 = get(20),
    s50 = get(50),
    s100 = get(100),
    s200 = get(200);
  const a50 = sma(closes, 50);
  const a200 = sma(closes, 200);
  let golden = false,
    dead = false;
  for (let i = Math.max(1, closes.length - 10); i < closes.length; i++) {
    if (a50[i] !== null && a200[i] !== null && a50[i - 1] !== null && a200[i - 1] !== null) {
      if ((a50[i - 1] as number) <= (a200[i - 1] as number) && (a50[i] as number) > (a200[i] as number)) golden = true;
      if ((a50[i - 1] as number) >= (a200[i - 1] as number) && (a50[i] as number) < (a200[i] as number)) dead = true;
    }
  }
  return {
    sma5: s5,
    sma10: s10,
    sma20: s20,
    sma50: s50,
    sma100: s100,
    sma200: s200,
    golden,
    dead,
    perfectUp: s5 > s10 && s10 > s20 && s20 > s50 && s50 > s100 && s100 > s200,
    perfectDown: s5 < s10 && s10 < s20 && s20 < s50 && s50 < s100 && s100 < s200,
  };
}

/* ============ ピボット（古典 / フィボナッチ） ============ */
export interface PivotSet {
  kind: "classic" | "fib";
  r3: number;
  r2: number;
  r1: number;
  pp: number;
  s1: number;
  s2: number;
  s3: number;
}

export function pivots(last: Bar): PivotSet[] {
  const { h, l, c } = last;
  const pp = (h + l + c) / 3;
  const range = h - l;
  return [
    { kind: "classic", pp, r1: 2 * pp - l, s1: 2 * pp - h, r2: pp + range, s2: pp - range, r3: h + 2 * (pp - l), s3: l - 2 * (h - pp) },
    { kind: "fib", pp, r1: pp + 0.382 * range, s1: pp - 0.382 * range, r2: pp + 0.618 * range, s2: pp - 0.618 * range, r3: pp + range, s3: pp - range },
  ];
}

/* ============ 支持 / 抵抗帯（スイング高安クラスタリング） ============ */
export interface SrLevel {
  price: number;
  touches: number;
  kind: "support" | "resistance";
  distPct: number; // 現在値からの距離 %
}

export function supportResistance(bars: Bar[], lookback = 180): SrLevel[] {
  const win = bars.slice(-lookback);
  const swings: number[] = [];
  const k = 3;
  for (let i = k; i < win.length - k; i++) {
    let isH = true,
      isL = true;
    for (let j = i - k; j <= i + k; j++) {
      if (win[j].h > win[i].h) isH = false;
      if (win[j].l < win[i].l) isL = false;
    }
    if (isH) swings.push(win[i].h);
    if (isL) swings.push(win[i].l);
  }
  swings.sort((a, b) => a - b);
  const clusters: { sum: number; n: number }[] = [];
  const tol = 0.006;
  for (const s of swings) {
    const lastC = clusters[clusters.length - 1];
    if (lastC && Math.abs(s - lastC.sum / lastC.n) / (lastC.sum / lastC.n) < tol) {
      lastC.sum += s;
      lastC.n++;
    } else clusters.push({ sum: s, n: 1 });
  }
  const cur = bars[bars.length - 1].c;
  return clusters
    .map((cl) => {
      const price = cl.sum / cl.n;
      return {
        price,
        touches: cl.n,
        kind: (price < cur ? "support" : "resistance") as "support" | "resistance",
        distPct: ((price - cur) / cur) * 100,
      };
    })
    .filter((x) => x.touches >= 2)
    .sort((a, b) => Math.abs(a.distPct) - Math.abs(b.distPct))
    .slice(0, 8);
}

/* ============ RSI ダイバージェンス検出 ============ */
export type Divergence = "bullish" | "bearish" | null;

export function detectDivergence(closes: number[], rsiArr: (number | null)[], lookback = 60): Divergence {
  const n = closes.length;
  if (n < lookback) return null;
  const lows: number[] = [];
  const highs: number[] = [];
  for (let i = n - lookback + 2; i < n - 2; i++) {
    if (closes[i] < closes[i - 1] && closes[i] <= closes[i + 1]) lows.push(i);
    if (closes[i] > closes[i - 1] && closes[i] >= closes[i + 1]) highs.push(i);
  }
  if (lows.length >= 2) {
    const [a, b] = lows.slice(-2);
    const ra = rsiArr[a];
    const rb = rsiArr[b];
    if (ra !== null && rb !== null && closes[b] < closes[a] && rb > ra + 1.5) return "bullish";
  }
  if (highs.length >= 2) {
    const [a, b] = highs.slice(-2);
    const ra = rsiArr[a];
    const rb = rsiArr[b];
    if (ra !== null && rb !== null && closes[b] > closes[a] && rb < ra - 1.5) return "bearish";
  }
  return null;
}

/* ============================================================
   合議制テクニカルスコア — 全内訳を開示 (QAIZ 設計約束 #3)
   vote: +1 強気 / -1 弱気 / 0 中立, weight は合議の重み
   score = 50 + 50 × Σ(vote×weight)/Σweight
   ============================================================ */
export interface TechVote {
  indicator: string;
  value: string;
  vote: 1 | 0 | -1;
  weight: number;
  reason: string;
}

export interface TechResult {
  score: number; // 0-100
  verdict: string;
  votes: TechVote[];
  bullCount: number;
  bearCount: number;
  neutralCount: number;
  bars: Bar[];
  boll: BollingerState;
  rsiNow: number;
  macd: MacdState;
  adx: AdxState;
  stoch: StochState;
  atrPct: number;
  cci: number;
  wr: number;
  roc20: number;
  ma: MaBundle;
  div: Divergence;
  srs: SrLevel[];
  nearestPivot: { level: string; price: number; distPct: number };
}

export function computeTechnicals(bars: Bar[]): TechResult {
  const closes = bars.map((b) => b.c);
  const last = bars[bars.length - 1];
  const rsiArr = rsiSeries(closes, 14);
  const rsiNow = rsiArr[rsiArr.length - 1] ?? 50;
  const macd = macdState(closes);
  const boll = bollingerState(closes);
  const atr = atrState(bars);
  const stoch = stochState(bars);
  const adx = adxState(bars);
  const cci = cciState(bars);
  const wr = williamsR(bars);
  const roc20 = roc(closes, 20);
  const ma = maBundle(closes);
  const div = detectDivergence(closes, rsiArr);
  const srs = supportResistance(bars);

  const votes: TechVote[] = [];
  const add = (indicator: string, value: string, vote: 1 | 0 | -1, weight: number, reason: string) =>
    votes.push({ indicator, value, vote, weight, reason });

  add("RSI(14)", rsiNow.toFixed(1), rsiNow >= 70 ? -1 : rsiNow >= 55 ? 1 : rsiNow <= 30 ? 1 : rsiNow <= 45 ? -1 : 0, 1.2,
    rsiNow >= 70 ? "買われ過ぎ圏" : rsiNow >= 55 ? "強気モメンタム圏 (55-70)" : rsiNow <= 30 ? "売られ過ぎからの反発余地" : rsiNow <= 45 ? "弱気モメンタム圏 (30-45)" : "中立帯 (45-55)");
  add("MACD(12,26,9)", `hist ${macd.hist.toFixed(1)}`, macd.hist > 0 && macd.histSlope >= 0 ? 1 : macd.hist > 0 ? 0 : macd.hist < 0 && macd.histSlope <= 0 ? -1 : 0, 1.2,
    macd.hist > 0 ? (macd.histSlope >= 0 ? "ヒストグラム陽転かつ拡大" : "陽線だが縮小中（減点）") : macd.histSlope <= 0 ? "ヒストグラム陰転かつ拡大" : "陰線だが縮小中（底打ち示唆）");
  add("ボリンジャー %B(20,2)", boll.pctB.toFixed(2), boll.pctB > 1 ? -1 : boll.pctB > 0.8 ? 1 : boll.pctB < 0 ? 1 : boll.pctB < 0.2 ? -1 : 0, 0.9,
    boll.pctB > 1 ? "上限バンド突破（過熱）" : boll.pctB > 0.8 ? "バンド上部で推移（強い）" : boll.pctB < 0 ? "下限バンド突破（売られ過ぎ）" : boll.pctB < 0.2 ? "バンド下部で推移（弱い）" : "バンド内中央");
  add("バンド幅パーセンタイル", `${boll.bwPercentile.toFixed(0)}%`, boll.squeeze ? 0 : 0, 0.5,
    boll.squeeze ? `スクイーズ中（ボラ収縮→次の拡大に備え）BW=${boll.bandwidth.toFixed(2)}%` : `バンド幅 ${boll.bandwidth.toFixed(2)}%（百分位 ${boll.bwPercentile.toFixed(0)}）`);
  add("ATR(14) %", `${atr.atrPct.toFixed(2)}%`, 0, 0.4, `1 日あたり平均 ±${atr.atrPct.toFixed(2)}% の変動幅（方向なし・リスク尺度）`);
  add("ストキャスティクス(14,3,3)", `K ${stoch.k.toFixed(0)} / D ${stoch.d.toFixed(0)}`, stoch.k < 20 ? 1 : stoch.k > 80 ? -1 : stoch.k > stoch.d ? 1 : stoch.k < stoch.d ? -1 : 0, 0.8,
    stoch.k < 20 ? "売られ過ぎ圏（反発余地）" : stoch.k > 80 ? "買われ過ぎ圏" : stoch.k > stoch.d ? "K が D を上回る（短期強気）" : "K が D を下回る（短期弱気）");
  add("ADX(14) + ±DI", `ADX ${adx.adx.toFixed(0)}`, adx.adx >= 25 ? (adx.plusDI > adx.minusDI ? 1 : -1) : 0, 1.0,
    adx.adx >= 25 ? `トレンド成立（ADX≥25）。+DI ${adx.plusDI.toFixed(0)} vs −DI ${adx.minusDI.toFixed(0)} で${adx.plusDI > adx.minusDI ? "上昇" : "下落"}トレンド` : `トレンド不在（ADX ${adx.adx.toFixed(0)} < 25）、レンジ判定`);
  add("MFI 代理(14)", "P&L フロー", 0, 0.3, "出来高不在のため日次 P&L をフローとみなす（近似・参考値）");
  add("CCI(20)", cci.toFixed(0), cci > 100 ? -1 : cci > 50 ? 1 : cci < -100 ? 1 : cci < -50 ? -1 : 0, 0.7,
    cci > 100 ? "+100 超（過熱）" : cci > 50 ? "上昇バイアス" : cci < -100 ? "−100 未満（投げ売り圏）" : cci < -50 ? "下落バイアス" : "中立");
  add("Williams %R(14)", wr.toFixed(0), wr <= -80 ? 1 : wr >= -20 ? -1 : wr >= -50 ? 1 : -1, 0.7,
    wr <= -80 ? "売られ過ぎ" : wr >= -20 ? "買われ過ぎ" : wr >= -50 ? "レンジ上半分" : "レンジ下半分");
  add("ROC(20)", `${roc20.toFixed(2)}%`, roc20 > 1 ? 1 : roc20 < -1 ? -1 : 0, 0.8, `20 日変化率 ${roc20.toFixed(2)}%`);
  const vwapDev = boll.mid > 0 ? ((last.c - boll.mid) / boll.mid) * 100 : 0;
  add("VWAP(20) 乖離", `${vwapDev.toFixed(2)}%`, vwapDev > 0.05 ? 1 : vwapDev < -0.05 ? -1 : 0, 0.6,
    `20 日平均（近似 VWAP）${boll.mid.toFixed(0)} に対する乖離（±0.05% 以内は中立）`);
  add("SMA 5/20/50/200", `${last.c > ma.sma200 ? "上方" : "下方"}`, last.c > ma.sma20 ? 1 : -1, 1.1,
    `価格 vs SMA20 ${ma.sma20.toFixed(0)} / SMA50 ${ma.sma50.toFixed(0)} / SMA200 ${ma.sma200.toFixed(0)}`);
  add("ゴールデン/デッドクロス", ma.golden ? "GC 発生" : ma.dead ? "DC 発生" : "—", ma.golden ? 1 : ma.dead ? -1 : 0, 1.0,
    ma.golden ? "直近 10 日以内に 50 日が 200 日を上抜け" : ma.dead ? "直近 10 日以内に 50 日が 200 日を下抜け" : "クロスなし（50/200 関係は維持）");
  add("パーフェクトオーダー", ma.perfectUp ? "完全上昇" : ma.perfectDown ? "完全下降" : "混在", ma.perfectUp ? 1 : ma.perfectDown ? -1 : 0, 0.9,
    "短期→長期の移動平均線が全順列一致しているか");
  add("ピボット（古典+Fib）", `${Math.abs((() => { const p = pivots(last)[0]; const lv = [p.r1, p.r2, p.s1, p.s2].sort((a, b) => Math.abs(a - last.c) - Math.abs(b - last.c))[0]; return ((lv - last.c) / last.c) * 100; })()).toFixed(2)}%`, 0, 0.5, "直近のピボット水準までの距離（攻防ライン）");
  add("支持/抵抗帯", srs.length ? `${srs[0].kind === "support" ? "支持" : "抵抗"} ${srs[0].price.toFixed(0)}（接触 ${srs[0].touches} 回）` : "—", 0, 0.6,
    srs.length ? `最寄り水準まで ${srs[0].distPct.toFixed(2)}%。直上抵抗・直下支持をクラスタリングで抽出` : "有意なクラスタなし");
  add("RSI ダイバージェンス", div === "bullish" ? "強気" : div === "bearish" ? "弱気" : "なし", div === "bullish" ? 1 : div === "bearish" ? -1 : 0, 1.0,
    div === "bullish" ? "安値更新だが RSI は切り上げ（上昇ダイバージェンス）" : div === "bearish" ? "高値更新だが RSI は切り下げ（下落ダイバージェンス）" : "60 日窓内で検出なし");
  add("OBV 代理フロー", "累積 P&L", 0, 0.3, "方向判定は ROC/MACD に委ね、ここではフロー累積を開示のみ");

  const W = votes.reduce((a, v) => a + v.weight, 0);
  const S = votes.reduce((a, v) => a + v.vote * v.weight, 0);
  const score = Math.max(0, Math.min(100, 50 + (50 * S) / W));
  const bullCount = votes.filter((v) => v.vote === 1).length;
  const bearCount = votes.filter((v) => v.vote === -1).length;
  const verdict =
    score >= 75 ? "強い強気" : score >= 60 ? "強気" : score >= 52 ? "やや強気" : score > 48 ? "中立" : score > 40 ? "やや弱気" : score > 25 ? "弱気" : "強い弱気";

  const p = pivots(last)[0];
  const levels: { level: string; price: number; distPct: number }[] = [
    { level: "R2", price: p.r2, distPct: 0 },
    { level: "R1", price: p.r1, distPct: 0 },
    { level: "PP", price: p.pp, distPct: 0 },
    { level: "S1", price: p.s1, distPct: 0 },
    { level: "S2", price: p.s2, distPct: 0 },
  ];
  for (const lv of levels) lv.distPct = ((lv.price - last.c) / last.c) * 100;
  const nearestPivot = levels.sort((a, b) => Math.abs(a.distPct) - Math.abs(b.distPct))[0];

  return {
    score,
    verdict,
    votes,
    bullCount,
    bearCount,
    neutralCount: votes.length - bullCount - bearCount,
    bars,
    boll,
    rsiNow,
    macd,
    adx,
    stoch,
    atrPct: atr.atrPct,
    cci,
    wr,
    roc20,
    ma,
    div,
    srs,
    nearestPivot,
  };
}
