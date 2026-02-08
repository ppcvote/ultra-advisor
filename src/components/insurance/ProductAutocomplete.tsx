/**
 * 險種名稱自動完成
 * 搜尋 productCache 集合
 */
import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useProductCache } from '../../hooks/useProductCache';
import type { ProductCache } from '../../types/insurance';

interface ProductAutocompleteProps {
  insurer: string;
  value: string;
  onChange: (name: string, product?: ProductCache) => void;
}

export default function ProductAutocomplete({ insurer, value, onChange }: ProductAutocompleteProps) {
  const { results, searching, searchProducts } = useProductCache();
  const [inputValue, setInputValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // 點擊外部關閉
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInputChange = (text: string) => {
    setInputValue(text);
    onChange(text);

    // 防抖搜尋
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (text.length >= 2) {
        searchProducts(text);
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
      }
    }, 300);
  };

  const handleSelect = (product: ProductCache) => {
    setInputValue(product.productName);
    onChange(product.productName, product);
    setShowDropdown(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder="險種名稱（輸入 2 字以上搜尋）"
          className="w-full px-3 py-1.5 pr-8 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {searching
            ? <Loader2 size={14} className="text-blue-500 animate-spin" />
            : <Search size={14} className="text-slate-300" />
          }
        </div>
      </div>

      {/* 下拉結果 */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.map(product => (
            <button
              key={product.id}
              onClick={() => handleSelect(product)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-slate-50 last:border-0"
            >
              <div className="font-medium text-slate-700">{product.productName}</div>
              <div className="text-xs text-slate-400">
                {product.insurer} · {product.status === 'selling' ? '在售' : '停售'}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
