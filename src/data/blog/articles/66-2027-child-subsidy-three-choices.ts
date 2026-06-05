import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '66',
  slug: '2027-child-subsidy-three-choices',
  title: '2027 起政府給孩子 158 萬：花掉、存定存、規劃，18 年後差 200 萬',
  excerpt: '0-18 歲成長津貼 2027 上路，單一胎家庭從政府手上會拿到 158 萬。三種用法的差距，比多數人想像中大。',
  category: 'investment',
  tags: ['懶人包', '育兒津貼', '成長津貼', '生育津貼', '兒童保單', '投資型保單', '教育金規劃', '2027 新政'],
  readTime: 5,
  publishDate: '2026-06-05',
  author: 'Ultra Advisor 理財團隊',
  featured: true,
  metaTitle: '2027 成長津貼 158 萬怎麼用？18 年差 200 萬｜Ultra Advisor',
  metaDescription: '0-18 歲成長津貼 2027 上路。理財顧問用一張圖比給您看：158 萬政府津貼，三種用法 18 年後差距高達 200 萬。',
  content: `
    <article class="prose prose-invert max-w-none">

      <!-- LEAD -->
      <p class="lead text-base text-slate-300 mb-6 leading-relaxed">
        新政策一出，網路上一堆「懶人包」。但做為理財顧問，我的工作不是再翻譯一次，是讓您看清楚——<strong>同一筆錢的不同選擇，會把哪些壓力，轉嫁到哪個時間點的誰身上</strong>。
      </p>

      <!-- SCREEN 1: HERO -->
      <div class="text-center my-10 py-12 bg-gradient-to-b from-yellow-950/30 to-transparent border-y border-yellow-700/30 rounded-2xl">
        <div class="text-yellow-400 text-xs font-bold tracking-widest mb-3">2027 起,單一胎家庭累積</div>
        <div class="text-6xl md:text-8xl font-black text-yellow-300 leading-none mb-3">158<span class="text-3xl md:text-4xl text-yellow-500 ml-2">萬</span></div>
        <div class="text-slate-300 text-lg md:text-xl mb-6">政府給孩子 18 年的錢</div>
        <div class="text-yellow-400 text-base md:text-lg font-bold tracking-wide">── 你打算怎麼用？──</div>
      </div>

      <!-- Quick policy breakdown -->
      <div class="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-6 my-8">
        <div class="text-slate-400 text-xs font-bold tracking-widest mb-4">這 158 萬從哪來</div>
        <div class="space-y-3">
          <div class="flex items-baseline justify-between border-b border-slate-800 pb-2">
            <span class="text-slate-300 text-sm">出生一次性 · 中央 10 萬 + 台北市 4 萬</span>
            <span class="text-yellow-300 font-bold text-lg">14 萬</span>
          </div>
          <div class="flex items-baseline justify-between border-b border-slate-800 pb-2">
            <span class="text-slate-300 text-sm">0-6 歲 · 育兒津貼 + 成長津貼 每月 1 萬</span>
            <span class="text-yellow-300 font-bold text-lg">72 萬</span>
          </div>
          <div class="flex items-baseline justify-between">
            <span class="text-slate-300 text-sm">6-18 歲 · 成長津貼 每月 5 千</span>
            <span class="text-yellow-300 font-bold text-lg">72 萬</span>
          </div>
        </div>
        <p class="text-xs text-slate-500 mt-4 mb-0">📌 以第 1 胎、設籍台北市試算。不同縣市地方加碼差最大 8 萬。</p>
      </div>

      <!-- Caution callout -->
      <div class="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 my-6 text-sm">
        <span class="text-yellow-400 font-bold">⚠️ 還沒拍板:</span>
        <span class="text-slate-300">成長津貼預算 190 億在立法院,最快 2027 上路,有可能延後或加排富。</span>
      </div>

      <!-- SCREEN 2: CHART 1 -->
      <h2 id="screen-cumulative">每年領多少？</h2>

      <p class="text-slate-300 text-sm">注意 <strong>6 歲那年的斜率轉折</strong>——0-6 歲每年 12 萬,6 歲後每年只剩 6 萬:</p>

      <div class="bg-slate-900/50 border border-slate-700 rounded-2xl p-4 my-6">
        <svg viewBox="0 0 800 400" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto">
          <defs>
            <linearGradient id="ch1Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.5"/>
              <stop offset="100%" stop-color="#fbbf24" stop-opacity="0.04"/>
            </linearGradient>
          </defs>

          <text x="400" y="28" text-anchor="middle" fill="#f1f5f9" font-size="17" font-weight="bold">一個孩子 0-18 歲累積領取的政府津貼(萬元)</text>

          <line x1="80" y1="60" x2="760" y2="60" stroke="#1e293b" stroke-width="1"/>
          <line x1="80" y1="120" x2="760" y2="120" stroke="#1e293b" stroke-width="1"/>
          <line x1="80" y1="180" x2="760" y2="180" stroke="#1e293b" stroke-width="1"/>
          <line x1="80" y1="240" x2="760" y2="240" stroke="#1e293b" stroke-width="1"/>
          <line x1="80" y1="300" x2="760" y2="300" stroke="#1e293b" stroke-width="1"/>
          <line x1="80" y1="350" x2="760" y2="350" stroke="#475569" stroke-width="2"/>

          <text x="68" y="354" text-anchor="end" fill="#cbd5e1" font-size="13">0</text>
          <text x="68" y="304" text-anchor="end" fill="#cbd5e1" font-size="13">40</text>
          <text x="68" y="244" text-anchor="end" fill="#cbd5e1" font-size="13">80</text>
          <text x="68" y="184" text-anchor="end" fill="#cbd5e1" font-size="13">120</text>
          <text x="68" y="124" text-anchor="end" fill="#cbd5e1" font-size="13">160</text>

          <text x="80" y="375" text-anchor="middle" fill="#cbd5e1" font-size="13">0</text>
          <text x="193" y="375" text-anchor="middle" fill="#cbd5e1" font-size="13">3</text>
          <text x="307" y="375" text-anchor="middle" fill="#cbd5e1" font-size="13">6</text>
          <text x="420" y="375" text-anchor="middle" fill="#cbd5e1" font-size="13">9</text>
          <text x="533" y="375" text-anchor="middle" fill="#cbd5e1" font-size="13">12</text>
          <text x="647" y="375" text-anchor="middle" fill="#cbd5e1" font-size="13">15</text>
          <text x="722" y="375" text-anchor="middle" fill="#cbd5e1" font-size="13">17 歲</text>

          <!-- Area fill -->
          <path d="M 80,350 L 80,293 L 118,275 L 156,257 L 193,239 L 231,221 L 269,203 L 307,194 L 344,185 L 382,176 L 420,167 L 458,158 L 496,149 L 533,140 L 571,131 L 609,122 L 647,113 L 684,104 L 722,95 L 722,350 Z" fill="url(#ch1Grad)"/>

          <!-- Line -->
          <polyline points="80,293 118,275 156,257 193,239 231,221 269,203 307,194 344,185 382,176 420,167 458,158 496,149 533,140 571,131 609,122 647,113 684,104 722,95" fill="none" stroke="#fbbf24" stroke-width="3"/>

          <!-- Inflection point at age 6 -->
          <circle cx="307" cy="194" r="5" fill="#fbbf24"/>
          <text x="307" y="220" text-anchor="middle" fill="#94a3b8" font-size="12">↑ 6 歲後斜率轉緩</text>

          <!-- Start/end labels -->
          <circle cx="80" cy="293" r="4" fill="#fbbf24"/>
          <text x="80" y="283" text-anchor="middle" fill="#fbbf24" font-size="12" font-weight="bold">26 萬</text>

          <circle cx="722" cy="95" r="6" fill="#fbbf24"/>
          <text x="722" y="80" text-anchor="middle" fill="#fef3c7" font-size="14" font-weight="bold">158 萬</text>
        </svg>
      </div>

      <!-- SCREEN 3: THE CHOICES -->
      <h2 id="screen-choices">三種選擇,18 年後差 200 萬</h2>

      <p class="text-slate-300 text-sm">這筆錢的三種典型用法,18 年複利下來結果完全不同:</p>

      <ul class="text-slate-300 text-sm">
        <li><strong class="text-slate-100">A · 花掉</strong>——跟生活費混在一起,只剩政府強制存的 TISA(2% 保底)</li>
        <li><strong class="text-slate-100">B · 全進銀行</strong>——每月匯入儲蓄帳戶,1.5% 定存</li>
        <li><strong class="text-slate-100">C · 投資型主約 + 附約全險</strong>——月繳保單承接,假設淨報酬 5%</li>
      </ul>

      <!-- CHART 2: Three scenarios area chart -->
      <div class="bg-slate-900/50 border border-slate-700 rounded-2xl p-4 my-8">
        <svg viewBox="0 0 800 510" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto">
          <defs>
            <linearGradient id="ch2GradA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#94a3b8" stop-opacity="0.5"/>
              <stop offset="100%" stop-color="#94a3b8" stop-opacity="0.04"/>
            </linearGradient>
            <linearGradient id="ch2GradB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.5"/>
              <stop offset="100%" stop-color="#60a5fa" stop-opacity="0.04"/>
            </linearGradient>
            <linearGradient id="ch2GradC" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.55"/>
              <stop offset="100%" stop-color="#fbbf24" stop-opacity="0.05"/>
            </linearGradient>
          </defs>

          <text x="400" y="32" text-anchor="middle" fill="#f1f5f9" font-size="19" font-weight="bold">三種選擇,18 年後資產差距</text>
          <text x="400" y="54" text-anchor="middle" fill="#94a3b8" font-size="13">縱軸:累積資產(萬元)　橫軸:孩子年齡(0-18 歲)</text>

          <line x1="80" y1="80" x2="700" y2="80" stroke="#1e293b" stroke-width="1"/>
          <line x1="80" y1="144" x2="700" y2="144" stroke="#1e293b" stroke-width="1"/>
          <line x1="80" y1="208" x2="700" y2="208" stroke="#1e293b" stroke-width="1"/>
          <line x1="80" y1="272" x2="700" y2="272" stroke="#1e293b" stroke-width="1"/>
          <line x1="80" y1="336" x2="700" y2="336" stroke="#1e293b" stroke-width="1"/>
          <line x1="80" y1="400" x2="700" y2="400" stroke="#475569" stroke-width="2"/>

          <text x="68" y="404" text-anchor="end" fill="#cbd5e1" font-size="13" font-weight="500">0</text>
          <text x="68" y="340" text-anchor="end" fill="#cbd5e1" font-size="13" font-weight="500">50</text>
          <text x="68" y="276" text-anchor="end" fill="#cbd5e1" font-size="13" font-weight="500">100</text>
          <text x="68" y="212" text-anchor="end" fill="#cbd5e1" font-size="13" font-weight="500">150</text>
          <text x="68" y="148" text-anchor="end" fill="#cbd5e1" font-size="13" font-weight="500">200</text>
          <text x="68" y="84" text-anchor="end" fill="#cbd5e1" font-size="13" font-weight="500">250</text>

          <text x="80" y="425" text-anchor="middle" fill="#cbd5e1" font-size="13" font-weight="500">0</text>
          <text x="183" y="425" text-anchor="middle" fill="#cbd5e1" font-size="13" font-weight="500">3</text>
          <text x="287" y="425" text-anchor="middle" fill="#cbd5e1" font-size="13" font-weight="500">6</text>
          <text x="390" y="425" text-anchor="middle" fill="#cbd5e1" font-size="13" font-weight="500">9</text>
          <text x="493" y="425" text-anchor="middle" fill="#cbd5e1" font-size="13" font-weight="500">12</text>
          <text x="597" y="425" text-anchor="middle" fill="#cbd5e1" font-size="13" font-weight="500">15</text>
          <text x="700" y="425" text-anchor="middle" fill="#cbd5e1" font-size="13" font-weight="500">18 歲</text>

          <path d="M 80,400 L 80,372 L 114,357 L 149,342 L 183,326 L 218,309 L 252,292 L 287,279 L 321,266 L 356,253 L 390,239 L 425,224 L 459,209 L 493,193 L 528,176 L 562,159 L 597,141 L 631,122 L 666,102 L 700,89 L 700,400 Z" fill="url(#ch2GradC)"/>
          <path d="M 80,400 L 80,367 L 114,351 L 149,335 L 183,318 L 218,302 L 252,285 L 287,276 L 321,266 L 356,256 L 390,247 L 425,237 L 459,226 L 493,216 L 528,205 L 562,194 L 597,184 L 631,172 L 666,161 L 700,157 L 700,400 Z" fill="url(#ch2GradB)"/>
          <path d="M 80,400 L 80,400 L 114,400 L 149,400 L 183,400 L 218,400 L 252,400 L 287,396 L 321,392 L 356,388 L 390,384 L 425,380 L 459,376 L 493,371 L 528,367 L 562,363 L 597,358 L 631,353 L 666,349 L 700,348 L 700,400 Z" fill="url(#ch2GradA)"/>

          <line x1="80" y1="246" x2="700" y2="246" stroke="#ef4444" stroke-dasharray="6,4" stroke-width="2" opacity="0.75"/>
          <rect x="430" y="226" width="270" height="20" fill="#0f172a" opacity="0.9" rx="3"/>
          <text x="695" y="240" text-anchor="end" fill="#fca5a5" font-size="12" font-weight="600">⊢ 私立大學 4 年費用 ≈ 120 萬</text>

          <polyline points="80,400 114,400 149,400 183,400 218,400 252,400 287,396 321,392 356,388 390,384 425,380 459,376 493,371 528,367 562,363 597,358 631,353 666,349 700,348" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-dasharray="6,4"/>
          <polyline points="80,367 114,351 149,335 183,318 218,302 252,285 287,276 321,266 356,256 390,247 425,237 459,226 493,216 528,205 562,194 597,184 631,172 666,161 700,157" fill="none" stroke="#60a5fa" stroke-width="3"/>
          <polyline points="80,372 114,357 149,342 183,326 218,309 252,292 287,279 321,266 356,253 390,239 425,224 459,209 493,193 528,176 562,159 597,141 631,122 666,102 700,89" fill="none" stroke="#fbbf24" stroke-width="4"/>

          <circle cx="700" cy="348" r="22" fill="#94a3b8" opacity="0.25"/>
          <circle cx="700" cy="348" r="7" fill="#94a3b8"/>
          <text x="728" y="343" fill="#e2e8f0" font-size="15" font-weight="bold">A · 41 萬</text>
          <text x="728" y="361" fill="#94a3b8" font-size="11">教育金缺口 → 學貸 / 動退休金</text>

          <circle cx="700" cy="157" r="22" fill="#60a5fa" opacity="0.25"/>
          <circle cx="700" cy="157" r="7" fill="#60a5fa"/>
          <text x="728" y="152" fill="#dbeafe" font-size="15" font-weight="bold">B · 190 萬</text>
          <text x="728" y="170" fill="#94a3b8" font-size="11">通膨後實質購買力 ≈ 133 萬</text>

          <circle cx="700" cy="89" r="24" fill="#fbbf24" opacity="0.3"/>
          <circle cx="700" cy="89" r="8" fill="#fbbf24"/>
          <text x="728" y="84" fill="#fef3c7" font-size="15" font-weight="bold">C · 243 萬</text>
          <text x="728" y="102" fill="#fde68a" font-size="11">+ 18 年完整全險保障</text>

          <rect x="100" y="465" width="28" height="3.5" fill="#94a3b8"/>
          <text x="136" y="472" fill="#cbd5e1" font-size="13">A 花掉</text>
          <rect x="220" y="465" width="28" height="3.5" fill="#60a5fa"/>
          <text x="256" y="472" fill="#cbd5e1" font-size="13">B 銀行定存 1.5%</text>
          <rect x="410" y="465" width="28" height="4" fill="#fbbf24"/>
          <text x="446" y="472" fill="#cbd5e1" font-size="13">C 投資型 + 全險(淨 5%)</text>
          <line x1="610" y1="468" x2="638" y2="468" stroke="#ef4444" stroke-dasharray="4,3" stroke-width="2"/>
          <text x="646" y="472" fill="#fca5a5" font-size="13">教育金基準線</text>

          <text x="400" y="498" text-anchor="middle" fill="#fde68a" font-size="14" font-weight="bold">C 與 A 差距 = 202 萬 + 18 年保障　|　C 比 B 多 53 萬 + 18 年保障</text>
        </svg>
      </div>

      <!-- 3-card comparison panel -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
        <div class="bg-slate-900/60 border-2 border-slate-700 rounded-2xl p-5 text-center">
          <div class="text-slate-400 text-xs font-bold tracking-widest mb-2">選擇 A · 花掉</div>
          <div class="text-4xl font-black text-slate-300 mb-1">41 <span class="text-lg text-slate-500">萬</span></div>
          <div class="text-3xl mb-2">❌</div>
          <div class="text-sm text-slate-400 leading-relaxed">教育金不足<br/>孩子背學貸 / 動您退休金<br/>過程中無保障</div>
        </div>
        <div class="bg-blue-950/40 border-2 border-blue-700/50 rounded-2xl p-5 text-center">
          <div class="text-blue-400 text-xs font-bold tracking-widest mb-2">選擇 B · 銀行定存</div>
          <div class="text-4xl font-black text-blue-300 mb-1">190 <span class="text-lg text-blue-500">萬</span></div>
          <div class="text-3xl mb-2">🟡</div>
          <div class="text-sm text-slate-400 leading-relaxed">通膨吃掉購買力<br/>實質約 133 萬<br/>過程中無保障</div>
        </div>
        <div class="bg-yellow-950/40 border-2 border-yellow-600/60 rounded-2xl p-5 text-center shadow-xl shadow-yellow-900/20">
          <div class="text-yellow-400 text-xs font-bold tracking-widest mb-2">選擇 C · 規劃</div>
          <div class="text-4xl font-black text-yellow-300 mb-1">243 <span class="text-lg text-yellow-500">萬</span></div>
          <div class="text-3xl mb-2">✅</div>
          <div class="text-sm text-slate-300 leading-relaxed">教育金充足<br/><strong class="text-yellow-200">+ 18 年完整全險</strong><br/>孩子不背學貸、您不動退休金</div>
        </div>
      </div>

      <!-- SCREEN 4: IMPACT TABLE -->
      <h2 id="screen-impact">壓力會掉到誰身上、什麼時候</h2>

      <p class="text-slate-300 text-sm">同一筆錢的選擇,把不同壓力分配給不同時間點:</p>

      <div class="bg-slate-900/40 border border-slate-700 rounded-2xl overflow-hidden my-6">
        <div class="grid grid-cols-3 bg-slate-800/60 text-center">
          <div class="p-3 text-xs font-bold tracking-widest text-slate-400">情境</div>
          <div class="p-3 text-xs font-bold tracking-widest text-slate-400">選 A · 花掉</div>
          <div class="p-3 text-xs font-bold tracking-widest text-yellow-400">選 C · 規劃</div>
        </div>
        <div class="grid grid-cols-3 border-t border-slate-800">
          <div class="p-3 text-sm text-slate-300">孩子 0-6 歲生病</div>
          <div class="p-3 text-sm text-slate-400 text-center">自費 + 收入中斷壓您</div>
          <div class="p-3 text-sm text-yellow-200 text-center font-bold">附約全險承接</div>
        </div>
        <div class="grid grid-cols-3 border-t border-slate-800">
          <div class="p-3 text-sm text-slate-300">孩子 18 歲升學</div>
          <div class="p-3 text-sm text-slate-400 text-center">背學貸 / 您動退休金</div>
          <div class="p-3 text-sm text-yellow-200 text-center font-bold">教育金充足</div>
        </div>
        <div class="grid grid-cols-3 border-t border-slate-800">
          <div class="p-3 text-sm text-slate-300">您的退休準備</div>
          <div class="p-3 text-sm text-slate-400 text-center">可能被吃掉一部分</div>
          <div class="p-3 text-sm text-yellow-200 text-center font-bold">不被動用</div>
        </div>
        <div class="grid grid-cols-3 border-t border-slate-800">
          <div class="p-3 text-sm text-slate-300">父母心理感受</div>
          <div class="p-3 text-sm text-slate-400 text-center">「錢都花到哪去了」</div>
          <div class="p-3 text-sm text-yellow-200 text-center font-bold">「孩子有專屬資產」</div>
        </div>
      </div>

      <!-- Why C structure callout -->
      <div class="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-5 my-6">
        <p class="text-purple-300 text-xs font-bold tracking-widest mb-2">💡 為什麼是「投資型主約 + 附約全險」</p>
        <p class="text-slate-300 text-sm leading-relaxed mb-0">
          投資型保單的<strong>月繳紀律</strong>,正好攔截政府按月匯入的津貼。同一份合約裡,主約做教育金、附約做兒童健康保障。兒童附約多數限定附加主約,並非顧問話術,而是商品結構決定的。
        </p>
      </div>

      <!-- Insurance riders compressed -->
      <div class="bg-slate-900/40 border border-slate-700 rounded-2xl p-6 my-6">
        <div class="text-slate-400 text-xs font-bold tracking-widest mb-4">附約六道防線(月繳 1,500-2,000 起可做扎實基礎)</div>
        <div class="space-y-3 text-sm">
          <div class="text-slate-300"><span class="text-yellow-300 font-bold">①</span> <strong class="text-slate-100">兒童重大傷病險</strong> · 100-300 萬一次給付(川崎症 / 白血病 / 腦炎)</div>
          <div class="text-slate-300"><span class="text-yellow-300 font-bold">②</span> <strong class="text-slate-100">住院醫療日額</strong> · 2,000-3,000 / 日(補貼看護工資)</div>
          <div class="text-slate-300"><span class="text-yellow-300 font-bold">③</span> <strong class="text-slate-100">雙實支實付</strong> · 100-200 萬限額(自費病房 / 特殊治療)</div>
          <div class="text-slate-300"><span class="text-yellow-300 font-bold">④</span> <strong class="text-slate-100">意外險 + 意外醫療</strong> · 主約 200-500 萬</div>
          <div class="text-slate-300"><span class="text-yellow-300 font-bold">⑤</span> <strong class="text-slate-100">癌症險</strong> · 一次給付 100-200 萬</div>
          <div class="text-slate-300"><span class="text-yellow-300 font-bold">⑥</span> <strong class="text-slate-100">失能扶助險</strong> · 月給付 2-3 萬</div>
        </div>
      </div>

      <!-- SCREEN 5: ACTION -->
      <h2 id="screen-action">下個月就能做的 5 件事</h2>

      <div class="bg-slate-900/40 border border-slate-700 rounded-2xl p-6 my-6">
        <ol class="space-y-4 list-none p-0 m-0">
          <li class="flex items-start gap-3 m-0">
            <span class="flex-shrink-0 w-8 h-8 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-yellow-300 font-bold text-base flex items-center justify-center">1</span>
            <div class="flex-1 text-slate-300 text-sm leading-relaxed pt-1">
              <strong class="text-slate-100">確認設籍縣市</strong>——查當地生育津貼金額(地方加碼差最大 8 萬)
            </div>
          </li>
          <li class="flex items-start gap-3 m-0">
            <span class="flex-shrink-0 w-8 h-8 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-yellow-300 font-bold text-base flex items-center justify-center">2</span>
            <div class="flex-1 text-slate-300 text-sm leading-relaxed pt-1">
              <strong class="text-slate-100">申請現行育兒津貼</strong>——衛福部 0-未滿 5 歲線上申請:twbaby.sfaa.gov.tw
            </div>
          </li>
          <li class="flex items-start gap-3 m-0">
            <span class="flex-shrink-0 w-8 h-8 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-yellow-300 font-bold text-base flex items-center justify-center">3</span>
            <div class="flex-1 text-slate-300 text-sm leading-relaxed pt-1">
              <strong class="text-slate-100">2026 年底前做體檢</strong>——影響 2027 開始的保單核保條件,越早越寬
            </div>
          </li>
          <li class="flex items-start gap-3 m-0">
            <span class="flex-shrink-0 w-8 h-8 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-yellow-300 font-bold text-base flex items-center justify-center">4</span>
            <div class="flex-1 text-slate-300 text-sm leading-relaxed pt-1">
              <strong class="text-slate-100">與顧問試算月繳方案</strong>——搞清楚保單費用、保證利益、預估非保證利益
            </div>
          </li>
          <li class="flex items-start gap-3 m-0">
            <span class="flex-shrink-0 w-8 h-8 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-yellow-300 font-bold text-base flex items-center justify-center">5</span>
            <div class="flex-1 text-slate-300 text-sm leading-relaxed pt-1">
              <strong class="text-slate-100">等 2027 法案三讀後再簽約</strong>——避免政策變動風險,期間先存「預備金」
            </div>
          </li>
        </ol>
      </div>

      <!-- Tool CTA -->
      <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-8 text-center">
        <p class="text-blue-300 text-sm mb-4">用我們的試算工具看你家具體會差多少</p>
        <a href="/compound-calculator" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3 rounded-xl transition-colors mr-2 no-underline">複利計算機 →</a>
        <a href="/education-fund-calculator" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3 rounded-xl transition-colors no-underline">教育金規劃 →</a>
      </div>

      <!-- SOURCES (collapsed) -->
      <details class="my-8 group">
        <summary class="cursor-pointer bg-slate-900/40 border border-slate-700 rounded-xl px-5 py-3 text-slate-300 text-sm font-bold hover:bg-slate-800/50 transition list-none">
          📚 點開所有官方資料來源(政府官方 + 統計 + 媒體報導)
          <span class="float-right group-open:rotate-180 transition inline-block">▾</span>
        </summary>
        <div class="bg-slate-900/30 border border-t-0 border-slate-700 rounded-b-xl px-5 py-4 -mt-1 text-sm space-y-4">

          <div>
            <div class="text-slate-400 text-xs font-bold tracking-widest mb-2">政策原文(一手來源)</div>
            <ul class="space-y-1 my-0">
              <li class="m-0"><a href="https://www.ey.gov.tw" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">行政院</a> · 強化家庭支持方案 / 0-18 國家養政策說明</li>
              <li class="m-0"><a href="https://www.mohw.gov.tw/cp-5130-58003-1.html" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">衛福部</a> · 未滿 2 歲幼兒照顧政策專區</li>
              <li class="m-0"><a href="https://twbaby.sfaa.gov.tw" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">社家署</a> · 育兒津貼線上申請系統</li>
              <li class="m-0"><a href="https://www.edu.tw" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">教育部</a> · 2-6 歲教育補助 / 學貸 / 高中職免學費</li>
              <li class="m-0"><a href="https://born.taipei" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">助您好孕</a>(台北市)· 整合北市津貼資訊</li>
              <li class="m-0"><a href="https://lis.ly.gov.tw" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">立法院議事系統</a> · 法案 190 億預算審查進度</li>
            </ul>
          </div>

          <div>
            <div class="text-slate-400 text-xs font-bold tracking-widest mb-2">金融保險監理</div>
            <ul class="space-y-1 my-0">
              <li class="m-0"><a href="https://www.fsc.gov.tw" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">金融監督管理委員會</a> · 投資型保險商品銷售規範</li>
              <li class="m-0"><a href="https://www.lia-roc.org.tw" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">人壽保險商業同業公會</a> · 保險商品比較 / 消費者問答</li>
            </ul>
          </div>

          <div>
            <div class="text-slate-400 text-xs font-bold tracking-widest mb-2">統計資料</div>
            <ul class="space-y-1 my-0">
              <li class="m-0"><a href="https://dep.mohw.gov.tw" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">衛福部統計處</a> · 兒童傷病死因 / 住院率分齡資料</li>
              <li class="m-0"><a href="https://www.stat.gov.tw" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">主計總處</a> · 家庭收支 / 教育支出佔比 / 平均餘命</li>
              <li class="m-0"><a href="https://www.cdc.gov.tw" target="_blank" rel="noopener" class="text-blue-400 hover:text-blue-300">疾管署</a> · 兒童疫苗 / 新生兒篩檢資訊</li>
            </ul>
          </div>

          <div>
            <div class="text-slate-400 text-xs font-bold tracking-widest mb-2">各縣市生育津貼查詢</div>
            <p class="text-slate-300 m-0 text-sm leading-relaxed">
              新生兒出生登記時戶政事務所提供「一站式申請」,多數縣市 3-6 個月內申請。<br/>
              免付費福利諮詢專線:<strong class="text-yellow-300">1957</strong>(每日 8:00-22:00)
            </p>
          </div>

        </div>
      </details>

      <!-- Disclaimer -->
      <p class="text-slate-500 text-xs mt-8 leading-relaxed">
        最後更新:2026 年 6 月 5 日。本文為教育用途,所有試算(1.5% 銀行定存、淨 5% 投資型保單報酬)皆為假設情境,實際依市場表現、商品條款、家庭結構而異,並無保證投資報酬之意。「0-18 歲成長津貼」政策細節以衛福部、教育部、勞動部正式公告為準。投資型保單具投資風險,購買前請詳閱商品說明書與要保書。本文不構成任何特定金融商品之招攬。
      </p>

    </article>
  `
};
