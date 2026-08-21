import { useCallback, useEffect, useRef, useState } from "react";
import type { LogRecord, ParsedLog } from "../data/logs";

/**
 * Google スプレッドシートの logs（Index2）を gviz 経由で取得し、
 * 末尾に 1 セルずつ追記される最新行を取り込む。
 * - 起動時: 即時 1 回（＋失敗時 15s/45s リトライ）
 * - 定期: 毎日 MYT 16:00（UTC+8）に 1 回だけ
 * - 取得成功分は localStorage に保持し、次回起動はネットワークを待たず復元
 */

const SPREADSHEET_ID = "1aI6fooaWdDw9Z8D9_O7JKNGdZ9kBwBX7EgHE7Wjir9k";
const LOGS_GID = 1467211041;
const BASE = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq`;

const CANDIDATES = [
  { name: "Index2", url: `${BASE}?tqx=out:json&sheet=${encodeURIComponent("Index2")}` },
  { name: "logs", url: `${BASE}?tqx=out:json&sheet=${encodeURIComponent("logs")}` },
  { name: "logs(gid)", url: `${BASE}?tqx=out:json&gid=${LOGS_GID}` },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
interface GvizCell {
  v: any;
}
interface GvizRow {
  c: (GvizCell | null)[];
}

function parseGvizDate(cell: GvizCell | null): number | null {
  if (!cell || cell.v == null) return null;
  const v = cell.v;
  if (typeof v === "string") {
    const m = v.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
    if (m) return new Date(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)).getTime();
    const t = Date.parse(v.replace(" ", "T"));
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v === "number") return Math.round((v - 25569) * 86400000); // Sheets シリアル値
  if (v instanceof Date) return v.getTime();
  return null;
}

function parseGvizNumber(cell: GvizCell | null): number | null {
  if (!cell || cell.v == null) return null;
  const n = typeof cell.v === "number" ? cell.v : parseFloat(String(cell.v).replace(/[,$\s]/g, ""));
  return Number.isFinite(n) ? n : null; // #N/A・空欄は null（0 と混ぜない）
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
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("unexpected payload");
  const json = JSON.parse(text.slice(start, end + 1));
  const rows: GvizRow[] = json?.table?.rows ?? [];
  if (!rows.length) throw new Error("empty table");
  return rowsToRecords(rows);
}

/** 組み込みデータと取得データをタイムスタンプ単位で統合（末尾追加分が反映される） */
export function mergeRecords(base: LogRecord[], fetched: LogRecord[]): LogRecord[] {
  const map = new Map<number, LogRecord>();
  for (const r of base) map.set(r.t, r);
  for (const r of fetched) map.set(r.t, r);
  return [...map.values()].sort((a, b) => a.t - b.t);
}

/* ---------- 次回 MYT 16:00 ---------- */
function toMyt(ts: number): Date {
  return new Date(ts + 8 * 3600000);
}
export function formatMyt(ts: number): string {
  const d = toMyt(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
function nextDailyFetchAt(nowMs: number): number {
  const myt = toMyt(nowMs);
  const next = new Date(myt);
  next.setUTCHours(16, 0, 0, 0);
  if (next.getTime() <= myt.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - 8 * 3600000;
}

/* ---------- localStorage キャッシュ ---------- */
const CACHE_KEY = "asset-ledger-live-cache-v1";

function loadCache(): { rows: LogRecord[]; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || !Array.isArray(j.rows)) return null;
    return { rows: j.rows as LogRecord[], savedAt: j.savedAt ?? 0 };
  } catch {
    return null;
  }
}
function saveCache(rows: LogRecord[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rows, savedAt: Date.now() }));
  } catch {
    /* 容量制限時は諦める */
  }
}

export type LiveStatus = "loading" | "live" | "stale" | "offline";

export interface LiveState {
  status: LiveStatus;
  source: string | null;
  lastFetch: number | null;
  nextFetchAt: number | null;
  added: number;
  fetchedRows: number;
  latest: LogRecord | null;
  parsed: ParsedLog;
  error: string | null;
  flash: boolean;
  refresh: () => void;
}

export function useLiveData(base: ParsedLog): LiveState {
  const [cache] = useState(() => loadCache());
  const [status, setStatus] = useState<LiveStatus>("loading");
  const [source, setSource] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(cache?.savedAt ?? null);
  const [nextFetchAt, setNextFetchAt] = useState<number | null>(() => nextDailyFetchAt(Date.now()));
  const [boot] = useState(() => {
    const merged = cache ? mergeRecords(base.records, cache.rows) : base.records;
    return { merged, added: merged.length - base.records.length };
  });
  const [added, setAdded] = useState(boot.added);
  const [fetchedRows, setFetchedRows] = useState(cache?.rows.length ?? 0);
  const [latest, setLatest] = useState<LogRecord | null>(boot.merged[boot.merged.length - 1] ?? null);
  const [parsed, setParsed] = useState<ParsedLog>({
    records: boot.merged,
    totalRows: boot.merged.length,
    naRows: base.naRows,
  });
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const everSucceeded = useRef(cache != null);
  const running = useRef(false);
  const latestT = useRef(boot.merged.length ? boot.merged[boot.merged.length - 1].t : 0);
  const flashTimer = useRef(0);
  const retryCount = useRef(0);
  const retryTimers = useRef<number[]>([]);
  const attemptRef = useRef<() => Promise<void>>(async () => {});

  const attempt = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      // 全候補を並列取得 → 成功分の和集合（Index2 / logs どちらに増えても取りこぼさない）
      const results = await Promise.allSettled(CANDIDATES.map((c) => fetchSheet(c.url)));
      const byT = new Map<number, LogRecord>();
      const srcs: string[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value.length) {
          srcs.push(CANDIDATES[i].name);
          for (const rec of r.value) byT.set(rec.t, rec);
        }
      });
      const fetched = [...byT.values()].sort((a, b) => a.t - b.t);

      if (fetched.length) {
        everSucceeded.current = true;
        retryCount.current = 0;
        const merged = mergeRecords(base.records, fetched);
        const newest = merged[merged.length - 1];
        setParsed({ records: merged, totalRows: merged.length, naRows: base.naRows });
        setSource(srcs.join(" + "));
        setAdded(merged.length - base.records.length);
        setFetchedRows(fetched.length);
        setLatest(newest);
        setError(null);
        setStatus("live");
        saveCache(fetched);
        if (newest.t > latestT.current) {
          latestT.current = newest.t;
          setFlash(true);
          window.clearTimeout(flashTimer.current);
          flashTimer.current = window.setTimeout(() => setFlash(false), 4000);
        }
      } else {
        const lastErr = results
          .filter((r): r is PromiseRejectedResult => r.status === "rejected")
          .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
          .join(" / ");
        setStatus(everSucceeded.current ? "stale" : "offline");
        setError(lastErr || "fetch failed");
        retryCount.current += 1;
        if (retryCount.current <= 2) {
          const delay = retryCount.current === 1 ? 15000 : 45000;
          retryTimers.current.push(window.setTimeout(() => void attemptRef.current(), delay));
        }
      }
    } finally {
      running.current = false;
      const now = Date.now();
      setLastFetch(now);
      setNextFetchAt(nextDailyFetchAt(now));
    }
  }, [base]);
  attemptRef.current = attempt;

  useEffect(() => {
    void attempt();
    const onVis = () => {
      if (document.visibilityState === "visible") void attempt();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearTimeout(flashTimer.current);
      retryTimers.current.forEach((t) => window.clearTimeout(t));
    };
  }, [attempt]);

  // 期限監視（毎日 MYT 16:00 を過ぎたら 1 回だけ取得）
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      const nf = nextFetchAt;
      if (nf && Date.now() >= nf && !running.current) void attempt();
    }, 30000);
    return () => window.clearInterval(id);
  }, [nextFetchAt, attempt]);

  return { status, source, lastFetch, nextFetchAt, added, fetchedRows, latest, parsed, error, flash, refresh: () => void attempt() };
}
