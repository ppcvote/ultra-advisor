/**
 * MetricsDashboard — Sprint 16 scaffold (placeholder shell)
 * --------------------------------------------------------------------------
 * Admin-only operational telemetry surface. Sprint 16 ships UI scaffold only;
 * real data wires up in Sprint 17 once monthly crons have accumulated enough
 * data points to render non-degenerate sparklines.
 *
 * 4 sections (mirrors the Sprint 16 brief):
 *   A. 顧問活躍度 (advisor engagement) — DAU/MAU, per-advisor OCR/RAG/PDF
 *      counts, quota extension request volume.
 *   B. 系統 health — /api/ask + /api/pdf-proxy P95 latency, Gemini monthly
 *      spend, Firestore reads/writes/storage, TII monthly cron success rate
 *      (12-month sparkline), condition-revision-alert detect→contact SLA.
 *   C. catalog health — product count delta vs. last month, review queue
 *      backlog, crowd-sourced submission volume, LLM diff severity histogram.
 *   D. 業務 KPI — free→paid conversion, customer report generation rate,
 *      condition-alert touch rate, advisor-side NPS (post-Sprint 17 survey).
 *
 * Sprint 16 commitments / boundary rules:
 *   - No new npm deps (per戰略邊界 HARD). Charts use inline SVG sparklines +
 *     plain Tailwind bars — NOT Chart.js / Recharts / etc.
 *   - Every KPI card explicitly renders a「等 Sprint 17 接 query」placeholder
 *     state instead of fake numbers. Real values come from a metrics_daily
 *     Firestore aggregation that does not yet exist.
 *   - No client-side aggregation queries — Sprint 17 will read a pre-rolled
 *     `metrics_daily/{yyyymmdd}` doc, not scan raw collections from the
 *     browser (would obliterate Firestore read quota).
 *   - Admin gate lives in App.tsx (same pattern as InsuranceReviewQueue /
 *     QuotaExtensionRequests). Firestore rules still enforce the boundary.
 *   - Responsive: cards collapse to single-column on `sm:` and below.
 *   - Date-range picker is uncontrolled UI for Sprint 16 (state only, no
 *     refetch wired). Default = 本月.
 * --------------------------------------------------------------------------
 */
import React, { useMemo, useState } from 'react';
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
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RangeKey = 'this_month' | 'last_month' | 'custom';

interface RangeOption {
  key: RangeKey;
  label: string;
}

interface KpiCardProps {
  /** lucide icon component */
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  /** Optional accent — purely cosmetic, defaults to slate */
  tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';
  /**
   * Optional sparkline series — Sprint 16 always renders an empty-state
   * placeholder; in Sprint 17 we'll pass real number[] (length ≤ 30).
   */
  sparkline?: number[];
  /**
   * Optional bar series for distribution metrics (e.g., LLM diff severity).
   * Tuple form: [label, value]. Sprint 16 placeholder = empty array.
   */
  bars?: Array<[string, number]>;
  /** Footer note (small subdued text under the placeholder) */
  hint?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RANGES: RangeOption[] = [
  { key: 'this_month', label: '本月' },
  { key: 'last_month', label: '上月' },
  { key: 'custom', label: '自訂' },
];

const TONE_BORDER: Record<NonNullable<KpiCardProps['tone']>, string> = {
  slate: 'border-slate-200',
  blue: 'border-blue-200',
  emerald: 'border-emerald-200',
  amber: 'border-amber-200',
  rose: 'border-rose-200',
  violet: 'border-violet-200',
};

const TONE_ICON_BG: Record<NonNullable<KpiCardProps['tone']>, string> = {
  slate: 'bg-slate-100 text-slate-600',
  blue: 'bg-blue-100 text-blue-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  amber: 'bg-amber-100 text-amber-600',
  rose: 'bg-rose-100 text-rose-600',
  violet: 'bg-violet-100 text-violet-600',
};

const SPRINT17_PENDING_LABEL = '等 Sprint 17 接 query';

// ---------------------------------------------------------------------------
// Presentational primitives
// ---------------------------------------------------------------------------

/**
 * Inline SVG sparkline. Zero-dep, fixed viewBox so the path scales with
 * Tailwind sizing. Sprint 16 always receives an empty array → renders the
 * placeholder lane instead of a path.
 */
function Sparkline({ data, tone = 'slate' }: { data: number[]; tone: NonNullable<KpiCardProps['tone']> }) {
  const stroke: Record<NonNullable<KpiCardProps['tone']>, string> = {
    slate: '#64748b',
    blue: '#2563eb',
    emerald: '#059669',
    amber: '#d97706',
    rose: '#e11d48',
    violet: '#7c3aed',
  };
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
        stroke={stroke[tone]}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Pure-CSS horizontal bars (no SVG, no chart lib). Empty array → placeholder.
 */
function BarGroup({ bars, tone = 'slate' }: { bars: Array<[string, number]>; tone: NonNullable<KpiCardProps['tone']> }) {
  const fill: Record<NonNullable<KpiCardProps['tone']>, string> = {
    slate: 'bg-slate-400',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    violet: 'bg-violet-500',
  };
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
              className={`h-full ${fill[tone]} transition-all`}
              style={{ width: `${(value / max) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-600 tabular-nums w-8 text-right">{value}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ icon: Icon, label, tone = 'slate', sparkline, bars, hint }: KpiCardProps) {
  const hasSparkline = sparkline !== undefined;
  const hasBars = bars !== undefined;
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
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-500 whitespace-nowrap">
          {SPRINT17_PENDING_LABEL}
        </span>
      </div>

      {/* Placeholder value lane */}
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-300 tabular-nums">—</span>
        <span className="text-xs text-slate-400">尚無資料</span>
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
  tone: NonNullable<KpiCardProps['tone']>;
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
// Main component
// ---------------------------------------------------------------------------

export default function MetricsDashboard() {
  const [range, setRange] = useState<RangeKey>('this_month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Sprint 16: range state is UI-only; no refetch hooked up. Memo'd so the
  // chip display can show「自訂 (YYYY-MM-DD ~ YYYY-MM-DD)」once both ends set.
  const rangeLabel = useMemo(() => {
    if (range !== 'custom') return RANGES.find((r) => r.key === range)?.label ?? '';
    if (customStart && customEnd) return `自訂 (${customStart} ~ ${customEnd})`;
    return '自訂';
  }, [range, customStart, customEnd]);

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
              <p className="text-xs text-slate-500 leading-tight">Sprint 16 scaffold · 資料接線於 Sprint 17 完成</p>
            </div>
          </div>

          {/* Range picker — uncontrolled / UI-only in Sprint 16 */}
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
              className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled
              title="Sprint 17 接資料後啟用"
            >
              <RefreshCw size={12} />
              重新整理
            </button>
          </div>
        </div>

        {/* Sprint 16 banner */}
        <div className="border-t border-amber-100 bg-amber-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-start gap-2">
            <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 leading-snug">
              <strong>Scaffold mode</strong> — 所有 KPI 顯示 <code className="px-1 py-0.5 rounded bg-amber-100 text-[11px]">{SPRINT17_PENDING_LABEL}</code> placeholder。
              Sprint 17 接 <code className="px-1 py-0.5 rounded bg-amber-100 text-[11px]">metrics_daily/{'{yyyymmdd}'}</code> 預聚合 doc 後填入實數。
              目前顯示範圍：<strong>{rangeLabel}</strong>。
            </p>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Section A — 顧問活躍度 */}
        <Section
          title="A. 顧問活躍度"
          subtitle="DAU / MAU、人均工具使用次數、額度申請量"
          icon={Users}
          tone="blue"
        >
          <KpiCard
            icon={Activity}
            label="DAU / MAU 顧問數"
            tone="blue"
            sparkline={[]}
            hint="30 日 sparkline · 來源：sessions_daily aggregation"
          />
          <KpiCard
            icon={Sparkles}
            label="人均每月 OCR 次數"
            tone="blue"
            hint="保單健診 PDF/相片 上傳 → OCR 觸發數 / 活躍顧問數"
          />
          <KpiCard
            icon={HeartHandshake}
            label="人均每月 RAG 問答次數"
            tone="blue"
            hint="/api/ask 呼叫數 / 活躍顧問數"
          />
          <KpiCard
            icon={FileText}
            label="人均每月 PDF view 次數"
            tone="blue"
            hint="/api/pdf-proxy 成功回應數 / 活躍顧問數"
          />
          <KpiCard
            icon={Inbox}
            label="Quota 超額申請數"
            tone="amber"
            sparkline={[]}
            hint="quota_extension_requests 月新增筆數"
          />
        </Section>

        {/* Section B — 系統 health */}
        <Section
          title="B. 系統 health"
          subtitle="latency、cost、cron 成功率、SLA"
          icon={ServerCog}
          tone="violet"
        >
          <KpiCard
            icon={Clock}
            label="/api/ask P95 latency"
            tone="violet"
            sparkline={[]}
            hint="毫秒 · 來源：function_logs aggregation"
          />
          <KpiCard
            icon={Clock}
            label="/api/pdf-proxy P95 latency"
            tone="violet"
            sparkline={[]}
            hint="毫秒 · 來源：function_logs aggregation"
          />
          <KpiCard
            icon={Sparkles}
            label="Gemini API cost / 月"
            tone="violet"
            hint="上月 + 本月 (USD) · 來源：gemini_usage_daily"
          />
          <KpiCard
            icon={Database}
            label="Firestore 讀 / 寫 / 儲存"
            tone="violet"
            hint="本期 reads · writes · storage GB · 來源：firebase billing API"
          />
          <KpiCard
            icon={RefreshCw}
            label="TII 月爬蟲成功率"
            tone="emerald"
            sparkline={[]}
            hint="近 12 月成功率 sparkline"
          />
          <KpiCard
            icon={ShieldAlert}
            label="條款修訂 alert SLA"
            tone="rose"
            hint="detect → advisor contact 中位數時間（小時）"
          />
        </Section>

        {/* Section C — catalog health */}
        <Section
          title="C. Catalog health"
          subtitle="商品總數、review queue、群眾貢獻、diff 嚴重度"
          icon={Boxes}
          tone="emerald"
        >
          <KpiCard
            icon={Boxes}
            label="Catalog 商品總數 vs 上月"
            tone="emerald"
            hint="新增 / 修訂 / 停售 三欄 delta"
          />
          <KpiCard
            icon={Inbox}
            label="Review queue pending"
            tone="amber"
            hint="insurance review queue 待審數量"
          />
          <KpiCard
            icon={Users}
            label="Crowd-sourced submissions"
            tone="emerald"
            sparkline={[]}
            hint="顧問端回報的條款 / 商品修訂建議數"
          />
          <KpiCard
            icon={BarChart3}
            label="LLM diff 嚴重度分布"
            tone="amber"
            bars={[]}
            hint="月內所有 diff 的 low / med / high / critical 計數"
          />
        </Section>

        {/* Section D — 業務 KPI */}
        <Section
          title="D. 業務 KPI"
          subtitle="付費轉換、客戶報告、觸達率、NPS"
          icon={TrendingUp}
          tone="rose"
        >
          <KpiCard
            icon={TrendingUp}
            label="顧問 free → paid 轉換率"
            tone="rose"
            sparkline={[]}
            hint="本期試用結束顧問中升級為付費的比例"
          />
          <KpiCard
            icon={FileText}
            label="客戶報告生成數 / 月"
            tone="rose"
            sparkline={[]}
            hint="ReportModal / shareLink 產生的客戶分享頁數"
          />
          <KpiCard
            icon={CheckCircle2}
            label="客戶觸達數"
            tone="rose"
            hint="condition alert → advisor 標記已聯繫的件數 / 觸發總數"
          />
          <KpiCard
            icon={HeartHandshake}
            label="顧問端 NPS"
            tone="rose"
            hint="Sprint 17 後加 in-app survey · 暫無資料"
          />
        </Section>

        {/* Footer note */}
        <footer className="pt-4 pb-12 border-t border-slate-200 text-xs text-slate-400 leading-relaxed space-y-1">
          <p>
            <strong className="text-slate-500">Sprint 16 scaffold</strong> · UI 完整、資料未接。
            預計 Sprint 17 Phase 1 上線 <code className="px-1 py-0.5 rounded bg-slate-100">metrics_daily</code> 預聚合 cron 後填入實數。
          </p>
          <p>
            為避免 Firestore 讀取爆量，所有 KPI 從預聚合 doc 讀取，<strong>不</strong>從瀏覽器端直接掃 collection。
          </p>
        </footer>
      </main>
    </div>
  );
}
