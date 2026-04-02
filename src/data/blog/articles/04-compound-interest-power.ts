import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '4',
  slug: 'compound-interest-power',
  title: '複利的力量：為什麼早 10 年開始投資差這麼多？',
  excerpt: '愛因斯坦說複利是世界第八大奇蹟。本文用實際數字告訴您，早 10 年開始投資，退休時可以多領多少。',
  category: 'investment',
  tags: ['複利', '投資', '理財', '退休', '定期定額', '時間價值'],
  readTime: 6,
  publishDate: '2025-12-28',
  author: 'Ultra Advisor',
  featured: false,
  metaTitle: '複利的力量：用數字證明早投資 10 年的驚人差距',
  metaDescription: '愛因斯坦說複利是世界第八大奇蹟。實際計算：25歲 vs 35歲開始投資，退休時差距超過1000萬！',
  content: `
    <article class="prose prose-invert max-w-none">
      <p class="lead text-xl text-slate-300 mb-8">
        「複利是世界第八大奇蹟。懂的人賺取它，不懂的人支付它。」<br/>
        —— 據傳為愛因斯坦所說
      </p>

      <p>
        不管愛因斯坦有沒有真的說過這句話，複利確實是投資理財中最強大的力量。
        本文將用實際數字告訴您，為什麼「時間」是投資最重要的資產。
      </p>

      <h2 id="what-is-compound">一、什麼是複利？</h2>

      <p>
        <strong>複利</strong>（Compound Interest）是指利息會再產生利息的計算方式。
        與「單利」不同，複利的利息會被加入本金，讓下一期的計算基數變大。
      </p>

      <div class="bg-slate-800 rounded-xl p-6 my-6">
        <h4 class="text-white font-bold mb-4">📊 單利 vs 複利比較</h4>
        <p class="text-slate-400 mb-4">本金 100 萬元，年利率 5%，10 年後：</p>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-slate-900 rounded-lg p-4">
            <p class="text-slate-400 text-sm">單利</p>
            <p class="text-xl text-white font-bold">150 萬元</p>
            <p class="text-slate-500 text-xs">100 + (100×5%×10)</p>
          </div>
          <div class="bg-emerald-900/30 rounded-lg p-4 border border-emerald-500/30">
            <p class="text-emerald-400 text-sm">複利</p>
            <p class="text-xl text-emerald-400 font-bold">163 萬元</p>
            <p class="text-slate-500 text-xs">100 × (1.05)^10</p>
          </div>
        </div>
      </div>

      <p>
        僅僅 10 年，複利就多賺了 13 萬元。時間越長，差距越驚人。
      </p>

      <h2 id="time-matters">二、時間是複利的燃料</h2>

      <p>
        複利的威力需要時間來發揮。讓我們比較兩個人：小明和小華。
      </p>

      <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-6">
        <h4 class="text-blue-400 font-bold mb-3">👤 小明：25 歲開始投資</h4>
        <ul class="text-slate-300 space-y-1">
          <li>每月定期定額：10,000 元</li>
          <li>年化報酬率：7%</li>
          <li>投資至 65 歲退休（40 年）</li>
        </ul>
      </div>

      <div class="bg-amber-900/30 border border-amber-500/30 rounded-2xl p-6 my-6">
        <h4 class="text-amber-400 font-bold mb-3">👤 小華：35 歲開始投資</h4>
        <ul class="text-slate-300 space-y-1">
          <li>每月定期定額：10,000 元</li>
          <li>年化報酬率：7%</li>
          <li>投資至 65 歲退休（30 年）</li>
        </ul>
      </div>

      <h3>結果比較</h3>

      <table class="w-full border-collapse my-6">
        <thead>
          <tr class="bg-slate-800">
            <th class="border border-slate-700 p-3 text-left">項目</th>
            <th class="border border-slate-700 p-3 text-right">小明（40年）</th>
            <th class="border border-slate-700 p-3 text-right">小華（30年）</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="border border-slate-700 p-3">總投入本金</td>
            <td class="border border-slate-700 p-3 text-right">480 萬</td>
            <td class="border border-slate-700 p-3 text-right">360 萬</td>
          </tr>
          <tr>
            <td class="border border-slate-700 p-3">65 歲累積資產</td>
            <td class="border border-slate-700 p-3 text-right text-emerald-400 font-bold">2,624 萬</td>
            <td class="border border-slate-700 p-3 text-right text-amber-400 font-bold">1,220 萬</td>
          </tr>
          <tr>
            <td class="border border-slate-700 p-3">投資獲利</td>
            <td class="border border-slate-700 p-3 text-right">2,144 萬</td>
            <td class="border border-slate-700 p-3 text-right">860 萬</td>
          </tr>
        </tbody>
      </table>

      <div class="bg-emerald-900/30 border border-emerald-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-emerald-400 font-bold mb-3">✨ 關鍵發現</h4>
        <p class="text-slate-300">
          小明只比小華多投入 <strong>120 萬</strong>（10 年的本金），
          但退休時卻多了 <strong class="text-2xl text-emerald-400">1,404 萬</strong>！
        </p>
        <p class="text-slate-400 text-sm mt-2">
          這就是「早 10 年」的威力。多出的 1,284 萬全是複利帶來的「時間紅利」。
        </p>
      </div>

      <h2 id="rule-of-72">三、72 法則：快速估算翻倍時間</h2>

      <p>
        <strong>72 法則</strong>是一個簡單的心算工具，可以快速估算投資翻倍所需的時間：
      </p>

      <div class="bg-slate-800 rounded-xl p-6 my-6 text-center">
        <p class="text-2xl text-white font-mono">
          翻倍年數 ≈ 72 ÷ 年報酬率(%)
        </p>
      </div>

      <h3>常見報酬率的翻倍時間</h3>
      <table class="w-full border-collapse my-6">
        <thead>
          <tr class="bg-slate-800">
            <th class="border border-slate-700 p-3 text-left">年報酬率</th>
            <th class="border border-slate-700 p-3 text-right">翻倍時間</th>
            <th class="border border-slate-700 p-3 text-right">40 年可翻幾倍</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="border border-slate-700 p-3">3%（定存）</td>
            <td class="border border-slate-700 p-3 text-right">24 年</td>
            <td class="border border-slate-700 p-3 text-right">約 1.7 倍</td>
          </tr>
          <tr>
            <td class="border border-slate-700 p-3">5%（債券）</td>
            <td class="border border-slate-700 p-3 text-right">14.4 年</td>
            <td class="border border-slate-700 p-3 text-right">約 7 倍</td>
          </tr>
          <tr>
            <td class="border border-slate-700 p-3">7%（股債混合）</td>
            <td class="border border-slate-700 p-3 text-right">10.3 年</td>
            <td class="border border-slate-700 p-3 text-right">約 15 倍</td>
          </tr>
          <tr>
            <td class="border border-slate-700 p-3">10%（股票）</td>
            <td class="border border-slate-700 p-3 text-right">7.2 年</td>
            <td class="border border-slate-700 p-3 text-right">約 45 倍</td>
          </tr>
        </tbody>
      </table>

      <h2 id="start-now">四、現在開始永遠不嫌晚</h2>

      <p>
        看到這裡，您可能會想：「我已經 35 歲了，是不是太晚了？」
      </p>
      <p>
        答案是：<strong>永遠不嫌晚</strong>。35 歲開始，到 65 歲還有 30 年。
        30 年的複利依然非常可觀。關鍵是「現在就開始」，而不是等待「最佳時機」。
      </p>

      <div class="bg-slate-800 rounded-xl p-6 my-6">
        <h4 class="text-white font-bold mb-4">💰 從今天開始的價值</h4>
        <p class="text-slate-300 mb-4">假設年報酬率 7%：</p>
        <ul class="text-slate-300 space-y-2">
          <li>今天投入 1 萬元，30 年後 = <strong class="text-emerald-400">7.6 萬元</strong></li>
          <li>今天投入 10 萬元，30 年後 = <strong class="text-emerald-400">76 萬元</strong></li>
          <li>今天投入 100 萬元，30 年後 = <strong class="text-emerald-400">761 萬元</strong></li>
        </ul>
      </div>

      <h2 id="action-steps">五、開始投資的具體步驟</h2>

      <ol>
        <li>
          <strong>設定每月可投資金額</strong><br/>
          建議收入的 10-20%，量入為出
        </li>
        <li>
          <strong>選擇適合的投資工具</strong><br/>
          新手建議從廣泛分散的指數型 ETF 開始
        </li>
        <li>
          <strong>設定自動扣款</strong><br/>
          定期定額，強迫儲蓄，避免人性弱點
        </li>
        <li>
          <strong>長期持有，不輕易賣出</strong><br/>
          市場波動是正常的，時間會平滑短期波動
        </li>
        <li>
          <strong>定期檢視，但不過度調整</strong><br/>
          每年檢視一次即可，避免頻繁交易
        </li>
      </ol>

      <div class="bg-purple-900/30 border border-purple-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-purple-400 font-bold mb-3">🛠️ 用工具模擬您的財富成長</h4>
        <p class="text-slate-300 mb-4">
          Ultra Advisor 的「基金時光機」功能，可以模擬不同投資金額、
          報酬率、時間下的資產累積情況，幫助您設定合理的投資目標。
        </p>
        <a href="/register" class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
          免費試用 7 天 →
        </a>
      </div>

      <h2 id="conclusion">結語</h2>
      <p>
        複利是耐心投資者最好的朋友。您不需要成為投資專家，
        只需要做到「早開始、持續投、長期持有」這三件事，
        複利就會默默為您工作。
      </p>
      <p>
        最好的投資時機是 10 年前，其次是現在。別再等了，今天就開始您的投資之旅！
      </p>
      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>→ <a href="/blog/retirement-planning-basics" class="text-blue-400 hover:underline">退休規劃入門：從勞保勞退開始算起【2026 完整指南】</a></li>
          <li>→ <a href="/blog/savings-insurance-vs-deposit-2026" class="text-blue-400 hover:underline">2026 儲蓄險 vs 定存完整比較｜IRR 怎麼看？哪個划算？</a></li>
          <li>→ <a href="/blog/high-dividend-etf-calendar-2026" class="text-blue-400 hover:underline">2026 台股高股息 ETF 配息月曆｜0056、00878、00919 完整比較</a></li>
        </ul>
      </div>

<p class="text-slate-500 text-sm mt-12">
        最後更新：2025 年 12 月 28 日<br/>
        本文計算以年化報酬率 7% 為例，實際投資報酬可能因市場波動而異。投資有風險，請審慎評估。
      </p>
    </article>
  `
};
