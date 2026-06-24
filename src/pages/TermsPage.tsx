import React from 'react';
import { ChevronLeft, FileText, AlertTriangle } from 'lucide-react';

// Terms of service.
// Deliberately conservative — we promise things we can actually keep
// (7-day cooling-off per 消保法 §19, no contract lock-in, monthly billing).
// 免責 + 顧問責任 sections are explicit so we don't end up holding the bag
// when a 顧問 misuses a 試算 as a sales tool against their client.

interface TermsPageProps {
  onBack?: () => void;
}

const Article: React.FC<{ id?: string; number: string; title: string; children: React.ReactNode }> = ({
  id,
  number,
  title,
  children,
}) => (
  <section id={id} className="mb-9">
    <h2 className="text-lg md:text-xl font-bold text-slate-100 mb-3 pb-2 border-b border-slate-700/60">
      <span className="text-blue-400 mr-2">第 {number} 條</span>
      {title}
    </h2>
    <div className="space-y-3 text-slate-300 leading-relaxed text-[15px]">{children}</div>
  </section>
);

const TermsPage: React.FC<TermsPageProps> = ({ onBack }) => {
  const lastUpdated = '2026-06';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-12">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors mb-6 text-sm"
          >
            <ChevronLeft size={16} />
            返回
          </button>
        )}

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-700/40 border border-slate-600 text-slate-300 text-xs font-medium mb-4">
            <FileText size={14} />
            服務條款
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Ultra Advisor 服務條款</h1>
          <p className="text-slate-400 text-sm">最後更新：{lastUpdated}</p>
        </header>

        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 md:p-5 mb-10 text-sm text-slate-300">
          <p>
            歡迎使用 Ultra Advisor（以下簡稱「本服務」）。本服務由
            <strong className="text-slate-100">傲創實業有限公司</strong>（以下簡稱「本公司」）營運。
            完成註冊或開始使用本服務即視為您已閱讀、理解並同意本條款全部內容。
          </p>
        </div>

        <Article number="1" title="服務性質">
          <p>
            本服務為「軟體即服務（SaaS）」，提供財務顧問使用之線上工具，包含但不限於：
            客戶資料管理、財務試算、視覺化報告產出、市場資訊整合等。
          </p>
          <p>
            本服務為訂閱制，採月繳或年繳方式收費。各方案內容、價格與功能差異
            以註冊頁面或方案頁面當時公告為準。
          </p>
        </Article>

        <Article number="2" title="帳號管理">
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>每一付費帳號最多同時於兩台裝置登入；本公司保留於偵測到異常共享時要求重新登入之權利。</li>
            <li>您應自行妥善保管帳號密碼，因密碼外洩造成之損失由帳號持有人承擔。</li>
            <li>禁止將帳號出借、轉售、與他人共用；違反者本公司得逕行終止服務且不退費。</li>
          </ul>
        </Article>

        <Article number="3" title="計費與退款">
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>
              <strong className="text-slate-100">7 日無條件解除權</strong>：
              依消費者保護法第 19 條，您於收受服務（完成付款並可開始使用）後 7 日內，
              得無條件、不附理由解除本契約。請來信
              <a href="mailto:risky9763@gmail.com" className="text-blue-400 hover:text-blue-300 mx-1">risky9763@gmail.com</a>
              通知本公司，本公司將於知悉解除之意思表示後 15 日內退還全部已付價金；
              該段期間之服務存取不影響解除權之行使。
            </li>
            <li>
              <strong className="text-slate-100">7 日後之退費</strong>：
              逾鑑賞期後，月繳會員可隨時取消後續扣款；當期已付費用使用至期末，
              不另退費。年繳會員得申請按未使用「整月」比例退款，計算方式為：
              <span className="block mt-1 ml-2 text-slate-100">
                退款金額 = 年繳價金 ÷ 12 × 剩餘整月數
              </span>
              不另扣除年繳折扣差額（依消保法第 17 條，定型化契約不得加重消費者責任）。
            </li>
            <li>
              <strong className="text-slate-100">不綁約</strong>：
              本服務不設定最低使用期間，您可隨時於後台終止訂閱，無提前終止違約金。
            </li>
            <li>付款由第三方金流商 Portaly 處理，發票依電子發票法規定開立。</li>
          </ul>
        </Article>

        <Article number="4" title="智慧財產">
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>
              本服務之軟體、設計、商標、文案、計算邏輯、教學內容等智慧財產權，
              均歸<strong className="text-slate-100">本公司</strong>所有。
            </li>
            <li>
              顧問於本服務中建立之<strong className="text-slate-100">客戶資料、規劃內容</strong>，
              其著作權歸該顧問所有；本公司僅就提供服務所必需之範圍內取得處理權限。
            </li>
            <li>未經本公司書面同意，禁止以爬蟲、自動化工具大量擷取本服務資料或將其用於開發競品。</li>
          </ul>
        </Article>

        <Article number="5" title="服務變更與終止">
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>本公司得依產品發展調整功能、定價或方案內容，重大變更將於生效前 14 日公告。</li>
            <li>因不可抗力（天災、戰爭、主管機關命令、第三方服務中斷等）導致服務暫停，本公司不負損害賠償責任。</li>
            <li>您可隨時於後台終止帳號；本公司亦得於您違反本條款時，經通知後終止服務。</li>
            <li>帳號終止後，依《隱私權政策》處理您的個人資料；客戶資料之轉出請於終止前自行匯出。</li>
          </ul>
        </Article>

        <Article number="6" title="免責聲明">
          <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-4 md:p-5">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle size={18} className="text-amber-300 flex-shrink-0 mt-0.5" />
              <p className="text-amber-200 font-semibold">本平台不構成任何投資或保險商品推薦</p>
            </div>
            <ul className="list-disc list-inside space-y-2 ml-1 text-slate-300">
              <li>
                本服務提供之試算工具、計算結果、市場資訊、規劃模板，
                <strong className="text-slate-100">僅供教育與規劃參考</strong>，
                不構成投資建議、保險商品推薦、稅務諮詢或法律意見。
              </li>
              <li>
                計算結果之假設參數（利率、報酬率、稅率、平均餘命等）為通用模型，
                實際情況可能因法令變動、市場波動、個人因素而有差異。
              </li>
              <li>
                最終財務決策應由使用者及其客戶基於專業判斷做成，並建議洽詢合格之
                會計師、律師、保險業務員或證券分析師確認。
              </li>
              <li>
                本公司不保證本服務無錯誤或不中斷；對因使用本服務所致之任何直接或間接損失，
                以法律允許之最大範圍內排除責任。
              </li>
            </ul>
          </div>
        </Article>

        <Article number="7" title="顧問責任">
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>
              顧問使用本服務向其客戶提供任何規劃、報告、建議時，
              應遵守 IARFC（國際財務顧問認證協會）倫理守則及金融監督管理委員會、
              保險局、證期局等主管機關之相關規範。
            </li>
            <li>
              顧問須自負取得客戶書面同意之責，方得將客戶個資輸入本平台（詳見《隱私權政策》六）。
            </li>
            <li>
              顧問展示給客戶之內容（包含但不限於試算結果、報告 PDF、行銷話術），
              其正確性、合適性與法令遵循責任由顧問自負，
              <strong className="text-slate-100">本公司不對顧問展示內容負責</strong>。
            </li>
            <li>
              顧問不得使用本平台從事招攬非法商品、虛偽不實陳述、誤導性銷售等行為；
              本公司若發現有此情形，得逕行停權並通報相關主管機關。
            </li>
          </ul>
        </Article>

        <Article number="8" title="準據法與管轄法院">
          <p>
            本條款依<strong className="text-slate-100">中華民國法律</strong>解釋之。
            因本服務所生爭議，雙方同意以
            <strong className="text-slate-100">臺灣臺北地方法院</strong>
            為第一審管轄法院。
          </p>
        </Article>

        <Article number="9" title="條款變更">
          <p>
            本條款修訂時，將於本頁更新「最後更新日」並於登入後以站內通知告知。
            如您不同意修訂內容，得於修訂生效前終止帳號；繼續使用視為同意。
          </p>
        </Article>

        <footer className="mt-12 pt-6 border-t border-slate-800 text-slate-500 text-xs">
          <p>傲創實業有限公司　Ultra Creation Co., Ltd.</p>
          <p className="mt-1">如有任何問題，請來信 risky9763@gmail.com。</p>
        </footer>
      </div>
    </div>
  );
};

export default TermsPage;
