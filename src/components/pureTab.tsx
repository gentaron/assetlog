import { useMemo, useState } from "react";
import type { Metrics } from "../lib/metrics";
import { computePure, type DepositTiming, type PureResult } from "../lib/pureReturn";
import { SectionHead } from "./sections";
import { useCountUp, useReveal } from "../lib/hooks";

/* ---------- format helpers ---------- */
const usd = (v: number, d = 0) =>
  v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`;
const sgn = (v: number, d = 2) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(d)}%`;

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal panel panel-hover rounded-md ${className}`}>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down" | "gold" | "cy";
}) {
  const c =
    tone === "up"
      ? "text-up-400"
      : tone === "down"
        ? "text-down-400"
        : tone === "cy"
          ? "text-cy-400"
          : tone === "gold"
            ? "text-gold-400"
            : "text-fog";
  return (
    <div className="rounded-sm border border-line bg-ink-800/45 px-4 py-3 transition-colors duration-300 hover:border-gold-600/50">
      <p className="mb-1 font-mono text-[10px] tracking-[0.18em] text-faint">{label}</p>
      <p className={`num text-xl font-semibold leading-tight ${c}`}>{value}</p>
      {sub && <p className="mt-0.5 font-mono text-[10px] text-faint">{sub}</p>}
    </div>
  );
}

/* ---------- controls ---------- */
function Controls({
  cfg,
  setCfg,
  monthlyUSD,
}: {
  cfg: { monthlyMYR: number; usdRate: number; timing: DepositTiming };
  setCfg: (c: { monthlyMYR: number; usdRate: number; timing: DepositTiming }) => void;
  monthlyUSD: number;
}) {
  const ref = useReveal<HTMLDivElement>();
  const timings: { id: DepositTiming; label: string }[] = [
    { id: "start", label: "月初" },
    { id: "mid", label: "月中" },
    { id: "end", label: "月末" },
  ];
  return (
    <div ref={ref} className="reveal panel rounded-md p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="font-mono text-[11px] tracking-[0.22em] text-faint">ASSUMPTIONS ── 積立仮定（給与からの毎月積立）</p>
        <p className="num text-sm font-semibold text-gold-400">≈ ${usd(monthlyUSD, 0)} / 月</p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <div>
          <div className="mb-1.5 flex justify-between font-mono text-[11px] text-dim">
            <span>毎月積立額 (MYR)</span>
            <span className="num text-gold-300">{usd(cfg.monthlyMYR, 0)}</span>
          </div>
          <input
            type="range"
            min={3000}
            max={9000}
            step={100}
            value={cfg.monthlyMYR}
            onChange={(e) => setCfg({ ...cfg, monthlyMYR: Number(e.target.value) })}
            className="slider w-full"
            aria-label="毎月積立額 MYR"
          />
        </div>
        <div>
          <div className="mb-1.5 flex justify-between font-mono text-[11px] text-dim">
            <span>為替レート (MYR/USD)</span>
            <span className="num text-gold-300">{cfg.usdRate.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={4.0}
            max={5.0}
            step={0.05}
            value={cfg.usdRate}
            onChange={(e) => setCfg({ ...cfg, usdRate: Number(e.target.value) })}
            className="slider w-full"
            aria-label="為替レート"
          />
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[11px] text-dim">積立の計上タイミング</div>
          <div className="flex overflow-hidden rounded-sm border border-line">
            {timings.map((t) => (
              <button
                key={t.id}
                onClick={() => setCfg({ ...cfg, timing: t.id })}
                aria-pressed={cfg.timing === t.id}
                className={`min-h-[40px] flex-1 font-mono text-[12px] tracking-wider transition-colors duration-200 ${
                  cfg.timing === t.id
                    ? "bg-gold-500/20 text-gold-300"
                    : "bg-ink-800/40 text-faint hover:bg-ink-700 hover:text-dim"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-4 font-mono text-[10px] leading-relaxed text-faint">
        仮定: 給与積立は毎月一定額を外部キャッシュフローとして計上し、修正ディーツ法（ウェイト 0.5）で日次リターンから除去。
        ログは 2025-04 中旬開始のため積立は翌月分から計上。スライダーを動かすと全指標が即時再計算されます。
      </p>
    </div>
  );
}

/* ---------- waterfall decomposition ---------- */
function Waterfall({ p }: { p: PureResult }) {
  const W = 560;
  const H = 300;
  const PL = 12;
  const PR = 12;
  const PT = 34;
  const PB = 40;
  const maxV = p.finalActual * 1.02;
  const Y = (v: number) => H - PB - (v / maxV) * (H - PT - PB);
  const inner = W - PL - PR;
  const n = 4;
  const gap = inner * 0.12;
  const bw = (inner - gap * (n - 1)) / n;
  const x = (i: number) => PL + i * (bw + gap);

  const premSign = p.premium >= 0 ? "+" : "−";
  const bars = [
    { label: "開始時資産", from: 0, to: p.startValue, color: "#3f9cc9", delta: `$${usd(p.startValue)}` },
    { label: "積立累計", from: p.startValue, to: p.finalBase, color: "#62b6de", delta: `+$${usd(p.totalDeposits)}` },
    {
      label: "投資付加価値",
      from: p.finalBase,
      to: p.finalActual,
      color: p.premium >= 0 ? "#45d8a8" : "#f0616d",
      delta: `${premSign}$${usd(Math.abs(p.premium))}`,
    },
    { label: "最終資産", from: 0, to: p.finalActual, color: "#eebf62", delta: `$${usd(p.finalActual)}` },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="資産分解ウォーターフォール">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={PL} x2={W - PR} y1={Y(maxV * f)} y2={Y(maxV * f)} stroke="#1d2a3b" strokeDasharray="3 4" strokeWidth="1" />
          <text x={W - PR} y={Y(maxV * f) - 4} textAnchor="end" fontSize="9" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
            ${usd(maxV * f / 1000, 0)}k
          </text>
        </g>
      ))}
      {bars.map((b, i) => {
        const y1 = Y(Math.max(b.from, b.to));
        const y2 = Y(Math.min(b.from, b.to));
        return (
          <g key={b.label}>
            {i > 0 && i < n - 1 && (
              <line x1={x(i - 1) + bw} x2={x(i)} y1={Y(bars[i - 1].to)} y2={Y(bars[i - 1].to)} stroke="#5d7288" strokeDasharray="3 3" strokeWidth="1" />
            )}
            {i === n - 1 && (
              <line x1={x(i - 1) + bw} x2={x(i)} y1={Y(bars[i - 1].to)} y2={Y(bars[i - 1].to)} stroke="#5d7288" strokeDasharray="3 3" strokeWidth="1" />
            )}
            <rect x={x(i)} y={y1} width={bw} height={Math.max(2, y2 - y1)} fill={b.color} opacity={0.85} rx="2" />
            <rect x={x(i)} y={y1} width={bw} height={Math.max(2, y2 - y1)} fill="none" stroke={b.color} rx="2" />
            <text x={x(i) + bw / 2} y={y1 - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill={b.color} fontFamily="IBM Plex Mono, monospace">
              {b.delta}
            </text>
            <text x={x(i) + bw / 2} y={H - PB + 16} textAnchor="middle" fontSize="10" fill="#92a5ba" fontFamily="Noto Sans JP, sans-serif">
              {b.label}
            </text>
          </g>
        );
      })}
      <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke="#233247" strokeWidth="1.5" />
    </svg>
  );
}

function DecompositionHero({ p }: { p: PureResult }) {
  const nominal = p.finalActual / p.startValue - 1;
  const nom = useCountUp(nominal * 100, 1400, 1);
  const twr = useCountUp(p.twrTotal * 100, 1400, 1);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
      <Panel className="p-5 md:p-6">
        <p className="mb-3 font-mono text-[11px] tracking-[0.22em] text-faint">DECOMPOSITION ── 資産増加の正体</p>
        <Waterfall p={p} />
      </Panel>
      <Panel className="flex flex-col justify-between p-5 md:p-6">
        <div>
          <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-faint">VERDICT ── 評価の分離</p>
          <div className="space-y-4">
            <div className="flex items-end justify-between border-b border-line-soft pb-3">
              <div>
                <p className="font-mono text-[11px] tracking-wider text-faint">名目総リターン（積立込み）</p>
                <p className="mt-0.5 font-mono text-[11px] text-faint">+${usd(p.finalActual - p.startValue)} の増加</p>
              </div>
              <p className="num text-3xl font-bold text-cy-400">+{nom}%</p>
            </div>
            <div className="flex items-end justify-between border-b border-line-soft pb-3">
              <div>
                <p className="font-mono text-[11px] tracking-wider text-faint">純投資リターン（TWR・積立除外）</p>
                <p className="mt-0.5 font-mono text-[11px] text-faint">年率 {sgn(p.twrAnnual, 1)}</p>
              </div>
              <p className="num text-3xl font-bold text-up-400">+{twr}%</p>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="font-mono text-[11px] tracking-wider text-faint">増加額に占める積立の割合</p>
                <p className="mt-0.5 font-mono text-[11px] text-faint">積立累計 ${usd(p.totalDeposits)}</p>
              </div>
              <p className="num text-3xl font-bold text-gold-400">{pct(p.depositShare, 0)}</p>
            </div>
          </div>
        </div>
        <p className="mt-5 rounded-sm border-l-2 border-gold-500 bg-ink-800/50 p-3 text-[13px] leading-relaxed text-dim">
          名目では <span className="num font-semibold text-cy-400">+{nom}%</span> ですが、給与積立
          <span className="num font-semibold text-gold-300"> ${usd(p.totalDeposits)}</span> を差し引いた
          <span className="font-semibold text-fog">純粋な運用リターンは {sgn(p.twrTotal, 1)}</span>（年率 {sgn(p.twrAnnual, 1)}）。
          増加額の <span className="num font-semibold text-gold-300">{pct(p.depositShare, 0)}</span> は積立によるものです。
        </p>
      </Panel>
    </div>
  );
}

/* ---------- gap chart: actual vs savings-only ---------- */
function GapChart({ p }: { p: PureResult }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 900;
  const H = 340;
  const PL = 62;
  const PR = 18;
  const PT = 24;
  const PB = 34;
  const pts = p.points;
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const maxV = Math.max(p.finalActual, p.finalBase) * 1.03;
  const X = (t: number) => PL + ((t - t0) / (t1 - t0)) * (W - PL - PR);
  const Y = (v: number) => H - PB - (v / maxV) * (H - PT - PB);

  const actualPath = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${X(pt.t).toFixed(1)},${Y(pt.actual).toFixed(1)}`).join("");
  const basePath = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${X(pt.t).toFixed(1)},${Y(pt.base).toFixed(1)}`).join("");
  const areaPath =
    actualPath +
    [...pts].reverse().map((pt) => `L${X(pt.t).toFixed(1)},${Y(pt.base).toFixed(1)}`).join("") +
    "Z";

  const hi = hover !== null ? pts[Math.min(hover, pts.length - 1)] : null;

  return (
    <Panel className="p-5 md:p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] tracking-[0.22em] text-faint">GAP ── 実測資産 vs 貯金のみベースライン（間の領域 = 投資付加価値）</p>
        <div className="flex items-center gap-4 font-mono text-[11px] text-dim">
          <span className="flex items-center gap-1.5"><i className="h-[2px] w-5 bg-gold-400" />実測</span>
          <span className="flex items-center gap-1.5"><i className="h-[2px] w-5 border-t-2 border-dashed border-cy-400" />貯金のみ</span>
          <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-[2px] bg-up-500/30" />付加価値</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const fx = ((e.clientX - rect.left) / rect.width) * W;
          const t = t0 + ((fx - PL) / (W - PL - PR)) * (t1 - t0);
          let best = 0;
          let bd = Infinity;
          pts.forEach((pt, i) => {
            const d = Math.abs(pt.t - t);
            if (d < bd) {
              bd = d;
              best = i;
            }
          });
          setHover(best);
        }}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="実測資産と貯金のみベースラインの比較"
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={PL} x2={W - PR} y1={Y(maxV * f)} y2={Y(maxV * f)} stroke="#1d2a3b" strokeDasharray="3 4" />
            <text x={PL - 8} y={Y(maxV * f) + 3} textAnchor="end" fontSize="10" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
              ${usd(maxV * f / 1000, 0)}k
            </text>
          </g>
        ))}
        <path d={areaPath} fill="rgba(46,201,154,0.16)" />
        <path d={basePath} fill="none" stroke="#62b6de" strokeWidth="1.6" strokeDasharray="6 5" />
        <path d={actualPath} fill="none" stroke="#eebf62" strokeWidth="2.2" />
        {pts
          .filter((pt) => pt.deposit > 0)
          .map((pt) => (
            <circle key={pt.t} cx={X(pt.t)} cy={Y(pt.base)} r="3.4" fill="#62b6de" stroke="#0b1017" strokeWidth="1.5" />
          ))}
        {hi && (
          <g>
            <line x1={X(hi.t)} x2={X(hi.t)} y1={PT} y2={H - PB} stroke="#92a5ba" strokeDasharray="3 3" strokeWidth="1" />
            <circle cx={X(hi.t)} cy={Y(hi.actual)} r="4.5" fill="#eebf62" stroke="#0b1017" strokeWidth="1.5" />
            <circle cx={X(hi.t)} cy={Y(hi.base)} r="4" fill="#62b6de" stroke="#0b1017" strokeWidth="1.5" />
            <g transform={`translate(${Math.min(X(hi.t) + 12, W - 190)}, ${PT + 6})`}>
              <rect width="178" height="64" rx="4" fill="rgba(11,16,23,0.92)" stroke="#233247" />
              <text x="10" y="16" fontSize="10" fill="#92a5ba" fontFamily="IBM Plex Mono, monospace">
                {new Date(hi.t).toLocaleDateString("ja-JP")}
              </text>
              <text x="10" y="32" fontSize="11" fill="#eebf62" fontFamily="IBM Plex Mono, monospace">
                実測 ${usd(hi.actual)}
              </text>
              <text x="10" y="46" fontSize="11" fill="#62b6de" fontFamily="IBM Plex Mono, monospace">
                貯金のみ ${usd(hi.base)}
              </text>
              <text x="10" y="59" fontSize="11" fill={hi.actual - hi.base >= 0 ? "#45d8a8" : "#f0616d"} fontFamily="IBM Plex Mono, monospace">
                付加価値 {hi.actual - hi.base >= 0 ? "+" : "−"}${usd(Math.abs(hi.actual - hi.base))}
              </text>
            </g>
          </g>
        )}
        <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke="#233247" strokeWidth="1.5" />
      </svg>
    </Panel>
  );
}

/* ---------- pure growth chart (indexed) ---------- */
function PureGrowthChart({ p }: { p: PureResult }) {
  const W = 900;
  const H = 260;
  const PL = 50;
  const PR = 18;
  const PT = 20;
  const PB = 30;
  const pts = p.points;
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const vals = pts.map((pt) => pt.pure / p.startValue);
  const minV = Math.min(0.97, ...vals);
  const maxV = Math.max(1.02, ...vals);
  const X = (t: number) => PL + ((t - t0) / (t1 - t0)) * (W - PL - PR);
  const Y = (v: number) => H - PB - ((v - minV) / (maxV - minV)) * (H - PT - PB);

  const line = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${X(pt.t).toFixed(1)},${Y(pt.pure / p.startValue).toFixed(1)}`).join("");
  const area =
    pts.map((pt, i) => `${i === 0 ? "M" : "L"}${X(pt.t).toFixed(1)},${Y(pt.pure / p.startValue).toFixed(1)}`).join("") +
    `L${X(t1).toFixed(1)},${Y(1).toFixed(1)}L${X(t0).toFixed(1)},${Y(1).toFixed(1)}Z`;

  return (
    <Panel className="p-5 md:p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] tracking-[0.22em] text-faint">PURE GROWTH ── 純投資 NAV（元本=100、積立除外・運用のみ）</p>
        <p className="font-mono text-[11px] text-up-400">
          累積 {sgn(p.twrTotal, 1)} ／ 年率 {sgn(p.twrAnnual, 1)}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="純投資の成長カーブ">
        {[minV + ((maxV - minV) * 1) / 3, minV + ((maxV - minV) * 2) / 3, maxV].map((v) => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} stroke="#1d2a3b" strokeDasharray="3 4" />
            <text x={PL - 8} y={Y(v) + 3} textAnchor="end" fontSize="10" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
              {(v * 100).toFixed(0)}
            </text>
          </g>
        ))}
        <line x1={PL} x2={W - PR} y1={Y(1)} y2={Y(1)} stroke="#62b6de" strokeDasharray="5 4" strokeWidth="1.2" />
        <text x={W - PR} y={Y(1) - 5} textAnchor="end" fontSize="10" fill="#62b6de" fontFamily="IBM Plex Mono, monospace">
          元本 100（運用リターン 0）
        </text>
        <path d={area} fill="rgba(69,216,168,0.12)" />
        <path d={line} fill="none" stroke="#45d8a8" strokeWidth="2.2" />
        <circle cx={X(t1)} cy={Y(vals[vals.length - 1])} r="4.5" fill="#45d8a8" stroke="#0b1017" strokeWidth="1.5" />
        <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke="#233247" strokeWidth="1.5" />
      </svg>
    </Panel>
  );
}

/* ---------- metrics grid ---------- */
function PureMetricsGrid({ p }: { p: PureResult }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      <Metric label="純投資総リターン (TWR)" value={sgn(p.twrTotal, 2)} sub="積立を外部CFとして除外" tone="up" />
      <Metric label="純投資年率リターン" value={sgn(p.twrAnnual, 2)} sub={`${p.years.toFixed(2)} 年間で年化`} tone="up" />
      <Metric label="マネーウェイト (IRR)" value={isNaN(p.irr) ? "—" : sgn(p.irr, 2)} sub="積立タイミングを加味した実感リターン" tone="gold" />
      <Metric
        label="投資付加価値"
        value={`${p.premium >= 0 ? "+" : "−"}$${usd(Math.abs(p.premium))}`}
        sub="実測 - 貯金のみベースライン"
        tone={p.premium >= 0 ? "up" : "down"}
      />
      <Metric label="付加価値率（対貯金）" value={sgn(p.premiumPct, 2)} sub="貯金だけの場合比" tone="up" />
      <Metric label="積立累計" value={`$${usd(p.totalDeposits)}`} sub={`RM ${usd(p.totalDepositsMYR)} ／ ${p.nDeposits} 回`} tone="cy" />
      <Metric label="増加額に占める積立比率" value={pct(p.depositShare, 1)} sub="名目増加 ${usd(p.finalActual - p.startValue)} の内訳" tone="gold" />
      <Metric label="月平均積立" value={`$${usd(p.monthlyUSD)}`} sub={`RM ${usd(p.cfg.monthlyMYR)} @ ${p.cfg.usdRate.toFixed(2)}`} tone="cy" />
      <Metric label="純投資ボラティリティ（年率）" value={pct(p.volAnnual, 1)} sub="積立調整済み日次リターン" />
      <Metric label="純投資シャープレシオ" value={p.sharpePure.toFixed(2)} sub="rf=0 近似" />
      <Metric label="純投資最大ドローダウン" value={pct(p.maxDDPure, 2)} sub="元本のみの水中率" tone="down" />
      <Metric label="上昇 / 下落日数" value={`${p.upDays} / ${p.downDays}`} sub={`勝率 ${((p.upDays / Math.max(1, p.upDays + p.downDays)) * 100).toFixed(0)}%`} />
    </div>
  );
}

/* ---------- yearly table ---------- */
function YearlyTable({ p }: { p: PureResult }) {
  return (
    <Panel className="overflow-hidden">
      <p className="border-b border-line px-5 py-4 font-mono text-[11px] tracking-[0.22em] text-faint">YEARLY ── 年次分解（実測 vs 純投資）</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="border-b border-line font-mono text-[10px] tracking-wider text-faint">
              <th className="px-5 py-3">年</th>
              <th className="px-3 py-3 text-right">積立 ($)</th>
              <th className="px-3 py-3 text-right">回数</th>
              <th className="px-3 py-3 text-right">期首</th>
              <th className="px-3 py-3 text-right">期末</th>
              <th className="px-3 py-3 text-right">実測増減</th>
              <th className="px-3 py-3 text-right">実測増減率</th>
              <th className="px-5 py-3 text-right">純投資リターン</th>
            </tr>
          </thead>
          <tbody className="num text-[13px]">
            {p.yearly.map((y) => (
              <tr key={y.year} className="border-b border-line-soft transition-colors duration-200 hover:bg-ink-800/50">
                <td className="px-5 py-3 font-semibold text-fog">
                  {y.year}
                  {y.partial && <span className="ml-2 rounded-[2px] border border-gold-600/50 px-1.5 py-0.5 font-mono text-[9px] text-gold-400">期間途中</span>}
                </td>
                <td className="px-3 py-3 text-right text-cy-400">${usd(y.depositsUSD)}</td>
                <td className="px-3 py-3 text-right text-dim">{y.nDeposits}</td>
                <td className="px-3 py-3 text-right text-dim">${usd(y.startVal)}</td>
                <td className="px-3 py-3 text-right text-fog">${usd(y.endVal)}</td>
                <td className={`px-3 py-3 text-right ${y.actualGain >= 0 ? "text-up-400" : "text-down-400"}`}>
                  {y.actualGain >= 0 ? "+" : ""}${usd(y.actualGain)}
                </td>
                <td className={`px-3 py-3 text-right ${y.actualGainPct >= 0 ? "text-up-400" : "text-down-400"}`}>{sgn(y.actualGainPct, 1)}</td>
                <td className={`px-5 py-3 text-right font-semibold ${y.twr >= 0 ? "text-up-400" : "text-down-400"}`}>{sgn(y.twr, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ---------- insights ---------- */
function Insights({ p }: { p: PureResult }) {
  const nominal = p.finalActual / p.startValue - 1;
  const lines = [
    {
      head: "増加の正体",
      body: `名目リターン ${sgn(nominal, 1)} のうち、積立累計 ${pct(p.depositShare, 0)}（$${usd(p.totalDeposits)}）が寄与。純粋な運用リターンは ${sgn(p.twrTotal, 1)}（年率 ${sgn(p.twrAnnual, 1)}）で、増加を主導したのは「貯蓄量」であり「運用率」ではありません。`,
    },
    {
      head: "運用の実力",
      body: `積立を差し引いた元本 $${usd(p.startValue)} は ${sgn(p.twrTotal, 1)} で運用されました。もし全額を無運用で貯めただけなら最終 ${usd(p.finalBase)} ドル。運用が ${usd(p.premium)} ドル（${sgn(p.premiumPct, 1)}）を付加しています。`,
    },
    {
      head: "リスクの水準",
      body: `純投資ベースの年率ボラティリティは ${pct(p.volAnnual, 1)}、最大ドローダウンは ${pct(p.maxDDPure, 2)}。シャープレシオ ${p.sharpePure.toFixed(2)} は、積立による「ドルコスト平準化」を含まない、運用そのもののリスク調整後効率です。`,
    },
    {
      head: "実感との照合",
      body: `マネーウェイト（IRR）は ${isNaN(p.irr) ? "—" : sgn(p.irr, 1)}。TWR との差は、積立の投入タイミングがリターンに与えた効果です。毎月一定額の積立は高値づかみを分散させるため、一般的に IRR は TWR を下回りやすい傾向があります。`,
    },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {lines.map((l) => (
        <InsightCard key={l.head} head={l.head} body={l.body} />
      ))}
    </div>
  );
}

function InsightCard({ head, body }: { head: string; body: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal rounded-md border border-line bg-ink-800/40 p-4 transition-colors duration-300 hover:border-gold-600/40">
      <p className="mb-1.5 font-mono text-[10px] tracking-[0.2em] text-gold-400">INSIGHT ── {head}</p>
      <p className="text-[13px] leading-relaxed text-dim">{body}</p>
    </div>
  );
}

/* ---------- tab root ---------- */
export function PureTab({ m }: { m: Metrics }) {
  const [cfg, setCfg] = useState<{ monthlyMYR: number; usdRate: number; timing: DepositTiming }>({
    monthlyMYR: 5500,
    usdRate: 4.5,
    timing: "start",
  });

  const p = useMemo(() => computePure(m.daily, m.startValue, cfg), [m, cfg]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-20 md:px-6">
      <div className="pt-10">
        <SectionHead
          no="P"
          en="PURE INVESTMENT RETURN"
          jp="純投資パフォーマンス評価"
          desc="給与からの毎月積立（外部キャッシュフロー）を修正ディーツ法で除去し、運用リターンだけを TWR ベースで評価します。積立額・為替・計上タイミングは調整可能。"
        />
      </div>

      <div className="space-y-6 pt-6">
        <Controls cfg={cfg} setCfg={setCfg} monthlyUSD={p.monthlyUSD} />
        <DecompositionHero p={p} />
        <GapChart p={p} />
        <PureGrowthChart p={p} />
        <PureMetricsGrid p={p} />
        <YearlyTable p={p} />
        <Insights p={p} />
        <p className="pt-2 font-mono text-[10px] leading-relaxed text-faint">
          方法論: 積立は修正ディーツ法（ウェイト 0.5）で日次リターンから除去し、元本のみを複利した NAV を TWR として再構築。
          「貯金のみベースライン」は元本 + 積立累計を運用リターン 0 で積み上げたものです。積立額・為替レートは推定値であり、
          実際の値と異なる場合はスライダーで修正してください。本評価は投資助言ではありません。
        </p>
      </div>
    </div>
  );
}
