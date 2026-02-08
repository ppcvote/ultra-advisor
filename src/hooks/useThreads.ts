/**
 * Threads 社群助理 - Firestore CRUD Hook
 *
 * 管理：threadsConfig / threadsLibrary / threadsPosts
 * 資料歸屬：用戶（顧問），非客戶
 */

import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  collection,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { ThreadsConfig, ThreadsLibraryItem, ThreadsPostRecord } from '../utils/threadsApi';

export interface UseThreadsReturn {
  // Config
  config: ThreadsConfig | null;
  configLoading: boolean;
  saveConfig: (updates: Partial<ThreadsConfig>) => Promise<void>;

  // Library
  library: ThreadsLibraryItem[];
  libraryLoading: boolean;
  addLibraryItem: (content: string) => Promise<void>;
  addLibraryItems: (contents: string[]) => Promise<void>;
  updateLibraryItem: (id: string, content: string) => Promise<void>;
  removeLibraryItem: (id: string) => Promise<void>;
  reorderLibrary: (id: string, direction: 'up' | 'down') => Promise<void>;
  markAsPublished: (id: string) => Promise<void>;

  // Posts
  posts: ThreadsPostRecord[];
  postsLoading: boolean;
  addPostRecord: (record: Omit<ThreadsPostRecord, 'id' | 'createdAt'>) => Promise<void>;
}

export function useThreads(userId: string | null): UseThreadsReturn {
  const [config, setConfig] = useState<ThreadsConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [library, setLibrary] = useState<ThreadsLibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [posts, setPosts] = useState<ThreadsPostRecord[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // ==========================================
  // 即時監聽 Firestore
  // ==========================================
  useEffect(() => {
    if (!userId) {
      setConfigLoading(false);
      setLibraryLoading(false);
      setPostsLoading(false);
      return;
    }

    // 1. 監聽 Config
    const configRef = doc(db, 'users', userId, 'threadsConfig', 'settings');
    const unsubConfig = onSnapshot(configRef, (snap) => {
      if (snap.exists()) {
        setConfig(snap.data() as ThreadsConfig);
      } else {
        setConfig(null);
      }
      setConfigLoading(false);
    });

    // 2. 監聽 Library（按 order 排序）
    const libraryRef = query(
      collection(db, 'users', userId, 'threadsLibrary'),
      orderBy('order', 'asc')
    );
    const unsubLibrary = onSnapshot(libraryRef, (snap) => {
      const items: ThreadsLibraryItem[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as ThreadsLibraryItem));
      setLibrary(items);
      setLibraryLoading(false);
    });

    // 3. 監聯 Posts（按建立時間倒序）
    const postsRef = query(
      collection(db, 'users', userId, 'threadsPosts'),
      orderBy('createdAt', 'desc')
    );
    const unsubPosts = onSnapshot(postsRef, (snap) => {
      const items: ThreadsPostRecord[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as ThreadsPostRecord));
      setPosts(items);
      setPostsLoading(false);
    });

    return () => {
      unsubConfig();
      unsubLibrary();
      unsubPosts();
    };
  }, [userId]);

  // ==========================================
  // Config 操作
  // ==========================================
  const saveConfig = useCallback(async (updates: Partial<ThreadsConfig>) => {
    if (!userId) return;
    const configRef = doc(db, 'users', userId, 'threadsConfig', 'settings');
    await setDoc(configRef, {
      ...updates,
      updatedAt: Timestamp.now(),
      ...(!config ? { createdAt: Timestamp.now() } : {}),
    }, { merge: true });
  }, [userId, config]);

  // ==========================================
  // Library 操作
  // ==========================================
  const addLibraryItem = useCallback(async (content: string) => {
    if (!userId) return;
    const maxOrder = library.length > 0 ? Math.max(...library.map(i => i.order)) : 0;
    await addDoc(collection(db, 'users', userId, 'threadsLibrary'), {
      content,
      order: maxOrder + 1,
      status: 'pending',
      createdAt: Timestamp.now(),
    });
  }, [userId, library]);

  const addLibraryItems = useCallback(async (contents: string[]) => {
    if (!userId || contents.length === 0) return;
    const maxOrder = library.length > 0 ? Math.max(...library.map(i => i.order)) : 0;
    const batch = writeBatch(db);
    contents.forEach((content, index) => {
      const ref = doc(collection(db, 'users', userId, 'threadsLibrary'));
      batch.set(ref, {
        content,
        order: maxOrder + index + 1,
        status: 'pending',
        createdAt: Timestamp.now(),
      });
    });
    await batch.commit();
  }, [userId, library]);

  const updateLibraryItem = useCallback(async (id: string, content: string) => {
    if (!userId) return;
    await updateDoc(doc(db, 'users', userId, 'threadsLibrary', id), { content });
  }, [userId]);

  const removeLibraryItem = useCallback(async (id: string) => {
    if (!userId) return;
    await deleteDoc(doc(db, 'users', userId, 'threadsLibrary', id));
  }, [userId]);

  const reorderLibrary = useCallback(async (id: string, direction: 'up' | 'down') => {
    if (!userId) return;
    const currentIndex = library.findIndex(item => item.id === id);
    if (currentIndex === -1) return;
    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (swapIndex < 0 || swapIndex >= library.length) return;

    const current = library[currentIndex];
    const swap = library[swapIndex];

    const batch = writeBatch(db);
    batch.update(doc(db, 'users', userId, 'threadsLibrary', current.id), { order: swap.order });
    batch.update(doc(db, 'users', userId, 'threadsLibrary', swap.id), { order: current.order });
    await batch.commit();
  }, [userId, library]);

  const markAsPublished = useCallback(async (id: string) => {
    if (!userId) return;
    await updateDoc(doc(db, 'users', userId, 'threadsLibrary', id), {
      status: 'published',
      publishedAt: Timestamp.now(),
    });
  }, [userId]);

  // ==========================================
  // Posts 操作
  // ==========================================
  const addPostRecord = useCallback(async (record: Omit<ThreadsPostRecord, 'id' | 'createdAt'>) => {
    if (!userId) return;
    await addDoc(collection(db, 'users', userId, 'threadsPosts'), {
      ...record,
      createdAt: Timestamp.now(),
    });
    // 更新 config 的 lastPostAt
    const configRef = doc(db, 'users', userId, 'threadsConfig', 'settings');
    await setDoc(configRef, { lastPostAt: Timestamp.now(), updatedAt: Timestamp.now() }, { merge: true });
  }, [userId]);

  return {
    config,
    configLoading,
    saveConfig,
    library,
    libraryLoading,
    addLibraryItem,
    addLibraryItems,
    updateLibraryItem,
    removeLibraryItem,
    reorderLibrary,
    markAsPublished,
    posts,
    postsLoading,
    addPostRecord,
  };
}
