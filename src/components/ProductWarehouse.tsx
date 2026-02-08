import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Plus, Search, Upload, Download, Edit3, Trash2, Save,
  ChevronLeft, Database, AlertTriangle, CheckCircle, Package,
  Loader2, Eye, Filter, FileText, Copy, RefreshCw, Building2
} from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, doc, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import {
  ProductCache, ProductCategory, PRODUCT_CATEGORY_LABELS,
  ClaimSummary, TAIWAN_INSURERS
} from '../types/insurance';

// ============================================================
// 型別定義
// ============================================================

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

type ViewState = 'list' | 'add' | 'edit' | 'detail' | 'import' | 'export';

interface ProductFormData {
  insurer: string;
  productName: string;
  productCode: string;
  category: ProductCategory;
  status: 'selling' | 'discontinued';
  effectiveDate: string;
  discontinuedDate: string;
  waitingPeriod: string;
  isCopyReceipt: boolean;
  isGuaranteedRenewal: boolean;
  claimConditions: string;
  exclusions: string;
  sourceUrl: string;
  rawDescription: string;
  // 理賠摘要簡易欄位
  deathBenefit: string;
  hospitalDaily: string;
  surgeryBenefit: string;
  medicalExpense: string;
  cancerBenefit: string;
}

const EMPTY_FORM: ProductFormData = {
  insurer: '',
  productName: '',
  productCode: '',
  category: 'medical_expense',
  status: 'selling',
  effectiveDate: '',
  discontinuedDate: '',
  waitingPeriod: '',
  isCopyReceipt: false,
  isGuaranteedRenewal: true,
  claimConditions: '',
  exclusions: '',
  sourceUrl: '',
  rawDescription: '',
  deathBenefit: '',
  hospitalDaily: '',
  surgeryBenefit: '',
  medicalExpense: '',
  cancerBenefit: '',
};

const CATEGORY_FILTERS: { key: ProductCategory | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'life_term', label: '定期壽險' },
  { key: 'life_whole', label: '終身壽險' },
  { key: 'medical_expense', label: '實支實付' },
  { key: 'medical_daily', label: '住院日額' },
  { key: 'surgery', label: '手術險' },
  { key: 'critical_illness', label: '重大疾病' },
  { key: 'major_injury', label: '重大傷病' },
  { key: 'cancer', label: '癌症險' },
  { key: 'accident', label: '意外險' },
  { key: 'accident_medical', label: '意外醫療' },
  { key: 'disability', label: '失能險' },
  { key: 'long_term_care', label: '長照險' },
];

// ============================================================
// 主元件
// ============================================================

const ProductWarehouse: React.FC<Props> = ({ isOpen, onClose, user }) => {
  // ─── 狀態 ───
  const [view, setView] = useState<ViewState>('list');
  const [products, setProducts] = useState<ProductCache[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 搜尋 & 篩選
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all');
  const [insurerFilter, setInsurerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'selling' | 'discontinued'>('all');

  // 表單
  const [formData, setFormData] = useState<ProductFormData>({ ...EMPTY_FORM });
  const [editingProduct, setEditingProduct] = useState<ProductCache | null>(null);

  // 詳情
  const [selectedProduct, setSelectedProduct] = useState<ProductCache | null>(null);

  // 匯入
  const [importText, setImportText] = useState('');
  const [importFormat, setImportFormat] = useState<'json' | 'csv'>('json');
  const [importPreview, setImportPreview] = useState<ProductCache[]>([]);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 刪除確認
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ─── Firestore 監聽（全域 productCache）───
  useEffect(() => {
    if (!user?.uid) return;

    // 商品資料庫是全域的，不在 users/{uid} 下
    const q = query(
      collection(db, 'productCache'),
      orderBy('insurer', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: ProductCache[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as ProductCache));
      setProducts(docs);
      setLoading(false);
    }, (error) => {
      console.error('ProductCache 載入錯誤:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // ─── 篩選後的商品 ───
  const filteredProducts = products.filter(p => {
    // 搜尋條件
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        p.insurer.toLowerCase().includes(q) ||
        p.productName.toLowerCase().includes(q) ||
        (p.productCode?.toLowerCase().includes(q)) ||
        (p.keywords?.some(k => k.toLowerCase().includes(q)));
      if (!match) return false;
    }
    // 分類篩選
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    // 保險公司篩選
    if (insurerFilter !== 'all' && p.insurer !== insurerFilter) return false;
    // 狀態篩選
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  // ─── 取得不重複的保險公司列表 ───
  const uniqueInsurers = [...new Set(products.map(p => p.insurer))].sort();

  // ─── 表單 -> ClaimSummary ───
  const buildClaimSummary = (form: ProductFormData): ClaimSummary => {
    const summary: ClaimSummary = {};

    if (form.deathBenefit) {
      summary.lumpSum = { death: Number(form.deathBenefit) || 0 };
    }
    if (form.hospitalDaily) {
      summary.hospitalDaily = { illness: Number(form.hospitalDaily) || 0 };
    }
    if (form.surgeryBenefit) {
      summary.surgery = { type: 'ratio', baseAmount: Number(form.surgeryBenefit) || 0 };
    }
    if (form.medicalExpense) {
      summary.actualExpense = { medicalExpense: Number(form.medicalExpense) || 0 };
    }
    if (form.cancerBenefit) {
      summary.lumpSum = { ...summary.lumpSum, cancer: Number(form.cancerBenefit) || 0 };
    }

    return summary;
  };

  // ─── 儲存商品 ───
  const handleSaveProduct = async () => {
    if (!formData.insurer || !formData.productName) {
      alert('請填寫保險公司和商品名稱');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const claimSummary = buildClaimSummary(formData);

      const productData: Omit<ProductCache, 'id'> = {
        insurer: formData.insurer,
        productName: formData.productName,
        productCode: formData.productCode || undefined,
        category: formData.category,
        keywords: [
          formData.insurer,
          formData.productName,
          formData.productCode,
          PRODUCT_CATEGORY_LABELS[formData.category]
        ].filter(Boolean) as string[],
        searchCount: 0,
        lastSearched: now,
        status: formData.status,
        effectiveDate: formData.effectiveDate || undefined,
        discontinuedDate: formData.discontinuedDate || undefined,
        waitingPeriod: formData.waitingPeriod ? Number(formData.waitingPeriod) : undefined,
        isCopyReceipt: formData.isCopyReceipt,
        isGuaranteedRenewal: formData.isGuaranteedRenewal,
        claimConditions: formData.claimConditions || undefined,
        exclusions: formData.exclusions || undefined,
        claimSummary,
        sourceUrl: formData.sourceUrl || undefined,
        rawDescription: formData.rawDescription || undefined,
        lastUpdated: now,
        updatedBy: 'manual',
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'productCache', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'productCache'), productData);
      }

      setFormData({ ...EMPTY_FORM });
      setEditingProduct(null);
      setView('list');
    } catch (error) {
      console.error('儲存商品失敗:', error);
      alert('儲存失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  // ─── 刪除商品 ───
  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'productCache', id));
      setDeleteConfirmId(null);
      if (selectedProduct?.id === id) {
        setSelectedProduct(null);
        setView('list');
      }
    } catch (error) {
      console.error('刪除商品失敗:', error);
      alert('刪除失敗');
    }
  };

  // ─── 編輯商品 ───
  const handleEditProduct = (product: ProductCache) => {
    setEditingProduct(product);
    setFormData({
      insurer: product.insurer,
      productName: product.productName,
      productCode: product.productCode || '',
      category: product.category,
      status: product.status,
      effectiveDate: product.effectiveDate || '',
      discontinuedDate: product.discontinuedDate || '',
      waitingPeriod: product.waitingPeriod?.toString() || '',
      isCopyReceipt: product.isCopyReceipt || false,
      isGuaranteedRenewal: product.isGuaranteedRenewal !== false,
      claimConditions: product.claimConditions || '',
      exclusions: product.exclusions || '',
      sourceUrl: product.sourceUrl || '',
      rawDescription: product.rawDescription || '',
      deathBenefit: product.claimSummary?.lumpSum?.death?.toString() || '',
      hospitalDaily: product.claimSummary?.hospitalDaily?.illness?.toString() || '',
      surgeryBenefit: product.claimSummary?.surgery?.baseAmount?.toString() || '',
      medicalExpense: product.claimSummary?.actualExpense?.medicalExpense?.toString() || '',
      cancerBenefit: product.claimSummary?.lumpSum?.cancer?.toString() || '',
    });
    setView('edit');
  };

  // ─── 解析匯入資料 ───
  const parseImportData = (text: string, format: 'json' | 'csv'): ProductCache[] => {
    if (format === 'json') {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      return items.map((item, idx) => ({
        id: `import-${idx}`,
        insurer: item.insurer || item.保險公司 || '',
        productName: item.productName || item.商品名稱 || '',
        productCode: item.productCode || item.商品代碼 || '',
        category: item.category || 'other',
        keywords: item.keywords || [],
        searchCount: 0,
        lastSearched: new Date().toISOString(),
        status: item.status || 'selling',
        claimSummary: item.claimSummary || {},
        lastUpdated: new Date().toISOString(),
        updatedBy: 'manual' as const,
      }));
    } else {
      // CSV 解析
      const lines = text.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      return lines.slice(1).map((line, idx) => {
        const values = line.split(',').map(v => v.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = values[i] || ''; });
        return {
          id: `import-${idx}`,
          insurer: obj['insurer'] || obj['保險公司'] || '',
          productName: obj['productName'] || obj['商品名稱'] || '',
          productCode: obj['productCode'] || obj['商品代碼'] || '',
          category: (obj['category'] || 'other') as ProductCategory,
          keywords: [],
          searchCount: 0,
          lastSearched: new Date().toISOString(),
          status: (obj['status'] || 'selling') as 'selling' | 'discontinued',
          claimSummary: {},
          lastUpdated: new Date().toISOString(),
          updatedBy: 'manual' as const,
        };
      });
    }
  };

  // ─── 預覽匯入 ───
  const handlePreviewImport = () => {
    try {
      setImportError('');
      const parsed = parseImportData(importText, importFormat);
      if (parsed.length === 0) {
        setImportError('沒有找到有效的商品資料');
        return;
      }
      setImportPreview(parsed);
    } catch (e) {
      setImportError(`解析錯誤: ${e instanceof Error ? e.message : '格式不正確'}`);
      setImportPreview([]);
    }
  };

  // ─── 執行批次匯入 ───
  const handleBatchImport = async () => {
    if (importPreview.length === 0) return;

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      importPreview.forEach((product) => {
        const ref = doc(collection(db, 'productCache'));
        batch.set(ref, {
          ...product,
          id: undefined, // Firestore 會自動生成
          lastUpdated: now,
          updatedBy: 'manual',
        });
      });

      await batch.commit();
      alert(`成功匯入 ${importPreview.length} 筆商品`);
      setImportText('');
      setImportPreview([]);
      setView('list');
    } catch (error) {
      console.error('批次匯入失敗:', error);
      alert('匯入失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  };

  // ─── 匯出商品資料 ───
  const handleExport = () => {
    const exportData = filteredProducts.map(p => ({
      insurer: p.insurer,
      productName: p.productName,
      productCode: p.productCode,
      category: p.category,
      categoryLabel: PRODUCT_CATEGORY_LABELS[p.category],
      status: p.status,
      waitingPeriod: p.waitingPeriod,
      isCopyReceipt: p.isCopyReceipt,
      isGuaranteedRenewal: p.isGuaranteedRenewal,
      claimSummary: p.claimSummary,
      effectiveDate: p.effectiveDate,
      discontinuedDate: p.discontinuedDate,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-warehouse-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── 檔案選擇 ───
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
      if (file.name.endsWith('.csv')) {
        setImportFormat('csv');
      } else {
        setImportFormat('json');
      }
    };
    reader.readAsText(file);
  };

  // ============================================================
  // 渲染函數
  // ============================================================

  // ─── 列表視圖 ───
  const renderListView = () => (
    <div className="flex flex-col h-full">
      {/* 搜尋與篩選區 */}
      <div className="p-4 border-b border-slate-700/50 space-y-3">
        {/* 搜尋框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜尋商品名稱、代碼、保險公司..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        {/* 篩選器 */}
        <div className="flex flex-wrap gap-2">
          {/* 保險公司 */}
          <select
            value={insurerFilter}
            onChange={e => setInsurerFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-800/50 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none"
          >
            <option value="all">全部公司</option>
            {uniqueInsurers.map(ins => (
              <option key={ins} value={ins}>{ins}</option>
            ))}
          </select>

          {/* 分類 */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value as ProductCategory | 'all')}
            className="px-3 py-1.5 bg-slate-800/50 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none"
          >
            {CATEGORY_FILTERS.map(f => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>

          {/* 狀態 */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as 'all' | 'selling' | 'discontinued')}
            className="px-3 py-1.5 bg-slate-800/50 border border-slate-600/50 rounded-lg text-sm text-white focus:outline-none"
          >
            <option value="all">全部狀態</option>
            <option value="selling">銷售中</option>
            <option value="discontinued">已停售</option>
          </select>
        </div>

        {/* 統計 & 操作按鈕 */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            共 <span className="text-amber-400 font-medium">{filteredProducts.length}</span> 筆商品
            {filteredProducts.length !== products.length && (
              <span className="text-slate-500">（共 {products.length} 筆）</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView('import')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 rounded-lg text-sm text-slate-300 transition-colors"
            >
              <Upload className="w-4 h-4" />
              匯入
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 rounded-lg text-sm text-slate-300 transition-colors"
            >
              <Download className="w-4 h-4" />
              匯出
            </button>
            <button
              onClick={() => {
                setFormData({ ...EMPTY_FORM });
                setEditingProduct(null);
                setView('add');
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-lg text-sm text-white font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              新增商品
            </button>
          </div>
        </div>
      </div>

      {/* 商品列表 */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Database className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg">尚無商品資料</p>
            <p className="text-sm mt-1">點擊「新增商品」或「匯入」開始建立資料庫</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => {
                  setSelectedProduct(product);
                  setView('detail');
                }}
                className="group p-4 bg-gradient-to-r from-slate-800/80 to-slate-800/40 border border-slate-700/50 hover:border-amber-500/30 rounded-xl cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                        {product.insurer}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        product.status === 'selling'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {product.status === 'selling' ? '銷售中' : '已停售'}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                        {PRODUCT_CATEGORY_LABELS[product.category]}
                      </span>
                    </div>
                    <h3 className="text-white font-medium group-hover:text-amber-400 transition-colors">
                      {product.productName}
                    </h3>
                    {product.productCode && (
                      <p className="text-xs text-slate-500 mt-0.5">代碼：{product.productCode}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditProduct(product);
                      }}
                      className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(product.id);
                      }}
                      className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 快速摘要 */}
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-400">
                  {product.isCopyReceipt && (
                    <span className="flex items-center gap-1">
                      <Copy className="w-3 h-3" /> 副本理賠
                    </span>
                  )}
                  {product.isGuaranteedRenewal && (
                    <span className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> 保證續保
                    </span>
                  )}
                  {product.waitingPeriod && (
                    <span>等待期 {product.waitingPeriod} 天</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ─── 表單視圖（新增/編輯）───
  const renderFormView = () => (
    <div className="flex flex-col h-full">
      {/* 標題列 */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-700/50">
        <button
          onClick={() => {
            setView('list');
            setEditingProduct(null);
            setFormData({ ...EMPTY_FORM });
          }}
          className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-white">
          {editingProduct ? '編輯商品' : '新增商品'}
        </h2>
      </div>

      {/* 表單內容 */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* 基本資訊 */}
        <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl space-y-4">
          <h3 className="text-sm font-medium text-amber-400 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            基本資訊
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">保險公司 *</label>
              <select
                value={formData.insurer}
                onChange={e => setFormData(prev => ({ ...prev, insurer: e.target.value }))}
                className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="">選擇保險公司</option>
                {TAIWAN_INSURERS.map(ins => (
                  <option key={ins.code} value={ins.name}>{ins.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">險種分類 *</label>
              <select
                value={formData.category}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value as ProductCategory }))}
                className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {Object.entries(PRODUCT_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">商品名稱 *</label>
            <input
              type="text"
              value={formData.productName}
              onChange={e => setFormData(prev => ({ ...prev, productName: e.target.value }))}
              placeholder="例：真心幸福住院醫療終身保險附約"
              className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">商品代碼</label>
              <input
                type="text"
                value={formData.productCode}
                onChange={e => setFormData(prev => ({ ...prev, productCode: e.target.value }))}
                placeholder="例：HIR"
                className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">銷售狀態</label>
              <select
                value={formData.status}
                onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as 'selling' | 'discontinued' }))}
                className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="selling">銷售中</option>
                <option value="discontinued">已停售</option>
              </select>
            </div>
          </div>
        </div>

        {/* 商品特性 */}
        <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl space-y-4">
          <h3 className="text-sm font-medium text-emerald-400 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            商品特性
          </h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">等待期（天）</label>
              <input
                type="number"
                value={formData.waitingPeriod}
                onChange={e => setFormData(prev => ({ ...prev, waitingPeriod: e.target.value }))}
                placeholder="30"
                className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isCopyReceipt}
                  onChange={e => setFormData(prev => ({ ...prev, isCopyReceipt: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm text-slate-300">副本理賠</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isGuaranteedRenewal}
                  onChange={e => setFormData(prev => ({ ...prev, isGuaranteedRenewal: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm text-slate-300">保證續保</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">理賠條件說明</label>
            <textarea
              value={formData.claimConditions}
              onChange={e => setFormData(prev => ({ ...prev, claimConditions: e.target.value }))}
              placeholder="詳述理賠條件與限制..."
              rows={3}
              className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">除外責任</label>
            <textarea
              value={formData.exclusions}
              onChange={e => setFormData(prev => ({ ...prev, exclusions: e.target.value }))}
              placeholder="不保事項、除外責任..."
              rows={3}
              className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
            />
          </div>
        </div>

        {/* 理賠金額（簡易版）*/}
        <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl space-y-4">
          <h3 className="text-sm font-medium text-blue-400 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            理賠金額（每單位）
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">身故保險金</label>
              <input
                type="number"
                value={formData.deathBenefit}
                onChange={e => setFormData(prev => ({ ...prev, deathBenefit: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">住院日額</label>
              <input
                type="number"
                value={formData.hospitalDaily}
                onChange={e => setFormData(prev => ({ ...prev, hospitalDaily: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">手術保險金</label>
              <input
                type="number"
                value={formData.surgeryBenefit}
                onChange={e => setFormData(prev => ({ ...prev, surgeryBenefit: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">醫療雜費限額</label>
              <input
                type="number"
                value={formData.medicalExpense}
                onChange={e => setFormData(prev => ({ ...prev, medicalExpense: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">癌症一次金</label>
              <input
                type="number"
                value={formData.cancerBenefit}
                onChange={e => setFormData(prev => ({ ...prev, cancerBenefit: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
          </div>
        </div>

        {/* 原始資料 */}
        <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl space-y-4">
          <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Database className="w-4 h-4" />
            原始資料（選填）
          </h3>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">資料來源網址</label>
            <input
              type="url"
              value={formData.sourceUrl}
              onChange={e => setFormData(prev => ({ ...prev, sourceUrl: e.target.value }))}
              placeholder="https://..."
              className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">原始條款描述</label>
            <textarea
              value={formData.rawDescription}
              onChange={e => setFormData(prev => ({ ...prev, rawDescription: e.target.value }))}
              placeholder="從雲華陀或條款 PDF 複製的原始內容..."
              rows={5}
              className="w-full px-3 py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
            />
          </div>
        </div>
      </div>

      {/* 儲存按鈕 */}
      <div className="p-4 border-t border-slate-700/50">
        <button
          onClick={handleSaveProduct}
          disabled={saving || !formData.insurer || !formData.productName}
          className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-slate-600 disabled:to-slate-600 rounded-xl text-white font-medium transition-all flex items-center justify-center gap-2"
        >
          {saving ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> 儲存中...</>
          ) : (
            <><Save className="w-5 h-5" /> 儲存商品</>
          )}
        </button>
      </div>
    </div>
  );

  // ─── 詳情視圖 ───
  const renderDetailView = () => {
    if (!selectedProduct) return null;

    return (
      <div className="flex flex-col h-full">
        {/* 標題列 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedProduct(null);
                setView('list');
              }}
              className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-white">商品詳情</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleEditProduct(selectedProduct)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-sm text-slate-300 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              編輯
            </button>
            <button
              onClick={() => setDeleteConfirmId(selectedProduct.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              刪除
            </button>
          </div>
        </div>

        {/* 詳情內容 */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* 標題區 */}
          <div className="p-4 bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-500/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 bg-amber-500/30 text-amber-300 rounded">
                {selectedProduct.insurer}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                selectedProduct.status === 'selling'
                  ? 'bg-emerald-500/30 text-emerald-300'
                  : 'bg-slate-500/30 text-slate-300'
              }`}>
                {selectedProduct.status === 'selling' ? '銷售中' : '已停售'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white mb-1">{selectedProduct.productName}</h3>
            {selectedProduct.productCode && (
              <p className="text-sm text-amber-400/70">代碼：{selectedProduct.productCode}</p>
            )}
          </div>

          {/* 險種分類 */}
          <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl">
            <div className="text-xs text-slate-400 mb-2">險種分類</div>
            <div className="text-white font-medium">
              {PRODUCT_CATEGORY_LABELS[selectedProduct.category]}
            </div>
          </div>

          {/* 商品特性 */}
          <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl space-y-3">
            <div className="text-xs text-slate-400 mb-2">商品特性</div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                {selectedProduct.isCopyReceipt ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <X className="w-4 h-4 text-slate-500" />
                )}
                <span className="text-sm text-slate-300">副本理賠</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedProduct.isGuaranteedRenewal ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <X className="w-4 h-4 text-slate-500" />
                )}
                <span className="text-sm text-slate-300">保證續保</span>
              </div>
              {selectedProduct.waitingPeriod && (
                <div className="text-sm text-slate-300">
                  等待期 {selectedProduct.waitingPeriod} 天
                </div>
              )}
            </div>
          </div>

          {/* 理賠摘要 */}
          {selectedProduct.claimSummary && Object.keys(selectedProduct.claimSummary).length > 0 && (
            <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <div className="text-xs text-slate-400 mb-3">理賠摘要</div>
              <div className="space-y-2 text-sm">
                {selectedProduct.claimSummary.lumpSum?.death && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">身故保險金</span>
                    <span className="text-white">{selectedProduct.claimSummary.lumpSum.death.toLocaleString()} 元</span>
                  </div>
                )}
                {selectedProduct.claimSummary.hospitalDaily?.illness && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">住院日額</span>
                    <span className="text-white">{selectedProduct.claimSummary.hospitalDaily.illness.toLocaleString()} 元/日</span>
                  </div>
                )}
                {selectedProduct.claimSummary.surgery?.baseAmount && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">手術保險金</span>
                    <span className="text-white">{selectedProduct.claimSummary.surgery.baseAmount.toLocaleString()} 元</span>
                  </div>
                )}
                {selectedProduct.claimSummary.actualExpense?.medicalExpense && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">醫療雜費限額</span>
                    <span className="text-white">{selectedProduct.claimSummary.actualExpense.medicalExpense.toLocaleString()} 元</span>
                  </div>
                )}
                {selectedProduct.claimSummary.lumpSum?.cancer && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">癌症一次金</span>
                    <span className="text-white">{selectedProduct.claimSummary.lumpSum.cancer.toLocaleString()} 元</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 理賠條件 */}
          {selectedProduct.claimConditions && (
            <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <div className="text-xs text-slate-400 mb-2">理賠條件</div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {selectedProduct.claimConditions}
              </p>
            </div>
          )}

          {/* 除外責任 */}
          {selectedProduct.exclusions && (
            <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <div className="text-xs text-slate-400 mb-2">除外責任</div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {selectedProduct.exclusions}
              </p>
            </div>
          )}

          {/* 原始描述 */}
          {selectedProduct.rawDescription && (
            <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <div className="text-xs text-slate-400 mb-2">原始條款描述</div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                {selectedProduct.rawDescription}
              </p>
            </div>
          )}

          {/* 來源 */}
          {selectedProduct.sourceUrl && (
            <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <div className="text-xs text-slate-400 mb-2">資料來源</div>
              <a
                href={selectedProduct.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-amber-400 hover:underline break-all"
              >
                {selectedProduct.sourceUrl}
              </a>
            </div>
          )}

          {/* 更新資訊 */}
          <div className="text-xs text-slate-500 text-center">
            最後更新：{selectedProduct.lastUpdated} · {selectedProduct.updatedBy === 'ai' ? 'AI 更新' : '手動更新'}
          </div>
        </div>
      </div>
    );
  };

  // ─── 匯入視圖 ───
  const renderImportView = () => (
    <div className="flex flex-col h-full">
      {/* 標題列 */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-700/50">
        <button
          onClick={() => {
            setView('list');
            setImportText('');
            setImportPreview([]);
            setImportError('');
          }}
          className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-white">批次匯入商品</h2>
      </div>

      {/* 匯入內容 */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 說明 */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <h3 className="text-amber-400 font-medium mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            匯入格式說明
          </h3>
          <div className="text-sm text-slate-300 space-y-1">
            <p>支援 JSON 和 CSV 格式：</p>
            <p className="text-xs text-slate-400 font-mono">
              JSON: {`[{ "insurer": "國泰人壽", "productName": "...", "category": "medical_expense" }]`}
            </p>
            <p className="text-xs text-slate-400 font-mono">
              CSV: insurer,productName,category,status
            </p>
          </div>
        </div>

        {/* 格式選擇 & 檔案上傳 */}
        <div className="flex gap-3">
          <select
            value={importFormat}
            onChange={e => setImportFormat(e.target.value as 'json' | 'csv')}
            className="px-3 py-2 bg-slate-800/50 border border-slate-600/50 rounded-lg text-white focus:outline-none"
          >
            <option value="json">JSON 格式</option>
            <option value="csv">CSV 格式</option>
          </select>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".json,.csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 rounded-lg text-slate-300 transition-colors"
          >
            <Upload className="w-4 h-4" />
            選擇檔案
          </button>
        </div>

        {/* 文字輸入 */}
        <textarea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          placeholder={importFormat === 'json'
            ? '貼上 JSON 資料...\n[\n  { "insurer": "國泰人壽", "productName": "真心幸福", "category": "medical_expense" }\n]'
            : '貼上 CSV 資料...\ninsurer,productName,category,status\n國泰人壽,真心幸福,medical_expense,selling'
          }
          rows={10}
          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none font-mono text-sm"
        />

        {/* 預覽按鈕 */}
        <button
          onClick={handlePreviewImport}
          disabled={!importText.trim()}
          className="w-full py-2.5 bg-slate-700/50 hover:bg-slate-600/50 disabled:bg-slate-800/50 disabled:text-slate-500 border border-slate-600/50 rounded-xl text-slate-300 font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Eye className="w-4 h-4" />
          預覽解析結果
        </button>

        {/* 錯誤訊息 */}
        {importError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {importError}
          </div>
        )}

        {/* 預覽結果 */}
        {importPreview.length > 0 && (
          <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-emerald-400">
                預覽：{importPreview.length} 筆商品
              </h4>
            </div>
            <div className="max-h-64 overflow-auto space-y-2">
              {importPreview.slice(0, 10).map((p, i) => (
                <div key={i} className="p-2 bg-slate-900/50 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">{p.insurer}</span>
                    <span className="text-white">{p.productName}</span>
                  </div>
                </div>
              ))}
              {importPreview.length > 10 && (
                <div className="text-center text-xs text-slate-500">
                  ... 還有 {importPreview.length - 10} 筆
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 匯入按鈕 */}
      <div className="p-4 border-t border-slate-700/50">
        <button
          onClick={handleBatchImport}
          disabled={saving || importPreview.length === 0}
          className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-slate-600 disabled:to-slate-600 rounded-xl text-white font-medium transition-all flex items-center justify-center gap-2"
        >
          {saving ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> 匯入中...</>
          ) : (
            <><Upload className="w-5 h-5" /> 確認匯入 {importPreview.length} 筆</>
          )}
        </button>
      </div>
    </div>
  );

  // ─── 刪除確認 Modal ───
  const renderDeleteConfirm = () => {
    if (!deleteConfirmId) return null;
    const product = products.find(p => p.id === deleteConfirmId);
    if (!product) return null;

    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-sm mx-4 p-6 bg-slate-800 border border-slate-700 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-500/20 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">確認刪除</h3>
          </div>
          <p className="text-slate-300 mb-6">
            確定要刪除「<span className="text-white font-medium">{product.productName}</span>」嗎？此操作無法復原。
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="flex-1 py-2.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl text-slate-300 font-medium transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => handleDeleteProduct(deleteConfirmId)}
              className="flex-1 py-2.5 bg-red-500/80 hover:bg-red-500 rounded-xl text-white font-medium transition-colors"
            >
              確認刪除
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // 主渲染
  // ============================================================

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm overflow-hidden">
      <div className="h-full flex flex-col max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl">
              <Package className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">保單倉庫系統</h1>
              <p className="text-xs text-slate-400">保險商品資料庫管理</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {view === 'list' && renderListView()}
          {(view === 'add' || view === 'edit') && renderFormView()}
          {view === 'detail' && renderDetailView()}
          {view === 'import' && renderImportView()}
        </div>
      </div>

      {/* Modals */}
      {renderDeleteConfirm()}
    </div>
  );
};

export default ProductWarehouse;
