import React, { useMemo, useState } from 'react';
import { Users, Search, Plus, Edit3, Trash2, Loader2, ArrowUpDown, Tag as TagIcon, X, Check } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from '../../utils/toast';
import { countClientProfileFields, CLIENT_PROFILE_TOTAL } from '../../types/clientProfile';

interface ClientsTabProps {
  clients: any[];
  loading: boolean;
  onSelectClient: (client: any) => void;
  onAddClient: () => void;
  onEditClient: (client: any) => void;
  onDeleteClient: (clientId: string) => void;
  /** Sprint L1: tag 寫入需要 uid（updateDoc(users/{uid}/clients/{cid})）。
      optional 是為了讓既有呼叫者（沒傳 userId）不會直接編譯爆 — 若沒給就 disable tag 編輯。 */
  userId?: string;
}

// Sprint L1: 三種排序方式 — updated 是預設（既有 Firestore query orderBy updatedAt 也是這個方向，
// 不會出現「列表瞬間跳動」的視覺 jank）。client-side filter only — 不改 firestore.rules、不做 composite index。
type SortKey = 'updated' | 'name' | 'created';

const SORT_LABEL: Record<SortKey, string> = {
  updated: '最近更新',
  name: '姓名',
  created: '建立日期',
};

// Sprint L1: 預設三個系統 tag。顏色刻意分開（emerald 成交感 / amber 待辦感 / sky 中性）
// 自訂 tag 走 slate 灰，避免顧問亂取名讓畫面變花。
const DEFAULT_TAGS = ['VIP', '待追蹤', '已成交'] as const;
const TAG_COLOR: Record<string, string> = {
  'VIP': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25',
  '待追蹤': 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25',
  '已成交': 'bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/25',
};
const TAG_COLOR_ACTIVE: Record<string, string> = {
  'VIP': 'bg-emerald-500/30 text-emerald-200 border-emerald-400/60',
  '待追蹤': 'bg-amber-500/30 text-amber-200 border-amber-400/60',
  '已成交': 'bg-sky-500/30 text-sky-200 border-sky-400/60',
};
const TAG_COLOR_DEFAULT = 'bg-slate-800/60 text-slate-300 border-slate-700/60 hover:bg-slate-700/60';
const TAG_COLOR_DEFAULT_ACTIVE = 'bg-slate-700 text-white border-slate-500/60';

/** 取得 timestamp seconds（兼容 Firestore Timestamp + ISO string + 已轉成 Date 的舊資料） */
function tsSeconds(v: any): number {
  if (!v) return 0;
  if (typeof v?.seconds === 'number') return v.seconds;            // Firestore Timestamp
  if (typeof v?.toDate === 'function') return v.toDate().getTime() / 1000;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t / 1000 : 0;
  }
  if (v instanceof Date) return v.getTime() / 1000;
  return 0;
}

const ClientsTab: React.FC<ClientsTabProps> = ({
  clients, loading, onSelectClient, onAddClient, onEditClient, onDeleteClient, userId
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  // Sprint L1: 排序狀態（預設「最近更新」與既有 Firestore query orderBy 一致，第一眼順序不變）
  const [sortBy, setSortBy] = useState<SortKey>('updated');
  // 被選中的 tag — 多選，OR 邏輯（選中 任一 即顯示），符合「快速找出可能客戶」的直覺
  const [filterTags, setFilterTags] = useState<string[]>([]);
  // 自訂 tag 輸入面板 — 預設關，避免污染 list view
  const [editingTagsFor, setEditingTagsFor] = useState<string | null>(null);
  const [customTagInput, setCustomTagInput] = useState('');
  const [savingTagFor, setSavingTagFor] = useState<string | null>(null);

  // 從現有 clients 抓所有出現過的 tag — 自訂 tag 也會被加進來，方便再次選用
  const allKnownTags = useMemo(() => {
    const set = new Set<string>(DEFAULT_TAGS);
    clients.forEach(c => {
      if (Array.isArray(c.tags)) c.tags.forEach((t: any) => { if (typeof t === 'string' && t.trim()) set.add(t); });
    });
    return Array.from(set);
  }, [clients]);

  // 搜尋 → tag 篩選 → 排序，全部 client-side
  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const arr = clients
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.note && c.note.toLowerCase().includes(q))
      )
      // tag filter：OR 邏輯（任一命中即顯示）；filterTags 空陣列時不過濾、不 break 既有客戶（無 tags array）
      .filter(c => filterTags.length === 0 || (Array.isArray(c.tags) && filterTags.some(t => c.tags.includes(t))));

    // 排序：copy 之後 sort，避免 mutate 上游 clients prop 觸發 React 重新 render loop
    const sorted = [...arr];
    if (sortBy === 'updated') {
      sorted.sort((a, b) => tsSeconds(b.updatedAt) - tsSeconds(a.updatedAt));
    } else if (sortBy === 'name') {
      // localeCompare 加 'zh' locale — 中文姓名按筆畫/拼音排序符合台灣顧問直覺
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-Hant'));
    } else if (sortBy === 'created') {
      sorted.sort((a, b) => tsSeconds(b.createdAt) - tsSeconds(a.createdAt));
    }
    return sorted;
  }, [clients, searchTerm, filterTags, sortBy]);

  // Sprint L1: tag 寫入 — 直接 updateDoc（既有 user-scoped rule 已 cover users/{uid}/clients/{cid}）
  const toggleTagOnClient = async (client: any, tag: string) => {
    if (!userId) {
      toast.error('尚未登入，無法更新 tag');
      return;
    }
    const current: string[] = Array.isArray(client.tags) ? client.tags : [];
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    setSavingTagFor(client.id);
    try {
      await updateDoc(doc(db, 'users', userId, 'clients', client.id), { tags: next });
      // 不手動 update local state — 上游 onSnapshot 會自動帶新資料下來
    } catch (err) {
      console.error('[ClientsTab] tag update failed', err);
      toast.error('更新 tag 失敗，請稍後再試');
    } finally {
      setSavingTagFor(null);
    }
  };

  // 從現有 filter 列表 toggle — 不寫入 Firestore、純 UI state
  const toggleFilterTag = (tag: string) => {
    setFilterTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  // 自訂 tag：input enter 直接套上去 + 寫進 client doc
  const handleAddCustomTag = async (client: any) => {
    const raw = customTagInput.trim();
    if (!raw) return;
    // 長度上限 12 字，避免一個 tag 撐爆卡片
    const clean = raw.slice(0, 12);
    const current: string[] = Array.isArray(client.tags) ? client.tags : [];
    if (current.includes(clean)) {
      setCustomTagInput('');
      return;
    }
    await toggleTagOnClient(client, clean);
    setCustomTagInput('');
  };

  const tagChipClass = (tag: string, active: boolean) => {
    if (active) return TAG_COLOR_ACTIVE[tag] || TAG_COLOR_DEFAULT_ACTIVE;
    return TAG_COLOR[tag] || TAG_COLOR_DEFAULT;
  };

  return (
    <div className="space-y-4">
      {/* 搜尋 + 排序 + 新增 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="搜尋客戶姓名或備註..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-2.5 pl-10 pr-4
                     text-sm text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none"
          />
        </div>

        {/* Sprint L1: sort 下拉 — 用 native select 保持輕量、無第三方依賴 */}
        <div className="relative">
          <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="appearance-none bg-slate-900/50 border border-slate-700/50 rounded-xl py-2.5 pl-9 pr-8
                     text-sm text-white focus:border-blue-500/50 outline-none cursor-pointer"
            title="排序方式"
          >
            {(Object.keys(SORT_LABEL) as SortKey[]).map(k => (
              <option key={k} value={k}>{SORT_LABEL[k]}</option>
            ))}
          </select>
        </div>

        <button
          onClick={onAddClient}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500
                   text-white text-sm font-bold rounded-xl transition-all shrink-0"
        >
          <Plus size={16} /> 新增客戶
        </button>
      </div>

      {/* Sprint L1: tag 篩選列 — 只在「有 tag 可選」或「已勾過 filter」時顯示，避免新顧問看到空 tag 列困惑 */}
      {(allKnownTags.length > 0 && clients.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
            <TagIcon size={11} /> 篩選：
          </span>
          {allKnownTags.map(tag => {
            const active = filterTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleFilterTag(tag)}
                className={`text-[11px] font-medium px-2 py-1 rounded-md border transition-all ${tagChipClass(tag, active)}`}
              >
                {tag}
              </button>
            );
          })}
          {filterTags.length > 0 && (
            <button
              onClick={() => setFilterTags([])}
              className="text-[11px] text-slate-500 hover:text-slate-300 underline ml-1"
            >
              清除
            </button>
          )}
        </div>
      )}

      {/* 客戶列表 */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">
          <Loader2 className="animate-spin mx-auto mb-3" size={28} />
          <span className="text-sm">載入中...</span>
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(client => {
            // Sprint 6: 客戶資料完整度（X/7）— 故意不把 0 染紅，避免「逼填」感
            const filled = countClientProfileFields(client);
            // 顏色階梯：0 → 淡灰（不催促）、1-6 → 藍（進度感）、7 → 翠綠（完成感）
            const completenessClass = filled === 0
              ? 'bg-slate-800/60 text-slate-500 border border-slate-700/50'
              : filled === CLIENT_PROFILE_TOTAL
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-blue-500/15 text-blue-400 border border-blue-500/30';

            const clientTags: string[] = Array.isArray(client.tags) ? client.tags : [];
            const isEditingThis = editingTagsFor === client.id;

            return (
            <div
              key={client.id}
              onClick={() => onSelectClient(client)}
              className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4 cursor-pointer
                       hover:border-blue-500/30 hover:bg-slate-800/50 transition-all group relative"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600
                               flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {client.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="font-bold text-white text-sm truncate">{client.name}</div>
                    {/* 示範客戶徽章 — 提示這是 onboarding seed 出來的、可隨時刪除 */}
                    {client.isSample && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                        示範
                      </span>
                    )}
                    {/* 資料完整度徽章 — 鼓勵填、不催促 */}
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${completenessClass}`}
                      title="客戶資料完整度 — 填越多、工具帶入越精準"
                    >
                      資料 {filled}/{CLIENT_PROFILE_TOTAL}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {client.updatedAt?.toDate?.().toLocaleDateString() || ''}
                  </div>
                </div>
              </div>

              {client.note && (
                <p className="text-xs text-slate-500 truncate">{client.note}</p>
              )}

              {/* Sprint L1: 已套用的 tag chips（卡片預設顯示）+ 「+ tag」開關 */}
              {(clientTags.length > 0 || isEditingThis) && (
                <div className="mt-2 flex items-center gap-1 flex-wrap">
                  {clientTags.map(t => (
                    <span
                      key={t}
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${tagChipClass(t, true)}`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* tag 編輯面板 — 展開後顯示所有可選 tag + 自訂輸入。click 不冒泡到 card onClick */}
              {isEditingThis && (
                <div
                  onClick={e => e.stopPropagation()}
                  className="mt-2 p-2 bg-slate-950/60 border border-slate-800 rounded-lg space-y-2"
                >
                  <div className="flex items-center gap-1 flex-wrap">
                    {allKnownTags.map(tag => {
                      const active = clientTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTagOnClient(client, tag)}
                          disabled={savingTagFor === client.id}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border transition-all disabled:opacity-50 ${tagChipClass(tag, active)}`}
                        >
                          {active && <Check size={10} className="inline mr-0.5" />}
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={customTagInput}
                      onChange={e => setCustomTagInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomTag(client);
                        }
                      }}
                      placeholder="自訂 tag (Enter 套用)"
                      maxLength={12}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white
                               placeholder:text-slate-600 focus:border-blue-500/50 outline-none"
                    />
                    <button
                      onClick={() => handleAddCustomTag(client)}
                      disabled={!customTagInput.trim() || savingTagFor === client.id}
                      className="text-[10px] px-2 py-1 bg-blue-600/30 text-blue-300 rounded border border-blue-500/30 hover:bg-blue-600/50 transition-all disabled:opacity-30"
                    >
                      加入
                    </button>
                    <button
                      onClick={() => { setEditingTagsFor(null); setCustomTagInput(''); }}
                      className="text-slate-500 hover:text-slate-300 p-1"
                      title="關閉"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}

              {/* Hover 操作 — Sprint L1 新增 tag 編輯按鈕（中間那顆 TagIcon） */}
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                {userId && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setEditingTagsFor(prev => prev === client.id ? null : client.id);
                      setCustomTagInput('');
                    }}
                    className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                    title="編輯 tag"
                  >
                    <TagIcon size={14} />
                  </button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); onEditClient(client); }}
                  className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (window.confirm(`確定要刪除 ${client.name} 的檔案嗎？`)) onDeleteClient(client.id);
                  }}
                  className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-500">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">
            {searchTerm || filterTags.length > 0 ? '找不到符合的客戶' : '尚未建立客戶檔案'}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {searchTerm || filterTags.length > 0 ? '試著調整搜尋或清除 tag 篩選' : '建立客戶後即可使用所有分析工具，產出專業提案'}
          </p>
          {!searchTerm && filterTags.length === 0 && (
            <button onClick={onAddClient}
              className="mt-4 px-6 py-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 text-sm font-bold rounded-xl hover:bg-blue-600/30 transition-all">
              <Plus size={14} className="inline mr-1" /> 新增第一位客戶
            </button>
          )}
        </div>
      )}

      {/* 底部提示 — 自然引導，不推銷 */}
      {clients.length > 0 && (
        <p className="text-center text-xs text-slate-600 pt-2">
          點擊客戶卡片即可進入分析工具
        </p>
      )}
    </div>
  );
};

export default ClientsTab;
