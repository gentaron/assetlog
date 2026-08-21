import { useMemo, useState } from "react";
import { categoryOf, HOLDINGS, PORTFOLIO_TOTAL, themeOf, type Category } from "../data/portfolio";
import { useReveal } from "../lib/hooks";
import { fmtUsd, type Metrics } from "../lib/metrics";
import {
  excessKurtosis,
  historicalCVaR,
  historicalVaR,
  kelly,
  logReturns,
  mcCone,
  monteCarlo,
  monthlyReturns,
  rollingSharpe,
  rollingVol,
  skewness,
  ulcerIndex,
  yearlyReturns,
} from "../lib/quant";
import { Donut, Heatmap, Histogram, MCChart, RollingLine } from "./charts";
import { SectionHead } from "./ledger";

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal panel rounded-lg p-5 ${className}`}>
      <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-gold-500">{title}</p>
      {children}
    </div>
  );
}

/* ================= Portfolio ================= */
const THEME_COLORS = ["#eebf62", "#45d8a8", "#62b6de", "#f0616d", "#b78ae0", "#e8935a", "#5fd0c0", "#c9a0dc", "#8fb8de"];

export function PortfolioSection() {
  const [sortKey, setSortKey] = useState<"value" | "name" | "pct">("value");
  const [cat, setCat] = useState<Category | "ALL">("ALL");
  const [showZero, setShowZero] = useState(true);

  const held = useMemo(() => HOLDINGS.filter((h) => h.value > 0).sort((a, b) => b.value - a.value), []);
  const themes = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of held) map.set(themeOf(h.name), (map.get(themeOf(h.name)) ?? 0) + h.value);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: THEME_COLORS[i % THEME_COLORS.length] }));
  }, [held]);

  const hhi = useMemo(() => held.reduce((a, h) => a + Math.pow(h.value / PORTFOLIO_TOTAL, 2), 0), [held]);
  const effN = 1 / hhi;
  const top5 = held.slice(0, 5).reduce((a, h) => a + h.value, 0) / PORTFOLIO_TOTAL;
  const top10 = held.slice(0, 10).reduce((a, h) => a + h.value, 0) / PORTFOLIO_TOTAL;

  const cats = useMemo(() => {
    const map = new Map<Category, number>();
    for (const h of held) map.set(categoryOf(h.name), (map.get(categoryOf(h.name)) ?? 0) + h.value);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [held]);

  const rows = useMemo(() => {
    let list = held.filter((h) => cat === "ALL" || categoryOf(h.name) === cat);
    if (!showZero) list = list.filter((h) => h.value > 0.01);
    list = [...list].sort((a, b) =>
      sortKey === "name" ? a.name.localeCompare(b.name, "ja") : sortKey === "pct" ? b.pct - a.pct : b.value - a.value
    );
    return list;
  }, [held, cat, sortKey, showZero]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Panel title="アロケーション ── テーマ別ドーナツ">
          <Donut slices={themes} centerTitle="TOTAL" centerValue={`$${fmtUsd(PORTFOLIO_TOTAL, 0)}`} />
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {themes.map((t) => (
              <div key={t.label} className="flex items-center gap-2 font-mono text-[10px] text-dim">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color }} />
                <span className="truncate">{t.label}</span>
                <span className="ml-auto text-fog">{((t.value / PORTFOLIO_TOTAL) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </Panel>
        <div className="space-y-5">
          <Panel title="集中度分析 ── 分散の実効性">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                { k: "HHI", v: hhi.toFixed(4), s: hhi < 0.15 ? "分散的（<0.15）" : hhi < 0.25 ? "中程度" : "集中" },
                { k: "実効保有数", v: effN.toFixed(1), s: `${held.length} 銘柄中` },
                { k: "Top5 集中度", v: `${(top5 * 100).toFixed(1)}%`, s: "上位 5 銘柄" },
                { k: "Top10 集中度", v: `${(top10 * 100).toFixed(1)}%`, s: "上位 10 銘柄" },
              ].map((c) => (
                <div key={c.k} className="rounded-sm border border-line bg-ink-800/40 p-3">
                  <p className="font-mono text-[10px] tracking-[0.16em] text-faint">{c.k}</p>
                  <p className="num mt-1 text-xl font-semibold text-ink-50">{c.v}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-dim">{c.s}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {cats.map(([c, v]) => (
                <div key={c} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 font-mono text-[11px] text-dim">{c}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-sm bg-ink-800">
                    <div className="h-full rounded-sm bg-gold-500/70 transition-all duration-700" style={{ width: `${(v / PORTFOLIO_TOTAL) * 100}%` }} />
                  </div>
                  <span className="num w-16 shrink-0 text-right text-[11px] text-fog">{((v / PORTFOLIO_TOTAL) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
      <Panel title={`保有一覧 ── ${rows.length} 銘柄`}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["ALL", "ファンド", "ETF", "法定通貨", "暗号通貨", "ゴールド", "オルタナ"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`min-h-[34px] border px-3 font-mono text-[11px] transition-all ${
                cat === c ? "border-gold-500/60 bg-gold-500/15 text-gold-300" : "border-line text-dim hover:text-fog"
              }`}
            >
              {c}
            </button>
          ))}
          <button
            onClick={() => setShowZero((z) => !z)}
            className="ml-auto min-h-[34px] border border-line px-3 font-mono text-[11px] text-dim transition-all hover:text-fog"
          >
            {showZero ? "ゼロ保有を隠す" : "ゼロ保有を表示"}
          </button>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[640px] border-collapse text-right font-mono text-[12px]">
            <thead>
              <tr className="border-b border-line text-[10px] tracking-widest text-faint">
                <th className="px-3 py-2.5 text-left font-medium">#</th>
                <th className="cursor-pointer px-3 py-2.5 text-left font-medium hover:text-gold-300" onClick={() => setSortKey("name")}>
                  銘柄 {sortKey === "name" ? "▼" : ""}
                </th>
                <th className="px-3 py-2.5 text-left font-medium">カテゴリ</th>
                <th className="cursor-pointer px-3 py-2.5 font-medium hover:text-gold-300" onClick={() => setSortKey("value")}>
                  評価額（USD）{sortKey === "value" ? "▼" : ""}
                </th>
                <th className="cursor-pointer px-3 py-2.5 font-medium hover:text-gold-300" onClick={() => setSortKey("pct")}>
                  保有率 {sortKey === "pct" ? "▼" : ""}
                </th>
                <th className="px-3 py-2.5 text-left font-medium">構成比</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h, i) => (
                <tr key={h.name} className="border-b border-line-soft transition-colors hover:bg-ink-800/40">
                  <td className="px-3 py-2 text-left text-faint">{i + 1}</td>
                  <td className="px-3 py-2 text-left text-ink-100">{h.name}</td>
                  <td className="px-3 py-2 text-left text-dim">{categoryOf(h.name)}</td>
                  <td className="px-3 py-2 text-fog">${fmtUsd(h.value)}</td>
                  <td className="px-3 py-2 text-fog">{h.pct.toFixed(2)}%</td>
                  <td className="px-3 py-2">
                    <div className="h-2 w-full max-w-[180px] overflow-hidden rounded-sm bg-ink-800">
                      <div className="h-full rounded-sm bg-cy-500/70" style={{ width: `${(h.value / PORTFOLIO_TOTAL) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 font-mono text-[10px] text-faint">※ ALL 行は総額 $65,188.27 として扱い、保有率は個別銘柄のみで再計算。</p>
      </Panel>
    </div>
  );
}

/* ================= Tear sheet ================= */
export function TearSheet({ m }: { m: Metrics }) {
  const rs = useMemo(() => logReturns(m.daily), [m]);
  const stats = useMemo(() => {
    const skew = skewness(rs);
    const kurt = excessKurtosis(rs);
    const dd = m.drawdown.map((d) => d.dd);
    return {
      skew,
      kurt,
      var95: historicalVaR(rs, 0.95) * 100,
      var99: historicalVaR(rs, 0.99) * 100,
      cvar95: historicalCVaR(rs, 0.95) * 100,
      cvar99: historicalCVaR(rs, 0.99) * 100,
      ulcer: ulcerIndex(dd),
      kelly: kelly(m.winRate, m.profitFactor),
      rf: Math.abs(m.mdd) > 0 ? m.totalReturn / Math.abs(m.mdd) : 0,
      tail: rs.filter((r) => Math.abs(r) > 2 * (m.volAnnual / 100 / Math.sqrt(365))).length,
    };
  }, [rs, m]);
  const monthly = useMemo(() => monthlyReturns(m), [m]);
  const yearly = useMemo(() => yearlyReturns(m), [m]);

  const groups: { title: string; items: { k: string; v: string; s?: string }[] }[] = [
    {
      title: "リターン",
      items: [
        { k: "総リターン", v: `+${m.totalReturn.toFixed(2)}%`, s: `$${fmtUsd(m.startValue, 0)} → $${fmtUsd(m.latestValue, 0)}` },
        { k: "CAGR", v: `+${m.cagr.toFixed(2)}%`, s: `${m.years.toFixed(2)} 年` },
        { k: "平均日次リターン", v: `${((m.daily.slice(1).reduce((a, d) => a + d.pct, 0) / Math.max(1, m.daily.length - 1))).toFixed(3)}%` },
        { k: "ベスト日", v: `+${m.bestDay.pct.toFixed(2)}%`, s: fmtDateShort(m.bestDay.t) },
        { k: "ワースト日", v: `${m.worstDay.pct.toFixed(2)}%`, s: fmtDateShort(m.worstDay.t) },
      ],
    },
    {
      title: "リスク",
      items: [
        { k: "年率ボラ", v: `${m.volAnnual.toFixed(2)}%` },
        { k: "下方偏差（年率）", v: `${m.downsideVolAnnual.toFixed(2)}%` },
        { k: "最大 DD", v: `${m.mdd.toFixed(2)}%`, s: `${fmtDateShort(m.mddPeak.t)} → ${fmtDateShort(m.mddTrough.t)}` },
        { k: "VaR 95%（日次）", v: `${stats.var95.toFixed(2)}%`, s: "歴史的パーセンタイル" },
        { k: "VaR 99%（日次）", v: `${stats.var99.toFixed(2)}%` },
        { k: "CVaR 95%（日次）", v: `${stats.cvar95.toFixed(2)}%`, s: "期待ショートフォール" },
        { k: "CVaR 99%（日次）", v: `${stats.cvar99.toFixed(2)}%` },
        { k: "歪度", v: stats.skew.toFixed(2), s: stats.skew < -0.3 ? "左テール厚め" : "概ね対称" },
        { k: "超過尖度", v: stats.kurt.toFixed(2), s: stats.kurt > 2 ? "テール厚い" : "正規分布に近い" },
        { k: "±2σ 超え日数", v: `${stats.tail} 日` },
      ],
    },
    {
      title: "リスク調整後効率",
      items: [
        { k: "シャープレシオ", v: m.sharpe.toFixed(2), s: "rf=0 年率換算" },
        { k: "ソルティノレシオ", v: m.sortino.toFixed(2) },
        { k: "カルマーレシオ", v: m.calmar.toFixed(2), s: "CAGR ÷ |最大DD|" },
        { k: "Ulcer インデックス", v: stats.ulcer.toFixed(2), s: "DD の深さ×長さ" },
        { k: "リカバリーファクター", v: stats.rf.toFixed(1), s: "総リターン ÷ |最大DD|" },
        { k: "ケリー基準", v: `${(stats.kelly * 100).toFixed(1)}%`, s: "勝率×PF からの最適比率" },
      ],
    },
    {
      title: "トレード統計",
      items: [
        { k: "勝率（日次）", v: `${m.winRate.toFixed(1)}%`, s: `${m.upDays}勝 ${m.downDays}敗 ${m.flatDays}分` },
        { k: "プロフィットファクター", v: Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "∞" },
        { k: "平均利益日", v: `+$${fmtUsd(m.daily.filter((d) => d.pl > 0).reduce((a, d) => a + d.pl, 0) / Math.max(1, m.upDays), 0)}` },
        { k: "平均損失日", v: `−$${fmtUsd(Math.abs(m.daily.filter((d) => d.pl < 0).reduce((a, d) => a + d.pl, 0) / Math.max(1, m.downDays)), 0)}` },
        { k: "プラス月 / マイナス月", v: `${m.positiveMonths} / ${m.negativeMonths}` },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {groups.map((g) => (
          <Panel key={g.title} title={g.title}>
            <div className="space-y-3">
              {g.items.map((it) => (
                <div key={it.k} className="flex items-baseline justify-between gap-2 border-b border-line-soft pb-2.5 last:border-0">
                  <div>
                    <p className="text-[12px] text-dim">{it.k}</p>
                    {it.s && <p className="mt-0.5 font-mono text-[9px] text-faint">{it.s}</p>}
                  </div>
                  <p className="num shrink-0 text-[15px] font-semibold text-ink-50">{it.v}</p>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="月次リターン・ヒートマップ ── 年 × 月（%）">
          <Heatmap months={monthly} />
        </Panel>
        <Panel title="年次リターン">
          <div className="space-y-3">
            {yearly.map((y) => (
              <div key={y.year} className="flex items-center gap-3">
                <span className="w-12 font-mono text-[12px] text-dim">{y.year}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-sm bg-ink-800">
                  <div
                    className="flex h-full items-center justify-end rounded-sm bg-up-500/60 pr-2 font-mono text-[10px] text-ink-950 transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.max(6, y.pct))}%` }}
                  >
                    +{y.pct.toFixed(1)}%
                  </div>
                </div>
                {y.partial && <span className="font-mono text-[9px] text-gold-300">期間途中</span>}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
function fmtDateShort(t: number): string {
  const d = new Date(t);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/* ================= Risk lab ================= */
export function RiskLab({ m }: { m: Metrics }) {
  const rs = useMemo(() => logReturns(m.daily), [m]);
  const labels = useMemo(() => m.daily.map((d) => fmtDateShort(d.t)), [m]);
  const sharpe = useMemo(() => rollingSharpe(rs, 30), [rs]);
  const vol = useMemo(() => rollingVol(rs, 30), [rs]);
  const episodes = useMemo(() => {
    // 主要ドローダウン・エピソード（深さ順に上位 5）
    const eps: { peak: number; trough: number; dd: number; recT: number | null }[] = [];
    let runMax = -Infinity;
    let peakV = 0;
    let cur: { peak: number; trough: number; dd: number } | null = null;
    for (const r of m.records) {
      if (r.v > runMax) {
        if (cur && cur.dd < -0.5) eps.push({ ...cur, recT: null });
        runMax = r.v;
        peakV = r.v;
        cur = { peak: r.t, trough: r.t, dd: 0 };
      } else if (cur) {
        const dd = ((r.v - runMax) / runMax) * 100;
        if (dd < cur.dd) {
          cur.dd = dd;
          cur.trough = r.t;
        }
        if (r.v >= peakV && cur.dd < 0) {
          eps.push({ ...cur, recT: r.t });
          cur = null;
          runMax = r.v;
          peakV = r.v;
        }
      }
    }
    if (cur && cur.dd < -0.5) eps.push({ ...cur, recT: null });
    return eps.sort((a, b) => a.dd - b.dd).slice(0, 5);
  }, [m]);
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="ローリング・シャープレシオ（30日）">
          <RollingLine values={sharpe} labels={labels} color="#62b6de" baseline={0} />
        </Panel>
        <Panel title="ローリング・ボラティリティ（30日・年率 %）">
          <RollingLine values={vol} labels={labels} color="#eebf62" unit="%" />
        </Panel>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="日次リターン分布 ── 正規分布フィット（破線）">
          <Histogram returns={rs} daily={m.daily} />
        </Panel>
        <Panel title="主要ドローダウン・エピソード">
          <div className="space-y-3">
            {episodes.map((e, i) => (
              <div key={i} className="rounded-sm border border-line bg-ink-800/40 p-3">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[12px] font-semibold text-down-300">{e.dd.toFixed(2)}%</span>
                  <span className="font-mono text-[10px] text-faint">
                    {fmtDateShort(e.peak)} → {fmtDateShort(e.trough)}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-dim">
                  {e.recT ? `回復まで ${Math.round((e.recT - e.trough) / 86400000)} 日` : "継続中（高値未回復）"}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ================= Monte Carlo ================= */
export function MonteCarloSection({ m }: { m: Metrics }) {
  const [seed, setSeed] = useState(() => Date.now());
  const rs = useMemo(() => logReturns(m.daily), [m]);
  const mc = useMemo(() => monteCarlo(rs, m.latestValue, 365, 2000, seed), [rs, m.latestValue, seed]);
  const cone = useMemo(() => mcCone(rs, m.latestValue, 60, 400, seed), [rs, m.latestValue, seed]);
  return (
    <div className="space-y-5">
      <Panel title="1 年先の資産分布 ── 観測リターン分布から 2,000 パス生成">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setSeed(Date.now())}
            className="min-h-[38px] border border-gold-500/60 bg-gold-500/10 px-4 font-mono text-[12px] tracking-wider text-gold-300 transition-all hover:bg-gold-500/20"
          >
            ⟳ 再シミュレート
          </button>
          <span className="font-mono text-[11px] text-faint">
            日次 μ・σ は観測値（μ = {(meanOf(rs) * 100).toFixed(3)}%/日、σ = {(sdOf(rs) * 100).toFixed(3)}%/日）
          </span>
        </div>
        <div className="overflow-x-auto scroll-thin">
          <div className="min-w-[760px]">
            <MCChart cone={cone} startValue={m.latestValue} />
          </div>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { k: "1年後 中央値", v: `$${fmtUsd(mc.percentiles.find((p) => p.p === 50)!.value, 0)}`, s: `×${mc.medianMultiple.toFixed(2)}`, tone: "text-gold-300" },
          { k: "上昇確率", v: `${(mc.probUp * 100).toFixed(1)}%`, s: "現在値超え", tone: "text-up-300" },
          { k: "+20% 超え確率", v: `${(mc.probPlus20 * 100).toFixed(1)}%`, s: `$${fmtUsd(m.latestValue * 1.2, 0)} 超`, tone: "text-up-300" },
          { k: "−20% 超えテール", v: `${(mc.probMinus20 * 100).toFixed(1)}%`, s: `$${fmtUsd(m.latestValue * 0.8, 0)} 割れ`, tone: "text-down-300" },
        ].map((c) => (
          <div key={c.k} className="panel panel-hover rounded-lg p-5">
            <p className="font-mono text-[10px] tracking-[0.2em] text-faint">{c.k}</p>
            <p className={`num mt-2 text-2xl font-semibold ${c.tone}`}>{c.v}</p>
            <p className="mt-1 font-mono text-[10px] text-dim">{c.s}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-7">
        {mc.percentiles.map((p) => (
          <div key={p.p} className="panel rounded-lg p-3 text-center">
            <p className="font-mono text-[10px] text-faint">P{p.p}</p>
            <p className="num mt-1 text-[13px] font-semibold text-ink-100">${(p.value / 1000).toFixed(1)}k</p>
          </div>
        ))}
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-faint">
        ※ 対数正規モンテカルロ。過去の μ・σ が将来も続くという仮定であり、積立（外部キャッシュフロー）は含みません。予測ではなく分布の提示です。
      </p>
    </div>
  );
}
function meanOf(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function sdOf(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = meanOf(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1));
}
