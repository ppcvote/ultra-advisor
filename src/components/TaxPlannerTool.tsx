import React, { useState, useMemo, useEffect } from 'react';
import {
  Landmark,
  Calculator,
  Scale,
  AlertTriangle,
  Siren,
  CheckCircle2,
  ShieldCheck,
  Activity,
  Heart,
  TrendingUp,
  TrendingDown,
  Zap,
  ArrowRight,
  Sparkles,
  Clock,
  Banknote,
  Target,
  Award,
  ChevronRight,
  Calendar,
  PiggyBank,
  Shield,
  X,
  Lock,
  Crown
} from 'lucide-react';
import { useMembership } from '../hooks/useMembership';
import { useCheatSheetTrigger } from '../hooks/useCheatSheetTrigger';
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  LabelList
} from 'recharts';
import DisclaimerFooter from './DisclaimerFooter';
import ShareButton from './ShareButton';
import { auth } from '../firebase';
// Sprint 6 — "use ${client}'s data" chip. Active-client bridge lives in
// useClientContext; ClientDataPanel renders nothing when no fields are
// available, so this is safe to mount unconditionally.
import { ClientDataPanel } from './ClientDataPanel';

// ============================================================
// 輔助函式
// ============================================================
const formatMoney = (val: number) => {
  if (val >= 10000) {
    const yi = Math.floor(val / 10000);
    const wan = Math.round(val % 10000);
    return wan > 0 ? `${yi}億${wan}萬` : `${yi}億`;
  }
  return `${Math.round(val).toLocaleString()}萬`;
};

const formatMoneyShort = (val: number) => {
  if (val >= 10000) return `${(val / 10000).toFixed(1)}億`;
  return `${Math.round(val)}萬`;
};

// ============================================================
// 稅務常數 (114-115年適用)
// ============================================================
const TAX_CONSTANTS = {
  EXEMPTION: 1333,
  DEDUCT_SPOUSE: 553,
  DEDUCT_CHILD: 56,
  DEDUCT_PARENT: 138,
  DEDUCT_HANDICAPPED: 693,
  DEDUCT_FUNERAL: 138,
  BRACKET_1: 5621,
  BRACKET_2: 11242,
  DIFF_15: 281.05,
  DIFF_20: 843.15,
  AMT_THRESHOLD: 3740,
  APPLICABLE_YEARS: '114-115',
};

// ============================================================
// 主元件
// ============================================================
export const TaxPlannerTool = ({ data, setData, userId }: any) => {
  // 會員權限判斷
  const { membership } = useMembership(userId || null);
  const isPaidMember = membership?.isPaid || false;

  const {
    clickHandler: handleSecretClick,
    isOpen: showCheatSheet,
    close: closeCheatSheet,
  } = useCheatSheetTrigger();

  // --- 資料初始化 ---
  const safeData = {
    spouse: data?.spouse !== undefined ? Boolean(data.spouse) : true,
    children: data?.children !== undefined ? Number(data.children) : 2, 
    minorYearsTotal: Number(data?.minorYearsTotal) || 0,
    parents: Number(data?.parents) || 0,
    handicapped: Number(data?.handicapped) || 0,
    
    cash: Number(data?.cash) || 5000, 
    realEstateMarket: Number(data?.realEstateMarket) || 6000,
    realEstateRatio: Number(data?.realEstateRatio) || 70,
    stocks: Number(data?.stocks) || 2000, 
    otherAssets: Number(data?.otherAssets) || 0, 
    
    spouseAssets: Number(data?.spouseAssets) || 1500,
    
    // 【v3 新增】規劃模式與參數
    planMode: data?.planMode || 'none',  // 'none' | 'lumpSum' | 'installment'
    
    // 躉繳參數
    lumpSumAmount: Number(data?.lumpSumAmount) || 0,
    lumpSumLeverage: Number(data?.lumpSumLeverage) || 1.1,
    
    // 分期參數
    annualPremium: Number(data?.annualPremium) || 100,
    paymentYears: Number(data?.paymentYears) || 10,
    installmentLeverage: Number(data?.installmentLeverage) || 2.0,
    
    // 風險評估
    age: Number(data?.age) || 55,
    healthStatus: data?.healthStatus || 'normal',
    recentPolicies: Number(data?.recentPolicies) || 0,
  };

  const { 
    spouse, children, minorYearsTotal, parents, handicapped,
    cash, realEstateMarket, realEstateRatio, stocks, otherAssets,
    spouseAssets,
    planMode, lumpSumAmount, lumpSumLeverage,
    annualPremium, paymentYears, installmentLeverage,
    age, healthStatus, recentPolicies
  } = safeData;

  const [showRiskDetail, setShowRiskDetail] = useState(false);

  // --- Local State for Inputs ---
  const [tempCash, setTempCash] = useState(cash);
  const [tempRealEstate, setTempRealEstate] = useState(realEstateMarket);
  const [tempStocks, setTempStocks] = useState(stocks);
  const [tempSpouseAssets, setTempSpouseAssets] = useState(spouseAssets);
  const [tempAge, setTempAge] = useState(age);
  const [tempLumpSum, setTempLumpSum] = useState(lumpSumAmount);
  const [tempAnnualPremium, setTempAnnualPremium] = useState(annualPremium);
  const [tempLumpSumLeverage, setTempLumpSumLeverage] = useState(lumpSumLeverage);
  const [tempPaymentYears, setTempPaymentYears] = useState(paymentYears);
  const [tempInstallmentLeverage, setTempInstallmentLeverage] = useState(installmentLeverage);

  useEffect(() => { setTempCash(cash); }, [cash]);
  useEffect(() => { setTempRealEstate(realEstateMarket); }, [realEstateMarket]);
  useEffect(() => { setTempStocks(stocks); }, [stocks]);
  useEffect(() => { setTempSpouseAssets(spouseAssets); }, [spouseAssets]);
  useEffect(() => { setTempAge(age); }, [age]);
  useEffect(() => { setTempLumpSum(lumpSumAmount); }, [lumpSumAmount]);
  useEffect(() => { setTempAnnualPremium(annualPremium); }, [annualPremium]);
  useEffect(() => { setTempLumpSumLeverage(lumpSumLeverage); }, [lumpSumLeverage]);
  useEffect(() => { setTempPaymentYears(paymentYears); }, [paymentYears]);
  useEffect(() => { setTempInstallmentLeverage(installmentLeverage); }, [installmentLeverage]);

  // ============================================================
  // 核心計算引擎
  // ============================================================
  const calculations = useMemo(() => {
    const T = TAX_CONSTANTS;
    
    const estimatedOfficialRealEstate = Math.round(realEstateMarket * (realEstateRatio / 100));
    const totalEstateBefore = cash + estimatedOfficialRealEstate + stocks + otherAssets;
    
    // 配偶剩餘財產請求權
    const spousalRightDeduction = spouse 
      ? Math.max(0, Math.floor((totalEstateBefore - spouseAssets) / 2))
      : 0;
    
    const estateAfterSpousalRight = totalEstateBefore - spousalRightDeduction;

    // 免稅額與扣除額
    const exemption = T.EXEMPTION;
    const deductSpouse = spouse ? T.DEDUCT_SPOUSE : 0;
    const deductChildren = (children * T.DEDUCT_CHILD) + (minorYearsTotal * T.DEDUCT_CHILD);
    const deductParents = parents * T.DEDUCT_PARENT;
    const deductHandicapped = handicapped * T.DEDUCT_HANDICAPPED;
    const deductFuneral = T.DEDUCT_FUNERAL;
    
    const totalDeductions = exemption + deductSpouse + deductChildren + deductParents + deductHandicapped + deductFuneral;

    // 課稅遺產淨額（未規劃）
    const netEstateBefore = Math.max(0, estateAfterSpousalRight - totalDeductions);

    // 稅率級距判定
    const getTaxBracket = (net: number) => {
      if (net <= 0) return { rate: 0, label: '免稅', color: 'green' };
      if (net <= T.BRACKET_1) return { rate: 10, label: '10%', color: 'yellow' };
      if (net <= T.BRACKET_2) return { rate: 15, label: '15%', color: 'orange' };
      return { rate: 20, label: '20%', color: 'red' };
    };
    
    const bracketBefore = getTaxBracket(netEstateBefore);

    // 稅額計算
    const calculateTax = (net: number) => {
      if (net <= 0) return 0;
      if (net <= T.BRACKET_1) return net * 0.10;
      if (net <= T.BRACKET_2) return (net * 0.15) - T.DIFF_15;
      return (net * 0.20) - T.DIFF_20;
    };

    const taxBefore = calculateTax(netEstateBefore);

    // ============================================================
    // 【躉繳方案計算】
    // ============================================================
    const lumpSum = {
      premium: lumpSumAmount,  // 一次繳保費
      benefit: lumpSumAmount * lumpSumLeverage,  // 理賠金
      estateReduction: lumpSumAmount,  // 遺產減少金額
      
      // 規劃後遺產
      totalEstateAfter: Math.max(0, cash - lumpSumAmount) + estimatedOfficialRealEstate + stocks + otherAssets,
      spousalRightAfter: 0,
      netEstateAfter: 0,
      taxAfter: 0,
      taxSaved: 0,
      bracketAfter: { rate: 0, label: '', color: '' },
      
      // 流動性
      liquidityAvailable: 0,
      
      // 風險評分
      riskScore: 0,
      riskLevel: 'Low' as 'Low' | 'Medium' | 'High',
    };
    
    // 躉繳規劃後計算
    lumpSum.spousalRightAfter = spouse 
      ? Math.max(0, Math.floor((lumpSum.totalEstateAfter - spouseAssets) / 2))
      : 0;
    lumpSum.netEstateAfter = Math.max(0, lumpSum.totalEstateAfter - lumpSum.spousalRightAfter - totalDeductions);
    lumpSum.taxAfter = calculateTax(lumpSum.netEstateAfter);
    lumpSum.taxSaved = taxBefore - lumpSum.taxAfter;
    lumpSum.bracketAfter = getTaxBracket(lumpSum.netEstateAfter);
    lumpSum.liquidityAvailable = Math.max(0, cash - lumpSumAmount) + lumpSum.benefit;
    
    // 躉繳風險評分（較高）
    let lumpSumRisk = 20;  // 躉繳基礎風險
    if (age > 75) lumpSumRisk += 40;
    else if (age > 65) lumpSumRisk += 20;
    if (healthStatus === 'critical') lumpSumRisk += 50;
    else if (healthStatus === 'ill') lumpSumRisk += 25;
    if (lumpSumAmount > 3000) lumpSumRisk += 15;
    lumpSum.riskScore = lumpSumRisk;
    lumpSum.riskLevel = lumpSumRisk >= 50 ? 'High' : lumpSumRisk >= 30 ? 'Medium' : 'Low';

    // ============================================================
    // 【分期繳方案計算】
    // ============================================================
    const totalPremiumPaid = annualPremium * paymentYears;  // 總繳保費
    const installmentBenefit = annualPremium * paymentYears * installmentLeverage;  // 理賠金
    
    const installment = {
      annualPremium: annualPremium,
      years: paymentYears,
      totalPremium: totalPremiumPaid,
      benefit: installmentBenefit,
      leverage: installmentLeverage,
      
      // 規劃後遺產（假設繳完全部保費）
      totalEstateAfter: Math.max(0, cash - totalPremiumPaid) + estimatedOfficialRealEstate + stocks + otherAssets,
      spousalRightAfter: 0,
      netEstateAfter: 0,
      taxAfter: 0,
      taxSaved: 0,
      bracketAfter: { rate: 0, label: '', color: '' },
      
      // 流動性
      liquidityAvailable: 0,
      
      // 風險評分
      riskScore: 0,
      riskLevel: 'Low' as 'Low' | 'Medium' | 'High',
      
      // 【關鍵】第一年即身故的效益（保障倍數）
      // 法規：保險商品不得以「投報率 / ROI」為訴求（金管會保險局 §15）
      // 改以「保障倍數」表達（保額 / 已繳保費）
      year1Benefit: annualPremium * installmentLeverage,
      year1Multiple: installmentLeverage,
    };
    
    // 分期規劃後計算
    installment.spousalRightAfter = spouse 
      ? Math.max(0, Math.floor((installment.totalEstateAfter - spouseAssets) / 2))
      : 0;
    installment.netEstateAfter = Math.max(0, installment.totalEstateAfter - installment.spousalRightAfter - totalDeductions);
    installment.taxAfter = calculateTax(installment.netEstateAfter);
    installment.taxSaved = taxBefore - installment.taxAfter;
    installment.bracketAfter = getTaxBracket(installment.netEstateAfter);
    installment.liquidityAvailable = Math.max(0, cash - totalPremiumPaid) + installmentBenefit;
    
    // 分期風險評分（較低）
    let installmentRisk = 0;
    if (age > 75) installmentRisk += 25;
    else if (age > 65) installmentRisk += 10;
    if (healthStatus === 'critical') installmentRisk += 40;
    else if (healthStatus === 'ill') installmentRisk += 20;
    if (recentPolicies >= 3) installmentRisk += 15;
    installment.riskScore = installmentRisk;
    installment.riskLevel = installmentRisk >= 50 ? 'High' : installmentRisk >= 30 ? 'Medium' : 'Low';

    // ============================================================
    // 【智能推薦引擎】
    // ============================================================
    type RecommendationType = 'lumpSum' | 'installment' | 'both';
    let recommendation: RecommendationType = 'installment';
    let recommendationReasons: string[] = [];
    
    // 推薦邏輯
    if (age >= 70) {
      recommendation = 'lumpSum';
      recommendationReasons.push('年齡較高，建議把握時間立即規劃');
    } else if (age <= 55) {
      recommendation = 'installment';
      recommendationReasons.push('年齡優勢，分期繳可在較長期間內承擔保費');
    }
    
    if (healthStatus === 'critical' || healthStatus === 'ill') {
      recommendation = 'lumpSum';
      recommendationReasons.push('健康因素，建議儘速完成規劃');
    }
    
    if (cash > taxBefore * 3) {
      if (recommendation !== 'lumpSum') recommendation = 'both';
      recommendationReasons.push('現金充裕，可考慮躉繳立即壓縮遺產');
    }
    
    if (bracketBefore.rate >= 15) {
      recommendationReasons.push(`目前稅率 ${bracketBefore.label}，規劃效益顯著`);
    }
    
    // 計算「最佳躉繳金額」：剛好降一級距
    let optimalLumpSum = 0;
    if (bracketBefore.rate === 20) {
      // 目標：降到 15%，淨額需 ≤ 11,242
      optimalLumpSum = Math.max(0, netEstateBefore - T.BRACKET_2 + 100);
    } else if (bracketBefore.rate === 15) {
      // 目標：降到 10%，淨額需 ≤ 5,621
      optimalLumpSum = Math.max(0, netEstateBefore - T.BRACKET_1 + 100);
    } else if (bracketBefore.rate === 10) {
      // 目標：免稅
      optimalLumpSum = Math.max(0, netEstateBefore + 100);
    }
    optimalLumpSum = Math.min(optimalLumpSum, cash);  // 不超過現金

    return {
      // 基礎數據
      estimatedOfficialRealEstate,
      totalEstateBefore,
      spousalRightDeduction,
      totalDeductions,
      netEstateBefore,
      taxBefore,
      bracketBefore,
      
      // 兩種方案
      lumpSum,
      installment,
      
      // 推薦
      recommendation,
      recommendationReasons,
      optimalLumpSum,
      
      // 流動性缺口（未規劃）
      liquidityGap: taxBefore - cash,
    };
  }, [
    spouse, children, minorYearsTotal, parents, handicapped,
    cash, realEstateMarket, realEstateRatio, stocks, otherAssets,
    spouseAssets, lumpSumAmount, lumpSumLeverage,
    annualPremium, paymentYears, installmentLeverage,
    age, healthStatus, recentPolicies
  ]);

  // 雷達圖資料
  const getRiskData = (mode: 'lumpSum' | 'installment') => {
    const isLumpSum = mode === 'lumpSum';
    return [
      { subject: '高齡', A: Math.min(100, Math.max(0, (age - 50) * 2)), fullMark: 100 },
      { subject: '健康', A: healthStatus === 'critical' ? 100 : healthStatus === 'ill' ? 60 : 10, fullMark: 100 },
      { subject: '繳費方式', A: isLumpSum ? 90 : 20, fullMark: 100 },
      { subject: '金額', A: Math.min(100, ((isLumpSum ? lumpSumAmount : annualPremium * paymentYears) / 1000) * 20), fullMark: 100 },
      { subject: '密集投保', A: Math.min(100, recentPolicies * 30), fullMark: 100 },
    ];
  };

  // --- UI Handlers ---
  const updateField = (field: string, value: any) => { 
    setData({ ...data, [field]: value }); 
  };
  
  // 支援多欄位同時更新，避免 race condition
  const updateFields = (updates: Record<string, any>) => {
    setData({ ...data, ...updates });
  };
  
  const handleNumInput = (setter: React.Dispatch<React.SetStateAction<number>>, val: string) => {
    setter(val === '' ? 0 : Number(val));
  };

  const commitNumInput = (field: string, val: number, min: number = 0, max: number = 99999) => {
    let finalVal = Number(val) || 0;
    finalVal = Math.max(min, Math.min(max, finalVal));
    updateField(field, finalVal);
  };

  const handleKeyDown = (commitFn: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitFn();
      e.currentTarget.blur();
    }
  };

  // 快速設定最佳方案
  const applyOptimalPlan = () => {
    if (calculations.recommendation === 'lumpSum' || calculations.recommendation === 'both') {
      updateFields({ planMode: 'lumpSum', lumpSumAmount: calculations.optimalLumpSum });
    } else {
      updateField('planMode', 'installment');
    }
  };

  // ============================================================
  // UI 渲染
  // ============================================================
  return (
    <div className="space-y-6 animate-fade-in font-sans text-slate-800">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-zinc-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Landmark size={160} />
        </div>
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="bg-white/15 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase">
              Estate Tax Planning
            </span>
            <span
              onClick={handleSecretClick}
              className="bg-emerald-500/25 text-emerald-200 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 cursor-default select-none"
            >
              <CheckCircle2 size={12} />
              {TAX_CONSTANTS.APPLICABLE_YEARS}年適用
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold mb-1 tracking-tight">
            稅務傳承專案
          </h1>
          <p className="text-slate-400 text-sm">
            壓縮遺產 + 預留稅源，雙效節稅方案規劃
          </p>
        </div>
      </div>

      {/* Sprint 6 — 主動帶入面板。activeClient 沒值、或對映欄位都沒填時自己回 null，
          不會佔版面、也不會出現空狀態。每個 setter 都走 updateField，沿用既有
          commit path、不繞過 safeData / useMemo 的依賴鍊。 */}
      <ClientDataPanel
        mapping={{
          age: {
            toolField: 'age',
            label: '投保年齡',
            // birthday → number；updateField 已被夾在 20-99，這裡只負責帶入。
            setter: (v) => updateField('age', Number(v)),
          },
          hasSpouse: {
            toolField: 'spouse',
            label: '配偶',
            setter: (v) => updateField('spouse', Boolean(v)),
          },
          childrenCount: {
            toolField: 'children',
            label: '子女人數',
            setter: (v) => updateField('children', Number(v)),
          },
          // Sprint 7: 第 4 個 chip — 扶養父母人數，commit 進 .parents（扣除額算式吃這個）
          dependentParents: {
            toolField: 'parents',
            label: '扶養父母',
            setter: (v) => updateField('parents', Number(v)),
          },
        }}
      />

      {/* ============================================================ */}
      {/* 第一區：資產現況 + 稅務試算 */}
      {/* ============================================================ */}
      <div className="grid lg:grid-cols-3 gap-4">
        
        {/* 資產輸入 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm">
            <Calculator size={16}/> 資產概況
          </h4>
          
          <div className="space-y-3">
            {/* 家庭結構 */}
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
              <span className="text-xs text-slate-600">配偶</span>
              <input 
                type="checkbox" 
                checked={spouse} 
                onChange={(e) => updateField('spouse', e.target.checked)} 
                className="w-4 h-4 accent-blue-600" 
              />
            </div>
            
            {spouse && (
              <div className="p-2 bg-purple-50 rounded-lg">
                <label className="text-[10px] text-purple-600 block mb-1">配偶資產 (萬)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={tempSpouseAssets}
                  onChange={(e) => handleNumInput(setTempSpouseAssets, e.target.value)}
                  onBlur={() => commitNumInput('spouseAssets', tempSpouseAssets, 0, 100000)}
                  onKeyDown={handleKeyDown(() => commitNumInput('spouseAssets', tempSpouseAssets, 0, 100000))}
                  className="w-full p-1.5 border border-purple-200 rounded text-sm font-bold text-purple-700"
                />
              </div>
            )}

            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
              <span className="text-xs text-slate-600">子女</span>
              <div className="flex items-center gap-1">
                <button onClick={() => updateField('children', Math.max(0, children-1))} className="w-6 h-6 rounded bg-slate-200 text-xs font-bold">-</button>
                <span className="w-5 text-center font-bold text-sm">{children}</span>
                <button onClick={() => updateField('children', children+1)} className="w-6 h-6 rounded bg-slate-200 text-xs font-bold">+</button>
              </div>
            </div>

            {/* 資產 */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {[
                { label: '現金', val: tempCash, set: setTempCash, field: 'cash' },
                { label: '不動產市價', val: tempRealEstate, set: setTempRealEstate, field: 'realEstateMarket' },
                { label: '股票基金', val: tempStocks, set: setTempStocks, field: 'stocks' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <label className="text-xs text-slate-500">{item.label}</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={item.val}
                      onChange={(e) => handleNumInput(item.set, e.target.value)}
                      onBlur={() => commitNumInput(item.field, item.val, 0, 100000)}
                      onKeyDown={handleKeyDown(() => commitNumInput(item.field, item.val, 0, 100000))}
                      className="w-20 p-1.5 border rounded text-sm font-bold text-right"
                    />
                    <span className="text-xs text-slate-400">萬</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 年齡 */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <label className="text-xs text-slate-500">投保年齡</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  value={tempAge}
                  onChange={(e) => handleNumInput(setTempAge, e.target.value)}
                  onBlur={() => commitNumInput('age', tempAge, 20, 99)}
                  onKeyDown={handleKeyDown(() => commitNumInput('age', tempAge, 20, 99))}
                  className="w-16 p-1.5 border rounded text-sm font-bold text-center"
                />
                <span className="text-xs text-slate-400">歲</span>
              </div>
            </div>
          </div>
        </div>

        {/* 稅務試算結果 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm">
            <Scale size={16}/> 目前稅務狀況
          </h4>
          
          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">遺產總額</span>
              <span className="font-bold">{formatMoney(calculations.totalEstateBefore)}</span>
            </div>
            {calculations.spousalRightDeduction > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-purple-500">配偶請求權</span>
                <span className="font-bold text-purple-600">-{formatMoney(calculations.spousalRightDeduction)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">免稅+扣除</span>
              <span className="font-bold text-green-600">-{formatMoney(calculations.totalDeductions)}</span>
            </div>
            <div className="h-px bg-slate-100"></div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">課稅淨額</span>
              <div className="flex items-center gap-1">
                <span className="font-bold">{formatMoney(calculations.netEstateBefore)}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  calculations.bracketBefore.color === 'red' ? 'bg-red-100 text-red-600' :
                  calculations.bracketBefore.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                  calculations.bracketBefore.color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-green-100 text-green-600'
                }`}>
                  {calculations.bracketBefore.label}
                </span>
              </div>
            </div>
            
            {/* 應納稅額 - 大字 */}
            <div className={`p-4 rounded-xl text-center ${
              calculations.taxBefore > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
            }`}>
              <p className="text-xs text-slate-500 mb-1">應納遺產稅</p>
              <p className={`text-3xl font-black ${calculations.taxBefore > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatMoney(calculations.taxBefore)}
              </p>
            </div>

            {/* 分享給客戶 — 並列在「應納遺產稅」摘要下方，獨立於 ReportModal 列印 PDF 流程 */}
            <div className="flex justify-end pt-1">
              <ShareButton
                variant="full"
                title="遺產稅試算"
                text={`【遺產稅試算】遺產總額 ${formatMoney(calculations.totalEstateBefore)} — 應納稅額 ${formatMoney(calculations.taxBefore)}`}
              />
            </div>
          </div>
        </div>

        {/* 繳稅資金風險 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm">
            <AlertTriangle size={16} className="text-amber-500"/> 繳稅資金風險
          </h4>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <p className="text-[10px] text-slate-500">應納稅額</p>
                <p className="text-lg font-bold text-red-600">{formatMoney(calculations.taxBefore)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <p className="text-[10px] text-slate-500">名下現金</p>
                <p className="text-lg font-bold text-slate-700">{formatMoney(cash)}</p>
              </div>
            </div>
            
            <div className={`p-3 rounded-lg text-center ${
              calculations.liquidityGap > 0 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
            }`}>
              <p className="text-[10px] text-slate-500">帳面差額</p>
              <p className={`text-xl font-bold ${calculations.liquidityGap > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                {calculations.liquidityGap > 0 ? `-${formatMoney(calculations.liquidityGap)}` : `+${formatMoney(Math.abs(calculations.liquidityGap))}`}
              </p>
            </div>
            
            {/* 隱藏風險提示 */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded">
                <span>🔒</span> 過世後帳戶立即凍結
              </div>
              <div className="flex items-center gap-2 text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded">
                <span>⏳</span> 核定前 3-6 月無現金可用
              </div>
              <div className="flex items-center gap-2 text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded">
                <span>👥</span> 動用需全體繼承人同意
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 第二區：智能推薦 + 方案選擇 */}
      {/* ============================================================ */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Award size={20} className="text-blue-600" />
              <h4 className="font-bold text-blue-900">智能推薦方案</h4>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {calculations.recommendationReasons.map((reason, idx) => (
                <span key={idx} className="px-2 py-1 bg-white/60 rounded text-xs text-blue-700">
                  • {reason}
                </span>
              ))}
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => updateFields({ planMode: 'lumpSum', lumpSumAmount: calculations.optimalLumpSum || 1000 })}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                planMode === 'lumpSum'
                  ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-300'
                  : 'bg-white text-blue-600 border border-blue-200 hover:border-blue-400'
              }`}
            >
              <Banknote size={16} className="inline mr-1" />
              躉繳方案
              {(calculations.recommendation === 'lumpSum' || calculations.recommendation === 'both') && (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-400 text-amber-900 rounded text-[10px]">推薦</span>
              )}
            </button>
            <button
              onClick={() => updateField('planMode', 'installment')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                planMode === 'installment'
                  ? 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-300'
                  : 'bg-white text-emerald-600 border border-emerald-200 hover:border-emerald-400'
              }`}
            >
              <Calendar size={16} className="inline mr-1" />
              分期方案
              {calculations.recommendation === 'installment' && (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-400 text-amber-900 rounded text-[10px]">推薦</span>
              )}
            </button>
          </div>
        </div>
        
        {calculations.optimalLumpSum > 0 && (
          <div className="mt-3 p-3 bg-white/50 rounded-lg">
            <p className="text-xs text-blue-700">
              <Sparkles size={12} className="inline mr-1" />
              <b>最佳躉繳金額：{formatMoney(calculations.optimalLumpSum)}</b>
              　→ 可將稅率從 {calculations.bracketBefore.label} 降至更低級距
            </p>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 第三區：方案詳情（根據選擇顯示）*/}
      {/* ============================================================ */}
      {planMode !== 'none' && (
        <div className="grid lg:grid-cols-2 gap-6">
          
          {/* 方案參數設定 */}
          <div className={`rounded-xl shadow-sm border p-5 ${
            planMode === 'lumpSum' ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'
          }`}>
            <h4 className={`font-bold mb-4 flex items-center gap-2 ${
              planMode === 'lumpSum' ? 'text-blue-800' : 'text-emerald-800'
            }`}>
              {planMode === 'lumpSum' ? (
                <><Banknote size={18}/> 躉繳方案設定</>
              ) : (
                <><Calendar size={18}/> 分期方案設定</>
              )}
            </h4>
            
            {planMode === 'lumpSum' ? (
              <div className="space-y-4">
                {/* 躉繳金額 */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold text-blue-700">躉繳保費</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={tempLumpSum}
                        onChange={(e) => handleNumInput(setTempLumpSum, e.target.value)}
                        onBlur={() => commitNumInput('lumpSumAmount', tempLumpSum, 0, cash)}
                        onKeyDown={handleKeyDown(() => commitNumInput('lumpSumAmount', tempLumpSum, 0, cash))}
                        className="w-24 text-2xl font-black text-blue-700 text-right bg-transparent border-b-2 border-transparent hover:border-blue-300 focus:border-blue-500 focus:outline-none transition-colors"
                      />
                      <span className="text-sm text-slate-400">萬</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={cash}
                    step={100}
                    value={lumpSumAmount}
                    onChange={(e) => updateField('lumpSumAmount', Number(e.target.value))}
                    className="w-full h-3 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-blue-500 mt-1">
                    <span>0</span>
                    <span>最高可用 {formatMoney(cash)}</span>
                  </div>
                </div>

                {/* 保障倍數 */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-blue-600">保障倍數（保額/保費）</label>
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number"
                        inputMode="decimal"
                        step={0.05}
                        value={tempLumpSumLeverage}
                        onChange={(e) => setTempLumpSumLeverage(e.target.value === '' ? 1 : Number(e.target.value))}
                        onBlur={() => commitNumInput('lumpSumLeverage', tempLumpSumLeverage, 1, 1.5)}
                        onKeyDown={handleKeyDown(() => commitNumInput('lumpSumLeverage', tempLumpSumLeverage, 1, 1.5))}
                        className="w-14 font-bold text-blue-700 text-right bg-transparent border-b border-transparent hover:border-blue-300 focus:border-blue-500 focus:outline-none"
                      />
                      <span className="text-blue-400">x</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={1} max={1.5} step={0.05}
                    value={lumpSumLeverage}
                    onChange={(e) => updateField('lumpSumLeverage', Number(e.target.value))}
                    className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                
                {/* 結果摘要 */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-blue-200">
                  <div className="bg-white/60 p-2 rounded text-center">
                    <p className="text-[10px] text-blue-500">預估理賠金</p>
                    <p className="text-lg font-bold text-blue-700">{formatMoney(calculations.lumpSum.benefit)}</p>
                  </div>
                  <div className="bg-white/60 p-2 rounded text-center">
                    <p className="text-[10px] text-blue-500">遺產壓縮</p>
                    <p className="text-lg font-bold text-blue-700">{formatMoney(lumpSumAmount)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 年繳保費 */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold text-emerald-700">年繳保費</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={tempAnnualPremium}
                        onChange={(e) => handleNumInput(setTempAnnualPremium, e.target.value)}
                        onBlur={() => commitNumInput('annualPremium', tempAnnualPremium, 50, 500)}
                        onKeyDown={handleKeyDown(() => commitNumInput('annualPremium', tempAnnualPremium, 50, 500))}
                        className="w-20 text-2xl font-black text-emerald-700 text-right bg-transparent border-b-2 border-transparent hover:border-emerald-300 focus:border-emerald-500 focus:outline-none transition-colors"
                      />
                      <span className="text-sm text-slate-400">萬/年</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={500}
                    step={10}
                    value={annualPremium}
                    onChange={(e) => updateField('annualPremium', Number(e.target.value))}
                    className="w-full h-3 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                </div>

                {/* 繳費年期 */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-emerald-600">繳費年期</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={tempPaymentYears}
                        onChange={(e) => setTempPaymentYears(e.target.value === '' ? 6 : Number(e.target.value))}
                        onBlur={() => commitNumInput('paymentYears', tempPaymentYears, 6, 20)}
                        onKeyDown={handleKeyDown(() => commitNumInput('paymentYears', tempPaymentYears, 6, 20))}
                        className="w-14 font-bold text-emerald-700 text-right bg-transparent border-b border-transparent hover:border-emerald-300 focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="text-emerald-400">年</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={6} max={20} step={1}
                    value={paymentYears}
                    onChange={(e) => updateField('paymentYears', Number(e.target.value))}
                    className="w-full h-2 bg-emerald-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-emerald-500 mt-1">
                    <span>6年</span>
                    <span>20年</span>
                  </div>
                </div>

                {/* 保障倍數 */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs text-emerald-600">保障倍數（保額/總保費）</label>
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number"
                        inputMode="decimal"
                        step={0.1}
                        value={tempInstallmentLeverage}
                        onChange={(e) => setTempInstallmentLeverage(e.target.value === '' ? 1.2 : Number(e.target.value))}
                        onBlur={() => commitNumInput('installmentLeverage', tempInstallmentLeverage, 1.2, 3)}
                        onKeyDown={handleKeyDown(() => commitNumInput('installmentLeverage', tempInstallmentLeverage, 1.2, 3))}
                        className="w-14 font-bold text-emerald-700 text-right bg-transparent border-b border-transparent hover:border-emerald-300 focus:border-emerald-500 focus:outline-none"
                      />
                      <span className="text-emerald-400">x</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={1.2} max={3} step={0.1}
                    value={installmentLeverage}
                    onChange={(e) => updateField('installmentLeverage', Number(e.target.value))}
                    className="w-full h-2 bg-emerald-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                
                {/* 結果摘要 */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-emerald-200">
                  <div className="bg-white/60 p-2 rounded text-center">
                    <p className="text-[10px] text-emerald-500">總繳保費</p>
                    <p className="text-sm font-bold text-emerald-700">{formatMoney(calculations.installment.totalPremium)}</p>
                  </div>
                  <div className="bg-white/60 p-2 rounded text-center">
                    <p className="text-[10px] text-emerald-500">預估理賠金</p>
                    <p className="text-sm font-bold text-emerald-700">{formatMoney(calculations.installment.benefit)}</p>
                  </div>
                  <div className="bg-white/60 p-2 rounded text-center">
                    <p className="text-[10px] text-emerald-500">保障倍數</p>
                    <p className="text-sm font-bold text-emerald-700">{installmentLeverage}x</p>
                  </div>
                </div>
                
                {/* 【關鍵賣點】第一年即保障 */}
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <p className="text-xs font-bold text-amber-800 mb-1">第一年即享完整保障</p>
                  <p className="text-[10px] text-amber-600">
                    繳第一年 {formatMoney(annualPremium)}，即享 {formatMoney(calculations.installment.year1Benefit)} 理賠金保障
                    <br/>
                    <b>保障倍數：約 {calculations.installment.year1Multiple.toFixed(1)} 倍（保額 / 已繳保費）</b>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 規劃效益比較 */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <TrendingDown size={18} className="text-emerald-500"/> 規劃效益分析
            </h4>
            
            {(() => {
              const plan = planMode === 'lumpSum' ? calculations.lumpSum : calculations.installment;
              const premium = planMode === 'lumpSum' ? lumpSumAmount : calculations.installment.totalPremium;
              const isBracketDrop = calculations.bracketBefore.rate > plan.bracketAfter.rate;
              
              return (
                <div className="space-y-4">
                  {/* Before / After 對比 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-red-50 rounded-lg text-center border border-red-100">
                      <p className="text-[10px] text-red-500 mb-1">規劃前稅金</p>
                      <p className="text-xl font-black text-red-600">{formatMoney(calculations.taxBefore)}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        calculations.bracketBefore.color === 'red' ? 'bg-red-100 text-red-600' :
                        calculations.bracketBefore.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                        'bg-yellow-100 text-yellow-600'
                      }`}>{calculations.bracketBefore.label}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg text-center border border-emerald-100">
                      <p className="text-[10px] text-emerald-500 mb-1">規劃後稅金</p>
                      <p className="text-xl font-black text-emerald-600">{formatMoney(plan.taxAfter)}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        plan.bracketAfter.color === 'red' ? 'bg-red-100 text-red-600' :
                        plan.bracketAfter.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                        plan.bracketAfter.color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-green-100 text-green-600'
                      }`}>{plan.bracketAfter.label}</span>
                    </div>
                  </div>
                  
                  {/* 跨級距提示 */}
                  {isBracketDrop && (
                    <div className="bg-gradient-to-r from-amber-100 to-yellow-100 p-3 rounded-lg border border-amber-300 text-center">
                      <Zap size={16} className="inline text-amber-600 mr-1" />
                      <span className="text-sm font-bold text-amber-700">
                        🎉 稅率降級！{calculations.bracketBefore.label} → {plan.bracketAfter.label}
                      </span>
                    </div>
                  )}
                  
                  {/* 節稅金額 */}
                  <div className="bg-emerald-100 p-4 rounded-xl text-center">
                    <p className="text-xs text-emerald-600 mb-1">節省稅金</p>
                    <p className="text-3xl font-black text-emerald-700">{formatMoney(plan.taxSaved)}</p>
                    {premium > 0 && (
                      <p className="text-xs text-emerald-500 mt-1">
                        節稅效率 {((plan.taxSaved / premium) * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                  
                  {/* 流動性解決 */}
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p className="text-xs font-bold text-blue-700 mb-2">💧 流動性保障</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">保險理賠金</span>
                      <span className="font-bold text-blue-600">{formatMoney(plan.benefit)}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-slate-600">規劃後可用資金</span>
                      <span className="font-bold text-blue-600">{formatMoney(plan.liquidityAvailable)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded text-[10px]">✓ 不凍結</span>
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded text-[10px]">✓ 3天給付</span>
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded text-[10px]">✓ 免協議</span>
                    </div>
                  </div>
                  
                  {/* 風險提示 */}
                  <div className={`p-3 rounded-lg border ${
                    plan.riskLevel === 'High' ? 'bg-red-50 border-red-200' :
                    plan.riskLevel === 'Medium' ? 'bg-orange-50 border-orange-200' :
                    'bg-green-50 border-green-200'
                  }`}>
                    <p className={`text-xs font-bold ${
                      plan.riskLevel === 'High' ? 'text-red-700' :
                      plan.riskLevel === 'Medium' ? 'text-orange-700' :
                      'text-green-700'
                    }`}>
                      實質課稅風險：{plan.riskLevel === 'High' ? '⚠️ 較高' : plan.riskLevel === 'Medium' ? '⚡ 中等' : '✓ 較低'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {planMode === 'lumpSum' 
                        ? '躉繳屬八大態樣之一，建議搭配分期規劃降低風險'
                        : '分期繳費風險較低，符合保障本質'}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 第四區：雙方案並列比較（當未選擇時顯示）*/}
      {/* ============================================================ */}
      {planMode === 'none' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* 躉繳方案卡 */}
          <div 
            onClick={() => updateFields({ planMode: 'lumpSum', lumpSumAmount: calculations.optimalLumpSum || 1000 })}
            className="bg-white rounded-xl shadow-sm border-2 border-blue-200 p-5 cursor-pointer hover:border-blue-400 hover:shadow-lg transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-bold text-blue-800 flex items-center gap-2">
                  <Banknote size={20}/> 躉繳方案
                </h4>
                <p className="text-xs text-blue-500">一次付清・立即見效</p>
              </div>
              {(calculations.recommendation === 'lumpSum' || calculations.recommendation === 'both') && (
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold">推薦</span>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={14} className="text-blue-500" />
                <span>立即壓縮遺產總額</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={14} className="text-blue-500" />
                <span>確定性高，即繳即生效</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle size={14} className="text-orange-500" />
                <span className="text-orange-600">實質課稅風險較高</span>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-center group-hover:bg-blue-100 transition-colors">
              <span className="text-sm font-bold text-blue-600 flex items-center justify-center gap-1">
                點擊設定方案 <ChevronRight size={16} />
              </span>
            </div>
          </div>
          
          {/* 分期方案卡 */}
          <div 
            onClick={() => updateField('planMode', 'installment')}
            className="bg-white rounded-xl shadow-sm border-2 border-emerald-200 p-5 cursor-pointer hover:border-emerald-400 hover:shadow-lg transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-bold text-emerald-800 flex items-center gap-2">
                  <Calendar size={20}/> 分期方案
                </h4>
                <p className="text-xs text-emerald-500">年繳計畫・分年承擔保費</p>
              </div>
              {calculations.recommendation === 'installment' && (
                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold">推薦</span>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span>高效益，小保費大保障</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span>第一年即享完整保障</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span>實質課稅風險較低</span>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-emerald-50 rounded-lg text-center group-hover:bg-emerald-100 transition-colors">
              <span className="text-sm font-bold text-emerald-600 flex items-center justify-center gap-1">
                點擊設定方案 <ChevronRight size={16} />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 第五區：底部效益說明 */}
      {/* ============================================================ */}
      <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
        <div className="space-y-3">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <Shield size={18}/> 保險節稅雙效益
          </h4>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold shrink-0">01</div>
              <div>
                <p className="font-bold text-blue-800 text-sm">壓縮遺產</p>
                <p className="text-xs text-blue-600">保費移出遺產，等效增加免稅額</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 font-bold shrink-0">02</div>
              <div>
                <p className="font-bold text-emerald-800 text-sm">預留稅源</p>
                <p className="text-xs text-emerald-600">理賠金不凍結，3天給付繳稅</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          <h4 className="font-bold text-slate-800 flex items-center gap-2">
            <Target size={18}/> 為什麼現在就要規劃
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
              <Clock size={14} className="text-slate-500" />
              <span>年齡越大，保費越高、核保越難</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
              <TrendingUp size={14} className="text-slate-500" />
              <span>資產持續增長，稅負只會更重</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded">
              <Heart size={14} className="text-slate-500" />
              <span>健康是最大的本錢，趁現在</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 隱藏小抄面板 */}
      {/* ============================================================ */}
      {showCheatSheet && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={closeCheatSheet}
          />

          <div className="relative w-full max-w-md bg-slate-900 text-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex justify-between items-center z-10">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  業務小抄
                  {isPaidMember && <Crown size={16} className="text-amber-400" />}
                </h3>
                <p className="text-xs text-slate-400">按 ESC 關閉</p>
              </div>
              <button onClick={closeCheatSheet} className="p-2 hover:bg-slate-700 rounded-lg">
                <X size={20}/>
              </button>
            </div>

            {/* 內容區域 - 根據會員等級顯示 */}
            <div className="relative">
              {/* 非付費會員：模糊遮罩 */}
              {!isPaidMember && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md">
                  <div className="text-center p-8">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                      <Lock size={40} className="text-white" />
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">會員專屬功能</h4>
                    <p className="text-slate-400 text-sm mb-4">
                      業務小抄是付費會員專屬功能<br/>
                      升級後即可解鎖完整話術庫
                    </p>
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg text-white font-bold text-sm">
                        <Crown size={16} />
                        升級成為付費會員
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {membership?.tier === 'referral_trial' ? '轉介紹試用會員可享升級折扣' : '解鎖所有工具與進階功能'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className={`p-4 space-y-6 text-sm ${!isPaidMember ? 'blur-sm pointer-events-none select-none' : ''}`}>
              {/* 當前數據 */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-800 p-2 rounded">
                  <span className="text-slate-500">遺產總額</span>
                  <p className="font-bold">{formatMoney(calculations.totalEstateBefore)}</p>
                </div>
                <div className="bg-slate-800 p-2 rounded">
                  <span className="text-slate-500">應納稅額</span>
                  <p className="font-bold text-red-400">{formatMoney(calculations.taxBefore)}</p>
                </div>
                <div className="bg-slate-800 p-2 rounded">
                  <span className="text-slate-500">建議方案</span>
                  <p className="font-bold text-amber-400">
                    {calculations.recommendation === 'lumpSum' ? '躉繳' : calculations.recommendation === 'installment' ? '分期' : '躉繳+分期'}
                  </p>
                </div>
                <div className="bg-slate-800 p-2 rounded">
                  <span className="text-slate-500">最佳躉繳</span>
                  <p className="font-bold text-emerald-400">{formatMoney(calculations.optimalLumpSum)}</p>
                </div>
              </div>

              {/* 遺產稅基本知識（中性教育內容） */}
              <div>
                <h4 className="font-bold text-amber-400 mb-2">遺產稅常見規則</h4>
                <div className="space-y-2 text-xs">
                  <div className="bg-slate-800 p-2 rounded">
                    <p className="text-amber-300 font-bold">繼承程序</p>
                    <p className="text-slate-400">依《遺產及贈與稅法》第8條，遺產稅未繳清前，原則上不得分割遺產、辦理交付或移轉登記。</p>
                  </div>
                  <div className="bg-slate-800 p-2 rounded">
                    <p className="text-orange-300 font-bold">申報期限</p>
                    <p className="text-slate-400">依《遺贈稅法》第23條，自被繼承人死亡之日起 6 個月內申報；申請延期最長 3 個月。</p>
                  </div>
                  <div className="bg-slate-800 p-2 rounded">
                    <p className="text-red-300 font-bold">遺產分割</p>
                    <p className="text-slate-400">依《民法》第1151條，遺產於分割前由全體繼承人共同繼承，處分需全體同意。</p>
                  </div>
                  <div className="bg-slate-800 p-2 rounded">
                    <p className="text-blue-300 font-bold">繳納方式</p>
                    <p className="text-slate-400">依《遺贈稅法》第30條，可申請現金分 18 期、實物抵繳或以指定受益人之保險給付支付。</p>
                  </div>
                </div>
              </div>

              {/* 躉繳 vs 分期（純技術說明） */}
              <div>
                <h4 className="font-bold text-emerald-400 mb-2">躉繳 vs 分期 結構差異</h4>
                <div className="space-y-2 text-xs">
                  <div className="bg-blue-900/50 p-2 rounded border border-blue-700">
                    <p className="text-blue-300 font-bold">躉繳結構</p>
                    <p className="text-slate-400">一次性繳清保費；保額確定性較高，現金需求大，須評估流動性。</p>
                  </div>
                  <div className="bg-emerald-900/50 p-2 rounded border border-emerald-700">
                    <p className="text-emerald-300 font-bold">分期結構</p>
                    <p className="text-slate-400">第一年保費 {formatMoney(annualPremium)}，年度保障 {formatMoney(calculations.installment.year1Benefit)}，第一年保額／保費比約 {installmentLeverage}（隨繳期遞減）。</p>
                  </div>
                </div>
              </div>

              {/* 風險提示 */}
              <div>
                <h4 className="font-bold text-slate-400 mb-2">提醒</h4>
                <div className="bg-slate-800/50 p-2 rounded border border-slate-700 text-xs text-slate-400 leading-relaxed">
                  本工具為遺產稅試算參考，實際稅額以稅捐稽徵機關核定為準。保險規劃涉及保費、保額、條款排除事項與要保人指定受益人之法律效果，建議搭配律師、會計師、保險業務員專業意見後再做決定。
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <DisclaimerFooter scope="tax" />
    </div>
  );
};

export default TaxPlannerTool;