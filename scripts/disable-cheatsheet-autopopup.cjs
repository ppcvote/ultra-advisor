#!/usr/bin/env node
/**
 * 拔掉「業務小抄」auto-popup（品牌核彈級）
 *
 * 問題：每個工具一進入就跳「💡 點三下可開啟業務小抄」氣泡，
 *      客戶看到「業務小抄」四個字 → 顧問關係結束。
 *
 * 修法：把 7 個工具的 useEffect 自動觸發 setShowTripleClickHint(true)
 *      改成永遠不觸發（保留 useEffect 結構，把觸發行註解掉）。
 *      手動三連點仍可用（顧問自己知道）。
 *
 * 觸碰檔案：BigSmallReservoirTool / FinancialRealEstateTool /
 *           FundTimeMachine / MillionDollarGiftTool /
 *           MarketDataZone / TaxPlannerTool / StudentLoanTool
 *
 * 用法：node scripts/disable-cheatsheet-autopopup.cjs
 */
const fs = require('fs');
const path = require('path');

const FILES = [
  'src/components/BigSmallReservoirTool.tsx',
  'src/components/FinancialRealEstateTool.tsx',
  'src/components/FundTimeMachine.tsx',
  'src/components/MillionDollarGiftTool.tsx',
  'src/components/MarketDataZone.tsx',
  'src/components/TaxPlannerTool.tsx',
  'src/components/StudentLoanTool.tsx',
];

const ROOT = path.resolve(__dirname, '..');

// 匹配：setShowTripleClickHint(true);
// 換成：/* auto-popup 已關閉（品牌防護）— 顧問用三連點手勢開啟 */
const TRIGGER = /(\s*)setShowTripleClickHint\(true\);/;
const REPLACE = '$1/* auto-popup disabled (brand-safe): use triple-click gesture instead */';

let changed = 0;
for (const rel of FILES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    console.log(`  ⚠️  缺檔：${rel}`);
    continue;
  }
  const before = fs.readFileSync(full, 'utf-8');
  if (!TRIGGER.test(before)) {
    console.log(`  ⏭  ${rel} — 已修過或無 auto-popup`);
    continue;
  }
  const after = before.replace(TRIGGER, (_m, indent) =>
    `${indent}/* auto-popup disabled (brand-safe): use triple-click gesture instead */`
  );
  if (after === before) {
    console.log(`  ⏭  ${rel} — 替換失敗`);
    continue;
  }
  fs.writeFileSync(full, after);
  console.log(`  ✓ ${rel}`);
  changed += 1;
}

console.log(`\n=== 完成 ${changed} / ${FILES.length} 檔案 ===`);
