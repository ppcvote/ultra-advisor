import React, { useState } from 'react';
import {
  ChevronLeft, Building2, MapPin, Phone, Mail, User, Store,
  Camera, Film, Gift, Crown, Check, Send, ArrowRight, ArrowLeft,
  Coffee, Utensils, Dumbbell, Scissors, Sparkles, MessageCircle
} from 'lucide-react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface PartnerApplicationPageProps {
  onBack: () => void;
}

// 店家類型選項
const STORE_TYPES = [
  { id: 'cafe', label: '咖啡廳', icon: Coffee },
  { id: 'restaurant', label: '餐廳', icon: Utensils },
  { id: 'business-center', label: '商務中心', icon: Building2 },
  { id: 'gym', label: '健身房', icon: Dumbbell },
  { id: 'beauty', label: '美容美髮', icon: Scissors },
  { id: 'other', label: '其他', icon: Store },
];

// 合作意願選項
const COOPERATION_OPTIONS = [
  { id: 'short-video', label: '短影音拍攝', icon: Camera, desc: '免費曝光' },
  { id: '3d-render', label: '3D 渲染影片', icon: Film, desc: '品牌加值' },
  { id: 'member-discount', label: '會員專屬優惠', icon: Gift, desc: '導客流量' },
  { id: 'tier-system', label: '會員分級系統', icon: Crown, desc: '深度合作' },
];

// 表單資料類型
interface FormData {
  // 店家基本資訊
  storeName: string;
  storeType: string;
  otherStoreType: string;
  address: string;
  district: string;

  // 聯絡資訊
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactRole: string;

  // 合作意願
  cooperationInterests: string[];
  discountOffer: string;
  additionalInfo: string;
}

const INITIAL_FORM: FormData = {
  storeName: '',
  storeType: '',
  otherStoreType: '',
  address: '',
  district: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  contactRole: '',
  cooperationInterests: [],
  discountOffer: '',
  additionalInfo: '',
};

// 台灣縣市選項
const DISTRICTS = [
  '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市',
  '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣',
  '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '台東縣', '澎湖縣', '金門縣', '連江縣'
];

const PartnerApplicationPage: React.FC<PartnerApplicationPageProps> = ({ onBack }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const totalSteps = 3;

  const updateFormData = (field: keyof FormData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleCooperationInterest = (id: string) => {
    const current = formData.cooperationInterests;
    if (current.includes(id)) {
      updateFormData('cooperationInterests', current.filter(i => i !== id));
    } else {
      updateFormData('cooperationInterests', [...current, id]);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.storeName && formData.storeType && formData.address && formData.district;
      case 2:
        return formData.contactName && formData.contactPhone && formData.contactEmail;
      case 3:
        return formData.cooperationInterests.length > 0;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) return;

    setIsSubmitting(true);

    try {
      // 儲存到 Firestore
      await addDoc(collection(db, 'partnerApplications'), {
        // 店家資訊
        storeName: formData.storeName,
        storeType: formData.storeType,
        otherStoreType: formData.storeType === 'other' ? formData.otherStoreType : null,
        district: formData.district,
        address: formData.address,

        // 聯絡資訊
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        contactEmail: formData.contactEmail,
        contactRole: formData.contactRole || null,

        // 合作意願
        cooperationInterests: formData.cooperationInterests,
        discountOffer: formData.discountOffer || null,
        additionalInfo: formData.additionalInfo || null,

        // 系統資訊
        status: 'pending', // pending, reviewing, approved, rejected
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

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // 提交成功畫面
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <Check size={48} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-4">申請已送出！</h1>
          <p className="text-slate-400 mb-8">
            感謝您申請加入傲創聯盟！<br />
            我們的團隊會在 <span className="text-purple-400 font-bold">3 個工作天內</span> 與您聯繫。
          </p>
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-8 text-left">
            <h3 className="text-white font-bold mb-4">申請摘要</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">店家名稱</span>
                <span className="text-white">{formData.storeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">聯絡人</span>
                <span className="text-white">{formData.contactName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">聯絡電話</span>
                <span className="text-white">{formData.contactPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">合作項目</span>
                <span className="text-purple-400">{formData.cooperationInterests.length} 項</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={onBack}
              className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black rounded-xl
                       hover:from-purple-500 hover:to-pink-500 transition-all"
            >
              返回傲創聯盟
            </button>
            <a
              href="https://line.me/R/ti/p/@ultraadvisor"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-6 py-4 bg-[#00B900] text-white font-black rounded-xl
                       hover:bg-[#00A000] transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle size={20} />
              加入 LINE 官方帳號
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
            <span className="font-bold">返回</span>
          </button>
          <div className="text-white font-black text-sm">
            申請合作
          </div>
          <div className="w-16" /> {/* Spacer */}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                      ${currentStep >= step
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'}`}
                  >
                    {currentStep > step ? <Check size={18} /> : step}
                  </div>
                  <span className={`text-xs mt-2 ${currentStep >= step ? 'text-purple-400' : 'text-slate-500'}`}>
                    {step === 1 ? '店家資訊' : step === 2 ? '聯絡方式' : '合作意願'}
                  </span>
                </div>
                {step < 3 && (
                  <div className={`flex-1 h-0.5 mx-2 ${currentStep > step ? 'bg-purple-500' : 'bg-slate-700'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6 md:p-8">

          {/* Step 1: 店家資訊 */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Store size={32} className="text-purple-400" />
                </div>
                <h2 className="text-2xl font-black text-white">店家基本資訊</h2>
                <p className="text-slate-400 mt-2">請填寫您的店家資訊</p>
              </div>

              {/* 店家名稱 */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  店家名稱 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) => updateFormData('storeName', e.target.value)}
                  placeholder="例如：星巴克信義門市"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white
                           placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* 店家類型 */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3">
                  店家類型 <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {STORE_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => updateFormData('storeType', type.id)}
                      className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2
                        ${formData.storeType === type.id
                          ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                          : 'bg-slate-900/50 border-slate-600 text-slate-400 hover:border-slate-500'}`}
                    >
                      <type.icon size={24} />
                      <span className="text-xs font-bold">{type.label}</span>
                    </button>
                  ))}
                </div>
                {formData.storeType === 'other' && (
                  <input
                    type="text"
                    value={formData.otherStoreType}
                    onChange={(e) => updateFormData('otherStoreType', e.target.value)}
                    placeholder="請說明店家類型"
                    className="w-full mt-3 px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white
                             placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                )}
              </div>

              {/* 所在區域 */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  所在縣市 <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.district}
                  onChange={(e) => updateFormData('district', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white
                           focus:outline-none focus:border-purple-500 transition-colors"
                >
                  <option value="">請選擇縣市</option>
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* 詳細地址 */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  詳細地址 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => updateFormData('address', e.target.value)}
                    placeholder="請輸入完整地址"
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white
                             placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 聯絡資訊 */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <User size={32} className="text-blue-400" />
                </div>
                <h2 className="text-2xl font-black text-white">聯絡方式</h2>
                <p className="text-slate-400 mt-2">請填寫聯絡人資訊，以便我們與您聯繫</p>
              </div>

              {/* 聯絡人姓名 */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  聯絡人姓名 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => updateFormData('contactName', e.target.value)}
                    placeholder="您的姓名"
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white
                             placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              {/* 職稱 */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  職稱
                </label>
                <input
                  type="text"
                  value={formData.contactRole}
                  onChange={(e) => updateFormData('contactRole', e.target.value)}
                  placeholder="例如：店長、負責人、行銷經理"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white
                           placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* 聯絡電話 */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  聯絡電話 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="tel"
                    value={formData.contactPhone}
                    onChange={(e) => updateFormData('contactPhone', e.target.value)}
                    placeholder="0912-345-678"
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white
                             placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  電子郵件 <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => updateFormData('contactEmail', e.target.value)}
                    placeholder="example@email.com"
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white
                             placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: 合作意願 */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles size={32} className="text-emerald-400" />
                </div>
                <h2 className="text-2xl font-black text-white">合作意願</h2>
                <p className="text-slate-400 mt-2">請選擇您有興趣的合作項目（可複選）</p>
              </div>

              {/* 合作項目 */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-3">
                  有興趣的合作項目 <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {COOPERATION_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleCooperationInterest(option.id)}
                      className={`p-4 rounded-xl border transition-all flex items-center gap-4 text-left
                        ${formData.cooperationInterests.includes(option.id)
                          ? 'bg-purple-500/20 border-purple-500'
                          : 'bg-slate-900/50 border-slate-600 hover:border-slate-500'}`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                        ${formData.cooperationInterests.includes(option.id)
                          ? 'bg-purple-500/30'
                          : 'bg-slate-800'}`}>
                        <option.icon size={24} className={formData.cooperationInterests.includes(option.id)
                          ? 'text-purple-400'
                          : 'text-slate-400'} />
                      </div>
                      <div className="flex-1">
                        <div className={`font-bold ${formData.cooperationInterests.includes(option.id)
                          ? 'text-white'
                          : 'text-slate-300'}`}>
                          {option.label}
                        </div>
                        <div className="text-xs text-emerald-400">{option.desc}</div>
                      </div>
                      {formData.cooperationInterests.includes(option.id) && (
                        <Check size={20} className="text-purple-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 優惠方案 */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  您願意提供的優惠方案
                </label>
                <textarea
                  value={formData.discountOffer}
                  onChange={(e) => updateFormData('discountOffer', e.target.value)}
                  placeholder="例如：Ultra 會員消費 95 折、滿 500 折 50 元..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white
                           placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                />
              </div>

              {/* 其他備註 */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  其他補充說明
                </label>
                <textarea
                  value={formData.additionalInfo}
                  onChange={(e) => updateFormData('additionalInfo', e.target.value)}
                  placeholder="任何您想讓我們知道的事項..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-xl text-white
                           placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                />
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                className="flex-1 px-6 py-4 bg-slate-700 text-white font-bold rounded-xl
                         hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft size={20} />
                上一步
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed() || isSubmitting}
              className={`flex-1 px-6 py-4 font-black rounded-xl transition-all flex items-center justify-center gap-2
                ${canProceed()
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  送出中...
                </>
              ) : currentStep === totalSteps ? (
                <>
                  <Send size={20} />
                  送出申請
                </>
              ) : (
                <>
                  下一步
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-slate-500 text-sm mt-6">
          填寫表單即表示您同意我們的隱私權政策
        </p>
      </main>
    </div>
  );
};

export default PartnerApplicationPage;
