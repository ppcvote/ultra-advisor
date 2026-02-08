/**
 * 健診分析報告模組（Step 2）
 *
 * 功能：
 * 1. 從保單提取被保險人進行分析
 * 2. 查詢每個險種的理賠摘要（透過 Cloud Function）
 * 3. 顯示標準化理賠摘要表格
 * 4. 保障缺口分析與建議
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BarChart3, ArrowLeft, ChevronDown, ChevronUp,
  AlertTriangle, Shield, Award, User, Loader2,
  Heart, Activity, Stethoscope, Brain, Syringe,
  Ambulance, Accessibility, Clock, Search, Pencil, X, Save,
} from 'lucide-react';
import { usePolicies } from '../../hooks/usePolicies';
import { useProductCache } from '../../hooks/useProductCache';
import type { PolicyInfo, ClaimSummary, Coverage, Gender, ProductCategory, PRODUCT_CATEGORY_LABELS } from '../../types/insurance';

interface CheckupReportProps {
  userId?: string;
  clientId?: string;
  onBack?: () => void;
}

// 從保單中提取的人物資訊
interface ExtractedPerson {
  name: string;
  gender?: Gender;
  age?: number;
  policyIds: string[];
  totalPremium: number;
}

// 險種查詢狀態
interface ProductLookupState {
  [coverageKey: string]: {
    loading: boolean;
    error?: string;
    claimSummary?: ClaimSummary;
    category?: ProductCategory;
    waitingPeriod?: number;
    isCopyReceipt?: boolean;
  };
}

// 民國日期轉換
function parseRocDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const rocMatch = dateStr.match(/^(\d{2,3})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (rocMatch) {
    const rocYear = parseInt(rocMatch[1], 10);
    const westYear = rocYear + 1911;
    return `${westYear}-${rocMatch[2].padStart(2, '0')}-${rocMatch[3].padStart(2, '0')}`;
  }
  return dateStr;
}

// 從生日計算年齡
function calcAge(birthDate?: string): number | undefined {
  if (!birthDate) return undefined;
  const parsed = parseRocDate(birthDate);
  if (!parsed) return undefined;
  const birth = new Date(parsed);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// 從投保年齡估算當前年齡
function estimateCurrentAge(ageAtIssue: number, effectiveDate: string): number {
  const effectiveYear = new Date(effectiveDate).getFullYear();
  const currentYear = new Date().getFullYear();
  return ageAtIssue + (currentYear - effectiveYear);
}

// 格式化金額
function formatAmount(amount?: number): string {
  if (!amount) return '-';
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}萬`;
  }
  return amount.toLocaleString();
}

// 保障類別定義（用於總覽）
const COVERAGE_CATEGORIES = [
  { key: 'life', label: '壽險', icon: Heart, color: 'text-red-500' },
  { key: 'accident', label: '意外', icon: Ambulance, color: 'text-orange-500' },
  { key: 'critical', label: '重疾', icon: Brain, color: 'text-purple-500' },
  { key: 'cancer', label: '癌症', icon: Syringe, color: 'text-pink-500' },
  { key: 'hospital', label: '住院', icon: Activity, color: 'text-blue-500' },
  { key: 'medical', label: '實支', icon: Stethoscope, color: 'text-emerald-500' },
  { key: 'disability', label: '失能', icon: Accessibility, color: 'text-indigo-500' },
  { key: 'longterm', label: '長照', icon: Clock, color: 'text-amber-500' },
] as const;

// 判斷險種屬於哪個保障類別
function getCoverageCategory(category?: ProductCategory, coverageName?: string): string[] {
  const categories: string[] = [];
  const name = coverageName?.toLowerCase() || '';

  // 根據 ProductCategory 判斷
  if (category) {
    switch (category) {
      case 'life_term':
      case 'life_whole':
        categories.push('life');
        break;
      case 'accident':
      case 'accident_medical':
        categories.push('accident');
        break;
      case 'critical_illness':
      case 'major_injury':
        categories.push('critical');
        break;
      case 'cancer':
        categories.push('cancer');
        break;
      case 'medical_daily':
        categories.push('hospital');
        break;
      case 'medical_expense':
        categories.push('medical');
        break;
      case 'disability':
        categories.push('disability');
        break;
      case 'long_term_care':
        categories.push('longterm');
        break;
    }
  }

  // 備用：用名稱關鍵字判斷（注意優先順序，避免誤判）
  if (categories.length === 0) {
    // 先判斷特定險種（避免被「終身」誤判為壽險）
    if (name.includes('重大疾病') || name.includes('重疾') || name.includes('特定傷病')) {
      categories.push('critical');
    } else if (name.includes('癌症') || name.includes('防癌')) {
      categories.push('cancer');
    } else if (name.includes('長照') || name.includes('長期照顧')) {
      categories.push('longterm');
    } else if (name.includes('失能') || name.includes('殘廢')) {
      categories.push('disability');
    } else if (name.includes('實支')) {
      categories.push('medical');
    } else if (name.includes('住院') || name.includes('日額')) {
      categories.push('hospital');
    } else if (name.includes('手術') && !name.includes('實支')) {
      categories.push('hospital'); // 手術險歸類到住院
    } else if (name.includes('意外') || name.includes('傷害')) {
      categories.push('accident');
    } else if (name.includes('壽險') || (name.includes('終身') && name.includes('保險') && !name.includes('健康'))) {
      // 只有「終身壽險」或「終身保險」（不含健康）才算壽險
      categories.push('life');
    } else if (name.includes('身故') && !name.includes('意外')) {
      categories.push('life');
    }
  }

  return categories;
}

// 險種類別中文名稱
const CATEGORY_LABELS: Record<string, string> = {
  life_term: '定期壽險',
  life_whole: '終身壽險',
  medical_expense: '實支實付',
  medical_daily: '住院日額',
  surgery: '手術險',
  critical_illness: '重大疾病',
  major_injury: '特定傷病',
  cancer: '癌症險',
  accident: '意外險',
  accident_medical: '意外醫療',
  disability: '失能險',
  long_term_care: '長照險',
  waiver: '豁免附約',
  annuity: '年金險',
  investment: '投資型',
  other: '其他',
};

// 可用的給付項目定義
const BENEFIT_OPTIONS: { key: string; label: string; unit?: string; categories: ProductCategory[] }[] = [
  // 一次金
  { key: 'death', label: '身故', categories: ['life_term', 'life_whole'] },
  { key: 'accidentDeath', label: '意外身故', categories: ['accident'] },
  { key: 'totalDisability', label: '完全失能', categories: ['accident', 'disability'] },
  { key: 'criticalIllness', label: '重大疾病', categories: ['critical_illness', 'major_injury'] },
  { key: 'criticalIllnessLight', label: '輕度重疾', categories: ['critical_illness', 'major_injury'] },
  { key: 'cancer', label: '癌症一次金', categories: ['cancer'] },
  { key: 'cancerLight', label: '輕度癌症', categories: ['cancer'] },
  // 實支實付
  { key: 'roomDaily', label: '病房費限額', unit: '/日', categories: ['medical_expense'] },
  { key: 'medicalExpense', label: '住院雜費', categories: ['medical_expense'] },
  { key: 'surgeryInpatient', label: '住院手術', categories: ['medical_expense'] },
  { key: 'surgeryOutpatient', label: '門診手術', categories: ['medical_expense'] },
  { key: 'isCopyReceipt', label: '副本理賠', categories: ['medical_expense'] },
  // 住院日額
  { key: 'hospitalIllness', label: '疾病日額', unit: '/日', categories: ['medical_daily'] },
  { key: 'hospitalAccident', label: '意外日額', unit: '/日', categories: ['medical_daily'] },
  { key: 'hospitalIcu', label: '加護病房', unit: '/日', categories: ['medical_daily'] },
  // 意外醫療
  { key: 'accidentExpense', label: '意外實支', categories: ['accident_medical'] },
  { key: 'accidentDaily', label: '意外日額', unit: '/日', categories: ['accident_medical'] },
  { key: 'boneFracture', label: '骨折未住院', categories: ['accident_medical'] },
  // 手術險
  { key: 'surgeryOutMult', label: '門診手術', unit: '倍', categories: ['surgery'] },
  { key: 'surgeryInMult', label: '住院手術', unit: '倍', categories: ['surgery'] },
  { key: 'surgeryMajorMult', label: '重大手術', unit: '倍', categories: ['surgery'] },
  // 豁免
  { key: 'waiverTrigger', label: '豁免', categories: ['waiver'] },
  // 長照
  { key: 'ltcMonthly', label: '長照月給付', unit: '/月', categories: ['long_term_care'] },
  { key: 'ltcLumpSum', label: '長照一次金', categories: ['long_term_care'] },
];

// 從 ClaimSummary 提取給付項目
function extractBenefitItems(summary?: ClaimSummary, category?: ProductCategory, sumInsured?: number): { key: string; label: string; value: string; rawValue: number | string | boolean }[] {
  const items: { key: string; label: string; value: string; rawValue: number | string | boolean }[] = [];

  // Debug log
  console.log('[extractBenefitItems] Input:', { category, sumInsured, summary });

  // 一次金險種：優先使用 sumInsured，其次從 claimSummary.lumpSum 取
  const lumpSum = summary?.lumpSum;

  if (category === 'life_term' || category === 'life_whole') {
    const amount = sumInsured || lumpSum?.death;
    if (amount) items.push({ key: 'death', label: '身故', value: formatAmount(amount), rawValue: amount });
  } else if (category === 'critical_illness' || category === 'major_injury') {
    const amount = sumInsured || lumpSum?.criticalIllness;
    if (amount) {
      items.push({ key: 'criticalIllness', label: '重大疾病', value: formatAmount(amount), rawValue: amount });
      const lightAmount = lumpSum?.criticalIllnessLight || Math.round(amount * 0.1);
      items.push({ key: 'criticalIllnessLight', label: '輕度重疾', value: formatAmount(lightAmount), rawValue: lightAmount });
    }
  } else if (category === 'cancer') {
    const amount = sumInsured || lumpSum?.cancer;
    if (amount) items.push({ key: 'cancer', label: '癌症一次金', value: formatAmount(amount), rawValue: amount });
  } else if (category === 'accident') {
    const amount = sumInsured || lumpSum?.accidentDeath;
    if (amount) {
      items.push({ key: 'accidentDeath', label: '意外身故', value: formatAmount(amount), rawValue: amount });
      items.push({ key: 'totalDisability', label: '完全失能', value: formatAmount(amount), rawValue: amount });
    }
  } else if (category === 'disability') {
    const amount = sumInsured || lumpSum?.totalDisability;
    if (amount) items.push({ key: 'totalDisability', label: '完全失能', value: formatAmount(amount), rawValue: amount });
  }

  // 從 summary 提取
  if (summary?.actualExpense) {
    const ae = summary.actualExpense;
    if (ae.roomDaily) items.push({ key: 'roomDaily', label: '病房費限額', value: `${formatAmount(ae.roomDaily)}/日`, rawValue: ae.roomDaily });
    if (ae.medicalExpense) items.push({ key: 'medicalExpense', label: '住院雜費', value: formatAmount(ae.medicalExpense), rawValue: ae.medicalExpense });
    if (ae.surgeryInpatient) items.push({ key: 'surgeryInpatient', label: '住院手術', value: formatAmount(ae.surgeryInpatient), rawValue: ae.surgeryInpatient });
    if (ae.surgeryOutpatient) items.push({ key: 'surgeryOutpatient', label: '門診手術', value: formatAmount(ae.surgeryOutpatient), rawValue: ae.surgeryOutpatient });
    if (ae.isCopyReceipt) items.push({ key: 'isCopyReceipt', label: '副本理賠', value: '✓', rawValue: true });
  }
  if (summary?.hospitalDaily) {
    const hd = summary.hospitalDaily;
    if (hd.illness) items.push({ key: 'hospitalIllness', label: '疾病日額', value: `${formatAmount(hd.illness)}/日`, rawValue: hd.illness });
    if (hd.accident) items.push({ key: 'hospitalAccident', label: '意外日額', value: `${formatAmount(hd.accident)}/日`, rawValue: hd.accident });
    if (hd.icu) items.push({ key: 'hospitalIcu', label: '加護病房', value: `${formatAmount(hd.icu)}/日`, rawValue: hd.icu });
  }
  if (summary?.accidentMedical) {
    const am = summary.accidentMedical;
    if (am.actualExpense) items.push({ key: 'accidentExpense', label: '意外實支', value: formatAmount(am.actualExpense), rawValue: am.actualExpense });
    if (am.daily) items.push({ key: 'accidentDaily', label: '意外日額', value: `${formatAmount(am.daily)}/日`, rawValue: am.daily });
  }
  if (summary?.lumpSum?.bone) {
    items.push({ key: 'boneFracture', label: '骨折未住院', value: formatAmount(summary.lumpSum.bone), rawValue: summary.lumpSum.bone });
  }
  if (summary?.surgery) {
    const s = summary.surgery;
    if (s.outpatientMultiplier) items.push({ key: 'surgeryOutMult', label: '門診手術', value: `${s.outpatientMultiplier}倍`, rawValue: s.outpatientMultiplier });
    if (s.inpatientMultiplier) items.push({ key: 'surgeryInMult', label: '住院手術', value: `${s.inpatientMultiplier}倍`, rawValue: s.inpatientMultiplier });
    if (s.majorMultiplier) items.push({ key: 'surgeryMajorMult', label: '重大手術', value: `${s.majorMultiplier}倍`, rawValue: s.majorMultiplier });
  }
  if (summary?.waiver?.hasWaiver) {
    items.push({ key: 'waiverTrigger', label: '豁免', value: summary.waiver.trigger || '✓', rawValue: summary.waiver.trigger || true });
  }
  if (summary?.longTermCare) {
    if (summary.longTermCare.monthly) items.push({ key: 'ltcMonthly', label: '長照月給付', value: `${formatAmount(summary.longTermCare.monthly)}/月`, rawValue: summary.longTermCare.monthly });
    if (summary.longTermCare.lumpSum) items.push({ key: 'ltcLumpSum', label: '長照一次金', value: formatAmount(summary.longTermCare.lumpSum), rawValue: summary.longTermCare.lumpSum });
  }

  return items;
}

// 可編輯的理賠摘要顯示元件
interface EditableClaimSummaryProps {
  summary?: ClaimSummary;
  category?: ProductCategory;
  sumInsured?: number;
  onUpdate: (updates: { sumInsured?: number; claimSummary: ClaimSummary }) => void;
}

function EditableClaimSummary({ summary, category, sumInsured, onUpdate }: EditableClaimSummaryProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [customLabel, setCustomLabel] = useState('');

  const items = extractBenefitItems(summary, category, sumInsured);
  const existingKeys = new Set(items.map(i => i.key));

  // 可新增的項目：優先顯示該分類的，然後顯示所有其他項目
  const categoryItems = BENEFIT_OPTIONS.filter(opt =>
    category && opt.categories.includes(category) && !existingKeys.has(opt.key)
  );
  const otherItems = BENEFIT_OPTIONS.filter(opt =>
    !existingKeys.has(opt.key) && !(category && opt.categories.includes(category))
  );
  const addableItems = [...categoryItems, ...otherItems];

  const handleStartEdit = (key: string, rawValue: number | string | boolean) => {
    setEditingKey(key);
    setEditValue(typeof rawValue === 'boolean' ? '' : String(rawValue));
  };

  const handleSaveEdit = () => {
    if (!editingKey) return;

    const newSummary: ClaimSummary = { ...summary };
    const value = editValue.replace(/,/g, '');
    const numValue = parseInt(value, 10);
    let newSumInsured = sumInsured;

    // 根據 key 更新對應欄位
    if (['death', 'accidentDeath', 'totalDisability', 'criticalIllness', 'cancer'].includes(editingKey)) {
      newSumInsured = isNaN(numValue) ? undefined : numValue;
    } else if (editingKey === 'criticalIllnessLight') {
      // 輕度重疾自動計算，不需手動設
    } else if (['roomDaily', 'medicalExpense', 'surgeryInpatient', 'surgeryOutpatient'].includes(editingKey)) {
      if (!newSummary.actualExpense) newSummary.actualExpense = {};
      (newSummary.actualExpense as any)[editingKey] = isNaN(numValue) ? undefined : numValue;
    } else if (editingKey === 'isCopyReceipt') {
      if (!newSummary.actualExpense) newSummary.actualExpense = {};
      newSummary.actualExpense.isCopyReceipt = true;
    } else if (editingKey === 'hospitalIllness') {
      if (!newSummary.hospitalDaily) newSummary.hospitalDaily = {};
      newSummary.hospitalDaily.illness = isNaN(numValue) ? undefined : numValue;
    } else if (editingKey === 'hospitalAccident') {
      if (!newSummary.hospitalDaily) newSummary.hospitalDaily = {};
      newSummary.hospitalDaily.accident = isNaN(numValue) ? undefined : numValue;
    } else if (editingKey === 'hospitalIcu') {
      if (!newSummary.hospitalDaily) newSummary.hospitalDaily = {};
      newSummary.hospitalDaily.icu = isNaN(numValue) ? undefined : numValue;
    } else if (editingKey === 'accidentExpense') {
      if (!newSummary.accidentMedical) newSummary.accidentMedical = {};
      newSummary.accidentMedical.actualExpense = isNaN(numValue) ? undefined : numValue;
    } else if (editingKey === 'accidentDaily') {
      if (!newSummary.accidentMedical) newSummary.accidentMedical = {};
      newSummary.accidentMedical.daily = isNaN(numValue) ? undefined : numValue;
    } else if (editingKey === 'boneFracture') {
      if (!newSummary.lumpSum) newSummary.lumpSum = {};
      newSummary.lumpSum.bone = isNaN(numValue) ? undefined : numValue;
    } else if (editingKey === 'surgeryOutMult') {
      if (!newSummary.surgery) newSummary.surgery = { type: 'table' };
      newSummary.surgery.outpatientMultiplier = value || undefined;
    } else if (editingKey === 'surgeryInMult') {
      if (!newSummary.surgery) newSummary.surgery = { type: 'table' };
      newSummary.surgery.inpatientMultiplier = value || undefined;
    } else if (editingKey === 'surgeryMajorMult') {
      if (!newSummary.surgery) newSummary.surgery = { type: 'table' };
      newSummary.surgery.majorMultiplier = value || undefined;
    } else if (editingKey === 'waiverTrigger') {
      if (!newSummary.waiver) newSummary.waiver = { hasWaiver: true };
      newSummary.waiver.trigger = value || undefined;
    } else if (editingKey === 'ltcMonthly') {
      if (!newSummary.longTermCare) newSummary.longTermCare = {};
      newSummary.longTermCare.monthly = isNaN(numValue) ? undefined : numValue;
    } else if (editingKey === 'ltcLumpSum') {
      if (!newSummary.longTermCare) newSummary.longTermCare = {};
      newSummary.longTermCare.lumpSum = isNaN(numValue) ? undefined : numValue;
    }

    onUpdate({ sumInsured: newSumInsured, claimSummary: newSummary });
    setEditingKey(null);
    setEditValue('');
  };

  const handleDelete = (key: string) => {
    const newSummary: ClaimSummary = { ...summary };
    let newSumInsured = sumInsured;

    // 刪除對應欄位
    if (['death', 'accidentDeath', 'totalDisability', 'criticalIllness', 'criticalIllnessLight', 'cancer'].includes(key)) {
      newSumInsured = undefined;
    } else if (['roomDaily', 'medicalExpense', 'surgeryInpatient', 'surgeryOutpatient', 'isCopyReceipt'].includes(key)) {
      if (newSummary.actualExpense) {
        delete (newSummary.actualExpense as any)[key];
        if (Object.keys(newSummary.actualExpense).length === 0) delete newSummary.actualExpense;
      }
    } else if (['hospitalIllness', 'hospitalAccident', 'hospitalIcu'].includes(key)) {
      if (newSummary.hospitalDaily) {
        const fieldMap: Record<string, string> = { hospitalIllness: 'illness', hospitalAccident: 'accident', hospitalIcu: 'icu' };
        delete (newSummary.hospitalDaily as any)[fieldMap[key]];
        if (Object.keys(newSummary.hospitalDaily).length === 0) delete newSummary.hospitalDaily;
      }
    } else if (['accidentExpense', 'accidentDaily'].includes(key)) {
      if (newSummary.accidentMedical) {
        const fieldMap: Record<string, string> = { accidentExpense: 'actualExpense', accidentDaily: 'daily' };
        delete (newSummary.accidentMedical as any)[fieldMap[key]];
        if (Object.keys(newSummary.accidentMedical).length === 0) delete newSummary.accidentMedical;
      }
    } else if (key === 'boneFracture') {
      if (newSummary.lumpSum) {
        delete newSummary.lumpSum.bone;
        if (Object.keys(newSummary.lumpSum).length === 0) delete newSummary.lumpSum;
      }
    } else if (['surgeryOutMult', 'surgeryInMult', 'surgeryMajorMult'].includes(key)) {
      if (newSummary.surgery) {
        const fieldMap: Record<string, string> = { surgeryOutMult: 'outpatientMultiplier', surgeryInMult: 'inpatientMultiplier', surgeryMajorMult: 'majorMultiplier' };
        delete (newSummary.surgery as any)[fieldMap[key]];
        if (Object.keys(newSummary.surgery).filter(k => k !== 'type').length === 0) delete newSummary.surgery;
      }
    } else if (key === 'waiverTrigger') {
      delete newSummary.waiver;
    } else if (['ltcMonthly', 'ltcLumpSum'].includes(key)) {
      if (newSummary.longTermCare) {
        const fieldMap: Record<string, string> = { ltcMonthly: 'monthly', ltcLumpSum: 'lumpSum' };
        delete (newSummary.longTermCare as any)[fieldMap[key]];
        if (Object.keys(newSummary.longTermCare).length === 0) delete newSummary.longTermCare;
      }
    }

    onUpdate({ sumInsured: newSumInsured, claimSummary: newSummary });
  };

  const handleAddItem = (key: string) => {
    setShowAddMenu(false);
    const opt = BENEFIT_OPTIONS.find(o => o.key === key);
    if (!opt) return;

    // 設為編輯狀態
    setEditingKey(key);
    setEditValue('');
  };

  // 正在新增的項目（從選單選擇後）
  const addingItem = editingKey && !existingKeys.has(editingKey)
    ? BENEFIT_OPTIONS.find(o => o.key === editingKey)
    : null;

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {/* 已存在的項目 */}
      {items.map((item) => (
        <div key={item.key} className="group inline-flex items-center text-xs bg-slate-100 text-slate-700 rounded overflow-hidden">
          {editingKey === item.key ? (
            <div className="flex items-center">
              <span className="text-slate-500 px-2 py-1">{item.label}:</span>
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') { setEditingKey(null); setEditValue(''); }
                }}
                autoFocus
                className="w-20 px-1 py-1 text-xs border-0 bg-white focus:ring-1 focus:ring-purple-500"
                placeholder="輸入數值"
              />
              <button onClick={handleSaveEdit} className="px-1.5 py-1 bg-purple-500 text-white hover:bg-purple-600">
                ✓
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => handleStartEdit(item.key, item.rawValue)}
                className="px-2 py-1 hover:bg-slate-200 transition-colors"
              >
                <span className="text-slate-500 mr-1">{item.label}:</span>
                <span className="font-medium">{item.value}</span>
              </button>
              <button
                onClick={() => handleDelete(item.key)}
                className="px-1.5 py-1 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </>
          )}
        </div>
      ))}

      {/* 正在新增的項目（編輯框） */}
      {addingItem && (
        <div className="inline-flex items-center text-xs bg-purple-50 text-purple-700 rounded overflow-hidden border border-purple-200">
          <span className="text-purple-600 px-2 py-1">{addingItem.label}:</span>
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit();
              if (e.key === 'Escape') { setEditingKey(null); setEditValue(''); }
            }}
            autoFocus
            className="w-20 px-1 py-1 text-xs border-0 bg-white focus:ring-1 focus:ring-purple-500"
            placeholder={addingItem.unit ? `數值${addingItem.unit}` : '輸入數值'}
          />
          <button onClick={handleSaveEdit} className="px-1.5 py-1 bg-purple-500 text-white hover:bg-purple-600">
            ✓
          </button>
          <button
            onClick={() => { setEditingKey(null); setEditValue(''); }}
            className="px-1.5 py-1 text-purple-400 hover:text-red-500 hover:bg-red-50"
          >
            ×
          </button>
        </div>
      )}

      {/* 新增按鈕 - 永遠顯示 */}
      <div className="relative">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="inline-flex items-center justify-center w-6 h-6 text-xs bg-slate-200 text-slate-600 rounded hover:bg-purple-100 hover:text-purple-600 transition-colors"
          title="新增給付項目"
        >
          +
        </button>
        {showAddMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-10 py-1 min-w-[140px] max-h-[200px] overflow-y-auto">
            {categoryItems.length > 0 && (
              <>
                <div className="px-3 py-1 text-xs text-slate-400 bg-slate-50">建議項目</div>
                {categoryItems.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => handleAddItem(opt.key)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                  >
                    {opt.label}
                  </button>
                ))}
              </>
            )}
            {otherItems.length > 0 && (
              <>
                <div className="px-3 py-1 text-xs text-slate-400 bg-slate-50 border-t">其他項目</div>
                {otherItems.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => handleAddItem(opt.key)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-700"
                  >
                    {opt.label}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* 空狀態提示 */}
      {items.length === 0 && !addingItem && (
        <span className="text-xs text-slate-400">點擊 + 新增給付項目</span>
      )}
    </div>
  );
}

// 險種分類選項
const CATEGORY_OPTIONS: { value: ProductCategory; label: string }[] = [
  { value: 'life_term', label: '定期壽險' },
  { value: 'life_whole', label: '終身壽險' },
  { value: 'medical_expense', label: '實支實付' },
  { value: 'medical_daily', label: '住院日額' },
  { value: 'surgery', label: '手術險' },
  { value: 'critical_illness', label: '重大疾病' },
  { value: 'major_injury', label: '特定傷病' },
  { value: 'cancer', label: '癌症險' },
  { value: 'accident', label: '意外險' },
  { value: 'accident_medical', label: '意外醫療' },
  { value: 'disability', label: '失能險' },
  { value: 'long_term_care', label: '長照險' },
  { value: 'waiver', label: '豁免附約' },
  { value: 'annuity', label: '年金險' },
  { value: 'investment', label: '投資型' },
  { value: 'other', label: '其他' },
];

// 編輯險種彈窗
interface EditCoverageModalProps {
  coverage: Coverage;
  category?: ProductCategory;
  onSave: (updates: Partial<Coverage>) => Promise<void> | void;
  onClose: () => void;
}

function EditCoverageModal({ coverage, category, onSave, onClose }: EditCoverageModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>(category || 'other');
  const [formData, setFormData] = useState<{
    sumInsured?: number;
    // 實支實付
    roomDaily?: number;
    medicalExpense?: number;
    surgeryInpatient?: number;
    surgeryOutpatient?: number;
    isCopyReceipt?: boolean;
    // 住院日額
    hospitalDailyIllness?: number;
    hospitalDailyAccident?: number;
    hospitalDailyIcu?: number;
    // 意外醫療
    accidentActualExpense?: number;
    accidentDaily?: number;
    accidentBoneFracture?: number;
    // 手術險
    surgeryOutpatientMultiplier?: string;
    surgeryInpatientMultiplier?: string;
    surgeryMajorMultiplier?: string;
    // 豁免
    waiverTrigger?: string;
  }>({
    sumInsured: coverage.sumInsured,
    roomDaily: coverage.claimSummary?.actualExpense?.roomDaily,
    medicalExpense: coverage.claimSummary?.actualExpense?.medicalExpense,
    surgeryInpatient: coverage.claimSummary?.actualExpense?.surgeryInpatient,
    surgeryOutpatient: coverage.claimSummary?.actualExpense?.surgeryOutpatient,
    isCopyReceipt: coverage.isCopyReceipt ?? coverage.claimSummary?.actualExpense?.isCopyReceipt,
    hospitalDailyIllness: coverage.claimSummary?.hospitalDaily?.illness,
    hospitalDailyAccident: coverage.claimSummary?.hospitalDaily?.accident,
    hospitalDailyIcu: coverage.claimSummary?.hospitalDaily?.icu,
    accidentActualExpense: coverage.claimSummary?.accidentMedical?.actualExpense,
    accidentDaily: coverage.claimSummary?.accidentMedical?.daily,
    accidentBoneFracture: coverage.claimSummary?.lumpSum?.bone,
    surgeryOutpatientMultiplier: coverage.claimSummary?.surgery?.outpatientMultiplier,
    surgeryInpatientMultiplier: coverage.claimSummary?.surgery?.inpatientMultiplier,
    surgeryMajorMultiplier: coverage.claimSummary?.surgery?.majorMultiplier,
    waiverTrigger: coverage.claimSummary?.waiver?.trigger,
  });

  const handleSave = async () => {
    const claimSummary: ClaimSummary = {};

    // 根據分類組合 claimSummary
    if (selectedCategory === 'medical_expense') {
      claimSummary.actualExpense = {
        roomDaily: formData.roomDaily,
        medicalExpense: formData.medicalExpense,
        surgeryInpatient: formData.surgeryInpatient,
        surgeryOutpatient: formData.surgeryOutpatient,
        isCopyReceipt: formData.isCopyReceipt,
      };
    } else if (selectedCategory === 'medical_daily') {
      claimSummary.hospitalDaily = {
        illness: formData.hospitalDailyIllness,
        accident: formData.hospitalDailyAccident,
        icu: formData.hospitalDailyIcu,
      };
    } else if (selectedCategory === 'accident_medical') {
      claimSummary.accidentMedical = {
        actualExpense: formData.accidentActualExpense,
        daily: formData.accidentDaily,
      };
      if (formData.accidentBoneFracture) {
        claimSummary.lumpSum = { bone: formData.accidentBoneFracture };
      }
    } else if (selectedCategory === 'surgery') {
      claimSummary.surgery = {
        type: 'table',
        outpatientMultiplier: formData.surgeryOutpatientMultiplier,
        inpatientMultiplier: formData.surgeryInpatientMultiplier,
        majorMultiplier: formData.surgeryMajorMultiplier,
      };
    } else if (selectedCategory === 'waiver') {
      claimSummary.waiver = {
        hasWaiver: true,
        trigger: formData.waiverTrigger,
      };
    } else if (['life_term', 'life_whole'].includes(selectedCategory)) {
      claimSummary.lumpSum = { death: formData.sumInsured };
    } else if (['critical_illness', 'major_injury'].includes(selectedCategory)) {
      claimSummary.lumpSum = {
        criticalIllness: formData.sumInsured,
        criticalIllnessLight: formData.sumInsured ? Math.round(formData.sumInsured * 0.1) : undefined,
      };
    } else if (selectedCategory === 'cancer') {
      claimSummary.lumpSum = { cancer: formData.sumInsured };
    } else if (selectedCategory === 'accident') {
      claimSummary.lumpSum = {
        accidentDeath: formData.sumInsured,
        totalDisability: formData.sumInsured,
      };
    } else if (selectedCategory === 'disability') {
      claimSummary.lumpSum = { totalDisability: formData.sumInsured };
    }

    console.log('[EditCoverageModal] Saving:', { category: selectedCategory, sumInsured: formData.sumInsured, claimSummary });
    try {
      await onSave({
        category: selectedCategory,
        sumInsured: formData.sumInsured,
        claimSummary,
        isCopyReceipt: formData.isCopyReceipt,
      });
      console.log('[EditCoverageModal] Save completed, closing modal');
      onClose();
    } catch (err) {
      console.error('[EditCoverageModal] Save failed:', err);
    }
  };

  const updateField = (field: string, value: number | string | boolean | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const parseNumber = (val: string) => {
    const num = parseInt(val.replace(/,/g, ''), 10);
    return isNaN(num) ? undefined : num;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* 標題 */}
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-slate-800">編輯險種資料</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* 內容 */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* 險種名稱（唯讀） */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">險種名稱</label>
            <div className="px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-600">
              {coverage.name}
            </div>
          </div>

          {/* 險種分類 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">險種分類</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as ProductCategory)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* 保額（一次金險種） */}
          {['life_term', 'life_whole', 'critical_illness', 'major_injury', 'cancer', 'accident', 'disability'].includes(selectedCategory) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">保額</label>
              <input
                type="text"
                value={formData.sumInsured?.toLocaleString() || ''}
                onChange={(e) => updateField('sumInsured', parseNumber(e.target.value))}
                placeholder="例：1000000"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          )}

          {/* 實支實付欄位 */}
          {selectedCategory === 'medical_expense' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">病房費限額/日</label>
                  <input
                    type="text"
                    value={formData.roomDaily?.toLocaleString() || ''}
                    onChange={(e) => updateField('roomDaily', parseNumber(e.target.value))}
                    placeholder="例：2000"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">住院雜費限額</label>
                  <input
                    type="text"
                    value={formData.medicalExpense?.toLocaleString() || ''}
                    onChange={(e) => updateField('medicalExpense', parseNumber(e.target.value))}
                    placeholder="例：300000"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">住院手術限額</label>
                  <input
                    type="text"
                    value={formData.surgeryInpatient?.toLocaleString() || ''}
                    onChange={(e) => updateField('surgeryInpatient', parseNumber(e.target.value))}
                    placeholder="例：225000"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">門診手術限額</label>
                  <input
                    type="text"
                    value={formData.surgeryOutpatient?.toLocaleString() || ''}
                    onChange={(e) => updateField('surgeryOutpatient', parseNumber(e.target.value))}
                    placeholder="例：60000"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isCopyReceipt"
                  checked={formData.isCopyReceipt || false}
                  onChange={(e) => updateField('isCopyReceipt', e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="isCopyReceipt" className="text-sm text-slate-700">副本理賠</label>
              </div>
            </>
          )}

          {/* 住院日額欄位 */}
          {selectedCategory === 'medical_daily' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">疾病日額</label>
                <input
                  type="text"
                  value={formData.hospitalDailyIllness?.toLocaleString() || ''}
                  onChange={(e) => updateField('hospitalDailyIllness', parseNumber(e.target.value))}
                  placeholder="1000"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">意外日額</label>
                <input
                  type="text"
                  value={formData.hospitalDailyAccident?.toLocaleString() || ''}
                  onChange={(e) => updateField('hospitalDailyAccident', parseNumber(e.target.value))}
                  placeholder="1000"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">加護病房</label>
                <input
                  type="text"
                  value={formData.hospitalDailyIcu?.toLocaleString() || ''}
                  onChange={(e) => updateField('hospitalDailyIcu', parseNumber(e.target.value))}
                  placeholder="2000"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
          )}

          {/* 意外醫療欄位 */}
          {selectedCategory === 'accident_medical' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">意外實支限額</label>
                  <input
                    type="text"
                    value={formData.accidentActualExpense?.toLocaleString() || ''}
                    onChange={(e) => updateField('accidentActualExpense', parseNumber(e.target.value))}
                    placeholder="30000"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">意外日額</label>
                  <input
                    type="text"
                    value={formData.accidentDaily?.toLocaleString() || ''}
                    onChange={(e) => updateField('accidentDaily', parseNumber(e.target.value))}
                    placeholder="1000"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">骨折未住院</label>
                <input
                  type="text"
                  value={formData.accidentBoneFracture?.toLocaleString() || ''}
                  onChange={(e) => updateField('accidentBoneFracture', parseNumber(e.target.value))}
                  placeholder="依骨折部位給付"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
          )}

          {/* 手術險欄位 */}
          {selectedCategory === 'surgery' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">門診手術倍數</label>
                <input
                  type="text"
                  value={formData.surgeryOutpatientMultiplier || ''}
                  onChange={(e) => updateField('surgeryOutpatientMultiplier', e.target.value)}
                  placeholder="1-10"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">住院手術倍數</label>
                <input
                  type="text"
                  value={formData.surgeryInpatientMultiplier || ''}
                  onChange={(e) => updateField('surgeryInpatientMultiplier', e.target.value)}
                  placeholder="5-50"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">重大手術倍數</label>
                <input
                  type="text"
                  value={formData.surgeryMajorMultiplier || ''}
                  onChange={(e) => updateField('surgeryMajorMultiplier', e.target.value)}
                  placeholder="50-100"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>
          )}

          {/* 豁免附約欄位 */}
          {selectedCategory === 'waiver' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">豁免觸發條件</label>
              <input
                type="text"
                value={formData.waiverTrigger || ''}
                onChange={(e) => updateField('waiverTrigger', e.target.value)}
                placeholder="例：1-6級失能、重大疾病"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          )}
        </div>

        {/* 按鈕 */}
        <div className="px-5 py-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center justify-center gap-2"
          >
            <Save size={16} />
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CheckupReport({ userId, clientId, onBack }: CheckupReportProps) {
  const { policies, loading, updatePolicy } = usePolicies(userId || null, clientId);
  const { lookupProduct } = useProductCache();
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [productLookups, setProductLookups] = useState<ProductLookupState>({});
  const [lookupInProgress, setLookupInProgress] = useState(false);


  // 編輯險種狀態
  const [editingCoverage, setEditingCoverage] = useState<{
    policyId: string;
    coverageIdx: number;
    coverage: Coverage;
    category?: ProductCategory;
  } | null>(null);

  // 儲存編輯結果
  const handleSaveCoverage = async (updates: Partial<Coverage>) => {
    console.log('[handleSaveCoverage] Called with:', updates);
    if (!editingCoverage) {
      console.log('[handleSaveCoverage] No editingCoverage, returning');
      return;
    }

    const { policyId, coverageIdx } = editingCoverage;
    const policy = policies.find(p => p.id === policyId);
    if (!policy || !policy.coverages) {
      console.log('[handleSaveCoverage] No policy or coverages, returning');
      return;
    }
    console.log('[handleSaveCoverage] Updating policy:', policyId, 'idx:', coverageIdx);

    // 更新 coverage
    const updatedCoverages = [...policy.coverages];
    updatedCoverages[coverageIdx] = {
      ...updatedCoverages[coverageIdx],
      ...updates,
    };

    // 儲存到 Firestore
    await updatePolicy(policyId, { coverages: updatedCoverages });

    // 更新本地 productLookups 狀態
    const key = coverageIdx === 0 ? `${policyId}_main` : `${policyId}_${coverageIdx}`;
    setProductLookups(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        loading: false,
        category: updates.category,
        claimSummary: updates.claimSummary,
        isCopyReceipt: updates.isCopyReceipt,
      },
    }));

    setEditingCoverage(null);
  };

  // 從保單中提取被保險人
  const extractedPeople = useMemo(() => {
    const peopleMap = new Map<string, ExtractedPerson>();

    // Debug: 顯示保單資料結構
    console.log('[CheckupReport] policies:', policies.map(p => ({
      id: p.id,
      insurer: p.insurer,
      insured: p.insured,
      applicant: p.applicant,
      coverages: p.coverages?.length,
    })));

    policies.forEach(policy => {
      // 優先使用 insured，如果沒有則嘗試 applicant
      const insuredName = policy.insured || policy.applicant;
      if (!insuredName) {
        console.log('[CheckupReport] Policy missing insured/applicant:', policy.id, policy.insurer);
        return;
      }

      const existing = peopleMap.get(insuredName);
      if (existing) {
        existing.policyIds.push(policy.id);
        existing.totalPremium += policy.totalAnnualPremium || 0;
        if (!existing.gender && policy.insuredGender) {
          existing.gender = policy.insuredGender;
        }
        if (existing.age === undefined) {
          if (policy.insuredBirthDate) {
            existing.age = calcAge(policy.insuredBirthDate);
          } else if (policy.insuredAgeAtIssue && policy.effectiveDate) {
            existing.age = estimateCurrentAge(policy.insuredAgeAtIssue, policy.effectiveDate);
          }
        }
      } else {
        let age: number | undefined;
        if (policy.insuredBirthDate) {
          age = calcAge(policy.insuredBirthDate);
        } else if (policy.insuredAgeAtIssue && policy.effectiveDate) {
          age = estimateCurrentAge(policy.insuredAgeAtIssue, policy.effectiveDate);
        }

        peopleMap.set(insuredName, {
          name: insuredName,
          gender: policy.insuredGender,
          age,
          policyIds: [policy.id],
          totalPremium: policy.totalAnnualPremium || 0,
        });
      }
    });

    return Array.from(peopleMap.values());
  }, [policies]);

  // 收集所有需要查詢的險種
  const coveragesToLookup = useMemo(() => {
    const coverages: { key: string; insurer: string; name: string; policyId: string }[] = [];

    policies.forEach(policy => {
      // 主約
      if (policy.insurer) {
        const mainName = policy.coverages?.[0]?.name || policy.insurer;
        coverages.push({
          key: `${policy.id}_main`,
          insurer: policy.insurer,
          name: mainName,
          policyId: policy.id,
        });
      }

      // 附約
      policy.coverages?.forEach((cov, idx) => {
        if (idx > 0 && cov.name) {
          coverages.push({
            key: `${policy.id}_${idx}`,
            insurer: policy.insurer,
            name: cov.name,
            policyId: policy.id,
          });
        }
      });
    });

    return coverages;
  }, [policies]);

  // 頁面載入時，從保單的 coverages 載入已存的分析結果
  useEffect(() => {
    if (loading) return; // 等待載入完成

    // Debug: 顯示所有 coverages 的分析結果
    console.log('[CheckupReport] 檢查已存分析結果:');
    policies.forEach(policy => {
      policy.coverages?.forEach((cov, idx) => {
        console.log(`  - ${policy.id}[${idx}] ${cov.name}: category=${cov.category}, hasSummary=${!!cov.claimSummary}`);
      });
    });

    const savedLookups: ProductLookupState = {};

    policies.forEach(policy => {
      policy.coverages?.forEach((cov, idx) => {
        const key = idx === 0 ? `${policy.id}_main` : `${policy.id}_${idx}`;
        // 如果 coverage 已有分析結果，載入到 state
        if (cov.claimSummary || cov.category) {
          savedLookups[key] = {
            loading: false,
            claimSummary: cov.claimSummary,
            category: cov.category,
            waitingPeriod: cov.waitingPeriod,
            isCopyReceipt: cov.isCopyReceipt,
          };
        }
      });
    });

    console.log('[CheckupReport] 載入分析結果:', Object.keys(savedLookups).length, '筆');
    if (Object.keys(savedLookups).length > 0) {
      // 用 savedLookups 覆蓋，確保 Firestore 的數據優先
      setProductLookups(savedLookups);
    }
  }, [policies, loading]);

  // 批次查詢理賠摘要並存檔
  const lookupAllProducts = async () => {
    if (lookupInProgress) return;
    setLookupInProgress(true);

    // 收集每個保單的更新結果
    const policyResults: Record<string, Record<number, {
      claimSummary: ClaimSummary;
      category: ProductCategory;
      waitingPeriod?: number;
      isCopyReceipt?: boolean;
    }>> = {};

    for (const cov of coveragesToLookup) {
      // 如果已經查詢過或 coverage 已有分析結果，跳過
      if (productLookups[cov.key]?.claimSummary || productLookups[cov.key]?.category) {
        console.log(`[lookupAllProducts] 跳過已有結果: ${cov.key}`);
        continue;
      }
      // 也檢查 coverage 本身是否已有分析結果
      const policy = policies.find(p => p.id === cov.policyId);
      const idx = cov.key.includes('_main') ? 0 : parseInt(cov.key.split('_')[1]);
      const coverage = policy?.coverages?.[idx];
      if (coverage?.claimSummary || coverage?.category) {
        console.log(`[lookupAllProducts] 跳過 coverage 已有結果: ${cov.key}`);
        continue;
      }

      setProductLookups(prev => ({
        ...prev,
        [cov.key]: { loading: true },
      }));

      try {
        const result = await lookupProduct(cov.insurer, cov.name);
        if (result) {
          const lookupData = {
            loading: false,
            claimSummary: result.claimSummary,
            category: result.product.category,
            waitingPeriod: result.product.waitingPeriod,
            isCopyReceipt: result.product.isCopyReceipt,
          };
          setProductLookups(prev => ({
            ...prev,
            [cov.key]: lookupData,
          }));

          // 記錄此險種的分析結果
          if (!policyResults[cov.policyId]) {
            policyResults[cov.policyId] = {};
          }
          policyResults[cov.policyId][idx] = {
            claimSummary: result.claimSummary,
            category: result.product.category,
            waitingPeriod: result.product.waitingPeriod,
            isCopyReceipt: result.product.isCopyReceipt,
          };
        } else {
          setProductLookups(prev => ({
            ...prev,
            [cov.key]: { loading: false, error: '查詢失敗' },
          }));
        }
      } catch (err) {
        setProductLookups(prev => ({
          ...prev,
          [cov.key]: { loading: false, error: '查詢錯誤' },
        }));
      }
    }

    // 批次更新保單到 Firestore（重新讀取最新的 policies）
    for (const [policyId, results] of Object.entries(policyResults)) {
      try {
        // 找到最新的 policy（從 Firestore 監聽的 policies）
        const policy = policies.find(p => p.id === policyId);
        if (!policy || !policy.coverages) {
          console.error(`[CheckupReport] 找不到保單 ${policyId}`);
          continue;
        }

        // 遞迴移除 undefined 值（包含嵌套物件）
        const removeUndefined = (obj: any): any => {
          if (obj === null || obj === undefined) return undefined;
          if (typeof obj !== 'object') return obj;
          if (Array.isArray(obj)) return obj.map(removeUndefined).filter(v => v !== undefined);

          const cleaned: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
              const cleanedValue = removeUndefined(value);
              if (cleanedValue !== undefined && (typeof cleanedValue !== 'object' || Object.keys(cleanedValue).length > 0)) {
                cleaned[key] = cleanedValue;
              }
            }
          }
          return Object.keys(cleaned).length > 0 ? cleaned : undefined;
        };

        // 複製 coverages 並更新有分析結果的險種
        const updatedCoverages = policy.coverages.map((cov, idx) => {
          if (results[idx]) {
            console.log(`[CheckupReport] 更新險種 ${idx}: ${cov.name}`, JSON.stringify(results[idx], null, 2));
            const cleanResult = removeUndefined(results[idx]);
            console.log(`[CheckupReport] 清理後:`, JSON.stringify(cleanResult, null, 2));

            if (cleanResult && Object.keys(cleanResult).length > 0) {
              return {
                ...cov,
                ...cleanResult,
              };
            }
          }
          return cov;
        });

        await updatePolicy(policyId, { coverages: updatedCoverages });
        console.log(`[CheckupReport] 已儲存分析結果到保單 ${policyId}，共 ${Object.keys(results).length} 筆`);
      } catch (err) {
        console.error(`[CheckupReport] 儲存失敗:`, err);
      }
    }

    setLookupInProgress(false);
  };

  // 每個人的保障分析（結合理賠摘要）
  const coverageByPerson = useMemo(() => {
    const result: Record<string, {
      categories: Record<string, boolean>;
      categorySummary: Record<string, string[]>;  // 每個類別的保額摘要
      policies: PolicyInfo[];
      claimDetails: { coverage: Coverage; lookup?: ProductLookupState[string] }[];
    }> = {};

    extractedPeople.forEach(person => {
      const personPolicies = policies.filter(p =>
        (p.insured || p.applicant) === person.name
      );

      const categories: Record<string, boolean> = {};
      const categorySummary: Record<string, string[]> = {};
      COVERAGE_CATEGORIES.forEach(cat => {
        categories[cat.key] = false;
        categorySummary[cat.key] = [];
      });

      const claimDetails: { coverage: Coverage; lookup?: ProductLookupState[string] }[] = [];

      personPolicies.forEach(policy => {
        policy.coverages?.forEach((cov, idx) => {
          const key = idx === 0 ? `${policy.id}_main` : `${policy.id}_${idx}`;
          const lookup = productLookups[key];

          // 根據 lookup 結果或名稱判斷類別
          const cats = getCoverageCategory(lookup?.category, cov.name);
          // 優先使用保單上的實際保額，否則用 AI 回傳的金額
          const actualAmount = cov.sumInsured || 0;

          cats.forEach(cat => {
            categories[cat] = true;

            // 收集該類別的保額摘要（優先使用實際保額）
            const summary = lookup?.claimSummary;
            if (summary) {
              if (cat === 'life' && (actualAmount || summary.lumpSum?.death)) {
                categorySummary[cat].push(`身故 ${formatAmount(actualAmount || summary.lumpSum?.death)}`);
              }
              if (cat === 'accident') {
                if (actualAmount || summary.lumpSum?.accidentDeath) categorySummary[cat].push(`意外身故 ${formatAmount(actualAmount || summary.lumpSum?.accidentDeath)}`);
                if (summary.accidentMedical?.actualExpense) categorySummary[cat].push(`實支 ${formatAmount(summary.accidentMedical.actualExpense)}`);
              }
              if (cat === 'critical' && (actualAmount || summary.lumpSum?.criticalIllness)) {
                categorySummary[cat].push(`重疾 ${formatAmount(actualAmount || summary.lumpSum?.criticalIllness)}`);
                // 輕度重疾通常是 10% 保額
                const lightAmount = actualAmount ? Math.round(actualAmount * 0.1) : summary.lumpSum?.criticalIllnessLight;
                if (lightAmount) categorySummary[cat].push(`輕度 ${formatAmount(lightAmount)}`);
              }
              if (cat === 'cancer') {
                if (actualAmount || summary.lumpSum?.cancer) categorySummary[cat].push(`一次金 ${formatAmount(actualAmount || summary.lumpSum?.cancer)}`);
              }
              if (cat === 'hospital' && summary.hospitalDaily?.illness) {
                categorySummary[cat].push(`日額 ${formatAmount(summary.hospitalDaily.illness)}/日`);
              }
              if (cat === 'medical' && summary.actualExpense) {
                if (summary.actualExpense.medicalExpense) categorySummary[cat].push(`雜費 ${formatAmount(summary.actualExpense.medicalExpense)}`);
              }
              if (cat === 'disability' && (actualAmount || summary.lumpSum?.totalDisability)) {
                categorySummary[cat].push(`完全失能 ${formatAmount(actualAmount || summary.lumpSum?.totalDisability)}`);
              }
              if (cat === 'longterm' && summary.longTermCare?.monthly) {
                categorySummary[cat].push(`月給付 ${formatAmount(summary.longTermCare.monthly)}`);
              }
            } else if (actualAmount) {
              // 即使沒有 AI 分析結果，但有實際保額，也顯示
              if (cat === 'life') categorySummary[cat].push(`身故 ${formatAmount(actualAmount)}`);
              if (cat === 'accident') categorySummary[cat].push(`意外身故 ${formatAmount(actualAmount)}`);
              if (cat === 'critical') {
                categorySummary[cat].push(`重疾 ${formatAmount(actualAmount)}`);
                categorySummary[cat].push(`輕度 ${formatAmount(Math.round(actualAmount * 0.1))}`);
              }
              if (cat === 'cancer') categorySummary[cat].push(`一次金 ${formatAmount(actualAmount)}`);
              if (cat === 'disability') categorySummary[cat].push(`完全失能 ${formatAmount(actualAmount)}`);
            }
          });

          claimDetails.push({ coverage: cov, lookup });
        });
      });

      result[person.name] = {
        categories,
        categorySummary,
        policies: personPolicies,
        claimDetails,
      };
    });

    return result;
  }, [extractedPeople, policies, productLookups]);

  // 計算保障分數
  const calculateScore = (categories: Record<string, boolean>): number => {
    const weights: Record<string, number> = {
      life: 15, accident: 10, critical: 15, cancer: 15,
      hospital: 10, medical: 15, disability: 10, longterm: 10,
    };
    let score = 0;
    Object.entries(categories).forEach(([key, has]) => {
      if (has) score += weights[key] || 10;
    });
    return Math.min(100, score);
  };

  // 整體平均分數
  const averageScore = useMemo(() => {
    if (extractedPeople.length === 0) return 0;
    const scores = extractedPeople.map(p =>
      calculateScore(coverageByPerson[p.name]?.categories || {})
    );
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [extractedPeople, coverageByPerson]);

  const totalAnnualPremium = policies.reduce((sum, p) => sum + (p.totalAnnualPremium || 0), 0);
  const selectedPersonData = selectedPerson ? coverageByPerson[selectedPerson] : null;
  const selectedPersonInfo = extractedPeople.find(p => p.name === selectedPerson);

  // 查詢進度
  const lookupProgress = useMemo(() => {
    const total = coveragesToLookup.length;
    const completed = Object.values(productLookups).filter(l => !l.loading).length;
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [coveragesToLookup, productLookups]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (policies.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle size={48} className="text-amber-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">尚無保單資料</h2>
        <p className="text-slate-500 mb-6">請先在 Step 1 輸入保單，才能產生健診報告。</p>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
        >
          返回輸入保單
        </button>
      </div>
    );
  }

  // 如果有保單但沒有被保險人（insured/applicant 都是空的）
  if (extractedPeople.length === 0 && policies.length > 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <User size={48} className="text-amber-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">保單缺少被保險人資訊</h2>
        <p className="text-slate-500 mb-4">
          已有 {policies.length} 張保單，但缺少「被保險人」或「要保人」欄位。
        </p>
        <p className="text-slate-400 text-sm mb-6">
          請返回 Step 1 編輯保單，填寫被保險人姓名後再進行分析。
        </p>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
        >
          返回編輯保單
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 查詢理賠摘要按鈕 */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Search size={18} className="text-purple-500" />
              AI 條款分析
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              查詢各險種的理賠條件與保障內容
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lookupProgress.completed > 0 && (
              <span className="text-sm text-slate-500">
                {lookupProgress.completed}/{lookupProgress.total} 完成
              </span>
            )}
            <button
              onClick={lookupAllProducts}
              disabled={lookupInProgress}
              className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors ${
                lookupInProgress
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {lookupInProgress ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Search size={16} />
                  {lookupProgress.completed > 0 ? '重新分析' : '開始分析'}
                </>
              )}
            </button>
          </div>
        </div>
        {lookupInProgress && (
          <div className="mt-3">
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${lookupProgress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 總覽卡片 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-5 text-center">
          <Award size={28} className="mx-auto mb-2 opacity-80" />
          <div className="text-4xl font-bold">{averageScore}</div>
          <div className="text-sm opacity-80">保障分數</div>
        </div>
        <div className="bg-white border rounded-2xl p-5 text-center">
          <Shield size={28} className="mx-auto mb-2 text-emerald-500" />
          <div className="text-3xl font-bold text-slate-800">{policies.length}</div>
          <div className="text-sm text-slate-500">張保單</div>
        </div>
        <div className="bg-white border rounded-2xl p-5 text-center">
          <BarChart3 size={28} className="mx-auto mb-2 text-purple-500" />
          <div className="text-2xl font-bold text-slate-800">
            {totalAnnualPremium >= 100000
              ? `${(totalAnnualPremium / 10000).toFixed(1)} 萬`
              : `NT$ ${totalAnnualPremium.toLocaleString()}`
            }
          </div>
          <div className="text-sm text-slate-500">年繳保費</div>
        </div>
      </div>

      {/* 被保險人保障總覽表 */}
      <div className="bg-white border rounded-2xl overflow-hidden mb-6">
        <div className="px-5 py-3 border-b bg-slate-50">
          <h3 className="font-bold text-slate-800">保障總覽</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">被保險人</th>
                {COVERAGE_CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <th key={cat.key} className="px-3 py-3 text-center font-medium whitespace-nowrap">
                      <div className="flex flex-col items-center gap-1">
                        <Icon size={14} className={cat.color} />
                        <span>{cat.label}</span>
                      </div>
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-right font-medium">年保費</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {extractedPeople.map(person => {
                const data = coverageByPerson[person.name];
                const score = calculateScore(data?.categories || {});
                return (
                  <tr key={person.name} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                          person.gender === 'female' ? 'bg-pink-500' : 'bg-blue-500'
                        }`}>
                          {person.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">{person.name}</div>
                          <div className="text-xs text-slate-500">
                            {person.age !== undefined && `${person.age}歲`}
                            <span className={`ml-2 ${
                              score >= 80 ? 'text-emerald-500' :
                              score >= 50 ? 'text-amber-500' : 'text-red-500'
                            }`}>
                              {score}分
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    {COVERAGE_CATEGORIES.map(cat => (
                      <td key={cat.key} className="px-3 py-3 text-center">
                        {data?.categories[cat.key] ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full text-xs font-bold">
                            ✓
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {person.totalPremium.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 被保險人選擇按鈕 */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        <span className="text-sm text-slate-500 shrink-0">查看詳細：</span>
        {extractedPeople.map(person => {
          const data = coverageByPerson[person.name];
          const score = calculateScore(data?.categories || {});
          const isActive = selectedPerson === person.name;
          return (
            <button
              key={person.name}
              onClick={() => setSelectedPerson(isActive ? null : person.name)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-white border text-slate-600 hover:border-blue-400'
              }`}
            >
              {person.name}
              <span className={`text-xs ${
                isActive ? 'text-white/70' :
                score >= 80 ? 'text-emerald-500' :
                score >= 50 ? 'text-amber-500' : 'text-red-500'
              }`}>
                {score}分
              </span>
            </button>
          );
        })}
      </div>

      {/* 選中人員的詳細分析 */}
      {selectedPerson && selectedPersonData && selectedPersonInfo && (
        <div className="space-y-4 mb-6">
          {/* 保障缺口分析 */}
          <div className="bg-white border rounded-2xl p-5">
            <h3 className="font-bold text-slate-800 mb-4">
              {selectedPerson} — 保障分析（{calculateScore(selectedPersonData.categories)}分）
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {COVERAGE_CATEGORIES.map(cat => {
                const hasIt = selectedPersonData.categories[cat.key];
                const summaryItems = selectedPersonData.categorySummary[cat.key] || [];
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.key}
                    className={`p-4 rounded-xl border-2 ${
                      hasIt
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className={hasIt ? 'text-emerald-600' : 'text-red-400'} />
                        <span className="font-medium text-slate-700">{cat.label}</span>
                      </div>
                      {hasIt ? (
                        <span className="text-emerald-600 text-lg">✓</span>
                      ) : (
                        <span className="text-red-400 text-lg">✗</span>
                      )}
                    </div>
                    {hasIt && summaryItems.length > 0 ? (
                      <div className="text-xs text-emerald-700 space-y-0.5">
                        {summaryItems.slice(0, 2).map((item, i) => (
                          <div key={i}>{item}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">
                        {hasIt ? '已有保障' : '建議補強'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 建議 */}
            <div className="mt-4 p-4 bg-blue-50 rounded-xl">
              <h4 className="font-medium text-blue-800 mb-2">保障建議</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                {COVERAGE_CATEGORIES.filter(cat => !selectedPersonData.categories[cat.key]).length === 0 ? (
                  <li>保障項目完整，建議定期檢視保額是否足夠。</li>
                ) : (
                  COVERAGE_CATEGORIES
                    .filter(cat => !selectedPersonData.categories[cat.key])
                    .slice(0, 3)
                    .map(cat => (
                      <li key={cat.key}>• 缺少「{cat.label}」保障，建議評估補強</li>
                    ))
                )}
              </ul>
            </div>
          </div>

          {/* 理賠摘要明細 */}
          <div className="bg-white border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b bg-slate-50">
              <h3 className="font-bold text-slate-800">
                {selectedPerson} 的保障明細（{selectedPersonData.policies.length} 張保單）
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {selectedPersonData.policies.map(policy => (
                <div key={policy.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-slate-800">
                        {policy.insurer}
                      </h4>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {policy.policyNumber && `#${policy.policyNumber}`}
                        {policy.effectiveDate && ` · 生效 ${policy.effectiveDate}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-slate-700">
                        NT$ {(policy.totalAnnualPremium || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500">
                        {policy.paymentFrequency || '年繳'}
                      </p>
                    </div>
                  </div>

                  {/* 險種理賠摘要 */}
                  <div className="space-y-2">
                    {policy.coverages?.map((cov, idx) => {
                      const key = idx === 0 ? `${policy.id}_main` : `${policy.id}_${idx}`;
                      const lookup = productLookups[key];
                      const currentCategory = lookup?.category || cov.category;
                      const currentSummary = lookup?.claimSummary || cov.claimSummary;

                      return (
                        <div key={idx} className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                cov.isRider ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {cov.isRider ? '附約' : '主約'}
                              </span>
                              <span className="text-sm font-medium text-slate-700">
                                {cov.name || '未命名險種'}
                              </span>
                              {/* 分類標籤 */}
                              {currentCategory && (
                                <button
                                  onClick={() => setEditingCoverage({
                                    policyId: policy.id,
                                    coverageIdx: idx,
                                    coverage: cov,
                                    category: currentCategory,
                                  })}
                                  className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                                  title="點擊修改分類"
                                >
                                  {CATEGORY_LABELS[currentCategory] || currentCategory}
                                </button>
                              )}
                              {!currentCategory && (
                                <button
                                  onClick={() => setEditingCoverage({
                                    policyId: policy.id,
                                    coverageIdx: idx,
                                    coverage: cov,
                                    category: undefined,
                                  })}
                                  className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                                >
                                  設定分類
                                </button>
                              )}
                            </div>
                            {lookup?.loading && (
                              <Loader2 size={14} className="animate-spin text-slate-400" />
                            )}
                          </div>

                          {/* 可編輯的理賠摘要 */}
                          <EditableClaimSummary
                            summary={currentSummary}
                            category={currentCategory}
                            sumInsured={cov.sumInsured}
                            onUpdate={async (updates) => {
                              // 更新 coverage
                              const updatedCoverages = [...(policy.coverages || [])];
                              updatedCoverages[idx] = {
                                ...updatedCoverages[idx],
                                sumInsured: updates.sumInsured,
                                claimSummary: updates.claimSummary,
                              };
                              // 儲存到 Firestore
                              await updatePolicy(policy.id, { coverages: updatedCoverages });
                              // 更新本地狀態
                              setProductLookups(prev => ({
                                ...prev,
                                [key]: {
                                  ...prev[key],
                                  claimSummary: updates.claimSummary,
                                },
                              }));
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 導航按鈕 */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
        >
          <ArrowLeft size={18} />
          返回保單輸入
        </button>
      </div>

      {/* 編輯險種彈窗 */}
      {editingCoverage && (
        <EditCoverageModal
          coverage={editingCoverage.coverage}
          category={editingCoverage.category}
          onSave={handleSaveCoverage}
          onClose={() => setEditingCoverage(null)}
        />
      )}
    </div>
  );
}
