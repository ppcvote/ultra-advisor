import type { VercelRequest, VercelResponse } from '@vercel/node';

// 文章 metadata（從 functions/index.js 同步）
interface ArticleMeta { title: string; category: string; description: string; publishDate: string; }
const articleMetadata: Record<string, ArticleMeta> = {
  'mortgage-principal-vs-equal-payment': { title: '房貸還款方式比較：本金均攤 vs 本息均攤', category: 'mortgage', description: '詳細比較本金均攤與本息均攤的利息差異、月付金變化、適合對象。', publishDate: '2026-01-15' },
  'retirement-planning-basics': { title: '退休規劃入門：如何計算退休金缺口', category: 'retirement', description: '退休規劃基礎概念，計算勞保勞退給付、退休金缺口分析方法。', publishDate: '2026-01-10' },
  'estate-tax-planning-2026': { title: '2026 遺產稅規劃全攻略', category: 'tax', description: '最新遺產稅免稅額、稅率級距、節稅策略完整解析。', publishDate: '2026-01-05' },
  'compound-interest-power': { title: '複利的威力：讓時間成為你的朋友', category: 'investment', description: '深入淺出解釋複利效應，投資理財必懂的核心概念。', publishDate: '2025-12-28' },
  'how-to-use-mortgage-calculator': { title: '如何使用房貸計算機做專業提案', category: 'tools', description: 'Ultra Advisor 房貸計算機完整教學，提升提案效率。', publishDate: '2025-12-20' },
  'gift-tax-annual-exemption': { title: '贈與稅免稅額完整攻略', category: 'tax', description: '244 萬免稅額如何運用？分年贈與策略完整解析。', publishDate: '2025-12-15' },
  'financial-advisor-data-visualization-sales': { title: '財務顧問數據視覺化銷售法', category: 'sales', description: '運用數據圖表提升說服力的進階銷售技巧。', publishDate: '2026-01-18' },
  'insurance-advisor-coverage-gap-analysis': { title: '保險顧問保障缺口分析實戰', category: 'sales', description: '如何用數據發現客戶的保障缺口並提供解決方案。', publishDate: '2026-01-17' },
  'wealth-manager-high-net-worth-clients': { title: '高資產客戶經營心法', category: 'sales', description: '如何服務高資產客戶，建立長期信任關係。', publishDate: '2026-01-16' },
  'financial-advisor-digital-transformation-2026': { title: '2026 財務顧問數位轉型指南', category: 'tools', description: '數位工具提升效率，打造個人品牌的實戰策略。', publishDate: '2026-01-14' },
  'financial-health-check-client-trust': { title: '財務健檢：建立客戶信任的第一步', category: 'sales', description: '透過財務健檢服務開發新客戶的完整流程。', publishDate: '2026-01-12' },
  'bank-mortgage-rates-comparison-2026': { title: '2026 台灣房貸利率比較表｜15 家銀行完整整理', category: 'mortgage', description: '2026 台灣房貸利率比較：公股銀行 2.06% 起、民營銀行最低 1.93%。15 家銀行利率、成數、寬限期整理。', publishDate: '2026-01-19' },
  'financial-advisor-objection-handling-scripts': { title: '財務顧問異議處理話術大全', category: 'sales', description: '常見客戶異議的專業回應方式。', publishDate: '2026-01-18' },
  'estate-tax-vs-gift-tax-comparison': { title: '遺產稅 vs 贈與稅完整比較', category: 'tax', description: '搞懂遺產稅和贈與稅的差異，選擇最適合的傳承方式。', publishDate: '2026-01-17' },
  'tax-season-2026-advisor-tips': { title: '2026 報稅季財務顧問必知重點', category: 'tax', description: '報稅季節的客戶服務重點與商機。', publishDate: '2026-01-16' },
  'financial-advisor-income-survey-2026': { title: '2026 財務顧問薪資調查', category: 'tools', description: '台灣財務顧問市場薪資水平與發展趨勢分析。', publishDate: '2026-01-15' },
  'credit-card-installment-2026': { title: '2026 信用卡分期利率試算', category: 'investment', description: '信用卡分期 12 期年化利率高達 14.8%，等於借年利率 14.8% 的錢。', publishDate: '2026-01-19' },
  'labor-insurance-pension-2026': { title: '2026 勞保勞退給付速算', category: 'retirement', description: '勞保年金平均月領 1.9 萬、勞退月領約 2,400 元，合計替代率僅 40%。', publishDate: '2026-01-19' },
  'estate-gift-tax-quick-reference-2026': { title: '2026 遺產稅贈與稅速查表', category: 'tax', description: '遺產稅免稅額 1,333 萬、贈與稅每年 244 萬免稅，超過部分 10%～20% 課稅。', publishDate: '2026-01-19' },
  'property-tax-self-use-residence-2026': { title: '2026 房屋稅地價稅自用住宅條件', category: 'tax', description: '自用住宅優惠稅率：房屋稅 1%、地價稅 0.2%，需本人或配偶設籍。', publishDate: '2026-01-19' },
  'bank-deposit-rates-comparison-2026': { title: '2026 各銀行定存利率比較', category: 'investment', description: '2026 年定存最高利率 2.15%，活存最高 2.6%，比較 15 家銀行利率。', publishDate: '2026-01-19' },
  'nhi-supplementary-premium-2026': { title: '2026 二代健保補充保費攻略｜費率 2.11%、門檻與節省方法', category: 'tax', description: '二代健保補充保費 2026：費率 2.11%，股利、利息、租金等單筆超過 2 萬就要扣。六大課徵項目 + 合法節省方法。', publishDate: '2026-01-19' },
  'savings-insurance-vs-deposit-2026': { title: '儲蓄險 vs 定存哪個划算？2026 IRR 實算比較', category: 'investment', description: '儲蓄險 IRR 約 2%～2.5%、定存利率 1.5%～1.8%，看似儲蓄險贏？但提前解約虧本金！什麼情況選哪個一次看懂。', publishDate: '2026-01-19' },
  'mortgage-refinance-cost-2026': { title: '2026 房貸轉貸成本試算', category: 'mortgage', description: '房貸轉貸成本約 2.5～3 萬元，利差要多少才划算？', publishDate: '2026-01-19' },
  'income-tax-brackets-2026': { title: '2026 所得稅級距與扣除額速查表', category: 'tax', description: '2026 年報稅免稅額 10.1 萬、標準扣除額 13.6 萬、薪資扣除額 22.7 萬。', publishDate: '2026-01-19' },
  'high-dividend-etf-calendar-2026': { title: '2026 台股高股息 ETF 配息月曆', category: 'investment', description: '0056、00878、00919 配息時間、殖利率、選股邏輯分析，教你月月領息。', publishDate: '2026-01-19' },
  'digital-deposit-vs-insurance-value-2026': { title: '數位存款是什麼？銀行現金 vs 保單價值 vs 投資帳戶', category: 'investment', description: '同樣 100 萬，放銀行、放保單、放投資帳戶結果差很多！一篇搞懂數位存款概念。', publishDate: '2026-01-20' },
  'reverse-mortgage-vs-professional-planning-2026': { title: '以房養老該去銀行辦嗎？專業規劃比直接貸款更重要', category: 'retirement', description: '以房養老直接去銀行辦？小心長壽風險讓你老後沒保障！找專業財務顧問規劃，搭配足額壽險才是正解。', publishDate: '2026-01-20' },
  'career-change-finance-insurance-salary-2026': { title: '年後轉職潮來了！如何挑選行業？金融保險業薪資到底有多高？', category: 'sales', description: '2026 最新數據：金融保險業平均月薪 82,000 元穩居各行業之首！年後轉職該如何挑選行業？完整分析優缺點。', publishDate: '2026-01-21' },
  'social-media-marketing-financial-advisor-2026': { title: '社群媒體經營對財務顧問有多重要？2026 最新數據告訴你', category: 'sales', description: '75% 高資產客戶透過社群認識顧問！2026 最新數據揭密：社群媒體經營已成為財務顧問必備技能，不做社群等於放棄一半客戶。', publishDate: '2026-01-21' },
  'financial-advisor-survival-2026': { title: '2026 年財務顧問如何不被淘汰？持續學習 + 善用工具是關鍵', category: 'sales', description: '金融業變化越來越快，AI 工具崛起、客戶要求提高、市場競爭加劇。2026 年，財務顧問該怎麼做才能不被淘汰？', publishDate: '2026-01-21' },
  'mindset-financial-advisor-2026': { title: '心態，決定你在這行能走多遠', category: 'sales', description: '技巧可以學，話術可以練，但心態不對，一切都是白搭。為什麼有人做三個月就陣亡，有人卻能做十年以上？', publishDate: '2026-01-21' },
  'note-taking-financial-advisor-2026': { title: '為什麼頂尖顧問都在做筆記？', category: 'sales', description: '聽了很多課、看了很多書，但為什麼還是覺得沒進步？因為你只有「學」，沒有「習」。筆記，就是把學變成習的關鍵。', publishDate: '2026-01-21' },
  'cash-flow-rich-poor-2026': { title: '窮人、中產、富人的現金流差在哪？一張圖看懂', category: 'investment', description: '同樣在工作賺錢，為什麼有人越來越窮、有人原地踏步、有人越來越有錢？差別不在收入多少，而在錢流向哪裡。', publishDate: '2026-01-21' },
  'esbi-cashflow-quadrant-2026': { title: '你在哪個象限？ESBI 現金流象限決定你的財務命運', category: 'investment', description: '富爸爸的 ESBI 現金流象限：僱員、自雇者、企業主、投資者。了解四種收入來源的差異，找到通往財務自由的路徑。', publishDate: '2026-01-22' },
  'client-procrastination-cost-2026': { title: '客戶說「再考慮看看」？拖延的代價超乎想像', category: 'sales', description: '財務決策的拖延，代價是精神、財富、時間的三重損失。如何幫客戶察覺、修正、改善？', publishDate: '2026-01-23' },
  'income-tax-amt-guide-2026': { title: '2026 綜所稅＋最低稅負制完整攻略', category: 'tax', description: '2026 年報稅必看！綜所稅級距、免稅額、扣除額，加上最低稅負制（基本稅額）完整說明。', publishDate: '2026-01-23' },
  'allianz-global-income-growth-suspended-2026': { title: '安聯收益成長被買爆！暫停申購要緊嗎？', category: 'investment', description: '安聯全球收益成長基金暫停新申購，不是出問題，是太熱門！已持有的人權益完全不受影響。', publishDate: '2026-01-23' },
  'labor-insurance-pension-lump-sum-vs-annuity-2026': { title: '勞保年金 vs 一次領：2026 年怎麼選最划算？', category: 'retirement', description: '勞保老年給付該選年金還是一次領？完整試算比較、損益平衡點分析。', publishDate: '2026-01-22' },
  'new-youth-housing-loan-2026': { title: '2026 新青安貸款懶人包：資格、利率、額度一次看懂', category: 'mortgage', description: '新青安貸款最新資訊：申請資格、利率優惠、貸款額度、寬限期規定。首購族必看。', publishDate: '2026-01-22' },
  'labor-pension-voluntary-contribution-2026': { title: '勞退自提 6% 到底划不划算？2026 完整分析', category: 'retirement', description: '勞退自提 6% 到底要不要做？完整分析節稅效果、報酬率比較、適合族群。', publishDate: '2026-01-22' },
  'dca-vs-lump-sum-investment-2026': { title: '定期定額 vs 單筆投入：哪個賺更多？數據實測', category: 'investment', description: '定期定額和單筆投入哪個報酬率更高？用歷史數據實測比較。', publishDate: '2026-01-22' },
  'excel-mortgage-calculator-download-2026': { title: 'Excel 房貸試算表：自己做一個專業級計算機', category: 'tools', description: '用 Excel 做房貸試算表：PMT、IPMT、PPMT 函數完整教學，本息均攤、本金均攤都能算。', publishDate: '2026-01-25' },
  'free-financial-tools-for-advisors-2026': { title: '2026 年 5 個免費線上財務工具推薦', category: 'tools', description: '精選 5 個免費財務工具：房貸計算機、退休試算、稅務計算。不花錢也能做專業財務規劃。', publishDate: '2026-01-25' },
  '4-percent-rule-retirement-2026': { title: '4% 法則：退休金到底要存多少才夠？', category: 'retirement', description: '4% 法則退休金計算：年支出 × 25 = 需要的退休金。完整解析適用條件、台灣調整建議。', publishDate: '2026-01-25' },
  'retire-at-50-plan-2026': { title: '50歲退休規劃｜提早退休要準備多少錢？完整檢查清單 2026', category: 'retirement', description: '50歲退休規劃完整指南：退休金至少準備 1,500 萬起跳、勞保勞退提前領少很多、健保自付每月近萬元。', publishDate: '2026-01-25' },
  'national-pension-guide-2026': { title: '國民年金是什麼？要不要繳？2026 完整解析', category: 'retirement', description: '國民年金完整解析：誰要繳、保費多少、給付怎麼算、欠繳會怎樣。', publishDate: '2026-01-25' },
  'retirement-living-cost-taiwan-2026': { title: '台灣退休生活費要多少？2026 各縣市完整比較', category: 'retirement', description: '台灣退休每月生活費完整分析：台北 vs 中南部、有房 vs 無房、基本型 vs 舒適型。', publishDate: '2026-01-25' },
  'mortgage-grace-period-trap-2026': { title: '房貸寬限期是糖衣毒藥？完整利弊分析', category: 'mortgage', description: '房貸寬限期到底好不好？完整分析寬限期優缺點、結束後月付金暴增試算。', publishDate: '2026-01-25' },
  'mortgage-prepayment-worth-it-2026': { title: '房貸提前還款划算嗎？完整試算告訴你', category: 'mortgage', description: '房貸提前還款完整分析：省多少利息、縮短多少年、違約金計算。', publishDate: '2026-01-25' },
  'mortgage-self-use-vs-investment-2026': { title: '自住房貸 vs 投資房貸：利率、成數、稅務差在哪？', category: 'mortgage', description: '自住房貸和投資房貸差異完整比較：利率差多少、成數差多少、稅務怎麼算。', publishDate: '2026-01-25' },
  'mortgage-refinance-equity-loan-2026': { title: '房貸增貸、轉增貸是什麼？2026 完整申請指南', category: 'mortgage', description: '房貸增貸和轉增貸完整解析：差異比較、利率條件、申請流程、適合情況。', publishDate: '2026-01-25' },
  'mortgage-joint-application-2026': { title: '夫妻聯名買房：貸款、產權、稅務完整指南', category: 'mortgage', description: '夫妻買房該登記誰的名字？聯名貸款有什麼好處？產權怎麼分？稅務怎麼算？', publishDate: '2026-01-25' },
  'taiwan-gdp-surpass-japan-korea-2026': { title: '台灣人均GDP超越日韓！23年來首次，你的錢包有感嗎？', category: 'investment', description: '台灣人均GDP達37,827美元，超越日本和韓國，亞洲排名第四。但薪水有跟上嗎？', publishDate: '2026-01-26' },
  'ultra-alliance-maker-island-ecosystem-2026': { title: '傲創聯盟：打造財務顧問的「創客島嶼生態鏈」', category: 'sales', description: '傲創聯盟串聯線下優質場所，為財務顧問打造專屬商務與生活圈。', publishDate: '2026-01-26' },
  'glp1-drug-lawsuit-taiwan-warning-2026': { title: '美國爆發 GLP-1 減重藥集體訴訟：猛健樂、瘦瘦筆在台氾濫，你該知道的真相', category: 'investment', description: '美國法院受理數千起 Ozempic、Mounjaro 傷害訴訟，指控引發胃輕癱等嚴重副作用。台灣卻有人濫用，這篇告訴你真相。', publishDate: '2026-02-07' },
  'dopamine-success-vs-scrolling-2026': { title: '成交的多巴胺 vs 滑手機的多巴胺：你在用哪一種方式消耗人生？', category: 'sales', description: '同樣是多巴胺，成交帶來的快樂和滑手機的快樂完全不同。員工用滑手機打發時間，老闆用成交創造價值。這篇告訴你如何戒掉垃圾快樂，擁抱真正的成就感。', publishDate: '2026-02-08' },
  'fund-data-vs-excel-myth-2026': { title: '看懂基金，靠的是真實數據，不是 Excel', category: 'investment', description: '「配息來源可能來自本金」是法規風險揭露，不是基金在吃老本。教你用真實數據判斷一支配息基金的好壞，別被 Excel 試算表的結論帶著走。', publishDate: '2026-02-26' },
  'offshore-insurance-risk-taiwan-2026': { title: '境外保單利率高又免稅？三個你沒被告知的致命風險', category: 'investment', description: '境外保單標榜高利率、免稅、保費便宜？金管會示警五大風險，非法招攬最重關3年。一篇搞懂為什麼不該碰地下保單。', publishDate: '2026-02-26' },
  'investment-linked-policy-trust-rebuild-2026': { title: '投資型保單讓你賠過錢？問題可能不在保單', category: 'investment', description: '投資型保單賠錢不是保單的錯，是配置的問題。了解專業顧問如何幫你選對基金、動態調整，讓投資型保單真正發揮價值。', publishDate: '2026-02-26' },
  'education-worker-retirement-risk-2026': { title: '教授、老師注意：三個正在侵蝕你退休金的隱形風險', category: 'retirement', description: '少子化、AI 浪潮、年金改革三重衝擊，教育工作者的退休金正面臨前所未有的壓力。公立 vs 私立差距高達 800 萬，你準備好了嗎？', publishDate: '2026-02-27' },
  'ai-agent-finance-disruption-2026': { title: 'AI Agent 來了：金融業正在發生的五件事，你準備好了嗎？', category: 'investment', description: 'Morgan Stanley 營收創新高卻裁 2,500 人、保險理賠 AI 處理只要 7.5 天、財務顧問公司股價一天暴跌 8%。AI Agent 對金融業的衝擊全面解析。', publishDate: '2026-03-08' },
  'market-crash-buying-opportunity-2026': { title: '你錯過了 2020、2022、2025 的低點？這次回檔，別再只是看著', category: 'investment', description: '每次股市崩盤都是財富重新分配的起點。從新冠低點到關稅暴跌，回顧三次危機入市的報酬，教你建立一套不再錯過的系統。', publishDate: '2026-03-28' },
};

// 分類對應的 OG 圖片
const categoryOgImages: Record<string, string> = {
  mortgage: 'og-mortgage.png',
  retirement: 'og-retirement.png',
  tax: 'og-tax.png',
  investment: 'og-investment.png',
  tools: 'og-tools.png',
  sales: 'og-sales.png',
};

// 爬蟲 User-Agent 檢測（只檢測真正的爬蟲，不包含用戶瀏覽器）
// LINE 內建瀏覽器不是爬蟲，它的 UA 包含 "Line/" 但也包含 "Safari" 或 "Chrome"
const crawlerPatterns = [
  'facebookexternalhit',
  'Facebot',
  'LinkedInBot',
  'Twitterbot',
  'Slackbot-LinkExpanding',
  'WhatsApp/',  // WhatsApp 爬蟲（注意斜線，避免誤判）
  'TelegramBot',
  'Discordbot',
  'Pinterestbot',
  'Googlebot',
  'bingbot',
];

function isCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();

  // 如果包含真實瀏覽器引擎（Safari/Chrome/Firefox），而且不是已知爬蟲，就不是爬蟲
  const hasBrowserEngine = ua.includes('safari') || ua.includes('chrome') || ua.includes('firefox');
  const isKnownBot = crawlerPatterns.some(pattern => ua.includes(pattern.toLowerCase()));

  if (hasBrowserEngine && !isKnownBot) {
    return false; // 真實瀏覽器，不是爬蟲
  }

  return isKnownBot;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userAgent = req.headers['user-agent'] || '';
  const { slug } = req.query;
  const slugStr = Array.isArray(slug) ? slug[0] : slug || '';

  const article = articleMetadata[slugStr];
  const finalArticle: ArticleMeta = article || {
    title: 'Ultra Advisor 知識庫',
    category: 'tools',
    description: '專業財務顧問工具與理財知識，幫助您做出更好的財務決策。',
    publishDate: new Date().toISOString().split('T')[0],
  };
  const ogImage = categoryOgImages[finalArticle.category] || 'og-image.png';
  const fullUrl = `https://ultra-advisor.tw/blog/${slugStr}`;

  // 一般用戶（包括 LINE 內建瀏覽器）：fetch index.html 並返回
  if (!isCrawler(userAgent)) {
    try {
      // 從 Vercel 靜態檔案取得 index.html
      const indexHtmlResponse = await fetch('https://ultra-advisor.tw/index.html');
      let indexHtml = await indexHtmlResponse.text();

      // 注入 __BLOG_ROUTE__ flag，讓 main.tsx 知道要渲染 BlogPage
      indexHtml = indexHtml.replace(
        '<script>',
        '<script>window.__BLOG_ROUTE__ = true;</script><script>'
      );

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.status(200).send(indexHtml);
    } catch (error) {
      // 如果 fetch 失敗，返回簡單的重導向頁面
      const fallbackHtml = `<!DOCTYPE html>
<html><head>
<meta http-equiv="refresh" content="0;url=/index.html#/blog/${slugStr}">
<script>window.location.href = '/index.html';</script>
</head><body>正在載入...</body></html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(fallbackHtml);
    }
    return;
  }

  // 分類中文名稱對照
  const categoryNames: Record<string, string> = {
    mortgage: '房貸知識',
    retirement: '退休規劃',
    tax: '稅務傳承',
    investment: '投資理財',
    tools: '工具教學',
    sales: '理財觀點',
  };
  const categoryName = categoryNames[finalArticle.category] || '理財知識';

  // 爬蟲：返回帶有完整 OG meta + JSON-LD 的靜態 HTML
  const crawlerHtml = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${finalArticle.title} | Ultra Advisor 知識庫</title>
  <meta name="description" content="${finalArticle.description}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <meta name="author" content="Ultra Advisor">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${fullUrl}">
  <meta property="og:title" content="${finalArticle.title}">
  <meta property="og:description" content="${finalArticle.description}">
  <meta property="og:image" content="https://ultra-advisor.tw/${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${finalArticle.title}">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:site_name" content="Ultra Advisor">
  <meta property="article:published_time" content="${finalArticle.publishDate}T00:00:00+08:00">
  <meta property="article:modified_time" content="${finalArticle.publishDate}T00:00:00+08:00">
  <meta property="article:section" content="${categoryName}">
  <meta property="article:publisher" content="https://ultra-advisor.tw">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${fullUrl}">
  <meta name="twitter:title" content="${finalArticle.title}">
  <meta name="twitter:description" content="${finalArticle.description}">
  <meta name="twitter:image" content="https://ultra-advisor.tw/${ogImage}">
  <meta name="twitter:image:alt" content="${finalArticle.title}">

  <link rel="canonical" href="${fullUrl}">
  <link rel="alternate" hreflang="zh-TW" href="${fullUrl}">

  <!-- Article JSON-LD（AEO 核心 — 讓 AI 搜尋引擎理解文章結構） -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${finalArticle.title}",
    "description": "${finalArticle.description}",
    "url": "${fullUrl}",
    "image": "https://ultra-advisor.tw/${ogImage}",
    "datePublished": "${finalArticle.publishDate}",
    "dateModified": "${finalArticle.publishDate}",
    "author": {
      "@type": "Organization",
      "name": "Ultra Advisor",
      "url": "https://ultra-advisor.tw"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Ultra Advisor",
      "logo": {
        "@type": "ImageObject",
        "url": "https://ultra-advisor.tw/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "${fullUrl}"
    },
    "articleSection": "${categoryName}",
    "inLanguage": "zh-TW",
    "speakable": {
      "@type": "SpeakableSpecification",
      "cssSelector": ["h1", "meta[name='description']"]
    }
  }
  </script>

  <!-- BreadcrumbList JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "首頁",
        "item": "https://ultra-advisor.tw/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "知識庫",
        "item": "https://ultra-advisor.tw/blog"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "${categoryName}",
        "item": "https://ultra-advisor.tw/blog?category=${finalArticle.category}"
      },
      {
        "@type": "ListItem",
        "position": 4,
        "name": "${finalArticle.title}",
        "item": "${fullUrl}"
      }
    ]
  }
  </script>
</head>
<body>
  <article>
    <h1>${finalArticle.title}</h1>
    <p>${finalArticle.description}</p>
    <p>分類：${categoryName}</p>
    <p>閱讀完整文章：<a href="${fullUrl}">${fullUrl}</a></p>
    <p>更多理財知識：<a href="https://ultra-advisor.tw/blog">Ultra Advisor 知識庫</a></p>
  </article>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(crawlerHtml);
}
