/**
 * InsuranceReviewQueue — Sprint 15 W1 admin scaffold
 * --------------------------------------------------------------------------
 * Admin-only triage UI for the unified insurance review queue. Surfaces
 * pending changes from three upstream sources (TII monthly crawl, advisor
 * crowdsourcing, future per-company scraper) and lets the admin approve /
 * reject / request-more-info.
 *
 * Sprint 15 W1 scope: UI scaffold + read path live, decision endpoints stub.
 *   ✓ 4 status tabs (Pending / Reviewing / Approved / Rejected)
 *   ✓ source + type chips, search, pagination (25/page), bulk-select
 *   ✓ diff preview (collapsible markdown-style table)
 *   ✓ PDF viewer integration (reuses Sprint 14 W3 `PdfViewer`)
 *   ✗ approve/reject mutations (W2 — merge engine + callable)
 *   ✗ LLM diff summary (W2 — placeholder card only)
 *   ✗ condition-revision push notification pipeline (W3)
 *
 * Boundary rules:
 *   - No new npm deps — lucide-react icons, Tailwind, existing PdfViewer.
 *   - Time-handling: `Date.now()` only inside event handlers / callbacks,
 *     never at module top-level (Sprint 12 / 14 / 15 rule).
 *   - Admin-only route — caller (App.tsx) gates with `isAdmin` check before
 *     lazy-importing this module.
 *   - Never exposed to advisor end. The route `/admin/insurance-review-queue`
 *     is intentionally NOT linked from PlannerSidebar / WarRoom.
 *   - Source tagging in UI never says any non-TII source for TII items —
 *     `describeSource()` is the single source of truth.
 * --------------------------------------------------------------------------
 */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Search,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  HandMetal,
  Bot,
  Globe,
  Inbox,
  ArrowDownUp,
  Sparkles,
} from 'lucide-react';
import { auth } from '../firebase';
import {
  describeSource,
  describeType,
  formatSubmittedAt,
  listReviewQueue,
  approveReview,
  rejectReview,
  requestMoreInfo,
  type ReviewQueueItem,
  type ReviewSource,
  type ReviewStatus,
} from '../lib/insuranceReviewQueue';

// PdfViewer ships in Sprint 14 W3 — reuse via lazy import so this scaffold
// route doesn't pull the PDF chunk until an admin clicks「查 PDF」.
const PdfViewer = lazy(() => import('../components/insurance/PdfViewer'));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;
const BULK_LIMIT = 50;

/** Tab → backing status filter. "Reviewing" is a UX bucket that maps to
 *  pending items that have a `reviewedBy` set — we treat it as a virtual
 *  tab on the client side. */
type TabKey = 'pending' | 'reviewing' | 'approved' | 'rejected';

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; status: ReviewStatus | 'all' }> = [
  { key: 'pending', label: '待審', icon: Inbox, status: 'pending' },
  { key: 'reviewing', label: '審核中', icon: Clock, status: 'pending' },
  { key: 'approved', label: '已通過', icon: CheckCircle2, status: 'approved' },
  { key: 'rejected', label: '已退回', icon: XCircle, status: 'rejected' },
];

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function SourceIcon({ source }: { source: ReviewSource }) {
  // Visual hint at-a-glance: hand = crowd, bot = TII crawler, globe = scrape.
  // The describeSource() label below the icon is the authoritative text.
  if (source === 'advisor_crowd') {
    return <HandMetal size={16} className="text-amber-500" aria-hidden />;
  }
  if (source === 'tii_monthly') {
    return <Bot size={16} className="text-blue-500" aria-hidden />;
  }
  return <Globe size={16} className="text-emerald-500" aria-hidden />;
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const map: Record<ReviewStatus, { label: string; cls: string }> = {
    pending: { label: '待審', cls: 'bg-amber-100 text-amber-700 border-amber-300' },
    approved: { label: '已通過', cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    rejected: { label: '已退回', cls: 'bg-rose-100 text-rose-700 border-rose-300' },
    merged: { label: '已併入', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

function TypeBadge({ type }: { type: ReviewQueueItem['type'] }) {
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      {describeType(type)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Diff preview
// ---------------------------------------------------------------------------

function DiffTable({ changes }: { changes: ReviewQueueItem['proposed']['changes'] }) {
  if (!changes.length) {
    return (
      <p className="text-xs text-slate-400 italic py-2">無欄位差異紀錄</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/50">
      <table className="w-full text-xs">
        <thead className="bg-slate-100">
          <tr className="text-left text-slate-600">
            <th className="px-3 py-2 font-semibold">欄位</th>
            <th className="px-3 py-2 font-semibold">變更前</th>
            <th className="px-3 py-2 font-semibold">變更後</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c, i) => (
            <tr key={`${c.field}-${i}`} className="border-t border-slate-200">
              <td className="px-3 py-2 font-mono text-slate-700">{c.field}</td>
              <td className="px-3 py-2 text-rose-600 whitespace-pre-wrap break-words max-w-xs">
                {renderValue(c.before)}
              </td>
              <td className="px-3 py-2 text-emerald-700 whitespace-pre-wrap break-words max-w-xs">
                {renderValue(c.after)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return '[unserializable]';
  }
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface ReviewCardProps {
  item: ReviewQueueItem;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenPdf: () => void;
  onAction: (action: 'approve' | 'reject' | 'need_more_info', item: ReviewQueueItem) => void;
}

function ReviewCard({
  item,
  selected,
  onToggleSelect,
  onOpenPdf,
  onAction,
}: ReviewCardProps) {
  const [diffOpen, setDiffOpen] = useState(false);

  // Note: any decision here writes via the stubbed endpoint and will surface a
  // toast at the page level. We still wire onClick handlers so the layout is
  // representative of the W2 flow.
  return (
    <div
      className={`rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow ${
        selected ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-200'
      }`}
    >
      <div className="p-4 md:p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="mt-1.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            aria-label="選取此筆審核項目"
          />
          <SourceIcon source={item.source} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 truncate">
                {item.proposed.productId || '(unknown product)'}
              </h3>
              <TypeBadge type={item.type} />
              <StatusBadge status={item.status} />
              <span className="text-[10px] text-slate-500 font-mono">
                v{item.proposed.productVersion || '?'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {describeSource(item.source)}
              <span className="mx-1.5 text-slate-300">·</span>
              {formatSubmittedAt(item.submittedAt)}
              <span className="mx-1.5 text-slate-300">·</span>
              提交者：<span className="font-mono">{item.submittedBy || '—'}</span>
            </p>
          </div>
        </div>

        {/* Diff summary */}
        {item.context.diffSummary && (
          <p className="mt-3 text-sm text-slate-700 leading-relaxed">
            {item.context.diffSummary}
          </p>
        )}

        {/* Advisor note */}
        {item.context.advisorNote && (
          <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-800">
              <span className="font-semibold">顧問備註：</span>
              {item.context.advisorNote}
            </p>
          </div>
        )}

        {/* Action row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDiffOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <ArrowDownUp size={14} />
            {diffOpen ? '收起 diff' : `查 diff (${item.proposed.changes.length})`}
          </button>

          <button
            type="button"
            onClick={onOpenPdf}
            disabled={!item.proposed.pdfStoragePath}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={item.proposed.pdfStoragePath ? '檢視提案 PDF' : '此提案無 PDF'}
          >
            <FileText size={14} />
            查 PDF
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAction('need_more_info', item)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
            >
              <AlertCircle size={14} />
              請補資料
            </button>
            <button
              type="button"
              onClick={() => onAction('reject', item)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 hover:text-rose-900 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
            >
              <XCircle size={14} />
              退回
            </button>
            <button
              type="button"
              onClick={() => onAction('approve', item)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle2 size={14} />
              通過
            </button>
          </div>
        </div>

        {/* Collapsible diff */}
        {diffOpen && (
          <div className="mt-3 space-y-3">
            <DiffTable changes={item.proposed.changes} />

            {/* LLM diff placeholder — wire in W2 */}
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Sparkles size={14} className="text-slate-400" />
                <span className="font-semibold">LLM 差異摘要</span>
                <span className="text-slate-400">（Sprint 15 W2 上線）</span>
              </div>
            </div>

            {/* OCR snapshot (sanitized — no client PII) */}
            {item.context.ocrPrefillSnapshot &&
              Object.keys(item.context.ocrPrefillSnapshot).length > 0 && (
                <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <summary className="cursor-pointer text-slate-600 font-medium">
                    OCR 提示快照（{Object.keys(item.context.ocrPrefillSnapshot).length} 欄）
                  </summary>
                  <pre className="mt-2 text-[11px] text-slate-700 whitespace-pre-wrap break-words overflow-x-auto">
                    {JSON.stringify(item.context.ocrPrefillSnapshot, null, 2)}
                  </pre>
                </details>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast (minimal in-component, no new dep — uses utils/toast if available
// at runtime via dynamic import to avoid coupling this scaffold to it)
// ---------------------------------------------------------------------------

function useTinyToast() {
  const [msg, setMsg] = useState<{ text: string; tone: 'info' | 'warn' | 'err' } | null>(null);
  const show = useCallback(
    (text: string, tone: 'info' | 'warn' | 'err' = 'info', durationMs = 3200) => {
      // Time read inside the callback — Sprint 12 rule.
      const t0 = Date.now();
      setMsg({ text, tone });
      window.setTimeout(() => {
        // Don't overwrite a newer toast that arrived after t0.
        setMsg((current) => (current && Date.now() - t0 >= durationMs ? null : current));
      }, durationMs);
    },
    [],
  );
  const node = msg ? (
    <div
      className={`fixed top-4 right-4 z-[200] rounded-lg shadow-lg border px-4 py-3 text-sm max-w-sm ${
        msg.tone === 'err'
          ? 'bg-rose-50 border-rose-200 text-rose-800'
          : msg.tone === 'warn'
          ? 'bg-amber-50 border-amber-200 text-amber-800'
          : 'bg-slate-50 border-slate-200 text-slate-800'
      }`}
      role="status"
    >
      {msg.text}
    </div>
  ) : null;
  return { show, node };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function InsuranceReviewQueue() {
  const [tab, setTab] = useState<TabKey>('pending');
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pdfTarget, setPdfTarget] = useState<ReviewQueueItem | null>(null);
  const { show: showToast, node: toastNode } = useTinyToast();

  // ── Fetch loop ────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];
      // We over-fetch a generous window so client-side pagination + search
      // feel responsive without server cursoring. Admin queue is low-volume.
      const raw = await listReviewQueue(
        { status: activeTab.status === 'all' ? 'all' : (activeTab.status as ReviewStatus) },
        { limit: 200, search: search || undefined },
      );

      // "Reviewing" virtual tab: pending items with reviewedBy set.
      let filtered = raw;
      if (tab === 'reviewing') {
        filtered = raw.filter((it) => it.status === 'pending' && !!it.reviewedBy);
      } else if (tab === 'pending') {
        filtered = raw.filter((it) => it.status === 'pending' && !it.reviewedBy);
      }

      setItems(filtered);
      setPage(0);
    } catch (err) {
      console.warn('[InsuranceReviewQueue] refresh failed:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [items, page],
  );

  // ── Bulk select ───────────────────────────────────────────────────────────
  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllOnPage = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = pageItems.every((it) => next.has(it.id));
      if (allSelected) {
        pageItems.forEach((it) => next.delete(it.id));
      } else {
        // Bulk-approve has a hard cap of 50 items to prevent fat-finger
        // wipeouts. Surface to admin via toast if we hit the limit.
        let added = 0;
        for (const it of pageItems) {
          if (next.size >= BULK_LIMIT) break;
          if (!next.has(it.id)) {
            next.add(it.id);
            added++;
          }
        }
        if (next.size >= BULK_LIMIT) {
          // Time read in callback — Sprint 12 rule.
          showToast(`一次最多選取 ${BULK_LIMIT} 筆，已選滿`, 'warn');
        }
        void added;
      }
      return next;
    });
  }, [pageItems, showToast]);

  // ── Decision handlers (stubbed — W2 wires merge engine) ───────────────────
  const handleAction = useCallback(
    async (action: 'approve' | 'reject' | 'need_more_info', item: ReviewQueueItem) => {
      // Snapshot epoch ms inside the handler (Sprint 12 rule).
      const ts = Date.now();
      try {
        if (action === 'approve') {
          await approveReview(item.id, {
            outcome: 'approved',
            reason: '',
            mergeStrategy: 'as_new_version',
          });
        } else if (action === 'reject') {
          await rejectReview(item.id, '');
        } else {
          await requestMoreInfo(item.id, '');
        }
        showToast(`已記錄決定（${ts}）`, 'info');
      } catch (err: any) {
        // Stubbed — W2 ships the actual merge engine.
        const msg = err?.message || 'unknown error';
        showToast(msg, 'warn', 4500);
        // eslint-disable-next-line no-console
        console.info(
          '[InsuranceReviewQueue] action stubbed:',
          { action, id: item.id, ts },
        );
      }
    },
    [showToast],
  );

  const handleBulkApprove = useCallback(async () => {
    if (selected.size === 0) return;
    showToast(
      `批次通過將在 Sprint 15 W2 上線（已選 ${selected.size} 筆）`,
      'warn',
      4500,
    );
    // eslint-disable-next-line no-console
    console.info('[InsuranceReviewQueue] bulk approve stubbed:', Array.from(selected));
  }, [selected, showToast]);

  // ── Search submit ─────────────────────────────────────────────────────────
  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {toastNode}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-slate-900">
              保險審核佇列
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Sprint 15 W1 scaffold · 決策端點在 W2 啟用 · 管理員：
              <span className="font-mono ml-1">{auth.currentUser?.email || '—'}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            重新整理
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Toolbar */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center gap-3">
        <form onSubmit={onSearchSubmit} className="flex-1 min-w-[240px] max-w-md relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜尋公司 / 商品名 / 代碼"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-white border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
          />
        </form>

        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={
              pageItems.length > 0 && pageItems.every((it) => selected.has(it.id))
            }
            onChange={toggleAllOnPage}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          全選本頁
        </label>

        <button
          type="button"
          onClick={handleBulkApprove}
          disabled={selected.size === 0}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCircle2 size={14} />
          批次通過（{selected.size} / {BULK_LIMIT}）
        </button>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 pb-12">
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 size={28} className="animate-spin mb-3" />
            <span className="text-sm">載入審核佇列…</span>
          </div>
        ) : pageItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Eye size={28} className="mb-3" />
            <span className="text-sm">此分類目前沒有項目</span>
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setSearchInput('');
                }}
                className="mt-3 text-xs text-blue-600 hover:underline"
              >
                清除搜尋
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {pageItems.map((item) => (
              <ReviewCard
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                onToggleSelect={() => toggleOne(item.id)}
                onOpenPdf={() => setPdfTarget(item)}
                onAction={handleAction}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {items.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="inline-flex items-center gap-1 text-sm text-slate-700 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
              上一頁
            </button>
            <span className="text-xs text-slate-500">
              第 {page + 1} / {pageCount} 頁（共 {items.length} 筆）
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="inline-flex items-center gap-1 text-sm text-slate-700 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              下一頁
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </main>

      {/* PDF Viewer modal — lazy chunk shared with Sprint 14 W3 */}
      {pdfTarget && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center">
              <Loader2 size={28} className="animate-spin text-white" />
            </div>
          }
        >
          <PdfViewer
            open
            onClose={() => setPdfTarget(null)}
            productId={pdfTarget.proposed.productId}
            version={pdfTarget.proposed.productVersion}
            advisorEmail={auth.currentUser?.email || undefined}
            citationLabel={describeType(pdfTarget.type)}
          />
        </Suspense>
      )}
    </div>
  );
}
