/**
 * 保單健診系統 — 主元件
 *
 * 2 步驟分頁：
 * Step 1: 保單輸入（OCR / 手動）
 * Step 2: 健診分析報告（依被保險人分組分析）
 */
import React, { useState } from 'react';
import {
  FileText, BarChart3,
  ChevronRight, CheckCircle2, User,
} from 'lucide-react';
import type { InsuranceCheckupData } from '../../types/insurance';
import PolicyManager from './PolicyManager';
import CheckupReport from './CheckupReport';

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
] as const;

export default function InsuranceCheckupTool({ data, setData, userId, clientId, clientName }: InsuranceCheckupToolProps) {
  const [activeStep, setActiveStep] = useState<1 | 2>(
    (data.activeStep && data.activeStep <= 2 ? data.activeStep : 1) as 1 | 2
  );

  const handleStepChange = (step: 1 | 2) => {
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
                  onClick={() => handleStepChange(step.id as 1 | 2)}
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
            onBack={() => handleStepChange(1)}
          />
        )}
      </div>
    </div>
  );
}
