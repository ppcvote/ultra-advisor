/**
 * Ultra Advisor - 推播通知開關元件
 * 讓用戶可以訂閱/取消訂閱推播通知
 */

import React, { useState } from 'react';
import { Bell, BellOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface PushNotificationToggleProps {
  userId: string | null;
  compact?: boolean;
}

const PushNotificationToggle: React.FC<PushNotificationToggleProps> = ({
  userId,
  compact = false,
}) => {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications(userId);

  const [showSuccess, setShowSuccess] = useState(false);

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      const success = await subscribe();
      if (success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    }
  };

  // 不支援推播
  if (!isSupported) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <BellOff size={16} />
        <span>您的瀏覽器不支援推播通知</span>
      </div>
    );
  }

  // 權限被拒絕
  if (permission === 'denied') {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 text-amber-500 text-sm">
        <AlertCircle size={16} />
        <span>通知權限已被封鎖，請在瀏覽器設定中開啟</span>
      </div>
    );
  }

  // 精簡模式
  if (compact) {
    return (
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`p-2 rounded-lg transition-all ${
          isSubscribed
            ? 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30'
            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
        }`}
        title={isSubscribed ? '已開啟推播通知' : '開啟推播通知'}
      >
        {isLoading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : isSubscribed ? (
          <Bell size={18} className="text-purple-400" />
        ) : (
          <BellOff size={18} />
        )}
      </button>
    );
  }

  // 完整模式
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            isSubscribed ? 'bg-purple-600/20' : 'bg-slate-800'
          }`}>
            {isSubscribed ? (
              <Bell size={20} className="text-purple-400" />
            ) : (
              <BellOff size={20} className="text-slate-400" />
            )}
          </div>
          <div>
            <h4 className="text-white font-medium">推播通知</h4>
            <p className="text-slate-500 text-sm">
              {isSubscribed ? '已開啟 - 會收到系統通知' : '開啟後可收到重要通知'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            isSubscribed
              ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              : 'bg-purple-600 text-white hover:bg-purple-500'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>處理中...</span>
            </>
          ) : isSubscribed ? (
            <>
              <BellOff size={16} />
              <span>關閉</span>
            </>
          ) : (
            <>
              <Bell size={16} />
              <span>開啟</span>
            </>
          )}
        </button>
      </div>

      {/* 成功訊息 */}
      {showSuccess && (
        <div className="mt-3 flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
          <CheckCircle size={16} />
          <span>已成功開啟推播通知！</span>
        </div>
      )}

      {/* 錯誤訊息 */}
      {error && (
        <div className="mt-3 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default PushNotificationToggle;
