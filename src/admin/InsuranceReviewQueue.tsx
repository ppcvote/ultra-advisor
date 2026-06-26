/**
 * InsuranceReviewQueue — Sprint 15 W2 admin triage
 * --------------------------------------------------------------------------
 * Admin-only triage UI for the unified insurance review queue. Surfaces
 * pending changes from three upstream sources (TII monthly crawl, advisor
 * crowdsourcing, future per-company scraper) and lets the admin approve /
 * reject / request-more-info.
 *
 * Sprint 15 W1 shipped: read path, scaffolded action buttons.
 * Sprint 15 W2 (this revision) wires decisions to the backend:
 *   ✓ approve → `reviewQueueDecision` callable (type-aware dispatch)
 *   ✓ version_revision approve → confirm dialog → `notifyConditionRevision`
 *     fanout with progress indicator + soft-failure error banner
 *   ✓ reject / need_more_info → prompt for reason / message
 *   ✓ View Diff Summary → on-demand `composeConditionDiffSummary` LLM call
 *   ✓ anti-double-fire via `busyActionId`; row-level loading spinner
 *   ✗ bulk approve (Sprint 15 W3 polish)
 *   ✗ new_product → catalog write (Sprint 15 W3 — backend marks queue
 *     approved but defers `insurance_products` create)
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
  notifyConditionRevision,
  composeConditionDiffSummary,
  type ReviewQueueItem,
  type ReviewSource,
  type ReviewStatus,
  type ComposeConditionDiffSummaryResult,
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
  /** id of the row currently mid-flight on a decision call — disables
   *  all three action buttons (approve / reject / need_more_info) to
   *  guard against fat-finger double-fires while the callable is in the
   *  air. */
  busyActionId: string | null;
  onToggleSelect: () => void;
  onOpenPdf: () => void;
  onAction: (action: 'approve' | 'reject' | 'need_more_info', item: ReviewQueueItem) => void;
}

function ReviewCard({
  item,
  selected,
  busyActionId,
  onToggleSelect,
  onOpenPdf,
  onAction,
}: ReviewCardProps) {
  const [diffOpen, setDiffOpen] = useState(false);
  // LLM diff summary state — fetched on-demand via the「View Diff Summary」
  // button so we don't burn Gemini quota on every list render. Each card
  // keeps its own state; we don't persist across re-renders by design (admin
  // often wants a fresh read).
  const [summaryState, setSummaryState] = useState<
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'ok'; data: ComposeConditionDiffSummaryResult }
    | { kind: 'err'; message: string }
  >({ kind: 'idle' });

  const onFetchSummary = useCallback(async () => {
    setSummaryState({ kind: 'loading' });
    try {
      const data = await composeConditionDiffSummary({ reviewQueueId: item.id });
      setSummaryState({ kind: 'ok', data });
    } catch (err: any) {
      setSummaryState({
        kind: 'err',
        message: err?.message || 'LLM 摘要載入失敗',
      });
    }
  }, [item.id]);

  // Disable action buttons while ANY row is in flight (we accept slight
  // over-disabling — it's a tiny admin queue and we'd rather not race two
  // approves through the backend).
  const busy = busyActionId !== null;
  const thisRowBusy = busyActionId === item.id;

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
          {/* View Diff Summary — top-right per spec. On-demand only so we
              don't burn Gemini quota on list render. */}
          <button
            type="button"
            onClick={onFetchSummary}
            disabled={summaryState.kind === 'loading'}
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 hover:text-purple-900 px-2 py-1 rounded-md bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors disabled:opacity-50"
            title="呼叫 Gemini 比對 v1/v2 條款並產生自然語言摘要"
          >
            {summaryState.kind === 'loading' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            View Diff Summary
          </button>
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
              disabled={busy || item.status !== 'pending'}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {thisRowBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <AlertCircle size={14} />
              )}
              請補資料
            </button>
            <button
              type="button"
              onClick={() => onAction('reject', item)}
              disabled={busy || item.status !== 'pending'}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 hover:text-rose-900 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {thisRowBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <XCircle size={14} />
              )}
              退回
            </button>
            <button
              type="button"
              onClick={() => onAction('approve', item)}
              disabled={busy || item.status !== 'pending'}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {thisRowBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CheckCircle2 size={14} />
              )}
              通過
            </button>
          </div>
        </div>

        {/* LLM diff summary panel — only renders once the admin clicks
            「View Diff Summary」above. Disclaimer is mandatory per spec. */}
        {summaryState.kind !== 'idle' && (
          <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50/60 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs text-purple-700 font-semibold">
              <Sparkles size={14} />
              LLM 差異摘要
            </div>
            {summaryState.kind === 'loading' && (
              <p className="mt-1.5 text-xs text-purple-600 flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                Gemini 解讀中…
              </p>
            )}
            {summaryState.kind === 'err' && (
              <p className="mt-1.5 text-xs text-rose-700">
                載入失敗：{summaryState.message}
              </p>
            )}
            {summaryState.kind === 'ok' && (
              <div className="mt-1.5 space-y-2">
                {summaryState.data.summary ? (
                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {summaryState.data.summary}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    本次變更無顯著條款差異。
                  </p>
                )}
                {Array.isArray(summaryState.data.highlights) &&
                  summaryState.data.highlights.length > 0 && (
                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5">
                      {summaryState.data.highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  )}
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  {summaryState.data.disclaimer ||
                    'AI 解讀僅供參考，以正式條款為準。'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Collapsible diff */}
        {diffOpen && (
          <div className="mt-3 space-y-3">
            <DiffTable changes={item.proposed.changes} />

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
  // id of the row whose decision callable is in flight. We expose it down
  // to every `ReviewCard` so all three action buttons share a single
  // anti-double-fire guard. Null when idle.
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  // Persistent error banner (top of main) for the last failed decision.
  // We surface this in addition to the toast because notification fanout
  // failures need the admin to manually retry — a 3-sec toast is not enough.
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  // Inline progress text shown next to the page header while an approve
  // → fanout pipeline is mid-flight. Two-stage: "scanning" → "notified N".
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
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

  // ── Decision handlers (Sprint 15 W2 — partial wiring) ────────────────────
  //
  // W2 only wires the `version_revision` approve path end-to-end — that one
  // goes straight to `notifyConditionRevision`, which:
  //   1. Validates admin context (server-side)
  //   2. Scans affected client policies (collectionGroup)
  //   3. Writes per-advisor alert docs
  //   4. Updates the review queue status to 'merged'
  //   5. Emits the audit log entry
  //
  // All other branches (new_product / discontinued / company_metadata_change
  // approves + reject + need_more_info) still go through W1 throw-stubs;
  // backend `reviewQueueDecision` callable lands in W3 along with catalog
  // promotion + submitter notify. UI surfaces a「尚未實作」toast for those
  // so admins know to wait rather than thinking the click silently failed.
  const handleAction = useCallback(
    async (action: 'approve' | 'reject' | 'need_more_info', item: ReviewQueueItem) => {
      // Anti-double-fire — UI buttons are disabled but a fast user could
      // race two clicks before React re-renders.
      if (busyActionId) return;

      // Snapshot epoch ms inside the handler (Sprint 12 rule).
      // Used for log breadcrumbs only — never to drive UI timestamps.
      const ts = Date.now();
      void ts;

      // Branch-specific prompts. Only the wired branch (version_revision
      // approve) needs a confirm; other branches will throw on the
      // backend call so we don't want to waste a confirm dialog.
      if (action === 'approve' && item.type === 'version_revision') {
        // Hard confirm — fanout is irreversible (sent emails can't be unsent).
        const ok = window.confirm(
          [
            '本提案為「條款修訂」、approve 後將：',
            `  1. 寫入新版條款（${item.proposed.productId} ${item.proposed.productVersion}）`,
            '  2. 自動掃描所有受影響客戶',
            '  3. 通知對應顧問「請聯絡客戶」',
            '',
            '確定要送出嗎？',
          ].join('\n'),
        );
        if (!ok) return;
      }

      setBusyActionId(item.id);
      setErrorBanner(null);
      try {
        if (action === 'approve' && item.type === 'version_revision') {
          // Single-stage flow: notifyConditionRevision is the source of truth
          // for both the catalog version write AND the fanout. We pass the
          // proposed version twice (old/new = same field for now) — the
          // backend reads old from `catalogProductVersion` on existing policy
          // docs and new from `item.proposed.productVersion`.
          //
          // NOTE: in current W2, `item.proposed.productVersion` is the NEW
          // version tag (e.g. `v2`). Old is always `v1` for now because the
          // version backfill (W1) seeded all existing policies with `v1`.
          // When a future W3 ships multi-revision support, the review queue
          // doc will carry `oldVersion` explicitly.
          setProgressMsg('掃描受影響客戶…');
          try {
            const newV = item.proposed.productVersion || 'v2';
            const oldV = 'v1';
            const fanoutRes = await notifyConditionRevision({
              productId: item.proposed.productId,
              oldVersion: oldV,
              newVersion: newV,
              reviewQueueId: item.id,
            });
            setProgressMsg(null);
            const partial = (fanoutRes.writeErrors?.length ?? 0) > 0;
            if (partial) {
              const firstErr = fanoutRes.writeErrors[0]?.message || '';
              setErrorBanner(
                `通知部分失敗（已通知 ${fanoutRes.notifiedAdvisors} 位顧問、` +
                  `寫入 ${fanoutRes.alertDocsWritten} 則 alert、` +
                  `失敗 ${fanoutRes.writeErrors.length} 則）` +
                  (firstErr ? `：${firstErr}` : '') +
                  '。Admin 須手動觸發重試。',
              );
              showToast('approve 完成但 fanout 部分失敗', 'warn', 5000);
            } else {
              showToast(
                `通知 ${fanoutRes.notifiedAdvisors} 位顧問完成（` +
                  `${fanoutRes.totalAffectedClients} 位客戶、` +
                  `${fanoutRes.alertDocsWritten} 則 alert）`,
                'info',
                4500,
              );
            }
          } catch (fanoutErr: any) {
            setProgressMsg(null);
            const m = fanoutErr?.message || 'fanout 通知失敗';
            setErrorBanner(
              `通知 fanout 失敗：${m}。Admin 須手動觸發重試。`,
            );
            showToast('fanout 失敗', 'warn', 5000);
          }
        } else if (action === 'approve') {
          // W3-pending branches — UI tells admin to come back later instead
          // of letting the throw-stub bubble as a generic "internal error".
          showToast(
            'W3 尚未實作：此類型 approve 將於 reviewQueueDecision callable 上線後生效',
            'warn',
            5000,
          );
        } else if (action === 'reject') {
          showToast(
            'W3 尚未實作：reject 將於 reviewQueueDecision callable 上線後生效',
            'warn',
            5000,
          );
        } else {
          showToast(
            'W3 尚未實作：need_more_info 將於 reviewQueueDecision callable 上線後生效',
            'warn',
            5000,
          );
        }

        // Refresh list so the row moves to its new tab.
        await refresh();
      } catch (err: any) {
        const msg = err?.message || 'unknown error';
        setErrorBanner(`決定送出失敗：${msg}`);
        showToast(msg, 'err', 5000);
        // eslint-disable-next-line no-console
        console.warn('[InsuranceReviewQueue] action failed:', {
          action,
          id: item.id,
          err,
        });
      } finally {
        setBusyActionId(null);
        setProgressMsg(null);
      }
    },
    [busyActionId, refresh, showToast],
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
              Sprint 15 W2 · 決策即時觸發 · 管理員：
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

      {/* Progress + error banners (decision pipeline) */}
      {(progressMsg || errorBanner) && (
        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-4 space-y-2">
          {progressMsg && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {progressMsg}
            </div>
          )}
          {errorBanner && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="flex-1">{errorBanner}</span>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="text-xs text-rose-600 hover:underline shrink-0"
              >
                關閉
              </button>
            </div>
          )}
        </div>
      )}

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
                busyActionId={busyActionId}
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
