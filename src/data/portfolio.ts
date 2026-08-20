export type SrcCat = "ファンド" | "ETF" | "法定通貨" | "暗号通貨" | "ゴールド" | "オルタナ";

export interface Holding {
  name: string;
  cat: SrcCat;
  theme: string;
  usd: number;
  pct: number;
}

export const PORT_TOTAL = 65188.27039;
export const PORT_ALL_PCT_SRC = "76.42%";

export const THEME_COLORS: Record<string, string> = {
  "全世界株": "#4ade9c",
  "米国株": "#5ca9ff",
  "日本株": "#ff6b6b",
  "インド株": "#ffa94d",
  "中国株": "#c792ea",
  "新興国株": "#a8d84c",
  "欧州株": "#4dd8e6",
  "セクター・テーマ": "#f78fb3",
  "ゴールド・貴金属": "#ffd76a",
  "コモディティ": "#d4a276",
  "債券・短期国債": "#93a7b8",
  "デジタル資産": "#9d6bff",
  "法定通貨": "#cfe0ee",
  "オルタナ": "#6b7f8c",
};

export const CAT_COLORS: Record<SrcCat, string> = {
  ファンド: "#4ade9c",
  ETF: "#5ca9ff",
  法定通貨: "#cfe0ee",
  暗号通貨: "#9d6bff",
  ゴールド: "#ffd76a",
  オルタナ: "#6b7f8c",
};

const h = (name: string, cat: SrcCat, theme: string, usd: number, pct: number): Holding => ({ name, cat, theme, usd, pct });

export const HOLDINGS: Holding[] = [
  // ファンド
  h("eMAXIS Slim 全世界株式(オール･カントリー)", "ファンド", "全世界株", 5623.37051, 8.63),
  h("SBI・iシェアーズ・ゴールド(H無)", "ファンド", "ゴールド・貴金属", 2336.24993, 3.58),
  h("SBI・新興国株式インデックス・ファンド", "ファンド", "新興国株", 2099.481655, 3.22),
  h("eMAXIS プラス コモディティインデックス", "ファンド", "コモディティ", 2002.670948, 3.07),
  h("SBI・iシェアーズ・日経225インデックス・ファンド", "ファンド", "日本株", 1251.990928, 1.92),
  h("フィデリティ･米国優良株･ファンド", "ファンド", "米国株", 490.7231979, 0.75),
  h("SBI・iシェアーズ・インド株式インデックス・F", "ファンド", "インド株", 381.1324689, 0.58),
  // ETF（カテゴリ明記）
  h("VOO", "ETF", "米国株", 4907.07, 7.53),
  h("EWJ", "ETF", "日本株", 3487.99, 5.35),
  h("OUNZ", "ETF", "ゴールド・貴金属", 2154.735, 3.31),
  h("GLDM", "ETF", "ゴールド・貴金属", 1881.39, 2.89),
  h("TLT", "ETF", "債券・短期国債", 858.8062, 1.32),
  h("CNYA", "ETF", "中国株", 437.28, 0.67),
  h("VEGI", "ETF", "セクター・テーマ", 319.9, 0.49),
  h("ETHA", "ETF", "デジタル資産", 140.4, 0.22),
  h("PHO", "ETF", "米国株", 143.3, 0.22),
  h("IBIT", "ETF", "デジタル資産", 123.6, 0.19),
  h("TIP", "ETF", "債券・短期国債", 107.52, 0.16),
  h("IYR", "ETF", "セクター・テーマ", 104.78, 0.16),
  h("IEV", "ETF", "欧州株", 75.34, 0.12),
  h("VTI", "ETF", "米国株", 64.056258, 0.1),
  h("PFFD", "ETF", "セクター・テーマ", 55.26, 0.08),
  h("BTBT", "ETF", "デジタル資産", 3.2, 0.0),
  h("XBI", "ETF", "セクター・テーマ", 0, 0),
  h("IYH", "ETF", "セクター・テーマ", 0, 0),
  h("B", "ETF", "米国株", 0, 0),
  h("GBTC", "ETF", "デジタル資産", 0, 0),
  // 末尾グループ（出典ではカテゴリ空欄→再分類）
  h("VWRA", "ETF", "全世界株", 9268.32, 14.22),
  h("SGOV", "ETF", "債券・短期国債", 4023.6, 6.17),
  h("GLD", "ETF", "ゴールド・貴金属", 2076.3, 3.19),
  h("SBI貴金属（ゴールド）", "ゴールド", "ゴールド・貴金属", 383.5139307, 0.59),
  h("QQQ", "ETF", "米国株", 0, 0),
  h("Space X", "オルタナ", "オルタナ", 0, 0),
  // 法定通貨
  h("MYR（法定通貨）", "法定通貨", "法定通貨", 7592.614549, 11.65),
  h("USD（法定通貨）", "法定通貨", "法定通貨", 3463.87, 5.31),
  h("JPY（法定通貨）", "法定通貨", "法定通貨", 1758.12036, 2.7),
  h("SGD（法定通貨）", "法定通貨", "法定通貨", 1524.687847, 2.34),
  h("HKD（法定通貨）", "法定通貨", "法定通貨", 285.3246616, 0.44),
  h("AUD（法定通貨）", "法定通貨", "法定通貨", 150.7464438, 0.23),
  h("IDR（法定通貨）", "法定通貨", "法定通貨", 51.77464792, 0.08),
  h("THB（法定通貨）", "法定通貨", "法定通貨", 22.91909112, 0.04),
  h("EUR（法定通貨）", "法定通貨", "法定通貨", 0, 0),
  h("NZD（法定通貨）", "法定通貨", "法定通貨", 0, 0),
  h("CAD（法定通貨）", "法定通貨", "法定通貨", 0, 0),
  h("CHF（法定通貨）", "法定通貨", "法定通貨", 0, 0),
  h("GBP（法定通貨）", "法定通貨", "法定通貨", 0, 0),
  // 暗号通貨
  h("BTC（暗号通貨）", "暗号通貨", "デジタル資産", 1427.745053, 2.19),
  h("ETH（暗号通貨）", "暗号通貨", "デジタル資産", 1069.93048, 1.64),
  h("USDC（暗号通貨）", "暗号通貨", "デジタル資産", 1050.17245, 1.61),
  h("WBTC（暗号通貨）", "暗号通貨", "デジタル資産", 904.7240647, 1.39),
  h("SOL（暗号通貨）", "暗号通貨", "デジタル資産", 246.100697, 0.38),
  h("WLD（暗号通貨）", "暗号通貨", "デジタル資産", 215.712504, 0.33),
  h("USDT（暗号通貨）", "暗号通貨", "デジタル資産", 116.1065499, 0.18),
  h("EURC（暗号通貨）", "暗号通貨", "デジタル資産", 99.365526, 0.15),
  h("WETH（暗号通貨）", "暗号通貨", "デジタル資産", 87.3663686, 0.13),
  h("ADA（暗号通貨）", "暗号通貨", "デジタル資産", 84.88566986, 0.13),
  h("MATIC（暗号通貨）", "暗号通貨", "デジタル資産", 68.88839748, 0.11),
  h("AVAX（暗号通貨）", "暗号通貨", "デジタル資産", 33.960705, 0.05),
  h("DOGE（暗号通貨）", "暗号通貨", "デジタル資産", 26.78162027, 0.04),
  h("LINK（暗号通貨）", "暗号通貨", "デジタル資産", 21.40819837, 0.03),
  h("BNB（暗号通貨）", "暗号通貨", "デジタル資産", 20.30847819, 0.03),
  h("GBP（暗号通貨）", "暗号通貨", "デジタル資産", 14.122493, 0.02),
  h("AUDIO（暗号通貨）", "暗号通貨", "デジタル資産", 13.5700851, 0.02),
  h("ALGO（暗号通貨）", "暗号通貨", "デジタル資産", 13.48264402, 0.02),
  h("QRL（暗号通貨）", "暗号通貨", "デジタル資産", 11.8556208, 0.02),
  h("MNT（暗号通貨）", "暗号通貨", "デジタル資産", 5.965547217, 0.01),
  h("SHIB（暗号通貨）", "暗号通貨", "デジタル資産", 3.279571553, 0.01),
  h("NIBI（暗号通貨）", "暗号通貨", "デジタル資産", 0.4990402812, 0),
  h("GALA（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("BTG（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("XAUT（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("ATOM（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("ARB（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("STORJ（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("APE（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("BGB（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("PAXG（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("XLM（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("NEAR（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("DOT（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("SUI（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("WMATIC（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("JPY（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("BRL（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
  h("MYR（暗号通貨）", "暗号通貨", "デジタル資産", 0, 0),
];

export interface ThemeAgg {
  theme: string;
  color: string;
  usd: number;
  pct: number;
  count: number;
}

export function aggregateThemes(): ThemeAgg[] {
  const map = new Map<string, ThemeAgg>();
  for (const hd of HOLDINGS) {
    const cur = map.get(hd.theme) ?? { theme: hd.theme, color: THEME_COLORS[hd.theme] ?? "#888", usd: 0, pct: 0, count: 0 };
    cur.usd += hd.usd;
    cur.pct += hd.pct;
    if (hd.usd > 0) cur.count += 1;
    map.set(hd.theme, cur);
  }
  return [...map.values()].sort((a, b) => b.usd - a.usd);
}

export interface CatAgg {
  cat: SrcCat;
  color: string;
  usd: number;
  pct: number;
}

export function aggregateCats(): CatAgg[] {
  const map = new Map<SrcCat, CatAgg>();
  for (const hd of HOLDINGS) {
    const cur = map.get(hd.cat) ?? { cat: hd.cat, color: CAT_COLORS[hd.cat], usd: 0, pct: 0 };
    cur.usd += hd.usd;
    cur.pct += hd.pct;
    map.set(hd.cat, cur);
  }
  return [...map.values()].sort((a, b) => b.usd - a.usd);
}

export interface Concentration {
  hhi: number;
  effectiveN: number;
  top5: number;
  top10: number;
  topName: string;
  activeCount: number;
  zeroCount: number;
}

export function concentration(): Concentration {
  const act = HOLDINGS.filter((x) => x.usd > 0);
  const ws = act.map((x) => x.usd / PORT_TOTAL);
  const hhi = ws.reduce((s, w) => s + w * w, 0);
  const sorted = [...act].sort((a, b) => b.usd - a.usd);
  const sumN = (n: number) => sorted.slice(0, n).reduce((s, x) => s + x.usd, 0) / PORT_TOTAL;
  return {
    hhi,
    effectiveN: 1 / hhi,
    top5: sumN(5),
    top10: sumN(10),
    topName: sorted[0]?.name ?? "-",
    activeCount: act.length,
    zeroCount: HOLDINGS.length - act.length,
  };
}
