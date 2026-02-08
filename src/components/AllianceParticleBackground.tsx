/**
 * Ultra Alliance - 粒子連結網絡背景動畫
 *
 * 使用 Canvas 實現，不依賴 Remotion Player
 * 三個核心節點（財務顧問、合作店家、顧問客戶）形成三角形生態系統
 */

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  progress: number;
  color: string;
  size: number;
}

interface Node {
  x: number;
  y: number;
  color: string;
  pulsePhase: number;
}

const COLORS = {
  advisor: '#8B5CF6',    // 紫色 - 財務顧問
  store: '#00f2ff',      // Cyber Cyan - 合作店家
  client: '#10b981',     // 綠色 - 顧問客戶
  gold: '#ffcc00',       // 金色點綴
};

export const AllianceParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const nodesRef = useRef<Node[]>([]);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 設置 canvas 尺寸
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      // 重新計算節點位置
      initNodes(rect.width, rect.height);
      initParticles(rect.width, rect.height);
    };

    // 初始化節點
    const initNodes = (width: number, height: number) => {
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.28;

      nodesRef.current = [
        { x: centerX, y: centerY - radius * 0.7, color: COLORS.advisor, pulsePhase: 0 },
        { x: centerX - radius * 0.8, y: centerY + radius * 0.5, color: COLORS.store, pulsePhase: 2 },
        { x: centerX + radius * 0.8, y: centerY + radius * 0.5, color: COLORS.client, pulsePhase: 4 },
      ];
    };

    // 初始化粒子
    const initParticles = (width: number, height: number) => {
      const nodes = nodesRef.current;
      if (nodes.length < 3) return;

      const particles: Particle[] = [];
      const paths = [
        { from: 0, to: 1, color: COLORS.advisor },
        { from: 1, to: 2, color: COLORS.store },
        { from: 2, to: 0, color: COLORS.client },
        { from: 1, to: 0, color: COLORS.store },
        { from: 2, to: 1, color: COLORS.client },
        { from: 0, to: 2, color: COLORS.advisor },
      ];

      paths.forEach((path, pathIdx) => {
        for (let i = 0; i < 4; i++) {
          particles.push({
            x: nodes[path.from].x,
            y: nodes[path.from].y,
            targetX: nodes[path.to].x,
            targetY: nodes[path.to].y,
            speed: 0.003 + Math.random() * 0.002,
            progress: (i * 0.25 + pathIdx * 0.1) % 1,
            color: path.color,
            size: 2 + Math.random() * 2,
          });
        }
      });

      // 背景漂浮粒子
      for (let i = 0; i < 30; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          targetX: Math.random() * width,
          targetY: Math.random() * height,
          speed: 0.0005 + Math.random() * 0.001,
          progress: Math.random(),
          color: [COLORS.advisor, COLORS.store, COLORS.client][i % 3],
          size: 1 + Math.random(),
        });
      }

      particlesRef.current = particles;
    };

    // 繪製函數
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);
      frameRef.current++;

      const nodes = nodesRef.current;
      const particles = particlesRef.current;

      // 繪製連結線
      if (nodes.length >= 3) {
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        for (let i = 0; i < 3; i++) {
          const j = (i + 1) % 3;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // 繪製粒子
      particles.forEach((p, idx) => {
        // 更新粒子位置
        p.progress += p.speed;
        if (p.progress >= 1) {
          p.progress = 0;
          // 背景粒子重新隨機位置
          if (idx >= 24) {
            p.x = p.targetX;
            p.y = p.targetY;
            p.targetX = Math.random() * width;
            p.targetY = Math.random() * height;
          }
        }

        const currentX = p.x + (p.targetX - p.x) * p.progress;
        const currentY = p.y + (p.targetY - p.y) * p.progress;

        // 繪製粒子
        const alpha = idx < 24
          ? 0.3 + Math.sin(p.progress * Math.PI) * 0.7
          : 0.2;

        ctx.beginPath();
        ctx.arc(currentX, currentY, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();

        // 粒子光暈
        if (idx < 24) {
          ctx.beginPath();
          ctx.arc(currentX, currentY, p.size * 3, 0, Math.PI * 2);
          const gradient = ctx.createRadialGradient(
            currentX, currentY, 0,
            currentX, currentY, p.size * 3
          );
          gradient.addColorStop(0, p.color + '40');
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.globalAlpha = alpha * 0.5;
          ctx.fill();
        }
      });

      ctx.globalAlpha = 1;

      // 繪製節點
      nodes.forEach((node, idx) => {
        const pulse = 1 + Math.sin(frameRef.current * 0.03 + node.pulsePhase) * 0.15;
        const baseSize = 25;
        const size = baseSize * pulse;

        // 外圈光暈
        const gradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, size * 2
        );
        gradient.addColorStop(0, node.color + '30');
        gradient.addColorStop(0.5, node.color + '10');
        gradient.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(node.x, node.y, size * 2, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 節點邊框
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.strokeStyle = node.color + '60';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 節點核心
        ctx.beginPath();
        ctx.arc(node.x, node.y, size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
      });

      // 中心金色光點
      if (nodes.length >= 3) {
        const centerX = (nodes[0].x + nodes[1].x + nodes[2].x) / 3;
        const centerY = (nodes[0].y + nodes[1].y + nodes[2].y) / 3;
        const goldPulse = 1 + Math.sin(frameRef.current * 0.05) * 0.2;

        const goldGradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, 15 * goldPulse
        );
        goldGradient.addColorStop(0, COLORS.gold);
        goldGradient.addColorStop(0.5, COLORS.gold + '60');
        goldGradient.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(centerX, centerY, 15 * goldPulse, 0, Math.PI * 2);
        ctx.fillStyle = goldGradient;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
      }}
    />
  );
};

export default AllianceParticleBackground;
