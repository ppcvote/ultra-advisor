/**
 * CashFlowVisualizer - 收入流 vs 支出流 即時視覺化
 *
 * 即時顯示每秒/每分/每小時的收入與支出流動
 * 包含：薪資收入、房貸、保費、生活費等支出項目
 *
 * 檔案位置：src/components/CashFlowVisualizer.tsx
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play, Pause, RotateCcw, TrendingUp, TrendingDown,
  DollarSign, Home, Shield, ShoppingBag, Car, Heart,
  Plus, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';

// ==========================================
// Types
// ==========================================
interface ExpenseItem {
  id: string;
  name: string;
  amount: number;       // 月金額
  icon: string;
  color: string;
}

type SalaryMode = 'yearly' | 'monthly' | 'hourly';
type TimeUnit = 'second' | 'minute' | 'hour' | 'day';

const PRESET_EXPENSES: Omit<ExpenseItem, 'id' | 'amount'>[] = [
  { name: '房貸', icon: 'home', color: 'blue' },
  { name: '保險費', icon: 'shield', color: 'emerald' },
  { name: '生活費', icon: 'shopping', color: 'amber' },
  { name: '車貸', icon: 'car', color: 'purple' },
  { name: '孝親費', icon: 'heart', color: 'pink' },
];

const ICON_MAP: Record<string, React.ElementType> = {
  home: Home,
  shield: Shield,
  shopping: ShoppingBag,
  car: Car,
  heart: Heart,
};

// ==========================================
// Utility
// ==========================================
const toPerSecond = (monthlyAmount: number): number => {
  // 月 → 秒：月 / 30 / 24 / 3600
  return monthlyAmount / 30 / 24 / 3600;
};

const formatMoney = (amount: number, decimals = 4): string => {
  if (amount < 0.0001 && amount > 0) return amount.toExponential(2);
  if (amount >= 1000000) return `${(amount / 10000).toFixed(0)} 萬`;
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)} 萬`;
  return amount.toFixed(decimals);
};

const generateId = () => Math.random().toString(36).slice(2, 8);

// ==========================================
// OdometerDigit - 單一滾輪數字
// ==========================================
const DIGIT_HEIGHT = 56; // px, matches text-4xl/5xl line height

const OdometerDigit: React.FC<{
  digit: number;
  color: string;
}> = React.memo(({ digit, color }) => {
  return (
    <div className="relative overflow-hidden" style={{ height: DIGIT_HEIGHT, width: '0.6em' }}>
      <div
        className="absolute left-0 right-0 transition-transform duration-150 ease-out"
        style={{ transform: `translateY(${-digit * DIGIT_HEIGHT}px)` }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <div
            key={n}
            className={`${color} font-black font-mono tabular-nums text-center`}
            style={{ height: DIGIT_HEIGHT, lineHeight: `${DIGIT_HEIGHT}px` }}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
});

// ==========================================
// OdometerDisplay - 完整滾輪數字列
// ==========================================
const OdometerDisplay: React.FC<{
  value: number;
  decimals?: number;
  prefix?: string;
  colorClass: string;
  size?: 'lg' | 'sm';
}> = ({ value, decimals = 2, prefix = '', colorClass, size = 'lg' }) => {
  // 格式化為固定位數字串
  const formatted = value.toFixed(decimals);
  const [intPart, decPart] = formatted.split('.');
  const intDigits = (intPart || '0').split('').map(Number);
  const decDigits = decPart ? decPart.split('').map(Number) : [];

  const fontSize = size === 'lg' ? 'text-4xl md:text-5xl' : 'text-lg md:text-xl';
  const h = size === 'lg' ? DIGIT_HEIGHT : 28;

  return (
    <div className={`flex items-center ${fontSize}`} style={{ height: size === 'lg' ? DIGIT_HEIGHT : 28 }}>
      {/* prefix (+/-) */}
      {prefix && (
        <span className={`${colorClass} font-black font-mono`}>{prefix}</span>
      )}
      {/* $ */}
      <span className={`${colorClass} font-black font-mono mr-0.5`}>$</span>

      {/* Integer part with odometer */}
      {intDigits.map((d, i) => (
        <div key={`int-${intDigits.length}-${i}`} className="relative overflow-hidden" style={{ height: h, width: '0.6em' }}>
          <div
            className="absolute left-0 right-0"
            style={{
              transform: `translateY(${-d * h}px)`,
              transition: 'transform 150ms ease-out',
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <div
                key={n}
                className={`${colorClass} font-black font-mono tabular-nums text-center`}
                style={{ height: h, lineHeight: `${h}px` }}
              >
                {n}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Decimal point */}
      {decDigits.length > 0 && (
        <span className={`${colorClass} font-black font-mono`}>.</span>
      )}

      {/* Decimal part with odometer */}
      {decDigits.map((d, i) => (
        <div key={`dec-${i}`} className="relative overflow-hidden" style={{ height: h, width: '0.6em' }}>
          <div
            className="absolute left-0 right-0"
            style={{
              transform: `translateY(${-d * h}px)`,
              transition: `transform ${80 + i * 40}ms ease-out`,
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <div
                key={n}
                className={`${colorClass} font-black font-mono tabular-nums text-center opacity-70`}
                style={{ height: h, lineHeight: `${h}px` }}
              >
                {n}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ==========================================
// FlowCounter - 跑動數字元件（滾輪版）
// ==========================================
const FlowCounter: React.FC<{
  perSecond: number;
  isRunning: boolean;
  elapsed: number;
  label: string;
  color: 'green' | 'red' | 'blue';
  prefix?: string;
}> = ({ perSecond, isRunning, elapsed, label, color, prefix = '' }) => {
  const accumulated = perSecond * elapsed;

  const colorMap = {
    green: {
      text: 'text-emerald-400',
      textBright: 'text-emerald-300',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      borderBright: 'border-emerald-400/40',
      glow: 'shadow-[0_0_60px_rgba(16,185,129,0.35),0_0_120px_rgba(16,185,129,0.15)]',
      particle: 'bg-emerald-400',
      scanline: 'from-transparent via-emerald-400/10 to-transparent',
    },
    red: {
      text: 'text-red-400',
      textBright: 'text-red-300',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      borderBright: 'border-red-400/40',
      glow: 'shadow-[0_0_60px_rgba(239,68,68,0.35),0_0_120px_rgba(239,68,68,0.15)]',
      particle: 'bg-red-400',
      scanline: 'from-transparent via-red-400/10 to-transparent',
    },
    blue: {
      text: 'text-blue-400',
      textBright: 'text-blue-300',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      borderBright: 'border-blue-400/40',
      glow: 'shadow-[0_0_60px_rgba(59,130,246,0.35),0_0_120px_rgba(59,130,246,0.15)]',
      particle: 'bg-blue-400',
      scanline: 'from-transparent via-blue-400/10 to-transparent',
    },
  };

  const c = colorMap[color];
  const odometerColor = isRunning ? c.textBright : c.text;

  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-500
                    ${c.bg} border ${isRunning ? c.borderBright : c.border}
                    ${isRunning ? c.glow : ''}`}>

      {/* 掃描線動畫 */}
      {isRunning && (
        <div className={`absolute inset-0 pointer-events-none`}>
          <div className={`absolute inset-x-0 h-[2px] bg-gradient-to-r ${c.scanline} animate-scanline`} />
        </div>
      )}

      {/* 浮動粒子 */}
      {isRunning && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-1.5 h-1.5 ${c.particle} rounded-full animate-float-particle`}
              style={{
                left: `${10 + i * 11}%`,
                opacity: 0.3,
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${1.8 + i * 0.2}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">{label}</div>
          {isRunning && (
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${c.particle} animate-ping-slow`} />
              <span className={`${c.text} text-[10px] font-bold uppercase tracking-wider`}>LIVE</span>
            </div>
          )}
        </div>

        {/* 主數字 - 滾輪式 */}
        <OdometerDisplay
          value={accumulated}
          decimals={2}
          prefix={prefix}
          colorClass={odometerColor}
          size="lg"
        />

        {/* 每秒/每分/每小時 - 小型滾輪 */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { value: perSecond, unit: '秒', dec: 4 },
            { value: perSecond * 60, unit: '分鐘', dec: 2 },
            { value: perSecond * 3600, unit: '小時', dec: 0 },
          ].map(({ value: v, unit, dec }) => (
            <div key={unit} className="text-center bg-black/30 rounded-xl py-2.5 px-1 border border-white/[0.03]">
              <div className="flex justify-center">
                <OdometerDisplay
                  value={v}
                  decimals={dec}
                  colorClass={`${isRunning ? c.textBright : c.text} text-sm md:text-base`}
                  size="sm"
                />
              </div>
              <div className="text-slate-600 text-[10px] font-bold mt-1">/ {unit}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// Flow Bar - 即時流動條
// ==========================================
const FlowBar: React.FC<{
  incomePerSec: number;
  expensePerSec: number;
  isRunning: boolean;
}> = ({ incomePerSec, expensePerSec, isRunning }) => {
  const total = incomePerSec + expensePerSec;
  const incomePercent = total > 0 ? (incomePerSec / total) * 100 : 50;
  const net = incomePerSec - expensePerSec;
  const isPositive = net >= 0;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
      <div className="flex justify-between items-center mb-3">
        <span className="text-slate-400 text-sm font-bold">收支比例</span>
        <span className={`text-sm font-black ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '盈餘' : '赤字'} ${formatMoney(Math.abs(net * 3600 * 24 * 30), 0)}/月
        </span>
      </div>

      {/* 流動條 */}
      <div className="relative h-8 rounded-full overflow-hidden bg-slate-700/50">
        <div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-500 rounded-l-full"
          style={{ width: `${incomePercent}%` }}
        >
          {incomePercent > 15 && (
            <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">
              收入 {incomePercent.toFixed(0)}%
            </span>
          )}
        </div>
        <div
          className="absolute right-0 top-0 h-full bg-gradient-to-l from-red-600 to-red-500 transition-all duration-500 rounded-r-full"
          style={{ width: `${100 - incomePercent}%` }}
        >
          {(100 - incomePercent) > 15 && (
            <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white">
              支出 {(100 - incomePercent).toFixed(0)}%
            </span>
          )}
        </div>

        {/* 動態粒子 */}
        {isRunning && (
          <>
            <div className="absolute top-0 h-full w-3 bg-white/30 rounded-full animate-flow-right"
                 style={{ left: '0%', animationDuration: '2s' }} />
            <div className="absolute top-0 h-full w-3 bg-white/30 rounded-full animate-flow-left"
                 style={{ right: '0%', animationDuration: '2s' }} />
          </>
        )}
      </div>

      {/* 每日淨額 */}
      <div className="mt-3 text-center">
        <span className="text-slate-500 text-xs">每日淨儲蓄：</span>
        <span className={`text-sm font-black ml-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}${formatMoney(net * 3600 * 24, 0)}
        </span>
      </div>
    </div>
  );
};

// ==========================================
// Main Component
// ==========================================
const CashFlowVisualizer: React.FC = () => {
  // 輸入狀態
  const [salaryMode, setSalaryMode] = useState<SalaryMode>('monthly');
  const [salary, setSalary] = useState<number>(50000);
  const [taxRate, setTaxRate] = useState<number>(5);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: generateId(), name: '房貸', amount: 15000, icon: 'home', color: 'blue' },
    { id: generateId(), name: '保險費', amount: 3000, icon: 'shield', color: 'emerald' },
    { id: generateId(), name: '生活費', amount: 12000, icon: 'shopping', color: 'amber' },
  ]);

  // 控制狀態
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showExpensePanel, setShowExpensePanel] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  // 計算
  const monthlyGross = salaryMode === 'yearly' ? salary / 12 : salaryMode === 'monthly' ? salary : salary * 22 * 8;
  const monthlyNet = monthlyGross * (1 - taxRate / 100);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  const incomePerSec = toPerSecond(monthlyNet);
  const expensePerSec = toPerSecond(totalExpense);

  // Timer
  const startTimer = useCallback(() => {
    setIsRunning(true);
    startTimeRef.current = Date.now() - elapsedRef.current * 1000;
    intervalRef.current = setInterval(() => {
      const newElapsed = (Date.now() - startTimeRef.current) / 1000;
      elapsedRef.current = newElapsed;
      setElapsed(newElapsed);
    }, 50); // 20fps for smooth counting
  }, []);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    pauseTimer();
    elapsedRef.current = 0;
    setElapsed(0);
  }, [pauseTimer]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // 支出項操作
  const addExpense = () => {
    setExpenses(prev => [...prev, {
      id: generateId(),
      name: '新項目',
      amount: 0,
      icon: 'shopping',
      color: 'slate',
    }]);
  };

  const removeExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const updateExpense = (id: string, field: keyof ExpenseItem, value: string | number) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  // 格式化經過時間
  const formatElapsed = (secs: number): string => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* 標題 */}
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-black text-white">
          收入流 <span className="text-slate-500">vs</span> 支出流
        </h1>
        <p className="text-slate-500 text-sm mt-2">即時視覺化你的金錢流動，每一秒都在計算</p>
      </div>

      {/* ==================== 輸入區 ==================== */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 space-y-4">
        {/* 薪資 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-slate-300 text-sm font-bold flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-400" />
              薪資收入
            </label>
            <div className="flex gap-1 bg-slate-700/50 p-0.5 rounded-lg">
              {([['yearly', '年薪'], ['monthly', '月薪'], ['hourly', '時薪']] as const).map(([mode, text]) => (
                <button
                  key={mode}
                  onClick={() => setSalaryMode(mode)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    salaryMode === mode ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
            <input
              type="number"
              value={salary}
              onChange={e => setSalary(Number(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-600 rounded-xl pl-8 pr-16 py-3 text-white text-lg font-mono
                         focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
              {salaryMode === 'yearly' ? '/年' : salaryMode === 'monthly' ? '/月' : '/時'}
            </span>
          </div>
        </div>

        {/* 所得稅率 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-slate-300 text-sm font-bold">所得稅率</label>
            <span className="text-emerald-400 text-sm font-mono font-bold">{taxRate}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={taxRate}
            onChange={e => setTaxRate(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                       [&::-webkit-slider-thumb]:bg-emerald-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                       [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>0%</span>
            <span>稅後月收：${monthlyNet.toLocaleString()}</span>
            <span>40%</span>
          </div>
        </div>

        {/* 支出項目 */}
        <div>
          <button
            onClick={() => setShowExpensePanel(!showExpensePanel)}
            className="flex items-center justify-between w-full text-left mb-2"
          >
            <span className="text-slate-300 text-sm font-bold flex items-center gap-2">
              <TrendingDown size={16} className="text-red-400" />
              每月固定支出
              <span className="text-red-400 font-mono">${totalExpense.toLocaleString()}</span>
            </span>
            {showExpensePanel ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
          </button>

          {showExpensePanel && (
            <div className="space-y-2">
              {expenses.map(exp => {
                const Icon = ICON_MAP[exp.icon] || ShoppingBag;
                return (
                  <div key={exp.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                      <Icon size={14} className="text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={exp.name}
                      onChange={e => updateExpense(exp.id, 'name', e.target.value)}
                      className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-sm
                                 focus:outline-none focus:border-blue-500 transition-all"
                    />
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                      <input
                        type="number"
                        value={exp.amount}
                        onChange={e => updateExpense(exp.id, 'amount', Number(e.target.value) || 0)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-8 py-1.5 text-white text-sm font-mono
                                   focus:outline-none focus:border-red-500 transition-all"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 text-xs">/月</span>
                    </div>
                    <button
                      onClick={() => removeExpense(exp.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={addExpense}
                className="flex items-center gap-2 text-slate-500 hover:text-blue-400 text-sm transition-colors py-1"
              >
                <Plus size={14} />
                新增支出項目
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ==================== 控制區 ==================== */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={isRunning ? pauseTimer : startTimer}
          className={`flex items-center gap-2 px-8 py-3 rounded-xl font-black text-lg transition-all ${
            isRunning
              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_30px_rgba(245,158,11,0.3)]'
              : 'bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.3)]'
          }`}
        >
          {isRunning ? <Pause size={22} /> : <Play size={22} />}
          {isRunning ? '暫停' : '開始計算'}
        </button>
        <button
          onClick={resetTimer}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-slate-400
                     bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
        >
          <RotateCcw size={18} />
          重設
        </button>
      </div>

      {/* 計時器 */}
      <div className="text-center">
        <span className="text-slate-600 text-xs font-bold uppercase tracking-widest">已經過</span>
        <div className={`text-2xl font-black font-mono tabular-nums mt-1 transition-colors ${
          isRunning ? 'text-white' : 'text-slate-500'
        }`}>
          {formatElapsed(elapsed)}
        </div>
      </div>

      {/* ==================== 即時數字 ==================== */}
      <div className="grid md:grid-cols-2 gap-4">
        <FlowCounter
          perSecond={incomePerSec}
          isRunning={isRunning}
          elapsed={elapsed}
          label="累積收入"
          color="green"
          prefix="+"
        />
        <FlowCounter
          perSecond={expensePerSec}
          isRunning={isRunning}
          elapsed={elapsed}
          label="累積支出"
          color="red"
          prefix="-"
        />
      </div>

      {/* ==================== 收支比例條 ==================== */}
      <FlowBar
        incomePerSec={incomePerSec}
        expensePerSec={expensePerSec}
        isRunning={isRunning}
      />

      {/* ==================== 支出明細跑動 ==================== */}
      {expenses.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
          <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">支出明細（即時累積）</h3>
          <div className="space-y-3">
            {expenses.filter(e => e.amount > 0).map(exp => {
              const Icon = ICON_MAP[exp.icon] || ShoppingBag;
              const perSec = toPerSecond(exp.amount);
              const accumulated = perSec * elapsed;
              const percent = totalExpense > 0 ? (exp.amount / totalExpense) * 100 : 0;

              return (
                <div key={exp.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                    <Icon size={14} className="text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm font-bold truncate">{exp.name}</span>
                      <span className="text-red-400 text-sm font-mono font-bold">
                        -${formatMoney(accumulated, 2)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-slate-600 text-xs">${exp.amount.toLocaleString()}/月</span>
                      <span className="text-slate-600 text-xs">{percent.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== 數據摘要 ==================== */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5">
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">數據摘要</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '稅後月收入', value: `$${monthlyNet.toLocaleString()}`, color: 'text-emerald-400' },
            { label: '月固定支出', value: `$${totalExpense.toLocaleString()}`, color: 'text-red-400' },
            { label: '月淨儲蓄', value: `$${(monthlyNet - totalExpense).toLocaleString()}`, color: monthlyNet - totalExpense >= 0 ? 'text-blue-400' : 'text-red-400' },
            { label: '儲蓄率', value: monthlyNet > 0 ? `${((monthlyNet - totalExpense) / monthlyNet * 100).toFixed(1)}%` : '0%', color: (monthlyNet - totalExpense) >= 0 ? 'text-purple-400' : 'text-red-400' },
          ].map(item => (
            <div key={item.label} className="text-center">
              <div className="text-slate-600 text-xs mb-1">{item.label}</div>
              <div className={`${item.color} text-lg font-black font-mono`}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ==================== 年度預測 ==================== */}
      <div className="bg-gradient-to-br from-slate-800/80 to-blue-900/20 border border-blue-500/10 rounded-2xl p-5">
        <h3 className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-4">年度預測</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[1, 5, 10].map(years => {
            const yearlyNet = (monthlyNet - totalExpense) * 12;
            const total = yearlyNet * years;
            return (
              <div key={years}>
                <div className="text-slate-500 text-xs mb-1">{years} 年後淨儲蓄</div>
                <div className={`text-lg font-black font-mono ${total >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  ${total >= 10000 ? `${(total / 10000).toFixed(0)}萬` : total.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-slate-600 text-xs text-center mt-3">* 未計入投資報酬與通膨，僅供參考</p>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes flow-right {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(500%); opacity: 0; }
        }
        @keyframes flow-left {
          0% { transform: translateX(100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(-500%); opacity: 0; }
        }
        .animate-flow-right { animation: flow-right 2s ease-in-out infinite; }
        .animate-flow-left { animation: flow-left 2s ease-in-out infinite; }

        @keyframes float-particle {
          0% { transform: translateY(100%) scale(0); opacity: 0; }
          15% { opacity: 0.5; transform: translateY(60%) scale(0.8); }
          100% { transform: translateY(-500%) scale(1.5); opacity: 0; }
        }
        .animate-float-particle { animation: float-particle 2s ease-out infinite; }

        @keyframes scanline {
          0% { top: -2px; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scanline { animation: scanline 3s linear infinite; }

        @keyframes ping-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.5); }
        }
        .animate-ping-slow { animation: ping-slow 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default CashFlowVisualizer;
