import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '45',
  slug: '4-percent-rule-retirement-2026',
  title: '4% 法則：退休金到底要存多少才夠？',
  excerpt: '聽過「4% 法則」嗎？這是計算退休金最簡單的方法。但台灣適用嗎？這篇告訴你。',
  category: 'retirement',
  tags: ['4%法則', '退休金', '退休規劃', 'FIRE', '財務自由'],
  readTime: 6,
  publishDate: '2026-01-25',
  author: 'Ultra Advisor',
  featured: false,
  metaTitle: '4% 法則是什麼？退休金試算完整教學｜2026',
  metaDescription: '4% 法則退休金計算：年支出 × 25 = 需要的退休金。完整解析適用條件、台灣調整建議、實際試算範例。',
  content: `
<p class="text-xl text-slate-300 mb-8">
「退休要存多少錢？」<br>
這個問題困擾很多人。<br>
<strong class="text-white">4% 法則給你一個簡單的答案。</strong>
</p>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">什麼是 4% 法則？</h2>

<p class="text-slate-300 mb-6">
4% 法則來自 1994 年美國學者 William Bengen 的研究。<br>
他分析了 1926-1992 年的歷史數據，發現：
</p>

<div class="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-xl p-6 my-8">
<p class="text-white font-bold mb-2">核心概念</p>
<p class="text-slate-300 mb-0">
如果退休後每年只提領退休金的 <strong class="text-white">4%</strong>，<br>
這筆錢可以撐至少 <strong class="text-white">30 年</strong>不會用完。<br><br>
反過來算：<br>
<strong class="text-white text-xl">退休金 = 年度支出 × 25</strong>
</p>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">實際試算</h2>

<h3 class="text-xl font-bold text-white mt-8 mb-4">情境：每月生活費 5 萬元</h3>

<div class="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4 my-6">
<p class="text-slate-300 mb-0">
年度支出 = 50,000 × 12 = <strong class="text-white">600,000 元</strong><br>
需要退休金 = 600,000 × 25 = <strong class="text-white text-xl">1,500 萬元</strong>
</p>
</div>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<table class="w-full text-slate-300">
<thead>
<tr class="border-b border-slate-600">
  <th class="text-left py-3 text-white">月支出</th>
  <th class="text-right py-3 text-white">年支出</th>
  <th class="text-right py-3 text-white">需要退休金</th>
</tr>
</thead>
<tbody>
<tr class="border-b border-slate-700">
  <td class="py-3">3 萬</td>
  <td class="py-3 text-right">36 萬</td>
  <td class="py-3 text-right">900 萬</td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-3">4 萬</td>
  <td class="py-3 text-right">48 萬</td>
  <td class="py-3 text-right">1,200 萬</td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-3">5 萬</td>
  <td class="py-3 text-right">60 萬</td>
  <td class="py-3 text-right">1,500 萬</td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-3">6 萬</td>
  <td class="py-3 text-right">72 萬</td>
  <td class="py-3 text-right">1,800 萬</td>
</tr>
<tr>
  <td class="py-3">8 萬</td>
  <td class="py-3 text-right">96 萬</td>
  <td class="py-3 text-right">2,400 萬</td>
</tr>
</tbody>
</table>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">4% 法則的前提假設</h2>

<p class="text-slate-300 mb-6">
這個法則不是萬能的，它有幾個重要前提：
</p>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<ul class="text-slate-300 space-y-4 mb-0">
<li>
  <strong class="text-white">1. 資產配置：50% 股票 + 50% 債券</strong><br>
  原始研究假設退休金投資美國股市和債券
</li>
<li>
  <strong class="text-white">2. 退休時間：30 年</strong><br>
  假設 65 歲退休、活到 95 歲
</li>
<li>
  <strong class="text-white">3. 每年調整通膨</strong><br>
  提領金額會隨通膨調整，維持購買力
</li>
<li>
  <strong class="text-white">4. 基於美國歷史數據</strong><br>
  1926-1992 年的美國市場表現
</li>
</ul>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">台灣適用嗎？需要調整</h2>

<p class="text-slate-300 mb-6">
4% 法則是美國研究，直接套用台灣要注意幾點：
</p>

<h3 class="text-xl font-bold text-white mt-8 mb-4">1. 台灣人更長壽</h3>
<p class="text-slate-300 mb-6">
台灣平均壽命超過 80 歲，如果 60 歲退休，可能需要撐 30-40 年。<br>
<strong class="text-white">建議改用 3.5% 或 3% 更保守的提領率。</strong>
</p>

<h3 class="text-xl font-bold text-white mt-8 mb-4">2. 台灣有勞保勞退</h3>
<p class="text-slate-300 mb-6">
台灣的勞保年金、勞工退休金可以補充部分退休所需。<br>
<strong class="text-white">4% 法則算的是「缺口」，不是全部。</strong>
</p>

<h3 class="text-xl font-bold text-white mt-8 mb-4">3. 健保減輕醫療負擔</h3>
<p class="text-slate-300 mb-6">
台灣健保讓醫療支出比美國低很多。<br>
這是台灣退休規劃的優勢。
</p>

<div class="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 my-6">
<p class="text-amber-200 font-bold mb-2">台灣版 4% 法則建議</p>
<p class="text-slate-300 mb-0">
考慮長壽風險和不確定性，台灣建議用 <strong class="text-white">3%～3.5%</strong> 計算。<br>
退休金 = 年支出缺口 × 28～33
</p>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">完整退休金計算</h2>

<p class="text-slate-300 mb-6">
不要只算 4% 法則，要考慮所有收入來源：
</p>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<p class="text-slate-300 mb-2"><strong class="text-white">範例：60 歲退休、月支出 5 萬</strong></p>
<ul class="text-slate-300 space-y-2 mb-0">
<li>
  <strong class="text-white">年支出</strong>：60 萬
</li>
<li>
  <strong class="text-white">勞保年金</strong>：約 2 萬/月 = 24 萬/年
</li>
<li>
  <strong class="text-white">勞退</strong>：約 0.8 萬/月 = 9.6 萬/年
</li>
<li>
  <strong class="text-white">缺口</strong>：60 - 24 - 9.6 = <strong class="text-green-400">26.4 萬/年</strong>
</li>
<li>
  <strong class="text-white">需自備退休金</strong>：26.4 萬 × 25 = <strong class="text-green-400">660 萬</strong>
</li>
</ul>
</div>

<p class="text-slate-300 mb-6">
考慮勞保勞退後，原本需要 1500 萬，變成只需要 660 萬。<br>
<strong class="text-white">這就是為什麼要仔細計算，而不是只套公式。</strong>
</p>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">4% 法則的風險</h2>

<h3 class="text-xl font-bold text-white mt-8 mb-4">1. 退休初期遇到股災</h3>
<p class="text-slate-300 mb-6">
如果退休第一年就遇到股市大跌，資產縮水 30-40%，<br>
但還是要提領生活費，會大幅縮短資產壽命。<br>
這叫「<strong class="text-white">報酬序列風險</strong>」(Sequence of Returns Risk)。
</p>

<h3 class="text-xl font-bold text-white mt-8 mb-4">2. 活太久</h3>
<p class="text-slate-300 mb-6">
4% 法則假設 30 年，但如果活到 100 歲呢？<br>
長壽是福氣，但也是財務挑戰。
</p>

<h3 class="text-xl font-bold text-white mt-8 mb-4">3. 意外大額支出</h3>
<p class="text-slate-300 mb-6">
重大醫療、房屋修繕、家人需要幫忙...<br>
這些都可能打亂原本的計畫。
</p>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">如何降低風險？</h2>

<ul class="text-slate-300 mb-6 space-y-3">
<li><strong class="text-white">1. 保守估算</strong>：用 3% 或 3.5% 而不是 4%</li>
<li><strong class="text-white">2. 彈性支出</strong>：市場不好時減少支出</li>
<li><strong class="text-white">3. 保留緊急預備金</strong>：1-2 年生活費放定存</li>
<li><strong class="text-white">4. 延後退休</strong>：多工作幾年，讓資產繼續成長</li>
<li><strong class="text-white">5. 兼職收入</strong>：退休後還有小額收入來源</li>
</ul>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">一句話結論</h2>

<div class="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-xl p-6 my-8">
<p class="text-slate-300 mb-0">
<strong class="text-white text-lg">4% 法則是起點，不是終點。</strong><br><br>
它給你一個快速估算的方法：<strong class="text-white">年支出 × 25 = 退休金目標</strong>。<br>
但實際規劃要考慮勞保勞退、通膨、長壽風險。<br><br>
<strong class="text-white">建議台灣用 3%～3.5% 更保守的數字。</strong>
</p>
</div>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
  <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
  <ul class="text-slate-300 mb-0 space-y-2">
    <li>→ <a href="/blog/labor-insurance-pension-lump-sum-vs-annuity-2026" class="text-blue-400 hover:underline">勞保年金 vs 一次領：怎麼選最划算？</a></li>
    <li>→ <a href="/blog/labor-pension-voluntary-contribution-2026" class="text-blue-400 hover:underline">勞退自提 6% 到底划不划算？</a></li>
    <li>→ <a href="/blog/retirement-planning-basics" class="text-blue-400 hover:underline">退休規劃入門：如何計算退休金缺口</a></li>
  </ul>
</div>
`
};
