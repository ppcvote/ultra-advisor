/**
 * Threads 社群助理 - 文案庫分頁
 *
 * 功能：新增/編輯/刪除/排序/批次匯入/手動發佈
 */

import React, { useState } from 'react';
import {
  Plus, Download, Edit3, Trash2, ChevronUp, ChevronDown, Send,
  Loader2, Check, X, AlertCircle, BookOpen, Clock, Play, Pause,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { publishToThreads } from '../../utils/threadsApi';
import type { ThreadsConfig, ThreadsLibraryItem, ThreadsPostRecord } from '../../utils/threadsApi';
import ThreadsLibraryImport from './ThreadsLibraryImport';

interface ThreadsLibraryProps {
  config: ThreadsConfig | null;
  library: ThreadsLibraryItem[];
  libraryLoading: boolean;
  onAdd: (content: string) => Promise<void>;
  onAddBatch: (contents: string[]) => Promise<void>;
  onUpdate: (id: string, content: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onReorder: (id: string, direction: 'up' | 'down') => Promise<void>;
  onMarkPublished: (id: string) => Promise<void>;
  onPostPublished: (record: Omit<ThreadsPostRecord, 'id' | 'createdAt'>) => Promise<void>;
  onSaveConfig?: (updates: Partial<ThreadsConfig>) => Promise<void>;
}

const ThreadsLibrary: React.FC<ThreadsLibraryProps> = ({
  config, library, libraryLoading,
  onAdd, onAddBatch, onUpdate, onRemove, onReorder, onMarkPublished, onPostPublished,
  onSaveConfig,
}) => {
  const [showImport, setShowImport] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // 排程設定
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);
  const [scheduleTimeInput, setScheduleTimeInput] = useState('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const hasThreadsToken = !!config?.threadsAccessToken && !!config?.threadsUserId;
  const pendingCount = library.filter(i => i.status === 'pending').length;
  const publishedCount = library.filter(i => i.status === 'published').length;

  // 新增單篇
  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setIsAdding(true);
    try {
      await onAdd(newContent.trim());
      setNewContent('');
      setShowAddForm(false);
    } finally {
      setIsAdding(false);
    }
  };

  // 開始編輯
  const startEdit = (item: ThreadsLibraryItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
  };

  // 儲存編輯
  const saveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    await onUpdate(editingId, editContent.trim());
    setEditingId(null);
    setEditContent('');
  };

  // 手動發佈單篇
  const handlePublishItem = async (item: ThreadsLibraryItem) => {
    if (!config?.threadsAccessToken || !config?.threadsUserId) return;
    setPublishingId(item.id);

    const textToPublish = config.signatureLine
      ? `${item.content}\n\n${config.signatureLine}`
      : item.content;

    const result = await publishToThreads(
      config.threadsAccessToken,
      config.threadsUserId,
      textToPublish
    );

    if (result.success) {
      await onMarkPublished(item.id);
      await onPostPublished({
        content: textToPublish,
        source: 'library',
        libraryItemId: item.id,
        threadsPostId: result.postId,
        status: 'published',
        publishedAt: Timestamp.now(),
      });
    } else {
      await onPostPublished({
        content: textToPublish,
        source: 'library',
        libraryItemId: item.id,
        status: 'failed',
        errorMessage: result.error,
        publishedAt: Timestamp.now(),
      });
    }
    setPublishingId(null);
  };

  // 排程：切換啟用/停用
  const handleToggleSchedule = async () => {
    if (!onSaveConfig) return;
    const newEnabled = !config?.libraryScheduleEnabled;
    await onSaveConfig({
      libraryScheduleEnabled: newEnabled,
      // 啟用時若無排程時間，給預設值
      ...(newEnabled && (!config?.libraryScheduleTimes || config.libraryScheduleTimes.length === 0)
        ? { libraryScheduleTimes: ['09:00', '18:00'], libraryCurrentIndex: config?.libraryCurrentIndex ?? 0 }
        : {}),
    });
  };

  // 排程：新增時間
  const handleAddScheduleTime = async () => {
    if (!onSaveConfig || !scheduleTimeInput) return;
    const current = config?.libraryScheduleTimes || [];
    if (current.includes(scheduleTimeInput)) {
      setScheduleTimeInput('');
      return;
    }
    const updated = [...current, scheduleTimeInput].sort();
    setIsSavingSchedule(true);
    await onSaveConfig({ libraryScheduleTimes: updated });
    setScheduleTimeInput('');
    setIsSavingSchedule(false);
  };

  // 排程：移除時間
  const handleRemoveScheduleTime = async (time: string) => {
    if (!onSaveConfig) return;
    const current = config?.libraryScheduleTimes || [];
    const updated = current.filter(t => t !== time);
    await onSaveConfig({ libraryScheduleTimes: updated });
  };

  // 排程：重置進度
  const handleResetIndex = async () => {
    if (!onSaveConfig) return;
    await onSaveConfig({ libraryCurrentIndex: 0 });
  };

  const scheduleEnabled = !!config?.libraryScheduleEnabled;
  const scheduleTimes = config?.libraryScheduleTimes || [];
  const currentIndex = config?.libraryCurrentIndex ?? 0;

  if (libraryLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        載入中...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400">
          共 <span className="text-white font-bold">{library.length}</span> 篇
          {publishedCount > 0 && <> · 已發 <span className="text-green-400">{publishedCount}</span></>}
          {pendingCount > 0 && <> · 待發 <span className="text-amber-400">{pendingCount}</span></>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg
                     transition-colors flex items-center gap-1"
          >
            <Plus size={14} /> 新增
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg
                     transition-colors flex items-center gap-1"
          >
            <Download size={14} /> 批次匯入
          </button>
        </div>
      </div>

      {/* 排程自動發文 */}
      {onSaveConfig && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowScheduleSettings(!showScheduleSettings)}
              className="flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors"
            >
              <Clock size={14} className="text-purple-400" />
              <span className="font-bold">排程自動發文</span>
              {scheduleEnabled && (
                <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded-full">
                  運作中
                </span>
              )}
            </button>
            <button
              onClick={handleToggleSchedule}
              disabled={!hasThreadsToken || library.length === 0}
              className={`p-1.5 rounded-lg transition-colors ${
                scheduleEnabled
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : !hasThreadsToken || library.length === 0
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
              title={!hasThreadsToken ? '請先連結 Threads 帳號' : library.length === 0 ? '請先新增文案' : scheduleEnabled ? '停用排程' : '啟用排程'}
            >
              {scheduleEnabled ? <Pause size={14} /> : <Play size={14} />}
            </button>
          </div>

          {showScheduleSettings && (
            <div className="space-y-3 pt-1">
              {/* 前置條件提示 */}
              {(!hasThreadsToken || library.length === 0) && (
                <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertCircle size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-amber-300 leading-relaxed">
                    {!hasThreadsToken && '請先到「設定」分頁連結 Threads 帳號。'}
                    {!hasThreadsToken && library.length === 0 && ' '}
                    {library.length === 0 && '請先新增文案到文案庫。'}
                  </p>
                </div>
              )}

              {/* 發文時間 */}
              <div>
                <label className="text-[11px] text-slate-500 font-bold block mb-1.5">發文時間</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {scheduleTimes.length === 0 ? (
                    <span className="text-[11px] text-slate-500">尚未設定</span>
                  ) : (
                    scheduleTimes.map((time) => (
                      <span
                        key={time}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded-lg"
                      >
                        {time}
                        <button
                          onClick={() => handleRemoveScheduleTime(time)}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={scheduleTimeInput}
                    onChange={(e) => setScheduleTimeInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg py-1.5 px-3 text-white text-xs
                             focus:border-purple-500 outline-none transition-colors"
                  />
                  <button
                    onClick={handleAddScheduleTime}
                    disabled={!scheduleTimeInput || isSavingSchedule}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500
                             text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} /> 新增
                  </button>
                </div>
              </div>

              {/* 排程進度 */}
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-slate-400">
                  目前進度：已發 <span className="text-white font-bold">{Math.min(currentIndex, pendingCount + publishedCount)}</span> / 共 <span className="text-white font-bold">{library.length}</span> 篇
                  {currentIndex >= library.length && library.length > 0 && (
                    <span className="text-amber-400 ml-1">（已發完）</span>
                  )}
                </div>
                <button
                  onClick={handleResetIndex}
                  className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  重置進度
                </button>
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed">
                啟用後，系統會在設定的時間自動從文案庫中按順序發佈貼文到 Threads。時區為台灣時間 (UTC+8)。
              </p>
            </div>
          )}
        </div>
      )}

      {/* 新增表單 */}
      {showAddForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={4}
            placeholder="輸入文案內容..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-white text-sm
                     focus:border-purple-500 outline-none resize-none placeholder:text-slate-600"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowAddForm(false); setNewContent(''); }}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg"
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              disabled={!newContent.trim() || isAdding}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500
                       text-white text-xs font-bold rounded-lg flex items-center gap-1"
            >
              {isAdding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              新增
            </button>
          </div>
        </div>
      )}

      {/* 文案列表 */}
      {library.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">尚無文案，開始新增吧！</p>
        </div>
      ) : (
        <div className="space-y-2">
          {library.map((item, index) => (
            <div
              key={item.id}
              className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3 hover:border-slate-600 transition-colors"
            >
              {editingId === item.id ? (
                /* 編輯模式 */
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-white text-sm
                             focus:border-purple-500 outline-none resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                    <button
                      onClick={saveEdit}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg
                               flex items-center gap-1"
                    >
                      <Check size={12} /> 儲存
                    </button>
                  </div>
                </div>
              ) : (
                /* 顯示模式 */
                <div className="flex items-start gap-3">
                  {/* 序號 */}
                  <span className="text-xs text-slate-500 font-mono mt-0.5 w-6 text-right flex-shrink-0">
                    {index + 1}
                  </span>

                  {/* 內容 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 line-clamp-2 leading-relaxed whitespace-pre-wrap">
                      {item.content}
                    </p>
                  </div>

                  {/* 狀態 */}
                  <div className="flex-shrink-0">
                    {item.status === 'published' ? (
                      <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full font-bold">
                        已發
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-slate-700 text-slate-400 rounded-full font-bold">
                        待發
                      </span>
                    )}
                  </div>

                  {/* 操作 */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => onReorder(item.id, 'up')}
                      disabled={index === 0}
                      className="p-1 text-slate-500 hover:text-white disabled:opacity-30 transition-colors"
                      title="上移"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => onReorder(item.id, 'down')}
                      disabled={index === library.length - 1}
                      className="p-1 text-slate-500 hover:text-white disabled:opacity-30 transition-colors"
                      title="下移"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      onClick={() => startEdit(item)}
                      className="p-1 text-slate-500 hover:text-blue-400 transition-colors"
                      title="編輯"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      title="刪除"
                    >
                      <Trash2 size={14} />
                    </button>
                    {item.status === 'pending' && hasThreadsToken && (
                      <button
                        onClick={() => handlePublishItem(item)}
                        disabled={publishingId === item.id}
                        className="p-1 text-slate-500 hover:text-green-400 disabled:opacity-50 transition-colors"
                        title="發佈到 Threads"
                      >
                        {publishingId === item.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Send size={14} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 未連結提示 */}
      {!hasThreadsToken && library.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertCircle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-amber-300">
            請先到「設定」分頁連結 Threads 帳號，才能發佈文案。
          </p>
        </div>
      )}

      {/* 批次匯入 Modal */}
      <ThreadsLibraryImport
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={onAddBatch}
      />
    </div>
  );
};

export default ThreadsLibrary;
