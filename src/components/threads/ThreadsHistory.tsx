/**
 * Threads 社群助理 - 發文紀錄分頁
 */

import React, { useState } from 'react';
import {
  Loader2, Clock, Sparkles, BookOpen, PenTool, Check, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { ThreadsPostRecord } from '../../utils/threadsApi';

interface ThreadsHistoryProps {
  posts: ThreadsPostRecord[];
  postsLoading: boolean;
}

function formatTimestamp(ts: any): string {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${h}:${min}`;
}

const SOURCE_LABELS: Record<string, { label: string; color: string; Icon: React.FC<any> }> = {
  ai: { label: 'AI 生成', color: 'bg-purple-500/20 text-purple-400', Icon: Sparkles },
  library: { label: '文案庫', color: 'bg-blue-500/20 text-blue-400', Icon: BookOpen },
  manual: { label: '手動輸入', color: 'bg-slate-700 text-slate-400', Icon: PenTool },
};

const ThreadsHistory: React.FC<ThreadsHistoryProps> = ({ posts, postsLoading }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (postsLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        載入中...
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock size={40} className="text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500">尚無發佈紀錄</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {posts.map((post) => {
        const isExpanded = expandedId === post.id;
        const source = SOURCE_LABELS[post.source] || SOURCE_LABELS.manual;
        const SourceIcon = source.Icon;

        return (
          <div
            key={post.id}
            className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600 transition-colors"
          >
            {/* Header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : post.id)}
              className="w-full flex items-center gap-3 p-3 text-left"
            >
              {/* 狀態指示點 */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                post.status === 'published' ? 'bg-green-400' : 'bg-red-400'
              }`} />

              {/* 時間與來源 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-slate-400 font-mono">
                    {formatTimestamp(post.publishedAt || post.createdAt)}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${source.color}`}>
                    <SourceIcon size={10} />
                    {source.label}
                  </span>
                  {post.status === 'failed' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full font-bold">
                      失敗
                    </span>
                  )}
                </div>
                <p className={`text-sm text-slate-300 ${isExpanded ? '' : 'line-clamp-1'} whitespace-pre-wrap`}>
                  {post.content}
                </p>
              </div>

              {/* 展開/收合 */}
              <div className="flex-shrink-0 text-slate-500">
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {/* 展開區域 */}
            {isExpanded && (
              <div className="px-3 pb-3 border-t border-slate-700/50 pt-3 ml-5">
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {post.content}
                </p>
                {post.status === 'published' && (
                  <p className="mt-2 text-[10px] text-green-400 flex items-center gap-1">
                    <Check size={10} /> 已成功發佈到 Threads
                  </p>
                )}
                {post.status === 'failed' && post.errorMessage && (
                  <p className="mt-2 text-[10px] text-red-400 flex items-center gap-1">
                    <AlertCircle size={10} /> {post.errorMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ThreadsHistory;
