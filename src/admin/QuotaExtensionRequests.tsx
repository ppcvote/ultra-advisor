/**
 * QuotaExtensionRequests — Sprint 15 W3 admin triage
 * --------------------------------------------------------------------------
 * Admin-only triage UI for `quota_extension_requests`. Sprint 14 W2 shipped
 * the advisor-side write path (form in the agent chat → request doc); this
 * Sprint 15 W3 module surfaces those pending requests and lets an admin
 * approve / reject them via the `approveQuotaExtension` callable.
 *
 * UX summary:
 *   - Header: pending count + filter chips (pending / approved / rejected / all)
 *   - Cards: requester (email + display name) · ask/pdf current usage ·
 *            申請理由 · 申請時間 · Approve / Reject buttons
 *   - Approve dialog: custom extension amount (asks default +50 / pdfViews +25)
 *   - Reject dialog: reason required
 *
 * Boundary rules:
 *   - No new npm deps — lucide-react icons, Tailwind, existing firebase SDK.
 *   - Time-handling: `Date.now()` only inside event handlers / callbacks,
 *     never at module top-level (Sprint 12 / 14 / 15 rule).
 *   - Admin-only route — caller (App.tsx) gates with `isAdmin` check before
 *     lazy-importing this module. Firestore rules also enforce read/update
 *     on `quota_extension_requests` to admin-only.
 *   - Anti-double-fire via `busyActionId`; row-level loading spinner.
 *   - Never surfaces 客戶 PII — only displays requester advisor info (email
 *     + display name) which they already have on their own account.
 * --------------------------------------------------------------------------
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Inbox,
  Mail,
  User,
  Sparkles,
  Hash,
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RequestStatus = 'pending' | 'approved' | 'rejected';

interface QuotaExtensionRequest {
  id: string;
  requesterUid: string;
  requesterEmail?: string;
  targetYyyymm?: string;
  /** 顧問填寫的申請理由 — 不含 PII（form 端應提示「請勿輸入客戶姓名/ID」） */
  reasonForRequest?: string;
  /** 顧問當下的用量 snapshot —— 顯示用 */
  currentUsage?: {
    asks?: { used: number; limit: number } | number;
    pdfViews?: { used: number; limit: number } | number;
  };
  /** 顧問選擇要增哪些 quota 類型 (form 多選) */
  requestedScope?: Array<'asks' | 'pdfViews'>;
  status: RequestStatus;
  submittedAt?: { seconds: number; nanoseconds: number } | number | null;
  submittedAtMs?: number;
  approvedBy?: string;
  approvedAtMs?: number;
  rejectedBy?: string;
  rejectedAtMs?: number;
  reason?: string;
  extensionAmount?: { asks: number; pdfViews: number };
}

interface RequesterProfile {
  displayName?: string;
  email?: string;
}

interface ApproveCallableResult {
  ok: boolean;
  requestId: string;
  decision: 'approve' | 'reject';
  extensionAmount: { asks: number; pdfViews: number } | null;
  yyyymm: string;
  emailDispatched: { dryRun: boolean; sent: boolean; error?: string | null };
}

interface ApproveCallableInput {
  requestId: string;
  decision: 'approve' | 'reject';
  extensionAmount?: { asks?: number; pdfViews?: number };
  reason?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

const DEFAULT_EXTENSION = { asks: 50, pdfViews: 25 };
const MAX_EXTENSION = { asks: 500, pdfViews: 250 };

type FilterKey = 'pending' | 'approved' | 'rejected' | 'all';

const FILTERS: Array<{
  key: FilterKey;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  statusFilter: RequestStatus | null;
}> = [
  { key: 'pending', label: '待審', icon: Inbox, statusFilter: 'pending' },
  { key: 'approved', label: '已通過', icon: CheckCircle2, statusFilter: 'approved' },
  { key: 'rejected', label: '已退回', icon: XCircle, statusFilter: 'rejected' },
  { key: 'all', label: '全部', icon: Hash, statusFilter: null },
];

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: RequestStatus }) {
  const map: Record<RequestStatus, { label: string; cls: string }> = {
    pending: { label: '待審', cls: 'bg-amber-100 text-amber-700 border-amber-300' },
    approved: { label: '已通過', cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    rejected: { label: '已退回', cls: 'bg-rose-100 text-rose-700 border-rose-300' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

function formatSubmittedAt(req: QuotaExtensionRequest): string {
  // 時間轉字串只在 callback 內，遵守 module-top no-wall-clock rule
  const ts = req.submittedAtMs
    ? req.submittedAtMs
    : req.submittedAt && typeof req.submittedAt === 'object' && 'seconds' in (req.submittedAt as any)
      ? (req.submittedAt as { seconds: number }).seconds * 1000
      : typeof req.submittedAt === 'number'
        ? (req.submittedAt as number)
        : 0;
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-TW', { hour12: false });
}

function normalizeQuotaCell(raw: unknown, defaultLimit: number): { used: number; limit: number } {
  if (raw && typeof raw === 'object') {
    const o = raw as { used?: number; limit?: number };
    return {
      used: Number(o.used || 0),
      limit: Number(o.limit || defaultLimit),
    };
  }
  return { used: Number(raw || 0), limit: defaultLimit };
}

function describeScope(scope?: Array<'asks' | 'pdfViews'>): string {
  if (!scope || scope.length === 0) return '未指定';
  const label = (k: 'asks' | 'pdfViews') => (k === 'asks' ? 'AI 問答' : '條款 PDF');
  return scope.map(label).join('、');
}

// ---------------------------------------------------------------------------
// Approve / Reject Dialogs
// ---------------------------------------------------------------------------

interface ApproveDialogProps {
  request: QuotaExtensionRequest;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (extensionAmount: { asks: number; pdfViews: number }, memo: string) => void;
}

function ApproveDialog({ request, busy, onCancel, onConfirm }: ApproveDialogProps) {
  const [asksAmount, setAsksAmount] = useState<string>(String(DEFAULT_EXTENSION.asks));
  const [pdfAmount, setPdfAmount] = useState<string>(String(DEFAULT_EXTENSION.pdfViews));
  const [memo, setMemo] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  const submit = useCallback(() => {
    const asks = Math.floor(Number(asksAmount));
    const pdf = Math.floor(Number(pdfAmount));
    if (!Number.isFinite(asks) || asks <= 0 || asks > MAX_EXTENSION.asks) {
      setErr(`AI 問答增量必須介於 1 ~ ${MAX_EXTENSION.asks}`);
      return;
    }
    if (!Number.isFinite(pdf) || pdf <= 0 || pdf > MAX_EXTENSION.pdfViews) {
      setErr(`條款 PDF 增量必須介於 1 ~ ${MAX_EXTENSION.pdfViews}`);
      return;
    }
    setErr(null);
    onConfirm({ asks, pdfViews: pdf }, memo.trim());
  }, [asksAmount, pdfAmount, memo, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="通過配額延伸申請"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            通過配額延伸申請
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            申請編號：<span className="font-mono">{request.id}</span>
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              AI 問答增量 (本月)
            </label>
            <input
              type="number"
              min={1}
              max={MAX_EXTENSION.asks}
              value={asksAmount}
              onChange={(e) => setAsksAmount(e.target.value)}
              disabled={busy}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-slate-50"
            />
            <p className="mt-1 text-[11px] text-slate-500">預設 +{DEFAULT_EXTENSION.asks}，上限 {MAX_EXTENSION.asks}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              條款 PDF 檢視增量 (本月)
            </label>
            <input
              type="number"
              min={1}
              max={MAX_EXTENSION.pdfViews}
              value={pdfAmount}
              onChange={(e) => setPdfAmount(e.target.value)}
              disabled={busy}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-slate-50"
            />
            <p className="mt-1 text-[11px] text-slate-500">預設 +{DEFAULT_EXTENSION.pdfViews}，上限 {MAX_EXTENSION.pdfViews}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              審核備註 (選填，僅留 audit log，不寄信)
            </label>
            <textarea
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              disabled={busy}
              maxLength={500}
              placeholder="例：高頻使用顧問，本月特批……"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-slate-50 resize-none"
            />
          </div>
          {err && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {err}
            </p>
          )}
        </div>
        <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            確認通過
          </button>
        </div>
      </div>
    </div>
  );
}

interface RejectDialogProps {
  request: QuotaExtensionRequest;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

function RejectDialog({ request, busy, onCancel, onConfirm }: RejectDialogProps) {
  const [reason, setReason] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  const submit = useCallback(() => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setErr('退回需附理由');
      return;
    }
    if (trimmed.length > 500) {
      setErr('理由請控制在 500 字以內');
      return;
    }
    setErr(null);
    onConfirm(trimmed);
  }, [reason, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="退回配額延伸申請"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <XCircle size={18} className="text-rose-600" />
            退回配額延伸申請
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            申請編號：<span className="font-mono">{request.id}</span>
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              退回理由 (必填，會以 email 通知申請人)
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              maxLength={500}
              placeholder="例：本月用量已達上限，建議升級至下一層方案……"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-200 outline-none disabled:bg-slate-50 resize-none"
            />
          </div>
          {err && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {err}
            </p>
          )}
        </div>
        <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            確認退回
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

interface RequestCardProps {
  request: QuotaExtensionRequest;
  profile?: RequesterProfile;
  busy: boolean;
  thisRowBusy: boolean;
  onApproveClick: () => void;
  onRejectClick: () => void;
}

function RequestCard({
  request,
  profile,
  busy,
  thisRowBusy,
  onApproveClick,
  onRejectClick,
}: RequestCardProps) {
  const asks = normalizeQuotaCell(request.currentUsage?.asks, 100);
  const pdf = normalizeQuotaCell(request.currentUsage?.pdfViews, 50);
  const displayName = profile?.displayName || request.requesterEmail?.split('@')[0] || '(顧問)';
  const email = profile?.email || request.requesterEmail || '—';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4 md:p-5">
        {/* Header — 申請人 + 狀態 */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <User size={16} className="text-slate-400" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 truncate">{displayName}</h3>
              <StatusBadge status={request.status} />
              {request.targetYyyymm && (
                <span className="text-[10px] text-slate-500 font-mono">
                  {request.targetYyyymm.slice(0, 4)}-{request.targetYyyymm.slice(4)}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500 flex items-center gap-1 min-w-0">
              <Mail size={12} className="text-slate-400 shrink-0" />
              <span className="truncate">{email}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              <Clock size={12} className="text-slate-400 shrink-0" />
              {formatSubmittedAt(request)}
            </p>
          </div>
        </div>

        {/* 用量 + 申請類型 */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">AI 問答</div>
            <div className="mt-0.5 font-mono text-slate-800">
              {asks.used} / {asks.limit}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">條款 PDF</div>
            <div className="mt-0.5 font-mono text-slate-800">
              {pdf.used} / {pdf.limit}
            </div>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          申請類型：<span className="font-medium text-slate-700">{describeScope(request.requestedScope)}</span>
        </p>

        {/* 申請理由 */}
        {request.reasonForRequest && (
          <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
            <p className="text-xs text-blue-900">
              <span className="font-semibold">申請理由：</span>
              {request.reasonForRequest}
            </p>
          </div>
        )}

        {/* 已決定的歷史紀錄 (approved / rejected) */}
        {request.status === 'approved' && request.extensionAmount && (
          <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-start gap-2">
            <Sparkles size={14} className="text-emerald-600 mt-0.5 shrink-0" />
            <div className="text-xs text-emerald-900">
              <span className="font-semibold">已通過：</span>
              AI 問答 +{request.extensionAmount.asks}、條款 PDF +{request.extensionAmount.pdfViews}
              {request.reason && (
                <span className="block mt-0.5 text-emerald-800">備註：{request.reason}</span>
              )}
            </div>
          </div>
        )}
        {request.status === 'rejected' && request.reason && (
          <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 flex items-start gap-2">
            <AlertCircle size={14} className="text-rose-600 mt-0.5 shrink-0" />
            <div className="text-xs text-rose-900">
              <span className="font-semibold">已退回：</span>
              {request.reason}
            </div>
          </div>
        )}

        {/* Action row — pending 才顯示 */}
        {request.status === 'pending' && (
          <div className="mt-4 flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onRejectClick}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 hover:text-rose-900 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {thisRowBusy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              退回
            </button>
            <button
              type="button"
              onClick={onApproveClick}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {thisRowBusy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              通過
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok' }
  | { kind: 'err'; message: string };

type DialogState =
  | { kind: 'none' }
  | { kind: 'approve'; request: QuotaExtensionRequest }
  | { kind: 'reject'; request: QuotaExtensionRequest };

const QuotaExtensionRequests: React.FC = () => {
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [requests, setRequests] = useState<QuotaExtensionRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, RequesterProfile>>({});
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);

  const fetchRequests = useCallback(async (which: FilterKey) => {
    setLoadState({ kind: 'loading' });
    try {
      const baseRef = collection(db, 'quota_extension_requests');
      const cfg = FILTERS.find((f) => f.key === which);
      const constraints: Array<ReturnType<typeof where> | ReturnType<typeof orderBy> | ReturnType<typeof fsLimit>> = [];
      if (cfg?.statusFilter) {
        constraints.push(where('status', '==', cfg.statusFilter));
      }
      constraints.push(orderBy('submittedAtMs', 'desc'));
      constraints.push(fsLimit(PAGE_SIZE));

      const q = query(baseRef, ...constraints);
      const snap = await getDocs(q);
      const rows: QuotaExtensionRequest[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<QuotaExtensionRequest, 'id'>;
        rows.push({ id: d.id, ...data });
      });
      setRequests(rows);

      // Lazy-fetch requester profiles in parallel — best-effort, doesn't fail the list
      const uids = Array.from(new Set(rows.map((r) => r.requesterUid).filter(Boolean)));
      const nextProfiles: Record<string, RequesterProfile> = { ...profiles };
      await Promise.all(
        uids.map(async (uid) => {
          if (nextProfiles[uid]) return;
          try {
            const userDoc = await getDoc(doc(db, 'users', uid));
            if (userDoc.exists()) {
              const u = userDoc.data() as RequesterProfile;
              nextProfiles[uid] = { displayName: u.displayName, email: u.email };
            } else {
              nextProfiles[uid] = {};
            }
          } catch {
            nextProfiles[uid] = {};
          }
        }),
      );
      setProfiles(nextProfiles);
      setLoadState({ kind: 'ok' });
    } catch (err: any) {
      setLoadState({ kind: 'err', message: err?.message || '讀取失敗' });
    }
    // intentionally exclude profiles from deps — we read & merge inside
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pending count badge — separate query so it stays fresh across tabs
  const fetchPendingCount = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'quota_extension_requests'),
        where('status', '==', 'pending'),
        fsLimit(PAGE_SIZE + 1),
      );
      const snap = await getDocs(q);
      setPendingCount(snap.size > PAGE_SIZE ? PAGE_SIZE : snap.size);
    } catch {
      // ignore — header badge is non-critical
    }
  }, []);

  useEffect(() => {
    fetchRequests(filter);
  }, [filter, fetchRequests]);

  useEffect(() => {
    fetchPendingCount();
  }, [fetchPendingCount]);

  const callApprove = useCallback(
    async (input: ApproveCallableInput) => {
      const fn = httpsCallable<ApproveCallableInput, ApproveCallableResult>(
        functions,
        'approveQuotaExtension',
      );
      const res = await fn(input);
      return res.data;
    },
    [],
  );

  const handleApproveConfirm = useCallback(
    async (extensionAmount: { asks: number; pdfViews: number }, memo: string) => {
      if (dialog.kind !== 'approve') return;
      const req = dialog.request;
      setBusyActionId(req.id);
      try {
        const res = await callApprove({
          requestId: req.id,
          decision: 'approve',
          extensionAmount,
          reason: memo || undefined,
        });
        const emailNote = res.emailDispatched?.dryRun
          ? '（email DRY-RUN）'
          : res.emailDispatched?.sent
            ? '已寄信通知顧問'
            : '寄信失敗、請手動聯絡';
        setToast({ kind: 'ok', message: `已通過 ${req.id}，${emailNote}` });
        setDialog({ kind: 'none' });
        await Promise.all([fetchRequests(filter), fetchPendingCount()]);
      } catch (err: any) {
        const code = err?.code === 'functions/failed-precondition' && err?.message === 'already-decided'
          ? 'already-decided'
          : (err?.message || '審核失敗');
        if (code === 'already-decided') {
          setToast({ kind: 'err', message: '此申請已被其他管理員處理過' });
          setDialog({ kind: 'none' });
          await fetchRequests(filter);
        } else {
          setToast({ kind: 'err', message: code });
        }
      } finally {
        setBusyActionId(null);
      }
    },
    [dialog, callApprove, fetchRequests, fetchPendingCount, filter],
  );

  const handleRejectConfirm = useCallback(
    async (reason: string) => {
      if (dialog.kind !== 'reject') return;
      const req = dialog.request;
      setBusyActionId(req.id);
      try {
        const res = await callApprove({
          requestId: req.id,
          decision: 'reject',
          reason,
        });
        const emailNote = res.emailDispatched?.dryRun
          ? '（email DRY-RUN）'
          : res.emailDispatched?.sent
            ? '已寄信通知顧問'
            : '寄信失敗、請手動聯絡';
        setToast({ kind: 'ok', message: `已退回 ${req.id}，${emailNote}` });
        setDialog({ kind: 'none' });
        await Promise.all([fetchRequests(filter), fetchPendingCount()]);
      } catch (err: any) {
        const code = err?.code === 'functions/failed-precondition' && err?.message === 'already-decided'
          ? 'already-decided'
          : (err?.message || '退回失敗');
        if (code === 'already-decided') {
          setToast({ kind: 'err', message: '此申請已被其他管理員處理過' });
          setDialog({ kind: 'none' });
          await fetchRequests(filter);
        } else {
          setToast({ kind: 'err', message: code });
        }
      } finally {
        setBusyActionId(null);
      }
    },
    [dialog, callApprove, fetchRequests, fetchPendingCount, filter],
  );

  // Auto-dismiss toast after 4s — Date.now() in callback only
  useEffect(() => {
    if (!toast) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= 3900) setToast(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Sanity — 未登入時不嘗試 callable（route gate 已擋、這是備份）
  const signedIn = Boolean(auth.currentUser);

  const visibleRequests = useMemo(() => requests, [requests]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900">配額延伸申請</h1>
              <p className="mt-1 text-xs text-slate-500">
                顧問端 AI 問答 / 條款 PDF 用量達上限後可提交申請，admin 在此通過或退回。
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                fetchRequests(filter);
                fetchPendingCount();
              }}
              disabled={loadState.kind === 'loading'}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              {loadState.kind === 'loading' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              重新整理
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => {
              const Icon = f.icon;
              const active = filter === f.key;
              return (
                <button
                  type="button"
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 hover:text-slate-900 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={12} />
                  {f.label}
                  {f.key === 'pending' && pendingCount > 0 && (
                    <span
                      className={`ml-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* List */}
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-3">
        {!signedIn && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            尚未偵測到登入狀態。如果無法操作請重新登入。
          </div>
        )}
        {loadState.kind === 'loading' && requests.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <Loader2 size={20} className="mx-auto mb-2 text-slate-400 animate-spin" />
            <p className="text-xs text-slate-500">讀取申請中…</p>
          </div>
        )}
        {loadState.kind === 'err' && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            讀取失敗：{loadState.message}
          </div>
        )}
        {loadState.kind === 'ok' && visibleRequests.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <Inbox size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-600">目前沒有符合條件的申請紀錄</p>
          </div>
        )}
        {visibleRequests.map((req) => (
          <RequestCard
            key={req.id}
            request={req}
            profile={profiles[req.requesterUid]}
            busy={busyActionId !== null}
            thisRowBusy={busyActionId === req.id}
            onApproveClick={() => setDialog({ kind: 'approve', request: req })}
            onRejectClick={() => setDialog({ kind: 'reject', request: req })}
          />
        ))}
      </main>

      {/* Dialogs */}
      {dialog.kind === 'approve' && (
        <ApproveDialog
          request={dialog.request}
          busy={busyActionId === dialog.request.id}
          onCancel={() => setDialog({ kind: 'none' })}
          onConfirm={handleApproveConfirm}
        />
      )}
      {dialog.kind === 'reject' && (
        <RejectDialog
          request={dialog.request}
          busy={busyActionId === dialog.request.id}
          onCancel={() => setDialog({ kind: 'none' })}
          onConfirm={handleRejectConfirm}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-xl shadow-lg px-4 py-3 text-sm font-medium border ${
            toast.kind === 'ok'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-rose-600 text-white border-rose-700'
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default QuotaExtensionRequests;
