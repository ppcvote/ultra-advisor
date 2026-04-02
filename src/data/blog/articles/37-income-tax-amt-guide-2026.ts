import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '37',
  slug: 'income-tax-amt-guide-2026',
  title: '2026 綜合所得稅＋最低稅負制，一次搞懂',
  excerpt: '報稅季到了，搞不清楚要繳多少稅？這篇用最白話的方式，讓你 5 分鐘搞懂綜所稅和最低稅負制，還有合法節稅的眉角。',
  category: 'tax',
  tags: ['綜合所得稅', '最低稅負制', 'AMT', '報稅', '節稅', '2026'],
  readTime: 8,
  publishDate: '2026-01-23',
  author: 'Ultra Advisor',
  featured: true,
  metaTitle: '2026 綜合所得稅＋最低稅負制完整攻略｜5 分鐘搞懂報稅',
  metaDescription: '2026 年報稅必讀！用最白話的方式解釋綜所稅級距、免稅額、扣除額，以及最低稅負制（AMT）是什麼、誰要繳。',
  content: `
    <article class="prose prose-invert max-w-none">
      <p class="lead text-xl text-slate-300 mb-8">
        每年 5 月報稅，很多人都是「照著系統按一按」就送出了。<br/>
        但你真的知道自己的稅是怎麼算的嗎？<br/><br/>
        <strong>這篇用最簡單的方式，讓你一次搞懂。</strong>
      </p>

      <h2 id="basic-concept">一、先搞懂基本概念</h2>

      <p>
        報稅其實就是在算一道數學題：
      </p>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <p class="text-2xl text-center text-white mb-0">
          <strong>應繳稅額 = （所得 - 免稅額 - 扣除額）× 稅率</strong>
        </p>
      </div>

      <p>
        簡單說：
      </p>
      <ul>
        <li><strong>所得</strong>：你一整年賺了多少錢</li>
        <li><strong>免稅額</strong>：政府讓你「免算」的額度</li>
        <li><strong>扣除額</strong>：你可以「扣掉」的項目（房貸利息、保險費等）</li>
        <li><strong>稅率</strong>：根據你的所得級距，稅率不同</li>
      </ul>

      <p>
        <strong>重點來了：扣越多，繳越少。</strong><br/>
        所以節稅的核心，就是合法地增加扣除額。
      </p>

      <h2 id="tax-brackets">二、2026 年綜所稅級距表</h2>

      <p>
        台灣採用「累進稅率」，收入越高，稅率越高。<br/>
        但不是全部收入都用最高稅率，而是「分段計算」。
      </p>

      <div class="overflow-x-auto my-8">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-800">
              <th class="border border-slate-700 px-4 py-3 text-white">綜合所得淨額</th>
              <th class="border border-slate-700 px-4 py-3 text-white">稅率</th>
              <th class="border border-slate-700 px-4 py-3 text-white">累進差額</th>
            </tr>
          </thead>
          <tbody class="text-slate-300">
            <tr>
              <td class="border border-slate-700 px-4 py-3">0 ～ 59 萬</td>
              <td class="border border-slate-700 px-4 py-3 text-emerald-400 font-bold">5%</td>
              <td class="border border-slate-700 px-4 py-3">0</td>
            </tr>
            <tr class="bg-slate-800/50">
              <td class="border border-slate-700 px-4 py-3">59 萬 ～ 133 萬</td>
              <td class="border border-slate-700 px-4 py-3 text-emerald-400 font-bold">12%</td>
              <td class="border border-slate-700 px-4 py-3">41,300</td>
            </tr>
            <tr>
              <td class="border border-slate-700 px-4 py-3">133 萬 ～ 266 萬</td>
              <td class="border border-slate-700 px-4 py-3 text-amber-400 font-bold">20%</td>
              <td class="border border-slate-700 px-4 py-3">147,700</td>
            </tr>
            <tr class="bg-slate-800/50">
              <td class="border border-slate-700 px-4 py-3">266 萬 ～ 498 萬</td>
              <td class="border border-slate-700 px-4 py-3 text-amber-400 font-bold">30%</td>
              <td class="border border-slate-700 px-4 py-3">413,700</td>
            </tr>
            <tr>
              <td class="border border-slate-700 px-4 py-3">498 萬以上</td>
              <td class="border border-slate-700 px-4 py-3 text-red-400 font-bold">40%</td>
              <td class="border border-slate-700 px-4 py-3">911,700</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-blue-400 font-bold mb-3">💡 怎麼用這張表？</h4>
        <p class="text-slate-300 mb-2">
          假設你的<strong>所得淨額是 100 萬</strong>：
        </p>
        <p class="text-slate-300 mb-0">
          稅額 = 100 萬 × 12% - 41,300 = <strong>78,700 元</strong><br/><br/>
          <span class="text-slate-400">（用「所得淨額 × 稅率 - 累進差額」一步算出，不用分段算）</span>
        </p>
      </div>

      <h2 id="deductions">三、免稅額與扣除額一覽</h2>

      <p>
        這些是你可以從所得中「扣掉」的項目：
      </p>

      <h3>免稅額（每人都有）</h3>
      <div class="overflow-x-auto my-6">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-800">
              <th class="border border-slate-700 px-4 py-3 text-white">對象</th>
              <th class="border border-slate-700 px-4 py-3 text-white">金額</th>
            </tr>
          </thead>
          <tbody class="text-slate-300">
            <tr>
              <td class="border border-slate-700 px-4 py-3">一般人</td>
              <td class="border border-slate-700 px-4 py-3 font-bold">97,000 元</td>
            </tr>
            <tr class="bg-slate-800/50">
              <td class="border border-slate-700 px-4 py-3">70 歲以上本人、配偶、受扶養直系尊親屬</td>
              <td class="border border-slate-700 px-4 py-3 font-bold">145,500 元</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>標準扣除額 vs 列舉扣除額（二擇一）</h3>
      <div class="overflow-x-auto my-6">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-800">
              <th class="border border-slate-700 px-4 py-3 text-white">類型</th>
              <th class="border border-slate-700 px-4 py-3 text-white">金額</th>
            </tr>
          </thead>
          <tbody class="text-slate-300">
            <tr>
              <td class="border border-slate-700 px-4 py-3">標準扣除額（單身）</td>
              <td class="border border-slate-700 px-4 py-3 font-bold">131,000 元</td>
            </tr>
            <tr class="bg-slate-800/50">
              <td class="border border-slate-700 px-4 py-3">標準扣除額（夫妻合併）</td>
              <td class="border border-slate-700 px-4 py-3 font-bold">262,000 元</td>
            </tr>
            <tr>
              <td class="border border-slate-700 px-4 py-3">列舉扣除額</td>
              <td class="border border-slate-700 px-4 py-3">依實際支出，無上限</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p>
        <strong>怎麼選？</strong>如果你的列舉項目（房貸利息、保險費、醫療費、捐款等）加起來超過標準扣除額，就選列舉；否則選標準。
      </p>

      <h3>特別扣除額</h3>
      <div class="overflow-x-auto my-6">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-800">
              <th class="border border-slate-700 px-4 py-3 text-white">項目</th>
              <th class="border border-slate-700 px-4 py-3 text-white">額度</th>
              <th class="border border-slate-700 px-4 py-3 text-white">說明</th>
            </tr>
          </thead>
          <tbody class="text-slate-300">
            <tr>
              <td class="border border-slate-700 px-4 py-3">薪資所得特別扣除額</td>
              <td class="border border-slate-700 px-4 py-3 font-bold">218,000 元</td>
              <td class="border border-slate-700 px-4 py-3">有薪資收入就能扣</td>
            </tr>
            <tr class="bg-slate-800/50">
              <td class="border border-slate-700 px-4 py-3">儲蓄投資特別扣除額</td>
              <td class="border border-slate-700 px-4 py-3 font-bold">270,000 元</td>
              <td class="border border-slate-700 px-4 py-3">存款利息可扣除</td>
            </tr>
            <tr>
              <td class="border border-slate-700 px-4 py-3">幼兒學前特別扣除額</td>
              <td class="border border-slate-700 px-4 py-3 font-bold">每人 150,000 元</td>
              <td class="border border-slate-700 px-4 py-3">6 歲以下子女</td>
            </tr>
            <tr class="bg-slate-800/50">
              <td class="border border-slate-700 px-4 py-3">教育學費特別扣除額</td>
              <td class="border border-slate-700 px-4 py-3 font-bold">每人 25,000 元</td>
              <td class="border border-slate-700 px-4 py-3">大專以上子女</td>
            </tr>
            <tr>
              <td class="border border-slate-700 px-4 py-3">身心障礙特別扣除額</td>
              <td class="border border-slate-700 px-4 py-3 font-bold">每人 218,000 元</td>
              <td class="border border-slate-700 px-4 py-3">持有身障手冊</td>
            </tr>
            <tr class="bg-slate-800/50">
              <td class="border border-slate-700 px-4 py-3">長期照顧特別扣除額</td>
              <td class="border border-slate-700 px-4 py-3 font-bold">每人 120,000 元</td>
              <td class="border border-slate-700 px-4 py-3">符合長照資格</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="bg-emerald-900/30 border border-emerald-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-emerald-400 font-bold mb-3">📊 實際案例</h4>
        <p class="text-slate-300 mb-0">
          小明是上班族，年薪 120 萬，單身：<br/><br/>
          所得淨額 = 120 萬 - 9.7 萬（免稅額）- 13.1 萬（標準扣除額）- 21.8 萬（薪資扣除額）<br/>
          = <strong>75.4 萬</strong><br/><br/>
          稅額 = 75.4 萬 × 12% - 41,300 = <strong>49,180 元</strong><br/><br/>
          <span class="text-emerald-400">實質稅率只有 4.1%，不是 12%！</span>
        </p>
      </div>

      <h2 id="amt">四、最低稅負制（AMT）是什麼？</h2>

      <p>
        有些人用了很多「免稅優惠」，導致實際繳的稅很少。<br/>
        政府覺得不公平，所以設計了<strong>最低稅負制</strong>。
      </p>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-3">🎯 一句話解釋</h4>
        <p class="text-slate-300 mb-0">
          <strong>「算兩種稅，繳比較高的那個。」</strong>
        </p>
      </div>

      <h3>綜所稅 vs 最低稅負制的關係</h3>

      <div class="bg-slate-800 border border-slate-700 rounded-2xl p-6 my-8">
        <div class="grid md:grid-cols-2 gap-6">
          <div class="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4">
            <h4 class="text-blue-400 font-bold mb-3 text-center">A｜基本稅額（低消）</h4>
            <p class="text-slate-300 text-sm mb-0">
              所得淨額<br/>
              <span class="text-orange-400">+）五大項（見下表）</span><br/>
              <span class="text-orange-400">+）分開計稅之股利</span><br/>
              −）750 萬<br/>
              ──────<br/>
              ×）20%<br/>
              = <strong>基本稅額</strong>
            </p>
          </div>
          <div class="bg-green-900/30 border border-green-500/30 rounded-xl p-4">
            <h4 class="text-green-400 font-bold mb-3 text-center">B｜一般所得稅額（實際）</h4>
            <p class="text-slate-300 text-sm mb-0">
              所得淨額<br/>
              ×）稅率<br/>
              −）累進差額<br/>
              ──────<br/>
              = 應納稅額<br/>
              <span class="text-emerald-400">−）投資抵減稅額</span><br/>
              <span class="text-orange-400">+）分開計稅股利稅額</span><br/>
              = <strong>一般所得稅額</strong>
            </p>
          </div>
        </div>
        <p class="text-center text-amber-400 font-bold mt-6 mb-0 text-lg">
          ⚖️ A 和 B 取高者繳納
        </p>
      </div>

      <h3>哪些收入要計入基本所得額？</h3>

      <div class="overflow-x-auto my-6">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-800">
              <th class="border border-slate-700 px-4 py-3 text-white">項目</th>
              <th class="border border-slate-700 px-4 py-3 text-white">規定</th>
            </tr>
          </thead>
          <tbody class="text-slate-300">
            <tr>
              <td class="border border-slate-700 px-4 py-3 font-bold">海外所得</td>
              <td class="border border-slate-700 px-4 py-3">
                未滿 <strong>100 萬免計入</strong><br/>
                100 萬以上<strong>全數計入</strong>
              </td>
            </tr>
            <tr class="bg-slate-800/50">
              <td class="border border-slate-700 px-4 py-3 font-bold">特定保險給付</td>
              <td class="border border-slate-700 px-4 py-3">
                受益人 ≠ 要保人之壽險、年金給付：<br/>
                • 死亡給付：<strong>3,740 萬以下免計入</strong>，超過部分計入<br/>
                • 非死亡給付：<strong>全數計入</strong>（無免稅額）
              </td>
            </tr>
            <tr>
              <td class="border border-slate-700 px-4 py-3 font-bold">有價證券交易所得</td>
              <td class="border border-slate-700 px-4 py-3">
                未上市櫃股票、私募基金受益憑證
              </td>
            </tr>
            <tr class="bg-slate-800/50">
              <td class="border border-slate-700 px-4 py-3 font-bold">非現金捐贈金額</td>
              <td class="border border-slate-700 px-4 py-3">
                申報列舉扣除之非現金捐贈
              </td>
            </tr>
            <tr>
              <td class="border border-slate-700 px-4 py-3 font-bold">分開計稅之股利</td>
              <td class="border border-slate-700 px-4 py-3">
                選擇 28% 分開計稅的股利
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="bg-amber-900/30 border border-amber-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-amber-400 font-bold mb-3">⚠️ 保險給付特別注意</h4>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li><strong>健康險、傷害險給付</strong> → 不計入基本所得額</li>
          <li><strong>受益人 = 要保人</strong>的壽險、年金 → 不計入基本所得額</li>
          <li><strong>受益人 ≠ 要保人</strong>的壽險、年金 → 要計入（死亡給付有 3,740 萬免稅額）</li>
        </ul>
      </div>

      <h3>計算公式</h3>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <p class="text-slate-300 mb-4 text-lg">
          <strong>基本稅額 = （基本所得額 - 750 萬）× 20%</strong>
        </p>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>若 <strong>基本稅額 ≤ 一般所得稅額</strong> → 不用補繳</li>
          <li>若 <strong>基本稅額 > 一般所得稅額</strong> → 補繳差額</li>
        </ul>
      </div>

      <div class="bg-emerald-900/30 border border-emerald-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-emerald-400 font-bold mb-3">📊 計算範例</h4>
        <p class="text-slate-300 mb-0">
          老王今年：綜所稅應繳 50 萬、海外所得 300 萬<br/><br/>
          基本所得額 = 所得淨額 400 萬 + 海外所得 300 萬 = <strong>700 萬</strong><br/><br/>
          因為 700 萬 < 750 萬（免稅門檻）<br/>
          <strong class="text-emerald-400">→ 不用繳最低稅負！</strong>
        </p>
      </div>

      <h2 id="insurance-tax">五、保險與稅務的關係</h2>

      <p>
        這是很多人搞不清楚的地方，一次講清楚：
      </p>

      <h3>保費可以抵稅嗎？</h3>
      <div class="overflow-x-auto my-6">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-800">
              <th class="border border-slate-700 px-4 py-3 text-white">保險類型</th>
              <th class="border border-slate-700 px-4 py-3 text-white">可扣除額度</th>
              <th class="border border-slate-700 px-4 py-3 text-white">說明</th>
            </tr>
          </thead>
          <tbody class="text-slate-300">
            <tr>
              <td class="border border-slate-700 px-4 py-3">人身保險費</td>
              <td class="border border-slate-700 px-4 py-3 font-bold">每人 24,000 元</td>
              <td class="border border-slate-700 px-4 py-3">壽險、醫療險、意外險等</td>
            </tr>
            <tr class="bg-slate-800/50">
              <td class="border border-slate-700 px-4 py-3">全民健保費</td>
              <td class="border border-slate-700 px-4 py-3 font-bold">全額</td>
              <td class="border border-slate-700 px-4 py-3">不受 24,000 上限限制</td>
            </tr>
            <tr>
              <td class="border border-slate-700 px-4 py-3">勞保費</td>
              <td class="border border-slate-700 px-4 py-3 font-bold">全額</td>
              <td class="border border-slate-700 px-4 py-3">不受 24,000 上限限制</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>保險理賠要繳稅嗎？</h3>
      <div class="overflow-x-auto my-6">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-800">
              <th class="border border-slate-700 px-4 py-3 text-white">情況</th>
              <th class="border border-slate-700 px-4 py-3 text-white">是否課稅</th>
            </tr>
          </thead>
          <tbody class="text-slate-300">
            <tr>
              <td class="border border-slate-700 px-4 py-3">要保人＝受益人</td>
              <td class="border border-slate-700 px-4 py-3 text-emerald-400 font-bold">免稅</td>
            </tr>
            <tr class="bg-slate-800/50">
              <td class="border border-slate-700 px-4 py-3">要保人 ≠ 受益人，給付 ≤ 3,740 萬</td>
              <td class="border border-slate-700 px-4 py-3 text-emerald-400 font-bold">免稅</td>
            </tr>
            <tr>
              <td class="border border-slate-700 px-4 py-3">要保人 ≠ 受益人，給付 > 3,740 萬</td>
              <td class="border border-slate-700 px-4 py-3 text-amber-400 font-bold">超過部分計入最低稅負</td>
            </tr>
            <tr class="bg-slate-800/50">
              <td class="border border-slate-700 px-4 py-3">死亡給付（指定受益人）</td>
              <td class="border border-slate-700 px-4 py-3 text-emerald-400 font-bold">不計入遺產稅</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="bg-purple-900/30 border border-purple-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-purple-400 font-bold mb-3">💡 保險節稅小提醒</h4>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>要保人和受益人<strong>設為同一人</strong>，理賠金免計入最低稅負</li>
          <li>死亡給付<strong>指定受益人</strong>，可免計入遺產稅</li>
          <li>每年保費記得申報列舉扣除，每人最高 24,000 元</li>
        </ul>
      </div>

      <h2 id="common-questions">六、常見問題 Q&A</h2>

      <div class="space-y-6 my-8">
        <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h4 class="text-white font-bold mb-2">Q：我有海外基金，要怎麼報稅？</h4>
          <p class="text-slate-300 mb-0">
            A：海外所得<strong>超過 100 萬</strong>才需要申報。申報後，會加入基本所得額計算。如果基本所得額低於 750 萬，實際上不用多繳稅。
          </p>
        </div>

        <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h4 class="text-white font-bold mb-2">Q：夫妻要合併申報還是分開？</h4>
          <p class="text-slate-300 mb-0">
            A：系統會自動計算三種方式（全部合併、薪資分開、全部分開），選最有利的。一般來說，<strong>雙薪家庭選擇薪資分開計稅較有利</strong>。
          </p>
        </div>

        <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h4 class="text-white font-bold mb-2">Q：扶養父母可以節稅嗎？</h4>
          <p class="text-slate-300 mb-0">
            A：可以！每扶養一位，免稅額增加 97,000 元（70 歲以上為 145,500 元）。但父母的所得也會併入你的申報，要算算看是否划算。
          </p>
        </div>

        <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
          <h4 class="text-white font-bold mb-2">Q：股票股利要怎麼報稅？</h4>
          <p class="text-slate-300 mb-0">
            A：兩種方式二擇一：<br/>
            ① <strong>合併計稅</strong>：股利併入所得，可抵減 8.5%（上限 8 萬）<br/>
            ② <strong>分開計稅</strong>：股利單獨課 28%<br/><br/>
            一般來說，<strong>適用稅率 30% 以下的人，選合併較有利</strong>。
          </p>
        </div>
      </div>

      <h2 id="tax-tips">七、合法節稅小撇步</h2>

      <div class="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border border-emerald-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-emerald-400 font-bold mb-4">✅ 馬上可以做的事</h4>
        <ol class="text-slate-300 mb-0 space-y-3">
          <li>
            <strong>確認扶養人口</strong><br/>
            父母、子女、兄弟姊妹都可能可以申報扶養
          </li>
          <li>
            <strong>保費單據別丟</strong><br/>
            人身保險每人可扣 24,000 元，健保費全額可扣
          </li>
          <li>
            <strong>自用住宅房貸利息</strong><br/>
            每戶最高可扣 30 萬（要扣掉儲蓄投資扣除額）
          </li>
          <li>
            <strong>捐款收據保存好</strong><br/>
            對政府、教育機構捐款可全額扣除
          </li>
          <li>
            <strong>醫療收據別忘記</strong><br/>
            掛號費、自費醫療都可以列舉扣除
          </li>
        </ol>
      </div>

      <h2 id="summary">八、一張圖搞懂</h2>

      <div class="bg-slate-800 border border-slate-700 rounded-2xl p-6 my-8">
        <div class="text-center text-slate-300 space-y-4">
          <p class="text-lg">
            <strong class="text-white">年收入</strong><br/>
            ↓ 減掉<br/>
            <strong class="text-emerald-400">免稅額</strong>（每人 9.7 萬）<br/>
            ↓ 減掉<br/>
            <strong class="text-emerald-400">標準扣除額</strong>（單身 13.1 萬 / 夫妻 26.2 萬）<br/>
            或 <strong class="text-blue-400">列舉扣除額</strong>（保費、房貸、醫療等）<br/>
            ↓ 減掉<br/>
            <strong class="text-emerald-400">特別扣除額</strong>（薪資 21.8 萬、儲蓄 27 萬等）<br/>
            ↓ 等於<br/>
            <strong class="text-amber-400">所得淨額</strong><br/>
            ↓ 乘以<br/>
            <strong class="text-red-400">稅率</strong>（5% ～ 40%）<br/>
            ↓ 等於<br/>
            <strong class="text-white text-xl">應繳稅額</strong>
          </p>
        </div>
      </div>

      <div class="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-2xl p-6 my-8">
        <h4 class="text-purple-400 font-bold mb-3">📌 本文重點</h4>
        <ol class="text-slate-300 mb-0 space-y-2">
          <li><strong>基本公式</strong>：稅額 =（所得 - 免稅額 - 扣除額）× 稅率</li>
          <li><strong>稅率級距</strong>：5% → 12% → 20% → 30% → 40%</li>
          <li><strong>最低稅負</strong>：基本所得額超過 750 萬才需要繳</li>
          <li><strong>海外所得</strong>：超過 100 萬才需申報</li>
          <li><strong>保險理賠</strong>：要保人＝受益人，理賠免稅</li>
          <li><strong>節稅關鍵</strong>：扶養人口、保費、房貸利息、醫療費</li>
        </ol>
      </div>

      <p>
        報稅其實不難，搞懂規則後，就是按部就班填資料。<br/>
        <strong>早點了解，早點規劃，就能合法少繳稅。</strong>
      </p>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>→ <a href="/blog/income-tax-brackets-2026" class="text-blue-400 hover:underline">2026 年所得稅級距表速查</a></li>
          <li>→ <a href="/blog/estate-tax-vs-gift-tax-comparison" class="text-blue-400 hover:underline">遺產稅 vs 贈與稅：哪個更划算？</a></li>
          <li>→ <a href="/blog/estate-gift-tax-quick-reference-2026" class="text-blue-400 hover:underline">遺產稅＆贈與稅速查表</a></li>
        </ul>
      </div>
    </article>
  `
};
