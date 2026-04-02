import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";       // 1. 引入驗證功能
import { initializeFirestore } from "firebase/firestore"; // 2. 引入資料庫功能
import { getStorage } from "firebase/storage"; // 3. 引入儲存功能（大頭貼上傳用）
import { getFunctions } from "firebase/functions"; // 4. Cloud Functions
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging"; // 5. 推播通知

// ------------------------------------------------------------------
// Firebase 設定區域
// ------------------------------------------------------------------
// 注意：Firebase Web SDK 的 API Key 設計上需要在前端暴露
// 安全性由 Firebase Security Rules 和 API Key 限制來保護
// 請在 Firebase Console > Project Settings > API restrictions 設定網域限制
const firebaseConfig = {
  apiKey: "AIzaSyAqS6fhHQVyBNr1LCkCaQPyJ13Rkq7bfHA",
  authDomain: "grbt-f87fa.firebaseapp.com",
  projectId: "grbt-f87fa",
  storageBucket: "grbt-f87fa.firebasestorage.app",
  messagingSenderId: "169700005946",
  appId: "1:169700005946:web:9b0722f31aa9fe7ad13d03",
  measurementId: "G-58N4KK9M5W"
};

// VAPID Key for FCM (從 Firebase Console 取得)
export const VAPID_KEY = "ZpEpYssMYQ1K6K7YmoLc6wPuIIkzO2gVXfp-cp9wxuM";

// 初始化 Firebase 應用程式（單例）
const app = initializeApp(firebaseConfig);

// 匯出核心服務
export const auth = getAuth(app);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1'); // Cloud Functions
export { app }; // 匯出 app 供其他模組使用

// ------------------------------------------------------------------
// Firebase Cloud Messaging (FCM) - 推播通知
// ------------------------------------------------------------------
let messaging: ReturnType<typeof getMessaging> | null = null;

// 初始化 Messaging（僅在支援的瀏覽器中）
export const initMessaging = async () => {
  try {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
      console.log('[FCM] Messaging initialized');
      return messaging;
    } else {
      console.log('[FCM] Messaging not supported in this browser');
      return null;
    }
  } catch (error) {
    console.error('[FCM] Failed to initialize messaging:', error);
    return null;
  }
};

// 取得 FCM Token
export const getFCMToken = async (): Promise<string | null> => {
  try {
    if (!messaging) {
      await initMessaging();
    }
    if (!messaging) return null;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    console.log('[FCM] Token obtained:', token?.substring(0, 20) + '...');
    return token;
  } catch (error) {
    console.error('[FCM] Failed to get token:', error);
    return null;
  }
};

// 監聽前景訊息
export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};