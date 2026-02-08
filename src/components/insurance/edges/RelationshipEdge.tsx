/**
 * React Flow 自定義邊 — 家庭關係連線（Genogram 風格）
 *
 * 婚姻關係：水平紅色實線 ──
 * 親子關係：垂直灰色直角線 ┬─┴（從 source 下方中點 → 中間水平 → target 上方中點）
 */
import React from 'react';
import { EdgeProps, getStraightPath, useNodes } from 'reactflow';

export type RelationshipType = 'spouse' | 'parent-child';

export interface RelationshipEdgeData {
  relationshipType: RelationshipType;
  spouseId?: string; // 用於計算夫妻中心點
}

export default function RelationshipEdge({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style = {},
}: EdgeProps<RelationshipEdgeData>) {
  const isSpouse = data?.relationshipType === 'spouse';
  const nodes = useNodes();

  if (isSpouse) {
    // 配偶：水平直線
    const [edgePath] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
    return (
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={{
          stroke: '#f43f5e',
          strokeWidth: 2,
          fill: 'none',
          ...style,
        }}
      />
    );
  }

  // 親子：如果 source 有配偶，從夫妻連線中間往下延伸
  let startX = sourceX;
  let startY = sourceY;

  if (data?.spouseId) {
    const spouseNode = nodes.find(n => n.id === data.spouseId);
    const sourceNode = nodes.find(n => n.id === source);
    if (spouseNode && sourceNode) {
      // 夫妻中心 = (source node center + spouse node center) / 2
      const NODE_SIZE = 80;
      const sourceCenterX = sourceNode.position.x + NODE_SIZE / 2;
      const spouseCenterX = spouseNode.position.x + NODE_SIZE / 2;
      startX = (sourceCenterX + spouseCenterX) / 2;
      // startY 保持在 source 下方
      startY = sourceNode.position.y + NODE_SIZE + 5; // 節點底部稍下
    }
  }

  // 直角折線：startX, startY → startX, midY → targetX, midY → targetX, targetY
  const midY = (startY + targetY) / 2;
  const d = `M ${startX} ${startY} L ${startX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={d}
      style={{
        stroke: '#64748b',
        strokeWidth: 1.5,
        fill: 'none',
        ...style,
      }}
    />
  );
}
