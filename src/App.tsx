import { useMemo, useState } from "react";
import { parseLog } from "./data/logs";
import { useReveal } from "./lib/hooks";
import { computeMetrics } from "./lib/metrics";
import { formatMyt, useLiveData, type LiveState } from "./lib/liveFeed";
import { ChartSection, Footer, Hero, KpiGrid, LogTable, Milestones, MonthlySection, RiskSection, SectionHead, Ticker } from "./components/ledger";
import { TerminalView } from "./components/terminal";
import { MonteCarloSection, PortfolioSection, RiskLab, TearSheet } from "./components/analytics";
import { PureTab } from "./components/pureTab";

type Tab = "ledger" | "terminal" | "analytics" | "pure";

function LiveChip({ live }: { live: LiveState }) {
  const { status, nextFetchAt, latest, added, fetchedRows, refresh, flash } = live;
  const tone = status === "live" ? "up" : status === "stale" ? "gold" : status === "offline" ? "down" : "dim";
  const dotColor = tone === "up" ? "bg-up-400" : tone === "gold" ? "bg-gold-400" : tone === "down" ? "bg-down-400" : "bg-dim";
  const label = status === "live" ? "SYNCED" : status === "stale" ? "CACHED" : status === "offline" ? "OFFLINE" : "SYNC…";
  const colorCls = tone === "up" ? "text-up-300" : tone === "gold" ? "text-gold-300" : tone === "down" ? "text-down-300" : "text-dim";
  const borderCls =
    tone === "up" ? "border-up-600/40 bg-up-500/10" : tone === "gold" ? "border-gold-600/40 bg-gold-500/10" : tone === "down" ? "border-down-500/40 bg-down-500/10" : "border-line bg-ink-800/40";
  const detail =
    status === "live" && latest
      ? `${fetchedRows.toLocaleString()} rows${added > 0 ? ` (+${added})` : ""} ・ 最新 ${formatMyt(latest.t)} MYT`
      : status === "stale" && latest
        ? `キャッシュ ${fetchedRows.toLocaleString()} rows ・ 最新 ${formatMyt(latest.t)}`
        : nextFetchAt
          ? `次回 ${formatMyt(nextFetchAt)} MYT`
          : "—";
  return (
    <div
      className={`ml-auto flex items-center gap-2 self-center border px-2.5 py-1 transition-all duration-500 ${borderCls} ${
        flash ? "shadow-[0_0_18px_rgba(69,216,168,0.35)]" : ""
      }`}
    >
      <span className={`pulse-dot h-2 w-2 rounded-full ${dotColor}`} />
      <button onClick={refresh} title="今すぐシートを再取得" className={`font-mono text-[10px] tracking-[0.16em] ${colorCls} transition-opacity hover:opacity-75`}>
        {label}
      </button>
      <span className="hidden font-mono text-[9px] tracking-[0.1em] text-faint md:inline">{detail}</span>
    </div>
  );
}

function TabBar({ tab, setTab, live }: { tab: Tab; setTab: (t: Tab) => void; live: LiveState }) {
  const tabs: { id: Tab; label: string; sub: string }[] = [
    { id: "ledger", label: "ASSET LEDGER", sub: "資産形成ログ" },
    { id: "terminal", label: "QUANT TERMINAL", sub: "分析ターミナル" },
    { id: "analytics", label: "PORTFOLIO＋", sub: "構成×ティアシート" },
    { id: "pure", label: "PURE RETURN", sub: "純投資評価" },
  ];
  return (
    <div className="sticky top-0 z-50 border-b border-line bg-ink-950/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1240px] items-stretch gap-1 px-4 md:px-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`relative min-h-[52px] flex-1 px-2 text-left transition-colors duration-300 sm:flex-none sm:px-5 ${
              tab === t.id ? "text-ink-50" : "text-dim hover:text-ink-100"
            }`}
          >
            <span className="block font-display text-[12px] font-bold tracking-[0.12em] sm:text-[13px]">{t.label}</span>
            <span className="block font-mono text-[9px] tracking-[0.18em] text-faint">{t.sub}</span>
            <span
              className={`absolute inset-x-2 bottom-0 h-[2px] origin-left rounded-t transition-all duration-300 sm:inset-x-3 ${
                tab === t.id ? "scale-x-100 bg-gold-400" : "scale-x-0 bg-transparent"
              }`}
            />
          </button>
        ))}
        <LiveChip live={live} />
      </div>
    </div>
  );
}

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} id={id} className="reveal mx-auto max-w-[1240px] scroll-mt-24 px-4 py-8 md:px-6">
      {children}
    </div>
  );
}

export default function App() {
  const base = useMemo(() => parseLog(), []);
  const live = useLiveData(base);
  const m = useMemo(() => computeMetrics(live.parsed), [live.parsed]);
  const [tab, setTab] = useState<Tab>("ledger");

  return (
    <div className="relative min-h-screen">
      <div className="bg-stage" aria-hidden />
      <div className="bg-grid" aria-hidden />
      <div className="bg-noise" aria-hidden />
      <div className="bg-scan" aria-hidden />

      <Ticker m={m} />
      <TabBar tab={tab} setTab={setTab} live={live} />

      {tab === "ledger" && (
        <>
          <Hero m={m} />
          <Section id="chart">
            <SectionHead no="01" en="GROWTH CURVE" jp="資産カーブ" desc="全期間のスナップショットを描画。期間レンジの切替とホバーで、任意時点の資産額と直前比を検査できます。下部は日次損益バー。" />
            <ChartSection m={m} />
          </Section>
          <Section id="metrics">
            <SectionHead no="02" en="WEALTH INDICATORS" jp="資産形成インジケーター" desc="収益性・リスク・効率性の 3 グループ、20 の指標をログから全自動計算。" />
            <KpiGrid m={m} />
          </Section>
          <Section id="risk">
            <SectionHead no="03" en="DRAWDOWN" jp="ドローダウン分析" desc="高値からどれだけ沈み、何日で回復したか。水中曲線とピーク/ボトム/回復の 3 点。" />
            <RiskSection m={m} />
          </Section>
          <Section id="milestones">
            <SectionHead no="04" en="MILESTONES" jp="マイルストーンと到達予測" desc="$5k 刻みの資産水準をいつ突破したか、そのペースと、次の目標の到達予測日。" />
            <Milestones m={m} />
          </Section>
          <Section id="monthly">
            <SectionHead no="05" en="MONTHLY REPORT" jp="月次レポート" desc="毎月の月末資産・月間損益・累積リターン。ベスト月とワースト月もハイライト。" />
            <MonthlySection m={m} />
          </Section>
          <Section id="log">
            <SectionHead no="06" en="RAW LOG" jp="生ログ" desc="直近 24 スナップショットを原文のまま掲載。起動時＋毎日 MYT 16:00 にシートを再取得し、末尾追加分を自動マージします。" />
            <LogTable m={m} live={live} />
          </Section>
          <Footer m={m} />
        </>
      )}

      {tab === "terminal" && <TerminalView m={m} />}

      {tab === "analytics" && (
        <>
          <Section id="portfolio">
            <SectionHead no="01" en="PORTFOLIO" jp="ポートフォリオ構成" desc="総資産 $65,188.27 ・ 50 銘柄超。テーマ別アロケーション、集中度（HHI / 実効保有数）、カテゴリ構成、全保有の一覧。" />
            <PortfolioSection />
          </Section>
          <Section id="tearsheet">
            <SectionHead no="02" en="QUANT TEAR SHEET" jp="クオンツ・ティアシート" desc="リターン / リスク / リスク調整後効率 / トレード統計の 30 指標＋月次ヒートマップ＋年次リターン。" />
            <TearSheet m={m} />
          </Section>
          <Section id="risklab">
            <SectionHead no="03" en="RISK LAB" jp="リスクラボ" desc="ローリング・シャーペとボラティリティ、日次リターン分布（正規フィット）、主要ドローダウン・エピソード。" />
            <RiskLab m={m} />
          </Section>
          <Section id="forecast">
            <SectionHead no="04" en="MONTE CARLO" jp="モンテカルロ将来シミュレーション" desc="観測リターン分布から 2,000 本の 1 年パスを生成。パーセンタイル帯とテール確率で将来のバラつきを可視化。" />
            <MonteCarloSection m={m} />
          </Section>
          <Footer m={m} />
        </>
      )}

      {tab === "pure" && <PureTab m={m} />}
    </div>
  );
}
