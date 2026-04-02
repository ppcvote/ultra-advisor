import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '58',
  slug: 'fund-data-vs-excel-myth-2026',
  title: '看懂基金，靠的是真實數據，不是 Excel',
  excerpt: '「配息來自本金」五個字嚇退多少人？但你有沒有想過，這只是法規要求的風險揭露，不代表基金真的在吃老本。用真實數據看一支基金的本質，比用 Excel 倒推結論重要得多。',
  category: 'investment',
  tags: ['基金', '配息基金', '配息來自本金', '安聯收益成長', '投資理財', '數據分析', '2026'],
  readTime: 6,
  publishDate: '2026-02-26',
  author: 'Ultra Advisor',
  featured: true,
  metaTitle: '看懂基金靠真實數據，不是 Excel｜配息來自本金的真相',
  metaDescription: '「配息來源可能來自本金」是法規風險揭露，不是基金在吃老本。教你用真實數據判斷一支配息基金的好壞，別被 Excel 試算表的結論帶著走。',
  content: `
    <article class="prose prose-invert max-w-none">
      <p class="lead text-xl text-slate-300 mb-8">
        網路上有些文章會用 Excel 試算表告訴你：<br/>
        「這支基金配息率 8%，但年化報酬才 7%，所以每年虧 1%！」<br/><br/>
        聽起來很有道理？<strong>但你投資的是基金，不是 Excel。</strong>
      </p>

      <h2 id="disclosure">「配息來源可能來自本金」是什麼意思？</h2>

      <p>
        幾乎所有配息型基金的文件上都會寫這句話。<br/>
        很多人一看到就嚇到：「什麼！配我自己的錢回來？」
      </p>

      <p>
        先深呼吸，讓我們搞清楚這句話的真正含義：
      </p>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">📜 這是法規要求的「風險揭露」</h4>
        <p class="text-slate-300 mb-4">
          金管會規定，所有配息型基金都<strong>必須</strong>加上這段文字。
        </p>
        <div class="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4">
          <p class="text-blue-400 font-bold mb-2">為什麼要這樣寫？</p>
          <p class="text-slate-300 mb-0 text-sm">
            基金的收益來源很多元：股息、債息、價差、匯兌收益等。<br/>
            在某些月份，如果收益不足以支付配息金額，<strong>理論上可能</strong>會動用到本金。<br/><br/>
            法規要求揭露這個<strong>可能性</strong>，是為了保護投資人。<br/>
            <strong>「可能來自」≠「一定來自」≠「長期來自」</strong>
          </p>
        </div>
      </div>

      <p>
        換個角度想：你買房子的時候，合約上也會寫一堆地震、火災的風險告知。<br/>
        <strong>不代表你的房子一定會倒。</strong>
      </p>

      <h2 id="excel-problem">用 Excel 倒推結論的盲點</h2>

      <p>
        有些分析會這樣算：
      </p>

      <div class="bg-red-900/20 border border-red-500/30 rounded-2xl p-6 my-8">
        <p class="text-slate-300 mb-4">
          「12 年年化報酬 7.36%，配息率 8%<br/>
          → 每年侵蝕本金 0.64%<br/>
          → 所以這支基金在配本金！」
        </p>
        <p class="text-red-400 font-bold mb-0">
          這個邏輯有三個問題：
        </p>
      </div>

      <div class="space-y-4 my-8">
        <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h4 class="text-amber-400 font-bold mb-2">問題 1：忽略了「含息報酬」vs「不含息報酬」</h4>
          <p class="text-slate-300 mb-0 text-sm">
            基金的年化報酬率如果是看「淨值變化」，那當然會因為配息而下降——因為錢已經發給你了。<br/>
            就像你銀行帳戶領了利息，餘額會少一點，但你的<strong>總資產（帳戶＋手上的現金）並沒有變少</strong>。<br/>
            正確的比較方式是看<strong>含息總報酬</strong>（Total Return）。
          </p>
        </div>

        <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h4 class="text-amber-400 font-bold mb-2">問題 2：用「平均」抹殺了「過程」</h4>
          <p class="text-slate-300 mb-0 text-sm">
            12 年年化報酬 7.36% 是一個平均值。但基金每年的表現不同：<br/>
            有些年份報酬 15%，有些年份 -5%。<br/>
            <strong>用單一平均值去對比固定配息率，在數學上就不精確。</strong>
          </p>
        </div>

        <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h4 class="text-amber-400 font-bold mb-2">問題 3：Excel 不會告訴你基金的「體質」</h4>
          <p class="text-slate-300 mb-0 text-sm">
            一支基金好不好，要看它的<strong>實際持股、資產規模、投資策略、經理人操作</strong>。<br/>
            Excel 只能做事後的數字遊戲，<strong>無法反映基金的真實運作狀態</strong>。
          </p>
        </div>
      </div>

      <h2 id="real-data">真實數據告訴你什麼？</h2>

      <p>
        想了解一支基金的本質，該看的不是別人的 Excel 表格，而是<strong>基金公司公開的官方數據</strong>：
      </p>

      <div class="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4 text-center text-lg">🔍 判斷配息基金的 5 個關鍵指標</h4>
        <div class="space-y-4">
          <div class="flex items-start gap-3">
            <span class="text-2xl font-bold text-purple-400 flex-shrink-0">1</span>
            <div>
              <p class="text-white font-bold mb-1">基金規模</p>
              <p class="text-slate-300 text-sm mb-0">
                規模大代表受市場信任。以安聯收益成長為例，台灣人把它買到觸及 70% 上限被暫停申購——<strong>這不是問題基金會有的待遇</strong>。
              </p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-2xl font-bold text-purple-400 flex-shrink-0">2</span>
            <div>
              <p class="text-white font-bold mb-1">持股品質</p>
              <p class="text-slate-300 text-sm mb-0">
                看前十大持股是什麼公司。如果持有的是全球頂尖企業的股票和優質債券，基金的收益能力自然有底氣。
              </p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-2xl font-bold text-purple-400 flex-shrink-0">3</span>
            <div>
              <p class="text-white font-bold mb-1">資產配置策略</p>
              <p class="text-slate-300 text-sm mb-0">
                股票、可轉債、高收益債的比例如何？多元配置可以在不同市場環境下維持收益穩定。
              </p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-2xl font-bold text-purple-400 flex-shrink-0">4</span>
            <div>
              <p class="text-white font-bold mb-1">含息總報酬</p>
              <p class="text-slate-300 text-sm mb-0">
                不要只看淨值變化。<strong>把配息加回去計算的「含息總報酬」</strong>才是你真正賺到的。
              </p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="text-2xl font-bold text-purple-400 flex-shrink-0">5</span>
            <div>
              <p class="text-white font-bold mb-1">配息穩定度</p>
              <p class="text-slate-300 text-sm mb-0">
                是否長年維持穩定配息？偶爾微調配息金額是正常的經營調整，不等於「配本金」。
              </p>
            </div>
          </div>
        </div>
      </div>

      <h2 id="nav-drop">淨值下跌 ＝ 虧錢？</h2>

      <p>
        很多人看到基金淨值從 10 元變成 8 元就說「虧了 20%」。<br/>
        但這就像說：「我的薪水帳戶從 100 萬變成 80 萬，我虧了 20 萬！」
      </p>

      <p>
        <strong>等等，那 20 萬去哪了？</strong>
      </p>

      <div class="bg-emerald-900/30 border border-emerald-500/30 rounded-2xl p-6 my-8">
        <p class="text-2xl text-center text-emerald-400 font-bold mb-4">
          配息出去了，在你口袋裡。
        </p>
        <p class="text-slate-300 mb-0 text-center">
          淨值下降的部分，大部分是因為基金把收益「配出去」了。<br/>
          就像除權息一樣，<strong>股價下跌但你拿到了股利</strong>。<br/>
          你的「總資產」＝ 目前淨值 ＋ 歷年領到的配息，<br/>
          <strong>這個數字才是真正的投資成果。</strong>
        </p>
      </div>

      <h2 id="who-benefits">誰在恐慌中得利？</h2>

      <p>
        當一篇文章用聳動的結論告訴你「這支基金在配本金」的時候，<br/>
        不妨想一想：
      </p>

      <ul>
        <li>作者有沒有考慮<strong>含息總報酬</strong>？</li>
        <li>作者有沒有去看<strong>基金的實際持股和規模</strong>？</li>
        <li>作者有沒有說明「配息來自本金」是<strong>法規揭露</strong>而非事實陳述？</li>
        <li>作者的<strong>商業模式</strong>是什麼？是否需要你對現有投資失去信心？</li>
      </ul>

      <p>
        <strong>一句話：會不會有人希望你恐慌，然後去買他的課程？</strong>
      </p>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <p class="text-slate-300 mb-0 text-center leading-relaxed">
          我不是說所有配息基金都好，也不是叫你閉眼投資。<br/>
          我是說：<strong>判斷一支基金，請看它的真實數據，<br/>
          而不是別人 Excel 裡的結論。</strong><br/><br/>
          畢竟，你投資的是基金，不是 Excel。
        </p>
      </div>

      <h2 id="action">該怎麼做？</h2>

      <div class="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-8 my-8">
        <h4 class="text-white font-bold mb-4 text-center">✅ 三步驟看懂你的配息基金</h4>
        <div class="space-y-3 text-slate-300">
          <p class="mb-0"><strong>Step 1</strong>｜去基金公司官網，看<strong>含息總報酬</strong>（不是只看淨值）</p>
          <p class="mb-0"><strong>Step 2</strong>｜看<strong>前十大持股</strong>和<strong>資產配置比例</strong>，了解基金的體質</p>
          <p class="mb-0"><strong>Step 3</strong>｜如果看不懂，<strong>問你的財務顧問</strong>——這就是他們的專業價值</p>
        </div>
      </div>

      <h2 id="summary">重點整理</h2>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <ul class="text-slate-300 mb-0 space-y-3">
          <li>📜 「配息來源可能來自本金」是<strong>法規風險揭露</strong>，所有配息基金都要寫</li>
          <li>📊 判斷基金好壞要看<strong>真實數據</strong>：規模、持股、含息總報酬</li>
          <li>🧮 Excel 試算只是事後推論，<strong>不代表基金的實際運作</strong></li>
          <li>💰 淨值下跌不等於虧錢，<strong>配息已經在你口袋裡</strong></li>
          <li>🔍 看文章前先想想：<strong>作者的商業模式是什麼？</strong></li>
          <li>👉 看不懂數據？<strong>找你的財務顧問，這是他們的專業</strong></li>
        </ul>
      </div>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>→ <a href="/blog/investment-linked-policy-trust-rebuild-2026" class="text-blue-400 hover:underline">投資型保單讓你賠過錢？問題可能不在保單</a></li>
          <li>→ <a href="/blog/offshore-insurance-risk-taiwan-2026" class="text-blue-400 hover:underline">境外保單利率高又免稅？三個你沒被告知的致命風險</a></li>
          <li>→ <a href="/blog/allianz-global-income-growth-suspended-2026" class="text-blue-400 hover:underline">安聯收益成長被買爆！暫停申購要緊嗎？</a></li>
        </ul>
      </div>
    </article>
  `
};
