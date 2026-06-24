// 🗑️ Stage 9 (2026-06-21): UltraWarRoom 主元件已移除（原 5903-6960，~1057 行）
// App.tsx 自 2025-12 起已改用 ./WarRoom/ folder（新版），舊版整段死碼從未被執行
// 🗑️ Stage 10 (2026-06-24): MarketDataCard 拆到 ./WarRoom/MarketDataCard.tsx，本檔僅保留 re-export
// 此檔案保留只為 export MarketDataCard 給 ShareTab 使用（向後相容路徑）
export { MarketDataCard } from './WarRoom/MarketDataCard';
export type { MarketDataCardProps } from './WarRoom/MarketDataCard';
