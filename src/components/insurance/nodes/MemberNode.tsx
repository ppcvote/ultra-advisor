/**
 * React Flow 自定義節點 — 家系圖成員
 *
 * 男 = 方形（rounded-md）  女 = 圓形（rounded-full）
 * 主被保人 = 金色粗框 + ☀
 * 單擊 → 展開 +配偶 / +子女 / +父母 / 刪除 泡泡
 * 雙擊 → 打開完整編輯表單
 */
import React, { memo, useState, useRef, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Sun, Heart, Baby, Users, Trash2 } from 'lucide-react';
import type { FamilyMember } from '../../../types/insurance';
import { RELATION_LABELS } from '../../../types/insurance';

export interface MemberNodeData {
  member: FamilyMember;
  policyCount: number;
  isSelected: boolean;
  onEdit: (id: string) => void;
  onSelect: (id: string) => void;
  onQuickAdd?: (memberId: string, position: 'spouse' | 'child' | 'parent') => void;
  onDelete?: (memberId: string) => void;
}

function MemberNode({ data }: NodeProps<MemberNodeData>) {
  const { member, policyCount, onEdit, onSelect, onQuickAdd, onDelete } = data;
  const [showBubbles, setShowBubbles] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMale = member.gender === 'male';
  const isMain = member.isMainInsured;
  const hasSpouse = !!member.spouseId;
  const parentCount = member.parentIds?.length || 0;

  // ─── 單擊 = 展開泡泡、雙擊 = 編輯 ───
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setShowBubbles(false);
      onEdit(member.id);
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        setShowBubbles(prev => !prev);
        onSelect(member.id);
      }, 300);
    }
  }, [member.id, onEdit, onSelect]);

  // ─── 節點大小 ───
  const SIZE = 80;
  const shapeClass = isMale ? 'rounded-md' : 'rounded-full';
  const borderColor = isMain ? 'border-amber-400' : 'border-slate-300';
  const bgColor = isMale ? 'bg-blue-50' : 'bg-pink-50';
  const shadowClass = isMain ? 'shadow-lg shadow-amber-400/30' : '';
  const relationLabel = RELATION_LABELS[member.relationship as keyof typeof RELATION_LABELS] || member.relationship;

  return (
    <div className="nodrag nopan" style={{ overflow: 'visible', position: 'relative' }}>
      {/* 連接點放在外層，不受 overflow 影響 */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !border-0" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-400 !border-0" />
      <Handle type="source" position={Position.Right} id="spouse-out" className="!w-3 !h-3 !bg-rose-400 !border-0" />
      <Handle type="target" position={Position.Left} id="spouse-in" className="!w-3 !h-3 !bg-rose-400 !border-0" />

      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* 主被保人光芒 */}
        {isMain && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
            <Sun size={18} className="text-amber-500" />
          </div>
        )}

        {/* 節點本體 */}
        <div
          className={`
            w-full h-full cursor-pointer select-none
            border-[3px] ${borderColor} ${bgColor} ${shapeClass} ${shadowClass}
            flex flex-col items-center justify-center
            hover:shadow-md transition-shadow
            ${member.isDeceased ? 'opacity-50' : ''}
          `}
          onClick={handleClick}
        >
          {member.isDeceased && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[120%] h-[2px] bg-slate-600 rotate-45 absolute" />
            </div>
          )}
          <span className="text-[11px] text-slate-500 font-medium leading-none">
            {relationLabel}
          </span>
          {member.name && member.name !== '新成員' && (
            <span className="text-[10px] text-slate-700 font-bold mt-0.5 truncate max-w-[70px]">
              {member.name}
            </span>
          )}
          <span className={`text-[9px] mt-0.5 font-medium ${policyCount > 0 ? 'text-emerald-600' : 'text-rose-400'}`}>
            {policyCount > 0 ? `${policyCount} 張` : '無保單'}
          </span>
        </div>
      </div>

      {/* 泡泡放在節點外面，使用 nodrag + nopan class 防止 React Flow 攔截 */}
      {showBubbles && onQuickAdd && (
        <div className="nodrag nopan" style={{
          position: 'absolute',
          top: -12, left: -16, right: -16, bottom: -12,
          pointerEvents: 'none',
          zIndex: 50,
        }}>
          {parentCount < 2 && (
            <button
              style={{ pointerEvents: 'auto', position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }}
              className="nodrag nopan flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold shadow-lg hover:bg-indigo-600 whitespace-nowrap"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setShowBubbles(false); onQuickAdd(member.id, 'parent'); }}
            >
              <Users size={11} /> 父母
            </button>
          )}
          {!hasSpouse && (
            <button
              style={{ pointerEvents: 'auto', position: 'absolute', top: '50%', right: -48, transform: 'translateY(-50%)' }}
              className="nodrag nopan flex items-center gap-1 px-2 py-1 rounded-full bg-rose-500 text-white text-[10px] font-bold shadow-lg hover:bg-rose-600 whitespace-nowrap"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setShowBubbles(false); onQuickAdd(member.id, 'spouse'); }}
            >
              <Heart size={11} /> 配偶
            </button>
          )}
          <button
            style={{ pointerEvents: 'auto', position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)' }}
            className="nodrag nopan flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-lg hover:bg-emerald-600 whitespace-nowrap"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setShowBubbles(false); onQuickAdd(member.id, 'child'); }}
          >
            <Baby size={11} /> 子女
          </button>
          {!isMain && onDelete && (
            <button
              style={{ pointerEvents: 'auto', position: 'absolute', top: '50%', left: -36, transform: 'translateY(-50%)' }}
              className="nodrag nopan flex items-center gap-1 px-2 py-1 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-lg hover:bg-red-600 whitespace-nowrap"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setShowBubbles(false); onDelete(member.id); }}
            >
              <Trash2 size={11} /> 刪除
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(MemberNode);
