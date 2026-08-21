import { useMemo, useState } from "react";
import type { Metrics } from "../lib/metrics";
import { fmtDate, fmtUsd } from "../lib/metrics";
import { useReveal } from "../lib/hooks";

/**
 * 純投資評価: 給与からの毎月積立（外部キャッシュフロー）を修正ディーツ法で除去し、
 * 運用だけの実力（TWR）を分離する。積立額・為替・計上タイミングは調整可能。
 */

interface Flow {
  t: number;
  amt: number; // USD
}

interface PureResult {
  dailyTwr: { t: number; idx: number }[]; // 元本=100 リベース
  twrTotal: number; // %
  twrCagr: number; // %
  irr: number; // % 年率（ニュートン法）
  totalDeposits: number; // USD
  finalBase: number; // 貯金だけの場合の最終額
  finalActual: number;
  premium: number; // 投資付加価値
  startValue: number;
  depositShare: number; // 増加額に占める積立比率
  flows: Flow[];
  baseSeries: { t: number; v: number }[];
  twrVol: number;
  twrSharpe: number;
  twrMdd: number;
  twrWinRate: number;
  yearly: { year: string; deposit: number; actualPl: number; twrPct: number; partial: boolean }[];
}

function computePure(m: Metrics, monthlyMyr: number, myrUsd: number, timing: "start" | "mid" | "end"): PureResult {
  const daily = m.daily;
  const startValue = m.startValue;
  const startT = daily[0].t;
  const DAY = 86400000;

  // 積立計上日（開始月の翌月から、毎月 1 回）
  const flows: Flow[] = [];
  const startDate = new Date(daily[0].t);
  const y0 = startDate.getFullYear();
  const mo0 = startDate.getMonth();
  for (let i = 1; i < 60; i++) {
    const base = new Date(y0, mo0 + i, 1);
    const day = timing === "start" ? 1 : timing === "mid" ? 15 : 28;
    const target = new Date(base.getFullYear(), base.getMonth(), day, 0, 30, 0).getTime();
    if (target > daily[daily.length - 1].t) break;
    // 最も近い日次ポイントに計上
    let bt = daily[0].t;
    let bd = Infinity;
    for (const d of daily) {
      const dist = Math.abs(d.t - target);
      if (dist < bd) {
        bd = dist;
        bt = d.t;
      }
    }
    flows.push({ t: bt, amt: (monthlyMyr * myrUsd) / 1 });
  }
  const flowMap = new Map<number, number>();
  for (const f of flows) flowMap.set(f.t, (flowMap.get(f.t) ?? 0) + f.amt);
  const totalDeposits = flows.reduce((a, f) => a + f.amt, 0);

  // 修正ディーツ法（ウェイト 0.5）で日次リターンから積立を除去
  const rets: number[] = [];
  for (let i = 1; i < daily.length; i++) {
    const flow = flowMap.get(daily[i].t) ?? 0;
    const begin = daily[i - 1].close;
    const end = daily[i].close;
    const r = (end - begin - flow) / (begin + 0.5 * flow);
    rets.push(r);
  }

  // TWR NAV（元本=100）
  const dailyTwr: { t: number; idx: number }[] = [{ t: daily[0].t, idx: 100 }];
  let nav = 100;
  for (let i = 1; i < daily.length; i++) {
    nav *= 1 + rets[i - 1];
    dailyTwr.push({ t: daily[i].t, idx: nav });
  }
  const twrTotal = (nav - 1) * 100;
  const years = (daily[daily.length - 1].t - daily[0].t) / (365.25 * DAY);
  const twrCagr = (Math.pow(nav, 1 / years) - 1) * 100;

  // 貯金だけベースライン（元本 + 積立を複利なしで積み上げ）
  const baseSeries: { t: number; v: number }[] = [{ t: daily[0].t, v: startValue }];
  let base = startValue;
  for (let i = 1; i < daily.length; i++) {
    base += flowMap.get(daily[i].t) ?? 0;
    baseSeries.push({ t: daily[i].t, v: base });
  }
  const finalBase = base;
  const finalActual = daily[daily.length - 1].close;
  const premium = finalActual - finalBase;
  const gain = finalActual - startValue;
  const depositShare = gain > 0 ? Math.min(1, totalDeposits / gain) : 0;

  // IRR（マネーウェイト、ニュートン法）
  let irr = 0.1;
  const npv = (rate: number) => {
    let v = -startValue;
    for (const f of flows) v -= (f.amt / Math.pow(1 + rate, (f.t - startT) / (365.25 * DAY)));
    v += finalActual / Math.pow(1 + rate, years);
    return v;
  };
  for (let it = 0; it < 60; it++) {
    const f = npv(irr);
    const df = (npv(irr + 1e-5) - f) / 1e-5;
    if (Math.abs(df) < 1e-12) break;
    irr -= f / df;
    if (Math.abs(f) < 1e-7) break;
  }
  irr *= 100;

  // TWR のリスク指標
  const twrVol = Math.sqrt(rets.reduce((a, r) => a + r * r, 0) / Math.max(1, rets.length)) * Math.sqrt(365) * 100;
  const meanR = rets.reduce((a, r) => a + r, 0) / Math.max(1, rets.length);
  const twrSharpe = twrVol > 0 ? (meanR * 365) / (twrVol / 100) / 100 : 0;
  let peak = -Infinity;
  let twrMdd = 0;
  for (const p of dailyTwr) {
    peak = Math.max(peak, p.idx);
    twrMdd = Math.min(twrMdd, ((p.idx - peak) / peak) * 100);
  }
  const twrWinRate = (rets.filter((r) => r > 0).length / Math.max(1, rets.length)) * 100;

  // 年次分解
  const byYear = new Map<string, { idx0: number; idx1: number; deposit: number; v0: number; v1: number; months: number }>();
  for (let i = 0; i < daily.length; i++) {
    const y = String(new Date(daily[i].t).getFullYear());
    const e = byYear.get(y);
    const dep = flowMap.get(daily[i].t) ?? 0;
    if (!e) byYear.set(y, { idx0: dailyTwr[i].idx, idx1: dailyTwr[i].idx, deposit: dep, v0: daily[i].close, v1: daily[i].close, months: 1 });
    else {
      e.idx1 = dailyTwr[i].idx;
      e.v1 = daily[i].close;
      e.deposit += dep;
    }
  }
  const yearly = [...byYear.entries()].map(([year, e]) => ({
    year,
    deposit: e.deposit,
    actualPl: e.v1 - e.v0 - e.deposit,
    twrPct: (e.idx1 / e.idx0 - 1) * 100,
    partial: e.months < 12,
  }));

  return {
    dailyTwr,
    twrTotal,
    twrCagr,
    irr,
    totalDeposits,
    finalBase,
    finalActual,
    premium,
    startValue,
    depositShare,
    flows,
    baseSeries,
    twrVol,
    twrSharpe,
    twrMdd,
    twrWinRate,
    yearly,
  };
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal panel rounded-lg p-5 ${className}`}>
      <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-gold-500">{title}</p>
      {children}
    </div>
  );
}

export function PureTab({ m }: { m: Metrics }) {
  const [myr, setMyr] = useState(5500);
  const [fx, setFx] = useState(4.5);
  const [timing, setTiming] = useState<"start" | "mid" | "end">("start");
  const p = useMemo(() => computePure(m, myr, fx, timing), [m, myr, fx, timing]);

  const usd = (v: number, d = 0) => fmtUsd(v, d);
  const pct = (v: number, d = 2) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`;
  const nominal = m.totalReturn;

  // ギャップチャート
  const W = 980;
  const H = 300;
  const PL = 64;
  const PR = 14;
  const PT = 16;
  const PB = 28;
  const allV = [...m.daily.map((d) => d.close), ...p.baseSeries.map((b) => b.v)];
  const min = Math.min(...allV);
  const max = Math.max(...allV);
  const pad = (max - min) * 0.06;
  const t0 = m.daily[0].t;
  const t1 = m.daily[m.daily.length - 1].t;
  const X = (t: number) => PL + ((t - t0) / Math.max(1, t1 - t0)) * (W - PL - PR);
  const Y = (v: number) => PT + (1 - (v - (min - pad)) / (max - min + 2 * pad)) * (H - PT - PB);
  const actualPath = m.daily.map((d, i) => `${i === 0 ? "M" : "L"}${X(d.t).toFixed(1)},${Y(d.close).toFixed(1)}`).join(" ");
  const basePath = p.baseSeries.map((b, i) => `${i === 0 ? "M" : "L"}${X(b.t).toFixed(1)},${Y(b.v).toFixed(1)}`).join(" ");
  const areaPath = `${actualPath} ${[...p.baseSeries].reverse().map((b) => `L${X(b.t).toFixed(1)},${Y(b.v).toFixed(1)}`).join(" ")} Z`;

  // ウォーターフォール
  const premSign = p.premium >= 0 ? "+" : "−";
  const bars = [
    { label: "開始時資産", from: 0, to: p.startValue, color: "#3f9cc9", delta: `$${usd(p.startValue)}` },
    { label: "積立累計", from: p.startValue, to: p.finalBase, color: "#62b6de", delta: `+$${usd(p.totalDeposits)}` },
    { label: "投資付加価値", from: p.finalBase, to: p.finalActual, color: p.premium >= 0 ? "#45d8a8" : "#f0616d", delta: `${premSign}$${usd(Math.abs(p.premium))}` },
    { label: "最終資産", from: 0, to: p.finalActual, color: "#eebf62", delta: `$${usd(p.finalActual)}` },
  ];
  const wfMax = p.finalActual * 1.05;
  const wfY = (v: number) => 8 + (1 - v / wfMax) * 130;

  // TWR カーブ
  const TW = 980;
  const TH = 240;
  const tMin = Math.min(...p.dailyTwr.map((d) => d.idx), 100);
  const tMax = Math.max(...p.dailyTwr.map((d) => d.idx), 100);
  const tPad = (tMax - tMin) * 0.08 || 1;
  const TX = (t: number) => PL + ((t - t0) / Math.max(1, t1 - t0)) * (TW - PL - PR);
  const TY = (v: number) => PT + (1 - (v - (tMin - tPad)) / (tMax - tMin + 2 * tPad)) * (TH - PT - PB);
  const twrPath = p.dailyTwr.map((d, i) => `${i === 0 ? "M" : "L"}${TX(d.t).toFixed(1)},${TY(d.idx).toFixed(1)}`).join(" ");

  const insights = [
    {
      title: "増加を主導したのは「運用率」ではなく「貯蓄量」",
      body: `名目リターン ${pct(nominal, 1)} のうち、積立累計 ${pct(p.depositShare * 100, 0)}（$${usd(p.totalDeposits)}）が寄与。純投資 TWR は ${pct(p.twrTotal, 1)}（年率 ${pct(p.twrCagr, 1)}）。`,
      tone: "text-gold-300",
    },
    {
      title: p.premium >= 0 ? "投資は確実に付加価値を生んでいる" : "投資はベースラインを下回っている",
      body: `貯金だけの場合の最終額 $${usd(p.finalBase)} に対し、実測は $${usd(p.finalActual)}。差額 ${premSign}$${usd(Math.abs(p.premium))} が運用の純貢献。`,
      tone: p.premium >= 0 ? "text-up-300" : "text-down-300",
    },
    {
      title: "IRR が TWR を下回るのは自然",
      body: `IRR ${pct(p.irr, 1)} < TWR ${pct(p.twrCagr, 1)}。積立は後半ほど運用期間が短く、ドルコスト平準化の効果で実感リターンは保守的に出る。`,
      tone: "text-cy-400",
    },
    {
      title: "リスクは極めて抑制的",
      body: `純投資ベースの最大 DD ${p.twrMdd.toFixed(2)}%・勝率 ${p.twrWinRate.toFixed(1)}%。シャーペ ${p.twrSharpe.toFixed(2)}。下落よりも「積立を止めないこと」が最大のリスク管理。`,
      tone: "text-dim",
    },
  ];

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 md:px-6">
      <div className="mb-6 border-b border-line pb-4">
        <p className="font-mono text-[11px] tracking-[0.28em] text-gold-500">PURE RETURN ── 純投資評価</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-ink-50 md:text-3xl">給与積立を除去した「運用だけの実力」</h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-dim">
          毎月 RM5,000〜6,000 の給与積立は外部キャッシュフロー。修正ディーツ法（ウェイト 0.5）で日次リターンから除去し、
          初期元本のみを複利した NAV を TWR として評価します。積立は 2025 年 5 月分から計上（保守的仮定）。
        </p>
      </div>

      {/* controls */}
      <div className="panel mb-5 grid gap-5 rounded-lg p-5 md:grid-cols-3">
        <div>
          <div className="flex items-baseline justify-between">
            <label className="font-mono text-[11px] tracking-wider text-dim">毎月積立額</label>
            <span className="num text-lg font-semibold text-gold-300">RM {myr.toLocaleString()}</span>
          </div>
          <input type="range" min={3000} max={9000} step={100} value={myr} onChange={(e) => setMyr(+e.target.value)} className="slider mt-1" />
          <p className="font-mono text-[10px] text-faint">≒ ${usd(myr * fx)}/月</p>
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className="font-mono text-[11px] tracking-wider text-dim">為替レート</label>
            <span className="num text-lg font-semibold text-gold-300">{fx.toFixed(2)} MYR/USD</span>
          </div>
          <input type="range" min={4.0} max={5.0} step={0.01} value={fx} onChange={(e) => setFx(+e.target.value)} className="slider mt-1" />
          <p className="font-mono text-[10px] text-faint">1 USD = {fx.toFixed(2)} MYR で換算</p>
        </div>
        <div>
          <label className="font-mono text-[11px] tracking-wider text-dim">積立の計上タイミング</label>
          <div className="mt-2 flex gap-1.5">
            {([["start", "月初"], ["mid", "月中"], ["end", "月末"]] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setTiming(v)}
                className={`min-h-[38px] flex-1 border font-mono text-[12px] transition-all ${
                  timing === v ? "border-gold-500/60 bg-gold-500/15 text-gold-300" : "border-line text-dim hover:text-fog"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] text-faint">計上 {p.flows.length} 回 ・ 全指標が即時再計算されます</p>
        </div>
      </div>

      {/* waterfall + decomposition */}
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="増加の分解ウォーターフォール ── どこから増えたか">
          <svg viewBox="0 0 520 170" className="w-full">
            {bars.map((b, i) => {
              const x = 12 + i * 128;
              const bw = 96;
              const yTop = wfY(Math.max(b.from, b.to));
              const yBot = wfY(Math.min(b.from, b.to));
              return (
                <g key={b.label}>
                  <rect x={x} y={yTop} width={bw} height={Math.max(2, yBot - yTop)} fill={b.color} opacity="0.75" rx="2" />
                  <text x={x + bw / 2} y={yTop - 6} textAnchor="middle" fontSize="11" fill="#e8eef5" fontFamily="IBM Plex Mono, monospace" fontWeight="600">
                    {b.delta}
                  </text>
                  <text x={x + bw / 2} y={160} textAnchor="middle" fontSize="10" fill="#92a5ba">
                    {b.label}
                  </text>
                  {i < bars.length - 1 && i > 0 && (
                    <line x1={x + bw} x2={x + 128} y1={wfY(b.to)} y2={wfY(b.to)} stroke="#5d7288" strokeDasharray="3 3" />
                  )}
                </g>
              );
            })}
          </svg>
          <div className="mt-2 grid grid-cols-3 gap-3 font-mono text-[11px]">
            <div className="rounded-sm border border-line bg-ink-800/40 p-2.5">
              <p className="text-faint">名目総リターン</p>
              <p className="num mt-0.5 text-lg text-fog">{pct(nominal, 1)}</p>
            </div>
            <div className="rounded-sm border border-gold-600/40 bg-gold-500/10 p-2.5">
              <p className="text-faint">純投資 TWR</p>
              <p className="num mt-0.5 text-lg text-gold-300">{pct(p.twrTotal, 1)}</p>
            </div>
            <div className="rounded-sm border border-cy-500/40 bg-cy-500/10 p-2.5">
              <p className="text-faint">増加額に占める積立</p>
              <p className="num mt-0.5 text-lg text-cy-400">{pct(p.depositShare * 100, 0)}</p>
            </div>
          </div>
        </Panel>
        <Panel title="分離評価 ── 3 つの数字">
          <div className="space-y-4">
            {[
              { k: "純投資 TWR（総額）", v: pct(p.twrTotal, 2), s: "積立を除去した時間加重収益率", tone: "text-gold-300" },
              { k: "純投資 CAGR（年率）", v: pct(p.twrCagr, 2), s: "運用だけの実力・年率換算", tone: "text-gold-300" },
              { k: "マネーウェイト IRR", v: pct(p.irr, 2), s: "積立タイミングを加味した実感リターン", tone: "text-cy-400" },
              { k: "投資付加価値", v: `${premSign}$${usd(Math.abs(p.premium))}`, s: "実測 − 貯金のみベースライン", tone: p.premium >= 0 ? "text-up-300" : "text-down-300" },
              { k: "積立累計", v: `$${usd(p.totalDeposits)}`, s: `RM ${usd(p.totalDeposits / fx)} を ${fx.toFixed(2)} で換算 ・ ${p.flows.length} 回`, tone: "text-ink-50" },
            ].map((r) => (
              <div key={r.k} className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-3 last:border-0">
                <div>
                  <p className="text-[12px] text-dim">{r.k}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-faint">{r.s}</p>
                </div>
                <p className={`num shrink-0 text-xl font-semibold ${r.tone}`}>{r.v}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* gap chart */}
      <div className="mt-5">
        <Panel title="実測 vs 貯金のみベースライン ── 緑の領域が投資の付加価値">
          <div className="overflow-x-auto scroll-thin">
            <div className="min-w-[760px]">
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
                <path d={areaPath} fill="rgba(69,216,168,0.12)" />
                <path d={basePath} fill="none" stroke="#62b6de" strokeWidth="1.6" strokeDasharray="6 5" />
                <path d={actualPath} fill="none" stroke="#eebf62" strokeWidth="2" />
                {p.flows.map((f, i) => (
                  <circle key={i} cx={X(f.t)} cy={Y(m.daily.find((d) => d.t === f.t)?.close ?? 0)} r="3" fill="#62b6de" opacity="0.8">
                    <title>{`積立 $${usd(f.amt)}（${fmtDate(f.t)}）`}</title>
                  </circle>
                ))}
              </svg>
            </div>
          </div>
          <div className="mt-1 flex gap-6 font-mono text-[10px] text-faint">
            <span className="flex items-center gap-2"><span className="h-0.5 w-5 bg-gold-400" />実測資産</span>
            <span className="flex items-center gap-2"><span className="h-0.5 w-5 border-t-2 border-dashed border-cy-400" />貯金のみ（元本+積立）</span>
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-cy-400/80" />積立計上</span>
          </div>
        </Panel>
      </div>

      {/* TWR curve + risk */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="純投資成長カーブ ── 元本=100 リベース（TWR NAV）">
          <div className="overflow-x-auto scroll-thin">
            <div className="min-w-[760px]">
              <svg viewBox={`0 0 ${TW} ${TH}`} className="w-full">
                {[tMin - tPad, 100, tMax + tPad].map((v, i) => (
                  <g key={i}>
                    <line x1={PL} x2={TW - PR} y1={TY(v)} y2={TY(v)} stroke={v === 100 ? "#5d7288" : "#1d2a3b"} strokeDasharray={v === 100 ? "2 4" : "3 5"} />
                    <text x={PL - 8} y={TY(v) + 4} textAnchor="end" fontSize="10" fill="#5d7288" fontFamily="IBM Plex Mono, monospace">
                      {v.toFixed(0)}
                    </text>
                  </g>
                ))}
                <path d={twrPath} fill="none" stroke="#45d8a8" strokeWidth="2" />
                <text x={TW - PR} y={TY(p.dailyTwr[p.dailyTwr.length - 1].idx) - 8} textAnchor="end" fontSize="11" fill="#45d8a8" fontFamily="IBM Plex Mono, monospace">
                  {p.dailyTwr[p.dailyTwr.length - 1].idx.toFixed(1)}（{pct(p.twrTotal, 1)}）
                </text>
              </svg>
            </div>
          </div>
          <p className="mt-1 font-mono text-[10px] text-faint">破線（100）= 元本。このカーブの傾きだけが「運用の実力」。</p>
        </Panel>
        <Panel title="純投資ベースのリスク指標">
          <div className="space-y-4">
            {[
              { k: "TWR 年率ボラ", v: `${p.twrVol.toFixed(2)}%` },
              { k: "TWR シャーペ", v: p.twrSharpe.toFixed(2) },
              { k: "TWR 最大 DD", v: `${p.twrMdd.toFixed(2)}%` },
              { k: "TWR 勝率（日次）", v: `${p.twrWinRate.toFixed(1)}%` },
              { k: "貯金のみ最終額", v: `$${usd(p.finalBase)}` },
              { k: "実測最終額", v: `$${usd(p.finalActual)}` },
            ].map((r) => (
              <div key={r.k} className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-3 last:border-0">
                <p className="text-[12px] text-dim">{r.k}</p>
                <p className="num text-lg font-semibold text-ink-50">{r.v}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* yearly table */}
      <div className="mt-5">
        <Panel title="年次分解 ── 積立額 / 実測増減 / 純投資リターン">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[620px] border-collapse text-right font-mono text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] tracking-widest text-faint">
                  <th className="px-5 py-3 text-left font-medium">年</th>
                  <th className="px-5 py-3 font-medium">積立額（USD）</th>
                  <th className="px-5 py-3 font-medium">実測増減（積立除く）</th>
                  <th className="px-5 py-3 font-medium">純投資リターン</th>
                  <th className="px-5 py-3 font-medium">備考</th>
                </tr>
              </thead>
              <tbody>
                {p.yearly.map((y) => (
                  <tr key={y.year} className="border-b border-line-soft transition-colors hover:bg-ink-800/40">
                    <td className="px-5 py-3 text-left text-fog">{y.year}</td>
                    <td className="px-5 py-3 text-cy-400">+$${usd(y.deposit)}</td>
                    <td className={`px-5 py-3 ${y.actualPl >= 0 ? "text-up-300" : "text-down-300"}`}>
                      {y.actualPl >= 0 ? "+" : "−"}${usd(Math.abs(y.actualPl))}
                    </td>
                    <td className={`px-5 py-3 font-semibold ${y.twrPct >= 0 ? "text-gold-300" : "text-down-300"}`}>{pct(y.twrPct, 2)}</td>
                    <td className="px-5 py-3 text-[11px] text-faint">{y.partial ? "期間途中" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* insights */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {insights.map((s) => (
          <div key={s.title} className="panel panel-hover rounded-lg p-5">
            <p className={`font-display text-[15px] font-bold ${s.tone}`}>{s.title}</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-dim">{s.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 font-mono text-[10px] leading-relaxed text-faint">
        方法論: 修正ディーツ法（Modified Dietz, ウェイト 0.5）で外部キャッシュフローを除去 → 初期元本のみ複利した NAV = TWR。
        積立額は給与天引きの自己申告（RM5,000〜6,000/月）に基づき既定 RM5,500。為替は固定レート仮定（実際は時価）。
        推定値で穴を埋めず、仮定はすべてここに明記します。
      </p>
    </div>
  );
}
