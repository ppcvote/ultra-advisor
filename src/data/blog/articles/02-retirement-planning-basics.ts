import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '2',
  slug: 'retirement-planning-basics',
  title: '退休規劃入門：從勞保勞退開始算起【2026 完整指南】',
  excerpt: '退休金準備從什麼時候開始？勞保、勞退能領多少？本文帶您了解台灣退休制度，計算退休金缺口。',
  category: 'retirement',
  tags: ['退休規劃', '勞保', '勞退', '退休金', '所得替代率', '勞保年金'],
  readTime: 10,
  publishDate: '2026-01-10',
  author: 'Ultra Advisor',
  featured: true,
  metaTitle: '退休規劃完整指南：勞保勞退能領多少？退休金缺口怎麼算【2026】',
  metaDescription: '台灣勞保、勞退年金詳細解說。計算您的退休金缺口，規劃充足的退休生活。附所得替代率計算公式與實際案例。',
  content: `
      <article class="prose prose-invert max-w-none">
        <p class="lead text-xl text-slate-300 mb-8">
          「退休後每月需要多少錢？」「勞保勞退到底能領多少？」這是許多人心中的疑問。
          本文將系統性地介紹台灣的退休金制度，幫助您評估退休金缺口，及早開始規劃。
        </p>

        <h2 id="retirement-system">一、台灣退休金制度概覽</h2>

        <p>台灣的退休金保障主要由三層組成，俗稱「三層退休金」：</p>

        <div class="bg-slate-800 rounded-xl p-6 my-6">
          <h4 class="text-white font-bold mb-4">🏛️ 退休金三層架構</h4>
          <ol class="text-slate-300 space-y-4">
            <li>
              <strong class="text-blue-400">第一層：社會保險（勞保年金）</strong>
              <p class="text-sm text-slate-400 mt-1">由政府主辦，強制所有勞工參加。提供基本的退休保障。</p>
            </li>
            <li>
              <strong class="text-emerald-400">第二層：職業退休金（勞退新制）</strong>
              <p class="text-sm text-slate-400 mt-1">雇主每月提撥 6% 到個人帳戶。勞工可自願再提 0-6%。</p>
            </li>
            <li>
              <strong class="text-purple-400">第三層：個人儲蓄與投資</strong>
              <p class="text-sm text-slate-400 mt-1">包括儲蓄險、基金、股票、房產等個人理財規劃。</p>
            </li>
          </ol>
        </div>

        <h2 id="labor-insurance">二、勞保年金：你能領多少？</h2>

        <h3>勞保年金計算公式</h3>
        <p>勞保老年年金有兩種計算方式，擇優給付：</p>

        <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-6">
          <h4 class="text-blue-400 font-bold mb-3">公式 A（年資較長者適用）</h4>
          <p class="text-white font-mono text-lg">
            月領金額 = 平均月投保薪資 × 年資 × 0.775% + 3,000 元
          </p>
        </div>

        <div class="bg-emerald-900/30 border border-emerald-500/30 rounded-2xl p-6 my-6">
          <h4 class="text-emerald-400 font-bold mb-3">公式 B（平均薪資較高者適用）</h4>
          <p class="text-white font-mono text-lg">
            月領金額 = 平均月投保薪資 × 年資 × 1.55%
          </p>
        </div>

        <h3>實際案例計算</h3>

        <div class="bg-slate-800 rounded-xl p-6 my-6">
          <h4 class="text-white font-bold mb-4">📊 案例：小明的勞保年金</h4>
          <ul class="text-slate-300 space-y-1">
            <li>平均月投保薪資：<strong class="text-emerald-400">45,800 元</strong>（最高級距）</li>
            <li>投保年資：<strong class="text-emerald-400">35 年</strong></li>
          </ul>
          <div class="mt-4 pt-4 border-t border-slate-700">
            <p class="text-slate-400">公式 A：45,800 × 35 × 0.775% + 3,000 = <strong class="text-blue-400">15,424 元</strong></p>
            <p class="text-slate-400">公式 B：45,800 × 35 × 1.55% = <strong class="text-emerald-400">24,844 元</strong></p>
            <p class="text-white font-bold mt-2">擇優後月領：<span class="text-2xl text-emerald-400">24,844 元</span></p>
          </div>
        </div>

        <div class="bg-red-900/30 border border-red-500/30 rounded-2xl p-6 my-8">
          <h4 class="text-red-400 font-bold mb-3">⚠️ 勞保財務警訊</h4>
          <p class="text-slate-300">
            根據勞保局精算報告，勞保基金預計在 <strong>2028 年</strong> 出現入不敷出的情況。
            雖然政府已承諾不會讓勞保破產，但未來年金給付可能面臨調整。
            建議不要將退休金全押在勞保上。
          </p>
        </div>

        <h2 id="labor-pension">三、勞退新制：你的退休金帳戶</h2>

        <h3>勞退新制簡介</h3>
        <p>
          2005 年 7 月後上班的勞工適用「勞退新制」。雇主每月須提撥勞工薪資的 6%
          到勞工個人退休金帳戶。這筆錢跟著勞工走，不會因為換工作而歸零。
        </p>

        <h3>自提的稅務優惠</h3>
        <p>
          勞工可以自願額外提撥 0-6% 的薪資到退休金帳戶。自提的金額可以<strong>從當年度薪資所得中扣除</strong>，
          等於是「延後繳稅」的效果。
        </p>

        <div class="bg-slate-800 rounded-xl p-6 my-6">
          <h4 class="text-white font-bold mb-4">💰 自提節稅範例</h4>
          <ul class="text-slate-300 space-y-2">
            <li>月薪 60,000 元，自提 6% = 每月 3,600 元</li>
            <li>年自提金額：43,200 元（從所得中扣除）</li>
            <li>若適用稅率 12%，每年可節稅：<strong class="text-emerald-400">5,184 元</strong></li>
            <li>若適用稅率 20%，每年可節稅：<strong class="text-emerald-400">8,640 元</strong></li>
          </ul>
        </div>

        <h3>勞退能領多少？</h3>
        <p>
          勞退金額取決於提撥金額、工作年資、投資報酬率。以下是簡單試算：
        </p>

        <div class="bg-slate-800 rounded-xl p-6 my-6">
          <h4 class="text-white font-bold mb-4">📊 勞退試算範例</h4>
          <ul class="text-slate-300 space-y-1">
            <li>月薪：<strong class="text-emerald-400">50,000 元</strong></li>
            <li>雇主提撥：6%（每月 3,000 元）</li>
            <li>自提：6%（每月 3,000 元）</li>
            <li>工作年資：<strong class="text-emerald-400">35 年</strong></li>
            <li>年化報酬率：<strong class="text-emerald-400">3%</strong>（保守估計）</li>
          </ul>
          <div class="mt-4 pt-4 border-t border-slate-700">
            <p class="text-white font-bold">退休時帳戶餘額約：<span class="text-2xl text-emerald-400">450 萬元</span></p>
            <p class="text-slate-400 text-sm mt-2">若分 20 年領取，每月約可領 22,500 元</p>
          </div>
        </div>

        <h2 id="replacement-ratio">四、所得替代率與退休金缺口</h2>

        <h3>什麼是所得替代率？</h3>
        <p>
          所得替代率是指退休後的收入佔退休前收入的比例。一般建議退休後的所得替代率
          應達到 <strong>70%</strong> 以上，才能維持退休前的生活水準。
        </p>

        <div class="bg-amber-900/30 border border-amber-500/30 rounded-2xl p-6 my-8">
          <h4 class="text-amber-400 font-bold mb-3">🎯 所得替代率建議</h4>
          <ul class="text-slate-300 space-y-2">
            <li><strong>基本生活</strong>：50-60%（僅能維持基本開銷）</li>
            <li><strong>舒適退休</strong>：70-80%（維持退休前生活水準）</li>
            <li><strong>優質退休</strong>：80%以上（有餘裕旅遊、享受生活）</li>
          </ul>
        </div>

        <h3>計算您的退休金缺口</h3>

        <div class="bg-slate-800 rounded-xl p-6 my-6">
          <h4 class="text-white font-bold mb-4">📊 退休金缺口試算</h4>
          <p class="text-slate-400 mb-4">假設：退休前月薪 5 萬，目標所得替代率 70%</p>
          <table class="w-full text-sm">
            <tbody>
              <tr>
                <td class="py-2 text-slate-400">目標退休月收入</td>
                <td class="py-2 text-right text-white">50,000 × 70% = 35,000 元</td>
              </tr>
              <tr>
                <td class="py-2 text-slate-400">勞保年金（估）</td>
                <td class="py-2 text-right text-emerald-400">- 20,000 元</td>
              </tr>
              <tr>
                <td class="py-2 text-slate-400">勞退月領（估）</td>
                <td class="py-2 text-right text-emerald-400">- 10,000 元</td>
              </tr>
              <tr class="border-t border-slate-700">
                <td class="py-2 text-white font-bold">每月缺口</td>
                <td class="py-2 text-right text-red-400 font-bold text-lg">5,000 元</td>
              </tr>
            </tbody>
          </table>
          <p class="text-slate-400 text-sm mt-4">
            若預計退休後生活 25 年，需自行準備：5,000 × 12 × 25 = <strong class="text-amber-400">150 萬元</strong>
          </p>
        </div>

        <h2 id="action-plan">五、現在就開始行動</h2>

        <h3>不同年齡的退休準備策略</h3>

        <h4>25-35 歲：起步期</h4>
        <ul>
          <li>開始自提勞退 6%，享受節稅與複利</li>
          <li>建立緊急預備金（6 個月生活費）</li>
          <li>學習基礎投資知識，定期定額買基金</li>
        </ul>

        <h4>35-45 歲：衝刺期</h4>
        <ul>
          <li>提高儲蓄率至收入的 20% 以上</li>
          <li>檢視保險保障是否足夠</li>
          <li>開始配置退休專用投資組合</li>
        </ul>

        <h4>45-55 歲：加速期</h4>
        <ul>
          <li>精算退休金缺口，調整儲蓄目標</li>
          <li>逐步降低投資組合風險</li>
          <li>考慮購買年金險鎖定退休收入</li>
        </ul>

        <h4>55-65 歲：準備期</h4>
        <ul>
          <li>規劃退休後的現金流來源</li>
          <li>了解各項年金請領條件與時機</li>
          <li>考慮延後退休或部分退休</li>
        </ul>

        <div class="bg-purple-900/30 border border-purple-500/30 rounded-2xl p-6 my-8">
          <h4 class="text-purple-400 font-bold mb-3">🛠️ 用工具精算您的退休金</h4>
          <p class="text-slate-300 mb-4">
            Ultra Advisor 提供完整的退休規劃工具，包含勞保年金試算、勞退累積預估、
            退休金缺口分析等功能，幫助您制定個人化的退休計畫。
          </p>
          <a href="/register" class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
            免費試用 7 天 →
          </a>
        </div>

        <h2 id="conclusion">結語</h2>
        <p>
          退休規劃越早開始越好。即使每月只能存下 3,000 元，經過 30 年的複利累積，
          也能成為一筆可觀的退休金。重要的是「開始行動」，而不是等到完美的時機。
        </p>
        <p>
          如果您對自己的退休金狀況感到迷茫，建議先做一次完整的退休金試算，
          了解自己的缺口有多大，再制定具體的儲蓄和投資計畫。
        </p>

        <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
          <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
          <ul class="text-slate-300 mb-0 space-y-2">
            <li>→ <a href="/blog/labor-insurance-pension-2026" class="text-blue-400 hover:underline">2026 勞保勞退給付速算</a></li>
            <li>→ <a href="/blog/compound-interest-power" class="text-blue-400 hover:underline">複利的威力：讓時間成為你的朋友</a></li>
            <li>→ <a href="/blog/cash-flow-rich-poor-2026" class="text-blue-400 hover:underline">窮人、中產、富人的現金流差在哪？</a></li>
          </ul>
        </div>

        <p class="text-slate-500 text-sm mt-12">
          最後更新：2026 年 1 月 10 日<br/>
          本文資訊以勞動部 2026 年公布數據為準。實際給付金額請以勞保局核定為準。
        </p>
      </article>
    `
};
