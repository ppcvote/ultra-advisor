import React from 'react';
import { ChevronLeft, ShieldCheck, Mail } from 'lucide-react';

// Privacy policy page.
// Drafted to satisfy 個資法 §8 ("告知五要項"): identity, purpose, categories,
// utilization scope, and data-subject rights. Wording is intentionally
// conservative — we describe what the platform actually does today, not
// aspirational features. Advisor-vs-client data is split because the legal
// posture differs (顧問是當事人，客戶資料的當事人是顧問的客戶 — 顧問須自負取
// 得書面授權之責，平台是受託處理).

interface PrivacyPageProps {
  onBack?: () => void;
}

const Section: React.FC<{ id?: string; title: string; children: React.ReactNode }> = ({
  id,
  title,
  children,
}) => (
  <section id={id} className="mb-10">
    <h2 className="text-xl md:text-2xl font-bold text-slate-100 mb-4 pb-2 border-b border-slate-700/60">
      {title}
    </h2>
    <div className="space-y-3 text-slate-300 leading-relaxed text-[15px]">{children}</div>
  </section>
);

const PrivacyPage: React.FC<PrivacyPageProps> = ({ onBack }) => {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium mb-4">
            <ShieldCheck size={14} />
            個人資料保護政策
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">隱私權政策</h1>
          <p className="text-slate-400 text-sm">
            最後更新：{lastUpdated}　·　依據中華民國《個人資料保護法》第 8 條告知義務
          </p>
        </header>

        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 md:p-5 mb-10 text-sm text-slate-300">
          <p className="mb-2 text-slate-200 font-semibold">摘要</p>
          <p>
            Ultra Advisor（以下簡稱「本平台」）為「傲創實業有限公司」提供之財務顧問 SaaS 服務。
            本政策說明我們如何蒐集、處理、利用「顧問本人」及「顧問匯入之客戶資料」，
            並告知您依個資法享有的權利。
          </p>
        </div>

        <Section id="identity" title="一、蒐集機關名稱">
          <p>
            <strong className="text-slate-100">傲創實業有限公司</strong>
            （Ultra Creation Co., Ltd.，以下簡稱「本公司」），為 Ultra Advisor 平台之經營單位。
          </p>
          <p>
            聯絡方式：
            <a
              href="mailto:risky9763@gmail.com"
              className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mx-1"
            >
              <Mail size={14} />
              risky9763@gmail.com
            </a>
          </p>
        </Section>

        <Section id="purpose" title="二、蒐集目的">
          <p>本平台基於下列目的蒐集您的個人資料：</p>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>提供財務顧問 SaaS 服務（會員註冊、登入、計費）</li>
            <li>協助顧問管理其客戶資料、產出財務視覺化報告</li>
            <li>系統運作、客服支援、帳務處理與糾紛處理</li>
            <li>產品改善之內部分析（去識別化後）</li>
            <li>依法令或主管機關要求之配合事項</li>
          </ul>
          <p className="text-slate-400 text-sm">
            對應個資法特定目的代號：040（行銷）、069（契約、類似契約或其他法律關係事務）、
            090（消費者、客戶管理與服務）、152（會計師、律師、智慧財產代理人）。
          </p>
        </Section>

        <Section id="categories" title="三、個人資料類別">
          <div>
            <h3 className="text-slate-100 font-semibold mb-2">3.1 顧問本人（會員）</h3>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>識別資料：姓名、Email、手機、LINE ID（若您選擇綁定）</li>
              <li>專業資料：證照類型（IARFC / RFC / 壽險 / 產險等）、登錄字號（選填）</li>
              <li>帳務資料：訂閱方案、付款紀錄（透過第三方金流商 Portaly 處理）</li>
              <li>使用紀錄：登入時間、IP、瀏覽器、使用之工具紀錄</li>
            </ul>
          </div>

          <div>
            <h3 className="text-slate-100 font-semibold mb-2">3.2 顧問匯入之客戶資料</h3>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>識別資料：姓名、年齡、聯絡方式（如顧問選擇輸入）</li>
              <li>家庭資料：配偶、子女、父母等家庭成員之姓名與年齡</li>
              <li>財務資料：收入、資產配置、保單、不動產、貸款等</li>
              <li>規劃紀錄：顧問為該客戶建立之試算結果與規劃方案</li>
            </ul>
          </div>
        </Section>

        <Section id="usage" title="四、利用期間、地區、對象、方式">
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>
              <strong className="text-slate-100">利用期間</strong>：
              自您註冊起至帳號終止後三年（或法令要求之保存期間）為止。帳號終止後，
              本平台將於合理期間內刪除或匿名化處理。
            </li>
            <li>
              <strong className="text-slate-100">儲存地區</strong>：
              資料儲存於 Google Firebase 亞洲東部一區（asia-east1，台灣彰化資料中心）。
            </li>
            <li>
              <strong className="text-slate-100">利用對象</strong>：
              限於本公司、必要之系統服務商（Firebase / Vercel / Portaly / Resend）、
              以及您本人（顧問）。本平台不對第三方銷售或揭露個人資料。
            </li>
            <li>
              <strong className="text-slate-100">利用方式</strong>：
              用於提供服務本身、後台之去識別化統計分析、必要之客服與帳務溝通。
            </li>
          </ul>
        </Section>

        <Section id="rights" title="五、當事人權利">
          <p>依個資法第 3 條規定，您就本公司保有您的個人資料享有下列權利（同條第 7 款及第 8 條告知義務範圍）：</p>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>查詢或請求閱覽</li>
            <li>請求製給複製本</li>
            <li>請求補充或更正</li>
            <li>請求停止蒐集、處理或利用</li>
            <li>請求刪除</li>
            <li>依個資法第 20 條第 2 項，拒絕本公司為行銷之利用</li>
          </ul>
          <p>
            行使上述權利，請來信
            <a
              href="mailto:risky9763@gmail.com"
              className="text-blue-400 hover:text-blue-300 mx-1"
            >
              risky9763@gmail.com
            </a>
            ，我們將於 30 日內回應。本公司不會因您行使權利而拒絕提供服務（但停止處理之請求可能影響
            服務可用性，此情形我們會事先告知）。
          </p>
        </Section>

        <Section id="client-data" title="六、客戶資料的特殊規範">
          <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-4 md:p-5">
            <p className="text-amber-200 font-semibold mb-3">
              重要：顧問須自負取得客戶書面授權之責
            </p>
            <ul className="list-disc list-inside space-y-2 ml-1 text-slate-300">
              <li>
                顧問於本平台輸入之「客戶資料」，其當事人為該客戶本人，並非顧問。
              </li>
              <li>
                顧問須自行依個資法第 19 條、第 20 條規定，取得客戶之
                <strong className="text-slate-100">書面同意</strong>，
                方得將其個人資料輸入本平台處理。
              </li>
              <li>
                本平台於此關係中為「<strong className="text-slate-100">受託處理者</strong>」
                （依個資法施行細則第 8 條），僅依顧問指示處理資料，不直接與客戶建立關係。
              </li>
              <li>
                若客戶向本公司主張當事人權利，本公司將通知顧問共同處理，
                必要時得依本公司判斷直接刪除該筆資料。
              </li>
              <li>
                顧問如違反個資法導致客戶受損，相關責任由顧問承擔；
                本平台保留於發現違法情形時暫停或終止帳號之權利。
              </li>
            </ul>
          </div>
        </Section>

        <Section id="cookies" title="七、Cookie 與追蹤技術">
          <p>
            本平台使用 Cookie 維持登入狀態與偏好設定，並使用 PostHog / Sentry 等工具收集
            匿名使用行為與錯誤資訊，以改善產品。您可於瀏覽器設定中拒絕 Cookie，
            但部分功能可能因此受限。會話錄影（session replay）已預設遮罩所有輸入欄位與文字內容，
            不會錄製任何客戶資料、金額或保單數字。
          </p>
        </Section>

        <Section id="security" title="八、資料安全（個資法第 27 條）">
          <p>
            依個資法第 27 條及施行細則第 12 條，本公司就所保有之個人資料採取下列安全維護措施：
          </p>
          <ul className="list-disc list-inside space-y-1.5 ml-2">
            <li>傳輸層：全站 HTTPS / TLS 1.2 以上加密</li>
            <li>身分認證：Firebase Authentication，密碼以加密單向雜湊保存</li>
            <li>存取控制：Firestore Security Rules 最小權限原則，依使用者 uid 隔離</li>
            <li>靜態儲存：Firebase 預設之 Google Cloud KMS 等級加密</li>
            <li>地理位置：資料中心位於 asia-east1（台灣彰化）</li>
            <li>外洩通報：發現重大個資外洩事件，將於知悉後 72 小時內以站內通知與電子郵件告知受影響當事人，並依主管機關規定辦理通報</li>
            <li>委外管理：使用之委外服務（Firebase / Vercel / Sentry / PostHog 等）皆與其簽訂或依其標準資料處理條款處理</li>
            <li>員工保密：本公司員工及承攬人員均負保密義務，違者依民事與刑事責任處理</li>
            <li>定期檢視：每季檢視安全維護計畫並就重大事件進行內部演練</li>
          </ul>
          <p className="mt-3">
            須誠實告知：網際網路傳輸無法保證 100% 安全，本公司於合理範圍內盡其善良管理人之注意義務。
          </p>
        </Section>

        <Section id="changes" title="九、政策變更">
          <p>
            本政策修訂時，將於本頁更新「最後更新日」並於登入後以站內通知告知。
            重大變更（例如資料利用對象變更）將於生效前 7 日通知。
          </p>
        </Section>

        <Section id="contact" title="十、聯絡我們">
          <p>
            如對本政策有任何疑問或行使當事人權利，請來信
            <a
              href="mailto:risky9763@gmail.com"
              className="text-blue-400 hover:text-blue-300 mx-1"
            >
              risky9763@gmail.com
            </a>
            ，主旨請註明「Ultra Advisor 個資查詢」。
          </p>
        </Section>

        <footer className="mt-12 pt-6 border-t border-slate-800 text-slate-500 text-xs">
          <p>傲創實業有限公司　Ultra Creation Co., Ltd.</p>
          <p className="mt-1">本政策依中華民國法律解釋之。</p>
        </footer>
      </div>
    </div>
  );
};

export default PrivacyPage;
