import React, { useEffect, useRef, useState } from 'react';

interface UltraCloudLogoProps {
  size?: number;
  autoPlay?: boolean;
  showText?: boolean;
  onAnimationComplete?: () => void;
}

/**
 * UltraCloud Logo 動畫元件
 * 基於 Ultra Advisor 原始 LOGO，動畫最後變形成雲朵
 */
const UltraCloudLogo: React.FC<UltraCloudLogoProps> = ({
  size = 320,
  autoPlay = true,
  showText = true,
  onAnimationComplete,
}) => {
  const blueLineRef = useRef<SVGPathElement>(null);
  const redLineRef = useRef<SVGPathElement>(null);
  const purpleLineRef = useRef<SVGPathElement>(null);
  const cloudRef = useRef<SVGPathElement>(null);

  const [phase, setPhase] = useState<'idle' | 'drawing' | 'morphing' | 'complete'>('idle');
  const [showBlue, setShowBlue] = useState(false);
  const [showRed, setShowRed] = useState(false);
  const [showPurple, setShowPurple] = useState(false);
  const [showCloud, setShowCloud] = useState(false);
  const [hideOriginal, setHideOriginal] = useState(false);
  const [showTextState, setShowTextState] = useState(false);

  useEffect(() => {
    if (!autoPlay) return;

    // 初始化線條的 strokeDasharray 和 strokeDashoffset
    const paths = [blueLineRef.current, redLineRef.current, purpleLineRef.current];

    paths.forEach(path => {
      if (path) {
        const len = path.getTotalLength();
        path.style.strokeDasharray = `${len}`;
        path.style.strokeDashoffset = `${len}`;
        path.getBoundingClientRect();
      }
    });

    // 初始化雲朵
    if (cloudRef.current) {
      const cloudLen = cloudRef.current.getTotalLength();
      cloudRef.current.style.strokeDasharray = `${cloudLen}`;
      cloudRef.current.style.strokeDashoffset = `${cloudLen}`;
    }

    setPhase('drawing');

    // Phase 1: 繪製原始 LOGO（與 SplashScreen 相同）
    const t1 = setTimeout(() => setShowBlue(true), 200);
    const t2 = setTimeout(() => setShowRed(true), 600);
    const t3 = setTimeout(() => setShowPurple(true), 1000);

    // Phase 2: 開始變形動畫
    const t4 = setTimeout(() => {
      setPhase('morphing');
      setHideOriginal(true);
    }, 1800);

    // Phase 3: 顯示雲朵
    const t5 = setTimeout(() => {
      setShowCloud(true);
    }, 2000);

    // Phase 4: 顯示文字
    const t6 = setTimeout(() => {
      setShowTextState(true);
      setPhase('complete');
      onAnimationComplete?.();
    }, 2800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
    };
  }, [autoPlay, onAnimationComplete]);

  const scale = size / 320;

  return (
    <div className="flex flex-col items-center justify-center">
      <style>{`
        .logo-path {
          opacity: 0;
          transition: stroke-dashoffset 0.8s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.8s ease-in;
        }
        .anim-draw {
          stroke-dashoffset: 0 !important;
          opacity: 1 !important;
        }
        .glow-blue { filter: drop-shadow(0 0 12px rgba(46, 107, 255, 0.7)); }
        .glow-red { filter: drop-shadow(0 0 12px rgba(255, 58, 58, 0.7)); }
        .glow-cloud { filter: drop-shadow(0 0 20px rgba(77, 163, 255, 0.8)); }

        .morph-out {
          opacity: 0 !important;
          transform: scale(0.5) translateY(-20px);
          transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .cloud-path {
          opacity: 0;
          transform: scale(0.8);
          transition: stroke-dashoffset 1s cubic-bezier(0.25, 1, 0.5, 1),
                      opacity 0.6s ease-out,
                      transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .cloud-draw {
          stroke-dashoffset: 0 !important;
          opacity: 1 !important;
          transform: scale(1) !important;
        }

        .cloud-float {
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        .text-fade-in {
          opacity: 0;
          transform: translateY(10px);
          transition: all 0.6s ease-out;
        }
        .text-visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

      <div className="relative" style={{ width: size, height: size * 1.3 }}>
        <svg
          width={size}
          height={size * 1.3}
          viewBox="0 0 320 420"
          className="overflow-visible"
        >
          <defs>
            {/* 原始 LOGO 漸層 */}
            <linearGradient id="uc-gradBlue" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4DA3FF" />
              <stop offset="100%" stopColor="#2E6BFF" />
            </linearGradient>

            <linearGradient id="uc-gradRed" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FF6A6A" />
              <stop offset="100%" stopColor="#FF3A3A" />
            </linearGradient>

            <linearGradient id="uc-gradPurpleNode" gradientUnits="userSpaceOnUse" x1="91.5" y1="0" x2="228.5" y2="0">
              <stop offset="0%" stopColor="#8A5CFF" stopOpacity="0" />
              <stop offset="20%" stopColor="#CE4DFF" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#E8E0FF" stopOpacity="1" />
              <stop offset="80%" stopColor="#CE4DFF" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#8A5CFF" stopOpacity="0" />
            </linearGradient>

            {/* 雲朵漸層 - Ultra 風格 */}
            <linearGradient id="uc-cloudGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4DA3FF" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#CE4DFF" />
            </linearGradient>

            {/* 雲朵填充漸層 */}
            <linearGradient id="uc-cloudFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4DA3FF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.1" />
            </linearGradient>

            <filter id="uc-stretched-glow" filterUnits="userSpaceOnUse" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="15 2" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="
                0 0 0 0 0.6
                0 0 0 0 0.4
                0 0 0 0 1
                0 0 0 0.8 0" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="uc-cloud-glow">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 原始 LOGO 線條（會在變形時消失） */}
          <g className={hideOriginal ? 'morph-out' : ''} style={{ transformOrigin: 'center' }}>
            {/* Blue Curve */}
            <path
              ref={blueLineRef}
              d="M 90,40 C 90,160 130,220 242,380"
              fill="none"
              stroke="url(#uc-gradBlue)"
              strokeWidth="14"
              strokeLinecap="round"
              className={`logo-path glow-blue ${showBlue ? 'anim-draw' : ''}`}
            />

            {/* Red Curve */}
            <path
              ref={redLineRef}
              d="M 230,40 C 230,160 190,220 78,380"
              fill="none"
              stroke="url(#uc-gradRed)"
              strokeWidth="14"
              strokeLinecap="round"
              className={`logo-path glow-red ${showRed ? 'anim-draw' : ''}`}
            />

            {/* Purple Line */}
            <path
              ref={purpleLineRef}
              d="M 91.5,314 L 228.5,314"
              fill="none"
              stroke="url(#uc-gradPurpleNode)"
              strokeWidth="10.2"
              strokeLinecap="round"
              className={`logo-path ${showPurple ? 'anim-draw' : ''}`}
              style={{ filter: 'url(#uc-stretched-glow)', transitionDuration: '0.6s' }}
            />
          </g>

          {/* 雲朵 - 變形後顯示 */}
          <g
            className={`${showCloud ? 'cloud-float' : ''}`}
            style={{
              transformOrigin: '160px 200px',
            }}
          >
            {/* 雲朵填充 */}
            <path
              d="M 80,220
                 C 60,220 50,200 60,180
                 C 50,160 70,140 95,145
                 C 100,120 130,100 160,100
                 C 190,100 220,120 225,145
                 C 250,140 270,160 260,180
                 C 270,200 260,220 240,220
                 Z"
              fill="url(#uc-cloudFill)"
              className={`cloud-path ${showCloud ? 'cloud-draw' : ''}`}
              style={{ transitionDelay: '0.2s' }}
            />

            {/* 雲朵輪廓 */}
            <path
              ref={cloudRef}
              d="M 80,220
                 C 60,220 50,200 60,180
                 C 50,160 70,140 95,145
                 C 100,120 130,100 160,100
                 C 190,100 220,120 225,145
                 C 250,140 270,160 260,180
                 C 270,200 260,220 240,220
                 C 240,220 80,220 80,220"
              fill="none"
              stroke="url(#uc-cloudGradient)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`cloud-path glow-cloud ${showCloud ? 'cloud-draw' : ''}`}
              filter="url(#uc-cloud-glow)"
            />

            {/* 雲朵內部裝飾線條 - 呼應原始 LOGO */}
            <path
              d="M 100,180 C 120,170 140,175 160,170 C 180,165 200,170 220,180"
              fill="none"
              stroke="url(#uc-cloudGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              opacity={showCloud ? 0.5 : 0}
              style={{ transition: 'opacity 0.6s ease-out 0.4s' }}
            />

            {/* 小雲朵粒子效果 */}
            {showCloud && (
              <>
                <circle cx="90" cy="160" r="4" fill="#4DA3FF" opacity="0.6" className="cloud-float" style={{ animationDelay: '0.2s' }} />
                <circle cx="230" cy="165" r="3" fill="#8B5CF6" opacity="0.5" className="cloud-float" style={{ animationDelay: '0.5s' }} />
                <circle cx="160" cy="130" r="3" fill="#CE4DFF" opacity="0.4" className="cloud-float" style={{ animationDelay: '0.8s' }} />
              </>
            )}
          </g>
        </svg>
      </div>

      {/* 文字區域 */}
      {showText && (
        <div className={`text-center mt-4 text-fade-in ${showTextState ? 'text-visible' : ''}`}>
          <h1 className="text-2xl font-bold text-white tracking-widest m-0 leading-tight">
            ULTRA CLOUD
          </h1>
          <p className="text-[#4DA3FF] text-xs tracking-[0.25em] mt-2 font-medium">
            LINE 雲端檔案管理
          </p>
        </div>
      )}
    </div>
  );
};

export default UltraCloudLogo;
