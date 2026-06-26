/**
 * 保單健診系統 — 主元件
 *
 * 3 步驟分頁：
 * Step 1: 保單輸入（OCR / 手動）
 * Step 2: 健診分析報告（依被保險人分組分析）
 * Step 3: 條款助理（Sprint 14 W2 RAG agent — 對選定保單發問）
 *
 * Step 3 整合說明：
 *   - selectedCatalogProductId 從 policies 中萃取「最後一張有 catalog 命中
 *     的保單之首條 coverage」的 catalogProductId。沒有保單或全 miss 時為
 *     undefined，AgentChat 端會 fallback 成全庫搜尋。
 *   - policyContext 從同一張被選中保單算出：insuredAge / insuredGender /
 *     sumAssured（取 coverages 中最大 sumInsured 為代表）/ coverages。
 *   - 鐵則：不傳 insured name / policyNumber 等 PII 給 AgentChat / 後端。
 */
import React, { useState, useMemo } from 'react';
import {
  FileText, BarChart3, MessagesSquare,
  ChevronRight, CheckCircle2, User,
} from 'lucide-react';
import type { InsuranceCheckupData, PolicyInfo, Coverage } from '../../types/insurance';
import PolicyManager from './PolicyManager';
import CheckupReport from './CheckupReport';
import AgentChat, { type AgentChatPolicyContext } from './AgentChat';
import { usePolicies } from '../../hooks/usePolicies';
import DisclaimerFooter from '../DisclaimerFooter';

interface InsuranceCheckupToolProps {
  data: InsuranceCheckupData;
  setData: (data: InsuranceCheckupData) => void;
  userId?: string;
  clientId?: string;
  clientName?: string;
}

const STEPS = [
  { id: 1, label: '保單輸入', icon: FileText, description: 'OCR 或手動輸入' },
  { id: 2, label: '分析報告', icon: BarChart3, description: '保障分析與缺口' },
  { id: 3, label: '條款助理', icon: MessagesSquare, description: 'AI 解讀保單條款' },
] as const;

type StepId = 1 | 2 | 3;

// ---------------------------------------------------------------------------
// 從 policies 萃取「最佳代表保單」用於條款助理 context。
// 規則：優先選有 catalogProductId 命中的最新一張、若全 miss 則回 null。
// 不返回原始 PolicyInfo 本身、只回需要的 minimal data 防止 PII 外洩。
// ---------------------------------------------------------------------------
function pickRepresentativePolicy(policies: PolicyInfo[]): {
  catalogProductId?: string;
  context?: AgentChatPolicyContext;
} {
  if (!policies || policies.length === 0) return {};

  // policies 已按 createdAt desc — 從新到舊找第一張有 catalog hit 的
  const withCatalog = policies.find(p =>
    Array.isArray(p.coverages)
    && p.coverages.some(c => !!(c as Coverage & { catalogProductId?: string }).catalogProductId)
  );
  const target = withCatalog || policies[0];
  if (!target) return {};

  const firstCovWithCatalog = (target.coverages || []).find(
    c => !!(c as Coverage & { catalogProductId?: string }).catalogProductId,
  ) as (Coverage & { catalogProductId?: string }) | undefined;

  // 被保人 age 計算：優先用當前 age（issue age + elapsed）、缺則用 issue age
  let insuredAge: number | undefined;
  if (target.insuredAgeAtIssue && target.effectiveDate) {
    const effYear = new Date(target.effectiveDate).getFullYear();
    const curYear = new Date().getFullYear();
    if (!isNaN(effYear)) {
      insuredAge = target.insuredAgeAtIssue + (curYear - effYear);
    }
  }
  if (insuredAge == null && target.insuredAgeAtIssue) insuredAge = target.insuredAgeAtIssue;

  const insuredGender: 'male' | 'female' | undefined =
    target.insuredGender === 'male' || target.insuredGender === 'female'
      ? target.insuredGender
      : target.gender === '男' ? 'male' : target.gender === '女' ? 'female' : undefined;

  // 代表保額：取 coverages 最大 sumInsured（壽險 / 重疾 / 癌症一次金通常最大）
  const maxSum = (target.coverages || []).reduce(
    (m, c) => Math.max(m, c.sumInsured || 0),
    0,
  );

  // 不把 PII 欄位帶過去 — 只留試算所需 numeric / enum
  const sanitizedCoverages = (target.coverages || []).map(c => ({
    category: c.category,
    sumInsured: c.sumInsured,
    annualPremium: c.annualPremium,
    isRider: c.isRider,
    isLifetime: c.isLifetime,
    waitingPeriod: c.waitingPeriod,
  }));

  const context: AgentChatPolicyContext | undefined =
    insuredAge != null && insuredGender && maxSum > 0
      ? {
          insuredAge,
          insuredGender,
          sumAssured: maxSum,
          coverages: sanitizedCoverages,
        }
      : undefined;

  return {
    catalogProductId: firstCovWithCatalog?.catalogProductId,
    context,
  };
}

export default function InsuranceCheckupTool({ data, setData, userId, clientId, clientName }: InsuranceCheckupToolProps) {
  const [activeStep, setActiveStep] = useState<StepId>(
    (data.activeStep && data.activeStep <= 3 ? data.activeStep : 1) as StepId
  );

  // Step 3 用：拉同一份保單 list 萃取 productId + policyContext。
  // PolicyManager / CheckupReport 內部各自 hook 一份、這份是 lightweight read
  // (Firestore SDK 有 client-side cache，重複 onSnapshot 不會多打 read)。
  const { policies } = usePolicies(userId || null, clientId);

  const { catalogProductId: selectedCatalogProductId, context: policyContext } = useMemo(
    () => pickRepresentativePolicy(policies),
    [policies],
  );

  const handleStepChange = (step: StepId) => {
    setActiveStep(step);
    setData({ ...data, activeStep: step });
  };

  return (
    <div className="min-h-[80vh]">
      {/* 客戶資訊列 */}
      {clientName && (
        <div className="flex items-center gap-2 px-4 py-2 mb-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          <User size={16} />
          <span className="font-medium">客戶：{clientName}</span>
        </div>
      )}

      {/* 步驟導覽列 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            const isCompleted = activeStep > step.id;

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => handleStepChange(step.id as StepId)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-medium ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : isCompleted
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  ) : (
                    <Icon size={18} />
                  )}
                  <span className="hidden md:inline">{step.label}</span>
                  <span className="md:hidden">{step.id}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <ChevronRight size={16} className="text-slate-300 shrink-0 hidden sm:block" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* 步驟內容 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[60vh]">
        {activeStep === 1 && (
          <PolicyManager
            userId={userId}
            clientId={clientId}
            onNext={() => handleStepChange(2)}
          />
        )}
        {activeStep === 2 && (
          <CheckupReport
            userId={userId}
            clientId={clientId}
            clientName={clientName}
            onBack={() => handleStepChange(1)}
          />
        )}
        {activeStep === 3 && (
          <div className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-slate-800">條款助理</h2>
                <p className="text-sm text-slate-500 mt-1">
                  針對顧客保單條款發問、AI 解讀、附引用段號
                </p>
              </div>
              {!selectedCatalogProductId && (
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                  尚無命中保單、將以全庫搜尋
                </span>
              )}
            </div>
            <AgentChat
              productId={selectedCatalogProductId}
              policyContext={policyContext}
            />
          </div>
        )}
      </div>

      <DisclaimerFooter scope="insurance" />
    </div>
  );
}
