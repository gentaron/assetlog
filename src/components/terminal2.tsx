import { useMemo, useState } from "react";
import type { Metrics } from "../lib/metrics";
import type { TechResult } from "../lib/technicals";
import { attribution, QUADRANT_COLOR, QUADRANT_LABEL, rotationSeries, logReturns } from "../lib/econometrics";
import type { Bar } from "../lib/technicals";
import { generateSignals, rotationQuadrantHistory, type Signal } from "../lib/signals";
import { useReveal } from "../lib/hooks";

const f2 = (x: number) => x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (t: number) => new Date(t).toLocaleDateString("ja-JP", { year: "2-digit", month: "2-digit", day: "2-digit" });

/* ================= RRG ローテーション（Mansfield） ================= */
export function RotationPanel({ bars }: { bars: Bar[] }) {
  const ref = useReveal<HTMLDivElement>();
  const rot = useMemo(() => rotationSeries(bars), [bars]);
  const hist = useMemo(() => rotationQuadrantHistory(rot), [rot]);
  const tail = rot.slice(-80);
  if (tail.length < 3) return null;

  const W = 660,
    H = 460,
    P = 48;
  const xs = tail.map((p) => p.ratio);
  const ys = tail.map((p) => p.momentum);
  const x0 = Math.min(100, ...xs) - 1.5,
    x1 = Math.max(100, ...xs) + 1.5;
  const y0 = Math.min(100, ...ys) - 1.5,
    y1 = Math.max(100, ...ys) + 1.5;
  const X = (v: number) => P + ((v - x0) / (x1 - x0)) * (W - P * 2);
  const Y = (v: number) => H - P - ((v - y0) / (y1 - y0)) * (H - P * 2);
  const now = tail[tail.length - 1];
  const trail6 = tail.slice(-6);

  return (
    <div ref={ref} className="reveal panel panel-hover rounded-lg p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold tracking-wide">
          セクターローテーション<span className="ml-2 font-mono text-[11px] font-normal tracking-[0.2em] text-faint">RRG (Mansfield RS)</span>
        </h3>
        <span
          className="rounded-sm px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wider"
          style={{ color: QUADRANT_COLOR[now.quadrant], border: `1px solid ${QUADRANT_COLOR[now.quadrant]}55`, background: `${QUADRANT_COLOR[now.quadrant]}14` }}
        >
          現在: {QUADRANT_LABEL[now.quadrant]}象限
        </span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full min-w-[520px] max-w-[660px]" role="img" aria-label="ローテーション四象限チャート">
            {/* 象限の着色 */}
            <rect x={X(100)} y={P} width={X(x1) - X(100)} height={Y(100) - P} fill="#2fd48e" opacity="0.05" />
            <rect x={P} y={P} width={X(100) - P} height={Y(100) - P} fill="#4cc3ff" opacity="0.05" />
            <rect x={P} y={Y(100)} width={X(100) - P} height={H - P - Y(100)} fill="#ff6478" opacity="0.05" />
            <rect x={X(100)} y={Y(100)} width={X(x1) - X(100)} height={H - P - Y(100)} fill="#e9b44c" opacity="0.05" />
            <line x1={P} y1={Y(100)} x2={W - P} y2={Y(100)} stroke="#5c6b80" strokeDasharray="4 4" strokeWidth="1" />
            <line x1={X(100)} y1={P} x2={X(100)} y2={H - P} stroke="#5c6b80" strokeDasharray="4 4" strokeWidth="1" />
            <text x={W - P - 6} y={P + 16} textAnchor="end" fontSize="12" fill="#2fd48e" fontFamily="Noto Sans JP">先行</text>
            <text x={P + 6} y={P + 16} fontSize="12" fill="#4cc3ff" fontFamily="Noto Sans JP">改善</text>
            <text x={P + 6} y={H - P - 8} fontSize="12" fill="#ff6478" fontFamily="Noto Sans JP">劣後</text>
            <text x={W - P - 6} y={H - P - 8} textAnchor="end" fontSize="12" fill="#e9b44c" fontFamily="Noto Sans JP">失速</text>
            {/* 軌跡 */}
            <polyline
              points={tail.map((p) => `${X(p.ratio)},${Y(p.momentum)}`).join(" ")}
              fill="none"
              stroke="#e9b44c"
              strokeWidth="1.5"
              opacity="0.55"
            />
            {tail.map((p, i) => (
              <circle key={i} cx={X(p.ratio)} cy={Y(p.momentum)} r={i >= tail.length - 6 ? 4 : 2} fill={QUADRANT_COLOR[p.quadrant]} opacity={0.35 + (0.65 * i) / tail.length} />
            ))}
            {trail6.map((p, i) => (
              <circle key={`t${i}`} cx={X(p.ratio)} cy={Y(p.momentum)} r="4.5" fill="none" stroke={QUADRANT_COLOR[p.quadrant]} strokeWidth="1.5" />
            ))}
            <circle cx={X(now.ratio)} cy={Y(now.momentum)} r="7" fill={QUADRANT_COLOR[now.quadrant]} className="pulse-dot" />
            <text x={X(now.ratio)} y={Y(now.momentum) - 14} textAnchor="middle" fontSize="11" fill="#e8eef7" fontFamily="IBM Plex Mono">
              {f2(now.ratio)} / {f2(now.momentum)}
            </text>
            <text x={W / 2} y={H - 12} textAnchor="middle" fontSize="11" fill="#8a97a8" fontFamily="Noto Sans JP">RS-Ratio（200日線比・126日Zスコア）→</text>
            <text x={14} y={H / 2} textAnchor="middle" fontSize="11" fill="#8a97a8" fontFamily="Noto Sans JP" transform={`rotate(-90 14 ${H / 2})`}>RS-Momentum（Ratio の 10日変化）→</text>
          </svg>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-relaxed text-dim">
            200日移動平均に対する相対強度（RS-Ratio）と、その変化の勢い（RS-Momentum）の2軸で、総資産の「地形の中での位置」を四象限に置く。
            <span className="text-faint"> 直近 6 点の軌跡は円で強調。回転方向（改善→先行→失速→劣後→改善）がトレンドのライフサイクル。</span>
          </p>
          <div className="rounded-sm border border-line bg-ink-800/60 p-3 font-mono text-[11px] leading-relaxed text-dim">
            <p className="mb-1 tracking-[0.18em] text-faint">QUADRANT TIMELINE（直近）</p>
            {hist.slice(-6).reverse().map((h, i) => (
              <p key={i} className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: QUADRANT_COLOR[h.quadrant] }} />
                <span style={{ color: QUADRANT_COLOR[h.quadrant] }}>{QUADRANT_LABEL[h.quadrant]}</span>
                <span className="text-faint">{fmtDate(h.from)} → {fmtDate(h.to)}</span>
              </p>
            ))}
          </div>
          <p className="font-mono text-[11px] leading-relaxed text-faint">
            ※ 本家 JdK RS-Ratio は非公開の平滑化を使うため絶対値は一致しない。四象限の意味と回転方向は同じ。式は「再現できる計算」に公開。
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================= 相場レジーム判定 ================= */
export function RegimePanel({ m, t }: { m: Metrics; t: TechResult }) {
  const ref = useReveal<HTMLDivElement>();
  const rs = useMemo(() => logReturns(m.daily.map((d) => d.close)), [m]);
  const sd = (xs: number[]) => {
    const mu = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    return Math.sqrt(xs.reduce((a, b) => a + (b - mu) * (b - mu), 0) / Math.max(1, xs.length - 1));
  };
  const vol20 = sd(rs.slice(-20)) * Math.sqrt(365) * 100;
  const vol60 = sd(rs.slice(-60)) * Math.sqrt(365) * 100;
  const vol20Series: number[] = [];
  for (let i = 20; i <= rs.length; i++) vol20Series.push(sd(rs.slice(i - 20, i)));
  const volRank = (vol20Series.filter((v) => v <= vol20).length / Math.max(1, vol20Series.length)) * 100;
  const r3m = (m.latest.v / m.daily[Math.max(0, m.daily.length - 91)].close - 1) * 100;
  const sma50Slope = (t.ma.sma50 / m.daily[Math.max(0, m.daily.length - 21)].close - 1) * 100;
  const rot = rotationSeries(t.bars);
  const nowRot = rot[rot.length - 1];

  const trend: { verdict: string; tone: string; evidence: string[] } =
    m.latest.v > t.ma.sma200 && t.adx.adx >= 25 && t.adx.plusDI > t.adx.minusDI
      ? { verdict: "上昇トレンド", tone: "#2fd48e", evidence: [`価格 > SMA200 (${f2(t.ma.sma200)})`, `ADX ${f2(t.adx.adx)} ≥ 25`, `+DI ${f2(t.adx.plusDI)} > −DI ${f2(t.adx.minusDI)}`] }
      : m.latest.v > t.ma.sma200
      ? { verdict: "トレンド弱含み", tone: "#e9b44c", evidence: [`価格 > SMA200 だが ADX ${f2(t.adx.adx)} < 25 か ±DI 逆転`, `SMA50 傾き ${f2(sma50Slope)}%（20日）`] }
      : { verdict: "下降/レンジ", tone: "#ff6478", evidence: [`価格 < SMA200 (${f2(t.ma.sma200)})`, `ADX ${f2(t.adx.adx)}`] };

  const vola: { verdict: string; tone: string; evidence: string[] } =
    volRank <= 35
      ? { verdict: "ボラ低位（平静）", tone: "#2fd48e", evidence: [`20日年率ボラ ${f2(vol20)}%`, `過去1年の分布で ${volRank.toFixed(0)} パーセンタイル`] }
      : volRank <= 70
      ? { verdict: "ボラ中立", tone: "#e9b44c", evidence: [`20日年率ボラ ${f2(vol20)}%（百分位 ${volRank.toFixed(0)}）`, `60日比 ${vol20 <= vol60 ? "収縮" : "拡大"}`] }
      : { verdict: "ボラ高止まり", tone: "#ff6478", evidence: [`20日年率ボラ ${f2(vol20)}%（百分位 ${volRank.toFixed(0)}）`, `60日 ${f2(vol60)}% を${vol20 > vol60 ? "上回る" : "下回る"}`] };

  const mom: { verdict: string; tone: string; evidence: string[] } =
    r3m > 2 && nowRot && (nowRot.quadrant === "leading" || nowRot.quadrant === "improving")
      ? { verdict: "モメンタム陽", tone: "#2fd48e", evidence: [`3ヶ月リターン +${f2(r3m)}%`, `RS 象限: ${QUADRANT_LABEL[nowRot.quadrant]}`] }
      : r3m > 0
      ? { verdict: "モメンタム中立", tone: "#e9b44c", evidence: [`3ヶ月リターン +${f2(r3m)}%`, nowRot ? `RS 象限: ${QUADRANT_LABEL[nowRot.quadrant]}` : ""] }
      : { verdict: "モメンタム陰", tone: "#ff6478", evidence: [`3ヶ月リターン ${f2(r3m)}%`, nowRot ? `RS 象限: ${QUADRANT_LABEL[nowRot.quadrant]}` : ""] };

  const axes = [
    { name: "トレンド", icon: "M3 17l6-6 4 4 8-8", ...trend },
    { name: "ボラティリティ", icon: "M3 12h4l3-8 4 16 3-8h4", ...vola },
    { name: "リスク選好", icon: "M13 2L3 14h7l-1 8 10-12h-7l1-8", ...mom },
  ];

  const memo =
    trend.tone === "#2fd48e" && vola.tone === "#2fd48e"
      ? "上昇トレンド × 低ボラの複合レジーム。歴史的に「保有の継続」が報われやすい地形だが、ボラ百分位の反転（平静→拡大）が唯一の早期警報。ATR ベースのトレーリングで利益を保護する局面。"
      : trend.tone === "#2fd48e"
      ? "トレンドは上だがボラが落ち着かない地形。フルサイズの新規投入より、押し目での分割が統計的に有利。ポジションサイズを ATR の拡大率に逆比例させて調整する局面。"
      : vola.tone === "#ff6478"
      ? "ボラ高止まり × トレンド不在。現金比率の引き上げと、ドローダウン予算（例: −3% で機械的縮小）の再確認が有効な地形。逆張りは ATR 2 倍幅に到達した地点のみ。"
      : "レンジ優勢の地形。高値追い・安値叩きよりも、支持/抵抗帯の攻防ラインでの限定リスクの往復、あるいは何もしない（コスト最小）が期待値で勝る局面。";

  return (
    <div ref={ref} className="reveal panel panel-hover rounded-lg p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold tracking-wide">
          相場レジーム判定<span className="ml-2 font-mono text-[11px] font-normal tracking-[0.2em] text-faint">REGIME — 予測ではなく現状の記述</span>
        </h3>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {axes.map((a) => (
          <div key={a.name} className="rounded-sm border border-line bg-ink-800/50 p-4 transition-colors duration-300 hover:border-gold-500/40">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-faint">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke={a.tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={a.icon} /></svg>
                {a.name}
              </span>
              <span className="rounded-sm px-2 py-0.5 font-mono text-[11px] font-bold" style={{ color: a.tone, background: `${a.tone}18`, border: `1px solid ${a.tone}50` }}>
                {a.verdict}
              </span>
            </div>
            <ul className="space-y-1">
              {a.evidence.filter(Boolean).map((e, i) => (
                <li key={i} className="num text-[12px] text-dim">▸ {e}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-sm border border-gold-500/30 bg-gold-500/[0.06] p-4">
        <p className="mb-1 font-mono text-[11px] tracking-[0.22em] text-gold-300">地形に応じた戦術メモ</p>
        <p className="text-[13px] leading-relaxed text-ink-100">{memo}</p>
      </div>
    </div>
  );
}

/* ================= リターンアトリビューション ================= */
export function AttributionPanel({ m }: { m: Metrics }) {
  const ref = useReveal<HTMLDivElement>();
  const att = useMemo(() => attribution(m.daily, m.records), [m]);
  const maxAbs = Math.max(0.05, ...att.weekday.map((w) => Math.abs(w.meanPct)));
  const maxM = Math.max(0.02, ...att.monthly.map((x) => Math.abs(x.meanPct)));
  const heatColor = (v: number, mx: number) => {
    const a = Math.min(1, Math.abs(v) / mx);
    return v >= 0 ? `rgba(47,212,142,${0.12 + a * 0.55})` : `rgba(255,100,120,${0.12 + a * 0.55})`;
  };
  return (
    <div ref={ref} className="reveal panel panel-hover rounded-lg p-5 md:p-6">
      <h3 className="mb-1 font-display text-lg font-bold tracking-wide">
        リターン分解<span className="ml-2 font-mono text-[11px] font-normal tracking-[0.2em] text-faint">RETURN ATTRIBUTION</span>
      </h3>
      <p className="mb-5 text-[12px] text-faint">リターンが「いつ」生まれているかを分解する。構造的な偏りがあれば、それは戦略の見直しシグナル。</p>
      <div className="grid gap-6 lg:grid-cols-3">
        <div>
          <p className="mb-3 font-mono text-[11px] tracking-[0.2em] text-faint">曜日効果（日次リターン平均 %）</p>
          <div className="space-y-1.5">
            {att.weekday.map((w) => (
              <div key={w.label} className="group flex items-center gap-2">
                <span className="w-6 font-mono text-[11px] text-dim">{w.label}</span>
                <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-ink-800/70">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
                  <div
                    className="absolute inset-y-0.5 rounded-sm transition-all duration-500 group-hover:brightness-125"
                    style={{
                      left: w.meanPct >= 0 ? "50%" : `${50 - (Math.abs(w.meanPct) / maxAbs) * 48}%`,
                      width: `${(Math.abs(w.meanPct) / maxAbs) * 48}%`,
                      background: w.meanPct >= 0 ? "#2fd48e" : "#ff6478",
                    }}
                  />
                </div>
                <span className="num w-16 text-right text-[11px]" style={{ color: w.meanPct >= 0 ? "#2fd48e" : "#ff6478" }}>
                  {w.n ? (w.meanPct >= 0 ? "+" : "") + w.meanPct.toFixed(3) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 font-mono text-[11px] tracking-[0.2em] text-faint">月別アノマリー（平均日次リターン %）</p>
          <div className="grid grid-cols-4 gap-1.5">
            {att.monthly.map((x) => (
              <div
                key={x.m}
                className="num rounded-sm border border-line px-2 py-2 text-center text-[11px] transition-transform duration-300 hover:-translate-y-0.5"
                style={{ background: heatColor(x.meanPct, maxM) }}
              >
                <p className="text-[10px] text-faint">{x.m}月</p>
                <p style={{ color: x.meanPct >= 0 ? "#7fe8bb" : "#ffa3b0" }}>{x.n ? (x.meanPct >= 0 ? "+" : "") + x.meanPct.toFixed(3) : "—"}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[11px] tracking-[0.2em] text-faint">時間帯ドリフト（0:25 → 12:25）</p>
          <div className="flex-1 rounded-sm border border-line bg-ink-800/50 p-4">
            <p className="num font-display text-3xl font-bold" style={{ color: att.intraday.driftPct >= 0 ? "#2fd48e" : "#ff6478" }}>
              {att.intraday.driftPct >= 0 ? "+" : ""}
              {att.intraday.driftPct.toFixed(4)}%
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-dim">
              同日の朝スナップショット→昼スナップショットの平均変化。サンプル {att.intraday.n} 日、プラス率 {att.intraday.hitRate.toFixed(1)}%。
              夜間（前日 12:25→当日 0:25）の寄与と合わせて、リターンの発生源を時間帯で特定する。
            </p>
          </div>
          <div className="rounded-sm border border-line bg-ink-800/50 p-4">
            <p className="mb-1 font-mono text-[10px] tracking-[0.2em] text-faint">読み方</p>
            <p className="text-[12px] leading-relaxed text-dim">
              日次リターンを「0:25→12:25 の日中」と「前日 12:25→当日 0:25 の夜間」に分解したとき、上段は日中成分の実測平均。
              継続的にプラスならリターンの源泉は日中の値動きにあり、夜間寄り付きのリスクは限定的と読める。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= シグナルフィード ================= */
const TONE_META: Record<Signal["tone"], { label: string; color: string }> = {
  bull: { label: "強気", color: "#2fd48e" },
  bear: { label: "弱気", color: "#ff6478" },
  warn: { label: "注意", color: "#e9b44c" },
  neutral: { label: "中立", color: "#4cc3ff" },
};

export function SignalFeed({ m, t }: { m: Metrics; t: TechResult }) {
  const ref = useReveal<HTMLDivElement>();
  const [cat, setCat] = useState<string>("すべて");
  const signals = useMemo(() => generateSignals(m, t), [m, t]);
  const cats = ["すべて", "テクニカル", "リスク", "構造", "クオンツ", "レジーム"];
  const shown = signals.filter((s) => cat === "すべて" || s.category === cat);
  const count = (tone: Signal["tone"]) => signals.filter((s) => s.tone === tone).length;
  return (
    <div ref={ref} className="reveal panel rounded-lg p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold tracking-wide">
          シグナル<span className="ml-2 font-mono text-[11px] font-normal tracking-[0.2em] text-faint">全件・実数根拠つき — 数字の無いシグナルは出さない</span>
        </h3>
        <div className="flex gap-2 font-mono text-[11px]">
          <span style={{ color: "#2fd48e" }}>強気 {count("bull")}</span>
          <span style={{ color: "#ff6478" }}>弱気 {count("bear")}</span>
          <span style={{ color: "#e9b44c" }}>注意 {count("warn")}</span>
          <span style={{ color: "#4cc3ff" }}>中立 {count("neutral")}</span>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`min-h-[40px] rounded-sm border px-3 font-mono text-xs tracking-wider transition-all duration-200 ${
              cat === c ? "border-gold-400 bg-gold-500/15 text-gold-300" : "border-line text-dim hover:border-gold-500/40 hover:text-ink-100"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid gap-2.5 md:grid-cols-2">
        {shown.map((s) => {
          const meta = TONE_META[s.tone];
          return (
            <div
              key={s.id}
              className="group rounded-sm border border-line bg-ink-800/40 p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-500/40 hover:bg-ink-800/70"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className="rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold" style={{ color: meta.color, background: `${meta.color}16`, border: `1px solid ${meta.color}45` }}>
                  {meta.label}
                </span>
                <span className="font-mono text-[10px] tracking-[0.18em] text-faint">{s.category}</span>
              </div>
              <p className="text-[13.5px] font-bold text-ink-100">{s.name}</p>
              <p className="num mt-1 text-[11.5px] leading-relaxed text-dim">{s.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= 再現できる計算 ================= */
export function FormulasPanel() {
  const ref = useReveal<HTMLDivElement>();
  const blocks: { title: string; body: string; note: string }[] = [
    {
      title: "ローテーション座標（Mansfield 版 RS-Ratio / RS-Momentum）",
      body: "RS_t        = 総資産_t / SMA200_t\nrsRatio_t   = 100 + 10 × z₁₂₆(RS_t)\nrsMomentum_t= 100 + 10 × z₁₂₆(rsRatio_t − rsRatio_{t−10})",
      note: "本家 JdK は非公開の平滑化を使うため絶対値は一致しない。四象限の意味と回転方向は同じ。Z スコアは rolling 126 日。",
    },
    {
      title: "合議制テクニカルスコア",
      body: "score = 50 + 50 × Σ(vote_i × w_i) / Σ(w_i)\nvote ∈ {+1 強気, 0 中立, −1 弱気}、重み w は RSI/MACD 1.2 〜 ATR 0.4",
      note: "スコアだけでなく「どの指標がどう効いたか」を 1 行ずつ開示する（内訳表）。",
    },
    {
      title: "Wilder RSI(14)",
      body: "avgGain_t = (avgGain_{t−1}×13 + gain_t) / 14\nRSI = 100 − 100 / (1 + avgGain / avgLoss)",
      note: "Wilder の指数平滑版。単純 SMA 版とは数値が異なる。",
    },
    {
      title: "Hurst 指数（R/S 解析）",
      body: "R/S(n) ∝ n^H\nlog(R/S) を log(n) に回帰した傾きが H\nH>0.5 トレンド持続 / H=0.5 ランダムウォーク / H<0.5 平均回帰",
      note: "分割サイズ n/1, n/2, n/4, n/8 の 4 点で推定。",
    },
    {
      title: "GARCH(1,1)",
      body: "σ²_t = ω + α·r²_{t−1} + β·σ²_{t−1}\nω = σ̄²(1−α−β)（分散ターゲティング）\n半減期 = ln2 / ln(α+β)",
      note: "ガウス尤度のグリッド最尤推定（α: 0.01–0.40, β: 0.50–0.99）。",
    },
    {
      title: "日足バーの再構築（開示）",
      body: "open  = 前日終値\nhigh  = 当日スナップショット最大値\nlow   = 当日スナップショット最小値\nclose = 当日最終スナップショット",
      note: "1 日 2 回（0:25/12:25）の観測からの再構築。真の日中高安ではなく観測窓内の高安。ATR/ストキャス/ADX はこの制約下での計算。",
    },
  ];
  return (
    <div ref={ref} className="reveal panel rounded-lg p-5 md:p-6">
      <h3 className="mb-1 font-display text-lg font-bold tracking-wide">
        再現できる計算<span className="ml-2 font-mono text-[11px] font-normal tracking-[0.2em] text-faint">REPRODUCIBLE MATH</span>
      </h3>
      <p className="mb-5 text-[12px] text-faint">「なんとなくそれっぽいチャート」を出さないために、独自定義の指標は式を公開する。</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {blocks.map((b) => (
          <div key={b.title} className="rounded-sm border border-line bg-ink-800/50 p-4 transition-colors duration-300 hover:border-gold-500/35">
            <p className="mb-2 font-mono text-[11px] tracking-[0.16em] text-gold-300">{b.title}</p>
            <pre className="num mb-2 overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed text-ink-100">{b.body}</pre>
            <p className="text-[11px] leading-relaxed text-faint">{b.note}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3 rounded-sm border border-line bg-ink-800/40 p-4 text-[12px] leading-relaxed text-dim md:grid-cols-3">
        <p><span className="font-bold text-gold-300">約束 1.</span> 取れなかった値は 0 ではなく null。0 は「意味のある値」であり欠損と混ぜた瞬間ランキングが壊れる。UI では — として表示。</p>
        <p><span className="font-bold text-gold-300">約束 2.</span> 推定値で穴を埋めない。MFI/OBV は出来高不在のため日次 P&L での近似と明示。仮定を置いた派生指標はすべて注記つき。</p>
        <p><span className="font-bold text-gold-300">約束 3.</span> どの数字がどこから来たか開示する。このパネルと合議の内訳表がそれにあたる。</p>
      </div>
    </div>
  );
}
