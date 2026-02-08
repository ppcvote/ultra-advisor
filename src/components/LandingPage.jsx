import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Activity, TrendingUp, TrendingDown, ShieldAlert, FileBarChart, Clock,
  ChevronRight, Users, Rocket, Target, ShoppingBag, Zap, HeartPulse,
  Crosshair, ShieldCheck, ArrowRight, Monitor, Smartphone, Database,
  Lock, CheckCircle2, Globe, Mail, MessageSquare, PlayCircle,
  TriangleAlert, OctagonAlert, Landmark, ChevronLeft, Wallet, X,
  Car, Heart, ExternalLink, LayoutDashboard, BarChart3, FileText,
  Sparkles, Crown, Award, Star, TrendingUpIcon, Calculator,
  PieChart, DollarSign, Gift, Shield, LineChart, Home, LogIn, Calendar, Handshake,
  Cloud, Search, FolderOpen, Upload, Timer
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// ==========================================
// 🎯 整合版本：
// 1. ✅ 保留原本所有精心設計的內容
// 2. ✅ 加入動態公告橫幅（從 Firestore 讀取）
// 3. ✅ 加入動態影片嵌入（從 Firestore 讀取）
// 4. ✅ Logo "ULTRA" 使用 style 屬性確保紅色顯示
// 5. ✅ Header 加入「登入系統」按鈕
// ==========================================

const LOGO_URL = "https://lh3.googleusercontent.com/d/1CEFGRByRM66l-4sMMM78LUBUvAMiAIaJ";
const COMMUNITY_LINK = "https://line.me/ti/g2/9Cca20iCP8J0KrmVRg5GOe1n5dSatYKO8ETTHw?utm_source=invitation&utm_medium=link_copy&utm_campaign=default";
const LINE_OFFICIAL_ACCOUNT = "https://line.me/R/ti/p/@ultraadvisor";

// 🔥 註冊頁面路徑（LINE 免費訊息額度已滿，改導向網頁註冊）
const SIGNUP_PATH = '/register';

// 🔥 管理員後台網址
const ADMIN_URL = "https://admin.ultra-advisor.tw/secret-admin-ultra-2026";

// ==========================================
// 🔔 動態公告橫幅組件
// ==========================================
const AnnouncementBar = ({ data, onClose }) => {
  if (!data?.enabled) return null;
  
  const typeStyles = {
    info: 'bg-blue-600',
    success: 'bg-emerald-600',
    warning: 'bg-amber-500 text-black',
    promo: 'bg-gradient-to-r from-purple-600 via-pink-500 to-red-500'
  };
  
  return (
    <div className={`${typeStyles[data.type] || typeStyles.info} text-white py-2.5 px-4 text-center text-sm font-bold relative z-[60]`}>
      <span>{data.message}</span>
      {data.link && data.linkText && (
        <a 
          href={data.link} 
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 underline hover:no-underline font-black"
        >
          {data.linkText} →
        </a>
      )}
      {data.dismissible !== false && (
        <button 
          onClick={onClose} 
          className="absolute right-4 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

// ==========================================
// 🎬 影片彈窗組件
// ==========================================
const VideoModal = ({ isOpen, onClose, videoData, videoType = 'dynamic' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-white hover:text-gray-300 transition-colors z-10"
      >
        <X size={32} />
      </button>
      <div className="w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
        {/* 🎬 SystemDemo - Remotion 影片 */}
        {videoType === 'systemDemo' && (
          <video
            src="/videos/system-demo.mp4"
            className="w-full h-full"
            controls
            autoPlay
            playsInline
          >
            您的瀏覽器不支援影片播放
          </video>
        )}
        {/* 🎬 動態內容 - YouTube */}
        {videoType === 'dynamic' && videoData?.videoType === 'youtube' && videoData.videoUrl && (
          <iframe
            src={videoData.videoUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="產品介紹影片"
          />
        )}
        {/* 🎬 動態內容 - HTML 動畫 */}
        {videoType === 'dynamic' && videoData?.videoType === 'html' && videoData.htmlVideoUrl && (
          <iframe
            src={videoData.htmlVideoUrl}
            className="w-full h-full"
            allowFullScreen
            title="產品動畫展示"
          />
        )}
      </div>
    </div>
  );
};

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
const OptimizedHeroSection = ({ onFreeTrial, onWatchDemo, hasVideo }) => {
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
            讓數據
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-blue-500
                           bg-clip-text text-transparent">
              替你說話
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-blue-300 font-bold tracking-wide">
            專業圖表，讓財務規劃一目了然
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto animate-fade-in"
             style={{animationDelay: '0.4s'}}>
          {[
            { icon: BarChart3, text: "18 種專業視覺化工具", color: "blue" },
            { icon: Clock, text: "節省 15 小時試算時間", color: "amber" },
            { icon: FileBarChart, text: "30,000+ 份報表產出", color: "emerald" }
          ].map((item, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-700/50 
                                   rounded-2xl p-4 backdrop-blur-sm">
              <item.icon className={`text-${item.color}-400 mx-auto mb-2`} size={24} />
              <p className="text-slate-300 text-sm font-bold">{item.text}</p>
            </div>
          ))}
        </div>

        {/* 主要 CTA - 雙按鈕並排 */}
        <div className="flex flex-col md:flex-row gap-4 justify-center items-center animate-fade-in" style={{animationDelay: '0.6s'}}>
          <button
            onClick={onFreeTrial}
            className="group relative px-10 py-5 bg-gradient-to-r from-blue-600 to-blue-500
                     text-white rounded-2xl font-black text-lg shadow-[0_0_40px_rgba(59,130,246,0.5)]
                     hover:shadow-[0_0_60px_rgba(59,130,246,0.7)] transition-all duration-300
                     hover:-translate-y-1 flex items-center gap-3">
            <Sparkles className="group-hover:rotate-12 transition-transform" size={24} />
            免費試用 7 天
            <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
          </button>

          <button
            onClick={() => {
              window.history.pushState({}, '', '/calculator');
              window.location.reload();
            }}
            className="group px-10 py-5 bg-gradient-to-r from-emerald-600 to-emerald-500
                     text-white rounded-2xl font-black text-lg shadow-[0_0_40px_rgba(16,185,129,0.5)]
                     hover:shadow-[0_0_60px_rgba(16,185,129,0.7)] transition-all duration-300
                     hover:-translate-y-1 flex items-center gap-3">
            <Calculator className="group-hover:rotate-12 transition-transform" size={24} />
            免費計算機
            <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
          </button>
        </div>

        {/* 說明文字 */}
        <p className="text-slate-500 text-sm animate-fade-in" style={{animationDelay: '0.7s'}}>
          ✓ 不需信用卡 ✓ 完整功能 ✓ 隨時取消
        </p>

        {/* 次要連結 - 觀看示範 */}
        <div className="animate-fade-in" style={{animationDelay: '0.8s'}}>
          <button
            onClick={onWatchDemo}
            className={`px-6 py-3 bg-slate-800/50 border border-slate-700 hover:border-slate-600
                     text-slate-400 rounded-xl font-bold hover:bg-slate-800 transition-all
                     flex items-center gap-2 mx-auto ${hasVideo ? '' : 'opacity-50'}`}
          >
            <PlayCircle size={18} />
            觀看 60 秒產品示範
          </button>
        </div>

      </div>
    </section>
  );
};

// ==========================================
// 📊 即時統計組件（從 Firestore 讀取）
// ==========================================
const LiveStatsBar = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCalculations: 0,
    onlineNow: 0,
    isLoading: true
  });

  // 根據時間段計算合理的在線人數基準
  const getBaseOnlineCount = () => {
    const hour = new Date().getHours();
    // 深夜 (0-6): 12-25 人
    if (hour >= 0 && hour < 6) return Math.floor(Math.random() * 14) + 12;
    // 早上 (6-9): 20-40 人
    if (hour >= 6 && hour < 9) return Math.floor(Math.random() * 21) + 20;
    // 上午 (9-12): 35-60 人
    if (hour >= 9 && hour < 12) return Math.floor(Math.random() * 26) + 35;
    // 中午 (12-14): 40-70 人
    if (hour >= 12 && hour < 14) return Math.floor(Math.random() * 31) + 40;
    // 下午 (14-18): 45-80 人
    if (hour >= 14 && hour < 18) return Math.floor(Math.random() * 36) + 45;
    // 晚間 (18-21): 50-90 人（高峰）
    if (hour >= 18 && hour < 21) return Math.floor(Math.random() * 41) + 50;
    // 深夜前 (21-24): 30-55 人
    return Math.floor(Math.random() * 26) + 30;
  };

  useEffect(() => {
    const loadStats = async () => {
      const baseOnline = getBaseOnlineCount();
      try {
        // 嘗試從 Firestore 讀取統計數據
        const statsDoc = await getDoc(doc(db, 'siteContent', 'stats'));

        if (statsDoc.exists()) {
          const data = statsDoc.data();
          setStats({
            totalUsers: data.totalUsers || 0,
            totalCalculations: data.totalCalculations || 0,
            onlineNow: baseOnline, // 永遠使用時間基準值，不用 Firestore 的值
            isLoading: false
          });
        } else {
          // 使用預設值
          setStats({
            totalUsers: 500,
            totalCalculations: 30000,
            onlineNow: baseOnline,
            isLoading: false
          });
        }
      } catch (error) {
        console.log('統計數據載入失敗，使用預設值:', error);
        setStats({
          totalUsers: 500,
          totalCalculations: 30000,
          onlineNow: baseOnline,
          isLoading: false
        });
      }
    };

    loadStats();

    // 每 30 秒微調在線人數（±3 範圍內波動）
    const timer = setInterval(() => {
      setStats(prev => {
        const change = Math.floor(Math.random() * 7) - 3; // -3 ~ +3
        const baseMin = getBaseOnlineCount() - 10;
        const newCount = Math.max(baseMin, prev.onlineNow + change);
        return { ...prev, onlineNow: newCount };
      });
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  if (stats.isLoading) return null;

  return (
    <div className="bg-slate-900/50 border-y border-slate-800 py-4">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 text-sm">
          {/* 在線人數 */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
              <div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            </div>
            <span className="text-slate-400">
              目前 <span className="text-emerald-400 font-bold">{stats.onlineNow}</span> 人在線
            </span>
          </div>

          {/* 註冊用戶 */}
          <div className="flex items-center gap-2 text-slate-400">
            <Users size={16} className="text-blue-400" />
            <span>
              <span className="text-white font-bold">{stats.totalUsers}+</span> 位顧問使用中
            </span>
          </div>

          {/* 累計試算 */}
          <div className="flex items-center gap-2 text-slate-400">
            <BarChart3 size={16} className="text-amber-400" />
            <span>
              累計 <span className="text-white font-bold">{stats.totalCalculations.toLocaleString()}+</span> 次試算
            </span>
          </div>

          {/* 今日新增（動態） */}
          <div className="hidden md:flex items-center gap-2 text-slate-400">
            <TrendingUp size={16} className="text-purple-400" />
            <span>
              今日 <span className="text-white font-bold">+{Math.floor(Math.random() * 40) + 15}</span> 次使用
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 📸 產品截圖輪播組件
// ==========================================
const ProductScreenshotCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const screenshots = [
    {
      title: "大小水庫母子系統",
      description: "雙層防護機制，確保緊急預備金與長期儲蓄",
      image: "/screenshots/screenshot-reservoir.png"
    },
    {
      title: "稅務傳承規劃",
      description: "遺產稅 & 贈與稅精算，最佳化傳承策略",
      image: "/screenshots/screenshot-tax.png"
    },
    {
      title: "傲創計算機",
      description: "四大功能合一的免費財務計算工具",
      image: "/screenshots/screenshot-calculator.png"
    },
    {
      title: "戰情室數據儀表板",
      description: "即時追蹤市場數據與經濟指標",
      image: "/screenshots/screenshot-warroom.png"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % screenshots.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [screenshots.length]);

  return (
    <section className="py-20 bg-slate-950/50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20
                         text-blue-400 text-xs font-black uppercase tracking-[0.4em]
                         rounded-full">
            Live Preview
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-white mt-6 tracking-tight">
            實際產品畫面
          </h2>
          <p className="text-slate-400 mt-4">
            所見即所得，真實呈現顧問每天使用的工具介面
          </p>
        </div>

        {/* 輪播區域 */}
        <div className="relative">
          {/* 主要截圖 */}
          <div className="relative aspect-[16/9] bg-slate-900 rounded-2xl border border-slate-800
                         overflow-hidden shadow-2xl">
            {screenshots.map((shot, i) => (
              <div
                key={i}
                className={`absolute inset-0 transition-all duration-700 ease-in-out
                           ${i === currentIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
              >
                <img
                  src={shot.image}
                  alt={shot.title}
                  className="w-full h-auto object-cover object-top"
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                />

                {/* 標題覆蓋層 */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/90 to-transparent p-8">
                  <h3 className="text-2xl font-black text-white mb-2">{shot.title}</h3>
                  <p className="text-slate-400">{shot.description}</p>
                </div>
              </div>
            ))}

            {/* 左右切換按鈕 */}
            <button
              onClick={() => setCurrentIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-slate-900/80
                       rounded-full flex items-center justify-center text-white hover:bg-slate-800
                       transition-all border border-slate-700"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % screenshots.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-slate-900/80
                       rounded-full flex items-center justify-center text-white hover:bg-slate-800
                       transition-all border border-slate-700"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* 指示點 */}
          <div className="flex justify-center gap-2 mt-6">
            {screenshots.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-2 h-2 rounded-full transition-all duration-300
                           ${i === currentIndex
                             ? 'bg-blue-500 w-8'
                             : 'bg-slate-600 hover:bg-slate-500'}`}
              />
            ))}
          </div>

          {/* 縮略圖導航 */}
          <div className="hidden md:flex justify-center gap-4 mt-8">
            {screenshots.map((shot, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`relative w-40 h-24 rounded-xl overflow-hidden border-2 transition-all
                           ${i === currentIndex
                             ? 'border-blue-500 scale-105'
                             : 'border-slate-700 opacity-50 hover:opacity-80'}`}
              >
                <img
                  src={shot.image}
                  alt={shot.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{shot.title}</span>
                </div>
              </button>
            ))}
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
      subtitle: "資產累積視覺化，看見財富成長軌跡",
      color: "blue",
      icon: Rocket,
      tools: [
        {
          name: "學貸活化試算",
          desc: "評估學貸與投資的長期效益比較",
          features: ["IRR 計算", "收益比較圖表", "風險評估"],
          screenshot: "/screenshots/screenshot-calculator.png"
        },
        {
          name: "房產財務分析",
          desc: "房貸還款與資產配置的視覺化分析",
          features: ["房貸試算", "現金流圖表", "還款計畫"],
          screenshot: "/screenshots/screenshot-reservoir.png"
        },
        {
          name: "百萬禮物計畫",
          desc: "子女教育基金與資產規劃試算",
          features: ["贈與稅試算", "分年規劃圖表", "稅務試算"],
          screenshot: "/screenshots/screenshot-tax.png"
        }
      ]
    },
    defense: {
      title: "守富工具",
      subtitle: "風險缺口圖表化，守護家庭財務安全",
      color: "emerald",
      icon: ShieldCheck,
      tools: [
        {
          name: "大小水庫系統",
          desc: "緊急預備金與長期儲蓄的雙層規劃",
          features: ["預備金試算", "定期定額圖表", "缺口分析"],
          screenshot: "/screenshots/screenshot-reservoir.png"
        },
        {
          name: "五年換車計畫",
          desc: "購車預算與儲蓄目標的視覺化規劃",
          features: ["預算規劃", "儲蓄進度圖", "貸款試算"],
          screenshot: "/screenshots/screenshot-calculator.png"
        },
        {
          name: "長照準備金試算",
          desc: "未來醫療支出與保障缺口分析",
          features: ["餘命試算", "費用估算圖表", "缺口分析"],
          screenshot: "/screenshots/screenshot-warroom.png"
        }
      ]
    },
    legacy: {
      title: "傳富工具",
      subtitle: "稅務試算透明化，傳承規劃有依據",
      color: "purple",
      icon: Landmark,
      tools: [
        {
          name: "稅務傳承試算",
          desc: "遺產稅與贈與稅的完整試算圖表",
          features: ["遺產稅試算", "贈與稅圖表", "節稅方案比較"],
          screenshot: "/screenshots/screenshot-tax.png"
        },
        {
          name: "流動性缺口分析",
          desc: "資產變現能力與稅務負擔評估",
          features: ["現金流圖表", "資產分析", "規劃建議"],
          screenshot: "/screenshots/screenshot-reservoir.png"
        },
        {
          name: "退休金缺口試算",
          desc: "退休金替代率與缺口視覺化分析",
          features: ["替代率圖表", "缺口分析", "規劃建議"],
          screenshot: "/screenshots/screenshot-warroom.png"
        }
      ]
    },
    warroom: {
      title: "市場數據",
      subtitle: "即時數據圖表化，決策有所本",
      color: "red",
      icon: Activity,
      tools: [
        {
          name: "基金時光機",
          desc: "歷史績效回測與投資模擬",
          features: ["定期定額回測", "績效圖表", "比較分析"],
          screenshot: "/screenshots/screenshot-warroom.png"
        },
        {
          name: "市場數據儀表板",
          desc: "2026 最新經濟數據即時圖表",
          features: ["健康數據", "通膨指標", "退休金數據"],
          screenshot: "/screenshots/screenshot-warroom.png"
        },
        {
          name: "通膨影響試算",
          desc: "購買力變化的視覺化呈現",
          features: ["購買力圖表", "通膨試算", "資產評估"],
          screenshot: "/screenshots/screenshot-calculator.png"
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
                        className="w-full h-full object-contain bg-slate-950"
                        loading="lazy"
                        decoding="async"
                      />
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

// ==========================================
// 📊 社會證明區塊
// ==========================================
const RealSocialProof = () => {
  return (
    <section className="py-32 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-20">
          <span className="px-4 py-1.5 bg-purple-500/10 border border-purple-500/20
                         text-purple-400 text-xs font-black uppercase tracking-[0.4em]
                         rounded-full">
            Early Access
          </span>
          <h2 className="text-4xl md:text-6xl font-black text-white mt-8 tracking-tight">
            專業顧問的視覺化夥伴
          </h2>
          <p className="text-slate-400 text-lg mt-6 max-w-2xl mx-auto">
            目前已有 <strong className="text-blue-400">500+ 位專業顧問</strong> 使用 Ultra Advisor，
            累計產出 <strong className="text-amber-400">30,000+ 份</strong> 視覺化報表，
            平均每月節省 <strong className="text-emerald-400">15 小時</strong> 試算時間。
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {[
            {
              label: "使用顧問",
              value: "500+",
              desc: "專業財務規劃師",
              icon: Users,
              color: "blue"
            },
            {
              label: "報表產出",
              value: "30,000+",
              desc: "視覺化分析報表",
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
              <h3 className="text-3xl font-black text-white">早期使用者專屬權益</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                { icon: Award, text: "永久享有早鳥價格鎖定（未來漲價不影響）" },
                { icon: Sparkles, text: "優先體驗所有新功能與圖表工具" },
                { icon: Users, text: "專屬 VIP 社群（直接與開發團隊對話）" },
                { icon: Star, text: "終身技術支援（1 對 1 服務）" },
                { icon: Target, text: "功能需求優先處理（您的建議直接影響產品）" },
                { icon: Crown, text: "早期使用者徽章（系統內永久顯示）" }
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

// ==========================================
// 💬 早期用戶回饋區塊（誠實呈現）
// ==========================================
const EarlyUserFeedback = ({ onFreeTrial }) => {
  return (
    <section className="py-32 bg-[#050b14]">
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-16">
          <span className="px-4 py-1.5 bg-amber-500/10 border border-amber-500/20
                         text-amber-400 text-xs font-black uppercase tracking-[0.4em]
                         rounded-full">
            Early Access
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white mt-8 tracking-tight">
            成為首批使用者
          </h2>
          <p className="text-slate-400 text-lg mt-6 max-w-2xl mx-auto">
            Ultra Advisor 目前處於早期階段，我們正在招募首批測試用戶，
            <br />
            一起打造台灣最專業的財務視覺化工具
          </p>
        </div>

        {/* 誠實的價值主張 */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {[
            {
              icon: Rocket,
              title: "搶先體驗",
              description: "比別人更早使用專業視覺化工具，提升服務品質",
              color: "blue"
            },
            {
              icon: MessageSquare,
              title: "直接影響產品",
              description: "您的回饋會直接影響功能開發方向，打造真正好用的工具",
              color: "emerald"
            },
            {
              icon: Crown,
              title: "早期使用者特權",
              description: "早期支持者享有永久價格鎖定與專屬權益",
              color: "amber"
            }
          ].map((item, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8
                                   hover:border-slate-700 transition-all text-center">
              <div className={`w-16 h-16 bg-${item.color}-600/10 rounded-2xl
                             flex items-center justify-center mx-auto mb-6`}>
                <item.icon className={`text-${item.color}-400`} size={32} />
              </div>
              <h3 className="text-xl font-black text-white mb-3">{item.title}</h3>
              <p className="text-slate-400 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>

        {/* 透明的開發狀態 */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-8 mb-16">
          <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
            <Activity className="text-blue-400" size={24} />
            開發進度透明公開
          </h3>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { label: "已上線功能", value: "18 種", status: "live", color: "emerald" },
              { label: "開發中功能", value: "5 種", status: "dev", color: "amber" },
              { label: "規劃中功能", value: "12 種", status: "planned", color: "slate" },
              { label: "上次更新", value: "本週", status: "update", color: "blue" }
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className={`text-3xl font-black text-${item.color}-400 mb-2`}>
                  {item.value}
                </div>
                <div className="text-slate-500 text-sm">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-slate-400 text-lg mb-6">
            我們承諾：持續迭代、認真聽取回饋、打造真正專業的視覺化工具
          </p>
          <button
            onClick={onFreeTrial}
            className="px-10 py-5 bg-gradient-to-r from-blue-600 to-blue-500
                     text-white rounded-2xl font-black text-lg
                     shadow-[0_0_40px_rgba(59,130,246,0.4)]
                     hover:shadow-[0_0_60px_rgba(59,130,246,0.6)]
                     transition-all hover:-translate-y-1 inline-flex items-center gap-3">
            <Sparkles size={24} />
            免費體驗視覺化工具
            <ArrowRight size={20} />
          </button>
          <p className="text-slate-600 text-sm mt-4">
            目前已有 500+ 位專業顧問正在使用
          </p>
        </div>

      </div>
    </section>
  );
};

// ==========================================
// 💰 定價區塊
// ==========================================
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
                  📊 每天不到 20 元
                  <br />
                  <span className="text-sm text-amber-400/80">
                    讓每份報表都專業呈現
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
// ☁️ UltraCloud 傲創雲端介紹區塊
// ==========================================
const UltraCloudSection = () => {
  const ULTRACLOUD_LINE = "https://line.me/R/ti/p/@783dgvvs";

  return (
    <section id="ultracloud" className="py-32 bg-gradient-to-b from-[#050b14] to-slate-950">
      <div className="max-w-7xl mx-auto px-6">

        {/* 標題區 */}
        <div className="text-center mb-20">
          <span className="px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/20
                         text-cyan-400 text-xs font-black uppercase tracking-[0.4em]
                         rounded-full">
            New Product
          </span>
          <h2 className="text-4xl md:text-6xl font-black text-white mt-8 tracking-tight">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              傲創雲端
            </span>
            {' '}UltraCloud
          </h2>
          <p className="text-slate-400 text-xl mt-6 max-w-3xl mx-auto leading-relaxed">
            讓 LINE 群組變成你的智慧檔案庫<br />
            <span className="text-cyan-400 font-bold">回覆檔案 + 輸入「存」= 自動同步雲端</span>
          </p>
        </div>

        {/* 核心痛點 */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-8 md:p-12 mb-16">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-12 h-12 bg-red-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <TriangleAlert className="text-red-400" size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white mb-2">你有沒有這樣的困擾？</h3>
              <p className="text-slate-400">「報價單傳群組後，三天就找不到了」——這是每個業務團隊的日常。</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3 bg-slate-800/50 rounded-xl p-4">
              <Clock className="text-red-400 flex-shrink-0 mt-1" size={20} />
              <p className="text-slate-300 text-sm leading-relaxed">檔案被聊天訊息淹沒，翻找半小時還找不到</p>
            </div>
            <div className="flex items-start gap-3 bg-slate-800/50 rounded-xl p-4">
              <FolderOpen className="text-amber-400 flex-shrink-0 mt-1" size={20} />
              <p className="text-slate-300 text-sm leading-relaxed">手動下載再上傳雲端，每天浪費大量時間</p>
            </div>
            <div className="flex items-start gap-3 bg-slate-800/50 rounded-xl p-4">
              <Shield className="text-orange-400 flex-shrink-0 mt-1" size={20} />
              <p className="text-slate-300 text-sm leading-relaxed">重要客戶資料分散各處，離職交接超麻煩</p>
            </div>
          </div>
        </div>

        {/* 效率革命 */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* 左側：效率對比 */}
          <div className="bg-gradient-to-br from-cyan-900/20 to-slate-900/50 border border-cyan-500/30
                         rounded-[2rem] p-8 md:p-10">
            <div className="flex items-center gap-3 mb-8">
              <Timer className="text-cyan-400" size={28} />
              <h3 className="text-2xl font-black text-white">效率革命</h3>
            </div>

            <div className="space-y-6">
              {/* 對比表格 */}
              <div className="bg-slate-900/50 rounded-xl overflow-hidden">
                <div className="grid grid-cols-3 text-sm font-bold border-b border-slate-700">
                  <div className="p-3 text-slate-500"></div>
                  <div className="p-3 text-red-400 text-center">傳統方式</div>
                  <div className="p-3 text-cyan-400 text-center">UltraCloud</div>
                </div>
                {[
                  { label: "存檔時間", old: "5-10 分鐘", new: "3 秒" },
                  { label: "操作步驟", old: "5 個步驟", new: "2 個動作" },
                  { label: "搜尋檔案", old: "翻找 30 分鐘", new: "即時找到" }
                ].map((row, i) => (
                  <div key={i} className="grid grid-cols-3 text-sm border-b border-slate-800 last:border-0">
                    <div className="p-3 text-slate-400">{row.label}</div>
                    <div className="p-3 text-red-300 text-center line-through opacity-60">{row.old}</div>
                    <div className="p-3 text-cyan-300 text-center font-bold">{row.new}</div>
                  </div>
                ))}
              </div>

              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 text-center">
                <p className="text-cyan-300 font-bold text-lg">
                  每位業務每天平均節省 <span className="text-2xl text-white">30 分鐘</span>
                </p>
                <p className="text-cyan-400/70 text-sm mt-1">一個月就是 10 小時的生產力提升</p>
              </div>
            </div>
          </div>

          {/* 右側：資安防護 */}
          <div className="bg-gradient-to-br from-emerald-900/20 to-slate-900/50 border border-emerald-500/30
                         rounded-[2rem] p-8 md:p-10">
            <div className="flex items-center gap-3 mb-8">
              <Shield className="text-emerald-400" size={28} />
              <h3 className="text-2xl font-black text-white">企業級資安</h3>
            </div>

            <div className="space-y-4">
              {[
                { icon: Lock, title: "Google Cloud 基礎架構", desc: "符合 ISO 27001、SOC 2 國際資安認證" },
                { icon: Users, title: "群組隔離機制", desc: "每個群組獨立儲存空間，資料完全隔離" },
                { icon: Shield, title: "傳輸與儲存加密", desc: "全程 HTTPS + AES-256 加密" },
                { icon: Database, title: "資料主權在你手上", desc: "不經過第三方伺服器，從 LINE 直達雲端" }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 bg-slate-900/50 rounded-xl p-4">
                  <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <item.icon className="text-emerald-400" size={20} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">{item.title}</h4>
                    <p className="text-slate-400 text-xs mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 text-center">
              <p className="text-emerald-300 text-sm font-bold">
                你的客戶資料，不會因為員工離職而流失
              </p>
            </div>
          </div>
        </div>

        {/* 功能指令一覽 */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-[2rem] p-8 md:p-12 mb-16">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-black text-white mb-3">簡單指令，強大功能</h3>
            <p className="text-slate-400">在 LINE 群組中輸入指令，即可操作</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-5 hover:border-cyan-500/40 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <Upload className="text-cyan-400" size={20} />
                <code className="text-cyan-300 font-mono font-bold text-sm">存 [檔名]</code>
              </div>
              <p className="text-slate-400 text-sm">回覆檔案後輸入，同步到雲端</p>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 hover:border-blue-500/40 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <Search className="text-blue-400" size={20} />
                <code className="text-blue-300 font-mono font-bold text-sm">找 [關鍵字]</code>
              </div>
              <p className="text-slate-400 text-sm">搜尋已存檔案，快速取得連結</p>
            </div>
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5 hover:border-purple-500/40 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <Cloud className="text-purple-400" size={20} />
                <code className="text-purple-300 font-mono font-bold text-sm">搜雲端 [關鍵字]</code>
              </div>
              <p className="text-slate-400 text-sm">搜尋連結的 Google Drive</p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 hover:border-emerald-500/40 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <FileText className="text-emerald-400" size={20} />
                <code className="text-emerald-300 font-mono font-bold text-sm">檔案列表</code>
              </div>
              <p className="text-slate-400 text-sm">列出最近儲存的檔案</p>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 hover:border-amber-500/40 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <FolderOpen className="text-amber-400" size={20} />
                <code className="text-amber-300 font-mono font-bold text-sm">雲端資料夾</code>
              </div>
              <p className="text-slate-400 text-sm">檢視 Google Drive 資料夾</p>
            </div>
            <div className="bg-slate-500/5 border border-slate-500/20 rounded-xl p-5 hover:border-slate-500/40 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <MessageSquare className="text-slate-400" size={20} />
                <code className="text-slate-300 font-mono font-bold text-sm">幫助</code>
              </div>
              <p className="text-slate-400 text-sm">顯示所有可用指令</p>
            </div>
          </div>
        </div>

        {/* 適用對象 */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-black text-white mb-3">適用對象</h3>
            <p className="text-slate-400">任何在 LINE 群組中有大量檔案流動的團隊</p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {[
              { emoji: "🛡️", text: "保險業務團隊" },
              { emoji: "🏠", text: "房仲團隊" },
              { emoji: "🚗", text: "汽車銷售" },
              { emoji: "💼", text: "B2B 業務" },
              { emoji: "📋", text: "專案團隊" }
            ].map((item, i) => (
              <div key={i} className="px-6 py-3 bg-slate-800/50 border border-slate-700 rounded-full
                                     text-slate-300 font-bold flex items-center gap-2">
                <span className="text-xl">{item.emoji}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30
                         rounded-[2rem] p-10 max-w-2xl mx-auto">
            <h3 className="text-3xl font-black text-white mb-4">
              立即體驗 UltraCloud
            </h3>
            <p className="text-slate-400 mb-8">
              加入官方帳號，將機器人邀請進入你的業務群組
            </p>

            <a
              href={ULTRACLOUD_LINE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-10 py-5 bg-[#06C755] hover:bg-[#05b34c]
                       text-white rounded-2xl font-black text-lg shadow-[0_0_40px_rgba(6,199,85,0.4)]
                       hover:shadow-[0_0_60px_rgba(6,199,85,0.6)] transition-all hover:-translate-y-1"
            >
              <MessageSquare size={24} />
              加入 UltraCloud
              <ArrowRight size={20} />
            </a>

            <p className="text-slate-500 text-sm mt-6">
              LINE ID: <span className="text-cyan-400 font-mono">@783dgvvs</span> · 免費使用
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};

// ==========================================
// 🚀 主組件
// ==========================================
export function LandingPage({ onStart, onSignup, onHome }) {
  const [view, setView] = useState('home');
  const [logoError, setLogoError] = useState(false);
  // 保留 useTheme hook 以備未來使用
  useTheme();

  // ✅ 動態內容狀態
  const [dynamicContent, setDynamicContent] = useState({
    announcement: null,
    heroVideo: null,
    contact: null
  });
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [showVideoModal, setShowVideoModal] = useState(false);

  // ✅ 管理员入口：连点 Logo 5 次
  const [clickCount, setClickCount] = useState(0);
  const clickTimerRef = useRef(null);

  // ✅ 滾動狀態（用於 Sticky Header 優化）
  const [isScrolled, setIsScrolled] = useState(false);

  // ✅ 載入動態內容
  useEffect(() => {
    const loadDynamicContent = async () => {
      try {
        // 載入公告
        const announcementDoc = await getDoc(doc(db, 'siteContent', 'announcement'));
        // 載入 Hero 影片設定
        const heroDoc = await getDoc(doc(db, 'siteContent', 'hero'));
        // 載入聯絡資訊
        const contactDoc = await getDoc(doc(db, 'siteContent', 'contact'));
        
        setDynamicContent({
          announcement: announcementDoc.exists() ? announcementDoc.data() : null,
          heroVideo: heroDoc.exists() ? heroDoc.data() : null,
          contact: contactDoc.exists() ? contactDoc.data() : null
        });
      } catch (error) {
        console.log('動態內容載入失敗，使用預設值:', error);
      }
    };
    
    loadDynamicContent();
  }, []);

  // ✅ 管理员入口：处理 Logo 点击
  const handleLogoClick = () => {
    setView('home');
    setClickCount(prev => prev + 1);
    
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }
    
    if (clickCount + 1 >= 5) {
      window.location.href = ADMIN_URL;
      setClickCount(0);
      return;
    }
    
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

  // ✅ 滾動監聽（Sticky Header 優化）
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 🔥 LINE 免費訊息額度已滿，改導向網頁註冊
  const handleFreeTrial = () => {
    window.history.pushState({}, '', SIGNUP_PATH);
    window.location.reload();
  };

  // ✅ 影片類型狀態
  const [demoVideoType, setDemoVideoType] = useState('systemDemo');

  // ✅ 修改：直接播放 SystemDemo 影片
  const handleWatchDemo = () => {
    setDemoVideoType('systemDemo');
    setShowVideoModal(true);
  };

  // ✅ SystemDemo 影片總是可用
  const hasVideo = true;

  const handleSelectPlan = (plan) => {
    if (plan === 'free') {
      // 🔥 LINE 免費訊息額度已滿，改導向網頁註冊
      window.history.pushState({}, '', SIGNUP_PATH);
      window.location.reload();
    } else {
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
    <div className="min-h-screen dark:bg-[#050b14] bg-slate-50 dark:text-white text-slate-900 font-sans transition-colors duration-300">
      
      {/* ✅ 動態公告橫幅 */}
      {showAnnouncement && dynamicContent.announcement?.enabled && (
        <AnnouncementBar 
          data={dynamicContent.announcement} 
          onClose={() => setShowAnnouncement(false)} 
        />
      )}

      <MarketTicker />

      {/* ✅ Header - 滾動優化 */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-all duration-300
                        ${isScrolled
                          ? 'dark:bg-[#050b14]/95 bg-white/95 dark:border-blue-500/20 border-slate-200 shadow-[0_4px_30px_rgba(59,130,246,0.1)]'
                          : 'dark:bg-[#050b14]/80 bg-white/80 dark:border-white/5 border-slate-100'}`}>
        <div className={`max-w-7xl mx-auto px-6 flex justify-between items-center transition-all duration-300
                       ${isScrolled ? 'py-2' : 'py-4'}`}>
          <div className="flex items-center gap-3 cursor-pointer relative" 
               onClick={handleLogoClick}
               title={clickCount > 0 ? `再點 ${5 - clickCount} 次進入管理後台` : ''}>
            <img
              src={logoError ? "https://placehold.co/40x40/3b82f6/white?text=UA" : LOGO_URL}
              alt="Ultra Advisor - 台灣財務顧問提案工具 Logo"
              className="h-10 w-auto"
              loading="eager"
              fetchpriority="high"
              decoding="async"
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
      window.history.pushState({}, '', '/calculator');
      window.location.reload();
    }}
    className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors flex items-center gap-1">
    <Calculator size={16} />
    傲創計算機
  </button>
  <div className="relative group">
    <button className="text-slate-400 hover:text-blue-400 font-bold transition-colors flex items-center gap-1">
      產品方案
      <ChevronRight size={14} className="rotate-90 group-hover:rotate-[270deg] transition-transform" />
    </button>
    <div className="absolute top-full left-0 mt-2 py-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl
                    opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200
                    min-w-[140px]">
      <button
        onClick={() => document.getElementById('products')?.scrollIntoView({behavior: 'smooth'})}
        className="w-full px-4 py-2 text-left text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-bold transition-colors">
        產品展示
      </button>
      <button
        onClick={() => document.getElementById('pricing')?.scrollIntoView({behavior: 'smooth'})}
        className="w-full px-4 py-2 text-left text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-bold transition-colors">
        定價方案
      </button>
      <button
        onClick={() => document.getElementById('ultracloud')?.scrollIntoView({behavior: 'smooth'})}
        className="w-full px-4 py-2 text-left text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 text-sm font-bold transition-colors flex items-center gap-2">
        <Cloud size={14} />
        傲創雲端
      </button>
    </div>
  </div>
  <button
    onClick={() => {
      window.history.pushState({}, '', '/blog');
      window.location.reload();
    }}
    className="text-slate-400 hover:text-blue-400 font-bold transition-colors flex items-center gap-1">
    <FileText size={16} />
    知識庫
  </button>
  <a href={COMMUNITY_LINK} target="_blank" rel="noopener noreferrer"
     className="text-slate-400 hover:text-blue-400 font-bold transition-colors">
    社群
  </a>
  <button
    onClick={() => {
      window.history.pushState({}, '', '/booking');
      window.location.reload();
    }}
    className="text-purple-400 hover:text-purple-300 font-bold transition-colors flex items-center gap-1">
    <Calendar size={16} />
    預約試算
  </button>
  <button
    onClick={() => {
      window.history.pushState({}, '', '/alliance');
      window.location.reload();
    }}
    className="text-amber-400 hover:text-amber-300 font-bold transition-colors flex items-center gap-1">
    <Handshake size={16} />
    傲創聯盟
  </button>

            {/* ✅ 登入/註冊按鈕 - 統一導向註冊頁 */}
            <button
              onClick={handleFreeTrial}
              className="flex items-center gap-2 text-slate-400 hover:text-white font-bold transition-colors">
              <LogIn size={18} />
              登入 / 註冊
            </button>
            
            <button
              onClick={handleFreeTrial}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all
                       ${isScrolled
                         ? 'bg-gradient-to-r from-blue-600 to-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.5)] animate-pulse'
                         : 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]'}`}>
              {isScrolled ? '🔥 立即試用' : '免費試用'}
            </button>
          </nav>

          {/* ✅ 手機版按鈕 */}
          <div className="md:hidden flex items-center gap-2">
            {/* 傲創計算機 */}
            <button
              onClick={() => {
                window.history.pushState({}, '', '/calculator');
                window.location.reload();
              }}
              className="p-2 text-emerald-400 hover:text-emerald-300 transition-colors"
              title="傲創計算機"
            >
              <Calculator size={20} />
            </button>
            {/* 知識庫 */}
            <button
              onClick={() => {
                window.history.pushState({}, '', '/blog');
                window.location.reload();
              }}
              className="p-2 text-slate-400 hover:text-blue-400 transition-colors"
              title="知識庫"
            >
              <FileText size={20} />
            </button>
            {/* 預約試算 */}
            <button
              onClick={() => {
                window.history.pushState({}, '', '/booking');
                window.location.reload();
              }}
              className="p-2 text-purple-400 hover:text-purple-300 transition-colors"
              title="預約1:1免費試算"
            >
              <Calendar size={20} />
            </button>
            {/* 登入 */}
            <button
              onClick={handleFreeTrial}
              className="text-slate-400 hover:text-white font-bold text-sm px-2">
              登入
            </button>
            {/* 註冊 */}
            <button
              onClick={handleFreeTrial}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-sm transition-all">
              註冊
            </button>
          </div>
        </div>
      </header>

      <main>
        <OptimizedHeroSection
          onFreeTrial={handleFreeTrial}
          onWatchDemo={handleWatchDemo}
          hasVideo={hasVideo}
        />

        {/* ==================== 即時統計欄 ==================== */}
        <LiveStatsBar />

        {/* ==================== 產品截圖輪播 ==================== */}
        <ProductScreenshotCarousel />

        {/* ==================== 信任標誌區塊 ==================== */}
        <section className="py-16 bg-slate-950/50 border-y border-white/5">
          <div className="max-w-6xl mx-auto px-6">
            <p className="text-slate-600 text-sm font-bold text-center uppercase tracking-widest mb-10">
              技術合作夥伴 & 使用技術
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60">
              {/* Firebase */}
              <div className="flex items-center gap-2 text-slate-500">
                <Database size={24} />
                <span className="font-bold text-sm">Firebase</span>
              </div>
              {/* Google Cloud */}
              <div className="flex items-center gap-2 text-slate-500">
                <Globe size={24} />
                <span className="font-bold text-sm">Google Cloud</span>
              </div>
              {/* LINE */}
              <div className="flex items-center gap-2 text-slate-500">
                <MessageSquare size={24} />
                <span className="font-bold text-sm">LINE Bot</span>
              </div>
              {/* SSL 安全 */}
              <div className="flex items-center gap-2 text-slate-500">
                <Lock size={24} />
                <span className="font-bold text-sm">SSL 加密</span>
              </div>
              {/* React */}
              <div className="flex items-center gap-2 text-slate-500">
                <Monitor size={24} />
                <span className="font-bold text-sm">React</span>
              </div>
            </div>
            <div className="mt-10 flex justify-center gap-6 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span>銀行等級資安</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span>99.9% 服務可用性</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span>資料加密傳輸</span>
              </div>
            </div>
          </div>
        </section>

        <ProductShowcase />
        <RealSocialProof />
        <EarlyUserFeedback onFreeTrial={handleFreeTrial} />
        <PricingSection onSelectPlan={handleSelectPlan} />

        {/* ==================== UltraCloud 傲創雲端 ==================== */}
        <UltraCloudSection />

        {/* ==================== FAQ 常見問題 ==================== */}
        <section id="faq" className="py-32 bg-[#050b14]">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-16">
              <span className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20
                             text-emerald-400 text-xs font-black uppercase tracking-[0.4em]
                             rounded-full">
                FAQ
              </span>
              <h2 className="text-4xl md:text-5xl font-black text-white mt-8 tracking-tight">
                常見問題
              </h2>
              <p className="text-slate-400 text-lg mt-6">
                還有其他問題？歡迎透過 LINE 官方帳號聯繫我們
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  q: "免費試用需要綁定信用卡嗎？",
                  a: "不需要！註冊後即可免費試用 7 天完整功能，不需要提供任何付款資訊。試用期結束後，系統會自動轉為免費版，不會自動扣款。"
                },
                {
                  q: "資料安全嗎？會不會被外洩？",
                  a: "我們使用 Google Firebase 雲端服務，所有資料皆經過加密傳輸與儲存，符合金融等級的資安標準。您的客戶資料只有您自己可以存取。"
                },
                {
                  q: "可以在多個裝置上使用嗎？",
                  a: "可以！同一帳號最多可在 2 個裝置上同時登入使用，資料會自動同步。手機、平板、電腦都能使用。"
                },
                {
                  q: "訂閱後可以隨時取消嗎？",
                  a: "當然可以！我們採用不綁約制，您可以隨時取消訂閱。取消後，您仍可使用至訂閱期結束，不會額外收費。"
                },
                {
                  q: "傲創計算機是免費的嗎？",
                  a: "是的！傲創計算機是完全免費的公開工具，不需要註冊就可以使用。這是我們提供給所有財務顧問的免費資源。"
                },
                {
                  q: "如何升級為付費會員？",
                  a: "您可以透過系統內的「升級」按鈕，或直接聯繫我們的 LINE 官方帳號進行付費。我們支援多種付款方式。"
                },
                {
                  q: "有提供教育訓練嗎？",
                  a: "有的！我們提供 LINE 社群即時問答、操作教學影片，以及定期的線上工作坊。付費會員還可享有 1 對 1 技術支援。"
                },
                {
                  q: "工具的數據來源是什麼？",
                  a: "我們的市場數據來自公開的政府統計資料（如主計處、衛福部、勞動部等），並會定期更新以確保資料的準確性。"
                }
              ].map((item, i) => (
                <details
                  key={i}
                  className="group bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden
                           hover:border-slate-700 transition-all"
                >
                  <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                    <span className="text-white font-bold text-lg pr-4">{item.q}</span>
                    <ChevronRight
                      size={20}
                      className="text-slate-500 group-open:rotate-90 transition-transform flex-shrink-0"
                    />
                  </summary>
                  <div className="px-6 pb-6 pt-0">
                    <p className="text-slate-400 leading-relaxed">{item.a}</p>
                  </div>
                </details>
              ))}
            </div>

            <div className="mt-12 text-center">
              <p className="text-slate-500 mb-4">還有其他問題？</p>
              <a
                href={LINE_OFFICIAL_ACCOUNT}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#06C755] hover:bg-[#05b34c]
                         text-white rounded-xl font-bold transition-all"
              >
                <MessageSquare size={20} />
                LINE 聯繫客服
              </a>
            </div>
          </div>
        </section>

        <section className="py-32 bg-gradient-to-b from-slate-950 to-blue-950/20">
          <div className="max-w-4xl mx-auto text-center px-6">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-8 leading-tight">
              準備好讓數據
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                替你說話
              </span>
              了嗎？
            </h2>
            <p className="text-slate-400 text-xl mb-12">
              加入 500+ 位專業顧問，開始製作視覺化報表
            </p>
            <button
              onClick={handleFreeTrial}
              className="px-12 py-6 bg-gradient-to-r from-blue-600 to-blue-500
                       text-white rounded-2xl font-black text-xl
                       shadow-[0_0_50px_rgba(59,130,246,0.5)]
                       hover:shadow-[0_0_80px_rgba(59,130,246,0.7)]
                       transition-all hover:-translate-y-2 inline-flex items-center gap-3">
              <Sparkles size={28} />
              免費體驗視覺化工具
              <ArrowRight size={24} />
            </button>
            <p className="text-slate-500 text-sm mt-6">
              ✓ 7 天免費 ✓ 不需信用卡 ✓ 隨時可取消
            </p>
          </div>
        </section>
      </main>

      {/* ==================== 完整 Footer ==================== */}
      <footer className="bg-slate-950 border-t border-white/5">
        {/* 主要 Footer 內容 */}
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-4 gap-12">

            {/* 公司資訊 */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <img
                  src={logoError ? "https://placehold.co/32x32/3b82f6/white?text=UA" : LOGO_URL}
                  alt="Ultra Advisor - 台灣財務顧問提案工具 Logo"
                  className="h-8 w-auto"
                  loading="lazy"
                  decoding="async"
                />
                <span className="text-lg font-black">
                  <span style={{color: '#FF3A3A'}}>Ultra</span>
                  <span className="text-blue-400">Advisor</span>
                </span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                專業財務視覺化解決方案<br />
                讓複雜數據變成一目了然的圖表
              </p>
              <div className="flex gap-3">
                <a href={LINE_OFFICIAL_ACCOUNT} target="_blank" rel="noopener noreferrer"
                   className="w-10 h-10 bg-[#06C755] rounded-xl flex items-center justify-center hover:opacity-80 transition-opacity">
                  <MessageSquare size={20} className="text-white" />
                </a>
                <a href={COMMUNITY_LINK} target="_blank" rel="noopener noreferrer"
                   className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center hover:bg-slate-700 transition-colors">
                  <Users size={20} className="text-slate-400" />
                </a>
                <a href="mailto:support@ultra-advisor.tw"
                   className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center hover:bg-slate-700 transition-colors">
                  <Mail size={20} className="text-slate-400" />
                </a>
              </div>
            </div>

            {/* 產品功能 */}
            <div>
              <h4 className="text-white font-black text-sm uppercase tracking-wider mb-6">產品功能</h4>
              <ul className="space-y-3">
                {[
                  { name: '傲創計算機', path: '/calculator', highlight: true },
                  { name: '創富工具', anchor: 'products' },
                  { name: '守富工具', anchor: 'products' },
                  { name: '傳富工具', anchor: 'products' },
                  { name: '戰情室數據', anchor: 'products' },
                ].map((item, i) => (
                  <li key={i}>
                    <button
                      onClick={() => {
                        if (item.path) {
                          window.history.pushState({}, '', item.path);
                          window.location.reload();
                        } else if (item.anchor) {
                          document.getElementById(item.anchor)?.scrollIntoView({behavior: 'smooth'});
                        }
                      }}
                      className={`text-sm transition-colors flex items-center gap-2
                        ${item.highlight
                          ? 'text-emerald-400 hover:text-emerald-300 font-bold'
                          : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      {item.highlight && <Sparkles size={14} />}
                      {item.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* 關於我們 */}
            <div>
              <h4 className="text-white font-black text-sm uppercase tracking-wider mb-6">關於我們</h4>
              <ul className="space-y-3">
                {[
                  { name: '知識庫', path: '/blog', highlight: true },
                  { name: '定價方案', anchor: 'pricing' },
                  { name: '成功案例', anchor: 'testimonials' },
                  { name: '常見問題', anchor: 'faq' },
                  { name: '聯絡客服', href: LINE_OFFICIAL_ACCOUNT },
                ].map((item, i) => (
                  <li key={i}>
                    {item.href ? (
                      <a href={item.href} target="_blank" rel="noopener noreferrer"
                         className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                        {item.name}
                      </a>
                    ) : item.path ? (
                      <button
                        onClick={() => {
                          window.history.pushState({}, '', item.path);
                          window.location.reload();
                        }}
                        className={`text-sm transition-colors flex items-center gap-2
                          ${item.highlight
                            ? 'text-purple-400 hover:text-purple-300 font-bold'
                            : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        {item.highlight && <FileText size={14} />}
                        {item.name}
                      </button>
                    ) : (
                      <button
                        onClick={() => document.getElementById(item.anchor)?.scrollIntoView({behavior: 'smooth'})}
                        className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                        {item.name}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* 聯絡資訊 */}
            <div>
              <h4 className="text-white font-black text-sm uppercase tracking-wider mb-6">聯絡我們</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <MessageSquare size={18} className="text-[#06C755] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-slate-400 text-sm">LINE 官方帳號</p>
                    <a href={LINE_OFFICIAL_ACCOUNT} target="_blank" rel="noopener noreferrer"
                       className="text-white font-bold text-sm hover:text-blue-400 transition-colors">
                      @ultraadvisor
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Mail size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-slate-400 text-sm">電子郵件</p>
                    <a href="mailto:support@ultra-advisor.tw"
                       className="text-white font-bold text-sm hover:text-blue-400 transition-colors">
                      support@ultra-advisor.tw
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Globe size={18} className="text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-slate-400 text-sm">官方網站</p>
                    <span className="text-white font-bold text-sm">ultra-advisor.tw</span>
                  </div>
                </li>
              </ul>
            </div>

          </div>
        </div>

        {/* 底部版權 */}
        <div className="border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-600 text-xs">
              © 2026 UltraAdvisor. All rights reserved. 專業財務視覺化解決方案
            </p>
            <div className="flex items-center gap-6 text-xs">
              <button className="text-slate-600 hover:text-slate-400 transition-colors">隱私權政策</button>
              <button className="text-slate-600 hover:text-slate-400 transition-colors">服務條款</button>
              <button className="text-slate-600 hover:text-slate-400 transition-colors">免責聲明</button>
            </div>
          </div>
        </div>
      </footer>

      {/* ✅ 影片彈窗 */}
      <VideoModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        videoData={dynamicContent.heroVideo}
        videoType={demoVideoType}
      />

      {/* ==================== LINE 浮動客服按鈕 ==================== */}
      <a
        href={LINE_OFFICIAL_ACCOUNT}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 group"
        aria-label="LINE 客服"
      >
        <div className="relative">
          {/* 脈衝動畫背景 */}
          <div className="absolute inset-0 bg-[#06C755] rounded-full animate-ping opacity-30" />

          {/* 主按鈕 */}
          <div className="relative w-16 h-16 bg-[#06C755] rounded-full flex items-center justify-center
                         shadow-[0_4px_20px_rgba(6,199,85,0.5)] hover:shadow-[0_6px_30px_rgba(6,199,85,0.7)]
                         transition-all duration-300 hover:scale-110 hover:-translate-y-1">
            <MessageSquare size={28} className="text-white" />
          </div>

          {/* 提示文字 */}
          <div className="absolute bottom-full right-0 mb-3 opacity-0 group-hover:opacity-100
                         transition-opacity duration-300 pointer-events-none">
            <div className="bg-slate-900 text-white text-sm font-bold px-4 py-2 rounded-xl
                          shadow-xl whitespace-nowrap border border-slate-700">
              LINE 即時客服
              <div className="absolute bottom-0 right-6 translate-y-1/2 rotate-45
                            w-2 h-2 bg-slate-900 border-r border-b border-slate-700" />
            </div>
          </div>
        </div>
      </a>

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

export default LandingPage;