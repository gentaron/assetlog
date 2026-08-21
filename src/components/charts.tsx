import { useMemo, useRef, useState } from "react";
import type { LogRecord } from "../data/logs";
import type { DailyPoint } from "../lib/metrics";
import type { RotationPoint } from "../lib/quant";
import { QUADRANT_COLOR } from "../lib/quant";
import { fmtDate, fmtUsd } from "../lib/metrics";

/* ---------- メイン資産カーブ（クロスヘア＋日次P&Lバー） ---------- */
export function MainChart({ records, daily }: { records: LogRecord[]; daily: DailyPoint[] }) {
  const [range, setRange] = useState<"1M" | "3M" | "6M" | "1Y" | "ALL">("ALL");
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 980;
  const H = 380;
  const PL = 64;
  const PR = 16;
  const PT = 18;
  const PBH = 64; // 下部バー領域
  const PB = 34;

  const view = useMemo(() => {
    const now = records[records.length - 1].t;
    const DAY = 86400000;
    const cut =
      range === "ALL" ? 0 : range === "1Y" ? now - 365 * DAY : range === "6M" ? now - 182 * DAY : range === "3M" ? now - 91 * DAY : now - 30 * DAY;
    return records.filter((r) => r.t >= cut);
  }, [records, range]);

  const viewDaily = useMemo(() => {
    const t0 = view[0]?.t ?? 0;
    return daily.filter((d) => d.t >= t0);
  }, [daily, view]);

  const min = Math.min(...view.map((r) => r.v));
  const max = Math.max(...view.map((r) => r.v));
  const pad = (max - min) * 0.08 || 1;
  const t0 = view[0].t;
  const t1 = view[view.length - 1].t;
  const X = (t: number) => PL + ((t - t0) / Math.max(1, t1 - t0)) * (W - PL - PR);
  const Y = (v: number) => PT + (1 - (v - (min - pad)) / (max - min + 2 * pad)) * (H - PT - PBH - PB);

  const linePath = view.map((r, i) => `${i === 0 ? "M" : "L"}${X(r.t).toFixed(1)},${Y(r.v).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${X(t1).toFixed(1)},${H - PBH - PB} L${X(t0).toFixed(1)},${H - PBH - PB} Z`;

  const maxPl = Math.max(...viewDaily.slice(1).map((d) => Math.abs(d.pl)), 1);
  const barW = Math.max(1.5, ((W - PL - PR) / Math.max(1, viewDaily.length)) * 0.6);

  const onMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    let best = 0;
    let bd = Infinity;
    view.forEach((r, i) => {
      const d = Math.abs(X(r.t) - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover({ i: best, x: px, y: py });
  };

  const h = hover ? view[hover.i] : null;
  const hPrev = hover && hover.i > 0 ? view[hover.i - 1] : null;
  const hDelta = h && hPrev ? h.v - hPrev.v : 0;

  // y 軸目盛
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min - pad + (max - min + 2 * pad) * f);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(["1M", "3M", "6M", "1Y", "ALL"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`min-h-[34px] border px-3 font-mono text-[11px] tracking-wider transition-all duration-200 ${
              range === r
                ? "border-gold-500/60 bg-gold-500/15 text-gold-300"
                : "border-line text-dim hover:border-gold-600/40 hover:text-fog"
            }`}
          >
            {r}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-faint">
          {view.length.toLocaleString()} snapshots
        </span>
      </div>
      <svg
        key={range}
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="chart-in w-full cursor-crosshair select-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="mc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e9b44c" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#e9b44c" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} stroke="#1d2a3b" strokeDasharray="3 5" />
            <text x={PL - 8} y={Y(v) + 4} textAnchor="end" fontSize="10" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
              ${(v / 1000).toFixed(1)}k
            </text>
          </g>
        ))}
        <path d={areaPath} fill="url(#mc-area)" />
        <path d={linePath} fill="none" stroke="#eebf62" strokeWidth="2" strokeLinejoin="round" />
        {/* 日次 P&L バー */}
        {viewDaily.slice(1).map((d) => (
          <rect
            key={d.t}
            x={X(d.t) - barW / 2}
            y={d.pl >= 0 ? H - PB - (Math.abs(d.pl) / maxPl) * (PBH - 12) : H - PB}
            width={barW}
            height={Math.max(1.5, (Math.abs(d.pl) / maxPl) * (PBH - 12))}
            fill={d.pl >= 0 ? "#45d8a8" : "#f0616d"}
            opacity="0.55"
          />
        ))}
        <line x1={PL} x2={W - PR} y1={H - PB} y2={H - PB} stroke="#233247" />
        {h && (
          <g>
            <line x1={X(h.t)} x2={X(h.t)} y1={PT} y2={H - PB} stroke="#62b6de" strokeDasharray="4 4" />
            <circle cx={X(h.t)} cy={Y(h.v)} r="4.5" fill="#eebf62" stroke="#0b1017" strokeWidth="2" />
          </g>
        )}
      </svg>
      <div className="flex h-6 items-center font-mono text-[11px] text-dim">
        {h ? (
          <>
            <span>{fmtDate(h.t)}</span>
            <span className="mx-3 text-fog">${fmtUsd(h.v)}</span>
            <span className={hDelta >= 0 ? "text-up-300" : "text-down-300"}>
              {hDelta >= 0 ? "+" : "−"}${fmtUsd(Math.abs(hDelta))}
            </span>
          </>
        ) : (
          <span className="text-faint">ホバーで任意時点の資産額と直前比を検査</span>
        )}
      </div>
    </div>
  );
}

/* ---------- ドローダウン水中曲線 ---------- */
export function DrawdownChart({ dd }: { dd: { t: number; dd: number }[] }) {
  const W = 980;
  const H = 200;
  const PL = 56;
  const PR = 12;
  const PT = 12;
  const PB = 24;
  const minDd = Math.min(...dd.map((d) => d.dd), -0.5);
  const t0 = dd[0].t;
  const t1 = dd[dd.length - 1].t;
  const X = (t: number) => PL + ((t - t0) / Math.max(1, t1 - t0)) * (W - PL - PR);
  const Yv = (v: number) => (H - PB) - ((v - minDd) / (0 - minDd)) * (H - PB - PT);
  const path = dd.map((d, i) => `${i === 0 ? "M" : "L"}${X(d.t).toFixed(1)},${Yv(d.dd).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 0.5, 1].map((f) => {
        const v = minDd * f;
        return (
          <g key={f}>
            <line x1={PL} x2={W - PR} y1={Yv(v)} y2={Yv(v)} stroke="#1d2a3b" strokeDasharray="3 5" />
            <text x={PL - 8} y={Yv(v) + 4} textAnchor="end" fontSize="10" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
              {v.toFixed(1)}%
            </text>
          </g>
        );
      })}
      <path d={`${path} L${X(t1)},${Yv(0)} L${X(t0)},${Yv(0)} Z`} fill="rgba(240,97,109,0.14)" />
      <path d={path} fill="none" stroke="#f0616d" strokeWidth="1.6" />
    </svg>
  );
}

/* ---------- 月次 P&L バー ---------- */
export function MonthlyBars({ months }: { months: { label: string; pl: number; pct: number; partial?: boolean }[] }) {
  const W = 980;
  const H = 210;
  const PL = 56;
  const PR = 12;
  const PT = 18;
  const PB = 30;
  const maxAbs = Math.max(...months.map((m) => Math.abs(m.pl)), 1);
  const zeroY = PT + (H - PT - PB) / 2;
  const bw = Math.min(40, ((W - PL - PR) / months.length) * 0.62);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line x1={PL} x2={W - PR} y1={zeroY} y2={zeroY} stroke="#233247" />
      <text x={PL - 8} y={zeroY + 4} textAnchor="end" fontSize="10" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
        $0
      </text>
      {months.map((m, i) => {
        const x = PL + (i + 0.5) * ((W - PL - PR) / months.length) - bw / 2;
        const h = (Math.abs(m.pl) / maxAbs) * ((H - PT - PB) / 2 - 6);
        const y = m.pl >= 0 ? zeroY - h : zeroY;
        return (
          <g key={m.label}>
            <rect x={x} y={y} width={bw} height={Math.max(2, h)} fill={m.pl >= 0 ? "#45d8a8" : "#f0616d"} opacity="0.75">
              <title>{`${m.label}: ${m.pl >= 0 ? "+" : "−"}$${fmtUsd(Math.abs(m.pl), 0)} (${m.pct >= 0 ? "+" : ""}${m.pct.toFixed(2)}%)`}</title>
            </rect>
            <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="9" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
              {m.label.slice(2)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- スパークライン ---------- */
export function Sparkline({ points, w = 260, h = 64, stroke = "#eebf62" }: { points: number[]; w?: number; h?: number; stroke?: string }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const X = (i: number) => (i / (points.length - 1)) * (w - 4) + 2;
  const Y = (v: number) => h - 4 - ((v - min) / Math.max(1e-9, max - min)) * (h - 8);
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full">
      <path d={`${path} L${X(points.length - 1)},${h} L${X(0)},${h} Z`} fill={stroke} opacity="0.08" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.8" />
      <circle cx={X(points.length - 1)} cy={Y(points[points.length - 1])} r="3" fill={stroke} />
    </svg>
  );
}

/* ---------- 月次ヒートマップ（年×月） ---------- */
export function Heatmap({ months }: { months: { key: string; pct: number }[] }) {
  const years = [...new Set(months.map((m) => m.key.slice(0, 4)))].sort();
  const maxAbs = Math.max(...months.map((m) => Math.abs(m.pct)), 0.1);
  const cell = (pct: number) => {
    const a = Math.min(1, Math.abs(pct) / maxAbs);
    return pct >= 0 ? `rgba(69,216,168,${0.12 + a * 0.6})` : `rgba(240,97,109,${0.12 + a * 0.6})`;
  };
  return (
    <div className="overflow-x-auto scroll-thin">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[56px_repeat(12,1fr)] gap-1">
          <div />
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="pb-1 text-center font-mono text-[10px] text-faint">
              {i + 1}月
            </div>
          ))}
          {years.map((y) => (
            <HeatRow key={y} year={y} months={months} cell={cell} />
          ))}
        </div>
      </div>
    </div>
  );
}
function HeatRow({ year, months, cell }: { year: string; months: { key: string; pct: number }[]; cell: (p: number) => string }) {
  return (
    <>
      <div className="flex items-center font-mono text-[11px] text-dim">{year}</div>
      {Array.from({ length: 12 }, (_, i) => {
        const key = `${year}-${String(i + 1).padStart(2, "0")}`;
        const m = months.find((x) => x.key === key);
        return (
          <div
            key={key}
            className="flex h-9 items-center justify-center rounded-[2px] font-mono text-[10px] text-fog transition-transform duration-150 hover:scale-110"
            style={{ background: m ? cell(m.pct) : "rgba(29,42,59,0.35)" }}
            title={m ? `${key}: ${m.pct >= 0 ? "+" : ""}${m.pct.toFixed(2)}%` : "—"}
          >
            {m ? `${m.pct >= 0 ? "+" : ""}${m.pct.toFixed(1)}` : "—"}
          </div>
        );
      })}
    </>
  );
}

/* ---------- ローリング系列ライン ---------- */
export function RollingLine({
  values,
  labels,
  color = "#62b6de",
  unit = "",
  baseline,
}: {
  values: (number | null)[];
  labels: string[];
  color?: string;
  unit?: string;
  baseline?: number;
}) {
  const W = 980;
  const H = 190;
  const PL = 52;
  const PR = 12;
  const PT = 14;
  const PB = 26;
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return null;
  const min = Math.min(...nums, baseline ?? Infinity);
  const max = Math.max(...nums, baseline ?? -Infinity);
  const pad = (max - min) * 0.1 || 1;
  const X = (i: number) => PL + (i / (values.length - 1)) * (W - PL - PR);
  const Y = (v: number) => PT + (1 - (v - (min - pad)) / (max - min + 2 * pad)) * (H - PT - PB);
  let path = "";
  values.forEach((v, i) => {
    if (v == null) return;
    path += `${path === "" ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)} `;
  });
  const stride = Math.max(1, Math.floor(values.length / 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {baseline != null && (
        <line x1={PL} x2={W - PR} y1={Y(baseline)} y2={Y(baseline)} stroke="#5d7288" strokeDasharray="4 4" />
      )}
      <path d={path} fill="none" stroke={color} strokeWidth="1.7" />
      {values.map((v, i) =>
        v != null && i % stride === 0 ? (
          <text key={i} x={X(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
            {labels[i]}
          </text>
        ) : null
      )}
      <text x={PL - 6} y={PT + 8} textAnchor="end" fontSize="10" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
        {max.toFixed(1)}
        {unit}
      </text>
      <text x={PL - 6} y={H - PB} textAnchor="end" fontSize="10" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
        {min.toFixed(1)}
        {unit}
      </text>
    </svg>
  );
}

/* ---------- 分布ヒストグラム ---------- */
export function Histogram({ returns, daily }: { returns: number[]; daily: DailyPoint[] }) {
  const W = 980;
  const H = 210;
  const PL = 44;
  const PR = 12;
  const PT = 14;
  const PB = 30;
  const bins = 41;
  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const counts = new Array(bins).fill(0);
  for (const r of returns) counts[Math.min(bins - 1, Math.floor(((r - min) / (max - min)) * bins))]++;
  const maxC = Math.max(...counts, 1);
  const mu = returns.reduce((a, b) => a + b, 0) / returns.length;
  const s = Math.sqrt(returns.reduce((a, b) => a + (b - mu) * (b - mu), 0) / returns.length) || 1e-9;
  const bw = (W - PL - PR) / bins;
  const norm = (x: number) => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
  const scale = (maxC / norm(mu)) * 0.92;
  void daily;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {counts.map((c, i) => {
        const x0 = min + ((max - min) * i) / bins;
        const h = (c / maxC) * (H - PT - PB);
        return (
          <rect
            key={i}
            x={PL + i * bw + 0.5}
            y={H - PB - h}
            width={Math.max(1, bw - 1)}
            height={h}
            fill={x0 >= 0 ? "#45d8a8" : "#f0616d"}
            opacity="0.6"
          >
            <title>{`${(x0 * 100).toFixed(2)}% 〜: ${c}日`}</title>
          </rect>
        );
      })}
      {/* 正規分布フィット */}
      <path
        d={Array.from({ length: 120 }, (_, i) => {
          const x = min + ((max - min) * i) / 119;
          const px = PL + (i / 119) * (W - PL - PR);
          const py = H - PB - norm(x) * scale;
          return `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
        }).join(" ")}
        fill="none"
        stroke="#eebf62"
        strokeDasharray="5 4"
        strokeWidth="1.4"
      />
      <line x1={PL + ((mu - min) / (max - min)) * (W - PL - PR)} x2={PL + ((mu - min) / (max - min)) * (W - PL - PR)} y1={PT} y2={H - PB} stroke="#62b6de" strokeDasharray="3 3" />
      <text x={PL} y={H - 8} fontSize="10" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
        {(min * 100).toFixed(1)}%
      </text>
      <text x={W - PR} y={H - 8} textAnchor="end" fontSize="10" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
        +{(max * 100).toFixed(1)}%
      </text>
      <text x={(PL + W - PR) / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
        μ = {(mu * 100).toFixed(3)}%/日
      </text>
    </svg>
  );
}

/* ---------- モンテカルロ・コーン ---------- */
export function MCChart({
  cone,
  startValue,
}: {
  cone: { t: number; p10: number; p25: number; p50: number; p75: number; p90: number }[];
  startValue: number;
}) {
  const W = 980;
  const H = 260;
  const PL = 64;
  const PR = 12;
  const PT = 14;
  const PB = 28;
  const allVals = cone.flatMap((c) => [c.p10, c.p90]);
  const min = Math.min(...allVals, startValue);
  const max = Math.max(...allVals, startValue);
  const pad = (max - min) * 0.05;
  const X = (t: number) => PL + (t / Math.max(1, cone[cone.length - 1].t)) * (W - PL - PR);
  const Y = (v: number) => PT + (1 - (v - (min - pad)) / (max - min + 2 * pad)) * (H - PT - PB);
  const band = (hi: "p90" | "p75", lo: "p10" | "p25", color: string, op: number) => {
    const fwd = cone.map((c) => `${X(c.t).toFixed(1)},${Y(c[hi]).toFixed(1)}`);
    const back = [...cone].reverse().map((c) => `${X(c.t).toFixed(1)},${Y(c[lo]).toFixed(1)}`);
    return <path d={`M${fwd.join(" L")} L${back.join(" L")} Z`} fill={color} opacity={op} />;
  };
  const line = (key: "p50", color: string) => (
    <path d={cone.map((c, i) => `${i === 0 ? "M" : "L"}${X(c.t).toFixed(1)},${Y(c[key]).toFixed(1)}`).join(" ")} fill="none" stroke={color} strokeWidth="2" />
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 0.5, 1].map((f) => {
        const v = min - pad + (max - min + 2 * pad) * f;
        return (
          <g key={f}>
            <line x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} stroke="#1d2a3b" strokeDasharray="3 5" />
            <text x={PL - 8} y={Y(v) + 4} textAnchor="end" fontSize="10" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
              ${(v / 1000).toFixed(0)}k
            </text>
          </g>
        );
      })}
      <line x1={PL} x2={W - PR} y1={Y(startValue)} y2={Y(startValue)} stroke="#5d7288" strokeDasharray="2 4" />
      {band("p90", "p10", "#62b6de", 0.1)}
      {band("p75", "p25", "#45d8a8", 0.16)}
      {line("p50", "#eebf62")}
      <text x={W - PR} y={Y(cone[cone.length - 1].p90) + 12} textAnchor="end" fontSize="10" fill="#62b6de" fontFamily="IBM Plex Mono, monospace">
        10–90%
      </text>
      <text x={W - PR} y={Y(cone[cone.length - 1].p75) + 12} textAnchor="end" fontSize="10" fill="#45d8a8" fontFamily="IBM Plex Mono, monospace">
        25–75%
      </text>
      <text x={W - PR} y={Y(cone[cone.length - 1].p50) - 6} textAnchor="end" fontSize="10" fill="#eebf62" fontFamily="IBM Plex Mono, monospace">
        中央値 ${(cone[cone.length - 1].p50 / 1000).toFixed(1)}k
      </text>
    </svg>
  );
}

/* ---------- テクニカル・ゲージ ---------- */
export function Gauge({ score }: { score: number }) {
  const ang = -180 + (score / 100) * 180;
  const color = score >= 60 ? "#45d8a8" : score >= 40 ? "#eebf62" : "#f0616d";
  const arcs = [
    { from: -180, to: -120, c: "#f0616d" },
    { from: -120, to: -60, c: "#eebf62" },
    { from: -60, to: 0, c: "#45d8a8" },
  ];
  const arcPath = (a0: number, a1: number) => {
    const r = 78;
    const p = (a: number) => {
      const rad = (a * Math.PI) / 180;
      return `${100 + r * Math.cos(rad)},${96 + r * Math.sin(rad)}`;
    };
    return `M${p(a0)} A${r},${r} 0 0 1 ${p(a1)}`;
  };
  return (
    <svg viewBox="0 0 200 110" className="w-full max-w-[260px]">
      {arcs.map((a, i) => (
        <path key={i} d={arcPath(a.from + 2, a.to - 2)} fill="none" stroke={a.c} strokeWidth="10" strokeLinecap="round" opacity="0.35" />
      ))}
      <g className="gauge-needle" style={{ "--sweep": `${-180 - ang}deg` } as React.CSSProperties}>
        <line x1="100" y1="96" x2="100" y2="30" stroke={color} strokeWidth="3" strokeLinecap="round" transform={`rotate(${ang} 100 96)`} />
      </g>
      <circle cx="100" cy="96" r="6" fill={color} />
      <text x="100" y="80" textAnchor="middle" fontSize="22" fontWeight="700" fill={color} fontFamily="IBM Plex Mono, monospace">
        {score.toFixed(0)}
      </text>
    </svg>
  );
}

/* ---------- RRG ローテーション四象限 ---------- */
export function RRGChart({ rot }: { rot: RotationPoint[] }) {
  const W = 560;
  const H = 400;
  const trail = rot.slice(-60);
  const last6 = rot.slice(-6);
  const xs = trail.map((p) => p.ratio);
  const ys = trail.map((p) => p.momentum);
  const minX = Math.min(...xs, 98);
  const maxX = Math.max(...xs, 102);
  const minY = Math.min(...ys, 98);
  const maxY = Math.max(...ys, 102);
  const X = (v: number) => 60 + ((v - minX) / (maxX - minX)) * (W - 80);
  const Y = (v: number) => H - 46 - ((v - minY) / (maxY - minY)) * (H - 76);
  const path = trail.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.ratio).toFixed(1)},${Y(p.momentum).toFixed(1)}`).join(" ");
  const cur = rot[rot.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <rect x={X(100)} y={Y(maxY)} width={X(maxX) - X(100)} height={Y(100) - Y(maxY)} fill="rgba(69,216,168,0.05)" />
      <rect x={X(minX)} y={Y(100)} width={X(100) - X(minX)} height={Y(minY) - Y(100)} fill="rgba(240,97,109,0.05)" />
      <line x1={X(100)} x2={X(100)} y1={Y(maxY)} y2={Y(minY)} stroke="#233247" />
      <line x1={X(minX)} x2={X(maxX)} y1={Y(100)} y2={Y(100)} stroke="#233247" />
      <text x={X(maxX) - 6} y={Y(maxY) + 16} textAnchor="end" fontSize="10" fill="#45d8a8" fontFamily="IBM Plex Mono, monospace">先行</text>
      <text x={X(maxX) - 6} y={Y(minY) - 8} textAnchor="end" fontSize="10" fill="#eebf62" fontFamily="IBM Plex Mono, monospace">失速</text>
      <text x={X(minX) + 6} y={Y(maxY) + 16} fontSize="10" fill="#62b6de" fontFamily="IBM Plex Mono, monospace">改善</text>
      <text x={X(minX) + 6} y={Y(minY) - 8} fontSize="10" fill="#f0616d" fontFamily="IBM Plex Mono, monospace">劣後</text>
      <path d={path} fill="none" stroke="#62b6de" strokeWidth="1.4" opacity="0.5" />
      {last6.map((p, i) => (
        <circle key={p.t} cx={X(p.ratio)} cy={Y(p.momentum)} r={3 + i} fill={QUADRANT_COLOR[p.quadrant]} opacity={0.35 + (i / 6) * 0.65} />
      ))}
      {cur && (
        <g>
          <circle cx={X(cur.ratio)} cy={Y(cur.momentum)} r="7" fill={QUADRANT_COLOR[cur.quadrant]} stroke="#0b1017" strokeWidth="2" />
          <text x={X(cur.ratio)} y={Y(cur.momentum) - 12} textAnchor="middle" fontSize="10" fill="#e8eef5" fontFamily="IBM Plex Mono, monospace">
            {cur.ratio.toFixed(1)} / {cur.momentum.toFixed(1)}
          </text>
        </g>
      )}
    </svg>
  );
}

/* ---------- ポートフォリオ・ドーナツ ---------- */
export function Donut({
  slices,
  centerTitle,
  centerValue,
}: {
  slices: { label: string; value: number; color: string }[];
  centerTitle: string;
  centerValue: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0);
  const R = 74;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const shown = active != null ? slices[active] : null;
  return (
    <svg viewBox="0 0 200 200" className="mx-auto w-full max-w-[280px]">
      <circle cx="100" cy="100" r={R} fill="none" stroke="#1a2434" strokeWidth="26" />
      {slices.map((s, i) => {
        const frac = s.value / total;
        const dash = frac * C;
        const off = -acc * C;
        acc += frac;
        return (
          <circle
            key={s.label}
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={active === i ? 30 : 24}
            strokeDasharray={`${Math.max(0.5, dash - 1.5)} ${C - dash + 1.5}`}
            strokeDashoffset={off}
            transform="rotate(-90 100 100)"
            opacity={active == null || active === i ? 1 : 0.3}
            className="cursor-pointer transition-all duration-300"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <title>{`${s.label}: $${fmtUsd(s.value, 0)} (${((s.value / total) * 100).toFixed(2)}%)`}</title>
          </circle>
        );
      })}
      <text x="100" y="92" textAnchor="middle" fontSize="10" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
        {shown ? shown.label.slice(0, 18) : centerTitle}
      </text>
      <text x="100" y="114" textAnchor="middle" fontSize="15" fontWeight="700" fill="#e8eef5" fontFamily="IBM Plex Mono, monospace">
        {shown ? `$${fmtUsd(shown.value, 0)}` : centerValue}
      </text>
    </svg>
  );
}
