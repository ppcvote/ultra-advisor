/**
 * AgentChat — Sprint 14 W2 條款 RAG agent
 * --------------------------------------------------------------------------
 * 顧問端條款助理 UI。給定 productId (顧問正在看的保單 catalog id) 與
 * policyContext（被保人年齡/性別/保額/已有 coverages），讓顧問用自然語言
 * 問條款問題 (癌症怎麼賠 / 等待期 / 除外責任 etc.)，後端 `/api/ask` 回傳:
 *   - text: AI 解讀（Gemini Flash + KNN over chunks subcollection）
 *   - citations[]: { chunkId, sectionHeader, citationLabel('第 X 條'), pageNum }
 *   - confidence: high | medium | low（基於 retrieval score）
 *   - tokensUsed: { prompt, completion, total }（debug、顧問端可忽略）
 *   - quotaRemaining: 本月剩餘次數
 *
 * UX 鐵則 (Sprint 14 W2 戰略邊界)
 *   1. 答案必帶引用段號 — citations 為空時降為 confidence=low + 警示。
 *   2. 顧問 auth gate — 拿不到 idToken 直接 disable input + 顯示「請登入」。
 *   3. 引用展開後預留「查條款原文」按鈕、Sprint 14 W3 才開啟（現 disabled）。
 *   4. 不對外宣稱資料來源 — UI 文案禁出現 fsc.gov.tw / 條款庫等字串。
 *   5. AI 解讀有合規警語 sticky bar、LINE 用戶不一定滾到底。
 *   6. 「現在時間」runtime callback 內取（timestampMs = Date.now()）。
 *   7. retry 友善：失敗訊息顯示 retry 按鈕、不刪 user input。
 *   8. quota 0 → 429 → 顯示「申請額度」連結 (mailto/聯絡 admin)。
 *
 * 不引入新 npm 依賴：純 React + Tailwind + lucide-react + window.fetch。
 * --------------------------------------------------------------------------
 */
import React, {
  useState, useRef, useEffect, useCallback, useMemo,
} from 'react';
import {
  Send, Loader2, AlertTriangle, FileText, RefreshCw,
  ShieldAlert, Sparkles, ChevronDown, ChevronUp, Quote,
} from 'lucide-react';
import { auth } from '../../firebase';

// ---------------------------------------------------------------------------
// Types — keep local; backend shape is loose, narrow at parse time
// ---------------------------------------------------------------------------

export interface AgentChatPolicyContext {
  insuredAge: number;
  insuredGender: 'male' | 'female';
  sumAssured: number;
  // coverages: 沿用 Coverage[]，但我們只在送 API 前做 minimal 清洗，
  // UI 不直接 render coverages（PII 含 productCacheId 等也都會被後端忽略）。
  coverages: any[];
}

export interface AgentChatProps {
  productId?: string;
  policyContext?: AgentChatPolicyContext;
  className?: string;
}

interface Citation {
  chunkId: string;
  sectionHeader?: string;     // e.g. "第三章 給付項目"
  citationLabel: string;      // e.g. "第 17 條"
  pageNum?: number;
  // Sprint 14 W3 才會用：原文片段（現階段後端可能不回）
  snippet?: string;
}

type Confidence = 'high' | 'medium' | 'low';

type ChatMessage =
  | {
      id: string;
      role: 'user';
      text: string;
      timestampMs: number;
    }
  | {
      id: string;
      role: 'ai';
      text: string;
      citations: Citation[];
      confidence: Confidence;
      tokensUsed?: { prompt?: number; completion?: number; total?: number };
      timestampMs: number;
      failed?: boolean;
      errorKind?: 'network' | 'server' | 'quota' | 'auth' | 'unknown';
    };

interface AskRequestBody {
  question: string;
  productId?: string;
  policyContext?: AgentChatPolicyContext;
}

interface AskResponseBody {
  text?: string;
  answer?: string;            // 後端 alt key、寬容兼容
  citations?: Citation[];
  confidence?: Confidence;
  tokensUsed?: { prompt?: number; completion?: number; total?: number };
  quotaRemaining?: number;
  // error envelope
  error?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Sample questions — 顧問常問 top-3，點即填
// ---------------------------------------------------------------------------
const SAMPLE_QUESTIONS = [
  '癌症怎麼賠',
  '等待期多久',
  '除外責任有哪些',
] as const;

const MAX_INPUT_LEN = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function genId(): string {
  // 不引入 uuid 依賴；timestamp + random 36 足夠 UI 端唯一
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampInput(s: string): string {
  // 不主動 trim 結尾（user 可能還在打字），但限長
  if (s.length <= MAX_INPUT_LEN) return s;
  return s.slice(0, MAX_INPUT_LEN);
}

function confidenceLabel(c: Confidence): { tag: string; cls: string } {
  if (c === 'high') return { tag: '高信心', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  if (c === 'medium') return { tag: '中等信心', cls: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { tag: '低信心', cls: 'text-rose-700 bg-rose-50 border-rose-200' };
}

// ---------------------------------------------------------------------------
// Sub-component: citation list (collapsed by default)
// ---------------------------------------------------------------------------
const CitationList: React.FC<{ citations: Citation[] }> = ({ citations }) => {
  const [open, setOpen] = useState(false);
  if (!citations || citations.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-900 hover:underline"
      >
        <Quote size={12} />
        <span>引用 {citations.length} 處</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 border-l-2 border-indigo-200 pl-3">
          {citations.map((c, idx) => (
            <li key={`${c.chunkId}_${idx}`} className="text-xs text-slate-700">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono font-bold text-indigo-700">{c.citationLabel}</span>
                {c.sectionHeader && (
                  <span className="text-slate-600 truncate max-w-[220px]" title={c.sectionHeader}>
                    {c.sectionHeader}
                  </span>
                )}
                {c.pageNum != null && (
                  <span className="text-[10px] text-slate-400 font-mono">p.{c.pageNum}</span>
                )}
              </div>
              {/* Sprint 14 W3 才實作的「查條款原文」— 現留 disabled 佔位 */}
              <button
                type="button"
                disabled
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-400 cursor-not-allowed"
                title="條款原文檢視 — Sprint 14 W3 即將推出"
              >
                <FileText size={11} />
                查條款原文
                <span className="text-[9px] uppercase tracking-wider bg-slate-100 text-slate-500 px-1 py-0.5 rounded">
                  即將推出
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-component: single message bubble
// ---------------------------------------------------------------------------
const MessageBubble: React.FC<{
  msg: ChatMessage;
  onRetry?: () => void;
}> = ({ msg, onRetry }) => {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-indigo-600 text-white rounded-2xl rounded-br-md px-3.5 py-2 shadow-sm">
          <div className="text-sm whitespace-pre-wrap break-words">{msg.text}</div>
        </div>
      </div>
    );
  }

  // AI message
  const cl = confidenceLabel(msg.confidence);
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] w-full">
        {/* low-confidence 警示 banner 置頂 */}
        {msg.confidence === 'low' && !msg.failed && (
          <div className="mb-1.5 flex items-start gap-1.5 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">
            <ShieldAlert size={12} className="mt-0.5 shrink-0" />
            <span>此回答信心較低、條款內可能無直接對應段落，請以保單條款原文為準。</span>
          </div>
        )}
        <div
          className={`rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm border ${
            msg.failed
              ? 'bg-rose-50 border-rose-200'
              : 'bg-white border-slate-200'
          }`}
        >
          {msg.failed ? (
            <div className="flex items-start gap-2 text-sm text-rose-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <div>{msg.text || '回答失敗，請稍後重試。'}</div>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-rose-700 hover:text-rose-900 hover:underline"
                  >
                    <RefreshCw size={11} />
                    重試
                  </button>
                )}
                {msg.errorKind === 'quota' && (
                  <a
                    href="mailto:support@ultralab.tw?subject=%E6%A2%9D%E6%AC%BE%E5%8A%A9%E7%90%86%20-%20%E7%94%B3%E8%AB%8B%E9%A1%8D%E5%BA%A6"
                    className="ml-3 inline-flex items-center text-xs font-medium text-indigo-700 hover:underline"
                  >
                    申請額度
                  </a>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                {msg.text}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 border rounded-full ${cl.cls}`}>
                  <Sparkles size={9} />
                  {cl.tag}
                </span>
                {msg.citations.length === 0 && (
                  <span className="text-[10px] text-slate-400 italic">無引用 — 僅供參考</span>
                )}
              </div>
              <CitationList citations={msg.citations} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const AgentChat: React.FC<AgentChatProps> = ({ productId, policyContext, className = '' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [quotaTotal] = useState<number>(100); // 顯示「47/100 次」用、後端可改傳
  const [authed, setAuthed] = useState<boolean>(!!auth.currentUser);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ---- auth gate: 監聽 user 變化 ----
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setAuthed(!!u);
    });
    return () => unsub();
  }, []);

  // ---- auto-scroll on new message ----
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // requestAnimationFrame → 等 DOM 更新完再 scroll
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, loading]);

  // ---- textarea autosize ----
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const maxH = 140; // ~6 行
    ta.style.height = `${Math.min(ta.scrollHeight, maxH)}px`;
  }, [pendingQuestion]);

  const headerQuotaText = useMemo(() => {
    if (quotaRemaining == null) return '本月配額 100 次';
    return `本月剩 ${Math.max(0, quotaRemaining)}/${quotaTotal} 次`;
  }, [quotaRemaining, quotaTotal]);

  // ---- core: submit a question ----
  const submitQuestion = useCallback(
    async (question: string, opts?: { retryOfUserMsgId?: string }) => {
      const q = question.trim();
      if (!q || loading) return;

      const user = auth.currentUser;
      if (!user) {
        // auth gate — 不該到這、保險起見不噴錯也不消 input
        setAuthed(false);
        return;
      }

      // runtime now — 鐵則：在 callback 內取
      const nowMs = Date.now();

      // 新使用者訊息（重試時不重複加）
      let newMessages: ChatMessage[];
      if (opts?.retryOfUserMsgId) {
        // 移除上一則 failed AI（緊跟在 user msg 之後）
        newMessages = messages.filter(m => !(m.role === 'ai' && m.failed));
      } else {
        const userMsg: ChatMessage = {
          id: genId(),
          role: 'user',
          text: q,
          timestampMs: nowMs,
        };
        newMessages = [...messages, userMsg];
      }
      setMessages(newMessages);
      setPendingQuestion('');
      setLoading(true);

      let idToken: string;
      try {
        idToken = await user.getIdToken();
      } catch {
        setLoading(false);
        setMessages(prev => [
          ...prev,
          {
            id: genId(),
            role: 'ai',
            text: '無法取得登入憑證，請重新登入後再試。',
            citations: [],
            confidence: 'low',
            timestampMs: Date.now(),
            failed: true,
            errorKind: 'auth',
          },
        ]);
        return;
      }

      const body: AskRequestBody = {
        question: q,
        productId,
        policyContext,
      };

      try {
        const resp = await fetch('/api/ask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(body),
        });

        // parse body 寬容 (5xx 可能不是 JSON)
        let parsed: AskResponseBody = {};
        try {
          parsed = await resp.json();
        } catch {
          /* leave parsed = {} */
        }

        if (resp.status === 429) {
          if (typeof parsed.quotaRemaining === 'number') {
            setQuotaRemaining(parsed.quotaRemaining);
          } else {
            setQuotaRemaining(0);
          }
          setMessages(prev => [
            ...prev,
            {
              id: genId(),
              role: 'ai',
              text: '本月查詢配額已用完，請申請額度或下月再來。',
              citations: [],
              confidence: 'low',
              timestampMs: Date.now(),
              failed: true,
              errorKind: 'quota',
            },
          ]);
          return;
        }

        if (resp.status === 401 || resp.status === 403) {
          setMessages(prev => [
            ...prev,
            {
              id: genId(),
              role: 'ai',
              text: '驗證失敗，請重新登入後再試。',
              citations: [],
              confidence: 'low',
              timestampMs: Date.now(),
              failed: true,
              errorKind: 'auth',
            },
          ]);
          return;
        }

        if (resp.status === 503) {
          setMessages(prev => [
            ...prev,
            {
              id: genId(),
              role: 'ai',
              text: '條款助理暫時無法服務（後端忙碌），請稍候重試。',
              citations: [],
              confidence: 'low',
              timestampMs: Date.now(),
              failed: true,
              errorKind: 'server',
            },
          ]);
          return;
        }

        if (!resp.ok) {
          setMessages(prev => [
            ...prev,
            {
              id: genId(),
              role: 'ai',
              text: parsed.message || parsed.error || '回答失敗，請稍後重試。',
              citations: [],
              confidence: 'low',
              timestampMs: Date.now(),
              failed: true,
              errorKind: 'server',
            },
          ]);
          return;
        }

        // success
        const text = (parsed.text || parsed.answer || '').trim();
        const citations = Array.isArray(parsed.citations) ? parsed.citations : [];
        // 若後端沒給 confidence，依 citations 數量推斷
        let confidence: Confidence = parsed.confidence || 'medium';
        if (!parsed.confidence) {
          if (citations.length >= 3) confidence = 'high';
          else if (citations.length >= 1) confidence = 'medium';
          else confidence = 'low';
        }

        if (typeof parsed.quotaRemaining === 'number') {
          setQuotaRemaining(parsed.quotaRemaining);
        }

        setMessages(prev => [
          ...prev,
          {
            id: genId(),
            role: 'ai',
            text: text || '（後端未回傳內容）',
            citations,
            confidence,
            tokensUsed: parsed.tokensUsed,
            timestampMs: Date.now(),
          },
        ]);
      } catch {
        // network error
        setMessages(prev => [
          ...prev,
          {
            id: genId(),
            role: 'ai',
            text: '網路連線異常，請檢查網路後重試。',
            citations: [],
            confidence: 'low',
            timestampMs: Date.now(),
            failed: true,
            errorKind: 'network',
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, productId, policyContext],
  );

  // ---- retry: 重新發送最後一個 user msg ----
  const retryLast = useCallback(() => {
    // 找到最後一則 user message
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser || lastUser.role !== 'user') return;
    submitQuestion(lastUser.text, { retryOfUserMsgId: lastUser.id });
  }, [messages, submitQuestion]);

  // ---- handlers ----
  const handleSendClick = () => {
    if (!authed || loading) return;
    submitQuestion(pendingQuestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 送出、Shift+Enter 換行
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendClick();
    }
  };

  const handleSampleClick = (q: string) => {
    if (!authed || loading) return;
    setPendingQuestion(q);
    // 不直接送出 — 讓顧問可以微調
    textareaRef.current?.focus();
  };

  const inputDisabled = !authed || loading;
  const canSend = authed && !loading && pendingQuestion.trim().length > 0;

  return (
    <div
      className={`flex flex-col w-full max-w-3xl mx-auto bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden h-[60vh] sm:h-[480px] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <FileText size={15} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-800 leading-tight">條款助理</div>
            <div className="text-[10px] text-slate-500 truncate">
              針對本張保單回答條款問題
            </div>
          </div>
        </div>
        <div className="text-[11px] font-mono text-slate-500 shrink-0">{headerQuotaText}</div>
      </div>

      {/* Messages scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-xs text-slate-400 mt-8 px-6">
            <div className="mb-2 flex justify-center">
              <Sparkles size={20} className="text-indigo-300" />
            </div>
            <div className="font-medium text-slate-500">問本張保單條款的問題</div>
            <div className="mt-1">點下方範例或自行輸入</div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            onRetry={m.role === 'ai' && m.failed ? retryLast : undefined}
          />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3.5 py-2 shadow-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-indigo-600" />
              <span className="text-xs text-slate-500">查條款中…</span>
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer sticky bar */}
      <div className="px-4 py-1.5 bg-amber-50 border-t border-amber-200 text-[10px] text-amber-800 text-center leading-tight">
        本答案為 AI 解讀，最終以保單條款為準。
      </div>

      {/* Input row */}
      <div className="bg-white border-t border-slate-200 px-3 py-2.5">
        {/* sample chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleSampleClick(q)}
              disabled={inputDisabled}
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                inputDisabled
                  ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={pendingQuestion}
              onChange={(e) => setPendingQuestion(clampInput(e.target.value))}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={inputDisabled}
              placeholder={
                !authed
                  ? '請先登入以使用條款助理'
                  : '輸入條款問題（最多 500 字）'
              }
              className="w-full resize-none text-sm border border-slate-300 rounded-xl px-3 py-2 leading-snug focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
              style={{ minHeight: 38, maxHeight: 140 }}
              maxLength={MAX_INPUT_LEN}
            />
            {pendingQuestion.length > MAX_INPUT_LEN * 0.85 && (
              <div className="absolute right-2 bottom-1 text-[10px] font-mono text-slate-400 pointer-events-none">
                {pendingQuestion.length}/{MAX_INPUT_LEN}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSendClick}
            disabled={!canSend}
            className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
              canSend
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20'
                : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
            aria-label="送出"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentChat;
