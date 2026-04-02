import React from 'react';
import { X } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  isReferral: boolean;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, isReferral }) => {
  if (!isOpen) return null;

  const iframeUrl = isReferral
    ? 'https://portaly.cc/embed/GinRollBT/product/hF1hHcEGbsp5VlbRsKWI'
    : 'https://portaly.cc/embed/GinRollBT/product/WsaTvEYOA1yqAQYzVZgy';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h3 className="text-lg font-black text-white">
              {isReferral ? '好友推薦價' : '年度訂閱'}
            </h3>
            <p className="text-xs text-slate-400">
              {isReferral ? '365 天 - $8,000（已折 $999）' : '365 天 - $8,999'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-xl transition-all">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        <div className="w-full" style={{ height: '620px' }}>
          <iframe src={iframeUrl} width="100%" height="100%" style={{ border: 0 }} loading="lazy" title="付款頁面" />
        </div>
        <div className="p-3 border-t border-slate-700 bg-slate-800/50">
          <p className="text-[10px] text-slate-500 text-center">付款完成後系統將自動開通會員權限</p>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
