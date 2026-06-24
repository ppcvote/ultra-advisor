import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

// Disclaimer footer used by the 14 calculator tools.
// Designed to be drop-in: `<DisclaimerFooter scope="insurance" />` is enough.
// We keep one universal sentence + an optional scope-specific extra so each
// tool isn't tempted to roll its own wording (consistency > brevity here,
// because legal text drifts otherwise).

export type DisclaimerScope = 'calc' | 'insurance' | 'tax' | 'investment' | 'estate';

interface DisclaimerFooterProps {
  scope?: DisclaimerScope;
  closable?: boolean;
  className?: string;
  // Static badge — bump when the underlying data sources are reviewed.
  // Keep this in sync with major tax-bracket / interest-rate refresh cycles.
  dataAsOf?: string;
}

const BASE_TEXT =
  '本試算結果基於使用者輸入參數，僅供教育與規劃參考，不構成投資建議或保險商品推薦。實際數據以主管機關公告為準。';

const SCOPE_EXTRA: Record<Exclude<DisclaimerScope, 'calc'>, string> = {
  insurance: '保險商品之保障範圍、理賠條件以保單條款為準。投保前請詳閱條款。',
  tax: '稅法級距及免稅額逐年微調，請以財政部當年度公告為準。',
  investment: '過去績效不代表未來表現。投資有風險，可能損失本金。',
  estate: '遺贈稅及法定繼承順序依民法及遺贈稅法規定。實際案例請洽會計師或律師。',
};

const DisclaimerFooter: React.FC<DisclaimerFooterProps> = ({
  scope = 'calc',
  closable = false,
  className = '',
  dataAsOf = '2026-06',
}) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const extra = scope !== 'calc' ? SCOPE_EXTRA[scope] : null;

  return (
    <div
      className={`mt-6 px-4 py-3 rounded-md bg-slate-900/40 border border-slate-700/60 text-slate-400 text-xs leading-relaxed ${className}`}
      role="note"
      aria-label="免責聲明"
    >
      <div className="flex gap-2.5">
        <Info size={14} className="flex-shrink-0 mt-0.5 text-slate-500" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p>
            <span className="font-medium text-slate-300">免責聲明：</span>
            {BASE_TEXT}
          </p>
          {extra && <p className="mt-1.5">{extra}</p>}
          <div className="mt-2 flex items-center flex-wrap gap-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-[10px] text-slate-400 font-mono">
              資料更新至 {dataAsOf}
            </span>
          </div>
        </div>
        {closable && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 p-1 -m-1 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="關閉免責聲明"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default DisclaimerFooter;
