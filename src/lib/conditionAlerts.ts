// Sprint 15 W2 — Condition Revision Alerts (advisor-side read/write surface).
//
// Why this module:
//   Sprint 15 W1 shipped the TII monthly crawler + diff classifier + admin
//   review queue scaffold. W2 wires the "approve revision" action to a
//   `notifyConditionRevision` callable that fans out per-advisor alert
//   documents at `advisors/{advisorUid}/conditionAlerts/{alertId}`. Each alert
//   bundles a版本 diff summary + the (advisor's own) affected client list +
//   per-client contact tracking state.
//
//   This file is the CLIENT-SIDE surface advisors see in their dashboard
//   (`/dashboard/condition-alerts`). Three things:
//     1. `listMyAlerts({ status, severity, productId })` — list query
//     2. `getAlert(alertId)` — single fetch for the detail / deeplink page
//     3. `updateClientContactStatus(alertId, clientUid, status, note?)` — mark
//        a single affected client as contacted / no_impact / meeting_scheduled
//
//   The fanout writer (functions/index.js `notifyConditionRevision`) owns the
//   shape of these docs. We mirror its shape conservatively here and parse
//   defensively (Sprint 15 W1 fromDoc() pattern).
//
// Boundary rules (encoded in this module):
//   - No new npm deps. Modular firebase/firestore SDK only.
//   - Time-handling: NEVER call Date.now()/new Date() at module top-level.
//     Reads epoch ms from doc fields; helpers that need wall clock take it
//     as a parameter (Sprint 12 / 14 / 15 rule, preserved).
//   - PII guardrail: this module surfaces `clientNameMasked`「王小明」, never
//     the full name / phone / ID. The fanout writer is supposed to strip these
//     server-side, but we re-mask defensively in `fromDoc()` so a misbehaving
//     writer can't leak through.
//   - Cross-advisor isolation: the query is anchored at
//     `advisors/{auth.currentUser.uid}/conditionAlerts` — firestore.rules
//     enforce the boundary, this client just trusts auth.uid.
//   - The `diffSummary` field carries an LLM-generated paraphrase; UI MUST
//     surface the "AI 解讀僅供參考、以正式條款為準" disclaimer. This module
//     exports `DIFF_AI_DISCLAIMER` as a single source of truth.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  updateDoc,
  where,
  type Query,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AlertSeverity = 'high' | 'medium' | 'low';

export type AlertStatus = 'pending' | 'partial' | 'completed';

export type ContactStatus =
  | 'pending'
  | 'contacted'
  | 'no_impact'
  | 'meeting_scheduled';

/** A single bullet in `importantChanges` — color-coded by impact in the UI.
 *  `category` is a free string written by the LLM diff composer (e.g.
 *  「等待期」「除外責任」「給付金額」). Don't enum it — the LLM may invent new
 *  category names and the UI just renders the string. */
export interface ImportantChange {
  category: string;
  change: string;
  impact: 'high' | 'medium' | 'low';
}

/** Per-advisor affected client. The `clientNameMasked` field is
 *  display-safe (「王小明」 with middle char hidden). The advisor sees the
 *  full name on the client detail page (separate Firestore read of their own
 *  `clients/{clientUid}` doc — that read goes through normal client rules). */
export interface AffectedClient {
  clientUid: string;
  clientNameMasked: string;
  policyId: string;
  sumAssured: number;
  contactStatus: ContactStatus;
  contactNote?: string;
  /** epoch ms — set by `updateClientContactStatus()` callback. */
  contactedAt?: number;
}

export interface ConditionAlert {
  id: string;
  productId: string;
  productName: string;
  companyName: string;
  oldVersion: string;
  newVersion: string;
  diffSummary: string;
  importantChanges: ImportantChange[];
  severity: AlertSeverity;
  affectedClients: AffectedClient[];
  /** epoch ms — written by the fanout callable. */
  createdAt: number;
  status: AlertStatus;
  /** Originating review-queue doc id. Useful for cross-linking from the
   *  advisor alert back into admin tooling (admin-only — UI hides this for
   *  non-admin advisors). */
  reviewQueueId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sub-collection path under `advisors/{uid}`. Single source of truth so the
 *  fanout writer and this reader can't drift. */
const SUBCOLLECTION = 'conditionAlerts';

/** Compliance — LLM diff is paraphrased, original條款 is authoritative.
 *  Exported so the UI uses the same string everywhere. */
export const DIFF_AI_DISCLAIMER =
  'AI 解讀僅供參考、以正式條款為準';

// ---------------------------------------------------------------------------
// Defensive validation
// ---------------------------------------------------------------------------

function isValidSeverity(s: unknown): s is AlertSeverity {
  return s === 'high' || s === 'medium' || s === 'low';
}

function isValidStatus(s: unknown): s is AlertStatus {
  return s === 'pending' || s === 'partial' || s === 'completed';
}

function isValidContactStatus(s: unknown): s is ContactStatus {
  return (
    s === 'pending' ||
    s === 'contacted' ||
    s === 'no_impact' ||
    s === 'meeting_scheduled'
  );
}

function isValidImpact(i: unknown): i is 'high' | 'medium' | 'low' {
  return i === 'high' || i === 'medium' || i === 'low';
}

/** Re-mask a name defensively. The fanout writer SHOULD mask, but if a
 *  misbehaving writer pushes a full name (e.g. during a hotfix that
 *  bypasses the helper), we re-mask here so the advisor UI / future
 *  share-screens never expose it.
 *
 *  Rules:
 *    - 2 chars (e.g. 王明) → 王O (1 mask)
 *    - 3 chars (e.g. 王小明) → 王O明 (mask middle)
 *    - 4+ chars → keep first + last, mask middle
 *    - 1 char or empty → return as-is (nothing to mask)
 *
 *  English / mixed names fall through to first-char + *** + last-char.
 */
function maskName(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return '—';
  const s = raw.trim();
  if (s.length <= 1) return s;
  if (s.length === 2) return `${s[0]}O`;
  if (s.length === 3) return `${s[0]}O${s[2]}`;
  // 4+ chars: keep first + last, mask middle
  const first = s[0];
  const last = s[s.length - 1];
  const middle = 'O'.repeat(Math.max(1, s.length - 2));
  return `${first}${middle}${last}`;
}

function parseImportantChanges(raw: unknown): ImportantChange[] {
  if (!Array.isArray(raw)) return [];
  const out: ImportantChange[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    if (!isValidImpact(r.impact)) continue;
    out.push({
      category: String(r.category || ''),
      change: String(r.change || ''),
      impact: r.impact,
    });
  }
  return out;
}

function parseAffectedClients(raw: unknown): AffectedClient[] {
  if (!Array.isArray(raw)) return [];
  const out: AffectedClient[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const status = isValidContactStatus(r.contactStatus)
      ? r.contactStatus
      : 'pending';

    // Defense in depth: prefer the masked name as written, but if the writer
    // accidentally sent a raw name, we re-mask. We deliberately never trust
    // a `clientName` field — only `clientNameMasked` is rendered.
    const maskedFromField =
      typeof r.clientNameMasked === 'string' && r.clientNameMasked.trim()
        ? r.clientNameMasked.trim()
        : '';
    const masked = maskedFromField
      ? maskName(maskedFromField) === maskedFromField
        ? maskedFromField
        : maskName(maskedFromField)
      : '—';

    out.push({
      clientUid: String(r.clientUid || ''),
      clientNameMasked: masked,
      policyId: String(r.policyId || ''),
      sumAssured: Number(r.sumAssured) || 0,
      contactStatus: status,
      contactNote:
        typeof r.contactNote === 'string' && r.contactNote.trim()
          ? r.contactNote
          : undefined,
      contactedAt:
        typeof r.contactedAt === 'number' && r.contactedAt > 0
          ? r.contactedAt
          : undefined,
    });
  }
  return out;
}

/** Convert a Firestore snapshot → typed `ConditionAlert`, or `null` if the
 *  shape is unrecognizable. Mirrors Sprint 15 W1 `fromDoc()` policy: drop
 *  rather than render half-parsed data to the advisor. */
function fromDoc(snap: any): ConditionAlert | null {
  const data = snap?.data?.();
  if (!data) return null;

  const severity = isValidSeverity(data.severity) ? data.severity : 'medium';
  const status = isValidStatus(data.status) ? data.status : 'pending';

  return {
    id: snap.id,
    productId: String(data.productId || ''),
    productName: String(data.productName || ''),
    companyName: String(data.companyName || ''),
    oldVersion: String(data.oldVersion || ''),
    newVersion: String(data.newVersion || ''),
    diffSummary: String(data.diffSummary || ''),
    importantChanges: parseImportantChanges(data.importantChanges),
    severity,
    affectedClients: parseAffectedClients(data.affectedClients),
    createdAt: Number(data.createdAt) || 0,
    status,
    reviewQueueId: String(data.reviewQueueId || ''),
  };
}

// ---------------------------------------------------------------------------
// Filter & options
// ---------------------------------------------------------------------------

export interface AlertListFilter {
  status?: AlertStatus | 'all';
  severity?: AlertSeverity;
  productId?: string;
}

export interface AlertListOptions {
  /** Page size. Default 50; capped at 200 (admin queue volume + advisor
   *  inbox volume are both low). */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

/** List alerts for the currently signed-in advisor.
 *
 *  Path: `advisors/{auth.uid}/conditionAlerts` orderBy createdAt desc.
 *  Filters are applied as Firestore `where` clauses where possible; severity
 *  filter is applied server-side too because it's bounded enum.
 *
 *  Returns `[]` (not throws) on auth failure / rules block / missing index,
 *  consistent with `insuranceReviewQueue.listReviewQueue()` semantics: the
 *  page is already gated and an empty state is the right UX. */
export async function listMyAlerts(
  filter: AlertListFilter = {},
  opts: AlertListOptions = {},
): Promise<ConditionAlert[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  const pageSize = Math.max(1, Math.min(opts.limit ?? 50, 200));

  const base = collection(db, 'advisors', uid, SUBCOLLECTION);

  const wheres: Array<[string, '==', unknown]> = [];
  if (filter.status && filter.status !== 'all') {
    wheres.push(['status', '==', filter.status]);
  }
  if (filter.severity) wheres.push(['severity', '==', filter.severity]);
  if (filter.productId) wheres.push(['productId', '==', filter.productId]);

  const composed: Query =
    wheres.length === 0
      ? query(base, orderBy('createdAt', 'desc'), fsLimit(pageSize))
      : query(
          base,
          ...wheres.map(([f, op, v]) => where(f, op, v)),
          orderBy('createdAt', 'desc'),
          fsLimit(pageSize),
        );

  try {
    const snap = await getDocs(composed);
    const items: ConditionAlert[] = [];
    snap.forEach((d) => {
      const item = fromDoc(d);
      if (item) items.push(item);
    });
    return items;
  } catch (err) {
    // Most likely: composite index missing (status + createdAt). Surface so
    // dev can spot it during local QA; return [] so UI shows the empty state.
    console.warn('[conditionAlerts] listMyAlerts failed:', err);
    return [];
  }
}

/** Fetch a single alert by id. Returns null if missing / rules-blocked.
 *  Always reads from the current advisor's sub-collection — there's no
 *  cross-advisor read path by design. */
export async function getAlert(alertId: string): Promise<ConditionAlert | null> {
  const uid = auth.currentUser?.uid;
  if (!uid || !alertId) return null;
  try {
    const snap = await getDoc(doc(db, 'advisors', uid, SUBCOLLECTION, alertId));
    if (!snap.exists()) return null;
    return fromDoc(snap);
  } catch (err) {
    console.warn('[conditionAlerts] getAlert failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public writes
// ---------------------------------------------------------------------------

/** Update a single client's contact status inside an alert.
 *
 *  Implementation note:
 *    Firestore doesn't support array-element-at-index updates without a read
 *    first. We:
 *      1. Read the alert doc
 *      2. Splice the `affectedClients[]` entry matching `clientUid`
 *      3. Recompute the rolling `status` (pending/partial/completed) based
 *         on how many clients are still in `pending`
 *      4. updateDoc({ affectedClients, status })
 *
 *  The rolling status calc lives client-side because the firestore.rules
 *  validate it on write — we have to send the value, the server can't pick
 *  for us. The status formula:
 *    - all `pending`              → status='pending'
 *    - all NOT-pending            → status='completed'
 *    - mix                        → status='partial'
 *
 *  `contactedAt` is read from `Date.now()` inside the callback (Sprint 12
 *  rule) — never at module top-level.
 *
 *  Throws if the alert is missing / not owned / write rejected by rules.
 *  Caller wraps with toast.error in the UI layer.
 */
export async function updateClientContactStatus(
  alertId: string,
  clientUid: string,
  status: 'contacted' | 'no_impact' | 'meeting_scheduled',
  note?: string,
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('未登入');
  if (!alertId || !clientUid) throw new Error('參數不完整');
  if (!isValidContactStatus(status) || status === 'pending') {
    // Pending is a "reset" — not exposed in the UI dropdown intentionally
    // (advisors only move forward in the lifecycle).
    throw new Error('不允許的聯絡狀態');
  }

  const ref = doc(db, 'advisors', uid, SUBCOLLECTION, alertId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('找不到此通知');
  const current = fromDoc(snap);
  if (!current) throw new Error('通知資料格式錯誤');

  // Snapshot epoch ms inside the callback — Sprint 12 / 15 rule.
  const ts = Date.now();

  let found = false;
  const nextClients: AffectedClient[] = current.affectedClients.map((c) => {
    if (c.clientUid !== clientUid) return c;
    found = true;
    return {
      ...c,
      contactStatus: status,
      contactNote: note?.trim() ? note.trim() : c.contactNote,
      contactedAt: ts,
    };
  });

  if (!found) throw new Error('客戶不在此通知範圍');

  // Roll up overall status.
  const pendingCount = nextClients.filter(
    (c) => c.contactStatus === 'pending',
  ).length;
  let nextStatus: AlertStatus;
  if (pendingCount === nextClients.length) nextStatus = 'pending';
  else if (pendingCount === 0) nextStatus = 'completed';
  else nextStatus = 'partial';

  await updateDoc(ref, {
    affectedClients: nextClients,
    status: nextStatus,
  });
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/** Human-readable severity label. */
export function describeSeverity(s: AlertSeverity): string {
  switch (s) {
    case 'high':
      return '高';
    case 'medium':
      return '中';
    case 'low':
      return '低';
  }
}

/** Human-readable status label. */
export function describeStatus(s: AlertStatus): string {
  switch (s) {
    case 'pending':
      return '待聯絡';
    case 'partial':
      return '部分完成';
    case 'completed':
      return '已完成';
  }
}

/** Human-readable contact status label. */
export function describeContactStatus(s: ContactStatus): string {
  switch (s) {
    case 'pending':
      return '待聯絡';
    case 'contacted':
      return '已聯絡';
    case 'no_impact':
      return '無影響';
    case 'meeting_scheduled':
      return '已約面談';
  }
}

/** Format epoch ms → "YYYY-MM-DD HH:MM" local time. The caller passes the
 *  epoch (from a row's `createdAt`); this helper does NOT read the wall
 *  clock — Sprint 12 / 15 rule. */
export function formatAlertTime(epochMs: number): string {
  if (!epochMs) return '—';
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Format NT$ sum-assured for compact display.
 *  Examples: 1_000_000 → "100 萬", 12_000_000 → "1,200 萬", 0 → "—". */
export function formatSumAssured(amount: number): string {
  if (!amount || amount <= 0) return '—';
  const wan = Math.round(amount / 10_000);
  if (wan >= 10_000) {
    const yi = (wan / 10_000).toFixed(2).replace(/\.?0+$/, '');
    return `${yi} 億`;
  }
  return `${wan.toLocaleString('zh-TW')} 萬`;
}
