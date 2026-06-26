/**
 * ConditionAlerts — Sprint 15 W2 advisor-side dashboard
 * --------------------------------------------------------------------------
 * 「待聯絡客戶（條款修訂）」— the advisor-facing inbox for revision alerts
 * fanned out by the W2 `notifyConditionRevision` callable.
 *
 * Route mounts (App.tsx, also lazy):
 *   - /dashboard/condition-alerts            → list (this component)
 *   - /dashboard/condition-alerts/:alertId   → list with detail card auto-
 *     expanded for the deeplinked id (same component, parses URL).
 *
 * Boundary rules:
 *   - No new npm deps. lucide-react icons + Tailwind utility classes only.
 *   - Time-handling: Date.now() / new Date() only inside event handlers /
 *     callbacks, never at module top-level (Sprint 12 / 14 / 15 rule).
 *   - PII: never render full client name / phone / ID. We only show
 *     `clientNameMasked`. Full name shows up on the per-client policy page
 *     (separate route, separate rules check).
 *   - The LLM diff summary is always rendered with the
 *     `DIFF_AI_DISCLAIMER` chip; this is a compliance hard rule.
 *   - The advisor never sees another advisor's alerts — query is anchored
 *     at auth.uid in `listMyAlerts()` and firestore.rules enforce the
 *     boundary. UI does not assume otherwise.
 *   - "Mark all as contacted (top 50)" bulk action stays bounded to the
 *     first 50 affected clients of the currently-open alert — keeps the
 *     fat-finger blast radius small and matches the Sprint 15 W1 bulk
 *     limit pattern.
 * --------------------------------------------------------------------------
 */
import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Inbox,
  Loader2,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';

import { auth } from '../firebase';
import { toast } from '../utils/toast';
import {
  DIFF_AI_DISCLAIMER,
  describeContactStatus,
  describeSeverity,
  describeStatus,
  formatAlertTime,
  formatSumAssured,
  getAlert,
  listMyAlerts,
  updateClientContactStatus,
  type AffectedClient,
  type AlertSeverity,
  type AlertStatus,
  type ConditionAlert,
  type ContactStatus,
  type ImportantChange,
} from '../lib/conditionAlerts';

// PdfViewer ships in Sprint 14 W3 — reuse via lazy so the dashboard chunk
// doesn't drag PDF rendering into first paint. Same pattern as
// admin/InsuranceReviewQueue.tsx.
const PdfViewer = lazy(() => import('../components/insurance/PdfViewer'));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BULK_MARK_LIMIT = 50;
const PAGE_LIMIT = 100;

const STATUS_TABS: Array<{
  key: AlertStatus | 'all';
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { key: 'pending', label: '待聯絡', icon: Inbox },
  { key: 'partial', label: '部分完成', icon: Clock },
  { key: 'completed', label: '已完成', icon: CheckCircle2 },
  { key: 'all', label: '全部', icon: Eye },
];

const CONTACT_STATUS_OPTIONS: ContactStatus[] = [
  'pending',
  'contacted',
  'no_impact',
  'meeting_scheduled',
];

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const map: Record<AlertSeverity, string> = {
    high: 'bg-rose-100 text-rose-700 border-rose-300',
    medium: 'bg-orange-100 text-orange-700 border-orange-300',
    low: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  };
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map[severity]}`}
    >
      {describeSeverity(severity)}
    </span>
  );
}

function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const map: Record<AlertStatus, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-300',
    partial: 'bg-sky-100 text-sky-700 border-sky-300',
    completed: 'bg-slate-100 text-slate-600 border-slate-300',
  };
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map[status]}`}
    >
      {describeStatus(status)}
    </span>
  );
}

function ImpactDot({ impact }: { impact: ImportantChange['impact'] }) {
  const cls =
    impact === 'high'
      ? 'bg-rose-500'
      : impact === 'medium'
      ? 'bg-orange-400'
      : 'bg-emerald-500';
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${cls} flex-shrink-0`}
      aria-label={`影響${describeSeverity(impact)}`}
    />
  );
}

function AiDisclaimerChip() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
      <Sparkles size={10} aria-hidden />
      {DIFF_AI_DISCLAIMER}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Summary header card
// ---------------------------------------------------------------------------

interface SummaryCounts {
  pending: number;
  partial: number;
  completed: number;
  highSeverity: number;
  mediumSeverity: number;
  lowSeverity: number;
  totalAlerts: number;
  totalAffectedClients: number;
}

function computeCounts(alerts: ConditionAlert[]): SummaryCounts {
  const out: SummaryCounts = {
    pending: 0,
    partial: 0,
    completed: 0,
    highSeverity: 0,
    mediumSeverity: 0,
    lowSeverity: 0,
    totalAlerts: alerts.length,
    totalAffectedClients: 0,
  };
  for (const a of alerts) {
    if (a.status === 'pending') out.pending++;
    else if (a.status === 'partial') out.partial++;
    else out.completed++;
    if (a.severity === 'high') out.highSeverity++;
    else if (a.severity === 'medium') out.mediumSeverity++;
    else out.lowSeverity++;
    out.totalAffectedClients += a.affectedClients.length;
  }
  return out;
}

function SummaryCard({ counts }: { counts: SummaryCounts }) {
  const cell = 'flex flex-col gap-1';
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-sm">
        <div className={cell}>
          <span className="text-xs text-slate-500">通知總數</span>
          <span className="text-xl font-bold text-slate-900">
            {counts.totalAlerts}
          </span>
        </div>
        <div className={cell}>
          <span className="text-xs text-slate-500">受影響客戶</span>
          <span className="text-xl font-bold text-slate-900">
            {counts.totalAffectedClients}
          </span>
        </div>
        <div className={cell}>
          <span className="text-xs text-amber-600">待聯絡</span>
          <span className="text-xl font-bold text-amber-700">
            {counts.pending}
          </span>
        </div>
        <div className={cell}>
          <span className="text-xs text-sky-600">部分完成</span>
          <span className="text-xl font-bold text-sky-700">
            {counts.partial}
          </span>
        </div>
        <div className={cell}>
          <span className="text-xs text-slate-500">已完成</span>
          <span className="text-xl font-bold text-slate-700">
            {counts.completed}
          </span>
        </div>
        <div className={cell}>
          <span className="text-xs text-slate-500">嚴重程度</span>
          <span className="text-sm font-semibold flex items-center gap-1.5">
            <span className="text-rose-600">{counts.highSeverity} 高</span>
            <span className="text-slate-300">·</span>
            <span className="text-orange-600">
              {counts.mediumSeverity} 中
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-emerald-600">{counts.lowSeverity} 低</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Affected client row (responsive: table row on md+, card on sm)
// ---------------------------------------------------------------------------

interface ClientRowProps {
  client: AffectedClient;
  busy: boolean;
  onChangeStatus: (status: ContactStatus) => void;
  onSaveNote: (note: string) => void;
  onOpenClientDetail: () => void;
}

function ClientRow({
  client,
  busy,
  onChangeStatus,
  onSaveNote,
  onOpenClientDetail,
}: ClientRowProps) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(client.contactNote || '');

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value as ContactStatus;
      if (next === client.contactStatus) return;
      if (next === 'pending') return; // 不允許回退
      onChangeStatus(next);
    },
    [client.contactStatus, onChangeStatus],
  );

  return (
    <>
      {/* md+ table row */}
      <tr className="hidden md:table-row border-t border-slate-200 hover:bg-slate-50">
        <td className="px-3 py-2.5 text-sm text-slate-800">
          <span className="font-medium">{client.clientNameMasked}</span>
          <div className="text-[11px] text-slate-400 font-mono">
            {client.policyId || '—'}
          </div>
        </td>
        <td className="px-3 py-2.5 text-sm text-slate-700 text-right whitespace-nowrap">
          {formatSumAssured(client.sumAssured)}
        </td>
        <td className="px-3 py-2.5">
          <select
            value={client.contactStatus}
            onChange={handleStatusChange}
            disabled={busy}
            className="text-xs rounded-lg border border-slate-300 bg-white px-2 py-1 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50"
          >
            {CONTACT_STATUS_OPTIONS.map((s) => (
              <option
                key={s}
                value={s}
                disabled={s === 'pending' && client.contactStatus !== 'pending'}
              >
                {describeContactStatus(s)}
              </option>
            ))}
          </select>
          {client.contactedAt && (
            <div className="text-[10px] text-slate-400 mt-0.5">
              {formatAlertTime(client.contactedAt)}
            </div>
          )}
        </td>
        <td className="px-3 py-2.5 text-sm text-slate-700 min-w-[200px]">
          {editingNote ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="例如：6/30 見面"
                className="flex-1 text-xs rounded-lg border border-slate-300 bg-white px-2 py-1 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                maxLength={120}
              />
              <button
                type="button"
                onClick={() => {
                  onSaveNote(noteDraft);
                  setEditingNote(false);
                }}
                disabled={busy}
                className="text-xs font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50"
              >
                存
              </button>
              <button
                type="button"
                onClick={() => {
                  setNoteDraft(client.contactNote || '');
                  setEditingNote(false);
                }}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingNote(true)}
              className="text-xs text-slate-600 hover:text-slate-900 text-left w-full"
            >
              {client.contactNote ? (
                <span>{client.contactNote}</span>
              ) : (
                <span className="text-slate-400 italic">＋ 加備註</span>
              )}
            </button>
          )}
        </td>
        <td className="px-3 py-2.5 text-right">
          <button
            type="button"
            onClick={onOpenClientDetail}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            客戶詳情
            <ExternalLink size={11} />
          </button>
        </td>
      </tr>

      {/* sm card */}
      <tr className="md:hidden">
        <td colSpan={5} className="p-0">
          <div className="border-t border-slate-200 p-3 bg-white">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                  {client.clientNameMasked}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {client.policyId || '—'}
                </div>
              </div>
              <div className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                {formatSumAssured(client.sumAssured)}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <select
                value={client.contactStatus}
                onChange={handleStatusChange}
                disabled={busy}
                className="text-xs rounded-lg border border-slate-300 bg-white px-2 py-1 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none disabled:opacity-50"
              >
                {CONTACT_STATUS_OPTIONS.map((s) => (
                  <option
                    key={s}
                    value={s}
                    disabled={
                      s === 'pending' && client.contactStatus !== 'pending'
                    }
                  >
                    {describeContactStatus(s)}
                  </option>
                ))}
              </select>
              {client.contactedAt && (
                <span className="text-[10px] text-slate-400">
                  {formatAlertTime(client.contactedAt)}
                </span>
              )}
            </div>
            <div className="mt-2">
              {editingNote ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="例如：6/30 見面"
                    className="flex-1 text-xs rounded-lg border border-slate-300 bg-white px-2 py-1 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                    maxLength={120}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onSaveNote(noteDraft);
                      setEditingNote(false);
                    }}
                    disabled={busy}
                    className="text-xs font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50"
                  >
                    存
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingNote(true)}
                  className="text-xs text-slate-600 hover:text-slate-900"
                >
                  {client.contactNote ? (
                    <span>{client.contactNote}</span>
                  ) : (
                    <span className="text-slate-400 italic">＋ 加備註</span>
                  )}
                </button>
              )}
            </div>
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={onOpenClientDetail}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                客戶詳情
                <ExternalLink size={11} />
              </button>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}

// ---------------------------------------------------------------------------
// Important-changes list
// ---------------------------------------------------------------------------

function ImportantChangesList({
  changes,
}: {
  changes: ImportantChange[];
}) {
  if (!changes.length) {
    return (
      <p className="text-xs text-slate-400 italic">無細項變更紀錄</p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {changes.map((c, i) => (
        <li
          key={`${c.category}-${i}`}
          className="flex items-start gap-2 text-sm leading-relaxed"
        >
          <span className="mt-1.5">
            <ImpactDot impact={c.impact} />
          </span>
          <span className="text-slate-700">
            <span className="font-semibold text-slate-900">{c.category}：</span>
            {c.change}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Alert card (collapsible)
// ---------------------------------------------------------------------------

interface AlertCardProps {
  alert: ConditionAlert;
  expanded: boolean;
  onToggleExpand: () => void;
  onChangeClientStatus: (
    clientUid: string,
    status: ContactStatus,
    note?: string,
  ) => Promise<void>;
  onOpenPdf: (version: 'old' | 'new') => void;
  onOpenClientDetail: (clientUid: string) => void;
  onMarkAllContacted: () => Promise<void>;
  busyClientUid: string | null;
  bulkBusy: boolean;
}

function AlertCard({
  alert,
  expanded,
  onToggleExpand,
  onChangeClientStatus,
  onOpenPdf,
  onOpenClientDetail,
  onMarkAllContacted,
  busyClientUid,
  bulkBusy,
}: AlertCardProps) {
  const contactSummary = useMemo(() => {
    let pending = 0;
    let contacted = 0;
    let noImpact = 0;
    let meeting = 0;
    for (const c of alert.affectedClients) {
      if (c.contactStatus === 'pending') pending++;
      else if (c.contactStatus === 'contacted') contacted++;
      else if (c.contactStatus === 'no_impact') noImpact++;
      else if (c.contactStatus === 'meeting_scheduled') meeting++;
    }
    return { pending, contacted, noImpact, meeting };
  }, [alert.affectedClients]);

  return (
    <div
      className={`rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow ${
        alert.severity === 'high'
          ? 'border-rose-200'
          : alert.severity === 'medium'
          ? 'border-orange-200'
          : 'border-slate-200'
      }`}
    >
      <div className="p-4 md:p-5">
        {/* Header */}
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <SeverityBadge severity={alert.severity} />
              <AlertStatusBadge status={alert.status} />
              <span className="text-[11px] text-slate-500">
                {formatAlertTime(alert.createdAt)}
              </span>
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-900 truncate">
              {alert.productName || alert.productId || '(未命名商品)'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {alert.companyName ? (
                <>
                  <span>{alert.companyName}</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                </>
              ) : null}
              <span>
                條款修訂 v{alert.oldVersion || '?'} → v
                {alert.newVersion || '?'}
              </span>
              <span className="mx-1.5 text-slate-300">·</span>
              <span className="inline-flex items-center gap-1">
                <Users size={11} aria-hidden />
                {alert.affectedClients.length} 位受影響
              </span>
            </p>
            <p className="text-xs text-slate-600 mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="text-amber-700">
                待聯絡 {contactSummary.pending}
              </span>
              <span className="text-emerald-700">
                已聯絡 {contactSummary.contacted}
              </span>
              <span className="text-slate-500">
                無影響 {contactSummary.noImpact}
              </span>
              <span className="text-blue-700">
                已約面談 {contactSummary.meeting}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors flex-shrink-0"
          >
            {expanded ? (
              <>
                <ChevronUp size={14} /> 收起
              </>
            ) : (
              <>
                <ChevronDown size={14} /> 查看詳情
              </>
            )}
          </button>
        </div>

        {/* Quick-glance diff summary even when collapsed */}
        {!expanded && alert.diffSummary && (
          <p className="mt-3 text-sm text-slate-700 leading-relaxed line-clamp-2">
            {alert.diffSummary}
          </p>
        )}

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-4 space-y-4">
            {/* LLM summary block */}
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 md:p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles
                  size={14}
                  className="text-violet-600"
                  aria-hidden
                />
                <span className="text-xs font-semibold text-violet-800">
                  條款差異摘要
                </span>
                <AiDisclaimerChip />
              </div>
              {alert.diffSummary ? (
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {alert.diffSummary}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">無摘要</p>
              )}
              <div className="mt-3">
                <ImportantChangesList changes={alert.importantChanges} />
              </div>
            </div>

            {/* PDF buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenPdf('new')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <FileText size={14} />
                查看條款 v{alert.newVersion || '?'} 原文
              </button>
              <button
                type="button"
                onClick={() => onOpenPdf('old')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <FileText size={14} />
                查看條款 v{alert.oldVersion || '?'} 原文（對比）
              </button>
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={onMarkAllContacted}
                  disabled={
                    bulkBusy ||
                    contactSummary.pending === 0 ||
                    alert.affectedClients.length === 0
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={`一鍵把前 ${BULK_MARK_LIMIT} 位「待聯絡」改為「已聯絡」`}
                >
                  {bulkBusy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  全部標為已聯絡（前 {BULK_MARK_LIMIT}）
                </button>
              </div>
            </div>

            {/* Affected clients table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="hidden md:table-header-group bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-3 py-2 font-semibold">客戶</th>
                    <th className="px-3 py-2 font-semibold text-right">
                      保額
                    </th>
                    <th className="px-3 py-2 font-semibold">聯絡狀態</th>
                    <th className="px-3 py-2 font-semibold">備註</th>
                    <th className="px-3 py-2 font-semibold text-right">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {alert.affectedClients.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center text-xs text-slate-400 italic py-6"
                      >
                        無受影響客戶
                      </td>
                    </tr>
                  ) : (
                    alert.affectedClients.map((c) => (
                      <ClientRow
                        key={c.clientUid}
                        client={c}
                        busy={busyClientUid === c.clientUid}
                        onChangeStatus={(status) =>
                          onChangeClientStatus(c.clientUid, status)
                        }
                        onSaveNote={(note) =>
                          onChangeClientStatus(
                            c.clientUid,
                            c.contactStatus === 'pending'
                              ? 'contacted'
                              : c.contactStatus,
                            note,
                          )
                        }
                        onOpenClientDetail={() =>
                          onOpenClientDetail(c.clientUid)
                        }
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface PdfTarget {
  productId: string;
  version: string;
  label: string;
}

export default function ConditionAlerts() {
  // ── URL deeplink: /dashboard/condition-alerts/:alertId ────────────────────
  const initialDeepLinkId = useMemo(() => {
    try {
      const m = window.location.pathname.match(
        /^\/dashboard\/condition-alerts\/([^/]+)\/?$/,
      );
      return m ? decodeURIComponent(m[1]) : null;
    } catch {
      return null;
    }
  }, []);

  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>(
    'pending',
  );
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>(
    'all',
  );
  const [productFilter, setProductFilter] = useState<string>('all');
  const [alerts, setAlerts] = useState<ConditionAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(initialDeepLinkId ? [initialDeepLinkId] : []),
  );
  const [busyClientKey, setBusyClientKey] = useState<string | null>(null);
  const [bulkBusyAlertId, setBulkBusyAlertId] = useState<string | null>(null);
  const [pdfTarget, setPdfTarget] = useState<PdfTarget | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listMyAlerts(
        {
          status: statusFilter,
          severity: severityFilter === 'all' ? undefined : severityFilter,
          productId: productFilter === 'all' ? undefined : productFilter,
        },
        { limit: PAGE_LIMIT },
      );
      setAlerts(list);
    } catch (err) {
      console.warn('[ConditionAlerts] refresh failed:', err);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, productFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Deeplink: pull a single alert that isn't on the current filter page ───
  useEffect(() => {
    if (!initialDeepLinkId) return;
    if (alerts.some((a) => a.id === initialDeepLinkId)) return;
    let cancelled = false;
    (async () => {
      const single = await getAlert(initialDeepLinkId);
      if (cancelled || !single) return;
      setAlerts((prev) => {
        // Prepend if not already present.
        if (prev.some((a) => a.id === single.id)) return prev;
        return [single, ...prev];
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [initialDeepLinkId, alerts]);

  // ── Filter dropdown options ───────────────────────────────────────────────
  const productOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of alerts) {
      if (!map.has(a.productId)) {
        map.set(a.productId, a.productName || a.productId);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [alerts]);

  const counts = useMemo(() => computeCounts(alerts), [alerts]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const handleChangeClientStatus = useCallback(
    async (
      alertId: string,
      clientUid: string,
      status: ContactStatus,
      note?: string,
    ) => {
      // Pending is "no-op" — the dropdown disables it but we double-check.
      if (status === 'pending') return;
      const key = `${alertId}::${clientUid}`;
      setBusyClientKey(key);
      try {
        await updateClientContactStatus(alertId, clientUid, status, note);
        // Optimistic refresh by re-running the query — keeps UI in sync
        // with the rolled-up `status` field that the writer computes.
        await refresh();
        toast.success('已更新聯絡狀態');
      } catch (err: any) {
        console.warn('[ConditionAlerts] updateClientContactStatus failed:', err);
        toast.error(err?.message || '更新失敗，請稍後再試');
      } finally {
        setBusyClientKey(null);
      }
    },
    [refresh],
  );

  const handleMarkAllContacted = useCallback(
    async (alert: ConditionAlert) => {
      const targets = alert.affectedClients
        .filter((c) => c.contactStatus === 'pending')
        .slice(0, BULK_MARK_LIMIT);
      if (targets.length === 0) return;

      setBulkBusyAlertId(alert.id);
      let ok = 0;
      let fail = 0;
      try {
        // Sequential to keep within rules / avoid the 1-write-per-doc race
        // (we re-read the doc each time inside `updateClientContactStatus`
        // because we splice the array client-side).
        for (const c of targets) {
          try {
            await updateClientContactStatus(alert.id, c.clientUid, 'contacted');
            ok++;
          } catch (err) {
            console.warn(
              '[ConditionAlerts] bulk mark one failed:',
              c.clientUid,
              err,
            );
            fail++;
          }
        }
        await refresh();
        if (fail === 0) {
          toast.success(`已標記 ${ok} 位客戶為已聯絡`);
        } else {
          toast.warning(`已標記 ${ok} 位、${fail} 位失敗`);
        }
      } finally {
        setBulkBusyAlertId(null);
      }
    },
    [refresh],
  );

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleOpenPdf = useCallback(
    (alert: ConditionAlert, which: 'old' | 'new') => {
      const version = which === 'new' ? alert.newVersion : alert.oldVersion;
      setPdfTarget({
        productId: alert.productId,
        version,
        label: `條款 v${version || '?'}`,
      });
    },
    [],
  );

  const handleOpenClientDetail = useCallback((clientUid: string) => {
    if (!clientUid) return;
    // The client policy detail page lives outside this dashboard; the
    // canonical entry is the WarRoom → 客戶列表 → 客戶詳情 flow. For now we
    // route by query param so existing WarRoom logic picks it up.
    try {
      window.history.pushState({}, '', `/?clientId=${encodeURIComponent(clientUid)}`);
      window.location.reload();
    } catch (err) {
      console.warn('[ConditionAlerts] open client detail failed:', err);
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              待聯絡客戶（條款修訂）
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              條款一改、客戶權益就可能變。Sprint 15 W2 上線。 ·{' '}
              <span className="font-mono">
                {auth.currentUser?.email || '—'}
              </span>
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

        {/* Status tabs */}
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex gap-1 overflow-x-auto">
          {STATUS_TABS.map((t) => {
            const Icon = t.icon;
            const active = statusFilter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setStatusFilter(t.key)}
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

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-4">
        {/* Summary */}
        <SummaryCard counts={counts} />

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 md:p-4 shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Filter size={14} />
            篩選
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            嚴重程度
            <select
              value={severityFilter}
              onChange={(e) =>
                setSeverityFilter(e.target.value as AlertSeverity | 'all')
              }
              className="text-xs rounded-lg border border-slate-300 bg-white px-2 py-1 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            >
              <option value="all">全部</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            商品
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 bg-white px-2 py-1 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none max-w-[240px]"
            >
              <option value="all">全部</option>
              {productOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Alert list */}
        {loading && alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 size={28} className="animate-spin mb-3" />
            <span className="text-sm">載入通知…</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-16 text-center text-slate-400">
            <Eye size={28} className="mx-auto mb-3" />
            <p className="text-sm">目前沒有此分類的通知</p>
            <p className="text-xs mt-1">
              當有保險公司條款修訂、且影響你客戶的保單時，會自動在這裡列出。
            </p>
          </div>
        ) : (
          <div className="space-y-3 md:space-y-4">
            {alerts.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                expanded={expandedIds.has(a.id)}
                onToggleExpand={() => handleToggleExpand(a.id)}
                onChangeClientStatus={(clientUid, status, note) =>
                  handleChangeClientStatus(a.id, clientUid, status, note)
                }
                onOpenPdf={(which) => handleOpenPdf(a, which)}
                onOpenClientDetail={handleOpenClientDetail}
                onMarkAllContacted={() => handleMarkAllContacted(a)}
                busyClientUid={
                  busyClientKey && busyClientKey.startsWith(`${a.id}::`)
                    ? busyClientKey.slice(a.id.length + 2)
                    : null
                }
                bulkBusy={bulkBusyAlertId === a.id}
              />
            ))}
          </div>
        )}
      </main>

      {/* PDF Viewer — lazy chunk shared with Sprint 14 W3 */}
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
            productId={pdfTarget.productId}
            version={pdfTarget.version}
            advisorEmail={auth.currentUser?.email || undefined}
            citationLabel={pdfTarget.label}
          />
        </Suspense>
      )}
    </div>
  );
}
