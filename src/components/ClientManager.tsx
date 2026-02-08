import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, Plus, Search, Edit3, Trash2, Save, ChevronLeft, Users,
  Loader2, Phone, Calendar, FileText, AlertTriangle
} from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

// ============================================================
// 型別定義
// ============================================================

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  clients: any[];
}

type ViewState = 'list' | 'detail' | 'add' | 'edit';

interface ClientFormData {
  name: string;
  phone: string;
  birthday: string;
  note: string;
}

const EMPTY_FORM: ClientFormData = {
  name: '',
  phone: '',
  birthday: '',
  note: '',
};

// ============================================================
// 保單階層視圖（要保人 > 被保人）
// ============================================================

interface PolicyHierarchyViewProps {
  policies: any[];
  formatCurrency: (amount: number) => string;
}

const PolicyHierarchyView: React.FC<PolicyHierarchyViewProps> = ({ policies, formatCurrency }) => {
  const [expandedApplicants, setExpandedApplicants] = useState<Set<string>>(new Set());

  // 依據要保人分組，再依被保險人分組
  const hierarchy = useMemo(() => {
    const applicantMap = new Map<string, Map<string, any[]>>();

    policies.forEach(policy => {
      const applicant = policy.applicant || '未知要保人';
      const insured = policy.insured || policy.applicant || '未知被保人';

      if (!applicantMap.has(applicant)) {
        applicantMap.set(applicant, new Map());
      }
      const insuredMap = applicantMap.get(applicant)!;

      if (!insuredMap.has(insured)) {
        insuredMap.set(insured, []);
      }
      insuredMap.get(insured)!.push(policy);
    });

    return applicantMap;
  }, [policies]);

  const toggleApplicant = (applicant: string) => {
    setExpandedApplicants(prev => {
      const next = new Set(prev);
      if (next.has(applicant)) {
        next.delete(applicant);
      } else {
        next.add(applicant);
      }
      return next;
    });
  };

  // 預設展開所有
  useEffect(() => {
    setExpandedApplicants(new Set(hierarchy.keys()));
  }, [hierarchy]);

  return (
    <div className="space-y-3">
      {Array.from(hierarchy.entries()).map(([applicant, insuredMap]) => {
        const isExpanded = expandedApplicants.has(applicant);
        const totalPolicies = Array.from(insuredMap.values()).flat().length;
        const totalPremium = Array.from(insuredMap.values())
          .flat()
          .reduce((sum, p) => sum + (p.totalAnnualPremium || p.annualPremium || 0), 0);

        return (
          <div key={applicant} className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            {/* 要保人標題列 */}
            <button
              onClick={() => toggleApplicant(applicant)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600/20 rounded-full flex items-center justify-center text-purple-400 font-bold text-sm">
                  {applicant.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{applicant}</span>
                    <span className="text-[10px] bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded">
                      要保人
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {totalPolicies} 張保單 · 年繳 {formatCurrency(totalPremium)}
                  </div>
                </div>
              </div>
              <ChevronLeft
                className={`w-4 h-4 text-slate-500 transition-transform ${
                  isExpanded ? '-rotate-90' : 'rotate-180'
                }`}
              />
            </button>

            {/* 展開內容：被保險人列表 */}
            {isExpanded && (
              <div className="border-t border-slate-800">
                {Array.from(insuredMap.entries()).map(([insured, insuredPolicies]) => {
                  const isSelf = insured === applicant;
                  const insuredPremium = insuredPolicies.reduce(
                    (sum, p) => sum + (p.totalAnnualPremium || p.annualPremium || 0),
                    0
                  );

                  return (
                    <div key={insured} className="border-b border-slate-800/50 last:border-b-0">
                      {/* 被保險人標題 */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-slate-950/30">
                        <div className="w-8 h-8 bg-emerald-600/20 rounded-full flex items-center justify-center text-emerald-400 font-medium text-xs">
                          {insured.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-200 text-sm font-medium">{insured}</span>
                            {isSelf ? (
                              <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                                本人
                              </span>
                            ) : (
                              <span className="text-[10px] bg-emerald-600/30 text-emerald-300 px-1.5 py-0.5 rounded">
                                被保人
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {insuredPolicies.length} 張 · {formatCurrency(insuredPremium)}
                          </div>
                        </div>
                      </div>

                      {/* 保單列表 */}
                      <div className="px-4 py-2 space-y-2">
                        {insuredPolicies.map(policy => (
                          <div
                            key={policy.id}
                            className="bg-slate-900/80 rounded-lg p-3 ml-4 border-l-2 border-slate-700"
                          >
                            <div className="flex items-start justify-between">
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm text-white font-medium">
                                  {policy.insurer || policy.insuranceCompany || '未知保險公司'}
                                </h4>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {policy.policyNumber && `#${policy.policyNumber}`}
                                  {policy.effectiveDate && ` · 生效 ${policy.effectiveDate}`}
                                </p>
                                {policy.coverages && policy.coverages.length > 0 && (
                                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                                    {policy.coverages.map((c: any) => c.name).filter(Boolean).join('、')}
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0 ml-3">
                                <p className="text-sm text-emerald-400 font-medium">
                                  {formatCurrency(policy.totalAnnualPremium || policy.annualPremium)}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {policy.paymentFrequency || '年繳'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// 主元件
// ============================================================

const ClientManager: React.FC<Props> = ({ isOpen, onClose, user, clients }) => {
  // --- State ---
  const [view, setView] = useState<ViewState>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [formData, setFormData] = useState<ClientFormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 保單列表（用於計算關聯保單數）
  const [policies, setPolicies] = useState<any[]>([]);

  // --- 重置 ---
  useEffect(() => {
    if (isOpen) {
      setView('list');
      setSearchQuery('');
      setSelectedClient(null);
      setFormData({ ...EMPTY_FORM });
      setDeleteConfirmId(null);
    }
  }, [isOpen]);

  // --- 監聽保單列表 ---
  useEffect(() => {
    if (!user?.uid || !isOpen) return;

    const q = query(
      collection(db, `users/${user.uid}/insurancePolicies`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setPolicies(list);
    });

    return () => unsubscribe();
  }, [user?.uid, isOpen]);

  // --- 搜尋過濾 ---
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.note || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  }, [clients, searchQuery]);

  // --- 每位客戶的保單數量 ---
  const policyCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    policies.forEach(p => {
      if (p.clientId) {
        map[p.clientId] = (map[p.clientId] || 0) + 1;
      }
    });
    return map;
  }, [policies]);

  // --- 選中客戶的關聯保單 ---
  const clientPolicies = useMemo(() => {
    if (!selectedClient) return [];
    return policies.filter(p => p.clientId === selectedClient.id);
  }, [policies, selectedClient]);

  // --- CRUD ---
  const handleSaveClient = useCallback(async () => {
    if (!user?.uid || !formData.name.trim()) return;
    setSaving(true);
    try {
      if (view === 'edit' && selectedClient?.id) {
        // 更新
        await updateDoc(doc(db, `users/${user.uid}/clients`, selectedClient.id), {
          name: formData.name.trim(),
          phone: formData.phone.trim() || undefined,
          birthday: formData.birthday || undefined,
          note: formData.note.trim(),
          updatedAt: Timestamp.now(),
        });
        // 更新 selectedClient 以便返回 detail 時顯示最新資料
        setSelectedClient({
          ...selectedClient,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          birthday: formData.birthday,
          note: formData.note.trim(),
        });
        setView('detail');
      } else {
        // 新增
        await addDoc(collection(db, `users/${user.uid}/clients`), {
          name: formData.name.trim(),
          phone: formData.phone.trim() || undefined,
          birthday: formData.birthday || undefined,
          note: formData.note.trim(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
        setView('list');
      }
      setFormData({ ...EMPTY_FORM });
    } catch (error) {
      console.error('[ClientManager] Save error:', error);
      alert('儲存失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  }, [user?.uid, formData, view, selectedClient]);

  const handleDeleteClient = useCallback(async (clientId: string) => {
    if (!user?.uid) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/clients`, clientId));
      setDeleteConfirmId(null);
      setSelectedClient(null);
      setView('list');
    } catch (error) {
      console.error('[ClientManager] Delete error:', error);
      alert('刪除失敗，請稍後再試');
    }
  }, [user?.uid]);

  // --- 進入編輯 ---
  const enterEdit = (client: any) => {
    setFormData({
      name: client.name || '',
      phone: client.phone || '',
      birthday: client.birthday || '',
      note: client.note || '',
    });
    setView('edit');
  };

  // --- 進入詳情 ---
  const enterDetail = (client: any) => {
    setSelectedClient(client);
    setView('detail');
  };

  // --- 格式化日期 ---
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return '-';
    if (typeof dateValue === 'string') return dateValue;
    if (dateValue?.toDate) {
      return dateValue.toDate().toLocaleDateString('zh-TW');
    }
    return '-';
  };

  // --- 格式化金額 ---
  const formatCurrency = (amount: number): string => {
    if (!amount) return '-';
    return `NT$ ${amount.toLocaleString()}`;
  };

  // ============================================================
  // BackButton 元件
  // ============================================================
  const BackButton = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-slate-400 hover:text-white mb-4 transition-colors"
    >
      <ChevronLeft className="w-4 h-4" />
      <span className="text-sm">返回</span>
    </button>
  );

  // ============================================================
  // 列表視圖
  // ============================================================
  const renderListView = () => (
    <div className="flex flex-col h-full">
      {/* 標頭 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">客戶管理</h2>
            <p className="text-xs text-slate-400">共 {clients.length} 位客戶</p>
          </div>
        </div>
        <button
          onClick={() => {
            setFormData({ ...EMPTY_FORM });
            setView('add');
          }}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增客戶
        </button>
      </div>

      {/* 搜尋 */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜尋客戶姓名、備註、電話..."
          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-emerald-500 outline-none placeholder:text-slate-600"
        />
      </div>

      {/* 客戶列表 */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filteredClients.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              {searchQuery ? '找不到符合的客戶' : '尚未新增客戶'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => {
                  setFormData({ ...EMPTY_FORM });
                  setView('add');
                }}
                className="mt-3 text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
              >
                + 新增第一位客戶
              </button>
            )}
          </div>
        ) : (
          filteredClients.map(client => {
            const count = policyCountMap[client.id] || 0;
            return (
              <div
                key={client.id}
                onClick={() => enterDetail(client)}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 cursor-pointer
                           hover:border-emerald-500/40 hover:bg-slate-800/60 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* 頭像 */}
                    <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 border border-slate-700">
                      {(client.name || '?').charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-medium truncate">{client.name}</h3>
                        {count > 0 && (
                          <span className="text-[10px] bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                            {count} 張保單
                          </span>
                        )}
                      </div>
                      {client.phone && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />
                          {client.phone}
                        </p>
                      )}
                      {client.note && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{client.note}</p>
                      )}
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-600 rotate-180 group-hover:text-emerald-400 transition-colors shrink-0" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // ============================================================
  // 詳情視圖
  // ============================================================
  const renderDetailView = () => {
    if (!selectedClient) return null;

    return (
      <div className="flex flex-col h-full">
        <BackButton onClick={() => {
          setSelectedClient(null);
          setView('list');
        }} />

        {/* 客戶資訊卡 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-emerald-600/20 rounded-full flex items-center justify-center text-emerald-400 font-bold text-xl border-2 border-emerald-500/30">
                {(selectedClient.name || '?').charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{selectedClient.name}</h2>
                <p className="text-xs text-slate-500">
                  建立於 {formatDate(selectedClient.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => enterEdit(selectedClient)}
                className="p-2 text-slate-400 hover:text-emerald-400 transition-colors"
                title="編輯"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeleteConfirmId(selectedClient.id)}
                className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                title="刪除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 客戶欄位 */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '電話', value: selectedClient.phone || '-', icon: Phone },
              { label: '生日', value: selectedClient.birthday || '-', icon: Calendar },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-slate-950/50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3 h-3 text-slate-500" />
                  <span className="text-[11px] text-slate-500">{label}</span>
                </div>
                <p className="text-sm text-white">{value}</p>
              </div>
            ))}
          </div>

          {selectedClient.note && (
            <div className="mt-3 bg-slate-950/50 rounded-xl p-3">
              <span className="text-[11px] text-slate-500 block mb-1">備註</span>
              <p className="text-sm text-slate-300">{selectedClient.note}</p>
            </div>
          )}
        </div>

        {/* 關聯保單 - 以要保人 > 被保人階層顯示 */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">
              關聯保單（{clientPolicies.length} 張）
            </h3>
          </div>

          {clientPolicies.length === 0 ? (
            <div className="text-center py-10 bg-slate-900/30 rounded-xl">
              <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">尚無關聯保單</p>
            </div>
          ) : (
            <PolicyHierarchyView policies={clientPolicies} formatCurrency={formatCurrency} />
          )}
        </div>

        {/* 刪除確認 */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-600/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-white font-bold">確認刪除</h3>
              </div>
              <p className="text-slate-300 text-sm mb-2">
                確定要刪除客戶「{selectedClient?.name}」嗎？
              </p>
              <p className="text-slate-500 text-xs mb-6">
                此操作無法復原。該客戶的關聯保單不會被刪除，但會失去客戶關聯。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDeleteClient(deleteConfirmId)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  確認刪除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // 新增/編輯表單
  // ============================================================
  const renderFormView = () => {
    const isEdit = view === 'edit';

    return (
      <div className="flex flex-col h-full">
        <BackButton onClick={() => {
          setFormData({ ...EMPTY_FORM });
          setView(isEdit ? 'detail' : 'list');
        }} />

        <h2 className="text-xl font-bold text-white mb-1">
          {isEdit ? '編輯客戶' : '新增客戶'}
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          {isEdit ? '修改客戶基本資料' : '填寫客戶基本資料'}
        </p>

        <div className="space-y-4 flex-1">
          {/* 姓名 */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              姓名 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="請輸入客戶姓名"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-emerald-500 outline-none placeholder:text-slate-600"
            />
          </div>

          {/* 電話 */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">電話</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="0912-345-678"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-emerald-500 outline-none placeholder:text-slate-600"
            />
          </div>

          {/* 生日 */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">生日</label>
            <input
              type="date"
              value={formData.birthday}
              onChange={(e) => setFormData(prev => ({ ...prev, birthday: e.target.value }))}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-emerald-500 outline-none"
            />
          </div>

          {/* 備註 */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">備註</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
              placeholder="客戶備註..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-emerald-500 outline-none placeholder:text-slate-600 resize-none"
            />
          </div>
        </div>

        {/* 儲存按鈕 */}
        <button
          onClick={handleSaveClient}
          disabled={saving || !formData.name.trim()}
          className="w-full mt-6 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500
                     disabled:bg-slate-700 disabled:text-slate-500 text-white py-3.5 rounded-xl
                     font-bold text-sm transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              儲存中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isEdit ? '更新客戶' : '新增客戶'}
            </>
          )}
        </button>
      </div>
    );
  };

  // ============================================================
  // 主渲染
  // ============================================================
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm">
      {/* 關閉按鈕 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[110] w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* 主內容 */}
      <div className="max-w-4xl mx-auto h-full flex flex-col px-4 pt-6 pb-4 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {view === 'list' && renderListView()}
          {view === 'detail' && renderDetailView()}
          {(view === 'add' || view === 'edit') && renderFormView()}
        </div>
      </div>
    </div>
  );
};

export default ClientManager;
