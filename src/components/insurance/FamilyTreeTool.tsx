/**
 * 家庭圖管理工具（獨立版本）
 * 在規劃頁面的側邊選單中使用，不依賴保單健診流程
 */
import React from 'react';
import FamilyTreeBuilder from './FamilyTreeBuilder';

interface FamilyTreeToolProps {
  userId?: string;
  clientId?: string;
}

export default function FamilyTreeTool({ userId, clientId }: FamilyTreeToolProps) {
  return (
    <div className="min-h-[80vh]">
      <FamilyTreeBuilder
        userId={userId}
        clientId={clientId}
        onNext={() => {
          // 獨立使用時不需要導航到下一步
        }}
      />
    </div>
  );
}
