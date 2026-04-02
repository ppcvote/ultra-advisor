import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Calculator,
  TrendingUp,
  Calendar,
  Percent,
  AlertTriangle,
  BarChart3,
  Table,
  Zap,
  Car,
  Plane,
  Building2,
  PiggyBank,
  X,
  Banknote,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase';
// 不使用 Recharts，改用純 SVG 繪製

// ============================================================
// 輔助函式
// ============================================================
const formatMoney = (val: number, showDecimal = false) => {
  if (Math.abs(val) >= 100000000) {
    return `${(val / 100000000).toFixed(2)}億`;
  }
  if (Math.abs(val) >= 10000) {
    return `${(val / 10000).toFixed(showDecimal ? 2 : 0)}萬`;
  }
  return val.toLocaleString('zh-TW', { maximumFractionDigits: showDecimal ? 2 : 0 });
};

const formatMoneyFull = (val: number) => {
  return val.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
};

// ============================================================
// 計算引擎
// ============================================================
const calculateEqualPayment = (principal: number, annualRate: number, totalMonths: number) => {
  if (annualRate === 0) return principal / totalMonths;
  const monthlyRate = annualRate / 100 / 12;
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
                  (Math.pow(1 + monthlyRate, totalMonths) - 1);
  return payment;
};

const calculateEqualPrincipalPayment = (
  principal: number,
  annualRate: number,
  totalMonths: number,
  currentMonth: number
) => {
  const monthlyRate = annualRate / 100 / 12;
  const monthlyPrincipal = principal / totalMonths;
  const remainingPrincipal = principal - monthlyPrincipal * (currentMonth - 1);
  const monthlyInterest = remainingPrincipal * monthlyRate;
  return monthlyPrincipal + monthlyInterest;
};

const generateAmortizationSchedule = (
  principal: number,
  annualRate: number,
  years: number,
  method: 'equal_payment' | 'equal_principal',
  extraMonthly: number = 0
) => {
  const totalMonths = years * 12;
  const monthlyRate = annualRate / 100 / 12;
  const schedule: Array<{
    month: number;
    year: number;
    payment: number;
    principal: number;
    interest: number;
    balance: number;
    totalPaid: number;
    totalInterest: number;
  }> = [];

  let balance = principal;
  let totalPaid = 0;
  let totalInterest = 0;

  if (method === 'equal_payment') {
    const basePayment = calculateEqualPayment(principal, annualRate, totalMonths);
    
    for (let month = 1; month <= totalMonths && balance > 0; month++) {
      const interest = balance * monthlyRate;
      let principalPayment = basePayment - interest + extraMonthly;
      
      if (principalPayment > balance) {
        principalPayment = balance;
      }
      
      const payment = principalPayment + interest;
      balance = Math.max(0, balance - principalPayment);
      totalPaid += payment;
      totalInterest += interest;

      schedule.push({
        month,
        year: Math.ceil(month / 12),
        payment,
        principal: principalPayment,
        interest,
        balance,
        totalPaid,
        totalInterest
      });

      if (balance <= 0) break;
    }
  } else {
    const monthlyPrincipal = principal / totalMonths;
    
    for (let month = 1; month <= totalMonths && balance > 0; month++) {
      const interest = balance * monthlyRate;
      let principalPayment = monthlyPrincipal + extraMonthly;
      
      if (principalPayment > balance) {
        principalPayment = balance;
      }
      
      const payment = principalPayment + interest;
      balance = Math.max(0, balance - principalPayment);
      totalPaid += payment;
      totalInterest += interest;

      schedule.push({
        month,
        year: Math.ceil(month / 12),
        payment,
        principal: principalPayment,
        interest,
        balance,
        totalPaid,
        totalInterest
      });

      if (balance <= 0) break;
    }
  }

  return schedule;
};

const aggregateByYear = (schedule: ReturnType<typeof generateAmortizationSchedule>) => {
  const yearlyData: Array<{
    year: number;
    totalPayment: number;
    totalPrincipal: number;
    totalInterest: number;
    endBalance: number;
  }> = [];

  let currentYear = 1;
  let yearPayment = 0;
  let yearPrincipal = 0;
  let yearInterest = 0;
  let endBalance = 0;

  schedule.forEach((item, index) => {
    if (item.year !== currentYear) {
      yearlyData.push({
        year: currentYear,
        totalPayment: yearPayment,
        totalPrincipal: yearPrincipal,
        totalInterest: yearInterest,
        endBalance
      });
      currentYear = item.year;
      yearPayment = 0;
      yearPrincipal = 0;
      yearInterest = 0;
    }
    yearPayment += item.payment;
    yearPrincipal += item.principal;
    yearInterest += item.interest;
    endBalance = item.balance;

    if (index === schedule.length - 1) {
      yearlyData.push({
        year: currentYear,
        totalPayment: yearPayment,
        totalPrincipal: yearPrincipal,
        totalInterest: yearInterest,
        endBalance
      });
    }
  });

  return yearlyData;
};

// ============================================================
// 主元件
// ============================================================
export default function MortgageCalculator() {
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const clickTimer = useRef<NodeJS.Timeout | null>(null);

  // 追蹤業務小抄使用次數
  const trackCheatSheetUsage = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { cheatSheetUsageCount: increment(1) });
    } catch (error) {
      console.error('Failed to track cheat sheet usage:', error);
    }
  };

  const handleSecretClick = () => {
    setClickCount(prev => prev + 1);
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => setClickCount(0), 800);
    if (clickCount >= 2) {
      setShowCheatSheet(true);
      trackCheatSheetUsage();
      setClickCount(0);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCheatSheet(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ==========================================
  // AI 分析狀態
  // ==========================================
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAIAnalysis = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiInsight(null);
    try {
      const callable = httpsCallable(functions, 'generateFinancialInsight', { timeout: 30000 });
      const result = await callable({
        type: 'mortgage',
        payload: {
          loanAmount,
          annualRate: interestRate,
          loanTerm,
          method: repaymentMethod,
          monthlyPayment: calculations.monthlyPayment,
          totalInterest: calculations.totalInterest,
          totalPayment: calculations.totalPayment,
          interestRatio: calculations.interestRatio,
        },
      });
      setAiInsight((result.data as any).insight);
    } catch (err: any) {
      console.error('AI analysis failed:', err);
      setAiError(err.message || 'AI 分析暫時無法使用');
    } finally {
      setAiLoading(false);
    }
  };

  // ==========================================
  // 核心狀態
  // ==========================================
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart');
  
  const [loanAmount, setLoanAmount] = useState(1000);
  const [interestRate, setInterestRate] = useState(3.0);
  const [loanTerm, setLoanTerm] = useState(30);
  const [repaymentMethod, setRepaymentMethod] = useState<'equal_payment' | 'equal_principal'>('equal_payment');
  const [extraMonthly, setExtraMonthly] = useState(0);
  const [inflationRate, setInflationRate] = useState(0);

  const [showAllYears, setShowAllYears] = useState(false);
  const [showRateExplain, setShowRateExplain] = useState(false);

  // ==========================================
  // 計算結果
  // ==========================================
  const calculations = useMemo(() => {
    const principal = loanAmount * 10000;
    const totalMonths = loanTerm * 12;
    
    const schedule = generateAmortizationSchedule(
      principal,
      interestRate,
      loanTerm,
      repaymentMethod,
      extraMonthly
    );
    
    const yearlySchedule = aggregateByYear(schedule);
    
    const lastItem = schedule[schedule.length - 1];
    const monthlyPaymentRaw = repaymentMethod === 'equal_payment'
      ? calculateEqualPayment(principal, interestRate, totalMonths)
      : calculateEqualPrincipalPayment(principal, interestRate, totalMonths, 1);
    const monthlyPayment = Math.round(monthlyPaymentRaw);

    // 使用四捨五入後的月付金計算總還款，確保顯示數字一致（月付 × 期數 = 總還款）
    const actualMonths = schedule.length;
    const totalPayment = monthlyPayment * actualMonths;
    const totalInterest = totalPayment - principal;
    const actualYears = Math.ceil(actualMonths / 12);
    
    const interestRatio = totalPayment > 0 ? (totalInterest / totalPayment) * 100 : 0;

    // 實際年利率 (EAR - Effective Annual Rate)
    // 考慮月複利：EAR = (1 + 月利率)^12 - 1
    const monthlyRateDecimal = interestRate / 100 / 12;
    const effectiveRate = (Math.pow(1 + monthlyRateDecimal, 12) - 1) * 100;

    // 圖表數據 - 堆疊面積圖（與原版iPad一致）
    // 堆疊順序（從下到上）：餘額 → 已繳本金 → 累計利息
    const areaChartData = yearlySchedule.map((item, index) => {
      const cumulativeInterest = yearlySchedule.slice(0, index + 1).reduce((sum, y) => sum + y.totalInterest, 0);
      const cumulativePrincipal = principal - item.endBalance;
      return {
        year: item.year,
        interest: Math.round(cumulativeInterest / 10000),      // 累計利息
        principal: Math.round(cumulativePrincipal / 10000),    // 已繳本金
        balance: Math.round(item.endBalance / 10000),          // 餘額
      };
    });

    // 痛點對比
    const painPoints = [
      { icon: Car, label: 'Tesla Model 3', value: Math.floor(totalInterest / 1800000), unit: '台' },
      { icon: Plane, label: '日本來回機票', value: Math.floor(totalInterest / 15000), unit: '張' },
      { icon: Building2, label: '買房頭期款', value: (totalInterest / (principal * 0.2)).toFixed(1), unit: '份' },
      { icon: PiggyBank, label: '20年6%複利', value: Math.round(totalInterest * Math.pow(1.06, 20) / 10000), unit: '萬' },
    ];

    return {
      principal,
      monthlyPayment,
      totalPayment,
      totalInterest,
      interestRatio,
      effectiveRate,
      actualMonths,
      actualYears,
      schedule,
      yearlySchedule,
      areaChartData,
      painPoints,
    };
  }, [loanAmount, interestRate, loanTerm, repaymentMethod, extraMonthly]);

  const ratePresets = [
    { label: '青安', rate: 1.775 },
    { label: '一般', rate: 2.2 },
    { label: '信貸', rate: 5.0 },
  ];

  const termPresets = [20, 30, 40];

  // ============================================================
  // UI 渲染 - 橫式一頁佈局
  // ============================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-3 md:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header - 精簡 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Calculator className="text-blue-400" size={24} />
            </div>
            <div>
              <h1
                onClick={handleSecretClick}
                className="text-lg md:text-xl font-black tracking-tight cursor-default select-none"
              >
                智能房貸戰情室
              </h1>
              <h2 className="text-slate-500 text-xs hidden md:block">免費房貸計算機 - 精算每一分利息</h2>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded">
            Ultra Advisor
          </span>
        </div>

        {/* 主要內容 - 左右分欄 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* ===== 左側：輸入區 ===== */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-3">

            {/* 手機版：2x2 網格佈局 */}
            <div className="grid grid-cols-2 gap-2 lg:hidden">
              {/* 貸款金額 - 精簡版 */}
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Banknote size={10} /> 貸款
                  </span>
                  <span className="text-slate-500 text-[10px]">萬元</span>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full bg-transparent text-2xl font-black text-white text-right focus:outline-none border-b border-slate-600 focus:border-blue-500 pb-1"
                />
              </div>

              {/* 利率 - 精簡版 */}
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Percent size={10} /> 利率
                  </span>
                  <span className="text-slate-500 text-[10px]">%/年</span>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step={0.01}
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  className="w-full bg-transparent text-2xl font-black text-amber-400 text-right focus:outline-none border-b border-slate-600 focus:border-amber-500 pb-1"
                />
              </div>

              {/* 期限 - 精簡版 */}
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar size={10} /> 期限
                  </span>
                  <span className="text-slate-500 text-[10px]">年</span>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={loanTerm}
                  onChange={(e) => setLoanTerm(Number(e.target.value))}
                  className="w-full bg-transparent text-2xl font-black text-emerald-400 text-right focus:outline-none border-b border-slate-600 focus:border-emerald-500 pb-1"
                />
              </div>

              {/* 付款方式 - 精簡版 */}
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Settings size={10} /> 付款
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setRepaymentMethod('equal_payment')}
                    className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${
                      repaymentMethod === 'equal_payment'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    本息
                  </button>
                  <button
                    onClick={() => setRepaymentMethod('equal_principal')}
                    className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${
                      repaymentMethod === 'equal_principal'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    本金
                  </button>
                </div>
              </div>
            </div>

            {/* 手機版：快速選項列 */}
            <div className="lg:hidden">
              {/* 利率快捷 */}
              <div className="flex gap-1 mb-2">
                {ratePresets.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setInterestRate(p.rate)}
                    className={`flex-1 py-1 rounded text-[10px] font-medium transition-all ${
                      interestRate === p.rate
                        ? 'bg-amber-500/80 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {/* 期限快捷 */}
              <div className="flex gap-1">
                {termPresets.map((t) => (
                  <button
                    key={t}
                    onClick={() => setLoanTerm(t)}
                    className={`flex-1 py-1 rounded text-[10px] font-medium transition-all ${
                      loanTerm === t
                        ? 'bg-emerald-500/80 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {t}年
                  </button>
                ))}
              </div>
            </div>

            {/* 桌面版：原有完整佈局 */}
            <div className="hidden lg:block space-y-3">
              {/* 貸款金額 */}
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Banknote size={12} /> 貸款數額
                  </span>
                  <span className="text-slate-500 text-xs">萬元</span>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full bg-transparent text-3xl font-black text-white text-right focus:outline-none border-b-2 border-slate-600 focus:border-blue-500 pb-1 mb-2"
                />
                <input
                  type="range"
                  min={100}
                  max={5000}
                  step={50}
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* 利率 */}
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Percent size={12} /> 利率%
                  </span>
                  <span className="text-slate-500 text-xs">/ 年</span>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step={0.01}
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  className="w-full bg-transparent text-3xl font-black text-amber-400 text-right focus:outline-none border-b-2 border-slate-600 focus:border-amber-500 pb-1 mb-2"
                />
                <div className="flex gap-1 mb-2">
                  {ratePresets.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setInterestRate(p.rate)}
                      className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${
                        interestRate === p.rate
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      {p.label} {p.rate}%
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={8}
                  step={0.05}
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* 期限 */}
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar size={12} /> 期限
                  </span>
                  <span className="text-slate-500 text-xs">年度</span>
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  value={loanTerm}
                  onChange={(e) => setLoanTerm(Number(e.target.value))}
                  className="w-full bg-transparent text-3xl font-black text-emerald-400 text-right focus:outline-none border-b-2 border-slate-600 focus:border-emerald-500 pb-1 mb-2"
                />
                <div className="flex gap-1">
                  {termPresets.map((t) => (
                    <button
                      key={t}
                      onClick={() => setLoanTerm(t)}
                      className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${
                        loanTerm === t
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      {t}年
                    </button>
                  ))}
                </div>
              </div>

              {/* 還款方式 + 額外還款 */}
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Settings size={12} /> 付款</span>
                  <span>每月</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setRepaymentMethod('equal_payment')}
                    className={`py-2 rounded text-xs font-bold transition-all ${
                      repaymentMethod === 'equal_payment'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    本息均攤
                  </button>
                  <button
                    onClick={() => setRepaymentMethod('equal_principal')}
                    className={`py-2 rounded text-xs font-bold transition-all ${
                      repaymentMethod === 'equal_principal'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    本金均攤
                  </button>
                </div>

                {/* 額外付款 */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="flex items-center gap-1"><Zap size={12} /> 額外付款</span>
                    <span>每月</span>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={extraMonthly}
                    onChange={(e) => setExtraMonthly(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-slate-900/50 border border-slate-600 rounded px-3 py-2 text-right text-white text-sm focus:outline-none focus:border-yellow-500"
                  />
                </div>

                {extraMonthly > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-2 text-xs">
                    <p className="text-emerald-400">✓ 提前還款效益</p>
                    <p className="text-emerald-300 text-[10px] mt-1">
                      預計提早 {Math.floor((loanTerm * 12 - calculations.actualMonths) / 12)} 年還清
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 通貨膨脹率 */}
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <TrendingUp size={12} /> 通貨膨脹率%
                </span>
                <span className="text-slate-500 text-xs">年化</span>
              </div>
              <input
                type="number"
                inputMode="decimal"
                step={0.1}
                value={inflationRate}
                onChange={(e) => setInflationRate(Number(e.target.value))}
                className="w-full bg-transparent text-3xl font-black text-purple-400 text-right focus:outline-none border-b-2 border-slate-600 focus:border-purple-500 pb-1 mb-2"
              />
              <input
                type="range"
                min={0}
                max={5}
                step={0.1}
                value={inflationRate}
                onChange={(e) => setInflationRate(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full accent-purple-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500 mt-1 text-center">
                調整後可查看「通脹貼現」還款價值
              </p>
            </div>
          </div>

          {/* ===== 右側：結果區 ===== */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-4">
            
            {/* Tab 切換 + 結果卡片 */}
            <div className="flex flex-col md:flex-row gap-4">
              
              {/* Tab 按鈕 */}
              <div className="flex md:flex-col gap-2 md:w-24">
                <button
                  onClick={() => setActiveTab('table')}
                  className={`flex-1 md:flex-none px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm ${
                    activeTab === 'table'
                      ? 'bg-slate-700 text-white border-2 border-slate-500'
                      : 'bg-slate-800/50 text-slate-500 border border-slate-700 hover:bg-slate-700/50'
                  }`}
                >
                  <Table size={16} /> 表單
                </button>
                <button
                  onClick={() => setActiveTab('chart')}
                  className={`flex-1 md:flex-none px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm ${
                    activeTab === 'chart'
                      ? 'bg-slate-700 text-white border-2 border-slate-500'
                      : 'bg-slate-800/50 text-slate-500 border border-slate-700 hover:bg-slate-700/50'
                  }`}
                >
                  <BarChart3 size={16} /> 圖表
                </button>
              </div>

              {/* 數據展示區 */}
              <div className="flex-1 bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
                
                {/* 圖表 Tab - 純 SVG 實現 */}
                {activeTab === 'chart' && (
                  <div className="p-4">
                    {/* 圖例 */}
                    <div className="flex items-center justify-end gap-4 mb-3 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></span>
                        累計利息
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: '#86efac' }}></span>
                        繳納本金
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></span>
                        餘貸款額
                      </span>
                    </div>
                    
                    {/* SVG 面積圖 */}
                    <div className="relative bg-slate-900/30 rounded-lg border border-slate-700/50 overflow-hidden">
                      {/* 右側數值標籤 */}
                      <div className="absolute right-2 top-2 text-right text-[10px] space-y-1 z-10">
                        <p className="text-white font-bold">{formatMoneyFull(Math.round(calculations.totalPayment))}</p>
                        <p className="text-emerald-400">{formatMoneyFull(Math.round(calculations.principal))}</p>
                        <p className="text-emerald-600">{formatMoneyFull(Math.round(calculations.areaChartData[Math.floor(calculations.areaChartData.length/2)]?.balance * 10000 || 0))}</p>
                      </div>
                      
                      {/* 圖表區域 */}
                      <svg 
                        viewBox="0 0 800 320" 
                        className="w-full h-[280px] md:h-[320px]"
                        preserveAspectRatio="none"
                      >
                        {/* 背景網格 */}
                        <defs>
                          <linearGradient id="interestGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9"/>
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4"/>
                          </linearGradient>
                          <linearGradient id="principalGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#86efac" stopOpacity="0.9"/>
                            <stop offset="100%" stopColor="#86efac" stopOpacity="0.5"/>
                          </linearGradient>
                          <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.8"/>
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.3"/>
                          </linearGradient>
                        </defs>
                        
                        {/* 水平網格線 */}
                        {[0.25, 0.5, 0.75].map((ratio, i) => (
                          <line 
                            key={i}
                            x1="40" 
                            y1={300 * ratio} 
                            x2="780" 
                            y2={300 * ratio} 
                            stroke="#334155" 
                            strokeWidth="1" 
                            strokeDasharray="4,4"
                          />
                        ))}
                        
                        {/* 計算並繪製面積圖 */}
                        {(() => {
                          const data = calculations.areaChartData;
                          if (data.length === 0) return null;
                          
                          // 最大值 = 本金 + 總利息
                          const maxY = (calculations.principal + calculations.totalInterest) / 10000;
                          const chartWidth = 740;
                          const chartHeight = 300;
                          const offsetX = 40;
                          const offsetY = 10;
                          const stepX = chartWidth / Math.max(data.length - 1, 1);
                          
                          // 生成路徑點
                          const points = data.map((d, i) => ({
                            x: offsetX + i * stepX,
                            balance: chartHeight - (d.balance / maxY) * chartHeight + offsetY,
                            principal: chartHeight - ((d.balance + d.principal) / maxY) * chartHeight + offsetY,
                            interest: chartHeight - ((d.balance + d.principal + d.interest) / maxY) * chartHeight + offsetY,
                          }));
                          
                          // 餘額路徑（綠色，最底層）
                          const balancePath = `
                            M ${points[0].x} ${chartHeight + offsetY}
                            ${points.map(p => `L ${p.x} ${p.balance}`).join(' ')}
                            L ${points[points.length-1].x} ${chartHeight + offsetY}
                            Z
                          `;
                          
                          // 已繳本金路徑（淺綠色，中間層）
                          const principalPath = `
                            M ${points[0].x} ${points[0].balance}
                            ${points.map(p => `L ${p.x} ${p.principal}`).join(' ')}
                            ${[...points].reverse().map(p => `L ${p.x} ${p.balance}`).join(' ')}
                            Z
                          `;
                          
                          // 利息路徑（紅色，最上層）
                          const interestPath = `
                            M ${points[0].x} ${points[0].principal}
                            ${points.map(p => `L ${p.x} ${p.interest}`).join(' ')}
                            ${[...points].reverse().map(p => `L ${p.x} ${p.principal}`).join(' ')}
                            Z
                          `;
                          
                          return (
                            <g>
                              {/* 餘額 - 深綠色 */}
                              <path d={balancePath} fill="url(#balanceGrad)" />
                              
                              {/* 已繳本金 - 淺綠色 */}
                              <path d={principalPath} fill="url(#principalGrad)" />
                              
                              {/* 利息 - 紅色 */}
                              <path d={interestPath} fill="url(#interestGrad)" />
                              
                              {/* 邊界線 */}
                              <path 
                                d={`M ${points[0].x} ${points[0].interest} ${points.map(p => `L ${p.x} ${p.interest}`).join(' ')}`}
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="2"
                              />
                              <path 
                                d={`M ${points[0].x} ${points[0].principal} ${points.map(p => `L ${p.x} ${p.principal}`).join(' ')}`}
                                fill="none"
                                stroke="#86efac"
                                strokeWidth="1.5"
                              />
                              <path 
                                d={`M ${points[0].x} ${points[0].balance} ${points.map(p => `L ${p.x} ${p.balance}`).join(' ')}`}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="1.5"
                              />
                            </g>
                          );
                        })()}
                        
                        {/* X 軸 */}
                        <line x1="40" y1="310" x2="780" y2="310" stroke="#475569" strokeWidth="1" />
                        
                        {/* X 軸標籤 - 動態計算間距 */}
                        {(() => {
                          // 根據期限動態計算標籤間距
                          const step = loanTerm <= 20 ? 5 : loanTerm <= 30 ? 5 : 10;
                          const labels = [];
                          for (let y = 0; y <= loanTerm; y += step) {
                            labels.push(y);
                          }
                          // 確保最後一個標籤是期限年份
                          if (labels[labels.length - 1] !== loanTerm) {
                            labels.push(loanTerm);
                          }
                          return labels.map((year) => {
                            const x = 40 + (year / loanTerm) * 740;
                            return (
                              <text
                                key={year}
                                x={x}
                                y="325"
                                fill="#64748b"
                                fontSize="11"
                                textAnchor="middle"
                              >
                                {year}
                              </text>
                            );
                          });
                        })()}
                        
                        {/* 年標籤 */}
                        <text x="20" y="325" fill="#64748b" fontSize="11">年</text>
                      </svg>
                    </div>
                  </div>
                )}

                {/* 表單 Tab */}
                {activeTab === 'table' && (
                  <div className="p-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-700 text-xs">
                          <th className="text-center py-2 px-2 font-medium">年</th>
                          <th className="text-right py-2 px-3 font-medium">付款總計</th>
                          <th className="text-right py-2 px-3 font-medium">累計利息</th>
                          <th className="text-right py-2 px-3 font-medium">餘貸款額</th>
                          <th className="text-right py-2 px-3 font-medium">
                            <span className="text-purple-400">支付</span>
                            <br/>
                            <span className="text-[10px] text-slate-500">(通脹貼現)</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-xs">
                        {(showAllYears ? calculations.yearlySchedule : calculations.yearlySchedule.slice(0, 8)).map((item, idx) => {
                          const cumulativePaid = calculations.yearlySchedule.slice(0, idx + 1).reduce((sum, y) => sum + y.totalPayment, 0);
                          const cumulativeInterest = calculations.yearlySchedule.slice(0, idx + 1).reduce((sum, y) => sum + y.totalInterest, 0);
                          // 通脹貼現：將每年的付款分別折現到今日價值後加總
                          // 正確做法：第 n 年的付款除以 (1 + 通膨率)^n
                          const inflationAdjusted = inflationRate > 0
                            ? calculations.yearlySchedule.slice(0, idx + 1).reduce((sum, y) => {
                                return sum + y.totalPayment / Math.pow(1 + inflationRate / 100, y.year);
                              }, 0)
                            : cumulativePaid;

                          return (
                            <tr key={idx} className="border-b border-slate-800 hover:bg-slate-700/30">
                              <td className="py-2 px-2 text-center text-slate-400">{item.year}</td>
                              <td className="py-2 px-3 text-right text-white">{formatMoneyFull(Math.round(cumulativePaid))}</td>
                              <td className="py-2 px-3 text-right text-red-400">{formatMoneyFull(Math.round(cumulativeInterest))}</td>
                              <td className="py-2 px-3 text-right text-emerald-400">{formatMoneyFull(Math.round(item.endBalance))}</td>
                              <td className={`py-2 px-3 text-right ${inflationRate > 0 ? 'text-purple-400' : 'text-slate-500'}`}>
                                {formatMoneyFull(Math.round(inflationAdjusted))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!showAllYears && calculations.yearlySchedule.length > 8 && (
                      <button
                        onClick={() => setShowAllYears(true)}
                        className="w-full py-2 text-xs text-blue-400 hover:text-blue-300"
                      >
                        顯示全部 {calculations.yearlySchedule.length} 年 ↓
                      </button>
                    )}
                    {showAllYears && (
                      <button
                        onClick={() => setShowAllYears(false)}
                        className="w-full py-2 text-xs text-slate-500 hover:text-slate-400"
                      >
                        收合 ↑
                      </button>
                    )}
                    
                    {/* 通脹說明 */}
                    {inflationRate > 0 && (
                      <div className="mt-3 p-2 bg-purple-500/10 border border-purple-500/30 rounded text-[10px] text-purple-300">
                        💡 通脹貼現說明：以 {inflationRate}% 年通膨率計算，將未來付款換算成今日購買力價值
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 結果摘要卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-1">每月付款</p>
                <p className="text-2xl md:text-3xl font-black text-white font-mono">
                  {formatMoneyFull(Math.round(calculations.monthlyPayment))}
                </p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                <p className="text-xs text-slate-400 mb-1">付款總計</p>
                <p className="text-2xl md:text-3xl font-black text-white font-mono">
                  {formatMoneyFull(Math.round(calculations.totalPayment))}
                </p>
              </div>
              <div className="bg-red-900/30 rounded-xl p-4 border border-red-500/30">
                <p className="text-xs text-red-300 mb-1 flex items-center gap-1">
                  <AlertTriangle size={12} /> 累計利息
                </p>
                <p className="text-2xl md:text-3xl font-black text-red-400 font-mono">
                  {formatMoneyFull(Math.round(calculations.totalInterest))}
                </p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 relative">
                <div className="flex items-center gap-1 mb-1">
                  <p className="text-xs text-slate-400">實際年利率%</p>
                  <button
                    onClick={() => setShowRateExplain(true)}
                    className="text-slate-500 hover:text-amber-400 transition-colors"
                  >
                    <HelpCircle size={12} />
                  </button>
                </div>
                <p className="text-2xl md:text-3xl font-black text-amber-400 font-mono">
                  {calculations.effectiveRate.toFixed(2)}
                </p>

                {/* 實際利率說明彈窗 */}
                {showRateExplain && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 z-50">
                    <div className="bg-slate-900 border border-slate-600 rounded-xl p-3 shadow-xl text-xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-amber-400">什麼是實際年利率？</span>
                        <button
                          onClick={() => setShowRateExplain(false)}
                          className="text-slate-500 hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="space-y-2 text-slate-300">
                        <p>
                          <span className="text-white font-medium">名目利率</span>（你輸入的 {interestRate}%）是銀行公告的年利率。
                        </p>
                        <p>
                          <span className="text-amber-400 font-medium">實際年利率</span>（{calculations.effectiveRate.toFixed(2)}%）考慮了<span className="text-white">每月複利</span>的影響。
                        </p>
                        <div className="bg-slate-800 rounded p-2 mt-2">
                          <p className="text-[10px] text-slate-400 mb-1">計算公式：</p>
                          <p className="font-mono text-[11px]">EAR = (1 + {interestRate}%/12)¹² - 1</p>
                          <p className="font-mono text-[11px] text-amber-400">= {calculations.effectiveRate.toFixed(4)}%</p>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          💡 實際年利率會比名目利率略高，因為利息每月計入本金再生利息。
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 利息佔比條 */}
            <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
                <span>還款結構</span>
                <span>本金 {(100 - calculations.interestRatio).toFixed(0)}% / 利息 {calculations.interestRatio.toFixed(0)}%</span>
              </div>
              <div className="h-6 rounded-full overflow-hidden flex bg-slate-700">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center transition-all duration-500"
                  style={{ width: `${100 - calculations.interestRatio}%` }}
                >
                  {100 - calculations.interestRatio > 20 && (
                    <span className="text-[10px] font-bold text-white">本金</span>
                  )}
                </div>
                <div 
                  className="bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center transition-all duration-500"
                  style={{ width: `${calculations.interestRatio}%` }}
                >
                  {calculations.interestRatio > 15 && (
                    <span className="text-[10px] font-bold text-white">利息</span>
                  )}
                </div>
              </div>
            </div>

            {/* 痛點對比 - 橫排 */}
            <div className="bg-gradient-to-r from-red-900/20 to-slate-800/20 rounded-xl p-4 border border-red-500/20">
              <p className="text-xs text-red-300 mb-3 flex items-center gap-1">
                <AlertTriangle size={12} />
                {formatMoney(calculations.totalInterest)} 利息 = ?
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {calculations.painPoints.map((item, idx) => (
                  <div key={idx} className="bg-slate-900/50 rounded-lg p-3 text-center border border-slate-700/50 hover:border-red-500/50 transition-all">
                    <item.icon size={20} className="mx-auto mb-1 text-slate-400" />
                    <p className="text-xl font-black text-white">{item.value}</p>
                    <p className="text-[10px] text-slate-500">{item.unit} {item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI 智能分析 */}
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl border border-cyan-500/20 overflow-hidden">
              {!aiInsight && !aiLoading && (
                <button
                  onClick={handleAIAnalysis}
                  disabled={aiLoading}
                  className="w-full p-4 flex items-center justify-center gap-3 hover:bg-cyan-500/5 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Zap size={20} className="text-cyan-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-bold text-sm">AI 智能分析</p>
                    <p className="text-slate-500 text-xs">Gemini AI 為你解讀這筆房貸</p>
                  </div>
                  <span className="ml-auto text-cyan-400 text-xs font-mono bg-cyan-500/10 px-2 py-1 rounded-full">FREE</span>
                </button>
              )}

              {aiLoading && (
                <div className="p-6 text-center">
                  <div className="inline-flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-cyan-400 text-sm font-bold">AI 分析中...</span>
                  </div>
                  <p className="text-slate-600 text-xs mt-2">Gemini AI 正在分析你的房貸條件</p>
                </div>
              )}

              {aiError && (
                <div className="p-4">
                  <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
                    <AlertTriangle size={14} />
                    <span>{aiError}</span>
                  </div>
                  <button
                    onClick={handleAIAnalysis}
                    className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
                  >
                    點此重試
                  </button>
                </div>
              )}

              {aiInsight && (
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                      <Zap size={14} className="text-white" />
                    </div>
                    <span className="text-white font-bold text-sm">AI 分析報告</span>
                    <span className="text-[10px] text-slate-600 font-mono ml-auto">Powered by Gemini</span>
                  </div>
                  <div
                    className="prose prose-invert prose-sm max-w-none
                      [&_h3]:text-base [&_h3]:font-black [&_h3]:text-white [&_h3]:mt-4 [&_h3]:mb-2
                      [&_p]:text-slate-300 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-2
                      [&_strong]:text-cyan-400
                      [&_ul]:text-slate-300 [&_ul]:text-sm
                      [&_li]:mb-1"
                    dangerouslySetInnerHTML={{
                      __html: aiInsight
                        .replace(/### /g, '<h3>')
                        .replace(/\n(?=<h3>)/g, '</p>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br/>')
                    }}
                  />
                  <button
                    onClick={() => { setAiInsight(null); setAiError(null); }}
                    className="mt-4 text-xs text-slate-500 hover:text-cyan-400 transition-colors"
                  >
                    重新分析
                  </button>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
              <div>
                <p className="text-blue-100 text-sm">想使用更多專業理財工具？</p>
                <p className="text-white font-bold">免費註冊試用 7 天完整功能</p>
              </div>
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/register');
                  window.location.reload();
                }}
                className="w-full md:w-auto px-6 py-2.5 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-all text-sm text-center"
              >
                免費註冊試用
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-slate-600 py-3 mt-4">
          © 2026 Ultra Advisor | 本工具僅供參考，實際利率與還款金額以銀行核定為準
        </div>
      </div>

      {/* =========================================================================== */}
      {/* 隱藏業務小抄 */}
      {/* =========================================================================== */}
      {showCheatSheet && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCheatSheet(false)}
          />
          
          <div className="relative w-full max-w-sm bg-slate-900 text-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-3 flex justify-between items-center z-10">
              <div>
                <h3 className="font-bold flex items-center gap-2">📋 業務小抄</h3>
                <p className="text-[10px] text-slate-400">ESC 關閉</p>
              </div>
              <button onClick={() => setShowCheatSheet(false)} className="p-1.5 hover:bg-slate-700 rounded-lg">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-3 space-y-4 text-xs">
              
              <div>
                <h4 className="font-bold text-cyan-400 mb-2">📊 當前數據</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-800 p-2 rounded">
                    <span className="text-slate-500 text-[10px]">貸款</span>
                    <p className="font-bold">{loanAmount} 萬</p>
                  </div>
                  <div className="bg-slate-800 p-2 rounded">
                    <span className="text-slate-500 text-[10px]">利率/期限</span>
                    <p className="font-bold">{interestRate}% / {loanTerm}年</p>
                  </div>
                  <div className="bg-slate-800 p-2 rounded">
                    <span className="text-slate-500 text-[10px]">月付</span>
                    <p className="font-bold text-blue-400">${formatMoney(calculations.monthlyPayment)}</p>
                  </div>
                  <div className="bg-slate-800 p-2 rounded">
                    <span className="text-slate-500 text-[10px]">總利息</span>
                    <p className="font-bold text-red-400">${formatMoney(calculations.totalInterest)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-emerald-400 mb-2">🎬 開場</h4>
                <div className="bg-slate-800 p-2 rounded text-slate-300 text-[11px] leading-relaxed">
                  「您知道貸款 {loanAmount} 萬、{loanTerm} 年，要付多少利息嗎？答案是 <span className="text-red-400 font-bold">{formatMoney(calculations.totalInterest)}</span>。這筆錢可以買 {calculations.painPoints[0].value} 台特斯拉。」
                </div>
              </div>

              <div>
                <h4 className="font-bold text-red-400 mb-2">🔥 痛點</h4>
                <div className="bg-slate-800 p-2 rounded text-[11px] space-y-1 text-slate-300">
                  <p>「月付 ${formatMoney(calculations.monthlyPayment)} 看起來還好...」</p>
                  <p>「但 {loanTerm} 年下來，利息是 <span className="text-red-400 font-bold">${formatMoney(calculations.totalInterest)}</span>，佔 {calculations.interestRatio.toFixed(0)}%！」</p>
                  <p>「等於多送銀行 {Math.round(calculations.totalInterest / 10000)} 萬。」</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-amber-400 mb-2">💡 解方</h4>
                <div className="bg-slate-800 p-2 rounded text-[11px] space-y-2">
                  <p className="text-amber-300">① 每月多還 1 萬 → 省利息</p>
                  <p className="text-amber-300">② 選 20 年 → 月付高但省更多</p>
                  <p className="text-amber-300">③ 降息 0.5% → 30年省大錢</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-yellow-400 mb-2">✨ 收尾</h4>
                <div className="bg-yellow-900/20 p-2 rounded border border-yellow-700 text-center italic text-yellow-200 text-[11px]">
                  「房貸是最大負債，也最值得優化。」
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}