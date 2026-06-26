/**
 * 手動保單輸入表單
 * 保險公司、險種明細、幣別選擇
 *
 * Sprint 14 W1 — task B5 catalog 對齊 + 保費粗估
 *   每個 coverage 卡片下方新增「Catalog 對齊」+「精算粗估」inline 區塊。
 *   設計原則：
 *   1. 不破壞既有 OCR / 手動輸入流程 — 沒有 catalog 欄位的 coverage 完全
 *      不渲染對齊區塊（list 為空、不留空殼）。
 *   2. catalog 對齊資料由 cloud function 在 OCR pipeline 末段附掛到
 *      `coverage.catalogProductId` / `coverage.catalogMetadata` /
 *      `coverage._catalogMissFlag`（task B1 / B2 / B3 流入）。本元件對這
 *      三個欄位採 optional read，型別缺失時不報錯（向前相容）。
 *   3. 保費粗估走純函式 `premiumEstimator.estimateAnnualPremium`（task B4
 *      檔案）。為避免 B4 上線前 build 失敗，採 **dynamic import + try/catch
 *      no-op**：模組缺失時粗估區塊靜默隱藏，符合 Sprint 14 「漸進式
 *      commit」順序。
 *   4. miss-flag → 開啟 MissingProductModal（task B6）。同樣 dynamic import
 *      容錯；模組缺失時顯示 fallback 文字提示。
 *   5. category 顯示走 `CATEGORY_LABEL_ZH`（task B7 已上線）。
 *   6. sourceNote / company / sourceUrl 嚴禁出現在顧問端 UI — 鐵則。我們
 *      只顯示 productName / productCode / categoryMain / status / 終身-定期
 *      / 主-附約 / 保額單位。
 *   7. 顧問手動覆寫 annualPremium → 粗估區塊自動隱藏（看 cov.annualPremium
 *      truthy 即視為已填）。
 */
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import type {
  PolicyInfo, Coverage, ProductCategory, CurrencyType, PaymentFrequency,
} from '../../types/insurance';
import { TAIWAN_INSURERS, PRODUCT_CATEGORY_LABELS, CURRENCY_LABELS } from '../../types/insurance';
import ProductAutocomplete from './ProductAutocomplete';
import ForeignCurrencyBadge from './ForeignCurrencyBadge';
import {
  CATEGORY_LABEL_ZH,
  isPremiumEstimatable,
} from '../../lib/insuranceCategoryLabels';
import type { InsuranceCategoryMain, ProductStatus } from '../../lib/insuranceProducts';

// ---------------------------------------------------------------------------
// Catalog metadata — shape from cloud-function attach (task B2 / B3).
// Defined locally so we don't block on Coverage type extension (task B1).
// All fields optional → tolerant of partial OCR matches.
// ---------------------------------------------------------------------------
interface CatalogMetadata {
  productName?: string;
  productCode?: string;
  categoryMain?: InsuranceCategoryMain;
  categorySub?: string;
  status?: ProductStatus;
  // Range hints surfaced by the matcher — purely for advisor context, never
  // used as authoritative figures (沒抓到 sumInsured 時可看 catalog range).
  minSumInsured?: number;
  maxSumInsured?: number;
  unit?: string; // 保額單位（萬 / 元）
}

interface CoverageWithCatalog extends Coverage {
  catalogProductId?: string;
  catalogMetadata?: CatalogMetadata;
  _catalogMissFlag?: boolean;
}

interface PolicyFormProps {
  userId: string;
  familyMemberId?: string;
  initialData?: Partial<PolicyInfo>;
  isEditing?: boolean;
  onSave: (policy: Omit<PolicyInfo, 'id' | 'createdAt' | 'updatedAt' | 'value'>) => Promise<void>;
  onCancel: () => void;
}

const genId = () => Math.random().toString(36).slice(2, 10);

const PAYMENT_FREQ_OPTIONS: PaymentFrequency[] = ['年繳', '半年繳', '季繳', '月繳', '躉繳'];

// ---------------------------------------------------------------------------
// premiumEstimator dynamic loader (task B4).
//
// 為什麼動態 import:
//   - 漸進式 commit 順序中 B5 (本檔) 與 B4 平行進場、避免 B5 commit 卡在
//     B4 未上線時的 build break。
//   - estimator 純函式但體積 ~3.5KB gzip / TSO 表約 1KB；對於沒命中 catalog
//     的手動輸入流程是死碼。動態 import 把它推進獨立 chunk、首屏 cost 0。
//
// 型別 mirror 自 src/lib/premiumEstimator.ts；若 B4 改 signature 必須同步。
// ---------------------------------------------------------------------------
type EstimatorInput = {
  categoryMain: InsuranceCategoryMain;
  isWholeLife: boolean;
  isMaster: boolean;
  isNaturalRate?: boolean;
  age: number;
  gender: 'male' | 'female';
  sumAssured: number;
  paymentYears?: number;
  coverageYears?: number;
};
type EstimatorOk = {
  kind: 'ok';
  mid: number; low: number; high: number;
  method: string;
  disclaimer: string;
  // Critic C 必修 mirror — UI 強制 surface「精算粗估｜非保險公司報價」徽章。
  label: '精算粗估｜非保險公司報價';
  notQuote: true;
};
type EstimatorDeclined = {
  kind: 'declined';
  reason: string;
  suggestion: string;
};
type EstimatorResult = EstimatorOk | EstimatorDeclined;
type EstimatorModule = {
  estimatePremium: (input: EstimatorInput) => EstimatorResult;
};

let _estimatorCache: EstimatorModule | null | undefined;
async function loadEstimator(): Promise<EstimatorModule | null> {
  if (_estimatorCache !== undefined) return _estimatorCache;
  try {
    const mod = await import('../../lib/premiumEstimator');
    if (mod && typeof (mod as any).estimatePremium === 'function') {
      _estimatorCache = mod as unknown as EstimatorModule;
    } else {
      _estimatorCache = null;
    }
  } catch {
    _estimatorCache = null;
  }
  return _estimatorCache;
}

// ---------------------------------------------------------------------------
// MissingProductModal dynamic loader (task B6).
// 進場時機: 顧問點 coverage 卡內「補資料」按鈕、首次點擊才 load。
// 簽名 mirror 自 src/components/insurance/MissingProductModal.tsx。
// ---------------------------------------------------------------------------
type MissingProductModalProps = {
  open: boolean;
  onClose: () => void;
  prefillCompanyShortName?: string;
  prefillProductName?: string;
  prefillProductCode?: string;
  prefillSumAssured?: number;
  prefillEffectiveDate?: string;
  prefillOcrSnapshot?: Record<string, unknown>;
  onSubmitted?: (pendingDocId: string) => void;
};
type MissingProductModalCtor = React.ComponentType<MissingProductModalProps>;
let _modalCache: MissingProductModalCtor | null | undefined;
async function loadMissingProductModal(): Promise<MissingProductModalCtor | null> {
  if (_modalCache !== undefined) return _modalCache;
  try {
    const mod = await import('./MissingProductModal');
    _modalCache = ((mod as any).default || null) as MissingProductModalCtor | null;
  } catch {
    _modalCache = null;
  }
  return _modalCache;
}

export default function PolicyForm({
  userId,
  familyMemberId,
  initialData,
  isEditing,
  onSave,
  onCancel,
}: PolicyFormProps) {
  const [saving, setSaving] = useState(false);

  // 基本欄位
  const [insurer, setInsurer] = useState(initialData?.insurer || '');
  const [policyNumber, setPolicyNumber] = useState(initialData?.policyNumber || '');
  const [applicant, setApplicant] = useState(initialData?.applicant || '');
  const [insured, setInsured] = useState(initialData?.insured || '');
  const [effectiveDate, setEffectiveDate] = useState(initialData?.effectiveDate || '');
  const [totalAnnualPremium, setTotalAnnualPremium] = useState(
    initialData?.totalAnnualPremium?.toString() || ''
  );
  const [paymentFrequency, setPaymentFrequency] = useState<PaymentFrequency>(
    initialData?.paymentFrequency || '年繳'
  );
  const [currency, setCurrency] = useState<CurrencyType>(initialData?.currency || 'TWD');

  // 險種明細 — typed as CoverageWithCatalog locally so we can read the
  // optional catalog plumbing without blocking on B1's type extension.
  const [coverages, setCoverages] = useState<CoverageWithCatalog[]>(
    (initialData?.coverages as CoverageWithCatalog[]) || [createEmptyCoverage()]
  );

  // 投保年齡 / 性別 — 來自被保險人 OCR 欄位，做粗估時要用。
  const insuredAgeAtIssue = initialData?.insuredAgeAtIssue;
  const insuredGender = initialData?.insuredGender;

  // 粗估快取 — 用 coverage.id 為 key、避免每 render 重算。
  const [estimates, setEstimates] = useState<Record<string, EstimatorResult | null>>({});

  // miss-flag modal 開啟狀態
  const [missingModalIdx, setMissingModalIdx] = useState<number | null>(null);
  const [MissingModalComp, setMissingModalComp] = useState<MissingProductModalCtor | null>(null);
  const [modalLoadFailed, setModalLoadFailed] = useState(false);

  function createEmptyCoverage(): CoverageWithCatalog {
    return {
      id: genId(),
      name: '',
      annualPremium: 0,
      isRider: false,
    };
  }

  const addCoverage = () => {
    setCoverages(prev => [...prev, { ...createEmptyCoverage(), isRider: true }]);
  };

  const updateCoverage = (index: number, updates: Partial<CoverageWithCatalog>) => {
    setCoverages(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const removeCoverage = (index: number) => {
    if (coverages.length <= 1) return;
    setCoverages(prev => prev.filter((_, i) => i !== index));
  };

  // -------------------------------------------------------------------------
  // 觸發粗估 — 條件:
  //   1. coverage.annualPremium 為 0/空（顧問尚未填、OCR 也沒抓到）
  //   2. catalog match 命中、catalogMetadata.categoryMain 存在
  //   3. categoryMain 屬於可估算白名單 (isPremiumEstimatable)
  // 粗估只跑一次/coverage、結果寫進 estimates state。顧問改值就 stale、
  // 不會反覆刷新。改成 0 又會重算（透過 effect dep on annualPremium）。
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const estimator = await loadEstimator();
      if (!estimator || cancelled) return;
      const next: Record<string, EstimatorResult | null> = {};
      let dirty = false;
      for (const cov of coverages) {
        const alreadyFilled = cov.annualPremium && cov.annualPremium > 0;
        const cat = cov.catalogMetadata?.categoryMain;
        if (alreadyFilled || !cat) {
          // 已有保費或無 catalog → 不顯示估算（清掉舊值）。
          if (estimates[cov.id]) {
            next[cov.id] = null;
            dirty = true;
          }
          continue;
        }
        // estimator 必須欄位齊全才能跑：age / gender / sumAssured。
        // 缺一律不送，避免估算器拋錯或回估錯誤的 declined reason。
        if (
          insuredAgeAtIssue === undefined ||
          !insuredGender ||
          !cov.sumInsured ||
          cov.sumInsured <= 0
        ) {
          // 提供 inline hint：未填年齡/性別/保額 → declined-style 訊息
          const guidance: EstimatorResult = {
            kind: 'declined',
            reason: '需被保險人投保年齡、性別及險種保額才能粗估',
            suggestion: '請先補齊上方欄位或於險種卡填入保額',
          };
          if (JSON.stringify(estimates[cov.id]) !== JSON.stringify(guidance)) {
            next[cov.id] = guidance;
            dirty = true;
          }
          continue;
        }
        if (!isPremiumEstimatable(cat)) {
          // 不可估算類型 → 顯示 declined reason。
          // 把判斷下放給 estimator (依然要呼叫 estimatePremium、它內部會
          // 走 SUPPORTED_CATEGORIES gate 回傳 declined)，這樣 reason
          // wording 集中在 B4 一處維護。
        }
        try {
          const result = estimator.estimatePremium({
            categoryMain: cat,
            isWholeLife: !!cov.isLifetime,
            isMaster: !cov.isRider,
            age: insuredAgeAtIssue,
            gender: insuredGender as 'male' | 'female',
            sumAssured: cov.sumInsured,
            paymentYears: cov.paymentYears,
            coverageYears: cov.coverageYears,
          });
          if (JSON.stringify(estimates[cov.id]) !== JSON.stringify(result)) {
            next[cov.id] = result;
            dirty = true;
          }
        } catch {
          // estimator 拋錯 → 靜默忽略，估算只是 hint，絕不能擋表單儲存。
        }
      }
      if (dirty && !cancelled) {
        setEstimates(prev => ({ ...prev, ...next }));
      }
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverages, insuredAgeAtIssue, insuredGender]);

  // -------------------------------------------------------------------------
  // miss-flag modal lazy-load — 顧問點「補資料」才嘗試載入。
  // -------------------------------------------------------------------------
  const openMissingModal = async (index: number) => {
    const Comp = await loadMissingProductModal();
    if (Comp) {
      setMissingModalComp(() => Comp);
      setMissingModalIdx(index);
    } else {
      setModalLoadFailed(true);
      // Fallback：顯示提示，2 秒後自動清除。
      setTimeout(() => setModalLoadFailed(false), 3000);
    }
  };

  const closeMissingModal = () => {
    setMissingModalIdx(null);
  };

  const handleSave = async () => {
    if (!insurer || !effectiveDate || coverages.length === 0) return;

    setSaving(true);
    try {
      // 移除 catalog 中介欄位 — Coverage 持久化型別只認 PolicyInfo 既有
      // 欄位。catalogProductId 等屬 in-memory metadata，task B1 正式擴充
      // Coverage 型別後可改為直接 spread。
      await onSave({
        insurer,
        policyNumber,
        applicant,
        insured,
        effectiveDate,
        totalAnnualPremium: parseFloat(totalAnnualPremium) || 0,
        paymentFrequency,
        currency,
        coverages: coverages.map(({ catalogProductId, catalogMetadata, _catalogMissFlag, ...c }) => ({
          ...c,
          annualPremium: c.annualPremium || 0,
        })) as Coverage[],
        ...(familyMemberId ? { familyMemberId } : {}),
        inputMethod: initialData ? 'ocr' : 'manual',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-800">
          {isEditing ? '編輯保單' : initialData ? '確認 OCR 結果' : '手動輸入保單'}
        </h3>
        <button onClick={onCancel}>
          <X size={20} className="text-slate-400 hover:text-slate-600" />
        </button>
      </div>

      <div className="space-y-5">
        {/* 保險公司 */}
        <div>
          <label className="text-sm text-slate-600 block mb-1">保險公司 *</label>
          <select
            value={insurer}
            onChange={e => setInsurer(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">請選擇</option>
            {TAIWAN_INSURERS.map(ins => (
              <option key={ins.code} value={ins.name}>{ins.name}</option>
            ))}
            <option value="其他">其他</option>
          </select>
        </div>

        {/* 保單號碼 */}
        <div>
          <label className="text-sm text-slate-600 block mb-1">保單號碼</label>
          <input
            type="text"
            value={policyNumber}
            onChange={e => setPolicyNumber(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 要保人 / 被保險人 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-600 block mb-1">要保人</label>
            <input
              type="text"
              value={applicant}
              onChange={e => setApplicant(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600 block mb-1">被保險人</label>
            <input
              type="text"
              value={insured}
              onChange={e => setInsured(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 契約生效日 + 繳費方式 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-600 block mb-1">契約生效日 *</label>
            <input
              type="date"
              value={effectiveDate}
              onChange={e => setEffectiveDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600 block mb-1">繳費方式</label>
            <select
              value={paymentFrequency}
              onChange={e => setPaymentFrequency(e.target.value as PaymentFrequency)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PAYMENT_FREQ_OPTIONS.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 年繳保費 + 幣別 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-sm text-slate-600 block mb-1">年繳保費 *</label>
            <input
              type="number"
              value={totalAnnualPremium}
              onChange={e => setTotalAnnualPremium(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600 block mb-1">幣別</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value as CurrencyType)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(CURRENCY_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {currency !== 'TWD' && (
          <ForeignCurrencyBadge currency={currency} amount={parseFloat(totalAnnualPremium) || 0} />
        )}

        {/* Catalog 對齊 summary — 全表級別、顯示 N 個險種已對齊 / 未對齊 */}
        <CatalogAlignmentSummary coverages={coverages} />

        {/* 險種明細 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-700">險種明細</label>
            <button
              onClick={addCoverage}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <Plus size={14} /> 新增附約
            </button>
          </div>

          <div className="space-y-3">
            {coverages.map((cov, index) => (
              <div
                key={cov.id}
                className={`p-4 rounded-xl border ${
                  cov.isRider ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500">
                    {cov.isRider ? `附約 ${index}` : '主約'}
                  </span>
                  {coverages.length > 1 && (
                    <button onClick={() => removeCoverage(index)}>
                      <Trash2 size={14} className="text-slate-400 hover:text-red-500" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {/* 險種名稱（帶自動完成） */}
                  <ProductAutocomplete
                    insurer={insurer}
                    value={cov.name}
                    onChange={(name, product) => {
                      updateCoverage(index, {
                        name,
                        category: product?.category,
                        productCacheId: product?.id,
                        claimSummary: product?.claimSummary,
                      });
                    }}
                  />

                  <div className="grid grid-cols-3 gap-2">
                    {/* 類別 */}
                    <select
                      value={cov.category || ''}
                      onChange={e => updateCoverage(index, { category: (e.target.value || undefined) as ProductCategory })}
                      className="px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">類別</option>
                      {Object.entries(PRODUCT_CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>

                    {/* 保額 */}
                    <input
                      type="number"
                      value={cov.sumInsured || ''}
                      onChange={e => updateCoverage(index, { sumInsured: parseFloat(e.target.value) || undefined })}
                      placeholder="保額"
                      className="px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {/* 年繳保費 */}
                    <input
                      type="number"
                      value={cov.annualPremium || ''}
                      onChange={e => updateCoverage(index, { annualPremium: parseFloat(e.target.value) || 0 })}
                      placeholder="保費"
                      className="px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* 繳費年期 */}
                    <input
                      type="number"
                      value={cov.paymentYears || ''}
                      onChange={e => updateCoverage(index, { paymentYears: parseInt(e.target.value) || undefined })}
                      placeholder="繳費年期"
                      className="px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {/* 保障年期 */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={cov.coverageYears || ''}
                        onChange={e => updateCoverage(index, {
                          coverageYears: parseInt(e.target.value) || undefined,
                          isLifetime: false,
                        })}
                        placeholder="保障年期"
                        className="flex-1 px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={cov.isLifetime}
                      />
                      <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={cov.isLifetime || false}
                          onChange={e => updateCoverage(index, {
                            isLifetime: e.target.checked,
                            coverageYears: e.target.checked ? undefined : cov.coverageYears,
                          })}
                          className="rounded"
                        />
                        終身
                      </label>
                    </div>
                  </div>

                  {/* Catalog 對齊 — 卡內細節 */}
                  <CoverageCatalogBadge
                    coverage={cov}
                    onFlagMissing={() => openMissingModal(index)}
                  />

                  {/* 精算粗估 — 只在 annualPremium 未填且有 catalog 命中時顯示 */}
                  <CoveragePremiumEstimate
                    coverage={cov}
                    estimate={estimates[cov.id] ?? null}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 按鈕 */}
      <div className="flex gap-3 mt-6 sticky bottom-0 bg-white pt-4 border-t">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !insurer || !effectiveDate}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Save size={16} />
          {saving ? '儲存中...' : '儲存保單'}
        </button>
      </div>

      {/* 頁腳警語 — 估算僅供參考 */}
      {coverages.some(c => estimates[c.id]?.kind === 'ok') && (
        <p className="mt-4 text-[10px] text-slate-400 leading-relaxed">
          精算粗估採用 TSO 2021 公開死亡率與業界附加費用率近似計算，僅供顧問
          內部規劃參考，實際保費以保險公司核保結果為準。
        </p>
      )}

      {/* miss-flag fallback 提示 */}
      {modalLoadFailed && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-amber-100 border border-amber-300 text-amber-800 text-sm px-4 py-2 rounded-lg shadow-lg z-50">
          補資料表單尚未上線，請暫時記錄商品名稱於險種欄位
        </div>
      )}

      {/* miss-flag modal */}
      {MissingModalComp && missingModalIdx !== null && coverages[missingModalIdx] && (
        <MissingModalComp
          open={true}
          onClose={closeMissingModal}
          prefillCompanyShortName={insurer || undefined}
          prefillProductName={coverages[missingModalIdx].name || undefined}
          prefillProductCode={coverages[missingModalIdx].code || undefined}
          prefillSumAssured={coverages[missingModalIdx].sumInsured}
          prefillEffectiveDate={effectiveDate || undefined}
          prefillOcrSnapshot={initialData ? {
            insurer,
            policyNumber,
            applicant,
            insured,
            effectiveDate,
            coverageName: coverages[missingModalIdx].name,
            coverageCode: coverages[missingModalIdx].code,
            sumInsured: coverages[missingModalIdx].sumInsured,
            annualPremium: coverages[missingModalIdx].annualPremium,
            isRider: coverages[missingModalIdx].isRider,
            isLifetime: coverages[missingModalIdx].isLifetime,
          } : undefined}
          onSubmitted={() => closeMissingModal()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CatalogAlignmentSummary — 全表級別 summary
// 規則:
//   - 沒有任何 coverage 帶 catalog 訊號 → 不渲染（隱藏 section）
//   - 全部命中 → emerald 訊息
//   - 全部 miss → amber 警示
//   - 部分命中 → slate-neutral 中性訊息
// ---------------------------------------------------------------------------
function CatalogAlignmentSummary({ coverages }: { coverages: CoverageWithCatalog[] }) {
  const totalCatalogSignal = coverages.filter(
    c => c.catalogProductId || c.catalogMetadata || c._catalogMissFlag
  ).length;
  if (totalCatalogSignal === 0) return null;
  const matched = coverages.filter(c => c.catalogProductId && c.catalogMetadata).length;
  const missed = coverages.filter(c => c._catalogMissFlag).length;
  const allMatched = matched === coverages.length;
  const allMissed = missed === coverages.length;

  let tone = 'bg-slate-50 border-slate-200 text-slate-700';
  let icon = <Sparkles size={14} className="text-slate-500" />;
  let msg = `${matched}/${coverages.length} 險種已對齊 Catalog，${missed} 筆未對齊`;
  if (allMatched) {
    tone = 'bg-emerald-50 border-emerald-200 text-emerald-700';
    icon = <CheckCircle2 size={14} className="text-emerald-600" />;
    msg = `全部 ${matched} 個險種已對齊商品 Catalog`;
  } else if (allMissed) {
    tone = 'bg-amber-50 border-amber-200 text-amber-800';
    icon = <AlertTriangle size={14} className="text-amber-600" />;
    msg = `${missed} 筆險種未對齊 Catalog — 可能為新商品`;
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${tone}`}>
      {icon}
      <span>{msg}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CoverageCatalogBadge — coverage 卡內細節
// 三狀態:
//   1. catalogMetadata 存在 → emerald 對齊卡（productName + spec 條）
//   2. _catalogMissFlag === true → amber miss 卡 + 「補資料」按鈕
//   3. 兩者皆無 → 不渲染（OCR 還沒跑過或顧問純手動輸入）
//
// Critic B 必修：預設 collapsed 成單行 chip、點才展開 specBits。
// 一張 5 條 coverage 的保單兩個 badge 同時 expand 會把表單推到 1200-1600px、
// 手機尤甚。預設 collapsed = chip 高度，verbose 只在顧問點開時出現。
//
// 嚴禁顯示 sourceUrl / company（鐵則：顧問端絕不暴露 sourceNote）。
// ---------------------------------------------------------------------------
function CoverageCatalogBadge({
  coverage,
  onFlagMissing,
}: {
  coverage: CoverageWithCatalog;
  onFlagMissing: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Matched
  if (coverage.catalogProductId && coverage.catalogMetadata) {
    const m = coverage.catalogMetadata;
    const catLabel = m.categoryMain ? CATEGORY_LABEL_ZH[m.categoryMain] : null;
    const specBits: string[] = [];
    if (catLabel) specBits.push(catLabel);
    if (m.categorySub) specBits.push(m.categorySub);
    if (coverage.isLifetime) specBits.push('終身');
    else if (coverage.coverageYears) specBits.push(`${coverage.coverageYears} 年期`);
    specBits.push(coverage.isRider ? '附約' : '主約');
    if (m.minSumInsured && m.maxSumInsured && m.unit) {
      specBits.push(`保額 ${m.minSumInsured}-${m.maxSumInsured} ${m.unit}`);
    }
    if (m.status) {
      specBits.push(m.status === 'active' ? '銷售中' : m.status === 'discontinued' ? '已停售' : '改版中');
    }
    return (
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 w-full text-left px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100/70 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <CheckCircle2 size={12} />
          <span>已對齊 · {expanded ? '點擊收合' : '點開細節'}</span>
        </div>
        {expanded && (
          <div className="mt-1.5 text-[11px] text-emerald-700/90">
            <div className="font-medium">{m.productName || coverage.name}</div>
            {m.productCode && (
              <div className="font-mono text-[10px] text-emerald-600/80">
                {m.productCode}
              </div>
            )}
            {specBits.length > 0 && (
              <div className="mt-0.5">{specBits.join(' · ')}</div>
            )}
          </div>
        )}
      </button>
    );
  }
  // Miss
  if (coverage._catalogMissFlag) {
    return (
      <div className="mt-1 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
            <AlertTriangle size={12} />
            <span>未對齊 · 補資料</span>
          </div>
          <button
            onClick={onFlagMissing}
            className="text-[11px] font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2"
          >
            開啟
          </button>
        </div>
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// CoveragePremiumEstimate — 精算粗估區塊
// 顯示條件:
//   - estimate 非空（estimator 已跑過）
//   - coverage.annualPremium 為空（顧問尚未填）
//
// Critic C 必修（法律 / 公平交易法 § 21 + 金管會 110.05.04 函釋）:
//   1. 數字 sibling 必須出現「精算粗估｜非保險公司報價」橘色 badge、字級
//      ≥ 數字 50%（chip 用 text-xs vs 數字 text-base — 50% 是底線、目前
//      設定為 75%、寬鬆於合規上限）。
//   2. 警語必須緊貼數字（同卡片內、距數字 ≤ 8px）、不可放頁腳。
//   3. 對比度走 amber-800 on amber-100、≥ 4.5:1（WCAG AA 過關）。
//   4. aria-describedby 連到警語 id、無障礙合規。
//
// Critic B 必修:
//   預設 collapsed 成單行 chip、點擊才展開細節（disclaimer + method）。
//   一張 5 條 coverage 同時 expand 兩個 badge 會把表單推到 1600px、必須收。
//
// 兩種結果:
//   - kind: 'ok' → 顯示「非報價」橘 badge + low-high 區間 + disclaimer
//   - kind: 'declined' → 顯示拒絕原因 + suggestion 引導
// ---------------------------------------------------------------------------
function CoveragePremiumEstimate({
  coverage,
  estimate,
}: {
  coverage: CoverageWithCatalog;
  estimate: EstimatorResult | null;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!estimate) return null;
  if (coverage.annualPremium && coverage.annualPremium > 0) return null;

  if (estimate.kind === 'ok') {
    // a11y: stable id 連到警語區塊
    const disclaimerId = `cov-${coverage.id}-estimate-disclaimer`;
    return (
      <div className="mt-1 rounded-lg bg-blue-50 border border-blue-200 overflow-hidden">
        {/* 必修 #1: 強制 not-quote badge — 緊貼數字、字級 ≥ 數字 50%、
            橘色高對比、aria-describedby 連到下方 disclaimer */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full text-left px-3 py-2 hover:bg-blue-100/60 transition-colors"
          aria-expanded={expanded}
          aria-describedby={disclaimerId}
        >
          <div className="flex flex-wrap items-center gap-2">
            {/* 法律 badge — text-xs (12px) ≈ 數字 text-sm/font-semibold (14px) 86%、
                足夠合規。橘底白底高對比、絕不能省略 */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300 whitespace-nowrap">
              <AlertTriangle size={11} />
              精算粗估｜非保險公司報價
            </span>
            <span className="text-sm font-semibold text-blue-900">
              NT$ {Math.round(estimate.low).toLocaleString()} – {Math.round(estimate.high).toLocaleString()}/年
            </span>
            <span className="ml-auto text-[11px] text-blue-700/70">
              {expanded ? '收合' : '細節'}
            </span>
          </div>
        </button>
        {/* 必修 #2: disclaimer 同卡片內、≤ 8px (px-3 py-2) 緊貼數字 */}
        <div
          id={disclaimerId}
          className="px-3 pb-2 -mt-0.5 text-[11px] text-amber-900/90 leading-relaxed"
        >
          {estimate.disclaimer}
        </div>
        {expanded && (
          <div className="px-3 pb-2 text-[11px] text-blue-700/80 border-t border-blue-200/60 pt-1.5">
            計算方法：{estimate.method}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
      <div className="flex items-center gap-1.5 text-xs text-slate-600">
        <AlertTriangle size={12} className="text-slate-400" />
        <span>{estimate.reason}</span>
      </div>
      <div className="mt-0.5 text-[11px] text-slate-400">
        {estimate.suggestion}
      </div>
    </div>
  );
}
