import { useMemo, useState } from "react";
import type { Metrics } from "../lib/metrics";
import { fmtDate } from "../lib/metrics";
import { useReveal } from "../lib/hooks";
import { Gauge, RRGChart } from "./charts";
import {
  acf,
  adfTest,
  archLM,
  attribution,
  excessKurtosis,
  fitGarch,
  hurstRS,
  jarqueBera,
  logReturns,
  QUADRANT_COLOR,
  QUADRANT_LABEL,
  rotationSeries,
  skewness,
  type RotationPoint,
} from "../lib/quant";

/* ================= 日足 OHLC 再構築 ================= */
interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}
export function buildBars(m: Metrics): Bar[] {
  const byDay = new Map<string, { t: number; o: number; h: number; l: number; c: number }>();
  for (const r of m.records) {
    const d = new Date(r.t);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const e = byDay.get(key);
    if (!e) byDay.set(key, { t: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), o: r.v, h: r.v, l: r.v, c: r.v });
    else {
      e.h = Math.max(e.h, r.v);
      e.l = Math.min(e.l, r.v);
      e.c = r.v;
    }
  }
  return [...byDay.values()].sort((a, b) => a.t - b.t);
}
function resample(bars: Bar[], n: number): Bar[] {
  const out: Bar[] = [];
  for (let i = 0; i < bars.length; i += n) {
    const chunk = bars.slice(i, i + n);
    out.push({
      t: chunk[0].t,
      o: chunk[0].o,
      h: Math.max(...chunk.map((b) => b.h)),
      l: Math.min(...chunk.map((b) => b.l)),
      c: chunk[chunk.length - 1].c,
    });
  }
  return out;
}

/* ================= テクニカル計算 ================= */
function sma(xs: number[], n: number): number | null {
  if (xs.length < n) return null;
  let s = 0;
  for (let i = xs.length - n; i < xs.length; i++) s += xs[i];
  return s / n;
}
function emaArr(xs: number[], n: number): number[] {
  const k = 2 / (n + 1);
  const out: number[] = [];
  let prev = xs[0] ?? 0;
  for (let i = 0; i < xs.length; i++) {
    prev = i === 0 ? xs[0] : xs[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}
function rsiArr(closes: number[], n = 14): number[] {
  const out: number[] = [];
  let ag = 0;
  let al = 0;
  for (let i = 1; i <= closes.length - 1; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = Math.max(0, ch);
    const l = Math.max(0, -ch);
    if (i <= n) {
      ag += g / n;
      al += l / n;
    } else {
      ag = (ag * (n - 1) + g) / n;
      al = (al * (n - 1) + l) / n;
    }
    out.push(i >= n ? (al === 0 ? 100 : 100 - 100 / (1 + ag / al)) : 50);
  }
  return out;
}

export interface SignalRow {
  name: string;
  value: string;
  vote: 1 | 0 | -1;
  weight: number;
  note: string;
}
export interface TechnicalResult {
  score: number;
  bullish: number;
  bearish: number;
  neutral: number;
  rows: SignalRow[];
  rsi: number;
}

export function computeTechnicals(bars: Bar[]): TechnicalResult {
  const closes = bars.map((b) => b.c);
  const last = bars[bars.length - 1];
  const rows: SignalRow[] = [];
  const add = (name: string, value: string, vote: 1 | 0 | -1, weight: number, note: string) =>
    rows.push({ name, value, vote, weight, note });

  // RSI(14) Wilder
  const rsiSeries = rsiArr(closes, 14);
  const rsi = rsiSeries[rsiSeries.length - 1] ?? 50;
  add("RSI(14)", rsi.toFixed(1), rsi >= 70 ? -1 : rsi <= 30 ? 1 : rsi >= 55 ? 1 : rsi <= 45 ? -1 : 0, 1.0,
    rsi >= 70 ? "買われ過ぎ（70 超）" : rsi <= 30 ? "売られ過ぎ（30 未満）" : rsi >= 55 ? "強気圏（55〜70）" : rsi <= 45 ? "弱気圏（30〜45）" : "中立圏");

  // MACD(12,26,9)
  const e12 = emaArr(closes, 12);
  const e26 = emaArr(closes, 26);
  const macdLine = e12.map((v, i) => v - e26[i]);
  const signalLine = emaArr(macdLine, 9);
  const macd = macdLine[macdLine.length - 1];
  const sig = signalLine[signalLine.length - 1];
  const hist = macd - sig;
  const prevHist = macdLine[macdLine.length - 2] - signalLine[signalLine.length - 2];
  add("MACD(12,26,9)", `${hist >= 0 ? "+" : ""}${hist.toFixed(1)}`, hist > 0 ? (hist > prevHist ? 1 : 0) : hist < prevHist ? -1 : 0, 1.0,
    hist > 0 ? (hist > prevHist ? "強気ヒストグラム拡大中" : "陽線だが縮小中") : hist < prevHist ? "弱気ヒストグラム拡大中" : "陰線だが縮小中");

  // ボリンジャー(20,2) + %B + バンド幅パーセンタイル + スクイーズ
  const n = 20;
  let pctB = 0.5;
  let bwPctile = 50;
  let squeeze = false;
  let mid = last.c;
  if (closes.length >= n) {
    const w = closes.slice(-n);
    mid = w.reduce((a, b) => a + b, 0) / n;
    const s = Math.sqrt(w.reduce((a, b) => a + (b - mid) * (b - mid), 0) / n);
    const upper = mid + 2 * s;
    const lower = mid - 2 * s;
    pctB = upper > lower ? (last.c - lower) / (upper - lower) : 0.5;
    const bws: number[] = [];
    for (let i = n; i <= closes.length; i++) {
      const ww = closes.slice(i - n, i);
      const mm = ww.reduce((a, b) => a + b, 0) / n;
      const ss = Math.sqrt(ww.reduce((a, b) => a + (b - mm) * (b - mm), 0) / n);
      bws.push(mm > 0 ? (4 * ss) / mm : 0);
    }
    const cur = bws[bws.length - 1];
    bwPctile = (bws.filter((b) => b < cur).length / bws.length) * 100;
    squeeze = bwPctile < 15;
    add("ボリンジャー %B", pctB.toFixed(2), pctB > 1 ? -1 : pctB >= 0.8 ? 1 : pctB < 0 ? 1 : pctB <= 0.2 ? -1 : 0, 0.8,
      squeeze ? `バンド幅パーセンタイル ${bwPctile.toFixed(0)}% — スクイーズ（収縮）` : `バンド内の位置（0=下限, 1=上限）`);
  }

  // ATR(14)
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    trs.push(Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i - 1].c), Math.abs(bars[i].l - bars[i - 1].c)));
  }
  const atr = sma(trs, 14) ?? 0;
  add("ATR(14)", `$${atr.toFixed(0)}`, 0, 0.3, `真の値幅の平均 — 1日あたり ±$${atr.toFixed(0)} の変動`);

  // ストキャスティクス(14,3,3)
  if (bars.length >= 16) {
    const hh = Math.max(...bars.slice(-14).map((b) => b.h));
    const ll = Math.min(...bars.slice(-14).map((b) => b.l));
    const k = hh > ll ? ((last.c - ll) / (hh - ll)) * 100 : 50;
    add("ストキャス %K(14)", k.toFixed(1), k >= 80 ? -1 : k <= 20 ? 1 : 0, 0.7, k >= 80 ? "買われ過ぎ圏" : k <= 20 ? "売られ過ぎ圏" : "中立");
  }

  // ADX(14) + ±DI
  if (bars.length > 30) {
    let trS = 0;
    let pdmS = 0;
    let ndmS = 0;
    const dxs: number[] = [];
    for (let i = 1; i < bars.length; i++) {
      const up = bars[i].h - bars[i - 1].h;
      const dn = bars[i - 1].l - bars[i].l;
      const pdm = up > dn && up > 0 ? up : 0;
      const ndm = dn > up && dn > 0 ? dn : 0;
      const tr = Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i - 1].c), Math.abs(bars[i].l - bars[i - 1].c));
      if (i <= 14) {
        trS += tr;
        pdmS += pdm;
        ndmS += ndm;
      } else {
        trS = trS - trS / 14 + tr;
        pdmS = pdmS - pdmS / 14 + pdm;
        ndmS = ndmS - ndmS / 14 + ndm;
        const pdi = (pdmS / trS) * 100;
        const ndi = (ndmS / trS) * 100;
        const sum = pdi + ndi;
        dxs.push(sum > 0 ? (Math.abs(pdi - ndi) / sum) * 100 : 0);
      }
    }
    const adx = sma(dxs, 14) ?? 0;
    const pdi = (pdmS / trS) * 100;
    const ndi = (ndmS / trS) * 100;
    const trendVote: 1 | 0 | -1 = adx >= 20 ? (pdi > ndi ? 1 : -1) : 0;
    add("ADX(14) + ±DI", `${adx.toFixed(1)}（+DI ${pdi.toFixed(0)} / −DI ${ndi.toFixed(0)}）`, trendVote, 0.9,
      adx < 20 ? "トレンド不明（ADX 20 未満）" : pdi > ndi ? "上昇トレンド継続中" : "下降トレンド継続中");
  }

  // CCI(20)
  if (closes.length >= 20) {
    const tp = bars.slice(-20).map((b) => (b.h + b.l + b.c) / 3);
    const m = tp.reduce((a, b) => a + b, 0) / 20;
    const md = tp.reduce((a, b) => a + Math.abs(b - m), 0) / 20;
    const cci = md > 0 ? ((tp[tp.length - 1] - m) / (0.015 * md)) : 0;
    add("CCI(20)", cci.toFixed(0), cci > 100 ? 1 : cci < -100 ? -1 : 0, 0.6,
      cci > 100 ? "強気モメンタム（+100 超）" : cci < -100 ? "弱気モメンタム（−100 未満）" : "中立");
  }

  // Williams %R(14)
  if (bars.length >= 14) {
    const hh = Math.max(...bars.slice(-14).map((b) => b.h));
    const ll = Math.min(...bars.slice(-14).map((b) => b.l));
    const wr = hh > ll ? ((hh - last.c) / (hh - ll)) * -100 : -50;
    add("Williams %R(14)", wr.toFixed(1), wr <= -80 ? 1 : wr >= -20 ? -1 : 0, 0.6,
      wr <= -80 ? "売られ過ぎ" : wr >= -20 ? "買われ過ぎ" : "中立");
  }

  // ROC(20)
  if (closes.length > 20) {
    const roc = ((last.c - closes[closes.length - 21]) / closes[closes.length - 21]) * 100;
    add("ROC(20)", `${roc >= 0 ? "+" : ""}${roc.toFixed(2)}%`, roc > 0 ? 1 : -1, 0.7, "20 日前との変化率");
  }

  // 移動平均 5-20-50-100-200 + クロス + パーフェクトオーダー
  const ma5 = sma(closes, 5);
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const ma100 = sma(closes, 100);
  const ma200 = sma(closes, 200);
  if (ma200 != null && ma50 != null) {
    add("SMA200 比", `${(((last.c - ma200) / ma200) * 100).toFixed(1)}%`, last.c > ma200 ? 1 : -1, 1.0,
      last.c > ma200 ? "長期トレンドは上昇" : "長期トレンドは下降");
  }
  if (ma50 != null && ma200 != null) {
    const gc = ma50 > ma200;
    add(gc ? "ゴールデンクロス" : "デッドクロス", `SMA50 ${gc ? ">" : "<"} SMA200`, gc ? 1 : -1, 0.9,
      gc ? "中期線が長期線を上抜け維持" : "中期線が長期線を下抜け維持");
  }
  if (ma5 != null && ma20 != null && ma50 != null && ma100 != null && ma200 != null) {
    const po = ma5 > ma20 && ma20 > ma50 && ma50 > ma100 && ma100 > ma200;
    const poDown = ma5 < ma20 && ma20 < ma50 && ma50 < ma100 && ma100 < ma200;
    add("パーフェクトオーダー", po ? "上昇完列" : poDown ? "下降完列" : "不成立", po ? 1 : poDown ? -1 : 0, 0.8,
      "5>20>50>100>200 の完全な並び");
  }

  // ピボット（古典＋フィボナッチ）
  const p = bars[bars.length - 2] ?? last;
  const pp = (p.h + p.l + p.c) / 3;
  const r1 = 2 * pp - p.l;
  const s1 = 2 * pp - p.h;
  const nearest = Math.abs(last.c - r1) < Math.abs(last.c - s1) ? { lv: "R1", price: r1 } : { lv: "S1", price: s1 };
  const dist = ((nearest.price - last.c) / last.c) * 100;
  add("ピボット近接", `${nearest.lv} まで ${dist >= 0 ? "+" : ""}${dist.toFixed(2)}%`, 0, 0.4,
    `古典 PP ${pp.toFixed(0)} / R1 ${r1.toFixed(0)} / S1 ${s1.toFixed(0)}`);

  // 支持・抵抗帯クラスタリング（直近120日スイング高安）
  const swings: number[] = [];
  const win = bars.slice(-120);
  for (let i = 2; i < win.length - 2; i++) {
    if (win[i].h > win[i - 1].h && win[i].h > win[i - 2].h && win[i].h > win[i + 1].h && win[i].h > win[i + 2].h) swings.push(win[i].h);
    if (win[i].l < win[i - 1].l && win[i].l < win[i - 2].l && win[i].l < win[i + 1].l && win[i].l < win[i + 2].l) swings.push(win[i].l);
  }
  swings.sort((a, b) => a - b);
  const clusters: { price: number; hits: number }[] = [];
  for (const s of swings) {
    const c = clusters.find((x) => Math.abs(x.price - s) / s < 0.012);
    if (c) {
      c.price = (c.price * c.hits + s) / (c.hits + 1);
      c.hits++;
    } else clusters.push({ price: s, hits: 1 });
  }
  const strong = clusters.filter((c) => c.hits >= 2).sort((a, b) => b.hits - a.hits);
  const resAbove = strong.filter((c) => c.price > last.c).sort((a, b) => a.price - b.price)[0];
  const supBelow = strong.filter((c) => c.price < last.c).sort((a, b) => b.price - a.price)[0];
  add("支持/抵抗帯", resAbove ? `抵抗 $${resAbove.price.toFixed(0)}（${((resAbove.price / last.c - 1) * 100).toFixed(1)}%上）` : "—", 0, 0.5,
    supBelow ? `支持 $${supBelow.price.toFixed(0)}（${((1 - supBelow.price / last.c) * 100).toFixed(1)}%下）` : "明確な支持帯なし");

  // RSI ダイバージェンス（価格新高値 vs RSI 低下）
  if (rsiSeries.length > 30) {
    const recent = closes.slice(-20);
    const rRecent = rsiSeries.slice(-20);
    const priceHigh = Math.max(...recent) === last.c;
    const rsiPeak = Math.max(...rRecent.slice(0, 10));
    const bearDiv = priceHigh && rsi < rsiPeak - 5;
    const priceLow = Math.min(...recent) === last.c;
    const rsiTrough = Math.min(...rRecent.slice(0, 10));
    const bullDiv = priceLow && rsi > rsiTrough + 5;
    add("RSI ダイバージェンス", bearDiv ? "弱気" : bullDiv ? "強気" : "なし", bearDiv ? -1 : bullDiv ? 1 : 0, 0.9,
      bearDiv ? "価格新高値に対して RSI が低下（勢い鈍化）" : bullDiv ? "価格新安値に対して RSI が上昇（底打ち示唆）" : "価格と RSI は同調");
  }

  // 合議（重み付き）
  let sumW = 0;
  let sumV = 0;
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  for (const r of rows) {
    sumW += r.weight;
    sumV += r.vote * r.weight;
    if (r.vote > 0) bullish++;
    else if (r.vote < 0) bearish++;
    else neutral++;
  }
  const score = 50 + (sumV / Math.max(1e-9, sumW)) * 50;
  return { score: Math.max(0, Math.min(100, score)), bullish, bearish, neutral, rows, rsi };
}

/* ================= 相場レジーム判定 ================= */
function regime(m: Metrics, bars: Bar[], tech: TechnicalResult) {
  const closes = bars.map((b) => b.c);
  const last = closes[closes.length - 1];
  const ma50 = sma(closes, 50);
  const ma200 = sma(closes, 200);
  const above = (ma50 != null && last > ma50 ? 1 : 0) + (ma200 != null && last > ma200 ? 1 : 0);
  const adxRow = tech.rows.find((r) => r.name.startsWith("ADX"));
  const trendScore = above + (adxRow && adxRow.vote !== 0 ? 1 : 0);
  const trend =
    trendScore >= 2
      ? { label: "上昇トレンド", tone: "up", reason: `価格が SMA50/200 の${above === 2 ? "両方" : "一方"}を上回り、ADX も方向を示している` }
      : trendScore === 1
        ? { label: "レンジ移行", tone: "gold", reason: "移動平均と ADX の判断が分かれている" }
        : { label: "下落トレンド", tone: "down", reason: "主要移動平均を下回っている" };
  const vol = m.volAnnual;
  const volState =
    vol < 8 ? { label: "低ボラティリティ", tone: "up", reason: `年率ボラ ${vol.toFixed(1)}% — 安定した上昇が継続` }
      : vol < 18 ? { label: "通常ボラティリティ", tone: "gold", reason: `年率ボラ ${vol.toFixed(1)}% — 標準的な揺れ` }
      : { label: "高ボラティリティ", tone: "down", reason: `年率ボラ ${vol.toFixed(1)}% — 振れに注意` };
  const ddState =
    m.mdd > -3 ? { label: "リスク選好", tone: "up", reason: `最大 DD ${m.mdd.toFixed(2)}% と浅く、資産は高値圏` }
      : m.mdd > -8 ? { label: "中立", tone: "gold", reason: `最大 DD ${m.mdd.toFixed(2)}% — 一時的な調整を経験` }
      : { label: "リスク回避", tone: "down", reason: `最大 DD ${m.mdd.toFixed(2)}% — 深い調整局面あり` };
  const memo =
    trend.tone === "up" && volState.tone !== "down"
      ? "地形は「静かな上昇」。積立継続＋リバランスの原則を崩さない局面。レバレッジより時間への投資が効く。"
      : trend.tone === "down"
        ? "地形は「逆風」。新規のリスク拡大は控え、現金比率と積立額の見直しが合理的。"
        : "地形は「方向感の欠如」。レンジ想定で高値掴みを避け、分割アプローチが有効。";
  return { trend, volState, ddState, memo };
}

/* ================= シグナル ================= */
interface QuantSignal {
  cat: string;
  title: string;
  detail: string;
  tone: "up" | "down" | "gold" | "dim";
}
function buildSignals(m: Metrics, tech: TechnicalResult, hurst: number, garchPersist: number): QuantSignal[] {
  const out: QuantSignal[] = [];
  const skew = skewness(logReturns(m.daily));
  const kurt = excessKurtosis(logReturns(m.daily));
  if (m.calmar >= 5)
    out.push({ cat: "クオンツ", title: "高カルマー構造", detail: `カルマー ${m.calmar.toFixed(1)}（CAGR +${m.cagr.toFixed(1)}% ÷ |DD ${m.mdd.toFixed(1)}%|）。リターンに対してドローダウンが極めて浅い。`, tone: "up" });
  if (tech.score >= 65)
    out.push({ cat: "テクニカル", title: "合議が強気", detail: `19 指標の重み付き合議 ${tech.score.toFixed(0)} 点（強気 ${tech.bullish} / 弱気 ${tech.bearish}）。短期モメンタムは継続中。`, tone: "up" });
  else if (tech.score <= 35)
    out.push({ cat: "テクニカル", title: "合議が弱気", detail: `合議 ${tech.score.toFixed(0)} 点。強気 ${tech.bullish} に対し弱気 ${tech.bearish} — 押し目待ちが合理的。`, tone: "down" });
  if (kurt > 2)
    out.push({ cat: "リスク", title: "テールが厚い", detail: `超過尖度 ${kurt.toFixed(2)}。正規分布より極端な日が発生しやすい — VaR を過信しない。`, tone: "gold" });
  if (skew < -0.3)
    out.push({ cat: "リスク", title: "左に厚いテール", detail: `歪度 ${skew.toFixed(2)}。大きめの下落日が上振れ日より頻発。下落側のヘッジが効く構造。`, tone: "gold" });
  if (hurst > 0.58)
    out.push({ cat: "構造", title: "トレンド持続性", detail: `Hurst 指数 ${hurst.toFixed(2)}（>0.5）。資産系列は平均回帰よりトレンド持続が優勢 — 押し目買いが報われやすい。`, tone: "up" });
  else if (hurst < 0.42)
    out.push({ cat: "構造", title: "平均回帰優勢", detail: `Hurst 指数 ${hurst.toFixed(2)}（<0.5）。上昇後の調整が速い — 分割積み立てとの相性が良い。`, tone: "gold" });
  if (garchPersist > 0.95)
    out.push({ cat: "構造", title: "ボラクラスタリング持続", detail: `GARCH 持続性 ${garchPersist.toFixed(2)}。一度荒れると荒れた状態が長引きやすい。`, tone: "gold" });
  if (m.winRate >= 55 && m.profitFactor >= 1.2)
    out.push({ cat: "クオンツ", title: "勝率×PF の一致", detail: `勝率 ${m.winRate.toFixed(1)}% × PF ${m.profitFactor.toFixed(2)}。期待値の両輪が揃っている。`, tone: "up" });
  if (m.isAllTimeHigh)
    out.push({ cat: "モメンタム", title: "史上最高値圏", detail: `最新 $${m.latestValue.toLocaleString()} は過去最高値。新高値更新 ${m.newHighCount} 回目。`, tone: "up" });
  return out;
}

/* ================= 再現できる計算 ================= */
const FORMULAS: { name: string; body: string }[] = [
  { name: "合議スコア", body: "score = 50 + 50 × Σ(voteᵢ × wᵢ) / Σwᵢ  （vote ∈ {+1, 0, −1}、指標ごとの重み w は表中に表示）" },
  { name: "RSI(14)", body: "Wilder 平滑: Aₜ = (Aₜ₋₁×13 + Xₜ)/14、RSI = 100 − 100/(1 + 平均上昇/平均下落)" },
  { name: "RS-Ratio / Momentum", body: "RS = 100×資産/基準、rsRatio = 100 + 10×z₁₂₆(RS)、rsMomentum = 100 + 10×z₁₂₆(rsRatio − rsRatio₋₁₀)" },
  { name: "Hurst 指数", body: "R/S 解析: ln(R/S) 〜 ln(n) の回帰勾配（n = 16…256）。0.5=ランダムウォーク" },
  { name: "GARCH(1,1)", body: "σ²ₜ = ω + α·r²ₜ₋₁ + β·σ²ₜ₋₁ を対数尤度最大化で推定。半減期 = ln0.5/ln(α+β)" },
  { name: "VaR/CVaR", body: "歴史的パーセンタイル法（95/99%）。CVaR は VaR を超えた損失の条件付き平均" },
];

/* ================= メインビュー ================= */
function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal panel rounded-lg p-5 ${className}`}>
      <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-gold-500">{title}</p>
      {children}
    </div>
  );
}

export function TerminalView({ m }: { m: Metrics }) {
  const bars = useMemo(() => buildBars(m), [m]);
  const [tf, setTf] = useState<"D" | "W" | "M">("D");
  const tfBars = useMemo(() => (tf === "D" ? bars : tf === "W" ? resample(bars, 7) : resample(bars, 30)), [bars, tf]);
  const tech = useMemo(() => computeTechnicals(tfBars), [tfBars]);
  const techDaily = useMemo(() => computeTechnicals(bars), [bars]);
  const rs = useMemo(() => logReturns(m.daily), [m]);
  const econ = useMemo(() => {
    const hurst = hurstRS(rs);
    const adf = adfTest(rs);
    const jb = jarqueBera(rs);
    const arch = archLM(rs);
    const garch = fitGarch(rs);
    const acfR = acf(rs, 10);
    const acfSq = acf(rs.map((r) => r * r), 10);
    return { hurst, adf, jb, arch, garch, acfR, acfSq };
  }, [rs]);
  const reg = useMemo(() => regime(m, bars, techDaily), [m, bars, techDaily]);
  const rot = useMemo(() => rotationSeries(m.daily), [m]);
  const signals = useMemo(() => buildSignals(m, techDaily, econ.hurst, econ.garch.persistence), [m, techDaily, econ]);
  const att = useMemo(() => attribution(m.daily), [m]);

  const toneTxt = (t: string) => (t === "up" ? "text-up-300" : t === "down" ? "text-down-300" : "text-gold-300");
  const toneBg = (t: string) =>
    t === "up" ? "border-up-600/40 bg-up-500/10" : t === "down" ? "border-down-500/40 bg-down-500/10" : "border-gold-600/40 bg-gold-500/10";

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 md:px-6">
      {/* status strip */}
      <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-line pb-4 font-mono text-[11px] text-faint">
        <span className="text-gold-300">QUANT TERMINAL</span>
        <span>対象: 総資産（USD）</span>
        <span>日足 {bars.length} 本</span>
        <span>最終バー {fmtDate(bars[bars.length - 1].t)}</span>
        <span className="ml-auto text-dim">ログ {m.records.length.toLocaleString()} 件から再構築</span>
      </div>

      {/* consensus gauge + breakdown */}
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Panel title={`テクニカル合議 ── ${tf === "D" ? "日足" : tf === "W" ? "週足" : "月足"}`}>
          <div className="flex justify-center">
            <Gauge score={tech.score} />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center font-mono text-[12px]">
            <div className="border border-up-600/30 bg-up-500/5 py-2 text-up-300">強気 {tech.bullish}</div>
            <div className="border border-line bg-ink-800/40 py-2 text-dim">中立 {tech.neutral}</div>
            <div className="border border-down-500/30 bg-down-500/5 py-2 text-down-300">弱気 {tech.bearish}</div>
          </div>
          <div className="mt-4 flex gap-1.5">
            {(["D", "W", "M"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTf(t)}
                className={`min-h-[36px] flex-1 border font-mono text-[11px] tracking-widest transition-all ${
                  tf === t ? "border-gold-500/60 bg-gold-500/15 text-gold-300" : "border-line text-dim hover:text-fog"
                }`}
              >
                {t === "D" ? "日足" : t === "W" ? "週足" : "月足"}
              </button>
            ))}
          </div>
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-faint">
            0-100 のスコアは重み付き合議。内訳は右表で全指標を開示。
          </p>
        </Panel>
        <Panel title="合議の内訳 ── どの指標がどう効いたか">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[640px] border-collapse text-right font-mono text-[12px]">
              <thead>
                <tr className="border-b border-line text-[10px] tracking-widest text-faint">
                  <th className="px-3 py-2 text-left font-medium">指標</th>
                  <th className="px-3 py-2 font-medium">現在値</th>
                  <th className="px-3 py-2 font-medium">判定</th>
                  <th className="px-3 py-2 font-medium">重み</th>
                  <th className="px-3 py-2 text-left font-medium">根拠</th>
                </tr>
              </thead>
              <tbody>
                {tech.rows.map((r) => (
                  <tr key={r.name} className="border-b border-line-soft transition-colors hover:bg-ink-800/40">
                    <td className="px-3 py-2 text-left text-ink-100">{r.name}</td>
                    <td className="px-3 py-2 text-fog">{r.value}</td>
                    <td className={`px-3 py-2 ${r.vote > 0 ? "text-up-300" : r.vote < 0 ? "text-down-300" : "text-faint"}`}>
                      {r.vote > 0 ? "▲ 強気" : r.vote < 0 ? "▼ 弱気" : "— 中立"}
                    </td>
                    <td className="px-3 py-2 text-dim">{r.weight.toFixed(1)}</td>
                    <td className="px-3 py-2 text-left text-dim">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* econometrics */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title="系列構造診断 ── 金融工学">
          <div className="space-y-4">
            {[
              { k: "Hurst 指数（R/S）", v: econ.hurst.toFixed(3), s: econ.hurst > 0.55 ? "トレンド持続 > 0.5" : econ.hurst < 0.45 ? "平均回帰 < 0.5" : "ランダムウォーク近辺", tone: econ.hurst > 0.55 ? "up" : "gold" },
              { k: "ADF 検定 τ 統計量", v: econ.adf.tau.toFixed(2), s: econ.adf.stationary ? "定常（リターンは予測不能）" : "単位根の可能性", tone: econ.adf.stationary ? "up" : "gold" },
              { k: "Jarque-Bera", v: econ.jb.jb.toFixed(1), s: econ.jb.normal ? "正規性を棄却できない" : `正規性を棄却（p≈${econ.jb.pApprox.toFixed(3)}）`, tone: econ.jb.normal ? "up" : "gold" },
              { k: "ARCH-LM(1)", v: econ.arch.lm.toFixed(2), s: econ.arch.clustered ? "ボラクラスタリングあり" : "クラスタリング検出されず", tone: econ.arch.clustered ? "gold" : "up" },
            ].map((r) => (
              <div key={r.k} className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-3 last:border-0">
                <div>
                  <p className="text-[12px] text-dim">{r.k}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-faint">{r.s}</p>
                </div>
                <p className={`num shrink-0 text-xl font-semibold ${toneTxt(r.tone)}`}>{r.v}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="GARCH(1,1) 最尤推定">
          <div className="space-y-4">
            {[
              { k: "α（ショック反応）", v: econ.garch.alpha.toFixed(3) },
              { k: "β（ボラ持続）", v: econ.garch.beta.toFixed(3) },
              { k: "持続性 α+β", v: econ.garch.persistence.toFixed(3) },
              { k: "ショック半減期", v: `${econ.garch.halfLifeDays.toFixed(1)} 日` },
              { k: "長期均衡ボラ（年率）", v: `${econ.garch.longRunVolAnnual.toFixed(2)}%` },
            ].map((r) => (
              <div key={r.k} className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-3 last:border-0">
                <p className="text-[12px] text-dim">{r.k}</p>
                <p className="num text-xl font-semibold text-cy-400">{r.v}</p>
              </div>
            ))}
            <p className="font-mono text-[10px] leading-relaxed text-faint">σ²ₜ = ω + α·r²ₜ₋₁ + β·σ²ₜ₋₁。持続性が高いほど変動が長引く。</p>
          </div>
        </Panel>
        <Panel title="自己相関構造（95% 有意帯 ±2σ）">
          <div className="space-y-3">
            {[
              { label: "リターン ACF", data: econ.acfR, color: "#62b6de" },
              { label: "二乗リターン ACF（ARCH 検出）", data: econ.acfSq, color: "#eebf62" },
            ].map((g) => (
              <div key={g.label}>
                <p className="mb-1 font-mono text-[10px] text-faint">{g.label}</p>
                <svg viewBox="0 0 300 54" className="w-full">
                  <line x1="10" x2="290" y1="27" y2="27" stroke="#233247" />
                  <line x1="10" x2="290" y1="27 - 1.96 * 6" y2="27 - 11.8" stroke="none" />
                  <line x1="10" x2="290" y1={27 - 11.8} y2={27 - 11.8} stroke="#5d7288" strokeDasharray="2 3" strokeWidth="0.7" />
                  <line x1="10" x2="290" y1={27 + 11.8} y2={27 + 11.8} stroke="#5d7288" strokeDasharray="2 3" strokeWidth="0.7" />
                  {g.data.map((v, i) => {
                    const h = Math.max(-20, Math.min(20, v * 60));
                    return <rect key={i} x={16 + i * 27} y={h >= 0 ? 27 - h : 27} width="14" height={Math.abs(h)} fill={g.color} opacity="0.75" />;
                  })}
                </svg>
              </div>
            ))}
            <p className="font-mono text-[10px] text-faint">ラグ 1〜10。二乗系列に有意な相関があればボラは予測可能成分を持つ。</p>
          </div>
        </Panel>
      </div>

      {/* regime + rotation */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="相場レジーム判定 ── 現状の記述（予測ではない）">
          <div className="space-y-3">
            {[
              { k: "トレンド", d: reg.trend },
              { k: "ボラティリティ", d: reg.volState },
              { k: "リスク選好", d: reg.ddState },
            ].map((r) => (
              <div key={r.k} className="flex items-center gap-4 rounded-sm border border-line bg-ink-800/40 p-3">
                <span className="w-24 shrink-0 font-mono text-[10px] tracking-[0.18em] text-faint">{r.k}</span>
                <span className={`shrink-0 border px-2 py-1 font-mono text-[11px] ${toneBg(r.d.tone)} ${toneTxt(r.d.tone)}`}>{r.d.label}</span>
                <span className="text-[11px] leading-snug text-dim">{r.d.reason}</span>
              </div>
            ))}
            <div className="rounded-sm border border-gold-600/30 bg-gold-500/5 p-3">
              <p className="mb-1 font-mono text-[10px] tracking-[0.18em] text-gold-500">戦術メモ</p>
              <p className="text-[12px] leading-relaxed text-ink-100">{reg.memo}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-sm border border-line bg-ink-800/40 p-3">
                <p className="font-mono text-[10px] text-faint">曜日別ドリフト（平均 %/日）</p>
                <div className="mt-2 flex items-end gap-1">
                  {att.weekdays.map((w) => (
                    <div key={w.label} className="flex-1 text-center">
                      <div className="mx-auto w-full max-w-[26px] rounded-t-sm" style={{ height: `${Math.min(34, Math.abs(w.avgPct) * 900)}px`, background: w.avgPct >= 0 ? "#45d8a8" : "#f0616d", opacity: w.n ? 0.8 : 0.15 }} />
                      <p className="mt-1 font-mono text-[9px] text-faint">{w.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-sm border border-line bg-ink-800/40 p-3">
                <p className="font-mono text-[10px] text-faint">月別アノマリー（平均 %/日）</p>
                <div className="mt-2 flex items-end gap-[3px]">
                  {att.months.map((mo) => (
                    <div key={mo.label} className="flex-1">
                      <div className="mx-auto w-full rounded-t-sm" style={{ height: `${Math.min(34, Math.abs(mo.avgPct) * 900)}px`, background: mo.avgPct >= 0 ? "#45d8a8" : "#f0616d", opacity: mo.n ? 0.8 : 0.15 }} />
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-center font-mono text-[9px] text-faint">1月 → 12月</p>
              </div>
            </div>
          </div>
        </Panel>
        <Panel title="ローテーション（RRG 風）── 直近 6 点の軌跡">
          {rot.length ? (
            <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
              <RRGChart rot={rot} />
              <div className="space-y-2">
                {rot.slice(-10).reverse().map((p: RotationPoint) => (
                  <div key={p.t} className="flex items-center justify-between rounded-sm border border-line bg-ink-800/40 px-3 py-2 font-mono text-[11px]">
                    <span className="text-dim">{fmtDate(p.t)}</span>
                    <span style={{ color: QUADRANT_COLOR[p.quadrant] }}>{QUADRANT_LABEL[p.quadrant]}</span>
                  </div>
                ))}
                <p className="pt-1 font-mono text-[10px] leading-relaxed text-faint">
                  Mansfield 版 RS-Ratio/Momentum（Z スコア正規化）。JdK 純正版は平滑化が非公開のため絶対値は不一致（四象限の意味は同じ）。
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-faint">データが不足しています。</p>
          )}
        </Panel>
      </div>

      {/* signals */}
      <div className="mt-5">
        <Panel title={`シグナル ── 全件に実数根拠（${signals.length} 件）`}>
          <div className="grid gap-3 md:grid-cols-2">
            {signals.map((s) => (
              <div key={s.title} className={`rounded-sm border p-4 transition-transform duration-300 hover:-translate-y-0.5 ${toneBg(s.tone)}`}>
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-[9px] tracking-[0.2em] text-faint">{s.cat}</span>
                  <span className={`font-display text-[14px] font-bold ${toneTxt(s.tone)}`}>{s.title}</span>
                </div>
                <p className="text-[12px] leading-relaxed text-ink-100">{s.detail}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* formulas */}
      <div className="mt-5">
        <Panel title="再現できる計算 ── 独自指標は式を公開">
          <div className="grid gap-3 md:grid-cols-2">
            {FORMULAS.map((f) => (
              <div key={f.name} className="rounded-sm border border-line bg-ink-900/60 p-3">
                <p className="mb-1 font-mono text-[11px] font-semibold text-gold-300">{f.name}</p>
                <p className="font-mono text-[11px] leading-relaxed text-dim">{f.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-[10px] text-faint">
            設計の約束: ① 欠損は 0 ではなく null ② 推定値で穴を埋めない ③ 数字の無いシグナルは出さない
          </p>
        </Panel>
      </div>
    </div>
  );
}
