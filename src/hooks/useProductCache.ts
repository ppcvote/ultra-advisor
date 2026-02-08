/**
 * 險種快取搜尋 Hook
 * 搜尋 Cloud Function 回傳的險種快取
 */
import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import type { ProductCache } from '../types/insurance';

export const useProductCache = () => {
  const [results, setResults] = useState<ProductCache[]>([]);
  const [searching, setSearching] = useState(false);

  const searchProducts = useCallback(async (keyword: string) => {
    if (!keyword.trim() || keyword.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      const fn = httpsCallable(functions, 'searchProductCache');
      const res = await fn({ keyword });
      const data = res.data as { products: ProductCache[] };
      setResults(data.products || []);
    } catch (err) {
      console.error('Product search error:', err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const lookupProduct = useCallback(async (insurer: string, productName: string) => {
    try {
      const fn = httpsCallable(functions, 'lookupInsuranceProduct');
      const res = await fn({ insurer, productName });
      return res.data as { product: ProductCache; claimSummary: any };
    } catch (err) {
      console.error('Product lookup error:', err);
      return null;
    }
  }, []);

  return {
    results,
    searching,
    searchProducts,
    lookupProduct,
  };
};

export default useProductCache;
