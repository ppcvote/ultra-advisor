import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Lock, Unlock, ShieldCheck, TrendingUp, Hourglass,
  Coins, AlertTriangle, Activity, Ban, X, Crown
} from 'lucide-react';
import { useMembership } from '../hooks/useMembership';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { auth, db } from '../firebase';
import DisclaimerFooter from './DisclaimerFooter';
import ShareToCustomerButton from './ShareToCustomerButton';

// ============================================================
// 格式化函式
// ============================================================
const formatMoney = (val: number): string => {
  if (val >= 100000000) {
    return `${(val / 100000000).toFixed(2)} 億`;
  }
  if (val >= 10000) {
    return `${(val / 10000).toFixed(0)} 萬`;
  }
  return val.toLocaleString();
};

export default function GoldenSafeVault({ data, setData, userId }: any) {
  // 會員權限判斷
  const { membership, loading: membershipLoading } = useMembership(userId || null);
  const isPaidMember = membershipLoading ? true : (membership?.isPaid || false);

  // 預設值（金額單位：萬）
  const safeData = {
    mode: data?.mode || 'time',
    amount: Number(data?.amount) || 6,        // 萬
    years: Number(data?.years) || 10,
    rate: Number(data?.rate) || 6,
    isLocked: data?.isLocked || false,
    // 個人資料
    age: Number(data?.age) || 35,             // 年齡
    annualIncome: Number(data?.annualIncome) || 100,  // 年收入（萬）
    // 災難損失參數
    medicalLoss: Number(data?.medicalLoss) || 200,    // 萬 (重大傷病：固定金額)
    marketLoss: Number(data?.marketLoss) || 30,       // % (市場崩盤：資產的30%)
    taxLoss: Number(data?.taxLoss) || 10,             // % (稅務/債務：資產的10%)
  };

  // ============================================================
  // 暫存狀態（temp state pattern）
  // ============================================================
  const [tempAmount, setTempAmount] = useState<string | number>(safeData.amount);
  const [tempYears, setTempYears] = useState<string | number>(safeData.years);
  const [tempRate, setTempRate] = useState<string | number>(safeData.rate);
  const [tempAge, setTempAge] = useState<string | number>(safeData.age);
  const [tempAnnualIncome, setTempAnnualIncome] = useState<string | number>(safeData.annualIncome);
  const [tempMedicalLoss, setTempMedicalLoss] = useState<string | number>(safeData.medicalLoss);
  const [tempMarketLoss, setTempMarketLoss] = useState<string | number>(safeData.marketLoss);
  const [tempTaxLoss, setTempTaxLoss] = useState<string | number>(safeData.taxLoss);

  // 同步外部資料變化
  useEffect(() => { setTempAmount(safeData.amount); }, [safeData.amount]);
  useEffect(() => { setTempYears(safeData.years); }, [safeData.years]);
  useEffect(() => { setTempRate(safeData.rate); }, [safeData.rate]);
  useEffect(() => { setTempAge(safeData.age); }, [safeData.age]);
  useEffect(() => { setTempAnnualIncome(safeData.annualIncome); }, [safeData.annualIncome]);
  useEffect(() => { setTempMedicalLoss(safeData.medicalLoss); }, [safeData.medicalLoss]);
  useEffect(() => { setTempMarketLoss(safeData.marketLoss); }, [safeData.marketLoss]);
  useEffect(() => { setTempTaxLoss(safeData.taxLoss); }, [safeData.taxLoss]);

  // ============================================================
  // Finalize 函數（onBlur 時驗證）
  // ============================================================
  const finalizeAmount = () => {
    let val = Number(tempAmount) || 6;
    val = Math.max(1, Math.min(10000, val)); // 1萬 ~ 1億
    setTempAmount(val);
    setData({ ...safeData, amount: val, isLocked: false });
    setLocalLocked(false);
    setActiveDisaster(null);
  };

  const finalizeYears = () => {
    let val = Number(tempYears) || 10;
    val = Math.max(5, Math.min(40, val));
    setTempYears(val);
    setData({ ...safeData, years: val, isLocked: false });
    setLocalLocked(false);
    setActiveDisaster(null);
  };

  const finalizeRate = () => {
    let val = Number(tempRate) || 6;
    val = Math.max(3, Math.min(12, val));
    val = Math.round(val * 10) / 10;
    setTempRate(val);
    setData({ ...safeData, rate: val, isLocked: false });
    setLocalLocked(false);
    setActiveDisaster(null);
  };

  const finalizeAge = () => {
    let val = Number(tempAge) || 35;
    val = Math.max(20, Math.min(70, val));  // 20~70歲
    setTempAge(val);
    setData({ ...safeData, age: val });
  };

  const finalizeAnnualIncome = () => {
    let val = Number(tempAnnualIncome) || 100;
    val = Math.max(30, Math.min(3000, val));  // 30萬 ~ 3000萬
    setTempAnnualIncome(val);
    setData({ ...safeData, annualIncome: val });
  };

  const finalizeMedicalLoss = () => {
    let val = Number(tempMedicalLoss) || 200;
    val = Math.max(50, Math.min(1000, val));  // 50萬 ~ 1000萬
    setTempMedicalLoss(val);
    setData({ ...safeData, medicalLoss: val });
  };

  const finalizeMarketLoss = () => {
    let val = Number(tempMarketLoss) || 30;
    val = Math.max(10, Math.min(50, val));  // 10% ~ 50%
    setTempMarketLoss(val);
    setData({ ...safeData, marketLoss: val });
  };

  const finalizeTaxLoss = () => {
    let val = Number(tempTaxLoss) || 100;
    val = Math.max(50, Math.min(500, val));  // 50萬 ~ 500萬
    setTempTaxLoss(val);
    setData({ ...safeData, taxLoss: val });
  };

  // KeyDown 處理函數
  const handleKeyDown = (finalizer: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      finalizer();
      e.currentTarget.blur();
    }
  };

  // ============================================================
  // 業務小抄功能
  // ============================================================
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const clickTimer = useRef<NodeJS.Timeout | null>(null);

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
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCheatSheet(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // ============================================================
  // 核心狀態
  // ============================================================
  const [localLocked, setLocalLocked] = useState(safeData.isLocked);
  const [animateValue, setAnimateValue] = useState(0);
  const [activeDisaster, setActiveDisaster] = useState<string | null>(null);
  const [showDisasterInfo, setShowDisasterInfo] = useState<string | null>(null);  // 災難資訊彈窗

  // 基礎計算 (無風險時的資產，以「元」計算)
  const baseValue = useMemo(() => {
    const { mode, amount, years, rate } = safeData;
    const amountYuan = amount * 10000; // 萬 → 元
    const r = rate / 100;
    let val = 0;
    if (mode === 'asset') {
      val = Math.round(amountYuan * Math.pow(1 + r, years));
    } else if (r === 0) {
      // 年金 rate=0 退化為純存款（不再除以 0 → NaN）
      val = Math.round(amountYuan * years);
    } else {
      val = Math.round(amountYuan * ((Math.pow(1 + r, years) - 1) / r) * (1 + r));
    }
    return val;
  }, [safeData]);

  // 最終價值計算 (考慮鎖定成本 與 災難損失)
  // 重大傷病、稅務/債務：固定金額（萬）；市場崩盤：百分比
  const finalDisplayValue = useMemo(() => {
    if (localLocked) {
      return Math.round(baseValue * 0.9);
    }

    switch (activeDisaster) {
      case 'medical':
        return Math.max(0, baseValue - safeData.medicalLoss * 10000);  // 固定金額（萬→元）
      case 'market':
        return Math.round(baseValue * (1 - safeData.marketLoss / 100));  // 百分比
      case 'tax':
        return Math.max(0, baseValue - safeData.taxLoss * 10000);  // 固定金額（萬→元）
      default:
        return baseValue;
    }
  }, [baseValue, localLocked, activeDisaster, safeData.medicalLoss, safeData.marketLoss, safeData.taxLoss]);

  const principal = safeData.mode === 'asset'
    ? safeData.amount * 10000
    : safeData.amount * 10000 * safeData.years;

  // 動畫效果
  useEffect(() => {
    let start = animateValue;
    const end = finalDisplayValue;
    const change = end - start;
    const duration = 500;
    let startTime: number | null = null;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimateValue(Math.round(start + change * ease));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [finalDisplayValue]);

  // 同步鎖定狀態
  useEffect(() => {
    if (localLocked !== safeData.isLocked) {
      setData({ ...safeData, isLocked: localLocked });
    }
    if (localLocked) setActiveDisaster(null);
  }, [localLocked]);

  const handleUpdate = (key: string, value: any) => {
    setData({ ...safeData, [key]: value, isLocked: false });
    setLocalLocked(false);
    setActiveDisaster(null);
  };

  const toggleDisaster = (type: string) => {
    if (localLocked) return;
    // 第一次點擊：顯示資訊彈窗
    // 第二次點擊（已選中）：取消選中
    if (activeDisaster === type) {
      setActiveDisaster(null);
    } else {
      setShowDisasterInfo(type);  // 顯示資訊彈窗
      setActiveDisaster(type);     // 同時觸發災難效果
    }
  };

  const closeDisasterInfo = () => {
    setShowDisasterInfo(null);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20 font-sans">

      {/* Header - 三連點觸發區域 */}
      <div
        className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden cursor-pointer"
        onClick={handleSecretClick}
      >
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <ShieldCheck size={200} />
        </div>
        <div className="relative z-10 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 text-yellow-500 flex items-center gap-3 justify-center md:justify-start">
            <Lock size={36}/> 黃金保險箱理論
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto md:mx-0">
            儲蓄資產壓力測試工具：模擬重大事件對長期儲蓄的可能影響。
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">

        {/* Left: Settings */}
        <div className="lg:col-span-4 space-y-6">
          {/* 路徑選擇 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex">
            <button
              onClick={() => handleUpdate('mode', 'time')}
              className={`flex-1 py-4 rounded-xl flex flex-col items-center gap-2 transition-all ${safeData.mode === 'time' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Hourglass size={24}/>
              <span className="font-bold text-sm">用時間存錢</span>
            </button>
            <button
              onClick={() => handleUpdate('mode', 'asset')}
              className={`flex-1 py-4 rounded-xl flex flex-col items-center gap-2 transition-all ${safeData.mode === 'asset' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Coins size={24}/>
              <span className="font-bold text-sm">用資產存錢</span>
            </button>
          </div>

          {/* 個人資料（年齡 & 年收入） */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-4">
              {/* 年齡 */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 mb-1">年齡</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={tempAge}
                    onChange={(e) => setTempAge(e.target.value === '' ? '' : e.target.value)}
                    onBlur={finalizeAge}
                    onKeyDown={handleKeyDown(finalizeAge)}
                    className="w-full text-xl font-black text-slate-700 text-center bg-white border border-slate-200 rounded-lg py-2 hover:border-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <span className="text-sm text-slate-400">歲</span>
                </div>
              </div>
              {/* 年收入 */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 mb-1">年收入</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={tempAnnualIncome}
                    onChange={(e) => setTempAnnualIncome(e.target.value === '' ? '' : e.target.value)}
                    onBlur={finalizeAnnualIncome}
                    onKeyDown={handleKeyDown(finalizeAnnualIncome)}
                    className="w-full text-xl font-black text-slate-700 text-center bg-white border border-slate-200 rounded-lg py-2 hover:border-slate-400 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <span className="text-sm text-slate-400">萬</span>
                </div>
              </div>
            </div>
          </div>

          {/* 參數設定 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <TrendingUp size={18}/> 設定參數
            </h3>

            {/* 金額輸入 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-500">
                  {safeData.mode === 'time' ? '每年存入金額' : '單筆投入本金'}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={tempAmount}
                    onChange={(e) => setTempAmount(e.target.value === '' ? '' : e.target.value)}
                    onBlur={finalizeAmount}
                    onKeyDown={handleKeyDown(finalizeAmount)}
                    className="w-20 text-xl font-black text-blue-600 text-right bg-transparent border-b-2 border-transparent hover:border-blue-300 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <span className="text-sm text-slate-400">萬</span>
                </div>
              </div>
              <input
                type="range"
                min={1} max={10000} step={1}
                value={safeData.amount}
                onChange={(e) => handleUpdate('amount', Number(e.target.value))}
                className="w-full h-2 bg-blue-100 rounded-lg accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>1萬</span>
                <span>1億</span>
              </div>
            </div>

            {/* 年期輸入 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-500">滾存時間</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={tempYears}
                    onChange={(e) => setTempYears(e.target.value === '' ? '' : e.target.value)}
                    onBlur={finalizeYears}
                    onKeyDown={handleKeyDown(finalizeYears)}
                    className="w-14 text-xl font-black text-emerald-600 text-right bg-transparent border-b-2 border-transparent hover:border-emerald-300 focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                  <span className="text-sm text-slate-400">年</span>
                </div>
              </div>
              <input
                type="range"
                min={5} max={40} step={1}
                value={safeData.years}
                onChange={(e) => handleUpdate('years', Number(e.target.value))}
                className="w-full h-2 bg-emerald-100 rounded-lg accent-emerald-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>5年</span>
                <span>40年</span>
              </div>
            </div>

            {/* 報酬率輸入 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-500">預估年化報酬</label>
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    step={0.1}
                    value={tempRate}
                    onChange={(e) => setTempRate(e.target.value === '' ? '' : e.target.value)}
                    onBlur={finalizeRate}
                    onKeyDown={handleKeyDown(finalizeRate)}
                    className="w-14 text-xl font-black text-purple-600 text-right bg-transparent border-b-2 border-transparent hover:border-purple-300 focus:border-purple-500 focus:outline-none transition-colors"
                  />
                  <span className="text-sm text-slate-400">%</span>
                </div>
              </div>
              <input
                type="range"
                min={3} max={12} step={0.5}
                value={safeData.rate}
                onChange={(e) => handleUpdate('rate', Number(e.target.value))}
                className="w-full h-2 bg-purple-100 rounded-lg accent-purple-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>3%</span>
                <span>12%</span>
              </div>
            </div>
          </div>

          {/* 災難損失參數（進階設定） */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500"/> 壓力測試參數
            </h3>

            {/* 重大傷病損失 */}
            <div className="flex justify-between items-center">
              <label className="text-xs text-slate-500">重大傷病損失</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={tempMedicalLoss}
                  onChange={(e) => setTempMedicalLoss(e.target.value === '' ? '' : e.target.value)}
                  onBlur={finalizeMedicalLoss}
                  onKeyDown={handleKeyDown(finalizeMedicalLoss)}
                  className="w-16 font-bold text-red-600 text-right bg-transparent border-b border-transparent hover:border-red-300 focus:border-red-500 focus:outline-none"
                />
                <span className="text-xs text-slate-400">萬</span>
              </div>
            </div>

            {/* 市場崩盤損失 */}
            <div className="flex justify-between items-center">
              <label className="text-xs text-slate-500">市場崩盤損失</label>
              <div className="flex items-center gap-0.5">
                <input
                  type="number"
                  inputMode="decimal"
                  value={tempMarketLoss}
                  onChange={(e) => setTempMarketLoss(e.target.value === '' ? '' : e.target.value)}
                  onBlur={finalizeMarketLoss}
                  onKeyDown={handleKeyDown(finalizeMarketLoss)}
                  className="w-12 font-bold text-red-600 text-right bg-transparent border-b border-transparent hover:border-red-300 focus:border-red-500 focus:outline-none"
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
            </div>

            {/* 稅務債務損失 */}
            <div className="flex justify-between items-center">
              <label className="text-xs text-slate-500">稅務/債務損失</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={tempTaxLoss}
                  onChange={(e) => setTempTaxLoss(e.target.value === '' ? '' : e.target.value)}
                  onBlur={finalizeTaxLoss}
                  onKeyDown={handleKeyDown(finalizeTaxLoss)}
                  className="w-16 font-bold text-red-600 text-right bg-transparent border-b border-transparent hover:border-red-300 focus:border-red-500 focus:outline-none"
                />
                <span className="text-xs text-slate-400">萬</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: The Vault Visual & Risk Test */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* Visual Area */}
          <div className={`relative flex-1 rounded-3xl p-8 flex flex-col items-center justify-center transition-all duration-500 border-4 ${
            localLocked ? 'bg-slate-900 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.3)]'
            : activeDisaster ? 'bg-red-50 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
            : 'bg-white border-slate-200 shadow-sm'
          }`}>

            {/* Status Badge */}
            <div className={`absolute top-6 right-6 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
              localLocked ? 'bg-yellow-500 text-black'
              : activeDisaster ? 'bg-red-500 text-white animate-pulse'
              : 'bg-slate-100 text-slate-400'
            }`}>
              {localLocked ? 'SECURED / 已上鎖'
                : activeDisaster ? 'WARNING / 資產流失中'
                : 'UNSECURED / 風險敞開'}
            </div>

            {/* Main Icon */}
            <div className="relative mb-8 mt-4">
              <div className={`transition-all duration-700 transform ${localLocked ? 'scale-110' : activeDisaster ? 'scale-90 opacity-80' : 'scale-100'}`}>
                {localLocked ? (
                  <ShieldCheck size={180} className="text-yellow-500" />
                ) : activeDisaster ? (
                  <AlertTriangle size={180} className="text-red-500 animate-bounce" />
                ) : (
                  <Unlock size={180} className="text-slate-300" />
                )}
              </div>

              {/* 上鎖特效 */}
              {localLocked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-full bg-yellow-400/20 rounded-full animate-ping"></div>
                </div>
              )}
            </div>

            {/* Money Display */}
            <div className="text-center space-y-2 z-10">
              <p className={`text-sm font-bold uppercase tracking-widest ${
                localLocked ? 'text-yellow-500' : activeDisaster ? 'text-red-500' : 'text-slate-400'
              }`}>
                {localLocked ? '資產實名制 (已扣除10%保全成本)' : activeDisaster ? '資產遭受重創' : '預估總資產'}
              </p>

              <div className={`text-5xl md:text-7xl font-black font-mono tracking-tighter transition-colors duration-300 ${
                localLocked ? 'text-white' : activeDisaster ? 'text-red-600' : 'text-slate-700'
              }`}>
                {formatMoney(animateValue)}
              </div>

              {/* 損失金額提示 */}
              {activeDisaster && !localLocked && (
                <div className="text-red-500 font-bold bg-red-100 px-3 py-1 rounded-full inline-block animate-pulse">
                  損失: -{formatMoney(baseValue - finalDisplayValue)}
                </div>
              )}

              <div className="flex items-center justify-center gap-4 mt-2 text-sm font-medium opacity-80">
                <span className={localLocked ? 'text-slate-400' : 'text-slate-500'}>
                  本金: {formatMoney(principal)}
                </span>
              </div>
            </div>
          </div>

          {/* --- 壓力測試控制台 --- */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Activity className="text-rose-500"/> 資產壓力測試 (Stress Test)
            </h4>

            <div className="flex flex-col md:flex-row gap-4">

              {/* 災難按鈕群 (左側) */}
              <div className="flex-1 grid grid-cols-3 gap-2">
                <button
                  onClick={() => toggleDisaster('medical')}
                  disabled={localLocked}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                    localLocked ? 'opacity-30 cursor-not-allowed border-slate-100'
                    : activeDisaster === 'medical' ? 'border-red-500 bg-red-50 text-red-600'
                    : 'border-slate-100 hover:border-red-200 text-slate-500 hover:bg-red-50/30'
                  }`}
                >
                  <Activity size={24}/>
                  <span className="text-xs font-bold">重大傷病</span>
                  {!localLocked && <span className="text-[10px] text-red-400">-{safeData.medicalLoss}萬</span>}
                </button>

                <button
                  onClick={() => toggleDisaster('market')}
                  disabled={localLocked}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                    localLocked ? 'opacity-30 cursor-not-allowed border-slate-100'
                    : activeDisaster === 'market' ? 'border-red-500 bg-red-50 text-red-600'
                    : 'border-slate-100 hover:border-red-200 text-slate-500 hover:bg-red-50/30'
                  }`}
                >
                  <TrendingUp size={24} className="rotate-180"/>
                  <span className="text-xs font-bold">市場崩盤</span>
                  {!localLocked && <span className="text-[10px] text-red-400">-{safeData.marketLoss}%</span>}
                </button>

                <button
                  onClick={() => toggleDisaster('tax')}
                  disabled={localLocked}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                    localLocked ? 'opacity-30 cursor-not-allowed border-slate-100'
                    : activeDisaster === 'tax' ? 'border-red-500 bg-red-50 text-red-600'
                    : 'border-slate-100 hover:border-red-200 text-slate-500 hover:bg-red-50/30'
                  }`}
                >
                  <Ban size={24}/>
                  <span className="text-xs font-bold">稅務/債務</span>
                  {!localLocked && <span className="text-[10px] text-red-400">-{safeData.taxLoss}萬</span>}
                </button>
              </div>

              {/* 上鎖按鈕 (右側 - 關鍵行動) */}
              <button
                onClick={() => setLocalLocked(!localLocked)}
                className={`md:w-1/3 px-6 py-4 rounded-xl font-bold text-lg flex flex-col items-center justify-center gap-1 transition-all shadow-xl ${
                  localLocked
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                  : 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white hover:from-yellow-600 hover:to-amber-700 shadow-yellow-200 scale-105'
                }`}
              >
                <div className="flex items-center gap-2">
                  {localLocked ? <Unlock size={20}/> : <Lock size={20}/>}
                  <span>{localLocked ? '解除鎖定' : '立即上鎖'}</span>
                </div>
                {!localLocked && <span className="text-xs opacity-90 font-normal">只需提撥 10% 成本</span>}
              </button>

            </div>

            {/* 互動反饋訊息 */}
            <div className="mt-4 text-center h-6">
              {localLocked ? (
                <p className="text-sm font-bold text-emerald-600 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                  <ShieldCheck size={16}/>
                  防護網已啟動！無論發生什麼災難，您的 {formatMoney(Math.round(baseValue * 0.9))} 資產都將毫髮無傷。
                </p>
              ) : activeDisaster ? (
                <p className="text-sm font-bold text-red-500 flex items-center justify-center gap-2 animate-bounce">
                  <AlertTriangle size={16}/>
                  警報！您的保險箱門戶大開，資產正在流失給醫生或政府！
                </p>
              ) : (
                <p className="text-sm text-slate-400">
                  試試看點擊左側災難，看看您的資產是否安全？
                </p>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* ============================================ */}
      {/* 業務小抄 Modal */}
      {/* ============================================ */}
      {showCheatSheet && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-500 to-amber-600 p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Lock size={20} />
                <span className="font-bold">黃金保險箱理論 - 業務小抄</span>
                {isPaidMember && <Crown size={16} className="text-yellow-200" />}
              </div>
              <button onClick={() => setShowCheatSheet(false)} className="hover:bg-white/20 p-1 rounded">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {isPaidMember ? (
                <div className="space-y-6">
                  {/* 概念說明 */}
                  <div>
                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm">1</span>
                      概念說明
                    </h3>
                    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg">
                      <p className="text-slate-700 leading-relaxed mb-3">
                        本工具為「儲蓄資產壓力測試」之教育情境模擬，協助使用者觀察重大事件（醫療、市場波動、稅務）對長期儲蓄的可能影響。
                      </p>
                      <p className="text-slate-600 leading-relaxed text-sm">
                        模擬結果為情境假設，並非真實發生機率；資產配置策略應由本人或合格顧問依個人狀況評估。
                      </p>
                    </div>
                  </div>

                  {/* 兩種儲蓄結構 */}
                  <div>
                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm">2</span>
                      兩種儲蓄結構
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 p-4 rounded-lg text-center">
                        <p className="font-bold text-blue-700 mb-2">單筆投入</p>
                        <p className="text-slate-600 text-sm">
                          一次投入較大本金，<br/>
                          以複利累積
                        </p>
                      </div>
                      <div className="bg-emerald-50 p-4 rounded-lg text-center">
                        <p className="font-bold text-emerald-700 mb-2">定期投入</p>
                        <p className="text-slate-600 text-sm">
                          每年固定金額，<br/>
                          長期累積
                        </p>
                      </div>
                    </div>
                    <p className="text-slate-500 text-xs mt-2 leading-relaxed">
                      兩種方式之風險屬性、流動性、稅務效果不同，無絕對優劣，須依個人現金流規劃選擇。
                    </p>
                  </div>

                  {/* 三類風險事件（中性說明） */}
                  <div>
                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm">3</span>
                      三類常見風險事件
                    </h3>
                    <div className="space-y-2">
                      <div className="bg-slate-50 p-3 rounded-lg flex items-start gap-3 border border-slate-200">
                        <span className="text-2xl">🏥</span>
                        <div>
                          <p className="font-bold text-slate-700">重大傷病與長期照顧</p>
                          <p className="text-slate-600 text-sm">
                            若發生需高額自費醫療或長期照護之情形，自有資金可能須部分變現以支應開支。商業保險（醫療險、重大傷病險、長照險）為常見之風險移轉工具。
                          </p>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg flex items-start gap-3 border border-slate-200">
                        <span className="text-2xl">📉</span>
                        <div>
                          <p className="font-bold text-slate-700">市場波動</p>
                          <p className="text-slate-600 text-sm">
                            股票市場長期報酬正向，但歷史上曾出現單年回撤達 30-50% 的情形（如 2000、2008）。資產配置之風險屬性與時間軸應一併考量。
                          </p>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg flex items-start gap-3 border border-slate-200">
                        <span className="text-2xl">🏛️</span>
                        <div>
                          <p className="font-bold text-slate-700">稅務與債務</p>
                          <p className="text-slate-600 text-sm">
                            遺產稅、贈與稅、所得稅依現行稅法規定計算；個人債務、強制執行依《強制執行法》辦理。提前規劃可降低事件發生時之流動性壓力。
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 規劃考量 */}
                  <div>
                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-sm">4</span>
                      規劃考量點
                    </h3>
                    <div className="bg-emerald-50 p-4 rounded-lg border-l-4 border-emerald-500">
                      <ul className="text-slate-700 text-sm space-y-2 list-disc pl-5">
                        <li>整體財務目標（短／中／長期）</li>
                        <li>家庭責任與被扶養人狀況</li>
                        <li>風險承受度（投資波動可接受範圍）</li>
                        <li>既有保障與既有資產配置缺口</li>
                        <li>稅務狀況與遺產規劃需求</li>
                      </ul>
                      <p className="text-slate-500 text-xs mt-3">
                        以上為討論面向，非銷售清單；建議與合格財務顧問或保險業務員逐項討論。
                      </p>
                    </div>
                  </div>

                  {/* 提醒 */}
                  <div>
                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 bg-slate-500 text-white rounded-full flex items-center justify-center text-sm">5</span>
                      提醒
                    </h3>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-600 leading-relaxed">
                      本工具為教育目的之情境模擬，不構成投資、保險、稅務或法律建議。實際規劃涉及個人狀況差異，請諮詢合格之財務顧問、保險業務員、稅務代理人或律師。
                    </div>
                  </div>
                </div>
              ) : (
                /* 非付費會員鎖定畫面 */
                <div className="flex flex-col items-center justify-center py-12">
                  <Lock size={64} className="text-slate-300 mb-4" />
                  <p className="text-lg font-bold text-slate-700 mb-2">業務小抄為付費會員專屬</p>
                  <p className="text-slate-500 text-center mb-6">
                    升級付費會員，解鎖完整話術與銷售技巧
                  </p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <p className="text-yellow-700 text-sm">
                      包含：核心觀念、開場話術、壓力測試引導、結案話術、常見問答
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* 災難資訊彈窗 */}
      {/* ============================================ */}
      {showDisasterInfo && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeDisasterInfo}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 重大傷病資訊 */}
            {showDisasterInfo === 'medical' && (
              <>
                <div className="bg-gradient-to-r from-red-500 to-rose-600 p-4 text-white">
                  <div className="flex items-center gap-2">
                    <Activity size={24} />
                    <span className="font-bold text-lg">重大傷病風險</span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="text-center">
                    <p className="text-5xl font-black text-red-600 mb-2">3分48秒</p>
                    <p className="text-slate-600">台灣每 3 分 48 秒就有 1 人罹癌</p>
                    <p className="text-slate-500 text-sm mt-1">每 23 人就有 1 位重大傷病患者</p>
                    <p className="text-xs text-slate-400 mt-1">資料來源：衛福部國健署 2025 癌症登記報告</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-slate-700">
                      <span className="font-bold text-red-600">癌症治療費用：</span>平均 100-300 萬
                    </p>
                    <p className="text-sm text-slate-700">
                      <span className="font-bold text-red-600">看護費用：</span>每月 6-8 萬 × 24個月 = <span className="font-bold text-red-700">{formatMoney(7 * 24 * 10000)}</span>
                    </p>
                    <p className="text-sm text-slate-700">
                      <span className="font-bold text-red-600">收入中斷：</span>年收入 {safeData.annualIncome} 萬 × 2年 = <span className="font-bold text-red-700">{formatMoney(safeData.annualIncome * 2 * 10000)}</span>
                    </p>
                  </div>
                  {/* 個人化損失計算 */}
                  <div className="bg-slate-800 rounded-lg p-4 text-white">
                    <p className="text-xs text-slate-400 mb-2">以您的年收入估算總損失</p>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300">醫療 + 看護 + 收入中斷</span>
                      <span className="text-2xl font-black text-red-400">
                        {formatMoney((200 + 7*24 + safeData.annualIncome * 2) * 10000)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      = 治療費 200萬 + 看護費 {7*24}萬 + 收入損失 {safeData.annualIncome * 2}萬
                    </p>
                  </div>
                  <button
                    onClick={closeDisasterInfo}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-600 transition-colors"
                  >
                    我了解了
                  </button>
                </div>
              </>
            )}

            {/* 市場崩盤資訊 */}
            {showDisasterInfo === 'market' && (
              <>
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-4 text-white">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={24} className="rotate-180" />
                    <span className="font-bold text-lg">市場崩盤風險</span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="text-center">
                    <p className="text-5xl font-black text-orange-600 mb-2">-30%~50%</p>
                    <p className="text-slate-600">歷史重大股災平均跌幅</p>
                    <p className="text-slate-500 text-sm mt-1">平均每 7-10 年發生一次重大股災</p>
                    <p className="text-orange-600 font-bold text-sm mt-2">你的現金流能穩住生活嗎？</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-slate-700">
                      <span className="font-bold text-orange-600">2008 金融海嘯：</span>台股跌 46%
                    </p>
                    <p className="text-sm text-slate-700">
                      <span className="font-bold text-orange-600">2020 疫情崩盤：</span>台股跌 30%
                    </p>
                    <p className="text-sm text-slate-700">
                      <span className="font-bold text-orange-600">2022 升息衝擊：</span>台股跌 28%
                    </p>
                  </div>
                  <button
                    onClick={closeDisasterInfo}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-600 transition-colors"
                  >
                    我了解了
                  </button>
                </div>
              </>
            )}

            {/* 稅務/債務資訊 */}
            {showDisasterInfo === 'tax' && (
              <>
                <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-4 text-white">
                  <div className="flex items-center gap-2">
                    <Ban size={24} />
                    <span className="font-bold text-lg">稅務/債務風險</span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="text-center">
                    <p className="text-4xl font-black text-purple-600 mb-2">遺產稅課稅級距</p>
                    <p className="text-slate-500 text-sm">免稅額：1,333 萬</p>
                  </div>
                  {/* 遺產稅級距表 */}
                  <div className="bg-purple-50 rounded-lg p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-purple-200">
                          <th className="text-left py-2 text-purple-700">課稅級距</th>
                          <th className="text-right py-2 text-purple-700">稅率</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-700">
                        <tr className="border-b border-purple-100">
                          <td className="py-2">5,621 萬以下</td>
                          <td className="text-right font-bold text-purple-600">10%</td>
                        </tr>
                        <tr className="border-b border-purple-100">
                          <td className="py-2">超過 5,621 萬～1 億 1,242 萬</td>
                          <td className="text-right font-bold text-purple-600">15%</td>
                        </tr>
                        <tr>
                          <td className="py-2">超過 1 億 1,242 萬</td>
                          <td className="text-right font-bold text-purple-600">20%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-slate-100 rounded-lg p-3 text-center">
                    <p className="text-sm text-slate-600">
                      <span className="font-bold text-slate-700">債務追討：</span>依法強制執行，無法拒絕
                    </p>
                  </div>
                  <button
                    onClick={closeDisasterInfo}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-600 transition-colors"
                  >
                    我了解了
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sprint 9 A — 客戶端分享連結（與 Sprint 5 ShareButton 並列；本工具尚無 ShareButton，
          先佔位讓未來補上時排版一致）。payload 對齊 GoldenSafeVaultPayload schema。
          why 三個 *After 在 share 時就地重算、不從 finalDisplayValue 拿：
            finalDisplayValue / localLocked / activeDisaster 是顧問端互動的 transient
            state，分享出去的 readonly 報告應永遠展示「四種狀態同框對比」，不能被當下
            點到哪顆按鈕綁架（Sprint 7 PII lock down 原則 — payload 即真相，不夾帶
            UI session 狀態）。 */}
      <div className="flex flex-wrap justify-end gap-3 pt-1">
        <ShareToCustomerButton
          tool="golden_safe_vault"
          reportLabel="黃金保險箱"
          inputs={{
            mode: safeData.mode,
            amount: safeData.amount,
            years: safeData.years,
            rate: safeData.rate,
            age: safeData.age,
            annualIncome: safeData.annualIncome,
            medicalLoss: safeData.medicalLoss,
            marketLoss: safeData.marketLoss,
            taxLoss: safeData.taxLoss,
          }}
          outputs={{
            baseValue,
            principal,
            lockedValue: Math.round(baseValue * 0.9),
            // medicalLoss / taxLoss 是固定金額（萬→元）；marketLoss 是百分比
            medicalAfter: Math.max(0, baseValue - safeData.medicalLoss * 10000),
            marketAfter: Math.round(baseValue * (1 - safeData.marketLoss / 100)),
            taxAfter: Math.max(0, baseValue - safeData.taxLoss * 10000),
          }}
        />
      </div>

      <DisclaimerFooter scope="insurance" />
    </div>
  );
}
