/**
 * Threads 社群助理 - 主容器
 *
 * 全螢幕 Modal，內含 4 個分頁：設定 / 發文 / 文案庫 / 紀錄
 */

import React, { useState, useEffect } from 'react';
import {
  X, Settings, Send, BookOpen, Clock, MessageCircle,
} from 'lucide-react';
import { useThreads } from '../../hooks/useThreads';
import { useMembership } from '../../hooks/useMembership';
import ThreadsSetup from './ThreadsSetup';
import ThreadsComposer from './ThreadsComposer';
import ThreadsLibrary from './ThreadsLibrary';
import ThreadsHistory from './ThreadsHistory';

type TabId = 'setup' | 'compose' | 'library' | 'history';

const TABS: { id: TabId; label: string; Icon: React.FC<any> }[] = [
  { id: 'setup', label: '設定', Icon: Settings },
  { id: 'compose', label: '發文', Icon: Send },
  { id: 'library', label: '文案庫', Icon: BookOpen },
  { id: 'history', label: '紀錄', Icon: Clock },
];

interface ThreadsAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const ThreadsAssistant: React.FC<ThreadsAssistantProps> = ({ isOpen, onClose, userId }) => {
  const { membership, loading: membershipLoading } = useMembership(userId);
  const {
    config, configLoading, saveConfig,
    library, libraryLoading,
    addLibraryItem, addLibraryItems, updateLibraryItem, removeLibraryItem, reorderLibrary, markAsPublished,
    posts, postsLoading, addPostRecord,
  } = useThreads(userId);

  // 首次使用引導：如果尚未設定，預設到設定分頁
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    return 'compose'; // 預設發文分頁，useEffect 會檢查是否需要引導到設定
  });

  // 首次載入後，如果還沒有 config 就引導到設定分頁
  useEffect(() => {
    if (!configLoading && !config) {
      setActiveTab('setup');
    }
  }, [configLoading, config]);

  // ESC 關閉
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 鎖定背景滾動
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!isOpen) return null;

  // 權限守衛：載入中顯示 loading，非付費會員顯示升級提示
  if (membershipLoading) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="text-slate-400 flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-slate-500 border-t-purple-400 rounded-full animate-spin" />
          載入中...
        </div>
      </div>
    );
  }

  if (!membership?.isPaid) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle size={32} className="text-purple-400" />
          </div>
          <h3 className="text-xl font-black text-white mb-2">Threads 社群助理</h3>
          <p className="text-sm text-slate-400 mb-6">此功能僅限付費會員使用，升級後即可使用 AI 自動發文、文案庫管理等完整功能。</p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-colors"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl
                     flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 flex-shrink-0">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <MessageCircle size={22} className="text-purple-400" />
            Threads 社群助理
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
          >
            <X size={22} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-slate-800 flex-shrink-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.Icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-colors
                  ${isActive
                    ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/5'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                  }`}
              >
                <TabIcon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content - 可滾動 */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'setup' && (
            <ThreadsSetup
              config={config}
              configLoading={configLoading}
              onSave={saveConfig}
            />
          )}

          {activeTab === 'compose' && (
            <ThreadsComposer
              config={config}
              onPostPublished={addPostRecord}
            />
          )}

          {activeTab === 'library' && (
            <ThreadsLibrary
              config={config}
              library={library}
              libraryLoading={libraryLoading}
              onAdd={addLibraryItem}
              onAddBatch={addLibraryItems}
              onUpdate={updateLibraryItem}
              onRemove={removeLibraryItem}
              onReorder={reorderLibrary}
              onMarkPublished={markAsPublished}
              onPostPublished={addPostRecord}
              onSaveConfig={saveConfig}
            />
          )}

          {activeTab === 'history' && (
            <ThreadsHistory
              posts={posts}
              postsLoading={postsLoading}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ThreadsAssistant;
