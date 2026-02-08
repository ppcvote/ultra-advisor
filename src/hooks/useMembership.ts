/**
 * Ultra Advisor - 會員權限控制 Hook
 * 控制工具存取權限
 * 
 * 檔案位置：src/hooks/useMembership.ts
 */

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// 免費/試用會員可用的工具
export const FREE_TOOLS = [
  'reservoir',      // 大小水庫
  'estate',         // 金融房產
  'tax',            // 稅務傳承
];

// 所有工具列表
export const ALL_TOOLS = [
  'golden_safe',    // 黃金保險箱
  'market_data',    // 市場數據
  'fund_machine',   // 基金時光機
  'gift',           // 百萬禮物
  'estate',         // 金融房產
  'student',        // 學貸活化
  'super_active',   // 超積極存錢
  'reservoir',      // 大小水庫
  'car',            // 換車專案
  'pension',        // 退休缺口
  'tax',            // 稅務傳承
  'free_dashboard', // 自由組合
  'insurance_checkup', // 保單健診
];

// 工具名稱對照表（用於顯示和記錄）
export const TOOL_NAMES: Record<string, string> = {
  golden_safe: '黃金保險箱理論',
  market_data: '市場數據戰情室',
  fund_machine: '基金時光機',
  gift: '百萬禮物專案',
  estate: '金融房產專案',
  student: '學貸活化專案',
  super_active: '超積極存錢法',
  reservoir: '大小水庫專案',
  car: '五年換車專案',
  pension: '退休缺口試算',
  tax: '稅務傳承專案',
  free_dashboard: '自由組合戰情室',
  insurance_checkup: '保單健診系統',
};

// 會員等級類型（新增 referral_trial）
type MembershipTier = 'founder' | 'paid' | 'referral_trial' | 'trial' | 'grace' | 'expired';

interface MembershipData {
  tier: MembershipTier;
  tierName: string;
  tierColor: string;
  points: number;
  referralCode: string;
  referralCount: number;
  loginStreak: number;
  // 🆕 天數制欄位
  daysRemaining: number;
  graceDaysRemaining: number;
  referredBy: string | null;
  hasDiscountEligibility: boolean;  // referral_trial 可享折扣
  expiresAt?: Date;
  canAccessTool: (toolId: string) => boolean;
  isPaid: boolean;
  isExpired: boolean;
  isTrial: boolean;
}

/**
 * 會員權限 Hook
 */
export const useMembership = (userId: string | null) => {
  const [membership, setMembership] = useState<MembershipData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'users', userId),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          const tier = (data.primaryTierId || 'trial') as MembershipTier;

          // 判斷是否為付費會員
          const isPaid = ['founder', 'paid'].includes(tier);
          const isExpired = ['grace', 'expired'].includes(tier);
          const isTrial = ['trial', 'referral_trial'].includes(tier);

          // 會員等級名稱和顏色
          const tierConfig: Record<MembershipTier, { name: string; color: string }> = {
            founder: { name: '創始會員', color: '#f59e0b' },
            paid: { name: '付費會員', color: '#3b82f6' },
            referral_trial: { name: '轉介紹試用', color: '#8b5cf6' },
            trial: { name: '試用會員', color: '#10b981' },
            grace: { name: '寬限期', color: '#f97316' },
            expired: { name: '已過期', color: '#ef4444' },
          };

          const config = tierConfig[tier] || { name: '試用會員', color: '#10b981' };

          setMembership({
            tier,
            tierName: config.name,
            tierColor: config.color,
            points: typeof data.points === 'object' ? (data.points?.current || 0) : (data.points || 0),
            referralCode: data.referralCode || '',
            referralCount: data.referralCount || 0,
            loginStreak: data.loginStreak || 0,
            // 🆕 天數制欄位
            daysRemaining: data.daysRemaining || 0,
            graceDaysRemaining: data.graceDaysRemaining || 0,
            referredBy: data.referredBy || null,
            hasDiscountEligibility: tier === 'referral_trial',
            expiresAt: data.membershipExpiresAt?.toDate(),
            isPaid,
            isExpired,
            isTrial,
            canAccessTool: (toolId: string) => {
              // 創始/付費會員可用全部工具
              if (isPaid) return true;
              // 過期會員不能用任何工具
              if (isExpired) return false;
              // 試用會員只能用免費工具
              return FREE_TOOLS.includes(toolId);
            },
          });
        }
        setLoading(false);
      },
      (error) => {
        console.error('Membership fetch error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { membership, loading };
};

/**
 * 檢查工具是否可用（靜態函數）
 */
export const canAccessTool = (tier: MembershipTier, toolId: string): boolean => {
  const isPaid = ['founder', 'paid'].includes(tier);
  const isExpired = ['grace', 'expired'].includes(tier);
  
  if (isPaid) return true;
  if (isExpired) return false;
  return FREE_TOOLS.includes(toolId);
};

/**
 * 取得工具鎖定狀態列表
 */
export const getToolLockStatus = (tier: MembershipTier): Record<string, boolean> => {
  const status: Record<string, boolean> = {};
  
  ALL_TOOLS.forEach(toolId => {
    status[toolId] = !canAccessTool(tier, toolId);
  });
  
  return status;
};

export default useMembership;
