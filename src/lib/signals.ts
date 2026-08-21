import type { Metrics } from "./metrics";
import type { TechResult } from "./technicals";
import { logReturns, rotationSeries, hurstExponent } from "./econometrics";
import type { RotationPoint } from "./econometrics";

export interface Signal {
  id: string;
  category: "テクニカル" | "リスク" | "構造" | "クオンツ" | "レジーム";
  tone: "bull" | "bear" | "warn" | "neutral";
  name: string;
  detail: string; // 実数の根拠（数字の無いシグナルは出さない）
}

const f2 = (x: number) => x.toFixed(2);

export function generateSignals(m: Metrics, t: TechResult): Signal[] {
  const out: Signal[] = [];
  const add = (s: Omit<Signal, "id">) => out.push({ id: `${s.category}-${out.length}`, ...s });
  const closes = m.daily.map((d) => d.close);
  const last = m.latest.v;
  const rs = logReturns(closes);
  const rot = rotationSeries(t.bars);
  const nowRot = rot[rot.length - 1];

  /* ---- テクニカル ---- */
  if (t.ma.golden)
    add({ category: "テクニカル", tone: "bull", name: "ゴールデンクロス発生", detail: `直近 10 日以内に SMA50 が SMA200 を上抜け。中期トレンド転換の古典シグナル（SMA200=${f2(t.ma.sma200)}）。` });
  if (t.ma.dead)
    add({ category: "テクニカル", tone: "bear", name: "デッドクロス発生", detail: `直近 10 日以内に SMA50 が SMA200 を下抜け（SMA200=${f2(t.ma.sma200)}）。` });
  if (t.ma.perfectUp)
    add({ category: "テクニカル", tone: "bull", name: "パーフェクトオーダー（上昇）", detail: `SMA5>${"10>20>50>100>200"} が完全順列。押し目を待つか、トレンドフォロ―の継続が統計的に優位な形状。` });
  if (t.ma.perfectDown)
    add({ category: "テクニカル", tone: "bear", name: "パーフェクトオーダー（下降）", detail: "移動平均線が完全な下降順列。逆張りよりリスク管理優先の形状。" });
  if (last > t.ma.sma200)
    add({ category: "テクニカル", tone: "bull", name: "200日線超えを維持", detail: `現在値 ${f2(last)} は SMA200 ${f2(t.ma.sma200)} を ${f2((last / t.ma.sma200 - 1) * 100)}% 上回る。長期上昇トレンド内の定義を満たす。` });
  else
    add({ category: "テクニカル", tone: "bear", name: "200日線割れ", detail: `現在値 ${f2(last)} が SMA200 ${f2(t.ma.sma200)} を ${f2((1 - last / t.ma.sma200) * 100)}% 下回る。長期トレンドの定義が崩れている。` });
  if (t.boll.squeeze)
    add({ category: "テクニカル", tone: "warn", name: "ボリンジャー・スクイーズ", detail: `バンド幅が全期間の ${f2(t.boll.bwPercentile)} パーセンタイル（BW=${f2(t.boll.bandwidth)}%）。ボラ収縮後は拡大が統計的に続く — 方向ではなく「動きの準備」のシグナル。` });
  if (t.boll.pctB > 1)
    add({ category: "テクニカル", tone: "warn", name: "上限バンド突破（%B>1）", detail: `%B=${f2(t.boll.pctB)}。バンドウォークの可能性と過熱の両面。ATR ${f2(t.atrPct)}%/日に対し上値余地を要確認。` });
  if (t.macd.hist > 0 && t.macd.histSlope > 0)
    add({ category: "テクニカル", tone: "bull", name: "MACD ヒストグラム拡大", detail: `hist=${f2(t.macd.hist)}（前日比 +${f2(t.macd.histSlope)}）。モメンタムの加速度が陽。` });
  if (t.macd.hist < 0 && t.macd.histSlope > 0)
    add({ category: "テクニカル", tone: "neutral", name: "MACD 陰線縮小", detail: `hist=${f2(t.macd.hist)} だが縮小中（+${f2(t.macd.histSlope)}）。下げモメンタムの減衰。` });
  if (t.div === "bullish")
    add({ category: "テクニカル", tone: "bull", name: "RSI 上昇ダイバージェンス", detail: "価格は安値更新だが RSI(14) は切り上げ。60 日窓で検出。底打ち系の古典パターン。" });
  if (t.div === "bearish")
    add({ category: "テクニカル", tone: "bear", name: "RSI 下落ダイバージェンス", detail: "価格は高値更新だが RSI(14) は切り下げ。60 日窓で検出。天井圏の警告パターン。" });
  if (t.adx.adx >= 25)
    add({
      category: "テクニカル",
      tone: t.adx.plusDI > t.adx.minusDI ? "bull" : "bear",
      name: `トレンド成立（ADX ${f2(t.adx.adx)}）`,
      detail: `ADX≥25 でトレンド相場と判定。+DI=${f2(t.adx.plusDI)} vs −DI=${f2(t.adx.minusDI)}。レンジ戦略（逆張り）より順張りが有効な地形。`,
    });
  else
    add({ category: "テクニカル", tone: "neutral", name: `レンジ判定（ADX ${f2(t.adx.adx)}）`, detail: `ADX<25 でトレンド不在。ボリンジャー %B=${f2(t.boll.pctB)} と支持/抵抗帯の間の往復を想定。` });
  if (t.srs.length > 0) {
    const nearest = t.srs[0];
    if (Math.abs(nearest.distPct) < 1.5)
      add({
        category: "テクニカル",
        tone: "warn",
        name: `${nearest.kind === "support" ? "支持帯" : "抵抗帯"}への接近`,
        detail: `最寄りの${nearest.kind === "support" ? "支持" : "抵抗"}水準 ${f2(nearest.price)}（接触 ${nearest.touches} 回）まで ${f2(nearest.distPct)}%。攻防ラインでの反応に注目。`,
      });
  }
  if (t.stoch.k < 20 && t.stoch.k > t.stoch.d)
    add({ category: "テクニカル", tone: "bull", name: "ストキャスティクス強気クロス（売られ過ぎ圏）", detail: `%K=${f2(t.stoch.k)} / %D=${f2(t.stoch.d)}。20 未満からの K>D は短期反発の定番。` });
  if (t.stoch.k > 80 && t.stoch.k < t.stoch.d)
    add({ category: "テクニカル", tone: "bear", name: "ストキャスティクス弱気クロス（買われ過ぎ圏）", detail: `%K=${f2(t.stoch.k)} / %D=${f2(t.stoch.d)}。80 超からの K<D は短期調整の定番。` });

  /* ---- リスク ---- */
  add({
    category: "リスク",
    tone: Math.abs(m.mdd) < 5 ? "bull" : "warn",
    name: `最大ドローダウン ${f2(m.mdd)}%`,
    detail: `ピーク ${f2(m.mddPeak.v)}（${new Date(m.mddPeak.t).toLocaleDateString("ja-JP")}）→ ボトム ${f2(m.mddTrough.v)}。年率ボラ ${f2(m.volAnnual)}% に対する DD/Vol レシオは ${(Math.abs(m.mdd) / Math.max(0.01, m.volAnnual)).toFixed(2)} — 1 未満はボラに対して浅い傷。`,
  });
  const sigma2 = rs.filter((r) => Math.abs(r) > 2 * sdOf(rs)).length;
  add({
    category: "リスク",
    tone: sigma2 <= 3 ? "neutral" : "warn",
    name: `±2σ 超え日数: ${sigma2} 日 / ${rs.length} 日`,
    detail: `正規分布なら期待値は約 ${(rs.length * 0.0455).toFixed(1)} 日。ファットテールの厚さを実測で開示。`,
  });
  if (m.currentStreak > 0)
    add({ category: "リスク", tone: "bull", name: `連続プラス ${m.currentStreak} 日`, detail: `日次勝率 ${f2(m.winRate)}% のもとで ${m.currentStreak} 連勝。過信せず、サイズ管理は維持。` });
  if (m.currentStreak < 0)
    add({ category: "リスク", tone: "warn", name: `連続マイナス ${-m.currentStreak} 日`, detail: `日次勝率 ${f2(m.winRate)}% に対する連敗。過去最長連敗と比較し、通常変動の範囲か確認を。` });

  /* ---- 構造 ---- */
  const hurst = hurstExponent(rs);
  add({
    category: "構造",
    tone: hurst > 0.55 ? "bull" : hurst < 0.45 ? "warn" : "neutral",
    name: `Hurst 指数 ${hurst.toFixed(3)}`,
    detail:
      hurst > 0.55
        ? "0.5 を明確に上回る＝トレンド持続性あり。押し目での順張りが統計的に報われやすい構造。"
        : hurst < 0.45
        ? "0.5 を明確に下回る＝平均回帰優勢。高値追いよりレンジ逆張りが有効な構造。"
        : "0.5 付近＝ランダムウォークに近く、テクニカル優位は限定的。コスト管理がリターンの源泉。",
  });
  if (nowRot) {
    const quadJp = { leading: "先行", weakening: "失速", lagging: "劣後", improving: "改善" }[nowRot.quadrant];
    add({
      category: "構造",
      tone: nowRot.quadrant === "leading" ? "bull" : nowRot.quadrant === "improving" ? "bull" : nowRot.quadrant === "lagging" ? "bear" : "warn",
      name: `ローテーション座標: ${quadJp}象限`,
      detail: `RS-Ratio=${f2(nowRot.ratio)} / RS-Momentum=${f2(nowRot.momentum)}（SMA200 比を 126 日 Z スコア化）。200日線比の相対強度と、その変化率の四象限。`,
    });
  }
  const ytdDays = m.daily.filter((d) => new Date(d.t).getFullYear() === new Date(m.latest.t).getFullYear());
  if (ytdDays.length > 5) {
    const ytd = (m.latest.v / ytdDays[0].close - 1) * 100;
    add({ category: "構造", tone: ytd > 0 ? "bull" : "bear", name: `年初来 ${ytd > 0 ? "+" : ""}${f2(ytd)}%`, detail: `${new Date(m.latest.t).getFullYear()} 年入り ${ytdDays.length} 営業日の累計。月次ペース ${(ytd / Math.max(1, ytdDays.length / 30)).toFixed(2)}%/月。` });
  }

  /* ---- クオンツ ---- */
  add({
    category: "クオンツ",
    tone: m.sharpe > 1.5 ? "bull" : m.sharpe > 0.8 ? "neutral" : "warn",
    name: `シャープレシオ ${m.sharpe.toFixed(2)}`,
    detail: `(CAGR ${f2(m.cagr)}% − 無リスク 0%) ÷ 年率ボラ ${f2(m.volAnnual)}%。1.0 超は「取ったリスクの割に報われている」領域。`,
  });
  add({
    category: "クオンツ",
    tone: m.calmar > 3 ? "bull" : "neutral",
    name: `カルマーレシオ ${m.calmar.toFixed(2)}`,
    detail: `CAGR ÷ |最大DD| = ${f2(m.cagr)} ÷ ${f2(Math.abs(m.mdd))}。ダウンサイドに対する複利効率。`,
  });
  const kelly = m.winRate / 100 - (1 - m.winRate / 100) / Math.max(0.01, m.profitFactor);
  add({
    category: "クオンツ",
    tone: kelly > 0.4 ? "bull" : kelly > 0.2 ? "neutral" : "warn",
    name: `ケリー基準 ${(kelly * 100).toFixed(1)}%`,
    detail: `勝率 ${f2(m.winRate)}% × PF ${m.profitFactor.toFixed(2)} からの最適投入比率。実運用は半ケリー以下が破産確率の観点から標準。`,
  });
  if (m.bestDay.pct !== 0)
    add({
      category: "クオンツ",
      tone: "neutral",
      name: "リターンの集中リスク",
      detail: `ベスト日 +${f2(m.bestDay.pct)}%（${new Date(m.bestDay.t).toLocaleDateString("ja-JP")}）。この 1 日を逃すと総リターンは ${f2(m.totalReturn - m.bestDay.pct)}% に低下 — 全期間リターンの ${((m.bestDay.pct / Math.max(0.01, m.totalReturn)) * 100).toFixed(1)}% を 1 日で稼いでいる。`,
    });

  /* ---- レジーム ---- */
  const vol20 = sdOf(rs.slice(-20)) * Math.sqrt(365) * 100;
  const vol60 = sdOf(rs.slice(-60)) * Math.sqrt(365) * 100;
  add({
    category: "レジーム",
    tone: vol20 < vol60 ? "bull" : "warn",
    name: `ボラティリティ・レジーム: ${vol20 < vol60 ? "収縮" : "拡大"}`,
    detail: `直近 20 日年率ボラ ${f2(vol20)}% vs 60 日 ${f2(vol60)}%。${vol20 < vol60 ? "リスク環境は鎮静方向。" : "短期的にリスクが上昇中。サイズ縮小の根拠になりうる。"}`,
  });
  add({
    category: "レジーム",
    tone: m.isAllTimeHigh ? "bull" : "neutral",
    name: m.isAllTimeHigh ? "史上最高値レジーム" : "最高値からの距離",
    detail: m.isAllTimeHigh
      ? `新高値更新 ${m.newHighCount} 回。最高値圏での運用は「売る理由がない」が、ATR ${f2(t.atrPct)}%/日の振れは織り込む。`
      : `現在値は最高値 ${f2(Math.max(...m.records.map((r) => r.v)))} から ${f2((1 - last / Math.max(...m.records.map((r) => r.v))) * 100)}% 下方。`,
  });

  return out;
}

function sdOf(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mu) * (b - mu), 0) / (xs.length - 1));
}

export function rotationQuadrantHistory(rot: RotationPoint[]): { quadrant: RotationPoint["quadrant"]; from: number; to: number }[] {
  const out: { quadrant: RotationPoint["quadrant"]; from: number; to: number }[] = [];
  for (const p of rot) {
    const lastSeg = out[out.length - 1];
    if (lastSeg && lastSeg.quadrant === p.quadrant) lastSeg.to = p.t;
    else out.push({ quadrant: p.quadrant, from: p.t, to: p.t });
  }
  return out;
}
