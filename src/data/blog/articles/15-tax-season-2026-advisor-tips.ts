import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '15',
  slug: 'tax-season-2026-advisor-tips',
  title: '2026報稅季必知：財務顧問幫客戶節稅的 5 個技巧',
  excerpt: '報稅季是財務顧問展現專業的最佳時機。掌握這 5 個節稅技巧，幫客戶省錢、贏得信任。',
  category: 'tax',
  tags: ['報稅', '節稅', '所得稅', '財務顧問', '2026報稅', '扣除額'],
  readTime: 7,
  publishDate: '2026-01-16',
  author: 'Ultra Advisor',
  featured: false,
  metaTitle: '2026報稅季節稅攻略｜財務顧問必備 5 個技巧',
  metaDescription: '2026 年報稅季即將來臨！財務顧問如何幫客戶節稅？5 個實用技巧 + 扣除額完整整理，展現你的專業價值。',
  content: `
      <article class="prose prose-invert max-w-none">
        <p class="lead text-xl text-slate-300 mb-8">
          每年 5 月報稅季，是財務顧問與客戶建立信任的黃金時機。
          當你能幫客戶省下一筆稅金，你的專業價值就會被看見。
          本文整理 5 個實用的節稅技巧，讓你在報稅季大顯身手。
        </p>

        <div class="bg-amber-900/30 border border-amber-500/30 rounded-2xl p-6 my-8">
          <h4 class="text-amber-400 font-bold mb-2">📅 2026 年報稅時程</h4>
          <ul class="text-slate-300 text-sm mb-0 space-y-1">
            <li>• 報稅期間：2026 年 5 月 1 日 ～ 5 月 31 日</li>
            <li>• 稅額試算通知書：4 月底陸續寄發</li>
            <li>• 網路報稅：5 月 1 日起開放</li>
          </ul>
        </div>

        <h2 id="tip-1">技巧 1：確認列舉扣除 vs 標準扣除</h2>

        <h3>2026 年標準扣除額</h3>
        <ul>
          <li>單身：<strong>124,000 元</strong></li>
          <li>已婚合併申報：<strong>248,000 元</strong></li>
        </ul>

        <h3>常見列舉扣除項目</h3>
        <ul>
          <li><strong>保險費</strong>：人身保險每人最高 24,000 元，健保費全額</li>
          <li><strong>醫藥費</strong>：無上限（需保留收據）</li>
          <li><strong>購屋借款利息</strong>：每戶最高 300,000 元</li>
          <li><strong>房屋租金</strong>：每戶最高 120,000 元</li>
          <li><strong>捐贈</strong>：對政府、教育文化無上限；一般團體最高綜合所得 20%</li>
        </ul>

        <div class="bg-slate-800/50 rounded-xl p-4 my-4">
          <p class="text-green-400 font-bold mb-2">💡 顧問建議</p>
          <p class="text-slate-300 text-sm mb-0">
            幫客戶加總所有列舉扣除項目，如果超過標準扣除額，就用列舉；
            如果不到，就用標準扣除。
            很多客戶不知道可以選擇，這就是你展現專業的機會。
          </p>
        </div>

        <h2 id="tip-2">技巧 2：善用特別扣除額</h2>

        <h3>2026 年特別扣除額一覽</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr>
                <th>項目</th>
                <th>金額</th>
                <th>條件</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>薪資所得特別扣除額</td>
                <td class="text-green-400">207,000 元</td>
                <td>有薪資所得者</td>
              </tr>
              <tr>
                <td>儲蓄投資特別扣除額</td>
                <td class="text-green-400">270,000 元</td>
                <td>利息所得</td>
              </tr>
              <tr>
                <td>身心障礙特別扣除額</td>
                <td class="text-green-400">207,000 元</td>
                <td>領有身心障礙手冊</td>
              </tr>
              <tr>
                <td>幼兒學前特別扣除額</td>
                <td class="text-green-400">120,000 元</td>
                <td>5 歲以下子女</td>
              </tr>
              <tr>
                <td>教育學費特別扣除額</td>
                <td class="text-green-400">25,000 元</td>
                <td>就讀大專以上子女</td>
              </tr>
              <tr>
                <td>長期照顧特別扣除額</td>
                <td class="text-green-400">120,000 元</td>
                <td>符合長照資格</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="bg-slate-800/50 rounded-xl p-4 my-4">
          <p class="text-green-400 font-bold mb-2">💡 顧問建議</p>
          <p class="text-slate-300 text-sm mb-0">
            主動詢問客戶家中是否有幼兒、身心障礙者、長照需求者。
            這些扣除額很容易被遺漏，你提醒一下就能幫客戶省稅。
          </p>
        </div>

        <h2 id="tip-3">技巧 3：調整報稅單位（分開 vs 合併）</h2>

        <h3>夫妻報稅三種方式</h3>
        <ol>
          <li><strong>全部所得合併計稅</strong>：雙方所得加總一起算</li>
          <li><strong>薪資所得分開計稅</strong>：薪資分開算，其他合併</li>
          <li><strong>各類所得分開計稅</strong>：全部所得都分開算</li>
        </ol>

        <p>
          哪種方式最省稅？取決於夫妻雙方的<strong>所得結構</strong>和<strong>所得差距</strong>。
        </p>

        <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-8">
          <h4 class="text-blue-400 font-bold mb-3">快速判斷原則</h4>
          <ul class="text-slate-300 space-y-2">
            <li>• 雙方所得差距大 → 薪資分開計稅可能較省</li>
            <li>• 雙方所得接近 → 合併計稅可能較省</li>
            <li>• 一方有大量非薪資所得 → 各類所得分開可能較省</li>
          </ul>
          <p class="text-slate-400 text-sm mt-4 mb-0">
            建議三種方式都試算一次，選最低的那個！
          </p>
        </div>

        <h2 id="tip-4">技巧 4：股利所得二擇一</h2>

        <h3>股利所得課稅方式</h3>
        <ol>
          <li><strong>合併計稅</strong>：股利併入綜合所得，可抵減 8.5%（上限 8 萬）</li>
          <li><strong>分開計稅</strong>：股利單獨課 28%</li>
        </ol>

        <h3>怎麼選？</h3>
        <ul>
          <li>適用稅率 <strong>30% 以下</strong>：合併計稅較划算</li>
          <li>適用稅率 <strong>40%</strong>：分開計稅較划算</li>
        </ul>

        <div class="bg-slate-800/50 rounded-xl p-4 my-4">
          <p class="text-green-400 font-bold mb-2">💡 實例</p>
          <p class="text-slate-300 text-sm mb-0">
            客戶股利 100 萬，適用稅率 20%<br/>
            合併計稅：100 萬 × 20% - 8 萬（抵減）= 12 萬<br/>
            分開計稅：100 萬 × 28% = 28 萬<br/>
            → 合併計稅省 16 萬！
          </p>
        </div>

        <h2 id="tip-5">技巧 5：提早規劃下一年度</h2>

        <p>
          報稅季不只是「結算去年」，更是「規劃今年」的好時機。
        </p>

        <h3>可提前規劃的項目</h3>
        <ul>
          <li><strong>保險規劃</strong>：每人 24,000 元的扣除額有用到嗎？</li>
          <li><strong>捐贈規劃</strong>：有固定捐款的習慣嗎？可節稅又做公益</li>
          <li><strong>退休金自提</strong>：勞退自提 6% 可從薪資所得扣除</li>
          <li><strong>購屋規劃</strong>：房貸利息扣除額 30 萬很可觀</li>
        </ul>

        <div class="bg-purple-900/30 border border-purple-500/30 rounded-2xl p-6 my-8">
          <h4 class="text-purple-400 font-bold mb-3">🎯 顧問行動清單</h4>
          <ol class="text-slate-300 space-y-2">
            <li>1. 報稅季前主動聯繫客戶，詢問需要協助</li>
            <li>2. 幫客戶試算不同報稅方式，找出最省的選項</li>
            <li>3. 檢視客戶的扣除額是否都有用到</li>
            <li>4. 順便討論下一年度的節稅規劃</li>
            <li>5. 這就是你展現專業、建立信任的機會！</li>
          </ol>
        </div>

        <h2 id="tools">報稅工具推薦</h2>

        <div class="bg-blue-900/30 border border-blue-500/30 rounded-2xl p-6 my-8">
          <h4 class="text-blue-400 font-bold mb-3">🛠️ Ultra Advisor 稅務規劃工具</h4>
          <p class="text-slate-300 mb-4">
            輸入客戶資料，一鍵產出稅務分析報告。
            比較不同申報方式，找出最省稅的方案。
          </p>
          <a href="/register" class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">
            免費試用 7 天 →
          </a>
        </div>

        <h2 id="conclusion">結語</h2>
        <p>
          報稅季是財務顧問最能展現價值的時刻。
          當你能幫客戶省下真金白銀，客戶對你的信任就會大幅提升。
        </p>
        <p>
          這 5 個技巧都是實務上常用的節稅方法，
          建議現在就開始聯繫客戶，主動提供報稅協助！
        </p>
        <p>
          <strong>歡迎收藏這篇文章，報稅季隨時參考！</strong>
        </p>
      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
        <ul class="text-slate-300 mb-0 space-y-2">
          <li>→ <a href="/blog/income-tax-brackets-2026" class="text-blue-400 hover:underline">2026 所得稅級距與扣除額速查表｜免稅額、報稅門檻一次看</a></li>
          <li>→ <a href="/blog/nhi-supplementary-premium-2026" class="text-blue-400 hover:underline">2026 健保補充保費完整攻略｜費率、門檻、節省方法一次看</a></li>
          <li>→ <a href="/blog/property-tax-self-use-residence-2026" class="text-blue-400 hover:underline">2026 房屋稅自用住宅優惠｜稅率、條件、申請一次看</a></li>
        </ul>
      </div>

<p class="text-slate-500 text-sm mt-12">
          最後更新：2026 年 1 月 16 日<br/>
          本文為稅務規劃參考，實際申報請依國稅局規定辦理。
        </p>
      </article>
    `
};
