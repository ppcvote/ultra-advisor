/**
 * MetricsDashboard — Sprint 17 W1 (real data wired)
 * --------------------------------------------------------------------------
 * Admin-only operational telemetry. Sprint 16 shipped the scaffold with
 * 19 placeholder cards; Sprint 17 W1 wires every card to the pre-aggregated
 * `metrics_daily/{yyyymmdd}` docs written by the `metricsAggregationDaily`
 * scheduled function (runs 02:00 TW daily).
 *
 * 4 sections × 19 KPI cards:
 *   A. 顧問活躍度 — DAU/MAU, per-advisor OCR/RAG/PDF, quota requests
 *   B. 系統 health — P95 latency, Gemini spend, Firestore usage, cron, SLA
 *   C. catalog health — product delta, review queue, crowd subs, diff severity
 *   D. 業務 KPI — free→paid conversion, report生成, 觸達率, NPS
 *
 * Boundary rules (Sprint 17 W1):
 *   - No new npm deps. Sparkline reuses the Sprint 16 inline SVG.
 *   - Reads from `metrics_daily` only — NEVER scans raw collections
 *     client-side (would obliterate Firestore read quota).
 *   - No 客戶 PII surfaced. Metrics are integers / floats / counts only;
 *     metricsAggregationDaily backend never writes names / emails to the
 *     metrics_daily doc.
 *   - Empty state: if metrics_daily is missing for the range (e.g., cron
 *     hasn't run yet after Sprint 16 ship), show「請耐心等候資料、cron 每天
 *     02:00 TW 跑」instead of fake zeros.
 *   - Default range = 本月. If 本月 has no docs yet (e.g., month-start before
 *     first 02:00 cron tick), auto-fallback to 上月 silently.
 *   - All "current time" reads happen inside callbacks / effects, never at
 *     module top-level (Sprint 12 / 14 / 15 / 17 rule).
 * --------------------------------------------------------------------------
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Activity,
  ServerCog,
  Boxes,
  TrendingUp,
  Users,
  Sparkles,
  FileText,
  ShieldAlert,
  Database,
  Clock,
  RefreshCw,
  Calendar,
  AlertCircle,
  HeartHandshake,
  Inbox,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RangeKey = 'this_month' | 'last_month' | 'custom';

interface RangeOption {
  key: RangeKey;
  label: string;
}

/**
 * Shape produced by `metricsAggregationDaily` (functions/index.js, Task B1).
 * All numeric leaves; metrics doc holds NO PII (no names, emails, uids).
 * Unknown fields are tolerated — newer cron versions may add keys, older
 * docs may be missing some.
 */
interface MetricsDaily {
  yyyymmdd: string; // doc id, e.g. "20260627"
  // Section A
  dau?: number;
  mau?: number;
  ocrPerActive?: number; // 人均月 OCR (rolling 30d)
  ragPerActive?: number;
  pdfPerActive?: number;
  quotaRequestsNew?: number;
  // Section B
  apiAskP95Ms?: number;
  apiPdfProxyP95Ms?: number;
  geminiCostUsdMonth?: number;
  firestoreReadsDay?: number;
  firestoreWritesDay?: number;
  firestoreStorageGb?: number;
  tiiCronSuccessRate?: number; // 0..1
  conditionAlertSlaHours?: number; // median
  // Section C
  catalogTotal?: number;
  catalogAddedMonth?: number;
  catalogRevisedMonth?: number;
  catalogDelistedMonth?: number;
  reviewQueuePending?: number;
  crowdSubsNew?: number;
  diffSeverity?: { low?: number; med?: number; high?: number; critical?: number };
  // Section D
  freeToPaidRate?: number; // 0..1
  reportsGeneratedMonth?: number;
  customerTouchRate?: number; // 0..1
  advisorNps?: number; // -100..100
}

type Tone = 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';

interface KpiCardProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  tone?: Tone;
  /** Current period value (last day of range). */
  value?: number | string | null;
  /** Suffix appended after value (e.g. '%', 'ms', 'USD'). */
  unit?: string;
  /**
   * % change vs previous equal-length period. Sign drives the color
   * (red < 0, green > 0, gray = 0). Null means "no comparable previous".
   */
  changePct?: number | null;
  /** Series for sparkline (numbers across the range). */
  sparkline?: number[];
  /** Distribution bars (label, value). */
  bars?: Array<[string, number]>;
  /** Footer note. */
  hint?: string;
  /** When true, the card shows a "waiting for cron" state instead of value. */
  pending?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANGES: RangeOption[] = [
  { key: 'this_month', label: '本月' },
  { key: 'last_month', label: '上月' },
  { key: 'custom', label: '自訂' },
];

const TONE_BORDER: Record<Tone, string> = {
  slate: 'border-slate-200',
  blue: 'border-blue-200',
  emerald: 'border-emerald-200',
  amber: 'border-amber-200',
  rose: 'border-rose-200',
  violet: 'border-violet-200',
};

const TONE_ICON_BG: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-600',
  blue: 'bg-blue-100 text-blue-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  amber: 'bg-amber-100 text-amber-600',
  rose: 'bg-rose-100 text-rose-600',
  violet: 'bg-violet-100 text-violet-600',
};

const TONE_STROKE: Record<Tone, string> = {
  slate: '#64748b',
  blue: '#2563eb',
  emerald: '#059669',
  amber: '#d97706',
  rose: '#e11d48',
  violet: '#7c3aed',
};

const TONE_BAR_FILL: Record<Tone, string> = {
  slate: 'bg-slate-400',
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
};

// ---------------------------------------------------------------------------
// Date helpers — all "now" reads happen inside callbacks (Sprint 17 rule).
// ---------------------------------------------------------------------------

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function ymdToString(y: number, m: number, d: number) {
  return `${y}${pad2(m)}${pad2(d)}`;
}

function isoToYyyymmdd(iso: string) {
  // iso = "YYYY-MM-DD" from <input type=date>
  return iso.replace(/-/g, '');
}

/**
 * Compute [from, to] as yyyymmdd strings for a RangeKey, using nowMs as
 * the clock. Defined as a pure function so callers can pass Date.now()
 * at call time without ever reading the wall clock at module scope.
 */
function computeRange(
  rangeKey: RangeKey,
  nowMs: number,
  customStart?: string,
  customEnd?: string,
): { from: string; to: string } | null {
  if (rangeKey === 'custom') {
    if (!customStart || !customEnd) return null;
    return { from: isoToYyyymmdd(customStart), to: isoToYyyymmdd(customEnd) };
  }
  const now = new Date(nowMs);
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1..12
  if (rangeKey === 'this_month') {
    const last = new Date(y, m, 0).getDate(); // last day of this month
    return { from: ymdToString(y, m, 1), to: ymdToString(y, m, last) };
  }
  // last_month
  const prevMonthDate = new Date(y, m - 2, 1); // m-2 because m is 1-indexed
  const py = prevMonthDate.getFullYear();
  const pm = prevMonthDate.getMonth() + 1;
  const plast = new Date(py, pm, 0).getDate();
  return { from: ymdToString(py, pm, 1), to: ymdToString(py, pm, plast) };
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/**
 * Compact human numbers: 1234 → "1.2k", 12345 → "12k", 123456 → "123k",
 * 1234567 → "1.2M". Negative numbers preserved. Floats < 1 left as-is
 * (e.g., 0.83 for rates).
 */
function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs < 1 && abs > 0) {
    // small floats — show 2 sig figs (mostly rates pre-multiplication)
    return `${sign}${abs.toFixed(2)}`;
  }
  if (abs < 1000) {
    // ints stay int; small floats keep 1 decimal
    return Number.isInteger(abs) ? `${sign}${abs}` : `${sign}${abs.toFixed(1)}`;
  }
  if (abs < 10_000) return `${sign}${(abs / 1000).toFixed(1)}k`;
  if (abs < 1_000_000) return `${sign}${Math.round(abs / 1000)}k`;
  if (abs < 10_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  return `${sign}${Math.round(abs / 1_000_000)}M`;
}

function formatPct(rate: number, digits = 1): string {
  if (!Number.isFinite(rate)) return '—';
  return `${(rate * 100).toFixed(digits)}%`;
}

function formatChange(pct: number | null | undefined): { text: string; cls: string } {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) {
    return { text: '—', cls: 'text-slate-400' };
  }
  if (pct === 0) return { text: '0%', cls: 'text-slate-500' };
  if (pct > 0) return { text: `+${pct.toFixed(1)}%`, cls: 'text-emerald-600' };
  return { text: `${pct.toFixed(1)}%`, cls: 'text-rose-600' };
}

/** Period-over-period % change between two scalars. */
function pctChange(curr: number | undefined, prev: number | undefined): number | null {
  if (curr === undefined || prev === undefined) return null;
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

// ---------------------------------------------------------------------------
// Data hook — useMetricsDaily
// ---------------------------------------------------------------------------

interface UseMetricsDailyState {
  data: MetricsDaily[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches metrics_daily docs where yyyymmdd in [from, to], ordered by
 * yyyymmdd asc. No client-side aggregation beyond reading these pre-rolled
 * docs (boundary rule). Refetches when `from` or `to` changes, or when
 * the caller bumps `refreshNonce`.
 */
function useMetricsDaily(range: { from: string; to: string } | null): UseMetricsDailyState {
  const [data, setData] = useState<MetricsDaily[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refetch = useCallback(() => setRefreshNonce((n) => n + 1), []);

  useEffect(() => {
    if (!range) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const q = query(
          collection(db, 'metrics_daily'),
          where('yyyymmdd', '>=', range.from),
          where('yyyymmdd', '<=', range.to),
          orderBy('yyyymmdd', 'asc'),
        );
        const snap = await getDocs(q);
        const docs: MetricsDaily[] = [];
        snap.forEach((d) => {
          const raw = d.data() as Partial<MetricsDaily>;
          docs.push({ ...raw, yyyymmdd: raw.yyyymmdd ?? d.id });
        });
        if (!cancelled) {
          setData(docs);
          setLoading(false);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setData([]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range?.from, range?.to, refreshNonce]);

  return { data, loading, error, refetch };
}

// ---------------------------------------------------------------------------
// Selectors — extract a series + last value from MetricsDaily docs.
// ---------------------------------------------------------------------------

type Selector = (m: MetricsDaily) => number | undefined;

function series(docs: MetricsDaily[], sel: Selector): number[] {
  const out: number[] = [];
  for (const d of docs) {
    const v = sel(d);
    if (typeof v === 'number' && Number.isFinite(v)) out.push(v);
  }
  return out;
}

function lastValue(docs: MetricsDaily[], sel: Selector): number | undefined {
  for (let i = docs.length - 1; i >= 0; i--) {
    const v = sel(docs[i]);
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

/**
 * Aggregate diff-severity histogram across the range. Distribution-type
 * KPIs sum daily counts.
 */
function aggregateDiffSeverity(docs: MetricsDaily[]): Array<[string, number]> {
  const acc = { low: 0, med: 0, high: 0, critical: 0 };
  for (const d of docs) {
    const s = d.diffSeverity || {};
    acc.low += s.low ?? 0;
    acc.med += s.med ?? 0;
    acc.high += s.high ?? 0;
    acc.critical += s.critical ?? 0;
  }
  const total = acc.low + acc.med + acc.high + acc.critical;
  if (total === 0) return [];
  return [
    ['low', acc.low],
    ['med', acc.med],
    ['high', acc.high],
    ['critical', acc.critical],
  ];
}

// ---------------------------------------------------------------------------
// Presentational primitives
// ---------------------------------------------------------------------------

function Sparkline({ data, tone = 'slate' }: { data: number[]; tone: Tone }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-10 w-full rounded bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 flex items-center justify-center">
        <span className="text-[10px] text-slate-400 tracking-wide uppercase">no data</span>
      </div>
    );
  }
  const w = 120;
  const h = 36;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data
    .map((v, i) => `${(i * step).toFixed(2)},${(h - ((v - min) / span) * h).toFixed(2)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={TONE_STROKE[tone]}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BarGroup({ bars, tone = 'slate' }: { bars: Array<[string, number]>; tone: Tone }) {
  if (!bars || bars.length === 0) {
    return (
      <div className="h-10 w-full rounded bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 flex items-center justify-center">
        <span className="text-[10px] text-slate-400 tracking-wide uppercase">no distribution</span>
      </div>
    );
  }
  const max = Math.max(...bars.map(([, v]) => v)) || 1;
  return (
    <div className="space-y-1">
      {bars.map(([label, value]) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 w-12 shrink-0">{label}</span>
          <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
            <div
              className={`h-full ${TONE_BAR_FILL[tone]} transition-all`}
              style={{ width: `${(value / max) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-600 tabular-nums w-8 text-right">{value}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  tone = 'slate',
  value,
  unit,
  changePct,
  sparkline,
  bars,
  hint,
  pending,
}: KpiCardProps) {
  const hasSparkline = sparkline !== undefined;
  const hasBars = bars !== undefined;
  const change = formatChange(changePct);
  const displayValue =
    value === null || value === undefined || value === ''
      ? '—'
      : typeof value === 'number'
        ? formatCompact(value)
        : value;
  return (
    <div
      className={`relative rounded-xl border ${TONE_BORDER[tone]} bg-white p-4 flex flex-col gap-3 shadow-sm`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${TONE_ICON_BG[tone]}`}>
            <Icon size={16} />
          </div>
          <span className="text-sm font-medium text-slate-700 leading-tight">{label}</span>
        </div>
        {pending ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-600 whitespace-nowrap">
            等待 cron
          </span>
        ) : (
          <span className={`text-[10px] font-semibold tabular-nums ${change.cls}`}>{change.text}</span>
        )}
      </div>

      {/* Value lane */}
      <div className="flex items-baseline gap-1">
        {pending ? (
          <>
            <span className="text-2xl font-bold text-slate-300 tabular-nums">—</span>
            <span className="text-xs text-slate-400">尚無資料</span>
          </>
        ) : (
          <>
            <span className="text-2xl font-bold text-slate-800 tabular-nums">{displayValue}</span>
            {unit && <span className="text-xs text-slate-500">{unit}</span>}
          </>
        )}
      </div>

      {hasSparkline && <Sparkline data={sparkline || []} tone={tone} />}
      {hasBars && <BarGroup bars={bars || []} tone={tone} />}

      {hint && <p className="text-[11px] text-slate-400 leading-snug mt-1">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${TONE_ICON_BG[tone]}`}>
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800 leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 leading-tight">{subtitle}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Comparison helpers — build a comparable "previous period" of same length.
// ---------------------------------------------------------------------------

function shiftYyyymmdd(yyyymmdd: string, deltaDays: number): string {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return ymdToString(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

function daysBetween(from: string, to: string): number {
  const f = new Date(
    Number(from.slice(0, 4)),
    Number(from.slice(4, 6)) - 1,
    Number(from.slice(6, 8)),
  );
  const t = new Date(
    Number(to.slice(0, 4)),
    Number(to.slice(4, 6)) - 1,
    Number(to.slice(6, 8)),
  );
  return Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1;
}

function previousRange(range: { from: string; to: string }): { from: string; to: string } {
  const len = daysBetween(range.from, range.to);
  return {
    to: shiftYyyymmdd(range.from, -1),
    from: shiftYyyymmdd(range.from, -len),
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MetricsDashboard() {
  const [range, setRange] = useState<RangeKey>('this_month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [nowMs, setNowMs] = useState<number | null>(null);

  // Read "now" inside an effect, not at module scope.
  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  // Computed current range (yyyymmdd from/to) using the captured nowMs.
  const currentRange = useMemo(() => {
    if (nowMs === null) return null;
    return computeRange(range, nowMs, customStart, customEnd);
  }, [range, customStart, customEnd, nowMs]);

  // Fallback: if user picked 本月 and no docs are available yet (likely
  // early-month before first 02:00 cron tick has ever run for this month),
  // silently shift to 上月.
  const currentResult = useMetricsDaily(currentRange);
  const shouldFallback =
    range === 'this_month' &&
    !currentResult.loading &&
    !currentResult.error &&
    currentResult.data.length === 0 &&
    nowMs !== null;

  const fallbackRange = useMemo(() => {
    if (!shouldFallback || nowMs === null) return null;
    return computeRange('last_month', nowMs);
  }, [shouldFallback, nowMs]);
  const fallbackResult = useMetricsDaily(fallbackRange);

  const effectiveRange = shouldFallback ? fallbackRange : currentRange;
  const effectiveResult = shouldFallback ? fallbackResult : currentResult;

  // Previous comparable period (for % change).
  const prevRange = useMemo(
    () => (effectiveRange ? previousRange(effectiveRange) : null),
    [effectiveRange?.from, effectiveRange?.to],
  );
  const prevResult = useMetricsDaily(prevRange);

  const rangeLabel = useMemo(() => {
    if (range === 'custom') {
      if (customStart && customEnd) return `自訂 (${customStart} ~ ${customEnd})`;
      return '自訂';
    }
    const base = RANGES.find((r) => r.key === range)?.label ?? '';
    return shouldFallback ? `${base} → 自動回退 上月` : base;
  }, [range, customStart, customEnd, shouldFallback]);

  const docs = effectiveResult.data;
  const prevDocs = prevResult.data;
  const isLoading = currentResult.loading || (shouldFallback && fallbackResult.loading);
  const error = currentResult.error || (shouldFallback ? fallbackResult.error : null);
  const noData = !isLoading && !error && docs.length === 0;

  // Helper for "current vs previous" cards.
  const card = (sel: Selector) => {
    const curr = lastValue(docs, sel);
    const prev = lastValue(prevDocs, sel);
    return { value: curr, changePct: pctChange(curr, prev) };
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <BarChart3 size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">UA Metrics Dashboard</h1>
              <p className="text-xs text-slate-500 leading-tight">
                Sprint 17 W1 · metrics_daily live · cron 02:00 TW
              </p>
            </div>
          </div>

          {/* Range picker */}
          <div className="sm:ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                    range === r.key
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {range === 'custom' && (
              <div className="flex items-center gap-1 text-xs">
                <Calendar size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="border border-slate-200 rounded-md px-2 py-1 text-xs"
                  aria-label="起始日期"
                />
                <span className="text-slate-400">~</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="border border-slate-200 rounded-md px-2 py-1 text-xs"
                  aria-label="結束日期"
                />
              </div>
            )}
            <button
              onClick={() => {
                currentResult.refetch();
                if (shouldFallback) fallbackResult.refetch();
                prevResult.refetch();
              }}
              disabled={isLoading}
              className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              重新整理
            </button>
          </div>
        </div>

        {/* Status banner */}
        {(noData || error || shouldFallback) && (
          <div
            className={`border-t ${
              error ? 'border-rose-100 bg-rose-50' : 'border-amber-100 bg-amber-50'
            }`}
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-start gap-2">
              <AlertCircle
                size={14}
                className={`${error ? 'text-rose-600' : 'text-amber-600'} mt-0.5 shrink-0`}
              />
              <p
                className={`text-xs leading-snug ${
                  error ? 'text-rose-800' : 'text-amber-800'
                }`}
              >
                {error ? (
                  <>讀取 metrics_daily 失敗：{error}</>
                ) : noData ? (
                  <>
                    <strong>請耐心等候資料</strong> ·{' '}
                    <code className="px-1 py-0.5 rounded bg-amber-100 text-[11px]">metricsAggregationDaily</code>{' '}
                    cron 每天 02:00 TW 跑、目前範圍 <strong>{rangeLabel}</strong> 尚無 doc。
                  </>
                ) : (
                  <>
                    本月尚無 metrics_daily 資料、已自動 fallback 到 <strong>上月</strong>。
                  </>
                )}
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Main grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Section A — 顧問活躍度 (5 cards) */}
        <Section
          title="A. 顧問活躍度"
          subtitle="DAU / MAU、人均工具使用次數、額度申請量"
          icon={Users}
          tone="blue"
        >
          {(() => {
            const dauC = card((m) => m.dau);
            const mauC = card((m) => m.mau);
            const dauMauValue =
              dauC.value !== undefined && mauC.value !== undefined && mauC.value > 0
                ? `${formatCompact(dauC.value)} / ${formatCompact(mauC.value)}`
                : undefined;
            return (
              <KpiCard
                icon={Activity}
                label="DAU / MAU 顧問數"
                tone="blue"
                value={dauMauValue}
                changePct={dauC.changePct}
                sparkline={series(docs, (m) => m.dau)}
                pending={noData}
                hint="30 日 sparkline · 來源：sessions_daily aggregation"
              />
            );
          })()}
          {(() => {
            const c = card((m) => m.ocrPerActive);
            return (
              <KpiCard
                icon={Sparkles}
                label="人均每月 OCR 次數"
                tone="blue"
                value={c.value}
                changePct={c.changePct}
                pending={noData}
                hint="保單健診 PDF/相片 上傳 → OCR 觸發數 / 活躍顧問數"
              />
            );
          })()}
          {(() => {
            const c = card((m) => m.ragPerActive);
            return (
              <KpiCard
                icon={HeartHandshake}
                label="人均每月 RAG 問答次數"
                tone="blue"
                value={c.value}
                changePct={c.changePct}
                pending={noData}
                hint="/api/ask 呼叫數 / 活躍顧問數"
              />
            );
          })()}
          {(() => {
            const c = card((m) => m.pdfPerActive);
            return (
              <KpiCard
                icon={FileText}
                label="人均每月 PDF view 次數"
                tone="blue"
                value={c.value}
                changePct={c.changePct}
                pending={noData}
                hint="/api/pdf-proxy 成功回應數 / 活躍顧問數"
              />
            );
          })()}
          {(() => {
            const c = card((m) => m.quotaRequestsNew);
            return (
              <KpiCard
                icon={Inbox}
                label="Quota 超額申請數"
                tone="amber"
                value={c.value}
                changePct={c.changePct}
                sparkline={series(docs, (m) => m.quotaRequestsNew)}
                pending={noData}
                hint="quota_extension_requests 月新增筆數"
              />
            );
          })()}
        </Section>

        {/* Section B — 系統 health (6 cards) */}
        <Section
          title="B. 系統 health"
          subtitle="latency、cost、cron 成功率、SLA"
          icon={ServerCog}
          tone="violet"
        >
          {(() => {
            const c = card((m) => m.apiAskP95Ms);
            return (
              <KpiCard
                icon={Clock}
                label="/api/ask P95 latency"
                tone="violet"
                value={c.value}
                unit="ms"
                changePct={c.changePct}
                sparkline={series(docs, (m) => m.apiAskP95Ms)}
                pending={noData}
                hint="毫秒 · 來源：function_logs aggregation"
              />
            );
          })()}
          {(() => {
            const c = card((m) => m.apiPdfProxyP95Ms);
            return (
              <KpiCard
                icon={Clock}
                label="/api/pdf-proxy P95 latency"
                tone="violet"
                value={c.value}
                unit="ms"
                changePct={c.changePct}
                sparkline={series(docs, (m) => m.apiPdfProxyP95Ms)}
                pending={noData}
                hint="毫秒 · 來源：function_logs aggregation"
              />
            );
          })()}
          {(() => {
            const c = card((m) => m.geminiCostUsdMonth);
            return (
              <KpiCard
                icon={Sparkles}
                label="Gemini API cost / 月"
                tone="violet"
                value={c.value}
                unit="USD"
                changePct={c.changePct}
                pending={noData}
                hint="本月累計（USD）· 來源：gemini_usage_daily"
              />
            );
          })()}
          {(() => {
            const reads = card((m) => m.firestoreReadsDay);
            const writes = lastValue(docs, (m) => m.firestoreWritesDay);
            const storage = lastValue(docs, (m) => m.firestoreStorageGb);
            const combined =
              reads.value !== undefined || writes !== undefined || storage !== undefined
                ? `${reads.value !== undefined ? formatCompact(reads.value) : '—'} / ${writes !== undefined ? formatCompact(writes) : '—'} / ${storage !== undefined ? `${storage.toFixed(1)}G` : '—'}`
                : undefined;
            return (
              <KpiCard
                icon={Database}
                label="Firestore 讀 / 寫 / 儲存"
                tone="violet"
                value={combined}
                changePct={reads.changePct}
                pending={noData}
                hint="當日 reads · writes · storage GB · 來源：firebase billing API"
              />
            );
          })()}
          {(() => {
            const c = card((m) => m.tiiCronSuccessRate);
            return (
              <KpiCard
                icon={RefreshCw}
                label="TII 月爬蟲成功率"
                tone="emerald"
                value={c.value !== undefined ? formatPct(c.value) : undefined}
                changePct={c.changePct}
                sparkline={series(docs, (m) => m.tiiCronSuccessRate)}
                pending={noData}
                hint="近 12 月成功率 sparkline"
              />
            );
          })()}
          {(() => {
            const c = card((m) => m.conditionAlertSlaHours);
            return (
              <KpiCard
                icon={ShieldAlert}
                label="條款修訂 alert SLA"
                tone="rose"
                value={c.value}
                unit="小時"
                changePct={c.changePct}
                pending={noData}
                hint="detect → advisor contact 中位數時間（小時）"
              />
            );
          })()}
        </Section>

        {/* Section C — catalog health (4 cards) */}
        <Section
          title="C. Catalog health"
          subtitle="商品總數、review queue、群眾貢獻、diff 嚴重度"
          icon={Boxes}
          tone="emerald"
        >
          {(() => {
            const total = card((m) => m.catalogTotal);
            const added = lastValue(docs, (m) => m.catalogAddedMonth);
            const revised = lastValue(docs, (m) => m.catalogRevisedMonth);
            const delisted = lastValue(docs, (m) => m.catalogDelistedMonth);
            const combined =
              total.value !== undefined
                ? `${formatCompact(total.value)} (+${added ?? 0}/~${revised ?? 0}/-${delisted ?? 0})`
                : undefined;
            return (
              <KpiCard
                icon={Boxes}
                label="Catalog 商品總數 vs 上月"
                tone="emerald"
                value={combined}
                changePct={total.changePct}
                pending={noData}
                hint="新增 / 修訂 / 停售 三欄 delta"
              />
            );
          })()}
          {(() => {
            const c = card((m) => m.reviewQueuePending);
            return (
              <KpiCard
                icon={Inbox}
                label="Review queue pending"
                tone="amber"
                value={c.value}
                changePct={c.changePct}
                pending={noData}
                hint="insurance review queue 待審數量"
              />
            );
          })()}
          {(() => {
            const c = card((m) => m.crowdSubsNew);
            return (
              <KpiCard
                icon={Users}
                label="Crowd-sourced submissions"
                tone="emerald"
                value={c.value}
                changePct={c.changePct}
                sparkline={series(docs, (m) => m.crowdSubsNew)}
                pending={noData}
                hint="顧問端回報的條款 / 商品修訂建議數"
              />
            );
          })()}
          {(() => {
            const bars = aggregateDiffSeverity(docs);
            const total = bars.reduce((a, [, v]) => a + v, 0);
            return (
              <KpiCard
                icon={BarChart3}
                label="LLM diff 嚴重度分布"
                tone="amber"
                value={total > 0 ? total : undefined}
                bars={bars}
                pending={noData}
                hint="月內所有 diff 的 low / med / high / critical 計數"
              />
            );
          })()}
        </Section>

        {/* Section D — 業務 KPI (4 cards) */}
        <Section
          title="D. 業務 KPI"
          subtitle="付費轉換、客戶報告、觸達率、NPS"
          icon={TrendingUp}
          tone="rose"
        >
          {(() => {
            const c = card((m) => m.freeToPaidRate);
            return (
              <KpiCard
                icon={TrendingUp}
                label="顧問 free → paid 轉換率"
                tone="rose"
                value={c.value !== undefined ? formatPct(c.value) : undefined}
                changePct={c.changePct}
                sparkline={series(docs, (m) => m.freeToPaidRate)}
                pending={noData}
                hint="本期試用結束顧問中升級為付費的比例"
              />
            );
          })()}
          {(() => {
            const c = card((m) => m.reportsGeneratedMonth);
            return (
              <KpiCard
                icon={FileText}
                label="客戶報告生成數 / 月"
                tone="rose"
                value={c.value}
                changePct={c.changePct}
                sparkline={series(docs, (m) => m.reportsGeneratedMonth)}
                pending={noData}
                hint="ReportModal / shareLink 產生的客戶分享頁數"
              />
            );
          })()}
          {(() => {
            const c = card((m) => m.customerTouchRate);
            return (
              <KpiCard
                icon={CheckCircle2}
                label="客戶觸達數"
                tone="rose"
                value={c.value !== undefined ? formatPct(c.value) : undefined}
                changePct={c.changePct}
                pending={noData}
                hint="condition alert → advisor 標記已聯繫的件數 / 觸發總數"
              />
            );
          })()}
          {(() => {
            const c = card((m) => m.advisorNps);
            return (
              <KpiCard
                icon={HeartHandshake}
                label="顧問端 NPS"
                tone="rose"
                value={c.value}
                changePct={c.changePct}
                pending={noData || c.value === undefined}
                hint="Sprint 17 後加 in-app survey · 暫無資料時待 survey 上線"
              />
            );
          })()}
        </Section>

        {/* Footer note */}
        <footer className="pt-4 pb-12 border-t border-slate-200 text-xs text-slate-400 leading-relaxed space-y-1">
          <p>
            <strong className="text-slate-500">Sprint 17 W1</strong> · 19 KPI cards 全接{' '}
            <code className="px-1 py-0.5 rounded bg-slate-100">metrics_daily</code> 預聚合 doc。
            目前範圍 <strong>{rangeLabel}</strong> · {docs.length} 個 doc。
          </p>
          <p>
            為避免 Firestore 讀取爆量，所有 KPI 從預聚合 doc 讀取，<strong>不</strong>從瀏覽器端直接掃 collection。
            metrics_daily 不含任何客戶 PII。
          </p>
        </footer>
      </main>
    </div>
  );
}
