// 把日期格式化成 YYYY/MM/DD. 從 dailyQuotes.ts 拆出來,
// 讓 LandingPage / OverviewTab 不必為了顯示日期就 import 整包 365 筆金句.
export const formatDateChinese = (date: Date = new Date()): string => {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
};
