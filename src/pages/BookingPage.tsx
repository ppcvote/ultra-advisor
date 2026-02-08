import React, { useState } from 'react';
import {
  Calendar, Clock, User, Phone, Mail, Briefcase, Users, Heart,
  ChevronLeft, Check, ArrowRight, Shield, Star, MessageCircle,
  Plus, Minus, Baby, UserCircle, Crown
} from 'lucide-react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface BookingPageProps {
  onBack: () => void;
  onLogin: () => void;
}

// 需求分類選項
const NEED_CATEGORIES = [
  { id: 'mortgage', label: '房貸規劃', icon: '🏠', desc: '購屋貸款、轉貸、增貸評估' },
  { id: 'retirement', label: '退休規劃', icon: '🌅', desc: '退休金試算、年金規劃' },
  { id: 'insurance', label: '保險檢視', icon: '🛡️', desc: '保障缺口分析、保單健診' },
  { id: 'tax', label: '稅務傳承', icon: '📋', desc: '遺產稅、贈與稅規劃' },
  { id: 'investment', label: '投資理財', icon: '📈', desc: '資產配置、基金規劃' },
  { id: 'other', label: '其他諮詢', icon: '💬', desc: '其他財務相關問題' },
];

// 家庭成員類型
interface FamilyMember {
  id: string;
  role: 'self' | 'spouse' | 'father' | 'mother' | 'father_in_law' | 'mother_in_law' | 'child';
  name: string;
  age: string;
  isMainContact: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  self: '本人',
  spouse: '配偶',
  father: '父親',
  mother: '母親',
  father_in_law: '公公/岳父',
  mother_in_law: '婆婆/岳母',
  child: '子女',
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  self: <UserCircle size={20} />,
  spouse: <Heart size={20} />,
  father: <Crown size={20} />,
  mother: <Crown size={20} />,
  father_in_law: <Crown size={20} />,
  mother_in_law: <Crown size={20} />,
  child: <Baby size={20} />,
};

const BookingPage: React.FC<BookingPageProps> = ({ onBack, onLogin }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    occupation: '',
    birthYear: '',
    needCategory: '',
    specificNeeds: '',
    preferredTime: '',
    referralSource: '',
  });

  // 家庭成員狀態
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([
    { id: '1', role: 'self', name: '', age: '', isMainContact: true }
  ]);
  const [hasSpouse, setHasSpouse] = useState(false);
  const [hasParents, setHasParents] = useState(false);
  const [hasInLaws, setHasInLaws] = useState(false);
  const [childCount, setChildCount] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 更新家庭成員
  const updateFamilyMember = (id: string, field: keyof FamilyMember, value: string | boolean) => {
    setFamilyMembers(prev => prev.map(m =>
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  // 切換配偶
  const toggleSpouse = () => {
    if (hasSpouse) {
      setFamilyMembers(prev => prev.filter(m => m.role !== 'spouse'));
    } else {
      setFamilyMembers(prev => [...prev, { id: Date.now().toString(), role: 'spouse', name: '', age: '', isMainContact: false }]);
    }
    setHasSpouse(!hasSpouse);
  };

  // 切換父母
  const toggleParents = () => {
    if (hasParents) {
      setFamilyMembers(prev => prev.filter(m => m.role !== 'father' && m.role !== 'mother'));
    } else {
      setFamilyMembers(prev => [
        ...prev,
        { id: Date.now().toString() + 'f', role: 'father', name: '', age: '', isMainContact: false },
        { id: Date.now().toString() + 'm', role: 'mother', name: '', age: '', isMainContact: false }
      ]);
    }
    setHasParents(!hasParents);
  };

  // 切換公婆/岳父母
  const toggleInLaws = () => {
    if (hasInLaws) {
      setFamilyMembers(prev => prev.filter(m => m.role !== 'father_in_law' && m.role !== 'mother_in_law'));
    } else {
      setFamilyMembers(prev => [
        ...prev,
        { id: Date.now().toString() + 'fil', role: 'father_in_law', name: '', age: '', isMainContact: false },
        { id: Date.now().toString() + 'mil', role: 'mother_in_law', name: '', age: '', isMainContact: false }
      ]);
    }
    setHasInLaws(!hasInLaws);
  };

  // 增減子女
  const adjustChildren = (delta: number) => {
    const newCount = Math.max(0, Math.min(5, childCount + delta));
    if (delta > 0 && childCount < newCount) {
      // 新增子女
      setFamilyMembers(prev => [
        ...prev,
        { id: Date.now().toString(), role: 'child', name: '', age: '', isMainContact: false }
      ]);
    } else if (delta < 0 && childCount > newCount) {
      // 移除最後一個子女
      const children = familyMembers.filter(m => m.role === 'child');
      if (children.length > 0) {
        const lastChild = children[children.length - 1];
        setFamilyMembers(prev => prev.filter(m => m.id !== lastChild.id));
      }
    }
    setChildCount(newCount);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // 儲存到 Firestore
      await addDoc(collection(db, 'bookingRequests'), {
        // 基本資料
        name: formData.name,
        phone: formData.phone,
        email: formData.email || null,
        occupation: formData.occupation || null,
        birthYear: formData.birthYear || null,

        // 需求
        needCategory: formData.needCategory,
        specificNeeds: formData.specificNeeds || null,
        preferredTime: formData.preferredTime || null,
        referralSource: formData.referralSource || null,

        // 家庭成員
        familyMembers: familyMembers.map(m => ({
          role: m.role,
          age: m.age || null,
        })),
        familyMemberCount: familyMembers.length,

        // 系統資訊
        status: 'pending', // pending, contacted, completed, cancelled
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        source: 'website',
      });

      setIsSubmitted(true);
    } catch (error) {
      console.error('提交失敗:', error);
      alert('提交失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedStep1 = formData.name && formData.phone;
  const canProceedStep2 = formData.needCategory;
  const canSubmit = formData.name && formData.phone && formData.needCategory;

  // 渲染家庭關係圖
  const renderFamilyTree = () => {
    const self = familyMembers.find(m => m.role === 'self');
    const spouse = familyMembers.find(m => m.role === 'spouse');
    const parents = familyMembers.filter(m => m.role === 'father' || m.role === 'mother');
    const inLaws = familyMembers.filter(m => m.role === 'father_in_law' || m.role === 'mother_in_law');
    const children = familyMembers.filter(m => m.role === 'child');

    return (
      <div className="bg-slate-900/50 rounded-2xl p-4 mb-6">
        <h4 className="text-sm font-bold text-slate-400 mb-4 text-center">家庭關係圖</h4>

        {/* 上層：父母 */}
        {(parents.length > 0 || inLaws.length > 0) && (
          <div className="flex justify-center gap-8 mb-4">
            {/* 本人父母 */}
            {parents.length > 0 && (
              <div className="flex gap-2">
                {parents.map(p => (
                  <div key={p.id} className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 border-2 border-amber-500/50 flex items-center justify-center text-amber-400">
                      {ROLE_ICONS[p.role]}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">{ROLE_LABELS[p.role]}</span>
                    {p.age && <span className="text-[10px] text-amber-400">{p.age}歲</span>}
                  </div>
                ))}
              </div>
            )}

            {/* 配偶父母 */}
            {inLaws.length > 0 && (
              <div className="flex gap-2">
                {inLaws.map(p => (
                  <div key={p.id} className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-orange-500/20 border-2 border-orange-500/50 flex items-center justify-center text-orange-400">
                      {ROLE_ICONS[p.role]}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">{ROLE_LABELS[p.role]}</span>
                    {p.age && <span className="text-[10px] text-orange-400">{p.age}歲</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 連接線 */}
        {(parents.length > 0 || inLaws.length > 0) && (
          <div className="flex justify-center mb-4">
            <div className="w-0.5 h-6 bg-slate-700" />
          </div>
        )}

        {/* 中層：本人與配偶 */}
        <div className="flex justify-center items-center gap-4 mb-4">
          {/* 本人 */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-purple-500/30 border-2 border-purple-500 flex items-center justify-center text-purple-400 relative">
              <UserCircle size={28} />
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                <Star size={12} className="text-white" />
              </div>
            </div>
            <span className="text-xs text-white font-bold mt-1">{formData.name || '本人'}</span>
            {formData.birthYear && <span className="text-[10px] text-purple-400">{2026 - parseInt(formData.birthYear)}歲</span>}
          </div>

          {/* 婚姻連結 */}
          {spouse && (
            <>
              <div className="flex items-center">
                <div className="w-8 h-0.5 bg-pink-500" />
                <Heart size={16} className="text-pink-500 mx-1" />
                <div className="w-8 h-0.5 bg-pink-500" />
              </div>

              {/* 配偶 */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-pink-500/30 border-2 border-pink-500 flex items-center justify-center text-pink-400">
                  <Heart size={28} />
                </div>
                <span className="text-xs text-white font-bold mt-1">{spouse.name || '配偶'}</span>
                {spouse.age && <span className="text-[10px] text-pink-400">{spouse.age}歲</span>}
              </div>
            </>
          )}
        </div>

        {/* 子女連接線 */}
        {children.length > 0 && (
          <div className="flex justify-center mb-2">
            <div className="w-0.5 h-6 bg-slate-700" />
          </div>
        )}

        {/* 下層：子女 */}
        {children.length > 0 && (
          <div className="flex justify-center gap-4">
            {children.map((child, idx) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-400">
                  <Baby size={20} />
                </div>
                <span className="text-[10px] text-slate-500 mt-1">子女{idx + 1}</span>
                {child.age && <span className="text-[10px] text-emerald-400">{child.age}歲</span>}
              </div>
            ))}
          </div>
        )}

        {/* 統計資訊 */}
        <div className="mt-4 pt-4 border-t border-slate-700 flex justify-center gap-4 text-xs">
          <span className="text-slate-500">家庭成員：<span className="text-white font-bold">{familyMembers.length} 人</span></span>
          {children.length > 0 && (
            <span className="text-slate-500">子女：<span className="text-emerald-400 font-bold">{children.length} 人</span></span>
          )}
        </div>
      </div>
    );
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800/50 border border-slate-700 rounded-3xl p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-white mb-4">預約成功！</h2>
          <p className="text-slate-400 mb-6">
            我們已收到您的預約申請，專業顧問將在 24 小時內與您聯繫，為您安排免費 1:1 試算服務。
          </p>
          <div className="bg-slate-900/50 rounded-xl p-4 mb-4 text-left">
            <div className="text-sm text-slate-500 mb-2">預約資訊</div>
            <div className="text-white font-bold">{formData.name}</div>
            <div className="text-slate-400 text-sm">{formData.phone}</div>
            <div className="text-purple-400 text-sm mt-2">
              {NEED_CATEGORIES.find(c => c.id === formData.needCategory)?.label}
            </div>
          </div>

          {/* 家庭關係圖摘要 */}
          <div className="bg-slate-900/50 rounded-xl p-4 mb-6 text-left">
            <div className="text-sm text-slate-500 mb-2">家庭成員</div>
            <div className="flex flex-wrap gap-2">
              {familyMembers.map(m => (
                <span key={m.id} className="px-2 py-1 bg-slate-800 rounded-lg text-xs text-slate-300">
                  {ROLE_LABELS[m.role]}
                  {m.age && ` (${m.age}歲)`}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={onBack}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold rounded-xl hover:from-blue-500 hover:to-blue-400 transition-all"
          >
            返回首頁
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
            <span className="font-bold">返回</span>
          </button>
          <div className="text-white font-black">
            <span style={{ color: '#FF3A3A' }}>Ultra</span>
            <span className="text-blue-400">Advisor</span>
          </div>
          <button
            onClick={onLogin}
            className="text-blue-400 hover:text-blue-300 font-bold text-sm"
          >
            登入
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm font-bold mb-4">
            <Calendar size={16} />
            免費預約
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-4">
            預約 1:1 免費試算
          </h1>
          <p className="text-slate-400 text-lg">
            專業顧問為您量身打造財務規劃方案
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: Shield, label: '資料保密', color: 'emerald' },
            { icon: Star, label: '專業服務', color: 'amber' },
            { icon: Clock, label: '24hr 回覆', color: 'blue' },
          ].map((item, idx) => (
            <div key={idx} className={`bg-${item.color}-500/10 border border-${item.color}-500/20 rounded-xl p-3 text-center`}>
              <item.icon size={20} className={`text-${item.color}-400 mx-auto mb-1`} />
              <div className="text-xs text-slate-400 font-bold">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                            ${step >= s ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                {step > s ? <Check size={16} /> : s}
              </div>
              {s < 4 && (
                <div className={`w-8 h-1 rounded ${step > s ? 'bg-purple-600' : 'bg-slate-800'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Form Steps */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6 md:p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white mb-6">基本資料</h2>

              {/* 姓名 */}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  <User size={14} className="inline mr-1" />
                  姓名 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="請輸入您的姓名"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white
                           placeholder-slate-500 focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>

              {/* 電話 */}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  <Phone size={14} className="inline mr-1" />
                  電話 <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="0912-345-678"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white
                           placeholder-slate-500 focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  <Mail size={14} className="inline mr-1" />
                  Email（選填）
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white
                           placeholder-slate-500 focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>

              {/* 職業 */}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  <Briefcase size={14} className="inline mr-1" />
                  職業（選填）
                </label>
                <input
                  type="text"
                  value={formData.occupation}
                  onChange={(e) => handleInputChange('occupation', e.target.value)}
                  placeholder="例：工程師、教師、自營商..."
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white
                           placeholder-slate-500 focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>

              {/* 出生年 */}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  <Calendar size={14} className="inline mr-1" />
                  出生年（選填）
                </label>
                <select
                  value={formData.birthYear}
                  onChange={(e) => handleInputChange('birthYear', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white
                           focus:border-purple-500 focus:outline-none transition-colors"
                >
                  <option value="">請選擇</option>
                  {Array.from({ length: 60 }, (_, i) => 2006 - i).map(year => (
                    <option key={year} value={year}>{year} 年</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className={`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all
                          ${canProceedStep1
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
              >
                下一步
                <ArrowRight size={20} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white mb-2">家庭關係圖</h2>
              <p className="text-slate-500 text-sm mb-6">幫助顧問了解您的家庭結構，提供更精準的規劃建議</p>

              {/* 家庭關係圖視覺化 */}
              {renderFamilyTree()}

              {/* 家庭成員選擇 */}
              <div className="space-y-4">
                {/* 配偶 */}
                <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-3">
                    <Heart size={20} className={hasSpouse ? 'text-pink-400' : 'text-slate-600'} />
                    <span className="text-white font-bold">配偶</span>
                  </div>
                  <button
                    onClick={toggleSpouse}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all
                              ${hasSpouse
                                ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                  >
                    {hasSpouse ? '已新增' : '新增'}
                  </button>
                </div>

                {/* 配偶年齡 */}
                {hasSpouse && (
                  <div className="ml-8 p-3 bg-slate-900/30 rounded-lg">
                    <label className="block text-xs text-slate-500 mb-1">配偶年齡（選填）</label>
                    <input
                      type="number"
                      placeholder="例：35"
                      value={familyMembers.find(m => m.role === 'spouse')?.age || ''}
                      onChange={(e) => {
                        const spouse = familyMembers.find(m => m.role === 'spouse');
                        if (spouse) updateFamilyMember(spouse.id, 'age', e.target.value);
                      }}
                      className="w-24 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                    />
                  </div>
                )}

                {/* 父母 */}
                <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-3">
                    <Crown size={20} className={hasParents ? 'text-amber-400' : 'text-slate-600'} />
                    <span className="text-white font-bold">父母</span>
                  </div>
                  <button
                    onClick={toggleParents}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all
                              ${hasParents
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                  >
                    {hasParents ? '已新增' : '新增'}
                  </button>
                </div>

                {/* 父母年齡 */}
                {hasParents && (
                  <div className="ml-8 p-3 bg-slate-900/30 rounded-lg flex gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">父親年齡</label>
                      <input
                        type="number"
                        placeholder="例：65"
                        value={familyMembers.find(m => m.role === 'father')?.age || ''}
                        onChange={(e) => {
                          const father = familyMembers.find(m => m.role === 'father');
                          if (father) updateFamilyMember(father.id, 'age', e.target.value);
                        }}
                        className="w-20 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">母親年齡</label>
                      <input
                        type="number"
                        placeholder="例：62"
                        value={familyMembers.find(m => m.role === 'mother')?.age || ''}
                        onChange={(e) => {
                          const mother = familyMembers.find(m => m.role === 'mother');
                          if (mother) updateFamilyMember(mother.id, 'age', e.target.value);
                        }}
                        className="w-20 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* 公婆/岳父母 */}
                {hasSpouse && (
                  <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                    <div className="flex items-center gap-3">
                      <Crown size={20} className={hasInLaws ? 'text-orange-400' : 'text-slate-600'} />
                      <span className="text-white font-bold">公婆 / 岳父母</span>
                    </div>
                    <button
                      onClick={toggleInLaws}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all
                                ${hasInLaws
                                  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                    >
                      {hasInLaws ? '已新增' : '新增'}
                    </button>
                  </div>
                )}

                {/* 公婆年齡 */}
                {hasInLaws && (
                  <div className="ml-8 p-3 bg-slate-900/30 rounded-lg flex gap-4">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">公公/岳父</label>
                      <input
                        type="number"
                        placeholder="例：68"
                        value={familyMembers.find(m => m.role === 'father_in_law')?.age || ''}
                        onChange={(e) => {
                          const fil = familyMembers.find(m => m.role === 'father_in_law');
                          if (fil) updateFamilyMember(fil.id, 'age', e.target.value);
                        }}
                        className="w-20 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">婆婆/岳母</label>
                      <input
                        type="number"
                        placeholder="例：65"
                        value={familyMembers.find(m => m.role === 'mother_in_law')?.age || ''}
                        onChange={(e) => {
                          const mil = familyMembers.find(m => m.role === 'mother_in_law');
                          if (mil) updateFamilyMember(mil.id, 'age', e.target.value);
                        }}
                        className="w-20 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* 子女 */}
                <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-3">
                    <Baby size={20} className={childCount > 0 ? 'text-emerald-400' : 'text-slate-600'} />
                    <span className="text-white font-bold">子女</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustChildren(-1)}
                      disabled={childCount === 0}
                      className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 disabled:opacity-50"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center text-white font-bold">{childCount}</span>
                    <button
                      onClick={() => adjustChildren(1)}
                      disabled={childCount >= 5}
                      className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 disabled:opacity-50"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* 子女年齡 */}
                {childCount > 0 && (
                  <div className="ml-8 p-3 bg-slate-900/30 rounded-lg">
                    <label className="block text-xs text-slate-500 mb-2">子女年齡（選填）</label>
                    <div className="flex flex-wrap gap-2">
                      {familyMembers.filter(m => m.role === 'child').map((child, idx) => (
                        <div key={child.id} className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">第{idx + 1}位:</span>
                          <input
                            type="number"
                            placeholder="歲"
                            value={child.age}
                            onChange={(e) => updateFamilyMember(child.id, 'age', e.target.value)}
                            className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-all"
                >
                  上一步
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all
                            bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500"
                >
                  下一步
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white mb-6">諮詢需求</h2>

              {/* 需求分類 */}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-3">
                  主要需求 <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {NEED_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleInputChange('needCategory', cat.id)}
                      className={`p-4 rounded-xl border text-left transition-all
                                ${formData.needCategory === cat.id
                                  ? 'bg-purple-600/20 border-purple-500 text-white'
                                  : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      <div className="text-2xl mb-2">{cat.icon}</div>
                      <div className="font-bold text-sm">{cat.label}</div>
                      <div className="text-xs text-slate-500 mt-1">{cat.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-all"
                >
                  上一步
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!canProceedStep2}
                  className={`flex-1 py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all
                            ${canProceedStep2
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500'
                              : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                >
                  下一步
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-white mb-6">補充說明</h2>

              {/* 具體需求 */}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  具體需求說明（選填）
                </label>
                <textarea
                  value={formData.specificNeeds}
                  onChange={(e) => handleInputChange('specificNeeds', e.target.value)}
                  placeholder="請簡述您的需求，例如：預計購屋預算、退休目標金額、希望了解的保險類型..."
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white
                           placeholder-slate-500 focus:border-purple-500 focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* 方便聯繫時間 */}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  <Clock size={14} className="inline mr-1" />
                  方便聯繫時間（選填）
                </label>
                <select
                  value={formData.preferredTime}
                  onChange={(e) => handleInputChange('preferredTime', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white
                           focus:border-purple-500 focus:outline-none transition-colors"
                >
                  <option value="">請選擇</option>
                  <option value="morning">上午 09:00-12:00</option>
                  <option value="afternoon">下午 14:00-18:00</option>
                  <option value="evening">晚上 19:00-21:00</option>
                  <option value="anytime">皆可</option>
                </select>
              </div>

              {/* 來源 */}
              <div>
                <label className="block text-sm font-bold text-slate-400 mb-2">
                  如何得知我們？（選填）
                </label>
                <select
                  value={formData.referralSource}
                  onChange={(e) => handleInputChange('referralSource', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white
                           focus:border-purple-500 focus:outline-none transition-colors"
                >
                  <option value="">請選擇</option>
                  <option value="search">Google 搜尋</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="line">LINE</option>
                  <option value="friend">朋友推薦</option>
                  <option value="advisor">顧問介紹</option>
                  <option value="other">其他</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-4 bg-slate-700 text-white font-bold rounded-xl hover:bg-slate-600 transition-all"
                >
                  上一步
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                  className={`flex-1 py-4 rounded-xl font-black flex items-center justify-center gap-2 transition-all
                            ${canSubmit && !isSubmitting
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500'
                              : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      處理中...
                    </>
                  ) : (
                    <>
                      <Check size={20} />
                      送出預約
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <p className="text-center text-slate-500 text-sm mt-6">
          提交後，專業顧問將在 24 小時內與您聯繫
        </p>
      </main>
    </div>
  );
};

export default BookingPage;
