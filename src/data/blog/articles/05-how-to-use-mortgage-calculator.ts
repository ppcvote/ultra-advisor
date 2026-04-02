import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '5',
  slug: 'how-to-use-mortgage-calculator',
  title: '傲創計算機使用教學：3 分鐘算出最佳房貸方案',
  excerpt: '手把手教您使用 Ultra Advisor 的免費房貸計算機，快速比較不同貸款條件下的總利息支出。',
  category: 'tools',
  tags: ['房貸計算機', '工具教學', 'Ultra Advisor', '傲創計算機', '房貸試算'],
  readTime: 5,
  publishDate: '2025-12-20',
  author: 'Ultra Advisor',
  featured: false,
  metaTitle: '傲創計算機教學：免費房貸試算工具使用指南【圖文教學】',
  metaDescription: '3分鐘學會使用傲創計算機。免費試算本金均攤、本息均攤、額外還款、通膨貼現等進階功能。',
  content: `
    <article class="prose prose-invert max-w-none">
      <p class="lead text-xl text-slate-300 mb-8">
        「傲創計算機」是 Ultra Advisor 提供的免費房貸試算工具，
        整合了房貸計算、複利試算、退休規劃、財務健檢四大功能。
        本文將教您如何使用房貸計算功能，快速比較不同貸款方案。
      </p>

      <div class="bg-emerald-900/30 border border-emerald-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-emerald-400 font-bold mb-3">🆓 完全免費</h4>
        <p class="text-slate-300">
          傲創計算機是<strong>完全免費</strong>的公開工具，不需要註冊或登入即可使用。
          <a href="/calculator" class="text-emerald-400 underline hover:text-emerald-300">立即前往試算 →</a>
        </p>
      </div>

      <h2 id="step1">Step 1：輸入基本貸款條件</h2>

      <p>開啟傲創計算機後，您會看到清爽的輸入介面。首先輸入以下基本資訊：</p>

      <div class="bg-slate-800 rounded-xl p-6 my-6">
        <h4 class="text-white font-bold mb-4">📝 需要輸入的資訊</h4>
        <ul class="text-slate-300 space-y-3">
          <li>
            <strong class="text-blue-400">貸款金額</strong>：您要貸款的總金額（萬元）
            <p class="text-slate-500 text-sm">例：房價 1,500 萬，頭款 300 萬，貸款 1,200 萬</p>
          </li>
          <li>
            <strong class="text-blue-400">貸款年期</strong>：還款的總年數
            <p class="text-slate-500 text-sm">常見選擇：20 年、30 年、40 年</p>
          </li>
          <li>
            <strong class="text-blue-400">年利率</strong>：銀行提供的貸款利率
            <p class="text-slate-500 text-sm">2026 年主流約 2.0% - 2.5%</p>
          </li>
          <li>
            <strong class="text-blue-400">還款方式</strong>：本息均攤或本金均攤
            <p class="text-slate-500 text-sm">不確定選哪個？兩種都試算比較看看</p>
          </li>
        </ul>
      </div>

      <h2 id="step2">Step 2：查看試算結果</h2>

      <p>輸入完成後，系統會即時顯示試算結果：</p>

      <ul>
        <li><strong>每月還款金額</strong>：您每個月需要繳納的房貸（本金均攤會顯示首月與末月）</li>
        <li><strong>總還款金額</strong>：貸款期間的總支出</li>
        <li><strong>總利息支出</strong>：您為這筆貸款支付的利息總額</li>
      </ul>

      <h2 id="step3">Step 3：使用進階功能</h2>

      <p>傲創計算機還提供多項進階功能，幫助您做更精細的規劃：</p>

      <h3>寬限期設定</h3>
      <p>
        許多銀行提供寬限期（只繳息不還本）。您可以設定寬限期年數，
        系統會計算寬限期內外的不同月付金。
      </p>

      <h3>額外還款試算</h3>
      <p>
        如果您計畫在某個時間點一次還款一筆錢（例如年終獎金），
        可以輸入額外還款金額，看看能省下多少利息。
      </p>

      <h3>通膨貼現分析</h3>
      <p>
        考慮通貨膨脹後，未來的還款「實質負擔」會逐年減輕。
        這個功能可以幫助您理解長年期貸款的實際成本。
      </p>

      <h3>年度還款明細表</h3>
      <p>
        想知道第 5 年還剩多少本金？第 10 年累計繳了多少利息？
        年度明細表提供逐年的詳細數據。
      </p>

      <h2 id="example">實戰範例</h2>

      <div class="bg-slate-800 rounded-xl p-6 my-6">
        <h4 class="text-white font-bold mb-4">📊 範例：比較兩種還款方式</h4>
        <p class="text-slate-400 mb-4">條件：貸款 1,000 萬、30 年、利率 2.1%</p>

        <div class="grid md:grid-cols-2 gap-4">
          <div class="bg-slate-900 rounded-lg p-4">
            <p class="text-blue-400 font-bold mb-2">本息均攤</p>
            <ul class="text-slate-300 text-sm space-y-1">
              <li>每月還款：37,811 元</li>
              <li>總利息：361 萬元</li>
            </ul>
          </div>
          <div class="bg-slate-900 rounded-lg p-4">
            <p class="text-emerald-400 font-bold mb-2">本金均攤</p>
            <ul class="text-slate-300 text-sm space-y-1">
              <li>首月還款：45,278 元</li>
              <li>末月還款：27,826 元</li>
              <li>總利息：316 萬元</li>
            </ul>
          </div>
        </div>

        <p class="text-emerald-400 font-bold mt-4">
          結論：本金均攤可省下約 45 萬元利息！
        </p>
      </div>

      <h2 id="tips">使用小技巧</h2>

      <ol>
        <li>
          <strong>多試幾個方案</strong><br/>
          試試不同年期、不同利率的組合，找到最適合您的方案
        </li>
        <li>
          <strong>記錄比較結果</strong><br/>
          可以截圖或記錄各方案的數據，方便比較
        </li>
        <li>
          <strong>考慮未來收入變化</strong><br/>
          選擇還款方式時，要評估未來收入是否能負擔
        </li>
        <li>
          <strong>別忽略其他費用</strong><br/>
          房貸還有開辦費、帳管費等，記得一併考慮
        </li>
      </ol>

      <div class="bg-purple-900/30 border border-purple-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-purple-400 font-bold mb-3">🛠️ 立即開始試算</h4>
        <p class="text-slate-300 mb-4">
          傲創計算機完全免費，不需要註冊即可使用。
          除了房貸計算，還有複利試算、退休規劃、財務健檢等功能。
        </p>
        <a href="/calculator" class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
          前往傲創計算機 →
        </a>
      </div>

      <h2 id="more-tools">需要更多專業工具？</h2>
      <p>
        傲創計算機是 Ultra Advisor 的免費工具。如果您是財務顧問或理財專業人士，
        歡迎試用我們的完整專業版，包含 18 種進階理財工具：
      </p>
      <ul>
        <li>大小水庫母子系統</li>
        <li>稅務傳承規劃</li>
        <li>百萬禮物計畫</li>
        <li>勞退破產倒數</li>
        <li>...等 14 種專業工具</li>
      </ul>

      <p>
        <a href="/register" class="text-blue-400 underline hover:text-blue-300">
          免費試用 7 天完整版 →
        </a>
      </p>
      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>→ <a href="/blog/mortgage-principal-vs-equal-payment" class="text-blue-400 hover:underline">本金均攤 vs 本息均攤：房貸還款方式完整比較【2026 最新】</a></li>
          <li>→ <a href="/blog/bank-mortgage-rates-comparison-2026" class="text-blue-400 hover:underline">2026 各銀行房貸利率比較表｜首購、青安、轉貸利率總整理</a></li>
          <li>→ <a href="/blog/mortgage-refinance-cost-2026" class="text-blue-400 hover:underline">2026 房貸轉貸成本試算｜利差多少才划算？完整費用分析</a></li>
        </ul>
      </div>

<p class="text-slate-500 text-sm mt-12">
        最後更新：2025 年 12 月 20 日<br/>
        如有任何使用問題，歡迎透過 LINE 官方帳號聯繫我們。
      </p>
    </article>
  `
};
