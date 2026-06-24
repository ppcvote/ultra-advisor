import React, { useState, useMemo, useEffect } from 'react';
import { 
  Umbrella, 
  Calculator, 
  AlertTriangle, 
  Clock, 
  Smile, 
  Frown, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  TrendingUp, // 新增圖示
  Percent     // 新增圖示
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine } from 'recharts';
import DisclaimerFooter from './DisclaimerFooter';
import ShareButton from './ShareButton';
import ShareToCustomerButton from './ShareToCustomerButton';
import { auth } from '../firebase';
import ClientDataPanel from './ClientDataPanel';

export const LaborPensionTool = ({ data, setData }: any) => {
  const safeData = {
    currentAge: Number(data?.currentAge) || 30,
    retireAge: Number(data?.retireAge) || 65,
    salary: Number(data?.salary) || 45000,
    laborInsYears: Number(data?.laborInsYears) || 35, 
    selfContribution: Boolean(data?.selfContribution),
    pensionReturnRate: Number(data?.pensionReturnRate) || 3, 
    desiredMonthlyIncome: Number(data?.desiredMonthlyIncome) || 60000,
    inflationRate: data?.inflationRate !== undefined ? Number(data.inflationRate) : 2.5, // 預設通膨 2.5%
    pensionDiscount: data?.pensionDiscount !== undefined ? Number(data.pensionDiscount) : 70 // 預設勞保 70%
  };
  const { currentAge, retireAge, salary, laborInsYears, selfContribution, pensionReturnRate, desiredMonthlyIncome, inflationRate, pensionDiscount } = safeData;

  // --- Local State for Inputs ---
  const [tempCurrentAge, setTempCurrentAge] = useState<string | number>(currentAge);
  const [tempRetireAge, setTempRetireAge] = useState<string | number>(retireAge);
  const [tempSalary, setTempSalary] = useState<string | number>(salary);

  // 同步外部數據
  useEffect(() => { setTempCurrentAge(currentAge); }, [currentAge]);
  useEffect(() => { setTempRetireAge(retireAge); }, [retireAge]);
  useEffect(() => { setTempSalary(salary); }, [salary]);

  // --- 計算核心 (已植入通膨與打折邏輯) ---
  const calculations = useMemo(() => {
      // 0. 時間參數
      const yearsToRetire = Math.max(0, retireAge - currentAge);
      const monthsToInvest = yearsToRetire * 12;

      // [核心變更 1] 真實需求：考慮通膨後的未來終值 (FV)
      // FV = PV * (1 + r)^n
      const inflationMultiplier = Math.pow(1 + inflationRate / 100, yearsToRetire);
      const futureDesiredIncome = Math.round(desiredMonthlyIncome * inflationMultiplier);

      // 1. 勞保年金 (Labor Insurance)
      // 上限／下限級距假設跟著通膨調整（歷史上 16 年 +52% ≈ 2.6% 年化，接近通膨）。
      // 不調的話會：需求用未來幣值、保費基數用今天幣值 → 缺口被系統性高估。
      const maxLaborInsSalary = Math.round(45800 * inflationMultiplier);
      const minLaborInsSalary = Math.round(26400 * inflationMultiplier);
      const projectedSalary = Math.round(salary * inflationMultiplier);
      const laborInsBase = Math.min(Math.max(projectedSalary, minLaborInsSalary), maxLaborInsSalary);
      const rawLaborInsMonthly = Math.round(laborInsBase * laborInsYears * 0.0155);
      
      // [核心變更 2] 勞保打折模擬
      const laborInsMonthly = Math.round(rawLaborInsMonthly * (pensionDiscount / 100));

      // 2. 勞退新制 (Labor Pension)
      // 勞退提撥工資上限：歷年隨基本工資調整，假設跟通膨成長。
      const maxPensionBase = Math.round(150000 * inflationMultiplier);
      // 提撥基數以「成長型年金」處理：起始用今天薪資、每月成長 g_m。
      // 比「今天的薪資撐 35 年」更接近實況（薪資會通膨成長），
      // 也比「直接套用未來薪資」少了天上掉錢的假設。
      const startPensionBase = Math.min(salary, 150000);
      const contributionRate = 0.06 + (selfContribution ? 0.06 : 0);
      const startMonthlyContribution = Math.round(startPensionBase * contributionRate);

      const monthlyRate = pensionReturnRate / 100 / 12;
      const monthlyInflation = (inflationRate / 100) / 12;

      // FV of growing annuity（成長型年金）— 若 r ≈ g 走 L'Hôpital 極限版本
      const epsilon = 1e-9;
      const pensionFutureValue = monthsToInvest === 0
        ? 0
        : (Math.abs(monthlyRate - monthlyInflation) < epsilon)
          ? startMonthlyContribution * monthsToInvest * Math.pow(1 + monthlyRate, monthsToInvest - 1)
          : startMonthlyContribution * (Math.pow(1 + monthlyRate, monthsToInvest) - Math.pow(1 + monthlyInflation, monthsToInvest)) / (monthlyRate - monthlyInflation);

      // 假設退休後餘命 20 年 (240個月) 領完
      const pensionMonthly = Math.min(maxPensionBase * 12, Math.round(pensionFutureValue / 240));

      // 3. 自提節稅效益（每年現值估算，不通膨）
      const annualTaxSaving = selfContribution ? Math.round(startPensionBase * 0.06 * 12 * 0.05) : 0;

      // 4. 缺口計算 (使用通膨後的真實需求來減)
      const totalPension = laborInsMonthly + pensionMonthly;
      const gap = Math.max(0, futureDesiredIncome - totalPension);

      // 5. 延遲成本 (計算基礎也隨之變大)
      const investRateForGap = 0.06 / 12;
      const targetGapFund = gap * 240;

      // gap=0 (退休金已夠) 或 monthsToInvest=0 (今年就退休)：不需再存
      const annuityFactor = (months: number) =>
        months > 0 ? (Math.pow(1 + investRateForGap, months) - 1) : 0;

      const monthlySaveNow = (targetGapFund > 0 && monthsToInvest > 0)
        ? Math.round(targetGapFund * investRateForGap / annuityFactor(monthsToInvest))
        : 0;

      const monthsToInvestLater = (yearsToRetire - 10) * 12;
      const monthlySaveLater = (targetGapFund > 0 && monthsToInvestLater > 0)
        ? Math.round(targetGapFund * investRateForGap / annuityFactor(monthsToInvestLater))
        : 0;

      return {
          futureDesiredIncome, // 回傳未來需求
          laborInsMonthly,
          pensionMonthly,
          totalPension,
          gap,
          annualTaxSaving,
          monthlySaveNow,
          monthlySaveLater,
          yearsToRetire
      };
  }, [salary, laborInsYears, selfContribution, pensionReturnRate, currentAge, retireAge, desiredMonthlyIncome, inflationRate, pensionDiscount]);

  const chartData = [
    {
      name: '退休金結構',
      勞保年金: calculations.laborInsMonthly,
      勞退月領: calculations.pensionMonthly,
      財務缺口: calculations.gap,
    }
  ];

  // --- UI Handlers ---
  const updateField = (field: string, value: number) => { 
      setData({ ...safeData, [field]: value }); 
  };

  const handleSalaryInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      setTempSalary(e.target.value === '' ? '' : Number(e.target.value));
  };

  const finalizeSalary = () => {
      let finalVal = Number(tempSalary) || 26400; 
      finalVal = Math.max(26400, Math.min(500000, finalVal)); 
      setData({ ...safeData, salary: finalVal });
      setTempSalary(finalVal);
  };

  const handleAgeInput = (field: 'currentAge' | 'retireAge', val: string) => {
      if (field === 'currentAge') setTempCurrentAge(val === '' ? '' : Number(val));
      else setTempRetireAge(val === '' ? '' : Number(val));
  };

  const finalizeAge = (field: 'currentAge' | 'retireAge') => {
      if (field === 'currentAge') {
          let val = Number(tempCurrentAge) || 18;
          val = Math.max(18, Math.min(retireAge - 1, val));
          setData({ ...safeData, currentAge: val });
          setTempCurrentAge(val);
      } else {
          let val = Number(tempRetireAge) || 65;
          val = Math.max(currentAge + 1, Math.min(80, val));
          setData({ ...safeData, retireAge: val });
          setTempRetireAge(val);
      }
  };

  return (
    <div className="space-y-8 animate-fade-in font-sans text-slate-800">
      
      {/* Header Section */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden print-break-inside">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <Umbrella size={180} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase backdrop-blur-sm">
              Retirement Planning
            </span>
            <span className="bg-slate-400/20 text-slate-100 px-3 py-1 rounded-full text-xs font-bold tracking-wider backdrop-blur-sm border border-slate-400/30">
              通膨 + 勞保折算
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-2 tracking-tight flex items-center gap-3">
            退休缺口試算
          </h1>
          <p className="text-slate-300 text-lg opacity-90 max-w-2xl">
            將 <span className="text-yellow-400 font-bold">通膨</span> 與 <span className="text-amber-300 font-bold">勞保打折</span> 因子納入試算，呈現未來幣值下的退休所得結構與缺口。
          </p>
        </div>
      </div>

      {/* Sprint 6 — 主動帶入 active client profile（年齡/退休年齡/月薪）。
          只在 activeClient 有資料時渲染、不自動覆蓋顧問正在算的東西。
          Clamp 範圍與下方 finalize* handler 一致，避免 slider 出界。 */}
      <ClientDataPanel
        mapping={{
          age: {
            toolField: 'currentAge',
            label: '目前年齡',
            setter: (v) => {
              const n = Math.max(18, Math.min(retireAge - 1, Number(v) || currentAge));
              setData({ ...safeData, currentAge: n });
              setTempCurrentAge(n);
            },
          },
          retirementAge: {
            toolField: 'retireAge',
            label: '預計退休年齡',
            setter: (v) => {
              const n = Math.max(currentAge + 1, Math.min(80, Number(v) || retireAge));
              setData({ ...safeData, retireAge: n });
              setTempRetireAge(n);
            },
          },
          monthlyIncome: {
            toolField: 'salary',
            label: '月薪',
            setter: (v) => {
              const n = Math.max(26400, Math.min(500000, Number(v) || salary));
              setData({ ...safeData, salary: n });
              setTempSalary(n);
            },
          },
        }}
      />

      <div className="grid lg:grid-cols-12 gap-8">
        {/* 左側：參數設定 */}
        <div className="lg:col-span-4 space-y-6 print-break-inside">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 no-print">
            <h4 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
              <Calculator size={20} className="text-slate-600"/> 
              個人參數
            </h4>
            <div className="space-y-6">
               
               {/* 年齡設定 */}
               <div className="grid grid-cols-2 gap-4">
                   <div>
                       <label className="text-xs font-bold text-slate-500 mb-1 block">目前年齡</label>
                       <div className="relative">
                           <input 
                               type="number" 
                               value={tempCurrentAge.toString()} 
                               onChange={(e) => handleAgeInput('currentAge', e.target.value)}
                               onBlur={() => finalizeAge('currentAge')}
                               className="w-full p-2 border rounded-lg font-bold text-slate-700 bg-slate-50 border-slate-200" 
                           />
                           <span className="absolute right-3 top-2 text-slate-400 text-xs">歲</span>
                       </div>
                   </div>
                   <div>
                       <label className="text-xs font-bold text-slate-500 mb-1 block">預計退休</label>
                       <div className="relative">
                           <input 
                               type="number" 
                               value={tempRetireAge.toString()} 
                               onChange={(e) => handleAgeInput('retireAge', e.target.value)}
                               onBlur={() => finalizeAge('retireAge')}
                               className="w-full p-2 border rounded-lg font-bold text-blue-600 bg-blue-50 border-blue-200" 
                           />
                           <span className="absolute right-3 top-2 text-slate-400 text-xs">歲</span>
                       </div>
                   </div>
               </div>

               {/* 薪資輸入 */}
               <div>
                   <div className="flex justify-between items-center mb-2">
                       <label className="text-sm font-medium text-slate-600">目前月薪</label>
                       <div className="flex items-center">
                           <span className="font-bold text-slate-500 mr-1 text-sm">$</span>
                           <input 
                               type="number"
                               min={26400}
                               max={500000}
                               step={100}
                               value={tempSalary.toString()}
                               onChange={handleSalaryInput}
                               onBlur={finalizeSalary}
                               onKeyDown={(e) => { if (e.key === 'Enter') { finalizeSalary(); e.currentTarget.blur(); } }}
                               className="w-28 text-right bg-transparent border-none p-0 font-mono font-bold text-slate-700 text-lg focus:ring-0 focus:bg-slate-100 rounded"
                           />
                       </div>
                   </div>
                   <input 
                       type="range" 
                       min={20000} 
                       max={500000} 
                       step={1000} 
                       value={salary} 
                       onChange={(e) => updateField('salary', Number(e.target.value))} 
                       className="w-full h-2 bg-slate-200 rounded-lg accent-slate-600" 
                   />
               </div>

               {/* 勞保年資 */}
               <div>
                   <div className="flex justify-between items-center mb-2">
                       <label className="text-sm font-medium text-slate-600">預計勞保年資</label>
                       <span className="font-mono font-bold text-slate-700 text-lg">{laborInsYears} 年</span>
                   </div>
                   <input 
                     type="range" 
                     min={15} 
                     max={60} 
                     step={1} 
                     value={laborInsYears} 
                     onChange={(e) => updateField('laborInsYears', Number(e.target.value))} 
                     className="w-full h-2 bg-slate-200 rounded-lg accent-slate-600" 
                   />
               </div>

               {/* 理想退休金 */}
               <div className="pt-4 border-t border-slate-100">
                   <div className="flex justify-between items-center mb-2">
                       <label className="text-sm font-bold text-rose-600 flex items-center gap-1"><Smile size={14}/> 理想退休月薪 (現值)</label>
                       <span className="font-mono font-bold text-rose-600 text-lg">${desiredMonthlyIncome.toLocaleString()}</span>
                   </div>
                   <input type="range" min={30000} max={150000} step={2000} value={desiredMonthlyIncome} onChange={(e) => updateField('desiredMonthlyIncome', Number(e.target.value))} className="w-full h-2 bg-rose-100 rounded-lg accent-rose-500" />
               </div>

               {/* [新增區塊] 隱藏風險因子 */}
               <div className="pt-4 border-t border-slate-100 space-y-4">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle size={12}/> 隱藏風險因子 (Reality Check)
                  </h5>
                  
                  {/* 通膨率 */}
                  <div>
                     <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><TrendingUp size={12}/> 預估年通膨率</label>
                        <span className="font-mono font-bold text-slate-700 text-sm">{inflationRate}%</span>
                     </div>
                     <input type="range" min={0} max={5} step={0.5} value={inflationRate} onChange={(e) => updateField('inflationRate', Number(e.target.value))} className="w-full h-2 bg-yellow-100 rounded-lg accent-yellow-500" />
                     <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                        <span>0% (不可能)</span>
                        <span>2.5% (平均)</span>
                        <span>5% (惡性)</span>
                     </div>
                  </div>

                  {/* 勞保打折 */}
                  <div>
                     <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><Percent size={12}/> 勞保預期給付率</label>
                        <span className={`font-mono font-bold text-sm ${pensionDiscount < 100 ? 'text-rose-600' : 'text-emerald-600'}`}>{pensionDiscount}%</span>
                     </div>
                     <input type="range" min={50} max={100} step={5} value={pensionDiscount} onChange={(e) => updateField('pensionDiscount', Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg accent-slate-500" />
                     <div className="text-[10px] text-slate-400 mt-1 text-right">
                        {pensionDiscount === 100 ? '樂觀: 不破產' : '悲觀: 年金改革縮水'}
                     </div>
                  </div>
               </div>

               {/* 勞退自提開關 */}
               <div className={`p-4 rounded-xl border transition-all ${selfContribution ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                      <div>
                          <span className={`block font-bold ${selfContribution ? 'text-emerald-700' : 'text-slate-600'}`}>勞退自提 6%</span>
                          <span className="text-xs text-slate-500">強迫儲蓄 + 節稅</span>
                      </div>
                      <button 
                        onClick={() => setData({ ...safeData, selfContribution: !selfContribution })} 
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${selfContribution ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${selfContribution ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                  </div>
                  {selfContribution && (
                      <div className="mt-2 text-xs text-emerald-600 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                          <CheckCircle2 size={12}/> 預估年省稅金 ${calculations.annualTaxSaving.toLocaleString()}
                      </div>
                  )}
               </div>

            </div>
          </div>
        </div>

        {/* 右側：金字塔分析 */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* 金字塔圖表 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-[450px] print-break-inside relative flex flex-col md:flex-row gap-6">
             {/* Chart Area */}
             <div className="flex-1 h-full relative">
                <div className="flex justify-between items-center mb-4 pl-2 border-l-4 border-rose-500">
                    <div>
                      <h4 className="font-bold text-slate-700">退休金結構 (未來價值)</h4>
                      <div className="text-xs text-rose-500 font-bold mt-0.5 flex items-center gap-1">
                         <AlertTriangle size={10}/> 已計入通膨 {inflationRate}% 與勞保打 {pensionDiscount/10} 折
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">單位：新台幣/月</span>
                </div>
                <ResponsiveContainer width="100%" height="85%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={false} axisLine={false} />
                        <YAxis unit="元" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <Tooltip 
                            cursor={{fill: 'transparent'}}
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px'}}
                            formatter={(value: number) => `$${value.toLocaleString()}`}
                        />
                        <Legend />
                        <ReferenceLine y={calculations.futureDesiredIncome} stroke="#e11d48" strokeDasharray="3 3" label={{ position: 'right', value: '真實需求(通膨後)', fill: '#e11d48', fontSize: 12, fontWeight: 'bold' }} />
                        
                        {/* Stacked Bars simulating a Pyramid hierarchy */}
                        <Bar dataKey="財務缺口" stackId="a" fill="#f43f5e" barSize={80} name="缺口 (需自行準備)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="勞退月領" stackId="a" fill={selfContribution ? "#10b981" : "#3b82f6"} barSize={100} name={selfContribution ? "勞退 (含自提)" : "勞退 (僅雇主)"} />
                        <Bar dataKey="勞保年金" stackId="a" fill="#94a3b8" barSize={120} name="勞保年金 (打折後)" radius={[0, 0, 4, 4]} />
                    </BarChart>
                </ResponsiveContainer>
             </div>

             {/* Info Column */}
             <div className="md:w-1/3 flex flex-col justify-center space-y-4">
                 
                 {/* Gap Card */}
                 <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 text-center animate-pulse-soft">
                     <div className="flex items-center justify-center gap-2 mb-1">
                         <AlertTriangle size={18} className="text-rose-500"/>
                         <span className="text-sm font-bold text-rose-800">真實每月缺口</span>
                     </div>
                     <p className="text-3xl font-black text-rose-600 font-mono">
                         ${calculations.gap.toLocaleString()}
                     </p>
                     <p className="text-xs text-rose-400 mt-2">目標金額因通膨增至 <br/> <span className="font-bold underline">${calculations.futureDesiredIncome.toLocaleString()}</span> /月</p>
                 </div>

                 {/* Coverage Stats */}
                 <div className="space-y-2">
                     <div className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-lg">
                         <span className="text-slate-500">政府給付總和</span>
                         <span className="font-bold text-slate-700">${calculations.totalPension.toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-lg">
                         <span className="text-slate-500">實際所得替代率</span>
                         <span className="font-bold text-blue-600">{Math.round(calculations.totalPension / calculations.futureDesiredIncome * 100)}%</span>
                     </div>
                 </div>

             </div>
          </div>

          {/* 分享給客戶：兩種選擇並列、用途不同：
              - ShareButton（摘要）：text → LINE，客戶看到一句缺口數字（Sprint 5 既有）
              - ShareToCustomerButton（連結）：產生 /r/labor-pension URL → 客戶 click 看完整 readonly 視覺
              鐵則：annualTaxSaving / pensionReturnRate 不放進客戶 payload — viewer schema 不接、且節稅話術合規敏感（Sprint 5 已下架）
          */}
          <div className="flex flex-wrap justify-end gap-3">
            <ShareButton
              variant="full"
              title="退休缺口試算"
              text={`【退休缺口試算】${currentAge} → ${retireAge} 歲 / 理想月薪 $${desiredMonthlyIncome.toLocaleString()} — 通膨後每月缺口 $${calculations.gap.toLocaleString()}`}
            />
            <ShareToCustomerButton
              tool="labor_pension"
              reportLabel="退休缺口分析"
              inputs={{
                currentAge,
                retireAge,
                salary,
                laborInsYears,
                selfContribution,
                desiredMonthlyIncome,
                inflationRate,
                pensionDiscount,
              }}
              outputs={{
                futureDesiredIncome: calculations.futureDesiredIncome,
                laborInsMonthly: calculations.laborInsMonthly,
                pensionMonthly: calculations.pensionMonthly,
                totalPension: calculations.totalPension,
                gap: calculations.gap,
                monthlySaveNow: calculations.monthlySaveNow,
                monthlySaveLater: calculations.monthlySaveLater,
                yearsToRetire: calculations.yearsToRetire,
              }}
            />
          </div>

          {/* 生活品質預覽 (Lifestyle Preview) */}
          <div className="grid md:grid-cols-2 gap-6">
              {/* 現狀 */}
              <div className="bg-slate-100 rounded-2xl p-5 border border-slate-200 opacity-70 grayscale hover:grayscale-0 transition-all duration-300">
                  <div className="flex justify-between items-start mb-4">
                      <div className="bg-slate-300 text-white px-2 py-1 rounded text-xs font-bold">現狀預估</div>
                      <Frown size={32} className="text-slate-400"/>
                  </div>
                  <p className="text-2xl font-bold text-slate-600 mb-1">${calculations.totalPension.toLocaleString()} <span className="text-sm font-normal">/月</span></p>
                  <p className="text-sm text-slate-500 font-bold mb-4">下流老人風險</p>
                  <ul className="text-xs text-slate-500 space-y-2">
                      <li className="flex gap-2"><span className="text-slate-400">●</span> 僅能應付 {Math.round(calculations.totalPension / calculations.futureDesiredIncome * 100)}% 的生活開銷</li>
                      <li className="flex gap-2"><span className="text-slate-400">●</span> 勞保打折後，醫療支出將成重擔</li>
                      <li className="flex gap-2"><span className="text-slate-400">●</span> 無法抵抗通膨帶來的資產縮水</li>
                  </ul>
              </div>

              {/* 理想 */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-100 shadow-md">
                  <div className="flex justify-between items-start mb-4">
                      <div className="bg-emerald-500 text-white px-2 py-1 rounded text-xs font-bold">理想目標 (未來值)</div>
                      <Smile size={32} className="text-emerald-500"/>
                  </div>
                  <p className="text-2xl font-bold text-emerald-700 mb-1">${calculations.futureDesiredIncome.toLocaleString()} <span className="text-sm font-normal">/月</span></p>
                  <p className="text-sm text-emerald-600 font-bold mb-4">尊嚴抗通膨型</p>
                  <ul className="text-xs text-emerald-700/80 space-y-2">
                      <li className="flex gap-2"><CheckCircle2 size={14} className="text-emerald-500"/> 購買力維持，便當漲價也不怕</li>
                      <li className="flex gap-2"><CheckCircle2 size={14} className="text-emerald-500"/> 已考慮 {calculations.yearsToRetire} 年後的物價水準</li>
                      <li className="flex gap-2"><CheckCircle2 size={14} className="text-emerald-500"/> 擁有高品質醫療照護能力</li>
                  </ul>
              </div>
          </div>

        </div>
      </div>
      
      {/* 底部策略區：延遲成本與總結 */}
      <div className="grid md:grid-cols-2 gap-8 pt-6 border-t border-slate-200 print-break-inside">
        
        {/* 1. 延遲成本 (急迫性) */}
        <div className="space-y-4 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2">
             <Clock className="text-rose-500" size={24} />
             <h3 className="text-xl font-bold text-slate-800">時間就是金錢：延遲成本分析</h3>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-sm text-slate-500 mb-4">為了補足 <strong>${calculations.gap.toLocaleString()}</strong> 的真實缺口，您需要每月投資：</p>
              
              <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1">
                      <div className="text-xs text-emerald-600 font-bold mb-1">現在開始</div>
                      <div className="h-10 bg-emerald-100 rounded-lg flex items-center px-3 border border-emerald-200">
                          <span className="font-mono font-bold text-emerald-700 text-lg">${calculations.monthlySaveNow.toLocaleString()}</span>
                      </div>
                  </div>
                  <ArrowRight className="text-slate-300" />
                  <div className="flex-1">
                      <div className="text-xs text-rose-500 font-bold mb-1">拖延 10 年</div>
                      <div className="h-10 bg-rose-100 rounded-lg flex items-center px-3 border border-rose-200">
                          <span className="font-mono font-bold text-rose-700 text-lg">${calculations.monthlySaveLater.toLocaleString()}</span>
                      </div>
                  </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-slate-700 text-sm font-bold">
                      {calculations.monthlySaveNow > 0 ? (
                        <>您的猶豫，讓負擔加重了 <span className="text-rose-600">{(calculations.monthlySaveLater / calculations.monthlySaveNow).toFixed(1)} 倍</span></>
                      ) : (
                        <span className="text-emerald-600">您的退休金結構已足以支應目標</span>
                      )}
                  </p>
              </div>
          </div>
          
          <div className="mt-4 p-4 bg-slate-800 rounded-xl text-center shadow-lg">
             <p className="text-slate-300 italic text-sm">
               「退休規劃就像種樹，最好的時間是20年前，其次是現在。別讓未來的你，討厭現在不努力的自己。」
             </p>
           </div>
        </div>

        {/* 2. 行動方案 */}
        <div className="space-y-4 lg:col-span-1">
           <div className="flex items-center gap-2 mb-2">
             <ShieldCheck className="text-emerald-600" size={24} />
             <h3 className="text-xl font-bold text-slate-800">退休救援三部曲</h3>
           </div>
           
           <div className="grid grid-cols-1 gap-3">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-blue-300 transition-colors cursor-pointer" onClick={() => setData({ ...safeData, selfContribution: true })}>
                  <div className="mt-1 min-w-[2rem] h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">1</div>
                  <div>
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">啟動自提 <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">最無痛</span></h4>
                    <p className="text-sm text-slate-600 mt-1">立即向公司申請勞退自提 6%，強迫儲蓄兼節稅，直接墊高金字塔中層基礎。</p>
                  </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-rose-300 transition-colors">
                  <div className="mt-1 min-w-[2rem] h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs">2</div>
                  <div>
                    <h4 className="font-bold text-slate-800">精算缺口</h4>
                    <p className="text-sm text-slate-600 mt-1">面對現實，找出每月需補足的金額（如左表所示），設立專款專用的退休帳戶。</p>
                  </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-emerald-300 transition-colors">
                  <div className="mt-1 min-w-[2rem] h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">3</div>
                  <div>
                    <h4 className="font-bold text-slate-800">積極投資</h4>
                    <p className="text-sm text-slate-600 mt-1">退休金是長跑，利用「時間複利」將每月投入放大。搭配大小水庫專案，打造永續現金流。</p>
                  </div>
              </div>
           </div>
        </div>
      </div>

      <DisclaimerFooter scope="calc" />
    </div>
  );
};