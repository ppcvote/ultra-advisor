/**
 * Ultra Advisor - Firebase Cloud Messaging Service Worker
 * 處理背景推播通知
 */

// Firebase SDK
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Firebase 設定
firebase.initializeApp({
  apiKey: "AIzaSyAqS6fhHQVyBNr1LCkCaQPyJ13Rkq7bfHA",
  authDomain: "grbt-f87fa.firebaseapp.com",
  projectId: "grbt-f87fa",
  storageBucket: "grbt-f87fa.firebasestorage.app",
  messagingSenderId: "169700005946",
  appId: "1:169700005946:web:9b0722f31aa9fe7ad13d03",
});

const messaging = firebase.messaging();

// ============================================
// 背景訊息處理
// ============================================
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Ultra Advisor';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: payload.data?.notificationId || 'ultra-advisor-notification',
    requireInteraction: false,
    vibrate: [100, 50, 100],
    data: {
      url: payload.data?.url || '/',
      notificationId: payload.data?.notificationId,
      ...payload.data,
    },
    // 自訂動作按鈕
    actions: [
      {
        action: 'open',
        title: '查看詳情',
      },
      {
        action: 'dismiss',
        title: '稍後再看',
      },
    ],
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ============================================
// 點擊通知處理
// ============================================
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM SW] Notification clicked:', event);

  event.notification.close();

  // 處理動作按鈕點擊
  if (event.action === 'dismiss') {
    return;
  }

  // 取得目標 URL
  const targetUrl = event.notification.data?.url || '/';
  const fullUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 嘗試聚焦已開啟的視窗
        for (const client of clientList) {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin && 'focus' in client) {
            // 導航到目標頁面
            client.navigate(fullUrl);
            return client.focus();
          }
        }
        // 沒有開啟的視窗，開新視窗
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});

// ============================================
// 通知關閉處理（可用於統計）
// ============================================
self.addEventListener('notificationclose', (event) => {
  console.log('[FCM SW] Notification closed:', event.notification.data?.notificationId);
  // 可在此記錄通知被關閉的統計
});

console.log('[FCM SW] Firebase Messaging Service Worker loaded');
