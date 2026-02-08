import React, { useState } from 'react';
import {
  ChevronLeft, Building2, Users, TrendingUp, Globe, Film,
  ArrowRight, Check, MapPin, Sparkles, Handshake, ChevronDown,
  ChevronUp, MessageCircle, Target, Zap, Coffee, Crown,
  Briefcase, Heart, Shield, Star
} from 'lucide-react';
import AllianceParticleBackground from '../components/AllianceParticleBackground';

interface AlliancePageProps {
  onBack: () => void;
  onLogin: () => void;
  onApply?: () => void;
}

// 三贏生態系統
const ECOSYSTEM_ROLES = [
  {
    id: 'advisor',
    icon: Briefcase,
    title: '財務顧問',
    subtitle: '優質消費者',
    description: '專業財務顧問擁有穩定高收入，消費習慣優良，且經常需要優質場所與客戶會面',
    highlight: '100+ 位活躍會員',
    color: 'blue',
  },
  {
    id: 'store',
    icon: Building2,
    title: '合作店家',
    subtitle: '優質場所',
    description: '提供專業、舒適的環境，成為財務顧問的指定會面場所，獲得穩定優質客源',
    highlight: '目標 100 家合作',
    color: 'purple',
  },
  {
    id: 'client',
    icon: Users,
    title: '顧問客戶',
    subtitle: '延伸客群',
    description: '財務顧問的客戶多為中高資產族群，跟著顧問一同成為店家的優質顧客',
    highlight: '高消費力族群',
    color: 'emerald',
  },
];

// 店家權益（UltraLab 服務）
const STORE_BENEFITS = [
  {
    icon: Globe,
    title: '品牌官網建置',
    description: '協助您建立像 Ultra Advisor 這樣的專業品牌官網，提升數位門面',
    tag: 'UltraLab',
    tagColor: 'cyan',
  },
  {
    icon: Film,
    title: '傲創思維影片',
    description: '以 3D 視覺化技術製作獨特風格的品牌介紹影片，於社群平台曝光',
    tag: 'UltraLab',
    tagColor: 'cyan',
  },
  {
    icon: MapPin,
    title: '平台曝光導流',
    description: '店家資訊於 Ultra Advisor APP 地圖模式展示，直接導入會員流量',
    tag: '曝光',
    tagColor: 'purple',
  },
  {
    icon: Shield,
    title: '免費合作',
    description: '不收取任何加盟費或年費，合作完全免費',
    tag: '零成本',
    tagColor: 'emerald',
  },
];

// 為何財務顧問是優質客源
const ADVISOR_QUALITIES = [
  {
    icon: TrendingUp,
    title: '消費習慣優良',
    description: '財務顧問職業本身就強調財務紀律與品質消費，是店家最喜歡的客群類型',
  },
  {
    icon: Users,
    title: '帶客能力強',
    description: '顧問經常需要與客戶會面洽談，一位顧問可能每月帶來 10+ 位客戶',
  },
  {
    icon: Heart,
    title: '忠誠度高',
    description: '一旦找到合適的會面場所，顧問傾向長期固定使用，帶來穩定回頭客',
  },
  {
    icon: Star,
    title: '口碑傳播',
    description: '顧問之間會互相推薦優質場所，形成自然的口碑行銷效應',
  },
];

// 合作流程
const COOPERATION_STEPS = [
  {
    step: 1,
    title: '提交申請',
    description: '填寫線上表單，提供店家基本資訊與合作意願',
  },
  {
    step: 2,
    title: '團隊審核',
    description: '我們的團隊將在 3 個工作天內與您聯繫，安排實地勘查',
  },
  {
    step: 3,
    title: 'UltraLab 製作',
    description: '審核通過後，安排品牌素材製作（官網/影片）',
  },
  {
    step: 4,
    title: '正式上線',
    description: '店家資訊上架至平台，開始接收會員客流',
  },
];

// 常見問題
const FAQS = [
  {
    q: '什麼類型的店家適合加入？',
    a: '任何適合商務洽談或休閒社交的優質場所都歡迎加入。包含但不限於：咖啡廳、餐廳、商務中心、共享辦公室、健身房、美容美髮、SPA 會館等。關鍵是環境品質與服務態度。',
  },
  {
    q: '合作需要付費嗎？',
    a: '完全免費！我們不收取任何加盟費、年費或抽成。店家只需提供 Ultra 會員一定程度的優惠（由店家自行決定內容），即可享有所有合作權益。',
  },
  {
    q: 'UltraLab 服務包含什麼？',
    a: 'UltraLab 是我們的全 AI 數位門面工作站。根據合作深度，我們可以協助製作：傲創思維風格的 3D 品牌影片、專業品牌官網建置等。具體服務內容會在合作洽談時討論。',
  },
  {
    q: '會員優惠如何驗證？',
    a: 'Ultra 會員在消費時出示 APP 中的會員頁面，店家目視確認即可。不需要複雜的系統對接或設備投資。',
  },
  {
    q: '目前合作範圍在哪裡？',
    a: '我們目前優先拓展台中地區的合作店家，之後將逐步擴展至台北、新北、高雄等主要城市。歡迎各地區店家提前登記，我們會在拓展至您的區域時優先聯繫。',
  },
];

const AlliancePage: React.FC<AlliancePageProps> = ({ onBack, onLogin, onApply }) => {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleApply = () => {
    if (onApply) {
      onApply();
    } else {
      window.history.pushState({}, '', '/partner-apply');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
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

      <main>
        {/* ===== Hero Section - 創客島嶼生態鏈 ===== */}
        <section className="relative py-20 md:py-28 overflow-hidden min-h-[600px] md:min-h-[700px]">
          {/* 動態粒子背景 (Canvas) */}
          <div className="absolute inset-0 opacity-70">
            <AllianceParticleBackground />
          </div>

          {/* 覆蓋漸層（確保文字可讀性） */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/30 via-transparent to-slate-900/50" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.1),_transparent_60%)]" />

          <div className="relative max-w-5xl mx-auto px-4">
            {/* 標籤 */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-full">
                <Handshake size={18} className="text-purple-400" />
                <span className="text-purple-300 font-bold">傲創聯盟 Ultra Alliance</span>
              </div>
            </div>

            {/* 主標題 */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-center text-white mb-6 leading-tight">
              創客島嶼
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">生態鏈</span>
            </h1>

            {/* 副標題 */}
            <p className="text-xl md:text-2xl text-slate-300 text-center max-w-3xl mx-auto mb-8">
              連結<span className="text-purple-400 font-bold">財務顧問</span>、
              <span className="text-blue-400 font-bold">優質店家</span>、
              <span className="text-emerald-400 font-bold">高端客戶</span>
              <br className="hidden md:block" />
              打造三方共贏的商務生態系統
            </p>

            {/* 數據展示 */}
            <div className="flex flex-wrap justify-center gap-6 md:gap-12 mb-12">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-black text-white">100<span className="text-purple-400">+</span></div>
                <div className="text-slate-400 text-sm mt-1">活躍財務顧問</div>
              </div>
              <div className="w-px h-12 bg-slate-700 hidden md:block" />
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-black text-white">100<span className="text-blue-400">家</span></div>
                <div className="text-slate-400 text-sm mt-1">目標合作店家</div>
              </div>
              <div className="w-px h-12 bg-slate-700 hidden md:block" />
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-black text-white">台中</div>
                <div className="text-slate-400 text-sm mt-1">優先拓展區域</div>
              </div>
            </div>

            {/* CTA 按鈕 */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleApply}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600
                         text-white font-black rounded-xl hover:from-purple-500 hover:to-blue-500 transition-all
                         shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105"
              >
                <Building2 size={20} />
                申請成為合作夥伴
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </section>

        {/* ===== 三贏生態系統 ===== */}
        <section className="py-20 bg-slate-800/30">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">三贏生態系統</h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                不只是合作，而是建立一個互利共生的商業生態
              </p>
            </div>

            {/* 三角關係圖 */}
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {ECOSYSTEM_ROLES.map((role, idx) => (
                <div
                  key={role.id}
                  className={`relative bg-slate-800/50 border border-slate-700 rounded-3xl p-8
                             hover:border-${role.color}-500/50 transition-all group`}
                >
                  {/* 連接線裝飾 */}
                  {idx < 2 && (
                    <div className="hidden md:block absolute -right-4 top-1/2 w-8 h-0.5 bg-gradient-to-r from-slate-700 to-slate-600" />
                  )}

                  <div className={`w-16 h-16 bg-${role.color}-500/20 rounded-2xl flex items-center justify-center mb-6
                                 group-hover:scale-110 transition-transform`}>
                    <role.icon size={32} className={`text-${role.color}-400`} />
                  </div>

                  <div className={`inline-flex items-center gap-1 px-3 py-1 bg-${role.color}-500/20
                                 text-${role.color}-400 text-xs font-bold rounded-full mb-3`}>
                    {role.subtitle}
                  </div>

                  <h3 className="text-2xl font-black text-white mb-3">{role.title}</h3>
                  <p className="text-slate-400 mb-4">{role.description}</p>

                  <div className={`text-${role.color}-400 font-bold text-sm`}>
                    {role.highlight}
                  </div>
                </div>
              ))}
            </div>

            {/* 核心價值 */}
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-6 md:p-8 text-center">
              <p className="text-lg md:text-xl text-white font-bold">
                <span className="text-purple-400">「</span>
                顧問找到了固定的會面場所，店家獲得了穩定的優質客源，
                <br className="hidden md:block" />
                顧問的客戶也享受到了專屬優惠
                <span className="text-purple-400">」</span>
              </p>
            </div>
          </div>
        </section>

        {/* ===== 為何財務顧問是優質客源 ===== */}
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-300 text-sm font-bold mb-6">
                <Target size={16} />
                精準客群
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                為何財務顧問是<span className="text-blue-400">優質客源</span>？
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                我們的會員幾乎都是財務顧問，這個職業本身就具備最優質消費者的特質
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {ADVISOR_QUALITIES.map((quality, idx) => (
                <div
                  key={idx}
                  className="flex gap-5 bg-slate-800/50 border border-slate-700 rounded-2xl p-6
                           hover:border-blue-500/30 transition-all"
                >
                  <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <quality.icon size={28} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white mb-2">{quality.title}</h3>
                    <p className="text-slate-400">{quality.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 強調訊息 */}
            <div className="mt-12 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Zap size={24} className="text-blue-400" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-white mb-2">一位顧問 = 多位客戶</h4>
                  <p className="text-slate-300">
                    財務顧問的工作性質需要頻繁與客戶會面，一位顧問每月可能帶來 10-20 位客戶。
                    當您成為顧問的「指定會面場所」，等於獲得了一整條穩定的客源渠道。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 店家權益 (UltraLab) ===== */}
        <section className="py-20 bg-slate-800/30">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-cyan-300 text-sm font-bold mb-6">
                <Sparkles size={16} />
                UltraLab 服務
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                合作店家<span className="text-cyan-400">專屬權益</span>
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                我們不只導入客流，更提供數位品牌升級服務
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {STORE_BENEFITS.map((benefit, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6
                           hover:border-cyan-500/30 transition-all group"
                >
                  <div className="flex items-start gap-5">
                    <div className="w-14 h-14 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0
                                  group-hover:scale-110 transition-transform">
                      <benefit.icon size={28} className="text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-black text-white">{benefit.title}</h3>
                        <span className={`px-2 py-0.5 bg-${benefit.tagColor}-500/20 text-${benefit.tagColor}-400
                                        text-xs font-bold rounded-full`}>
                          {benefit.tag}
                        </span>
                      </div>
                      <p className="text-slate-400">{benefit.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* UltraLab 說明 */}
            <div className="mt-12 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-2xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-20 h-20 bg-gradient-to-r from-cyan-500/30 to-purple-500/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Sparkles size={40} className="text-cyan-400" />
                </div>
                <div className="text-center md:text-left">
                  <h4 className="text-2xl font-black text-white mb-2">
                    什麼是 <span className="text-cyan-400">UltraLab</span>？
                  </h4>
                  <p className="text-slate-300">
                    UltraLab 是 Ultra Advisor 旗下的<strong className="text-white">全 AI 數位門面工作站</strong>。
                    我們擅長以「傲創思維」風格製作獨特的品牌視覺內容，包括 3D 動態影片、專業官網等。
                    合作店家可獲得量身打造的數位品牌升級服務。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 合作流程 ===== */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">合作流程</h2>
              <p className="text-slate-400 text-lg">簡單四步驟，成為傲創聯盟合作夥伴</p>
            </div>

            <div className="relative">
              {/* 連接線 */}
              <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 via-blue-500 to-emerald-500 transform md:-translate-x-0.5" />

              <div className="space-y-8">
                {COOPERATION_STEPS.map((item, idx) => (
                  <div
                    key={idx}
                    className={`relative flex gap-6 ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
                  >
                    {/* 步驟數字 */}
                    <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-black text-2xl shadow-lg shadow-purple-500/25 z-10">
                      {item.step}
                    </div>

                    {/* 內容卡片 */}
                    <div className={`flex-1 bg-slate-800/50 border border-slate-700 rounded-2xl p-6
                                   ${idx % 2 === 1 ? 'md:text-right' : ''}`}>
                      <h3 className="text-xl font-black text-white mb-2">{item.title}</h3>
                      <p className="text-slate-400">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section className="py-20 bg-slate-800/30">
          <div className="max-w-3xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">常見問題</h2>
            </div>

            <div className="space-y-4">
              {FAQS.map((faq, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-slate-800/80 transition-colors"
                  >
                    <span className="font-bold text-white pr-4">{faq.q}</span>
                    <div className={`w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0
                                   ${expandedFaq === idx ? 'bg-purple-500/20' : ''}`}>
                      {expandedFaq === idx ? (
                        <ChevronUp size={18} className="text-purple-400" />
                      ) : (
                        <ChevronDown size={18} className="text-slate-400" />
                      )}
                    </div>
                  </button>
                  {expandedFaq === idx && (
                    <div className="px-6 pb-5 text-slate-300 leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CTA Section ===== */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4">
            <div className="relative bg-gradient-to-r from-purple-600/30 to-blue-600/30 border border-purple-500/30 rounded-3xl p-8 md:p-12 overflow-hidden">
              {/* 背景裝飾 */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl" />

              <div className="relative text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-white text-sm font-bold mb-6">
                  <Handshake size={16} />
                  免費加入，零風險
                </div>

                <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
                  成為傲創聯盟合作夥伴
                </h2>
                <p className="text-slate-300 text-lg mb-8 max-w-2xl mx-auto">
                  加入 100+ 位財務顧問組成的優質商務網絡
                  <br />
                  獲得穩定客源 × 數位品牌升級 × 零成本合作
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={handleApply}
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600
                             text-white font-black rounded-xl hover:from-purple-500 hover:to-blue-500 transition-all
                             shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105"
                  >
                    <Building2 size={20} />
                    申請成為合作夥伴
                    <ArrowRight size={20} />
                  </button>
                  <a
                    href="https://line.me/R/ti/p/@ultraadvisor"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#00B900]
                             text-white font-black rounded-xl hover:bg-[#00A000] transition-all hover:scale-105"
                  >
                    <MessageCircle size={20} />
                    LINE 洽詢
                  </a>
                </div>

                {/* 信任指標 */}
                <div className="flex flex-wrap justify-center gap-6 mt-8 pt-8 border-t border-white/10">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Check size={18} className="text-emerald-400" />
                    <span>免費合作</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Check size={18} className="text-emerald-400" />
                    <span>3 天內回覆</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Check size={18} className="text-emerald-400" />
                    <span>專人服務</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© 2026 Ultra Advisor. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default AlliancePage;
