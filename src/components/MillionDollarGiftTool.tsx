import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Calculator,
  Gift,
  Repeat,
  TrendingUp,
  CheckCircle2,
  RefreshCw,
  PiggyBank,
  Coins,
  Settings,
  ChevronDown,
  ChevronUp,
  PieChart,
  Activity,
  Scale,
  RotateCcw,
  Sparkles,
  X,
  Lock,
  Crown
} from 'lucide-react';
import { useMembership } from '../hooks/useMembership';
import { useCheatSheetTrigger } from '../hooks/useCheatSheetTrigger';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import DisclaimerFooter from './DisclaimerFooter';
import ShareButton from './ShareButton';
import ShareToCustomerButton from './ShareToCustomerButton';
import { auth } from '../firebase';

// ============================================
// Helper Functions (Utils)
// ============================================

const calculateMonthlyPayment = (principal: number, rate: number, years: number): number => {
  const p = Number(principal) || 0;
  const rVal = Number(rate) || 0;
  const y = Number(years) || 0;
  const r = rVal / 100 / 12;
  const n = y * 12;
  if (rVal === 0) return (p * 10000) / (n || 1);
  const result = (p * 10000 * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return isNaN(result) ? 0 : result;
};

const calculateMonthlyIncome = (principal: number, rate: number): number => {
  const p = Number(principal) || 0;
  const r = Number(rate) || 0;
  return (p * 10000 * (r / 100)) / 12;
};

const formatCurrency = (value: number): string => {
  return Math.abs(value).toLocaleString();
};

const formatMoneyYuan = (value: number): string => {
  return `$${Math.abs(Math.round(value)).toLocaleString()}`;
};

// ============================================
// Sub-component: ResultCard
// ============================================

interface ResultCardProps {
  phase: 1 | 2 | 3;
  period: string;
  netOut: number;
  asset: number;
  totalOut: number;
  netProfitTotal?: number;
  isFinal?: boolean;
  loanTerm: number;
  isCompoundMode: boolean;
  loanAmount: number;
  rate: number;
}

const ResultCard: React.FC<ResultCardProps> = ({
  phase,
  period,
  netOut,
  asset,
  totalOut,
  netProfitTotal = 0,
  isFinal = false,
  loanTerm,
  isCompoundMode,
  loanAmount,
  rate
}) => {
  const colorConfig = {
    1: {
      bg: 'bg-gradient-to-br from-blue-50 to-sky-50',
      border: 'border-blue-200',
      accent: 'text-blue-600',
      badge: 'bg-blue-100 text-blue-700'
    },
    2: {
      bg: 'bg-gradient-to-br from-indigo-50 to-violet-50',
      border: 'border-indigo-200',
      accent: 'text-indigo-600',
      badge: 'bg-indigo-100 text-indigo-700'
    },
    3: {
      bg: 'bg-gradient-to-br from-purple-50 to-fuchsia-50',
      border: 'border-purple-200',
      accent: 'text-purple-600',
      badge: 'bg-purple-100 text-purple-700'
    }
  };

  const config = colorConfig[phase];
  const phaseLabels = { 1: '累積期', 2: '成長期', 3: '收穫期' };

  return (
    <div className={`p-6 rounded-2xl shadow-lg border ${config.border} ${config.bg} flex flex-col justify-between`}>
      <div>
        <div className="flex justify-between items-center mb-4 border-b border-gray-200/50 pb-3">
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-xl ${config.badge} flex items-center justify-center text-sm font-black`}>
              {String(phase).padStart(2, '0')}
            </span>
            <h3 className={`font-black text-lg ${config.accent}`}>{phaseLabels[phase]}</h3>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-white/60 px-2 py-1 rounded-lg">{period}</span>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600 font-medium">新增貸款 / 利率</span>
            <span className={`font-bold ${config.accent}`}>{loanAmount}萬 / {rate}%</span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600 font-medium">
              {isCompoundMode ? '每月全額負擔' : '每月實質淨負擔'}
            </span>
            <span className={`text-xl font-bold font-mono ${netOut > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
              {netOut > 0 ? '' : '+'}${formatCurrency(netOut)}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200/50">
            <span className="text-slate-600 font-medium">期末資產規模</span>
            <span className={`text-2xl font-black ${config.accent} font-mono`}>
              {formatCurrency(asset)} <span className="text-sm">萬</span>
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600 font-medium">本期實質總付出</span>
            <span className={`text-lg font-bold font-mono ${totalOut > 0 ? 'text-blue-500' : 'text-emerald-600'}`}>
              {totalOut > 0 ? '' : '+'}{formatCurrency(totalOut)} 萬
            </span>
          </div>
        </div>
      </div>

      {isFinal && (
        <div className="mt-4 pt-3 border-t-2 border-dashed border-purple-300">
          <div className="flex justify-between items-center">
            <span className="text-slate-700 font-bold flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              專案總淨獲利
            </span>
            <span className={`text-2xl font-black font-mono ${netProfitTotal > 0 ? 'text-emerald-600' : 'text-blue-500'}`}>
              {netProfitTotal > 0 ? '+' : ''}{formatCurrency(netProfitTotal)} 萬
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 text-right">({loanTerm * 3}年期末資產 - 累計實付成本)</p>
        </div>
      )}
    </div>
  );
};

// ============================================
// Custom Tooltip Component
// ============================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload) return null;

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-xl p-4 min-w-[200px]">
      <p className="font-bold text-slate-800 mb-3 pb-2 border-b border-slate-100">{label}</p>
      {payload.map((entry: any, index: number) => {
        const isProjectCost = entry.dataKey === '專案實付成本';
        const isNegative = isProjectCost && entry.value < 0;

        return (
          <div key={index} className="flex justify-between items-center py-1.5">
            <span className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: isNegative ? '#10b981' : entry.color }}
              />
              {isNegative ? '已淨回收' : entry.name}
            </span>
            <span
              className={`font-bold font-mono ${isNegative ? 'text-emerald-600' : 'text-slate-700'}`}
            >
              {isNegative ? '+' : ''}{formatCurrency(entry.value)} 萬
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// Main Component: MillionDollarGiftTool
// ============================================

const MillionDollarGiftTool = ({ data, setData, userId }: any) => {
  // 會員權限判斷
  const { membership, loading: membershipLoading } = useMembership(userId || null);
  // 付費會員判斷：載入中時預設為 true（避免閃爍鎖定畫面），載入完成後使用實際值
  const isPaidMember = membershipLoading ? true : (membership?.isPaid || false);

  // State Management
  // 注意：cycle2/3 的值只有在用戶明確設定時才會有值，否則為 undefined（表示同步第一階段）
  // 0、null、undefined 都視為「同步中」
  const parseCycleValue = (val: any): number | undefined => {
    if (val === undefined || val === null || val === 0 || val === '') return undefined;
    return Number(val);
  };

  const safeData = {
    loanAmount: Number(data?.loanAmount) || 100,
    loanTerm: Number(data?.loanTerm) || 7,
    loanRate: Number(data?.loanRate) || 2.8,
    investReturnRate: Number(data?.investReturnRate) || 6,
    cycle2Loan: parseCycleValue(data?.cycle2Loan),
    cycle2Rate: parseCycleValue(data?.cycle2Rate),
    cycle3Loan: parseCycleValue(data?.cycle3Loan),
    cycle3Rate: parseCycleValue(data?.cycle3Rate),
  };

  const { loanAmount, loanTerm, loanRate, investReturnRate } = safeData;

  const c2Loan = safeData.cycle2Loan ?? loanAmount;
  const c2Rate = safeData.cycle2Rate ?? loanRate;
  const c3Loan = safeData.cycle3Loan ?? loanAmount;
  const c3Rate = safeData.cycle3Rate ?? loanRate;

  const [isCompoundMode, setIsCompoundMode] = useState(data?.isCompoundMode || false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // --- 暫存輸入狀態（允許用戶自由輸入，onBlur 時驗證）---
  const [tempLoanAmount, setTempLoanAmount] = useState<string | number>(loanAmount);
  const [tempLoanRate, setTempLoanRate] = useState<string | number>(loanRate);
  const [tempInvestReturnRate, setTempInvestReturnRate] = useState<string | number>(investReturnRate);
  const [tempC2Loan, setTempC2Loan] = useState<string | number>(c2Loan);
  const [tempC2Rate, setTempC2Rate] = useState<string | number>(c2Rate);
  const [tempC3Loan, setTempC3Loan] = useState<string | number>(c3Loan);
  const [tempC3Rate, setTempC3Rate] = useState<string | number>(c3Rate);
  const [tempLoanTerm, setTempLoanTerm] = useState<string | number>(loanTerm);

  const {
    clickHandler: handleSecretClick,
    isOpen: showCheatSheet,
    close: closeCheatSheet,
  } = useCheatSheetTrigger();

  // 同步外部資料變化
  useEffect(() => { setTempLoanAmount(loanAmount); }, [loanAmount]);
  useEffect(() => { setTempLoanRate(loanRate); }, [loanRate]);
  useEffect(() => { setTempInvestReturnRate(investReturnRate); }, [investReturnRate]);
  useEffect(() => { setTempLoanTerm(loanTerm); }, [loanTerm]);

  // 第二三階段同步邏輯：當 cycle2/3 值為 undefined 時，跟隨第一階段
  // 只有用戶手動調整後（值不為 undefined）才會停止同步
  useEffect(() => {
    if (safeData.cycle2Loan === undefined) {
      setTempC2Loan(loanAmount);
    }
  }, [loanAmount, safeData.cycle2Loan]);

  useEffect(() => {
    if (safeData.cycle2Rate === undefined) {
      setTempC2Rate(loanRate);
    }
  }, [loanRate, safeData.cycle2Rate]);

  useEffect(() => {
    if (safeData.cycle3Loan === undefined) {
      setTempC3Loan(loanAmount);
    }
  }, [loanAmount, safeData.cycle3Loan]);

  useEffect(() => {
    if (safeData.cycle3Rate === undefined) {
      setTempC3Rate(loanRate);
    }
  }, [loanRate, safeData.cycle3Rate]);

  // 當用戶明確設定 cycle2/3 值後，同步 temp 狀態
  useEffect(() => {
    if (safeData.cycle2Loan !== undefined) {
      setTempC2Loan(safeData.cycle2Loan);
    }
  }, [safeData.cycle2Loan]);

  useEffect(() => {
    if (safeData.cycle2Rate !== undefined) {
      setTempC2Rate(safeData.cycle2Rate);
    }
  }, [safeData.cycle2Rate]);

  useEffect(() => {
    if (safeData.cycle3Loan !== undefined) {
      setTempC3Loan(safeData.cycle3Loan);
    }
  }, [safeData.cycle3Loan]);

  useEffect(() => {
    if (safeData.cycle3Rate !== undefined) {
      setTempC3Rate(safeData.cycle3Rate);
    }
  }, [safeData.cycle3Rate]);

  useEffect(() => {
    setData({ ...safeData, isCompoundMode });
  }, [isCompoundMode]);

  // ============================================
  // Calculation Logic (Pre-calculation for UI)
  // ============================================

  const payment1 = calculateMonthlyPayment(loanAmount, loanRate, loanTerm);
  const payment2 = calculateMonthlyPayment(c2Loan, c2Rate, loanTerm);
  const payment3 = calculateMonthlyPayment(c3Loan, c3Rate, loanTerm);

  const income1 = calculateMonthlyIncome(loanAmount, investReturnRate);
  const income2 = calculateMonthlyIncome(c2Loan, investReturnRate);
  const income3 = calculateMonthlyIncome(c3Loan, investReturnRate);

  const monthlyRate = investReturnRate / 100 / 12;
  const totalMonthsPerCycle = loanTerm * 12;
  const compoundFactor = Math.pow(1 + monthlyRate, totalMonthsPerCycle);

  // 使用原始數值計算 (元為單位)
  let phase1_Asset_Raw: number, phase2_Asset_Raw: number, phase3_Asset_Raw: number;
  let phase1_NetOut: number, phase2_NetOut: number, phase3_NetOut: number;

  if (isCompoundMode) {
    phase1_NetOut = payment1;
    phase2_NetOut = payment2;
    phase3_NetOut = payment3;

    phase1_Asset_Raw = loanAmount * 10000 * compoundFactor;
    phase2_Asset_Raw = (phase1_Asset_Raw + c2Loan * 10000) * compoundFactor;
    phase3_Asset_Raw = (phase2_Asset_Raw + c3Loan * 10000) * compoundFactor;
  } else {
    phase1_Asset_Raw = loanAmount * 10000;
    phase2_Asset_Raw = (loanAmount + c2Loan) * 10000;
    phase3_Asset_Raw = (loanAmount + c2Loan + c3Loan) * 10000;

    phase1_NetOut = payment1 - income1;
    phase2_NetOut = payment2 - (income1 + income2);
    phase3_NetOut = payment3 - (income1 + income2 + income3);
  }

  const phase1_Asset = Math.round(phase1_Asset_Raw / 10000);
  const phase2_Asset = Math.round(phase2_Asset_Raw / 10000);
  const phase3_Asset = Math.round(phase3_Asset_Raw / 10000);

  const monthsPerCycle = loanTerm * 12;
  const totalCashOut_T0_T7_Raw = phase1_NetOut * monthsPerCycle;
  const totalCashOut_T0_T7_Wan = Math.round(totalCashOut_T0_T7_Raw / 10000);
  const totalCashOut_T7_T14_Raw = phase2_NetOut * monthsPerCycle;
  const totalCashOut_T7_T14_Wan = Math.round(totalCashOut_T7_T14_Raw / 10000);
  const totalCashOut_T14_T21_Raw = phase3_NetOut * monthsPerCycle;
  const totalCashOut_T14_T21_Wan = Math.round(totalCashOut_T14_T21_Raw / 10000);

  const totalProjectCost_Wan = totalCashOut_T0_T7_Wan + totalCashOut_T7_T14_Wan + totalCashOut_T14_T21_Wan;
  const finalAssetValue_Wan = phase3_Asset;
  const netProfit_Wan = finalAssetValue_Wan - totalProjectCost_Wan;
  const standardCost_Wan = finalAssetValue_Wan;
  const savedAmount_Wan = standardCost_Wan - totalProjectCost_Wan;

  const totalYears = loanTerm * 3;
  const monthlyStandardSaving = Math.round((finalAssetValue_Wan * 10000) / (totalYears * 12));
  const monthlyProjectCost = Math.round((totalProjectCost_Wan * 10000) / (totalYears * 12));

  const totalInterest1 = (payment1 * loanTerm * 12) - (loanAmount * 10000);
  const totalInterest2 = (payment2 * loanTerm * 12) - (c2Loan * 10000);
  const totalInterest3 = (payment3 * loanTerm * 12) - (c3Loan * 10000);
  const totalInterestRaw = totalInterest1 + totalInterest2 + totalInterest3;
  const totalInterestWan = Math.round(totalInterestRaw / 10000);

  const avgMonthlyNetPay = Math.round((phase1_NetOut + phase2_NetOut + phase3_NetOut) / 3);
  const assetMultiplier = totalProjectCost_Wan > 0
    ? (finalAssetValue_Wan / totalProjectCost_Wan).toFixed(1)
    : "∞";

  const efficiencyMultiplier = standardCost_Wan > 0 && totalProjectCost_Wan > 0
    ? (standardCost_Wan / totalProjectCost_Wan).toFixed(1)
    : "∞";

  const totalBarValue = Math.abs(totalInterestWan) + Math.abs(netProfit_Wan);
  const interestPercent = totalBarValue > 0 ? (Math.abs(totalInterestWan) / totalBarValue) * 100 : 0;
  const profitPercent = totalBarValue > 0 ? (Math.abs(netProfit_Wan) / totalBarValue) * 100 : 0;

  // 收益差額計算
  const rateSpread = investReturnRate - loanRate;
  const isPositiveSpread = rateSpread > 0;

  // ============================================
  // generateChartData - 修復版本 (全流程原始數值)
  // ============================================

  const generateChartData = () => {
    const dataArr = [];
    let cumulativeStandard_Raw = 0;
    let cumulativeProjectCost_Raw = 0;
    const standardMonthlySaving_Raw = (finalAssetValue_Wan * 10000) / (totalYears * 12);

    let currentAssetValue_Raw = 0;

    for (let year = 1; year <= totalYears; year++) {
      cumulativeStandard_Raw += standardMonthlySaving_Raw * 12;
      let currentPhaseNetOut: number;

      if (year <= loanTerm) {
        currentPhaseNetOut = phase1_NetOut;
        if (isCompoundMode) {
          currentAssetValue_Raw = (loanAmount * 10000) * Math.pow(1 + monthlyRate, year * 12);
        } else {
          currentAssetValue_Raw = loanAmount * 10000;
        }
      } else if (year <= loanTerm * 2) {
        currentPhaseNetOut = phase2_NetOut;
        if (isCompoundMode) {
          const yearsInPhase2 = year - loanTerm;
          const phase1EndAsset_Raw = (loanAmount * 10000) * compoundFactor;
          const startPrincipalP2_Raw = phase1EndAsset_Raw + (c2Loan * 10000);
          currentAssetValue_Raw = startPrincipalP2_Raw * Math.pow(1 + monthlyRate, yearsInPhase2 * 12);
        } else {
          currentAssetValue_Raw = (loanAmount + c2Loan) * 10000;
        }
      } else {
        currentPhaseNetOut = phase3_NetOut;
        if (isCompoundMode) {
          const yearsInPhase3 = year - loanTerm * 2;
          const phase1EndAsset_Raw = (loanAmount * 10000) * compoundFactor;
          const phase2EndAsset_Raw = (phase1EndAsset_Raw + c2Loan * 10000) * compoundFactor;
          const startPrincipalP3_Raw = phase2EndAsset_Raw + (c3Loan * 10000);
          currentAssetValue_Raw = startPrincipalP3_Raw * Math.pow(1 + monthlyRate, yearsInPhase3 * 12);
        } else {
          currentAssetValue_Raw = (loanAmount + c2Loan + c3Loan) * 10000;
        }
      }

      cumulativeProjectCost_Raw += currentPhaseNetOut * 12;

      dataArr.push({
        year: `第${year}年`,
        一般存錢累積: Math.round(cumulativeStandard_Raw / 10000),
        專案實付成本: Math.round(cumulativeProjectCost_Raw / 10000),
        專案持有資產: Math.round(currentAssetValue_Raw / 10000),
      });
    }
    return dataArr;
  };

  // ============================================
  // Handlers
  // ============================================

  const updateField = (field: string, value: number) => {
    if (field === 'investReturnRate' || field.includes('Rate')) {
      setData({ ...safeData, [field]: Number(value.toFixed(1)) });
    } else {
      if (field.includes('Amount') || field.includes('Loan')) {
        const clampedValue = Math.max(10, Math.min(1000, Number(value)));
        setData({ ...safeData, [field]: Math.round(clampedValue) });
        if (field === 'loanAmount') {
          setTempLoanAmount(Math.round(clampedValue));
        }
      } else {
        setData({ ...safeData, [field]: Number(value) });
      }
    }
  };

  // --- Finalize 函數（onBlur 時驗證並儲存）---
  const finalizeAmount = () => {
    let val = Number(tempLoanAmount) || 100;
    val = Math.max(10, Math.min(1000, val));
    setTempLoanAmount(val);
    setData({ ...safeData, loanAmount: val });
  };

  const finalizeLoanRate = () => {
    let val = Number(tempLoanRate) || 2.8;
    val = Math.max(1.5, Math.min(10, val));
    val = Math.round(val * 10) / 10;
    setTempLoanRate(val);
    setData({ ...safeData, loanRate: val });
  };

  const finalizeInvestReturnRate = () => {
    let val = Number(tempInvestReturnRate) || 6;
    val = Math.max(3, Math.min(12, val));
    val = Math.round(val * 10) / 10;
    setTempInvestReturnRate(val);
    setData({ ...safeData, investReturnRate: val });
  };

  const finalizeLoanTerm = () => {
    let val = Number(tempLoanTerm) || 7;
    val = Math.max(5, Math.min(10, val));
    setTempLoanTerm(val);
    setData({ ...safeData, loanTerm: val });
  };

  const finalizeC2Loan = () => {
    let val = Number(tempC2Loan) || loanAmount;
    val = Math.max(10, Math.min(1000, val));
    setTempC2Loan(val);
    // 只有當用戶輸入的值與第一階段不同時才取消同步
    // 若值相同且原本是同步狀態，保持同步
    if (val !== loanAmount || safeData.cycle2Loan !== undefined) {
      setData({ ...safeData, cycle2Loan: val });
    }
  };

  const finalizeC2Rate = () => {
    let val = Number(tempC2Rate) || loanRate;
    val = Math.max(1.5, Math.min(10, val));
    val = Math.round(val * 10) / 10;
    setTempC2Rate(val);
    // 只有當用戶輸入的值與第一階段不同時才取消同步
    if (val !== loanRate || safeData.cycle2Rate !== undefined) {
      setData({ ...safeData, cycle2Rate: val });
    }
  };

  const finalizeC3Loan = () => {
    let val = Number(tempC3Loan) || loanAmount;
    val = Math.max(10, Math.min(1000, val));
    setTempC3Loan(val);
    // 只有當用戶輸入的值與第一階段不同時才取消同步
    if (val !== loanAmount || safeData.cycle3Loan !== undefined) {
      setData({ ...safeData, cycle3Loan: val });
    }
  };

  const finalizeC3Rate = () => {
    let val = Number(tempC3Rate) || loanRate;
    val = Math.max(1.5, Math.min(10, val));
    val = Math.round(val * 10) / 10;
    setTempC3Rate(val);
    // 只有當用戶輸入的值與第一階段不同時才取消同步
    if (val !== loanRate || safeData.cycle3Rate !== undefined) {
      setData({ ...safeData, cycle3Rate: val });
    }
  };

  const handleKeyDown = (finalizer: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      finalizer();
      e.currentTarget.blur();
    }
  };

  // 處理輸入值，移除前導零（手機版相容）
  const sanitizeInput = (val: string): string => {
    if (val === '') return '';
    return val.replace(/^0+(?=\d)/, '');
  };

  const handleSyncToFirstCycle = () => {
    setData({
      ...safeData,
      cycle2Loan: undefined,
      cycle2Rate: undefined,
      cycle3Loan: undefined,
      cycle3Rate: undefined,
    });
  };

  const chartData = generateChartData();
  const hasNegativeCost = chartData.some(d => d.專案實付成本 < 0);

  // ============================================
  // Render
  // ============================================

  return (
    <div className="space-y-8 animate-fade-in font-sans text-slate-800">

      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden print-break-inside">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <Gift size={180} />
        </div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase backdrop-blur-sm">
                  Asset Accumulation
                </span>
                <span
                  onClick={handleSecretClick}
                  className="bg-yellow-400/20 text-yellow-100 px-3 py-1 rounded-full text-xs font-bold tracking-wider backdrop-blur-sm border border-yellow-400/30 cursor-default select-none"
                >
                  循環理財・資產倍增
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold mb-2 tracking-tight flex items-center gap-3">
                百萬禮物專案
              </h1>
              <p className="text-indigo-100 text-lg opacity-90 max-w-2xl">
                透過三次循環操作，用時間換取資產。送給未來的自己，或是孩子最棒的成年禮。
              </p>
            </div>

            {/* Toggle Switch */}
            <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-xl border border-white/20 flex gap-1 self-start md:self-center">
              <button
                onClick={() => setIsCompoundMode(false)}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${!isCompoundMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-indigo-100 hover:bg-white/10'}`}
              >
                <Coins size={16}/> 現金流模式
              </button>
              <button
                onClick={() => setIsCompoundMode(true)}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${isCompoundMode ? 'bg-white text-purple-600 shadow-sm' : 'text-purple-100 hover:bg-white/10'}`}
              >
                <RefreshCw size={16}/> 複利模式
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards - 強化說服力版本 */}
      <div className="grid md:grid-cols-3 gap-6 print-break-inside">

        {/* 卡片 1: 一般存錢成本 - 冷色調強調沉重感 */}
        <div className="bg-gradient-to-br from-slate-100 to-gray-100 rounded-2xl p-6 shadow-sm border border-slate-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <PiggyBank size={80} className="text-slate-600"/>
          </div>
          <div className="absolute top-3 right-3">
            <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full">
              傳統方式
            </span>
          </div>
          <h3 className="text-slate-500 text-sm font-bold mb-1">一般存錢需準備</h3>
          <div className="text-xs text-slate-400 mb-4">目標資產：{finalAssetValue_Wan.toLocaleString()} 萬</div>
          <p className="text-3xl font-black text-slate-600 font-mono">
            ${formatCurrency(standardCost_Wan)} <span className="text-lg text-slate-400">萬</span>
          </p>
          <div className="mt-4 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 bg-slate-200/80 px-2 py-1 rounded font-medium">
                全額自付本金
              </span>
              <span className="text-sm font-bold text-slate-500">
                月存 ${formatCurrency(monthlyStandardSaving)}
              </span>
            </div>
          </div>
        </div>

        {/* 卡片 2: 專案成本 - 強調效益 */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 shadow-sm border border-blue-200 relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Wallet size={80} className="text-blue-600"/>
          </div>
          <div className="absolute top-3 right-3">
            <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-2 py-1 rounded-full">
              專案策略
            </span>
          </div>
          <h3 className="text-blue-600 text-sm font-bold mb-1">百萬禮物專案實付</h3>
          <div className="text-xs text-blue-400 mb-4">累積 {loanTerm * 3} 年總支出</div>
          <p className={`text-3xl font-black font-mono ${totalProjectCost_Wan >= 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
            {totalProjectCost_Wan >= 0 ? '$' : '+$'}{formatCurrency(totalProjectCost_Wan)} <span className="text-lg text-blue-400">萬</span>
          </p>
          <div className="mt-4 pt-3 border-t border-blue-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded font-medium">
                靈活資金運用
              </span>
              <span className={`text-sm font-bold ${monthlyProjectCost >= 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                {monthlyProjectCost >= 0 ? '每月只需' : '月收'} ${formatCurrency(monthlyProjectCost)}
              </span>
            </div>
          </div>
        </div>

        {/* 卡片 3: 創造價值 - 視覺焦點，強烈綠色 */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 shadow-lg border border-emerald-400 relative overflow-hidden transform hover:scale-[1.02] transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <TrendingUp size={80} className="text-white"/>
          </div>
          <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />

          <div className="absolute top-3 right-3">
            <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm">
              專案優勢
            </span>
          </div>

          <h3 className="text-emerald-100 text-sm font-bold mb-1">專案為您創造價值</h3>
          <div className="text-xs text-emerald-200/80 mb-3">相比一般存錢省下</div>

          <p className="text-4xl md:text-5xl font-black text-white font-mono drop-shadow-lg">
            +${formatCurrency(savedAmount_Wan)} <span className="text-xl text-emerald-100">萬</span>
          </p>

          <div className="mt-4 pt-3 border-t border-white/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-yellow-300" />
                <span className="text-xs text-white font-bold">
                  資金效率提升
                </span>
              </div>
              <span className="text-lg font-black text-white bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                {efficiencyMultiplier}x
              </span>
            </div>
          </div>
        </div>
      </div>


      <div className="grid lg:grid-cols-12 gap-8">
        {/* 左側：參數設定與摘要 */}
        <div className="lg:col-span-4 space-y-6 print-break-inside">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 no-print">
            <h4 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
              <Calculator size={20} className="text-indigo-600"/>
              參數設定
            </h4>
            <div className="space-y-6">

              {/* 基礎設定 */}
              <div className="pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</span>
                  <span className="text-sm font-bold text-slate-700">第一循環 (基礎設定)</span>
                </div>

                {/* 金額輸入 */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-medium text-slate-600">單次借貸額度 (萬)</label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={tempLoanAmount}
                        onChange={(e) => setTempLoanAmount(sanitizeInput(e.target.value))}
                        onBlur={finalizeAmount}
                        onKeyDown={handleKeyDown(finalizeAmount)}
                        className="w-16 text-right bg-transparent border-none p-0 font-mono font-bold text-blue-600 text-lg focus:ring-0 focus:border-blue-500 focus:bg-blue-50/50 rounded"
                      />
                      <span className="font-mono font-bold text-blue-600 text-lg ml-1">萬</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={500}
                    step={1}
                    value={loanAmount}
                    onChange={(e) => updateField('loanAmount', Number(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* 利率 */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-medium text-slate-600">信貸利率 (%)</label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        inputMode="decimal"
                        step={0.1}
                        value={tempLoanRate}
                        onChange={(e) => setTempLoanRate(sanitizeInput(e.target.value))}
                        onBlur={finalizeLoanRate}
                        onKeyDown={handleKeyDown(finalizeLoanRate)}
                        className="w-14 text-right bg-transparent border-none p-0 font-mono font-bold text-indigo-600 text-lg focus:ring-0 focus:bg-indigo-50/50 rounded"
                      />
                      <span className="font-mono font-bold text-indigo-600 text-lg ml-0.5">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={1.5}
                    max={10.0}
                    step={0.1}
                    value={loanRate}
                    onChange={(e) => updateField('loanRate', Number(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>

              {/* 投資報酬率 */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-slate-600">投資年化報酬 (%)</label>
                  <div className="flex items-center">
                    <input
                      type="number"
                      inputMode="decimal"
                      step={0.1}
                      value={tempInvestReturnRate}
                      onChange={(e) => setTempInvestReturnRate(sanitizeInput(e.target.value))}
                      onBlur={finalizeInvestReturnRate}
                      onKeyDown={handleKeyDown(finalizeInvestReturnRate)}
                      className="w-14 text-right bg-transparent border-none p-0 font-mono font-bold text-purple-600 text-lg focus:ring-0 focus:bg-purple-50/50 rounded"
                    />
                    <span className="font-mono font-bold text-purple-600 text-lg ml-0.5">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={3}
                  max={12}
                  step={0.1}
                  value={investReturnRate}
                  onChange={(e) => updateField('investReturnRate', Number(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
              </div>

              {/* 進階設定按鈕 */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                  showAdvanced
                    ? 'bg-slate-50 border-slate-300 text-slate-800'
                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Settings size={16} />
                  進階設定 (後續循環參數)
                </div>
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {/* 進階設定面板 */}
              {showAdvanced && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300 pt-2">

                  {/* 同步重置按鈕 */}
                  <button
                    onClick={handleSyncToFirstCycle}
                    className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm font-bold hover:bg-blue-100 transition-all"
                  >
                    <RotateCcw size={14} />
                    同步第一循環設定
                  </button>

                  {/* 第二循環 */}
                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">2</span>
                      <span className="text-sm font-bold text-indigo-900">第二循環參數</span>
                      {safeData.cycle2Loan === undefined && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-500 px-1.5 py-0.5 rounded">同步中</span>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                          <span>貸款金額</span>
                          <div className="flex items-center">
                            <input
                              type="number"
                              inputMode="decimal"
                              value={tempC2Loan}
                              onChange={(e) => setTempC2Loan(sanitizeInput(e.target.value))}
                              onBlur={finalizeC2Loan}
                              onKeyDown={handleKeyDown(finalizeC2Loan)}
                              className="w-14 text-right bg-transparent border-none p-0 font-mono font-bold text-indigo-700 focus:ring-0 focus:bg-indigo-100 rounded"
                            />
                            <span className="font-bold text-indigo-700 ml-0.5">萬</span>
                          </div>
                        </div>
                        <input
                          type="range" min={10} max={500} step={1}
                          value={c2Loan}
                          onChange={(e) => updateField('cycle2Loan', Number(e.target.value))}
                          className="w-full h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                          <span>貸款利率</span>
                          <div className="flex items-center">
                            <input
                              type="number"
                              inputMode="decimal"
                              step={0.1}
                              value={tempC2Rate}
                              onChange={(e) => setTempC2Rate(sanitizeInput(e.target.value))}
                              onBlur={finalizeC2Rate}
                              onKeyDown={handleKeyDown(finalizeC2Rate)}
                              className="w-12 text-right bg-transparent border-none p-0 font-mono font-bold text-indigo-700 focus:ring-0 focus:bg-indigo-100 rounded"
                            />
                            <span className="font-bold text-indigo-700 ml-0.5">%</span>
                          </div>
                        </div>
                        <input
                          type="range" min={1.5} max={10} step={0.1}
                          value={c2Rate}
                          onChange={(e) => updateField('cycle2Rate', Number(e.target.value))}
                          className="w-full h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 第三循環 */}
                  <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">3</span>
                      <span className="text-sm font-bold text-purple-900">第三循環參數</span>
                      {safeData.cycle3Loan === undefined && (
                        <span className="text-[10px] bg-purple-100 text-purple-500 px-1.5 py-0.5 rounded">同步中</span>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                          <span>貸款金額</span>
                          <div className="flex items-center">
                            <input
                              type="number"
                              inputMode="decimal"
                              value={tempC3Loan}
                              onChange={(e) => setTempC3Loan(sanitizeInput(e.target.value))}
                              onBlur={finalizeC3Loan}
                              onKeyDown={handleKeyDown(finalizeC3Loan)}
                              className="w-14 text-right bg-transparent border-none p-0 font-mono font-bold text-purple-700 focus:ring-0 focus:bg-purple-100 rounded"
                            />
                            <span className="font-bold text-purple-700 ml-0.5">萬</span>
                          </div>
                        </div>
                        <input
                          type="range" min={10} max={500} step={1}
                          value={c3Loan}
                          onChange={(e) => updateField('cycle3Loan', Number(e.target.value))}
                          className="w-full h-1.5 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                          <span>貸款利率</span>
                          <div className="flex items-center">
                            <input
                              type="number"
                              inputMode="decimal"
                              step={0.1}
                              value={tempC3Rate}
                              onChange={(e) => setTempC3Rate(sanitizeInput(e.target.value))}
                              onBlur={finalizeC3Rate}
                              onKeyDown={handleKeyDown(finalizeC3Rate)}
                              className="w-12 text-right bg-transparent border-none p-0 font-mono font-bold text-purple-700 focus:ring-0 focus:bg-purple-100 rounded"
                            />
                            <span className="font-bold text-purple-700 ml-0.5">%</span>
                          </div>
                        </div>
                        <input
                          type="range" min={1.5} max={10} step={0.1}
                          value={c3Rate}
                          onChange={(e) => updateField('cycle3Rate', Number(e.target.value))}
                          className="w-full h-1.5 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              )}

            </div>

            <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500 mb-1">最終資產目標</div>
                <div className="text-lg font-bold text-indigo-600">{formatCurrency(finalAssetValue_Wan)} 萬</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">專案總時程</div>
                <div className="text-lg font-bold text-slate-700">{loanTerm * 3} 年</div>
              </div>
            </div>
          </div>
        </div>

        {/* 右側：圖表展示與財務分析 */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[400px] print-break-inside relative">
            <div className="flex justify-between items-center mb-4 pl-2 border-l-4 border-indigo-500">
              <h4 className="font-bold text-slate-700">資產累積三階段 ({loanTerm * 3}年趨勢)</h4>
              <div className="flex gap-2">
                {showAdvanced && (
                  <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                    已啟用進階設定
                  </span>
                )}
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                  模式：{isCompoundMode ? '複利滾存' : '現金流領息'}
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="90%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorAssetGift" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <YAxis
                  unit="萬"
                  tick={{fontSize: 12, fill: '#64748b'}}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                />
                {hasNegativeCost && <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: '正現金流門檻', fill: '#94a3b8', fontSize: 10 }} />}
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" />
                <Area type="monotone" dataKey="專案持有資產" stroke="#6366f1" fill="url(#colorAssetGift)" strokeWidth={3} />
                <Bar dataKey="一般存錢累積" fill="#cbd5e1" barSize={12} radius={[4,4,0,0]} />
                <Line type="monotone" dataKey="專案實付成本" stroke="#3b82f6" strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 財務結構分析面板 */}
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">

              {/* 左塊：利息與獲利進度條 */}
              <div className="flex-1 w-full">
                <h5 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                  <PieChart size={16} className="text-slate-500" />
                  總利息 vs 總獲利結構
                </h5>

                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-blue-600 font-bold">總利息成本: {formatCurrency(totalInterestWan)} 萬</span>
                  <span className={`font-bold ${netProfit_Wan >= 0 ? 'text-emerald-600' : 'text-blue-500'}`}>
                    淨獲利: {netProfit_Wan >= 0 ? '+' : ''}{formatCurrency(netProfit_Wan)} 萬
                  </span>
                </div>

                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-blue-400"
                    style={{ width: `${interestPercent}%` }}
                  />
                  <div
                    className={`h-full ${netProfit_Wan >= 0 ? 'bg-emerald-500' : 'bg-blue-300'}`}
                    style={{ width: `${profitPercent}%` }}
                  />
                </div>

                <div className="mt-2 text-xs text-slate-400 flex justify-between">
                  <span>付出 {Math.round(interestPercent)}% 成本</span>
                  <span>換取 {Math.round(profitPercent)}% 利潤</span>
                </div>
              </div>

              {/* 中塊：平均月負擔 */}
              <div className="md:w-1/4">
                <h5 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                  <Activity size={16} className="text-slate-500" />
                  平均月負擔
                </h5>
                <div className={`text-2xl font-black font-mono ${avgMonthlyNetPay > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
                  {avgMonthlyNetPay > 0 ? '' : '+'}${formatCurrency(avgMonthlyNetPay)}
                </div>
                <p className="text-xs text-slate-400 mt-1">三循環平均淨支出</p>
              </div>

              {/* 右塊：資產放大倍數 */}
              <div className="md:w-1/4">
                <h5 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">
                  <Scale size={16} className="text-slate-500" />
                  資產放大倍數
                </h5>
                <div className="text-2xl font-black text-indigo-600 font-mono">
                  {assetMultiplier}x
                </div>
                <p className="text-xs text-slate-400 mt-1">期末資產 / 總實付</p>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* 三個循環的結果對比區 */}
      <div className="pt-6 border-t border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Repeat className="text-indigo-600" size={24} /> 三循環成果關鍵指標
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <ResultCard
            phase={1}
            period={`T0 - T${loanTerm} (累積期)`}
            netOut={phase1_NetOut}
            asset={phase1_Asset}
            totalOut={totalCashOut_T0_T7_Wan}
            loanTerm={loanTerm}
            isCompoundMode={isCompoundMode}
            loanAmount={loanAmount}
            rate={loanRate}
          />
          <ResultCard
            phase={2}
            period={`T${loanTerm} - T${loanTerm * 2} (成長期)`}
            netOut={phase2_NetOut}
            asset={phase2_Asset}
            totalOut={totalCashOut_T7_T14_Wan}
            loanTerm={loanTerm}
            isCompoundMode={isCompoundMode}
            loanAmount={c2Loan}
            rate={c2Rate}
          />
          <ResultCard
            phase={3}
            period={`T${loanTerm * 2} - T${loanTerm * 3} (收穫期)`}
            netOut={phase3_NetOut}
            asset={phase3_Asset}
            totalOut={totalCashOut_T14_T21_Wan}
            netProfitTotal={netProfit_Wan}
            isFinal={true}
            loanTerm={loanTerm}
            isCompoundMode={isCompoundMode}
            loanAmount={c3Loan}
            rate={c3Rate}
          />
        </div>

        {/* 分享給客戶 — 兩種並列、用途不同：
            - ShareButton（摘要）：text 摘要走 LINE，客戶看到一句結論（Sprint 5 既有）
            - ShareToCustomerButton（連結）：產生 /r/million-gift URL → readonly 視覺
            cycle2/3 顯示值（c2Loan/c2Rate）走 ?? fallback 到 cycle1，payload 帶 effective
            值而非原始 undefined，避免 readonly 端要重做同樣的 fallback 邏輯 */}
        <div className="flex flex-wrap justify-end gap-3 mt-4">
          <ShareButton
            variant="full"
            title="百萬禮物專案"
            text={`【百萬禮物專案】首期 ${loanAmount} 萬 / ${loanTerm * 3} 年計畫 — 預估淨收益 ${netProfit_Wan} 萬`}
          />
          <ShareToCustomerButton
            tool="million_gift"
            reportLabel="百萬禮物專案"
            inputs={{
              loanAmount,
              loanTerm,
              loanRate,
              investReturnRate,
              cycle2Loan: c2Loan,
              cycle2Rate: c2Rate,
              cycle3Loan: c3Loan,
              cycle3Rate: c3Rate,
              isCompoundMode,
            }}
            outputs={{
              phase1_Asset,
              phase2_Asset,
              phase3_Asset,
              totalCashOut_T0_T7_Wan,
              totalCashOut_T7_T14_Wan,
              totalCashOut_T14_T21_Wan,
              totalProjectCost_Wan,
              netProfit_Wan,
              assetMultiplier,
              efficiencyMultiplier,
              avgMonthlyNetPay,
              totalInterestWan,
              rateSpread,
            }}
          />
        </div>
      </div>

      {/* Strategy Section: 策略說明 */}
      <div className="grid md:grid-cols-2 gap-8 pt-6 border-t border-slate-200 print-break-inside">

        {/* 1. 執行循環 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="text-indigo-600" size={24} />
            <h3 className="text-xl font-bold text-slate-800">執行三部曲 ({loanTerm * 3}年計畫)</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-blue-200 transition-colors">
              <div className="mt-1 min-w-[3rem] h-12 rounded-xl bg-blue-50 text-blue-600 flex flex-col items-center justify-center font-bold text-xs">
                <span className="text-lg">01</span>
                <span>啟動</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 flex items-center gap-2">累積期 (第1-{loanTerm}年)</h4>
                <p className="text-sm text-slate-600 mt-1">借入第一筆資金。{isCompoundMode ? '將配息全數滾入再投資，加速本金累積。' : '配息幫忙繳部分貸款，只需負擔差額，無痛累積。'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors">
              <div className="mt-1 min-w-[3rem] h-12 rounded-xl bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center font-bold text-xs">
                <span className="text-lg">02</span>
                <span>成長</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 flex items-center gap-2">循環期 (第{loanTerm + 1}-{loanTerm * 2}年)</h4>
                <p className="text-sm text-slate-600 mt-1">償還第一筆後再次借出{c2Loan}萬，資產規模翻倍。{isCompoundMode ? '複利效應開始顯著發威。' : '雙倍配息讓月付金大幅降低。'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-purple-200 transition-colors">
              <div className="mt-1 min-w-[3rem] h-12 rounded-xl bg-purple-50 text-purple-600 flex flex-col items-center justify-center font-bold text-xs">
                <span className="text-lg">03</span>
                <span>收割</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 flex items-center gap-2">收穫期 (第{loanTerm * 2 + 1}-{loanTerm * 3}年)</h4>
                <p className="text-sm text-slate-600 mt-1">第三次操作投入{c3Loan}萬。{isCompoundMode ? '資產呈現指數級爆發，創造驚人財富。' : '三份配息通常已超過貸款月付，產生正向現金流。'}</p>
              </div>
            </div>
          </div>

          {/* 金句卡片 */}
          <div className="mt-2 p-4 bg-slate-800 rounded-xl text-center shadow-lg">
            <p className="text-slate-300 italic text-sm">
              「給孩子的不是一筆錢，而是一套會長大的資產，以及受用一生的理財智慧。」
            </p>
          </div>
        </div>

        {/* 2. 專案效益 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-indigo-600" size={24} />
            <h3 className="text-xl font-bold text-slate-800">專案四大效益</h3>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {[
              { title: "時間複利", desc: `不需等到存夠錢才投資，直接借入未來財富，讓複利效應提早${loanTerm}年啟動。` },
              { title: "強迫儲蓄", desc: "將「隨意花費」轉為「固定還款」，每月收到帳單就是最好的存錢提醒。" },
              { title: isCompoundMode ? "複利爆發" : "無痛累積", desc: isCompoundMode ? "透過股息再投入，讓資產像滾雪球般越滾越大，發揮複利最大威力。" : "利用配息Cover大部分還款，用比一般存錢更少的現金流，換取更大的資產。" },
              { title: "信用培養", desc: `長達${loanTerm * 3}年的優良還款紀錄，將使您成為銀行眼中的頂級優質客戶。` }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:bg-indigo-50/50 transition-colors">
                <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-bold text-slate-800">{item.title}</h4>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 業務小抄面板 */}
      {/* ============================================================ */}
      {showCheatSheet && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* 背景遮罩 */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={closeCheatSheet}
          />

          {/* 側邊面板 */}
          <div className="relative w-full max-w-md bg-slate-900 text-white shadow-2xl overflow-y-auto">
            {/* 標題列 */}
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

              {/* 小抄內容 - 試用會員看到模糊版本 */}
              <div className={`p-4 space-y-6 text-sm ${!isPaidMember ? 'blur-sm pointer-events-none select-none' : ''}`}>

                {/* ========== 1. 當前數據 ========== */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-800 p-2 rounded">
                    <span className="text-slate-500">單次貸款</span>
                    <p className="font-bold text-emerald-400">{loanAmount} 萬</p>
                  </div>
                  <div className="bg-slate-800 p-2 rounded">
                    <span className="text-slate-500">收益差額</span>
                    <p className={`font-bold ${isPositiveSpread ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {rateSpread.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-slate-800 p-2 rounded">
                    <span className="text-slate-500">平均月負擔</span>
                    <p className={`font-bold ${avgMonthlyNetPay > 0 ? 'text-blue-400' : 'text-emerald-400'}`}>
                      {formatMoneyYuan(avgMonthlyNetPay)}
                    </p>
                  </div>
                  <div className="bg-slate-800 p-2 rounded">
                    <span className="text-slate-500">期末總資產</span>
                    <p className="font-bold text-emerald-400">{finalAssetValue_Wan} 萬</p>
                  </div>
                  <div className="bg-slate-800 p-2 rounded">
                    <span className="text-slate-500">總實付成本</span>
                    <p className={`font-bold ${totalProjectCost_Wan > 0 ? 'text-blue-400' : 'text-emerald-400'}`}>
                      {totalProjectCost_Wan} 萬
                    </p>
                  </div>
                  <div className="bg-slate-800 p-2 rounded">
                    <span className="text-slate-500">資產放大倍數</span>
                    <p className="font-bold text-purple-400">{assetMultiplier}x</p>
                  </div>
                </div>

                {/* ========== 2. 專案結構說明 ========== */}
                <div>
                  <h4 className="font-bold text-emerald-400 mb-2">專案結構</h4>
                  <div className="bg-slate-800 p-3 rounded text-xs space-y-2">
                    <p className="text-slate-300">本試算採三循環設計：每 {loanTerm} 年為一循環，共 {loanTerm * 3} 年。每循環貸款 {loanAmount} 萬，投入指定標的，假設年化報酬 {investReturnRate}%。</p>
                    <p className="text-slate-400">{isCompoundMode ? '複利模式：配息再投入。' : '配息模式：配息用於償還貸款利息。'}此為情境模擬，非保證收益。</p>
                  </div>
                </div>

                {/* ========== 3. 試算假設 ========== */}
                <div>
                  <h4 className="font-bold text-amber-400 mb-2">試算假設</h4>
                  <div className="space-y-2 text-xs">
                    <div className="bg-slate-800 p-2 rounded">
                      <p className="text-emerald-300 font-bold">利率假設</p>
                      <p className="text-slate-400">貸款利率 {loanRate}%（固定），投資年化 {investReturnRate}%（假設）。實際借貸利率以銀行核定為準，投資報酬非保證且可能為負。</p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded">
                      <p className="text-blue-300 font-bold">複利公式</p>
                      <p className="text-slate-400">三次循環後期末資產約 {finalAssetValue_Wan} 萬（不含通膨、稅負、匯率、手續費調整）。</p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded">
                      <p className="text-purple-300 font-bold">成本對照</p>
                      <p className="text-slate-400">累計實付（本息合計，未折現）約 {totalProjectCost_Wan} 萬。實際內部報酬率（IRR）需考慮時間價值，請另行計算。</p>
                    </div>
                  </div>
                </div>

                {/* ========== 4. 風險與限制 ========== */}
                <div>
                  <h4 className="font-bold text-rose-400 mb-2">風險與限制</h4>
                  <div className="space-y-2 text-xs">
                    <div className="bg-slate-800 p-2 rounded">
                      <p className="text-rose-300 font-bold">槓桿風險</p>
                      <p className="text-slate-400">投資資金來自貸款，若標的下跌或配息低於預期，可能出現現金流缺口，仍須以個人收入填補貸款本息。</p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded">
                      <p className="text-rose-300 font-bold">長期承諾</p>
                      <p className="text-slate-400">本專案規劃期間 {loanTerm * 3} 年，期間個人收入、健康、利率環境均可能改變。提前解約可能產生違約金或實現虧損。</p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded">
                      <p className="text-rose-300 font-bold">配息變動</p>
                      <p className="text-slate-400">高配息商品的配息率可能調降，且部分配息來自本金。應檢視標的之配息來源（含本金佔比）。</p>
                    </div>
                  </div>
                </div>

                {/* ========== 5. 提醒 ========== */}
                <div>
                  <h4 className="font-bold text-slate-400 mb-2">提醒</h4>
                  <div className="bg-slate-800/50 p-2 rounded border border-slate-700 text-xs text-slate-400 leading-relaxed italic">
                    本工具為長期投資與貸款組合的情境模擬，不構成投資建議、保險推介或貸款推銷。實際決策應由本人就風險承受度、現金流穩定性、家庭規劃綜合評估，必要時諮詢合格財務顧問。
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

export default MillionDollarGiftTool;
