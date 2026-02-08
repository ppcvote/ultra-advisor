/**
 * 健診客戶選擇器
 * 進入保單健診前，先選擇或新建客戶
 */
import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, onSnapshot, query, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Search, Plus, User, X, ArrowRight } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  note?: string;
}

interface CheckupClientSelectorProps {
  userId: string;
  onClientSelected: (clientId: string, clientName: string) => void;
  onCancel: () => void;
}

export default function CheckupClientSelector({ userId, onClientSelected, onCancel }: CheckupClientSelectorProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // 監聽客戶列表
  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'users', userId, 'clients'),
      orderBy('updatedAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
      setLoading(false);
    });
    return () => unsub();
  }, [userId]);

  const filtered = searchText
    ? clients.filter(c => c.name.includes(searchText))
    : clients;

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    const ref = await addDoc(
      collection(db, 'users', userId, 'clients'),
      { name: newName.trim(), note: '', createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
    );
    setCreating(false);
    onClientSelected(ref.id, newName.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* 標題 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 className="text-lg font-bold text-slate-800">選擇客戶</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <p className="px-6 text-xs text-slate-400 mb-3">保單健診資料會綁定到所選客戶</p>

        {/* 搜尋 */}
        <div className="px-6 mb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="搜尋客戶..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 客戶列表 */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">
              {searchText ? '找不到符合的客戶' : '尚無客戶，請先新增'}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(client => (
                <button
                  key={client.id}
                  onClick={() => onClientSelected(client.id, client.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <User size={18} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-700 truncate">{client.name}</div>
                    {client.note && (
                      <div className="text-xs text-slate-400 truncate">{client.note}</div>
                    )}
                  </div>
                  <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 新增客戶 */}
        <div className="border-t px-6 py-4">
          {showNewClient ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="客戶姓名"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
              >
                {creating ? '...' : '建立並開始'}
              </button>
              <button
                onClick={() => { setShowNewClient(false); setNewName(''); }}
                className="px-3 py-2 border rounded-lg text-sm text-slate-500 hover:bg-slate-50"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewClient(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors text-sm font-medium"
            >
              <Plus size={16} /> 新增客戶
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
