/**
 * Ultra Advisor - Missions System Hook
 * 任務看板前端 Hook
 *
 * 檔案位置：src/hooks/useMissions.ts
 */

import { useState, useCallback, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db, functions } from '../firebase';

// 類型定義
export interface Mission {
  id: string;
  title: string;
  description?: string;
  icon: string;
  points: number;
  category: 'onboarding' | 'social' | 'habit' | 'daily';
  order: number;
  linkType: 'modal' | 'internal' | 'external' | 'pwa' | null;
  linkTarget: string | null;
  verificationType: 'auto' | 'manual';
  verificationField?: string;
  verificationCondition?: string;
  repeatType: 'once' | 'daily';
  isActive: boolean;
  // 用戶完成狀態（由 getMissions 附加）
  isCompleted?: boolean;
  isCompletedToday?: boolean;
  completedAt?: any;
}

interface CompleteMissionResult {
  success: boolean;
  pointsAwarded?: number;
  newBalance?: number;
  message: string;
}

// 分類優先級順序
const categoryPriority = {
  'onboarding': 1,
  'social': 2,
  'habit': 3,
  'daily': 4,
};

/**
 * Missions System Hook
 */
export const useMissions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [currentMission, setCurrentMission] = useState<Mission | null>(null);
  const [allCompleted, setAllCompleted] = useState(false);

  /**
   * 從 Cloud Function 取得任務列表
   */
  const fetchMissions = useCallback(async (): Promise<Mission[]> => {
    setLoading(true);
    setError(null);

    try {
            const getMissionsFunc = httpsCallable(functions, 'getMissions');
      const result = await getMissionsFunc({});
      const data = result.data as { missions: Mission[] };

      if (data.missions) {
        // 排序：先按分類優先級，再按 order
        const sortedMissions = data.missions.sort((a, b) => {
          const priorityDiff = categoryPriority[a.category] - categoryPriority[b.category];
          if (priorityDiff !== 0) return priorityDiff;
          return a.order - b.order;
        });

        setMissions(sortedMissions);

        // 找出當前未完成的任務
        const uncompletedMission = sortedMissions.find(m => {
          if (m.repeatType === 'once') {
            return !m.isCompleted;
          } else if (m.repeatType === 'daily') {
            return !m.isCompletedToday;
          }
          return true;
        });

        if (uncompletedMission) {
          setCurrentMission(uncompletedMission);
          setAllCompleted(false);
        } else {
          setCurrentMission(null);
          setAllCompleted(true);
        }

        return sortedMissions;
      }
      return [];
    } catch (err: any) {
      console.error('fetchMissions error:', err);
      setError(err.message || '取得任務列表失敗');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 完成任務並領取點數
   */
  const completeMission = useCallback(async (missionId: string): Promise<CompleteMissionResult | null> => {
    console.log('=== useMissions.completeMission ===');
    console.log('missionId:', missionId);
    console.log('auth.currentUser:', auth.currentUser?.uid);

    setLoading(true);
    setError(null);

    try {
      console.log('Creating callable function...');
            const completeMissionFunc = httpsCallable(functions, 'completeMission');
      console.log('Calling Cloud Function...');
      const result = await completeMissionFunc({ missionId });
      console.log('Cloud Function result:', result);
      const data = result.data as CompleteMissionResult;
      console.log('Parsed data:', data);

      // 重新載入任務列表以更新狀態
      console.log('Refreshing missions...');
      await fetchMissions();

      return data;
    } catch (err: any) {
      console.error('completeMission error:', err);
      console.error('Error code:', err.code);
      console.error('Error details:', err.details);
      const errorMessage = err.message || '任務完成失敗';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [fetchMissions]);

  /**
   * 檢查自動驗證條件是否滿足
   * 用於前端自動完成任務的邏輯
   */
  const checkAutoVerification = useCallback(async (mission: Mission): Promise<boolean> => {
    if (mission.verificationType !== 'auto') return false;
    if (!mission.verificationField) return false;

    const user = auth.currentUser;
    if (!user) return false;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) return false;

      const userData = userDoc.data();
      const field = mission.verificationField;
      const condition = mission.verificationCondition;

      // 簡單欄位檢查（photoURL, displayName, lineUserId）
      if (!condition) {
        return !!userData[field];
      }

      // 條件檢查（如 count>=3）
      if (condition.startsWith('count>=')) {
        const requiredCount = parseInt(condition.replace('count>=', ''));

        // 檢查 clients 子集合
        if (field === 'clients') {
          const clientsSnapshot = await getDocs(collection(db, 'users', user.uid, 'clients'));
          return clientsSnapshot.size >= requiredCount;
        }

        // 檢查 cheatSheetUsageCount
        if (field === 'cheatSheetUsageCount') {
          return (userData.cheatSheetUsageCount || 0) >= requiredCount;
        }
      }

      // 每日登入檢查
      if (condition === 'today') {
        const today = new Date();
        const taiwanOffset = 8 * 60 * 60 * 1000;
        const todayStr = new Date(today.getTime() + taiwanOffset).toISOString().split('T')[0];
        return userData.lastLoginDate === todayStr;
      }

      return false;
    } catch (err) {
      console.error('checkAutoVerification error:', err);
      return false;
    }
  }, []);

  /**
   * 初始載入
   */
  useEffect(() => {
    // 只在用戶登入時載入
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchMissions();
      } else {
        setMissions([]);
        setCurrentMission(null);
      }
    });

    return () => unsubscribe();
  }, [fetchMissions]);

  return {
    // 狀態
    loading,
    error,
    missions,
    currentMission,
    allCompleted,

    // 方法
    fetchMissions,
    completeMission,
    checkAutoVerification,
  };
};

// 靜態 API（不需要 Hook）
export const missionsApi = {
  async getMissions(): Promise<{ missions: Mission[] }> {
        const getMissionsFunc = httpsCallable(functions, 'getMissions');
    const result = await getMissionsFunc({});
    return result.data as { missions: Mission[] };
  },

  async completeMission(missionId: string): Promise<CompleteMissionResult> {
        const completeMissionFunc = httpsCallable(functions, 'completeMission');
    const result = await completeMissionFunc({ missionId });
    return result.data as CompleteMissionResult;
  },
};
