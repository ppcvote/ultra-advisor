import React, { useState } from 'react';
import { Users, Search, Plus, Edit3, Trash2, Loader2 } from 'lucide-react';

interface ClientsTabProps {
  clients: any[];
  loading: boolean;
  onSelectClient: (client: any) => void;
  onAddClient: () => void;
  onEditClient: (client: any) => void;
  onDeleteClient: (clientId: string) => void;
}

const ClientsTab: React.FC<ClientsTabProps> = ({
  clients, loading, onSelectClient, onAddClient, onEditClient, onDeleteClient
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.note && c.note.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* 搜尋 + 新增 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
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
        <button
          onClick={onAddClient}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500
                   text-white text-sm font-bold rounded-xl transition-all shrink-0"
        >
          <Plus size={16} /> 新增客戶
        </button>
      </div>

      {/* 客戶列表 */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">
          <Loader2 className="animate-spin mx-auto mb-3" size={28} />
          <span className="text-sm">載入中...</span>
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(client => (
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
                  <div className="font-bold text-white text-sm truncate">{client.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {client.updatedAt?.toDate?.().toLocaleDateString() || ''}
                  </div>
                </div>
              </div>
              {client.note && (
                <p className="text-xs text-slate-500 truncate">{client.note}</p>
              )}

              {/* Hover 操作 */}
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
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
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-slate-500">
          <Users size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">
            {searchTerm ? '找不到符合的客戶' : '尚未建立客戶檔案'}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {searchTerm ? '試著調整搜尋關鍵字' : '建立客戶後即可使用所有分析工具，產出專業提案'}
          </p>
          {!searchTerm && (
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
