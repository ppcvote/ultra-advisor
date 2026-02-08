/**
 * 手動保單輸入表單
 * 保險公司、險種明細、幣別選擇
 */
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, Search } from 'lucide-react';
import type {
  PolicyInfo, Coverage, ProductCategory, CurrencyType, PaymentFrequency,
} from '../../types/insurance';
import { TAIWAN_INSURERS, PRODUCT_CATEGORY_LABELS, CURRENCY_LABELS } from '../../types/insurance';
import ProductAutocomplete from './ProductAutocomplete';
import ForeignCurrencyBadge from './ForeignCurrencyBadge';

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

  // 險種明細
  const [coverages, setCoverages] = useState<Coverage[]>(
    initialData?.coverages || [createEmptyCoverage()]
  );

  function createEmptyCoverage(): Coverage {
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

  const updateCoverage = (index: number, updates: Partial<Coverage>) => {
    setCoverages(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const removeCoverage = (index: number) => {
    if (coverages.length <= 1) return;
    setCoverages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!insurer || !effectiveDate || coverages.length === 0) return;

    setSaving(true);
    try {
      await onSave({
        insurer,
        policyNumber,
        applicant,
        insured,
        effectiveDate,
        totalAnnualPremium: parseFloat(totalAnnualPremium) || 0,
        paymentFrequency,
        currency,
        coverages: coverages.map(c => ({
          ...c,
          annualPremium: c.annualPremium || 0,
        })),
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
    </div>
  );
}
