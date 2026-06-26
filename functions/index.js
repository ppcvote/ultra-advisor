// ==========================================
// Ultra Advisor - 完整 Cloud Functions
// LINE Bot + 會員系統 + UA 點數
// ==========================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// ==========================================
// 🔒 共用：每日 Rate Limit（防 AI 函數被狂打）
// ==========================================
/**
 * 每日 rate limit — 用法：在 callable function 開頭 `await enforceDailyLimit('ocr', context, 20);`
 * @param {string} prefix — 計數器類別前綴
 * @param {object} context — Firebase Callable context (含 auth + rawRequest)
 * @param {number} dailyLimit — 登入用戶上限
 * @param {number} [anonLimit] — 匿名上限（預設為 dailyLimit / 3）
 * 失敗時拋 HttpsError('resource-exhausted', '...');
 */
async function enforceDailyLimit(prefix, context, dailyLimit, anonLimit) {
  const uid = context.auth?.uid;
  const ip = context.rawRequest?.ip || context.rawRequest?.headers?.['x-forwarded-for'] || 'unknown';
  const limit = uid ? dailyLimit : (anonLimit || Math.ceil(dailyLimit / 3));
  const key = uid || String(ip).replace(/[^a-zA-Z0-9]/g, '_');
  const today = new Date().toISOString().split('T')[0];
  const ref = db.collection('rateLimits').doc(`${prefix}_${key}_${today}`);
  try {
    const snap = await ref.get();
    const current = snap.exists ? (snap.data().count || 0) : 0;
    if (current >= limit) {
      throw new functions.https.HttpsError('resource-exhausted',
        `今日 ${prefix} 次數已達上限 (${limit})，請明天再試`);
    }
    await ref.set({
      count: current + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    if (err.code === 'resource-exhausted') throw err;
    console.warn(`⚠️ Rate limit (${prefix}) 檢查失敗，放行:`, err.message);
  }
}

// ==========================================
// CORS 白名單設定（資安規格書 1.2）
// ==========================================
const ALLOWED_ORIGINS = [
  'https://ultra-advisor.tw',
  'https://www.ultra-advisor.tw',
  'https://admin.ultra-advisor.tw',
  'https://liff.line.me',  // LIFF 應用程式
];

// 開發環境允許 localhost（僅限開發）
if (process.env.FUNCTIONS_EMULATOR) {
  ALLOWED_ORIGINS.push('http://localhost:5173');
  ALLOWED_ORIGINS.push('http://localhost:3000');
}

/**
 * 設置 CORS 標頭（帶白名單驗證）
 */
function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Credentials', 'true');
}

// ==========================================
// 環境變數配置
// ==========================================

const LINE_CHANNEL_SECRET = functions.config().line?.channel_secret;
const LINE_CHANNEL_ACCESS_TOKEN = functions.config().line?.channel_access_token;
const APP_LOGIN_URL = functions.config().app?.login_url || 'https://ultra-advisor.tw';

// Pin (Telegram) webhook config — via functions/.env (functions.config() is
// deprecated/removed in firebase-tools 15 / Runtime Config shut down 2026-03).
// Set in functions/.env: PIN_WEBHOOK_BASE=https://pin.quartz.tw  PIN_WEBHOOK_SECRET=<secret>
const PIN_WEBHOOK_BASE = process.env.PIN_WEBHOOK_BASE;
const PIN_WEBHOOK_SECRET = process.env.PIN_WEBHOOK_SECRET;
// Passwordless Pin→Advisor auto-login: sign a short-lived link per bound member.
// The Pin binding already proves they own that LINE/TG; the link is HMAC-signed,
// 24h, and delivered only to their private channel. (pinAuth verifies + mints a
// Firebase custom token → frontend signs in → lands on the intended tab.)
const PIN_AUTH_SECRET = process.env.PIN_AUTH_SECRET;

function signPinAuthUrl(uid, tab = 'share') {
  // No secret → fall back to the plain (login-required) link.
  if (!PIN_AUTH_SECRET) return `https://ultra-advisor.tw/?tab=${tab}`;
  const exp = Date.now() + 24 * 60 * 60 * 1000; // 24h
  const sig = crypto.createHmac('sha256', PIN_AUTH_SECRET).update(`${uid}.${exp}.${tab}`).digest('hex');
  const base = 'https://us-central1-grbt-f87fa.cloudfunctions.net/pinAuth';
  return `${base}?u=${encodeURIComponent(uid)}&exp=${exp}&tab=${encodeURIComponent(tab)}&sig=${sig}`;
}

const { validatePinToken, computePinSignature } = require('./pin-helpers');

// ==========================================
// 工具函數
// ==========================================

/**
 * 🔒 驗證是否為管理員（使用 Firestore admins collection）
 * 移除硬編碼郵件，改用資料庫驗證
 * @param {string} uid - 用戶 UID
 * @returns {Promise<boolean>} 是否為管理員
 */
async function isAdmin(uid) {
  if (!uid) return false;
  try {
    const adminDoc = await db.collection('admins').doc(uid).get();
    return adminDoc.exists;
  } catch (error) {
    console.error('Admin verification error:', error);
    return false;
  }
}

/**
 * 🔒 驗證管理員權限（用於 Callable Functions）
 * @param {Object} context - Firebase Functions context
 * @throws {functions.https.HttpsError} 如果驗證失敗
 */
async function verifyAdminAccess(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const isUserAdmin = await isAdmin(context.auth.uid);
  if (!isUserAdmin) {
    throw new functions.https.HttpsError('permission-denied', '無管理員權限');
  }

  return true;
}

/**
 * 🔒 Rate Limiting - 防止惡意註冊攻擊
 * 同一 IP 每小時最多 5 次註冊嘗試
 */
async function checkRateLimit(ip, action = 'register') {
  const rateLimitRef = db.collection('rateLimits').doc(`${action}_${ip.replace(/[.:/]/g, '_')}`);
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 小時
  const maxAttempts = 5;

  try {
    const doc = await rateLimitRef.get();

    if (doc.exists) {
      const data = doc.data();
      const windowStart = data.windowStart || 0;

      // 如果還在同一個時間窗口內
      if (now - windowStart < windowMs) {
        if (data.attempts >= maxAttempts) {
          return { allowed: false, remaining: 0, resetIn: Math.ceil((windowStart + windowMs - now) / 1000 / 60) };
        }
        // 增加嘗試次數
        await rateLimitRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
        return { allowed: true, remaining: maxAttempts - data.attempts - 1 };
      }
    }

    // 重置或建立新的時間窗口
    await rateLimitRef.set({ windowStart: now, attempts: 1 });
    return { allowed: true, remaining: maxAttempts - 1 };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // 發生錯誤時允許通過，避免阻擋正常用戶
    return { allowed: true, remaining: maxAttempts };
  }
}

/**
 * 🔒 驗證 reCAPTCHA v3 token
 */
async function verifyRecaptcha(token, expectedAction = 'register') {
  if (!token) {
    return { success: false, score: 0, error: '缺少驗證碼' };
  }

  const secretKey = functions.config().recaptcha?.secret_key;
  if (!secretKey) {
    console.warn('reCAPTCHA secret key not configured, skipping verification');
    return { success: true, score: 1 }; // 未設定時跳過驗證
  }

  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: secretKey,
          response: token
        }
      }
    );

    const data = response.data;

    // 驗證 action 和分數
    if (data.success && data.action === expectedAction && data.score >= 0.5) {
      return { success: true, score: data.score };
    }

    console.warn('reCAPTCHA verification failed:', data);
    return { success: false, score: data.score || 0, error: '驗證失敗，請重試' };
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return { success: false, score: 0, error: '驗證服務暫時無法使用' };
  }
}

/**
 * 取得用戶真實 IP
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         'unknown';
}

/**
 * 生成隨機密碼
 */
function generateRandomPassword() {
  const length = 10;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  if (!/[A-Z]/.test(password)) password = 'A' + password.slice(1);
  if (!/[a-z]/.test(password)) password = password.slice(0, -1) + 'a';
  if (!/[0-9]/.test(password)) password = password.slice(0, -1) + '1';
  return password;
}

/**
 * 生成推薦碼
 */
function generateReferralCode(email) {
  const emailPrefix = email?.split('@')[0]?.substring(0, 6) || 'user';
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${emailPrefix}-${randomSuffix}`;
}

/**
 * 驗證 Email 格式
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ==========================================
// 🆕 防刷機制 - 速率限制
// ==========================================

// 記憶體快取（用於快速檢查，重啟後會清除，但 Firestore 有持久記錄）
const rateLimitCache = new Map();

// 清理過期的快取記錄（每 10 分鐘）
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitCache.entries()) {
    if (now - data.lastAttempt > 3600000) { // 1 小時後清除
      rateLimitCache.delete(key);
    }
  }
}, 600000);

/**
 * 🆕 檢查並記錄速率限制（防止同一 LINE 用戶頻繁註冊）
 * @param {string} lineUserId - LINE 用戶 ID
 * @returns {Promise<{allowed: boolean, message: string, waitMinutes: number}>}
 */
async function checkRateLimit(lineUserId) {
  const now = Date.now();
  const COOLDOWN_MINUTES = 30;  // 註冊冷卻時間（分鐘）
  const MAX_ATTEMPTS_PER_DAY = 3;  // 每天最多嘗試次數

  // 先檢查記憶體快取（快速擋掉重複請求）
  const cached = rateLimitCache.get(lineUserId);
  if (cached) {
    const timeSinceLast = now - cached.lastAttempt;
    if (timeSinceLast < COOLDOWN_MINUTES * 60 * 1000) {
      const waitMinutes = Math.ceil((COOLDOWN_MINUTES * 60 * 1000 - timeSinceLast) / 60000);
      return {
        allowed: false,
        message: `⏳ 請等待 ${waitMinutes} 分鐘後再嘗試註冊`,
        waitMinutes
      };
    }
  }

  // 從 Firestore 讀取該用戶的註冊嘗試記錄
  const rateLimitRef = db.collection('rateLimits').doc(lineUserId);
  const rateLimitDoc = await rateLimitRef.get();

  if (rateLimitDoc.exists) {
    const data = rateLimitDoc.data();
    const lastAttempt = data.lastAttempt?.toMillis() || 0;
    const attemptsToday = data.attemptsToday || 0;
    const lastResetDate = data.lastResetDate || '';

    // 檢查是否需要重置每日計數
    const today = new Date().toISOString().slice(0, 10);
    const shouldResetDaily = lastResetDate !== today;

    // 檢查冷卻時間
    const timeSinceLast = now - lastAttempt;
    if (timeSinceLast < COOLDOWN_MINUTES * 60 * 1000) {
      const waitMinutes = Math.ceil((COOLDOWN_MINUTES * 60 * 1000 - timeSinceLast) / 60000);

      // 更新快取
      rateLimitCache.set(lineUserId, { lastAttempt, attemptsToday });

      return {
        allowed: false,
        message: `⏳ 系統冷卻中，請等待 ${waitMinutes} 分鐘後再嘗試`,
        waitMinutes
      };
    }

    // 檢查每日嘗試次數
    const currentAttempts = shouldResetDaily ? 0 : attemptsToday;
    if (currentAttempts >= MAX_ATTEMPTS_PER_DAY) {
      return {
        allowed: false,
        message: `🚫 今日註冊嘗試次數已達上限（${MAX_ATTEMPTS_PER_DAY}次），請明天再試`,
        waitMinutes: -1  // 表示需要等到明天
      };
    }
  }

  return { allowed: true, message: '', waitMinutes: 0 };
}

/**
 * 🆕 記錄註冊嘗試（不管成功失敗都要記錄）
 */
async function recordRegistrationAttempt(lineUserId, success = false, email = null) {
  const now = admin.firestore.Timestamp.now();
  const today = new Date().toISOString().slice(0, 10);

  const rateLimitRef = db.collection('rateLimits').doc(lineUserId);
  const rateLimitDoc = await rateLimitRef.get();

  let attemptsToday = 1;
  let totalAttempts = 1;

  if (rateLimitDoc.exists) {
    const data = rateLimitDoc.data();
    const lastResetDate = data.lastResetDate || '';
    attemptsToday = lastResetDate === today ? (data.attemptsToday || 0) + 1 : 1;
    totalAttempts = (data.totalAttempts || 0) + 1;
  }

  await rateLimitRef.set({
    lineUserId,
    lastAttempt: now,
    lastResetDate: today,
    attemptsToday,
    totalAttempts,
    lastEmail: email,
    lastSuccess: success,
    updatedAt: now
  }, { merge: true });

  // 更新快取
  rateLimitCache.set(lineUserId, {
    lastAttempt: now.toMillis(),
    attemptsToday
  });
}

// ==========================================
// 🆕 UltraCloud 路由函數
// ==========================================
const ULTRACLOUD_WEBHOOK_URL = 'https://ultracloud-delta.vercel.app/api/webhook';

/**
 * 判斷是否應該路由到 UltraCloud
 * - 檔案類型訊息（file, image, video, audio）
 * - 群組/聊天室的檔案訊息
 * - 特定指令（找 xxx、檔案列表、幫助）
 */
function shouldRouteToUltraCloud(event) {
  console.log('=== UltraCloud Route Check ===');
  console.log('event.type:', event.type);

  if (event.type !== 'message') {
    console.log('Not a message event, skip UltraCloud');
    return false;
  }

  const message = event.message;
  const source = event.source;

  console.log('message.type:', message.type);
  console.log('source.type:', source.type);
  console.log('source.groupId:', source.groupId);
  console.log('source.roomId:', source.roomId);

  // 檔案類型訊息 → 轉給 UltraCloud
  if (['file', 'image', 'video', 'audio'].includes(message.type)) {
    console.log('File type detected');
    // 只有群組或聊天室的檔案才轉發（1對1私訊不轉發）
    if (source.type === 'group' || source.type === 'room') {
      console.log('>>> ROUTING TO ULTRACLOUD: file in group/room');
      return true;
    } else {
      console.log('Not in group/room, skip');
    }
  }

  // 文字指令 → 轉給 UltraCloud
  if (message.type === 'text') {
    const text = message.text.trim();
    console.log('Text message:', text);
    // 群組/聊天室中的 UltraCloud 指令
    if (source.type === 'group' || source.type === 'room') {
      if (text.startsWith('找 ') || text.startsWith('找') ||
          text.startsWith('檔案列表') || text === '列表' ||
          text === '幫助' || text === 'help' || text === '?') {
        console.log('>>> ROUTING TO ULTRACLOUD: command in group/room');
        return true;
      }
    }
  }

  console.log('Not routing to UltraCloud');
  return false;
}

/**
 * 轉發事件到 UltraCloud
 * 對於檔案類型，會先下載檔案內容再轉發
 */
async function forwardToUltraCloud(event) {
  try {
    const message = event.message;
    let payload = { events: [event] };

    // 如果是檔案類型，先下載內容
    if (['file', 'image', 'video', 'audio'].includes(message?.type)) {
      console.log('Downloading file content before forwarding...');

      try {
        // 從 LINE 下載檔案
        const response = await axios.get(
          `https://api-data.line.me/v2/bot/message/${message.id}/content`,
          {
            headers: {
              'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
            },
            responseType: 'arraybuffer',
            timeout: 30000
          }
        );

        // 轉成 base64
        const base64Content = Buffer.from(response.data).toString('base64');
        console.log('File downloaded, size:', response.data.length, 'bytes');

        // 加入檔案內容到 payload
        payload.fileContent = base64Content;
        payload.fileSize = response.data.length;
      } catch (downloadError) {
        console.error('Failed to download file:', downloadError.message);
        // 繼續轉發，讓 UltraCloud 處理錯誤
      }
    }

    await axios.post(ULTRACLOUD_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 55000, // 55 秒 timeout（Vercel 函數最長 60 秒）
      maxContentLength: 50 * 1024 * 1024, // 50MB
      maxBodyLength: 50 * 1024 * 1024
    });
    console.log('Event forwarded to UltraCloud successfully');
  } catch (error) {
    console.error('Failed to forward to UltraCloud:', error.message);
    // 不拋出錯誤，避免影響主流程
  }
}

/**
 * 驗證 LINE Webhook 簽章
 */
function validateSignature(body, signature) {
  if (!LINE_CHANNEL_SECRET) return false;
  const hash = crypto
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  return hash === signature;
}

/**
 * 發送 LINE 訊息
 */
async function sendLineMessage(userId, messages) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.log('LINE token not configured, skipping message');
    return;
  }
  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/push',
      { to: userId, messages: messages },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
        }
      }
    );
  } catch (error) {
    console.error('LINE message send error:', error.response?.data || error.message);
    throw error;
  }
}

// ==========================================
// 🆕 LINE Bot 內容載入（從 Firestore）
// ==========================================

// 快取 LINE Bot 內容（避免每次都讀 Firestore）
let lineBotContentCache = {
  welcome: null,
  keywords: null,
  notifications: null,
  lastFetch: 0
};
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘快取

/**
 * 載入 LINE Bot 歡迎訊息設定
 */
async function getWelcomeMessages() {
  const now = Date.now();
  if (lineBotContentCache.welcome && (now - lineBotContentCache.lastFetch) < CACHE_TTL) {
    return lineBotContentCache.welcome;
  }

  try {
    const doc = await db.collection('lineBotContent').doc('welcome').get();
    if (doc.exists) {
      lineBotContentCache.welcome = doc.data();
      lineBotContentCache.lastFetch = now;
      return lineBotContentCache.welcome;
    }
  } catch (err) {
    console.error('Failed to load welcome messages:', err);
  }

  // 預設值
  return {
    newFollower: '🎉 歡迎加入 Ultra Advisor！\n\n我是你的專屬 AI 財務軍師\n━━━━━━━━━━━━━━\n\n💎 立即獲得 7 天免費試用\n✓ 18 種專業理財工具\n✓ 無限客戶檔案\n✓ AI 智能建議\n\n🎁 推薦好友：完成註冊 +100 UA，付費後雙方各得 1000 UA！\n\n━━━━━━━━━━━━━━\n\n📧 請直接傳送你的 Email 開始試用！',
    newFollowerEnabled: true,
    memberLinked: '🎉 綁定成功！\n\n{{name}} 您好，您的帳號已成功綁定。\n\n現在您可以透過 LINE 接收：\n✅ 會員到期提醒\n✅ 最新功能通知\n✅ 專屬優惠資訊',
    memberLinkedEnabled: true
  };
}

/**
 * 載入關鍵字回覆設定
 */
async function getKeywordReplies() {
  const now = Date.now();
  if (lineBotContentCache.keywords && (now - lineBotContentCache.lastFetch) < CACHE_TTL) {
    return lineBotContentCache.keywords;
  }

  try {
    const doc = await db.collection('lineBotContent').doc('keywords').get();
    if (doc.exists) {
      lineBotContentCache.keywords = doc.data().items || [];
      lineBotContentCache.lastFetch = now;
      return lineBotContentCache.keywords;
    }
  } catch (err) {
    console.error('Failed to load keyword replies:', err);
  }

  return [];
}

/**
 * 載入系統通知設定
 */
async function getNotificationSettings() {
  const now = Date.now();
  if (lineBotContentCache.notifications && (now - lineBotContentCache.lastFetch) < CACHE_TTL) {
    return lineBotContentCache.notifications;
  }

  try {
    const doc = await db.collection('lineBotContent').doc('notifications').get();
    if (doc.exists) {
      lineBotContentCache.notifications = doc.data();
      lineBotContentCache.lastFetch = now;
      return lineBotContentCache.notifications;
    }
  } catch (err) {
    console.error('Failed to load notification settings:', err);
  }

  // 預設值
  return {
    expiryReminder7Days: '⏰ 會員即將到期提醒\n\n{{name}} 您好，\n您的會員資格將在 7 天後到期。\n\n立即續費可享優惠價格！\n👉 https://ultra-advisor.tw/pricing',
    expiryReminder7DaysEnabled: true,
    expiryReminder1Day: '🚨 會員明天到期！\n\n{{name}} 您好，\n您的會員資格將在明天到期。\n\n到期後將無法使用進階工具，請盡快續費！\n👉 https://ultra-advisor.tw/pricing',
    expiryReminder1DayEnabled: true,
    paymentSuccess: '🎉 付款成功！\n\n{{name}} 您好，\n感謝您的支持！您的會員資格已延長。\n\n新到期日：{{expiryDate}}\n\n祝您使用愉快！',
    paymentSuccessEnabled: true
  };
}

/**
 * 替換訊息變數
 */
function replaceMessageVariables(message, variables = {}) {
  if (!message) return '';
  let result = message;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  }
  return result;
}

/**
 * 檢查關鍵字是否匹配
 */
function matchKeyword(userMessage, keywords, matchType) {
  const msg = userMessage.toLowerCase();
  return keywords.some(keyword => {
    const kw = keyword.toLowerCase();
    switch (matchType) {
      case 'exact':
        return msg === kw;
      case 'startsWith':
        return msg.startsWith(kw);
      case 'contains':
      default:
        return msg.includes(kw);
    }
  });
}

// ==========================================
// 🆕 UA 點數系統 - 工具函數
// ==========================================

/**
 * 取得用戶的點數倍率
 */
async function getUserMultiplier(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return 1.0;
    
    const userData = userDoc.data();
    const primaryTierId = userData.primaryTierId || 'trial';
    
    const tiersSnapshot = await db.collection('membershipTiers')
      .where('slug', '==', primaryTierId)
      .limit(1)
      .get();
    
    if (tiersSnapshot.empty) return 1.0;
    return tiersSnapshot.docs[0].data().pointsMultiplier || 1.0;
  } catch (error) {
    console.error('Error getting user multiplier:', error);
    return 1.0;
  }
}

/**
 * 取得點數規則
 */
async function getPointsRule(actionId) {
  try {
    const rulesSnapshot = await db.collection('pointsRules')
      .where('actionId', '==', actionId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (rulesSnapshot.empty) return null;
    return { id: rulesSnapshot.docs[0].id, ...rulesSnapshot.docs[0].data() };
  } catch (error) {
    console.error('Error getting points rule:', error);
    return null;
  }
}

/**
 * 檢查每日限制
 */
async function checkDailyLimit(userId, actionId, dailyMax) {
  if (!dailyMax) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const snapshot = await db.collection('pointsLedger')
    .where('userId', '==', userId)
    .where('actionId', '==', actionId)
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
    .get();
  
  return snapshot.size >= dailyMax;
}

/**
 * 檢查每週限制
 */
async function checkWeeklyLimit(userId, actionId, weeklyMax) {
  if (!weeklyMax) return false;
  
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const snapshot = await db.collection('pointsLedger')
    .where('userId', '==', userId)
    .where('actionId', '==', actionId)
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(weekStart))
    .get();
  
  return snapshot.size >= weeklyMax;
}

/**
 * 檢查總計限制
 */
async function checkTotalLimit(userId, actionId, totalMax) {
  if (!totalMax) return false;
  
  const snapshot = await db.collection('pointsLedger')
    .where('userId', '==', userId)
    .where('actionId', '==', actionId)
    .get();
  
  return snapshot.size >= totalMax;
}

/**
 * 發放點數（核心函數）
 */
async function awardPoints(userId, actionId, reason, referenceId = null) {
  try {
    const rule = await getPointsRule(actionId);
    if (!rule) {
      console.log(`Rule not found or inactive: ${actionId}`);
      return { success: false, reason: 'rule_not_found' };
    }
    
    const limits = rule.limits || {};
    
    if (limits.dailyMax && await checkDailyLimit(userId, actionId, limits.dailyMax)) {
      return { success: false, reason: 'daily_limit_reached' };
    }
    
    if (limits.weeklyMax && await checkWeeklyLimit(userId, actionId, limits.weeklyMax)) {
      return { success: false, reason: 'weekly_limit_reached' };
    }
    
    if (limits.totalMax && await checkTotalLimit(userId, actionId, limits.totalMax)) {
      return { success: false, reason: 'total_limit_reached' };
    }
    
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return { success: false, reason: 'user_not_found' };
    }
    
    const userData = userDoc.data();
    
    // 檢查身分組是否可獲得點數
    const tiersSnapshot = await db.collection('membershipTiers')
      .where('slug', '==', userData.primaryTierId || 'trial')
      .limit(1)
      .get();
    
    if (!tiersSnapshot.empty) {
      const tierData = tiersSnapshot.docs[0].data();
      if (!tierData.permissions?.canEarnPoints) {
        return { success: false, reason: 'tier_cannot_earn_points' };
      }
    }
    
    const multiplier = await getUserMultiplier(userId);
    const basePoints = rule.basePoints;
    const finalPoints = Math.floor(basePoints * multiplier);
    
    const currentPoints = typeof userData.points === 'object' ? (userData.points?.current || 0) : (userData.points || 0);
    const newBalance = currentPoints + finalPoints;
    
    // 12 個月後過期
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);
    
    await db.runTransaction(async (transaction) => {
      const ledgerRef = db.collection('pointsLedger').doc();
      transaction.set(ledgerRef, {
        userId,
        userEmail: userData.email,
        type: 'earn',
        amount: finalPoints,
        balanceBefore: currentPoints,
        balanceAfter: newBalance,
        actionId,
        reason: reason || rule.name,
        referenceType: 'rule',
        referenceId: referenceId || rule.id,
        multiplierApplied: multiplier,
        baseAmount: basePoints,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        isExpired: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'system',
      });
      
      transaction.update(userRef, {
        'points.current': newBalance,
        totalPointsEarned: admin.firestore.FieldValue.increment(finalPoints),
        lastPointsEarnedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    
    console.log(`Awarded ${finalPoints} points to ${userId} for ${actionId}`);
    
    return { success: true, points: finalPoints, multiplier, newBalance };
    
  } catch (error) {
    console.error('Error awarding points:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

// ==========================================
// LINE Bot - 核心功能
// ==========================================

/**
 * 創建試用帳號（支援推薦碼）
 * @param {string} email - 用戶 Email
 * @param {string} lineUserId - LINE 用戶 ID
 * @param {string|null} inputReferralCode - 輸入的推薦碼（可選）
 */
async function createTrialAccount(email, lineUserId, inputReferralCode = null) {
  try {
    // 🆕 載入動態訊息設定
    const welcomeMessages = await getWelcomeMessages();

    const existingUsers = await auth.getUserByEmail(email).catch(() => null);
    if (existingUsers) {
      throw new Error('此 Email 已經註冊');
    }

    const password = generateRandomPassword();
    const newReferralCode = generateReferralCode(email);

    const userRecord = await auth.createUser({
      email: email,
      password: password,
      emailVerified: false,
      disabled: false
    });

    const now = admin.firestore.Timestamp.now();

    // 🆕 決定身分組（根據是否有推薦碼）
    let tierId = 'trial';
    let referredByUid = null;
    let referrerName = null;

    if (inputReferralCode) {
      const codeDoc = await db.collection('referralCodes').doc(inputReferralCode.toUpperCase()).get();
      if (codeDoc.exists && codeDoc.data().isActive) {
        tierId = 'referral_trial';
        referredByUid = codeDoc.data().ownerId;

        // 取得推薦人名稱
        const referrerDoc = await db.collection('users').doc(referredByUid).get();
        if (referrerDoc.exists) {
          const referrerData = referrerDoc.data();
          referrerName = referrerData.displayName || referrerData.email?.split('@')[0] || '會員';
        }

        // 更新推薦碼使用次數
        await codeDoc.ref.update({
          usageCount: admin.firestore.FieldValue.increment(1),
          updatedAt: now,
        });

        // 更新推薦人的 referralCount
        await db.collection('users').doc(referredByUid).update({
          referralCount: admin.firestore.FieldValue.increment(1),
        });

        // 🆕 推薦好友完成註冊，推薦人獲得 +100 UA
        try {
          await awardPointsSimple(referredByUid, 100, `推薦好友 ${email.split('@')[0]} 完成註冊`);
          console.log(`Referral registration reward: +100 UA to ${referredByUid}`);
        } catch (err) {
          console.error('Referral registration reward error:', err);
        }
      }
    }

    // 🆕 天數制：新用戶有 7 天試用
    await db.collection('users').doc(userRecord.uid).set({
      email: email,
      createdAt: now,
      updatedAt: now,
      lineUserId: lineUserId,
      isActive: true,
      clients: [],
      stats: { trialsCompleted: 0, hoursSaved: 0 },
      // 🆕 天數制會員系統
      primaryTierId: tierId,
      daysRemaining: 7,  // 試用 7 天
      lastDayDeducted: null,
      graceDaysRemaining: 0,
      // 🆕 UA 點數
      points: { current: 0 },
      totalPointsEarned: 0,
      totalPointsSpent: 0,
      totalPointsExpired: 0,
      // 🆕 推薦系統
      referralCode: newReferralCode,
      referredBy: referredByUid,  // 誰推薦我的
      referralCount: 0,
      referralRewardClaimed: false,  // 付款後才發放獎勵
      // 🆕 追蹤
      toolUsageCount: 0,
      loginStreak: 0,
    });

    // 🆕 建立推薦碼索引
    await db.collection('referralCodes').doc(newReferralCode).set({
      code: newReferralCode,
      ownerId: userRecord.uid,
      ownerEmail: email,
      usageCount: 0,
      successCount: 0,
      totalPointsGenerated: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const loginUrl = APP_LOGIN_URL;

    // 🆕 根據身分組顯示不同訊息
    const tierText = tierId === 'referral_trial' ? '轉介紹試用' : '試用會員';
    const discountNote = tierId === 'referral_trial'
      ? `\n\n🎁 轉介紹優惠：購買時使用折扣碼「Miiroll7」可折 $999！`
      : '';
    const referrerNote = referrerName
      ? `\n👥 推薦人：${referrerName}`
      : '';

    // 🆕 使用後台設定的標題
    const accountCreatedTitle = welcomeMessages.accountCreatedTitle || '🎉 帳號開通成功';

    // 🆕 使用後台設定的密碼訊息
    let passwordMessageText = welcomeMessages.passwordMessageEnabled && welcomeMessages.passwordMessage
      ? replaceMessageVariables(welcomeMessages.passwordMessage, {
          password: password,
          referralCode: newReferralCode,
          referrerName: referrerName || '',
        })
      : `🔐 你的登入密碼（請妥善保管）：\n\n${password}\n\n⚠️ 請立即登入並修改密碼以確保安全\n\n📢 分享你的推薦碼「${newReferralCode}」給朋友！\n註冊成功 +100 UA，付費後雙方各得 1000 UA！`;

    // 加上推薦人和折扣資訊（如果後台訊息沒有包含的話）
    if (!passwordMessageText.includes(referrerNote) && referrerNote) {
      passwordMessageText += referrerNote;
    }
    if (!passwordMessageText.includes('折扣碼') && discountNote) {
      passwordMessageText += discountNote;
    }

    await sendLineMessage(lineUserId, [
      {
        type: 'flex',
        altText: accountCreatedTitle,
        contents: {
          type: 'bubble',
          hero: {
            type: 'box',
            layout: 'vertical',
            contents: [{ type: 'text', text: accountCreatedTitle, size: 'xl', weight: 'bold', color: '#ffffff' }],
            backgroundColor: tierId === 'referral_trial' ? '#8b5cf6' : '#3b82f6',
            paddingAll: '20px'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '登入資訊', weight: 'bold', size: 'md', margin: 'md' },
              {
                type: 'box',
                layout: 'vertical',
                margin: 'lg',
                spacing: 'sm',
                contents: [
                  { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
                    { type: 'text', text: 'Email', color: '#64748b', size: 'sm', flex: 2 },
                    { type: 'text', text: email, wrap: true, color: '#1e293b', size: 'sm', flex: 5 }
                  ]},
                  { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
                    { type: 'text', text: '身分', color: '#64748b', size: 'sm', flex: 2 },
                    { type: 'text', text: tierText, wrap: true, color: tierId === 'referral_trial' ? '#8b5cf6' : '#3b82f6', size: 'sm', flex: 5, weight: 'bold' }
                  ]},
                  { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
                    { type: 'text', text: '試用期', color: '#64748b', size: 'sm', flex: 2 },
                    { type: 'text', text: '7 天', wrap: true, color: '#1e293b', size: 'sm', flex: 5 }
                  ]},
                  { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
                    { type: 'text', text: '推薦碼', color: '#64748b', size: 'sm', flex: 2 },
                    { type: 'text', text: newReferralCode, wrap: true, color: '#f59e0b', size: 'sm', flex: 5, weight: 'bold' }
                  ]}
                ]
              }
            ]
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              { type: 'button', style: 'primary', height: 'sm', action: { type: 'uri', label: '立即登入', uri: loginUrl }, color: tierId === 'referral_trial' ? '#8b5cf6' : '#3b82f6' },
              { type: 'box', layout: 'baseline', contents: [
                { type: 'text', text: '⚠️ 密碼將在下一則訊息單獨傳送', color: '#64748b', size: 'xs', wrap: true }
              ], margin: 'md' }
            ]
          }
        }
      },
      {
        type: 'text',
        text: passwordMessageText
      }
    ]);

    console.log(`Trial account created: ${email}, tier: ${tierId}, referredBy: ${referredByUid || 'none'}`);
    return { success: true, uid: userRecord.uid, email: email, tierId };

  } catch (error) {
    console.error('Create trial account error:', error);
    throw error;
  }
}

// ==========================================
// LINE Webhook
// ==========================================

exports.lineWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const signature = req.headers['x-line-signature'];
  const body = JSON.stringify(req.body);
  
  if (!validateSignature(body, signature)) {
    console.error('Invalid signature');
    return res.status(401).send('Invalid signature');
  }

  const events = req.body.events;

  try {
    await Promise.all(events.map(handleEvent));
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 🆕 用戶狀態暫存（簡易實作，生產環境建議用 Firestore）
const userStates = new Map();

async function handleEvent(event) {
  const lineUserId = event.source.userId;

  // ==========================================
  // 🆕 UltraCloud 路由 - 檔案同步功能
  // ==========================================
  if (shouldRouteToUltraCloud(event)) {
    await forwardToUltraCloud(event);
    return;
  }

  // 🆕 載入動態內容
  const welcomeMessages = await getWelcomeMessages();
  const keywordReplies = await getKeywordReplies();

  if (event.type === 'follow') {
    // 清除舊狀態
    userStates.delete(lineUserId);

    // 🆕 LIFF 註冊按鈕（優先使用 Flex Message）
    // LIFF ID 需要從環境變數或設定中取得
    const LIFF_ID = functions.config().liff?.register_id || '2008863334-CiKr6VBU';
    const liffRegisterUrl = `https://liff.line.me/${LIFF_ID}`;

    // 發送帶有 LIFF 按鈕的 Flex Message
    await sendLineMessage(lineUserId, [
      {
        type: 'flex',
        altText: '🎉 歡迎加入 Ultra Advisor！點擊開通試用',
        contents: {
          type: 'bubble',
          hero: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '歡迎加入 Ultra Advisor', weight: 'bold', size: 'xl', color: '#ffffff' },
              { type: 'text', text: '財務顧問的秘密武器', size: 'sm', color: '#ffffffcc', margin: 'sm' }
            ],
            backgroundColor: '#2E6BFF',
            paddingAll: '24px',
            paddingTop: '32px',
            paddingBottom: '32px'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '🎁 7 天免費試用包含：',
                weight: 'bold',
                size: 'md',
                margin: 'md'
              },
              {
                type: 'box',
                layout: 'vertical',
                margin: 'lg',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: '✓ 全部 18 種專業理財工具', size: 'sm', color: '#555555' },
                  { type: 'text', text: '✓ 無限客戶檔案', size: 'sm', color: '#555555' },
                  { type: 'text', text: '✓ 報表匯出功能', size: 'sm', color: '#555555' }
                ]
              },
              {
                type: 'separator',
                margin: 'xl'
              },
              {
                type: 'text',
                text: '🎁 推薦好友：註冊 +100，付費 +1000 UA！',
                size: 'xs',
                color: '#f59e0b',
                margin: 'lg',
                weight: 'bold'
              }
            ],
            paddingAll: '20px'
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: [
              {
                type: 'button',
                style: 'primary',
                height: 'md',
                action: {
                  type: 'uri',
                  label: '🚀 立即開通試用',
                  uri: liffRegisterUrl
                },
                color: '#2E6BFF'
              },
              {
                type: 'button',
                style: 'link',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: '已有帳號？直接登入',
                  uri: 'https://ultra-advisor.tw/login'
                }
              }
            ],
            paddingAll: '16px'
          }
        }
      }
    ]);
    return;
  }

  if (event.type === 'message' && event.message.type === 'text') {
    const userMessage = event.message.text.trim();
    const state = userStates.get(lineUserId) || { step: 'IDLE' };

    // 🆕 狀態機處理
    switch (state.step) {
      case 'WAIT_REFERRAL':
        // 用戶回覆推薦碼或「無」
        await handleReferralInput(lineUserId, userMessage, state);
        break;

      default:
        // 🆕 先檢查關鍵字回覆
        const matchedKeyword = keywordReplies.find(kw =>
          kw.enabled && kw.keywords?.length && matchKeyword(userMessage, kw.keywords, kw.matchType)
        );

        if (matchedKeyword) {
          await sendLineMessage(lineUserId, [
            { type: 'text', text: matchedKeyword.reply }
          ]);
          return;
        }

        // IDLE 狀態：等待 Email
        if (isValidEmail(userMessage)) {
          // 儲存 Email，詢問推薦碼
          userStates.set(lineUserId, { step: 'WAIT_REFERRAL', email: userMessage });

          // 🆕 使用後台設定的「收到 Email」訊息
          const emailReceivedMsg = welcomeMessages.emailReceivedEnabled && welcomeMessages.emailReceived
            ? welcomeMessages.emailReceived.replace('{{email}}', userMessage)
            : `✅ Email 確認：${userMessage}\n\n請問有朋友的推薦碼嗎？\n\n有的話請輸入推薦碼，沒有請輸入「無」`;

          await sendLineMessage(lineUserId, [
            { type: 'text', text: emailReceivedMsg + `\n\n📧 Email: ${userMessage}\n\n🎟️ 請問有朋友的推薦碼嗎？\n有的話請輸入，沒有請輸入「無」` }
          ]);
        } else {
          await sendLineMessage(lineUserId, [
            { type: 'text', text: '📧 請傳送你的 Email 來開始試用！\n\n範例：your@email.com' }
          ]);
        }
        break;
    }
  }
}

/**
 * 處理推薦碼輸入
 */
async function handleReferralInput(lineUserId, userMessage, state) {
  const email = state.email;
  let referralCode = null;

  // 🆕 防刷機制：檢查速率限制
  const rateCheck = await checkRateLimit(lineUserId);
  if (!rateCheck.allowed) {
    userStates.delete(lineUserId);
    await sendLineMessage(lineUserId, [
      { type: 'text', text: rateCheck.message }
    ]);
    return;
  }

  if (userMessage.toLowerCase() !== '無' && userMessage.toLowerCase() !== 'no' && userMessage.toLowerCase() !== 'none') {
    // 驗證推薦碼
    const codeDoc = await db.collection('referralCodes').doc(userMessage.toUpperCase()).get();

    if (codeDoc.exists && codeDoc.data().isActive) {
      referralCode = userMessage.toUpperCase();
      await sendLineMessage(lineUserId, [
        { type: 'text', text: `✅ 推薦碼有效！正在為你開通帳號...\n\n🎁 恭喜獲得轉介紹優惠：購買時可折 $999！` }
      ]);
    } else {
      await sendLineMessage(lineUserId, [
        { type: 'text', text: '❌ 推薦碼無效，將以一般試用身分註冊...' }
      ]);
    }
  } else {
    await sendLineMessage(lineUserId, [
      { type: 'text', text: '⏳ 正在為你開通帳號，請稍候...' }
    ]);
  }

  // 清除狀態
  userStates.delete(lineUserId);

  // 創建帳號
  try {
    await createTrialAccount(email, lineUserId, referralCode);
    // 🆕 只有成功註冊才計入冷卻時間（防止同一人用不同 Email 大量刷帳號）
    await recordRegistrationAttempt(lineUserId, true, email);
  } catch (error) {
    console.error('Account creation error:', error);

    // 🆕 失敗不計入冷卻（不管是 Email 重複還是系統錯誤，都不應懲罰用戶）
    let errorMessage = '❌ 帳號開通失敗，請稍後再試';
    if (error.message.includes('已經註冊')) {
      errorMessage = '⚠️ 此 Email 已經註冊過囉！\n\n👉 請直接用這個 Email 登入系統\n👉 或使用其他 Email 重新註冊\n\n如需協助請聯繫客服';
    }
    await sendLineMessage(lineUserId, [{ type: 'text', text: errorMessage }]);
  }
}

// ==========================================
// 🆕 UA 點數系統 - Cloud Functions
// ==========================================

/**
 * 每日登入獎勵
 */
exports.onDailyLogin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  
  const userId = context.auth.uid;
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', '用戶不存在');
  }
  
  const userData = userDoc.data();
  const lastLogin = userData.lastLoginAt?.toDate();
  const now = new Date();
  
  let newStreak = 1;
  if (lastLogin) {
    const lastLoginDate = new Date(lastLogin);
    lastLoginDate.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - lastLoginDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      newStreak = (userData.loginStreak || 0) + 1;
    } else if (diffDays === 0) {
      newStreak = userData.loginStreak || 1;
    }
  }
  
  await userRef.update({
    lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    loginStreak: newStreak,
  });
  
  const dailyResult = await awardPoints(userId, 'daily_login', '每日登入獎勵');
  
  let streakResult = null;
  if (newStreak === 7) {
    streakResult = await awardPoints(userId, 'login_streak_7', '連續登入 7 天獎勵');
  } else if (newStreak === 30) {
    streakResult = await awardPoints(userId, 'login_streak_30', '連續登入 30 天獎勵');
  }
  
  return { success: true, loginStreak: newStreak, dailyReward: dailyResult, streakReward: streakResult };
});

/**
 * 工具使用獎勵
 */
exports.onToolUse = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  
  const userId = context.auth.uid;
  const { toolName } = data;
  
  await db.collection('users').doc(userId).update({
    toolUsageCount: admin.firestore.FieldValue.increment(1),
  });
  
  return await awardPoints(userId, 'tool_use', `使用工具: ${toolName || '未知工具'}`);
});

/**
 * 建立首位客戶獎勵
 */
exports.onFirstClient = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  return await awardPoints(context.auth.uid, 'first_client', '建立首位客戶獎勵');
});

/**
 * 推薦獎勵處理（雙向）
 */
exports.processReferral = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  
  const { referralCode } = data;
  const newUserId = context.auth.uid;
  
  if (!referralCode) {
    throw new functions.https.HttpsError('invalid-argument', '請提供推薦碼');
  }
  
  const codeDoc = await db.collection('referralCodes').doc(referralCode).get();
  if (!codeDoc.exists) {
    throw new functions.https.HttpsError('not-found', '推薦碼不存在');
  }
  
  const codeData = codeDoc.data();
  
  if (codeData.ownerId === newUserId) {
    throw new functions.https.HttpsError('invalid-argument', '不能使用自己的推薦碼');
  }
  
  const newUserDoc = await db.collection('users').doc(newUserId).get();
  if (newUserDoc.exists && newUserDoc.data().referredBy) {
    throw new functions.https.HttpsError('already-exists', '您已經使用過推薦碼');
  }
  
  const referrerId = codeData.ownerId;
  
  await db.runTransaction(async (transaction) => {
    transaction.update(db.collection('users').doc(newUserId), { referredBy: referrerId });
    transaction.update(db.collection('users').doc(referrerId), {
      referralCount: admin.firestore.FieldValue.increment(1),
    });
    transaction.update(db.collection('referralCodes').doc(referralCode), {
      usageCount: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  
  const referrerReward = await awardPoints(referrerId, 'referral_success', '推薦用戶成功', newUserId);
  const newUserReward = await awardPoints(newUserId, 'referred_bonus', '透過推薦碼註冊獎勵', referrerId);
  
  return { success: true, referrerReward, newUserReward };
});

/**
 * 更新推薦碼
 */
exports.updateReferralCode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  
  const userId = context.auth.uid;
  const { newCode } = data;
  
  if (!newCode || newCode.length < 4 || newCode.length > 20) {
    throw new functions.https.HttpsError('invalid-argument', '推薦碼長度需為 4-20 字元');
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(newCode)) {
    throw new functions.https.HttpsError('invalid-argument', '推薦碼只能包含英文、數字、底線和橫線');
  }
  
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  
  const tiersSnapshot = await db.collection('membershipTiers')
    .where('slug', '==', userData.primaryTierId || 'trial')
    .limit(1)
    .get();
  
  if (!tiersSnapshot.empty) {
    const tierData = tiersSnapshot.docs[0].data();
    if (!tierData.permissions?.canCustomReferral) {
      throw new functions.https.HttpsError('permission-denied', '您的會員等級無法自訂推薦碼');
    }
  }
  
  const existingCode = await db.collection('referralCodes').doc(newCode).get();
  if (existingCode.exists) {
    throw new functions.https.HttpsError('already-exists', '此推薦碼已被使用');
  }
  
  const oldCode = userData.referralCode;
  
  await db.runTransaction(async (transaction) => {
    if (oldCode) {
      transaction.delete(db.collection('referralCodes').doc(oldCode));
    }
    transaction.set(db.collection('referralCodes').doc(newCode), {
      ownerId: userId,
      ownerEmail: userData.email,
      usageCount: 0,
      successCount: 0,
      totalPointsGenerated: 0,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.update(db.collection('users').doc(userId), { referralCode: newCode });
  });
  
  return { success: true, newCode };
});

/**
 * 取得用戶點數摘要
 */
exports.getUserPointsSummary = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  
  const userId = context.auth.uid;
  const userDoc = await db.collection('users').doc(userId).get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', '用戶不存在');
  }
  
  const userData = userDoc.data();
  
  const recentLedger = await db.collection('pointsLedger')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  
  const thirtyDaysLater = new Date();
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
  
  const expiringSnapshot = await db.collection('pointsLedger')
    .where('userId', '==', userId)
    .where('type', '==', 'earn')
    .where('isExpired', '==', false)
    .where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(thirtyDaysLater))
    .get();
  
  let expiringPoints = 0;
  expiringSnapshot.docs.forEach((doc) => { expiringPoints += doc.data().amount; });
  
  return {
    currentPoints: typeof userData.points === 'object' ? (userData.points?.current || 0) : (userData.points || 0),
    totalEarned: userData.totalPointsEarned || 0,
    totalSpent: userData.totalPointsSpent || 0,
    totalExpired: userData.totalPointsExpired || 0,
    loginStreak: userData.loginStreak || 0,
    referralCode: userData.referralCode,
    referralCount: userData.referralCount || 0,
    expiringIn30Days: expiringPoints,
    recentTransactions: recentLedger.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    })),
  };
});

/**
 * 管理員手動發放獎勵
 */
exports.awardActivityPoints = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  
  const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', '需要管理員權限');
  }
  
  const { userId, actionId, reason } = data;
  
  if (!userId || !actionId) {
    throw new functions.https.HttpsError('invalid-argument', '請提供 userId 和 actionId');
  }
  
  const result = await awardPoints(userId, actionId, reason || '管理員發放');
  
  await db.collection('auditLogs').add({
    adminId: context.auth.uid,
    adminEmail: context.auth.token.email,
    action: 'user.points.award',
    targetType: 'user',
    targetId: userId,
    changes: { actionId, reason, result, description: `手動發放點數: ${actionId}` },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  return result;
});

// ==========================================
// 🆕 Phase 1：天數制會員系統
// ==========================================

/**
 * 驗證推薦碼
 * 輸入：{ code: "WANG123" }
 * 輸出：{ valid: true, ownerName: "王小明" } 或 { valid: false }
 */
exports.validateReferralCode = functions.https.onCall(async (data, context) => {
  const { code } = data;

  if (!code) {
    return { valid: false, message: '請提供推薦碼' };
  }

  try {
    const codeDoc = await db.collection('referralCodes').doc(code.toUpperCase()).get();

    if (!codeDoc.exists || !codeDoc.data().isActive) {
      return { valid: false, message: '推薦碼無效或已停用' };
    }

    // 取得推薦人名稱
    const ownerDoc = await db.collection('users').doc(codeDoc.data().ownerId).get();
    const ownerData = ownerDoc.data();

    return {
      valid: true,
      ownerId: codeDoc.data().ownerId,
      ownerName: ownerData?.displayName || ownerData?.email?.split('@')[0] || '會員',
    };
  } catch (error) {
    console.error('validateReferralCode error:', error);
    return { valid: false, message: '驗證失敗' };
  }
});

/**
 * 處理付款（Admin 用）
 * 輸入：{ userEmail, days: 365, amount: 8999, notes?: "備註" }
 * 輸出：{ success: true, newDaysRemaining: 372 }
 */
exports.processPayment = functions.https.onCall(async (data, context) => {
  // 驗證是否為 Admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', '需要管理員權限');
  }

  const { userEmail, days, amount, notes } = data;

  if (!userEmail || !days) {
    throw new functions.https.HttpsError('invalid-argument', '請提供用戶 Email 和天數');
  }

  // 1. 找到用戶
  const usersSnapshot = await db.collection('users')
    .where('email', '==', userEmail)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    throw new functions.https.HttpsError('not-found', '找不到此用戶');
  }

  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();
  const userId = userDoc.id;

  // 2. 計算新天數
  const currentDays = userData.daysRemaining || 0;
  const newDaysRemaining = currentDays + days;

  // 3. 更新用戶資料
  const updateData = {
    primaryTierId: 'paid',
    daysRemaining: newDaysRemaining,
    graceDaysRemaining: 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await userDoc.ref.update(updateData);

  // 4. 發放推薦獎勵（如果有推薦人且尚未領取）
  // 🆕 付費獎勵改為 1000 UA（原 500）
  let referralRewardGiven = false;
  if (userData.referredBy && !userData.referralRewardClaimed) {
    try {
      // 推薦人 +1000
      await awardPointsSimple(userData.referredBy, 1000, '推薦好友成功付費');
      // 被推薦人 +1000
      await awardPointsSimple(userId, 1000, '使用推薦碼註冊並付費獎勵');
      // 標記已領取
      await userDoc.ref.update({ referralRewardClaimed: true });

      // 更新推薦碼統計
      if (userData.referralCode) {
        const referrerDoc = await db.collection('users').doc(userData.referredBy).get();
        if (referrerDoc.exists) {
          const referrerCode = referrerDoc.data().referralCode;
          if (referrerCode) {
            await db.collection('referralCodes').doc(referrerCode).update({
              successCount: admin.firestore.FieldValue.increment(1),
              totalPointsGenerated: admin.firestore.FieldValue.increment(2000),  // 雙方各 1000
            });
          }
        }
      }

      referralRewardGiven = true;
    } catch (err) {
      console.error('Referral reward error:', err);
    }
  }

  // 5. 記錄付款歷史
  await db.collection('paymentHistory').add({
    userId,
    userEmail,
    days,
    amount: amount || 0,
    notes: notes || '',
    previousDays: currentDays,
    newDaysRemaining,
    referralRewardGiven,
    processedBy: context.auth.uid,
    processedByEmail: context.auth.token.email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 6. 發送 LINE 通知（使用後台設定的訊息）
  if (userData.lineUserId) {
    try {
      const notificationSettings = await getNotificationSettings();
      if (notificationSettings.paymentSuccessEnabled) {
        const message = replaceMessageVariables(
          notificationSettings.paymentSuccess || `🎉 付款成功！\n\n已為您加值 ${days} 天\n目前剩餘天數：${newDaysRemaining} 天\n\n感謝您的支持！`,
          {
            name: userData.displayName || userData.email?.split('@')[0] || '用戶',
            days: days.toString(),
            daysRemaining: newDaysRemaining.toString(),
            expiryDate: new Date(Date.now() + newDaysRemaining * 24 * 60 * 60 * 1000).toLocaleDateString('zh-TW')
          }
        );
        await sendLineMessage(userData.lineUserId, [{ type: 'text', text: message }]);
      }
    } catch (err) {
      console.error('LINE notification error:', err);
    }
  }

  console.log(`Payment processed: ${userEmail} +${days} days, total: ${newDaysRemaining}`);

  return {
    success: true,
    newDaysRemaining,
    referralRewardGiven,
    userId,
  };
});

// ==========================================
// 🆕 Admin 重設用戶密碼
// ==========================================

/**
 * Admin 重設用戶密碼
 * 輸入：{ userEmail, newPassword }
 * 輸出：{ success: true }
 */
exports.adminResetPassword = functions.https.onCall(async (data, context) => {
  // 驗證是否為 Admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  // 驗證 Admin 權限（可選：檢查是否在 admins 集合中）
  const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', '需要管理員權限');
  }

  const { userEmail, newPassword } = data;

  if (!userEmail) {
    throw new functions.https.HttpsError('invalid-argument', '請提供用戶 Email');
  }

  if (!newPassword || newPassword.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', '密碼至少需要 6 個字元');
  }

  try {
    // 透過 Email 查找用戶
    const userRecord = await auth.getUserByEmail(userEmail);

    // 更新密碼
    await auth.updateUser(userRecord.uid, {
      password: newPassword,
    });

    // 記錄操作日誌
    await db.collection('auditLogs').add({
      action: 'admin_reset_password',
      targetEmail: userEmail,
      targetUid: userRecord.uid,
      performedBy: context.auth.uid,
      performedByEmail: context.auth.token.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Admin reset password: ${userEmail} by ${context.auth.token.email}`);

    return {
      success: true,
      message: `已成功重設 ${userEmail} 的密碼`,
    };
  } catch (error) {
    console.error('Admin reset password error:', error);
    if (error.code === 'auth/user-not-found') {
      throw new functions.https.HttpsError('not-found', '找不到該用戶');
    }
    throw new functions.https.HttpsError('internal', '重設密碼失敗：' + error.message);
  }
});

/**
 * 簡易發放點數（不經過規則檢查）
 */
async function awardPointsSimple(userId, amount, reason) {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) return;

  const userData = userDoc.data();
  const currentPoints = typeof userData.points === 'object'
    ? (userData.points?.current || 0)
    : (userData.points || 0);
  const newBalance = currentPoints + amount;

  await db.runTransaction(async (transaction) => {
    transaction.update(userRef, {
      'points.current': newBalance,
      totalPointsEarned: admin.firestore.FieldValue.increment(amount),
    });

    transaction.set(db.collection('pointsLedger').doc(), {
      userId,
      userEmail: userData.email,
      type: 'earn',
      amount,
      balanceBefore: currentPoints,
      balanceAfter: newBalance,
      reason,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system',
    });
  });

  console.log(`Awarded ${amount} points to ${userId}: ${reason}`);
}

/**
 * 每日扣除天數（台灣時間 00:05）
 */
exports.deductDailyDays = functions.pubsub
  .schedule('5 0 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('Starting daily days deduction...');

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const notifications = [];

    // 🆕 載入後台通知設定
    const notificationSettings = await getNotificationSettings();

    // 1. 處理付費用戶（排除 founder）
    const paidUsers = await db.collection('users')
      .where('primaryTierId', '==', 'paid')
      .get();

    console.log(`Found ${paidUsers.size} paid users`);

    for (const doc of paidUsers.docs) {
      const data = doc.data();

      // 跳過今天已扣過的
      if (data.lastDayDeducted === today) continue;

      const currentDays = data.daysRemaining || 0;
      const newDays = Math.max(0, currentDays - 1);
      const userName = data.displayName || data.email?.split('@')[0] || '用戶';

      const updateData = {
        daysRemaining: newDays,
        lastDayDeducted: today,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // 🆕 使用後台設定的到期提醒訊息
      if (newDays === 7 && notificationSettings.expiryReminder7DaysEnabled) {
        notifications.push({
          lineUserId: data.lineUserId,
          message: replaceMessageVariables(notificationSettings.expiryReminder7Days, {
            name: userName,
            daysRemaining: '7'
          }),
        });
      } else if (newDays === 1 && notificationSettings.expiryReminder1DayEnabled) {
        notifications.push({
          lineUserId: data.lineUserId,
          message: replaceMessageVariables(notificationSettings.expiryReminder1Day, {
            name: userName,
            daysRemaining: '1'
          }),
        });
      } else if (newDays === 30 || newDays === 3) {
        // 30天和3天仍使用原本的訊息
        notifications.push({
          lineUserId: data.lineUserId,
          message: `⏰ 您的 Ultra Advisor 剩餘 ${newDays} 天，記得續訂喔！\n\n續訂連結：https://portaly.cc/GinRollBT`,
        });
      } else if (newDays <= 0) {
        // 進入寬限期
        updateData.primaryTierId = 'grace';
        updateData.daysRemaining = 0;
        updateData.graceDaysRemaining = 3;

        notifications.push({
          lineUserId: data.lineUserId,
          message: '⚠️ 您的 Ultra Advisor 天數已用完！\n\n已進入 3 天寬限期，部分功能將受限。\n\n立即續訂：https://portaly.cc/GinRollBT',
        });
      }

      await doc.ref.update(updateData);
    }

    // 2. 處理寬限期用戶
    const graceUsers = await db.collection('users')
      .where('primaryTierId', '==', 'grace')
      .get();

    console.log(`Found ${graceUsers.size} grace users`);

    for (const doc of graceUsers.docs) {
      const data = doc.data();
      const currentGraceDays = data.graceDaysRemaining || 0;
      const newGraceDays = Math.max(0, currentGraceDays - 1);

      if (newGraceDays <= 0) {
        // 寬限期結束，變為過期
        await doc.ref.update({
          primaryTierId: 'expired',
          graceDaysRemaining: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        notifications.push({
          lineUserId: data.lineUserId,
          message: '❌ 您的 Ultra Advisor 已過期！\n\n所有進階功能已停用。\n\n立即續訂恢復使用：https://portaly.cc/GinRollBT',
        });
      } else {
        await doc.ref.update({
          graceDaysRemaining: newGraceDays,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    // 3. 處理試用用戶天數
    const trialUsers = await db.collection('users')
      .where('primaryTierId', 'in', ['trial', 'referral_trial'])
      .get();

    console.log(`Found ${trialUsers.size} trial users`);

    for (const doc of trialUsers.docs) {
      const data = doc.data();

      if (data.lastDayDeducted === today) continue;

      const currentDays = data.daysRemaining || 0;
      const newDays = Math.max(0, currentDays - 1);

      const updateData = {
        daysRemaining: newDays,
        lastDayDeducted: today,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (newDays === 3 || newDays === 1) {
        const upgradeLink = data.primaryTierId === 'referral_trial'
          ? 'https://portaly.cc/GinRollBT（使用折扣碼 Miiroll7 可折 $999）'
          : 'https://portaly.cc/GinRollBT';

        notifications.push({
          lineUserId: data.lineUserId,
          message: `⏰ 試用期剩餘 ${newDays} 天！\n\n升級享受完整功能：${upgradeLink}`,
        });
      } else if (newDays <= 0) {
        updateData.primaryTierId = 'expired';

        notifications.push({
          lineUserId: data.lineUserId,
          message: '❌ 試用期已結束！\n\n立即升級繼續使用：https://portaly.cc/GinRollBT',
        });
      }

      await doc.ref.update(updateData);
    }

    // 4. 發送 LINE 通知
    for (const n of notifications) {
      if (n.lineUserId) {
        try {
          await sendLineMessage(n.lineUserId, [{ type: 'text', text: n.message }]);
        } catch (err) {
          console.error('LINE notification error:', err);
        }
      }
    }

    console.log(`Daily deduction completed. Sent ${notifications.length} notifications.`);
    return null;
  });

/**
 * 點數兌換天數
 * 輸入：{ itemId: "7days" }
 * 輸出：{ success: true, newPoints: 1000, newDays: 372 }
 */
exports.redeemPoints = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const userId = context.auth.uid;
  const { itemId } = data;

  // 兌換項目定義
  const redeemItems = {
    '7days': { points: 500, days: 7, name: '延長 7 天' },
    '30days': { points: 1800, days: 30, name: '延長 30 天' },
  };

  const item = redeemItems[itemId];
  if (!item) {
    throw new functions.https.HttpsError('invalid-argument', '無效的兌換項目');
  }

  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', '用戶不存在');
  }

  const userData = userDoc.data();
  const currentPoints = typeof userData.points === 'object'
    ? (userData.points?.current || 0)
    : (userData.points || 0);

  // 檢查點數
  if (currentPoints < item.points) {
    throw new functions.https.HttpsError('failed-precondition', `點數不足，需要 ${item.points} UA，目前僅有 ${currentPoints} UA`);
  }

  // 執行兌換
  const newPoints = currentPoints - item.points;
  const currentDays = userData.daysRemaining || 0;
  const newDays = currentDays + item.days;

  // 如果是 expired/grace/trial，升級為 paid
  let newTierId = userData.primaryTierId;
  if (['expired', 'grace', 'trial', 'referral_trial'].includes(newTierId)) {
    newTierId = 'paid';
  }

  await db.runTransaction(async (transaction) => {
    transaction.update(userDoc.ref, {
      'points.current': newPoints,
      daysRemaining: newDays,
      primaryTierId: newTierId,
      graceDaysRemaining: 0,
      totalPointsSpent: admin.firestore.FieldValue.increment(item.points),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 記錄點數消費
    transaction.set(db.collection('pointsLedger').doc(), {
      userId,
      userEmail: userData.email,
      type: 'spend',
      amount: -item.points,
      balanceBefore: currentPoints,
      balanceAfter: newPoints,
      reason: `兌換：${item.name}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 記錄兌換訂單
    transaction.set(db.collection('redemptionOrders').doc(), {
      userId,
      userEmail: userData.email,
      itemId,
      itemName: item.name,
      pointsCost: item.points,
      daysAdded: item.days,
      previousDays: currentDays,
      newDaysRemaining: newDays,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  console.log(`Points redeemed: ${userId} spent ${item.points} for ${item.name}`);

  return {
    success: true,
    newPoints,
    newDays,
    itemName: item.name,
  };
});

// ==========================================
// 定時任務
// ==========================================

/**
 * 檢查試用到期（每天早上 9:00）
 */
exports.checkTrialExpiration = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('Running trial expiration check...');
    const now = admin.firestore.Timestamp.now();
    const threeDaysLater = admin.firestore.Timestamp.fromMillis(now.toMillis() + 3 * 24 * 60 * 60 * 1000);

    try {
      const threeDaysSnapshot = await db.collection('users')
        .where('subscriptionStatus', '==', 'trial')
        .where('trialExpiresAt', '<=', threeDaysLater)
        .where('trialExpiresAt', '>', now)
        .get();

      for (const doc of threeDaysSnapshot.docs) {
        const userData = doc.data();
        const daysRemaining = Math.ceil((userData.trialExpiresAt.toMillis() - now.toMillis()) / (24 * 60 * 60 * 1000));

        if ((daysRemaining === 3 || daysRemaining === 1) && userData.lineUserId) {
          await sendLineMessage(userData.lineUserId, [{
            type: 'text',
            text: `⏰ 試用期剩餘 ${daysRemaining} 天\n\n立即升級：https://portaly.cc/GinRollBT`
          }]);
        }
      }
      console.log(`Sent ${threeDaysSnapshot.size} expiration reminders`);
    } catch (error) {
      console.error('Trial expiration check error:', error);
    }
    return null;
  });

/**
 * 刪除過期帳號（每天凌晨 2:00）
 */
exports.deleteExpiredAccounts = functions.pubsub
  .schedule('0 2 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('Running expired accounts deletion...');
    const now = admin.firestore.Timestamp.now();

    try {
      const expiredSnapshot = await db.collection('users')
        .where('subscriptionStatus', '==', 'trial')
        .where('trialExpiresAt', '<=', now)
        .get();

      for (const doc of expiredSnapshot.docs) {
        const userData = doc.data();
        const uid = doc.id;

        try {
          await db.collection('backups').doc(uid).set({
            backedUpAt: now,
            expiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + 30 * 24 * 60 * 60 * 1000),
            userData: userData
          });

          await doc.ref.delete();
          await auth.deleteUser(uid);

          if (userData.lineUserId) {
            await sendLineMessage(userData.lineUserId, [{
              type: 'text',
              text: '試用期已結束\n\n立即訂閱：https://portaly.cc/GinRollBT'
            }]);
          }
          console.log(`Deleted expired account: ${userData.email}`);
        } catch (error) {
          console.error(`Error deleting account ${uid}:`, error);
        }
      }
      console.log(`Deleted ${expiredSnapshot.size} expired accounts`);
    } catch (error) {
      console.error('Delete expired accounts error:', error);
    }
    return null;
  });

/**
 * 清理過期備份（每天凌晨 3:00）
 */
exports.cleanupExpiredBackups = functions.pubsub
  .schedule('0 3 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('Running expired backups cleanup...');
    const now = admin.firestore.Timestamp.now();

    try {
      const expiredBackups = await db.collection('backups').where('expiresAt', '<=', now).get();
      const batch = db.batch();
      expiredBackups.docs.forEach(doc => { batch.delete(doc.ref); });
      await batch.commit();
      console.log(`Cleaned up ${expiredBackups.size} expired backups`);
    } catch (error) {
      console.error('Cleanup expired backups error:', error);
    }
    return null;
  });

/**
 * 🆕 點數過期檢查（每天凌晨 3:30）
 */
exports.expirePoints = functions.pubsub
  .schedule('30 3 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('Starting points expiration check...');
    const now = admin.firestore.Timestamp.now();
    
    const expiredSnapshot = await db.collection('pointsLedger')
      .where('type', '==', 'earn')
      .where('isExpired', '==', false)
      .where('expiresAt', '<=', now)
      .get();
    
    if (expiredSnapshot.empty) {
      console.log('No expired points found');
      return null;
    }
    
    console.log(`Found ${expiredSnapshot.size} expired point entries`);
    
    const userExpiredPoints = {};
    expiredSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!userExpiredPoints[data.userId]) {
        userExpiredPoints[data.userId] = { totalExpired: 0, entries: [] };
      }
      userExpiredPoints[data.userId].totalExpired += data.amount;
      userExpiredPoints[data.userId].entries.push({ id: doc.id, ...data });
    });
    
    for (const [userId, expiredData] of Object.entries(userExpiredPoints)) {
      try {
        await db.runTransaction(async (transaction) => {
          const userRef = db.collection('users').doc(userId);
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists) return;
          
          const userData = userDoc.data();
          const currentPoints = typeof userData.points === 'object' ? (userData.points?.current || 0) : (userData.points || 0);
          const pointsToExpire = Math.min(expiredData.totalExpired, currentPoints);

          transaction.update(userRef, {
            'points.current': currentPoints - pointsToExpire,
            totalPointsExpired: admin.firestore.FieldValue.increment(pointsToExpire),
          });
          
          for (const entry of expiredData.entries) {
            transaction.update(db.collection('pointsLedger').doc(entry.id), { isExpired: true });
          }
          
          if (pointsToExpire > 0) {
            transaction.set(db.collection('pointsLedger').doc(), {
              userId,
              userEmail: userData.email,
              type: 'expire',
              amount: -pointsToExpire,
              balanceBefore: currentPoints,
              balanceAfter: currentPoints - pointsToExpire,
              actionId: 'points_expired',
              reason: `點數過期`,
              referenceType: 'system',
              isExpired: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              createdBy: 'system',
            });
          }
        });
        console.log(`Expired ${expiredData.totalExpired} points for user ${userId}`);
      } catch (error) {
        console.error(`Error processing expired points for ${userId}:`, error);
      }
    }
    
    console.log('Points expiration check completed');
    return null;
  });

/**
 * 🆕 會員到期檢查（每天凌晨 4:00）
 */
exports.checkMembershipExpiry = functions.pubsub
  .schedule('0 4 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    console.log('Starting membership expiry check...');
    const now = new Date();
    const nowTimestamp = admin.firestore.Timestamp.fromDate(now);
    
    const gracePeriodEnd = new Date(now);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() - 7);
    
    // 付費 → 寬限
    const expiredMembers = await db.collection('users')
      .where('primaryTierId', '==', 'paid')
      .where('membershipExpiresAt', '<=', nowTimestamp)
      .get();
    
    for (const doc of expiredMembers.docs) {
      try {
        const userData = doc.data();
        await doc.ref.update({
          primaryTierId: 'grace',
          membershipTierIds: ['grace'],
          graceStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        if (userData.lineUserId) {
          await sendLineMessage(userData.lineUserId, [{
            type: 'text',
            text: '⚠️ 訂閱已到期，進入 7 天寬限期\n\n續訂：https://portaly.cc/GinRollBT'
          }]);
        }
        console.log(`User ${userData.email} moved to grace period`);
      } catch (error) {
        console.error(`Error:`, error);
      }
    }
    
    // 寬限 → 過期
    const graceExpired = await db.collection('users')
      .where('primaryTierId', '==', 'grace')
      .where('graceStartedAt', '<=', admin.firestore.Timestamp.fromDate(gracePeriodEnd))
      .get();
    
    for (const doc of graceExpired.docs) {
      try {
        await doc.ref.update({
          primaryTierId: 'expired',
          membershipTierIds: ['expired'],
        });
        console.log(`User ${doc.data().email} moved to expired`);
      } catch (error) {
        console.error(`Error:`, error);
      }
    }
    
    console.log('Membership expiry check completed');
    return null;
  });

// ==========================================
// 🆕 LIFF 註冊 API（HTTP Endpoint）
// ==========================================

/**
 * LIFF 註冊 - 一頁式表單提交
 * POST /liffRegister
 * Body: { name, email, password, referralCode?, lineUserId, lineDisplayName, linePictureUrl? }
 */
exports.liffRegister = functions.https.onRequest(async (req, res) => {
  // CORS 處理（使用白名單）
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { name, email, password, referralCode, lineUserId, lineDisplayName, linePictureUrl, recaptchaToken } = req.body;

    // 🔒 Step 1: Rate Limiting 檢查
    const clientIp = getClientIp(req);
    const rateLimit = await checkRateLimit(clientIp, 'register');

    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      return res.status(429).json({
        success: false,
        error: `註冊請求過於頻繁，請 ${rateLimit.resetIn} 分鐘後再試`
      });
    }

    // 🔒 Step 2: reCAPTCHA 驗證（僅網頁註冊需要）
    if (!lineUserId && recaptchaToken) {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken, 'register');
      if (!recaptchaResult.success) {
        console.warn(`reCAPTCHA failed for IP: ${clientIp}, score: ${recaptchaResult.score}`);
        return res.status(400).json({
          success: false,
          error: recaptchaResult.error || '人機驗證失敗，請重新整理頁面後再試'
        });
      }
    }

    // 驗證必填欄位
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: '請填寫所有必填欄位' });
    }

    // LINE User ID 驗證（允許網頁註冊跳過）
    // 網頁註冊時 lineUserId 為 null，不需要 LINE 帳號
    const isWebRegister = !lineUserId;

    // 驗證 Email 格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Email 格式不正確' });
    }

    // 驗證密碼長度
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: '密碼至少需要 6 個字元' });
    }

    // 檢查 Email 是否已存在
    const existingUser = await auth.getUserByEmail(email.toLowerCase()).catch(() => null);
    if (existingUser) {
      return res.status(400).json({ success: false, error: '此 Email 已經註冊' });
    }

    // 檢查 LINE User ID 是否已綁定（跳過網頁註冊和開發模式的假 ID）
    if (!isWebRegister && !lineUserId.startsWith('dev-user-')) {
      const existingLineUser = await db.collection('users')
        .where('lineUserId', '==', lineUserId)
        .limit(1)
        .get();

      if (!existingLineUser.empty) {
        return res.status(400).json({ success: false, error: '此 LINE 帳號已綁定其他帳戶' });
      }
    }

    // 處理推薦碼
    let referredByUid = null;
    let referrerName = null;
    let tierId = 'trial';

    if (referralCode) {
      const codeDoc = await db.collection('referralCodes').doc(referralCode.toUpperCase()).get();
      if (codeDoc.exists && codeDoc.data().isActive) {
        tierId = 'referral_trial';
        referredByUid = codeDoc.data().ownerId;

        // 取得推薦人名稱
        const referrerDoc = await db.collection('users').doc(referredByUid).get();
        if (referrerDoc.exists) {
          const referrerData = referrerDoc.data();
          referrerName = referrerData.displayName || referrerData.email?.split('@')[0] || '會員';
        }
      }
    }

    // 創建 Firebase Auth 帳號
    const userRecord = await auth.createUser({
      email: email.toLowerCase(),
      password: password,
      displayName: name,
      emailVerified: false,
      disabled: false
    });

    const now = admin.firestore.Timestamp.now();

    // 計算試用到期時間（7 天後）
    const trialExpires = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + 7 * 24 * 60 * 60 * 1000
    );

    // 生成推薦碼
    const newReferralCode = generateReferralCode(email);

    // 寫入 Firestore
    await db.collection('users').doc(userRecord.uid).set({
      email: email.toLowerCase(),
      displayName: name,
      lineUserId: isWebRegister ? null : (lineUserId.startsWith('dev-user-') ? null : lineUserId),
      lineDisplayName: lineDisplayName || null,
      linePictureUrl: linePictureUrl || null,
      createdAt: now,
      updatedAt: now,
      // 天數制會員系統
      primaryTierId: tierId,
      daysRemaining: 7,
      lastDayDeducted: null,
      graceDaysRemaining: 0,
      trialExpiresAt: trialExpires,
      // UA 點數（被推薦者獲得 50 點）
      points: { current: referredByUid ? 50 : 0 },
      totalPointsEarned: referredByUid ? 50 : 0,
      totalPointsSpent: 0,
      totalPointsExpired: 0,
      // 推薦系統
      referralCode: newReferralCode,
      referredBy: referredByUid,
      referralCount: 0,
      referralRewardClaimed: false,
      // 其他
      isActive: true,
      isFirstLogin: true,
      loginStreak: 0,
      toolUsageCount: 0,
      clients: [],
      stats: { trialsCompleted: 0, hoursSaved: 0 }
    });

    // 建立推薦碼索引
    await db.collection('referralCodes').doc(newReferralCode).set({
      code: newReferralCode,
      ownerId: userRecord.uid,
      ownerEmail: email.toLowerCase(),
      usageCount: 0,
      successCount: 0,
      totalPointsGenerated: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });

    // 如果有推薦人，更新推薦人資料並記錄點數
    if (referredByUid) {
      const batch = db.batch();

      // 更新推薦人的 referralCount
      const referrerRef = db.collection('users').doc(referredByUid);
      batch.update(referrerRef, {
        referralCount: admin.firestore.FieldValue.increment(1)
      });

      // 更新推薦碼使用次數
      const codeRef = db.collection('referralCodes').doc(referralCode.toUpperCase());
      batch.update(codeRef, {
        usageCount: admin.firestore.FieldValue.increment(1),
        updatedAt: now
      });

      // 記錄被推薦者獲得的點數
      const ledgerRef = db.collection('pointsLedger').doc();
      batch.set(ledgerRef, {
        userId: userRecord.uid,
        type: 'earn',
        amount: 50,
        reason: '使用推薦碼註冊獎勵',
        relatedUserId: referredByUid,
        createdAt: now
      });

      await batch.commit();

      // 發送 LINE 通知給推薦人（如果有 LINE ID）
      const referrerDoc = await db.collection('users').doc(referredByUid).get();
      if (referrerDoc.exists && referrerDoc.data().lineUserId) {
        try {
          await sendLineMessage(referrerDoc.data().lineUserId, [{
            type: 'text',
            text: `🎉 好消息！你推薦的朋友 ${name} 已成功註冊！\n\n🎁 你已獲得 +100 UA 推薦獎勵！\n\n當他完成付費後，你們雙方還將各獲得 1000 UA 點數！`
          }]);
        } catch (lineErr) {
          console.error('發送推薦通知失敗:', lineErr);
        }
      }
    }

    // 格式化到期日期
    const expireDate = new Date(trialExpires.toMillis());
    const expireDateStr = `${expireDate.getFullYear()}/${expireDate.getMonth() + 1}/${expireDate.getDate()}`;

    console.log(`LIFF Register success: ${email}, tier: ${tierId}, referredBy: ${referredByUid || 'none'}`);

    // 回傳成功
    return res.status(200).json({
      success: true,
      data: {
        uid: userRecord.uid,
        email: email.toLowerCase(),
        displayName: name,
        trialExpireDate: expireDateStr,
        referralCode: newReferralCode,
        points: referredByUid ? 50 : 0,
        tierId: tierId
      }
    });

  } catch (error) {
    console.error('LIFF Register error:', error);
    return res.status(500).json({
      success: false,
      error: '系統發生錯誤，請稍後再試'
    });
  }
});

// ==========================================
// 🆕 更新點數規則（一次性管理員函數）
// ==========================================
exports.updatePointsRules = functions.https.onCall(async (_data, context) => {
  // 驗證管理員權限（使用 Firestore admins collection）
  await verifyAdminAccess(context);

  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();

  // 更新的規則
  const rulesToUpdate = [
    {
      actionId: 'referral_registration',
      name: '推薦好友註冊',
      description: '推薦好友完成註冊，推薦人獲得點數',
      basePoints: 100,
      isActive: true,
      limits: null,
      category: 'referral',
      triggerType: 'auto',
      icon: '🎁',
      priority: 6,
    },
    {
      actionId: 'referral_success',
      name: '推薦成功',
      description: '推薦新用戶並完成付費（推薦人獎勵）',
      basePoints: 1000,
      isActive: true,
      limits: null,
      category: 'referral',
      triggerType: 'auto',
      icon: '🎁',
      priority: 7,
    },
    {
      actionId: 'referred_bonus',
      name: '被推薦獎勵',
      description: '透過推薦碼註冊並付費（被推薦人獎勵）',
      basePoints: 1000,
      isActive: true,
      limits: { totalMax: 1 },
      category: 'referral',
      triggerType: 'auto',
      icon: '🎉',
      priority: 8,
    },
  ];

  // 批次更新/建立規則
  for (const rule of rulesToUpdate) {
    const docRef = db.collection('pointsRules').doc(rule.actionId);
    batch.set(docRef, {
      ...rule,
      updatedAt: now,
    }, { merge: true });
  }

  await batch.commit();

  // 記錄審計日誌
  await db.collection('auditLogs').add({
    adminId: context.auth.uid,
    adminEmail: userEmail,
    action: 'points_rules.bulk_update',
    description: '批次更新推薦獎勵規則：註冊+100, 付費+1000',
    createdAt: now,
  });

  return {
    success: true,
    message: '點數規則已更新：推薦註冊 +100 UA，推薦付費 +1000 UA（雙方）',
    updatedRules: rulesToUpdate.map(r => r.actionId),
  };
});

// ==========================================
// 任務看板系統
// ==========================================

/**
 * completeMission - 完成任務並發放點數（原子性操作）
 *
 * @param {string} missionId - 任務 ID
 * @returns {Promise<{success: boolean, pointsAwarded?: number, message: string}>}
 */
exports.completeMission = functions.https.onCall(async (data, context) => {
  // 1. 驗證用戶登入
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const uid = context.auth.uid;
  const { missionId } = data;

  if (!missionId) {
    throw new functions.https.HttpsError('invalid-argument', '缺少任務 ID');
  }

  try {
    // 2. 取得任務資料
    const missionRef = db.collection('missions').doc(missionId);
    const missionDoc = await missionRef.get();

    if (!missionDoc.exists) {
      throw new functions.https.HttpsError('not-found', '任務不存在');
    }

    const mission = missionDoc.data();

    if (!mission.isActive) {
      throw new functions.https.HttpsError('failed-precondition', '此任務目前已停用');
    }

    // 3. 檢查是否已完成
    const completedRef = db
      .collection('users').doc(uid)
      .collection('completedMissions').doc(missionId);

    const completedDoc = await completedRef.get();

    // 一次性任務：只能完成一次
    if (mission.repeatType === 'once' && completedDoc.exists) {
      throw new functions.https.HttpsError('already-exists', '此任務已完成過');
    }

    // 每日任務：每天只能完成一次
    if (mission.repeatType === 'daily' && completedDoc.exists) {
      const completedAt = completedDoc.data().completedAt?.toDate();
      if (completedAt) {
        const today = new Date();
        const taiwanOffset = 8 * 60 * 60 * 1000; // UTC+8
        const todayTaiwan = new Date(today.getTime() + taiwanOffset).toDateString();
        const completedTaiwan = new Date(completedAt.getTime() + taiwanOffset).toDateString();

        if (todayTaiwan === completedTaiwan) {
          throw new functions.https.HttpsError('already-exists', '今日已完成此任務');
        }
      }
    }

    // 4. 取得用戶資料
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', '用戶不存在');
    }

    const userData = userDoc.data();

    // 5. 自動驗證檢查
    if (mission.verificationType === 'auto' && mission.verificationField) {
      const field = mission.verificationField;
      const condition = mission.verificationCondition;

      let verified = false;

      // 簡單欄位檢查（photoURL, displayName, lineUserId）
      if (!condition) {
        // 也檢查 profile 子集合
        let fieldValue = userData[field];
        if (!fieldValue) {
          const profileDoc = await db.collection('users').doc(uid).collection('profile').doc('data').get();
          if (profileDoc.exists) {
            fieldValue = profileDoc.data()[field];
          }
        }
        verified = !!fieldValue;
      }
      // 條件檢查（如 count>=1, count>=3）
      else if (condition.startsWith('count>=')) {
        const requiredCount = parseInt(condition.replace('count>=', ''));

        if (field === 'clients') {
          const clientsSnapshot = await db.collection('users').doc(uid).collection('clients').get();
          verified = clientsSnapshot.size >= requiredCount;
        } else if (field === 'cheatSheetUsageCount') {
          verified = (userData.cheatSheetUsageCount || 0) >= requiredCount;
        }
      }
      // 每日登入檢查
      else if (condition === 'today') {
        const today = new Date();
        const taiwanOffset = 8 * 60 * 60 * 1000;
        const todayStr = new Date(today.getTime() + taiwanOffset).toISOString().split('T')[0];
        verified = userData.lastLoginDate === todayStr;
      }

      console.log(`Mission ${missionId} verification: field=${field}, condition=${condition}, verified=${verified}`);

      if (!verified) {
        throw new functions.https.HttpsError('failed-precondition', '尚未達成任務條件');
      }
    }

    // 6. 執行交易發放點數
    const currentPoints = userData.points?.current || 0;
    const newPoints = currentPoints + mission.points;

    // 計算點數過期時間（12 個月後）
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);

    // 7. 執行交易：發放點數 + 記錄完成
    await db.runTransaction(async (transaction) => {
      // 更新用戶點數
      transaction.update(userRef, {
        'points.current': newPoints,
        totalPointsEarned: admin.firestore.FieldValue.increment(mission.points),
        lastPointsEarnedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 記錄完成（使用 set 而不是 update，以便處理每日任務覆蓋）
      transaction.set(completedRef, {
        missionId: missionId,
        missionTitle: mission.title,
        missionCategory: mission.category,
        pointsAwarded: mission.points,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 記錄點數帳本
      const ledgerRef = db.collection('pointsLedger').doc();
      transaction.set(ledgerRef, {
        userId: uid,
        userEmail: userData.email,
        type: 'earn',
        subType: 'mission',
        amount: mission.points,
        balanceBefore: currentPoints,
        balanceAfter: newPoints,
        actionId: 'mission_complete',
        reason: `完成任務：${mission.title}`,
        referenceType: 'mission',
        referenceId: missionId,
        missionCategory: mission.category,
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        isExpired: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'system',
      });
    });

    console.log(`User ${uid} completed mission ${missionId}, awarded ${mission.points} points`);

    return {
      success: true,
      pointsAwarded: mission.points,
      newBalance: newPoints,
      message: `🎉 任務完成！獲得 +${mission.points} UA 點`,
    };

  } catch (error) {
    // 如果是 HttpsError，直接拋出
    if (error.code) {
      throw error;
    }
    console.error('completeMission error:', error);
    throw new functions.https.HttpsError('internal', '任務完成處理失敗');
  }
});

/**
 * getMissions - 取得所有啟用的任務（供前台使用）
 *
 * @returns {Promise<{missions: Mission[]}>}
 */
exports.getMissions = functions.https.onCall(async (_data, context) => {
  // 可以不需要登入也能查看任務列表
  try {
    // 先取得所有任務，再在程式碼中過濾和排序（避免索引問題）
    const missionsSnapshot = await db.collection('missions').get();

    // 過濾並排序任務
    let missions = [];
    missionsSnapshot.forEach(doc => {
      const data = doc.data();
      // 只取得啟用的任務
      if (data.isActive === true) {
        missions.push({
          id: doc.id,
          ...data,
        });
      }
    });

    // 依 category 和 order 排序
    const categoryOrder = { 'onboarding': 1, 'social': 2, 'habit': 3, 'daily': 4 };
    missions.sort((a, b) => {
      const catDiff = (categoryOrder[a.category] || 99) - (categoryOrder[b.category] || 99);
      if (catDiff !== 0) return catDiff;
      return (a.order || 0) - (b.order || 0);
    });

    // 如果用戶已登入，附帶完成狀態
    if (context.auth) {
      const uid = context.auth.uid;
      const completedSnapshot = await db
        .collection('users').doc(uid)
        .collection('completedMissions')
        .get();

      const completedMap = {};
      completedSnapshot.forEach(doc => {
        completedMap[doc.id] = {
          completedAt: doc.data().completedAt,
          pointsAwarded: doc.data().pointsAwarded,
        };
      });

      // 附加完成狀態到每個任務
      missions.forEach(mission => {
        const completed = completedMap[mission.id];
        if (completed) {
          // 一次性任務：已完成
          if (mission.repeatType === 'once') {
            mission.isCompleted = true;
            mission.completedAt = completed.completedAt;
          }
          // 每日任務：檢查是否今天已完成
          else if (mission.repeatType === 'daily') {
            const completedAt = completed.completedAt?.toDate();
            if (completedAt) {
              const today = new Date();
              const taiwanOffset = 8 * 60 * 60 * 1000;
              const todayTaiwan = new Date(today.getTime() + taiwanOffset).toDateString();
              const completedTaiwan = new Date(completedAt.getTime() + taiwanOffset).toDateString();
              mission.isCompletedToday = (todayTaiwan === completedTaiwan);
              mission.completedAt = completed.completedAt;
            }
          }
        }
      });
    }

    return { missions };

  } catch (error) {
    console.error('getMissions error:', error);
    throw new functions.https.HttpsError('internal', '取得任務列表失敗');
  }
});

/**
 * initMissions - 初始化預設任務（管理員專用）
 *
 * @returns {Promise<{success: boolean, message: string}>}
 */
exports.initMissions = functions.https.onCall(async (_data, context) => {
  // 驗證管理員權限（使用 Firestore admins collection）
  await verifyAdminAccess(context);

  const now = admin.firestore.Timestamp.now();

  // 預設任務
  const missions = [
    {
      id: 'set_avatar',
      title: '設定個人頭像',
      description: '上傳一張專業的個人照片，讓客戶更認識你',
      icon: '📸',
      points: 20,
      category: 'onboarding',
      order: 1,
      linkType: 'modal',
      linkTarget: 'editProfile',
      verificationType: 'auto',
      verificationField: 'photoURL',
      repeatType: 'once',
      isActive: true,
    },
    {
      id: 'set_display_name',
      title: '設定顯示名稱',
      description: '設定您的顯示名稱，讓系統更好地稱呼您',
      icon: '📝',
      points: 15,
      category: 'onboarding',
      order: 2,
      linkType: 'modal',
      linkTarget: 'editProfile',
      verificationType: 'auto',
      verificationField: 'displayName',
      repeatType: 'once',
      isActive: true,
    },
    {
      id: 'first_client',
      title: '建立第一位客戶',
      description: '新增您的第一位客戶，開始使用理財工具',
      icon: '👤',
      points: 20,
      category: 'onboarding',
      order: 3,
      linkType: 'internal',
      linkTarget: '/clients',
      verificationType: 'auto',
      verificationField: 'clients',
      verificationCondition: 'count>=1',
      repeatType: 'once',
      isActive: true,
    },
    {
      id: 'join_line_official',
      title: '加入 LINE 官方帳號',
      description: '加入 Ultra Advisor 官方 LINE，獲取最新資訊',
      icon: '💬',
      points: 20,
      category: 'social',
      order: 1,
      linkType: 'external',
      linkTarget: 'https://line.me/R/ti/p/@ultraadvisor',
      verificationType: 'auto',
      verificationField: 'lineUserId',
      repeatType: 'once',
      isActive: true,
    },
    {
      id: 'join_line_community',
      title: '加入 LINE 戰友社群',
      description: '加入顧問戰友社群，與同行交流經驗',
      icon: '👥',
      points: 25,
      category: 'social',
      order: 2,
      linkType: 'external',
      linkTarget: 'https://line.me/ti/g2/9Cca20iCP8J0KrmVRg5GOe1n5dSatYKO8ETTHw',
      verificationType: 'manual',
      repeatType: 'once',
      isActive: true,
    },
    {
      id: 'pwa_install',
      title: '將 Ultra 加入主畫面',
      description: '將 Ultra Advisor 加入手機主畫面，隨時快速開啟',
      icon: '📱',
      points: 30,
      category: 'habit',
      order: 1,
      linkType: 'pwa',
      verificationType: 'manual',
      repeatType: 'once',
      isActive: true,
    },
    {
      id: 'use_cheat_sheet_3',
      title: '使用 3 次業務小抄',
      description: '善用業務小抄功能，快速掌握話術要點',
      icon: '📋',
      points: 15,
      category: 'habit',
      order: 2,
      linkType: 'internal',
      linkTarget: '/tools',
      verificationType: 'auto',
      verificationField: 'cheatSheetUsageCount',
      verificationCondition: 'count>=3',
      repeatType: 'once',
      isActive: true,
    },
    {
      id: 'daily_login',
      title: '每日登入',
      description: '每天登入系統，培養使用習慣',
      icon: '📅',
      points: 5,
      category: 'daily',
      order: 1,
      linkType: null,
      verificationType: 'auto',
      verificationField: 'lastLoginDate',
      verificationCondition: 'today',
      repeatType: 'daily',
      isActive: true,
    },
  ];

  const batch = db.batch();

  for (const mission of missions) {
    const { id, ...missionData } = mission;
    const docRef = db.collection('missions').doc(id);
    batch.set(docRef, {
      ...missionData,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
  }

  await batch.commit();

  // 記錄審計日誌
  await db.collection('auditLogs').add({
    adminId: context.auth.uid,
    adminEmail: userEmail,
    action: 'missions.init',
    description: `初始化 ${missions.length} 個預設任務`,
    createdAt: now,
  });

  return {
    success: true,
    message: `成功初始化 ${missions.length} 個任務`,
    count: missions.length,
  };
});

/**
 * 重置任務（清除後重新初始化）- 僅限管理員
 * 使用環境變數存放密鑰，不再硬編碼
 */
exports.initMissionsHttp = functions.https.onRequest(async (req, res) => {
  // 使用環境變數中的密鑰
  const secretKey = functions.config().admin?.init_key;
  if (!secretKey || req.query.key !== secretKey) {
    res.status(403).json({ error: '無效的 key 或未設定環境變數 admin.init_key' });
    return;
  }

  try {
    // 先刪除所有現有任務
    const existingMissions = await db.collection('missions').get();
    const deleteBatch = db.batch();
    existingMissions.docs.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();
    console.log(`已刪除 ${existingMissions.size} 個舊任務`);

    // 重新建立任務
    const now = admin.firestore.Timestamp.now();
    const missions = [
      { id: 'set_avatar', title: '設定個人頭像', description: '上傳一張專業的個人照片，讓客戶更認識你', icon: '📸', points: 20, category: 'onboarding', order: 1, linkType: 'modal', linkTarget: 'editProfile', verificationType: 'auto', verificationField: 'photoURL', repeatType: 'once', isActive: true },
      { id: 'set_display_name', title: '設定顯示名稱', description: '設定一個專業的顯示名稱', icon: '📝', points: 15, category: 'onboarding', order: 2, linkType: 'modal', linkTarget: 'editProfile', verificationType: 'auto', verificationField: 'displayName', repeatType: 'once', isActive: true },
      { id: 'first_client', title: '建立第一位客戶', description: '新增你的第一位客戶資料', icon: '👤', points: 20, category: 'onboarding', order: 3, linkType: 'internal', linkTarget: '/clients', verificationType: 'auto', verificationField: 'clients', verificationCondition: 'count>=1', repeatType: 'once', isActive: true },
      { id: 'join_line_official', title: '加入 LINE 官方帳號', description: '加入 Ultra Advisor 官方 LINE，獲取最新資訊', icon: '💬', points: 20, category: 'social', order: 1, linkType: 'external', linkTarget: 'https://line.me/R/ti/p/@ultraadvisor', verificationType: 'auto', verificationField: 'lineUserId', repeatType: 'once', isActive: true },
      { id: 'join_line_community', title: '加入 LINE 戰友社群', description: '加入顧問戰友社群，與同行交流經驗', icon: '👥', points: 25, category: 'social', order: 2, linkType: 'external', linkTarget: 'https://line.me/ti/g2/9Cca20iCP8J0KrmVRg5GOe1n5dSatYKO8ETTHw', verificationType: 'manual', repeatType: 'once', isActive: true },
      { id: 'pwa_install', title: '將 Ultra 加入主畫面', description: '將 Ultra Advisor 加入手機主畫面，隨時隨地使用', icon: '📱', points: 30, category: 'habit', order: 1, linkType: 'pwa', verificationType: 'manual', repeatType: 'once', isActive: true },
      { id: 'use_cheat_sheet_3', title: '使用 3 次業務小抄', description: '使用業務小抄功能 3 次，熟悉產品資訊', icon: '📋', points: 15, category: 'habit', order: 2, linkType: 'internal', linkTarget: '/tools', verificationType: 'auto', verificationField: 'cheatSheetUsageCount', verificationCondition: 'count>=3', repeatType: 'once', isActive: true },
      { id: 'daily_login', title: '每日登入', description: '每天登入系統，培養使用習慣', icon: '📅', points: 5, category: 'daily', order: 1, linkType: null, verificationType: 'auto', verificationField: 'lastLoginDate', verificationCondition: 'today', repeatType: 'daily', isActive: true },
    ];

    const createBatch = db.batch();
    for (const mission of missions) {
      const { id, ...missionData } = mission;
      const docRef = db.collection('missions').doc(id);
      createBatch.set(docRef, { ...missionData, createdAt: now, updatedAt: now });
    }
    await createBatch.commit();

    res.json({ success: true, message: `已清除舊任務並重新建立 ${missions.length} 個任務`, deleted: existingMissions.size, created: missions.length });
  } catch (error) {
    console.error('Init missions error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Debug: 查看用戶資料 - 僅限管理員
 * 使用環境變數存放密鑰，不再硬編碼
 */
exports.debugUserData = functions.https.onRequest(async (req, res) => {
  // 使用環境變數中的密鑰
  const secretKey = functions.config().admin?.debug_key;
  if (!secretKey || req.query.key !== secretKey) {
    res.status(403).json({ error: '無效的 key 或未設定環境變數 admin.debug_key' });
    return;
  }

  const email = req.query.email;
  if (!email) {
    res.status(400).json({ error: '請提供 email 參數' });
    return;
  }

  try {
    // 找用戶
    const usersSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
    if (usersSnapshot.empty) {
      res.json({ error: '找不到用戶', email });
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const uid = userDoc.id;
    const userData = userDoc.data();

    // 取得 profile 子集合
    const profileDoc = await db.collection('users').doc(uid).collection('profile').doc('data').get();
    const profileData = profileDoc.exists ? profileDoc.data() : null;

    // 取得已完成任務
    const completedSnapshot = await db.collection('users').doc(uid).collection('completedMissions').get();
    const completedMissions = completedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({
      uid,
      email,
      userData: {
        photoURL: userData.photoURL,
        displayName: userData.displayName,
        lineUserId: userData.lineUserId,
        lastLoginDate: userData.lastLoginDate,
        cheatSheetUsageCount: userData.cheatSheetUsageCount,
      },
      profileData: profileData ? {
        photoURL: profileData.photoURL,
        displayName: profileData.displayName,
      } : null,
      completedMissions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 孤立用戶清理功能
// ==========================================

/**
 * 列出孤立的 Auth 用戶（在 Firebase Auth 但不在 Firestore users 集合）
 */
exports.listOrphanAuthUsers = functions.https.onCall(async (_data, context) => {
  // 驗證管理員權限（使用 Firestore admins collection）
  await verifyAdminAccess(context);

  try {
    // 取得所有 Firestore users 的 UID
    const usersSnapshot = await db.collection('users').get();
    const firestoreUids = new Set(usersSnapshot.docs.map(doc => doc.id));

    // 取得所有 Firebase Auth 用戶
    const orphanUsers = [];
    let nextPageToken;

    do {
      const listResult = await auth.listUsers(1000, nextPageToken);

      for (const userRecord of listResult.users) {
        // 如果這個 Auth 用戶不在 Firestore users 集合裡
        if (!firestoreUids.has(userRecord.uid)) {
          orphanUsers.push({
            uid: userRecord.uid,
            email: userRecord.email || '(無 Email)',
            displayName: userRecord.displayName || '',
            createdAt: userRecord.metadata.creationTime,
            lastSignIn: userRecord.metadata.lastSignInTime,
            disabled: userRecord.disabled,
          });
        }
      }

      nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    return {
      success: true,
      totalAuthUsers: firestoreUids.size + orphanUsers.length,
      firestoreUsers: firestoreUids.size,
      orphanCount: orphanUsers.length,
      orphanUsers: orphanUsers,
    };
  } catch (error) {
    console.error('List orphan users error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * 刪除指定的孤立 Auth 用戶
 */
exports.deleteOrphanAuthUsers = functions.https.onCall(async (data, context) => {
  // 驗證管理員權限（使用 Firestore admins collection）
  await verifyAdminAccess(context);

  const { uids } = data;

  if (!uids || !Array.isArray(uids) || uids.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', '請提供要刪除的用戶 UID 列表');
  }

  // 安全檢查：不能刪除管理員帳號（從 Firestore admins collection 獲取）
  const adminsSnapshot = await db.collection('admins').get();
  const adminUids = adminsSnapshot.docs.map(doc => doc.id);

  const safeUids = uids.filter(uid => !adminUids.includes(uid));

  if (safeUids.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', '無法刪除管理員帳號');
  }

  try {
    const deleteResult = await auth.deleteUsers(safeUids);

    // 記錄審計日誌
    await db.collection('auditLogs').add({
      adminId: context.auth.uid,
      adminEmail: context.auth.token.email,
      action: 'auth.deleteOrphanUsers',
      description: `刪除 ${deleteResult.successCount} 個孤立 Auth 用戶`,
      details: {
        requested: safeUids.length,
        success: deleteResult.successCount,
        failed: deleteResult.failureCount,
      },
      createdAt: admin.firestore.Timestamp.now(),
    });

    return {
      success: true,
      message: `成功刪除 ${deleteResult.successCount} 個用戶`,
      successCount: deleteResult.successCount,
      failureCount: deleteResult.failureCount,
      errors: deleteResult.errors?.map(e => ({ uid: e.index, error: e.error.message })) || [],
    };
  } catch (error) {
    console.error('Delete orphan users error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ==========================================
// 🛍️ UA 商城系統
// ==========================================

/**
 * getStoreItems - 取得商城商品列表
 *
 * @returns {Promise<{success: boolean, items: Array}>}
 */
exports.getStoreItems = functions.https.onCall(async (_data, context) => {
  // 需要登入才能查看商城
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  try {
    // 取得上架中的商品，按排序順序
    const itemsSnapshot = await db.collection('redeemableItems')
      .where('isActive', '==', true)
      .orderBy('sortOrder', 'asc')
      .get();

    const items = itemsSnapshot.docs.map(doc => {
      const data = doc.data();
      // 計算剩餘庫存
      const remaining = data.stock === -1 ? -1 : Math.max(0, data.stock - (data.stockUsed || 0));

      return {
        id: doc.id,
        name: data.name,
        description: data.description || '',
        image: data.image || '',
        category: data.category || 'merchandise',
        pointsCost: data.pointsCost || 0,
        stock: data.stock,
        stockUsed: data.stockUsed || 0,
        remaining,
        maxPerUser: data.maxPerUser || -1,
        requiresShipping: data.requiresShipping || false,
        isFeatured: data.isFeatured || false,
        autoAction: data.autoAction || null,
      };
    });

    return {
      success: true,
      items,
    };
  } catch (error) {
    console.error('getStoreItems error:', error);
    throw new functions.https.HttpsError('internal', '載入商品失敗');
  }
});

/**
 * getUserOrders - 取得用戶的兌換訂單
 *
 * @returns {Promise<{success: boolean, orders: Array}>}
 */
exports.getUserOrders = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const uid = context.auth.uid;

  try {
    const ordersSnapshot = await db.collection('redemptionOrders')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const orders = ordersSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        orderNumber: data.orderNumber || doc.id.substring(0, 8).toUpperCase(),
        itemId: data.itemId,
        itemName: data.itemName,
        itemImage: data.itemImage || '',
        variant: data.variant || null,
        pointsCost: data.pointsCost || data.pointsSpent || 0,
        status: data.status || 'pending',
        trackingNumber: data.trackingNumber || null,
        createdAt: data.createdAt?.toDate?.() || null,
        completedAt: data.completedAt?.toDate?.() || null,
      };
    });

    return {
      success: true,
      orders,
    };
  } catch (error) {
    console.error('getUserOrders error:', error);
    throw new functions.https.HttpsError('internal', '載入訂單失敗');
  }
});

/**
 * redeemStoreItem - 兌換商城商品（完整版）
 *
 * @param {string} itemId - 商品 ID
 * @param {string} variant - 規格選項（如尺寸）
 * @param {object} shippingInfo - 收件資訊（實體商品必填）
 * @returns {Promise<{success: boolean, orderNumber: string, message: string}>}
 */
exports.redeemStoreItem = functions.https.onCall(async (data, context) => {
  // 1. 驗證登入
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const uid = context.auth.uid;
  const { itemId, variant, shippingInfo } = data;

  if (!itemId) {
    throw new functions.https.HttpsError('invalid-argument', '缺少商品 ID');
  }

  try {
    // 2. 取得商品資料
    const itemRef = db.collection('redeemableItems').doc(itemId);
    const itemDoc = await itemRef.get();

    if (!itemDoc.exists) {
      throw new functions.https.HttpsError('not-found', '商品不存在');
    }

    const item = itemDoc.data();

    if (!item.isActive) {
      throw new functions.https.HttpsError('failed-precondition', '商品已下架');
    }

    // 3. 檢查庫存
    const remaining = item.stock === -1 ? Infinity : Math.max(0, item.stock - (item.stockUsed || 0));
    if (remaining <= 0) {
      throw new functions.https.HttpsError('resource-exhausted', '商品已售罄');
    }

    // 4. 取得用戶資料並檢查點數
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', '用戶不存在');
    }

    const userData = userDoc.data();
    const currentPoints = typeof userData.points === 'object'
      ? (userData.points?.current || 0)
      : (userData.points || 0);

    if (currentPoints < item.pointsCost) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `點數不足，需要 ${item.pointsCost} UA，目前僅有 ${currentPoints} UA`
      );
    }

    // 5. 檢查每人限購
    if (item.maxPerUser > 0) {
      const userOrdersSnapshot = await db.collection('redemptionOrders')
        .where('userId', '==', uid)
        .where('itemId', '==', itemId)
        .where('status', 'in', ['pending', 'processing', 'shipped', 'completed'])
        .get();

      if (userOrdersSnapshot.size >= item.maxPerUser) {
        throw new functions.https.HttpsError(
          'resource-exhausted',
          `此商品每人限兌換 ${item.maxPerUser} 次，您已達上限`
        );
      }
    }

    // 6. 實體商品檢查收件資訊
    if (item.requiresShipping) {
      if (!shippingInfo || !shippingInfo.name || !shippingInfo.phone || !shippingInfo.address) {
        throw new functions.https.HttpsError('invalid-argument', '請填寫完整收件資訊');
      }
    }

    // 7. 執行兌換交易
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const newPoints = currentPoints - item.pointsCost;
    const now = admin.firestore.Timestamp.now();

    // 判斷是否為虛擬商品（訂閱延長）
    const isSubscription = item.category === 'subscription';
    const autoStatus = isSubscription ? 'completed' : 'pending';

    await db.runTransaction(async (transaction) => {
      // 扣除點數
      transaction.update(userRef, {
        'points.current': newPoints,
        totalPointsSpent: admin.firestore.FieldValue.increment(item.pointsCost),
        updatedAt: now,
      });

      // 扣除庫存
      if (item.stock !== -1) {
        transaction.update(itemRef, {
          stockUsed: admin.firestore.FieldValue.increment(1),
          updatedAt: now,
        });
      }

      // 建立訂單
      const orderRef = db.collection('redemptionOrders').doc();
      transaction.set(orderRef, {
        orderNumber,
        userId: uid,
        userEmail: userData.email || '',
        userName: userData.displayName || '',
        itemId,
        itemName: item.name,
        itemImage: item.image || '',
        category: item.category || 'merchandise',
        variant: variant || null,
        pointsCost: item.pointsCost,
        shippingInfo: item.requiresShipping ? shippingInfo : null,
        status: autoStatus,
        createdAt: now,
        updatedAt: now,
        completedAt: isSubscription ? now : null,
      });

      // 記錄點數帳本
      const ledgerRef = db.collection('pointsLedger').doc();
      transaction.set(ledgerRef, {
        userId: uid,
        userEmail: userData.email || '',
        type: 'spend',
        amount: -item.pointsCost,
        balanceBefore: currentPoints,
        balanceAfter: newPoints,
        reason: `兌換商品：${item.name}${variant ? ` (${variant})` : ''}`,
        orderId: orderRef.id,
        createdAt: now,
      });

      // 虛擬商品：執行自動動作
      if (isSubscription && item.autoAction?.days) {
        const daysToAdd = item.autoAction.days;
        const currentDays = userData.daysRemaining || 0;
        const newDays = currentDays + daysToAdd;

        // 如果是過期/寬限/試用狀態，升級為付費
        let newTierId = userData.primaryTierId;
        if (['expired', 'grace', 'trial', 'referral_trial'].includes(newTierId)) {
          newTierId = 'paid';
        }

        transaction.update(userRef, {
          daysRemaining: newDays,
          primaryTierId: newTierId,
          graceDaysRemaining: 0,
        });
      }
    });

    console.log(`Store redeem success: ${uid} redeemed ${item.name} for ${item.pointsCost} UA`);

    return {
      success: true,
      orderNumber,
      message: isSubscription ? '🎉 兌換成功！訂閱已自動延長' : '🎉 兌換成功！',
      isVirtual: isSubscription,
    };
  } catch (error) {
    if (error.code) {
      throw error; // 重新拋出已知錯誤
    }
    console.error('redeemStoreItem error:', error);
    throw new functions.https.HttpsError('internal', '兌換失敗，請稍後再試');
  }
});

/**
 * updateOrderStatus - 更新訂單狀態（管理員專用）
 *
 * @param {string} orderId - 訂單 ID
 * @param {string} status - 新狀態
 * @param {string} trackingNumber - 物流追蹤號（選填）
 * @param {string} adminNote - 備註（選填）
 */
exports.updateOrderStatus = functions.https.onCall(async (data, context) => {
  // 驗證管理員權限（使用 Firestore admins collection）
  await verifyAdminAccess(context);

  const { orderId, status, trackingNumber, adminNote } = data;

  if (!orderId || !status) {
    throw new functions.https.HttpsError('invalid-argument', '缺少必要參數');
  }

  const validStatuses = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', '無效的訂單狀態');
  }

  try {
    const orderRef = db.collection('redemptionOrders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      throw new functions.https.HttpsError('not-found', '訂單不存在');
    }

    const now = admin.firestore.Timestamp.now();
    const updateData = {
      status,
      updatedAt: now,
    };

    if (trackingNumber !== undefined) {
      updateData.trackingNumber = trackingNumber;
    }

    if (adminNote !== undefined) {
      updateData.adminNote = adminNote;
    }

    if (status === 'completed') {
      updateData.completedAt = now;
    }

    await orderRef.update(updateData);

    // 記錄審計日誌
    await db.collection('auditLogs').add({
      adminId: context.auth.uid,
      adminEmail: userEmail,
      action: 'order.updateStatus',
      targetType: 'order',
      targetId: orderId,
      changes: {
        before: { status: orderDoc.data().status },
        after: { status, trackingNumber, adminNote },
        description: `更新訂單 ${orderId} 狀態為 ${status}`,
      },
      createdAt: now,
    });

    return {
      success: true,
      message: '訂單狀態已更新',
    };
  } catch (error) {
    if (error.code) {
      throw error;
    }
    console.error('updateOrderStatus error:', error);
    throw new functions.https.HttpsError('internal', '更新失敗');
  }
});

// ==========================================
// Blog SEO Prerender（為社交媒體爬蟲提供動態 meta tags）
// ==========================================

// 文章資料對照表（簡化版，僅供 OG meta 使用）
const blogArticles = {
  'mortgage-principal-vs-equal-payment': { title: '房貸還款方式比較：本金均攤 vs 本息均攤', category: 'mortgage', description: '詳細比較本金均攤與本息均攤的利息差異、月付金變化、適合對象。' },
  'retirement-planning-basics': { title: '退休規劃入門：勞保勞退年金怎麼算？', category: 'retirement', description: '台灣勞保、勞退年金詳細解說。計算您的退休金缺口，規劃充足的退休生活。' },
  'estate-tax-planning-2026': { title: '2026 遺產稅節稅完整攻略', category: 'tax', description: '2026年最新遺產稅免稅額1,333萬元。完整說明遺產稅計算方式、扣除額項目、累進稅率。' },
  'compound-interest-power': { title: '複利的威力：25歲開始投資 vs 35歲', category: 'investment', description: '愛因斯坦說複利是世界第八大奇蹟。實際計算差距超過1000萬！' },
  'how-to-use-mortgage-calculator': { title: '傲創計算機完整教學', category: 'tools', description: '3分鐘學會使用傲創計算機。免費試算本金均攤、本息均攤等進階功能。' },
  'gift-tax-annual-exemption': { title: '2026 贈與稅免稅額完整攻略', category: 'tax', description: '2026年贈與稅免稅額244萬元。教您善用夫妻合計488萬免稅額度。' },
  'credit-card-installment-2026': { title: '2026 信用卡分期零利率完整比較表', category: 'tools', description: '2026 年最新 14 家銀行信用卡分期零利率優惠比較。' },
  'labor-insurance-pension-2026': { title: '2026 勞保勞退新制完整攻略', category: 'retirement', description: '2026 年勞保法定退休年齡正式調至 65 歲，基本工資調漲至 29,500 元。' },
  'estate-gift-tax-quick-reference-2026': { title: '2026 遺產稅贈與稅免稅額速查表', category: 'tax', description: '2026 年遺產稅免稅額 1,333 萬、贈與稅免稅額 244 萬，完整整理稅率表。' },
  'property-tax-self-use-residence-2026': { title: '2026 房屋稅地價稅自用住宅攻略', category: 'tax', description: '2026 年房屋稅 2.0 全國單一自住稅率降至 1%，地價稅自用住宅 2‰ 優惠稅率。' },
  'bank-deposit-rates-comparison-2026': { title: '2026 台幣定存利率銀行比較表', category: 'investment', description: '2026 年 1 月最新台幣定存利率比較，最高 1.81%。' },
  'nhi-supplementary-premium-2026': { title: '2026 健保補充保費完整攻略', category: 'tax', description: '健保補充保費費率 2.11%，單筆超過 2 萬就要扣。完整說明六大課徵項目。' },
  'savings-insurance-vs-deposit-2026': { title: '2026 儲蓄險 vs 定存完整比較', category: 'investment', description: '用白話文解釋 IRR 內部報酬率、優缺點比較，幫你判斷什麼情況下儲蓄險比定存划算。' },
  'mortgage-refinance-cost-2026': { title: '2026 房貸轉貸成本試算', category: 'mortgage', description: '房貸轉貸成本約 2.5～3 萬元，利差要多少才划算？' },
  'income-tax-brackets-2026': { title: '2026 所得稅級距與扣除額速查表', category: 'tax', description: '2026 年報稅免稅額 10.1 萬、標準扣除額 13.6 萬、薪資扣除額 22.7 萬。' },
  'high-dividend-etf-calendar-2026': { title: '2026 台股高股息 ETF 配息月曆', category: 'investment', description: '0056、00878、00919 配息時間、殖利率、選股邏輯分析，教你月月領息。' },
  'digital-deposit-vs-insurance-value-2026': { title: '數位存款是什麼？銀行現金 vs 保單價值 vs 投資帳戶', category: 'investment', description: '同樣 100 萬，放銀行、放保單、放投資帳戶結果差很多！一篇搞懂數位存款概念。' },
  'reverse-mortgage-vs-professional-planning-2026': { title: '以房養老該去銀行辦嗎？專業規劃比直接貸款更重要', category: 'retirement', description: '以房養老直接去銀行辦？小心長壽風險讓你老後沒保障！找專業財務顧問規劃，搭配足額壽險才是正解。' },
  'career-change-finance-insurance-salary-2026': { title: '年後轉職潮來了！如何挑選行業？金融保險業薪資到底有多高？', category: 'sales', description: '2026 最新數據：金融保險業平均月薪 82,000 元穩居各行業之首！年後轉職該如何挑選行業？完整分析優缺點。' },
  'social-media-marketing-financial-advisor-2026': { title: '社群媒體經營對財務顧問有多重要？2026 最新數據告訴你', category: 'sales', description: '75% 高資產客戶透過社群認識顧問！2026 最新數據揭密：社群媒體經營已成為財務顧問必備技能，不做社群等於放棄一半客戶。' },
  'financial-advisor-survival-2026': { title: '2026 年財務顧問如何不被淘汰？持續學習 + 善用工具是關鍵', category: 'sales', description: '金融業變化越來越快，AI 工具崛起、客戶要求提高、市場競爭加劇。2026 年，財務顧問該怎麼做才能不被淘汰？' },
  'mindset-financial-advisor-2026': { title: '心態，決定你在這行能走多遠', category: 'sales', description: '技巧可以學，話術可以練，但心態不對，一切都是白搭。為什麼有人做三個月就陣亡，有人卻能做十年以上？' },
  'note-taking-financial-advisor-2026': { title: '為什麼頂尖顧問都在做筆記？', category: 'sales', description: '聽了很多課、看了很多書，但為什麼還是覺得沒進步？因為你只有「學」，沒有「習」。筆記，就是把學變成習的關鍵。' },
  'cash-flow-rich-poor-2026': { title: '窮人、中產、富人的現金流差在哪？一張圖看懂', category: 'investment', description: '同樣在工作賺錢，為什麼有人越來越窮、有人原地踏步、有人越來越有錢？差別不在收入多少，而在錢流向哪裡。' },
  'esbi-cashflow-quadrant-2026': { title: 'ESBI 現金流象限：你在哪個位置？', category: 'investment', description: '羅伯特乙崎的 ESBI 象限，四種人的現金流結構完全不同。你是 E、S、B 還是 I？' },
  'client-procrastination-cost-2026': { title: '客戶說「再考慮看看」？拖延的代價超乎想像', category: 'sales', description: '財務決策的拖延，代價是精神、財富、時間的三重損失。如何幫客戶察覺、修正、改善？' },
  'income-tax-amt-guide-2026': { title: '2026 綜所稅＋最低稅負制完整攻略', category: 'tax', description: '2026 年報稅必看！綜所稅級距、免稅額、扣除額，加上最低稅負制（基本稅額）完整說明。' },
  'allianz-global-income-growth-suspended-2026': { title: '安聯收益成長被買爆！暫停申購要緊嗎？', category: 'investment', description: '安聯全球收益成長基金暫停新申購，不是出問題，是太熱門！已持有的人權益完全不受影響。' },
};

// 分類對應的 OG 圖片
const categoryOgImages = {
  mortgage: 'og-mortgage.png',
  retirement: 'og-retirement.png',
  tax: 'og-tax.png',
  investment: 'og-investment.png',
  tools: 'og-tools.png',
  sales: 'og-sales.png',
};

// 爬蟲 User-Agent 檢測
const crawlerUserAgents = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'LinkedInBot',
  'WhatsApp',
  'Slackbot',
  'TelegramBot',
  'Line',
  'LineBot',
  'line-poker',  // LINE URL Preview
  'Googlebot',
  'bingbot',
  'Discordbot',
  'applebot',
  'PinterestBot',
];

function isCrawler(userAgent) {
  if (!userAgent) return false;
  return crawlerUserAgents.some(crawler => userAgent.toLowerCase().includes(crawler.toLowerCase()));
}

/**
 * 部落格 SEO 預渲染
 * 為社交媒體爬蟲返回帶有正確 meta tags 的 HTML
 */
exports.blogSeo = functions.https.onRequest(async (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const path = req.path;

  // 解析 slug
  const match = path.match(/^\/blog\/([^/]+)\/?$/);
  if (!match) {
    // 不是文章頁面，返回 index.html
    res.redirect('/');
    return;
  }

  const slug = match[1];
  const article = blogArticles[slug];

  // 如果不是爬蟲，從 Firebase Hosting 的備用網址取得 index.html
  if (!isCrawler(userAgent)) {
    try {
      // 使用 Firebase Hosting 的 .web.app 網址（不會觸發 rewrite）
      const response = await axios.get('https://grbt-f87fa.web.app/index.html', {
        timeout: 5000,
      });
      res.set('Content-Type', 'text/html');
      res.set('Cache-Control', 'no-cache');
      res.send(response.data);
      return;
    } catch (error) {
      console.error('Error fetching index.html:', error.message);
      // 失敗時使用 JavaScript redirect
      res.set('Content-Type', 'text/html');
      res.send(`<!DOCTYPE html>
<html><head>
<meta http-equiv="refresh" content="0; url=https://grbt-f87fa.web.app/blog/${slug}">
</head><body></body></html>`);
      return;
    }
  }

  // 如果是爬蟲但文章不存在，使用預設值
  const finalArticle = article || {
    title: 'Ultra Advisor 理財知識庫',
    category: 'tools',
    description: '專業財務顧問工具與理財知識，幫助您做出更好的財務決策。',
  };

  // 為爬蟲返回完整的 meta tags
  const ogImage = categoryOgImages[finalArticle.category] || 'og-image.png';
  const fullUrl = `https://ultra-advisor.tw/blog/${slug}`;

  const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${finalArticle.title} | Ultra Advisor</title>
  <meta name="description" content="${finalArticle.description}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${fullUrl}">
  <meta property="og:title" content="${finalArticle.title}">
  <meta property="og:description" content="${finalArticle.description}">
  <meta property="og:image" content="https://ultra-advisor.tw/${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:site_name" content="Ultra Advisor">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${fullUrl}">
  <meta name="twitter:title" content="${finalArticle.title}">
  <meta name="twitter:description" content="${finalArticle.description}">
  <meta name="twitter:image" content="https://ultra-advisor.tw/${ogImage}">

  <link rel="canonical" href="${fullUrl}">
</head>
<body>
  <h1>${finalArticle.title}</h1>
  <p>${finalArticle.description}</p>
  <p><a href="${fullUrl}">閱讀完整文章</a></p>
</body>
</html>`;

  res.set('Content-Type', 'text/html');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(html);
});

// ==========================================
// 🖼️ 圖片代理 API（繞過 CORS 限制）
// 用於限時動態功能載入 Firebase Storage 頭貼
// ==========================================
exports.imageProxy = functions.https.onRequest(async (req, res) => {
  // CORS 設定
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin) || origin?.includes('localhost')) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const imageUrl = req.query.url;

  if (!imageUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  // 只允許 Firebase Storage 的圖片
  if (!imageUrl.includes('firebasestorage.googleapis.com') &&
      !imageUrl.includes('googleusercontent.com')) {
    res.status(403).send('Only Firebase Storage images are allowed');
    return;
  }

  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });

    // 設定正確的 Content-Type
    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // 快取 1 天
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Image proxy error:', error.message);
    res.status(500).send('Failed to fetch image');
  }
});

// ==========================================
// 📬 新申請通知（Firestore 觸發器）
// 當有新預約或合作申請時，發送 LINE 通知給管理員
// ==========================================

// 管理員 LINE 用戶 ID（可透過 firebase functions:config:set admin.line_user_id="YOUR_LINE_USER_ID" 設定）
const ADMIN_LINE_USER_ID = functions.config().admin?.line_user_id;

// 需求分類對照表
const NEED_CATEGORY_LABELS = {
  mortgage: '房貸規劃',
  retirement: '退休規劃',
  insurance: '保險檢視',
  tax: '稅務傳承',
  investment: '投資理財',
  other: '其他諮詢',
};

// 店家類型對照表
const STORE_TYPE_LABELS = {
  cafe: '咖啡廳',
  restaurant: '餐廳',
  'business-center': '商務中心',
  gym: '健身房',
  beauty: '美容美髮',
  other: '其他',
};

/**
 * 🔔 新預約諮詢通知
 * 當 bookingRequests 有新文件建立時觸發
 */
exports.onNewBookingRequest = functions.firestore
  .document('bookingRequests/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const docId = context.params.docId;

    console.log(`📬 新預約諮詢: ${docId}`, { name: data.name, phone: data.phone });

    // 如果沒有設定管理員 LINE ID，只記錄 log
    if (!ADMIN_LINE_USER_ID) {
      console.log('⚠️ 未設定 admin.line_user_id，跳過 LINE 通知');
      return null;
    }

    // 準備通知訊息
    const needLabel = NEED_CATEGORY_LABELS[data.needCategory] || data.needCategory || '未指定';
    const familyCount = data.familyMemberCount || data.familyMembers?.length || 0;
    const createdTime = data.createdAt?.toDate?.()?.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) || '剛剛';

    const message = `📋 新預約諮詢！

👤 姓名：${data.name}
📞 電話：${data.phone}
📧 Email：${data.email || '-'}
💼 職業：${data.occupation || '-'}

📌 需求類型：${needLabel}
👨‍👩‍👧‍👦 家庭成員：${familyCount} 人
🕐 方便時間：${data.preferredTime || '未指定'}

⏰ 提交時間：${createdTime}

➡️ 前往後台查看：
https://admin.ultra-advisor.tw/admin/applications`;

    try {
      await sendLineMessage(ADMIN_LINE_USER_ID, [{ type: 'text', text: message }]);
      console.log('✅ LINE 通知已發送');
    } catch (error) {
      console.error('❌ LINE 通知發送失敗:', error);
    }

    return null;
  });

/**
 * 🔔 新合作申請通知
 * 當 partnerApplications 有新文件建立時觸發
 */
exports.onNewPartnerApplication = functions.firestore
  .document('partnerApplications/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const docId = context.params.docId;

    console.log(`📬 新合作申請: ${docId}`, { storeName: data.storeName, contact: data.contactName });

    // 如果沒有設定管理員 LINE ID，只記錄 log
    if (!ADMIN_LINE_USER_ID) {
      console.log('⚠️ 未設定 admin.line_user_id，跳過 LINE 通知');
      return null;
    }

    // 準備通知訊息
    const storeTypeLabel = STORE_TYPE_LABELS[data.storeType] || data.storeType || '未指定';
    const cooperations = data.cooperationInterests?.join('、') || '-';
    const createdTime = data.createdAt?.toDate?.()?.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) || '剛剛';

    const message = `🤝 新合作申請！

🏪 店家名稱：${data.storeName}
📍 類型：${storeTypeLabel}
📍 地區：${data.district || '-'}
📍 地址：${data.address || '-'}

👤 聯絡人：${data.contactName}
📞 電話：${data.contactPhone}
📧 Email：${data.contactEmail || '-'}

✨ 合作項目：${cooperations}
🎁 提供優惠：${data.discountOffer || '-'}

⏰ 提交時間：${createdTime}

➡️ 前往後台查看：
https://admin.ultra-advisor.tw/admin/applications`;

    try {
      await sendLineMessage(ADMIN_LINE_USER_ID, [{ type: 'text', text: message }]);
      console.log('✅ LINE 通知已發送');
    } catch (error) {
      console.error('❌ LINE 通知發送失敗:', error);
    }

    return null;
  });

// ==========================================
// 🔔 推播通知系統 - FCM
// ==========================================

/**
 * 當 siteContent/notifications 被更新時，發送推播給所有訂閱用戶
 * 只有新增的通知（enabled: true）會觸發推播
 */
exports.onNotificationUpdate = functions
  .region('asia-east1')
  .firestore
  .document('siteContent/notifications')
  .onWrite(async (change, context) => {
    console.log('📢 Notifications document changed');

    // 取得更新前後的資料
    const beforeData = change.before.exists ? change.before.data() : null;
    const afterData = change.after.exists ? change.after.data() : null;

    if (!afterData || !afterData.items) {
      console.log('No notification items found');
      return null;
    }

    // 找出新增的通知（比對 ID）
    const beforeIds = beforeData?.items?.map(n => n.id) || [];
    const newNotifications = afterData.items.filter(n =>
      n.enabled !== false && !beforeIds.includes(n.id)
    );

    if (newNotifications.length === 0) {
      console.log('No new enabled notifications to push');
      return null;
    }

    console.log(`📢 Found ${newNotifications.length} new notifications to push`);

    // 取得所有啟用的 FCM tokens
    const tokensSnapshot = await db.collection('fcmTokens')
      .where('enabled', '==', true)
      .get();

    if (tokensSnapshot.empty) {
      console.log('No FCM tokens found');
      return null;
    }

    const tokens = [];
    tokensSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.token) {
        tokens.push({ uid: doc.id, token: data.token });
      }
    });

    console.log(`📱 Sending push to ${tokens.length} devices`);

    // 發送推播
    const messaging = admin.messaging();
    const sendPromises = [];

    for (const notification of newNotifications) {
      const payload = {
        notification: {
          title: notification.title || 'Ultra Advisor 通知',
          body: notification.content?.substring(0, 100) || '',
        },
        data: {
          notificationId: notification.id,
          url: '/',
          priority: String(notification.priority || 50),
        },
        webpush: {
          fcmOptions: {
            link: 'https://ultra-advisor.tw/',
          },
          notification: {
            icon: 'https://ultra-advisor.tw/logo.png',
            badge: 'https://ultra-advisor.tw/logo.png',
            requireInteraction: false,
          },
        },
      };

      // 批量發送給所有設備
      for (const { uid, token } of tokens) {
        sendPromises.push(
          messaging.send({ ...payload, token })
            .then(() => {
              console.log(`✅ Push sent to ${uid}`);
              return { success: true, uid };
            })
            .catch(async (error) => {
              console.error(`❌ Push failed for ${uid}:`, error.code);

              // 如果 token 失效，標記為 disabled
              if (error.code === 'messaging/registration-token-not-registered' ||
                  error.code === 'messaging/invalid-registration-token') {
                await db.collection('fcmTokens').doc(uid).update({
                  enabled: false,
                  error: error.code,
                  errorAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`🗑️ Disabled invalid token for ${uid}`);
              }

              return { success: false, uid, error: error.code };
            })
        );
      }
    }

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`📊 Push results: ${successCount} success, ${failCount} failed`);

    return { successCount, failCount };
  });

/**
 * 手動發送推播通知（管理員專用）
 * 用於測試或發送自訂通知
 */
exports.sendPushNotification = functions
  .region('asia-east1')
  .https.onCall(async (data, context) => {
    // 驗證管理員身分
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }

    // 檢查是否為管理員
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', '權限不足');
    }

    const { title, body, url, targetUids } = data;

    if (!title) {
      throw new functions.https.HttpsError('invalid-argument', '標題不可為空');
    }

    // 取得目標 tokens
    let tokensQuery = db.collection('fcmTokens').where('enabled', '==', true);

    // 如果指定了目標用戶
    if (targetUids && Array.isArray(targetUids) && targetUids.length > 0) {
      // Firestore 的 in 查詢最多支援 10 個值
      const chunks = [];
      for (let i = 0; i < targetUids.length; i += 10) {
        chunks.push(targetUids.slice(i, i + 10));
      }

      const allTokens = [];
      for (const chunk of chunks) {
        const snapshot = await db.collection('fcmTokens')
          .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
          .where('enabled', '==', true)
          .get();

        snapshot.forEach(doc => {
          allTokens.push({ uid: doc.id, token: doc.data().token });
        });
      }

      return await sendPushToTokens(allTokens, title, body, url);
    }

    // 發送給所有用戶
    const tokensSnapshot = await tokensQuery.get();
    const tokens = [];
    tokensSnapshot.forEach(doc => {
      if (doc.data().token) {
        tokens.push({ uid: doc.id, token: doc.data().token });
      }
    });

    return await sendPushToTokens(tokens, title, body, url);
  });

/**
 * 輔助函數：發送推播給指定的 tokens
 */
async function sendPushToTokens(tokens, title, body, url) {
  if (tokens.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  const messaging = admin.messaging();
  const payload = {
    notification: { title, body: body || '' },
    data: { url: url || '/' },
    webpush: {
      fcmOptions: { link: url || 'https://ultra-advisor.tw/' },
      notification: {
        icon: 'https://ultra-advisor.tw/logo.png',
        badge: 'https://ultra-advisor.tw/logo.png',
      },
    },
  };

  const results = await Promise.all(
    tokens.map(({ uid, token }) =>
      messaging.send({ ...payload, token })
        .then(() => ({ success: true, uid }))
        .catch(error => ({ success: false, uid, error: error.code }))
    )
  );

  const sent = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`📊 Manual push: ${sent} sent, ${failed} failed`);

  return { success: true, sent, failed };
}

// ==========================================
// 📰 新文章推播通知
// ==========================================

/**
 * 發送新文章推播通知（管理員專用）
 *
 * @param {string} articleSlug - 文章 slug（用於組成 URL）
 * @param {string} articleTitle - 文章標題
 * @param {string} articleSummary - 文章摘要（選填）
 */
exports.sendNewArticleNotification = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    // 驗證管理員權限
    await verifyAdminAccess(context);

    const { articleSlug, articleTitle, articleSummary } = data;

    if (!articleSlug || !articleTitle) {
      throw new functions.https.HttpsError('invalid-argument', '缺少文章 slug 或標題');
    }

    const articleUrl = `https://ultra-advisor.tw/blog/${articleSlug}`;
    const title = '📚 新文章上線';
    const body = articleTitle + (articleSummary ? `\n${articleSummary}` : '');

    // 取得所有啟用推播的用戶 tokens
    const tokensSnapshot = await db.collection('fcmTokens')
      .where('enabled', '==', true)
      .get();

    const tokens = [];
    tokensSnapshot.forEach(doc => {
      if (doc.data().token) {
        tokens.push({ uid: doc.id, token: doc.data().token });
      }
    });

    if (tokens.length === 0) {
      return { success: true, sent: 0, failed: 0, message: '沒有可通知的用戶' };
    }

    const messaging = admin.messaging();
    const payload = {
      notification: {
        title,
        body,
      },
      data: {
        type: 'new_article',
        url: articleUrl,
        articleSlug,
        articleTitle,
      },
      webpush: {
        fcmOptions: { link: articleUrl },
        notification: {
          icon: 'https://ultra-advisor.tw/logo.png',
          badge: 'https://ultra-advisor.tw/logo.png',
          tag: `article-${articleSlug}`,
          requireInteraction: true,
          actions: [
            { action: 'read', title: '閱讀文章' },
            { action: 'dismiss', title: '稍後再看' },
          ],
        },
      },
    };

    const results = await Promise.all(
      tokens.map(({ uid, token }) =>
        messaging.send({ ...payload, token })
          .then(() => ({ success: true, uid }))
          .catch(async (error) => {
            // 清理無效 token
            if (error.code === 'messaging/registration-token-not-registered' ||
                error.code === 'messaging/invalid-registration-token') {
              await db.collection('fcmTokens').doc(uid).update({
                enabled: false,
                disabledAt: admin.firestore.Timestamp.now(),
                disabledReason: error.code,
              });
            }
            return { success: false, uid, error: error.code };
          })
      )
    );

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // 記錄推播歷史
    await db.collection('pushNotificationLogs').add({
      type: 'new_article',
      articleSlug,
      articleTitle,
      totalRecipients: tokens.length,
      sent,
      failed,
      sentBy: context.auth.uid,
      createdAt: admin.firestore.Timestamp.now(),
    });

    console.log(`📰 New article push: "${articleTitle}" - ${sent} sent, ${failed} failed`);

    return {
      success: true,
      sent,
      failed,
      message: `已發送給 ${sent} 位用戶`,
    };
  });

// ==========================================
// 🆕 保單健診系統 - OCR 辨識
// ==========================================

exports.processInsuranceOCR = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data, context) => {
  // 1. 身份驗證
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  // 1.5. 🔒 每日上限 — OCR 是 Cloud Vision + Gemini 雙費用，限 20/天
  await enforceDailyLimit('ocr', context, 20);

  const { imageBase64, storagePath } = data;

  // 支援兩種模式：base64 直傳 或 Storage 路徑
  if (!imageBase64 && !storagePath) {
    throw new functions.https.HttpsError('invalid-argument', '缺少圖片資料');
  }

  const userId = context.auth.uid;

  // 若用 storagePath，需安全檢查
  if (storagePath && !storagePath.startsWith(`insurance-policies/${userId}/`)) {
    throw new functions.https.HttpsError('permission-denied', '無權存取此檔案');
  }

  try {
    const vision = require('@google-cloud/vision');
    const client = new vision.ImageAnnotatorClient();

    let fullText = '';

    if (imageBase64) {
      // 模式 A：直接用 base64 圖片
      // 移除 data URL 前綴 (data:image/jpeg;base64,...)
      const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      console.log(`🔍 OCR 辨識開始 (base64, ${Math.round(imageBuffer.length / 1024)}KB)`);

      const [result] = await client.textDetection({
        image: { content: imageBuffer },
      });
      fullText = result.fullTextAnnotation?.text || '';
    } else {
      // 模式 B：從 Storage 讀取
      const bucket = admin.storage().bucket();
      const gcsUri = `gs://${bucket.name}/${storagePath}`;

      console.log(`🔍 OCR 辨識開始: ${storagePath}`);

      if (storagePath.toLowerCase().endsWith('.pdf')) {
        const [result] = await client.documentTextDetection(gcsUri);
        fullText = result.fullTextAnnotation?.text || '';
      } else {
        const [result] = await client.textDetection(gcsUri);
        fullText = result.fullTextAnnotation?.text || '';
      }
    }

    console.log(`✅ OCR 完成，擷取 ${fullText.length} 字元`);
    // 印出原始文字以便除錯（截斷到 500 字元）
    console.log(`📄 OCR 原始文字: ${fullText.substring(0, 500)}`);

    return {
      success: true,
      rawText: fullText,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ OCR 辨識失敗:', error.message);
    throw new functions.https.HttpsError('internal', `OCR 辨識失敗: ${error.message}`);
  }
});

// ==========================================
// 保單健診系統 — Gemini AI 解析 & 險種快取
// ==========================================

const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * parseInsuranceOCR — Gemini Vision 直接辨識保單圖片
 * 輸入：{ imageBase64, mimeType, imageUrl, familyMemberId }
 * 支援兩種模式：
 *   1. imageBase64 + mimeType：前端直接傳 base64（推薦）
 *   2. imageUrl：從 Storage URL 下載後再傳給 Gemini
 * 輸出：{ policy: Partial<PolicyInfo> }
 */
// ==========================================
// Sprint 14 W1 — Catalog auto-match helper
// ==========================================
/**
 * 嘗試把單一 coverage match 到 `insurance_products` collection。
 *
 * 三層 fuzzy 策略（命中即返回，越精準的越優先）：
 *   P1: company + productCode exact match
 *   P2: company + productName 字串相似度（≥5 字 substring 重疊 OR Levenshtein ≤3）
 *   P3: company + categoryMain + sumInsured ∈ [minSumAssured, maxSumAssured]
 *       (P3 須 catalog doc 有 min/max sum 欄位才生效；Sprint 13 WRITE_WHITELIST
 *        目前未包含這兩欄，所以 P3 命中率為 0；helper 保留邏輯給 Sprint 15
 *        擴充 whitelist 後立刻可用。)
 *
 * 失敗（admin SDK error / collection 不存在 / 無候選）回傳 null，**不 throw**
 * — 呼叫端負責標 _catalogMissFlag。
 *
 * 鐵則：
 *   - 不對外暴露 sourceNote / source / sourceUrl（呼叫端只把 catalogMetadata
 *     寫進 coverage、不轉發給 client）。
 *   - 「現在時間」runtime 取得：本 helper 不取 wall clock，由呼叫端在 parsing
 *     callback 內取得 `_catalogProcessedAt`。
 *   - 不引入新 dep — Levenshtein 用內聯 O(m·n) DP。
 *
 * @param {FirebaseFirestore.Firestore} adminDb — 已 init 的 admin SDK firestore
 * @param {object} coverage — Gemini 解析出的單條險種
 * @param {string|null} policyInsurer — policy-level insurer 名（OCR 可能帶後綴）
 * @returns {Promise<{catalogProductId: string, catalogMetadata: object, matchedBy: 'productCode'|'productName'|'categorySum'} | null>}
 */
async function tryMatchProductCatalog(adminDb, coverage, policyInsurer) {
  if (!coverage || typeof coverage !== 'object') return null;
  if (!policyInsurer || typeof policyInsurer !== 'string') return null;

  // 正規化公司名：剝掉常見後綴，提高 OCR 與 catalog `company` 對齊率
  const normalizeInsurer = (s) => {
    if (!s) return '';
    return String(s)
      .replace(/股份有限公司$/u, '')
      .replace(/保險$/u, '')
      .replace(/\s+/gu, '')
      .trim();
  };
  const insurerKey = normalizeInsurer(policyInsurer);
  if (!insurerKey) return null;

  // catalog 端 company 寫入時即為 TII shortName（e.g. '國泰人壽'）；
  // 我們對兩種 form 都試一次（先帶後綴、再剝後綴）。
  const insurerCandidates = Array.from(
    new Set([policyInsurer.trim(), insurerKey].filter(Boolean))
  );

  const COL = 'insurance_products';
  const productCode = coverage.code && String(coverage.code).trim();
  const productName = coverage.name && String(coverage.name).trim();

  // 內聯 Levenshtein（無 dep）
  const levenshtein = (a, b) => {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    // 早退：長度差 >3 直接拒（callers 只關心 ≤3）
    if (Math.abs(m - n) > 3) return Math.abs(m - n);
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = dp[j];
        dp[j] = (a.charCodeAt(i - 1) === b.charCodeAt(j - 1))
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    return dp[n];
  };

  // longest common substring length（用來算 ≥5 字重疊）
  const longestCommonSubstrLen = (a, b) => {
    if (!a || !b) return 0;
    const m = a.length;
    const n = b.length;
    let best = 0;
    let prev = new Array(n + 1).fill(0);
    let curr = new Array(n + 1).fill(0);
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        curr[j] = (a.charCodeAt(i - 1) === b.charCodeAt(j - 1))
          ? prev[j - 1] + 1
          : 0;
        if (curr[j] > best) best = curr[j];
      }
      [prev, curr] = [curr, prev];
      curr.fill(0);
    }
    return best;
  };

  const pickMetadata = (data) => ({
    companySlug: data.companySlug || null,
    categoryMain: data.categoryMain || null,
    // 下面四欄 Sprint 13 ingest WRITE_WHITELIST 未含、預期為 undefined；
    // 留鍵以利 Sprint 15 擴充 whitelist 後 client 不用改 shape。
    minSumAssured: typeof data.minSumAssured === 'number' ? data.minSumAssured : null,
    maxSumAssured: typeof data.maxSumAssured === 'number' ? data.maxSumAssured : null,
    unit: data.unit || data.displayUnit || data.currencyUnit || null,
    isWholeLife: typeof data.isWholeLife === 'boolean' ? data.isWholeLife : null,
    status: data.status || null,
  });

  // ── Priority 1: company + productCode exact match ──
  if (productCode) {
    for (const insurer of insurerCandidates) {
      try {
        const snap = await adminDb.collection(COL)
          .where('company', '==', insurer)
          .where('productCode', '==', productCode)
          .limit(1)
          .get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          return {
            catalogProductId: doc.id,
            catalogMetadata: pickMetadata(doc.data() || {}),
            matchedBy: 'productCode',
          };
        }
      } catch (e) {
        // Re-throw — callers wrap整段在 try/catch、會降級為 _catalogMatchError
        throw e;
      }
    }
  }

  // ── Priority 2: company + productName fuzzy ──
  // 從同公司全部商品 pull 下來做相似度比較（單一公司商品數通常 < 500、可接受）
  //
  // Critic A 必修 (P3 path cost):
  //   原本 P2 fail 後 P3 又對同 company 開新 query (limit 50)、最壞單條 coverage
  //   reads = 1 + 500 + 50 = 551、5 條 coverage = 2755 reads/OCR。
  //   修法: P2 候選 batch 本身已含 categoryMain / minSumAssured / maxSumAssured
  //   (Sprint 15 之後 whitelist 擴充也只會在同個 doc shape 上加欄位)、把 P3 改成
  //   in-memory filter 同個 candidates 陣列、0 額外 Firestore read。
  //   單條最壞 reads 降到 1 + 500 = 501、5 條 = 2505、節省 ~10% / 攤平 admin SDK
  //   timeout 風險。Sprint 15 補 min/maxSumAssured 後命中率立刻提升、無需改 helper。
  //
  // 我們也把 P2 fetch 出來的 candidates 暫存到上層作用域、供 P3 直接重用。
  let candidates = [];
  let candidatesFetched = false; // 標記是否真的打過 Firestore
  if (productName) {
    for (const insurer of insurerCandidates) {
      try {
        const snap = await adminDb.collection(COL)
          .where('company', '==', insurer)
          .limit(500)
          .get();
        candidatesFetched = true;
        if (!snap.empty) {
          snap.forEach((d) => candidates.push({ id: d.id, data: d.data() || {} }));
          break; // 找到一組就夠
        }
      } catch (e) {
        throw e;
      }
    }
    if (candidates.length > 0) {
      let bestP2 = null;
      let bestScore = Infinity; // Levenshtein 距離（小=好）
      for (const c of candidates) {
        const candName = String(c.data.productName || '').trim();
        if (!candName) continue;
        const lcs = longestCommonSubstrLen(productName, candName);
        if (lcs >= 5) {
          // 5 字重疊直接命中，挑 lcs 最長的
          if (!bestP2 || lcs > (bestP2._lcs || 0)) {
            bestP2 = { ...c, _lcs: lcs };
          }
          continue;
        }
        // Levenshtein 後備；只在短名稱（避免 50 字長名跟 5 字名距離 ≤3 的假陽性）
        if (Math.abs(productName.length - candName.length) <= 3) {
          const dist = levenshtein(productName, candName);
          if (dist <= 3 && dist < bestScore) {
            bestScore = dist;
            if (!bestP2) bestP2 = { ...c, _lev: dist };
          }
        }
      }
      if (bestP2) {
        return {
          catalogProductId: bestP2.id,
          catalogMetadata: pickMetadata(bestP2.data),
          matchedBy: 'productName',
        };
      }
    }
  }

  // ── Priority 3: company + categoryMain + sumInsured 在 [min, max] ──
  // Sprint 13 ingest 未寫 min/maxSumAssured 進 Firestore、此 path 目前 0 命中
  // 率，但 helper 保留邏輯以便 Sprint 15 whitelist 擴充後立刻生效。
  //
  // Critic A 修法: 重用 P2 已 fetch 的 candidates。如果 P2 沒打過 query
  // (productName 為空)、再依需要 fall back 補打一次小 query (limit 50)。
  const sumInsured = typeof coverage.sumInsured === 'number' ? coverage.sumInsured : null;
  const categoryHint = coverage.category || coverage.categoryMain; // OCR 通常無
  if (sumInsured && categoryHint) {
    // 先試 in-memory filter
    if (candidatesFetched && candidates.length > 0) {
      for (const c of candidates) {
        const data = c.data || {};
        if (data.categoryMain !== categoryHint) continue;
        const lo = typeof data.minSumAssured === 'number' ? data.minSumAssured : null;
        const hi = typeof data.maxSumAssured === 'number' ? data.maxSumAssured : null;
        if (lo !== null && hi !== null && sumInsured >= lo && sumInsured <= hi) {
          return {
            catalogProductId: c.id,
            catalogMetadata: pickMetadata(data),
            matchedBy: 'categorySum',
          };
        }
      }
      // P2 已 fetch、in-memory 沒命中 → 不再開新 Firestore query (省 reads)
      return null;
    }
    // P2 沒打過 (沒 productName)、只在這種邊角案例補一次小 query
    for (const insurer of insurerCandidates) {
      try {
        const snap = await adminDb.collection(COL)
          .where('company', '==', insurer)
          .where('categoryMain', '==', categoryHint)
          .limit(50)
          .get();
        if (!snap.empty) {
          for (const d of snap.docs) {
            const data = d.data() || {};
            const lo = typeof data.minSumAssured === 'number' ? data.minSumAssured : null;
            const hi = typeof data.maxSumAssured === 'number' ? data.maxSumAssured : null;
            if (lo !== null && hi !== null && sumInsured >= lo && sumInsured <= hi) {
              return {
                catalogProductId: d.id,
                catalogMetadata: pickMetadata(data),
                matchedBy: 'categorySum',
              };
            }
          }
        }
      } catch (e) {
        throw e;
      }
    }
  }

  return null;
}

exports.parseInsuranceOCR = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }

    // 🔒 每日上限 — Gemini Vision 直接辨識，限 20/天
    await enforceDailyLimit('parse_ocr', context, 20);

    const { imageBase64, mimeType, imageUrl, familyMemberId } = data;
    if (!imageBase64 && !imageUrl) {
      throw new functions.https.HttpsError('invalid-argument', '缺少圖片資料');
    }

    try {
      const geminiApiKey = functions.config().gemini?.api_key;
      if (!geminiApiKey) {
        throw new Error('Gemini API key 未設定，請執行 firebase functions:config:set gemini.api_key="YOUR_KEY"');
      }

      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      // 準備圖片資料
      let imgBase64 = imageBase64;
      let imgMimeType = mimeType || 'image/jpeg';

      if (!imgBase64 && imageUrl) {
        // 從 URL 下載圖片轉 base64
        const axios = require('axios');
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
        imgBase64 = Buffer.from(response.data).toString('base64');
        imgMimeType = response.headers['content-type'] || 'image/jpeg';
      }

      if (!imgBase64) {
        throw new Error('無法取得圖片資料');
      }

      // HEIC/HEIF 格式轉換為 JPEG（iPhone 預設格式，Gemini 不支援）
      if (imgMimeType === 'image/heic' || imgMimeType === 'image/heif') {
        console.log('📷 偵測到 HEIC/HEIF 格式，轉換 mimeType 為 image/jpeg');
        imgMimeType = 'image/jpeg';
      }

      console.log(`📷 parseInsuranceOCR: 圖片大小 ${(imgBase64.length / 1024).toFixed(0)} KB, 類型 ${imgMimeType}`);

      // Gemini Vision 直接辨識圖片 + 結構化解析（一步到位）
      const prompt = `你是台灣保險專家。請辨識這張保單圖片中的所有文字，並解析為以下 JSON 格式。

請回傳純 JSON（不要 markdown 程式碼區塊）：

{
  "insurer": "保險公司名稱",
  "policyNumber": "保單號碼",
  "applicant": "要保人姓名",
  "applicantBirthDate": "要保人出生日期 YYYY-MM-DD 或民國格式如 65/12/23",
  "applicantAgeAtIssue": 要保人投保年齡（數字），
  "applicantGender": "要保人性別 male 或 female",
  "insured": "被保險人姓名",
  "insuredBirthDate": "被保險人出生日期 YYYY-MM-DD 或民國格式如 87/05/10",
  "insuredAgeAtIssue": 被保險人投保年齡（數字），
  "insuredGender": "被保險人性別 male 或 female",
  "effectiveDate": "YYYY-MM-DD",
  "totalAnnualPremium": 數字,
  "paymentFrequency": "年繳/半年繳/季繳/月繳/躉繳",
  "currency": "TWD/USD/其他",
  "coverages": [
    {
      "name": "險種名稱",
      "code": "險種代碼（如有）",
      "sumInsured": 保額數字,
      "annualPremium": 保費數字,
      "paymentYears": 繳費年期,
      "coverageYears": 保障年期,
      "isLifetime": 是否終身布林值,
      "isRider": 是否為附約布林值
    }
  ]
}

注意：
- 第一筆通常是主約（isRider: false），後面是附約（isRider: true）
- 金額請用數字，不要帶逗號或「萬」
- 日期格式 YYYY-MM-DD（民國年請保留原始格式如 65/12/23）
- 如果有些欄位看不出來，請填 null
- 幣別預設 TWD
- 如果圖片模糊看不清，盡量辨識能看到的部分
- 性別若無法直接判斷，可以從姓名或稱謂推測（先生/女士）
- 保單面頁常見「投保年齡」欄位，請務必抓取 applicantAgeAtIssue 和 insuredAgeAtIssue`;

      const imagePart = {
        inlineData: {
          data: imgBase64,
          mimeType: imgMimeType,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const responseText = result.response.text();
      console.log(`🤖 Gemini 回應長度: ${responseText.length}`);

      // 提取 JSON（支援有或沒有 markdown code block）
      let jsonStr = responseText;
      const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseErr) {
        console.error('❌ JSON 解析失敗:', jsonStr.substring(0, 200));
        throw new Error('AI 回傳格式錯誤，請重新拍照');
      }

      // 補上 familyMemberId
      parsed.familyMemberId = familyMemberId;
      parsed.inputMethod = 'ocr';

      // 為每個 coverage 補 id
      if (parsed.coverages) {
        parsed.coverages = parsed.coverages.map((c, i) => ({
          ...c,
          id: `ocr-${Date.now()}-${i}`,
          isRider: c.isRider !== false && i > 0,
        }));
      }

      // ── Sprint 14 W1: catalog auto-match ──
      // 每條 coverage 跑一次 fuzzy match，命中就 attach catalogProductId +
      // catalogMetadata、未命中就 _catalogMissFlag。任何階段 throw 都降級為
      // _catalogMatchError，不影響 OCR 本體回傳（顧問仍可手動填）。
      let catalogMatchCount = 0;
      let catalogMissCount = 0;
      try {
        if (Array.isArray(parsed.coverages) && parsed.coverages.length > 0) {
          // 注意：runtime「現在時間」於此 callback 內取得（不在 module top-level）
          const processedAt = Date.now();
          parsed._catalogProcessedAt = processedAt;
          for (let i = 0; i < parsed.coverages.length; i++) {
            const cov = parsed.coverages[i];
            try {
              const match = await tryMatchProductCatalog(db, cov, parsed.insurer);
              if (match && match.catalogProductId) {
                cov.catalogProductId = match.catalogProductId;
                cov.catalogMetadata = match.catalogMetadata;
                cov._catalogMatchedBy = match.matchedBy;
                catalogMatchCount++;
              } else {
                cov._catalogMissFlag = true;
                cov._catalogMissReason = 'no-match';
                catalogMissCount++;
              }
            } catch (innerErr) {
              // 單條 coverage 查 catalog 出錯，不影響其他條
              console.warn(`⚠️ catalog match 單條失敗 (idx=${i}):`, innerErr.message);
              cov._catalogMissFlag = true;
              cov._catalogMissReason = 'lookup-error';
              catalogMissCount++;
            }
          }
        }
        parsed._catalogMatchCount = catalogMatchCount;
        parsed._catalogMissCount = catalogMissCount;
      } catch (catalogErr) {
        // collection 不存在 / admin SDK 整體故障 → 整個 catalog match 階段跳過
        console.warn('⚠️ catalog match 階段整體失敗，跳過:', catalogErr.message);
        parsed._catalogMatchError = catalogErr.message || 'unknown';
        parsed._catalogMatchCount = catalogMatchCount;
        parsed._catalogMissCount = catalogMissCount;
      }

      console.log(`✅ Gemini 保單解析完成：${parsed.insurer || '未知'} / ${parsed.coverages?.length || 0} 個險種 / catalog ${catalogMatchCount} match, ${catalogMissCount} miss`);

      return { policy: parsed };
    } catch (error) {
      console.error('❌ parseInsuranceOCR 錯誤:', error.message);
      throw new functions.https.HttpsError('internal', `保單解析失敗: ${error.message}`);
    }
  });

/**
 * lookupInsuranceProduct — 搜尋險種條款 + Gemini 摘要
 * 輸入：{ insurer, productName }
 * 輸出：{ product: ProductCache, claimSummary }
 */
exports.lookupInsuranceProduct = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }

    // 🔒 每日上限 — 搜尋 + Gemini 摘要，限 50/天（比 OCR 高，因為有快取）
    await enforceDailyLimit('product_lookup', context, 50);

    const { insurer, productName } = data;
    if (!productName) {
      throw new functions.https.HttpsError('invalid-argument', '缺少 productName');
    }

    try {
      // 先查快取
      const cacheQuery = await db.collection('productCache')
        .where('insurer', '==', insurer || '')
        .where('productName', '==', productName)
        .limit(1)
        .get();

      if (!cacheQuery.empty) {
        const cached = cacheQuery.docs[0].data();
        // 更新搜尋次數
        await cacheQuery.docs[0].ref.update({
          searchCount: admin.firestore.FieldValue.increment(1),
          lastSearched: new Date().toISOString(),
        });
        console.log(`✅ 快取命中：${insurer} - ${productName}`);
        return { product: { id: cacheQuery.docs[0].id, ...cached }, claimSummary: cached.claimSummary };
      }

      // 快取未命中 → Gemini AI 生成摘要
      const geminiApiKey = functions.config().gemini?.api_key;
      if (!geminiApiKey) {
        throw new Error('Gemini API key 未設定');
      }

      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = `你是台灣保險條款分析專家。請根據你的知識，分析以下保險商品並回傳 JSON 格式。

保險公司：${insurer || '未知'}
商品名稱：${productName}

重要：你只需要回傳「險種分類」和「保障特性」，不要猜測具體金額（因為金額依投保內容而定）。

請回傳以下 JSON 格式（只回傳 JSON，不要其他文字）：

{
  "category": "險種分類，選擇一個：life_term/life_whole/medical_expense/medical_daily/surgery/critical_illness/major_injury/cancer/accident/accident_medical/disability/long_term_care/waiver/annuity/investment/other",
  "status": "selling",
  "waitingPeriod": 等待期天數（如30、90，無則填0）,
  "isCopyReceipt": 是否接受副本理賠（true/false，若不確定填 null）,
  "isGuaranteedRenewal": 是否保證續保（true/false，若不確定填 null）,
  "claimConditions": "簡述理賠條件，50字內",
  "coverageFeatures": ["此險種的保障特色，如：住院雜費、門診手術、骨折未住院、意外身故等"],
  "claimSummary": {},
  "keywords": ["相關關鍵字"]
}

險種分類說明：
- medical_expense：實支實付（住院雜費、手術費等限額給付）
- medical_daily：住院日額（按住院天數給付）
- surgery：手術險（按手術等級表給付）
- accident：意外險（意外身故、失能保障，不含醫療）
- accident_medical：意外醫療（意外實支、意外住院日額、骨折未住院）
- critical_illness：重大疾病（一次金給付）
- cancer：癌症險
- waiver：豁免附約
- life_term/life_whole：壽險

注意：
1. claimSummary 留空物件 {}，實際金額由保單資料提供
2. coverageFeatures 填寫此險種「通常包含」的保障項目
3. 如果是「傷害醫療」類，通常包含：意外實支、意外住院日額、骨折未住院
4. 如果是純「傷害保險」（不含醫療），只有意外身故和失能，沒有醫療給付`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      let productData = {};
      if (jsonMatch) {
        productData = JSON.parse(jsonMatch[0]);
      }

      // 儲存到快取
      const cacheDoc = {
        insurer: insurer || '',
        productName,
        productCode: '',
        category: productData.category || 'other',
        keywords: productData.keywords || [productName],
        searchCount: 1,
        lastSearched: new Date().toISOString(),
        status: productData.status || 'selling',
        claimSummary: productData.claimSummary || {},
        rawDescription: responseText.substring(0, 2000),
        lastUpdated: new Date().toISOString(),
        updatedBy: 'ai',
      };

      const docRef = await db.collection('productCache').add(cacheDoc);
      console.log(`✅ 新增快取：${insurer} - ${productName} (${docRef.id})`);

      return {
        product: { id: docRef.id, ...cacheDoc },
        claimSummary: cacheDoc.claimSummary,
      };
    } catch (error) {
      console.error('❌ lookupInsuranceProduct 錯誤:', error.message);
      throw new functions.https.HttpsError('internal', `險種查詢失敗: ${error.message}`);
    }
  });

/**
 * searchProductCache — 險種名稱自動完成查詢
 * 輸入：{ keyword }
 * 輸出：{ products: ProductCache[] }
 */
exports.searchProductCache = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const { keyword } = data;
  if (!keyword || keyword.length < 2) {
    return { products: [] };
  }

  try {
    // Firestore 不支援 LIKE 查詢，使用前綴比對
    const snapshot = await db.collection('productCache')
      .where('productName', '>=', keyword)
      .where('productName', '<=', keyword + '\uf8ff')
      .orderBy('productName')
      .limit(10)
      .get();

    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 也搜尋 keywords 陣列
    if (products.length < 10) {
      const keywordSnapshot = await db.collection('productCache')
        .where('keywords', 'array-contains', keyword)
        .limit(10 - products.length)
        .get();

      const existingIds = new Set(products.map(p => p.id));
      keywordSnapshot.docs.forEach(doc => {
        if (!existingIds.has(doc.id)) {
          products.push({ id: doc.id, ...doc.data() });
        }
      });
    }

    return { products };
  } catch (error) {
    console.error('❌ searchProductCache 錯誤:', error.message);
    return { products: [] };
  }
});

// ==========================================
// [已移除] Threads 功能已遷移至 MindThread.tw
// exchangeThreadsToken + threadsScheduledPublish 已於 2026-03-13 移除
// ==========================================

// [Threads 功能已於 2026-03-13 移除，遷移至 MindThread.tw]
// 原 exchangeThreadsToken + threadsScheduledPublish 已刪除


// ==========================================
// 🤖 AI Financial Insight Engine — 通用 AI 分析引擎
// 支援：房貸分析、保障建議（未來擴充更多工具）
// 公開可用（不需登入），以 IP 限流
// ==========================================

exports.generateFinancialInsight = functions
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
    const { type, payload } = data;
    if (!type || !payload) {
      throw new functions.https.HttpsError('invalid-argument', '缺少分析類型或資料');
    }

    // --- Rate limiting ---
    const uid = context.auth?.uid;
    const ip = context.rawRequest?.ip || context.rawRequest?.headers?.['x-forwarded-for'] || 'unknown';
    const rateLimitKey = uid || ip.replace(/[^a-zA-Z0-9]/g, '_');
    const today = new Date().toISOString().split('T')[0];
    const rateLimitRef = db.collection('rateLimits').doc(`insight_${rateLimitKey}_${today}`);

    try {
      const rlDoc = await rateLimitRef.get();
      const currentCount = rlDoc.exists ? (rlDoc.data().count || 0) : 0;
      const dailyLimit = uid ? 30 : 10; // 登入用戶 30 次，匿名 10 次

      if (currentCount >= dailyLimit) {
        throw new functions.https.HttpsError('resource-exhausted', '今日 AI 分析次數已達上限，請明天再試');
      }

      await rateLimitRef.set({
        count: currentCount + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      if (err.code === 'resource-exhausted') throw err;
      console.warn('⚠️ Rate limit check failed, proceeding:', err.message);
    }

    // --- Build prompt ---
    let prompt = '';

    if (type === 'mortgage') {
      const { loanAmount, annualRate, loanTerm, method, monthlyPayment, totalInterest, totalPayment, interestRatio } = payload;
      prompt = `你是台灣的房貸分析專家。根據以下房貸條件，提供精準的財務分析洞察。

貸款條件：
- 貸款金額：${loanAmount} 萬元（${loanAmount * 10000} 元）
- 年利率：${annualRate}%
- 貸款年限：${loanTerm} 年（${loanTerm * 12} 期）
- 還款方式：${method === 'equal_payment' ? '本息均攤' : '本金均攤'}

計算結果：
- 每月還款：${Math.round(monthlyPayment).toLocaleString()} 元
- 累計利息：${Math.round(totalInterest).toLocaleString()} 元
- 總還款金額：${Math.round(totalPayment).toLocaleString()} 元
- 利息佔比：${interestRatio.toFixed(1)}%

請提供以下分析（用 markdown 格式）：

### 📊 整體評估
一句話點評這筆房貸。

### 💰 利息成本解讀
利息佔比是高是低？與台灣 2026 年市場平均水準比較。

### ⚡ 省息方案
如果每月多還 5,000 元，預估可省下多少利息、提前幾年還清？（用近似計算即可）

### 🎯 具體建議
給一個最實用的行動建議。

要求：
- 繁體中文，語氣像朋友給建議
- 用數字說話，給具體金額
- 總字數 200-300 字
- 不要有推銷語氣`;
    } else if (type === 'insurance') {
      const { memberName, age, annualIncome, gaps, totalPolicies, totalPremium, premiumRatio, coverageScore } = payload;
      prompt = `你是台灣的保險規劃分析專家。根據以下保障現況，提供個人化的保障分析報告。

客戶基本資料：
- 姓名：${memberName || '客戶'}
- 年齡：${age || '未提供'} 歲
- 年收入：${annualIncome ? annualIncome.toLocaleString() : '未提供'} 元

保障現況：
- 持有保單：${totalPolicies} 張
- 年繳總保費：${totalPremium ? totalPremium.toLocaleString() : 0} 元
- 保費佔收入比：${premiumRatio ? premiumRatio.toFixed(1) : 0}%
- 保障分數：${coverageScore}/100

保障缺口：
${gaps && gaps.length > 0 ? gaps.map(g => `- [${g.severity === 'critical' ? '嚴重不足' : '略有不足'}] ${g.category}：${g.description}`).join('\n') : '- 無明顯缺口'}

請提供以下分析（用 markdown 格式）：

### 📊 保障總評
一句話總結保障現況。

### ⚠️ 優先處理
最需要優先補強的 1-2 個項目，說明原因和建議保額。

### 💡 保費優化
保費是否合理？有無重複或可調整的空間？

### 🎯 行動建議
下一步最該做什麼？

要求：
- 繁體中文，語氣專業但親切
- 具體到金額和險種方向
- 總字數 200-300 字
- 客觀中立，不推銷任何產品`;
    } else {
      throw new functions.https.HttpsError('invalid-argument', `不支援的分析類型: ${type}`);
    }

    // --- Call Gemini ---
    try {
      const geminiApiKey = functions.config().gemini?.api_key;
      if (!geminiApiKey) {
        throw new Error('Gemini API key 未設定');
      }

      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const insight = result.response.text();

      console.log(`✅ AI Insight (${type}): ${insight.length} chars`);

      // 記錄分析使用量
      try {
        await db.collection('aiInsightLogs').add({
          type,
          uid: uid || null,
          charCount: insight.length,
          createdAt: admin.firestore.Timestamp.now(),
        });
      } catch (logErr) {
        // 紀錄失敗不影響主流程
      }

      return { insight };
    } catch (error) {
      console.error(`❌ generateFinancialInsight (${type}):`, error.message);
      throw new functions.https.HttpsError('internal', `AI 分析失敗: ${error.message}`);
    }
  });

// ==========================================
// 每日市場 AI 報告（排程 + 手動觸發）
// 台股盤後 14:00 自動抓取市場數據 → Gemini 產出摘要 → 存 Firestore → FCM 推播
// ==========================================

// 手動觸發版本（用於測試 & 補跑）
exports.generateDailyMarketReport = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    // 僅限管理員觸發
    if (context.auth) {
      const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
      if (!adminDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', '僅限管理員');
      }
    }

    const targetDate = data?.date || new Date().toISOString().split('T')[0];
    return await _generateMarketReport(targetDate);
  });

// 排程版本：盤後 — 每天台股收盤後 14:30 (UTC+8 = UTC 06:30)
exports.scheduledMarketReport = functions.pubsub
  .schedule('30 6 * * 1-5')  // 週一到週五 UTC 06:30 = 台灣 14:30
  .timeZone('UTC')
  .onRun(async () => {
    const today = _getTaiwanDate();
    console.log(`📊 盤後排程觸發: ${today}`);
    await _generateMarketReport(today, 'post');
    return null;
  });

// 取得台灣時區日期 YYYY-MM-DD
function _getTaiwanDate() {
  const now = new Date();
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return tw.toISOString().split('T')[0];
}

// 核心邏輯：抓數據 → Gemini 分析 → 存 Firestore → 推播
// type: 'pre' = 盤前, 'post' = 盤後
async function _generateMarketReport(date, type = 'post') {
  const docId = type === 'pre' ? `${date}-pre` : date;
  const label = type === 'pre' ? '盤前' : '盤後';
  console.log(`📊 開始產出${label}市場報告: ${docId}`);

  // 1. 檢查是否已產出過（避免重複）
  const reportRef = db.collection('dailyMarketReports').doc(docId);
  const existing = await reportRef.get();
  if (existing.exists) {
    console.log(`⏭️ ${docId} 報告已存在，跳過`);
    return { status: 'already_exists', date: docId };
  }

  // 2. 抓取市場數據（Yahoo Finance）
  let marketData;
  try {
    const symbols = ['^TWII', 'TWD=X', '^GSPC', '^TNX', '^DJI', '^IXIC', '0050.TW'];
    const responses = await Promise.allSettled(
      symbols.map(symbol =>
        axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`, {
          params: { interval: '1d', range: '2d' },
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000,
        })
      )
    );

    marketData = {};
    const nameMap = {
      '^TWII': { key: 'twii', name: '台股加權指數' },
      'TWD=X': { key: 'usdtwd', name: '美元/台幣' },
      '^GSPC': { key: 'sp500', name: 'S&P 500' },
      '^TNX': { key: 'us10y', name: '美國 10 年期公債殖利率' },
      '^DJI': { key: 'dji', name: '道瓊工業指數' },
      '^IXIC': { key: 'nasdaq', name: 'NASDAQ' },
      '0050.TW': { key: 'etf0050', name: '元大台灣 50 ETF' },
    };

    symbols.forEach((symbol, i) => {
      const res = responses[i];
      if (res.status === 'fulfilled' && res.value?.data?.chart?.result?.[0]) {
        const result = res.value.data.chart.result[0];
        const meta = result.meta;
        const prev = meta.chartPreviousClose || meta.previousClose;
        const curr = meta.regularMarketPrice;
        const change = curr - prev;
        const changePercent = prev ? ((change / prev) * 100) : 0;

        const info = nameMap[symbol];
        marketData[info.key] = {
          name: info.name,
          symbol,
          price: parseFloat(curr?.toFixed(2)),
          change: parseFloat(change?.toFixed(2)),
          changePercent: parseFloat(changePercent?.toFixed(2)),
          previousClose: parseFloat(prev?.toFixed(2)),
        };
      } else {
        const info = nameMap[symbol];
        console.warn(`⚠️ ${info.name} 數據抓取失敗`);
      }
    });

    console.log(`✅ 市場數據抓取完成: ${Object.keys(marketData).length} 個指標`);
  } catch (err) {
    console.error('❌ 市場數據抓取失敗:', err.message);
    throw new functions.https.HttpsError('internal', '市場數據抓取失敗');
  }

  // 3. Gemini AI 分析（盤前/盤後用不同 prompt）
  let aiSummary;
  try {
    const geminiApiKey = functions.config().gemini?.api_key;
    if (!geminiApiKey) throw new Error('Gemini API key 未設定');

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const dataStr = Object.values(marketData).map(d =>
      `${d.name}(${d.symbol}): ${d.price} (${d.change >= 0 ? '+' : ''}${d.change}, ${d.change >= 0 ? '+' : ''}${d.changePercent}%)`
    ).join('\n');

    const prompt = type === 'pre'
      ? `你是專業的台灣市場分析師。根據最新數據，產出一份簡潔的盤前市場快訊，幫助投資人在開盤前掌握國際動態。

最新市場數據（含昨日美股收盤 + 台股前一交易日）：
${dataStr}

請產出以下格式的 JSON（不要 markdown code block，直接回傳 JSON）：

{
  "headline": "10-15字的一句話標題，例如：美股全面收紅 台股開盤看多",
  "summary": "50-80字摘要，聚焦昨夜美股表現、匯率變化，以及對今日台股開盤的影響",
  "keyPoints": [
    "重點1：20-30字",
    "重點2：20-30字",
    "重點3：20-30字"
  ],
  "outlook": "20-30字的今日台股開盤展望",
  "sentiment": "bullish 或 bearish 或 neutral（判斷規則：主要指數漲幅 ≥0.3% 為 bullish，跌幅 ≥0.3% 為 bearish，介於 -0.3%~+0.3% 才是 neutral）"
}

要求：繁體中文、不做投資建議、語氣專業簡潔、數據要準確引用。sentiment 必須根據實際漲跌幅判斷，不要因為追求中立而忽略明顯的市場方向。`
      : `你是專業的台灣市場分析師。根據今日（${date}）收盤數據，產出一份簡潔的盤後市場快訊。

今日收盤數據：
${dataStr}

請產出以下格式的 JSON（不要 markdown code block，直接回傳 JSON）：

{
  "headline": "10-15字的一句話標題，例如：台股量縮反彈 站穩月線",
  "summary": "50-80字的市場重點摘要，提及主要指數表現和關鍵趨勢",
  "keyPoints": [
    "重點1：20-30字",
    "重點2：20-30字",
    "重點3：20-30字"
  ],
  "outlook": "20-30字的明日展望或注意事項",
  "sentiment": "bullish 或 bearish 或 neutral（判斷規則：台股漲幅 ≥0.3% 為 bullish，跌幅 ≥0.3% 為 bearish，介於 -0.3%~+0.3% 才是 neutral）"
}

要求：繁體中文、不做投資建議、語氣專業簡潔、數據要準確引用。sentiment 必須根據實際漲跌幅判斷，不要因為追求中立而忽略明顯的市場方向。`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // 清理可能的 markdown code block
    const cleanJson = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    aiSummary = JSON.parse(cleanJson);

    // Post-validation: 如果 Gemini 給的 sentiment 跟實際數據明顯矛盾，直接覆蓋
    const primaryData = type === 'pre' ? marketData.sp500 : marketData.twii;
    if (primaryData) {
      const pct = primaryData.changePercent;
      if (pct >= 1.0 && aiSummary.sentiment !== 'bullish') {
        console.log(`⚠️ Gemini 說 ${aiSummary.sentiment} 但主要指數漲 ${pct}%，覆蓋為 bullish`);
        aiSummary.sentiment = 'bullish';
      } else if (pct <= -1.0 && aiSummary.sentiment !== 'bearish') {
        console.log(`⚠️ Gemini 說 ${aiSummary.sentiment} 但主要指數跌 ${pct}%，覆蓋為 bearish`);
        aiSummary.sentiment = 'bearish';
      } else if (pct >= 0.3 && aiSummary.sentiment === 'neutral') {
        aiSummary.sentiment = 'bullish';
      } else if (pct <= -0.3 && aiSummary.sentiment === 'neutral') {
        aiSummary.sentiment = 'bearish';
      }
    }

    console.log(`✅ AI 摘要產出: ${aiSummary.headline} | sentiment: ${aiSummary.sentiment}`);
  } catch (err) {
    console.error('❌ AI 摘要產出失敗:', err.message);
    // AI 失敗時用基本摘要（根據實際漲跌幅判斷 sentiment）
    const twii = marketData.twii;
    const sp = marketData.sp500;

    // 根據主要指數漲跌幅自動判斷 sentiment
    const autoSentiment = (refData) => {
      if (!refData) return 'neutral';
      const pct = refData.changePercent;
      if (pct >= 0.3) return 'bullish';
      if (pct <= -0.3) return 'bearish';
      return 'neutral';
    };

    // 根據數據生成有意義的 outlook
    const autoOutlook = (type, twiiData, spData) => {
      if (type === 'pre') {
        if (!spData) return '關注國際動態對台股開盤影響。';
        const pct = spData.changePercent;
        if (pct >= 1) return `美股強勢收漲，台股今日開盤偏多看待。`;
        if (pct <= -1) return `美股重挫，台股今日開盤恐有壓力。`;
        if (pct >= 0.3) return `美股小幅走高，台股今日開盤有撐。`;
        if (pct <= -0.3) return `美股偏弱，台股今日開盤留意賣壓。`;
        return `美股平盤整理，台股今日開盤觀望氣氛濃。`;
      } else {
        if (!twiiData) return '關注明日市場動態。';
        const pct = twiiData.changePercent;
        const pts = Math.abs(twiiData.change).toFixed(0);
        if (pct >= 1) return `台股大漲${pts}點，短線留意追高風險。`;
        if (pct <= -1) return `台股重挫${pts}點，留意是否出現止穩訊號。`;
        if (pct >= 0.3) return `台股溫和上漲，關注成交量能否配合。`;
        if (pct <= -0.3) return `台股小幅修正，觀察支撐是否有效。`;
        return `台股窄幅整理，靜待方向選擇。`;
      }
    };

    const primaryRef = type === 'pre' ? sp : twii;

    if (type === 'pre') {
      aiSummary = {
        headline: sp ? `美股${sp.change >= 0 ? '收漲' : '收跌'} 台股開盤關注` : '盤前市場數據',
        summary: '昨夜美股及國際市場數據已更新，請查看各指數表現。',
        keyPoints: Object.values(marketData).filter(d => ['sp500', 'dji', 'nasdaq', 'usdtwd'].includes(Object.keys(marketData).find(k => marketData[k] === d))).slice(0, 3).map(d =>
          `${d.name} ${d.price} (${d.change >= 0 ? '+' : ''}${d.changePercent}%)`
        ),
        outlook: autoOutlook('pre', twii, sp),
        sentiment: autoSentiment(primaryRef),
      };
    } else {
      aiSummary = {
        headline: twii ? `台股 ${twii.change >= 0 ? '收漲' : '收跌'} ${Math.abs(twii.change).toFixed(0)} 點` : '今日市場數據',
        summary: '今日市場數據已更新，請查看各指數表現。',
        keyPoints: Object.values(marketData).slice(0, 3).map(d =>
          `${d.name} ${d.price} (${d.change >= 0 ? '+' : ''}${d.changePercent}%)`
        ),
        outlook: autoOutlook('post', twii, sp),
        sentiment: autoSentiment(primaryRef),
      };
    }
  }

  // 4. 存入 Firestore
  const reportData = {
    date,
    type, // 'pre' or 'post'
    marketData,
    aiSummary,
    createdAt: admin.firestore.Timestamp.now(),
    source: 'yahoo-finance + gemini-2.0-flash',
  };

  await reportRef.set(reportData);
  console.log(`✅ ${label}報告已存入 Firestore: dailyMarketReports/${docId}`);

  // 5. FCM 推播給所有有開啟通知的會員
  try {
    const tokensSnapshot = await db.collection('fcmTokens')
      .where('enabled', '==', true)
      .get();

    if (!tokensSnapshot.empty) {
      const messaging = admin.messaging();
      const tokens = [];
      tokensSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.token) tokens.push({ uid: doc.id, token: data.token });
      });

      const twii = marketData.twii;
      const notifTitle = type === 'pre'
        ? `🌅 盤前快訊｜${aiSummary.headline}`
        : `📊 盤後快訊｜${aiSummary.headline}`;
      const notifBody = twii
        ? `加權 ${twii.price.toLocaleString()} (${twii.change >= 0 ? '+' : ''}${twii.changePercent}%) | ${aiSummary.keyPoints?.[0] || ''}`
        : aiSummary.summary;

      let successCount = 0;
      const sendPromises = tokens.map(async ({ uid, token }) => {
        try {
          await messaging.send({
            token,
            notification: { title: notifTitle, body: notifBody },
            webpush: {
              fcmOptions: { link: 'https://ultra-advisor.tw' },
              notification: { icon: '/logo.png', badge: '/logo.png' },
            },
          });
          successCount++;
        } catch (err) {
          if (err.code === 'messaging/registration-token-not-registered' ||
              err.code === 'messaging/invalid-registration-token') {
            await db.collection('fcmTokens').doc(uid).update({ enabled: false });
          }
        }
      });

      await Promise.allSettled(sendPromises);
      console.log(`✅ FCM 推播完成: ${successCount}/${tokens.length} 成功`);
    }
  } catch (pushErr) {
    console.error('⚠️ FCM 推播失敗（不影響報告）:', pushErr.message);
  }

  return { status: 'success', date: docId, headline: aiSummary.headline };
}

// ==========================================
// 🔔 Pin 通知整合
// ==========================================
// 部署前設定：
//   firebase functions:config:set pin.webhook_base="https://pin.8338.hk" pin.webhook_secret="<secret>"
// Pin 端：advisor skill 需先宣告 webhooks（HQ 負責）
// ==========================================

/**
 * 連結 Pin（Telegram）通知
 * 前端傳入從 Pin advisor 選單取得的 8 碼 hex token，
 * 後端呼叫 Pin /_bind 換取 pin_user_id，存入 users/{uid}
 */
exports.connectPinNotifications = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  const { token } = data || {};

  if (!validatePinToken(token)) {
    throw new functions.https.HttpsError('invalid-argument', 'Token 格式不正確（需為 8 碼十六進位）');
  }

  if (!PIN_WEBHOOK_BASE || !PIN_WEBHOOK_SECRET) {
    console.error('[Pin] Missing pin.webhook_base or pin.webhook_secret config');
    throw new functions.https.HttpsError('internal', '系統設定不完整，請聯絡管理員');
  }

  let pinUserId;
  try {
    const response = await axios.post(
      `${PIN_WEBHOOK_BASE}/webhooks/_bind`,
      { token },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
    pinUserId = response.data?.pin_user_id;
  } catch (error) {
    const status = error.response?.status;
    if (status === 401 || status === 404 || status === 410) {
      throw new functions.https.HttpsError('not-found', 'Token 無效或已過期，請重新從 Pin 取得');
    }
    console.error('[Pin] bind error status:', status, 'message:', error.message);
    throw new functions.https.HttpsError('internal', '綁定失敗，請稍後再試');
  }

  if (!pinUserId) {
    throw new functions.https.HttpsError('internal', 'Pin 回傳資料不完整');
  }

  await db.collection('users').doc(context.auth.uid).set(
    {
      pinUserId,
      pinConnectedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { success: true, pinUserId };
});

/**
 * 解除 Pin 綁定
 */
exports.disconnectPin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  await db.collection('users').doc(context.auth.uid).update({
    pinUserId: admin.firestore.FieldValue.delete(),
    pinConnectedAt: admin.firestore.FieldValue.delete(),
  });

  return { success: true };
});

/**
 * 每日金句推播主邏輯（shared by scheduled & manual trigger）
 * @returns {{ sent: number, total: number } | { skipped: true, reason: string }}
 */
async function _sendPinDailyQuote() {
  if (!PIN_WEBHOOK_BASE || !PIN_WEBHOOK_SECRET) {
    console.error('[Pin] Missing pin.webhook_base or pin.webhook_secret — skip daily quote');
    return { skipped: true, reason: 'missing config' };
  }

  // Build date string in Taiwan local time (UTC+8)
  const now = new Date();
  const twOffset = 8 * 60 * 60 * 1000;
  const twDate = new Date(now.getTime() + twOffset);
  const dateStr = twDate.toISOString().slice(0, 10);

  let quote;
  try {
    const qRes = await axios.get(
      `https://ultra-advisor.tw/api/daily-quote?date=${dateStr}`,
      { timeout: 10000 }
    );
    quote = qRes.data?.data;
  } catch (err) {
    console.error('[Pin] Failed to fetch daily quote:', err.message);
    return { skipped: true, reason: 'quote fetch failed' };
  }

  if (!quote?.text) {
    console.error('[Pin] daily-quote response missing text field');
    return { skipped: true, reason: 'no quote text' };
  }

  const snapshot = await db.collection('users').where('pinUserId', '!=', null).get();
  if (snapshot.empty) {
    console.log('[Pin] No users with pinUserId, skip daily quote');
    return { sent: 0, total: 0 };
  }

  let successCount = 0;
  const sendPromises = snapshot.docs.map(async (docSnap) => {
    const pinUserId = docSnap.data().pinUserId;
    if (!pinUserId) return;

    // Serialize once → sign the exact bytes that will be sent (no re-serialize)
    const bodyStr = JSON.stringify({
      pin_user_id: pinUserId,
      // auth_url = passwordless auto-login link for THIS member (docSnap.id = uid).
      data: { date: quote.date, text: quote.text, auth_url: signPinAuthUrl(docSnap.id, 'share') },
    });
    const bodyBytes = Buffer.from(bodyStr);
    const sig = computePinSignature(PIN_WEBHOOK_SECRET, bodyBytes);

    try {
      await axios.post(
        `${PIN_WEBHOOK_BASE}/webhooks/advisor/daily_quote.scheduled`,
        bodyBytes,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Pin-Signature': sig,
          },
          timeout: 10000,
        }
      );
      successCount++;
    } catch (err) {
      // Do not log pinUserId — it contains chat ID (privacy)
      console.error(`[Pin] daily_quote send failed (${err.response?.status}):`, err.message);
    }
  });

  await Promise.allSettled(sendPromises);
  console.log(`[Pin] Daily quote sent: ${successCount}/${snapshot.docs.length}`);
  return { sent: successCount, total: snapshot.docs.length };
}

/**
 * 每日金句定時推播 — 每天 08:00 台灣時間
 * TODO: 設好 pin.webhook_base + pin.webhook_secret、Pin advisor skill 宣告 webhooks 後，
 *       取消下方 exports 的註解並重新部署。
 */
exports.sendPinDailyQuote = functions.pubsub
  .schedule('0 8 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async () => { await _sendPinDailyQuote(); });

/**
 * 手動觸發每日金句推播（管理員）
 * 供驗收 / 測試用
 */
exports.triggerPinDailyQuote = functions.https.onCall(async (data, context) => {
  await verifyAdminAccess(context);
  const result = await _sendPinDailyQuote();
  return { success: true, ...result };
});

/**
 * Passwordless Pin→Advisor auto-login (boss 2026-06-13: LINE 內建瀏覽器不留登入).
 * Verifies the HMAC-signed short-lived link minted in signPinAuthUrl, then mints
 * a Firebase custom token and redirects the member into the app already signed in.
 */
exports.pinAuth = functions.https.onRequest(async (req, res) => {
  const tab = String(req.query.tab || 'share');
  const fallback = `https://ultra-advisor.tw/?tab=${encodeURIComponent(tab)}`;
  try {
    const u = String(req.query.u || '');
    const exp = String(req.query.exp || '');
    const provided = String(req.query.sig || '');
    if (!u || !exp || !provided || !PIN_AUTH_SECRET) return res.redirect(302, fallback);
    if (Date.now() > Number(exp)) return res.status(410).send('🔗 連結已過期，請回 Pin 重新點一次「做今日金句圖卡」。');
    const expected = crypto.createHmac('sha256', PIN_AUTH_SECRET).update(`${u}.${exp}.${tab}`).digest('hex');
    const a = Buffer.from(provided), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).send('連結無效。');
    const customToken = await auth.createCustomToken(u);
    return res.redirect(302, `https://ultra-advisor.tw/?ct=${encodeURIComponent(customToken)}&tab=${encodeURIComponent(tab)}`);
  } catch (e) {
    console.error('[pinAuth] error:', e.message);
    return res.redirect(302, fallback);
  }
});

// ==========================================
// Sprint 11 Stream 3.B — Lifecycle Email Pipeline
// ==========================================
// D0 (welcome) → triggered by auth.user().onCreate
// D2 / D4 / D5 / D6 → daily pubsub cron (Asia/Taipei)
//
// IRONCLAD RULES:
//  - RESEND_API_KEY env 未設 → DRY-RUN (logger.info only), 不 throw, 不擋部署
//  - 不引入新 npm 依賴 — Resend 走 axios + REST (已 require axios at top of file)
//  - 「現在時間」一律 onRun callback 內取，不在 schedule 字串裡寫死日期
//  - 寄完 update users/{uid}.lifecycleStage 去重 (避免 cron 重跑同一天重寄)
//  - 不動 Sprint 5 trial_countdown / checkTrialExpiration LINE 通知邏輯 — 那是 LINE channel,
//    這條是 email channel, 兩者並存。後續若 push notification 介入會在 Sprint 12 統一。
// ==========================================

const { getLifecycleTemplate } = require('./lib/lifecycle-email-templates');

// Lifecycle stage progression. cron 跑時找 stage < target 才寄,確保 D2→D4→D5→D6 順序不會跳。
const LIFECYCLE_STAGE_ORDER = {
  none: 0,
  welcome: 1,
  no_client_yet: 2,
  aha_reminder: 3,
  trial_countdown: 4,
  trial_ending: 5,
};

const APP_BASE_URL = 'https://ultra-advisor.tw';
const LIFECYCLE_FROM = 'Ultra Advisor <hello@ultra-advisor.tw>';

/**
 * Interpolate {{vars}} placeholders. Pure string replace; no template engine.
 * Caller MUST supply all vars referenced in the template — undefined values are
 * substituted as empty string (avoids "{{undefined}}" leaking to inboxes).
 */
function interpolateTemplate(str, vars) {
  return Object.entries(vars).reduce((acc, [k, v]) => {
    const safe = v === undefined || v === null ? '' : String(v);
    return acc.replace(new RegExp(`{{${k}}}`, 'g'), safe);
  }, str);
}

/**
 * Resend dispatcher. Dry-run if RESEND_API_KEY not set so the cron is safe to
 * deploy without credentials — user verifies via Cloud Function logs first,
 * then sets the secret to flip to real-send (no code change needed).
 *
 * @param {string} toEmail - Recipient email
 * @param {string} stage   - LifecycleStage key (see TEMPLATES)
 * @param {object} vars    - Interpolation context: displayName, ctaUrl, daysRemaining, etc.
 * @returns {Promise<{ dryRun: boolean, sent?: boolean, error?: string }>}
 */
async function sendLifecycleEmail(toEmail, stage, vars) {
  const template = getLifecycleTemplate(stage);
  if (!template) {
    functions.logger.warn('[lifecycle] unknown stage', { stage });
    return { dryRun: false, sent: false, error: 'unknown_stage' };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  // === DRY-RUN PATH ===
  // No API key set yet → log what we would have sent. Lets us deploy the cron
  // and verify cohort queries against real users before flipping the send switch.
  if (!RESEND_API_KEY) {
    functions.logger.info('[lifecycle] DRY-RUN (RESEND_API_KEY unset)', {
      to: toEmail,
      stage,
      subject: interpolateTemplate(template.subject, vars),
      vars,
    });
    return { dryRun: true, sent: false };
  }

  // === REAL SEND PATH ===
  try {
    await axios.post(
      'https://api.resend.com/emails',
      {
        from: LIFECYCLE_FROM,
        to: toEmail,
        subject: interpolateTemplate(template.subject, vars),
        html: interpolateTemplate(template.html, vars),
        text: interpolateTemplate(template.text, vars),
        headers: {
          // Preheader is rendered via inbox preview; Resend doesn't have a
          // dedicated field, so we lean on the inline preheader convention.
          'X-Entity-Ref-ID': `lifecycle-${stage}-${Date.now()}`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      }
    );
    functions.logger.info('[lifecycle] sent', { to: toEmail, stage });
    return { dryRun: false, sent: true };
  } catch (err) {
    // Log full Resend response body if available — helps debug 422 invalid-from-domain etc.
    functions.logger.error('[lifecycle] resend error', {
      to: toEmail,
      stage,
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    return { dryRun: false, sent: false, error: err.message };
  }
}

/**
 * Auth onCreate — D0 welcome email.
 * Fires once when a Firebase Auth user is created (any method: email/password,
 * Google, anonymous-upgrade, LINE flow's auth.createUser).
 *
 * NOTE: createTrialAccount() (line ~874) creates a Firestore user doc with
 * createdAt timestamp. This trigger fires from the auth event — Firestore doc
 * may not exist yet (race). We don't need it for the welcome email; we only
 * need email + a sensible display name.
 *
 * To avoid double-sending if the user later upgrades + we ship a re-trigger
 * later, we write lifecycleStage='welcome' to users/{uid}. cron daily then
 * sees this and starts D2 cadence from there.
 */
exports.onUserAuthCreate = functions.auth.user().onCreate(async (user) => {
  // Anonymous users have no email. Skip — they'll get the email when they upgrade.
  if (!user.email) {
    functions.logger.info('[lifecycle:welcome] skip — no email', { uid: user.uid });
    return null;
  }

  const displayName =
    user.displayName ||
    user.email.split('@')[0] ||
    '你';

  const ctaUrl = `${APP_BASE_URL}/?utm_source=lifecycle&utm_campaign=welcome`;

  try {
    const result = await sendLifecycleEmail(user.email, 'welcome', {
      displayName,
      ctaUrl,
    });

    // Always mark stage as 'welcome' so cron doesn't re-send D0. Even in dry-run.
    // serverTimestamp() — taken in callback (rule: time在 callback 內).
    //
    // critic P0: 之前沒寫 createdAt → cron 用 .where('createdAt', '>=', ...) 撈不到
    //   走 auth-only path 的新註冊 (LiffRegister / 直接 createUserWithEmailAndPassword)
    //   結果 D2/D4/D5/D6 永遠不會寄。merge:true 保留 createTrialAccount 已寫的值、
    //   缺則由本 trigger 補上。
    await db.collection('users').doc(user.uid).set(
      {
        lifecycleStage: 'welcome',
        lifecycleSentAt: admin.firestore.FieldValue.serverTimestamp(),
        lifecycleWelcomeAt: admin.firestore.FieldValue.serverTimestamp(),
        // 補關鍵：cron cohort 視窗 query 依此欄
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    functions.logger.info('[lifecycle:welcome] processed', {
      uid: user.uid,
      dryRun: result.dryRun,
    });
  } catch (err) {
    // Don't throw — onCreate failure blocks downstream auth flow. Log only.
    functions.logger.error('[lifecycle:welcome] error', {
      uid: user.uid,
      message: err.message,
    });
  }
  return null;
});

/**
 * Daily lifecycle cron — D2 / D4 / D5 / D6.
 *
 * Runs once a day 09:00 Asia/Taipei. For each cohort, queries users whose
 * createdAt falls in the cohort window AND whose lifecycleStage < target.
 *
 * Window logic (day-N cohort = "user created N days ago today"):
 *   windowStart = now - (N+1) days
 *   windowEnd   = now - N days
 *   → catches anyone whose D-N anniversary lands in the last 24h regardless
 *     of exact clock time. Slight overlap with D-N±1 is filtered by
 *     lifecycleStage check (we already sent → skip).
 *
 * Schedule string is plain cron syntax (not "every 24 hours" App-Engine
 * shorthand) so it matches existing schedules (checkTrialExpiration etc.) in
 * this file — consistent + works on both gen-1 functions and gen-2 scheduler.
 *
 * Cost: 1 invocation/day × 4 queries × users-per-window. For <10k users this
 * is well under free-tier (2M invocations/month).
 */
exports.sendLifecycleEmails = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (context) => {
    // RULE: "現在時間" 在 callback 內取。
    const now = admin.firestore.Timestamp.now();
    const nowMs = now.toMillis();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Cohort defs — keep in sync with template stages.
    // For trial_countdown we compute daysRemaining from trialExpiresAt (handled below).
    const COHORTS = [
      { dayN: 2, stage: 'no_client_yet',   minStageOrder: LIFECYCLE_STAGE_ORDER.no_client_yet },
      { dayN: 4, stage: 'aha_reminder',    minStageOrder: LIFECYCLE_STAGE_ORDER.aha_reminder },
      { dayN: 5, stage: 'trial_countdown', minStageOrder: LIFECYCLE_STAGE_ORDER.trial_countdown },
      { dayN: 6, stage: 'trial_ending',    minStageOrder: LIFECYCLE_STAGE_ORDER.trial_ending },
    ];

    let totalSent = 0;
    let totalDryRun = 0;
    let totalSkipped = 0;

    for (const cohort of COHORTS) {
      const windowEnd = admin.firestore.Timestamp.fromMillis(nowMs - cohort.dayN * DAY_MS);
      const windowStart = admin.firestore.Timestamp.fromMillis(nowMs - (cohort.dayN + 1) * DAY_MS);

      try {
        // Query: users created in window, no email send for this stage yet.
        // We can't compound-where on createdAt range + lifecycleStage equality
        // without a composite index. So we filter stage in JS — cohort window is
        // small (typically <100 docs/day for current scale).
        const snap = await db.collection('users')
          .where('createdAt', '>=', windowStart)
          .where('createdAt', '<', windowEnd)
          .get();

        functions.logger.info(`[lifecycle:${cohort.stage}] cohort size`, { count: snap.size });

        for (const doc of snap.docs) {
          const userData = doc.data();
          const uid = doc.id;

          // Skip if already past this stage (cron re-ran, manual stage set, etc.)
          const currentStageOrder = LIFECYCLE_STAGE_ORDER[userData.lifecycleStage] || 0;
          if (currentStageOrder >= cohort.minStageOrder) {
            totalSkipped++;
            continue;
          }

          // Stage-specific gates (avoid wrong emails):
          //  - no_client_yet → only if 0 real clients (we want to ignore the
          //    3 demo clients seeded at signup). We use a `realClientCount`
          //    field; if missing, skip-safe rather than spam.
          if (cohort.stage === 'no_client_yet') {
            const realCount = Number(userData.realClientCount ?? userData.clientCount ?? 0);
            if (realCount > 0) {
              totalSkipped++;
              continue;
            }
          }
          //  - aha_reminder → only if toolUsageCount == 0 (user hasn't opened
          //    any of the 18 tools). Tracked by existing tool-open analytics.
          if (cohort.stage === 'aha_reminder') {
            const usage = Number(userData.toolUsageCount ?? 0);
            if (usage > 0) {
              totalSkipped++;
              continue;
            }
          }

          // No email → skip silently. We'll never have a stage > welcome
          // without an email because onUserAuthCreate gates on email, but
          // legacy users seeded via console may lack it.
          if (!userData.email) {
            totalSkipped++;
            continue;
          }

          // Build template vars — daysRemaining only meaningful for trial_countdown.
          const displayName =
            userData.displayName ||
            userData.email.split('@')[0] ||
            '你';

          const vars = {
            displayName,
            ctaUrl: `${APP_BASE_URL}/?utm_source=lifecycle&utm_campaign=${cohort.stage}`,
            privacyUrl: `${APP_BASE_URL}/privacy`,
            termsUrl: `${APP_BASE_URL}/terms`,
            unsubscribeUrl: `${APP_BASE_URL}/settings/email?uid=${uid}`,
            daysRemaining: '',
          };

          if (cohort.stage === 'trial_countdown' || cohort.stage === 'trial_ending') {
            // Derive from trialExpiresAt if present, otherwise fall back to
            // (7 - dayN) — covers Sprint 5 schema where daysRemaining was a
            // counter field, not a derived value.
            if (userData.trialExpiresAt?.toMillis) {
              const remaining = Math.max(
                0,
                Math.ceil((userData.trialExpiresAt.toMillis() - nowMs) / DAY_MS)
              );
              vars.daysRemaining = String(remaining);
            } else if (typeof userData.daysRemaining === 'number') {
              vars.daysRemaining = String(userData.daysRemaining);
            } else {
              vars.daysRemaining = String(Math.max(0, 7 - cohort.dayN));
            }
          }

          const result = await sendLifecycleEmail(userData.email, cohort.stage, vars);

          // Update stage REGARDLESS of dry-run vs real — dry-run still represents
          // "we processed this user today, don't loop again tomorrow".
          // If real-send failed (network), DON'T update — let tomorrow retry.
          if (result.dryRun || result.sent) {
            await doc.ref.update({
              lifecycleStage: cohort.stage,
              lifecycleSentAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            if (result.dryRun) totalDryRun++;
            else totalSent++;
          }
        }
      } catch (err) {
        functions.logger.error(`[lifecycle:${cohort.stage}] cohort error`, {
          message: err.message,
        });
      }
    }

    functions.logger.info('[lifecycle] daily run complete', {
      sent: totalSent,
      dryRun: totalDryRun,
      skipped: totalSkipped,
    });
    return null;
  });

// ==========================================
// 🆕 Sprint 14 W3 — Quota Usage (Agent Chat / PDF View / Missing Product Submit)
// ==========================================
//
// 為什麼用 callable + client 傳 yyyymm（不是 server now()）：
//   server 跑在 us-central1 (UTC-6/UTC-5 DST 切換)，顧問在台灣 (UTC+8)。
//   如果用 server `new Date()` 推 yyyymm 會在 8:00 AM UTC（台灣 16:00）
//   切月、造成顧問當天 16:00 後使用量被算進「下個月」。改由 client 用
//   顧問本地時區算 yyyymm 並傳上來，讓 server 只負責讀 doc，避免時區漂移。
//
// 配額（單位：次/月）：
//   asks                  : 100  (AI 條款問答)
//   pdfViews              : 50   (條款 PDF 檢視)
//   missingProductSubmits : 30   (產品 catalog 缺漏回報)
//
// extensionRequestable 永遠 true — 客戶端據此決定要不要顯示「申請額度」按鈕。
//
exports.getQuotaUsage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }
  const uid = context.auth.uid;

  // client 必傳 yyyymm（避免 server 時區飄移）— 缺值/格式錯就拒絕。
  const yyyymm = typeof data?.yyyymm === 'string' ? data.yyyymm : '';
  if (!/^\d{6}$/.test(yyyymm)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'yyyymm 必須為 6 位數字字串（例如 202606）',
    );
  }

  const docRef = db.doc(`advisors/${uid}/quotaUsage/${yyyymm}`);
  let usage;
  try {
    const snap = await docRef.get();
    usage = snap.exists ? snap.data() : null;
  } catch (err) {
    console.error('getQuotaUsage read error', { uid, yyyymm, err: err.message });
    throw new functions.https.HttpsError('internal', '配額查詢失敗，請稍後再試');
  }

  const used = usage || { asks: 0, pdfViews: 0, missingProductSubmits: 0 };

  return {
    yyyymm,
    quotas: {
      asks: { used: Number(used.asks || 0), limit: 100 },
      pdfViews: { used: Number(used.pdfViews || 0), limit: 50 },
      missingProductSubmits: {
        used: Number(used.missingProductSubmits || 0),
        limit: 30,
      },
    },
    extensionRequestable: true,
  };
});

// ==========================================
// 📝 Sprint 14 W3 — Audit Log (logAuditEvent)
// ==========================================
//
// 顧問端敏感操作（PDF view / agent ask / quota breach / missing-flag）審計。
// 7 年保留 — 目前直寫 Firestore、Sprint 15+ 加 cron 把 12 個月前的 partition
// export 到 GCS / BigQuery、控制 free tier 容量。
//
// Doc path: audit_logs/{yyyymm}/events/{eventId}
//   - yyyymm 用 UTC 切月（server-side 一致性、配額用 client 本地時區是另一回事）
//   - eventId = type_<epoch-ms>_<uid>_<rand4>  防碰撞
//   - 所有時間戳必須 runtime callback 內取（HARD rule：module top-level 0 wall-clock call）
//
// PII redact：
//   - 台灣身分證 / 手機 / 市話 regex redact
//   - 中文姓名 3-4 字保守不做（撞名詞太多、誤殺）
//   - 不動 Firestore sentinel / Date / Buffer
//

/**
 * Sanitize PII in a free-form string.
 */
function sanitizePIIForAudit(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/[A-Z][12]\d{8}/g, '[ID_REDACTED]')          // 台灣身分證 (A123456789)
    .replace(/09\d{8}/g, '[PHONE_REDACTED]')              // 台灣手機 09xxxxxxxx
    .replace(/0\d{1,2}-?\d{7,8}/g, '[PHONE_REDACTED]');   // 市話 02-12345678 / 0212345678
}

/**
 * Deep-sanitize an arbitrary value — walk strings, recurse plain objects + arrays.
 * 不動 Date / Buffer / Firestore sentinel；深度上限 8 層、防環。
 */
function sanitizePIIDeep(value, depth, seen) {
  if (depth === undefined) depth = 0;
  if (seen === undefined) seen = new WeakSet();
  if (value == null) return value;
  if (depth > 8) return '[MAX_DEPTH]';

  if (typeof value === 'string') return sanitizePIIForAudit(value);
  if (typeof value !== 'object') return value;

  if (value instanceof Date) return value;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return value;

  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((v) => sanitizePIIDeep(v, depth + 1, seen));
  }

  // 只處理 plain object — class instance / FieldValue sentinel 等不動
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;

  const out = {};
  for (const k of Object.keys(value)) {
    out[k] = sanitizePIIDeep(value[k], depth + 1, seen);
  }
  return out;
}

exports.logAuditEvent = functions.https.onCall(async (data, context) => {
  // --- Auth gate ---
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '請先登入');
  }

  // --- Input validation ---
  if (!data || typeof data !== 'object') {
    throw new functions.https.HttpsError('invalid-argument', 'data 必須是物件');
  }
  const type = data.type;
  if (!type || typeof type !== 'string' || type.length > 64) {
    throw new functions.https.HttpsError('invalid-argument', 'type 必填且 <= 64 字元');
  }
  if (!/^[a-z][a-z0-9_.-]*$/i.test(type)) {
    throw new functions.https.HttpsError('invalid-argument', 'type 格式不符 (a-z0-9_.-)');
  }

  const uid = context.auth.uid;

  // --- Time + eventId（runtime callback 內取、不在 module top-level）---
  const nowMs = Date.now();
  const nowDate = new Date(nowMs);
  const yyyymm =
    nowDate.getUTCFullYear().toString() +
    String(nowDate.getUTCMonth() + 1).padStart(2, '0');
  const randSuffix = crypto.randomBytes(4).toString('hex');
  const eventId = `${type}_${nowMs}_${uid}_${randSuffix}`;

  // --- Sanitize input ---
  const rawContext =
    data.context && typeof data.context === 'object' ? data.context : {};
  const sanitizedContext = sanitizePIIDeep(rawContext);

  const result =
    typeof data.result === 'string' && data.result.length <= 64
      ? data.result
      : 'success';

  const userAgent =
    (typeof data.userAgent === 'string' && data.userAgent.slice(0, 512)) ||
    context.rawRequest?.headers?.['user-agent']?.slice(0, 512) ||
    null;

  const ip =
    context.rawRequest?.ip ||
    context.rawRequest?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    null;

  // --- Write audit doc ---
  const doc = {
    type,
    advisorUid: uid,
    advisorEmail: context.auth.token?.email || null,
    ip,
    userAgent,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    context: sanitizedContext,
    result,
    schemaVersion: 1,
  };

  try {
    await db
      .collection('audit_logs')
      .doc(yyyymm)
      .collection('events')
      .doc(eventId)
      .set(doc);
  } catch (err) {
    functions.logger.error('[audit] write failed', {
      type,
      uid,
      eventId,
      message: err.message,
    });
    throw new functions.https.HttpsError('internal', '審計寫入失敗');
  }

  return { eventId };
});

// ==========================================
// Sprint 15 W1 — Versioned catalog backfill (Task B4)
// ==========================================
//
// 把 Sprint 13 灌入的 catalog (insurance_products/{id}) 升級到 versioned 結構：
//   insurance_products/{id}                       ← 加 activeVersion='v1' / totalVersions=1
//   insurance_products/{id}/versions/v1           ← 新建 subcollection doc，複製 spec 進去
//   users/{uid}/insurancePolicies/{pid}           ← 加 catalogProductVersion='v1' (Phase 2 callable)
//
// 鐵則：
//   - epoch ms 在 callback 內取 (runtime ts)；FieldValue.serverTimestamp() 對齊 Firestore 時鐘
//   - idempotent — 已有 activeVersion 的 doc 直接 skip，重跑安全
//   - dry-run default — 預設不寫 Firestore、只回 stats
//   - admin only — verifyAdminAccess(context) gate
//   - 寫 backfill_progress/{runId} 讓 admin UI 拉進度條
//   - 不對顧客端暴露：backfill_progress 在 firestore.rules 內 read=isAdmin / write=false
//   - source 永遠 'tii' (Sprint 13 closed union)
//
// 為什麼分兩個 callable：
//   - product 那邊一筆寫 1 個 root doc + 1 個 subcoll doc，540 秒 1GB 才夠跑全 catalog
//   - policy 那邊掃 collectionGroup('insurancePolicies') / 客戶 PII 路徑、流程獨立
//   - 切兩個就能個別重跑、個別 dry-run、failure 不會互相 block
//
// 與 schema_v2 對齊（Sprint 15 spec）：
//   versions/v1: {
//     effectiveFrom: existing.effectiveDate,   // 法定生效日 (TII)
//     effectiveTo: null,                       // 還在售 → null
//     status: 'active',
//     pdfStoragePath: 'insurance-conditions/{id}/v1.pdf',  // placeholder (W2 才上傳)
//     pdfSha256: existing.pdfSha256 || null,
//     ...spec fields,
//     catalogProcessedAt: <callback runtime ts>,
//     schemaVersion: 1
//   }

// ---- 共用：寫 backfill_progress（每 BACKFILL_PROGRESS_EVERY 筆寫一次，省 Firestore 額度）
const BACKFILL_PROGRESS_EVERY = 100;
const BACKFILL_DEFAULT_LIMIT = 1000;
const BACKFILL_MAX_LIMIT = 5000;

async function writeBackfillProgress(runId, payload) {
  try {
    await db.collection('backfill_progress').doc(runId).set(
      {
        ...payload,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    // progress 寫失敗不該影響主流程
    functions.logger.warn('[backfill] progress write failed', {
      runId,
      message: err.message,
    });
  }
}

/**
 * backfillProductVersions — 把 insurance_products/{id} 升級到 versioned 結構
 *
 * Input data:
 *   - dryRun: boolean (default true) — 只統計、不寫 Firestore
 *   - limit: number (default 1000, max 5000) — 本次最多處理幾筆
 *   - resumeFrom: string|null — 從某 doc id (字典序) 開始續傳
 *
 * Output:
 *   { runId, processed, migrated, skipped, error, dryRun, lastDocId }
 */
exports.backfillProductVersions = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    await verifyAdminAccess(context);

    const dryRun = data?.dryRun !== false; // default true
    const limitRaw = Number(data?.limit) || BACKFILL_DEFAULT_LIMIT;
    const limit = Math.max(1, Math.min(BACKFILL_MAX_LIMIT, limitRaw));
    const resumeFrom =
      typeof data?.resumeFrom === 'string' && data.resumeFrom.length > 0
        ? data.resumeFrom
        : null;

    // runtime ts 在 callback 內取 (對齊 logAuditEvent / Sprint 12 codec convention)
    const callbackStartedAtMs = Date.now();
    const runId = `product_${callbackStartedAtMs}_${crypto.randomBytes(4).toString('hex')}`;

    let processed = 0;
    let migrated = 0;
    let skipped = 0;
    let errorCount = 0;
    let lastDocId = null;
    const errorSamples = []; // 只留前 5 筆 error 給 admin UI debug

    await writeBackfillProgress(runId, {
      runId,
      kind: 'product',
      status: 'running',
      dryRun,
      limit,
      resumeFrom,
      processed: 0,
      migrated: 0,
      skipped: 0,
      errorCount: 0,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      startedAtMs: callbackStartedAtMs,
      startedBy: context.auth.uid,
    });

    try {
      let query = db.collection('insurance_products').orderBy(admin.firestore.FieldPath.documentId());
      if (resumeFrom) {
        // startAfter by doc id — 用 documentId() ordering
        query = query.startAfter(resumeFrom);
      }
      query = query.limit(limit);

      const snap = await query.get();

      for (const docSnap of snap.docs) {
        processed += 1;
        lastDocId = docSnap.id;
        const productId = docSnap.id;
        const existing = docSnap.data() || {};

        try {
          // Idempotency：已有 activeVersion → skip
          if (existing.activeVersion) {
            skipped += 1;
            continue;
          }

          // 每筆 set 都用 callback-runtime ts；要 Firestore-server-aligned 用 FieldValue
          const nowTsServer = admin.firestore.FieldValue.serverTimestamp();

          // firstSeenAt 偏好 existing.createdAt / existing.crawledAt（Sprint 13 ingest 寫的）
          const firstSeenAt =
            existing.createdAt || existing.crawledAt || nowTsServer;

          // 組 versions/v1 subcollection doc — 只搬白名單欄位 + 加 lifecycle fields
          const versionDoc = {
            // Lifecycle fields (Sprint 15 spec)
            effectiveFrom: existing.effectiveDate || null,
            effectiveTo: null,
            status: 'active',
            // PDF placeholder (W2 才真上傳；現在先放 path schema)
            pdfStoragePath: `insurance-conditions/${productId}/v1.pdf`,
            pdfSha256: existing.pdfSha256 || null,
            // Spec snapshot — 從 root doc 複製 spec 欄位進來，做為 v1 baseline
            id: productId,
            company: existing.company || null,
            companySlug: existing.companySlug || null,
            productName: existing.productName || null,
            productCode: existing.productCode || null,
            categoryMain: existing.categoryMain || null,
            categorySub: existing.categorySub || null,
            effectiveDate: existing.effectiveDate || null,
            source: existing.source || 'tii', // 鐵則：永遠 'tii'
            sourceUrl: existing.sourceUrl || null,
            // Audit
            catalogProcessedAt: nowTsServer,
            schemaVersion: 1,
          };

          // Root doc 升級欄位
          const rootUpdate = {
            activeVersion: 'v1',
            totalVersions: 1,
            firstSeenAt,
            lastModifiedAt: nowTsServer,
          };

          if (dryRun) {
            // dry-run 模式：只算數、不寫 Firestore
            migrated += 1;
            if (processed <= 5) {
              functions.logger.info('[backfill][dry-run] product would migrate', {
                runId,
                productId,
                rootUpdate: { ...rootUpdate, lastModifiedAt: '[serverTs]', firstSeenAt: typeof firstSeenAt === 'object' ? '[ts]' : firstSeenAt },
                versionPdfPath: versionDoc.pdfStoragePath,
              });
            }
          } else {
            // commit 模式：root + subcollection 兩個寫入用同一個 batch (atomic)
            const batch = db.batch();
            const versionRef = db
              .collection('insurance_products')
              .doc(productId)
              .collection('versions')
              .doc('v1');
            batch.set(versionRef, versionDoc, { merge: false });
            batch.update(docSnap.ref, rootUpdate);
            await batch.commit();
            migrated += 1;
          }
        } catch (perDocErr) {
          errorCount += 1;
          if (errorSamples.length < 5) {
            errorSamples.push({
              docId: productId,
              message: String(perDocErr?.message || perDocErr).slice(0, 200),
            });
          }
          functions.logger.error('[backfill] product per-doc failed', {
            runId,
            productId,
            message: perDocErr?.message,
          });
          // 不 throw — 整批繼續，這筆會被 skip 不計入 migrated
        }

        // 每 N 筆寫一次 progress
        if (processed % BACKFILL_PROGRESS_EVERY === 0) {
          await writeBackfillProgress(runId, {
            processed,
            migrated,
            skipped,
            errorCount,
            lastDocId,
          });
        }
      }

      const done = snap.size < limit; // 拿不到 limit 筆 → 已經到尾
      await writeBackfillProgress(runId, {
        processed,
        migrated,
        skipped,
        errorCount,
        lastDocId,
        errorSamples,
        status: done ? 'completed' : 'partial',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAtMs: Date.now(),
      });

      return {
        runId,
        processed,
        migrated,
        skipped,
        errorCount,
        lastDocId,
        dryRun,
        done,
        errorSamples,
      };
    } catch (err) {
      functions.logger.error('[backfill] product run failed', {
        runId,
        message: err?.message,
      });
      await writeBackfillProgress(runId, {
        processed,
        migrated,
        skipped,
        errorCount,
        lastDocId,
        status: 'failed',
        error: String(err?.message || err).slice(0, 500),
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw new functions.https.HttpsError(
        'internal',
        `backfillProductVersions 失敗: ${err?.message || err}`
      );
    }
  });

/**
 * backfillClientPolicyVersions — 把 users/{uid}/insurancePolicies/{pid} 加 catalogProductVersion='v1'
 *
 * 客戶 PII 路徑下的 subcollection — 用 collectionGroup('insurancePolicies') 掃過。
 * 只動「已 link 到 catalogProductId、但還沒標 catalogProductVersion」的 doc。
 * 沒 link catalog 的 (advisor 手填) 跳過 — 它們本來就 floating。
 *
 * Input data:
 *   - dryRun: boolean (default true)
 *   - limit: number (default 1000, max 5000)
 *   - resumeFrom: string|null — 上次最後 doc path（含 users/.../insurancePolicies/...）
 *
 * Output:
 *   { runId, processed, migrated, skipped, errorCount, lastDocPath, dryRun, done }
 */
exports.backfillClientPolicyVersions = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    await verifyAdminAccess(context);

    const dryRun = data?.dryRun !== false;
    const limitRaw = Number(data?.limit) || BACKFILL_DEFAULT_LIMIT;
    const limit = Math.max(1, Math.min(BACKFILL_MAX_LIMIT, limitRaw));
    const resumeFrom =
      typeof data?.resumeFrom === 'string' && data.resumeFrom.length > 0
        ? data.resumeFrom
        : null;

    const callbackStartedAtMs = Date.now();
    const runId = `policy_${callbackStartedAtMs}_${crypto.randomBytes(4).toString('hex')}`;

    let processed = 0;
    let migrated = 0;
    let skipped = 0;
    let errorCount = 0;
    let lastDocPath = null;
    const errorSamples = [];

    await writeBackfillProgress(runId, {
      runId,
      kind: 'policy',
      status: 'running',
      dryRun,
      limit,
      resumeFrom,
      processed: 0,
      migrated: 0,
      skipped: 0,
      errorCount: 0,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      startedAtMs: callbackStartedAtMs,
      startedBy: context.auth.uid,
    });

    try {
      // collectionGroup 掃所有 users/*/insurancePolicies/*
      // 排序用 __name__（doc 路徑），可以 startAfter 字串路徑做續傳
      let query = db
        .collectionGroup('insurancePolicies')
        .orderBy(admin.firestore.FieldPath.documentId());
      if (resumeFrom) {
        query = query.startAfter(resumeFrom);
      }
      query = query.limit(limit);

      const snap = await query.get();

      for (const docSnap of snap.docs) {
        processed += 1;
        lastDocPath = docSnap.ref.path;
        const existing = docSnap.data() || {};

        try {
          // 三個 skip 條件：
          //   1. 沒有 link catalog（advisor 手填、跟 versioned schema 無關）
          //   2. 已經有 catalogProductVersion（idempotent skip）
          if (!existing.catalogProductId) {
            skipped += 1;
            continue;
          }
          if (existing.catalogProductVersion) {
            skipped += 1;
            continue;
          }

          if (dryRun) {
            migrated += 1;
            if (processed <= 5) {
              functions.logger.info('[backfill][dry-run] policy would migrate', {
                runId,
                docPath: lastDocPath,
                catalogProductId: existing.catalogProductId,
              });
            }
          } else {
            await docSnap.ref.update({
              catalogProductVersion: 'v1',
              catalogVersionLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            migrated += 1;
          }
        } catch (perDocErr) {
          errorCount += 1;
          if (errorSamples.length < 5) {
            errorSamples.push({
              docPath: lastDocPath,
              message: String(perDocErr?.message || perDocErr).slice(0, 200),
            });
          }
          functions.logger.error('[backfill] policy per-doc failed', {
            runId,
            docPath: lastDocPath,
            message: perDocErr?.message,
          });
        }

        if (processed % BACKFILL_PROGRESS_EVERY === 0) {
          await writeBackfillProgress(runId, {
            processed,
            migrated,
            skipped,
            errorCount,
            lastDocPath,
          });
        }
      }

      const done = snap.size < limit;
      await writeBackfillProgress(runId, {
        processed,
        migrated,
        skipped,
        errorCount,
        lastDocPath,
        errorSamples,
        status: done ? 'completed' : 'partial',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAtMs: Date.now(),
      });

      return {
        runId,
        processed,
        migrated,
        skipped,
        errorCount,
        lastDocPath,
        dryRun,
        done,
        errorSamples,
      };
    } catch (err) {
      functions.logger.error('[backfill] policy run failed', {
        runId,
        message: err?.message,
      });
      await writeBackfillProgress(runId, {
        processed,
        migrated,
        skipped,
        errorCount,
        lastDocPath,
        status: 'failed',
        error: String(err?.message || err).slice(0, 500),
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw new functions.https.HttpsError(
        'internal',
        `backfillClientPolicyVersions 失敗: ${err?.message || err}`
      );
    }
  });

// ==========================================
// Sprint 15 W2 — composeConditionDiffSummary (Task B2)
// ==========================================
//
// 給 admin review queue 用：拿同一個 product 的舊版 + 新版 chunks，
// 丟 Gemini 2.5 Pro 寫一份「顧問能讀懂的」自然語言 diff 摘要。
// 後續 notifyConditionRevision (B1) 會把這份摘要嵌進通知 email / LINE。
//
// 鐵則 (per Sprint 15 W2 戰略邊界 + 任務 B2 spec):
//   - 不引入新 dep — reuse @google/generative-ai (functions/package.json 既有)
//   - Gemini key 從 functions.config().gemini.api_key (既有 pattern)
//   - 所有「現在時間」必須 callback 內取 — 不在 module top-level 算 wall clock
//   - 答案結尾必加 disclaimer「AI 解讀僅供參考、實際以正式條款為準」
//     (LLM 自加 by prompt + 後處理 force-append 雙保險)
//   - 不模擬法律建議、不給保險規劃建議 (prompt enforce)
//   - 對外 source 永遠 'tii'
//   - 寫 audit log type: 'compose_diff_summary' (Sprint 12 logAuditEvent doc shape)
//
// Fallback:
//   - chunks 全標 productVersion='v1' / 沒分版 → 回 fallback summary (待 W3 PDF 抽取)
//   - chunks 任一邊 < 5 筆 → fallback (語料不足、強行 LLM 會幻覺)
//   - Gemini 503/429 → retry 1x，仍失敗 → fallback (severity='medium', 條款已修訂、請手動比對)
//   - JSON parse 失敗 → fallback + audit log result='parse_failed'
//
// 成本估算：一次 compose ≈ $0.005 (Gemini 2.5 Pro, ~3K in + ~800 out)；
// 每月 ~20 次 revisions ≈ $0.10/月，與 spec 對齊。

const DIFF_DEFAULT_MAX_CHUNKS = 20;
const DIFF_MIN_CHUNKS = 5;                  // 任一邊 < 此值 → fallback
const DIFF_MAX_MAX_CHUNKS = 40;             // input cap 防 admin 灌爆 prompt
const DIFF_CHUNK_TEXT_TRIM = 600;           // 每 chunk text 最多塞 600 字進 prompt (省 token)
const DIFF_LLM_RETRY_DELAY_MS = 1500;
const DIFF_DISCLAIMER = 'AI 解讀僅供參考、實際以正式條款為準';
const DIFF_VALID_CATEGORIES = new Set([
  '給付範圍',
  '等待期',
  '除外責任',
  '金額限額',
  '其他',
]);
const DIFF_VALID_IMPACT = new Set(['high', 'medium', 'low']);

const DIFF_PROMPT_TEMPLATE = `你是 Ultra Advisor 保險條款分析助手。請比較以下舊版與新版條款內容、列出 3-5 個重點變動。

規則:
1. 用顧問能理解的話 (避免法律術語)
2. 每個變動標 category (給付範圍 / 等待期 / 除外責任 / 金額限額 / 其他)
3. 評估每個變動的 impact (high / medium / low)
4. 不模擬法律建議、不給保險規劃建議
5. 不確定時必說「我不確定、請查條款原文」
6. 結尾必須附上免責聲明:「${DIFF_DISCLAIMER}」

【舊版條款片段】
{old_chunks}

【新版條款片段】
{new_chunks}

請輸出 JSON (純 JSON、不要 markdown code block)：
{
  "summary": "100-200 字總結",
  "importantChanges": [
    {
      "category": "給付範圍|等待期|除外責任|金額限額|其他",
      "change": "具體變動描述",
      "impact": "high|medium|low"
    }
  ],
  "severity": "high|medium|low"
}`;

/** Compact a single chunk doc into prompt-friendly text. */
function _diffFormatChunkForPrompt(chunkDoc) {
  const text = String(chunkDoc.text || '').slice(0, DIFF_CHUNK_TEXT_TRIM);
  const article = chunkDoc.articleNo ? `第${chunkDoc.articleNo}條` : '';
  const item = chunkDoc.itemNo ? `第${chunkDoc.itemNo}項` : '';
  const section = chunkDoc.sectionHeader || '';
  const header = [section, article, item].filter(Boolean).join(' ');
  return header ? `【${header}】\n${text}` : text;
}

/** Build a {prompt_old, prompt_new} pair from two chunk arrays. */
function _diffBuildPromptChunks(oldChunks, newChunks) {
  const fmt = (arr) =>
    arr.map(_diffFormatChunkForPrompt).join('\n---\n');
  return {
    oldText: fmt(oldChunks),
    newText: fmt(newChunks),
  };
}

/** Fetch up to `limit` chunks for a (productId, version). Falls back to root
 *  chunks subcollection when no version subcoll exists yet (Sprint 14 default
 *  state — every chunk is implicitly v1, see upload-chunks-to-firestore.cjs). */
async function _diffFetchChunks(productId, version, limit) {
  // Preferred path: insurance_products/{id}/versions/{vN}/chunks
  // (Sprint 15 W3 will start writing here once monthly PDF re-extract lands.)
  const versionedRef = db
    .collection('insurance_products')
    .doc(productId)
    .collection('versions')
    .doc(version)
    .collection('chunks');
  const versionedSnap = await versionedRef.limit(limit).get();
  if (versionedSnap.size > 0) {
    return {
      chunks: versionedSnap.docs.map((d) => d.data() || {}),
      sourcePath: `insurance_products/${productId}/versions/${version}/chunks`,
      versionedLayout: true,
    };
  }

  // Fallback path: insurance_products/{id}/chunks (Sprint 14 flat layout).
  // Filter by productVersion field if present, else accept all (v1-default).
  const flatRef = db
    .collection('insurance_products')
    .doc(productId)
    .collection('chunks');

  // We can't combine "field == X OR field missing" in a single Firestore query,
  // so do a versioned read first; if empty, fall through to "all chunks".
  let flatSnap = await flatRef
    .where('productVersion', '==', version)
    .limit(limit)
    .get();

  let chunks = flatSnap.docs.map((d) => d.data() || {});
  if (chunks.length === 0) {
    flatSnap = await flatRef.limit(limit).get();
    chunks = flatSnap.docs.map((d) => d.data() || {});
  }

  return {
    chunks,
    sourcePath: `insurance_products/${productId}/chunks`,
    versionedLayout: false,
  };
}

/** Best-effort extract JSON object from a Gemini text response. */
function _diffExtractJson(responseText) {
  if (typeof responseText !== 'string') return null;
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = codeBlockMatch
    ? codeBlockMatch[1].trim()
    : (responseText.match(/\{[\s\S]*\}/) || [null])[0];
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch (_err) {
    return null;
  }
}

/** Normalise + validate a raw LLM JSON response into the contract shape. */
function _diffNormaliseResponse(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const summary =
    typeof raw.summary === 'string' && raw.summary.trim().length > 0
      ? raw.summary.trim().slice(0, 600)
      : null;
  if (!summary) return null;

  const changesIn = Array.isArray(raw.importantChanges) ? raw.importantChanges : [];
  const importantChanges = changesIn
    .slice(0, 8) // hard cap, prompt asks for 3-5
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const category = DIFF_VALID_CATEGORIES.has(c.category) ? c.category : '其他';
      const change =
        typeof c.change === 'string' && c.change.trim().length > 0
          ? c.change.trim().slice(0, 300)
          : null;
      const impact = DIFF_VALID_IMPACT.has(c.impact) ? c.impact : 'medium';
      if (!change) return null;
      return { category, change, impact };
    })
    .filter(Boolean);

  const severity = DIFF_VALID_IMPACT.has(raw.severity) ? raw.severity : 'medium';

  return { summary, importantChanges, severity };
}

/** Build a fallback response when LLM can't / shouldn't be called. */
function _diffFallback(reason, oldVersion, newVersion) {
  const summaryByReason = {
    no_version_layout: `${oldVersion} → ${newVersion} 升級、實際 diff 待 Sprint 15 W3 PDF 抽取`,
    insufficient_chunks: '條款語料不足、無法產生 AI 摘要、請手動比對 PDF',
    llm_failed: '條款已修訂、請手動比對',
    parse_failed: 'AI 回應格式無法解析、請手動比對條款',
  };
  return {
    summary: summaryByReason[reason] || '條款已修訂、請手動比對',
    importantChanges: [],
    severity: 'medium',
    fallback: true,
    fallbackReason: reason,
  };
}

/** Write a compose_diff_summary audit log doc (best-effort, never throws). */
async function _diffWriteAudit(uid, payload) {
  try {
    const nowMs = Date.now();
    const nowDate = new Date(nowMs);
    const yyyymm =
      nowDate.getUTCFullYear().toString() +
      String(nowDate.getUTCMonth() + 1).padStart(2, '0');
    const rand = crypto.randomBytes(4).toString('hex');
    const eventId = `compose_diff_summary_${nowMs}_${uid}_${rand}`;
    await db
      .collection('audit_logs')
      .doc(yyyymm)
      .collection('events')
      .doc(eventId)
      .set({
        type: 'compose_diff_summary',
        advisorUid: uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        timestampMs: nowMs,
        context: payload.context || {},
        result: payload.result || 'success',
        schemaVersion: 1,
      });
  } catch (err) {
    functions.logger.warn('[compose_diff_summary] audit write failed', {
      message: err?.message,
    });
  }
}

/** Sleep helper used between LLM retries. */
function _diffSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

exports.composeConditionDiffSummary = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data, context) => {
    // --- Auth + admin gate ---
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }
    const isUserAdmin = await isAdmin(context.auth.uid);
    if (!isUserAdmin) {
      throw new functions.https.HttpsError('permission-denied', '無管理員權限');
    }
    const uid = context.auth.uid;

    // --- Input validation ---
    const productId =
      typeof data?.productId === 'string' ? data.productId.trim() : '';
    const oldVersion =
      typeof data?.oldVersion === 'string' ? data.oldVersion.trim() : '';
    const newVersion =
      typeof data?.newVersion === 'string' ? data.newVersion.trim() : '';

    if (!productId || !/^[A-Za-z0-9_-]{1,80}$/.test(productId)) {
      throw new functions.https.HttpsError('invalid-argument', 'productId 格式不符');
    }
    if (!oldVersion || !newVersion) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'oldVersion / newVersion 必填'
      );
    }
    if (oldVersion === newVersion) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'oldVersion 與 newVersion 不可相同'
      );
    }
    const maxChunksRaw = Number(data?.maxChunks) || DIFF_DEFAULT_MAX_CHUNKS;
    const maxChunks = Math.max(
      DIFF_MIN_CHUNKS,
      Math.min(DIFF_MAX_MAX_CHUNKS, maxChunksRaw)
    );

    // runtime ts in callback (HARD rule — never compute wall clock at module top)
    const callbackStartedAtMs = Date.now();

    // --- Step 1: fetch chunks for both versions ---
    let oldFetch;
    let newFetch;
    try {
      [oldFetch, newFetch] = await Promise.all([
        _diffFetchChunks(productId, oldVersion, maxChunks),
        _diffFetchChunks(productId, newVersion, maxChunks),
      ]);
    } catch (err) {
      functions.logger.error('[compose_diff_summary] chunk fetch failed', {
        productId,
        message: err?.message,
      });
      throw new functions.https.HttpsError(
        'internal',
        `chunks 讀取失敗: ${err?.message || err}`
      );
    }

    // Fallback path A: Sprint 14 state — chunks not yet split by version,
    // both sides resolve to identical flat-layout reads → can't actually diff.
    const flatLayout =
      !oldFetch.versionedLayout && !newFetch.versionedLayout;
    if (flatLayout) {
      const fallback = _diffFallback('no_version_layout', oldVersion, newVersion);
      const disclaimers = [DIFF_DISCLAIMER];
      await _diffWriteAudit(uid, {
        context: {
          productId,
          oldVersion,
          newVersion,
          maxChunks,
          fallbackReason: 'no_version_layout',
          oldChunks: oldFetch.chunks.length,
          newChunks: newFetch.chunks.length,
          callbackStartedAtMs,
        },
        result: 'fallback',
      });
      return {
        summary: fallback.summary,
        importantChanges: fallback.importantChanges,
        severity: fallback.severity,
        disclaimers,
        tokensUsed: 0,
        fallback: true,
        fallbackReason: fallback.fallbackReason,
        source: 'tii', // 對外宣稱資料來源永遠 tii
      };
    }

    // Fallback path B: too few chunks to make LLM diff trustworthy
    if (
      oldFetch.chunks.length < DIFF_MIN_CHUNKS ||
      newFetch.chunks.length < DIFF_MIN_CHUNKS
    ) {
      const fallback = _diffFallback(
        'insufficient_chunks',
        oldVersion,
        newVersion
      );
      const disclaimers = [DIFF_DISCLAIMER];
      await _diffWriteAudit(uid, {
        context: {
          productId,
          oldVersion,
          newVersion,
          maxChunks,
          fallbackReason: 'insufficient_chunks',
          oldChunks: oldFetch.chunks.length,
          newChunks: newFetch.chunks.length,
          callbackStartedAtMs,
        },
        result: 'fallback',
      });
      return {
        summary: fallback.summary,
        importantChanges: fallback.importantChanges,
        severity: fallback.severity,
        disclaimers,
        tokensUsed: 0,
        fallback: true,
        fallbackReason: fallback.fallbackReason,
        source: 'tii',
      };
    }

    // --- Step 2: build prompt + call Gemini 2.5 Pro w/ 1 retry ---
    const { oldText, newText } = _diffBuildPromptChunks(
      oldFetch.chunks,
      newFetch.chunks
    );
    const prompt = DIFF_PROMPT_TEMPLATE
      .replace('{old_chunks}', oldText)
      .replace('{new_chunks}', newText);

    const geminiApiKey = functions.config().gemini?.api_key;
    if (!geminiApiKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Gemini API key 未設定'
      );
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    let responseText = null;
    let tokensUsed = 0;
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        const usage = result.response?.usageMetadata || {};
        tokensUsed =
          Number(usage.totalTokenCount) ||
          Number(usage.candidatesTokenCount || 0) +
            Number(usage.promptTokenCount || 0) ||
          0;
        break;
      } catch (err) {
        lastErr = err;
        const status = err?.status || err?.code;
        const retriable = status === 503 || status === 429 || status === 500;
        functions.logger.warn('[compose_diff_summary] gemini call failed', {
          attempt,
          status,
          retriable,
          message: err?.message,
        });
        if (!retriable || attempt === 2) break;
        await _diffSleep(DIFF_LLM_RETRY_DELAY_MS);
      }
    }

    // LLM hard fail → fallback
    if (responseText === null) {
      const fallback = _diffFallback('llm_failed', oldVersion, newVersion);
      await _diffWriteAudit(uid, {
        context: {
          productId,
          oldVersion,
          newVersion,
          maxChunks,
          fallbackReason: 'llm_failed',
          llmError: String(lastErr?.message || lastErr || '').slice(0, 300),
          callbackStartedAtMs,
        },
        result: 'llm_failed',
      });
      return {
        summary: fallback.summary,
        importantChanges: fallback.importantChanges,
        severity: fallback.severity,
        disclaimers: [DIFF_DISCLAIMER],
        tokensUsed: 0,
        fallback: true,
        fallbackReason: fallback.fallbackReason,
        source: 'tii',
      };
    }

    // --- Step 3: parse + normalise ---
    const rawJson = _diffExtractJson(responseText);
    const normalised = _diffNormaliseResponse(rawJson);
    if (!normalised) {
      const fallback = _diffFallback('parse_failed', oldVersion, newVersion);
      await _diffWriteAudit(uid, {
        context: {
          productId,
          oldVersion,
          newVersion,
          maxChunks,
          fallbackReason: 'parse_failed',
          responsePreview: String(responseText).slice(0, 200),
          callbackStartedAtMs,
        },
        result: 'parse_failed',
      });
      return {
        summary: fallback.summary,
        importantChanges: fallback.importantChanges,
        severity: fallback.severity,
        disclaimers: [DIFF_DISCLAIMER],
        tokensUsed,
        fallback: true,
        fallbackReason: fallback.fallbackReason,
        source: 'tii',
      };
    }

    // --- Step 4: force-append disclaimer if LLM忘了 ---
    let finalSummary = normalised.summary;
    if (!finalSummary.includes(DIFF_DISCLAIMER)) {
      finalSummary = `${finalSummary}\n\n${DIFF_DISCLAIMER}`;
    }

    // --- Step 5: audit + return ---
    await _diffWriteAudit(uid, {
      context: {
        productId,
        oldVersion,
        newVersion,
        maxChunks,
        oldChunks: oldFetch.chunks.length,
        newChunks: newFetch.chunks.length,
        tokensUsed,
        severity: normalised.severity,
        changeCount: normalised.importantChanges.length,
        callbackStartedAtMs,
      },
      result: 'success',
    });

    return {
      summary: finalSummary,
      importantChanges: normalised.importantChanges,
      severity: normalised.severity,
      disclaimers: [DIFF_DISCLAIMER],
      tokensUsed,
      fallback: false,
      source: 'tii', // 對外宣稱資料來源永遠 tii
    };
  });

// ==========================================
// Sprint 15 W2 — Task B1: notifyConditionRevision callable
// ==========================================
//
// 觸發點：admin/InsuranceReviewQueue.tsx 把「approve revision」按鈕接到本 callable
// (Sprint 15 W1 留 console.log、W2 改實際呼叫；本 callable 即 B1)。
//
// 行為：把 (productId, oldVersion → newVersion) 修訂、扇出成 per-advisor 通知 doc，
// 寫進 advisors/{advisorUid}/conditionAlerts/{alertId}。顧問開
// /dashboard/condition-alerts (Task B4) 就能看到「我有 N 個客戶受影響」。
//
// 為什麼這 callable 不直接寄信 / 發 LINE：
//   - email / LINE 在 W3 接（需設 LINE Channel access token），W2 只做 Firestore
//     扇出 — 顧問端 dashboard 是真實使用者介面、寫進去就有用
//   - 解耦：寄信走 cron 掃 conditionAlerts 中 sentEmailAt=null 的 doc、可單獨 retry
//
// 與 B2 (composeConditionDiffSummary) 的關係：
//   - 正常流程：admin UI 先點「預覽 AI 摘要」call B2 → 拿回 summary/importantChanges
//     /severity → 再點「approve & notify」call B1 並把這三個帶進去
//   - 若 admin 跳過預覽、本 callable 自動生 fallback 摘要（與 B2 fallback 同基調）；
//     不在 callback 內 inline 跑 Gemini — 走 LLM 路徑請先 call B2
//
// 鐵則（嚴守 Sprint 15 W2 戰略邊界）：
//   - 所有 wall-clock (Date.now / new Date) 必須 callback 內取
//   - 客戶 PII：絕不寫客戶身分證 / 電話 / 完整生日；姓名以 maskClientName 遮蔽
//     後寫入 alert doc。顧問點客戶詳細才看到全名（讀的是
//     users/{advisorUid}/clients/{clientId} 既有 user-scoped path、不重複寫一份）
//   - 顧問跨界：每 advisor 只看到自己 affected clients；寫入路徑
//     advisors/{advisorUid}/... 嚴守；跨 advisor 由 firestore.rules (Task B8) 守門
//   - source 永遠 'tii' (Sprint 13 closed union)
//   - LLM 摘要必標 'AI 解讀僅供參考、以正式條款為準'（disclaimer 在 alert doc 內
//     寫死；客戶端 src/lib/conditionAlerts.ts DIFF_AI_DISCLAIMER 再 enforce 一次）
//   - alert doc 形狀必須與 src/lib/conditionAlerts.ts `ConditionAlert` 對齊：
//       productId / productName / companyName / oldVersion / newVersion /
//       diffSummary / importantChanges[] / severity / affectedClients[] /
//       createdAt (epoch ms) / status / reviewQueueId
//     多打欄位無妨 (parser ignores)；少必欄會被 fromDoc() drop 不顯示。
//   - clientNameMasked 演算法必須與 src/lib/conditionAlerts.ts maskName() 完全一致
//     (parser 端 defensive re-mask、不一致只是浪費、不會洩 PII)

/** Mask a client name to display-safe form for the alert payload.
 *
 *  演算法必須與 src/lib/conditionAlerts.ts maskName() 完全一致：
 *    - 1 字以下：原樣回傳
 *    - 2 字：王明 → 王O
 *    - 3 字：王小明 → 王O明
 *    - 4+ 字：王世明傑 → 王OO傑 (首尾留、中間全 O)
 *  輸入為空 / 非字串 → '—'
 */
function maskClientName(fullName) {
  if (typeof fullName !== 'string') return '—';
  const s = fullName.trim();
  if (!s) return '—';
  if (s.length <= 1) return s;
  if (s.length === 2) return `${s[0]}O`;
  if (s.length === 3) return `${s[0]}O${s[2]}`;
  const first = s[0];
  const last = s[s.length - 1];
  const middle = 'O'.repeat(Math.max(1, s.length - 2));
  return `${first}${middle}${last}`;
}

/** Resolve the advisorUid that owns a given clientUid.
 *
 *  本 SaaS 目前 schema：每個 user = 顧問本人，客戶存在
 *  users/{advisorUid}/clients/{clientId}（顧問擁有客戶、非客戶獨立帳號）。
 *
 *  本 callable 走 collectionGroup 掃 policy 時、直接從 ref.path 取 parent uid
 *  即可，正常不會用到本 helper。本 helper 留作 future-proof：若 caller 有
 *  raw clientUid（沒帶 policy 路徑、e.g. 從 B3 email composer 反查），就用
 *  本 helper 從 users/{clientUid}.advisorUid 解析。
 *
 *  Returns null if mapping not found — 上游 caller 自己決定 fallback。
 */
async function getAdvisorUidForClient(clientUid) {
  if (!clientUid || typeof clientUid !== 'string') return null;
  try {
    const snap = await db.collection('users').doc(clientUid).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    if (typeof data.advisorUid === 'string' && data.advisorUid) {
      return data.advisorUid;
    }
    return null;
  } catch (err) {
    functions.logger.warn('[notifyConditionRevision] getAdvisorUidForClient failed', {
      clientUid,
      message: err?.message,
    });
    return null;
  }
}

/** Σ coverages[].sumInsured for headline display.
 *  Policy schema (src/types/insurance.ts) 沒有 top-level sumAssured —
 *  保額在 coverage level。本 helper 加總、給顧問 dashboard 顯示用。
 *  Missing / NaN → 0；UI 用 formatSumAssured 把 0 顯示成 '—'。
 */
function computePolicySumAssured(policyData) {
  if (!policyData || typeof policyData !== 'object') return 0;
  const coverages = Array.isArray(policyData.coverages) ? policyData.coverages : [];
  let total = 0;
  for (const cov of coverages) {
    if (!cov || typeof cov !== 'object') continue;
    const n = Number(cov.sumInsured);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return Math.round(total);
}

/** Fallback diff summary when admin didn't pre-call B2.
 *  Same tone as B2's `_diffFallback('llm_failed', ...)` — keep voice consistent。
 *  必含 disclaimer 字串以對齊 src/lib/conditionAlerts.ts DIFF_AI_DISCLAIMER。
 */
function _notifyFallbackDiffSummary(oldVersion, newVersion) {
  return (
    `${oldVersion} → ${newVersion} 條款已修訂、請手動比對 PDF 條款全文。` +
    'AI 解讀僅供參考、以正式條款為準。'
  );
}

/** Read a client's display name from users/{advisorUid}/clients/{clientId}.
 *
 *  只讀 .name 欄位 — phone / birthday / id_number 等 PII 留在 client doc 內、
 *  絕不進入 alert payload (PII guardrail)。
 *
 *  Returns null if missing/error → caller falls back to policy.insured。
 */
async function _notifyReadClientDisplayName(advisorUid, clientId) {
  if (!advisorUid || !clientId) return null;
  try {
    const snap = await db
      .collection('users')
      .doc(advisorUid)
      .collection('clients')
      .doc(clientId)
      .get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    if (typeof data.name === 'string' && data.name.trim()) {
      return data.name.trim();
    }
    return null;
  } catch (err) {
    functions.logger.warn('[notifyConditionRevision] readClientDisplayName failed', {
      advisorUid,
      clientId,
      message: err?.message,
    });
    return null;
  }
}

/** Chunk an array into groups of size n (preserving order). */
function _notifyChunkArray(arr, n) {
  if (!Array.isArray(arr) || n <= 0) return [];
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const COND_NOTIFY_MAX_AFFECTED = 50_000;            // 安全上限：單次扇出最多 5 萬 policy
const COND_NOTIFY_CLIENTS_PER_ALERT_DOC = 50;       // 單 alert doc 最多 50 client (Firestore 1MB / UI 可讀)
const COND_NOTIFY_AUDIT_TYPE = 'condition_revision_notify';
const COND_NOTIFY_IMPORTANT_CHANGES_MAX = 20;       // 上限：單 alert 最多 20 條 bullet
const COND_NOTIFY_DIFF_SUMMARY_MAX = 2000;          // diffSummary 字數上限 (Firestore 安全)

/**
 * notifyConditionRevision — 條款修訂通知 fanout。
 *
 * Input:
 *   {
 *     productId: string,                                 // catalog product id
 *     oldVersion: string,                                // e.g. 'v2'  (regex /^v\d+$/)
 *     newVersion: string,                                // e.g. 'v3'  (regex /^v\d+$/、!= oldVersion)
 *     diffSummary?: string,                              // 沒帶 → fallback 摘要 (B2 prior call 為正常流)
 *     importantChanges?: Array<{ category, change, impact: 'high'|'medium'|'low' }>,
 *     severity?: 'high'|'medium'|'low',                  // default 'medium'
 *     reviewQueueId: string,                             // 來自 admin queue、要 reverse-link
 *   }
 *
 * Output:
 *   {
 *     runId,
 *     processed,                  // 掃了幾筆 policy
 *     notifiedAdvisors,           // 寫了幾位顧問
 *     totalAffectedClients,       // 累計多少 client
 *     alertDocsWritten,           // 真寫進 Firestore 的 alert doc 數 (>= notifiedAdvisors)
 *     writeErrors,                // 前 5 筆寫入失敗樣本 (debug)
 *     dryRun: false
 *   }
 */
exports.notifyConditionRevision = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    // --- Auth gate ---
    await verifyAdminAccess(context);

    // --- Input validation ---
    if (!data || typeof data !== 'object') {
      throw new functions.https.HttpsError('invalid-argument', 'data 必須是物件');
    }
    const productId = typeof data.productId === 'string' ? data.productId.trim() : '';
    const oldVersion = typeof data.oldVersion === 'string' ? data.oldVersion.trim() : '';
    const newVersion = typeof data.newVersion === 'string' ? data.newVersion.trim() : '';
    const reviewQueueId =
      typeof data.reviewQueueId === 'string' ? data.reviewQueueId.trim() : '';

    if (!productId) {
      throw new functions.https.HttpsError('invalid-argument', 'productId 必填');
    }
    if (!/^[\w.-]{1,128}$/.test(productId)) {
      throw new functions.https.HttpsError('invalid-argument', 'productId 格式不符');
    }
    if (!oldVersion || !/^v\d+$/.test(oldVersion)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'oldVersion 必填且需為 v<n> 格式',
      );
    }
    if (!newVersion || !/^v\d+$/.test(newVersion)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'newVersion 必填且需為 v<n> 格式',
      );
    }
    if (oldVersion === newVersion) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'oldVersion 與 newVersion 不可相同',
      );
    }
    if (!reviewQueueId || !/^[\w.-]{1,200}$/.test(reviewQueueId)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'reviewQueueId 必填且格式不符',
      );
    }

    const severityRaw = data.severity;
    const severity =
      severityRaw === 'high' || severityRaw === 'medium' || severityRaw === 'low'
        ? severityRaw
        : 'medium';

    // importantChanges sanitize — 只留 impact 三選一、長度上限
    const importantChangesRaw = Array.isArray(data.importantChanges)
      ? data.importantChanges
      : [];
    const importantChanges = [];
    for (const row of importantChangesRaw) {
      if (!row || typeof row !== 'object') continue;
      const impact = row.impact;
      if (impact !== 'high' && impact !== 'medium' && impact !== 'low') continue;
      const category =
        typeof row.category === 'string' ? row.category.slice(0, 64).trim() : '';
      const change =
        typeof row.change === 'string' ? row.change.slice(0, 280).trim() : '';
      if (!category || !change) continue;
      importantChanges.push({ category, change, impact });
      if (importantChanges.length >= COND_NOTIFY_IMPORTANT_CHANGES_MAX) break;
    }

    // --- Runtime timestamps (HARD rule: callback 內取) ---
    const callbackStartedAtMs = Date.now();
    const callbackStartedDate = new Date(callbackStartedAtMs);
    const yyyymm =
      callbackStartedDate.getUTCFullYear().toString() +
      String(callbackStartedDate.getUTCMonth() + 1).padStart(2, '0');
    const runId =
      `notify_${callbackStartedAtMs}_${crypto.randomBytes(4).toString('hex')}`;

    functions.logger.info('[notifyConditionRevision] start', {
      runId,
      productId,
      oldVersion,
      newVersion,
      reviewQueueId,
      adminUid: context.auth.uid,
    });

    // --- Resolve product metadata (company + productName for alert payload) ---
    // 來源永遠 'tii' (Sprint 13 closed union)、本 callable 不重寫 source 欄位、只讀
    let productCompany = '';
    let productNameSnapshot = '';
    try {
      const prodSnap = await db.collection('insurance_products').doc(productId).get();
      if (!prodSnap.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `productId ${productId} 不在 catalog`,
        );
      }
      const prodData = prodSnap.data() || {};
      productCompany =
        typeof prodData.company === 'string' && prodData.company
          ? prodData.company
          : '';
      productNameSnapshot =
        typeof prodData.productName === 'string' && prodData.productName
          ? prodData.productName
          : '';
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      functions.logger.error('[notifyConditionRevision] product read failed', {
        runId,
        productId,
        message: err?.message,
      });
      throw new functions.https.HttpsError(
        'internal',
        `讀取商品資料失敗：${err?.message || err}`,
      );
    }

    // --- Compose diff summary if not provided ---
    // 正常流：admin 先 call B2 (composeConditionDiffSummary)、把 summary 帶進來
    // Fallback：沒帶就用 generic 提示 + disclaimer (不在本 callable inline 跑 Gemini)
    let diffSummary =
      typeof data.diffSummary === 'string' && data.diffSummary.trim()
        ? data.diffSummary.trim().slice(0, COND_NOTIFY_DIFF_SUMMARY_MAX)
        : '';
    let diffSummaryFallback = false;
    if (!diffSummary) {
      diffSummary = _notifyFallbackDiffSummary(oldVersion, newVersion);
      diffSummaryFallback = true;
    }
    // 雙保險：強制附 disclaimer (即便 admin 帶進來的 summary 漏掉)
    if (!diffSummary.includes('AI 解讀僅供參考')) {
      diffSummary = `${diffSummary}\n\nAI 解讀僅供參考、以正式條款為準。`;
    }

    // --- Scan affected policies ---
    // collectionGroup 掃 users/*/insurancePolicies — Sprint 15 W1
    // backfillClientPolicyVersions 已把 v1 標完、所以本查詢能命中。
    let policyDocs = [];
    try {
      const snap = await db
        .collectionGroup('insurancePolicies')
        .where('catalogProductId', '==', productId)
        .where('catalogProductVersion', '==', oldVersion)
        .limit(COND_NOTIFY_MAX_AFFECTED)
        .get();
      policyDocs = snap.docs;
    } catch (err) {
      functions.logger.error('[notifyConditionRevision] policy query failed', {
        runId,
        productId,
        oldVersion,
        message: err?.message,
      });
      throw new functions.https.HttpsError(
        'internal',
        `掃 collectionGroup 失敗（可能缺 composite index：` +
          `catalogProductId + catalogProductVersion）：${err?.message || err}`,
      );
    }

    if (policyDocs.length >= COND_NOTIFY_MAX_AFFECTED) {
      // 撞到安全上限 — 提示 admin 分批；不 throw、繼續處理已抓到的部分
      functions.logger.warn('[notifyConditionRevision] hit safety limit', {
        runId,
        limit: COND_NOTIFY_MAX_AFFECTED,
      });
    }

    // --- Group by advisorUid ---
    // 取得 advisorUid 兩種來源：
    //   (1) policy.advisorUid 欄位 (future schema — policy share 給多顧問)
    //   (2) doc path users/{advisorUid}/insurancePolicies/{pid} parent uid (current schema)
    /** @type {Map<string, Array<{clientId: string|null, policyId: string, sumAssured: number, insuredName: string|null}>>} */
    const advisorBuckets = new Map();
    let processed = 0;

    for (const docSnap of policyDocs) {
      processed += 1;
      const policyData = docSnap.data() || {};
      const policyId = docSnap.id;

      const pathParts = docSnap.ref.path.split('/');
      const advisorUidFromPath =
        pathParts.length >= 4 && pathParts[0] === 'users' ? pathParts[1] : null;
      const advisorUid =
        (typeof policyData.advisorUid === 'string' && policyData.advisorUid) ||
        advisorUidFromPath ||
        null;

      if (!advisorUid) {
        // 孤兒 policy — 跳過、記 log
        functions.logger.warn('[notifyConditionRevision] orphan policy skipped', {
          runId,
          path: docSnap.ref.path,
        });
        continue;
      }

      const clientId =
        typeof policyData.clientId === 'string' && policyData.clientId
          ? policyData.clientId
          : null;
      const sumAssured = computePolicySumAssured(policyData);
      const insuredName =
        typeof policyData.insured === 'string' && policyData.insured
          ? policyData.insured
          : typeof policyData.insuredName === 'string' && policyData.insuredName
            ? policyData.insuredName
            : null;

      if (!advisorBuckets.has(advisorUid)) advisorBuckets.set(advisorUid, []);
      advisorBuckets.get(advisorUid).push({
        clientId,
        policyId,
        sumAssured,
        insuredName,
      });
    }

    // --- Resolve client display names + mask + write alert doc(s) ---
    let notifiedAdvisors = 0;
    let totalAffectedClients = 0;
    let alertDocsWritten = 0;
    const writeErrors = [];

    for (const [advisorUid, affectedList] of advisorBuckets.entries()) {
      // 為這個 advisor 解析每筆 entry 的 displayable masked name
      // clientId 為 null → fallback 用 policy.insured 欄位 (被保險人姓名)
      // 全部 mask、保險起見不洩 PII
      const enriched = [];
      for (const item of affectedList) {
        let displayName = null;
        if (item.clientId) {
          displayName = await _notifyReadClientDisplayName(advisorUid, item.clientId);
        }
        if (!displayName) displayName = item.insuredName || '';
        enriched.push({
          // clientUid 對齊 src/lib/conditionAlerts.ts AffectedClient.clientUid
          // 顧問 UI 用它 deeplink 到客戶詳細
          clientUid: item.clientId || '',
          clientNameMasked: maskClientName(displayName),
          policyId: item.policyId,
          sumAssured: item.sumAssured,
          contactStatus: 'pending',
        });
        totalAffectedClients += 1;
      }

      // 切 50 一 alert doc (Firestore 1MB 限額 / UI 可讀)
      const chunks = _notifyChunkArray(enriched, COND_NOTIFY_CLIENTS_PER_ALERT_DOC);
      const chunkCount = chunks.length;

      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx += 1) {
        const chunkClients = chunks[chunkIdx];
        // alertId = alert_<callbackMs>_<advisorUid>_<productId>[_p<idx>]
        // 跨次 fanout 因 callbackMs 不同而不撞；同次多 chunk 因 _pN suffix 不撞
        const alertId =
          `alert_${callbackStartedAtMs}_${advisorUid}_${productId}` +
          (chunkCount > 1 ? `_p${chunkIdx + 1}` : '');

        const alertDoc = {
          // 必欄 — 對齊 src/lib/conditionAlerts.ts ConditionAlert
          productId,
          productName: productNameSnapshot || productId,
          companyName: productCompany,
          oldVersion,
          newVersion,
          diffSummary,
          importantChanges,
          severity,
          affectedClients: chunkClients,
          createdAt: callbackStartedAtMs,  // epoch ms — parser Number() cast
          status: 'pending',
          reviewQueueId,

          // Meta (parser ignores、留給 admin debug + B3 寄信 cron 用)
          source: 'tii',  // 鐵則：永遠 'tii'
          runId,
          schemaVersion: 1,
          aiDisclaimer: 'AI 解讀僅供參考、以正式條款為準',
          diffSummaryFallback,  // 是否走 B1 fallback 摘要 (admin 跳過 B2 預覽)
          chunkIndex: chunkIdx + 1,
          chunkTotal: chunkCount,
          serverCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
          // B3 寄信 cron query 用：sentEmailAt == null + status == 'pending'
          sentEmailAt: null,
          sentLineAt: null,
        };

        try {
          await db
            .collection('advisors')
            .doc(advisorUid)
            .collection('conditionAlerts')
            .doc(alertId)
            .set(alertDoc, { merge: false });
          alertDocsWritten += 1;
        } catch (err) {
          if (writeErrors.length < 5) {
            writeErrors.push({
              advisorUid,
              alertId,
              message: String(err?.message || err).slice(0, 200),
            });
          }
          functions.logger.error('[notifyConditionRevision] alert write failed', {
            runId,
            advisorUid,
            alertId,
            message: err?.message,
          });
          // 不 throw — 其他 advisor 還能繼續扇出
        }
      }

      notifiedAdvisors += 1;
    }

    // --- Audit log (audit_logs/{yyyymm}/events/{eventId}) ---
    // context 只放 catalog-shape 欄位、不含 PII (no client name / id / phone)
    try {
      const auditEventId =
        `${COND_NOTIFY_AUDIT_TYPE}_${callbackStartedAtMs}_${context.auth.uid}_` +
        crypto.randomBytes(4).toString('hex');
      await db
        .collection('audit_logs')
        .doc(yyyymm)
        .collection('events')
        .doc(auditEventId)
        .set({
          type: COND_NOTIFY_AUDIT_TYPE,
          advisorUid: context.auth.uid,  // 觸發的 admin
          advisorEmail: context.auth.token?.email || null,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          timestampMs: callbackStartedAtMs,
          context: {
            runId,
            productId,
            oldVersion,
            newVersion,
            reviewQueueId,
            processed,
            notifiedAdvisors,
            totalAffectedClients,
            alertDocsWritten,
            writeErrorCount: writeErrors.length,
            severity,
            importantChangesCount: importantChanges.length,
            diffSummaryFallback,
            source: 'tii',
          },
          result: writeErrors.length > 0 ? 'partial' : 'success',
          schemaVersion: 1,
        });
    } catch (err) {
      // audit 失敗不該 fail 整個 fanout — 已扇出 alert 是真實價值
      functions.logger.error('[notifyConditionRevision] audit write failed', {
        runId,
        message: err?.message,
      });
    }

    // --- Update review queue status → 'merged' + counts ---
    // 只 patch 必要欄位 (set merge: true)、避免覆蓋 admin reviewer 寫的
    // decision/reviewedBy/reviewedAt (Task B7 admin UI 改 button 時對齊)
    try {
      await db
        .collection('insurance_review_queue')
        .doc(reviewQueueId)
        .set(
          {
            status: 'merged',
            notifiedAdvisorsCount: notifiedAdvisors,
            notifiedAffectedClientsCount: totalAffectedClients,
            notifiedAlertDocsCount: alertDocsWritten,
            notifiedAtMs: callbackStartedAtMs,
            notifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            notifiedRunId: runId,
          },
          { merge: true },
        );
    } catch (err) {
      // queue 更新失敗 — 已扇出 alert 仍 valid，但 admin 會看 status='pending'
      // 不 throw；admin 可手動 retry status update
      functions.logger.warn('[notifyConditionRevision] review queue update failed', {
        runId,
        reviewQueueId,
        message: err?.message,
      });
    }

    functions.logger.info('[notifyConditionRevision] done', {
      runId,
      processed,
      notifiedAdvisors,
      totalAffectedClients,
      alertDocsWritten,
      writeErrorCount: writeErrors.length,
    });

    return {
      runId,
      processed,
      notifiedAdvisors,
      totalAffectedClients,
      alertDocsWritten,
      writeErrors,
      dryRun: false,
    };
  });

// ==========================================
// Sprint 15 W3 — Task B1: sendConditionRevisionEmail callable
// ==========================================
//
// 角色：把一筆 W2 扇出的 condition_alert (advisors/{advisorUid}/conditionAlerts/{alertId})
// 透過 Resend 寄成 email，並把 sentEmailAt / emailMessageId 寫回 alert doc。
//
// 為何是獨立 callable (而非 W2 fanout 直接寄)：
//   - W2 的 notifyConditionRevision 已是長 timeout (540s)、扇出 1k+ advisor 時不能再
//     卡 SMTP；email 走分開的 cron worker (Task B3) 才能 retry 失敗的單筆而不重跑整批。
//   - admin 也可以 dashboard 點「立即重寄」按鈕觸發本 callable single-shot (參考
//     QuotaExtensionRequests.tsx 同 sprint 設計)。
//
// Idempotent 鐵則：
//   - sentEmailAt 已存在 → return { skipped: true, reason: 'already-sent' }、不寄
//   - 這代表本 callable 可以被 cron worker 安全重跑 N 次而不會重複寄信
//   - 失敗時寫 emailSendError 但不 throw — cron 下次 tick 會挑回 sentEmailAt=null 的
//
// PII 鐵則（Sprint 15 通則）：
//   - email payload 不含客戶姓名 / ID / 電話 — 只放 affectedClientCount (數量)
//   - templates 已 enforce、本 callable 只負責路由 alert.affectedClients.length 進去
//
// 與 W2 alert doc 形狀對齊（不可改、parser 已 freeze）：
//   - alert.productName / oldVersion / newVersion / diffSummary
//   - alert.importantChanges (Array<{category, change, impact}>)
//   - alert.severity ('high' | 'medium' | 'low')
//   - alert.affectedClients (Array — 取 length 即可、不展開姓名)
//   - alert.sentEmailAt (null → ready, Timestamp → already-sent)
//
// dryRun 模式：
//   - data.dryRun === true → render payload 但不 call Resend、不 update sentEmailAt
//   - admin 可以 preview email 內容、再決定要不要正式寄
//
// Resend pattern 對齊既有 Sprint 11 lifecycle email：
//   - process.env.RESEND_API_KEY (Sprint 11 已用、cloud function secret 已綁)
//   - axios.post 'https://api.resend.com/emails' (top-of-file 已 require axios)
//   - 不引入新 npm dep (戰略邊界 HARD)
//   - from: 'Ultra Advisor <noreply@ultra-advisor.tw>' (per spec — 跟 lifecycle 的
//     hello@ultra-advisor.tw 分開 transactional vs marketing reputation)

const SEND_CONDITION_EMAIL_FROM = 'Ultra Advisor <noreply@ultra-advisor.tw>';
const SEND_CONDITION_EMAIL_AUDIT_TYPE = 'condition_alert_email_sent';

/**
 * Look up the advisor's email address from users/{advisorUid}.email.
 * Returns null if doc missing, email missing, or not a string.
 * Caller decides skip vs send based on null.
 */
async function _readAdvisorEmail(advisorUid) {
  try {
    const userSnap = await db.collection('users').doc(advisorUid).get();
    if (!userSnap.exists) return { email: null, displayName: '' };
    const u = userSnap.data() || {};
    const email =
      typeof u.email === 'string' && u.email.trim() ? u.email.trim() : null;
    const displayName =
      typeof u.displayName === 'string' && u.displayName.trim()
        ? u.displayName.trim()
        : '';
    return { email, displayName };
  } catch (err) {
    functions.logger.warn('[sendConditionRevisionEmail] readAdvisor failed', {
      advisorUid,
      message: err?.message,
    });
    return { email: null, displayName: '' };
  }
}

/**
 * sendConditionRevisionEmail — Resend dispatcher for a single condition alert.
 *
 * Input:
 *   {
 *     alertId: string,        // advisors/{advisorUid}/conditionAlerts/{alertId}
 *     advisorUid: string,
 *     dryRun?: boolean,       // true → 不真寄、回 rendered payload
 *   }
 *
 * Output:
 *   { sent: true, messageId, alertId, advisorUid, dryRun: false }
 *   { skipped: true, reason: 'already-sent' | 'no-email' | 'dry-run-no-key' | 'alert-not-found', alertId }
 *   { sent: false, error: string, alertId }    ← worker 下次重試
 *   { dryRun: true, payload: {...}, alertId }  ← dryRun preview
 */
exports.sendConditionRevisionEmail = functions
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onCall(async (data, context) => {
    // --- Auth gate ---
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }
    const isUserAdmin = await isAdmin(context.auth.uid);
    if (!isUserAdmin) {
      throw new functions.https.HttpsError('permission-denied', '無管理員權限');
    }

    // --- Input validation ---
    if (!data || typeof data !== 'object') {
      throw new functions.https.HttpsError('invalid-argument', 'data 必須是物件');
    }
    const alertId = typeof data.alertId === 'string' ? data.alertId.trim() : '';
    const advisorUid =
      typeof data.advisorUid === 'string' ? data.advisorUid.trim() : '';
    const dryRun = data.dryRun === true;

    if (!alertId || !/^[\w.-]{1,200}$/.test(alertId)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'alertId 必填且格式不符',
      );
    }
    if (!advisorUid || !/^[A-Za-z0-9_-]{1,128}$/.test(advisorUid)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'advisorUid 必填且格式不符',
      );
    }

    // --- Runtime timestamps (HARD rule: callback 內取) ---
    const callbackStartedAtMs = Date.now();
    const callbackStartedDate = new Date(callbackStartedAtMs);
    const yyyymm =
      callbackStartedDate.getUTCFullYear().toString() +
      String(callbackStartedDate.getUTCMonth() + 1).padStart(2, '0');

    // --- Lazy require templates inside handler so test envs without the
    // mirror file can still load index.js (defensive; lib/ always shipped). ---
    const {
      renderConditionRevisionNotify,
      buildDashboardAlertUrl,
    } = require('./lib/condition-notify-templates');

    const alertRef = db
      .collection('advisors')
      .doc(advisorUid)
      .collection('conditionAlerts')
      .doc(alertId);

    // --- Step 1: read alert doc ---
    let alertSnap;
    try {
      alertSnap = await alertRef.get();
    } catch (err) {
      functions.logger.error('[sendConditionRevisionEmail] alert read failed', {
        alertId,
        advisorUid,
        message: err?.message,
      });
      // worker can retry on next tick — return error not throw
      return {
        sent: false,
        alertId,
        advisorUid,
        error: `alert 讀取失敗：${err?.message || err}`,
      };
    }

    if (!alertSnap.exists) {
      // alert 不存在 — 可能 admin 已刪、不該重試
      functions.logger.warn('[sendConditionRevisionEmail] alert missing', {
        alertId,
        advisorUid,
      });
      return { skipped: true, reason: 'alert-not-found', alertId, advisorUid };
    }

    const alert = alertSnap.data() || {};

    // --- Step 2: idempotent guard — sentEmailAt 已存在 = 已寄、不重寄 ---
    if (alert.sentEmailAt) {
      functions.logger.info('[sendConditionRevisionEmail] skip already-sent', {
        alertId,
        advisorUid,
      });
      return {
        skipped: true,
        reason: 'already-sent',
        alertId,
        advisorUid,
      };
    }

    // --- Step 3: read advisor email ---
    const { email: toEmail, displayName: advisorDisplayName } =
      await _readAdvisorEmail(advisorUid);

    if (!toEmail) {
      // 沒 email — 寫 emailSendError 防 cron 反覆撈、回 skipped
      try {
        await alertRef.set(
          {
            emailSendError: 'no-email',
            emailLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } catch (e) {
        functions.logger.warn(
          '[sendConditionRevisionEmail] alert patch (no-email) failed',
          { alertId, advisorUid, message: e?.message },
        );
      }
      return { skipped: true, reason: 'no-email', alertId, advisorUid };
    }

    // --- Step 4: build template payload ---
    const props = {
      advisorName: advisorDisplayName || '顧問',
      productName:
        typeof alert.productName === 'string' && alert.productName
          ? alert.productName
          : (typeof alert.productId === 'string' ? alert.productId : ''),
      oldVersion:
        typeof alert.oldVersion === 'string' ? alert.oldVersion : '',
      newVersion:
        typeof alert.newVersion === 'string' ? alert.newVersion : '',
      diffSummary:
        typeof alert.diffSummary === 'string' ? alert.diffSummary : '',
      importantChanges: Array.isArray(alert.importantChanges)
        ? alert.importantChanges
        : [],
      severity:
        alert.severity === 'high' ||
        alert.severity === 'medium' ||
        alert.severity === 'low'
          ? alert.severity
          : 'medium',
      affectedClientCount: Array.isArray(alert.affectedClients)
        ? alert.affectedClients.length
        : 0,
      alertId,
      dashboardUrl: buildDashboardAlertUrl(alertId),
    };

    const rendered = renderConditionRevisionNotify(props);

    // --- Step 5: dry-run path — don't send, return payload preview ---
    if (dryRun) {
      functions.logger.info('[sendConditionRevisionEmail] dry-run', {
        alertId,
        advisorUid,
        toEmail,
        subject: rendered.subject,
      });
      return {
        dryRun: true,
        alertId,
        advisorUid,
        payload: {
          to: toEmail,
          subject: rendered.subject,
          // NOTE: returning text only; html 可能上 KB、admin UI 用 text preview 即可
          text: rendered.text,
        },
      };
    }

    // --- Step 6: real send via Resend ---
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      // 跟 lifecycle email 同樣：未設 key → DRY-RUN log、不 throw
      functions.logger.info(
        '[sendConditionRevisionEmail] DRY-RUN (RESEND_API_KEY unset)',
        { alertId, advisorUid, toEmail, subject: rendered.subject },
      );
      return {
        skipped: true,
        reason: 'dry-run-no-key',
        alertId,
        advisorUid,
      };
    }

    let messageId = '';
    try {
      const resp = await axios.post(
        'https://api.resend.com/emails',
        {
          from: SEND_CONDITION_EMAIL_FROM,
          to: toEmail,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          headers: {
            'X-Entity-Ref-ID': `cond-alert-${alertId}`,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        },
      );
      messageId =
        (resp && resp.data && typeof resp.data.id === 'string'
          ? resp.data.id
          : '') || '';
    } catch (err) {
      // 失敗 — 不 throw、寫 emailSendError 給 cron 下輪 retry
      const errMsg = String(
        (err && err.response && err.response.data && err.response.data.message) ||
          (err && err.message) ||
          err,
      ).slice(0, 500);
      functions.logger.error('[sendConditionRevisionEmail] resend error', {
        alertId,
        advisorUid,
        status: err?.response?.status,
        data: err?.response?.data,
        message: errMsg,
      });
      try {
        await alertRef.set(
          {
            emailSendError: errMsg,
            emailLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } catch (e) {
        functions.logger.warn(
          '[sendConditionRevisionEmail] alert patch (error) failed',
          { alertId, advisorUid, message: e?.message },
        );
      }
      return {
        sent: false,
        alertId,
        advisorUid,
        error: errMsg,
      };
    }

    // --- Step 7: success — mark sentEmailAt + clear prior error ---
    try {
      await alertRef.set(
        {
          sentEmailAt: admin.firestore.FieldValue.serverTimestamp(),
          emailMessageId: messageId || null,
          emailSendError: admin.firestore.FieldValue.delete(),
          emailLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      // 已寄出但寫 sentEmailAt 失敗 — 可能下次 cron 重寄一次、advisor 看到兩封
      // 機率低、但記下 error log 給 ops
      functions.logger.error(
        '[sendConditionRevisionEmail] alert patch (success) failed',
        {
          alertId,
          advisorUid,
          messageId,
          message: err?.message,
        },
      );
    }

    // --- Step 8: audit log ---
    try {
      const auditEventId =
        `${SEND_CONDITION_EMAIL_AUDIT_TYPE}_${callbackStartedAtMs}_${context.auth.uid}_` +
        crypto.randomBytes(4).toString('hex');
      await db
        .collection('audit_logs')
        .doc(yyyymm)
        .collection('events')
        .doc(auditEventId)
        .set({
          type: SEND_CONDITION_EMAIL_AUDIT_TYPE,
          advisorUid: context.auth.uid,   // 觸發的 admin (非 alert owner)
          advisorEmail: context.auth.token?.email || null,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          timestampMs: callbackStartedAtMs,
          context: {
            alertId,
            targetAdvisorUid: advisorUid,  // alert owner — 真收信人
            productId:
              typeof alert.productId === 'string' ? alert.productId : '',
            oldVersion:
              typeof alert.oldVersion === 'string' ? alert.oldVersion : '',
            newVersion:
              typeof alert.newVersion === 'string' ? alert.newVersion : '',
            severity:
              alert.severity === 'high' ||
              alert.severity === 'medium' ||
              alert.severity === 'low'
                ? alert.severity
                : 'medium',
            affectedClientCount: props.affectedClientCount,
            messageId: messageId || null,
            source: 'tii',
          },
          result: 'success',
          schemaVersion: 1,
        });
    } catch (err) {
      // 不 fail callable — alert 已寄出是真實價值
      functions.logger.warn('[sendConditionRevisionEmail] audit write failed', {
        alertId,
        advisorUid,
        message: err?.message,
      });
    }

    functions.logger.info('[sendConditionRevisionEmail] sent', {
      alertId,
      advisorUid,
      toEmail,
      messageId,
    });

    return {
      sent: true,
      alertId,
      advisorUid,
      messageId,
      dryRun: false,
    };
  });

// ==========================================
// Sprint 15 W3 — Task B2: sendConditionRevisionLine callable
// ==========================================
//
// 觸發點：cron worker (processConditionAlertsQueue, Task B3) 每小時掃
//   advisors/{uid}/conditionAlerts where sentLineAt == null + status == 'pending'
//   對每筆 doc call 本 callable 完成 LINE push。
//   admin 也可在 ConditionAlerts.tsx 手動 retry。
//
// 為什麼 callable 而非 onCreate trigger：
//   - 解耦：email (B1) / LINE (B2) / 將來 SMS 各自獨立 retry path、cron 控節奏
//   - admin 可以單獨手動補送 (重複 call 因 sentLineAt idempotent 安全)
//   - B1 sendConditionRevisionEmail 已是 callable、保持一致 surface
//
// 鐵則（Sprint 15 W3 戰略邊界 HARD）：
//   - 不引入新 npm dep — 用 global fetch (Node 18+)、不裝 @line/bot-sdk
//   - LINE message body 不含客戶 PII (姓名/ID/電話) — 只 affectedClientCount
//   - LINE deep link 必走 Pin-auth signPinAuthUrl — 不直接 raw URL
//   - Idempotent：若 sentLineAt 已存在、直接 skip 不重送
//   - 失敗不 throw — 寫 lineSendError 欄位、回 { ok:false, reason }
//     避免 cron worker 因單筆 fail 整批 retry 風暴
//   - LINE_CHANNEL_TOKEN 從 process.env 取、缺則 throw 'messaging-not-configured'
//     (有意義 error code 給 admin debug、跟 'internal' 區分)
//   - 所有 wall-clock (Date.now / new Date) 必須 callback 內取 (對齊
//     notifyConditionRevision rule、避免 cold-start 時鐘不對齊)
//   - sentLineAt 用 serverTimestamp 寫 (避免 cron worker 時鐘漂移)

const COND_LINE_AUDIT_TYPE = 'condition_alert_line_sent';
const COND_LINE_API_URL = 'https://api.line.me/v2/bot/message/push';
const COND_LINE_TIMEOUT_MS = 10_000;  // fetch 沒原生 timeout — AbortController 補

/** Resolve advisor's LINE userId. Returns null if not bound. */
async function _readAdvisorLineUserId(advisorUid) {
  if (!advisorUid || typeof advisorUid !== 'string') return null;
  try {
    const snap = await db.collection('users').doc(advisorUid).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    // 主路徑：users/{uid}.lineUserId (Pin 綁定時寫入)
    if (typeof data.lineUserId === 'string' && data.lineUserId.trim()) {
      return data.lineUserId.trim();
    }
    // 備援：users/{uid}.pin.lineUserId (舊版 Pin 結構)
    if (
      data.pin &&
      typeof data.pin.lineUserId === 'string' &&
      data.pin.lineUserId.trim()
    ) {
      return data.pin.lineUserId.trim();
    }
    return null;
  } catch (err) {
    functions.logger.warn('[sendConditionRevisionLine] read lineUserId failed', {
      advisorUid,
      message: err?.message,
    });
    return null;
  }
}

/** Resolve advisor display name for LINE greeting. Falls back to "顧問".
 *  不含 PII、用於 greeting 行。 */
async function _readAdvisorDisplayNameForLine(advisorUid) {
  if (!advisorUid || typeof advisorUid !== 'string') return '顧問';
  try {
    const snap = await db.collection('users').doc(advisorUid).get();
    if (!snap.exists) return '顧問';
    const data = snap.data() || {};
    const name =
      (typeof data.displayName === 'string' && data.displayName.trim()) ||
      (typeof data.name === 'string' && data.name.trim()) ||
      '';
    return name || '顧問';
  } catch (err) {
    functions.logger.warn(
      '[sendConditionRevisionLine] read displayName failed',
      {
        advisorUid,
        message: err?.message,
      },
    );
    return '顧問';
  }
}

/**
 * sendConditionRevisionLine — push LINE notification for a single alert doc.
 *
 * Input:
 *   {
 *     alertId: string,        // advisors/{advisorUid}/conditionAlerts/{alertId}
 *     advisorUid: string,
 *     dryRun?: boolean,       // true → 不真送、回 rendered payload (with masked userId)
 *   }
 *
 * Output:
 *   { ok: true, runId, lineMessageId?, textLength }
 *   { ok: true, reason: 'already-sent' | 'dry-run', runId }
 *   { ok: false, reason: 'no-line-id' | 'template-error' | 'line-api-error', runId, ... }
 *
 * Throws (only for fatal precondition):
 *   - HttpsError('unauthenticated' | 'permission-denied' | 'invalid-argument' | 'not-found')
 *   - HttpsError('failed-precondition', 'messaging-not-configured') 當 LINE token 未配置
 */
exports.sendConditionRevisionLine = functions
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onCall(async (data, context) => {
    // --- Auth gate (admin-only — cron worker 用 admin SDK 觸發) ---
    await verifyAdminAccess(context);

    // --- Input validation ---
    if (!data || typeof data !== 'object') {
      throw new functions.https.HttpsError('invalid-argument', 'data 必須是物件');
    }
    const alertId = typeof data.alertId === 'string' ? data.alertId.trim() : '';
    const advisorUid =
      typeof data.advisorUid === 'string' ? data.advisorUid.trim() : '';
    const dryRun = data.dryRun === true;

    if (!alertId || !/^[\w.-]{1,200}$/.test(alertId)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'alertId 必填且格式不符',
      );
    }
    if (!advisorUid || !/^[\w.-]{1,128}$/.test(advisorUid)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'advisorUid 必填且格式不符',
      );
    }

    // --- Runtime token check (HARD: callback 內取、不在 module top) ---
    // 優先 process.env.LINE_CHANNEL_TOKEN (Sprint 15 W3 spec)、
    // 退到 functions.config().line.channel_access_token (Sprint 11 既有、相容)
    const lineToken =
      (typeof process.env.LINE_CHANNEL_TOKEN === 'string' &&
        process.env.LINE_CHANNEL_TOKEN.trim()) ||
      functions.config().line?.channel_access_token ||
      LINE_CHANNEL_ACCESS_TOKEN ||
      '';
    if (!lineToken) {
      // 'failed-precondition' + 'messaging-not-configured' — admin debug 友善
      throw new functions.https.HttpsError(
        'failed-precondition',
        'messaging-not-configured',
      );
    }

    // --- Runtime timestamps (HARD: callback 內取) ---
    const callbackStartedAtMs = Date.now();
    const callbackStartedDate = new Date(callbackStartedAtMs);
    const yyyymm =
      callbackStartedDate.getUTCFullYear().toString() +
      String(callbackStartedDate.getUTCMonth() + 1).padStart(2, '0');
    const runId =
      `line_${callbackStartedAtMs}_${crypto.randomBytes(4).toString('hex')}`;

    functions.logger.info('[sendConditionRevisionLine] start', {
      runId,
      alertId,
      advisorUid,
      adminUid: context.auth.uid,
      dryRun,
    });

    // --- Read alert doc ---
    const alertRef = db
      .collection('advisors')
      .doc(advisorUid)
      .collection('conditionAlerts')
      .doc(alertId);
    let alertSnap;
    try {
      alertSnap = await alertRef.get();
    } catch (err) {
      functions.logger.error('[sendConditionRevisionLine] alert read failed', {
        runId,
        alertId,
        advisorUid,
        message: err?.message,
      });
      throw new functions.https.HttpsError(
        'internal',
        `讀取 alert 失敗：${err?.message || err}`,
      );
    }
    if (!alertSnap.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        `alert ${alertId} 不存在於 advisors/${advisorUid}/conditionAlerts`,
      );
    }
    const alertData = alertSnap.data() || {};

    // --- Idempotent guard: 已送過則 skip ---
    if (alertData.sentLineAt) {
      functions.logger.info(
        '[sendConditionRevisionLine] already sent, skipping',
        { runId, alertId, advisorUid },
      );
      return { ok: true, reason: 'already-sent', runId };
    }

    // --- Resolve advisor LINE userId ---
    const lineUserId = await _readAdvisorLineUserId(advisorUid);
    if (!lineUserId) {
      // 寫 skip 標記、避免 cron 一直 retry no-line-id 顧問
      try {
        await alertRef.set(
          {
            lineSendSkippedAt: admin.firestore.FieldValue.serverTimestamp(),
            lineSendSkipReason: 'no-line-id',
          },
          { merge: true },
        );
      } catch (err) {
        functions.logger.warn('[sendConditionRevisionLine] skip mark failed', {
          runId,
          alertId,
          message: err?.message,
        });
      }
      functions.logger.info('[sendConditionRevisionLine] skipped no-line-id', {
        runId,
        alertId,
        advisorUid,
      });
      return { ok: false, reason: 'no-line-id', runId };
    }

    // --- Build payload via template helper ---
    const advisorName = await _readAdvisorDisplayNameForLine(advisorUid);
    // Pin-auth signed deep-link (HARD rule)。signPinAuthUrl 內建 24h HMAC + tab；
    // 缺 PIN_AUTH_SECRET 時自動 fall back 到 plain login URL — 仍然要登入、不裸露。
    const dashboardUrl = signPinAuthUrl(advisorUid, 'condition-alerts');

    const templateProps = {
      advisorName,
      productName:
        typeof alertData.productName === 'string' && alertData.productName
          ? alertData.productName
          : typeof alertData.productId === 'string'
            ? alertData.productId
            : '未知商品',
      oldVersion:
        typeof alertData.oldVersion === 'string' ? alertData.oldVersion : 'v?',
      newVersion:
        typeof alertData.newVersion === 'string' ? alertData.newVersion : 'v?',
      diffSummary:
        typeof alertData.diffSummary === 'string' ? alertData.diffSummary : '',
      importantChanges: Array.isArray(alertData.importantChanges)
        ? alertData.importantChanges
        : [],
      severity:
        alertData.severity === 'high' ||
        alertData.severity === 'medium' ||
        alertData.severity === 'low'
          ? alertData.severity
          : 'medium',
      affectedClientCount: Array.isArray(alertData.affectedClients)
        ? alertData.affectedClients.length
        : 0,
      alertId,
      dashboardUrl,
    };

    // lazy-require — pattern aligns with lifecycle-email-templates.js
    const conditionTemplates = require('./lib/condition-notify-templates');
    let lineText;
    try {
      lineText = conditionTemplates.buildConditionLineMessage(templateProps);
    } catch (err) {
      functions.logger.error(
        '[sendConditionRevisionLine] template build failed',
        { runId, alertId, message: err?.message },
      );
      return { ok: false, reason: 'template-error', runId };
    }

    // 雙保險 — LINE push 限制 5000 chars、template 已 cap 4900、再 cap 一次
    if (lineText.length > 4900) {
      lineText = lineText.slice(0, 4895) + '…';
    }

    // --- dryRun: return payload without sending ---
    if (dryRun) {
      functions.logger.info('[sendConditionRevisionLine] dryRun', {
        runId,
        alertId,
        lineUserIdMasked: lineUserId.slice(0, 4) + '...',
        textLength: lineText.length,
      });
      return {
        ok: true,
        reason: 'dry-run',
        runId,
        payload: {
          to: lineUserId.slice(0, 4) + '...',  // mask response 也不洩 PII
          messages: [{ type: 'text', text: lineText }],
        },
      };
    }

    // --- Send LINE push (global fetch, Node 18+, no @line/bot-sdk) ---
    let lineMessageId = '';
    let httpStatus = 0;
    let lineErrorBody = '';
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), COND_LINE_TIMEOUT_MS);
      let resp;
      try {
        resp = await fetch(COND_LINE_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lineToken}`,
          },
          body: JSON.stringify({
            to: lineUserId,
            messages: [{ type: 'text', text: lineText }],
          }),
          signal: ac.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      httpStatus = resp.status;
      // 成功回 200 + {} body；request-id 在 response header
      lineMessageId =
        resp.headers.get('x-line-request-id') ||
        resp.headers.get('X-Line-Request-Id') ||
        '';

      if (!resp.ok) {
        try {
          lineErrorBody = (await resp.text()).slice(0, 500);
        } catch (_) {
          lineErrorBody = '';
        }
        throw new Error(
          `LINE push HTTP ${httpStatus}: ${lineErrorBody.slice(0, 200)}`,
        );
      }
    } catch (err) {
      const errMsg = String(err?.message || err).slice(0, 500);
      functions.logger.error('[sendConditionRevisionLine] LINE push failed', {
        runId,
        alertId,
        advisorUid,
        httpStatus,
        message: errMsg,
      });
      // 寫錯誤標記、不 throw (避免 cron worker 整批 retry 風暴)
      try {
        await alertRef.set(
          {
            lineSendError: errMsg,
            lineSendErrorAt: admin.firestore.FieldValue.serverTimestamp(),
            lineSendHttpStatus: httpStatus || null,
          },
          { merge: true },
        );
      } catch (markErr) {
        functions.logger.warn(
          '[sendConditionRevisionLine] error mark failed',
          { runId, alertId, message: markErr?.message },
        );
      }
      return { ok: false, reason: 'line-api-error', runId, httpStatus };
    }

    // --- Success: stamp sentLineAt (serverTimestamp 避免時鐘漂移) ---
    try {
      await alertRef.set(
        {
          sentLineAt: admin.firestore.FieldValue.serverTimestamp(),
          lineMessageId: lineMessageId || null,
          lineSendError: admin.firestore.FieldValue.delete(),
          lineSendErrorAt: admin.firestore.FieldValue.delete(),
          lineSendHttpStatus: admin.firestore.FieldValue.delete(),
        },
        { merge: true },
      );
    } catch (err) {
      // 已送成功但寫 stamp 失敗 — 下次 cron 會重送 (advisor 收兩次)
      // 寧可 log 也不 throw、否則整 callable 失敗 admin 以為 LINE 也失敗
      functions.logger.error(
        '[sendConditionRevisionLine] sentLineAt write failed',
        { runId, alertId, advisorUid, message: err?.message },
      );
    }

    // --- Audit log (no PII — 不寫 lineUserId 全文) ---
    try {
      const auditEventId =
        `${COND_LINE_AUDIT_TYPE}_${callbackStartedAtMs}_${context.auth.uid}_` +
        crypto.randomBytes(4).toString('hex');
      await db
        .collection('audit_logs')
        .doc(yyyymm)
        .collection('events')
        .doc(auditEventId)
        .set({
          type: COND_LINE_AUDIT_TYPE,
          advisorUid,                       // alert owner — 真收 LINE 的人
          triggeredBy: context.auth.uid,    // 觸發的 admin (或 cron worker admin SDK)
          triggeredByEmail: context.auth.token?.email || null,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          timestampMs: callbackStartedAtMs,
          context: {
            runId,
            alertId,
            lineMessageId: lineMessageId || null,
            textLength: lineText.length,
            productId:
              typeof alertData.productId === 'string' ? alertData.productId : '',
            oldVersion:
              typeof alertData.oldVersion === 'string' ? alertData.oldVersion : '',
            newVersion:
              typeof alertData.newVersion === 'string' ? alertData.newVersion : '',
            severity: templateProps.severity,
            affectedClientCount: templateProps.affectedClientCount,
            source: 'tii',
          },
          result: 'success',
          schemaVersion: 1,
        });
    } catch (err) {
      functions.logger.warn('[sendConditionRevisionLine] audit write failed', {
        runId,
        alertId,
        message: err?.message,
      });
    }

    functions.logger.info('[sendConditionRevisionLine] done', {
      runId,
      alertId,
      advisorUid,
      lineMessageId: lineMessageId || '(none)',
      textLength: lineText.length,
    });

    return {
      ok: true,
      runId,
      lineMessageId: lineMessageId || null,
      textLength: lineText.length,
    };
  });

// ==========================================
// Sprint 15 W3 — Task B4: tiiMonthlyCrawlGuard
// ==========================================
// 監控 Sprint 15 W1 TII monthly cron 是否真的成功跑了。
//
// 設計理由：
//   - W1 cron 排在每月 1 號 09:00 (Asia/Taipei)，本 guard 排在每月 5 號 10:00、
//     給足 4 天讓 retry / 人工修補 / GitHub Actions 重跑、再來看結果有沒有寫進
//     Firestore 的 `tii_crawl_results/{yyyymm}` doc。
//   - 沒寫進 doc / status != 'success' / errorCount > 閾值 → 寫 admin alert doc
//     + 寄 email 給「自願接 system alert 的 admin」(admins.notifyOnSystemAlerts==true)。
//   - audit_logs 永遠寫，給日後 SLA 報表用。
//   - 不依賴新 npm package — Resend 走既有 axios + REST、跟 lifecycle email 同 pattern。
//
// 鐵則：
//   - email/audit/alert 各自 try-catch、互不擋；本 guard 自己 throw 會讓 cron retry
//     反而把 false-positive alert 多寄一次。
//   - 「現在時間」全部 callback 內取 (Date.now() / new Date())、不在 schedule 字串外捕。
//   - 不出現禁字。
// ==========================================

const TII_GUARD_ERROR_COUNT_THRESHOLD = 5;
const TII_GUARD_AUDIT_TYPE = 'tii_crawl_guard';
const TII_GUARD_ALERT_FROM = 'Ultra Advisor System <hello@ultra-advisor.tw>';

/**
 * 把 Date → 'YYYYMM' 字串。doc id 跟 scripts/crawl-tii-monthly.cjs 對齊。
 * crawler 用 UTC 年月組 runMonth (見 formatRunMonth)、本 guard 也用 UTC 維持單一定義
 * (避免 UTC↔Taipei 跨月誤差；W1 cron + 本 guard 都不在邊界時刻跑、選 UTC 為單一真相)。
 * @param {Date} d
 * @returns {string}
 */
function _tiiGuardFormatYyyymm(d) {
  const y = d.getUTCFullYear().toString();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}${m}`;
}

/**
 * 撈所有自願接 system alert 的 admin email。
 * 失敗 → 回空陣列、guard caller log 一筆 warning，不擋 alert doc 寫入。
 * @returns {Promise<string[]>}
 */
async function _tiiGuardFetchAlertAdminEmails() {
  try {
    const snap = await db
      .collection('admins')
      .where('notifyOnSystemAlerts', '==', true)
      .get();
    const emails = [];
    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const email = typeof data.email === 'string' && data.email.trim()
        ? data.email.trim()
        : '';
      if (email && emails.indexOf(email) === -1) emails.push(email);
    }
    return emails;
  } catch (err) {
    functions.logger.warn('[tiiMonthlyCrawlGuard] admin email fetch failed', {
      message: err?.message,
    });
    return [];
  }
}

/**
 * 用既有 Resend pattern 寄 system alert email。RESEND_API_KEY (env) 或
 * functions.config().resend.api_key 任一有 → 真寄；都沒設 → DRY-RUN (logger.info)。
 * 失敗純 log、不 throw。
 * @param {string[]} toEmails
 * @param {string} subject
 * @param {string} bodyText
 */
async function _tiiGuardSendAlertEmail(toEmails, subject, bodyText) {
  if (!toEmails || toEmails.length === 0) {
    functions.logger.info('[tiiMonthlyCrawlGuard] no admin recipients — skip email');
    return;
  }
  const RESEND_API_KEY =
    process.env.RESEND_API_KEY ||
    (functions.config().resend && functions.config().resend.api_key) ||
    '';
  if (!RESEND_API_KEY) {
    functions.logger.info('[tiiMonthlyCrawlGuard] DRY-RUN (no Resend key)', {
      to: toEmails,
      subject,
    });
    return;
  }
  // 為避免「資料夾外洩 cc」，個別 toEmails 分開送、不直接 array 全 to。
  // (跟 lifecycle email 同 pattern — 收件人寫個位數，避免 Resend bcc 混淆。)
  for (const to of toEmails) {
    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: TII_GUARD_ALERT_FROM,
          to,
          subject,
          text: bodyText,
          headers: {
            'X-Entity-Ref-ID': `tii-guard-${Date.now()}`,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        },
      );
      functions.logger.info('[tiiMonthlyCrawlGuard] email sent', { to });
    } catch (err) {
      functions.logger.error('[tiiMonthlyCrawlGuard] resend error', {
        to,
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });
    }
  }
}

exports.tiiMonthlyCrawlGuard = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  // 每月 5 號 10:00 Asia/Taipei 跑、檢查 1 號 cron 完成狀況。
  .pubsub.schedule('0 10 5 * *')
  .timeZone('Asia/Taipei')
  .onRun(async (_context) => {
    // --- Runtime now (HARD rule: callback 內取) ---
    const startedAtMs = Date.now();
    const startedAtDate = new Date(startedAtMs);
    const yyyymm = _tiiGuardFormatYyyymm(startedAtDate);
    const runId = `tii_guard_${startedAtMs}_${crypto.randomBytes(4).toString('hex')}`;
    // audit_logs/{auditYyyymm} 對齊 notifyConditionRevision 寫法 — 用 UTC 月。
    const auditYyyymm =
      startedAtDate.getUTCFullYear().toString() +
      String(startedAtDate.getUTCMonth() + 1).padStart(2, '0');

    functions.logger.info('[tiiMonthlyCrawlGuard] start', {
      runId,
      yyyymm,
      startedAtMs,
    });

    // --- Read tii_crawl_results/{yyyymm} ---
    let resultData = null;
    let resultExists = false;
    let readError = null;
    try {
      const snap = await db.collection('tii_crawl_results').doc(yyyymm).get();
      resultExists = snap.exists;
      resultData = resultExists ? snap.data() || {} : null;
    } catch (err) {
      readError = err?.message || String(err);
      functions.logger.error('[tiiMonthlyCrawlGuard] read tii_crawl_results failed', {
        runId,
        yyyymm,
        message: readError,
      });
    }

    // --- Classify ---
    // severity: 'critical' (doc missing / read error) / 'high' (status != success) /
    //           'medium' (partial — too many errorCount) / null (healthy)
    let severity = null;
    let reason = '';
    const status = resultData && typeof resultData.status === 'string'
      ? resultData.status
      : '';
    const errorCount = resultData && Number.isFinite(resultData.errorCount)
      ? resultData.errorCount
      : 0;
    const productsProcessed =
      resultData && Number.isFinite(resultData.productsProcessed)
        ? resultData.productsProcessed
        : 0;

    if (readError) {
      severity = 'critical';
      reason = `讀取 tii_crawl_results/${yyyymm} 失敗：${readError}`;
    } else if (!resultExists) {
      severity = 'critical';
      reason = `${yyyymm} 月 TII catalog 月爬未跑 (tii_crawl_results doc 不存在)`;
    } else if (status !== 'success') {
      severity = 'high';
      reason = `${yyyymm} 月 TII catalog 月爬 status='${status || 'unknown'}'`;
    } else if (errorCount > TII_GUARD_ERROR_COUNT_THRESHOLD) {
      severity = 'medium';
      reason = `${yyyymm} 月 TII catalog 月爬 errorCount=${errorCount} (> ${TII_GUARD_ERROR_COUNT_THRESHOLD})`;
    }

    const healthy = severity === null;

    // --- 寫 admin alert doc + 寄 email (僅當 unhealthy) ---
    if (!healthy) {
      const alertDoc = {
        type: 'tii_crawl_failure',
        yyyymm,
        severity,
        reason,
        runId,
        status,
        errorCount,
        productsProcessed,
        resultExists,
        readError,
        detectedAtMs: startedAtMs,
        detectedAt: admin.firestore.FieldValue.serverTimestamp(),
        acknowledged: false,
        schemaVersion: 1,
      };

      try {
        await db
          .collection('admin')
          .doc('alerts')
          .collection('tii_crawl_failure')
          .doc(yyyymm)
          .set(alertDoc, { merge: true });
      } catch (err) {
        functions.logger.error('[tiiMonthlyCrawlGuard] alert doc write failed', {
          runId,
          yyyymm,
          message: err?.message,
        });
        // 不 throw — 還要繼續嘗試寄 email + audit
      }

      const emailList = await _tiiGuardFetchAlertAdminEmails();
      const subject = `【UA】${yyyymm} 月 TII catalog 月爬未成功完成`;
      const bodyText =
        `【UA】${yyyymm} 月 TII catalog 月爬未成功完成、請手動 trigger 或檢查 GitHub Actions log。\n\n` +
        `severity: ${severity}\n` +
        `reason: ${reason}\n` +
        `status: ${status || '(無)'}\n` +
        `errorCount: ${errorCount}\n` +
        `productsProcessed: ${productsProcessed}\n` +
        `resultExists: ${resultExists}\n` +
        `runId: ${runId}\n\n` +
        `— Ultra Advisor system guard\n`;
      await _tiiGuardSendAlertEmail(emailList, subject, bodyText);
    }

    // --- Audit log ---
    try {
      const auditEventId =
        `${TII_GUARD_AUDIT_TYPE}_${startedAtMs}_` +
        crypto.randomBytes(4).toString('hex');
      await db
        .collection('audit_logs')
        .doc(auditYyyymm)
        .collection('events')
        .doc(auditEventId)
        .set({
          type: TII_GUARD_AUDIT_TYPE,
          advisorUid: null, // cron 觸發、無人類 admin
          advisorEmail: null,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          timestampMs: startedAtMs,
          context: {
            runId,
            yyyymm,
            healthy,
            severity,
            status,
            errorCount,
            productsProcessed,
            resultExists,
            hasReadError: readError !== null,
          },
          result: healthy ? 'success' : 'partial',
          schemaVersion: 1,
        });
    } catch (err) {
      functions.logger.error('[tiiMonthlyCrawlGuard] audit write failed', {
        runId,
        message: err?.message,
      });
    }

    functions.logger.info('[tiiMonthlyCrawlGuard] done', {
      runId,
      yyyymm,
      healthy,
      severity,
    });

    return null;
  });

// ============================================================================
// Sprint 15 W3 · Task B3 — Condition alerts fanout cron worker
// ============================================================================
//
// 角色：每小時掃 advisors/*/conditionAlerts (status='pending' & sent*At=null) 並
// 自動 fanout email + LINE。B1 (sendConditionRevisionEmail callable) + B2
// (sendConditionRevisionLine callable) 可手動 retry 單筆；本 cron 是自動 fanout、
// 兜底沒被 admin 手動觸發的 alert。
//
// 與 B1 / B2 共用 send 邏輯：
//  - email send 邏輯抽成 _condQueueSendEmail(alertRef, alert, advisorEnvelope, opts)
//  - LINE  send 邏輯抽成 _condQueueSendLine (alertRef, alert, advisorEnvelope, opts)
//  - 兩 helper 都跟 B1/B2 callable 同樣 reuse lib/condition-notify-templates、
//    寫 sentEmailAt / sentLineAt = serverTimestamp、把 emailSendError / lineSendError 收乾
//  - B1/B2 callable 既有實作未改 — 本 sprint cron 是 additive，下個 sprint 可選擇
//    把 callable 內聯實作換成呼叫本 helper (現在不動以免破壞已 ship 的 callable)
//
// IRONCLAD RULES:
//  - Idempotent — alert.sentEmailAt / sentLineAt 已寫就 skip (重跑安全)
//  - 不引入新 npm 依賴 — Resend / LINE 都走既有 axios + REST
//  - 「現在時間」一律 onRun callback 內取 (HARD rule)
//  - 單筆失敗不 throw、continue next (batch 不被一個 bad doc 卡死)
//  - email / LINE 內文絕不含客戶 PII — template lib 已 enforce、cron 只傳聚合 count
//  - LINE deep link 為 SPA 路徑 (登入後 auth gate 才看得到資料)
//  - sentEmailAt / sentLineAt 用 serverTimestamp (避免容器時鐘漂移)
//  - 一次最多 200 alert (避免 540s timeout)、剩下下次 cron 繼續
//  - errors > COND_QUEUE_ALERT_THRESHOLD → 寫 admin/alerts/cron_failure 告警
//  - LINE token / Resend key 缺 → 該筆變 dryRun、不 throw、其他繼續
// ============================================================================

const COND_QUEUE_BATCH_LIMIT = 200;                // 單次 cron 最多處理 alert 數
const COND_QUEUE_ALERT_THRESHOLD = 10;             // errors 超過此數寫 admin 告警
const COND_QUEUE_AUDIT_TYPE = 'condition_alerts_cron_run';
const COND_QUEUE_DRY_RUN_FORCED =
  process.env.COND_QUEUE_FORCE_DRY_RUN === '1';    // 部署期 smoke test 用
// SEND_CONDITION_EMAIL_FROM 已在 B1 (約 line 8239) 定義為
//   'Ultra Advisor <noreply@ultra-advisor.tw>' — 本 worker reuse 同字串、語氣一致

/**
 * 讀 advisor 的 contact envelope (email + lineUserId + 顯示名)。
 * 顧問 profile 存在 users/{advisorUid}、advisors/{advisorUid} 只放 alert 子集合。
 *
 * Note: B1 已有 _readAdvisorEmail (只回 email + displayName)、B2 內部也讀 user doc
 * 取 lineUserId — 本 helper 是 cron 專用、一次撈三個欄位避免 per-alert 兩次 read。
 *
 * Returns null on miss/error → caller skip 該筆 dispatch (記 audit、不 throw)。
 */
async function _condQueueReadAdvisorEnvelope(advisorUid) {
  if (!advisorUid || typeof advisorUid !== 'string') return null;
  try {
    const snap = await db.collection('users').doc(advisorUid).get();
    if (!snap.exists) return null;
    const data = snap.data() || {};
    const email =
      typeof data.email === 'string' &&
      data.email.trim() &&
      data.email.includes('@')
        ? data.email.trim()
        : null;
    const lineUserId =
      typeof data.lineUserId === 'string' && data.lineUserId.trim()
        ? data.lineUserId.trim()
        : null;
    const displayName =
      (typeof data.displayName === 'string' && data.displayName.trim()) ||
      (typeof data.name === 'string' && data.name.trim()) ||
      '顧問';
    return { advisorUid, email, lineUserId, displayName };
  } catch (err) {
    functions.logger.warn('[conditionAlertsCron] advisor envelope read failed', {
      advisorUid,
      message: err?.message,
    });
    return null;
  }
}

/**
 * Build the `renderConditionRevisionNotify` props from a raw alert doc.
 * 跟 B1 callable 的 props build 段落對齊 (一個來源、避免內容歧義)。
 */
function _condQueueBuildTemplateProps(alert, advisorEnvelope, alertId, dashboardUrl) {
  return {
    advisorName: advisorEnvelope.displayName || '顧問',
    productName:
      typeof alert.productName === 'string' && alert.productName
        ? alert.productName
        : (typeof alert.productId === 'string' ? alert.productId : ''),
    oldVersion:
      typeof alert.oldVersion === 'string' ? alert.oldVersion : '',
    newVersion:
      typeof alert.newVersion === 'string' ? alert.newVersion : '',
    diffSummary:
      typeof alert.diffSummary === 'string' ? alert.diffSummary : '',
    importantChanges: Array.isArray(alert.importantChanges)
      ? alert.importantChanges
      : [],
    severity:
      alert.severity === 'high' ||
      alert.severity === 'medium' ||
      alert.severity === 'low'
        ? alert.severity
        : 'medium',
    affectedClientCount: Array.isArray(alert.affectedClients)
      ? alert.affectedClients.length
      : 0,
    alertId,
    dashboardUrl,
  };
}

/**
 * _condQueueSendEmail — Resend dispatcher 共用 helper (B1 callable + B3 cron)。
 *
 * Idempotent guard：
 *  - alert.sentEmailAt 已存在 → return skipped:'already-sent'、不重寄
 *  - advisor.email 缺 → 寫 emailSendError='no-email'、return skipped:'no-email'
 *  - RESEND_API_KEY 缺 → log dry-run、不寫 sentEmailAt (下次 cron 重試)
 *  - opts.isDryRun → render payload、不寄、不寫 sentEmailAt
 *
 * @param {FirebaseFirestore.DocumentReference} alertRef
 * @param {object} alert        - alert doc snapshot data
 * @param {object} advisorEnvelope - { advisorUid, email, lineUserId, displayName }
 * @param {object} opts         - { isDryRun?: boolean, runId?: string }
 * @returns {Promise<{ dispatched: boolean, dryRun: boolean, skipped?: string, error?: string, messageId?: string }>}
 */
async function _condQueueSendEmail(alertRef, alert, advisorEnvelope, opts) {
  const options = opts || {};
  const alertId = alertRef.id;

  if (alert.sentEmailAt) {
    return { dispatched: false, dryRun: false, skipped: 'already-sent' };
  }
  if (!advisorEnvelope || !advisorEnvelope.email) {
    // 沒 email — 標記 emailSendError 防 cron 反覆撈
    try {
      await alertRef.set(
        {
          emailSendError: 'no-email',
          emailLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (e) {
      functions.logger.warn(
        '[conditionAlertsCron] alert patch (no-email) failed',
        { alertId, message: e?.message },
      );
    }
    return { dispatched: false, dryRun: false, skipped: 'no-email' };
  }

  // Lazy require — 跟 B1 callable 同樣 pattern (test env 友善)
  const {
    renderConditionRevisionNotify,
    buildDashboardAlertUrl,
  } = require('./lib/condition-notify-templates');
  const dashboardUrl = buildDashboardAlertUrl(alertId);
  const props = _condQueueBuildTemplateProps(
    alert,
    advisorEnvelope,
    alertId,
    dashboardUrl,
  );
  const rendered = renderConditionRevisionNotify(props);

  const isDryRun = !!options.isDryRun || COND_QUEUE_DRY_RUN_FORCED;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (isDryRun || !RESEND_API_KEY) {
    functions.logger.info('[conditionAlertsCron] email DRY-RUN', {
      to: advisorEnvelope.email,
      advisorUid: advisorEnvelope.advisorUid,
      alertId,
      subject: rendered.subject,
      reason: isDryRun ? 'forced_dry_run' : 'no_resend_key',
      runId: options.runId || null,
    });
    return { dispatched: false, dryRun: true };
  }

  let messageId = '';
  try {
    const resp = await axios.post(
      'https://api.resend.com/emails',
      {
        from: SEND_CONDITION_EMAIL_FROM,
        to: advisorEnvelope.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: {
          'X-Entity-Ref-ID': `cond-alert-${alertId}`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      },
    );
    messageId =
      resp && resp.data && typeof resp.data.id === 'string'
        ? resp.data.id
        : '';
  } catch (err) {
    const errMsg = String(
      err?.response?.data?.message || err?.message || err,
    ).slice(0, 500);
    functions.logger.error('[conditionAlertsCron] resend error', {
      alertId,
      advisorUid: advisorEnvelope.advisorUid,
      status: err?.response?.status,
      data: err?.response?.data,
      message: errMsg,
      runId: options.runId || null,
    });
    try {
      await alertRef.set(
        {
          emailSendError: errMsg,
          emailLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (e) {
      functions.logger.warn(
        '[conditionAlertsCron] alert patch (error) failed',
        { alertId, message: e?.message },
      );
    }
    return { dispatched: false, dryRun: false, error: errMsg };
  }

  // 寫 sentEmailAt + clear prior error — 跟 B1 callable 同寫法
  try {
    await alertRef.set(
      {
        sentEmailAt: admin.firestore.FieldValue.serverTimestamp(),
        emailMessageId: messageId || null,
        emailSendError: admin.firestore.FieldValue.delete(),
        emailLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        sentEmailRunId: options.runId || null,
      },
      { merge: true },
    );
  } catch (err) {
    // 已寄出但寫 sentEmailAt 失敗 — log、worker 下輪可能重寄一次
    functions.logger.error(
      '[conditionAlertsCron] alert patch (email success) failed',
      { alertId, messageId, message: err?.message },
    );
  }

  return { dispatched: true, dryRun: false, messageId };
}

/**
 * _condQueueSendLine — LINE Messaging API dispatcher 共用 helper。
 *
 * Idempotent guard：
 *  - alert.sentLineAt 已存在 → return skipped:'already-sent'、不重送
 *  - advisor.lineUserId 缺 → 寫 lineSendError='no-line'、return skipped:'no-line'
 *  - LINE token 缺 → 改 dryRun (cron 模式)；若 opts.throwOnMissingToken 則 throw
 *    HttpsError('failed-precondition', 'messaging-not-configured')
 *  - opts.isDryRun → render text、不送、不寫 sentLineAt
 *
 * 鐵則：LINE Channel access token 從 env LINE_CHANNEL_TOKEN、缺 fallback
 *      既有 functions.config().line.channel_access_token (Sprint 5 配置)。
 *
 * @param {FirebaseFirestore.DocumentReference} alertRef
 * @param {object} alert
 * @param {object} advisorEnvelope - { advisorUid, email, lineUserId, displayName }
 * @param {object} opts            - { isDryRun?: boolean, runId?: string, throwOnMissingToken?: boolean }
 * @returns {Promise<{ dispatched: boolean, dryRun: boolean, skipped?: string, error?: string }>}
 */
async function _condQueueSendLine(alertRef, alert, advisorEnvelope, opts) {
  const options = opts || {};
  const alertId = alertRef.id;

  if (alert.sentLineAt) {
    return { dispatched: false, dryRun: false, skipped: 'already-sent' };
  }
  if (!advisorEnvelope || !advisorEnvelope.lineUserId) {
    try {
      await alertRef.set(
        {
          lineSendError: 'no-line',
          lineLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (e) {
      functions.logger.warn(
        '[conditionAlertsCron] alert patch (no-line) failed',
        { alertId, message: e?.message },
      );
    }
    return { dispatched: false, dryRun: false, skipped: 'no-line' };
  }

  const {
    renderConditionRevisionNotify,
    buildDashboardAlertUrl,
  } = require('./lib/condition-notify-templates');
  const dashboardUrl = buildDashboardAlertUrl(alertId);
  const props = _condQueueBuildTemplateProps(
    alert,
    advisorEnvelope,
    alertId,
    dashboardUrl,
  );
  const rendered = renderConditionRevisionNotify(props);
  const lineText = rendered.line;

  // 鐵則：env LINE_CHANNEL_TOKEN 先、fallback config()
  const lineToken =
    process.env.LINE_CHANNEL_TOKEN ||
    LINE_CHANNEL_ACCESS_TOKEN ||
    null;

  const isDryRun = !!options.isDryRun || COND_QUEUE_DRY_RUN_FORCED;
  if (isDryRun || !lineToken) {
    if (!lineToken && options.throwOnMissingToken) {
      // B2 callable 模式：缺 token throw、讓 admin 知道要設環境變數
      throw new functions.https.HttpsError(
        'failed-precondition',
        'messaging-not-configured',
      );
    }
    functions.logger.info('[conditionAlertsCron] line DRY-RUN', {
      lineUserId: advisorEnvelope.lineUserId,
      advisorUid: advisorEnvelope.advisorUid,
      alertId,
      reason: isDryRun ? 'forced_dry_run' : 'no_line_token',
      preview: lineText.slice(0, 80),
      runId: options.runId || null,
    });
    return { dispatched: false, dryRun: true };
  }

  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {
        to: advisorEnvelope.lineUserId,
        messages: [{ type: 'text', text: lineText }],
      },
      {
        headers: {
          Authorization: `Bearer ${lineToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      },
    );
  } catch (err) {
    const errMsg = String(
      err?.response?.data?.message || err?.message || err,
    ).slice(0, 500);
    functions.logger.error('[conditionAlertsCron] line error', {
      alertId,
      advisorUid: advisorEnvelope.advisorUid,
      status: err?.response?.status,
      data: err?.response?.data,
      message: errMsg,
      runId: options.runId || null,
    });
    try {
      await alertRef.set(
        {
          lineSendError: errMsg,
          lineLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (e) {
      functions.logger.warn(
        '[conditionAlertsCron] alert patch (line error) failed',
        { alertId, message: e?.message },
      );
    }
    return { dispatched: false, dryRun: false, error: errMsg };
  }

  try {
    await alertRef.set(
      {
        sentLineAt: admin.firestore.FieldValue.serverTimestamp(),
        lineSendError: admin.firestore.FieldValue.delete(),
        lineLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        sentLineRunId: options.runId || null,
      },
      { merge: true },
    );
  } catch (err) {
    functions.logger.error(
      '[conditionAlertsCron] alert patch (line success) failed',
      { alertId, message: err?.message },
    );
  }

  return { dispatched: true, dryRun: false };
}

/**
 * processConditionAlertsQueue — 每小時 fanout cron worker。
 *
 * Flow:
 *   1. collectionGroup query advisors/​*​/conditionAlerts where status == 'pending'、
 *      limit COND_QUEUE_BATCH_LIMIT
 *      (Firestore 不支援 OR — 撈 status='pending'、JS 端再過濾 need_email / need_line)
 *   2. 對每筆 alert 載入 advisor envelope、call _condQueueSendEmail / _condQueueSendLine
 *   3. helper 內已負責 sentEmailAt / sentLineAt 寫回 (idempotent guard)
 *   4. 寫 cron_runs/{runId} 結果 doc + audit log
 *   5. errors > COND_QUEUE_ALERT_THRESHOLD → 寫 admin/alerts/cron_failure
 *
 * 設計鐵則：
 *   - 單筆 try/catch 包死、不 throw、batch 不被卡
 *   - 重跑安全 (idempotent) — helper 內 sentEmailAt / sentLineAt guard 防雙寄
 *   - runId 用 callback 內 Date.now()、不用 schedule 時刻
 *   - 超過 200 件 alert → 下次 cron 繼續 (不一次掃完)
 *   - 兩 channel 都 sent → 順手把 alert.status 設為 'sent' (清 queue)
 */
exports.processConditionAlertsQueue = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .pubsub.schedule('every 1 hours')
  .timeZone('Asia/Taipei')
  .onRun(async (_context) => {
    // --- Runtime stamps (HARD rule: callback 內取) ---
    const ranAtMs = Date.now();
    const ranAtDate = new Date(ranAtMs);
    const yyyymm =
      ranAtDate.getUTCFullYear().toString() +
      String(ranAtDate.getUTCMonth() + 1).padStart(2, '0');
    const runId =
      `queue_${ranAtMs}_${crypto.randomBytes(4).toString('hex')}`;

    functions.logger.info('[conditionAlertsCron] start', { runId });

    // --- Query pending alerts ---
    /** @type {FirebaseFirestore.QueryDocumentSnapshot[]} */
    let alertDocs = [];
    try {
      const snap = await db
        .collectionGroup('conditionAlerts')
        .where('status', '==', 'pending')
        .limit(COND_QUEUE_BATCH_LIMIT)
        .get();
      alertDocs = snap.docs;
    } catch (err) {
      functions.logger.error('[conditionAlertsCron] query failed', {
        runId,
        message: err?.message,
      });
      // 寫 cron_runs 失敗紀錄、不 throw (避免 cron 自動重試打亂節奏)
      try {
        await db
          .collection('cron_runs')
          .doc(runId)
          .set({
            runId,
            type: COND_QUEUE_AUDIT_TYPE,
            ranAt: admin.firestore.FieldValue.serverTimestamp(),
            ranAtMs,
            processedCount: 0,
            sentEmailCount: 0,
            sentLineCount: 0,
            errors: [
              {
                stage: 'query',
                message: String(err?.message || err).slice(0, 300),
              },
            ],
            status: 'query_failed',
            schemaVersion: 1,
          });
      } catch (writeErr) {
        functions.logger.error('[conditionAlertsCron] cron_runs write failed', {
          runId,
          message: writeErr?.message,
        });
      }
      return null;
    }

    // --- Per-alert dispatch loop ---
    let processedCount = 0;
    let sentEmailCount = 0;
    let sentLineCount = 0;
    let dryRunEmailCount = 0;
    let dryRunLineCount = 0;
    /** @type {Array<{ alertId: string, advisorUid: string|null, stage: string, message: string }>} */
    const errors = [];
    // advisor envelope cache — 同 advisor 多 alert chunk 不重複讀 users doc
    const advisorEnvelopeCache = new Map();

    for (const docSnap of alertDocs) {
      processedCount += 1;
      const alertId = docSnap.id;
      const alertData = docSnap.data() || {};

      // path: advisors/{advisorUid}/conditionAlerts/{alertId}
      const pathParts = docSnap.ref.path.split('/');
      const advisorUid =
        pathParts.length >= 4 && pathParts[0] === 'advisors' ? pathParts[1] : null;
      if (!advisorUid) {
        errors.push({
          alertId,
          advisorUid: null,
          stage: 'parse_path',
          message: `unexpected path: ${docSnap.ref.path}`,
        });
        continue;
      }

      // 需要 dispatch 哪些 channel？已有 sent timestamp 就 skip 該 channel。
      const needEmail = !alertData.sentEmailAt;
      const needLine = !alertData.sentLineAt;
      if (!needEmail && !needLine) {
        // 兩邊都已送、status 還沒翻 — 順手 patch status (不影響其他 ops)
        try {
          await docSnap.ref.set({ status: 'sent' }, { merge: true });
        } catch (err) {
          functions.logger.warn('[conditionAlertsCron] status patch failed', {
            runId,
            alertId,
            message: err?.message,
          });
        }
        continue;
      }

      // --- Load advisor envelope (cached) ---
      let advisorEnvelope = advisorEnvelopeCache.get(advisorUid);
      if (advisorEnvelope === undefined) {
        advisorEnvelope = await _condQueueReadAdvisorEnvelope(advisorUid);
        advisorEnvelopeCache.set(advisorUid, advisorEnvelope);
      }
      if (!advisorEnvelope) {
        errors.push({
          alertId,
          advisorUid,
          stage: 'load_advisor',
          message: 'advisor doc not found or unreadable',
        });
        continue;
      }

      // --- Email dispatch ---
      let emailHadError = false;
      if (needEmail) {
        try {
          const emailRes = await _condQueueSendEmail(
            docSnap.ref,
            alertData,
            advisorEnvelope,
            { isDryRun: false, runId },
          );
          if (emailRes.dispatched) {
            sentEmailCount += 1;
          } else if (emailRes.dryRun) {
            dryRunEmailCount += 1;
          } else if (emailRes.error) {
            emailHadError = true;
            errors.push({
              alertId,
              advisorUid,
              stage: 'email_dispatch',
              message: emailRes.error,
            });
          } else if (emailRes.skipped) {
            functions.logger.info('[conditionAlertsCron] email skipped', {
              runId,
              alertId,
              advisorUid,
              reason: emailRes.skipped,
            });
          }
        } catch (err) {
          // helper 內已 try/catch、走到這代表非預期 throw (e.g. require 失敗)
          emailHadError = true;
          errors.push({
            alertId,
            advisorUid,
            stage: 'email_unexpected',
            message: String(err?.message || err).slice(0, 200),
          });
        }
      }

      // --- LINE dispatch ---
      let lineHadError = false;
      if (needLine) {
        try {
          const lineRes = await _condQueueSendLine(
            docSnap.ref,
            alertData,
            advisorEnvelope,
            { isDryRun: false, runId, throwOnMissingToken: false },
          );
          if (lineRes.dispatched) {
            sentLineCount += 1;
          } else if (lineRes.dryRun) {
            dryRunLineCount += 1;
          } else if (lineRes.error) {
            lineHadError = true;
            errors.push({
              alertId,
              advisorUid,
              stage: 'line_dispatch',
              message: lineRes.error,
            });
          } else if (lineRes.skipped) {
            functions.logger.info('[conditionAlertsCron] line skipped', {
              runId,
              alertId,
              advisorUid,
              reason: lineRes.skipped,
            });
          }
        } catch (err) {
          lineHadError = true;
          errors.push({
            alertId,
            advisorUid,
            stage: 'line_unexpected',
            message: String(err?.message || err).slice(0, 200),
          });
        }
      }

      // --- Per-alert audit log ---
      // 不阻塞 batch；單筆 audit fail 也只 log。Audit 不含 PII。
      try {
        const auditEventId =
          `${COND_QUEUE_AUDIT_TYPE}_alert_${ranAtMs}_${alertId.slice(0, 16)}_` +
          crypto.randomBytes(3).toString('hex');
        await db
          .collection('audit_logs')
          .doc(yyyymm)
          .collection('events')
          .doc(auditEventId)
          .set({
            type: `${COND_QUEUE_AUDIT_TYPE}_alert`,
            advisorUid,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            timestampMs: ranAtMs,
            context: {
              runId,
              alertId,
              productId:
                typeof alertData.productId === 'string'
                  ? alertData.productId
                  : null,
              attemptedEmail: needEmail,
              attemptedLine: needLine,
            },
            result: emailHadError || lineHadError ? 'partial' : 'success',
            schemaVersion: 1,
          });
      } catch (err) {
        functions.logger.warn('[conditionAlertsCron] per-alert audit failed', {
          runId,
          alertId,
          message: err?.message,
        });
      }
    }

    // --- Write cron_runs progress doc ---
    // errors 前 20 筆樣本、避免 doc 過大 (Firestore 1MB 限額)
    const errorsSample = errors.slice(0, 20);
    try {
      await db
        .collection('cron_runs')
        .doc(runId)
        .set({
          runId,
          type: COND_QUEUE_AUDIT_TYPE,
          ranAt: admin.firestore.FieldValue.serverTimestamp(),
          ranAtMs,
          processedCount,
          sentEmailCount,
          sentLineCount,
          dryRunEmailCount,
          dryRunLineCount,
          errors: errorsSample,
          errorTotalCount: errors.length,
          batchLimit: COND_QUEUE_BATCH_LIMIT,
          hitBatchLimit: processedCount >= COND_QUEUE_BATCH_LIMIT,
          status: errors.length > 0 ? 'partial' : 'success',
          schemaVersion: 1,
        });
    } catch (err) {
      functions.logger.error('[conditionAlertsCron] cron_runs write failed', {
        runId,
        message: err?.message,
      });
    }

    // --- Batch summary audit log ---
    try {
      const auditEventId =
        `${COND_QUEUE_AUDIT_TYPE}_${ranAtMs}_` + crypto.randomBytes(4).toString('hex');
      await db
        .collection('audit_logs')
        .doc(yyyymm)
        .collection('events')
        .doc(auditEventId)
        .set({
          type: COND_QUEUE_AUDIT_TYPE,
          // System cron — no admin uid; mark synthetic actor
          advisorUid: 'system:cron',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          timestampMs: ranAtMs,
          context: {
            runId,
            processedCount,
            sentEmailCount,
            sentLineCount,
            dryRunEmailCount,
            dryRunLineCount,
            errorTotalCount: errors.length,
            hitBatchLimit: processedCount >= COND_QUEUE_BATCH_LIMIT,
          },
          result: errors.length > 0 ? 'partial' : 'success',
          schemaVersion: 1,
        });
    } catch (err) {
      functions.logger.warn('[conditionAlertsCron] batch audit failed', {
        runId,
        message: err?.message,
      });
    }

    // --- Admin alert if errors > threshold ---
    if (errors.length > COND_QUEUE_ALERT_THRESHOLD) {
      try {
        await db
          .collection('admin')
          .doc('alerts')
          .collection('cron_failure')
          .doc(runId)
          .set({
            runId,
            type: COND_QUEUE_AUDIT_TYPE,
            ranAt: admin.firestore.FieldValue.serverTimestamp(),
            ranAtMs,
            processedCount,
            errorTotalCount: errors.length,
            threshold: COND_QUEUE_ALERT_THRESHOLD,
            errorsSample,
            acknowledged: false,
            schemaVersion: 1,
          });
        functions.logger.error('[conditionAlertsCron] threshold exceeded', {
          runId,
          errorTotalCount: errors.length,
          threshold: COND_QUEUE_ALERT_THRESHOLD,
        });
      } catch (err) {
        functions.logger.error('[conditionAlertsCron] admin alert write failed', {
          runId,
          message: err?.message,
        });
      }
    }

    functions.logger.info('[conditionAlertsCron] done', {
      runId,
      processedCount,
      sentEmailCount,
      sentLineCount,
      dryRunEmailCount,
      dryRunLineCount,
      errorTotalCount: errors.length,
    });

    return null;
  });

// ==========================================
// Sprint 15 W3 — approveQuotaExtension (Task B5)
// ==========================================
//
// Admin 審核 quota_extension_requests 入口（Sprint 14 W2 顧問端 form 已寫入）。
// 流程：
//   1. admin 從 /admin/quota-extension-requests 看 pending list
//   2. 點 Approve / Reject
//   3. 此 callable 處理：
//      - approve → 增加 advisors/{requesterUid}/quotaUsage/{yyyymm} 的 limit
//        (asks +50 / pdfViews +25 預設、可 admin 客製 extensionAmount)
//      - reject → 不動 quotaUsage、寫 reason
//      - 任一 path 都 notify requester via Resend email + 寫 audit_logs
//
// 鐵則：
//   - 不引入新 npm dep（Resend 走既有 axios pattern、Sprint 11 sendLifecycleEmail 已用）
//   - 所有「現在時間」runtime callback 內取（HARD rule、Sprint 12 onwards）
//   - 重複決定守門：status != 'pending' → throw 'already-decided'（防 admin race）
//   - email 內文不含 PII：只說「您的配額延伸申請」+ 增加額度數字 + 月份
//   - audit log type: 'quota_extension_decided'、走 Sprint 14 W3 audit_logs/{yyyymm}/events shape
//   - extensionAmount.asks / pdfViews：admin 沒填則用預設（asks +50 / pdfViews +25）
//   - yyyymm 用 request.targetYyyymm（顧問當初送 form 時記錄的本地時區月份）；
//     缺值就 fall back 用 callback 內 UTC 推算（與 logAuditEvent 一致）

const QUOTA_EXTENSION_DEFAULTS = {
  asks: 50,
  pdfViews: 25,
};

const QUOTA_EXTENSION_MAX = {
  asks: 500,
  pdfViews: 250,
};

/**
 * Resend 寄通知 — 不含 PII，只說明配額決定 + 月份 + 增量。
 * 與 sendLifecycleEmail 同樣 DRY-RUN 安全（RESEND_API_KEY 未設則 logger.info）。
 */
async function sendQuotaExtensionDecisionEmail({ toEmail, decision, yyyymm, extensionAmount, reason }) {
  if (!toEmail || typeof toEmail !== 'string') {
    return { dryRun: false, sent: false, error: 'no_recipient' };
  }
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM = 'Ultra Advisor <hello@ultra-advisor.tw>';

  const monthLabel = `${yyyymm.slice(0, 4)} 年 ${yyyymm.slice(4)} 月`;
  const subject =
    decision === 'approve'
      ? `[Ultra Advisor] 您的配額延伸申請已通過 (${monthLabel})`
      : `[Ultra Advisor] 您的配額延伸申請審核結果 (${monthLabel})`;

  const lines =
    decision === 'approve'
      ? [
          '您好，',
          '',
          `您於 ${monthLabel} 提出的配額延伸申請已通過。`,
          '',
          '本月已為您增加：',
          `  • AI 條款問答：+${extensionAmount.asks} 次`,
          `  • 條款 PDF 檢視：+${extensionAmount.pdfViews} 次`,
          '',
          '請登入 Ultra Advisor 即可繼續使用。',
          '',
          '— Ultra Advisor 團隊',
        ]
      : [
          '您好，',
          '',
          `您於 ${monthLabel} 提出的配額延伸申請未通過本次審核。`,
          '',
          reason ? `審核備註：${reason}` : '如有疑問請與我們聯繫：support@ultralab.tw',
          '',
          '— Ultra Advisor 團隊',
        ];

  const text = lines.join('\n');
  const html = `<div style="font-family:sans-serif;line-height:1.6;color:#1f2937">${lines
    .map((l) => (l === '' ? '<br/>' : `<p style="margin:0 0 4px 0">${l.replace(/</g, '&lt;')}</p>`))
    .join('')}</div>`;

  if (!RESEND_API_KEY) {
    functions.logger.info('[quotaExtension] email DRY-RUN (RESEND_API_KEY unset)', {
      to: toEmail,
      decision,
      yyyymm,
    });
    return { dryRun: true, sent: false };
  }
  try {
    await axios.post(
      'https://api.resend.com/emails',
      {
        from: FROM,
        to: toEmail,
        subject,
        html,
        text,
        headers: {
          'X-Entity-Ref-ID': `quota-ext-${decision}-${Date.now()}`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      },
    );
    functions.logger.info('[quotaExtension] email sent', { to: toEmail, decision });
    return { dryRun: false, sent: true };
  } catch (err) {
    functions.logger.error('[quotaExtension] resend error', {
      to: toEmail,
      decision,
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    return { dryRun: false, sent: false, error: err.message };
  }
}

/**
 * Sprint 15 W3 — approveQuotaExtension callable.
 *
 * Input:
 *   { requestId, decision: 'approve'|'reject',
 *     extensionAmount?: { asks?, pdfViews? },  // approve 才看
 *     reason?: string }                         // reject 必填、approve 選填
 *
 * Output:
 *   { ok, requestId, decision, extensionAmount?, yyyymm,
 *     emailDispatched: { dryRun, sent, error? } }
 */
exports.approveQuotaExtension = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    // --- Auth + admin gate ---
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }
    const isUserAdmin = await isAdmin(context.auth.uid);
    if (!isUserAdmin) {
      throw new functions.https.HttpsError('permission-denied', '無管理員權限');
    }
    const adminUid = context.auth.uid;

    // --- Input validation ---
    const requestId = typeof data?.requestId === 'string' ? data.requestId.trim() : '';
    if (!requestId || !/^[A-Za-z0-9_-]{1,80}$/.test(requestId)) {
      throw new functions.https.HttpsError('invalid-argument', 'requestId 格式不符');
    }
    const decision = data?.decision;
    if (decision !== 'approve' && decision !== 'reject') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        "decision 必須為 'approve' 或 'reject'",
      );
    }
    const reason =
      typeof data?.reason === 'string' ? data.reason.trim().slice(0, 500) : '';
    if (decision === 'reject' && !reason) {
      throw new functions.https.HttpsError('invalid-argument', '退回需附理由 (reason)');
    }

    // approve 才解析 extensionAmount、reject 一律忽略
    const extensionAmount = { ...QUOTA_EXTENSION_DEFAULTS };
    if (decision === 'approve') {
      const ea = data?.extensionAmount;
      if (ea && typeof ea === 'object') {
        if (ea.asks !== undefined) {
          const n = Number(ea.asks);
          if (!Number.isFinite(n) || n <= 0) {
            throw new functions.https.HttpsError('invalid-argument', 'extensionAmount.asks 必須 > 0');
          }
          extensionAmount.asks = Math.min(QUOTA_EXTENSION_MAX.asks, Math.floor(n));
        }
        if (ea.pdfViews !== undefined) {
          const n = Number(ea.pdfViews);
          if (!Number.isFinite(n) || n <= 0) {
            throw new functions.https.HttpsError('invalid-argument', 'extensionAmount.pdfViews 必須 > 0');
          }
          extensionAmount.pdfViews = Math.min(QUOTA_EXTENSION_MAX.pdfViews, Math.floor(n));
        }
      }
    }

    // runtime ts 在 callback 內取 (HARD rule)
    const callbackStartedAtMs = Date.now();
    const callbackStartedAt = new Date(callbackStartedAtMs);
    const fallbackYyyymm =
      callbackStartedAt.getUTCFullYear().toString() +
      String(callbackStartedAt.getUTCMonth() + 1).padStart(2, '0');

    // --- Read request doc ---
    const requestRef = db.collection('quota_extension_requests').doc(requestId);
    let requestSnap;
    try {
      requestSnap = await requestRef.get();
    } catch (err) {
      functions.logger.error('[approveQuotaExtension] read failed', {
        requestId,
        message: err?.message,
      });
      throw new functions.https.HttpsError('internal', '讀取申請紀錄失敗');
    }
    if (!requestSnap.exists) {
      throw new functions.https.HttpsError('not-found', '找不到該申請紀錄');
    }
    const request = requestSnap.data() || {};
    if (request.status && request.status !== 'pending') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'already-decided',
      );
    }
    const requesterUid =
      typeof request.requesterUid === 'string' ? request.requesterUid : '';
    if (!requesterUid) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        '申請紀錄缺 requesterUid',
      );
    }
    // 顧問端送 form 時用顧問本地時區算的 yyyymm；缺值才回退 UTC 推算
    const yyyymm =
      typeof request.targetYyyymm === 'string' && /^\d{6}$/.test(request.targetYyyymm)
        ? request.targetYyyymm
        : fallbackYyyymm;

    // --- approve path: 寫 quotaUsage limit + 標記 request ---
    if (decision === 'approve') {
      const quotaRef = db.doc(`advisors/${requesterUid}/quotaUsage/${yyyymm}`);
      try {
        await db.runTransaction(async (tx) => {
          const cur = await tx.get(quotaRef);
          const data0 = cur.exists ? cur.data() || {} : {};

          // 既有結構：欄位可能是 number（used count）或 { used, limit } object（Sprint 14 W3 後）。
          // 一律 normalize 成 object。
          const normalize = (raw, defaultLimit) => {
            if (raw && typeof raw === 'object') {
              return {
                used: Number(raw.used || 0),
                limit: Number(raw.limit || defaultLimit),
              };
            }
            return { used: Number(raw || 0), limit: defaultLimit };
          };
          const asksCur = normalize(data0.asks, 100);
          const pdfCur = normalize(data0.pdfViews, 50);
          const mpsCur = normalize(data0.missingProductSubmits, 30);

          tx.set(
            quotaRef,
            {
              asks: { used: asksCur.used, limit: asksCur.limit + extensionAmount.asks },
              pdfViews: { used: pdfCur.used, limit: pdfCur.limit + extensionAmount.pdfViews },
              missingProductSubmits: { used: mpsCur.used, limit: mpsCur.limit },
              lastExtendedAt: admin.firestore.FieldValue.serverTimestamp(),
              lastExtendedByRequestId: requestId,
            },
            { merge: true },
          );

          tx.set(
            requestRef,
            {
              status: 'approved',
              approvedBy: adminUid,
              approvedAt: admin.firestore.FieldValue.serverTimestamp(),
              approvedAtMs: callbackStartedAtMs,
              extensionAmount,
              targetYyyymm: yyyymm,
              reason: reason || null,
            },
            { merge: true },
          );
        });
      } catch (err) {
        functions.logger.error('[approveQuotaExtension] approve tx failed', {
          requestId,
          requesterUid,
          message: err?.message,
        });
        throw new functions.https.HttpsError('internal', '審核寫入失敗');
      }
    } else {
      // reject path
      try {
        await requestRef.set(
          {
            status: 'rejected',
            rejectedBy: adminUid,
            rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
            rejectedAtMs: callbackStartedAtMs,
            reason,
            targetYyyymm: yyyymm,
          },
          { merge: true },
        );
      } catch (err) {
        functions.logger.error('[approveQuotaExtension] reject write failed', {
          requestId,
          message: err?.message,
        });
        throw new functions.https.HttpsError('internal', '退回寫入失敗');
      }
    }

    // --- Resolve requester email（不寫進 audit context；只用來寄信）---
    let requesterEmail =
      typeof request.requesterEmail === 'string' ? request.requesterEmail : '';
    if (!requesterEmail) {
      try {
        const userSnap = await db.collection('users').doc(requesterUid).get();
        if (userSnap.exists) {
          requesterEmail = userSnap.data()?.email || '';
        }
      } catch (err) {
        functions.logger.warn('[approveQuotaExtension] requester email lookup failed', {
          requestId,
          message: err?.message,
        });
      }
    }

    // --- Email 通知 ---
    const emailDispatched = await sendQuotaExtensionDecisionEmail({
      toEmail: requesterEmail,
      decision,
      yyyymm,
      extensionAmount,
      reason,
    });

    // --- Audit log (audit_logs/{yyyymm}/events/{eventId}) ---
    // 用 callback runtime 推 yyyymm（與 logAuditEvent 一致）、不用 quotaUsage 的 targetYyyymm
    try {
      const auditNowMs = callbackStartedAtMs;
      const auditDate = new Date(auditNowMs);
      const auditYyyymm =
        auditDate.getUTCFullYear().toString() +
        String(auditDate.getUTCMonth() + 1).padStart(2, '0');
      const randSuffix = crypto.randomBytes(4).toString('hex');
      const eventId = `quota_extension_decided_${auditNowMs}_${adminUid}_${randSuffix}`;
      await db
        .collection('audit_logs')
        .doc(auditYyyymm)
        .collection('events')
        .doc(eventId)
        .set({
          type: 'quota_extension_decided',
          advisorUid: adminUid,
          advisorEmail: context.auth.token?.email || null,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          timestampMs: auditNowMs,
          context: {
            requestId,
            requesterUid,
            decision,
            targetYyyymm: yyyymm,
            extensionAmount: decision === 'approve' ? extensionAmount : null,
            reasonProvided: Boolean(reason),
            emailDispatched: {
              dryRun: emailDispatched.dryRun,
              sent: emailDispatched.sent,
              error: emailDispatched.error || null,
            },
          },
          result: 'success',
          schemaVersion: 1,
        });
    } catch (err) {
      // audit 失敗不該 fail 整個 callable — 決定已 commit
      functions.logger.warn('[approveQuotaExtension] audit write failed', {
        requestId,
        message: err?.message,
      });
    }

    return {
      ok: true,
      requestId,
      decision,
      extensionAmount: decision === 'approve' ? extensionAmount : null,
      yyyymm,
      emailDispatched,
    };
  });

// ==========================================
// Sprint 17 W1 — Task B3: compareProductConditions callable
// ==========================================
//
// 兩商品條款重點對比 — 顧問端 ProductCompareView 「條款重點對照」tab 觸發。
// 流程：
//   1. fetch A / B 兩商品的 chunks (reuse Sprint 14 W2 _diffFetchChunks helper)
//   2. 任一邊 chunks < 5 → fallback「商品 X 條款尚未索引、無法比對」
//   3. Gemini 2.5 Pro 結構化輸出 → { summary, differences[], overlap, recommendation: null }
//   4. 答案結尾強制附 disclaimer「AI 解讀僅供參考、實際以保單條款為準」
//   5. 寫 audit_logs type='compare_product_conditions'
//
// 鐵則：
//   - 不引入新 dep（reuse @google/generative-ai + 既有 _diff* helpers）
//   - 配額計入 advisors/{uid}/quotaUsage/{yyyymm}.asks（與 /api/ask 共用 ask quota）
//   - UA 絕不給商品推薦：recommendation 在 normalise 時強制 null
//   - 所有 wall-clock 必 callback 內取（與 composeConditionDiffSummary 一致）
//   - 不寫客戶 PII（本 callable 完全不碰 users/*/clients、無 PII 路徑）

const COMPARE_DEFAULT_MAX_CHUNKS = 15;
const COMPARE_MIN_CHUNKS = 5;                   // 任一邊 < 此值 → fallback
const COMPARE_MAX_MAX_CHUNKS = 30;              // input cap 防 caller 灌爆 prompt
const COMPARE_LLM_RETRY_DELAY_MS = 1500;
const COMPARE_ASK_QUOTA_LIMIT = 100;            // 與 api/ask.ts MONTHLY_QUOTA_ASKS 對齊
const COMPARE_DISCLAIMER = 'AI 解讀僅供參考、實際以保單條款為準';
const COMPARE_VALID_CATEGORIES = new Set([
  '等待期',
  '除外責任',
  '給付項目',
  '金額限額',
  '其他',
]);
const COMPARE_VALID_IMPACT = new Set(['high', 'medium', 'low']);

const COMPARE_PROMPT_TEMPLATE = `你是 Ultra Advisor 保險條款分析助手。請對比以下兩商品條款重點、用結構化方式輸出差異。

規則:
1. 用顧問能理解的話 (避免法律術語)
2. 每項差異標 category (等待期 / 除外責任 / 給付項目 / 金額限額 / 其他)
3. 評估每項差異對保戶的 impact (high / medium / low)
4. 列 3-6 項最值得注意的差異、並列共同重點 overlap
5. 不模擬法律建議、不給商品推薦、不指定哪張較好
6. 不確定時必說「我不確定、請查條款原文」
7. 結尾必須附上免責聲明:「${COMPARE_DISCLAIMER}」

【商品 A 條款片段】
{a_chunks}

【商品 B 條款片段】
{b_chunks}

請輸出 JSON (純 JSON、不要 markdown code block)：
{
  "summary": "100-200 字總結兩商品條款主要差異",
  "differences": [
    {
      "category": "等待期|除外責任|給付項目|金額限額|其他",
      "aValue": "商品 A 在此項的規格",
      "bValue": "商品 B 在此項的規格",
      "impact": "high|medium|low",
      "notes": "對保戶的影響說明、50 字內"
    }
  ],
  "overlap": "兩商品共同重點 50-100 字"
}`;

/** Normalise + validate the raw LLM JSON into the compare contract shape.
 *  recommendation 強制 null — UA 絕不給商品推薦。 */
function _compareNormaliseResponse(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const summary =
    typeof raw.summary === 'string' && raw.summary.trim().length > 0
      ? raw.summary.trim().slice(0, 600)
      : null;
  if (!summary) return null;

  const diffsIn = Array.isArray(raw.differences) ? raw.differences : [];
  const differences = diffsIn
    .slice(0, 10) // hard cap, prompt asks for 3-6
    .map((d) => {
      if (!d || typeof d !== 'object') return null;
      const category = COMPARE_VALID_CATEGORIES.has(d.category) ? d.category : '其他';
      const aValue =
        typeof d.aValue === 'string' && d.aValue.trim().length > 0
          ? d.aValue.trim().slice(0, 200)
          : null;
      const bValue =
        typeof d.bValue === 'string' && d.bValue.trim().length > 0
          ? d.bValue.trim().slice(0, 200)
          : null;
      if (!aValue && !bValue) return null;
      const impact = COMPARE_VALID_IMPACT.has(d.impact) ? d.impact : 'medium';
      const notes =
        typeof d.notes === 'string' && d.notes.trim().length > 0
          ? d.notes.trim().slice(0, 200)
          : '';
      return {
        category,
        aValue: aValue || '—',
        bValue: bValue || '—',
        impact,
        notes,
      };
    })
    .filter(Boolean);

  const overlap =
    typeof raw.overlap === 'string' && raw.overlap.trim().length > 0
      ? raw.overlap.trim().slice(0, 400)
      : '';

  return {
    summary,
    differences,
    overlap,
    recommendation: null, // HARD: UA 絕不給商品推薦
  };
}

/** Build a fallback compare payload when chunks insufficient / LLM fails. */
function _compareFallback(reason, missingSide) {
  const summaryByReason = {
    insufficient_chunks_a: '商品 A 條款尚未索引、無法比對。請先確認商品條款 PDF 已上架。',
    insufficient_chunks_b: '商品 B 條款尚未索引、無法比對。請先確認商品條款 PDF 已上架。',
    insufficient_chunks_both: '兩商品條款均尚未索引、無法比對。請先確認商品條款 PDF 已上架。',
    llm_failed: '比對失敗、請手動查兩商品條款',
    parse_failed: 'AI 回應格式無法解析、請手動比對兩商品條款',
  };
  return {
    summary: summaryByReason[reason] || '比對失敗、請手動查兩商品條款',
    differences: [],
    overlap: '',
    recommendation: null,
    fallback: true,
    fallbackReason: reason,
    fallbackSide: missingSide || null,
  };
}

/** Write a compare_product_conditions audit log doc (best-effort). */
async function _compareWriteAudit(uid, payload) {
  try {
    const nowMs = Date.now();
    const nowDate = new Date(nowMs);
    const yyyymm =
      nowDate.getUTCFullYear().toString() +
      String(nowDate.getUTCMonth() + 1).padStart(2, '0');
    const rand = crypto.randomBytes(4).toString('hex');
    const eventId = `compare_product_conditions_${nowMs}_${uid}_${rand}`;
    await db
      .collection('audit_logs')
      .doc(yyyymm)
      .collection('events')
      .doc(eventId)
      .set({
        type: 'compare_product_conditions',
        advisorUid: uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        timestampMs: nowMs,
        context: payload.context || {},
        result: payload.result || 'success',
        schemaVersion: 1,
      });
  } catch (err) {
    functions.logger.warn('[compare_product_conditions] audit write failed', {
      message: err?.message,
    });
  }
}

/** Atomic ask-quota check + bump (shared with /api/ask, advisors/{uid}/quotaUsage). */
async function _compareEnforceAskQuota(uid, callbackStartedAtMs) {
  // yyyymm 用 callback runtime 取（HARD rule）
  const date = new Date(callbackStartedAtMs);
  const yyyymm =
    date.getUTCFullYear().toString() +
    String(date.getUTCMonth() + 1).padStart(2, '0');
  const ref = db.doc(`advisors/${uid}/quotaUsage/${yyyymm}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = snap.exists ? Number(snap.data().asks || 0) : 0;
    if (used >= COMPARE_ASK_QUOTA_LIMIT) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `本月 ask 配額 ${COMPARE_ASK_QUOTA_LIMIT} 已用完、請申請配額延展`,
      );
    }
    tx.set(
      ref,
      {
        asks: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
  return { yyyymm };
}

exports.compareProductConditions = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data, context) => {
    // --- Auth gate ---
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', '請先登入');
    }
    const uid = context.auth.uid;

    // --- Input validation ---
    const productIdA =
      typeof data?.productIdA === 'string' ? data.productIdA.trim() : '';
    const productIdB =
      typeof data?.productIdB === 'string' ? data.productIdB.trim() : '';

    if (!productIdA || !/^[A-Za-z0-9_-]{1,80}$/.test(productIdA)) {
      throw new functions.https.HttpsError('invalid-argument', 'productIdA 格式不符');
    }
    if (!productIdB || !/^[A-Za-z0-9_-]{1,80}$/.test(productIdB)) {
      throw new functions.https.HttpsError('invalid-argument', 'productIdB 格式不符');
    }
    if (productIdA === productIdB) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'productIdA 與 productIdB 不可相同',
      );
    }

    const maxChunksRaw = Number(data?.maxChunksPerProduct) || COMPARE_DEFAULT_MAX_CHUNKS;
    const maxChunks = Math.max(
      COMPARE_MIN_CHUNKS,
      Math.min(COMPARE_MAX_MAX_CHUNKS, maxChunksRaw),
    );

    // runtime ts in callback (HARD rule)
    const callbackStartedAtMs = Date.now();

    // --- Quota gate (counts against shared ask quota) ---
    let quotaCtx;
    try {
      quotaCtx = await _compareEnforceAskQuota(uid, callbackStartedAtMs);
    } catch (err) {
      // resource-exhausted bubbles up as-is
      if (err instanceof functions.https.HttpsError) throw err;
      functions.logger.error('[compare_product_conditions] quota tx failed', {
        uid,
        message: err?.message,
      });
      throw new functions.https.HttpsError('internal', '配額查詢失敗、請稍後重試');
    }

    // --- Step 1: fetch chunks for both products ---
    // Reuse Sprint 14 W2 _diffFetchChunks — version 'v1' is the default flat-layout
    // path covering Sprint 14 catalog ingest.
    let aFetch;
    let bFetch;
    try {
      [aFetch, bFetch] = await Promise.all([
        _diffFetchChunks(productIdA, 'v1', maxChunks),
        _diffFetchChunks(productIdB, 'v1', maxChunks),
      ]);
    } catch (err) {
      functions.logger.error('[compare_product_conditions] chunk fetch failed', {
        productIdA,
        productIdB,
        message: err?.message,
      });
      throw new functions.https.HttpsError(
        'internal',
        `chunks 讀取失敗: ${err?.message || err}`,
      );
    }

    const aShort = aFetch.chunks.length < COMPARE_MIN_CHUNKS;
    const bShort = bFetch.chunks.length < COMPARE_MIN_CHUNKS;
    if (aShort || bShort) {
      const reason =
        aShort && bShort
          ? 'insufficient_chunks_both'
          : aShort
            ? 'insufficient_chunks_a'
            : 'insufficient_chunks_b';
      const missingSide = aShort && bShort ? 'both' : aShort ? 'A' : 'B';
      const fallback = _compareFallback(reason, missingSide);
      await _compareWriteAudit(uid, {
        context: {
          productIdA,
          productIdB,
          maxChunks,
          fallbackReason: reason,
          aChunks: aFetch.chunks.length,
          bChunks: bFetch.chunks.length,
          callbackStartedAtMs,
          quotaYyyymm: quotaCtx.yyyymm,
        },
        result: 'fallback',
      });
      return {
        summary: fallback.summary,
        differences: fallback.differences,
        overlap: fallback.overlap,
        recommendation: null,
        disclaimers: [COMPARE_DISCLAIMER],
        tokensUsed: 0,
        fallback: true,
        fallbackReason: fallback.fallbackReason,
        fallbackSide: fallback.fallbackSide,
      };
    }

    // --- Step 2: build prompt + call Gemini 2.5 Pro w/ 1 retry ---
    const { oldText: aText, newText: bText } = _diffBuildPromptChunks(
      aFetch.chunks,
      bFetch.chunks,
    );
    const prompt = COMPARE_PROMPT_TEMPLATE
      .replace('{a_chunks}', aText)
      .replace('{b_chunks}', bText);

    const geminiApiKey = functions.config().gemini?.api_key;
    if (!geminiApiKey) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Gemini API key 未設定',
      );
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    let responseText = null;
    let tokensUsed = 0;
    let lastErr = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        const usage = result.response?.usageMetadata || {};
        tokensUsed =
          Number(usage.totalTokenCount) ||
          Number(usage.candidatesTokenCount || 0) +
            Number(usage.promptTokenCount || 0) ||
          0;
        break;
      } catch (err) {
        lastErr = err;
        const status = err?.status || err?.code;
        const retriable = status === 503 || status === 429 || status === 500;
        functions.logger.warn('[compare_product_conditions] gemini call failed', {
          attempt,
          status,
          retriable,
          message: err?.message,
        });
        if (!retriable || attempt === 2) break;
        await _diffSleep(COMPARE_LLM_RETRY_DELAY_MS);
      }
    }

    // LLM hard fail → fallback
    if (responseText === null) {
      const fallback = _compareFallback('llm_failed');
      await _compareWriteAudit(uid, {
        context: {
          productIdA,
          productIdB,
          maxChunks,
          fallbackReason: 'llm_failed',
          llmError: String(lastErr?.message || lastErr || '').slice(0, 300),
          callbackStartedAtMs,
          quotaYyyymm: quotaCtx.yyyymm,
        },
        result: 'llm_failed',
      });
      return {
        summary: fallback.summary,
        differences: fallback.differences,
        overlap: fallback.overlap,
        recommendation: null,
        disclaimers: [COMPARE_DISCLAIMER],
        tokensUsed: 0,
        fallback: true,
        fallbackReason: fallback.fallbackReason,
        fallbackSide: null,
      };
    }

    // --- Step 3: parse + normalise ---
    const rawJson = _diffExtractJson(responseText);
    const normalised = _compareNormaliseResponse(rawJson);
    if (!normalised) {
      const fallback = _compareFallback('parse_failed');
      await _compareWriteAudit(uid, {
        context: {
          productIdA,
          productIdB,
          maxChunks,
          fallbackReason: 'parse_failed',
          responsePreview: String(responseText).slice(0, 200),
          callbackStartedAtMs,
          quotaYyyymm: quotaCtx.yyyymm,
        },
        result: 'parse_failed',
      });
      return {
        summary: fallback.summary,
        differences: fallback.differences,
        overlap: fallback.overlap,
        recommendation: null,
        disclaimers: [COMPARE_DISCLAIMER],
        tokensUsed,
        fallback: true,
        fallbackReason: fallback.fallbackReason,
        fallbackSide: null,
      };
    }

    // --- Step 4: force-append disclaimer if LLM 忘了 ---
    let finalSummary = normalised.summary;
    if (!finalSummary.includes(COMPARE_DISCLAIMER)) {
      finalSummary = `${finalSummary}\n\n${COMPARE_DISCLAIMER}`;
    }

    // --- Step 5: audit + return ---
    await _compareWriteAudit(uid, {
      context: {
        productIdA,
        productIdB,
        maxChunks,
        aChunks: aFetch.chunks.length,
        bChunks: bFetch.chunks.length,
        tokensUsed,
        differenceCount: normalised.differences.length,
        callbackStartedAtMs,
        quotaYyyymm: quotaCtx.yyyymm,
      },
      result: 'success',
    });

    return {
      summary: finalSummary,
      differences: normalised.differences,
      overlap: normalised.overlap,
      recommendation: null, // HARD: UA 絕不給商品推薦
      disclaimers: [COMPARE_DISCLAIMER],
      tokensUsed,
      fallback: false,
      fallbackSide: null,
    };
  });

// ==========================================
// Sprint 17 W1 — Task B1: metricsAggregationDaily scheduled
// ==========================================
//
// 每天 02:00 Asia/Taipei 跑、彙總前一日各 collection stats、寫進
// `metrics_daily/{yyyymmdd}` doc。前端 src/admin/MetricsDashboard.tsx
// 直接 query 此 collection、19 個 KPI 卡片從這份預聚合 doc 拉值，
// 完全不掃原始 collection (Sprint 16 boundary：browser 不能掃 audit_logs)。
//
// Schema (flat 對齊 MetricsDashboard.tsx `MetricsDaily` interface)：
//   yyyymmdd: string                 // 昨日 (TW timezone)
//   dau / mau                        // 活躍顧問
//   ocrPerActive / ragPerActive / pdfPerActive  // 30d 人均
//   quotaRequestsNew                 // quota_extension_requests 新增
//   apiAskP95Ms / apiPdfProxyP95Ms   // /api/ask · /api/pdf-proxy 延遲 (avg, see note)
//   geminiCostUsdMonth               // 本月累計 Gemini USD
//   firestoreReadsDay                // 估算 (近似)
//   firestoreWritesDay / firestoreStorageGb
//   tiiCronSuccessRate               // 近 12 個月 (0..1)
//   conditionAlertSlaHours           // detect→contact p50 (median, hours)
//   catalogTotal / catalogAddedMonth / catalogRevisedMonth / catalogDelistedMonth
//   reviewQueuePending / crowdSubsNew
//   diffSeverity: { low, med, high, critical }
//   freeToPaidRate / reportsGeneratedMonth / customerTouchRate / advisorNps
//   advisorTotalRegistered (extra)   // 非 Dashboard 必欄、留給 future cohort 報表
//   runId / ranAt (serverTimestamp) / schemaVersion / runtimeMs
//
// 鐵則：
//   - runtime now / yyyymmdd 全 callback 內取 (HARD)
//   - 單 KPI 失敗繼續、欄位寫 null + 紀錄 errors[]
//   - 不寫客戶 PII (數字 / 計數 / 比率 only)
//   - timeoutSeconds 540s 內收斂；read budget 估 ~30k reads/天
//   - 不引入新 dep
//   - audit_logs partition 用 UTC yyyymm (與 logAuditEvent 寫入端一致)
//
// 為什麼分區策略複雜：
//   - audit_logs 用 UTC yyyymm partition；yesterday (TW) 跨 UTC 月初時要讀兩個 partition
//   - 顧問配額窗口用 TW yyyymmdd (與 client 顯示一致)；spec 採 TW timezone
//   - tiiCrawl SLA 用 12-month rolling、跨年也要 OK
//
// 為什麼不用 Firestore aggregation .count() everywhere：
//   - .count() 對 audit_logs 在 yesterday 切片 (timestamp range) 可用、cheap
//   - 但 P95 latency / 平均延遲 需要實際讀 documents (取 tokensUsed)
//   - 折衷：count 用 aggregation、avg 用 sampled read (上限 500 docs)

const METRICS_RUN_PREFIX = 'metrics';
const METRICS_TII_LOOKBACK_MONTHS = 12;        // SLA window
const METRICS_GEMINI_USD_PER_1M_INPUT = 0.075; // Gemini 2.5 Pro
const METRICS_GEMINI_USD_PER_1M_OUTPUT = 0.30;
const METRICS_RECENT_DAYS_FOR_PER_ACTIVE = 30; // 人均口徑

/** Format Date → "yyyymmdd" in Asia/Taipei (UTC+8, no DST). */
function _metricsTwYyyymmdd(date) {
  // Shift wall clock by +8h to read TW calendar fields from UTC getters.
  const tw = new Date(date.getTime() + 8 * 3600 * 1000);
  const y = tw.getUTCFullYear();
  const m = String(tw.getUTCMonth() + 1).padStart(2, '0');
  const d = String(tw.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Format Date → "yyyymm" UTC (matches audit_logs partition key). */
function _metricsUtcYyyymm(date) {
  return (
    date.getUTCFullYear().toString() +
    String(date.getUTCMonth() + 1).padStart(2, '0')
  );
}

/** Return TW midnight of given Date as a UTC Date instance. */
function _metricsTwMidnightUtc(date) {
  const tw = new Date(date.getTime() + 8 * 3600 * 1000);
  // Zero out HH:mm:ss.SSS in TW frame, then shift back to UTC.
  const twMid = Date.UTC(
    tw.getUTCFullYear(),
    tw.getUTCMonth(),
    tw.getUTCDate(),
    0, 0, 0, 0,
  );
  return new Date(twMid - 8 * 3600 * 1000);
}

/** Compute UTC yyyymm partitions covering [startMs, endMs) — usually 1, but 2
 *  when the day crosses a UTC month boundary (rare, only on month-start
 *  TW midnight which is 16:00 prev-day UTC). */
function _metricsAuditPartitions(startMs, endMs) {
  const out = new Set();
  out.add(_metricsUtcYyyymm(new Date(startMs)));
  out.add(_metricsUtcYyyymm(new Date(endMs - 1)));
  return Array.from(out);
}

/** Median of a number array (returns null on empty). */
function _metricsMedian(values) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/** Safe wrapper: run an async KPI fn; if it throws, log + return null.
 *  Single-KPI failures must not block the whole metrics_daily doc. */
async function _metricsSafe(label, errors, fn) {
  try {
    return await fn();
  } catch (err) {
    errors.push({ kpi: label, message: String(err?.message || err).slice(0, 200) });
    functions.logger.warn(`[metricsAggregationDaily] ${label} failed`, {
      message: err?.message,
    });
    return null;
  }
}

/** Count docs in audit_logs where type == typeName + timestamp in [start, end).
 *  Walks each UTC yyyymm partition that overlaps the window. */
async function _metricsCountAuditByType(typeName, startDate, endDate) {
  const partitions = _metricsAuditPartitions(startDate.getTime(), endDate.getTime());
  let total = 0;
  for (const yyyymm of partitions) {
    const q = db
      .collection('audit_logs')
      .doc(yyyymm)
      .collection('events')
      .where('type', '==', typeName)
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<', endDate);
    const snap = await q.count().get();
    total += snap.data().count || 0;
  }
  return total;
}

/** Count distinct advisorUids who triggered any audit yesterday.
 *  Note: aggregation .distinct() doesn't exist in admin SDK; we sample up to
 *  cap docs across selected types and dedupe in-memory. */
async function _metricsDauFromAudit(startDate, endDate) {
  const partitions = _metricsAuditPartitions(startDate.getTime(), endDate.getTime());
  const uids = new Set();
  const CAP = 1500;
  for (const yyyymm of partitions) {
    if (uids.size >= CAP) break;
    const q = db
      .collection('audit_logs')
      .doc(yyyymm)
      .collection('events')
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<', endDate)
      .limit(CAP);
    const snap = await q.get();
    snap.forEach((d) => {
      const uid = d.data()?.advisorUid;
      if (typeof uid === 'string' && uid.length > 0) uids.add(uid);
    });
  }
  return uids.size;
}

exports.metricsAggregationDaily = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .pubsub.schedule('0 2 * * *')
  .timeZone('Asia/Taipei')
  .onRun(async (_context) => {
    // --- Runtime now (HARD rule: 全 callback 內取) ---
    const startedAtMs = Date.now();
    const nowDate = new Date(startedAtMs);

    // 推算「昨日」邊界 — TW timezone
    // 今天 TW midnight (UTC equivalent) = window end exclusive
    const twTodayMidnightUtc = _metricsTwMidnightUtc(nowDate);
    // 昨日 TW midnight = window start inclusive
    const twYesterdayMidnightUtc = new Date(
      twTodayMidnightUtc.getTime() - 24 * 3600 * 1000,
    );
    const yyyymmdd = _metricsTwYyyymmdd(twYesterdayMidnightUtc);
    const runId = `${METRICS_RUN_PREFIX}_${startedAtMs}_${crypto.randomBytes(4).toString('hex')}`;
    const errors = [];

    functions.logger.info('[metricsAggregationDaily] start', {
      runId,
      yyyymmdd,
      windowStartIso: twYesterdayMidnightUtc.toISOString(),
      windowEndIso: twTodayMidnightUtc.toISOString(),
    });

    // ============================================
    // Section A — 顧問活躍度
    // ============================================
    const advisorTotalRegistered = await _metricsSafe(
      'advisor.totalRegistered',
      errors,
      async () => {
        const snap = await db
          .collection('users')
          .where('role', '==', 'advisor')
          .count()
          .get();
        return snap.data().count || 0;
      },
    );

    const dau = await _metricsSafe('advisor.dau', errors, async () =>
      _metricsDauFromAudit(twYesterdayMidnightUtc, twTodayMidnightUtc),
    );

    // MAU = distinct advisors in last 30d. Sample-capped — accurate up to ~5k MAU
    // before aliasing; UA target顧問規模 < 500 next 12mo, well within range.
    const mau = await _metricsSafe('advisor.mau', errors, async () => {
      const monthAgo = new Date(
        twTodayMidnightUtc.getTime() - METRICS_RECENT_DAYS_FOR_PER_ACTIVE * 24 * 3600 * 1000,
      );
      return _metricsDauFromAudit(monthAgo, twTodayMidnightUtc);
    });

    const ocrScansYesterday = await _metricsSafe(
      'advisor.ocrScansYesterday',
      errors,
      async () =>
        _metricsCountAuditByType('ocr_scan', twYesterdayMidnightUtc, twTodayMidnightUtc),
    );

    const ragAsksYesterday = await _metricsSafe(
      'advisor.ragAsksYesterday',
      errors,
      async () => _metricsCountAuditByType('ask', twYesterdayMidnightUtc, twTodayMidnightUtc),
    );

    const pdfViewsYesterday = await _metricsSafe(
      'advisor.pdfViewsYesterday',
      errors,
      async () =>
        _metricsCountAuditByType('pdf_view', twYesterdayMidnightUtc, twTodayMidnightUtc),
    );

    // 人均口徑 = 30d total / MAU
    const ocr30d = await _metricsSafe('advisor.ocr30d', errors, async () => {
      const monthAgo = new Date(
        twTodayMidnightUtc.getTime() - METRICS_RECENT_DAYS_FOR_PER_ACTIVE * 24 * 3600 * 1000,
      );
      return _metricsCountAuditByType('ocr_scan', monthAgo, twTodayMidnightUtc);
    });
    const ask30d = await _metricsSafe('advisor.ask30d', errors, async () => {
      const monthAgo = new Date(
        twTodayMidnightUtc.getTime() - METRICS_RECENT_DAYS_FOR_PER_ACTIVE * 24 * 3600 * 1000,
      );
      return _metricsCountAuditByType('ask', monthAgo, twTodayMidnightUtc);
    });
    const pdf30d = await _metricsSafe('advisor.pdf30d', errors, async () => {
      const monthAgo = new Date(
        twTodayMidnightUtc.getTime() - METRICS_RECENT_DAYS_FOR_PER_ACTIVE * 24 * 3600 * 1000,
      );
      return _metricsCountAuditByType('pdf_view', monthAgo, twTodayMidnightUtc);
    });

    const ocrPerActive =
      mau && mau > 0 && typeof ocr30d === 'number' ? ocr30d / mau : null;
    const ragPerActive =
      mau && mau > 0 && typeof ask30d === 'number' ? ask30d / mau : null;
    const pdfPerActive =
      mau && mau > 0 && typeof pdf30d === 'number' ? pdf30d / mau : null;

    const quotaRequestsNew = await _metricsSafe(
      'advisor.quotaRequestsNew',
      errors,
      async () => {
        // 顧問端寫入用 submittedAtMs (epoch ms) — 對齊 QuotaExtensionRequests.tsx orderBy
        const snap = await db
          .collection('quota_extension_requests')
          .where('submittedAtMs', '>=', twYesterdayMidnightUtc.getTime())
          .where('submittedAtMs', '<', twTodayMidnightUtc.getTime())
          .count()
          .get();
        return snap.data().count || 0;
      },
    );

    // ============================================
    // Section B — 系統 health
    // ============================================
    // P95 latency: audit_logs context 沒有 durationMs 欄位 (logAuditEvent 不寫入)、
    // 暫無 latency 來源；留 null、Sprint 18 接 Cloud Monitoring exporter (Vercel +
    // Firebase function runtime metrics) 再覆寫此欄。本 cron 不為了示意值灌
    // 假數據、寫 null 讓 Dashboard 卡片明確顯示「等資料」狀態。
    const apiAskP95Ms = null;
    const apiPdfProxyP95Ms = null;

    // Gemini cost 本月累計 = sum(tokensUsed * unit price) 從 audit_logs 月 partition
    const geminiCostUsdMonth = await _metricsSafe(
      'system.geminiCostUsdMonth',
      errors,
      async () => {
        // 本月 = 從本月 1 號 TW 00:00 起 (到 now)
        const tw = new Date(nowDate.getTime() + 8 * 3600 * 1000);
        const monthFirstTwMidUtc = new Date(
          Date.UTC(tw.getUTCFullYear(), tw.getUTCMonth(), 1, 0, 0, 0, 0)
            - 8 * 3600 * 1000,
        );
        const partitions = _metricsAuditPartitions(
          monthFirstTwMidUtc.getTime(),
          nowDate.getTime(),
        );
        let totalCostUsd = 0;
        let sampled = 0;
        const SAMPLE_CAP = 2000;
        const llmTypes = ['ask', 'compose_diff_summary', 'compare_product_conditions'];
        for (const yyyymm of partitions) {
          if (sampled >= SAMPLE_CAP) break;
          for (const t of llmTypes) {
            if (sampled >= SAMPLE_CAP) break;
            const q = db
              .collection('audit_logs')
              .doc(yyyymm)
              .collection('events')
              .where('type', '==', t)
              .where('timestamp', '>=', monthFirstTwMidUtc)
              .limit(SAMPLE_CAP - sampled);
            const snap = await q.get();
            snap.forEach((d) => {
              sampled += 1;
              const data = d.data() || {};
              // /api/ask 寫 tokensUsed: { input, output }
              const tu = data.tokensUsed;
              let inTok = 0;
              let outTok = 0;
              if (tu && typeof tu === 'object' && !Array.isArray(tu)) {
                inTok = Number(tu.input) || 0;
                outTok = Number(tu.output) || 0;
              } else if (typeof tu === 'number') {
                // composeConditionDiffSummary 寫 total tokens flat (context.tokensUsed)
                outTok = tu; // 全當 output (粗估、無 input/output 分離)
              } else if (
                data.context &&
                typeof data.context.tokensUsed === 'number'
              ) {
                outTok = data.context.tokensUsed;
              }
              const costUsd =
                (inTok / 1_000_000) * METRICS_GEMINI_USD_PER_1M_INPUT +
                (outTok / 1_000_000) * METRICS_GEMINI_USD_PER_1M_OUTPUT;
              totalCostUsd += costUsd;
            });
          }
        }
        return Number(totalCostUsd.toFixed(4));
      },
    );

    // Firestore reads/writes/storage — 真實數字需 Firebase Billing API、admin SDK
    // 沒有 in-process counter。留 null、Sprint 18 接 Cloud Monitoring exporter。
    const firestoreReadsDay = null;
    const firestoreWritesDay = null;
    const firestoreStorageGb = null;

    const tiiCronSuccessRate = await _metricsSafe(
      'system.tiiCronSuccessRate',
      errors,
      async () => {
        // 近 12 個月 status='success' 比例
        const tw = new Date(nowDate.getTime() + 8 * 3600 * 1000);
        const months = [];
        for (let i = 0; i < METRICS_TII_LOOKBACK_MONTHS; i += 1) {
          const m = new Date(
            Date.UTC(tw.getUTCFullYear(), tw.getUTCMonth() - i, 1, 0, 0, 0, 0),
          );
          months.push(
            m.getUTCFullYear().toString() +
              String(m.getUTCMonth() + 1).padStart(2, '0'),
          );
        }
        let success = 0;
        let total = 0;
        for (const ym of months) {
          const snap = await db.collection('tii_crawl_results').doc(ym).get();
          if (snap.exists) {
            total += 1;
            if (snap.data()?.status === 'success') success += 1;
          }
        }
        if (total === 0) return null;
        return Number((success / total).toFixed(4));
      },
    );

    const conditionAlertSlaHours = await _metricsSafe(
      'system.conditionAlertSlaHours',
      errors,
      async () => {
        // p50 hours from condition alerts last 30d.
        // alert createdAt = epoch ms; sentEmailAt = Firestore Timestamp.
        // 用 collectionGroup('conditionAlerts') 跨 advisor 一次查完。
        const monthAgoMs =
          twTodayMidnightUtc.getTime() - METRICS_RECENT_DAYS_FOR_PER_ACTIVE * 24 * 3600 * 1000;
        const q = db
          .collectionGroup('conditionAlerts')
          .where('createdAt', '>=', monthAgoMs)
          .limit(1000);
        const snap = await q.get();
        const hours = [];
        snap.forEach((d) => {
          const data = d.data() || {};
          const createdMs = Number(data.createdAt);
          const sentAt = data.sentEmailAt;
          if (!Number.isFinite(createdMs)) return;
          if (!sentAt || typeof sentAt.toMillis !== 'function') return;
          const sentMs = sentAt.toMillis();
          const diffHr = (sentMs - createdMs) / 3600_000;
          if (diffHr >= 0 && diffHr < 24 * 365) hours.push(diffHr);
        });
        const p50 = _metricsMedian(hours);
        return p50 === null ? null : Number(p50.toFixed(2));
      },
    );

    // ============================================
    // Section C — Catalog health
    // ============================================
    const catalogTotal = await _metricsSafe('catalog.total', errors, async () => {
      const snap = await db.collection('insurance_products').count().get();
      return snap.data().count || 0;
    });

    // 「本月」delta — 用 effectiveFrom (versioned subcoll) 落在本月 TW 區間
    const tw = new Date(nowDate.getTime() + 8 * 3600 * 1000);
    const monthFirstTwMidUtc = new Date(
      Date.UTC(tw.getUTCFullYear(), tw.getUTCMonth(), 1, 0, 0, 0, 0)
        - 8 * 3600 * 1000,
    );
    const monthFirstTwIsoDate =
      `${tw.getUTCFullYear()}-${String(tw.getUTCMonth() + 1).padStart(2, '0')}-01`;

    const catalogAddedMonth = await _metricsSafe(
      'catalog.addedMonth',
      errors,
      async () => {
        // 本月 effectiveFrom >= 月 1 號 ISO + status='active' (v1 baseline)
        const snap = await db
          .collectionGroup('versions')
          .where('effectiveFrom', '>=', monthFirstTwIsoDate)
          .where('status', '==', 'active')
          .count()
          .get();
        return snap.data().count || 0;
      },
    );

    const catalogRevisedMonth = await _metricsSafe(
      'catalog.revisedMonth',
      errors,
      async () => {
        // 本月 product root.lastModifiedAt >= 月 1 號 TW midnight、status='revised'
        const snap = await db
          .collection('insurance_products')
          .where('status', '==', 'revised')
          .where('lastModifiedAt', '>=', monthFirstTwMidUtc)
          .count()
          .get();
        return snap.data().count || 0;
      },
    );

    const catalogDelistedMonth = await _metricsSafe(
      'catalog.delistedMonth',
      errors,
      async () => {
        const snap = await db
          .collection('insurance_products')
          .where('status', '==', 'discontinued')
          .where('lastModifiedAt', '>=', monthFirstTwMidUtc)
          .count()
          .get();
        return snap.data().count || 0;
      },
    );

    const reviewQueuePending = await _metricsSafe(
      'catalog.reviewQueuePending',
      errors,
      async () => {
        const snap = await db
          .collection('insurance_review_queue')
          .where('status', '==', 'pending')
          .count()
          .get();
        return snap.data().count || 0;
      },
    );

    const crowdSubsNew = await _metricsSafe(
      'catalog.crowdSubsNew',
      errors,
      async () => {
        const monthAgoMs =
          twTodayMidnightUtc.getTime() - METRICS_RECENT_DAYS_FOR_PER_ACTIVE * 24 * 3600 * 1000;
        const snap = await db
          .collection('insurance_review_queue')
          .where('source', '==', 'advisor_crowd')
          .where('submittedAt', '>=', monthAgoMs)
          .count()
          .get();
        return snap.data().count || 0;
      },
    );

    const diffSeverity = await _metricsSafe(
      'catalog.diffSeverity',
      errors,
      async () => {
        // 本月 compose_diff_summary audit 的 context.severity 分布
        const tw2 = new Date(nowDate.getTime() + 8 * 3600 * 1000);
        const monthFirstTwMidUtc2 = new Date(
          Date.UTC(tw2.getUTCFullYear(), tw2.getUTCMonth(), 1, 0, 0, 0, 0)
            - 8 * 3600 * 1000,
        );
        const partitions = _metricsAuditPartitions(
          monthFirstTwMidUtc2.getTime(),
          nowDate.getTime(),
        );
        const dist = { low: 0, med: 0, high: 0, critical: 0 };
        for (const yyyymm of partitions) {
          const q = db
            .collection('audit_logs')
            .doc(yyyymm)
            .collection('events')
            .where('type', '==', 'compose_diff_summary')
            .where('timestamp', '>=', monthFirstTwMidUtc2)
            .limit(500);
          const snap = await q.get();
          snap.forEach((d) => {
            const sev = d.data()?.context?.severity;
            if (sev === 'low') dist.low += 1;
            else if (sev === 'medium') dist.med += 1;
            else if (sev === 'high') dist.high += 1;
            else if (sev === 'critical') dist.critical += 1;
          });
        }
        return dist;
      },
    );

    // ============================================
    // Section D — 業務 KPI
    // ============================================
    // Sprint 17 W1 stretch — 之後正式 wire up
    const freeToPaidRate = null;     // Sprint 17 W2+: 計算 plan 升級轉換
    const customerTouchRate = null;  // 需要 alert.markedContactedAt 欄位、W2 補
    const advisorNps = null;         // Sprint 18 in-app survey

    const reportsGeneratedMonth = await _metricsSafe(
      'business.reportsGeneratedMonth',
      errors,
      async () => {
        // 用 customer_reports 集合本月 createdAt count (若 collection 不存在 → 0)
        const tw3 = new Date(nowDate.getTime() + 8 * 3600 * 1000);
        const monthFirstTwMidUtc3 = new Date(
          Date.UTC(tw3.getUTCFullYear(), tw3.getUTCMonth(), 1, 0, 0, 0, 0)
            - 8 * 3600 * 1000,
        );
        try {
          const snap = await db
            .collection('customer_reports')
            .where('createdAt', '>=', monthFirstTwMidUtc3)
            .count()
            .get();
          return snap.data().count || 0;
        } catch (e) {
          // collection 不存在 / 缺索引 → 容忍
          return 0;
        }
      },
    );

    // ============================================
    // Write metrics_daily/{yyyymmdd}
    // ============================================
    const runtimeMs = Date.now() - startedAtMs;
    const payload = {
      yyyymmdd,

      // Section A — 顧問活躍度 (flat for Dashboard)
      dau,
      mau,
      ocrPerActive,
      ragPerActive,
      pdfPerActive,
      quotaRequestsNew,
      advisorTotalRegistered,        // extra, dashboard 不必讀
      ocrScansYesterday,             // extra (raw daily count)
      ragAsksYesterday,
      pdfViewsYesterday,

      // Section B — 系統 health
      apiAskP95Ms,
      apiPdfProxyP95Ms,
      geminiCostUsdMonth,
      firestoreReadsDay,
      firestoreWritesDay,
      firestoreStorageGb,
      tiiCronSuccessRate,
      conditionAlertSlaHours,

      // Section C — Catalog health
      catalogTotal,
      catalogAddedMonth,
      catalogRevisedMonth,
      catalogDelistedMonth,
      reviewQueuePending,
      crowdSubsNew,
      diffSeverity,

      // Section D — 業務 KPI
      freeToPaidRate,
      reportsGeneratedMonth,
      customerTouchRate,
      advisorNps,

      // Meta
      runId,
      ranAt: admin.firestore.FieldValue.serverTimestamp(),
      runtimeMs,
      windowStartIso: twYesterdayMidnightUtc.toISOString(),
      windowEndIso: twTodayMidnightUtc.toISOString(),
      errors: errors.slice(0, 20),   // cap error list
      schemaVersion: 1,
    };

    try {
      await db.collection('metrics_daily').doc(yyyymmdd).set(payload, { merge: true });
      functions.logger.info('[metricsAggregationDaily] wrote metrics_daily', {
        runId,
        yyyymmdd,
        runtimeMs,
        errorCount: errors.length,
      });
    } catch (err) {
      functions.logger.error('[metricsAggregationDaily] write failed', {
        runId,
        yyyymmdd,
        message: err?.message,
      });
      // 不 throw — audit 還要寫
    }

    // ============================================
    // Audit log
    // ============================================
    try {
      const auditYyyymm = _metricsUtcYyyymm(nowDate);
      const auditEventId = `metrics_aggregation_${startedAtMs}_system_${crypto
        .randomBytes(4)
        .toString('hex')}`;
      await db
        .collection('audit_logs')
        .doc(auditYyyymm)
        .collection('events')
        .doc(auditEventId)
        .set({
          type: 'metrics_aggregation',
          advisorUid: 'system',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          timestampMs: startedAtMs,
          context: {
            runId,
            yyyymmdd,
            runtimeMs,
            errorCount: errors.length,
            erroredKpis: errors.slice(0, 10).map((e) => e.kpi),
          },
          result: errors.length === 0 ? 'success' : 'partial',
          schemaVersion: 1,
        });
    } catch (err) {
      functions.logger.warn('[metricsAggregationDaily] audit write failed', {
        runId,
        message: err?.message,
      });
    }

    return { runId, yyyymmdd, runtimeMs, errorCount: errors.length };
  });

console.log('Ultra Advisor Cloud Functions loaded');