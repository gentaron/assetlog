import { useMemo, type CSSProperties } from "react";
import type { Metrics } from "../lib/metrics";
import { buildBars, computeTechnicals, resample } from "../lib/technicals";
import type { Bar, TechResult } from "../lib/technicals";
import { adfTest, archTest, autocorr, garch11, hurstExponent, jarqueBera, logReturns } from "../lib/econometrics";
import { useCountUp, useReveal } from "../lib/hooks";
import { AttributionPanel, FormulasPanel, RegimePanel, RotationPanel, SignalFeed } from "./terminal2";

const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });

/* ================= 合議スコアゲージ ================= */
function Gauge({ score, verdict }: { score: number; verdict: string }) {
  const color = score >= 60 ? "#2fd48e" : score >= 52 ? "#8fd9b4" : score > 48 ? "#9aa7b8" : score > 40 ? "#e9b44c" : "#ff6478";
  const ang = -180 + (score / 100) * 180;
  const arc = (from: number, to: number, c: string, w = 10) => {
    const r = 86;
    const p1 = polar(100, 96, r, from);
    const p2 = polar(100, 96, r, to);
    return <path d={`M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`} stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" opacity="0.28" />;
  };
  const needleTip = polar(100, 96, 66, ang);
  return (
    <svg viewBox="0 0 200 118" className="mx-auto block w-full max-w-[280px]">
      {arc(-180, -108, "#ff6478")}
      {arc(-106, -81, "#e9b44c")}
      {arc(-79, -63, "#9aa7b8")}
      {arc(-61, -27, "#8fd9b4")}
      {arc(-25, 0, "#2fd48e")}
      <line
        x1="100"
        y1="96"
        x2={needleTip.x}
        y2={needleTip.y}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        className="gauge-needle"
        style={{ "--sweep": `${-180 - ang}deg` } as CSSProperties}
      />
      <circle cx="100" cy="96" r="5" fill={color} />
      <text x="100" y="70" textAnchor="middle" fontSize="30" fontWeight="700" fill={color} fontFamily="IBM Plex Mono, monospace">
        {score.toFixed(0)}
      </text>
      <text x="100" y="112" textAnchor="middle" fontSize="12" fill="#c6d0dc" fontFamily="Noto Sans JP">
        {verdict}
      </text>
      <text x="14" y="100" fontSize="9" fill="#8a97a8" fontFamily="IBM Plex Mono">0</text>
      <text x="178" y="100" fontSize="9" fill="#8a97a8" fontFamily="IBM Plex Mono">100</text>
    </svg>
  );
}
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/* ================= ステータスストリップ + 合議 ================= */
function ConsensusSection({ m, t }: { m: Metrics; t: TechResult }) {
  const ref = useReveal<HTMLDivElement>();
  const latestBig = useCountUp(m.latestValue, 1200, 2);
  return (
    <div ref={ref} className="reveal panel rounded-lg p-5 md:p-6">
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="border-line lg:border-r lg:pr-6">
          <p className="font-mono text-[11px] tracking-[0.22em] text-faint">TOTAL ASSET / 基準値</p>
          <p className="num mt-1 font-display text-4xl font-bold text-ink-50">${latestBig}</p>
          <p className="num mt-1 text-[12px] text-dim">
            最終観測 <span className="text-ink-100">{new Date(m.latest.t).toLocaleString("ja-JP")}</span>
          </p>
          <div className="mt-5">
            <Gauge score={t.score} verdict={t.verdict} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { n: t.bullCount, l: "強気", c: "#2fd48e" },
              { n: t.neutralCount, l: "中立", c: "#9aa7b8" },
              { n: t.bearCount, l: "弱気", c: "#ff6478" },
            ].map((x) => (
              <div key={x.l} className="rounded-sm border border-line bg-ink-800/60 py-2">
                <p className="num font-display text-xl font-bold" style={{ color: x.c }}>{x.n}</p>
                <p className="text-[10px] text-faint">{x.l}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-lg font-bold tracking-wide">
              テクニカル合議<span className="ml-2 font-mono text-[11px] font-normal tracking-[0.2em] text-faint">CONSENSUS — 内訳を全部開示</span>
            </h3>
            <p className="font-mono text-[11px] text-faint">score = 50 + 50 × Σ(vote×w)/Σw</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line font-mono text-[10px] tracking-[0.18em] text-faint">
                  <th className="py-2 pr-3 font-medium">指標</th>
                  <th className="py-2 pr-3 font-medium">現在値</th>
                  <th className="py-2 pr-3 font-medium">判定</th>
                  <th className="py-2 pr-3 font-medium">重み</th>
                  <th className="py-2 font-medium">根拠</th>
                </tr>
              </thead>
              <tbody>
                {t.votes.map((v) => (
                  <tr key={v.indicator} className="group border-b border-line/60 text-[12px] transition-colors duration-200 hover:bg-ink-700/50">
                    <td className="py-2 pr-3 font-bold text-ink-100">{v.indicator}</td>
                    <td className="num py-2 pr-3 text-dim">{v.value}</td>
                    <td className="py-2 pr-3">
                      <span
                        className="rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold"
                        style={
                          v.vote === 1
                            ? { color: "#2fd48e", background: "#2fd48e16", border: "1px solid #2fd48e45" }
                            : v.vote === -1
                            ? { color: "#ff6478", background: "#ff647816", border: "1px solid #ff647845" }
                            : { color: "#9aa7b8", background: "#9aa7b816", border: "1px solid #9aa7b845" }
                        }
                      >
                        {v.vote === 1 ? "強気" : v.vote === -1 ? "弱気" : "中立"}
                      </span>
                    </td>
                    <td className="num py-2 pr-3 text-faint">{v.weight.toFixed(1)}</td>
                    <td className="num py-2 text-dim">{v.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= マルチタイムフレーム ================= */
function TimeframeSection({ results }: { results: { label: string; r: TechResult; bars: Bar[] }[] }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal grid gap-4 md:grid-cols-3">
      {results.map(({ label, r }) => {
        const color = r.score >= 60 ? "#2fd48e" : r.score >= 52 ? "#8fd9b4" : r.score > 48 ? "#9aa7b8" : r.score > 40 ? "#e9b44c" : "#ff6478";
        return (
          <div key={label} className="panel panel-hover rounded-lg p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[11px] tracking-[0.22em] text-faint">{label}</p>
              <p className="num font-display text-2xl font-bold" style={{ color }}>{r.score.toFixed(0)}<span className="ml-1 text-xs text-faint">/100</span></p>
            </div>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-ink-800">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${r.score}%`, background: color }} />
            </div>
            <p className="mb-3 text-[13px] font-bold" style={{ color }}>{r.verdict}</p>
            <div className="num space-y-1 text-[11px] text-dim">
              <p>RSI(14) <span className="float-right text-ink-100">{r.rsiNow.toFixed(1)}</span></p>
              <p>MACD hist <span className="float-right text-ink-100">{r.macd.hist.toFixed(2)}</span></p>
              <p>ADX <span className="float-right text-ink-100">{r.adx.adx.toFixed(1)}</span></p>
              <p>%B <span className="float-right text-ink-100">{r.boll.pctB.toFixed(2)}</span></p>
              <p>強気/弱気/中立 <span className="float-right text-ink-100">{r.bullCount}/{r.bearCount}/{r.neutralCount}</span></p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================= 金融工学パネル ================= */
function EconPanel({ m, bars }: { m: Metrics; bars: Bar[] }) {
  const ref = useReveal<HTMLDivElement>();
  const rs = useMemo(() => logReturns(m.daily.map((d) => d.close)), [m]);
  const res = useMemo(() => {
    const logP = m.daily.map((d) => Math.log(d.close));
    return {
      hurst: hurstExponent(rs),
      adf: adfTest(logP),
      jb: jarqueBera(rs),
      arch: archTest(rs),
      garch: garch11(rs),
      ac: [1, 2, 5, 10, 21].map((lag) => ({ lag, r: autocorr(rs, lag), r2: autocorr(rs.map((x) => x * x), lag) })),
    };
  }, [rs, m]);
  const band = 1.96 / Math.sqrt(rs.length);

  const cards = [
    {
      k: "Hurst 指数（R/S）",
      v: res.hurst.toFixed(3),
      color: res.hurst > 0.55 ? "#2fd48e" : res.hurst < 0.45 ? "#e9b44c" : "#9aa7b8",
      s: res.hurst > 0.55 ? "トレンド持続型" : res.hurst < 0.45 ? "平均回帰型" : "ランダムウォーク近似",
    },
    {
      k: "ADF 検定 t値",
      v: res.adf.t.toFixed(2),
      color: res.adf.verdict === "stationary" ? "#2fd48e" : res.adf.verdict === "borderline" ? "#e9b44c" : "#ff6478",
      s: res.adf.verdict === "stationary" ? `定常（5%臨界値 ${res.adf.crit5} を下回る）` : res.adf.verdict === "borderline" ? "境界域（要注視）" : "単位根あり＝価格水準は非定常（リターンで扱うのが正しい）",
    },
    {
      k: "Jarque-Bera p値",
      v: res.jb.p < 0.001 ? "<0.001" : res.jb.p.toFixed(3),
      color: res.jb.p < 0.05 ? "#e9b44c" : "#2fd48e",
      s: `歪度 ${res.jb.skew.toFixed(2)} / 超過尖度 ${res.jb.kurt.toFixed(2)} — ${res.jb.p < 0.05 ? "正規分布を棄却（ファットテール実在）" : "正規性を棄却できず"}`,
    },
    {
      k: "ARCH-LM p値",
      v: res.arch.p < 0.001 ? "<0.001" : res.arch.p.toFixed(3),
      color: res.arch.hasClustering ? "#e9b44c" : "#2fd48e",
      s: res.arch.hasClustering ? "ボラティリティ・クラスタリングあり（大きな値動きは連鎖する）" : "クラスタリングは検出されず",
    },
    {
      k: "GARCH(1,1) α / β",
      v: `${res.garch.alpha.toFixed(2)} / ${res.garch.beta.toFixed(2)}`,
      color: "#4cc3ff",
      s: `持続性 α+β=${res.garch.persistence.toFixed(3)}、半減期 ${res.garch.halfLife === Infinity ? "∞" : res.garch.halfLife.toFixed(1)} 日、長期均衡ボラ ${res.garch.longRunVolAnnual.toFixed(1)}%/年`,
    },
  ];

  return (
    <div ref={ref} className="reveal panel panel-hover rounded-lg p-5 md:p-6">
      <h3 className="mb-1 font-display text-lg font-bold tracking-wide">
        金融工学診断<span className="ml-2 font-mono text-[11px] font-normal tracking-[0.2em] text-faint">FINANCIAL ENGINEERING DIAGNOSTICS</span>
      </h3>
      <p className="mb-5 text-[12px] text-faint">リターン系列そのものの「性質」を計量する。分布の形・記憶・クラスタリングが、リスク管理の設計を決める。</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((c) => (
          <div key={c.k} className="rounded-sm border border-line bg-ink-800/50 p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-500/40">
            <p className="mb-1 font-mono text-[10px] tracking-[0.16em] text-faint">{c.k}</p>
            <p className="num font-display text-xl font-bold" style={{ color: c.color }}>{c.v}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-dim">{c.s}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 font-mono text-[11px] tracking-[0.2em] text-faint">リターン自己相関（±{band.toFixed(3)} が 95% 有意帯）</p>
          <div className="space-y-1.5">
            {res.ac.map((a) => (
              <div key={a.lag} className="group flex items-center gap-2">
                <span className="num w-12 font-mono text-[11px] text-dim">lag {a.lag}</span>
                <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-ink-800/70">
                  <div className="absolute inset-y-0 w-px bg-gold-500/50" style={{ left: `${50 - (band / 0.3) * 50}%` }} />
                  <div className="absolute inset-y-0 w-px bg-gold-500/50" style={{ left: `${50 + (band / 0.3) * 50}%` }} />
                  <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
                  <div
                    className="absolute inset-y-0.5 rounded-sm transition-all duration-500"
                    style={{
                      left: a.r >= 0 ? "50%" : `${50 - (Math.min(0.3, Math.abs(a.r)) / 0.3) * 50}%`,
                      width: `${(Math.min(0.3, Math.abs(a.r)) / 0.3) * 50}%`,
                      background: Math.abs(a.r) > band ? "#e9b44c" : "#4cc3ff",
                    }}
                  />
                </div>
                <span className="num w-14 text-right text-[11px]" style={{ color: Math.abs(a.r) > band ? "#e9b44c" : "#9aa7b8" }}>{a.r.toFixed(3)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-faint">lag1 が有意なら「昨日の動きが今日を予測する」構造あり。Hurst と併せて読む。</p>
        </div>
        <div>
          <p className="mb-2 font-mono text-[11px] tracking-[0.2em] text-faint">二乗リターン自己相関（ARCH 効果の源泉）</p>
          <div className="space-y-1.5">
            {res.ac.map((a) => (
              <div key={a.lag} className="group flex items-center gap-2">
                <span className="num w-12 font-mono text-[11px] text-dim">lag {a.lag}</span>
                <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-ink-800/70">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
                  <div
                    className="absolute inset-y-0.5 rounded-sm transition-all duration-500"
                    style={{
                      left: a.r2 >= 0 ? "50%" : "0%",
                      width: `${(Math.min(0.3, Math.abs(a.r2)) / 0.3) * 50}%`,
                      background: a.r2 > band ? "#ff6478" : "#9aa7b8",
                    }}
                  />
                </div>
                <span className="num w-14 text-right text-[11px]" style={{ color: a.r2 > band ? "#ff6478" : "#9aa7b8" }}>{a.r2.toFixed(3)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-faint">二乗系列の相関＝「変動の大きさ」が予測可能であること。VaR はこの期間こそ拡大すべき。</p>
        </div>
      </div>
    </div>
  );
}

/* ================= タブ本体 ================= */
export function TerminalView({ m }: { m: Metrics }) {
  const bars = useMemo(() => buildBars(m.records), [m]);
  const techD = useMemo(() => computeTechnicals(bars), [bars]);
  const techW = useMemo(() => computeTechnicals(resample(bars, "W")), [bars]);
  const techM = useMemo(() => computeTechnicals(resample(bars, "M")), [bars]);

  return (
    <div className="mx-auto max-w-[1240px] space-y-8 px-4 pb-16 pt-8 md:px-6">
      <div className="reveal is-in">
        <p className="font-mono text-[11px] tracking-[0.28em] text-gold-300">QAIZ METHODOLOGY APPLIED TO OWN ASSET LOG</p>
        <h2 className="mt-1 font-display text-3xl font-bold leading-tight text-ink-50 md:text-4xl">
          QUANT TERMINAL<span className="ml-3 align-middle font-mono text-xs font-normal tracking-[0.2em] text-faint">
            対象: 総資産ログ {fmtDate(m.start.t)} → {fmtDate(m.latest.t)}（{bars.length} 本の日足に再構築）
          </span>
        </h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-dim">
          一流のアナリストが見る指標を、そのまま自分の資産ログに適用する。合議制テクニカルは内訳を全開示、計量診断は式を公開、
          シグナルはすべて実数根拠つき。欠損は — で表示し、推定値で穴を埋めない。
        </p>
      </div>

      <ConsensusSection m={m} t={techD} />
      <TimeframeSection results={[{ label: "日足 DAILY", r: techD, bars }, { label: "週足 WEEKLY", r: techW, bars }, { label: "月足 MONTHLY", r: techM, bars }]} />
      <EconPanel m={m} bars={bars} />
      <RegimePanel m={m} t={techD} />
      <RotationPanel bars={bars} />
      <AttributionPanel m={m} />
      <SignalFeed m={m} t={techD} />
      <FormulasPanel />
    </div>
  );
}
