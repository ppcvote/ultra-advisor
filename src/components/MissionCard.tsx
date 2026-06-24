/**
 * Ultra Advisor - 任務卡片元件
 * 顯示當前任務，點擊可執行任務
 *
 * 檔案位置：src/components/MissionCard.tsx
 */

import React, { useState } from 'react';
import { ChevronRight, Check, Gift, Loader2 } from 'lucide-react';
import { useMissions, Mission } from '../hooks/useMissions';

interface MissionCardProps {
  onOpenModal?: (modalName: string) => void;
  onNavigate?: (path: string) => void;
  onOpenPWAInstall?: () => void;
  // If provided, render this specific mission instead of `currentMission`
  // from the hook. Lets OverviewTab show the full 8-mission list while
  // reusing the existing single-card click/complete plumbing.
  mission?: Mission;
}

// 分類中文名稱
const categoryNames: Record<string, string> = {
  onboarding: '新手任務',
  social: '社交任務',
  habit: '習慣任務',
  daily: '每日任務',
};

// 分類顏色（邊框/高亮用）
const categoryBorderColors: Record<string, string> = {
  onboarding: 'border-emerald-500/50 hover:border-emerald-400',
  social: 'border-blue-500/50 hover:border-blue-400',
  habit: 'border-purple-500/50 hover:border-purple-400',
  daily: 'border-amber-500/50 hover:border-amber-400',
};

// 分類圖示背景色
const categoryIconBg: Record<string, string> = {
  onboarding: 'bg-emerald-500/20',
  social: 'bg-blue-500/20',
  habit: 'bg-purple-500/20',
  daily: 'bg-amber-500/20',
};

// 分類標籤顏色
const categoryTagColors: Record<string, string> = {
  onboarding: 'text-emerald-400 bg-emerald-500/20',
  social: 'text-blue-400 bg-blue-500/20',
  habit: 'text-purple-400 bg-purple-500/20',
  daily: 'text-amber-400 bg-amber-500/20',
};

const MissionCard: React.FC<MissionCardProps> = ({
  onOpenModal,
  onNavigate,
  onOpenPWAInstall,
  mission: missionProp,
}) => {
  const { currentMission, allCompleted, loading, completeMission } = useMissions();
  const [completing, setCompleting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);

  // 錯誤訊息狀態
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 處理任務點擊
  const handleMissionClick = async (mission: Mission) => {
    if (completing) return;

    setErrorMsg(null);

    // 對於外部連結，必須立即開啟（避免 popup blocker）
    // 不管是 auto 還是 manual 驗證，都先開啟連結
    if (mission.linkType === 'external' && mission.linkTarget) {
      const link = document.createElement('a');
      link.href = mission.linkTarget;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 對於手動驗證的外部連結，延遲後自動嘗試完成任務
      if (mission.verificationType === 'manual') {
        setTimeout(() => handleManualComplete(mission), 2000);
      }
      // 對於自動驗證的外部連結，延遲後嘗試驗證
      else if (mission.verificationType === 'auto') {
        setTimeout(async () => {
          try {
            const result = await completeMission(mission.id);
            if (result?.success) {
              setEarnedPoints(result.pointsAwarded || 0);
              setShowSuccess(true);
              setTimeout(() => setShowSuccess(false), 3000);
            }
          } catch (error) {
            // 自動驗證失敗不顯示錯誤（用戶可能還沒完成操作）
            console.log('Auto verification pending:', error);
          }
        }, 3000);
      }
      return;
    }

    // 對於非外部連結的自動驗證任務，先嘗試完成（可能用戶已經完成條件）
    if (mission.verificationType === 'auto') {
      setCompleting(true);
      try {
        const result = await completeMission(mission.id);
        if (result?.success) {
          setEarnedPoints(result.pointsAwarded || 0);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
          setCompleting(false);
          return; // 任務完成，不需要開啟 Modal
        } else {
          // 顯示失敗原因
          setErrorMsg(result?.message || '驗證失敗');
          setTimeout(() => setErrorMsg(null), 3000);
        }
      } catch (error: any) {
        setErrorMsg(error?.message || '發生錯誤');
        setTimeout(() => setErrorMsg(null), 3000);
      }
      setCompleting(false);
    }

    // 根據連結類型執行不同操作
    switch (mission.linkType) {
      case 'modal':
        if (onOpenModal && mission.linkTarget) {
          onOpenModal(mission.linkTarget);
        }
        break;

      case 'internal':
        if (onNavigate && mission.linkTarget) {
          onNavigate(mission.linkTarget);
        }
        break;

      // external 已在上面處理，這裡保留以防萬一
      case 'external':
        break;

      case 'pwa':
        if (onOpenPWAInstall) {
          onOpenPWAInstall();
        }
        break;

      default:
        // 無連結類型（如每日登入），已在上面處理
        break;
    }
  };

  // 自動驗證完成
  const handleAutoComplete = async (mission: Mission) => {
    setCompleting(true);
    try {
      const result = await completeMission(mission.id);
      if (result?.success) {
        setEarnedPoints(result.pointsAwarded || 0);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Auto complete error:', error);
    } finally {
      setCompleting(false);
    }
  };

  // 手動確認完成
  const handleManualComplete = async (mission: Mission) => {
    setCompleting(true);
    try {
      const result = await completeMission(mission.id);
      if (result?.success) {
        setEarnedPoints(result.pointsAwarded || 0);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      // 可能還沒完成條件，靜默失敗
      console.log('Manual complete not ready:', error);
    } finally {
      setCompleting(false);
    }
  };

  // When parent passes an explicit mission, skip the single-card empty/done
  // branches — list-mode rendering owns those states at a higher level.
  if (!missionProp) {
    // 載入中狀態
    if (loading && !currentMission) {
      return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">載入任務中...</span>
          </div>
        </div>
      );
    }

    // 全部完成狀態
    if (allCompleted) {
      return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-emerald-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-emerald-400 font-medium">已完成所有任務！</p>
              <p className="text-slate-500 text-sm">持續使用系統獲得更多獎勵</p>
            </div>
            <Gift className="w-5 h-5 text-emerald-400/70" />
          </div>
        </div>
      );
    }

    // 無任務狀態 - 顯示佔位卡片
    if (!currentMission) {
      return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center">
              <Gift className="w-5 h-5 text-slate-500" />
            </div>
            <div className="flex-1">
              <p className="text-slate-400 font-medium">任務系統</p>
              <p className="text-slate-500 text-sm">目前沒有可用任務</p>
            </div>
          </div>
        </div>
      );
    }
  }

  // Prefer the explicit mission prop (list mode); fall back to the hook's
  // "next uncompleted" current mission (legacy single-card mode).
  const mission = missionProp || currentMission;
  if (!mission) return null;

  // Already-completed missions render as a static checkmark row — no click,
  // no completion logic, just visual progress in the list.
  const isDone = mission.repeatType === 'once'
    ? !!mission.isCompleted
    : !!mission.isCompletedToday;
  const borderClass = categoryBorderColors[mission.category] || 'border-slate-500/50';
  const iconBgClass = categoryIconBg[mission.category] || 'bg-slate-500/20';
  const tagClass = categoryTagColors[mission.category] || 'text-slate-400 bg-slate-500/20';

  if (isDone) {
    return (
      <div className="bg-slate-800/30 rounded-xl p-3 border border-emerald-500/20 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
          <Check className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-300 text-sm font-medium truncate line-through decoration-slate-600">
            {mission.title}
          </p>
        </div>
        <div className="text-emerald-400/80 text-xs font-bold shrink-0">+{mission.points} UA</div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 成功提示 */}
      {showSuccess && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce z-10">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span className="font-medium">+{earnedPoints} UA</span>
          </div>
        </div>
      )}

      {/* 錯誤提示 */}
      {errorMsg && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-10">
          <span className="text-sm">{errorMsg}</span>
        </div>
      )}

      {/* 任務卡片 - 深色風格 */}
      <button
        onClick={() => handleMissionClick(mission)}
        disabled={completing}
        className={`
          w-full text-left
          bg-slate-800/50 backdrop-blur-sm
          rounded-xl p-4
          border ${borderClass}
          transition-all duration-200
          hover:bg-slate-800/70
          active:scale-[0.99]
          disabled:opacity-70 disabled:cursor-not-allowed
        `}
      >
        <div className="flex items-center gap-3">
          {/* 任務圖示 */}
          <div className={`w-12 h-12 rounded-xl ${iconBgClass} flex items-center justify-center text-2xl flex-shrink-0`}>
            {mission.icon}
          </div>

          {/* 任務內容 */}
          <div className="flex-1 min-w-0">
            {/* 分類標籤 */}
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs ${tagClass} px-2 py-0.5 rounded-full`}>
                {categoryNames[mission.category]}
              </span>
              {mission.repeatType === 'daily' && (
                <span className="text-xs text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                  每日
                </span>
              )}
            </div>

            {/* 任務名稱 */}
            <p className="text-slate-100 font-medium truncate">{mission.title}</p>

            {/* 任務說明 */}
            {mission.description && (
              <p className="text-slate-400 text-sm truncate mt-0.5">{mission.description}</p>
            )}
          </div>

          {/* 獎勵與箭頭 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <span className="text-purple-400 font-bold">+{mission.points}</span>
              <span className="text-slate-400 text-sm ml-1">UA</span>
            </div>
            {completing ? (
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>
      </button>
    </div>
  );
};

export default MissionCard;
