import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Eye, Brain, Cpu
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { blogArticles } from '../data/blog';
import { getTodayQuote, getTodayBackground, formatDateChinese } from '../data/dailyQuotes';

// ==========================================
// 🎬 Scroll Reveal Component
// ==========================================
const Reveal = ({ children, delay = 0, className = '', scale = false }) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${scale ? 'reveal-scale' : 'reveal'} ${isVisible ? 'revealed' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// ==========================================
// 🌟 Cursor Glow — 滑鼠跟隨光暈
// ==========================================
const CursorGlow = () => {
  const glowRef = useRef(null);
  const posRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef(null);

  useEffect(() => {
    // 只在桌面環境啟用
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const update = () => {
      if (glowRef.current) {
        glowRef.current.style.left = posRef.current.x + 'px';
        glowRef.current.style.top = posRef.current.y + 'px';
      }
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);

    const handleMove = (e) => {
      posRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // 手機不渲染
  if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return null;
  return <div ref={glowRef} className="cursor-glow" />;
};

// ==========================================
// 🃏 TiltCard — 3D 傾斜卡片（滑鼠跟隨 perspective）
// ==========================================
const TiltCard = ({ children, className = '', intensity = 12 }) => {
  const cardRef = useRef(null);
  const innerRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const el = cardRef.current;
    if (!el || !innerRef.current) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateX = (0.5 - y) * intensity;
    const rotateY = (x - 0.5) * intensity;
    innerRef.current.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    innerRef.current.querySelector('.tilt-shine')?.style.setProperty('--shine-x', `${x * 100}%`);
    innerRef.current.querySelector('.tilt-shine')?.style.setProperty('--shine-y', `${y * 100}%`);
  }, [intensity]);

  const handleMouseLeave = useCallback(() => {
    if (innerRef.current) innerRef.current.style.transform = 'rotateX(0deg) rotateY(0deg)';
  }, []);

  return (
    <div ref={cardRef} className={`tilt-card ${className}`}
         onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <div ref={innerRef} className="tilt-card-inner">
        <div className="tilt-shine" />
        {children}
      </div>
    </div>
  );
};

// ==========================================
// ⌨️ Typewriter — 打字機效果
// ==========================================
const Typewriter = ({ texts, className = '', speed = 80, pause = 2000 }) => {
  const [displayText, setDisplayText] = useState('');
  const [textIdx, setTextIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = texts[textIdx];
    let timeout;

    if (!isDeleting && charIdx < currentText.length) {
      timeout = setTimeout(() => setCharIdx(c => c + 1), speed);
    } else if (!isDeleting && charIdx === currentText.length) {
      timeout = setTimeout(() => setIsDeleting(true), pause);
    } else if (isDeleting && charIdx > 0) {
      timeout = setTimeout(() => setCharIdx(c => c - 1), speed / 2);
    } else if (isDeleting && charIdx === 0) {
      setIsDeleting(false);
      setTextIdx(i => (i + 1) % texts.length);
    }

    setDisplayText(currentText.substring(0, charIdx));
    return () => clearTimeout(timeout);
  }, [charIdx, isDeleting, textIdx, texts, speed, pause]);

  return (
    <span className={className}>
      {displayText}
      <span className="typewriter-cursor" />
    </span>
  );
};

// ==========================================
// 🧲 MagneticButton — 磁性按鈕
// ==========================================
const MagneticButton = ({ children, className = '', onClick, strength = 0.3 }) => {
  const btnRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
  }, [strength]);

  const handleMouseLeave = useCallback(() => {
    if (btnRef.current) btnRef.current.style.transform = 'translate(0, 0)';
  }, []);

  return (
    <button ref={btnRef} className={`magnetic-btn ${className}`}
            onClick={onClick} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {children}
    </button>
  );
};

// ==========================================
// ✨ ParticleField — 粒子背景
// ==========================================
const ParticleField = ({ count = 50 }) => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = canvas.width = canvas.offsetWidth;
    let h = canvas.height = canvas.offsetHeight;

    // 初始化粒子
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.3 + 0.1,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // 繪製粒子
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59, 130, 246, ${p.alpha})`;
        ctx.fill();

        // 滑鼠互動 - 連線
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(59, 130, 246, ${0.15 * (1 - dist / 200)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }

        // 粒子互連
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const d = Math.sqrt((p.x - p2.x) ** 2 + (p.y - p2.y) ** 2);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.06 * (1 - d / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    const handleMouse = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleResize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; };

    canvas.addEventListener('mousemove', handleMouse, { passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      canvas.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('resize', handleResize);
    };
  }, [count]);

  return <canvas ref={canvasRef} className="particle-canvas" />;
};

// ==========================================
// 🎯 整合版本：
// 1. ✅ 保留原本所有精心設計的內容
// 2. ✅ 加入動態公告橫幅（從 Firestore 讀取）
// 3. ✅ 加入動態影片嵌入（從 Firestore 讀取）
// 4. ✅ Logo "ULTRA" 使用 style 屬性確保紅色顯示
// 5. ✅ Header 加入「登入系統」按鈕
// ==========================================

const LOGO_URL = "/logo.png";
const COMMUNITY_LINK = "https://line.me/ti/g2/9Cca20iCP8J0KrmVRg5GOe1n5dSatYKO8ETTHw?utm_source=invitation&utm_medium=link_copy&utm_campaign=default";
const LINE_OFFICIAL_ACCOUNT = "https://line.me/R/ti/p/@ultraadvisor";

// 🔥 註冊頁面路徑（LINE 免費訊息額度已滿，改導向網頁註冊）
const SIGNUP_PATH = '/register';

// 🔥 管理員後台網址
const ADMIN_URL = "https://admin.ultra-advisor.tw/secret-admin-ultra-2026";

// ==========================================
// 🔢 CountUp 計數動畫組件
// ==========================================
const CountUp = ({ end, suffix = '', prefix = '', duration = 2000, className = '' }) => {
  const ref = useRef(null);
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const startTime = performance.now();
    const endVal = typeof end === 'number' ? end : parseInt(end.replace(/[^0-9]/g, ''), 10) || 0;
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * endVal));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, end, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
};

// ==========================================
// 📏 Scroll Progress Bar
// ==========================================
const ScrollProgressBar = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return <div className="scroll-progress-bar" style={{ width: `${progress}%` }} />;
};

// ==========================================
// 🏢 Tech Partner Logo Marquee
// ==========================================
const TechPartnerMarquee = () => {
  const partners = [
    { name: 'Google Cloud', icon: Globe },
    { name: 'Firebase', icon: Database },
    { name: 'React', icon: Monitor },
    { name: 'LINE Bot', icon: MessageSquare },
    { name: 'Vercel', icon: Rocket },
    { name: 'TypeScript', icon: FileBarChart },
    { name: 'Tailwind CSS', icon: Sparkles },
    { name: 'Recharts', icon: BarChart3 },
  ];

  return (
    <div className="py-12 bg-[#030712] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 glow-divider" />
      <Reveal>
        <p className="text-slate-600 text-xs font-bold text-center uppercase tracking-[0.3em] mb-8">
          Powered by Modern Tech Stack
        </p>
      </Reveal>
      <div className="relative overflow-hidden">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#030712] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#030712] to-transparent z-10 pointer-events-none" />
        <div className="logo-marquee">
          {[...partners, ...partners].map((p, i) => (
            <div key={i} className="flex items-center gap-3 px-8 py-3 mx-3 bg-white/[0.02] border border-white/[0.04]
                                    rounded-xl shrink-0 hover:border-blue-500/20 hover:bg-white/[0.04] transition-all duration-300">
              <p.icon size={20} className="text-slate-500" />
              <span className="text-slate-400 font-bold text-sm whitespace-nowrap">{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 🚀 Customer Journey — 獲客 → 銷售 → 成交
// ==========================================
const CustomerJourneySection = () => {
  const steps = [
    {
      step: '01',
      label: '獲客',
      icon: FileText,
      title: '用內容吸引客戶',
      desc: '60+ 篇專業文章 × 每日限動素材，分享到社群就能建立專業形象，客戶主動來找你',
      example: '「我在 IG 分享了一篇房貸文章，隔天就有人私訊問我」',
      color: 'emerald',
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      step: '02',
      label: '銷售',
      icon: BarChart3,
      title: '用圖表贏得信任',
      desc: '打開工具、輸入條件、秀出圖表 — 客戶 3 秒就看懂，不用解釋半天',
      example: '「客戶看到保障缺口圖，自己就說：這個要補！」',
      color: 'blue',
      gradient: 'from-blue-500 to-indigo-500',
    },
    {
      step: '03',
      label: '成交',
      icon: FileBarChart,
      title: '用報表促成決定',
      desc: '分析完直接產出 PDF 報告，帶品牌 Logo，客戶帶回去跟家人討論也覺得專業',
      example: '「客戶說：這報告比其他業務給的好太多了」',
      color: 'purple',
      gradient: 'from-purple-500 to-pink-500',
    },
  ];

  return (
    <section aria-label="三步驟銷售流程" className="py-24 bg-[#030712] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 glow-divider" />
      <div className="max-w-6xl mx-auto px-6 relative">
        <Reveal>
          <div className="text-center mb-16">
            <span className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20
                           text-blue-400 text-xs font-black uppercase tracking-[0.4em]
                           rounded-full">
              從獲客到成交
            </span>
            <h2 data-speakable="true" className="text-4xl md:text-5xl font-black text-white mt-8 tracking-[-0.02em]">
              一個平台，
              <span className="bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-text">搞定整條銷售流程</span>
            </h2>
            <p className="text-slate-500 text-lg mt-6 max-w-2xl mx-auto">
              不用再東拼西湊，從吸引客戶、面談展示到成交報表，Ultra Advisor 幫你一站搞定
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* 連接線（桌面） */}
          <div className="hidden md:block absolute top-[60px] left-[20%] right-[20%] h-[2px]
                         bg-gradient-to-r from-emerald-500/30 via-blue-500/30 to-purple-500/30" />

          {steps.map((s, i) => (
            <Reveal key={s.step} delay={i * 120}>
              <div className="glass-card holo-card rounded-2xl p-8 text-center relative group">
                {/* Step number */}
                <div className={`w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${s.gradient}
                               flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.2)]
                               group-hover:scale-110 transition-transform duration-500`}>
                  <s.icon size={28} className="text-white" />
                </div>
                <div className={`text-${s.color}-400 text-xs font-black uppercase tracking-[0.3em] mb-2`}>
                  Step {s.step} — {s.label}
                </div>
                <h3 className="text-2xl font-black text-white mb-3">{s.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">{s.desc}</p>
                <p className="text-slate-600 text-xs italic leading-relaxed">{s.example}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

// ==========================================
// 🤖 AI Technology Showcase — NVIDIA Inception 核心區塊
// ==========================================
const AITechSection = () => {
  const aiFeatures = [
    {
      icon: Eye,
      title: '拍保單就自動整理',
      subtitle: 'AI 保單辨識',
      desc: '客戶的保單堆成一疊看不懂？拍照上傳，AI 自動辨識內容、整理成清楚的表格，你不用再一張一張翻。',
      scenario: '面對客戶一堆保單 → 30 秒整理完畢',
      color: 'blue',
      link: null,
    },
    {
      icon: Brain,
      title: '自動找出保障缺口',
      subtitle: 'AI 保障分析',
      desc: '根據客戶的家庭狀況和現有保單，AI 自動算出哪裡保障不夠，直接產出建議報告，你只要跟客戶說結果。',
      scenario: '客戶問「我保險夠嗎？」→ 一鍵給答案',
      color: 'purple',
      link: null,
    },
    {
      icon: Cpu,
      title: '房貸怎麼選最省',
      subtitle: 'AI 房貸分析',
      desc: '客戶想買房？輸入貸款條件，AI 直接告訴你哪種方案最省錢、怎麼還最划算，免費讓所有人使用。',
      scenario: '客戶問「該選哪家銀行？」→ AI 幫你比較',
      color: 'emerald',
      link: '/calculator',
    },
    {
      icon: TrendingUp,
      title: '社群貼文自動產',
      subtitle: 'AI 內容引擎',
      desc: '不知道社群發什麼？AI 自動幫你生成理財知識貼文，一鍵發布到 Threads、IG，天天有內容不斷更。',
      scenario: '每天花 5 分鐘 → 社群天天有新貼文',
      color: 'amber',
      link: null,
    },
  ];

  return (
    <section aria-label="AI 幫你做什麼" className="py-32 bg-[#030712] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 glow-divider" />
      <div className="absolute top-[20%] left-[5%] w-[500px] h-[500px] bg-blue-600/[0.03] rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-purple-600/[0.03] rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative">
        <Reveal>
          <div className="text-center mb-20">
            <span className="px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/20
                           text-cyan-400 text-xs font-black uppercase tracking-[0.4em]
                           rounded-full">
              AI 幫你省時間
            </span>
            <h2 data-speakable="true" className="text-4xl md:text-5xl font-black text-white mt-8 tracking-[-0.02em]">
              別人還在手動整理，
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                你已經做完了
              </span>
            </h2>
            <p className="text-slate-500 text-lg mt-6 max-w-2xl mx-auto">
              AI 幫你處理最花時間的瑣事，你只要專心跟客戶聊天就好
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-6">
          {aiFeatures.map((f, i) => (
            <Reveal key={f.title} delay={i * 100}>
              <div className="glass-card holo-card rounded-2xl p-8 group hover:border-blue-500/20 transition-all duration-500">
                <div className="flex items-start gap-5">
                  <div className={`w-14 h-14 rounded-xl bg-${f.color}-500/10 border border-${f.color}-500/20
                                 flex items-center justify-center flex-shrink-0
                                 group-hover:scale-110 transition-transform duration-500`}>
                    <f.icon size={24} className={`text-${f.color}-400`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-white mb-1">{f.title}</h3>
                    <p className={`text-${f.color}-400 text-sm font-bold mb-3`}>{f.subtitle}</p>
                    <p className="text-slate-400 text-sm leading-relaxed mb-3">{f.desc}</p>
                    <p className="text-slate-600 text-xs italic">{f.scenario}</p>
                    {f.link && (
                      <button
                        onClick={() => { window.history.pushState({}, '', f.link); window.location.reload(); }}
                        className="mt-3 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                      >
                        免費體驗 <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* CTA */}
        <Reveal delay={400}>
          <div className="text-center mt-12">
            <button
              onClick={() => { window.history.pushState({}, '', '/calculator'); window.location.reload(); }}
              className="px-8 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl font-bold text-white
                         hover:shadow-[0_0_40px_rgba(6,182,212,0.3)] transition-all duration-300 text-sm"
            >
              免費體驗 AI 房貸分析
            </button>
            <p className="text-slate-600 text-xs mt-3">不需註冊，立即使用</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

// ==========================================
// 📋 Auto Report — 報表自動產出
// ==========================================
const AutoReportSection = () => (
  <section aria-label="一鍵產出專業報表" className="py-32 bg-[#030712] relative overflow-hidden">
    <div className="absolute top-0 left-0 right-0 glow-divider" />
    <div className="absolute top-[30%] right-[10%] w-[400px] h-[400px] bg-purple-600/[0.04] rounded-full blur-[150px] pointer-events-none" />

    <div className="max-w-7xl mx-auto px-6 relative">
      <div className="grid md:grid-cols-2 gap-16 items-center">

        {/* 左側：說明 */}
        <Reveal>
          <div>
            <span className="px-4 py-1.5 bg-purple-500/10 border border-purple-500/20
                           text-purple-400 text-xs font-black uppercase tracking-[0.4em]
                           rounded-full">
              成交利器 — 專業報表
            </span>
            <h2 data-speakable="true" className="text-4xl md:text-5xl font-black text-white mt-8 tracking-[-0.02em] leading-tight">
              客戶帶回去給家人看，
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-text">
                也覺得你很專業
              </span>
            </h2>
            <p className="text-slate-500 text-lg mt-6 leading-relaxed">
              面談完直接產出 PDF 報告，帶有你的品牌 Logo。
              客戶拿回去跟另一半討論時，不會說「有個業務找我」，而是「有個專業的顧問幫我分析了」。
            </p>

            <div className="mt-8 space-y-4">
              {[
                { icon: FileBarChart, text: "PDF 報告一鍵匯出 — 帶有你的品牌 Logo", color: "purple" },
                { icon: HeartPulse, text: "保障缺口圖表 — 客戶一看就知道哪裡要補", color: "rose" },
                { icon: Target, text: "自動調整內容 — 不同客戶、不同報告", color: "blue" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-10 h-10 bg-${item.color}-600/10 rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <item.icon className={`text-${item.color}-400`} size={20} />
                  </div>
                  <p className="text-slate-300 font-medium">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* 右側：報表 mockup */}
        <Reveal delay={200} scale>
          <div className="flex justify-center">
            <div className="relative w-full max-w-[400px] aspect-[3/4] rounded-2xl overflow-hidden
                           shadow-[0_0_60px_rgba(139,92,246,0.12),0_20px_60px_rgba(0,0,0,0.4)]
                           border border-white/10 bg-white/[0.02] backdrop-blur-sm">
              {/* Report mockup content */}
              <div className="p-8 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                    <FileBarChart size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Ultra Advisor</p>
                    <p className="text-slate-500 text-xs">客戶理財規劃報告</p>
                  </div>
                </div>
                {/* Body mockup lines */}
                <div className="space-y-3 flex-1">
                  <div className="h-3 bg-white/[0.06] rounded-full w-[80%]" />
                  <div className="h-3 bg-white/[0.06] rounded-full w-[60%]" />
                  <div className="h-3 bg-white/[0.04] rounded-full w-[90%]" />
                  <div className="mt-6 p-4 rounded-xl bg-blue-500/[0.06] border border-blue-500/10">
                    <div className="flex items-center gap-2 mb-3">
                      <PieChart size={14} className="text-blue-400" />
                      <span className="text-blue-400 text-xs font-bold">保障缺口分析</span>
                    </div>
                    <div className="flex gap-2">
                      {[40, 65, 80, 55].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full bg-white/[0.04] rounded-sm overflow-hidden" style={{ height: '60px' }}>
                            <div className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-sm mt-auto"
                                 style={{ height: `${h}%`, marginTop: `${100 - h}%` }} />
                          </div>
                          <span className="text-slate-600 text-[10px]">{['壽險', '醫療', '失能', '癌症'][i]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="h-3 bg-white/[0.04] rounded-full w-[70%] mt-4" />
                  <div className="h-3 bg-white/[0.04] rounded-full w-[50%]" />
                </div>
                {/* Footer */}
                <div className="pt-4 border-t border-white/10 text-center">
                  <p className="text-slate-600 text-[10px]">Generated by Ultra Advisor</p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

      </div>
    </div>
  </section>
);

// ==========================================
// 💬 Testimonials 真人見證區塊
// ==========================================
const TestimonialsSection = () => {
  const testimonials = [
    {
      name: "小蔡",
      role: "入行 8 個月的保險業務",
      cert: "壽險業務員",
      content: "剛入行的時候真的什麼都不會，約到客戶也不知道要講什麼。有了 Ultra Advisor 之後，我把圖表打開，客戶自己就開始問問題了。上個月終於達標了！",
      metric: "從零到達標",
      metricColor: "amber",
    },
    {
      name: "林小姐",
      role: "保險業務主管",
      cert: "FCHFP",
      content: "我讓新人都用 Ultra Advisor，最大的改變是他們不用再背話術了。打開工具、輸入數字、秀出圖表，客戶自己就看懂了。新人的成交率明顯提升。",
      metric: "新人成交率 +40%",
      metricColor: "emerald",
    },
    {
      name: "陳先生",
      role: "RFC 持照理財規劃師",
      cert: "RFC",
      content: "以前每次準備客戶提案都要花 3-4 小時手動做圖表，現在 15 分鐘就搞定。客戶看到報表的第一反應就是：「這也太專業了吧！」這種專業感是 Excel 做不出來的。",
      metric: "效率提升 12 倍",
      metricColor: "blue",
    },
    {
      name: "王先生",
      role: "獨立財務規劃師",
      cert: "CFP",
      content: "面對高資產客戶，只要打開 Ultra Advisor 的圖表，專業度立刻拉滿。現在客戶都主動找我做規劃，還會介紹朋友來。",
      metric: "客戶主動轉介紹",
      metricColor: "purple",
    },
  ];

  return (
    <section className="py-32 bg-[#030712] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 glow-divider" />
      <div className="absolute top-[30%] right-[10%] w-[500px] h-[500px] bg-blue-600/[0.03] rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[5%] w-[400px] h-[400px] bg-purple-600/[0.03] rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative">
        <Reveal>
          <div className="text-center mb-16">
            <span className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20
                           text-blue-400 text-xs font-black uppercase tracking-[0.4em]
                           rounded-full">
              Testimonials
            </span>
            <h2 className="text-4xl md:text-6xl font-black text-white mt-8 tracking-[-0.02em]">
              用戶怎麼說
            </h2>
            <p className="text-slate-500 text-lg mt-6 max-w-2xl mx-auto">
              從菜鳥到資深，都在用
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((t, i) => (
            <Reveal key={i} delay={i * 120}>
              <TiltCard intensity={10}>
              <div className="testimonial-card p-8 flex flex-col h-full relative overflow-hidden">
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={16} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-slate-300 leading-relaxed text-sm flex-1 mb-6">
                  「{t.content}」
                </p>

                {/* Metric badge */}
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                               bg-${t.metricColor}-500/10 border border-${t.metricColor}-500/20
                               text-${t.metricColor}-400 text-xs font-black mb-6 w-fit`}>
                  <TrendingUp size={14} />
                  {t.metric}
                </div>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600
                                flex items-center justify-center text-white font-black text-sm">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.role} · {t.cert}</p>
                  </div>
                </div>
              </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

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
// 🎨 Premium Hero Section（超越 ViralArc 水準）
// ==========================================
const OptimizedHeroSection = ({ onFreeTrial, onWatchDemo, hasVideo }) => {
  return (
    <section aria-label="Ultra Advisor 主視覺" className="relative min-h-screen bg-[#030712] flex items-center justify-center px-4 py-20 overflow-hidden noise-overlay">

      {/* ✨ Interactive Particle Field */}
      <ParticleField count={60} />

      {/* Animated grid background */}
      <div className="absolute inset-0 grid-glow-bg pointer-events-none" />

      {/* Floating gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="hero-orb-1 absolute top-[5%] left-[10%] w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-[180px]" />
        <div className="hero-orb-2 absolute bottom-[5%] right-[5%] w-[700px] h-[700px] bg-purple-600/12 rounded-full blur-[200px]" />
        <div className="hero-orb-3 absolute top-[40%] left-[50%] -translate-x-1/2 w-[500px] h-[500px] bg-cyan-500/8 rounded-full blur-[150px]" />
        {/* Extra subtle orb for depth */}
        <div className="hero-orb-2 absolute top-[60%] left-[20%] w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Aurora overlay */}
      <div className="absolute inset-0 aurora-bg pointer-events-none" />

      {/* Radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,transparent_0%,#030712_100%)] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto text-center space-y-10">

        {/* Badge — Line 1 */}
        <div className="hero-reveal-line" style={{animationDelay: '0.2s'}}>
          <span className="inline-flex items-center gap-2 px-5 py-2 bg-blue-500/10 border border-blue-500/20
                           rounded-full text-blue-400 text-xs font-black uppercase tracking-[0.3em]">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            超過 500 位顧問正在使用
          </span>
        </div>

        {/* Headline — Line 2 (stagger) */}
        <div className="hero-reveal-line" style={{animationDelay: '0.45s'}}>
          <h1 data-speakable="true" className="text-5xl md:text-7xl lg:text-[5.5rem] font-black text-white
                         leading-[1.05] tracking-[-0.03em]">
            讓數據
            <br className="md:hidden" />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400
                           bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-text">
              替你說話
            </span>
          </h1>
        </div>

        {/* Subtitle — Line 3 */}
        <div className="hero-reveal-line" style={{animationDelay: '0.7s'}}>
          <p data-speakable="true" className="text-lg md:text-2xl text-slate-400 font-medium tracking-wide max-w-2xl mx-auto leading-relaxed">
            見客戶前 3 分鐘，準備好專業提案
            <br className="hidden md:block" />
            <Typewriter
              texts={['客戶看到圖表：「這也太專業了吧！」', '60 篇文章幫你經營專業形象', '每天自動產出社群素材', '一鍵分析，報表自動生成']}
              className="text-blue-400 font-bold text-glow-blue"
              speed={70}
              pause={2500}
            />
          </p>
        </div>

        {/* Stats cards — Line 4 */}
        <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto hero-reveal-line"
             style={{animationDelay: '0.95s'}}>
          {[
            { icon: BarChart3, text: "視覺化工具任你用", end: 18, suffix: " 種", color: "blue" },
            { icon: Clock, text: "原本 3 小時的提案準備", end: 15, suffix: " 分鐘搞定", color: "amber" },
            { icon: FileBarChart, text: "篇專業文章免費用", end: 60, suffix: "+", color: "emerald" }
          ].map((item, i) => (
            <TiltCard key={i} intensity={15}>
              <div className="glass-card rounded-2xl p-5 text-center group relative overflow-hidden">
                <item.icon className={`text-${item.color}-400 mx-auto mb-2 group-hover:scale-110 transition-transform`} size={22} />
                <p className={`text-${item.color}-400 text-2xl font-black font-mono mb-1`}>
                  <CountUp end={item.end} suffix={item.suffix} duration={1800} />
                </p>
                <p className="text-slate-500 text-xs font-bold">{item.text}</p>
              </div>
            </TiltCard>
          ))}
        </div>

        {/* CTA — Line 5 */}
        <div className="flex flex-col md:flex-row gap-4 justify-center items-center hero-reveal-line" style={{animationDelay: '1.15s'}}>
          <MagneticButton
            onClick={onFreeTrial}
            className="btn-shimmer group relative px-10 py-5 bg-gradient-to-r from-blue-600 to-blue-500
                     text-white rounded-2xl font-black text-lg
                     shadow-[0_0_50px_rgba(59,130,246,0.4),0_0_100px_rgba(59,130,246,0.15)]
                     hover:shadow-[0_0_60px_rgba(59,130,246,0.6),0_0_120px_rgba(59,130,246,0.25)]
                     transition-all duration-500 hover:-translate-y-1.5 flex items-center gap-3"
            strength={0.35}>
            <Sparkles className="group-hover:rotate-12 transition-transform duration-300" size={24} />
            免費試用 18 種工具
            <ArrowRight className="group-hover:translate-x-1.5 transition-transform duration-300" size={20} />
          </MagneticButton>

          <MagneticButton
            onClick={() => {
              window.history.pushState({}, '', '/calculator');
              window.location.reload();
            }}
            className="btn-shimmer group px-10 py-5 bg-white/[0.04] border border-white/10
                     text-white rounded-2xl font-black text-lg
                     hover:bg-white/[0.08] hover:border-white/20
                     transition-all duration-500 hover:-translate-y-1.5 flex items-center gap-3"
            strength={0.35}>
            <Calculator className="group-hover:rotate-12 transition-transform duration-300" size={24} />
            先試玩房貸計算機（免註冊）
            <ArrowRight className="group-hover:translate-x-1.5 transition-transform duration-300" size={20} />
          </MagneticButton>
        </div>

        {/* Trust line — Line 6 */}
        <p className="text-slate-600 text-sm hero-reveal-line font-medium tracking-wider" style={{animationDelay: '1.35s'}}>
          ✓ 不需信用卡 &nbsp;&nbsp; ✓ 完整功能 &nbsp;&nbsp; ✓ 隨時取消
        </p>

        {/* Watch demo */}
        <div className="animate-fade-in" style={{animationDelay: '0.85s'}}>
          <button
            onClick={onWatchDemo}
            className={`group px-6 py-3 bg-white/[0.03] border border-white/10 hover:border-white/20
                     text-slate-400 hover:text-white rounded-xl font-bold hover:bg-white/[0.06] transition-all duration-300
                     flex items-center gap-2 mx-auto backdrop-blur-sm ${hasVideo ? '' : 'opacity-50'}`}
          >
            <PlayCircle size={18} className="group-hover:text-blue-400 transition-colors" />
            觀看 60 秒產品示範
          </button>
        </div>

      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#030712] to-transparent pointer-events-none" />
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
    <Reveal>
      <div className="bg-[#030712]/80 backdrop-blur-xl border-y border-white/[0.04] py-5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-12 text-sm">
            {/* 在線人數 */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
              </div>
              <span className="text-slate-500">
                目前 <span className="text-emerald-400 font-bold">{stats.onlineNow}</span> 人在線
              </span>
            </div>

            <div className="w-px h-4 bg-white/10 hidden md:block" />

            {/* 註冊用戶 */}
            <div className="flex items-center gap-2 text-slate-500">
              <Users size={16} className="text-blue-400" />
              <span>
                <span className="text-white font-bold">{stats.totalUsers}+</span> 位用戶使用中
              </span>
            </div>

            <div className="w-px h-4 bg-white/10 hidden md:block" />

            {/* 累計試算 */}
            <div className="flex items-center gap-2 text-slate-500">
              <BarChart3 size={16} className="text-amber-400" />
              <span>
                累計 <span className="text-white font-bold">{stats.totalCalculations.toLocaleString()}+</span> 次試算
              </span>
            </div>

            <div className="w-px h-4 bg-white/10 hidden md:block" />

            {/* 今日新增（動態） */}
            <div className="hidden md:flex items-center gap-2 text-slate-500">
              <TrendingUp size={16} className="text-purple-400" />
              <span>
                今日 <span className="text-white font-bold">+{Math.floor(Math.random() * 40) + 15}</span> 次使用
              </span>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
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
    <section className="py-24 bg-[#030712] relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/[0.04] rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 relative">
        <Reveal>
          <div className="text-center mb-14">
            <span className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20
                           text-blue-400 text-xs font-black uppercase tracking-[0.4em]
                           rounded-full">
              Live Preview
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-white mt-6 tracking-tight">
              實際產品畫面
            </h2>
            <p className="text-slate-500 mt-4">
              所見即所得，真實呈現每天使用的工具介面
            </p>
          </div>
        </Reveal>

        {/* 輪播區域 */}
        <Reveal delay={150}>
        <div className="relative">
          {/* 主要截圖 */}
          <div className="relative aspect-[16/9] bg-slate-900/50 rounded-2xl border border-white/[0.06]
                         overflow-hidden shadow-[0_0_80px_rgba(59,130,246,0.08)]">
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
        </Reveal>

      </div>
    </section>
  );
};

// ==========================================
// 🛠️ 精簡產品展示（Step 02 — 銷售）
// ==========================================
const CompactProductShowcase = () => {
  const toolCategories = [
    {
      title: '幫客戶累積資產',
      icon: Rocket,
      color: 'blue',
      count: 4,
      tools: [
        '百萬禮物計畫 — 算每月存多少，20年給孩子一百萬',
        '學貸活化試算 — 學貸要不要提早還？算給你看',
        '房產財務分析 — 買房前幫客戶算清楚所有費用',
        '超積極存錢法 — 用圖表激勵客戶開始存錢',
      ],
    },
    {
      title: '幫客戶守住資產',
      icon: ShieldCheck,
      color: 'emerald',
      count: 3,
      tools: [
        '大小水庫系統 — 緊急預備金 + 長期儲蓄雙層防護',
        '五年換車計畫 — 不用一次拿出大筆錢也能換車',
        '退休缺口試算 — 退休要準備多少？一目了然',
      ],
    },
    {
      title: '幫客戶傳承財富',
      icon: Landmark,
      color: 'purple',
      count: 3,
      tools: [
        '稅務傳承試算 — 遺產稅、贈與稅怎麼省最多',
        '流動性缺口分析 — 資產夠不夠繳遺產稅',
        '長照準備金 — 長期照護要花多少錢',
      ],
    },
    {
      title: '即時市場數據',
      icon: Activity,
      color: 'red',
      count: 4,
      tools: [
        '戰情室儀表板 — 台股、美股、匯率一次看',
        '基金時光機 — 回測基金過去績效',
        '通膨影響試算 — 30年後的100萬只值多少',
        '黃金保險箱 — 用圖表解釋保險觀念',
      ],
    },
  ];

  return (
    <section id="products" aria-label="18 種視覺化銷售工具" className="py-32 bg-[#030712] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 glow-divider" />
      <div className="absolute top-[20%] right-[10%] w-[500px] h-[500px] bg-blue-600/[0.04] rounded-full blur-[180px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative">
        <Reveal>
          <div className="text-center mb-16">
            <span className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20
                           text-blue-400 text-xs font-black uppercase tracking-[0.4em]
                           rounded-full">
              銷售利器 — 18 種工具
            </span>
            <h2 data-speakable="true" className="text-4xl md:text-5xl font-black text-white mt-8 tracking-[-0.02em]">
              打開圖表，
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">客戶自己就看懂了</span>
            </h2>
            <p className="text-slate-500 text-lg mt-6 max-w-2xl mx-auto">
              不用再口說解釋半天。輸入數字、秀出圖表，客戶的反應通常是：「這也太清楚了吧！」
            </p>
          </div>
        </Reveal>

        {/* ⭐ 兩大明星功能 */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {[
            {
              icon: HeartPulse,
              title: 'AI 保單健診系統',
              desc: '客戶問「我保險買夠了嗎？」— 把保單拍照上傳，AI 自動整理，直接告訴你哪裡不夠',
              features: ['拍照就能辨識保單內容', '自動算出保障缺口在哪', '產出專業分析報告給客戶看'],
              gradient: 'from-rose-500 to-pink-500',
              color: 'rose',
            },
            {
              icon: Users,
              title: '互動式家庭圖系統',
              desc: '一家五口的保單怎麼管？拖拉建立家族圖，每個人的保障一目了然，客戶一看就驚艷',
              features: ['拖拉就能建立家族關係圖', '每個家人的保單綁在一起看', '全家保障缺口一張圖搞定'],
              gradient: 'from-cyan-500 to-blue-500',
              color: 'cyan',
            },
          ].map((feature, i) => (
            <Reveal key={i} delay={i * 120}>
              <TiltCard intensity={10} className="h-full">
                <div className="glass-card holo-card rounded-2xl p-8 h-full relative overflow-hidden">
                  {/* 明星標記 */}
                  <div className="absolute top-4 right-4 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500
                                 text-slate-900 rounded-full font-black text-[10px] uppercase tracking-wider
                                 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                    Star Feature
                  </div>

                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient}
                                 flex items-center justify-center mb-6
                                 shadow-[0_0_30px_rgba(59,130,246,0.2)]`}>
                    <feature.icon size={28} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-3">{feature.title}</h3>
                  <p className="text-slate-400 mb-6 leading-relaxed">{feature.desc}</p>
                  <div className="space-y-2">
                    {feature.features.map((f, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <CheckCircle2 className={`text-${feature.color}-400`} size={14} />
                        <span className="text-slate-300 text-sm">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>

        {/* 4 大工具分類 grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {toolCategories.map((cat, i) => (
            <Reveal key={cat.title} delay={i * 80}>
              <div className="glass-card rounded-2xl p-6 text-center group hover:border-blue-500/20">
                <div className={`w-12 h-12 mx-auto mb-4 bg-${cat.color}-600/10 rounded-xl
                               flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <cat.icon className={`text-${cat.color}-400`} size={24} />
                </div>
                <h4 className="text-white font-black mb-1">{cat.title}</h4>
                <p className="text-slate-500 text-xs mb-3">{cat.count} 種工具</p>
                <div className="space-y-1">
                  {cat.tools.map((t, j) => (
                    <p key={j} className="text-slate-400 text-xs">{t}</p>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="text-center">
            <button className="btn-shimmer px-10 py-4 bg-gradient-to-r from-blue-600 to-blue-500
                             text-white rounded-2xl font-black text-lg
                             shadow-[0_0_50px_rgba(59,130,246,0.4),0_0_100px_rgba(59,130,246,0.15)]
                             hover:shadow-[0_0_60px_rgba(59,130,246,0.6),0_0_120px_rgba(59,130,246,0.25)]
                             transition-all duration-500 hover:-translate-y-1.5 inline-flex items-center gap-3">
              <Sparkles size={24} />
              免費試用全部 18 種工具
              <ArrowRight size={20} />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

// ==========================================
// 📊 社會證明區塊
// ==========================================
const RealSocialProof = () => {
  return (
    <section className="py-32 bg-[#030712] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 glow-divider" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/[0.03] rounded-full blur-[200px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative">

        <Reveal>
        <div className="text-center mb-20">
          <span className="px-4 py-1.5 bg-purple-500/10 border border-purple-500/20
                         text-purple-400 text-xs font-black uppercase tracking-[0.4em]
                         rounded-full">
            Social Proof
          </span>
          <h2 className="text-4xl md:text-6xl font-black text-white mt-8 tracking-[-0.02em]">
            百位專業用戶信賴的 AI 平台
          </h2>
          <p className="text-slate-500 text-lg mt-6 max-w-2xl mx-auto leading-relaxed">
            每一個功能都來自第一線用戶的實戰回饋。目前已有 <strong className="text-blue-400">500+ 位用戶</strong> 使用，
            累計產出 <strong className="text-amber-400">30,000+ 份</strong> 視覺化報表，
            平均每月節省 <strong className="text-emerald-400">15 小時</strong> 試算時間。
          </p>
        </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {[
            {
              label: "使用者",
              value: "500+",
              desc: "專業理財用戶",
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
            <Reveal key={i} delay={i * 120}>
            <TiltCard intensity={12}>
            <div className="glass-card holo-card rounded-[2rem]
                           p-10 text-center relative overflow-hidden">
              <div className={`w-14 h-14 bg-${stat.color}-600/10 rounded-2xl
                             flex items-center justify-center mx-auto mb-6`}>
                <stat.icon className={`text-${stat.color}-400`} size={28} />
              </div>
              <div className={`text-5xl font-black text-${stat.color}-400 mb-3 font-mono tracking-tight`}>
                {stat.value === '500+' && <CountUp end={500} suffix="+" duration={2500} />}
                {stat.value === '30,000+' && <CountUp end={30000} suffix="+" duration={3000} />}
                {stat.value === '15 hrs' && <><CountUp end={15} duration={2000} /> hrs</>}
              </div>
              <div className="text-white font-bold text-lg mb-2">{stat.label}</div>
              <p className="text-slate-600 text-sm">{stat.desc}</p>
            </div>
            </TiltCard>
            </Reveal>
          ))}
        </div>

      </div>
    </section>
  );
};

/* PricingSection 已移除 — 正式上線不展示價格 */
const _PricingSection_OLD = ({ onSelectPlan }) => {
  void onSelectPlan;
  return (
    <section id="pricing" className="py-32 bg-slate-950 hidden">
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
                  "無限次數檔案建立",
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
// 📚 知識庫預覽區塊
// ==========================================
const KnowledgeBasePreview = () => {
  const categoryMap = {
    mortgage: '房貸知識',
    retirement: '退休規劃',
    tax: '稅務傳承',
    investment: '投資理財',
    tools: '工具教學',
    sales: '理財觀點',
  };

  // 取最新 3 篇文章（按 publishDate 倒序）
  const latestArticles = [...blogArticles]
    .sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate))
    .slice(0, 3);

  return (
    <section aria-label="理財知識庫" className="py-32 bg-[#030712] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 glow-divider" />
      <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-blue-600/[0.03] rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative">
        <Reveal>
        <div className="text-center mb-16">
          <span className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20
                         text-emerald-400 text-xs font-black uppercase tracking-[0.4em]
                         rounded-full">
            獲客利器 — 知識庫
          </span>
          <h2 data-speakable="true" className="text-4xl md:text-5xl font-black text-white mt-8 tracking-[-0.02em]">
            不用自己寫文章，
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">直接分享就好</span>
          </h2>
          <p className="text-slate-500 text-lg mt-6 max-w-2xl mx-auto">
            {blogArticles.length}+ 篇持照顧問審閱的專業文章，涵蓋房貸、退休、保險、稅務。
            <br className="hidden md:block" />
            轉發給客戶看，不會有推銷感，客戶還會主動回你：「這篇寫得好！」
          </p>
        </div>
        </Reveal>

        {/* 知識庫價值亮點 */}
        <Reveal delay={50}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { num: `${blogArticles.length}+`, label: '篇專業文章', color: 'emerald' },
            { num: '6', label: '大分類主題', color: 'blue' },
            { num: '0', label: '推銷感', color: 'purple' },
            { num: '100%', label: '可轉發給客戶', color: 'amber' },
          ].map((item, i) => (
            <div key={i} className="glass-card rounded-xl p-4 text-center">
              <p className={`text-${item.color}-400 text-2xl font-black mb-1`}>{item.num}</p>
              <p className="text-slate-500 text-xs font-bold">{item.label}</p>
            </div>
          ))}
        </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {latestArticles.map((article, i) => (
            <Reveal key={article.id} delay={i * 100}>
            <button
              onClick={() => {
                window.history.pushState({}, '', `/blog/${article.slug}`);
                window.location.reload();
              }}
              className="text-left glass-card holo-card rounded-2xl p-6 w-full group"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/10">
                  {categoryMap[article.category] || article.category}
                </span>
                <span className="text-xs text-slate-600">{article.publishDate}</span>
              </div>
              <h3 className="text-white font-bold text-lg mb-3 leading-snug group-hover:text-blue-400 transition-colors duration-300 line-clamp-2">
                {article.title}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">
                {article.excerpt}
              </p>
            </button>
            </Reveal>
          ))}
        </div>

        <Reveal delay={300}>
        <div className="text-center">
          <button
            onClick={() => {
              window.history.pushState({}, '', '/blog');
              window.location.reload();
            }}
            className="px-8 py-4 bg-white/[0.03] border border-white/[0.08] hover:border-blue-500/30
                     text-slate-300 rounded-2xl font-bold hover:bg-white/[0.06] transition-all duration-300
                     inline-flex items-center gap-2 backdrop-blur-sm"
          >
            <FileText size={18} />
            查看全部 {blogArticles.length}+ 篇文章
            <ArrowRight size={16} />
          </button>
        </div>
        </Reveal>
      </div>
    </section>
  );
};

// ==========================================
// 💡 每日財商限時動態展示區塊
// ==========================================
const DailyFinancialStoryPreview = () => {
  const todayQuote = getTodayQuote();
  const todayBg = getTodayBackground();
  const todayDate = formatDateChinese();

  return (
    <section className="py-32 bg-[#030712] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 glow-divider" />
      <div className="absolute top-[30%] left-[5%] w-[400px] h-[400px] bg-purple-600/[0.04] rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative">
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* 左側：說明文字 */}
          <Reveal>
          <div>
            <span className="px-4 py-1.5 bg-purple-500/10 border border-purple-500/20
                           text-purple-400 text-xs font-black uppercase tracking-[0.4em]
                           rounded-full">
              獲客利器 — 每日限動
            </span>
            <h2 data-speakable="true" className="text-4xl md:text-5xl font-black text-white mt-8 tracking-[-0.02em] leading-tight">
              不知道社群發什麼？
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-text">
                我們每天幫你準備好
              </span>
            </h2>
            <p className="text-slate-500 text-lg mt-6 leading-relaxed">
              每天打開 App，今天的限動素材已經幫你做好了。
              精美圖片 + 理財金句，一鍵下載分享到 IG、LINE、FB。
              <br className="hidden md:block" />
              <span className="text-slate-400 font-bold">讓客戶覺得你每天都很認真在經營，其實你只花了 10 秒。</span>
            </p>

            <div className="mt-8 space-y-4">
              {[
                { icon: Sparkles, text: "200+ 句精選金句，每天自動換新，永遠不重複", color: "purple" },
                { icon: Smartphone, text: "精美風景圖 + 金句排版，直接當限時動態發", color: "blue" },
                { icon: Globe, text: "一鍵下載，分享到 LINE、IG、FB、Threads", color: "emerald" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-10 h-10 bg-${item.color}-600/10 rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <item.icon className={`text-${item.color}-400`} size={20} />
                  </div>
                  <p className="text-slate-300 font-medium">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          </Reveal>

          {/* 右側：金句卡片預覽（模擬手機限時動態） */}
          <Reveal delay={200} scale>
          <div className="flex justify-center">
            <div className="relative w-[280px] rounded-3xl overflow-hidden
                           shadow-[0_0_60px_rgba(139,92,246,0.12),0_20px_60px_rgba(0,0,0,0.4)]
                           border border-white/10">
              {/* 9:16 比例容器 */}
              <div className="relative" style={{ paddingBottom: '177.78%' }}>
                {/* 風景背景 */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${todayBg.imageUrl})` }}
                />
                {/* 暗化遮罩 */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70" />

                {/* 內容 */}
                <div className="absolute inset-0 flex flex-col justify-between p-6">
                  {/* 頂部日期 */}
                  <div className="flex items-center gap-2 text-white/60 text-xs">
                    <Calendar size={12} />
                    <span>{todayDate}</span>
                  </div>

                  {/* 中間金句 */}
                  <div className="text-center">
                    <p className="text-white font-bold text-base leading-relaxed drop-shadow-lg">
                      「{todayQuote.text}」
                    </p>
                  </div>

                  {/* 底部品牌 */}
                  <div className="text-center">
                    <p className="text-white/40 text-xs font-bold tracking-widest">ULTRA ADVISOR</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </Reveal>

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
      <div className="bg-[#030712] text-white py-2.5 overflow-hidden whitespace-nowrap relative z-50 border-b border-white/[0.04]">
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
    <div className="min-h-screen dark:bg-[#030712] bg-slate-50 dark:text-white text-slate-900 font-sans transition-colors duration-300">
      {/* Skip Navigation — WCAG 2.1 Accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-bold">
        跳到主要內容
      </a>
      <ScrollProgressBar />
      <CursorGlow />

      {/* ✅ 動態公告橫幅 */}
      {showAnnouncement && dynamicContent.announcement?.enabled && (
        <AnnouncementBar 
          data={dynamicContent.announcement} 
          onClose={() => setShowAnnouncement(false)} 
        />
      )}

      <MarketTicker />

      {/* ✅ Header - 強化玻璃擬態 */}
      <header className={`sticky top-0 z-40 backdrop-blur-2xl border-b transition-all duration-500
                        ${isScrolled
                          ? 'dark:bg-[#030712]/90 bg-white/95 dark:border-white/[0.06] border-slate-200 shadow-[0_4px_40px_rgba(0,0,0,0.3),0_0_40px_rgba(59,130,246,0.05)]'
                          : 'dark:bg-[#030712]/60 bg-white/80 dark:border-white/[0.03] border-slate-100'}`}>
        <div className={`max-w-7xl mx-auto px-6 flex justify-between items-center transition-all duration-500
                       ${isScrolled ? 'py-2' : 'py-4'}`}>
          <div className="flex items-center gap-3 cursor-pointer relative" 
               onClick={handleLogoClick}
               title={clickCount > 0 ? `再點 ${5 - clickCount} 次進入管理後台` : ''}>
            <img
              src={logoError ? "https://placehold.co/40x40/3b82f6/white?text=UA" : LOGO_URL}
              alt="Ultra Advisor - 專業理財數據視覺化平台 Logo"
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

      <main id="main-content" role="main">
        <OptimizedHeroSection
          onFreeTrial={handleFreeTrial}
          onWatchDemo={handleWatchDemo}
          hasVideo={hasVideo}
        />

        {/* ==================== 即時統計欄 ==================== */}
        <LiveStatsBar />

        {/* ==================== 三步驟銷售流程（獲客→銷售→成交）==================== */}
        <CustomerJourneySection />

        {/* ==================== 獲客：知識庫 ==================== */}
        <KnowledgeBasePreview />

        {/* ==================== 獲客：每日限動 ==================== */}
        <DailyFinancialStoryPreview />

        {/* ==================== 實際產品畫面（先看到長什麼樣）==================== */}
        <ProductScreenshotCarousel />

        {/* ==================== 銷售：18 種視覺化工具 ==================== */}
        <CompactProductShowcase />

        {/* ==================== AI 幫你省時間 ==================== */}
        <AITechSection />

        {/* ==================== 成交：專業報表 ==================== */}
        <AutoReportSection />

        {/* ==================== 信任標誌區塊 ==================== */}
        <section className="py-20 bg-[#030712] relative">
          <div className="glow-divider mb-20" />
          <div className="max-w-6xl mx-auto px-6">
            <Reveal>
            <p className="text-slate-600 text-xs font-bold text-center uppercase tracking-[0.3em] mb-10">
              專業認證 & 技術合作夥伴
            </p>
            {/* 專業證照 */}
            <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6 mb-8">
              {['RFC', 'CHRP', 'FCHFP', 'CFP'].map((cert) => (
                <div key={cert} className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-full
                                          hover:border-amber-500/20 transition-all duration-300">
                  <Award size={16} className="text-amber-400" />
                  <span className="font-black text-sm text-slate-400">{cert}</span>
                </div>
              ))}
            </div>
            <p className="text-slate-600 text-xs text-center mb-4">
              團隊持有 RFC、CHRP、FCHFP、CFP 等國際財務規劃證照，所有工具與內容皆經專業審核
            </p>
            </Reveal>
          </div>
        </section>

        {/* ==================== Tech Partner Logo Marquee ==================== */}
        <TechPartnerMarquee />

        <RealSocialProof />

        {/* ==================== 真人見證 ==================== */}
        <TestimonialsSection />

        {/* ==================== FAQ 常見問題 ==================== */}
        <section id="faq" aria-label="常見問題" className="py-32 bg-[#030712] relative">
          <div className="absolute top-0 left-0 right-0 glow-divider" />
          <div className="max-w-4xl mx-auto px-6">
            <Reveal>
            <div className="text-center mb-16">
              <span className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20
                             text-emerald-400 text-xs font-black uppercase tracking-[0.4em]
                             rounded-full">
                FAQ
              </span>
              <h2 className="text-4xl md:text-5xl font-black text-white mt-8 tracking-[-0.02em]">
                常見問題
              </h2>
              <p className="text-slate-500 text-lg mt-6">
                還有其他問題？歡迎透過 LINE 官方帳號聯繫我們
              </p>
            </div>
            </Reveal>

            <div className="space-y-4">
              {[
                {
                  q: "免費試用需要綁定信用卡嗎？",
                  a: "不需要！註冊後即可免費試用 7 天完整功能，不需要提供任何付款資訊。試用期結束後，系統會自動轉為免費版，不會自動扣款。"
                },
                {
                  q: "資料安全嗎？會不會被外洩？",
                  a: "我們使用 Google Firebase 雲端服務，所有資料皆經過加密傳輸與儲存，符合金融等級的資安標準。您的資料只有您自己可以存取。"
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
                  a: "是的！傲創計算機是完全免費的公開工具，不需要註冊就可以使用。任何人都可以免費使用。"
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
                <Reveal key={i} delay={i * 60}>
                <details
                  className="group glass-card rounded-2xl hover:border-blue-500/10"
                >
                  <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                    <span className="text-white font-bold text-lg pr-4">{item.q}</span>
                    <ChevronRight
                      size={20}
                      className="text-slate-600 group-open:rotate-90 transition-transform duration-200 flex-shrink-0"
                    />
                  </summary>
                  <div className="grid grid-rows-[0fr] group-open:grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out">
                    <div className="overflow-hidden">
                      <div className="px-6 pb-6 pt-0">
                        <p className="text-slate-400 leading-relaxed">{item.a}</p>
                      </div>
                    </div>
                  </div>
                </details>
                </Reveal>
              ))}
            </div>

            <Reveal delay={500}>
            <div className="mt-12 text-center">
              <p className="text-slate-600 mb-4">還有其他問題？</p>
              <a
                href={LINE_OFFICIAL_ACCOUNT}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#06C755] hover:bg-[#05b34c]
                         text-white rounded-xl font-bold transition-all duration-300
                         shadow-[0_0_30px_rgba(6,199,85,0.2)] hover:shadow-[0_0_40px_rgba(6,199,85,0.3)]"
              >
                <MessageSquare size={20} />
                LINE 聯繫客服
              </a>
            </div>
            </Reveal>
          </div>
        </section>

        <section className="py-32 bg-[#030712] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 glow-divider" />
          {/* Dramatic background glow for final CTA */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/[0.06] rounded-full blur-[200px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-600/[0.05] rounded-full blur-[150px] pointer-events-none" />

          <Reveal>
          <div className="max-w-4xl mx-auto text-center px-6 relative">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-8 leading-tight tracking-[-0.02em]">
              明天見客戶，
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400
                             bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient-text">
                你準備好了嗎？
              </span>
            </h2>
            <p className="text-slate-500 text-xl mb-12">
              500+ 位保險業務已經在用，免費試用 7 天，不需信用卡
            </p>
            <MagneticButton
              onClick={handleFreeTrial}
              className="btn-shimmer px-12 py-6 bg-gradient-to-r from-blue-600 to-blue-500
                       text-white rounded-2xl font-black text-xl
                       shadow-[0_0_60px_rgba(59,130,246,0.4),0_0_120px_rgba(59,130,246,0.15)]
                       hover:shadow-[0_0_80px_rgba(59,130,246,0.6),0_0_160px_rgba(59,130,246,0.25)]
                       transition-all duration-500 hover:-translate-y-2 inline-flex items-center gap-3"
              strength={0.4}>
              <Sparkles size={28} />
              免費體驗視覺化工具
              <ArrowRight size={24} />
            </MagneticButton>
            <p className="text-slate-600 text-sm mt-6 tracking-wider">
              ✓ 7 天免費 &nbsp;&nbsp; ✓ 不需信用卡 &nbsp;&nbsp; ✓ 隨時可取消
            </p>
          </div>
          </Reveal>
        </section>
      </main>

      {/* ==================== 完整 Footer ==================== */}
      <footer className="bg-[#020617] border-t border-white/[0.04]">
        {/* 主要 Footer 內容 */}
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-4 gap-12">

            {/* 公司資訊 */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-6">
                <img
                  src={logoError ? "https://placehold.co/32x32/3b82f6/white?text=UA" : LOGO_URL}
                  alt="Ultra Advisor - 專業理財數據視覺化平台 Logo"
                  className="h-8 w-auto"
                  loading="lazy"
                  decoding="async"
                />
                <span className="text-lg font-black">
                  <span style={{color: '#FF3A3A'}}>Ultra</span>
                  <span className="text-blue-400">Advisor</span>
                </span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
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
            <nav aria-label="產品功能">
              <h4 className="text-white font-black text-sm uppercase tracking-wider mb-6">產品功能</h4>
              <ul className="space-y-3">
                {[
                  { name: '傲創計算機', href: '/calculator', highlight: true },
                  { name: '創富工具', href: '/#products' },
                  { name: '守富工具', href: '/#products' },
                  { name: '傳富工具', href: '/#products' },
                  { name: '戰情室數據', href: '/#products' },
                ].map((item, i) => (
                  <li key={i}>
                    <a
                      href={item.href}
                      onClick={(e) => {
                        if (item.href.startsWith('/#')) {
                          e.preventDefault();
                          document.getElementById('products')?.scrollIntoView({behavior: 'smooth'});
                        }
                      }}
                      className={`text-sm transition-colors flex items-center gap-2
                        ${item.highlight
                          ? 'text-emerald-400 hover:text-emerald-300 font-bold'
                          : 'text-slate-400 hover:text-slate-300'}`}
                    >
                      {item.highlight && <Sparkles size={14} />}
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {/* 關於我們 */}
            <nav aria-label="關於我們">
              <h4 className="text-white font-black text-sm uppercase tracking-wider mb-6">關於我們</h4>
              <ul className="space-y-3">
                {[
                  { name: '知識庫', href: '/blog', highlight: true },
                  { name: '成功案例', href: '/#testimonials' },
                  { name: '常見問題', href: '/#faq' },
                  { name: '聯絡客服', href: LINE_OFFICIAL_ACCOUNT, external: true },
                  { name: 'Ultra Lab（技術服務）', href: 'https://ultralab.tw/', external: true },
                ].map((item, i) => (
                  <li key={i}>
                    <a
                      href={item.href}
                      {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      onClick={(e) => {
                        if (item.href.startsWith('/#')) {
                          e.preventDefault();
                          const anchor = item.href.replace('/#', '');
                          document.getElementById(anchor)?.scrollIntoView({behavior: 'smooth'});
                        }
                      }}
                      className={`text-sm transition-colors flex items-center gap-2
                        ${item.highlight
                          ? 'text-purple-400 hover:text-purple-300 font-bold'
                          : 'text-slate-400 hover:text-slate-300'}`}
                    >
                      {item.highlight && <FileText size={14} />}
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

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
            <p className="text-slate-500 text-xs">
              © 2026 UltraAdvisor. All rights reserved. 專業財務視覺化解決方案
            </p>
            <nav className="flex items-center gap-6 text-xs" aria-label="法律聲明">
              <a href="/privacy" className="text-slate-500 hover:text-slate-300 transition-colors">隱私權政策</a>
              <a href="/terms" className="text-slate-500 hover:text-slate-300 transition-colors">服務條款</a>
              <a href="/disclaimer" className="text-slate-500 hover:text-slate-300 transition-colors">免責聲明</a>
            </nav>
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