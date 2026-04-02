/**
 * 家庭圖 CRUD Hook
 * Firestore 路徑：users/{uid}/familyTrees/{treeId}
 *
 * v2.0 改進：
 * - writeBatch 確保多步操作的原子性
 * - 刪除成員時同步清理保單的 familyMemberId
 * - 改用 crypto.randomUUID() 產生 ID
 * - addMemberWithLinks：一次完成新增 + 連結關係，避免 stale closure
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { FamilyTree, FamilyMember } from '../types/insurance';

const genId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 12)
    : Math.random().toString(36).slice(2, 10);

export const useFamilyTree = (userId: string | null, clientId?: string | null) => {
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [activeTree, setActiveTree] = useState<FamilyTree | null>(null);
  const [loading, setLoading] = useState(true);

  // ref 永遠指向最新的 activeTree，避免 useCallback 閉包過期
  const treeRef = useRef(activeTree);
  useEffect(() => { treeRef.current = activeTree; }, [activeTree]);

  const userRef = useRef(userId);
  useEffect(() => { userRef.current = userId; }, [userId]);

  const clientRef = useRef(clientId);
  useEffect(() => { clientRef.current = clientId; }, [clientId]);

  // helper：取得最新 tree（ref 優先）
  const latest = () => treeRef.current;

  // helper：寫入 members 並同步 local state
  const writeMembersAndSync = async (members: FamilyMember[]) => {
    const uid = userRef.current;
    const tree = latest();
    if (!uid || !tree) return;
    await updateDoc(
      doc(db, 'users', uid, 'familyTrees', tree.id),
      { members, updatedAt: Timestamp.now() },
    );
    const updated = { ...tree, members };
    setActiveTree(updated);
    treeRef.current = updated;
  };

  // 監聽所有家庭圖
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'users', userId, 'familyTrees'),
      orderBy('updatedAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      let data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as FamilyTree[];
      // 若有指定 clientId，只顯示該客戶的家庭圖
      if (clientId) {
        data = data.filter(t => (t as any).clientId === clientId);
      }
      setTrees(data);
      // 如果有 activeTree，同步更新
      const cur = treeRef.current;
      if (cur) {
        const updated = data.find(t => t.id === cur.id);
        if (updated) {
          setActiveTree(updated);
          treeRef.current = updated;
        }
      }
      setLoading(false);
    }, (err) => {
      console.error('FamilyTree listen error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [userId, clientId]);

  // 新建家庭圖（含一個「本人」成員）
  const createTree = useCallback(async (name: string, selfName: string, selfGender: 'male' | 'female') => {
    const uid = userRef.current;
    if (!uid) return null;
    const selfId = genId();
    const now = new Date().toISOString();
    const tree: Omit<FamilyTree, 'id'> = {
      userId: uid,
      ...(clientRef.current ? { clientId: clientRef.current } : {}),
      name,
      mainInsuredId: selfId,
      members: [{
        id: selfId,
        name: selfName,
        relationship: 'self',
        gender: selfGender,
        isMainInsured: true,
        isSelectedForPlanning: true,
        policyIds: [],
        childrenIds: [],
        parentIds: [],
      }],
      createdAt: now,
      updatedAt: now,
    };
    const ref = await addDoc(
      collection(db, 'users', uid, 'familyTrees'),
      { ...tree, createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
    );
    const created = { ...tree, id: ref.id };
    setActiveTree(created);
    treeRef.current = created;
    return created;
  }, []);

  // 選擇家庭圖
  const selectTree = useCallback((treeId: string) => {
    const found = trees.find(t => t.id === treeId);
    setActiveTree(found || null);
    treeRef.current = found || null;
  }, [trees]);

  // 新增成員
  const addMember = useCallback(async (member: Omit<FamilyMember, 'id'>) => {
    const uid = userRef.current;
    const tree = latest();
    if (!uid || !tree) return;
    const newMember: FamilyMember = { ...member, id: genId() };
    const updatedMembers = [...tree.members, newMember];
    await updateDoc(
      doc(db, 'users', uid, 'familyTrees', tree.id),
      { members: updatedMembers, updatedAt: Timestamp.now() },
    );
    const updated = { ...tree, members: updatedMembers };
    setActiveTree(updated);
    treeRef.current = updated;
    return newMember;
  }, []);

  /**
   * 原子性新增成員 + 建立關係
   * 一次 Firestore 寫入完成：新增成員 → linkSpouse / linkParentChild
   * 解決 stale closure 問題（不需要等 addMember 的 state 更新再 link）
   */
  const addMemberWithLinks = useCallback(async (
    member: Omit<FamilyMember, 'id'>,
    links: {
      spouseOf?: string;
      childOf?: string;
      parentOf?: string;
    },
  ) => {
    const uid = userRef.current;
    const tree = latest();
    if (!uid || !tree) return null;

    const newMember: FamilyMember = { ...member, id: genId() };
    let members = [...tree.members, newMember];

    // 建立配偶關係
    if (links.spouseOf) {
      members = members.map(m => {
        if (m.id === links.spouseOf) return { ...m, spouseId: newMember.id };
        if (m.id === newMember.id) return { ...m, spouseId: links.spouseOf };
        return m;
      });
    }

    // 建立親子關係（新成員是某人的子女）
    if (links.childOf) {
      members = members.map(m => {
        if (m.id === links.childOf) {
          const kids = m.childrenIds || [];
          if (!kids.includes(newMember.id)) return { ...m, childrenIds: [...kids, newMember.id] };
        }
        if (m.id === newMember.id) {
          const parents = m.parentIds || [];
          if (!parents.includes(links.childOf!)) return { ...m, parentIds: [...parents, links.childOf!] };
        }
        return m;
      });

      // 如果 childOf 有配偶，也自動建立親子關係
      const parent = members.find(m => m.id === links.childOf);
      if (parent?.spouseId) {
        const spouseId = parent.spouseId;
        members = members.map(m => {
          if (m.id === spouseId) {
            const kids = m.childrenIds || [];
            if (!kids.includes(newMember.id)) return { ...m, childrenIds: [...kids, newMember.id] };
          }
          if (m.id === newMember.id) {
            const parents = m.parentIds || [];
            if (!parents.includes(spouseId)) return { ...m, parentIds: [...parents, spouseId] };
          }
          return m;
        });
      }
    }

    // 建立親子關係（新成員是某人的父母）
    if (links.parentOf) {
      members = members.map(m => {
        if (m.id === newMember.id) {
          const kids = m.childrenIds || [];
          if (!kids.includes(links.parentOf!)) return { ...m, childrenIds: [...kids, links.parentOf!] };
        }
        if (m.id === links.parentOf) {
          const parents = m.parentIds || [];
          if (!parents.includes(newMember.id)) return { ...m, parentIds: [...parents, newMember.id] };
        }
        return m;
      });

      // 如果已有一位父母，新的自動成為配偶
      const child = members.find(m => m.id === links.parentOf);
      const existingParentIds = (child?.parentIds || []).filter(id => id !== newMember.id);
      if (existingParentIds.length === 1) {
        const otherParentId = existingParentIds[0];
        members = members.map(m => {
          if (m.id === otherParentId) return { ...m, spouseId: newMember.id };
          if (m.id === newMember.id) return { ...m, spouseId: otherParentId };
          return m;
        });
      }
    }

    // 一次寫入 Firestore
    await updateDoc(
      doc(db, 'users', uid, 'familyTrees', tree.id),
      { members, updatedAt: Timestamp.now() },
    );
    const updated = { ...tree, members };
    setActiveTree(updated);
    treeRef.current = updated;
    return newMember;
  }, []);

  // 更新成員
  const updateMember = useCallback(async (memberId: string, updates: Partial<FamilyMember>) => {
    const uid = userRef.current;
    const tree = latest();
    if (!uid || !tree) return;
    const updatedMembers = tree.members.map(m =>
      m.id === memberId ? { ...m, ...updates } : m,
    );
    await writeMembersAndSync(updatedMembers);
  }, []);

  // 刪除成員（不能刪除主被保人）
  // 同步清理：保單的 familyMemberId、其他成員的關係引用
  const removeMember = useCallback(async (memberId: string) => {
    const uid = userRef.current;
    const tree = latest();
    if (!uid || !tree) return;
    if (memberId === tree.mainInsuredId) return;

    const member = tree.members.find(m => m.id === memberId);
    const policyIds = member?.policyIds || [];

    // 清理 members 中的關係引用（避免 undefined，改用 delete）
    const updatedMembers = tree.members
      .filter(m => m.id !== memberId)
      .map(m => {
        const cleaned = { ...m };
        if (cleaned.spouseId === memberId) delete cleaned.spouseId;
        cleaned.parentIds = (m.parentIds || []).filter(id => id !== memberId);
        cleaned.childrenIds = (m.childrenIds || []).filter(id => id !== memberId);
        return cleaned;
      });

    // 用 batch 同時更新家庭圖 + 清理保單綁定
    const batch = writeBatch(db);
    batch.update(
      doc(db, 'users', uid, 'familyTrees', tree.id),
      { members: updatedMembers, updatedAt: Timestamp.now() },
    );

    // 清理綁定到此成員的保單
    if (policyIds.length > 0) {
      // 直接用已知的 policyIds 清理
      for (const pid of policyIds) {
        batch.update(
          doc(db, 'users', uid, 'insurancePolicies', pid),
          { familyMemberId: null, updatedAt: Timestamp.now() },
        );
      }
    } else {
      // 安全起見：掃描所有保單（處理 policyIds 可能不同步的情況）
      try {
        const policiesSnap = await getDocs(
          collection(db, 'users', uid, 'insurancePolicies')
        );
        policiesSnap.docs.forEach(pDoc => {
          if (pDoc.data().familyMemberId === memberId) {
            batch.update(pDoc.ref, { familyMemberId: null, updatedAt: Timestamp.now() });
          }
        });
      } catch {
        // 掃描失敗不阻斷主要操作
      }
    }

    await batch.commit();

    const updated = { ...tree, members: updatedMembers };
    setActiveTree(updated);
    treeRef.current = updated;
  }, []);

  // 建立配偶關係
  const linkSpouse = useCallback(async (memberId: string, spouseId: string) => {
    const uid = userRef.current;
    const tree = latest();
    if (!uid || !tree) return;
    const updatedMembers = tree.members.map(m => {
      if (m.id === memberId) return { ...m, spouseId };
      if (m.id === spouseId) return { ...m, spouseId: memberId };
      return m;
    });
    await writeMembersAndSync(updatedMembers);
  }, []);

  // 建立親子關係
  const linkParentChild = useCallback(async (parentId: string, childId: string) => {
    const uid = userRef.current;
    const tree = latest();
    if (!uid || !tree) return;
    const updatedMembers = tree.members.map(m => {
      if (m.id === parentId) {
        const kids = m.childrenIds || [];
        if (!kids.includes(childId)) return { ...m, childrenIds: [...kids, childId] };
      }
      if (m.id === childId) {
        const parents = m.parentIds || [];
        if (!parents.includes(parentId)) return { ...m, parentIds: [...parents, parentId] };
      }
      return m;
    });
    await writeMembersAndSync(updatedMembers);
  }, []);

  // 刪除家庭圖
  const deleteTree = useCallback(async (treeId: string) => {
    const uid = userRef.current;
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'familyTrees', treeId));
    const tree = latest();
    if (tree?.id === treeId) {
      setActiveTree(null);
      treeRef.current = null;
    }
  }, []);

  // 切換規劃選擇
  const togglePlanning = useCallback(async (memberId: string) => {
    const tree = latest();
    if (!userRef.current || !tree) return;
    const member = tree.members.find(m => m.id === memberId);
    if (!member) return;
    const updatedMembers = tree.members.map(m =>
      m.id === memberId ? { ...m, isSelectedForPlanning: !m.isSelectedForPlanning } : m,
    );
    await writeMembersAndSync(updatedMembers);
  }, []);

  return {
    trees,
    activeTree,
    loading,
    createTree,
    selectTree,
    addMember,
    addMemberWithLinks,
    updateMember,
    removeMember,
    linkSpouse,
    linkParentChild,
    deleteTree,
    togglePlanning,
  };
};

export default useFamilyTree;