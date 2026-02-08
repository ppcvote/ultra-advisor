/**
 * Threads 社群助理 - API 呼叫函式
 *
 * 包含：Threads 帳號驗證、Gemini AI 生成、Threads 發佈
 * 所有 API 從前端直接呼叫（fetch），不經後端
 */

// ==========================================
// 型別定義
// ==========================================

import { Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

export interface ThreadsConfig {
  threadsAccessToken: string;
  threadsUserId: string;
  threadsUsername?: string;
  geminiApiKey: string;
  systemPrompt: string;
  signatureLine: string;
  isConnected: boolean;
  lastPostAt?: Timestamp;
  // 排程發文
  libraryScheduleEnabled?: boolean;
  libraryScheduleTimes?: string[];  // e.g. ["09:00", "18:00"]
  libraryCurrentIndex?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ThreadsLibraryItem {
  id: string;
  order: number;
  content: string;
  status: 'pending' | 'published' | 'skipped';
  publishedAt?: Timestamp;
  createdAt: Timestamp;
}

export interface ThreadsPostRecord {
  id: string;
  content: string;
  source: 'ai' | 'library' | 'manual';
  libraryItemId?: string;
  threadsPostId?: string;
  status: 'published' | 'failed';
  errorMessage?: string;
  publishedAt: Timestamp;
  createdAt: Timestamp;
}

// ==========================================
// Threads API
// ==========================================

/**
 * 驗證 Threads Access Token
 * 呼叫 GET /me 取得用戶資訊
 */
export async function verifyThreadsToken(accessToken: string): Promise<{
  success: boolean;
  userId?: string;
  username?: string;
  error?: string;
}> {
  try {
    const response = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error?.error?.message || 'Token 無效或已過期' };
    }

    const data = await response.json();
    return {
      success: true,
      userId: data.id,
      username: data.username,
    };
  } catch {
    return { success: false, error: '驗證失敗，請檢查網路連線' };
  }
}

/**
 * 發佈貼文到 Threads（兩步驟流程）
 * Step 1: 建立貼文容器
 * Step 2: 等待 2 秒後發佈
 */
export async function publishToThreads(
  accessToken: string,
  userId: string,
  text: string
): Promise<{
  success: boolean;
  postId?: string;
  error?: string;
}> {
  try {
    // Step 1: 建立貼文容器
    const createResponse = await fetch(
      `https://graph.threads.net/v1.0/${userId}/threads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          media_type: 'TEXT',
          text,
          access_token: accessToken,
        }),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.json().catch(() => ({}));
      return { success: false, error: error?.error?.message || '建立貼文失敗' };
    }

    const createResult = await createResponse.json();
    const creationId = createResult.id;

    // 等待 2 秒讓 Threads 處理
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: 發佈貼文
    const publishResponse = await fetch(
      `https://graph.threads.net/v1.0/${userId}/threads_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          creation_id: creationId,
          access_token: accessToken,
        }),
      }
    );

    if (!publishResponse.ok) {
      const error = await publishResponse.json().catch(() => ({}));
      return { success: false, error: error?.error?.message || '發佈失敗' };
    }

    const publishResult = await publishResponse.json();
    return { success: true, postId: publishResult.id };
  } catch {
    return { success: false, error: '網路錯誤，請稍後再試' };
  }
}

// ==========================================
// Gemini API
// ==========================================

/**
 * 驗證 Gemini API Key
 * 發送簡短測試請求確認 Key 有效
 */
export async function verifyGeminiKey(apiKey: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: '請回覆 OK' }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error?.error?.message || 'API Key 無效' };
    }

    return { success: true };
  } catch {
    return { success: false, error: '驗證失敗，請檢查網路連線' };
  }
}

/**
 * 使用 Gemini AI 生成 Threads 貼文
 */
export async function generatePostWithGemini(
  apiKey: string,
  systemPrompt: string,
  topic?: string,
  signatureLine?: string
): Promise<{
  success: boolean;
  content?: string;
  error?: string;
}> {
  const userPrompt = topic
    ? `請針對「${topic}」這個主題，寫一篇 Threads 貼文。直接輸出貼文內容，不要有任何前言或說明。`
    : '請自己發想一個主題，寫一篇 Threads 貼文。主題要有新意。直接輸出貼文內容，不要有任何前言或說明。';

  const signatureHint = signatureLine
    ? `\n\n重要：貼文最後請加上簽名檔：\n${signatureLine}`
    : '';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt + '\n\n' + userPrompt + signatureHint }],
          },
        ],
        generationConfig: {
          temperature: 1.0,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { success: false, error: error?.error?.message || '生成失敗' };
    }

    const result = await response.json();
    let text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // 清理 code block 包裝
    if (text.startsWith('```')) {
      text = text.split('\n').slice(1).join('\n');
    }
    if (text.endsWith('```')) {
      text = text.slice(0, -3);
    }

    return { success: true, content: text.trim() };
  } catch {
    return { success: false, error: '網路錯誤，請稍後再試' };
  }
}

// ==========================================
// Token 換取助手
// ==========================================

/**
 * 透過 Cloud Function 換取 Threads 長期 Token
 * 流程：授權碼 → 短期 Token → 長期 Token → 用戶資訊
 */
export async function exchangeThreadsToken(params: {
  appId: string;
  appSecret: string;
  code: string;
  redirectUri: string;
}): Promise<{
  success: boolean;
  accessToken?: string;
  userId?: string;
  username?: string;
  expiresIn?: number;
  error?: string;
}> {
  try {
    const functions = getFunctions();
    const callable = httpsCallable(functions, 'exchangeThreadsToken');
    const result = await callable(params);
    const data = result.data as any;

    if (data.success) {
      return {
        success: true,
        accessToken: data.accessToken,
        userId: data.userId,
        username: data.username,
        expiresIn: data.expiresIn,
      };
    }

    return { success: false, error: data.error || 'Token 換取失敗' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Token 換取失敗，請檢查參數是否正確' };
  }
}
