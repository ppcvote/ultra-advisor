/**
 * Threads 社群助理 - 發文分頁
 *
 * 功能：AI 生成貼文、預覽編輯、發佈到 Threads
 */

import React, { useState } from 'react';
import {
  Sparkles, Send, RefreshCw, Loader2, Check, AlertCircle, MessageCircle,
} from 'lucide-react';
import { generatePostWithGemini, publishToThreads } from '../../utils/threadsApi';
import type { ThreadsConfig, ThreadsPostRecord } from '../../utils/threadsApi';
import { Timestamp } from 'firebase/firestore';

const THREADS_CHAR_LIMIT = 500;

interface ThreadsComposerProps {
  config: ThreadsConfig | null;
  onPostPublished: (record: Omit<ThreadsPostRecord, 'id' | 'createdAt'>) => Promise<void>;
}

const ThreadsComposer: React.FC<ThreadsComposerProps> = ({ config, onPostPublished }) => {
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const hasGeminiKey = !!config?.geminiApiKey;
  const hasThreadsToken = !!config?.threadsAccessToken && !!config?.threadsUserId;
  const charCount = content.length;
  const isOverLimit = charCount > THREADS_CHAR_LIMIT;

  // AI 生成貼文
  const handleGenerate = async () => {
    if (!config?.geminiApiKey) return;
    setIsGenerating(true);
    setStatus(null);

    const result = await generatePostWithGemini(
      config.geminiApiKey,
      config.systemPrompt || '',
      topic || undefined,
      config.signatureLine || undefined
    );

    if (result.success && result.content) {
      setContent(result.content);
      setHasGenerated(true);
    } else {
      setStatus({ type: 'error', message: result.error || '生成失敗' });
    }
    setIsGenerating(false);
  };

  // 發佈到 Threads
  const handlePublish = async () => {
    if (!config?.threadsAccessToken || !config?.threadsUserId || !content.trim()) return;
    if (isOverLimit) return;

    setIsPublishing(true);
    setStatus(null);

    const result = await publishToThreads(
      config.threadsAccessToken,
      config.threadsUserId,
      content.trim()
    );

    if (result.success) {
      await onPostPublished({
        content: content.trim(),
        source: hasGenerated ? 'ai' : 'manual',
        threadsPostId: result.postId,
        status: 'published',
        publishedAt: Timestamp.now(),
      });
      setStatus({ type: 'success', message: '發佈成功！' });
      setContent('');
      setTopic('');
      setHasGenerated(false);
    } else {
      await onPostPublished({
        content: content.trim(),
        source: hasGenerated ? 'ai' : 'manual',
        status: 'failed',
        errorMessage: result.error,
        publishedAt: Timestamp.now(),
      });
      setStatus({ type: 'error', message: result.error || '發佈失敗' });
    }
    setIsPublishing(false);
  };

  return (
    <div className="space-y-5">
      {/* 未設定提示 */}
      {!hasThreadsToken && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertCircle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-300">
            尚未設定 Threads 帳號。請先到「設定」分頁連結你的 Threads 帳號。
          </p>
        </div>
      )}

      {/* 主題輸入 */}
      <div>
        <label className="text-sm text-slate-400 font-bold mb-2 block">
          主題（選填）
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="輸入主題，例如：退休規劃、房貸策略...（留空讓 AI 自由發揮）"
          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm
                   focus:border-purple-500 outline-none transition-colors placeholder:text-slate-600"
        />
      </div>

      {/* AI 生成按鈕 */}
      <button
        onClick={handleGenerate}
        disabled={!hasGeminiKey || isGenerating}
        className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600
                 hover:from-purple-500 hover:to-blue-500
                 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500
                 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <><Loader2 size={18} className="animate-spin" /> AI 生成中...</>
        ) : (
          <><Sparkles size={18} /> AI 生成文案</>
        )}
      </button>
      {!hasGeminiKey && (
        <p className="text-[10px] text-slate-500 -mt-3">請先到「設定」分頁輸入 Gemini API Key</p>
      )}

      {/* 貼文預覽 / 編輯 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm text-slate-400 font-bold flex items-center gap-2">
            <MessageCircle size={14} />
            貼文內容
          </label>
          <span className={`text-xs font-mono ${isOverLimit ? 'text-red-400' : charCount > THREADS_CHAR_LIMIT * 0.8 ? 'text-amber-400' : 'text-slate-500'}`}>
            {charCount} / {THREADS_CHAR_LIMIT}
          </span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="在此輸入或由 AI 生成貼文內容..."
          className={`w-full bg-slate-950 border rounded-xl py-3 px-4 text-white text-sm
                   focus:border-purple-500 outline-none transition-colors resize-none placeholder:text-slate-600
                   leading-relaxed ${isOverLimit ? 'border-red-500' : 'border-slate-700'}`}
        />
        {isOverLimit && (
          <p className="mt-1 text-xs text-red-400">超過 Threads 字數上限（{THREADS_CHAR_LIMIT} 字）</p>
        )}
      </div>

      {/* 操作按鈕 */}
      <div className="flex gap-3">
        {hasGenerated && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating || isPublishing}
            className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-600
                     text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} /> 重新生成
          </button>
        )}
        <button
          onClick={handlePublish}
          disabled={!hasThreadsToken || !content.trim() || isOverLimit || isPublishing || isGenerating}
          className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500
                   text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isPublishing ? (
            <><Loader2 size={16} className="animate-spin" /> 發佈中...</>
          ) : (
            <><Send size={16} /> 發佈到 Threads</>
          )}
        </button>
      </div>

      {/* 狀態訊息 */}
      {status && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
          status.type === 'success'
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {status.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          {status.message}
        </div>
      )}
    </div>
  );
};

export default ThreadsComposer;
