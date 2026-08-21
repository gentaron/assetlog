/** Index2「assets」シート由来のポートフォリオ（ALL 行は総額として扱う） */
export interface Holding {
  name: string;
  value: number; // USD
  pct: number; // シート記載の保有率 %
}

export type Category = "ファンド" | "ETF" | "法定通貨" | "暗号通貨" | "ゴールド" | "オルタナ";

export const PORTFOLIO_TOTAL = 65188.27039;

export const HOLDINGS: Holding[] = [
  { name: "VWRA", value: 9268.32, pct: 14.22 },
  { name: "MYR（法定通貨）", value: 7592.614549, pct: 11.65 },
  { name: "eMAXIS Slim全世界株式(オール･カントリー)", value: 5623.37051, pct: 8.63 },
  { name: "VOO", value: 4907.07, pct: 7.53 },
  { name: "SGOV", value: 4023.6, pct: 6.17 },
  { name: "USD（法定通貨）", value: 3463.87, pct: 5.31 },
  { name: "EWJ", value: 3487.99, pct: 5.35 },
  { name: "eMAXIS プラス コモディティインデックス", value: 2002.670948, pct: 3.07 },
  { name: "SBI・iシェアーズ・ゴールド(H無)", value: 2336.24993, pct: 3.58 },
  { name: "SBI・新興国株式インデックス・ファンド", value: 2099.481655, pct: 3.22 },
  { name: "OUNZ", value: 2154.735, pct: 3.31 },
  { name: "GLD", value: 2076.3, pct: 3.19 },
  { name: "GLDM", value: 1881.39, pct: 2.89 },
  { name: "JPY（法定通貨）", value: 1758.12036, pct: 2.7 },
  { name: "SGD（法定通貨）", value: 1524.687847, pct: 2.34 },
  { name: "BTC（暗号通貨）", value: 1427.745053, pct: 2.19 },
  { name: "SBI・iシェアーズ・日経225インデックス・ファンド", value: 1251.990928, pct: 1.92 },
  { name: "ETH（暗号通貨）", value: 1069.93048, pct: 1.64 },
  { name: "USDC（暗号通貨）", value: 1050.17245, pct: 1.61 },
  { name: "WBTC（暗号通貨）", value: 904.7240647, pct: 1.39 },
  { name: "TLT", value: 858.8062, pct: 1.32 },
  { name: "フィデリティ･米国優良株･ファンド", value: 490.7231979, pct: 0.75 },
  { name: "CNYA", value: 437.28, pct: 0.67 },
  { name: "SBI・iシェアーズ・インド株式インデックス・F", value: 381.1324689, pct: 0.58 },
  { name: "SBI貴金属（ゴールド）", value: 383.5139307, pct: 0.59 },
  { name: "VEGI", value: 319.9, pct: 0.49 },
  { name: "HKD（法定通貨）", value: 285.3246616, pct: 0.44 },
  { name: "SOL（暗号通貨）", value: 246.100697, pct: 0.38 },
  { name: "WLD（暗号通貨）", value: 215.712504, pct: 0.33 },
  { name: "AUD（法定通貨）", value: 150.7464438, pct: 0.23 },
  { name: "PHO", value: 143.3, pct: 0.22 },
  { name: "ETHA", value: 140.4, pct: 0.22 },
  { name: "IBIT", value: 123.6, pct: 0.19 },
  { name: "USDT（暗号通貨）", value: 116.1065499, pct: 0.18 },
  { name: "TIP", value: 107.52, pct: 0.16 },
  { name: "IYR", value: 104.78, pct: 0.16 },
  { name: "EURC（暗号通貨）", value: 99.365526, pct: 0.15 },
  { name: "WETH（暗号通貨）", value: 87.3663686, pct: 0.13 },
  { name: "ADA（暗号通貨）", value: 84.88566986, pct: 0.13 },
  { name: "IEV", value: 75.34, pct: 0.12 },
  { name: "MATIC（暗号通貨）", value: 68.88839748, pct: 0.11 },
  { name: "VTI", value: 64.056258, pct: 0.1 },
  { name: "PFFD", value: 55.26, pct: 0.08 },
  { name: "AVAX（暗号通貨）", value: 33.960705, pct: 0.05 },
  { name: "DOGE（暗号通貨）", value: 26.78162027, pct: 0.04 },
  { name: "THB（法定通貨）", value: 22.91909112, pct: 0.04 },
  { name: "LINK（暗号通貨）", value: 21.40819837, pct: 0.03 },
  { name: "BNB（暗号通貨）", value: 20.30847819, pct: 0.03 },
  { name: "GBP（暗号通貨）", value: 14.122493, pct: 0.02 },
  { name: "AUDIO（暗号通貨）", value: 13.5700851, pct: 0.02 },
  { name: "ALGO（暗号通貨）", value: 13.48264402, pct: 0.02 },
  { name: "QRL（暗号通貨）", value: 11.8556208, pct: 0.02 },
  { name: "MNT（暗号通貨）", value: 5.965547217, pct: 0.01 },
  { name: "SHIB（暗号通貨）", value: 3.279571553, pct: 0.01 },
  { name: "NIBI（暗号通貨）", value: 0.4990402812, pct: 0 },
  { name: "IDR（法定通貨）", value: 51.77464792, pct: 0.08 },
  { name: "BTBT", value: 3.2, pct: 0 },
];

/** 銘柄名 → カテゴリ分類（ETF はテーマで細分化） */
export function categoryOf(name: string): Category {
  if (name.includes("法定通貨")) return "法定通貨";
  if (name.includes("暗号通貨")) return "暗号通貨";
  if (name.includes("ファンド") || name.includes("eMAXIS")) return "ファンド";
  if (name === "OUNZ" || name === "GLD" || name === "GLDM" || name.includes("貴金属")) return "ゴールド";
  if (name === "TLT" || name === "TIP") return "オルタナ";
  if (name === "BTBT") return "オルタナ";
  return "ETF";
}

/** ETF をテーマで再分類（ドーナツ表示用） */
export function themeOf(name: string): string {
  if (name === "VWRA" || name === "VOO" || name === "VTI") return "全世界・米国株";
  if (name === "EWJ" || name === "CNYA" || name === "IEV") return "地域株";
  if (name === "VEGI") return "テーマ株";
  if (name === "SGOV") return "短期債・キャッシュ";
  if (name === "TLT" || name === "TIP") return "債券";
  if (name === "OUNZ" || name === "GLD" || name === "GLDM" || name.includes("貴金属") || name.includes("ゴールド")) return "金";
  if (name === "PHO") return "テーマ株";
  if (name === "ETHA" || name === "IBIT") return "暗号資産ETF";
  if (name === "BTBT") return "その他";
  if (name.includes("暗号通貨")) {
    if (name.startsWith("BTC") || name.startsWith("WBTC")) return "BTC系";
    if (name.startsWith("ETH") || name.startsWith("WETH")) return "ETH系";
    if (name.startsWith("USDT") || name.startsWith("USDC")) return "ステーブルコイン";
    return "アルトコイン";
  }
  if (name.includes("法定通貨")) return "現金（法定通貨）";
  if (name.includes("ファンド") || name.includes("eMAXIS")) return "投資信託";
  return "その他";
}
