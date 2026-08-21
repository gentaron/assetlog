import { useMemo, useState } from "react";
import type { Metrics } from "../lib/metrics";
import { computeQuant, monthlyReturns, yearlyReturns, rollingMetrics, drawdownEpisodes, returnsHistogram, normalPdf, monteCarlo } from "../lib/quant";
import { useReveal } from "../lib/hooks";

const usd = (v: number, dp = 0) => v.toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: dp });
const pctf = (v: number, dp = 2) => `${(v * 100).toFixed(dp)}%`;
const fmtD = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
const MON = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

function heatColor(r: number): string {
  if (r > 0) return `rgba(74,222,156,${Math.min(0.92, 0.12 + (r / 0.06) * 0.8)})`;
  if (r < 0) return `rgba(240,86,79,${Math.min(0.92, 0.12 + (-r / 0.04) * 0.8)})`;
  return "rgba(157,176,192,.12)";
}

/* ================= 08 TEAR SHEET ================= */
export function TearSheet({ m }: { m: Metrics }) {
  const ref = useReveal<HTMLDivElement>();
  const q = useMemo(() => computeQuant(m.daily, m.mdd), [m]);
  const monthly = useMemo(() => monthlyReturns(m.daily), [m]);
  const yearly = useMemo(() => yearlyReturns(m.daily), [m]);

  const groups: { title: string; color: string; items: { k: string; v: string; note?: string }[] }[] = [
    {
      title: "リターン",
      color: "#4ade9c",
      items: [
        { k: "総リターン", v: pctf(q.totalReturn) },
        { k: "CAGR（年率複利）", v: pctf(q.cagr) },
        { k: "ベスト・デイ", v: `+${pctf(q.bestDay)}`, note: "" },
        { k: "ワースト・デイ", v: pctf(q.worstDay) },
        { k: "ベスト・マンス", v: `+${pctf(q.bestMonth)}` },
        { k: "ワースト・マンス", v: pctf(q.worstMonth) },
        { k: "平均月次リターン", v: `+${pctf(q.avgMonthly)}` },
        { k: "プラス月比率", v: pctf(q.upMonthRate, 0) },
      ],
    },
    {
      title: "リスク",
      color: "#f0564f",
      items: [
        { k: "年率ボラティリティ", v: pctf(q.annVol) },
        { k: "ダウンサイド偏差", v: pctf(q.downsideDev) },
        { k: "最大ドローダウン", v: pctf(-q.maxDD) },
        { k: "VaR 95%（日次）", v: `-${pctf(q.var95)}` },
        { k: "CVaR 95%（期待 shortfall）", v: `-${pctf(q.cvar95)}` },
        { k: "VaR 99%（日次）", v: `-${pctf(q.var99)}` },
        { k: "CVaR 99%", v: `-${pctf(q.cvar99)}` },
        { k: "歪度（スキュー）", v: q.skew.toFixed(2) },
        { k: "超過尖度（クルトシス）", v: q.kurtosis.toFixed(2) },
        { k: "テールレシオ", v: q.tailRatio.toFixed(2) },
      ],
    },
    {
      title: "リスク調整後効率",
      color: "#e9b44c",
      items: [
        { k: "シャープレシオ", v: q.sharpe.toFixed(2), note: "無リスク金利 0 基準" },
        { k: "ソルティノレシオ", v: q.sortino.toFixed(2) },
        { k: "カルマーレシオ", v: q.calmar.toFixed(2) },
        { k: "Ulcer 指数", v: q.ulcer.toFixed(2) },
        { k: "リカバリーファクター", v: q.recoveryFactor.toFixed(1) },
        { k: "ケリー基準（最適投下比率）", v: pctf(q.kelly, 1) },
        { k: "日次期待値", v: `+${pctf(q.expectancy, 3)}` },
      ],
    },
    {
      title: "トレード統計",
      color: "#5ca9ff",
      items: [
        { k: "勝率（日次）", v: pctf(q.winRate, 1) },
        { k: "ペイオフレシオ", v: q.payoff.toFixed(2) },
        { k: "プロフィットファクター", v: q.profitFactor.toFixed(2) },
        { k: "平均利益日", v: `+${pctf(q.avgWin, 3)}` },
        { k: "平均損失日", v: `-${pctf(q.avgLoss, 3)}` },
        { k: "異常上昇日（+3σ超）", v: `${q.outlierWinDays} 日` },
        { k: "異常下落日（-3σ超）", v: `${q.outlierLossDays} 日` },
      ],
    },
  ];

  const years = [...new Set(monthly.map((c) => c.y))];

  return (
    <div ref={ref} className="reveal space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {groups.map((g) => (
          <div key={g.title} className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[#1d2b3a] px-4 py-2.5">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: g.color }} />
              <h3 className="font-display text-xs font-bold tracking-[0.16em] text-[#e8f1f5]">{g.title}</h3>
            </div>
            <dl>
              {g.items.map((it) => (
                <div key={it.k} className="flex items-baseline justify-between gap-2 border-b border-[#141f2b] px-4 py-1.5 last:border-0">
                  <dt className="text-[11px] text-[#9db2c0]">
                    {it.k}
                    {it.note && <span className="block text-[9px] text-[#61788a]">{it.note}</span>}
                  </dt>
                  <dd className="num shrink-0 text-xs font-semibold text-[#e8f1f5]">{it.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {/* 月次リターンヒートマップ */}
      <div className="panel p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-sm font-bold tracking-[0.12em] text-[#e8f1f5]">月次リターン・ヒートマップ</h3>
          <span className="text-[10px] text-[#7d93a3]">前月末比 ・ 緑=プラス 赤=マイナス</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-[3px]">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold tracking-widest text-[#8aa0ae]">年</th>
                {MON.map((mo) => (
                  <th key={mo} className="text-center text-[10px] font-bold text-[#8aa0ae]">
                    {mo}
                  </th>
                ))}
                <th className="text-center text-[10px] font-bold text-[#e9b44c]">年間</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => {
                const yr = yearly.find((x) => x.y === y);
                return (
                  <tr key={y}>
                    <td className="num pr-2 text-right text-xs font-semibold text-[#c8d6df]">{y}</td>
                    {MON.map((_, mi) => {
                      const cell = monthly.find((c) => c.y === y && c.m === mi);
                      if (!cell) return <td key={mi} className="h-9 rounded-[3px] bg-[#101a24]" />;
                      return (
                        <td
                          key={mi}
                          className="num h-9 rounded-[3px] text-center text-[10px] font-semibold text-[#0a1017] transition-transform hover:scale-105"
                          style={{ background: heatColor(cell.ret), color: Math.abs(cell.ret) < 0.004 ? "#9db2c0" : "#0a1017" }}
                          title={`${y}年${mi + 1}月: ${(cell.ret * 100).toFixed(2)}%${cell.partial ? "（進行中）" : ""}`}
                        >
                          {(cell.ret * 100).toFixed(1)}
                          {cell.partial && <span className="text-[7px]">*</span>}
                        </td>
                      );
                    })}
                    <td
                      className="num h-9 rounded-[3px] text-center text-[10px] font-bold"
                      style={{ background: yr ? heatColor(yr.ret) : "#101a24", color: "#0a1017" }}
                    >
                      {yr ? `${(yr.ret * 100).toFixed(1)}${yr.partial ? "*" : ""}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 年次リターン */}
      <div className="panel p-5">
        <h3 className="mb-4 font-display text-sm font-bold tracking-[0.12em] text-[#e8f1f5]">年次リターン</h3>
        <div className="flex items-end gap-6 px-2" style={{ height: 150 }}>
          {yearly.map((yr) => {
            const hPct = Math.max(4, Math.abs(yr.ret) * 100 * 2.2);
            return (
              <div key={yr.y} className="group flex flex-1 flex-col items-center gap-1.5">
                <span className="num text-xs font-semibold text-[#4ade9c] transition-colors group-hover:text-[#7ef0c0]">+{(yr.ret * 100).toFixed(1)}%</span>
                <div className="flex w-full max-w-[120px] items-end" style={{ height: 96 }}>
                  <div
                    className="w-full rounded-t-sm transition-all duration-300 group-hover:brightness-125"
                    style={{ height: `${hPct}%`, background: yr.partial ? "linear-gradient(180deg,#e9b44c,#8a6a2b)" : "linear-gradient(180deg,#4ade9c,#1d6b4c)" }}
                  />
                </div>
                <span className="num text-[11px] text-[#9db2c0]">{yr.y}{yr.partial && <span className="text-[#e9b44c]"> YTD</span>}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ================= 09 RISK LAB ================= */
function MiniLineChart({ data, label, color, fmt, fill }: { data: { t: number; v: number | null }[]; label: string; color: string; fmt: (v: number) => string; fill?: boolean }) {
  const [hov, setHov] = useState<{ x: number; v: number } | null>(null);
  const W = 560;
  const H = 180;
  const PL = 46;
  const PR = 10;
  const PT = 14;
  const PB = 22;
  const vals = data.filter((d) => d.v !== null).map((d) => d.v as number);
  let lo = Math.min(...vals, 0);
  let hi = Math.max(...vals, 0);
  if (hi === lo) hi = lo + 1;
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const t0 = data[0].t;
  const t1 = data[data.length - 1].t;
  const X = (t: number) => PL + ((t - t0) / (t1 - t0)) * (W - PL - PR);
  const Y = (v: number) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  const pts = data.filter((d) => d.v !== null);
  const line = pts.map((d, i) => `${i === 0 ? "M" : "L"}${X(d.t).toFixed(1)},${Y(d.v as number).toFixed(1)}`).join(" ");
  const area = `${line} L${X(pts[pts.length - 1].t).toFixed(1)},${H - PB} L${X(pts[0].t).toFixed(1)},${H - PB} Z`;
  const ticks = [lo + pad, (hi + lo) / 2, hi - pad];
  return (
    <div className="panel p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="font-display text-xs font-bold tracking-[0.14em] text-[#e8f1f5]">{label}</h4>
        {hov && (
          <span className="num text-[11px]" style={{ color }}>
            {fmt(hov.v)}
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * W;
          const t = t0 + ((x - PL) / (W - PL - PR)) * (t1 - t0);
          let best = pts[0];
          let bd = Infinity;
          for (const p of pts) {
            const dd = Math.abs(p.t - t);
            if (dd < bd) {
              bd = dd;
              best = p;
            }
          }
          setHov({ x: X(best.t), v: best.v as number });
        }}
        onMouseLeave={() => setHov(null)}
      >
        <defs>
          <linearGradient id={`lg-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} stroke="rgba(157,176,192,.1)" strokeDasharray="3 4" />
            <text x={PL - 6} y={Y(v) + 3} textAnchor="end" fontSize="9" fill="#61788a" fontFamily="IBM Plex Mono, monospace">
              {fmt(v)}
            </text>
          </g>
        ))}
        <line x1={PL} x2={W - PR} y1={Y(0)} y2={Y(0)} stroke="rgba(240,86,79,.45)" strokeDasharray="5 4" />
        {fill && <path d={area} fill={`url(#lg-${label})`} />}
        <path d={line} fill="none" stroke={color} strokeWidth="1.6" />
        {hov && (
          <g>
            <line x1={hov.x} x2={hov.x} y1={PT} y2={H - PB} stroke="rgba(200,214,223,.35)" />
            <circle cx={hov.x} cy={Y(hov.v)} r="3.5" fill={color} stroke="#0a1017" strokeWidth="1.5" />
          </g>
        )}
      </svg>
    </div>
  );
}

function Histogram({ m }: { m: Metrics }) {
  const [hov, setHov] = useState<number | null>(null);
  const hist = useMemo(() => returnsHistogram(m.daily), [m]);
  const W = 560;
  const H = 190;
  const PL = 36;
  const PR = 10;
  const PT = 12;
  const PB = 24;
  const maxC = Math.max(...hist.counts);
  const X = (r: number) => PL + ((r - hist.min) / (hist.max - hist.min)) * (W - PL - PR);
  const Y = (c: number) => H - PB - (c / maxC) * (H - PT - PB);
  const bw = ((W - PL - PR) / hist.counts.length) * 0.86;
  // 正規分布カーブ（度数スケール）
  const curve: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const r = hist.min + ((hist.max - hist.min) * i) / 80;
    const yv = normalPdf(r, hist.mean, hist.std) * hist.n * hist.w;
    curve.push(`${i === 0 ? "M" : "L"}${X(r).toFixed(1)},${Y(Math.min(yv, maxC * 1.05)).toFixed(1)}`);
  }
  return (
    <div className="panel p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="font-display text-xs font-bold tracking-[0.14em] text-[#e8f1f5]">日次リターン分布</h4>
        <span className="num text-[11px] text-[#9db2c0]">
          {hov !== null
            ? `${((hist.min + hist.w * hov) * 100).toFixed(2)}% 〜 ${((hist.min + hist.w * (hov + 1)) * 100).toFixed(2)}% : ${hist.counts[hov]} 日`
            : `n=${hist.n} 日`}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" onMouseLeave={() => setHov(null)}>
        {hist.counts.map((c, i) => {
          const x = X(hist.min + hist.w * i) + bw * 0.07;
          const midR = hist.min + hist.w * (i + 0.5);
          return (
            <rect
              key={i}
              x={x}
              y={Y(c)}
              width={bw}
              height={Math.max(0.5, H - PB - Y(c))}
              fill={midR >= 0 ? "#4ade9c" : "#f0564f"}
              opacity={hov === null || hov === i ? 0.85 : 0.3}
              onMouseEnter={() => setHov(i)}
            />
          );
        })}
        <path d={curve.join(" ")} fill="none" stroke="#e9b44c" strokeWidth="1.6" strokeDasharray="4 3" />
        <line x1={X(hist.mean)} x2={X(hist.mean)} y1={PT} y2={H - PB} stroke="#5ca9ff" strokeDasharray="2 3" />
        <text x={X(hist.mean) + 4} y={PT + 8} fontSize="9" fill="#5ca9ff" fontFamily="IBM Plex Mono, monospace">
          μ={(hist.mean * 100).toFixed(3)}%
        </text>
        <text x={X(0)} y={H - PB + 14} textAnchor="middle" fontSize="9" fill="#61788a" fontFamily="IBM Plex Mono, monospace">
          0%
        </text>
      </svg>
      <p className="mt-1 text-[10px] text-[#7d93a3]">破線＝当てはめた正規分布 ・ 実線μ＝日次平均リターン。右裾の厚さがテールレシオ/尖度に効く。</p>
    </div>
  );
}

export function RiskLab({ m }: { m: Metrics }) {
  const ref = useReveal<HTMLDivElement>();
  const rolling = useMemo(() => rollingMetrics(m.daily, 30), [m]);
  const eps = useMemo(() => drawdownEpisodes(m.daily, 0.5), [m]);
  const sharpeData = rolling.map((r) => ({ t: r.t, v: r.sharpe }));
  const volData = rolling.map((r) => ({ t: r.t, v: r.vol !== null ? r.vol * 100 : null }));

  return (
    <div ref={ref} className="reveal space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <MiniLineChart data={sharpeData} label="ローリング・シャープレシオ（30日）" color="#e9b44c" fmt={(v) => v.toFixed(2)} />
        <MiniLineChart data={volData} label="ローリング・ボラティリティ（30日・年率）" color="#5ca9ff" fmt={(v) => `${v.toFixed(1)}%`} fill />
      </div>
      <Histogram m={m} />
      <div className="panel overflow-hidden">
        <div className="flex items-baseline justify-between border-b border-[#1d2b3a] px-4 py-3">
          <h4 className="font-display text-sm font-bold tracking-[0.12em] text-[#e8f1f5]">主要ドローダウン・エピソード（-0.5%以上）</h4>
          <span className="text-[10px] text-[#7d93a3]">{eps.length} 件検出</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-xs">
            <thead>
              <tr className="border-b border-[#1d2b3a] text-left text-[10px] font-bold tracking-[0.14em] text-[#8aa0ae]">
                <th className="px-4 py-2">#</th>
                <th className="px-3 py-2">ピーク</th>
                <th className="px-3 py-2">ボトム</th>
                <th className="px-3 py-2">回復</th>
                <th className="px-3 py-2 text-right">深さ</th>
                <th className="px-3 py-2 text-right">下落期間</th>
                <th className="px-3 py-2 text-right">回復日数</th>
              </tr>
            </thead>
            <tbody>
              {eps.slice(0, 8).map((e, i) => (
                <tr key={i} className="border-b border-[#141f2b] transition-colors hover:bg-[#12202c]">
                  <td className="num px-4 py-2 text-[#61788a]">{String(i + 1).padStart(2, "0")}</td>
                  <td className="num px-3 py-2 text-[#c8d6df]">{fmtD(e.peakDate)}</td>
                  <td className="num px-3 py-2 text-[#c8d6df]">{fmtD(e.troughDate)}</td>
                  <td className="num px-3 py-2">
                    {e.recoveryDate ? <span className="text-[#c8d6df]">{fmtD(e.recoveryDate)}</span> : <span className="rounded-sm border border-[#e9b44c]/50 px-1.5 py-0.5 text-[10px] text-[#e9b44c]">継続中</span>}
                  </td>
                  <td className="num px-3 py-2 text-right font-semibold text-[#f0564f]">{(e.depth * 100).toFixed(2)}%</td>
                  <td className="num px-3 py-2 text-right text-[#9db2c0]">{e.durationDays}日</td>
                  <td className="num px-3 py-2 text-right text-[#9db2c0]">{e.recoveryDays !== null ? `${e.recoveryDays}日` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================= 10 MONTE CARLO ================= */
export function MonteCarloSection({ m }: { m: Metrics }) {
  const ref = useReveal<HTMLDivElement>();
  const [seed, setSeed] = useState(20260821);
  const mc = useMemo(() => monteCarlo(m.daily, 252, 2000, seed), [m, seed]);

  const W = 760;
  const H = 300;
  const PL = 56;
  const PR = 12;
  const PT = 16;
  const PB = 26;
  const lo = Math.min(mc.p10Final, mc.base) * 0.985;
  const hi = Math.max(mc.p90Final, mc.base) * 1.015;
  const X = (i: number) => PL + (i / (mc.p50.length - 1)) * (W - PL - PR);
  const Y = (v: number) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
  const band = (a: number[], b: number[]) =>
    a.map((v, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ") +
    " " +
    [...b]
      .reverse()
      .map((v, i) => `L${X(b.length - 1 - i).toFixed(1)},${Y(v).toFixed(1)}`)
      .join(" ") +
    " Z";
  const line = (a: number[]) => a.map((v, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const yTicks = [0, 1, 2, 3, 4].map((i) => lo + ((hi - lo) * i) / 4);
  const xTickIdx = [0, 63, 126, 189, 251];
  const xTickLabel = (i: number) => (i === 0 ? "現在" : `+${Math.round((i / 252) * 12)}ヶ月`);

  const cards = [
    { k: "中央値（1年後）", v: `$${usd(mc.medianFinal)}`, s: `${mc.paths.toLocaleString()} パスの中心` },
    { k: "平均値", v: `$${usd(mc.meanFinal)}`, s: `現在 $${usd(mc.base)}` },
    { k: "10–90%レンジ", v: `$${usd(mc.p10Final)} – $${usd(mc.p90Final)}`, s: "80%のパスがこの帯に収まる" },
    { k: "現在値を上回る確率", v: `${(mc.probUp * 100).toFixed(1)}%`, s: "1年後にプラスである割合" },
    { k: "+20%超の確率", v: `${(mc.probUp20 * 100).toFixed(1)}%`, s: `$${usd(mc.base * 1.2)} 超え` },
    { k: "-20%超のテールリスク", v: `${(mc.probDown20 * 100).toFixed(1)}%`, s: `$${usd(mc.base * 0.8)} 割れ`, warn: mc.probDown20 > 0.1 },
  ];

  return (
    <div ref={ref} className="reveal space-y-5">
      <div className="panel p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-bold tracking-[0.12em] text-[#e8f1f5]">1年間モンテカルロ・シミュレーション</h3>
            <p className="mt-1 text-[11px] text-[#7d93a3]">観測された日次対数リターンの分布（μ・σ）から 2,000 本のパスを生成。実線＝中央値、帯＝パーセンタイル。</p>
          </div>
          <button
            onClick={() => setSeed(Math.floor(Math.random() * 1e9))}
            className="flex items-center gap-2 rounded-sm border border-[#4ade9c]/60 bg-[#4ade9c]/10 px-3 py-1.5 text-xs font-semibold text-[#4ade9c] transition-all hover:bg-[#4ade9c]/20 active:scale-95"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 1.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            再シミュレート
          </button>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} stroke="rgba(157,176,192,.1)" strokeDasharray="3 4" />
              <text x={PL - 7} y={Y(v) + 3} textAnchor="end" fontSize="9" fill="#61788a" fontFamily="IBM Plex Mono, monospace">
                ${usd(v / 1000, 1)}k
              </text>
            </g>
          ))}
          {xTickIdx.map((i) => (
            <g key={i}>
              <line x1={X(i)} x2={X(i)} y1={H - PB} y2={H - PB + 4} stroke="#3a5069" />
              <text x={X(i)} y={H - PB + 15} textAnchor="middle" fontSize="9" fill="#61788a" fontFamily="IBM Plex Mono, monospace">
                {xTickLabel(i)}
              </text>
            </g>
          ))}
          <line x1={PL} x2={W - PR} y1={Y(mc.base)} y2={Y(mc.base)} stroke="rgba(200,214,223,.35)" strokeDasharray="6 4" />
          <text x={W - PR - 4} y={Y(mc.base) - 5} textAnchor="end" fontSize="9" fill="#9db2c0" fontFamily="IBM Plex Mono, monospace">
            現在 ${usd(mc.base)}
          </text>
          <path d={band(mc.p10, mc.p90)} fill="rgba(74,222,156,.08)" />
          <path d={band(mc.p25, mc.p75)} fill="rgba(74,222,156,.16)" />
          <path d={line(mc.p10)} fill="none" stroke="rgba(74,222,156,.35)" strokeWidth="1" />
          <path d={line(mc.p90)} fill="none" stroke="rgba(74,222,156,.35)" strokeWidth="1" />
          <path d={line(mc.p50)} fill="none" stroke="#4ade9c" strokeWidth="2" />
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <div key={c.k} className="panel p-4">
            <div className="text-[10px] font-bold tracking-[0.12em] text-[#8aa0ae]">{c.k}</div>
            <div className={`num mt-1 text-base font-semibold ${c.warn ? "text-[#f0564f]" : "text-[#e8f1f5]"}`}>{c.v}</div>
            <div className="mt-1 text-[10px] leading-snug text-[#7d93a3]">{c.s}</div>
          </div>
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-[#7d93a3]">
        ※ 幾何ブラウン運動（対数正規）ベースの統計シミュレーションです。将来の収益を保証するものではなく、観測期間のボラティリティが今後も続くという仮定のもと、テールリスクの大きさを把握するための参考値です。
      </p>
    </div>
  );
}
