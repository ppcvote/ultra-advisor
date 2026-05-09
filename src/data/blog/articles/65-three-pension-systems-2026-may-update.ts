import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '65',
  slug: 'three-pension-systems-2026-may-update',
  title: '勞保 +6.46%、國保保底 5,000、勞退專戶——65 歲那天三筆退休金到底月領多少？',
  excerpt: '5 月勞保年金調升 6.46%、國民年金保底 5,000、勞退新制請領年齡升至 65 歲。三套制度同步動，但合在一起算，每個人領的數字差很多。本文把三筆放到同一張試算表，一個情境一個情境算給你看。',
  category: 'retirement',
  tags: ['勞保', '勞退', '國民年金', '退休金', '2026 新制', '退休試算', '所得替代率'],
  readTime: 14,
  publishDate: '2026-05-09',
  author: 'Ultra Advisor',
  featured: false,
  metaTitle: '勞保 +6.46% / 國保保底 5,000 / 勞退專戶：三筆退休金月領多少【2026】',
  metaDescription: '2026 年 5 月勞保調漲、國保修法、勞退請領年齡新制三軌齊發。把勞保＋勞退＋國保放到同一張試算表，3 種薪資級距 × 3 種年資情境逐一計算，含工具與雷區提醒。',
  content: `
    <article class="prose prose-invert max-w-none">
      <p class="lead text-xl text-slate-300 mb-8">
        2026 年 5 月有三件事同時動了：<br/>
        勞保年金調漲 <strong class="text-emerald-400">6.46%</strong>，78 萬人受惠，月領約 <strong class="text-emerald-400">22,868 元</strong>。<br/>
        國民年金「保底 5,000」修法上路，未繳保費或年資短的人也保證 5,000 元起跳。<br/>
        勞退新制請領年齡 51 年次後出生者，<strong class="text-rose-400">升至 65 歲</strong>。<br/><br/>
        三軌同步動，但合在一起算的人很少。本文把三筆放到同一張試算表，一個情境一個情境算給你看。
      </p>

      <h2 id="three-systems">三筆退休金的本質：「保險基底 + 強制儲蓄 + 兜底線」</h2>

      <p>
        台灣退休金不是一筆，是三筆，運作邏輯完全不同。先把三者區分清楚，才不會誤算：
      </p>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-600">
              <th class="text-left py-3 text-white">層級</th>
              <th class="text-left py-3 text-white">勞保年金</th>
              <th class="text-left py-3 text-white">勞退新制</th>
              <th class="text-left py-3 text-white">國民年金</th>
            </tr>
          </thead>
          <tbody class="text-slate-300">
            <tr class="border-b border-slate-700">
              <td class="py-2 font-bold">本質</td>
              <td class="py-2">社會保險（風險共攤）</td>
              <td class="py-2">個人專戶（強制儲蓄）</td>
              <td class="py-2">社會保險（兜底）</td>
            </tr>
            <tr class="border-b border-slate-700">
              <td class="py-2 font-bold">投保對象</td>
              <td class="py-2">受雇勞工 + 自雇</td>
              <td class="py-2">受雇勞工</td>
              <td class="py-2">25-65 歲未投保勞保者</td>
            </tr>
            <tr class="border-b border-slate-700">
              <td class="py-2 font-bold">提撥方</td>
              <td class="py-2">勞 20% + 雇 70% + 政 10%</td>
              <td class="py-2">雇主 6% + 自願 0-6%</td>
              <td class="py-2">本人 60% + 政府 40%</td>
            </tr>
            <tr class="border-b border-slate-700">
              <td class="py-2 font-bold">領取邏輯</td>
              <td class="py-2">公式 A 或 B 擇優</td>
              <td class="py-2">本金累積 ÷ 年金化</td>
              <td class="py-2">公式 A 或 B 擇優</td>
            </tr>
            <tr>
              <td class="py-2 font-bold">2026 變動</td>
              <td class="py-2 text-emerald-300">+6.46% 調漲</td>
              <td class="py-2 text-amber-300">請領升至 65 歲</td>
              <td class="py-2 text-blue-300">保底 5,000</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="labor-insurance">第一筆：勞保年金 5 月起調漲 6.46%（CPI 自動連動）</h2>

      <h3>調漲機制：CPI 兩年累計超過 5% 觸發</h3>

      <p>
        2026 年勞保調漲不是政策恩給，是法定機制：勞保條例第 65-2 條規定，
        年金給付指數採 CPI 兩年累計，超過 5% 時自動調整一次。
        2024-2025 累計 CPI 漲幅約 6.46%，於是 2026 年 5 月起按比例調升年金。
      </p>

      <div class="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-6 my-6">
        <h4 class="text-blue-400 font-bold mb-3">📐 勞保年金原本兩個公式（擇優）</h4>
        <p class="text-white font-mono text-sm mb-2">
          公式 A：月領 = 平均月投保薪資 × 年資 × 0.775% + 3,000
        </p>
        <p class="text-white font-mono text-sm">
          公式 B：月領 = 平均月投保薪資 × 年資 × 1.55%
        </p>
        <p class="text-slate-400 text-xs mt-3">
          公式 A 適用「短年資 + 高薪資」族群（保底 3,000 拉抬效果大）。<br/>
          公式 B 適用「長年資 + 高薪資」族群（年資乘數效果大）。
        </p>
      </div>

      <h3>三組典型範例（套用 5 月 +6.46% 後）</h3>

      <div class="bg-slate-800 rounded-xl p-6 my-6">
        <h4 class="text-white font-bold mb-3">案例 1：A 君（保險業務 25 年）</h4>
        <ul class="text-slate-300 space-y-1 text-sm">
          <li>平均月投保薪資：<strong class="text-emerald-400">36,300</strong>（中等級距）</li>
          <li>勞保年資：<strong class="text-emerald-400">25 年</strong></li>
        </ul>
        <div class="mt-4 pt-4 border-t border-slate-700 text-sm">
          <p class="text-slate-400">公式 A：36,300 × 25 × 0.775% + 3,000 = <strong class="text-blue-300">10,032</strong></p>
          <p class="text-slate-400">公式 B：36,300 × 25 × 1.55% = <strong class="text-emerald-300">14,066</strong>（擇優）</p>
          <p class="text-white">5 月起 +6.46%：<strong class="text-emerald-400 text-lg">14,975</strong> 元/月</p>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 my-6">
        <h4 class="text-white font-bold mb-3">案例 2：B 君（科技業 35 年最高級距）</h4>
        <ul class="text-slate-300 space-y-1 text-sm">
          <li>平均月投保薪資：<strong class="text-emerald-400">45,800</strong>（最高級距）</li>
          <li>勞保年資：<strong class="text-emerald-400">35 年</strong></li>
        </ul>
        <div class="mt-4 pt-4 border-t border-slate-700 text-sm">
          <p class="text-slate-400">公式 B（直接領先）：45,800 × 35 × 1.55% = <strong class="text-emerald-300">24,847</strong></p>
          <p class="text-white">5 月起 +6.46%：<strong class="text-emerald-400 text-lg">26,452</strong> 元/月</p>
          <p class="text-slate-400 text-xs mt-2">這是勞保年金的「天花板區」。再多年資、再高薪資都很難突破 27K 太多。</p>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 my-6">
        <h4 class="text-white font-bold mb-3">案例 3：C 君（中小企業 15 年中斷再進）</h4>
        <ul class="text-slate-300 space-y-1 text-sm">
          <li>平均月投保薪資：<strong class="text-amber-400">28,800</strong>（中段級距）</li>
          <li>勞保年資：<strong class="text-amber-400">15 年</strong>（中間有 5 年自雇沒投）</li>
        </ul>
        <div class="mt-4 pt-4 border-t border-slate-700 text-sm">
          <p class="text-slate-400">公式 A：28,800 × 15 × 0.775% + 3,000 = <strong class="text-blue-300">6,348</strong>（擇優）</p>
          <p class="text-slate-400">公式 B：28,800 × 15 × 1.55% = <strong class="text-amber-300">6,696</strong></p>
          <p class="text-white">5 月起 +6.46%：<strong class="text-emerald-400 text-lg">7,128</strong> 元/月</p>
          <p class="text-rose-300 text-xs mt-2">⚠️ 這個級距才是台灣勞保族群的中位數。低於 1 萬，遠不夠生活。</p>
        </div>
      </div>

      <h2 id="labor-pension">第二筆：勞退新制（個人專戶 = 雇主 6% + 自願自提）</h2>

      <h3>關鍵新制：51 年次後出生者請領年齡升至 65 歲</h3>

      <p>
        勞退新制過去可以 60 歲領，2026 年起出生年次 51 年（民國，西元 1962 年）以後的人，
        <strong class="text-amber-400">需滿 65 歲才能請領</strong>。
        這意味著：<strong>1962 年（民國 51 年）後出生的人，整套退休規劃都要往後 5 年計算</strong>。
      </p>

      <h3>勞退月領金額怎麼算</h3>

      <div class="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-6 my-6">
        <p class="text-white font-mono text-sm mb-2">
          勞退個人專戶累積金額 = 月薪 × 6%（雇主）× 12 × 年資 × (1 + 投資報酬率)^年
        </p>
        <p class="text-slate-400 text-xs mt-3">
          自願自提部分（0-6%）也累積在同一專戶，享同樣保證收益（不低於 2 年定存利率，2024 年實際年化約 3.5%）。
        </p>
      </div>

      <div class="bg-slate-800 rounded-xl p-6 my-6">
        <h4 class="text-white font-bold mb-3">案例 2 延續：B 君的勞退專戶</h4>
        <ul class="text-slate-300 space-y-1 text-sm">
          <li>月薪 45,800（最高級距），雇主提撥 6% × 12 = <strong class="text-emerald-400">32,976/年</strong></li>
          <li>累積年資 25 年（勞退新制 2005 年才有，B 君 35 年裡只有後 25 年屬新制）</li>
          <li>個人專戶過去 25 年實際年化收益 <strong class="text-emerald-400">3.5%</strong>（中央信託局保證收益）</li>
        </ul>
        <div class="mt-4 pt-4 border-t border-slate-700 text-sm">
          <p class="text-slate-400">累積專戶金額（年金現值）：32,976 × ((1.035^25 - 1) / 0.035) = <strong class="text-emerald-300">~127 萬</strong></p>
          <p class="text-slate-400">月領（年金化，假設 65 歲到 85 歲、3.5% 報酬）：</p>
          <p class="text-white">127 萬 ÷ 年金化因子 = <strong class="text-emerald-400 text-lg">~7,400</strong> 元/月</p>
        </div>
      </div>

      <h3>自提 6% 划算嗎？</h3>

      <p>
        自提 6% 的兩個甜點：
      </p>

      <ol class="text-slate-300 space-y-2 my-4 text-sm">
        <li>1. <strong class="text-emerald-400">薪資所得免稅</strong>：自提部分當年不計入綜合所得稅，等於延稅。
        若年所得稅率 20%，等於變相政府幫你付 20% 入帳。</li>
        <li>2. <strong class="text-emerald-400">保證收益不低於 2 年定存</strong>：本金不會虧，下檔有政府兜底。</li>
      </ol>

      <p>
        但只有兩種人不適合：年所得稅率 5% 以下的低薪族（延稅效果差），
        以及確定 60 歲前要出國/移民、不打算累積到台灣退休的人。
      </p>

      <h2 id="national-pension">第三筆：國民年金（保底 5,000 新制）</h2>

      <h3>國保是「沒勞保的人」的 backup</h3>

      <p>
        國民年金 2008 年開辦，給 25-65 歲未投保勞保 / 公保 / 軍保的人，
        例如家庭主婦、自由工作者中斷期間、待業期。
        2026 年新制最大變動：<strong class="text-blue-400">月領保底 5,000 元</strong>（過去公式算下來如果不到 5,000，會被自動補到 5,000）。
      </p>

      <div class="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-6 my-6">
        <h4 class="text-blue-400 font-bold mb-3">📐 國保兩個公式（擇優）</h4>
        <p class="text-white font-mono text-sm mb-2">
          公式 A：月領 = 月投保金額（19,761）× 年資 × 0.65% + 3,772
        </p>
        <p class="text-white font-mono text-sm">
          公式 B：月領 = 月投保金額 × 年資 × 1.3%
        </p>
        <p class="text-blue-300 text-xs mt-3">
          2026 新制：上述兩式擇優後，若仍低於 5,000，自動補到 <strong>5,000 元月領保底</strong>。
        </p>
      </div>

      <h3>誰會受益最多</h3>

      <ul class="text-slate-300 space-y-2 my-4 text-sm">
        <li>• <strong class="text-blue-300">家管中年回職場</strong>：勞保年資不長 + 國保補 backup，三筆合計可能撐到 1.5 萬</li>
        <li>• <strong class="text-blue-300">中斷期長的自由工作者</strong>：勞保斷檔的那幾年，國保補上不會空白</li>
        <li>• <strong class="text-blue-300">沒繳清國保保費的人</strong>：過去未繳 = 0 元，新制至少有 5,000 兜底</li>
      </ul>

      <h2 id="combined-table">三筆合併試算（55 → 65 → 85 歲現金流）</h2>

      <p>
        把三筆放到同一張表，才看得到全貌。以 B 君情境為例（最高級距 + 35 年勞保 + 25 年勞退新制）：
      </p>

      <div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-600">
              <th class="text-left py-2 text-white">階段</th>
              <th class="text-right py-2 text-white">勞保</th>
              <th class="text-right py-2 text-white">勞退</th>
              <th class="text-right py-2 text-white">國保</th>
              <th class="text-right py-2 text-white">合計月領</th>
            </tr>
          </thead>
          <tbody class="text-slate-300">
            <tr class="border-b border-slate-700">
              <td class="py-2">55-65 歲（10 年）</td>
              <td class="py-2 text-right text-slate-500">0</td>
              <td class="py-2 text-right text-slate-500">0</td>
              <td class="py-2 text-right text-slate-500">0</td>
              <td class="py-2 text-right text-rose-400 font-bold">0（純自備款撐）</td>
            </tr>
            <tr class="border-b border-slate-700 bg-emerald-900/10">
              <td class="py-2">65 歲開始</td>
              <td class="py-2 text-right text-emerald-300">26,452</td>
              <td class="py-2 text-right text-emerald-300">7,400</td>
              <td class="py-2 text-right text-slate-500">N/A</td>
              <td class="py-2 text-right text-emerald-400 font-bold text-lg">33,852</td>
            </tr>
          </tbody>
        </table>
        <p class="text-slate-400 text-xs mt-4">
          B 君是「最佳情境」（最高級距 + 滿年資）。多數人合計會落在 18,000-28,000 之間。
        </p>
      </div>

      <p>
        關鍵觀察：<strong class="text-amber-300">55 歲想退休 ≠ 政府年金能立刻支援</strong>。
        從 55 到 65 這 10 年，三筆都領不到。這 10 年完全靠你自己準備的本金 + 投資。
      </p>

      <h2 id="action-plan">行動清單：你今天該做的 3 件事</h2>

      <div class="bg-slate-800 rounded-xl p-6 my-6 space-y-4">
        <div>
          <strong class="text-emerald-400">1. 上勞保局申請「個人退休金試算」</strong>
          <p class="text-sm text-slate-400 mt-1">
            勞保局網站可申請正式試算（需自然人憑證或健保卡 + 讀卡機）。
            這是你三筆中最大的那一筆，先把預估數字拿到手。
            連結：<a href="https://www.bli.gov.tw/" class="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">www.bli.gov.tw</a>
          </p>
        </div>
        <div>
          <strong class="text-emerald-400">2. 查自己的勞退專戶累積金額</strong>
          <p class="text-sm text-slate-400 mt-1">
            勞動部「勞工保險局」app 或網站，登入即可查專戶現有金額。
            如果發現自提率是 0%，現在就開始 1-6% 自提，延稅效果立刻有感。
          </p>
        </div>
        <div>
          <strong class="text-emerald-400">3. 用 UltraAdvisor 三筆合併試算</strong>
          <p class="text-sm text-slate-400 mt-1">
            勞保局只算勞保、勞退專戶只查勞退、國保資訊在另一個系統。
            UltraAdvisor 把三筆放到同一張畫面，加上通膨、缺口、半 FIRE 對比。
            <a href="https://ultra-advisor.tw/calculator/retirement" class="text-purple-300 hover:text-purple-200" target="_blank" rel="noopener noreferrer">→ ultra-advisor.tw/calculator/retirement</a>
          </p>
        </div>
      </div>

      <h2 id="pitfalls">三個常見計算雷區</h2>

      <ol class="text-slate-300 space-y-3 my-6">
        <li>
          <strong class="text-rose-400">雷區 1：以為「平均薪資」是退休前的薪資</strong>
          <span class="block text-slate-400 text-sm mt-1">勞保算的是「最高 60 個月的平均」，不是離職前那年的薪資。
          年輕時薪資較低會把平均拉下來。中年加薪幅度大的人特別要算清楚。</span>
        </li>
        <li>
          <strong class="text-rose-400">雷區 2：勞退「年資」不等於「投保年資」</strong>
          <span class="block text-slate-400 text-sm mt-1">勞退新制 2005 年才開辦。在那之前的工作年資，計入舊制（一次給付）而不是新制專戶。
          很多人 35 年職涯只有後 25 年是新制累積。</span>
        </li>
        <li>
          <strong class="text-rose-400">雷區 3：勞保展延請領的扣減算錯</strong>
          <span class="block text-slate-400 text-sm mt-1">提早一年請領扣 4%，最多扣 5 年 = 20% 永久減損。
          延後請領加 4%，最多加 5 年 = 20% 永久加成。
          多數人忽略這個 swing range 是 40%，影響後半生月領數字非常大。</span>
        </li>
      </ol>

      <h2 id="bottom-line">結論：5 月新制是 reset 的好時機</h2>

      <p>
        勞保 +6.46%、國保保底 5,000、勞退新制請領 65 歲——這三件事 5 月一起發生，
        意味著你過去算過的退休缺口數字幾乎都要重算。
      </p>

      <p>
        重算的目的不是焦慮，是<strong class="text-emerald-300">確定自己離目標還差多少，並把『多差的部分』在還能 work 的歲數內補齊</strong>。
        看到台股創高、看到帳上數字突然胖起來，第一個念頭應該是：把多賺的，丟去補退休缺口最大的那一塊。
      </p>

      <p>
        勞保 + 勞退 + 國保 三筆合計，台灣中產家庭的退休保底大約是 <strong class="text-emerald-400">每月 1.8-3.4 萬</strong>。
        這個數字之上，全部都靠你自己。
      </p>

      <p class="text-slate-400 text-sm border-t border-slate-700 pt-6 mt-8">
        資料來源：勞動部勞工保險局（2026 年 5 月勞保調漲公告）、《天下雜誌》5/6 報導、
        《關鍵評論網》5/8 解析、財政部主計處 CPI 統計、勞退基金管理委員會年報 2024。<br/><br/>
        本文不構成個人投資或退休建議。所有試算為粗估，個人實際情境請以勞保局正式試算 + 專業財務顧問為準。
        勞保條例、勞退條例及國民年金法持續修法中，數字以最新法令為準。
      </p>
    </article>
  `,
};
