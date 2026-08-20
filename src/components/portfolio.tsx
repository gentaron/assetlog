import { useMemo, useState } from "react";
import { HOLDINGS, PORT_TOTAL, PORT_ALL_PCT_SRC, aggregateThemes, aggregateCats, concentration, CAT_COLORS, type Holding, type SrcCat } from "../data/portfolio";
import { useReveal } from "../lib/hooks";

const usd = (v: number, dp = 2) => v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pctf = (v: number, dp = 2) => `${v.toFixed(dp)}%`;

/* ---------------- ドーナツ ---------------- */
function Donut() {
  const themes = useMemo(() => aggregateThemes().filter((t) => t.usd > 0), []);
  const [active, setActive] = useState<number | null>(null);
  let acc = 0;
  const arcs = themes.map((t) => {
    const a = { ...t, from: acc };
    acc += t.usd / PORT_TOTAL;
    return a;
  });
  const shown = active !== null ? themes[active] : null;
  return (
    <div className="flex flex-col items-center gap-5 md:flex-row md:items-center">
      <div className="relative shrink-0">
        <svg width="264" height="264" viewBox="0 0 264 264" className="block">
          <circle cx="132" cy="132" r="100" fill="none" stroke="rgba(157,176,192,.08)" strokeWidth="30" />
          <g transform="rotate(-90 132 132)">
            {arcs.map((a, i) => (
              <circle
                key={a.theme}
                cx="132"
                cy="132"
                r="100"
                fill="none"
                stroke={a.color}
                strokeWidth={active === i ? 36 : 30}
                pathLength={100}
                strokeDasharray={`${Math.max(0.15, (a.usd / PORT_TOTAL) * 100 - 0.5)} ${100 - Math.max(0.15, (a.usd / PORT_TOTAL) * 100 - 0.5)}`}
                strokeDashoffset={-a.from * 100}
                opacity={active === null || active === i ? 1 : 0.28}
                style={{ transition: "opacity .25s, stroke-width .25s", cursor: "pointer" }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {shown ? (
            <>
              <span className="px-6 font-display text-[11px] font-bold tracking-[0.14em] text-[#c8d6df]">{shown.theme}</span>
              <span className="num text-xl font-semibold text-[#e8f1f5]">${usd(shown.usd, 0)}</span>
              <span className="num text-xs text-[#9db2c0]">{pctf(shown.usd / PORT_TOTAL * 100, 1)}</span>
            </>
          ) : (
            <>
              <span className="font-display text-[10px] font-bold tracking-[0.22em] text-[#8aa0ae]">総資産</span>
              <span className="num text-2xl font-semibold text-[#4ade9c]">${usd(PORT_TOTAL, 0)}</span>
              <span className="num text-xs text-[#9db2c0]">{HOLDINGS.length} 銘柄</span>
            </>
          )}
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {themes.map((t, i) => (
          <li
            key={t.theme}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className="group flex cursor-default items-center gap-2.5 rounded-md px-2 py-1 transition-colors hover:bg-[#131f2b]"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: t.color }} />
            <span className="min-w-0 flex-1 truncate text-xs text-[#c8d6df]">{t.theme}</span>
            <span className="num shrink-0 text-xs text-[#e8f1f5]">${usd(t.usd, 0)}</span>
            <span className="num w-14 shrink-0 text-right text-xs text-[#9db2c0]">{pctf(t.usd / PORT_TOTAL * 100, 1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- 集中度カード ---------------- */
function ConcentrationCards() {
  const c = useMemo(() => concentration(), []);
  const cards = [
    { k: "HHI（集中度指数）", v: (c.hhi * 10000).toFixed(0), s: c.hhi < 0.1 ? "分散良好（<1,000）" : c.hhi < 0.18 ? "やや集中" : "集中度高め" },
    { k: "実効保有数", v: c.effectiveN.toFixed(1), s: `「均等に ${c.effectiveN.toFixed(1)} 銘柄」に相当` },
    { k: "Top5 集中度", v: pctf(c.top5 * 100, 1), s: `最大: ${c.topName}` },
    { k: "Top10 集中度", v: pctf(c.top10 * 100, 1), s: `保有 ${c.activeCount} / ゼロ ${c.zeroCount}` },
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {cards.map((cd) => (
        <div key={cd.k} className="panel p-4">
          <div className="text-[10px] font-bold tracking-[0.14em] text-[#8aa0ae]">{cd.k}</div>
          <div className="num mt-1 text-xl font-semibold text-[#e8f1f5]">{cd.v}</div>
          <div className="mt-1 truncate text-[11px] text-[#9db2c0]">{cd.s}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- カテゴリ構成バー ---------------- */
function CatBar() {
  const cats = useMemo(() => aggregateCats(), []);
  return (
    <div className="panel p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-display text-sm font-bold tracking-[0.12em] text-[#e8f1f5]">ソースカテゴリ別構成</h3>
        <span className="num text-[11px] text-[#9db2c0]">合計 ${usd(PORT_TOTAL, 2)}</span>
      </div>
      <div className="flex h-4 w-full overflow-hidden rounded-sm">
        {cats.map((c) => (
          <div key={c.cat} title={`${c.cat} ${pctf(c.pct, 2)}`} className="h-full transition-all duration-300 hover:brightness-125" style={{ width: `${c.pct}%`, background: c.color }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {cats.map((c) => (
          <span key={c.cat} className="flex items-center gap-1.5 text-[11px] text-[#c8d6df]">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: c.color }} />
            {c.cat}
            <span className="num text-[#9db2c0]">{pctf(c.pct, 1)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 保有テーブル ---------------- */
type SortKey = "name" | "cat" | "usd" | "pct";

function HoldingsTable() {
  const [sortKey, setSortKey] = useState<SortKey>("usd");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [cat, setCat] = useState<SrcCat | "ALL">("ALL");
  const [showZero, setShowZero] = useState(false);

  const rows = useMemo(() => {
    let rs = [...HOLDINGS];
    if (cat !== "ALL") rs = rs.filter((r) => r.cat === cat);
    if (!showZero) rs = rs.filter((r) => r.usd > 0);
    rs.sort((a, b) => {
      const va = sortKey === "name" || sortKey === "cat" ? a[sortKey] : a[sortKey];
      const vb = sortKey === "name" || sortKey === "cat" ? b[sortKey] : b[sortKey];
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb, "ja") * dir;
      return ((va as number) - (vb as number)) * dir;
    });
    return rs;
  }, [sortKey, dir, cat, showZero]);

  const maxPct = Math.max(...HOLDINGS.map((r) => r.pct));
  const cats: (SrcCat | "ALL")[] = ["ALL", "ファンド", "ETF", "法定通貨", "暗号通貨", "ゴールド", "オルタナ"];

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      className={`cursor-pointer select-none px-3 py-2 text-[10px] font-bold tracking-[0.14em] text-[#8aa0ae] transition-colors hover:text-[#4ade9c] ${right ? "text-right" : "text-left"}`}
      onClick={() => {
        if (sortKey === k) setDir((d) => (d === 1 ? -1 : 1));
        else {
          setSortKey(k);
          setDir(k === "usd" || k === "pct" ? -1 : 1);
        }
      }}
    >
      {label}
      {sortKey === k && <span className="ml-1 text-[#4ade9c]">{dir === -1 ? "▼" : "▲"}</span>}
    </th>
  );

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1d2b3a] px-4 py-3">
        <h3 className="mr-2 font-display text-sm font-bold tracking-[0.12em] text-[#e8f1f5]">保有一覧</h3>
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
              cat === c ? "border-[#4ade9c] bg-[#4ade9c]/10 text-[#4ade9c]" : "border-[#233447] text-[#9db2c0] hover:border-[#3a5069] hover:text-[#c8d6df]"
            }`}
          >
            {c === "ALL" ? "すべて" : c}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-[#9db2c0]">
          <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} className="accent-[#4ade9c]" />
          ゼロ保有も表示
        </label>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[680px] border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-[#0e1822]">
            <tr className="border-b border-[#1d2b3a]">
              <Th k="name" label="資産" />
              <Th k="cat" label="カテゴリ" />
              <Th k="usd" label="評価額 (USD)" right />
              <Th k="pct" label="保有率" right />
              <th className="w-[22%] px-3 py-2 text-right text-[10px] font-bold tracking-[0.14em] text-[#8aa0ae]">構成比</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: Holding) => (
              <tr key={`${r.cat}-${r.name}`} className="border-b border-[#16222e] transition-colors hover:bg-[#12202c]">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CAT_COLORS[r.cat] }} />
                    <span className="truncate font-medium text-[#e8f1f5]">{r.name}</span>
                  </div>
                  <div className="pl-3.5 text-[10px] text-[#7d93a3]">{r.theme}</div>
                </td>
                <td className="px-3 py-2">
                  <span className="rounded-sm border border-[#233447] px-1.5 py-0.5 text-[10px]" style={{ color: CAT_COLORS[r.cat] }}>
                    {r.cat}
                  </span>
                </td>
                <td className="num px-3 py-2 text-right text-[#e8f1f5]">${usd(r.usd)}</td>
                <td className="num px-3 py-2 text-right text-[#9db2c0]">{pctf(r.pct)}</td>
                <td className="px-3 py-2">
                  <div className="ml-auto h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-[#16222e]">
                    <div className="h-full rounded-full" style={{ width: `${(r.pct / maxPct) * 100}%`, background: CAT_COLORS[r.cat] }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-[#1d2b3a] px-4 py-2.5 text-[10px] text-[#7d93a3]">
        <span>{rows.length} 件を表示中</span>
        <span className="num">総額 ${usd(PORT_TOTAL)} ／ 出典シートの ALL 保有率 {PORT_ALL_PCT_SRC}</span>
      </div>
    </div>
  );
}

/* ---------------- セクション本体 ---------------- */
export function PortfolioSection() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="panel p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="font-display text-sm font-bold tracking-[0.12em] text-[#e8f1f5]">テーマ別アロケーション</h3>
            <span className="text-[10px] text-[#7d93a3]">ホバーで詳細</span>
          </div>
          <Donut />
        </div>
        <div className="space-y-5">
          <ConcentrationCards />
          <CatBar />
        </div>
      </div>
      <HoldingsTable />
      <p className="text-[10px] leading-relaxed text-[#7d93a3]">
        ※ 出典シートの ALL 行（$65,188.27）は本ページの総資産として扱い、保有率はこの総額を基準に再計算しています（シートの 76.42% はシート外資産を含む純資産比と推定）。
        VWRA / SGOV / GLD / QQQ / Space X は出典でカテゴリ空欄のため ETF 等に再分類しました。
      </p>
    </div>
  );
}
