import { useMemo } from "react";
import { SOURCE_URL } from "../data/logs";
import { useCountUp, useReveal } from "../lib/hooks";
import { fmtDate, fmtDateTime, fmtUsd, type Metrics } from "../lib/metrics";
import type { LiveState } from "../lib/liveFeed";
import { formatMyt } from "../lib/liveFeed";
import { DrawdownChart, MainChart, MonthlyBars, Sparkline } from "./charts";

/* ================= Section head ================= */
export function SectionHead({ no, en, jp, desc }: { no: string; en: string; jp: string; desc: string }) {
  return (
    <div className="mb-6 flex flex-col gap-2 border-l-2 border-gold-500 pl-4">
      <p className="font-mono text-[11px] tracking-[0.28em] text-gold-500">
        {no} ── {en}
      </p>
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink-50 md:text-3xl">{jp}</h2>
      <p className="max-w-2xl text-[13px] leading-relaxed text-dim">{desc}</p>
    </div>
  );
}

/* ================= Ticker ================= */
export function Ticker({ m }: { m: Metrics }) {
  const items = useMemo(() => {
    const base = [
      { k: "LATEST", v: `$${fmtUsd(m.latestValue)}` },
      { k: "TOTAL", v: `${m.totalReturn >= 0 ? "+" : ""}${m.totalReturn.toFixed(2)}%` },
      { k: "CAGR", v: `+${m.cagr.toFixed(1)}%` },
      { k: "MAX DD", v: `${m.mdd.toFixed(2)}%` },
      { k: "SHARPE", v: m.sharpe.toFixed(2) },
      { k: "SORTINO", v: m.sortino.toFixed(2) },
      { k: "CALMAR", v: m.calmar.toFixed(2) },
      { k: "WIN RATE", v: `${m.winRate.toFixed(1)}%` },
      { k: "BEST DAY", v: `+$${fmtUsd(m.bestDay.pl, 0)}` },
      { k: "WORST DAY", v: `−$${fmtUsd(Math.abs(m.worstDay.pl), 0)}` },
    ];
    const monthly = m.months.slice(-6).map((mo) => ({
      k: mo.label,
      v: `${mo.pct >= 0 ? "+" : ""}${mo.pct.toFixed(2)}%`,
    }));
    return [...base, ...monthly];
  }, [m]);
  return (
    <div className="overflow-hidden border-b border-line bg-ink-900/80">
      <div className="ticker-track py-1.5">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex shrink-0 items-center">
            {items.map((it, i) => (
              <span key={`${dup}-${i}`} className="mx-5 flex items-baseline gap-2 font-mono text-[11px]">
                <span className="tracking-[0.18em] text-faint">{it.k}</span>
                <span className={it.v.startsWith("-") || it.v.startsWith("−") ? "text-down-300" : it.v.startsWith("+") ? "text-up-300" : "text-fog"}>
                  {it.v}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= Hero ================= */
export function Hero({ m }: { m: Metrics }) {
  const big = useCountUp(m.latestValue, 1600, 2);
  const spark = useMemo(() => m.daily.map((d) => d.close), [m]);
  return (
    <section id="overview" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 pb-6 pt-10 md:px-6">
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="panel panel-hover rounded-lg p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-[11px] tracking-[0.28em] text-faint">TOTAL ASSETS ── 総資産（USD）</p>
            {m.isAllTimeHigh && (
              <span className="border border-up-600/50 bg-up-500/10 px-2 py-0.5 font-mono text-[10px] tracking-[0.18em] text-up-300">
                ▲ 史上最高値を更新中
              </span>
            )}
          </div>
          <p className="num mt-4 text-5xl font-semibold leading-none tracking-tight text-ink-50 md:text-7xl">
            <span className="text-gold-400">$</span>
            {big}
          </p>
          <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2 font-mono text-[13px]">
            <span className={m.gain >= 0 ? "text-up-300" : "text-down-300"}>
              {m.gain >= 0 ? "+" : "−"}${fmtUsd(Math.abs(m.gain))}（{m.totalReturn >= 0 ? "+" : ""}
              {m.totalReturn.toFixed(2)}%）
            </span>
            <span className="text-faint">開始 {fmtDate(m.start.t)} → 最新 {fmtDateTime(m.latest.t)}</span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">
            {[
              { k: "運用日数", v: `${m.days.toLocaleString()}日` },
              { k: "ログ件数", v: `${m.records.length.toLocaleString()}件` },
              { k: "新高値更新", v: `${m.newHighCount}回` },
              { k: "平均 +/日", v: `$${fmtUsd(m.avgDaily, 0)}` },
            ].map((s) => (
              <div key={s.k}>
                <p className="font-mono text-[10px] tracking-[0.2em] text-faint">{s.k}</p>
                <p className="num mt-1 text-lg font-semibold text-ink-100">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="panel panel-hover flex flex-col rounded-lg p-6">
          <p className="font-mono text-[11px] tracking-[0.28em] text-faint">EQUITY CURVE ── 全期間</p>
          <div className="min-h-[120px] flex-1 py-3">
            <Sparkline points={spark} />
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-line pt-4 font-mono text-[11px]">
            <div>
              <p className="text-faint">低値</p>
              <p className="num mt-0.5 text-down-300">${fmtUsd(Math.min(...m.records.map((r) => r.v)), 0)}</p>
            </div>
            <div>
              <p className="text-faint">高値</p>
              <p className="num mt-0.5 text-up-300">${fmtUsd(Math.max(...m.records.map((r) => r.v)), 0)}</p>
            </div>
            <div>
              <p className="text-faint">CAGR</p>
              <p className="num mt-0.5 text-gold-300">+{m.cagr.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================= Chart section ================= */
export function ChartSection({ m }: { m: Metrics }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal panel rounded-lg p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] tracking-[0.22em] text-faint">ASSET CURVE ── 総資産推移（全スナップショット）</p>
      </div>
      <MainChart records={m.records} daily={m.daily} />
    </div>
  );
}

/* ================= KPI grid ================= */
export function KpiGrid({ m }: { m: Metrics }) {
  const ref = useReveal<HTMLDivElement>();
  const groups: { title: string; items: { k: string; v: string; s?: string; tone?: "up" | "down" | "gold" }[] }[] = [
    {
      title: "収益性 RETURN",
      items: [
        { k: "総リターン", v: `+${m.totalReturn.toFixed(2)}%`, s: `+$${fmtUsd(m.gain, 0)}`, tone: "up" },
        { k: "CAGR（年率複利）", v: `+${m.cagr.toFixed(2)}%`, s: `${m.years.toFixed(2)} 年運用` },
        { k: "平均月次増加", v: `$${fmtUsd(m.avgMonthly, 0)}`, s: "日次ログから推計" },
        { k: "ベスト月", v: `+${m.bestMonth.pct.toFixed(2)}%`, s: m.bestMonth.label, tone: "up" },
        { k: "ワースト月", v: `${m.worstMonth.pct.toFixed(2)}%`, s: m.worstMonth.label, tone: "down" },
        { k: "プラス月 / マイナス月", v: `${m.positiveMonths} / ${m.negativeMonths}`, s: "勝率に換算" },
        { k: "1年後の推計資産", v: `$${fmtUsd(m.projected1y, 0)}`, s: "CAGR 維持と仮定" },
      ],
    },
    {
      title: "リスク RISK",
      items: [
        { k: "年率ボラティリティ", v: `${m.volAnnual.toFixed(2)}%`, s: "日次標準偏差 × √365" },
        { k: "最大ドローダウン", v: `${m.mdd.toFixed(2)}%`, s: `${fmtDate(m.mddPeak.t)} → ${fmtDate(m.mddTrough.t)}`, tone: "down" },
        { k: "DD 回復", v: m.mddRecovery ? fmtDate(m.mddRecovery.t) : "未回復", s: m.mddRecovery ? "高値を回復済み" : "現在も水中" },
        { k: "ダウンサイド・ボラ", v: `${m.downsideVolAnnual.toFixed(2)}%`, s: "マイナス日だけを集計" },
        { k: "連勝 / 連敗", v: `${m.currentStreak > 0 ? `+${m.currentStreak}` : m.currentStreak} 日`, s: "直近の連続方向" },
        { k: "最大上昇日", v: `+$${fmtUsd(m.bestDay.pl, 0)}`, s: fmtDate(m.bestDay.t), tone: "up" },
        { k: "最大下落日", v: `−$${fmtUsd(Math.abs(m.worstDay.pl), 0)}`, s: fmtDate(m.worstDay.t), tone: "down" },
      ],
    },
    {
      title: "効率性 EFFICIENCY",
      items: [
        { k: "シャープレシオ", v: m.sharpe.toFixed(2), s: "rf = 0 仮定・年率換算", tone: "gold" },
        { k: "ソルティノレシオ", v: m.sortino.toFixed(2), s: "下落リスクのみで評価" },
        { k: "カルマーレシオ", v: m.calmar.toFixed(2), s: "CAGR ÷ |最大DD|" },
        { k: "勝率（日次）", v: `${m.winRate.toFixed(1)}%`, s: `${m.upDays}勝 ${m.downDays}敗 ${m.flatDays}分` },
        { k: "プロフィットファクター", v: Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "∞", s: "総利益 ÷ 総損失" },
        { k: "新高値更新回数", v: `${m.newHighCount}回`, s: "全期間のスナップショット" },
      ],
    },
  ];
  const toneCls = (t?: "up" | "down" | "gold") =>
    t === "up" ? "text-up-300" : t === "down" ? "text-down-300" : t === "gold" ? "text-gold-300" : "text-ink-50";
  return (
    <div ref={ref} className="reveal grid gap-5 lg:grid-cols-3">
      {groups.map((g) => (
        <div key={g.title} className="panel rounded-lg p-5">
          <p className="mb-4 border-b border-line pb-3 font-mono text-[11px] tracking-[0.24em] text-gold-500">{g.title}</p>
          <div className="space-y-4">
            {g.items.map((it) => (
              <div key={it.k} className="group flex items-baseline justify-between gap-3 border-b border-line-soft pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-[12px] text-dim transition-colors group-hover:text-fog">{it.k}</p>
                  {it.s && <p className="mt-0.5 font-mono text-[10px] text-faint">{it.s}</p>}
                </div>
                <p className={`num shrink-0 text-lg font-semibold ${toneCls(it.tone)}`}>{it.v}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================= Risk / drawdown ================= */
export function RiskSection({ m }: { m: Metrics }) {
  const ref = useReveal<HTMLDivElement>();
  const ddDays = Math.round((m.mddTrough.t - m.mddPeak.t) / 86400000);
  const recDays = m.mddRecovery ? Math.round((m.mddRecovery.t - m.mddTrough.t) / 86400000) : null;
  return (
    <div ref={ref} className="reveal grid gap-5 lg:grid-cols-[1.6fr_1fr]">
      <div className="panel rounded-lg p-5 md:p-6">
        <p className="mb-3 font-mono text-[11px] tracking-[0.22em] text-faint">UNDERWATER CURVE ── 水中曲線（高値からの乖離 %）</p>
        <DrawdownChart dd={m.drawdown} />
      </div>
      <div className="flex flex-col gap-4">
        {[
          { k: "ピーク", v: `$${fmtUsd(m.mddPeak.v, 0)}`, s: fmtDateTime(m.mddPeak.t) },
          { k: "ボトム", v: `$${fmtUsd(m.mddTrough.v, 0)}`, s: `${fmtDateTime(m.mddTrough.t)}（${ddDays} 日で下落）` },
          { k: "回復", v: m.mddRecovery ? fmtDate(m.mddRecovery.t) : "継続中", s: recDays != null ? `ボトムから ${recDays} 日` : "現在も高値未回復" },
        ].map((c) => (
          <div key={c.k} className="panel panel-hover flex-1 rounded-lg p-5">
            <p className="font-mono text-[10px] tracking-[0.24em] text-faint">{c.k}</p>
            <p className="num mt-2 text-2xl font-semibold text-ink-50">{c.v}</p>
            <p className="mt-1 font-mono text-[11px] text-dim">{c.s}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= Milestones ================= */
export function Milestones({ m }: { m: Metrics }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal">
      <div className="panel overflow-hidden rounded-lg">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[680px] border-collapse text-right font-mono text-[13px]">
            <thead>
              <tr className="border-b border-line bg-ink-850/70 text-[11px] tracking-widest text-faint">
                <th className="px-5 py-3 text-left font-medium">水準</th>
                <th className="px-5 py-3 font-medium">到達日</th>
                <th className="px-5 py-3 font-medium">開始からの日数</th>
                <th className="px-5 py-3 font-medium">ペース（開始→到達）</th>
                <th className="px-5 py-3 font-medium">状態</th>
              </tr>
            </thead>
            <tbody>
              {m.milestones.map((ms) => (
                <tr key={ms.level} className="border-b border-line-soft transition-colors hover:bg-ink-800/40">
                  <td className="px-5 py-3 text-left text-fog">${(ms.level / 1000).toFixed(0)}k</td>
                  <td className="px-5 py-3 text-ink-100">{ms.t ? fmtDate(ms.t) : "—"}</td>
                  <td className="px-5 py-3">{ms.days != null ? `Day ${ms.days}` : "—"}</td>
                  <td className="px-5 py-3 text-dim">
                    {ms.days != null ? `$${fmtUsd(ms.level / Math.max(1, ms.days), 0)}/日` : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {ms.t ? (
                      <span className="text-up-300">✓ 到達済み</span>
                    ) : (
                      <span className="text-gold-300">予測 {fmtDate(m.project70k.t)} 頃</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-b border-line-soft bg-gold-500/5 transition-colors hover:bg-ink-800/40">
                <td className="px-5 py-3 text-left text-gold-300">$100k</td>
                <td className="px-5 py-3 text-ink-100">—</td>
                <td className="px-5 py-3">—</td>
                <td className="px-5 py-3 text-dim">—</td>
                <td className="px-5 py-3 text-gold-300">予測 {fmtDate(m.project100k.t)} 頃</td>
              </tr>
              <tr className="transition-colors hover:bg-ink-800/40">
                <td className="px-5 py-3 text-left text-gold-300">資産 2 倍（${(m.startValue * 2 / 1000).toFixed(0)}k）</td>
                <td className="px-5 py-3 text-ink-100">—</td>
                <td className="px-5 py-3">—</td>
                <td className="px-5 py-3 text-dim">—</td>
                <td className="px-5 py-3 text-gold-300">予測 {fmtDate(m.projectDouble.t)} 頃</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 font-mono text-[10px] text-faint">※ 未到達水準は直近 90 日の日次平均増分からの線形予測。実際の到達を保証するものではありません。</p>
    </div>
  );
}

/* ================= Monthly ================= */
export function MonthlySection({ m }: { m: Metrics }) {
  const ref = useReveal<HTMLDivElement>();
  const bars = useMemo(
    () => m.months.map((mo, i) => ({ label: mo.label, pl: mo.pl, pct: mo.pct, partial: i === m.months.length - 1 })),
    [m]
  );
  return (
    <div ref={ref} className="reveal space-y-5">
      <div className="panel rounded-lg p-5 md:p-6">
        <p className="mb-3 font-mono text-[11px] tracking-[0.22em] text-faint">MONTHLY P&L ── 月次損益（$）</p>
        <MonthlyBars months={bars} />
      </div>
      <div className="panel overflow-hidden rounded-lg">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[640px] border-collapse text-right font-mono text-[13px]">
            <thead>
              <tr className="border-b border-line bg-ink-850/70 text-[11px] tracking-widest text-faint">
                <th className="px-5 py-3 text-left font-medium">月</th>
                <th className="px-5 py-3 font-medium">月末資産</th>
                <th className="px-5 py-3 font-medium">月間損益</th>
                <th className="px-5 py-3 font-medium">月間リターン</th>
                <th className="px-5 py-3 font-medium">累積リターン</th>
              </tr>
            </thead>
            <tbody>
              {[...m.months].reverse().map((mo) => (
                <tr key={mo.key} className="border-b border-line-soft transition-colors hover:bg-ink-800/40">
                  <td className="px-5 py-2.5 text-left text-fog">{mo.label}</td>
                  <td className="px-5 py-2.5 text-ink-100">${fmtUsd(mo.close)}</td>
                  <td className={`px-5 py-2.5 ${mo.pl >= 0 ? "text-up-300" : "text-down-300"}`}>
                    {mo.pl >= 0 ? "+" : "−"}${fmtUsd(Math.abs(mo.pl))}
                  </td>
                  <td className={`px-5 py-2.5 ${mo.pct >= 0 ? "text-up-300" : "text-down-300"}`}>
                    {mo.pct >= 0 ? "+" : ""}
                    {mo.pct.toFixed(2)}%
                  </td>
                  <td className="px-5 py-2.5 text-gold-300">+{mo.cumPct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================= Raw log ================= */
export function LogTable({ m, live }: { m: Metrics; live: LiveState }) {
  const ref = useReveal<HTMLDivElement>();
  const recent = useMemo(() => [...m.records].slice(-24).reverse(), [m]);
  const idxOf = (t: number) => m.records.findIndex((r) => r.t === t);
  return (
    <div ref={ref} className="reveal panel overflow-hidden rounded-lg">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-ink-850/70 px-5 py-4">
        <p className="font-mono text-[11px] tracking-[0.22em] text-faint">LATEST 24 SNAPSHOTS ── 最新ログ</p>
        <p className="font-mono text-[11px] text-faint">
          総計 {m.totalRows.toLocaleString()} 行 / 有効 <span className="text-fog">{(m.totalRows - m.naRows).toLocaleString()}</span> /{" "}
          <span className="text-down-400">#N/A 除外 {m.naRows}</span>
        </p>
        {live.added > 0 && (
          <p className="border border-up-600/40 bg-up-500/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-up-300">
            +{live.added} 行をシートから同期済み
          </p>
        )}
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-auto border border-line px-3 py-1.5 font-mono text-[11px] tracking-wider text-dim transition-all duration-300 hover:border-gold-500/60 hover:text-gold-300"
        >
          ソーススプレッドシート ↗
        </a>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[560px] border-collapse text-right font-mono text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] tracking-widest text-faint">
              <th className="px-5 py-2.5 text-left font-medium">#</th>
              <th className="px-5 py-2.5 text-left font-medium">日時</th>
              <th className="px-5 py-2.5 font-medium">資産額（USD）</th>
              <th className="px-5 py-2.5 font-medium">直前比</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r, i) => {
              const idx = idxOf(r.t);
              const prev = idx > 0 ? m.records[idx - 1] : null;
              const delta = prev ? r.v - prev.v : 0;
              return (
                <tr key={r.t} className="border-b border-line-soft transition-colors hover:bg-ink-800/40">
                  <td className="px-5 py-2.5 text-left text-faint">{m.records.length - i}</td>
                  <td className="px-5 py-2.5 text-left text-dim">{fmtDateTime(r.t)}</td>
                  <td className="px-5 py-2.5 text-ink-100">${fmtUsd(r.v)}</td>
                  <td className={`px-5 py-2.5 ${prev ? (delta >= 0 ? "text-up-300" : "text-down-300") : "text-faint"}`}>
                    {prev ? `${delta >= 0 ? "+" : "−"}$${fmtUsd(Math.abs(delta))}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line bg-ink-850/50 px-5 py-3 font-mono text-[10px] text-faint">
        自動更新: 起動時 ＋ 毎日 {live.nextFetchAt ? formatMyt(live.nextFetchAt) : "—"}（MYT）にシートを再取得。末尾に追記された行は自動マージされます。
      </div>
    </div>
  );
}

/* ================= Footer ================= */
export function Footer({ m }: { m: Metrics }) {
  return (
    <footer className="mt-16 border-t border-line bg-ink-900/70">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-4 py-8 font-mono text-[11px] text-faint md:flex-row md:items-center md:px-6">
        <p>
          ASSET LEDGER ── 全指標は <span className="text-dim">{m.records.length.toLocaleString()}</span> 件のスナップショットから自動計算。
          投資助言ではありません。
        </p>
        <p className="md:ml-auto">
          最終ログ <span className="text-dim">{fmtDateTime(m.latest.t)}</span> ・{" "}
          <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="text-gold-500 transition-colors hover:text-gold-300">
            source ↗
          </a>
        </p>
      </div>
    </footer>
  );
}
