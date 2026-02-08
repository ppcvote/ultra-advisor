/**
 * 保單輸入管理模組（Step 1）
 * 直接輸入保單（不依賴家庭圖），OCR / 手動輸入
 */
import React, { useState } from 'react';
import {
  ArrowRight, Camera, Edit3, Plus,
  Trash2, FileText,
} from 'lucide-react';
import { usePolicies } from '../../hooks/usePolicies';
import OcrUploader from './OcrUploader';
import PolicyForm from './PolicyForm';
import ForeignCurrencyBadge from './ForeignCurrencyBadge';
import type { PolicyInfo } from '../../types/insurance';
import { formatContractAge } from '../../utils/contractCalculations';

interface PolicyManagerProps {
  userId?: string;
  clientId?: string;
  onNext: () => void;
  onBack?: () => void;
  familyTreeId?: string;
}

type ViewMode = 'list' | 'ocr' | 'form';

export default function PolicyManager({ userId, clientId, onNext }: PolicyManagerProps) {
  const { policies, loading, addPolicy, updatePolicy, removePolicy } = usePolicies(userId || null, clientId);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingPolicy, setEditingPolicy] = useState<Partial<PolicyInfo> | null>(null);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);

  const totalPolicies = policies.length;
  const totalPremium = policies.reduce((sum, p) => sum + (p.totalAnnualPremium || 0), 0);

  const handleOcrResult = (result: Partial<PolicyInfo>) => {
    setEditingPolicy(result);
    setEditingPolicyId(null);
    setViewMode('form');
  };

  const handleEditPolicy = (policy: PolicyInfo) => {
    setEditingPolicy(policy);
    setEditingPolicyId(policy.id);
    setViewMode('form');
  };

  const handleSavePolicy = async (policy: Omit<PolicyInfo, 'id' | 'createdAt' | 'updatedAt' | 'value'>) => {
    if (editingPolicyId) {
      await updatePolicy(editingPolicyId, policy);
    } else {
      await addPolicy(policy);
    }
    setViewMode('list');
    setEditingPolicy(null);
    setEditingPolicyId(null);
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm('確定刪除此保單？')) return;
    await removePolicy(policyId);
  };

  // OCR 模式
  if (viewMode === 'ocr' && userId) {
    return (
      <OcrUploader
        userId={userId}
        onParsed={handleOcrResult}
        onClose={() => setViewMode('list')}
      />
    );
  }

  // 表單模式
  if (viewMode === 'form' && userId) {
    return (
      <PolicyForm
        userId={userId}
        initialData={editingPolicy || undefined}
        isEditing={!!editingPolicyId}
        onSave={handleSavePolicy}
        onCancel={() => { setViewMode('list'); setEditingPolicy(null); setEditingPolicyId(null); }}
      />
    );
  }

  // 列表模式
  return (
    <div className="p-6">
      {/* 標題 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">保單輸入</h2>
          <p className="text-sm text-slate-500 mt-1">
            {totalPolicies > 0
              ? `共 ${totalPolicies} 張保單 · 年繳保費 NT$ ${totalPremium.toLocaleString()}`
              : '拍照或手動輸入保單資料'}
          </p>
        </div>
      </div>

      {/* 新增保單入口 */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setViewMode('ocr')}
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-gradient-to-br from-purple-50 to-purple-100 text-purple-700 rounded-xl text-sm font-medium hover:from-purple-100 hover:to-purple-200 transition-all border border-purple-200"
        >
          <Camera size={20} />
          拍照 / 上傳照片
        </button>
        <button
          onClick={() => setViewMode('form')}
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-700 rounded-xl text-sm font-medium hover:from-blue-100 hover:to-blue-200 transition-all border border-blue-200"
        >
          <Edit3 size={20} />
          手動輸入
        </button>
      </div>

      {/* 保單列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium mb-1">尚未輸入保單</p>
          <p className="text-sm text-slate-400">請點擊上方按鈕拍照或手動輸入</p>
        </div>
      ) : (
        <div className="space-y-3">
          {policies.map(policy => (
            <div
              key={policy.id}
              onClick={() => handleEditPolicy(policy)}
              className="p-4 bg-white border border-slate-200 rounded-xl group hover:border-blue-200 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-700">
                    {policy.insurer}
                    {policy.policyNumber && (
                      <span className="text-slate-400 ml-2 text-sm">#{policy.policyNumber}</span>
                    )}
                  </div>
                  {(policy.applicant || policy.insured) && (
                    <div className="text-xs text-slate-500 mt-1">
                      {policy.applicant && `要保人：${policy.applicant}`}
                      {policy.applicant && policy.insured && ' · '}
                      {policy.insured && `被保人：${policy.insured}`}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 mt-1">
                    {policy.coverages?.map(c => c.name).filter(Boolean).join('、') || '（未輸入險種）'}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                    <span>生效 {policy.effectiveDate}</span>
                    <span>{formatContractAge(policy.effectiveDate)}</span>
                    <span>NT$ {(policy.totalAnnualPremium || 0).toLocaleString()}/{policy.paymentFrequency || '年'}</span>
                  </div>
                  {policy.currency && policy.currency !== 'TWD' && (
                    <div className="mt-1">
                      <ForeignCurrencyBadge
                        currency={policy.currency}
                        amount={policy.totalAnnualPremium || 0}
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center gap-2 ml-2 shrink-0">
                  <Edit3 size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeletePolicy(policy.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* 再新增一張 */}
          <button
            onClick={() => setViewMode('form')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors text-sm font-medium"
          >
            <Plus size={16} /> 再新增一張保單
          </button>
        </div>
      )}

      {/* 下一步按鈕 */}
      <div className="flex justify-end mt-8">
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
        >
          下一步：資料確認
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
