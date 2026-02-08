/**
 * PDF 匯出元件
 * 使用 html2canvas + jsPDF 匯出健診報告
 */
import React, { useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { FamilyMember, MergedCoverage, CoverageGapAnalysis } from '../../types/insurance';

interface CheckupReportPdfProps {
  familyName: string;
  members: FamilyMember[];
  coverageMap: Record<string, MergedCoverage>;
  gapAnalysis: Record<string, CoverageGapAnalysis>;
  totalPolicies: number;
  totalAnnualPremium: number;
  familyScore: number;
}

export default function CheckupReportPdf({
  familyName,
  members,
  coverageMap,
  gapAnalysis,
  totalPolicies,
  totalAnnualPremium,
  familyScore,
}: CheckupReportPdfProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!reportRef.current) return;
    setExporting(true);

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${familyName}_保單健診報告_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF 匯出失敗:', err);
      alert('PDF 匯出失敗，請稍後再試');
    } finally {
      setExporting(false);
    }
  };

  const fmt = (n: number) => {
    if (n >= 10000) return `${(n / 10000).toFixed(0)} 萬`;
    return n.toLocaleString();
  };

  return (
    <>
      <button
        onClick={handleExport}
        disabled={exporting}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        {exporting ? '匯出中...' : '匯出 PDF'}
      </button>

      {/* 隱藏的報告內容（供 html2canvas 擷取） */}
      <div className="fixed left-[-9999px] top-0">
        <div ref={reportRef} className="bg-white p-8" style={{ width: '800px' }}>
          {/* 標題 */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              {familyName} — 保單健診報告
            </h1>
            <p className="text-sm text-slate-500">
              產出日期：{new Date().toLocaleDateString('zh-TW')} · Ultra Advisor
            </p>
          </div>

          {/* 總覽 */}
          <div className="flex gap-6 mb-8 justify-center">
            <div className="text-center px-6 py-4 bg-blue-50 rounded-xl">
              <div className="text-3xl font-bold text-blue-600">{familyScore}</div>
              <div className="text-sm text-blue-500">保障分數</div>
            </div>
            <div className="text-center px-6 py-4 bg-slate-50 rounded-xl">
              <div className="text-3xl font-bold text-slate-700">{totalPolicies}</div>
              <div className="text-sm text-slate-500">張保單</div>
            </div>
            <div className="text-center px-6 py-4 bg-slate-50 rounded-xl">
              <div className="text-2xl font-bold text-slate-700">{fmt(totalAnnualPremium)}</div>
              <div className="text-sm text-slate-500">年繳保費</div>
            </div>
          </div>

          {/* 各成員分析 */}
          {members.map(member => {
            const merged = coverageMap[member.id];
            const analysis = gapAnalysis[member.id];
            if (!merged || !analysis) return null;

            return (
              <div key={member.id} className="mb-8 border-t pt-6">
                <h2 className="text-lg font-bold text-slate-800 mb-3">
                  {member.name}
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    保障分數 {analysis.score} 分 · {merged.policies.length} 張保單
                  </span>
                </h2>

                {/* 保障金額 */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: '壽險', value: merged.totalCoverage.death },
                    { label: '意外', value: merged.totalCoverage.accidentDeath },
                    { label: '重疾', value: merged.totalCoverage.criticalIllness },
                    { label: '癌症', value: merged.totalCoverage.cancer },
                    { label: '住院日額', value: merged.totalCoverage.hospitalDailyIllness },
                    { label: '實支實付', value: merged.totalCoverage.medicalExpense },
                    { label: '失能', value: merged.totalCoverage.disability },
                    { label: '長照', value: merged.totalCoverage.longTermCare },
                  ].map(item => (
                    <div key={item.label} className="text-center p-2 bg-slate-50 rounded-lg">
                      <div className="text-xs text-slate-500">{item.label}</div>
                      <div className={`text-sm font-bold ${item.value > 0 ? 'text-slate-700' : 'text-red-400'}`}>
                        {item.value > 0 ? fmt(item.value) : '-'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 缺口 */}
                {analysis.gaps.length > 0 && (
                  <div className="space-y-2">
                    {analysis.gaps.map((gap, i) => (
                      <div
                        key={i}
                        className={`text-sm px-3 py-2 rounded-lg ${
                          gap.severity === 'critical' ? 'bg-red-50 text-red-700' :
                          gap.severity === 'warning' ? 'bg-amber-50 text-amber-700' :
                          'bg-blue-50 text-blue-700'
                        }`}
                      >
                        <span className="font-bold mr-1">
                          {gap.severity === 'critical' ? '【急需補強】' :
                           gap.severity === 'warning' ? '【建議加強】' : '【提醒】'}
                        </span>
                        {gap.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* 頁尾 */}
          <div className="border-t pt-4 mt-8 text-center text-xs text-slate-400">
            本報告由 Ultra Advisor 保單健診系統自動產生，僅供參考，不構成投資建議。
          </div>
        </div>
      </div>
    </>
  );
}
