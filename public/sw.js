/**
 * Ultra Advisor Service Worker
 * 提供離線支援、快取策略、推播通知基礎
 */

const CACHE_NAME = 'ultra-advisor-v1';
const STATIC_CACHE = 'ultra-advisor-static-v1';
const DYNAMIC_CACHE = 'ultra-advisor-dynamic-v1';

// 靜態資源（App Shell）- 優先快取
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/logo-192.png',
  '/logo-512.png',
  '/offline.html',
];

// 需要快取的 API 路徑模式
const API_CACHE_PATTERNS = [
  /firestore\.googleapis\.com/,
];

// 不快取的路徑
const NO_CACHE_PATTERNS = [
  /\/api\//,
  /google\.com\/recaptcha/,
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
];

// ============================================
// 安裝事件 - 預快取靜態資源
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached');
        return self.skipWaiting(); // 立即激活
      })
      .catch((err) => {
        console.error('[SW] Pre-cache failed:', err);
      })
  );
});

// ============================================
// 激活事件 - 清理舊快取
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // 刪除舊版本快取
              return name !== STATIC_CACHE && name !== DYNAMIC_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim(); // 立即接管所有頁面
      })
  );
});

// ============================================
// Fetch 事件 - 快取策略
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳過不快取的請求
  if (shouldSkipCache(url)) {
    return;
  }

  // 導航請求（HTML 頁面）- Network First
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 靜態資源（JS/CSS/圖片）- Cache First
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 其他請求 - Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ============================================
// 快取策略函數
// ============================================

/**
 * Network First - 優先網路，失敗才用快取
 * 適用於：HTML 頁面、需要最新內容的資源
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    // 成功則更新快取
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // 離線時返回離線頁面
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    throw error;
  }
}

/**
 * Cache First - 優先快取，沒有才抓網路
 * 適用於：靜態資源（JS/CSS/圖片/字體）
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache first failed:', request.url);
    throw error;
  }
}

/**
 * Stale While Revalidate - 先返回快取，同時更新
 * 適用於：不常變但需要保持新鮮的資源
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  // 背景更新快取
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cachedResponse);

  // 有快取就先返回
  return cachedResponse || fetchPromise;
}

// ============================================
// 輔助函數
// ============================================

function shouldSkipCache(url) {
  return NO_CACHE_PATTERNS.some((pattern) => pattern.test(url.href));
}

function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some((ext) => url.pathname.endsWith(ext));
}

// ============================================
// 推播通知（預留）
// ============================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || '',
    icon: '/logo-192.png',
    badge: '/logo-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Ultra Advisor', options)
  );
});

// 點擊通知
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 如果已有視窗，聚焦它
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // 否則開新視窗
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// ============================================
// 背景同步（預留）
// ============================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-user-data') {
    event.waitUntil(syncUserData());
  }
});

async function syncUserData() {
  // 預留：同步離線時的資料變更
  console.log('[SW] Syncing user data...');
}

console.log('[SW] Service Worker loaded');
