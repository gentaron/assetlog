import { useMemo } from "react";
import { SOURCE_URL } from "../data/logs";
import { useReveal } from "../lib/hooks";
import { fmtDate, fmtDateTime, fmtPct, fmtSignedUsd, fmtUsd, type Metrics } from "../lib/metrics";
import { MonthlyBars } from "./charts";

/* ================= Milestones ================= */
export function Milestones({ m }: { m: Metrics }) {
  const ref = useReveal<HTMLDivElement>();
  const achieved = m.milestones.filter((ms) => ms.t !== null);
  const upcoming = m.milestones.filter((ms) => ms.t === null);

  const projections = [
    ...upcoming.map((ms) => ({
      label: ms.label,
      amount: ms.target,
      date: m.project70k.t,
      method: "average daily pace",
    })),
    { label: "2× (doubling)", amount: m.startValue * 2, date: m.projectDouble.t, method: m.projectDouble.method },
    { label: "$100k", amount: 100000, date: m.project100k.t, method: m.project100k.method },
  ];

  return (
    <div ref={ref} className="reveal grid gap-5 lg:grid-cols-[1fr_340px]">
      {/* achieved timeline */}
      <div className="panel rounded-lg p-5 md:p-7">
        <p className="mb-6 font-mono text-[11px] tracking-[0.22em] text-faint">ACHIEVED ── achieved asset milestones</p>
        <div className="relative ml-2">
          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-gold-500/70 via-line to-line" />
          <div className="space-y-7">
            {achieved.map((ms, i) => {
              const prev = i > 0 ? achieved[i - 1] : null;
              const interval = prev && ms.days !== null && prev.days !== null ? ms.days - prev.days : ms.days;
              return (
                <div key={ms.label} className="group relative flex flex-wrap items-baseline gap-x-4 gap-y-1 pl-8 transition-transform duration-300 hover:translate-x-1">
                  <span className="absolute left-0 top-1.5 h-[15px] w-[15px] rotate-45 border-2 border-gold-500 bg-ink-900 transition-colors duration-300 group-hover:bg-gold-500/40" />
                  <span className="font-display text-2xl font-bold tracking-tight text-gold-300 md:text-3xl">{ms.label}</span>
                  <span className="font-mono text-sm text-fog tabular">{ms.t !== null ? fmtDateTime(ms.t) : ""}</span>
                  <span className="border border-line bg-ink-800 px-2 py-0.5 font-mono text-[11px] text-dim">
                    Day {ms.days?.toLocaleString()}
                  </span>
                  {i > 0 && (
                    <span className="font-mono text-[11px] text-up-400">
                      ▲ +{interval} day{i === 1 ? "" : "s"} pace
                    </span>
                  )}
                </div>
              );
            })}
            {/* projected next node */}
            <div className="relative flex flex-wrap items-baseline gap-x-4 gap-y-1 pl-8 opacity-80">
              <span className="absolute left-0 top-1.5 h-[15px] w-[15px] rotate-45 border-2 border-dashed border-faint bg-ink-900" />
              <span className="font-display text-2xl font-bold tracking-tight text-dim">NEXT →</span>
              <span className="font-mono text-sm text-faint">
                next milestone {fmtDate(projections[0].date)} forecast (average daily pace)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* projections */}
      <div className="flex flex-col gap-3">
        <div className="panel rounded-lg p-5">
          <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-faint">PROJECTION ── this pace's forecast</p>
          <div className="space-y-4">
            {projections.map((p) => (
              <div key={p.label} className="border-l-2 border-dashed border-gold-600/50 pl-3 transition-colors duration-300 hover:border-gold-400">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display text-base font-bold text-fog">
                    {p.label}
                    <span className="ml-2 font-mono text-[11px] font-normal text-faint">{fmtUsd(p.amount, 0)}</span>
                  </p>
                  <p className="font-mono text-sm font-semibold text-gold-300 tabular">{fmtDate(p.date)}</p>
                </div>
                <p className="mt-0.5 font-mono text-[10.5px] text-faint">{p.method} / {fmtUsd(m.latestValue, 0)} from present</p>
              </div>
            ))}
          </div>
        </div>
        <div className="panel panel-hover rounded-lg p-5">
          <p className="font-mono text-[11px] tracking-[0.22em] text-faint">1-YEAR PROJECTION</p>
          <p className="mt-2 font-mono text-3xl font-semibold text-up-400 tabular">{fmtUsd(m.projected1y, 0)}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-faint">
            If CAGR {fmtPct(m.cagr, 1)} is maintained for 1 more year.
            <br />
            Equivalent to {fmtSignedUsd(m.projected1y - m.latestValue, 0)} additional growth.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================= Monthly ================= */
export function MonthlySection({ m }: { m: Metrics }) {
  const ref = useReveal<HTMLDivElement>();
  const maxAbs = useMemo(() => Math.max(...m.months.map((mo) => Math.abs(mo.pl)), 1), [m]);
  const totalPl = m.months.reduce((a, b) => a + b.pl, 0);
  const avgPct = m.months.reduce((a, b) => a + b.pct, 0) / m.months.length;

  return (
    <div ref={ref} className="reveal space-y-5">
      <div className="panel rounded-lg p-5 md:p-6">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="font-mono text-[11px] tracking-[0.22em] text-faint">MONTHLY P/L ── monthly profit & loss</p>
          <p className="font-mono text-[11px] text-faint">
            best <span className="text-up-400">{m.bestMonth.label} {fmtPct(m.bestMonth.pct, 1)}</span> / worst{" "}
            <span className="text-down-400">{m.worstMonth.label} {fmtPct(m.worstMonth.pct, 1)}</span>
          </p>
        </div>
        <MonthlyBars m={m} />
      </div>

      <div className="panel overflow-hidden rounded-lg">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full min-w-[720px] border-collapse text-right font-mono text-[13px]">
            <thead>
              <tr className="border-b border-line bg-ink-850/80 text-[11px] tracking-widest text-faint">
                <th className="px-4 py-3 text-left font-medium">month</th>
                <th className="px-4 py-3 font-medium">month-end assets</th>
                <th className="px-4 py-3 font-medium">monthly P&L</th>
                <th className="px-4 py-3 font-medium">monthly return</th>
                <th className="px-4 py-3 font-medium">cumulative return</th>
                <th className="w-[180px] px-4 py-3 text-left font-medium">trend</th>
              </tr>
            </thead>
            <tbody>
              {m.months.map((mo) => {
                const up = mo.pl >= 0;
                const isBest = mo.key === m.bestMonth.key;
                const isWorst = mo.key === m.worstMonth.key;
                return (
                  <tr
                    key={mo.key}
                    className={`border-b border-line-soft transition-colors duration-200 hover:bg-ink-800/70 ${
                      isBest ? "bg-up-500/[0.06]" : isWorst ? "bg-down-500/[0.06]" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 text-left text-fog">
                      {mo.label}
                      {mo.partial && <span className="ml-2 border border-gold-600/50 px-1.5 py-0.5 text-[9px] tracking-widest text-gold-400">in progress</span>}
                      {isBest && <span className="ml-2 text-[9px] tracking-widest text-up-400">BEST</span>}
                      {isWorst && <span className="ml-2 text-[9px] tracking-widest text-down-400">WORST</span>}
                    </td>
                    <td className="px-4 py-2.5 text-fog tabular">{fmtUsd(mo.close)}</td>
                    <td className={`px-4 py-2.5 tabular ${up ? "text-up-400" : "text-down-400"}`}>{fmtSignedUsd(mo.pl)}</td>
                    <td className={`px-4 py-2.5 tabular ${up ? "text-up-400" : "text-down-400"}`}>{fmtPct(mo.pct)}</td>
                    <td className="px-4 py-2.5 text-gold-300 tabular">{fmtPct(mo.cumPct)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex h-2.5 w-full items-center overflow-hidden rounded-sm bg-ink-700/60">
                        <div
                          className={`h-full ${up ? "bg-up-500" : "bg-down-500"}`}
                          style={{ width: `${Math.max(2, (Math.abs(mo.pl) / maxAbs) * 100)}%`, marginLeft: up ? 0 : "auto" }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-ink-850/90 font-semibold">
                <td className="px-4 py-3 text-left text-dim">total / average</td>
                <td className="px-4 py-3 text-fog tabular">{fmtUsd(m.latestValue)}</td>
                <td className="px-4 py-3 text-up-400 tabular">{fmtSignedUsd(totalPl)}</td>
                <td className="px-4 py-3 text-dim tabular">{fmtPct(avgPct)} avg</td>
                <td className="px-4 py-3 text-gold-300 tabular">{fmtPct(m.totalReturn)}</td>
                <td className="px-4 py-3 text-left text-[10px] text-faint">since start</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================= Raw log ================= */
export function LogTable({ m }: { m: Metrics }) {
  const ref = useReveal<HTMLDivElement>();
  const recent = useMemo(() => [...m.records].slice(-24).reverse(), [m]);
  const idxOf = (t: number) => m.records.findIndex((r) => r.t === t);

  return (
    <div ref={ref} className="reveal panel overflow-hidden rounded-lg">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-ink-850/70 px-5 py-4">
        <p className="font-mono text-[11px] tracking-[0.22em] text-faint">LATEST 24 SNAPSHOTS ── latest log</p>
        <p className="font-mono text-[11px] text-faint">
          total {m.totalRows.toLocaleString()} rows / valid <span className="text-fog">{(m.totalRows - m.naRows).toLocaleString()}</span> /{" "}
          <span className="text-down-400">#N/A excluded {m.naRows}</span>
        </p>
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-auto border border-line px-3 py-1.5 font-mono text-[11px] tracking-wider text-dim transition-all duration-300 hover:border-gold-500/60 hover:text-gold-300"
        >
          source spreadsheet ↗
        </a>
      </div>
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full min-w-[560px] border-collapse text-right font-mono text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] tracking-widest text-faint">
              <th className="px-5 py-2.5 text-left font-medium">#</th>
              <th className="px-5 py-2.5 text-left font-medium">date/time</th>
              <th className="px-5 py-2.5 font-medium">assets (USD)</th>
              <th className="px-5 py-2.5 font-medium">change from previous</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => {
              const i = idxOf(r.t);
              const prev = i > 0 ? m.records[i - 1] : null;
              const d = prev ? r.v - prev.v : 0;
              return (
                <tr key={r.t} className="border-b border-line-soft transition-colors duration-200 hover:bg-ink-800/70">
                  <td className="px-5 py-2 text-left text-faint tabular">{String(i + 1).padStart(3, "0")}</td>
                  <td className="px-5 py-2 text-left text-dim tabular">{fmtDateTime(r.t)}</td>
                  <td className="px-5 py-2 text-fog tabular">{fmtUsd(r.v)}</td>
                  <td className={`px-5 py-2 tabular ${prev ? (d >= 0 ? "text-up-400" : "text-down-400") : "text-faint"}`}>
                    {prev ? fmtSignedUsd(d) : "─"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= Footer ================= */
export function Footer({ m }: { m: Metrics }) {
  return (
    <footer className="mt-16 border-t border-line-soft bg-ink-900/70">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-12 md:grid-cols-3 md:px-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center border border-gold-500/70 font-display text-xs font-bold text-gold-400">A/L</span>
            <p className="font-display text-sm font-bold tracking-[0.18em] text-fog">ASSET LEDGER</p>
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-faint">
            An asset-growth summary site that auto-aggregates the spreadsheet "logs" sheet (approx. twice-daily snapshots).
            This site is a record for personal asset formation and does not constitute any investment solicitation or recommendation.
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] tracking-[0.22em] text-faint">METHODOLOGY ── calculation criteria</p>
          <ul className="mt-4 space-y-2 text-[12px] leading-relaxed text-dim">
            <li>· CAGR: compound annual growth rate from start to latest</li>
            <li>· volatility: standard deviation of daily returns × √365</li>
            <li>· Sharpe: (CAGR − 4%) ÷ annualized volatility</li>
            <li>· Calmar: CAGR ÷ maximum drawdown</li>
            <li>· forecast values are estimates assuming the current pace continues</li>
          </ul>
        </div>
        <div>
          <p className="font-mono text-[11px] tracking-[0.22em] text-faint">DATA ── data</p>
          <ul className="mt-4 space-y-2 font-mono text-[12px] text-dim">
            <li>source: Google Spreadsheet logs sheet</li>
            <li>period: {fmtDate(m.start.t)} ─ {fmtDate(m.latest.t)}</li>
            <li>records: {(m.totalRows - m.naRows).toLocaleString()} entries (#N/A excluded {m.naRows})</li>
            <li>currency: USD</li>
            <li>
              <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="text-gold-400 underline-offset-4 hover:underline">
                open original data ↗
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line-soft py-4">
        <p className="mx-auto max-w-[1240px] px-4 text-center font-mono text-[11px] text-faint md:px-6">
          ASSET LEDGER ── asset formation log dashboard / latest update {fmtDateTime(m.latest.t)}
        </p>
      </div>
    </footer>
  );
}
