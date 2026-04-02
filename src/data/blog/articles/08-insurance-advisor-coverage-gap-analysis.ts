import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '8',
  slug: 'insurance-advisor-coverage-gap-analysis',
  title: '壽險顧問必學：5 步驟完成客戶保障缺口分析',
  excerpt: '客戶總說「我保險買夠了」？學會專業的保障缺口分析，用數據告訴客戶真正的保障需求，讓拒絕變成信任。',
  category: 'tools',
  tags: ['壽險顧問', '保障缺口', '保險規劃', '需求分析', '保險銷售', 'IFA'],
  readTime: 9,
  publishDate: '2026-01-17',
  author: 'Ultra Advisor',
  featured: false,
  metaTitle: '壽險顧問保障缺口分析完整教學：5 步驟讓客戶看到真正需求',
  metaDescription: '專業壽險顧問的需求分析技巧。5 步驟完成保障缺口分析，用數據取代話術，讓「我保險夠了」變成「原來我還需要這個」。',
  content: `
    <article class="prose prose-invert max-w-none">
      <p class="lead text-xl text-slate-300 mb-8">
        「我保險買很多了，不需要了。」<br/>
        「等我有錢再說。」<br/>
        「保險都是騙人的。」<br/><br/>
        這些拒絕聽起來很絕對，但其實背後都藏著一個共同原因：
        <strong>客戶不知道自己真正需要什麼</strong>。
      </p>

      <h2 id="why-gap-analysis">一、為什麼要做保障缺口分析？</h2>

      <h3>從「推銷」變成「診斷」</h3>
      <p>
        傳統的保險銷售是「我有一個很棒的商品，你要不要買？」
        這種方式讓客戶處於被動，自然會產生防禦心理。
      </p>
      <p>
        保障缺口分析則是「讓我們一起看看你的保障狀況，有沒有需要補強的地方。」
        這是<strong>顧問式銷售</strong>，客戶會覺得你在幫他，而不是賣他東西。
      </p>

      <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-blue-400 font-bold mb-3">💡 心態轉換</h4>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-700">
              <th class="text-left py-2 text-slate-400">傳統銷售</th>
              <th class="text-left py-2 text-emerald-400">顧問式銷售</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="py-2 text-slate-400">「這張保單很好」</td>
              <td class="py-2 text-slate-300">「讓我們看看你需要什麼」</td>
            </tr>
            <tr>
              <td class="py-2 text-slate-400">「現在買最划算」</td>
              <td class="py-2 text-slate-300">「根據分析，這是優先順序」</td>
            </tr>
            <tr>
              <td class="py-2 text-slate-400">「相信我」</td>
              <td class="py-2 text-slate-300">「數據顯示」</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="five-steps">二、保障缺口分析 5 步驟</h2>

      <h3>Step 1：收集客戶基本資料</h3>
      <p>需要了解的資訊包括：</p>
      <ul>
        <li><strong>家庭結構</strong>：婚姻狀況、子女數量與年齡、父母是否需要扶養</li>
        <li><strong>收入狀況</strong>：家庭月收入、主要收入來源</li>
        <li><strong>負債狀況</strong>：房貸餘額、車貸、其他貸款</li>
        <li><strong>現有保障</strong>：已購買的保險明細（險種、保額、年繳保費）</li>
      </ul>

      <h3>Step 2：計算「遺族需求」</h3>
      <p>
        如果客戶（主要收入者）發生意外，家人需要多少錢才能維持生活？
      </p>

      <div class="bg-slate-800 rounded-xl p-6 my-6">
        <h4 class="text-white font-bold mb-4">📊 遺族需求計算公式</h4>
        <ul class="text-slate-300 space-y-2">
          <li><strong>生活費需求</strong> = 月支出 × 12 × 需要年數</li>
          <li><strong>子女教育金</strong> = 每年學費 × 剩餘就學年數</li>
          <li><strong>負債清償</strong> = 房貸餘額 + 其他負債</li>
          <li><strong>喪葬費用</strong> = 約 30-50 萬</li>
        </ul>
        <p class="text-amber-400 font-bold mt-4">
          遺族需求總額 = 以上四項加總
        </p>
      </div>

      <h3>Step 3：計算「現有保障」</h3>
      <p>盤點客戶目前的保障來源：</p>
      <ul>
        <li><strong>壽險保額</strong>：定期壽險 + 終身壽險 + 意外險身故</li>
        <li><strong>團體保險</strong>：公司提供的團險保障</li>
        <li><strong>社會保險</strong>：勞保死亡給付（約 100-200 萬）</li>
        <li><strong>現有資產</strong>：存款、投資、不動產（可變現部分）</li>
      </ul>

      <h3>Step 4：計算「保障缺口」</h3>

      <div class="bg-red-900/30 border border-red-500/30 rounded-2xl p-6 my-6">
        <h4 class="text-red-400 font-bold mb-3">🔴 保障缺口公式</h4>
        <p class="text-white text-xl font-mono">
          保障缺口 = 遺族需求 - 現有保障
        </p>
        <p class="text-slate-400 text-sm mt-2">
          如果結果為正數，表示保障不足；負數表示保障充足。
        </p>
      </div>

      <h3>Step 5：視覺化呈現</h3>
      <p>
        把計算結果做成<strong>一張簡單的圖表</strong>，讓客戶一眼看到：
      </p>
      <ul>
        <li>左邊柱狀圖：遺族需求總額（紅色/橘色）</li>
        <li>右邊柱狀圖：現有保障總額（綠色/藍色）</li>
        <li>中間落差：保障缺口（用箭頭標示）</li>
      </ul>
      <p>
        這張圖會讓客戶從「我不需要保險」變成「原來我還差這麼多」。
      </p>

      <h2 id="real-case">三、實戰案例演練</h2>

      <div class="bg-slate-800 rounded-xl p-6 my-6">
        <h4 class="text-white font-bold mb-4">📋 案例：王先生的保障缺口分析</h4>

        <p class="text-slate-400 mb-4"><strong>基本資料</strong></p>
        <ul class="text-slate-300 text-sm space-y-1 mb-4">
          <li>年齡：35 歲，已婚，育有 2 子（5 歲、3 歲）</li>
          <li>職業：科技業工程師，年收入 150 萬</li>
          <li>家庭月支出：8 萬元</li>
          <li>房貸餘額：800 萬元</li>
          <li>現有保險：公司團險壽險 100 萬、自己買的終身壽險 200 萬</li>
        </ul>

        <p class="text-slate-400 mb-2"><strong>Step 2：遺族需求計算</strong></p>
        <table class="w-full text-sm mb-4">
          <tbody>
            <tr>
              <td class="py-1 text-slate-400">生活費（8萬×12×20年）</td>
              <td class="py-1 text-right text-white">1,920 萬</td>
            </tr>
            <tr>
              <td class="py-1 text-slate-400">子女教育金</td>
              <td class="py-1 text-right text-white">400 萬</td>
            </tr>
            <tr>
              <td class="py-1 text-slate-400">房貸餘額</td>
              <td class="py-1 text-right text-white">800 萬</td>
            </tr>
            <tr>
              <td class="py-1 text-slate-400">喪葬費用</td>
              <td class="py-1 text-right text-white">50 萬</td>
            </tr>
            <tr class="border-t border-slate-700">
              <td class="py-2 text-amber-400 font-bold">遺族需求總額</td>
              <td class="py-2 text-right text-amber-400 font-bold">3,170 萬</td>
            </tr>
          </tbody>
        </table>

        <p class="text-slate-400 mb-2"><strong>Step 3：現有保障</strong></p>
        <table class="w-full text-sm mb-4">
          <tbody>
            <tr>
              <td class="py-1 text-slate-400">公司團險</td>
              <td class="py-1 text-right text-white">100 萬</td>
            </tr>
            <tr>
              <td class="py-1 text-slate-400">終身壽險</td>
              <td class="py-1 text-right text-white">200 萬</td>
            </tr>
            <tr>
              <td class="py-1 text-slate-400">勞保死亡給付（估）</td>
              <td class="py-1 text-right text-white">150 萬</td>
            </tr>
            <tr>
              <td class="py-1 text-slate-400">存款</td>
              <td class="py-1 text-right text-white">200 萬</td>
            </tr>
            <tr class="border-t border-slate-700">
              <td class="py-2 text-emerald-400 font-bold">現有保障總額</td>
              <td class="py-2 text-right text-emerald-400 font-bold">650 萬</td>
            </tr>
          </tbody>
        </table>

        <p class="text-slate-400 mb-2"><strong>Step 4：保障缺口</strong></p>
        <p class="text-white text-lg">
          3,170 萬 - 650 萬 = <strong class="text-2xl text-red-400">2,520 萬</strong>
        </p>

        <p class="text-slate-400 mt-4 text-sm">
          王先生的保障缺口高達 2,520 萬。這意味著如果他發生意外，
          太太和孩子可能面臨房子被法拍、孩子教育中斷的風險。
        </p>
      </div>

      <h2 id="handling-objections">四、常見異議處理</h2>

      <h3>「我覺得不會那麼倒楣」</h3>
      <p>
        「王先生，我也希望您永遠用不到這些保障。但身為家庭的經濟支柱，
        這不是買給自己的，是買給太太和孩子的。就像我們買行車紀錄器，
        不是希望出車禍，是萬一發生時有個保障。」
      </p>

      <h3>「保費太貴了」</h3>
      <p>
        「我完全理解預算的考量。好消息是，我們不需要一次補足 2,520 萬的缺口。
        可以用<strong>定期壽險</strong>來補，保費只有終身壽險的 1/10。
        補足 2,000 萬的缺口，每月大約只要 3,000 元。」
      </p>

      <h3>「我再考慮一下」</h3>
      <p>
        「當然，這是重要的決定。不過我想請您思考一個問題：
        如果今天晚上發生意外，太太面對 800 萬房貸和兩個孩子的教育費，
        她會怎麼辦？保障缺口不會因為我們『再考慮』就消失。」
      </p>

      <div class="bg-purple-900/30 border border-purple-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-purple-400 font-bold mb-3">🛠️ 讓系統幫你算</h4>
        <p class="text-slate-300 mb-4">
          手動計算保障缺口很花時間？Ultra Advisor 的保障需求分析工具，
          只要輸入客戶基本資料，3 分鐘自動產出專業的缺口分析報告。
        </p>
        <ul class="text-slate-300 text-sm mb-4 space-y-1">
          <li>✓ 自動計算遺族需求</li>
          <li>✓ 視覺化缺口圖表</li>
          <li>✓ 可匯出 PDF 給客戶</li>
        </ul>
        <a href="/register" class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
          免費試用 7 天 →
        </a>
      </div>

      <h2 id="conclusion">結語</h2>
      <p>
        保障缺口分析不只是銷售技巧，更是專業顧問的責任。
        當你能清楚地告訴客戶「你需要什麼、為什麼需要」，
        你就不再是推銷員，而是他們家庭財務安全的守護者。
      </p>
      <p>
        記住：<strong>數據會說話</strong>。讓數據替你開口，成交自然水到渠成。
      </p>
      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>→ <a href="/blog/financial-advisor-data-visualization-sales" class="text-blue-400 hover:underline">業績提升秘訣：財務顧問如何善用數據視覺化</a></li>
          <li>→ <a href="/blog/financial-advisor-objection-handling-scripts" class="text-blue-400 hover:underline">財務顧問異議處理話術｜十大常見拒絕的回應方式</a></li>
          <li>→ <a href="/blog/financial-health-check-client-trust" class="text-blue-400 hover:underline">用「財務健檢」打開話題：建立客戶信任的第一步</a></li>
        </ul>
      </div>

<p class="text-slate-500 text-sm mt-12">
        最後更新：2026 年 1 月 17 日<br/>
        本文為保險從業人員專業分享，不構成任何保險購買建議。
      </p>
    </article>
  `
};
