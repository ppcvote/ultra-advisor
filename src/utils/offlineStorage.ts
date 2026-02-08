/**
 * Ultra Advisor - 離線儲存工具
 * 使用 IndexedDB 快取用戶資料，支援離線瀏覽
 */

const DB_NAME = 'ultra-advisor-offline';
const DB_VERSION = 1;

// 資料表定義
const STORES = {
  USER_PROFILE: 'userProfile',
  CLIENTS: 'clients',
  NOTIFICATIONS: 'notifications',
  SYNC_QUEUE: 'syncQueue',
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

let db: IDBDatabase | null = null;

/**
 * 初始化 IndexedDB
 */
export const initOfflineDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[OfflineDB] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('[OfflineDB] Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      console.log('[OfflineDB] Upgrading database...');

      // 用戶資料表
      if (!database.objectStoreNames.contains(STORES.USER_PROFILE)) {
        database.createObjectStore(STORES.USER_PROFILE, { keyPath: 'uid' });
      }

      // 客戶列表（以 odId 為 key）
      if (!database.objectStoreNames.contains(STORES.CLIENTS)) {
        const clientStore = database.createObjectStore(STORES.CLIENTS, { keyPath: 'odId' });
        clientStore.createIndex('userId', 'userId', { unique: false });
      }

      // 通知快取
      if (!database.objectStoreNames.contains(STORES.NOTIFICATIONS)) {
        database.createObjectStore(STORES.NOTIFICATIONS, { keyPath: 'id' });
      }

      // 離線操作同步佇列
      if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = database.createObjectStore(STORES.SYNC_QUEUE, {
          keyPath: 'id',
          autoIncrement: true
        });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

/**
 * 通用存取函數
 */
const getStore = async (storeName: StoreName, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> => {
  const database = await initOfflineDB();
  const transaction = database.transaction(storeName, mode);
  return transaction.objectStore(storeName);
};

/**
 * 儲存資料
 */
export const saveToOffline = async <T>(storeName: StoreName, data: T): Promise<void> => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * 批量儲存
 */
export const saveManyToOffline = async <T>(storeName: StoreName, items: T[]): Promise<void> => {
  const database = await initOfflineDB();
  const transaction = database.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);

  return new Promise((resolve, reject) => {
    items.forEach(item => store.put(item));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

/**
 * 讀取單筆資料
 */
export const getFromOffline = async <T>(storeName: StoreName, key: string): Promise<T | null> => {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

/**
 * 讀取所有資料
 */
export const getAllFromOffline = async <T>(storeName: StoreName): Promise<T[]> => {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

/**
 * 根據索引查詢
 */
export const getByIndex = async <T>(
  storeName: StoreName,
  indexName: string,
  value: string
): Promise<T[]> => {
  const store = await getStore(storeName);
  const index = store.index(indexName);
  return new Promise((resolve, reject) => {
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

/**
 * 刪除資料
 */
export const deleteFromOffline = async (storeName: StoreName, key: string): Promise<void> => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * 清空資料表
 */
export const clearOfflineStore = async (storeName: StoreName): Promise<void> => {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// ============================================
// 專用 API
// ============================================

/**
 * 快取用戶資料
 */
export const cacheUserProfile = async (profile: {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  [key: string]: any;
}): Promise<void> => {
  await saveToOffline(STORES.USER_PROFILE, {
    ...profile,
    cachedAt: Date.now(),
  });
  console.log('[OfflineDB] User profile cached');
};

/**
 * 取得快取的用戶資料
 */
export const getCachedUserProfile = async (uid: string) => {
  return getFromOffline(STORES.USER_PROFILE, uid);
};

/**
 * 快取客戶列表
 */
export const cacheClients = async (userId: string, clients: any[]): Promise<void> => {
  // 先清除該用戶的舊資料
  const existingClients = await getByIndex(STORES.CLIENTS, 'userId', userId);
  for (const client of existingClients) {
    await deleteFromOffline(STORES.CLIENTS, (client as any).odId);
  }

  // 儲存新資料
  const clientsWithMeta = clients.map(client => ({
    ...client,
    userId,
    cachedAt: Date.now(),
  }));
  await saveManyToOffline(STORES.CLIENTS, clientsWithMeta);
  console.log(`[OfflineDB] Cached ${clients.length} clients`);
};

/**
 * 取得快取的客戶列表
 */
export const getCachedClients = async (userId: string): Promise<any[]> => {
  return getByIndex(STORES.CLIENTS, 'userId', userId);
};

/**
 * 快取通知
 */
export const cacheNotifications = async (notifications: any[]): Promise<void> => {
  await clearOfflineStore(STORES.NOTIFICATIONS);
  const notificationsWithMeta = notifications.map(n => ({
    ...n,
    cachedAt: Date.now(),
  }));
  await saveManyToOffline(STORES.NOTIFICATIONS, notificationsWithMeta);
  console.log(`[OfflineDB] Cached ${notifications.length} notifications`);
};

/**
 * 取得快取的通知
 */
export const getCachedNotifications = async (): Promise<any[]> => {
  return getAllFromOffline(STORES.NOTIFICATIONS);
};

// ============================================
// 離線操作同步佇列
// ============================================

interface SyncQueueItem {
  id?: number;
  action: 'create' | 'update' | 'delete';
  collection: string;
  docId?: string;
  data?: any;
  timestamp: number;
}

/**
 * 將操作加入同步佇列（離線時使用）
 */
export const addToSyncQueue = async (item: Omit<SyncQueueItem, 'id' | 'timestamp'>): Promise<void> => {
  await saveToOffline(STORES.SYNC_QUEUE, {
    ...item,
    timestamp: Date.now(),
  } as SyncQueueItem);
  console.log('[OfflineDB] Added to sync queue:', item.action, item.collection);
};

/**
 * 取得待同步的操作
 */
export const getSyncQueue = async (): Promise<SyncQueueItem[]> => {
  return getAllFromOffline(STORES.SYNC_QUEUE);
};

/**
 * 清空同步佇列
 */
export const clearSyncQueue = async (): Promise<void> => {
  await clearOfflineStore(STORES.SYNC_QUEUE);
};

/**
 * 刪除已同步的項目
 */
export const removeSyncedItem = async (id: number): Promise<void> => {
  await deleteFromOffline(STORES.SYNC_QUEUE, String(id));
};

// ============================================
// 連線狀態偵測
// ============================================

/**
 * 檢查是否在線
 */
export const isOnline = (): boolean => {
  return navigator.onLine;
};

/**
 * 監聽連線狀態變化
 */
export const onConnectivityChange = (callback: (online: boolean) => void): (() => void) => {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

export { STORES };
