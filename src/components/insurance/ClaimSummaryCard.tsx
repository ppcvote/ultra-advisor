/**
 * 標準化理賠摘要卡片（雙欄排版）
 */
import React from 'react';
import type { ClaimSummary } from '../../types/insurance';
import { buildClaimDisplayItems, groupByCategory } from '../../utils/claimSummaryBuilder';

interface ClaimSummaryCardProps {
  coverageName: string;
  claimSummary: ClaimSummary;
}

export default function ClaimSummaryCard({ coverageName, claimSummary }: ClaimSummaryCardProps) {
  const items = buildClaimDisplayItems(claimSummary);
  const grouped = groupByCategory(items);

  if (items.length === 0) {
    return (
      <div className="p-4 bg-slate-50 rounded-xl border text-center text-sm text-slate-400">
        尚無理賠摘要資料
      </div>
    );
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* 標題 */}
      <div className="px-4 py-2.5 bg-slate-50 border-b">
        <h4 className="font-medium text-slate-700 text-sm">{coverageName}</h4>
      </div>

      {/* 分類內容 */}
      <div className="divide-y">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category} className="px-4 py-3">
            <div className="text-xs font-medium text-slate-400 mb-2">{category}</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {categoryItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{item.label}</span>
                  <span className="text-xs font-medium text-slate-700">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
