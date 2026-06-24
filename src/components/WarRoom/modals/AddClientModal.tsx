import React, { useState, useEffect } from 'react';
import { Plus, X, Loader2, ChevronDown, ChevronRight, Info } from 'lucide-react';
import {
  ClientProfile,
  FamilyStatus,
  RiskTolerance,
  FAMILY_STATUS_LABELS,
  RISK_TOLERANCE_LABELS,
} from '../../../types/clientProfile';
import { toast } from '../../../utils/toast';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Sprint 6: 從 (name, note) 擴成 (name, note, profile)。profile 可全空（既有流程不變慢）
  onAdd: (name: string, note: string, profile: ClientProfile) => Promise<void>;
}

const EMPTY_PROFILE: ClientProfile = {};

/**
 * 把 input 字串安全轉成 number；空字串 / NaN 都回傳 undefined，
 * 避免把 0 / NaN 混在一起讓 Firestore 收到 NaN 噴錯。
 */
function parseNumOrUndef(v: string): number | undefined {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [profile, setProfile] = useState<ClientProfile>(EMPTY_PROFILE);
  const [advancedOpen, setAdvancedOpen] = useState(false);  // 預設摺疊，保留快速新增體驗
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setNote('');
      setProfile(EMPTY_PROFILE);
      setAdvancedOpen(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onAdd(name, note, profile);
      onClose();
    } catch (err) {
      console.error('[AddClientModal]', err);
      toast.error('新增失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <Plus className="text-purple-400" size={24} /> 新增客戶
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><X size={24} /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
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

          {/* 進階資料摺疊區 — 預設關起來；填了之後下個 sprint 工具可一鍵帶入 */}
          <button
            type="button"
            onClick={() => setAdvancedOpen(o => !o)}
            className="w-full flex items-center justify-between py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              {advancedOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span className="font-bold">進階資料</span>
              <span className="text-xs text-slate-500 font-normal">— 填了之後可一鍵帶入 14 工具試算</span>
            </span>
          </button>

          {advancedOpen && (
            <div className="space-y-3 pl-2 border-l-2 border-slate-800">
              {/* 一行小提示，讓顧問知道全是 optional */}
              <p className="text-[11px] text-slate-500 flex items-start gap-1 pl-2">
                <Info size={11} className="mt-0.5 shrink-0" />
                全部選填、空著也能存。下個版本會在工具的對應欄位旁出現「使用 {name || '客戶'} 的資料」chip。
              </p>

              {/* 年齡 + 月收入 */}
              <div className="grid grid-cols-2 gap-3 pl-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">年齡</label>
                  <input
                    type="number" min={0} max={120} inputMode="numeric"
                    value={profile.age ?? ''}
                    onChange={e => setProfile(p => ({ ...p, age: parseNumOrUndef(e.target.value) }))}
                    placeholder="例如 45"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">月收入（NTD）</label>
                  <input
                    type="number" min={0} inputMode="numeric"
                    value={profile.monthlyIncome ?? ''}
                    onChange={e => setProfile(p => ({ ...p, monthlyIncome: parseNumOrUndef(e.target.value) }))}
                    placeholder="例如 80000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* 家庭狀況 + 子女人數 */}
              <div className="grid grid-cols-2 gap-3 pl-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">家庭狀況</label>
                  <select
                    value={profile.familyStatus ?? ''}
                    onChange={e => setProfile(p => ({
                      ...p,
                      familyStatus: (e.target.value || undefined) as FamilyStatus | undefined,
                    }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:border-purple-500 outline-none"
                  >
                    <option value="">未填</option>
                    {(Object.keys(FAMILY_STATUS_LABELS) as FamilyStatus[]).map(k => (
                      <option key={k} value={k}>{FAMILY_STATUS_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">子女人數</label>
                  <input
                    type="number" min={0} max={20} inputMode="numeric"
                    value={profile.childrenCount ?? ''}
                    onChange={e => setProfile(p => ({ ...p, childrenCount: parseNumOrUndef(e.target.value) }))}
                    placeholder="例如 2"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* 退休年齡 + 風險屬性 */}
              <div className="grid grid-cols-2 gap-3 pl-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">預期退休年齡</label>
                  <input
                    type="number" min={40} max={90} inputMode="numeric"
                    value={profile.retirementAge ?? ''}
                    onChange={e => setProfile(p => ({ ...p, retirementAge: parseNumOrUndef(e.target.value) }))}
                    placeholder="預設 65"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">風險屬性</label>
                  <select
                    value={profile.riskTolerance ?? ''}
                    onChange={e => setProfile(p => ({
                      ...p,
                      riskTolerance: (e.target.value || undefined) as RiskTolerance | undefined,
                    }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:border-purple-500 outline-none"
                  >
                    <option value="">未填</option>
                    {(Object.keys(RISK_TOLERANCE_LABELS) as RiskTolerance[]).map(k => (
                      <option key={k} value={k}>{RISK_TOLERANCE_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 期望退休後月所得 + 扶養父母人數 — 同一行 */}
              <div className="grid grid-cols-2 gap-3 pl-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">期望退休後月所得（NTD）</label>
                  <input
                    type="number" min={0} inputMode="numeric"
                    value={profile.desiredMonthlyRetirementIncome ?? ''}
                    onChange={e => setProfile(p => ({ ...p, desiredMonthlyRetirementIncome: parseNumOrUndef(e.target.value) }))}
                    placeholder="例如 60000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  {/* Sprint 7: 扶養父母人數 — TaxPlannerTool.parents 對映用，一般 0-2 */}
                  <label className="text-xs text-slate-400 mb-1 block">扶養父母人數</label>
                  <input
                    type="number" min={0} max={2} inputMode="numeric"
                    value={profile.dependentParents ?? ''}
                    onChange={e => setProfile(p => ({ ...p, dependentParents: parseNumOrUndef(e.target.value) }))}
                    placeholder="例如 1"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-sm text-white focus:border-purple-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-slate-800 shrink-0">
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
