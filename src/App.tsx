import { useMemo } from "react";
import { MainChart } from "./components/charts";
import { PortfolioSection } from "./components/portfolio";
import { Header, Hero, KpiGrid, RiskSection, SectionHead, Ticker } from "./components/sections";
import { Footer, LogTable, Milestones, MonthlySection } from "./components/sections2";
import { MonteCarloSection, RiskLab, TearSheet } from "./components/tearsheet";
import { useReveal } from "./lib/hooks";
import { computeMetrics } from "./lib/metrics";

function ChartSection({ m }: { m: ReturnType<typeof computeMetrics> }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal panel rounded-lg p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] tracking-[0.22em] text-faint">ASSET CURVE ── total asset progression (all snapshots)</p>
        <p className="font-mono text-[11px] text-faint">
          low <span className="text-down-300">${Math.min(...m.records.map((r) => r.v)).toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
          {" → "}high <span className="text-up-300">${Math.max(...m.records.map((r) => r.v)).toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
        </p>
      </div>
      <MainChart records={m.records} daily={m.daily} />
    </div>
  );
}

export default function App() {
  const m = useMemo(() => computeMetrics(), []);

  return (
    <div className="relative min-h-screen">
      {/* ambient background */}
      <div className="bg-stage" aria-hidden />
      <div className="bg-grid" aria-hidden />
      <div className="bg-noise" aria-hidden />
      <div className="bg-scan" aria-hidden />

      <Ticker m={m} />
      <Header m={m} />

      <main>
        <Hero m={m} />

        <section id="chart" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 py-10 md:px-6">
          <SectionHead
            no="01"
            en="GROWTH CURVE"
            jp="資産カーブ"
            desc="全期間のスナップショットを描画。期間レンジの切替とホバーで、任意時点の資産額と直前比の増減を検査できます。"
          />
          <ChartSection m={m} />
        </section>

        <section id="metrics" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 py-10 md:px-6">
          <SectionHead
            no="02"
            en="WEALTH INDICATORS"
            jp="資産形成インジケーター"
            desc="収益性・リスク・リスク調整後効率の3グループ、20の指標をログから全自動計算。"
          />
          <KpiGrid m={m} />
        </section>

        <section id="risk" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 py-10 md:px-6">
          <SectionHead
            no="03"
            en="DRAWDOWN ANALYSIS"
            jp="ドローダウン分析"
            desc="高値からどれだけ沈み、何日で水面に戻ったか。資産の耐久力を測る水中曲線。"
          />
          <RiskSection m={m} />
        </section>

        <section id="portfolio" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 py-10 md:px-6">
          <SectionHead
            no="04"
            en="PORTFOLIO"
            jp="ポートフォリオ構成"
            desc="総資産 $65,188.27 ・ 90 銘柄超。テーマ別アロケーション、集中度（HHI/実効保有数）、カテゴリ構成、全保有の一覧。"
          />
          <PortfolioSection />
        </section>

        <section id="quant" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 py-10 md:px-6">
          <SectionHead
            no="05"
            en="QUANT TEAR SHEET"
            jp="クオンツ・ティアシート"
            desc="プロ機関級の全指標バッチ。リターン・リスク・リスク調整後効率・トレード統計の 32 指標＋月次ヒートマップ＋年次リターン。"
          />
          <TearSheet m={m} />
        </section>

        <section id="risklab" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 py-10 md:px-6">
          <SectionHead
            no="06"
            en="RISK LAB"
            jp="リスクラボ"
            desc="ローリング・シャープレシオとボラティリティの時系列、日次リターン分布（正規分布フィット）、主要ドローダウン・エピソード。"
          />
          <RiskLab m={m} />
        </section>

        <section id="forecast" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 py-10 md:px-6">
          <SectionHead
            no="07"
            en="MONTE CARLO FORECAST"
            jp="モンテカルロ将来シミュレーション"
            desc="観測リターン分布から 2,000 本の 1 年パスを生成。パーセンタイル帯とテール確率で将来のバラつきを可視化。"
          />
          <MonteCarloSection m={m} />
        </section>

        <section id="milestones" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 py-10 md:px-6">
          <SectionHead
            no="08"
            en="MILESTONES"
            jp="マイルストーンと到達予測"
            desc="$5k刻みの資産水準をいつ突破したか、そのペースと、次の目標の到達予測日。"
          />
          <Milestones m={m} />
        </section>

        <section id="monthly" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 py-10 md:px-6">
          <SectionHead
            no="09"
            en="MONTHLY REPORT"
            jp="月次レポート"
            desc="毎月の月末資産・月間損益・開始来の累積リターンを一覧化。ベスト月とワースト月もハイライト。"
          />
          <MonthlySection m={m} />
        </section>

        <section id="log" className="mx-auto max-w-[1240px] scroll-mt-24 px-4 py-10 md:px-6">
          <SectionHead
            no="10"
            en="RAW LOG"
            jp="生ログ"
            desc="直近に収集されたスナップショットを原文のまま掲載。ソースシートへのリンクも。"
          />
          <LogTable m={m} />
        </section>
      </main>

      <Footer m={m} />
    </div>
  );
}
