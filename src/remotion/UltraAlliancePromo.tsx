/**
 * Ultra Alliance - 30秒招商宣傳影片 v4
 *
 * 絲滑風格：流暢過場、優雅動態、電影質感
 * - 場景之間 Cross-fade 過場
 * - 元素滑入滑出（不是硬切）
 * - 微妙縮放呼吸感
 * - 所有動畫使用 smooth easing
 */

import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';

// ============================================
// 顏色配置
// ============================================
const COLORS = {
  cyan: '#00f2ff',
  purple: '#a78bfa',
  emerald: '#34d399',
  gold: '#fbbf24',
  white: '#ffffff',
  gray: '#e2e8f0',
  darkGray: '#94a3b8',
};

// ============================================
// Smooth Easing 函數
// ============================================
const smoothEase = (t: number): number => {
  // Sine ease in-out - 非常絲滑
  return -(Math.cos(Math.PI * t) - 1) / 2;
};

const smoothEaseOut = (t: number): number => {
  return Math.sin((t * Math.PI) / 2);
};

// ============================================
// 場景過場控制器
// ============================================
interface SceneProps {
  startFrame: number;
  endFrame: number;
  fadeIn?: number;  // 淡入幀數
  fadeOut?: number; // 淡出幀數
  children: React.ReactNode;
}

const Scene: React.FC<SceneProps> = ({
  startFrame,
  endFrame,
  fadeIn = 30,
  fadeOut = 30,
  children,
}) => {
  const frame = useCurrentFrame();

  // 場景不在範圍內
  if (frame < startFrame - fadeIn || frame > endFrame + fadeOut) {
    return null;
  }

  // 計算淡入淡出
  let opacity = 1;
  let scale = 1;

  // 淡入（帶微縮放）
  if (frame < startFrame + fadeIn) {
    const progress = smoothEase(Math.max(0, (frame - startFrame) / fadeIn));
    opacity = progress;
    scale = 0.95 + progress * 0.05;
  }

  // 淡出（帶微縮放）
  if (frame > endFrame - fadeOut) {
    const progress = smoothEase(Math.max(0, (endFrame - frame) / fadeOut));
    opacity = Math.min(opacity, progress);
    scale = 1 + (1 - progress) * 0.03;
  }

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${scale})`,
        transition: 'none',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ============================================
// 絲滑文字元件
// ============================================
interface SilkTextProps {
  children: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  duration?: number;
  bold?: boolean;
  slideFrom?: 'bottom' | 'left' | 'right' | 'none';
  slideDistance?: number;
}

const SilkText: React.FC<SilkTextProps> = ({
  children,
  delay = 0,
  fontSize = 72,
  color = COLORS.white,
  duration = 120,
  bold = true,
  slideFrom = 'bottom',
  slideDistance = 40,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - delay;

  if (localFrame < 0 || localFrame > duration) return null;

  // 入場動畫（前 25 幀）
  const enterProgress = smoothEaseOut(Math.min(1, localFrame / 25));

  // 出場動畫（後 25 幀）
  const exitStart = duration - 25;
  const exitProgress = localFrame > exitStart
    ? 1 - smoothEaseOut(Math.min(1, (localFrame - exitStart) / 25))
    : 1;

  const opacity = enterProgress * exitProgress;

  // 位移計算
  let translateX = 0;
  let translateY = 0;

  if (slideFrom === 'bottom') {
    translateY = slideDistance * (1 - enterProgress) - slideDistance * 0.3 * (1 - exitProgress);
  } else if (slideFrom === 'left') {
    translateX = -slideDistance * (1 - enterProgress) + slideDistance * 0.3 * (1 - exitProgress);
  } else if (slideFrom === 'right') {
    translateX = slideDistance * (1 - enterProgress) - slideDistance * 0.3 * (1 - exitProgress);
  }

  return (
    <div
      style={{
        fontSize,
        color,
        fontWeight: bold ? 800 : 500,
        transform: `translate(${translateX}px, ${translateY}px)`,
        opacity,
        textAlign: 'center',
        lineHeight: 1.3,
        textShadow: '0 4px 30px rgba(0,0,0,0.6)',
        letterSpacing: bold ? '-0.02em' : '0.02em',
      }}
    >
      {children}
    </div>
  );
};

// ============================================
// 絲滑數字計數器
// ============================================
const SilkCounter: React.FC<{
  target: number;
  suffix?: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  duration?: number;
}> = ({ target, suffix = '', delay = 0, fontSize = 120, color = COLORS.white, duration = 100 }) => {
  const frame = useCurrentFrame();
  const localFrame = frame - delay;

  if (localFrame < 0 || localFrame > duration) return null;

  // 數字增長動畫（緩慢開始，快速結束）
  const countProgress = smoothEase(Math.min(1, localFrame / 35));
  const current = Math.floor(target * countProgress);

  // 整體淡入淡出
  const enterProgress = smoothEaseOut(Math.min(1, localFrame / 20));
  const exitStart = duration - 20;
  const exitProgress = localFrame > exitStart
    ? 1 - smoothEaseOut((localFrame - exitStart) / 20)
    : 1;

  const opacity = enterProgress * exitProgress;
  const scale = 0.9 + enterProgress * 0.1;
  const translateY = 30 * (1 - enterProgress);

  return (
    <div
      style={{
        fontSize,
        fontWeight: 900,
        color,
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        textShadow: '0 4px 40px rgba(0,0,0,0.5)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        letterSpacing: '-0.03em',
      }}
    >
      {current}{suffix}
    </div>
  );
};

// ============================================
// 柔和漂浮粒子
// ============================================
const FloatingParticles: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      x: (i * 97 + 50) % width,
      y: (i * 137 + 100) % height,
      size: 2 + (i % 3) * 1.5,
      speed: 0.15 + (i % 4) * 0.08,
      opacity: 0.1 + (i % 3) * 0.08,
      color: [COLORS.purple, COLORS.cyan, COLORS.emerald][i % 3],
    }));
  }, [width, height]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {particles.map((p, i) => {
        const y = (p.y + frame * p.speed) % (height + 50) - 25;
        const wobble = Math.sin(frame * 0.02 + i) * 10;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x + wobble,
              top: y,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: p.color,
              opacity: p.opacity,
              filter: 'blur(1px)',
            }}
          />
        );
      })}
    </div>
  );
};

// ============================================
// Logo 動畫
// ============================================
const AnimatedLogo: React.FC<{ delay?: number; scale?: number; duration?: number }> = ({
  delay = 0,
  scale = 1,
  duration = 120,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - delay;

  if (localFrame < 0 || localFrame > duration) return null;

  // 繪製進度
  const drawProgress = smoothEaseOut(Math.min(1, localFrame / 30));

  // 整體淡入淡出
  const enterOpacity = smoothEaseOut(Math.min(1, localFrame / 20));
  const exitStart = duration - 25;
  const exitOpacity = localFrame > exitStart
    ? 1 - smoothEaseOut((localFrame - exitStart) / 25)
    : 1;

  const opacity = enterOpacity * exitOpacity;
  const logoScale = scale * (0.9 + enterOpacity * 0.1);

  const blueLength = 450;
  const redLength = 450;
  const purpleLength = 140;

  return (
    <div style={{ opacity, transform: `scale(${logoScale})` }}>
      <svg
        width={240}
        height={300}
        viewBox="0 0 320 420"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="logoBlue" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="logoRed" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="logoPurple" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <path
          d="M 90,40 C 90,160 130,220 242,380"
          fill="none"
          stroke="url(#logoBlue)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={blueLength}
          strokeDashoffset={blueLength * (1 - drawProgress)}
        />
        <path
          d="M 230,40 C 230,160 190,220 78,380"
          fill="none"
          stroke="url(#logoRed)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={redLength}
          strokeDashoffset={redLength * (1 - drawProgress)}
        />
        <path
          d="M 91.5,314 L 228.5,314"
          fill="none"
          stroke="url(#logoPurple)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={purpleLength}
          strokeDashoffset={purpleLength * (1 - Math.max(0, (drawProgress - 0.6) * 2.5))}
        />
      </svg>
    </div>
  );
};

// ============================================
// 三角生態系統
// ============================================
const EcosystemTriangle: React.FC<{ delay?: number; duration?: number }> = ({
  delay = 0,
  duration = 200,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const localFrame = frame - delay;

  if (localFrame < 0 || localFrame > duration) return null;

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 200;

  const nodes = [
    { x: centerX, y: centerY - radius * 0.75, color: COLORS.purple, label: '財務顧問' },
    { x: centerX - radius * 0.85, y: centerY + radius * 0.5, color: COLORS.cyan, label: '合作店家' },
    { x: centerX + radius * 0.85, y: centerY + radius * 0.5, color: COLORS.emerald, label: '顧問客戶' },
  ];

  // 整體淡入淡出
  const enterProgress = smoothEaseOut(Math.min(1, localFrame / 30));
  const exitStart = duration - 30;
  const exitProgress = localFrame > exitStart
    ? 1 - smoothEaseOut((localFrame - exitStart) / 30)
    : 1;
  const masterOpacity = enterProgress * exitProgress;

  // 線條繪製進度
  const lineProgress = smoothEase(Math.min(1, localFrame / 40));

  // 節點出現進度
  const nodeProgress = smoothEaseOut(Math.min(1, Math.max(0, (localFrame - 20) / 30)));

  // 標籤出現進度
  const labelProgress = smoothEaseOut(Math.min(1, Math.max(0, (localFrame - 45) / 25)));

  // 中心文字
  const centerTextProgress = smoothEaseOut(Math.min(1, Math.max(0, (localFrame - 65) / 20)));

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: masterOpacity }}>
      {/* 連結線 */}
      <svg style={{ position: 'absolute', inset: 0 }}>
        {[[0, 1], [1, 2], [2, 0]].map(([i, j], idx) => {
          const len = Math.sqrt(
            Math.pow(nodes[j].x - nodes[i].x, 2) +
            Math.pow(nodes[j].y - nodes[i].y, 2)
          );
          const prog = smoothEase(Math.max(0, Math.min(1, (lineProgress - idx * 0.15) / 0.7)));

          return (
            <line
              key={idx}
              x1={nodes[i].x}
              y1={nodes[i].y}
              x2={nodes[j].x}
              y2={nodes[j].y}
              stroke={COLORS.gray}
              strokeWidth={2}
              strokeDasharray={len}
              strokeDashoffset={len * (1 - prog)}
              opacity={0.4}
            />
          );
        })}
      </svg>

      {/* 節點 */}
      {nodes.map((node, idx) => {
        const prog = smoothEaseOut(Math.max(0, Math.min(1, (nodeProgress - idx * 0.15) / 0.7)));
        const scale = prog;
        const nodeOpacity = prog;

        return (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: node.x,
              top: node.y,
              transform: `translate(-50%, -50%) scale(${scale})`,
              opacity: nodeOpacity,
            }}
          >
            {/* 外圈光暈 */}
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${node.color}30 0%, ${node.color}10 60%, transparent 100%)`,
                border: `2px solid ${node.color}60`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* 核心 */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: node.color,
                  boxShadow: `0 0 30px ${node.color}80`,
                }}
              />
            </div>

            {/* 標籤 */}
            <div
              style={{
                position: 'absolute',
                top: 100,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 24,
                fontWeight: 700,
                color: COLORS.white,
                textShadow: '0 2px 15px rgba(0,0,0,0.8)',
                whiteSpace: 'nowrap',
                opacity: labelProgress,
              }}
            >
              {node.label}
            </div>
          </div>
        );
      })}

      {/* 中心「三方共贏」*/}
      <div
        style={{
          position: 'absolute',
          left: centerX,
          top: centerY + 20,
          transform: `translate(-50%, -50%) scale(${0.8 + centerTextProgress * 0.2})`,
          opacity: centerTextProgress,
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: COLORS.gold,
            textShadow: `0 0 30px ${COLORS.gold}60, 0 2px 20px rgba(0,0,0,0.8)`,
          }}
        >
          三方共贏
        </div>
      </div>
    </div>
  );
};

// ============================================
// 權益列表
// ============================================
const BenefitsList: React.FC<{ delay?: number; duration?: number }> = ({
  delay = 0,
  duration = 180,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - delay;

  if (localFrame < 0 || localFrame > duration) return null;

  const benefits = [
    { icon: '🌐', text: '品牌官網建置', color: COLORS.cyan },
    { icon: '🎬', text: '傲創思維影片', color: COLORS.purple },
    { icon: '📍', text: '平台曝光導流', color: COLORS.emerald },
    { icon: '💰', text: '穩定優質客源', color: COLORS.gold },
  ];

  // 整體淡出
  const exitStart = duration - 30;
  const exitProgress = localFrame > exitStart
    ? 1 - smoothEaseOut((localFrame - exitStart) / 30)
    : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, opacity: exitProgress }}>
      {benefits.map((b, idx) => {
        const itemDelay = idx * 12;
        const itemFrame = localFrame - itemDelay;
        if (itemFrame < 0) return null;

        const itemProgress = smoothEaseOut(Math.min(1, itemFrame / 20));
        const slideX = 60 * (1 - itemProgress);

        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              opacity: itemProgress,
              transform: `translateX(${-slideX}px)`,
            }}
          >
            <span style={{ fontSize: 44 }}>{b.icon}</span>
            <span
              style={{
                fontSize: 34,
                fontWeight: 700,
                color: COLORS.white,
                textShadow: '0 2px 15px rgba(0,0,0,0.7)',
              }}
            >
              {b.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// 漸層背景（有呼吸感）
// ============================================
const BreathingBackground: React.FC = () => {
  const frame = useCurrentFrame();

  // 緩慢呼吸的背景色調
  const hueShift = Math.sin(frame * 0.003) * 5;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(
          ${135 + hueShift}deg,
          #0f172a 0%,
          #1e1b4b 40%,
          #1a1333 70%,
          #0f172a 100%
        )`,
      }}
    />
  );
};

// ============================================
// 主要影片組件 - 30秒絲滑版
// ============================================
export const UltraAlliancePromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  // 時間軸（30秒 = 1800幀 @ 60fps）
  // Scene 1: 痛點      0-180 (0-3s)
  // Scene 2: 品牌    150-330 (2.5-5.5s)
  // Scene 3: 數據    300-540 (5-9s)
  // Scene 4: 生態    510-810 (8.5-13.5s)
  // Scene 5: 權益    780-1080 (13-18s)
  // Scene 6: 目標   1050-1320 (17.5-22s)
  // Scene 7: CTA    1290-1800 (21.5-30s)

  return (
    <AbsoluteFill
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* 呼吸背景 */}
      <BreathingBackground />

      {/* 漂浮粒子 */}
      <FloatingParticles />

      {/* ===== Scene 1: 痛點 (0-3s) ===== */}
      <Scene startFrame={0} endFrame={180} fadeIn={0} fadeOut={40}>
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <SilkText delay={20} fontSize={44} color={COLORS.darkGray} duration={130} bold={false} slideFrom="bottom">
            你的店，缺的不是裝潢
          </SilkText>
          <div style={{ height: 30 }} />
          <SilkText delay={50} fontSize={76} color={COLORS.white} duration={110} slideFrom="bottom" slideDistance={50}>
            缺的是對的客人
          </SilkText>
        </AbsoluteFill>
      </Scene>

      {/* ===== Scene 2: 品牌 (2.5-5.5s) ===== */}
      <Scene startFrame={150} endFrame={330} fadeIn={40} fadeOut={40}>
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <AnimatedLogo delay={0} scale={0.6} duration={160} />
          <div style={{ height: 25 }} />
          <SilkText delay={40} fontSize={68} color={COLORS.white} duration={120} slideFrom="bottom">
            傲創聯盟
          </SilkText>
          <SilkText delay={60} fontSize={22} color={COLORS.purple} duration={100} bold={false} slideFrom="none">
            ULTRA ALLIANCE
          </SilkText>
        </AbsoluteFill>
      </Scene>

      {/* ===== Scene 3: 數據 (5-9s) ===== */}
      <Scene startFrame={300} endFrame={540} fadeIn={40} fadeOut={40}>
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <SilkText delay={0} fontSize={26} color={COLORS.darkGray} duration={200} bold={false} slideFrom="none">
            我們擁有
          </SilkText>
          <div style={{ height: 15 }} />
          <SilkCounter target={100} suffix="+" delay={20} fontSize={150} color={COLORS.white} duration={180} />
          <div style={{ height: 10 }} />
          <SilkText delay={50} fontSize={44} color={COLORS.white} duration={150} slideFrom="bottom" slideDistance={30}>
            位財務顧問會員
          </SilkText>
          <div style={{ height: 50 }} />
          <SilkText delay={90} fontSize={28} color={COLORS.emerald} duration={110} bold={false} slideFrom="bottom" slideDistance={20}>
            消費習慣優良 · 每月帶客 10+ 位
          </SilkText>
        </AbsoluteFill>
      </Scene>

      {/* ===== Scene 4: 三贏生態 (8.5-13.5s) ===== */}
      <Scene startFrame={510} endFrame={810} fadeIn={40} fadeOut={40}>
        <AbsoluteFill>
          <div style={{
            position: 'absolute',
            top: 60,
            width: '100%',
            textAlign: 'center',
          }}>
            <SilkText delay={0} fontSize={40} color={COLORS.white} duration={260} slideFrom="none">
              創客島嶼生態鏈
            </SilkText>
          </div>
          <EcosystemTriangle delay={30} duration={240} />
        </AbsoluteFill>
      </Scene>

      {/* ===== Scene 5: 權益 (13-18s) ===== */}
      <Scene startFrame={780} endFrame={1080} fadeIn={40} fadeOut={40}>
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: 140, alignItems: 'flex-start' }}>
            <div>
              <SilkText delay={0} fontSize={34} color={COLORS.cyan} duration={260} slideFrom="left">
                合作店家專屬權益
              </SilkText>
              <div style={{ height: 45 }} />
              <BenefitsList delay={30} duration={220} />
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 100,
            }}>
              <SilkText delay={120} fontSize={56} color={COLORS.emerald} duration={140} slideFrom="right">
                免費加入
              </SilkText>
              <div style={{ height: 15 }} />
              <SilkText delay={150} fontSize={28} color={COLORS.darkGray} duration={110} bold={false} slideFrom="right">
                零風險 · 零成本
              </SilkText>
            </div>
          </div>
        </AbsoluteFill>
      </Scene>

      {/* ===== Scene 6: 目標 (17.5-22s) ===== */}
      <Scene startFrame={1050} endFrame={1320} fadeIn={40} fadeOut={40}>
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: 120, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <SilkCounter target={100} suffix="家" delay={0} fontSize={110} color={COLORS.white} duration={230} />
              <SilkText delay={40} fontSize={24} color={COLORS.darkGray} duration={180} bold={false} slideFrom="none">
                目標合作店家
              </SilkText>
            </div>

            {/* 分隔線 */}
            <div
              style={{
                width: 2,
                height: 140,
                background: `linear-gradient(180deg, transparent, ${COLORS.purple}80, transparent)`,
                opacity: smoothEaseOut(Math.min(1, Math.max(0, (frame - 1070) / 30))),
              }}
            />

            <div style={{ textAlign: 'center' }}>
              <SilkText delay={30} fontSize={90} color={COLORS.white} duration={200} slideFrom="right" slideDistance={60}>
                台中
              </SilkText>
              <SilkText delay={60} fontSize={24} color={COLORS.darkGray} duration={170} bold={false} slideFrom="none">
                優先拓展區域
              </SilkText>
            </div>
          </div>
        </AbsoluteFill>
      </Scene>

      {/* ===== Scene 7: CTA (21.5-30s) ===== */}
      <Scene startFrame={1290} endFrame={1800} fadeIn={40} fadeOut={0}>
        <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <AnimatedLogo delay={0} scale={0.5} duration={480} />
          <div style={{ height: 20 }} />
          <SilkText delay={35} fontSize={56} color={COLORS.white} duration={450} slideFrom="bottom" slideDistance={30}>
            傲創聯盟
          </SilkText>
          <div style={{ height: 50 }} />

          {/* CTA 按鈕 - 絲滑出現 */}
          {(() => {
            const btnFrame = frame - 1390;
            if (btnFrame < 0) return null;
            const btnProgress = smoothEaseOut(Math.min(1, btnFrame / 30));
            const btnScale = 0.9 + btnProgress * 0.1;

            return (
              <div
                style={{
                  opacity: btnProgress,
                  transform: `scale(${btnScale}) translateY(${20 * (1 - btnProgress)}px)`,
                  background: `linear-gradient(90deg, ${COLORS.purple}, #6366f1)`,
                  padding: '24px 80px',
                  borderRadius: 60,
                  fontSize: 38,
                  fontWeight: 800,
                  color: COLORS.white,
                  boxShadow: `0 10px 40px ${COLORS.purple}50`,
                }}
              >
                申請成為合作夥伴
              </div>
            );
          })()}

          <div style={{ height: 60 }} />

          {/* 聯絡資訊 */}
          {(() => {
            const infoFrame = frame - 1480;
            if (infoFrame < 0) return null;
            const infoProgress = smoothEaseOut(Math.min(1, infoFrame / 30));

            return (
              <div
                style={{
                  opacity: infoProgress,
                  transform: `translateY(${15 * (1 - infoProgress)}px)`,
                  display: 'flex',
                  gap: 100,
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, color: COLORS.darkGray, marginBottom: 10 }}>官網</div>
                  <div style={{ fontSize: 26, color: COLORS.white, fontWeight: 600 }}>
                    ultra-advisor.tw/alliance
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, color: COLORS.darkGray, marginBottom: 10 }}>LINE</div>
                  <div style={{ fontSize: 26, color: COLORS.emerald, fontWeight: 600 }}>
                    @ultraadvisor
                  </div>
                </div>
              </div>
            );
          })()}
        </AbsoluteFill>
      </Scene>

      {/* 底部浮水印 */}
      <div
        style={{
          position: 'absolute',
          bottom: 25,
          right: 35,
          opacity: 0.35,
          color: COLORS.darkGray,
          fontSize: 13,
          letterSpacing: '0.05em',
        }}
      >
        ULTRA ADVISOR © 2026
      </div>
    </AbsoluteFill>
  );
};

export default UltraAlliancePromo;
