/**
 * MissingProductModal — Sprint 14 W1
 *
 * 當 catalog match 失敗（35k 商品中找不到、OCR 拍到的險種沒登記）、
 * 顧問可以在 modal 內 1-click 補資料、寫進 `insurance_products_pending`、
 * 等 Sprint 15 admin queue 審核入主 catalog。
 *
 * 鐵則：
 *  - 顧問端絕不暴露 sourceUrl / catalog 來源資訊
 *  - 顧問 uid 從 firebase auth 取（不從 props 帶、避免偽造）
 *  - runtime epoch ms 在 onSubmit callback 內動態取（不在 module top-level）
 *  - 寫入前 sanitize OCR prefill snapshot（剝掉客戶姓名/身分證/電話 PII）
 *  - 不引入新 npm dep（lucide-react / firebase 都是既有）
 *
 * 寫入路徑：Firestore `insurance_products_pending/{docId}`
 *  docId = `pending_<epoch>_<uid>_<slug(productName)>`
 *  rules: only signed-in user can create own row, only admin can read/update/delete
 */
import React, { useEffect, useMemo, useState } from 'react';
import { X, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { TAIWAN_INSURERS } from '../../types/insurance';
import type { InsuranceCategoryMain } from '../../lib/insuranceProducts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Mirrors `InsuranceCategoryMain` (8 buckets) + 'other' fallback for the
 *  pending queue. Admin review can normalize 'other' into one of the canonical
 *  8 before promoting into `insurance_products`. */
const CATEGORY_MAIN_OPTIONS: { value: InsuranceCategoryMain | 'other'; label: string }[] = [
  { value: 'life',             label: '壽險（終身/定期）' },
  { value: 'medical',          label: '醫療（住院/實支/手術）' },
  { value: 'critical',         label: '重大疾病 / 特定傷病' },
  { value: 'accident',         label: '意外傷害' },
  { value: 'disability',       label: '失能扶助' },
  { value: 'longTermCare',     label: '長期照顧' },
  { value: 'annuity',          label: '年金' },
  { value: 'investmentLinked', label: '投資型' },
  { value: 'other',            label: '其他 / 不確定' },
];

/** Closed list of company short names — reuse `TAIWAN_INSURERS` from
 *  `types/insurance.ts` (14 壽險 大家) and accept '其他' for the long tail. */
const COMPANY_OPTIONS = TAIWAN_INSURERS;

/** Slugify a Chinese product name into an ASCII-safe doc-id fragment.
 *  Firestore doc IDs can technically take Unicode but mixing Chinese + epoch
 *  in IDs makes them painful in admin tooling URLs / logs. Strategy:
 *    - Drop non-[a-z0-9] (so Chinese characters collapse out)
 *    - Truncate to 24 chars to keep doc IDs short
 *  If the product name is pure Chinese (so slug is empty), use 'unnamed' as
 *  the placeholder — the epoch + uid in the ID still guarantees uniqueness. */
function slugify(s: string): string {
  const cleaned = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return cleaned || 'unnamed';
}

/** Strip PII from the OCR prefill snapshot before persisting.
 *  We deliberately keep an allowlist (not a denylist): only the catalog-shape
 *  fields survive. Anything that could identify the end client (要保人 /
 *  被保險人 姓名、身分證、電話、地址、保單號碼) is dropped. */
function sanitizeOcrSnapshot(raw: Record<string, unknown> | undefined) {
  if (!raw || typeof raw !== 'object') return null;
  const ALLOW = [
    'productName', 'productCode', 'category', 'categoryMain',
    'isWholeLife', 'isLifetime', 'isMaster', 'isRider',
    'sumInsured', 'annualPremium',
    'paymentYears', 'coverageYears',
    'currency', 'paymentFrequency',
    'insurer', 'companyShortName',
    'effectiveDate',
  ];
  const out: Record<string, unknown> = {};
  for (const key of ALLOW) {
    if (key in raw && raw[key] !== undefined && raw[key] !== null) {
      out[key] = raw[key];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface MissingProductModalProps {
  open: boolean;
  onClose: () => void;
  prefillCompanyShortName?: string;
  prefillProductName?: string;
  prefillProductCode?: string;
  prefillSumAssured?: number;
  prefillEffectiveDate?: string;
  /** Raw OCR result snapshot — will be sanitized before write. */
  prefillOcrSnapshot?: Record<string, unknown>;
  onSubmitted?: (pendingDocId: string) => void;
}

export default function MissingProductModal({
  open,
  onClose,
  prefillCompanyShortName,
  prefillProductName,
  prefillProductCode,
  prefillEffectiveDate,
  prefillOcrSnapshot,
  onSubmitted,
}: MissingProductModalProps) {
  // ── Form state ────────────────────────────────────────────────────────────
  const [company, setCompany] = useState(prefillCompanyShortName || '');
  const [productName, setProductName] = useState(prefillProductName || '');
  const [productCode, setProductCode] = useState(prefillProductCode || '');
  const [categoryMain, setCategoryMain] = useState<InsuranceCategoryMain | 'other' | ''>('');
  const [isWholeLife, setIsWholeLife] = useState(false);
  const [isMaster, setIsMaster] = useState(true);
  const [saled, setSaled] = useState<'active' | 'discontinued'>('active');
  const [advisorNote, setAdvisorNote] = useState('');

  // ── Submit state ──────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  // Re-sync prefill when modal opens with new data (e.g.顧問連續處理多個 missing
  // products from the same OCR session). useEffect on `open` only — we don't
  // overwrite advisor's in-progress edits if the prop changes mid-flight.
  useEffect(() => {
    if (!open) return;
    setCompany(prefillCompanyShortName || '');
    setProductName(prefillProductName || '');
    setProductCode(prefillProductCode || '');
    setCategoryMain('');
    setIsWholeLife(false);
    setIsMaster(true);
    setSaled('active');
    setAdvisorNote('');
    setError(null);
    setSubmittedRef(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const canSubmit = useMemo(() => {
    return (
      !submitting
      && company.trim().length > 0
      && productName.trim().length > 0
      && categoryMain !== ''
    );
  }, [submitting, company, productName, categoryMain]);

  // ── Submit handler ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return;

    // CRITICAL: read uid + epoch INSIDE the callback (rule: 現在時間 not at
    // module top-level; auth state may have changed since render).
    const user = auth.currentUser;
    if (!user) {
      setError('請先登入後再送出');
      return;
    }
    const now = Date.now();

    setSubmitting(true);
    setError(null);
    try {
      const docId = `pending_${now}_${user.uid}_${slugify(productName)}`;
      const sanitized = sanitizeOcrSnapshot(prefillOcrSnapshot);

      const payload: Record<string, unknown> = {
        submittedBy: user.uid,
        submittedAt: now,                  // epoch ms (callback-scoped)
        submittedAtServer: serverTimestamp(), // cross-check vs client clock
        status: 'pending',
        company: company.trim(),
        // For 'other' selection in the picker we store the literal string —
        // admin review will normalize during promotion.
        companyShortName: company.trim(),
        productName: productName.trim(),
        productCode: productCode.trim() || null,
        categoryMain,
        isWholeLife,
        isMaster,
        // Sales status — admin queue uses this to triage active-product gaps
        // first (discontinued products are lower priority for catalog).
        saled: saled === 'active',
        salesStatus: saled,
        advisorNote: advisorNote.trim() || null,
        ocrPrefillSnapshot: sanitized,
        prefillEffectiveDate: prefillEffectiveDate || null,
        schemaVersion: 1,
      };

      // We use addDoc + an `intendedId` field rather than setDoc with the
      // composed id because: (a) addDoc returns the canonical Firestore-issued
      // id, which is cleaner for the admin queue, and (b) Firestore-issued ids
      // are inherently collision-safe. We still log the intended id for
      // post-hoc grep in case the same advisor submits a near-duplicate.
      payload.intendedId = docId;

      const ref = await addDoc(collection(db, 'insurance_products_pending'), payload);
      setSubmittedRef(ref.id);
      onSubmitted?.(ref.id);

      // Brief success state then auto-close — feels snappier than holding open.
      window.setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '送出失敗、請稍後再試';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-800">補登新商品</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              這張保單的險種尚未登錄、補一下基本資料、後台會排審納入商品庫
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 shrink-0"
            aria-label="關閉"
          >
            <X size={20} />
          </button>
        </div>

        {/* Success state */}
        {submittedRef ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10">
            <CheckCircle2 size={48} className="text-emerald-500 mb-3" />
            <p className="text-base font-semibold text-slate-800">已送審</p>
            <p className="text-xs text-slate-500 mt-1">
              編號 #{submittedRef.slice(0, 10)}…
            </p>
            <p className="text-xs text-slate-400 mt-3">
              後台審核後、此商品會出現在自動完成清單
            </p>
          </div>
        ) : (
          <>
            {/* Form */}
            <div className="px-6 py-4 space-y-4 overflow-y-auto">
              {/* 保險公司 */}
              <div>
                <label className="text-sm text-slate-600 block mb-1">
                  保險公司 <span className="text-red-500">*</span>
                </label>
                <select
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">請選擇</option>
                  {COMPANY_OPTIONS.map(c => (
                    <option key={c.code} value={c.name}>{c.name}</option>
                  ))}
                  <option value="其他">其他</option>
                </select>
              </div>

              {/* 商品名稱 */}
              <div>
                <label className="text-sm text-slate-600 block mb-1">
                  商品名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  placeholder="例：超優選終身醫療保險"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {/* Critic B 必修 #3：OCR prefill 常有錯字（「美湍人生」應該是
                    「美滿人生」）。顧問看到自己要送審錯字會直覺認為系統壞、
                    怒退。明顯標示「OCR 抽到原文、請修正」、減少誤會。 */}
                {prefillProductName && (
                  <p className="mt-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    OCR 抽到原文：「{prefillProductName}」— 常見字錯漏、送審前請以保單為準修正
                  </p>
                )}
              </div>

              {/* 商品代碼（選填）*/}
              <div>
                <label className="text-sm text-slate-600 block mb-1">
                  商品代碼 <span className="text-slate-400 text-xs">（選填）</span>
                </label>
                <input
                  type="text"
                  value={productCode}
                  onChange={e => setProductCode(e.target.value)}
                  placeholder="保險公司內部代碼（沒看到就空著）"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {prefillProductCode && (
                  <p className="mt-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    OCR 抽到原文：「{prefillProductCode}」— 如有錯字請修正
                  </p>
                )}
              </div>

              {/* 主推類別 */}
              <div>
                <label className="text-sm text-slate-600 block mb-1">
                  主推類別 <span className="text-red-500">*</span>
                </label>
                <select
                  value={categoryMain}
                  onChange={e => setCategoryMain(e.target.value as InsuranceCategoryMain | 'other' | '')}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">請選擇</option>
                  {CATEGORY_MAIN_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* 是否終身 / 是否主約（兩個 switch 並排）*/}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={isWholeLife}
                    onChange={e => setIsWholeLife(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-slate-700">終身型</span>
                </label>
                <label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={isMaster}
                    onChange={e => setIsMaster(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-slate-700">主約</span>
                </label>
              </div>

              {/* 銷售狀態 radio */}
              <div>
                <label className="text-sm text-slate-600 block mb-1">銷售狀態</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="saled"
                      checked={saled === 'active'}
                      onChange={() => setSaled('active')}
                    />
                    <span className="text-sm text-slate-700">在售</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="saled"
                      checked={saled === 'discontinued'}
                      onChange={() => setSaled('discontinued')}
                    />
                    <span className="text-sm text-slate-700">停售</span>
                  </label>
                </div>
              </div>

              {/* 補資料來源筆記（選填） */}
              <div>
                <label className="text-sm text-slate-600 block mb-1">
                  補資料來源 <span className="text-slate-400 text-xs">（選填）</span>
                </label>
                <textarea
                  value={advisorNote}
                  onChange={e => setAdvisorNote(e.target.value)}
                  rows={2}
                  placeholder="例：客戶提供保單 PDF / 保險公司 DM / 業務員確認"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* OCR snapshot reminder */}
              {prefillOcrSnapshot && (
                <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                  將同時附上 OCR 抽到的險種規格（已自動移除客戶姓名等個資）
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-white">
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium disabled:opacity-40"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Send size={16} />
                {submitting ? '送出中…' : '送出補登'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
