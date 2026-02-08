/**
 * Ultra Advisor - Points System Hook
 * 前端呼叫 Cloud Functions 的工具
 * 
 * 檔案位置：src/hooks/usePoints.ts
 */

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

// 類型定義
interface DailyLoginResult {
  success: boolean;
  loginStreak: number;
  dailyReward: {
    success: boolean;
    points?: number;
    multiplier?: number;
    newBalance?: number;
    reason?: string;
  };
  streakReward?: {
    success: boolean;
    points?: number;
  } | null;
}

interface ToolUseResult {
  success: boolean;
  points?: number;
  multiplier?: number;
  newBalance?: number;
  reason?: string;
}

interface PointsSummary {
  currentPoints: number;
  totalEarned: number;
  totalSpent: number;
  totalExpired: number;
  loginStreak: number;
  referralCode: string;
  referralCount: number;
  expiringIn30Days: number;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    reason: string;
    createdAt: Date;
  }>;
}

interface ReferralResult {
  success: boolean;
  referrerReward: ToolUseResult;
  newUserReward: ToolUseResult;
}

/**
 * Points System Hook
 */
export const usePoints = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 每日登入獎勵（在登入成功後呼叫）
   */
  const triggerDailyLogin = useCallback(async (): Promise<DailyLoginResult | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const onDailyLogin = httpsCallable(functions, 'onDailyLogin');
      const result = await onDailyLogin();
      return result.data as DailyLoginResult;
    } catch (err: any) {
      console.error('Daily login error:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 工具使用獎勵（在使用工具後呼叫）
   */
  const triggerToolUse = useCallback(async (toolName: string): Promise<ToolUseResult | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const onToolUse = httpsCallable(functions, 'onToolUse');
      const result = await onToolUse({ toolName });
      return result.data as ToolUseResult;
    } catch (err: any) {
      console.error('Tool use error:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 建立首位客戶獎勵
   */
  const triggerFirstClient = useCallback(async (): Promise<ToolUseResult | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const onFirstClient = httpsCallable(functions, 'onFirstClient');
      const result = await onFirstClient();
      return result.data as ToolUseResult;
    } catch (err: any) {
      console.error('First client error:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 使用推薦碼
   */
  const useReferralCode = useCallback(async (referralCode: string): Promise<ReferralResult | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const processReferral = httpsCallable(functions, 'processReferral');
      const result = await processReferral({ referralCode });
      return result.data as ReferralResult;
    } catch (err: any) {
      console.error('Referral error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 更新自己的推薦碼
   */
  const updateMyReferralCode = useCallback(async (newCode: string): Promise<{ success: boolean; newCode: string } | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const updateReferralCode = httpsCallable(functions, 'updateReferralCode');
      const result = await updateReferralCode({ newCode });
      return result.data as { success: boolean; newCode: string };
    } catch (err: any) {
      console.error('Update referral code error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 取得用戶點數摘要
   */
  const getPointsSummary = useCallback(async (): Promise<PointsSummary | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const getUserPointsSummary = httpsCallable(functions, 'getUserPointsSummary');
      const result = await getUserPointsSummary();
      return result.data as PointsSummary;
    } catch (err: any) {
      console.error('Get summary error:', err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    triggerDailyLogin,
    triggerToolUse,
    triggerFirstClient,
    useReferralCode,
    updateMyReferralCode,
    getPointsSummary,
  };
};

/**
 * 簡化版：直接呼叫函數（不使用 Hook）
 */
export const pointsApi = {
  dailyLogin: async () => {
    const fn = httpsCallable(functions, 'onDailyLogin');
    const result = await fn();
    return result.data as DailyLoginResult;
  },
  
  toolUse: async (toolName: string) => {
    const fn = httpsCallable(functions, 'onToolUse');
    const result = await fn({ toolName });
    return result.data as ToolUseResult;
  },
  
  firstClient: async () => {
    const fn = httpsCallable(functions, 'onFirstClient');
    const result = await fn();
    return result.data as ToolUseResult;
  },
  
  useReferral: async (code: string) => {
    const fn = httpsCallable(functions, 'processReferral');
    const result = await fn({ referralCode: code });
    return result.data as ReferralResult;
  },
  
  updateReferralCode: async (newCode: string) => {
    const fn = httpsCallable(functions, 'updateReferralCode');
    const result = await fn({ newCode });
    return result.data;
  },
  
  getSummary: async () => {
    const fn = httpsCallable(functions, 'getUserPointsSummary');
    const result = await fn();
    return result.data as PointsSummary;
  },
};

export default usePoints;
