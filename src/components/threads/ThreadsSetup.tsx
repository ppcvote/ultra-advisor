/**
 * Threads 社群助理 - 設定分頁
 *
 * 功能：Threads Token / Gemini Key 驗證、System Prompt、簽名檔
 */

import React, { useState, useEffect } from 'react';
import {
  Eye, EyeOff, Check, X, Loader2, Save, Key, MessageCircle, PenTool, AlertCircle,
} from 'lucide-react';
import { verifyThreadsToken, verifyGeminiKey } from '../../utils/threadsApi';
import type { ThreadsConfig } from '../../utils/threadsApi';
import TokenHelperModal from './TokenHelperModal';

interface ThreadsSetupProps {
  config: ThreadsConfig | null;
  configLoading: boolean;
  onSave: (updates: Partial<ThreadsConfig>) => Promise<void>;
}

const ThreadsSetup: React.FC<ThreadsSetupProps> = ({ config, configLoading, onSave }) => {
  // 表單欄位
  const [threadsToken, setThreadsToken] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [signatureLine, setSignatureLine] = useState('');

  // 顯示/隱藏密碼
  const [showToken, setShowToken] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // 驗證狀態
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [tokenUsername, setTokenUsername] = useState('');
  const [tokenUserId, setTokenUserId] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [keyStatus, setKeyStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [keyError, setKeyError] = useState('');

  // Token 換取助手
  const [showTokenHelper, setShowTokenHelper] = useState(false);

  // 儲存狀態
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 從 config 初始化
  useEffect(() => {
    if (config) {
      setThreadsToken(config.threadsAccessToken || '');
      setGeminiKey(config.geminiApiKey || '');
      setSystemPrompt(config.systemPrompt || '');
      setSignatureLine(config.signatureLine || '');
      if (config.threadsUsername) {
        setTokenStatus('success');
        setTokenUsername(config.threadsUsername);
        setTokenUserId(config.threadsUserId || '');
      }
      if (config.geminiApiKey) {
        setKeyStatus('success');
      }
    }
  }, [config]);

  // 驗證 Threads Token
  const handleVerifyToken = async () => {
    if (!threadsToken.trim()) return;
    setTokenStatus('verifying');
    setTokenError('');
    const result = await verifyThreadsToken(threadsToken.trim());
    if (result.success) {
      setTokenStatus('success');
      setTokenUsername(result.username || '');
      setTokenUserId(result.userId || '');
    } else {
      setTokenStatus('error');
      setTokenError(result.error || 'Token 無效');
    }
  };

  // 驗證 Gemini Key
  const handleVerifyKey = async () => {
    if (!geminiKey.trim()) return;
    setKeyStatus('verifying');
    setKeyError('');
    const result = await verifyGeminiKey(geminiKey.trim());
    if (result.success) {
      setKeyStatus('success');
    } else {
      setKeyStatus('error');
      setKeyError(result.error || 'API Key 無效');
    }
  };

  // 儲存設定
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSave({
        threadsAccessToken: threadsToken.trim(),
        geminiApiKey: geminiKey.trim(),
        systemPrompt: systemPrompt.trim(),
        signatureLine: signatureLine.trim(),
        ...(tokenStatus === 'success' && tokenUsername ? {
          threadsUserId: tokenUserId,
          threadsUsername: tokenUsername,
          isConnected: true,
        } : {}),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        載入中...
      </div>
    );
  }

  const StatusIcon: React.FC<{ status: 'idle' | 'verifying' | 'success' | 'error' }> = ({ status }) => {
    switch (status) {
      case 'verifying': return <Loader2 size={14} className="animate-spin text-blue-400" />;
      case 'success': return <Check size={14} className="text-green-400" />;
      case 'error': return <X size={14} className="text-red-400" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Threads Access Token */}
      <div>
        <label className="text-sm text-slate-400 font-bold mb-2 flex items-center gap-2">
          <MessageCircle size={14} className="text-purple-400" />
          Threads Access Token
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={threadsToken}
              onChange={(e) => { setThreadsToken(e.target.value); setTokenStatus('idle'); }}
              placeholder="貼上你的 Threads Access Token"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 pr-10 text-white text-sm
                       focus:border-purple-500 outline-none transition-colors placeholder:text-slate-600"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button
            onClick={handleVerifyToken}
            disabled={!threadsToken.trim() || tokenStatus === 'verifying'}
            className="px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500
                     text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-1.5"
          >
            <StatusIcon status={tokenStatus} />
            驗證
          </button>
        </div>
        {tokenStatus === 'success' && (
          <p className="mt-2 text-xs text-green-400 flex items-center gap-1">
            <Check size={12} /> 已連結 @{tokenUsername}
          </p>
        )}
        {tokenStatus === 'error' && (
          <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={12} /> {tokenError}
          </p>
        )}
        <button
          type="button"
          onClick={() => setShowTokenHelper(true)}
          className="mt-2 text-xs text-purple-400 hover:text-purple-300 hover:underline transition-colors"
        >
          不知道怎麼取得 Token？使用 Token 換取助手
        </button>
      </div>

      {/* Gemini API Key */}
      <div>
        <label className="text-sm text-slate-400 font-bold mb-2 flex items-center gap-2">
          <Key size={14} className="text-blue-400" />
          Gemini API Key
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={geminiKey}
              onChange={(e) => { setGeminiKey(e.target.value); setKeyStatus('idle'); }}
              placeholder="貼上你的 Gemini API Key"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 pr-10 text-white text-sm
                       focus:border-purple-500 outline-none transition-colors placeholder:text-slate-600"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button
            onClick={handleVerifyKey}
            disabled={!geminiKey.trim() || keyStatus === 'verifying'}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500
                     text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-1.5"
          >
            <StatusIcon status={keyStatus} />
            驗證
          </button>
        </div>
        {keyStatus === 'success' && (
          <p className="mt-2 text-xs text-green-400 flex items-center gap-1">
            <Check size={12} /> API Key 驗證成功
          </p>
        )}
        {keyStatus === 'error' && (
          <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
            <AlertCircle size={12} /> {keyError}
          </p>
        )}
      </div>

      {/* System Prompt */}
      <div>
        <label className="text-sm text-slate-400 font-bold mb-2 flex items-center gap-2">
          <PenTool size={14} className="text-amber-400" />
          發文風格設定（System Prompt）
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={14}
          placeholder={'例如：\n你是一位專業的財務顧問，擅長用淺顯易懂的方式分享理財知識。\n風格犀利直接、不使用贅字、禁止雞湯文風格。\n每篇約 150-350 字。'}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm
                   focus:border-purple-500 outline-none transition-colors resize-y placeholder:text-slate-600
                   leading-relaxed"
        />
      </div>

      {/* 簽名檔 */}
      <div>
        <label className="text-sm text-slate-400 font-bold mb-2 block">簽名檔</label>
        <input
          type="text"
          value={signatureLine}
          onChange={(e) => setSignatureLine(e.target.value)}
          placeholder="例如：— @yourname｜做業務，做得比想得多。"
          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white text-sm
                   focus:border-purple-500 outline-none transition-colors placeholder:text-slate-600"
        />
      </div>

      {/* 儲存按鈕 */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800
                 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {isSaving ? (
          <><Loader2 size={18} className="animate-spin" /> 儲存中...</>
        ) : saveSuccess ? (
          <><Check size={18} /> 已儲存</>
        ) : (
          <><Save size={18} /> 儲存設定</>
        )}
      </button>

      {/* Token 換取助手 */}
      <TokenHelperModal
        isOpen={showTokenHelper}
        onClose={() => setShowTokenHelper(false)}
        onComplete={(data) => {
          setThreadsToken(data.accessToken);
          setTokenUsername(data.username);
          setTokenUserId(data.userId);
          setTokenStatus('success');
        }}
      />
    </div>
  );
};

export default ThreadsSetup;
