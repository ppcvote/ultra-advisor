import React, { useState, useEffect } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, note: string) => Promise<void>;
}

const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) { setName(''); setNote(''); }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onAdd(name, note);
      onClose();
    } catch { alert('新增失敗'); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <Plus className="text-purple-400" size={24} /> 新增客戶
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><X size={24} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm text-slate-400 font-bold mb-2 block">客戶姓名</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="例如：王小明" autoFocus
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none" />
          </div>
          <div>
            <label className="text-sm text-slate-400 font-bold mb-2 block">備註（選填）</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="例如：工程師，年收 150 萬..." rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none resize-none" />
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-slate-800">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl font-bold hover:bg-slate-700 transition-all">取消</button>
          <button onClick={handleSubmit} disabled={!name.trim() || loading}
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} 建立檔案
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddClientModal;
