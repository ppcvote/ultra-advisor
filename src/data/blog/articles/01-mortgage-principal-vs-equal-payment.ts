import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '1',
  slug: 'mortgage-principal-vs-equal-payment',
  title: '本金均攤 vs 本息均攤：房貸還款方式完整比較【2026 最新】',
  excerpt: '房貸還款方式選擇是購屋時的重要決定。本文詳細比較本金均攤與本息均攤的差異，幫助您做出最適合的選擇。',
  category: 'mortgage',
  tags: ['房貸', '本金均攤', '本息均攤', '還款方式', '房貸利率', '房貸計算'],
  readTime: 8,
  publishDate: '2026-01-15',
  author: 'Ultra Advisor',
  featured: true,
  metaTitle: '本金均攤 vs 本息均攤完整比較 | 房貸還款方式怎麼選？【2026】',
  metaDescription: '詳細比較本金均攤與本息均攤的利息差異、月付金變化、適合對象。附實際案例計算，幫助您選擇最省息的房貸還款方式。',
  content: `
    <article class="prose prose-invert max-w-none">
      <p class="lead text-xl text-slate-300 mb-8">
        買房是人生大事，而選擇房貸還款方式更是影響未來 20-30 年財務狀況的關鍵決定。
        本文將深入比較「本金均攤」與「本息均攤」兩種還款方式，幫助您做出最適合自己的選擇。
      </p>

      <h2 id="basic-concept">一、基本概念解析</h2>

      <h3>什麼是本息均攤？</h3>
      <p>
        <strong>本息均攤</strong>（等額本息）是最常見的房貸還款方式。顧名思義，每月還款金額固定不變，
        包含「本金」和「利息」兩部分。但隨著還款進行，本金與利息的比例會逐漸變化：
      </p>
      <ul>
        <li><strong>前期</strong>：利息佔比較高，本金佔比較低</li>
        <li><strong>中期</strong>：本金與利息大約各半</li>
        <li><strong>後期</strong>：本金佔比較高，利息佔比較低</li>
      </ul>
      <p>
        這種方式的優點是每月還款金額固定，方便預算規劃；缺點是總利息支出較高。
      </p>

      <h3>什麼是本金均攤？</h3>
      <p>
        <strong>本金均攤</strong>（等額本金）則是將貸款本金平均分配到每個月償還，
        再加上當月應付的利息。因此：
      </p>
      <ul>
        <li><strong>前期</strong>：月付金最高（本金 + 較多利息）</li>
        <li><strong>中期</strong>：月付金逐漸降低</li>
        <li><strong>後期</strong>：月付金最低（本金 + 較少利息）</li>
      </ul>
      <p>
        這種方式的優點是總利息支出較低；缺點是前期還款壓力較大。
      </p>

      <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-blue-400 font-bold mb-3">💡 快速理解</h4>
        <p class="text-slate-300 mb-0">
          <strong>本息均攤</strong>：每月繳一樣的錢，但總利息較多<br/>
          <strong>本金均攤</strong>：每月繳的錢越來越少，總利息較少
        </p>
      </div>

      <h2 id="comparison">二、兩種還款方式比較表</h2>

      <table>
        <thead>
          <tr>
            <th>比較項目</th>
            <th>本息均攤</th>
            <th>本金均攤</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>每月還款金額</td>
            <td>固定不變</td>
            <td>逐月遞減</td>
          </tr>
          <tr>
            <td>前期還款壓力</td>
            <td>較低</td>
            <td>較高</td>
          </tr>
          <tr>
            <td>總利息支出</td>
            <td>較高</td>
            <td>較低</td>
          </tr>
          <tr>
            <td>適合對象</td>
            <td>收入穩定、重視現金流</td>
            <td>收入較高、想省利息</td>
          </tr>
          <tr>
            <td>銀行偏好</td>
            <td>多數銀行預設</td>
            <td>需主動申請</td>
          </tr>
        </tbody>
      </table>

      <h2 id="calculation">三、實際案例試算</h2>

      <p>假設貸款條件如下：</p>
      <ul>
        <li>貸款金額：<strong>1,000 萬元</strong></li>
        <li>貸款年限：<strong>30 年</strong></li>
        <li>年利率：<strong>2.1%</strong></li>
      </ul>

      <h3>本息均攤試算結果</h3>
      <ul>
        <li>每月還款：<strong>37,811 元</strong>（固定）</li>
        <li>總還款金額：<strong>13,611,960 元</strong></li>
        <li>總利息支出：<strong>3,611,960 元</strong></li>
      </ul>

      <h3>本金均攤試算結果</h3>
      <ul>
        <li>第 1 個月還款：<strong>45,278 元</strong>（最高）</li>
        <li>第 360 個月還款：<strong>27,825 元</strong>（最低）</li>
        <li>總還款金額：<strong>13,157,917 元</strong></li>
        <li>總利息支出：<strong>3,157,917 元</strong></li>
      </ul>

      <div class="bg-green-900/30 border border-green-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-green-400 font-bold mb-3">💰 利息差異</h4>
        <p class="text-slate-300 mb-0">
          選擇本金均攤可省下 <strong class="text-green-400">454,043 元</strong> 利息！
          相當於少繳 <strong>1 年</strong> 的房貸。
        </p>
      </div>

      <h2 id="who-should-use">四、誰適合哪種方式？</h2>

      <h3>適合本息均攤的人</h3>
      <ul>
        <li>收入穩定但不算特別高的上班族</li>
        <li>重視每月現金流管理</li>
        <li>有其他投資規劃，想保留資金彈性</li>
        <li>剛購屋、裝潢期間資金較緊</li>
      </ul>

      <h3>適合本金均攤的人</h3>
      <ul>
        <li>收入較高、能負擔前期較高月付金</li>
        <li>預期未來收入可能減少（如接近退休）</li>
        <li>想盡快降低負債、減少利息支出</li>
        <li>計劃提前還款</li>
      </ul>

      <h2 id="tips">五、選擇房貸還款方式的建議</h2>

      <ol>
        <li>
          <strong>評估自己的還款能力</strong>：
          本金均攤前期月付金可能比本息均攤高出 20-30%，要確保能負擔。
        </li>
        <li>
          <strong>考慮未來收入變化</strong>：
          如果預期加薪，可選本息；如果擔心收入減少，可選本金。
        </li>
        <li>
          <strong>計算總成本</strong>：
          使用計算機試算兩種方式的總利息差異，評估是否值得。
        </li>
        <li>
          <strong>詢問銀行其他方案</strong>：
          有些銀行提供混合型還款、階梯式還款等彈性方案。
        </li>
      </ol>

      <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-blue-400 font-bold mb-3">🛠️ 免費房貸試算工具</h4>
        <p class="text-slate-300 mb-4">
          使用「傲創計算機」，輸入您的貸款條件，
          立即比較兩種還款方式的差異，找出最適合您的方案。
        </p>
        <a href="/calculator" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
          免費使用房貸計算機 →
        </a>
      </div>

      <h2 id="conclusion">結語</h2>
      <p>
        房貸還款方式沒有絕對的好壞，關鍵在於選擇最適合自己財務狀況的方式。
        本息均攤適合追求穩定現金流的人，本金均攤則適合想省利息的人。
      </p>
      <p>
        建議購屋前先用計算機試算，了解兩種方式的實際差異，
        再根據自己的收入和規劃做決定。
      </p>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>→ <a href="/blog/bank-mortgage-rates-comparison-2026" class="text-blue-400 hover:underline">2026 各銀行房貸利率比較表</a></li>
          <li>→ <a href="/blog/mortgage-refinance-cost-2026" class="text-blue-400 hover:underline">2026 房貸轉貸成本試算</a></li>
          <li>→ <a href="/blog/how-to-use-mortgage-calculator" class="text-blue-400 hover:underline">如何使用房貸計算機做專業提案</a></li>
        </ul>
      </div>

      <p class="text-slate-500 text-sm mt-12">
        最後更新：2026 年 1 月 15 日<br/>
        本文為房貸知識分享，實際利率與條件請以銀行公告為準。
      </p>
    </article>
  `
};
