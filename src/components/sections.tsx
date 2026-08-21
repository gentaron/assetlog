import { useMemo } from "react";
import { SOURCE_URL } from "../data/logs";
import { useCountUp, useReveal } from "../lib/hooks";
import {
  fmtDate,
  fmtDateTime,
  fmtPct,
  fmtSignedUsd,
  fmtUsd,
  type Metrics,
} from "../lib/metrics";
import { DrawdownChart, MainChart, Sparkline } from "./charts";

/* ================= Section head ================= */
export function SectionHead({ no, en, jp, desc }: { no: string; en: string; jp: string; desc: string }) {
  return (
    <div className="mb-8 md:mb-10">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm font-semibold tracking-widest text-gold-500">{no}</span>
        <h2 className="font-display text-2xl font-bold tracking-tight text-fog md:text-4xl">{en}</h2>
      </div>
      <p className="mt-2 text-sm text-dim md:text-base">
        <span className="font-semibold text-fog">{jp}</span>
        <span className="mx-2 text-faint">──</span>
        {desc}
      </p>
      <div className="mt-4 h-px w-full bg-gradient-to-r from-gold-500/60 via-line to-transparent" />
    </div>
  );
}

/* ================= Ticker tape ================= */
export function Ticker({ m }: { m: Metrics }) {
  const items = useMemo(() => {
    const base = [
      { k: "CAGR", v: fmtPct(m.cagr, 1), up: m.cagr >= 0 },
      { k: "MAX DD", v: fmtPct(m.mdd, 2), up: false },
      { k: "SHARPE", v: m.sharpe.toFixed(2), up: true },
      { k: "WIN RATE", v: fmtPct(m.winRate, 1, false), up: true },
      { k: "AVG/DAY", v: fmtSignedUsd(m.avgDaily, 0), up: m.avgDaily >= 0 },
    ];
    const monthly = m.months.map((mo) => ({ k: mo.label, v: fmtPct(mo.pct, 1), up: mo.pl >= 0 }));
    return [...base, ...monthly];
  }, [m]);

  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((it, i) => (
        <span key={i} className="flex items-center whitespace-nowrap font-mono text-[11px] tracking-wider">
          <span className="px-3 text-faint">{it.k}</span>
          <span className={it.up ? "text-up-400" : "text-down-400"}>{it.v}</span>
          <span className="pl-3 text-ink-600">◆</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden border-b border-line-soft bg-ink-900/80 py-2">
      <div className="ticker-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

/* ================= Header / nav ================= */
const NAV = [
  { href: "#overview", label: "Overview" },
  { href: "#chart", label: "Chart" },
  { href: "#metrics", label: "Indicators" },
  { href: "#risk", label: "Risk" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#quant", label: "TearSheet" },
  { href: "#risklab", label: "RiskLab" },
  { href: "#forecast", label: "Forecast" },
  { href: "#milestones", label: "Milestones" },
  { href: "#monthly", label: "Monthly" },
  { href: "#log", label: "Raw Log" },
];

export function Header({ m }: { m: Metrics }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-4 py-3 md:px-6">
        <a href="#overview" className="group flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center border border-gold-500/70 font-display text-sm font-bold text-gold-400 transition-shadow duration-300 group-hover:shadow-[0_0_16px_rgba(233,180,76,0.35)]">
            A/L
          </span>
          <span className="leading-tight">
            <span className="block font-display text-sm font-bold tracking-[0.18em] text-fog">ASSET LEDGER</span>
            <span className="block text-[11px] text-dim">資産形成ログ・ダッシュボード</span>
          </span>
        </a>
        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-sm px-3 py-1.5 font-mono text-xs tracking-wider text-dim transition-colors duration-200 hover:bg-ink-700 hover:text-gold-300"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 border border-up-600/40 bg-up-500/10 px-3 py-1.5 lg:ml-4">
          <span className="pulse-dot h-2 w-2 rounded-full bg-up-400" />
          <span className="font-mono text-[11px] tracking-wider text-up-300">
            最新 {fmtDateTime(m.latest.t)}
          </span>
        </div>
      </div>
    </header>
  );
}

/* ================= Hero / quote board ================= */
export function Hero({ m }: { m: Metrics }) {
  const big = useCountUp(m.latestValue, 1600, 2);
  const ref = useReveal<HTMLDivElement>();
  const lastDailyPl = m.daily[m.daily.length - 1].pl;

  return (
    <section id="overview" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 pb-14 pt-8 md:px-6 md:pt-12">
      <div ref={ref} className="reveal grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        {/* left: quote */}
        <div className="corner-frame panel relative overflow-hidden rounded-lg p-6 md:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold-500/8 blur-3xl" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="border border-gold-500/50 bg-gold-500/10 px-2 py-0.5 font-mono text-[10px] tracking-[0.22em] text-gold-300">
              TOTAL ASSET VALUE
            </span>
            <span className="font-mono text-[11px] tracking-wider text-faint">USD / ログ自動収集</span>
            {m.isAllTimeHigh && (
              <span className="ml-auto border border-up-600/50 bg-up-500/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-up-300">
                ▲ 史上最高値を更新中
              </span>
            )}
          </div>

          <p className="mt-5 font-mono text-[44px] font-semibold leading-none tracking-tight text-fog tabular sm:text-6xl xl:text-[72px]">
            <span className="text-gold-400">$</span>
            {big}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className={`font-mono text-base font-semibold tabular md:text-lg ${m.gain >= 0 ? "text-up-400" : "text-down-400"}`}>
              {fmtSignedUsd(m.gain)}（{fmtPct(m.totalReturn)}）
            </span>
            <span className="font-mono text-xs text-faint">
              運用開始 {fmtDate(m.start.t)} 比 / 直近1日 {fmtSignedUsd(lastDailyPl)}
            </span>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line-soft bg-line-soft sm:grid-cols-4">
            {[
              { k: "運用日数", v: `${m.days.toLocaleString()}日`, s: `${m.years.toFixed(2)}年` },
              { k: "ログ件数", v: `${(m.totalRows - m.naRows).toLocaleString()}件`, s: `#N/A 除外 ${m.naRows}件` },
              { k: "新高値更新", v: `${m.newHighCount.toLocaleString()}回`, s: "観測史上" },
              { k: "平均スナップショット", v: `${(m.records.length / m.days).toFixed(1)}回/日`, s: "約12時間間隔" },
            ].map((it) => (
              <div key={it.k} className="bg-ink-850/90 px-4 py-3 transition-colors duration-300 hover:bg-ink-800">
                <p className="text-[10px] tracking-widest text-faint">{it.k}</p>
                <p className="mt-1 font-mono text-lg font-semibold text-fog tabular">{it.v}</p>
                <p className="font-mono text-[10px] text-faint">{it.s}</p>
              </div>
            ))}
          </div>
        </div>

        {/* right: sparkline panel */}
        <div className="panel flex flex-col rounded-lg p-5 md:p-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] tracking-[0.22em] text-faint">FULL-PERIOD CURVE</p>
            <p className="font-mono text-[11px] text-faint">
              {fmtDate(m.start.t)} ─ {fmtDate(m.latest.t)}
            </p>
          </div>
          <div className="relative mt-4 flex-1 min-h-[190px]">
            <Sparkline records={m.records} />
            <div className="pointer-events-none absolute left-1 top-0 font-mono text-[10px] text-faint">
              high {fmtUsd(Math.max(...m.records.map((r) => r.v)), 0)}
            </div>
            <div className="pointer-events-none absolute bottom-0 left-1 font-mono text-[10px] text-faint">
              low {fmtUsd(Math.min(...m.records.map((r) => r.v)), 0)}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line-soft pt-4">
            {[
              { k: "CAGR", v: fmtPct(m.cagr, 1), c: "text-gold-300" },
              { k: "MAX DD", v: fmtPct(m.mdd, 2), c: "text-down-400" },
              { k: "SHARPE", v: m.sharpe.toFixed(2), c: "text-up-400" },
            ].map((it) => (
              <div key={it.k} className="text-center">
                <p className="font-mono text-[10px] tracking-widest text-faint">{it.k}</p>
                <p className={`font-mono text-xl font-semibold tabular ${it.c}`}>{it.v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* quick strip */}
      <div ref={useReveal()} className="reveal mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line-soft bg-line-soft md:grid-cols-5" style={{ transitionDelay: "120ms" }}>
        {[
          { k: "年平均リターン CAGR", v: fmtPct(m.cagr, 1), s: "複利換算" },
          { k: "平均日次増加", v: fmtSignedUsd(m.avgDaily, 0), s: `$${Math.round(m.avgMonthly).toLocaleString()}/月 換算` },
          { k: "最大ドローダウン", v: fmtPct(m.mdd, 2), s: fmtDate(m.mddTrough.t) },
          { k: "勝率（日次）", v: fmtPct(m.winRate, 1, false), s: `+${m.upDays}日 / −${m.downDays}日` },
          { k: "1年後の推計資産", v: fmtUsd(m.projected1y, 0), s: "CAGR 維持と仮定" },
        ].map((it) => (
          <div key={it.k} className="group bg-ink-900/95 px-4 py-4 transition-colors duration-300 hover:bg-ink-800">
            <p className="text-[10px] tracking-widest text-faint">{it.k}</p>
            <p className="mt-1.5 font-mono text-xl font-semibold text-fog tabular transition-colors duration-300 group-hover:text-gold-300 md:text-2xl">
              {it.v}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-faint">{it.s}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ================= KPI grid ================= */
interface Kpi {
  label: string;
  value: string;
  sub: string;
  tone?: "up" | "down" | "gold" | "plain";
}

function buildKpis(m: Metrics): { group: string; en: string; items: Kpi[] }[] {
  const ddRecoverDays = m.mddRecovery ? Math.round((m.mddRecovery.t - m.mddTrough.t) / 86_400_000) : null;
  return [
    {
      group: "収益性",
      en: "RETURN",
      items: [
        { label: "総リターン", value: fmtPct(m.totalReturn), sub: fmtSignedUsd(m.gain), tone: "up" },
        { label: "年率リターン CAGR", value: fmtPct(m.cagr, 1), sub: `${m.years.toFixed(2)}年・複利換算`, tone: "gold" },
        { label: "平均月次損益", value: fmtSignedUsd(m.avgMonthly, 0), sub: `平均日次 ${fmtSignedUsd(m.avgDaily, 0)}`, tone: m.avgMonthly >= 0 ? "up" : "down" },
        { label: "ベスト月", value: fmtPct(m.bestMonth.pct, 1), sub: `${m.bestMonth.label} / ${fmtSignedUsd(m.bestMonth.pl, 0)}`, tone: "up" },
        { label: "ワースト月", value: fmtPct(m.worstMonth.pct, 1), sub: `${m.worstMonth.label} / ${fmtSignedUsd(m.worstMonth.pl, 0)}`, tone: "down" },
        { label: "ベスト・デイ", value: fmtPct(m.bestDay.pct, 1), sub: fmtDate(m.bestDay.t), tone: "up" },
        { label: "ワースト・デイ", value: fmtPct(m.worstDay.pct, 1), sub: fmtDate(m.worstDay.t), tone: "down" },
        { label: "プラス月 / マイナス月", value: `${m.positiveMonths} / ${m.negativeMonths}`, sub: `月次勝率 ${((m.positiveMonths / m.months.length) * 100).toFixed(0)}%`, tone: "gold" },
      ],
    },
    {
      group: "リスク",
      en: "RISK",
      items: [
        { label: "年率ボラティリティ", value: fmtPct(m.volAnnual, 1, false), sub: "日次収益率×√365", tone: "plain" },
        { label: "ダウンサイド・ボラ", value: fmtPct(m.downsideVolAnnual, 1, false), sub: "マイナス日だけの変動", tone: "plain" },
        { label: "最大ドローダウン", value: fmtPct(m.mdd, 2), sub: `${fmtDate(m.mddPeak.t)} → ${fmtDate(m.mddTrough.t)}`, tone: "down" },
        { label: "DD回復日数", value: ddRecoverDays !== null ? `${ddRecoverDays}日` : "回復中", sub: ddRecoverDays !== null ? `底値 → 前高値回復` : "前高値を未回復", tone: "plain" },
        { label: "上昇日 / 下落日", value: `${m.upDays} / ${m.downDays}`, sub: `横ばい ${m.flatDays}日`, tone: "plain" },
        { label: "直近ストリーク", value: m.currentStreak >= 0 ? `+${m.currentStreak}日` : `${m.currentStreak}日`, sub: m.currentStreak >= 0 ? "連続プラス（前日比）" : "連続マイナス（前日比）", tone: m.currentStreak >= 0 ? "up" : "down" },
      ],
    },
    {
      group: "効率性",
      en: "RISK-ADJUSTED",
      items: [
        { label: "シャープレシオ", value: m.sharpe.toFixed(2), sub: "無リスク金利 4% 想定", tone: "gold" },
        { label: "ソルティノレシオ", value: m.sortino.toFixed(2), sub: "下方リスク基準", tone: "gold" },
        { label: "カルマーレシオ", value: m.calmar.toFixed(2), sub: "CAGR ÷ 最大DD", tone: "gold" },
        { label: "日次勝率", value: fmtPct(m.winRate, 1, false), sub: "前日比プラスの割合", tone: "up" },
        { label: "プロフィットファクター", value: isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "∞", sub: "総利益 ÷ 総損失", tone: "up" },
        { label: "1年後の推計", value: fmtUsd(m.projected1y, 0), sub: "CAGR 一定と仮定", tone: "gold" },
      ],
    },
  ];
}

export function KpiGrid({ m }: { m: Metrics }) {
  const ref = useReveal<HTMLDivElement>();
  const groups = useMemo(() => buildKpis(m), [m]);
  const toneClass: Record<string, string> = {
    up: "text-up-400",
    down: "text-down-400",
    gold: "text-gold-300",
    plain: "text-fog",
  };

  return (
    <div ref={ref} className="reveal space-y-10">
      {groups.map((g) => (
        <div key={g.en}>
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-6 bg-gold-500/70" />
            <h3 className="font-display text-sm font-bold tracking-[0.24em] text-dim">
              {g.en}
              <span className="ml-2 font-body text-xs font-medium tracking-normal text-faint">{g.group}指标</span>
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {g.items.map((it) => (
              <div key={it.label} className="panel panel-hover rounded-md p-4">
                <p className="text-[11px] tracking-wider text-faint">{it.label}</p>
                <p className={`mt-2 font-mono text-[22px] font-semibold leading-none tabular md:text-[26px] ${toneClass[it.tone ?? "plain"]}`}>
                  {it.value}
                </p>
                <p className="mt-2 font-mono text-[10.5px] leading-snug text-faint">{it.sub}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================= Risk section (drawdown) ================= */
export function RiskSection({ m }: { m: Metrics }) {
  const ref = useReveal<HTMLDivElement>();
  const recoverDays = m.mddRecovery ? Math.round((m.mddRecovery.t - m.mddTrough.t) / 86_400_000) : null;
  const underwaterDays = m.mddRecovery
    ? Math.round((m.mddRecovery.t - m.mddPeak.t) / 86_400_000)
    : Math.round((m.latest.t - m.mddPeak.t) / 86_400_000);

  return (
    <div ref={ref} className="reveal grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="panel rounded-lg p-5 md:p-6">
        <p className="mb-3 font-mono text-[11px] tracking-[0.22em] text-faint">UNDERWATER CURVE ── 水中曲線（高値からの下落率）</p>
        <DrawdownChart m={m} />
      </div>
      <div className="flex flex-col gap-3">
        {[
          { k: "最大ドローダウン", v: fmtPct(m.mdd, 2), s: "観測期間中の最大下落幅", tone: "text-down-400" },
          { k: "ピーク（高値）", v: fmtDate(m.mddPeak.t), s: fmtUsd(m.mddPeak.v), tone: "text-fog" },
          { k: "ボトム（底値）", v: fmtDate(m.mddTrough.t), s: fmtUsd(m.mddTrough.v), tone: "text-fog" },
          { k: "回復完了", v: m.mddRecovery ? fmtDate(m.mddRecovery.t) : "─", s: recoverDays !== null ? `底値から${recoverDays}日で回復` : "前高値を回復中", tone: "text-up-400" },
          { k: "水中期間", v: `${underwaterDays}日`, s: "高値更新まで沈んでいた期間", tone: "text-gold-300" },
        ].map((it) => (
          <div key={it.k} className="panel panel-hover rounded-md px-4 py-3">
            <p className="text-[10px] tracking-widest text-faint">{it.k}</p>
            <p className={`mt-1 font-mono text-lg font-semibold tabular ${it.tone}`}>{it.v}</p>
            <p className="font-mono text-[10.5px] text-faint">{it.s}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
