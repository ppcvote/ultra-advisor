import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Plus, Search, Camera, Upload, FileText, Edit3, Trash2, Save,
  ChevronLeft, ShieldCheck, AlertTriangle, CheckCircle, Download,
  Loader2, Eye, Filter, BarChart3, PieChart as PieChartIcon,
  Users, ChevronUp, ChevronDown, ArrowLeft, ArrowRight
} from 'lucide-react';
import {
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, doc, Timestamp, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  InsurancePolicy, InsuranceCategory, PolicyStatus, PaymentMethod,
  CATEGORY_INFO, PAYMENT_METHOD_LABELS, POLICY_STATUS_LABELS,
  FamilyMember, Gender, FamilyRelationship
} from '../types/insurance';
import { classifyInsurance, parseOCRText, TAIWAN_INSURANCE_COMPANIES } from '../utils/insuranceClassifier';
import {
  analyzeCoverageGaps, generateRecommendations, generateAnalysisReport,
  formatCurrency, COVERAGE_BENCHMARKS
} from '../utils/insuranceBenchmarks';

// ============================================================
// 型別定義
// ============================================================

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  clients: any[];
}

type ViewState = 'list' | 'add' | 'ocr' | 'manual' | 'detail' | 'report' | 'familyTree';

interface PolicyFormData {
  policyNumber: string;
  insuranceCompany: string;
  insuredPerson: string;
  policyholder: string;
  beneficiary: string;
  productName: string;
  category: InsuranceCategory;
  coverageAmount: string;
  annualPremium: string;
  paymentMethod: PaymentMethod;
  paymentPeriodYears: string;
  effectiveDate: string;
  status: PolicyStatus;
  clientId: string;
  clientName: string;
  // 被保人個資
  insuredBirthday: string;
  insuredIdNumber: string;
  insuredPhone: string;
}

const EMPTY_FORM: PolicyFormData = {
  policyNumber: '',
  insuranceCompany: '',
  insuredPerson: '',
  policyholder: '',
  beneficiary: '',
  productName: '',
  category: 'life',
  coverageAmount: '',
  annualPremium: '',
  paymentMethod: 'annual',
  paymentPeriodYears: '',
  effectiveDate: '',
  status: 'active',
  clientId: '',
  clientName: '',
  insuredBirthday: '',
  insuredIdNumber: '',
  insuredPhone: '',
};

const CATEGORY_FILTERS: { key: InsuranceCategory | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'life', label: '壽險' },
  { key: 'medical', label: '醫療' },
  { key: 'accident', label: '意外' },
  { key: 'cancer', label: '癌症' },
  { key: 'disability', label: '失能' },
  { key: 'savings', label: '儲蓄' },
];

const LOCALSTORAGE_KEY = (uid: string) => `ultra_insurance_policies_${uid}`;

// OCR 圖片（支援多張批次）
interface OcrImage {
  file: File;
  previewSrc: string;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  rawText?: string;
  imageUrl?: string;
  parsedForm?: PolicyFormData;
  error?: string;
}

// ============================================================
// 主元件
// ============================================================

const InsurancePolicyScanner: React.FC<Props> = ({ isOpen, onClose, user, clients }) => {
  // ─── 狀態 ───
  const [view, setView] = useState<ViewState>('list');
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 搜尋 & 篩選
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<InsuranceCategory | 'all'>('all');

  // 表單
  const [formData, setFormData] = useState<PolicyFormData>({ ...EMPTY_FORM });
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');

  // 詳情
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);

  // OCR（支援多張批次）
  const [ocrImages, setOcrImages] = useState<OcrImage[]>([]);
  const [ocrCurrentIndex, setOcrCurrentIndex] = useState(0); // 目前正在編輯的圖片索引
  const [ocrBatchProcessing, setOcrBatchProcessing] = useState(false);
  const [showRawOcr, setShowRawOcr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 報告
  const [annualIncome, setAnnualIncome] = useState('');
  const [reportClientFilter, setReportClientFilter] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // 刪除確認
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 家庭圖
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [familyTreeClientId, setFamilyTreeClientId] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [addMemberDirection, setAddMemberDirection] = useState<'up' | 'down' | 'left' | 'right' | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberGender, setNewMemberGender] = useState<Gender>('male');
  const [familyLoading, setFamilyLoading] = useState(false);


  // ─── localStorage 快取 ───
  const savePoliciesCache = useCallback((data: InsurancePolicy[]) => {
    if (!user?.uid) return;
    try {
      localStorage.setItem(LOCALSTORAGE_KEY(user.uid), JSON.stringify(data));
    } catch (e) {
      // localStorage 滿了或不可用，靜默忽略
    }
  }, [user?.uid]);

  const loadPoliciesCache = useCallback((): InsurancePolicy[] => {
    if (!user?.uid) return [];
    try {
      const cached = localStorage.getItem(LOCALSTORAGE_KEY(user.uid));
      if (cached) return JSON.parse(cached);
    } catch (e) {
      // 解析失敗
    }
    return [];
  }, [user?.uid]);

  // ─── 從 localStorage 載入快取 ───
  useEffect(() => {
    if (!user?.uid) return;
    const cached = loadPoliciesCache();
    if (cached.length > 0) {
      setPolicies(cached);
      setLoading(false);
    }
  }, [user?.uid, loadPoliciesCache]);

  // ─── Firestore 即時監聽 ───
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, `users/${user.uid}/insurancePolicies`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: InsurancePolicy[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as InsurancePolicy));
      setPolicies(docs);
      savePoliciesCache(docs);
      setLoading(false);
    }, (error) => {
      console.error('[InsuranceScanner] Firestore error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, savePoliciesCache]);

  // ─── 重置視圖 ───
  useEffect(() => {
    if (isOpen) {
      setView('list');
      setSearchQuery('');
      setCategoryFilter('all');
      setEditingPolicy(null);
      setSelectedPolicy(null);
      setDeleteConfirmId(null);
    }
  }, [isOpen]);

  // ─── 篩選邏輯 ───
  const filteredPolicies = policies.filter(p => {
    // 搜尋
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        p.insuredPerson?.toLowerCase().includes(q) ||
        p.insuranceCompany?.toLowerCase().includes(q) ||
        p.productName?.toLowerCase().includes(q) ||
        p.policyNumber?.toLowerCase().includes(q);
      if (!match) return false;
    }
    // 分類
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    return true;
  });

  // ─── 統計數據 ───
  const stats = {
    totalPolicies: policies.length,
    totalAnnualPremium: policies.filter(p => p.status === 'active')
      .reduce((sum, p) => sum + (p.annualPremium || 0), 0),
    activeCount: policies.filter(p => p.status === 'active').length,
  };

  // ============================================================
  // 表單操作
  // ============================================================

  const resetForm = useCallback(() => {
    setFormData({ ...EMPTY_FORM });
    setEditingPolicy(null);
    setShowRawOcr(false);
  }, []);

  const handleFormChange = useCallback((field: keyof PolicyFormData, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // 自動分類
      if (field === 'productName' && value.length >= 2) {
        updated.category = classifyInsurance(value);
      }
      return updated;
    });
  }, []);

  const handleSavePolicy = useCallback(async (options?: { stayInView?: boolean }): Promise<boolean> => {
    if (!user?.uid) return false;
    if (!formData.productName.trim()) return false;

    // 從當前 OCR 圖片取得 imageUrl 和 rawText
    const currentOcrImage = ocrImages[ocrCurrentIndex];
    const currentOcrImageUrl = currentOcrImage?.imageUrl || editingPolicy?.ocrImageUrl || undefined;
    const currentOcrRawText = currentOcrImage?.rawText || editingPolicy?.ocrRawText || undefined;

    setSaving(true);
    try {
      // 自動建立客戶：如果有 clientName 但沒有 clientId
      let finalClientId = formData.clientId;
      let finalClientName = formData.clientName;

      if (finalClientName?.trim() && !finalClientId) {
        const existing = clients.find(c => c.name === finalClientName!.trim());
        if (existing) {
          finalClientId = existing.id;
        } else {
          const newRef = await addDoc(
            collection(db, `users/${user.uid}/clients`),
            {
              name: finalClientName.trim(),
              note: '由保單健診自動建立',
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            }
          );
          finalClientId = newRef.id;
        }
      }

      const policyData: Omit<InsurancePolicy, 'id'> = {
        policyNumber: formData.policyNumber.trim(),
        insuranceCompany: formData.insuranceCompany.trim(),
        insuredPerson: formData.insuredPerson.trim(),
        policyholder: formData.policyholder.trim(),
        beneficiary: formData.beneficiary.trim(),
        productName: formData.productName.trim(),
        category: formData.category,
        coverageAmount: parseFloat(formData.coverageAmount.replace(/,/g, '')) || 0,
        annualPremium: parseFloat(formData.annualPremium.replace(/,/g, '')) || 0,
        paymentMethod: formData.paymentMethod,
        paymentPeriodYears: parseInt(formData.paymentPeriodYears) || 0,
        effectiveDate: formData.effectiveDate,
        status: formData.status,
        insuredBirthday: formData.insuredBirthday || undefined,
        insuredIdNumber: formData.insuredIdNumber || undefined,
        insuredPhone: formData.insuredPhone || undefined,
        clientId: finalClientId || undefined,
        clientName: finalClientName || undefined,
        ocrImageUrl: currentOcrImageUrl,
        ocrRawText: currentOcrRawText,
        createdAt: editingPolicy?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      if (editingPolicy?.id) {
        // 更新
        const docRef = doc(db, `users/${user.uid}/insurancePolicies`, editingPolicy.id);
        await updateDoc(docRef, policyData as any);
      } else {
        // 新增
        await addDoc(collection(db, `users/${user.uid}/insurancePolicies`), policyData);
      }

      if (!options?.stayInView) {
        resetForm();
        setView('list');
      }
      return true;
    } catch (error) {
      console.error('[InsuranceScanner] Save error:', error);
      alert('儲存失敗，請稍後再試');
      return false;
    } finally {
      setSaving(false);
    }
  }, [user?.uid, formData, editingPolicy, ocrImages, ocrCurrentIndex, resetForm, clients]);

  const handleDeletePolicy = useCallback(async (policyId: string) => {
    if (!user?.uid || !policyId) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/insurancePolicies`, policyId));
      setSelectedPolicy(null);
      setDeleteConfirmId(null);
      setView('list');
    } catch (error) {
      console.error('[InsuranceScanner] Delete error:', error);
      alert('刪除失敗，請稍後再試');
    }
  }, [user?.uid]);

  const handleEditPolicy = useCallback((policy: InsurancePolicy) => {
    setEditingPolicy(policy);
    setFormData({
      policyNumber: policy.policyNumber || '',
      insuranceCompany: policy.insuranceCompany || '',
      insuredPerson: policy.insuredPerson || '',
      policyholder: policy.policyholder || '',
      beneficiary: policy.beneficiary || '',
      productName: policy.productName || '',
      category: policy.category || 'life',
      coverageAmount: policy.coverageAmount ? String(policy.coverageAmount) : '',
      annualPremium: policy.annualPremium ? String(policy.annualPremium) : '',
      paymentMethod: policy.paymentMethod || 'annual',
      paymentPeriodYears: policy.paymentPeriodYears ? String(policy.paymentPeriodYears) : '',
      effectiveDate: policy.effectiveDate || '',
      status: policy.status || 'active',
      clientId: policy.clientId || '',
      clientName: policy.clientName || '',
      insuredBirthday: policy.insuredBirthday || '',
      insuredIdNumber: policy.insuredIdNumber || '',
      insuredPhone: policy.insuredPhone || '',
    });
    setView('manual');
  }, []);

  // ============================================================
  // OCR 流程
  // ============================================================

  // 選擇檔案（支援多張）
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: OcrImage[] = [];
    const promises: Promise<void>[] = [];

    Array.from(files).forEach(file => {
      const promise = new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          newImages.push({
            file,
            previewSrc: ev.target?.result as string,
            status: 'pending',
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
      promises.push(promise);
    });

    Promise.all(promises).then(() => {
      setOcrImages(prev => [...prev, ...newImages]);
    });

    // 清空 input 以支援重複選同檔案
    e.target.value = '';
  }, []);

  // 移除某張圖片
  const handleRemoveOcrImage = useCallback((index: number) => {
    setOcrImages(prev => prev.filter((_, i) => i !== index));
    if (ocrCurrentIndex >= index && ocrCurrentIndex > 0) {
      setOcrCurrentIndex(prev => prev - 1);
    }
  }, [ocrCurrentIndex]);

  // 批次辨識所有圖片（直接傳 base64 給 Cloud Function，不經 Storage）
  const handleOCRBatchProcess = useCallback(async () => {
    if (!user?.uid || ocrImages.length === 0) return;

    setOcrBatchProcessing(true);
    const processOCR = httpsCallable(functions, 'processInsuranceOCR', { timeout: 120000 });

    // 保存快照避免 stale closure
    const imagesToProcess = [...ocrImages];

    for (let i = 0; i < imagesToProcess.length; i++) {
      const img = imagesToProcess[i];
      if (img.status === 'done') continue;

      // 更新狀態：辨識中
      setOcrImages(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'processing' as const } : item
      ));

      try {
        // 直接用 previewSrc (data URL base64) 傳給 Cloud Function
        const result = await processOCR({ imageBase64: img.previewSrc });
        const data = result.data as any;

        if (data?.rawText) {
          const parsed = parseOCRText(data.rawText);
          const parsedForm: PolicyFormData = {
            ...EMPTY_FORM,
            policyNumber: parsed.policyNumber || '',
            insuranceCompany: parsed.insuranceCompany || '',
            insuredPerson: parsed.insuredPerson || '',
            policyholder: parsed.policyholder || '',
            beneficiary: parsed.beneficiary || '',
            productName: parsed.productName || '',
            category: parsed.productName ? classifyInsurance(parsed.productName) : 'life',
            coverageAmount: parsed.coverageAmount || '',
            annualPremium: parsed.annualPremium || '',
            paymentMethod: (parsed.paymentMethod as PaymentMethod) || 'annual',
            paymentPeriodYears: parsed.paymentPeriodYears || '',
            effectiveDate: parsed.effectiveDate || '',
            status: 'active',
            clientId: selectedClientId,
            clientName: clients.find(c => c.id === selectedClientId)?.name || '',
          };

          setOcrImages(prev => prev.map((item, idx) =>
            idx === i ? { ...item, status: 'done' as const, rawText: data.rawText, parsedForm } : item
          ));
        } else {
          setOcrImages(prev => prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error' as const, error: '無法辨識文字內容' } : item
          ));
        }
      } catch (error: any) {
        console.error(`[InsuranceScanner] OCR error for image ${i}:`, error);
        const errMsg = error?.message || error?.details || 'OCR 辨識失敗';
        setOcrImages(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'error' as const, error: errMsg } : item
        ));
      }
    }

    // 自動切到第一張
    setOcrCurrentIndex(0);
    setOcrBatchProcessing(false);
  }, [user?.uid, ocrImages, selectedClientId, clients]);

  // 當 ocrBatchProcessing 結束時，將第一張結果載入表單
  useEffect(() => {
    if (!ocrBatchProcessing && ocrImages.length > 0) {
      const img = ocrImages[ocrCurrentIndex];
      if (img?.parsedForm) {
        setFormData({ ...img.parsedForm });
      }
    }
  }, [ocrBatchProcessing]);

  // 載入某張 OCR 結果到表單
  const loadOcrResultToForm = useCallback((index: number) => {
    const img = ocrImages[index];
    if (img?.parsedForm) {
      setFormData({ ...img.parsedForm });
      setOcrCurrentIndex(index);
    }
  }, [ocrImages]);

  // 儲存當前 OCR 結果並跳到下一張
  const handleSaveAndNext = useCallback(async () => {
    const success = await handleSavePolicy({ stayInView: true });
    if (!success) return;

    // 儲存成功後，移除當前這張並載入下一張
    const remaining = ocrImages.filter((_, i) => i !== ocrCurrentIndex);
    setOcrImages(remaining);
    if (remaining.length > 0) {
      const nextIdx = Math.min(ocrCurrentIndex, remaining.length - 1);
      setOcrCurrentIndex(nextIdx);
      if (remaining[nextIdx]?.parsedForm) {
        setFormData({ ...remaining[nextIdx].parsedForm! });
      } else {
        setFormData({ ...EMPTY_FORM });
      }
    } else {
      // 全部都儲存完了
      setView('list');
      setFormData({ ...EMPTY_FORM });
      setEditingPolicy(null);
    }
  }, [ocrImages, ocrCurrentIndex, handleSavePolicy]);

  // 重置 OCR
  const handleResetOcr = useCallback(() => {
    setOcrImages([]);
    setOcrCurrentIndex(0);
    setOcrBatchProcessing(false);
    setFormData({ ...EMPTY_FORM });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, []);

  // ============================================================
  // 家庭圖 - 資料層
  // ============================================================

  // Firestore 監聽家庭成員
  useEffect(() => {
    if (!user?.uid || !familyTreeClientId) {
      setFamilyMembers([]);
      return;
    }

    const q = query(
      collection(db, `users/${user.uid}/clients/${familyTreeClientId}/familyMembers`),
      orderBy('generation', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members: FamilyMember[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as FamilyMember));
      setFamilyMembers(members);
      setFamilyLoading(false);
    }, (error) => {
      console.error('[FamilyTree] Firestore error:', error);
      setFamilyLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, familyTreeClientId]);

  // 進入家庭圖時，若無 self 節點則自動建立
  const initFamilyTree = useCallback(async (clientId: string) => {
    if (!user?.uid || !clientId) return;
    setFamilyTreeClientId(clientId);
    setFamilyLoading(true);
    setSelectedMemberId(null);

    // 檢查是否已有 self 節點
    const colRef = collection(db, `users/${user.uid}/clients/${clientId}/familyMembers`);
    const snapshot = await getDocs(colRef);
    const hasSelf = snapshot.docs.some(d => d.data().relationship === 'self');

    if (!hasSelf) {
      // 找到客戶名稱
      const client = clients.find(c => c.id === clientId);
      const selfMember: Omit<FamilyMember, 'id'> = {
        name: client?.name || '客戶本人',
        gender: 'male',
        relationship: 'self',
        generation: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      await addDoc(colRef, selfMember);
    }
  }, [user?.uid, clients]);

  // 新增家庭成員
  const handleAddFamilyMember = useCallback(async () => {
    if (!user?.uid || !familyTreeClientId || !newMemberName.trim() || !addMemberDirection || !selectedMemberId) return;

    const selectedMember = familyMembers.find(m => m.id === selectedMemberId);
    if (!selectedMember) return;

    let relationship: FamilyRelationship;
    let generation: number;
    let parentNodeId: string | undefined;
    let spouseId: string | undefined;

    switch (addMemberDirection) {
      case 'up': // 父母
        relationship = 'parent';
        generation = selectedMember.generation + 1;
        parentNodeId = undefined;
        break;
      case 'down': // 子女
        relationship = 'child';
        generation = selectedMember.generation - 1;
        parentNodeId = selectedMember.id;
        break;
      case 'left':
      case 'right': // 配偶
        relationship = 'spouse';
        generation = selectedMember.generation;
        spouseId = selectedMember.id;
        break;
      default:
        return;
    }

    // 限制驗證
    if (Math.abs(generation) > 3) {
      alert('已達最大代數限制（7 代）');
      return;
    }

    if (relationship === 'spouse') {
      // 檢查是否已有配偶
      const hasSpouse = familyMembers.some(
        m => m.spouseId === selectedMember.id || selectedMember.spouseId === m.id
      );
      if (hasSpouse) {
        alert('此成員已有配偶');
        return;
      }
    }

    if (relationship === 'parent') {
      // 檢查父母數量
      const parents = familyMembers.filter(m => {
        // 找「以 selectedMember 為子女」的父母
        // parent 的 generation = selectedMember.generation + 1
        // 且 selectedMember.parentNodeId 指向該 parent
        if (m.relationship === 'parent' && m.generation === selectedMember.generation + 1) {
          // 找是否有 child 指向 m 的
          return true;
        }
        return false;
      });
      // 更精確：找所有 parentNodeId 指向 selectedMember 的 parent（不對，parent 是上層）
      // 實際上：找 generation = selectedMember.generation + 1 的成員中，
      // 誰是 selectedMember 的父母 → 看 selectedMember 的 parentNodeId
      const directParents = familyMembers.filter(m =>
        m.id === selectedMember.parentNodeId ||
        (m.spouseId && familyMembers.find(s => s.id === m.spouseId)?.id === selectedMember.parentNodeId)
      );
      // 簡化：同 generation+1 且與 selectedMember 有 parentNodeId 關聯的
      const parentCount = selectedMember.parentNodeId
        ? familyMembers.filter(m => {
            const p = familyMembers.find(x => x.id === selectedMember.parentNodeId);
            return m.id === selectedMember.parentNodeId ||
              (p && (m.spouseId === p.id || p.spouseId === m.id));
          }).length
        : 0;

      if (parentCount >= 2) {
        alert('此成員已有 2 位父母');
        return;
      }
    }

    try {
      const colRef = collection(db, `users/${user.uid}/clients/${familyTreeClientId}/familyMembers`);
      const newMember: Omit<FamilyMember, 'id'> = {
        name: newMemberName.trim(),
        gender: newMemberGender,
        relationship,
        generation,
        parentNodeId,
        spouseId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(colRef, newMember);

      // 如果是配偶，更新對方的 spouseId
      if (relationship === 'spouse' && selectedMember.id) {
        await updateDoc(doc(db, `users/${user.uid}/clients/${familyTreeClientId}/familyMembers`, selectedMember.id), {
          spouseId: docRef.id,
          updatedAt: Timestamp.now(),
        });
      }

      // 如果是父母且 selectedMember 還沒有 parentNodeId，設定之
      if (relationship === 'parent' && !selectedMember.parentNodeId && selectedMember.id) {
        await updateDoc(doc(db, `users/${user.uid}/clients/${familyTreeClientId}/familyMembers`, selectedMember.id), {
          parentNodeId: docRef.id,
          updatedAt: Timestamp.now(),
        });
      }

      // 重置表單
      setNewMemberName('');
      setNewMemberGender('male');
      setShowAddMemberForm(false);
      setAddMemberDirection(null);
    } catch (error) {
      console.error('[FamilyTree] Add member error:', error);
      alert('新增失敗，請稍後再試');
    }
  }, [user?.uid, familyTreeClientId, newMemberName, newMemberGender, addMemberDirection, selectedMemberId, familyMembers]);

  // 刪除家庭成員
  const handleDeleteFamilyMember = useCallback(async (memberId: string) => {
    if (!user?.uid || !familyTreeClientId) return;
    const member = familyMembers.find(m => m.id === memberId);
    if (!member) return;
    if (member.relationship === 'self') {
      alert('無法刪除客戶本人');
      return;
    }

    try {
      // 清除配偶關聯
      if (member.spouseId) {
        const spouse = familyMembers.find(m => m.id === member.spouseId);
        if (spouse?.id) {
          await updateDoc(doc(db, `users/${user.uid}/clients/${familyTreeClientId}/familyMembers`, spouse.id), {
            spouseId: null,
            updatedAt: Timestamp.now(),
          });
        }
      }
      // 清除反向 spouseId
      const reverseSpouse = familyMembers.find(m => m.spouseId === memberId);
      if (reverseSpouse?.id) {
        await updateDoc(doc(db, `users/${user.uid}/clients/${familyTreeClientId}/familyMembers`, reverseSpouse.id), {
          spouseId: null,
          updatedAt: Timestamp.now(),
        });
      }
      // 清除子女的 parentNodeId
      const children = familyMembers.filter(m => m.parentNodeId === memberId);
      for (const child of children) {
        if (child.id) {
          await updateDoc(doc(db, `users/${user.uid}/clients/${familyTreeClientId}/familyMembers`, child.id), {
            parentNodeId: null,
            updatedAt: Timestamp.now(),
          });
        }
      }

      await deleteDoc(doc(db, `users/${user.uid}/clients/${familyTreeClientId}/familyMembers`, memberId));
      if (selectedMemberId === memberId) {
        setSelectedMemberId(null);
      }
    } catch (error) {
      console.error('[FamilyTree] Delete member error:', error);
      alert('刪除失敗');
    }
  }, [user?.uid, familyTreeClientId, familyMembers, selectedMemberId]);

  // 方向按鈕可用性判斷
  const canAddDirection = useCallback((direction: 'up' | 'down' | 'left' | 'right'): boolean => {
    if (!selectedMemberId) return false;
    const member = familyMembers.find(m => m.id === selectedMemberId);
    if (!member) return false;

    switch (direction) {
      case 'up': {
        // 不能超過 +3 代
        if (member.generation + 1 > 3) return false;
        // 檢查是否已有 2 位父母
        if (member.parentNodeId) {
          const parent = familyMembers.find(m => m.id === member.parentNodeId);
          if (parent) {
            const hasSpouse = familyMembers.some(m => m.spouseId === parent.id || parent.spouseId === m.id);
            if (hasSpouse) return false; // 已有 2 位父母
          }
        }
        return true;
      }
      case 'down': {
        if (member.generation - 1 < -3) return false;
        return true;
      }
      case 'left':
      case 'right': {
        const hasSpouse = familyMembers.some(
          m => m.spouseId === member.id || member.spouseId === m.id
        );
        return !hasSpouse;
      }
    }
  }, [selectedMemberId, familyMembers]);

  // ============================================================
  // PDF 匯出
  // ============================================================

  const handleExportPdf = useCallback(async () => {
    if (!reportRef.current) return;
    setExportingPdf(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#0f172a',
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 20);

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 20);
      }

      const dateStr = new Date().toISOString().split('T')[0];
      pdf.save(`保單健診報告_${dateStr}.pdf`);
    } catch (error) {
      console.error('[InsuranceScanner] PDF export error:', error);
      alert('PDF 匯出失敗，請稍後再試');
    } finally {
      setExportingPdf(false);
    }
  }, []);

  // ============================================================
  // 報告相關計算
  // ============================================================

  const incomeNum = parseFloat(annualIncome.replace(/,/g, '')) || 0;
  const dailySalary = incomeNum > 0 ? Math.round(incomeNum / 365) : 0;

  const reportPolicies = reportClientFilter
    ? policies.filter(p => p.clientId === reportClientFilter)
    : policies;

  const report = incomeNum > 0
    ? generateAnalysisReport(
        reportPolicies,
        incomeNum,
        dailySalary,
        reportClientFilter
          ? (clients.find(c => c.id === reportClientFilter)?.name || '指定客戶')
          : '全部保單'
      )
    : null;

  // 圖表資料
  const premiumPieData = report ? (() => {
    const categoryPremiums: Record<InsuranceCategory, number> = {
      life: 0, medical: 0, accident: 0, cancer: 0, disability: 0, savings: 0,
    };
    const activePolicies = reportPolicies.filter(p => p.status === 'active');
    activePolicies.forEach(p => {
      categoryPremiums[p.category] = (categoryPremiums[p.category] || 0) + p.annualPremium;
    });
    return Object.entries(categoryPremiums)
      .filter(([_, val]) => val > 0)
      .map(([key, val]) => ({
        name: CATEGORY_INFO[key as InsuranceCategory].label,
        value: val,
        color: CATEGORY_INFO[key as InsuranceCategory].color,
      }));
  })() : [];

  const radarData = report ? report.coverageByCategory.map(c => ({
    subject: c.categoryName,
    actual: Math.min(c.gapPercentage, 100),
    recommended: 100,
  })) : [];

  // ============================================================
  // 不開啟時不渲染
  // ============================================================

  if (!isOpen) return null;

  // ============================================================
  // 子視圖渲染函數
  // ============================================================

  // ─── 格式化數字輸入顯示 ───
  const formatNumberInput = (value: string): string => {
    const num = value.replace(/,/g, '');
    if (!num || isNaN(Number(num))) return value;
    return Number(num).toLocaleString('zh-TW');
  };

  // ─── 共用返回按鈕 ───
  const BackButton = ({ onClick }: { onClick: () => void }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
    >
      <ChevronLeft className="w-5 h-5" />
      <span>返回</span>
    </button>
  );

  // ─── 客戶選擇器 ───
  const ClientSelector = ({
    value,
    onChange,
    className = '',
  }: {
    value: string;
    onChange: (clientId: string, clientName: string) => void;
    className?: string;
  }) => (
    <div className={className}>
      <label className="block text-sm text-slate-400 mb-1">關聯客戶</label>
      <select
        value={value}
        onChange={(e) => {
          const id = e.target.value;
          const client = clients.find(c => c.id === id);
          onChange(id, client?.name || '');
        }}
        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none"
      >
        <option value="">不指定</option>
        {clients.map(c => (
          <option key={c.id} value={c.id}>{c.name || c.displayName || c.email}</option>
        ))}
      </select>
    </div>
  );

  // ─── 狀態徽章 ───
  const StatusBadge = ({ status }: { status: PolicyStatus }) => {
    const info = POLICY_STATUS_LABELS[status];
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
        style={{
          backgroundColor: info.color + '20',
          color: info.color,
          border: `1px solid ${info.color}40`,
        }}
      >
        {info.label}
      </span>
    );
  };

  // ─── 分類徽章 ───
  const CategoryBadge = ({ category }: { category: InsuranceCategory }) => {
    const info = CATEGORY_INFO[category];
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
        style={{
          backgroundColor: info.color + '20',
          color: info.color,
          border: `1px solid ${info.color}40`,
        }}
      >
        <span>{info.icon}</span>
        <span>{info.label}</span>
      </span>
    );
  };

  // ============================================================
  // 1. PolicyListView
  // ============================================================

  const renderListView = () => (
    <div className="flex flex-col h-full">
      {/* 標題 */}
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-sm pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">保單健診</h2>
              <p className="text-sm text-slate-400">管理與分析保障缺口</p>
            </div>
          </div>
          <span className="bg-purple-600/20 text-purple-400 text-xs font-medium px-2.5 py-1 rounded-full">
            {policies.length} 張保單
          </span>
        </div>

        {/* 統計列 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-white">{stats.totalPolicies}</div>
            <div className="text-xs text-slate-400">總保單數</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-emerald-400">
              {formatCurrency(stats.totalAnnualPremium)}
            </div>
            <div className="text-xs text-slate-400">年繳保費</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.activeCount}</div>
            <div className="text-xs text-slate-400">有效保單</div>
          </div>
        </div>

        {/* 搜尋列 */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="搜尋被保人、公司、險種名稱..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:border-purple-500 outline-none placeholder:text-slate-600"
          />
        </div>

        {/* 分類篩選 */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORY_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setCategoryFilter(f.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === f.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 保單列表 */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <span>載入中...</span>
          </div>
        ) : filteredPolicies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <ShieldCheck className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-lg font-medium mb-1">尚無保單資料</p>
            <p className="text-sm">點擊下方按鈕新增保單</p>
          </div>
        ) : (
          filteredPolicies.map(policy => {
            const catInfo = CATEGORY_INFO[policy.category];
            const statusInfo = POLICY_STATUS_LABELS[policy.status];
            return (
              <button
                key={policy.id}
                onClick={() => {
                  setSelectedPolicy(policy);
                  setView('detail');
                }}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-left hover:bg-slate-800 hover:border-slate-600 transition-all group"
              >
                <div className="flex items-start gap-3">
                  {/* 左：分類圖示 */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ backgroundColor: catInfo.color + '20' }}
                  >
                    {catInfo.icon}
                  </div>

                  {/* 中：資訊 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-bold text-sm truncate">
                        {policy.productName || '未命名保單'}
                      </h3>
                      <StatusBadge status={policy.status} />
                    </div>
                    <p className="text-slate-400 text-xs truncate">
                      {policy.insuranceCompany}
                      {policy.insuredPerson && ` | ${policy.insuredPerson}`}
                    </p>
                    {policy.coverageAmount > 0 && (
                      <p className="text-slate-500 text-xs mt-1">
                        保額：{formatCurrency(policy.coverageAmount)}
                      </p>
                    )}
                  </div>

                  {/* 右：保費 */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-purple-400 font-bold text-sm">
                      {formatCurrency(policy.annualPremium)}
                    </div>
                    <div className="text-slate-500 text-xs">/年</div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* 底部按鈕 */}
      <div className="sticky bottom-0 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent pt-6 pb-4">
        <div className="flex gap-3">
          <button
            onClick={() => {
              resetForm();
              setView('add');
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white py-3 px-4 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            新增保單
          </button>
          <button
            onClick={() => setView('report')}
            disabled={policies.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 px-4 rounded-xl font-medium transition-colors"
          >
            <BarChart3 className="w-5 h-5" />
            產出健診報告
          </button>
        </div>
      </div>
    </div>
  );

  // ============================================================
  // 2. AddMethodSelector
  // ============================================================

  const renderAddMethodSelector = () => (
    <div>
      <BackButton onClick={() => setView('list')} />

      <h2 className="text-xl font-bold text-white mb-2">新增保單</h2>
      <p className="text-slate-400 text-sm mb-6">選擇輸入方式</p>

      {/* 客戶選擇器 */}
      <ClientSelector
        value={selectedClientId}
        onChange={(id, name) => {
          setSelectedClientId(id);
          setFormData(prev => ({ ...prev, clientId: id, clientName: name }));
        }}
        className="mb-6"
      />

      {/* 方式選擇 */}
      <div className="grid grid-cols-2 gap-4">
        {/* OCR 辨識（開發中） */}
        <div
          className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-6 text-center opacity-50 cursor-not-allowed relative"
        >
          <div className="absolute top-2 right-2 bg-amber-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            開發中
          </div>
          <div className="w-16 h-16 bg-purple-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 text-purple-400/50" />
          </div>
          <h3 className="text-white/50 font-bold text-lg mb-2">OCR 辨識</h3>
          <p className="text-slate-500 text-sm">拍照或上傳保單，自動辨識</p>
        </div>

        {/* 手動輸入 */}
        <button
          onClick={() => {
            resetForm();
            if (selectedClientId) {
              const client = clients.find(c => c.id === selectedClientId);
              setFormData(prev => ({
                ...prev,
                clientId: selectedClientId,
                clientName: client?.name || '',
              }));
            }
            setView('manual');
          }}
          className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 hover:bg-slate-800 hover:border-emerald-500/50 transition-all group text-center"
        >
          <div className="w-16 h-16 bg-emerald-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-emerald-600/30 transition-colors">
            <Edit3 className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">手動輸入</h3>
          <p className="text-slate-400 text-sm">逐欄填入保單資料</p>
        </button>
      </div>
    </div>
  );

  // ============================================================
  // 3. OCRUploadView
  // ============================================================

  const renderOcrView = () => {
    const doneImages = ocrImages.filter(img => img.status === 'done');
    const allDone = ocrImages.length > 0 && ocrImages.every(img => img.status === 'done' || img.status === 'error');
    const currentImg = ocrImages[ocrCurrentIndex];

    return (
      <div>
        <BackButton onClick={() => { handleResetOcr(); setView('add'); }} />

        <h2 className="text-xl font-bold text-white mb-2">OCR 保單辨識</h2>
        <p className="text-slate-400 text-sm mb-6">
          可一次拍多張保單，批次辨識後逐一確認儲存
        </p>

        {/* 隱藏的檔案輸入 */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.heic"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* ─── 階段 1：選擇圖片 ─── */}
        {!allDone && (
          <div>
            {/* 上傳按鈕 */}
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={ocrBatchProcessing}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white py-3 px-4 rounded-xl font-medium transition-colors"
              >
                <Camera className="w-5 h-5" />
                拍照
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrBatchProcessing}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-700 text-white py-3 px-4 rounded-xl font-medium transition-colors border border-slate-700"
              >
                <Upload className="w-5 h-5" />
                選擇檔案
              </button>
            </div>

            {/* 已選圖片預覽列表 */}
            {ocrImages.length > 0 ? (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-300 font-medium">
                    已選 {ocrImages.length} 張保單
                  </p>
                  {!ocrBatchProcessing && (
                    <button
                      onClick={() => { cameraInputRef.current?.click(); }}
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      + 繼續拍照
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                  {ocrImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <div className={`rounded-lg overflow-hidden border-2 ${
                        img.status === 'done' ? 'border-emerald-500' :
                        img.status === 'error' ? 'border-red-500' :
                        img.status === 'uploading' || img.status === 'processing' ? 'border-blue-500' :
                        'border-slate-700'
                      }`}>
                        <img
                          src={img.previewSrc}
                          alt={`保單 ${idx + 1}`}
                          className="w-full h-20 object-cover"
                        />
                        {/* 狀態覆蓋 */}
                        {(img.status === 'uploading' || img.status === 'processing') && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                          </div>
                        )}
                        {img.status === 'done' && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </div>
                        )}
                        {img.status === 'error' && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      {/* 刪除按鈕 */}
                      {!ocrBatchProcessing && (
                        <button
                          onClick={() => handleRemoveOcrImage(idx)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      )}
                      <p className="text-[10px] text-slate-500 text-center mt-1">#{idx + 1}</p>
                    </div>
                  ))}
                </div>

                {/* 開始辨識按鈕 */}
                {!ocrBatchProcessing && !allDone && (
                  <button
                    onClick={handleOCRBatchProcess}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                  >
                    <Eye className="w-5 h-5" />
                    開始辨識（{ocrImages.filter(i => i.status === 'pending').length} 張）
                  </button>
                )}

                {/* 辨識進度 */}
                {ocrBatchProcessing && (
                  <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-4 flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="text-blue-300 font-medium text-sm">批次辨識中...</p>
                      <p className="text-blue-400/70 text-xs">
                        已完成 {ocrImages.filter(i => i.status === 'done' || i.status === 'error').length} / {ocrImages.length} 張
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* 空狀態提示 */
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 text-center">
                <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-sm">
                  支援 JPG、PNG、PDF、HEIC 格式
                </p>
                <p className="text-slate-500 text-xs mt-2">
                  可一次選擇多張圖片，或連續拍照
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── 階段 2：逐一確認辨識結果（包含全部失敗時顯示手動輸入） ─── */}
        {allDone && ocrImages.length > 0 && (
          <div>
            {/* 進度指示 */}
            {doneImages.length > 0 ? (
              <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-4 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-emerald-300 font-medium text-sm">
                      辨識完成（成功 {doneImages.length}/{ocrImages.length} 張）
                    </p>
                    <p className="text-emerald-400/70 text-xs">
                      正在編輯第 {ocrCurrentIndex + 1} / {ocrImages.length} 張，請確認後儲存
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-6 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-red-300 font-medium text-sm">全部辨識失敗</p>
                  <p className="text-red-400/70 text-xs">
                    {ocrImages[0]?.error || '請手動填入保單資料，或重新拍攝更清晰的照片'}
                  </p>
                </div>
              </div>
            )}

            {/* 縮圖切換列 */}
            {ocrImages.length > 1 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {ocrImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadOcrResultToForm(idx)}
                    className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === ocrCurrentIndex ? 'border-purple-500 ring-2 ring-purple-500/30' :
                      img.status === 'error' ? 'border-red-500/50 opacity-50' :
                      'border-slate-700 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img.previewSrc} alt={`#${idx + 1}`} className="w-14 h-14 object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* 當前圖片預覽 */}
            {currentImg && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 mb-4">
                <img
                  src={currentImg.previewSrc}
                  alt="保單圖片"
                  className="w-full max-h-40 object-contain rounded-lg"
                />
              </div>
            )}

            {/* OCR 原始文字（可收合） */}
            {currentImg?.rawText && (
              <div className="mb-4">
                <button
                  onClick={() => setShowRawOcr(!showRawOcr)}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
                >
                  <FileText className="w-3 h-3" />
                  {showRawOcr ? '隱藏' : '顯示'} OCR 原始文字
                </button>
                {showRawOcr && (
                  <div className="mt-2 bg-slate-950 border border-slate-700 rounded-xl p-3 max-h-40 overflow-y-auto">
                    <pre className="text-xs text-slate-400 whitespace-pre-wrap">{currentImg.rawText}</pre>
                  </div>
                )}
              </div>
            )}

            {/* 錯誤提示 */}
            {currentImg?.status === 'error' && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">此張辨識失敗：{currentImg.error}，請手動填入</p>
              </div>
            )}

            {/* 表單 */}
            {renderPolicyForm()}

            {/* 按鈕 */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleResetOcr}
                className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-3 px-4 rounded-xl font-medium transition-colors border border-slate-700"
              >
                <Camera className="w-4 h-4" />
                重拍
              </button>
              <button
                onClick={ocrImages.length > 1 ? handleSaveAndNext : handleSavePolicy}
                disabled={saving || !formData.productName.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 px-4 rounded-xl font-medium transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    儲存中...
                  </>
                ) : ocrImages.length > 1 ? (
                  <>
                    <Save className="w-5 h-5" />
                    儲存並下一張 ({ocrCurrentIndex + 1}/{ocrImages.length})
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    確認儲存
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // 共用表單
  // ============================================================

  const renderPolicyForm = () => (
    <div className="space-y-4">
      {/* 保單號碼 */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">保單號碼</label>
        <input
          type="text"
          value={formData.policyNumber}
          onChange={(e) => handleFormChange('policyNumber', e.target.value)}
          placeholder="例：A12345678"
          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none placeholder:text-slate-600"
        />
      </div>

      {/* 保險公司 */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">保險公司</label>
        <input
          type="text"
          value={formData.insuranceCompany}
          onChange={(e) => handleFormChange('insuranceCompany', e.target.value)}
          placeholder="例：國泰人壽"
          list="company-list"
          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none placeholder:text-slate-600"
        />
        <datalist id="company-list">
          {TAIWAN_INSURANCE_COMPANIES.map(c => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      {/* 被保人 & 要保人 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-slate-400 mb-1">被保人</label>
          <input
            type="text"
            value={formData.insuredPerson}
            onChange={(e) => handleFormChange('insuredPerson', e.target.value)}
            placeholder="姓名"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none placeholder:text-slate-600"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">要保人</label>
          <input
            type="text"
            value={formData.policyholder}
            onChange={(e) => handleFormChange('policyholder', e.target.value)}
            placeholder="姓名"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* 被保人個資：生日、身分證、電話 */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm text-slate-400 mb-1">被保人生日</label>
          <input
            type="date"
            value={formData.insuredBirthday}
            onChange={(e) => handleFormChange('insuredBirthday', e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">身分證字號</label>
          <input
            type="text"
            value={formData.insuredIdNumber}
            onChange={(e) => handleFormChange('insuredIdNumber', e.target.value.toUpperCase())}
            placeholder="A123456789"
            maxLength={10}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none placeholder:text-slate-600"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">聯絡電話</label>
          <input
            type="tel"
            value={formData.insuredPhone}
            onChange={(e) => handleFormChange('insuredPhone', e.target.value)}
            placeholder="0912-345-678"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* 受益人 */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">受益人</label>
        <input
          type="text"
          value={formData.beneficiary}
          onChange={(e) => handleFormChange('beneficiary', e.target.value)}
          placeholder="例：法定繼承人"
          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none placeholder:text-slate-600"
        />
      </div>

      {/* 險種名稱 */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">險種名稱</label>
        <input
          type="text"
          value={formData.productName}
          onChange={(e) => handleFormChange('productName', e.target.value)}
          placeholder="例：新終身壽險"
          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none placeholder:text-slate-600"
        />
      </div>

      {/* 險種分類 */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">險種分類</label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(CATEGORY_INFO) as [InsuranceCategory, typeof CATEGORY_INFO[InsuranceCategory]][]).map(
            ([key, info]) => (
              <button
                key={key}
                onClick={() => handleFormChange('category', key)}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  formData.category === key
                    ? 'ring-2 ring-offset-1 ring-offset-slate-900'
                    : 'opacity-60 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: info.color + (formData.category === key ? '30' : '15'),
                  color: info.color,
                  ...(formData.category === key ? { ringColor: info.color } : {}),
                  border: formData.category === key ? `2px solid ${info.color}` : '2px solid transparent',
                }}
              >
                <span>{info.icon}</span>
                <span>{info.label}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* 保額 & 年保費 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-slate-400 mb-1">保額 (元)</label>
          <input
            type="text"
            value={formatNumberInput(formData.coverageAmount)}
            onChange={(e) => handleFormChange('coverageAmount', e.target.value.replace(/,/g, ''))}
            placeholder="例：1,000,000"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none placeholder:text-slate-600"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">每年保費 (元)</label>
          <input
            type="text"
            value={formatNumberInput(formData.annualPremium)}
            onChange={(e) => handleFormChange('annualPremium', e.target.value.replace(/,/g, ''))}
            placeholder="例：30,000"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* 繳費方式 & 繳費年期 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-slate-400 mb-1">繳費方式</label>
          <select
            value={formData.paymentMethod}
            onChange={(e) => handleFormChange('paymentMethod', e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none"
          >
            {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(
              ([key, label]) => (
                <option key={key} value={key}>{label}</option>
              )
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">繳費年期</label>
          <input
            type="number"
            value={formData.paymentPeriodYears}
            onChange={(e) => handleFormChange('paymentPeriodYears', e.target.value)}
            placeholder="例：20"
            min="0"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* 生效日 & 狀態 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-slate-400 mb-1">生效日</label>
          <input
            type="date"
            value={formData.effectiveDate}
            onChange={(e) => handleFormChange('effectiveDate', e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">狀態</label>
          <select
            value={formData.status}
            onChange={(e) => handleFormChange('status', e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none"
          >
            {(Object.entries(POLICY_STATUS_LABELS) as [PolicyStatus, { label: string; color: string }][]).map(
              ([key, info]) => (
                <option key={key} value={key}>{info.label}</option>
              )
            )}
          </select>
        </div>
      </div>

      {/* 關聯客戶（若非從 add view 帶入） */}
      {!selectedClientId && (
        <ClientSelector
          value={formData.clientId}
          onChange={(id, name) => {
            setFormData(prev => ({ ...prev, clientId: id, clientName: name }));
          }}
        />
      )}
    </div>
  );

  // ============================================================
  // 4. ManualInputForm View
  // ============================================================

  const renderManualView = () => (
    <div>
      <BackButton onClick={() => {
        if (editingPolicy) {
          setView('detail');
        } else {
          setView('add');
        }
      }} />

      <h2 className="text-xl font-bold text-white mb-2">
        {editingPolicy ? '編輯保單' : '手動輸入保單'}
      </h2>
      <p className="text-slate-400 text-sm mb-6">
        {editingPolicy ? '修改保單資料' : '逐欄填入保單資料'}
      </p>

      {renderPolicyForm()}

      {/* 按鈕區 */}
      <div className="mt-6 space-y-3">
        {/* 家庭圖按鈕 */}
        <button
          onClick={() => {
            const clientId = formData.clientId;
            if (!clientId) {
              alert('請先選擇關聯客戶，才能查看家庭圖');
              return;
            }
            initFamilyTree(clientId);
            setView('familyTree');
          }}
          className="w-full flex items-center justify-center gap-2 bg-amber-600/80 hover:bg-amber-600 text-white py-3 px-4 rounded-xl font-medium transition-colors border border-amber-500/30"
        >
          <Users className="w-5 h-5" />
          家庭圖
          {formData.clientName && (
            <span className="text-amber-200/80 text-sm">（{formData.clientName}）</span>
          )}
        </button>

        {/* 儲存按鈕 */}
        <button
          onClick={handleSavePolicy}
          disabled={saving || !formData.productName.trim()}
          className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 px-4 rounded-xl font-medium transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              儲存中...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {editingPolicy ? '更新保單' : '儲存保單'}
            </>
          )}
        </button>
      </div>
    </div>
  );

  // ============================================================
  // 5. PolicyDetailView
  // ============================================================

  const renderDetailView = () => {
    if (!selectedPolicy) return null;

    const catInfo = CATEGORY_INFO[selectedPolicy.category];
    const fields: { label: string; value: string | number | undefined }[] = [
      { label: '保單號碼', value: selectedPolicy.policyNumber },
      { label: '保險公司', value: selectedPolicy.insuranceCompany },
      { label: '被保人', value: selectedPolicy.insuredPerson },
      { label: '被保人生日', value: selectedPolicy.insuredBirthday || '-' },
      { label: '身分證字號', value: selectedPolicy.insuredIdNumber || '-' },
      { label: '聯絡電話', value: selectedPolicy.insuredPhone || '-' },
      { label: '要保人', value: selectedPolicy.policyholder },
      { label: '受益人', value: selectedPolicy.beneficiary },
      { label: '險種名稱', value: selectedPolicy.productName },
      { label: '保額', value: selectedPolicy.coverageAmount ? formatCurrency(selectedPolicy.coverageAmount) : '-' },
      { label: '每年保費', value: selectedPolicy.annualPremium ? formatCurrency(selectedPolicy.annualPremium) : '-' },
      { label: '繳費方式', value: PAYMENT_METHOD_LABELS[selectedPolicy.paymentMethod] || '-' },
      { label: '繳費年期', value: selectedPolicy.paymentPeriodYears ? `${selectedPolicy.paymentPeriodYears} 年` : '-' },
      { label: '生效日', value: selectedPolicy.effectiveDate || '-' },
      { label: '關聯客戶', value: selectedPolicy.clientName || '未指定' },
    ];

    return (
      <div>
        <BackButton onClick={() => setView('list')} />

        {/* 標頭 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: catInfo.color + '20' }}
            >
              {catInfo.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">
                {selectedPolicy.productName || '未命名保單'}
              </h2>
              <p className="text-slate-400 text-sm">{selectedPolicy.insuranceCompany}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CategoryBadge category={selectedPolicy.category} />
            <StatusBadge status={selectedPolicy.status} />
          </div>
        </div>

        {/* 欄位明細 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold mb-4">保單資料</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((f, idx) => (
              <div key={idx}>
                <div className="text-xs text-slate-500 mb-1">{f.label}</div>
                <div className="text-white text-sm font-medium">
                  {f.value || '-'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* OCR 圖片 */}
        {selectedPolicy.ocrImageUrl && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
            <h3 className="text-white font-bold mb-3">保單影像</h3>
            <img
              src={selectedPolicy.ocrImageUrl}
              alt="保單影像"
              className="w-full max-h-64 object-contain rounded-lg"
            />
          </div>
        )}

        {/* 按鈕 */}
        <div className="flex gap-3">
          <button
            onClick={() => handleEditPolicy(selectedPolicy)}
            className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white py-3 px-4 rounded-xl font-medium transition-colors"
          >
            <Edit3 className="w-5 h-5" />
            編輯
          </button>
          <button
            onClick={() => setDeleteConfirmId(selectedPolicy.id || null)}
            className="flex-1 flex items-center justify-center gap-2 bg-red-900/50 hover:bg-red-900 text-red-300 py-3 px-4 rounded-xl font-medium transition-colors border border-red-800/50"
          >
            <Trash2 className="w-5 h-5" />
            刪除
          </button>
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
              <p className="text-slate-300 text-sm mb-6">
                確定要刪除保單「{selectedPolicy.productName}」嗎？此操作無法復原。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDeletePolicy(deleteConfirmId)}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl font-medium transition-colors"
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
  // 6. AnalysisReportView
  // ============================================================

  const renderReportView = () => {
    const statusColors = {
      sufficient: '#10b981',
      warning: '#f59e0b',
      critical: '#ef4444',
    };

    const statusLabels = {
      sufficient: '充足',
      warning: '不足',
      critical: '嚴重不足',
    };

    const statusIcons = {
      sufficient: <CheckCircle className="w-4 h-4" />,
      warning: <AlertTriangle className="w-4 h-4" />,
      critical: <AlertTriangle className="w-4 h-4" />,
    };

    return (
      <div>
        <BackButton onClick={() => setView('list')} />

        <h2 className="text-xl font-bold text-white mb-2">保單健診報告</h2>
        <p className="text-slate-400 text-sm mb-6">根據收入與現有保單分析保障缺口</p>

        {/* 輸入區 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold mb-4">基本資料</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">年收入 (元)</label>
              <input
                type="text"
                value={formatNumberInput(annualIncome)}
                onChange={(e) => setAnnualIncome(e.target.value.replace(/,/g, ''))}
                placeholder="例：1,200,000"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">每日薪資 (自動計算)</label>
              <div className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl py-3 px-4 text-slate-300">
                {dailySalary > 0 ? `${dailySalary.toLocaleString('zh-TW')} 元 / 日` : '-'}
              </div>
            </div>
          </div>

          {/* 客戶篩選 */}
          {clients.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm text-slate-400 mb-1">篩選客戶</label>
              <select
                value={reportClientFilter}
                onChange={(e) => setReportClientFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none"
              >
                <option value="">全部保單</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.displayName || c.email}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 報告內容 */}
        {report && incomeNum > 0 ? (
          <>
            <div ref={reportRef} className="space-y-6">
              {/* 報告標題 */}
              <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-700/30 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <ShieldCheck className="w-8 h-8 text-purple-400" />
                  <div>
                    <h3 className="text-xl font-bold text-white">保單健診報告</h3>
                    <p className="text-purple-300 text-sm">
                      {new Date().toLocaleDateString('zh-TW', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="text-center">
                    <div className="text-sm text-slate-400">對象</div>
                    <div className="text-white font-bold">{report.clientName}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-400">有效保單</div>
                    <div className="text-white font-bold">{report.totalPolicies} 張</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-400">年繳保費</div>
                    <div className="text-emerald-400 font-bold">
                      {formatCurrency(report.totalAnnualPremium)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-slate-400">保費收入比</div>
                    <div className={`font-bold ${
                      report.premiumToIncomeRatio > 30 ? 'text-amber-400' : 'text-blue-400'
                    }`}>
                      {report.premiumToIncomeRatio.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* 保障缺口總覽表 */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                  保障缺口總覽
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 px-2 text-slate-400 font-medium">險種</th>
                        <th className="text-right py-2 px-2 text-slate-400 font-medium">目前保障</th>
                        <th className="text-right py-2 px-2 text-slate-400 font-medium">建議保障</th>
                        <th className="text-right py-2 px-2 text-slate-400 font-medium">缺口</th>
                        <th className="text-center py-2 px-2 text-slate-400 font-medium">狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.coverageByCategory.map(c => (
                        <tr key={c.category} className="border-b border-slate-700/50">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: CATEGORY_INFO[c.category].color }}
                              />
                              <span className="text-white">{c.categoryName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right text-white">
                            {formatCurrency(c.currentCoverage)}
                          </td>
                          <td className="py-3 px-2 text-right text-slate-300">
                            {formatCurrency(c.recommendedCoverage)}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span style={{ color: statusColors[c.status] }}>
                              {c.gapAmount >= 0 ? '+' : ''}{formatCurrency(c.gapAmount)}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: statusColors[c.status] + '20',
                                color: statusColors[c.status],
                              }}
                            >
                              {statusIcons[c.status]}
                              {statusLabels[c.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 圖表區 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 保費分佈圓餅圖 */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-blue-400" />
                    年保費分佈
                  </h3>
                  {premiumPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={premiumPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={true}
                        >
                          {premiumPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`${formatCurrency(value)} 元`, '年保費']}
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #475569',
                            borderRadius: '12px',
                            color: '#fff',
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          formatter={(value: string) => (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
                      無有效保單保費資料
                    </div>
                  )}
                </div>

                {/* 雷達圖 */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                  <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    保障完整度
                  </h3>
                  {radarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis
                          dataKey="subject"
                          tick={{ fill: '#94a3b8', fontSize: 12 }}
                        />
                        <PolarRadiusAxis
                          angle={30}
                          domain={[0, 100]}
                          tick={{ fill: '#64748b', fontSize: 10 }}
                          tickFormatter={(val) => `${val}%`}
                        />
                        <Radar
                          name="建議標準"
                          dataKey="recommended"
                          stroke="#6366f1"
                          fill="#6366f1"
                          fillOpacity={0.1}
                          strokeDasharray="5 5"
                        />
                        <Radar
                          name="目前保障"
                          dataKey="actual"
                          stroke="#8b5cf6"
                          fill="#8b5cf6"
                          fillOpacity={0.3}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #475569',
                            borderRadius: '12px',
                            color: '#fff',
                          }}
                          formatter={(value: number) => [`${value}%`, '']}
                        />
                        <Legend
                          verticalAlign="bottom"
                          formatter={(value: string) => (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>
                          )}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
                      無保障資料
                    </div>
                  )}
                </div>
              </div>

              {/* 各險種缺口分析卡片 */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-4">各險種缺口分析</h3>
                <div className="space-y-4">
                  {report.coverageByCategory.map(c => {
                    const catInfo = CATEGORY_INFO[c.category];
                    const pct = Math.min(c.gapPercentage, 100);
                    return (
                      <div key={c.category} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{catInfo.icon}</span>
                            <span className="text-white text-sm font-medium">{c.categoryName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="text-sm font-bold"
                              style={{ color: statusColors[c.status] }}
                            >
                              {c.gapPercentage}%
                            </span>
                            <span
                              className="text-xs"
                              style={{ color: statusColors[c.status] }}
                            >
                              {statusLabels[c.status]}
                            </span>
                          </div>
                        </div>
                        {/* 進度條 */}
                        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: statusColors[c.status],
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>目前：{formatCurrency(c.currentCoverage)}</span>
                          <span>建議：{formatCurrency(c.recommendedCoverage)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 建議清單 */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  健診建議
                </h3>
                <div className="space-y-3">
                  {report.recommendations.map((rec, idx) => {
                    const isCritical = rec.includes('急需補強');
                    const isWarning = rec.includes('建議加強');
                    const isNote = rec.includes('注意');
                    const color = isCritical
                      ? '#ef4444'
                      : isWarning
                        ? '#f59e0b'
                        : isNote
                          ? '#f59e0b'
                          : '#10b981';
                    const icon = isCritical || isWarning || isNote
                      ? <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color }} />
                      : <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color }} />;

                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 rounded-xl"
                        style={{ backgroundColor: color + '10', border: `1px solid ${color}20` }}
                      >
                        {icon}
                        <p className="text-slate-300 text-sm leading-relaxed">{rec}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* PDF 匯出按鈕 */}
            <div className="mt-6 pb-4">
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-3 px-4 rounded-xl font-medium transition-colors"
              >
                {exportingPdf ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    匯出中...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    匯出 PDF
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 text-center">
            <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-sm">
              請先輸入年收入以產出健診報告
            </p>
            {policies.length === 0 && (
              <p className="text-slate-500 text-xs mt-2">
                目前尚無保單資料，請先新增保單
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // 7. FamilyTreeView
  // ============================================================

  const renderFamilyTreeView = () => {
    // 按 generation 分組（高 → 低）
    const generationGroups: Record<number, FamilyMember[]> = {};
    familyMembers.forEach(m => {
      if (!generationGroups[m.generation]) generationGroups[m.generation] = [];
      generationGroups[m.generation].push(m);
    });
    const sortedGenerations = Object.keys(generationGroups)
      .map(Number)
      .sort((a, b) => b - a); // 高 generation 在上

    const selectedMember = familyMembers.find(m => m.id === selectedMemberId);
    const clientName = clients.find(c => c.id === familyTreeClientId)?.name || '客戶';

    // 成員節點渲染
    const MemberNode = ({ member }: { member: FamilyMember }) => {
      const isSelf = member.relationship === 'self';
      const isSelected = member.id === selectedMemberId;
      const isMale = member.gender === 'male';

      // 找配偶
      const spouse = familyMembers.find(
        m => m.spouseId === member.id || member.spouseId === m.id
      );

      return (
        <div className="flex items-center gap-2">
          {/* 成員本人 */}
          <button
            onClick={() => setSelectedMemberId(member.id || null)}
            className={`relative flex flex-col items-center gap-1 p-2 transition-all ${
              isSelected ? 'scale-110' : 'hover:scale-105'
            }`}
          >
            {/* 金色光環（self） */}
            {isSelf && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '-4px' }}>
                <div
                  className={`${isMale ? 'rounded-lg' : 'rounded-full'} animate-pulse`}
                  style={{
                    width: '56px',
                    height: '56px',
                    border: '3px solid #f59e0b',
                    boxShadow: '0 0 12px rgba(245, 158, 11, 0.5), 0 0 24px rgba(245, 158, 11, 0.2)',
                  }}
                />
              </div>
            )}
            {/* 形狀 */}
            <div
              className={`w-12 h-12 flex items-center justify-center text-sm font-bold border-2 ${
                isMale ? 'rounded-lg' : 'rounded-full'
              } ${
                isSelected
                  ? 'border-purple-400 bg-purple-600/30 text-purple-200'
                  : isMale
                    ? 'border-blue-400 bg-blue-600/20 text-blue-200'
                    : 'border-pink-400 bg-pink-600/20 text-pink-200'
              }`}
            >
              {member.name.slice(0, 2)}
            </div>
            {/* 名字 */}
            <span className={`text-[10px] max-w-[60px] truncate ${
              isSelected ? 'text-purple-300 font-bold' : 'text-slate-400'
            }`}>
              {member.name}
            </span>
            {/* 關係標籤 */}
            <span className="text-[9px] text-slate-600">
              {member.relationship === 'self' ? '本人' :
               member.relationship === 'spouse' ? '配偶' :
               member.relationship === 'parent' ? '父母' : '子女'}
            </span>
          </button>

          {/* 配偶（同層顯示在右側） */}
          {spouse && (
            <>
              {/* 連線 */}
              <div className="w-6 border-t-2 border-dashed border-slate-600" />
              <button
                onClick={() => setSelectedMemberId(spouse.id || null)}
                className={`relative flex flex-col items-center gap-1 p-2 transition-all ${
                  spouse.id === selectedMemberId ? 'scale-110' : 'hover:scale-105'
                }`}
              >
                {spouse.relationship === 'self' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '-4px' }}>
                    <div
                      className={`${spouse.gender === 'male' ? 'rounded-lg' : 'rounded-full'} animate-pulse`}
                      style={{
                        width: '56px',
                        height: '56px',
                        border: '3px solid #f59e0b',
                        boxShadow: '0 0 12px rgba(245, 158, 11, 0.5), 0 0 24px rgba(245, 158, 11, 0.2)',
                      }}
                    />
                  </div>
                )}
                <div
                  className={`w-12 h-12 flex items-center justify-center text-sm font-bold border-2 ${
                    spouse.gender === 'male' ? 'rounded-lg' : 'rounded-full'
                  } ${
                    spouse.id === selectedMemberId
                      ? 'border-purple-400 bg-purple-600/30 text-purple-200'
                      : spouse.gender === 'male'
                        ? 'border-blue-400 bg-blue-600/20 text-blue-200'
                        : 'border-pink-400 bg-pink-600/20 text-pink-200'
                  }`}
                >
                  {spouse.name.slice(0, 2)}
                </div>
                <span className={`text-[10px] max-w-[60px] truncate ${
                  spouse.id === selectedMemberId ? 'text-purple-300 font-bold' : 'text-slate-400'
                }`}>
                  {spouse.name}
                </span>
                <span className="text-[9px] text-slate-600">配偶</span>
              </button>
            </>
          )}
        </div>
      );
    };

    return (
      <div className="flex flex-col h-full">
        <BackButton onClick={() => {
          setView('manual');
          setFamilyTreeClientId('');
          setSelectedMemberId(null);
          setFamilyMembers([]);
        }} />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600/20 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">家庭圖</h2>
              <p className="text-sm text-slate-400">{clientName} 的家庭成員</p>
            </div>
          </div>
          <span className="bg-amber-600/20 text-amber-400 text-xs font-medium px-2.5 py-1 rounded-full">
            {familyMembers.length} 位成員
          </span>
        </div>

        {/* 圖例 */}
        <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-sm border-2 border-blue-400 bg-blue-600/20" />
            <span>男性</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full border-2 border-pink-400 bg-pink-600/20" />
            <span>女性</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-sm border-2 border-amber-400" style={{ boxShadow: '0 0 6px rgba(245, 158, 11, 0.5)' }} />
            <span>客戶本人</span>
          </div>
        </div>

        {/* 家庭圖主體 */}
        <div className="flex-1 overflow-y-auto pb-24">
          {familyLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <span>載入中...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedGenerations.map(gen => {
                const members = generationGroups[gen];
                // 過濾掉已作為配偶顯示的成員
                const primaryMembers = members.filter(m => {
                  // 如果此成員的 spouseId 指向另一個成員，且另一個成員在此 group 中排更前面，則跳過
                  if (m.relationship === 'spouse') {
                    const partner = familyMembers.find(p => p.spouseId === m.id || m.spouseId === p.id);
                    if (partner && partner.id !== m.id && partner.generation === gen) {
                      // 只顯示「非 spouse relationship」的那位作為主要
                      if (partner.relationship !== 'spouse') return false;
                      // 兩個都是 spouse？按 id 排序，只顯示第一個
                      return (m.id || '') < (partner.id || '');
                    }
                  }
                  // 如果有人的 spouseId 指向自己，而自己 relationship 不是 spouse，自己是主要
                  return true;
                });

                const genLabel =
                  gen === 0 ? '本人' :
                  gen === 1 ? '父母' :
                  gen === 2 ? '祖父母' :
                  gen === 3 ? '曾祖父母' :
                  gen === -1 ? '子女' :
                  gen === -2 ? '孫子女' :
                  gen === -3 ? '曾孫子女' : `第 ${gen} 代`;

                return (
                  <div key={gen}>
                    {/* 代數標籤 */}
                    <div className="text-xs text-slate-600 mb-2 flex items-center gap-2">
                      <div className="h-px flex-1 bg-slate-800" />
                      <span>{genLabel}（第 {gen >= 0 ? '+' : ''}{gen} 代）</span>
                      <div className="h-px flex-1 bg-slate-800" />
                    </div>

                    {/* 成員列表 */}
                    <div className="flex flex-wrap justify-center gap-4">
                      {primaryMembers.map(member => (
                        <div key={member.id} className="flex flex-col items-center">
                          <MemberNode member={member} />
                          {/* 向下連線（如果有子女） */}
                          {familyMembers.some(m => m.parentNodeId === member.id) && (
                            <div className="w-px h-4 bg-slate-600 mt-1" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {familyMembers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <Users className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-lg font-medium mb-1">載入家庭圖中...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作區 */}
        {selectedMember && (
          <div className="sticky bottom-0 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent pt-6 pb-4">
            <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-white text-sm font-bold">
                  已選：{selectedMember.name}
                  {selectedMember.relationship === 'self' && (
                    <span className="ml-2 text-amber-400 text-xs">（本人）</span>
                  )}
                </div>
                {selectedMember.relationship !== 'self' && (
                  <button
                    onClick={() => {
                      if (confirm(`確定刪除「${selectedMember.name}」？`)) {
                        handleDeleteFamilyMember(selectedMember.id!);
                      }
                    }}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    刪除
                  </button>
                )}
              </div>

              {/* 方向按鈕 */}
              <div className="flex items-center justify-center gap-2">
                {/* 上：新增父母 */}
                <button
                  onClick={() => {
                    setAddMemberDirection('up');
                    setShowAddMemberForm(true);
                  }}
                  disabled={!canAddDirection('up')}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200"
                >
                  <ChevronUp className="w-4 h-4" />
                  父母
                </button>

                {/* 左：新增配偶 */}
                <button
                  onClick={() => {
                    setAddMemberDirection('left');
                    setShowAddMemberForm(true);
                  }}
                  disabled={!canAddDirection('left')}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200"
                >
                  <ArrowLeft className="w-4 h-4" />
                  配偶
                </button>

                {/* 下：新增子女 */}
                <button
                  onClick={() => {
                    setAddMemberDirection('down');
                    setShowAddMemberForm(true);
                  }}
                  disabled={!canAddDirection('down')}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200"
                >
                  <ChevronDown className="w-4 h-4" />
                  子女
                </button>

                {/* 右：新增配偶（與左同功能，保留 UI 對稱） */}
                <button
                  onClick={() => {
                    setAddMemberDirection('right');
                    setShowAddMemberForm(true);
                  }}
                  disabled={!canAddDirection('right')}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-colors bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200"
                >
                  配偶
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 新增成員彈窗 */}
        {showAddMemberForm && (
          <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-white font-bold mb-4">
                新增{addMemberDirection === 'up' ? '父母' :
                      addMemberDirection === 'down' ? '子女' : '配偶'}
              </h3>

              {/* 姓名 */}
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-1">姓名</label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="請輸入姓名"
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 text-white focus:border-purple-500 outline-none placeholder:text-slate-600"
                />
              </div>

              {/* 性別切換 */}
              <div className="mb-6">
                <label className="block text-sm text-slate-400 mb-2">性別</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setNewMemberGender('male')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors border-2 ${
                      newMemberGender === 'male'
                        ? 'border-blue-400 bg-blue-600/20 text-blue-200'
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-sm border-2 border-current" />
                    男
                  </button>
                  <button
                    onClick={() => setNewMemberGender('female')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors border-2 ${
                      newMemberGender === 'female'
                        ? 'border-pink-400 bg-pink-600/20 text-pink-200'
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full border-2 border-current" />
                    女
                  </button>
                </div>
              </div>

              {/* 按鈕 */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddMemberForm(false);
                    setAddMemberDirection(null);
                    setNewMemberName('');
                    setNewMemberGender('male');
                  }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddFamilyMember}
                  disabled={!newMemberName.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-2.5 rounded-xl font-medium transition-colors"
                >
                  確認新增
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // 主畫面
  // ============================================================

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
          {view === 'add' && renderAddMethodSelector()}
          {view === 'ocr' && renderOcrView()}
          {view === 'manual' && renderManualView()}
          {view === 'detail' && renderDetailView()}
          {view === 'report' && renderReportView()}
          {view === 'familyTree' && renderFamilyTreeView()}
        </div>
      </div>
    </div>
  );
};

export default InsurancePolicyScanner;
