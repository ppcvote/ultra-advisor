/**
 * 家庭圖建立模組（Step 1）
 * React Flow 視覺化家系圖
 *
 * 互動：
 * - 點擊節點 → 出現 +配偶 / +子女 / +父母 / 刪除 泡泡
 * - 泡泡點擊 → 選性別即新增（名字不強制）
 * - 長按節點 → 打開完整編輯表單
 *
 * 佈局規則：
 * - 夫妻：男左女右，水平配對
 * - 子女：從父母連線中間往下延伸，多子女自適應間距
 * - 關係推定：
 *   - 某人的配偶 → 如果該人是「父」，配偶自動為「母」（反之亦然）
 *   - 父母新增子女 → 自動為本人的「兄弟」或「姊妹」
 */
import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Users, ArrowRight, Plus, Trash2,
  Save, X, CheckSquare, Square, FileText,
} from 'lucide-react';
import MemberNode from './nodes/MemberNode';
import RelationshipEdge from './edges/RelationshipEdge';
import { useFamilyTree } from '../../hooks/useFamilyTree';
import { usePolicies } from '../../hooks/usePolicies';
import type { FamilyMember, Gender, RelationType } from '../../types/insurance';
import { RELATION_LABELS } from '../../types/insurance';

const nodeTypes = { member: MemberNode };
const edgeTypes = { relationship: RelationshipEdge };

interface FamilyTreeBuilderProps {
  userId?: string;
  clientId?: string;
  onNext: () => void;
  familyTreeId?: string;
  onTreeSelect?: (treeId: string) => void;
}

interface QuickAddState {
  sourceId: string;
  position: 'spouse' | 'child' | 'parent';
}

interface MemberFormData {
  name: string;
  relationship: RelationType;
  gender: Gender;
  birthDate: string;
  annualIncome: string;
  occupation: string;
  occupationClass: string;
  isDeceased: boolean;
}

const defaultFormData: MemberFormData = {
  name: '', relationship: 'other', gender: 'male',
  birthDate: '', annualIncome: '', occupation: '',
  occupationClass: '', isDeceased: false,
};

export default function FamilyTreeBuilder({ userId, clientId, onNext, familyTreeId, onTreeSelect }: FamilyTreeBuilderProps) {
  const {
    trees, activeTree, loading,
    createTree, selectTree,
    addMember, updateMember, removeMember,
    linkSpouse, linkParentChild,
    deleteTree, togglePlanning,
  } = useFamilyTree(userId || null, clientId);

  const { policies, updatePolicy } = usePolicies(userId || null, clientId);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTreeName, setNewTreeName] = useState('');
  const [newTreeSelfName, setNewTreeSelfName] = useState('');
  const [newTreeSelfGender, setNewTreeSelfGender] = useState<Gender>('male');

  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null);

  const [showMemberForm, setShowMemberForm] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MemberFormData>(defaultFormData);

  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);

  // 刪除家庭圖確認
  const [showDeleteTreeConfirm, setShowDeleteTreeConfirm] = useState(false);

  // 選擇家庭圖
  useEffect(() => {
    if (familyTreeId) selectTree(familyTreeId);
    else if (trees.length > 0 && !activeTree) selectTree(trees[0].id);
  }, [familyTreeId, trees.length]);

  useEffect(() => {
    if (activeTree && onTreeSelect) onTreeSelect(activeTree.id);
  }, [activeTree?.id]);

  // ─── 快速新增：只選性別即完成 ───
  const handleQuickAdd = useCallback((memberId: string, position: 'spouse' | 'child' | 'parent') => {
    setQuickAdd({ sourceId: memberId, position });
  }, []);

  /**
   * 智慧關係推定：
   * 1. 配偶：如果 source 是 father → 新配偶自動為 mother（反之亦然）
   *    如果 source 是本人 → 配偶
   * 2. 子女：如果 source 是本人的父母 → 新子女 = 本人的兄弟/姊妹
   *    否則 → son/daughter
   * 3. 父母：根據來源推定（父親的父親 → 祖父、母親的父親 → 外祖父）
   */
  const inferRelationship = (
    position: 'spouse' | 'child' | 'parent',
    gender: Gender,
    source: FamilyMember | undefined,
    mainInsured: FamilyMember | undefined,
    allMembers: FamilyMember[] = [],
  ): RelationType => {
    if (position === 'parent') {
      // 判斷 source 是誰，來決定新增的父母是什麼身份
      if (source?.relationship === 'father') {
        // 父親的父母 → 祖父/祖母
        return gender === 'male' ? 'grandfather' : 'grandmother';
      }
      if (source?.relationship === 'mother') {
        // 母親的父母 → 外公/外婆（也用 grandfather/grandmother）
        return gender === 'male' ? 'grandfather' : 'grandmother';
      }
      if (source?.relationship === 'grandfather' || source?.relationship === 'grandmother') {
        // 祖父母的父母 → 曾祖父母（用 other 表示）
        return 'other';
      }
      // 本人新增父母
      return gender === 'male' ? 'father' : 'mother';
    }

    if (position === 'spouse') {
      // 如果 source 是「父」，配偶自動為「母」
      if (source?.relationship === 'father') return 'mother';
      if (source?.relationship === 'mother') return 'father';
      if (source?.relationship === 'grandfather') return 'grandmother';
      if (source?.relationship === 'grandmother') return 'grandfather';
      if (source?.relationship === 'son') return 'spouse';
      if (source?.relationship === 'daughter') return 'spouse';
      if (source?.relationship === 'brother') return 'spouse';
      if (source?.relationship === 'sister') return 'spouse';
      return 'spouse';
    }

    // position === 'child'
    // 如果 source 是本人的父母（或本人父母的配偶），新子女 = 本人的兄弟姊妹
    if (source && mainInsured) {
      const isParentOfMain = mainInsured.parentIds?.includes(source.id);
      const sourceSpouse = source.spouseId;
      const isSpouseOfParent = sourceSpouse && mainInsured.parentIds?.includes(sourceSpouse);
      if (isParentOfMain || isSpouseOfParent) {
        return gender === 'male' ? 'brother' : 'sister';
      }
    }
    return gender === 'male' ? 'son' : 'daughter';
  };

  const handleQuickAddGender = async (gender: Gender) => {
    if (!quickAdd || !activeTree) return;
    const source = activeTree.members.find(m => m.id === quickAdd.sourceId);
    const mainInsured = activeTree.members.find(m => m.isMainInsured);

    const relationship = inferRelationship(quickAdd.position, gender, source, mainInsured);

    const newMember = await addMember({
      name: '',
      relationship,
      gender,
      isMainInsured: false,
      isSelectedForPlanning: true,
      policyIds: [],
      childrenIds: [],
      parentIds: [],
    });

    if (newMember) {
      if (quickAdd.position === 'spouse') {
        await linkSpouse(quickAdd.sourceId, newMember.id);
      } else if (quickAdd.position === 'child') {
        await linkParentChild(quickAdd.sourceId, newMember.id);
        // 如果 source 有配偶，子女也自動連到另一個家長
        if (source?.spouseId) {
          await linkParentChild(source.spouseId, newMember.id);
        }
      } else if (quickAdd.position === 'parent') {
        await linkParentChild(newMember.id, quickAdd.sourceId);
        // 如果這是第二位父母，自動建立配偶關係
        const existingParents = activeTree.members.filter(
          m => quickAdd.sourceId && source?.parentIds?.includes(m.id)
        );
        // 注意：source 的 parentIds 可能還沒更新，但 activeTree 已有 child 的 parentIds
        const child = activeTree.members.find(m => m.id === quickAdd.sourceId);
        const otherParentIds = child?.parentIds || [];
        if (otherParentIds.length === 1) {
          // 已經有一位父母了，新的這位自動成為配偶
          await linkSpouse(otherParentIds[0], newMember.id);
        }
      }
    }

    setQuickAdd(null);
  };

  // ─── 刪除成員 ───
  const handleDeleteMember = useCallback(async (memberId: string) => {
    console.log('[FamilyTree] handleDeleteMember called for:', memberId);
    await removeMember(memberId);
  }, [removeMember]);

  // ─── 長按編輯 ───
  const handleEditMember = useCallback((memberId: string) => {
    if (!activeTree) return;
    const member = activeTree.members.find(m => m.id === memberId);
    if (!member) return;
    setEditingMemberId(memberId);
    setFormData({
      name: member.name || '',
      relationship: member.relationship,
      gender: member.gender,
      birthDate: member.birthDate || '',
      annualIncome: member.annualIncome?.toString() || '',
      occupation: member.occupation || '',
      occupationClass: member.occupationClass?.toString() || '',
      isDeceased: member.isDeceased || false,
    });
    setShowMemberForm(true);
  }, [activeTree]);

  const handleSaveMember = async () => {
    const memberData: Partial<FamilyMember> = {
      name: formData.name,
      relationship: formData.relationship,
      gender: formData.gender,
      birthDate: formData.birthDate || undefined,
      annualIncome: formData.annualIncome ? parseInt(formData.annualIncome) : undefined,
      occupation: formData.occupation || undefined,
      occupationClass: formData.occupationClass
        ? parseInt(formData.occupationClass) as 1|2|3|4|5|6 : undefined,
      isDeceased: formData.isDeceased,
    };
    if (editingMemberId) {
      await updateMember(editingMemberId, memberData);
    }
    setShowMemberForm(false);
    setEditingMemberId(null);
    setFormData(defaultFormData);
  };

  const handleNodeClick = useCallback((_: string) => {}, []);

  // ─── 多代家系圖佈局（男左女右、子女從中間往下）───
  function autoLayout(members: FamilyMember[], mainId: string) {
    const result: { member: FamilyMember; x: number; y: number }[] = [];
    const placed = new Set<string>();
    const main = members.find(m => m.id === mainId);
    if (!main) return result;

    const NODE = 80;
    const GAP_X = 40;     // 同層間距
    const GAP_Y = 80;     // 世代間距
    const COUPLE_GAP = 30; // 夫妻間距
    const CX = 400;
    const CY = 300;

    // 放置一對夫妻（男左女右），回傳夫妻中心 X
    function placeCouple(m: FamilyMember, cx: number, cy: number): number {
      const spouse = m.spouseId ? members.find(s => s.id === m.spouseId) : null;

      if (spouse && !placed.has(spouse.id)) {
        // 男左女右
        const left = m.gender === 'male' ? m : spouse;
        const right = m.gender === 'male' ? spouse : m;
        const leftX = cx - (NODE + COUPLE_GAP) / 2;
        const rightX = cx + (NODE + COUPLE_GAP) / 2;

        if (!placed.has(left.id)) {
          result.push({ member: left, x: leftX, y: cy });
          placed.add(left.id);
        }
        if (!placed.has(right.id)) {
          result.push({ member: right, x: rightX, y: cy });
          placed.add(right.id);
        }
        return cx; // 中心點
      } else {
        // 沒有配偶或配偶已放
        if (!placed.has(m.id)) {
          result.push({ member: m, x: cx, y: cy });
          placed.add(m.id);
        }
        if (spouse && placed.has(spouse.id)) {
          const spouseNode = result.find(r => r.member.id === spouse.id);
          if (spouseNode) return (cx + spouseNode.x) / 2;
        }
        return cx;
      }
    }

    // 收集某對夫妻的所有子女
    function getChildren(m: FamilyMember): FamilyMember[] {
      const childIds = new Set<string>();
      (m.childrenIds || []).forEach(id => childIds.add(id));
      if (m.spouseId) {
        const sp = members.find(s => s.id === m.spouseId);
        (sp?.childrenIds || []).forEach(id => childIds.add(id));
      }
      return members.filter(c => childIds.has(c.id));
    }

    // === Step 1: 放本人 + 配偶 ===
    const selfCenterX = placeCouple(main, CX, CY);

    // === Step 2: 放父母（上方）===
    const parentY = CY - NODE - GAP_Y;
    const parentIds = main.parentIds || [];
    const parentMembers = members.filter(m => parentIds.includes(m.id));

    let parentCenterX = selfCenterX;
    if (parentMembers.length === 2) {
      // 男左女右
      const dad = parentMembers.find(p => p.gender === 'male') || parentMembers[0];
      const mom = parentMembers.find(p => p.gender === 'female') || parentMembers[1];
      const leftX = selfCenterX - (NODE + COUPLE_GAP) / 2;
      const rightX = selfCenterX + (NODE + COUPLE_GAP) / 2;
      if (!placed.has(dad.id)) { result.push({ member: dad, x: leftX, y: parentY }); placed.add(dad.id); }
      if (!placed.has(mom.id)) { result.push({ member: mom, x: rightX, y: parentY }); placed.add(mom.id); }
      parentCenterX = selfCenterX;
    } else if (parentMembers.length === 1) {
      const p = parentMembers[0];
      parentCenterX = placeCouple(p, selfCenterX, parentY);
    }

    // === Step 3: 放祖父母（再上方）===
    const gpY = parentY - NODE - GAP_Y;
    parentMembers.forEach(parent => {
      const gpIds = parent.parentIds || [];
      const gps = members.filter(m => gpIds.includes(m.id) && !placed.has(m.id));
      if (gps.length > 0) {
        const parentNode = result.find(r => r.member.id === parent.id);
        const pcx = parentNode ? parentNode.x + NODE / 2 : parentCenterX;
        if (gps.length === 2) {
          const grandpa = gps.find(g => g.gender === 'male') || gps[0];
          const grandma = gps.find(g => g.gender === 'female') || gps[1];
          if (!placed.has(grandpa.id)) { result.push({ member: grandpa, x: pcx - (NODE + COUPLE_GAP) / 2, y: gpY }); placed.add(grandpa.id); }
          if (!placed.has(grandma.id)) { result.push({ member: grandma, x: pcx + (NODE + COUPLE_GAP) / 2, y: gpY }); placed.add(grandma.id); }
        } else {
          gps.forEach(gp => {
            if (!placed.has(gp.id)) placeCouple(gp, pcx, gpY);
          });
        }
      }
      // 祖父母的配偶（如果還沒放）
      const gpAll = members.filter(m => gpIds.includes(m.id));
      gpAll.forEach(gp => {
        if (gp.spouseId && !placed.has(gp.spouseId)) {
          const gpSpouse = members.find(m => m.id === gp.spouseId);
          const gpNode = result.find(r => r.member.id === gp.id);
          if (gpSpouse && gpNode) {
            const sx = gpSpouse.gender === 'male'
              ? gpNode.x - NODE - COUPLE_GAP
              : gpNode.x + NODE + COUPLE_GAP;
            result.push({ member: gpSpouse, x: sx, y: gpY });
            placed.add(gpSpouse.id);
          }
        }
      });
    });

    // === Step 4: 放兄弟姊妹（同一代，本人左邊）===
    // 兄弟姊妹 = 與本人有相同父母但不是本人（也不是本人的配偶）
    const siblings = members.filter(m =>
      !placed.has(m.id) &&
      m.id !== main.id &&
      m.id !== main.spouseId &&
      m.parentIds?.some(pid => main.parentIds?.includes(pid))
    );
    // 從本人左邊排列，每個兄弟姊妹+配偶佔一組
    let sibOffset = 0;
    siblings.forEach(sib => {
      sibOffset += 1;
      const sx = CX - sibOffset * (NODE + GAP_X);
      // 判斷兄弟姊妹是否有配偶
      if (sib.spouseId && !placed.has(sib.spouseId)) {
        const sibSpouse = members.find(m => m.id === sib.spouseId);
        if (sibSpouse) {
          // 男左女右
          const left = sib.gender === 'male' ? sib : sibSpouse;
          const right = sib.gender === 'male' ? sibSpouse : sib;
          const leftX = sx - COUPLE_GAP / 2;
          const rightX = sx + NODE + COUPLE_GAP / 2;
          result.push({ member: left, x: leftX, y: CY }); placed.add(left.id);
          result.push({ member: right, x: rightX, y: CY }); placed.add(right.id);
          sibOffset += 1; // 佔多一格
          return;
        }
      }
      if (!placed.has(sib.id)) {
        result.push({ member: sib, x: sx, y: CY });
        placed.add(sib.id);
      }
    });

    // === Step 5: 放子女（下方）===
    // 收集本人+配偶的所有子女
    const childrenAll = getChildren(main);
    const unplacedChildren = childrenAll.filter(c => !placed.has(c.id));
    const childY = CY + NODE + GAP_Y;

    if (unplacedChildren.length > 0) {
      const totalWidth = unplacedChildren.length * NODE + (unplacedChildren.length - 1) * GAP_X;
      const startX = selfCenterX - totalWidth / 2 + NODE / 2;

      unplacedChildren.forEach((child, i) => {
        const cx = startX + i * (NODE + GAP_X);
        if (!placed.has(child.id)) {
          result.push({ member: child, x: cx, y: childY });
          placed.add(child.id);
        }
        // 子女的配偶
        if (child.spouseId && !placed.has(child.spouseId)) {
          const cSpouse = members.find(m => m.id === child.spouseId);
          if (cSpouse) {
            const spX = child.gender === 'male'
              ? cx + NODE + COUPLE_GAP
              : cx - NODE - COUPLE_GAP;
            result.push({ member: cSpouse, x: spX, y: childY });
            placed.add(cSpouse.id);
          }
        }
      });
    }

    // === Step 6: 放孫子女（再下方）===
    const gcY = childY + NODE + GAP_Y;
    childrenAll.forEach(child => {
      const grandChildren = getChildren(child).filter(gc => !placed.has(gc.id));
      if (grandChildren.length === 0) return;
      const childNode = result.find(r => r.member.id === child.id);
      // 子女夫妻的中心
      let gcCX = childNode ? childNode.x + NODE / 2 : selfCenterX;
      if (child.spouseId) {
        const spNode = result.find(r => r.member.id === child.spouseId);
        if (childNode && spNode) gcCX = (childNode.x + spNode.x + NODE) / 2;
      }

      const gcTotalW = grandChildren.length * NODE + (grandChildren.length - 1) * GAP_X;
      const gcStartX = gcCX - gcTotalW / 2;
      grandChildren.forEach((gc, i) => {
        result.push({ member: gc, x: gcStartX + i * (NODE + GAP_X), y: gcY });
        placed.add(gc.id);
      });
    });

    // === Step 7: 未放置的 ===
    let extraX = 0;
    members.filter(m => !placed.has(m.id)).forEach(m => {
      result.push({ member: m, x: CX + 300 + extraX, y: CY });
      extraX += NODE + GAP_X;
    });

    return result;
  }

  // ─── React Flow 節點/邊 ───
  useEffect(() => {
    if (!activeTree) { setNodes([]); setEdges([]); return; }
    const members = activeTree.members;
    const mainInsured = members.find(m => m.isMainInsured);
    if (!mainInsured) return;

    const layoutNodes = autoLayout(members, mainInsured.id);
    const flowNodes: Node[] = layoutNodes.map(({ member, x, y }) => ({
      id: member.id,
      type: 'member',
      position: { x, y },
      data: {
        member,
        policyCount: member.policyIds?.length || 0,
        isSelected: member.isSelectedForPlanning || false,
        onEdit: handleEditMember,
        onSelect: handleNodeClick,
        onQuickAdd: handleQuickAdd,
        onDelete: handleDeleteMember,
      },
    }));

    // 建邊
    const flowEdges: Edge[] = [];
    const added = new Set<string>();

    members.forEach(m => {
      // 配偶連線
      if (m.spouseId) {
        const key = [m.id, m.spouseId].sort().join('-s-');
        if (!added.has(key)) {
          added.add(key);
          flowEdges.push({
            id: key, source: m.id, target: m.spouseId,
            sourceHandle: 'spouse-out', targetHandle: 'spouse-in',
            type: 'relationship', data: { relationshipType: 'spouse' },
          });
        }
      }

      // 親子連線（只從一個家長畫線到子女，避免重複）
      // 如果有配偶，只從父親（或第一個家長）畫線
      (m.childrenIds || []).forEach(cid => {
        const child = members.find(c => c.id === cid);
        if (!child) return;
        // 看子女有幾個家長在 tree 裡
        const childParents = members.filter(p => child.parentIds?.includes(p.id));
        // 如果有兩個家長，只從其中一個畫（取 sort 後第一個）
        if (childParents.length === 2) {
          const first = childParents.map(p => p.id).sort()[0];
          if (m.id !== first) return; // 跳過第二個家長
        }
        const key = `pc-${m.id}-${cid}`;
        if (!added.has(key)) {
          added.add(key);
          flowEdges.push({
            id: key, source: m.id, target: cid,
            type: 'relationship',
            data: {
              relationshipType: 'parent-child',
              // 傳夫妻中心讓 edge 知道從哪裡出發
              spouseId: m.spouseId,
            },
          });
        }
      });
    });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [activeTree, handleEditMember, handleNodeClick, handleQuickAdd, handleDeleteMember]);

  // ─── 建立家庭圖 ───
  const handleCreateTree = async () => {
    if (!newTreeName.trim() || !newTreeSelfName.trim()) return;
    const created = await createTree(newTreeName, newTreeSelfName, newTreeSelfGender);
    if (created && onTreeSelect) onTreeSelect(created.id);
    setShowCreateDialog(false);
    setNewTreeName('');
    setNewTreeSelfName('');
    setNewTreeSelfGender('male');
  };

  // ─── 載入中 ───
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // ─── 沒有家庭圖 ───
  if (!activeTree) {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center" style={{ minHeight: '60vh' }}>
        <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
          <Users size={40} className="text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">建立家庭圖</h2>
        <p className="text-slate-500 mb-6 max-w-md">建立家庭成員關係圖，作為保單健診的基礎。</p>

        {trees.length > 0 && (
          <div className="mb-6 w-full max-w-sm">
            <p className="text-sm text-slate-400 mb-2">或選擇已有的家庭圖：</p>
            <div className="space-y-2">
              {trees.map(t => (
                <button key={t.id}
                  onClick={() => { selectTree(t.id); onTreeSelect?.(t.id); }}
                  className="w-full text-left px-4 py-3 rounded-xl bg-white border border-slate-200 hover:border-blue-400 transition-colors">
                  <div className="font-medium text-slate-700">{t.name}</div>
                  <div className="text-xs text-slate-400">{t.members.length} 位成員</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
          <Plus size={18} /> 新建家庭圖
        </button>

        {showCreateDialog && renderCreateDialog()}
      </div>
    );
  }

  // ─── 主畫面 ───
  return (
    <div className="flex flex-col" style={{ height: '70vh' }}>
      {/* 工具列 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-3">
          <select value={activeTree.id}
            onChange={e => { selectTree(e.target.value); onTreeSelect?.(e.target.value); }}
            className="text-sm border rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {trees.map(t => (
              <option key={t.id} value={t.id}>{t.name}（{t.members.length} 人）</option>
            ))}
          </select>
          <button onClick={() => setShowCreateDialog(true)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <Plus size={14} /> 新增
          </button>
          {trees.length > 1 && (
            <button onClick={() => setShowDeleteTreeConfirm(true)}
              className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
              <Trash2 size={14} /> 刪除
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:inline">
            點擊展開新增 · 雙擊編輯
          </span>
          <button onClick={onNext}
            className="flex items-center gap-1 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            下一步 <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* 畫布 */}
      <div className="flex-1 relative" style={{ minHeight: '400px' }}>
        <ReactFlow
          nodes={nodes} edges={edges}
          nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          fitView fitViewOptions={{ padding: 0.4 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.3} maxZoom={2}
          onPaneClick={() => setQuickAdd(null)}
        >
          <Background color="#e2e8f0" gap={20} />
          <Controls />
          <MiniMap
            nodeColor={n => {
              const m = activeTree.members.find(x => x.id === n.id);
              if (m?.isMainInsured) return '#f59e0b';
              if (m?.gender === 'female') return '#ec4899';
              return '#3b82f6';
            }}
            maskColor="rgba(0,0,0,0.1)"
          />
        </ReactFlow>

        {/* 快速新增性別選擇 */}
        {quickAdd && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20"
            onClick={() => setQuickAdd(null)}>
            <div className="bg-white rounded-2xl shadow-2xl p-5 w-64" onClick={e => e.stopPropagation()}>
              <h4 className="text-sm font-bold text-slate-700 mb-3 text-center">
                {quickAdd.position === 'spouse' ? '新增配偶' :
                  quickAdd.position === 'child' ? '新增子女' : '新增父母'}
              </h4>
              <p className="text-xs text-slate-400 mb-3 text-center">選擇性別</p>
              <div className="flex gap-3">
                <button onClick={() => handleQuickAddGender('male')}
                  className="flex-1 py-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:border-blue-500 hover:bg-blue-100 transition-all flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-md border-2 border-blue-400 bg-blue-100" />
                  <span className="text-xs text-blue-700 font-bold">男</span>
                </button>
                <button onClick={() => handleQuickAddGender('female')}
                  className="flex-1 py-4 rounded-xl border-2 border-pink-200 bg-pink-50 hover:border-pink-500 hover:bg-pink-100 transition-all flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full border-2 border-pink-400 bg-pink-100" />
                  <span className="text-xs text-pink-700 font-bold">女</span>
                </button>
              </div>
              <button onClick={() => setQuickAdd(null)}
                className="w-full mt-3 py-1.5 text-xs text-slate-400 hover:text-slate-600">
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 下方成員列表 */}
      <div className="border-t bg-slate-50 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <CheckSquare size={14} className="text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">選擇要規劃的成員：</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTree.members.map(m => (
            <button key={m.id} onClick={() => togglePlanning(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                m.isSelectedForPlanning
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
              }`}>
              {m.isSelectedForPlanning
                ? <CheckSquare size={14} className="text-blue-500" />
                : <Square size={14} className="text-slate-300" />}
              {m.name || (m.relationship === 'self' ? '本人' :
                RELATION_LABELS[m.relationship] || m.relationship)}
              <span className="text-[10px] text-slate-400">({m.policyIds?.length || 0} 張)</span>
            </button>
          ))}
        </div>
      </div>

      {showMemberForm && renderEditForm()}
      {showCreateDialog && renderCreateDialog()}
      {showDeleteTreeConfirm && renderDeleteTreeConfirm()}
    </div>
  );

  // ─── 刪除家庭圖確認對話框 ───
  function renderDeleteTreeConfirm() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">確認刪除</h3>
            <button onClick={() => setShowDeleteTreeConfirm(false)}>
              <X size={20} className="text-slate-400 hover:text-slate-600" />
            </button>
          </div>
          <p className="text-sm text-slate-600 mb-6">
            確定要刪除「{activeTree.name}」嗎？此操作無法復原。
          </p>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteTreeConfirm(false)}
              className="flex-1 py-2.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
              取消
            </button>
            <button onClick={async () => {
              await deleteTree(activeTree.id);
              setShowDeleteTreeConfirm(false);
              // 刪除後選擇第一個家庭圖
              const remaining = trees.filter(t => t.id !== activeTree.id);
              if (remaining.length > 0) {
                selectTree(remaining[0].id);
              }
            }}
              className="flex-1 py-2.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center gap-1">
              <Trash2 size={14} /> 刪除
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── 完整編輯表單（長按開啟）───
  function renderEditForm() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">編輯成員資料</h3>
            <button onClick={() => { setShowMemberForm(false); setEditingMemberId(null); }}>
              <X size={20} className="text-slate-400 hover:text-slate-600" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-4">這些資料可從保單帶入，不必現在填寫</p>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-600 block mb-1">姓名</label>
              <input type="text" value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="選填"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm text-slate-600 block mb-1">與主被保人關係</label>
              <select value={formData.relationship}
                onChange={e => setFormData(p => ({ ...p, relationship: e.target.value as RelationType }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(RELATION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-600 block mb-1">性別</label>
              <div className="flex gap-3">
                <button onClick={() => setFormData(p => ({ ...p, gender: 'male' }))}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium ${formData.gender === 'male' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>男</button>
                <button onClick={() => setFormData(p => ({ ...p, gender: 'female' }))}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium ${formData.gender === 'female' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-slate-600 border-slate-200'}`}>女</button>
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-600 block mb-1">出生日期</label>
              <input type="date" value={formData.birthDate}
                onChange={e => setFormData(p => ({ ...p, birthDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm text-slate-600 block mb-1">年收入（萬元）</label>
              <input type="number" value={formData.annualIncome}
                onChange={e => setFormData(p => ({ ...p, annualIncome: e.target.value }))}
                placeholder="選填" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={formData.isDeceased}
                onChange={e => setFormData(p => ({ ...p, isDeceased: e.target.checked }))}
                className="rounded" />
              已故
            </label>

            {/* 保單綁定區塊 */}
            {editingMemberId && (
              <div className="pt-4 border-t mt-4">
                <label className="text-sm text-slate-600 block mb-2 flex items-center gap-1">
                  <FileText size={14} /> 綁定保單（被保險人）
                </label>
                {policies.length === 0 ? (
                  <p className="text-xs text-slate-400">尚未輸入保單</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {policies.map(p => {
                      const isLinked = p.familyMemberId === editingMemberId;
                      const linkedToOther = p.familyMemberId && p.familyMemberId !== editingMemberId;
                      const otherMember = linkedToOther
                        ? activeTree?.members.find(m => m.id === p.familyMemberId)
                        : null;
                      return (
                        <label key={p.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                            isLinked ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}>
                          <input
                            type="checkbox"
                            checked={isLinked}
                            onChange={async (e) => {
                              const newMemberId = e.target.checked ? editingMemberId : null;
                              // 更新保單的 familyMemberId
                              await updatePolicy(p.id, { familyMemberId: newMemberId || undefined });
                              // 更新成員的 policyIds
                              const member = activeTree?.members.find(m => m.id === editingMemberId);
                              if (member) {
                                const currentIds = member.policyIds || [];
                                const newIds = e.target.checked
                                  ? [...currentIds.filter(id => id !== p.id), p.id]
                                  : currentIds.filter(id => id !== p.id);
                                await updateMember(editingMemberId, { policyIds: newIds });
                              }
                              // 如果原本綁定在其他成員，也要更新那個成員的 policyIds
                              if (linkedToOther && p.familyMemberId) {
                                const oldMember = activeTree?.members.find(m => m.id === p.familyMemberId);
                                if (oldMember) {
                                  const oldIds = (oldMember.policyIds || []).filter(id => id !== p.id);
                                  await updateMember(p.familyMemberId, { policyIds: oldIds });
                                }
                              }
                            }}
                            className="rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-700 truncate">
                              {p.insurer} {p.policyNumber && `#${p.policyNumber}`}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {p.insured || '未填被保人'}
                              {linkedToOther && otherMember && (
                                <span className="text-amber-600 ml-1">
                                  （已綁定：{otherMember.name || RELATION_LABELS[otherMember.relationship]}）
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            {editingMemberId && editingMemberId !== activeTree?.mainInsuredId && (
              <button onClick={async () => {
                await removeMember(editingMemberId);
                setShowMemberForm(false); setEditingMemberId(null);
              }} className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm">
                <Trash2 size={14} className="inline mr-1" /> 刪除
              </button>
            )}
            <div className="flex-1" />
            <button onClick={() => { setShowMemberForm(false); setEditingMemberId(null); }}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm">取消</button>
            <button onClick={handleSaveMember}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 text-sm">
              <Save size={14} className="inline mr-1" /> 儲存
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderCreateDialog() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
          <h3 className="text-lg font-bold text-slate-800 mb-4">新建家庭圖</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-slate-600 block mb-1">家庭名稱</label>
              <input type="text" value={newTreeName} onChange={e => setNewTreeName(e.target.value)}
                placeholder="例：王家" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm text-slate-600 block mb-1">主被保人姓名</label>
              <input type="text" value={newTreeSelfName} onChange={e => setNewTreeSelfName(e.target.value)}
                placeholder="主被保人" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm text-slate-600 block mb-1">性別</label>
              <div className="flex gap-3">
                <button onClick={() => setNewTreeSelfGender('male')}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium ${newTreeSelfGender === 'male' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>男</button>
                <button onClick={() => setNewTreeSelfGender('female')}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium ${newTreeSelfGender === 'female' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-slate-600 border-slate-200'}`}>女</button>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setShowCreateDialog(false)}
              className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">取消</button>
            <button onClick={handleCreateTree}
              disabled={!newTreeName.trim() || !newTreeSelfName.trim()}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40">建立</button>
          </div>
        </div>
      </div>
    );
  }
}
