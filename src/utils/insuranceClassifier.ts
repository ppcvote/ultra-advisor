/**
 * 保單健診系統 - 險種自動分類
 * 使用關鍵字比對自動判斷險種分類
 */

import { InsuranceCategory } from '../types/insurance';

// 各分類的關鍵字
const CATEGORY_KEYWORDS: Record<InsuranceCategory, string[]> = {
  life: [
    '壽險', '定期壽', '終身壽', '投資型壽', '萬能壽', '變額壽',
    '定期保險', '終身保險', '人壽', '身故', '生存保險金',
  ],
  medical: [
    '醫療', '住院', '手術', '實支實付', '日額', '健康險',
    '住院醫療', '門診', '雜費', '病房', '自負額', '醫療費用',
    '手術費', '住院費',
  ],
  accident: [
    '意外', '傷害', '意外險', '意外傷害', '旅平險', '意外醫療',
    '意外身故', '意外失能', '交通事故',
  ],
  cancer: [
    '癌症', '防癌', '重大疾病', '重大傷病', '特定傷病',
    '嚴重特定傷病', '重疾', '標靶', '化療',
  ],
  disability: [
    '失能', '殘廢', '長照', '失能險', '長期照顧', '殘扶',
    '失能扶助', '長看', '長期照護',
  ],
  savings: [
    '儲蓄', '投資型', '年金', '還本', '利變', '養老',
    '增額', '分紅', '萬能', '變額年金', '投資連結',
    '儲蓄險', '利率變動',
  ],
};

// 台灣常見保險公司
export const TAIWAN_INSURANCE_COMPANIES = [
  '國泰人壽', '富邦人壽', '南山人壽', '新光人壽', '中國人壽',
  '台灣人壽', '三商美邦', '遠雄人壽', '全球人壽', '宏泰人壽',
  '安聯人壽', '第一金人壽', '元大人壽', '合作金庫人壽', '臺銀人壽',
  '保誠人壽', '法國巴黎人壽', '友邦人壽', '凱基人壽', '康健人壽',
  // 產險
  '國泰產險', '富邦產險', '新光產險', '明台產險', '旺旺友聯產險',
  '華南產險', '新安東京海上', '泰安產險', '兆豐產險', '第一產險',
];

/**
 * 根據險種名稱自動分類
 */
export const classifyInsurance = (productName: string): InsuranceCategory => {
  const name = productName.toLowerCase();
  let bestMatch: InsuranceCategory = 'life'; // 預設壽險
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (name.includes(keyword.toLowerCase())) {
        score += keyword.length; // 越長的關鍵字權重越高
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = category as InsuranceCategory;
    }
  }

  return bestMatch;
};

/**
 * 從 OCR 原始文字解析保單資料
 * 台灣保單格式多樣，需要寬鬆匹配
 */
export const parseOCRText = (rawText: string): Partial<Record<string, string>> => {
  const result: Record<string, string> = {};
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = lines.join(' ');
  // 也保留換行版本，用於跨行匹配
  const fullTextNL = lines.join('\n');

  // ─── 保單號碼 ───
  // 格式非常多：保單號碼、保單編號、保單字號、證號、契約號碼
  // 常見格式：英文+數字 或 純數字 (至少6位)
  const policyNumPatterns = [
    /(?:保單|保險單|契約|保險契約)(?:號碼|編號|字號|號)[：:.\s]*([A-Za-z0-9][\w\-]{4,20})/,
    /(?:證號|證書號碼)[：:.\s]*([A-Za-z0-9][\w\-]{4,20})/,
    /(?:保單|契約)\s*(?:號碼|編號|號)\s*[：:.\s]*([A-Za-z0-9][\w\-]{4,20})/,
    /(?:POLICY\s*NO|Policy\s*Number)[.：:\s]*([A-Za-z0-9][\w\-]{4,20})/i,
    // 單獨一行看起來像保單號碼的 (英文開頭+數字，至少7碼)
    /\b([A-Z]{1,3}\d{6,15})\b/,
  ];
  for (const pattern of policyNumPatterns) {
    const m = fullText.match(pattern);
    if (m) { result.policyNumber = m[1].trim(); break; }
  }

  // ─── 保險公司 ───
  for (const company of TAIWAN_INSURANCE_COMPANIES) {
    if (fullText.includes(company)) {
      result.insuranceCompany = company;
      break;
    }
  }
  // 若沒匹配到完整名稱，嘗試部分名稱
  if (!result.insuranceCompany) {
    const shortNames = [
      { short: '國泰', full: '國泰人壽' }, { short: '富邦', full: '富邦人壽' },
      { short: '南山', full: '南山人壽' }, { short: '新光', full: '新光人壽' },
      { short: '中壽', full: '中國人壽' }, { short: '中國人壽', full: '中國人壽' },
      { short: '台灣人壽', full: '台灣人壽' }, { short: '台壽', full: '台灣人壽' },
      { short: '三商', full: '三商美邦' }, { short: '遠雄', full: '遠雄人壽' },
      { short: '全球', full: '全球人壽' }, { short: '宏泰', full: '宏泰人壽' },
      { short: '安聯', full: '安聯人壽' }, { short: '元大', full: '元大人壽' },
      { short: '保誠', full: '保誠人壽' }, { short: '友邦', full: '友邦人壽' },
      { short: '凱基', full: '凱基人壽' }, { short: '康健', full: '康健人壽' },
      { short: '明台', full: '明台產險' }, { short: '旺旺', full: '旺旺友聯產險' },
    ];
    for (const { short, full } of shortNames) {
      if (fullText.includes(short)) {
        result.insuranceCompany = full;
        break;
      }
    }
  }

  // ─── 被保人 ───
  const insuredPatterns = [
    /被保[險]?人[：:.\s]*[姓名：:.\s]*([^\s,，：:]{2,5})/,
    /被保[險]?人\s*[（(]?\s*姓名\s*[）)]?[：:.\s]*([^\s,，：:]{2,5})/,
    /被\s*保\s*人[：:.\s]*([^\s,，：:]{2,5})/,
  ];
  for (const pattern of insuredPatterns) {
    const m = fullText.match(pattern);
    if (m) { result.insuredPerson = m[1].trim(); break; }
  }

  // ─── 要保人 ───
  const holderPatterns = [
    /要保人[：:.\s]*[姓名：:.\s]*([^\s,，：:]{2,5})/,
    /要\s*保\s*人[：:.\s]*([^\s,，：:]{2,5})/,
    /投保人[：:.\s]*([^\s,，：:]{2,5})/,
  ];
  for (const pattern of holderPatterns) {
    const m = fullText.match(pattern);
    if (m) { result.policyholder = m[1].trim(); break; }
  }

  // ─── 受益人 ───
  const beneficiaryPatterns = [
    /受益人[：:.\s]*([^\s,，\n]{2,10})/,
    /身故受益人[：:.\s]*([^\s,，\n]{2,10})/,
    /滿期受益人[：:.\s]*([^\s,，\n]{2,10})/,
  ];
  for (const pattern of beneficiaryPatterns) {
    const m = fullText.match(pattern);
    if (m) { result.beneficiary = m[1].trim(); break; }
  }

  // ─── 險種名稱 / 商品名稱 ───
  const productPatterns = [
    /(?:險種|商品|保險|契約|主約|附約)(?:名稱|名)[：:.\s]*([^\n,，]{3,40})/,
    /(?:保險種類|保險名稱|保障項目|險別)[：:.\s]*([^\n,，]{3,40})/,
    /(?:主約|附約)[：:.\s]*([^\n,，]{3,40})/,
    // 嘗試匹配含有「險」字的連續中文（可能是險種名）
    /([\u4e00-\u9fff]{2,}(?:壽險|醫療險|意外險|傷害險|防癌險|失能險|年金險|健康險|終身險|定期險|儲蓄險|投資型保險|還本保險))/,
  ];
  for (const pattern of productPatterns) {
    const m = fullText.match(pattern);
    if (m) {
      const cleaned = m[1].trim().replace(/[：:]/g, '');
      if (cleaned.length >= 3) {
        result.productName = cleaned;
        break;
      }
    }
  }

  // ─── 保額 / 保險金額 ───
  const coveragePatterns = [
    /(?:保[險]?額|保險金額|保額合計|投保金額)[：:.\s]*(?:NT\$?|新?台?幣?)?\s*[元]?\s*([\d,]+)/,
    /(?:保[險]?額|保險金額)[（(]?[^)）]*[）)]?[：:.\s]*(?:NT\$?|新?台?幣?)?\s*([\d,]+)/,
    /(?:基本保額|主約保額)[：:.\s]*(?:NT\$?|新?台?幣?)?\s*([\d,]+)/,
    /保\s*額[：:.\s]*(?:NT\$?|新?台?幣?)?\s*([\d,]+)/,
    // 金額在「保額」後方的另一行
    /保額\s*\n\s*(?:NT\$?|新?台?幣?)?([\d,]+)/,
  ];
  for (const pattern of coveragePatterns) {
    const m = (pattern.source.includes('\\n') ? fullTextNL : fullText).match(pattern);
    if (m) {
      const num = m[1].replace(/,/g, '');
      if (parseInt(num) >= 1000) { // 保額至少千元以上才合理
        result.coverageAmount = num;
        break;
      }
    }
  }

  // ─── 保費 ───
  const premiumPatterns = [
    /(?:年繳?保費|每年保費|應繳保費|首年保費|續年保費|保險費|繳費金額)[：:.\s]*(?:NT\$?|新?台?幣?)?\s*([\d,]+)/,
    /保\s*費[：:.\s]*(?:NT\$?|新?台?幣?)?\s*([\d,]+)/,
    /(?:年繳|半年繳|季繳|月繳)[：:.\s]*(?:NT\$?|新?台?幣?)?\s*([\d,]+)/,
    /(?:合計保費|總保費|應繳總額)[：:.\s]*(?:NT\$?|新?台?幣?)?\s*([\d,]+)/,
  ];
  for (const pattern of premiumPatterns) {
    const m = fullText.match(pattern);
    if (m) {
      const num = m[1].replace(/,/g, '');
      if (parseInt(num) >= 100) { // 保費至少百元以上才合理
        result.annualPremium = num;
        break;
      }
    }
  }

  // ─── 生效日 ───
  const datePatterns = [
    // 民國年：113年01月15日、113/01/15、113.01.15
    /(?:生效|起保|保險期間自|契約始期|始期|起始日|保險起期)[日期：:.\s]*(1\d{2})[\/\-.年]\s*(\d{1,2})[\/\-.月]\s*(\d{1,2})[日]?/,
    // 西元年：2024年01月15日、2024/01/15
    /(?:生效|起保|保險期間自|契約始期|始期|起始日|保險起期)[日期：:.\s]*(20\d{2})[\/\-.年]\s*(\d{1,2})[\/\-.月]\s*(\d{1,2})[日]?/,
    // 更寬鬆：「生效日」後面的日期
    /(?:生效日期?|起保日)[：:.\s]*(1\d{2})[\/\-.年]\s*(\d{1,2})[\/\-.月]\s*(\d{1,2})/,
    /(?:生效日期?|起保日)[：:.\s]*(20\d{2})[\/\-.年]\s*(\d{1,2})[\/\-.月]\s*(\d{1,2})/,
    // 中華民國 xxx 年
    /中華民國\s*(1\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
  ];
  for (const pattern of datePatterns) {
    const m = fullText.match(pattern);
    if (m) {
      let year = parseInt(m[1]);
      const month = m[2].padStart(2, '0');
      const day = m[3].padStart(2, '0');
      // 民國年轉西元年
      if (year < 200) year += 1911;
      result.effectiveDate = `${year}-${month}-${day}`;
      break;
    }
  }
  // 如果上面都沒匹配到，嘗試找任何看起來像台灣日期的格式
  if (!result.effectiveDate) {
    const looseDateMatch = fullText.match(/(1\d{2})[\/\-.年]\s*(\d{1,2})[\/\-.月]\s*(\d{1,2})/);
    if (looseDateMatch) {
      const year = parseInt(looseDateMatch[1]) + 1911;
      const month = looseDateMatch[2].padStart(2, '0');
      const day = looseDateMatch[3].padStart(2, '0');
      result.effectiveDate = `${year}-${month}-${day}`;
    }
  }

  // ─── 繳費年期 ───
  const periodPatterns = [
    /繳費年期[：:.\s]*([\d]+)\s*年/,
    /繳費期間[：:.\s]*([\d]+)\s*年/,
    /([\d]+)\s*年期/,
    /繳費\s*([\d]+)\s*年/,
  ];
  for (const pattern of periodPatterns) {
    const m = fullText.match(pattern);
    if (m) { result.paymentPeriodYears = m[1]; break; }
  }

  // ─── 繳費方式 ───
  if (fullText.includes('年繳') || fullText.includes('每年')) result.paymentMethod = 'annual';
  else if (fullText.includes('半年繳') || fullText.includes('半年')) result.paymentMethod = 'semi_annual';
  else if (fullText.includes('季繳') || fullText.includes('每季')) result.paymentMethod = 'quarterly';
  else if (fullText.includes('月繳') || fullText.includes('每月')) result.paymentMethod = 'monthly';
  else if (fullText.includes('躉繳') || fullText.includes('一次繳')) result.paymentMethod = 'single';

  return result;
};
