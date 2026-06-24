import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileBarChart, ArrowUpFromLine, X, User, Calendar, PenTool, Phone, Mail, Eye, EyeOff, CheckCircle2, Building2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// --- 引入專屬報告元件 ---
import GiftReport from './GiftReport';
import EstateReport from './EstateReport';
import StudentLoanReport from './StudentLoanReport';
import SuperActiveReport from './SuperActiveReport';
import DisclaimerFooter from './DisclaimerFooter';

// ------------------------------------------------------------------
// Legacy Chart Renderer (保留給其他尚未改版的工具)
// ------------------------------------------------------------------
const LegacyChartSection = ({ reportContent, isPrinting }: { reportContent: any, isPrinting: boolean }) => {
  const { chartData } = reportContent;
  const fixedWidth = 700;
  const fixedHeight = 300;

  const Wrapper = ({ children }: any) => {
    if (isPrinting) {
      return <div style={{ width: fixedWidth, height: fixedHeight, margin: '0 auto' }}>{children}</div>;
    }
    return <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>;
  };

  return (
    <Wrapper>
       <ComposedChart data={chartData} {...(isPrinting ? { width: fixedWidth, height: fixedHeight } : {})}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" tick={{fontSize: 10}} />
          <YAxis tick={{fontSize: 10}} width={40} />
          <Legend wrapperStyle={{fontSize: '10px'}}/>
          {Object.keys(chartData[0] || {}).slice(1).map((key, i) => (
             <Area key={i} type="monotone" dataKey={key} fill={['#8884d8', '#82ca9d', '#ffc658'][i % 3]} stroke="none" fillOpacity={0.2} isAnimationActive={false}/>
          ))}
       </ComposedChart>
    </Wrapper>
  );
};

// ------------------------------------------------------------------
// Report Component Main (總指揮)
// ------------------------------------------------------------------
// Shape of optional advisor-profile fields we hydrate from Firestore users/{uid}.
// All optional — the auth user prop (`user`) only carries displayName/email/uid,
// so phone / licenses / companyName have to be lazy-fetched at modal open time.
interface AdvisorProfile {
  phone?: string;
  licenses?: string[];
  companyName?: string;
}

const ReportModal = ({ isOpen, onClose, user, client, activeTab, data }: any) => {
  const [advisorNote, setAdvisorNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(true);
  const [showContact, setShowContact] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [advisorProfile, setAdvisorProfile] = useState<AdvisorProfile>({});

  // Logo 路徑
  const LOGO_URL = "/logo.png";

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
      if(isOpen) {
          setAdvisorNote('');
          setShowNoteInput(true);
      }
  }, [isOpen]);

  // Lazy-fetch the advisor's Firestore profile when the modal opens.
  // Why: the `user` prop is the firebase.User (auth-only) and doesn't carry
  // phone / licenses / companyName. We pull them on-demand instead of plumbing
  // them through every call site. Silently no-op on error so the report still
  // renders if the doc is missing or rules block the read.
  useEffect(() => {
      if (!isOpen || !user?.uid) return;
      let cancelled = false;
      getDoc(doc(db, 'users', user.uid))
          .then((snap) => {
              if (cancelled || !snap.exists()) return;
              const d = snap.data() as any;
              setAdvisorProfile({
                  phone: typeof d.phone === 'string' && d.phone.trim() ? d.phone.trim() : undefined,
                  licenses: Array.isArray(d.licenses)
                      ? d.licenses.filter((x: any) => typeof x === 'string' && x.trim()).map((x: string) => x.trim())
                      : undefined,
                  companyName: typeof d.companyName === 'string' && d.companyName.trim() ? d.companyName.trim() : undefined,
              });
          })
          .catch(() => { /* silent — report should still render */ });
      return () => { cancelled = true; };
  }, [isOpen, user?.uid]);
   
  if (!isOpen || !mounted) return null;

  const dateStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
   
  const getReportTitle = () => {
      switch(activeTab) {
          case 'gift': return '百萬禮物專案';
          case 'estate': return '金融房產專案';
          case 'student': return '學貸活化專案';
          case 'super_active': return '超積極存錢法';
          case 'car': return '五年換車專案';
          case 'reservoir': return '大小水庫專案';
          case 'pension': return '退休缺口試算';
          case 'tax': return '稅務傳承專案';
          default: return '資產配置規劃';
      }
  };

  // 舊版資料計算邏輯 (僅當 Fallback 時執行)
  let reportContent = { title: getReportTitle(), mindMap: [] as any[], table: [] as any[], highlights: [] as any[], chartData: [] as any[], chartType: 'composed' };

  // 自動列印邏輯
  const handlePrint = () => {
      setShowNoteInput(false);
      setIsPrinting(true); 
      setTimeout(() => {
          window.print();
          setTimeout(() => {
            setShowNoteInput(true);
            setIsPrinting(false);
          }, 500);
      }, 500);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm overflow-y-auto no-scroll-print" id="report-modal-root">
      {/* --- 關鍵 CSS 修正 --- */}
      <style>{`
        @media print {
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            #root, .toast-container, .no-print { display: none !important; }
            #report-modal-root { position: static !important; width: 100% !important; height: auto !important; background: white !important; padding: 0 !important; display: block !important; overflow: visible !important; z-index: 99999 !important; }
            
            .print-content { width: 100% !important; }
            .print-page { width: 100% !important; margin: 0 !important; background: white; box-shadow: none !important; page-break-after: always; position: relative; }
            
            .cover-page { height: 297mm !important; overflow: hidden; }
            
            /* 內容頁強制改為 block 佈局，解決跑版問題 */
            .content-page { 
                display: block !important; 
                min-height: auto !important; 
                height: auto !important; 
                padding: 10mm !important; 
                page-break-after: auto !important; 
            }
            
            .break-before-page { page-break-before: always !important; display: block !important; height: 0; margin: 0; }
            
            .print-break-inside { break-inside: avoid !important; page-break-inside: avoid !important; }
            .print-compact { margin-bottom: 1rem !important; }
            
            ::-webkit-scrollbar { display: none; }
        }
      `}</style>

      <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl flex flex-col relative print:w-full print:max-w-none print:shadow-none print:rounded-none">
        
        {/* Controls (No Print) */}
        <div className="sticky top-0 z-50 bg-white border-b border-slate-200 p-4 flex justify-between items-center no-print rounded-t-xl">
           <h3 className="font-bold text-slate-700 flex items-center gap-2">
               <FileBarChart size={20} className="text-blue-600"/> 策略建議書預覽
           </h3>
           <div className="flex gap-3 items-center">
               <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none bg-slate-50 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                   <input type="checkbox" checked={showContact} onChange={(e) => setShowContact(e.target.checked)} className="w-4 h-4 accent-blue-600 rounded" />
                   {showContact ? <Eye size={16}/> : <EyeOff size={16}/>} 顯示聯絡資訊
               </label>
               <div className="w-px h-6 bg-slate-200"></div>
               <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm">
                   <ArrowUpFromLine size={18}/> 列印建議書
               </button>
               <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition-colors">
                   <X size={20}/>
               </button>
           </div>
        </div>

        {/* --- 報表內容容器 --- */}
        <div className="print-content">

            {/* === 第一頁：封面 === */}
            <div className="print-page cover-page flex flex-col justify-between bg-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-bl-[100%] z-0"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-slate-50 rounded-tr-[100%] z-0"></div>

                <div className="pt-24 px-8 relative z-10">
                    <p className="text-blue-600 font-bold tracking-[0.2em] text-sm mb-6 uppercase">Exclusive Financial Proposal</p>
                    <h1 className="text-5xl font-black text-slate-900 leading-tight mb-8 tracking-tight">{getReportTitle()}</h1>
                    <div className="h-1.5 w-24 bg-blue-600 mb-8 rounded-full"></div>
                    <p className="text-2xl text-slate-500 font-medium">專屬資產配置戰略規劃書</p>
                </div>

                {/* 封面 Logo */}
                <div className="flex-1 flex items-center justify-center opacity-20 relative z-10">
                     <img 
                        src={LOGO_URL} 
                        alt="Cover Logo" 
                        className="w-64 h-64 object-contain grayscale"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                     />
                </div>

                <div className="pb-10 px-8 relative z-10">
                    <div className="grid grid-cols-2 gap-12 border-t border-slate-200 pt-12">
                        <div>
                            <p className="text-xs text-slate-400 font-bold mb-2 uppercase tracking-wider">Prepared For</p>
                            <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                                <User className="text-blue-600" size={28}/> {client?.name || '尊榮貴賓'}
                            </h2>
                            <p className="text-slate-500 mt-2 flex items-center gap-2"><Calendar size={14}/> {dateStr}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-400 font-bold mb-2 uppercase tracking-wider">Financial Advisor</p>
                            <h2 className="text-2xl font-bold text-slate-800">{user?.displayName || '專業理財顧問'}</h2>
                            {advisorProfile.companyName && (
                                <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
                                    <Building2 size={14}/> {advisorProfile.companyName}
                                </p>
                            )}
                            {advisorProfile.licenses && advisorProfile.licenses.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {advisorProfile.licenses.map((lic) => (
                                        <span
                                            key={lic}
                                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-bold text-blue-700 tracking-wider"
                                        >
                                            {lic}
                                        </span>
                                    ))}
                                </div>
                            )}
                            {showContact && (
                                <>
                                    {user?.email && <p className="text-slate-500 mt-2 flex items-center gap-2 text-sm"><Mail size={14}/> {user.email}</p>}
                                    {advisorProfile.phone ? (
                                        <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm"><Phone size={14}/> {advisorProfile.phone}</p>
                                    ) : (
                                        <p className="text-slate-400 mt-1 flex items-center gap-2 text-sm"><Phone size={14}/> 請聯繫顧問</p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* === 第二頁以後：內容頁 === */}
            <div className="print-page content-page bg-white min-h-screen">
                
                {/* Header (標示) */}
                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-8 print-compact">
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Ultra Advisor System</span>
                    <span className="text-[10px] font-bold text-slate-400">Content Analysis</span>
                </div>

                {/* 內容渲染 */}
                <div className="w-full">
                    {activeTab === 'gift' ? (
                        <GiftReport data={data} />
                    ) : activeTab === 'estate' ? (
                        <EstateReport data={data} />
                    ) : activeTab === 'student' ? (
                        <StudentLoanReport data={data} />
                    ) : activeTab === 'super_active' ? (
                        <SuperActiveReport data={data} />
                    ) : (
                        /* 舊版型 Fallback */
                        <>
                            <div className="mb-8 print-break-inside print-compact">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <div className="w-1 h-6 bg-blue-600 rounded-full"></div>核心戰略指標
                                </h3>
                                <div className="grid grid-cols-5 gap-3">
                                    {reportContent.mindMap.map((item, idx) => (
                                        <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                                            <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wide">{item.label}</span>
                                            <span className="font-bold text-slate-800 text-sm block truncate">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="mb-8 print-break-inside print-compact">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <div className="w-1 h-6 bg-emerald-500 rounded-full"></div>資產趨勢模擬
                                </h3>
                                <div className="h-[300px] w-full border border-slate-100 rounded-2xl p-4 bg-white shadow-sm print-chart-container">
                                    <LegacyChartSection reportContent={reportContent} isPrinting={isPrinting} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-8 mb-8 print-break-inside print-compact">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
                                    執行階段
                                    </h3>
                                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-bold">
                                                <tr>
                                                    <th className="p-3 border-b border-slate-200">時間</th>
                                                    <th className="p-3 border-b border-slate-200">階段</th>
                                                    <th className="p-3 border-b border-slate-200">目標</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportContent.table.map((row: any, idx: number) => (
                                                    <tr key={idx} className="border-b border-slate-100 last:border-0">
                                                        <td className="p-3 font-bold text-slate-700">{row.label}</td>
                                                        <td className="p-3 text-slate-500">{row.col1}</td>
                                                        <td className="p-3 font-bold text-blue-600">{row.col2}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                                    專案亮點
                                    </h3>
                                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 h-full">
                                        <ul className="space-y-3">
                                            {reportContent.highlights.map((item: string, idx: number) => (
                                                <li key={idx} className="flex gap-2 items-start text-xs text-slate-700 leading-relaxed">
                                                    <CheckCircle2 size={14} className="text-purple-600 shrink-0 mt-0.5"/>
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Compliance disclaimer — CRITICAL #2 個資合規三件套.
                    Wrapped so the dark-theme component reads correctly on the
                    white A4 page; the inner component handles the legal copy. */}
                <div className="mt-6 print-break-inside [&_.bg-slate-900\\/40]:!bg-slate-50 [&_.border-slate-700\\/60]:!border-slate-200 [&_.text-slate-400]:!text-slate-600 [&_.text-slate-300]:!text-slate-800 [&_.text-slate-500]:!text-slate-500 [&_.bg-slate-800\\/80]:!bg-white [&_.border-slate-700]:!border-slate-200">
                    <DisclaimerFooter scope="calc" />
                </div>

                {/* Footer */}
                <div className="mt-4 print:mt-1 text-center text-[10px] text-slate-300 border-t border-slate-50 pt-4 print:mt-1">
                    <p>© {new Date().getFullYear()} Ultra Advisor System • Generated for {client?.name}</p>
                </div>
            </div>

        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReportModal;