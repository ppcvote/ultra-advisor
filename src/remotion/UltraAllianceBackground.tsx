/**
 * Ultra Alliance - 粒子連結網絡背景動畫
 *
 * 概念：三個核心節點（財務顧問、合作店家、顧問客戶）形成三角形生態系統
 * 粒子在節點間流動，呈現三方共贏的動態連結
 *
 * 配色採用傲創思維風格：
 * - Cyber Cyan: #00f2ff
 * - Neon Purple: #8B5CF6
 * - Emerald: #10b981
 * - Gold accent: #ffcc00
 */

import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// ============================================
// 顏色配置
// ============================================
const COLORS = {
  advisor: '#8B5CF6',    // 紫色 - 財務顧問
  store: '#00f2ff',      // Cyber Cyan - 合作店家
  client: '#10b981',     // 綠色 - 顧問客戶
  gold: '#ffcc00',       // 金色點綴
  background: '#050b14', // 深色背景
};

// ============================================
// 節點位置（三角形配置）
// ============================================
const getNodePositions = (width: number, height: number) => {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.3;

  return {
    // 頂點 - 財務顧問
    advisor: {
      x: centerX,
      y: centerY - radius * 0.8,
      color: COLORS.advisor,
      label: '財務顧問',
    },
    // 左下 - 合作店家
    store: {
      x: centerX - radius * 0.9,
      y: centerY + radius * 0.6,
      color: COLORS.store,
      label: '合作店家',
    },
    // 右下 - 顧問客戶
    client: {
      x: centerX + radius * 0.9,
      y: centerY + radius * 0.6,
      color: COLORS.client,
      label: '顧問客戶',
    },
  };
};

// ============================================
// 核心節點元件
// ============================================
const CoreNode: React.FC<{
  x: number;
  y: number;
  color: string;
  delay?: number;
  size?: number;
}> = ({ x, y, color, delay = 0, size = 80 }) => {
  const frame = useCurrentFrame();

  // 脈動效果
  const pulse = 1 + Math.sin((frame - delay) * 0.05) * 0.1;
  const glowIntensity = 0.4 + Math.sin((frame - delay) * 0.08) * 0.2;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}40 0%, ${color}20 50%, transparent 70%)`,
        transform: `scale(${pulse})`,
        boxShadow: `
          0 0 ${30 * glowIntensity}px ${color}60,
          0 0 ${60 * glowIntensity}px ${color}40,
          0 0 ${100 * glowIntensity}px ${color}20,
          inset 0 0 ${20 * glowIntensity}px ${color}30
        `,
        border: `2px solid ${color}60`,
      }}
    >
      {/* 內部核心 */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: size * 0.4,
          height: size * 0.4,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color} 0%, ${color}80 100%)`,
          boxShadow: `0 0 20px ${color}`,
        }}
      />
    </div>
  );
};

// ============================================
// 連結線元件
// ============================================
const ConnectionLine: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color1: string;
  color2: string;
  delay?: number;
}> = ({ x1, y1, x2, y2, color1, color2, delay = 0 }) => {
  const frame = useCurrentFrame();

  const opacity = 0.3 + Math.sin((frame - delay) * 0.03) * 0.1;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <linearGradient id={`grad-${x1}-${y1}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color1} stopOpacity={opacity} />
          <stop offset="50%" stopColor={COLORS.gold} stopOpacity={opacity * 0.5} />
          <stop offset="100%" stopColor={color2} stopOpacity={opacity} />
        </linearGradient>
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={`url(#grad-${x1}-${y1})`}
        strokeWidth={2}
        strokeDasharray="8,4"
      />
    </svg>
  );
};

// ============================================
// 流動粒子元件
// ============================================
const FlowingParticle: React.FC<{
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  speed: number;
  offset: number;
  size?: number;
}> = ({ startX, startY, endX, endY, color, speed, offset, size = 6 }) => {
  const frame = useCurrentFrame();

  // 計算粒子在路徑上的位置（循環）
  const progress = ((frame * speed + offset) % 100) / 100;

  const x = interpolate(progress, [0, 1], [startX, endX]);
  const y = interpolate(progress, [0, 1], [startY, endY]);

  // 粒子透明度（中間最亮）
  const opacity = interpolate(progress, [0, 0.3, 0.7, 1], [0.2, 1, 1, 0.2]);

  // 尾跡效果
  const tailLength = 20;
  const tailProgress = Math.max(0, progress - 0.05);
  const tailX = interpolate(tailProgress, [0, 1], [startX, endX]);
  const tailY = interpolate(tailProgress, [0, 1], [startY, endY]);

  return (
    <>
      {/* 尾跡 */}
      <div
        style={{
          position: 'absolute',
          left: tailX,
          top: tailY,
          width: size * 3,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${color}60)`,
          transform: `rotate(${Math.atan2(y - tailY, x - tailX) * 180 / Math.PI}deg)`,
          transformOrigin: 'left center',
          opacity: opacity * 0.5,
        }}
      />
      {/* 粒子主體 */}
      <div
        style={{
          position: 'absolute',
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 ${size * 2}px ${color}, 0 0 ${size * 4}px ${color}60`,
          opacity,
        }}
      />
    </>
  );
};

// ============================================
// 背景漂浮粒子
// ============================================
const BackgroundParticles: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const particles = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => ({
      x: (i * 137.5) % width,
      y: (i * 97.3) % height,
      size: 1 + (i % 3),
      speed: 0.2 + (i % 5) * 0.1,
      opacity: 0.1 + (i % 4) * 0.05,
      hue: 180 + (i % 3) * 60, // 藍綠紫色系
    }));
  }, [width, height]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {particles.map((p, i) => {
        const y = (p.y + frame * p.speed) % height;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: y,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: `hsl(${p.hue}, 70%, 60%)`,
              opacity: p.opacity,
            }}
          />
        );
      })}
    </div>
  );
};

// ============================================
// 光暈效果
// ============================================
const GlowOrb: React.FC<{
  x: number;
  y: number;
  color: string;
  size: number;
  delay?: number;
}> = ({ x, y, color, size, delay = 0 }) => {
  const frame = useCurrentFrame();

  const scale = 1 + Math.sin((frame - delay) * 0.02) * 0.3;
  const opacity = 0.1 + Math.sin((frame - delay) * 0.015) * 0.05;

  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}30 0%, transparent 70%)`,
        transform: `scale(${scale})`,
        opacity,
        filter: 'blur(40px)',
      }}
    />
  );
};

// ============================================
// 主要組件
// ============================================
export const UltraAllianceBackground: React.FC = () => {
  const { width, height } = useVideoConfig();
  const nodes = getNodePositions(width, height);

  // 生成粒子路徑
  const particlePaths = useMemo(() => {
    const paths = [];

    // 顧問 → 店家
    for (let i = 0; i < 5; i++) {
      paths.push({
        startX: nodes.advisor.x,
        startY: nodes.advisor.y,
        endX: nodes.store.x,
        endY: nodes.store.y,
        color: COLORS.advisor,
        speed: 0.8 + i * 0.1,
        offset: i * 20,
      });
    }

    // 店家 → 客戶
    for (let i = 0; i < 5; i++) {
      paths.push({
        startX: nodes.store.x,
        startY: nodes.store.y,
        endX: nodes.client.x,
        endY: nodes.client.y,
        color: COLORS.store,
        speed: 0.7 + i * 0.12,
        offset: i * 20,
      });
    }

    // 客戶 → 顧問
    for (let i = 0; i < 5; i++) {
      paths.push({
        startX: nodes.client.x,
        startY: nodes.client.y,
        endX: nodes.advisor.x,
        endY: nodes.advisor.y,
        color: COLORS.client,
        speed: 0.9 + i * 0.08,
        offset: i * 20,
      });
    }

    // 反向流動（代表互惠）
    // 店家 → 顧問
    for (let i = 0; i < 3; i++) {
      paths.push({
        startX: nodes.store.x,
        startY: nodes.store.y,
        endX: nodes.advisor.x,
        endY: nodes.advisor.y,
        color: COLORS.store,
        speed: 0.6 + i * 0.15,
        offset: 50 + i * 25,
      });
    }

    // 客戶 → 店家
    for (let i = 0; i < 3; i++) {
      paths.push({
        startX: nodes.client.x,
        startY: nodes.client.y,
        endX: nodes.store.x,
        endY: nodes.store.y,
        color: COLORS.client,
        speed: 0.65 + i * 0.1,
        offset: 50 + i * 25,
      });
    }

    return paths;
  }, [nodes]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.background} 0%, #0a1628 50%, #050b14 100%)`,
        overflow: 'hidden',
      }}
    >
      {/* 背景光暈 */}
      <GlowOrb x={nodes.advisor.x} y={nodes.advisor.y} color={COLORS.advisor} size={400} delay={0} />
      <GlowOrb x={nodes.store.x} y={nodes.store.y} color={COLORS.store} size={350} delay={30} />
      <GlowOrb x={nodes.client.x} y={nodes.client.y} color={COLORS.client} size={350} delay={60} />

      {/* 背景漂浮粒子 */}
      <BackgroundParticles />

      {/* 連結線 */}
      <ConnectionLine
        x1={nodes.advisor.x}
        y1={nodes.advisor.y}
        x2={nodes.store.x}
        y2={nodes.store.y}
        color1={COLORS.advisor}
        color2={COLORS.store}
        delay={0}
      />
      <ConnectionLine
        x1={nodes.store.x}
        y1={nodes.store.y}
        x2={nodes.client.x}
        y2={nodes.client.y}
        color1={COLORS.store}
        color2={COLORS.client}
        delay={20}
      />
      <ConnectionLine
        x1={nodes.client.x}
        y1={nodes.client.y}
        x2={nodes.advisor.x}
        y2={nodes.advisor.y}
        color1={COLORS.client}
        color2={COLORS.advisor}
        delay={40}
      />

      {/* 流動粒子 */}
      {particlePaths.map((path, i) => (
        <FlowingParticle key={i} {...path} />
      ))}

      {/* 核心節點 */}
      <CoreNode x={nodes.advisor.x} y={nodes.advisor.y} color={COLORS.advisor} delay={0} size={70} />
      <CoreNode x={nodes.store.x} y={nodes.store.y} color={COLORS.store} delay={15} size={70} />
      <CoreNode x={nodes.client.x} y={nodes.client.y} color={COLORS.client} delay={30} size={70} />

      {/* 中心光點（代表生態核心） */}
      <div
        style={{
          position: 'absolute',
          left: width / 2 - 15,
          top: height / 2 + 20,
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.gold} 0%, ${COLORS.gold}60 40%, transparent 70%)`,
          boxShadow: `0 0 30px ${COLORS.gold}80, 0 0 60px ${COLORS.gold}40`,
        }}
      />
    </AbsoluteFill>
  );
};

export default UltraAllianceBackground;
