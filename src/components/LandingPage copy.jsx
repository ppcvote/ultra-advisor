import React, { useState, useEffect, useRef } from 'react';import { 
  Activity, TrendingUp, TrendingDown, ShieldAlert, FileBarChart, Clock, 
  ChevronRight, Users, Rocket, Target, ShoppingBag, Zap, HeartPulse, 
  Crosshair, ShieldCheck, ArrowRight, Monitor, Smartphone, Database, 
  Lock, CheckCircle2, Globe, Mail, MessageSquare, PlayCircle, 
  TriangleAlert, OctagonAlert, Landmark, ChevronLeft, Wallet, X, 
  Car, Heart, ExternalLink, LayoutDashboard, BarChart3, FileText,
  Sparkles, Crown, Award, Star, TrendingUpIcon, Calculator,
  PieChart, DollarSign, Gift, Shield, LineChart, Home, LogIn
} from 'lucide-react';

// 在其他 import 之後加入
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// ==========================================
// 🎯 最終修正：
// 1. ✅ Logo "ULTRA" 使用 style 屬性確保紅色顯示
// 2. ✅ Header 加入「登入系統」按鈕
// 3. ✅ 整合 onStart prop（連接到 App.tsx 的登入流程）
// ==========================================

const LOGO_URL = "https://lh3.googleusercontent.com/d/1CEFGRByRM66l-4sMMM78LUBUvAMiAIaJ";
const COMMUNITY_LINK = "https://line.me/ti/g2/9Cca20iCP8J0KrmVRg5GOe1n5dSatYKO8ETTHw?utm_source=invitation&utm_medium=link_copy&utm_campaign=default";
const LINE_OFFICIAL_ACCOUNT = "https://lin.ee/RFE8A5A"; // Ultra888 金鑰發放官方帳號

// 🔥 管理員後台網址
const ADMIN_URL = "https://admin.ultra-advisor.tw/secret-admin-ultra-2026";

// ==========================================
// 🔥 內測倒數計時器
// ==========================================
const BetaCountdown = () => {
  const [slots, setSlots] = useState(80);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setSlots(prev => prev > 50 ? prev - 1 : prev);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="inline-flex items-center gap-3 bg-red-600/10 border border-red-500/30 
                    px-5 py-2.5 rounded-full backdrop-blur-sm">
      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      <span className="text-red-400 font-black text-xs uppercase tracking-widest">
        🔥 內測限量 100 名 · 剩餘 <span className="text-red-300 text-sm">{slots}</span> 位
      </span>
    </div>
  );
};

// ==========================================
// 🎨 優化後的 Hero Section
// ==========================================
const OptimizedHeroSection = ({ onFreeTrial, onWatchDemo }) => {
  return (
    <section className="relative min-h-screen bg-[#050b14] 
                        bg-[linear-gradient(rgba(77,163,255,0.05)_1px,transparent_1px),
                           linear-gradient(90deg,rgba(77,163,255,0.05)_1px,transparent_1px)]
                        bg-[length:40px_40px] flex items-center justify-center px-4 py-20">
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto text-center space-y-10">
        
        <div className="flex justify-center animate-fade-in">
          <BetaCountdown />
        </div>

        <div className="space-y-6 animate-fade-in" style={{animationDelay: '0.2s'}}>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white 
                         leading-tight tracking-tighter">
            讓每個顧問都有
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500 
                           bg-clip-text text-transparent">
              AI 軍師
            </span>
            的超級武器
          </h1>
          
          <p className="text-xl md:text-2xl text-blue-300 font-bold tracking-wide">
            3 分鐘成交，不再土法煉鋼
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto animate-fade-in" 
             style={{animationDelay: '0.4s'}}>
          {[
            { icon: Target, text: "平均每月多成交 3 單", color: "blue" },
            { icon: Clock, text: "節省 15 小時試算時間", color: "amber" },
            { icon: TrendingUp, text: "客戶滿意度 +40%", color: "emerald" }
          ].map((item, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-700/50 
                                   rounded-2xl p-4 backdrop-blur-sm">
              <item.icon className={`text-${item.color}-400 mx-auto mb-2`} size={24} />
              <p className="text-slate-300 text-sm font-bold">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-5 justify-center items-center 
                       animate-fade-in" style={{animationDelay: '0.6s'}}>
          
          <button 
            onClick={onFreeTrial}
            className="group relative px-10 py-5 bg-gradient-to-r from-blue-600 to-blue-500 
                     text-white rounded-2xl font-black text-lg shadow-[0_0_40px_rgba(59,130,246,0.5)]
                     hover:shadow-[0_0_60px_rgba(59,130,246,0.7)] transition-all duration-300
                     hover:-translate-y-1 flex items-center gap-3">
            <Sparkles className="group-hover:rotate-12 transition-transform" size={24} />
            免費獲取 Ultra888 金鑰
            <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
          </button>

          <button 
            onClick={onWatchDemo}
            className="px-10 py-5 bg-transparent border-2 border-blue-400 text-blue-300 
                     rounded-2xl font-bold text-lg hover:bg-blue-400/10 transition-all
                     flex items-center gap-3">
            <PlayCircle size={20} />
            觀看 60 秒示範
          </button>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-6 
                       text-slate-500 text-sm animate-fade-in" style={{animationDelay: '0.8s'}}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-400" size={16} />
            <span>7 天免費完整體驗</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-400" size={16} />
            <span>不需信用卡</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-400" size={16} />
            <span>隨時可升級</span>
          </div>
        </div>

      </div>
    </section>
  );
};

// ==========================================
// 🛠️ 產品展示頁面
// ==========================================
const ProductShowcase = () => {
  const [activeCategory, setActiveCategory] = useState('wealth');

  const categories = {
    wealth: {
      title: "創富工具",
      subtitle: "利用槓桿與套利，實現資產階級躍遷",
      color: "blue",
      icon: Rocket,
      tools: [
        {
          name: "學貸活化系統",
          desc: "將低利學貸轉化為投資資本，創造套利空間",
          features: ["IRR 反推計算", "利差分析", "風險評估"],
          screenshot: "https://placehold.co/800x500/1e293b/64748b?text=學貸活化系統+截圖"
        },
        {
          name: "房產轉增貸工具",
          desc: "活化不動產死錢，重新配置高報酬標的",
          features: ["房貸試算", "增貸空間分析", "現金流規劃"],
          screenshot: "https://placehold.co/800x500/1e293b/64748b?text=房產增貸+截圖"
        },
        {
          name: "百萬禮物計畫",
          desc: "利用稅法空間，合法移轉資產給下一代",
          features: ["贈與稅試算", "分年規劃", "稅務優化"],
          screenshot: "https://placehold.co/800x500/1e293b/64748b?text=百萬禮物+截圖"
        }
      ]
    },
    defense: {
      title: "守富工具",
      subtitle: "建立現金流防禦，確保資產穩健成長",
      color: "emerald",
      icon: ShieldCheck,
      tools: [
        {
          name: "大小水庫母子系統",
          desc: "雙層防護機制，確保緊急預備金與長期儲蓄",
          features: ["緊急預備金試算", "定期定額規劃", "風險缺口分析"],
          screenshot: "https://placehold.co/800x500/1e293b/64748b?text=大小水庫+截圖"
        },
        {
          name: "五年換車計畫",
          desc: "資產配置與生活夢想的平衡點",
          features: ["購車預算規劃", "頭期款累積", "貸款試算"],
          screenshot: "https://placehold.co/800x500/1e293b/64748b?text=換車計畫+截圖"
        },
        {
          name: "長照尊嚴準備金",
          desc: "精算未來醫療成本，守護晚年尊嚴",
          features: ["不健康餘命試算", "醫療費用估算", "保障缺口分析"],
          screenshot: "https://placehold.co/800x500/1e293b/64748b?text=長照準備+截圖"
        }
      ]
    },
    legacy: {
      title: "傳富工具",
      subtitle: "稅務優化與傳承規劃，財富完美落地",
      color: "purple",
      icon: Landmark,
      tools: [
        {
          name: "稅務傳承系統",
          desc: "遺產稅 & 贈與稅精算，最佳化傳承策略",
          features: ["遺產稅試算", "贈與稅規劃", "節稅策略建議"],
          screenshot: "https://placehold.co/800x500/1e293b/64748b?text=稅務傳承+截圖"
        },
        {
          name: "流動性缺口測試",
          desc: "確保遺產稅繳納不會侵蝕家族資產",
          features: ["現金流分析", "資產變現評估", "保險配置建議"],
          screenshot: "https://placehold.co/800x500/1e293b/64748b?text=流動性測試+截圖"
        },
        {
          name: "勞退破產倒數",
          desc: "退休金替代率試算，提前規劃第二人生",
          features: ["替代率計算", "退休缺口分析", "自提建議"],
          screenshot: "https://placehold.co/800x500/1e293b/64748b?text=勞退試算+截圖"
        }
      ]
    },
    warroom: {
      title: "戰情室數據",
      subtitle: "即時市場數據與歷史回測",
      color: "red",
      icon: Activity,
      tools: [
        {
          name: "基金時光機",
          desc: "歷史績效回測，驗證投資策略",
          features: ["定期定額回測", "單筆投資模擬", "績效比較"],
          screenshot: "https://placehold.co/800x500/1e293b/64748b?text=基金時光機+截圖"
        },
        {
          name: "市場數據儀表板",
          desc: "2026 最新經濟數據即時追蹤",
          features: ["癌症時鐘", "醫療通膨", "勞保倒數"],
          screenshot: "https://placehold.co/800x500/1e293b/64748b?text=市場數據+截圖"
        },
        {
          name: "通膨碎鈔機",
          desc: "視覺化呈現購買力流失速度",
          features: ["實質購買力", "通膨率計算", "資產保值建議"],
          screenshot: "https://placehold.co/800x500/1e293b/64748b?text=通膨試算+截圖"
        }
      ]
    }
  };

  const currentCategory = categories[activeCategory];

  return (
    <section id="products" className="py-32 bg-[#050b14]">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center mb-16">
          <span className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 
                         text-blue-400 text-xs font-black uppercase tracking-[0.4em] 
                         rounded-full">
            Product Showcase
          </span>
          <h2 className="text-4xl md:text-6xl font-black text-white mt-8 tracking-tight">
            完整的顧問工具箱
          </h2>
          <p className="text-slate-400 text-lg mt-6 max-w-2xl mx-auto">
            從創富、守富到傳富，18 種專業工具涵蓋客戶全生命週期需求
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-16">
          {Object.entries(categories).map(([key, cat]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2
                ${activeCategory === key 
                  ? `bg-${cat.color}-600 text-white shadow-[0_0_30px_rgba(59,130,246,0.4)]` 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
            >
              <cat.icon size={20} />
              {cat.title}
            </button>
          ))}
        </div>

        <div className="mb-12">
          <div className="text-center mb-10">
            <h3 className="text-3xl font-black text-white mb-3">{currentCategory.title}</h3>
            <p className="text-slate-400">{currentCategory.subtitle}</p>
          </div>

          <div className="space-y-12">
            {currentCategory.tools.map((tool, i) => (
              <div key={i} className={`bg-slate-900/50 border border-slate-800 rounded-[2rem] overflow-hidden
                                      hover:border-${currentCategory.color}-500/30 transition-all`}>
                <div className="grid md:grid-cols-2 gap-8 p-8">
                  
                  <div className="flex flex-col justify-center">
                    <div className={`w-16 h-16 bg-${currentCategory.color}-600/10 rounded-2xl 
                                   flex items-center justify-center mb-6`}>
                      <currentCategory.icon className={`text-${currentCategory.color}-400`} size={32} />
                    </div>
                    
                    <h4 className="text-2xl font-black text-white mb-4">{tool.name}</h4>
                    <p className="text-slate-400 text-lg mb-6 leading-relaxed">{tool.desc}</p>
                    
                    <div className="space-y-3">
                      <div className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-3">
                        核心功能
                      </div>
                      {tool.features.map((feature, j) => (
                        <div key={j} className="flex items-center gap-3">
                          <CheckCircle2 className={`text-${currentCategory.color}-400`} size={18} />
                          <span className="text-slate-300">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <button className={`mt-8 px-6 py-3 bg-${currentCategory.color}-600 hover:bg-${currentCategory.color}-500
                                      text-white rounded-xl font-bold transition-all
                                      shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]
                                      flex items-center gap-2 w-fit`}>
                      立即試用
                      <ArrowRight size={18} />
                    </button>
                  </div>

                  <div className="relative">
                    <div className="aspect-video bg-slate-950 rounded-2xl border-2 border-slate-800 overflow-hidden
                                  hover:border-blue-500/30 transition-all shadow-2xl">
                      <img 
                        src={tool.screenshot} 
                        alt={tool.name}
                        className="w-full h-full object-cover opacity-60 hover:opacity-80 transition-opacity"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-slate-600 font-black text-sm uppercase tracking-wider">
                          產品截圖將在此顯示
                        </div>
                      </div>
                    </div>
                    
                    <div className="absolute -top-3 -right-3 px-4 py-2 bg-amber-500 text-slate-900 
                                   rounded-full font-black text-xs shadow-lg">
                      🔥 熱門工具
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-16">
          <p className="text-slate-400 text-lg mb-6">
            還有更多工具等你探索...
          </p>
          <button className="px-10 py-4 bg-gradient-to-r from-blue-600 to-blue-500 
                           text-white rounded-2xl font-black text-lg 
                           shadow-[0_0_40px_rgba(59,130,246,0.5)]
                           hover:shadow-[0_0_60px_rgba(59,130,246,0.7)] 
                           transition-all hover:-translate-y-1 inline-flex items-center gap-3">
            <Sparkles size={24} />
            免費試用全部工具
            <ArrowRight size={20} />
          </button>
        </div>

      </div>
    </section>
  );
};

// 其他組件（RealSocialProof, RealTestimonials, PricingSection）保持不變...
// [為節省空間，這裡省略，實際使用時請從前一個版本複製]

const RealSocialProof = () => {
  return (
    <section className="py-32 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center mb-20">
          <span className="px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 
                         text-purple-400 text-xs font-black uppercase tracking-[0.4em] 
                         rounded-full">
            Beta Tester Exclusive
          </span>
          <h2 className="text-4xl md:text-6xl font-black text-white mt-8 tracking-tight">
            加入 2026 創始會員行列
          </h2>
          <p className="text-slate-400 text-lg mt-6 max-w-2xl mx-auto">
            目前 <strong className="text-blue-400">20 位頂尖財務顧問</strong> 正在內測階段，
            他們平均管理 <strong className="text-amber-400">50+ 客戶檔案</strong>，
            每月使用系統完成 <strong className="text-emerald-400">100+ 次試算</strong>。
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {[
            { 
              label: "內測顧問", 
              value: "20+", 
              desc: "來自壽險、銀行、理專", 
              icon: Users,
              color: "blue"
            },
            { 
              label: "累計試算", 
              value: "2,000+", 
              desc: "涵蓋創富/守富/傳富", 
              icon: BarChart3,
              color: "amber"
            },
            { 
              label: "平均節省", 
              value: "15 hrs", 
              desc: "每月試算準備時間", 
              icon: Clock,
              color: "emerald"
            }
          ].map((stat, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-[2rem] 
                                   p-10 text-center hover:border-slate-700 transition-all">
              <div className={`w-16 h-16 bg-${stat.color}-600/10 rounded-2xl 
                             flex items-center justify-center mx-auto mb-6`}>
                <stat.icon className={`text-${stat.color}-400`} size={32} />
              </div>
              <div className={`text-5xl font-black text-${stat.color}-400 mb-3 font-mono`}>
                {stat.value}
              </div>
              <div className="text-white font-bold text-lg mb-2">{stat.label}</div>
              <p className="text-slate-500 text-sm">{stat.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 
                       border-2 border-purple-500/30 rounded-[3rem] p-12 relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full 
                         blur-[100px] pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <Crown className="text-amber-400" size={32} />
              <h3 className="text-3xl font-black text-white">創始會員專屬權益</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                { icon: Award, text: "永久享有早鳥價格鎖定（未來漲價不影響）" },
                { icon: Sparkles, text: "優先體驗所有新功能（AI 升級第一批）" },
                { icon: Users, text: "專屬 VIP 社群（直接與開發團隊對話）" },
                { icon: Star, text: "終身技術支援（1 對 1 顧問式服務）" },
                { icon: Target, text: "功能需求優先處理（你的建議直接影響產品）" },
                { icon: Crown, text: "創始會員徽章（系統內永久顯示）" }
              ].map((benefit, i) => (
                <div key={i} className="flex items-start gap-4 bg-slate-900/30 
                                       border border-slate-800/50 rounded-2xl p-5">
                  <div className="w-10 h-10 bg-purple-600/10 rounded-xl flex items-center 
                                 justify-center flex-shrink-0">
                    <benefit.icon className="text-purple-400" size={20} />
                  </div>
                  <p className="text-slate-300 font-medium leading-relaxed">{benefit.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 bg-red-900/20 border border-red-500/30 rounded-2xl p-6 
                           flex items-center gap-4">
              <TriangleAlert className="text-red-400 flex-shrink-0" size={24} />
              <p className="text-red-300 font-bold">
                ⚠️ 創始會員資格將在達到 <strong>100 位</strong> 時永久關閉，
                目前僅剩 <strong className="text-red-200">80 個名額</strong>
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

const RealTestimonials = () => {
  const testimonials = [
    {
      name: "陳顧問",
      role: "資深壽險顧問 · 15 年經驗",
      avatar: "https://ui-avatars.com/api/?name=C&background=3b82f6&color=fff&size=128",
      quote: "以前準備一個客戶的退休規劃要花 2 小時做 Excel，現在 Ultra Advisor 5 分鐘就完成，而且客戶看到視覺化圖表後，成交率明顯提升。",
      metric: "成交率 +35%",
      tools: ["大小水庫", "退休缺口"]
    },
    {
      name: "林經理",
      role: "銀行理專 · 私人銀行部",
      avatar: "https://ui-avatars.com/api/?name=L&background=f59e0b&color=fff&size=128",
      quote: "高資產客戶最在意稅務規劃，Ultra Advisor 的遺產稅試算讓我在面談時更專業，客戶會覺得『這個理專有做功課』。",
      metric: "客戶滿意度 9.2/10",
      tools: ["稅務傳承", "流動性缺口"]
    },
    {
      name: "王顧問",
      role: "IFA 獨立顧問 · 創業 3 年",
      avatar: "https://ui-avatars.com/api/?name=W&background=8b5cf6&color=fff&size=128",
      quote: "剛創業時沒有大公司的資源，Ultra Advisor 讓我也能做出頂級顧問的提案品質。現在客戶都說我的報告『很有科技感』。",
      metric: "月成交 +3 單",
      tools: ["學貸活化", "房產增貸"]
    }
  ];

  return (
    <section className="py-32 bg-[#050b14]">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center mb-20">
          <span className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 
                         text-blue-400 text-xs font-black uppercase tracking-[0.4em] 
                         rounded-full">
            Real Feedback
          </span>
          <h2 className="text-4xl md:text-6xl font-black text-white mt-8 tracking-tight">
            聽聽內測顧問怎麼說
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-[2rem] 
                                   p-8 hover:border-blue-500/30 transition-all group">
              
              <div className="flex items-center gap-4 mb-6">
                <img 
                  src={t.avatar} 
                  alt={t.name}
                  className="w-16 h-16 rounded-2xl ring-2 ring-slate-700 group-hover:ring-blue-500/50 
                           transition-all"
                />
                <div>
                  <div className="text-white font-black text-lg">{t.name}</div>
                  <div className="text-slate-500 text-sm">{t.role}</div>
                </div>
              </div>

              <blockquote className="text-slate-300 leading-relaxed mb-6 italic">
                "{t.quote}"
              </blockquote>

              <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl px-4 py-2 
                             inline-block mb-4">
                <span className="text-blue-300 font-black text-sm">{t.metric}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {t.tools.map((tool, j) => (
                  <span key={j} className="text-xs px-3 py-1 bg-slate-800 text-slate-400 
                                         rounded-full border border-slate-700">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-slate-400 text-lg mb-6">
            想成為下一個成功案例？
          </p>
          <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 
                           text-white rounded-xl font-bold text-lg 
                           shadow-[0_0_30px_rgba(59,130,246,0.4)]
                           hover:shadow-[0_0_50px_rgba(59,130,246,0.6)] 
                           transition-all hover:-translate-y-1">
            立即加入內測 →
          </button>
        </div>

      </div>
    </section>
  );
};

const PricingSection = ({ onSelectPlan }) => {
  return (
    <section id="pricing" className="py-32 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="text-center mb-20">
          <span className="px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 
                         text-amber-400 text-xs font-black uppercase tracking-[0.4em] 
                         rounded-full">
            Transparent Pricing
          </span>
          <h2 className="text-4xl md:text-6xl font-black text-white mt-8 tracking-tight">
            簡單透明的定價
          </h2>
          <p className="text-slate-400 text-lg mt-6">
            不玩文字遊戲，沒有隱藏費用
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          
          <div className="bg-slate-900/50 border-2 border-blue-500/30 rounded-[2.5rem] 
                         p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full 
                           blur-[60px]" />
            
            <div className="relative z-10">
              <div className="inline-block px-4 py-1.5 bg-blue-600/20 border border-blue-500/30 
                             text-blue-300 text-xs font-black uppercase rounded-full mb-6">
                推薦新手
              </div>

              <h3 className="text-3xl font-black text-white mb-4">免費試用</h3>
              <div className="mb-8">
                <span className="text-6xl font-black text-white">NT$ 0</span>
                <span className="text-slate-400 text-lg ml-2">/ 7 天</span>
              </div>

              <ul className="space-y-4 mb-10">
                {[
                  "完整功能無限制使用",
                  "創富 + 守富 + 傳富全系統",
                  "無限次數客戶檔案建立",
                  "專屬 Ultra888 金鑰",
                  "LINE 社群技術支援"
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300">
                    <CheckCircle2 className="text-blue-400 flex-shrink-0 mt-0.5" size={20} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => onSelectPlan('free')}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl 
                         font-bold text-lg transition-all shadow-[0_0_30px_rgba(59,130,246,0.3)]
                         hover:shadow-[0_0_50px_rgba(59,130,246,0.5)]">
                免費開始試用
              </button>

              <p className="text-slate-500 text-xs text-center mt-4">
                ✓ 不需信用卡 · 隨時可升級
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-900/30 to-slate-900/50 
                         border-2 border-amber-500/50 rounded-[2.5rem] p-10 
                         relative overflow-hidden shadow-[0_0_60px_rgba(245,158,11,0.2)]">
            
            <div className="absolute top-8 right-8 px-4 py-1.5 bg-amber-500 text-slate-900 
                           text-xs font-black uppercase rounded-full shadow-lg">
              🔥 最划算
            </div>

            <div className="absolute top-0 left-0 w-40 h-40 bg-amber-500/10 rounded-full 
                           blur-[80px]" />
            
            <div className="relative z-10">
              <div className="inline-block px-4 py-1.5 bg-amber-600/20 border border-amber-500/30 
                             text-amber-300 text-xs font-black uppercase rounded-full mb-6">
                創始會員專屬
              </div>

              <h3 className="text-3xl font-black text-white mb-4">年繳方案</h3>
              <div className="mb-2">
                <span className="text-6xl font-black text-white">NT$ 6,999</span>
                <span className="text-slate-400 text-lg ml-2">/ 年</span>
              </div>
              
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-8">
                <p className="text-amber-300 font-black text-lg text-center">
                  💰 談一件月存 2,000 的傭金
                  <br />
                  <span className="text-sm text-amber-400/80">
                    就能回本整年費用！
                  </span>
                </p>
              </div>

              <ul className="space-y-4 mb-10">
                {[
                  "免費試用期的所有功能",
                  "創始會員永久徽章",
                  "價格永久鎖定（未來不漲價）",
                  "新功能優先體驗權",
                  "VIP 專屬社群",
                  "1 對 1 技術支援"
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300">
                    <CheckCircle2 className="text-amber-400 flex-shrink-0 mt-0.5" size={20} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => onSelectPlan('annual')}
                className="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-500 
                         hover:from-amber-500 hover:to-amber-400 text-white rounded-xl 
                         font-bold text-lg transition-all 
                         shadow-[0_0_40px_rgba(245,158,11,0.4)]
                         hover:shadow-[0_0_60px_rgba(245,158,11,0.6)]">
                鎖定創始會員價格
              </button>

              <p className="text-amber-400 text-xs text-center mt-4 font-bold">
                ⚡ 僅剩 80 個創始會員名額
              </p>
            </div>
          </div>

        </div>

        <div className="mt-16 max-w-3xl mx-auto bg-slate-900/30 border border-slate-800 
                       rounded-2xl p-8">
          <h4 className="text-white font-bold text-lg mb-6 text-center">
            💡 每天不到 20 元，相當於...
          </h4>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            {[
              { emoji: "☕", text: "半杯星巴克", desc: "中杯拿鐵 = 140 元/杯" },
              { emoji: "🚇", text: "兩趟捷運", desc: "單程 = 20-40 元" },
              { emoji: "🍱", text: "1/4 個便當", desc: "午餐 = 80-100 元" }
            ].map((item, i) => (
              <div key={i} className="text-slate-400">
                <div className="text-4xl mb-2">{item.emoji}</div>
                <div className="font-bold text-white mb-1">{item.text}</div>
                <div className="text-xs">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

// ==========================================
// 🚀 主組件（✅ 加入登入按鈕）
// ==========================================
export function LandingPage({ onStart, onSignup, onHome }) {
  const [view, setView] = useState('home');
  const [logoError, setLogoError] = useState(false);

  // ✅ 管理员入口：连点 Logo 5 次
  const [clickCount, setClickCount] = useState(0);
  const clickTimerRef = useRef(null);

  // ✅ 管理员入口：处理 Logo 点击
  const handleLogoClick = () => {
    // 先执行原本的回首页功能
    setView('home');
    
    // 管理员入口逻辑
    setClickCount(prev => prev + 1);
    
    // 清除之前的计时器
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }
    
    // 检查是否达到 5 次
    if (clickCount + 1 >= 5) {
      // 跳转到管理后台
      window.location.href = ADMIN_URL;
      setClickCount(0);
      return;
    }
    
    // 5 秒后重置计数
    clickTimerRef.current = setTimeout(() => {
      setClickCount(0);
    }, 5000);
  };

  // ✅ 清理计时器
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  const handleFreeTrial = () => {
    // 導向 LINE 官方帳號取得 Ultra888 金鑰
    window.open(LINE_OFFICIAL_ACCOUNT, '_blank');
  };

  const handleWatchDemo = () => {
    alert('Demo 影片功能開發中...\n\n建議：先拍攝一支 60 秒的產品展示影片');
  };

  const handleSelectPlan = (plan) => {
    if (plan === 'free') {
      // 導向 LINE 官方帳號取得免費試用金鑰
      window.open(LINE_OFFICIAL_ACCOUNT, '_blank');
    } else {
      // 導向年繳購買頁
      window.open('https://portaly.cc/GinRollBT', '_blank');
    }
  };

  const MarketTicker = () => {
    const [seconds, setSeconds] = useState(228);
    useEffect(() => {
      const timer = setInterval(() => {
        setSeconds(prev => (prev <= 1 ? 228 : prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }, []);

    const formatTime = (s) => {
      const m = Math.floor(s / 60);
      const rs = s % 60;
      return `${m} 分 ${rs < 10 ? '0' : ''}${rs} 秒`;
    };

    return (
      <div className="bg-red-600 text-white py-2 overflow-hidden whitespace-nowrap relative z-50 shadow-lg">
        <div className="flex animate-marquee items-center gap-12 font-black text-[10px] md:text-xs uppercase tracking-widest">
          <span className="flex items-center gap-2"><Clock size={14}/> 2026 癌症時鐘倒數：{formatTime(seconds)}</span>
          <span className="flex items-center gap-2"><TriangleAlert size={14}/> 2026 預估醫療通膨：+15.8%</span>
          <span className="flex items-center gap-2"><TrendingUp size={14}/> 實質體感通膨：4.5% 起</span>
          <span className="flex items-center gap-2"><ShieldAlert size={14}/> 勞保破產倒數：2031 臨界點</span>
          <span className="flex items-center gap-2"><Clock size={14}/> 2026 癌症時鐘倒數：{formatTime(seconds)}</span>
          <span className="flex items-center gap-2"><TriangleAlert size={14}/> 2026 預估醫療通膨：+15.8%</span>
        </div>
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-marquee {
            display: inline-flex;
            animation: marquee 30s linear infinite;
          }
        `}</style>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#050b14] text-white font-sans">
      
      <MarketTicker />

      {/* ✅ Header（修正 Logo 顏色 + 加入登入按鈕）*/}
      <header className="sticky top-0 z-40 bg-[#050b14]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
<div className="flex items-center gap-3 cursor-pointer relative" 
     onClick={handleLogoClick}
     title={clickCount > 0 ? `再点 ${5 - clickCount} 5入管理后台` : ''}>            <img 
              src={logoError ? "https://placehold.co/40x40/3b82f6/white?text=UA" : LOGO_URL}
              alt="Ultra Advisor"
              className="h-10 w-auto"
              onError={() => setLogoError(true)}
            />
<span className="text-xl font-black tracking-tight">
              <span style={{color: '#FF3A3A'}}>Ultra</span>
              <span className="text-blue-400">Advisor</span>
            </span>
            
            {/* ✅ 点击进度指示器 */}
            {clickCount > 0 && (
              <div className="absolute -bottom-1 left-0 right-0 h-1 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${(clickCount / 5) * 100}%` }}
                />
              </div>
            )}
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <button 
              onClick={() => {
                document.getElementById('products')?.scrollIntoView({behavior: 'smooth'});
              }}
              className="text-slate-400 hover:text-blue-400 font-bold transition-colors">
              產品展示
            </button>
            <button 
              onClick={() => {
                document.getElementById('pricing')?.scrollIntoView({behavior: 'smooth'});
              }}
              className="text-slate-400 hover:text-blue-400 font-bold transition-colors">
              定價
            </button>
            <a href={COMMUNITY_LINK} target="_blank" rel="noopener noreferrer" 
               className="text-slate-400 hover:text-blue-400 font-bold transition-colors">
              社群
            </a>
            
            {/* ✅ 加入登入按鈕 */}
            <button 
              onClick={onStart}
              className="flex items-center gap-2 text-slate-400 hover:text-white font-bold transition-colors">
              <LogIn size={18} />
              登入系統
            </button>
            
            <button 
              onClick={handleFreeTrial}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold 
                       transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              免費試用
            </button>
          </nav>

          {/* ✅ 手機版按鈕 */}
          <div className="md:hidden flex items-center gap-3">
            <button 
              onClick={onStart}
              className="text-slate-400 hover:text-white font-bold text-sm">
              登入
            </button>
            <button 
              onClick={handleFreeTrial}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-sm
                       transition-all">
              試用
            </button>
          </div>
        </div>
      </header>

      <main>
        <OptimizedHeroSection 
          onFreeTrial={handleFreeTrial}
          onWatchDemo={handleWatchDemo}
        />

        <ProductShowcase />
        <RealSocialProof />
        <RealTestimonials />
        <PricingSection onSelectPlan={handleSelectPlan} />

        <section className="py-32 bg-gradient-to-b from-slate-950 to-blue-950/20">
          <div className="max-w-4xl mx-auto text-center px-6">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-8 leading-tight">
              準備好升級你的
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                顧問武器庫
              </span>
              了嗎？
            </h2>
            <p className="text-slate-400 text-xl mb-12">
              加入 20+ 位菁英顧問行列，開始你的 7 天免費試用
            </p>
            <button 
              onClick={handleFreeTrial}
              className="px-12 py-6 bg-gradient-to-r from-blue-600 to-blue-500 
                       text-white rounded-2xl font-black text-xl 
                       shadow-[0_0_50px_rgba(59,130,246,0.5)]
                       hover:shadow-[0_0_80px_rgba(59,130,246,0.7)] 
                       transition-all hover:-translate-y-2 inline-flex items-center gap-3">
              <Sparkles size={28} />
              立即獲取 Ultra888 金鑰
              <ArrowRight size={24} />
            </button>
            <p className="text-slate-500 text-sm mt-6">
              ✓ 7 天免費 ✓ 不需信用卡 ✓ 隨時可取消
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 border-t border-white/5 py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-slate-600 text-sm font-bold">
            © 2026 UltraAdvisor. 讓數據為你說話，讓 AI 當你的軍師。
          </p>
        </div>
      </footer>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}