/**
 * Ultra Advisor - Store System Hook
 * UA 商城系統前端 Hook
 *
 * 檔案位置：src/hooks/useStore.ts
 */

import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

// 類型定義
export interface StoreItem {
  id: string;
  name: string;
  description: string;
  image: string;
  category: 'subscription' | 'merchandise' | 'digital' | 'experience';
  pointsCost: number;
  stock: number;
  stockUsed: number;
  remaining: number;
  maxPerUser: number;
  requiresShipping: boolean;
  isFeatured: boolean;
  autoAction?: {
    days?: number;
  } | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  itemId: string;
  itemName: string;
  itemImage: string;
  variant: string | null;
  pointsCost: number;
  status: 'pending' | 'processing' | 'shipped' | 'completed' | 'cancelled';
  trackingNumber: string | null;
  createdAt: Date | null;
  completedAt: Date | null;
}

export interface ShippingInfo {
  name: string;
  phone: string;
  address: string;
}

interface GetStoreItemsResult {
  success: boolean;
  items: StoreItem[];
}

interface GetUserOrdersResult {
  success: boolean;
  orders: Order[];
}

interface RedeemResult {
  success: boolean;
  orderNumber: string;
  message: string;
  isVirtual: boolean;
}

/**
 * Store System Hook
 */
export const useStore = () => {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 載入商品列表
  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const getStoreItems = httpsCallable<void, GetStoreItemsResult>(functions, 'getStoreItems');
      const result = await getStoreItems();
      if (result.data.success) {
        setItems(result.data.items);
      }
      return result.data;
    } catch (err: any) {
      const errorMsg = err.message || '載入商品失敗';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 載入用戶訂單
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const getUserOrders = httpsCallable<void, GetUserOrdersResult>(functions, 'getUserOrders');
      const result = await getUserOrders();
      if (result.data.success) {
        setOrders(result.data.orders);
      }
      return result.data;
    } catch (err: any) {
      const errorMsg = err.message || '載入訂單失敗';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 兌換商品
  const redeemItem = useCallback(async (
    itemId: string,
    variant?: string,
    shippingInfo?: ShippingInfo
  ): Promise<RedeemResult> => {
    setLoading(true);
    setError(null);
    try {
      const redeemStoreItem = httpsCallable<
        { itemId: string; variant?: string; shippingInfo?: ShippingInfo },
        RedeemResult
      >(functions, 'redeemStoreItem');

      const result = await redeemStoreItem({ itemId, variant, shippingInfo });

      // 兌換成功後重新載入商品和訂單
      if (result.data.success) {
        await Promise.all([fetchItems(), fetchOrders()]);
      }

      return result.data;
    } catch (err: any) {
      const errorMsg = err.message || '兌換失敗';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchItems, fetchOrders]);

  return {
    items,
    orders,
    loading,
    error,
    fetchItems,
    fetchOrders,
    redeemItem,
  };
};

/**
 * Store API (不需 Hook 狀態時使用)
 */
export const storeApi = {
  // 取得商品列表
  getItems: async (): Promise<StoreItem[]> => {
    const getStoreItems = httpsCallable<void, GetStoreItemsResult>(functions, 'getStoreItems');
    const result = await getStoreItems();
    return result.data.items;
  },

  // 取得用戶訂單
  getOrders: async (): Promise<Order[]> => {
    const getUserOrders = httpsCallable<void, GetUserOrdersResult>(functions, 'getUserOrders');
    const result = await getUserOrders();
    return result.data.orders;
  },

  // 兌換商品
  redeem: async (
    itemId: string,
    variant?: string,
    shippingInfo?: ShippingInfo
  ): Promise<RedeemResult> => {
    const redeemStoreItem = httpsCallable<
      { itemId: string; variant?: string; shippingInfo?: ShippingInfo },
      RedeemResult
    >(functions, 'redeemStoreItem');

    const result = await redeemStoreItem({ itemId, variant, shippingInfo });
    return result.data;
  },
};

export default useStore;
