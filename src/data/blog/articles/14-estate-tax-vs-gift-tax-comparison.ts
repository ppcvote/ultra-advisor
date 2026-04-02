import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '14',
  slug: 'estate-tax-vs-gift-tax-comparison',
  title: '一張圖看懂：遺產稅 vs 贈與稅完整比較【2026 最新】',
  excerpt: '遺產稅和贈與稅怎麼選？一張比較表讓你秒懂差異，附 3 個實際節稅案例。',
  category: 'tax',
  tags: ['遺產稅', '贈與稅', '稅務規劃', '節稅', '傳承', '免稅額'],
  readTime: 8,
  publishDate: '2026-01-17',
  author: 'Ultra Advisor',
  featured: false,
  metaTitle: '遺產稅 vs 贈與稅完整比較表【2026】｜3個節稅案例分析',
  metaDescription: '遺產稅免稅額 1,333 萬、贈與稅每年 244 萬，哪個划算？完整比較表 + 3 個實際案例，幫你選對節稅方式。',
  content: `
      <article class="prose prose-invert max-w-none">
        <p class="lead text-xl text-slate-300 mb-8">
          資產傳承是每個家庭都會面臨的課題。
          遺產稅和贈與稅各有優缺點，選對方式可以省下大筆稅金。
          本文用一張比較表，讓你快速看懂兩者差異。
        </p>

        <h2 id="comparison-table">一、遺產稅 vs 贈與稅 完整比較表</h2>

        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr>
                <th>比較項目</th>
                <th class="text-purple-400">遺產稅</th>
                <th class="text-green-400">贈與稅</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>課稅時點</strong></td>
                <td>死亡時</td>
                <td>贈與時</td>
              </tr>
              <tr>
                <td><strong>免稅額</strong></td>
                <td class="text-purple-400 font-bold">1,333 萬</td>
                <td class="text-green-400 font-bold">每年 244 萬</td>
              </tr>
              <tr>
                <td><strong>稅率</strong></td>
                <td>10% / 15% / 20%</td>
                <td>10% / 15% / 20%</td>
              </tr>
              <tr>
                <td><strong>納稅義務人</strong></td>
                <td>繼承人</td>
                <td>贈與人</td>
              </tr>
              <tr>
                <td><strong>申報期限</strong></td>
                <td>死亡後 6 個月內</td>
                <td>贈與後 30 天內</td>
              </tr>
              <tr>
                <td><strong>可扣除項目</strong></td>
                <td>喪葬費、債務、配偶扣除額等</td>
                <td>較少</td>
              </tr>
              <tr>
                <td><strong>資產控制權</strong></td>
                <td>生前保有</td>
                <td>移轉後喪失</td>
              </tr>
              <tr>
                <td><strong>規劃彈性</strong></td>
                <td>較低（時間固定）</td>
                <td>較高（可分年規劃）</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 id="tax-rates">二、稅率級距詳解</h2>

        <h3>遺產稅級距（2026 年）</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr>
                <th>遺產淨額</th>
                <th>稅率</th>
                <th>累進差額</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>5,000 萬以下</td>
                <td>10%</td>
                <td>0</td>
              </tr>
              <tr>
                <td>5,000 萬～1 億</td>
                <td>15%</td>
                <td>250 萬</td>
              </tr>
              <tr>
                <td>1 億以上</td>
                <td>20%</td>
                <td>750 萬</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>贈與稅級距（2026 年）</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr>
                <th>贈與淨額</th>
                <th>稅率</th>
                <th>累進差額</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>2,500 萬以下</td>
                <td>10%</td>
                <td>0</td>
              </tr>
              <tr>
                <td>2,500 萬～5,000 萬</td>
                <td>15%</td>
                <td>125 萬</td>
              </tr>
              <tr>
                <td>5,000 萬以上</td>
                <td>20%</td>
                <td>375 萬</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="bg-amber-900/30 border border-amber-500/30 rounded-2xl p-6 my-8">
          <h4 class="text-amber-400 font-bold mb-2">⚠️ 重要提醒</h4>
          <p class="text-slate-300 text-sm mb-0">
            贈與稅免稅額是「每年每人」244 萬，夫妻合計一年可贈與 488 萬免稅。
            善用這個額度，可以達到分年傳承、節稅的效果。
          </p>
        </div>

        <h2 id="case-studies">三、實際案例分析</h2>

        <h3>案例 1：一次遺產 vs 分年贈與</h3>
        <div class="bg-slate-800/50 rounded-xl p-6 my-6">
          <p class="text-white font-bold mb-2">情境：王先生有 3,000 萬資產要傳給兒子</p>
          <p class="text-slate-300 text-sm mb-4">假設王先生還能活 10 年</p>

          <p class="text-purple-400 font-bold">方案 A：一次遺產</p>
          <ul class="text-slate-300 text-sm">
            <li>遺產淨額：3,000 萬 - 1,333 萬（免稅額）= 1,667 萬</li>
            <li>遺產稅：1,667 萬 × 10% = <strong class="text-purple-400">166.7 萬</strong></li>
          </ul>

          <p class="text-green-400 font-bold mt-4">方案 B：分年贈與（夫妻合計）</p>
          <ul class="text-slate-300 text-sm">
            <li>每年贈與：488 萬（夫妻各 244 萬）</li>
            <li>10 年贈與：488 萬 × 10 = 4,880 萬（超過 3,000 萬）</li>
            <li>贈與稅：<strong class="text-green-400">0 元</strong>（每年都在免稅額內）</li>
          </ul>

          <p class="text-amber-400 font-bold mt-4">節省：166.7 萬</p>
        </div>

        <h3>案例 2：不動產傳承評估</h3>
        <div class="bg-slate-800/50 rounded-xl p-6 my-6">
          <p class="text-white font-bold mb-2">情境：李太太有一間市價 2,000 萬的房子</p>
          <p class="text-slate-300 text-sm mb-4">公告現值 800 萬、土地公告地價 500 萬</p>

          <p class="text-purple-400 font-bold">方案 A：遺產移轉</p>
          <ul class="text-slate-300 text-sm">
            <li>計稅基礎：公告現值 800 萬 + 土地公告地價 500 萬 = 1,300 萬</li>
            <li>扣除免稅額後：1,300 萬 - 1,333 萬 = 0</li>
            <li>遺產稅：<strong class="text-purple-400">0 元</strong></li>
          </ul>

          <p class="text-green-400 font-bold mt-4">方案 B：生前贈與</p>
          <ul class="text-slate-300 text-sm">
            <li>計稅基礎同上：1,300 萬</li>
            <li>扣除免稅額：1,300 萬 - 244 萬 = 1,056 萬</li>
            <li>贈與稅：1,056 萬 × 10% = <strong class="text-green-400">105.6 萬</strong></li>
          </ul>

          <p class="text-amber-400 font-bold mt-4">結論：這個案例，遺產比贈與划算！</p>
        </div>

        <h3>案例 3：保險金傳承</h3>
        <div class="bg-slate-800/50 rounded-xl p-6 my-6">
          <p class="text-white font-bold mb-2">情境：張先生想傳 1,000 萬給孩子</p>

          <p class="text-blue-400 font-bold">方案 C：透過保險</p>
          <ul class="text-slate-300 text-sm">
            <li>規劃保額 1,000 萬的終身壽險</li>
            <li>受益人指定子女</li>
            <li>身故保險金：免計入遺產總額（最低稅負制另計）</li>
            <li>有效傳承 + 可能節省遺產稅</li>
          </ul>

          <p class="text-amber-400 font-bold mt-4">
            注意：最低稅負制規定，要保人與受益人非同一人的保險金，
            超過 3,740 萬的部分需計入基本所得額。
          </p>
        </div>

        <h2 id="when-to-use">四、什麼時候用遺產？什麼時候用贈與？</h2>

        <div class="bg-green-900/30 border border-green-500/30 rounded-2xl p-6 my-8">
          <h4 class="text-green-400 font-bold mb-4">適合用「贈與」的情況：</h4>
          <ul class="text-slate-300 space-y-2">
            <li>✓ 有充裕時間（10 年以上）分年移轉</li>
            <li>✓ 資產以現金為主，容易分割</li>
            <li>✓ 子女已成年，可自行管理財產</li>
            <li>✓ 資產持續增值，越早移轉越省稅</li>
          </ul>
        </div>

        <div class="bg-purple-900/30 border border-purple-500/30 rounded-2xl p-6 my-8">
          <h4 class="text-purple-400 font-bold mb-4">適合用「遺產」的情況：</h4>
          <ul class="text-slate-300 space-y-2">
            <li>✓ 資產總額在免稅額（1,333 萬）附近</li>
            <li>✓ 資產以不動產為主（有各項扣除額）</li>
            <li>✓ 希望生前保有資產控制權</li>
            <li>✓ 家庭關係複雜，不想過早分配</li>
          </ul>
        </div>

        <h2 id="tools">五、規劃工具推薦</h2>

        <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-8">
          <h4 class="text-blue-400 font-bold mb-3">🛠️ Ultra Advisor 稅務傳承工具</h4>
          <p class="text-slate-300 mb-4">
            一鍵試算遺產稅、贈與稅，比較不同方案的稅負差異。
            幫助您和客戶找到最佳的傳承策略。
          </p>
          <a href="/register" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
            免費試用 7 天 →
          </a>
        </div>

        <h2 id="conclusion">結語</h2>
        <p>
          遺產稅和贈與稅沒有絕對的好壞，關鍵在於「規劃」。
        </p>
        <p>
          越早開始規劃，選項越多、彈性越大。
          建議每個家庭都應該在資產還在增值時，就開始思考傳承策略。
        </p>
        <p>
          <strong>這張比較表可以收藏，也歡迎分享給需要的朋友！</strong>
        </p>
      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>→ <a href="/blog/estate-tax-planning-2026" class="text-blue-400 hover:underline">2026 遺產稅免稅額與節稅策略完整指南</a></li>
          <li>→ <a href="/blog/gift-tax-annual-exemption" class="text-blue-400 hover:underline">贈與稅免稅額：每年 244 萬的聰明運用方式【2026】</a></li>
          <li>→ <a href="/blog/estate-gift-tax-quick-reference-2026" class="text-blue-400 hover:underline">2026 遺贈稅速算表｜贈與、遺產稅率級距與免稅額</a></li>
        </ul>
      </div>

<p class="text-slate-500 text-sm mt-12">
          最後更新：2026 年 1 月 17 日<br/>
          本文為稅務規劃參考，實際稅負請諮詢專業會計師或稅務顧問。
        </p>
      </article>
    `
};
