/**
 * 標準化理賠摘要建構
 * 將 ClaimSummary 轉換為雙欄顯示格式
 */
import type { ClaimSummary } from '../types/insurance';

export interface ClaimDisplayItem {
  label: string;
  value: string;
  category: string;
}

/**
 * 將 ClaimSummary 轉為顯示用的扁平列表
 */
export function buildClaimDisplayItems(cs: ClaimSummary): ClaimDisplayItem[] {
  const items: ClaimDisplayItem[] = [];

  const fmt = (n: number | undefined) => {
    if (!n) return null;
    if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)} 萬`;
    return n.toLocaleString();
  };

  // 一次金
  if (cs.lumpSum) {
    const ls = cs.lumpSum;
    if (ls.death) items.push({ label: '身故保險金', value: `${fmt(ls.death)}`, category: '一次金' });
    if (ls.accidentDeath) items.push({ label: '意外身故', value: `${fmt(ls.accidentDeath)}`, category: '一次金' });
    if (ls.totalDisability) items.push({ label: '完全失能', value: `${fmt(ls.totalDisability)}`, category: '一次金' });
    if (ls.criticalIllness) items.push({ label: '重大疾病', value: `${fmt(ls.criticalIllness)}`, category: '一次金' });
    if (ls.criticalIllnessLight) items.push({ label: '輕症一次金', value: `${fmt(ls.criticalIllnessLight)}`, category: '一次金' });
    if (ls.majorInjury) items.push({ label: '重大傷病', value: `${fmt(ls.majorInjury)}`, category: '一次金' });
    if (ls.cancer) items.push({ label: '初次罹癌', value: `${fmt(ls.cancer)}`, category: '一次金' });
    if (ls.cancerLight) items.push({ label: '輕度癌症', value: `${fmt(ls.cancerLight)}`, category: '一次金' });
    if (ls.burn) items.push({ label: '燒燙傷', value: `${fmt(ls.burn)}`, category: '一次金' });
    if (ls.bone) items.push({ label: '骨折', value: `${fmt(ls.bone)}`, category: '一次金' });
  }

  // 住院日額
  if (cs.hospitalDaily) {
    const hd = cs.hospitalDaily;
    if (hd.illness) items.push({ label: '疾病住院日額', value: `${fmt(hd.illness)}/日`, category: '住院日額' });
    if (hd.accident) items.push({ label: '意外住院日額', value: `${fmt(hd.accident)}/日`, category: '住院日額' });
    if (hd.icu) items.push({ label: '加護病房', value: `${fmt(hd.icu)}/日`, category: '住院日額' });
    if (hd.cancer) items.push({ label: '癌症住院', value: `${fmt(hd.cancer)}/日`, category: '住院日額' });
    if (hd.maxDays) items.push({ label: '最高給付天數', value: `${hd.maxDays} 天`, category: '住院日額' });
  }

  // 實支實付
  if (cs.actualExpense) {
    const ae = cs.actualExpense;
    if (ae.roomDaily) items.push({ label: '病房費限額', value: `${fmt(ae.roomDaily)}/日`, category: '實支實付' });
    if (ae.medicalExpense) items.push({ label: '醫療雜費限額', value: `${fmt(ae.medicalExpense)}`, category: '實支實付' });
    if (ae.surgeryInpatient) items.push({ label: '手術費（住院）', value: `${fmt(ae.surgeryInpatient)}`, category: '實支實付' });
    if (ae.surgeryOutpatient) items.push({ label: '手術費（門診）', value: `${fmt(ae.surgeryOutpatient)}`, category: '實支實付' });
    if (ae.isCopyReceipt) items.push({ label: '收據副本理賠', value: '可', category: '實支實付' });
  }

  // 手術
  if (cs.surgery) {
    items.push({
      label: '手術給付方式',
      value: cs.surgery.type === 'table' ? '手術列表'
        : cs.surgery.type === 'ratio' ? `倍數制（最高 ${cs.surgery.maxMultiplier}x）`
        : '實支實付',
      category: '手術',
    });
  }

  // 意外醫療
  if (cs.accidentMedical) {
    const am = cs.accidentMedical;
    if (am.actualExpense) items.push({ label: '意外醫療實支', value: `${fmt(am.actualExpense)}`, category: '意外醫療' });
    if (am.daily) items.push({ label: '意外醫療日額', value: `${fmt(am.daily)}/日`, category: '意外醫療' });
  }

  // 長照
  if (cs.longTermCare) {
    const ltc = cs.longTermCare;
    if (ltc.monthly) items.push({ label: '長照月給付', value: `${fmt(ltc.monthly)}/月`, category: '長照' });
    if (ltc.maxYears) items.push({ label: '最高給付年限', value: `${ltc.maxYears} 年`, category: '長照' });
    items.push({ label: '啟動條件', value: ltc.trigger, category: '長照' });
  }

  // 豁免
  if (cs.waiver?.hasWaiver) {
    items.push({ label: '豁免條件', value: cs.waiver.trigger, category: '豁免' });
    items.push({ label: '豁免範圍', value: cs.waiver.scope, category: '豁免' });
  }

  // 滿期
  if (cs.maturity) {
    items.push({
      label: '滿期金',
      value: cs.maturity.description || (cs.maturity.amount ? `${fmt(cs.maturity.amount)}` : cs.maturity.type),
      category: '滿期/生存',
    });
  }

  return items;
}

/**
 * 依類別分組
 */
export function groupByCategory(items: ClaimDisplayItem[]): Record<string, ClaimDisplayItem[]> {
  const grouped: Record<string, ClaimDisplayItem[]> = {};
  items.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });
  return grouped;
}
