import { useCallback, useEffect, useRef, useState } from "react";
import type { LogRecord, ParsedLog } from "../data/logs";

/**
 * Google スプレッドシートの logs（Index2）シートを gviz 経由でポーリングし、
 * 末尾に 1 セルずつ追記されていく最新行を取り込む。
 * 取得に失敗した場合は組み込みデータのまま動作を継続する（欠損は穴埋めしない）。
 */

const SPREADSHEET_ID = "1aI6fooaWdDw9Z8D9_O7JKNGdZ9kBwBX7EgHE7Wjir9k";
const LOGS_GID = 1467211041;
const BASE = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq`;

/** シート候補（上から順に試す） */
const CANDIDATES = [
  { name: "Index2", url: `${BASE}?tqx=out:json&sheet=${encodeURIComponent("Index2")}` },
  { name: "logs", url: `${BASE}?tqx=out:json&sheet=${encodeURIComponent("logs")}` },
  { name: "logs(gid)", url: `${BASE}?tqx=out:json&gid=${LOGS_GID}` },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
interface GvizCell {
  v: any;
  f?: string;
}
interface GvizRow {
  c: (GvizCell | null)[];
}

/** gviz の日付セル → epoch ms（シートTZ＝ブラウザ現地時刻として解釈） */
function parseGvizDate(cell: GvizCell | null): number | null {
  if (!cell || cell.v == null) return null;
  const v = cell.v;
  if (typeof v === "string") {
    // "Date(2025,3,10,21,2,8)" 形式（月は 0 始まり）
    const m = v.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
    if (m) return new Date(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)).getTime();
    const t = Date.parse(v.replace(" ", "T"));
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v === "number") {
    // Sheets シリアル値（1899-12-30 起点、小数部が時刻）
    return Math.round((v - 25569) * 86400000);
  }
  if (v instanceof Date) return v.getTime();
  return null;
}

function parseGvizNumber(cell: GvizCell | null): number | null {
  if (!cell || cell.v == null) return null;
  const n = typeof cell.v === "number" ? cell.v : parseFloat(String(cell.v).replace(/[,$\s]/g, ""));
  return Number.isFinite(n) ? n : null; // #N /A・空欄は null（0 と区別）
}

function rowsToRecords(rows: GvizRow[]): LogRecord[] {
  const out: LogRecord[] = [];
  for (const row of rows) {
    const c = row.c ?? [];
    const t = parseGvizDate(c[0] ?? null);
    const v = parseGvizNumber(c[1] ?? null);
    if (t != null && v != null) out.push({ t, v });
  }
  return out.sort((a, b) => a.t - b.t);
}

async function fetchSheet(url: string): Promise<LogRecord[]> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  // /*O_o*/ google.visualization.Query.setResponse({...}); の中身だけを取り出す
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("unexpected payload");
  const json = JSON.parse(text.slice(start, end + 1));
  const rows: GvizRow[] = json?.table?.rows ?? [];
  if (!rows.length) throw new Error("empty table");
  return rowsToRecords(rows);
}

/** 組み込みデータと取得データをタイムスタンプ単位で統合（末尾追記行は上書き・追加される） */
export function mergeRecords(base: LogRecord[], fetched: LogRecord[]): LogRecord[] {
  const map = new Map<number, LogRecord>();
  for (const r of base) map.set(r.t, r);
  for (const r of fetched) map.set(r.t, r);
  return [...map.values()].sort((a, b) => a.t - b.t);
}

export type LiveStatus = "loading" | "live" | "stale" | "offline";

export interface LiveState {
  status: LiveStatus;
  source: string | null; // 取得成功したシート名
  lastFetch: number | null;
  nextFetchAt: number | null;
  added: number; // 組み込みデータに対する追加分
  fetchedRows: number; // 今回取得した行数
  latest: LogRecord | null;
  parsed: ParsedLog; // マージ済み（常に描画可能）
  error: string | null;
  flash: boolean; // 新着データ到着直後（演出用）
  refresh: () => void;
}

export function useLiveData(base: ParsedLog, intervalMs = 60000): LiveState {
  const [status, setStatus] = useState<LiveStatus>("loading");
  const [source, setSource] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [nextFetchAt, setNextFetchAt] = useState<number | null>(null);
  const [added, setAdded] = useState(0);
  const [fetchedRows, setFetchedRows] = useState(0);
  const [latest, setLatest] = useState<LogRecord | null>(null);
  const [parsed, setParsed] = useState<ParsedLog>(base);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const everSucceeded = useRef(false);
  const running = useRef(false);
  const latestT = useRef(base.records.length ? base.records[base.records.length - 1].t : 0);
  const flashTimer = useRef(0);

  const attempt = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      let fetched: LogRecord[] | null = null;
      let src: string | null = null;
      let lastErr = "";
      for (const cand of CANDIDATES) {
        try {
          fetched = await fetchSheet(cand.url);
          src = cand.name;
          break;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
      }
      if (fetched && src) {
        everSucceeded.current = true;
        const merged = mergeRecords(base.records, fetched);
        const newest = merged[merged.length - 1];
        const na = fetched.reduce((n, r) => n + (r.v === null ? 1 : 0), 0);
        setParsed({ records: merged, totalRows: merged.length, naRows: base.naRows + na });
        setSource(src);
        setAdded(merged.length - base.records.length);
        setFetchedRows(fetched.length);
        setLatest(newest);
        setError(null);
        setStatus("live");
        if (newest.t > latestT.current) {
          latestT.current = newest.t;
          setFlash(true);
          window.clearTimeout(flashTimer.current);
          flashTimer.current = window.setTimeout(() => setFlash(false), 4000);
        }
      } else {
        setStatus(everSucceeded.current ? "stale" : "offline");
        setError(lastErr || "fetch failed");
      }
    } finally {
      running.current = false;
      const now = Date.now();
      setLastFetch(now);
      setNextFetchAt(now + intervalMs);
    }
  }, [base, intervalMs]);

  // 初回取得＋定期ポーリング（タブ復帰時も即更新）
  useEffect(() => {
    void attempt();
    const onVis = () => {
      if (document.visibilityState === "visible") void attempt();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearTimeout(flashTimer.current);
    };
  }, [attempt]);

  // カウントダウン監視（1 秒刻み、期限到達で次回取得）
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      const nf = nextFetchAt;
      if (nf && Date.now() >= nf && !running.current) void attempt();
    }, 1000);
    return () => window.clearInterval(id);
  }, [nextFetchAt, attempt]);

  return { status, source, lastFetch, nextFetchAt, added, fetchedRows, latest, parsed, error, flash, refresh: () => void attempt() };
}
