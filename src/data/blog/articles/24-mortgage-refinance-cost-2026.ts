import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '24',
  slug: 'mortgage-refinance-cost-2026',
  title: '2026 房貸轉貸成本試算｜利差多少才划算？完整費用分析',
  excerpt: '房貸轉貸要花多少錢？利差要多少才值得轉？本文用實際數字告訴你轉貸成本、回本時間，幫你判斷該不該轉貸。',
  category: 'mortgage',
  tags: ['房貸', '轉貸', '轉增貸', '利率', '2026', '房貸利率', '轉貸成本'],
  readTime: 10,
  publishDate: '2026-01-19',
  author: 'Ultra Advisor',
  featured: false,
  metaTitle: '2026 房貸轉貸成本試算｜利差多少划算？費用、流程完整分析',
  metaDescription: '房貸轉貸成本約 2.5～3 萬元，利差要多少才划算？完整分析轉貸費用明細、回本時間試算、轉貸前必問的 5 個問題。',
  content: `
    <article class="prose prose-invert max-w-none">
      <p class="lead text-xl text-slate-300 mb-8">
        「隔壁鄰居說他房貸轉貸省了好幾萬，我是不是也該轉？」
        先別急！轉貸要花錢，利差不夠大可能反而虧。本文用實際數字告訴你，
        什麼情況下轉貸才划算。
      </p>

      <h2 id="what-is">一、什麼是房貸轉貸？</h2>

      <h3>白話說明</h3>
      <p>
        你原本跟 A 銀行借房貸，現在 B 銀行利率比較低，
        所以你跟 B 銀行借錢把 A 銀行的貸款還掉，以後改還 B 銀行。
        <strong>這就是轉貸。</strong>
      </p>

      <h3>轉貸 vs 轉增貸</h3>
      <table>
        <thead>
          <tr>
            <th>類型</th>
            <th>說明</th>
            <th>適合情況</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>轉貸</strong></td>
            <td>把貸款搬到利率更低的銀行</td>
            <td>單純想省利息</td>
          </tr>
          <tr>
            <td><strong>轉增貸</strong></td>
            <td>轉貸的同時，多借一筆錢出來</td>
            <td>想省利息 + 有資金需求</td>
          </tr>
        </tbody>
      </table>

      <h2 id="cost">二、轉貸要花多少錢？</h2>

      <h3>轉貸費用明細（以貸款 800 萬為例）</h3>
      <table>
        <thead>
          <tr>
            <th>費用項目</th>
            <th>金額</th>
            <th>說明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>塗銷設定規費</td>
            <td>約 300 元</td>
            <td>原銀行抵押權塗銷</td>
          </tr>
          <tr>
            <td>新設定規費</td>
            <td>約 4,000～6,000 元</td>
            <td>設定金額的 0.1%</td>
          </tr>
          <tr>
            <td>代書費</td>
            <td>約 8,000～12,000 元</td>
            <td>含塗銷、設定、送件</td>
          </tr>
          <tr>
            <td>銀行開辦費</td>
            <td>0～10,000 元</td>
            <td>有些銀行會減免</td>
          </tr>
          <tr>
            <td>鑑價費</td>
            <td>0～5,000 元</td>
            <td>多數銀行免收</td>
          </tr>
          <tr>
            <td><strong>合計</strong></td>
            <td><strong>約 15,000～30,000 元</strong></td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-blue-400 font-bold mb-3">💡 簡單記法</h4>
        <p class="text-slate-300 mb-0">
          轉貸成本大約是 <strong>貸款餘額的 0.2%～0.3%</strong><br/><br/>
          貸款 500 萬 → 成本約 1～1.5 萬<br/>
          貸款 800 萬 → 成本約 1.5～2.5 萬<br/>
          貸款 1,000 萬 → 成本約 2～3 萬
        </p>
      </div>

      <h3>可能額外產生的費用</h3>
      <ul>
        <li><strong>違約金：</strong>如果原貸款還在「綁約期」內，可能要付貸款金額 0.5%～2% 的違約金</li>
        <li><strong>火險地震險：</strong>新銀行可能要求重新投保</li>
      </ul>

      <h2 id="breakeven">三、利差多少才划算？</h2>

      <h3>回本時間試算</h3>
      <p>假設貸款餘額 800 萬，轉貸成本 2.5 萬：</p>

      <table>
        <thead>
          <tr>
            <th>利差</th>
            <th>每年省下利息</th>
            <th>回本時間</th>
            <th>划算嗎？</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0.1%（1 碼以下）</td>
            <td>8,000 元</td>
            <td>約 3 年</td>
            <td>⚠️ 勉強</td>
          </tr>
          <tr>
            <td>0.125%（半碼）</td>
            <td>10,000 元</td>
            <td>約 2.5 年</td>
            <td>⚠️ 勉強</td>
          </tr>
          <tr>
            <td>0.25%（1 碼）</td>
            <td>20,000 元</td>
            <td>約 1.3 年</td>
            <td>✅ 可以考慮</td>
          </tr>
          <tr>
            <td>0.5%（2 碼）</td>
            <td>40,000 元</td>
            <td>約 8 個月</td>
            <td>✅ 很划算</td>
          </tr>
          <tr>
            <td>1%（4 碼）</td>
            <td>80,000 元</td>
            <td>約 4 個月</td>
            <td>✅ 非常划算</td>
          </tr>
        </tbody>
      </table>

      <div class="bg-green-900/30 border border-green-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-green-400 font-bold mb-3">💰 經驗法則</h4>
        <p class="text-slate-300 mb-0">
          <strong>利差至少要有 0.25%（1 碼）以上</strong>，轉貸才比較划算。<br/>
          如果利差只有 0.1%～0.15%，除非貸款金額很大或剩餘年限很長，否則不建議轉。
        </p>
      </div>

      <h2 id="calculation">四、實際試算範例</h2>

      <h3>情境：貸款 1,000 萬，利率從 2.3% 降到 1.8%</h3>
      <ul>
        <li>利差 = 2.3% - 1.8% = <strong>0.5%</strong></li>
        <li>每年省下利息 = 1,000 萬 × 0.5% = <strong>50,000 元</strong></li>
        <li>轉貸成本約 <strong>25,000 元</strong></li>
        <li>回本時間 = 25,000 ÷ 50,000 = <strong>0.5 年（6 個月）</strong></li>
      </ul>
      <p>
        <strong>結論：非常划算！</strong>半年就回本，之後每年淨省 5 萬。
        如果還剩 20 年房貸，總共可省約 <strong>97.5 萬</strong>（50,000 × 19.5 年）。
      </p>

      <h3>情境：貸款 400 萬，利率從 2.3% 降到 2.0%</h3>
      <ul>
        <li>利差 = 2.3% - 2.0% = <strong>0.3%</strong></li>
        <li>每年省下利息 = 400 萬 × 0.3% = <strong>12,000 元</strong></li>
        <li>轉貸成本約 <strong>15,000 元</strong></li>
        <li>回本時間 = 15,000 ÷ 12,000 = <strong>1.25 年</strong></li>
      </ul>
      <p>
        <strong>結論：勉強划算。</strong>如果剩餘年限超過 5 年可以考慮，
        但如果快要還完了就不建議。
      </p>

      <h2 id="rates">五、2026 年房貸利率參考</h2>

      <table>
        <thead>
          <tr>
            <th>貸款類型</th>
            <th>2026 年利率</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>新青安貸款</strong></td>
            <td>1.775% 起（最低）</td>
          </tr>
          <tr>
            <td>一般購屋貸款</td>
            <td>2.19%～2.5%</td>
          </tr>
          <tr>
            <td>轉貸優惠</td>
            <td>2.0%～2.3%（各銀行不同）</td>
          </tr>
        </tbody>
      </table>

      <h2 id="before-refinance">六、轉貸前必做的 5 件事</h2>

      <h3>1. 先問原銀行能不能降息</h3>
      <p>
        <strong>這是最重要的一步！</strong>很多人不知道，其實可以直接跟原銀行談降息。
        如果你信用良好、繳款正常，銀行通常願意配合，這樣連轉貸成本都省了。
      </p>

      <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-blue-400 font-bold mb-3">💡 談判話術</h4>
        <p class="text-slate-300 mb-0">
          「我最近比較了其他銀行的利率，發現比我目前的低很多。
          我在你們銀行繳款一直很正常，想請問有沒有辦法幫我調降利率？
          如果沒辦法的話，我可能需要考慮轉貸了。」
        </p>
      </div>

      <h3>2. 確認有沒有綁約</h3>
      <p>
        查看原貸款合約，是否有「提前清償違約金」條款。
        通常綁約期是 1～3 年，違約金約貸款金額的 0.5%～2%。
      </p>

      <h3>3. 比較新銀行的「完整利率」</h3>
      <p>
        有些銀行會用「前低後高」的利率吸引你：前 2 年 1.8%，之後變 2.5%。
        <strong>要比較的是「平均利率」，不是第一年的優惠利率。</strong>
      </p>

      <h3>4. 問清楚所有費用</h3>
      <p>
        除了利率，還要問：開辦費、帳管費、鑑價費有沒有減免？
        有些銀行為了搶客戶會減免部分費用。
      </p>

      <h3>5. 評估剩餘年限</h3>
      <p>
        如果房貸只剩 5 年就還完，轉貸省下的利息有限，可能不划算。
        <strong>剩餘年限越長，轉貸越划算。</strong>
      </p>

      <h2 id="process">七、轉貸流程（約 3～4 週）</h2>

      <ol>
        <li><strong>向新銀行申請</strong>：提供身分證、收入證明、原貸款餘額證明</li>
        <li><strong>新銀行審核、鑑價</strong>：約 1～2 週</li>
        <li><strong>核貸、簽約</strong>：確認利率、額度、條件</li>
        <li><strong>代書辦理</strong>：塗銷原抵押權、設定新抵押權</li>
        <li><strong>新銀行撥款</strong>：直接還給原銀行</li>
        <li><strong>完成轉貸</strong>：開始還新銀行的貸款</li>
      </ol>

      <h2 id="checklist">八、轉貸划算嗎？自我檢測表</h2>

      <div class="bg-slate-800 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">📋 轉貸前自我檢測</h4>
        <ul class="text-slate-300 space-y-2">
          <li>☐ 利差有 0.25%（1 碼）以上嗎？</li>
          <li>☐ 原貸款已經過了綁約期嗎？</li>
          <li>☐ 剩餘還款年限超過 5 年嗎？</li>
          <li>☐ 已經問過原銀行能不能降息了嗎？</li>
          <li>☐ 新銀行的利率是「固定」還是「前低後高」？</li>
          <li>☐ 所有費用加起來，回本時間合理嗎？</li>
        </ul>
        <p class="text-slate-400 text-sm mt-4">
          如果以上都打勾 ✓，轉貸很可能是划算的！
        </p>
      </div>

      <div class="bg-purple-900/30 border border-purple-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-purple-400 font-bold mb-3">📋 轉貸實際試算範例</h4>
        <p class="text-slate-300 mb-0">
          假設目前房貸利率 2.4%，轉貸後可以降到 2.0%。
          以 800 萬的貸款餘額來說，每年可以省下 3.2 萬利息。<br/><br/>
          轉貸成本大約 2.5 萬，所以大概 10 個月就回本了。
          如果房貸還剩 18 年，總共可以省將近 55 萬。<br/><br/>
          <strong>小提醒：</strong>在轉貸之前，建議先問問原銀行能不能降息，
          如果他們願意配合，連轉貸成本都省了！
        </p>
      </div>

      <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-blue-400 font-bold mb-3">🛠️ 房貸試算工具</h4>
        <p class="text-slate-300 mb-4">
          使用傲創計算機，快速試算轉貸前後的月付金差異、
          總利息節省金額。
        </p>
        <a href="/calculator" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
          免費使用計算機 →
        </a>
      </div>

      <h2 id="sources">參考資料來源</h2>
      <ul>
        <li><a href="https://www.housefeel.com.tw/article/轉貸-房屋轉貸-房貸轉貸/" target="_blank" rel="noopener">房感 - 2026 房屋轉貸完整說明</a></li>
        <li><a href="https://smart.businessweekly.com.tw/Reading/IndepArticle.aspx?id=6002062" target="_blank" rel="noopener">Smart 自學網 - 房貸轉貸成本評估</a></li>
        <li><a href="https://www.money101.com.tw/blog/房貸-轉貸-轉增貸-利率" target="_blank" rel="noopener">Money101 - 房貸轉貸利率比較</a></li>
        <li><a href="https://mrjoewang.com/mortgage-transfer/" target="_blank" rel="noopener">喬王投資筆記 - 房貸轉貸評估指南</a></li>
      </ul>
      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>→ <a href="/blog/bank-mortgage-rates-comparison-2026" class="text-blue-400 hover:underline">2026 各銀行房貸利率比較表｜首購、青安、轉貸利率總整理</a></li>
          <li>→ <a href="/blog/mortgage-principal-vs-equal-payment" class="text-blue-400 hover:underline">本金均攤 vs 本息均攤：房貸還款方式完整比較【2026 最新】</a></li>
          <li>→ <a href="/blog/how-to-use-mortgage-calculator" class="text-blue-400 hover:underline">傲創計算機使用教學：3 分鐘算出最佳房貸方案</a></li>
        </ul>
      </div>

<p class="text-slate-500 text-sm mt-12">
        最後更新：2026 年 1 月 19 日<br/>
        本文資訊僅供參考，實際費用與利率以各銀行公告為準。
      </p>
    </article>
  `
};
