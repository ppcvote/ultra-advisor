import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '50',
  slug: 'mortgage-prepayment-worth-it-2026',
  title: '房貸提前還款划算嗎？完整試算告訴你',
  excerpt: '手上有閒錢，該拿去還房貸還是投資？這篇用數據算給你看。',
  category: 'mortgage',
  tags: ['提前還款', '房貸規劃', '房貸利息', '投資理財', '房貸試算'],
  readTime: 6,
  publishDate: '2026-01-25',
  author: 'Ultra Advisor',
  featured: false,
  metaTitle: '房貸提前還款划算嗎？2026 完整試算與決策指南',
  metaDescription: '房貸提前還款完整分析：省多少利息、縮短多少年、違約金計算。還是投資報酬更高？看完就知道怎麼選。',
  content: `
<p class="text-xl text-slate-300 mb-8">
手上有 100 萬閒錢，該拿去還房貸嗎？<br>
還是投資比較划算？<br>
<strong class="text-white">這個問題沒有標準答案，但可以算出來。</strong>
</p>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">提前還款能省多少利息？</h2>

<div class="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4 my-6">
<p class="text-blue-200 font-bold mb-2">試算條件</p>
<p class="text-slate-300 mb-0">
原始貸款：800 萬、利率 2.1%、30 年期<br>
已還款：5 年<br>
目前本金餘額：約 680 萬<br>
提前還款：100 萬
</p>
</div>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<table class="w-full text-slate-300">
<thead>
<tr class="border-b border-slate-600">
  <th class="text-left py-3 text-white">項目</th>
  <th class="text-right py-3 text-white">不提前還款</th>
  <th class="text-right py-3 text-white">提前還 100 萬</th>
</tr>
</thead>
<tbody>
<tr class="border-b border-slate-700">
  <td class="py-3">剩餘本金</td>
  <td class="py-3 text-right">680 萬</td>
  <td class="py-3 text-right">580 萬</td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-3">剩餘利息</td>
  <td class="py-3 text-right">197 萬</td>
  <td class="py-3 text-right">148 萬</td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-3">節省利息</td>
  <td class="py-3 text-right">-</td>
  <td class="py-3 text-right text-green-400">49 萬</td>
</tr>
<tr>
  <td class="py-3">縮短年數</td>
  <td class="py-3 text-right">-</td>
  <td class="py-3 text-right text-green-400">約 4 年</td>
</tr>
</tbody>
</table>
</div>

<div class="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-xl p-6 my-8">
<p class="text-white font-bold mb-2">結論</p>
<p class="text-slate-300 mb-0">
提前還 100 萬，可以節省約 <strong class="text-white">49 萬利息</strong>、縮短 <strong class="text-white">4 年還款期</strong>。<br>
等效年化報酬率約 <strong class="text-white">2.1%</strong>（等於房貸利率）。
</p>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">提前還款 vs 投資：怎麼選？</h2>

<p class="text-slate-300 mb-6">
核心問題是：你的<strong class="text-white">投資報酬率能不能打敗房貸利率</strong>？
</p>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<table class="w-full text-slate-300">
<thead>
<tr class="border-b border-slate-600">
  <th class="text-left py-3 text-white">選項</th>
  <th class="text-right py-3 text-white">預期報酬</th>
  <th class="text-left py-3 text-white">風險</th>
</tr>
</thead>
<tbody>
<tr class="border-b border-slate-700">
  <td class="py-3">提前還房貸</td>
  <td class="py-3 text-right">2.1%（確定）</td>
  <td class="py-3 text-green-400">零風險</td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-3">定存</td>
  <td class="py-3 text-right">1.5-1.8%</td>
  <td class="py-3 text-green-400">零風險</td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-3">債券 ETF</td>
  <td class="py-3 text-right">3-4%</td>
  <td class="py-3 text-blue-400">低風險</td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-3">股票 ETF</td>
  <td class="py-3 text-right">7-10%</td>
  <td class="py-3 text-amber-400">中風險</td>
</tr>
<tr>
  <td class="py-3">個股投資</td>
  <td class="py-3 text-right">不確定</td>
  <td class="py-3 text-red-400">高風險</td>
</tr>
</tbody>
</table>
</div>

<h3 class="text-xl font-bold text-white mt-8 mb-4">決策邏輯</h3>

<ul class="text-slate-300 mb-6 space-y-3">
<li><strong class="text-white">投資報酬 > 房貸利率</strong>：選擇投資</li>
<li><strong class="text-white">投資報酬 < 房貸利率</strong>：選擇還款</li>
<li><strong class="text-white">不確定</strong>：選擇還款（確定省利息）</li>
</ul>

<div class="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 my-6">
<p class="text-amber-200 font-bold mb-2">重要提醒</p>
<p class="text-slate-300 mb-0">
投資報酬率是「預期」，房貸利率是「確定」。<br>
<strong class="text-white">用確定的報酬 vs 不確定的報酬，不能只看數字。</strong><br>
要考慮你的風險承受能力。
</p>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">提前還款的違約金</h2>

<p class="text-slate-300 mb-6">
很多銀行有「綁約期」，提前還款要付違約金：
</p>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<table class="w-full text-slate-300">
<thead>
<tr class="border-b border-slate-600">
  <th class="text-left py-3 text-white">還款時間</th>
  <th class="text-right py-3 text-white">常見違約金</th>
</tr>
</thead>
<tbody>
<tr class="border-b border-slate-700">
  <td class="py-3">第 1 年內</td>
  <td class="py-3 text-right text-amber-400">還款金額 × 1.5%</td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-3">第 2 年內</td>
  <td class="py-3 text-right">還款金額 × 1%</td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-3">第 3 年後</td>
  <td class="py-3 text-right text-green-400">通常無違約金</td>
</tr>
</tbody>
</table>
</div>

<p class="text-slate-300 mb-6">
以提前還 100 萬為例，第 1 年內違約金 = 100 萬 × 1.5% = <strong class="text-white">15,000 元</strong>。<br>
要把違約金算進成本，看是否還划算。
</p>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">提前還款後的選擇</h2>

<p class="text-slate-300 mb-6">
提前還款後，銀行會給你兩個選項：
</p>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<table class="w-full text-slate-300">
<thead>
<tr class="border-b border-slate-600">
  <th class="text-left py-3 text-white">選項</th>
  <th class="text-left py-3 text-white">效果</th>
  <th class="text-left py-3 text-white">適合</th>
</tr>
</thead>
<tbody>
<tr class="border-b border-slate-700">
  <td class="py-3 font-bold">縮短期數</td>
  <td class="py-3">月付金不變，提早還完</td>
  <td class="py-3">想盡快無債一身輕</td>
</tr>
<tr>
  <td class="py-3 font-bold">降低月付</td>
  <td class="py-3">還款期限不變，月付變少</td>
  <td class="py-3">想減輕每月壓力</td>
</tr>
</tbody>
</table>
</div>

<div class="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4 my-6">
<p class="text-blue-200 font-bold mb-2">哪個省更多利息？</p>
<p class="text-slate-300 mb-0">
<strong class="text-white">縮短期數</strong>省的利息比較多。<br>
因為總還款時間變短，利息計算期間也變短。
</p>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">什麼時候該提前還款？</h2>

<div class="bg-green-900/20 border border-green-700/50 rounded-xl p-4 my-6">
<p class="text-green-200 font-bold mb-2">建議提前還款的情況</p>
<ul class="text-slate-300 mb-0 space-y-2">
<li>• <strong class="text-white">有閒置資金</strong>：不影響生活和緊急預備金</li>
<li>• <strong class="text-white">不會投資</strong>：與其放定存不如還房貸</li>
<li>• <strong class="text-white">房貸利率較高</strong>：利率 > 3% 更值得還</li>
<li>• <strong class="text-white">想減輕心理負擔</strong>：無債一身輕的安心感</li>
<li>• <strong class="text-white">接近退休</strong>：退休前還清房貸是好目標</li>
</ul>
</div>

<div class="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 my-6">
<p class="text-amber-200 font-bold mb-2">不建議提前還款的情況</p>
<ul class="text-slate-300 mb-0 space-y-2">
<li>• <strong class="text-white">沒有緊急預備金</strong>：至少留 6 個月生活費</li>
<li>• <strong class="text-white">有高利率負債</strong>：先還信用卡、信貸</li>
<li>• <strong class="text-white">有更好的投資機會</strong>：確定報酬 > 房貸利率</li>
<li>• <strong class="text-white">還在綁約期</strong>：違約金太高不划算</li>
<li>• <strong class="text-white">可能需要用錢</strong>：還進去就拿不出來了</li>
</ul>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">分批還款策略</h2>

<p class="text-slate-300 mb-6">
如果有 100 萬閒錢，不一定要一次還完：
</p>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<ul class="text-slate-300 space-y-4 mb-0">
<li>
  <strong class="text-white">策略一：50/50</strong><br>
  50 萬還房貸、50 萬投資<br>
  兼顧省利息和資產成長
</li>
<li>
  <strong class="text-white">策略二：每年定額還款</strong><br>
  每年還 20 萬，分 5 年還完<br>
  保持現金流彈性
</li>
<li>
  <strong class="text-white">策略三：等過綁約期</strong><br>
  先投資，過了綁約期再一次還<br>
  避免違約金
</li>
</ul>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">提前還款試算工具</h2>

<p class="text-slate-300 mb-6">
想知道你的情況提前還款能省多少？<br>
可以用 <a href="/calculator" class="text-blue-400 hover:underline">Ultra Advisor 傲創計算機</a> 的「額外還款」功能試算。
</p>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">一句話結論</h2>

<div class="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-xl p-6 my-8">
<p class="text-slate-300 mb-0">
<strong class="text-white text-lg">提前還款 = 確定省利息、零風險</strong><br>
<strong class="text-white text-lg">投資 = 可能更高報酬、但有風險</strong><br><br>
如果你的投資報酬率能穩定打敗房貸利率，選投資。<br>
如果不確定，還房貸是穩健的選擇。<br><br>
<strong class="text-white">記得留好緊急預備金，不要全部還進去。</strong>
</p>
</div>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
  <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
  <ul class="text-slate-300 mb-0 space-y-2">
    <li>→ <a href="/blog/mortgage-grace-period-trap-2026" class="text-blue-400 hover:underline">房貸寬限期是糖衣毒藥？完整利弊分析</a></li>
    <li>→ <a href="/blog/mortgage-principal-vs-equal-payment" class="text-blue-400 hover:underline">房貸還款方式比較：本金均攤 vs 本息均攤</a></li>
    <li>→ <a href="/blog/dca-vs-lump-sum-investment-2026" class="text-blue-400 hover:underline">定期定額 vs 單筆投入：哪個報酬更高？</a></li>
  </ul>
</div>
`
};
