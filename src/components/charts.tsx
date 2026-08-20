import { useMemo, useRef, useState } from "react";
import type { LogRecord } from "../data/logs";
import { fmtDate, fmtDateTime, fmtPct, fmtSignedUsd, fmtUsd, fmtUsdCompact, type DailyPoint, type Metrics } from "../lib/metrics";

const DAY = 86_400_000;

/* ================= Sparkline ================= */
export function Sparkline({ records, width = 560, height = 150 }: { records: LogRecord[]; width?: number; height?: number }) {
  const step = Math.max(1, Math.floor(records.length / 240));
  const pts = records.filter((_, i) => i % step === 0 || i === records.length - 1);
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const pad = (max - min) * 0.08 || 1;
  const X = (i: number) => (i / (pts.length - 1)) * width;
  const Y = (v: number) => height - ((v - (min - pad)) / (max - min + pad * 2)) * height;
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join("");
  const area = `${line}L${width},${height}L0,${height}Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block h-full w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e9b44c" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#e9b44c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke="#eebf62" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={X(pts.length - 1)} cy={Y(last.v)} r="4" fill="#f3d08a" className="chart-end-dot" />
    </svg>
  );
}

/* ================= Main chart ================= */
const RANGES = [
  { key: "1M", days: 31 },
  { key: "3M", days: 92 },
  { key: "6M", days: 183 },
  { key: "1Y", days: 365 },
  { key: "ALL", days: Infinity },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const W = 1000;
const H = 340;
const PL = 58;
const PR = 16;
const PT = 16;
const PB = 28;

export function MainChart({ records, daily }: { records: LogRecord[]; daily: DailyPoint[] }) {
  const [range, setRange] = useState<RangeKey>("ALL");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const latestT = records[records.length - 1].t;
  const cutoff = range === "ALL" ? -Infinity : latestT - RANGES.find((r) => r.key === range)!.days * DAY;

  const view = useMemo(() => records.filter((r) => r.t >= cutoff), [records, cutoff]);
  const viewDaily = useMemo(() => daily.filter((d) => d.t >= cutoff), [daily, cutoff]);

  const min = Math.min(...view.map((p) => p.v));
  const max = Math.max(...view.map((p) => p.v));
  const pad = (max - min) * 0.07 || 1;
  const y0 = min - pad;
  const y1 = max + pad;
  const X = (t: number) => PL + ((t - view[0].t) / Math.max(1, latestT - view[0].t)) * (W - PL - PR);
  const Y = (v: number) => PT + (1 - (v - y0) / (y1 - y0)) * (H - PT - PB);

  const line = view.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join("");
  const area = `${line}L${X(latestT).toFixed(1)},${H - PB}L${X(view[0].t).toFixed(1)},${H - PB}Z`;

  const gridVals = [0, 1, 2, 3, 4].map((i) => y0 + ((y1 - y0) * i) / 4);
  const tickIdx = [0, 1, 2, 3, 4, 5].map((i) => Math.round((i / 5) * (view.length - 1)));

  const hoverPt = hover !== null ? view[hover] : null;
  const hoverPrev = hover !== null && hover > 0 ? view[hover - 1] : null;

  // daily P/L bars
  const maxAbsPl = Math.max(...viewDaily.map((d) => Math.abs(d.pl)), 1);
  const barW = Math.max(1.2, ((W - PL - PR) / Math.max(1, viewDaily.length)) * 0.62);
  const BH = 86;
  const mid = BH / 2;

  const onMove = (e: React.MouseEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < view.length; i++) {
      const d = Math.abs(X(view[i].t) - vx);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    setHover(best);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => {
              setRange(r.key);
              setHover(null);
            }}
            className={`rounded-sm border px-3 py-1.5 font-mono text-xs tracking-wider transition-all duration-300 ${
              range === r.key
                ? "border-gold-500 bg-gold-500/15 text-gold-300 shadow-[0_0_18px_rgba(233,180,76,0.18)]"
                : "border-line text-dim hover:border-gold-600/50 hover:text-fog"
            }`}
          >
            {r.key}
          </button>
        ))}
        <span className="ml-auto hidden font-mono text-[11px] text-faint sm:block">
          {view.length.toLocaleString()} snapshots / hoverで詳細
        </span>
      </div>

      <div className="relative">
        <svg
          key={range}
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="chart-in block w-full cursor-crosshair"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label="総資産推移チャート"
        >
          <defs>
            <linearGradient id="mc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e9b44c" stopOpacity="0.3" />
              <stop offset="70%" stopColor="#e9b44c" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#e9b44c" stopOpacity="0" />
            </linearGradient>
          </defs>
          {gridVals.map((gv, i) => (
            <g key={i}>
              <line x1={PL} x2={W - PR} y1={Y(gv)} y2={Y(gv)} stroke="#1d2a3b" strokeDasharray="3 5" strokeWidth="1" />
              <text x={PL - 8} y={Y(gv) + 4} textAnchor="end" fontSize="12" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
                {fmtUsdCompact(gv)}
              </text>
            </g>
          ))}
          {tickIdx.map((ti, i) =>
            view[ti] ? (
              <text key={i} x={X(view[ti].t)} y={H - 8} textAnchor="middle" fontSize="12" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
                {fmtDate(view[ti].t)}
              </text>
            ) : null
          )}
          <path d={area} fill="url(#mc-fill)" />
          <path d={line} fill="none" stroke="#eebf62" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
          <circle cx={X(latestT)} cy={Y(view[view.length - 1].v)} r="5" fill="#f3d08a" className="chart-end-dot" />
          {hoverPt && (
            <g>
              <line x1={X(hoverPt.t)} x2={X(hoverPt.t)} y1={PT} y2={H - PB} stroke="#92a5ba" strokeOpacity="0.5" strokeDasharray="4 4" />
              <circle cx={X(hoverPt.t)} cy={Y(hoverPt.v)} r="5" fill="#0b1017" stroke="#f3d08a" strokeWidth="2.4" />
            </g>
          )}
        </svg>

        {hoverPt && (
          <div
            className="pointer-events-none absolute z-10 min-w-[190px] -translate-x-1/2 rounded-md border border-line bg-ink-850/95 px-3 py-2 shadow-xl backdrop-blur-sm"
            style={{
              left: `${(X(hoverPt.t) / W) * 100}%`,
              top: `${(Y(hoverPt.v) / H) * 100}%`,
              transform: `translate(-50%, ${Y(hoverPt.v) < 90 ? "18px" : "calc(-100% - 14px)"})`,
            }}
          >
            <p className="font-mono text-[11px] text-faint">{fmtDateTime(hoverPt.t)}</p>
            <p className="font-mono text-lg font-semibold text-gold-300 tabular">{fmtUsd(hoverPt.v)}</p>
            {hoverPrev && (
              <p className={`font-mono text-xs tabular ${hoverPt.v - hoverPrev.v >= 0 ? "text-up-400" : "text-down-400"}`}>
                {fmtSignedUsd(hoverPt.v - hoverPrev.v)} / {fmtPct(((hoverPt.v - hoverPrev.v) / hoverPrev.v) * 100)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* daily P/L bars */}
      <div className="mt-2 border-t border-line-soft pt-3">
        <p className="mb-1.5 font-mono text-[11px] tracking-widest text-faint">DAILY P/L（日次損益バー）</p>
        <svg viewBox={`0 0 ${W} ${BH}`} className="block w-full" aria-hidden>
          <line x1={PL} x2={W - PR} y1={mid} y2={mid} stroke="#233247" strokeWidth="1" />
          {viewDaily.map((d, i) => {
            const x = PL + ((d.t - viewDaily[0].t) / Math.max(1, latestT - viewDaily[0].t)) * (W - PL - PR);
            const h = (Math.abs(d.pl) / maxAbsPl) * (BH / 2 - 6);
            return (
              <rect
                key={d.t}
                x={x - barW / 2}
                y={d.pl >= 0 ? mid - h : mid}
                width={barW}
                height={Math.max(1, h)}
                fill={d.pl >= 0 ? "#2ec99a" : "#e14b58"}
                fillOpacity="0.75"
              >
                <title>{`${fmtDate(d.t)}  ${fmtSignedUsd(d.pl)}`}</title>
              </rect>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ================= Drawdown chart ================= */
export function DrawdownChart({ m }: { m: Metrics }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dd = m.drawdown;
  const minDd = Math.min(...dd.map((p) => p.dd)) * 1.25 || -1;
  const X = (t: number) => PL + ((t - dd[0].t) / Math.max(1, dd[dd.length - 1].t - dd[0].t)) * (W - PL - PR);
  // v in [minDd, 0] -> y in [H-PB, PT]
  const Yv = (v: number) => (H - PB) - ((v - minDd) / (0 - minDd)) * (H - PB - PT);

  const line = dd.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.t).toFixed(1)},${Yv(p.dd).toFixed(1)}`).join("");
  const area = `${line}L${X(dd[dd.length - 1].t).toFixed(1)},${Yv(0)}L${X(dd[0].t).toFixed(1)},${Yv(0)}Z`;
  const troughIdx = dd.findIndex((p) => p.t === m.mddTrough.t);
  const hoverPt = hover !== null ? dd[hover] : null;

  const onMove = (e: React.MouseEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < dd.length; i++) {
      const d = Math.abs(X(dd[i].t) - vx);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    setHover(best);
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H - 60}`}
        className="block w-full cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="ドローダウン（水中曲線）チャート"
      >
        <defs>
          <linearGradient id="dd-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e14b58" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#e14b58" stopOpacity="0.34" />
          </linearGradient>
        </defs>
        {[0, -1, -2, -3].map((gv) => (
          <g key={gv}>
            <line x1={PL} x2={W - PR} y1={Yv(gv)} y2={Yv(gv)} stroke="#1d2a3b" strokeDasharray="3 5" />
            <text x={PL - 8} y={Yv(gv) + 4} textAnchor="end" fontSize="12" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
              {gv}%
            </text>
          </g>
        ))}
        <path d={area} fill="url(#dd-fill)" />
        <path d={line} fill="none" stroke="#f0616d" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
        {troughIdx >= 0 && (
          <g>
            <circle cx={X(m.mddTrough.t)} cy={Yv(m.mdd)} r="5" fill="#0b1017" stroke="#f0616d" strokeWidth="2.4" />
            <text x={X(m.mddTrough.t)} y={Yv(m.mdd) + 22} textAnchor="middle" fontSize="13" fill="#f79aa1" fontFamily="IBM Plex Mono, monospace">
              MAX DD {m.mdd.toFixed(2)}%
            </text>
          </g>
        )}
        {hoverPt && (
          <g>
            <line x1={X(hoverPt.t)} x2={X(hoverPt.t)} y1={PT} y2={H - PB} stroke="#92a5ba" strokeOpacity="0.4" strokeDasharray="4 4" />
            <circle cx={X(hoverPt.t)} cy={Yv(hoverPt.dd)} r="4.5" fill="#0b1017" stroke="#f79aa1" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hoverPt && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-line bg-ink-850/95 px-3 py-1.5 shadow-xl"
          style={{ left: `${(X(hoverPt.t) / W) * 100}%`, top: 0 }}
        >
          <p className="font-mono text-[11px] text-faint">{fmtDate(hoverPt.t)}</p>
          <p className="font-mono text-sm font-semibold text-down-300 tabular">{fmtPct(hoverPt.dd)} from peak</p>
        </div>
      )}
    </div>
  );
}

/* ================= Monthly bars ================= */
export function MonthlyBars({ m }: { m: Metrics }) {
  const months = m.months;
  const Wm = 1000;
  const Hm = 300;
  const top = 34;
  const bottom = 34;
  const maxPl = Math.max(...months.map((mo) => Math.abs(mo.pl)), 1);
  const slot = (Wm - 20) / months.length;
  const bw = slot * 0.6;
  const base = top + (Hm - top - bottom) / 2;
  const [hi, setHi] = useState<number | null>(null);

  return (
    <svg viewBox={`0 0 ${Wm} ${Hm}`} className="block w-full" role="img" aria-label="月次損益バーチャート">
      <line x1={10} x2={Wm - 10} y1={base} y2={base} stroke="#233247" strokeWidth="1.2" />
      <text x={Wm - 12} y={base - 6} textAnchor="end" fontSize="11" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
        $0
      </text>
      {months.map((mo, i) => {
        const x = 10 + i * slot + (slot - bw) / 2;
        const h = (Math.abs(mo.pl) / maxPl) * (Hm - top - bottom) * 0.48;
        const up = mo.pl >= 0;
        const active = hi === i;
        return (
          <g key={mo.key} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} className="cursor-pointer">
            <rect x={10 + i * slot} y={top - 20} width={slot} height={Hm - 24} fill="transparent" />
            <rect
              x={x}
              y={up ? base - h : base}
              width={bw}
              height={Math.max(2, h)}
              rx="2"
              fill={up ? "#2ec99a" : "#e14b58"}
              fillOpacity={active ? 1 : 0.72}
              stroke={active ? (up ? "#7fe6c3" : "#f79aa1") : "none"}
              style={{ transition: "fill-opacity .25s" }}
            />
            <text
              x={x + bw / 2}
              y={up ? base - h - 8 : base + h + 16}
              textAnchor="middle"
              fontSize={active ? 14 : 12}
              fontWeight={active ? 700 : 400}
              fill={up ? "#45d8a8" : "#f0616d"}
              fontFamily="IBM Plex Mono, monospace"
            >
              {fmtPct(mo.pct, 1)}
            </text>
            <text
              x={x + bw / 2}
              y={Hm - 12}
              textAnchor="middle"
              fontSize="12"
              fill={active ? "#e8eef5" : "#5d7288"}
              fontFamily="IBM Plex Mono, monospace"
            >
              {mo.label.slice(2).replace("/", "-")}
            </text>
            {mo.partial && (
              <text x={x + bw / 2} y={top - 8} textAnchor="middle" fontSize="10" fill="#e9b44c" fontFamily="IBM Plex Mono, monospace">
                (in progress)
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
