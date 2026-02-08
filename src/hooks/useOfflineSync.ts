/**
 * Ultra Advisor - 離線同步 Hook
 * 自動快取資料到 IndexedDB，離線時使用快取
 */

import { useState, useEffect, useCallback } from 'react';
import {
  initOfflineDB,
  cacheUserProfile,
  getCachedUserProfile,
  cacheClients,
  getCachedClients,
  cacheNotifications,
  getCachedNotifications,
  isOnline,
  onConnectivityChange,
  getSyncQueue,
  clearSyncQueue,
} from '../utils/offlineStorage';

interface UseOfflineSyncReturn {
  isOnline: boolean;
  isInitialized: boolean;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  pendingSyncCount: number;
  cacheUserData: (uid: string, data: any) => Promise<void>;
  getCachedUser: (uid: string) => Promise<any>;
  cacheClientList: (userId: string, clients: any[]) => Promise<void>;
  getCachedClientList: (userId: string) => Promise<any[]>;
  cacheNotificationList: (notifications: any[]) => Promise<void>;
  getCachedNotificationList: () => Promise<any[]>;
  syncPendingChanges: () => Promise<void>;
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [online, setOnline] = useState(isOnline());
  const [isInitialized, setIsInitialized] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // 初始化 IndexedDB
  useEffect(() => {
    initOfflineDB()
      .then(() => {
        setIsInitialized(true);
        console.log('[OfflineSync] Initialized');
      })
      .catch((error) => {
        console.error('[OfflineSync] Init failed:', error);
      });
  }, []);

  // 監聽連線狀態
  useEffect(() => {
    const unsubscribe = onConnectivityChange((isOnline) => {
      setOnline(isOnline);
      console.log('[OfflineSync] Connectivity changed:', isOnline ? 'online' : 'offline');

      // 恢復連線時嘗試同步
      if (isOnline) {
        syncPendingChanges();
      }
    });

    return unsubscribe;
  }, []);

  // 檢查待同步項目數量
  useEffect(() => {
    const checkPending = async () => {
      if (!isInitialized) return;
      const queue = await getSyncQueue();
      setPendingSyncCount(queue.length);
    };

    checkPending();
    const interval = setInterval(checkPending, 30000); // 每 30 秒檢查
    return () => clearInterval(interval);
  }, [isInitialized]);

  // 快取用戶資料
  const cacheUserData = useCallback(async (uid: string, data: any) => {
    if (!isInitialized) return;
    await cacheUserProfile({ uid, ...data });
  }, [isInitialized]);

  // 取得快取的用戶資料
  const getCachedUser = useCallback(async (uid: string) => {
    if (!isInitialized) return null;
    return getCachedUserProfile(uid);
  }, [isInitialized]);

  // 快取客戶列表
  const cacheClientList = useCallback(async (userId: string, clients: any[]) => {
    if (!isInitialized) return;
    await cacheClients(userId, clients);
  }, [isInitialized]);

  // 取得快取的客戶列表
  const getCachedClientList = useCallback(async (userId: string) => {
    if (!isInitialized) return [];
    return getCachedClients(userId);
  }, [isInitialized]);

  // 快取通知
  const cacheNotificationList = useCallback(async (notifications: any[]) => {
    if (!isInitialized) return;
    await cacheNotifications(notifications);
  }, [isInitialized]);

  // 取得快取的通知
  const getCachedNotificationList = useCallback(async () => {
    if (!isInitialized) return [];
    return getCachedNotifications();
  }, [isInitialized]);

  // 同步待處理的變更
  const syncPendingChanges = useCallback(async () => {
    if (!isInitialized || !online) return;

    const queue = await getSyncQueue();
    if (queue.length === 0) {
      setSyncStatus('synced');
      return;
    }

    setSyncStatus('syncing');
    console.log(`[OfflineSync] Syncing ${queue.length} pending changes...`);

    try {
      // TODO: 實作實際的 Firestore 同步邏輯
      // 這裡需要根據 queue 中的操作類型執行對應的 Firestore 操作
      // 目前先清空佇列作為示範

      await clearSyncQueue();
      setPendingSyncCount(0);
      setSyncStatus('synced');
      console.log('[OfflineSync] Sync completed');
    } catch (error) {
      console.error('[OfflineSync] Sync failed:', error);
      setSyncStatus('error');
    }
  }, [isInitialized, online]);

  return {
    isOnline: online,
    isInitialized,
    syncStatus,
    pendingSyncCount,
    cacheUserData,
    getCachedUser,
    cacheClientList,
    getCachedClientList,
    cacheNotificationList,
    getCachedNotificationList,
    syncPendingChanges,
  };
}

export default useOfflineSync;
