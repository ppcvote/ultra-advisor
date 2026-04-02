import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '25',
  slug: 'income-tax-brackets-2026',
  title: '2026 所得稅級距與扣除額速查表｜免稅額、報稅門檻一次看',
  excerpt: '2026 年報稅免稅額 10.1 萬、標準扣除額 13.6 萬！本文整理最新稅率級距、各項扣除額，告訴你月薪多少以下免繳稅。',
  category: 'tax',
  tags: ['所得稅', '綜所稅', '免稅額', '扣除額', '2026', '報稅', '稅率級距'],
  readTime: 10,
  publishDate: '2026-01-19',
  author: 'Ultra Advisor',
  featured: true,
  metaTitle: '2026 所得稅級距與扣除額速查表｜免稅額、標準扣除額、報稅門檻完整整理',
  metaDescription: '2026 年報稅（115 年度所得）免稅額 10.1 萬、標準扣除額 13.6 萬、薪資扣除額 22.7 萬。完整整理五級稅率、各項扣除額，告訴你免繳稅門檻。',
  content: `
    <article class="prose prose-invert max-w-none">
      <p class="lead text-xl text-slate-300 mb-8">
        每年報稅最想知道的就是：「我要繳多少稅？」、「月薪多少以下不用繳稅？」
        本文整理 2026 年報稅（115 年度所得）的最新數字，讓你一目了然。
      </p>

      <div class="bg-green-900/30 border border-green-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-green-400 font-bold mb-3">📊 2026 報稅重點數字</h4>
        <ul class="text-slate-300 mb-0 space-y-1">
          <li><strong>一般免稅額：</strong>10.1 萬元（70 歲以上：15.15 萬）</li>
          <li><strong>標準扣除額：</strong>13.6 萬元（有配偶：27.2 萬）</li>
          <li><strong>薪資特別扣除額：</strong>22.7 萬元</li>
          <li><strong>基本生活費：</strong>21.3 萬元</li>
          <li><strong>單身免繳稅門檻：</strong>年收入 46.4 萬以下</li>
        </ul>
      </div>

      <h2 id="brackets">一、2026 年所得稅稅率級距</h2>

      <p>
        所得稅是「累進稅率」，不是全部收入都用同一個稅率，
        而是<strong>超過多少才用更高的稅率</strong>。
      </p>

      <table>
        <thead>
          <tr>
            <th>綜合所得淨額</th>
            <th>稅率</th>
            <th>累進差額</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0～52 萬</td>
            <td><strong>5%</strong></td>
            <td>0</td>
          </tr>
          <tr>
            <td>52 萬～117 萬</td>
            <td><strong>12%</strong></td>
            <td>36,400 元</td>
          </tr>
          <tr>
            <td>117 萬～235 萬</td>
            <td><strong>20%</strong></td>
            <td>130,000 元</td>
          </tr>
          <tr>
            <td>235 萬～440 萬</td>
            <td><strong>30%</strong></td>
            <td>365,000 元</td>
          </tr>
          <tr>
            <td>超過 440 萬</td>
            <td><strong>40%</strong></td>
            <td>805,000 元</td>
          </tr>
        </tbody>
      </table>

      <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-blue-400 font-bold mb-3">💡 什麼是累進差額？</h4>
        <p class="text-slate-300 mb-0">
          累進差額是用來快速計算稅金的數字。<br/><br/>
          <strong>公式：應繳稅額 = 所得淨額 × 稅率 - 累進差額</strong><br/><br/>
          例如：所得淨額 80 萬<br/>
          應繳稅額 = 80 萬 × 12% - 36,400 = 96,000 - 36,400 = <strong>59,600 元</strong>
        </p>
      </div>

      <h2 id="exemption">二、免稅額與扣除額一覽表</h2>

      <h3>免稅額</h3>
      <table>
        <thead>
          <tr>
            <th>項目</th>
            <th>2026 年金額</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>一般免稅額</td>
            <td><strong>10.1 萬元</strong></td>
          </tr>
          <tr>
            <td>70 歲以上免稅額</td>
            <td><strong>15.15 萬元</strong></td>
          </tr>
        </tbody>
      </table>

      <h3>標準扣除額</h3>
      <table>
        <thead>
          <tr>
            <th>項目</th>
            <th>2026 年金額</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>單身</td>
            <td><strong>13.6 萬元</strong></td>
          </tr>
          <tr>
            <td>有配偶</td>
            <td><strong>27.2 萬元</strong></td>
          </tr>
        </tbody>
      </table>

      <h3>特別扣除額</h3>
      <table>
        <thead>
          <tr>
            <th>項目</th>
            <th>2026 年金額</th>
            <th>說明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>薪資所得</strong></td>
            <td><strong>22.7 萬元</strong></td>
            <td>上班族都可扣</td>
          </tr>
          <tr>
            <td>儲蓄投資</td>
            <td>27 萬元</td>
            <td>利息、股利合計</td>
          </tr>
          <tr>
            <td>身心障礙</td>
            <td>21.8 萬元</td>
            <td>每人</td>
          </tr>
          <tr>
            <td>長期照顧</td>
            <td>18 萬元</td>
            <td>每人（調高）</td>
          </tr>
          <tr>
            <td>幼兒學前（第 1 名）</td>
            <td>15 萬元</td>
            <td>6 歲以下</td>
          </tr>
          <tr>
            <td>幼兒學前（第 2 名起）</td>
            <td>22.5 萬元</td>
            <td>6 歲以下</td>
          </tr>
          <tr>
            <td>教育學費</td>
            <td>2.5 萬元</td>
            <td>大專以上子女</td>
          </tr>
        </tbody>
      </table>

      <h2 id="threshold">三、免繳稅門檻是多少？</h2>

      <h3>單身上班族</h3>
      <p>計算方式：免稅額 + 標準扣除額 + 薪資扣除額</p>
      <div class="bg-slate-800 rounded-xl p-4 my-4 font-mono text-sm">
        <p class="text-slate-300 mb-0">
          10.1 萬 + 13.6 萬 + 22.7 萬 = <strong>46.4 萬</strong>
        </p>
      </div>
      <p>
        <strong>結論：單身上班族年收入 46.4 萬以下，不用繳所得稅！</strong><br/>
        換算成月薪約 <strong>38,667 元</strong>。
      </p>

      <h3>單身租屋族（有租金扣除）</h3>
      <div class="bg-slate-800 rounded-xl p-4 my-4 font-mono text-sm">
        <p class="text-slate-300 mb-0">
          10.1 萬 + 13.6 萬 + 22.7 萬 + 18 萬（租金列舉） = <strong>62.6 萬</strong>
        </p>
      </div>
      <p>
        <strong>單身租屋族年收入 62.6 萬以下，可能免繳稅！</strong><br/>
        （需改用列舉扣除額，且有符合條件的租金支出）
      </p>

      <h3>雙薪家庭扶養 2 名幼兒</h3>
      <div class="bg-slate-800 rounded-xl p-4 my-4 font-mono text-sm">
        <p class="text-slate-300 mb-0">
          免稅額：10.1 萬 × 4 人 = 40.4 萬<br/>
          標準扣除額：27.2 萬<br/>
          薪資扣除額：22.7 萬 × 2 人 = 45.4 萬<br/>
          幼兒學前：15 萬 + 22.5 萬 = 37.5 萬<br/>
          合計 = <strong>約 150.5 萬</strong>
        </p>
      </div>
      <p>
        <strong>雙薪家庭扶養 2 名 6 歲以下幼兒，年收入約 150 萬以下免繳稅！</strong>
      </p>

      <div class="bg-green-900/30 border border-green-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-green-400 font-bold mb-3">💰 免繳稅門檻速記</h4>
        <ul class="text-slate-300 mb-0 space-y-1">
          <li>單身上班族：年收入 <strong>46.4 萬</strong> 以下</li>
          <li>單身租屋族：年收入 <strong>62.6 萬</strong> 以下（列舉扣除）</li>
          <li>雙薪 + 2 幼兒：年收入約 <strong>150 萬</strong> 以下</li>
          <li>雙薪 + 2 幼兒：年收入約 <strong>164 萬</strong> 以下（含基本生活費差額）</li>
        </ul>
      </div>

      <h2 id="calculation">四、所得稅計算步驟</h2>

      <h3>步驟說明</h3>
      <ol>
        <li><strong>計算綜合所得總額</strong>：薪資 + 利息 + 股利 + 租金 + 其他</li>
        <li><strong>減除免稅額</strong>：每人 10.1 萬（70 歲以上 15.15 萬）</li>
        <li><strong>減除扣除額</strong>：標準扣除或列舉扣除（擇高）</li>
        <li><strong>減除特別扣除額</strong>：薪資、儲蓄投資、幼兒學前等</li>
        <li><strong>得出綜合所得淨額</strong></li>
        <li><strong>套用稅率表計算稅額</strong></li>
      </ol>

      <h3>計算範例：單身上班族年薪 80 萬</h3>
      <div class="bg-slate-800 rounded-xl p-4 my-4">
        <p class="text-slate-300 mb-2">綜合所得總額：80 萬</p>
        <p class="text-slate-300 mb-2">－ 免稅額：10.1 萬</p>
        <p class="text-slate-300 mb-2">－ 標準扣除額：13.6 萬</p>
        <p class="text-slate-300 mb-2">－ 薪資扣除額：22.7 萬</p>
        <p class="text-slate-300 mb-2">＝ 所得淨額：<strong>33.6 萬</strong></p>
        <p class="text-slate-300 mb-0">應繳稅額：33.6 萬 × 5% = <strong>16,800 元</strong></p>
      </div>

      <h2 id="deduction-comparison">五、標準扣除 vs 列舉扣除</h2>

      <table>
        <thead>
          <tr>
            <th>項目</th>
            <th>標準扣除</th>
            <th>列舉扣除</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>金額</td>
            <td>固定 13.6 萬（單身）</td>
            <td>依實際支出</td>
          </tr>
          <tr>
            <td>需要收據嗎</td>
            <td>不用</td>
            <td>要</td>
          </tr>
          <tr>
            <td>適合誰</td>
            <td>大多數人</td>
            <td>高額醫療、捐款、房貸利息、租金者</td>
          </tr>
        </tbody>
      </table>

      <h3>列舉扣除額項目</h3>
      <ul>
        <li><strong>捐贈：</strong>對政府、教育機構全額可扣；一般捐款最高所得總額 20%</li>
        <li><strong>保險費：</strong>每人每年最高 2.4 萬元（全民健保另計無上限）</li>
        <li><strong>醫藥及生育費：</strong>無上限</li>
        <li><strong>房屋租金：</strong>每年最高 18 萬元（須符合條件）</li>
        <li><strong>自用住宅貸款利息：</strong>每年最高 30 萬元（需減除儲蓄投資扣除額）</li>
      </ul>

      <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-blue-400 font-bold mb-3">💡 什麼時候用列舉？</h4>
        <p class="text-slate-300 mb-0">
          如果你的「醫療費 + 房貸利息 + 租金 + 捐款 + 保險費」加起來超過 13.6 萬（單身）或 27.2 萬（夫妻），
          就用列舉扣除比較划算。
        </p>
      </div>

      <h2 id="basic-living">六、基本生活費差額</h2>

      <p>
        2026 年基本生活費是 <strong>21.3 萬元</strong>。
        政府規定，維持基本生活所需的費用不能被課稅。
      </p>

      <h3>計算方式</h3>
      <p>
        基本生活費總額（21.3 萬 × 人數）如果大於「免稅額 + 扣除額 + 部分特別扣除額」，
        差額可以再從所得中扣除。
      </p>

      <p>
        <strong>白話說：</strong>人口越多、扣除額相對不夠的家庭，可以多扣這筆差額。
      </p>

      <h2 id="faq">七、常見問題 FAQ</h2>

      <h3>Q1：股利要怎麼報稅？</h3>
      <p>
        股利有兩種選擇：<br/>
        ① 合併計稅：股利併入所得，可抵減 8.5%（上限 8 萬）<br/>
        ② 分離計稅：股利單獨課 28%<br/>
        <strong>一般人用合併計稅較划算，高所得者可能用分離計稅。</strong>
      </p>

      <h3>Q2：夫妻一定要合併報稅嗎？</h3>
      <p>
        夫妻可以選擇「合併報稅」或「分開報稅」（只有薪資可分開），
        系統會自動幫你選最划算的方式。
      </p>

      <h3>Q3：扶養父母可以節稅嗎？</h3>
      <p>
        可以。扶養 70 歲以上父母，每人可多扣 <strong>15.15 萬免稅額</strong>。
        但父母的所得也要併入你的報稅。
      </p>

      <div class="bg-purple-900/30 border border-purple-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-purple-400 font-bold mb-3">📋 實際節稅試算範例</h4>
        <p class="text-slate-300 mb-0">
          假設年薪 120 萬，扣掉免稅額、標準扣除額、薪資扣除額，
          所得淨額大約 73.6 萬，適用 12% 稅率，要繳大約 5.2 萬的稅。<br/><br/>
          如果有房貸，房貸利息最高可以扣 30 萬，
          這樣所得淨額降到 43.6 萬，稅率變 5%，只要繳 2.18 萬，
          一年可以省下 3 萬的稅！
        </p>
      </div>

      <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-blue-400 font-bold mb-3">🛠️ 稅務試算工具</h4>
        <p class="text-slate-300 mb-4">
          使用免費的計算工具，快速試算所得稅、
          找出最佳的節稅方式。
        </p>
        <a href="/calculator" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
          免費使用計算機 →
        </a>
      </div>

      <h2 id="sources">參考資料來源</h2>
      <ul>
        <li><a href="https://cpacorey.com/income-tax-level-2026/" target="_blank" rel="noopener">蔡佳峻會計師 - 114 & 115 年度最新綜合所得稅級距</a></li>
        <li><a href="https://www.money101.com.tw/blog/所得稅-免稅額-扣除額-稅率-級距" target="_blank" rel="noopener">Money101 - 2025/2026 所得稅級距表整理</a></li>
        <li><a href="https://www.businessweekly.com.tw/business/blog/3019532" target="_blank" rel="noopener">商周 - 2026 報稅新制懶人包</a></li>
        <li><a href="https://www.etax.nat.gov.tw/etwmain/etw158w/15" target="_blank" rel="noopener">財政部稅務入口網 - 綜合所得稅試算</a></li>
      </ul>
      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>→ <a href="/blog/tax-season-2026-advisor-tips" class="text-blue-400 hover:underline">2026 報稅季顧問商機：如何幫客戶省稅又創造價值</a></li>
          <li>→ <a href="/blog/nhi-supplementary-premium-2026" class="text-blue-400 hover:underline">2026 健保補充保費完整攻略｜費率、門檻、節省方法一次看</a></li>
          <li>→ <a href="/blog/estate-gift-tax-quick-reference-2026" class="text-blue-400 hover:underline">2026 遺贈稅速算表｜贈與、遺產稅率級距與免稅額</a></li>
        </ul>
      </div>

<p class="text-slate-500 text-sm mt-12">
        最後更新：2026 年 1 月 19 日<br/>
        本文資訊僅供參考，實際稅務規定以財政部公告為準。
      </p>
    </article>
  `
};
