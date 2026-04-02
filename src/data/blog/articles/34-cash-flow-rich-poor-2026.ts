import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '34',
  slug: 'cash-flow-rich-poor-2026',
  title: '窮人、中產、富人的現金流差在哪？一張圖看懂',
  excerpt: '同樣在工作賺錢，為什麼有人越來越窮、有人原地踏步、有人越來越有錢？差別不在收入多少，而在錢流向哪裡。',
  category: 'investment',
  tags: ['現金流', '理財觀念', '富爸爸', '資產', '負債', '財務自由', '2026'],
  readTime: 6,
  publishDate: '2026-01-21',
  author: 'Ultra Advisor',
  featured: true,
  metaTitle: '窮人、中產、富人的現金流差在哪？一張圖看懂財富差距',
  metaDescription: '同樣在工作，為什麼財富差距越來越大？關鍵在現金流的方向。這篇用最簡單的方式，讓你看懂窮人、中產、富人的錢都流去哪了。',
  content: `
    <article class="prose prose-invert max-w-none">
      <p class="lead text-xl text-slate-300 mb-8">
        同樣一個月賺 5 萬。<br/>
        A 五年後還是月光，B 五年後買了房背了貸款，C 五年後靠被動收入cover生活費。<br/><br/>
        <strong>差別在哪？不是收入，是現金流的方向。</strong>
      </p>

      <h2 id="what-is-cashflow">一、什麼是現金流？</h2>

      <p>
        簡單說：<strong>錢從哪裡來、流到哪裡去。</strong>
      </p>

      <p>
        每個人都有兩張表：
      </p>

      <ul>
        <li><strong>損益表</strong>：收入和支出（錢的進出）</li>
        <li><strong>資產負債表</strong>：資產和負債（錢的存量）</li>
      </ul>

      <p>
        窮人、中產、富人的差別，就在這兩張表怎麼連動。
      </p>

      <h2 id="poor-cashflow">二、窮人的現金流</h2>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">💸 窮人的錢怎麼流？</h4>
        <div class="text-slate-300 space-y-2">
          <p><strong>收入來源：</strong>工作 → 薪資</p>
          <p><strong>支出去向：</strong>稅、食物、租金、娛樂</p>
          <p><strong>資產：</strong>（空）</p>
          <p><strong>負債：</strong>（空）</p>
        </div>
      </div>

      <p>
        <strong>特徵：錢進來，馬上出去。</strong>
      </p>

      <p>
        薪水一發，繳房租、買東西、吃飯、娛樂，月底剛好花完。<br/>
        沒有累積任何資產，也沒有負債。<br/>
        下個月，重複一樣的循環。
      </p>

      <p>
        這不是說窮人不努力。<br/>
        而是<strong>錢只在「收入→支出」之間流動，從來沒有流進「資產」那一格。</strong>
      </p>

      <h2 id="middle-class-cashflow">三、中產階級的現金流</h2>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">🏠 中產的錢怎麼流？</h4>
        <div class="text-slate-300 space-y-2">
          <p><strong>收入來源：</strong>工作 → 薪資</p>
          <p><strong>支出去向：</strong>稅、食物、租金 + <span class="text-amber-400">房貸、車貸、信用卡</span></p>
          <p><strong>資產：</strong>（空）</p>
          <p><strong>負債：</strong><span class="text-amber-400">房貸、車貸、信用卡</span></p>
        </div>
      </div>

      <p>
        <strong>特徵：收入增加，負債也增加。</strong>
      </p>

      <p>
        中產比窮人多賺一點，但也多花一點。<br/>
        買房、買車、升級生活品質。<br/>
        看起來過得不錯，但每個月的錢都在繳貸款。
      </p>

      <p>
        <strong>問題在哪？</strong><br/>
        他們以為房子是「資產」，但房子每個月讓你掏錢出去（房貸），<br/>
        在現金流的定義裡，這叫<strong>負債</strong>。
      </p>

      <div class="bg-amber-900/30 border border-amber-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-amber-400 font-bold mb-3">⚠️ 關鍵觀念</h4>
        <p class="text-slate-300 mb-0">
          <strong>資產：把錢放進你口袋的東西</strong><br/>
          <strong>負債：把錢從你口袋拿走的東西</strong><br/><br/>
          自住房每個月要繳房貸 → 負債<br/>
          收租的房子每個月收租金 → 資產
        </p>
      </div>

      <h2 id="rich-cashflow">四、富人的現金流</h2>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">💰 富人的錢怎麼流？</h4>
        <div class="text-slate-300 space-y-2">
          <p><strong>收入來源：</strong>工作薪資 + <span class="text-emerald-400">股息、租金、版稅</span></p>
          <p><strong>支出去向：</strong>稅、食物、租金</p>
          <p><strong>資產：</strong><span class="text-emerald-400">股票、債券、收租房產、事業</span></p>
          <p><strong>負債：</strong>（控制在低水位）</p>
        </div>
      </div>

      <p>
        <strong>特徵：資產產生的收入，流回收入那一格。</strong>
      </p>

      <p>
        富人跟其他人最大的差別：<br/>
        <strong>他們把錢先流進「資產」，再讓資產產生收入。</strong>
      </p>

      <p>
        買股票 → 領股息 → 股息變成新的收入<br/>
        買房出租 → 收租金 → 租金變成新的收入<br/>
        建立事業 → 賺利潤 → 利潤變成新的收入
      </p>

      <p>
        這就是為什麼富人越來越富。<br/>
        <strong>他們的錢在「工作」，而不是只有人在工作。</strong>
      </p>

      <h2 id="comparison">五、三種現金流，一張表看懂</h2>

      <table>
        <thead>
          <tr>
            <th></th>
            <th>窮人</th>
            <th>中產</th>
            <th>富人</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>收入來源</strong></td>
            <td>只有薪資</td>
            <td>只有薪資</td>
            <td>薪資 + 被動收入</td>
          </tr>
          <tr>
            <td><strong>錢流去哪</strong></td>
            <td>全部變支出</td>
            <td>支出 + 繳貸款</td>
            <td>先買資產</td>
          </tr>
          <tr>
            <td><strong>資產</strong></td>
            <td>沒有</td>
            <td>以為有（其實是負債）</td>
            <td>持續累積</td>
          </tr>
          <tr>
            <td><strong>負債</strong></td>
            <td>沒有</td>
            <td>房貸、車貸</td>
            <td>控制在低水位</td>
          </tr>
          <tr>
            <td><strong>結果</strong></td>
            <td>原地踏步</td>
            <td>被貸款綁住</td>
            <td>財務自由</td>
          </tr>
        </tbody>
      </table>

      <h2 id="how-to-change">六、怎麼改變現金流？</h2>

      <p>
        知道問題在哪，接下來是怎麼改。
      </p>

      <h3>第一步：分清楚資產和負債</h3>
      <p>
        不是「值錢的東西」就是資產。<br/>
        問自己：<strong>這個東西，每個月是讓我賺錢，還是讓我花錢？</strong>
      </p>
      <ul>
        <li>自住房（要繳房貸）→ 負債</li>
        <li>出租房（收租金）→ 資產</li>
        <li>自用車（保養、油錢）→ 負債</li>
        <li>股票（領股息）→ 資產</li>
      </ul>

      <h3>第二步：先付錢給自己</h3>
      <p>
        大部分人的順序是：<br/>
        收入 → 支出 → 剩下的才存起來（通常沒剩）
      </p>
      <p>
        <strong>改成：</strong><br/>
        收入 → 先存一筆 → 剩下的才是支出預算
      </p>
      <p>
        這筆「先存的錢」，就是要拿去買資產的錢。
      </p>

      <h3>第三步：把存下來的錢，變成資產</h3>
      <p>
        不是存起來就好，要讓錢去「工作」。
      </p>
      <ul>
        <li>買指數型基金（長期穩定成長）</li>
        <li>買配息股（創造被動收入）</li>
        <li>投資自己的技能（提高主動收入）</li>
      </ul>

      <div class="bg-emerald-900/30 border border-emerald-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-emerald-400 font-bold mb-3">💡 一句話總結</h4>
        <p class="text-slate-300 text-lg mb-0">
          <strong>窮人買消費品，中產買負債，富人買資產。</strong><br/>
          你的錢流向哪裡，決定你五年後在哪裡。
        </p>
      </div>

      <h2 id="action">七、今天就可以做的事</h2>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>□ 列出你每個月的「收入」和「支出」</li>
          <li>□ 列出你目前擁有的「資產」和「負債」</li>
          <li>□ 問自己：我的錢流去哪了？</li>
          <li>□ 設定一個金額，每個月「先付給自己」</li>
          <li>□ 研究一個可以產生被動收入的投資方式</li>
        </ul>
      </div>

      <h2 id="conclusion">八、結論</h2>

      <p>
        財富的差距，不是一天造成的。<br/>
        是每個月、每一筆錢的「流向」，累積出來的結果。
      </p>

      <p>
        <strong>窮人的錢：收入 → 支出（消失）</strong><br/>
        <strong>中產的錢：收入 → 負債（被綁住）</strong><br/>
        <strong>富人的錢：收入 → 資產 → 更多收入（循環）</strong>
      </p>

      <p>
        你不需要現在就變成富人。<br/>
        但你可以從今天開始，<strong>讓一部分的錢，流向資產那一格。</strong>
      </p>

      <div class="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-purple-400 font-bold mb-3">📌 本文重點</h4>
        <ol class="text-slate-300 mb-0 space-y-2">
          <li><strong>現金流</strong>：錢從哪來、流到哪去</li>
          <li><strong>窮人</strong>：收入全變支出，沒有累積</li>
          <li><strong>中產</strong>：收入拿去繳貸款，以為的資產其實是負債</li>
          <li><strong>富人</strong>：收入先買資產，讓資產產生更多收入</li>
          <li><strong>資產定義</strong>：把錢放進口袋的東西</li>
          <li><strong>負債定義</strong>：把錢從口袋拿走的東西</li>
          <li><strong>改變方法</strong>：先付給自己，把錢流向資產</li>
        </ol>
      </div>

      <p>
        你的錢，正在往哪裡流？
      </p>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>→ <a href="/blog/retirement-planning-basics" class="text-blue-400 hover:underline">退休規劃入門：如何計算退休金缺口</a></li>
          <li>→ <a href="/blog/compound-interest-power" class="text-blue-400 hover:underline">複利的威力：讓時間成為你的朋友</a></li>
          <li>→ <a href="/blog/high-dividend-etf-calendar-2026" class="text-blue-400 hover:underline">2026 台股高股息 ETF 配息月曆</a></li>
        </ul>
      </div>
    </article>
  `
};
