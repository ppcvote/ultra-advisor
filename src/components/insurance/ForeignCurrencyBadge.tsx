/**
 * 外幣保單標示 & 換算
 */
import React, { useState, useEffect } from 'react';
import { Globe, RefreshCw } from 'lucide-react';
import type { CurrencyType } from '../../types/insurance';
import { CURRENCY_LABELS } from '../../types/insurance';

interface ForeignCurrencyBadgeProps {
  currency: CurrencyType;
  amount: number;
  exchangeRate?: number;
}

// 預設匯率（近似值，僅供參考）
const DEFAULT_RATES: Record<CurrencyType, number> = {
  TWD: 1,
  USD: 32.5,
  CNY: 4.5,
  AUD: 21,
  EUR: 35,
  JPY: 0.22,
  GBP: 41,
  HKD: 4.2,
};

export default function ForeignCurrencyBadge({ currency, amount, exchangeRate }: ForeignCurrencyBadgeProps) {
  const rate = exchangeRate || DEFAULT_RATES[currency] || 1;
  const twdAmount = Math.round(amount * rate);

  if (currency === 'TWD') return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
      <Globe size={14} className="text-amber-600" />
      <span className="text-sm text-amber-700">
        外幣保單（{CURRENCY_LABELS[currency]}）
      </span>
      <span className="text-xs text-amber-500">
        約 NT$ {twdAmount.toLocaleString()}
        <span className="text-[10px] ml-1">
          （匯率 {rate}，僅供參考）
        </span>
      </span>
    </div>
  );
}
