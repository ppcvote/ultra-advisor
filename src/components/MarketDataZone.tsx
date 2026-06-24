import React, { useState, useEffect } from 'react';
import { useCheatSheetTrigger } from '../hooks/useCheatSheetTrigger';
import {
  AlertTriangle,
  TrendingUp,
  Activity,
  Clock,
  Bed,
  Users,
  Info,
  BarChart3,
  User,
  Siren,
  FileText,
  Coins,
  ArrowRight,
  TrendingDown,
  ShieldAlert,
  Banknote,
  Umbrella,
  ExternalLink,
  ChevronRight,
  Target,
  ShoppingBag,
  Zap,
  Coffee,
  Utensils,
  HeartPulse,
  Crosshair,
  ShieldCheck,
  MessageCircle,
  Lightbulb,
  Copy,
  Check,
  X,
  Crown
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';

import { safeStorage } from '../utils/safeStorage';
// ==========================================
// 常數定義（避免每次 render 重建）
// ==========================================
const TAB_CONFIG = [
  { id: 'inflation', label: '通膨數據', icon: TrendingDown, colorClass: 'bg-amber-500' },
  { id: 'unhealthy', label: '健康餘命', icon: Bed, colorClass: 'bg-slate-700' },
  { id: 'pension', label: '勞保財務', icon: TrendingUp, colorClass: 'bg-red-600' },
  { id: 'medical', label: '醫療費用', icon: Activity, colorClass: 'bg-blue-600' },
  { id: 'cancer', label: '癌症統計', icon: Clock, colorClass: 'bg-orange-500' }
] as const;

const CONSUMER_GOODS = [
  { name: '排骨便當', price2010: 75, price2026: 135, icon: Utensils, color: 'text-orange-500' },
  { name: '大麥克餐', price2010: 115, price2026: 195, icon: ShoppingBag, color: 'text-red-500' },
  { name: '珍珠奶茶', price2010: 45, price2026: 85, icon: Coffee, color: 'text-amber-600' },
  { name: '每度電費', price2010: 2.6, price2026: 4.8, icon: Zap, color: 'text-yellow-500' },
].map(item => ({
  ...item,
  changePercent: Math.round(((item.price2026 - item.price2010) / item.price2010) * 100)
}));

const LABOR_DATA = [
  { year: '2020', 逆差: 487 }, { year: '2022', 逆差: 386 },
  { year: '2023', 逆差: 446 }, { year: '2024', 逆差: 665 },
  { year: '2025預', 逆差: 850 }, { year: '2026預', 逆差: 1120 },
];

const BANKRUPT_YEAR = 2031;
const UNHEALTHY_YEARS = 8.4; // 2026 最新精算預期
const ROOM_COST_SINGLE = 8000;
const NURSING_COST = 3800;

const STORAGE_KEY = 'marketDataZone_activeTab';

// ==========================================
// 教育素材（中性統計與技術說明，無銷售話術）
// 註：本工具原內含「業務小抄」結構（含恐嚇式、誇大式、比較式話術），
// 因違反《保險業務員管理規則》第 15 條與廣告自律規範，於 2026-06 全面下架。
// 改為僅保留統計來源、定義說明、規則摘要等中性教育內容。
// ==========================================
const SALES_CHEATSHEET: Record<string, {
  title: string;
  color: string;
  hooks: { label: string; script: string }[];
  objections: { q: string; a: string }[];
  closingLines: string[];
}> = {
  inflation: {
    title: '通膨數據',
    color: 'amber',
    hooks: [
      { label: 'CPI 定義', script: '消費者物價指數（CPI）由主計總處按月公布，反映一般消費者購買代表性商品與服務的價格變動，並非單一商品漲幅。' },
      { label: '實質報酬', script: '實質報酬 = 名目報酬 - 通膨率。資產規劃時應同時考慮名目與實質購買力，但不同資產類別風險屬性差異大。' },
      { label: '通膨來源', script: '通膨成因包含貨幣供給、需求拉動、成本推動、輸入性通膨等多元因素，非單一機制可解釋。' },
    ],
    objections: [
      { q: '定存與通膨的關係如何衡量？', a: '當定存利率低於通膨率，存款購買力即逐期下降；但定存本金為保證金額（受存款保險保障），與投資商品的風險性質不同，應依資金用途規劃。' },
      { q: '長期通膨預期應如何參考？', a: '台灣央行設定中期 CPI 目標約 2%，主計總處長期歷史平均約 1.5-2.5%。短期波動可能高於長期平均值，規劃時可採用中性假設並設定情境分析。' },
    ],
    closingLines: [
      '資產配置應同時考量名目報酬、實質購買力、流動性與本金安全。',
      '本工具為通膨資料展示，非投資建議；請依個人現金流需求與風險承受度規劃。',
    ],
  },
  unhealthy: {
    title: '健康餘命統計',
    color: 'rose',
    hooks: [
      { label: '統計來源', script: '依衛福部「健康餘命統計」，2023 年國人平均餘命約 80 歲，健康餘命約 71.6 歲，差距約 8.4 年（資料來源：衛福部統計處）。' },
      { label: '長期照顧費用', script: '依衛福部 2023 長照需求調查，居家照顧與機構式照護費用差異大，每月介於 1-8 萬不等，視失能等級與選擇之服務型態而定。' },
      { label: '長照 2.0 制度', script: '我國長照 2.0 提供居家服務、日照、喘息服務、輔具補助等，可按需求等級申請部分補助；補助金額視 CMS 等級與所得分級而定。' },
    ],
    objections: [
      { q: '失能風險如何客觀評估？', a: '可參考保險局公告之失能等級表（共 11 級 80 項），以及衛福部之 CMS 評估量表；風險試算建議採實際統計數據而非個案推估。' },
      { q: '長期照顧保險商品有哪些差異？', a: '市售商品包含長期照顧險、特定傷病險、失能扶助險三大類，理賠定義、給付方式、保費級距均不同，建議比對條款後再決定。' },
    ],
    closingLines: [
      '長期照顧規劃涉及社會保險、商業保險、家庭資源、自有資產四項來源，應綜合考量。',
      '本工具為統計資料展示，非保險推介；保險規劃應由合格業務員依個人需求分析後提供。',
    ],
  },
  pension: {
    title: '勞保財務狀況',
    color: 'red',
    hooks: [
      { label: '財務精算', script: '依勞動部公告之「勞工保險普通事故保險基金 113 年精算評估報告」，基金未提存負債持續累積，財務狀況為各界關注議題；精算結果會隨人口、費率、給付率變動而更新。' },
      { label: '政府撥補', script: '2020 年起政府每年依預算撥補勞保基金（2024 年度為 1,300 億元），屬延緩破產時點之措施；長期改革仍需透過費率、給付率、所得替代率調整。' },
      { label: '人口結構', script: '依國發會人口推估，2025 年扶老比約為 24.7%，預估 2070 年將達 81.8%（每 1.2 名工作人口扶養 1 名老人），影響社會保險財務結構。' },
    ],
    objections: [
      { q: '勞保是否會無法給付？', a: '勞保條例第 69 條規定當基金不足時由國庫補足，制度上不會「破產」至無法給付；但給付率、請領年齡、費率調整為改革常見方向。實際影響因人而異。' },
      { q: '退休所得替代率如何計算？', a: '所得替代率 = 退休後月收入 ÷ 退休前月收入。退休所得來源包含勞保老年給付、勞退新制（個人專戶）、商業年金、自有儲蓄；建議綜合試算。' },
    ],
    closingLines: [
      '退休規劃應整合社會保險、企業退休金、個人儲蓄三層架構。',
      '本工具為制度說明與資料展示，非保險或投資推介；實際規劃請諮詢合格財務顧問。',
    ],
  },
  medical: {
    title: '醫療費用統計',
    color: 'emerald',
    hooks: [
      { label: '健保給付範圍', script: '全民健保採總額預算制，醫材自付差額、特殊療法、新藥納入給付有審查機制，部分項目需自費或共同負擔。' },
      { label: '住院費用結構', script: '住院費用包含病房差額、看護、自費醫材、自費藥品、雜費。健保部分負擔依住院日數、急性慢性、轉診規定有不同比率。' },
      { label: '所得替代缺口', script: '住院期間若請假無薪，可能產生收入中斷；勞保有傷病給付制度（住院第 4 日起按平均月投保薪資 50% 給付），仍可能存在所得替代缺口。' },
    ],
    objections: [
      { q: '健保以外的醫療開支主要有哪些？', a: '常見項目：單人病房差額（每日數千至上萬不等）、自費醫材、新藥、看護、復健、交通與陪病人員費用。實支實付醫療險可規劃補強，但條款定義差異大。' },
      { q: '團保與個人醫療險如何選擇？', a: '團保多為一年期、離職失效、保額有上限；個人醫療險為長期約定，需自行繳費。兩者各有優劣，可依個人就業穩定性與保障期間規劃。' },
    ],
    closingLines: [
      '醫療規劃應考量健保、團保、商業保險與自留風險四層架構。',
      '本工具為醫療費用資料展示，非保險推介；保險規劃請諮詢合格業務員。',
    ],
  },
  cancer: {
    title: '癌症發生率統計',
    color: 'orange',
    hooks: [
      { label: '統計來源', script: '依國健署「2021 年癌症登記報告」，台灣每年新發癌症人數約 12.6 萬人，五年存活率約 60%；不同癌別、期別差異極大。' },
      { label: '五年存活率', script: '癌症五年存活率反映確診後存活機率；早期診斷之乳癌、攝護腺癌等五年存活率超過 90%，部分晚期癌別則低於 20%。' },
      { label: '健保給付', script: '健保給付癌症治療項目持續擴大，標靶藥、免疫療法陸續納入。健保未給付項目可由商業癌症險、重大傷病險補強，但理賠定義差異大。' },
    ],
    objections: [
      { q: '家族病史與罹癌風險的關係？', a: '部分癌別（乳癌、大腸癌等）有家族遺傳因素，但多數癌症發生為多重因素，包含生活型態、環境暴露、年齡；家族無病史不代表零風險。' },
      { q: '癌症險如何規劃較合宜？', a: '癌症險分初次罹癌、住院、手術、療程、化放療等項目給付，建議依個人預算與保障缺口選擇，不必然「越多越好」。' },
    ],
    closingLines: [
      '癌症保障規劃應考量健保給付範圍、實支實付醫療險、重大傷病險、癌症險之互補性。',
      '本工具為癌症統計資料展示，非保險推介；保障規劃請諮詢合格業務員。',
    ],
  },
};

type TabId = typeof TAB_CONFIG[number]['id'];

export default function MarketDataZone() {
  // ==========================================
  // 核心狀態管理
  // ==========================================
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const saved = safeStorage.get(STORAGE_KEY);
    if (saved && TAB_CONFIG.some(t => t.id === saved)) {
      return saved as TabId;
    }
    return 'inflation';
  });

  // P2: 持久化 activeTab 到 localStorage
  useEffect(() => {
    safeStorage.set(STORAGE_KEY, activeTab);
  }, [activeTab]);

  const [age, setAge] = useState(40);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [dailySalary, setDailySalary] = useState(2500);

  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const {
    clickHandler: handleSecretClick,
    isOpen: showCheatsheet,
    close: closeCheatsheet,
  } = useCheatSheetTrigger({ track: false });

  // 複製到剪貼簿
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // ==========================================
  // 1. 不健康餘命 (Unhealthy Years) 2026 數據校準
  // ==========================================
  const [monthlyCareCost, setMonthlyCareCost] = useState(60000);
  const lifeExpectancy = gender === 'male' ? 78.0 : 84.5;
  const healthyLife = lifeExpectancy - UNHEALTHY_YEARS;
  
  // 三段式連動邏輯
  const passedYears = age;
  const remainingHealthy = Math.max(0, healthyLife - age);
  const totalCareCost = Math.round(monthlyCareCost * 12 * UNHEALTHY_YEARS);

  const lifeData = [
    { name: '人生發展線', '已過歲月': passedYears, '健康餘命': remainingHealthy, '臥床失能': UNHEALTHY_YEARS }
  ];

  // ==========================================
  // 2. 通膨碎鈔機 (Inflation Shredder) 2026 參數
  // ==========================================
  const [inflationPrincipal, setInflationPrincipal] = useState(1000);
  const [inflationYears, setInflationYears] = useState(20);
  const [inflationRate, setInflationRate] = useState(3.5);

  const purchasingPower = Math.round(inflationPrincipal / Math.pow(1 + inflationRate / 100, inflationYears));
  const vanishedWealth = inflationPrincipal - purchasingPower;
  const vanishedPercent = ((vanishedWealth / inflationPrincipal) * 100).toFixed(1);

  // ==========================================
  // 3. 勞保破產 (Pension Crisis) 趨勢
  // ==========================================
  const currentYear = new Date().getFullYear();
  const yearsLeft = Math.max(0, BANKRUPT_YEAR - currentYear);
  const ageAtBankrupt = age + yearsLeft;

  // ==========================================
  // 4. 醫療通膨 (Medical Inflation) 2026 行情
  // ==========================================
  const medicalCostData = [
    { name: '每日薪資(損)', cost: dailySalary, type: '收入' },
    { name: '雙人房差額', cost: 3500, type: '支出' },
    { name: '單人房差額', cost: ROOM_COST_SINGLE, type: '支出' },
    { name: '全日看護', cost: NURSING_COST, type: '支出' },
  ];
  const totalMedicalLoss5Days = (ROOM_COST_SINGLE * 5) + (NURSING_COST * 5) + (dailySalary * 5);

  return (
    <div className="space-y-6 animate-fade-in font-sans pb-20">
      
      {/* --------------------------------------------------------------------------- */}
      {/* 頂部 Header - 數位戰情室質感 */}
      {/* --------------------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10"><BarChart3 size={180} /></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-cyan-500/20 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded tracking-wider border border-cyan-500/30 uppercase">Market Reality Check 2026</span>
              <span
                onClick={handleSecretClick}
                className="bg-amber-400/20 text-amber-200 px-3 py-1 rounded-full text-[10px] font-bold border border-amber-400/30 cursor-default select-none hover:bg-amber-400/30 transition-colors"
              >
                數據驅動 · 專業提案
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 flex items-center gap-3"><Activity className="text-cyan-400" size={36}/> 市場數據戰情室</h1>
            <p className="text-slate-400 text-lg max-w-xl font-medium">數據不會說謊，但會示警。校準至 2026 年最新官方統計預估，讓數字告訴您未來的風險。</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl w-full md:w-auto min-w-[280px]">
            <div className="flex items-center gap-2 mb-2 text-cyan-300 font-bold text-sm"><User size={16}/> 設定客戶目前年齡</div>
            <div className="flex items-center gap-4">
              <input type="range" min={20} max={80} value={age} onChange={(e) => setAge(Number(e.target.value))} className="flex-1 h-2 bg-slate-600 rounded-lg accent-cyan-400 cursor-pointer" />
              <span className="text-3xl font-black font-mono">{age} <span className="text-sm text-slate-400 font-normal tracking-tighter">歲</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------------- */}
      {/* 分頁切換 Tabs */}
      {/* --------------------------------------------------------------------------- */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {TAB_CONFIG.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm whitespace-nowrap ${
              activeTab === t.id
                ? `${t.colorClass} text-white shadow-lg ring-2 ring-white/20`
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <t.icon size={20} /> {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 md:p-8 min-h-[600px]">
        
        {/* =========================================================================== */}
        {/* Tab 1: 通膨碎鈔機 (深度強化版) */}
        {/* =========================================================================== */}
        {activeTab === 'inflation' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 1. 核心計算區 */}
            <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100 flex flex-col lg:flex-row gap-10">
              <div className="flex-1 space-y-6">
                <div><label className="text-sm font-bold text-amber-900 mb-2 block flex items-center gap-2"><Coins size={16}/> 退休金本金 ({inflationPrincipal}萬)</label>
                <input type="range" min={100} max={5000} step={50} value={inflationPrincipal} onChange={(e)=>setInflationPrincipal(Number(e.target.value))} className="w-full h-3 bg-amber-200 rounded-lg accent-amber-600" /></div>
                <div><label className="text-sm font-bold text-amber-900 mb-2 block flex items-center gap-2"><Clock size={16}/> 預計存放年數 ({inflationYears}年)</label>
                <input type="range" min={5} max={40} value={inflationYears} onChange={(e)=>setInflationYears(Number(e.target.value))} className="w-full h-3 bg-amber-200 rounded-lg accent-amber-600" /></div>
                <div><label className="text-sm font-bold text-amber-900 mb-2 block flex items-center gap-2"><TrendingUp size={16}/> 實質通膨率 ({inflationRate}%)</label>
                <input type="range" min={1} max={8} step={0.1} value={inflationRate} onChange={(e)=>setInflationRate(Number(e.target.value))} className="w-full h-3 bg-amber-200 rounded-lg accent-amber-600" /></div>
              </div>
              <div className="flex-1 bg-white border-2 border-slate-100 rounded-2xl p-6 text-center shadow-inner relative overflow-hidden flex flex-col justify-center">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 to-red-500"></div>
                <p className="text-xs text-amber-600 font-bold uppercase mb-2 tracking-widest">Vanished Wealth</p>
                <p className="text-6xl font-black text-red-600 font-mono tracking-tighter">-{vanishedWealth} 萬</p>
                <p className="text-sm text-red-400 font-bold mt-2 tracking-wide">資產實質價值縮水了 {vanishedPercent}%</p>

                {/* 購買力視覺化進度條 */}
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-xs text-slate-500 font-bold">
                    <span>原始本金</span>
                    <span>實質購買力</span>
                  </div>
                  <div className="h-6 bg-slate-100 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${100 - Number(vanishedPercent)}%` }}
                    >
                      <span className="text-[10px] font-black text-white">{purchasingPower}萬</span>
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">
                      {inflationPrincipal}萬
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-amber-50 rounded-2xl text-amber-700 text-sm font-bold border border-amber-100">
                  {inflationYears}年後購買力僅剩 <span className="text-xl font-mono text-red-600">{(100 - Number(vanishedPercent)).toFixed(0)}%</span>
                </div>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-10">
              {/* 2. 三大真相 (民生對比) */}
              <div className="space-y-6">
                <h4 className="font-black text-slate-800 flex items-center gap-2 text-xl"><Target className="text-amber-500" size={24}/> 2026 民生通膨真相</h4>
                <div className="grid grid-cols-1 gap-3">
                  {CONSUMER_GOODS.map((g, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-amber-200 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 bg-white rounded-lg shadow-sm ${g.color}`}><g.icon size={20} /></div>
                        <span className="font-bold text-slate-700">{g.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 font-mono">${g.price2010}</span>
                        <ArrowRight size={12} className="text-slate-300" />
                        <span className="text-xl font-black text-amber-600 font-mono">${g.price2026}</span>
                        <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">+{g.changePercent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* 3. 權威參考來源 */}
                <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                  <h5 className="font-bold text-slate-800 text-xs flex items-center gap-2 uppercase tracking-widest opacity-60"><FileText size={14}/> 權威數據來源</h5>
                  <div className="text-[11px] text-slate-500 space-y-2 font-bold italic">
                    <p className="flex justify-between items-center group"><span>• 行政院主計總處 114年物價調查報告</span><ExternalLink size={12} className="text-slate-300 group-hover:text-amber-500 cursor-pointer"/></p>
                    <p className="flex justify-between items-center group"><span>• 2026 央行貨幣政策與通膨展望預估模型</span><ExternalLink size={12} className="text-slate-300 group-hover:text-amber-500 cursor-pointer"/></p>
                  </div>
                </div>
              </div>
              
              {/* 4. 顧問戰略總結 */}
              <div className="bg-slate-900 text-white p-10 rounded-3xl relative overflow-hidden flex flex-col justify-center border border-white/10 shadow-2xl group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingDown size={200}/></div>
                <div className="relative z-10">
                  <div className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase w-fit mb-6 tracking-widest">Consultant Insights</div>
                  <h4 className="text-2xl font-bold text-amber-400 mb-6 flex items-center gap-3"><ShieldAlert size={32}/> 總結：資產不只要存，更要活</h4>
                  <div className="space-y-6 text-sm text-slate-300 leading-relaxed font-bold italic opacity-90">
                    <p>「通膨是窮人的隱形稅收，也是對閒置資金的懲罰。在 2026 年的高體感通膨環境下，如果您只是『存錢』，您的財富就在萎縮。」</p>
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-3 font-medium not-italic text-slate-100">
                      <p>• 將現金部位維持在 6 個月緊急預備金即可。</p>
                      <p>• 其餘資產必須配置在具備<strong>複利生產力</strong>的工具中。</p>
                      <p>• 確保資產增值率大於 3.5% 才是真正的理財。</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================== */}
        {/* Tab 2: 不健康餘命 (三段動態連動版) */}
        {/* =========================================================================== */}
        {activeTab === 'unhealthy' && (
           <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* 1. 核心圖表與交互 */}
              <div className="flex flex-col md:flex-row gap-8 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                 <div className="flex bg-white rounded-2xl p-2 border shadow-sm h-fit">
                    {(['male', 'female'] as const).map(g => (
                      <button key={g} onClick={() => setGender(g)} className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${gender === g ? 'bg-slate-800 text-white shadow-xl scale-105' : 'text-slate-400 hover:text-slate-600'}`}>{g === 'male' ? '男性' : '女性'}</button>
                    ))}
                 </div>
                 <div className="flex-1 w-full"><div className="flex justify-between text-sm mb-3 font-black tracking-widest text-slate-700 uppercase"><span className="flex items-center gap-2"><Coins size={16} className="text-rose-500"/> 2026 預估每月照護規費</span><span className="text-rose-600 text-3xl font-mono">${monthlyCareCost.toLocaleString()}</span></div>
                    <input type="range" min={30000} max={120000} step={1000} value={monthlyCareCost} onChange={(e) => setMonthlyCareCost(Number(e.target.value))} className="w-full h-3 bg-rose-100 rounded-lg accent-rose-500 cursor-pointer" />
                 </div>
              </div>
              
              <div className="h-[300px] w-full mt-4">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={lifeData} margin={{left: 30, right: 40}}>
                       <XAxis type="number" hide domain={[0, 90]}/>
                       <YAxis type="category" dataKey="name" hide/>
                       <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius:'20px', border:'none', boxShadow:'0 20px 25px -5px rgb(0 0 0 / 0.1)'}}/>
                       <Legend iconType="circle" verticalAlign="top" height={40}/>
                       <Bar dataKey="已過歲月" stackId="a" fill="#cbd5e1" barSize={70} radius={[12, 0, 0, 12]} />
                       <Bar dataKey="健康餘命" stackId="a" fill="#10b981" barSize={70} />
                       <Bar dataKey="臥床失能" stackId="a" fill="#f59e0b" barSize={70} radius={[0, 12, 12, 0]} />
                    </BarChart>
                 </ResponsiveContainer>
                 <div className="flex justify-between text-[11px] text-slate-400 px-6 mt-4 font-black tracking-widest text-center uppercase">
                    <div className="flex flex-col"><span className="text-slate-500">PAST</span><span>已過 ({age}歲)</span></div>
                    <div className="flex flex-col"><span className="text-emerald-600">HEALTHY</span><span>剩餘健康 ({remainingHealthy.toFixed(1)}年)</span></div>
                    <div className="flex flex-col"><span className="text-orange-500">UNHEALTHY</span><span>臥床預期 ({UNHEALTHY_YEARS}年)</span></div>
                 </div>
              </div>

              <div className="grid md:grid-cols-2 gap-10">
                {/* 2. 三大真相 */}
                <div className="space-y-6">
                  <h4 className="font-black text-slate-800 flex items-center gap-2 text-xl"><Target className="text-rose-500" size={24}/> 2026 不健康餘命真相</h4>
                  <div className="space-y-4">
                    {[
                      {t:"健康存摺的負成長", d:"雖然平均壽命延長至 84.5 歲，但因慢性病年輕化與失能率提升，國人不健康時間正極速拉長至 8.4 年。"},
                      {t:"尊嚴代價飆升", d:"2026 年專業看護行情漲幅達 15%。若以每月 6 萬計算，單人臥床 8.4 年的成本已突破 600 萬大關。"}
                    ].map((v, i)=>(<div key={i} className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm flex gap-5 group hover:border-rose-400 transition-all">
                      <ChevronRight className="text-rose-400 shrink-0 group-hover:translate-x-1 transition-transform" size={24}/><div className="text-sm"><p className="font-black text-slate-800 text-base">{v.t}</p><p className="text-slate-500 font-medium leading-relaxed mt-2 italic">{v.d}</p></div>
                    </div>))}
                  </div>
                  {/* 3. 參考來源 */}
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><FileText size={14}/> 權威數據來源</p>
                    <div className="text-[11px] text-slate-600 space-y-2 font-bold italic">
                      <p className="flex justify-between group cursor-pointer hover:text-rose-600 transition-colors"><span>• 衛福部 114 年國人健康平均餘命統計預報</span><ExternalLink size={12}/></p>
                      <p className="flex justify-between group cursor-pointer hover:text-rose-600 transition-colors"><span>• 內政部 2025 全國簡易生命表校準版</span><ExternalLink size={12}/></p>
                    </div>
                  </div>
                </div>
                {/* 4. 顧問戰略總結 */}
                <div className="bg-slate-900 text-white p-10 rounded-3xl relative overflow-hidden flex flex-col justify-center border border-white/5 shadow-2xl">
                  <div className="absolute top-0 right-0 p-4 opacity-5"><Users size={200}/></div>
                  <div className="relative z-10">
                    <div className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase w-fit mb-6 tracking-widest">Consultant Insights</div>
                    <h4 className="text-2xl font-bold text-rose-400 mb-6 flex items-center gap-4 tracking-tighter"><ShieldAlert size={32}/> 總結：尊嚴是有代價的</h4>
                    <p className="text-sm leading-relaxed text-slate-300 italic font-bold mb-8">「這筆高達 <span className="text-white text-lg font-mono">/ ${(totalCareCost/10000).toFixed(0)} 萬</span> 的尊嚴金，應獨立於退休金之外。如果您不想讓下一代在您的尊嚴與他們的生活間做抉擇，您的帳戶撥好這筆專款了嗎？」</p>
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 text-[12px] space-y-3 font-bold tracking-wider text-slate-100">
                       <p className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-rose-500"></div> 長照險是槓桿，不是開銷</p>
                       <p className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-rose-500"></div> 失能第一年，資產流速將是退休期的 3 倍</p>
                    </div>
                  </div>
                </div>
              </div>

           </div>
        )}

        {/* =========================================================================== */}
        {/* Tab 3: 勞保破產危機 (深度數據版) */}
        {/* =========================================================================== */}
        {activeTab === 'pension' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* 1. 核心數據區 */}
             <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-100 pb-8 gap-8">
                <div className="space-y-3">
                   <h3 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight"><AlertTriangle className="text-red-500" size={32}/> 勞保基金收支狀況</h3>
                   <p className="text-slate-500 font-medium text-lg">依勞動部 113 年精算報告，2026 年預估年度逆差續擴，政府目前以年度撥補方式延緩基金用罄時點。</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 px-8 py-6 rounded-3xl text-right min-w-[240px] shadow-md">
                   <div className="text-xs text-slate-500 font-black uppercase mb-2 flex items-center justify-end gap-2 tracking-widest"><Siren size={18}/> 精算用罄時點（試算）</div>
                   <div className="text-5xl font-black text-slate-700 font-mono tracking-tighter">約 {yearsLeft} 年</div>
                   <div className="text-sm text-slate-700 font-bold bg-slate-100 px-3 py-1 rounded-full inline-block mt-3 tracking-tight">屆時您年齡約 {ageAtBankrupt} 歲（依精算報告，未計政府撥補）</div>
                </div>
             </div>
             
             <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={LABOR_DATA} margin={{top:10, right:30, left:0, bottom:10}}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                     <XAxis dataKey="year" tick={{fill: '#64748b', fontWeight:'black', fontSize:14}} axisLine={false} tickLine={false} dy={10}/>
                     <YAxis unit="億" tick={{fill: '#64748b', fontWeight:'bold'}} axisLine={false} tickLine={false} dx={-10}/>
                     <Tooltip contentStyle={{borderRadius:'20px', border:'none', boxShadow:'0 25px 50px -12px rgb(0 0 0 / 0.25)', padding:'16px'}}/>
                     <Line type="monotone" dataKey="逆差" name="年度逆差 (億)" stroke="#ef4444" strokeWidth={6} dot={{r: 8, fill:'#ef4444', strokeWidth:3, stroke:'white'}} activeDot={{r: 12, fill:'#ef4444'}}/>
                   </LineChart>
                </ResponsiveContainer>
                <div className="text-[10px] text-slate-400 font-black uppercase text-center mt-6 tracking-widest opacity-60 italic">勞保基金收支逆差趨勢 (2020-2026預估)</div>
             </div>

             <div className="grid md:grid-cols-2 gap-10 mt-12">
                {/* 2. 三大真相 */}
                <div className="space-y-6">
                  <h4 className="font-black text-slate-800 flex items-center gap-2 text-xl"><Target className="text-red-600" size={24}/> 2026 勞保財務三項觀察</h4>
                  <div className="space-y-3">
                    {[
                      {t:"扶養比變化", d:"依國發會人口推估，2026 年約 3.2 位工作人口扶養 1 位老人，2070 年預估降至 1.2:1，影響社會保險費率與給付結構。"},
                      {t:"政府撥補措施", d:"自 2020 年起政府年度撥補勞保基金（2024 年度 1,300 億元），屬延緩基金用罄時點之政策；長期仍需透過費率與給付率調整。"},
                      {t:"可能改革方向", d:"國際社會保險改革常見方向包含調整費率、給付率、請領年齡。實際修法須經立法程序，個人退休規劃可參考三層保障架構。"}
                    ].map((v, i)=>(<div key={i} className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm hover:border-slate-300 transition-all flex gap-4 group">
                      <ChevronRight className="text-red-400 shrink-0 group-hover:translate-x-1 transition-all" size={22}/><div className="text-sm"><p className="font-black text-slate-800 text-base">{v.t}</p><p className="text-slate-500 font-medium mt-1 leading-relaxed italic">{v.d}</p></div>
                    </div>))}
                  </div>
                  {/* 3. 參考來源 */}
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-3xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><FileText size={14}/> 權威數據來源文獻</p>
                    <div className="text-[11px] text-slate-500 space-y-3 font-bold italic">
                      <p className="flex justify-between items-center group cursor-pointer hover:text-red-600 transition-colors"><span>• 勞動部勞安所 113 年勞保普通事故保險基金精算評估報告</span><ExternalLink size={12}/></p>
                      <p className="flex justify-between items-center group cursor-pointer hover:text-red-600 transition-colors"><span>• 國發會 2025-2026 人口結構推估圖 (超高齡化預警)</span><ExternalLink size={12}/></p>
                      <p className="flex justify-between items-center group cursor-pointer hover:text-red-600 transition-colors"><span>• 行政院 2026 勞保撥補預算案編列公告</span><ExternalLink size={12}/></p>
                    </div>
                  </div>
                </div>
                {/* 4. 顧問戰略總結 */}
                <div className="bg-slate-900 text-white p-10 rounded-3xl relative overflow-hidden flex flex-col justify-center border border-white/10 shadow-2xl">
                   <div className="absolute top-0 right-0 p-4 opacity-5"><Activity size={200}/></div>
                   <div className="relative z-10">
                     <div className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase w-fit mb-6 tracking-widest">Consultant Insights</div>
                     <h4 className="text-2xl font-bold text-red-400 mb-8 flex items-center gap-4 tracking-tighter"><ShieldAlert size={36}/> 觀察小結：退休所得多元化規劃</h4>
                     <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
                        <p>依精算趨勢，勞保現行給付結構在費率與給付率不調整的情況下面臨壓力。政府已啟動年度撥補機制，惟長期改革方向（費率、給付率、請領年齡）仍待立法調整。</p>
                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4 text-slate-100">
                          <p className="flex items-center gap-3"><Target size={14} className="text-red-500"/> 退休所得規劃可參考三層架構：社會保險、企業退休金、個人儲蓄</p>
                          <p className="flex items-center gap-3"><Target size={14} className="text-red-500"/> 可評估勞退新制自提（薪資 6% 內免稅）與其他自有儲蓄工具</p>
                          <p className="flex items-center gap-3"><Target size={14} className="text-red-500"/> 規劃前提建議涵蓋「社會保險給付額度變動」之情境</p>
                        </div>
                     </div>
                   </div>
                </div>
             </div>

          </div>
        )}

        {/* =========================================================================== */}
        {/* Tab 4: 醫療通膨 (完整公式連動版) */}
        {/* =========================================================================== */}
        {activeTab === 'medical' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="grid md:grid-cols-2 gap-12">
                {/* 1. 核心數據區 (含日薪滑桿) */}
                <div className="space-y-8">
                   <h3 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight"><Banknote className="text-emerald-500" size={32}/> 日薪 vs 2026 醫療費</h3>
                   <p className="text-slate-500 font-bold leading-relaxed text-lg italic">健保限縮導致 2026 年醫療痛點：<strong>「高額自費」</strong>與<strong>「收入中斷」</strong>的雙重打擊。</p>
                   <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner ring-1 ring-slate-100">
                      <div className="flex justify-between text-sm mb-4 text-slate-700 font-black uppercase tracking-widest"><span>設定目前平均日薪 (收入中斷代價)</span><span className="text-3xl text-emerald-600 font-mono tracking-tighter">${dailySalary.toLocaleString()}</span></div>
                      <input type="range" min={1000} max={30000} step={500} value={dailySalary} onChange={(e) => setDailySalary(Number(e.target.value))} className="w-full h-3 bg-slate-200 rounded-lg accent-emerald-500 cursor-pointer" />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-black"><span>基本工資 ($1.2k)</span><span>平均水準 ($2.5k)</span><span>高階人才 ($15k+)</span></div>
                   </div>
                   <div className="space-y-8">
                      {medicalCostData.map((m, i) => (
                         <div key={i} className="group">
                            <div className="flex justify-between text-sm mb-3 font-black transition-colors tracking-tight">
                               <span className="text-slate-700 text-base">{m.name}</span><span className={m.type === '收入' ? 'text-emerald-600 text-lg' : 'text-blue-600 text-lg'}>${m.cost.toLocaleString()}</span>
                            </div>
                            <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200">
                               <div className={`h-full transition-all duration-700 ${m.type === '收入' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-blue-500'}`} style={{width: `${Math.min(100, (m.cost / 15000) * 100)}%`}}></div>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>

                {/* 住院五天損失試算卡片 */}
                <div className="bg-blue-50 p-10 rounded-[40px] border border-blue-200 flex flex-col justify-center relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><Bed size={200} className="text-blue-900"/></div>
                    <h4 className="font-black text-blue-900 mb-10 flex items-center gap-4 text-2xl tracking-tighter"><Bed size={32}/> 住院五天損失試算 (2026預估)</h4>
                    <div className="space-y-6 bg-white/70 p-8 rounded-3xl border border-blue-100 backdrop-blur-md shadow-inner">
                       <div className="flex justify-between text-base border-b pb-4 border-blue-200/50">
                          <span className="text-blue-800 font-bold tracking-tight">單人房差額 ($8,000 x 5)</span><span className="font-black text-blue-900 text-xl font-mono">$40,000</span>
                       </div>
                       <div className="flex justify-between text-base border-b pb-4 border-blue-200/50">
                          <span className="text-blue-800 font-bold tracking-tight">全日專業看護 ($3,800 x 5)</span><span className="font-black text-blue-900 text-xl font-mono">$19,000</span>
                       </div>
                       <div className="flex justify-between text-base border-b pb-4 border-blue-200/50">
                          <span className="text-blue-800 font-bold tracking-tight">薪資損失 (${dailySalary.toLocaleString()} x 5)</span><span className="font-black text-emerald-700 text-xl font-mono">${(dailySalary * 5).toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between text-3xl pt-4 font-black tracking-tighter">
                          <span className="text-blue-900 uppercase">總計淨損</span><span className="text-red-500">-${totalMedicalLoss5Days.toLocaleString()}</span>
                       </div>
                    </div>
                    <div className="mt-8 flex justify-between items-center text-[11px] text-blue-400 font-black italic tracking-widest uppercase">
                      <span>※ 資料來源：2026 健保自付上限調整與各大醫院實價</span>
                      <span className="bg-white/80 px-3 py-1 rounded-full border border-blue-200 shadow-sm flex items-center gap-1.5"><ShieldCheck size={12}/> Ver 2.6 Beta</span>
                    </div>
                </div>
             </div>

             <div className="grid md:grid-cols-2 gap-10 mt-12">
               {/* 2. 三大真相 */}
               <div className="space-y-6">
                 <h4 className="font-black text-slate-800 flex items-center gap-2 text-xl"><Target className="text-emerald-600" size={24}/> 2026 醫療環境真相</h4>
                 <div className="space-y-4">
                    {[
                      {t:"健保自付額全面調升", d:"2026年起，為維持健保運作，部分負擔與住院自付額上限均有顯著漲幅，高額自費已成常態。"},
                      {t:"醫院單人房一位難求", d:"醫護缺工導致床位縮減，高端保險客戶對單人房需求激增，日差額行情已達 8,000 - 12,000 元。"}
                    ].map((v, i)=>(<div key={i} className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm flex gap-4 hover:border-emerald-400 transition-all">
                       <ChevronRight size={22} className="text-emerald-500 shrink-0"/><div className="text-sm"><p className="font-black text-slate-800 text-base">{v.t}</p><p className="text-slate-500 font-medium leading-relaxed mt-1 italic">{v.d}</p></div>
                    </div>))}
                 </div>
                 {/* 3. 權威來源 */}
                 <div className="p-5 bg-slate-50 border border-slate-200 rounded-3xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><FileText size={14}/> 權威數據來源</p>
                    <div className="text-[11px] text-slate-500 space-y-2 font-bold italic">
                      <p className="flex justify-between items-center group cursor-pointer hover:text-emerald-600 transition-colors"><span>• 衛福部健保署 115 年住院自付額標準公告預報</span><ExternalLink size={12}/></p>
                      <p className="flex justify-between items-center group cursor-pointer hover:text-emerald-600 transition-colors"><span>• 2026 全國私立醫院行政調整方案與收費標準</span><ExternalLink size={12}/></p>
                    </div>
                  </div>
               </div>
               {/* 4. 顧問戰略總結 */}
               <div className="bg-slate-900 text-white p-10 rounded-3xl relative overflow-hidden flex flex-col justify-center border border-white/10 shadow-2xl">
                  <div className="absolute top-0 right-0 p-4 opacity-5"><Crosshair size={200}/></div>
                  <div className="relative z-10">
                    <div className="bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase w-fit mb-6 tracking-widest">Consultant Insights</div>
                    <h4 className="text-2xl font-bold text-emerald-400 mb-8 flex items-center gap-4 tracking-tighter"><ShieldAlert size={36}/> 總結：自費時代的降臨</h4>
                    <p className="text-sm leading-relaxed text-slate-300 italic font-bold mb-8">「生一場大病，損失的不只是醫療費，更是『機會成本』。2026 年起的醫療規劃應重點佈局『薪資補償』與『高額實支實付雜費額度』。」</p>
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-3 font-bold text-slate-100 text-[12px] shadow-inner">
                       <p className="flex items-center gap-3"><Target size={14} className="text-emerald-500"/> 重大傷病險額度應維持在年收入 3 倍以上</p>
                       <p className="flex items-center gap-3"><Target size={14} className="text-emerald-500"/> 實支實付雜費額度是抗癌的第一道防線</p>
                    </div>
                  </div>
               </div>
             </div>

          </div>
        )}

        {/* =========================================================================== */}
        {/* Tab 5: 癌症時鐘 (完美恢復 + 2026 強度校正) */}
        {/* =========================================================================== */}
        {activeTab === 'cancer' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* 1. 核心數據區 (三大指標) */}
             <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 text-center shadow-md transform hover:-translate-y-2 transition-all group">
                   <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform"><Clock size={28}/></div>
                   <h4 className="text-sm font-black text-slate-600 mb-1 tracking-widest uppercase">2026 癌症時鐘</h4>
                   <p className="text-4xl font-black text-orange-600 mb-1 font-mono tracking-tighter">3分48秒</p>
                   <p className="text-[10px] text-slate-400 font-black bg-white px-2 py-1 rounded-full border border-orange-100 inline-block uppercase shadow-sm">就有一人罹癌 (最新校正)</p>
                </div>
                <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 text-center shadow-md transform hover:-translate-y-2 transition-all group">
                   <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform"><Activity size={28}/></div>
                   <h4 className="text-sm font-black text-slate-600 mb-1 tracking-widest uppercase">十大死因榜首</h4>
                   <p className="text-4xl font-black text-rose-600 mb-1 font-mono tracking-tighter">連續 44 年</p>
                   <p className="text-[10px] text-slate-400 font-black bg-white px-2 py-1 rounded-full border border-rose-100 inline-block uppercase shadow-sm">排名未曾動搖</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 text-center shadow-md transform hover:-translate-y-2 transition-all group">
                   <div className="w-14 h-14 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform"><Users size={28}/></div>
                   <h4 className="text-sm font-black text-slate-600 mb-1 tracking-widest uppercase">2026 長照行情</h4>
                   <p className="text-4xl font-black text-slate-700 mb-1 font-mono tracking-tighter">5.2 萬 <small className="text-sm text-slate-400 font-bold tracking-normal uppercase">/Month</small></p>
                   <p className="text-[10px] text-slate-400 font-black bg-white px-2 py-1 rounded-full border border-slate-200 inline-block uppercase shadow-sm">專業看護與規費調漲</p>
                </div>
             </div>

             {/* 長照十年總開銷試算 (深色奢華原版恢復) */}
             <div className="bg-slate-800 text-white p-10 rounded-[40px] shadow-2xl mt-4 relative overflow-hidden border border-slate-700 ring-4 ring-slate-800/50">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none rotate-12"><Umbrella size={300}/></div>
                <h4 className="font-black text-2xl mb-12 flex items-center gap-4 relative z-10 text-yellow-400 tracking-tighter"><Info size={36} className="text-yellow-400 animate-pulse"/> 長照十年總開銷試算 (2026行情)</h4>
                <div className="flex flex-col gap-12 relative z-10">
                   {[
                     {l:"居家照顧", p:"45%", c:"$450萬", color:"bg-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.6)]"},
                     {l:"機構安養", p:"75%", c:"$720萬", color:"bg-orange-500 shadow-[0_0_25px_rgba(249,115,22,0.6)]"},
                     {l:"外籍看護", p:"50%", c:"$420萬", color:"bg-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.6)]"}
                   ].map((row, i)=>(
                     <div key={i} className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-8 group">
                        <div className="w-32 text-base text-slate-400 font-black group-hover:text-white transition-colors tracking-widest">{row.l}</div>
                        <div className="flex-1 w-full bg-slate-700 h-10 rounded-full overflow-hidden shadow-inner border border-slate-600 flex items-center px-1.5">
                           <div className={`${row.color} h-7 rounded-full transition-all duration-1000 flex items-center justify-end px-4 transform group-hover:scale-y-110`} style={{width: row.p}}>
                              <span className="text-[10px] font-black text-white uppercase tracking-tighter group-hover:scale-125 transition-transform">{row.p}</span>
                           </div>
                        </div>
                        <div className="w-36 text-right font-mono font-black text-3xl text-white tracking-tighter group-hover:text-yellow-400 transition-colors">{row.c}</div>
                     </div>
                   ))}
                </div>
                <div className="mt-14 pt-8 border-t border-slate-700 flex flex-col md:flex-row justify-between items-center text-[11px] text-slate-500 italic font-black uppercase tracking-widest gap-6">
                   <span className="flex items-center gap-3 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-700"><Target size={16} className="text-yellow-500"/> ※ 2026 精算：國人平均失能存活期 8.4 年</span>
                   <span className="bg-slate-700/50 px-5 py-2.5 rounded-full border border-slate-600 inline-flex items-center gap-3 shadow-inner"><FileText size={16}/> 來源：國健署 2026 癌症登記預報 / 衛福部公告分析</span>
                </div>
             </div>

             <div className="grid md:grid-cols-2 gap-10 mt-12">
                {/* 2. 三大真相 */}
                <div className="space-y-6">
                  <h4 className="font-black text-slate-800 flex items-center gap-3 text-xl"><Target className="text-rose-500" size={24}/> 2026 癌症醫療兩項觀察</h4>
                  <div className="space-y-4">
                    {[
                      {t:"治療慢性化", d:"癌症五年存活率隨醫療進步提升，平均治療期程延長；維持性療程（標靶、免疫療法）為長期門診照護需求。"},
                      {t:"自費治療項目", d:"標靶藥與細胞療法之自費費用因藥品、療程而異，依國健署資料常見區間為 150-350 萬元；健保給付項目持續滾動納入。"}
                    ].map((v, i)=>(<div key={i} className="p-6 bg-white border border-slate-200 rounded-[32px] shadow-sm hover:border-rose-400 hover:shadow-xl transition-all flex gap-5 group">
                       <HeartPulse size={32} className="text-rose-400 shrink-0 group-hover:scale-110 transition-transform"/><div className="text-sm"><p className="font-black text-slate-800 text-lg tracking-tight">{v.t}</p><p className="text-slate-500 font-medium leading-relaxed mt-2">{v.d}</p></div>
                    </div>))}
                  </div>
                  {/* 3. 權威來源 */}
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl flex justify-between items-center group cursor-pointer hover:bg-white transition-all">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2"><FileText size={14}/> 權威數據出處</p>
                      <p className="text-xs font-bold text-slate-600">衛生福利部 2025 全年死因統計分析報告</p>
                    </div>
                    <ExternalLink size={20} className="text-slate-300 group-hover:text-rose-500 transition-colors"/>
                  </div>
                </div>
                {/* 4. 顧問戰略總結 */}
                <div className="bg-slate-900 text-white p-12 rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col justify-center border border-white/5 group">
                   <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-25 transition-opacity"><Crosshair size={220}/></div>
                   <div className="relative z-10">
                      <div className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase w-fit mb-8 tracking-widest">Consultant Insights</div>
                      <h4 className="text-3xl font-black text-rose-400 mb-8 flex items-center gap-4 tracking-tighter"><ShieldAlert size={44}/> 觀察小結：醫療保障規劃面向</h4>
                      <p className="text-base leading-relaxed text-slate-300 mb-10 opacity-95">近年癌症醫療規劃焦點，從傳統的死殘給付逐步擴及「自費醫療項目」與「長期照護需求」之保障配置；相關規劃須依個人健康狀況、家庭責任、財務狀況綜合評估。</p>
                      <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-6 tracking-widest text-slate-100 shadow-inner">
                         <div className="flex items-center gap-4 text-sm"><div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]"></div> 重大傷病險、實支實付醫療險、癌症險之保障互補性</div>
                         <div className="flex items-center gap-4 text-sm"><div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]"></div> 實支實付商品之雜費上限、副本理賠條款比對</div>
                         <div className="flex items-center gap-4 text-sm"><div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]"></div> 長期照護費用之專款規劃與既有資產用途之區隔</div>
                      </div>
                   </div>
                </div>
             </div>

          </div>
        )}

      </div>

      {/* =========================================================================== */}
      {/* 業務小抄側邊面板（三連點觸發） */}
      {/* =========================================================================== */}
      {showCheatsheet && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* 背景遮罩 */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeCheatsheet}
          />

          {/* 側邊面板 */}
          <div className="relative w-full max-w-md bg-slate-900 text-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* 標題列 */}
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex justify-between items-center z-10">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <MessageCircle size={20} className="text-cyan-400" />
                  業務小抄
                  <Crown size={16} className="text-amber-400" />
                </h3>
                <p className="text-xs text-slate-400">
                  {SALES_CHEATSHEET[activeTab]?.title || '市場數據戰情室'} · 按 ESC 關閉
                </p>
              </div>
              <button
                onClick={closeCheatsheet}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* 小抄內容 */}
            {SALES_CHEATSHEET[activeTab] && (
              <div className="p-4 space-y-6 text-sm">
                {/* ========== 1. 開場話術 ========== */}
                <div>
                  <h4 className="font-bold text-cyan-400 mb-3 flex items-center gap-2">
                    <Lightbulb size={16} />
                    開場切入話術
                  </h4>
                  <div className="space-y-2">
                    {SALES_CHEATSHEET[activeTab].hooks.map((hook, i) => (
                      <div key={i} className="bg-slate-800 rounded-xl p-3 hover:bg-slate-700 transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <span className="text-[10px] font-bold text-cyan-400 bg-cyan-900/50 px-2 py-0.5 rounded-full">
                              {hook.label}
                            </span>
                            <p className="text-slate-300 mt-2 leading-relaxed text-xs">
                              「{hook.script}」
                            </p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(hook.script, `panel-hook-${i}`)}
                            className="p-1.5 text-slate-500 hover:text-cyan-400 hover:bg-slate-600 rounded transition-all shrink-0"
                            title="複製話術"
                          >
                            {copiedIndex === `panel-hook-${i}` ? (
                              <Check size={14} className="text-emerald-400" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ========== 2. 異議處理 ========== */}
                <div>
                  <h4 className="font-bold text-amber-400 mb-3 flex items-center gap-2">
                    <ShieldAlert size={16} />
                    異議處理
                  </h4>
                  <div className="space-y-2">
                    {SALES_CHEATSHEET[activeTab].objections.map((obj, i) => (
                      <div key={i} className="bg-slate-800 rounded-xl p-3">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-[10px] font-bold text-rose-400 bg-rose-900/50 px-2 py-0.5 rounded-full shrink-0">
                            客戶說
                          </span>
                          <p className="text-slate-400 text-xs">「{obj.q}」</p>
                        </div>
                        <div className="flex items-start justify-between gap-2 mt-2 pl-3 border-l-2 border-emerald-500">
                          <div className="flex-1">
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/50 px-2 py-0.5 rounded-full">
                              這樣回應
                            </span>
                            <p className="text-slate-300 mt-1.5 leading-relaxed text-xs">
                              「{obj.a}」
                            </p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(obj.a, `panel-obj-${i}`)}
                            className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-slate-600 rounded transition-all shrink-0"
                            title="複製回應"
                          >
                            {copiedIndex === `panel-obj-${i}` ? (
                              <Check size={14} className="text-emerald-400" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ========== 3. 成交金句 ========== */}
                <div>
                  <h4 className="font-bold text-purple-400 mb-3 flex items-center gap-2">
                    <Target size={16} />
                    成交金句
                  </h4>
                  <div className="space-y-2">
                    {SALES_CHEATSHEET[activeTab].closingLines.map((line, i) => (
                      <div
                        key={i}
                        className="bg-purple-900/30 rounded-xl p-3 border border-purple-700/50 flex items-center justify-between gap-2"
                      >
                        <p className="text-purple-200 text-xs italic leading-relaxed">
                          「{line}」
                        </p>
                        <button
                          onClick={() => copyToClipboard(line, `panel-close-${i}`)}
                          className="p-1.5 text-slate-500 hover:text-purple-400 hover:bg-slate-600 rounded transition-all shrink-0"
                          title="複製金句"
                        >
                          {copiedIndex === `panel-close-${i}` ? (
                            <Check size={14} className="text-emerald-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 小提示 */}
                <div className="text-center text-[10px] text-slate-500 pt-4 border-t border-slate-700">
                  💡 點擊複製按鈕可直接複製話術
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}