import React from 'react';
import { ShieldCheck } from 'lucide-react';
import type { FamilyRole, InsuranceCoverageBucket } from '../../../lib/customerReport';
import type { PayloadOf } from '../_shared';

// ---------------------------------------------------------------------------
// Sprint 10 A — InsuranceCheckupView (多人多保單 readonly 概覽)
// 為什麼結構不同：其他 renderer 是「單一試算結果」、這個是「家庭級保障地圖」
// PII 鐵則：role 是 enum 不是姓名、不渲染任何 m.name / 保單公司 / 保單編號
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<FamilyRole, string> = {
  self: '本人',
  spouse: '配偶',
  child_1: '子女 1',
  child_2: '子女 2',
  child_3: '子女 3',
  father: '父親',
  mother: '母親',
};

const COVERAGE_LABELS: Record<keyof InsuranceCoverageBucket, string> = {
  life: '壽險',
  medical: '醫療',
  critical: '重疾',
  accident: '意外',
  disability: '失能',
  longTermCare: '長照',
};

const InsuranceCheckupView: React.FC<{ payload: PayloadOf<'insurance_checkup'> }> = ({ payload }) => {
  const { inputs, outputs } = payload;
  const score = outputs.overallScore ?? 0;
  const scoreColor =
    score >= 80 ? 'text-emerald-600' :
    score >= 60 ? 'text-amber-600' :
    'text-rose-600';
  const scoreLabel =
    score >= 80 ? '保障完整' :
    score >= 60 ? '尚有缺口' :
    '建議補強';

  return (
    <div className="space-y-5">
      {/* Hero — overallScore 0-100 */}
      <div className="bg-gradient-to-br from-indigo-50 to-sky-100 border border-indigo-200 rounded-2xl p-6 text-center relative overflow-hidden">
        <div className="absolute top-2 right-3 opacity-10 pointer-events-none">
          <ShieldCheck size={80} />
        </div>
        <div className="relative">
          <div className="text-xs font-bold text-indigo-700 tracking-wider uppercase mb-1">Family Insurance Checkup</div>
          <div className="text-sm font-bold text-indigo-800 mb-1">家庭保障整體評分</div>
          <div className={`text-5xl md:text-6xl font-black font-mono leading-none ${scoreColor}`}>
            {score}<span className="text-2xl md:text-3xl text-slate-500"> / 100</span>
          </div>
          <div className={`text-sm font-bold mt-2 ${scoreColor}`}>{scoreLabel}</div>
          {/* inline 合規警語 — 不能單依賴頁尾 footer，LINE 多半不會滾到底 */}
          <div className="text-[10px] mt-2 text-slate-500 italic">
            ※ 此評分為基於您現有保單試算之概覽，實際保障條件以保單條款為準。
          </div>
        </div>
      </div>

      {/* Members grid — 每人匿名 role + 險種 coverage 概覽 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3">家庭成員保障概覽（{inputs.members.length} 人）</h3>
        <div className="space-y-3">
          {inputs.members.map((m, idx) => {
            const coverageKeys = (Object.keys(m.coverage) as (keyof InsuranceCoverageBucket)[])
              .filter(k => (m.coverage[k] ?? 0) > 0);
            return (
              <div key={`${m.role}_${idx}`} className="bg-slate-50 rounded-xl p-3">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-bold text-slate-800">{ROLE_LABELS[m.role] || m.role}</span>
                  {m.age != null && <span className="text-xs text-slate-500">{m.age} 歲</span>}
                </div>
                {coverageKeys.length > 0 ? (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {coverageKeys.map(k => (
                      <span key={k} className="text-slate-600">
                        {COVERAGE_LABELS[k]}{' '}
                        <span className="font-mono font-bold text-slate-800">{(m.coverage[k] ?? 0).toLocaleString()}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-rose-500 italic">尚無保障紀錄</div>
                )}
                {m.gaps && (
                  () => {
                    const gapKeys = (Object.keys(m.gaps!) as (keyof InsuranceCoverageBucket)[])
                      .filter(k => (m.gaps![k] ?? 0) > 0);
                    return gapKeys.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-x-2 text-[11px]">
                        {gapKeys.map(k => (
                          <span key={k} className="text-rose-600">
                            {COVERAGE_LABELS[k]} 缺 <span className="font-mono">{(m.gaps![k] ?? 0).toLocaleString()}</span>
                          </span>
                        ))}
                      </div>
                    ) : null;
                  }
                )()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top priorities — anonymize strings from encoder */}
      {outputs.topPriorities && outputs.topPriorities.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-amber-800 mb-2">建議優先補強</h3>
          <ul className="space-y-1.5">
            {outputs.topPriorities.slice(0, 3).map((p, i) => (
              <li key={i} className="text-sm text-amber-900 flex items-start gap-2">
                <span className="font-bold text-amber-600">{i + 1}.</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Annual budget — optional, 數字無 PII */}
      {inputs.annualBudget != null && inputs.annualBudget > 0 && (
        <div className="bg-slate-50 rounded-xl p-4 text-center">
          <div className="text-xs text-slate-500 mb-1">家庭年度保費</div>
          <div className="text-lg font-bold text-slate-800 font-mono">{inputs.annualBudget.toLocaleString()} 元 / 年</div>
        </div>
      )}
    </div>
  );
};

export default InsuranceCheckupView;
