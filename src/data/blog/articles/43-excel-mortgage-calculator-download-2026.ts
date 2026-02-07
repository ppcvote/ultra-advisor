import { BlogArticle } from '../types';

export const article: BlogArticle = {
  id: '43',
  slug: 'excel-mortgage-calculator-download-2026',
  title: 'Excel 房貸試算表：自己做一個專業級計算機',
  excerpt: '不想用網路上的計算機？這篇教你用 Excel 公式自己做，還能客製化。',
  category: 'tools',
  tags: ['Excel', '房貸試算', '房貸計算', 'PMT函數', '財務函數'],
  readTime: 8,
  publishDate: '2026-01-25',
  author: 'Ultra Advisor',
  featured: false,
  metaTitle: 'Excel 房貸試算表教學｜PMT 函數完整公式解析',
  metaDescription: '用 Excel 做房貸試算表：PMT、IPMT、PPMT 函數完整教學，本息均攤、本金均攤都能算。附公式解析。',
  content: `
<p class="text-xl text-slate-300 mb-8">
網路上房貸計算機很多，但你有沒有想過：<br>
<strong class="text-white">自己用 Excel 做一個，想怎麼改就怎麼改？</strong>
</p>

<p class="text-slate-300 mb-6">
這篇教你用 Excel 內建的財務函數，做出專業級的房貸試算表。<br>
學會之後，你可以自己加功能、改參數，比任何線上工具都靈活。
</p>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">核心公式：PMT 函數</h2>

<p class="text-slate-300 mb-6">
Excel 的 <strong class="text-white">PMT 函數</strong> 是房貸試算的核心，用來計算「本息均攤」的每月還款金額。
</p>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<p class="text-white font-bold mb-2">PMT 函數語法</p>
<code class="text-green-400 text-lg">=PMT(rate, nper, pv)</code>
<ul class="text-slate-300 mt-4 space-y-2">
<li>• <strong class="text-white">rate</strong>：每期利率（年利率 ÷ 12）</li>
<li>• <strong class="text-white">nper</strong>：總期數（年數 × 12）</li>
<li>• <strong class="text-white">pv</strong>：貸款本金（現值）</li>
</ul>
</div>

<h3 class="text-xl font-bold text-white mt-8 mb-4">實際範例</h3>

<p class="text-slate-300 mb-4">
貸款條件：本金 800 萬、年利率 2.1%、30 年期
</p>

<div class="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4 my-6">
<code class="text-green-400">=PMT(2.1%/12, 30*12, 8000000)</code>
<p class="text-slate-300 mt-2 mb-0">
結果：<strong class="text-white">-30,097</strong>（負數代表支出）<br>
每月還款約 <strong class="text-white">30,097 元</strong>
</p>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">進階函數：拆解本金與利息</h2>

<h3 class="text-xl font-bold text-white mt-8 mb-4">IPMT：計算某期的利息</h3>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<code class="text-green-400">=IPMT(rate, per, nper, pv)</code>
<ul class="text-slate-300 mt-4 space-y-2">
<li>• <strong class="text-white">per</strong>：第幾期（例如第 1 期、第 120 期）</li>
</ul>
<p class="text-slate-300 mt-4 mb-0">
<strong>範例：</strong>第 1 期利息<br>
<code class="text-green-400">=IPMT(2.1%/12, 1, 360, 8000000)</code> = <strong class="text-white">-14,000 元</strong>
</p>
</div>

<h3 class="text-xl font-bold text-white mt-8 mb-4">PPMT：計算某期的本金</h3>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<code class="text-green-400">=PPMT(rate, per, nper, pv)</code>
<p class="text-slate-300 mt-4 mb-0">
<strong>範例：</strong>第 1 期本金<br>
<code class="text-green-400">=PPMT(2.1%/12, 1, 360, 8000000)</code> = <strong class="text-white">-16,097 元</strong>
</p>
</div>

<div class="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-xl p-6 my-8">
<p class="text-white font-bold mb-2">驗證公式</p>
<p class="text-slate-300 mb-0">
IPMT + PPMT = PMT<br>
14,000 + 16,097 = <strong class="text-white">30,097</strong> ✓
</p>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">製作完整還款明細表</h2>

<p class="text-slate-300 mb-6">
用這些公式，你可以做出逐月的還款明細表：
</p>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<table class="w-full text-slate-300 text-sm">
<thead>
<tr class="border-b border-slate-600">
  <th class="text-left py-2 text-white">欄位</th>
  <th class="text-left py-2 text-white">公式（假設本金在 B1、利率在 B2、年數在 B3）</th>
</tr>
</thead>
<tbody>
<tr class="border-b border-slate-700">
  <td class="py-2">期數</td>
  <td class="py-2"><code class="text-green-400">1, 2, 3...</code>（自動填充）</td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-2">月付金</td>
  <td class="py-2"><code class="text-green-400">=PMT($B$2/12, $B$3*12, $B$1)</code></td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-2">本期利息</td>
  <td class="py-2"><code class="text-green-400">=IPMT($B$2/12, A5, $B$3*12, $B$1)</code></td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-2">本期本金</td>
  <td class="py-2"><code class="text-green-400">=PPMT($B$2/12, A5, $B$3*12, $B$1)</code></td>
</tr>
<tr>
  <td class="py-2">剩餘本金</td>
  <td class="py-2"><code class="text-green-400">=前期剩餘本金 + 本期本金</code></td>
</tr>
</tbody>
</table>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">本金均攤怎麼算？</h2>

<p class="text-slate-300 mb-6">
本金均攤不能直接用 PMT，因為每期還款金額不同。<br>
但計算更簡單：
</p>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<ul class="text-slate-300 space-y-3">
<li>
  <strong class="text-white">每期本金</strong>（固定）：<br>
  <code class="text-green-400">= 貸款本金 ÷ 總期數</code><br>
  = 8,000,000 ÷ 360 = <strong class="text-white">22,222 元</strong>
</li>
<li>
  <strong class="text-white">每期利息</strong>（遞減）：<br>
  <code class="text-green-400">= 剩餘本金 × 月利率</code>
</li>
<li>
  <strong class="text-white">每期還款</strong>：<br>
  <code class="text-green-400">= 每期本金 + 每期利息</code>
</li>
</ul>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">加入額外還款功能</h2>

<p class="text-slate-300 mb-6">
想看提前還款能省多少利息？在明細表加一欄「額外還款」：
</p>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<p class="text-slate-300 mb-2"><strong class="text-white">修改剩餘本金公式：</strong></p>
<code class="text-green-400">= 前期剩餘本金 + 本期本金 - 額外還款</code>
<p class="text-slate-300 mt-4 mb-0">
這樣你可以在任何一期輸入額外還款金額，<br>
看看提前還 50 萬、100 萬能省多少利息。
</p>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">其他實用財務函數</h2>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
<table class="w-full text-slate-300">
<thead>
<tr class="border-b border-slate-600">
  <th class="text-left py-3 text-white">函數</th>
  <th class="text-left py-3 text-white">用途</th>
</tr>
</thead>
<tbody>
<tr class="border-b border-slate-700">
  <td class="py-3"><code class="text-green-400">RATE</code></td>
  <td class="py-3">已知月付金，反推利率</td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-3"><code class="text-green-400">NPER</code></td>
  <td class="py-3">已知月付金，反推還款期數</td>
</tr>
<tr class="border-b border-slate-700">
  <td class="py-3"><code class="text-green-400">PV</code></td>
  <td class="py-3">已知月付金，反推可貸金額</td>
</tr>
<tr>
  <td class="py-3"><code class="text-green-400">FV</code></td>
  <td class="py-3">計算未來值（投資試算用）</td>
</tr>
</tbody>
</table>
</div>

<h2 class="text-2xl font-bold text-white mt-12 mb-6">為什麼要自己做？</h2>

<ul class="text-slate-300 mb-6 space-y-3">
<li><strong class="text-white">1. 完全客製化</strong>：想加什麼功能就加什麼</li>
<li><strong class="text-white">2. 離線使用</strong>：不用上網也能算</li>
<li><strong class="text-white">3. 資料保密</strong>：客戶資料不會上傳到網路</li>
<li><strong class="text-white">4. 專業形象</strong>：用自己的試算表，比用別人的工具更專業</li>
</ul>

<div class="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 my-6">
<p class="text-amber-200 font-bold mb-2">小提醒</p>
<p class="text-slate-300 mb-0">
如果你覺得自己做太麻煩，也可以用 <a href="/calculator" class="text-blue-400 hover:underline">Ultra Advisor 傲創計算機</a>，功能更完整，而且免費。
</p>
</div>

<div class="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 my-8">
  <h4 class="text-white font-bold mb-4">📚 延伸閱讀</h4>
  <ul class="text-slate-300 mb-0 space-y-2">
    <li>→ <a href="/blog/mortgage-principal-vs-equal-payment" class="text-blue-400 hover:underline">房貸還款方式比較：本金均攤 vs 本息均攤</a></li>
    <li>→ <a href="/blog/how-to-use-mortgage-calculator" class="text-blue-400 hover:underline">如何使用房貸計算機做專業提案</a></li>
    <li>→ <a href="/blog/bank-mortgage-rates-comparison-2026" class="text-blue-400 hover:underline">2026 各銀行房貸利率比較表</a></li>
  </ul>
</div>
`
};
