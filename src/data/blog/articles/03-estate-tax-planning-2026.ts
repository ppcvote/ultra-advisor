import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '3',
  slug: 'estate-tax-planning-2026',
  title: '2026 遺產稅免稅額與節稅策略完整指南',
  excerpt: '了解最新遺產稅免稅額度與扣除額，以及合法的稅務傳承策略，讓資產順利傳承給下一代。',
  category: 'tax',
  tags: ['遺產稅', '節稅', '稅務傳承', '免稅額', '遺產規劃', '繼承'],
  readTime: 12,
  publishDate: '2026-01-05',
  author: 'Ultra Advisor',
  featured: false,
  metaTitle: '2026 遺產稅完整指南：免稅額、扣除額、稅率與節稅策略',
  metaDescription: '2026年最新遺產稅免稅額1,333萬元。完整說明遺產稅計算方式、扣除額項目、累進稅率，以及合法節稅策略。',
  content: `
    <article class="prose prose-invert max-w-none">
      <p class="lead text-xl text-slate-300 mb-8">
        台灣遺產稅採累進稅率，最高可達 20%。了解遺產稅的計算方式與合法節稅策略，
        可以讓財富更有效率地傳承給下一代。本文整理 2026 年最新的遺產稅規定與實務操作。
      </p>

      <h2 id="tax-threshold">一、2026 年遺產稅免稅額與扣除額</h2>

      <h3>免稅額</h3>
      <p>
        2026 年遺產稅免稅額為 <strong class="text-2xl text-emerald-400">1,333 萬元</strong>。
        這是每位被繼承人的基本免稅額度，遺產淨額在此金額以下免課遺產稅。
      </p>

      <h3>扣除額項目</h3>
      <p>除了免稅額外，還有多項扣除額可以降低應稅遺產：</p>

      <table class="w-full border-collapse my-6">
        <thead>
          <tr class="bg-slate-800">
            <th class="border border-slate-700 p-3 text-left">扣除項目</th>
            <th class="border border-slate-700 p-3 text-right">金額（2026年）</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="border border-slate-700 p-3">配偶扣除額</td>
            <td class="border border-slate-700 p-3 text-right text-emerald-400">553 萬元</td>
          </tr>
          <tr>
            <td class="border border-slate-700 p-3">直系血親卑親屬扣除額（每人）</td>
            <td class="border border-slate-700 p-3 text-right text-emerald-400">56 萬元</td>
          </tr>
          <tr>
            <td class="border border-slate-700 p-3">父母扣除額（每人）</td>
            <td class="border border-slate-700 p-3 text-right text-emerald-400">138 萬元</td>
          </tr>
          <tr>
            <td class="border border-slate-700 p-3">身心障礙扣除額（每人）</td>
            <td class="border border-slate-700 p-3 text-right text-emerald-400">693 萬元</td>
          </tr>
          <tr>
            <td class="border border-slate-700 p-3">喪葬費扣除額</td>
            <td class="border border-slate-700 p-3 text-right text-emerald-400">138 萬元</td>
          </tr>
          <tr>
            <td class="border border-slate-700 p-3">未成年子女扣除額</td>
            <td class="border border-slate-700 p-3 text-right text-emerald-400">56萬×(18-年齡)</td>
          </tr>
        </tbody>
      </table>

      <h2 id="tax-rate">二、遺產稅率級距</h2>

      <p>台灣遺產稅採累進稅率，2026 年稅率如下：</p>

      <table class="w-full border-collapse my-6">
        <thead>
          <tr class="bg-slate-800">
            <th class="border border-slate-700 p-3 text-left">課稅遺產淨額</th>
            <th class="border border-slate-700 p-3 text-center">稅率</th>
            <th class="border border-slate-700 p-3 text-right">累進差額</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="border border-slate-700 p-3">5,621 萬元以下</td>
            <td class="border border-slate-700 p-3 text-center text-emerald-400">10%</td>
            <td class="border border-slate-700 p-3 text-right">0</td>
          </tr>
          <tr>
            <td class="border border-slate-700 p-3">5,621 萬 ~ 1 億 1,242 萬</td>
            <td class="border border-slate-700 p-3 text-center text-amber-400">15%</td>
            <td class="border border-slate-700 p-3 text-right">281 萬</td>
          </tr>
          <tr>
            <td class="border border-slate-700 p-3">超過 1 億 1,242 萬</td>
            <td class="border border-slate-700 p-3 text-center text-red-400">20%</td>
            <td class="border border-slate-700 p-3 text-right">843 萬</td>
          </tr>
        </tbody>
      </table>

      <h2 id="calculation-example">三、遺產稅計算實例</h2>

      <div class="bg-slate-800 rounded-xl p-6 my-6">
        <h4 class="text-white font-bold mb-4">📊 案例：王先生的遺產稅計算</h4>
        <ul class="text-slate-300 space-y-1 mb-4">
          <li>遺產總額：<strong class="text-white">8,000 萬元</strong>（房產 5,000 萬 + 存款 3,000 萬）</li>
          <li>繼承人：配偶 1 人、成年子女 2 人</li>
        </ul>

        <div class="border-t border-slate-700 pt-4">
          <p class="text-slate-400 mb-2">計算過程：</p>
          <table class="w-full text-sm">
            <tbody>
              <tr>
                <td class="py-1 text-slate-400">遺產總額</td>
                <td class="py-1 text-right text-white">80,000,000</td>
              </tr>
              <tr>
                <td class="py-1 text-slate-400">- 免稅額</td>
                <td class="py-1 text-right text-emerald-400">- 13,330,000</td>
              </tr>
              <tr>
                <td class="py-1 text-slate-400">- 配偶扣除額</td>
                <td class="py-1 text-right text-emerald-400">- 5,530,000</td>
              </tr>
              <tr>
                <td class="py-1 text-slate-400">- 子女扣除額（2人）</td>
                <td class="py-1 text-right text-emerald-400">- 1,120,000</td>
              </tr>
              <tr>
                <td class="py-1 text-slate-400">- 喪葬費扣除額</td>
                <td class="py-1 text-right text-emerald-400">- 1,380,000</td>
              </tr>
              <tr class="border-t border-slate-600">
                <td class="py-2 text-white font-bold">課稅遺產淨額</td>
                <td class="py-2 text-right text-white font-bold">58,640,000</td>
              </tr>
            </tbody>
          </table>

          <p class="text-slate-400 mt-4 mb-2">稅額計算（適用 15% 稅率）：</p>
          <p class="text-white">58,640,000 × 15% - 2,810,000 = <strong class="text-2xl text-red-400">5,986,000 元</strong></p>
        </div>
      </div>

      <h2 id="tax-strategies">四、合法節稅策略</h2>

      <h3>1. 善用每年贈與免稅額</h3>
      <p>
        每人每年有 <strong>244 萬元</strong> 的贈與免稅額。夫妻合計每年可以移轉
        <strong>488 萬元</strong> 給子女，完全免稅。持續 20 年，就能移轉近 1 億元。
      </p>

      <h3>2. 購買保險的免稅效果</h3>
      <p>
        符合條件的人壽保險死亡給付，可以不計入遺產課稅。但要注意：
      </p>
      <ul>
        <li>須為「被繼承人」投保並繳納保費</li>
        <li>指定「法定繼承人」為受益人</li>
        <li>避免高齡、重病投保，以免被認定為「實質課稅」</li>
      </ul>

      <h3>3. 不動產的節稅空間</h3>
      <p>
        不動產遺產是以「公告現值」計算，通常低於市價。但要注意近年來公告現值
        逐步調高，節稅空間有限。此外，繼承後出售可能面臨「房地合一稅」。
      </p>

      <h3>4. 信託規劃</h3>
      <p>
        透過「他益信託」可以將資產在信託成立時視為贈與，提前移轉並鎖定價值。
        適合預期資產會大幅增值的情況。
      </p>

      <div class="bg-amber-900/30 border border-amber-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-amber-400 font-bold mb-3">⚠️ 注意事項</h4>
        <ul class="text-slate-300 space-y-2">
          <li>死亡前 2 年內的贈與，仍要併入遺產計算</li>
          <li>生前處分財產如被認定為「脫產」，可能被追繳稅款</li>
          <li>稅務規劃應諮詢專業會計師或稅務律師</li>
        </ul>
      </div>

      <h2 id="liquidity-risk">五、遺產稅的流動性風險</h2>

      <p>
        許多人的遺產以不動產為主，現金比例偏低。當繼承發生時，可能面臨
        「有房沒錢繳稅」的窘境。以上述案例為例，近 600 萬的遺產稅必須在
        6 個月內繳納，否則會產生滯納金。
      </p>

      <h3>如何預防流動性風險？</h3>
      <ol>
        <li><strong>購買足額壽險</strong>：保險金可以作為繳納遺產稅的資金來源</li>
        <li><strong>保留適當現金</strong>：建議現金佔總資產的 10-20%</li>
        <li><strong>提前規劃</strong>：透過贈與逐步移轉資產，降低遺產總額</li>
      </ol>

      <div class="bg-purple-900/30 border border-purple-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-purple-400 font-bold mb-3">🛠️ 使用工具試算您的遺產稅</h4>
        <p class="text-slate-300 mb-4">
          Ultra Advisor 提供完整的遺產稅試算工具，輸入您的資產狀況，
          即可計算預估稅額、流動性缺口，並提供節稅建議。
        </p>
        <a href="/register" class="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
          免費試用 7 天 →
        </a>
      </div>

      <h2 id="conclusion">結語</h2>
      <p>
        遺產稅規劃是長期的財務工程，越早開始越有優勢。建議在 50 歲左右就開始
        思考資產傳承的問題，預留充足的時間進行規劃。
      </p>
      <p>
        如果您的資產規模較大，強烈建議諮詢專業的稅務顧問，
        根據您的具體情況制定個人化的傳承方案。
      </p>
      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>→ <a href="/blog/gift-tax-annual-exemption" class="text-blue-400 hover:underline">贈與稅免稅額：每年 244 萬的聰明運用方式【2026】</a></li>
          <li>→ <a href="/blog/estate-tax-vs-gift-tax-comparison" class="text-blue-400 hover:underline">遺產稅 vs 贈與稅差在哪？一張表完整比較【2026】</a></li>
          <li>→ <a href="/blog/estate-gift-tax-quick-reference-2026" class="text-blue-400 hover:underline">2026 遺贈稅速算表｜贈與、遺產稅率級距與免稅額</a></li>
        </ul>
      </div>

<p class="text-slate-500 text-sm mt-12">
        最後更新：2026 年 1 月 5 日<br/>
        本文數據以財政部 2026 年公告為準。稅務規劃請諮詢專業人士。
      </p>
    </article>
  `
};
